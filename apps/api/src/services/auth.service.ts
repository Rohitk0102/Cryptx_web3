/**
 * Authentication Service
 * Handles SIWE (Sign-In with Ethereum) authentication flow
 * Validates: Requirements 1.4, 1.6, 1.7, 1.8, 1.9
 */

import crypto from 'crypto';
import jwt, { Secret } from 'jsonwebtoken';
import { SiweMessage } from 'siwe';
import prisma from '../utils/prisma';
import redisClient from '../utils/redis';

const JWT_SECRET = process.env.JWT_SECRET || '';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || '';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
const REFRESH_TOKEN_EXPIRES_IN = process.env.REFRESH_TOKEN_EXPIRES_IN || '7d';

// Nonce TTL: 5 minutes
const NONCE_TTL = 5 * 60;

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

interface JWTPayload {
  userId: string;
  walletAddress: string;
  iat?: number;
  exp?: number;
}

export class AuthService {
  /**
   * Generate a cryptographically secure nonce
   * @returns Random nonce string
   */
  generateNonce(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Store nonce in Redis with 5-minute TTL
   * @param walletAddress - The wallet address requesting authentication
   * @returns The generated nonce
   */
  async createNonce(walletAddress: string): Promise<string> {
    if (!walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      throw new Error('Invalid wallet address format');
    }

    const nonce = this.generateNonce();
    const key = `nonce:${walletAddress.toLowerCase()}`;

    try {
      await redisClient.setex(key, NONCE_TTL, nonce);
      return nonce;
    } catch (error) {
      console.error('Failed to store nonce in Redis:', error);
      throw new Error('Failed to generate authentication nonce');
    }
  }

  /**
   * Retrieve and validate nonce from Redis
   * @param walletAddress - The wallet address
   * @returns The stored nonce or null if not found/expired
   */
  async getNonce(walletAddress: string): Promise<string | null> {
    const key = `nonce:${walletAddress.toLowerCase()}`;

    try {
      const nonce = await redisClient.get(key);
      return nonce;
    } catch (error) {
      console.error('Failed to retrieve nonce from Redis:', error);
      return null;
    }
  }

  /**
   * Delete nonce from Redis after use
   * @param walletAddress - The wallet address
   */
  async deleteNonce(walletAddress: string): Promise<void> {
    const key = `nonce:${walletAddress.toLowerCase()}`;

    try {
      await redisClient.del(key);
    } catch (error) {
      console.error('Failed to delete nonce from Redis:', error);
    }
  }

  /**
   * Verify SIWE signature and authenticate user
   * @param message - The SIWE message
   * @param signature - The signature from the wallet
   * @returns User ID if authentication successful
   */
  async verifySiweSignature(message: string, signature: string): Promise<string> {
    try {
      // Parse SIWE message
      const siweMessage = new SiweMessage(message);

      // Verify the signature
      const fields = await siweMessage.verify({ signature });

      if (!fields.success) {
        throw new Error('Invalid signature');
      }

      // Extract wallet address
      const walletAddress = siweMessage.address.toLowerCase();

      // Verify nonce
      const storedNonce = await this.getNonce(walletAddress);
      if (!storedNonce || storedNonce !== siweMessage.nonce) {
        throw new Error('Invalid or expired nonce');
      }

      // Delete used nonce
      await this.deleteNonce(walletAddress);

      // Find or create user
      let user = await prisma.user.findUnique({
        where: { mainAddress: walletAddress },
      });

      if (!user) {
        user = await prisma.user.create({
          data: {
            mainAddress: walletAddress,
            createdAt: new Date(),
          },
        });
      }

      return user.id;
    } catch (error) {
      console.error('SIWE verification failed:', error);
      throw new Error('Authentication failed');
    }
  }

  /**
   * Generate JWT access and refresh tokens
   * @param userId - The user ID
   * @param walletAddress - The wallet address
   * @returns Token pair
   */
  async generateTokens(userId: string, walletAddress: string): Promise<TokenPair> {
    if (!JWT_SECRET || !REFRESH_TOKEN_SECRET) {
      throw new Error('JWT secrets not configured');
    }

    const payload = { userId, walletAddress: walletAddress.toLowerCase() };

    // Generate access token
    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });

    // Generate refresh token
    const refreshToken = jwt.sign(payload, REFRESH_TOKEN_SECRET, { expiresIn: '7d' });

    // Store refresh token in database (Session model)
    await prisma.session.create({
      data: {
        userId,
        refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      },
    });

    return { accessToken, refreshToken };
  }

  /**
   * Verify JWT access token
   * @param token - The JWT token
   * @returns Decoded payload if valid
   */
  verifyAccessToken(token: string): JWTPayload {
    try {
      const payload = jwt.verify(token, JWT_SECRET) as JWTPayload;
      return payload;
    } catch (error) {
      throw new Error('Invalid or expired access token');
    }
  }

  /**
   * Verify JWT refresh token
   * @param token - The refresh token
   * @returns Decoded payload if valid
   */
  async verifyRefreshToken(token: string): Promise<JWTPayload> {
    try {
      // Verify JWT signature
      const payload = jwt.verify(token, REFRESH_TOKEN_SECRET) as JWTPayload;

      // Check if token exists in database and is not expired
      const storedToken = await prisma.session.findFirst({
        where: {
          refreshToken: token,
          expiresAt: { gt: new Date() },
        },
      });

      if (!storedToken) {
        throw new Error('Refresh token not found or expired');
      }

      return payload;
    } catch (error) {
      throw new Error('Invalid or expired refresh token');
    }
  }

  /**
   * Refresh access token using refresh token
   * @param refreshToken - The refresh token
   * @returns New token pair
   */
  async refreshAccessToken(refreshToken: string): Promise<TokenPair> {
    // Verify refresh token
    const payload = await this.verifyRefreshToken(refreshToken);

    // Delete old session
    await prisma.session.deleteMany({
      where: { refreshToken },
    });

    // Generate new token pair
    return this.generateTokens(payload.userId, payload.walletAddress);
  }

  /**
   * Revoke refresh token (logout)
   * @param token - The refresh token to revoke
   */
  async revokeRefreshToken(token: string): Promise<void> {
    await prisma.session.deleteMany({
      where: { refreshToken: token },
    });
  }

  /**
   * Revoke all refresh tokens for a user (logout from all devices)
   * @param userId - The user ID
   */
  async revokeAllRefreshTokens(userId: string): Promise<void> {
    await prisma.session.deleteMany({
      where: { userId },
    });
  }
}

// Export singleton instance
export const authService = new AuthService();

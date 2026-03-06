import { Request, Response } from 'express';
import { SiweMessage } from 'siwe';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../utils/prisma';
import redis from '../utils/redis';

export const getNonce = async (req: Request, res: Response) => {
    try {
        const nonce = crypto.randomBytes(16).toString('hex');
        console.log('🎲 Generated nonce:', nonce);

        // Store nonce in Redis with 10 minute expiry
        console.log(`💾 Storing nonce in Redis: nonce:${nonce}`);
        const result = await redis.setex(`nonce:${nonce}`, 600, 'valid');
        console.log('Redis setex result:', result);

        if (result !== 'OK') {
            console.error('❌ Failed to store nonce in Redis');
            return res.status(500).json({ error: 'Failed to generate nonce' });
        }

        // Verify it was stored
        const verification = await redis.get(`nonce:${nonce}`);
        console.log(`✅ Nonce verification:`, verification);

        res.json({ nonce });
    } catch (error) {
        console.error('❌ Error generating nonce:', error);
        res.status(500).json({ error: 'Failed to generate nonce' });
    }
};

export const verifySignature = async (req: Request, res: Response) => {
    try {
        const { message, signature } = req.body;

        if (!message || !signature) {
            console.log('❌ Missing message or signature');
            return res.status(400).json({ error: 'Missing message or signature' });
        }

        console.log('📝 Parsing SIWE message...');
        // Parse SIWE message
        const siweMessage = new SiweMessage(message);
        console.log('✅ SIWE message parsed, nonce:', siweMessage.nonce);

        // Verify nonce exists and is valid
        console.log(`🔍 Checking nonce in Redis: nonce:${siweMessage.nonce}`);
        const nonceValid = await redis.get(`nonce:${siweMessage.nonce}`);
        console.log(`Redis nonce check result:`, nonceValid);

        if (!nonceValid) {
            console.log('❌ Nonce not found or expired in Redis');
            // Check if nonce exists at all
            const allNonces = await redis.keys('nonce:*');
            console.log('Available nonces in Redis:', allNonces);
            return res.status(401).json({ error: 'Invalid or expired nonce' });
        }

        console.log('✅ Nonce is valid');

        // Verify signature
        console.log('🔐 Verifying signature...');
        const fields = await siweMessage.verify({ signature });

        if (!fields.success) {
            console.log('❌ Signature verification failed');
            return res.status(401).json({ error: 'Invalid signature' });
        }

        console.log('✅ Signature verified successfully');

        // Delete used nonce (prevent replay attacks)
        console.log(`🗑️  Deleting used nonce: nonce:${siweMessage.nonce}`);
        await redis.del(`nonce:${siweMessage.nonce}`);

        const address = siweMessage.address.toLowerCase();
        console.log('👤 Looking up user with address:', address);

        // Find or create user
        let user = await prisma.user.findUnique({
            where: { mainAddress: address },
        });

        if (!user) {
            console.log('👤 User not found, creating new user...');
            user = await prisma.user.create({
                data: { mainAddress: address },
            });
            console.log('✅ New user created:', user.id);
        } else {
            console.log('✅ Existing user found:', user.id);
        }

        // Ensure wallet record exists for this address
        console.log('💼 Checking if wallet record exists...');
        const existingWallet = await prisma.wallet.findUnique({
            where: {
                userId_address: {
                    userId: user.id,
                    address: address
                }
            }
        });

        if (!existingWallet) {
            console.log('💼 Wallet record not found, creating one...');
            // Default to 'metamask' if provider not specified, or infer from somewhere if possible
            // We should ideally pass provider from the frontend
            const provider = req.body.provider || 'metamask';

            await prisma.wallet.create({
                data: {
                    userId: user.id,
                    address: address,
                    provider: provider,
                    chainTypes: ['ethereum', 'polygon', 'bsc'], // Default supported chains
                    nickname: 'Main Wallet',
                    isActive: true
                }
            });
            console.log('✅ Wallet record created successfully');
        } else {
            console.log('✅ Wallet record already exists');
        }

        // Generate tokens
        console.log('🎫 Generating access and refresh tokens...');
        const accessToken = jwt.sign(
            { userId: user.id, address: user.mainAddress },
            process.env.JWT_SECRET as string,
            { expiresIn: process.env.JWT_EXPIRES_IN || '15m' } as jwt.SignOptions
        );

        const refreshToken = jwt.sign(
            { userId: user.id },
            process.env.REFRESH_TOKEN_SECRET as string,
            { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d' } as jwt.SignOptions
        );

        // Store refresh token in database
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

        console.log('💾 Storing session in database...');
        await prisma.session.create({
            data: {
                userId: user.id,
                refreshToken,
                deviceInfo: req.headers['user-agent'] || null,
                ipAddress: req.ip || null,
                expiresAt,
            },
        });

        console.log('✅ Authentication complete for user:', user.id);
        res.json({
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                address: user.mainAddress,
            },
        });
    } catch (error: any) {
        console.error('❌ Error verifying signature:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({ error: 'Authentication failed', details: error.message });
    }
};

export const refreshAccessToken = async (req: Request, res: Response) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({ error: 'Refresh token required' });
        }

        // Verify refresh token
        const decoded = jwt.verify(
            refreshToken,
            process.env.REFRESH_TOKEN_SECRET!
        ) as { userId: string };

        // Check if session exists
        const session = await prisma.session.findUnique({
            where: { refreshToken },
            include: { user: true },
        });

        if (!session || session.expiresAt < new Date()) {
            return res.status(401).json({ error: 'Invalid or expired refresh token' });
        }

        // Generate new access token
        const accessToken = jwt.sign(
            { userId: session.user.id, address: session.user.mainAddress },
            process.env.JWT_SECRET as string,
            { expiresIn: process.env.JWT_EXPIRES_IN || '15m' } as jwt.SignOptions
        );

        res.json({ accessToken });
    } catch (error) {
        console.error('Error refreshing token:', error);
        res.status(401).json({ error: 'Invalid refresh token' });
    }
};

export const logout = async (req: Request, res: Response) => {
    try {
        const { refreshToken } = req.body;

        if (refreshToken) {
            // Delete session from database
            await prisma.session.deleteMany({
                where: { refreshToken },
            });
        }

        res.json({ message: 'Logged out successfully' });
    } catch (error) {
        console.error('Error logging out:', error);
        res.status(500).json({ error: 'Logout failed' });
    }
};

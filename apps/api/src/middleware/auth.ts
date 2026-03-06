import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { verifyToken } from '@clerk/backend';
import prisma from '../utils/prisma';

export interface AuthRequest extends Request {
    userId?: string;
    userAddress?: string;
    clerkUserId?: string;
}

export const authenticate = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
) => {
    try {
        const authHeader = req.headers.authorization;
        const clerkUserId = req.headers['x-clerk-user-id'] as string | undefined;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'No token provided' });
        }

        const token = authHeader.split(' ')[1];

        // Check if this is a Clerk token (has x-clerk-user-id header)
        if (clerkUserId) {
            console.log('🔐 Authenticating with Clerk token for user:', clerkUserId);

            try {
                // Verify Clerk session token
                const verifiedToken = await verifyToken(token, {
                    secretKey: process.env.CLERK_SECRET_KEY!,
                });

                if (!verifiedToken || verifiedToken.sub !== clerkUserId) {
                    return res.status(401).json({ error: 'Invalid Clerk token' });
                }

                // Find or create user based on Clerk user ID
                let user = await prisma.user.findFirst({
                    where: {
                        OR: [
                            { id: clerkUserId },
                            { mainAddress: clerkUserId }
                        ]
                    }
                });

                if (!user) {
                    // Create a placeholder user for Clerk - the address will be linked when they connect a wallet
                    console.log('👤 Creating new user for Clerk ID:', clerkUserId);
                    user = await prisma.user.create({
                        data: {
                            id: clerkUserId,
                            mainAddress: `clerk_${clerkUserId}` // Placeholder until wallet is connected
                        }
                    });
                }

                req.userId = user.id;
                req.clerkUserId = clerkUserId;
                req.userAddress = user.mainAddress;

                console.log('✅ Clerk authentication successful for user:', user.id);
                return next();
            } catch (clerkError) {
                console.error('❌ Clerk token verification failed:', clerkError);
                return res.status(401).json({ error: 'Invalid Clerk token' });
            }
        }

        // Fallback to legacy JWT verification (for SIWE auth)
        console.log('🔐 Authenticating with legacy JWT token');
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET!
        ) as { userId: string; address: string };

        // Verify user still exists
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
        });

        if (!user) {
            return res.status(401).json({ error: 'User not found' });
        }

        req.userId = decoded.userId;
        req.userAddress = decoded.address;

        next();
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return res.status(401).json({ error: 'Token expired' });
        }
        console.error('❌ Authentication error:', error);
        return res.status(401).json({ error: 'Invalid token' });
    }
};

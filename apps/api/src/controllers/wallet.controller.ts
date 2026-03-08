import { Response } from 'express';
import { AuthRequest } from '../middleware/auth';
import prisma from '../utils/prisma';
import { getMultiChainBalances } from '../services/blockchain.service';
import { validateWalletData, sanitizeChainTypes } from '../utils/chainValidation';

/**
 * Add a new wallet for the user
 */
export const addWallet = async (req: AuthRequest, res: Response) => {
    try {
        const { address, provider, chainTypes, nickname } = req.body;
        const userId = req.userId!;
        const requestedChains = Array.isArray(chainTypes)
            ? chainTypes
            : ['ethereum', 'polygon', 'bsc'];
        const normalizedProvider =
            typeof provider === 'string' ? provider.trim().toLowerCase() : '';
        const normalizedNickname =
            typeof nickname === 'string' && nickname.trim() ? nickname.trim() : undefined;

        console.log('📥 Add wallet request:', {
            userId,
            address,
            provider: normalizedProvider,
            chainTypes: requestedChains,
            nickname: normalizedNickname,
        });

        if (!address || !normalizedProvider) {
            console.log('❌ Missing required fields');
            return res.status(400).json({ error: 'Address and provider are required' });
        }

        // Validate wallet data
        const validation = validateWalletData({
            address,
            chainTypes: requestedChains,
            provider: normalizedProvider,
        });

        console.log('🔍 Validation result:', validation);

        if (!validation.isValid) {
            console.log('❌ Validation failed:', validation.errors);
            return res.status(400).json({
                error: 'Invalid wallet data',
                details: validation.errors
            });
        }

        // Normalize address and sanitize chain types
        const normalizedAddress = address.toLowerCase();
        const sanitizedChains = sanitizeChainTypes(requestedChains);
        const [user, activeWalletCount] = await Promise.all([
            prisma.user.findUnique({
                where: { id: userId },
                select: { mainAddress: true },
            }),
            prisma.wallet.count({
                where: { userId, isActive: true },
            }),
        ]);
        const shouldUpdatePrimaryAddress =
            !user?.mainAddress ||
            user.mainAddress.startsWith('clerk_') ||
            activeWalletCount === 0;

        // Check if wallet already exists
        const existing = await prisma.wallet.findUnique({
            where: {
                userId_address: {
                    userId,
                    address: normalizedAddress,
                },
            },
        });

        if (existing) {
            // If wallet exists but is inactive (soft-deleted), reactivate it
            if (!existing.isActive) {
                console.log('🔄 Reactivating soft-deleted wallet:', existing.id);
                const reactivatedWallet = await prisma.$transaction(async (tx) => {
                    const updatedWallet = await tx.wallet.update({
                        where: { id: existing.id },
                        data: {
                            isActive: true,
                            provider: normalizedProvider,
                            chainTypes: sanitizedChains,
                            nickname: normalizedNickname || existing.nickname,
                        },
                    });

                    if (shouldUpdatePrimaryAddress) {
                        await tx.user.update({
                            where: { id: userId },
                            data: { mainAddress: normalizedAddress },
                        });
                    }

                    return updatedWallet;
                });
                return res.status(200).json({
                    ...reactivatedWallet,
                    reactivated: true,
                });
            }

            const mergedChains = Array.from(
                new Set([
                    ...sanitizeChainTypes(existing.chainTypes),
                    ...sanitizedChains,
                ])
            );

            console.log('🔁 Wallet already exists and is active. Updating existing wallet metadata:', existing.id);
            const updatedWallet = await prisma.wallet.update({
                where: { id: existing.id },
                data: {
                    provider: normalizedProvider || existing.provider,
                    chainTypes: mergedChains,
                    nickname: normalizedNickname ?? existing.nickname,
                    isActive: true,
                },
            });

            return res.status(200).json({
                ...updatedWallet,
                alreadyConnected: true,
            });
        }

        // Create wallet
        const wallet = await prisma.$transaction(async (tx) => {
            const createdWallet = await tx.wallet.create({
                data: {
                    userId,
                    address: normalizedAddress,
                    provider: normalizedProvider,
                    chainTypes: sanitizedChains,
                    nickname: normalizedNickname,
                },
            });

            if (shouldUpdatePrimaryAddress) {
                await tx.user.update({
                    where: { id: userId },
                    data: { mainAddress: normalizedAddress },
                });
            }

            return createdWallet;
        });

        res.status(201).json(wallet);
    } catch (error) {
        console.error('Error adding wallet:', error);
        res.status(500).json({ error: 'Failed to add wallet' });
    }
};

/**
 * Get all wallets for the user
 */
export const getWallets = async (req: AuthRequest, res: Response) => {
    try {
        const userId = req.userId!;

        const [wallets, user] = await Promise.all([
            prisma.wallet.findMany({
                where: { userId, isActive: true },
                orderBy: { createdAt: 'desc' },
            }),
            prisma.user.findUnique({
                where: { id: userId },
                select: { mainAddress: true },
            }),
        ]);

        const normalizedWallets = wallets
            .map((wallet) => ({
                ...wallet,
                provider: wallet.provider.trim().toLowerCase(),
                nickname: wallet.nickname?.trim() || null,
                chainTypes: sanitizeChainTypes(wallet.chainTypes),
            }))
            .sort((a, b) => {
                if (a.address === user?.mainAddress) return -1;
                if (b.address === user?.mainAddress) return 1;
                return 0;
            });

        res.json(normalizedWallets);
    } catch (error) {
        console.error('Error fetching wallets:', error);
        res.status(500).json({ error: 'Failed to fetch wallets' });
    }
};

/**
 * Delete a wallet
 */
export const deleteWallet = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.userId!;
        const walletId = id as string;

        console.log('🗑️  Delete wallet request:', {
            walletId,
            walletIdType: typeof walletId,
            userId,
            userIdType: typeof userId,
            allParams: req.params,
            method: req.method,
            url: req.url,
            headers: {
                authorization: req.headers.authorization ? 'Present' : 'Missing',
                contentType: req.headers['content-type']
            }
        });

        if (!walletId) {
            console.log('❌ No wallet ID provided');
            return res.status(400).json({ error: 'Wallet ID is required' });
        }

        if (!userId) {
            console.log('❌ No user ID in request');
            return res.status(401).json({ error: 'Unauthorized - no user ID' });
        }

        // Verify ownership
        const wallet = await prisma.wallet.findFirst({
            where: {
                id: walletId,
                userId: userId
            },
        });

        console.log('🔍 Database query result:', wallet ? {
            id: wallet.id,
            address: wallet.address,
            userId: wallet.userId,
            isActive: wallet.isActive,
            matchesRequestUserId: wallet.userId === userId
        } : 'No wallet found');

        if (!wallet) {
            console.log('❌ Wallet not found or unauthorized');
            return res.status(404).json({ error: 'Wallet not found or you do not have permission to delete it' });
        }

        if (wallet.userId !== userId) {
            console.log('❌ Unauthorized access attempt - user mismatch');
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Soft delete
        const updated = await prisma.wallet.update({
            where: { id: walletId },
            data: { isActive: false },
        });

        const [user, nextPrimaryWallet] = await Promise.all([
            prisma.user.findUnique({
                where: { id: userId },
                select: { mainAddress: true },
            }),
            prisma.wallet.findFirst({
                where: {
                    userId,
                    isActive: true,
                    id: { not: walletId },
                },
                orderBy: { createdAt: 'desc' },
            }),
        ]);

        if (user?.mainAddress === wallet.address && nextPrimaryWallet) {
            await prisma.user.update({
                where: { id: userId },
                data: { mainAddress: nextPrimaryWallet.address },
            });
        }

        console.log('✅ Wallet soft-deleted successfully:', {
            id: updated.id,
            address: updated.address,
            isActive: updated.isActive,
            wasActive: wallet.isActive
        });

        res.json({
            success: true,
            message: 'Wallet removed successfully',
            wallet: {
                id: updated.id,
                address: updated.address,
                isActive: updated.isActive
            }
        });
    } catch (error: any) {
        console.error('❌ Error deleting wallet:', error);
        console.error('❌ Error stack:', error.stack);
        res.status(500).json({
            error: 'Failed to delete wallet',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * Get wallet balances
 */
export const getWalletBalances = async (req: AuthRequest, res: Response) => {
    try {
        const { id } = req.params;
        const userId = req.userId!;
        const walletId = id as string;

        // Verify ownership
        const wallet = await prisma.wallet.findFirst({
            where: { id: walletId, userId },
        });

        if (!wallet || wallet.userId !== userId) {
            return res.status(404).json({ error: 'Wallet not found' });
        }

        // Validate and sanitize chain types
        const chainValidation = validateWalletData({
            address: wallet.address,
            chainTypes: wallet.chainTypes,
            provider: wallet.provider,
        });

        const sanitizedChains = sanitizeChainTypes(wallet.chainTypes);

        if (sanitizedChains.length === 0) {
            return res.status(400).json({
                error: 'Wallet has no supported chain types configured',
                details: chainValidation.errors
            });
        }

        if (!chainValidation.isValid) {
            console.warn(`Using sanitized chain types for wallet ${wallet.address}:`, chainValidation.errors);
        }

        // Fetch balances across chains (token discovery is now integrated)
        const balances = await getMultiChainBalances(
            wallet.address,
            sanitizedChains
        );

        res.json({
            wallet: {
                id: wallet.id,
                address: wallet.address,
                nickname: wallet.nickname,
                chainTypes: sanitizedChains,
            },
            balances,
        });
    } catch (error) {
        console.error('Error fetching balances:', error);
        res.status(500).json({ error: 'Failed to fetch balances' });
    }
};

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
    addWallet,
    getWallets,
    deleteWallet,
    getWalletBalances,
} from '../controllers/wallet.controller';

const router = Router();

// All routes require authentication
router.use(authenticate);

router.post('/', addWallet);
router.get('/', getWallets);
router.delete('/:id', deleteWallet);
router.get('/:id/balances', getWalletBalances);

// Debug endpoint to check wallet status
router.get('/:id/debug', async (req: any, res: any) => {
    try {
        const { id } = req.params;
        const userId = req.userId;
        
        const wallet = await (await import('../utils/prisma')).default.wallet.findUnique({
            where: { id },
            include: {
                user: {
                    select: { id: true, mainAddress: true }
                }
            }
        });
        
        res.json({
            found: !!wallet,
            wallet: wallet ? {
                id: wallet.id,
                address: wallet.address,
                userId: wallet.userId,
                isActive: wallet.isActive,
                matchesCurrentUser: wallet.userId === userId
            } : null,
            currentUserId: userId
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

export default router;

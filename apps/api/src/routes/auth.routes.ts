import { Router } from 'express';
import { getNonce, verifySignature, refreshAccessToken, logout } from '../controllers/auth.controller';

const router = Router();

router.post('/nonce', getNonce);
router.post('/verify', verifySignature);
router.post('/refresh', refreshAccessToken);
router.post('/logout', logout);

export default router;

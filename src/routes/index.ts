import { Router } from 'express';
import authRouter from './auth.routes';
import tradingRouter from './trading.routes';

const router = Router();

router.use('/auth', authRouter);
router.use('/trading', tradingRouter);

export default router;

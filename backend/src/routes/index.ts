import { Router } from 'express';
import authRouter from './auth.routes';
import groupsRouter from './groups.routes';
import tradingRouter from './trading.routes';

const router = Router();

router.use('/auth', authRouter);
router.use('/groups', groupsRouter);
router.use('/trading', tradingRouter);

export default router;

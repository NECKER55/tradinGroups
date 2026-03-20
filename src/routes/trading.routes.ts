import { Router } from 'express';
import {
  getPrivateBalance,
  updatePrivateBalance,
} from '../controllers/privateBalance.controller';
import { authenticate } from '../middleware/auth';
import { requirePrivatePortfolio } from '../middleware/privatePortfolio';

const tradingRouter = Router();

tradingRouter.get(
  '/private/balance',
  authenticate,
  requirePrivatePortfolio,
  getPrivateBalance
);

tradingRouter.put(
  '/private/balance',
  authenticate,
  requirePrivatePortfolio,
  updatePrivateBalance
);

export default tradingRouter;

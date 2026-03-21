import { Router } from 'express';
import {
  getPrivateBalance,
  updatePrivateBalance,
} from '../controllers/privateBalance.controller';
import {
  cancelPendingOrder,
  createOrder,
  getPortfolioHoldings,
  getProfileTransactions,
} from '../controllers/tradingOrders.controller';
import { authenticate } from '../middleware/auth';
import { requirePrivatePortfolio } from '../middleware/privatePortfolio';

const tradingRouter = Router();

tradingRouter.get(
  '/transactions/profile',
  getProfileTransactions
);

tradingRouter.get(
  '/portfolio/:id_portafoglio/holdings',
  getPortfolioHoldings
);

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

tradingRouter.post(
  '/orders',
  authenticate,
  createOrder
);

tradingRouter.delete(
  '/orders/:id_transazione',
  authenticate,
  cancelPendingOrder
);

export default tradingRouter;

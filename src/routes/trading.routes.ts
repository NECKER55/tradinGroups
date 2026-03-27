import { Router } from 'express';
import {
  getPrivateBalance,
  updatePrivateBalance,
} from '../controllers/privateBalance.controller';
import {
  acceptFriendRequest,
  blockUser,
  cancelSentFriendRequest,
  getMyFriendships,
  removeFriendship,
  rejectFriendRequest,
  sendFriendRequest,
  unblockUser,
} from '../controllers/friendships.controller';
import {
  addStockToWatchlist,
  cancelPendingOrder,
  createOrder,
  getPortfolioBalanceHistory,
  getPortfolioHoldings,
  getProfileTransactions,
  getMyWatchlist,
  getStocksCurrentPrices,
  removeStockFromWatchlist,
  searchPeopleByUsernameOrId,
  searchStocksByPrefix,
} from '../controllers/tradingOrders.controller';
import { authenticate, optionalAuth } from '../middleware/auth';
import { requirePrivatePortfolio } from '../middleware/privatePortfolio';

const tradingRouter = Router();

tradingRouter.get(
  '/transactions/profile',
  getProfileTransactions
);

tradingRouter.get(
  '/stocks/search',
  searchStocksByPrefix
);

tradingRouter.get(
  '/stocks/current-prices',
  getStocksCurrentPrices
);

tradingRouter.get(
  '/users/search',
  optionalAuth,
  searchPeopleByUsernameOrId
);

tradingRouter.post(
  '/friendships/requests',
  authenticate,
  sendFriendRequest
);

tradingRouter.get(
  '/friendships',
  authenticate,
  getMyFriendships
);

tradingRouter.post(
  '/friendships/:id_persona/accept',
  authenticate,
  acceptFriendRequest
);

tradingRouter.post(
  '/friendships/:id_persona/reject',
  authenticate,
  rejectFriendRequest
);

tradingRouter.delete(
  '/friendships/:id_persona/request',
  authenticate,
  cancelSentFriendRequest
);

tradingRouter.delete(
  '/friendships/:id_persona',
  authenticate,
  removeFriendship
);

tradingRouter.post(
  '/friendships/:id_persona/block',
  authenticate,
  blockUser
);

tradingRouter.post(
  '/friendships/:id_persona/unblock',
  authenticate,
  unblockUser
);

tradingRouter.get(
  '/portfolio/:id_portafoglio/holdings',
  getPortfolioHoldings
);

tradingRouter.get(
  '/portfolio/:id_portafoglio/balance-history',
  getPortfolioBalanceHistory
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

tradingRouter.post(
  '/watchlist',
  authenticate,
  addStockToWatchlist
);

tradingRouter.get(
  '/watchlist',
  authenticate,
  getMyWatchlist
);

tradingRouter.delete(
  '/watchlist/:id_stock',
  authenticate,
  removeStockFromWatchlist
);

tradingRouter.delete(
  '/orders/:id_transazione',
  authenticate,
  cancelPendingOrder
);

export default tradingRouter;

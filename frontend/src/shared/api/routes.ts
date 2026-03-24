export const ROUTES = {
  AUTH: {
    BASE: '/auth',
    REGISTER: '/auth/register',
    LOGIN: '/auth/login',
    REFRESH: '/auth/refresh',
    LOGOUT: '/auth/logout',
    ME: '/auth/me',
    CHANGE_PASSWORD: '/auth/me/password',
    CHANGE_USERNAME: '/auth/me/username',
  },
  TRADING: {
    PRIVATE_BALANCE: '/trading/private/balance',
    ORDERS: '/trading/orders',
    ORDER_BY_ID: (orderId: number) => `/trading/orders/${orderId}`,
    WATCHLIST: '/trading/watchlist',
    WATCHLIST_BY_STOCK: (stockId: string) => `/trading/watchlist/${stockId}`,
    PROFILE_TRANSACTIONS: '/trading/transactions/profile',
    STOCKS_SEARCH: '/trading/stocks/search',
    PORTFOLIO_HOLDINGS: (portfolioId: number) => `/trading/portfolio/${portfolioId}/holdings`,
    PORTFOLIO_BALANCE_HISTORY: (portfolioId: number) => `/trading/portfolio/${portfolioId}/balance-history`,
  },
};

export default ROUTES;

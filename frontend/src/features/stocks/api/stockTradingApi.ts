import { apiRequest } from '../../auth/api/authApi';
import { ROUTES } from '../../../shared/api/routes';
import {
  getMyWatchlist,
  getPortfolioHoldings,
  getPrivateBalance,
  type HoldingItem,
  type PrivateBalanceResponse,
  type WatchlistResponse,
} from '../../home/api/personalWorkspaceApi';

export interface CreateOrderPayload {
  id_portafoglio: number;
  id_stock: string;
  tipo: 'Buy' | 'Sell';
  importo_investito?: string;
  quantita_azioni?: string;
}

export interface CreateOrderResponse {
  message: string;
  transaction: {
    id_transazione: number;
    id_portafoglio: number;
    id_stock: string;
    tipo: 'Buy' | 'Sell';
    stato: 'Pending' | 'Executed';
    prezzo_esecuzione: string;
    importo_investito: string | null;
    quantita_azioni: string | null;
    created_at: string;
  };
}

export async function createOrder(payload: CreateOrderPayload): Promise<CreateOrderResponse> {
  return apiRequest<CreateOrderResponse>(ROUTES.TRADING.ORDERS, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function addToWatchlist(stockId: string): Promise<{ message: string; id_stock: string }> {
  return apiRequest<{ message: string; id_stock: string }>(ROUTES.TRADING.WATCHLIST, {
    method: 'POST',
    body: JSON.stringify({ id_stock: stockId }),
  });
}

export async function removeFromWatchlist(stockId: string): Promise<{ message: string; id_stock: string }> {
  return apiRequest<{ message: string; id_stock: string }>(ROUTES.TRADING.WATCHLIST_BY_STOCK(stockId), {
    method: 'DELETE',
  });
}

export interface StockDetailBootstrap {
  portfolioId: number;
  cash: number;
  holdings: HoldingItem[];
  watchlist: WatchlistResponse['results'];
}

export async function loadStockDetailBootstrap(): Promise<StockDetailBootstrap> {
  const privateBalance: PrivateBalanceResponse = await getPrivateBalance();
  const portfolioId = privateBalance.portfolio.id_portafoglio;

  const [holdingsRes, watchlistRes] = await Promise.all([
    getPortfolioHoldings(portfolioId),
    getMyWatchlist(),
  ]);

  return {
    portfolioId,
    cash: Number(privateBalance.portfolio.liquidita) || 0,
    holdings: holdingsRes.holdings,
    watchlist: watchlistRes.results,
  };
}

export function findHoldingForSymbol(holdings: HoldingItem[], symbol: string): HoldingItem | undefined {
  return holdings.find((item) => item.id_stock.toUpperCase() === symbol.toUpperCase());
}

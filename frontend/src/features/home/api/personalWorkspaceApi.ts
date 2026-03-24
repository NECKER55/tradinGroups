import { apiRequest } from '../../auth/api/authApi';
import { ROUTES } from '../../../shared/api/routes';

export interface PrivateBalanceResponse {
  portfolio: {
    id_portafoglio: number;
    liquidita: string;
    id_persona: number;
    id_gruppo: number | null;
  };
}

export interface HoldingItem {
  id_stock: string;
  nome_societa: string;
  settore: string;
  numero: string;
  prezzo_medio_acquisto: string;
}

export interface HoldingsResponse {
  id_portafoglio: number;
  count: number;
  holdings: HoldingItem[];
}

export interface TransactionItem {
  id_transazione: number;
  id_portafoglio: number;
  id_stock: string;
  tipo: 'Buy' | 'Sell';
  stato: 'Pending' | 'Executed';
  prezzo_esecuzione: string;
  importo_investito: string | null;
  quantita_azioni: string | null;
  created_at: string;
}

export interface ProfileTransactionsResponse {
  id_persona: number;
  days: number;
  count: number;
  transactions: TransactionItem[];
}

export interface WatchlistItem {
  id_stock: string;
  nome_societa: string;
  settore: string;
}

export interface WatchlistResponse {
  count: number;
  results: WatchlistItem[];
}

export interface BalanceHistoryPoint {
  data: string;
  valore_totale: string;
}

export interface BalanceHistoryResponse {
  id_portafoglio: number;
  count: number;
  history: BalanceHistoryPoint[];
}

export interface UpdatePrivateBalancePayload {
  delta_liquidita: string;
}

export interface UpdatePrivateBalanceResponse {
  message: string;
  delta_liquidita: string;
  portfolio: {
    id_portafoglio: number;
    liquidita: string;
    id_persona: number;
    id_gruppo: number | null;
  };
}

export interface StockSearchItem {
  id_stock: string;
  nome_societa: string;
  settore: string;
}

export interface StockSearchResponse {
  q: string;
  count: number;
  results: StockSearchItem[];
}

export async function getPrivateBalance(): Promise<PrivateBalanceResponse> {
  return apiRequest<PrivateBalanceResponse>(ROUTES.TRADING.PRIVATE_BALANCE, { method: 'GET' });
}

export async function getPortfolioHoldings(portfolioId: number): Promise<HoldingsResponse> {
  return apiRequest<HoldingsResponse>(ROUTES.TRADING.PORTFOLIO_HOLDINGS(portfolioId), { method: 'GET' });
}

export async function getPortfolioBalanceHistory(portfolioId: number): Promise<BalanceHistoryResponse> {
  return apiRequest<BalanceHistoryResponse>(ROUTES.TRADING.PORTFOLIO_BALANCE_HISTORY(portfolioId), { method: 'GET' });
}

export async function getProfileTransactions(idPersona: number, days = 365): Promise<ProfileTransactionsResponse> {
  const search = new URLSearchParams({ id_persona: String(idPersona), days: String(days) });
  return apiRequest<ProfileTransactionsResponse>(`${ROUTES.TRADING.PROFILE_TRANSACTIONS}?${search.toString()}`, { method: 'GET' });
}

export async function getMyWatchlist(): Promise<WatchlistResponse> {
  return apiRequest<WatchlistResponse>(ROUTES.TRADING.WATCHLIST, { method: 'GET' });
}

export async function updatePrivateBalance(payload: UpdatePrivateBalancePayload): Promise<UpdatePrivateBalanceResponse> {
  return apiRequest<UpdatePrivateBalanceResponse>(ROUTES.TRADING.PRIVATE_BALANCE, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function searchStocks(q: string, limit = 20): Promise<StockSearchResponse> {
  const query = new URLSearchParams({ q, limit: String(limit) });
  return apiRequest<StockSearchResponse>(`${ROUTES.TRADING.STOCKS_SEARCH}?${query.toString()}`, { method: 'GET' });
}

export async function cancelPendingOrder(idTransazione: number): Promise<{ message: string }> {
  return apiRequest<{ message: string }>(ROUTES.TRADING.ORDER_BY_ID(idTransazione), {
    method: 'DELETE',
  });
}

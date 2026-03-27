import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/context/AuthContext';
import Counter from '../../../shared/components/Counter';
import { HoldingsDonutPanel } from '../../../shared/components/HoldingsDonutPanel';
import { PortfolioPerformanceChart } from '../../../shared/components/PortfolioPerformanceChart';
import {
  BalanceHistoryPoint,
  cancelPendingOrder,
  getStocksCurrentPrices,
  HoldingItem,
  StockSearchItem,
  TransactionItem,
  WatchlistItem,
  getMyWatchlist,
  getPortfolioBalanceHistory,
  getPortfolioHoldings,
  getPrivateBalance,
  getProfileTransactions,
  searchStocks,
  updatePrivateBalance,
} from '../api/personalWorkspaceApi';

type WorkspaceTab = 'assets' | 'history' | 'watchlist';
type HistoryPeriodFilter = 'ALL' | '7D' | '30D' | '90D' | '365D';
type HistoryTypeFilter = 'ALL' | 'Buy' | 'Sell';
type HistoryStatusFilter = 'ALL' | 'Pending' | 'Executed';

function toCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function toNumber(value: string | null | undefined): number {
  if (!value) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function WorkspacePreviewSection() {
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('assets');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [personalPortfolioId, setPersonalPortfolioId] = useState<number | null>(null);
  const [cash, setCash] = useState(0);
  const [holdings, setHoldings] = useState<HoldingItem[]>([]);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [history, setHistory] = useState<BalanceHistoryPoint[]>([]);
  const [balanceAmount, setBalanceAmount] = useState('100.00');
  const [balanceMessage, setBalanceMessage] = useState<string | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [isFundsPanelOpen, setIsFundsPanelOpen] = useState(false);
  const [pendingBalanceAction, setPendingBalanceAction] = useState<'deposit' | 'withdraw' | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<StockSearchItem[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<number | null>(null);
  const [currentPrices, setCurrentPrices] = useState<Record<string, number>>({});
  const [historyPeriodFilter, setHistoryPeriodFilter] = useState<HistoryPeriodFilter>('ALL');
  const [historyTypeFilter, setHistoryTypeFilter] = useState<HistoryTypeFilter>('ALL');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<HistoryStatusFilter>('ALL');

  function pricesToMap(prices: Array<{ id_stock: string; prezzo_attuale: string | null }>): Record<string, number> {
    const out: Record<string, number> = {};
    for (const row of prices) {
      const value = Number(row.prezzo_attuale ?? 0);
      if (Number.isFinite(value) && value > 0) {
        out[row.id_stock] = value;
      }
    }
    return out;
  }

  async function refreshPrivateWorkspaceForTab(tab: WorkspaceTab) {
    const privateBalance = await getPrivateBalance(personalPortfolioId ?? undefined);
    const portfolioId = privateBalance.portfolio.id_portafoglio;

    setPersonalPortfolioId(portfolioId);
    setCash(toNumber(privateBalance.portfolio.liquidita));

    if (tab === 'assets') {
      const [holdingsRes, historyRes] = await Promise.all([
        getPortfolioHoldings(portfolioId),
        getPortfolioBalanceHistory(portfolioId),
      ]);
      const pricesRes = await getStocksCurrentPrices(holdingsRes.holdings.map((h) => h.id_stock));
      setHoldings(holdingsRes.holdings);
      setHistory(historyRes.history);
      setCurrentPrices(pricesToMap(pricesRes.prices));
      return;
    }

    if (tab === 'history') {
      if (!user) return;
      const txRes = await getProfileTransactions(user.id_persona, 365);
      setTransactions(txRes.transactions);
      return;
    }

    const watchlistRes = await getMyWatchlist();
    setWatchlist(watchlistRes.results);
  }

  function buildPersonalStockHref(stockId: string): string {
    const params = new URLSearchParams({ scope: 'personal' });
    if (personalPortfolioId) params.set('portfolioId', String(personalPortfolioId));
    return `/stocks/${stockId}?${params.toString()}`;
  }

  useEffect(() => {
    const isBlockingOverlayOpen = Boolean(isFundsPanelOpen || pendingBalanceAction);
    if (!isBlockingOverlayOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const blockedKeys = new Set([
      'ArrowUp',
      'ArrowDown',
      'ArrowLeft',
      'ArrowRight',
      'PageUp',
      'PageDown',
      'Home',
      'End',
      ' ',
    ]);

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isFundsPanelOpen) {
        setIsFundsPanelOpen(false);
        return;
      }

      if (blockedKeys.has(event.key)) {
        event.preventDefault();
      }
    };

    window.addEventListener('keydown', onKeyDown, { passive: false });

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isFundsPanelOpen, pendingBalanceAction]);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      setLoading(false);
      return;
    }

    let active = true;

    async function loadWorkspace() {
      setLoading(true);
      setError(null);

      try {
        const userId = user!.id_persona;
        const privateBalance = await getPrivateBalance();
        const portfolioId = privateBalance.portfolio.id_portafoglio;

        const [holdingsRes, historyRes, txRes, watchlistRes] = await Promise.all([
          getPortfolioHoldings(portfolioId),
          getPortfolioBalanceHistory(portfolioId),
          getProfileTransactions(userId, 365),
          getMyWatchlist(),
        ]);
        const pricesRes = await getStocksCurrentPrices(holdingsRes.holdings.map((h) => h.id_stock));

        if (!active) return;

        setPersonalPortfolioId(portfolioId);
        setCash(toNumber(privateBalance.portfolio.liquidita));
        setHoldings(holdingsRes.holdings);
        setCurrentPrices(pricesToMap(pricesRes.prices));
        setHistory(historyRes.history);
        setTransactions(txRes.transactions);
        setWatchlist(watchlistRes.results);
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : 'Impossibile caricare il workspace personale.');
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadWorkspace();

    return () => {
      active = false;
    };
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (!isAuthenticated || !user || !personalPortfolioId) return;

    let active = true;

    async function refreshOnTabChange() {
      try {
        await refreshPrivateWorkspaceForTab(activeTab);
      } catch {
        if (!active) return;
      }
    }

    void refreshOnTabChange();

    return () => {
      active = false;
    };
  }, [activeTab, isAuthenticated, personalPortfolioId, user]);

  useEffect(() => {
    if (!isAuthenticated || !user) return;

    const interval = setInterval(async () => {
      try {
        const txRes = await getProfileTransactions(user.id_persona, 365);
        setTransactions(txRes.transactions);
      } catch {
        // Ignoriamo errori transient per evitare rumore UI durante polling.
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [isAuthenticated, user]);

  const lastValue = history.length ? toNumber(history[history.length - 1].valore_totale) : 0;
  const previousValue = history.length > 1 ? toNumber(history[history.length - 2].valore_totale) : 0;
  const totalWealth = lastValue || cash;
  const delta = previousValue > 0 ? ((totalWealth - previousValue) / previousValue) * 100 : 0;
  const positiveDelta = delta >= 0;

  const filteredTransactions = useMemo(() => {
    const now = Date.now();

    return transactions.filter((tx) => {
      if (historyTypeFilter !== 'ALL' && tx.tipo !== historyTypeFilter) {
        return false;
      }

      if (historyStatusFilter !== 'ALL' && tx.stato !== historyStatusFilter) {
        return false;
      }

      if (historyPeriodFilter === 'ALL') {
        return true;
      }

      const days = historyPeriodFilter === '7D'
        ? 7
        : historyPeriodFilter === '30D'
          ? 30
          : historyPeriodFilter === '90D'
            ? 90
            : 365;

      const txTime = new Date(tx.created_at).getTime();
      if (!Number.isFinite(txTime)) {
        return false;
      }

      return now - txTime <= days * 24 * 60 * 60 * 1000;
    });
  }, [historyPeriodFilter, historyStatusFilter, historyTypeFilter, transactions]);

  useEffect(() => {
    const q = searchTerm.trim();

    if (!q) {
      setSearchResults([]);
      setSearchError(null);
      setSearchLoading(false);
      return;
    }

    let active = true;
    setSearchLoading(true);

    const timer = setTimeout(async () => {
      try {
        const result = await searchStocks(q, 25);
        if (!active) return;
        setSearchResults(result.results);
        setSearchError(null);
      } catch (err) {
        if (!active) return;
        setSearchError(err instanceof Error ? err.message : 'Errore ricerca titoli.');
        setSearchResults([]);
      } finally {
        if (active) setSearchLoading(false);
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [searchTerm]);

  function toggleFundsPanel() {
    setIsFundsPanelOpen((prev) => {
      if (prev) {
        setPendingBalanceAction(null);
        setBalanceMessage(null);
      }
      return !prev;
    });
  }

  function requestBalanceAction(type: 'deposit' | 'withdraw') {
    const parsed = Number(balanceAmount);

    if (!Number.isFinite(parsed) || parsed <= 0) {
      setBalanceMessage('Inserisci un importo valido maggiore di 0.');
      setPendingBalanceAction(null);
      return;
    }

    setBalanceMessage(null);
    setPendingBalanceAction(type);
  }

  async function handleBalanceUpdate(type: 'deposit' | 'withdraw') {
    const parsed = Number(balanceAmount);
    const actionLabel = type === 'deposit' ? 'deposito' : 'prelievo';

    if (!Number.isFinite(parsed) || parsed <= 0) {
      setBalanceMessage('Inserisci un importo valido maggiore di 0.');
      return;
    }

    const signed = type === 'withdraw' ? -parsed : parsed;

    setBalanceLoading(true);
    setBalanceMessage(null);
    setPendingBalanceAction(null);
    try {
      const response = await updatePrivateBalance({ delta_liquidita: signed.toFixed(2) });
      setCash(toNumber(response.portfolio.liquidita));
      setBalanceMessage(`Operazione confermata: ${actionLabel} di ${toCurrency(parsed)}. ${response.message}`);
      setIsFundsPanelOpen(false);
    } catch (err) {
      setBalanceMessage(err instanceof Error ? err.message : 'Operazione non riuscita.');
    } finally {
      setBalanceLoading(false);
    }
  }

  async function handleCancelPendingOrder(idTransazione: number) {
    setCancellingOrderId(idTransazione);
    setError(null);
    try {
      await cancelPendingOrder(idTransazione);
      setTransactions((prev) => prev.filter((tx) => tx.id_transazione !== idTransazione));
      const privateBalance = await getPrivateBalance();
      setCash(toNumber(privateBalance.portfolio.liquidita));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Impossibile annullare la transazione pending.');
    } finally {
      setCancellingOrderId(null);
    }
  }

  if (!isAuthenticated) return null;

  return (
    <section id="private-area" className="mx-auto w-full max-w-[1200px] space-y-8 px-6 py-8">
      <div className="flex items-center gap-4">
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#2a2a39] to-transparent" />
        <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-violet-300/80">Personal Workspace</span>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#2a2a39] to-transparent" />
      </div>

      <div className="rounded-2xl border border-[#1f1f2e] bg-[#13131a] p-5">
        <div className="relative">
          <span className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">search</span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search stocks, ETFs..."
            className="w-full rounded-xl border border-[#1f1f2e] bg-[#0f0f14] py-2.5 pl-10 pr-4 text-sm text-slate-100 outline-none transition-all placeholder:text-slate-500 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/30"
          />
        </div>

        {searchLoading ? <p className="mt-3 text-xs text-slate-400">Ricerca in corso...</p> : null}
        {searchError ? <p className="mt-3 text-xs text-rose-400">{searchError}</p> : null}

        {searchTerm.trim() && !searchLoading && !searchError ? (
          <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
            {searchResults.length === 0 ? (
              <p className="text-xs text-slate-400">Nessun titolo trovato.</p>
            ) : (
              searchResults.map((stock) => (
                <div
                  key={stock.id_stock}
                  onClick={() => navigate(buildPersonalStockHref(stock.id_stock), { state: { stock } })}
                  className="flex cursor-pointer items-center justify-between rounded-lg border border-[#232337] bg-[#0f0f14] px-3 py-2 transition-colors hover:bg-[#1a1a27]"
                >
                  <div>
                    <p className="text-sm font-bold text-slate-100">{stock.id_stock} - {stock.nome_societa}</p>
                    <p className="text-[10px] uppercase text-slate-500">{stock.settore}</p>
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-violet-300">Apri</span>
                </div>
              ))
            )}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1">
          <p className="text-sm font-medium uppercase tracking-wider text-slate-500">Cash Balance</p>
          <div className="flex items-baseline gap-3">
            <h2 className="flex items-center text-4xl font-bold tracking-tight text-slate-100 md:text-5xl">
              <span className="mr-1">$</span>
              <Counter
                value={cash}
                fontSize={44}
                padding={4}
                gap={1}
                textColor="rgb(241 245 249)"
                fontWeight={800}
                digitPlaceHolders
                gradientHeight={8}
                gradientFrom="rgba(17, 24, 39, 0.6)"
                gradientTo="transparent"
                counterStyle={{ paddingLeft: 0, paddingRight: 0 }}
              />
            </h2>
          </div>
          <div className="flex items-center gap-2 pt-2">
            <p className="text-sm text-slate-500">Total Wealth:</p>
            <p className="flex items-center text-sm font-bold text-slate-100">
              <span className="mr-0.5">$</span>
              <Counter
                value={totalWealth}
                fontSize={16}
                padding={2}
                gap={1}
                textColor="rgb(241 245 249)"
                fontWeight={700}
                digitPlaceHolders
                gradientHeight={4}
                gradientFrom="rgba(15, 15, 20, 0.8)"
                gradientTo="transparent"
                counterStyle={{ paddingLeft: 0, paddingRight: 0 }}
              />
            </p>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-sm font-semibold ${positiveDelta ? 'bg-violet-500/10 text-violet-400' : 'bg-rose-500/10 text-rose-400'}`}>
              <span className="material-symbols-outlined mr-1 text-sm">{positiveDelta ? 'trending_up' : 'trending_down'}</span>
              {positiveDelta ? '+' : ''}{delta.toFixed(2)}%
            </span>
          </div>
        </div>
        <div className="relative w-full md:w-auto">
          <div className="flex justify-start md:justify-end">
            <button
              onClick={toggleFundsPanel}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-5 text-sm font-semibold text-violet-200 transition-all duration-300 hover:bg-violet-500/20"
            >
              <span className="material-symbols-outlined text-base">account_balance_wallet</span>
              {isFundsPanelOpen ? 'Chiudi gestione fondi' : 'Gestisci fondi'}
            </button>
          </div>

          {typeof document !== 'undefined' ? createPortal(
            <AnimatePresence>
              {isFundsPanelOpen ? (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={() => setIsFundsPanelOpen(false)}
                  className="fixed inset-0 z-[180] flex items-start justify-center bg-black/50 px-5 pt-28"
                >
                  <motion.div
                    initial={{ opacity: 0, y: -14, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -14, scale: 0.98 }}
                    transition={{ duration: 0.28, ease: 'easeInOut' }}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full max-w-[560px] rounded-2xl border border-violet-500/25 bg-[#0f0f14] p-4 shadow-2xl shadow-black/40"
                  >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-violet-300/80">Wallet Actions</p>
                      <p className="text-sm text-slate-300">Imposta un importo e scegli se depositare o prelevare.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-violet-200">
                        Secure Confirm
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsFundsPanelOpen(false)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-200 transition-colors hover:bg-violet-500/20"
                        aria-label="Chiudi pannello fondi"
                      >
                        <span className="material-symbols-outlined text-lg leading-none">close</span>
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto_auto]">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={balanceAmount}
                      onChange={(e) => setBalanceAmount(e.target.value)}
                      className="h-11 w-full rounded-xl border border-[#1f1f2e] bg-[#13131a] px-3 text-sm text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/25"
                      placeholder="Importo"
                    />
                    <button
                      onClick={() => requestBalanceAction('deposit')}
                      disabled={balanceLoading}
                      className="h-11 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 text-sm font-semibold text-emerald-200 transition-all duration-300 hover:bg-emerald-500/20 disabled:opacity-70"
                    >
                      Deposit
                    </button>
                    <button
                      onClick={() => requestBalanceAction('withdraw')}
                      disabled={balanceLoading}
                      className="h-11 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 text-sm font-semibold text-amber-200 transition-all duration-300 hover:bg-amber-500/20 disabled:opacity-70"
                    >
                      Withdraw
                    </button>
                  </div>

                  {balanceMessage ? <p className="mt-3 text-xs text-slate-300">{balanceMessage}</p> : null}
                  </motion.div>
                </motion.div>
              ) : null}
            </AnimatePresence>,
            document.body,
          ) : null}
        </div>
      </div>

      {typeof document !== 'undefined' ? createPortal(
        <AnimatePresence>
          {pendingBalanceAction ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[190] flex items-center justify-center bg-black/70 px-5"
            >
              <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 24, scale: 0.96 }}
                transition={{ duration: 0.28, ease: 'easeInOut' }}
                className="w-full max-w-md rounded-2xl border border-violet-400/30 bg-[#111118] p-5 shadow-2xl shadow-violet-900/30"
              >
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-violet-300/80">Conferma operazione</p>
              <p className="mt-3 text-sm text-slate-200">
                Confermi di voler eseguire un
                <span className="font-bold"> {pendingBalanceAction === 'deposit' ? 'deposito' : 'prelievo'} </span>
                di <span className="font-bold text-violet-200">{toCurrency(Number(balanceAmount) || 0)}</span>?
              </p>
              <p className="mt-2 text-xs text-slate-400">Durante questa finestra tutte le altre azioni sono bloccate.</p>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => void handleBalanceUpdate(pendingBalanceAction)}
                  disabled={balanceLoading}
                  className="rounded-lg bg-violet-500 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white transition-all duration-300 hover:bg-violet-600 disabled:opacity-70"
                >
                  {balanceLoading ? 'Conferma in corso...' : 'Conferma'}
                </button>
                <button
                  onClick={() => setPendingBalanceAction(null)}
                  disabled={balanceLoading}
                  className="rounded-lg border border-[#2a2a39] bg-[#13131a] px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-200 transition-all duration-300 hover:bg-[#1b1b27] disabled:opacity-70"
                >
                  Annulla
                </button>
              </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>,
        document.body,
      ) : null}

      <PortfolioPerformanceChart history={history} title="Portfolio Performance" />

      <div className="space-y-4">
        <div className="inline-flex space-x-1 rounded-full border border-violet-500/25 bg-[#0d0d14] p-1">
          {[
            { id: 'assets' as WorkspaceTab, label: 'My Assets' },
            { id: 'history' as WorkspaceTab, label: 'Transaction History' },
            { id: 'watchlist' as WorkspaceTab, label: 'Watchlist' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`${activeTab === tab.id ? '' : 'text-slate-300 hover:text-slate-100'} relative rounded-full px-4 py-2 text-sm font-medium text-white outline-sky-400 transition focus-visible:outline-2`}
              style={{ WebkitTapHighlightColor: 'transparent' }}
            >
              {activeTab === tab.id ? (
                <motion.span
                  layoutId="workspace-tab-bubble"
                  className="absolute inset-0 z-10 bg-violet-500 shadow-lg shadow-violet-500/30"
                  style={{ borderRadius: 9999 }}
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                />
              ) : null}
              <span className="relative z-20">{tab.label}</span>
            </button>
          ))}
        </div>

        {loading ? <p className="text-sm text-slate-400">Caricamento dati workspace...</p> : null}
        {error ? <p className="text-sm text-rose-400">{error}</p> : null}

        {!loading && !error && activeTab === 'assets' ? (
          <HoldingsDonutPanel
            items={holdings}
            currentPrices={currentPrices}
            onSelect={(idStock) => navigate(buildPersonalStockHref(idStock))}
            emptyLabel="Nessuna azione in possesso."
          />
        ) : null}

        {!loading && !error && activeTab === 'history' ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-[#23243a] bg-[#11121c] p-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="inline-flex items-center gap-1 rounded-full border border-violet-500/20 bg-[#0c0d16] p-1">
                  {([
                    { id: 'ALL', label: 'All types' },
                    { id: 'Buy', label: 'Buy' },
                    { id: 'Sell', label: 'Sell' },
                  ] as const).map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setHistoryTypeFilter(option.id)}
                      className={`${historyTypeFilter === option.id ? '' : 'text-slate-300 hover:text-white'} relative rounded-full px-3 py-1.5 text-xs font-semibold transition`}
                    >
                      {historyTypeFilter === option.id ? (
                        <motion.span
                          layoutId="personal-history-type-bubble"
                          className="absolute inset-0 z-10 rounded-full bg-violet-500 shadow-lg shadow-violet-500/25"
                          transition={{ type: 'spring', bounce: 0.2, duration: 0.55 }}
                        />
                      ) : null}
                      <span className="relative z-20">{option.label}</span>
                    </button>
                  ))}
                </div>

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <label className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-400">
                    Period
                    <select
                      value={historyPeriodFilter}
                      onChange={(event) => setHistoryPeriodFilter(event.target.value as HistoryPeriodFilter)}
                      className="ml-2 rounded-lg border border-[#2a2c44] bg-[#17192a] px-2.5 py-1.5 text-xs font-semibold text-slate-100 outline-none focus:border-violet-500"
                    >
                      <option value="ALL">All time</option>
                      <option value="7D">Last 7 days</option>
                      <option value="30D">Last 30 days</option>
                      <option value="90D">Last 90 days</option>
                      <option value="365D">Last 365 days</option>
                    </select>
                  </label>

                  <label className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-400">
                    Status
                    <select
                      value={historyStatusFilter}
                      onChange={(event) => setHistoryStatusFilter(event.target.value as HistoryStatusFilter)}
                      className="ml-2 rounded-lg border border-[#2a2c44] bg-[#17192a] px-2.5 py-1.5 text-xs font-semibold text-slate-100 outline-none focus:border-violet-500"
                    >
                      <option value="ALL">All</option>
                      <option value="Pending">Pending</option>
                      <option value="Executed">Executed</option>
                    </select>
                  </label>
                </div>
              </div>

              <p className="mt-2 text-[11px] uppercase tracking-[0.13em] text-slate-500">
                Showing {filteredTransactions.length} of {transactions.length} transactions
              </p>
            </div>

            <div className="overflow-hidden rounded-xl border border-[#1f1f2e]">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#1f1f2e] bg-[#13131a] text-xs uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Ticker</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Quantity</th>
                    <th className="px-4 py-3 text-right">Total Value</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1f1f2e] bg-[#0f0f14]">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td className="px-4 py-4 text-slate-400" colSpan={7}>Nessuna transazione disponibile con i filtri selezionati.</td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx) => (
                      <tr key={tx.id_transazione} className="hover:bg-[#1f1f2e]/35">
                        <td className="px-4 py-3 text-slate-300">{new Date(tx.created_at).toLocaleString('it-IT')}</td>
                        <td className="px-4 py-3 font-semibold text-slate-100">{tx.id_stock}</td>
                        <td className={`px-4 py-3 font-semibold ${tx.tipo === 'Buy' ? 'text-violet-400' : 'text-rose-400'}`}>{tx.tipo}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${tx.stato === 'Executed' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
                            {tx.stato}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-300">{tx.quantita_azioni ? toNumber(tx.quantita_azioni).toFixed(6) : '--'}</td>
                        <td className="px-4 py-3 text-right font-mono text-slate-100">
                          {tx.stato === 'Executed'
                            ? toCurrency(tx.tipo === 'Buy'
                              ? toNumber(tx.importo_investito)
                              : toNumber(tx.quantita_azioni) * toNumber(tx.prezzo_esecuzione))
                            : (tx.tipo === 'Buy' ? toCurrency(toNumber(tx.importo_investito)) : '--')}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {tx.stato === 'Pending' ? (
                            <button
                              onClick={() => void handleCancelPendingOrder(tx.id_transazione)}
                              disabled={cancellingOrderId === tx.id_transazione}
                              className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1 text-xs font-bold uppercase text-rose-300 transition-colors hover:bg-rose-500/20 disabled:opacity-70"
                            >
                              {cancellingOrderId === tx.id_transazione ? 'Cancelling...' : 'Cancel'}
                            </button>
                          ) : (
                            <span className="text-xs text-slate-500">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          </div>
        ) : null}

        {!loading && !error && activeTab === 'watchlist' ? (
          <div className="grid grid-cols-1 gap-4">
            {watchlist.length === 0 ? <p className="text-sm text-slate-400">Watchlist vuota.</p> : null}
            {watchlist.map((row) => (
              <div
                key={row.id_stock}
                onClick={() => navigate(buildPersonalStockHref(row.id_stock), { state: { stock: row } })}
                className="flex cursor-pointer items-center justify-between rounded-xl border border-[#1f1f2e] bg-[#13131a] p-4 transition-colors hover:bg-[#1f1f2e]/40"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-lg bg-slate-100 text-sm font-bold text-[#0a0a0c]">{row.id_stock}</div>
                  <div>
                    <p className="text-sm font-bold text-slate-100">{row.nome_societa}</p>
                    <p className="text-[10px] uppercase text-slate-500">{row.settore}</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-violet-400">In Watchlist</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

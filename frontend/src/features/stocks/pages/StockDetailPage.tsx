import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  addToWatchlist,
  createOrder,
  findHoldingForSymbol,
  loadStockDetailBootstrap,
  type StockPageContext,
  removeFromWatchlist,
} from '../api/stockTradingApi';
import { TradingViewWidget } from '../components/TradingViewWidget';
import { Highlight } from '../../../shared/ui/Highlight';
import { gsap } from 'gsap';
import Counter from '../../../shared/components/Counter';

type TradeTab = 'buy' | 'sell';

interface StockRouteState {
  stock?: {
    id_stock: string;
    nome_societa: string;
    settore: string;
  };
  context?: StockPageContext;
}

function parseContextFromQuery(search: string): StockPageContext | undefined {
  const params = new URLSearchParams(search);
  const scope = params.get('scope');

  if (scope !== 'personal' && scope !== 'group') return undefined;

  const groupIdRaw = params.get('groupId');
  const portfolioIdRaw = params.get('portfolioId');

  const groupId = groupIdRaw !== null ? Number(groupIdRaw) : undefined;
  const portfolioId = portfolioIdRaw !== null ? Number(portfolioIdRaw) : undefined;

  const normalizedGroupId = Number.isFinite(groupId) ? groupId : undefined;
  const normalizedPortfolioId = Number.isFinite(portfolioId) ? portfolioId : undefined;

  if (scope === 'group' && !Number.isFinite(normalizedGroupId)) {
    return undefined;
  }

  return {
    scope,
    groupId: normalizedGroupId,
    portfolioId: normalizedPortfolioId,
  };
}

function toCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function toNumber(value: string | null | undefined): number {
  if (!value) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function StockDetailPage() {
  const { symbol = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = location.state as StockRouteState | null;
  const state = routeState?.stock;
  const pageContext = useMemo(
    () => parseContextFromQuery(location.search) ?? routeState?.context,
    [location.search, routeState?.context],
  );

  const stockSymbol = symbol.toUpperCase();
  const stockName = state?.nome_societa ?? stockSymbol;
  const stockSector = state?.settore ?? 'Unknown sector';

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);

  const [portfolioId, setPortfolioId] = useState<number | null>(null);
  const [cash, setCash] = useState(0);
  const [watchlisted, setWatchlisted] = useState(false);
  const [holdingQty, setHoldingQty] = useState(0);

  const [tradeTab, setTradeTab] = useState<TradeTab>('buy');
  const [buyAmount, setBuyAmount] = useState('100.00');
  const [sellQty, setSellQty] = useState('1');
  const [submitting, setSubmitting] = useState(false);
  const [pendingTradeConfirm, setPendingTradeConfirm] = useState<TradeTab | null>(null);
  const stockContainerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!pendingTradeConfirm) return;

    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previous;
    };
  }, [pendingTradeConfirm]);

  useEffect(() => {
    if (!stockSymbol) {
      navigate('/', { replace: true });
      return;
    }

    let active = true;

    async function bootstrap() {
      setLoading(true);
      setToast(null);

      try {
        const data = await loadStockDetailBootstrap(pageContext);
        if (!active) return;

        const holding = findHoldingForSymbol(data.holdings, stockSymbol);
        const isInWatchlist = data.watchlist.some((item) => item.id_stock.toUpperCase() === stockSymbol);

        setPortfolioId(data.portfolioId);
        setCash(data.cash);
        setHoldingQty(toNumber(holding?.numero));
        setWatchlisted(isInWatchlist);

        if (!holding || toNumber(holding.numero) <= 0) {
          setTradeTab('buy');
        }
      } catch (err) {
        if (!active) return;
        const message = err instanceof Error ? err.message : 'Impossibile caricare i dettagli del titolo.';
        setToast({ message, tone: 'error' });
      } finally {
        if (active) setLoading(false);
      }
    }

    void bootstrap();

    return () => {
      active = false;
    };
  }, [navigate, pageContext, stockSymbol]);

  useEffect(() => {
    const root = stockContainerRef.current;
    if (!root) return;

    if (loading) {
      root.classList.remove('social-glow-scope');
      return;
    }

    const targets = Array.from(
      root.querySelectorAll<HTMLElement>('button, .rounded-xl, .rounded-2xl, .violet-underlight, .stock-glow-card'),
    ).filter((el) => !el.classList.contains('stock-glow-ignore'));

    targets.forEach((el) => el.classList.add('social-glow-card'));

    const proximity = 220;
    const fadeDistance = 400;
    let rafId: number | null = null;
    let lastEvent: MouseEvent | null = null;

    const updateGlow = () => {
      if (!lastEvent) return;
      const mouseX = lastEvent.clientX;
      const mouseY = lastEvent.clientY;

      gsap.set(root, {
        '--spot-x': `${mouseX}px`,
        '--spot-y': `${mouseY}px`,
        '--spot-opacity': 1,
      });

      for (const el of targets) {
        const rect = el.getBoundingClientRect();
        const dx = Math.max(rect.left - mouseX, 0, mouseX - rect.right);
        const dy = Math.max(rect.top - mouseY, 0, mouseY - rect.bottom);
        const distance = Math.hypot(dx, dy);

        let intensity = 0;
        if (distance <= proximity) {
          intensity = 1;
        } else if (distance <= fadeDistance) {
          intensity = (fadeDistance - distance) / (fadeDistance - proximity);
        }

        const relativeX = ((mouseX - rect.left) / rect.width) * 100;
        const relativeY = ((mouseY - rect.top) / rect.height) * 100;

        gsap.set(el, {
          '--glow-intensity': Number(intensity.toFixed(3)),
          '--glow-x': `${Math.max(0, Math.min(100, relativeX))}%`,
          '--glow-y': `${Math.max(0, Math.min(100, relativeY))}%`,
        });
      }

      rafId = null;
    };

    const onMouseMove = (event: MouseEvent) => {
      lastEvent = event;
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(updateGlow);
    };

    const onMouseLeave = () => {
      targets.forEach((el) => {
        gsap.to(el, {
          '--glow-intensity': 0,
          duration: 0.25,
          ease: 'power2.out',
        });
      });
      gsap.to(root, {
        '--spot-opacity': 0,
        duration: 0.3,
        ease: 'power2.out',
      });
    };

    root.classList.add('social-glow-scope');
    root.addEventListener('mousemove', onMouseMove);
    root.addEventListener('mouseleave', onMouseLeave);

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      root.removeEventListener('mousemove', onMouseMove);
      root.removeEventListener('mouseleave', onMouseLeave);
      targets.forEach((el) => el.classList.remove('social-glow-card'));
      root.classList.remove('social-glow-scope');
    };
  }, [loading]);

  const canSell = holdingQty > 0;

  const estimatedShares = useMemo(() => {
    const amount = Number(buyAmount);
    if (!Number.isFinite(amount) || amount <= 0) return 0;
    // Stima indicativa lato client in assenza quote realtime backend.
    return amount / 100;
  }, [buyAmount]);

  async function refreshSnapshot() {
    const data = await loadStockDetailBootstrap(pageContext);
    const holding = findHoldingForSymbol(data.holdings, stockSymbol);
    const isInWatchlist = data.watchlist.some((item) => item.id_stock.toUpperCase() === stockSymbol);

    setPortfolioId(data.portfolioId);
    setCash(data.cash);
    setHoldingQty(toNumber(holding?.numero));
    setWatchlisted(isInWatchlist);
  }

  async function handleToggleWatchlist() {
    setToast(null);
    try {
      if (watchlisted) {
        await removeFromWatchlist(stockSymbol);
        setWatchlisted(false);
        setToast({ message: 'Titolo rimosso dalla watchlist.', tone: 'success' });
      } else {
        await addToWatchlist(stockSymbol);
        setWatchlisted(true);
        setToast({ message: 'Titolo aggiunto alla watchlist.', tone: 'success' });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Operazione watchlist non riuscita.';
      setToast({ message, tone: 'error' });
    }
  }

  function validateBuyBeforeConfirm(): boolean {
    const amount = Number(buyAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setToast({ message: 'Inserisci un importo buy valido.', tone: 'error' });
      return false;
    }

    if (amount > cash) {
      setToast({ message: 'Budget insufficiente per questo acquisto.', tone: 'error' });
      return false;
    }

    return true;
  }

  async function handleConfirmBuy() {
    if (!portfolioId) return;

    const amount = Number(buyAmount);
    setSubmitting(true);
    setToast(null);

    try {
      await createOrder({
        id_portafoglio: portfolioId,
        id_stock: stockSymbol,
        tipo: 'Buy',
        importo_investito: amount.toFixed(2),
      });

      setPendingTradeConfirm(null);
      setToast({ message: 'Ordine di acquisto inviato con successo.', tone: 'success' });
      await refreshSnapshot();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossibile inviare l\'ordine di acquisto.';
      setToast({ message, tone: 'error' });
    } finally {
      setSubmitting(false);
    }
  }

  function validateSellBeforeConfirm(): boolean {
    const quantity = Number(sellQty);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      setToast({ message: 'Inserisci una quantita valida da vendere.', tone: 'error' });
      return false;
    }

    if (quantity > holdingQty) {
      setToast({ message: 'Non possiedi abbastanza azioni per questa vendita.', tone: 'error' });
      return false;
    }

    return true;
  }

  async function handleConfirmSell() {
    if (!portfolioId) return;

    const quantity = Number(sellQty);

    setSubmitting(true);
    setToast(null);

    try {
      await createOrder({
        id_portafoglio: portfolioId,
        id_stock: stockSymbol,
        tipo: 'Sell',
        quantita_azioni: quantity.toFixed(6),
      });

      setPendingTradeConfirm(null);
      setToast({ message: 'Ordine di vendita inviato con successo.', tone: 'success' });
      await refreshSnapshot();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossibile inviare l\'ordine di vendita.';
      setToast({ message, tone: 'error' });
    } finally {
      setSubmitting(false);
    }
  }

  function handleSellAll() {
    setSellQty(holdingQty.toFixed(6));
  }

  if (loading) {
    return (
      <section ref={stockContainerRef} className="mx-auto max-w-[1440px] px-6 py-10 text-slate-300">
        Caricamento dettaglio titolo...
      </section>
    );
  }

  return (
    <section ref={stockContainerRef} className="mx-auto max-w-[1440px] px-6 py-8 text-slate-100">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <button
          onClick={() => navigate(-1)}
          aria-label="Torna indietro"
          className="stock-glow-ignore inline-flex w-fit items-center gap-1 text-violet-300 transition-all hover:-translate-x-1 hover:text-violet-200"
        >
          <span className="material-symbols-outlined text-2xl">arrow_back</span>
        </button>

        <Highlight trigger={cash} duration={550} className="group stock-glow-card rounded-2xl border border-violet-500/25 bg-gradient-to-r from-violet-500/15 via-[#1a1126] to-transparent px-5 py-3 shadow-[0_0_28px_rgba(139,92,246,0.16)]">
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-violet-300/80">Budget disponibile</p>
          <div className="text-2xl font-black text-white transition-colors duration-300 group-data-[highlight=on]:text-violet-200 md:text-3xl">
            <Counter
              value={cash}
              fontSize={32}
              padding={2}
              gap={1}
              textColor="rgb(255 255 255)"
              fontWeight={800}
              digitPlaceHolders
              gradientHeight={6}
              gradientFrom="rgba(17, 24, 39, 0.55)"
              gradientTo="transparent"
              counterStyle={{ paddingLeft: 0, paddingRight: 0 }}
            />
          </div>
        </Highlight>
      </div>

      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="flex-1 space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl border border-white/10 bg-[#0f0f1a] text-xl font-bold">
                {stockSymbol.slice(0, 4)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-3xl font-bold">{stockSymbol}</h2>
                  <button
                    onClick={() => void handleToggleWatchlist()}
                    className="inline-flex items-center justify-center"
                    aria-label="Toggle watchlist"
                  >
                    <motion.span
                      className="material-symbols-outlined text-2xl text-yellow-400"
                      style={{ fontVariationSettings: `'FILL' ${watchlisted ? 1 : 0}` }}
                      animate={{ scale: watchlisted ? [1, 1.16, 1] : [1, 0.88, 1], rotate: watchlisted ? [0, 8, 0] : [0, -8, 0] }}
                      transition={{ duration: 0.28, ease: 'easeInOut' }}
                    >
                      star
                    </motion.span>
                  </button>
                </div>
                <p className="text-sm text-slate-400">{stockName} • {stockSector}</p>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-sm text-slate-400">Posizione attuale</p>
              <p className="text-xl font-bold">{holdingQty.toFixed(6)} shares</p>
            </div>
          </div>

          <div className="violet-underlight">
            <TradingViewWidget symbol={stockSymbol} />
          </div>
        </div>

        <div className="w-full shrink-0 lg:w-[380px]">
          <div className="sticky top-24 overflow-hidden rounded-2xl border border-white/10 bg-[#0f0f1a] shadow-2xl shadow-violet-500/10 stock-glow-card">
            <div className="border-b border-white/10 px-4 py-3">
              <div className="inline-flex space-x-1 rounded-full border border-violet-500/25 bg-[#0d0d14] p-1">
                {[
                  { id: 'buy' as TradeTab, label: `Buy ${stockSymbol}` },
                  ...(canSell ? [{ id: 'sell' as TradeTab, label: `Sell ${stockSymbol}` }] : []),
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setTradeTab(tab.id)}
                    className={`${tradeTab === tab.id ? '' : 'text-slate-300 hover:text-slate-100'} relative rounded-full px-4 py-2 text-sm font-medium text-white outline-sky-400 transition-all duration-300 focus-visible:outline-2`}
                    style={{ WebkitTapHighlightColor: 'transparent' }}
                  >
                    {tradeTab === tab.id ? (
                      <motion.span
                        layoutId="stock-tab-bubble"
                        className="absolute inset-0 z-10 bg-violet-500 shadow-lg shadow-violet-500/30"
                        style={{ borderRadius: 9999 }}
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                      />
                    ) : null}
                    <span className="relative z-20">{tab.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-6 p-6">
              {tradeTab === 'buy' ? (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Amount to Spend (USD)</label>
                      <button onClick={() => setBuyAmount(cash.toFixed(2))} className="text-xs font-bold text-violet-300 hover:underline">Use Max</button>
                    </div>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-violet-300">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={buyAmount}
                        onChange={(e) => setBuyAmount(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-white/5 py-4 pl-8 pr-4 text-xl font-bold text-white outline-none focus:ring-2 focus:ring-violet-500/40"
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Estimated Shares</span>
                      <span className="font-bold text-white">{estimatedShares.toFixed(6)}</span>
                    </div>
                    <div className="mt-2 flex items-center justify-between border-t border-white/10 pt-2 text-sm">
                      <span className="text-slate-400">Order Fee</span>
                      <span className="font-bold text-white">$0.00</span>
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      if (validateBuyBeforeConfirm()) {
                        setToast(null);
                        setPendingTradeConfirm('buy');
                      }
                    }}
                    disabled={submitting}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500 py-4 text-lg font-bold text-white shadow-lg shadow-violet-500/20 transition-all duration-300 hover:bg-violet-600 disabled:opacity-70"
                  >
                    Confirm Buy
                  </button>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Shares to Sell</label>
                      <button onClick={handleSellAll} className="text-xs font-bold text-violet-300 hover:underline">Sell all</button>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="0.000001"
                      value={sellQty}
                      onChange={(e) => setSellQty(e.target.value)}
                      className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-xl font-bold text-white outline-none focus:ring-2 focus:ring-violet-500/40"
                    />
                    <p className="text-xs text-slate-400">Disponibili: {holdingQty.toFixed(6)} shares</p>
                  </div>

                  <button
                    onClick={() => {
                      if (validateSellBeforeConfirm()) {
                        setToast(null);
                        setPendingTradeConfirm('sell');
                      }
                    }}
                    disabled={submitting}
                    className="w-full rounded-xl bg-violet-500 py-4 text-lg font-bold text-white shadow-lg shadow-violet-500/20 transition-all duration-300 hover:bg-violet-600 disabled:opacity-70"
                  >
                    Confirm Sell
                  </button>
                </>
              )}

              <div className="text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Available to trade</p>
                <p className="text-sm font-bold text-slate-200">{toCurrency(cash)} USD</p>
              </div>
            </div>

            <div className="border-t border-white/10 bg-white/5 px-6 py-4">
              <div className="flex items-center justify-center gap-2 text-xs font-medium text-slate-400">
                <span className="material-symbols-outlined text-sm text-violet-300">verified_user</span>
                Secured & Encrypted Execution
              </div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {toast ? (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
            className={`fixed bottom-4 right-4 z-[120] w-[min(520px,90vw)] rounded-xl border px-4 py-3 shadow-[0_12px_30px_rgba(0,0,0,0.45)] backdrop-blur ${toast.tone === 'success' ? 'border-violet-500/35 bg-[#141529]/95 text-violet-100' : 'border-rose-500/35 bg-[#26131b]/95 text-rose-100'}`}
          >
            <div className="flex items-start gap-3">
              <span className={`material-symbols-outlined mt-0.5 ${toast.tone === 'success' ? 'text-violet-300' : 'text-rose-300'}`}>{toast.tone === 'success' ? 'check_circle' : 'error'}</span>
              <p className="flex-1 text-sm">{toast.message}</p>
              <button
                onClick={() => setToast(null)}
                className="grid h-6 w-6 place-items-center rounded-full border border-white/20 bg-white/10"
                aria-label="Chiudi notifica"
              >
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {pendingTradeConfirm ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[96] flex items-center justify-center bg-black/70 px-5"
          >
            <motion.div
              initial={{ opacity: 0, y: 28, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              transition={{ duration: 0.28, ease: 'easeInOut' }}
              className="w-full max-w-md rounded-2xl border border-violet-400/30 bg-[#111118] p-5 shadow-2xl shadow-violet-900/30"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-violet-300/80">Conferma ordine</p>
              <p className="mt-3 text-sm text-slate-200">
                {pendingTradeConfirm === 'buy'
                  ? `Confermi l'acquisto di ${toCurrency(Number(buyAmount) || 0)} di ${stockSymbol}?`
                  : `Confermi la vendita di ${Number(sellQty).toFixed(6)} shares di ${stockSymbol}?`}
              </p>
              <p className="mt-2 text-xs text-slate-400">Le altre interazioni sono temporaneamente bloccate.</p>
              <div className="mt-5 flex flex-wrap items-center gap-2">
                <button
                  onClick={() => void (pendingTradeConfirm === 'buy' ? handleConfirmBuy() : handleConfirmSell())}
                  disabled={submitting}
                  className="rounded-lg bg-violet-500 px-4 py-2 text-xs font-bold uppercase tracking-wide text-white transition-all duration-300 hover:bg-violet-600 disabled:opacity-70"
                >
                  {submitting ? 'Conferma in corso...' : pendingTradeConfirm === 'buy' ? 'Conferma Buy' : 'Conferma Sell'}
                </button>
                <button
                  onClick={() => setPendingTradeConfirm(null)}
                  disabled={submitting}
                  className="rounded-lg border border-[#2a2a39] bg-[#13131a] px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-200 transition-all duration-300 hover:bg-[#1b1b27] disabled:opacity-70"
                >
                  Annulla
                </button>
              </div>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

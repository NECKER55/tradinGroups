import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PortfolioPerformanceChart } from '../../../shared/components/PortfolioPerformanceChart';
import { HoldingsDonutPanel } from '../../../shared/components/HoldingsDonutPanel';

type MockTab = 'assets' | 'history' | 'watchlist';

const mockHistory = [
  { data: '2026-03-25', valore_totale: '10120.24' },
  { data: '2026-03-26', valore_totale: '10340.17' },
  { data: '2026-03-27', valore_totale: '10492.81' },
  { data: '2026-03-28', valore_totale: '10721.66' },
  { data: '2026-03-29', valore_totale: '10905.90' },
  { data: '2026-03-30', valore_totale: '11188.55' },
  { data: '2026-03-31', valore_totale: '11432.21' },
];

const mockHoldings = [
  { id_stock: 'NVDA', nome_societa: 'NVIDIA Corporation', numero: '12.000000', prezzo_medio_acquisto: '882.15' },
  { id_stock: 'AAPL', nome_societa: 'Apple Inc.', numero: '25.000000', prezzo_medio_acquisto: '191.10' },
  { id_stock: 'MSFT', nome_societa: 'Microsoft Corporation', numero: '10.000000', prezzo_medio_acquisto: '412.50' },
];

const mockPrices = {
  NVDA: 934.2,
  AAPL: 203.75,
  MSFT: 425.1,
};

const mockTransactions = [
  { id: 421, date: '31/03/2026 14:10:00', stock: 'NVDA', type: 'Buy', status: 'Executed', qty: '2.000000', total: '$1,856.40' },
  { id: 417, date: '30/03/2026 09:25:31', stock: 'AAPL', type: 'Sell', status: 'Executed', qty: '4.000000', total: '$815.00' },
  { id: 411, date: '29/03/2026 18:02:14', stock: 'MSFT', type: 'Buy', status: 'Pending', qty: '--', total: '$1,200.00' },
];

const mockWatchlist = [
  { id_stock: 'TSLA', nome_societa: 'Tesla Inc.', settore: 'Automotive' },
  { id_stock: 'AMZN', nome_societa: 'Amazon.com, Inc.', settore: 'Consumer' },
  { id_stock: 'META', nome_societa: 'Meta Platforms, Inc.', settore: 'Communication' },
];

export function TutorialMockGroupPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<MockTab>('assets');

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const active = window.localStorage.getItem('tradingiq_tutorial_active') === '1';
    if (!active) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  return (
    <section className="mx-auto w-full max-w-[1250px] space-y-8 px-6 py-8 text-slate-100">
      <div className="flex items-center justify-between gap-4">
        <Link
          to="/social"
          className="inline-flex items-center gap-1 text-violet-300 transition-all hover:-translate-x-1 hover:text-violet-200"
        >
          <span className="material-symbols-outlined text-2xl">arrow_back</span>
        </Link>
        <div className="flex items-center gap-4">
          <div className="h-px w-16 bg-gradient-to-r from-transparent via-[#2a2a39] to-transparent" />
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-violet-300/80">Group Tutorial Preview</span>
          <div className="h-px w-16 bg-gradient-to-r from-transparent via-[#2a2a39] to-transparent" />
        </div>
        <div className="w-12" />
      </div>

      <section data-tutorial-id="mock-group-ranking" className="rounded-2xl border border-[#1f1f2e] bg-[#13131a] p-5">
        <h2 className="text-lg font-bold text-slate-100">Group competition and ranking</h2>
        <p className="mt-1 text-xs text-slate-400">Each group has its own competitive ranking: members are ordered by total portfolio value in that group.</p>
        <div className="mt-4 overflow-hidden rounded-xl border border-[#232337]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#171726] text-slate-300">
              <tr>
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['01', 'alpha_quant', 'Owner', '$12,442.22'],
                ['02', 'market_hawk', 'Admin', '$12,110.40'],
                ['03', 'you', 'User', '$11,432.21'],
              ].map((row) => (
                <tr key={row[1]} className="border-t border-[#232337] bg-white/[0.02]">
                  <td className="px-4 py-3">{row[0]}</td>
                  <td className="px-4 py-3 font-semibold text-slate-100">{row[1]}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full border border-violet-400/35 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-200">
                      {row[2]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-slate-100">{row[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section data-tutorial-id="mock-group-personal-area" className="space-y-6 rounded-2xl border border-[#1f1f2e] bg-[#13131a] p-5">
        <div className="flex items-center gap-4">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#2a2a39] to-transparent" />
          <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-violet-300/80">Group Portfolio Workspace</span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#2a2a39] to-transparent" />
        </div>

        <div data-tutorial-id="mock-group-search-bar" className="relative overflow-hidden rounded-2xl border border-[#232337] bg-[#11131f]/88 p-5 shadow-[0_18px_40px_rgba(0,0,0,0.38)] backdrop-blur-sm">
          <div className="pointer-events-none absolute -left-12 -top-16 h-40 w-40 rounded-full bg-violet-500/14 blur-3xl" />
          <div className="pointer-events-none absolute -right-16 -bottom-16 h-44 w-44 rounded-full bg-fuchsia-500/10 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 rounded-2xl bg-[radial-gradient(120%_80%_at_10%_0%,rgba(139,92,246,0.16),transparent_58%)]" />
          <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-400/45 to-transparent" />

          <div className="relative mb-4 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-violet-300/80">Quick stock search</p>
            <h3 className="mt-1 text-lg font-bold text-slate-100">Type a ticker or company name</h3>
            <p className="mt-1 text-xs text-slate-400">Use this search bar to open stock details inside the group workspace.</p>
          </div>

          <div className="relative rounded-2xl border border-[#232337] bg-[#0f0f14]/85 px-3 py-2">
            <span className="material-symbols-outlined pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xl text-slate-400">search</span>
            <input
              type="text"
              readOnly
              value="NVDA"
              className="w-full rounded-2xl bg-transparent py-3.5 pl-9 pr-20 text-base text-slate-100 outline-none"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg border border-violet-500/30 bg-violet-500/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-violet-200">
              Open
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className="text-sm font-medium uppercase tracking-wider text-slate-500">Cash Balance</p>
            <h2 className="text-4xl font-black tracking-tight text-slate-100 md:text-5xl">$8,440.25</h2>
            <p className="flex items-center gap-2 text-sm text-slate-300">
              Total Wealth: <span className="font-bold text-slate-100">$11,432.21</span>
              <span className="inline-flex items-center rounded-full bg-violet-500/10 px-2 py-0.5 text-sm font-semibold text-violet-400">+1.82%</span>
            </p>
          </div>
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-violet-500/30 bg-violet-500/10 px-5 text-sm font-semibold text-violet-200">
            <span className="material-symbols-outlined text-base">account_balance_wallet</span>
            Manage group budget
          </button>
        </div>

        <div data-tutorial-id="mock-group-portfolio-chart" className="rounded-2xl border border-[#232337] bg-[#0f1018] p-3">
          <PortfolioPerformanceChart history={mockHistory} title="Group Portfolio Performance" accentClassName="text-slate-100" />
        </div>

        <div className="space-y-4">
          <div className="inline-flex space-x-1 rounded-full border border-violet-500/25 bg-[#0d0d14] p-1">
            <button
              data-tutorial-id="mock-group-tab-assets"
              onClick={() => setActiveTab('assets')}
              className={`${activeTab === 'assets' ? 'bg-violet-500 text-white' : 'text-slate-300 hover:text-slate-100'} rounded-full px-4 py-2 text-sm font-medium transition`}
            >
              My Assets
            </button>
            <button
              data-tutorial-id="mock-group-tab-history"
              onClick={() => setActiveTab('history')}
              className={`${activeTab === 'history' ? 'bg-violet-500 text-white' : 'text-slate-300 hover:text-slate-100'} rounded-full px-4 py-2 text-sm font-medium transition`}
            >
              Transaction History
            </button>
            <button
              data-tutorial-id="mock-group-tab-watchlist"
              onClick={() => setActiveTab('watchlist')}
              className={`${activeTab === 'watchlist' ? 'bg-violet-500 text-white' : 'text-slate-300 hover:text-slate-100'} rounded-full px-4 py-2 text-sm font-medium transition`}
            >
              Watchlist
            </button>
          </div>

          {activeTab === 'assets' ? (
            <div className="rounded-xl border border-[#232337] bg-[#11121c] p-3">
              <HoldingsDonutPanel
                items={mockHoldings}
                currentPrices={mockPrices}
                onSelect={() => {}}
                emptyLabel="No holdings in this portfolio."
              />
            </div>
          ) : null}

          {activeTab === 'history' ? (
            <div className="overflow-hidden rounded-xl border border-[#1f1f2e] bg-[#0f0f14]">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[#1f1f2e] bg-[#13131a] text-xs uppercase tracking-wider text-slate-500">
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Ticker</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Quantity</th>
                    <th className="px-4 py-3 text-right">Total Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1f1f2e]">
                  {mockTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-[#1f1f2e]/35">
                      <td className="px-4 py-3 text-slate-300">{tx.date}</td>
                      <td className="px-4 py-3 font-semibold text-slate-100">{tx.stock}</td>
                      <td className={`px-4 py-3 font-semibold ${tx.type === 'Buy' ? 'text-violet-400' : 'text-rose-400'}`}>{tx.type}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase ${tx.status === 'Executed' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-amber-500/15 text-amber-300'}`}>
                          {tx.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-300">{tx.qty}</td>
                      <td className="px-4 py-3 text-right font-mono text-slate-100">{tx.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {activeTab === 'watchlist' ? (
            <div className="grid grid-cols-1 gap-3">
              {mockWatchlist.map((row) => (
                <div
                  key={row.id_stock}
                  className="flex items-center justify-between rounded-xl border border-[#1f1f2e] bg-[#13131a] p-4"
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
    </section>
  );
}

import { useAuth } from '../../auth/context/AuthContext';

const transactions = [
  { asset: 'BTC/USDT', type: 'Long Position', amount: '$45,200.00', performance: '+8.4%', positive: true },
  { asset: 'ETH/USDT', type: 'Short Position', amount: '$12,450.00', performance: '-2.1%', positive: false },
  { asset: 'TSLA', type: 'Equity Trade', amount: '$5,000.00', performance: '+14.2%', positive: true },
];

export function WorkspacePreviewSection() {
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) return null;

  return (
    <section className="mx-auto max-w-7xl border-t border-canvas/10 px-6 py-20">
      <div className="mb-10 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-black">Personal Workspace</h2>
          <p className="text-sm text-canvas/50">Your private portfolio performance and recent activity.</p>
        </div>
        <button className="flex items-center gap-2 rounded-xl border border-canvas/15 bg-canvas/5 px-6 py-2.5 text-sm font-bold transition-all hover:bg-canvas/10">
          <span className="material-symbols-outlined text-sm">settings</span>
          Configure
        </button>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        <article className="relative overflow-hidden rounded-[2rem] border border-canvas/15 bg-ink/70 p-8">
          <div className="absolute right-0 top-0 h-32 w-32 -translate-y-1/2 translate-x-1/2 rounded-full bg-signal/25 blur-[60px]" />
          <span className="mb-2 block text-xs font-bold uppercase tracking-widest text-canvas/50">Total Balance</span>
          <h3 className="mb-4 text-4xl font-black">$1,245,892.00</h3>
          <div className="mb-8 flex items-center gap-2">
            <span className="flex items-center text-sm font-bold text-gain">
              <span className="material-symbols-outlined mr-1 text-sm">trending_up</span>
              +12.5%
            </span>
            <span className="text-[10px] font-bold uppercase text-canvas/45">vs last month</span>
          </div>
          <div className="mt-auto flex gap-2">
            <button className="flex-1 rounded-xl bg-signal py-3 text-xs font-bold text-obsidian transition-all hover:scale-[1.02]">Deposit</button>
            <button className="flex-1 rounded-xl border border-canvas/15 bg-canvas/5 py-3 text-xs font-bold text-canvas transition-all hover:bg-canvas/10">Withdraw</button>
          </div>
        </article>

        <article className="rounded-[2rem] border border-canvas/15 bg-ink/70 p-8 lg:col-span-2">
          <div className="mb-8 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-canvas/50">Net Worth Growth</span>
            <div className="flex gap-4 text-[10px] font-black uppercase tracking-widest">
              <button className="text-signal">1D</button>
              <button className="text-canvas/45">1W</button>
              <button className="text-canvas/45">1M</button>
            </div>
          </div>

          <div className="mb-6 flex h-40 items-end gap-1">
            {[40, 55, 45, 70, 65, 85, 95, 80, 100].map((value, index) => (
              <div
                key={`${value}-${index}`}
                style={{ height: `${value}%` }}
                className={`flex-1 rounded-t-lg ${index > 5 ? 'bg-signal/70' : 'bg-canvas/10'} ${index === 8 ? 'shadow-[0_0_20px_rgba(246,173,85,0.3)]' : ''}`}
              />
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {[
              ['Assets', '12 Active'],
              ['Trades', '1,042 Total'],
              ['Win Rate', '68.4%'],
              ['Level', 'Platinum III'],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-canvas/10 bg-canvas/5 p-3">
                <p className="mb-1 text-[10px] font-bold uppercase text-canvas/45">{label}</p>
                <p className="text-sm font-bold">{value}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="overflow-hidden rounded-[2rem] border border-canvas/15 bg-ink/40 lg:col-span-3">
          <div className="flex items-center justify-between border-b border-canvas/10 p-6">
            <h3 className="text-sm font-bold">Recent Transactions</h3>
            <button className="text-[10px] font-bold uppercase text-signal">View All History</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-canvas/10 text-[10px] font-bold uppercase text-canvas/45">
                  <th className="px-6 py-4">Asset</th>
                  <th className="px-6 py-4">Type</th>
                  <th className="px-6 py-4">Amount</th>
                  <th className="px-6 py-4 text-right">Performance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-canvas/10">
                {transactions.map((row) => (
                  <tr key={row.asset} className="text-sm transition-colors hover:bg-canvas/5">
                    <td className="px-6 py-4 font-bold">{row.asset}</td>
                    <td className="px-6 py-4 text-canvas/60">{row.type}</td>
                    <td className="px-6 py-4 font-mono text-xs">{row.amount}</td>
                    <td className={`px-6 py-4 text-right font-bold ${row.positive ? 'text-gain' : 'text-loss'}`}>{row.performance}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>
  );
}

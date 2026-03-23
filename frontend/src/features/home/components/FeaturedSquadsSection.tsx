const squads = [
  {
    rank: 'Rank #1 Global',
    name: 'Wall Street Wolves',
    topA: { name: 'Alex_Quant', roi: '+42.1%' },
    topB: { name: 'Sarah_Alpha', roi: '+38.4%' },
    roi: '+24.5%',
  },
  {
    rank: 'Rank #2 Global',
    name: 'Crypto Titans',
    topA: { name: 'Leo_ETH', roi: '+35.2%' },
    topB: { name: 'Elena_Luna', roi: '+29.8%' },
    roi: '+18.2%',
  },
];

const leaders = [
  { rank: '01', name: 'Matrix_Reborn', profit: '+$284k Profit', gain: '+124%' },
  { rank: '02', name: 'Cyber_Queen', profit: '+$192k Profit', gain: '+98%' },
  { rank: '03', name: 'Quant_Hawk', profit: '+$171k Profit', gain: '+84%' },
];

export function FeaturedSquadsSection() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-8">
      <div className="grid gap-10 lg:grid-cols-12">
        <div className="flex flex-col gap-8 lg:col-span-8">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-3 text-2xl font-bold">
              <span className="material-symbols-outlined text-signal">groups</span>
              Featured Squads
            </h2>
            <a href="#" className="text-sm font-semibold text-signal hover:underline">View all groups</a>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {squads.map((squad) => (
              <article key={squad.name} className="neo-card group flex flex-col gap-5 rounded-2xl p-6 transition-all">
                <div className="flex items-start justify-between">
                  <div className="flex flex-col">
                    <span className="mb-1 text-[10px] font-bold uppercase tracking-[0.25em] text-signal">{squad.rank}</span>
                    <h3 className="text-xl font-bold transition-colors group-hover:text-signal">{squad.name}</h3>
                  </div>
                  <div className="grid h-12 w-12 place-items-center rounded-lg border border-canvas/10 bg-canvas/10">
                    <span className="material-symbols-outlined text-canvas/80">shield</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-xs font-bold uppercase tracking-tight text-canvas/40">Top Traders</p>
                  <div className="flex flex-col gap-2 text-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2"><span className="font-mono text-xs text-canvas/45">01</span>{squad.topA.name}</div>
                      <span className="font-bold text-gain">{squad.topA.roi}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2"><span className="font-mono text-xs text-canvas/45">02</span>{squad.topB.name}</div>
                      <span className="font-bold text-gain">{squad.topB.roi}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-canvas/10 pt-4">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-canvas/45">Squad ROI</span>
                    <p className="glow-signal text-2xl font-black text-signal">{squad.roi}</p>
                  </div>
                  <button className="rounded-lg bg-signal px-4 py-2 text-xs font-bold uppercase text-obsidian transition-all hover:bg-signal/85">
                    Join Challenge
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>

        <aside className="lg:col-span-4">
          <div className="overflow-hidden rounded-2xl border border-canvas/15 bg-ink/80 shadow-2xl">
            <div className="flex items-center justify-between border-b border-canvas/10 p-6">
              <h3 className="flex items-center gap-2 text-sm font-bold text-canvas">
                <span className="material-symbols-outlined text-xl text-signal">emoji_events</span>
                Global Leaders
              </h3>
              <span className="rounded bg-signal/20 px-2 py-0.5 text-[10px] font-bold uppercase text-signal">Live</span>
            </div>
            <div className="divide-y divide-canvas/10">
              {leaders.map((leader) => (
                <div key={leader.rank} className="flex items-center gap-4 p-4 transition-colors hover:bg-canvas/5">
                  <span className="w-4 text-center text-xs font-black text-canvas/45">{leader.rank}</span>
                  <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-ocean to-signal p-0.5">
                    <div className="grid h-full w-full place-items-center rounded-full bg-obsidian">
                      <span className="material-symbols-outlined text-sm text-canvas/80">person</span>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold">{leader.name}</p>
                    <p className="text-[10px] text-canvas/45">{leader.profit}</p>
                  </div>
                  <span className="text-[10px] font-bold text-gain">{leader.gain}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}

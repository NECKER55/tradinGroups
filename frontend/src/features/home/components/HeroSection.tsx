type HeroSectionProps = {
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  searchLoading: boolean;
};

export function HeroSection({ searchTerm, onSearchTermChange, searchLoading }: HeroSectionProps) {
  return (
    <section className="mx-auto max-w-7xl px-6 py-12">
      <div className="violet-underlight mb-12 flex flex-col items-center gap-6 text-center animate-rise-in">
        <h1 className="text-4xl font-black tracking-tight text-canvas md:text-6xl">
          <span className="text-white">Trading</span><span className="text-signal">IQ</span>
        </h1>
        <p className="max-w-2xl text-canvas/65">
          TradingIQ lets you manage a personal trading workspace and separate group portfolios with isolated budgets.
          In each group, members compete on performance and rankings to prove who trades better.
        </p>

        <div className="w-full max-w-2xl text-left">
          <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-violet-300/85">Find the squads</h2>
          <p className="mt-1 text-xs text-canvas/55">Search public groups by name and open their leaderboard preview.</p>
        </div>

        <div className="group relative w-full max-w-2xl">
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-[#7c3aed] via-[#a855f7] to-[#6366f1] blur opacity-35 transition-opacity group-hover:opacity-65" />
          <div className="relative flex items-center overflow-hidden rounded-2xl border border-canvas/15 bg-ink p-1.5">
            <span className="material-symbols-outlined ml-4 text-canvas/45">search</span>
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
              placeholder="Search groups by name..."
              className="w-full border-none bg-transparent px-4 py-3 text-canvas placeholder:text-canvas/35 focus:outline-none focus:ring-0"
            />
            <button
              type="button"
              onClick={() => onSearchTermChange('')}
              className="rounded-xl bg-signal px-6 py-3 font-bold text-obsidian transition-all hover:bg-signal/90"
            >
              {searchLoading ? 'Searching...' : (searchTerm.trim() ? 'Clear' : 'Search')}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function HeroSection() {
  return (
    <section className="mx-auto max-w-7xl px-6 py-12">
      <div className="mb-12 flex flex-col items-center gap-6 text-center animate-rise-in">
        <h1 className="text-4xl font-black tracking-tight text-canvas md:text-6xl">
          Find Your <span className="text-signal">Squad</span>
        </h1>
        <p className="max-w-xl text-canvas/65">
          Join elite trading groups, compete in global challenges, and master the markets together.
        </p>

        <div className="group relative w-full max-w-2xl">
          <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-signal via-alert to-ocean blur opacity-30 transition-opacity group-hover:opacity-60" />
          <div className="relative flex items-center overflow-hidden rounded-2xl border border-canvas/15 bg-ink p-1.5">
            <span className="material-symbols-outlined ml-4 text-canvas/45">search</span>
            <input
              type="text"
              placeholder="Search squads, strategies, markets..."
              className="w-full border-none bg-transparent px-4 py-3 text-canvas placeholder:text-canvas/35 focus:outline-none focus:ring-0"
            />
            <button className="rounded-xl bg-signal px-6 py-3 font-bold text-obsidian transition-all hover:bg-signal/90">
              Search
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

import { useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { GroupSummary } from '../../social/api/socialHubApi';

type FeaturedSquadsSectionProps = {
  searchTerm: string;
  searchLoading: boolean;
  searchError: string | null;
  groupResults: GroupSummary[];
};

type SquadCard = {
  id: number | null;
  badge: string;
  name: string;
  description: string;
  privacy: 'Public' | 'Private';
  cta: string;
};

const featuredSquads: SquadCard[] = [
  {
    id: null,
    badge: 'Featured #1',
    name: 'Wall Street Wolves',
    description: 'Momentum strategies and disciplined risk control, every session.',
    privacy: 'Public',
    cta: 'Open Group',
  },
  {
    id: null,
    badge: 'Featured #2',
    name: 'Crypto Titans',
    description: 'Macro + crypto trend plays coordinated by experienced swing traders.',
    privacy: 'Private',
    cta: 'Open Group',
  },
  {
    id: null,
    badge: 'Featured #3',
    name: 'Quant Pulse Lab',
    description: 'Data-driven setup sharing focused on consistency over hype.',
    privacy: 'Public',
    cta: 'Open Group',
  },
];

function toSearchCard(group: GroupSummary, index: number): SquadCard {
  return {
    id: group.id_gruppo,
    badge: `Result #${index + 1}`,
    name: group.nome,
    description: group.descrizione?.trim() || 'No description available for this group yet.',
    privacy: group.privacy,
    cta: group.is_member ? 'Open Workspace' : 'View Group',
  };
}

export function FeaturedSquadsSection({ searchTerm, searchLoading, searchError, groupResults }: FeaturedSquadsSectionProps) {
  const query = searchTerm.trim();
  const queryActive = query.length > 0;
  const cardsContainerRef = useRef<HTMLDivElement | null>(null);

  const cards = useMemo(() => {
    if (!queryActive) {
      return featuredSquads.slice(0, 3);
    }

    return groupResults.slice(0, 3).map(toSearchCard);
  }, [groupResults, queryActive]);

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
  }, []);

  useEffect(() => {
    const container = cardsContainerRef.current;
    if (!container) return;

    const cardNodes = container.querySelectorAll<HTMLElement>('[data-squad-card]');
    if (!cardNodes.length) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        cardNodes,
        { autoAlpha: 0, y: 18, scale: 0.985 },
        {
          autoAlpha: 1,
          y: 0,
          scale: 1,
          duration: 0.42,
          stagger: 0.08,
          ease: 'power2.out',
          overwrite: 'auto',
          scrollTrigger: {
            trigger: container,
            start: 'top 92%',
            once: true,
          },
        },
      );
    }, container);

    return () => ctx.revert();
  }, [cards.length, query, queryActive]);

  const centeredLayout = queryActive && cards.length > 0 && cards.length < 3;

  return (
    <section className="mx-auto max-w-7xl px-6 py-8">
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="flex items-center gap-3 text-2xl font-bold">
            <span className="material-symbols-outlined text-signal">groups</span>
            {queryActive ? `Group results for "${query}"` : 'Featured Squads'}
          </h2>
          <Link to="/social" className="text-sm font-semibold text-signal transition-colors hover:text-signal/80 hover:underline">
            View all groups
          </Link>
        </div>

        <div className="min-h-5 text-xs uppercase tracking-[0.12em] text-canvas/50 transition-all duration-300">
          {searchLoading
            ? 'Searching groups...'
            : (searchError
              ? `Search error: ${searchError}`
              : (queryActive
                ? (cards.length > 0 ? `Showing ${cards.length} of max 3 matches` : 'No groups matched')
                : 'Showing featured groups'))}
        </div>

        <div
          ref={cardsContainerRef}
          className={centeredLayout
            ? 'flex flex-wrap justify-center gap-6'
            : 'grid gap-6 md:grid-cols-2 xl:grid-cols-3'}
        >
          {cards.map((card, index) => {
            const isSearchResult = queryActive && card.id !== null;

            const content = (
              <article
                key={`${card.badge}-${card.name}-${queryActive ? 'search' : 'featured'}`}
                data-squad-card
                className="neo-card group relative flex h-full min-h-[230px] w-full max-w-[360px] flex-col gap-5 rounded-2xl p-6 transition-all duration-300 ease-out hover:-translate-y-1 hover:border-signal/40"
              >
                <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-signal/10 blur-2xl transition-opacity duration-300 group-hover:opacity-100" />

                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.25em] text-signal">{card.badge}</span>
                    <h3 className="truncate text-xl font-bold transition-colors group-hover:text-signal">{card.name}</h3>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${card.privacy === 'Public' ? 'border-emerald-400/35 bg-emerald-500/10 text-emerald-200' : 'border-violet-400/35 bg-violet-500/10 text-violet-200'}`}>
                    {card.privacy}
                  </span>
                </div>

                <p className="line-clamp-3 text-sm text-canvas/65 transition-colors duration-300 group-hover:text-canvas/80">
                  {card.description}
                </p>

                <div className="mt-auto flex items-center justify-between border-t border-canvas/10 pt-4">
                  <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-canvas/45">Snippet {String(index + 1).padStart(2, '0')}</span>
                  <span className="rounded-lg bg-signal px-4 py-2 text-xs font-bold uppercase text-obsidian transition-all duration-300 group-hover:bg-signal/85">
                    {card.cta}
                  </span>
                </div>
              </article>
            );

            if (isSearchResult && card.id) {
              return (
                <Link key={`${card.id}-${index}`} to={`/groups/${card.id}`} className="block transition-opacity duration-300 hover:opacity-95">
                  {content}
                </Link>
              );
            }

            return <div key={`${card.name}-${index}`} className="transition-opacity duration-300">{content}</div>;
          })}
        </div>
      </div>
    </section>
  );
}

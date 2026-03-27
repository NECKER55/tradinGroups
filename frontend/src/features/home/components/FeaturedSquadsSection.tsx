import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { GroupSummary } from '../../social/api/socialHubApi';
import { getGroupRanking } from '../../groups/api/groupDetailApi';

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
  privacy: 'Public' | 'Private';
  cta: string;
  topFour: Array<{ label: string; value: string }>;
};

const featuredSquads: SquadCard[] = [
  {
    id: null,
    badge: 'Featured #1',
    name: 'Wall Street Wolves',
    privacy: 'Public',
    cta: 'Open Group',
    topFour: [
      { label: 'Alpha_Ghost', value: '$412k' },
      { label: 'QFlow', value: '$386k' },
      { label: 'ZenTrader', value: '$351k' },
      { label: 'CandleBorn', value: '$330k' },
    ],
  },
  {
    id: null,
    badge: 'Featured #2',
    name: 'Crypto Titans',
    privacy: 'Private',
    cta: 'Open Group',
    topFour: [
      { label: 'BTC_Reaper', value: '$297k' },
      { label: 'Luna_Grid', value: '$271k' },
      { label: 'VolShift', value: '$253k' },
      { label: 'DeltaBear', value: '$240k' },
    ],
  },
  {
    id: null,
    badge: 'Featured #3',
    name: 'Quant Pulse Lab',
    privacy: 'Public',
    cta: 'Open Group',
    topFour: [
      { label: 'MeanRev_1', value: '$218k' },
      { label: 'Sigma_Byte', value: '$205k' },
      { label: 'NeuralTape', value: '$198k' },
      { label: 'HawkMode', value: '$191k' },
    ],
  },
];

function toCompactCurrency(value: number): string {
  if (!Number.isFinite(value)) return '$0';
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}k`;
  return `$${Math.round(value)}`;
}

function toSearchCard(group: GroupSummary, index: number): SquadCard {
  return {
    id: group.id_gruppo,
    badge: `Result #${index + 1}`,
    name: group.nome,
    privacy: group.privacy,
    cta: group.is_member ? 'Open Workspace' : 'View Group',
    topFour: [],
  };
}

export function FeaturedSquadsSection({ searchTerm, searchLoading, searchError, groupResults }: FeaturedSquadsSectionProps) {
  const query = searchTerm.trim();
  const queryActive = query.length > 0;
  const cardsContainerRef = useRef<HTMLDivElement | null>(null);
  const [rankingPreviewByGroup, setRankingPreviewByGroup] = useState<Record<number, Array<{ label: string; value: string }>>>({});

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
    const groupIds = cards
      .map((card) => card.id)
      .filter((id): id is number => Number.isFinite(id));

    if (groupIds.length === 0) {
      setRankingPreviewByGroup({});
      return;
    }

    let active = true;

    void (async () => {
      const results = await Promise.allSettled(
        groupIds.map(async (id) => {
          const res = await getGroupRanking(id);
          return {
            id,
            rows: res.ranking.slice(0, 4).map((row) => ({
              label: row.username,
              value: toCompactCurrency(Number(row.valore_totale)),
            })),
          };
        }),
      );

      if (!active) return;

      const next: Record<number, Array<{ label: string; value: string }>> = {};
      for (const row of results) {
        if (row.status === 'fulfilled') {
          next[row.value.id] = row.value.rows;
        }
      }

      setRankingPreviewByGroup(next);
    })();

    return () => {
      active = false;
    };
  }, [cards]);

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

                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-canvas/45">Top 4 Ranking</p>
                  <div className="space-y-1.5">
                    {(card.id ? (rankingPreviewByGroup[card.id] ?? []) : card.topFour).slice(0, 4).map((row, rowIndex) => (
                      <div key={`${row.label}-${rowIndex}`} className="flex items-center justify-between text-sm text-canvas/80">
                        <span className="inline-flex items-center gap-2 truncate">
                          <span className="text-[10px] font-black text-canvas/45">{String(rowIndex + 1).padStart(2, '0')}</span>
                          <span className="truncate">{row.label}</span>
                        </span>
                        <span className="text-xs font-bold text-emerald-300">{row.value}</span>
                      </div>
                    ))}
                    {card.id && !(rankingPreviewByGroup[card.id]?.length) ? (
                      <p className="text-xs text-canvas/45">Ranking preview unavailable.</p>
                    ) : null}
                  </div>
                </div>

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

import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { AnimatedContent } from './AnimatedContent';

type HoldingRow = {
  id_stock: string;
  nome_societa: string;
  numero: string;
  prezzo_medio_acquisto: string;
};

type HoldingsDonutPanelProps = {
  items: HoldingRow[];
  currentPrices?: Record<string, number>;
  onSelect: (stockId: string) => void;
  emptyLabel: string;
};

const SLICE_COLORS = ['#a78bfa', '#8b5cf6', '#7c3aed', '#6d28d9', '#5b21b6', '#4c1d95', '#7e22ce', '#c084fc'];

function toNumber(value: string | null | undefined): number {
  if (!value) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(angleRad),
    y: cy + r * Math.sin(angleRad),
  };
}

function describeArc(cx: number, cy: number, innerR: number, outerR: number, start: number, end: number): string {
  const largeArc = end - start > 180 ? 1 : 0;

  const outerStart = polarToCartesian(cx, cy, outerR, start);
  const outerEnd = polarToCartesian(cx, cy, outerR, end);
  const innerEnd = polarToCartesian(cx, cy, innerR, end);
  const innerStart = polarToCartesian(cx, cy, innerR, start);

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    'Z',
  ].join(' ');
}

export function HoldingsDonutPanel({ items, currentPrices = {}, onSelect, emptyLabel }: HoldingsDonutPanelProps) {
  const [activeSliceIndex, setActiveSliceIndex] = useState<number | null>(null);

  const normalized = items.map((item) => {
    const quantity = Math.max(0, toNumber(item.numero));
    const avgBuy = Math.max(0, toNumber(item.prezzo_medio_acquisto));
    const currentPrice = Math.max(0, currentPrices[item.id_stock] ?? 0);
    const invested = quantity * avgBuy;
    const marketValue = quantity * currentPrice;
    const deltaValue = marketValue - invested;
    const deltaPct = invested > 0 ? (deltaValue / invested) * 100 : 0;

    return {
      ...item,
      quantity,
      avgBuy,
      currentPrice,
      invested,
      marketValue,
      deltaValue,
      deltaPct,
    };
  });

  const totalMarketValue = normalized.reduce((acc, row) => acc + row.marketValue, 0);

  let cursor = -90;
  const slices = normalized.map((row, index) => {
    const ratio = totalMarketValue > 0 ? row.marketValue / totalMarketValue : 1 / Math.max(1, normalized.length);
    const sweep = ratio * 360;
    const start = cursor;
    const end = cursor + sweep;
    cursor = end;

    return {
      ...row,
      start,
      end,
      color: SLICE_COLORS[index % SLICE_COLORS.length],
    };
  });

  const activeSlice = useMemo(() => {
    if (activeSliceIndex === null) return null;
    return slices[activeSliceIndex] ?? null;
  }, [activeSliceIndex, slices]);

  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(300px,380px)_1fr] lg:items-start">
      <motion.div
        className="relative"
        initial={{ opacity: 0, scale: 0.92, rotate: -10 }}
        animate={{ opacity: 1, scale: 1, rotate: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Allocation by current market value</p>

        {slices.length === 0 ? (
          <div className="flex h-[240px] items-center justify-center text-sm text-slate-400">{emptyLabel}</div>
        ) : (
          <>
            <svg className="mx-auto h-[250px] w-[250px]" viewBox="0 0 240 240" role="img" aria-label="Holdings distribution donut chart">
              <circle cx="120" cy="120" r="74" fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth="28" />

              {slices.map((slice, index) => {
                const mid = (slice.start + slice.end) / 2;
                const push = 4;
                const offset = polarToCartesian(0, 0, push, mid);

                return (
                  <motion.path
                    key={`${slice.id_stock}-${index}`}
                    d={describeArc(120, 120, 60, 88, slice.start, slice.end)}
                    fill={slice.color}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 0.94, scale: 1 }}
                    transition={{ delay: index * 0.05, duration: 0.35, ease: 'easeOut' }}
                    whileHover={{ x: offset.x, y: offset.y, opacity: 1 }}
                    onMouseEnter={() => setActiveSliceIndex(index)}
                    onMouseLeave={() => setActiveSliceIndex(null)}
                    onFocus={() => setActiveSliceIndex(index)}
                    onBlur={() => setActiveSliceIndex(null)}
                    onClick={() => onSelect(slice.id_stock)}
                    className="cursor-pointer"
                    role="button"
                    tabIndex={0}
                    aria-label={`Open ${slice.id_stock}`}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        onSelect(slice.id_stock);
                      }
                    }}
                  />
                );
              })}

              <circle cx="120" cy="120" r="48" fill="#0b0b11" />
              <text x="120" y="112" textAnchor="middle" className="fill-slate-400 text-[10px] uppercase tracking-[0.15em]">Total</text>
              <text x="120" y="132" textAnchor="middle" className="fill-slate-100 text-[13px] font-bold">{toCurrency(totalMarketValue)}</text>
            </svg>

            <div className="mt-2 min-h-10 text-center">
              {activeSlice ? (
                <button
                  type="button"
                  onClick={() => onSelect(activeSlice.id_stock)}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-violet-200 transition-colors hover:text-violet-100"
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: activeSlice.color }}
                    aria-hidden
                  />
                  {activeSlice.id_stock} - {toCurrency(activeSlice.marketValue)}
                </button>
              ) : (
                <div aria-hidden className="h-5" />
              )}
            </div>
          </>
        )}
      </motion.div>

      <div className="space-y-2">
        {normalized.length === 0 ? (
          <p className="text-sm text-slate-400">{emptyLabel}</p>
        ) : (
          normalized.map((item, index) => (
            <AnimatedContent
              key={`${item.id_stock}-${index}`}
              distance={36}
              direction="vertical"
              duration={0.8}
              ease="power3.out"
              initialOpacity={0}
              animateOpacity
              scale={1}
              threshold={0.1}
              delay={index * 0.08}
              className="will-change-transform"
            >
              <button
                type="button"
                onClick={() => onSelect(item.id_stock)}
                className="group flex w-full items-center justify-between border-b border-[#232337] py-3 text-left transition-colors hover:border-violet-500/40"
              >
                <div className="min-w-0 pr-4">
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: SLICE_COLORS[index % SLICE_COLORS.length] }}
                      aria-hidden
                    />
                    <p className="truncate text-sm font-bold text-slate-100 group-hover:text-violet-200">{item.id_stock} - {item.nome_societa}</p>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">
                    Qty {item.quantity.toFixed(6)} | Value {toCurrency(item.marketValue)}
                  </p>
                </div>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${item.deltaValue >= 0 ? 'bg-emerald-500/10 text-emerald-300' : 'bg-rose-500/10 text-rose-300'}`}>
                  <span className="material-symbols-outlined mr-1 text-sm">{item.deltaValue >= 0 ? 'trending_up' : 'trending_down'}</span>
                  {item.deltaValue >= 0 ? '+' : ''}{item.deltaPct.toFixed(2)}%
                </span>
              </button>
            </AnimatedContent>
          ))
        )}
      </div>
    </div>
  );
}

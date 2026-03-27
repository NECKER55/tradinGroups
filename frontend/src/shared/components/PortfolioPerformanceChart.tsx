import { useId, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { curveMonotoneX, line as d3Line } from 'd3-shape';

type RangeKey = 'ALL' | 'WEEK' | 'MONTH_1' | 'MONTH_6' | 'YEAR';

type PortfolioHistoryPoint = {
  data: string;
  valore_totale: string;
};

const RANGE_OPTIONS: Array<{ key: RangeKey; label: string }> = [
  { key: 'ALL', label: 'all' },
  { key: 'WEEK', label: 'week' },
  { key: 'MONTH_1', label: '1 month' },
  { key: 'MONTH_6', label: '6 month' },
  { key: 'YEAR', label: 'year' },
];

function toNumber(value: string | null | undefined): number {
  if (!value) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function toDateOnly(value: string): Date {
  const d = new Date(`${value}T00:00:00`);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDateLabel(date: Date): string {
  return date.toLocaleDateString('en-US', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function buildDailySeries(
  sortedHistory: Array<{ date: Date; value: number }>,
  start: Date,
  end: Date,
): Array<{ date: Date; label: string; value: number }> {
  const points: Array<{ date: Date; label: string; value: number }> = [];

  let pointer = 0;
  let lastKnown = 0;
  let hasKnownValue = false;

  while (pointer < sortedHistory.length && sortedHistory[pointer].date < start) {
    lastKnown = sortedHistory[pointer].value;
    hasKnownValue = true;
    pointer += 1;
  }

  const cursor = new Date(start);
  while (cursor <= end) {
    while (pointer < sortedHistory.length && sortedHistory[pointer].date <= cursor) {
      lastKnown = sortedHistory[pointer].value;
      hasKnownValue = true;
      pointer += 1;
    }

    points.push({
      date: new Date(cursor),
      label: formatDateLabel(cursor),
      value: hasKnownValue ? lastKnown : 0,
    });

    cursor.setDate(cursor.getDate() + 1);
  }

  return points;
}

function buildSeries(history: PortfolioHistoryPoint[], range: RangeKey): Array<{ date: Date; label: string; value: number }> {
  const sortedHistory = history
    .map((row) => ({ date: toDateOnly(row.data), value: toNumber(row.valore_totale) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = new Date(today);

  if (range === 'WEEK') {
    start.setDate(today.getDate() - 6);
  } else if (range === 'MONTH_1') {
    start.setDate(today.getDate() - 29);
  } else if (range === 'MONTH_6') {
    start.setMonth(today.getMonth() - 6);
    start.setDate(start.getDate() + 1);
  } else if (range === 'YEAR') {
    start.setFullYear(today.getFullYear() - 1);
    start.setDate(start.getDate() + 1);
  } else {
    const first = sortedHistory.length ? sortedHistory[0].date : today;
    start.setTime(first.getTime());
  }

  return buildDailySeries(sortedHistory, start, today);
}

function niceCeil(value: number): number {
  if (value <= 0) return 1;

  const exponent = Math.floor(Math.log10(value));
  const base = 10 ** exponent;
  const normalized = value / base;

  if (normalized <= 1) return 1 * base;
  if (normalized <= 2) return 2 * base;
  if (normalized <= 5) return 5 * base;
  return 10 * base;
}

function formatAxisValue(value: number): string {
  if (Math.abs(value) >= 1000) {
    const rounded = Math.round((value / 1000) * 10) / 10;
    return `${rounded}k`;
  }
  return `${Math.round(value)}`;
}

function formatTooltipValue(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
}

function buildSmoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length === 0) return '';

  const generator = d3Line<{ x: number; y: number }>()
    .x((d) => d.x)
    .y((d) => d.y)
    .curve(curveMonotoneX);

  return generator(points) ?? '';
}

type PortfolioPerformanceChartProps = {
  history: PortfolioHistoryPoint[];
  title: string;
  accentClassName?: string;
};

export function PortfolioPerformanceChart({
  history,
  title,
  accentClassName = 'text-violet-200',
}: PortfolioPerformanceChartProps) {
  const [range, setRange] = useState<RangeKey>('MONTH_1');
  const [hoveredProgress, setHoveredProgress] = useState<number | null>(null);

  const chart = useMemo(() => buildSeries(history, range), [history, range]);
  const values = chart.map((point) => point.value);
  const hasValues = values.length > 0;
  const isFlatSeries = hasValues && values.every((value) => value === values[0]);

  const maxValue = Math.max(1, ...values);
  const minValue = Math.min(0, ...values);
  const yMax = Math.max(1, niceCeil(maxValue * 1.06));
  const yMin = minValue < 0 ? Math.floor(minValue) : 0;
  const ySpan = Math.max(1, yMax - yMin);
  const chartTop = 4;
  const chartHeight = 92;

  const chartWidth = 94;

  const points = values.map((value, index) => {
    const x = values.length > 1 ? (index / (values.length - 1)) * chartWidth : chartWidth / 2;
    const y = chartTop + (1 - ((value - yMin) / ySpan)) * chartHeight;
    return { x, y };
  });

  const linePath = buildSmoothPath(points);

  const id = useId().replace(/:/g, '');
  const lineId = `portfolio-line-${id}`;
  const bubbleId = `portfolio-range-bubble-${id}`;
  const maxIndex = Math.max(0, chart.length - 1);
  const resolvedProgress = hoveredProgress ?? 1;
  const fractionalIndex = resolvedProgress * maxIndex;
  const snappedIndex = Math.min(maxIndex, Math.max(0, Math.round(fractionalIndex)));

  const leftIndex = Math.min(maxIndex, Math.max(0, Math.floor(fractionalIndex)));
  const rightIndex = Math.min(maxIndex, leftIndex + 1);
  const localT = Math.min(1, Math.max(0, fractionalIndex - leftIndex));

  const leftPoint = points[leftIndex] ?? { x: chartWidth / 2, y: chartTop + chartHeight };
  const rightPoint = points[rightIndex] ?? leftPoint;

  const activePoint = {
    x: leftPoint.x + (rightPoint.x - leftPoint.x) * localT,
    y: leftPoint.y + (rightPoint.y - leftPoint.y) * localT,
  };

  const activeItem = chart[snappedIndex] ?? { date: new Date(), label: formatDateLabel(new Date()), value: 0 };

  const yTicks = [yMax, Math.round((yMax + yMin) / 2), yMin];

  function getYPercent(value: number): number {
    return chartTop + (1 - ((value - yMin) / ySpan)) * chartHeight;
  }

  function handlePointerMove(event: React.PointerEvent<SVGRectElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const relative = (event.clientX - bounds.left) / Math.max(1, bounds.width);
    const clamped = Math.max(0, Math.min(1, relative));
    setHoveredProgress(clamped);
  }

  function handlePointerLeave() {
    setHoveredProgress(null);
  }

  return (
    <div className="relative py-4">
      <div className="pointer-events-none absolute -left-12 -top-16 h-40 w-40 rounded-full bg-violet-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-48 w-48 rounded-full bg-fuchsia-500/10 blur-3xl" />

      <div className="relative z-10 mb-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h3 className={`text-lg font-bold ${accentClassName}`}>{title}</h3>
        <div className="inline-flex w-full max-w-full items-center gap-1 overflow-x-auto rounded-full border border-violet-500/25 bg-[#0b0b10]/70 p-1 md:w-auto">
          {RANGE_OPTIONS.map((option) => (
            <button
              key={option.key}
              onClick={() => setRange(option.key)}
              className={`relative shrink-0 rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                range === option.key ? 'text-white' : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              {range === option.key ? (
                <motion.span
                  layoutId={bubbleId}
                  className="absolute inset-0 rounded-full bg-violet-500 shadow-lg shadow-violet-500/35"
                  transition={{ type: 'spring', bounce: 0.25, duration: 0.55 }}
                />
              ) : null}
              <span className="relative z-10">{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="relative z-10 mb-2 space-y-1">
        <p className="text-2xl font-bold leading-none text-slate-100">{formatTooltipValue(activeItem.value)}</p>
        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">{activeItem.label}</p>
      </div>

      <div className="relative z-10 h-[300px] w-full">
        <svg className="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Portfolio performance chart">
          <defs>
            <linearGradient id={lineId} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#d7b4ff" />
              <stop offset="50%" stopColor="#b780ff" />
              <stop offset="100%" stopColor="#7c4dff" />
            </linearGradient>
          </defs>

          <motion.path
            key={`${range}-line`}
            d={linePath}
            fill="none"
            stroke={`url(#${lineId})`}
            strokeWidth={1.15}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            style={{ shapeRendering: 'geometricPrecision' }}
          />

          {isFlatSeries ? (
            <line
              x1="0"
              y1={getYPercent(values[0] ?? 0)}
              x2="94"
              y2={getYPercent(values[0] ?? 0)}
              stroke="#d9c6ff"
              strokeOpacity="0.32"
              strokeWidth="0.55"
            />
          ) : null}

          <rect
            x="0"
            y="0"
            width="94"
            height="100"
            fill="transparent"
            onPointerMove={handlePointerMove}
            onPointerLeave={handlePointerLeave}
          />
        </svg>

        <motion.div
          className="pointer-events-none absolute h-3 w-3 rounded-full border border-violet-300 bg-[#f4ecff] shadow-[0_0_14px_rgba(167,121,255,0.65)]"
          style={{
            left: `${activePoint.x}%`,
            top: `${activePoint.y}%`,
            transform: 'translate(-50%, -50%)',
          }}
          animate={{ left: `${activePoint.x}%`, top: `${activePoint.y}%` }}
          transition={{ type: 'spring', stiffness: 360, damping: 28, mass: 0.25 }}
        />

        <div className="pointer-events-none absolute inset-y-0 right-0 w-[10%]">
          {yTicks.map((tick, index) => (
            <span
              key={`${tick}-${index}`}
              className="absolute right-0 -translate-y-1/2 text-[10px] font-semibold uppercase tracking-wide text-slate-500"
              style={{ top: `${getYPercent(tick)}%` }}
            >
              {formatAxisValue(tick)}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useMemo } from 'react';

interface TradingViewWidgetProps {
  symbol: string;
}

export function TradingViewWidget({ symbol }: TradingViewWidgetProps) {
  const normalized = symbol.toUpperCase();
  const primarySymbol = normalized.includes(':') ? normalized : normalized;

  const iframeSrc = useMemo(() => {
    const payload = {
      autosize: true,
      symbol: primarySymbol,
      interval: 'D',
      timezone: 'Etc/UTC',
      theme: 'dark',
      style: '1',
      locale: 'en',
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: true,
      save_image: false,
      support_host: 'https://www.tradingview.com',
    };

    return `https://www.tradingview-widget.com/embed-widget/advanced-chart/?locale=en#${encodeURIComponent(JSON.stringify(payload))}`;
  }, [primarySymbol]);

  return (
    <div className="tradingview-widget-container relative h-[500px] w-full overflow-visible rounded-xl border border-white/10 bg-[#0f0f1a]">
      <iframe
        key={primarySymbol}
        title={`TradingView ${primarySymbol}`}
        src={iframeSrc}
        className="h-full w-full border-0"
        loading="lazy"
      />
    </div>
  );
}

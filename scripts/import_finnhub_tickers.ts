import { PrismaClient } from '@prisma/client';

interface FinnhubSymbolItem {
  currency?: string;
  description?: string;
  displaySymbol?: string;
  symbol?: string;
  type?: string;
}

const FINNHUB_SYMBOLS_URL = 'https://finnhub.io/api/v1/stock/symbol?exchange=US';
const BATCH_SIZE = 1000;

function cleanTicker(raw: string | undefined): string | null {
  if (!raw) return null;
  const ticker = raw.trim().toUpperCase();
  if (!ticker) return null;
  if (ticker.length > 10) return null;
  return ticker;
}

function cleanName(raw: string | undefined, fallback: string): string {
  const value = (raw ?? '').trim();
  if (value.length === 0) return fallback;
  return value.slice(0, 150);
}

function cleanSector(rawType: string | undefined): string {
  const value = (rawType ?? '').trim();
  if (value.length === 0) return 'Unknown';
  return value.slice(0, 50);
}

async function main() {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    throw new Error('FINNHUB_API_KEY is not set.');
  }

  const prisma = new PrismaClient();

  try {
    console.log('Downloading tickers from Finnhub...');
    const response = await fetch(`${FINNHUB_SYMBOLS_URL}&token=${encodeURIComponent(apiKey)}`);

    if (!response.ok) {
      throw new Error(`Finnhub error: HTTP ${response.status}`);
    }

    const allTickers = (await response.json()) as FinnhubSymbolItem[];
    console.log(`Received ${allTickers.length} symbols from Finnhub.`);

    const rows = allTickers
      .map((item) => {
        const id_stock = cleanTicker(item.symbol ?? item.displaySymbol);
        if (!id_stock) return null;

        return {
          id_stock,
          nome_societa: cleanName(item.description, id_stock),
          settore: cleanSector(item.type),
          prezzo_attuale: null,
        };
      })
      .filter((row): row is { id_stock: string; nome_societa: string; settore: string; prezzo_attuale: null } => row !== null);

    const uniqueMap = new Map<string, { id_stock: string; nome_societa: string; settore: string; prezzo_attuale: null }>();
    for (const row of rows) {
      if (!uniqueMap.has(row.id_stock)) {
        uniqueMap.set(row.id_stock, row);
      }
    }

    const deduped = Array.from(uniqueMap.values());
    console.log(`After deduplication: ${deduped.length} valid tickers.`);

    let inserted = 0;
    for (let i = 0; i < deduped.length; i += BATCH_SIZE) {
      const chunk = deduped.slice(i, i + BATCH_SIZE);
      const result = await prisma.stock.createMany({
        data: chunk,
        skipDuplicates: true,
      });
      inserted += result.count;
      console.log(`Chunk ${Math.floor(i / BATCH_SIZE) + 1}: +${result.count} inserted.`);
    }

    console.log(`Import completed. New tickers inserted: ${inserted}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Ticker import failed:', error);
  process.exit(1);
});

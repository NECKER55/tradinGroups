import { Prisma } from '@prisma/client';
import { prisma } from '../src/lib/prisma';
import { fetchQuotesForTickers } from '../src/services/finnhub';

async function main() {
  const stocks = await prisma.stock.findMany({
    select: { id_stock: true },
    orderBy: { id_stock: 'asc' },
  });

  if (stocks.length === 0) {
    console.log('Nessun titolo trovato nella tabella stock.');
    return;
  }

  const tickers = stocks.map((s) => s.id_stock);
  console.log(`Recupero quotazioni Finnhub per ${tickers.length} ticker...`);

  const quotes = await fetchQuotesForTickers(tickers);

  if (quotes.size === 0) {
    console.log('Nessuna quotazione valida ricevuta da Finnhub.');
    return;
  }

  const updates: Prisma.PrismaPromise<unknown>[] = [];
  for (const [id_stock, price] of quotes.entries()) {
    if (!Number.isFinite(price) || price <= 0) continue;

    updates.push(
      prisma.stock.updateMany({
        where: { id_stock },
        data: { prezzo_attuale: new Prisma.Decimal(price.toFixed(6)) },
      }),
    );
  }

  if (updates.length > 0) {
    await prisma.$transaction(updates);
  }

  console.log(`Aggiornati ${updates.length} prezzi correnti su tabella stock.`);
}

main()
  .catch((error) => {
    console.error('Errore sync prezzi correnti:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

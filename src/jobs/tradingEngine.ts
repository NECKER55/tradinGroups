import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { fetchQuotesForTickers } from '../services/finnhub';

const PROCESS_INTERVAL_MS = 60_000;
const MIN_PENDING_AGE_MS = 20_000;

let isProcessing = false;

async function processPendingOrders(): Promise<void> {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const threshold = new Date(Date.now() - MIN_PENDING_AGE_MS);

    const [pendingOrders, watchlistTickers, portfolioTickers] = await Promise.all([
      prisma.transazione.findMany({
        where: {
          stato: 'Pending',
          created_at: {
            lte: threshold,
          },
        },
        orderBy: {
          created_at: 'asc',
        },
        select: {
          id_transazione: true,
          id_stock: true,
          id_portafoglio: true,
          tipo: true,
          importo_investito: true,
          quantita_azioni: true,
        },
      }),
      prisma.watchlist.findMany({
        distinct: ['id_stock'],
        select: { id_stock: true },
      }),
      prisma.azioni_in_possesso.findMany({
        distinct: ['id_stock'],
        select: { id_stock: true },
      }),
    ]);

    if (pendingOrders.length === 0) return;

    const tickers = new Set<string>();
    for (const order of pendingOrders) tickers.add(order.id_stock);
    for (const item of watchlistTickers) tickers.add(item.id_stock);
    for (const item of portfolioTickers) tickers.add(item.id_stock);

    const quotes = await fetchQuotesForTickers([...tickers]);

    for (const order of pendingOrders) {
      const currentPrice = quotes.get(order.id_stock);
      if (!currentPrice || currentPrice <= 0) {
        continue;
      }

      const executionPrice = new Prisma.Decimal(currentPrice.toFixed(6));

      if (order.tipo === 'Buy') {
        if (!order.importo_investito) continue;

        const quantity = order.importo_investito.div(executionPrice);

        await prisma.transazione.updateMany({
          where: {
            id_transazione: order.id_transazione,
            stato: 'Pending',
          },
          data: {
            stato: 'Executed',
            prezzo_esecuzione: executionPrice,
            quantita_azioni: quantity,
            approved_at: new Date(),
          },
        });

        continue;
      }

      if (!order.quantita_azioni) continue;

      await prisma.transazione.updateMany({
        where: {
          id_transazione: order.id_transazione,
          stato: 'Pending',
        },
        data: {
          stato: 'Executed',
          prezzo_esecuzione: executionPrice,
          approved_at: new Date(),
        },
      });
    }
  } catch (error) {
    console.error('[jobs] Errore trading engine:', error);
  } finally {
    isProcessing = false;
  }
}

export function startCronJobs(): void {
  console.log('[jobs] Trading engine cron attivo (ogni 60s)');
  void processPendingOrders();
  setInterval(() => {
    void processPendingOrders();
  }, PROCESS_INTERVAL_MS);
}

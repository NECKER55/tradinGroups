import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { fetchQuotesForTickers } from '../services/finnhub';

const PROCESS_INTERVAL_MS = 60_000;
const MIN_PENDING_AGE_MS = 20_000;

let isProcessing = false;

export type ProcessPendingOrdersResult = {
  status: 'processed' | 'skipped_running';
  totalPendingOrders: number;
  executedOrders: number;
};

async function syncCurrentStockPrices(quotes: Map<string, number>): Promise<void> {
  if (quotes.size === 0) return;

  const updates: Prisma.PrismaPromise<unknown>[] = [];

  for (const [id_stock, price] of quotes.entries()) {
    if (!Number.isFinite(price) || price <= 0) continue;

    updates.push(
      prisma.stock.updateMany({
        where: { id_stock },
        data: {
          prezzo_attuale: new Prisma.Decimal(price.toFixed(6)),
        },
      }),
    );
  }

  if (updates.length > 0) {
    await prisma.$transaction(updates);
  }
}

export async function processPendingOrders(): Promise<ProcessPendingOrdersResult> {
  if (isProcessing) {
    return {
      status: 'skipped_running',
      totalPendingOrders: 0,
      executedOrders: 0,
    };
  }

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

    if (pendingOrders.length === 0) {
      return {
        status: 'processed',
        totalPendingOrders: 0,
        executedOrders: 0,
      };
    }

    const tickers = new Set<string>();
    for (const order of pendingOrders) tickers.add(order.id_stock);
    for (const item of watchlistTickers) tickers.add(item.id_stock);
    for (const item of portfolioTickers) tickers.add(item.id_stock);

    const quotes = await fetchQuotesForTickers([...tickers]);

    // Allinea sempre il prezzo corrente su stock quando interroghiamo Finnhub.
    await syncCurrentStockPrices(quotes);

    let executedOrders = 0;

    for (const order of pendingOrders) {
      const currentPrice = quotes.get(order.id_stock);
      if (!currentPrice || currentPrice <= 0) {
        await prisma.transazione.updateMany({
          where: {
            id_transazione: order.id_transazione,
            stato: 'Pending',
          },
          data: {
            stato: 'Aborted',
            approved_at: new Date(),
          },
        });
        continue;
      }

      const executionPrice = new Prisma.Decimal(currentPrice.toFixed(6));

      if (order.tipo === 'Buy') {
        if (!order.importo_investito) continue;

        const quantity = order.importo_investito.div(executionPrice);

        const buyResult = await prisma.transazione.updateMany({
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

        if (buyResult.count > 0) {
          executedOrders += 1;
        }

        continue;
      }

      if (!order.quantita_azioni) continue;

      const sellResult = await prisma.transazione.updateMany({
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

      if (sellResult.count > 0) {
        executedOrders += 1;
      }
    }

    return {
      status: 'processed',
      totalPendingOrders: pendingOrders.length,
      executedOrders,
    };
  } catch (error) {
    console.error('[jobs] Errore trading engine:', error);
    throw error;
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

import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { fetchQuotesForTickers } from '../services/finnhub';

type SnapshotPortfolio = {
  id_portafoglio: number;
  id_persona: number;
  id_gruppo: number | null;
  liquidita: Prisma.Decimal;
  azioni_possedute: Array<{
    id_stock: string;
    numero: Prisma.Decimal;
  }>;
};

type SnapshotPending = {
  id_portafoglio: number;
  id_stock: string;
  tipo: 'Buy' | 'Sell';
  importo_investito: Prisma.Decimal | null;
  quantita_azioni: Prisma.Decimal | null;
};

const DAILY_RUN_HOUR = 8;
let isValuationRunning = false;

function getNextRunAt(now = new Date()): Date {
  const next = new Date(now);
  next.setHours(DAILY_RUN_HOUR, 0, 0, 0);

  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }

  return next;
}

function startOfLocalDay(input: Date): Date {
  const day = new Date(input);
  day.setHours(0, 0, 0, 0);
  return day;
}

async function readSnapshot(client: PrismaClient): Promise<{
  portfolios: SnapshotPortfolio[];
  pendingOrders: SnapshotPending[];
}> {
  return client.$transaction(async (tx) => {
    const [portfolios, pendingOrders] = await Promise.all([
      tx.portafoglio.findMany({
        select: {
          id_portafoglio: true,
          id_persona: true,
          id_gruppo: true,
          liquidita: true,
          azioni_possedute: {
            select: {
              id_stock: true,
              numero: true,
            },
          },
        },
      }),
      tx.transazione.findMany({
        where: { stato: 'Pending' },
        select: {
          id_portafoglio: true,
          id_stock: true,
          tipo: true,
          importo_investito: true,
          quantita_azioni: true,
        },
      }),
    ]);

    return {
      portfolios: portfolios as SnapshotPortfolio[],
      pendingOrders: pendingOrders as SnapshotPending[],
    };
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
  });
}

function buildTickerSet(
  portfolios: SnapshotPortfolio[],
  pendingOrders: SnapshotPending[],
): string[] {
  const tickers = new Set<string>();

  for (const portfolio of portfolios) {
    for (const holding of portfolio.azioni_possedute) {
      tickers.add(holding.id_stock);
    }
  }

  for (const order of pendingOrders) {
    tickers.add(order.id_stock);
  }

  return [...tickers];
}

function computePortfolioTotal(
  portfolio: SnapshotPortfolio,
  pendingForPortfolio: SnapshotPending[],
  quotes: Map<string, number>,
): Prisma.Decimal {
  let total = new Prisma.Decimal(portfolio.liquidita);

  for (const holding of portfolio.azioni_possedute) {
    const price = quotes.get(holding.id_stock);
    if (!price || price <= 0) continue;

    const unitPrice = new Prisma.Decimal(price.toFixed(6));
    total = total.add(holding.numero.mul(unitPrice));
  }

  for (const order of pendingForPortfolio) {
    if (order.tipo === 'Buy') {
      if (order.importo_investito) {
        // Buy pending: la liquidita e' gia stata scalata, quindi la riaggiungiamo per evitare gap temporanei.
        total = total.add(order.importo_investito);
      }
      continue;
    }

    if (!order.quantita_azioni) continue;

    // Sell pending: le azioni sono gia state scalate, quindi aggiungiamo il controvalore corrente stimato.
    const price = quotes.get(order.id_stock);
    if (!price || price <= 0) continue;

    const unitPrice = new Prisma.Decimal(price.toFixed(6));
    total = total.add(order.quantita_azioni.mul(unitPrice));
  }

  return new Prisma.Decimal(total.toFixed(2));
}

export async function runPortfolioValuationJobOnce(): Promise<void> {
  if (isValuationRunning) {
    console.log('[jobs] Portfolio valuation gia in esecuzione, skip.');
    return;
  }

  isValuationRunning = true;

  try {
    const startedAt = new Date();
    console.log(`[jobs] Portfolio valuation avviata alle ${startedAt.toISOString()}`);

    // Snapshot unico iniziale: eventuali transazioni eseguite durante il calcolo non vengono considerate.
    const { portfolios, pendingOrders } = await readSnapshot(prisma as PrismaClient);
    if (portfolios.length === 0) {
      console.log('[jobs] Nessun portafoglio trovato, fine valuation.');
      return;
    }

    // Richiesta quotazioni una sola volta per tutti i ticker coinvolti.
    const tickers = buildTickerSet(portfolios, pendingOrders);
    const quotes = tickers.length > 0
      ? await fetchQuotesForTickers(tickers)
      : new Map<string, number>();

    const pendingByPortfolio = new Map<number, SnapshotPending[]>();
    for (const order of pendingOrders) {
      const list = pendingByPortfolio.get(order.id_portafoglio) ?? [];
      list.push(order);
      pendingByPortfolio.set(order.id_portafoglio, list);
    }

    const snapshotDay = startOfLocalDay(startedAt);
    const rows = portfolios.map((portfolio) => {
      const pendingForPortfolio = pendingByPortfolio.get(portfolio.id_portafoglio) ?? [];
      const valoreTotale = computePortfolioTotal(portfolio, pendingForPortfolio, quotes);

      return {
        data: snapshotDay,
        valore_totale: valoreTotale,
        id_persona: portfolio.id_persona,
        id_gruppo: portfolio.id_gruppo,
      };
    });

    await prisma.storico_Portafoglio.createMany({
      data: rows,
    });

    console.log(`[jobs] Portfolio valuation completata: ${rows.length} snapshot salvati.`);
  } catch (error) {
    console.error('[jobs] Errore portfolio valuation:', error);
  } finally {
    isValuationRunning = false;
  }
}

export function startDailyPortfolioValuationJob(): void {
  const scheduleNextRun = () => {
    const now = new Date();
    const nextRun = getNextRunAt(now);
    const delayMs = Math.max(nextRun.getTime() - now.getTime(), 0);

    console.log(`[jobs] Portfolio valuation schedulata alle ${nextRun.toISOString()}`);

    setTimeout(() => {
      void runPortfolioValuationJobOnce().finally(scheduleNextRun);
    }, delayMs);
  };

  scheduleNextRun();
}

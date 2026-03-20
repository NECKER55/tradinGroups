import { Prisma } from '@prisma/client';
import { Request, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AuthRequest } from '../types';

// --- SCHEMI DI VALIDAZIONE ---
const CreateOrderSchema = z.object({
  id_portafoglio: z.number().int().positive(),
  id_stock: z.string().trim().toUpperCase().min(1).max(10),
  tipo: z.enum(['Buy', 'Sell']),
  importo_investito: z.union([z.number(), z.string()]).optional(),
  quantita_azioni: z.union([z.number(), z.string()]).optional(),
}).superRefine((data, ctx) => {
  if (data.tipo === 'Buy') {
    const val = String(data.importo_investito ?? '').trim();
    if (!/^\d+(\.\d{1,2})?$/.test(val) || new Prisma.Decimal(val).lte(0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['importo_investito'], message: 'Importo Buy non valido.' });
    }
  }
  if (data.tipo === 'Sell') {
    const val = String(data.quantita_azioni ?? '').trim();
    if (!/^\d+(\.\d{1,6})?$/.test(val) || new Prisma.Decimal(val).lte(0)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['quantita_azioni'], message: 'Quantità Sell non valida.' });
    }
  }
});

const PENDING_PRICE = new Prisma.Decimal(0);

// Helper per trasformare i Decimal in Stringhe per il JSON
function serializeTransaction(t: any) {
  return {
    ...t,
    importo_investito: t.importo_investito?.toString() ?? null,
    prezzo_esecuzione: t.prezzo_esecuzione.toString(),
    quantita_azioni: t.quantita_azioni?.toString() ?? null,
  };
}

// --- CONTROLLER 1: CREAZIONE ORDINE (UNIFICATO BUY/SELL) ---
export async function createOrder(req: Request, res: Response): Promise<void> {
  const parsed = CreateOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'VALIDATION_ERROR', message: parsed.error.errors[0].message });
    return;
  }

  const { sub } = (req as AuthRequest).user;
  const { id_portafoglio, id_stock, tipo } = parsed.data;

  // Verifica proprietà portafoglio ed esistenza stock
  const [stock, portfolio] = await Promise.all([
    prisma.stock.findUnique({ where: { id_stock } }),
    prisma.portafoglio.findFirst({ where: { id_portafoglio, id_persona: sub } }),
  ]);

  if (!stock || !portfolio) {
    res.status(404).json({ error: 'NOT_FOUND', message: 'Stock o Portafoglio non validi.' });
    return;
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      if (tipo === 'Buy') {
        const importo = new Prisma.Decimal(String(parsed.data.importo_investito));
        const updated = await tx.portafoglio.updateMany({
          where: { id_portafoglio, liquidita: { gte: importo } },
          data: { liquidita: { decrement: importo } },
        });
        if (updated.count === 0) throw new Error('INSUFFICIENT_FUNDS');

        return tx.transazione.create({
          data: { id_portafoglio, id_stock, tipo: 'Buy', importo_investito: importo, stato: 'Pending', prezzo_esecuzione: PENDING_PRICE },
        });
      } else {
        const qta = new Prisma.Decimal(String(parsed.data.quantita_azioni));
        const holding = await tx.azioni_in_possesso.findUnique({ where: { id_portafoglio_id_stock: { id_portafoglio, id_stock } } });
        
        if (!holding || holding.numero.lt(qta)) throw new Error('INSUFFICIENT_SHARES');

        await tx.azioni_in_possesso.update({
          where: { id_portafoglio_id_stock: { id_portafoglio, id_stock } },
          data: { numero: { decrement: qta } }
        });

        await tx.azioni_in_possesso.deleteMany({ where: { id_portafoglio, id_stock, numero: { lte: 0 } } });

        return tx.transazione.create({
          data: { id_portafoglio, id_stock, tipo: 'Sell', stato: 'Pending', quantita_azioni: qta, prezzo_esecuzione: holding.prezzo_medio_acquisto },
        });
      }
    });

    res.status(201).json({ message: 'Ordine creato con successo', transaction: serializeTransaction(result) });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
}

// --- CONTROLLER 2: CANCELLAZIONE ORDINE ---
export async function cancelPendingOrder(req: Request, res: Response): Promise<void> {
  const { sub } = (req as AuthRequest).user;
  const orderId = Number.parseInt(req.params.id_transazione, 10);

  if (isNaN(orderId)) {
    res.status(400).json({ error: 'INVALID_ID' });
    return;
  }

  const order = await prisma.transazione.findFirst({
    where: { id_transazione: orderId, portafoglio: { id_persona: sub } },
  });

  if (!order) {
    res.status(404).json({ error: 'ORDER_NOT_FOUND' });
    return;
  }

  if (order.stato !== 'Pending') {
    res.status(409).json({ error: 'ORDER_NOT_PENDING', message: 'L\'ordine è già stato eseguito o annullato.' });
    return;
  }

  try {
    await prisma.$transaction(async (tx) => {
      const deleted = await tx.transazione.deleteMany({
        where: { id_transazione: orderId, stato: 'Pending' }
      });

      if (deleted.count === 0) throw new Error('ALREADY_PROCESSED');

      if (order.tipo === 'Buy') {
        await tx.portafoglio.update({
          where: { id_portafoglio: order.id_portafoglio },
          data: { liquidita: { increment: order.importo_investito! } }
        });
      } else {
        const existing = await tx.azioni_in_possesso.findUnique({
          where: { id_portafoglio_id_stock: { id_portafoglio: order.id_portafoglio, id_stock: order.id_stock } }
        });

        if (!existing) {
          await tx.azioni_in_possesso.create({
            data: { id_portafoglio: order.id_portafoglio, id_stock: order.id_stock, numero: order.quantita_azioni!, prezzo_medio_acquisto: order.prezzo_esecuzione }
          });
        } else {
          const newNum = existing.numero.add(order.quantita_azioni!);
          const newAvg = (existing.numero.mul(existing.prezzo_medio_acquisto).add(order.quantita_azioni!.mul(order.prezzo_esecuzione))).div(newNum);
          await tx.azioni_in_possesso.update({
            where: { id_portafoglio_id_stock: { id_portafoglio: order.id_portafoglio, id_stock: order.id_stock } },
            data: { numero: newNum, prezzo_medio_acquisto: newAvg }
          });
        }
      }
    });

    res.json({ message: 'Ordine annullato e fondi/azioni ripristinati.' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
}
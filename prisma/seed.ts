// prisma/seed.ts
// Popola il DB con dati di esempio per sviluppo/test.
// Esegui con: npx prisma db seed

import { PrismaClient, RuoloGruppo, GruppoPrivacy, TransazioneTipo, TransazioneStato } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Avvio seed...');

  // ── Stock ──────────────────────────────────────────────
  await prisma.stock.createMany({
    data: [
      { id_stock: 'AAPL',  nome_societa: 'Apple Inc.',           settore: 'Technology' },
      { id_stock: 'TSLA',  nome_societa: 'Tesla Inc.',            settore: 'Automotive' },
      { id_stock: 'MSFT',  nome_societa: 'Microsoft Corporation', settore: 'Technology' },
      { id_stock: 'AMZN',  nome_societa: 'Amazon.com Inc.',       settore: 'E-Commerce' },
      { id_stock: 'GOOGL', nome_societa: 'Alphabet Inc.',         settore: 'Technology' },
    ],
    skipDuplicates: true,
  });

  // ── Persone ────────────────────────────────────────────
  const hash = (pw: string) => bcrypt.hashSync(pw, 10);

  const alice = await prisma.persona.upsert({
    where: { username: 'alice' },
    update: {},
    create: {
      username: 'alice',
      photo_url: 'https://i.pravatar.cc/150?u=alice',
      credenziali: {
        create: { email: 'alice@example.com', password: hash('Alice123!') },
      },
      portafogli: {
        create: { liquidita: 10000 }, // portafoglio personale (id_gruppo null)
      },
    },
  });

  const bob = await prisma.persona.upsert({
    where: { username: 'bob' },
    update: {},
    create: {
      username: 'bob',
      photo_url: 'https://i.pravatar.cc/150?u=bob',
      credenziali: {
        create: { email: 'bob@example.com', password: hash('Bob123!') },
      },
      portafogli: {
        create: { liquidita: 5000 },
      },
    },
  });

  const charlie = await prisma.persona.upsert({
    where: { username: 'charlie' },
    update: {},
    create: {
      username: 'charlie',
      photo_url: 'https://i.pravatar.cc/150?u=charlie',
      credenziali: {
        create: { email: 'charlie@example.com', password: hash('Charlie123!') },
      },
      portafogli: {
        create: { liquidita: 8000 },
      },
    },
  });

  // ── Amicizia alice ↔ bob ───────────────────────────────
  await prisma.amicizia.upsert({
    where: { id_persona_1_id_persona_2: { id_persona_1: alice.id_persona, id_persona_2: bob.id_persona } },
    update: {},
    create: {
      id_persona_1: alice.id_persona,
      id_persona_2: bob.id_persona,
      status: 'Accepted',
    },
  });

  // ── Gruppo ─────────────────────────────────────────────
  const gruppo = await prisma.gruppo.upsert({
    where: { nome: 'Investitori Tech' },
    update: {},
    create: {
      nome: 'Investitori Tech',
      privacy: GruppoPrivacy.Public,
      photo_url: 'https://i.pravatar.cc/150?u=investitori-tech',
    },
  });

  // ── Membro Gruppo (il trigger creerà i portafogli) ─────
  // NOTA: in seed usiamo createMany, i trigger SQL scattano sul DB
  await prisma.membro_Gruppo.upsert({
    where: { id_persona_id_gruppo: { id_persona: alice.id_persona, id_gruppo: gruppo.id_gruppo } },
    update: {},
    create: {
      id_persona: alice.id_persona,
      id_gruppo:  gruppo.id_gruppo,
      ruolo:      RuoloGruppo.Owner,
      budget_iniziale: 5000,
    },
  });

  await prisma.membro_Gruppo.upsert({
    where: { id_persona_id_gruppo: { id_persona: bob.id_persona, id_gruppo: gruppo.id_gruppo } },
    update: {},
    create: {
      id_persona: bob.id_persona,
      id_gruppo:  gruppo.id_gruppo,
      ruolo:      RuoloGruppo.User,
      budget_iniziale: 3000,
    },
  });

  // ── Watchlist ──────────────────────────────────────────
  await prisma.watchlist.createMany({
    data: [
      { id_persona: alice.id_persona, id_stock: 'AAPL' },
      { id_persona: alice.id_persona, id_stock: 'TSLA' },
      { id_persona: bob.id_persona,   id_stock: 'MSFT' },
    ],
    skipDuplicates: true,
  });

  // ── Transazione esempio (portafoglio personale alice) ──
  const portafoglioAlice = await prisma.portafoglio.findFirst({
    where: { id_persona: alice.id_persona, id_gruppo: null },
  });

  if (portafoglioAlice) {
    await prisma.transazione.create({
      data: {
        id_stock:          'AAPL',
        id_portafoglio:    portafoglioAlice.id_portafoglio,
        tipo:              TransazioneTipo.Buy,
        importo_investito: 1000,
        stato:             TransazioneStato.Executed,
        prezzo_esecuzione: 175.50,
        quantita_azioni:   5.698,
        data_ora:          new Date('2024-01-15T10:30:00Z'),
      },
    });
  }

  console.log('✅ Seed completato!');
}

main()
  .catch((e) => {
    console.error('❌ Errore seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
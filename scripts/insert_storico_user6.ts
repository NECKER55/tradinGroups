import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const id_persona = 6;
  const rows: Array<{ data: Date; valore_totale: string; id_persona: number; id_gruppo: number | null }> = [];
  const today = new Date();

  for (let i = 0; i < 100; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    d.setHours(0, 0, 0, 0);

    // Generate a plausible portfolio total with small random variation
    const base = 10000;
    const delta = i * 42; // progressive trend
    const jitter = Math.round((Math.random() - 0.5) * 200); // +/-100
    const valore = base + delta + jitter;

    rows.push({
      data: d,
      valore_totale: valore.toFixed(2),
      id_persona,
      id_gruppo: null,
    });
  }

  console.log(`Inserting ${rows.length} storico_portafoglio rows for id_persona=${6}...`);

  const result = await prisma.storico_Portafoglio.createMany({ data: rows });
  console.log('Inserted:', result.count);

  const total = await prisma.storico_Portafoglio.count({ where: { id_persona } });
  console.log(`Total snapshots for person ${id_persona}:`, total);

  const samples = await prisma.storico_Portafoglio.findMany({ where: { id_persona }, orderBy: { data: 'desc' }, take: 5 });
  console.log('Latest 5 snapshots:');
  for (const s of samples) {
    console.log(s.data?.toISOString().slice(0, 10), s.valore_totale.toString());
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  prisma.$disconnect().finally(() => process.exit(1));
});

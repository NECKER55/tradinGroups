"use strict";
// prisma/seed.ts
// Popola il DB con dati di esempio per sviluppo/test.
// Esegui con: npx prisma db seed
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('🌱 Avvio seed...');
    // ── Stock ──────────────────────────────────────────────
    await prisma.stock.createMany({
        data: [
            { id_stock: 'AAPL', nome_societa: 'Apple Inc.', settore: 'Technology' },
            { id_stock: 'TSLA', nome_societa: 'Tesla Inc.', settore: 'Automotive' },
            { id_stock: 'MSFT', nome_societa: 'Microsoft Corporation', settore: 'Technology' },
            { id_stock: 'AMZN', nome_societa: 'Amazon.com Inc.', settore: 'E-Commerce' },
            { id_stock: 'GOOGL', nome_societa: 'Alphabet Inc.', settore: 'Technology' },
        ],
        skipDuplicates: true,
    });
    // ── Persone ────────────────────────────────────────────
    const hash = (pw) => bcryptjs_1.default.hashSync(pw, 10);
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
            privacy: client_1.GruppoPrivacy.Public,
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
            id_gruppo: gruppo.id_gruppo,
            ruolo: client_1.RuoloGruppo.Owner,
            budget_iniziale: 5000,
        },
    });
    await prisma.membro_Gruppo.upsert({
        where: { id_persona_id_gruppo: { id_persona: bob.id_persona, id_gruppo: gruppo.id_gruppo } },
        update: {},
        create: {
            id_persona: bob.id_persona,
            id_gruppo: gruppo.id_gruppo,
            ruolo: client_1.RuoloGruppo.User,
            budget_iniziale: 3000,
        },
    });
    // ── Watchlist ──────────────────────────────────────────
    await prisma.watchlist.createMany({
        data: [
            { id_persona: alice.id_persona, id_stock: 'AAPL' },
            { id_persona: alice.id_persona, id_stock: 'TSLA' },
            { id_persona: bob.id_persona, id_stock: 'MSFT' },
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
                id_stock: 'AAPL',
                id_portafoglio: portafoglioAlice.id_portafoglio,
                tipo: client_1.TransazioneTipo.Buy,
                importo_investito: 1000,
                stato: client_1.TransazioneStato.Executed,
                prezzo_esecuzione: 175.50,
                quantita_azioni: 5.698,
                created_at: new Date('2024-01-15T10:30:00Z'),
                approved_at: new Date('2024-01-15T10:35:00Z'),
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

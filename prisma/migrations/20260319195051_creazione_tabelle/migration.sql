-- CreateEnum
CREATE TYPE "GruppoPrivacy" AS ENUM ('Public', 'Private');

-- CreateEnum
CREATE TYPE "AmiciziaStatus" AS ENUM ('Pending', 'Accepted');

-- CreateEnum
CREATE TYPE "RuoloGruppo" AS ENUM ('Owner', 'Admin', 'User', 'Guest', 'Spectator');

-- CreateEnum
CREATE TYPE "TransazioneTipo" AS ENUM ('Buy', 'Sell');

-- CreateEnum
CREATE TYPE "TransazioneStato" AS ENUM ('Pending', 'Executed');

-- CreateTable
CREATE TABLE "persona" (
    "id_persona" SERIAL NOT NULL,
    "username" VARCHAR(50) NOT NULL,
    "photo_url" VARCHAR(255),
    "is_banned" BOOLEAN NOT NULL DEFAULT false,
    "is_superuser" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "persona_pkey" PRIMARY KEY ("id_persona")
);

-- CreateTable
CREATE TABLE "credenziali" (
    "id_persona" INTEGER NOT NULL,
    "email" VARCHAR(100) NOT NULL,
    "password" VARCHAR(255) NOT NULL,

    CONSTRAINT "credenziali_pkey" PRIMARY KEY ("id_persona")
);

-- CreateTable
CREATE TABLE "gruppo" (
    "id_gruppo" SERIAL NOT NULL,
    "nome" VARCHAR(100) NOT NULL,
    "privacy" "GruppoPrivacy" NOT NULL,
    "photo_url" VARCHAR(255),

    CONSTRAINT "gruppo_pkey" PRIMARY KEY ("id_gruppo")
);

-- CreateTable
CREATE TABLE "stock" (
    "id_stock" VARCHAR(10) NOT NULL,
    "nome_societa" VARCHAR(150) NOT NULL,
    "settore" VARCHAR(50) NOT NULL,

    CONSTRAINT "stock_pkey" PRIMARY KEY ("id_stock")
);

-- CreateTable
CREATE TABLE "portafoglio" (
    "id_portafoglio" SERIAL NOT NULL,
    "liquidita" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "id_persona" INTEGER NOT NULL,
    "id_gruppo" INTEGER,

    CONSTRAINT "portafoglio_pkey" PRIMARY KEY ("id_portafoglio")
);

-- CreateTable
CREATE TABLE "storico_portafoglio" (
    "id_snapshot" SERIAL NOT NULL,
    "data" DATE NOT NULL,
    "valore_totale" DECIMAL(18,2) NOT NULL,
    "id_persona" INTEGER NOT NULL,
    "id_gruppo" INTEGER,

    CONSTRAINT "storico_portafoglio_pkey" PRIMARY KEY ("id_snapshot")
);

-- CreateTable
CREATE TABLE "amicizia" (
    "id_persona_1" INTEGER NOT NULL,
    "id_persona_2" INTEGER NOT NULL,
    "status" "AmiciziaStatus" NOT NULL,
    "user_block" INTEGER,
    "data_inizio" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "amicizia_pkey" PRIMARY KEY ("id_persona_1","id_persona_2")
);

-- CreateTable
CREATE TABLE "membro_gruppo" (
    "id_persona" INTEGER NOT NULL,
    "id_gruppo" INTEGER NOT NULL,
    "budget_iniziale" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "ruolo" "RuoloGruppo" NOT NULL,

    CONSTRAINT "membro_gruppo_pkey" PRIMARY KEY ("id_persona","id_gruppo")
);

-- CreateTable
CREATE TABLE "invito_gruppo" (
    "id_invitato" INTEGER NOT NULL,
    "id_mittente" INTEGER NOT NULL,
    "id_gruppo" INTEGER NOT NULL,
    "data_invito" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invito_gruppo_pkey" PRIMARY KEY ("id_invitato","id_mittente","id_gruppo")
);

-- CreateTable
CREATE TABLE "transazione" (
    "id_transazione" SERIAL NOT NULL,
    "id_stock" VARCHAR(10) NOT NULL,
    "id_portafoglio" INTEGER NOT NULL,
    "tipo" "TransazioneTipo" NOT NULL,
    "importo_investito" DECIMAL(18,2),
    "stato" "TransazioneStato" NOT NULL DEFAULT 'Pending',
    "prezzo_esecuzione" DECIMAL(18,6) NOT NULL,
    "quantita_azioni" DECIMAL(18,6),
    "data_ora" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transazione_pkey" PRIMARY KEY ("id_transazione")
);

-- CreateTable
CREATE TABLE "watchlist" (
    "id_persona" INTEGER NOT NULL,
    "id_stock" VARCHAR(10) NOT NULL,

    CONSTRAINT "watchlist_pkey" PRIMARY KEY ("id_persona","id_stock")
);

-- CreateTable
CREATE TABLE "azioni_in_possesso" (
    "id_portafoglio" INTEGER NOT NULL,
    "id_stock" VARCHAR(10) NOT NULL,
    "prezzo_medio_acquisto" DECIMAL(18,2) NOT NULL,
    "numero" DECIMAL(18,6) NOT NULL,

    CONSTRAINT "azioni_in_possesso_pkey" PRIMARY KEY ("id_portafoglio","id_stock")
);

-- CreateIndex
CREATE UNIQUE INDEX "persona_username_key" ON "persona"("username");

-- CreateIndex
CREATE UNIQUE INDEX "credenziali_email_key" ON "credenziali"("email");

-- CreateIndex
CREATE UNIQUE INDEX "gruppo_nome_key" ON "gruppo"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "portafoglio_id_persona_id_gruppo_key" ON "portafoglio"("id_persona", "id_gruppo");

-- AddForeignKey
ALTER TABLE "credenziali" ADD CONSTRAINT "credenziali_id_persona_fkey" FOREIGN KEY ("id_persona") REFERENCES "persona"("id_persona") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portafoglio" ADD CONSTRAINT "portafoglio_id_persona_fkey" FOREIGN KEY ("id_persona") REFERENCES "persona"("id_persona") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portafoglio" ADD CONSTRAINT "portafoglio_id_gruppo_fkey" FOREIGN KEY ("id_gruppo") REFERENCES "gruppo"("id_gruppo") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storico_portafoglio" ADD CONSTRAINT "storico_portafoglio_id_persona_fkey" FOREIGN KEY ("id_persona") REFERENCES "persona"("id_persona") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storico_portafoglio" ADD CONSTRAINT "storico_portafoglio_id_gruppo_fkey" FOREIGN KEY ("id_gruppo") REFERENCES "gruppo"("id_gruppo") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "amicizia" ADD CONSTRAINT "amicizia_id_persona_1_fkey" FOREIGN KEY ("id_persona_1") REFERENCES "persona"("id_persona") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "amicizia" ADD CONSTRAINT "amicizia_id_persona_2_fkey" FOREIGN KEY ("id_persona_2") REFERENCES "persona"("id_persona") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "amicizia" ADD CONSTRAINT "amicizia_user_block_fkey" FOREIGN KEY ("user_block") REFERENCES "persona"("id_persona") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membro_gruppo" ADD CONSTRAINT "membro_gruppo_id_persona_fkey" FOREIGN KEY ("id_persona") REFERENCES "persona"("id_persona") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "membro_gruppo" ADD CONSTRAINT "membro_gruppo_id_gruppo_fkey" FOREIGN KEY ("id_gruppo") REFERENCES "gruppo"("id_gruppo") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invito_gruppo" ADD CONSTRAINT "invito_gruppo_id_invitato_fkey" FOREIGN KEY ("id_invitato") REFERENCES "persona"("id_persona") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invito_gruppo" ADD CONSTRAINT "invito_gruppo_id_mittente_fkey" FOREIGN KEY ("id_mittente") REFERENCES "persona"("id_persona") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invito_gruppo" ADD CONSTRAINT "invito_gruppo_id_gruppo_fkey" FOREIGN KEY ("id_gruppo") REFERENCES "gruppo"("id_gruppo") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transazione" ADD CONSTRAINT "transazione_id_stock_fkey" FOREIGN KEY ("id_stock") REFERENCES "stock"("id_stock") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transazione" ADD CONSTRAINT "transazione_id_portafoglio_fkey" FOREIGN KEY ("id_portafoglio") REFERENCES "portafoglio"("id_portafoglio") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watchlist" ADD CONSTRAINT "watchlist_id_persona_fkey" FOREIGN KEY ("id_persona") REFERENCES "persona"("id_persona") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "watchlist" ADD CONSTRAINT "watchlist_id_stock_fkey" FOREIGN KEY ("id_stock") REFERENCES "stock"("id_stock") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "azioni_in_possesso" ADD CONSTRAINT "azioni_in_possesso_id_portafoglio_fkey" FOREIGN KEY ("id_portafoglio") REFERENCES "portafoglio"("id_portafoglio") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "azioni_in_possesso" ADD CONSTRAINT "azioni_in_possesso_id_stock_fkey" FOREIGN KEY ("id_stock") REFERENCES "stock"("id_stock") ON DELETE CASCADE ON UPDATE CASCADE;

# 🛠️ FinApp: Documentazione dell'Ecosistema e Setup

In un progetto professionale, i file di configurazione sono il "libretto d'istruzioni" dell'intero ecosistema. Di seguito è analizzata la nostra cassetta degli attrezzi.

---

## 1. Il file `.env` (Environment Variables)
**Il "Libretto delle Password"**
Contiene variabili che cambiano a seconda dell'ambiente (Locale, Staging, Production).

* **A cosa serve:** Impedisce di scrivere dati sensibili direttamente nel codice sorgente.
* **Sicurezza:** Viene ignorato da Git (tramite `.gitignore`) per evitare che le credenziali finiscano online.
* **La riga magica:** `DATABASE_URL` fornisce a Prisma l'indirizzo IP, l'utente e la password per accedere al database.

---

## 2. Il file `package.json`
**Il "Certificato di Nascita e Manuale"**
Descrive l'identità del progetto e le sue dipendenze.

* **dependencies:** L'elenco dei pacchetti necessari per il funzionamento dell'app.
* **scripts:** Alias (soprannomi) per comandi complessi. 
    * *Esempio:* `npm run db:setup` esegue una sequenza di comandi SQL e Prisma in un colpo solo.

---

## 3. Comandi Utilizzati: Cosa succede dietro le quinte?

| Comando | Azione nel "Mondo Reale" |
| :--- | :--- |
| `npm install` | Legge il `package.json` e scarica le librerie nella cartella `node_modules`. |
| `sudo -u postgres psql...` | Agisce come "Amministratore" per creare il Database e assegnare i permessi all'utente. |
| `npx prisma migrate dev` | Traduce lo schema `.prisma` in tabelle SQL fisiche nel database. |
| `npx prisma generate` | Crea il **Prisma Client**, un "traduttore" che permette a TypeScript di suggerirti i nomi delle tabelle mentre scrivi. |
| `npm run db:setup` | Lancia in sequenza: creazione tabelle, iniezione dei Trigger (automatismi) e Seed (dati iniziali). |

---

## 4. Il file `schema.prisma`
**L' "Architetto"**
È il cuore del Data Layer. Definisce la struttura dei dati (es. *Un Utente ha un'email e un Wallet*) in un linguaggio leggibile, superiore al SQL puro.



---

## 5. Il "Giro del Fumo" (Workflow)

1.  **Schema (.prisma):** Tu definisci la struttura.
2.  **Migrate:** Trasforma la definizione in tabelle reali.
3.  **Trigger (.sql):** Aggiungono "intelligenza" (es. aggiornamento automatico del saldo).
4.  **Seed:** Riempie le tabelle con dati di test.
5.  **Codice:** Usa il Client e le credenziali del `.env` per dialogare con i dati.

> **Nota Tecnica: `npm` vs `npx`**
> * **npm:** Si usa per **installare** i pacchetti.
> * **npx:** Si usa per **eseguire** un pacchetto (come Prisma) senza installarlo globalmente, mantenendo il sistema pulito.

---
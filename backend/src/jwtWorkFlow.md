# 🚀 Documentazione Backend: Architettura e Autenticazione Professional

Questa documentazione spiega il funzionamento del sistema di autenticazione e la struttura del server Node.js/Express, analizzando ogni componente dal cuore del database fino alla sicurezza del server.

---

## 1. Fondamentali di Sintassi (Modern JS/TS)

Prima di analizzare il codice, ecco i pilastri sintattici utilizzati:

* **`const` & `let`**: Gestione moderna delle variabili. `const` per valori immutabili (default), `let` per valori che cambiano.
* **Destrutturazione (`const { a, b } = obj`)**: Estrae proprietà da un oggetto in modo rapido. Usato massicciamente per estrarre dati da `req.body` o configurazioni.
* **`process.env`**: Accesso alle variabili d'ambiente (definite nel file `.env`). Fondamentale per non esporre chiavi segrete (JWT_SECRET, DATABASE_URL) nel codice sorgente.

---

## 2. Il Cuore dei Dati: Prisma ORM (`src/lib/prisma.ts`)

Il file `prisma.ts` implementa il **Singleton Pattern**.
* **Perché**: In sviluppo (Hot Reload), Node riavvia il codice spesso. Senza questo file, ogni riavvio creerebbe una nuova connessione al DB, esaurendole in pochi minuti.
* **Funzionamento**: Salva l'istanza di Prisma nell'oggetto `globalThis`. Se esiste già, la riusa; altrimenti ne crea una nuova.

---

## 3. Sistema di Autenticazione (JWT & Cookies)

Il sistema utilizza una strategia **Double Token** per bilanciare sicurezza e UX.

### Access Token vs Refresh Token
| Tipo | Dove risiede | Scopo | Sicurezza |
| :--- | :--- | :--- | :--- |
| **Access Token** | Memoria Frontend (JS) | Autorizza le chiamate API (es. `/me`) | Breve durata (es. 15 min) |
| **Refresh Token**| **Cookie HttpOnly** | Genera nuovi Access Token | Lunga durata (7 giorni) + Blindato contro XSS |

### Utility di Invio (`setRefreshCookie`)
Questa funzione configura il cookie del Refresh Token con parametri di sicurezza bancaria:
* **`httpOnly: true`**: Rende il cookie invisibile ai malware JavaScript.
* **`secure`**: Viene inviato solo su HTTPS.
* **`sameSite: 'strict'`**: Impedisce attacchi di tipo CSRF (richieste da altri siti).
* **`path: '/api/auth/refresh'`**: Il browser invia questo cookie solo se la richiesta viene da questa rotta (garantisce che non venga sempre inviato).

---

## 4. Tipi e Interfacce (`src/types/index.ts`)

L'uso di TypeScript garantisce che i dati siano coerenti in tutta l'app.
* **`JwtPayload`**: Definisce cosa c'è dentro il token (ID utente, username, permessi).
* **`AuthRequest`**: Estende la richiesta standard di Express per includere l'oggetto `user` dopo che il middleware ha verificato il token.
* **`ApiError`**: Standardizza le risposte di errore per il frontend.



---

## 5. Middleware: Il "Buttafuori" (`src/middleware/auth.ts`)

serve nel momento in cui un utente ha gia fatto register o login, per verificare chi sia.
Il middleware `authenticate` agisce come un filtro:
1.  Controlla l'header `Authorization: Bearer <token>`.
2.  Verifica la validità del token.
3.  Se valido, inietta i dati dell'utente in `req.user` e chiama `next()`.
4.  Se non valido, risponde con `401 Unauthorized`.

---

## 6. Logica di Business (`src/controllers/auth.controller.ts`)

serve per creare un utente con register o loggare un utente (la diff con quello prima è che qui ti logghi, in auth ad ogni operazione verifichi chi sia).
Qui risiede l'intelligenza dell'app:
* **Validazione (Zod)**: Prima di parlare col DB, controlla che i dati siano nel formato corretto.
* **Hashing (Bcrypt)**: Le password non sono mai salvate in chiaro, ma trasformate in hash protetti.
* **Transazioni Prisma**: Durante la registrazione, l'utente e il suo portafoglio vengono creati insieme: o entrambi o nessuno (integrità dei dati).

---

## 7. Il Centralino delle Rotte (`src/routes/`)

Il sistema è diviso in router modulari per una manutenzione semplice.
* **`auth.routes.ts`**: Espone i percorsi `/login`, `/register`, `/logout`, ecc.
* **`index.ts` (Router globale)**: Raggruppa tutti i router sotto il prefisso `/api` e li passa a `/auth` quindi a auth.routes.ts.



---

## 8. Il Server Principale (`src/server.ts`)

Il file finale dove tutto viene assemblato. Include middleware di sicurezza avanzati:
* **`helmet()`**: Protegge il server da vulnerabilità comuni impostando vari header HTTP.
* **`cors()`**: Configurato con `credentials: true` per permettere lo scambio del Refresh Token.
* **`rateLimit()`**: Protegge da attacchi Brute Force (es. massimo 10 tentativi di login ogni 15 minuti).
* **`cookieParser()`**: Necessario per leggere il Refresh Token dai cookie della richiesta.
* **`errorHandler`**: Un unico punto centralizzato per gestire tutti i crash dell'app in modo pulito.

in questo file si indirizza creando mano a mano le rotte. 
es: 
import router from './routes'; 
app.use('/api', router); // se una chiamata inizia con /api inviala alla cartella /routes (dove poi vengono messi gli altri pezzi)

---

### Flusso di una Richiesta Tipica
1.  **Client** invia richiesta a `/api/auth/me`.
2.  **Server (`server.ts`)** riceve e passa a **Router (`routes/index.ts`)**.
3.  **Router** passa a **AuthRouter (`auth.routes.ts`)**.
4.  **Middleware (`auth.ts`)** controlla il token:
    - Se OK: Inject `req.user` e passa avanti.
    - Se NO: Ritorna 401.
5.  **Controller (`auth.controller.ts`)** recupera i dati dal DB tramite **Prisma** e risponde al Client.
# Documentazione dei file frontend

Questo file descrive il percorso e la funzionalità di ogni file principale presente nella cartella `frontend`.

## Root del progetto frontend

- **frontend/tailwind.config.js**: Configurazione di Tailwind CSS (temi, percorsi di scansione dei file).
- **frontend/postcss.config.js**: Configurazione PostCSS per Tailwind/autoprefixer.
- **frontend/tsconfig.json**: Configurazione TypeScript del progetto frontend.
- **frontend/tsconfig.app.json**: Config TypeScript specifico per l'app (se presente).
- **frontend/tsconfig.node.json**: Config TypeScript per ambienti node (build/strumenti).
- **frontend/.env.example**: Esempio di variabili d'ambiente usate dal frontend (es. API base URL).
- **frontend/vite.config.ts**: Configurazione di Vite (dev server, alias, build).
- **frontend/package.json**: Dipendenze, script (dev/build/test) e metadati del frontend.
- **frontend/package-lock.json**: Lockfile delle dipendenze npm.
- **frontend/.gitignore**: File di esclusione Git.
- **frontend/README.md**: Documentazione locale del progetto frontend.
- **frontend/eslint.config.js**: Configurazione ESLint del progetto.
- **frontend/index.html**: Entry HTML per l'app Vite (font, root div, meta).
- **frontend/public/vite.svg**: Asset statico nella cartella `public` (es. logo di esempio).

## Cartella `src`

- **frontend/src/main.tsx**: Entry point React; monta l'app e avvolge il router e il `AuthProvider`.
- **frontend/src/vite-env.d.ts**: Dichiarazioni tipi specifiche per Vite/ambienti.
- **frontend/src/styles/globals.css**: Stili globali dell'app (import Tailwind base/components/utilities e regole globali).
- **frontend/src/assets/react.svg**: Asset immagine SVG usato nell'app (es. logo di esempio).

### Config/Costanti condivise

- **frontend/src/shared/config/env.ts**: Costante `API_BASE_URL` e altre variabili di configurazione lato client.
- **frontend/src/shared/api/routes.ts**: Costanti centralizzate per le rotte API (`ROUTES.AUTH.*`, ecc.). Serve a evitare stringhe hardcoded.

### Layout e routing

- **frontend/src/shared/layout/MainLayout.tsx**: Layout principale dell'app (navbar, footer, wrapper per le pagine).
- **frontend/src/routes/ProtectedRoute.tsx**: Componente wrapper per rotte protette; redirige a `/login` se l'utente non è autenticato.
- **frontend/src/app/App.tsx**: Configurazione delle rotte dell'app (React Router), definizione delle pagine pubbliche e protette.

### Feature: Auth

- **frontend/src/features/auth/api/authApi.ts**: Client API per l'autenticazione; funzioni per login/register, gestione `access_token` in `sessionStorage`, chiamata a `/auth/refresh` (con `credentials: 'include'`), logica di refresh automatico su 401 e serializzazione delle richieste di refresh.
- **frontend/src/features/auth/context/AuthContext.tsx**: `AuthProvider` e hook `useAuth()` che forniscono stato utente, bootstrap all'avvio (hydrate token, tentativo di refresh e fetch di `/me`), metodi `login`, `register`, `logout` e gestione del redirect/clearing dello stato su logout.
- **frontend/src/features/auth/types/auth.ts**: Tipi TypeScript relativi all'autenticazione (es. `User`, `AuthResponse`, payload dei form).
- **frontend/src/features/auth/pages/LoginPage.tsx**: Pagina di login con form che usa `authApi`/`AuthContext` per autenticare.
- **frontend/src/features/auth/pages/RegisterPage.tsx**: Pagina di registrazione (form + chiamata API di register).

### Feature: Home

- **frontend/src/features/home/pages/HomePage.tsx**: Pagina principale pubblica (composizione delle sezioni Hero, Featured, WorkspacePreview).
- **frontend/src/features/home/components/HeroSection.tsx**: Sezione hero della home (call-to-action, titolo, descrizione).
- **frontend/src/features/home/components/FeaturedSquadsSection.tsx**: Sezione che mostra elementi in evidenza.
- **frontend/src/features/home/components/WorkspacePreviewSection.tsx**: Anteprima del workspace/dashboard (esempi di card, summary).

### Feature: Workspace

- **frontend/src/features/workspace/pages/WorkspacePage.tsx**: Pagina del workspace utente (area autenticata), contiene le viste principali dell'applicazione per l'utente loggato.

## Note funzionali e comportamentali

- Il `refresh_token` non è accessibile da JavaScript: il backend lo salva come cookie HttpOnly (`refresh_token`) e il frontend lo invia automaticamente usando `fetch(..., { credentials: 'include' })` quando richiama `ROUTES.AUTH.REFRESH`.
- L'`access_token` viene mantenuto in `sessionStorage` lato client (implementato in `authApi.ts`), così le singole finestre di browser non condividono lo stato dell'access token.
- Le rotte API sono centralizzate in `shared/api/routes.ts` per facilitare refactor e evitare stringhe hardcoded nel codice.
- La logica di refresh implementa una singola promise condivisa (`refreshPromise`) per serializzare tentativi di refresh concorrenti e prevenire ripetuti refresh simultanei.

## File non elencati (generici / di build)

- I file di configurazione (`package.json`, `vite.config.ts`, `tsconfig*.json`, `postcss.config.js`) definiscono come costruire e avviare l'app; non contengono logica di runtime dell'app.
- Gli asset nella cartella `public` sono serviti staticamente da Vite durante lo sviluppo e inclusi nella build di produzione.


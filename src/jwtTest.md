# finApp Backend - Stato Attuale

Questo README descrive cosa fa **oggi** il codice presente in `src/`, con focus su autenticazione `register/login/refresh/me/logout` basata su JWT.

## 1) Cosa e' gia' implementato

- Server Express con middleware di sicurezza (`helmet`, `cors`, rate limit, `cookie-parser`, logging).
- Endpoint healthcheck: `GET /health`.
- Routing API base: prefisso ` /api `.
- Modulo auth completo con endpoint:
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `POST /api/auth/refresh`
  - `POST /api/auth/logout`
  - `GET /api/auth/me` (protetto da Bearer token)
- JWT:
  - `access_token` restituito nel body JSON
  - `refresh_token` salvato in cookie HttpOnly
- Persistenza utenti via Prisma (`persona`, `credenziali`, `portafoglio` personale creato in registrazione).

## 2) Variabili ambiente necessarie

Nel file `.env` servono almeno:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/finapp?schema=public"
JWT_SECRET="access-secret"
JWT_REFRESH_SECRET="refresh-secret"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"
PORT="3000"
FRONTEND_URL="http://localhost:5173"
NODE_ENV="development"
ENABLE_CRON="false"
```

## 3) Flusso completo autenticazione (pratico)

1. **Registrazione** su `POST /api/auth/register`
2. Il backend crea utente + credenziali hashate + portafoglio personale
3. Il backend risponde con:
   - `access_token` nel JSON
   - cookie `refresh_token` (HttpOnly)
4. **Login** su `POST /api/auth/login` quando serve
5. Per chiamare endpoint protetti usa header:
   - `Authorization: Bearer <access_token>`
6. Se access token scade, chiama `POST /api/auth/refresh`:
   - usa il cookie `refresh_token`
   - ricevi nuovo `access_token`
7. `POST /api/auth/logout` cancella il cookie refresh

## 4) Endpoint dettagliati

### GET /health

- Scopo: verifica che il server sia vivo.
- Auth: no.

**Risposta 200**

```json
{
  "status": "ok",
  "timestamp": "2026-03-19T21:56:08.958Z"
}
```

---

### POST /api/auth/register

- Scopo: crea account e sessione iniziale.
- Auth: no.
- Body JSON richiesto:

```json
{
  "email": "test@example.com",
  "username": "testuser",
  "password": "password123",
  "confirm_password": "password123"
}
```

**Risposta 201**

```json
{
  "message": "Registrazione completata.",
  "access_token": "<jwt>",
  "user": {
    "id_persona": 1,
    "username": "testuser",
    "is_superuser": false
  }
}
```

Cookie settato: `refresh_token` (HttpOnly, path `/api/auth/refresh`).

**Possibili errori**

- `400 VALIDATION_ERROR`
  - `Email non valida.`
  - `La password deve avere almeno 8 caratteri.`
  - `Le password non corrispondono.`
- `409 EMAIL_IN_USE` -> `Email gia' in uso.`
- `409 USERNAME_IN_USE` -> `Nome utente gia' in uso.`
- `429 TOO_MANY_REQUESTS` (rate limit)

---

### POST /api/auth/login

- Scopo: autentica utente esistente.
- Auth: no.
- Body JSON richiesto:

```json
{
  "email": "test@example.com",
  "password": "password123"
}
```

**Risposta 200**

```json
{
  "access_token": "<jwt>",
  "user": {
    "id_persona": 1,
    "username": "testuser",
    "is_superuser": false
  }
}
```

Cookie settato: `refresh_token` (HttpOnly).

**Possibili errori**

- `400 VALIDATION_ERROR` -> `Email o password mancanti.`
- `401 INVALID_CREDENTIALS` -> `Credenziali non valide. Riprova.`
- `403 USER_BANNED` -> `Account sospeso. Contatta il supporto.`
- `429 TOO_MANY_REQUESTS` (rate limit)

---

### POST /api/auth/refresh

- Scopo: ottenere nuovo access token usando refresh token in cookie.
- Auth: cookie `refresh_token`.
- Body: nessuno.

**Risposta 200**

```json
{
  "access_token": "<new-jwt>"
}
```

**Possibili errori**

- `401 NO_REFRESH_TOKEN` -> `Refresh token mancante.`
- `401 REFRESH_TOKEN_INVALID` -> `Refresh token non valido o scaduto.`
- `401 UNAUTHORIZED` -> `Sessione non valida.`

---

### POST /api/auth/logout

- Scopo: invalidare sessione lato browser cancellando il cookie refresh.
- Auth: opzionale (se cookie presente viene rimosso).
- Body: nessuno.

**Risposta 200**

```json
{
  "message": "Logout effettuato."
}
```

---

### GET /api/auth/me

- Scopo: dati del profilo autenticato.
- Auth: `Authorization: Bearer <access_token>`.

**Risposta 200**

```json
{
  "id_persona": 1,
  "username": "testuser",
  "photo_url": null,
  "is_superuser": false,
  "is_banned": false
}
```

**Possibili errori**

- `401 UNAUTHORIZED` -> `Token mancante o malformato.`
- `401 TOKEN_INVALID` -> `Token non valido o scaduto.`
- `404 NOT_FOUND` -> `Utente non trovato.`

## 5) Messaggi globali possibili (non solo auth)

- `404 NOT_FOUND` -> `Endpoint non trovato.`
- `429 TOO_MANY_REQUESTS` -> `Troppe richieste. Riprova tra poco.`
- `500 INTERNAL_SERVER_ERROR` ->
  - in `development`: mostra `err.message`
  - in altri ambienti: `Errore interno del server.`

## 6) Esempi cURL end-to-end

### Register

```bash
curl -i -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","username":"testuser","password":"password123","confirm_password":"password123"}'
```

### Login (salva cookie)

```bash
curl -i -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

### Me con Bearer

```bash
TOKEN="<incolla-access-token>"
curl -i http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

### Refresh con cookie

```bash
curl -i -b cookies.txt -c cookies.txt -X POST http://localhost:3000/api/auth/refresh
```

### Logout

```bash
curl -i -b cookies.txt -X POST http://localhost:3000/api/auth/logout
```

## 7) Limiti attuali (stato progetto)

- Al momento il backend esposto e' focalizzato sull'auth.
- Gli altri endpoint della piattaforma (friends, groups, trading, watchlist, search, ecc.) non sono ancora implementati in `src/routes`.
- Il job di trading e' presente come placeholder (`startCronJobs`).

## 8) File principali da consultare

- `src/server.ts`
- `src/routes/index.ts`
- `src/routes/auth.routes.ts`
- `src/controllers/auth.controller.ts`
- `src/middleware/auth.ts`
- `src/lib/jwt.ts`
- `src/lib/prisma.ts`

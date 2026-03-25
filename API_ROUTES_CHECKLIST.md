# Checklist Rotte API (basato su SPECIFICHE.md)

Legenda: la `x` indica che la funzionalità è presente nel codice.

## Auth
- [x] Registrazione
- [x] Login
- [x] Refresh token
- [x] Logout
- [x] Dati utente (me)

## Users / Profilo
- [x] Modifica username
- [x] Modifica email
- [x] Modifica photo_url
- [x] Cambio password

## Amicizie (Friends)
- [x] Lista amici e richieste in sospeso
- [x] Invia richiesta
- [x] Annulla richiesta
- [x] Accetta richiesta
- [x] Rifiuta richiesta
- [x] Blocca utente
- [x] Sblocca utente

## Gruppi (Groups)
- [x] Elenco gruppi in cui si fa parte
- [x] Elenco membri del gruppo con ruolo
- [x] Info del gruppo (nome, foto)
- [x] Crea gruppo
- [x] Invia invito (Admin/Owner)
- [x] Inviti ricevuti
- [x] Accetta invito
- [x] Rifiuta invito
- [x] Annulla invito
- [x] Cambia ruolo membro (Owner only)
- [x] Espelli
- [x] Abbandona
- [x] Modifica nome gruppo (owner)
- [x] Modifica privacy gruppo (owner)
- [ ] Modifica foto profilo gruppo (owner)
- [x] Modifica descrizione gruppo (owner)  (non esiste nello schema prisma)
- [x] Elimina gruppo
- [x] Modifica fondi membro (Admin/Owner)
- [x] Classifica gruppo

## Trading / Ordini / Portafogli
- [x] Saldo portafoglio privato (GET)
- [x] Modifica saldo portafoglio privato (PUT)
- [x] Crea ordine Buy/Sell (POST)
- [x] Annulla ordine Pending (DELETE)
- [x] Transazioni (pending)
- [x] Transazioni eseguite profilo (history)
- [x] Worker / Cron motore trading
- [x] Azioni possedute di un portafoglio (holdings)
- [x] Storico saldo per ogni portafoglio

## Watchlist
- [x] Lista ticker salvati
- [x] Aggiungi ticker
- [x] Rimuovi ticker

## Ricerca
- [x] Ricerca titoli (ticker/nome società)
- [x] Ricerca utenti
- [x] Ricerca gruppi


---

Note rapide:
- Router presenti: `auth`, `trading` (vedi [src/routes/index.ts](src/routes/index.ts#L1-L20)).
- Controller principali presenti: `auth.controller.ts`, `privateBalance.controller.ts`, `tradingOrders.controller.ts` (vedi [src/controllers]).

Passi consigliati: implementare gradualmente `users`, `friends`, `groups`, `watchlist` e le API di ricerca.

Se vuoi, posso creare branch/PR con stub per i router mancanti e gli schemi iniziali delle funzionalità.

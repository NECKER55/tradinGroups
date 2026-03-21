# Checklist Rotte API (basato su SPECIFICHE.md)

Legenda: la `x` indica che la funzionalità è presente nel codice.

## Auth
- [x] Registrazione
- [x] Login
- [x] Refresh token
- [x] Logout
- [x] Dati utente (me)

## Users / Profilo
- [ ] Modifica profilo (username/email/photo_url)
- [ ] Cambio password

## Amicizie (Friends)
- [ ] Lista amici
- [ ] Richieste in sospeso
- [ ] Invia richiesta
- [ ] Accetta richiesta
- [ ] Rifiuta richiesta
- [ ] Blocca utente

## Gruppi (Groups)
- [ ] Elenco gruppi
- [ ] Dettagli gruppo + membri + transazioni
- [ ] Crea gruppo
- [ ] Invia invito (Admin/Owner)
- [ ] Inviti ricevuti
- [ ] Accetta invito
- [ ] Rifiuta invito
- [ ] Cambia ruolo membro (Owner only)
- [ ] Espelli/abbandona membro
- [ ] Modifica impostazioni gruppo (Admin/Owner)
- [ ] Elimina gruppo
- [ ] Modifica fondi membro (Admin/Owner)

## Trading / Ordini / Portafogli
- [x] Saldo portafoglio privato (GET)
- [x] Modifica saldo portafoglio privato (PUT)
- [x] Crea ordine Buy/Sell (POST)
- [x] Annulla ordine Pending (DELETE)
- [x] Transazioni profilo (history)
- [x] Worker / Cron motore trading
- [x] Azioni possedute di un portafoglio (holdings)

## Watchlist
- [ ] Lista ticker salvati
- [ ] Aggiungi ticker
- [ ] Rimuovi ticker

## Ricerca
- [ ] Ricerca titoli (ticker/nome società)
- [ ] Ricerca utenti
- [ ] Ricerca gruppi

## Altro
- [ ] Bloccare utente
- [ ] Endpoint media/upload per photo_url

---

Note rapide:
- Router presenti: `auth`, `trading` (vedi [src/routes/index.ts](src/routes/index.ts#L1-L20)).
- Controller principali presenti: `auth.controller.ts`, `privateBalance.controller.ts`, `tradingOrders.controller.ts` (vedi [src/controllers]).

Passi consigliati: implementare gradualmente `users`, `friends`, `groups`, `watchlist` e le API di ricerca.

Se vuoi, posso creare branch/PR con stub per i router mancanti e gli schemi iniziali delle funzionalità.

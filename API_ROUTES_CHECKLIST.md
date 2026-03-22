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
- [x] Lista amici e richieste in sospeso
- [x] Invia richiesta
- [x] Annulla richiesta
- [x] Accetta richiesta
- [x] Rifiuta richiesta
- [x] Blocca utente
- [x] Sblocca utente

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
- [x] Storico saldo per ogni portafoglio

## Watchlist
- [x] Lista ticker salvati
- [x] Aggiungi ticker
- [x] Rimuovi ticker

## Ricerca
- [x] Ricerca titoli (ticker/nome società)
- [x] Ricerca utenti
- [ ] Ricerca gruppi

## Altro
- [x] Bloccare utente
- [ ] Endpoint media/upload per photo_url

---

Note rapide:
- Router presenti: `auth`, `trading` (vedi [src/routes/index.ts](src/routes/index.ts#L1-L20)).
- Controller principali presenti: `auth.controller.ts`, `privateBalance.controller.ts`, `tradingOrders.controller.ts` (vedi [src/controllers]).

Passi consigliati: implementare gradualmente `users`, `friends`, `groups`, `watchlist` e le API di ricerca.

Se vuoi, posso creare branch/PR con stub per i router mancanti e gli schemi iniziali delle funzionalità.

L'obiettivo è creare una web app finanziaria che permetta agli utenti di simulare la compravendita di azioni sul mercato azionario (con un'esperienza utente simile a Revolut), utilizzando valuta virtuale ("soldi finti").
Il core della piattaforma è l'aspetto sociale e competitivo: gli utenti possono creare gruppi con amici o altri membri della piattaforma per competere e dimostrare chi è il trader più abile.

* **Utente Non Registrato (Guest):** Può navigare sul sito, accedere/registrarsi, cercare utenti e visualizzare i gruppi pubblici. Può esplorare le funzionalità offerte dalla piattaforma, ma non ha accesso a nessuna area di trading (né privata né di gruppo).
* **Utente Registrato (User):** Ha accesso alla propria area personale (impostazioni account, informazioni) e alle dashboard generali (migliori trader, gruppi pubblici, classifiche globali, ricerca giocatori).
* **Area Trading Privata:** Permette il trading in singolo. Dispone di una watchlist globale (se aggiornata qui, si aggiorna anche nei gruppi e viceversa).
* **Area Trading di Gruppo:** Visualizza i gruppi di appartenenza. Ogni gruppo è un "dominio" isolato: il budget, le azioni e le transazioni di un gruppo non influenzano in alcun modo l'area privata o gli altri gruppi. Può inviare richieste di amicizia ad altri utenti.

### Tabella Ruoli

| Ruolo | Accesso in Lettura | Accesso in Scrittura / Azioni | Gestione Utenti e Impostazioni |
| :--- | :--- | :--- | :--- |
| **Spectator** | Vede dati pubblici (classifica, membri, transazioni). | Nessuna. (Non fa parte del gruppo). | Nessuna. |
| **viewer** | Vede classifica, portafogli membri, cronologia transazioni e saldi. | Può abbandonare il gruppo. Non può comprare/vendere. | Nessuna. |
| **User** | Tutto ciò che vede il Guest. | Può comprare e vendere azioni. Fa parte della classifica. | Nessuna. |
| **Admin** | Tutto ciò che vede lo User. | Tutto ciò che fa lo User. | Può aggiungere/rimuovere budget a tutti (incluso sé stesso). Può invitare ed espellere User. Modifica opzioni di sistema. |
| **Owner (Creatore)** | Tutto ciò che vede l'Admin. | Tutto ciò che fa l'Admin. | Può promuovere a Admin, declassare o espellere Admin. Per abbandonare, deve prima cedere il ruolo di Owner. |

Esporta in Fogli

* **Area Privata:** L'utente può aggiungere o prelevare liquidità virtuale a piacimento in qualsiasi momento (es. passare da 10k a 15k). Il sistema traccia il numero di azioni possedute e l'intera cronologia delle transazioni.
* **Area Gruppi:** L'utente non può alterare la propria liquidità (solo gli Admin/Owner possono farlo). Visualizza azioni possedute e cronologia transazioni del gruppo.
* **Ricalcolo Giornaliero:** Il sistema calcola il valore del portafoglio (Valore attuale delle azioni + Liquidità) 1 o 2 volte al giorno per aggiornare le classifiche e i grafici del patrimonio.
* I titoli disponibili sono definiti nel backend.
* Per ogni titolo è disponibile un grafico dell'andamento dei prezzi (in USD) fornito da API esterne (es. TradingView/Stockmarkets).
* **Valuta e Tipologia:** Si opera esclusivamente in Dollari (USD) e con ordini di tipo Market.

**Flusso di Acquisto/Vendita:**
* L'utente dichiara il budget da spendere (in caso di acquisto) o il numero di azioni da vendere.
* L'ordine viene messo "In Sospeso" e i fondi (in caso di acquisto) vengono congelati/prelevati immediatamente.
* L'utente può annullare l'ordine solo finché è in sospeso.
* Ogni X minuti (es. 5 minuti), un Cron Job nel backend raccoglie tutti gli ordini pendenti, effettua una chiamata API per ottenere i prezzi aggiornati in tempo reale, esegue le transazioni e aggiorna i portafogli e la liquidità di ciascun utente.
* **Vincoli:** Applicazione di tutti i controlli logici (es. fondi insufficienti, azioni non possedute).

* **Area Privata:** Non sono presenti classifiche.
* **Area Gruppi:** Classifica aggiornata 1-2 volte al giorno. Include la graduatoria classica e un grafico dell'andamento del capitale nel tempo (filtri temporali: Settimana, Mese, Anno, Sempre). Richiede uno snapshot giornaliero dei patrimoni nel database.
* **Dashboard Principale:** Mostra le classifiche dei gruppi più rilevanti (definiti inizialmente dai programmatori).
* **Ricerca e Amicizie:** Ricerca utenti per nickname dalla pagina principale; invio/ricezione richieste di amicizia.
* **Inviti ai Gruppi:** Creazione gruppo con inviti tramite lista amici o link diretto. L'utente invitato può accettare o rifiutare.

### Legenda Stato Sviluppo:
* (v) = Struttura/Logica finita
* (vv) = Struttura/Logica finita + Grafica implementata

**Pagina Principale (v):**
* Top Destra: Pulsante Register/Login o Icona Profilo (se loggato).
* Primo Piano: Overview di 2-3 gruppi pubblici (top 3 membri + link al gruppo) e Classifica dei migliori guadagni % del mese.
* Sezione Inferiore: Shortcut per "Area Personale", "Area Gruppi", "Ricerca Utenti" (rimandano al Login se l'utente non è autenticato).

**Pagina di Login (v):**
* Login: Email e Password.
* Registrazione: Email, Username (con validazione univocità), Password e Conferma Password.
* Recupero: Reset password via email.

**Pagina Social (vv):**
* Top Header: Icona profilo (apre Banner Profilo Personale). Barra di ricerca a sinistra (utenti/gruppi). Pulsanti notifiche a destra (Richieste amicizia, Inviti gruppi).
* Corpo SX: Lista amici attuali e form per invitare amici tramite link.
* Corpo DX: Overview Gruppi pubblici frequentati dagli amici (cliccabili).

**Pagina Area Personale (vv):**
* Accesso: Solo loggati (Stile Revolut).
* Top Header: Barra di ricerca titoli (apre overlay con risultati cliccabili).
* Top SX: Patrimonio totale, Liquidità disponibile, Pulsante Aggiungi/Rimuovi fondi.
* Primo Piano: Grafico andamento patrimonio totale.
* Sezione Inferiore: Azioni possedute, Cronologia transazioni, Watchlist, Ordini in attesa (possono essere revocati tramite un pulsante fino a quando sono in attesa → soldi restituiti se revocati).

**Pagina Azione (vv):**
* Primo Piano: Grafico TradingView del titolo + Icona Stella (aggiungi/rimuovi da watchlist).
* Pannello Laterale: Interfaccia Compra (input in $) / Vendi (input quantità azioni), con liquidità disponibile visibile.
* Footer: Riepilogo delle azioni esatte già possedute per quel titolo.

**Pagina Area Gruppi (vv) (Attualmente si intravede):**
* Lista dei gruppi di appartenenza.
* Icona "Crea Gruppo" (apre Banner Creazione Gruppo).

**Pagina Gruppo (v):**
* Top Header: Profilo, Tag Ruolo (Spectator/viewer/ecc.). Se Admin/Owner: Pulsante "Invita" (apre mini-banner per ricerca amici/link) e Pulsante "Impostazioni".
* Primo Piano: Classifica membri espandibile (lista ordinata per capitale o grafico andamento capitale (quello che si avrebbe nell’area personale ma per tutti) sovrapposto, filtrabile per utente). Cliccando su un utente si apre la sua Pagina Overview Persona.
* Pannello Laterale: Lista espandibile delle transazioni pubbliche del gruppo.
* Area Operativa (Toggle): Switch all'interfaccia di trading specifica del gruppo (identica all'area personale privata, ma senza gestione fondi; nascosta a Guest e Spectator).

**Pagina Overview Persona (vv):**
* Top Header: Nome, Foto, Patrimonio totale, Liquidità nel gruppo.
* Primo Piano: Grafico andamento patrimonio (contestuale a quel gruppo).
* Pannello Laterale (SX): Cronologia transazioni dell'utente in quel gruppo.
* Sezione Inferiore: Lista azioni possedute + Grafico a torta sulla diversificazione del portafoglio.

**Banner Creazione Gruppo (v):** Input Nome (con validazione univocità), Upload Foto Profilo, Selezione Privacy (Pubblica, Privata, Solo Amici), Barra di ricerca inviti (distinzione tra amici/persone del network) / Link di invito, Pulsante "Crea".

**Banner Impostazioni Gruppo (v):** Modifica Nome/Foto/Privacy. Lista membri con relative azioni a sinistra (Espelli, Aggiungi/Rimuovi fondi) e Tag ruolo. Pulsanti di promozione/declassamento (se Owner), se promuove admin ad owner, l’attuale owner viene declassato ad admin, Barra di ricerca inviti (distinzione tra amici/persone del network) / Link di invito .

**Banner Profilo Personale (v):** Foto (modificabile), Nome. Dropdown per: Cambio Nome, Cambio Email, Cambio Password. Pulsante Logout.

### Messaggi di Errore e Vincoli

* **Registrazione - Email duplicata:** Se l'utente inserisce un'email già presente nel database ➔ Messaggio di errore: "Email già in uso."
* **Registrazione - Username duplicato:** Se l'utente sceglie un nome utente già preso ➔ Messaggio di errore: "Nome utente già in uso."
* **Registrazione - Password non coincidenti:** Se i campi "Password" e "Conferma Password" sono diversi ➔ Messaggio di errore: "Le password non corrispondono."
* **Login - Credenziali errate:** Se email o password non corrispondono ➔ Messaggio di errore: "Credenziali non valide. Riprova." (Per motivi di sicurezza, è meglio non specificare se è sbagliata l'email o la password).
* **Nome Gruppo duplicato:** Se l'utente tenta di creare un gruppo con un nome già esistente nel sistema ➔ Messaggio di errore: "Esiste già un gruppo con questo nome. Scegline un altro."
* **Modifica Email/Username:** Se l'utente tenta di cambiare la propria email o il proprio nome utente con uno già occupato ➔ Messaggio di errore: "Email/Nome utente già in uso da un altro account."
* **Acquisto - Fondi insufficienti:** Se l'utente inserisce un budget in dollari ($) per comprare un'azione che supera la sua liquidità attuale disponibile (nell'area privata o nel gruppo specifico) ➔ L'ordine viene bloccato. Messaggio di errore: "Fondi insufficienti per completare questa operazione."
* **Vendita - Azioni insufficienti:** Se l'utente inserisce un numero di azioni da vendere superiore a quelle effettivamente possedute nel portafoglio di quel dominio ➔ L'ordine viene bloccato. Messaggio di errore: "Non possiedi abbastanza azioni di questo titolo per la vendita."
* **Revoca Transazione - Ordine già eseguito:** Se l'utente tenta di annullare un ordine "in sospeso" proprio nel momento in cui il backend (cron job) lo sta eseguendo o lo ha appena completato ➔ L'annullamento fallisce. Messaggio di errore: "Impossibile revocare l'ordine: la transazione è già stata completata dal mercato."
* **Owner - Abbandono del gruppo:** Se il creatore/owner cerca di lasciare il gruppo senza aver passato la proprietà ➔ Azione bloccata. Messaggio di errore: "Devi promuovere un altro utente a Owner prima di poter abbandonare il gruppo."
* **Admin - Limiti di espulsione (Admin):** Se un Admin tenta di espellere un altro Admin ➔ Azione bloccata (idealmente, il pulsante "Espelli" deve essere nascosto per quell'utente).
* **Admin - Limiti di espulsione (Owner):** Se un Admin tenta di espellere o declassare l'Owner ➔ Azione bloccata (pulsanti nascosti).
* **Aggiunta/Rimozione Fondi:** Se un utente normale o un guest tenta di modificare la propria liquidità all'interno di un gruppo ➔ L'azione è interdetta a livello di API backend e non vi è alcuna interfaccia visibile per farlo (permesso esclusivo di Admin/Owner).
* **Accesso a Gruppo Privato:** Se un utente cerca di accedere tramite URL diretto a un gruppo impostato su "Privato" senza aver ricevuto/accettato l'invito ➔ Reindirizzamento o Messaggio: "Questo gruppo è privato. L'accesso è consentito solo su invito."

### Struttura Database

* id_persona: INT (PK) — Auto-increment.
* username: VARCHAR(50) (Unique) — Nickname univoco.
* photo_url: VARCHAR(255) — Percorso o URL dell'immagine.
* is_banned: BOOLEAN — Default: false.
* is_superuser: BOOLEAN — Default: false.
* email: VARCHAR(100) (FK) — Utilizzata come identificatore primario per il login.
* password: VARCHAR(255) — Hash della password (non in chiaro).
* id_persona: INT (PK) — Riferimento a Persona(id_persona).
* id_gruppo: INT (PK) — Auto-increment.
* nome: VARCHAR(100) (Unique) — Nome del gruppo.
* privacy: ENUM('Public', 'Private') — Livello di visibilità.
* photo_url: VARCHAR(255) — Icona del gruppo.
* id_stock: VARCHAR(10) (PK) — Ticker dell'azione (es. 'AAPL', 'TSLA').
* nome_societa: VARCHAR(150) — Nome esteso dell'azienda.
* settore: VARCHAR(50) — Nome settore.
* id_portafoglio: INT (PK) — Auto-increment.
* liquidita: DECIMAL(18, 2) — Saldo in dollari disponibile per il trading privato.
* id_persona: INT (FK) — Relazione 1:1 con Persona.
* id_gruppo: INT (FK, nullable) — Relazione 1:1 con Gruppo. (se null portfolio area personale)
* id_snapshot: INT (PK).
* data: DATE — Giorno del rilevamento giornaliero.
* valore_totale: DECIMAL(18, 2) — Somma di liquidità e valore azioni in quel giorno.
* id_persona: INT (FK) — Punta all'ID della persona.
* id_gruppo: INT (FK) — Punta all'ID del Gruppo.
* id_persona_1: INT (PK).
* id_persona_2: INT (PK).
* status: ENUM('Pending', 'Accepted').
* user_block: INT (FK, Nullable) — ID dell'utente che ha attivato il blocco.
* data_inizio: TIMESTAMP.
* id_persona: INT (PK).
* id_gruppo: INT (PK).
* budget_iniziale: DECIMAL(18, 2) 0 di default
* ruolo: ENUM('Owner', 'Admin', 'User', 'Guest', 'Spectator').
* id_invitato: INT (PK).
* id_mittente: INT (PK).
* id_gruppo: INT (PK).
* data_invito: TIMESTAMP.
* id_transazione: INT (PK).
* id_stock: VARCHAR(10) (FK).
* tipo: ENUM('Buy', 'Sell').
* importo_investito: DECIMAL(18, 2) (nullable) null se è di tipo sell
* stato: ENUM('Pending', 'Executed').
* prezzo_esecuzione: DECIMAL(18, 6) — Prezzo recuperato dalle API al momento dell'ordine.
* quantita_azioni: DECIMAL(18, 6)(nullable) — Numero di azioni acquistate o vendute. Null se pending.
* data_ora: TIMESTAMP.
* id_persona: INT (PK).
* id_stock: VARCHAR(10) (PK).

**Tabella: Azioni_in_possesso**
* id_portfolio: INT (PK).
* prezzo_medio_acquisto: DECIMAL(18, 2) prezzo per azione al momendìto della compravendita
* id_stock: VARCHAR(10) (PK).
* numero: DECIMAL(18, 6).

**Regole di Business e Database**
* **Precisione Finanziaria:** Per le colonne monetarie e di quantità azioni è usato il tipo DECIMAL (es. DECIMAL(18, 2)) anziché FLOAT per evitare errori di arrotondamento tipici del trading.
* **Isolamento Liquidità:** Il sistema deve gestire due flussi di cassa distinti: Portafoglio.liquidita per il trading in singolo e Membro_Gruppo.liquidita_gruppo per ogni gruppo di appartenenza.
* **Vincolo Ternario Invito:** La tabella Invito_Gruppo deve sempre avere riferimenti validi a due persone diverse (chi invita e chi riceve) e al gruppo di destinazione.
* **Audit Trail:** La tabella Transazioni i record vengono cancellati nel momento in cui vengono cancellate le transazioni in Pending non Executed.
* **Vincolo di Unicità Owner:** In ogni gruppo, deve esistere uno e un solo utente con ruolo = 'Owner'. Il database deve impedire che un Owner venga eliminato o declassato senza aver prima nominato un successore.
* **Vincolo di Prelievo Area Privata:** Nell'Area Privata, l'utente può rimuovere fondi solo se la liquidita rimanente è ≥0. Non si può andare in "rosso".
* **Vincolo di Coerenza Transazione-Portafoglio:** Una transazione può essere associata a un id_portafoglio solo se l'utente che la effettua è effettivamente il proprietario di quel portafoglio.
* **Privacy degli Inviti:** Un utente può invitare qualcuno a un gruppo solo se ha il ruolo di Admin o Owner in quel gruppo.

* Quando lo stato di una transazione passa da Pending a Executed:
  * **Azione:** Inserisce o aggiorna la riga corrispondente nella tabella Azioni_in_possesso.
  * **Effetto:** Se è un Buy, aumenta il numero di azioni; se è un Sell, le diminuisce e accredita la liquidità derivante dalla vendita nel Portafoglio.
* Quando una persona entra in un nuovo gruppo (nuova riga in Membro_Gruppo):
  * **Azione:** Crea automaticamente una riga nella tabella Portafoglio associata a quell'utente e a quel gruppo con la liquidità iniziale stabilita.
* Se is_banned nella tabella Persona diventa True:
  * **Azione:** Annulla automaticamente tutte le transazioni ancora in stato Pending dell'utente in tutti i gruppi e nell'area privata.

* Sebbene il calcolo avvenga tramite Cron Job, un trigger può aiutare a mantenere la pulizia:
* **Trigger "Clean on Delete":** Se un portafoglio viene eliminato (ad esempio perché un gruppo viene sciolto), il trigger deve eliminare tutti i relativi record nella tabella Storico_Portafoglio. Questo evita di mantenere dati orfani che non possono più essere visualizzati in nessun grafico.
* **Trigger "No Self-Friendship":** Impedisce l'inserimento di una riga nella tabella Amicizia dove id_persona_1 == id_persona_2. Non puoi mandare una richiesta di amicizia a te stesso.
* **Trigger "Unique Friendship":** Garantisce che tra due persone esista una sola riga, indipendentemente dall'ordine degli ID (evita che Mario sia amico di Luigi e contemporaneamente Luigi mandi una richiesta a Mario).
* **Trigger "Auto-Delete Invitation":** Quando viene inserita una nuova riga in Membro_Gruppo, un trigger deve cercare e cancellare l'eventuale riga corrispondente in Invito_Gruppo. Questo pulisce automaticamente le richieste in sospeso quando vengono accettate.
* **Vincolo di Partecipazione Attiva:** Un utente può avere transazioni associate a un id_gruppo solo se esiste una riga corrispondente in Membro_Gruppo con un ruolo che permette la scrittura (User, Admin, Owner). Questo protegge da tentativi di trading da parte di Spectator o Guest.

### Comunicazione tra frontend e backend
Mancavano completamente nella lista precedente, ma sono essenziali per il funzionamento degli inviti.

| Metodo | Endpoint | Payload (Body) | Azione e Risposta |
| :--- | :--- | :--- | :--- |
| GET | /api/friends | Nessuno | Ritorna la lista degli amici confermati dell'utente loggato. |
| GET | /api/friends/requests | Nessuno | Ritorna le richieste di amicizia in sospeso ricevute. |
| POST | /api/friends/requests | id_persona_ricevente | Invia una richiesta di amicizia. |
| PUT | /api/friends/requests/:id_richiesta/accept | Nessuno | Accetta la richiesta e cambia lo status in Accepted. |
| DELETE | /api/friends/requests/:id_richiesta/reject | Nessuno | Rifiuta/Elimina la richiesta di amicizia. |

| Metodo | Endpoint | Payload (Body) | Azione e Risposta |
| :--- | :--- | :--- | :--- |
| PUT | /api/friends/:id_persona/block | Nessuno | Blocca l'utente (aggiorna la tabella Amicizia valorizzando user_block). Ritorna status Success. |
| PUT | /api/users/me | username, email, photo_url | Modifica le informazioni base del profilo personale. (Controlla che username/email non siano già in uso). |
| PUT | /api/users/me/password | old_password, new_password | Verifica la vecchia password e aggiorna l'hash nella tabella Credenziali. |

Qui aggiungiamo come si entra, si esce e si cambiano i ruoli.

| Metodo | Endpoint | Payload (Body) | Azione e Risposta |
| :--- | :--- | :--- | :--- |
| GET | /api/groups | Nessuno | Ritorna i gruppi di cui faccio parte. |
| GET | /api/groups/:id | Nessuno | Ritorna i dettagli del gruppo (name, photo url), la lista dei membri e le transazioni di tutto il gruppo. |
| POST | /api/groups/:id/invites | id_persona_invitata | (Solo Admin/Owner) Crea la richiesta in Invito_Gruppo. |
| GET | /api/groups/invites | Nessuno | Ritorna tutti gli inviti ai gruppi ricevuti dall'utente loggato. |
| POST | /api/groups/invites/:id_invito/accept | Nessuno | L'utente accetta: il backend lo inserisce in Membro_Gruppo, genera il Portafoglio col budget iniziale e cancella l'invito. |
| PUT | /api/groups/:id/members/:id_membro/role | nuovo_ruolo | (Solo Owner) Promuove a Admin, declassa a User, o passa la qualifica di Owner. |
| DELETE | /api/groups/:id/members/:id_membro | Nessuno | Espelle un utente (se fatto da Admin/Owner) o permette di abbandonare il gruppo (se fatto su se stessi). |
| PUT | /api/groups/:id/balance | id_membro, nuovo_saldo | (Solo Admin/Owner) Modifica i fondi di un utente nel gruppo. |

| Metodo | Endpoint | Payload (Body) | Azione e Risposta |
| :--- | :--- | :--- | :--- |
| DELETE | /api/groups/invites/:id_invito/reject | Nessuno | L'utente rifiuta l'invito. Il backend elimina il record dalla tabella Invito_Gruppo. |
| PUT | /api/groups/:id | nome, privacy, photo_url | (Solo Admin/Owner) Modifica le impostazioni generali del gruppo. |
| DELETE | /api/groups/delete/:id | Nessuno | Elimina il gruppo (elimina anche tutte le righe delle varie tabelle riferite a quel gruppo) |

Qui correggiamo il ritorno dell'ID e aggiungiamo la Watchlist.

| Metodo | Endpoint | Payload (Body) | Azione e Risposta |
| :--- | :--- | :--- | :--- |
| POST | /api/trading/orders | id_portafoglio, id_stock, tipo, importo_investito/ quantità azioni vendute se è ditipo buy | Crea ordine (il backand verificherà prima se l’importo o il numero di azioni selezionato è effettivamente in possesso dal richiedente, altrimenti abortisce la transazione). Ritorna: L'oggetto transazione completo { id_transazione: 123, stato: "Pending", ... } |
| DELETE | /api/trading/orders/:id_transazione | Nessuno | Annulla un ordine Pending (restituisce errore se già Executed). |
| GET | /api/trading/portfolio/:id_portafoglio | Nessuno | Ritorna liquidità attuale, azioni possedute con attuale percentuale di aumento o diminuzione del prezzo (calcolata una volta al giorno) e ordini in attesa per quel dominio (privato o di gruppo). |
| GET | /api/watchlist | Nessuno | Ritorna i ticker salvati dall'utente. |
| POST | /api/watchlist | id_stock | Aggiunge un titolo alla Watchlist. |
| DELETE | /api/watchlist/:id_stock | Nessuno | Rimuove un titolo dalla Watchlist. |

| Metodo | Endpoint | Payload (Body) | Azione e Risposta |
| :--- | :--- | :--- | :--- |
| PUT | /api/trading/private/balance | delta_liquidita (es: +5000 o -2000) | Aggiunge o preleva fondi dal Portafoglio dove id_gruppo è NULL. Se il prelievo porta il saldo sotto zero, ritorna Errore 400. |

| Metodo | Endpoint | Chi può chiamarlo | Payload (Body) | Azione e Risposta (JSON) |
| :--- | :--- | :--- | :--- | :--- |
| GET | /api/search/stocks?q=testo | Logged In | Nessuno | Cerca testo in id_stock (Ticker) o nome_societa nel DB locale usando un operatore ILIKE (case-insensitive). Ritorna: [{ id_stock: "AAPL", nome_societa: "Apple Inc.", settore: "Tech" }, ...] |
| GET | /api/search/users?q=testo | Logged In | Nessuno | Cerca utenti per username nel DB locale (escludendo se stessi e gli utenti bannati o che ci hanno bloccato). Ritorna: [{ id_persona: 4, username: "mario99", photo_url: "..." }, ...] |
| GET | /api/search/groups?q=testo | Logged In | Nessuno | Cerca gruppi per nome nel DB locale, filtrando solo quelli con privacy = 'Public' o in quelli in cui siamo dentro. Ritorna: [{ id_gruppo: 12, nome: "Wall Street Wolves", photo_url: "..." }, …] |
| GET | /api/portfolios/:id_portafoglio/history | Logged In | Nessuno | Recupera dalla tabella Storico_Portafoglio tutte le righe associate all'id del portafoglio specificato. Serve al frontend per tracciare le coordinate (X=data, Y=valore) e disegnare il grafico dell'andamento nel tempo.Ritorna: [{ data: "2026-02-18", valore_totale: 10000.00, variazione_perc: "0.00%" }, { data: "2026-02-19", valore_totale: 10500.00, variazione_perc: "+5.00%" }, ...] |

Quando l'utente seleziona "Apple" dalla barra di ricerca, viene indirizzato alla pagina dell'azione (es. /stock/AAPL sul tuo frontend React).
Qui entra in gioco un dettaglio importante: il tuo backend non deve fornire i dati del grafico.
Il flusso sarà questo:
1. Il frontend cerca nel db l’azione giusta il quale glie la restituisce (/api/search/stocks?q=testo). E restituisce per esempio AAPL
2. Il frontend renderizza il componente di TradingView passandogli "AAPL". TradingView fa tutto da solo (disegna le candele, i volumi, gli indicatori temporali).
3. Il frontend chiama il tuo backend solo per sapere due cose: l'utente ha questa azione nella sua watchlist? E quante azioni possiede già nei suoi portafogli?

### Motore di Trading

Questo è il cuore dell'app. Deve essere eseguito in modo asincrono ogni 5 minuti sul server.
**Flusso Logico di Esecuzione (Ogni 5 minuti):**
1. **Blocco e Lettura:** Il server esegue una query per selezionare tutte le transazioni dove stato = 'Pending'.
2. **Estrazione Ticker:** Dal risultato precedente, estrae un array unico di tutti i simboli azionari coinvolti (es. ['AAPL', 'TSLA']) no duplicati.
3. **Recupero Prezzi (Ottimizzato):** Il server chiama l'API esterna di borsa (es. Finnhub) chiedendo i prezzi solo per i ticker estratti al punto 2. Crea in memoria una mappa chiave-valore: { 'AAPL': 150.20, 'TSLA': 200.50 }.
4. **Apertura Transazione DB:** Si avvia una BEGIN TRANSACTION su PostgreSQL per garantire che se qualcosa fallisce a metà, nulla venga salvato.
5. **Ciclo di Elaborazione Ordini:** Per ogni ordine Pending:
   * Verifica che il prezzo per quel ticker sia stato recuperato con successo (se l'API esterna ha fallito per quel ticker, l'ordine viene saltato e rimandato ai prossimi 5 minuti).
   * Se BUY: non serve controllare che I soldi esistano dato che vengono gia controllati e scalati nel momento dell’avvio della transazione. Calcola azioni_ottenute = importo_investito / prezzo_attuale. Aggiunge le azioni in Azioni_in_possesso, aggiorna il saldo e setta l'ordine su Executed.
   * Se SELL: non serve controllare che le azioni siano effettivamente possedute dato che vengono gia controllate e scalate nel momento dell’avvio della transazione. Calcola guadagno = quantita_azioni * prezzo_attuale. Somma il guadagno al saldo del portafoglio, rimuove le azioni e setta l'ordine su Executed.
6. **Chiusura e Salvataggio:** Se tutti i calcoli nel ciclo vanno a buon fine, il server esegue il COMMIT sul database.

**Gestione dei Fallimenti API:** L'API esterna potrebbe non rispondere (es. Timeout). In quel caso, il Cron Job registra un "Warning" nei log del server e semplicemente non esegue gli ordini per quel ciclo. Gli ordini rimarranno Pending e verranno riprovati 5 minuti dopo.

Questo processo viene eseguito una volta al giorno per storicizzare il valore totale di ogni utente e aggiornare i grafici.
**Flusso Logico di Esecuzione (Giornaliero):**
1. **Estrazione Ticker Globali:** Il server esegue una query per estrarre un array unico (senza duplicati) di tutti i ticker azionari attualmente presenti nella tabella Azioni_in_possesso e in ordini I tipo buy in pending.
2. **Recupero Prezzi di Chiusura:** Il server chiama l'API esterna per recuperare il prezzo attuale/di chiusura solo per i ticker estratti al punto 1. Crea la consueta mappa in memoria: { 'AAPL': 150.20, 'TSLA': 200.50 }.
3. **Apertura Transazione DB:** Si avvia una BEGIN TRANSACTION per assicurare che tutti gli snapshot vengano salvati in blocco per quella data.
4. **Ciclo di Calcolo per ogni Portafoglio:** Il server estrae tutti i record dalla tabella Portafoglio e, per ciascuno, calcola il Valore Totale sommando 3 voci:
   * A. **Liquidità Disponibile:** Il valore attuale del campo liquidita nel portafoglio.
   * B. **Valore Azioni Possedute:** Per ogni azione posseduta in tabella Azioni_in_possesso associata a quel portafoglio, calcola numero_azioni * prezzo_attuale (preso dalla mappa in memoria).
   * C. **Valore Asset Congelati (Ordini Pending):** * Se ci sono ordini Buy in stato Pending, somma l'importo_investito (sono dollari temporaneamente usciti dalla liquidità). Se ci sono ordini Sell in stato Pending, somma quantita_azioni * prezzo_attuale (sono azioni temporaneamente uscite dal portafoglio).
   * Formula finale: Valore Totale = A + Somma(B) + Somma© calcolo per ogni azione in azioni possedute la percentuale di aumento/diminuzione rispetto al prezzo a cui si sono comprate.
5. **Salvataggio dello Snapshot:** Per ogni portafoglio, il server esegue una INSERT INTO Storico_Portafoglio inserendo:
   * data: la data odierna.
   * valore_totale: il risultato del calcolo al punto 4.
   * id_persona: recuperato dal portafoglio.
   * id_gruppo: recuperato dal portafoglio (NULL se è l'area privata).
6. **Chiusura e Salvataggio:** Completato il ciclo per tutti i portafogli, esegue il COMMIT sul database.

### Sicurezza e Architettura

Dato che il frontend e il backend vivono su due server diversi, la sicurezza deve essere impeccabile.
* **JSON Web Token (JWT):** * Al login, il backend Node.js genera un Token firmato digitalmente contenente l'id_persona. Il frontend salva questo Token (preferibilmente in memoria locale o localStorage). Ad ogni richiesta HTTP successiva verso il backend (es. per comprare un'azione), il frontend inserisce il Token nell'header Authorization: Bearer <token>.
* **Protezione degli Endpoint (Middleware di Autenticazione):** Nessun endpoint privato (trading, gestione profilo) può essere eseguito se il Token è mancante, scaduto o manomesso.
* **Role-Based Access Control (RBAC - Permessi di Gruppo):** Per endpoint sensibili come PUT /api/groups/:id/balance (cambiare soldi agli utenti), il backend esegue un "Middleware di Autorizzazione". Prima di eseguire il codice, il backend prende l'id_persona dal Token, prende l'id_gruppo dall'URL e interroga la tabella Membro_Gruppo. Se il ruolo non è Admin o Owner, blocca immediatamente la richiesta con un errore 403 Forbidden. Questo impedisce a un malintenzionato di usare strumenti come Postman per falsificare richieste.

Questa sezione definisce le tecnologie, l'infrastruttura e i pattern architetturali scelti per garantire prestazioni fluide, sicurezza e manutenibilità del simulatore di trading.

**8.1 Stack Tecnologico Core**
* **Frontend:** React.js (o Next.js in modalità SPA) per un'interfaccia reattiva in stile Revolut.
* **Styling:** fornito lo style del codice di ogni pagina.
* **Backend:** Node.js con framework Express.js. Leggero, maturo e perfetto per gestire chiamate asincrone e I/O intensivo.
* **Database Relazionale:** PostgreSQL. Ideale per le transazioni finanziarie grazie al rigoroso rispetto dei vincoli ACID.
* **ORM (Object-Relational Mapping):** Prisma. Fornisce un livello di astrazione type-safe per interagire con PostgreSQL, rendendo le query sicure e facilmente manutenibili.

**8.2 Gestione dello Stato e Sincronizzazione Frontend**
* **State Management Locale:** Zustand (leggero e privo del boilerplate tipico di Redux) per i dati dell'utente loggato e i toggle della UI.
* **Data Fetching e Caching:** React Query (TanStack Query). Gestisce automaticamente il caching delle chiamate API, la deduplicazione e gli stati di caricamento/errore.
* **Sincronizzazione Ordini (Real-time vs Polling):** Per mantenere l'architettura semplice nella V1, si adotterà lo Short Polling intelligente tramite React Query. Quando l'utente ha ordini in stato Pending, il frontend interrogherà l'endpoint /api/trading/portfolio/:id ogni 10 secondi per aggiornare la UI in automatico non appena l'ordine passa a Executed.

**8.3 Architettura del Motore di Trading (Cron Job e Code)**
Node.js è single-threaded; eseguire il ricalcolo pesante sullo stesso thread delle API HTTP causerebbe rallentamenti.
* **Gestore Code (Queue):** Redis associato alla libreria BullMQ.
* **Flusso:** Il Cron Job (eseguito ogni 5 minuti) non processa direttamente gli ordini. Genera invece un "Job" per ogni transazione Pending e lo inserisce nella coda Redis. Un processo separato (Worker) consuma la coda in background, esegue le transazioni sul DB e aggiorna i saldi in modo asincrono, senza bloccare la navigazione degli utenti.

**8.4 Ottimizzazione API Esterne e Caching**
* **Provider Dati Finanziari:** Finnhub o Polygon.io (offrono tier gratuiti/base ottimi per i simulatori e supportano query batch).
* **Livello di Caching (Redis):** Per evitare di superare i limiti di rate (Rate Limiting) delle API esterne, i prezzi delle azioni recuperati vengono salvati in Redis con un TTL (Time-To-Live) di 1 o 2 minuti. Se 50 utenti aprono la pagina di "AAPL" nello stesso minuto, l'API esterna verrà chiamata una volta sola; le altre 49 risposte verranno servite istantaneamente da Redis.

**8.5 Standardizzazione delle API Restful**
* **Paginazione:** Tutti gli endpoint che restituiscono liste (es. /api/groups/:id/transactions o /api/search/users) implementeranno la paginazione basata su Offset (?page=1&limit=20). La risposta JSON includerà sempre i metadati: data, total_items, current_page, total_pages.
* **Gestione Errori:** Formato standardizzato per le risposte di errore, es. { "error": "INSUFFICIENT_FUNDS", "message": "Fondi insufficienti per completare l'operazione." } con relativi status code HTTP (400 per logica di business, 401 per auth, 403 per permessi, 404 per non trovato).

**Storage e Ottimizzazione Immagini (Media):** Il database non ospiterà mai file binari. Le foto profilo e le icone dei gruppi verranno gestite tramite un servizio cloud specializzato come Cloudinary (scelta consigliata per la manipolazione on-the-fly) o AWS S3. Per garantire caricamenti istantanei e risparmiare banda (in stile WhatsApp), le immagini non verranno mai servite nel loro formato originale pesante. Al momento dell'upload (tramite backend con librerie come sharp o delegando a Cloudinary), il sistema genererà o metterà a disposizione tre formati standardizzati e ottimizzati in WebP:
* **Thumbnail (Small - es. 64x64 px):** Altamente compressa. Verrà utilizzata ovunque serva un'icona piccola: top header, lista amici, classifiche dei gruppi e cronologia transazioni.
* **Standard (Medium - es. 256x256 px):** Qualità bilanciata. Verrà renderizzata nelle aree di dettaglio, come il Banner Profilo Personale o la "Pagina Overview Persona".
* **Full (Large - max 1024x1024 px):** Mantiene una buona risoluzione ma con un tetto massimo di peso. Verrà scaricata solo se l'utente clicca specificamente sulla foto per ingrandirla a tutto schermo.
Il backend salverà nella colonna photo_url solo l'ID univoco o l'URL base dell'immagine. Sarà poi il frontend a richiedere dinamicamente la variante corretta aggiungendo i parametri di dimensione all'URL (es. .../image/upload/w_64,h_64/v1234/profilo.jpg), assicurando che ogni componente dell'interfaccia scarichi solo i byte strettamente necessari.
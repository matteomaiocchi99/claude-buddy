# Claude Buddy — ricostruzione

**Fonti, in ordine di autorevolezza:**

1. [variety.is/posts/claude-code-buddies](https://variety.is/posts/claude-code-buddies/) —
   reverse engineering del leak: **sprite vere, ordine vero delle specie, formule vere,
   prompt di sistema vero**. È la fonte da cui vengono i dati di questa ricostruzione.
2. [claudefa.st/blog/guide/mechanics/claude-buddy](https://claudefa.st/blog/guide/mechanics/claude-buddy)
   — l'articolo divulgativo, più lo **screenshot** da cui viene l'impaginazione della card.
   Dove i due divergono vince il primo (e sotto è annotato dove divergono).

> I buddy sono stati **rimossi da Claude Code in v2.1.97**; secondo la fonte l'endpoint delle
> reazioni è rimasto vivo per compatibilità.

Ricostruzione funzionante del pet da terminale descritto in
[claudefa.st/blog/guide/mechanics/claude-buddy](https://claudefa.st/blog/guide/mechanics/claude-buddy).
Zero dipendenze, solo Node ≥ 18 e la libreria standard.

```
buddy/
├── SKILL.md              # /buddy: come Claude usa il motore e come dà voce al pet
├── README.md             # questo file
└── engine/
    ├── buddy.mjs         # CLI (eseguibile)
    ├── rng.mjs           # FNV-1a + Mulberry32
    ├── species.mjs       # 18 specie: nomi hex-encoded + sprite 3 frame
    ├── cosmetics.mjs     # tabelle rarità / cappelli / occhi / stat
    ├── bones.mjs         # generazione deterministica + anti-cheat
    ├── soul.mjs          # nome, personalità, schiusa, persistenza
    ├── render.mjs        # colori ANSI, stat card, fumetti, animazioni
    └── chatter.mjs       # battute di riserva quando il modello non c'è
```

## Provalo subito

```bash
node engine/buddy.mjs            # schiude e stampa la card
node engine/buddy.mjs card       # stat card
node engine/buddy.mjs pet        # coccola
node engine/buddy.mjs gallery    # le 18 specie
node engine/buddy.mjs check id-487   # buddy di un altro id
```

Da Claude Code: `/buddy`, `/buddy card`, `/buddy pet`, …

## Come nasce un buddy

```
userId ──► FNV-1a(userId + "friend-2026-401") ──► Mulberry32 ──► 6 estrazioni in ordine fisso
                                                                  1. specie
                                                                  2. rarità
                                                                  3. shiny
                                                                  4. occhi
                                                                  5. cappello
                                                                  6. stat
```

**L'ordine delle estrazioni è parte dell'identità.** Riordinarlo, o toccare il salt, rigenera
i buddy di tutti. È il motivo per cui in `bones.mjs` c'è un commento che dice di non farlo.

### Rarità

| Rarità | Probabilità | Stelle | Pavimento stat | Cappello |
|---|---|---|---|---|
| Common | 60 % | ★ | 5 | nessuno |
| Uncommon | 25 % | ★★ | 15 | casuale |
| Rare | 10 % | ★★★ | 25 | casuale |
| Epic | 4 % | ★★★★ | 35 | casuale |
| Legendary | 1 % | ★★★★★ | 50 | casuale |

Verificato su 200 000 id: `59,94 / 24,99 / 9,97 / 4,07 / 1,03 %`.

**Shiny**: 1 % indipendente dalla rarità → una Shiny Legendary è ~1 su 10 000 (misurato 0,01 %).
Lo shimmer non è un colore fisso: la tinta scorre lungo il corpo a ogni frame.

### Stat

Cinque stat su 0-100: `DEBUGGING`, `PATIENCE`, `CHAOS`, `WISDOM`, `SNARK`.
Ogni buddy ha una stat **di punta** e una **scaricata**, con le formule del sorgente:

- punta = `floor + 50 … floor + 79`, tetto 100
- scaricata = `floor − 10 … floor + 4`, pavimento 0
- le altre tre il sorgente non le specifica: qui restano una banda intermedia.

Verificato su 300 000 id — la punta cade esattamente negli intervalli che la fonte dichiara:

| Rarità | Punta attesa | Punta misurata | Scaricata misurata |
|---|---|---|---|
| Common | 55–84 | 55–84 | 0–9 |
| Uncommon | 65–94 | 65–94 | 5–19 |
| Rare | 75–100 | 75–100 | 15–29 |
| Epic | 85–100 | 85–100 | 25–39 |
| Legendary | 100 | 100 | 40–54 |

Secondo la fonte, alla prima analisi stat e shiny erano **codice morto** — estratti e mai
letti. Dopo il rilascio hanno cominciato a influenzare nome e personalità.

### Cappelli

| Cappello | Sprite | Chi lo può avere |
|---|---|---|
| none | *(riga vuota)* | i Common hanno **sempre** questo |
| crown | `\^^^/` | tutte le altre rarità |
| tophat | `[___]` | tutte le altre rarità |
| propeller | `-+-` | tutte le altre rarità |
| halo | `(   )` | tutte le altre rarità |
| wizard | `/^\` | tutte le altre rarità |
| beanie | `(___)` | tutte le altre rarità |
| tinyduck | `,>` | tutte le altre rarità |

⚠️ **La regola vera è più semplice di quella dell'articolo.** L'articolo dava soglie per
cappello (Aureola=Rare+, Berretto=Epic+, Papera=solo Legendary): il sorgente non le ha. I
Common prendono sempre `none`, **tutte le altre rarità estraggono dall'insieme completo** —
`none` compreso. Misurato su 200 000 id: `none` 64,9 % (i 60 % di Common più un ottavo del
resto), ognuno degli altri sette ~5 %.

## La stat card

L'articolo non contiene un mockup della card, ma contiene **uno screenshot** di una vera
(`/images/blog/claude-buddy-shiny-legendary-dragon.jpg`: Dagmar, Shiny Legendary Dragon, CHAOS
100). L'impaginazione è ripresa da lì, non inventata:

```
╭──────────────────────────────────────────────╮
│                                              │
│  ★★★★★ LEGENDARY                     DRAGON  │
│  ✨ SHINY ✨                                   │
│                                              │
│      o[~~~~]                                 │
│       \^^^/                                   │
│      /^\  /^\                                 │
│     <  *  *  >                               │
│      (   ~~   )                              │
│       `-vvvv-´                               │
│                                              │
│  Dagmar                                      │
│                                              │
│  "Un feroce guardiano del codice pulito:     │
│  sputa fuoco sulla logica a spaghetti e      │
│  accumula funzioni scritte bene."            │
│                                              │
│  DEBUGGING  ████████░░    78                 │
│  PATIENCE   ██████░░░░    64                 │
│  CHAOS      █████████░    87                 │
│  WISDOM     █████░░░░░    50                 │
│  SNARK      ██████████   100                 │
│                                              │
╰──────────────────────────────────────────────╯
```

Lo screenshot mostra anche una cosa che avevo sbagliato altrove: la riga del prompt è
`/buddy`, **senza argomenti**, e l'output è la card. La schiusa culmina lì — non in uno sprite
con un fumetto accanto, come faceva la mia versione. I fumetti stanno accanto al **box di
input** (la statusLine, vedi il watcher), non nell'output del comando.

Cosa viene dallo screenshot, contro la mia prima versione:

| | Dallo screenshot | La mia prima versione (sbagliata) |
|---|---|---|
| Impaginazione | **colonna singola** | sprite affiancato ai dati |
| Testata | rarità a sinistra, **specie in maiuscolo a destra** | solo rarità |
| Shiny | riga propria `✨ SHINY ✨` | inline fra i dati |
| Nome | riga propria, in evidenza | accanto allo sprite |
| Personalità | **c'è**, tra virgolette e in corsivo | assente |
| Barre | un colore unico e smorzato | colorate per valore (verde/giallo/rosso) |
| Bordo e sprite | colore della rarità (oro sui Legendary) | bordo neutro, sprite col colore della specie |
| Occhi, cappello, schiusa, overall | **non ci sono** | c'erano tutti |
| Nome della specie | nel colore della rarità | grigio spento |
| Cosa stampa `/buddy` senza argomenti | **la card** | sprite + fumetto |

Occhi, cappello, data di schiusa e overall restano leggibili da `status` e `json`: la card è
quella dell'articolo, non un cruscotto.

Due dettagli che sembrano cosmetici e non lo sono:

- **`✨` occupa due colonne.** Contarla una sfasa il bordo destro di due caratteri sulla sola
  riga dello shiny. `vlen()` tratta come larghi i piani emoji e `U+2728`, ma **non** `★`/`☆`:
  Unicode li dà "ambigui" e i terminali occidentali li rendono stretti — contarli doppi
  romperebbe la riga della rarità.
- **La riga del cappello è vuota sui Common**, e va scartata o la card si apre con due righe
  bianche di fila.

## Bones e soul

È la parte interessante dell'architettura originale, e qui è riprodotta alla lettera.

**Bones** — specie, rarità, shiny, occhi, cappello, stat. Ricalcolate da zero a ogni
esecuzione partendo dallo userId, **mai scritte su disco**. Nel merge finale:

```js
return hydrate({ ...stored, ...bones });   // le bones fresche vincono, sempre
```

Modificare `state.json` per darsi un Legendary non ha alcun effetto: al giro dopo viene
sovrascritto. È un anti-cheat elegante per una feature che è tecnicamente uno scherzo — segno
che chi l'ha scritta sapeva benissimo che qualcuno ci avrebbe provato.

**Soul** — nome, personalità, data di schiusa. Generati **una volta sola**, alla schiusa, e
persistiti. Sono l'unico dato che sopravvive. Il soul è legato al suo proprietario
(`ownerHash`): con un altro account il vecchio soul non vale e il buddy va rischiuso.

### Come nasce il nome, davvero

Non per sillabe (era una mia invenzione). Nell'originale il modello riceve rarità, specie,
stat e **quattro parole d'ispirazione** pescate da un banco, con questo prompt di sistema —
riprodotto verbatim in `soul.mjs` (`buddy.mjs prompt` lo stampa):

> A name: ONE word, max 12 characters. Memorable, slightly absurd. No titles, no "the X", no
> epithets. Think pet name, not NPC name. The inspiration words are loose anchors — riff on
> one, mash two syllables, or just use the vibe. Examples: Pith, Dusker, Crumb, Brogue,
> Sprocket. […] Higher rarity = weirder, more specific, more memorable. A legendary should be
> genuinely strange.

Il messaggio utente ha un formato preciso, che `peek` restituisce già pronto in `soulRequest`:

```
Generate a companion.
Rarity: UNCOMMON
Species: cactus
Stats: debugging:60 patience:76 chaos:17 wisdom:14 snark:39
Inspiration words: jostle, tuft, zest, velvet
Make it memorable and distinct.
```

Quando la chiamata all'LLM falliva, l'originale ripiegava su **sei nomi fissi**: *Crumpet,
Soup, Pickle, Biscuit, Moth, Gravy*. Sono quelli che usa `defaultSoul()` qui, così lo script
funziona anche lanciato a mano senza modello.

Il banco d'ispirazione: la fonte lo descrive come da **156 parole** ma la pagina ne elenca
**146**. Ci sono quelle 146; non ne ho inventate dieci per far quadrare il conto.

## Le 18 specie e i nomi hex-encoded

Ordine **del sorgente**, che non è quello della tabella dell'articolo (raggruppata per
categoria):

`duck, goose, blob, cat, dragon, octopus, owl, penguin, turtle, snail, ghost, axolotl,
capybara, cactus, robot, rabbit, mushroom, chonk`

⚠️ **L'ordine è parte dell'identità.** Con l'ordine dell'articolo ogni seed produce una specie
diversa: è uno degli errori che ho corretto solo dopo aver trovato il sorgente ricostruito.

I nomi **non sono stringhe in chiaro**: sono array di code point decodificati con
`String.fromCharCode`. Non è offuscamento, è il dettaglio migliore di tutta la storia — la
build ha uno scanner (`excluded-strings.txt`) che intercetta certe stringhe in compilazione, e
almeno un nome di specie coincide con un codename interno di modello. Codificarne uno solo si
sarebbe notato; sono codificati tutti e 18.

```js
String.fromCharCode(0x63, 0x61, 0x70, 0x79, 0x62, 0x61, 0x72, 0x61); // "capybara"
```

### Il canvas: 5 righe, e la prima è contesa

Ogni specie ha **3 frame da 5 righe × 12 colonne**. La **prima riga** è la riga alta, e ha due
padroni: la occupa il **cappello**, e dove il cappello non c'è la usa l'animazione della specie
— il fumo del drago, l'inchiostro del polpo, le spore del fungo, l'antenna del robot. Con un
cappello quegli effetti si perdono: è così anche nell'originale («hat replaces the blank top
line»).

Le sprite sono estratte dalla fonte, non ridisegnate: `species.mjs` è **generato**, non scritto
a mano, per non introdurre errori di trascrizione.

### Occhi: 6, e sono un carattere solo

`·` (default, calmo) · `✦` (entusiasta) · `×` (stordito o malizioso) · `◉` (all'erta) ·
`@` (robotico) · `°` (sorpreso, sguardo vacuo)

Il token nello sprite è **`{E}`**, come nel sorgente, e vale **un** carattere: quante volte
compare lo decide lo sprite. Il duck ha un occhio, la lumaca uno («single eye species»), gli
altri due.

## Terminali stretti

Il pet non deve mai rompere il layout:

| Larghezza | Resa |
|---|---|
| ≥ 40 col | sprite + fumetto affiancato, coda all'altezza degli occhi |
| 24-39 col | sprite, poi il testo sotto con prefisso `»` |
| < 24 col | una riga: nome, specie, testo a capo |

I colori si spengono da soli se `stdout` non è un terminale o se c'è `NO_COLOR`. Le animazioni
si spengono se non c'è un TTY o con `--no-anim`: in pipe l'output resta statico e pulito.

## Stato su disco

`~/.claude/buddy/state.json` (override con `CLAUDE_BUDDY_STATE`):

```json
{
  "soul":  { "name": "…", "personality": "…", "hatchedAt": "…", "ownerHash": 1234567890 },
  "prefs": { "muted": false, "hidden": false }
}
```

L'identità viene cercata in quest'ordine: `--user` → `CLAUDE_BUDDY_USER` →
`userID` in `~/.claude.json` → `utente@host` come ripiego. Lo `userID` di Claude Code è già un
hash e non viene mai stampato.

## Il watcher — la parte che è *il punto*

Dall'articolo, e per un po' me l'ero perso:

> *"Your buddy reacts to your session activity."*
> *"When unmuted, it can comment in speech bubbles that appear **beside the terminal input**."*
> *"The system prompt tells Claude that the buddy is a "separate watcher" and Claude should stay
> out of the way when the user addresses the buddy by name."*

Il buddy **non è un comando che mostra una card**: è una presenza accanto a dove scrivi, che
commenta la sessione. In Claude Code l'unico posto che sta stabilmente lì è la `statusLine` — e
il payload che riceve è la finestra del buddy sulla sessione:

| Segnale | Da dove | Soglia |
|---|---|---|
| Contesto quasi pieno | `context_window.used_percentage` | ≥ 90 %, poi ≥ 70 % |
| Limite di utilizzo | `rate_limits.five_hour.used_percentage` | ≥ 85 % |
| Tool che falliscono | `tool_result.is_error` nel transcript | ≥ 3 |
| `git push --force` | comandi `Bash` nel transcript | ≥ 1 |
| Rebase ripetuti | comandi `Bash` | ≥ 2 |
| Raffica di commit | comandi `Bash` | ≥ 3 |
| Molti file toccati | `Edit` + `Write` | ≥ 8 |
| Molte ricerche | `Grep` + `Glob` | ≥ 6 |
| Vita in shell | `Bash` | ≥ 12 |

**Ogni battuta è agganciata a una soglia vera.** Se nessuna scatta, il buddy dice una cosa
generica in carattere invece di inventarsi un dato: un pet che si spara numeri finti sarebbe
peggio di un pet muto.

`mute` **silenzia il fumetto ma lascia il buddy** — nell'articolo è "silence speech bubbles",
non "nascondilo"; per quello c'è `off`.

### Due vincoli, perché gira a ogni refresh

- **Niente scritture.** La battuta è scelta da un seed deterministico su finestre di 30 s
  (`fnv1a(chiave osservazione + finestra + nome)`): resta ferma mentre la leggi, cambia da sé,
  e non persiste niente.
- **Niente lentezza.** Il transcript di una sessione vera arriva a decine di MB, quindi si
  legge **solo la coda** (512 KB) con `readSync` posizionato, non `readFileSync`. Misurato:
  **77 ms** su un transcript da 17 MB.

Una lezione presa sbagliando: la prima versione leggeva 64 KB e teneva "le ultime 60 righe".
Su un transcript reale le righe sono enormi (thinking, snapshot dei file) — in 64 KB ce ne
stanno **una o due**, e il taglio a 60 righe non voleva dire niente. Trovava zero attività
sempre. Il tetto ora è sulle *entry effettivamente analizzate*, non sulle righe grezze.

### Degradazione sui terminali stretti

Il fumetto entra solo se ci sta: la barra non deve mai andare a capo.

| Larghezza | Resa |
|---|---|
| ≥ ~90 col | identità + fumetto intero |
| ~45-90 col | fumetto troncato con `…` |
| < ~45 col | solo identità, fumetto lasciato cadere |

## Il buddy nella statusLine

`bar` innesta il buddy nella `statusLine` di Claude Code **senza sostituire quello che c'è
già**: `engine/statusline.mjs` riesegue il comando preesistente passandogli lo stesso stdin,
e ci monta il buddy nella posizione scelta.

```bash
node engine/buddy.mjs bar            # stato
node engine/buddy.mjs bar bottom     # innesta
node engine/buddy.mjs bar off        # togli
```

| Posizione | Resa |
|---|---|
| `bottom` | riga tutta sua, sotto la statusline esistente |
| `top` | riga tutta sua, sopra tutto |
| `append` | in coda all'ultima riga, dopo un `│` |
| `prepend` | in testa all'ultima riga, prima di un `│` |

Il comando originale viene salvato in `state.json` come `wraps` — non si perde, e `bar off`
lo rimette esattamente dov'era.

### Perché non riscriviamo settings.json con JSON.stringify

`~/.claude/settings.json` è un file curato a mano. Rigenerarlo ne perderebbe la formattazione
e renderebbe il diff illeggibile. `bar.mjs` fa invece una sostituzione **chirurgica** del solo
valore di `statusLine.command`, preservando anche la spaziatura intorno ai due punti, con
backup in `settings.json.bak-buddy` e `JSON.parse` di validazione *prima* di scrivere. Il
round-trip `bar bottom` → `bar off` restituisce il file byte per byte identico (verificato).

### Statusline che si riappropriano di settings.json

Alcune statusline di terze parti sono *anch'esse* wrapper a catena: girando si rimettono in
`statusLine.command` e spostano il comando che trovano in un file di catena proprio. Su questa
macchina lo fa la statusline dei kickbacks (`~/.kickbacks/vibe-ads-statusline.mjs`, catena in
`~/.kickbacks/cli-prev-statusline.json`).

Quando succede, la catena reale diventa:

```
settings.json → kickbacks → (cli-prev-statusline.json) → statusline.mjs → (wraps) → HUD originale
                   ad·                                       ★ buddy          ctx │ no-git │ Opus 5
```

`bar` riconosce la situazione e riporta **`innestato in catena`**: in quel modo NON riscrive
`settings.json` — riprendersela significherebbe farsi catturare di nuovo e, peggio, perdere il
comando che quella statusline aveva già in catena. Si aggiorna solo `state.json`.

Il caso patologico è il **ciclo**: se il nostro `wraps` punta a chi ci ha catturati, i due si
chiamano a vicenda. `bar` lo segnala e si corregge con:

```bash
node engine/buddy.mjs bar bottom --wraps 'bash "/Users/…/.claude/statusline-command.sh"'
```

A runtime il wrapper rifiuta comunque di eseguire un `wraps` che punta a se stesso o al
comando attualmente in `settings.json`: il peggio che accade è una riga in meno.

### Il wrapper non può rompere la barra

Gira a ogni refresh, quindi ha tre regole rigide:

- **non fallisce mai** — se il comando avvolto esplode o non esiste, esce `0` e stampa il solo
  buddy; se è il buddy a rompersi, stampa la sola statusline originale;
- **non schiude mai il pet** — è sola lettura, e se il buddy non è ancora schiuso la barra
  resta esattamente come prima;
- **non si blocca mai** — il processo figlio ha un timeout di 2,5 s e viene ucciso.

Rispetta anche `off`/`on`: a pet nascosto la riga del buddy scompare. Costo misurato: ~0,3 s
per refresh, quasi tutto avvio di Node.

## Differenze dall'originale

Non è un port del codice originale — quello non l'ho visto. È una ricostruzione dalla
descrizione, quindi:

- **Battute, nomi e personalità sono miei**, e 17 sprite su 18: l'articolo dà le misure
  (5 × 12, 3 frame) e i nomi delle specie, non i disegni. L'eccezione è il dragone, ripreso
  dallo screenshot della card, da cui viene anche l'impaginazione della card stessa.
- **L'ordine delle estrazioni** non è documentato nell'articolo: qui è specie → rarità → shiny
  → occhi → cappello → stat. Con un ordine diverso le probabilità sono identiche ma i singoli
  buddy no.
- **Le formule delle stat** rispettano la descrizione ("una di punta, una scaricata, tre
  sparse") con costanti scelte da me.
- **Lo stato sta in `~/.claude/buddy/state.json`**, non nel config globale di Claude Code:
  scrivere dentro i file di configurazione del CLI per un pet non vale il rischio.
- **Niente gating.** L'originale stava dietro un feature flag di compilazione `BUDDY`, con
  finestra teaser dal 1° al 7 aprile (notifica `/buddy` arcobaleno di 15 secondi all'avvio),
  comando permanente dall'8 via `isBuddyLive` e accesso perenne per i dipendenti Anthropic
  (`USER_TYPE = 'ant'`). Qui funziona subito.
- **Nessun requisito di abbonamento**: l'originale voleva Claude Code ≥ 2.1.89 e un piano Pro.
- **La personalità la scrive il modello solo alla schiusa.** Nell'originale è l'LLM a produrre
  anche le battute dei fumetti; qui il modello le compone quando passi da `/buddy`, mentre la
  statusLine — che gira decine di volte al minuto — usa il watcher con soglie reali. Chiamare
  un modello a ogni refresh della barra non è una scelta difendibile.

### Quello che avevo inventato senza saperlo

Il primo giro l'ho fatto sull'articolo divulgativo, che dà le misure ma non i dati. Trovato il
reverse engineering del leak, queste cose erano da rifare:

| | Mio (inventato) | Vero (dal sorgente) |
|---|---|---|
| **Identità** | `userID` di `~/.claude.json` | `oauthAccount.accountUuid ?? userID ?? "anon"` — sulla stessa macchina sono **diversi**, quindi avevo il pet sbagliato |
| **Ordine specie** | quello della tabella dell'articolo | quello del sorgente: `duck, goose, blob, cat, dragon, …` |
| **Sprite** | 18 disegnate da me | le 18 vere, estratte dalla fonte |
| **Occhi** | 8 varianti, coppie di 2 caratteri (`oo`, `••`) | **6**, un carattere solo (`· ✦ × ◉ @ °`), token `{E}` |
| **Cappelli** | soglie per rarità | Common sempre `none`, tutti gli altri estraggono da tutti e 8 |
| **Riga alta** | riga in più per il cappello | il cappello **sostituisce** la riga alta, contesa con gli effetti della specie |
| **Punta / scaricata** | `floor+50+r(0..25)` / `floor+r(0..5)` | `floor+50…+79` / `floor−10…+4` |
| **Nome** | generatore a sillabe | LLM con **4 parole d'ispirazione** da un banco, o 6 nomi fissi di riserva |
| **Personalità** | due tratti + un tic | **una frase sola**, un tic che si vede nei commenti al codice |

Nota su shiny: la fonte (scritta prima del rilascio) dice che era codice morto, «no visual
difference». Lo screenshot post-rilascio invece mostra `✨ SHINY ✨` e il bordo dorato, quindi
qui lo shiny **si vede** — seguo lo screenshot, che è più recente.

### Il pet invisibile

La svista peggiore non era di fedeltà, era di consegna: per diversi giri ho lanciato `card` e
poi **descritto a parole** il risultato. L'output del tool Bash arriva al modello, non
all'utente — che nel suo terminale vedeva solo `Ran 2 shell commands` e una riga di prosa.
La card esisteva, era corretta, e nessuno l'aveva mai vista.

Per questo `SKILL.md` apre con la regola: lanciare con `NO_COLOR=1` e **incollare l'output
verbatim** nella risposta. I colori restano dove un terminale li interpreta davvero (la
`statusLine`, e lo script lanciato a mano), non in chat, dove le sequenze ANSI diventano
spazzatura in mezzo al markdown.

### Sviste mie, corrette leggendo la fonte per intero

Il primo passaggio l'ho fatto su un riassunto della pagina, e mi era costato tre cose:

1. **L'impaginazione della card**, inventata invece che presa dallo screenshot (vedi sopra).
2. **Il watcher**, cioè il comportamento centrale: avevo costruito un comando da lanciare, non
   una presenza che commenta la sessione.
3. Il dettaglio che Claude Code **ha già** un compagno accanto al box di input — un piccolo
   capibara chiamato **Jetsam** — di cui il Buddy system è l'ampliamento. Spiega perché il
   capibara è "Special" e perché è proprio quel nome a essere hex-encoded.

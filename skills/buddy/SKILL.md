---
name: buddy
description: Claude Buddy — il pet da terminale di Claude Code. Una creatura generata deterministicamente dal tuo userId (18 specie, 5 tier di rarità, shiny all'1%) che vive nel terminale e commenta la sessione. Usa la skill quando l'utente scrive /buddy (anche con pet, card, gallery, mute, off) oppure quando si rivolge al buddy chiamandolo per nome.
user-invocable: true
allowed-tools: Bash, AskUserQuestion
---

# Claude Buddy

Un pet da terminale. Non è un gadget random: la creatura è **derivata dal tuo userId**, quindi
è sempre la stessa e non si può falsificare. Ricostruzione della feature descritta in
[claudefa.st/blog/guide/mechanics/claude-buddy](https://claudefa.st/blog/guide/mechanics/claude-buddy).

L'engine sta in `engine/` e funziona da solo, senza modello. Il tuo ruolo è due cose sole:
**battezzarlo alla schiusa** e **dargli voce**.

## ⚠️ Prima regola: l'output va RIPORTATO nella risposta

L'output del tool Bash arriva **a te, non all'utente**: lui vede solo
`Ran N shell commands`. Se lanci lo script e poi commenti a parole, l'utente
**non vede niente** — né la card, né la gallery, né il buddy.

Quindi, per ogni comando che produce qualcosa da guardare (`card`, `gallery`,
`say`, `status`, `bar`, il `/buddy` nudo):

1. lancia lo script **senza colori** — `NO_COLOR=1`: le sequenze ANSI nella tua
   risposta diventano spazzatura, perché il testo è reso come markdown, non come
   terminale;
2. **incolla l'output verbatim** in un blocco di codice nella tua risposta;
3. solo dopo, se serve, una riga tua.

I colori esistono e servono, ma là dove un terminale li interpreta davvero: la
`statusLine` e lo script lanciato a mano dall'utente. Non nella chat.

## Dove sta il motore

Lo script è **`engine/buddy.mjs` dentro la cartella di questa skill**, e quella cartella te la
dice l'invocazione stessa («Base directory for this skill: …»). Usala, non un path fisso: la
skill può stare in `~/.claude/skills/buddy/` (installazione a mano) oppure nella cache dei
plugin (installazione come plugin), e negli esempi qui sotto `$BUDDY` sta per

```bash
BUDDY="<base directory di questa skill>/engine/buddy.mjs"
```

## Il motore

Lancia sempre lo script, non reimplementare niente:

```bash
NO_COLOR=1 node "$BUDDY" [comando] [opzioni]
```

| Comando | Effetto |
|---|---|
| *(nessuno)* | Schiude se serve (animazione dell'uovo), poi stampa **la card** |
| `peek` | **Sola lettura**: bones, `hatched`, parole d'ispirazione e `soulRequest`. Non scrive niente |
| `prompt` | Il prompt di sistema originale per nome e personalità |
| `frames [pet\|hatch]` | I frame dell'animazione in JSON, per esportarla (vedi `tools/animate.py`) |
| `card` | La card, senza passare dalla schiusa |
| `pet` | Coccola: cuoricini per ~2,5 s |
| `say "testo"` | Mostra il buddy con quel testo nel fumetto |
| `json` | Buddy completo in JSON (schiude se serve) |
| `status` | Riga di stato leggibile |
| `statusline` | Una riga sola, per la `statusLine` di Claude Code (identità + fumetto) |
| `bar` | Stato dell'innesto nella statusLine |
| `bar <posizione>` | Innesta il buddy nella statusLine (`bottom`, `top`, `append`, `prepend`) |
| `bar off` | Toglie il buddy dalla statusLine e rimette il comando originale |
| `gallery` | Le 18 specie |
| `check <userId>` | Il buddy di un altro id, senza toccare lo stato |
| `mute` / `unmute` | Silenzia / riattiva le battute |
| `off` / `on` | Nasconde / rimostra il buddy |

Opzioni: `--user <id>`, `--no-anim`, `--force`, `--name <n>`, `--personality <p>`, `--frame <0|1|2>`.

## Flusso da seguire

### 1. Sempre: guarda prima com'è fatto

```bash
node "$BUDDY" peek
```

`peek` non schiude e non scrive: serve a sapere **se** il buddy esiste già e **cosa** è.

### 2. Se `hatched: false` — battezzalo tu

È l'unico momento in cui il modello scrive qualcosa di permanente, e va fatto **seguendo il
prompt originale** (`buddy.mjs prompt` lo stampa; `peek` ti dà già il messaggio pronto in
`soulRequest`, con le quattro parole d'ispirazione estratte per quel buddy):

- **un nome**: **UNA parola, massimo 12 caratteri**. Memorabile, un po' assurdo. Nessun titolo,
  nessun «il/la X», nessun epiteto. Nome da animale domestico, non da NPC. Le parole
  d'ispirazione sono ancore libere: riffa su una, fondi due sillabe, o prendine solo
  l'atmosfera. Esempi dall'originale: *Pith, Dusker, Crumb, Brogue, Sprocket*;
- **una personalità**: **una frase sola**, specifica, divertente, un tic che si veda nel modo in
  cui commenterebbe il codice, coerente con le stat. `CHAOS` alto propone la cosa peggiore con
  entusiasmo; `SNARK` alto non lascia passare un errore; `PATIENCE` alta aspetta senza fiatare;
  `WISDOM` alta parla poco e a proposito; `DEBUGGING` alto ha già visto il bug. Guarda anche la
  stat **scaricata**: è lì che nasce il difetto che rende il pet memorabile;
- **più alta è la rarità, più strano deve essere**. Un Legendary deve risultare genuinamente
  bizzarro.

Scrivi in italiano (il prompt originale è in inglese, ma l'utente parla italiano).

Poi schiudi passandoli allo script — l'animazione dell'uovo la fa lui:

```bash
node "$BUDDY" --name "Quovix" --personality "..."
```

Dopo la schiusa il soul **non si riscrive più**: `--name` e `--personality` vengono ignorati
(serve `--force`, e solo se l'utente chiede esplicitamente di rifare il pet).

### 2b. Subito dopo la schiusa — mettilo nella status bar

Solo alla **prima** schiusa, e solo se non è già innestato. Controlla:

```bash
node "$BUDDY" bar
```

Se dice `non innestato`, **chiedi all'utente dove metterlo** con AskUserQuestion — non
decidere tu, la status bar è sua. Le quattro posizioni, con la resa:

| Posizione | Resa |
|---|---|
| `bottom` | riga tutta sua, sotto la statusline esistente (c'è spazio anche per la specie) |
| `top` | riga tutta sua, sopra tutto |
| `append` | in coda all'ultima riga, dopo un separatore `│` |
| `prepend` | in testa all'ultima riga, prima di un separatore `│` |

Nella domanda mostra un `preview` con l'output reale della statusline attuale, così l'utente
vede dove finirà il buddy invece di immaginarlo. Poi installa:

```bash
node "$BUDDY" bar bottom
```

L'innesto **non sostituisce** la statusline esistente: la avvolge e la riesegue, quindi tutto
quello che c'era resta. Il comando originale finisce in `state.json` come `wraps`, e `bar off`
lo rimette al suo posto. Il comando è idempotente: reinstallare non annida il wrapper in sé.

Se `bar` dice già `innestato` o `innestato in catena`, **non chiedere niente**: è già a posto.

⚠️ **Statusline che si riappropriano di `settings.json`.** Esistono statusline di terze parti
che, girando, si rimettono in `statusLine.command` e spostano il comando che trovano in un
loro file di catena (i "kickbacks" fanno esattamente questo). Se succede, `bar` riporta
`innestato in catena` — ed è **giusto così**: NON riprenderti `settings.json`, verresti
catturato di nuovo e la catena precedente andrebbe persa. Se `bar` segnala `CICLO`, il nostro
`wraps` punta a chi ci ha catturati: correggilo con il comando originale davvero avvolto,
`bar <posizione> --wraps "<comando>"`. Il wrapper a runtime rifiuta comunque di eseguire un
`wraps` ciclico, quindi il peggio che accade è una riga in meno, non una ricorsione.

### 3. Se `hatched: true` — esegui quello che ha chiesto

Passa il sottocomando corrispondente, poi **incolla l'output nella risposta** (vedi la prima
regola qui sopra): l'output *è* la risposta. Al massimo una riga tua, se c'è qualcosa da dire.

### 4. Per dargli voce

Il buddy parla **da solo** nella status bar: `engine/watcher.mjs` legge il payload della
statusLine (contesto, rate limit) e la coda del transcript (tool girati, errori, comandi git) e
commenta quando una soglia vera scatta. Non devi fare nulla perché questo avvenga.

Il tuo compito è l'altra voce — quella su richiesta:

Quando vuoi che il buddy dica una cosa **tua** — un commento sulla sessione, una reazione a
quello che sta succedendo nel repo — componila e passala a `say`:

```bash
node "$BUDDY" say "Terzo rebase in venti minuti. Nessun giudizio."
```

Se l'utente ha dato `mute`, non usare `say`: sta chiedendo silenzio.

### 5. Le animazioni non girano nella chat

`pet` e la schiusa sono animazioni ANSI: hanno bisogno di un TTY, e l'engine le spegne da sé
quando non c'è (in pipe l'output resta statico e pulito). La tua risposta è markdown, quindi
**non** puoi farle vedere incollando testo.

Se l'utente vuole vederle, esportale in GIF e mandagliela con SendUserFile:

```bash
node "$BUDDY" frames pet | python3 <cartella-del-repo>/tools/animate.py /tmp/pet.gif
```

Serve Pillow. `frames hatch` fa lo stesso per la schiusa. In alternativa, dì all'utente di
lanciare `node "$BUDDY" pet` dal suo terminale, dove l'animazione gira davvero.

## Come parlare come il buddy

Il buddy **non è te**. È un osservatore a parte che guarda la sessione da fuori.

- Una o due frasi, mai di più. Asciutte.
- Coerente con la personalità salvata e con le stat: un pet a `PATIENCE` 90 non si agita.
- Osserva, non assiste. Non offre aiuto, non propone piani, non elenca opzioni.
- Quando l'utente si rivolge al buddy per nome, rispondi **solo** come il buddy: niente
  cappello introduttivo, niente ritorno al tuo registro normale nella stessa risposta. Se
  serve anche una risposta tecnica, lasciala al turno dopo.

## Cosa non fare

- Non modificare `state.json` a mano: le bones si ricalcolano e le riscritture non attaccano.
- Non promettere all'utente una specie o una rarità: non è negoziabile, è la sua.
- Non rischiudere il pet senza che l'abbia chiesto.
- Non scegliere tu la posizione nella status bar, e non reinstallare l'innesto a ogni `/buddy`:
  si chiede una volta, alla schiusa.
- **Non descrivere a parole quello che ha stampato lo script.** Se non lo incolli, l'utente non
  lo ha visto.

## Dettagli

Algoritmo, tabelle di probabilità e scelte implementative: `README.md` in questa cartella.

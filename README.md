# Claude Buddy

Un **pet da terminale** per Claude Code. Non è un gadget casuale: la creatura è derivata
deterministicamente dal tuo account id, quindi è sempre la stessa e non si può falsificare.
18 specie, 5 tier di rarità, 6 varianti di occhi, 8 cappelli — e un *watcher* che commenta
la sessione accanto a dove scrivi.

```
╭────────────────────────────────────────────╮
│                                            │
│  ★★☆☆☆ UNCOMMON                    CACTUS  │
│                                            │
│        /^\                                 │
│     n  ____  n                             │
│     | |°  °| |                             │
│     |_|    |_|                             │
│       |    |                               │
│                                            │
│  Tuftle                                    │
│                                            │
│  "Aspetta qualunque build senza fiatare,   │
│  e quando finalmente parla dice una cosa   │
│  che non c'entra niente."                  │
│                                            │
│  DEBUGGING  ██████░░░░    60               │
│  PATIENCE   ████████░░    76               │
│  CHAOS      ██░░░░░░░░    17               │
│  WISDOM     █░░░░░░░░░    14               │
│  SNARK      ████░░░░░░    39               │
│                                            │
╰────────────────────────────────────────────╯
```

È la ricostruzione di **Claude Buddy**, la feature April Fools 2026 di Claude Code, emersa da
un source map finito per errore nel pacchetto npm e **rimossa in v2.1.97**. Qui è riprodotta a
partire dai dati del sorgente ricostruito: sprite, ordine delle specie, formule delle stat,
regole dei cappelli e prompt di sistema sono quelli veri. Vedi [`NOTICE.md`](NOTICE.md) per la
provenienza e [`skills/buddy/README.md`](skills/buddy/README.md) per l'algoritmo nel dettaglio.

## Requisiti

- **Node ≥ 18** (nessuna dipendenza: solo libreria standard)
- Claude Code, per usarlo come `/buddy`. L'engine funziona anche da solo, lanciato a mano.

## Installazione

### Come plugin (consigliato)

```
/plugin marketplace add <url-di-questo-repo>
/plugin install claude-buddy@claude-buddy
```

### A mano

```bash
git clone <url-di-questo-repo> claude-buddy
cd claude-buddy && ./install.sh
```

`install.sh` copia `skills/buddy/` in `~/.claude/skills/buddy/`, senza toccare nulla d'altro.
Con `--force` sovrascrive un'installazione esistente.

## Uso

```
/buddy              schiude (la prima volta) e stampa la card
/buddy card         la card
/buddy pet          coccola: cuoricini per ~2,5 s
/buddy gallery      tutte le 18 specie
/buddy mute         silenzia le battute (il pet resta)
/buddy off          nascondi il pet
/buddy bar bottom   innesta il pet nella status bar
```

Oppure direttamente:

```bash
node skills/buddy/engine/buddy.mjs card
node skills/buddy/engine/buddy.mjs check <un-altro-account-id>   # il buddy di qualcun altro
node skills/buddy/engine/buddy.mjs gallery
```

## Il pet nella status bar

`buddy.mjs bar <bottom|top|append|prepend>` innesta il pet nella `statusLine` di Claude Code
**senza sostituire** quello che c'è già: il wrapper riesegue il comando preesistente e ci monta
il buddy accanto. `bar off` rimette tutto come era, byte per byte.

Da lì il *watcher* commenta la sessione quando una soglia vera scatta — contesto quasi pieno,
limite di utilizzo, tool che falliscono, `git push --force`, rebase ripetuti:

```
ctx █████████░ 91% │ no-git │ Opus 5
★ (°) Tuftle · cactus  « Al 91% di contesto. Salva quello che ti serve ricordare. »
```

## Dove finiscono i dati

| Cosa | Dove |
|---|---|
| Nome, personalità, data di schiusa, preferenze | `~/.claude/buddy/state.json` |
| Specie, rarità, occhi, cappello, stat | **da nessuna parte**: ricalcolati a ogni esecuzione |
| Identità | letta da `~/.claude.json` (`oauthAccount.accountUuid`), mai stampata |

Niente rete, niente telemetria: l'unica cosa che l'engine legge fuori da sé è la propria
configurazione e — per il watcher — la coda del transcript della sessione corrente.

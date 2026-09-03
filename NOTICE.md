# Provenienza e attribuzione

Questo repository è una **ricostruzione**, non un port e non una copia di codice originale.

## Cosa viene da dove

**La feature originale è di Anthropic.** Claude Buddy era il pesce d'aprile 2026 di Claude
Code, emerso in anticipo perché la versione 2.1.88 del pacchetto npm `@anthropic-ai/claude-code`
includeva per errore un source map. È stata **rimossa da Claude Code in v2.1.97**.

**I dati di gioco e le sprite ASCII** — le 18 sprite, l'ordine delle specie, le 6 varianti di
occhi, gli 8 cappelli, le formule di rarità e stat, il prompt di sistema per nome e
personalità, i 6 nomi di riserva e il banco di parole d'ispirazione — sono ripresi dal lavoro
di reverse engineering pubblicato qui:

- <https://variety.is/posts/claude-code-buddies/>

**L'impaginazione della stat card** è ricavata dallo screenshot pubblicato in:

- <https://claudefa.st/blog/guide/mechanics/claude-buddy>

**Il codice di questo repository è scritto da zero.** Nessun file del sorgente originale è
stato copiato: l'engine (RNG, generazione, rendering, animazioni, watcher, innesto nella
statusLine) è un'implementazione indipendente a partire dalla descrizione del comportamento.

## Perché non c'è un file di licenza

Le sprite ASCII e i dati di gioco sono opera originale di Anthropic, ricostruita da un leak.
**Non sono cose che io possa licenziare**, quindi non ci metto sopra una licenza che non
avrei il diritto di concedere. Il repo è pubblicato come esercizio tecnico e archeologia di
una feature dismessa.

Se sei di Anthropic e preferisci che questo materiale non circoli, basta dirlo.

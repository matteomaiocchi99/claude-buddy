/**
 * IL WATCHER — la parte che nell'articolo è *il punto*, e che mi era sfuggita.
 *
 *   "Your buddy reacts to your session activity."
 *   "When unmuted, it can comment in speech bubbles that appear beside the
 *    terminal input."
 *
 * Il buddy non è un comando che mostra una card: è una presenza accanto a dove
 * scrivi, che commenta quello che sta succedendo. Qui si legge il payload che
 * Claude Code passa alla statusLine (contesto, rate limit, modello, cartella) e
 * la coda del transcript (quali tool sono girati, se hanno fallito), e se ne
 * ricava un'osservazione.
 *
 * Due vincoli:
 *  - **niente scritture e niente lentezza**: gira a ogni refresh della barra.
 *    La battuta viene scelta da un seed deterministico su finestre di 30s, così
 *    resta stabile mentre la leggi e cambia da sola, senza persistere nulla;
 *  - **osservazioni vere**: ogni battuta è agganciata a una soglia reale. Se non
 *    c'è niente da osservare, il buddy dice una cosa generica invece di
 *    inventarsi un dato.
 */

import { openSync, readSync, closeSync, statSync } from 'node:fs';
import { fnv1a, mulberry32 } from './rng.mjs';
import { STATS } from './cosmetics.mjs';

/**
 * Coda di un file, letta davvero solo in coda: il transcript di una sessione
 * lunga arriva a decine di MB e questo gira a ogni refresh della barra.
 */
function tailFile(path, bytes = 512 * 1024) {
  let fd;
  try {
    const size = statSync(path).size;
    const start = Math.max(0, size - bytes);
    const len = size - start;
    if (len <= 0) return '';
    const buf = Buffer.allocUnsafe(len);
    fd = openSync(path, 'r');
    readSync(fd, buf, 0, len, start);
    return buf.toString('utf8');
  } catch {
    return '';
  } finally {
    if (fd !== undefined) { try { closeSync(fd); } catch { /* ignora */ } }
  }
}

/**
 * Che cosa è successo di recente nella sessione.
 * Solo fatti: quali tool, quanti, e se qualcosa ha fallito.
 */
function recentActivity(transcriptPath) {
  const text = tailFile(transcriptPath);
  if (!text) return null;

  // Le righe di un transcript vero sono enormi (thinking, snapshot dei file):
  // in mezzo mega di coda ce ne stanno poche decine, non centinaia. Si scarta
  // la prima (tagliata a metà dalla finestra) e si tiene un tetto sulle entry
  // effettivamente analizzate, non sulle righe grezze.
  const lines = text.split('\n').slice(1);
  const MAX_ENTRIES = 120;
  const tools = [];
  let errors = 0;
  let bashCommands = [];

  const entries = [];
  for (const line of lines) {
    if (!line.startsWith('{')) continue;
    try { entries.push(JSON.parse(line)); } catch { /* riga incompleta */ }
  }

  for (const entry of entries.slice(-MAX_ENTRIES)) {
    const content = entry?.message?.content;
    if (!Array.isArray(content)) continue;

    for (const block of content) {
      if (block?.type === 'tool_use' && block.name) {
        tools.push(block.name);
        if (block.name === 'Bash' && typeof block.input?.command === 'string') {
          bashCommands.push(block.input.command);
        }
      }
      if (block?.type === 'tool_result' && (block.is_error || block.isError)) errors++;
    }
  }

  if (!tools.length) return null;
  const counts = {};
  for (const t of tools) counts[t] = (counts[t] || 0) + 1;
  return { tools, counts, errors, bashCommands };
}

/** Conta le occorrenze di un pattern nei comandi bash recenti. */
const countCmd = (cmds, re) => cmds.filter((c) => re.test(c)).length;

/**
 * L'osservazione: `{ key, pool }`.
 * `key` identifica *cosa* ha notato (serve alla stabilità della battuta),
 * `pool` sono i modi di dirlo. Le soglie sono l'unica cosa che decide: senza
 * soglia superata, nessuna battuta su quel tema.
 */
export function observe(payload = {}, activity = null) {
  const ctx = Number(payload?.context_window?.used_percentage);
  const five = Number(payload?.rate_limits?.five_hour?.used_percentage);

  if (Number.isFinite(ctx) && ctx >= 90) {
    return { key: 'ctx-critico', pool: [
      `Contesto al ${Math.round(ctx)}%. Fra poco ti dimentichi di me.`,
      `Al ${Math.round(ctx)}% di contesto. Salva quello che ti serve ricordare.`,
    ]};
  }
  if (Number.isFinite(five) && five >= 85) {
    return { key: 'limite', pool: [
      `${Math.round(five)}% del limite di cinque ore. Fai le domande buone adesso.`,
      `Il serbatoio è al ${Math.round(five)}%. Dico solo questo.`,
    ]};
  }
  if (Number.isFinite(ctx) && ctx >= 70) {
    return { key: 'ctx-alto', pool: [
      `Contesto al ${Math.round(ctx)}%. Comincia a starci stretto.`,
      `Siamo al ${Math.round(ctx)}%. Ancora un po' e si compatta.`,
    ]};
  }

  if (activity) {
    const { counts, errors, bashCommands: cmds } = activity;

    if (errors >= 3) {
      return { key: 'errori', pool: [
        `${errors} tool andati male di fila. Non guardo, ma vedo.`,
        `${errors} errori. Il problema non è il tool.`,
      ]};
    }
    const force = countCmd(cmds, /git\s+push\b[^\n]*--force|push\s+-f\b/);
    if (force) return { key: 'force', pool: [
      'Ho visto un push --force. Non dirò niente a nessuno.',
      'Un `--force`. Coraggioso.',
    ]};

    const rebase = countCmd(cmds, /git\s+rebase\b/);
    if (rebase >= 2) return { key: 'rebase', pool: [
      `${rebase} rebase. La storia era già finita bene la prima volta.`,
      `Al ${rebase}° rebase. Nessun giudizio.`,
    ]};

    const commits = countCmd(cmds, /git\s+commit\b/);
    if (commits >= 3) return { key: 'commit', pool: [
      `${commits} commit. Questo sì che è un pomeriggio.`,
      `${commits} commit di fila. Applaudo internamente.`,
    ]};

    const edits = (counts.Edit || 0) + (counts.Write || 0);
    if (edits >= 8) return { key: 'edit-molti', pool: [
      `${edits} file toccati. Stai riscrivendo tutto o cercando qualcosa?`,
      `${edits} modifiche. Spero ci sia un piano.`,
    ]};

    const searches = (counts.Grep || 0) + (counts.Glob || 0);
    if (searches >= 6) return { key: 'ricerca', pool: [
      `${searches} ricerche. Quello che cerchi si nasconde bene.`,
      `${searches} grep. Forse non è dove pensi.`,
    ]};

    if (counts.Bash >= 12) return { key: 'shell', pool: [
      `${counts.Bash} comandi in shell. Sei nel tuo elemento.`,
      `${counts.Bash} volte in shell. Va bene, va bene.`,
    ]};
  }

  return null; // niente da osservare: decide chi chiama
}

/**
 * La battuta.
 *
 * `stat` è la stat dominante del buddy: colora *come* dice le cose, non cosa.
 * Il seed è (chiave osservazione + finestra di 30s + nome): stabile mentre la
 * leggi, diversa dopo, e nessuna scrittura su disco.
 */
export function speak(buddy, soul, payload, { fallbackPool = [] } = {}) {
  const activity = payload?.transcript_path ? recentActivity(payload.transcript_path) : null;
  const obs = observe(payload, activity);
  const pool = obs ? obs.pool : fallbackPool;
  if (!pool.length) return null;

  const bucket = Math.floor(Date.now() / 30000);
  const rand = mulberry32(fnv1a(`${obs?.key || 'idle'}:${bucket}:${soul.name}`));
  const line = pool[Math.floor(rand() * pool.length)];

  return { text: line, key: obs?.key || 'idle', observed: Boolean(obs) };
}

/** La stat dominante, per scegliere il registro. */
export const peakStat = (buddy) => STATS.reduce((a, b) => (buddy.stats[a] >= buddy.stats[b] ? a : b));

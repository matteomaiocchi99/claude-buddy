#!/usr/bin/env node
/**
 * Wrapper della statusLine di Claude Code.
 *
 * Non sostituisce la statusline esistente: la *avvolge*. Esegue il comando
 * originale passandogli lo stesso stdin che ha ricevuto, ne prende l'output
 * riga per riga e ci innesta il buddy nella posizione configurata.
 *
 * Regole non negoziabili, perché questo gira a ogni refresh della barra:
 *  - non deve mai fallire: se il comando avvolto esplode, stampiamo quello che
 *    abbiamo e basta. Una statusline vuota è meglio di una barra rotta;
 *  - non deve mai schiudere il pet: qui si legge solo;
 *  - non deve mai bloccarsi: il figlio ha un timeout.
 *
 * Configurazione in state.json:
 *   "statusline": { "wraps": "<comando originale>", "position": "bottom" }
 *   position: bottom | top | append | prepend
 */

// I colori vanno forzati: sotto la statusLine stdout non è un TTY.
process.env.CLAUDE_BUDDY_FORCE_COLOR = '1';

import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const CHILD_TIMEOUT_MS = 2500;

/** Legge tutto stdin. La statusLine passa un JSON che va girato al figlio. */
function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

/** Esegue il comando avvolto. Non rigetta mai: al massimo restituisce ''. */
function runWrapped(command, stdin) {
  return new Promise((resolve) => {
    if (!command) return resolve('');
    const child = spawn(command, { shell: true, stdio: ['pipe', 'pipe', 'ignore'] });
    let out = '';
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      resolve(value);
    };

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      finish(out);
    }, CHILD_TIMEOUT_MS);

    child.stdout.on('data', (c) => { out += c; });
    child.on('error', () => { clearTimeout(timer); finish(''); });
    child.on('close', () => { clearTimeout(timer); finish(out); });

    child.stdin.on('error', () => {}); // il figlio può non leggere stdin
    child.stdin.end(stdin);
  });
}

/** Il comando che settings.json indica ORA come statusLine (o ''). */
function currentStatusLineCommand() {
  try {
    const raw = readFileSync(join(homedir(), '.claude', 'settings.json'), 'utf8');
    return JSON.parse(raw)?.statusLine?.command || '';
  } catch {
    return '';
  }
}

/** Stessa risoluzione dell'identità della CLI, in sola lettura. */
function resolveUserId() {
  if (process.env.CLAUDE_BUDDY_USER) return process.env.CLAUDE_BUDDY_USER;
  const cfg = join(homedir(), '.claude.json');
  if (existsSync(cfg)) {
    try {
      const parsed = JSON.parse(readFileSync(cfg, 'utf8'));
      return parsed?.oauthAccount?.accountUuid || parsed?.userID || 'anon';
    } catch { /* si scende al fallback */ }
  }
  return 'anon';
}

/**
 * La riga del buddy: identità + **fumetto**.
 *
 * È qui che il pet fa quello che fa nell'articolo — commenta la sessione
 * accanto a dove scrivi. Il fumetto compare solo se il buddy non è muto:
 * `mute` nell'originale significa "silence speech bubbles", non "nascondilo".
 */
async function buddyLine(position, payload) {
  try {
    const [{ buildBuddy }, soulMod, { fg, bold, dim, termWidth }, { speak }, { chatter }] =
      await Promise.all([
        import('./bones.mjs'),
        import('./soul.mjs'),
        import('./render.mjs'),
        import('./watcher.mjs'),
        import('./chatter.mjs'),
      ]);

    const prefs = soulMod.readPrefs();
    if (prefs.hidden) return null;
    const userId = resolveUserId();
    const soul = soulMod.readSoul(userId);
    if (!soul) return null; // mai schiuso: la barra resta come prima

    const buddy = buildBuddy(userId, soul);
    const mark = buddy.shiny ? fg(213, '✦') : fg(buddy.rarity.color, '★');
    const face = fg(buddy.species.color, `(${buddy.eyes.glyph})`);
    const ownLine = position === 'bottom' || position === 'top';

    let head = `${mark} ${face} ${bold(soul.name)}`;
    if (ownLine) head += ` ${dim('·')} ${dim(buddy.species.id)}`;

    if (prefs.muted) return head;

    // Il fallback è la pool della stat dominante: se non c'è niente da
    // osservare il buddy resta in carattere invece di inventarsi un dato.
    const said = speak(buddy, soul, payload, { fallbackPool: [chatter(buddy, () => 0.5)] });
    if (!said) return head;

    // Il fumetto entra solo se ci sta: la barra non deve andare a capo.
    const room = termWidth() - visibleLen(head) - 6;
    if (room < 18) return head;
    const text = said.text.length > room ? said.text.slice(0, room - 1) + '…' : said.text;
    return `${head}  ${dim('«')} ${said.observed ? text : dim(text)} ${dim('»')}`;
  } catch {
    return null; // un buddy rotto non deve portarsi via la statusline
  }
}

/** Colonne visibili, senza le sequenze ANSI. */
const visibleLen = (s) => s.replace(/\x1b\[[0-9;]*m/g, '').length;

function compose(wrappedOut, buddy, position) {
  // Un output vuoto non deve diventare una riga vuota: se il comando avvolto
  // non ha prodotto nulla (o è fallito), il buddy resta da solo nella barra.
  const lines = wrappedOut.trim() ? wrappedOut.replace(/\n$/, '').split('\n') : [];
  if (!buddy) return lines.join('\n');
  if (!lines.length) return buddy;

  switch (position) {
    case 'top':
      return [buddy, ...lines].join('\n');
    case 'append': {
      const i = lines.length - 1;
      lines[i] = `${lines[i]}${lines[i] ? ' \x1b[2m│\x1b[0m ' : ''}${buddy}`;
      return lines.join('\n');
    }
    case 'prepend': {
      const i = lines.length - 1;
      lines[i] = `${buddy}${lines[i] ? ' \x1b[2m│\x1b[0m ' : ''}${lines[i]}`;
      return lines.join('\n');
    }
    case 'bottom':
    default:
      return [...lines, buddy].join('\n');
  }
}

async function main() {
  const stdin = readStdin();

  let cfg = {};
  try {
    const { readState } = await import('./soul.mjs');
    cfg = readState().statusline || {};
  } catch { /* nessuna config: si avvolge il nulla */ }

  const position = cfg.position || 'bottom';

  // GUARDIA ANTI-CICLO. Due modi di girare in tondo:
  //  1. `wraps` punta a noi stessi;
  //  2. qualcun altro si è preso settings.json e ci ha messi nella SUA catena
  //     mentre il nostro `wraps` punta ancora a lui — ognuno chiama l'altro.
  // In entrambi i casi non eseguiamo nulla: meglio una riga in meno che una
  // ricorsione che consuma la barra a ogni refresh.
  let wraps = cfg.wraps || '';
  if (wraps.includes('buddy/engine/statusline.mjs')) wraps = '';
  if (wraps && wraps === currentStatusLineCommand()) wraps = '';

  // Il payload della statusLine è la finestra del buddy sulla sessione.
  let payload = {};
  try { payload = JSON.parse(stdin); } catch { /* payload assente: nessuna osservazione */ }

  const [wrapped, buddy] = await Promise.all([
    runWrapped(wraps, stdin),
    buddyLine(position, payload),
  ]);

  process.stdout.write(compose(wrapped, buddy, position) + '\n');
}

main().catch(() => process.exit(0)); // mai un exit code diverso da 0

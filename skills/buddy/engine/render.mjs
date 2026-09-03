/** Rendering: colori ANSI, composizione sprite, stat card, fumetti, animazioni. */

import { EYE_SLOT, SPRITE_W } from './species.mjs';
import { STATS } from './cosmetics.mjs';

const ESC = '\x1b[';
const RESET = `${ESC}0m`;

/** I colori si spengono se stdout non è un terminale o se NO_COLOR è settato. */
export const colorEnabled = () =>
  !process.env.NO_COLOR && (process.stdout.isTTY || process.env.CLAUDE_BUDDY_FORCE_COLOR === '1');

export const fg = (n, s) => (colorEnabled() ? `${ESC}38;5;${n}m${s}${RESET}` : s);
export const bold = (s) => (colorEnabled() ? `${ESC}1m${s}${RESET}` : s);
export const dim = (s) => (colorEnabled() ? `${ESC}2m${s}${RESET}` : s);
export const italic = (s) => (colorEnabled() ? `${ESC}3m${s}${RESET}` : s);

/** Palette dello shimmer shiny. */
const RAINBOW = [196, 208, 220, 46, 51, 33, 129];

/**
 * Colonne occupate da una stringa.
 *
 * Le sequenze ANSI non ne occupano nessuna, e le emoji ne occupano DUE: senza
 * questo conteggio la riga `✨ SHINY ✨` sfasa il bordo destro della card di
 * due colonne. Sono trattati come larghi solo i piani emoji veri e `✨`
 * (U+2728): `★` e `☆` sono ambigui per Unicode ma i terminali occidentali li
 * rendono stretti, e contarli doppi romperebbe la riga della rarità.
 */
export function vlen(s) {
  const plain = s.replace(/\x1b\[[0-9;]*m/g, '');
  let n = 0;
  for (const ch of plain) {
    const cp = ch.codePointAt(0);
    const wide = cp === 0x2728 || (cp >= 0x1f300 && cp <= 0x1faff) || (cp >= 0x2b00 && cp <= 0x2b55);
    n += wide ? 2 : 1;
  }
  return n;
}
const padTo = (s, n) => s + ' '.repeat(Math.max(0, n - vlen(s)));

export const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);

/** Larghezza del terminale, con un default sensato quando non c'è un TTY. */
export function termWidth() {
  return process.stdout.columns || Number(process.env.COLUMNS) || 80;
}

/**
 * Compone un frame: cappello + 5 righe di sprite, con gli occhi sostituiti e
 * il colore applicato. Uno shiny cambia tinta a ogni riga e a ogni tick, ed è
 * questo lo "shimmer": il colore scorre lungo il corpo.
 */
export function composeFrame(buddy, frameIndex = 0, tick = 0) {
  const frame = buddy.species.frames[frameIndex % buddy.species.frames.length];
  // `{E}` è un carattere solo: quante volte compare lo decide lo sprite.
  const eyes = (line) => line.replaceAll(EYE_SLOT, buddy.eyes.glyph);
  // Il cappello **sostituisce** la riga alta del canvas; senza cappello quella
  // riga resta quella della specie (fumo, inchiostro, spore, antenna...).
  const body = frame.map(eyes);
  const rows = buddy.hat.id === 'none' ? body : [buddy.hat.sprite, ...body.slice(1)];

  return rows.map((row, i) => {
    if (!row.trim()) return row;
    if (buddy.shiny) {
      const hue = RAINBOW[(i + tick) % RAINBOW.length];
      return fg(hue, row);
    }
    // Il cappello prende il colore della rarità, il corpo quello della specie.
    return fg(i === 0 ? buddy.rarity.color : buddy.species.color, row);
  });
}

/** Manda a capo `text` a `width` colonne, senza spezzare le parole. */
export function wrap(text, width) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    if (!line) line = w;
    else if (line.length + 1 + w.length <= width) line += ' ' + w;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [''];
}

/** Fumetto con la coda a sinistra, da affiancare allo sprite. */
export function bubble(text, maxWidth = 42) {
  const lines = wrap(text, maxWidth);
  const w = Math.max(...lines.map((l) => l.length));
  const out = [`╭─${'─'.repeat(w)}─╮`];
  lines.forEach((l, i) => {
    const edge = i === 0 ? '◀─┤' : '  │';
    out.push(`${edge} ${l.padEnd(w)} │`);
  });
  out.push(`  ╰─${'─'.repeat(w)}─╯`);
  // La prima riga non ha la coda: la allineo alle altre.
  out[0] = '  ' + out[0];
  return out;
}

/**
 * Sprite + eventuale fumetto affiancato.
 * Su terminali strettissimi il fumetto passa sotto, e sotto i 24 caratteri
 * resta una sola riga di testo: il pet non deve mai sfasciare il layout.
 */
export function renderBuddy(buddy, soul, { say = null, frameIndex = 0, tick = 0 } = {}) {
  const cols = termWidth();
  const art = composeFrame(buddy, frameIndex, tick);

  if (!say) return art;

  if (cols < 24) {
    return [`${bold(soul.name)} ${dim(`(${buddy.species.id})`)}`, ...wrap(say, Math.max(12, cols - 1))];
  }

  const room = cols - SPRITE_W - 8;
  if (room < 16) return [...art, '', ...wrap(say, cols - 2).map((l) => dim('» ') + l)];

  const bub = bubble(say, Math.min(46, room));
  const height = Math.max(art.length, bub.length);
  const out = [];
  // Il fumetto parte dall'altezza della testa, non da terra.
  const bubOffset = Math.max(0, Math.min(1, art.length - bub.length));
  for (let i = 0; i < height + bubOffset; i++) {
    const left = padTo(art[i] ?? '', SPRITE_W);
    const right = bub[i - bubOffset] ?? '';
    out.push((left + ' ' + right).trimEnd());
  }
  return out;
}

/**
 * Barra di una stat.
 *
 * Fedele allo screenshot dell'articolo: pieno solido, vuoto in ombra leggera,
 * un colore unico e smorzato per tutte. NON colorata per valore — nell'originale
 * una stat bassa non è "rossa", è solo più corta.
 */
function statBar(value, width = 10) {
  const filled = Math.round((value / 100) * width);
  return fg(109, '█'.repeat(filled)) + dim('░'.repeat(width - filled));
}

/**
 * La stat card.
 *
 * Impaginazione presa dallo screenshot dell'articolo, e in quest'ordine:
 *   ★★★★★ RARITÀ ............ SPECIE   (specie in maiuscolo, allineata a destra)
 *   ✨ SHINY ✨                          (solo se shiny)
 *   lo sprite, indentato
 *   il nome, in evidenza
 *   la personalità, tra virgolette e in corsivo
 *   le cinque stat: etichetta, barra, valore a destra
 *
 * Colonna singola, non sprite-accanto-ai-dati: era la mia licenza, non l'originale.
 * Bordo e sprite prendono il colore della rarità (nell'immagine, oro su Legendary).
 * Occhi, cappello e data di schiusa non compaiono: stanno in `status` e `json`.
 */
export function statCard(buddy, soul) {
  const INNER = 40;
  const art = composeFrame(buddy, 0).map((row) => (row.trim() ? fg(buddy.rarity.color, row.replace(/\x1b\[[0-9;]*m/g, '')) : ''));
  const accent = (t) => bold(fg(buddy.rarity.color, t));

  const rows = [''];

  // Riga di testata: rarità a sinistra, specie in maiuscolo a destra.
  const left = `${fg(buddy.rarity.color, stars(buddy.rarity.stars))} ${accent(buddy.rarity.label.toUpperCase())}`;
  const right = fg(buddy.rarity.color, buddy.species.id.toUpperCase());
  const gap = Math.max(1, INNER - vlen(left) - vlen(right));
  rows.push(left + ' '.repeat(gap) + right);

  if (buddy.shiny) rows.push(accent('✨ SHINY ✨'));

  rows.push('');
  // La riga del cappello è vuota sui Common: va scartata, altrimenti la card
  // si apre con due righe bianche di fila.
  const body = art.slice(art.findIndex((r) => r !== ''));
  for (const row of body) rows.push(row ? '  ' + row : '');
  rows.push('');
  rows.push(bold(soul.name));

  if (soul.personality) {
    rows.push('');
    const lines = wrap(`"${soul.personality}"`, INNER);
    for (const l of lines) rows.push(italic(dim(l)));
  }

  rows.push('');
  for (const key of STATS) {
    const v = buddy.stats[key];
    rows.push(`${key.padEnd(11)}${statBar(v)}  ${String(v).padStart(4)}`);
  }
  rows.push('');

  const width = Math.max(INNER, ...rows.map(vlen));
  const out = [fg(buddy.rarity.color, `╭${'─'.repeat(width + 4)}╮`)];
  for (const r of rows) {
    out.push(`${fg(buddy.rarity.color, '│')}  ${padTo(r, width)}  ${fg(buddy.rarity.color, '│')}`);
  }
  out.push(fg(buddy.rarity.color, `╰${'─'.repeat(width + 4)}╯`));
  return out;
}

/** Le 5 fasi dell'uovo, dalla schiusa. */
export const EGG_FRAMES = [
  ["    .---.   ", "   /     \\  ", "  |       | ", "   \\     /  ", "    '---'   "],
  ["    .---.   ", "   /  ,  \\  ", "  |   '   | ", "   \\     /  ", "    '---'   "],
  ["    .-\\-.   ", "   /  ,  \\  ", "  | ' \\ ' | ", "   \\  /  /  ", "    '---'   "],
  ["    .-\\-.   ", "   /_ , _\\  ", "  | '\\ /' | ", "   \\ /|\\ /  ", "    '-\\-'   "],
  ["   \\  |  /  ", "    \\ | /   ", "  -- ,*, --  ", "    / | \\   ", "   /  |  \\  "],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** true se possiamo animare: serve un TTY e nessun --no-anim. */
export const canAnimate = (opts = {}) => Boolean(process.stdout.isTTY) && !opts.noAnim;

/** Cancella `n` righe risalendo col cursore: base di ogni animazione. */
function clearLines(n) {
  if (n > 0) process.stdout.write(`${ESC}${n}A${ESC}0J`);
}

export async function animate(framesFn, { ticks, delay = 120 }) {
  let printed = 0;
  for (let t = 0; t < ticks; t++) {
    clearLines(printed);
    const lines = framesFn(t);
    process.stdout.write(lines.join('\n') + '\n');
    printed = lines.length;
    await sleep(delay);
  }
  return printed;
}

/** Schiusa: l'uovo si crepa, esplode, e resta il buddy. */
export async function playHatch(buddy, soul, opts = {}) {
  if (!canAnimate(opts)) return;
  const colorOf = (i) => fg(buddy.rarity.color, EGG_FRAMES[i].join('\n'));
  for (let i = 0; i < EGG_FRAMES.length; i++) {
    if (i > 0) clearLines(5);
    process.stdout.write(colorOf(i) + '\n');
    await sleep(i === EGG_FRAMES.length - 1 ? 420 : 320);
  }
  clearLines(5);
  await animate((t) => composeFrame(buddy, t % 3, t), { ticks: 6, delay: 140 });
}

/** Coccola: cuoricini che salgono accanto al buddy per ~2,5 secondi. */
export async function playPet(buddy, opts = {}) {
  const HEARTS = ['♥', '♡'];
  if (!canAnimate(opts)) return;
  const ticks = 16;
  await animate((t) => {
    const art = composeFrame(buddy, t % 2 === 0 ? 0 : 1, t);
    const out = [];
    // Due cuori sfasati che salgono: uno per tick, non uno per riga.
    const rows = art.length;
    const first = rows - 1 - (t % rows);
    const second = rows - 1 - ((t + 3) % rows);
    for (let i = 0; i < rows; i++) {
      const heart = i === first ? fg(197, HEARTS[0]) : i === second ? fg(212, HEARTS[1]) : ' ';
      out.push(padTo(art[i], SPRITE_W) + '  ' + heart);
    }
    return out;
  }, { ticks, delay: 150 });
}

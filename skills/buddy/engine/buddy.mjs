#!/usr/bin/env node
/**
 * Claude Buddy — pet da terminale per Claude Code.
 *
 * Uso:
 *   buddy.mjs                    schiude (la prima volta) e stampa la card
 *   buddy.mjs card               stat card completa
 *   buddy.mjs pet                coccola (cuoricini, ~2,5s)
 *   buddy.mjs say "testo"        mostra il buddy con un fumetto
 *   buddy.mjs mute | unmute      silenzia / riattiva le battute
 *   buddy.mjs off | on           nasconde / mostra il buddy
 *   buddy.mjs status             stato leggibile
 *   buddy.mjs peek               JSON di sola lettura: NON schiude (per Claude)
 *   buddy.mjs prompt             il prompt di sistema originale per nome e personalità
 *   buddy.mjs frames [pet|hatch] i frame dell'animazione in JSON (per esportarla)
 *   buddy.mjs json               tutto il buddy in JSON, schiudendo se serve
 *   buddy.mjs statusline         una riga sola, per la statusLine di Claude Code
 *   buddy.mjs bar                stato dell'innesto nella statusLine
 *   buddy.mjs bar <posizione>    innesta il buddy nella statusLine (bottom|top|append|prepend)
 *   buddy.mjs bar off            togli il buddy dalla statusLine
 *   buddy.mjs gallery            le 18 specie
 *   buddy.mjs check <userId>     il buddy di un altro id, senza toccare lo stato
 *
 * Opzioni: --user <id>  --no-anim  --force  --name <n>  --personality <p>  --frame <0|1|2>
 */

import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { buildBuddy, overall } from './bones.mjs';
import { SPECIES } from './species.mjs';
import { STATS, EYES, HAT_BY_ID } from './cosmetics.mjs';
import {
  readSoul, writeSoul, defaultSoul, readPrefs, writePrefs, ageInDays, STATE_PATH,
  inspirationWords, soulRequest, SOUL_PROMPT,
} from './soul.mjs';
import {
  composeFrame, renderBuddy, statCard, playHatch, playPet, stars, fg, bold, dim, canAnimate,
  petFrames, hatchFrames,
} from './render.mjs';
import { chatter } from './chatter.mjs';
import { barStatus, barInstall, barRemove, POSITIONS } from './bar.mjs';

/* ---------------------------------------------------------------- argomenti */

function parseArgs(argv) {
  const opts = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--no-anim') opts.noAnim = true;
    else if (a === '--force') opts.force = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--user') opts.user = argv[++i];
    else if (a === '--name') opts.name = argv[++i];
    else if (a === '--personality') opts.personality = argv[++i];
    else if (a === '--wraps') opts.wraps = argv[++i];
    else if (a === '--frame') opts.frame = Number(argv[++i]);
    else if (a.startsWith('--')) throw new Error(`opzione non riconosciuta: ${a}`);
    else opts._.push(a);
  }
  return opts;
}

/**
 * Da dove viene l'identità del buddy.
 *
 * L'ordine è quello del sorgente ricostruito:
 *   `oauthAccount.accountUuid ?? userID ?? "anon"`
 * Non è un dettaglio: sulla stessa macchina i due valori sono diversi, quindi
 * usare `userID` dava un buddy diverso da quello vero.
 */
function resolveUserId(opts) {
  if (opts.user) return { id: opts.user, source: '--user' };
  if (process.env.CLAUDE_BUDDY_USER) return { id: process.env.CLAUDE_BUDDY_USER, source: 'CLAUDE_BUDDY_USER' };

  const cfg = join(homedir(), '.claude.json');
  if (existsSync(cfg)) {
    try {
      const parsed = JSON.parse(readFileSync(cfg, 'utf8'));
      const uuid = parsed?.oauthAccount?.accountUuid;
      if (uuid) return { id: uuid, source: '~/.claude.json oauthAccount.accountUuid' };
      if (parsed?.userID) return { id: parsed.userID, source: '~/.claude.json userID' };
    } catch { /* config illeggibile: si scende al fallback */ }
  }
  return { id: 'anon', source: 'anon (nessuna identità trovata)' };
}

const out = (lines) =>
  console.log((Array.isArray(lines) ? lines : [lines]).map((l) => String(l).trimEnd()).join('\n'));

/* ------------------------------------------------------------------ comandi */

/** I comandi validi. Elenco esplicito: un typo non deve poter schiudere il pet. */
const COMMANDS = new Set([
  'show', 'peek', 'json', 'status', 'statusline', 'card', 'pet', 'say',
  'gallery', 'check', 'mute', 'unmute', 'off', 'on', 'bar', 'prompt', 'frames',
]);

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const cmd = opts._[0] || 'show';
  // Si valida PRIMA di risolvere l'identità e di toccare lo stato: la schiusa
  // è irreversibile, e un comando sbagliato non deve consumarla.
  if (!COMMANDS.has(cmd)) {
    throw new Error(`comando non riconosciuto: ${cmd}\n       validi: ${[...COMMANDS].join(', ')}`);
  }
  const { id: userId, source } = resolveUserId(opts);

  /* Comandi che non toccano lo stato ---------------------------------- */

  if (cmd === 'bar') return bar(opts._[1], opts);

  if (cmd === 'gallery') return gallery();
  if (cmd === 'check') {
    const target = opts._[1];
    if (!target) throw new Error('serve un userId: buddy.mjs check <userId>');
    const buddy = buildBuddy(target);
    const soul = { name: '(non schiuso)', hatchedAt: null };
    return out(['', ...statCard(buddy, soul), '', dim(`  id: ${target}`)]);
  }

  const prefs = readPrefs();

  if (cmd === 'peek') {
    // Sola lettura: calcola le bones e riferisce se il buddy è già schiuso,
    // SENZA scrivere il soul. È il gancio per far battezzare il pet a Claude.
    const bones = buildBuddy(userId);
    const existing = readSoul(userId);
    return console.log(JSON.stringify({
      hatched: Boolean(existing),
      soul: existing
        ? { name: existing.name, personality: existing.personality, hatchedAt: existing.hatchedAt,
            ageInDays: ageInDays(existing.hatchedAt) }
        : null,
      species: bones.species.id,
      category: bones.species.category,
      blurb: bones.species.blurb,
      rarity: bones.rarity.label,
      stars: bones.rarity.stars,
      shiny: bones.shiny,
      eyes: bones.eyes.label,
      hat: bones.hat.label,
      stats: bones.stats,
      overall: overall(bones.stats),
      // Le quattro parole d'ispirazione e il messaggio da dare al modello:
      // servono a battezzarlo come fa l'originale, non a caso.
      inspiration: inspirationWords(userId),
      soulRequest: soulRequest({ ...bones, userId }),
      prefs,
      identitySource: source,
    }, null, 2));
  }

  if (cmd === 'prompt') return console.log(SOUL_PROMPT);

  if (cmd === 'json' || opts.json) {
    return console.log(JSON.stringify({
      name: soul.name,
      personality: soul.personality,
      traits: soul.traits ?? [],
      quirk: soul.quirk ?? null,
      hatchedAt: soul.hatchedAt,
      ageInDays: ageInDays(soul.hatchedAt),
      firstHatch,
      species: buddy.species.id,
      category: buddy.species.category,
      rarity: buddy.rarity.label,
      stars: buddy.rarity.stars,
      shiny: buddy.shiny,
      eyes: buddy.eyes.label,
      hat: buddy.hat.label,
      stats: buddy.stats,
      overall: overall(buddy.stats),
      prefs,
      identitySource: source,
      statePath: STATE_PATH,
    }, null, 2));
  }

  if (cmd === 'status') {
    return out([
      `  ${bold(soul.name)} ${dim('·')} ${buddy.species.id} ${dim('·')} ${fg(buddy.rarity.color, buddy.rarity.label)} ${fg(buddy.rarity.color, stars(buddy.rarity.stars))}${buddy.shiny ? ' ' + fg(213, '✦shiny') : ''}`,
      `  ${dim('overall')} ${overall(buddy.stats)}   ${dim('schiuso')} ${ageInDays(soul.hatchedAt)}g   ${dim('muto')} ${prefs.muted ? 'sì' : 'no'}   ${dim('nascosto')} ${prefs.hidden ? 'sì' : 'no'}`,
      `  ${dim(`identità da: ${source}`)}`,
      `  ${dim(`stato: ${STATE_PATH}`)}`,
    ]);
  }

  if (cmd === 'statusline') {
    // Una riga, senza newline extra: va dentro la statusLine di Claude Code.
    const tag = buddy.shiny ? fg(213, '✦') : fg(buddy.rarity.color, '★');
    const art = `${buddy.eyes.glyph}`;
    return console.log(`${tag} ${fg(buddy.species.color, `(${art})`)} ${bold(soul.name)} ${dim(buddy.species.id)}`);
  }

  if (prefs.hidden && cmd !== 'card' && cmd !== 'pet') {
    return out(dim('  (buddy nascosto — `on` per farlo tornare)'));
  }

  if (cmd === 'mute' || cmd === 'unmute') {
    const muted = cmd === 'mute';
    writePrefs({ muted });
    return out(dim(muted ? '  Buddy silenziato. `unmute` per riattivarlo.' : '  Buddy di nuovo loquace.'));
  }
  if (cmd === 'off' || cmd === 'on') {
    const hidden = cmd === 'off';
    writePrefs({ hidden });
    return out(dim(hidden ? '  Buddy nascosto. `on` per farlo tornare.' : '  Buddy di nuovo visibile.'));
  }

  /* Schiusa e stato -------------------------------------------------- */

  // Le bones si ricalcolano ora, comunque: sono loro a decidere le stat, e le
  // stat servono già alla generazione del soul di default.
  const pre = buildBuddy(userId);
  let soul = readSoul(userId);
  const firstHatch = !soul || opts.force;

  if (firstHatch) {
    const base = defaultSoul(userId, pre.stats);
    soul = writeSoul(userId, {
      ...base,
      ...(opts.name ? { name: opts.name } : {}),
      ...(opts.personality ? { personality: opts.personality } : {}),
    }, { force: Boolean(opts.force) });
  } else if (opts.name || opts.personality) {
    // Il soul non si riscrive dopo la schiusa: è il patto dell'articolo.
    process.stderr.write(dim('  (buddy già schiuso: nome e personalità non si riscrivono, usa --force)\n'));
  }

  const buddy = buildBuddy(userId, soul);

  if (cmd === 'frames') {
    // I frame come dati, senza ANSI e senza tempo reale: servono a esportare
    // l'animazione (GIF, SVG, qualunque cosa) senza duplicarne la logica.
    const kind = opts._[1] || 'pet';
    if (!['pet', 'hatch'].includes(kind)) throw new Error(`animazione non riconosciuta: ${kind} (pet, hatch)`);
    const frames = kind === 'pet' ? petFrames(buddy) : hatchFrames(buddy);
    return console.log(JSON.stringify({
      kind,
      name: soul.name,
      species: buddy.species.id,
      defaultDelayMs: kind === 'pet' ? 150 : 300,
      frames,
    }, null, 2));
  }

  if (cmd === 'card') return out(['', ...statCard(buddy, soul), '']);

  if (cmd === 'pet') {
    if (canAnimate(opts)) await playPet(buddy, opts);
    const line = prefs.muted ? null : petLine(buddy, soul);
    return out([...renderBuddy(buddy, soul, { say: line }), '']);
  }

  if (cmd === 'say') {
    const text = opts._.slice(1).join(' ');
    if (!text) throw new Error('serve un testo: buddy.mjs say "..."');
    return out([...renderBuddy(buddy, soul, { say: text, frameIndex: opts.frame ?? 0 }), '']);
  }

  /* show ------------------------------------------------------------- */

  // Nello screenshot dell'articolo `/buddy` da solo stampa **la card**: la
  // schiusa culmina lì, non in uno sprite con un fumetto. I fumetti stanno
  // accanto al box di input (la statusLine), non nell'output del comando.
  if (firstHatch) await playHatch(buddy, soul, opts);
  return out(['', ...statCard(buddy, soul), '']);
}

/**
 * Innesto nella statusLine. Senza argomenti riferisce, con una posizione
 * installa, con `off` disinstalla. Non schiude e non tocca il buddy.
 */
function bar(arg, opts = {}) {
  const label = { direct: fg(78, 'innestato'), chained: fg(78, 'innestato in catena'), off: dim('non innestato') };

  if (!arg) {
    const st = barStatus();
    const lines = [
      `  ${label[st.mode]}${st.position ? ` ${dim('·')} posizione ${bold(st.position)}` : ''}`,
      st.wraps ? `  ${dim('avvolge')} ${st.wraps}` : `  ${dim('non avvolge nulla')}`,
      `  ${dim('statusLine in settings.json')} ${st.currentCommand ?? dim('(nessuna)')}`,
    ];
    if (st.mode === 'chained') {
      lines.push(`  ${dim('catturato da')} ${st.capturedBy}${dim(' — settings.json resta suo, giusto così')}`);
    }
    if (st.cycle) {
      lines.push(`  ${fg(203, 'CICLO')} il nostro \`wraps\` punta a chi ci ha catturati: la catena si morde la coda.`);
      lines.push(`  ${dim('correggi con')} bar ${st.position || 'bottom'} --wraps "<comando originale>"`);
    }
    lines.push(`  ${dim(`posizioni: ${POSITIONS.join(', ')} — \`bar off\` per togliere`)}`);
    return out(lines);
  }

  if (arg === 'off') {
    const r = barRemove();
    return out(dim(`  ${r.action}${r.wraps ? ` — statusLine tornata a: ${r.wraps}` : ''}`));
  }

  const r = barInstall(arg, { wraps: opts.wraps });
  const lines = [
    `  ${fg(78, r.action)} ${dim('·')} posizione ${bold(r.position)}`,
    r.wraps ? `  ${dim('avvolge')} ${r.wraps}` : `  ${dim('nessuna statusLine preesistente da avvolgere')}`,
  ];
  if (r.capturedBy) lines.push(`  ${dim('dentro la catena di')} ${r.capturedBy}`);
  if (r.cycle) lines.push(`  ${fg(203, 'CICLO')} ${dim('wraps punta a chi ci ha catturati — passa --wraps con il comando originale')}`);
  return out(lines);
}

/** Battute della coccola: le uniche che ignorano la stat dominante. */
function petLine(buddy, soul) {
  const pool = [
    'Ancora.',
    'Va bene. Ma solo perché sei tu.',
    `${soul.name} approva.`,
    'Mmh. Accettabile.',
    'Questo sì che è un buon uso del tuo tempo.',
  ];
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Le 18 specie in griglia: il "gallery site" dell'articolo, offline. */
function gallery() {
  const rows = [];
  for (const s of SPECIES) {
    // Buddy finto e neutro: occhio di default e nessun cappello, così la riga
    // alta resta quella della specie (fumo, inchiostro, spore, antenna).
    const buddy = {
      species: s, shiny: false,
      rarity: { color: 250, stars: 1, label: 'Common' },
      eyes: EYES[0], hat: HAT_BY_ID.none,
      stats: Object.fromEntries(STATS.map((k) => [k, 50])),
    };
    rows.push({ art: composeFrame(buddy, 0), name: s.id, category: s.category });
  }
  const perRow = Math.max(1, Math.floor((process.stdout.columns || 80) / 16));
  out('');
  for (let i = 0; i < rows.length; i += perRow) {
    const group = rows.slice(i, i + perRow);
    const height = Math.max(...group.map((g) => g.art.length));
    for (let line = 0; line < height; line++) {
      out(group.map((g) => (g.art[line] ?? ' '.repeat(12)) + '   ').join(''));
    }
    // Nome e categoria su due righe: 15 colonne non bastano per entrambi.
    out(group.map((g) => bold(g.name).padEnd(15 + (bold(g.name).length - g.name.length))).join(''));
    out(group.map((g) => dim(g.category).padEnd(15 + (dim(g.category).length - g.category.length))).join(''));
    out('');
  }
}

main().catch((err) => {
  process.stderr.write(`buddy: ${err.message}\n`);
  process.exit(1);
});

/**
 * SOUL — la parte del buddy che si scrive su disco.
 *
 * Nome e personalità nascono una volta sola, alla schiusa, e non cambiano più.
 * Nell'originale li genera un LLM a partire da rarità, specie, stat e **quattro
 * parole d'ispirazione** pescate da un banco; se la chiamata falliva, ripiegava
 * su sei nomi fissi. Tutto ciò è riprodotto qui: il prompt vero sta in
 * `SOUL_PROMPT` (lo usa la skill), e il ripiego funziona senza modello.
 *
 * Fonte: reverse engineering del leak, variety.is/posts/claude-code-buddies.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { seededRandom, fnv1a, pick } from './rng.mjs';
import { STATS } from './cosmetics.mjs';

/** Il file di stato vive fuori dalla skill: la skill è codice, questo è dato. */
export const STATE_PATH =
  process.env.CLAUDE_BUDDY_STATE || join(homedir(), '.claude', 'buddy', 'state.json');

/** I sei nomi di riserva: nell'originale si usano se la chiamata all'LLM fallisce. */
export const FALLBACK_NAMES = ['Crumpet', 'Soup', 'Pickle', 'Biscuit', 'Moth', 'Gravy'];

/**
 * Il banco delle parole d'ispirazione. Non servono a comporre il nome per
 * sillabe: sono **ancore libere** per il modello, che può riffare su una,
 * fondere due sillabe, o prenderne solo l'atmosfera.
 *
 * Nota: la fonte lo descrive come un banco da 156 parole, ma la pagina ne
 * elenca 146. Sono queste, non ne ho inventate altre per far quadrare il conto.
 */
export const INSPIRATION = [
  "thunder", "biscuit", "void", "accordion", "moss", "velvet", "rust", "pickle", "crumb",
  "whisper", "gravy", "frost", "ember", "soup", "marble", "thorn", "honey", "static",
  "copper", "dusk", "sprocket", "bramble", "cinder", "wobble", "drizzle", "flint", "tinsel",
  "murmur", "clatter", "gloom", "nectar", "quartz", "shingle", "tremor", "umber", "waffle",
  "zephyr", "bristle", "dapple", "fennel", "gristle", "huddle", "kettle", "lumen", "mottle",
  "nuzzle", "pebble", "quiver", "ripple", "sable", "thistle", "vellum", "wicker", "yonder",
  "bauble", "cobble", "doily", "fickle", "gambit", "hubris", "jostle", "knoll", "larder",
  "mantle", "nimbus", "oracle", "plinth", "quorum", "relic", "spindle", "trellis", "urchin",
  "vortex", "warble", "xenon", "yoke", "zenith", "alcove", "brogue", "chisel", "dirge",
  "epoch", "fathom", "glint", "hearth", "inkwell", "jetsam", "kiln", "lattice", "mirth",
  "nook", "obelisk", "parsnip", "quill", "rune", "sconce", "tallow", "umbra", "verve",
  "wisp", "yawn", "apex", "brine", "crag", "dregs", "etch", "flume", "gable",
  "husk", "ingot", "jamb", "knurl", "loam", "mote", "nacre", "ogle", "prong",
  "quip", "rind", "slat", "tuft", "vane", "welt", "yarn", "bane", "clove",
  "dross", "eave", "fern", "grit", "hive", "jade", "keel", "lilt", "muse",
  "nape", "omen", "pith", "rook", "silt", "tome", "urge", "vex", "wane",
  "yew", "zest",
];

/** Il prompt di sistema originale, verbatim dalla fonte. */
export const SOUL_PROMPT = `You generate coding companions — small creatures that live in a developer's terminal and occasionally comment on their work.

Given a rarity, species, stats, and a handful of inspiration words, invent:

- A name: ONE word, max 12 characters. Memorable, slightly absurd. No titles, no "the X", no epithets. Think pet name, not NPC name. The inspiration words are loose anchors — riff on one, mash two syllables, or just use the vibe. Examples: Pith, Dusker, Crumb, Brogue, Sprocket.

- A one-sentence personality (specific, funny, a quirk that affects how they'd comment on code — should feel consistent with the stats)

Higher rarity = weirder, more specific, more memorable. A legendary should be genuinely strange. Don't repeat yourself — every companion should feel distinct.`;

/** Le quattro parole d'ispirazione di questo buddy: deterministiche, come tutto il resto. */
export function inspirationWords(userId, count = 4) {
  const rand = seededRandom(userId, ':soul:inspiration');
  const pool = INSPIRATION.slice();
  const out = [];
  for (let i = 0; i < count && pool.length; i++) {
    out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  }
  return out;
}

/**
 * Il messaggio utente, nel formato dell'originale.
 * Le stat sono minuscole e sulla stessa riga, come nell'esempio della fonte.
 */
export function soulRequest(buddy) {
  const stats = STATS.map((k) => `${k.toLowerCase()}:${buddy.stats[k]}`).join(' ');
  const words = inspirationWords(buddy.userId ?? '');
  return [
    'Generate a companion.',
    `Rarity: ${buddy.rarity.label.toUpperCase()}`,
    `Species: ${buddy.species.id}`,
    `Stats: ${stats}`,
    `Inspiration words: ${words.join(', ')}`,
    buddy.shiny ? 'SHINY variant — extra special.' : null,
    'Make it memorable and distinct.',
  ].filter(Boolean).join('\n');
}

/**
 * Personalità di riserva: una frase sola, un tic che si vede nel modo in cui
 * commenterebbe il codice — lo stile dell'esempio della fonte ("Insists every
 * variable name should rhyme with the one above it.").
 */
function fallbackPersonality(userId, stats) {
  const rand = seededRandom(userId, ':soul:personality');
  const peak = STATS.reduce((a, b) => (stats[a] >= stats[b] ? a : b));
  const byPeak = {
    DEBUGGING: [
      'Sostiene di aver già visto questo bug, in un altro file, anni fa.',
      'Legge lo stack trace dal fondo e non capisce perché tu non lo faccia.',
    ],
    PATIENCE: [
      'Aspetta la fine della build senza dire una parola, e poi non la commenta.',
      'Considera qualunque cosa sotto i dieci minuti un tempo di attesa trascurabile.',
    ],
    CHAOS: [
      'Propone la soluzione peggiore con totale convinzione, ogni volta.',
      'Pensa che due branch aperti siano un buon inizio e cinque un piano.',
    ],
    WISDOM: [
      'Parla una volta per sessione, e quella volta ha ragione.',
      'Se serve un commento per spiegare una riga, lo prende come una confessione.',
    ],
    SNARK: [
      'Tiene il conto dei tuoi `console.log` dimenticati e non lo condivide mai.',
      'Pretende che ogni nome di variabile faccia rima con quello sopra.',
    ],
  };
  return pick(rand, byPeak[peak]);
}

/** Legge lo stato da disco. Un file corrotto non deve rompere il pet. */
export function readState() {
  try {
    if (!existsSync(STATE_PATH)) return {};
    return JSON.parse(readFileSync(STATE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

export function writeState(state) {
  mkdirSync(dirname(STATE_PATH), { recursive: true });
  writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n', 'utf8');
  return state;
}

/**
 * Il soul salvato è legato al suo proprietario: se lo userId cambia (altro
 * account, o una correzione di come lo si risolve) il vecchio soul non vale più.
 */
export function readSoul(userId) {
  const state = readState();
  if (!state.soul) return null;
  if (state.soul.ownerHash !== fnv1a(String(userId))) return null;
  return state.soul;
}

/**
 * Scrive il soul. Il precedente non viene buttato: finisce in `previous`, così
 * un pet non si perde per una modifica al codice.
 */
export function writeSoul(userId, soul, { force = false } = {}) {
  const state = readState();
  const owner = fnv1a(String(userId));
  if (state.soul && !force && state.soul.ownerHash === owner) {
    return state.soul; // già schiuso: il soul non si riscrive
  }
  if (state.soul && state.soul.ownerHash !== owner) {
    state.previous = [...(state.previous || []), state.soul].slice(-5);
  }
  state.soul = { ...soul, ownerHash: owner };
  writeState(state);
  return state.soul;
}

/** Soul di riserva, usato quando nessun LLM ne fornisce uno. */
export function defaultSoul(userId, stats) {
  const rand = seededRandom(userId, ':soul:name');
  return {
    name: pick(rand, FALLBACK_NAMES),
    personality: fallbackPersonality(userId, stats),
    inspiration: inspirationWords(userId),
    hatchedAt: new Date().toISOString(),
    fromFallback: true,
  };
}

/** Preferenze: mute delle battute e visibilità del pet. */
export function readPrefs() {
  const { prefs } = readState();
  return { muted: false, hidden: false, ...(prefs || {}) };
}

export function writePrefs(patch) {
  const state = readState();
  state.prefs = { ...readPrefs(), ...patch };
  writeState(state);
  return state.prefs;
}

/** Giorni dalla schiusa, per la card. */
export function ageInDays(hatchedAt) {
  if (!hatchedAt) return 0;
  const ms = Date.now() - new Date(hatchedAt).getTime();
  return Math.max(0, Math.floor(ms / 86400000));
}

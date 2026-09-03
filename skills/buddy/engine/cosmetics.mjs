/**
 * Tabelle di rarità, cappelli, occhi e stat.
 * Valori e sprite dal sorgente ricostruito (variety.is/posts/claude-code-buddies),
 * non dalla tabella dell'articolo — dove differiscono, è annotato.
 */

/**
 * Rarità. `weight` è la probabilità in punti percentuali: 60+25+10+4+1 = 100.
 * `floor` è il pavimento delle stat. `peak` è l'intervallo della stat di punta
 * che ne risulta, riportato dal sorgente e utile come verifica.
 */
export const RARITIES = [
  { id: 'common',    label: 'Common',    weight: 60, stars: 1, floor: 5,  peak: [55, 84],  color: 250 },
  { id: 'uncommon',  label: 'Uncommon',  weight: 25, stars: 2, floor: 15, peak: [65, 94],  color: 78  },
  { id: 'rare',      label: 'Rare',      weight: 10, stars: 3, floor: 25, peak: [75, 100], color: 39  },
  { id: 'epic',      label: 'Epic',      weight: 4,  stars: 4, floor: 35, peak: [85, 100], color: 141 },
  { id: 'legendary', label: 'Legendary', weight: 1,  stars: 5, floor: 50, peak: [100, 100], color: 220 },
];

export const RARITY_BY_ID = Object.fromEntries(RARITIES.map((r) => [r.id, r]));
export const RARITY_ORDER = RARITIES.map((r) => r.id);

/** Probabilità indipendente di shiny, qualunque sia la rarità. */
export const SHINY_CHANCE = 0.01;

/**
 * Cappelli. Lo sprite è la **riga alta** del canvas, che il cappello sostituisce.
 *
 * ⚠️ La regola vera è più semplice di quella dell'articolo: i Common hanno
 * sempre `none`, **tutte le altre rarità estraggono dall'insieme completo** —
 * `none` compreso. Non c'è nessuna soglia per cappello (l'articolo dava
 * Halo=Rare+, Beanie=Epic+, Papera=solo Legendary: il sorgente non lo fa).
 */
export const HATS = [
  { id: "none", label: "Nessuno", vibe: "i Common hanno sempre questo", sprite: "            " },
  { id: "crown", label: "Corona", vibe: "regale", sprite: "   \\^^^/    " },
  { id: "tophat", label: "Cilindro", vibe: "elegante", sprite: "   [___]    " },
  { id: "propeller", label: "Elica", vibe: "giocoso", sprite: "    -+-     " },
  { id: "halo", label: "Aureola", vibe: "angelico", sprite: "   (   )    " },
  { id: "wizard", label: "Cappello da mago", vibe: "magico", sprite: "    /^\\     " },
  { id: "beanie", label: "Berretto", vibe: "accogliente", sprite: "   (___)    " },
  { id: "tinyduck", label: "Papera", vibe: "una papera in testa", sprite: "    ,>      " },
];

export const HAT_BY_ID = Object.fromEntries(HATS.map((h) => [h.id, h]));

/**
 * Le 6 varianti di occhi. Un **carattere solo**, sostituito nel token `{E}`:
 * quante volte compare lo decide lo sprite (la lumaca ne ha uno, il gatto due).
 */
export const EYES = [
  { id: 'dot',     glyph: '·', label: 'puntino',    vibe: 'di default; minimale, calmo' },
  { id: 'sparkle', glyph: '✦', label: 'brillanti',  vibe: 'entusiasti' },
  { id: 'cross',   glyph: '×', label: 'a croce',    vibe: 'stordito o malizioso' },
  { id: 'wide',    glyph: '◉', label: 'spalancati', vibe: "all'erta" },
  { id: 'digital', glyph: '@', label: 'digitali',   vibe: 'robotico' },
  { id: 'hollow',  glyph: '°', label: 'vuoti',      vibe: 'sorpresi, sguardo vacuo' },
];

export const EYES_BY_ID = Object.fromEntries(EYES.map((e) => [e.id, e]));

/** Le cinque stat, nell'ordine canonico di visualizzazione. */
export const STATS = ['DEBUGGING', 'PATIENCE', 'CHAOS', 'WISDOM', 'SNARK'];

/**
 * Cappelli disponibili per una rarità.
 * Common: solo `none`. Tutte le altre: l'insieme completo.
 */
export function hatsFor(rarityId) {
  return rarityId === 'common' ? [HAT_BY_ID.none] : HATS;
}

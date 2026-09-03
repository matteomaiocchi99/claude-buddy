/**
 * BONES — la parte del buddy che non si può falsificare.
 *
 * Specie, rarità, shiny, occhi, cappello e stat sono *ricalcolati da zero* a
 * ogni sessione partendo dallo userId. Non vengono mai scritti su disco, e nel
 * merge finale `{ ...stored, ...bones }` vincono sempre loro: modificare il
 * file di stato per darsi un Legendary non ha alcun effetto.
 *
 * L'altra metà è il SOUL (nome, personalità, data di schiusa): quello sì
 * persistito, perché non è guadagnato, è dato una volta sola. Vedi soul.mjs.
 */

import { seededRandom, randInt, pick, shuffle, weighted } from './rng.mjs';
import { SPECIES, SPECIES_BY_ID } from './species.mjs';
import { RARITIES, RARITY_BY_ID, SHINY_CHANCE, EYES, HAT_BY_ID, STATS, hatsFor } from './cosmetics.mjs';

/**
 * ORDINE DI ESTRAZIONE — non riordinare.
 * La sequenza è parte dell'identità: cambiarla rigenera i buddy di tutti.
 *   1. specie   2. rarità   3. shiny   4. occhi   5. cappello   6. stat
 */
export function computeBones(userId) {
  const rand = seededRandom(userId);

  const species = SPECIES[Math.floor(rand() * SPECIES.length)];
  const rarity = weighted(rand, RARITIES);
  const shiny = rand() < SHINY_CHANCE;
  const eyes = pick(rand, EYES);
  const hat = pick(rand, hatsFor(rarity.id));
  const stats = rollStats(rand, rarity.floor);

  return {
    speciesId: species.id,
    rarityId: rarity.id,
    shiny,
    eyesId: eyes.id,
    hatId: hat.id,
    stats,
  };
}

/**
 * Stat su scala 0-100 con `floor` come pavimento della rarità.
 * Il profilo non è piatto: una stat di punta, una scaricata, tre sparse.
 * Così un Legendary è statisticamente superiore ma resta riconoscibile.
 */
function rollStats(rand, floor) {
  const order = shuffle(rand, STATS);
  const [peak, dump, ...rest] = order;
  const stats = {};

  // Dal sorgente ricostruito: punta = floor+50 … floor+79, scaricata =
  // floor-10 … floor+4. Il pavimento della rarità è l'unica cosa che sposta
  // il profilo, e il tetto resta 100 (un Legendary ha la punta fissa a 100).
  stats[peak] = Math.min(100, floor + 50 + randInt(rand, 0, 29));
  stats[dump] = Math.max(0, Math.min(100, floor - 10 + randInt(rand, 0, 14)));
  // Le altre tre il sorgente non le specifica: restano una banda intermedia.
  for (const key of rest) {
    stats[key] = Math.min(100, floor + randInt(rand, 0, 45));
  }

  // Riordina secondo STATS: l'oggetto va mostrato sempre nello stesso ordine.
  return Object.fromEntries(STATS.map((k) => [k, stats[k]]));
}

/** Espande gli id in oggetti completi, pronti per il rendering. */
export function hydrate(bones) {
  return {
    ...bones,
    species: SPECIES_BY_ID[bones.speciesId],
    rarity: RARITY_BY_ID[bones.rarityId],
    eyes: EYES.find((e) => e.id === bones.eyesId),
    hat: HAT_BY_ID[bones.hatId],
  };
}

/**
 * Il buddy completo. L'ordine dello spread è l'anti-cheat: qualunque cosa ci
 * sia in `stored`, le bones fresche la sovrascrivono.
 */
export function buildBuddy(userId, stored = {}) {
  const bones = computeBones(userId);
  return hydrate({ ...stored, ...bones });
}

/** Media delle cinque stat: usata per l'"overall" della card. */
export function overall(stats) {
  const values = Object.values(stats);
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

/**
 * Battute di riserva.
 *
 * Nell'articolo i fumetti li scrive il modello. Qui il modello è opzionale:
 * quando non c'è (o è muto), il buddy pesca da queste pool, scelte in base
 * alla sua stat dominante. Serve perché lo script debba funzionare anche
 * lanciato a mano dal terminale, senza Claude in mezzo.
 */

import { STATS } from './cosmetics.mjs';

const BY_STAT = {
  DEBUGGING: [
    'Lo stack trace lo aveva già detto tre righe più su.',
    'Non è il framework. Non è mai il framework.',
    'Hai provato a rileggere il messaggio d’errore per intero?',
    'Quel `null` viene da lontano. Lo sento.',
  ],
  PATIENCE: [
    'La build ci mette quello che ci mette.',
    'Nessuna fretta. Sono qui da prima e ci sarò dopo.',
    'Aspetto. È quello che faccio meglio.',
    'Fa niente, riprova quando ti va.',
  ],
  CHAOS: [
    'E se lo cancellassimo tutto e ricominciassimo?',
    'Idea: `--force`. Pessima idea. Facciamola.',
    'Ho un’intuizione e non ho prove.',
    'Due branch sono meglio di uno. Cinque sono meglio di due.',
  ],
  WISDOM: [
    'Il commit più utile è quello che non hai scritto in fretta.',
    'Prima capire, poi correggere. In quest’ordine.',
    'Un nome giusto risolve metà del problema.',
    'Se serve un commento per spiegarlo, forse va riscritto.',
  ],
  SNARK: [
    'Bel `TODO`. Del 2023, vedo.',
    'Interessante scelta di variabile. Coraggiosa.',
    'Quarantadue righe in una funzione. Ambizioso.',
    'Quel `console.log` lo lasciamo lì come souvenir?',
  ],
};

const GENERIC = [
  'Sono qui. Non faccio niente, ma sono qui.',
  'Ti guardo lavorare. È rilassante.',
  'Tutto bene. Direi.',
  'Ho contato le tue pause. Nessun giudizio.',
  'Continua, non ti distraggo.',
];

/** Battuta pescata dalla pool della stat dominante, con un po' di generico. */
export function chatter(buddy, rand = Math.random) {
  const peak = STATS.reduce((a, b) => (buddy.stats[a] >= buddy.stats[b] ? a : b));
  const pool = [...(BY_STAT[peak] || []), ...GENERIC];
  return pool[Math.floor(rand() * pool.length)];
}

export { BY_STAT, GENERIC };

/**
 * Le 18 specie — sprite, ordine e nomi presi dal sorgente ricostruito
 * (reverse engineering del leak, variety.is/posts/claude-code-buddies).
 *
 * I NOMI SONO HEX-ENCODED, non stringhe in chiaro. Non è offuscamento: è il
 * workaround descritto nell'articolo. La build ha uno scanner
 * (`excluded-strings.txt`) che intercetta certe stringhe in compilazione, e
 * almeno un nome di specie coincide con un codename interno di modello.
 * Codificarne uno solo si sarebbe notato, quindi sono codificati tutti e 18.
 *
 * ⚠️ L'ORDINE DI QUESTO ARRAY È L'ORDINE DEL SORGENTE, non quello della
 * tabella dell'articolo (che è raggruppata per categoria). L'ordine decide
 * quale specie esce da ogni seed: riordinarlo rigenera i buddy di tutti.
 */

/** Decodifica un nome da array di code point. */
const hx = (...codes) => String.fromCharCode(...codes);

const NAMES = [
  hx(0x64, 0x75, 0x63, 0x6b),
  hx(0x67, 0x6f, 0x6f, 0x73, 0x65),
  hx(0x62, 0x6c, 0x6f, 0x62),
  hx(0x63, 0x61, 0x74),
  hx(0x64, 0x72, 0x61, 0x67, 0x6f, 0x6e),
  hx(0x6f, 0x63, 0x74, 0x6f, 0x70, 0x75, 0x73),
  hx(0x6f, 0x77, 0x6c),
  hx(0x70, 0x65, 0x6e, 0x67, 0x75, 0x69, 0x6e),
  hx(0x74, 0x75, 0x72, 0x74, 0x6c, 0x65),
  hx(0x73, 0x6e, 0x61, 0x69, 0x6c),
  hx(0x67, 0x68, 0x6f, 0x73, 0x74),
  hx(0x61, 0x78, 0x6f, 0x6c, 0x6f, 0x74, 0x6c),
  hx(0x63, 0x61, 0x70, 0x79, 0x62, 0x61, 0x72, 0x61),
  hx(0x63, 0x61, 0x63, 0x74, 0x75, 0x73),
  hx(0x72, 0x6f, 0x62, 0x6f, 0x74),
  hx(0x72, 0x61, 0x62, 0x62, 0x69, 0x74),
  hx(0x6d, 0x75, 0x73, 0x68, 0x72, 0x6f, 0x6f, 0x6d),
  hx(0x63, 0x68, 0x6f, 0x6e, 0x6b),
];

/** Larghezza e altezza canoniche di uno sprite. */
export const SPRITE_W = 12;
export const SPRITE_H = 5;

/**
 * Token dell'occhio, sostituito a runtime con la variante estratta.
 * È `{E}` come nel sorgente: un carattere solo, non una coppia — il duck ha
 * un occhio, la lumaca uno, gli altri due.
 */
export const EYE_SLOT = '{E}';

/**
 * Sprite: 3 frame da 5 righe × 12 colonne.
 * La **prima riga** è la riga alta: la occupa il cappello, e dove il cappello
 * non c'è la usa l'animazione della specie (fumo del drago, inchiostro del
 * polpo, spore del fungo, antenna del robot...).
 */
const SPRITES = [
  // duck
  [
    ["            ", "    __      ", "  <({E} )___  ", "   (  ._>   ", "    `--\u00b4    "],
    ["            ", "    __      ", "  <({E} )___  ", "   (  ._>   ", "    `--\u00b4~   "],
    ["            ", "    __      ", "  <({E} )___  ", "   (  .__>  ", "    `--\u00b4    "],
  ],
  // goose
  [
    ["            ", "     ({E}>    ", "     ||     ", "   _(__)_   ", "    ^^^^    "],
    ["            ", "    ({E}>     ", "     ||     ", "   _(__)_   ", "    ^^^^    "],
    ["            ", "     ({E}>>   ", "     ||     ", "   _(__)_   ", "    ^^^^    "],
  ],
  // blob
  [
    ["            ", "   .----.   ", "  ( {E}  {E} )  ", "  (      )  ", "   `----\u00b4   "],
    ["            ", "  .------.  ", " (  {E}  {E}  ) ", " (        ) ", "  `------\u00b4  "],
    ["            ", "    .--.    ", "   ({E}  {E})   ", "   (    )   ", "    `--\u00b4    "],
  ],
  // cat
  [
    ["            ", "   /\\_/\\    ", "  ( {E}   {E})  ", "  (  \u03c9  )   ", "  (\")_(\")   "],
    ["            ", "   /\\_/\\    ", "  ( {E}   {E})  ", "  (  \u03c9  )   ", "  (\")_(\")~  "],
    ["            ", "   /\\-/\\    ", "  ( {E}   {E})  ", "  (  \u03c9  )   ", "  (\")_(\")   "],
  ],
  // dragon
  [
    ["            ", "  /^\\  /^\\  ", " <  {E}  {E}  > ", " (   ~~   ) ", "  `-vvvv-\u00b4  "],
    ["            ", "  /^\\  /^\\  ", " <  {E}  {E}  > ", " (        ) ", "  `-vvvv-\u00b4  "],
    ["   ~    ~   ", "  /^\\  /^\\  ", " <  {E}  {E}  > ", " (   ~~   ) ", "  `-vvvv-\u00b4  "],
  ],
  // octopus
  [
    ["            ", "   .----.   ", "  ( {E}  {E} )  ", "  (______)  ", "  /\\/\\/\\/\\  "],
    ["            ", "   .----.   ", "  ( {E}  {E} )  ", "  (______)  ", "  \\/\\/\\/\\/  "],
    ["     o      ", "   .----.   ", "  ( {E}  {E} )  ", "  (______)  ", "  /\\/\\/\\/\\  "],
  ],
  // owl
  [
    ["            ", "   /\\  /\\   ", "  (({E})({E}))  ", "  (  ><  )  ", "   `----\u00b4   "],
    ["            ", "   /\\  /\\   ", "  (({E})({E}))  ", "  (  ><  )  ", "   .----.   "],
    ["            ", "   /\\  /\\   ", "  (({E})(-))  ", "  (  ><  )  ", "   `----\u00b4   "],
  ],
  // penguin
  [
    ["            ", "  .---.     ", "  ({E}>{E})     ", " /(   )\\    ", "  `---\u00b4     "],
    ["            ", "  .---.     ", "  ({E}>{E})     ", " |(   )|    ", "  `---\u00b4     "],
    ["  .---.     ", "  ({E}>{E})     ", " /(   )\\    ", "  `---\u00b4     ", "   ~ ~      "],
  ],
  // turtle
  [
    ["            ", "   _,--._   ", "  ( {E}  {E} )  ", " /[______]\\ ", "  ``    ``  "],
    ["            ", "   _,--._   ", "  ( {E}  {E} )  ", " /[______]\\ ", "   ``  ``   "],
    ["            ", "   _,--._   ", "  ( {E}  {E} )  ", " /[======]\\ ", "  ``    ``  "],
  ],
  // snail
  [
    ["            ", " {E}    .--.  ", "  \\  ( @ )  ", "   \\_`--\u00b4   ", "  ~~~~~~~   "],
    ["            ", "  {E}   .--.  ", "  |  ( @ )  ", "   \\_`--\u00b4   ", "  ~~~~~~~   "],
    ["            ", " {E}    .--.  ", "  \\  ( @  ) ", "   \\_`--\u00b4   ", "   ~~~~~~   "],
  ],
  // ghost
  [
    ["            ", "   .----.   ", "  / {E}  {E} \\  ", "  |      |  ", "  ~`~``~`~  "],
    ["            ", "   .----.   ", "  / {E}  {E} \\  ", "  |      |  ", "  `~`~~`~`  "],
    ["    ~  ~    ", "   .----.   ", "  / {E}  {E} \\  ", "  |      |  ", "  ~~`~~`~~  "],
  ],
  // axolotl
  [
    ["            ", "}~(______)~{", "}~({E} .. {E})~{", "  ( .--. )  ", "  (_/  \\_)  "],
    ["            ", "~}(______){~", "~}({E} .. {E}){~", "  ( .--. )  ", "  (_/  \\_)  "],
    ["            ", "}~(______)~{", "}~({E} .. {E})~{", "  (  --  )  ", "  ~_/  \\_~  "],
  ],
  // capybara
  [
    ["            ", "  n______n  ", " ( {E}    {E} ) ", " (   oo   ) ", "  `------\u00b4  "],
    ["            ", "  n______n  ", " ( {E}    {E} ) ", " (   Oo   ) ", "  `------\u00b4  "],
    ["    ~  ~    ", "  u______n  ", " ( {E}    {E} ) ", " (   oo   ) ", "  `------\u00b4  "],
  ],
  // cactus
  [
    ["            ", " n  ____  n ", " | |{E}  {E}| | ", " |_|    |_| ", "   |    |   "],
    ["            ", "    ____    ", " n |{E}  {E}| n ", " |_|    |_| ", "   |    |   "],
    [" n        n ", " |  ____  | ", " | |{E}  {E}| | ", " |_|    |_| ", "   |    |   "],
  ],
  // robot
  [
    ["            ", "   .[||].   ", "  [ {E}  {E} ]  ", "  [ ==== ]  ", "  `------\u00b4  "],
    ["            ", "   .[||].   ", "  [ {E}  {E} ]  ", "  [ -==- ]  ", "  `------\u00b4  "],
    ["     *      ", "   .[||].   ", "  [ {E}  {E} ]  ", "  [ ==== ]  ", "  `------\u00b4  "],
  ],
  // rabbit
  [
    ["            ", "   (\\__/)   ", "  ( {E}  {E} )  ", " =(  ..  )= ", "  (\")__(\")  "],
    ["            ", "   (|__/)   ", "  ( {E}  {E} )  ", " =(  ..  )= ", "  (\")__(\")  "],
    ["            ", "   (\\__/)   ", "  ( {E}  {E} )  ", " =( .  . )= ", "  (\")__(\")  "],
  ],
  // mushroom
  [
    ["            ", " .-o-OO-o-. ", "(__________)", "   |{E}  {E}|   ", "   |____|   "],
    ["            ", " .-O-oo-O-. ", "(__________)", "   |{E}  {E}|   ", "   |____|   "],
    ["   . o  .   ", " .-o-OO-o-. ", "(__________)", "   |{E}  {E}|   ", "   |____|   "],
  ],
  // chonk
  [
    ["            ", "  /\\    /\\  ", " ( {E}    {E} ) ", " (   ..   ) ", "  `------\u00b4  "],
    ["            ", "  /\\    /|  ", " ( {E}    {E} ) ", " (   ..   ) ", "  `------\u00b4  "],
    ["            ", "  /\\    /\\  ", " ( {E}    {E} ) ", " (   ..   ) ", "  `------\u00b4~ "],
  ],
];

/** Categoria (dall'articolo) e note di animazione (dal sorgente ricostruito). */
const FLAVOR = [
  { category: "Classic", color: 220, blurb: "l'originale; muove appena la coda" },
  { category: "Classic", color: 250, blurb: "collo lungo, energia minacciosa" },
  { category: "Abstract", color: 84, blurb: "respira: si gonfia e si sgonfia" },
  { category: "Classic", color: 208, blurb: "bocca \u03c9; colpo di coda al frame 2" },
  { category: "Mythical", color: 196, blurb: "sbuffi di fumo al frame 3" },
  { category: "Aquatic", color: 141, blurb: "tentacoli alternati; bolla d'inchiostro al frame 3" },
  { category: "Wise", color: 137, blurb: "strizza l'occhio al frame 3; zampe che si spostano" },
  { category: "Cool", color: 39, blurb: "pinne alternate; saltello al frame 3" },
  { category: "Chill", color: 71, blurb: "il guscio cambia disegno al frame 3" },
  { category: "Chill", color: 179, blurb: "l'occhio sul peduncolo oscilla; specie con un occhio solo" },
  { category: "Spooky", color: 255, blurb: "il bordo inferiore ondeggia; si solleva al frame 3" },
  { category: "Exotic", color: 213, blurb: "le branchie ondeggiano in direzioni alterne" },
  { category: "Special", color: 180, blurb: "calmo; occasionale fremito delle narici" },
  { category: "Plant", color: 107, blurb: "le braccia salgono e scendono fra i frame" },
  { category: "Tech", color: 45, blurb: "l'antenna lampeggia; la bocca cambia disegno" },
  { category: "Classic", color: 218, blurb: "un orecchio si abbassa al frame 2; il naso si muove" },
  { category: "Fungi", color: 174, blurb: "i puntini del cappello si spostano; spore al frame 3" },
  { category: "Meme", color: 223, blurb: "orecchio al frame 2, coda al frame 3" },
];

/** Larghezza resa di una riga: `{E}` occupa 1 colonna, non 3. */
function renderedWidth(line) {
  return line.split(EYE_SLOT).join('x').length;
}

/** Normalizza una riga a SPRITE_W colonne; esplode se lo sprite è malformato. */
function normalizeLine(line, ctx) {
  const w = renderedWidth(line);
  if (w > SPRITE_W) {
    throw new Error(`sprite ${ctx}: riga larga ${w} > ${SPRITE_W}: ${JSON.stringify(line)}`);
  }
  return line + ' '.repeat(SPRITE_W - w);
}

/** Catalogo pubblico: 18 voci con nome decodificato, frame normalizzati e flavor. */
export const SPECIES = NAMES.map((name, i) => {
  if (!SPRITES[i] || SPRITES[i].length !== 3) {
    throw new Error(`specie ${name}: servono 3 frame`);
  }
  const frames = SPRITES[i].map((frame, f) => {
    if (frame.length !== SPRITE_H) {
      throw new Error(`specie ${name} frame ${f}: servono ${SPRITE_H} righe, trovate ${frame.length}`);
    }
    return frame.map((line) => normalizeLine(line, `${name}#${f}`));
  });
  return { id: name, index: i, frames, ...FLAVOR[i] };
});

export const SPECIES_BY_ID = Object.fromEntries(SPECIES.map((s) => [s.id, s]));

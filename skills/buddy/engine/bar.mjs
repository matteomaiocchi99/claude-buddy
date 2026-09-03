/**
 * Installazione del buddy nella statusLine di Claude Code.
 *
 * Il punto delicato: `~/.claude/settings.json` è un file che l'utente cura a
 * mano. Non lo riscriviamo con JSON.stringify — perderebbe la formattazione e
 * il diff diventerebbe illeggibile. Facciamo una sostituzione *chirurgica* del
 * solo valore di `statusLine.command`, lasciando tutto il resto byte per byte
 * come era, con backup e validazione prima di scrivere.
 *
 * Il comando originale non si perde: finisce in state.json come `wraps`, ed è
 * il wrapper a rieseguirlo. `bar off` lo rimette al suo posto.
 */

import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readState, writeState } from './soul.mjs';

const SETTINGS = join(homedir(), '.claude', 'settings.json');
const WRAPPER = join(dirname(fileURLToPath(import.meta.url)), 'statusline.mjs');
const WRAPPER_CMD = `node "${WRAPPER}"`;
const POSITIONS = ['bottom', 'top', 'append', 'prepend'];

const isWrapper = (cmd) => Boolean(cmd) && cmd.includes('buddy/engine/statusline.mjs');

/** Sostituisce il valore di `"command"` dentro il blocco `"statusLine"`. */
function replaceStatusLineCommand(raw, newCmd) {
  const anchor = raw.indexOf('"statusLine"');
  if (anchor === -1) return null;

  // La prima chiave "command" dopo l'ancora è quella della statusLine: le
  // altre (hooks) stanno altrove nel file, non dentro questo oggetto.
  const rel = raw.slice(anchor);
  // La spaziatura intorno ai due punti viene catturata e rimessa identica:
  // il diff su settings.json deve mostrare solo il valore cambiato.
  const m = rel.match(/"command"(\s*):(\s*)"((?:[^"\\]|\\.)*)"/);
  if (!m) return null;

  const start = anchor + m.index;
  const end = start + m[0].length;
  const rebuilt = `"command"${m[1]}:${m[2]}${JSON.stringify(newCmd)}`;
  return raw.slice(0, start) + rebuilt + raw.slice(end);
}

/** Inserisce un blocco statusLine su un settings.json che non ne ha uno. */
function insertStatusLine(raw, newCmd) {
  const open = raw.indexOf('{');
  if (open === -1) return null;
  const block = `\n  "statusLine": {\n    "type": "command",\n    "command": ${JSON.stringify(newCmd)}\n  },`;
  return raw.slice(0, open + 1) + block + raw.slice(open + 1);
}

function readSettings() {
  if (!existsSync(SETTINGS)) return { raw: null, parsed: null };
  const raw = readFileSync(SETTINGS, 'utf8');
  return { raw, parsed: JSON.parse(raw) };
}

/** Scrive solo dopo aver verificato che il risultato sia ancora JSON valido. */
function writeSettings(raw) {
  JSON.parse(raw); // esplode qui, non dopo aver corrotto il file
  copyFileSync(SETTINGS, `${SETTINGS}.bak-buddy`);
  writeFileSync(SETTINGS, raw, 'utf8');
}

/**
 * Stato corrente, in tre modi possibili.
 *
 * `direct`  — settings.json punta al nostro wrapper.
 * `chained` — settings.json punta a un ALTRO wrapper che ci ha catturati.
 *   Esiste davvero: statusline che si "impossessano" di settings.json e
 *   spostano il comando che trovano in un loro file di catena (i kickbacks
 *   fanno esattamente questo). In quel caso NON dobbiamo riprenderci
 *   settings.json — verremmo catturati di nuovo, perdendo la catena.
 * `off`     — non configurato.
 *
 * `cycle` è il caso patologico: il nostro `wraps` punta a chi ci ha
 * catturati, quindi la catena si morde la coda.
 */
export function barStatus() {
  const { parsed } = readSettings();
  const current = parsed?.statusLine?.command ?? null;
  const cfg = readState().statusline || {};
  const configured = Boolean(cfg.position);

  const mode = isWrapper(current) ? 'direct' : configured ? 'chained' : 'off';
  const cycle = mode === 'chained' && Boolean(cfg.wraps) && cfg.wraps === current;

  return {
    mode,
    installed: mode !== 'off',
    cycle,
    capturedBy: mode === 'chained' ? current : null,
    position: cfg.position || null,
    wraps: cfg.wraps || null,
    currentCommand: current,
    settingsPath: SETTINGS,
    wrapperCommand: WRAPPER_CMD,
  };
}

/**
 * Installa (o riconfigura) il wrapper.
 * Idempotente: se è già installato non ri-avvolge se stesso, cambia solo la
 * posizione — altrimenti al secondo giro il wrapper chiamerebbe il wrapper.
 */
export function barInstall(position = 'bottom', { wraps: explicitWraps } = {}) {
  if (!POSITIONS.includes(position)) {
    throw new Error(`posizione non valida: ${position} (valide: ${POSITIONS.join(', ')})`);
  }

  const { raw, parsed } = readSettings();
  const state = readState();
  const current = parsed?.statusLine?.command ?? null;
  const status = barStatus();

  // Già a posto (direct) o dentro la catena di qualcun altro (chained):
  // in entrambi i casi si tocca solo state.json, mai settings.json.
  if (status.mode === 'direct' || status.mode === 'chained') {
    const wraps = explicitWraps ?? state.statusline?.wraps ?? null;
    state.statusline = { ...(state.statusline || {}), position, wraps };
    writeState(state);
    const after = barStatus();
    return {
      action: status.mode === 'chained' ? 'riconfigurato (in catena)' : 'riconfigurato',
      position,
      wraps,
      capturedBy: after.capturedBy,
      cycle: after.cycle,
    };
  }

  if (raw === null) throw new Error(`${SETTINGS} non esiste: creane uno prima`);

  state.statusline = {
    wraps: explicitWraps ?? current,
    position,
    hadStatusLine: Boolean(current),
  };
  writeState(state);

  const next = current
    ? replaceStatusLineCommand(raw, WRAPPER_CMD)
    : insertStatusLine(raw, WRAPPER_CMD);
  if (!next) throw new Error('non riesco a individuare statusLine in settings.json: modificalo a mano');

  writeSettings(next);
  return { action: 'installato', position, wraps: current };
}

/** Disinstalla: rimette il comando originale e dimentica la config. */
export function barRemove() {
  const { raw, parsed } = readSettings();
  const state = readState();
  const cfg = state.statusline || {};
  const current = parsed?.statusLine?.command ?? null;

  if (!isWrapper(current)) return { action: 'non era installato', wraps: cfg.wraps || null };

  if (cfg.wraps) {
    const next = replaceStatusLineCommand(raw, cfg.wraps);
    if (!next) throw new Error('non riesco a rimettere il comando originale: modifica settings.json a mano');
    writeSettings(next);
  }

  delete state.statusline;
  writeState(state);
  return { action: 'rimosso', wraps: cfg.wraps || null };
}

export { POSITIONS, WRAPPER_CMD, SETTINGS };

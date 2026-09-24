// Spielstände im Browser und als Datei.

import { G } from '../game/state.js';
import { RNG } from '../util.js';

const PREFIX = 'turan_save_';
export const SLOTS = ['auto', '1', '2', '3', '4', '5'];

function serialize() {
  G.s.rngState = G.rng.state;
  return JSON.stringify(G.s);
}

export function saveSlot(slot) {
  try {
    const data = serialize();
    localStorage.setItem(PREFIX + slot, data);
    localStorage.setItem(PREFIX + slot + '_meta', JSON.stringify({
      scenario: G.s.scenario, player: G.s.player, year: G.s.year, season: G.s.season, turn: G.s.turn, date: Date.now(),
      facName: G.s.factions[G.s.player]?.n,
    }));
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
}

export function saveAuto() { return saveSlot('auto'); }

export function slotMeta(slot) {
  try {
    const m = localStorage.getItem(PREFIX + slot + '_meta');
    return m ? JSON.parse(m) : null;
  } catch (e) { return null; }
}

export function loadSlotData(slot) {
  try {
    const d = localStorage.getItem(PREFIX + slot);
    return d ? JSON.parse(d) : null;
  } catch (e) { return null; }
}

export function deleteSlot(slot) {
  try { localStorage.removeItem(PREFIX + slot); localStorage.removeItem(PREFIX + slot + '_meta'); } catch (e) { /* ignorieren */ }
}

export function applyState(state, map) {
  G.s = state;
  G.map = map;
  G.rng = new RNG(state.rngState || 12345);
}

export function exportSave() {
  const blob = new Blob([serialize()], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `turan_${G.s.player}_${G.s.year}.json`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

export function importSave() {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = () => {
      const f = input.files[0];
      if (!f) { resolve(null); return; }
      const r = new FileReader();
      r.onload = () => { try { resolve(JSON.parse(r.result)); } catch (e) { resolve(null); } };
      r.readAsText(f);
    };
    input.click();
  });
}

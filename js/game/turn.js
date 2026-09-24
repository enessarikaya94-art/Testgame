// Neues Spiel, Rundenablauf, Siegbedingungen.

import { G, computeBorders, createGame, fac, prov, factionProvinces, factionArmies, aliveFactions, log, END_YEAR, relPeek, rng, S, withArmyIndex } from './state.js';
import { setupRulers, processCharacters, createChar, updateHeir, generals, age, stat } from './characters.js';
import { startingArmies, beginSieges, progressSieges, processRaids, processSupply, resetMovement, checkFactionDeath, assignGeneral } from './military.js';
import { processEconomy, computeDistances, countTrade, clearModCache, orderBreakdown, factionIncome, processRebellions } from './economy.js';
import { processDiplomacy, validateTitles, militaryPower } from './diplomacy.js';
import { aiTurn } from './ai.js';
import { rollEvents, runGlobalEvents } from './events.js';
import { processWorldEvents } from './world-events.js';
import { initMarket, updateMarket, expirePayments } from './market.js';
import { SCENARIOS } from '../data/scenarios.js';
import { FACTIONS, TITLES } from '../data/factions.js';
import { initDiscovery, processDiscovery } from './discovery.js';

export function newGame(scenarioId, playerFid, mapData, seed) {
  const s = createGame(scenarioId, playerFid, seed ?? Math.floor(Math.random() * 1e9), mapData);
  setupRulers(SCENARIOS[scenarioId]);
  startingArmies();
  assignStartingGenerals();
  initMarket();
  refreshCaches();
  initDiscovery();
  for (const pid in s.provinces) {
    const p = s.provinces[pid];
    p.order = orderBreakdown(pid).total;
  }
  for (const f of aliveFactions()) if (f.id !== 'rebels') f.last = factionIncome(f.id);
  resetMovement();
  log('log.start', { year: s.year }, { imp: true });
  return s;
}

function assignStartingGenerals() {
  const s = G.s;
  for (const f of aliveFactions()) {
    if (f.id === 'rebels') continue;
    const armies = factionArmies(f.id).sort((a, b) => b.units.length - a.units.length);
    const cands = generals(f.id).filter((c) => c.id !== f.vizier && age(c) >= 16 && !c.female)
      .sort((a, b) => (b.id === f.ruler) - (a.id === f.ruler) || stat(b, 'mar') - stat(a, 'mar'));
    for (const a of armies) {
      const c = cands.shift();
      if (!c) break;
      if (c.id === f.ruler && stat(c, 'mar') < 4 && cands.length) { cands.push(c); continue; }
      assignGeneral(a, c.id);
    }
  }
}

export function refreshCaches() {
  clearModCache();
  computeBorders();
  computeDistances();
  countTrade();
}

let busy = false;
export function isBusy() { return busy; }

export async function endTurn(progress) {
  if (busy) return;
  busy = true;
  const s = G.s;
  try {
    refreshCaches();
    const order = aliveFactions().map((f) => f.id).filter((id) => s.observer || id !== s.player);
    // KI zieht in zufälliger Reihenfolge, Aufständische zuletzt
    for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(rng().next() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    order.sort((a, b) => (a === 'rebels') - (b === 'rebels'));
    let n = 0;
    for (const fid of order) {
      n++;
      if (!fac(fid)?.alive) continue;
      if (progress) progress(n / order.length, fid);
      try { await aiTurn(fid); } catch (e) { console.error('KI-Fehler', fid, e); }
      clearModCache();
    }
    // Rundenende für alle
    beginSieges();
    await progressSieges();
    processRaids();
    processSupply();
    refreshCaches();
    for (const f of aliveFactions().slice()) {
      if (f.id === 'rebels') continue;
      if (!factionProvinces(f.id).length) checkFactionDeath(f.id, null);
    }
    withArmyIndex(() => {
      for (const f of aliveFactions()) if (f.id !== 'rebels') processEconomy(f.id);
    });
    for (const f of aliveFactions()) if (f.id !== 'rebels') processCharacters(f.id);
    // Neue unabhängige Fraktionen brauchen Herrscher
    if (s.pendingRulers?.length) {
      for (const fid of s.pendingRulers) {
        if (!s.factions[fid]?.alive) continue;
        const r = createChar(fid, { role: 'ruler' });
        s.factions[fid].ruler = r.id;
        createChar(fid, { born: r.born + 20, father: r.id, role: 'family' });
        updateHeir(fid);
      }
      s.pendingRulers = [];
    }
    processRebellions();
    if (s.season === 3) { processDiplomacy(); updateMarket(); }
    expirePayments();
    validateTitles();
    runGlobalEvents();
    processDiscovery();
    processWorldEvents();
    for (const f of aliveFactions()) rollEvents(f.id);
    for (const f of aliveFactions()) if (f.id !== 'rebels' && !factionProvinces(f.id).length) checkFactionDeath(f.id, null);
    // Zeit
    s.turn++;
    s.season = (s.season + 1) % 4;
    if (s.season === 0) s.year++;
    resetMovement();
    refreshCaches();
    checkGameOver();
  } finally {
    busy = false;
  }
}

// ---------- Ziele & Wertung ----------
export function goalStatus(fid) {
  const f = fac(fid);
  const goals = FACTIONS[fid]?.goals || [{ t: 'count', n: Math.max(6, factionProvinces(fid).length * 2) }, { t: 'survive' }];
  return goals.map((g) => {
    let done = false, prog = '';
    if (g.t === 'own') {
      const owned = g.p.filter((p) => prov(p).owner === fid).length;
      done = owned === g.p.length; prog = `${owned}/${g.p.length}`;
    } else if (g.t === 'count') {
      const c = factionProvinces(fid).length;
      done = c >= g.n; prog = `${c}/${g.n}`;
    } else if (g.t === 'title') {
      done = f.titles.includes(g.id); prog = done ? '✓' : '—';
    } else if (g.t === 'tech') {
      done = f.techs.length >= g.n; prog = `${f.techs.length}/${g.n}`;
    } else if (g.t === 'survive') {
      done = G.s.year >= END_YEAR && f.alive; prog = `${G.s.year}/${END_YEAR}`;
    } else if (g.t === 'independent') {
      done = !f.overlord; prog = done ? '✓' : '—';
    }
    return { ...g, done, prog };
  });
}

export function score(fid) {
  const f = fac(fid);
  if (!f?.alive) return 0;
  const provs = factionProvinces(fid);
  const pop = provs.reduce((s, p) => s + prov(p).pop, 0);
  return Math.round(provs.length * 10 + pop / 20 + f.prestige * 0.5 + f.techs.length * 5 + f.titles.length * 25 + Math.max(0, f.gold) / 50);
}

export function ranking() {
  return aliveFactions().filter((f) => f.id !== 'rebels').map((f) => ({ id: f.id, score: score(f.id), provs: factionProvinces(f.id).length })).sort((a, b) => b.score - a.score);
}

function checkGameOver() {
  const s = G.s;
  if (s.gameOver || s.observer) return;
  const pf = fac(s.player);
  if (!pf.alive) {
    s.gameOver = { type: 'defeat' };
    return;
  }
  const goals = goalStatus(s.player).filter((g) => g.t !== 'survive');
  if (goals.length && goals.every((g) => g.done) && !s.flags.victoryShown) {
    s.flags.victoryShown = true;
    s.gameOver = { type: 'victory', canContinue: true };
    return;
  }
  if (s.year >= END_YEAR) {
    const r = ranking();
    s.gameOver = { type: 'end', rank: r.findIndex((x) => x.id === s.player) + 1 };
  }
}

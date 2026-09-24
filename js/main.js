// Einstiegspunkt: Karte erzeugen, Menüs, Spielstart.

import { generateMap } from './map/mapgen.js';
import { MapView } from './map/render.js';
import { G, fac, factionProvinces, aliveFactions } from './game/state.js';
import { newGame, refreshCaches, endTurn, goalStatus, ranking } from './game/turn.js';
import { SCENARIOS } from './data/scenarios.js';
import { FACTIONS, TITLES } from './data/factions.js';
import { GOVERNMENTS, RELIGIONS } from './data/world.js';
import { t, L, lang, setLang, onLangChange } from './i18n.js';
import { $, delegate, openModal, toast } from './ui/dom.js';
import { initGameUI, attachMap, refreshAll, startOfTurn, selectProvince, UIState, clearSelection } from './ui/game-ui.js';
import { helpScreen } from './ui/screens.js';
import { slotMeta, loadSlotData, applyState, SLOTS, importSave } from './ui/saves.js';
import { esc } from './util.js';
import { PROVINCE_BY_ID } from './data/provinces.js';

let map = null, view = null;
let gameUIReady = false;
const setup = { scenario: 's1000', faction: 'seljuk', showMinor: false };

async function boot() {
  $('#loading-text').textContent = t('load.map');
  await new Promise((r) => setTimeout(r, 30));
  map = generateMap();
  view = new MapView($('#map'), map);
  await document.fonts?.ready;
  view.invalidate();
  $('#loading').style.display = 'none';
  onLangChange(() => { document.documentElement.lang = lang(); if (currentScreen === 'menu') showMenu(); if (currentScreen === 'setup') renderSetup(); view.invalidate(); });
  const params = new URLSearchParams(location.search);
  if (params.has('sim')) { runSimulation(params); return; }
  showMenu();
}

let currentScreen = null;
function show(screen) {
  currentScreen = screen;
  $('#menu').style.display = screen === 'menu' ? 'flex' : 'none';
  $('#setup').style.display = screen === 'setup' ? 'flex' : 'none';
  $('#game').style.display = screen === 'game' ? 'block' : 'none';
  document.body.classList.toggle('in-game', screen === 'game');
}

// ---------- Hauptmenü ----------
function showMenu() {
  show('menu');
  // Hintergrundkarte mit dem ersten Szenario
  previewScenario(setup.scenario);
  view.cam.z = 0.45; view.centerOn('merv');
  const auto = slotMeta('auto');
  $('#menu .menu-card').innerHTML = `
    <h1>Turan</h1>
    <p class="subtitle">${esc(t('menu.subtitle'))}</p>
    <div class="menu-buttons">
      <button class="primary" data-act="new">${esc(t('menu.new'))}</button>
      ${auto ? `<button data-act="continue">${esc(t('menu.continue'))} <small>${esc(L(auto.facName || { de: auto.player }))} · ${auto.year}</small></button>` : ''}
      <button data-act="load">${esc(t('menu.load'))}</button>
      <button data-act="help">${esc(t('menu.help'))}</button>
      <div class="langs"><button data-act="lang" data-l="de" class="${lang() === 'de' ? 'on' : ''}">Deutsch</button><button data-act="lang" data-l="tr" class="${lang() === 'tr' ? 'on' : ''}">Türkçe</button></div>
    </div>
    <p class="credits">${esc(t('menu.credits'))}</p>`;
}

delegate($('#menu'), {
  new: () => { renderSetup(); show('setup'); },
  continue: () => { const d = loadSlotData('auto'); if (d) loadGame(d); },
  load: () => loadDialog(),
  help: () => helpScreen(),
  lang: (el) => setLang(el.dataset.l),
});

function loadDialog() {
  const html = `<h2>${esc(t('menu.load'))}</h2><div class="slots">${SLOTS.map((sl) => {
    const m = slotMeta(sl);
    return `<button data-act="ld" data-s="${sl}" ${m ? '' : 'disabled'}>📂 ${sl === 'auto' ? esc(t('menu.auto')) : esc(t('menu.slot')) + ' ' + sl}<small>${m ? esc(L(m.facName || { de: m.player })) + ' · ' + m.year : esc(t('menu.empty'))}</small></button>`;
  }).join('')}</div><div class="actions center"><button data-act="imp">⬆ ${esc(t('menu.import'))}</button></div>`;
  openModal(html, {
    handlers: (close) => ({
      ld: (el) => { const d = loadSlotData(el.dataset.s); close(); if (d) loadGame(d); },
      imp: async () => { const d = await importSave(); close(); if (d) loadGame(d); else toast(t('menu.importFail')); },
    }),
  });
}

// ---------- Spielvorbereitung ----------
function previewScenario(sid) {
  newGame(sid, setup.faction in SCENARIOS[sid].owners ? setup.faction : Object.keys(SCENARIOS[sid].owners)[0], map, 42);
  view.game = view.game || previewAccess();
  view.mode = 'political';
  view.rebuildOverlay();
}

function previewAccess() {
  return {
    get player() { return setup.faction; },
    owner: (pid) => G.s.provinces[pid].owner,
    provColor: (pid) => {
      const o = G.s.provinces[pid].owner;
      const f = G.s.factions[o];
      if (!f) return null;
      const h = f.color.replace('#', '');
      const c = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
      const hi = o === setup.faction;
      return [...c, hi ? 200 : 90];
    },
    facShortName: (fid) => L(G.s.factions[fid]?.n || ''),
    facColor: (fid) => G.s.factions[fid]?.color || '#777',
    cityInfo: (pid) => ({ color: G.s.factions[G.s.provinces[pid].owner]?.color || '#777', pop: G.s.provinces[pid].pop, walls: G.s.provinces[pid].buildings.walls || 0, capital: G.s.factions[G.s.provinces[pid].owner]?.capital === pid, holy: false, siege: false, revolt: false }),
    armies: () => [],
    armyMenText: () => '',
    pathMarks: () => [],
  };
}

function renderSetup() {
  const sc = SCENARIOS[setup.scenario];
  const present = Object.keys(sc.owners);
  if (!present.includes(setup.faction)) setup.faction = present.find((f) => FACTIONS[f].major) || present[0];
  previewScenario(setup.scenario);
  const majors = present.filter((f) => FACTIONS[f].major);
  const minors = present.filter((f) => !FACTIONS[f].major);
  const turkic = (f) => FACTIONS[f].turkic;
  const sortF = (a, b) => (turkic(b) - turkic(a)) || (sc.owners[b].length - sc.owners[a].length);
  majors.sort(sortF); minors.sort(sortF);
  const fd = FACTIONS[setup.faction];
  const fs = G.s.factions[setup.faction];
  const item = (f) => `<button class="fitem ${f === setup.faction ? 'on' : ''}" data-act="fac" data-f="${f}"><span class="swatch" style="background:${FACTIONS[f].color}"></span><span>${esc(L(FACTIONS[f].n))}</span>${turkic(f) ? '<span class="tk" title="Türk">☾</span>' : ''}<small>${sc.owners[f].length}</small></button>`;
  const goals = goalStatus(setup.faction);
  const ruler = G.s.chars[fs.ruler];
  $('#setup').innerHTML = `
  <div class="setup-panel">
    <button class="back" data-act="back">← ${esc(t('ui.back'))}</button>
    <h2>${esc(t('setup.scenario'))}</h2>
    <div class="scenarios">${Object.entries(SCENARIOS).map(([id, s]) => `<button class="scen ${id === setup.scenario ? 'on' : ''}" data-act="scen" data-s="${id}"><b>${esc(L(s.n))}</b></button>`).join('')}</div>
    <p class="scen-desc">${esc(L(sc.desc))}</p>
    <h2>${esc(t('setup.faction'))}</h2>
    <div class="flist">${majors.map(item).join('')}</div>
    <button class="linklike" data-act="minor">${esc(setup.showMinor ? t('setup.hideMinor') : t('setup.showMinor', { n: minors.length }))}</button>
    ${setup.showMinor ? `<div class="flist minor">${minors.map(item).join('')}</div>` : ''}
  </div>
  <div class="setup-detail">
    <h2><span class="swatch" style="background:${fd.color}"></span>${esc(L(fd.n))}</h2>
    ${fd.desc ? `<p>${esc(L(fd.desc))}</p>` : `<p class="muted">${esc(t('setup.minorDesc'))}</p>`}
    <table class="kv small">
      <tr><th>${esc(t('fac.ruler'))}</th><td>${ruler ? esc(L(ruler.n)) : '—'}</td></tr>
      <tr><th>${esc(t('fac.gov'))}</th><td>${esc(L(GOVERNMENTS[fs.gov].n))}</td></tr>
      <tr><th>${esc(t('fac.religion'))}</th><td>${esc(L(RELIGIONS[fs.religion].n))}</td></tr>
      <tr><th>${esc(t('dip.provinces'))}</th><td>${factionProvinces(setup.faction).length}</td></tr>
      ${fs.titles.length ? `<tr><th>${esc(t('fac.titles'))}</th><td>${fs.titles.map((x) => esc(L(TITLES[x].n))).join(', ')}</td></tr>` : ''}
      ${fs.overlord ? `<tr><th>${esc(t('fac.overlord'))}</th><td>${esc(L(G.s.factions[fs.overlord].n))}</td></tr>` : ''}
    </table>
    <h3>${esc(t('fac.goals'))}</h3>
    <ul class="goals">${goals.map((g) => `<li>⬜ ${esc(goalLabel(g))}</li>`).join('')}</ul>
    <button class="primary big" data-act="start">${esc(t('setup.start'))}</button>
  </div>`;
  const cap = fs.capital;
  if (cap) view.centerOn(cap, 0.55);
}

function goalLabel(g) {
  if (g.t === 'own') return t('goal.own', { list: g.p.map((p) => L(PROVINCE_BY_ID[p].n)).join(', ') });
  if (g.t === 'count') return t('goal.count', { n: g.n });
  if (g.t === 'title') return t('goal.title', { title: L(TITLES[g.id].n) });
  if (g.t === 'tech') return t('goal.tech', { n: g.n });
  if (g.t === 'survive') return t('goal.survive', { year: 1300 });
  if (g.t === 'independent') return t('goal.independent');
  return '';
}

delegate($('#setup'), {
  back: () => showMenu(),
  scen: (el) => { setup.scenario = el.dataset.s; renderSetup(); },
  fac: (el) => { setup.faction = el.dataset.f; renderSetup(); },
  minor: () => { setup.showMinor = !setup.showMinor; renderSetup(); },
  start: () => startGame(),
});

function setupMapClick(hit) {
  if (currentScreen !== 'setup' || !hit.prov) return;
  const o = G.s.provinces[hit.prov].owner;
  if (o && o !== 'rebels') {
    setup.faction = o;
    if (!FACTIONS[o].major) setup.showMinor = true;
    renderSetup();
  }
}

// ---------- Spiel ----------
function ensureGameUI() {
  if (!gameUIReady) {
    initGameUI(view);
    gameUIReady = true;
    UIState.onExit = () => { clearSelection(); view.on('click', setupMapClick); view.game = previewAccess(); showMenu(); };
    UIState.onLoad = (d) => loadGame(d);
  }
  attachMap(view);
}

async function startGame() {
  newGame(setup.scenario, setup.faction, map);
  ensureGameUI();
  show('game');
  const cap = fac(G.s.player).capital;
  view.cam.z = 0.9;
  if (cap) view.centerOn(cap);
  refreshAll();
  const sc = SCENARIOS[setup.scenario];
  await openModal(`<h2>${esc(L(sc.n))}</h2><p>${esc(L(sc.desc))}</p><h3>${esc(L(FACTIONS[setup.faction].n))}</h3><p>${esc(L(FACTIONS[setup.faction].desc || { de: '', tr: '' }))}</p><p class="muted small">${esc(t('intro.hint'))}</p><div class="actions center"><button class="primary" data-act="ok">${esc(t('ui.begin'))}</button><button data-act="help">${esc(t('menu.help'))}</button></div>`, {
    wide: true, handlers: (close) => ({ ok: () => close(true), help: () => { close(true); helpScreen(); } }),
  });
  if (cap) selectProvince(cap);
}

function loadGame(state) {
  applyState(state, map);
  refreshCaches();
  ensureGameUI();
  show('game');
  const cap = fac(G.s.player)?.capital;
  view.cam.z = 0.9;
  if (cap) view.centerOn(cap);
  refreshAll();
  toast(t('menu.loaded'));
}

// ---------- Simulation (Testmodus: ?sim=Runden&scenario=s1071) ----------
async function runSimulation(params) {
  const turns = +params.get('sim') || 20;
  const sid = params.get('scenario') || 's1000';
  newGame(sid, Object.keys(SCENARIOS[sid].owners)[0], map, +params.get('seed') || 7);
  G.s.observer = true;
  window.__G = G;
  view.game = previewAccess();
  show('game');
  const t0 = performance.now();
  const errors = [];
  const origErr = console.error;
  console.error = (...a) => { errors.push(a.map(String).join(' ')); origErr(...a); };
  for (let i = 0; i < turns; i++) {
    try { await endTurn(); } catch (e) { errors.push(String(e.stack || e)); break; }
  }
  view.rebuildOverlay();
  const r = ranking().slice(0, 12).map((x) => `${x.id}:${x.provs}:${x.score}`);
  window.__sim = {
    ms: Math.round(performance.now() - t0), year: G.s.year, turn: G.s.turn, errors,
    alive: aliveFactions().length, top: r, armies: Object.keys(G.s.armies).length,
    wars: Object.values(G.s.rel).filter((x) => x.war).length,
    log: G.s.log.slice(-25).map((e) => e.k),
  };
}

boot().then(() => { view.on('click', setupMapClick); }).catch((e) => {
  console.error(e);
  $('#loading-text').textContent = 'Fehler: ' + e.message;
});

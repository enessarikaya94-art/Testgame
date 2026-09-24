// Hauptoberfläche im Spiel: Leiste, Kartenmodi, Auswahlpanel, Dialoge.

import { G, fac, prov, pdef, chr, army, factionProvinces, factionArmies, armiesIn, atWar, relPeek, opinion, facName, provName, aliveFactions, ROUTES_BY_PROV, END_YEAR } from '../game/state.js';
import { orderBreakdown, provinceIncome, factionIncome, buildOptions, startBuilding, recruitOptions, recruit, recruitLimit, religionShare, getMods, clearModCache } from '../game/economy.js';
import { findPath, findRoute, advanceArmy, setStance, STANCES, pathTurns, moveArmy, assault, armyMen, armySpeed, mergeArmies, splitArmy, assignGeneral, garrisonPower, armyPower, siegeNeeded, effectiveWalls, isCavalryOnly } from '../game/military.js';
import { TACTICS } from '../game/battle.js';
import { endTurn, isBusy, refreshCaches, goalStatus } from '../game/turn.js';
import { stat, age, loyalty, generals } from '../game/characters.js';
import { TERRAINS, RELIGIONS, CULTURES, GOODS, TRADE_ROUTES, SEASONS, GOVERNMENTS } from '../data/world.js';
import { BUILDINGS, buildingName } from '../data/buildings.js';
import { UNITS, UNIT_CLASSES } from '../data/units.js';
import { TECHS, techCost } from '../data/techs.js';
import { TRAITS } from '../data/people.js';
import { PROVINCES } from '../data/provinces.js';
import { t, L, lang } from '../i18n.js';
import { $, $$, delegate, bar, swatch, toast, openModal, modalOpen, closeTopModal } from './dom.js';
import { esc, fmt, signed, hexToRgb, clamp } from '../util.js';
import * as screens from './screens.js';
import { formatLog } from './format.js';
import { DISEASES } from '../game/world-events.js';
import { specialtiesOf } from '../data/specialties.js';
import { FOCUS, setFocus, goodPrice, monopolies, RESOURCES } from '../game/market.js';
import { saveAuto } from './saves.js';
import { canSee, knownRegions } from '../game/discovery.js';

export const UIState = { map: null, tab: 'info', splitSel: new Set(), onExit: null };

export const STANCE_ICON = { normal: '🚶', forced: '💨', intercept: '👁', fortify: '🛡' };
export const CLASS_ICON = { ha: '🏹', lc: '🐎', hc: '🛡', camel: '🐪', inf: '⚔', spear: '🔱', arch: '🎯', ele: '🐘', siege: '⚙' };

// ---------- Zugriff für die Karte ----------
function makeGameAccess() {
  return {
    get player() { return G.s.player; },
    get turn() { return G.s.turn; },
    hostile: (fid) => atWar(G.s.player, fid),
    specialties: (pid) => specialtiesOf(pid),
    owner: (pid) => G.s.provinces[pid].owner,
    provColor,
    facShortName: (fid) => (G.s.factions[fid] ? L(G.s.factions[fid].n) : ''),
    facColor: (fid) => G.s.factions[fid]?.color || '#777',
    cityInfo: (pid) => {
      const p = G.s.provinces[pid];
      const f = G.s.factions[p.owner];
      return {
        color: f?.color || '#777', pop: p.pop, walls: effectiveWalls(pid), capital: f?.capital === pid,
        holy: pdef(pid).holy, siege: !!p.siege, revolt: p.order < 20, plague: !!p.plague, famine: p.famine > 0,
      };
    },
    armies: () => Object.values(G.s.armies).filter((a) => a.units.length),
    armyMenText: (a) => fmt(armyMen(a)),
    pathMarks: (a, path) => pathTurns(a, path),
    visible: (pid) => G.s.observer || canSee(G.s.player, pid),
    knownRegions: () => (G.s.observer ? knownRegions(null) : knownRegions(G.s.player)),
  };
}

function provColor(pid, mode) {
  const s = G.s;
  const p = s.provinces[pid];
  const f = s.factions[p.owner];
  const rgb = (hex, a) => [...hexToRgb(hex), a];
  if (!s.observer && !canSee(s.player, pid)) return null;
  switch (mode) {
    case 'terrain': return rgb(TERRAINS[pdef(pid).terrain].color, 170);
    case 'religion': {
      const [r, share] = Object.entries(p.rel).sort((a, b) => b[1] - a[1])[0];
      return rgb(RELIGIONS[r].color, Math.round(70 + share * 110));
    }
    case 'culture': return rgb(CULTURES[p.culture].color, 140);
    case 'special': {
      const sp = specialtiesOf(pid);
      const cnt = { eco: 0, cul: 0, mil: 0 };
      for (const x of sp) cnt[x.cat]++;
      const top = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
      const col = { eco: '#c9a227', cul: '#7b4fa0', mil: '#a8322a' }[top[0]];
      return rgb(col, 60 + top[1] * 45);
    }
    case 'order': {
      const o = p.order / 100;
      return [Math.round(200 - o * 150), Math.round(60 + o * 130), 50, 140];
    }
    case 'trade': {
      const inc = provinceIncome(pid);
      const v = clamp((inc.goods + inc.route) / 14, 0, 1);
      return [Math.round(240 - v * 90), Math.round(220 - v * 120), Math.round(170 - v * 140), Math.round(60 + v * 140)];
    }
    case 'diplomacy': {
      const me = s.player;
      const o = p.owner;
      if (o === me) return [201, 162, 39, 160];
      if (o === 'rebels') return [80, 80, 80, 140];
      if (s.factions[o]?.overlord === me) return [226, 200, 110, 140];
      if (s.factions[me]?.overlord === o) return [170, 130, 40, 140];
      if (atWar(me, o)) return [190, 40, 30, 150];
      const r = relPeek(me, o);
      if (r?.alliance) return [60, 150, 60, 140];
      if ((r?.truce || 0) > s.turn) return [150, 150, 150, 120];
      if (r?.trade) return [70, 120, 180, 120];
      const op = opinion(me, o);
      return op >= 0 ? [90, 160, 90, Math.round(20 + op)] : [170, 70, 50, Math.round(20 - op)];
    }
    default:
      if (!f) return null;
      return rgb(f.color, p.owner === 'rebels' ? 130 : 110);
  }
}

// ---------- Initialisierung ----------
export function attachMap(map) {
  UIState.map = map;
  map.game = makeGameAccess();
  map.sel = { prov: null, army: null };
  map.preview = null;
  map.on('click', onMapClick);
  map.on('rightclick', onMapRightClick);
  map.on('hover', onHover);
  map.on('armyDrag', onArmyDrag);
  map.on('armyDrop', onArmyDrop);
}

export function initGameUI(map) {
  attachMap(map);
  G.ui = {
    chooseTactic: (info, side) => screens.tacticDialog(info, side),
    battleReport: (rep) => { UIState.pendingReports = UIState.pendingReports || []; UIState.pendingReports.push(rep); },
    chooseCapture: (ctx) => screens.captureDialog(ctx),
  };
  delegate($('#topbar'), {
    endturn: () => doEndTurn(),
    faction: () => screens.factionScreen(),
    diplomacy: () => screens.diplomacyScreen(),
    research: () => screens.researchScreen(),
    dynasty: () => screens.dynastyScreen(),
    chronicle: () => screens.chronicleScreen(),
    ranking: () => screens.rankingScreen(),
    menu: () => screens.gameMenu(),
    lang: () => { screens.toggleLang(); },
    capital: () => { const c = fac(G.s.player).capital; if (c) { map.centerOn(c, 1); selectProvince(c); } },
  });
  delegate($('#mapmodes'), {
    mode: (el) => { map.mode = el.dataset.mode; map.rebuildOverlay(); renderMapModes(); renderLegend(); },
  });
  delegate($('#panel'), panelHandlers);
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.key === 'Escape') {
      if (modalOpen()) closeTopModal();
      else { clearSelection(); }
    }
    if (e.key === 'Enter' && !modalOpen() && document.body.classList.contains('in-game')) doEndTurn();
    if ((e.key === 'n' || e.key === 'N') && !modalOpen() && document.body.classList.contains('in-game')) nextArmy();
  });
  renderMapModes();
}

export function refreshAll(overlay = true) {
  clearModCache();
  if (overlay) UIState.map.rebuildOverlay();
  renderTopbar();
  renderPanel();
  renderLegend();
  UIState.map.invalidate();
}

// ---------- Obere Leiste ----------
export function renderTopbar() {
  const s = G.s, f = fac(s.player);
  const inc = f.last || factionIncome(f.id);
  const ruler = chr(f.ruler);
  const cur = f.research.cur ? TECHS[f.research.cur] : null;
  const rp = cur ? Math.min(1, f.research.pts / techCost(cur, f.techs.length)) : 0;
  const netNow = factionIncome(f.id).net;
  $('#topbar').innerHTML = `
    <button class="fac-btn" data-act="faction" title="${esc(t('ui.faction'))}">${swatch(f.color)}<span class="fac-name">${esc(L(f.n))}</span><span class="ruler-name">${ruler ? esc(L(ruler.n)) : ''}</span></button>
    <div class="date" title="${esc(t('ui.turn'))} ${s.turn}"><b>${esc(L(SEASONS[s.season]))}</b> ${s.year}</div>
    <div class="res" title="${esc(t('res.gold'))}: ${esc(t('res.perTurn'))} ${signed(netNow)}">💰 <b>${fmt(f.gold)}</b> <small class="${netNow >= 0 ? 'pos' : 'neg'}">${signed(netNow)}</small></div>
    <div class="res" title="${esc(t('res.horses'))}">🐎 <b>${fmt(f.horses)}</b></div>
    <div class="res" title="${esc(t('res.prestige'))}">⭐ <b>${fmt(f.prestige)}</b></div>
    <div class="res res-tech" title="${esc(t('res.research'))}" data-act="research">📜 ${cur ? `<span class="tech-mini">${esc(L(cur.n))}</span>${bar(rp, '#4a235a', 'mini')}` : `<span class="warn">${esc(t('res.noResearch'))}</span>`}</div>
    <div class="spacer"></div>
    <nav class="menu-btns">
      <button data-act="diplomacy" title="${esc(t('ui.diplomacy'))}">🤝<span>${esc(t('ui.diplomacy'))}</span></button>
      <button data-act="research" title="${esc(t('ui.research'))}">📜<span>${esc(t('ui.research'))}</span></button>
      <button data-act="dynasty" title="${esc(t('ui.dynasty'))}">👑<span>${esc(t('ui.dynasty'))}</span></button>
      <button data-act="chronicle" title="${esc(t('ui.chronicle'))}">📖<span>${esc(t('ui.chronicle'))}</span></button>
      <button data-act="ranking" title="${esc(t('ui.ranking'))}">🏆<span>${esc(t('ui.ranking'))}</span></button>
      <button data-act="capital" title="${esc(t('ui.capital'))}">🏛</button>
      <button data-act="lang" title="Sprache / Dil">${lang() === 'de' ? 'TR' : 'DE'}</button>
      <button data-act="menu" title="${esc(t('ui.menu'))}">☰</button>
    </nav>
    <button class="endturn" data-act="endturn" ${isBusy() ? 'disabled' : ''}>${esc(t('ui.endTurn'))} ⏎</button>`;
  document.documentElement.style.setProperty('--tbh', $('#topbar').offsetHeight + 'px');
}

const MODES = ['political', 'terrain', 'religion', 'culture', 'special', 'diplomacy', 'order', 'trade'];
function renderMapModes() {
  const m = UIState.map.mode;
  $('#mapmodes').innerHTML = MODES.map((k) => `<button data-act="mode" data-mode="${k}" class="${k === m ? 'on' : ''}">${esc(t('mode.' + k))}</button>`).join('');
}

function renderLegend() {
  const m = UIState.map.mode;
  const el = $('#legend');
  let html = '';
  if (m === 'religion') html = Object.entries(RELIGIONS).map(([k, r]) => `<span>${swatch(r.color)}${esc(L(r.n))}</span>`).join('');
  else if (m === 'culture') html = Object.entries(CULTURES).map(([k, c]) => `<span>${swatch(c.color)}${esc(L(c.n))}</span>`).join('');
  else if (m === 'special') html = [['#c9a227', 'spec.eco'], ['#7b4fa0', 'spec.cul'], ['#a8322a', 'spec.mil']].map(([c, k]) => `<span>${swatch(c)}${esc(t(k))}</span>`).join('');
  else if (m === 'terrain') html = Object.entries(TERRAINS).map(([k, c]) => `<span>${swatch(c.color)}${esc(L(c.n))}</span>`).join('');
  else if (m === 'diplomacy') html = [['#c9a227', 'dip.self'], ['#e2c86e', 'dip.vassal'], ['#3c963c', 'dip.ally'], ['#be281e', 'dip.war'], ['#4678b4', 'dip.trade'], ['#969696', 'dip.truce']].map(([c, k]) => `<span>${swatch(c)}${esc(t(k))}</span>`).join('');
  else if (m === 'order') html = `<span>${swatch('#c83c32')}0</span><span>${swatch('#8c8232')}50</span><span>${swatch('#32be32')}100</span>`;
  else if (m === 'trade') html = `<span>${swatch('#a01e1e')}${esc(t('legend.silk'))}</span><span>${swatch('#6e4614')}${esc(t('legend.routes'))}</span>`;
  el.innerHTML = html;
  el.style.display = html ? '' : 'none';
}

// ---------- Tooltip ----------
// Nächstes eigenes Heer mit Bewegungspunkten und ohne Marschbefehl
function nextArmy() {
  const list = factionArmies(G.s.player).filter((a) => a.units.length && a.mp > 0.01 && !(a.path && a.path.length) && a.stance !== 'fortify' && a.stance !== 'intercept');
  if (!list.length) { toast(t('ui.noIdleArmies')); return; }
  const cur = list.findIndex((a) => a.id === UIState.map.sel.army);
  const a = list[(cur + 1) % list.length];
  UIState.map.centerOn(a.prov);
  selectArmy(a.id);
}

function onHover(pid, cx, cy, hoverArmy) {
  const tip = $('#tooltip');
  if (hoverArmy && !modalOpen()) {
    const a = hoverArmy, g = chr(a.gen);
    tip.innerHTML = `<b>⚑ ${esc(armyTitle(a))}</b><br>${swatch(fac(a.fac).color)}${esc(L(facName(a.fac)))}<br><small>${fmt(armyMen(a))} · ${a.units.length} ${esc(t('army.units'))}${g ? ` · ⚔${stat(g, 'mar')}` : ''}${a.stance && a.stance !== 'normal' ? ` · ${STANCE_ICON[a.stance]} ${esc(t('stance.' + a.stance))}` : ''}</small>`;
    tip.style.display = 'block';
    tip.style.left = Math.min(window.innerWidth - tip.offsetWidth - 8, cx + 16) + 'px';
    tip.style.top = Math.min(window.innerHeight - tip.offsetHeight - 8, cy + 16) + 'px';
    return;
  }
  if (!pid || modalOpen()) { tip.style.display = 'none'; return; }
  const p = prov(pid), f = fac(p.owner);
  const armies = armiesIn(pid).filter((a) => a.units.length);
  let extra = '';
  const sel = UIState.map.sel.army && army(UIState.map.sel.army);
  if (sel && sel.fac === G.s.player && sel.prov !== pid) {
    const path = findPath(sel, pid);
    if (path) { const marks = pathTurns(sel, path); extra = `<div class="tip-move">➜ ${esc(t('move.turns', { n: marks[marks.length - 1] }))}</div>`; }
    else extra = `<div class="tip-move neg">${esc(t('move.unreachable'))}</div>`;
  }
  tip.innerHTML = `<b>${esc(L(pdef(pid).n))}</b> <i>${esc(L(pdef(pid).city))}</i><br>${swatch(f?.color || '#777')}${esc(L(f?.n || ''))}<br>
    <small>${esc(L(TERRAINS[pdef(pid).terrain].n))} · ${fmt(p.pop)}k · ${esc(t('prov.order'))} ${Math.round(p.order)}</small>
    ${armies.length ? `<br><small>⚑ ${armies.map((a) => `${esc(L(facName(a.fac)))} ${fmt(armyMen(a))}`).join(', ')}</small>` : ''}${extra}`;
  tip.style.display = 'block';
  const w = tip.offsetWidth, h = tip.offsetHeight;
  tip.style.left = Math.min(window.innerWidth - w - 8, cx + 16) + 'px';
  tip.style.top = Math.min(window.innerHeight - h - 8, cy + 16) + 'px';
}

// ---------- Auswahl & Bewegung ----------
export function clearSelection() {
  const m = UIState.map;
  m.sel = { prov: null, army: null };
  m.preview = null;
  UIState.splitSel.clear();
  renderPanel();
  m.invalidate();
}

export function selectProvince(pid) {
  const m = UIState.map;
  m.sel = { prov: pid, army: null };
  m.preview = null;
  if (UIState.tab !== 'info' && prov(pid).owner !== G.s.player) UIState.tab = 'info';
  renderPanel();
  m.invalidate();
}

export function selectArmy(aid) {
  const m = UIState.map;
  const a = army(aid);
  if (!a) return;
  m.sel = { prov: a.prov, army: aid };
  m.preview = null;
  UIState.splitSel.clear();
  renderPanel();
  m.invalidate();
}

function onMapClick(hit) {
  if (isBusy()) return;
  const m = UIState.map;
  const selA = m.sel.army && army(m.sel.army);
  const own = selA && selA.fac === G.s.player;
  if (hit.army && hit.army.fac === G.s.player) {
    if (own && selA.id !== hit.army.id && hit.army.prov === selA.prov) { selectArmy(hit.army.id); return; }
    if (!own || hit.army.prov === selA.prov || !hit.prov) { selectArmy(hit.army.id); return; }
  }
  if (own && hit.prov && (hit.prov !== selA.prov || m.preview)) {
    const pv = m.preview && m.preview.army === selA.id ? m.preview : null;
    // Ziel bestätigen, Etappe anhängen oder neues Ziel wählen
    if (pv && pv.ok && pv.target === hit.prov) { issueRoute(selA, pv.waypoints); return; }
    if (pv && pv.ok && (hit.shift || UIState.waypointMode)) { previewRoute(selA, [...pv.waypoints, hit.prov]); return; }
    if (hit.prov !== selA.prov) previewRoute(selA, [hit.prov]);
    return;
  }
  if (hit.army) { selectArmy(hit.army.id); return; }
  if (hit.prov) selectProvince(hit.prov);
  else clearSelection();
}

function onMapRightClick(hit) {
  if (isBusy()) return;
  const m = UIState.map;
  const selA = m.sel.army && army(m.sel.army);
  if (!(selA && selA.fac === G.s.player && hit.prov)) return;
  const pv = m.preview && m.preview.army === selA.id && m.preview.ok ? m.preview : null;
  const wps = pv && (hit.shift || UIState.waypointMode) ? [...pv.waypoints, hit.prov] : [hit.prov];
  if (wps[wps.length - 1] !== selA.prov) issueRoute(selA, wps);
}

// Ziehen eines Heeres mit der Maus/dem Finger
function onArmyDrag(a, pid) {
  if (isBusy() || a.fac !== G.s.player) return;
  const m = UIState.map;
  if (m.sel.army !== a.id) { m.sel = { prov: a.prov, army: a.id }; UIState.splitSel.clear(); }
  if (pid && pid !== a.prov && (!m.preview || m.preview.target !== pid)) previewRoute(a, [pid], true);
}
function onArmyDrop(a, pid) {
  if (isBusy() || a.fac !== G.s.player) return;
  if (pid && pid !== a.prov) issueRoute(a, [pid]);
  else { UIState.map.preview = null; selectArmy(a.id); }
}

function previewRoute(a, waypoints, quiet = false) {
  const m = UIState.map;
  const path = findRoute(a, waypoints);
  const target = waypoints[waypoints.length - 1];
  if (!path) {
    m.preview = { army: a.id, from: a.prov, target, waypoints, path: [], ok: false };
    const o = prov(target).owner;
    if (!quiet) {
      if (o !== a.fac && !atWar(a.fac, o)) toast(t('move.noAccess', { fac: L(facName(o)) }));
      else toast(t('move.unreachable'));
    }
  } else {
    m.preview = { army: a.id, from: a.prov, target, waypoints, path, marks: pathTurns(a, path), ok: true };
  }
  renderPanel();
  m.invalidate();
}

export async function issueRoute(a, waypoints) {
  const m = UIState.map;
  const path = findRoute(a, waypoints);
  if (!path) return;
  m.preview = null;
  UIState.waypointMode = false;
  a.path = path;
  a.waypoints = waypoints.slice();
  const res = await advanceArmy(a);
  await flushReports();
  if (G.s.armies[a.id]) { m.sel = { prov: G.s.armies[a.id].prov, army: a.id }; }
  else clearSelection();
  refreshAll();
  return res;
}

export async function issueMove(a, target) { return issueRoute(a, [target]); }

export async function flushReports() {
  const reps = UIState.pendingReports || [];
  UIState.pendingReports = [];
  for (const r of reps) await screens.battleReportDialog(r);
}

// ---------- Rundenende ----------
export async function doEndTurn() {
  if (isBusy() || modalOpen()) return;
  const f = fac(G.s.player);
  if (!f.research.cur && Object.keys(TECHS).some((tid) => !f.techs.includes(tid))) {
    const go = await screens.confirmDialog(t('warn.noResearch'), t('ui.endTurnAnyway'), t('ui.research'));
    if (!go) { screens.researchScreen(); return; }
  }
  UIState.map.preview = null;
  const ov = $('#turnwait');
  ov.style.display = 'flex';
  $('#turnwait-text').textContent = t('ui.othersMove');
  renderTopbar();
  const startLog = G.s.log.length;
  await endTurn((frac, fid) => {
    $('#turnwait-bar').style.width = Math.round(frac * 100) + '%';
  });
  ov.style.display = 'none';
  await flushReports();
  await startOfTurn(startLog);
}

export async function startOfTurn(startLog) {
  const s = G.s;
  refreshAll();
  // Fortsetzen von Marschbefehlen
  for (const a of factionArmies(s.player)) {
    if (a.path && a.path.length && G.s.armies[a.id]) {
      await advanceArmy(a);
      await flushReports();
    }
  }
  refreshAll();
  saveAuto();
  // Bericht
  const entries = s.log.slice(startLog ?? s.log.length).filter((e) => (e.imp || e.f === s.player) && screens.logVisible(e));
  if (entries.length) await screens.turnReport(entries);
  // Anstehende Ereignisse und Angebote
  while (s.pending.length) {
    const item = s.pending.shift();
    await screens.pendingDialog(item);
    refreshAll();
  }
  if (s.gameOver) await screens.gameOverDialog();
  refreshAll();
}

// ---------- Panel ----------
export function renderPanel() {
  const el = $('#panel');
  const m = UIState.map;
  if (m.sel.army && army(m.sel.army)) el.innerHTML = armyPanel(army(m.sel.army));
  else if (m.sel.prov) el.innerHTML = provincePanel(m.sel.prov);
  else { el.innerHTML = ''; el.classList.remove('open'); return; }
  el.classList.add('open');
}

function provincePanel(pid) {
  const s = G.s, p = prov(pid), d = pdef(pid), f = fac(p.owner);
  const mine = p.owner === s.player;
  const tabs = mine ? ['info', 'build', 'recruit'] : ['info'];
  const tab = tabs.includes(UIState.tab) ? UIState.tab : 'info';
  let html = `<div class="panel-head" style="--fc:${f.color}">
    <button class="panel-x" data-act="close">×</button>
    <div class="ptitle">${esc(L(d.n))} <small>${esc(L(d.city))}${f.capital === pid ? ' 👑' : ''}${d.holy ? ' ✦' : ''}</small></div>
    <div class="psub">${swatch(f.color)}<a data-act="dipWith" data-fac="${f.id}">${esc(L(f.n))}</a>${f.overlord ? ` <small>(${esc(t('dip.vassalOf', { fac: L(facName(f.overlord)) }))})</small>` : ''}</div>
  </div>`;
  if (tabs.length > 1) html += `<div class="tabs">${tabs.map((k) => `<button data-act="tab" data-tab="${k}" class="${k === tab ? 'on' : ''}">${esc(t('tab.' + k))}</button>`).join('')}</div>`;
  html += `<div class="panel-body">`;
  if (tab === 'info') html += provinceInfo(pid);
  if (tab === 'build') html += buildTab(pid);
  if (tab === 'recruit') html += recruitTab(pid);
  html += `</div>`;
  return html;
}

function provinceInfo(pid) {
  const s = G.s, p = prov(pid), d = pdef(pid), f = fac(p.owner);
  const ob = orderBreakdown(pid);
  const obTitle = ob.parts.map(([k, v]) => `${t(k)}: ${signed(v)}`).join('\n');
  const inc = provinceIncome(pid);
  const rels = Object.entries(p.rel).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const routes = (ROUTES_BY_PROV[pid] || []).map((rid) => L(TRADE_ROUTES.find((r) => r.id === rid).n));
  const armies = armiesIn(pid).filter((a) => a.units.length);
  let html = `<table class="kv">
    <tr><th>${esc(t('prov.pop'))}</th><td>${fmt(p.pop)}k <small>/ ${fmt(p.basePop * 1.2)}k</small></td></tr>
    <tr><th>${esc(t('prov.order'))}</th><td title="${esc(obTitle)}">${bar(p.order / 100, p.order < 30 ? '#b03a2e' : p.order < 55 ? '#c9a227' : '#3c8c3c')} ${Math.round(p.order)} <small class="muted">(→ ${Math.round(ob.total)}) ⓘ</small></td></tr>
    <tr><th>${esc(t('prov.terrain'))}</th><td>${esc(L(TERRAINS[d.terrain].n))}</td></tr>
    <tr><th>${esc(t('prov.culture'))}</th><td>${swatch(CULTURES[p.culture].color)}${esc(L(CULTURES[p.culture].n))}${p.culture !== f.culture && p.cultProg > 0 ? ` <small>(→ ${esc(L(CULTURES[f.culture].n))} ${Math.round(p.cultProg)}%)</small>` : ''}</td></tr>
    <tr><th>${esc(t('prov.religion'))}</th><td>${rels.map(([r, v]) => `<div class="relrow">${swatch(RELIGIONS[r].color)}${esc(L(RELIGIONS[r].n))} <b>${Math.round(v * 100)}%</b></div>`).join('')}</td></tr>
    <tr><th>${esc(t('prov.goods'))}</th><td>${[...d.goods, ...(p.extraGoods || [])].map((g) => { const pr = goodPrice(p.owner, g); const mono = monopolies(p.owner).includes(g); return `<span class="good" title="${esc(L(GOODS[g].n))}: ${esc(t('mk.price'))} ${Math.round(pr * 100)}%${mono ? ' · ' + esc(t('mk.monopoly')) : ''}">${GOODS[g].icon} ${esc(L(GOODS[g].n))} <small class="${pr >= 1.05 ? 'pos' : pr <= 0.95 ? 'neg' : 'muted'}">${pr >= 1.05 ? '▲' : pr <= 0.95 ? '▼' : '●'}${mono ? '👑' : ''}</small></span>`; }).join(' ')}</td></tr>
    ${routes.length ? `<tr><th>${esc(t('prov.routes'))}</th><td><small>${routes.map(esc).join('<br>')}</small></td></tr>` : ''}
    <tr><th>${esc(t('prov.walls'))}</th><td>${'▮'.repeat(effectiveWalls(pid)) || '—'} <small>${esc(t('prov.garrison'))} ${Math.round(p.garrison * 100)}%</small></td></tr>
    <tr><th>${esc(t('prov.income'))}</th><td><small>${esc(t('inc.tax'))} ${fmt(inc.tax)} · ${esc(t('inc.goods'))} ${fmt(inc.goods)} · ${esc(t('inc.route'))} ${fmt(inc.route)} · ${esc(t('inc.pasture'))} ${fmt(inc.pasture)}<br>🐎 ${fmt(inc.horses)} · 📜 ${fmt(inc.research)}</small></td></tr>
  </table>`;
  // Regionale Besonderheiten
  const specs = specialtiesOf(pid);
  if (specs.length) html = `<div class="specs">${specs.map((sp) => `<div class="spec spec-${sp.cat}" title="${esc(L(sp.desc))}"><span class="spec-ico">${sp.icon}</span><div><b>${esc(L(sp.n))}</b><small>${esc(specEffText(sp))}</small></div></div>`).join('')}</div>` + html;
  if (p.owner === s.player) {
    const cur = p.focus || 'none';
    const locked = p.focusTurn && s.turn - p.focusTurn < 4;
    html += `<h4>${esc(t('focus.title'))}</h4><div class="focusrow">${Object.entries(FOCUS).map(([k, fo]) => `<button data-act="focus" data-v="${k}" class="${cur === k ? 'on' : ''}" title="${esc(L(fo.desc))}" ${locked && cur !== k ? 'disabled' : ''}>${fo.icon} ${esc(L(fo.n))}</button>`).join('')}</div>
      <div class="muted small">${esc(L(FOCUS[cur].desc))}${locked ? ' · ' + esc(t('focus.locked', { n: 4 - (s.turn - p.focusTurn) })) : ''}</div>`;
  }
  if (p.plague) html += `<div class="note neg">☠ ${esc(t('prov.plague', { dis: L(DISEASES.find((x) => x.id === p.plague.dis).n), n: p.plague.left }))}</div>`;
  if (p.famine > 0) html += `<div class="note neg">🌾 ${esc(t('prov.famine', { n: p.famine }))}</div>`;
  if (p.drought > 0) html += `<div class="note neg">🐄 ${esc(t('prov.drought', { n: p.drought }))}</div>`;
  if (p.devast > 0.05) html += `<div class="note neg">${esc(t('prov.devastated', { n: Math.round(p.devast * 100) }))}</div>`;
  if (p.conquered > 0) html += `<div class="note">${esc(t('prov.recentlyConquered', { n: p.conquered }))}</div>`;
  if (p.siege) html += `<div class="note neg">⚔ ${esc(t('prov.besieged', { fac: L(facName(p.siege.fac)), n: p.siege.turns, m: p.siege.needed }))}</div>`;
  if (p.queue) html += `<div class="note">🔨 ${esc(L(buildingName(p.queue.b, p.queue.l, f.religion)))} – ${esc(t('build.turnsLeft', { n: p.queue.turns }))}</div>`;
  const blist = Object.entries(p.buildings).filter(([, l]) => l > 0);
  if (blist.length) html += `<div class="blist">${blist.map(([b, l]) => `<span class="bchip" title="${esc(L(BUILDINGS[b].desc))}">${BUILDINGS[b].icon} ${esc(L(buildingName(b, l, f.religion)))}</span>`).join('')}</div>`;
  if (armies.length) {
    html += `<h4>${esc(t('prov.armies'))}</h4><div class="alist">${armies.map((a) => `<button class="achip" data-act="selArmy" data-id="${a.id}">${swatch(fac(a.fac).color)} ${esc(armyTitle(a))} <b>${fmt(armyMen(a))}</b></button>`).join('')}</div>`;
  }
  if (p.owner !== s.player) {
    html += `<div class="actions"><button data-act="dipWith" data-fac="${p.owner}">🤝 ${esc(t('ui.diplomacy'))}</button></div>`;
  }
  return html;
}

export function specEffText(sp) {
  const e = sp.eff, out = [];
  const pct = (v) => (v > 0 ? '+' : '') + Math.round(v * 100) + '%';
  if (e.tax) out.push(`${t('inc.tax')} ${pct(e.tax)}`);
  if (e.goods) out.push(`${t('inc.goods')} ${pct(e.goods)}`);
  if (e.route) out.push(`${t('inc.route')} ${pct(e.route)}`);
  if (e.flat) out.push(`+${e.flat} 💰`);
  if (e.research) out.push(`+${e.research} 📜`);
  if (e.horses) out.push(`+${e.horses} 🐎`);
  if (e.cap) out.push(`${t('prov.pop')} ${pct(e.cap)}`);
  if (e.order) out.push(`${t('prov.order')} ${e.order > 0 ? '+' : ''}${e.order}`);
  if (e.convert) out.push(e.convert > 1 ? t('spec.convertFast') : t('spec.convertSlow'));
  if (e.prestige) out.push(`⭐ +${e.prestige}`);
  if (e.supply) out.push(t('spec.supply'));
  if (e.walls) out.push(`${t('prov.walls')} +${e.walls}`);
  if (e.garrison) out.push(`${t('prov.garrison')} ${pct(e.garrison)}`);
  if (e.defense) out.push(`${t('spec.defense')} ${pct(e.defense)}`);
  if (e.recruitCost) out.push(`${t('spec.recruitCost')} ${pct(e.recruitCost)}`);
  if (e.xp) out.push(t('spec.veterans'));
  if (e.resource) out.push(`${RESOURCES[e.resource].icon} ${L(RESOURCES[e.resource].n)}`);
  if (e.units) out.push(`⚔ ${e.units.map((u) => L(UNITS[u].n)).join(', ')}`);
  if (e.hostileAttrition) out.push(t('spec.hostileAttrition'));
  if (e.turkify) out.push(t('spec.turkify'));
  return out.join(' · ');
}

function buildTab(pid) {
  const p = prov(pid), f = fac(p.owner);
  let html = '';
  if (p.queue) html += `<div class="note">🔨 ${esc(L(buildingName(p.queue.b, p.queue.l, f.religion)))} ${bar(1 - p.queue.turns / p.queue.total, '#6b5b1f')} ${esc(t('build.turnsLeft', { n: p.queue.turns }))}</div>`;
  html += `<div class="optlist">`;
  for (const o of buildOptions(pid)) {
    const bd = BUILDINGS[o.id];
    const name = o.cur >= 3 ? buildingName(o.id, 3, f.religion) : buildingName(o.id, o.level, f.religion);
    let reason = '';
    if (o.reason === 'b.tech') reason = t('b.tech', { tech: L(TECHS[o.tech].n) });
    else if (o.reason) reason = t(o.reason);
    html += `<div class="opt ${o.ok ? '' : 'dis'}">
      <div class="opt-main"><span class="ico">${bd.icon}</span><div><b>${esc(L(name))}</b> ${o.cur ? `<small>(${esc(t('build.level'))} ${o.cur}${o.cur < 3 ? '→' + o.level : ''})</small>` : ''}<br><small class="muted">${esc(L(bd.desc))}</small></div></div>
      <div class="opt-side">${o.cur < 3 ? `<small>💰${o.cost} · ⏳${o.turns}</small>` : ''}
      ${o.ok ? `<button data-act="build" data-b="${o.id}">${esc(t('build.do'))}</button>` : reason ? `<small class="neg">${esc(reason)}</small>` : ''}</div>
    </div>`;
  }
  html += `</div>`;
  return html;
}

function unitStats(u) {
  return `<small class="stats" title="${esc(t('unit.statsTitle'))}">⚔${u.att} 🛡${u.def} 🏹${u.rng} ↯${u.cha} ♥${u.mor}</small>`;
}

function recruitTab(pid) {
  const s = G.s, p = prov(pid);
  let html = `<div class="note">${esc(t('rec.limit', { n: p.recruited, m: recruitLimit(pid) }))}</div><div class="optlist">`;
  for (const o of recruitOptions(s.player, pid)) {
    const u = UNITS[o.id];
    let reason = '';
    if (o.reason === 'r.building') reason = t('r.building', { b: L(buildingName(o.need.b, o.need.l, fac(s.player).religion)) });
    else if (o.reason === 'r.tech') reason = t('r.tech', { tech: L(TECHS[o.tech].n) });
    else if (o.reason) reason = t(o.reason);
    html += `<div class="opt ${o.ok ? '' : 'dis'}" title="${esc(L(u.desc))}">
      <div class="opt-main"><span class="ico">${CLASS_ICON[u.cls]}</span><div><b>${esc(L(u.n))}</b>${o.local ? ` <span class="tag local">${esc(t('rec.local'))}</span>` : ''} <small class="muted">${esc(L(UNIT_CLASSES[u.cls].n))} · ${u.size}</small><br>${unitStats(u)}${o.xp ? ` <span class="xp">${'★'.repeat(o.xp)}</span>` : ''}${o.missing?.length ? `<br><small class="neg">${esc(t('rec.import', { res: o.missing.map((r) => L(RESOURCES[r].n)).join(', ') }))}</small>` : ''}</div></div>
      <div class="opt-side"><small>💰${o.cost}${o.cost !== u.cost ? ` <s class="muted">${u.cost}</s>` : ''}${u.horses ? ' 🐎' + u.horses : ''} · ${esc(t('rec.upkeep'))} ${u.upkeep}</small>
      ${o.ok ? `<button data-act="recruit" data-u="${o.id}">${esc(t('rec.do'))}</button>` : `<small class="neg">${esc(reason)}</small>`}</div>
    </div>`;
  }
  html += `</div>`;
  return html;
}

export function armyTitle(a) {
  const g = chr(a.gen);
  return g ? t('army.of', { name: L(g.n) }) : t('army.noGeneral');
}

function armyPanel(a) {
  const s = G.s, f = fac(a.fac);
  const mine = a.fac === s.player;
  const g = chr(a.gen);
  const p = prov(a.prov);
  const m = UIState.map;
  const speed = armySpeed(a);
  let html = `<div class="panel-head" style="--fc:${f.color}">
    <button class="panel-x" data-act="close">×</button>
    <div class="ptitle">⚑ ${esc(armyTitle(a))}</div>
    <div class="psub">${swatch(f.color)}${esc(L(f.n))} · <a data-act="selProv" data-p="${a.prov}">${esc(L(pdef(a.prov).n))}</a></div>
  </div><div class="panel-body">`;
  html += `<table class="kv">
    <tr><th>${esc(t('army.men'))}</th><td><b>${fmt(armyMen(a))}</b> · ${esc(t('army.units'))} ${a.units.length}/20</td></tr>
    <tr><th>${esc(t('army.move'))}</th><td>${bar(a.mp / speed, '#2e7d32')} ${Math.max(0, a.mp).toFixed(1)}/${speed.toFixed(1)}</td></tr>
    <tr><th>${esc(t('army.power'))}</th><td>${fmt(armyPower(a) / 100)}</td></tr>
  </table>`;
  // Feldherr
  html += `<h4>${esc(t('army.general'))}</h4>`;
  if (g) html += `<div class="charline">${charBadge(g)}</div>`;
  else html += `<div class="muted">${esc(t('army.noGeneral'))}</div>`;
  if (mine) {
    const free = generals(s.player).filter((c) => c.id !== a.gen && age(c) >= 16 && c.id !== fac(s.player).vizier);
    if (free.length) {
      html += `<select data-change="assignGen"><option value="">${esc(t('army.assign'))}</option>${free.map((c) => `<option value="${c.id}">${esc(L(c.n))} (⚔${stat(c, 'mar')}${c.army ? ' · ' + esc(t('army.busy')) : ''})</option>`).join('')}</select>`;
    }
  }
  // Haltung
  if (mine) {
    const st = a.stance || 'normal';
    html += `<h4>${esc(t('stance.title'))}</h4><div class="stancerow">${STANCES.map((k) => `<button data-act="stance" data-v="${k}" class="${st === k ? 'on' : ''}" title="${esc(t('stance.' + k + '.desc'))}">${STANCE_ICON[k]} ${esc(t('stance.' + k))}</button>`).join('')}</div>
      <div class="muted small">${esc(t('stance.' + st + '.desc'))}</div>`;
  } else if (a.stance && a.stance !== 'normal') {
    html += `<div class="note">${STANCE_ICON[a.stance]} ${esc(t('stance.' + a.stance))}</div>`;
  }
  // Marschvorschau
  if (mine && m.preview && m.preview.army === a.id) {
    const pv = m.preview;
    if (pv.ok) {
      const n = pv.marks[pv.marks.length - 1];
      const tp = prov(pv.target);
      const hostile = tp.owner !== a.fac && atWar(a.fac, tp.owner);
      const foes = armiesIn(pv.target).filter((x) => atWar(a.fac, x.fac) && x.units.length);
      const hostileOnWay = pv.path.filter((pid) => prov(pid).owner !== a.fac && atWar(a.fac, prov(pid).owner)).length;
      html += `<div class="movebox"><div>➜ ${pv.waypoints.map((w, i) => `<b>${esc(L(pdef(w).n))}</b>`).join(' → ')} – ${esc(t('move.turns', { n }))}</div>
        ${foes.length ? `<div class="neg">⚔ ${esc(t('move.battle', { n: fmt(foes.reduce((x, y) => x + armyMen(y), 0)) }))}</div>` : hostile ? `<div class="neg">${esc(t('move.hostile'))}</div>` : ''}
        ${hostileOnWay > 1 ? `<div class="neg small">${esc(t('move.deepStrike', { n: hostileOnWay }))}</div>` : ''}
        <button class="primary" data-act="march">${esc(t('move.go'))}</button> <button data-act="cancelPreview">${esc(t('ui.cancel'))}</button>
        <button data-act="wpMode" class="${UIState.waypointMode ? 'on' : ''}">➕ ${esc(t('move.addStage'))}</button>
        <div class="muted small">${esc(t(UIState.waypointMode ? 'move.stageHint' : 'move.hint'))}</div></div>`;
    }
  } else if (mine && a.path && a.path.length) {
    const wps = (a.waypoints || []).filter((w) => a.path.includes(w));
    html += `<div class="movebox">➜ ${(wps.length ? wps : [a.path[a.path.length - 1]]).map((w) => esc(L(pdef(w).n))).join(' → ')} <small class="muted">(${esc(t('move.turns', { n: pathTurns(a, a.path).slice(-1)[0] }))})</small> <button data-act="stopMove">${esc(t('move.stop'))}</button></div>`;
  } else if (mine) {
    html += `<div class="muted small hint">${esc(t('move.selectHint'))}</div>`;
  }
  // Aktionen
  if (mine) {
    const acts = [];
    const hostile = p.owner !== a.fac && atWar(a.fac, p.owner);
    if (hostile) {
      const gp = garrisonPower(a.prov);
      acts.push(`<button data-act="assault" ${a.mp <= 0 ? 'disabled' : ''} title="${esc(t('act.assaultTitle'))}">🏰 ${esc(t('act.assault'))} <small>(${esc(t('act.odds'))}: ${oddsText(armyPower(a), gp)})</small></button>`);
      acts.push(`<button data-act="raid" class="${a.raid ? 'on' : ''}" title="${esc(t('act.raidTitle'))}">🔥 ${esc(a.raid ? t('act.raidStop') : t('act.raid'))}</button>`);
      if (p.siege && p.siege.fac === a.fac) html += `<div class="note">⚔ ${esc(t('prov.siegeProgress', { n: p.siege.turns, m: p.siege.needed }))}</div>`;
      else if (!a.raid) html += `<div class="note">${esc(t('prov.siegeWillStart', { m: siegeNeeded(a.prov) }))}</div>`;
    }
    const others = armiesIn(a.prov).filter((x) => x.fac === a.fac && x.id !== a.id);
    for (const o of others) acts.push(`<button data-act="merge" data-id="${o.id}">⇆ ${esc(t('act.merge', { name: armyTitle(o) }))}</button>`);
    if (acts.length) html += `<div class="actions">${acts.join('')}</div>`;
  }
  // Einheiten
  html += `<h4>${esc(t('army.unitsList'))}</h4><div class="units">`;
  a.units.forEach((u, i) => {
    const d = UNITS[u.t];
    html += `<label class="unit ${mine ? '' : 'ro'}" title="${esc(L(d.desc))}">
      ${mine ? `<input type="checkbox" data-change="splitSel" data-i="${i}" ${UIState.splitSel.has(i) ? 'checked' : ''}>` : ''}
      <span class="ico">${CLASS_ICON[d.cls]}</span>
      <span class="uname">${esc(L(d.n))}${u.xp ? ` <span class="xp">${'★'.repeat(u.xp)}</span>` : ''}</span>
      <span class="umen">${Math.round(d.size * u.hp)}</span>
      ${bar(u.hp, u.hp < 0.4 ? '#b03a2e' : '#3c8c3c', 'mini')}
    </label>`;
  });
  html += `</div>`;
  if (mine && a.units.length > 1) {
    html += `<div class="actions small"><button data-act="split" ${UIState.splitSel.size ? '' : 'disabled'}>✂ ${esc(t('act.split'))}</button><button data-act="disband" ${UIState.splitSel.size ? '' : 'disabled'}>✖ ${esc(t('act.disband'))}</button></div>`;
  }
  html += `</div>`;
  return html;
}

function oddsText(my, their) {
  const r = my / (their + 1);
  if (r > 2.5) return t('odds.great');
  if (r > 1.6) return t('odds.good');
  if (r > 1.1) return t('odds.even');
  if (r > 0.7) return t('odds.poor');
  return t('odds.hopeless');
}

export function charBadge(c, extra = '') {
  const traits = c.traits.map((tr) => `<span class="trait ${TRAITS[tr]?.good ? 'good' : 'bad'}">${esc(L(TRAITS[tr].n))}</span>`).join('');
  return `<div class="char"><b>${esc(L(c.n))}</b> <small>${esc(t('char.age', { n: age(c) }))}</small>
    <span class="cstats">⚔${stat(c, 'mar')} 📜${stat(c, 'adm')} 🤝${stat(c, 'dip')}</span>${traits}${extra}</div>`;
}

const panelHandlers = {
  close: () => clearSelection(),
  tab: (el) => { UIState.tab = el.dataset.tab; renderPanel(); },
  focus: (el) => { if (setFocus(UIState.map.sel.prov, el.dataset.v)) { clearModCache(); refreshAll(false); } },
  dipWith: (el) => screens.diplomacyScreen(el.dataset.fac),
  selArmy: (el) => selectArmy(el.dataset.id),
  selProv: (el) => { UIState.map.centerOn(el.dataset.p); selectProvince(el.dataset.p); },
  build: (el) => {
    const pid = UIState.map.sel.prov;
    if (startBuilding(pid, el.dataset.b)) { toast(t('build.started')); refreshAll(false); }
  },
  recruit: (el) => {
    const pid = UIState.map.sel.prov;
    const a = recruit(G.s.player, pid, el.dataset.u);
    if (a) { toast(t('rec.done', { u: L(UNITS[el.dataset.u].n) })); refreshAll(false); }
  },
  march: () => { const pv = UIState.map.preview; const a = army(pv?.army); if (a) issueRoute(a, pv.waypoints); },
  wpMode: () => { UIState.waypointMode = !UIState.waypointMode; renderPanel(); },
  stance: (el) => { const a = army(UIState.map.sel.army); if (a) { setStance(a, el.dataset.v); renderPanel(); UIState.map.invalidate(); } },
  cancelPreview: () => { UIState.map.preview = null; renderPanel(); UIState.map.invalidate(); },
  stopMove: () => { const a = army(UIState.map.sel.army); if (a) a.path = []; renderPanel(); UIState.map.invalidate(); },
  assault: async () => {
    const a = army(UIState.map.sel.army);
    if (!a) return;
    await assault(a);
    await flushReports();
    if (G.s.armies[a.id]) selectArmy(a.id); else clearSelection();
    refreshAll();
  },
  raid: () => { const a = army(UIState.map.sel.army); if (a) { a.raid = !a.raid; if (a.raid) { const p = prov(a.prov); if (p.siege && p.siege.fac === a.fac) p.siege = null; } renderPanel(); UIState.map.invalidate(); } },
  merge: (el) => { const a = army(UIState.map.sel.army), b = army(el.dataset.id); if (a && b) { mergeArmies(a, b); UIState.splitSel.clear(); refreshAll(false); } },
  split: () => {
    const a = army(UIState.map.sel.army);
    if (!a) return;
    const na = splitArmy(a, [...UIState.splitSel]);
    UIState.splitSel.clear();
    if (na) selectArmy(na.id);
    refreshAll(false);
  },
  disband: async () => {
    const a = army(UIState.map.sel.army);
    if (!a) return;
    if (!(await screens.confirmDialog(t('act.disbandConfirm', { n: UIState.splitSel.size }), t('act.disband'), t('ui.cancel')))) return;
    const idx = [...UIState.splitSel].sort((x, y) => y - x);
    for (const i of idx) a.units.splice(i, 1);
    UIState.splitSel.clear();
    if (!a.units.length) { if (a.gen && chr(a.gen)) chr(a.gen).army = null; delete G.s.armies[a.id]; clearSelection(); }
    refreshAll(false);
  },
};

// Änderungen an Formularelementen im Panel
document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-change]');
  if (!el || !$('#panel').contains(el)) return;
  const a = army(UIState.map.sel.army);
  if (el.dataset.change === 'assignGen' && a && el.value) { assignGeneral(a, el.value); refreshAll(false); }
  if (el.dataset.change === 'splitSel') {
    const i = +el.dataset.i;
    if (el.checked) UIState.splitSel.add(i); else UIState.splitSel.delete(i);
    renderPanel();
  }
});

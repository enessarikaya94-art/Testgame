// Dialoge und Bildschirme: Schlacht, Ereignisse, Fraktion, Diplomatie, Forschung, Dynastie, Chronik, Rangliste, Menü.

import { G, fac, prov, pdef, chr, factionProvinces, factionArmies, atWar, relPeek, rel, opinion, facName, provName, aliveFactions, neighbors, END_YEAR, log } from '../game/state.js';
import { factionIncome, getMods, clearModCache, techAvailable } from '../game/economy.js';
import { TACTICS } from '../game/battle.js';
import { goalStatus, ranking, score, refreshCaches } from '../game/turn.js';
import { declareWar, makePeace, peaceAcceptance, proposalAcceptance, setTrade, setAlliance, breakAlliance, setNap, makeVassal, releaseVassal, giftGold, marriage, demandTribute, tributeAmount, setAccess, militaryPower, neighborsOf, warScore, truceLeft, titleClaimable, claimTitle, acceptCallToArms, vassalsOf } from '../game/diplomacy.js';
import { stat, age, loyalty, dynastyMembers, generals, hireGeneral, hireGeneralCost, appointVizier, updateHeir } from '../game/characters.js';
import { EVENTS, GLOBAL_EVENTS, applyEventChoice, changeReligion } from '../game/events.js';
import { TECHS, TECH_BRANCHES, techCost } from '../data/techs.js';
import { TERRAINS, RELIGIONS, CULTURES, GOVERNMENTS, SUCCESSION_LAWS, SEASONS } from '../data/world.js';
import { FACTIONS, TITLES } from '../data/factions.js';
import { UNITS, UNIT_CLASSES } from '../data/units.js';
import { TRAITS } from '../data/people.js';
import { t, L, lang, setLang } from '../i18n.js';
import { $, openModal, toast, bar, swatch } from './dom.js';
import { esc, fmt, signed, clamp } from '../util.js';
import { refreshAll, charBadge, CLASS_ICON, UIState, selectProvince } from './game-ui.js';
import { formatLog, dateText } from './format.js';
import { RESOURCES, resourceAccess, paymentBetween, setPayment, takeLoan, LOAN, monopolies } from '../game/market.js';
import { GOODS } from '../data/world.js';
import { opinionParts } from '../game/state.js';
import { SLOTS, saveSlot, slotMeta, exportSave, importSave, loadSlotData } from './saves.js';
import { knowsFaction, knows, knownRegions, regionOf } from '../game/discovery.js';
import { REGIONS, REGION_IDS } from '../data/regions.js';
import { townsOf, townName, foreignHeld } from '../game/towns.js';
import { tradeTown } from '../game/diplomacy.js';

// ---------- Allgemein ----------
export function confirmDialog(text, yes, no) {
  return openModal(`<p class="big">${esc(text)}</p><div class="actions center"><button class="primary" data-act="yes">${esc(yes)}</button><button data-act="no">${esc(no)}</button></div>`, {
    cancelValue: false,
    handlers: (close) => ({ yes: () => close(true), no: () => close(false) }),
  });
}

export function toggleLang() {
  setLang(lang() === 'de' ? 'tr' : 'de');
  refreshAll();
}

function compBars(c) {
  return `<div class="comp">
    <div>${esc(t('bt.cav'))} ${bar(c.cav, '#8b5a2b', 'mini')}</div>
    <div>${esc(t('bt.ranged'))} ${bar(c.ranged, '#2e6b8f', 'mini')}</div>
    <div>${esc(t('bt.inf'))} ${bar(c.inf, '#5d6d7e', 'mini')}</div>
  </div>`;
}

function unitSummary(units) {
  const counts = {};
  for (const u of units) { const k = u.t; counts[k] = (counts[k] || 0) + 1; }
  return Object.entries(counts).map(([k, n]) => `<span class="uchip" title="${esc(L(UNITS[k].n))}">${CLASS_ICON[UNITS[k].cls]}×${n}</span>`).join('');
}

// ---------- Schlacht ----------
export function tacticDialog(info, side) {
  const me = info[side], foe = info[side === 'att' ? 'def' : 'att'];
  const mf = fac(me.fac), ff = fac(foe.fac);
  const gMe = chr(me.gen), gFoe = chr(foe.gen);
  const ratio = me.men / Math.max(1, foe.men);
  const html = `<h2>⚔ ${esc(info.assault ? t('bt.assaultTitle', { city: L(pdef(info.prov).city) }) : t('bt.title', { prov: L(pdef(info.prov).n) }))}</h2>
  <div class="muted center">${esc(t('bt.terrain'))}: <b>${esc(L(TERRAINS[info.terrain].n))}</b>${info.assault ? ` · ${esc(t('prov.walls'))}: ${'▮'.repeat(info.walls)}` : ''} · ${esc(L(SEASONS[G.s.season]))}</div>
  <div class="versus">
    <div class="side">${swatch(mf.color)}<b>${esc(L(mf.n))}</b><div>${gMe ? esc(L(gMe.n)) + ' ⚔' + stat(gMe, 'mar') : esc(t('army.noGeneral'))}</div><div class="men">${fmt(me.men)}</div>${compBars(me.comp)}<div>${unitSummary(me.units)}</div></div>
    <div class="vs">VS<div class="small muted">${ratio > 1.3 ? esc(t('bt.outnumber')) : ratio < 0.77 ? esc(t('bt.outnumbered')) : esc(t('bt.evenNumbers'))}</div></div>
    <div class="side">${swatch(ff.color)}<b>${esc(L(ff.n))}</b><div>${gFoe ? esc(L(gFoe.n)) + ' ⚔' + stat(gFoe, 'mar') : esc(t('army.noGeneral'))}</div><div class="men">${fmt(foe.men)}</div>${compBars(foe.comp)}<div>${unitSummary(foe.units)}</div></div>
  </div>
  <h3>${esc(t('bt.choose'))}</h3>
  <div class="tactics">${me.options.map((k) => `<button class="tactic" data-act="pick" data-t="${k}"><span class="ticon">${TACTICS[k].icon}</span><b>${esc(L(TACTICS[k].n))}</b><small>${esc(L(TACTICS[k].desc))}</small></button>`).join('')}
    <button class="tactic auto" data-act="pick" data-t=""><span class="ticon">⚙</span><b>${esc(t('bt.auto'))}</b><small>${esc(t('bt.autoDesc'))}</small></button></div>`;
  return openModal(html, { wide: true, closable: false, handlers: (close) => ({ pick: (el) => close(el.dataset.t || null) }) });
}

export function battleReportDialog(rep) {
  const player = G.s.player;
  const mySide = rep.att.fac === player ? 'att' : 'def';
  const won = rep.winner === mySide;
  const af = fac(rep.att.fac), df = fac(rep.def.fac);
  const html = `<h2 class="${won ? 'pos' : 'neg'}">${won ? '🏆 ' + esc(t('bt.victory')) : '☠ ' + esc(t('bt.defeat'))}</h2>
  <div class="muted center">${esc(L(pdef(rep.prov).n))}${rep.assault ? ' · ' + esc(t('log.assault')) : ''}</div>
  <div class="versus">
    <div class="side">${swatch(af.color)}<b>${esc(L(af.n))}</b><div>${esc(L(TACTICS[rep.tA]?.n || ''))}</div><div class="men">${fmt(rep.att.men)}</div><div class="neg">−${fmt(rep.attLost || 0)}</div></div>
    <div class="vs">⚔</div>
    <div class="side">${swatch(df.color)}<b>${esc(L(df.n))}</b><div>${esc(L(TACTICS[rep.tD]?.n || ''))}</div><div class="men">${fmt(rep.def.men)}</div><div class="neg">−${fmt(rep.defLost || 0)}</div></div>
  </div>
  <div class="chronicle-text">${rep.lines.map((l) => `<p>${esc(t(l.k, l.p))}</p>`).join('')}</div>
  <div class="actions center"><button class="primary" data-act="ok">${esc(t('ui.ok'))}</button></div>`;
  return openModal(html, { wide: true, handlers: (close) => ({ ok: () => close(true) }) });
}

export function captureDialog(ctx) {
  const pid = ctx.prov;
  const html = `<h2>🏰 ${esc(t('cap.title', { city: L(pdef(pid).city) }))}</h2>
  <p>${esc(t('cap.text', { prov: L(pdef(pid).n) }))}</p>
  <div class="choices">
    <button data-act="c" data-v="occupy"><b>${esc(t('cap.occupy'))}</b><small>${esc(t('cap.occupyDesc'))}</small></button>
    <button data-act="c" data-v="sack"><b>${esc(t('cap.sack'))}</b><small>${esc(t('cap.sackDesc'))}</small></button>
    <button data-act="c" data-v="raze"><b>${esc(t('cap.raze'))}</b><small>${esc(t('cap.razeDesc'))}</small></button>
  </div>`;
  return openModal(html, { closable: false, handlers: (close) => ({ c: (el) => close(el.dataset.v) }) });
}

// ---------- Rundenbericht & Ereignisse ----------
export function turnReport(entries) {
  const s = G.s;
  const html = `<h2>📜 ${esc(t('rep.title', { date: `${L(SEASONS[s.season])} ${s.year}` }))}</h2>
  <div class="report">${entries.map((e) => `<p class="${e.imp ? 'imp' : ''}">${esc(formatLog(e))}</p>`).join('')}</div>
  <div class="actions center"><button class="primary" data-act="ok">${esc(t('ui.ok'))}</button></div>`;
  return openModal(html, { handlers: (close) => ({ ok: () => close(true) }) });
}

export async function pendingDialog(item) {
  const s = G.s;
  if (item.type === 'event' || item.type === 'global') {
    const ev = item.type === 'event' ? EVENTS[item.id] : GLOBAL_EVENTS[item.id];
    if (!ev) return;
    const params = ev.params ? ev.params(item.ctx || {}) : {};
    const fid = item.fid || s.player;
    const text = fill(L(ev.text), params);
    const html = `<div class="event"><h2>${esc(L(ev.title))}</h2><p class="evtext">${esc(text)}</p>
      <div class="choices">${ev.options.map((o, i) => {
        const ok = !o.ok || o.ok(fid, item.ctx || {});
        return `<button data-act="o" data-i="${i}" ${ok ? '' : 'disabled'}><b>${esc(L(o.t))}</b>${o.desc ? `<small>${esc(L(o.desc))}</small>` : ''}</button>`;
      }).join('')}</div></div>`;
    const idx = await openModal(html, { closable: false, handlers: (close) => ({ o: (el) => close(+el.dataset.i) }) });
    if (item.type === 'event') applyEventChoice({ ...item, fid }, idx);
    else ev.options[idx].fx(fid, item.ctx || {});
    clearModCache();
    return;
  }
  if (item.type === 'discovery') {
    const reg = REGIONS[item.region];
    if (!reg) return;
    const causeText = t('disc.' + (item.cause || 'event'), { via: item.via ? facName(item.via) : '' });
    const powers = aliveFactions().filter((f) => f.id !== 'rebels' && f.capital && regionOf(f.capital) === item.region)
      .sort((a, b) => factionProvinces(b.id).length - factionProvinces(a.id).length);
    const shown = powers.slice(0, 10);
    const html = `<div class="event discovery"><h2>🧭 ${esc(t('disc.title'))}: ${esc(L(reg.n))}</h2>
      <p class="evtext">${esc(t('disc.text', { region: reg.n, causeText }))}</p>
      <p class="muted">${esc(L(reg.desc))}</p>
      ${shown.length ? `<h3>${esc(t('disc.new'))}</h3><div class="disc-powers">${shown.map((f) => `<span class="dp">${swatch(f.color)}${esc(L(f.n))} <small>${factionProvinces(f.id).length}</small></span>`).join('')}${powers.length > shown.length ? `<span class="dp muted">+${powers.length - shown.length}</span>` : ''}</div>` : ''}
      <div class="actions center"><button data-act="show">🗺 ${esc(t('disc.show'))}</button><button class="primary" data-act="ok">${esc(t('ui.ok'))}</button></div></div>`;
    const v = await openModal(html, { closable: false, handlers: (close) => ({ ok: () => close('ok'), show: () => close('show') }) });
    refreshAll();
    if (v === 'show' && shown[0] && UIState.map) UIState.map.centerOn(shown[0].capital, 0.45);
    return;
  }
  if (item.type === 'callToArms') {
    const ok = await confirmDialog(t('cta.text', { ally: L(facName(item.from)), enemy: L(facName(item.enemy)) }), t('cta.join'), t('cta.refuse'));
    acceptCallToArms(s.player, item.from, item.enemy, ok);
    return;
  }
  if (item.type === 'proposal') {
    const from = item.from;
    if (!fac(from)?.alive) return;
    let text = '';
    if (item.kind === 'peace') {
      if (!atWar(from, s.player)) return;
      text = t('prop.peace', { fac: L(facName(from)) });
      if (item.terms?.gold) text += ' ' + (item.terms.goldFrom === from ? t('prop.theyPay', { n: item.terms.gold }) : t('prop.wePay', { n: item.terms.gold }));
    } else if (item.kind === 'trade') text = t('prop.trade', { fac: L(facName(from)) });
    else if (item.kind === 'alliance') text = t('prop.alliance', { fac: L(facName(from)) });
    else if (item.kind === 'sultan') text = t('prop.sultan', { fac: L(facName(from)) });
    else if (item.kind === 'tribute') text = t('prop.tribute', { fac: L(facName(from)), n: item.amount });
    else if (item.kind === 'buyTown') {
      const tw = townsOf(item.pid)[item.i];
      if (!tw || tw.owner !== s.player || atWar(from, s.player) || fac(from).gold < item.price) return;
      text = t('prop.buyTown', { fac: L(facName(from)), n: item.price, town: L(townName(item.pid, item.i)), prov: L(provName(item.pid)) });
    }
    const ok = await confirmDialog(text, t('prop.accept'), t('prop.decline'));
    if (item.kind === 'peace') { if (ok) makePeace(from, s.player, item.terms || {}); }
    else if (item.kind === 'trade') { if (ok) setTrade(from, s.player, true); else rel(from, s.player).mod -= 5; }
    else if (item.kind === 'alliance') { if (ok) setAlliance(from, s.player); else rel(from, s.player).mod -= 5; }
    else if (item.kind === 'buyTown') { if (ok) tradeTown(item.pid, item.i, s.player, from, item.price); else rel(from, s.player).mod -= 6; }
    else if (item.kind === 'tribute') {
      if (ok) { rel(from, s.player).tributeTurn = 0; demandTribute(from, s.player); }
      else { rel(from, s.player).mod -= 20; if (Math.random() < fac(from).ai.aggr * 0.6) declareWar(from, s.player); }
    }
    else if (item.kind === 'sultan') {
      if (ok) { fac(from).titles.push('sultan'); rel(from, s.player).mod += 30; fac(s.player).gold += 150; fac(s.player).prestige += 10; log('log.title', { fac: fac(from).n, title: TITLES.sultan.n }, { f: from, imp: true }); }
      else rel(from, s.player).mod -= 30;
    }
    refreshCaches();
  }
}

function fill(str, params) {
  return str.replace(/\{(\w+)\}/g, (_, k) => (params[k] !== undefined ? L(params[k]) : ''));
}

export async function gameOverDialog() {
  const s = G.s;
  const go = s.gameOver;
  let html = '';
  if (go.type === 'victory') {
    html = `<h2 class="pos">🏆 ${esc(t('go.victory'))}</h2><p>${esc(t('go.victoryText'))}</p><div class="actions center"><button class="primary" data-act="cont">${esc(t('go.continue'))}</button><button data-act="menu">${esc(t('go.menu'))}</button></div>`;
  } else if (go.type === 'defeat') {
    html = `<h2 class="neg">☠ ${esc(t('go.defeat'))}</h2><p>${esc(t('go.defeatText'))}</p><div class="actions center"><button class="primary" data-act="menu">${esc(t('go.menu'))}</button></div>`;
  } else {
    html = `<h2>📜 ${esc(t('go.end', { year: END_YEAR }))}</h2><p>${esc(t('go.endText', { rank: go.rank }))}</p>${rankingTable()}<div class="actions center"><button data-act="cont">${esc(t('go.continue'))}</button><button class="primary" data-act="menu">${esc(t('go.menu'))}</button></div>`;
  }
  const r = await openModal(html, { closable: false, wide: go.type === 'end', handlers: (close) => ({ cont: () => close('cont'), menu: () => close('menu') }) });
  if (r === 'cont') s.gameOver = null;
  else if (UIState.onExit) UIState.onExit();
}

// ---------- Fraktion ----------
export function factionScreen() {
  const render = () => {
    const s = G.s, f = fac(s.player);
    const inc = factionIncome(f.id);
    const ruler = chr(f.ruler), heir = chr(f.heir), viz = chr(f.vizier);
    const goals = goalStatus(f.id);
    const gov = GOVERNMENTS[f.gov];
    const decisions = [];
    // Regierungsform
    if (f.gov === 'nomad') decisions.push(dec('gov:sultanate', t('dec.toSultanate'), t('dec.toSultanateDesc'), f.techs.includes('diwan') && f.prestige >= 40, !f.techs.includes('diwan') ? t('dec.needTech', { tech: L(TECHS.diwan.n) }) : t('dec.needPrestige', { n: 40 })));
    if (f.gov === 'sultanate') {
      decisions.push(dec('gov:sedentary', t('dec.toSedentary'), t('dec.toSedentaryDesc'), f.techs.includes('cadastre') && f.prestige >= 40, !f.techs.includes('cadastre') ? t('dec.needTech', { tech: L(TECHS.cadastre.n) }) : t('dec.needPrestige', { n: 40 })));
      if (CULTURES[f.culture].group === 'steppe') decisions.push(dec('gov:nomad', t('dec.toNomad'), t('dec.toNomadDesc'), f.prestige >= 40, t('dec.needPrestige', { n: 40 })));
    }
    // Titel
    for (const tid of Object.keys(TITLES)) {
      if (tid === 'caliph' || f.titles.includes(tid)) continue;
      const c = titleClaimable(f.id, tid);
      if (c.reason === 't.turkic' || c.reason === 't.persian' || c.reason === 't.orthodox' || c.reason === 't.catholic' || c.reason === 't.sinic' || c.reason === 't.sunni' || c.reason === 't.isCaliph') continue;
      let why = '';
      if (!c.ok) why = c.reason === 't.needs' ? t('t.needs', { list: c.missing.map((p) => L(provName(p))).join(', ') }) : t(c.reason, { n: c.need });
      decisions.push(dec('title:' + tid, t('dec.title', { title: L(TITLES[tid].n) }), L(TITLES[tid].desc), c.ok, why));
    }
    // Heiliger Krieg
    const grp = RELIGIONS[f.religion].group;
    if (['islam', 'christian'].includes(grp)) {
      const name = grp === 'islam' ? t('dec.ghaza') : t('dec.crusade');
      decisions.push(dec('holy', name, t('dec.holyDesc'), f.holyWar <= 0 && f.prestige >= 40, f.holyWar > 0 ? t('dec.holyActive', { n: f.holyWar }) : t('dec.needPrestige', { n: 40 })));
    }
    // Religionswechsel
    const cap = f.capital && prov(f.capital);
    if (cap) {
      for (const [r, share] of Object.entries(cap.rel)) {
        if (r === f.religion || share < 0.25) continue;
        decisions.push(dec('rel:' + r, t('dec.convert', { rel: L(RELIGIONS[r].n) }), t('dec.convertDesc'), f.prestige >= 60, t('dec.needPrestige', { n: 60 })));
      }
    }
    // Nachfolge
    for (const law of Object.keys(SUCCESSION_LAWS)) {
      if (law === f.succession) continue;
      const need = law === 'elective' ? 'kurultai' : law === 'primogeniture' ? 'atabeg' : null;
      const okTech = !need || f.techs.includes(need) || (law === 'primogeniture' && f.gov === 'sedentary');
      decisions.push(dec('law:' + law, t('dec.law', { law: L(SUCCESSION_LAWS[law].n) }), L(SUCCESSION_LAWS[law].desc), okTech && f.prestige >= 50, !okTech ? t('dec.needTech', { tech: L(TECHS[need].n) }) : t('dec.needPrestige', { n: 50 })));
    }
    decisions.push(dec('vizier', t('dec.vizier'), t('dec.vizierDesc'), f.gold >= 120 && f.gov !== 'nomad', f.gov === 'nomad' ? t('dec.noNomad') : t('dec.needGold', { n: 120 })));

    return `<h2>${swatch(f.color)} ${esc(L(f.n))}</h2>
    <div class="cols">
      <div>
        <h3>${esc(t('fac.overview'))}</h3>
        <table class="kv">
          <tr><th>${esc(t('fac.ruler'))}</th><td>${ruler ? charBadge(ruler) : '—'}</td></tr>
          <tr><th>${esc(t('fac.heir'))}</th><td>${heir ? charBadge(heir) : '—'}</td></tr>
          ${viz ? `<tr><th>${esc(t('fac.vizier'))}</th><td>${charBadge(viz)}</td></tr>` : ''}
          <tr><th>${esc(t('fac.gov'))}</th><td title="${esc(L(gov.desc))}"><b>${esc(L(gov.n))}</b><br><small class="muted">${esc(L(gov.desc))}</small></td></tr>
          <tr><th>${esc(t('fac.succession'))}</th><td title="${esc(L(SUCCESSION_LAWS[f.succession].desc))}">${esc(L(SUCCESSION_LAWS[f.succession].n))}</td></tr>
          <tr><th>${esc(t('fac.religion'))}</th><td>${swatch(RELIGIONS[f.religion].color)}${esc(L(RELIGIONS[f.religion].n))}</td></tr>
          <tr><th>${esc(t('fac.culture'))}</th><td>${esc(L(CULTURES[f.culture].n))}</td></tr>
          <tr><th>${esc(t('fac.titles'))}</th><td>${f.titles.map((x) => `<span class="title-chip" title="${esc(L(TITLES[x].desc))}">${esc(L(TITLES[x].n))}</span>`).join(' ') || '—'}</td></tr>
          <tr><th>${esc(t('fac.legitimacy'))}</th><td>${bar(f.legitimacy / 100, '#c9a227')} ${Math.round(f.legitimacy)}</td></tr>
          <tr><th>${esc(t('fac.infamy'))}</th><td>${bar(Math.min(1, f.infamy / 100), '#8b1a1a')} ${Math.round(f.infamy)}</td></tr>
          <tr><th>${esc(t('fac.weariness'))}</th><td>${bar(Math.min(1, f.warWeariness / 60), '#5d6d7e')} ${Math.round(f.warWeariness)}</td></tr>
          ${f.overlord ? `<tr><th>${esc(t('fac.overlord'))}</th><td>${esc(L(facName(f.overlord)))}</td></tr>` : ''}
        </table>
        <h3>${esc(t('fac.income'))}</h3>
        <table class="kv small">
          <tr><th>${esc(t('inc.tax'))}</th><td>${fmt(inc.tax)}</td></tr>
          <tr><th>${esc(t('inc.goods'))}</th><td>${fmt(inc.goods)}</td></tr>
          <tr><th>${esc(t('inc.route'))}</th><td>${fmt(inc.route)}</td></tr>
          <tr><th>${esc(t('inc.pasture'))}</th><td>${fmt(inc.pasture)}</td></tr>
          ${inc.towns ? `<tr><th>🏘 ${esc(t('inc.towns'))}</th><td><small>${fmt(inc.towns)}</small></td></tr>` : ''}
          ${inc.nEnclaves ? `<tr><th>🏰 ${esc(t('inc.enclaves', { n: inc.nEnclaves }))}</th><td class="pos">+${fmt(inc.enclaves)}</td></tr>` : ''}
          ${inc.tribute ? `<tr><th>${esc(t('inc.tribute'))}</th><td class="pos">+${fmt(inc.tribute)}</td></tr>` : ''}
          ${inc.tributePaid ? `<tr><th>${esc(t('inc.tributePaid'))}</th><td class="neg">−${fmt(inc.tributePaid)}</td></tr>` : ''}
          ${inc.payIn ? `<tr><th>${esc(t('inc.payIn'))}</th><td class="pos">+${fmt(inc.payIn)}</td></tr>` : ''}
          ${inc.payOut ? `<tr><th>${esc(t('inc.payOut'))}</th><td class="neg">−${fmt(inc.payOut)}</td></tr>` : ''}
          ${inc.loans ? `<tr><th>${esc(t('inc.loans'))}</th><td class="neg">−${fmt(inc.loans)}</td></tr>` : ''}
          <tr><th>${esc(t('inc.upkeep'))}</th><td class="neg">−${fmt(inc.upkeep)}</td></tr>
          <tr><th>${esc(t('inc.admin'))}</th><td class="neg">−${fmt(inc.admin)}</td></tr>
          <tr><th><b>${esc(t('inc.net'))}</b></th><td><b class="${inc.net >= 0 ? 'pos' : 'neg'}">${signed(inc.net, 1)}</b></td></tr>
          <tr><th>🐎 ${esc(t('res.horses'))}</th><td>+${fmt(inc.horses)} <small class="neg">−${fmt(inc.fodder)} ${esc(t('inc.fodder'))}</small></td></tr>
          <tr><th>📜 ${esc(t('res.research'))}</th><td>+${fmt(inc.research)}</td></tr>
        </table>
      </div>
      <div>
        <h3>🧭 ${esc(t('reg.known'))}</h3>
        <div class="regions">${REGION_IDS.map((r) => `<span class="reg ${knows(f.id, r) ? 'known' : 'unknown'}" title="${esc(L(REGIONS[r].desc))}">${knows(f.id, r) ? '🗺' : '🌫'} ${esc(L(REGIONS[r].n))} <small>${esc(t(knows(f.id, r) ? 'reg.isKnown' : 'reg.isUnknown'))}</small></span>`).join('')}</div>
        ${knownRegions(f.id).length < REGION_IDS.length ? `<p class="muted small">${esc(t('reg.unknownHint'))}</p>` : ''}
        <h3>${esc(t('fac.economy'))}</h3>
        <div class="small"><b>${esc(t('dip.resources'))}:</b> ${resList(G.s.player)}</div>
        <div class="small"><b>${esc(t('mk.monopolies'))}:</b> ${monopolies(G.s.player).map((g) => `${GOODS[g].icon} ${esc(L(GOODS[g].n))}`).join(', ') || '—'}</div>
        <div class="market">${Object.entries(G.s.market || {}).sort((a, b) => b[1] - a[1]).map(([g, pr]) => `<span class="${pr >= 1.05 ? 'pos' : pr <= 0.95 ? 'neg' : ''}" title="${esc(L(GOODS[g].n))}">${GOODS[g].icon} ${Math.round(pr * 100)}%</span>`).join('')}</div>
        <div class="decision"><div><b>${esc(t('loan.take', { n: LOAN.amount }))}</b><br><small class="muted">${esc(t('loan.desc', { per: LOAN.per, turns: LOAN.turns }))}${f.loans?.length ? ' · ' + esc(t('loan.open', { n: f.loans.length })) : ''}</small></div>${(f.loans?.length || 0) < LOAN.max ? `<button data-act="loan">${esc(t('dec.do'))}</button>` : `<small class="neg">${esc(t('loan.max'))}</small>`}</div>
        <h3>${esc(t('fac.policies'))}</h3>
        <div class="policy"><span>${esc(t('pol.tax'))}</span>${['low', 'normal', 'high'].map((v) => `<button data-act="pol" data-k="tax" data-v="${v}" class="${f.policies.tax === v ? 'on' : ''}">${esc(t('pol.tax.' + v))}</button>`).join('')}</div>
        <div class="policy"><span>${esc(t('pol.tolerance'))}</span>${['tolerant', 'normal', 'strict'].map((v) => `<button data-act="pol" data-k="tolerance" data-v="${v}" class="${f.policies.tolerance === v ? 'on' : ''}">${esc(t('pol.tol.' + v))}</button>`).join('')}</div>
        ${f.techs.includes('iqta') ? `<div class="policy"><span>${esc(t('pol.iqta'))}</span><button data-act="pol" data-k="iqta" data-v="${f.policies.iqta ? '0' : '1'}" class="${f.policies.iqta ? 'on' : ''}">${esc(f.policies.iqta ? t('pol.on') : t('pol.off'))}</button><small class="muted">${esc(t('pol.iqtaDesc'))}</small></div>` : ''}
        <h3>${esc(t('fac.decisions'))}</h3>
        <div class="decisions">${decisions.join('')}</div>
        <h3>${esc(t('fac.goals'))}</h3>
        ${goalsList(goals)}
      </div>
    </div>`;
  };
  function dec(id, name, desc, ok, why) {
    return `<div class="decision ${ok ? '' : 'dis'}"><div><b>${esc(name)}</b><br><small class="muted">${esc(desc)}</small></div>${ok ? `<button data-act="dec" data-id="${esc(id)}">${esc(t('dec.do'))}</button>` : `<small class="neg">${esc(why || '')}</small>`}</div>`;
  }
  return openModal(render(), {
    wide: true,
    handlers: (close, wrap) => {
      const rerender = () => { wrap.querySelector('.modal-body').innerHTML = render(); refreshAll(false); };
      return {
        pol: (el) => {
          const f = fac(G.s.player);
          if (el.dataset.k === 'iqta') f.policies.iqta = el.dataset.v === '1';
          else f.policies[el.dataset.k] = el.dataset.v;
          clearModCache();
          rerender();
        },
        loan: () => { if (takeLoan(G.s.player)) toast(t('loan.done', { n: LOAN.amount })); rerender(); },
        dec: async (el) => {
          const f = fac(G.s.player);
          const [kind, arg] = el.dataset.id.split(':');
          if (kind === 'gov') { f.gov = arg; f.govUnrest = 8; f.prestige -= 40; log('log.govChange', { fac: f.n, gov: arg }, { f: f.id, imp: true }); }
          if (kind === 'title') {
            if (arg === 'sultan') {
              const acc = proposalAcceptance('sultan', f.id, 'abbasid');
              if (acc > 0 || G.s.player === 'abbasid') { claimTitle(f.id, 'sultan'); rel(f.id, 'abbasid').mod += 10; toast(t('dec.sultanGranted')); }
              else { rel(f.id, 'abbasid').mod -= 5; f.prestige -= 5; toast(t('dec.sultanRefused')); }
            } else claimTitle(f.id, arg);
          }
          if (kind === 'holy') { f.holyWar = 8; f.prestige -= 40; }
          if (kind === 'rel') { f.prestige -= 60; changeReligion(f.id, arg); }
          if (kind === 'law') { f.succession = arg; f.prestige -= 50; f.legitimacy = clamp(f.legitimacy - 10, 0, 100); updateHeir(f.id); }
          if (kind === 'vizier') { const v = appointVizier(f.id); if (v) toast(t('dec.vizierDone', { name: L(v.n) })); }
          clearModCache();
          rerender();
        },
      };
    },
  });
}

function goalsList(goals) {
  return `<ul class="goals">${goals.map((g) => {
    let label = '';
    if (g.t === 'own') label = t('goal.own', { list: g.p.map((p) => L(provName(p))).join(', ') });
    else if (g.t === 'count') label = t('goal.count', { n: g.n });
    else if (g.t === 'title') label = t('goal.title', { title: L(TITLES[g.id].n) });
    else if (g.t === 'tech') label = t('goal.tech', { n: g.n });
    else if (g.t === 'survive') label = t('goal.survive', { year: END_YEAR });
    else if (g.t === 'independent') label = t('goal.independent');
    return `<li class="${g.done ? 'done' : ''}">${g.done ? '✅' : '⬜'} ${esc(label)} <small class="muted">${esc(g.prog)}</small></li>`;
  }).join('')}</ul>`;
}

// Meldungen aus unerforschten Ländern bleiben verborgen
export function logVisible(e) {
  const s = G.s;
  if (s.observer || e.f === s.player) return true;
  if (e.rg && !knows(s.player, e.rg)) return false;
  if (e.f && fac(e.f) && !knowsFaction(s.player, e.f)) return false;
  return true;
}

// Umstrittene Orte zwischen zwei Mächten
function contestedRow(me, other) {
  const list = [];
  for (const [pid, i] of foreignHeld(other)) if (prov(pid).owner === me) list.push(`<a data-act="gotoTown" data-p="${pid}" data-i="${i}">🏰 ${esc(L(townName(pid, i)))}</a> <small class="neg">(${esc(L(provName(pid)))})</small>`);
  for (const [pid, i] of foreignHeld(me)) if (prov(pid).owner === other) list.push(`<a data-act="gotoTown" data-p="${pid}" data-i="${i}">🏰 ${esc(L(townName(pid, i)))}</a> <small class="pos">(${esc(L(provName(pid)))})</small>`);
  if (!list.length) return '';
  return `<tr><th>${esc(t('dip.contested'))}</th><td class="small">${list.join('<br>')}<div class="muted">${esc(t('dip.contestedHint'))}</div></td></tr>`;
}

// ---------- Diplomatie ----------
export function diplomacyScreen(initial) {
  let selected = initial && initial !== G.s.player ? initial : null;
  const render = () => {
    const s = G.s, me = s.player;
    const nbs = new Set(neighborsOf(me));
    const all = aliveFactions().filter((f) => f.id !== me && f.id !== 'rebels' && (factionProvinces(f.id).length || factionArmies(f.id).length));
    const list = all.filter((f) => f.id === selected || knowsFaction(me, f.id));
    const hidden = all.length - list.length;
    const prio = (f) => (atWar(me, f.id) ? 0 : f.overlord === me || fac(me).overlord === f.id ? 1 : relPeek(me, f.id)?.alliance ? 2 : nbs.has(f.id) ? 3 : 4);
    list.sort((a, b) => prio(a) - prio(b) || factionProvinces(b.id).length - factionProvinces(a.id).length);
    if (!selected && list.length) selected = list[0].id;
    const status = (fid) => {
      const r = relPeek(me, fid);
      const out = [];
      if (atWar(me, fid)) out.push(`<span class="tag war">${esc(t('dip.war'))}</span>`);
      if (r?.alliance) out.push(`<span class="tag ally">${esc(t('dip.ally'))}</span>`);
      if (r?.trade) out.push(`<span class="tag trade">${esc(t('dip.trade'))}</span>`);
      if (fac(fid).overlord === me) out.push(`<span class="tag vassal">${esc(t('dip.vassal'))}</span>`);
      if (fac(me).overlord === fid) out.push(`<span class="tag vassal">${esc(t('dip.overlord'))}</span>`);
      if (fac(fid).npc) out.push(`<span class="tag npc">${esc(t('dip.npc'))}</span>`);
      if (truceLeft(me, fid) > 0 && !atWar(me, fid)) out.push(`<span class="tag truce">${esc(t('dip.truce'))} ${truceLeft(me, fid)}</span>`);
      return out.join('');
    };
    const left = (hidden ? `<p class="muted small">🌫 ${esc(t('dip.unknownCount', { n: hidden }))}</p>` : '') + list.map((f) => `<button class="dlist ${f.id === selected ? 'on' : ''}" data-act="sel" data-f="${f.id}">${swatch(f.color)}<span>${esc(L(f.n))}</span><small class="${opinion(me, f.id) >= 0 ? 'pos' : 'neg'}">${signed(opinion(me, f.id))}</small>${status(f.id)}</button>`).join('');
    let right = '';
    if (selected && fac(selected)) {
      const f = fac(selected);
      const ruler = chr(f.ruler);
      const war = atWar(me, selected);
      const r = relPeek(me, selected);
      const chance = (v) => (v > 20 ? `<span class="pos">${esc(t('ch.veryLikely'))}</span>` : v > 0 ? `<span class="pos">${esc(t('ch.likely'))}</span>` : v > -20 ? `<span class="neg">${esc(t('ch.unlikely'))}</span>` : `<span class="neg">${esc(t('ch.no'))}</span>`);
      const acts = [];
      if (war) {
        acts.push(act('peace', '🕊 ' + t('dip.offerPeace'), ''));
      } else {
        if (f.overlord !== me && fac(me).overlord !== selected) acts.push(act('war', '⚔ ' + t('dip.declareWar'), truceLeft(me, selected) > 0 ? t('dip.truceWarn') : ''));
        if (!r?.trade) acts.push(act('trade', '🐫 ' + t('dip.proposeTrade'), chance(proposalAcceptance('trade', me, selected))));
        else acts.push(act('untrade', '✖ ' + t('dip.cancelTrade'), ''));
        if (!r?.alliance) acts.push(act('alliance', '🤝 ' + t('dip.proposeAlliance'), chance(proposalAcceptance('alliance', me, selected))));
        else acts.push(act('unally', '✖ ' + t('dip.breakAlliance'), ''));
        if (!(r?.nap > s.turn)) acts.push(act('nap', '📜 ' + t('dip.proposeNap'), chance(proposalAcceptance('nap', me, selected))));
        if (!(r?.married && s.turn - r.married < 20)) acts.push(act('marriage', '💍 ' + t('dip.marriage'), chance(proposalAcceptance('marriage', me, selected))));
        if (f.overlord !== me && !f.overlord) acts.push(act('vassalize', '👑 ' + t('dip.demandVassal'), chance(proposalAcceptance('vassalize', me, selected))));
        if (f.overlord !== me && !(r?.tributeTurn && s.turn - r.tributeTurn < 8)) acts.push(act('tribute', '💰 ' + t('dip.demandTribute', { n: tributeAmount(me, selected) }), chance(proposalAcceptance('tribute', me, selected))));
        if (!r?.access && !r?.alliance) acts.push(act('access', '🚩 ' + t('dip.proposeAccess'), chance(proposalAcceptance('access', me, selected))));
        else if (r?.access) acts.push(act('unaccess', '✖ ' + t('dip.cancelAccess'), ''));
        const pay = paymentBetween(me, selected);
        if (pay) acts.push(`<div class="note">💰 ${esc(pay.from === me ? t('dip.weSubsidize', { n: pay.amount, t: pay.until - s.turn }) : t('dip.theyPay', { n: pay.amount, t: pay.until - s.turn }))}</div>`);
        else {
          if (f.overlord !== me) acts.push(act('tributeTreaty', '📜💰 ' + t('dip.demandTributeTreaty', { n: treatyAmount(me, selected) }), chance(proposalAcceptance('tributeTreaty', me, selected))));
          acts.push(`<div class="giftrow">🤲 ${esc(t('dip.subsidy'))}: ${[5, 10, 20].map((n) => `<button data-act="subsidy" data-n="${n}">${n}/${esc(t('dip.perTurn'))}</button>`).join('')}</div>`);
        }
        if (f.overlord === me) acts.push(act('release', '🕊 ' + t('dip.releaseVassal'), ''));
        if (fac(me).overlord === selected) acts.push(act('independence', '⚔ ' + t('dip.independence'), ''));
      }
      acts.push(`<div class="giftrow">🎁 ${esc(t('dip.gift'))}: ${[50, 100, 250].map((n) => `<button data-act="gift" data-n="${n}" ${fac(me).gold < n ? 'disabled' : ''}>${n}</button>`).join('')}</div>`);
      right = `<div class="dhead">${swatch(f.color)}<h3>${esc(L(f.n))}</h3></div>
        <table class="kv small">
          <tr><th>${esc(t('fac.ruler'))}</th><td>${ruler ? charBadge(ruler) : '—'}</td></tr>
          <tr><th>${esc(t('fac.religion'))}</th><td>${esc(L(RELIGIONS[f.religion].n))} · ${esc(L(CULTURES[f.culture].n))}</td></tr>
          <tr><th>${esc(t('fac.gov'))}</th><td>${esc(L(GOVERNMENTS[f.gov].n))}${f.npc ? ` · <i>${esc(t('dip.npcLong'))}</i>` : ''}</td></tr>
          <tr><th>${esc(t('dip.gold'))}</th><td>💰 ${fmt(f.gold)}</td></tr>
          <tr><th>${esc(t('dip.provinces'))}</th><td>${factionProvinces(selected).length}</td></tr>
          <tr><th>${esc(t('dip.power'))}</th><td>${powerCompare(militaryPower(me), militaryPower(selected))}</td></tr>
          <tr><th>${esc(t('dip.opinion'))}</th><td><b>${signed(opinion(me, selected))}</b><div class="opparts">${opinionParts(me, selected).map(([k, v]) => `<span class="${v >= 0 ? 'pos' : 'neg'}">${esc(t(k))} ${signed(v)}</span>`).join('')}</div></td></tr>
          <tr><th>${esc(t('dip.resources'))}</th><td>${resList(selected)}</td></tr>
          ${contestedRow(me, selected)}
          ${war ? `<tr><th>${esc(t('dip.warscore'))}</th><td>${signed(warScore(me, selected))}</td></tr>` : ''}
          <tr><th>${esc(t('fac.infamy'))}</th><td>${Math.round(f.infamy)}</td></tr>
          ${f.titles.length ? `<tr><th>${esc(t('fac.titles'))}</th><td>${f.titles.map((x) => esc(L(TITLES[x].n))).join(', ')}</td></tr>` : ''}
          ${f.overlord ? `<tr><th>${esc(t('fac.overlord'))}</th><td>${esc(L(facName(f.overlord)))}</td></tr>` : ''}
        </table>
        <div class="dip-actions">${acts.join('')}</div>`;
    }
    return `<h2>🤝 ${esc(t('ui.diplomacy'))}</h2><div class="dipgrid"><div class="dleft">${left}</div><div class="dright">${right}</div></div>`;
  };
  function act(id, label, extra) {
    return `<div class="dact"><button data-act="${id}">${esc(label)}</button> <small>${extra}</small></div>`;
  }
  return openModal(render(), {
    wide: true, cls: 'dip',
    handlers: (close, wrap) => {
      const rerender = () => { wrap.querySelector('.modal-body').innerHTML = render(); refreshAll(); };
      const me = () => G.s.player;
      const tryProp = (kind, fn) => {
        if (proposalAcceptance(kind, me(), selected) > 0) { fn(); toast(t('dip.accepted')); }
        else { rel(me(), selected).mod -= 3; toast(t('dip.refused')); }
        rerender();
      };
      return {
        sel: (el) => { selected = el.dataset.f; rerender(); },
        gotoTown: (el) => { close(); UIState.selTown = { pid: el.dataset.p, i: +el.dataset.i }; UIState.tab = 'towns'; UIState.map.centerOn(el.dataset.p, 1.4); selectProvince(el.dataset.p); UIState.tab = 'towns'; refreshAll(false); },
        war: async () => {
          const ok = await confirmDialog(t('dip.warConfirm', { fac: L(facName(selected)) }), t('dip.declareWar'), t('ui.cancel'));
          if (ok) { declareWar(me(), selected); rerender(); }
        },
        peace: async () => { await peaceDialog(selected); rerender(); },
        trade: () => tryProp('trade', () => setTrade(me(), selected, true)),
        untrade: () => { setTrade(me(), selected, false); rel(me(), selected).mod -= 10; rerender(); },
        alliance: () => tryProp('alliance', () => setAlliance(me(), selected)),
        unally: () => { breakAlliance(me(), selected, true); rerender(); },
        nap: () => tryProp('nap', () => setNap(me(), selected)),
        marriage: () => tryProp('marriage', () => marriage(me(), selected)),
        vassalize: () => tryProp('vassalize', () => makeVassal(selected, me())),
        tribute: () => {
          if (proposalAcceptance('tribute', me(), selected) > 0) toast(t('dip.tributePaid', { n: demandTribute(me(), selected) }));
          else { rel(me(), selected).mod -= 15; rel(me(), selected).tributeTurn = G.s.turn; toast(t('dip.tributeRefused')); }
          rerender();
        },
        release: () => { releaseVassal(me(), selected); rerender(); },
        independence: async () => {
          const ok = await confirmDialog(t('dip.independenceConfirm'), t('dip.independence'), t('ui.cancel'));
          if (ok) { fac(me()).overlord = null; declareWar(me(), selected); rerender(); }
        },
        access: () => tryProp('access', () => setAccess(me(), selected, true)),
        unaccess: () => { setAccess(me(), selected, false); rerender(); },
        tributeTreaty: () => {
          if (proposalAcceptance('tributeTreaty', me(), selected) > 0) { setPayment(selected, me(), treatyAmount(me(), selected), 16); fac(me()).prestige += 3; rel(me(), selected).mod -= 15; toast(t('dip.accepted')); }
          else { rel(me(), selected).mod -= 10; toast(t('dip.refused')); }
          rerender();
        },
        subsidy: (el) => { setPayment(me(), selected, +el.dataset.n, 16); rel(me(), selected).mod += +el.dataset.n; toast(t('dip.subsidyDone')); rerender(); },
        gift: (el) => { if (giftGold(me(), selected, +el.dataset.n)) toast(t('dip.giftDone')); rerender(); },
      };
    },
  });
}

function resList(fid) {
  const a = resourceAccess(fid);
  return Object.entries(RESOURCES).map(([k, r]) => {
    const st = a.own.has(k) ? 'own' : a.viaTrade.has(k) ? 'trade' : 'none';
    return `<span class="res-${st}" title="${esc(L(r.desc))}">${r.icon} ${esc(L(r.n))} <small>(${esc(t('resacc.' + st))})</small></span>`;
  }).join(' ');
}

function treatyAmount(me, other) {
  return Math.max(5, Math.round(tributeAmount(me, other) / 8));
}

function powerCompare(a, b) {
  const r = a / (a + b + 1);
  return `<span class="pcomp"><span style="width:${Math.round(r * 100)}%"></span></span> <small>${esc(t('dip.us'))} ${fmt(a / 100)} · ${esc(t('dip.them'))} ${fmt(b / 100)}</small>`;
}

function peaceDialog(other) {
  const me = G.s.player;
  const terms = { gold: 0, goldFrom: null, provinces: [], vassal: null };
  const theirBorder = factionProvinces(other).filter((p) => neighbors(p).some((n) => prov(n).owner === me));
  const myBorder = factionProvinces(me).filter((p) => neighbors(p).some((n) => prov(n).owner === other));
  const render = () => {
    const v = peaceAcceptance(me, other, terms);
    const verdict = v > 0 ? `<b class="pos">${esc(t('peace.accept'))}</b>` : `<b class="neg">${esc(t('peace.refuse'))}</b>`;
    return `<h2>🕊 ${esc(t('peace.title', { fac: L(facName(other)) }))}</h2>
    <p class="muted">${esc(t('dip.warscore'))}: ${signed(warScore(me, other))}</p>
    <h4>${esc(t('peace.gold'))}</h4>
    <div class="policy">${[0, 100, 250, 500].map((n) => `<button data-act="dg" data-n="${n}" class="${terms.goldFrom === other && terms.gold === n || (n === 0 && !terms.gold) ? 'on' : ''}">${n ? '+' + n : '—'}</button>`).join('')}
      ${[100, 250].map((n) => `<button data-act="og" data-n="${n}" class="${terms.goldFrom === me && terms.gold === n ? 'on' : ''}">−${n}</button>`).join('')}</div>
    ${theirBorder.length ? `<h4>${esc(t('peace.demandProv'))}</h4><div class="chips">${theirBorder.map((p) => `<button data-act="tp" data-p="${p}" class="${terms.provinces.includes(p) ? 'on' : ''}">${esc(L(provName(p)))}</button>`).join('')}</div>` : ''}
    ${myBorder.length ? `<h4>${esc(t('peace.offerProv'))}</h4><div class="chips">${myBorder.map((p) => `<button data-act="tp" data-p="${p}" class="${terms.provinces.includes(p) ? 'on' : ''}">${esc(L(provName(p)))}</button>`).join('')}</div>` : ''}
    <h4>${esc(t('peace.yearly'))}</h4><div class="policy">${[0, 10, 20, 40].map((n) => `<button data-act="py" data-n="${n}" class="${(terms.pay?.from === other && terms.pay.amount === n) || (!n && !terms.pay) ? 'on' : ''}">${n ? '+' + n + '/' + esc(t('dip.perTurn')) : '—'}</button>`).join('')}${[10, 20].map((n) => `<button data-act="po" data-n="${n}" class="${terms.pay?.from === me && terms.pay.amount === n ? 'on' : ''}">−${n}/${esc(t('dip.perTurn'))}</button>`).join('')}</div>
    <h4>${esc(t('peace.vassal'))}</h4><div class="policy"><button data-act="vs" class="${terms.vassal === other ? 'on' : ''}">${esc(t('peace.theyVassal'))}</button></div>
    <p>${esc(t('peace.verdict'))}: ${verdict}</p>
    <div class="actions center"><button class="primary" data-act="send">${esc(t('peace.send'))}</button><button data-act="cancel">${esc(t('ui.cancel'))}</button></div>`;
  };
  return openModal(render(), {
    handlers: (close, wrap) => {
      const rr = () => { wrap.querySelector('.modal-body').innerHTML = render(); };
      return {
        dg: (el) => { terms.gold = +el.dataset.n; terms.goldFrom = terms.gold ? other : null; rr(); },
        og: (el) => { terms.gold = +el.dataset.n; terms.goldFrom = me; rr(); },
        tp: (el) => { const p = el.dataset.p; const i = terms.provinces.indexOf(p); if (i >= 0) terms.provinces.splice(i, 1); else terms.provinces.push(p); rr(); },
        vs: () => { terms.vassal = terms.vassal ? null : other; rr(); },
        py: (el) => { const n = +el.dataset.n; terms.pay = n ? { from: other, amount: n, turns: 20 } : null; rr(); },
        po: (el) => { terms.pay = { from: me, amount: +el.dataset.n, turns: 20 }; rr(); },
        send: () => {
          if (peaceAcceptance(me, other, terms) > 0) { makePeace(me, other, terms); toast(t('dip.accepted')); close(true); }
          else { toast(t('dip.refused')); rr(); }
        },
        cancel: () => close(false),
      };
    },
  });
}

// ---------- Kriegsübersicht ----------
export function warScreen() {
  const render = () => {
    const s = G.s, me = s.player, f = fac(me);
    const enemies = aliveFactions().filter((x) => x.id !== me && x.id !== 'rebels' && atWar(me, x.id));
    let html = `<h2>⚔ ${esc(t('war.title'))}</h2>`;
    html += `<p class="center small">${esc(t('war.weariness'))}: <b>${Math.round(f.warWeariness)}</b>${Math.round(f.warWeariness * 0.3) ? ` <span class="neg">(${esc(t('war.wearOrder', { n: Math.round(f.warWeariness * 0.3) }))})</span>` : ''} · ${esc(t('fac.infamy'))}: <b>${Math.round(f.infamy)}</b>${f.infamy > 25 ? ` <span class="neg">(${esc(t('war.coalitionRisk'))})</span>` : ''}</p>`;
    const rebels = Object.values(s.provinces).filter((p) => p.owner === 'rebels' && p.lastOwner === me).length
      + Object.values(s.provinces).reduce((n, p) => n + (p.owner === me ? (p.towns || []).filter((tw) => tw.owner === 'rebels').length : 0), 0);
    if (rebels) html += `<div class="note neg">🔥 ${esc(t('war.rebels', { n: rebels }))}</div>`;
    if (!enemies.length) html += `<p class="center">${esc(t('war.none'))}</p>`;
    for (const e of enemies) {
      const r = relPeek(me, e.id);
      const ws = warScore(me, e.id);
      const dur = s.turn - (r?.warStart || s.turn);
      const white = peaceAcceptance(me, e.id, {}) > 0;
      const mySieges = [], theirSieges = [];
      for (const pid in s.provinces) {
        const p = s.provinces[pid];
        const name = L(provName(pid));
        if (p.siege) {
          if (p.siege.fac === me && p.owner === e.id) mySieges.push([pid, `👑 ${name} ${p.siege.turns}/${p.siege.needed}`]);
          if (p.siege.fac === e.id && p.owner === me) theirSieges.push([pid, `👑 ${name} ${p.siege.turns}/${p.siege.needed}`]);
        }
        (p.towns || []).forEach((tw, i) => {
          if (!tw.siege) return;
          const tn = `${L(townName(pid, i))} (${name}) ${tw.siege.turns}/${tw.siege.needed}`;
          if (tw.siege.fac === me && tw.owner === e.id) mySieges.push([pid, tn]);
          if (tw.siege.fac === e.id && tw.owner === me) theirSieges.push([pid, tn]);
        });
      }
      const intruders = factionArmies(e.id).filter((a) => a.units.length && prov(a.prov).owner === me);
      const wsCls = ws > 15 ? 'pos' : ws < -15 ? 'neg' : '';
      const wsText = ws > 40 ? t('war.wsWinning') : ws > 15 ? t('war.wsAhead') : ws < -40 ? t('war.wsLosing') : ws < -15 ? t('war.wsBehind') : t('war.wsEven');
      const pct = clamp(50 + ws / 2, 0, 100);
      const link = ([pid, txt]) => `<a data-act="goto" data-p="${pid}">${esc(txt)}</a>`;
      html += `<div class="warcard">
        <div class="dhead">${swatch(e.color)}<h3>${esc(L(e.n))}</h3> <small class="muted">${esc(t('war.since', { n: dur }))}</small></div>
        <div><b>${esc(t('dip.warscore'))}: <span class="${wsCls}">${signed(ws)}</span></b> – ${esc(wsText)}
          <div class="wsbar"><span style="left:${pct}%"></span></div></div>
        <table class="kv small">
          <tr><th>${esc(t('dip.power'))}</th><td>${powerCompare(militaryPower(me), militaryPower(e.id))}</td></tr>
          <tr><th>${esc(t('war.mySieges'))}</th><td>${mySieges.length ? mySieges.map(link).join(', ') : '—'}</td></tr>
          <tr><th>${esc(t('war.theirSieges'))}</th><td class="${theirSieges.length ? 'neg' : ''}">${theirSieges.length ? theirSieges.map(link).join(', ') : '—'}</td></tr>
          <tr><th>${esc(t('war.intruders'))}</th><td class="${intruders.length ? 'neg' : ''}">${intruders.length ? intruders.map((a) => `<a data-act="goto" data-p="${a.prov}">${esc(L(provName(a.prov)))} (${fmt(a.units.reduce((n, u) => n + UNITS[u.t].size * u.hp, 0))})</a>`).join(', ') : '—'}</td></tr>
          <tr><th>${esc(t('war.whitePeace'))}</th><td>${white ? `<span class="pos">${esc(t('war.wouldAccept'))}</span>` : `<span class="neg">${esc(t('war.wouldRefuse'))}</span>`}</td></tr>
        </table>
        <div class="actions"><button class="primary" data-act="peace" data-f="${e.id}">🕊 ${esc(t('war.negotiate'))}</button><button data-act="dip" data-f="${e.id}">🤝 ${esc(t('ui.diplomacy'))}</button></div>
      </div>`;
    }
    html += `<details class="warguide" ${enemies.length ? '' : 'open'}><summary>${esc(t('war.guideTitle'))}</summary>${t('war.guide')}</details>`;
    return html;
  };
  return openModal(render(), {
    wide: true,
    handlers: (close) => ({
      peace: (el) => { close(); peaceDialog(el.dataset.f).then(() => refreshAll()); },
      dip: (el) => { close(); diplomacyScreen(el.dataset.f); },
      goto: (el) => { close(); UIState.map.centerOn(el.dataset.p, 1.2); selectProvince(el.dataset.p); },
    }),
  });
}

// ---------- Forschung ----------
export function researchScreen() {
  const render = () => {
    const f = fac(G.s.player);
    const inc = factionIncome(f.id);
    const cur = f.research.cur ? TECHS[f.research.cur] : null;
    let html = `<h2>📜 ${esc(t('ui.research'))}</h2>
      <p class="center">${esc(t('rs.perTurn', { n: fmt(inc.research) }))} · ${cur ? `${esc(t('rs.current'))}: <b>${esc(L(cur.n))}</b> ${bar(f.research.pts / techCost(cur, f.techs.length), '#4a235a')} ${Math.round(f.research.pts)}/${techCost(cur, f.techs.length)}` : `<span class="neg">${esc(t('res.noResearch'))}</span>`}</p>
      <div class="techgrid">`;
    for (const [br, bd] of Object.entries(TECH_BRANCHES)) {
      const list = Object.entries(TECHS).filter(([, x]) => x.br === br).sort((a, b) => a[1].tier - b[1].tier);
      html += `<div class="techcol"><h3 style="color:${bd.color}">${esc(L(bd.n))}</h3>`;
      for (const [id, x] of list) {
        const done = f.techs.includes(id);
        const avail = techAvailable(f.id, id);
        const isCur = f.research.cur === id;
        const reqs = x.req.map((r) => L(TECHS[r].n)).join(', ');
        const cost = techCost(x, f.techs.length);
        const turns = inc.research > 0 ? Math.ceil((cost - (isCur ? f.research.pts : 0)) / inc.research) : '∞';
        html += `<button class="tech ${done ? 'done' : avail ? 'avail' : 'locked'} ${isCur ? 'cur' : ''}" data-act="pick" data-id="${id}" ${avail && !done ? '' : 'disabled'}>
          <b>${done ? '✓ ' : ''}${esc(L(x.n))}</b>
          <small>${esc(L(x.desc))}</small>
          ${x.reveal ? `<small class="reveal ${x.reveal !== 'all' && knows(f.id, x.reveal) ? 'muted' : ''}">🧭 ${esc(x.reveal === 'all' ? t('tech.revealsAll') : t('tech.reveals', { region: REGIONS[x.reveal].n }))}${x.reveal !== 'all' && knows(f.id, x.reveal) ? ' ✓' : ''}</small>` : ''}
          ${x.reqRegion ? `<small class="${knows(f.id, x.reqRegion) ? 'muted' : 'neg'}">🌐 ${esc(t('tech.needsRegion', { region: REGIONS[x.reqRegion].n }))}</small>` : ''}
          <small class="muted">${reqs ? esc(t('rs.requires')) + ': ' + esc(reqs) + ' · ' : ''}${x.minYear ? esc(t('rs.fromYear', { y: x.minYear })) + ' · ' : ''}${done ? '' : `📜${cost} (~${turns} ${esc(t('rs.turns'))})`}</small>
        </button>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
    return html;
  };
  return openModal(render(), {
    wide: true,
    handlers: (close, wrap) => ({
      pick: (el) => {
        const f = fac(G.s.player);
        if (f.research.cur !== el.dataset.id) { f.research.pts = Math.round(f.research.pts * 0.5); f.research.cur = el.dataset.id; }
        wrap.querySelector('.modal-body').innerHTML = render();
        refreshAll(false);
      },
    }),
  });
}

// ---------- Dynastie ----------
export function dynastyScreen() {
  const render = () => {
    const s = G.s, f = fac(s.player);
    const members = dynastyMembers(f.id).sort((a, b) => a.born - b.born);
    const gens = generals(f.id).filter((c) => !c.dyn);
    const past = Object.values(s.chars).filter((c) => !c.alive && c.fac === f.id && c.pastRuler).slice(-8);
    const card = (c) => {
      const role = c.id === f.ruler ? t('dyn.ruler') : c.id === f.heir ? t('dyn.heir') : c.role === 'vizier' ? t('fac.vizier') : c.role === 'general' ? t('dyn.general') : c.female ? t('dyn.female') : t('dyn.male');
      const armyTxt = c.army && s.armies[c.army] ? `<br><small>⚑ ${esc(L(pdef(s.armies[c.army].prov).n))}</small>` : '';
      return `<div class="ccard ${c.id === f.ruler ? 'ruler' : ''} ${c.id === f.heir ? 'heir' : ''}"><div class="role">${esc(role)}</div>${charBadge(c)}<small>${esc(t('dyn.loyalty'))}: ${c.id === f.ruler ? '—' : loyalty(c)}</small>${armyTxt}</div>`;
    };
    return `<h2>👑 ${esc(t('ui.dynasty'))} – ${esc(L(f.dyn))}</h2>
      <p class="center">${esc(t('fac.succession'))}: <b>${esc(L(SUCCESSION_LAWS[f.succession].n))}</b> · ${esc(t('fac.legitimacy'))}: ${Math.round(f.legitimacy)}</p>
      <h3>${esc(t('dyn.family'))}</h3><div class="ccards">${members.map(card).join('')}</div>
      <h3>${esc(t('dyn.generals'))}</h3><div class="ccards">${gens.map(card).join('') || `<p class="muted">—</p>`}</div>
      <div class="actions center"><button data-act="hire" ${f.gold >= hireGeneralCost(f.id) ? '' : 'disabled'}>⚔ ${esc(t('dyn.hire', { n: hireGeneralCost(f.id) }))}</button></div>`;
  };
  return openModal(render(), {
    wide: true,
    handlers: (close, wrap) => ({
      hire: () => { const g = hireGeneral(G.s.player); if (g) toast(t('dyn.hired', { name: L(g.n) })); wrap.querySelector('.modal-body').innerHTML = render(); refreshAll(false); },
    }),
  });
}

// ---------- Chronik & Rangliste ----------
export function chronicleScreen() {
  let onlyImp = false;
  const render = () => {
    const s = G.s;
    const list = s.log.slice().reverse().filter((e) => (!onlyImp || e.imp || e.f === s.player) && logVisible(e)).slice(0, 250);
    return `<h2>📖 ${esc(t('ui.chronicle'))}</h2>
      <div class="policy center"><button data-act="f" class="${onlyImp ? '' : 'on'}">${esc(t('chr.all'))}</button><button data-act="f" class="${onlyImp ? 'on' : ''}">${esc(t('chr.important'))}</button></div>
      <div class="report">${list.map((e) => `<p class="${e.imp ? 'imp' : ''}"><small class="muted">${esc(dateText(e))}</small> ${esc(formatLog(e))}</p>`).join('')}</div>`;
  };
  return openModal(render(), { wide: true, handlers: (close, wrap) => ({ f: () => { onlyImp = !onlyImp; wrap.querySelector('.modal-body').innerHTML = render(); } }) });
}

function rankingTable() {
  // Mächte in unerforschten Ländern bleiben namenlos
  const r = ranking().slice(0, 20);
  const known = (id) => G.s.observer || knowsFaction(G.s.player, id);
  return `<table class="rank"><tr><th>#</th><th>${esc(t('rk.faction'))}</th><th>${esc(t('dip.provinces'))}</th><th>${esc(t('rk.score'))}</th></tr>
    ${r.map((x, i) => known(x.id)
    ? `<tr class="${x.id === G.s.player ? 'me' : ''}"><td>${i + 1}</td><td>${swatch(fac(x.id).color)}${esc(L(fac(x.id).n))}</td><td>${x.provs}</td><td>${x.score}</td></tr>`
    : `<tr class="unknown"><td>${i + 1}</td><td>🌫 <i>${esc(t('reg.incognita'))}</i></td><td>?</td><td>${x.score}</td></tr>`).join('')}</table>`;
}

export function rankingScreen() {
  const html = `<h2>🏆 ${esc(t('ui.ranking'))}</h2><div class="cols"><div>${rankingTable()}</div><div><h3>${esc(t('fac.goals'))}</h3>${goalsList(goalStatus(G.s.player))}<p class="muted small">${esc(t('rk.hint', { year: END_YEAR }))}</p></div></div>`;
  return openModal(html, { wide: true });
}

// ---------- Spielmenü ----------
export function gameMenu() {
  const render = () => `<h2>☰ ${esc(t('ui.menu'))}</h2>
    <h3>${esc(t('menu.save'))}</h3>
    <div class="slots">${SLOTS.filter((x) => x !== 'auto').map((sl) => { const m = slotMeta(sl); return `<button data-act="save" data-s="${sl}">💾 ${esc(t('menu.slot'))} ${sl}<small>${m ? esc(L(m.facName || { de: m.player })) + ' · ' + m.year : esc(t('menu.empty'))}</small></button>`; }).join('')}</div>
    <h3>${esc(t('menu.load'))}</h3>
    <div class="slots">${SLOTS.map((sl) => { const m = slotMeta(sl); return `<button data-act="load" data-s="${sl}" ${m ? '' : 'disabled'}>📂 ${sl === 'auto' ? esc(t('menu.auto')) : esc(t('menu.slot')) + ' ' + sl}<small>${m ? esc(L(m.facName || { de: m.player })) + ' · ' + esc(L(SEASONS[m.season])) + ' ' + m.year : esc(t('menu.empty'))}</small></button>`; }).join('')}</div>
    <div class="actions center">
      <button data-act="export">⬇ ${esc(t('menu.export'))}</button>
      <button data-act="import">⬆ ${esc(t('menu.import'))}</button>
      <button data-act="lang">🌐 ${lang() === 'de' ? 'Türkçe' : 'Deutsch'}</button>
      <button data-act="help">❓ ${esc(t('menu.help'))}</button>
      <button data-act="quit">🚪 ${esc(t('menu.quit'))}</button>
    </div>`;
  return openModal(render(), {
    handlers: (close, wrap) => ({
      save: (el) => { toast(t(saveSlot(el.dataset.s) ? 'menu.saved' : 'menu.saveFail')); wrap.querySelector('.modal-body').innerHTML = render(); },
      load: (el) => { const d = loadSlotData(el.dataset.s); if (d && UIState.onLoad) { close(); UIState.onLoad(d); } },
      export: () => exportSave(),
      import: async () => { const d = await importSave(); if (d && UIState.onLoad) { close(); UIState.onLoad(d); } else if (!d) toast(t('menu.importFail')); },
      lang: () => { toggleLang(); wrap.querySelector('.modal-body').innerHTML = render(); },
      help: () => helpScreen(),
      quit: async () => { const ok = await confirmDialog(t('menu.quitConfirm'), t('menu.quit'), t('ui.cancel')); if (ok) { close(); UIState.onExit?.(); } },
    }),
  });
}

export function helpScreen() {
  const html = `<h2>❓ ${esc(t('menu.help'))}</h2><div class="help">${t('help.html', { year: END_YEAR })}</div>`;
  return openModal(html, { wide: true });
}

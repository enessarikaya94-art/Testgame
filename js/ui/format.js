// Protokolleinträge in Text umwandeln.

import { t, L } from '../i18n.js';
import { buildingName } from '../data/buildings.js';
import { GOVERNMENTS, SEASONS, GOODS } from '../data/world.js';

export function formatLog(e) {
  const p = { ...e.p };
  switch (e.k) {
    case 'log.built': p.bname = L(buildingName(p.b, p.l, p.rel)); break;
    case 'log.govChange': p.govName = L(GOVERNMENTS[p.gov].n); break;
    case 'log.rulerDied': p.causeText = t('cause.' + (p.cause || 'natural')); break;
    case 'log.birth': p.child = t(p.female ? 'log.daughter' : 'log.son'); break;
    case 'log.succession': p.minorText = p.minor ? t('log.minor') : ''; break;
    case 'log.destroyed': p.byText = p.by ? t('log.destroyedBy', { by: L(p.by) }) : ''; break;
    case 'we.vein': p.goodName = L(GOODS[p.good].n); break;
    case 'log.battle': p.kind = t(p.assault ? 'log.assault' : 'log.fieldBattle'); break;
    default: break;
  }
  return t(e.k, p);
}

export function dateText(e) {
  return `${L(SEASONS[e.se])} ${e.y}`;
}

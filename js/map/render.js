// Darstellung der Kampagnenkarte im Stil einer alten Pergamentkarte.

import { WORLD_W, WORLD_H, project, WATER, ISLANDS, RIVERS, MOUNTAINS, WASTELANDS, REGION_LABELS } from '../data/geo.js';
import { PROVINCES } from '../data/provinces.js';
import { TERRAINS, RELIGIONS, CULTURES, TRADE_ROUTES } from '../data/world.js';
import { CELL } from './mapgen.js';
import { mulberry32, hexToRgb } from '../util.js';
import { L, t } from '../i18n.js';
import { REGIONS, REGION_IDS } from '../data/regions.js';
import { PROVINCE_TOWNS } from '../data/towns.js';

const WASTE_COLORS = { desert: '#e2cd92', mountain: '#b8a480', forest: '#a8b07c', steppe: '#d6c78c', hills: '#c9b98a', plains: '#cdc690' };
const INK = '#3e2f1f';

export class MapView {
  constructor(canvas, map) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.map = map;
    this.cam = { x: 0, y: 0, z: 0.5 };
    this.mode = 'political';
    this.sel = { prov: null, army: null };
    this.preview = null; // { path: [pid], marks: [turn] }
    this.hoverProv = null;
    this.handlers = {};
    this.dirty = true;
    this.game = null; // Zugriffsschicht, gesetzt von außen
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.buildBase();
    this.overlay = document.createElement('canvas');
    this.overlay.width = WORLD_W; this.overlay.height = WORLD_H;
    this.provOutline = this.buildOutlines();
    this.resize();
    this.bindInput();
    const loop = () => { if (this.dirty) { this.draw(); this.dirty = false; } requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }

  on(ev, fn) { this.handlers[ev] = fn; }
  emit(ev, ...a) { this.handlers[ev]?.(...a); }
  invalidate() { this.dirty = true; }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.round(r.width * this.dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * this.dpr));
    this.vw = r.width; this.vh = r.height;
    this.clampCam();
    this.invalidate();
  }

  // ---------- Grundkarte ----------
  buildBase() {
    const { gw, gh, ids, nP } = this.map;
    const base = document.createElement('canvas');
    base.width = WORLD_W; base.height = WORLD_H;
    const ctx = base.getContext('2d');
    // Pergament
    ctx.fillStyle = '#eadcb4';
    ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    const noise = ctx.getImageData(0, 0, WORLD_W, WORLD_H);
    const nd = noise.data;
    const rnd = mulberry32(7);
    for (let i = 0; i < nd.length; i += 4) {
      const v = (rnd() - 0.5) * 14;
      nd[i] += v; nd[i + 1] += v; nd[i + 2] += v * 0.8;
    }
    ctx.putImageData(noise, 0, 0);
    // Flecken und Alterung
    for (let i = 0; i < 90; i++) {
      const x = rnd() * WORLD_W, y = rnd() * WORLD_H, r = 40 + rnd() * 220;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(150,110,60,${0.03 + rnd() * 0.05})`);
      g.addColorStop(1, 'rgba(150,110,60,0)');
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // Landfarben
    const land = document.createElement('canvas');
    land.width = gw; land.height = gh;
    const lctx = land.getContext('2d');
    const img = lctx.createImageData(gw, gh);
    const provTerrain = PROVINCES.map((p) => hexToRgb(TERRAINS[p.terrain].color));
    const wasteRGB = WASTELANDS.map((w) => hexToRgb(WASTE_COLORS[w.kind] || '#d8cba4'));
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      let c = null, a = 0;
      if (id >= 0 && id < nP) { c = provTerrain[id]; a = 120; }
      else if (id >= nP) { c = wasteRGB[id - nP]; a = 170; }
      else if (id === -2) { c = [214, 200, 160]; a = 120; }
      if (c) { img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = a; }
    }
    lctx.putImageData(img, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(land, 0, 0, gw * CELL, gh * CELL);
    this.landLayer = land;

    // Geländezeichen
    this.drawTerrainGlyphs(ctx);
    for (const m of MOUNTAINS) this.drawRidge(ctx, m.pts);

    // Wasser
    const polyPath = (pts) => {
      const p = new Path2D();
      pts.forEach(([lon, lat], i) => { const [x, y] = project(lon, lat); if (i) p.lineTo(x, y); else p.moveTo(x, y); });
      p.closePath();
      return p;
    };
    const waterPath = new Path2D();
    WATER.forEach((w) => waterPath.addPath(polyPath(w.pts)));
    const islandPath = new Path2D();
    ISLANDS.forEach((w) => islandPath.addPath(polyPath(w.pts)));
    ctx.save();
    ctx.fillStyle = '#a7bdb9';
    ctx.fill(waterPath, 'nonzero');
    // Wellenbänder entlang der Küste
    ctx.clip(waterPath, 'nonzero');
    const coastSegs = this.coastSegments();
    for (const [w, a] of [[18, 0.06], [11, 0.08], [5, 0.12]]) {
      ctx.strokeStyle = `rgba(40,70,80,${a})`;
      ctx.lineWidth = w;
      ctx.lineJoin = 'round';
      ctx.stroke(coastSegs);
    }
    // Wellenlinien im offenen Meer
    ctx.strokeStyle = 'rgba(60,90,100,0.18)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 700; i++) {
      const x = rnd() * WORLD_W, y = rnd() * WORLD_H;
      const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
      if (this.map.ids[cy * gw + cx] !== -1) continue;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + 4, y - 3, x + 8, y);
      ctx.quadraticCurveTo(x + 12, y + 3, x + 16, y);
      ctx.stroke();
    }
    ctx.restore();
    // Inseln wieder mit Land füllen
    ctx.save();
    ctx.clip(islandPath);
    ctx.fillStyle = '#e4d5ab';
    ctx.fill(islandPath);
    ctx.drawImage(land, 0, 0, gw * CELL, gh * CELL);
    ctx.restore();
    // Küstenlinie
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.6;
    ctx.stroke(coastSegs);

    // Flüsse
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const r of RIVERS) {
      const pts = r.pts.map(([lon, lat]) => project(lon, lat));
      for (const [w, col] of [[3.2, 'rgba(90,130,150,0.35)'], [1.6, '#5f8aa0']]) {
        ctx.strokeStyle = col; ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length - 1; i++) {
          const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2;
          ctx.quadraticCurveTo(pts[i][0], pts[i][1], mx, my);
        }
        const l = pts[pts.length - 1];
        ctx.lineTo(l[0], l[1]);
        ctx.stroke();
      }
    }
    // Karawanenstraßen
    ctx.save();
    ctx.strokeStyle = 'rgba(110,75,35,0.45)';
    ctx.lineWidth = 1.6;
    ctx.setLineDash([2, 4]);
    ctx.lineCap = 'round';
    const pidx = Object.fromEntries(PROVINCES.map((p) => [p.id, project(p.lon, p.lat)]));
    for (const r of TRADE_ROUTES) {
      ctx.beginPath();
      r.path.forEach((pid, i) => {
        const [x, y] = pidx[pid];
        if (!i) { ctx.moveTo(x, y); return; }
        const [px, py] = pidx[r.path[i - 1]];
        // leicht geschwungene Wege
        const mx = (px + x) / 2 + (py - y) * 0.08, my = (py + y) / 2 + (x - px) * 0.08;
        ctx.quadraticCurveTo(mx, my, x, y);
      });
      ctx.stroke();
    }
    ctx.restore();
    // Dörfer und Landstraßen innerhalb der Provinzen
    this.drawVillages(ctx);
    this.drawLocalRoads(ctx);
    // Kompassrose
    this.drawCompass(ctx, ...project(64.5, 15.5), 70);
    this.drawCompass(ctx, ...project(-9.0, 46.0), 60);
    // Rahmen
    ctx.strokeStyle = INK; ctx.lineWidth = 6; ctx.strokeRect(3, 3, WORLD_W - 6, WORLD_H - 6);
    ctx.lineWidth = 1.5; ctx.strokeRect(12, 12, WORLD_W - 24, WORLD_H - 24);
    this.base = base;
    this.baseLabels = true;
  }

  coastSegments() {
    const { gw, gh, water } = this.map;
    const isWater = (x, y) => {
      const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
      if (cx < 0 || cy < 0 || cx >= gw || cy >= gh) return null;
      return water[cy * gw + cx] === 1;
    };
    const path = new Path2D();
    const polys = [...WATER.map((w) => w.pts), ...ISLANDS.map((w) => w.pts)];
    for (const pts of polys) {
      const P = pts.map(([lon, lat]) => project(lon, lat));
      for (let i = 0; i < P.length; i++) {
        const [x0, y0] = P[i], [x1, y1] = P[(i + 1) % P.length];
        const len = Math.hypot(x1 - x0, y1 - y0);
        const n = Math.max(1, Math.ceil(len / 6));
        const nx = -(y1 - y0) / len, ny = (x1 - x0) / len;
        let drawing = false;
        for (let k = 0; k < n; k++) {
          const ax = x0 + (x1 - x0) * (k / n), ay = y0 + (y1 - y0) * (k / n);
          const bx = x0 + (x1 - x0) * ((k + 1) / n), by = y0 + (y1 - y0) * ((k + 1) / n);
          const mx = (ax + bx) / 2, my = (ay + by) / 2;
          const s1 = isWater(mx + nx * 4, my + ny * 4), s2 = isWater(mx - nx * 4, my - ny * 4);
          const coast = s1 !== null && s2 !== null && s1 !== s2;
          if (coast) {
            if (!drawing) { path.moveTo(ax, ay); drawing = true; }
            path.lineTo(bx, by);
          } else drawing = false;
        }
      }
    }
    return path;
  }

  drawTerrainGlyphs(ctx) {
    const { gw, gh, ids, nP } = this.map;
    const rnd = mulberry32(99);
    const step = 16;
    for (let y = 8; y < WORLD_H; y += step) {
      for (let x = 8; x < WORLD_W; x += step) {
        const jx = x + (rnd() - 0.5) * step * 0.8, jy = y + (rnd() - 0.5) * step * 0.8;
        const id = ids[Math.floor(jy / CELL) * gw + Math.floor(jx / CELL)];
        if (id === undefined || id === -1) continue;
        let kind = null, dens = 0;
        if (id >= nP) { kind = WASTELANDS[id - nP].kind; dens = 0.8; }
        else if (id >= 0) { kind = PROVINCES[id].terrain; dens = 0.18; }
        else { kind = 'steppe'; dens = 0.1; }
        if (rnd() > dens) continue;
        if (kind === 'desert') {
          ctx.fillStyle = 'rgba(120,90,50,0.35)';
          for (let k = 0; k < 4; k++) ctx.fillRect(jx + (rnd() - 0.5) * 10, jy + (rnd() - 0.5) * 10, 1.2, 1.2);
          if (rnd() < 0.3) { ctx.strokeStyle = 'rgba(120,90,50,0.3)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.arc(jx, jy + 4, 5, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); }
        } else if (kind === 'mountain') {
          this.peak(ctx, jx, jy, 5 + rnd() * 4);
        } else if (kind === 'hills') {
          ctx.strokeStyle = 'rgba(90,70,40,0.45)'; ctx.lineWidth = 0.9;
          ctx.beginPath(); ctx.arc(jx, jy + 3, 5, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke();
        } else if (kind === 'forest') {
          ctx.fillStyle = 'rgba(70,90,50,0.55)';
          ctx.beginPath(); ctx.arc(jx, jy, 3, 0, Math.PI * 2); ctx.fill();
          ctx.fillRect(jx - 0.5, jy + 2, 1, 3);
        } else if (kind === 'steppe' || kind === 'plains') {
          ctx.strokeStyle = 'rgba(110,100,50,0.4)'; ctx.lineWidth = 0.7;
          ctx.beginPath(); ctx.moveTo(jx - 2, jy + 2); ctx.lineTo(jx - 1, jy - 2); ctx.moveTo(jx, jy + 2); ctx.lineTo(jx, jy - 3); ctx.moveTo(jx + 2, jy + 2); ctx.lineTo(jx + 1, jy - 2); ctx.stroke();
        } else if (kind === 'river' || kind === 'farmland' || kind === 'oasis') {
          ctx.strokeStyle = 'rgba(100,110,50,0.3)'; ctx.lineWidth = 0.7;
          ctx.beginPath(); ctx.moveTo(jx - 4, jy); ctx.lineTo(jx + 4, jy); ctx.moveTo(jx - 4, jy + 2.5); ctx.lineTo(jx + 4, jy + 2.5); ctx.stroke();
        }
      }
    }
  }

  drawVillages(ctx) {
    const { gw, ids, nP } = this.map;
    const rnd = mulberry32(777);
    ctx.save();
    for (const p of this.map.provinces) {
      const d = PROVINCES[p.index];
      const dens = { farmland: 1, river: 1.1, oasis: 0.8, hills: 0.6, forest: 0.4, mountain: 0.25, steppe: 0.2, desert: 0.08 }[d.terrain] || 0.3;
      const n = Math.round(Math.min(26, d.pop / 18) * dens);
      const [x0, y0, x1, y1] = p.bbox;
      let placed = 0;
      for (let k = 0; k < n * 6 && placed < n; k++) {
        const x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0);
        if (ids[Math.floor(y / CELL) * gw + Math.floor(x / CELL)] !== p.index) continue;
        if (Math.hypot(x - p.x, y - p.y) < 14) continue;
        placed++;
        // kleines Dorf: zwei, drei Häuschen
        const m = 1 + Math.floor(rnd() * 3);
        for (let h = 0; h < m; h++) {
          const hx = x + (rnd() - 0.5) * 5, hy = y + (rnd() - 0.5) * 4;
          ctx.fillStyle = 'rgba(95,70,40,0.55)';
          ctx.fillRect(hx - 1.1, hy - 0.8, 2.2, 1.8);
          ctx.beginPath(); ctx.moveTo(hx - 1.5, hy - 0.8); ctx.lineTo(hx, hy - 2.2); ctx.lineTo(hx + 1.5, hy - 0.8); ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  drawLocalRoads(ctx) {
    ctx.save();
    ctx.strokeStyle = 'rgba(120,85,45,0.38)';
    ctx.lineWidth = 1;
    ctx.setLineDash([1.5, 2.5]);
    for (const p of this.map.provinces) {
      for (const t of this.map.towns?.[p.id] || []) {
        const mx = (p.x + t.x) / 2 + (t.y - p.y) * 0.12, my = (p.y + t.y) / 2 - (t.x - p.x) * 0.12;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.quadraticCurveTo(mx, my, t.x, t.y); ctx.stroke();
      }
    }
    ctx.restore();
  }

  // Ortssymbole
  townGlyph(ctx, type, x, y, s, fill) {
    ctx.fillStyle = fill; ctx.strokeStyle = INK; ctx.lineWidth = 0.9 * s;
    ctx.beginPath();
    switch (type) {
      case 'castle':
        ctx.moveTo(x - 4 * s, y + 3.5 * s); ctx.lineTo(x - 4 * s, y - 3 * s); ctx.lineTo(x - 2.4 * s, y - 3 * s); ctx.lineTo(x - 2.4 * s, y - 1.8 * s);
        ctx.lineTo(x - 0.8 * s, y - 1.8 * s); ctx.lineTo(x - 0.8 * s, y - 3 * s); ctx.lineTo(x + 0.8 * s, y - 3 * s); ctx.lineTo(x + 0.8 * s, y - 1.8 * s);
        ctx.lineTo(x + 2.4 * s, y - 1.8 * s); ctx.lineTo(x + 2.4 * s, y - 3 * s); ctx.lineTo(x + 4 * s, y - 3 * s); ctx.lineTo(x + 4 * s, y + 3.5 * s); ctx.closePath();
        break;
      case 'port':
        ctx.arc(x, y, 3.4 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.strokeStyle = INK; ctx.lineWidth = 0.8 * s;
        ctx.moveTo(x, y - 2.2 * s); ctx.lineTo(x, y + 2.2 * s); ctx.moveTo(x - 1.6 * s, y + 1 * s); ctx.quadraticCurveTo(x, y + 3 * s, x + 1.6 * s, y + 1 * s); ctx.moveTo(x - 1.2 * s, y - 1 * s); ctx.lineTo(x + 1.2 * s, y - 1 * s);
        ctx.stroke(); return;
      case 'mine':
        ctx.moveTo(x - 3.6 * s, y + 3 * s); ctx.lineTo(x, y - 3.4 * s); ctx.lineTo(x + 3.6 * s, y + 3 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.fillStyle = INK; ctx.arc(x, y + 1.2 * s, 1 * s, Math.PI, 0); ctx.fill(); return;
      case 'monastery':
      case 'holy':
        ctx.moveTo(x - 3 * s, y + 3.2 * s); ctx.lineTo(x - 3 * s, y - 0.6 * s); ctx.arc(x, y - 0.6 * s, 3 * s, Math.PI, 0); ctx.lineTo(x + 3 * s, y + 3.2 * s); ctx.closePath();
        ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, y - 3.6 * s); ctx.lineTo(x, y - 5.6 * s); ctx.moveTo(x - 1 * s, y - 4.8 * s); ctx.lineTo(x + 1 * s, y - 4.8 * s); ctx.stroke();
        if (type === 'holy') { ctx.fillStyle = '#c9a227'; ctx.beginPath(); ctx.arc(x, y + 0.8 * s, 1.1 * s, 0, Math.PI * 2); ctx.fill(); }
        return;
      case 'camp':
        ctx.moveTo(x - 4 * s, y + 3 * s); ctx.lineTo(x, y - 3.5 * s); ctx.lineTo(x + 4 * s, y + 3 * s); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x, y - 3.5 * s); ctx.lineTo(x, y - 5.5 * s); ctx.stroke(); return;
      case 'caravan':
        ctx.rect(x - 3.4 * s, y - 3 * s, 6.8 * s, 6 * s); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.fillStyle = 'rgba(245,235,205,0.9)'; ctx.rect(x - 1.5 * s, y - 1.2 * s, 3 * s, 2.4 * s); ctx.fill(); return;
      case 'market':
        ctx.arc(x, y, 3 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.fillStyle = INK; ctx.arc(x, y, 0.9 * s, 0, Math.PI * 2); ctx.fill(); return;
      default: // Stadt: Häusergruppe
        ctx.moveTo(x - 4 * s, y + 3 * s); ctx.lineTo(x - 4 * s, y - 0.5 * s); ctx.lineTo(x - 2 * s, y - 2.5 * s); ctx.lineTo(x, y - 0.5 * s);
        ctx.lineTo(x, y - 1.5 * s); ctx.lineTo(x + 2 * s, y - 3.5 * s); ctx.lineTo(x + 4 * s, y - 1.5 * s); ctx.lineTo(x + 4 * s, y + 3 * s); ctx.closePath();
    }
    ctx.fill(); ctx.stroke();
  }

  drawTowns(ctx, z, g) {
    if (z < 0.7 || !g.townInfo || !this.map.towns) return;
    const s = Math.min(1.6, Math.max(0.7, 1 / z)) ;
    const sel = g.selTown ? g.selTown() : null;
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (const p of this.map.provinces) {
      if (!this.visible(p.id)) continue;
      const pos = this.map.towns[p.id];
      if (!pos || !pos.length) continue;
      const infos = g.townInfo(p.id);
      infos.forEach((ti, i) => {
        const { x, y } = pos[i];
        const k = s * (0.85 + ti.lvl * 0.15);
        if (ti.foreign || ti.mine) {
          ctx.fillStyle = ti.hostile ? 'rgba(180,30,20,0.35)' : 'rgba(255,245,210,0.55)';
          ctx.beginPath(); ctx.arc(x, y, 6.5 * k, 0, Math.PI * 2); ctx.fill();
        }
        if (sel && sel.pid === p.id && sel.i === i) {
          ctx.strokeStyle = '#fff3b0'; ctx.lineWidth = 2 * s; ctx.beginPath(); ctx.arc(x, y, 8 * k, 0, Math.PI * 2); ctx.stroke();
        }
        this.townGlyph(ctx, ti.t, x, y, k, ti.color);
        if (ti.siege) { ctx.font = `bold ${8 * s}px serif`; ctx.fillStyle = '#8b0000'; ctx.fillText('⚔', x + 5 * k, y - 9 * k); }
        if (z >= 1.35) {
          ctx.font = `italic ${8.5 * s / Math.max(1, z * 0.7)}px "EB Garamond", Georgia, serif`;
          ctx.lineWidth = 2.5 / z; ctx.strokeStyle = 'rgba(245,235,205,0.8)';
          const nm = L(ti.name);
          ctx.strokeText(nm, x, y + 4.5 * k);
          ctx.fillStyle = 'rgba(40,28,15,0.9)'; ctx.fillText(nm, x, y + 4.5 * k);
        }
      });
    }
    ctx.restore();
  }

  townAt(wx, wy) {
    if (!this.game?.townInfo || this.cam.z < 0.7 || !this.map.towns) return null;
    const s = Math.min(1.6, Math.max(0.7, 1 / this.cam.z));
    let best = null, bd = 7 * s;
    for (const p of this.map.provinces) {
      const pos = this.map.towns[p.id];
      if (!pos) continue;
      const [x0, y0, x1, y1] = p.bbox;
      if (wx < x0 - 10 || wx > x1 + 10 || wy < y0 - 10 || wy > y1 + 10) continue;
      if (!this.visible(p.id)) continue;
      pos.forEach((t, i) => { const d = Math.hypot(t.x - wx, t.y - wy); if (d < bd) { bd = d; best = { pid: p.id, i }; } });
    }
    return best;
  }

  peak(ctx, x, y, s) {
    ctx.fillStyle = 'rgba(120,95,65,0.35)';
    ctx.beginPath(); ctx.moveTo(x - s, y + s * 0.6); ctx.lineTo(x, y - s * 0.8); ctx.lineTo(x - s * 0.1, y + s * 0.6); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(70,50,30,0.7)'; ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(x - s, y + s * 0.6); ctx.lineTo(x, y - s * 0.8); ctx.lineTo(x + s, y + s * 0.6); ctx.stroke();
  }

  drawRidge(ctx, lonlat) {
    const pts = lonlat.map(([lon, lat]) => project(lon, lat));
    const rnd = mulberry32(pts.length * 13 + Math.round(pts[0][0]));
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
      const len = Math.hypot(x1 - x0, y1 - y0);
      const n = Math.floor(len / 11);
      for (let k = 0; k < n; k++) {
        const t = k / n;
        const x = x0 + (x1 - x0) * t + (rnd() - 0.5) * 8, y = y0 + (y1 - y0) * t + (rnd() - 0.5) * 8;
        const id = this.map.ids[Math.floor(y / CELL) * this.map.gw + Math.floor(x / CELL)];
        if (id === -1) continue;
        this.peak(ctx, x, y, 6 + rnd() * 5);
      }
    }
  }

  drawCompass(ctx, x, y, r) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = INK; ctx.fillStyle = 'rgba(62,47,31,0.8)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(0, 0, r * 0.75, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, r * 0.68, 0, Math.PI * 2); ctx.stroke();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4, len = i % 2 ? r * 0.55 : r;
      ctx.save(); ctx.rotate(a);
      ctx.beginPath(); ctx.moveTo(0, -len); ctx.lineTo(r * 0.1, 0); ctx.lineTo(0, 0); ctx.closePath();
      ctx.fillStyle = 'rgba(62,47,31,0.85)'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, -len); ctx.lineTo(-r * 0.1, 0); ctx.lineTo(0, 0); ctx.closePath();
      ctx.fillStyle = 'rgba(234,220,180,0.9)'; ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    ctx.font = `bold ${r * 0.3}px "Cinzel", serif`; ctx.textAlign = 'center'; ctx.fillStyle = INK;
    ctx.fillText('N', 0, -r - 6);
    ctx.restore();
  }

  buildOutlines() {
    const out = PROVINCES.map(() => new Path2D());
    for (const b of this.map.borders) {
      for (const line of b.lines) {
        const p = new Path2D();
        line.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
        out[b.a].addPath(p);
        if (b.b >= 0) out[b.b].addPath(p);
      }
    }
    return out;
  }

  // ---------- Sichtbarkeit ----------
  visible(pid) { return !this.game?.visible || this.game.visible(pid); }

  regionAt(wx, wy) {
    const { gw, gh, regions } = this.map;
    const cx = Math.max(0, Math.min(gw - 1, Math.floor(wx / CELL))), cy = Math.max(0, Math.min(gh - 1, Math.floor(wy / CELL)));
    return REGION_IDS[regions[cy * gw + cx]] || 'orient';
  }

  regionKnown(wx, wy) {
    if (!this.known) return true;
    return this.known.has(this.regionAt(wx, wy));
  }

  // Terra incognita: Nebel über unbekannten Weltgegenden
  buildFog(known) {
    const { gw, gh, regions } = this.map;
    const S = 4;
    const fw = Math.ceil(gw / S), fh = Math.ceil(gh / S);
    const unknown = REGION_IDS.map((r) => !known.has(r));
    if (!unknown.some(Boolean)) { this.fog = null; return; }
    const mask = document.createElement('canvas');
    mask.width = fw; mask.height = fh;
    const mctx = mask.getContext('2d');
    const img = mctx.createImageData(fw, fh);
    for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) {
      const cx = Math.min(gw - 1, x * S + 2), cy = Math.min(gh - 1, y * S + 2);
      if (unknown[regions[cy * gw + cx]]) img.data[(y * fw + x) * 4 + 3] = 255;
    }
    mctx.putImageData(img, 0, 0);
    const FW = Math.round(WORLD_W / 2), FH = Math.round(WORLD_H / 2);
    const fog = document.createElement('canvas');
    fog.width = FW; fog.height = FH;
    const ctx = fog.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    try { ctx.filter = 'blur(4px)'; } catch (e) { /* ältere Browser */ }
    ctx.drawImage(mask, 0, 0, FW, FH);
    ctx.filter = 'none';
    // Pergamentfarbe in die Maske
    ctx.globalCompositeOperation = 'source-in';
    ctx.fillStyle = '#e6d7ae';
    ctx.fillRect(0, 0, FW, FH);
    // Schraffur und Flecken nur innerhalb des Nebels
    ctx.globalCompositeOperation = 'source-atop';
    const rnd = mulberry32(4242);
    for (let i = 0; i < 60; i++) {
      const x = rnd() * FW, y = rnd() * FH, r = 30 + rnd() * 120;
      const gr = ctx.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, `rgba(140,105,60,${0.05 + rnd() * 0.06})`);
      gr.addColorStop(1, 'rgba(140,105,60,0)');
      ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.strokeStyle = 'rgba(110,80,45,0.10)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let x = -FH; x < FW; x += 9) { ctx.moveTo(x, FH); ctx.lineTo(x + FH, 0); }
    ctx.stroke();
    // dunkler Saum am Rand der bekannten Welt
    ctx.globalCompositeOperation = 'source-over';
    const edge = document.createElement('canvas');
    edge.width = FW; edge.height = FH;
    const ectx = edge.getContext('2d');
    try { ectx.filter = 'blur(10px)'; } catch (e) { /* ältere Browser */ }
    ectx.drawImage(mask, 0, 0, FW, FH);
    ectx.filter = 'none';
    ectx.globalCompositeOperation = 'source-in';
    ectx.fillStyle = 'rgba(90,60,30,0.35)';
    ectx.fillRect(0, 0, FW, FH);
    ectx.globalCompositeOperation = 'destination-out';
    ectx.drawImage(fog, 0, 0);
    ctx.drawImage(edge, 0, 0);
    this.fog = fog;
    this.fogLabels = REGION_IDS.filter((r, i) => unknown[i]).map((r) => ({ r, xy: project(...REGIONS[r].anchor) }));
  }

  drawFogLabels(ctx) {
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const l of this.fogLabels || []) {
      const [x, y] = l.xy;
      ctx.font = 'italic 600 64px "Cinzel", Georgia, serif';
      ctx.fillStyle = 'rgba(95,65,35,0.55)';
      ctx.fillText(spaced(t('reg.incognita').toUpperCase()), x, y);
      ctx.font = 'italic 34px "EB Garamond", Georgia, serif';
      ctx.fillStyle = 'rgba(95,65,35,0.65)';
      ctx.fillText(L(REGIONS[l.r].fog), x, y + 58);
      this.drawCompass(ctx, x, y - 130, 44);
    }
    ctx.restore();
  }

  // ---------- Politische Ebene ----------
  rebuildOverlay(force = false) {
    if (!this.game) return;
    const g = this.game;
    const known = new Set(g.knownRegions ? g.knownRegions() : REGION_IDS);
    const knownSig = [...known].sort().join(',');
    const cols = PROVINCES.map((p) => g.provColor(p.id, this.mode));
    // Nur neu zeichnen, wenn sich Farben, Besitzverhältnisse oder die bekannte Welt geändert haben
    const sig = this.mode + '|' + knownSig + '|' + PROVINCES.map((p, i) => g.owner(p.id) + (cols[i] ? cols[i].join(',') : '')).join(';');
    if (!force && sig === this.overlaySig) return;
    this.overlaySig = sig;
    if (knownSig !== this.fogSig || force) { this.fogSig = knownSig; this.known = known.size >= REGION_IDS.length ? null : known; this.buildFog(known); }
    const { gw, gh, ids, nP } = this.map;
    const small = document.createElement('canvas');
    small.width = gw; small.height = gh;
    const sctx = small.getContext('2d');
    const img = sctx.createImageData(gw, gh);
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      if (id < 0 || id >= nP) continue;
      const c = cols[id];
      if (!c) continue;
      img.data[i * 4] = c[0]; img.data[i * 4 + 1] = c[1]; img.data[i * 4 + 2] = c[2]; img.data[i * 4 + 3] = c[3];
    }
    sctx.putImageData(img, 0, 0);
    const ctx = this.overlay.getContext('2d');
    ctx.clearRect(0, 0, WORLD_W, WORLD_H);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(small, 0, 0, gw * CELL, gh * CELL);
    // Grenzen
    const provOwner = PROVINCES.map((p) => g.owner(p.id));
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const thin = new Path2D(), thick = new Path2D(), waste = new Path2D();
    for (const b of this.map.borders) {
      const target = b.b === -2 ? waste : provOwner[b.a] !== provOwner[b.b] ? thick : thin;
      for (const line of b.lines) line.forEach(([x, y], i) => (i ? target.lineTo(x, y) : target.moveTo(x, y)));
    }
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = 'rgba(70,52,32,0.55)'; ctx.lineWidth = 0.9; ctx.stroke(thin);
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(90,70,45,0.55)'; ctx.lineWidth = 1.1; ctx.stroke(waste);
    if (this.mode === 'political' || this.mode === 'diplomacy') {
      ctx.strokeStyle = 'rgba(255,248,225,0.35)'; ctx.lineWidth = 5; ctx.stroke(thick);
    }
    ctx.strokeStyle = 'rgba(50,34,20,0.85)'; ctx.lineWidth = 2.2; ctx.stroke(thick);
    this.computeFactionLabels(provOwner);
    // Grundkarte und Ebene zu einem Bild zusammenfassen (ein drawImage pro Frame)
    if (!this.composite) { this.composite = document.createElement('canvas'); this.composite.width = WORLD_W; this.composite.height = WORLD_H; }
    const cctx = this.composite.getContext('2d');
    cctx.drawImage(this.base, 0, 0);
    cctx.drawImage(this.overlay, 0, 0);
    if (this.fog) {
      cctx.imageSmoothingEnabled = true;
      // leicht durchscheinend: wie auf alten Karten ahnt man die Umrisse der fernen Länder
      cctx.globalAlpha = 0.9;
      cctx.drawImage(this.fog, 0, 0, WORLD_W, WORLD_H);
      cctx.globalAlpha = 1;
      this.drawFogLabels(cctx);
    }
    this.invalidate();
  }

  computeFactionLabels(provOwner) {
    const groups = {};
    this.map.provinces.forEach((p, i) => {
      const o = provOwner[i];
      if (!o || o === 'rebels' || !this.visible(p.id)) return;
      (groups[o] = groups[o] || []).push(p);
    });
    this.facLabels = [];
    for (const [fid, list] of Object.entries(groups)) {
      // größte zusammenhängende Gruppe
      const set = new Set(list.map((p) => p.id));
      const seen = new Set();
      let best = [];
      for (const p of list) {
        if (seen.has(p.id)) continue;
        const comp = [];
        const q = [p.id]; seen.add(p.id);
        while (q.length) {
          const c = q.shift(); comp.push(c);
          for (const n of this.map.provIndex[c].neighbors) if (set.has(n) && !seen.has(n)) { seen.add(n); q.push(n); }
        }
        if (comp.length > best.length) best = comp;
      }
      let ax = 0, ay = 0, w = 0, minx = Infinity, maxx = -Infinity;
      for (const pid of best) {
        const p = this.map.provIndex[pid];
        ax += p.lx * p.area; ay += p.ly * p.area; w += p.area;
        minx = Math.min(minx, p.bbox[0]); maxx = Math.max(maxx, p.bbox[2]);
      }
      if (!w) continue;
      this.facLabels.push({ fid, x: ax / w, y: ay / w, width: maxx - minx, area: w, n: best.length });
    }
  }

  // ---------- Zeichnen ----------
  draw() {
    const ctx = this.ctx;
    const { x, y, z } = this.cam;
    const dpr = this.dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#2b2118';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(z * dpr, 0, 0, z * dpr, -x * z * dpr, -y * z * dpr);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.composite || this.base, 0, 0);
    if (!this.game) return;
    const g = this.game;
    // Auswahl
    if (this.hoverProv && this.hoverProv !== this.sel.prov) {
      const i = this.map.provIndex[this.hoverProv].index;
      ctx.strokeStyle = 'rgba(255,250,220,0.6)'; ctx.lineWidth = 2.5 / z; ctx.stroke(this.provOutline[i]);
    }
    if (this.sel.prov) {
      const i = this.map.provIndex[this.sel.prov].index;
      ctx.save();
      ctx.shadowColor = 'rgba(255,230,120,0.9)'; ctx.shadowBlur = 8;
      ctx.strokeStyle = '#fff3b0'; ctx.lineWidth = 3 / z; ctx.stroke(this.provOutline[i]);
      ctx.restore();
    }
    if (this.mode === 'trade') this.drawRoutes(ctx, z);
    this.drawLabels(ctx, z, g);
    this.drawTowns(ctx, z, g);
    this.drawCities(ctx, z, g);
    this.drawPreview(ctx, z);
    this.drawArmies(ctx, z, g);
    // Namen der Meere und Wüsten
    this.drawGeoLabels(ctx, z);
  }

  drawGeoLabels(ctx, z) {
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const w of WATER) {
      if (!w.name || !w.label) continue;
      const [x, y] = project(...w.label);
      if (!this.regionKnown(x, y)) continue;
      ctx.font = `italic ${Math.max(14, 13 / z)}px "EB Garamond", Georgia, serif`;
      ctx.fillStyle = 'rgba(40,70,80,0.75)';
      ctx.fillText(spaced(L(w.name)), x, y);
    }
    if (z > 0.45) {
      for (const w of WASTELANDS) {
        if (!w.n) continue;
        const [x, y] = project(w.lon, w.lat);
        if (!this.regionKnown(x, y)) continue;
        ctx.font = `italic ${11 / z}px "EB Garamond", Georgia, serif`;
        ctx.fillStyle = 'rgba(90,65,35,0.7)';
        ctx.fillText(L(w.n), x, y);
      }
    }
    ctx.restore();
  }

  drawRoutes(ctx, z) {
    ctx.save();
    ctx.lineWidth = 2.5 / z;
    ctx.setLineDash([8 / z, 5 / z]);
    for (const r of TRADE_ROUTES) {
      ctx.strokeStyle = r.id.startsWith('silk') ? 'rgba(160,40,30,0.85)' : 'rgba(110,70,20,0.75)';
      ctx.beginPath();
      let prev = null;
      for (const pid of r.path) {
        const p = this.map.provIndex[pid];
        const vis = this.visible(pid);
        if (vis && prev) ctx.lineTo(p.x, p.y); else if (vis) ctx.moveTo(p.x, p.y);
        prev = vis ? p : null;
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  drawLabels(ctx, z, g) {
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (z < 0.62 && this.facLabels) {
      for (const l of this.facLabels) {
        const name = g.facShortName(l.fid);
        if (!name) continue;
        let size = Math.min(46, Math.max(12, Math.sqrt(l.area) * 0.9 / Math.max(1, name.length * 0.18)));
        if (l.n === 1) size = Math.min(size, 16);
        if (size * z < 7) continue;
        ctx.font = `600 ${size}px "Cinzel", Georgia, serif`;
        ctx.lineWidth = size / 5; ctx.strokeStyle = 'rgba(245,235,205,0.75)';
        ctx.strokeText(name.toUpperCase(), l.x, l.y);
        ctx.fillStyle = 'rgba(45,30,18,0.9)';
        ctx.fillText(name.toUpperCase(), l.x, l.y);
      }
    } else {
      if (z < 1.15) {
        ctx.save();
        for (const r of REGION_LABELS) {
          const [x, y] = project(r.lon, r.lat);
          if (!this.regionKnown(x, y)) continue;
          ctx.save();
          ctx.translate(x, y); ctx.rotate((r.rot * Math.PI) / 180);
          ctx.font = `italic 600 ${r.size}px "Cinzel", Georgia, serif`;
          ctx.fillStyle = 'rgba(80,55,30,0.16)';
          ctx.fillText(spaced(L(r.n).toUpperCase()), 0, 0);
          ctx.restore();
        }
        ctx.restore();
      }
      const fs = 11.5 / z;
      ctx.font = `600 ${fs}px "Cinzel", Georgia, serif`;
      for (const p of this.map.provinces) {
        if (!this.visible(p.id)) continue;
        const name = L(PROVINCES[p.index].n);
        ctx.lineWidth = fs / 4; ctx.strokeStyle = 'rgba(245,235,205,0.8)';
        ctx.strokeText(name, p.lx, p.ly + 16 / z);
        ctx.fillStyle = 'rgba(45,30,18,0.92)';
        ctx.fillText(name, p.lx, p.ly + 16 / z);
      }
    }
    ctx.restore();
  }

  drawCities(ctx, z, g) {
    const s = 1 / z;
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (const p of this.map.provinces) {
      if (!this.visible(p.id)) continue;
      const info = g.cityInfo(p.id);
      const col = info.color;
      const r = (4 + Math.min(5, info.pop / 70)) * Math.max(0.6, Math.min(1.3, z * 1.2)) * s;
      // Mauern als Zinnenring
      ctx.fillStyle = col;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.2 * s;
      ctx.beginPath();
      if (info.walls >= 2) {
        const n = 8;
        for (let k = 0; k < n * 2; k++) {
          const a = (k / (n * 2)) * Math.PI * 2;
          const rr = k % 2 ? r : r * 1.28;
          ctx.lineTo(p.x + Math.cos(a) * rr, p.y + Math.sin(a) * rr);
        }
        ctx.closePath();
      } else ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,248,230,0.9)';
      ctx.beginPath(); ctx.arc(p.x, p.y, r * 0.38, 0, Math.PI * 2); ctx.fill();
      if (info.capital) {
        ctx.fillStyle = '#c9a227'; ctx.strokeStyle = INK; ctx.lineWidth = 0.8 * s;
        const cy = p.y - r - 5 * s;
        ctx.beginPath();
        ctx.moveTo(p.x - 5 * s, cy + 3 * s); ctx.lineTo(p.x - 5 * s, cy - 2 * s); ctx.lineTo(p.x - 2.5 * s, cy + 0.5 * s);
        ctx.lineTo(p.x, cy - 3.5 * s); ctx.lineTo(p.x + 2.5 * s, cy + 0.5 * s); ctx.lineTo(p.x + 5 * s, cy - 2 * s); ctx.lineTo(p.x + 5 * s, cy + 3 * s);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      if (info.holy) {
        ctx.fillStyle = '#2e7d32'; ctx.font = `${9 * s}px serif`; ctx.fillText('✦', p.x + r + 4 * s, p.y - r - 2 * s);
      }
      if (info.siege) {
        ctx.font = `bold ${12 * s}px serif`; ctx.fillStyle = '#8b0000';
        ctx.fillText('⚔', p.x - r - 7 * s, p.y - r - 6 * s);
      }
      if (info.plague) {
        ctx.font = `bold ${12 * s}px serif`; ctx.fillStyle = '#5b2a86';
        ctx.fillText('☠', p.x + r + 4 * s, p.y + 1 * s);
      }
      if (info.famine) {
        ctx.font = `${10 * s}px serif`; ctx.fillStyle = '#8a5a00';
        ctx.fillText('⚠', p.x - r - 8 * s, p.y + 1 * s);
      }
      if (info.revolt) {
        ctx.font = `bold ${11 * s}px serif`; ctx.fillStyle = '#b03a2e';
        ctx.fillText('!', p.x + r + 3 * s, p.y - 4 * s);
      }
      if (info.pop > 200) {
        ctx.strokeStyle = INK; ctx.lineWidth = 0.9 * s;
        ctx.beginPath(); ctx.arc(p.x, p.y, r * 1.65, 0, Math.PI * 2); ctx.stroke();
      }
      if (z >= 0.95 && g.specialties) {
        const icons = g.specialties(p.id).map((sp) => sp.icon);
        if (icons.length) {
          ctx.font = `${8.5 * s}px serif`;
          ctx.fillStyle = 'rgba(40,28,15,0.9)';
          ctx.fillText(icons.join(''), p.x, p.y + r + (z >= 1.25 ? 13 : 2) * s);
        }
      }
      if (z >= 1.25) {
        ctx.font = `italic ${10 * s}px "EB Garamond", Georgia, serif`;
        ctx.fillStyle = 'rgba(40,28,15,0.85)';
        ctx.fillText(L(PROVINCES[p.index].city), p.x, p.y + r + 2 * s);
      }
    }
    ctx.restore();
  }

  armyScreenSlots() {
    // Weltpositionen der Heersymbole
    const g = this.game;
    const out = [];
    const byProv = {};
    for (const a of g.armies()) if (this.visible(a.prov)) (byProv[a.prov] = byProv[a.prov] || []).push(a);
    const s = 1 / this.cam.z;
    for (const [pid, list] of Object.entries(byProv)) {
      const p = this.map.provIndex[pid];
      list.sort((a, b) => (a.fac === g.player ? -1 : 0) - (b.fac === g.player ? -1 : 0));
      list.forEach((a, k) => {
        const ox = (14 + (k % 4) * 16) * s, oy = (-10 - Math.floor(k / 4) * 22) * s;
        out.push({ a, x: p.x + ox, y: p.y + oy });
      });
    }
    return out;
  }

  drawArmies(ctx, z, g) {
    const s = 1 / z;
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (const slot of this.armyScreenSlots()) {
      const { a, x, y } = slot;
      const col = g.facColor(a.fac);
      const sel = this.sel.army === a.id;
      // Stange
      ctx.strokeStyle = INK; ctx.lineWidth = 1.4 * s;
      ctx.beginPath(); ctx.moveTo(x, y + 12 * s); ctx.lineTo(x, y - 12 * s); ctx.stroke();
      // Fahne (Schwalbenschwanz)
      ctx.fillStyle = col; ctx.lineWidth = 1 * s;
      ctx.beginPath();
      ctx.moveTo(x, y - 12 * s); ctx.lineTo(x + 13 * s, y - 12 * s); ctx.lineTo(x + 9 * s, y - 7 * s); ctx.lineTo(x + 13 * s, y - 2 * s); ctx.lineTo(x, y - 2 * s);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      if (a.gen) { ctx.fillStyle = '#f4e6b8'; ctx.beginPath(); ctx.arc(x + 5 * s, y - 7 * s, 1.8 * s, 0, Math.PI * 2); ctx.fill(); }
      // Spitze
      ctx.fillStyle = '#c9a227'; ctx.beginPath(); ctx.arc(x, y - 13 * s, 1.8 * s, 0, Math.PI * 2); ctx.fill();
      if (sel) {
        ctx.strokeStyle = '#fff3b0'; ctx.lineWidth = 2.2 * s;
        ctx.beginPath(); ctx.arc(x + 4 * s, y - 2 * s, 14 * s, 0, Math.PI * 2); ctx.stroke();
      }
      // Stärke
      const txt = g.armyMenText(a);
      ctx.font = `bold ${9 * s}px "EB Garamond", Georgia, serif`;
      const w = ctx.measureText(txt).width + 4 * s;
      ctx.fillStyle = a.fac === g.player ? 'rgba(255,245,210,0.92)' : 'rgba(40,28,15,0.8)';
      ctx.fillRect(x - w / 2, y + 12 * s, w, 10 * s);
      ctx.fillStyle = a.fac === g.player ? INK : '#f4e6b8';
      ctx.fillText(txt, x, y + 12.5 * s);
      if (a.raid) { ctx.fillStyle = '#b03a2e'; ctx.font = `bold ${10 * s}px serif`; ctx.fillText('🔥', x - 8 * s, y - 14 * s); }
      if (a.stance && a.stance !== 'normal') { ctx.font = `${9 * s}px serif`; ctx.fillText({ forced: '💨', intercept: '👁', fortify: '🛡' }[a.stance] || '', x + 17 * s, y - 14 * s); }
      if (a.fac === g.player && a.mp > 0.01 && !(a.path && a.path.length)) {
        ctx.fillStyle = '#2e7d32'; ctx.beginPath(); ctx.arc(x - 4 * s, y - 10 * s, 2.2 * s, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  }

  drawPreview(ctx, z) {
    const s = 1 / z;
    const draw = (from, path, marks, color) => {
      if (!path || !path.length) return;
      ctx.save();
      ctx.strokeStyle = color; ctx.lineWidth = 2.5 * s; ctx.setLineDash([7 * s, 5 * s]);
      ctx.beginPath();
      const p0 = this.map.provIndex[from];
      ctx.moveTo(p0.x, p0.y);
      for (const pid of path) { const p = this.map.provIndex[pid]; ctx.lineTo(p.x, p.y); }
      ctx.stroke();
      ctx.setLineDash([]);
      path.forEach((pid, i) => {
        const p = this.map.provIndex[pid];
        const last = i === path.length - 1 || (marks && marks[i + 1] !== marks[i]);
        if (!last) return;
        ctx.fillStyle = color; ctx.beginPath(); ctx.arc(p.x, p.y, 7 * s, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = `bold ${9 * s}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(marks ? marks[i] : ''), p.x, p.y + 0.5 * s);
      });
      ctx.restore();
    };
    const g = this.game;
    // Bestehende Marschbefehle eigener Heere
    for (const a of g.armies()) {
      if (a.fac !== g.player || !a.path || !a.path.length) continue;
      if (this.preview && this.preview.army === a.id) continue;
      draw(a.prov, a.path, g.pathMarks(a, a.path), 'rgba(40,90,40,0.75)');
    }
    if (this.preview) draw(this.preview.from, this.preview.path, this.preview.marks, this.preview.ok ? 'rgba(20,110,30,0.9)' : 'rgba(150,30,20,0.9)');
    // Wegpunkte (Etappen) markieren
    const wps = this.preview?.waypoints || [];
    wps.slice(0, -1).forEach((w, i) => {
      const p = this.map.provIndex[w];
      ctx.save();
      ctx.fillStyle = '#c9a227'; ctx.strokeStyle = '#3e2f1f'; ctx.lineWidth = 1.2 * s;
      ctx.beginPath(); ctx.moveTo(p.x, p.y - 9 * s); ctx.lineTo(p.x + 7 * s, p.y); ctx.lineTo(p.x, p.y + 9 * s); ctx.lineTo(p.x - 7 * s, p.y); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#2b1d0e'; ctx.font = `bold ${8 * s}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(i + 1), p.x, p.y + 0.5 * s);
      ctx.restore();
    });
    // Marschspuren fremder Heere aus der letzten Runde
    for (const a of g.armies()) {
      const tr = a.trail;
      if (!tr || a.fac === g.player || tr.turn !== g.turn - 1 || tr.provs.length < 2) continue;
      if (!tr.provs.every((pid) => this.visible(pid))) continue;
      const hostile = g.hostile(a.fac);
      if (!hostile && this.cam.z < 0.8) continue;
      ctx.save();
      ctx.strokeStyle = hostile ? 'rgba(170,25,20,0.8)' : 'rgba(80,60,40,0.45)';
      ctx.lineWidth = (hostile ? 2.4 : 1.4) * s; ctx.setLineDash([3 * s, 4 * s]);
      const pts = tr.provs.map((pid) => this.map.provIndex[pid]);
      ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y);
      for (const p of pts.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.stroke(); ctx.setLineDash([]);
      const [p1, p2] = [pts[pts.length - 2], pts[pts.length - 1]];
      const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const hx = p2.x - Math.cos(ang) * 10 * s, hy = p2.y - Math.sin(ang) * 10 * s;
      ctx.fillStyle = ctx.strokeStyle;
      ctx.beginPath(); ctx.moveTo(hx + Math.cos(ang) * 8 * s, hy + Math.sin(ang) * 8 * s);
      ctx.lineTo(hx + Math.cos(ang + 2.5) * 7 * s, hy + Math.sin(ang + 2.5) * 7 * s);
      ctx.lineTo(hx + Math.cos(ang - 2.5) * 7 * s, hy + Math.sin(ang - 2.5) * 7 * s); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // gezogenes Heer
    if (this.dragPos) {
      ctx.save(); ctx.globalAlpha = 0.6; ctx.fillStyle = '#fff3b0'; ctx.strokeStyle = '#3e2f1f'; ctx.lineWidth = 1.5 * s;
      ctx.beginPath(); ctx.arc(this.dragPos[0], this.dragPos[1], 9 * s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.font = `${11 * s}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#3e2f1f'; ctx.fillText('⚑', this.dragPos[0], this.dragPos[1]);
      ctx.restore();
    }
  }

  // ---------- Kamera & Eingabe ----------
  worldAt(sx, sy) { return [sx / this.cam.z + this.cam.x, sy / this.cam.z + this.cam.y]; }

  provinceAt(wx, wy) {
    const { gw, gh, ids, nP } = this.map;
    const cx = Math.floor(wx / CELL), cy = Math.floor(wy / CELL);
    if (cx < 0 || cy < 0 || cx >= gw || cy >= gh) return null;
    const id = ids[cy * gw + cx];
    if (id >= 0 && id < nP && this.visible(PROVINCES[id].id)) return PROVINCES[id].id;
    return null;
  }

  armyAt(wx, wy) {
    if (!this.game) return null;
    const s = 1 / this.cam.z;
    let best = null, bd = 16 * s;
    for (const slot of this.armyScreenSlots()) {
      const d = Math.hypot(slot.x + 4 * s - wx, slot.y - 4 * s - wy);
      if (d < bd) { bd = d; best = slot.a; }
    }
    return best;
  }

  clampCam() {
    const minZ = Math.min(this.vw / WORLD_W, this.vh / WORLD_H) * 0.95;
    this.cam.z = Math.max(minZ, Math.min(4, this.cam.z));
    const vwW = this.vw / this.cam.z, vhW = this.vh / this.cam.z;
    const mx = Math.max(0, WORLD_W - vwW), my = Math.max(0, WORLD_H - vhW);
    this.cam.x = WORLD_W < vwW ? (WORLD_W - vwW) / 2 : Math.max(0, Math.min(mx, this.cam.x));
    this.cam.y = WORLD_H < vhW ? (WORLD_H - vhW) / 2 : Math.max(0, Math.min(my, this.cam.y));
  }

  zoomAt(sx, sy, f) {
    const [wx, wy] = this.worldAt(sx, sy);
    this.cam.z *= f;
    this.clampCam();
    this.cam.x = wx - sx / this.cam.z;
    this.cam.y = wy - sy / this.cam.z;
    this.clampCam();
    this.invalidate();
  }

  centerOn(pid, zoom) {
    const p = this.map.provIndex[pid];
    if (!p) return;
    if (zoom) this.cam.z = zoom;
    this.cam.x = p.x - this.vw / 2 / this.cam.z;
    this.cam.y = p.y - this.vh / 2 / this.cam.z;
    this.clampCam();
    this.invalidate();
  }

  bindInput() {
    const c = this.canvas;
    const pointers = new Map();
    let drag = null, pinch = null;
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    c.addEventListener('pointerdown', (e) => {
      c.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      if (pointers.size === 1) {
        drag = { sx: e.offsetX, sy: e.offsetY, cx: this.cam.x, cy: this.cam.y, moved: false, button: e.button };
        // Eigenes Heer greifen: Ziehen statt Karte verschieben
        if (e.button === 0 && this.game) {
          const [wx, wy] = this.worldAt(e.offsetX, e.offsetY);
          const a = this.armyAt(wx, wy);
          if (a && a.fac === this.game.player) drag.army = a;
        }
      }
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: this.cam.z };
        drag = null;
      }
    });
    c.addEventListener('pointermove', (e) => {
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      if (pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        const target = pinch.z * (d / pinch.d);
        this.zoomAt(mx, my, target / this.cam.z);
        return;
      }
      if (drag) {
        const dx = e.offsetX - drag.sx, dy = e.offsetY - drag.sy;
        if (Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true;
        if (drag.moved && drag.army) {
          const [wx, wy] = this.worldAt(e.offsetX, e.offsetY);
          this.dragPos = [wx, wy];
          this.emit('armyDrag', drag.army, this.provinceAt(wx, wy));
          this.invalidate();
          return;
        }
        if (drag.moved) {
          this.cam.x = drag.cx - dx / this.cam.z;
          this.cam.y = drag.cy - dy / this.cam.z;
          this.clampCam();
          this.invalidate();
        }
        return;
      }
      const [wx, wy] = this.worldAt(e.offsetX, e.offsetY);
      const pid = this.provinceAt(wx, wy);
      if (pid !== this.hoverProv) { this.hoverProv = pid; this.invalidate(); }
      const town = this.townAt(wx, wy);
      const tkey = town ? town.pid + ':' + town.i : null;
      if (tkey !== this.hoverTown) { this.hoverTown = tkey; }
      this.emit('hover', pid, e.clientX, e.clientY, this.armyAt(wx, wy), town);
    });
    const up = (e) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (drag && drag.moved && drag.army) {
        const [wx, wy] = this.worldAt(e.offsetX, e.offsetY);
        this.dragPos = null;
        this.emit('armyDrop', drag.army, this.provinceAt(wx, wy));
      }
      if (drag && !drag.moved) {
        const [wx, wy] = this.worldAt(e.offsetX, e.offsetY);
        const army = this.armyAt(wx, wy);
        const pid = this.provinceAt(wx, wy);
        if (drag.button === 2) this.emit('rightclick', { army, prov: pid });
        else this.emit('click', { army, prov: pid, shift: e.shiftKey, town: army ? null : this.townAt(wx, wy) });
      }
      drag = null;
    };
    c.addEventListener('pointerup', up);
    c.addEventListener('pointercancel', (e) => { pointers.delete(e.pointerId); drag = null; pinch = null; });
    c.addEventListener('pointerleave', () => { if (this.hoverProv) { this.hoverProv = null; this.invalidate(); } this.emit('hover', null); });
    c.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoomAt(e.offsetX, e.offsetY, Math.exp(-e.deltaY * 0.0015));
    }, { passive: false });
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const step = 60 / this.cam.z;
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') this.cam.x -= step;
      else if (k === 'arrowright' || k === 'd') this.cam.x += step;
      else if (k === 'arrowup' || k === 'w') this.cam.y -= step;
      else if (k === 'arrowdown' || k === 's') this.cam.y += step;
      else if (k === '+' || k === '=') { this.zoomAt(this.vw / 2, this.vh / 2, 1.2); return; }
      else if (k === '-') { this.zoomAt(this.vw / 2, this.vh / 2, 1 / 1.2); return; }
      else return;
      this.clampCam(); this.invalidate();
    });
  }
}

function spaced(s) { return s.split('').join(' '); }

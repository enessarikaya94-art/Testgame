// Darstellung der Kampagnenkarte im Stil einer alten Pergamentkarte.

import { WORLD_W, WORLD_H, project, WATER, ISLANDS, RIVERS, MOUNTAINS, WASTELANDS } from '../data/geo.js';
import { PROVINCES } from '../data/provinces.js';
import { TERRAINS, RELIGIONS, CULTURES, TRADE_ROUTES } from '../data/world.js';
import { CELL } from './mapgen.js';
import { mulberry32, hexToRgb } from '../util.js';
import { L } from '../i18n.js';

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
    // Kompassrose
    this.drawCompass(ctx, ...project(64.5, 15.5), 70);
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

  // ---------- Politische Ebene ----------
  rebuildOverlay(force = false) {
    if (!this.game) return;
    const g = this.game;
    const cols = PROVINCES.map((p) => g.provColor(p.id, this.mode));
    // Nur neu zeichnen, wenn sich Farben oder Besitzverhältnisse geändert haben
    const sig = this.mode + '|' + PROVINCES.map((p, i) => g.owner(p.id) + (cols[i] ? cols[i].join(',') : '')).join(';');
    if (!force && sig === this.overlaySig) return;
    this.overlaySig = sig;
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
    this.invalidate();
  }

  computeFactionLabels(provOwner) {
    const groups = {};
    this.map.provinces.forEach((p, i) => {
      const o = provOwner[i];
      if (!o || o === 'rebels') return;
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
      ctx.font = `italic ${Math.max(14, 13 / z)}px "EB Garamond", Georgia, serif`;
      ctx.fillStyle = 'rgba(40,70,80,0.75)';
      ctx.fillText(spaced(L(w.name)), x, y);
    }
    if (z > 0.45) {
      for (const w of WASTELANDS) {
        if (!w.n) continue;
        const [x, y] = project(w.lon, w.lat);
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
      r.path.forEach((pid, i) => { const p = this.map.provIndex[pid]; if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); });
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
      const fs = 11.5 / z;
      ctx.font = `600 ${fs}px "Cinzel", Georgia, serif`;
      for (const p of this.map.provinces) {
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
    for (const a of g.armies()) (byProv[a.prov] = byProv[a.prov] || []).push(a);
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
  }

  // ---------- Kamera & Eingabe ----------
  worldAt(sx, sy) { return [sx / this.cam.z + this.cam.x, sy / this.cam.z + this.cam.y]; }

  provinceAt(wx, wy) {
    const { gw, gh, ids, nP } = this.map;
    const cx = Math.floor(wx / CELL), cy = Math.floor(wy / CELL);
    if (cx < 0 || cy < 0 || cx >= gw || cy >= gh) return null;
    const id = ids[cy * gw + cx];
    if (id >= 0 && id < nP) return PROVINCES[id].id;
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
    this.cam.z = Math.max(minZ, Math.min(3, this.cam.z));
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
      if (pointers.size === 1) drag = { sx: e.offsetX, sy: e.offsetY, cx: this.cam.x, cy: this.cam.y, moved: false, button: e.button };
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
      this.emit('hover', pid, e.clientX, e.clientY);
    });
    const up = (e) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (drag && !drag.moved) {
        const [wx, wy] = this.worldAt(e.offsetX, e.offsetY);
        const army = this.armyAt(wx, wy);
        const pid = this.provinceAt(wx, wy);
        if (drag.button === 2) this.emit('rightclick', { army, prov: pid });
        else this.emit('click', { army, prov: pid, shift: e.shiftKey });
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

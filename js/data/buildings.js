// Gebäude. Jede Linie hat bis zu 3 Stufen.
// tech: benötigte Technologie je Stufe (Index = Stufe-1)

import { RELIGIONS } from './world.js';

export const BUILDINGS = {
  walls: {
    icon: '🏰',
    n: [
      { de: 'Palisade', tr: 'Ahşap Çit' },
      { de: 'Steinmauern', tr: 'Taş Surlar' },
      { de: 'Zitadelle', tr: 'İç Kale' },
    ],
    desc: { de: 'Befestigung der Stadt. Verlängert Belagerungen und erschwert Sturmangriffe.', tr: 'Şehir tahkimatı. Kuşatmaları uzatır, hücumları zorlaştırır.' },
    cost: [60, 140, 260], turns: [2, 3, 4], tech: [null, null, 'fortification'],
    eff: { walls: 1, order: 1 },
  },
  market: {
    icon: '⚖',
    n: [
      { de: 'Markt', tr: 'Pazar' },
      { de: 'Basar', tr: 'Çarşı' },
      { de: 'Großer Basar', tr: 'Büyük Çarşı' },
    ],
    desc: { de: 'Steigert Steuern und Handelseinnahmen.', tr: 'Vergi ve ticaret gelirini artırır.' },
    cost: [50, 120, 220], turns: [1, 2, 3], tech: [null, null, 'bazaar'],
    eff: { tax: 0.2, trade: 0.25, cap: 0.05 },
  },
  caravanserai: {
    icon: '🐫',
    n: [
      { de: 'Rasthaus', tr: 'Han' },
      { de: 'Karawanserei', tr: 'Kervansaray' },
      { de: 'Sultans-Karawanserei', tr: 'Sultan Hanı' },
    ],
    desc: { de: 'Steigert die Einnahmen aus Handelsrouten, die durch die Provinz führen.', tr: 'Eyaletten geçen ticaret yollarının gelirini artırır.' },
    cost: [40, 110, 200], turns: [1, 2, 3], tech: [null, 'caravanserai', 'sakk'],
    eff: { route: 0.6, goods: 0.05 },
  },
  irrigation: {
    icon: '💧',
    n: [
      { de: 'Kanäle', tr: 'Kanallar' },
      { de: 'Kanate', tr: 'Kârizler' },
      { de: 'Windmühlen & Dämme', tr: 'Yel Değirmenleri ve Bentler' },
    ],
    desc: { de: 'Mehr Ernte: höhere Bevölkerungsgrenze, Wachstum und Steuern.', tr: 'Daha fazla hasat: nüfus sınırı, büyüme ve vergi artar.' },
    cost: [50, 120, 200], turns: [2, 2, 3], tech: [null, 'qanat', 'windmill'],
    eff: { cap: 0.2, growth: 0.0015, tax: 0.08 },
  },
  temple: {
    icon: '✧',
    n: null, // abhängig von der Religion
    desc: { de: 'Religiöses Zentrum der Staatsreligion. Fördert Ordnung und Bekehrung.', tr: 'Devlet dininin merkezi. Asayişi ve din değiştirmeyi destekler.' },
    cost: [50, 120, 220], turns: [1, 2, 3], tech: [null, null, 'architecture'],
    eff: { order: 4, convert: 0.004 },
  },
  school: {
    icon: '📚',
    n: null,
    desc: { de: 'Gelehrte erzeugen Forschungspunkte.', tr: 'Âlimler araştırma puanı üretir.' },
    cost: [60, 140, 260], turns: [2, 3, 3], tech: [null, 'madrasa', 'astronomy'],
    eff: { research: 1, order: 1 },
  },
  barracks: {
    icon: '⚔',
    n: [
      { de: 'Wachhaus', tr: 'Karakol' },
      { de: 'Kaserne', tr: 'Kışla' },
      { de: 'Arsenal', tr: 'Cebehane' },
    ],
    desc: { de: 'Ermöglicht Fußtruppen, Garde und Belagerungsgerät. Stärkt die Garnison.', tr: 'Piyade, muhafız ve kuşatma aletleri sağlar. Garnizonu güçlendirir.' },
    cost: [40, 110, 200], turns: [1, 2, 3], tech: [null, null, null],
    eff: { garrison: 1 },
  },
  stables: {
    icon: '🐎',
    n: [
      { de: 'Stallungen', tr: 'Ahırlar' },
      { de: 'Gestüt', tr: 'Hara' },
      { de: 'Königliches Gestüt', tr: 'Has Ahır' },
    ],
    desc: { de: 'Ermöglicht Reiterei und züchtet Pferde.', tr: 'Süvari sağlar ve at yetiştirir.' },
    cost: [50, 120, 220], turns: [1, 2, 3], tech: [null, null, 'horse_breeding'],
    eff: { horses: 1.5 },
  },
  ordu: {
    icon: '⛺',
    n: [
      { de: 'Jurtenlager', tr: 'Yurt Obası' },
      { de: 'Ordu', tr: 'Ordu' },
      { de: 'Große Ordu', tr: 'Ordu-Balık' },
    ],
    desc: { de: 'Das Zeltlager des Stammes (nur Nomaden und Sultanate). Reiterkrieger, Weideerträge und Stammestreue.', tr: 'Boyun çadır karargâhı (yalnızca göçebeler ve sultanlıklar). Atlı savaşçılar, otlak geliri ve boy sadakati.' },
    cost: [30, 90, 180], turns: [1, 2, 2], tech: [null, null, 'kurultai'],
    eff: { pasture: 0.4, order: 2, horses: 1 }, govs: ['nomad', 'sultanate'],
  },
  workshop: {
    icon: '⚒',
    n: [
      { de: 'Werkstätten', tr: 'Atölyeler' },
      { de: 'Handwerkerviertel', tr: 'Esnaf Mahallesi' },
      { de: 'Manufakturen', tr: 'İmalathaneler' },
    ],
    desc: { de: 'Veredelt die Handelsgüter der Provinz.', tr: 'Eyaletin ticaret mallarını işler.' },
    cost: [60, 140, 240], turns: [2, 2, 3], tech: [null, 'paper', 'mathematics'],
    eff: { goods: 0.4, tax: 0.1 },
  },
  palace: {
    icon: '🏛',
    n: [
      { de: 'Statthalterei', tr: 'Valilik' },
      { de: 'Diwan', tr: 'Divan' },
      { de: 'Palastbezirk', tr: 'Saray Külliyesi' },
    ],
    desc: { de: 'Sitz der Verwaltung. Mehr Ordnung und Steuern, weniger Abstand zur Hauptstadt.', tr: 'Yönetim merkezi. Daha fazla asayiş ve vergi, başkente uzaklığın etkisi azalır.' },
    cost: [80, 180, 320], turns: [2, 3, 4], tech: [null, 'diwan', 'vizierate'],
    eff: { order: 5, tax: 0.1, dist: 0.3 },
  },
  port: {
    icon: '⚓',
    n: [
      { de: 'Hafen', tr: 'Liman' },
      { de: 'Handelshafen', tr: 'Ticaret Limanı' },
      { de: 'Großer Seehafen', tr: 'Büyük Liman' },
    ],
    desc: { de: 'Seehandel (nur Küstenprovinzen).', tr: 'Deniz ticareti (yalnızca kıyı eyaletleri).' },
    cost: [60, 140, 240], turns: [2, 2, 3], tech: [null, 'caravanserai', 'sakk'],
    eff: { trade: 0.3, goods: 0.15 }, portOnly: true,
  },
};

const TEMPLE_NAMES = {
  islam: [{ de: 'Moschee', tr: 'Mescit' }, { de: 'Freitagsmoschee', tr: 'Cuma Camii' }, { de: 'Große Moschee', tr: 'Ulu Cami' }],
  christian: [{ de: 'Kirche', tr: 'Kilise' }, { de: 'Kloster', tr: 'Manastır' }, { de: 'Kathedrale', tr: 'Katedral' }],
  dharmic: [{ de: 'Tempel', tr: 'Tapınak' }, { de: 'Tempelkloster', tr: 'Tapınak Manastırı' }, { de: 'Großes Heiligtum', tr: 'Büyük Mabet' }],
  iranian: [{ de: 'Feuertempel', tr: 'Ateşgede' }, { de: 'Großer Feuertempel', tr: 'Büyük Ateşgede' }, { de: 'Heiliges Feuer', tr: 'Kutsal Ateş' }],
  abrahamic: [{ de: 'Synagoge', tr: 'Sinagog' }, { de: 'Lehrhaus', tr: 'Yeşiva' }, { de: 'Große Synagoge', tr: 'Büyük Sinagog' }],
  pagan: [{ de: 'Ongun-Schrein', tr: 'Ongun Tapınağı' }, { de: 'Heiliger Hain', tr: 'Iduk Yer' }, { de: 'Kam-Heiligtum', tr: 'Kam Mabedi' }],
  sinic: [{ de: 'Ahnenhalle', tr: 'Ata Salonu' }, { de: 'Konfuziustempel', tr: 'Konfüçyüs Tapınağı' }, { de: 'Kaiserliche Akademie', tr: 'İmparatorluk Akademisi' }],
};

const SCHOOL_NAMES = {
  islam: [{ de: 'Maktab', tr: 'Mektep' }, { de: 'Madrasa', tr: 'Medrese' }, { de: 'Nizamiyya & Sternwarte', tr: 'Nizamiye ve Rasathane' }],
  other: [{ de: 'Schreibschule', tr: 'Yazı Okulu' }, { de: 'Akademie', tr: 'Akademi' }, { de: 'Bibliothek & Sternwarte', tr: 'Kütüphane ve Rasathane' }],
};

export function buildingName(id, level, religion) {
  const b = BUILDINGS[id];
  const i = Math.max(0, Math.min(2, level - 1));
  if (id === 'temple') {
    const g = RELIGIONS[religion]?.group || 'pagan';
    return (TEMPLE_NAMES[g] || TEMPLE_NAMES.pagan)[i];
  }
  if (id === 'school') {
    const g = RELIGIONS[religion]?.group === 'islam' ? 'islam' : 'other';
    return SCHOOL_NAMES[g][i];
  }
  return b.n[i];
}

// Weltgegenden: Jede Provinz gehört zu genau einer. Unbekannte Gegenden liegen als Terra incognita unter Nebel.

import { PROVINCES } from './provinces.js';

const d = (de, tr) => ({ de, tr });

export const REGIONS = {
  orient: {
    n: d('Orient', 'Şark'),
    fog: d('Das Morgenland', 'Şark Diyarı'), anchor: [55, 37],
    desc: d('Zentralasien, Iran, Anatolien, die Levante, Arabien, Ägypten, Indien und die Steppen der Rus.', 'Orta Asya, İran, Anadolu, Levant, Arabistan, Mısır, Hindistan ve Rus bozkırları.'),
  },
  europe: {
    n: d('Abendland', 'Frengistan'),
    fog: d('Bilad al-Ifrandsch – das Land der Franken', 'Frengistan – Frenklerin Ülkesi'), anchor: [6, 49],
    desc: d('Die Reiche der Franken, Deutschen, Italiener, Iberer, Ungarn, Polen und Nordleute.', 'Frenklerin, Almanların, İtalyanların, İberlerin, Macarların, Lehlerin ve Kuzeylilerin devletleri.'),
  },
  east: {
    n: d('Ferner Osten', 'Uzak Doğu'),
    fog: d('Sin und Matschin – das Land der Seide', 'Çin ü Maçin – İpeğin Ülkesi'), anchor: [108, 36],
    desc: d('China, die Mongolei, die Mandschurei, Korea, Tibet und Hinterindien.', 'Çin, Moğolistan, Mançurya, Kore, Tibet ve Hindiçin.'),
  },
  africa: {
    n: d('Afrika', 'Afrika'),
    fog: d('Bilad as-Sudan – das Land jenseits der Sahara', 'Bilâdüssudan – Sahra\'nın Ötesi'), anchor: [6, 20],
    desc: d('Der Maghreb, die Goldländer am Niger, Kanem, die Nilländer und Abessinien.', 'Mağrib, Nijer kıyısındaki altın ülkeleri, Kanem, Nil ülkeleri ve Habeşistan.'),
  },
};

export const REGION_IDS = Object.keys(REGIONS);

export const PROV_REGION = Object.fromEntries(PROVINCES.map((p) => [p.id, p.region || 'orient']));

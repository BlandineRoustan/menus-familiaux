// Données de l'appli : idées de plats, menus jour par jour, ingrédients (v2).
// Copie de travail dans le navigateur (localStorage) ; la référence est dans data/*.json (dépôt GitHub).
// Chaque plat, jour et ingrédient porte une date de modification « maj » : à la fusion, le plus récent gagne.
// Ainsi on peut repartir des fichiers du dépôt, travailler sur plusieurs appareils et fusionner sans rien perdre.

const CLE = 'menus.donnees';
const CLE_REGLAGES = 'menus.reglages';
export const REPAS = [{ id: 'midi', nom: 'Midi' }, { id: 'soir', nom: 'Soir' }];
export const FICHIERS = ['data/plats.json', 'data/menus.json', 'data/ingredients.json'];

const vide = () => ({ plats: {}, jours: {}, ingredients: {}, types: [], aSauver: false, sauveLe: null });
let d = vide();
try { d = Object.assign(vide(), JSON.parse(localStorage.getItem(CLE))); } catch (e) { /* stockage indisponible */ }

const ecouteurs = new Set();
export const surChangement = f => ecouteurs.add(f);
const prevenir = () => ecouteurs.forEach(f => f());
const ecrire = () => { try { localStorage.setItem(CLE, JSON.stringify(d)); } catch (e) { /* ignoré */ } };
const maintenant = () => new Date().toISOString();
function modifie() { d.aSauver = true; index = null; ecrire(); prevenir(); }

// ---------- Réglages (propres à l'appareil, jamais envoyés sur GitHub : le jeton y est) ----------
const reglagesDefaut = {
  vue: 'semaine',          // 'semaine' | 'mois' (4 semaines)
  midiVacances: true,      // le midi est à prévoir pendant les vacances scolaires…
  midiFeries: true,        // … les jours fériés…
  midiJours: [2, 5, 6],    // … et ces jours de la semaine (0 = lundi … 6 = dimanche) : mercredi, samedi, dimanche
  delai: 14,               // on évite de reproposer un plat servi il y a moins de N jours
  gh: { proprio: 'BlandineRoustan', depot: 'menus-familiaux', branche: 'main', jeton: '', auto: true }
};
let r = {};
try { r = JSON.parse(localStorage.getItem(CLE_REGLAGES)) || {}; } catch (e) { /* ignoré */ }
r = Object.assign(structuredClone(reglagesDefaut), r, { gh: Object.assign({}, reglagesDefaut.gh, r.gh) });
export const reglages = () => r;
export function regler(patch) {
  Object.assign(r, patch);
  try { localStorage.setItem(CLE_REGLAGES, JSON.stringify(r)); } catch (e) { /* ignoré */ }
  prevenir();
}

// ---------- Lecture ----------
export const aSauver = () => d.aSauver;
export const sauveLe = () => d.sauveLe;
export const plat = id => d.plats[id];
export const types = () => d.types;
const tri = (a, b) => a.nom.localeCompare(b.nom, 'fr', { sensitivity: 'base' });
export const platsActifs = () => Object.values(d.plats).filter(p => !p.archive).sort(tri);
export const platsArchives = () => Object.values(d.plats).filter(p => p.archive).sort(tri);
// Un repas : { entrees: [ids], plats: [ids], salades: [ids], desserts: [ids], note }. Chaque partie est facultative.
// Pour ajouter un service : une ligne ici, et ses couleurs (.m-…, .s-…, .f-…) dans css/style.css.
export const SERVICES = [
  { id: 'entree', cle: 'entrees', nom: 'Entrée', pluriel: 'Entrées' },
  { id: 'plat', cle: 'plats', nom: 'Plat', pluriel: 'Plats' },
  { id: 'salade', cle: 'salades', nom: 'Salade', pluriel: 'Salades' },
  { id: 'dessert', cle: 'desserts', nom: 'Dessert', pluriel: 'Desserts' }
];
export function repas(iso, cle) {
  const r = d.jours[iso]?.[cle] || {};
  return { ...Object.fromEntries(SERVICES.map(s => [s.cle, r[s.cle] || []])), note: r.note || '' };
}
export const estVide = r => !r.note && SERVICES.every(s => !r[s.cle].length);
export const nomPlat = id => d.plats[id]?.nom || id;

// Index des usages : id du plat -> {
//   dates (triées, tous services), occurrences ({ iso, repas, service }), services ({ entree: n, plat: n, … }),
//   compagnons : Map(id d'un autre mets -> { n, services }) = servis dans le même repas, et dans quel service.
// }
const compteursVides = () => Object.fromEntries(SERVICES.map(s => [s.id, 0]));
let index = null;
function indexer() {
  if (index) return index;
  index = new Map();
  const entree = p => {
    if (!index.has(p)) index.set(p, { dates: [], occurrences: [], services: compteursVides(), compagnons: new Map() });
    return index.get(p);
  };
  for (const [iso, j] of Object.entries(d.jours)) {
    for (const { id: cle } of REPAS) {
      const mets = SERVICES.flatMap(s => (j[cle]?.[s.cle] || []).map(p => ({ p, s: s.id })));
      for (const { p, s } of mets) {
        const u = entree(p);
        u.dates.push(iso);
        u.occurrences.push({ iso, repas: cle, service: s });
        u.services[s]++;
        for (const autre of mets) {
          if (autre.p === p) continue;
          if (!u.compagnons.has(autre.p)) u.compagnons.set(autre.p, { n: 0, services: compteursVides() });
          const c = u.compagnons.get(autre.p);
          c.n++;
          c.services[autre.s]++;
        }
      }
    }
  }
  for (const u of index.values()) { u.dates.sort(); u.occurrences.sort((a, b) => a.iso.localeCompare(b.iso)); }
  return index;
}
export const occurrences = id => indexer().get(id)?.occurrences || [];
export const usages = id => indexer().get(id)?.dates || [];
export const services = id => indexer().get(id)?.services || compteursVides();
// Mets servis dans les mêmes repas que celui-ci, du plus fréquent au moins fréquent : [{ id, n, services }].
export const compagnons = id => [...(indexer().get(id)?.compagnons || new Map())]
  .map(([autre, c]) => ({ id: autre, ...c }))
  .sort((a, b) => b.n - a.n || nomPlat(a.id).localeCompare(nomPlat(b.id), 'fr'));
// Combien de fois « autre » a été servi en tant que « service » dans un repas contenant « id ».
export const servisAvec = (id, autre, service) => indexer().get(id)?.compagnons.get(autre)?.services[service] || 0;

// ---------- Écriture ----------
const sansAccent = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
export const cleRecherche = s => sansAccent(s).toLowerCase().replace(/\s+/g, ' ').trim();

export function trouverPlat(nom) {
  const c = cleRecherche(nom);
  return Object.values(d.plats).find(p => cleRecherche(p.nom) === c);
}

export function ajouterPlat(nom) {
  nom = nom.trim().replace(/\s+/g, ' ');
  const existant = trouverPlat(nom);
  if (existant) {
    if (existant.archive) modifierPlat(existant.id, { archive: false });
    return existant;
  }
  const base = cleRecherche(nom).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'plat';
  let id = base, n = 2;
  while (d.plats[id]) id = `${base}-${n++}`;
  const p = { id, nom: nom[0].toUpperCase() + nom.slice(1), ingredients: [], maj: maintenant() };
  d.plats[id] = p;
  modifie();
  return p;
}

export function modifierPlat(id, patch) {
  const p = d.plats[id];
  if (!p) return;
  Object.assign(p, patch, { maj: maintenant() });
  if (!p.archive) delete p.archive;
  modifie();
}

// valeur : { entrees, plats, salades, desserts, note } (parties absentes = vides).
export function definirRepas(iso, cle, valeur) {
  const ancien = d.jours[iso] || {};
  const r = {};
  for (const s of SERVICES) if (valeur[s.cle]?.length) r[s.cle] = valeur[s.cle];
  const note = (valeur.note || '').trim();
  if (note) r.note = note;
  // Ordre fixe des clés (midi, soir, maj) pour des fichiers stables.
  // Un jour vidé est gardé (avec sa date) pour que la suppression se propage à la fusion.
  const j = {};
  for (const { id } of REPAS) {
    const v = id === cle ? r : ancien[id];
    if (v && Object.keys(v).length) j[id] = v;
  }
  j.maj = maintenant();
  d.jours[iso] = j;
  modifie();
}

// ---------- Fusion avec des fichiers (dépôt, import) ----------
function fusionnerTable(locale, entrante) {
  let change = false;
  for (const [k, v] of Object.entries(entrante || {})) {
    if (!locale[k] || (v.maj || '') > (locale[k].maj || '')) { locale[k] = v; change = true; }
  }
  return change;
}

// fichiers : { 'data/plats.json': objet, … } (ou un export complet { plats, jours, … }).
// Ce qui vient du dépôt n'est pas « à sauvegarder » ; un import de fichiers, si (aSauver = true).
export function fusionner(fichiers, aSauver = false) {
  let change = false;
  const parId = l => Object.fromEntries((l || []).map(x => [x.id, x]));
  for (const f of Object.values(fichiers)) {
    if (!f || typeof f !== 'object') continue;
    if (Array.isArray(f.plats)) change = fusionnerTable(d.plats, parId(f.plats)) || change;
    if (f.jours) change = fusionnerTable(d.jours, f.jours) || change;
    if (Array.isArray(f.ingredients)) change = fusionnerTable(d.ingredients, parId(f.ingredients)) || change;
    if (Array.isArray(f.types) && f.types.length && JSON.stringify(f.types) !== JSON.stringify(d.types)) {
      d.types = f.types; change = true;
    }
  }
  if (change) { if (aSauver) d.aSauver = true; index = null; ecrire(); prevenir(); }
  return change;
}

// ---------- Écriture des fichiers (une ligne par élément : des diffs git lisibles) ----------
const ligne = v => JSON.stringify(v);
function liste(cle, elements) {
  return `  "${cle}": [\n${elements.map(e => '    ' + ligne(e)).join(',\n')}${elements.length ? '\n' : ''}  ]`;
}
export function versFichiers() {
  const plats = Object.values(d.plats).sort(tri);
  const jours = Object.keys(d.jours).sort().map(k => `    ${ligne(k)}: ${ligne(d.jours[k])}`);
  const ingr = Object.values(d.ingredients).sort(tri);
  return {
    'data/plats.json': `{\n  "format": 1,\n${liste('plats', plats)}\n}\n`,
    'data/menus.json': `{\n  "format": 1,\n  "jours": {\n${jours.join(',\n')}${jours.length ? '\n' : ''}  }\n}\n`,
    'data/ingredients.json': `{\n  "format": 1,\n${liste('types', d.types)},\n${liste('ingredients', ingr)}\n}\n`
  };
}

export function marquerSauve() {
  d.aSauver = false;
  d.sauveLe = maintenant();
  ecrire();
  prevenir();
}

// Oublie la copie locale (les réglages restent) : l'appli repartira des fichiers du dépôt.
export function oublierLocal() {
  d = vide();
  index = null;
  ecrire();
}

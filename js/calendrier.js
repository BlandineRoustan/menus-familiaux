// Vacances scolaires (data.education.gouv.fr) et jours fériés (calendrier.api.gouv.fr).
// Mis en cache sur l'appareil, rafraîchis chaque semaine ; sans réseau, l'appli marche sans.
import { ajouter, aujourdhui } from './dates.js';

// Vacances de l'académie de Toulouse (zone C). Pour une autre académie : changer ce nom
// (champ « location » du jeu de données, ex. 'Bordeaux', 'Paris', 'Montpellier').
export const ACADEMIE = 'Toulouse';

const CLE = 'menus.calendrier';
const FRAICHEUR = 7 * 864e5;
let cache = { academie: null, le: 0, vacances: [], feries: {} };
try { cache = Object.assign(cache, JSON.parse(localStorage.getItem(CLE))); } catch (e) { /* ignoré */ }

// Les dates de l'API sont en UTC (« 2026-12-18T23:00:00+00:00 » = samedi 19 décembre à Paris).
const versParis = s => new Date(s).toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });

async function telechargerVacances() {
  const depuis = ajouter(aujourdhui(), -730);
  const where = `location="${ACADEMIE}" and end_date>="${depuis}"`;
  const url = 'https://data.education.gouv.fr/api/explore/v2.1/catalog/datasets/fr-en-calendrier-scolaire/records'
    + '?select=description,start_date,end_date&group_by=description,start_date,end_date&order_by=start_date&limit=100'
    + '&where=' + encodeURIComponent(where);
  const rep = await fetch(url);
  if (!rep.ok) throw new Error('vacances ' + rep.status);
  const { results } = await rep.json();
  // end_date = jour de la reprise des cours : exclu. Les périodes d'un seul jour (pont) ont début = fin.
  const periodes = results.map(r => {
    const debut = versParis(r.start_date);
    let fin = versParis(r.end_date);
    if (fin <= debut) fin = ajouter(debut, 1);
    return { nom: r.description.replace(/^Début des /, ''), debut, fin };
  });
  // Doublons (académies aux dates de fin différentes) : on fusionne les périodes qui se chevauchent.
  const fusion = [];
  for (const p of periodes) {
    const der = fusion[fusion.length - 1];
    if (der && p.debut <= der.fin) { if (p.fin > der.fin) der.fin = p.fin; } else fusion.push({ ...p });
  }
  return fusion;
}

async function telechargerFeries() {
  const rep = await fetch('https://calendrier.api.gouv.fr/jours-feries/metropole.json');
  if (!rep.ok) throw new Error('fériés ' + rep.status);
  return rep.json();
}

// Rafraîchit si besoin ; renvoie true si quelque chose a changé (pour réafficher).
export async function actualiser(forcer = false) {
  const perime = Date.now() - cache.le > FRAICHEUR;
  if (!forcer && !perime && cache.academie === ACADEMIE) return false;
  const [vac, fer] = await Promise.allSettled([telechargerVacances(), telechargerFeries()]);
  if (vac.status === 'rejected' && fer.status === 'rejected') return false;
  if (vac.status === 'fulfilled') { cache.vacances = vac.value; cache.academie = ACADEMIE; }
  if (fer.status === 'fulfilled') cache.feries = fer.value;
  cache.le = Date.now();
  try { localStorage.setItem(CLE, JSON.stringify(cache)); } catch (e) { /* ignoré */ }
  return true;
}

export function vacances(iso) {
  if (cache.academie !== ACADEMIE) return null;
  return cache.vacances.find(p => p.debut <= iso && iso < p.fin) || null;
}

export const ferie = iso => cache.feries[iso] || null;

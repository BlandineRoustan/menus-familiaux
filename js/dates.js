// Dates au format 'AAAA-MM-JJ', toujours en heure locale (jamais d'UTC, pour ne pas glisser d'un jour).
const deux = n => String(n).padStart(2, '0');

export const versIso = d => `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}`;
export const versDate = iso => { const [a, m, j] = iso.split('-').map(Number); return new Date(a, m - 1, j); };
export const aujourdhui = () => versIso(new Date());
export const ajouter = (iso, n) => { const d = versDate(iso); d.setDate(d.getDate() + n); return versIso(d); };
export const ecart = (a, b) => Math.round((versDate(b) - versDate(a)) / 864e5); // b - a, en jours
export const jourSemaine = iso => (versDate(iso).getDay() + 6) % 7; // 0 = lundi … 6 = dimanche

export const NOMS_JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MOIS_COURTS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

const maj = s => s[0].toUpperCase() + s.slice(1);
export const nomJour = iso => maj(NOMS_JOURS[jourSemaine(iso)]);
export const nomJourCourt = iso => maj(NOMS_JOURS[jourSemaine(iso)].slice(0, 3));
export const dateLongue = iso => { const d = versDate(iso); return `${nomJour(iso)} ${d.getDate()} ${MOIS[d.getMonth()]}`; };
export const dateCourte = iso => { const d = versDate(iso); return `${d.getDate()} ${MOIS_COURTS[d.getMonth()]}`; };

// « aujourd'hui », « dans 3 j », « il y a 2 sem. »…
export function relatif(depuis, iso) {
  const n = ecart(depuis, iso);
  if (n === 0) return 'le même jour';
  const a = Math.abs(n);
  const txt = a < 14 ? `${a} j` : a < 60 ? `${Math.round(a / 7)} sem.` : `${Math.round(a / 30)} mois`;
  return n < 0 ? `il y a ${txt}` : `dans ${txt}`;
}

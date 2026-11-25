// Planning : vue semaine (7 jours) ou 4 semaines, à partir d'aujourd'hui, et éditeur d'un repas.
import * as D from './donnees.js';
import { aujourdhui, ajouter, ecart, jourSemaine, dateLongue, dateCourte, nomJour, nomJourCourt } from './dates.js';
import { vacances, ferie } from './calendrier.js';
import { el, feuille } from './ui.js';

let decalage = 0; // en jours, par rapport à aujourd'hui
export const revenirAujourdhui = () => { decalage = 0; };
const NOTES_RAPIDES = ['Restes', 'Repas dehors', 'Improvisé'];

export function infoJour(iso) {
  const r = D.reglages();
  const vac = vacances(iso);
  const fer = ferie(iso);
  const midiAPrevoir = (r.midiVacances && !!vac) || (r.midiFeries && !!fer) || r.midiJours.includes(jourSemaine(iso));
  return { vac, fer, midiAPrevoir };
}

// Écart (en jours) avec l'utilisation la plus proche du plat, sans compter l'occurrence (iso, repas) elle-même.
function plusProche(id, iso, sansCetteOccurrence) {
  const dates = [...D.usages(id)];
  if (sansCetteOccurrence) { const i = dates.indexOf(iso); if (i >= 0) dates.splice(i, 1); }
  let meilleur = null;
  for (const u of dates) {
    const e = ecart(iso, u);
    if (meilleur === null || Math.abs(e) < Math.abs(meilleur.ecart)) meilleur = { date: u, ecart: e };
  }
  return meilleur;
}

const libelleUsage = (u, aujd) => u.date < aujd ? `servi le ${dateCourte(u.date)}` : u.date === aujd ? 'prévu aujourd\'hui' : `prévu le ${dateCourte(u.date)}`;

// Pastille d'un mets, colorée selon le service (entrée, plat, salade, dessert) ; ↻ si servi trop près d'une autre fois.
function mets(id, service, iso) {
  const p = plusProche(id, iso, true);
  const repete = p && Math.abs(p.ecart) < D.reglages().delai;
  const nomService = D.SERVICES.find(s => s.id === service).nom;
  return el(`span.mets.m-${service}` + (repete ? '.repete' : ''), {
    title: nomService + (repete ? ` · aussi ${libelleUsage(p, aujourdhui())}` : '')
  }, D.nomPlat(id));
}

export const legende = () => el('p.legende', { 'aria-hidden': 'true' },
  D.SERVICES.map(s => el(`span.mets.m-${s.id}`, s.nom)),
  el('span.mets.m-plat.repete', 'servi récemment'));

function cellule(iso, cle, info, ouvrir) {
  const rep = D.repas(iso, cle);
  const facultatif = cle === 'midi' && !info.midiAPrevoir;
  const vide = D.estVide(rep);
  const plats = D.SERVICES.flatMap(s => rep[s.cle].map(id => mets(id, s.id, iso)));
  return el(`button.repas.${cle}` + (facultatif ? '.facultatif' : '') + (vide ? '.vide' : ''), {
    type: 'button', onclick: () => ouvrir(iso, cle), 'aria-label': `${dateLongue(iso)}, ${cle}`
  },
    el('span.repas-nom', cle === 'midi' ? 'Midi' : 'Soir'),
    el('span.repas-contenu',
      plats,
      rep.note ? el('span.note', rep.note) : null,
      vide ? el('span.a-prevoir', facultatif ? '' : 'à prévoir') : null
    )
  );
}

function carteJour(iso, ouvrir, compact) {
  const aujd = aujourdhui();
  const info = infoJour(iso);
  const badges = [
    info.fer ? el('span.badge.ferie', info.fer) : null,
    info.vac && !compact ? el('span.badge.vacances', info.vac.nom) : null
  ];
  return el('section.jour' + (iso === aujd ? '.aujourdhui' : '') + (iso < aujd ? '.passe' : '')
    + (info.vac ? '.en-vacances' : '') + (jourSemaine(iso) >= 5 ? '.week-end' : ''), { dataset: { iso } },
    el('header.jour-tete',
      el('span.jour-nom', compact ? nomJourCourt(iso) : nomJour(iso)),
      el('span.jour-date', dateCourte(iso)),
      iso === aujd ? el('span.badge.jour-j', 'aujourd\'hui') : null,
      badges
    ),
    el('div.jour-repas', D.REPAS.map(({ id }) => cellule(iso, id, info, ouvrir)))
  );
}

export function afficher(racine, rafraichir) {
  const r = D.reglages();
  const mois = r.vue === 'mois';
  const nb = mois ? 28 : 7;
  const debut = ajouter(aujourdhui(), decalage);
  const fin = ajouter(debut, nb - 1);
  const ouvrir = (iso, cle) => editer(iso, cle, rafraichir);

  // Compteur : repas « à prévoir » déjà remplis sur la période.
  let prevus = 0, total = 0;
  for (let i = 0; i < nb; i++) {
    const iso = ajouter(debut, i);
    const info = infoJour(iso);
    for (const { id } of D.REPAS) {
      const rempli = !D.estVide(D.repas(iso, id));
      if (id === 'soir' || info.midiAPrevoir) { total++; if (rempli) prevus++; }
      else if (rempli) { total++; prevus++; }
    }
  }

  const pas = mois ? 28 : 7;
  const barre = el('div.barre-planning',
    el('div.bascule', { role: 'group', 'aria-label': 'Durée affichée' },
      el('button' + (!mois ? '.actif' : ''), { type: 'button', onclick: () => D.regler({ vue: 'semaine' }) }, 'Semaine'),
      el('button' + (mois ? '.actif' : ''), { type: 'button', onclick: () => D.regler({ vue: 'mois' }) }, '4 semaines')
    ),
    el('div.navigation',
      el('button.rond', { type: 'button', 'aria-label': 'Période précédente', onclick: () => { decalage -= pas; rafraichir(); } }, '‹'),
      el('button.texte', { type: 'button', disabled: decalage === 0, onclick: () => { decalage = 0; rafraichir(); } }, 'Aujourd\'hui'),
      el('button.rond', { type: 'button', 'aria-label': 'Période suivante', onclick: () => { decalage += pas; rafraichir(); } }, '›')
    )
  );
  const resume = el('p.resume',
    el('span', `Du ${dateLongue(debut).toLowerCase()} au ${dateLongue(fin).toLowerCase()}`),
    el('span.compteur', `${prevus} / ${total} repas prévus`)
  );

  let grille;
  if (mois) {
    grille = el('div.grille.mois');
    for (let s = 0; s < 4; s++) {
      const d0 = ajouter(debut, s * 7);
      const vacs = [...new Set(Array.from({ length: 7 }, (_, i) => vacances(ajouter(d0, i))?.nom).filter(Boolean))];
      grille.append(el('div.semaine',
        el('h3.semaine-tete', `Semaine du ${dateCourte(d0)}`, vacs.map(v => el('span.badge.vacances', v))),
        el('div.semaine-jours', Array.from({ length: 7 }, (_, i) => carteJour(ajouter(d0, i), ouvrir, true)))
      ));
    }
  } else {
    grille = el('div.grille.semaine-seule', Array.from({ length: 7 }, (_, i) => carteJour(ajouter(debut, i), ouvrir, false)));
  }
  racine.replaceChildren(barre, resume, legende(), grille);
}

// ---------- Éditeur d'un repas ----------
const UN = { entree: 'une entrée', plat: 'un plat', salade: 'une salade', dessert: 'un dessert' };

// Service le plus fréquent d'un mets (null s'il n'a jamais servi).
export function serviceHabituel(id) {
  const sv = D.services(id);
  const max = Math.max(...Object.values(sv));
  return max ? D.SERVICES.find(s => sv[s.id] === max).id : null;
}

function editer(iso, cle, rafraichir) {
  feuille((dlg, fermer) => {
    let jour = iso, repas = cle, service = 'plat';
    const contenu = el('div.feuille-contenu');
    dlg.append(contenu);
    dlg.addEventListener('close', rafraichir);

    const dessiner = (focus = true) => {
      const aujd = aujourdhui();
      const rep = D.repas(jour, repas);
      const info = infoJour(jour);
      const delai = D.reglages().delai;
      const sv = D.SERVICES.find(s => s.id === service);
      const enregistrer = patch => { D.definirRepas(jour, repas, { ...D.repas(jour, repas), ...patch }); dessiner(false); };

      const surOrdi = matchMedia('(pointer: fine)').matches; // sur téléphone, pas de clavier qui surgit
      const recherche = el('input.recherche', { type: 'search', placeholder: `Chercher ou ajouter ${UN[service]}…`, autocomplete: 'off', enterKeyHint: 'done', autofocus: surOrdi && focus });
      const liste = el('ul.suggestions');

      const ajouterPlat = p => { enregistrer({ [sv.cle]: [...D.repas(jour, repas)[sv.cle], p.id] }); };
      const remplirListe = () => {
        const q = D.cleRecherche(recherche.value);
        const dejaLa = D.SERVICES.flatMap(s => rep[s.cle]);
        // Trois groupes :
        //  0. « Souvent avec … » : servis dans ce service avec un des mets déjà choisis (calculé sur les menus) ;
        //  1. les mets déjà servis dans ce service (ou jamais servis) ;
        //  2. ceux jamais servis dans ce service.
        // Groupe 0 : les plus fréquents d'abord ; groupes 1 et 2 : les plus anciens d'abord. Les trop récents à la fin.
        const candidats = D.platsActifs()
          .filter(p => !dejaLa.includes(p.id))
          .filter(p => !q || D.cleRecherche(p.nom).includes(q))
          .map(p => {
            const u = plusProche(p.id, jour, false);
            const habituel = serviceHabituel(p.id);
            const avec = dejaLa.map(id => ({ id, n: D.servisAvec(id, p.id, service) })).filter(x => x.n);
            const score = avec.reduce((t, x) => t + x.n, 0);
            const groupe = score ? 0 : habituel !== null && D.services(p.id)[service] === 0 ? 2 : 1;
            return { p, u, habituel, avec, score, groupe, dist: u ? Math.abs(u.ecart) : Infinity };
          })
          .sort((a, b) => a.groupe - b.groupe || (a.dist < delai) - (b.dist < delai)
            || (a.groupe === 0 ? b.score - a.score : b.dist - a.dist) || a.p.nom.localeCompare(b.p.nom, 'fr'));
        const contributeurs = [...new Set(candidats.filter(c => c.groupe === 0).flatMap(c => c.avec.map(x => x.id)))].map(D.nomPlat);
        const titres = [
          `Souvent avec ${contributeurs.length > 2 ? 'ce repas' : contributeurs.join(' et ')}`,
          dejaLa.length && candidats.some(c => c.groupe === 0) ? 'Autres idées' : null,
          `Jamais servis en ${sv.nom.toLowerCase()}`
        ];
        const items = [];
        candidats.forEach(({ p, u, habituel, avec, groupe, dist }, i) => {
          if (titres[groupe] && (i === 0 || candidats[i - 1].groupe !== groupe)) items.push(el('li.separateur' + (groupe === 0 ? '.avec' : ''), titres[groupe]));
          const nomHabituel = habituel && D.SERVICES.find(s => s.id === habituel).nom.toLowerCase();
          const detail = [
            avec.length ? avec.map(x => `${x.n}× avec ${D.nomPlat(x.id)}`).join(', ') : null,
            u ? (dist < delai ? '⚠ ' : '') + libelleUsage(u, aujd) : 'jamais servi',
            groupe === 2 ? `en ${nomHabituel}` : null
          ].filter(Boolean).join(' · ');
          items.push(el('li',
            el('button.suggestion' + (dist < delai ? '.proche' : '') + (groupe === 0 ? '.associee' : ''), { type: 'button', onclick: () => ajouterPlat(p) },
              el('span.nom', habituel ? el(`i.pastille.m-${habituel}`, { title: `Plutôt en ${nomHabituel}` }) : null, p.nom),
              el('small', detail)
            )));
        });
        const nom = recherche.value.trim();
        if (nom && !D.trouverPlat(nom)) {
          items.unshift(el('li', el('button.suggestion.nouvelle', {
            type: 'button', onclick: () => ajouterPlat(D.ajouterPlat(nom))
          }, el('span.nom', `＋ Ajouter « ${nom} »`), el('small', 'nouvelle idée'))));
        }
        if (!items.length) items.push(el('li.rien', D.platsActifs().length ? 'Aucune idée ne correspond.' : 'Tape le nom d\'un plat pour créer ta première idée.'));
        liste.replaceChildren(...items);
      };
      recherche.addEventListener('input', remplirListe);
      recherche.addEventListener('keydown', e => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const nom = recherche.value.trim();
        if (nom) ajouterPlat(D.trouverPlat(nom) || D.ajouterPlat(nom));
      });
      remplirListe();

      // Une ligne par service ; la ligne active reçoit ce qu'on ajoute.
      const choisis = el('div.services', D.SERVICES.map(s => {
        const choisir = () => { service = s.id; dessiner(); };
        return el(`div.service.s-${s.id}` + (s.id === service ? '.actif' : ''), {
          role: 'button', tabindex: 0, 'aria-pressed': String(s.id === service), onclick: choisir,
          onkeydown: e => { if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); choisir(); } }
        },
          el('span.service-nom', s.nom),
          el('span.service-mets', rep[s.cle].length
            ? rep[s.cle].map((id, i) => el(`span.puce.m-${s.id}`,
              D.nomPlat(id),
              el('button', { type: 'button', 'aria-label': `Retirer ${D.nomPlat(id)}`, onclick: e => {
                e.stopPropagation();
                const l = [...rep[s.cle]]; l.splice(i, 1); enregistrer({ [s.cle]: l });
              } }, '×')))
            : el('span.rien', s.id === service ? 'à choisir ci-dessous' : '—'))
        );
      }));
      const restes = repas === 'midi' && !info.midiAPrevoir && D.estVide(rep)
        ? el('p.aide', 'Midi facultatif ce jour-là (restes).') : null;

      const note = el('input.note-libre', { type: 'text', value: rep.note || '', placeholder: 'Note (facultatif)', maxLength: 80 });
      // Enregistrée à chaque frappe, sans redessiner (pour ne pas perdre le curseur).
      note.addEventListener('input', () => D.definirRepas(jour, repas, { ...D.repas(jour, repas), note: note.value }));
      const notes = el('div.notes-rapides', NOTES_RAPIDES.map(n => el('button.puce-note' + (rep.note === n ? '.actif' : ''), {
        type: 'button', onclick: () => enregistrer({ note: rep.note === n ? '' : n })
      }, n)), note);

      const changerJour = n => { jour = ajouter(jour, n); dessiner(); };
      contenu.replaceChildren(...[
        el('header.feuille-tete',
          el('button.rond', { type: 'button', 'aria-label': 'Jour précédent', onclick: () => changerJour(-1) }, '‹'),
          el('div',
            el('h2', dateLongue(jour)),
            el('p.sous-titre', [info.fer, info.vac?.nom].filter(Boolean).join(' · ') || (jour === aujd ? 'Aujourd\'hui' : ''))
          ),
          el('button.rond', { type: 'button', 'aria-label': 'Jour suivant', onclick: () => changerJour(1) }, '›')
        ),
        el('div.bascule.large', { role: 'group' }, D.REPAS.map(({ id, nom }) => el('button' + (id === repas ? '.actif' : ''), {
          type: 'button', onclick: () => { repas = id; dessiner(); }
        }, nom))),
        choisis,
        restes,
        recherche,
        liste,
        notes,
        el('footer.feuille-pied', el('button.principal', { type: 'button', onclick: fermer }, 'Fermer'))
      ].filter(Boolean));
      if (focus && surOrdi) recherche.focus(); // (à l'ouverture, c'est « autofocus » qui joue)
    };
    dessiner();
  });
}

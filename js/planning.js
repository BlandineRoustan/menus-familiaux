// Planning : vue semaine (7 jours) ou 4 semaines, à partir d'aujourd'hui, et éditeur d'un repas.
import * as D from './donnees.js';
import { aujourdhui, ajouter, ecart, jourSemaine, dateLongue, dateCourte, nomJour, nomJourCourt } from './dates.js';
import { vacances, ferie } from './calendrier.js';
import { el, feuille } from './ui.js';

let decalage = 0; // en jours, par rapport à aujourd'hui
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

function cellule(iso, cle, info, ouvrir) {
  const rep = D.repas(iso, cle);
  const facultatif = cle === 'midi' && !info.midiAPrevoir;
  const vide = !rep.plats.length && !rep.note;
  const delai = D.reglages().delai;
  const plats = rep.plats.map(id => {
    const p = plusProche(id, iso, true);
    const repete = p && Math.abs(p.ecart) < delai;
    return el('span.plat' + (repete ? '.repete' : ''), {
      title: repete ? `Aussi ${libelleUsage(p, aujourdhui())}` : null
    }, D.nomPlat(id));
  });
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
      const rep = D.repas(iso, id);
      const rempli = rep.plats.length || rep.note;
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
  racine.replaceChildren(barre, resume, grille);
}

// ---------- Éditeur d'un repas ----------
function editer(iso, cle, rafraichir) {
  feuille((dlg, fermer) => {
    let jour = iso, repas = cle;
    const contenu = el('div.feuille-contenu');
    dlg.append(contenu);
    dlg.addEventListener('close', rafraichir);

    const dessiner = (focus = true) => {
      const aujd = aujourdhui();
      const rep = D.repas(jour, repas);
      const info = infoJour(jour);
      const delai = D.reglages().delai;
      const enregistrer = patch => { D.definirRepas(jour, repas, { ...D.repas(jour, repas), ...patch }); dessiner(false); };

      const surOrdi = matchMedia('(pointer: fine)').matches; // sur téléphone, pas de clavier qui surgit
      const recherche = el('input.recherche', { type: 'search', placeholder: 'Chercher ou ajouter une idée…', autocomplete: 'off', enterKeyHint: 'done', autofocus: surOrdi && focus });
      const liste = el('ul.suggestions');

      const ajouterPlat = p => { enregistrer({ plats: [...D.repas(jour, repas).plats, p.id] }); };
      const remplirListe = () => {
        const q = D.cleRecherche(recherche.value);
        const candidats = D.platsActifs()
          .filter(p => !rep.plats.includes(p.id))
          .filter(p => !q || D.cleRecherche(p.nom).includes(q))
          .map(p => ({ p, u: plusProche(p.id, jour, false) }))
          .map(x => ({ ...x, dist: x.u ? Math.abs(x.u.ecart) : Infinity }))
          .sort((a, b) => (a.dist < delai) - (b.dist < delai) || b.dist - a.dist || a.p.nom.localeCompare(b.p.nom, 'fr'));
        const items = candidats.map(({ p, u, dist }) => el('li',
          el('button.suggestion' + (dist < delai ? '.proche' : ''), { type: 'button', onclick: () => ajouterPlat(p) },
            el('span.nom', p.nom),
            el('small', u ? (dist < delai ? '⚠ ' : '') + libelleUsage(u, aujd) : 'jamais servi')
          )));
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

      const choisis = el('div.choisis', rep.plats.length
        ? rep.plats.map((id, i) => el('span.puce',
          D.nomPlat(id),
          el('button', { type: 'button', 'aria-label': `Retirer ${D.nomPlat(id)}`, onclick: () => {
            const plats = [...rep.plats]; plats.splice(i, 1); enregistrer({ plats });
          } }, '×')))
        : el('span.rien', repas === 'midi' && !info.midiAPrevoir ? 'Rien de prévu (restes)' : 'Rien de prévu pour l\'instant'));

      const note = el('input.note-libre', { type: 'text', value: rep.note || '', placeholder: 'Note (facultatif)', maxLength: 80 });
      // Enregistrée à chaque frappe, sans redessiner (pour ne pas perdre le curseur).
      note.addEventListener('input', () => D.definirRepas(jour, repas, { ...D.repas(jour, repas), note: note.value }));
      const notes = el('div.notes-rapides', NOTES_RAPIDES.map(n => el('button.puce-note' + (rep.note === n ? '.actif' : ''), {
        type: 'button', onclick: () => enregistrer({ note: rep.note === n ? '' : n })
      }, n)), note);

      const changerJour = n => { jour = ajouter(jour, n); dessiner(); };
      contenu.replaceChildren(
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
        recherche,
        liste,
        notes,
        el('footer.feuille-pied', el('button.principal', { type: 'button', onclick: fermer }, 'Fermer'))
      );
      if (focus && surOrdi) recherche.focus(); // (à l'ouverture, c'est « autofocus » qui joue)
    };
    dessiner();
  });
}

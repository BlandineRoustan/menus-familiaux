// Réglages : midis à prévoir, vacances, anti-répétition, sauvegarde (export, import, GitHub).
import * as D from './donnees.js';
import * as GH from './github.js';
import { actualiser, ACADEMIE } from './calendrier.js';
import { NOMS_JOURS, aujourdhui } from './dates.js';
import { el, annonce, telecharger } from './ui.js';

const section = (titre, ...contenu) => el('section.carte', el('h2', titre), ...contenu);
const caseACocher = (texte, coche, onchange) => el('label.case', el('input', { type: 'checkbox', checked: coche, onchange }), el('span', texte));

export function afficher(racine, rafraichir) {
  const r = D.reglages();

  const btCalendrier = el('button.discret', { type: 'button', onclick: async () => {
    btCalendrier.disabled = true;
    const ok = await actualiser(true).catch(() => false);
    annonce(ok ? 'Vacances et jours fériés mis à jour.' : 'Impossible de les récupérer (réseau ?).', ok ? '' : 'erreur');
    rafraichir();
  } }, 'Mettre à jour maintenant');

  const jours = el('div.jours-semaine', NOMS_JOURS.map((n, i) => el('label.puce-case',
    el('input', { type: 'checkbox', checked: r.midiJours.includes(i), onchange: e => {
      const l = D.reglages().midiJours.filter(x => x !== i);
      if (e.target.checked) l.push(i);
      D.regler({ midiJours: l.sort() });
    } }),
    el('span', n.slice(0, 3))
  )));

  const delai = el('input', { type: 'number', min: 0, max: 60, value: r.delai, onchange: e => D.regler({ delai: Math.max(0, +e.target.value || 0) }) });

  // ---------- Sauvegarde ----------
  const etat = el('p.etat-sauvegarde' + (D.aSauver() ? '.a-sauver' : ''),
    D.aSauver() ? 'Des modifications ne sont pas encore sauvegardées.' : 'Tout est sauvegardé.',
    D.sauveLe() ? el('small', ` Dernière sauvegarde : ${new Date(D.sauveLe()).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}.`) : ''
  );

  const fichiers = D.versFichiers();
  const exporter = el('div.boutons',
    el('button.principal', { type: 'button', onclick: () => {
      Object.entries(fichiers).forEach(([f, t], i) => setTimeout(() => telecharger(f.split('/').pop(), t), i * 400));
      D.marquerSauve();
      rafraichir();
    } }, 'Télécharger les 3 fichiers'),
    Object.entries(fichiers).map(([f, t]) => el('button.discret', { type: 'button', onclick: () => telecharger(f.split('/').pop(), t) }, f.split('/').pop()))
  );

  const choixFichier = el('input', { type: 'file', accept: '.json,application/json', multiple: true, hidden: true, onchange: async e => {
    const lus = {};
    for (const f of e.target.files) {
      try { lus[f.name] = JSON.parse(await f.text()); } catch (err) { annonce(`${f.name} n'est pas un fichier JSON valide.`, 'erreur'); return; }
    }
    annonce(D.fusionner(lus, true) ? 'Fichiers importés et fusionnés.' : 'Rien de nouveau dans ces fichiers.');
    rafraichir();
  } });

  // ---------- GitHub ----------
  const g = r.gh;
  const champ = (cle, texte, attrs = {}) => el('label.champ', el('span', texte), el('input', {
    type: 'text', value: g[cle], autocomplete: 'off', spellcheck: false, ...attrs,
    onchange: e => D.regler({ gh: { ...D.reglages().gh, [cle]: e.target.value.trim() } })
  }));
  const occupe = async (bouton, action) => {
    bouton.disabled = true;
    try { await action(); rafraichir(); } catch (err) { annonce(err.message || 'Erreur réseau.', 'erreur'); }
    finally { bouton.disabled = false; }
  };
  const btTester = el('button.discret', { type: 'button', onclick: () => occupe(btTester, async () => annonce(`Connexion OK : ${await GH.tester()}`)) }, 'Tester');
  const btRecup = el('button.discret', { type: 'button', onclick: () => occupe(btRecup, async () => annonce(await GH.recuperer() ? 'Données du dépôt fusionnées.' : 'Déjà à jour.')) }, 'Récupérer');
  const btEnvoyer = el('button.principal', { type: 'button', onclick: () => occupe(btEnvoyer, () => envoyerSurGitHub()) }, 'Envoyer sur GitHub');

  racine.replaceChildren(
    section('Midis à prévoir',
      el('p.aide', 'Le soir est toujours à prévoir. Le midi, seulement dans ces cas (sinon il reste discret, pour les restes) :'),
      caseACocher('Pendant les vacances scolaires', r.midiVacances, e => D.regler({ midiVacances: e.target.checked })),
      caseACocher('Les jours fériés', r.midiFeries, e => D.regler({ midiFeries: e.target.checked })),
      el('p.aide', 'Et chaque semaine, ces jours-là :'),
      jours
    ),
    section('Vacances scolaires',
      el('p', `Académie de ${ACADEMIE} (zone C).`),
      el('p.aide', 'Vacances et jours fériés viennent des sites officiels (education.gouv.fr, api.gouv.fr), sont gardés sur l\'appareil et rafraîchis chaque semaine.'),
      el('div.boutons', btCalendrier)
    ),
    section('Éviter les répétitions',
      el('label.champ.en-ligne', el('span', 'Ne pas reproposer un plat servi il y a moins de'), delai, el('span', 'jours')),
      el('p.aide', 'Les plats trop proches sont signalés en orange et placés en fin de liste.')
    ),
    section('Sauvegarde',
      etat,
      el('h3', 'Sur GitHub (direct)'),
      el('p.aide', 'Un commit par envoi dans data/. Jeton conseillé : « fine-grained », limité à ce dépôt, permission « Contents : Read and write ». Il reste sur cet appareil.'),
      el('div.deux-colonnes', champ('proprio', 'Propriétaire'), champ('depot', 'Dépôt')),
      el('div.deux-colonnes', champ('branche', 'Branche'), champ('jeton', 'Jeton', { type: 'password', placeholder: 'github_pat_…' })),
      caseACocher('Récupérer le dépôt à l\'ouverture de l\'appli', g.auto, e => D.regler({ gh: { ...D.reglages().gh, auto: e.target.checked } })),
      el('div.boutons', btEnvoyer, btRecup, btTester),
      el('h3', 'Par fichiers'),
      el('p.aide', 'À déposer dans le dossier data/ du dépôt (puis commit). L\'import fusionne : le plus récent gagne, rien n\'est effacé.'),
      exporter,
      el('div.boutons', el('button.discret', { type: 'button', onclick: () => choixFichier.click() }, 'Importer des fichiers…'), choixFichier)
    ),
    section('Repartir des fichiers du dépôt',
      el('p.aide', 'Oublie la copie locale de cet appareil et recharge data/*.json. Les réglages sont gardés.'),
      el('button.danger', { type: 'button', onclick: () => {
        if (D.aSauver() && !confirm('Des modifications ne sont pas sauvegardées et seront perdues. Continuer ?')) return;
        D.oublierLocal();
        location.reload();
      } }, 'Repartir des fichiers du dépôt')
    )
  );
}

export async function envoyerSurGitHub() {
  if (!GH.configure()) { annonce('Renseigne d\'abord le jeton GitHub dans les réglages.', 'erreur'); return false; }
  const n = await GH.envoyer(`Menus : mise à jour du ${aujourdhui()}`);
  annonce(n ? `Envoyé sur GitHub (${n} fichier${n > 1 ? 's' : ''}).` : 'GitHub était déjà à jour.');
  return true;
}

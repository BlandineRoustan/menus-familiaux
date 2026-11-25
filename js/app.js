// Point d'entrée : onglets, chargement des données du dépôt, synchronisation au démarrage.
import * as D from './donnees.js';
import * as GH from './github.js';
import { actualiser } from './calendrier.js';
import * as Planning from './planning.js';
import * as Idees from './idees.js';
import * as Reglages from './reglages.js';
import { el, annonce } from './ui.js';

const ONGLETS = [
  { id: 'planning', nom: 'Menus', vue: Planning },
  { id: 'idees', nom: 'Idées', vue: Idees },
  { id: 'reglages', nom: 'Réglages', vue: Reglages }
];
let onglet = ONGLETS.some(o => o.id === location.hash.slice(1)) ? location.hash.slice(1) : 'planning';

const app = document.getElementById('app');
const principal = el('main');
const indicateur = el('button.indicateur', { type: 'button', onclick: sauvegarder });
const nav = el('nav.onglets');
app.replaceChildren(
  el('header.entete', el('h1', el('button.accueil', { type: 'button', onclick: accueil, 'aria-label': 'Accueil : menus à partir d\'aujourd\'hui' },
    el('span.logo', { 'aria-hidden': 'true' }), 'Menus')), nav, indicateur),
  principal
);

function allerA(id) {
  onglet = id;
  history.replaceState(null, '', '#' + id);
  rafraichir();
  scrollTo(0, 0);
}

// Logo : retour à l'accueil (menus à partir d'aujourd'hui).
function accueil() {
  Planning.revenirAujourdhui();
  allerA('planning');
}

function dessinerEntete() {
  indicateur.hidden = !D.aSauver();
  indicateur.textContent = GH.configure() ? 'Envoyer sur GitHub' : 'À sauvegarder';
  nav.replaceChildren(...ONGLETS.map(o => el('button' + (o.id === onglet ? '.actif' : ''), {
    type: 'button', onclick: () => allerA(o.id)
  }, o.nom)));
}

function rafraichir() {
  // On garde le focus dans le champ de recherche si on y était (la vue est redessinée).
  const focus = document.activeElement?.matches?.('main .recherche');
  dessinerEntete();
  ONGLETS.find(o => o.id === onglet).vue.afficher(principal, rafraichir);
  if (focus) principal.querySelector('.recherche')?.focus();
}

// Les réglages ne sont pas redessinés à chaque changement (on perdrait le clic en cours).
D.surChangement(() => { if (onglet === 'reglages') dessinerEntete(); else rafraichir(); });

async function sauvegarder() {
  if (!GH.configure()) { allerA('reglages'); return; }
  indicateur.disabled = true;
  try { await Reglages.envoyerSurGitHub(); } catch (e) { annonce(e.message || 'Erreur réseau.', 'erreur'); }
  finally { indicateur.disabled = false; }
}

async function demarrer() {
  rafraichir();
  // 1. Fichiers publiés avec l'appli (GitHub Pages) : la base commune.
  const lus = {};
  await Promise.all(D.FICHIERS.map(async f => {
    try { const r = await fetch(f, { cache: 'no-cache' }); if (r.ok) lus[f] = await r.json(); } catch (e) { /* hors-ligne */ }
  }));
  D.fusionner(lus);
  // 2. Le dépôt lui-même (plus frais que GitHub Pages, qui met une minute à se mettre à jour).
  if (GH.configure() && D.reglages().gh.auto) {
    try { await GH.recuperer(); } catch (e) { annonce('GitHub : ' + e.message, 'erreur'); }
  }
  // 3. Vacances et jours fériés.
  try { if (await actualiser()) rafraichir(); } catch (e) { /* hors-ligne */ }
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
demarrer();

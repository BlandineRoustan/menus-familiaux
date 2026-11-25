// Onglet Idées : les idées de plats (ajout, renommage, archivage, historique, ingrédients)
// et le catalogue des ingrédients (nom, type).
import * as D from './donnees.js';
import { aujourdhui, dateCourte, dateLongue } from './dates.js';
import { el, feuille, annonce } from './ui.js';

let vue = 'idees';   // 'idees' | 'ingredients'
let filtre = '';
let ordre = 'alpha'; // 'alpha' | 'oubli' (les moins récemment servis d'abord)
let service = '';    // '' = tous | id d'un service (entree, plat…) | 'aucun' (jamais servi) | 'sans-ingr'
let filtreIngr = '';

// Pastilles « Entrée 3 · Plat 1 » : comment le mets a été servi jusqu'ici.
function badgesServices(id) {
  const sv = D.services(id);
  const l = D.SERVICES.filter(s => sv[s.id]).map(s => el(`span.mets.petit.m-${s.id}`, `${s.nom} ${sv[s.id]}`));
  return l.length ? el('span.badges-services', l) : null;
}
// « Souvent servi avec » : les mets des mêmes repas, colorés selon le service où ils l'ont accompagné.
function compagnonsDe(id) {
  const l = D.compagnons(id).slice(0, 10);
  if (!l.length) return null;
  return el('div.compagnons',
    el('h3', 'Souvent servi avec'),
    el('div.badges-services', l.map(c => {
      const s = D.SERVICES.reduce((m, x) => c.services[x.id] > c.services[m.id] ? x : m, D.SERVICES[0]);
      return el(`span.mets.m-${s.id}`, { title: `${c.n} repas ensemble` }, `${D.nomPlat(c.id)} `, el('b', `×${c.n}`));
    }))
  );
}
const total = sv => Object.values(sv).reduce((a, b) => a + b, 0);

function resumeUsage(id, aujd) {
  const u = D.usages(id);
  const passes = u.filter(x => x <= aujd);
  const futurs = u.filter(x => x > aujd);
  const morceaux = [];
  morceaux.push(passes.length ? `servi le ${dateCourte(passes[passes.length - 1])}${passes.length > 1 ? ` (${passes.length} fois)` : ''}` : 'jamais servi');
  if (futurs.length) morceaux.push(`prévu le ${dateCourte(futurs[0])}`);
  return morceaux.join(' · ');
}

// Pastille d'un ingrédient, colorée selon son type.
export function pastilleIngr(id, attrs = {}, ...suite) {
  const i = D.ingredient(id);
  return el(`span.ingr.t-${i?.type || 'autre'}`, { title: D.nomType(i?.type), ...attrs }, D.nomIngredient(id), ...suite);
}
// Boutons de choix d'un type (création ou modification d'un ingrédient).
const choixTypes = (actuel, choisir) => el('div.types-choix', D.types().map(t =>
  el(`button.ingr.t-${t.id}` + (t.id === actuel ? '.actif' : ''), { type: 'button', onclick: () => choisir(t.id) }, t.nom)));

// Correspondance souple : début de mot du nom, ou identifiant (« pdt »).
const correspond = (i, q) => !q || D.cleRecherche(i.nom).split(/[\s,()'-]+/).some(m => m.startsWith(q))
  || D.cleRecherche(i.nom).startsWith(q) || i.id.startsWith(q);

// Ingrédients d'un plat dans l'ordre du catalogue (féculents, légumes, protéines…).
const rang = id => { const i = D.catalogue().findIndex(x => x.id === id); return i < 0 ? 1e9 : i; };
const ingredientsTries = platId => [...D.ingredientsDe(platId)].sort((a, b) => rang(a) - rang(b));

// Ligne discrète d'ingrédients sous une idée ; ceux qui répondent à la recherche sont mis en avant.
function ligneIngredients(platId, trouves) {
  const l = ingredientsTries(platId);
  return l.length ? el('span.ingr-idee', l.map(id => el(`span.ingr.petit.t-${D.ingredient(id)?.type || 'autre'}` + (trouves.has(id) ? '.trouve' : ''), D.nomIngredient(id)))) : null;
}

// Recherche d'idées : par nom, ou par ingrédient (« lardons », « pdt », « pom »…).
function chercherIdees(q) {
  const ingr = new Set(q ? D.catalogue().filter(i => correspond(i, q)).map(i => i.id) : []);
  const parNom = p => !q || D.cleRecherche(p.nom).includes(q);
  const parIngr = p => D.ingredientsDe(p.id).some(id => ingr.has(id));
  return { ingr, garde: p => parNom(p) || parIngr(p), parIngr: p => !parNom(p) && parIngr(p) };
}

// ---------- Ingrédients d'un plat (dans sa fiche) ----------
function editeurIngredients(platId) {
  const boite = el('div.ingredients-plat');
  const champ = el('input.recherche', { type: 'search', placeholder: 'Ajouter un ingrédient (ex. pdt, riz, bœuf…)', autocomplete: 'off', enterKeyHint: 'done' });
  const choisis = el('div.ingr-choisis');
  const props = el('div.ingr-propositions');

  const ajouter = id => {
    D.definirIngredients(platId, [...D.ingredientsDe(platId), id]);
    champ.value = '';
    dessiner();
    champ.focus();
  };
  const retirer = id => { D.definirIngredients(platId, D.ingredientsDe(platId).filter(x => x !== id)); dessiner(); };

  function dessiner() {
    const dans = D.ingredientsDe(platId);
    choisis.replaceChildren(...(dans.length
      ? ingredientsTries(platId).map(id => pastilleIngr(id, {},
        el('button', { type: 'button', 'aria-label': `Retirer ${D.nomIngredient(id)}`, onclick: () => retirer(id) }, '×')))
      : [el('span.rien', 'Aucun ingrédient pour l\'instant.')]));

    const texte = champ.value.trim();
    const q = D.cleRecherche(texte);
    if (!q) { props.replaceChildren(); return; }
    const trouves = D.catalogue().filter(i => !dans.includes(i.id) && correspond(i, q)).slice(0, 10);
    const exact = D.trouverIngredient(texte);
    props.replaceChildren(
      ...trouves.map(i => pastilleIngr(i.id, { role: 'button', tabindex: 0, class: `ingr t-${i.type} cliquable`, onclick: () => ajouter(i.id) })),
      exact ? '' : el('div.nouvel-ingr', el('span', `＋ « ${texte} » est un :`), choixTypes(null, type => ajouter(D.ajouterIngredient(texte, type).id)))
    );
  }
  champ.addEventListener('input', dessiner);
  champ.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const texte = champ.value.trim();
    if (!texte) return;
    const exact = D.trouverIngredient(texte);
    const dans = D.ingredientsDe(platId);
    const trouves = D.catalogue().filter(i => !dans.includes(i.id) && correspond(i, D.cleRecherche(texte)));
    if (exact) ajouter(exact.id);
    else if (trouves.length === 1) ajouter(trouves[0].id);
  });
  dessiner();
  boite.append(choisis, champ, props);
  return boite;
}

// ---------- Vue : idées ----------
function afficherIdees(racine) {
  const aujd = aujourdhui();
  const champ = el('input.recherche', { type: 'search', placeholder: 'Chercher (nom ou ingrédient) ou ajouter…', value: filtre, autocomplete: 'off', enterKeyHint: 'done' });
  const liste = el('ul.idees');
  const archives = el('div');

  const ajouter = () => {
    const nom = champ.value.trim();
    if (!nom) return;
    const deja = D.trouverPlat(nom);
    const p = D.ajouterPlat(nom);
    annonce(deja && !deja.archive ? `« ${p.nom} » existe déjà.` : `« ${p.nom} » ajouté aux idées.`);
    filtre = '';
  };

  const remplir = () => {
    const q = D.cleRecherche(champ.value);
    const r = chercherIdees(q);
    let plats = D.platsActifs().filter(r.garde);
    if (service === 'aucun') plats = plats.filter(p => !total(D.services(p.id)));
    else if (service === 'sans-ingr') plats = plats.filter(p => !D.ingredientsDe(p.id).length);
    else if (service) plats = plats.filter(p => D.services(p.id)[service] > 0);
    if (ordre === 'oubli') {
      const dernier = id => D.usages(id).filter(x => x <= aujd).pop() || '';
      plats = plats.sort((a, b) => dernier(a.id).localeCompare(dernier(b.id)));
    }
    const items = plats.map(p => el('li', el('button.idee', { type: 'button', onclick: () => fiche(p.id) },
      el('span.idee-gauche', el('span.nom', p.nom), badgesServices(p.id), ligneIngredients(p.id, r.ingr)),
      el('small', resumeUsage(p.id, aujd))
    )));
    const nom = champ.value.trim();
    if (nom && !D.trouverPlat(nom)) {
      const nouvelle = el('li', el('button.idee.nouvelle', { type: 'button', onclick: ajouter }, el('span.nom', `＋ Ajouter « ${nom} »`)));
      // Si la recherche trouve des idées par leurs ingrédients, la proposition d'ajout passe en fin de liste.
      if (plats.some(r.parIngr)) items.push(nouvelle); else items.unshift(nouvelle);
    }
    if (!items.length) items.push(el('li.rien', q || service ? 'Aucune idée ne correspond.' : 'Aucune idée pour l\'instant : tape un nom de plat ci-dessus.'));
    liste.replaceChildren(...items);

    const arch = D.platsArchives().filter(r.garde);
    archives.replaceChildren(arch.length ? el('details.archives',
      el('summary', `Idées archivées (${arch.length})`),
      el('ul.idees', arch.map(p => el('li', el('button.idee', { type: 'button', onclick: () => fiche(p.id) },
        el('span.nom', p.nom), el('small', resumeUsage(p.id, aujd))))))
    ) : '');
  };
  champ.addEventListener('input', () => { filtre = champ.value; remplir(); });
  champ.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ajouter(); } });

  const tri = el('select', { 'aria-label': 'Ordre', onchange: e => { ordre = e.target.value; remplir(); } },
    el('option', { value: 'alpha', selected: ordre === 'alpha' }, 'A → Z'),
    el('option', { value: 'oubli', selected: ordre === 'oubli' }, 'À ressortir (les plus anciens)')
  );

  const sansIngr = D.platsActifs().filter(p => !D.ingredientsDe(p.id).length).length;
  const filtres = el('div.filtres', { role: 'group', 'aria-label': 'Filtre' },
    [['', 'Toutes'], ...D.SERVICES.map(s => [s.id, s.pluriel]), ['aucun', 'Jamais servies'], ['sans-ingr', `Sans ingrédients (${sansIngr})`]].map(([v, t]) => {
      const b = el('button.puce-note' + (v ? `.f-${v}` : '') + (service === v ? '.actif' : ''), { type: 'button', onclick: () => {
        service = v;
        filtres.querySelectorAll('button').forEach(x => x.classList.toggle('actif', x === b));
        remplir();
      } }, t);
      return b;
    }));

  remplir();
  racine.append(
    el('div.barre-idees', champ, tri),
    filtres,
    el('p.resume', el('span', `${D.platsActifs().length} idées`)),
    liste,
    archives
  );
}

// ---------- Vue : catalogue des ingrédients ----------
function afficherIngredients(racine) {
  const champ = el('input.recherche', { type: 'search', placeholder: 'Chercher ou ajouter un ingrédient…', value: filtreIngr, autocomplete: 'off', enterKeyHint: 'done' });
  const liste = el('div.catalogue');
  const remplir = () => {
    const texte = champ.value.trim();
    const q = D.cleRecherche(texte);
    const groupes = D.types().map(t => ({ t, l: D.catalogue().filter(i => (i.type === t.id || (t.id === 'autre' && !D.types().some(x => x.id === i.type))) && correspond(i, q)) }))
      .filter(g => g.l.length);
    liste.replaceChildren(
      texte && !D.trouverIngredient(texte)
        ? el('div.nouvel-ingr', el('span', `＋ Ajouter « ${texte} » comme :`), choixTypes(null, type => {
          const i = D.ajouterIngredient(texte, type);
          annonce(`« ${i.nom} » ajouté (${D.nomType(type).toLowerCase()}).`);
          filtreIngr = '';
        }))
        : '',
      ...groupes.map(({ t, l }) => el('section.groupe-ingr',
        el('h3', el(`i.pastille.t-${t.id}`), `${t.nom} (${l.length})`),
        el('div.types-choix', l.map(i => el(`button.ingr.t-${i.type}`, { type: 'button', onclick: () => ficheIngredient(i.id) }, i.nom)))
      )),
      groupes.length || texte ? '' : el('p.rien', 'Catalogue vide.')
    );
  };
  champ.addEventListener('input', () => { filtreIngr = champ.value; remplir(); });
  remplir();
  racine.append(
    el('div.barre-idees', champ),
    el('p.resume', el('span', `${D.catalogue().length} ingrédients · touche un ingrédient pour le renommer ou changer son type`)),
    liste
  );
}

export function afficher(racine) {
  const bascule = el('div.bascule', { role: 'group', 'aria-label': 'Afficher' },
    el('button' + (vue === 'idees' ? '.actif' : ''), { type: 'button', onclick: () => { vue = 'idees'; afficher(racine); } }, 'Idées'),
    el('button' + (vue === 'ingredients' ? '.actif' : ''), { type: 'button', onclick: () => { vue = 'ingredients'; afficher(racine); } }, 'Ingrédients'));
  racine.replaceChildren(el('div.barre-vue', bascule));
  if (vue === 'ingredients') afficherIngredients(racine); else afficherIdees(racine);
}

// ---------- Fiches ----------
function fiche(id) {
  feuille((dlg, fermer) => {
    const p = D.plat(id);
    const aujd = aujourdhui();
    const nom = el('input.recherche', { type: 'text', value: p.nom, 'aria-label': 'Nom du plat' });
    const valider = () => {
      const v = nom.value.trim();
      if (!v || v === p.nom) return;
      const autre = D.trouverPlat(v);
      if (autre && autre.id !== id) { annonce(`« ${autre.nom} » existe déjà.`, 'erreur'); nom.value = p.nom; return; }
      D.modifierPlat(id, { nom: v });
    };
    nom.addEventListener('change', valider);
    const occ = [...D.occurrences(id)].reverse();
    dlg.append(el('div.feuille-contenu',
      el('header.feuille-tete', el('div', el('h2', 'Idée'), el('p.sous-titre', resumeUsage(id, aujd)))),
      el('label.champ', el('span', 'Nom'), nom),
      badgesServices(id),
      el('div.section-ingr', el('h3', 'Ingrédients ', el('small', '(facultatif : sert à l\'équilibre féculents / légumes)')), editeurIngredients(id)),
      compagnonsDe(id),
      occ.length ? el('div.historique',
        el('h3', 'Historique'),
        el('ul', occ.slice(0, 40).map(o => el('li' + (o.iso > aujd ? '.futur' : ''),
          `${dateLongue(o.iso)}, ${o.repas} `,
          el(`span.mets.petit.m-${o.service}`, D.SERVICES.find(s => s.id === o.service).nom))))
      ) : el('p.rien', 'Pas encore utilisé dans un menu.'),
      el('footer.feuille-pied',
        el('button.discret', { type: 'button', onclick: () => {
          const archiver = !p.archive;
          D.modifierPlat(id, { archive: archiver });
          annonce(archiver ? `« ${p.nom} » archivé : il n'est plus proposé.` : `« ${p.nom} » de nouveau proposé.`);
          fermer();
        } }, p.archive ? 'Réactiver' : 'Archiver'),
        el('button.principal', { type: 'button', onclick: () => { valider(); fermer(); } }, 'Fermer')
      )
    ));
  });
}

function ficheIngredient(id) {
  feuille((dlg, fermer) => {
    const i = D.ingredient(id);
    const nom = el('input.recherche', { type: 'text', value: i.nom, 'aria-label': 'Nom de l\'ingrédient' });
    const valider = () => {
      const v = nom.value.trim();
      if (!v || v === i.nom) return;
      const autre = D.trouverIngredient(v);
      if (autre && autre.id !== id) { annonce(`« ${autre.nom} » existe déjà.`, 'erreur'); nom.value = i.nom; return; }
      D.modifierIngredient(id, { nom: v });
    };
    nom.addEventListener('change', valider);
    const types = el('div');
    const dessinerTypes = () => types.replaceChildren(choixTypes(i.type, t => { D.modifierIngredient(id, { type: t }); dessinerTypes(); }));
    dessinerTypes();
    const plats = D.platsAvecIngredient(id);
    dlg.append(el('div.feuille-contenu',
      el('header.feuille-tete', el('div', el('h2', 'Ingrédient'), el('p.sous-titre', `identifiant : ${id}`))),
      el('label.champ', el('span', 'Nom'), nom),
      el('div.champ', el('span', 'Type'), types),
      plats.length
        ? el('div.historique', el('h3', `Dans ${plats.length} idée${plats.length > 1 ? 's' : ''}`), el('ul', plats.map(p => el('li', p.nom))))
        : el('p.rien', 'Utilisé dans aucune idée pour l\'instant.'),
      el('footer.feuille-pied', el('button.principal', { type: 'button', onclick: () => { valider(); fermer(); } }, 'Fermer'))
    ));
  });
}

// Liste des idées de plats : ajout, renommage, archivage, historique d'utilisation.
import * as D from './donnees.js';
import { aujourdhui, dateCourte, dateLongue } from './dates.js';
import { el, feuille, annonce } from './ui.js';

let filtre = '';
let ordre = 'alpha'; // 'alpha' | 'oubli' (les moins récemment servis d'abord)
let service = '';    // '' = tous | id d'un service (entree, plat…) | 'aucun' (jamais servi)

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

export function afficher(racine) {
  const aujd = aujourdhui();
  const champ = el('input.recherche', { type: 'search', placeholder: 'Chercher ou ajouter une idée…', value: filtre, autocomplete: 'off', enterKeyHint: 'done' });
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
    let plats = D.platsActifs().filter(p => !q || D.cleRecherche(p.nom).includes(q));
    if (service === 'aucun') plats = plats.filter(p => !total(D.services(p.id)));
    else if (service) plats = plats.filter(p => D.services(p.id)[service] > 0);
    if (ordre === 'oubli') {
      const dernier = id => D.usages(id).filter(x => x <= aujd).pop() || '';
      plats = plats.sort((a, b) => dernier(a.id).localeCompare(dernier(b.id)));
    }
    const items = plats.map(p => el('li', el('button.idee', { type: 'button', onclick: () => fiche(p.id) },
      el('span.idee-gauche', el('span.nom', p.nom), badgesServices(p.id)),
      el('small', resumeUsage(p.id, aujd))
    )));
    const nom = champ.value.trim();
    if (nom && !D.trouverPlat(nom)) items.unshift(el('li', el('button.idee.nouvelle', { type: 'button', onclick: ajouter }, el('span.nom', `＋ Ajouter « ${nom} »`))));
    if (!items.length) items.push(el('li.rien', q ? 'Aucune idée ne correspond.' : 'Aucune idée pour l\'instant : tape un nom de plat ci-dessus.'));
    liste.replaceChildren(...items);

    const arch = D.platsArchives().filter(p => !q || D.cleRecherche(p.nom).includes(q));
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

  const filtres = el('div.filtres', { role: 'group', 'aria-label': 'Service' },
    [['', 'Toutes'], ...D.SERVICES.map(s => [s.id, s.pluriel]), ['aucun', 'Jamais servies']].map(([v, t]) => {
      const b = el('button.puce-note' + (v ? `.f-${v}` : '') + (service === v ? '.actif' : ''), { type: 'button', onclick: () => {
        service = v;
        filtres.querySelectorAll('button').forEach(x => x.classList.toggle('actif', x === b));
        remplir();
      } }, t);
      return b;
    }));

  remplir();
  racine.replaceChildren(
    el('div.barre-idees', champ, tri),
    filtres,
    el('p.resume', el('span', `${D.platsActifs().length} idées`)),
    liste,
    archives
  );
}

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
      compagnonsDe(id),
      occ.length ? el('div.historique',
        el('h3', 'Historique'),
        el('ul', occ.slice(0, 40).map(o => el('li' + (o.iso > aujd ? '.futur' : ''),
          `${dateLongue(o.iso)}, ${o.repas} `,
          el(`span.mets.petit.m-${o.service}`, D.SERVICES.find(s => s.id === o.service).nom))))
      ) : el('p.rien', 'Pas encore utilisé dans un menu.'),
      el('p.aide', 'Ingrédients et types (féculents…) : prévus pour une prochaine version, la structure des données est prête.'),
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

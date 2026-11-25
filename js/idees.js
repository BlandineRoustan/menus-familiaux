// Liste des idées de plats : ajout, renommage, archivage, historique d'utilisation.
import * as D from './donnees.js';
import { aujourdhui, dateCourte, dateLongue } from './dates.js';
import { el, feuille, annonce } from './ui.js';

let filtre = '';
let ordre = 'alpha'; // 'alpha' | 'oubli' (les moins récemment servis d'abord)

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
    if (ordre === 'oubli') {
      const dernier = id => D.usages(id).filter(x => x <= aujd).pop() || '';
      plats = plats.sort((a, b) => dernier(a.id).localeCompare(dernier(b.id)));
    }
    const items = plats.map(p => el('li', el('button.idee', { type: 'button', onclick: () => fiche(p.id) },
      el('span.nom', p.nom),
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

  remplir();
  racine.replaceChildren(
    el('div.barre-idees', champ, tri),
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
    const dates = [...D.usages(id)].reverse();
    dlg.append(el('div.feuille-contenu',
      el('header.feuille-tete', el('div', el('h2', 'Idée de plat'), el('p.sous-titre', resumeUsage(id, aujd)))),
      el('label.champ', el('span', 'Nom'), nom),
      dates.length ? el('div.historique',
        el('h3', 'Historique'),
        el('ul', dates.slice(0, 40).map(x => el('li' + (x > aujd ? '.futur' : ''), dateLongue(x))))
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

// Synchronisation directe avec le dépôt GitHub (API REST), avec un jeton personnel stocké sur l'appareil.
// Jeton conseillé : « fine-grained », limité à ce dépôt, permission Contents en lecture/écriture.
import { reglages, fusionner, versFichiers, marquerSauve, FICHIERS } from './donnees.js';

const API = 'https://api.github.com';

async function appel(chemin, options = {}) {
  const { jeton } = reglages().gh;
  const rep = await fetch(API + chemin, {
    ...options,
    cache: 'no-store',
    headers: {
      Accept: options.brut ? 'application/vnd.github.raw+json' : 'application/vnd.github+json',
      Authorization: `Bearer ${jeton}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(options.body ? { 'Content-Type': 'application/json' } : {})
    }
  });
  if (!rep.ok) {
    const e = new Error(messageErreur(rep.status));
    e.status = rep.status;
    throw e;
  }
  return options.brut ? rep.text() : rep.json();
}

function messageErreur(status) {
  if (status === 401) return 'Jeton refusé (expiré ou mal copié).';
  if (status === 403) return 'Accès refusé : le jeton n\'a pas le droit d\'écrire dans ce dépôt.';
  if (status === 404) return 'Dépôt, branche ou fichier introuvable (ou jeton sans accès à ce dépôt).';
  if (status === 409 || status === 422) return 'Le dépôt a changé pendant l\'envoi.';
  return `Erreur GitHub ${status}.`;
}

export const configure = () => { const g = reglages().gh; return !!(g.jeton && g.proprio && g.depot && g.branche); };
const base = () => { const g = reglages().gh; return `/repos/${g.proprio}/${g.depot}`; };

// Lit les fichiers de données au dernier commit de la branche. Renvoie { sha, textes }.
async function lire() {
  const ref = await appel(`${base()}/git/ref/heads/${reglages().gh.branche}`);
  const sha = ref.object.sha;
  const textes = {};
  await Promise.all(FICHIERS.map(async f => {
    try { textes[f] = await appel(`${base()}/contents/${f}?ref=${sha}`, { brut: true }); }
    catch (e) { if (e.status !== 404) throw e; } // fichier pas encore créé : il le sera à l'envoi
  }));
  return { sha, textes };
}

const analyser = textes => Object.fromEntries(Object.entries(textes).map(([f, t]) => {
  try { return [f, JSON.parse(t)]; } catch (e) { return [f, null]; }
}));

// Récupère le dépôt et le fusionne dans la copie locale. Renvoie true si quelque chose a changé.
export async function recuperer() {
  const { textes } = await lire();
  return fusionner(analyser(textes));
}

// Récupère, fusionne, puis envoie en un seul commit les fichiers qui ont changé.
export async function envoyer(message) {
  for (let essai = 0; essai < 3; essai++) {
    const { sha, textes } = await lire();
    fusionner(analyser(textes));
    const nouveaux = versFichiers();
    const changes = Object.keys(nouveaux).filter(f => nouveaux[f] !== textes[f]);
    if (!changes.length) { marquerSauve(); return 0; }
    try {
      const commit = await appel(`${base()}/git/commits/${sha}`);
      const arbre = await appel(`${base()}/git/trees`, {
        method: 'POST',
        body: JSON.stringify({
          base_tree: commit.tree.sha,
          tree: changes.map(path => ({ path, mode: '100644', type: 'blob', content: nouveaux[path] }))
        })
      });
      const nouveau = await appel(`${base()}/git/commits`, {
        method: 'POST',
        body: JSON.stringify({ message, tree: arbre.sha, parents: [sha] })
      });
      await appel(`${base()}/git/refs/heads/${reglages().gh.branche}`, {
        method: 'PATCH',
        body: JSON.stringify({ sha: nouveau.sha, force: false })
      });
      marquerSauve();
      return changes.length;
    } catch (e) {
      if (e.status !== 409 && e.status !== 422) throw e; // quelqu'un a poussé entre-temps : on recommence
    }
  }
  throw new Error('Le dépôt change trop souvent, réessaie dans un instant.');
}

export async function tester() {
  const d = await appel(base());
  if (!d.permissions?.push) throw new Error('Le jeton peut lire le dépôt mais pas y écrire.');
  return d.full_name;
}

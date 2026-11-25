// Petits outils d'affichage.

// el('button.cle.autre', { onclick, title }, 'texte', autreNoeud…)
export function el(sel, attrs = {}, ...enfants) {
  // Le 2e argument est facultatif : texte, nœud ou liste = premier enfant.
  if (attrs == null || typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs)) {
    enfants.unshift(attrs);
    attrs = {};
  }
  const [tag, ...classes] = sel.split('.');
  const n = document.createElement(tag || 'div');
  if (classes.length) n.className = classes.join(' ');
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(n.dataset, v);
    else if (k in n && typeof v !== 'string') n[k] = v;
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const e of enfants.flat()) if (e != null && e !== false) n.append(e instanceof Node ? e : String(e));
  return n;
}

let minuteur;
export function annonce(texte, type = '') {
  let t = document.getElementById('annonce');
  if (!t) { t = el('div', { id: 'annonce', role: 'status' }); document.body.append(t); }
  t.textContent = texte;
  t.className = 'visible ' + type;
  clearTimeout(minuteur);
  minuteur = setTimeout(() => { t.className = ''; }, type === 'erreur' ? 6000 : 3000);
}

// Feuille modale (dialog natif). construire(corps, fermer) remplit le contenu.
export function feuille(construire, { classe = '' } = {}) {
  const d = el('dialog.feuille' + (classe ? '.' + classe : ''));
  const fermer = () => d.close();
  d.addEventListener('close', () => d.remove());
  d.addEventListener('click', e => { if (e.target === d) fermer(); }); // clic sur le fond
  document.body.append(d);
  construire(d, fermer);
  d.showModal();
  return { dialog: d, fermer };
}

export function telecharger(nom, texte) {
  const a = el('a', { href: URL.createObjectURL(new Blob([texte], { type: 'application/json' })), download: nom });
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}

// Aides DOM et textes éditables.

export function el(tag, attrs = {}, ...enfants) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of enfants.flat()) {
    if (c === null || c === undefined || c === false) continue;
    e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return e;
}

// Contexte des textes : où chercher un texte et, en mode brouillon, le lien pour le modifier.
export class Textes {
  constructor(contenu, brouillon) {
    this.contenu = contenu;
    this.brouillon = brouillon;
  }

  source(cle, sceneId) {
    if (sceneId && this.contenu.scenes[sceneId]?.textes[cle]) {
      return { t: this.contenu.scenes[sceneId].textes[cle], fichier: `scenes/${sceneId}/textes.md` };
    }
    if (this.contenu.interface[cle]) return { t: this.contenu.interface[cle], fichier: 'textes/interface.md' };
    return null;
  }

  // HTML du texte (ou la clé entre crochets si le texte manque : visible, donc repérable).
  html(cle, sceneId) {
    const s = this.source(cle, sceneId);
    return s ? s.t.html : `[${cle}]`;
  }

  brut(cle, sceneId) {
    const s = this.source(cle, sceneId);
    return s ? s.t.source : `[${cle}]`;
  }

  lienModifier(cle, sceneId) {
    if (!this.brouillon) return null;
    const s = this.source(cle, sceneId);
    if (!s) return null;
    const url = `https://github.com/${this.contenu.depot}/edit/${this.contenu.branche}/${s.fichier}`;
    return el('a', {
      class: 'crayon', href: url, target: '_blank', rel: 'noopener',
      title: `Modifier ce texte : « ## ${cle} » dans ${s.fichier} (ligne ${s.t.ligne})`,
      'aria-label': `Modifier le texte ${cle}`,
    }, '✎');
  }

  // Élément contenant le texte, suivi du crayon en mode brouillon.
  bloc(tag, cle, sceneId, attrs = {}) {
    const e = el(tag, attrs);
    this.remplir(e, cle, sceneId);
    return e;
  }

  remplir(e, cle, sceneId) {
    e.innerHTML = this.html(cle, sceneId);
    e.dataset.texte = cle;
    const l = this.lienModifier(cle, sceneId);
    if (l) e.append(' ', l);
  }
}

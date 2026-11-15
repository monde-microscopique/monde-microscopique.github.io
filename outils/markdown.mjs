// Lecture des fichiers de textes (format « ## nom » + texte) et rendu Markdown minimal.
// Utilisé uniquement à la construction : le site reçoit du HTML déjà prêt.

const NOM_VALIDE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function echapper(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function enLigne(s) {
  return echapper(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

// Rendu d'un bloc Markdown simple : titres ##, listes « - » et « 1. », tableaux, paragraphes.
export function markdownVersHtml(texte) {
  const lignes = texte.replace(/<!--[\s\S]*?-->/g, '').split('\n');
  const sortie = [];
  let i = 0;
  while (i < lignes.length) {
    const l = lignes[i];
    if (!l.trim()) { i++; continue; }
    let m;
    if ((m = l.match(/^(#{1,4})\s+(.*)$/))) {
      const n = Math.min(m[1].length + 1, 5);
      sortie.push(`<h${n}>${enLigne(m[2])}</h${n}>`);
      i++;
    } else if (/^\s*-\s+/.test(l)) {
      const items = [];
      while (i < lignes.length && /^\s*-\s+/.test(lignes[i])) {
        items.push(`<li>${enLigne(lignes[i].replace(/^\s*-\s+/, ''))}</li>`);
        i++;
      }
      sortie.push(`<ul>${items.join('')}</ul>`);
    } else if (/^\s*\d+\.\s+/.test(l)) {
      const items = [];
      while (i < lignes.length && /^\s*\d+\.\s+/.test(lignes[i])) {
        items.push(`<li>${enLigne(lignes[i].replace(/^\s*\d+\.\s+/, ''))}</li>`);
        i++;
      }
      sortie.push(`<ol>${items.join('')}</ol>`);
    } else if (/^\s*\|/.test(l)) {
      const rangees = [];
      while (i < lignes.length && /^\s*\|/.test(lignes[i])) {
        rangees.push(lignes[i].trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim()));
        i++;
      }
      const corps = rangees.filter((r) => !r.every((c) => /^:?-{2,}:?$/.test(c)));
      const [tete, ...reste] = corps;
      sortie.push(
        '<table><thead><tr>' + tete.map((c) => `<th>${enLigne(c)}</th>`).join('') + '</tr></thead><tbody>' +
        reste.map((r) => '<tr>' + r.map((c) => `<td>${enLigne(c)}</td>`).join('') + '</tr>').join('') +
        '</tbody></table>'
      );
    } else {
      const para = [];
      while (i < lignes.length && lignes[i].trim() && !/^(#|\s*-\s|\s*\d+\.\s|\s*\|)/.test(lignes[i])) {
        para.push(lignes[i].trim());
        i++;
      }
      sortie.push(`<p>${enLigne(para.join(' '))}</p>`);
    }
  }
  return sortie.join('\n');
}

// Découpe un fichier de textes en { nom: { source, html, ligne } }.
// Lève une erreur en français, avec le numéro de ligne, si le format est abîmé.
export function lireTextes(contenu, nomFichier) {
  const sansCommentaires = contenu.replace(/<!--[\s\S]*?-->/g, (c) => c.replace(/[^\n]/g, ' '));
  const lignes = sansCommentaires.split('\n');
  const textes = {};
  let courant = null;
  const erreurs = [];
  lignes.forEach((ligne, idx) => {
    const num = idx + 1;
    const m = ligne.match(/^##(.*)$/);
    if (m) {
      const nom = m[1].trim();
      if (!NOM_VALIDE.test(nom)) {
        erreurs.push(`${nomFichier}, ligne ${num} : le titre « ## ${nom} » est abîmé (seuls les minuscules, chiffres et tirets sont permis, sans espace).`);
        courant = null;
        return;
      }
      if (textes[nom]) {
        erreurs.push(`${nomFichier}, ligne ${num} : le texte « ${nom} » existe deux fois.`);
      }
      courant = { nom, lignes: [], ligne: num };
      textes[nom] = courant;
    } else if (/^#(?!#)/.test(ligne)) {
      erreurs.push(`${nomFichier}, ligne ${num} : une ligne commence par un seul « # ». Les titres de textes s'écrivent « ## nom ».`);
    } else if (ligne.trim()) {
      if (!courant) {
        erreurs.push(`${nomFichier}, ligne ${num} : ce texte n'est rattaché à aucun titre « ## nom ».`);
      } else {
        courant.lignes.push(ligne);
      }
    } else if (courant) {
      courant.lignes.push('');
    }
  });
  const resultat = {};
  for (const [nom, t] of Object.entries(textes)) {
    const source = t.lignes.join('\n').trim();
    if (!source) erreurs.push(`${nomFichier}, ligne ${t.ligne} : le texte « ${nom} » est vide.`);
    let html = markdownVersHtml(source);
    // Un paragraphe seul est rendu sans balise <p>, pour s'insérer dans un bouton ou une ligne.
    const seul = html.match(/^<p>([\s\S]*)<\/p>$/);
    if (seul && !seul[1].includes('<p>')) html = seul[1];
    resultat[nom] = { source, html, ligne: t.ligne };
  }
  if (erreurs.length) {
    const e = new Error(erreurs.join('\n'));
    e.erreursTextes = erreurs;
    throw e;
  }
  return resultat;
}

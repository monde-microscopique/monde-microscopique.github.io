// Rendu des équations (notation mhchem, comme le polycopié) en images vectorielles SVG, au moment de la construction.
// Le site n'a donc rien à charger pour les afficher.

import { mathjax } from 'mathjax-full/js/mathjax.js';
import { TeX } from 'mathjax-full/js/input/tex.js';
import { SVG } from 'mathjax-full/js/output/svg.js';
import { liteAdaptor } from 'mathjax-full/js/adaptors/liteAdaptor.js';
import { RegisterHTMLHandler } from 'mathjax-full/js/handlers/html.js';
import 'mathjax-full/js/input/tex/base/BaseConfiguration.js';
import 'mathjax-full/js/input/tex/mhchem/MhchemConfiguration.js';

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const doc = mathjax.document('', { InputJax: new TeX({ packages: ['base', 'mhchem'] }), OutputJax: new SVG({ fontCache: 'none' }) });

export const estEquation = (source) => /^\\ce\{[\s\S]*\}$/.test(source.trim());

export function equationSvg(source) {
  const noeud = doc.convert(source.trim(), { display: true });
  return adaptor.outerHTML(noeud);
}

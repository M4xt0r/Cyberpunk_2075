import { CARACS, COMPETENCES } from "../config.mjs";

/** Minuscules sans accents. */
const normaliser = s => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Noms lisibles → clés de données de jet. Les plus longs d'abord. */
function dictionnaire() {
  const entrees = [];
  for ( const [cle, c] of Object.entries(CARACS) ) {
    for ( const nom of [c.label, c.labelLong, c.abrev, cle] ) if ( nom ) entrees.push([normaliser(nom).replace(/\./g, ""), cle]);
  }
  entrees.push(["capacite technique", "captec"], ["cap tech", "captec"], ["capaciter technique", "captec"], ["reflexe", "ref"], ["sang froid", "safr"]);
  for ( const [cle, c] of Object.entries(COMPETENCES) ) entrees.push([normaliser(c.label), cle], [normaliser(cle), cle]);
  entrees.push(["maitrise", "bm"], ["bm", "bm"], ["medcine", "medecine"]);
  return entrees.sort((a, b) => b[0].length - a[0].length);
}
let DICO = null;

/**
 * Traduit une formule lisible en formule de jet Foundry.
 * « 1d8 + Médecine » → « 1d8 + @medecine » ; « 1d6+1+SaFr » → « 1d6+1+@safr ».
 * @param {string} formule
 * @returns {string}
 */
export function traduireFormule(formule) {
  if ( !formule ) return "0";
  DICO ??= dictionnaire();
  // Le tiret entre deux lettres (« Sang-Froid ») est un espace ; ailleurs c'est un moins
  let s = normaliser(formule).replace(/−/g, "-").replace(/cap\.\s*tech\.?/g, "captec")
    .replace(/([a-z])-(?=[a-z])/g, "$1 ").replace(/\s+/g, " ");
  for ( const [nom, cle] of DICO ) {
    const motif = nom.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s*");
    s = s.replace(new RegExp(`(?<![a-z@])${motif}(?![a-z])`, "g"), `@${cle}`);
  }
  return s;
}

/**
 * Lance une formule lisible avec les données d'un acteur.
 * @param {string} formule
 * @param {Actor} [acteur]
 * @returns {Promise<Roll>}
 */
export async function lancerFormule(formule, acteur) {
  const jet = new Roll(traduireFormule(formule), acteur?.getRollData() ?? {});
  return jet.evaluate();
}

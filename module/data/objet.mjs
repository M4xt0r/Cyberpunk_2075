import { CATEGORIES_OBJET, QUALITES } from "../config.mjs";
import { ItemBase, champsCommuns, niveaux, blocEffet, blocAnimation, entier, choix, booleen } from "./champs.mjs";

/**
 * Objet : utilitaire, consommable ou domestique.
 * Par défaut sans niveaux ; prix, charges et Bloc Effet se remplissent par niveau.
 */
export default class ObjetData extends ItemBase {

  static defineSchema() {
    const communs = champsCommuns();
    communs.sansNiveaux = booleen(true);
    return {
      ...communs,
      categorie: choix("utilitaire", Object.keys(CATEGORIES_OBJET)),
      quantite: entier(1, { min: 0 }),
      sePorte: booleen(false),
      porte: booleen(false),
      uneChargeParUtilisation: booleen(true),
      chargesRestantes: entier(0, { min: 0 }),
      qualite: choix("aucune", Object.keys(QUALITES)),
      usages: new foundry.data.fields.SchemaField({ utilises: entier(0, { min: 0 }) }),
      actif: new foundry.data.fields.SchemaField({
        enCours: booleen(false),
        tours: entier(0, { min: 0 })
      }),
      animation: blocAnimation(),
      niveaux: niveaux(() => ({
        prix: entier(0, { min: 0 }),
        charges: entier(0, { min: 0 }),
        effet: blocEffet()
      }))
    };
  }

  /* -------------------------------------------- */

  get effet() {
    return this.n?.effet;
  }

  get chargesMax() {
    return this.n?.charges ?? 0;
  }

  /** Les modificateurs comptent-ils en ce moment ? */
  get effetActifMaintenant() {
    const e = this.effet;
    if ( !e || (this.quantite <= 0) ) return false;
    if ( this.sePorte && !this.porte ) return false;
    if ( e.type === "actif" ) return this.actif.enCours;
    return true;
  }

  /** @override */
  get modificateursActifs() {
    if ( !this.effetActifMaintenant ) return [];
    return this.effet.modificateurs.filter(m => m.cible && m.valeur);
  }

  /** Nombre d'utilisations max (BM fois : bonus de maîtrise du porteur). */
  get utilisationsMax() {
    const u = this.effet?.utilisations;
    if ( !u || (u.periode === "illimite") ) return null;
    if ( u.periode === "bm" ) return this.porteur?.system?.maitrise?.valeur ?? 2;
    return u.max || null;
  }

  get utilisationsRestantes() {
    const max = this.utilisationsMax;
    return (max === null) ? null : Math.max(0, max - this.usages.utilises);
  }

  /** L'objet a-t-il un bouton Utiliser ? */
  get utilisable() {
    const e = this.effet;
    if ( this.qualite !== "aucune" ) return true;
    if ( this.categorie === "consommable" ) return true;
    return !!e && ((e.type === "actif") || !!e.jet.formule || (e.coutHumanite !== 0));
  }

  /** Raison pour laquelle l'objet ne peut pas servir, ou null. */
  get blocage() {
    if ( this.quantite <= 0 ) return "Épuisé";
    if ( this.utilisationsRestantes === 0 ) return "Plus d'utilisation";
    return null;
  }

  /** Coût en Humanité d'une utilisation (Bloc Effet + qualité de la nourriture). */
  get coutHumaniteTotal() {
    return (this.effet?.coutHumanite ?? 0) + (QUALITES[this.qualite]?.humanite ?? 0);
  }
}

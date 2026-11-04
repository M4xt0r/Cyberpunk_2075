import { EMPLACEMENTS, TYPES_ARME, ANIM, CAPSULE_DE, CAPSULE_PRIX, CAPSULE_COUT, CAPSULES } from "../config.mjs";
import { ItemBase, champsCommuns, niveaux, blocEffet, entier, texte, choix, booleen } from "./champs.mjs";
import { MixinAttaque, champsAttaque, champsDegatsNiveau } from "./attaque-mixin.mjs";

const f = foundry.data.fields;
const chemin = () => new f.FilePathField({ categories: ["IMAGE", "VIDEO", "AUDIO"], required: false, blank: true, initial: "" });

/** Utilisations et effet en cours, communs aux items à effet actif. */
const champsActif = () => ({
  usages: new f.SchemaField({ utilises: entier(0, { min: 0 }) }),
  actif: new f.SchemaField({ enCours: booleen(false), tours: entier(0, { min: 0 }) })
});

/** Calcul des utilisations restantes, partagé. */
export function utilisationsMax(sys) {
  const u = sys.effet?.utilisations;
  if ( !u || (u.periode === "illimite") ) return null;
  if ( u.periode === "bm" ) return sys.porteur?.system?.maitrise?.valeur ?? 2;
  return u.max || null;
}

/* ============================================ */
/*  Implant                                     */
/* ============================================ */

/**
 * Implant : emplacement, coût d'installation, Bloc Effet par niveau,
 * slots d'amélioration, arme intégrée, capsule (bras), animations d'implant actif.
 */
export default class ImplantData extends MixinAttaque(ItemBase) {

  static defineSchema() {
    return {
      ...champsCommuns(),
      ...champsAttaque(),
      ...champsActif(),
      emplacement: choix("cyberAccessoire", Object.keys(EMPLACEMENTS)),
      coutMin: entier(0, { min: 0 }),
      coutMax: entier(0, { min: 0 }),
      coutInstallation: entier(0, { min: 0 }),
      armeIntegree: booleen(false),
      capsuleAutorisee: booleen(false),
      typeArmeIntegree: choix("corpsACorps", Object.keys(TYPES_ARME)),
      special: texte(""),
      guerre: booleen(false),
      ameliorations: new f.ArrayField(new f.SchemaField({
        nom: texte(""),
        prix: entier(0, { min: 0 }),
        cout: entier(0, { min: 0 }),
        effet: texte(""),
        cible: texte(""),
        valeur: entier(0)
      })),
      animations: new f.ArrayField(new f.SchemaField({
        moment: choix("activation", ["activation", "attaque", "toucher", "duree"]),
        style: choix("soi", ["soi", "projectile", "impact", "zone"]),
        fichier: chemin()
      })),
      sons: new f.SchemaField({ activation: chemin(), toucher: chemin() }),
      niveaux: niveaux(() => ({
        prix: entier(0, { min: 0 }),
        slotsAmelioration: entier(0, { min: 0 }),
        effet: blocEffet(),
        ...champsDegatsNiveau()
      }))
    };
  }

  /* -------------------------------------------- */

  /** @override */
  get typeArme() {
    return this.typeArmeIntegree;
  }

  get effet() {
    return this.n?.effet;
  }

  get definitionEmplacement() {
    return EMPLACEMENTS[this.emplacement] ?? EMPLACEMENTS.cyberAccessoire;
  }

  /** Les implants de bras peuvent porter une capsule. */
  get acceptCapsule() {
    return this.capsuleAutorisee || (this.emplacement === "bras");
  }

  /** Items de l'acteur rattachés à cet implant. */
  get rattaches() {
    const acteur = this.porteur;
    const id = this.parent?.id;
    if ( !acteur || !id ) return [];
    return acteur.items.filter(i => ["ameliorationImplant", "capsule"].includes(i.type) && (i.system.implant === id));
  }

  get ameliorationsPosees() {
    return this.rattaches.filter(i => i.type === "ameliorationImplant");
  }

  get capsulePosee() {
    return this.rattaches.find(i => i.type === "capsule") ?? null;
  }

  get slotsAmelioration() {
    return this.n?.slotsAmelioration ?? 0;
  }

  /** Coût d'installation affiché : posé chez ce personnage, sinon la fourchette. */
  get coutTexte() {
    if ( this.porteur ) return `${this.coutInstallation}💀`;
    if ( this.coutMax && (this.coutMax !== this.coutMin) ) return `${this.coutMin} à ${this.coutMax}💀`;
    return `${this.coutMin || this.coutInstallation}💀`;
  }

  /** @override */
  get degatsSupplementaires() {
    const c = this.capsulePosee;
    return c ? [{ de: c.system.de || CAPSULE_DE, label: c.name, typeDegats: c.system.typeDegats }] : [];
  }

  /** @override */
  get modificateursActifs() {
    const e = this.effet;
    if ( !e ) return [];
    if ( (e.type === "actif") && !this.actif.enCours ) return [];
    return e.modificateurs.filter(m => m.cible && m.valeur);
  }

  get estActif() {
    return this.effet?.type === "actif";
  }

  get utilisationsMax() {
    return utilisationsMax(this);
  }

  get utilisationsRestantes() {
    const max = this.utilisationsMax;
    return (max === null) ? null : Math.max(0, max - this.usages.utilises);
  }

  /** Animation de l'arme intégrée, tirée de la liste d'animations de l'implant. */
  get animationEffective() {
    const base = super.animationEffective;
    const ligne = (moment, style) => this.animations.find(a => (a.moment === moment) && (a.style === style) && a.fichier)?.fichier;
    const projectile = ligne("attaque", "projectile");
    const impact = ligne("toucher", "impact") ?? ligne("attaque", "impact");
    const zone = ligne("toucher", "zone") ?? ligne("attaque", "zone");
    if ( !projectile && !impact && !zone ) {
      const typeDegats = this.n?.typeDegats;
      if ( this.typeArme === "corpsACorps" ) return { ...base, style: "impact", impact: base.impact || `${ANIM}/impacts/coup_tranchant.webm`, son: this.sons.toucher };
      return { ...base, son: this.sons.toucher || base.son, typeDegats };
    }
    let style = "impact";
    if ( projectile && impact ) style = "projectileImpact";
    else if ( projectile && zone ) style = "projectileZone";
    else if ( projectile ) style = "projectile";
    else if ( zone ) style = "zone";
    return { style, projectile: projectile ?? "", impact: impact ?? "", zone: zone ?? "", son: this.sons.toucher };
  }
}

/* ============================================ */
/*  Amélioration d'implant                      */
/* ============================================ */

export class AmeliorationImplantData extends ItemBase {
  static defineSchema() {
    return {
      description: new f.HTMLField({ required: true, initial: "" }),
      ambiance: texte(""),
      prix: entier(0, { min: 0 }),
      coutInstallation: entier(0, { min: 0 }),
      implant: texte(""),
      effet: blocEffet()
    };
  }

  get hote() {
    return this.porteur?.items.get(this.implant) ?? null;
  }

  /** @override */
  get modificateursActifs() {
    if ( !this.hote ) return [];
    return this.effet.modificateurs.filter(m => m.cible && m.valeur);
  }
}

/* ============================================ */
/*  Capsule (implants de bras)                  */
/* ============================================ */

export class CapsuleData extends ItemBase {
  static defineSchema() {
    return {
      description: new f.HTMLField({ required: true, initial: "" }),
      ambiance: texte(""),
      typeDegats: choix("poison", ["poison", "electrique", "feu"]),
      de: texte(CAPSULE_DE),
      prix: entier(CAPSULE_PRIX, { min: 0 }),
      coutInstallation: entier(CAPSULE_COUT, { min: 0 }),
      implant: texte("")
    };
  }

  /** Données d'une capsule standard. */
  static modele(cle) {
    const c = CAPSULES[cle];
    return { name: c.label, type: "capsule", system: { typeDegats: c.typeDegats } };
  }

  get hote() {
    return this.porteur?.items.get(this.implant) ?? null;
  }
}

/**
 * Champs partagés par les items : niveaux, Bloc Effet, Bloc Attaque.
 */
import { CARACS } from "../config.mjs";

const f = foundry.data.fields;

export const entier = (initial = 0, options = {}) => new f.NumberField({ required: true, nullable: false, integer: true, initial, ...options });
export const texte = (initial = "", options = {}) => new f.StringField({ required: true, blank: true, initial, ...options });
export const choix = (initial, liste) => new f.StringField({ required: true, blank: false, initial, choices: liste });
export const booleen = (initial = false) => new f.BooleanField({ initial });

/** Bloc Effet : passif ou actif, modificateurs, activation, coûts, utilisations, durée, jet associé. */
export function blocEffet() {
  return new f.SchemaField({
    type: choix("passif", ["passif", "actif"]),
    modificateurs: new f.ArrayField(new f.SchemaField({
      cible: texte(""),
      valeur: entier(0)
    })),
    activation: choix("action", ["action", "bonus", "reaction"]),
    coutHumanite: entier(0),
    humaniteKill: entier(0),
    utilisations: new f.SchemaField({
      periode: choix("illimite", ["illimite", "combat", "repos", "jour", "bm"]),
      max: entier(0, { min: 0 })
    }),
    duree: entier(0, { min: 0 }),
    ciblesMax: entier(0, { min: 0 }),
    jet: new f.SchemaField({
      formule: texte(""),
      type: choix("soin", ["soin", "degats"]),
      typeDegats: texte("")
    })
  });
}

/** Animation et son d'une action. Fichier vide = valeur par défaut du type. */
export function blocAnimation() {
  return new f.SchemaField({
    style: texte(""),
    projectile: new f.FilePathField({ categories: ["IMAGE", "VIDEO"], required: false, blank: true, initial: "" }),
    impact: new f.FilePathField({ categories: ["VIDEO", "IMAGE"], required: false, blank: true, initial: "" }),
    zone: new f.FilePathField({ categories: ["VIDEO", "IMAGE"], required: false, blank: true, initial: "" }),
    son: new f.FilePathField({ categories: ["AUDIO"], required: false, blank: true, initial: "" })
  });
}

/**
 * Trois niveaux construits par la même fonction de champs.
 * @param {() => object} champs  Renvoie les champs d'un niveau.
 */
export function niveaux(champs) {
  return new f.SchemaField({
    n1: new f.SchemaField(champs()),
    n2: new f.SchemaField(champs()),
    n3: new f.SchemaField(champs())
  });
}

/** Champs communs à tous les items à niveaux. */
export function champsCommuns() {
  return {
    description: new f.HTMLField({ required: true, initial: "" }),
    ambiance: texte(""),
    sansNiveaux: booleen(false),
    niveau: entier(1, { min: 1, max: 3 })
  };
}

/** Clés de caractéristiques pour un menu. */
export const CLES_CARACS = Object.keys(CARACS);

/* -------------------------------------------- */

/**
 * Base de tous les items Cyberpunk 2075.
 */
export class ItemBase extends foundry.abstract.TypeDataModel {

  static defineSchema() {
    return { description: new f.HTMLField({ required: true, initial: "" }) };
  }

  /** L'item a-t-il des niveaux ? */
  get aNiveaux() {
    return ("niveaux" in this) && !this.sansNiveaux;
  }

  /** Niveau effectif (1 si sans niveaux). */
  get niveauEffectif() {
    return this.aNiveaux ? (this.niveau ?? 1) : 1;
  }

  /** Données du niveau possédé. */
  get n() {
    return this.niveaux?.[`n${this.niveauEffectif}`] ?? null;
  }

  /** Modificateurs appliqués au porteur : [{cible, valeur}]. */
  get modificateursActifs() {
    return [];
  }

  /** Acteur qui porte l'item. */
  get porteur() {
    return this.parent?.actor ?? null;
  }
}

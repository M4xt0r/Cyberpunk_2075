import { CARACS, COMPETENCES, TYPES_ARME, NIVEAUX, ANIM, IMPACT_PAR_DEGATS } from "../config.mjs";
import { blocAnimation, entier, texte, booleen } from "./champs.mjs";

const f = foundry.data.fields;

/** Caractéristique aux dégâts : une des 5, ou aucune (""). */
export const champCarac = (initial = "safr") => new f.StringField({ required: true, blank: true, initial, choices: ["", ...Object.keys(CARACS)] });

/** Champs du Bloc Attaque communs aux armes et aux implants à arme intégrée. */
export function champsAttaque() {
  return {
    competence: texte("armeDePoing"),
    carac: champCarac(),
    portee: new f.NumberField({ required: false, nullable: true, integer: false, min: 0, initial: null }),
    attaque: new f.SchemaField({
      faitDegats: booleen(true),
      defense: new f.StringField({ required: true, initial: "adaptabilite", choices: ["adaptabilite", "glace", "aucune"] }),
      bonusTouche: entier(0),
      zone: new f.NumberField({ required: false, nullable: true, integer: false, min: 0, initial: null }),
      animation: blocAnimation()
    })
  };
}

/** Champs de dégâts d'un niveau. */
export function champsDegatsNiveau() {
  return {
    de: texte("1d6"),
    bonusFixe: entier(0),
    typeDegats: texte("balle")
  };
}

/**
 * Calculs d'attaque partagés. La classe doit fournir `typeArme`.
 * @param {typeof foundry.abstract.TypeDataModel} Base
 */
export const MixinAttaque = Base => class extends Base {

  /** Type d'arme (pistolet, corps à corps…). */
  get typeArme() {
    return "autre";
  }

  get definitionType() {
    return TYPES_ARME[this.typeArme] ?? TYPES_ARME.autre;
  }

  /** Quantité en stock (les grenades se consomment). */
  get stock() {
    return this.quantite ?? 1;
  }

  /** Dé de critique selon le niveau possédé. */
  get deCritique() {
    return NIVEAUX[this.niveauEffectif]?.critique ?? "1d6";
  }

  /** Dés de dégâts en plus (capsules d'un implant de bras). */
  get degatsSupplementaires() {
    return [];
  }

  /** Formule lisible des dégâts, ex. « 1d6+1+SaFr ». */
  formuleLisible(niveau = this.niveauEffectif) {
    const n = this.niveaux[`n${this.aNiveaux ? niveau : 1}`];
    const fixe = n.bonusFixe ? `${n.bonusFixe > 0 ? "+" : "−"}${Math.abs(n.bonusFixe)}` : "";
    const carac = CARACS[this.carac] ? `+${CARACS[this.carac].abrev}` : "";
    const plus = this.degatsSupplementaires.map(d => `+${d.de}`).join("");
    return `${n.de}${fixe}${carac}${plus}`;
  }

  /** Score au toucher chez le porteur (compétence + bonus de l'arme + modificateurs « touche »). */
  get scoreTouche() {
    const s = this.porteur?.system;
    const comp = s?.competences?.[this.competence]?.score ?? 0;
    return comp + this.attaque.bonusTouche + (s?.modificateurs?.touche ?? 0);
  }

  get competenceLabel() {
    return COMPETENCES[this.competence]?.label ?? "—";
  }

  /** Animation effective : champs de l'item, sinon défauts du type. */
  get animationEffective() {
    const a = this.attaque.animation;
    const def = this.definitionType.anim;
    const typeDegats = this.n?.typeDegats;
    const chemin = (val, defaut) => val || (defaut ? `${ANIM}/${defaut}` : "");
    const impactDefaut = def.impact ?? (this.typeArme === "corpsACorps" ? null : IMPACT_PAR_DEGATS[typeDegats]);
    // Arme à tir explosif avec zone (Lance-projectile, missiles) : roquette puis explosion
    const explosive = (def.style === "projectile") && (this.attaque.zone > 0) && (typeDegats === "explosion");
    return {
      style: a.style || (explosive ? "projectileZone" : def.style),
      projectile: chemin(a.projectile, explosive ? "projectiles/roquette.png" : def.projectile),
      impact: chemin(a.impact, explosive ? null : impactDefaut),
      zone: chemin(a.zone, explosive ? "zones/explosion.webm" : def.zone),
      son: a.son
    };
  }
};

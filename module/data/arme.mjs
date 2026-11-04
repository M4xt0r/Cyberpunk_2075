import { CARACS, TYPES_ARME, NIVEAUX, ANIM, IMPACT_PAR_DEGATS } from "../config.mjs";
import { ItemBase, champsCommuns, niveaux, blocAnimation, entier, texte, choix, booleen } from "./champs.mjs";

const f = foundry.data.fields;

/**
 * Arme : type, compétence, caractéristique aux dégâts et Bloc Attaque.
 * Prix, dé, bonus fixe et type de dégâts se remplissent par niveau.
 */
export default class ArmeData extends ItemBase {

  static defineSchema() {
    return {
      ...champsCommuns(),
      type: choix("pistolet", Object.keys(TYPES_ARME)),
      competence: texte("armeDePoing"),
      carac: choix("safr", Object.keys(CARACS)),
      intelligente: booleen(false),
      portee: new f.NumberField({ required: false, nullable: true, integer: false, min: 0, initial: null }),
      munitions: new f.NumberField({ required: false, nullable: true, integer: true, min: 0, initial: null }),
      quantite: entier(1, { min: 0 }),
      attaque: new f.SchemaField({
        faitDegats: booleen(true),
        defense: choix("adaptabilite", ["adaptabilite", "glace", "aucune"]),
        bonusTouche: entier(0),
        zone: new f.NumberField({ required: false, nullable: true, integer: false, min: 0, initial: null }),
        animation: blocAnimation()
      }),
      niveaux: niveaux(() => ({
        prix: entier(0, { min: 0 }),
        de: texte("1d6"),
        bonusFixe: entier(0),
        typeDegats: texte("balle")
      }))
    };
  }

  /** Valeurs par défaut selon le type, à la création. */
  static valeursParType(type) {
    const t = TYPES_ARME[type] ?? TYPES_ARME.autre;
    const maj = {
      "system.competence": t.competence,
      "system.attaque.defense": t.defense ?? "adaptabilite",
      "system.attaque.zone": t.zone ?? null,
      "system.portee": t.portee ?? null
    };
    for ( const n of ["n1", "n2", "n3"] ) maj[`system.niveaux.${n}.typeDegats`] = t.degats;
    if ( type === "grenade" ) maj["system.sansNiveaux"] = true;
    return maj;
  }

  /* -------------------------------------------- */

  get definitionType() {
    return TYPES_ARME[this.type] ?? TYPES_ARME.autre;
  }

  /** Dé de critique selon le niveau possédé. */
  get deCritique() {
    return NIVEAUX[this.niveauEffectif]?.critique ?? "1d6";
  }

  /** Formule lisible des dégâts, ex. « 1d6+1+SaFr ». */
  formuleLisible(niveau = this.niveauEffectif) {
    const n = this.niveaux[`n${this.aNiveaux ? niveau : 1}`];
    const fixe = n.bonusFixe ? `${n.bonusFixe > 0 ? "+" : "−"}${Math.abs(n.bonusFixe)}` : "";
    return `${n.de}${fixe}+${CARACS[this.carac]?.abrev ?? ""}`;
  }

  /** Score au toucher chez le porteur (compétence + bonus de l'arme + modificateurs « touche »). */
  get scoreTouche() {
    const s = this.porteur?.system;
    const comp = s?.competences?.[this.competence]?.score ?? 0;
    return comp + this.attaque.bonusTouche + (s?.modificateurs?.touche ?? 0);
  }

  /** Animation effective : champs de l'item, sinon défauts du type. */
  get animationEffective() {
    const a = this.attaque.animation;
    const def = this.definitionType.anim;
    const typeDegats = this.n?.typeDegats;
    const chemin = (val, defaut) => val || (defaut ? `${ANIM}/${defaut}` : "");
    const impactDefaut = def.impact ?? (this.type === "corpsACorps" ? null : IMPACT_PAR_DEGATS[typeDegats]);
    return {
      style: a.style || def.style,
      projectile: chemin(a.projectile, def.projectile),
      impact: chemin(a.impact, impactDefaut ?? def.impact),
      zone: chemin(a.zone, def.zone),
      son: a.son
    };
  }
}

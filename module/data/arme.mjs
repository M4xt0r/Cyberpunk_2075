import { TYPES_ARME } from "../config.mjs";
import { ItemBase, champsCommuns, niveaux, entier, choix, booleen } from "./champs.mjs";
import { MixinAttaque, champsAttaque, champsDegatsNiveau } from "./attaque-mixin.mjs";

const f = foundry.data.fields;

/**
 * Arme : type, compétence, caractéristique aux dégâts et Bloc Attaque.
 * Prix, dé, bonus fixe et type de dégâts se remplissent par niveau.
 */
export default class ArmeData extends MixinAttaque(ItemBase) {

  static defineSchema() {
    return {
      ...champsCommuns(),
      ...champsAttaque(),
      type: choix("pistolet", Object.keys(TYPES_ARME)),
      intelligente: booleen(false),
      munitions: new f.NumberField({ required: false, nullable: true, integer: true, min: 0, initial: null }),
      quantite: entier(1, { min: 0 }),
      niveaux: niveaux(() => ({
        prix: entier(0, { min: 0 }),
        ...champsDegatsNiveau()
      }))
    };
  }

  /** Valeurs par défaut selon le type, à la création ou au changement de type. */
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

  /** @override */
  get typeArme() {
    return this.type;
  }
}

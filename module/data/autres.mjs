import { CARACS } from "../config.mjs";

const f = foundry.data.fields;
const entier = (initial = 0, options = {}) => new f.NumberField({ required: true, nullable: false, integer: true, initial, ...options });

/* ============================================ */
/*  Acteurs pas encore construits (étapes 6-7)  */
/* ============================================ */

/** Base provisoire : une description. Le schéma complet arrive à l'étape correspondante. */
class ActeurProvisoire extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return { description: new f.HTMLField({ required: true, initial: "" }) };
  }
}
export class EnnemiData extends ActeurProvisoire {}
export class VehiculeData extends ActeurProvisoire {}
export class PlanqueData extends ActeurProvisoire {}

/* ============================================ */
/*  Items                                       */
/* ============================================ */

/**
 * Base commune à tous les items : description.
 * Les niveaux, le Bloc Effet et le Bloc Attaque arrivent à l'étape 2.
 * `modificateursActifs` est lu par la fiche Personnage pour appliquer les bonus passifs.
 */
class ItemBase extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return { description: new f.HTMLField({ required: true, initial: "" }) };
  }

  /** Modificateurs appliqués au porteur : [{cible, valeur}]. Vide tant que le Bloc Effet n'existe pas. */
  get modificateursActifs() {
    return [];
  }
}

export class ArmeData extends ItemBase {}
export class ImplantData extends ItemBase {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      coutInstallation: entier(0, { min: 0 })
    };
  }
}
export class AmeliorationImplantData extends ItemBase {}
export class CapsuleData extends ItemBase {}
export class ObjetData extends ItemBase {}
export class HackData extends ItemBase {}
export class TalentData extends ItemBase {}

export class ClasseData extends ItemBase {
  static defineSchema() {
    const bonus = {};
    for ( const cle of Object.keys(CARACS) ) bonus[cle] = entier(0);
    return {
      ...super.defineSchema(),
      bonus: new f.SchemaField(bonus),
      eddies: entier(0, { min: 0 })
    };
  }
}

export class SousClasseData extends ItemBase {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      classeParente: new f.StringField({ required: true, initial: "" })
    };
  }
}

export class AmeliorationVehiculeData extends ItemBase {}
export class ModulePlanqueData extends ItemBase {}

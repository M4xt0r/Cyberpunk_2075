import { CARACS } from "../config.mjs";
import { ItemBase, entier } from "./champs.mjs";

const f = foundry.data.fields;

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
/*  Items pas encore construits (étapes 3 à 7)  */
/* ============================================ */

export class HackData extends ItemBase {}

/** Talent provisoire (étape 4) : l'effet spécial Edgerunner est déjà reconnu. */
export class TalentData extends ItemBase {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      special: new f.StringField({ required: true, blank: true, initial: "" })
    };
  }
}

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

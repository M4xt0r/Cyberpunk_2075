import { ItemBase } from "./champs.mjs";

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
export class VehiculeData extends ActeurProvisoire {}
export class PlanqueData extends ActeurProvisoire {}

/* ============================================ */
/*  Items pas encore construits (étape 7)       */
/* ============================================ */

export class AmeliorationVehiculeData extends ItemBase {}
export class ModulePlanqueData extends ItemBase {}

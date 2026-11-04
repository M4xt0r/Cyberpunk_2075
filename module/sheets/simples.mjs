import { CHEMIN, CARACS, EFFETS_SPECIAUX } from "../config.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2, ItemSheetV2 } = foundry.applications.sheets;

/**
 * Fiche d'item provisoire. Les cartes « barrette de RAM » arrivent à l'étape 2.
 * Seul le MJ modifie les items, même ceux posés sur la fiche d'un joueur.
 */
export class FicheItemSimple extends HandlebarsApplicationMixin(ItemSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["cp2075", "cp-fiche", "cp-fiche-simple"],
    position: { width: 520, height: "auto" },
    window: { resizable: true },
    form: { submitOnChange: true }
  };

  static PARTS = {
    corps: { template: `${CHEMIN}/templates/item/simple.hbs` }
  };

  /** @override */
  get isEditable() {
    return super.isEditable && game.user.isGM;
  }

  /** @override */
  async _prepareContext(options) {
    const contexte = await super._prepareContext(options);
    const item = this.item;
    return Object.assign(contexte, {
      item,
      system: item.system,
      peutModifier: this.isEditable,
      typeLabel: game.i18n.localize(CONFIG.Item.typeLabels?.[item.type] ?? item.type),
      estClasse: item.type === "classe",
      estSousClasse: item.type === "sousClasse",
      estTalent: item.type === "talent",
      choixSpeciaux: EFFETS_SPECIAUX,
      bonusCaracs: Object.entries(CARACS).map(([cle, def]) => ({
        cle, label: def.labelLong ?? def.label, valeur: item.system.bonus?.[cle] ?? 0
      }))
    });
  }
}

/**
 * Fiche provisoire pour Ennemi, Véhicule et Planque (étapes 6 et 7).
 */
export class FicheActeurSimple extends HandlebarsApplicationMixin(ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    classes: ["cp2075", "cp-fiche", "cp-fiche-simple"],
    position: { width: 520, height: "auto" },
    window: { resizable: true },
    form: { submitOnChange: true }
  };

  static PARTS = {
    corps: { template: `${CHEMIN}/templates/actor/simple.hbs` }
  };

  /** @override */
  async _prepareContext(options) {
    const contexte = await super._prepareContext(options);
    return Object.assign(contexte, {
      acteur: this.actor,
      system: this.actor.system,
      peutModifier: this.isEditable,
      typeLabel: game.i18n.localize(CONFIG.Actor.typeLabels?.[this.actor.type] ?? this.actor.type)
    });
  }
}

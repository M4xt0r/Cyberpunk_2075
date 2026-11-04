/**
 * Cyberpunk 2075 — système Foundry VTT v13 (d20).
 * Notion est la source de vérité du contenu ; ce système en est la version jouable à distance.
 */
import * as CONFIG_CP from "./config.mjs";
import PersonnageData from "./data/personnage.mjs";
import * as Autres from "./data/autres.mjs";
import ArmeData from "./data/arme.mjs";
import ImplantData, { AmeliorationImplantData, CapsuleData } from "./data/implant.mjs";
import { tourDeCombat } from "./documents/humanite.mjs";
import ObjetData from "./data/objet.mjs";
import HackData from "./data/hack.mjs";
import ActeurCP from "./documents/actor.mjs";
import ItemCP from "./documents/item.mjs";
import FichePersonnage from "./sheets/personnage-sheet.mjs";
import { FicheItemSimple, FicheActeurSimple } from "./sheets/simples.mjs";
import { CarteArme, CarteObjet, CarteImplant, CarteSousImplant, CarteTalent, CarteClasse, CarteSousClasse, CarteHack } from "./sheets/carte-item.mjs";
import { TalentData, ClasseData, SousClasseData } from "./data/progression.mjs";
import { signe } from "./dice/jets.mjs";
import { surRenduMessage, surCreationMessage } from "./dice/chat.mjs";
import { jouerAnimation } from "./animations.mjs";

const { ID_SYSTEME, CHEMIN } = CONFIG_CP;

Hooks.once("init", () => {
  console.log("Cyberpunk 2075 | Initialisation du système");

  globalThis.cyberpunk2075 = { config: CONFIG_CP, jouerAnimation };
  CONFIG.CP2075 = CONFIG_CP;

  // Documents et modèles de données
  CONFIG.Actor.documentClass = ActeurCP;
  CONFIG.Item.documentClass = ItemCP;
  Object.assign(CONFIG.Actor.dataModels, {
    personnage: PersonnageData,
    ennemi: Autres.EnnemiData,
    vehicule: Autres.VehiculeData,
    planque: Autres.PlanqueData
  });
  Object.assign(CONFIG.Item.dataModels, {
    arme: ArmeData,
    implant: ImplantData,
    ameliorationImplant: AmeliorationImplantData,
    capsule: CapsuleData,
    objet: ObjetData,
    hack: HackData,
    talent: TalentData,
    classe: ClasseData,
    sousClasse: SousClasseData,
    ameliorationVehicule: Autres.AmeliorationVehiculeData,
    modulePlanque: Autres.ModulePlanqueData
  });

  // Barres de token : Vie, RAM, Humanité
  CONFIG.Actor.trackableAttributes = {
    personnage: { bar: ["vie", "ram", "humanite"], value: [] }
  };

  // Initiative : 1d20 + bonus (Processeur tactique…)
  CONFIG.Combat.initiative = { formula: "1d20 + @initiative", decimals: 0 };

  // Fiches
  const { DocumentSheetConfig } = foundry.applications.apps;
  DocumentSheetConfig.unregisterSheet(Actor, "core", foundry.appv1.sheets.ActorSheet);
  DocumentSheetConfig.unregisterSheet(Item, "core", foundry.appv1.sheets.ItemSheet);
  DocumentSheetConfig.registerSheet(Actor, ID_SYSTEME, FichePersonnage, {
    types: ["personnage"], makeDefault: true, label: "Fiche Personnage Cyberpunk 2075"
  });
  DocumentSheetConfig.registerSheet(Actor, ID_SYSTEME, FicheActeurSimple, {
    types: ["ennemi", "vehicule", "planque"], makeDefault: true, label: "Fiche provisoire Cyberpunk 2075"
  });
  DocumentSheetConfig.registerSheet(Item, ID_SYSTEME, CarteArme, {
    types: ["arme"], makeDefault: true, label: "Carte d'arme Cyberpunk 2075"
  });
  DocumentSheetConfig.registerSheet(Item, ID_SYSTEME, CarteObjet, {
    types: ["objet"], makeDefault: true, label: "Carte d'objet Cyberpunk 2075"
  });
  DocumentSheetConfig.registerSheet(Item, ID_SYSTEME, CarteImplant, {
    types: ["implant"], makeDefault: true, label: "Carte d'implant Cyberpunk 2075"
  });
  DocumentSheetConfig.registerSheet(Item, ID_SYSTEME, CarteSousImplant, {
    types: ["ameliorationImplant", "capsule"], makeDefault: true, label: "Carte d'amélioration Cyberpunk 2075"
  });
  DocumentSheetConfig.registerSheet(Item, ID_SYSTEME, CarteTalent, {
    types: ["talent"], makeDefault: true, label: "Carte de talent Cyberpunk 2075"
  });
  DocumentSheetConfig.registerSheet(Item, ID_SYSTEME, CarteClasse, {
    types: ["classe"], makeDefault: true, label: "Carte de classe Cyberpunk 2075"
  });
  DocumentSheetConfig.registerSheet(Item, ID_SYSTEME, CarteSousClasse, {
    types: ["sousClasse"], makeDefault: true, label: "Carte de sous-classe Cyberpunk 2075"
  });
  DocumentSheetConfig.registerSheet(Item, ID_SYSTEME, CarteHack, {
    types: ["hack"], makeDefault: true, label: "Carte de hack Cyberpunk 2075"
  });
  DocumentSheetConfig.registerSheet(Item, ID_SYSTEME, FicheItemSimple, {
    types: ["ameliorationVehicule", "modulePlanque"],
    makeDefault: true, label: "Carte provisoire Cyberpunk 2075"
  });

  // Aides Handlebars
  Handlebars.registerHelper("cpSigne", n => signe(n));

  // Pré-chargement des templates
  foundry.applications.handlebars.loadTemplates([
    `${CHEMIN}/templates/actor/personnage/entete.hbs`,
    `${CHEMIN}/templates/actor/personnage/identite.hbs`,
    `${CHEMIN}/templates/actor/personnage/combat.hbs`,
    `${CHEMIN}/templates/actor/personnage/inventaire.hbs`,
    `${CHEMIN}/templates/actor/personnage/bio.hbs`,
    `${CHEMIN}/templates/actor/personnage/partials/emplacement.hbs`,
    `${CHEMIN}/templates/chat/jet.hbs`,
    `${CHEMIN}/templates/chat/attaque.hbs`,
    `${CHEMIN}/templates/chat/degats.hbs`,
    `${CHEMIN}/templates/chat/hack.hbs`,
    `${CHEMIN}/templates/dialogs/hack.hbs`,
    `${CHEMIN}/templates/chat/utilisation.hbs`,
    `${CHEMIN}/templates/chat/alerte.hbs`,
    `${CHEMIN}/templates/chat/progression.hbs`,
    `${CHEMIN}/templates/dialogs/ameliorations.hbs`,
    `${CHEMIN}/templates/dialogs/jet.hbs`,
    `${CHEMIN}/templates/dialogs/attaque.hbs`,
    `${CHEMIN}/templates/item/partials/haut.hbs`,
    `${CHEMIN}/templates/item/partials/plaques.hbs`,
    `${CHEMIN}/templates/item/partials/bas.hbs`
  ]);
});

/* -------------------------------------------- */

/** Messages du chat : boutons, parties réservées au MJ ou au propriétaire. */
Hooks.on("renderChatMessageHTML", surRenduMessage);

/** Animations : jouées par chaque client à la création du message. */
Hooks.on("createChatMessage", surCreationMessage);

/**
 * Effets actifs des objets : un tour de moins au début du tour du porteur.
 * Exécuté par un seul MJ pour éviter les doublons.
 */
Hooks.on("updateCombat", async (combat, changements) => {
  if ( !("turn" in changements) && !("round" in changements) ) return;
  if ( game.users.activeGM?.id !== game.user.id ) return;
  const acteur = combat.combatant?.actor;
  if ( !acteur ) return;
  if ( acteur.type === "personnage" ) await tourDeCombat(acteur);
  const majs = [];
  for ( const item of acteur.items ) {
    const a = item.system.actif;
    if ( !a?.enCours ) continue;
    const tours = Math.max(0, a.tours - 1);
    majs.push({ _id: item.id, "system.actif.tours": tours, "system.actif.enCours": tours > 0 });
    if ( tours === 0 ) ChatMessage.create({ content: `<div class="cp-msg"><div class="cp-msg-note">${acteur.name} : fin de l'effet de ${item.name}.</div></div>`, speaker: ChatMessage.getSpeaker({ actor: acteur }) });
  }
  if ( majs.length ) await acteur.updateEmbeddedDocuments("Item", majs);
});

/** Nouveau personnage : le token est lié à la fiche et voit la scène. */
Hooks.on("preCreateActor", (acteur, donnees) => {
  if ( acteur.type !== "personnage" ) return;
  const prototype = {
    actorLink: true,
    disposition: CONST.TOKEN_DISPOSITIONS.FRIENDLY,
    sight: { enabled: true },
    bar1: { attribute: "vie" },
    bar2: { attribute: "ram" }
  };
  acteur.updateSource({ prototypeToken: foundry.utils.mergeObject(prototype, donnees.prototypeToken ?? {}) });
});

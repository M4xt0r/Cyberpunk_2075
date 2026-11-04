/**
 * Cyberpunk 2075 — système Foundry VTT v13 (d20).
 * Notion est la source de vérité du contenu ; ce système en est la version jouable à distance.
 */
import * as CONFIG_CP from "./config.mjs";
import PersonnageData from "./data/personnage.mjs";
import * as Autres from "./data/autres.mjs";
import ActeurCP from "./documents/actor.mjs";
import FichePersonnage from "./sheets/personnage-sheet.mjs";
import { FicheItemSimple, FicheActeurSimple } from "./sheets/simples.mjs";
import { signe } from "./dice/jets.mjs";

const { ID_SYSTEME, CHEMIN } = CONFIG_CP;

Hooks.once("init", () => {
  console.log("Cyberpunk 2075 | Initialisation du système");

  globalThis.cyberpunk2075 = { config: CONFIG_CP };
  CONFIG.CP2075 = CONFIG_CP;

  // Documents et modèles de données
  CONFIG.Actor.documentClass = ActeurCP;
  Object.assign(CONFIG.Actor.dataModels, {
    personnage: PersonnageData,
    ennemi: Autres.EnnemiData,
    vehicule: Autres.VehiculeData,
    planque: Autres.PlanqueData
  });
  Object.assign(CONFIG.Item.dataModels, {
    arme: Autres.ArmeData,
    implant: Autres.ImplantData,
    ameliorationImplant: Autres.AmeliorationImplantData,
    capsule: Autres.CapsuleData,
    objet: Autres.ObjetData,
    hack: Autres.HackData,
    talent: Autres.TalentData,
    classe: Autres.ClasseData,
    sousClasse: Autres.SousClasseData,
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
  DocumentSheetConfig.registerSheet(Item, ID_SYSTEME, FicheItemSimple, {
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
    `${CHEMIN}/templates/chat/jet.hbs`,
    `${CHEMIN}/templates/dialogs/jet.hbs`
  ]);
});

/* -------------------------------------------- */

/** Messages du chat : ce qui est réservé au MJ disparaît pour les joueurs. */
Hooks.on("renderChatMessageHTML", (message, html) => {
  if ( game.user.isGM ) return;
  for ( const el of html.querySelectorAll(".cp-mj-seul") ) el.remove();
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

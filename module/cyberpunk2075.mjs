/**
 * Cyberpunk 2075 — système Foundry VTT v13 (d20).
 * Notion est la source de vérité du contenu ; ce système en est la version jouable à distance.
 */
import * as CONFIG_CP from "./config.mjs";
import PersonnageData from "./data/personnage.mjs";
import ArmeData from "./data/arme.mjs";
import ImplantData, { AmeliorationImplantData, CapsuleData } from "./data/implant.mjs";
import { tourDeCombat } from "./documents/humanite.mjs";
import ObjetData from "./data/objet.mjs";
import HackData from "./data/hack.mjs";
import EnnemiData from "./data/ennemi.mjs";
import { VehiculeData, PlanqueData, AmeliorationVehiculeData, ModulePlanqueData } from "./data/vehicule.mjs";
import { FicheVehicule, FichePlanque } from "./sheets/vehicule-sheet.mjs";
import FicheEnnemi from "./sheets/ennemi-sheet.mjs";
import ActeurCP from "./documents/actor.mjs";
import ItemCP from "./documents/item.mjs";
import FichePersonnage from "./sheets/personnage-sheet.mjs";
import { CarteArme, CarteObjet, CarteImplant, CarteSousImplant, CarteTalent, CarteClasse, CarteSousClasse, CarteHack, CarteModule } from "./sheets/carte-item.mjs";
import { TalentData, ClasseData, SousClasseData } from "./data/progression.mjs";
import { signe } from "./dice/jets.mjs";
import { surRenduMessage, surCreationMessage } from "./dice/chat.mjs";
import { jouerAnimation } from "./animations.mjs";
import BarreActions from "./hud/barre.mjs";
import { ajouterBoutonTour, decompterEffets, majBoutonCombat, zonesAuTourDe } from "./hud/tours.mjs";
import FriseCombat from "./hud/frise.mjs";
import { brancherDeplacements } from "./hud/combat.mjs";
import { chargerIndicateurs, dessinerIndicateurs, redessinerActeur } from "./hud/indicateurs.mjs";

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
    ennemi: EnnemiData,
    vehicule: VehiculeData,
    planque: PlanqueData
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
    ameliorationVehicule: AmeliorationVehiculeData,
    modulePlanque: ModulePlanqueData
  });

  // Barres de token : Vie, RAM, Humanité
  CONFIG.Actor.trackableAttributes = {
    personnage: { bar: ["vie", "ram", "humanite"], value: [] },
    ennemi: { bar: ["vie", "ram"], value: ["humanite.value"] },
    vehicule: { bar: ["vie"], value: [] }
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
  DocumentSheetConfig.registerSheet(Actor, ID_SYSTEME, FicheVehicule, {
    types: ["vehicule"], makeDefault: true, label: "Fiche Véhicule Cyberpunk 2075"
  });
  DocumentSheetConfig.registerSheet(Actor, ID_SYSTEME, FichePlanque, {
    types: ["planque"], makeDefault: true, label: "Fiche Planque Cyberpunk 2075"
  });
  DocumentSheetConfig.registerSheet(Actor, ID_SYSTEME, FicheEnnemi, {
    types: ["ennemi"], makeDefault: true, label: "Fiche Ennemi Cyberpunk 2075"
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
  DocumentSheetConfig.registerSheet(Item, ID_SYSTEME, CarteModule, {
    types: ["ameliorationVehicule", "modulePlanque"], makeDefault: true, label: "Carte d'amélioration / module Cyberpunk 2075"
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
    `${CHEMIN}/templates/chat/des.hbs`,
    `${CHEMIN}/templates/chat/attaque.hbs`,
    `${CHEMIN}/templates/chat/degats.hbs`,
    `${CHEMIN}/templates/chat/hack.hbs`,
    `${CHEMIN}/templates/actor/ennemi/fiche.hbs`,
    `${CHEMIN}/templates/dialogs/hack.hbs`,
    `${CHEMIN}/templates/chat/utilisation.hbs`,
    `${CHEMIN}/templates/chat/alerte.hbs`,
    `${CHEMIN}/templates/chat/progression.hbs`,
    `${CHEMIN}/templates/dialogs/ameliorations.hbs`,
    `${CHEMIN}/templates/dialogs/jet.hbs`,
    `${CHEMIN}/templates/dialogs/attaque.hbs`,
    `${CHEMIN}/templates/item/partials/haut.hbs`,
    `${CHEMIN}/templates/item/partials/plaques.hbs`,
    `${CHEMIN}/templates/item/partials/bas.hbs`,
    `${CHEMIN}/templates/hud/barre.hbs`,
    `${CHEMIN}/templates/hud/frise.hbs`
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
let dernierTourTraite = null;
Hooks.on("updateCombat", async (combat, changements, options) => {
  if ( !("turn" in changements) && !("round" in changements) ) return;
  if ( game.users.activeGM?.id !== game.user.id ) return;
  // Pas au lancement, ni en revenant à l'acteur précédent, ni deux fois pour le même tour
  if ( options?.cpDemarrage || (options?.direction === -1) ) return;
  const combattant = combat.combatant;
  if ( (combattant?.initiative === null) || (combattant?.initiative === undefined) ) return;
  const cle = `${combat.id}:${combat.round}:${combattant.id}`;
  if ( cle === dernierTourTraite ) return;
  dernierTourTraite = cle;
  const acteur = combattant.actor;
  if ( !acteur ) return;
  if ( acteur.type === "personnage" ) await tourDeCombat(acteur);
  await decompterEffets(acteur);
  await zonesAuTourDe(combattant);
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

/* -------------------------------------------- */
/*  Véhicules et planque liés aux personnages   */
/* -------------------------------------------- */

/** Personnages qui affichent ce véhicule ou cette planque sur leur page 3. */
function personnagesLies(acteur) {
  if ( !acteur || !["vehicule", "planque"].includes(acteur.type) ) return [];
  const uuid = acteur.uuid;
  // Planque : tous les personnages, car elle apparaît selon ses permissions
  if ( acteur.type === "planque" ) return game.actors.filter(a => a.type === "personnage");
  return game.actors.filter(a => (a.type === "personnage") && a.system.vehicules.includes(uuid));
}

/** Recalcule les personnages liés (bonus de planque) et rafraîchit leur fiche. */
function rafraichirLies(acteur) {
  for ( const p of personnagesLies(acteur) ) {
    if ( (acteur.type === "planque") && (p.system.surPlace === acteur.uuid) ) p.reset();
    if ( p.sheet?.rendered ) p.sheet.render(false);
  }
  // Un véhicule dépend de son pilote (compétences des armes de bord)
  if ( acteur?.type === "personnage" ) {
    for ( const v of game.actors.filter(a => (a.type === "vehicule") && (a.system.pilote === acteur.uuid)) ) {
      if ( v.sheet?.rendered ) v.sheet.render(false);
    }
  }
}

Hooks.on("updateActor", acteur => rafraichirLies(acteur));
for ( const crochet of ["createItem", "updateItem", "deleteItem"] ) {
  Hooks.on(crochet, item => { if ( item.parent instanceof Actor ) rafraichirLies(item.parent); });
}

/** Au chargement : les bonus de planque ont besoin que tous les acteurs soient là. */
Hooks.once("ready", () => {
  for ( const p of game.actors.filter(a => (a.type === "personnage") && a.system.surPlace) ) p.reset();
});

/* -------------------------------------------- */
/*  Scène : barre d'actions et indicateurs      */
/* -------------------------------------------- */

let barre = null;
let frise = null;
const rafraichirBarre = acteur => { if ( barre?.concerne(acteur) ) barre.rafraichir(); };

Hooks.once("ready", async () => {
  barre = new BarreActions();
  globalThis.cyberpunk2075.barre = barre;
  barre.render({ force: true });
  ajouterBoutonTour();
  frise = new FriseCombat();
  frise.render({ force: true });
  await chargerIndicateurs();
  if ( canvas?.ready ) canvas.tokens.placeables.forEach(dessinerIndicateurs);
});

// Indicateurs (couvert, crâne d'Humanité) sur les tokens
Hooks.on("drawToken", token => dessinerIndicateurs(token));
Hooks.on("updateToken", doc => { if ( doc.object ) dessinerIndicateurs(doc.object); });
Hooks.on("updateActor", acteur => { redessinerActeur(acteur); rafraichirBarre(acteur); });

// Barre d'actions : suit les changements de l'acteur affiché et de la scène
for ( const crochet of ["createItem", "updateItem", "deleteItem"] ) {
  Hooks.on(crochet, item => { if ( item.parent instanceof Actor ) rafraichirBarre(item.parent); });
}
for ( const crochet of ["canvasReady", "createToken", "deleteToken", "updateToken"] ) Hooks.on(crochet, () => barre?.rafraichir());
Hooks.on("updateUser", (user, changements) => { if ( (user.id === game.user.id) && ("character" in changements) ) barre?.rafraichir(); });
Hooks.on("controlToken", (token, controle) => barre?.suivreToken(token, controle));

// Combat : frise d'ordre de jeu, bouton du MJ, déplacements limités au tour de chacun
brancherDeplacements();
const rafraichirCombat = () => { frise?.rafraichir(); majBoutonCombat(); };
for ( const crochet of ["createCombat", "updateCombat", "deleteCombat", "createCombatant", "updateCombatant", "deleteCombatant", "canvasReady"] ) {
  Hooks.on(crochet, rafraichirCombat);
}
Hooks.on("updateActor", () => frise?.rafraichir());
Hooks.on("updateToken", () => frise?.rafraichir());

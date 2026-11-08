/**
 * Combat : lancement, fin, ordre de jeu piloté par le MJ, initiative par messages privés
 * et déplacements limités au tour de chacun. S'appuie sur le combat natif de Foundry.
 */
import { CHEMIN } from "../config.mjs";

const renderTemplate = (...args) => foundry.applications.handlebars.renderTemplate(...args);
const heure = () => new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const TYPES = ["personnage", "ennemi"];

/** Combat en cours sur la scène affichée (ou le combat actif). */
export function combatEnCours() {
  const scene = canvas?.scene;
  return game.combats.find(c => c.started && (!scene || !c.scene || (c.scene.id === scene.id))) ?? null;
}

/** Combattants ayant lancé leur initiative, dans l'ordre de jeu. */
export function ordreDeJeu(combat) {
  return (combat?.turns ?? []).filter(c => c.initiative !== null && c.initiative !== undefined);
}

/* -------------------------------------------- */
/*  Lancer et finir                             */
/* -------------------------------------------- */

export async function lancerCombat() {
  if ( !game.user.isGM || !canvas?.ready ) return;
  if ( combatEnCours() ) return ui.notifications.warn("Un combat est déjà en cours sur cette scène.");
  const tokens = canvas.tokens.placeables.filter(t => t.actor && TYPES.includes(t.actor.type) && !t.document.hidden);
  if ( !tokens.length ) return ui.notifications.warn("Aucun personnage ni ennemi visible sur la scène.");

  const combat = await Combat.implementation.create({ scene: canvas.scene.id, active: true });
  await combat.createEmbeddedDocuments("Combatant", tokens.map(t => ({
    tokenId: t.id, sceneId: canvas.scene.id, actorId: t.actor.id, hidden: false
  })));
  await combat.update({ round: 1, turn: 0 }, { cpDemarrage: true });
  await envoyerMessagesInitiative(combat);
}

export async function finirCombat() {
  const combat = combatEnCours();
  if ( !game.user.isGM || !combat ) return;
  const ok = await foundry.applications.api.DialogV2.confirm({
    window: { title: "Mettre fin au combat" },
    content: "<p>Veux-tu vraiment mettre fin au combat ? L'ordre de jeu et le compteur de tours seront effacés.</p>",
    rejectClose: false, modal: true
  });
  if ( !ok ) return;
  await combat.delete();
  await ChatMessage.create({ content: `<div class="cp-msg"><div class="cp-msg-note"><b>Fin du combat</b> après ${combat.round} tour(s).</div></div>` });
}

/* -------------------------------------------- */
/*  Ordre de jeu                                */
/* -------------------------------------------- */

/** Passe à l'acteur suivant (rien au dernier : il faut « Tour suivant »). */
export async function acteurSuivant() {
  const combat = combatEnCours();
  if ( !game.user.isGM || !combat ) return;
  const ordre = ordreDeJeu(combat);
  if ( !ordre.length ) return ui.notifications.warn("Personne n'a encore lancé son initiative.");
  const i = ordre.findIndex(c => c.id === combat.combatant?.id);
  if ( i === ordre.length - 1 ) return ui.notifications.info("Dernier acteur du tour : utilise « Tour suivant ».");
  const suivant = ordre[i + 1] ?? ordre[0];
  return combat.update({ turn: combat.turns.indexOf(suivant) }, { direction: 1 });
}

export async function acteurPrecedent() {
  const combat = combatEnCours();
  if ( !game.user.isGM || !combat ) return;
  const ordre = ordreDeJeu(combat);
  const i = ordre.findIndex(c => c.id === combat.combatant?.id);
  if ( i <= 0 ) return;
  return combat.update({ turn: combat.turns.indexOf(ordre[i - 1]) }, { direction: -1 });
}

/** Tour suivant en combat : compteur +1 et retour au premier de l'ordre. */
export async function tourSuivantCombat(combat) {
  const ordre = ordreDeJeu(combat);
  const premier = ordre[0] ?? combat.turns[0];
  await combat.update({ round: combat.round + 1, turn: premier ? combat.turns.indexOf(premier) : 0 }, { direction: 1 });
  await ChatMessage.create({ content: `<div class="cp-msg"><div class="cp-msg-note"><b>Tour ${combat.round}</b></div></div>` });
}

/* -------------------------------------------- */
/*  Initiative                                  */
/* -------------------------------------------- */

/** Lance l'initiative d'un combattant (1d20 + initiative) avec un message du système. */
export async function lancerInitiative(combattant) {
  const acteur = combattant?.actor;
  if ( !acteur ) return;
  if ( !combattant.isOwner ) return ui.notifications.warn("Ce n'est pas ton combattant.");
  if ( (combattant.initiative !== null) && (combattant.initiative !== undefined) ) return ui.notifications.info(`${combattant.name} a déjà lancé son initiative.`);
  const jet = await new Roll(CONFIG.Combat.initiative.formula, acteur.getRollData()).evaluate();
  await combattant.update({ initiative: jet.total });
  const bonus = acteur.system.initiative?.valeur ?? 0;
  const contenu = await renderTemplate(`${CHEMIN}/templates/chat/des.hbs`, {
    acteur: combattant.name, heure: heure(), type: "Initiative", formule: `1d20 ${bonus >= 0 ? "+" : "−"} ${Math.abs(bonus)}`,
    total: jet.total, resultats: jet.dice[0]?.results.map(r => r.result) ?? []
  });
  const donnees = { speaker: ChatMessage.getSpeaker({ actor: acteur, token: combattant.token }), content: contenu, rolls: [jet], flags: { cyberpunk2075: { type: "jet" } } };
  // Les ennemis lancent en privé (MJ)
  if ( acteur.type === "ennemi" ) ChatMessage.applyRollMode(donnees, "gmroll");
  return ChatMessage.create(donnees);
}

/** MJ : lance l'initiative de tous les ennemis ou de tous les personnages qui ne l'ont pas encore. */
export async function lancerInitiativeGroupe(groupe) {
  const combat = combatEnCours();
  if ( !game.user.isGM || !combat ) return;
  const type = (groupe === "joueurs") ? "personnage" : "ennemi";
  const liste = combat.combatants.filter(c => (c.actor?.type === type) && ((c.initiative === null) || (c.initiative === undefined)));
  if ( !liste.length ) return ui.notifications.info("Tout le monde a déjà lancé son initiative.");
  for ( const c of liste ) await lancerInitiative(c);
}

/** Messages privés : chaque joueur reçoit le bouton de ses personnages, le MJ ceux des groupes. */
async function envoyerMessagesInitiative(combat) {
  const persos = combat.combatants.filter(c => c.actor?.type === "personnage");
  for ( const user of game.users.filter(u => !u.isGM) ) {
    const siens = persos.filter(c => c.actor.testUserPermission(user, "OWNER"));
    if ( !siens.length ) continue;
    const boutons = siens.map(c => `<button type="button" class="cp-msg-bt" data-cp-action="initiative" data-combattant="${c.id}">Lancer l'initiative · ${c.name}</button>`).join("");
    await ChatMessage.create({
      content: `<div class="cp-msg"><div class="cp-msg-etiquette"><span class="cp-msg-type">Combat</span><span class="cp-msg-titre">Lance ton initiative</span></div><div class="cp-msg-boutons cp-col cp-gap6">${boutons}</div></div>`,
      whisper: [user.id], flags: { cyberpunk2075: { type: "initiative", combat: combat.id } }
    });
  }
  const nbEnnemis = combat.combatants.filter(c => c.actor?.type === "ennemi").length;
  await ChatMessage.create({
    content: `<div class="cp-msg"><div class="cp-msg-etiquette"><span class="cp-msg-type">Combat · MJ</span><span class="cp-msg-titre">Initiative</span></div>
      <div class="cp-msg-boutons">
        <button type="button" class="cp-msg-bt" data-cp-action="initiativeGroupe" data-groupe="ennemis">Tous les ennemis (${nbEnnemis})</button>
        <button type="button" class="cp-msg-bt2" data-cp-action="initiativeGroupe" data-groupe="joueurs">Tous les joueurs (${persos.length})</button>
      </div>
      <div class="cp-msg-note">Le bouton « Joueurs » ne lance que pour ceux qui ne l'ont pas encore fait.</div></div>`,
    whisper: game.users.filter(u => u.isGM).map(u => u.id), flags: { cyberpunk2075: { type: "initiative", combat: combat.id } }
  });
}

/* -------------------------------------------- */
/*  Déplacements                                */
/* -------------------------------------------- */

/** Un joueur ne déplace son token en combat que pendant son tour. */
function deplacementInterdit(tokenDoc) {
  if ( game.user.isGM ) return false;
  const combat = game.combats.find(c => c.started && (c.scene?.id === tokenDoc.parent?.id));
  if ( !combat ) return false;
  const combattant = combat.combatants.find(c => c.tokenId === tokenDoc.id);
  if ( !combattant ) return false;
  if ( combat.combatant?.id === combattant.id ) return false;
  ui.notifications.warn(`${tokenDoc.name} ne peut se déplacer que pendant son tour.`);
  return true;
}

export function brancherDeplacements() {
  Hooks.on("preUpdateToken", (doc, changements) => {
    if ( !("x" in changements) && !("y" in changements) ) return;
    if ( deplacementInterdit(doc) ) return false;
  });
  Hooks.on("preMoveToken", doc => {
    if ( deplacementInterdit(doc) ) return false;
  });
}

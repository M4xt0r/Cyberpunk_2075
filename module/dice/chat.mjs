/**
 * Boutons des barrettes du chat et animations des messages.
 */
import { appliquer } from "./attaque.mjs";
import { forcerHack } from "./hack.mjs";
import { jouerAnimation } from "../animations.mjs";
import { creerZonePersistante, estMJActif } from "../hud/tours.mjs";
import { combatEnCours, lancerInitiative, lancerInitiativeGroupe } from "../hud/combat.mjs";
import { ajouterPings } from "../hud/pings.mjs";

const drapeaux = message => message.flags?.cyberpunk2075 ?? {};

/** Rendu d'un message : nettoyage selon le joueur, puis branchement des boutons. */
export function surRenduMessage(message, html) {
  const d = drapeaux(message);
  if ( !game.user.isGM ) for ( const el of html.querySelectorAll(".cp-mj-seul") ) el.remove();
  if ( d.acteur ) {
    const acteur = fromUuidSync(d.acteur, { strict: false });
    if ( !acteur?.isOwner ) for ( const el of html.querySelectorAll(".cp-proprio-seul") ) el.remove();
  }
  for ( const bouton of html.querySelectorAll("[data-cp-action]") ) {
    bouton.addEventListener("click", event => {
      event.preventDefault();
      surAction(message, bouton).catch(err => {
        console.error("Cyberpunk 2075 |", err);
        ui.notifications.error(`Action impossible : ${err.message}`);
      });
    });
  }
}

async function surAction(message, bouton) {
  const d = drapeaux(message);
  const { cpAction: action } = bouton.dataset;

  if ( action === "initiative" ) {
    const combat = game.combats.get(d.combat) ?? combatEnCours();
    const c = combat?.combatants.get(bouton.dataset.combattant);
    if ( !c ) return ui.notifications.warn("Ce combat est terminé.");
    return lancerInitiative(c);
  }

  if ( action === "arreterZone" ) {
    if ( !game.user.isGM ) return;
    const uuid = bouton.dataset.tuile;
    const tuile = (uuid && (uuid !== "message"))
      ? await fromUuid(uuid).catch(() => null)
      : game.scenes.map(s => s.tiles.find(t => t.flags?.cyberpunk2075?.zone?.message === message.id)).find(Boolean);
    if ( !tuile ) return ui.notifications.info("Cette zone a déjà disparu.");
    const nom = tuile.flags?.cyberpunk2075?.zone?.nom ?? "La zone";
    await tuile.delete();
    bouton.disabled = true;
    return ChatMessage.create({ content: `<div class="cp-msg"><div class="cp-msg-note">${nom} : zone arrêtée par le MJ.</div></div>` });
  }

  if ( action === "initiativeGroupe" ) return lancerInitiativeGroupe(bouton.dataset.groupe);

  if ( action === "lancerDegats" ) {
    const item = await fromUuid(d.item);
    if ( !item ) return ui.notifications.warn("L'arme n'existe plus.");
    const touchees = (d.cibles ?? []).filter(c => c.touche !== false);
    return item.lancerDegats({ cibles: d.cibles?.length ? touchees : null, critique: d.critique });
  }

  if ( action === "attaqueSup" ) {
    const item = await fromUuid(d.item);
    return item?.attaquer({ supplementaire: true });
  }

  if ( action === "forcerHack" ) {
    bouton.disabled = true;
    return forcerHack(message, Number(bouton.dataset.index));
  }

  if ( action === "appliquerTous" ) {
    bouton.disabled = true;
    const lignes = bouton.closest(".cp-msg")?.querySelectorAll("[data-cp-action='appliquer'][data-cible]:not([data-facteur])") ?? [];
    for ( const b of lignes ) await appliquer("degats", Number(b.dataset.montant), [b.dataset.cible], { attaquant: d.acteur, arme: d.item, typeDegats: b.dataset.typeDegats ?? "" });
    return;
  }

  if ( action === "appliquer" ) {
    const nature = bouton.dataset.nature ?? "degats";
    const facteur = Number(bouton.dataset.facteur ?? 1);
    const montant = Math.floor(Number(bouton.dataset.montant ?? d.total ?? 0) * facteur);
    let cible = bouton.dataset.cible ?? "";
    if ( cible === "soi" ) cible = d.acteur;
    return appliquer(nature, montant, cible ? [cible] : [], { attaquant: (d.type === "degats") ? d.acteur : null, arme: d.item, typeDegats: bouton.dataset.typeDegats ?? "" });
  }
}

/** Nouveau message : chaque client joue l'animation sur sa scène affichée. */
export async function surCreationMessage(message) {
  const d = drapeaux(message);
  const liste = [d.animation, ...(d.animations ?? [])].filter(a => a);
  // Ping : le MJ actif pose les marques sur la scène une fois l'onde terminée
  if ( (d.type === "ping") && d.ping && estMJActif() ) {
    await attendreDes(message);
    if ( canvas?.ready && (canvas.scene?.id === d.ping.scene) && liste.length ) {
      await Promise.all(liste.map(a => jouerAnimation(a).catch(() => null)));
    } else await new Promise(r => setTimeout(r, 1600));
    return ajouterPings(d.ping).catch(err => console.warn("Cyberpunk 2075 | Ping :", err));
  }
  const zone = d.zonePersistante;
  if ( (!liste.length || !canvas?.ready) && !zone ) return;
  await attendreDes(message);
  // Zone persistante (nuage toxique…) : posée par le MJ actif après l'animation
  if ( zone && estMJActif() ) {
    if ( canvas?.ready && liste.length && (canvas.scene?.id === zone.scene) ) {
      await Promise.all(liste.filter(a => canvas.scene?.id === a.scene).map(a => jouerAnimation(a).catch(() => null)));
    }
    return creerZonePersistante({ ...zone, message: message.id }).catch(err => console.warn("Cyberpunk 2075 | Zone impossible :", err));
  }
  if ( !liste.length || !canvas?.ready ) return;
  for ( const anim of liste ) {
    if ( canvas.scene?.id !== anim.scene ) continue;
    try {
      await jouerAnimation(anim);
    } catch(err) {
      console.warn("Cyberpunk 2075 | Animation impossible :", err);
    }
  }
}

/**
 * Dice So Nice : l'animation attend la fin du lancer de dés 3D du message
 * (au plus 8 secondes, au cas où le lancer ne serait pas montré à ce client).
 */
function attendreDes(message) {
  if ( !game.modules.get("dice-so-nice")?.active || !message.rolls?.length ) return Promise.resolve();
  return new Promise(resolve => {
    let id = null;
    const fin = () => { Hooks.off("diceSoNiceRollComplete", id); clearTimeout(minuteur); resolve(); };
    id = Hooks.on("diceSoNiceRollComplete", messageId => { if ( messageId === message.id ) fin(); });
    const minuteur = setTimeout(fin, 8000);
  });
}

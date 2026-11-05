/**
 * Boutons des barrettes du chat et animations des messages.
 */
import { appliquer } from "./attaque.mjs";
import { forcerHack } from "./hack.mjs";
import { jouerAnimation } from "../animations.mjs";

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
    for ( const b of lignes ) await appliquer("degats", Number(b.dataset.montant), [b.dataset.cible], { attaquant: d.acteur, arme: d.item });
    return;
  }

  if ( action === "appliquer" ) {
    const nature = bouton.dataset.nature ?? "degats";
    const facteur = Number(bouton.dataset.facteur ?? 1);
    const montant = Math.floor(Number(bouton.dataset.montant ?? d.total ?? 0) * facteur);
    let cible = bouton.dataset.cible ?? "";
    if ( cible === "soi" ) cible = d.acteur;
    return appliquer(nature, montant, cible ? [cible] : [], { attaquant: (d.type === "degats") ? d.acteur : null, arme: d.item });
  }
}

/** Nouveau message : chaque client joue l'animation sur sa scène affichée. */
export async function surCreationMessage(message) {
  const d = drapeaux(message);
  const liste = [d.animation, ...(d.animations ?? [])].filter(a => a);
  if ( !liste.length || !canvas?.ready ) return;
  await attendreDes(message);
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

/**
 * Boutons des barrettes du chat et animations des messages.
 */
import { appliquer } from "./attaque.mjs";
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

  if ( action === "appliquer" ) {
    const nature = bouton.dataset.nature ?? "degats";
    const facteur = Number(bouton.dataset.facteur ?? 1);
    const montant = Math.floor(Number(bouton.dataset.montant ?? d.total ?? 0) * facteur);
    let cible = bouton.dataset.cible ?? "";
    if ( cible === "soi" ) cible = d.acteur;
    return appliquer(nature, montant, cible ? [cible] : []);
  }
}

/** Nouveau message : chaque client joue l'animation sur sa scène affichée. */
export function surCreationMessage(message) {
  const anim = drapeaux(message).animation;
  if ( !anim || !canvas?.ready || (canvas.scene?.id !== anim.scene) ) return;
  jouerAnimation(anim).catch(err => console.warn("Cyberpunk 2075 | Animation impossible :", err));
}

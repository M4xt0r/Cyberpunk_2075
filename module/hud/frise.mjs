/**
 * Frise d'ordre de jeu en haut au milieu (façon Baldur's Gate 3) : un rectangle par combattant
 * ayant lancé son initiative, celui qui joue mis en avant, compteur de tours.
 * Le MJ a à gauche « Acteur précédent » et « Acteur suivant ».
 */
import { CHEMIN } from "../config.mjs";
import { combatEnCours, ordreDeJeu, acteurSuivant, acteurPrecedent } from "./combat.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export default class FriseCombat extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "cp-frise-combat",
    classes: ["cp2075", "cp-frise"],
    tag: "section",
    window: { frame: false, positioned: false },
    actions: {
      suivant: () => acteurSuivant(),
      precedent: () => acteurPrecedent(),
      centrer: FriseCombat.#centrer
    }
  };

  static PARTS = {
    frise: { template: `${CHEMIN}/templates/hud/frise.hbs` }
  };

  rafraichir = foundry.utils.debounce(() => this.render(), 80);

  async _prepareContext() {
    const combat = combatEnCours();
    if ( !combat ) return { actif: false };
    const ordre = ordreDeJeu(combat);
    const courant = combat.combatant?.id;
    const iCourant = ordre.findIndex(c => c.id === courant);
    return {
      actif: true,
      mj: game.user.isGM,
      tour: combat.round,
      attente: combat.combatants.size - ordre.length,
      premier: iCourant <= 0,
      dernier: iCourant === ordre.length - 1,
      joueur: iCourant >= 0 ? ordre[iCourant].name : null,
      cartes: ordre.map(c => {
        const a = c.actor;
        const vie = a?.system?.vie;
        const voitVie = game.user.isGM || a?.isOwner || (a?.type === "personnage");
        const pct = vie?.max ? Math.clamp(Math.round(vie.value / vie.max * 100), 0, 100) : null;
        return {
          id: c.id, nom: c.name, img: c.token?.texture?.src || c.img || a?.img,
          ennemi: a?.type === "ennemi", actif: c.id === courant, initiative: c.initiative,
          mort: c.isDefeated || ((vie?.value ?? 1) <= 0),
          aVie: voitVie && (pct !== null), vie: pct ?? 0
        };
      })
    };
  }

  /** Clic sur une carte : la caméra va sur le token. */
  static async #centrer(event, cible) {
    const c = combatEnCours()?.combatants.get(cible.dataset.id);
    const t = c?.token?.object;
    if ( t?.visible ) canvas.animatePan({ x: t.center.x, y: t.center.y, duration: 400 });
  }
}

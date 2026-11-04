import ArmeData from "../data/arme.mjs";
import { attaquer, lancerDegats } from "../dice/attaque.mjs";
import { utiliserObjet, activerImplant } from "../dice/utilisation.mjs";
import { lancerHack } from "../dice/hack.mjs";
import { appliquerClasse, appliquerSousClasse } from "./progression.mjs";

/**
 * Item Cyberpunk 2075.
 */
export default class ItemCP extends Item {

  /** Valeurs par défaut du type d'arme à la création. @override */
  async _preCreate(donnees, options, utilisateur) {
    if ( (await super._preCreate(donnees, options, utilisateur)) === false ) return false;
    if ( (this.type === "implant") && !foundry.utils.hasProperty(donnees, "system.coutInstallation") && this.system.coutMin ) {
      this.updateSource({ "system.coutInstallation": this.system.coutMin });
    }
    if ( (this.type === "arme") && !foundry.utils.hasProperty(donnees, "system.competence") ) {
      const maj = ArmeData.valeursParType(this.system.type);
      this.updateSource(foundry.utils.expandObject(maj));
    }
    if ( (this.type === "objet") && (this.system.chargesRestantes === 0) && (this.system.chargesMax > 0) ) {
      this.updateSource({ "system.chargesRestantes": this.system.chargesMax });
    }
  }

  /** Changement de type d'arme : la compétence, la défense et la zone suivent. */
  async #preUpdateArme(changements, options, utilisateur) {
    if ( (await super._preUpdate(changements, options, utilisateur)) === false ) return false;
    const nouveauType = foundry.utils.getProperty(changements, "system.type");
    if ( (this.type === "arme") && nouveauType && (nouveauType !== this.system.type) ) {
      const maj = ArmeData.valeursParType(nouveauType);
      for ( const [cle, valeur] of Object.entries(maj) ) {
        if ( !foundry.utils.hasProperty(changements, cle) ) foundry.utils.setProperty(changements, cle, valeur);
      }
    }
  }

  /** Items qui comptent dans le minimum d'Humanité. */
  get compteDansMinimum() {
    return ["implant", "ameliorationImplant", "capsule"].includes(this.type);
  }

  /** Poser un implant, une amélioration ou une capsule : la jauge d'Humanité monte de son coût. @override */
  _onCreate(donnees, options, idUtilisateur) {
    super._onCreate(donnees, options, idUtilisateur);
    if ( (idUtilisateur === game.user.id) && (this.actor?.type === "personnage") && !options.cpProgression ) {
      if ( this.type === "classe" ) appliquerClasse(this.actor, this, 1);
      if ( this.type === "sousClasse" ) appliquerSousClasse(this.actor, this);
    }
    if ( !this.compteDansMinimum || (idUtilisateur !== game.user.id) || (this.actor?.type !== "personnage") ) return;
    const cout = Number(this.system.coutInstallation) || 0;
    if ( cout ) this.actor.modifierHumanite(cout);
  }

  /** Changer le coût posé ajuste la jauge de la différence. @override */
  async _preUpdate(changements, options, utilisateur) {
    const cout = foundry.utils.getProperty(changements, "system.coutInstallation");
    if ( this.compteDansMinimum && (cout !== undefined) ) options.cpEcartCout = (Number(cout) || 0) - (Number(this.system.coutInstallation) || 0);
    return this.#preUpdateArme(changements, options, utilisateur);
  }

  /** @override */
  _onUpdate(changements, options, idUtilisateur) {
    super._onUpdate(changements, options, idUtilisateur);
    if ( options.cpEcartCout && (idUtilisateur === game.user.id) && (this.actor?.type === "personnage") ) this.actor.modifierHumanite(options.cpEcartCout);
  }

  /** Retirer un implant retire aussi ses améliorations et sa capsule ; la jauge d'Humanité baisse de leurs coûts. @override */
  _onDelete(options, idUtilisateur) {
    super._onDelete(options, idUtilisateur);
    if ( (this.type === "classe") && (idUtilisateur === game.user.id) && (this.actor?.type === "personnage") && game.actors.has(this.actor.id) ) {
      appliquerClasse(this.actor, this, -1);
    }
    if ( !this.compteDansMinimum || (idUtilisateur !== game.user.id) || !this.actor ) return;
    const acteur = this.actor;
    if ( !acteur.isToken && !game.actors.has(acteur.id) ) return;
    // Implant : ses améliorations et sa capsule partent avec lui, la jauge baisse de tout en une fois
    const rattaches = (this.type === "implant")
      ? acteur.items.filter(i => ["ameliorationImplant", "capsule"].includes(i.type) && (i.system.implant === this.id))
      : [];
    const baisse = options.cpSansHumanite ? 0
      : [this, ...rattaches].reduce((n, i) => n + (Number(i.system.coutInstallation) || 0), 0);
    (async () => {
      if ( rattaches.length ) await acteur.deleteEmbeddedDocuments("Item", rattaches.map(i => i.id), { cpSansHumanite: true });
      if ( baisse && (acteur.type === "personnage") ) {
        acteur.reset();  // minimum d'Humanité recalculé sans les items retirés
        await acteur.modifierHumanite(-baisse);
      }
    })().catch(err => console.error("Cyberpunk 2075 |", err));
  }

  /** L'item peut-il attaquer (arme, implant à arme intégrée) ? */
  get peutAttaquer() {
    return (this.type === "arme") || (["implant", "ameliorationVehicule"].includes(this.type) && this.system.armeIntegree);
  }

  /** Attaque avec l'arme (fenêtre, jet, chat, animation). */
  async attaquer(options = {}) {
    if ( !this.peutAttaquer ) return null;
    return attaquer(this, options);
  }

  /** Dégâts directs, sans jet d'attaque. */
  async lancerDegats(options = {}) {
    if ( !this.peutAttaquer ) return null;
    return lancerDegats(this, options);
  }

  /** Active un implant ou un talent à effet actif. */
  async activer() {
    if ( !["implant", "talent"].includes(this.type) ) return null;
    return activerImplant(this);
  }

  /** Utilise un objet (soin, effet actif, consommable). */
  async utiliser(options = {}) {
    if ( this.type !== "objet" ) return null;
    return utiliserObjet(this, options);
  }

  /** Lance un hack (RAM, jet contre la Glace, chat, animation). */
  async lancer(options = {}) {
    if ( this.type !== "hack" ) return null;
    return lancerHack(this, options);
  }
}

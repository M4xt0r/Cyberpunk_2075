import { CARACS, COMPETENCES } from "../config.mjs";
import { demanderOptionsJet, lancerJetD20 } from "../dice/jets.mjs";

/**
 * Acteur Cyberpunk 2075 : données de jet et jets en un clic.
 */
export default class ActeurCP extends Actor {

  /** @override */
  getRollData() {
    // Copie : ne jamais ajouter de clés au vrai objet system
    const donnees = { ...super.getRollData() };
    if ( this.type !== "personnage" ) return donnees;
    const s = this.system;
    for ( const cle of Object.keys(CARACS) ) donnees[cle] = s.caracs[cle].bonus;
    donnees.bm = s.maitrise.effectif;
    donnees.initiative = s.initiative.valeur;
    return donnees;
  }

  /* -------------------------------------------- */

  /**
   * Jet de compétence : 1d20 + score.
   * @param {string} cle            Clé de la compétence.
   * @param {object} [options]
   * @param {boolean} [options.rapide]  Sans fenêtre (Maj + clic) : jet normal, sans DD.
   */
  async lancerCompetence(cle, { rapide = false } = {}) {
    const comp = this.system.competences?.[cle];
    const def = COMPETENCES[cle];
    if ( !comp || !def ) return null;
    const carac = this.system.caracs[def.carac];
    const parts = [{ label: CARACS[def.carac].abrev, valeur: carac.bonus }];
    if ( comp.maitrise ) parts.push({ label: this.system.maitrise.perdue ? "Maîtrise (perdue, stress)" : "Maîtrise", valeur: this.system.maitrise.effectif });
    if ( comp.bonusObjets ) parts.push({ label: "Implants et objets", valeur: comp.bonusObjets });
    return this.#jet({ type: "Compétence", titre: def.label, parts, rapide });
  }

  /**
   * Jet de caractéristique : 1d20 + bonus.
   * @param {string} cle
   * @param {object} [options]
   */
  async lancerCaracteristique(cle, { rapide = false } = {}) {
    const carac = this.system.caracs?.[cle];
    if ( !carac ) return null;
    const label = CARACS[cle].labelLong ?? CARACS[cle].label;
    return this.#jet({ type: "Caractéristique", titre: label, parts: [{ label: CARACS[cle].abrev, valeur: carac.bonus }], rapide });
  }

  /**
   * Initiative : dans un combat, passe par le tracker de combat ; sinon simple jet dans le chat.
   */
  async lancerInitiativeCP() {
    if ( game.combat ) return this.rollInitiative({ createCombatants: true });
    const parts = [{ label: "Initiative", valeur: this.system.initiative.valeur }];
    return lancerJetD20({ acteur: this, type: "Initiative", titre: "Initiative", parts, mode: "normal", dd: null, visibilite: "public" });
  }

  /* -------------------------------------------- */

  async #jet({ type, titre, parts, rapide }) {
    const totalBonus = parts.reduce((s, p) => s + p.valeur, 0);
    let options = { mode: "normal", dd: null, bonus: 0, visibilite: "public" };
    if ( !rapide ) {
      options = await demanderOptionsJet({ type, titre, totalBonus });
      if ( !options ) return null;
    }
    if ( options.bonus ) parts = [...parts, { label: "Bonus du MJ", valeur: options.bonus }];
    return lancerJetD20({ acteur: this, type, titre, parts, ...options });
  }
}

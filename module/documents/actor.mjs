import { CARACS, COMPETENCES } from "../config.mjs";
import { demanderOptionsJet, lancerJetD20, signe } from "../dice/jets.mjs";
import { preparerMiseAJour, posterAlertes, reposLong, jetDeMort } from "./humanite.mjs";

/**
 * Acteur Cyberpunk 2075 : données de jet, jets en un clic, dégâts et soins reçus.
 */
export default class ActeurCP extends Actor {

  /** @override */
  getRollData() {
    // Copie : ne jamais ajouter de clés au vrai objet system
    const donnees = { ...super.getRollData() };
    if ( this.type !== "personnage" ) return donnees;
    const s = this.system;
    for ( const cle of Object.keys(CARACS) ) donnees[cle] = s.caracs[cle].bonus;
    for ( const cle of Object.keys(COMPETENCES) ) donnees[cle] = s.competences[cle].score;
    donnees.bm = s.maitrise.effectif;
    donnees.initiative = s.initiative.valeur;
    donnees.niveau = s.niveau;
    return donnees;
  }

  /* -------------------------------------------- */
  /*  Automatismes : stress et Humanité           */
  /* -------------------------------------------- */

  /** @override */
  async _preUpdate(changements, options, utilisateur) {
    if ( (await super._preUpdate(changements, options, utilisateur)) === false ) return false;
    if ( (this.type !== "personnage") || options.cpSansAutomatisme ) return;
    const alertes = await preparerMiseAJour(this, changements);
    if ( alertes.length ) options.cpAlertes = [...(options.cpAlertes ?? []), ...alertes];
  }

  /** @override */
  _onUpdate(changements, options, idUtilisateur) {
    super._onUpdate(changements, options, idUtilisateur);
    if ( (idUtilisateur === game.user.id) && options.cpAlertes?.length ) posterAlertes(this, options.cpAlertes);
  }

  /** Repos long (RAM, utilisations, stress, Humanité). */
  async reposLong() {
    return reposLong(this);
  }

  /** Jet de mort à 0 PV. */
  async jetDeMort() {
    return jetDeMort(this);
  }

  /** Valeur de défense (null si inconnue : le MJ juge). */
  defense(type) {
    if ( typeof this.system.defense === "function" ) return this.system.defense(type);
    const v = this.system[type];
    if ( typeof v === "number" ) return v;
    return v?.valeur ?? null;
  }

  /* -------------------------------------------- */
  /*  Jets                                        */
  /* -------------------------------------------- */

  /**
   * Jet de compétence : 1d20 + score.
   * @param {string} cle
   * @param {object} [options]
   * @param {boolean} [options.rapide]  Sans fenêtre (Maj + clic).
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

  /** Jet de caractéristique : 1d20 + bonus. */
  async lancerCaracteristique(cle, { rapide = false } = {}) {
    const carac = this.system.caracs?.[cle];
    if ( !carac ) return null;
    const label = CARACS[cle].labelLong ?? CARACS[cle].label;
    return this.#jet({ type: "Caractéristique", titre: label, parts: [{ label: CARACS[cle].abrev, valeur: carac.bonus }], rapide });
  }

  /** Initiative : dans un combat, passe par le tracker ; sinon simple jet dans le chat. */
  async lancerInitiativeCP() {
    if ( game.combat ) return this.rollInitiative({ createCombatants: true });
    const parts = [{ label: "Initiative", valeur: this.system.initiative.valeur }];
    return lancerJetD20({ acteur: this, type: "Initiative", titre: "Initiative", parts, mode: "normal", dd: null, visibilite: "public" });
  }

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

  /* -------------------------------------------- */
  /*  Dégâts et soins                             */
  /* -------------------------------------------- */

  /**
   * Inflige des dégâts : réduction des objets portés (Gilet…), puis perte de PV.
   * Les objets qui réduisent les dégâts et ont des charges en perdent une par attaque subie.
   * @param {number} montant
   * @returns {Promise<{avant: number, apres: number, reduit: number}>}
   */
  async subirDegats(montant) {
    const s = this.system;
    const reduction = -(s.modificateurs?.degatsRecus ?? 0);
    const reel = Math.max(0, montant - Math.max(0, reduction));
    const avant = s.vie?.value ?? 0;
    const apres = Math.max(0, avant - reel);
    await this.update({ "system.vie.value": apres });

    // Gilet pare-balles : une charge de moins par attaque subie
    if ( montant > 0 ) {
      const usures = [];
      for ( const item of this.items ) {
        const sys = item.system;
        if ( !sys.effetActifMaintenant || !(sys.chargesMax > 0) ) continue;
        if ( !sys.modificateursActifs.some(m => m.cible === "degatsRecus") ) continue;
        const reste = Math.max(0, sys.chargesRestantes - 1);
        if ( reste > 0 ) usures.push({ _id: item.id, "system.chargesRestantes": reste });
        else usures.push({ _id: item.id, "system.chargesRestantes": 0, "system.quantite": Math.max(0, sys.quantite - 1), "system.porte": false });
        if ( reste === 0 ) ui.notifications.info(`${this.name} : ${item.name} est en lambeaux.`);
      }
      if ( usures.length ) await this.updateEmbeddedDocuments("Item", usures);
    }
    return { avant, apres, reduit: montant - reel };
  }

  /**
   * Reçoit un soin. Relever quelqu'un de 0 à 1 PV ou plus donne 1 point de stress.
   * @param {number} montant
   */
  async recevoirSoin(montant) {
    const s = this.system;
    const total = Math.max(0, montant + (s.modificateurs?.soinsRecus ?? 0));
    const avant = s.vie?.value ?? 0;
    const max = s.vie?.max ?? avant + total;
    const apres = Math.min(max, avant + total);
    const maj = { "system.vie.value": apres };
    const releve = (avant === 0) && (apres >= 1) && (this.type === "personnage");
    if ( releve ) {
      maj["system.stress"] = Math.min(4, s.stress + 1);
      maj["system.mort.succes"] = 0;
      maj["system.mort.echecs"] = 0;
    }
    await this.update(maj);
    return { avant, apres, releve };
  }

  /**
   * Ajoute des 💀 à la jauge d'Humanité, sans passer sous le minimum.
   * @param {number} montant  Peut être négatif (Immunosuppresseur).
   */
  async modifierHumanite(montant) {
    const h = this.system.humanite;
    if ( !h || !montant ) return null;
    const apres = Math.max(h.min ?? 0, h.value + montant);
    await this.update({ "system.humanite.value": apres });
    return { avant: h.value, apres, max: h.max };
  }
}

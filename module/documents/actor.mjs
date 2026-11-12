import { CARACS, COMPETENCES } from "../config.mjs";
import { demanderOptionsJet, lancerJetD20, signe } from "../dice/jets.mjs";
import { preparerMiseAJour, posterAlertes, reposLong, jetDeMort } from "./humanite.mjs";
import { monterNiveau } from "./progression.mjs";

/**
 * Acteur Cyberpunk 2075 : données de jet, jets en un clic, dégâts et soins reçus.
 */
/** Types de dégâts que le gilet pare-balles n'arrête pas. */
const TYPES_NON_ARRETES = ["feu", "poison", "electrique"];

export default class ActeurCP extends Actor {

  /** @override */
  getRollData() {
    // Copie : ne jamais ajouter de clés au vrai objet system
    const donnees = { ...super.getRollData() };
    // Véhicule : les formules (1d6 + Pilotage) se lisent sur le pilote
    if ( this.type === "vehicule" ) {
      const pilote = this.system.piloteActeur;
      return { ...(pilote?.getRollData() ?? {}), ...donnees, vitesse: this.system.bonusVitesse, maniabilite: this.system.maniabiliteEffective };
    }
    if ( !["personnage", "ennemi"].includes(this.type) ) return donnees;
    const s = this.system;
    for ( const cle of Object.keys(CARACS) ) donnees[cle] = s.caracs[cle].bonus;
    for ( const cle of Object.keys(COMPETENCES) ) donnees[cle] = s.competences[cle].score;
    donnees.bm = s.maitrise.effectif;
    donnees.initiative = s.initiative.valeur;
    donnees.niveau = s.niveau;
    return donnees;
  }

  /** Token par défaut : barre de vie, ennemi hostile et non lié. @override */
  async _preCreate(donnees, options, utilisateur) {
    if ( (await super._preCreate(donnees, options, utilisateur)) === false ) return false;
    if ( ["vehicule", "planque"].includes(this.type) ) {
      this.updateSource({ prototypeToken: { actorLink: true, disposition: CONST.TOKEN_DISPOSITIONS.NEUTRAL, bar1: { attribute: this.type === "vehicule" ? "vie" : null }, ...(donnees.prototypeToken ?? {}) } });
      return;
    }
    if ( this.type !== "ennemi" ) return;
    const T = CONST.TOKEN_DISPOSITIONS;
    this.updateSource({ prototypeToken: {
      actorLink: false,
      disposition: T.HOSTILE,
      bar1: { attribute: "vie" },
      displayBars: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
      ...(donnees.prototypeToken ?? {})
    } });
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

  /** Montée de niveau (dés de gain, talents, maîtrise). */
  async monterNiveau() {
    return monterNiveau(this);
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
    if ( this.type === "ennemi" ) {
      const parts = [{ label: comp.cle ? def.label : CARACS[def.carac].abrev, valeur: comp.base }];
      if ( comp.bonusObjets ) parts.push({ label: "Implants et objets", valeur: comp.bonusObjets });
      return this.#jet({ type: "Compétence", titre: def.label, parts, rapide });
    }
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
  async subirDegats(montant, { typeDegats = "" } = {}) {
    const s = this.system;
    let reduction = (this.type === "ennemi") ? s.reductionTotale : Math.max(0, -(s.modificateurs?.degatsRecus ?? 0));
    if ( !s.vie ) return { avant: 0, apres: 0, reduit: 0 };
    // Ennemis : immunités et types que la réduction ne diminue pas
    const immunise = !!typeDegats && (s.immunites ?? []).includes(typeDegats);
    if ( typeDegats && (s.reductionSauf ?? []).includes(typeDegats) ) reduction = 0;
    // Protections qui s'usent (gilet pare-balles) : sans effet contre le feu, le poison et l'électricité
    const protections = this.items.filter(i => i.system.effetActifMaintenant && (i.system.chargesMax > 0)
      && i.system.modificateursActifs?.some(m => m.cible === "degatsRecus"));
    const elementaire = TYPES_NON_ARRETES.includes(typeDegats);
    if ( elementaire ) {
      const parGilet = protections.reduce((t, i) => t + i.system.modificateursActifs.filter(m => m.cible === "degatsRecus").reduce((u, m) => u - (Number(m.valeur) || 0), 0), 0);
      reduction = Math.max(0, reduction - Math.max(0, parGilet));
    }
    const reel = immunise ? 0 : Math.max(0, montant - reduction);
    const avant = s.vie?.value ?? 0;
    const apres = Math.max(0, avant - reel);
    await this.update({ "system.vie.value": apres });
    if ( this.type === "vehicule" ) await this.#etatVehicule(avant, apres);
    // Un ennemi meurt à 0 PV
    if ( (this.type === "ennemi") && (avant > 0) && (apres === 0) ) {
      await this.toggleStatusEffect("dead", { active: true, overlay: true }).catch(() => null);
    }

    // Gilet pare-balles : une charge de moins par attaque subie
    if ( (montant > 0) && !elementaire ) {
      const usures = [];
      for ( const item of protections ) {
        const sys = item.system;
        const reste = Math.max(0, sys.chargesRestantes - 1);
        if ( reste > 0 ) usures.push({ _id: item.id, "system.chargesRestantes": reste });
        else usures.push({ _id: item.id, "system.chargesRestantes": 0, "system.quantite": Math.max(0, sys.quantite - 1), "system.porte": false });
        if ( reste === 0 ) ui.notifications.info(`${this.name} : ${item.name} est en lambeaux.`);
      }
      if ( usures.length ) await this.updateEmbeddedDocuments("Item", usures);
    }
    return { avant, apres, reduit: montant - reel, immunise };
  }

  /** Véhicule : alerte à la moitié des PV (−1 cran de vitesse) et à la destruction. */
  async #etatVehicule(avant, apres) {
    const max = this.system.vie.max;
    const blinde = this.system.blinde;
    if ( (avant > 0) && (apres === 0) ) {
      const jet = await new Roll(blinde ? "1d6" : "2d6").evaluate();
      return ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: this }),
        rolls: [jet],
        content: `<div class="cp-msg cp-msg-alerte"><div class="cp-msg-etiquette cp-msg-etiquette-rouge"><span class="cp-msg-type">Véhicule</span><span class="cp-msg-titre">${this.name} détruit</span></div>
          <div class="cp-msg-puce"><span class="cp-msg-total cp-jaune">${jet.total}</span><div class="cp-msg-des"><span class="cp-num cp-msg-detail">${jet.formula} : ${jet.result}</span><span>dégâts pour chaque occupant${blinde ? " (blindé)" : ""}</span></div></div>
          <div class="cp-msg-boutons cp-mj-seul"><button type="button" class="cp-msg-bt" data-cp-action="appliquer" data-nature="degats" data-montant="${jet.total}">Appliquer</button><span class="cp-msg-source cp-pousse">aux tokens sélectionnés</span></div>
          <div class="cp-msg-broches"></div></div>`
      });
    }
    if ( (avant > max / 2) && (apres <= max / 2) && (apres > 0) ) ui.notifications.warn(`${this.name} est endommagé : −1 cran de vitesse.`);
  }

  /**
   * Piloter (poursuite) : 1d20 + Pilotage du pilote + Maniabilité + bonus de Vitesse.
   * @param {object} [options]
   * @param {boolean} [options.rapide]
   */
  async piloter({ rapide = false } = {}) {
    if ( this.type !== "vehicule" ) return null;
    const s = this.system;
    const pilote = s.piloteActeur;
    if ( !pilote ) return ui.notifications.warn(`${this.name} n'a pas de pilote : choisis-le sur la fiche du véhicule.`);
    if ( s.detruit ) return ui.notifications.warn(`${this.name} est détruit.`);
    const parts = [
      { label: `Pilotage (${pilote.name})`, valeur: pilote.system.competences?.pilotage?.score ?? 0 },
      { label: "Maniabilité", valeur: s.maniabiliteEffective },
      { label: `Vitesse ${s.vitesseEffective}`, valeur: s.bonusVitesse }
    ];
    return this.#jetPour(pilote, { type: "Pilotage", titre: this.name, parts, rapide });
  }

  async #jetPour(acteur, { type, titre, parts, rapide }) {
    const totalBonus = parts.reduce((x, p) => x + p.valeur, 0);
    let options = { mode: "normal", dd: null, bonus: 0, visibilite: "public" };
    if ( !rapide ) {
      options = await demanderOptionsJet({ type, titre, totalBonus });
      if ( !options ) return null;
    }
    if ( options.bonus ) parts = [...parts, { label: "Bonus du MJ", valeur: options.bonus }];
    return lancerJetD20({ acteur, type, titre, parts, ...options });
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

/**
 * Barre d'actions en bas de la scène (remplace la barre de macros).
 * Joueur : son personnage. MJ : un menu déroulant pour passer d'un token à l'autre
 * (ennemis et personnages présents sur la scène).
 */
import { CHEMIN, CARACS, COMPETENCES, TYPES_ARME } from "../config.mjs";
import { signe } from "../dice/jets.mjs";
import { dansBuild } from "../data/ennemi.mjs";
import { aVisionThermique, basculerThermique } from "./vision.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const ACTIVATIONS = { action: "action", bonus: "action bonus", reaction: "réaction" };

export default class BarreActions extends HandlebarsApplicationMixin(ApplicationV2) {

  static DEFAULT_OPTIONS = {
    id: "cp-barre-actions",
    classes: ["cp2075", "cp-barre"],
    tag: "section",
    window: { frame: false, positioned: false },
    actions: {
      action: BarreActions.#action,
      infos: BarreActions.#infos,
      jet: BarreActions.#jet,
      basculerJets: BarreActions.#basculerJets,
      basculerDes: BarreActions.#basculerDes,
      changerNbDes: BarreActions.#changerNbDes,
      lancerDes: BarreActions.#lancerDes,
      ouvrirFiche: BarreActions.#ouvrirFiche
    }
  };

  static PARTS = {
    barre: { template: `${CHEMIN}/templates/hud/barre.hbs` }
  };

  /** Token choisi par le MJ (id), menu des jets ouvert. */
  _tokenId = null;
  _jetsOuverts = false;
  _desOuverts = false;
  _nbDes = 1;

  /** Rendu groupé : plusieurs changements d'affilée ne redessinent qu'une fois. */
  rafraichir = foundry.utils.debounce(() => this.render(), 100);

  /** Place la barre dans la zone du bas, à la place de la barre de macros. @override */
  _insertElement(element) {
    const existant = document.getElementById(element.id);
    if ( existant ) return existant.replaceWith(element);
    const bas = document.getElementById("ui-bottom") ?? document.body;
    const macros = document.getElementById("hotbar");
    if ( macros?.parentElement === bas ) macros.before(element);
    else bas.prepend(element);
  }

  /* -------------------------------------------- */
  /*  Acteur affiché                              */
  /* -------------------------------------------- */

  /** Tokens que le MJ peut choisir : ennemis et personnages de la scène affichée. */
  get tokensScene() {
    if ( !canvas?.ready ) return [];
    return canvas.tokens.placeables
      .filter(t => t.actor && ["ennemi", "personnage"].includes(t.actor.type))
      .sort((a, b) => (a.actor.type === b.actor.type ? 0 : a.actor.type === "personnage" ? -1 : 1) || a.name.localeCompare(b.name));
  }

  /** L'acteur de la barre (pour un token non lié, l'acteur du token). */
  get acteur() {
    if ( !game.user.isGM ) {
      const perso = game.user.character;
      if ( perso?.type === "personnage" ) return perso;
      return game.actors.find(a => (a.type === "personnage") && a.isOwner) ?? null;
    }
    const tokens = this.tokensScene;
    let token = tokens.find(t => t.id === this._tokenId);
    if ( !token ) {
      token = tokens.find(t => t.controlled) ?? tokens[0] ?? null;
      this._tokenId = token?.id ?? null;
    }
    return token?.actor ?? null;
  }

  /** Le MJ sélectionne un token sur la carte : la barre le suit. */
  suivreToken(token, controle) {
    if ( !game.user.isGM || !controle || !token.actor ) return;
    if ( !["ennemi", "personnage"].includes(token.actor.type) ) return;
    if ( this._tokenId === token.id ) return;
    this._tokenId = token.id;
    this.rafraichir();
  }

  /** Faut-il redessiner pour cet acteur ? */
  concerne(acteur) {
    if ( !acteur ) return true;
    const a = this.acteur;
    return !a || (a === acteur) || (a.id === acteur.id);
  }

  /* -------------------------------------------- */
  /*  Contexte                                    */
  /* -------------------------------------------- */

  async _prepareContext(options) {
    const acteur = this.acteur;
    const c = {
      mj: game.user.isGM, acteur: null, ouvert: this._jetsOuverts,
      desOuverts: this._desOuverts, nbDes: this._nbDes, desPluriel: this._nbDes > 1,
      nbMin: this._nbDes <= 1, nbMax: this._nbDes >= 20,
      des: [2, 4, 6, 8, 10, 12, 20, 100].map(faces => ({ faces }))
    };
    if ( game.user.isGM ) {
      c.choixTokens = this.tokensScene.map(t => ({ id: t.id, nom: t.name, ennemi: t.actor.type === "ennemi", actif: t.id === this._tokenId }));
      c.aucunToken = !c.choixTokens.length;
    }
    if ( !acteur ) return c;
    const s = acteur.system;
    const perso = acteur.type === "personnage";
    const items = perso ? [...acteur.items] : acteur.items.filter(i => dansBuild(i, s.build));
    const tri = (a, b) => (a.sort - b.sort) || a.name.localeCompare(b.name);

    c.acteur = { nom: acteur.name, img: acteur.img, perso, peutAgir: acteur.isOwner };
    c.jauges = [
      { label: "Vie", valeur: `${s.vie.value}/${s.vie.max}`, classe: "cp-b-vie" },
      { label: "RAM", valeur: `${s.ram.value}/${s.ram.max}`, classe: "cp-b-ram" }
    ];
    if ( perso ) c.jauges.push({ label: "Hum.", valeur: `${s.humanite.value}/${s.humanite.max}`, classe: "" });

    // Armes (et armes intégrées aux implants)
    c.armes = items.filter(i => i.type === "arme").sort(tri).map(i => {
      const a = i.system;
      const grenade = a.type === "grenade";
      const infos = [];
      if ( a.attaque.defense !== "aucune" ) infos.push(signe(a.scoreTouche));
      if ( a.attaque.faitDegats ) infos.push(a.formuleLisible());
      if ( a.attaque.zone ) infos.push(`zone ${a.attaque.zone} m`);
      return {
        id: i.id, nom: grenade && (a.quantite > 1) ? `${i.name} ×${a.quantite}` : i.name, infos: infos.join(" · ") || (TYPES_ARME[a.type]?.label ?? ""),
        label: grenade ? "Lancer" : "Attaquer", bloque: grenade && (a.quantite <= 0), raison: "Épuisée"
      };
    });

    // Implants : armes intégrées et implants actifs
    c.implants = items.filter(i => (i.type === "implant") && (i.system.armeIntegree || i.system.estActif)).sort(tri).map(i => {
      const m = i.system;
      if ( m.armeIntegree ) return { id: i.id, nom: i.name, infos: [signe(m.scoreTouche), m.formuleLisible()].join(" · "), label: "Attaquer" };
      const restantes = m.utilisationsRestantes;
      const e = m.effet;
      return {
        id: i.id, nom: i.name, rouge: !!e.coutHumanite,
        infos: [ACTIVATIONS[e.activation], e.coutHumanite ? `+${e.coutHumanite}💀` : null, restantes === null ? null : `${restantes}/${m.utilisationsMax}`, m.actif.enCours ? `actif ${m.actif.tours} t.` : null].filter(Boolean).join(" · "),
        label: "Utiliser", bloque: restantes === 0, raison: "Épuisé"
      };
    });

    // Vision thermique (Optique Kiroshi) : interrupteur
    if ( aVisionThermique(acteur) ) {
      const on = !!acteur.flags?.cyberpunk2075?.visionThermique;
      c.implants.push({ id: "", thermique: true, nom: "Vision thermique", infos: on ? "Active" : "Inactive", label: on ? "Couper" : "Activer", rouge: on });
    }

    // Hacks
    const ram = s.ram.value;
    c.hacks = items.filter(i => i.type === "hack").sort((a, b) => (a.system.ram - b.system.ram) || a.name.localeCompare(b.name)).map(i => {
      const h = i.system;
      const cout = h.cout(h.variable.actif ? 1 : 0);
      return {
        id: i.id, nom: i.name, infos: [h.coutTexte, ACTIVATIONS[h.activation]].filter(Boolean).join(" · "),
        label: "Lancer", bloque: (cout > ram) && !s.overclocking, raison: "Manque RAM"
      };
    });
    c.ram = ram;

    // Talents actifs (personnages)
    c.talents = perso ? items.filter(i => (i.type === "talent") && i.system.estActif).sort(tri).map(i => {
      const t = i.system;
      const restantes = t.utilisationsRestantes;
      return {
        id: i.id, nom: i.name,
        infos: [ACTIVATIONS[t.effet.activation], restantes === null ? null : `${restantes}/${t.utilisationsMax}`, t.actif.enCours ? `actif ${t.actif.tours} t.` : null].filter(Boolean).join(" · "),
        label: "Utiliser", bloque: restantes === 0, raison: "Épuisé"
      };
    }) : [];

    c.colonnes = [
      { titre: "Armes", lignes: c.armes },
      { titre: "Implants", lignes: c.implants },
      { titre: `Hacks · RAM ${ram}`, lignes: c.hacks, bleu: true },
      { titre: "Talents", lignes: c.talents }
    ].filter(col => col.lignes.length);

    // Menu des jets : compétences maîtrisées (compétences clés pour un ennemi) puis caractéristiques
    c.competences = Object.entries(COMPETENCES)
      .filter(([cle]) => perso ? s.competences[cle]?.maitrise : s.competences[cle]?.cle)
      .map(([cle, def]) => ({ cle, label: def.label, valeur: signe(s.competences[cle].score) }));
    c.caracs = Object.entries(CARACS).map(([cle, def]) => ({ cle, label: def.labelLong ?? def.label, icone: def.icone, valeur: signe(s.caracs[cle]?.bonus ?? 0) }));
    return c;
  }

  async _onRender(contexte, options) {
    await super._onRender(contexte, options);
    this.element.querySelector("[data-choix-token]")?.addEventListener("change", ev => {
      this._tokenId = ev.target.value;
      const token = canvas.tokens.get(this._tokenId);
      if ( token && !token.controlled ) token.control({ releaseOthers: true });
      this.render();
    });
  }

  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */

  _item(cible) {
    return this.acteur?.items.get(cible.closest("[data-item-id]")?.dataset.itemId) ?? null;
  }

  static async #action(event, cible) {
    if ( cible.closest("[data-thermique]") ) return basculerThermique(this.acteur);
    const item = this._item(cible);
    if ( !item?.isOwner ) return;
    const rapide = event.shiftKey;
    if ( item.type === "hack" ) return item.lancer({ rapide });
    if ( item.peutAttaquer ) return item.attaquer({ rapide });
    if ( ["implant", "talent"].includes(item.type) ) return item.activer();
  }

  static async #infos(event, cible) {
    return this._item(cible)?.sheet.render(true);
  }

  static async #jet(event, cible) {
    const acteur = this.acteur;
    if ( !acteur?.isOwner ) return;
    const { competence, carac } = cible.dataset;
    this._jetsOuverts = false;
    this.render();
    if ( competence ) return acteur.lancerCompetence(competence, { rapide: event.shiftKey });
    if ( carac ) return acteur.lancerCaracteristique(carac, { rapide: event.shiftKey });
  }

  static async #basculerJets() {
    this._jetsOuverts = !this._jetsOuverts;
    if ( this._jetsOuverts ) this._desOuverts = false;
    return this.render();
  }

  static async #basculerDes() {
    this._desOuverts = !this._desOuverts;
    if ( this._desOuverts ) this._jetsOuverts = false;
    return this.render();
  }

  static async #changerNbDes(event, cible) {
    this._nbDes = Math.clamp(this._nbDes + Number(cible.dataset.delta), 1, 20);
    return this.render();
  }

  /** Jet libre : N dés du type choisi, envoyé dans le chat (Dice So Nice compris). */
  static async #lancerDes(event, cible) {
    const faces = Number(cible.dataset.faces);
    if ( !faces ) return;
    const acteur = this.acteur;
    const formule = `${this._nbDes}d${faces}`;
    const jet = await new Roll(formule).evaluate();
    const content = await foundry.applications.handlebars.renderTemplate(`${CHEMIN}/templates/chat/des.hbs`, {
      acteur: acteur?.name ?? game.user.name,
      heure: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
      formule, total: jet.total, resultats: jet.dice[0]?.results.map(r => r.result) ?? []
    });
    const donnees = {
      speaker: acteur ? ChatMessage.getSpeaker({ actor: acteur }) : ChatMessage.getSpeaker(),
      content, rolls: [jet], flags: { cyberpunk2075: { type: "jet" } }
    };
    ChatMessage.applyRollMode(donnees, game.settings.get("core", "rollMode"));
    return ChatMessage.create(donnees);
  }

  static async #ouvrirFiche() {
    return this.acteur?.sheet.render(true);
  }
}

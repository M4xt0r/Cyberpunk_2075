import { CHEMIN, COMPETENCES, NIVEAUX, VITESSES, CATEGORIES_VEHICULE, TYPES_PLANQUE, QUALITES_PLANQUE, ciblesModificateurs } from "../config.mjs";
import { signe } from "../dice/jets.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

const prix = n => `${(Number(n) || 0).toLocaleString("fr-FR")} €$`;
const niveauBadge = s => s.aNiveaux ? { label: NIVEAUX[s.niveauEffectif].label, couleur: NIVEAUX[s.niveauEffectif].couleur } : null;

/** Texte court des modificateurs d'un item (« +1 Vitesse · +2 Maniabilité »). */
export function texteModifs(item) {
  const cibles = ciblesModificateurs();
  return (item.system.modificateursActifs ?? []).map(m => `${signe(m.valeur)} ${(cibles[m.cible] ?? m.cible).replace(/^(Comp|Carac)\. · /, "").replace(/ \((crans|planque)\)| du véhicule/g, "")}`).join(" · ");
}

/** Ligne d'amélioration de véhicule : infos et boutons. */
export function ligneAmelioration(item, vehicule) {
  const s = item.system;
  const infos = [];
  if ( s.effet?.description ) infos.push(s.effet.description);
  else if ( texteModifs(item) ) infos.push(texteModifs(item));
  if ( s.armeIntegree ) infos.push(`Dégâts <b>${s.formuleLisible()}</b> · ${COMPETENCES[s.competence]?.label ?? ""}`);
  return {
    id: item.id,
    uuid: item.uuid,
    nom: item.name,
    niveau: niveauBadge(s),
    infos: infos.join(" · "),
    arme: s.armeIntegree,
    degatsSeuls: s.armeIntegree && (s.attaque.defense === "aucune"),
    probleme: s.incompatibilite?.(vehicule) ?? null
  };
}

/** Ligne de module de planque. */
export function ligneModule(item, planque) {
  const s = item.system;
  const horsSlot = planque.system.definition?.vieOffice && s.vieOffice;
  return {
    id: item.id,
    uuid: item.uuid,
    nom: item.name,
    niveau: niveauBadge(s),
    infos: s.effet?.description || texteModifs(item),
    horsSlot,
    probleme: s.incompatibilite?.(planque) ?? null
  };
}

/* ============================================ */

/** Base commune : mode édition pour le propriétaire, portrait, items. */
class FicheBien extends HandlebarsApplicationMixin(ActorSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["cp2075", "cp-fiche", "fiche-bien"],
    position: { width: 540, height: "auto" },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      basculerMode: FicheBien.#basculerMode,
      changerPortrait: FicheBien.#changerPortrait,
      ouvrirItem: FicheBien.#ouvrirItem,
      supprimerItem: FicheBien.#supprimerItem
    }
  };

  _mode = "jeu";

  get enEdition() {
    return this.isEditable && (this._mode === "edition");
  }

  async _prepareContext(options) {
    const c = await super._prepareContext(options);
    Object.assign(c, {
      acteur: this.actor,
      system: this.actor.system,
      edition: this.enEdition,
      peutModifier: this.isEditable,
      description: await foundry.applications.ux.TextEditor.implementation.enrichHTML(this.actor.system.description, { relativeTo: this.actor, secrets: this.actor.isOwner })
    });
    return c;
  }

  async _onRender(contexte, options) {
    await super._onRender(contexte, options);
    this.element.classList.toggle("cp-mode-edition", this.enEdition);
  }

  _itemDe(cible) {
    return this.actor.items.get(cible.closest("[data-item-id]")?.dataset.itemId) ?? null;
  }

  static async #basculerMode() {
    if ( !this.isEditable ) return;
    this._mode = (this._mode === "edition") ? "jeu" : "edition";
    return this.render();
  }

  static async #changerPortrait() {
    if ( !this.enEdition ) return;
    const Picker = CONFIG.ux?.FilePicker ?? foundry.applications.apps.FilePicker.implementation;
    return new Picker({ type: "image", current: this.actor.img, callback: chemin => this.actor.update({ img: chemin }) }).browse();
  }

  static async #ouvrirItem(event, cible) {
    return this._itemDe(cible)?.sheet.render(true);
  }

  static async #supprimerItem(event, cible) {
    if ( !this.isEditable ) return;
    return this._itemDe(cible)?.delete();
  }
}

/* ============================================ */
/*  Véhicule                                    */
/* ============================================ */

export class FicheVehicule extends FicheBien {

  static DEFAULT_OPTIONS = {
    classes: ["fiche-vehicule"],
    actions: {
      ajusterVie: FicheVehicule.#ajusterVie,
      piloter: FicheVehicule.#piloter,
      attaquer: FicheVehicule.#attaquer,
      degats: FicheVehicule.#degats,
      retirerPilote: FicheVehicule.#retirerPilote
    }
  };

  static PARTS = {
    corps: { template: `${CHEMIN}/templates/actor/vehicule/fiche.hbs` }
  };

  async _prepareContext(options) {
    const c = await super._prepareContext(options);
    const v = this.actor;
    const s = v.system;
    const pilote = s.piloteActeur;
    const base = VITESSES.indexOf(s.vitesse);
    Object.assign(c, {
      categorie: CATEGORIES_VEHICULE[s.categorie]?.label ?? s.categorie,
      choixCategories: Object.fromEntries(Object.entries(CATEGORIES_VEHICULE).map(([k, d]) => [k, d.label])),
      choixVitesses: Object.fromEntries(VITESSES.map((l, i) => [l, `${l} (+${i})`])),
      vitesses: VITESSES.map((l, i) => ({ l, actif: i === s.vitesseIndex, base: i === base })),
      vitesseModifiee: s.vitesseIndex !== base,
      maniabilite: signe(s.maniabiliteEffective),
      vie: { value: s.vie.value, max: s.vie.max, pct: s.vie.max ? Math.clamp(Math.round(s.vie.value / s.vie.max * 100), 0, 100) : 0 },
      prixTexte: prix(s.prix),
      pilote: pilote ? { nom: pilote.name, img: pilote.img, pilotage: signe(pilote.system.competences?.pilotage?.score ?? 0) } : null,
      choixPilotes: { "": "— aucun —", ...Object.fromEntries(game.actors.filter(a => ["personnage", "ennemi"].includes(a.type) && a.testUserPermission(game.user, "LIMITED")).map(a => [a.uuid, a.name])) },
      totalPilotage: pilote ? signe((pilote.system.competences?.pilotage?.score ?? 0) + s.maniabiliteEffective + s.bonusVitesse) : null,
      ameliorations: v.items.filter(i => i.type === "ameliorationVehicule").sort((a, b) => a.name.localeCompare(b.name)).map(i => ligneAmelioration(i, v))
    });
    return c;
  }

  /** Améliorations : avertissement de slot et de restriction ; un personnage déposé devient pilote. @override */
  async _onDropItem(event, item) {
    if ( !this.actor.isOwner ) return null;
    if ( item.type !== "ameliorationVehicule" ) return ui.notifications.warn("Un véhicule ne reçoit que des améliorations de véhicule.");
    if ( item.parent === this.actor ) return null;
    const probleme = item.system.incompatibilite(this.actor);
    if ( probleme ) ui.notifications.warn(`${item.name} : ${probleme}. Posée quand même.`);
    else if ( this.actor.system.slotsUtilises >= this.actor.system.slots ) ui.notifications.warn(`${this.actor.name} : plus de slot d'amélioration (${this.actor.system.slots}). Posée quand même.`);
    return super._onDropItem(event, item);
  }

  /** @override */
  async _onDropActor(event, acteur) {
    if ( !this.actor.isOwner || !["personnage", "ennemi"].includes(acteur.type) ) return null;
    return this.actor.update({ "system.pilote": acteur.uuid });
  }

  static async #ajusterVie(event, cible) {
    if ( !this.isEditable ) return;
    const s = this.actor.system;
    const delta = Number(cible.dataset.delta) * (event.shiftKey ? 10 : 1);
    if ( delta < 0 ) return this.actor.subirDegats(-delta);
    return this.actor.update({ "system.vie.value": Math.clamp(s.vie.value + delta, 0, s.vie.max) });
  }

  static async #piloter(event) {
    return this.actor.piloter({ rapide: event.shiftKey });
  }

  static async #attaquer(event, cible) {
    return this._itemDe(cible)?.attaquer({ rapide: event.shiftKey });
  }

  static async #degats(event, cible) {
    return this._itemDe(cible)?.lancerDegats();
  }

  static async #retirerPilote() {
    if ( !this.isEditable ) return;
    return this.actor.update({ "system.pilote": "" });
  }
}

/* ============================================ */
/*  Planque                                     */
/* ============================================ */

export class FichePlanque extends FicheBien {

  static DEFAULT_OPTIONS = {
    classes: ["fiche-planque"]
  };

  static PARTS = {
    corps: { template: `${CHEMIN}/templates/actor/planque/fiche.hbs` }
  };

  async _prepareContext(options) {
    const c = await super._prepareContext(options);
    const p = this.actor;
    const s = p.system;
    const def = s.definition;
    const nv = def.niveaux[s.niveau] ?? def.niveaux[1];
    const proprietaires = game.users.filter(u => !u.isGM && p.testUserPermission(u, "OWNER"));
    const cibles = ciblesModificateurs();
    Object.assign(c, {
      typeLabel: def.label,
      qualiteLabel: QUALITES_PLANQUE[s.qualite]?.label,
      choixTypes: Object.fromEntries(Object.entries(TYPES_PLANQUE).map(([k, d]) => [k, d.label])),
      choixNiveaux: { 1: "Niv. 1", 2: "Niv. 2" },
      choixQualites: Object.fromEntries(Object.entries(QUALITES_PLANQUE).map(([k, q]) => [k, `${q.label} (+${q.prix.toLocaleString("fr-FR")} €$)`])),
      niveau: { label: NIVEAUX[s.niveau].label, couleur: NIVEAUX[s.niveau].couleur },
      prixTexte: prix(s.prixTotal),
      revenuTexte: s.revenu ? `${s.revenu} €$ + qualité par session${s.barman ? "" : " (avec un barman)"}` : null,
      modulesCalcul: nv.modules,
      parkingCalcul: nv.parking,
      modules: p.items.filter(i => i.type === "modulePlanque").sort((a, b) => a.name.localeCompare(b.name)).map(i => ligneModule(i, p)),
      bonus: s.bonusOccupants.map(m => `${signe(m.valeur)} ${(cibles[m.cible] ?? m.cible).replace(/^(Comp|Carac)\. · /, "")} (${m.source})`),
      proprietaires: proprietaires.map(u => u.name)
    });
    return c;
  }

  /** @override */
  async _onDropItem(event, item) {
    if ( !this.actor.isOwner ) return null;
    if ( item.type !== "modulePlanque" ) return ui.notifications.warn("Une planque ne reçoit que des modules de planque.");
    if ( item.parent === this.actor ) return null;
    const probleme = item.system.incompatibilite(this.actor);
    const s = this.actor.system;
    const horsSlot = s.definition.vieOffice && item.system.vieOffice;
    if ( probleme ) ui.notifications.warn(`${item.name} : ${probleme}. Posé quand même.`);
    else if ( !horsSlot && (s.modules.utilises >= s.modules.max) ) ui.notifications.warn(`${this.actor.name} : plus d'emplacement de module (${s.modules.max}). Posé quand même.`);
    return super._onDropItem(event, item);
  }

  /** Pas de personnage dans une planque. @override */
  async _onDropActor() {
    return null;
  }
}

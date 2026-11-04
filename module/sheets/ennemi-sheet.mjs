import { CHEMIN, CARACS, COMPETENCES, COUVERTS, NIVEAUX, TYPES_ARME, EMPLACEMENTS } from "../config.mjs";
import { RANGS, buildDe, dansBuild } from "../data/ennemi.mjs";
import { signe } from "../dice/jets.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

const ORDRE = { arme: 1, implant: 2, hack: 3, objet: 4, talent: 5 };
const TYPES = { arme: "Arme", implant: "Implant", hack: "Hack", objet: "Objet", talent: "Talent", ameliorationImplant: "Amélioration", capsule: "Capsule" };

/**
 * Fiche Ennemi : une page compacte de 560 px, sur le modèle des stat blocks Notion.
 * Lecture : jets en un clic, armes et implants du build actif. Édition (MJ) : bonus, stats forcées,
 * compétences clés et build de chaque item.
 */
export default class FicheEnnemi extends HandlebarsApplicationMixin(ActorSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["cp2075", "cp-fiche", "fiche-ennemi"],
    position: { width: 560, height: "auto" },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      basculerMode: FicheEnnemi.#basculerMode,
      changerPortrait: FicheEnnemi.#changerPortrait,
      choisirBuild: FicheEnnemi.#choisirBuild,
      jetCarac: FicheEnnemi.#jetCarac,
      jetCompetence: FicheEnnemi.#jetCompetence,
      jetAutre: FicheEnnemi.#jetAutre,
      jetInitiative: FicheEnnemi.#jetInitiative,
      ajusterVie: FicheEnnemi.#ajusterVie,
      ajouterCle: FicheEnnemi.#ajouterCle,
      supprimerCle: FicheEnnemi.#supprimerCle,
      ouvrirItem: FicheEnnemi.#ouvrirItem,
      supprimerItem: FicheEnnemi.#supprimerItem,
      attaquer: FicheEnnemi.#attaquer,
      degats: FicheEnnemi.#degats,
      activer: FicheEnnemi.#activer,
      lancerHack: FicheEnnemi.#lancerHack,
      utiliser: FicheEnnemi.#utiliser,
      relever: FicheEnnemi.#relever
    }
  };

  static PARTS = {
    corps: { template: `${CHEMIN}/templates/actor/ennemi/fiche.hbs` }
  };

  _mode = "jeu";

  get enEdition() {
    return this.isEditable && game.user.isGM && (this._mode === "edition");
  }

  /** @override */
  async _prepareContext(options) {
    const contexte = await super._prepareContext(options);
    const acteur = this.actor;
    const s = acteur.system;
    const source = acteur._source.system;
    const edition = this.enEdition;
    const rang = RANGS[s.rangNiveau] ?? RANGS[1];

    const caracs = Object.entries(CARACS).map(([cle, def]) => ({
      cle, ...def,
      bonus: signe(s.caracs[cle].bonus),
      saisi: source.caracs[cle].bonus,
      negatif: s.caracs[cle].bonus < 0,
      modifie: s.caracs[cle].bonus !== source.caracs[cle].bonus
    }));

    const stat = (cle, label, icone, o, calcul) => ({
      cle, label, icone,
      valeur: o.valeur ?? o.max,
      base: o.base,
      calcule: o.calcule,
      force: o.forcer !== null && o.forcer !== undefined,
      champ: `system.${cle}.forcer`,
      forcer: o.forcer ?? "",
      plus: (o.valeur ?? o.max) - o.base
    });

    const competencesCles = s.competencesCles.map((l, i) => {
      const comp = s.competences[l.competence];
      return { i, competence: l.competence, valeur: l.valeur, label: COMPETENCES[l.competence]?.label ?? l.competence, score: signe(comp?.score ?? l.valeur), avecObjets: !!comp?.bonusObjets };
    });
    // Compétences qui ne sont pas clés mais que les implants modifient : affichées aussi
    for ( const [cle, comp] of Object.entries(s.competences) ) {
      if ( comp.cle || !comp.bonusObjets ) continue;
      competencesCles.push({ competence: cle, label: COMPETENCES[cle].label, score: signe(comp.score), avecObjets: true, implicite: true });
    }

    const items = acteur.items.contents
      .filter(i => ORDRE[i.type] || edition)
      .filter(i => edition || dansBuild(i, s.build))
      .sort((a, b) => ((ORDRE[a.type] ?? 9) - (ORDRE[b.type] ?? 9)) || a.name.localeCompare(b.name))
      .map(item => this.#ligneItem(item, s));

    Object.assign(contexte, {
      acteur,
      system: s,
      source,
      edition,
      peutModifier: this.isEditable,
      mj: game.user.isGM,
      rang: { ...rang, nom: s.rang || rang.label },
      nature: s.nature === "robot" ? "Robot" : "Organique",
      caracs,
      vie: { value: s.vie.value, max: s.vie.max, pct: s.vie.max ? Math.clamp(Math.round(s.vie.value / s.vie.max * 100), 0, 100) : 0, mort: s.vie.value <= 0 },
      ram: { value: s.ram.value, max: s.ram.max },
      stats: [
        stat("vie", "Vie max", "vie", s.vie),
        stat("adaptabilite", "Adaptab.", "adaptabilite", s.adaptabilite),
        stat("glace", "Glace", "glace", s.glace),
        stat("ram", "RAM max", "ram", s.ram)
      ],
      attention: s.attention.valeur,
      initiative: signe(s.initiative.valeur),
      couvert: COUVERTS[s.couvert],
      couverts: Object.fromEntries(COUVERTS.map((c, i) => [i, `${c.label}${c.adaptabilite ? ` (+${c.adaptabilite})` : ""}`])),
      competencesCles,
      toutesCompetences: Object.fromEntries(Object.entries(COMPETENCES).map(([k, v]) => [k, v.label])),
      choixRangs: Object.fromEntries(Object.entries(RANGS).map(([k, v]) => [k, `${NIVEAUX[k].label} · ${v.label}`])),
      choixNatures: { organique: "Organique", robot: "Robot" },
      choixYeux: { auto: `Auto (${s.yeuxCyberEffectif ? "oui" : "non"})`, oui: "Oui", non: "Non" },
      choixBuilds: { "": "Commun", A: "Build A", B: "Build B" },
      items,
      aItems: items.length > 0,
      buildA: s.build === "A",
      aBuilds: acteur.items.some(i => buildDe(i)),
      nbA: acteur.items.filter(i => buildDe(i) === "A").length,
      nbB: acteur.items.filter(i => buildDe(i) === "B").length,
      notes: await foundry.applications.ux.TextEditor.implementation.enrichHTML(s.notes, { relativeTo: acteur, secrets: acteur.isOwner })
    });
    return contexte;
  }

  /** Une ligne d'item, avec sa valeur clé et ses boutons. */
  #ligneItem(item, s) {
    const sys = item.system;
    const ligne = { id: item.id, nom: item.name, img: item.img, type: TYPES[item.type] ?? item.type, build: buildDe(item), infos: [], boutons: [] };
    if ( sys.aNiveaux ) ligne.niveau = { label: NIVEAUX[sys.niveauEffectif].label, couleur: NIVEAUX[sys.niveauEffectif].couleur };
    if ( item.peutAttaquer ) {
      if ( sys.attaque.defense !== "aucune" ) ligne.infos.push(`Touche <b>${signe(sys.scoreTouche)}</b>`);
      ligne.infos.push(`Dégâts <b>${sys.formuleLisible()}</b>`);
      if ( sys.portee ) ligne.infos.push(`${sys.portee} m`);
      const grenade = (item.type === "arme") && (sys.type === "grenade");
      ligne.boutons.push({ action: "attaquer", label: grenade ? "Lancer" : "Attaquer", principal: true });
      if ( !grenade && (sys.attaque.defense !== "aucune") ) ligne.boutons.push({ action: "degats", label: "Dégâts" });
      if ( item.type === "arme" ) ligne.sousType = TYPES_ARME[sys.type]?.label;
    }
    if ( item.type === "implant" ) {
      ligne.sousType = EMPLACEMENTS[sys.emplacement]?.label;
      if ( sys.effet?.description ) ligne.infos.push(sys.effet.description);
      if ( sys.estActif ) ligne.boutons.push({ action: "activer", label: "Activer", principal: !item.peutAttaquer });
    }
    if ( item.type === "talent" ) {
      if ( sys.effet?.description ) ligne.infos.push(sys.effet.description);
      if ( sys.estActif ) ligne.boutons.push({ action: "activer", label: "Utiliser", principal: true });
    }
    if ( item.type === "hack" ) {
      ligne.infos.push(`<b class="cp-t-glace">${sys.coutTexte}</b>`);
      if ( sys.resume ) ligne.infos.push(sys.resume);
      const manque = sys.cout(sys.variable.actif ? 1 : 0) > s.ram.value;
      ligne.boutons.push({ action: "lancerHack", label: manque ? "RAM insuffisante" : "Lancer", principal: true, desactive: manque });
    }
    if ( item.type === "objet" ) {
      if ( sys.effet?.description ) ligne.infos.push(sys.effet.description);
      if ( sys.utilisable ) ligne.boutons.push({ action: "utiliser", label: "Utiliser", principal: true, desactive: !!sys.blocage });
    }
    ligne.infos = ligne.infos.join(" · ");
    return ligne;
  }

  /** @override */
  async _onRender(contexte, options) {
    await super._onRender(contexte, options);
    this.element.classList.toggle("cp-mode-edition", this.enEdition);
    // Build d'un item (flag) et compétences clés : champs sans nom, enregistrés à part
    for ( const sel of this.element.querySelectorAll("[data-build-item]") ) {
      sel.addEventListener("change", () => this.actor.items.get(sel.dataset.buildItem)?.setFlag("cyberpunk2075", "build", sel.value));
    }
    for ( const el of this.element.querySelectorAll("[data-cle-champ]") ) {
      el.addEventListener("change", () => this.#enregistrerCles());
    }
  }

  #enregistrerCles() {
    const lignes = [...this.element.querySelectorAll("[data-cle-ligne]")].map(l => ({
      competence: l.querySelector("[data-cle-champ=competence]").value,
      valeur: Number.parseInt(String(l.querySelector("[data-cle-champ=valeur]").value).replace("−", "-")) || 0
    }));
    return this.actor.update({ "system.competencesCles": lignes });
  }

  /** Un champ « forcer » vide revient au calcul. @override */
  _prepareSubmitData(event, form, formData, updateData) {
    const donnees = super._prepareSubmitData(event, form, formData, updateData);
    for ( const cle of ["vie", "ram", "adaptabilite", "glace"] ) {
      const chemin = `system.${cle}.forcer`;
      if ( foundry.utils.hasProperty(donnees, chemin) && (foundry.utils.getProperty(donnees, chemin) === "") ) foundry.utils.setProperty(donnees, chemin, null);
    }
    return donnees;
  }

  /** Les items déposés en édition prennent le build affiché quand le MJ le précise ensuite. @override */
  async _onDropItem(event, item) {
    if ( !this.actor.isOwner ) return null;
    if ( ["classe", "sousClasse"].includes(item.type) ) return ui.notifications.warn("Un ennemi n'a ni classe ni sous-classe.");
    return super._onDropItem(event, item);
  }

  /* -------------------------------------------- */

  #itemDe(cible) {
    return this.actor.items.get(cible.closest("[data-item-id]")?.dataset.itemId) ?? null;
  }

  static async #basculerMode() {
    if ( !this.isEditable || !game.user.isGM ) return;
    this._mode = (this._mode === "edition") ? "jeu" : "edition";
    return this.render();
  }

  static async #changerPortrait() {
    if ( !this.enEdition ) return;
    const Picker = CONFIG.ux?.FilePicker ?? foundry.applications.apps.FilePicker.implementation;
    return new Picker({ type: "image", current: this.actor.img, callback: chemin => this.actor.update({ img: chemin }) }).browse();
  }

  static async #choisirBuild(event, cible) {
    if ( !this.isEditable ) return;
    return this.actor.update({ "system.build": cible.dataset.build });
  }

  static async #jetCarac(event, cible) {
    if ( this.enEdition ) return;
    return this.actor.lancerCaracteristique(cible.dataset.carac, { rapide: event.shiftKey });
  }

  static async #jetCompetence(event, cible) {
    return this.actor.lancerCompetence(cible.dataset.competence, { rapide: event.shiftKey });
  }

  static async #jetAutre(event, cible) {
    const cle = this.element.querySelector("[data-autre-competence]")?.value;
    if ( cle ) return this.actor.lancerCompetence(cle, { rapide: event.shiftKey });
  }

  static async #jetInitiative() {
    return this.actor.lancerInitiativeCP();
  }

  static async #ajusterVie(event, cible) {
    if ( !this.isEditable ) return;
    const delta = Number(cible.dataset.delta) * (event.shiftKey ? 5 : 1);
    const v = Math.clamp(this.actor.system.vie.value + delta, 0, this.actor.system.vie.max);
    return this.actor.update({ "system.vie.value": v });
  }

  /** Remettre l'ennemi debout (PV max, statut « mort » retiré). */
  static async #relever() {
    if ( !this.isEditable ) return;
    await this.actor.update({ "system.vie.value": this.actor.system.vie.max, "system.ram.value": this.actor.system.ram.max });
    return this.actor.toggleStatusEffect("dead", { active: false }).catch(() => null);
  }

  static async #ajouterCle() {
    if ( !this.enEdition ) return;
    const lignes = foundry.utils.deepClone(this.actor._source.system.competencesCles);
    lignes.push({ competence: "perception", valeur: 0 });
    return this.actor.update({ "system.competencesCles": lignes });
  }

  static async #supprimerCle(event, cible) {
    if ( !this.enEdition ) return;
    const lignes = foundry.utils.deepClone(this.actor._source.system.competencesCles);
    lignes.splice(Number(cible.dataset.index), 1);
    return this.actor.update({ "system.competencesCles": lignes });
  }

  static async #ouvrirItem(event, cible) {
    return this.#itemDe(cible)?.sheet.render(true);
  }

  static async #supprimerItem(event, cible) {
    if ( !this.enEdition ) return;
    return this.#itemDe(cible)?.delete();
  }

  static async #attaquer(event, cible) {
    return this.#itemDe(cible)?.attaquer({ rapide: event.shiftKey });
  }

  static async #degats(event, cible) {
    return this.#itemDe(cible)?.lancerDegats();
  }

  static async #activer(event, cible) {
    return this.#itemDe(cible)?.activer();
  }

  static async #lancerHack(event, cible) {
    return this.#itemDe(cible)?.lancer({ rapide: event.shiftKey });
  }

  static async #utiliser(event, cible) {
    return this.#itemDe(cible)?.utiliser();
  }
}

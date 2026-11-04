import { CHEMIN, CARACS, COMPETENCES, ETATS, NATURES, STRESS, COUVERTS, NIVEAUX, TYPES_ARME, TYPES_DEGATS, CATEGORIES_OBJET, QUALITES, ciblesModificateurs } from "../config.mjs";
import { signe } from "../dice/jets.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ActorSheetV2 } = foundry.applications.sheets;

/**
 * Fiche Personnage : 4 pages, mode joueur et mode édition.
 * Pages 1 et 4 complètes ; armes (page 2) et objets (page 3) depuis l'étape 2.
 */
export default class FichePersonnage extends HandlebarsApplicationMixin(ActorSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["cp2075", "cp-fiche", "fiche-personnage"],
    position: { width: 920, height: 960 },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      basculerMode: FichePersonnage.#basculerMode,
      changerPortrait: FichePersonnage.#changerPortrait,
      jetCompetence: FichePersonnage.#jetCompetence,
      jetCarac: FichePersonnage.#jetCarac,
      jetInitiative: FichePersonnage.#jetInitiative,
      ajuster: FichePersonnage.#ajuster,
      basculerMaitrise: FichePersonnage.#basculerMaitrise,
      forcer: FichePersonnage.#forcer,
      reinitialiser: FichePersonnage.#reinitialiser,
      fixerStress: FichePersonnage.#fixerStress,
      fixerMort: FichePersonnage.#fixerMort,
      ouvrirItem: FichePersonnage.#ouvrirItem,
      supprimerItem: FichePersonnage.#supprimerItem,
      attaquer: FichePersonnage.#attaquer,
      degats: FichePersonnage.#degats,
      utiliser: FichePersonnage.#utiliser,
      ajusterItem: FichePersonnage.#ajusterItem,
      basculerPorte: FichePersonnage.#basculerPorte,
      arreterEffet: FichePersonnage.#arreterEffet
    }
  };

  static PARTS = {
    entete: { template: `${CHEMIN}/templates/actor/personnage/entete.hbs` },
    identite: { template: `${CHEMIN}/templates/actor/personnage/identite.hbs`, scrollable: [""] },
    combat: { template: `${CHEMIN}/templates/actor/personnage/combat.hbs`, scrollable: [""] },
    inventaire: { template: `${CHEMIN}/templates/actor/personnage/inventaire.hbs`, scrollable: [""] },
    bio: { template: `${CHEMIN}/templates/actor/personnage/bio.hbs`, scrollable: [""] }
  };

  static TABS = {
    primary: {
      tabs: [
        { id: "identite", label: "Identité & stats" },
        { id: "combat", label: "Combat & chrome" },
        { id: "inventaire", label: "Inventaire & biens" },
        { id: "bio", label: "Bio & notes" }
      ],
      initial: "identite"
    }
  };

  /** Mode d'affichage : « jeu » (par défaut) ou « edition ». */
  _mode = "jeu";

  /** Mode édition actif et autorisé (MJ ou joueur propriétaire). */
  get enEdition() {
    return this.isEditable && (this._mode === "edition");
  }

  /* -------------------------------------------- */
  /*  Contexte                                    */
  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const contexte = await super._prepareContext(options);
    const acteur = this.actor;
    const s = acteur.system;
    const edition = this.enEdition;

    const caracs = Object.entries(CARACS).map(([cle, def]) => {
      const c = s.caracs[cle];
      return {
        cle, ...def,
        valeur: c.valeur,
        total: c.total,
        bonus: signe(c.bonus),
        negatif: c.bonus < 0,
        bonusClasse: c.bonusClasse,
        champ: `system.caracs.${cle}.valeur`,
        competences: Object.entries(COMPETENCES).filter(([, d]) => d.carac === cle).map(([cleComp, d]) => {
          const comp = s.competences[cleComp];
          return {
            cle: cleComp,
            label: d.label,
            maitrise: comp.maitrise,
            score: signe(comp.score),
            avecObjets: comp.sources.length > 0,
            detailObjets: comp.sources.join(" · ")
          };
        })
      };
    });

    const pourcent = (v, max) => max > 0 ? Math.clamp(Math.round((v / max) * 100), 0, 100) : 0;
    const classe = acteur.items.find(i => i.type === "classe");
    const sousClasse = acteur.items.find(i => i.type === "sousClasse");

    Object.assign(contexte, {
      acteur,
      system: s,
      edition,
      peutModifier: this.isEditable,
      caracs,
      classe,
      sousClasse,
      bm: signe(s.maitrise.valeur),
      bmForce: s.maitrise.forcer !== null,
      nature: NATURES[s.nature],
      natures: NATURES,
      etat: ETATS[s.etat] ?? ETATS.stable,
      etats: Object.fromEntries(Object.entries(ETATS).map(([k, v]) => [k, v.label])),
      enAlerte: s.etat !== "stable",
      stressCases: [1, 2, 3, 4].map(n => ({ n, plein: n <= s.stress })),
      stressEffets: Object.entries(STRESS).filter(([n]) => Number(n) <= s.stress).map(([, t]) => t),
      mortSucces: [1, 2, 3].map(n => ({ n, plein: n <= s.mort.succes })),
      mortEchecs: [1, 2, 3].map(n => ({ n, plein: n <= s.mort.echecs })),
      couvert: COUVERTS[s.couvert],
      vie: { ...this.#jauge(s.vie), pct: pourcent(s.vie.value, s.vie.max) },
      ram: { ...this.#jauge(s.ram), pct: pourcent(s.ram.value, s.ram.max) },
      humanite: {
        ...this.#jauge(s.humanite),
        min: s.humanite.min,
        pctMin: pourcent(s.humanite.min, s.humanite.max),
        pctActuelle: pourcent(s.humanite.value, s.humanite.max),
        pctEcart: Math.max(0, pourcent(s.humanite.value, s.humanite.max) - pourcent(s.humanite.min, s.humanite.max))
      },
      derivees: [
        this.#derivee("glace", "Glace", "glace", s.glace),
        this.#derivee("adaptabilite", "Adaptab.", "adaptabilite", s.adaptabilite, `Couvert : ${COUVERTS[s.couvert].label}`),
        this.#derivee("attention", "Attention", "attention", s.attention)
      ],
      initiative: { valeur: signe(s.initiative.valeur), force: s.initiative.forcer !== null, calcule: signe(s.initiative.calcule) },
      deplacement: { valeur: s.deplacement.valeur, force: s.deplacement.forcer !== null, calcule: s.deplacement.calcule },
      points: s.points,
      pointsDepasses: s.points.depenses > s.points.max,
      maitrises: s.maitrises,
      maitrisesDepassees: s.maitrises.utilisees > s.maitrises.max
    });

    Object.assign(contexte, this.#preparerItems());
    contexte.tabs = this._prepareTabs("primary");
    return contexte;
  }

  /** Armes (page 2) et objets (page 3). */
  #preparerItems() {
    const acteur = this.actor;
    const tri = (a, b) => (a.sort - b.sort) || a.name.localeCompare(b.name);
    const niveauBadge = s => s.aNiveaux ? { label: NIVEAUX[s.niveauEffectif].label, couleur: NIVEAUX[s.niveauEffectif].couleur } : null;
    const choixNiveaux = { 1: "Niv. 1", 2: "Niv. 2", 3: "Niv. 3" };

    const armes = acteur.items.filter(i => i.type === "arme").sort(tri).map(item => {
      const s = item.system;
      const grenade = s.type === "grenade";
      const infos = [];
      if ( s.attaque.defense !== "aucune" ) infos.push(`Touche <b>${signe(s.scoreTouche)}</b>`);
      infos.push(`Dégâts <b>${s.formuleLisible()}</b>`);
      if ( s.portee ) infos.push(`${s.portee} m`);
      if ( s.attaque.zone ) infos.push(`zone ${s.attaque.zone} m`);
      return {
        id: item.id,
        nom: item.name,
        img: item.img,
        niveau: niveauBadge(s),
        aNiveaux: s.aNiveaux,
        niveauPossede: s.niveauEffectif,
        type: TYPES_ARME[s.type]?.label ?? s.type,
        competence: COMPETENCES[s.competence]?.label ?? "",
        infos: infos.join(" · "),
        typeDegats: TYPES_DEGATS[s.n?.typeDegats] ?? "",
        grenade,
        quantite: s.quantite,
        epuise: s.quantite <= 0,
        labelAttaque: grenade ? "Lancer" : "Attaquer",
        boutonDegats: !grenade && (s.attaque.defense !== "aucune")
      };
    });

    const cibles = ciblesModificateurs();
    const objets = acteur.items.filter(i => i.type === "objet").sort(tri).map(item => {
      const s = item.system;
      const e = s.effet;
      const resume = [];
      if ( s.qualite !== "aucune" ) resume.push(`Repas « ${QUALITES[s.qualite].label} »`);
      else resume.push(CATEGORIES_OBJET[s.categorie]);
      if ( e?.jet.formule ) resume.push(`${e.jet.type === "soin" ? "soigne" : "dégâts"} ${e.jet.formule}`);
      if ( e?.modificateurs.length ) resume.push(e.modificateurs.map(m => `${signe(m.valeur)} ${cibles[m.cible]?.replace(/^(Comp|Carac)\. · /, "") ?? m.cible}`).join(", "));
      if ( s.coutHumaniteTotal ) resume.push(`${s.coutHumaniteTotal > 0 ? "+" : "−"}${Math.abs(s.coutHumaniteTotal)} Humanité`);
      if ( s.chargesMax > 0 ) resume.push(`<span class="cp-num">${s.chargesRestantes}/${s.chargesMax}</span> ${s.uneChargeParUtilisation ? "utilisations" : "charges"}`);
      const restantes = s.utilisationsRestantes;
      return {
        id: item.id,
        nom: item.name,
        img: item.img,
        niveau: niveauBadge(s),
        aNiveaux: s.aNiveaux,
        niveauPossede: s.niveauEffectif,
        resume: resume.join(" · "),
        quantite: s.quantite,
        sePorte: s.sePorte,
        porte: s.porte,
        utilisable: s.utilisable,
        bloque: !!s.blocage,
        blocage: s.blocage,
        labelUtiliser: s.qualite !== "aucune" ? "Manger" : "Utiliser",
        enCours: s.actif.enCours,
        tours: s.actif.tours,
        usages: (restantes === null) ? null : `${restantes}/${s.utilisationsMax}`
      };
    });

    return { armes, objets, choixNiveaux, aArmes: armes.length > 0, aObjets: objets.length > 0 };
  }

  /** Données d'affichage d'une jauge value / max avec max forçable. */
  #jauge(j) {
    return { value: j.value, max: j.max, calcule: j.calcule, force: j.forcer !== null };
  }

  /** Données d'affichage d'une stat dérivée forçable. */
  #derivee(cle, label, icone, stat, aide = "") {
    return { cle, label, icone, valeur: stat.valeur, calcule: stat.calcule, force: stat.forcer !== null, champ: `system.${cle}.forcer`, aide };
  }

  /** @override */
  async _preparePartContext(partId, contexte, options) {
    contexte = await super._preparePartContext(partId, contexte, options);
    if ( contexte.tabs?.[partId] ) contexte.tab = contexte.tabs[partId];
    return contexte;
  }

  /* -------------------------------------------- */
  /*  Rendu                                       */
  /* -------------------------------------------- */

  /** @override */
  async _onRender(contexte, options) {
    await super._onRender(contexte, options);
    this.element.classList.toggle("cp-mode-edition", this.enEdition);
    this.element.classList.toggle("cp-lecture-seule", !this.isEditable);

    // Champs d'items (niveau possédé, quantité) : mis à jour sur l'item, pas sur la fiche
    for ( const champ of this.element.querySelectorAll("[data-item-champ]") ) {
      champ.addEventListener("change", event => {
        event.stopPropagation();
        const item = this.actor.items.get(champ.closest("[data-item-id]")?.dataset.itemId);
        const valeur = Number.parseInt(event.currentTarget.value);
        if ( item && Number.isFinite(valeur) ) item.update({ [champ.dataset.itemChamp]: valeur });
      });
    }

    // Champs « miroir » de l'en-tête : ils recopient leur valeur dans le vrai champ avant l'envoi du formulaire.
    for ( const miroir of this.element.querySelectorAll("[data-miroir]") ) {
      miroir.addEventListener("change", event => {
        const valeur = Number.parseInt(event.currentTarget.value);
        if ( !Number.isFinite(valeur) ) return;
        for ( const cible of this.element.querySelectorAll(`[name="${miroir.dataset.miroir}"]`) ) cible.value = valeur;
        this.actor.update({ [miroir.dataset.miroir]: valeur });
      });
    }
  }

  /* -------------------------------------------- */
  /*  Glisser-déposer                             */
  /* -------------------------------------------- */

  /** Une seule classe et une seule sous-classe : la nouvelle remplace l'ancienne. @override */
  async _onDropItem(event, item) {
    if ( !this.actor.isOwner ) return null;
    if ( ["classe", "sousClasse"].includes(item.type) && (item.parent !== this.actor) ) {
      const anciens = this.actor.items.filter(i => i.type === item.type).map(i => i.id);
      if ( anciens.length ) await this.actor.deleteEmbeddedDocuments("Item", anciens);
    }
    return super._onDropItem(event, item);
  }

  /* -------------------------------------------- */
  /*  Actions                                     */
  /* -------------------------------------------- */

  static async #basculerMode() {
    if ( !this.isEditable ) return;
    this._mode = (this._mode === "edition") ? "jeu" : "edition";
    return this.render();
  }

  static async #changerPortrait() {
    if ( !this.enEdition ) return;
    const Picker = CONFIG.ux?.FilePicker ?? foundry.applications.apps.FilePicker.implementation;
    const picker = new Picker({
      type: "image",
      current: this.actor.img,
      callback: chemin => this.actor.update({ img: chemin })
    });
    return picker.browse();
  }

  static async #jetCompetence(event, cible) {
    return this.actor.lancerCompetence(cible.dataset.competence, { rapide: event.shiftKey });
  }

  static async #jetCarac(event, cible) {
    if ( this.enEdition ) return;
    return this.actor.lancerCaracteristique(cible.dataset.carac, { rapide: event.shiftKey });
  }

  static async #jetInitiative() {
    return this.actor.lancerInitiativeCP();
  }

  /** Compteurs − / + : data-champ, data-delta, data-min, data-max. */
  static async #ajuster(event, cible) {
    if ( !this.isEditable ) return;
    const { champ, delta, min, max } = cible.dataset;
    const actuel = Number(foundry.utils.getProperty(this.actor, champ)) || 0;
    let nouveau = actuel + Number(delta);
    if ( min !== undefined ) nouveau = Math.max(Number(min), nouveau);
    if ( max !== undefined ) nouveau = Math.min(Number(max), nouveau);
    if ( nouveau === actuel ) return;
    return this.actor.update({ [champ]: nouveau });
  }

  static async #basculerMaitrise(event, cible) {
    if ( !this.enEdition ) return;
    const cle = cible.dataset.competence;
    const actuel = this.actor.system.competences[cle].maitrise;
    return this.actor.update({ [`system.competences.${cle}.maitrise`]: !actuel });
  }

  /** « ✎ forcer » : copie la valeur calculée dans le champ forcé, qui devient modifiable. */
  static async #forcer(event, cible) {
    if ( !this.enEdition ) return;
    return this.actor.update({ [cible.dataset.champ]: Number(cible.dataset.valeur) || 0 });
  }

  static async #reinitialiser(event, cible) {
    if ( !this.enEdition ) return;
    return this.actor.update({ [cible.dataset.champ]: null });
  }

  /** Clic sur une case de stress : fixe le niveau (re-cliquer la dernière case la vide). */
  static async #fixerStress(event, cible) {
    if ( !this.isEditable ) return;
    const n = Number(cible.dataset.n);
    const nouveau = (this.actor.system.stress === n) ? n - 1 : n;
    return this.actor.update({ "system.stress": nouveau });
  }

  static async #fixerMort(event, cible) {
    if ( !this.isEditable ) return;
    const { type } = cible.dataset;
    const n = Number(cible.dataset.n);
    const actuel = this.actor.system.mort[type];
    return this.actor.update({ [`system.mort.${type}`]: (actuel === n) ? n - 1 : n });
  }

  static async #ouvrirItem(event, cible) {
    const item = this.actor.items.get(cible.closest("[data-item-id]")?.dataset.itemId);
    return item?.sheet.render(true);
  }

  static async #supprimerItem(event, cible) {
    if ( !this.enEdition ) return;
    const item = this.#itemDe(cible);
    return item?.delete();
  }

  /** Item de la ligne cliquée. */
  #itemDe(cible) {
    return this.actor.items.get(cible.closest("[data-item-id]")?.dataset.itemId) ?? null;
  }

  static async #attaquer(event, cible) {
    return this.#itemDe(cible)?.attaquer({ rapide: event.shiftKey });
  }

  static async #degats(event, cible) {
    return this.#itemDe(cible)?.lancerDegats();
  }

  static async #utiliser(event, cible) {
    return this.#itemDe(cible)?.utiliser();
  }

  /** −/+ sur un champ d'item : data-champ, data-delta. */
  static async #ajusterItem(event, cible) {
    if ( !this.isEditable ) return;
    const item = this.#itemDe(cible);
    if ( !item ) return;
    const champ = cible.dataset.champ;
    const actuel = Number(foundry.utils.getProperty(item, champ)) || 0;
    const nouveau = Math.max(0, actuel + Number(cible.dataset.delta));
    const maj = { [champ]: nouveau };
    // Racheter un objet à charges : il revient plein
    if ( (champ === "system.quantite") && (actuel === 0) && (nouveau > 0) && (item.system.chargesMax > 0) ) maj["system.chargesRestantes"] = item.system.chargesMax;
    return item.update(maj);
  }

  static async #basculerPorte(event, cible) {
    if ( !this.isEditable ) return;
    const item = this.#itemDe(cible);
    return item?.update({ "system.porte": !item.system.porte });
  }

  static async #arreterEffet(event, cible) {
    if ( !this.isEditable ) return;
    return this.#itemDe(cible)?.update({ "system.actif.enCours": false, "system.actif.tours": 0 });
  }
}

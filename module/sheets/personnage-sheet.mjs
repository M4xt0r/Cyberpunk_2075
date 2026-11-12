import { VITESSES, CATEGORIES_VEHICULE, TYPES_PLANQUE, QUALITES_PLANQUE } from "../config.mjs";
import { CHEMIN, CARACS, COMPETENCES, ETATS, NATURES, STRESS, COUVERTS, NIVEAUX, TYPES_ARME, TYPES_DEGATS, CATEGORIES_OBJET, QUALITES, EMPLACEMENTS, CAPSULES, ciblesModificateurs } from "../config.mjs";
import { CapsuleData } from "../data/implant.mjs";
import { ligneAmelioration, ligneModule } from "./vehicule-sheet.mjs";
import { signe } from "../dice/jets.mjs";
import { basculerThermique } from "../hud/vision.mjs";

const estThermique = nom => nom.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim() === "vision thermique";

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
      arreterEffet: FichePersonnage.#arreterEffet,
      basculerThermique: FichePersonnage.#basculerThermique,
      activer: FichePersonnage.#activer,
      lancerHack: FichePersonnage.#lancerHack,
      ajouterAmelioration: FichePersonnage.#ajouterAmelioration,
      poserCapsule: FichePersonnage.#poserCapsule,
      reposLong: FichePersonnage.#reposLong,
      monter: FichePersonnage.#monter,
      jetDeMort: FichePersonnage.#jetDeMort,
      ajouterVehicule: FichePersonnage.#ajouterVehicule,
      retirerVehicule: FichePersonnage.#retirerVehicule,
      ouvrirActeur: FichePersonnage.#ouvrirActeur,
      piloterVehicule: FichePersonnage.#piloterVehicule,
      basculerSurPlace: FichePersonnage.#basculerSurPlace,
      ouvrirItemBien: FichePersonnage.#ouvrirItemBien,
      supprimerItemBien: FichePersonnage.#supprimerItemBien
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
      rebours: s.etat === "rebours",
      cyberpsychose: s.etat === "cyberpsychose",
      aZeroPV: (s.vie.value <= 0),
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

    Object.assign(contexte, this.#preparerItems(), this.#preparerBiens());
    contexte.tabs = this._prepareTabs("primary");
    return contexte;
  }

  /** Véhicules et planque (page 3), éditables sur place. */
  #preparerBiens() {
    const s = this.actor.system;
    const trouver = uuid => { try { return fromUuidSync(uuid, { strict: false }); } catch { return null; } };
    const vehicules = s.vehicules.map(uuid => {
      const v = trouver(uuid);
      if ( !v ) return { uuid, manquant: true, nom: "Véhicule introuvable" };
      const vs = v.system;
      return {
        uuid, nom: v.name, img: v.img,
        modifiable: v.isOwner,
        categorie: CATEGORIES_VEHICULE[vs.categorie]?.label ?? vs.categorie,
        vitesse: vs.vitesse, vitesseEffective: vs.vitesseEffective, vitesseModifiee: vs.vitesse !== vs.vitesseEffective,
        maniabilite: vs.maniabilite, maniabiliteEffective: vs.maniabiliteEffective,
        vie: vs.vie.value, vieMax: vs.vie.max, viePct: vs.vie.max ? Math.clamp(Math.round(vs.vie.value / vs.vie.max * 100), 0, 100) : 0,
        places: vs.places, slots: vs.slots, slotsUtilises: vs.slotsUtilises, slotsPleins: vs.slotsPleins,
        blinde: vs.blinde, detruit: vs.detruit, endommage: vs.endommage,
        pilote: vs.piloteActeur?.name ?? null, estPilote: vs.pilote === this.actor.uuid,
        ameliorations: v.items.filter(i => i.type === "ameliorationVehicule").map(i => ligneAmelioration(i, v))
      };
    });
    // Planques : celles dont le MJ a donné la propriété au(x) joueur(s) de ce personnage
    const joueurs = game.users.filter(u => !u.isGM && this.actor.testUserPermission(u, "OWNER"));
    const planques = game.actors
      .filter(a => (a.type === "planque") && joueurs.some(u => a.testUserPermission(u, "OWNER")))
      .map(p => {
      const ps = p.system;
      return {
        uuid: p.uuid, nom: p.name, img: p.img, modifiable: p.isOwner,
        surPlace: s.surPlace === p.uuid,
        partagee: game.users.filter(u => !u.isGM && p.testUserPermission(u, "OWNER")).length > 1,
        type: ps.type, niveau: ps.niveau, qualite: ps.qualite,
        typeLabel: TYPES_PLANQUE[ps.type]?.label, qualiteLabel: QUALITES_PLANQUE[ps.qualite]?.label,
        modules: ps.modules, parking: ps.parking, hebergement: ps.hebergement, revenu: ps.revenu,
        bonus: ps.bonusOccupants.length,
        lignes: p.items.filter(i => i.type === "modulePlanque").map(i => ligneModule(i, p))
      };
    });
    const visibles = type => game.actors.filter(a => (a.type === type) && a.testUserPermission(game.user, "OBSERVER"));
    return {
      vehicules,
      choixVehicules: Object.fromEntries(visibles("vehicule").filter(v => !s.vehicules.includes(v.uuid)).map(v => [v.uuid, v.name])),
      peutCreerActeur: Actor.canUserCreate?.(game.user) ?? game.user.isGM,
      planques,
      sansJoueur: !joueurs.length,
      choixVitessesBien: Object.fromEntries(VITESSES.map(l => [l, l])),
      choixTypesPlanque: Object.fromEntries(Object.entries(TYPES_PLANQUE).map(([k, d]) => [k, d.label])),
      choixQualitesPlanque: Object.fromEntries(Object.entries(QUALITES_PLANQUE).map(([k, q]) => [k, q.label])),
      choixNiveauxPlanque: { 1: "Niv. 1", 2: "Niv. 2" }
    };
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

    const sources = { classe: "Classe", sousClasse: "Sous-classe", ultime: "Trait ultime", autre: "Talent" };
    const activations = { action: "action", bonus: "action bonus", reaction: "réaction" };
    const talents = acteur.items.filter(i => i.type === "talent")
      .sort((a, b) => (a.system.niveauObtention - b.system.niveauObtention) || a.name.localeCompare(b.name))
      .map(item => {
        const s = item.system;
        const max = s.utilisationsMax;
        const restantes = s.utilisationsRestantes;
        return {
          id: item.id,
          nom: item.name,
          actif: s.estActif,
          ultime: s.source === "ultime",
          info: [sources[s.source], `niv. ${s.niveauObtention}`, s.estActif ? activations[s.effet.activation] : null].filter(Boolean).join(" · "),
          resume: s.effet.description,
          usages: (max === null) ? null : `${restantes}/${max} ${s.effet.utilisations.periode === "combat" ? "par combat" : "par repos long"}`,
          bloque: restantes === 0,
          enCours: s.actif.enCours,
          tours: s.actif.tours
        };
      });

    const ram = acteur.system.ram.value;
    const hacks = acteur.items.filter(i => i.type === "hack")
      .sort((a, b) => (a.system.ram - b.system.ram) || a.name.localeCompare(b.name))
      .map(item => {
        const s = item.system;
        const cout = s.cout(s.variable.actif ? 1 : 0);
        return {
          id: item.id,
          nom: item.name,
          cout: s.variable.actif ? `${s.variable.parUnite}×` : s.ram,
          coutTexte: s.coutTexte,
          info: [activations[s.activation], (s.defense === "glace") ? "contre Glace" : "sans jet", s.duree ? `${s.duree} t.` : null].filter(Boolean).join(" · "),
          resume: s.resume,
          manque: (cout > ram) && !acteur.system.overclocking
        };
      });
    const slots = acteur.system.hacks;
    const infoHacks = {
      slots: slots.slots,
      utilises: slots.utilises,
      plein: slots.utilises > slots.slots,
      sansPuce: slots.slots === 0
    };

    return { armes, objets, talents, hacks, infoHacks, choixNiveaux, aArmes: armes.length > 0, aObjets: objets.length > 0, ...this.#preparerImplants(niveauBadge) };
  }

  /** Implants rangés par emplacement, côté gauche et côté droit de la silhouette. */
  #preparerImplants(niveauBadge) {
    const acteur = this.actor;
    const edge = acteur.system.edgerunner;
    const implants = acteur.items.filter(i => i.type === "implant").sort((a, b) => (a.sort - b.sort) || a.name.localeCompare(b.name));
    const cotes = { gauche: [], droite: [] };
    for ( const [cle, def] of Object.entries(EMPLACEMENTS) ) {
      const liste = implants.filter(i => i.system.emplacement === cle);
      let max = def.max;
      if ( (max !== null) && edge && (cle !== "portNeural") ) max += 1;
      let amelPosees = 0;
      let amelMax = 0;
      const lignes = liste.map(item => {
        const s = item.system;
        const posees = s.ameliorationsPosees;
        amelPosees += posees.length;
        amelMax += s.slotsAmelioration;
        const capsule = s.capsulePosee;
        const restantes = s.utilisationsRestantes;
        return {
          id: item.id,
          nom: item.name,
          niveau: niveauBadge(s),
          aNiveaux: s.aNiveaux,
          niveauPossede: s.niveauEffectif,
          cout: s.coutInstallation,
          actif: s.estActif,
          enCours: s.actif.enCours,
          tours: s.actif.tours,
          titreActiver: s.estActif ? `${s.effet.activation === "reaction" ? "Réaction" : s.effet.activation === "bonus" ? "Action bonus" : "Action"}${s.effet.coutHumanite ? ` · +${s.effet.coutHumanite}💀` : ""}${restantes === null ? "" : ` · ${restantes}/${s.utilisationsMax}`}` : "",
          bloque: restantes === 0,
          arme: s.armeIntegree,
          ameliorations: posees.map(a => ({ id: a.id, nom: a.name, cout: a.system.coutInstallation,
            thermique: estThermique(a.name), thermiqueOn: !!acteur.flags?.cyberpunk2075?.visionThermique })),
          acceptCapsule: s.acceptCapsule,
          capsule: capsule ? { id: capsule.id, nom: capsule.name, cout: capsule.system.coutInstallation } : null,
          amel: s.slotsAmelioration ? `${posees.length}/${s.slotsAmelioration}` : null,
          amelPleine: posees.length >= s.slotsAmelioration,
          aCompatibles: s.ameliorations.length > 0
        };
      });
      const nb = liste.length;
      const libres = (max === null) ? null : Math.max(0, max - nb);
      cotes[def.cote].push({
        cle,
        label: def.label,
        compteur: ((max === null) ? `${nb}` : `${nb}/${max}`) + (amelMax ? ` · amél. ${amelPosees}/${amelMax}` : ""),
        depasse: (max !== null) && (nb > max),
        vide: nb === 0,
        implants: lignes,
        texteLibres: (max === null) ? (nb ? "" : "Aucun · sans limite") : (libres ? `${nb ? "+ " : ""}${libres} emplacement${libres > 1 ? "s" : ""} libre${libres > 1 ? "s" : ""}` : ""),
        x: def.x,
        y: def.y
      });
    }
    return { implantsGauche: cotes.gauche, implantsDroite: cotes.droite, edgerunner: edge };
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

    // Câbles entre les emplacements d'implants et la silhouette : redessinés à chaque changement de taille
    this._observateur?.disconnect();
    const zone = this.element.querySelector(".cp-implants-zone");
    if ( zone ) {
      this._observateur = new ResizeObserver(() => this.#dessinerCables(zone));
      this._observateur.observe(zone);
    }

    // Champs d'items (niveau possédé, quantité) : mis à jour sur l'item, pas sur la fiche
    for ( const champ of this.element.querySelectorAll("[data-item-champ]") ) {
      champ.addEventListener("change", event => {
        event.stopPropagation();
        const item = this.actor.items.get(champ.closest("[data-item-id]")?.dataset.itemId);
        const valeur = Number.parseInt(event.currentTarget.value);
        if ( item && Number.isFinite(valeur) ) item.update({ [champ.dataset.itemChamp]: valeur });
      });
    }

    // Véhicules et planque : champs modifiés directement sur l'acteur lié
    for ( const champ of this.element.querySelectorAll("[data-bien-champ]") ) {
      champ.addEventListener("change", async event => {
        event.stopPropagation();
        const bien = await fromUuid(champ.closest("[data-bien]")?.dataset.bien);
        if ( !bien?.isOwner ) return ui.notifications.warn("Tu n'as pas le droit de modifier cet élément (demande au MJ).");
        let valeur = champ.value;
        if ( champ.type === "checkbox" ) valeur = champ.checked;
        else if ( champ.dataset.type === "nombre" ) valeur = Number.parseInt(String(valeur).replace("−", "-")) || 0;
        bien.update({ [champ.dataset.bienChamp]: valeur });
      });
    }
    // Lier un véhicule existant
    this.element.querySelector("[data-lier-vehicule]")?.addEventListener("change", event => {
      event.stopPropagation();
      const uuid = event.currentTarget.value;
      if ( uuid ) this.actor.update({ "system.vehicules": [...this.actor.system.vehicules, uuid] });
    });
    // Dépôt d'une amélioration sur un véhicule, d'un module sur la planque
    for ( const zone of this.element.querySelectorAll("[data-bien-depot]") ) {
      zone.addEventListener("dragover", event => { event.preventDefault(); zone.classList.add("cp-survol"); });
      zone.addEventListener("dragleave", () => zone.classList.remove("cp-survol"));
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

  /** @override */
  _onClose(options) {
    this._observateur?.disconnect();
    return super._onClose(options);
  }

  /**
   * Câbles orthogonaux : bord de la carte d'emplacement → couloir → point du corps.
   * Chaque câble a son propre couloir pour ne pas se superposer.
   */
  #dessinerCables(zone) {
    const svg = zone.querySelector(".cp-cables");
    const sil = zone.querySelector(".cp-sil-image");
    if ( !svg || !sil || !zone.offsetWidth ) return;
    const base = zone.getBoundingClientRect();
    const rs = sil.getBoundingClientRect();
    svg.setAttribute("viewBox", `0 0 ${base.width} ${base.height}`);
    svg.setAttribute("width", base.width);
    svg.setAttribute("height", base.height);
    const traces = [];
    for ( const cote of ["gauche", "droite"] ) {
      const cartes = [...zone.querySelectorAll(`.cp-slot[data-cote="${cote}"]`)];
      cartes.forEach((carte, i) => {
        const r = carte.getBoundingClientRect();
        const x1 = (cote === "gauche") ? r.right - base.left : r.left - base.left;
        const y1 = r.top - base.top + 14;
        const x3 = rs.left - base.left + (rs.width * Number(carte.dataset.x) / 100);
        const y3 = rs.top - base.top + (rs.height * Number(carte.dataset.y) / 100);
        const ecart = (cote === "gauche") ? (rs.left - base.left - x1) : (x1 - (rs.right - base.left));
        const pas = Math.max(6, Math.min(10, ecart / (cartes.length + 1)));
        const x2 = (cote === "gauche") ? x1 + pas * (i + 1) : x1 - pas * (i + 1);
        traces.push(`<path d="M${x1} ${y1}H${x2}V${y3}H${x3}" /><circle cx="${x3}" cy="${y3}" r="4" />`);
      });
    }
    svg.innerHTML = traces.join("");
  }

  /* -------------------------------------------- */
  /*  Glisser-déposer                             */
  /* -------------------------------------------- */

  /** Un véhicule glissé sur la fiche y est lié (une planque se donne par ses permissions). @override */
  async _onDropActor(event, acteur) {
    if ( !this.isEditable ) return null;
    if ( acteur.type === "vehicule" ) {
      if ( this.actor.system.vehicules.includes(acteur.uuid) ) return null;
      return this.actor.update({ "system.vehicules": [...this.actor.system.vehicules, acteur.uuid] });
    }
    if ( acteur.type === "planque" ) return ui.notifications.info("Une planque apparaît ici quand le MJ en donne la propriété au joueur (clic droit sur la planque › Configurer les permissions).");
    return null;
  }

  /** Une seule classe et une seule sous-classe : la nouvelle remplace l'ancienne. @override */
  async _onDropItem(event, item) {
    if ( !this.actor.isOwner ) return null;

    // Amélioration de véhicule ou module : sur la carte du véhicule ou de la planque
    if ( ["ameliorationVehicule", "modulePlanque"].includes(item.type) ) {
      const bien = await fromUuid(event.target.closest?.("[data-bien]")?.dataset.bien);
      const attendu = (item.type === "ameliorationVehicule") ? "vehicule" : "planque";
      if ( bien?.type !== attendu ) return ui.notifications.warn(`Glisse ${item.name} sur la carte ${attendu === "vehicule" ? "du véhicule" : "de la planque"} (page Inventaire & biens).`);
      if ( !bien.isOwner ) return ui.notifications.warn(`Tu ne peux pas modifier ${bien.name}.`);
      return bien.sheet._onDropItem(event, item);
    }

    // Amélioration ou capsule : sur la ligne d'un implant
    if ( ["ameliorationImplant", "capsule"].includes(item.type) ) {
      const ligne = event.target.closest?.("[data-implant]");
      const implant = this.actor.items.get(ligne?.dataset.itemId);
      if ( !implant ) {
        ui.notifications.warn(`Glisse ${item.name} sur la ligne de l'implant qui doit la recevoir (page Combat & chrome).`);
        return null;
      }
      if ( (item.type === "capsule") && !implant.system.acceptCapsule ) return ui.notifications.warn(`${implant.name} n'accepte pas de capsule.`);
      if ( (item.type === "capsule") && implant.system.capsulePosee ) return ui.notifications.warn(`${implant.name} porte déjà une capsule.`);
      if ( (item.type === "ameliorationImplant") && (implant.system.ameliorationsPosees.length >= implant.system.slotsAmelioration) ) {
        ui.notifications.warn(`${implant.name} : plus de place d'amélioration.`);
      }
      const donnees = item.toObject();
      delete donnees._id;
      foundry.utils.setProperty(donnees, "system.implant", implant.id);
      if ( item.parent === this.actor ) return item.update({ "system.implant": implant.id });
      return this.actor.createEmbeddedDocuments("Item", [donnees]);
    }

    // Implant : avertissement si l'emplacement est plein
    if ( (item.type === "implant") && (item.parent !== this.actor) ) {
      const def = EMPLACEMENTS[item.system.emplacement];
      let max = def?.max ?? null;
      if ( (max !== null) && this.actor.system.edgerunner && (item.system.emplacement !== "portNeural") ) max += 1;
      const nb = this.actor.items.filter(i => (i.type === "implant") && (i.system.emplacement === item.system.emplacement)).length;
      if ( (max !== null) && (nb >= max) ) ui.notifications.warn(`Emplacement ${def.label} plein (${max} max) : l'implant est posé quand même.`);
    }
    // Hack : un emplacement de hack par puce
    if ( (item.type === "hack") && (item.parent !== this.actor) ) {
      const { slots, utilises } = this.actor.system.hacks;
      if ( this.actor.items.some(i => (i.type === "hack") && (i.name === item.name)) ) return ui.notifications.warn(`${item.name} est déjà installé.`);
      if ( !slots ) ui.notifications.warn("Aucun emplacement de hack : installe d'abord une Puce de piratage. Le hack est posé quand même.");
      else if ( utilises >= slots ) ui.notifications.warn(`Emplacements de hack pleins (${slots}) : le hack est posé quand même.`);
    }
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

  /** Crée un véhicule (si le joueur en a le droit) et le lie à la fiche. */
  static async #ajouterVehicule() {
    if ( !this.isEditable ) return;
    const v = await Actor.implementation.create({ name: `Véhicule de ${this.actor.name}`, type: "vehicule", ownership: { default: 0, [game.user.id]: 3 } });
    if ( v ) await this.actor.update({ "system.vehicules": [...this.actor.system.vehicules, v.uuid] });
  }

  static async #retirerVehicule(event, cible) {
    if ( !this.isEditable ) return;
    const uuid = cible.closest("[data-bien]")?.dataset.bien;
    return this.actor.update({ "system.vehicules": this.actor.system.vehicules.filter(u => u !== uuid) });
  }

  static async #ouvrirActeur(event, cible) {
    const bien = await fromUuid(cible.closest("[data-bien]")?.dataset.bien);
    return bien?.sheet.render(true);
  }

  static async #piloterVehicule(event, cible) {
    const v = await fromUuid(cible.closest("[data-bien]")?.dataset.bien);
    if ( !v ) return;
    // Le personnage de la fiche prend le volant s'il n'y a pas de pilote
    if ( !v.system.pilote && v.isOwner ) await v.update({ "system.pilote": this.actor.uuid });
    return v.piloter({ rapide: event.shiftKey });
  }

  /** « Sur place » : les bonus des modules de cette planque s'appliquent au personnage. */
  static async #basculerSurPlace(event, cible) {
    if ( !this.isEditable ) return;
    const uuid = cible.closest("[data-bien]")?.dataset.bien ?? "";
    return this.actor.update({ "system.surPlace": (this.actor.system.surPlace === uuid) ? "" : uuid });
  }

  static async #ouvrirItemBien(event, cible) {
    const bien = await fromUuid(cible.closest("[data-bien]")?.dataset.bien);
    return bien?.items.get(cible.closest("[data-item-id]")?.dataset.itemId)?.sheet.render(true);
  }

  static async #supprimerItemBien(event, cible) {
    const bien = await fromUuid(cible.closest("[data-bien]")?.dataset.bien);
    if ( !bien?.isOwner ) return;
    return bien.items.get(cible.closest("[data-item-id]")?.dataset.itemId)?.delete();
  }

  static async #activer(event, cible) {
    return this.#itemDe(cible)?.activer();
  }

  static async #lancerHack(event, cible) {
    return this.#itemDe(cible)?.lancer({ rapide: event.shiftKey });
  }

  static async #monter() {
    if ( !this.enEdition ) return;
    return this.actor.monterNiveau();
  }

  static async #reposLong() {
    if ( !this.isEditable ) return;
    return this.actor.reposLong();
  }

  static async #jetDeMort() {
    if ( !this.isEditable ) return;
    return this.actor.jetDeMort();
  }

  /** Choisir une amélioration parmi celles que l'implant accepte. */
  static async #ajouterAmelioration(event, cible) {
    if ( !this.isEditable ) return;
    const implant = this.#itemDe(cible);
    if ( !implant ) return;
    const s = implant.system;
    const posees = new Set(s.ameliorationsPosees.map(a => a.name));
    const lignes = s.ameliorations.map((a, i) => ({ ...a, i, posee: posees.has(a.nom) }));
    if ( !lignes.length ) return ui.notifications.info(`${implant.name} n'a pas d'amélioration compatible. Tu peux en glisser une depuis le compendium sur sa ligne.`);
    const contenu = await foundry.applications.handlebars.renderTemplate(`${CHEMIN}/templates/dialogs/ameliorations.hbs`, {
      implant: implant.name, lignes, places: `${posees.size}/${s.slotsAmelioration}`, plein: posees.size >= s.slotsAmelioration
    });
    const index = await foundry.applications.api.DialogV2.wait({
      window: { title: `Améliorations · ${implant.name}` },
      classes: ["cp2075", "cp-dialogue"],
      position: { width: 460 },
      content: contenu,
      buttons: [
        { action: "annuler", label: "Annuler" },
        { action: "ajouter", label: "Ajouter", default: true, callback: (e, b) => b.form.elements.choix?.value ?? null }
      ],
      rejectClose: false
    });
    const ligne = lignes[Number(index)];
    if ( !ligne || (index === null) || (index === "annuler") ) return;
    if ( posees.size >= s.slotsAmelioration ) ui.notifications.warn(`${implant.name} : plus de place d'amélioration (${s.slotsAmelioration}).`);
    return this.actor.createEmbeddedDocuments("Item", [{
      name: ligne.nom,
      type: "ameliorationImplant",
      img: implant.img,
      system: {
        prix: ligne.prix,
        coutInstallation: ligne.cout,
        implant: implant.id,
        effet: { description: ligne.effet, modificateurs: (ligne.cible && ligne.valeur) ? [{ cible: ligne.cible, valeur: ligne.valeur }] : [] }
      }
    }]);
  }

  /** Poser une capsule sur un implant de bras. */
  static async #poserCapsule(event, cible) {
    if ( !this.isEditable ) return;
    const implant = this.#itemDe(cible);
    if ( !implant ) return;
    if ( implant.system.capsulePosee ) return ui.notifications.warn(`${implant.name} porte déjà une capsule.`);
    const choix = Object.entries(CAPSULES).map(([cle, c]) => `<label class="cp-ligne"><input type="radio" name="choix" value="${cle}"> ${c.label} · +1d4 ${TYPES_DEGATS[c.typeDegats].toLowerCase()} · 1 000 €$ · +10💀</label>`).join("");
    const cle = await foundry.applications.api.DialogV2.wait({
      window: { title: `Capsule · ${implant.name}` },
      classes: ["cp2075", "cp-dialogue"],
      content: `<div class="cp-dlg">${choix}</div>`,
      buttons: [
        { action: "annuler", label: "Annuler" },
        { action: "poser", label: "Poser", default: true, callback: (e, b) => b.form.elements.choix?.value || null }
      ],
      rejectClose: false
    });
    if ( !CAPSULES[cle] ) return;
    const modele = CapsuleData.modele(cle);
    foundry.utils.setProperty(modele, "system.implant", implant.id);
    return this.actor.createEmbeddedDocuments("Item", [modele]);
  }

  static async #basculerThermique() {
    if ( !this.isEditable ) return;
    await basculerThermique(this.actor);
    this.render();
  }

  static async #arreterEffet(event, cible) {
    if ( !this.isEditable ) return;
    return this.#itemDe(cible)?.update({ "system.actif.enCours": false, "system.actif.tours": 0 });
  }
}

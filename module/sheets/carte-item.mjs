import {
  CHEMIN, CARACS, COMPETENCES, NIVEAUX, TYPES_ARME, REGLES_ARME, TYPES_DEGATS, DEFENSES, STYLES_ANIMATION,
  ACTIVATIONS, PERIODES, CATEGORIES_OBJET, QUALITES, TYPES_JET, ciblesModificateurs,
  EMPLACEMENTS, MOMENTS_ANIMATION, STYLES_ANIM_IMPLANT, EFFETS_SPECIAUX, CAPSULES
} from "../config.mjs";
import { signe } from "../dice/jets.mjs";
import { jouerAnimation } from "../animations.mjs";

const { HandlebarsApplicationMixin } = foundry.applications.api;
const { ItemSheetV2 } = foundry.applications.sheets;
const TextEditor = () => foundry.applications.ux.TextEditor.implementation;

const nomFichier = chemin => chemin ? decodeURIComponent(chemin.split("/").pop()) : "";
const prix = n => `${(Number(n) || 0).toLocaleString("fr-FR")} €$`;

/** Texte HTML des règles : les retours à la ligne d'un texte simple sont conservés. */
async function enrichir(texte, item) {
  if ( !texte ) return "";
  const html = /<[a-z][\s\S]*>/i.test(texte) ? texte : texte.split(/\n+/).map(l => `<p>${foundry.utils.escapeHTML?.(l) ?? l}</p>`).join("");
  return TextEditor().enrichHTML(html, { relativeTo: item, secrets: item.isOwner });
}

/**
 * Carte d'item « barrette de RAM » : lecture pour tous, édition pour le MJ seul.
 */
class CarteItem extends HandlebarsApplicationMixin(ItemSheetV2) {

  static DEFAULT_OPTIONS = {
    classes: ["cp2075", "cp-carte-fenetre"],
    position: { width: 680, height: "auto" },
    window: { resizable: true },
    form: { submitOnChange: true },
    actions: {
      voirNiveau: CarteItem.#voirNiveau,
      editerNiveau: CarteItem.#editerNiveau,
      copierNiveau: CarteItem.#copierNiveau,
      basculerApercu: CarteItem.#basculerApercu,
      choisirFichier: CarteItem.#choisirFichier,
      viderFichier: CarteItem.#viderFichier,
      ajouterModif: CarteItem.#ajouterModif,
      supprimerModif: CarteItem.#supprimerModif,
      ajouterLigne: CarteItem.#ajouterLigne,
      supprimerLigne: CarteItem.#supprimerLigne,
      choisirFichierLigne: CarteItem.#choisirFichierLigne,
      testerAnimations: CarteItem.#testerAnimations,
      ouvrirReference: CarteItem.#ouvrirReference
    }
  };

  /** Niveau affiché en lecture (clic sur une plaque) et en édition (onglet). */
  _niveauVu = null;
  /** Le MJ regarde la carte comme un joueur. */
  _apercu = false;

  /** Seul le MJ modifie les cartes. @override */
  get isEditable() {
    return super.isEditable && game.user.isGM;
  }

  get enEdition() {
    return this.isEditable && !this._apercu;
  }

  get niveauVu() {
    const s = this.item.system;
    if ( !s.aNiveaux ) return 1;
    return this._niveauVu ?? s.niveauEffectif;
  }

  /** @override */
  async _prepareContext(options) {
    const contexte = await super._prepareContext(options);
    const item = this.item;
    const s = item.system;
    const nv = this.niveauVu;
    Object.assign(contexte, {
      item,
      system: s,
      edition: this.enEdition,
      mj: this.isEditable,
      apercu: this._apercu,
      nv,
      nvPrecedent: nv - 1,
      cleNv: `n${nv}`,
      donneesNv: s.niveaux?.[`n${nv}`],
      possedeParActeur: !!item.actor,
      plaques: [1, 2, 3].map(i => ({
        i,
        label: NIVEAUX[i].label,
        couleur: NIVEAUX[i].couleur,
        prix: prix(s.niveaux?.[`n${i}`]?.prix),
        vu: i === nv,
        possede: !!item.actor && (s.niveauEffectif === i)
      })),
      regles: await enrichir(s.description, item),
      codeBarre: `${item.id?.slice(0, 2).toUpperCase() ?? "XX"}-${item.name.normalize("NFD").replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase()}-0${nv}`
    });
    return contexte;
  }

  /** @override */
  async _onRender(contexte, options) {
    await super._onRender(contexte, options);
    this.element.classList.toggle("cp-carte-edition", this.enEdition);

    // Lignes de modificateurs : champs sans nom, mis à jour ensemble
    for ( const el of this.element.querySelectorAll("[data-modif]") ) {
      el.addEventListener("change", () => this.#enregistrerModifs(el.closest("[data-modifs]")));
    }
    // Zones de dépôt (talents, sous-classes, items du pack)
    if ( this.isEditable ) {
      for ( const zone of this.element.querySelectorAll("[data-depot]") ) {
        zone.addEventListener("dragover", event => { event.preventDefault(); zone.classList.add("cp-survol"); });
        zone.addEventListener("dragleave", () => zone.classList.remove("cp-survol"));
        zone.addEventListener("drop", async event => {
          event.preventDefault();
          event.stopPropagation();
          zone.classList.remove("cp-survol");
          const donnees = foundry.applications.ux.TextEditor.implementation.getDragEventData(event);
          if ( (donnees?.type !== "Item") || !donnees.uuid ) return ui.notifications.warn("Glisse un item (depuis la barre latérale ou un compendium).");
          const item = await fromUuid(donnees.uuid);
          if ( item ) await this._surDepot(zone.dataset, item);
        });
      }
    }

    // Tableaux génériques (améliorations compatibles, animations) : idem
    for ( const el of this.element.querySelectorAll("[data-liste] [data-cle]") ) {
      el.addEventListener("change", event => {
        event.stopPropagation();
        this.#enregistrerListe(el.closest("[data-liste]"));
      });
    }
  }

  /**
   * Un item est déposé sur une zone [data-depot]. À surcharger.
   * @param {DOMStringMap} zone  data-* de la zone.
   * @param {Item} item
   */
  async _surDepot(zone, item) {}

  /** Ajoute une référence {uuid, nom, resume, ...} à un tableau. */
  async _ajouterReference(chemin, item, extra = {}) {
    const liste = foundry.utils.deepClone(foundry.utils.getProperty(this.item.toObject(), chemin) ?? []);
    liste.push({ uuid: item.uuid, nom: item.name, resume: item.system.resume ?? "", ...extra });
    return this.item.update({ [chemin]: liste });
  }

  /** Relit toutes les lignes d'un tableau et enregistre le tableau entier. */
  async #enregistrerListe(liste) {
    if ( !liste || !this.isEditable ) return;
    const chemin = liste.dataset.liste;
    const actuel = foundry.utils.deepClone(foundry.utils.getProperty(this.item.toObject(), chemin) ?? []);
    [...liste.querySelectorAll("[data-ligne]")].forEach((ligne, i) => {
      actuel[i] ??= {};
      for ( const champ of ligne.querySelectorAll("[data-cle]") ) {
        const v = champ.value;
        if ( champ.dataset.type === "nombre" ) actuel[i][champ.dataset.cle] = Number.parseInt(String(v).replace("−", "-")) || 0;
        else if ( champ.dataset.type === "multiple" ) actuel[i][champ.dataset.cle] = [...champ.selectedOptions].map(o => o.value).join(",");
        else actuel[i][champ.dataset.cle] = v;
      }
    });
    return this.item.update({ [chemin]: actuel });
  }

  async #enregistrerModifs(liste) {
    if ( !liste || !this.isEditable ) return;
    const chemin = liste.dataset.modifs;
    const lignes = [...liste.querySelectorAll("[data-ligne]")].map(l => ({
      cible: l.querySelector("[data-modif='cible']").value,
      valeur: Number.parseInt(String(l.querySelector("[data-modif='valeur']").value).replace("−", "-")) || 0
    }));
    return this.item.update({ [chemin]: lignes });
  }

  /* -------------------------------------------- */

  static async #voirNiveau(event, cible) {
    this._niveauVu = Number(cible.dataset.niveau);
    return this.render();
  }

  static async #editerNiveau(event, cible) {
    this._niveauVu = Number(cible.dataset.niveau);
    return this.render();
  }

  static async #copierNiveau() {
    const nv = this.niveauVu;
    if ( nv <= 1 || !this.isEditable ) return;
    const source = foundry.utils.deepClone(this.item.system.toObject().niveaux[`n${nv - 1}`]);
    return this.item.update({ [`system.niveaux.n${nv}`]: source });
  }

  static async #basculerApercu() {
    this._apercu = !this._apercu;
    return this.render();
  }

  static async #choisirFichier(event, cible) {
    if ( !this.isEditable ) return;
    const champ = cible.dataset.champ;
    const Picker = CONFIG.ux?.FilePicker ?? foundry.applications.apps.FilePicker.implementation;
    const picker = new Picker({
      type: cible.dataset.type ?? "imagevideo",
      current: foundry.utils.getProperty(this.item, champ) || `${CHEMIN}/assets/animations/`,
      callback: chemin => this.item.update({ [champ]: chemin })
    });
    return picker.browse();
  }

  static async #viderFichier(event, cible) {
    if ( !this.isEditable ) return;
    return this.item.update({ [cible.dataset.champ]: "" });
  }

  static async #ajouterModif(event, cible) {
    if ( !this.isEditable ) return;
    const chemin = cible.dataset.chemin;
    const liste = foundry.utils.deepClone(foundry.utils.getProperty(this.item.toObject(), chemin) ?? []);
    liste.push({ cible: "comp.perception", valeur: 1 });
    return this.item.update({ [chemin]: liste });
  }

  static async #ajouterLigne(event, cible) {
    if ( !this.isEditable ) return;
    const chemin = cible.dataset.chemin;
    const liste = foundry.utils.deepClone(foundry.utils.getProperty(this.item.toObject(), chemin) ?? []);
    liste.push(JSON.parse(cible.dataset.modele ?? "{}"));
    return this.item.update({ [chemin]: liste });
  }

  static async #supprimerLigne(event, cible) {
    if ( !this.isEditable ) return;
    const chemin = cible.dataset.chemin;
    const liste = foundry.utils.deepClone(foundry.utils.getProperty(this.item.toObject(), chemin) ?? []);
    liste.splice(Number(cible.dataset.index), 1);
    return this.item.update({ [chemin]: liste });
  }

  static async #choisirFichierLigne(event, cible) {
    if ( !this.isEditable ) return;
    const { chemin, index, cle } = cible.dataset;
    const liste = foundry.utils.deepClone(foundry.utils.getProperty(this.item.toObject(), chemin) ?? []);
    const Picker = CONFIG.ux?.FilePicker ?? foundry.applications.apps.FilePicker.implementation;
    return new Picker({
      type: cible.dataset.type ?? "imagevideo",
      current: liste[index]?.[cle] || `${CHEMIN}/assets/animations/`,
      callback: f => {
        liste[index][cle] = f;
        this.item.update({ [chemin]: liste });
      }
    }).browse();
  }

  /** Ouvre la carte d'un item référencé par UUID. */
  static async #ouvrirReference(event, cible) {
    const item = await fromUuid(cible.dataset.uuid);
    if ( !item ) return ui.notifications.warn("Cet item n'existe plus (supprimé ou compendium manquant).");
    return item.sheet.render(true);
  }

  /** Joue les animations de l'implant sur le token sélectionné, vers les cibles visées. */
  static async #testerAnimations() {
    const source = canvas?.tokens?.controlled[0];
    if ( !source ) return ui.notifications.warn("Sélectionne un token sur la scène pour tester les animations.");
    const s = this.item.system;
    const cibles = Array.from(game.user.targets);
    const base = { scene: canvas.scene.id, source: source.id, cibles: cibles.map(t => t.id), touches: cibles.map(t => t.id), point: null, rayon: s.attaque?.zone ?? 0 };
    const ordre = ["activation", "duree", "attaque", "toucher"];
    const lignes = [...s.animations].filter(a => a.fichier).sort((a, b) => ordre.indexOf(a.moment) - ordre.indexOf(b.moment));
    if ( !lignes.length ) return ui.notifications.info("Aucune animation à tester.");
    for ( const a of lignes ) {
      const conf = { ...base, son: a.moment === "toucher" ? s.sons.toucher : (a.moment === "activation" ? s.sons.activation : "") };
      if ( a.style === "soi" ) Object.assign(conf, { style: "soi", impact: a.fichier });
      else if ( a.style === "impact" ) Object.assign(conf, { style: "impact", impact: a.fichier, point: cibles.length ? null : source.center });
      else if ( a.style === "zone" ) Object.assign(conf, { style: "zone", zone: a.fichier, cibles: cibles.length ? base.cibles : [source.id] });
      else Object.assign(conf, { style: "projectile", projectile: a.fichier });
      if ( (conf.style !== "soi") && !cibles.length && (conf.style !== "zone") ) conf.point = { x: source.center.x + (canvas.dimensions.size * 4), y: source.center.y };
      await jouerAnimation(conf);
    }
  }

  static async #supprimerModif(event, cible) {
    if ( !this.isEditable ) return;
    const chemin = cible.dataset.chemin;
    const liste = foundry.utils.deepClone(foundry.utils.getProperty(this.item.toObject(), chemin) ?? []);
    liste.splice(Number(cible.dataset.index), 1);
    return this.item.update({ [chemin]: liste });
  }
}

/* ============================================ */
/*  Arme                                        */
/* ============================================ */

export class CarteArme extends CarteItem {

  static PARTS = {
    carte: { template: `${CHEMIN}/templates/item/carte-arme.hbs` }
  };

  /** @override */
  async _prepareContext(options) {
    const c = await super._prepareContext(options);
    const s = this.item.system;
    const n = c.donneesNv;
    const type = TYPES_ARME[s.type] ?? TYPES_ARME.autre;
    const comp = COMPETENCES[s.competence];
    const anim = s.animationEffective;
    Object.assign(c, {
      reference: `CP2075 · ARM-${type.code} · Rév.${c.nv}`,
      typeLabel: type.label,
      competenceLabel: comp?.label ?? "—",
      caracLabel: CARACS[s.carac]?.label ?? null,
      touche: c.possedeParActeur ? `1d20 ${signe(s.scoreTouche).replace(/^([+−])/, "$1 ")}` : `1d20 + ${comp?.label ?? "?"}`,
      degats: s.formuleLisible(c.nv),
      typeDegats: TYPES_DEGATS[n.typeDegats] ?? n.typeDegats,
      critique: `+${NIVEAUX[c.nv].critique}`,
      critiqueAuto: s.type === "sniper" ? "Toujours en cas de réussite" : null,
      defense: DEFENSES[s.attaque.defense],
      regleType: REGLES_ARME[s.type],
      styleAnimation: STYLES_ANIMATION[anim.style] ?? anim.style,
      fichiers: [
        anim.style.startsWith("projectile") ? { label: "Projectile", nom: nomFichier(anim.projectile) } : null,
        ["impact", "projectileImpact", "soi"].includes(anim.style) ? { label: "Impact", nom: nomFichier(anim.impact) } : null,
        ["zone", "projectileZone"].includes(anim.style) ? { label: "Zone", nom: nomFichier(anim.zone) } : null,
        { label: "Son", nom: nomFichier(anim.son) || "aucun" }
      ].filter(Boolean),
      // Édition
      choixTypes: Object.fromEntries(Object.entries(TYPES_ARME).map(([k, v]) => [k, v.label])),
      choixCompetences: Object.fromEntries(Object.entries(COMPETENCES).map(([k, v]) => [k, v.label])),
      choixCaracs: { "": "Aucune", ...Object.fromEntries(Object.entries(CARACS).map(([k, v]) => [k, v.labelLong ?? v.label])) },
      choixDegats: TYPES_DEGATS,
      choixDefenses: DEFENSES,
      choixStyles: { "": `Par défaut (${STYLES_ANIMATION[type.anim.style]})`, ...STYLES_ANIMATION },
      champsFichiers: [
        { label: "Projectile (PNG)", champ: "system.attaque.animation.projectile", valeur: s.attaque.animation.projectile, defaut: nomFichier(anim.projectile), type: "imagevideo" },
        { label: "Impact (WebM)", champ: "system.attaque.animation.impact", valeur: s.attaque.animation.impact, defaut: nomFichier(anim.impact), type: "imagevideo" },
        { label: "Zone (WebM)", champ: "system.attaque.animation.zone", valeur: s.attaque.animation.zone, defaut: nomFichier(anim.zone), type: "imagevideo" },
        { label: "Son", champ: "system.attaque.animation.son", valeur: s.attaque.animation.son, defaut: "aucun", type: "audio" }
      ].map(f => ({ ...f, nom: nomFichier(f.valeur), defaut: f.defaut || "aucun" })),
      estGrenade: s.type === "grenade"
    });
    return c;
  }
}

/* ============================================ */
/*  Objet                                       */
/* ============================================ */

export class CarteObjet extends CarteItem {

  static PARTS = {
    carte: { template: `${CHEMIN}/templates/item/carte-objet.hbs` }
  };

  /** @override */
  async _prepareContext(options) {
    const c = await super._prepareContext(options);
    const s = this.item.system;
    const n = c.donneesNv;
    const e = n.effet;
    const cibles = ciblesModificateurs();
    const modifs = e.modificateurs.map(m => `${signe(m.valeur)} ${cibles[m.cible] ?? m.cible}`);

    const puces = [];
    if ( e.jet.formule ) puces.push({ label: e.jet.type === "soin" ? "Soin" : `Dégâts · ${TYPES_DEGATS[e.jet.typeDegats] ?? "—"}`, valeur: e.jet.formule, num: true, couleur: e.jet.type === "soin" ? "vert" : "jaune" });
    if ( modifs.length ) puces.push({ label: e.type === "actif" ? "Pendant l'effet" : "Effet", valeur: modifs.join(" · ") });
    if ( n.charges > 0 ) {
      const restantes = c.possedeParActeur ? s.chargesRestantes : n.charges;
      puces.push({ label: "Charges", charges: Array.from({ length: n.charges }, (_, i) => ({ pleine: i < restantes })), valeur: `${restantes} / ${n.charges}`, accent: true });
    }
    if ( e.type === "actif" ) puces.push({ label: "Activation", valeur: `${ACTIVATIONS[e.activation]}${e.duree ? ` · ${e.duree} tour${e.duree > 1 ? "s" : ""}` : ""}` });
    const cout = e.coutHumanite + (QUALITES[s.qualite]?.humanite ?? 0);
    if ( cout ) puces.push({ label: "Humanité", valeur: `${cout > 0 ? "+" : "−"}${Math.abs(cout)}💀`, num: true, couleur: cout > 0 ? "rouge" : "vert" });
    if ( e.utilisations.periode !== "illimite" ) puces.push({ label: "Utilisations", valeur: `${e.utilisations.periode === "bm" ? "BM" : e.utilisations.max} ${PERIODES[e.utilisations.periode].replace(/^BM fois /, "").toLowerCase()}` });

    const prixAffiche = s.qualite !== "aucune" ? QUALITES[s.qualite].prix : n.prix;
    Object.assign(c, {
      reference: `CP2075 · OBJ-${s.categorie.slice(0, 3).toUpperCase()} · Rév.${c.nv}`,
      categorieLabel: CATEGORIES_OBJET[s.categorie],
      prix: prix(prixAffiche),
      puces: puces.slice(0, 4),
      nbPuces: Math.min(puces.length, 4),
      typeEffet: e.type === "actif" ? "actif" : "passif",
      qualiteLabel: s.qualite !== "aucune" ? QUALITES[s.qualite].label : null,
      // Édition
      choixCategories: CATEGORIES_OBJET,
      choixQualites: Object.fromEntries(Object.entries(QUALITES).map(([k, v]) => [k, k === "aucune" ? "Pas de la nourriture" : `${v.label} (${v.humanite || "+0"}💀, ${v.prix} €$)`])),
      choixActivations: ACTIVATIONS,
      choixPeriodes: PERIODES,
      choixJets: TYPES_JET,
      choixDegats: { "": "—", ...TYPES_DEGATS },
      choixCibles: cibles,
      cheminModifs: `system.niveaux.n${c.nv}.effet.modificateurs`,
      modifs: e.modificateurs.map((m, i) => ({ ...m, i })),
      prefixe: `system.niveaux.n${c.nv}`
    });
    return c;
  }
}

/* ============================================ */
/*  Implant                                     */
/* ============================================ */

export class CarteImplant extends CarteItem {

  static PARTS = {
    carte: { template: `${CHEMIN}/templates/item/carte-implant.hbs` }
  };

  /** @override */
  async _prepareContext(options) {
    const c = await super._prepareContext(options);
    const item = this.item;
    const s = item.system;
    const n = c.donneesNv;
    const e = n.effet;
    const empl = EMPLACEMENTS[s.emplacement];
    const cibles = ciblesModificateurs();
    const modifs = e.modificateurs.map(m => `${signe(m.valeur)} ${(cibles[m.cible] ?? m.cible).replace(/^(Comp|Carac)\. · /, "")}`);
    const actif = e.type === "actif";

    const puces = [
      { label: "Effet", valeur: e.description || (actif ? "Actif" : "Passif") },
      { label: actif ? "Pendant l'effet" : "Modificateur", valeur: modifs.join(" · ") || "—", num: !!modifs.length, couleur: modifs.length ? "jaune" : null },
      { label: "Améliorations", valeur: n.slotsAmelioration ? `${n.slotsAmelioration} place${n.slotsAmelioration > 1 ? "s" : ""}` : "Aucune", num: true },
      { label: c.possedeParActeur ? "Posé chez toi" : "Installation", valeur: s.coutTexte, num: true }
    ];
    const pucesActif = actif ? [
      { label: "Activation", valeur: ACTIVATIONS[e.activation] },
      { label: "Utilisations", valeur: e.utilisations.periode === "illimite" ? "Illimité" : `${e.utilisations.periode === "bm" ? "BM" : e.utilisations.max} ${PERIODES[e.utilisations.periode].replace(/^BM fois /, "").toLowerCase()}` },
      { label: "Coût / activation", valeur: `${e.coutHumanite > 0 ? "+" : ""}${e.coutHumanite}💀`, num: true },
      { label: e.humaniteKill ? "💀 par kill" : "Durée", valeur: e.humaniteKill ? `+${e.humaniteKill}💀` : (e.duree ? `${e.duree} tour${e.duree > 1 ? "s" : ""}` : "Instantané"), num: !!e.humaniteKill }
    ] : null;
    const pucesArme = s.armeIntegree ? [
      { label: "Touche", valeur: c.possedeParActeur ? `1d20 ${signe(s.scoreTouche).replace(/^([+−])/, "$1 ")}` : `1d20 + ${s.competenceLabel}`, num: true },
      { label: `Dégâts · ${TYPES_DEGATS[n.typeDegats] ?? n.typeDegats}`, valeur: s.formuleLisible(c.nv), num: true, couleur: "jaune" },
      { label: "Critique", valeur: `+${NIVEAUX[c.nv].critique}`, num: true },
      { label: "Défense visée", valeur: DEFENSES[s.attaque.defense] }
    ] : null;

    const posees = s.ameliorationsPosees.map(a => ({ id: a.id, nom: a.name, cout: a.system.coutInstallation, effet: a.system.effet.description }));
    const libres = Math.max(0, n.slotsAmelioration - posees.length);
    const nomsPoses = new Set(posees.map(p => p.nom));
    const capsule = s.capsulePosee;

    Object.assign(c, {
      reference: `CP2075 · IMP-${empl?.code ?? "ACC"} · ${actif && s.armeIntegree ? "Actif + arme intégrée" : `Rév.${c.nv}`}`,
      emplacementLabel: empl ? `${empl.label}${empl.max ? ` · ${empl.max} max` : " · sans limite"}` : "—",
      typeEffet: actif ? "actif" : "passif",
      actif,
      puces,
      pucesActif,
      pucesArme,
      posees,
      placesLibres: Array.from({ length: libres }),
      nbPosees: posees.length,
      compatibles: s.ameliorations.map(a => ({ nom: a.nom, posee: nomsPoses.has(a.nom) })),
      capsule: s.acceptCapsule ? (capsule ? capsule.name : "aucune") : null,
      // Édition
      choixEmplacements: Object.fromEntries(Object.entries(EMPLACEMENTS).map(([k, v]) => [k, `${v.label}${v.max ? ` (${v.max} max)` : ""}`])),
      choixSpeciaux: EFFETS_SPECIAUX,
      choixActivations: ACTIVATIONS,
      choixPeriodes: PERIODES,
      choixJets: TYPES_JET,
      choixDegats: TYPES_DEGATS,
      choixDegatsJet: { "": "—", ...TYPES_DEGATS },
      choixDefenses: DEFENSES,
      choixTypes: Object.fromEntries(Object.entries(TYPES_ARME).filter(([k]) => k !== "grenade").map(([k, v]) => [k, v.label])),
      choixCompetences: Object.fromEntries(Object.entries(COMPETENCES).map(([k, v]) => [k, v.label])),
      choixCaracs: { "": "Aucune", ...Object.fromEntries(Object.entries(CARACS).map(([k, v]) => [k, v.labelLong ?? v.label])) },
      choixCibles: { "": "—", ...cibles },
      choixMoments: MOMENTS_ANIMATION,
      choixStyles: STYLES_ANIM_IMPLANT,
      cheminModifs: `system.niveaux.n${c.nv}.effet.modificateurs`,
      modifs: e.modificateurs.map((m, i) => ({ ...m, i })),
      lignesAmel: s.ameliorations.map((a, i) => ({ ...a, i })),
      lignesAnim: s.animations.map((a, i) => ({ ...a, i, nom: nomFichier(a.fichier) })),
      sons: [
        { label: "Son à l'activation", champ: "system.sons.activation", valeur: s.sons.activation, nom: nomFichier(s.sons.activation) },
        { label: "Son au toucher", champ: "system.sons.toucher", valeur: s.sons.toucher, nom: nomFichier(s.sons.toucher) }
      ],
      prefixe: `system.niveaux.n${c.nv}`,
      apercuDegats: s.armeIntegree ? s.formuleLisible(c.nv) : "",
      modeleAmel: JSON.stringify({ nom: "Nouvelle amélioration", prix: 500, cout: 3, effet: "", cible: "", valeur: 0 }),
      modeleAnim: JSON.stringify({ moment: "activation", style: "soi", fichier: "" })
    });
    return c;
  }
}

/* ============================================ */
/*  Amélioration d'implant et capsule           */
/* ============================================ */

export class CarteSousImplant extends CarteItem {

  static PARTS = {
    carte: { template: `${CHEMIN}/templates/item/carte-sous-implant.hbs` }
  };

  /** @override */
  async _prepareContext(options) {
    const c = await super._prepareContext(options);
    const item = this.item;
    const s = item.system;
    const capsule = item.type === "capsule";
    const cibles = ciblesModificateurs();
    const modifs = capsule ? [] : s.effet.modificateurs.map(m => `${signe(m.valeur)} ${(cibles[m.cible] ?? m.cible).replace(/^(Comp|Carac)\. · /, "")}`);
    const hote = s.hote;
    Object.assign(c, {
      capsule,
      reference: `CP2075 · ${capsule ? "CAP" : "AML"} · Rév.1`,
      typeLabel: capsule ? "Capsule · implant de bras" : "Amélioration d'implant",
      hote: hote?.name ?? null,
      prix: prix(s.prix),
      puces: capsule ? [
        { label: `Dégâts · ${TYPES_DEGATS[s.typeDegats]}`, valeur: `+${s.de}`, num: true, couleur: "jaune" },
        { label: "Coût", valeur: `+${s.coutInstallation}💀`, num: true },
        { label: "Prix", valeur: prix(s.prix), num: true }
      ] : [
        { label: "Effet", valeur: s.effet.description || "—" },
        { label: "Modificateur", valeur: modifs.join(" · ") || "—", num: !!modifs.length, couleur: modifs.length ? "jaune" : null },
        { label: "Coût", valeur: `+${s.coutInstallation}💀`, num: true }
      ],
      choixDegats: Object.fromEntries(Object.values(CAPSULES).map(v => [v.typeDegats, TYPES_DEGATS[v.typeDegats]])),
      choixCibles: cibles,
      cheminModifs: "system.effet.modificateurs",
      modifs: capsule ? [] : s.effet.modificateurs.map((m, i) => ({ ...m, i }))
    });
    return c;
  }
}

/* ============================================ */
/*  Talent                                      */
/* ============================================ */

const SOURCES_TALENT = { classe: "Classe", sousClasse: "Sous-classe", ultime: "Trait ultime", autre: "Autre" };

export class CarteTalent extends CarteItem {

  static PARTS = {
    carte: { template: `${CHEMIN}/templates/item/carte-talent.hbs` }
  };

  /** @override */
  async _prepareContext(options) {
    const c = await super._prepareContext(options);
    const s = this.item.system;
    const e = s.effet;
    const cibles = ciblesModificateurs();
    const modifs = e.modificateurs.map(m => `${signe(m.valeur)} ${(cibles[m.cible] ?? m.cible).replace(/^(Comp|Carac)\. · /, "")}`);
    const actif = e.type === "actif";
    const max = s.utilisationsMax;
    const puces = actif ? [
      { label: "Activation", valeur: ACTIVATIONS[e.activation] },
      { label: "Cibles", valeur: e.ciblesMax ? `${e.ciblesMax} max` : "—", num: !!e.ciblesMax },
      { label: "Durée", valeur: e.duree ? `${e.duree} tour${e.duree > 1 ? "s" : ""}` : "Instantané" },
      { label: "Utilisations", valeur: e.utilisations.periode === "illimite" ? "Illimité" : `${e.utilisations.periode === "bm" ? "BM fois" : `${e.utilisations.max}×`} ${PERIODES[e.utilisations.periode].replace(/^BM fois /, "").toLowerCase()}${(max !== null) && c.possedeParActeur ? ` · reste ${s.utilisationsRestantes}/${max}` : ""}` }
    ] : [
      { label: "Effet", valeur: e.description || "Passif" },
      { label: "Modificateur", valeur: modifs.join(" · ") || "—", num: !!modifs.length, couleur: modifs.length ? "jaune" : null }
    ];
    Object.assign(c, {
      reference: `CP2075 · TAL-${(SOURCES_TALENT[s.source] ?? "AUT").slice(0, 3).toUpperCase()} · Niv.${s.niveauObtention}`,
      sourceLabel: SOURCES_TALENT[s.source],
      actif,
      typeEffet: actif ? "actif" : "passif",
      puces,
      nbPuces: puces.length,
      modifsTexte: actif && modifs.length ? modifs.join(" · ") : null,
      choixSources: SOURCES_TALENT,
      choixSpeciaux: EFFETS_SPECIAUX,
      choixActivations: ACTIVATIONS,
      choixPeriodes: PERIODES,
      choixJets: TYPES_JET,
      choixCibles: cibles,
      cheminModifs: "system.effet.modificateurs",
      modifs: e.modificateurs.map((m, i) => ({ ...m, i })),
      prefixe: "system"
    });
    return c;
  }
}

/* ============================================ */
/*  Classe (carte mère)                         */
/* ============================================ */

export class CarteClasse extends CarteItem {

  static DEFAULT_OPTIONS = {
    classes: ["cp-carte-classe"],
    position: { width: 1000 },
    actions: {
      retirerReference: CarteClasse.#retirerReference
    }
  };

  static PARTS = {
    carte: { template: `${CHEMIN}/templates/item/carte-classe.hbs` }
  };

  /** @override */
  async _prepareContext(options) {
    const c = await super._prepareContext(options);
    const s = this.item.system;
    const parNiveau = {};
    for ( const t of s.talents ) (parNiveau[t.niveau] ??= []).push(t);
    Object.assign(c, {
      reference: `CP2075 · CLS-${this.item.name.normalize("NFD").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 6)} · Carte mère`,
      texteBonus: s.texteBonus,
      eddies: prix(s.eddies),
      piste: Array.from({ length: 10 }, (_, i) => {
        const n = i + 1;
        return { n, talent: !!parNiveau[n], maitrise: [2, 4, 6, 7, 9].includes(n), sousClasse: (n === 1) || (n === 5), ultime: n === 10 };
      }),
      talents: s.talents.map((t, i) => ({ ...t, i, ultime: t.niveau === 10 })).sort((a, b) => a.niveau - b.niveau),
      sousClasses: s.sousClasses.map((r, i) => ({ ...r, i })),
      nbSousClasses: s.sousClasses.length,
      niveauxTalents: [...new Set(s.talents.map(t => t.niveau))].sort((a, b) => a - b).join(" · ") || "—",
      bonusCaracs: Object.entries(CARACS).map(([cle, def]) => ({ cle, label: def.abrev, valeur: s.bonus[cle] ?? 0 }))
    });
    return c;
  }

  /** @override */
  async _surDepot(zone, item) {
    if ( zone.depot === "talent" ) {
      if ( item.type !== "talent" ) return ui.notifications.warn("Glisse un talent sur la piste.");
      const niveau = Number(zone.niveau) || item.system.niveauObtention || 3;
      return this._ajouterReference("system.talents", item, { niveau });
    }
    if ( zone.depot === "sousClasse" ) {
      if ( item.type !== "sousClasse" ) return ui.notifications.warn("Glisse une sous-classe.");
      const s = item.system;
      const comp = s.maitrises.map(m => m.competence ? COMPETENCES[m.competence]?.label : "au choix").filter(Boolean).join(" · ");
      const tal = s.talents.map(t => `Niv. ${t.niveau} ${t.nom}`).join(" · ");
      if ( !s.classeParente ) await item.update({ "system.classeParente": this.item.name }).catch(() => null);
      return this._ajouterReference("system.sousClasses", item, { resume: [comp, tal].filter(Boolean).join("\n") });
    }
  }

  static async #retirerReference(event, cible) {
    if ( !this.isEditable ) return;
    const chemin = cible.dataset.chemin;
    const liste = foundry.utils.deepClone(foundry.utils.getProperty(this.item.toObject(), chemin) ?? []);
    liste.splice(Number(cible.dataset.index), 1);
    return this.item.update({ [chemin]: liste });
  }
}

/* ============================================ */
/*  Sous-classe (barrette)                      */
/* ============================================ */

const CATEGORIES_PACK = {
  arme: "Arme", implant: "Implant", cyberAccessoire: "Cyber-accessoire", objet: "Objet",
  hack: "Hack", vehicule: "Véhicule", module: "Module de planque", autre: "Autre"
};

export class CarteSousClasse extends CarteItem {

  static DEFAULT_OPTIONS = {
    actions: {
      retirerReference: CarteSousClasse.#retirerReference
    }
  };

  static PARTS = {
    carte: { template: `${CHEMIN}/templates/item/carte-sous-classe.hbs` }
  };

  /** @override */
  async _prepareContext(options) {
    const c = await super._prepareContext(options);
    const s = this.item.system;
    const choixComp = Object.fromEntries(Object.entries(COMPETENCES).map(([k, v]) => [k, v.label]));
    const pack = s.pack.map((p, i) => ({
      ...p, i,
      precis: p.mode === "precis",
      categorieLabel: CATEGORIES_PACK[p.categorie] ?? p.categorie,
      prixMaxTexte: p.prixMax ? `≤ ${prix(p.prixMax)}` : "",
      aNiveau: ["arme", "implant", "objet"].includes(p.type),
      estImplant: p.type === "implant"
    }));
    Object.assign(c, {
      reference: `CP2075 · SCL-${(s.classeParente || "XXX").normalize("NFD").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 4)}-${this.item.name.normalize("NFD").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 3)} · Barrette`,
      maitrises: s.maitrises.map((m, i) => ({
        ...m, i, num: i + 1,
        label: m.competence ? COMPETENCES[m.competence]?.label : null,
        liste: m.choix ? m.choix.split(",").map(k => COMPETENCES[k.trim()]?.label).filter(Boolean).join(", ") : "toutes",
        choixSelect: Object.fromEntries((m.choix || "").split(",").filter(Boolean).map(k => [k.trim(), true]))
      })),
      packImplants: pack.filter(p => p.estImplant || (p.categorie === "implant") || (p.categorie === "cyberAccessoire")),
      packInventaire: pack.filter(p => !(p.estImplant || (p.categorie === "implant") || (p.categorie === "cyberAccessoire"))),
      pack,
      talents: s.talents.map((t, i) => ({ ...t, i })).sort((a, b) => a.niveau - b.niveau),
      choixComp: { "": "Au choix…", ...choixComp },
      listeComp: Object.entries(COMPETENCES).map(([k, v]) => ({ k, label: v.label })),
      choixModes: { precis: "Item précis", choix: "Au choix", gratuit: "Gratuit" },
      choixCategories: CATEGORIES_PACK,
      choixNiveaux: { 1: "Niv. 1", 2: "Niv. 2", 3: "Niv. 3" },
      modeleChoix: JSON.stringify({ mode: "choix", uuid: "", nom: "", resume: "", type: "", niveau: 1, quantite: 1, categorie: "arme", prixMax: 1000, texte: "" }),
      modeleGratuit: JSON.stringify({ mode: "gratuit", uuid: "", nom: "", resume: "", type: "", niveau: 1, quantite: 1, categorie: "module", prixMax: 0, texte: "" })
    });
    return c;
  }

  /** @override */
  async _surDepot(zone, item) {
    if ( zone.depot === "talent" ) {
      if ( item.type !== "talent" ) return ui.notifications.warn("Glisse un talent.");
      return this._ajouterReference("system.talents", item, { niveau: Number(zone.niveau) || 1 });
    }
    if ( zone.depot === "pack" ) {
      if ( ["classe", "sousClasse", "talent"].includes(item.type) ) return ui.notifications.warn("Le pack contient des implants, armes, objets…");
      return this._ajouterReference("system.pack", item, { mode: "precis", type: item.type, niveau: item.system.niveau ?? 1, quantite: 1, categorie: item.type, prixMax: 0, texte: "" });
    }
  }

  static async #retirerReference(event, cible) {
    if ( !this.isEditable ) return;
    const chemin = cible.dataset.chemin;
    const liste = foundry.utils.deepClone(foundry.utils.getProperty(this.item.toObject(), chemin) ?? []);
    liste.splice(Number(cible.dataset.index), 1);
    return this.item.update({ [chemin]: liste });
  }
}

/* ============================================ */
/*  Hack                                        */
/* ============================================ */

export class CarteHack extends CarteItem {

  static DEFAULT_OPTIONS = {
    actions: {
      testerHack: CarteHack.#testerHack
    }
  };

  static PARTS = {
    carte: { template: `${CHEMIN}/templates/item/carte-hack.hbs` }
  };

  /** @override */
  async _prepareContext(options) {
    const c = await super._prepareContext(options);
    const s = this.item.system;
    const typeDegats = TYPES_DEGATS[s.degats.type] ?? s.degats.type;
    const avecJet = s.defense === "glace";
    const puces = [
      { label: "Coût en RAM", valeur: s.variable.actif ? `${s.ram ? `${s.ram} + ` : ""}${s.variable.parUnite}/u` : s.ram, num: true, couleur: "glace" },
      { label: "Touche", valeur: avecJet ? (c.possedeParActeur ? `1d20 ${signe(s.scoreTouche)}` : `1d20 + ${s.competenceLabel}`) : "Sans jet", num: avecJet && c.possedeParActeur },
      { label: "Contre", valeur: avecJet ? "Glace" : "Aucune défense" },
      { label: "Dégâts", valeur: s.faitDegats ? [s.degats.organique && `${s.degats.organique}`, (s.degats.robot && (s.degats.robot !== s.degats.organique)) && `robot ${s.degats.robot}`].filter(Boolean).join(" · ") : (s.humanite.cible ? `+${s.humanite.cible}💀` : "—"), num: !s.faitDegats && !!s.humanite.cible, couleur: s.faitDegats ? "jaune" : (s.humanite.cible ? "rouge" : null) }
    ];
    const tags = [ACTIVATIONS[s.activation]];
    if ( s.duree ) tags.push(`${s.duree} tour${s.duree > 1 ? "s" : ""}`);
    if ( s.faitDegats ) tags.push(typeDegats);
    if ( s.humanite.lanceur ) tags.push(`+${s.humanite.lanceur}💀 au lanceur`);
    const fichier = (champ, label, type, defaut) => {
      const valeur = foundry.utils.getProperty(this.item, champ);
      return { champ, label, type, valeur, nom: nomFichier(valeur), defaut };
    };
    Object.assign(c, {
      reference: `CP2075 · HCK · ${s.coutTexte}`,
      puces,
      nbPuces: puces.length,
      tags,
      typeDegats,
      prixTexte: prix(s.prix),
      coutTexte: s.coutTexte,
      choixActivations: ACTIVATIONS,
      choixDefenses: { glace: "Glace", aucune: "Aucune (pas de jet)" },
      choixTypesDegats: TYPES_DEGATS,
      choixCompetences: Object.fromEntries(Object.entries(COMPETENCES).map(([k, v]) => [k, v.label])),
      fichiers: [
        fichier("system.animation.impact", "Animation d'effet", "imagevideo", nomFichier(s.impactEffectif) || "aucune"),
        fichier("system.animation.son", "Son", "audio", "aucun")
      ]
    });
    return c;
  }

  static async #testerHack() {
    const source = canvas?.tokens?.controlled[0];
    if ( !source ) return ui.notifications.warn("Sélectionne un token sur la scène pour tester les animations.");
    const s = this.item.system;
    const cibles = Array.from(game.user.targets);
    if ( !cibles.length ) return ui.notifications.warn("Cible au moins un token (touche T) pour tester le hack.");
    const base = { scene: canvas.scene.id, source: source.id, cibles: cibles.map(t => t.id), touches: cibles.map(t => t.id), point: null, rayon: 0, style: "impact" };
    if ( s.glitch ) await jouerAnimation({ ...base, impact: s.glitch, son: s.animation.son });
    if ( s.impactEffectif ) await jouerAnimation({ ...base, impact: s.impactEffectif, son: s.glitch ? "" : s.animation.son });
  }
}

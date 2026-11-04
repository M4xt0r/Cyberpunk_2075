import {
  CHEMIN, CARACS, COMPETENCES, NIVEAUX, TYPES_ARME, REGLES_ARME, TYPES_DEGATS, DEFENSES, STYLES_ANIMATION,
  ACTIVATIONS, PERIODES, CATEGORIES_OBJET, QUALITES, TYPES_JET, ciblesModificateurs
} from "../config.mjs";
import { signe } from "../dice/jets.mjs";

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
      supprimerModif: CarteItem.#supprimerModif
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
      caracLabel: CARACS[s.carac]?.label ?? "—",
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
      choixCaracs: Object.fromEntries(Object.entries(CARACS).map(([k, v]) => [k, v.labelLong ?? v.label])),
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

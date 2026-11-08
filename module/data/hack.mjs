/**
 * Hack : coût en RAM (fixe ou variable), jet 1d20 + Piratage contre la Glace,
 * dégâts organique / robot, Humanité infligée à la cible ou au lanceur.
 * Les hacks n'ont pas de niveau et occupent chacun un emplacement de hack.
 */
import { ANIM, IMPACT_PAR_DEGATS, COMPETENCES } from "../config.mjs";
import { ItemBase, entier, texte, choix, booleen } from "./champs.mjs";

const f = foundry.data.fields;
const chemin = cat => new f.FilePathField({ categories: cat, required: false, blank: true, initial: "" });

export default class HackData extends ItemBase {
  static defineSchema() {
    return {
      description: new f.HTMLField({ required: true, initial: "" }),
      ambiance: texte(""),
      prix: entier(0, { min: 0 }),
      ram: entier(0, { min: 0 }),
      variable: new f.SchemaField({
        actif: booleen(false),
        parUnite: entier(0, { min: 0 }),
        unite: texte("carré de 1,5 m")
      }),
      activation: choix("action", ["action", "bonus", "reaction"]),
      defense: choix("glace", ["glace", "aucune"]),
      competence: texte("piratage"),
      bonusTouche: entier(0),
      degats: new f.SchemaField({
        organique: texte(""),
        robot: texte(""),
        type: texte("electrique")
      }),
      humanite: new f.SchemaField({
        cible: entier(0),
        lanceur: entier(0)
      }),
      duree: entier(0, { min: 0 }),
      effet: texte(""),
      special: texte(""),
      animation: new f.SchemaField({
        glitch: booleen(true),
        impact: chemin(["VIDEO", "IMAGE"]),
        son: chemin(["AUDIO"])
      })
    };
  }

  /** Coût en RAM pour une quantité donnée (hack à RAM variable). */
  cout(quantite = 0) {
    return this.ram + (this.variable.actif ? (this.variable.parUnite * Math.max(0, quantite)) : 0);
  }

  /** Texte du coût, ex. « 4 RAM » ou « 2 RAM par carré de 1,5 m ». */
  get coutTexte() {
    if ( !this.variable.actif ) return `${this.ram} RAM`;
    const base = this.ram ? `${this.ram} + ` : "";
    return `${base}${this.variable.parUnite} RAM par ${this.variable.unite}`;
  }

  /** Score de piratage du lanceur (plus le bonus du hack). */
  get scoreTouche() {
    const s = this.porteur?.system;
    return (s?.competences?.[this.competence]?.score ?? 0) + this.bonusTouche;
  }

  get competenceLabel() {
    return COMPETENCES[this.competence]?.label ?? "Piratage";
  }

  get faitDegats() {
    return !!(this.degats.organique || this.degats.robot);
  }

  /** Formule de dégâts selon la nature de la cible. */
  formulePour(nature) {
    if ( nature === "robot" ) return this.degats.robot || this.degats.organique;
    return this.degats.organique || this.degats.robot;
  }

  /** Résumé court pour la fiche. */
  get resume() {
    const t = [];
    if ( this.degats.organique ) t.push(this.degats.organique);
    if ( this.degats.robot && (this.degats.robot !== this.degats.organique) ) t.push(`${this.degats.robot} sur robot`);
    if ( this.humanite.cible ) t.push(`+${this.humanite.cible}💀 à la cible`);
    if ( this.humanite.lanceur ) t.push(`+${this.humanite.lanceur}💀 au lanceur`);
    if ( !t.length && this.effet ) t.push(this.effet);
    return t.join(" · ");
  }

  /** Impact propre au hack (après le glitch commun) : fichier choisi, sinon selon le type de dégâts. */
  get impactEffectif() {
    if ( this.animation.impact ) return this.animation.impact;
    const defaut = this.faitDegats ? IMPACT_PAR_DEGATS[this.degats.type] : null;
    return defaut ? `${ANIM}/${defaut}` : "";
  }

  /** Ping : jet contre la Glace de tous les ennemis de la scène, marqueurs sur ceux détectés. */
  get estPing() {
    const nom = (this.parent?.name ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
    return (this.special === "ping") || (nom === "ping");
  }

  get glitch() {
    return this.animation.glitch ? `${ANIM}/impacts/glitch.webm` : "";
  }
}

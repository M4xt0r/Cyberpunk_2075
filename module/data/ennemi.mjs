/**
 * Ennemi : fiche compacte, sur le modèle des stat blocks Notion.
 * Les 5 caractéristiques sont saisies en bonus (+0, +2, −1…) ; Vie, Adaptabilité, Glace et RAM
 * en découlent (valeur = bonus + 5) et peuvent être forcées. Les items portent un build
 * (A, B ou commun) : seuls les items du build choisi comptent.
 */
import { CARACS, COMPETENCES, COUVERTS } from "../config.mjs";

const f = foundry.data.fields;
const entier = (initial = 0, options = {}) => new f.NumberField({ required: true, nullable: false, integer: true, initial, ...options });
const forcable = () => new f.NumberField({ required: false, nullable: true, integer: true, initial: null });
const texte = (initial = "") => new f.StringField({ required: true, blank: true, initial });

/** Build d'un item posé sur un ennemi : "" (commun), "A" ou "B". */
export const buildDe = item => item?.flags?.cyberpunk2075?.build ?? "";

/** L'item compte-t-il dans le build actif de son ennemi ? */
export function dansBuild(item, build) {
  const b = buildDe(item);
  return !b || (b === build);
}

export const RANGS = {
  1: { label: "Recrue · membre", couleur: "niv1" },
  2: { label: "Vétéran", couleur: "niv2" },
  3: { label: "Sergent · chef", couleur: "niv3" }
};

export default class EnnemiData extends foundry.abstract.TypeDataModel {

  static defineSchema() {
    const caracs = {};
    for ( const cle of Object.keys(CARACS) ) caracs[cle] = new f.SchemaField({ bonus: entier(0, { min: -5, max: 5 }) });
    const jauge = (initial) => new f.SchemaField({
      value: entier(initial, { min: 0 }),
      max: entier(initial, { min: 0 }),
      forcer: forcable()
    });
    return {
      faction: texte(""),
      rang: texte(""),
      rangNiveau: entier(1, { min: 1, max: 3 }),
      nature: new f.StringField({ required: true, initial: "organique", choices: ["organique", "robot"] }),
      yeuxCyber: new f.StringField({ required: true, initial: "auto", choices: ["auto", "oui", "non"] }),
      volant: new f.BooleanField({ initial: false }),
      build: new f.StringField({ required: true, initial: "A", choices: ["A", "B"] }),

      caracs: new f.SchemaField(caracs),
      competencesCles: new f.ArrayField(new f.SchemaField({
        competence: texte("perception"),
        valeur: entier(0)
      }), { initial: [] }),

      vie: jauge(15),
      ram: jauge(8),
      humanite: new f.SchemaField({ value: entier(0, { min: 0 }), max: entier(100, { min: 1 }) }),
      adaptabilite: new f.SchemaField({ forcer: forcable() }),
      glace: new f.SchemaField({ forcer: forcable() }),
      attention: new f.SchemaField({ forcer: forcable() }),
      initiative: new f.SchemaField({ bonus: entier(0) }),
      deplacement: new f.SchemaField({ bonus: entier(0) }),
      reduction: entier(0, { min: 0 }),
      /** Types de dégâts que la réduction ne diminue pas (ex. Peau de métal : sauf électrique). */
      reductionSauf: new f.ArrayField(texte(""), { initial: [] }),
      /** Types de dégâts sans effet (ex. robot : poison). */
      immunites: new f.ArrayField(texte(""), { initial: [] }),
      bm: entier(2, { min: 0, max: 6 }),
      couvert: entier(0, { min: 0, max: 3 }),

      notes: new f.HTMLField({ required: true, initial: "" })
    };
  }

  /** Items du build actif. */
  get itemsActifs() {
    return (this.parent?.items ?? []).filter(i => dansBuild(i, this.build));
  }

  prepareDerivedData() {
    // Modificateurs des items du build actif
    const mods = {};
    const sources = {};
    for ( const item of this.itemsActifs ) {
      const liste = item.system?.modificateursActifs;
      if ( !Array.isArray(liste) ) continue;
      for ( const { cible, valeur } of liste ) {
        if ( !cible || !Number.isFinite(valeur) ) continue;
        mods[cible] = (mods[cible] ?? 0) + valeur;
        (sources[cible] ??= []).push(`${valeur >= 0 ? "+" : "−"}${Math.abs(valeur)} ${item.name}`);
      }
    }
    const mod = cle => mods[cle] ?? 0;
    this.modificateurs = mods;
    this.sourcesModificateurs = sources;

    // Caractéristiques : valeur = bonus + 5 (les implants « carac. » s'ajoutent)
    for ( const [cle, c] of Object.entries(this.caracs) ) {
      c.total = Math.clamp(c.bonus + 5 + mod(`carac.${cle}`), 0, 10);
      c.valeur = c.total;
      c.bonus = c.total - 5;
    }

    // Compétences : celles saisies (score de base), les autres = bonus de caractéristique
    const cles = new Map(this.competencesCles.filter(l => COMPETENCES[l.competence]).map(l => [l.competence, l.valeur]));
    this.competences = {};
    for ( const [cle, def] of Object.entries(COMPETENCES) ) {
      const base = cles.has(cle) ? cles.get(cle) : this.caracs[def.carac].bonus;
      const bonusObjets = mod(`comp.${cle}`);
      this.competences[cle] = { score: base + bonusObjets, base, cle: cles.has(cle), maitrise: false, bonusObjets, sources: sources[`comp.${cle}`] ?? [] };
    }

    this.maitrise = { valeur: this.bm, effectif: this.bm, perdue: false, forcer: null };
    this.stress = 0;
    this.niveau = 1;
    this.overclocking = false;
    this.violation = false;
    this.edgerunner = false;

    // Stats : base calculée (ou forcée, ex. Robot RMK2 30 PV), puis les implants du build
    const { const: con, ref, captec, int, safr } = this.caracs;
    this.vie.calcule = con.total + safr.total + 5;
    this.vie.base = this.vie.forcer ?? this.vie.calcule;
    this.vie.max = this.vie.base + mod("vieMax");
    this.ram.calcule = captec.total + int.total;
    this.ram.base = this.ram.forcer ?? this.ram.calcule;
    this.ram.max = this.ram.base + mod("ram");
    this.humanite.min = 0;

    const couvert = COUVERTS[this.couvert] ?? COUVERTS[0];
    this.adaptabilite.calcule = safr.total + ref.total;
    this.adaptabilite.base = this.adaptabilite.forcer ?? this.adaptabilite.calcule;
    this.adaptabilite.valeur = this.adaptabilite.base + couvert.adaptabilite + mod("adaptabilite");
    this.glace.calcule = int.total + safr.total;
    this.glace.base = this.glace.forcer ?? this.glace.calcule;
    this.glace.valeur = this.glace.base + mod("glace");
    this.attention.calcule = 10 + this.competences.perception.score;
    this.attention.valeur = (this.attention.forcer ?? this.attention.calcule) + mod("attention");
    this.initiative.valeur = this.initiative.bonus + mod("initiative");
    this.deplacement.valeur = 6 + this.deplacement.bonus + mod("deplacement");
    this.reductionTotale = this.reduction + Math.max(0, -mod("degatsRecus"));

    // Yeux cyber : automatique si un implant oculaire est dans le build
    this.yeuxCyberEffectif = (this.yeuxCyber === "auto")
      ? this.itemsActifs.some(i => (i.type === "implant") && (i.system.emplacement === "oculaire"))
      : (this.yeuxCyber === "oui");
    this.hacks = { slots: Math.max(0, mod("slotsHack")), utilises: this.itemsActifs.filter(i => i.type === "hack").length };
  }

  /**
   * Valeur de défense contre une attaque.
   * @param {"adaptabilite"|"glace"|"aucune"} type
   */
  defense(type) {
    if ( type === "adaptabilite" ) return this.adaptabilite.valeur;
    if ( type === "glace" ) return this.glace.valeur;
    return null;
  }
}

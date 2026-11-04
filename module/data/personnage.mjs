import { CARACS, COMPETENCES, COUVERTS, POINTS_CREATION, MAITRISES_DEPART, NIVEAUX_MAITRISE, bonusMaitrise } from "../config.mjs";

const f = foundry.data.fields;

/** Entier obligatoire. */
const entier = (initial = 0, options = {}) => new f.NumberField({ required: true, nullable: false, integer: true, initial, ...options });

/** Valeur qui peut remplacer un calcul (« ✎ forcer ») ; null = calculée. */
const forcable = () => new f.NumberField({ required: false, nullable: true, integer: true, initial: null });

/**
 * Données d'une fiche Personnage.
 * Champs saisis dans le schéma ; tout ce qui se calcule est ajouté dans prepareDerivedData.
 */
export default class PersonnageData extends foundry.abstract.TypeDataModel {

  static defineSchema() {
    const caracs = {};
    for ( const cle of Object.keys(CARACS) ) {
      caracs[cle] = new f.SchemaField({ valeur: entier(0, { min: 0, max: 10 }) });
    }
    const competences = {};
    for ( const cle of Object.keys(COMPETENCES) ) {
      competences[cle] = new f.SchemaField({
        maitrise: new f.BooleanField({ initial: false }),
        bonus: entier(0)
      });
    }
    /** Jauge suivie par les barres de token : value / max (noms imposés par Foundry). */
    const jauge = (initial) => new f.SchemaField({
      value: entier(initial, { min: 0 }),
      max: entier(initial, { min: 0 }),
      gains: entier(0),
      forcer: forcable()
    });

    return {
      caracs: new f.SchemaField(caracs),
      competences: new f.SchemaField(competences),
      niveau: entier(1, { min: 1, max: 10 }),
      nature: new f.StringField({ required: true, initial: "organique", choices: ["organique", "robot"] }),
      maitrise: new f.SchemaField({ forcer: forcable() }),

      vie: jauge(5),
      ram: jauge(0),
      humanite: jauge(0),

      adaptabilite: new f.SchemaField({ forcer: forcable() }),
      glace: new f.SchemaField({ forcer: forcable() }),
      attention: new f.SchemaField({ forcer: forcable() }),
      initiative: new f.SchemaField({ bonus: entier(0), forcer: forcable() }),
      deplacement: new f.SchemaField({ bonus: entier(0), forcer: forcable() }),

      couvert: entier(0, { min: 0, max: 3 }),
      stress: entier(0, { min: 0, max: 4 }),
      mort: new f.SchemaField({
        succes: entier(0, { min: 0, max: 3 }),
        echecs: entier(0, { min: 0, max: 3 })
      }),
      etat: new f.StringField({ required: true, initial: "stable", choices: ["stable", "rebours", "surLeFil", "cyberpsychose"] }),
      rebours: new f.SchemaField({
        de: new f.StringField({ required: true, initial: "1d4" }),
        tours: entier(0, { min: 0 }),
        malus: entier(0, { min: 0 })
      }),

      eddies: entier(0),

      bio: new f.SchemaField({
        histoire: new f.HTMLField({ required: true, initial: "" }),
        apparence: new f.HTMLField({ required: true, initial: "" }),
        notes: new f.HTMLField({ required: true, initial: "" })
      })
    };
  }

  /* -------------------------------------------- */

  /**
   * Somme des modificateurs passifs posés par les items, par cible.
   * Les items arrivent à l'étape 2 (Bloc Effet) : la structure est prête.
   * Clés : "carac.const", "comp.perception", "vieMax", "ram", "glace", "adaptabilite", "initiative", "deplacement", "attention".
   * @returns {{total: Record<string, number>, sources: Record<string, string[]>}}
   */
  _collecterModificateurs() {
    const total = {};
    const sources = {};
    const acteur = this.parent;
    for ( const item of acteur?.items ?? [] ) {
      const mods = item.system?.modificateursActifs;
      if ( !Array.isArray(mods) ) continue;
      for ( const { cible, valeur } of mods ) {
        if ( !cible || !Number.isFinite(valeur) ) continue;
        total[cible] = (total[cible] ?? 0) + valeur;
        (sources[cible] ??= []).push(`${valeur >= 0 ? "+" : "−"}${Math.abs(valeur)} ${item.name}`);
      }
    }
    return { total, sources };
  }

  /** Bonus de caractéristiques donnés par la classe posée sur la fiche. */
  _bonusClasse() {
    const classe = this.parent?.items?.find(i => i.type === "classe");
    const bonus = {};
    for ( const cle of Object.keys(CARACS) ) bonus[cle] = Number(classe?.system?.bonus?.[cle]) || 0;
    return { classe, bonus };
  }

  /* -------------------------------------------- */

  prepareDerivedData() {
    const { total: mods, sources } = this._collecterModificateurs();
    const mod = cle => mods[cle] ?? 0;
    this.modificateurs = mods;
    this.sourcesModificateurs = sources;

    // Caractéristiques : bonus = valeur − 5
    const { classe, bonus: bonusClasse } = this._bonusClasse();
    let pointsDepenses = 0;
    for ( const [cle, c] of Object.entries(this.caracs) ) {
      c.total = Math.clamp(c.valeur + mod(`carac.${cle}`), 0, 10);
      c.bonus = c.total - 5;
      c.bonusClasse = bonusClasse[cle];
      pointsDepenses += c.valeur - bonusClasse[cle];
    }
    this.points = { depenses: pointsDepenses, max: POINTS_CREATION, aClasse: !!classe };

    // Bonus de maîtrise (perdu au stress 2)
    this.maitrise.calcule = bonusMaitrise(this.niveau);
    this.maitrise.valeur = this.maitrise.forcer ?? this.maitrise.calcule;
    this.maitrise.perdue = this.stress >= 2;
    this.maitrise.effectif = this.maitrise.perdue ? 0 : this.maitrise.valeur;

    // Compétences
    let maitrisees = 0;
    for ( const [cle, comp] of Object.entries(this.competences) ) {
      const carac = this.caracs[COMPETENCES[cle].carac];
      const bonusObjets = comp.bonus + mod(`comp.${cle}`);
      comp.bonusObjets = bonusObjets;
      comp.score = carac.bonus + (comp.maitrise ? this.maitrise.effectif : 0) + bonusObjets;
      comp.sources = sources[`comp.${cle}`] ?? [];
      if ( comp.maitrise ) maitrisees++;
    }
    this.maitrises = {
      utilisees: maitrisees,
      max: MAITRISES_DEPART + NIVEAUX_MAITRISE.filter(n => n <= this.niveau).length
    };

    const { const: con, ref, captec, int, safr } = this.caracs;

    // Stats dérivées : calculées sur les VALEURS
    this.vie.calcule = con.total + safr.total + 5 + this.vie.gains + mod("vieMax");
    this.vie.max = this.vie.forcer ?? this.vie.calcule;
    this.ram.calcule = captec.total + int.total + this.ram.gains + mod("ram");
    this.ram.max = this.ram.forcer ?? this.ram.calcule;
    this.humanite.calcule = 100 + this.humanite.gains;
    this.humanite.max = this.humanite.forcer ?? this.humanite.calcule;
    this.humanite.min = this._minimumHumanite();
    const items = this.parent?.items ?? [];
    this.edgerunner = items.some(i => i.system?.special === "edgerunner");
    this.overclocking = items.some(i => i.system?.special === "overclocking");
    this.violation = items.some(i => i.system?.special === "violation");
    this.hacks = { slots: Math.max(0, mod("slotsHack")), utilises: items.filter(i => i.type === "hack").length };

    const couvert = COUVERTS[this.couvert] ?? COUVERTS[0];
    this.adaptabilite.calcule = safr.total + ref.total + couvert.adaptabilite + mod("adaptabilite");
    this.adaptabilite.valeur = this.adaptabilite.forcer ?? this.adaptabilite.calcule;
    this.glace.calcule = int.total + safr.total + mod("glace");
    this.glace.valeur = this.glace.forcer ?? this.glace.calcule;
    this.attention.calcule = 10 + this.competences.perception.score + mod("attention");
    this.attention.valeur = this.attention.forcer ?? this.attention.calcule;
    this.initiative.calcule = this.initiative.bonus + mod("initiative");
    this.initiative.valeur = this.initiative.forcer ?? this.initiative.calcule;
    this.deplacement.calcule = 6 + this.deplacement.bonus + mod("deplacement");
    this.deplacement.valeur = this.deplacement.forcer ?? this.deplacement.calcule;
  }

  /**
   * Valeur de défense contre une attaque.
   * @param {"adaptabilite"|"glace"|"aucune"} type
   * @returns {number|null}
   */
  defense(type) {
    if ( type === "adaptabilite" ) return this.adaptabilite.valeur;
    if ( type === "glace" ) return this.glace.valeur;
    return null;
  }

  /** Minimum d'Humanité = somme des 💀 d'installation des implants, améliorations et capsules posés. */
  _minimumHumanite() {
    let somme = 0;
    for ( const item of this.parent?.items ?? [] ) {
      if ( !["implant", "ameliorationImplant", "capsule"].includes(item.type) ) continue;
      somme += Number(item.system?.coutInstallation) || 0;
    }
    return somme;
  }
}

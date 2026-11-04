/**
 * Véhicules et planques : deux acteurs, et leurs items (améliorations de véhicule, modules de planque).
 */
import { VITESSES, CATEGORIES_VEHICULE, TYPES_PLANQUE, QUALITES_PLANQUE, TYPES_ARME } from "../config.mjs";
import { ItemBase, champsCommuns, niveaux, blocEffet, entier, texte, choix, booleen } from "./champs.mjs";
import { MixinAttaque, champsAttaque, champsDegatsNiveau } from "./attaque-mixin.mjs";

const f = foundry.data.fields;
const forcable = () => new f.NumberField({ required: false, nullable: true, integer: true, initial: null });

/** Somme des modificateurs des items d'un acteur, par cible. */
function sommeModificateurs(items, types) {
  const total = {};
  const sources = {};
  for ( const item of items ?? [] ) {
    if ( types && !types.includes(item.type) ) continue;
    for ( const { cible, valeur } of item.system?.modificateursActifs ?? [] ) {
      if ( !cible || !Number.isFinite(valeur) ) continue;
      total[cible] = (total[cible] ?? 0) + valeur;
      (sources[cible] ??= []).push(`${valeur >= 0 ? "+" : "−"}${Math.abs(valeur)} ${item.name}`);
    }
  }
  return { total, sources };
}

/* ============================================ */
/*  Véhicule                                    */
/* ============================================ */

export class VehiculeData extends foundry.abstract.TypeDataModel {

  static defineSchema() {
    return {
      categorie: choix("voiture", Object.keys(CATEGORIES_VEHICULE)),
      pickup: booleen(false),
      blinde: booleen(false),
      armesInterdites: booleen(false),
      vitesse: choix("C", VITESSES),
      maniabilite: entier(0),
      vie: new f.SchemaField({ value: entier(40, { min: 0 }), base: entier(40, { min: 0 }) }),
      slots: entier(1, { min: 0 }),
      places: entier(2, { min: 0 }),
      placesNote: texte(""),
      prix: entier(0, { min: 0 }),
      ambiance: texte(""),
      pilote: texte(""),
      description: new f.HTMLField({ required: true, initial: "" })
    };
  }

  prepareDerivedData() {
    const items = this.parent?.items ?? [];
    const { total, sources } = sommeModificateurs(items, ["ameliorationVehicule"]);
    const mod = cle => total[cle] ?? 0;
    this.modificateurs = total;
    this.sourcesModificateurs = sources;

    this.vie.max = this.vie.base + mod("vieMax");
    this.detruit = this.vie.value <= 0;
    this.endommage = !this.detruit && (this.vie.value <= this.vie.max / 2);

    const base = VITESSES.indexOf(this.vitesse);
    this.vitesseIndex = Math.clamp(base + mod("vitesse") - (this.endommage ? 1 : 0), 0, VITESSES.length - 1);
    this.vitesseEffective = VITESSES[this.vitesseIndex];
    this.bonusVitesse = this.vitesseIndex;
    this.maniabiliteEffective = this.maniabilite + mod("maniabilite");
    this.adaptabilite = { valeur: 10 + this.maniabiliteEffective };
    this.glace = { valeur: null };

    const ameliorations = items.filter(i => i.type === "ameliorationVehicule");
    this.slotsUtilises = ameliorations.length;
    this.slotsPleins = this.slotsUtilises > this.slots;

    // Un véhicule n'a pas de stress ni de couvert
    this.stress = 0;
    this.couvert = 0;
  }

  /** Acteur du pilote (lié par UUID). */
  get piloteActeur() {
    if ( !this.pilote ) return null;
    try { return fromUuidSync(this.pilote, { strict: false }) ?? null; } catch { return null; }
  }

  /** Les armes du véhicule utilisent les compétences et caractéristiques du pilote. */
  get competences() {
    return this.piloteActeur?.system?.competences ?? {};
  }

  get caracs() {
    return this.piloteActeur?.system?.caracs ?? {};
  }

  get maitrise() {
    return this.piloteActeur?.system?.maitrise ?? { valeur: 2, effectif: 2 };
  }

  defense(type) {
    if ( type === "adaptabilite" ) return this.adaptabilite.valeur;
    return null;
  }
}

/* ============================================ */
/*  Planque                                     */
/* ============================================ */

export class PlanqueData extends foundry.abstract.TypeDataModel {

  static defineSchema() {
    return {
      type: choix("appartement", Object.keys(TYPES_PLANQUE)),
      niveau: entier(1, { min: 1, max: 2 }),
      qualite: choix("miteux", Object.keys(QUALITES_PLANQUE)),
      modulesForces: forcable(),
      parkingForce: forcable(),
      barman: booleen(false),
      adresse: texte(""),
      description: new f.HTMLField({ required: true, initial: "" })
    };
  }

  prepareDerivedData() {
    const items = this.parent?.items ?? [];
    const { total, sources } = sommeModificateurs(items, ["modulePlanque"]);
    const mod = cle => total[cle] ?? 0;
    const def = TYPES_PLANQUE[this.type] ?? TYPES_PLANQUE.appartement;
    const nv = def.niveaux[this.niveau] ?? def.niveaux[1];
    this.definition = def;
    this.modificateurs = total;
    this.sourcesModificateurs = sources;

    const modules = items.filter(i => i.type === "modulePlanque");
    // Module de Vie : d'office dans un Appartement, sans prendre d'emplacement
    const horsSlot = i => def.vieOffice && i.system.vieOffice;
    this.modules = {
      max: this.modulesForces ?? nv.modules,
      utilises: modules.filter(i => !horsSlot(i)).length
    };
    this.modules.pleins = this.modules.utilises > this.modules.max;
    this.parking = (this.parkingForce ?? nv.parking) + mod("parking");
    this.hebergement = mod("hebergement");
    this.prixTotal = nv.prix + (QUALITES_PLANQUE[this.qualite]?.prix ?? 0);
    this.revenu = nv.revenu ?? 0;
  }

  /**
   * Modificateurs que la planque donne aux personnages présents
   * (Charcudoc, NetRunner, Mécano…), sans ceux de la planque elle-même.
   */
  get bonusOccupants() {
    const liste = [];
    for ( const item of this.parent?.items ?? [] ) {
      if ( item.type !== "modulePlanque" ) continue;
      for ( const m of item.system.modificateursActifs ) {
        if ( ["parking", "hebergement"].includes(m.cible) ) continue;
        liste.push({ ...m, source: item.name });
      }
    }
    return liste;
  }
}

/* ============================================ */
/*  Amélioration de véhicule                    */
/* ============================================ */

export class AmeliorationVehiculeData extends MixinAttaque(ItemBase) {

  static defineSchema() {
    return {
      ...champsCommuns(),
      ...champsAttaque(),
      armeIntegree: booleen(false),
      typeArmeIntegree: choix("autre", Object.keys(TYPES_ARME)),
      pickupSeulement: booleen(false),
      niveaux: niveaux(() => ({
        prix: entier(0, { min: 0 }),
        effet: blocEffet(),
        ...champsDegatsNiveau()
      }))
    };
  }

  /** @override */
  get typeArme() {
    return this.typeArmeIntegree;
  }

  get effet() {
    return this.n?.effet;
  }

  /** @override */
  get modificateursActifs() {
    const e = this.effet;
    if ( !e || (e.type !== "passif") ) return [];
    return e.modificateurs.filter(m => m.cible && m.valeur);
  }

  /** Raison pour laquelle cette amélioration ne va pas sur ce véhicule (ou null). */
  incompatibilite(vehicule) {
    const s = vehicule?.system;
    if ( !s ) return null;
    if ( this.pickupSeulement && !s.pickup ) return "seulement sur un pick-up";
    if ( this.armeIntegree && s.armesInterdites ) return "pas d'arme sur ce véhicule";
    return null;
  }
}

/* ============================================ */
/*  Module de planque                           */
/* ============================================ */

export class ModulePlanqueData extends ItemBase {

  static defineSchema() {
    return {
      ...champsCommuns(),
      /** Types de planque autorisés (vide = tous), ex. Mécano : garage, hangar. */
      types: new f.ArrayField(texte(""), { initial: [] }),
      vieOffice: booleen(false),
      niveaux: niveaux(() => ({
        prix: entier(0, { min: 0 }),
        effet: blocEffet()
      }))
    };
  }

  get effet() {
    return this.n?.effet;
  }

  /** @override */
  get modificateursActifs() {
    const e = this.effet;
    if ( !e ) return [];
    return e.modificateurs.filter(m => m.cible && m.valeur);
  }

  incompatibilite(planque) {
    const t = planque?.system?.type;
    if ( !t || !this.types.length || this.types.includes(t) ) return null;
    return `seulement dans : ${this.types.map(k => TYPES_PLANQUE[k]?.label ?? k).join(", ")}`;
  }
}

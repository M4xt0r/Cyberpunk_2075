import { CARACS, COMPETENCES, TYPES_ARME, NIVEAUX, ANIM, IMPACT_PAR_DEGATS, SON, SONS_TIR } from "../config.mjs";
import { blocAnimation, entier, texte, booleen } from "./champs.mjs";

const f = foundry.data.fields;

/** Caractéristique aux dégâts : une des 5, ou aucune (""). */
export const champCarac = (initial = "safr") => new f.StringField({ required: true, blank: true, initial, choices: ["", ...Object.keys(CARACS)] });

/** Champs du Bloc Attaque communs aux armes et aux implants à arme intégrée. */
export function champsAttaque() {
  return {
    competence: texte("armeDePoing"),
    carac: champCarac(),
    portee: new f.NumberField({ required: false, nullable: true, integer: false, min: 0, initial: null }),
    attaque: new f.SchemaField({
      faitDegats: booleen(true),
      defense: new f.StringField({ required: true, initial: "adaptabilite", choices: ["adaptabilite", "glace", "aucune"] }),
      bonusTouche: entier(0),
      zone: new f.NumberField({ required: false, nullable: true, integer: false, min: 0, initial: null }),
      /** Durée de la zone en tours (formule, ex. « 1d6 ») : la zone reste sur la scène (nuage toxique…). */
      dureeZone: texte(""),
      /** Dégâts doublés contre les véhicules (et bâtiments) : C4. */
      doubleVehicules: booleen(false),
      /** Dégâts seulement sur les robots (et véhicules) : grenade IEM. */
      robotsSeulement: booleen(false),
      /** Jet d'effet comparé à l'Attention de chaque cible (ex. « 1d20 + Explosif » : flashbang). */
      jetEffet: texte(""),
      /** Effet subi par les cibles (ex. « Aveuglé 1 tour »). */
      effetTexte: texte(""),
      animation: blocAnimation()
    })
  };
}

/** Champs de dégâts d'un niveau. */
export function champsDegatsNiveau() {
  return {
    de: texte("1d6"),
    bonusFixe: entier(0),
    typeDegats: texte("balle")
  };
}

/**
 * Calculs d'attaque partagés. La classe doit fournir `typeArme`.
 * @param {typeof foundry.abstract.TypeDataModel} Base
 */
export const MixinAttaque = Base => class extends Base {

  /** Type d'arme (pistolet, corps à corps…). */
  get typeArme() {
    return "autre";
  }

  get definitionType() {
    return TYPES_ARME[this.typeArme] ?? TYPES_ARME.autre;
  }

  /** Quantité en stock (les grenades se consomment). */
  get stock() {
    return this.quantite ?? 1;
  }

  /** Dé de critique selon le niveau possédé. */
  get deCritique() {
    return NIVEAUX[this.niveauEffectif]?.critique ?? "1d6";
  }

  /** Dés de dégâts en plus (capsules d'un implant de bras). */
  get degatsSupplementaires() {
    return [];
  }

  /** Formule lisible des dégâts, ex. « 1d6+1+SaFr ». */
  formuleLisible(niveau = this.niveauEffectif) {
    const n = this.niveaux[`n${this.aNiveaux ? niveau : 1}`];
    const fixe = n.bonusFixe ? `${n.bonusFixe > 0 ? "+" : "−"}${Math.abs(n.bonusFixe)}` : "";
    const carac = CARACS[this.carac] ? `+${CARACS[this.carac].abrev}` : "";
    const plus = this.degatsSupplementaires.map(d => `+${d.de}`).join("");
    // Sans dé (coup de poing) : seulement la caractéristique
    const de = (n.de && (n.de !== "0")) ? n.de : "";
    return `${de}${fixe}${carac}${plus}`.replace(/^\+/, "") || "—";
  }

  /** Score au toucher chez le porteur (compétence + bonus de l'arme + modificateurs « touche »). */
  get scoreTouche() {
    const s = this.porteur?.system;
    const comp = s?.competences?.[this.competence]?.score ?? 0;
    return comp + this.attaque.bonusTouche + (s?.modificateurs?.touche ?? 0);
  }

  get competenceLabel() {
    return COMPETENCES[this.competence]?.label ?? "—";
  }

  /** Animation effective : champs de l'item, sinon défauts du type. */
  get animationEffective() {
    const a = this.attaque.animation;
    const def = this.definitionType.anim;
    const typeDegats = this.n?.typeDegats;
    const chemin = (val, defaut) => val || (defaut ? `${ANIM}/${defaut}` : "");
    const impactDefaut = def.impact ?? (this.typeArme === "corpsACorps" ? null : IMPACT_PAR_DEGATS[typeDegats]);
    // Arme à tir explosif avec zone (Lance-projectile, missiles) : roquette puis explosion
    const explosive = (def.style === "projectile") && (this.attaque.zone > 0) && (typeDegats === "explosion");
    // Grenades : projectile et zone selon l'effet (gaz, IEM, flash, explosion)
    const grenade = (this.typeArme === "grenade") ? this.varianteGrenade : null;
    return {
      style: a.style || (explosive ? "projectileZone" : def.style),
      projectile: chemin(a.projectile, explosive ? "projectiles/roquette.png" : (grenade?.projectile ?? def.projectile)),
      impact: chemin(a.impact, (explosive || grenade) ? null : impactDefaut),
      zone: chemin(a.zone, explosive ? "zones/explosion.webm" : (grenade?.zone ?? def.zone)),
      son: a.son,
      // Son du tir (le son choisi sur la carte le remplace) et rafale de 2 balles pour les mitraillettes
      tir: SONS_TIR[explosive ? "roquette" : this.typeArme] ? `${SON}/${SONS_TIR[explosive ? "roquette" : this.typeArme]}` : "",
      rafale: (this.typeArme === "mitraillette") ? 2 : 1
    };
  }

  /** Animation en boucle d'une zone persistante (le nuage qui reste sur la scène). */
  get zoneBoucle() {
    if ( this.attaque.animation?.zone ) return "";
    return (this.n?.typeDegats === "poison") ? `${ANIM}/zones/nuage_toxique_boucle.webm` : "";
  }

  /** Variante visuelle d'une grenade. */
  get varianteGrenade() {
    const t = this.n?.typeDegats;
    if ( t === "poison" ) return { projectile: "projectiles/grenade_gaz.png", zone: "zones/nuage_toxique.webm" };
    if ( (t === "iem") || (t === "electrique") ) return { projectile: "projectiles/grenade_iem.png", zone: "zones/iem.webm" };
    if ( !this.attaque.faitDegats ) return { projectile: "projectiles/grenade_flash.png", zone: "zones/flash.webm" };
    return { projectile: "projectiles/grenade.png", zone: "zones/explosion.webm" };
  }

  /** Durée de la zone persistante (formule) : celle de la carte, sinon 1d6 tours pour une grenade toxique. */
  get dureeZoneEffective() {
    if ( !this.attaque.zone ) return "";
    if ( this.attaque.dureeZone ) return this.attaque.dureeZone;
    return ((this.typeArme === "grenade") && (this.n?.typeDegats === "poison")) ? "Explosif" : "";
  }
};

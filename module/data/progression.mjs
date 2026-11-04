/**
 * Talents, classes et sous-classes.
 * Classes et sous-classes référencent leurs talents (et les items du pack) par UUID :
 * ils sont copiés sur la fiche au bon niveau.
 */
import { CARACS } from "../config.mjs";
import { ItemBase, blocEffet, entier, texte, choix, booleen } from "./champs.mjs";
import { utilisationsMax } from "./implant.mjs";

const f = foundry.data.fields;
const html = () => new f.HTMLField({ required: true, initial: "" });

/** Référence vers un item (talent, sous-classe, item du pack). */
const reference = (champs = {}) => new f.SchemaField({
  uuid: texte(""),
  nom: texte(""),
  resume: texte(""),
  ...champs
});

/* ============================================ */
/*  Talent                                      */
/* ============================================ */

export class TalentData extends ItemBase {
  static defineSchema() {
    return {
      description: html(),
      ambiance: texte(""),
      source: choix("classe", ["classe", "sousClasse", "ultime", "autre"]),
      niveauObtention: entier(1, { min: 1, max: 10 }),
      special: texte(""),
      effet: blocEffet(),
      usages: new f.SchemaField({ utilises: entier(0, { min: 0 }) }),
      actif: new f.SchemaField({ enCours: booleen(false), tours: entier(0, { min: 0 }) })
    };
  }

  get estActif() {
    return this.effet.type === "actif";
  }

  /** @override */
  get modificateursActifs() {
    if ( this.estActif && !this.actif.enCours ) return [];
    return this.effet.modificateurs.filter(m => m.cible && m.valeur);
  }

  get utilisationsMax() {
    return utilisationsMax(this);
  }

  get utilisationsRestantes() {
    const max = this.utilisationsMax;
    return (max === null) ? null : Math.max(0, max - this.usages.utilises);
  }

  /** Résumé court pour les cartes de classe. */
  get resume() {
    const brut = this.effet.description || String(this.description ?? "").replace(/<[^>]+>/g, " ");
    const t = brut.replace(/\s+/g, " ").trim();
    return t.length > 120 ? `${t.slice(0, 117)}…` : t;
  }
}

/* ============================================ */
/*  Classe                                      */
/* ============================================ */

export class ClasseData extends ItemBase {
  static defineSchema() {
    const bonus = {};
    for ( const cle of Object.keys(CARACS) ) bonus[cle] = entier(0);
    return {
      description: html(),
      ambiance: texte(""),
      bonus: new f.SchemaField(bonus),
      eddies: entier(0, { min: 0 }),
      gains: new f.SchemaField({ vie: texte("0"), ram: texte("0"), humanite: texte("0") }),
      talents: new f.ArrayField(reference({ niveau: entier(3, { min: 1, max: 10 }) })),
      sousClasses: new f.ArrayField(reference())
    };
  }

  /** Texte des bonus, ex. « +2 Const · +1 SaFr ». */
  get texteBonus() {
    const t = Object.entries(this.bonus).filter(([, v]) => v).map(([k, v]) => `${v > 0 ? "+" : "−"}${Math.abs(v)} ${CARACS[k].abrev}`);
    return t.join(" · ") || "—";
  }
}

/* ============================================ */
/*  Sous-classe                                 */
/* ============================================ */

export class SousClasseData extends ItemBase {
  static defineSchema() {
    return {
      description: html(),
      ambiance: texte(""),
      classeParente: texte(""),
      maitrises: new f.ArrayField(new f.SchemaField({
        competence: texte(""),   // vide = au choix
        choix: texte("")          // clés permises, séparées par des virgules
      }), { initial: () => [{ competence: "", choix: "" }, { competence: "", choix: "" }, { competence: "", choix: "" }] }),
      pack: new f.ArrayField(reference({
        mode: choix("precis", ["precis", "choix", "gratuit"]),
        type: texte(""),
        niveau: entier(1, { min: 1, max: 3 }),
        quantite: entier(1, { min: 1 }),
        categorie: texte("arme"),
        prixMax: entier(0, { min: 0 }),
        texte: texte("")
      })),
      talents: new f.ArrayField(reference({ niveau: entier(1, { min: 1, max: 10 }) }))
    };
  }
}

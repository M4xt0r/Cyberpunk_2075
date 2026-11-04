/**
 * Constantes du système Cyberpunk 2075.
 * Notion reste la source de vérité des règles : ce fichier n'en est que la traduction.
 */

export const ID_SYSTEME = "cyberpunk2075";
export const CHEMIN = `systems/${ID_SYSTEME}`;
export const ANIM = `${CHEMIN}/assets/animations`;

/** Les 5 caractéristiques, dans l'ordre de la fiche. */
export const CARACS = {
  const: { label: "Constitution", abrev: "Const", icone: "const" },
  ref: { label: "Réflexes", abrev: "Réf", icone: "ref" },
  captec: { label: "Cap. Tech.", labelLong: "Capacité Technique", abrev: "CapTec", icone: "captec" },
  int: { label: "Intelligence", abrev: "Int", icone: "int" },
  safr: { label: "Sang-Froid", abrev: "SaFr", icone: "safr" }
};

/** Les compétences et leur caractéristique. */
export const COMPETENCES = {
  athletisme: { label: "Athlétisme", carac: "const" },
  corpsACorps: { label: "Corps à corps", carac: "const" },
  armeLourde: { label: "Arme lourde", carac: "const" },
  intimidation: { label: "Intimidation", carac: "const" },
  discretion: { label: "Discrétion", carac: "ref" },
  acrobatie: { label: "Acrobatie", carac: "ref" },
  larcin: { label: "Larcin", carac: "ref" },
  armeDePoing: { label: "Arme de poing", carac: "ref" },
  sniper: { label: "Sniper", carac: "ref" },
  pilotage: { label: "Pilotage", carac: "captec" },
  explosif: { label: "Explosif", carac: "captec" },
  charcutage: { label: "Charcutage", carac: "captec" },
  tech: { label: "Tech", carac: "captec" },
  savoir: { label: "Savoir", carac: "int" },
  piratage: { label: "Piratage", carac: "int" },
  medecine: { label: "Médecine", carac: "int" },
  investigation: { label: "Investigation", carac: "int" },
  perception: { label: "Perception", carac: "safr" },
  persuasion: { label: "Persuasion", carac: "safr" },
  tromperie: { label: "Tromperie", carac: "safr" },
  negociation: { label: "Négociation", carac: "safr" },
  spectacle: { label: "Spectacle", carac: "safr" },
  survie: { label: "Survie", carac: "safr" }
};

/** Points à répartir dans les caractéristiques à la création (hors bonus de classe). */
export const POINTS_CREATION = 27;

/** Maîtrises : 6 au niveau 1 (3 de la sous-classe, 3 au choix), puis une à ces niveaux. */
export const MAITRISES_DEPART = 6;
export const NIVEAUX_MAITRISE = [2, 4, 6, 7, 9];

/** Bonus de maîtrise selon le niveau. */
export function bonusMaitrise(niveau) {
  if ( niveau >= 9 ) return 4;
  if ( niveau >= 5 ) return 3;
  return 2;
}

/** Couverts : 0 aucun, 1 partiel, 2 important, 3 total. */
export const COUVERTS = [
  { label: "Aucun", adaptabilite: 0, malusTir: 0 },
  { label: "Partiel", adaptabilite: 2, malusTir: -1 },
  { label: "Important", adaptabilite: 4, malusTir: -2 },
  { label: "Total", adaptabilite: 8, malusTir: -4 }
];

/** Effets du stress (cumulatifs). */
export const STRESS = {
  1: "Désavantage aux jets d'attaque et de piratage",
  2: "+10 à la jauge d'Humanité, perte du bonus de maîtrise",
  3: "+30 à la jauge d'Humanité",
  4: "Mort"
};

export const NATURES = { organique: "Organique", robot: "Robot" };

export const ETATS = {
  stable: { label: "Stable", couleur: "vert" },
  rebours: { label: "Compte à rebours", couleur: "orange" },
  surLeFil: { label: "Sur le fil", couleur: "orange" },
  cyberpsychose: { label: "Cyberpsychose", couleur: "rouge" }
};

/** Échelle de DD par défaut. */
export const DD = [
  { valeur: 10, label: "Facile" },
  { valeur: 15, label: "Moyen" },
  { valeur: 20, label: "Difficile" },
  { valeur: 25, label: "Quasi impossible" }
];

/* -------------------------------------------- */
/*  Items                                       */
/* -------------------------------------------- */

/** Couleurs et dés de critique des niveaux d'items. */
export const NIVEAUX = {
  1: { label: "Niv. 1", couleur: "niv1", critique: "1d6" },
  2: { label: "Niv. 2", couleur: "niv2", critique: "1d8" },
  3: { label: "Niv. 3", couleur: "niv3", critique: "1d10" }
};

/** Types d'armes : compétence par défaut, animation par défaut, code de marquage. */
export const TYPES_ARME = {
  pistolet: { label: "Pistolet", competence: "armeDePoing", code: "PST", anim: { style: "projectile", projectile: "projectiles/balle.png" }, degats: "balle" },
  corpsACorps: { label: "Corps à corps", competence: "corpsACorps", code: "CAC", anim: { style: "impact", impact: "impacts/coup_tranchant.webm" }, degats: "corpsACorps" },
  mitraillette: { label: "Mitraillette", competence: "armeLourde", code: "MIT", anim: { style: "projectile", projectile: "projectiles/balle.png" }, degats: "balle" },
  pompe: { label: "Fusil à pompe", competence: "armeLourde", code: "PMP", anim: { style: "projectile", projectile: "projectiles/chevrotine.png" }, degats: "balle", portee: 15 },
  sniper: { label: "Sniper", competence: "sniper", code: "SNP", anim: { style: "projectile", projectile: "projectiles/balle.png" }, degats: "balle" },
  grenade: { label: "Grenade", competence: "explosif", code: "GRN", anim: { style: "projectileZone", projectile: "projectiles/grenade.png", zone: "zones/explosion.webm" }, degats: "explosion", zone: 5, defense: "aucune" },
  autre: { label: "Autre", competence: "armeLourde", code: "AUT", anim: { style: "projectile", projectile: "projectiles/balle.png" }, degats: "balle" }
};

/** Règles automatiques rappelées sur la carte et dans le chat. */
export const REGLES_ARME = {
  mitraillette: "Une attaque supplémentaire si l'action principale a servi à tirer avec ; ne consomme pas l'action bonus.",
  pompe: "Portée 15 m : au-delà, la moitié des dégâts.",
  sniper: "Toujours critique en cas de réussite.",
  grenade: "Dégâts de zone, consommée au lancer."
};

export const TYPES_DEGATS = {
  balle: "Balle",
  corpsACorps: "Corps à corps",
  electrique: "Électrique",
  feu: "Feu",
  poison: "Poison",
  iem: "IEM",
  explosion: "Explosion"
};

/** Impact par défaut selon le type de dégâts (si l'item n'en fixe pas). */
export const IMPACT_PAR_DEGATS = {
  electrique: "impacts/electricite.webm",
  feu: "impacts/flammes.webm",
  poison: "impacts/poison.webm",
  iem: "zones/iem.webm"
};

export const DEFENSES = { adaptabilite: "Adaptabilité", glace: "Glace", aucune: "Aucune (dégâts automatiques)" };

export const STYLES_ANIMATION = {
  aucune: "Aucune",
  projectile: "Projectile",
  impact: "Impact sur la cible",
  zone: "Zone",
  projectileImpact: "Projectile puis impact",
  projectileZone: "Projectile puis zone",
  soi: "Sur soi"
};

export const ACTIVATIONS = { action: "Action", bonus: "Action bonus", reaction: "Réaction" };

export const PERIODES = {
  illimite: "Illimité",
  combat: "Par combat",
  repos: "Par repos long",
  jour: "Par jour",
  bm: "BM fois (par repos long)"
};

export const CATEGORIES_OBJET = { utilitaire: "Utilitaire", consommable: "Consommable", domestique: "Domestique" };

/** Qualité de la nourriture : effet sur la jauge d'Humanité (Notion : −1 dès Bof, −1 par palier). */
export const QUALITES = {
  aucune: { label: "—", humanite: 0, prix: 0 },
  pourrie: { label: "Pourrie", humanite: 0, prix: 15 },
  bof: { label: "Bof", humanite: -1, prix: 25 },
  pasmal: { label: "Pas mal", humanite: -2, prix: 45 },
  bon: { label: "Bon", humanite: -3, prix: 105 },
  luxe: { label: "Luxe", humanite: -4, prix: 550 }
};

export const TYPES_JET = { degats: "Dégâts", soin: "Soin" };

/** Cibles possibles d'un modificateur (Bloc Effet). */
export function ciblesModificateurs() {
  const cibles = {
    vieMax: "PV max", ram: "RAM max", glace: "Glace", adaptabilite: "Adaptabilité",
    initiative: "Initiative", deplacement: "Déplacement (m)", attention: "Attention",
    touche: "Jets d'attaque", degats: "Dégâts infligés", degatsRecus: "Dégâts reçus", soinsRecus: "Soins reçus"
  };
  for ( const [cle, c] of Object.entries(CARACS) ) cibles[`carac.${cle}`] = `Carac. · ${c.labelLong ?? c.label}`;
  for ( const [cle, c] of Object.entries(COMPETENCES) ) cibles[`comp.${cle}`] = `Comp. · ${c.label}`;
  return cibles;
}

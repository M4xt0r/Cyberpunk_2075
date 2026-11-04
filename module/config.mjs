/**
 * Constantes du système Cyberpunk 2075.
 * Notion reste la source de vérité des règles : ce fichier n'en est que la traduction.
 */

export const ID_SYSTEME = "cyberpunk2075";
export const CHEMIN = `systems/${ID_SYSTEME}`;

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
  if (niveau >= 9) return 4;
  if (niveau >= 5) return 3;
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

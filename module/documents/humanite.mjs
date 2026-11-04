/**
 * Humanité, stress, repos long et jets de mort.
 *
 * États (document de conception) :
 *   Normal ──jauge ≥ max──▶ Compte à rebours (dé, −1 tour par hausse et par tour de combat)
 *   Compte à rebours ──compte à 0──▶ Cyberpsychose
 *   Compte à rebours ──jauge < max avant 0──▶ Sur le fil (le prochain dé perd 1 : 1d4−1, −2…)
 *   Sur le fil ──jauge ≥ max──▶ Compte à rebours
 *   Sur le fil ──repos long──▶ Normal
 *   Cyberpsychose : sortie manuelle par le MJ (0 PV puis stabilisé).
 */
import { CHEMIN, REPOS_HUMANITE } from "../config.mjs";
import { lancerFormule } from "../dice/formules.mjs";

const { renderTemplate } = foundry.applications.handlebars;
const { getProperty, setProperty, hasProperty } = foundry.utils;

/** Dé du compte à rebours selon le malus accumulé. */
export const deRebours = malus => (malus > 0 ? `1d4 - ${malus}` : "1d4");

/**
 * Calcule les conséquences d'une mise à jour d'un personnage (stress, Humanité).
 * Modifie `changements` et renvoie les alertes à poster dans le chat.
 * @param {Actor} acteur
 * @param {object} changements
 * @returns {Promise<object[]>}
 */
export async function preparerMiseAJour(acteur, changements) {
  const s = acteur.system;
  const alertes = [];

  // Stress : +10💀 au palier 2, +30💀 au palier 3, mort au palier 4
  const stress = getProperty(changements, "system.stress");
  if ( (stress !== undefined) && (stress > s.stress) ) {
    let ajout = 0;
    if ( (s.stress < 2) && (stress >= 2) ) ajout += 10;
    if ( (s.stress < 3) && (stress >= 3) ) ajout += 30;
    if ( ajout ) {
      const base = getProperty(changements, "system.humanite.value") ?? s.humanite.value;
      setProperty(changements, "system.humanite.value", base + ajout);
      alertes.push({ type: "stress", titre: `Stress ${stress}`, texte: `+${ajout}💀 à la jauge d'Humanité${stress >= 2 ? " · bonus de maîtrise perdu" : ""}` });
    }
    if ( stress >= 4 ) alertes.push({ type: "mort", titre: "Stress 4", texte: `${acteur.name} meurt.` });
  }

  // Humanité : jamais sous le minimum, puis les états
  let jauge = getProperty(changements, "system.humanite.value");
  if ( jauge === undefined ) return alertes;
  jauge = Math.max(s.humanite.min ?? 0, jauge);
  setProperty(changements, "system.humanite.value", jauge);

  // Le MJ change l'état à la main dans la même mise à jour : on le laisse faire
  if ( hasProperty(changements, "system.etat") ) return alertes;

  const avant = s.humanite.value;
  const max = s.humanite.max;
  const etat = s.etat;

  if ( ((etat === "stable") || (etat === "surLeFil")) && (jauge >= max) ) {
    const de = s.rebours.de || deRebours(s.rebours.malus);
    const jet = await lancerFormule(de, acteur);
    const tours = Math.max(0, jet.total);
    if ( tours <= 0 ) {
      setProperty(changements, "system.etat", "cyberpsychose");
      setProperty(changements, "system.rebours.tours", 0);
      alertes.push({ type: "cyberpsychose", titre: "Cyberpsychose", texte: `${acteur.name} bascule : le dé (${de}) donne ${jet.total}.`, roll: jet });
    } else {
      setProperty(changements, "system.etat", "rebours");
      setProperty(changements, "system.rebours.tours", tours);
      alertes.push({ type: "rebours", titre: "Plafond d'Humanité atteint", texte: "tours avant la cyberpsychose", total: tours, detail: `Compte à rebours ${de} (${jet.total})`, note: "Chaque nouvelle hausse d'Humanité retire 1 tour.", roll: jet });
    }
  } else if ( etat === "rebours" ) {
    if ( jauge < max ) {
      const malus = s.rebours.malus + 1;
      setProperty(changements, "system.etat", "surLeFil");
      setProperty(changements, "system.rebours.tours", 0);
      setProperty(changements, "system.rebours.malus", malus);
      setProperty(changements, "system.rebours.de", deRebours(malus));
      alertes.push({ type: "surLeFil", titre: "Sur le fil", texte: `${acteur.name} garde le contrôle. Prochain compte à rebours : ${deRebours(malus)}.` });
    } else if ( jauge > avant ) {
      const tours = Math.max(0, s.rebours.tours - 1);
      setProperty(changements, "system.rebours.tours", tours);
      if ( tours === 0 ) {
        setProperty(changements, "system.etat", "cyberpsychose");
        alertes.push({ type: "cyberpsychose", titre: "Cyberpsychose", texte: `${acteur.name} bascule en cyberpsychose.` });
      } else alertes.push({ type: "rebours", titre: "Compte à rebours", texte: "tours avant la cyberpsychose", total: tours, detail: "Nouvelle hausse d'Humanité : −1 tour" });
    }
  }
  return alertes;
}

/** Compte à rebours en combat : −1 tour au début du tour du personnage. */
export async function tourDeCombat(acteur) {
  const s = acteur.system;
  if ( s.etat !== "rebours" ) return;
  const tours = Math.max(0, s.rebours.tours - 1);
  const maj = { "system.rebours.tours": tours };
  if ( tours === 0 ) maj["system.etat"] = "cyberpsychose";
  await acteur.update(maj, { cpAlertes: [tours === 0
    ? { type: "cyberpsychose", titre: "Cyberpsychose", texte: `Le compte à rebours de ${acteur.name} arrive à zéro.` }
    : { type: "rebours", titre: "Compte à rebours", texte: "tours avant la cyberpsychose", total: tours, detail: "Début du tour : −1 tour" }] });
}

/* -------------------------------------------- */
/*  Messages                                    */
/* -------------------------------------------- */

const NOTES = {
  cyberpsychose: "+10 PV temporaires, 2 actions par tour. Un 20 naturel rend le contrôle pendant 1 tour. Sortie : 0 PV puis stabilisé (implants de guerre retirés, jauge au minimum).",
  mort: "Le personnage est mort."
};

/** Poste les alertes dans le chat. */
export async function posterAlertes(acteur, alertes) {
  for ( const a of alertes ) {
    const contenu = await renderTemplate(`${CHEMIN}/templates/chat/alerte.hbs`, {
      ...a,
      rouge: ["cyberpsychose", "mort"].includes(a.type),
      orange: ["rebours", "stress"].includes(a.type),
      note: a.note ?? NOTES[a.type],
      heure: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })
    });
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: acteur }),
      content: contenu,
      rolls: a.roll ? [a.roll] : [],
      flags: { cyberpunk2075: { type: "alerte", acteur: acteur.uuid } }
    });
  }
}

/* -------------------------------------------- */
/*  Repos long et jets de mort                  */
/* -------------------------------------------- */

/**
 * Repos long : RAM restaurée, utilisations remises à zéro, −1 stress,
 * jauge −(1d6 + SaFr + CapTec) sans passer sous le minimum, Sur le fil → Normal.
 */
export async function reposLong(acteur) {
  const ok = await foundry.applications.api.DialogV2.confirm({
    window: { title: `Repos long · ${acteur.name}` },
    classes: ["cp2075", "cp-dialogue"],
    content: "<p>RAM restaurée, utilisations rendues, −1 stress, baisse de la jauge d'Humanité (1d6 + Sang-Froid + Cap. Tech.).</p>",
    rejectClose: false
  });
  if ( !ok ) return null;
  const s = acteur.system;
  const jet = await lancerFormule(REPOS_HUMANITE, acteur);
  const baisse = Math.max(0, jet.total);
  const avant = s.humanite.value;
  const apres = Math.max(s.humanite.min, avant - baisse);
  const maj = {
    "system.ram.value": s.ram.max,
    "system.stress": Math.max(0, s.stress - 1),
    "system.humanite.value": apres
  };
  if ( s.etat === "surLeFil" ) Object.assign(maj, { "system.etat": "stable", "system.rebours.malus": 0, "system.rebours.de": "1d4", "system.rebours.tours": 0 });
  await acteur.update(maj, { cpSansAutomatisme: true });

  const items = acteur.items.filter(i => (i.system.usages?.utilises > 0) || i.system.actif?.enCours)
    .map(i => ({ _id: i.id, "system.usages.utilises": 0, "system.actif.enCours": false, "system.actif.tours": 0 }));
  if ( items.length ) await acteur.updateEmbeddedDocuments("Item", items);

  const lignes = [
    `RAM ${s.ram.max}/${s.ram.max}`,
    s.stress ? `Stress ${s.stress} → ${Math.max(0, s.stress - 1)}` : null,
    `Humanité ${avant} → ${apres} (−${baisse} : ${jet.result})`,
    (s.etat === "surLeFil") ? "Sur le fil → Normal" : null,
    items.length ? `${items.length} utilisation${items.length > 1 ? "s" : ""} rendue${items.length > 1 ? "s" : ""}` : null
  ].filter(Boolean);
  return posterAlertes(acteur, [{ type: "repos", titre: "Repos long", texte: lignes.join(" · "), roll: jet }]);
}

/** Jet de mort : 1d20, 10 ou plus = réussite ; 3 réussites = stabilisé, 3 échecs = mort. */
export async function jetDeMort(acteur) {
  const s = acteur.system;
  const jet = await new Roll("1d20").evaluate();
  const reussi = jet.total >= 10;
  const succes = s.mort.succes + (reussi ? 1 : 0);
  const echecs = s.mort.echecs + (reussi ? 0 : 1);
  const maj = { "system.mort.succes": Math.min(3, succes), "system.mort.echecs": Math.min(3, echecs) };
  let texte = `${jet.total} : ${reussi ? "réussite" : "échec"} · ✓ ${Math.min(3, succes)}/3 · ✕ ${Math.min(3, echecs)}/3`;
  let type = reussi ? "repos" : "stress";
  if ( succes >= 3 ) { texte += " · stabilisé"; Object.assign(maj, { "system.mort.succes": 0, "system.mort.echecs": 0 }); }
  if ( echecs >= 3 ) { texte += " · mort"; type = "mort"; }
  await acteur.update(maj);
  return posterAlertes(acteur, [{ type, titre: "Jet de mort", texte, total: jet.total, roll: jet, note: type === "mort" ? NOTES.mort : null }]);
}

/**
 * Attaques, dégâts et application des dégâts.
 */
import { CHEMIN, CARACS, COMPETENCES, COUVERTS, DEFENSES, NIVEAUX, REGLES_ARME, TYPES_DEGATS } from "../config.mjs";
import { signe } from "./jets.mjs";
import { traduireFormule } from "./formules.mjs";
import { choisirPoint, estPosee } from "../hud/viser.mjs";

const { renderTemplate } = foundry.applications.handlebars;
const DE_PAR_MODE = { avantage: "2d20kh", normal: "1d20", desavantage: "2d20kl" };
const LABEL_MODE = { avantage: "Avantage", normal: "", desavantage: "Désavantage" };

/* -------------------------------------------- */
/*  Outils                                      */
/* -------------------------------------------- */

/** Token de l'acteur sur la scène : celui sélectionné, sinon le premier. */
export function tokenDe(acteur) {
  if ( !canvas?.ready || !acteur ) return null;
  return canvas.tokens.controlled.find(t => t.actor === acteur) ?? acteur.getActiveTokens(true)[0] ?? null;
}

/** Distance en mètres entre deux tokens. */
function distance(a, b) {
  if ( !a || !b ) return null;
  try {
    return canvas.grid.measurePath([a.center, b.center]).distance;
  } catch {
    return null;
  }
}

/**
 * Arme à zone : tous les tokens dans le rayon autour du point d'impact (la première cible touchée)
 * subissent les dégâts, pas seulement la cible visée.
 */
function ajouterZone(sys, touchees, tokensCibles) {
  const rayon = sys.attaque?.zone;
  if ( !rayon || !canvas?.ready || !touchees.length ) return;
  const premier = tokensCibles.find(t => t.document.uuid === touchees[0].token) ?? fromUuidSync(touchees[0].token, { strict: false })?.object;
  if ( !premier ) return;
  const deja = new Set(touchees.map(c => c.token));
  for ( const t of canvas.tokens.placeables ) {
    if ( !t.actor || t.document.hidden || deja.has(t.document.uuid) ) continue;
    const d = distance(premier, t);
    if ( (d === null) || (d > rayon) ) continue;
    touchees.push({ token: t.document.uuid, nom: t.name, touche: true, critique: false, horsPortee: false, zone: true });
    deja.add(t.document.uuid);
  }
}

/** Tokens visibles (non cachés) dont le centre est dans le rayon (m) autour d'un point. */
function tokensAutour(point, rayon) {
  if ( !canvas?.ready ) return [];
  return canvas.tokens.placeables.filter(t => {
    if ( !t.actor || t.document.hidden ) return false;
    try { return canvas.grid.measurePath([point, t.center]).distance <= rayon; } catch { return false; }
  });
}

/** Point dans la direction du regard du token, à une distance en mètres. */
function pointDevant(token, metres = 10) {
  const px = (metres / canvas.dimensions.distance) * canvas.dimensions.size;
  const angle = Math.toRadians((token.document.rotation ?? 0) + 90);
  return { x: token.center.x + (Math.cos(angle) * px), y: token.center.y + (Math.sin(angle) * px) };
}

/** Données d'animation à poser sur le message (jouées par tous les clients). */
function donneesAnimation(item, source, cibles, touches, pointImpact = null) {
  const anim = item.system.animationEffective;
  if ( !source || !anim || (anim.style === "aucune") ) return null;
  const rayon = item.system.attaque?.zone ?? 0;
  const portee = item.system.portee || 10;
  return {
    scene: canvas.scene.id,
    source: source.id,
    cibles: cibles.map(t => t.id),
    touches: touches.map(t => t.id),
    point: pointImpact ?? (cibles.length ? null : pointDevant(source, Math.min(portee, 20))),
    rayon,
    ...anim
  };
}

/* -------------------------------------------- */
/*  Fenêtre d'attaque                           */
/* -------------------------------------------- */

async function demanderOptionsAttaque({ item, acteur, cibles, score }) {
  const stress = acteur.system.stress ?? 0;
  const couvert = acteur.system.couvert ?? 0;
  const contenu = await renderTemplate(`${CHEMIN}/templates/dialogs/attaque.hbs`, {
    titre: item.name,
    formule: `1d20 ${signe(score).replace(/^([+−])/, "$1 ")}`,
    desavantage: stress >= 1,
    alerteStress: stress >= 1,
    couverts: COUVERTS.map((c, i) => ({ i, label: i ? `${c.label} (${signe(c.malusTir)})` : "Non", selectionne: i === couvert })),
    nbCibles: cibles.length,
    defense: DEFENSES[item.system.attaque.defense]
  });
  const r = await foundry.applications.api.DialogV2.wait({
    window: { title: `Jet d'attaque · ${item.name}` },
    classes: ["cp2075", "cp-dialogue"],
    position: { width: 380 },
    content: contenu,
    buttons: [
      { action: "annuler", label: "Annuler" },
      {
        action: "lancer", label: "Lancer", default: true,
        callback: (event, bouton) => {
          const el = bouton.form.elements;
          return {
            mode: el.mode.value,
            couvert: Number(el.couvert.value) || 0,
            bonus: Number.parseInt(String(el.bonus.value).replace("−", "-")) || 0,
            vehicule: el.vehicule.checked
          };
        }
      }
    ],
    rejectClose: false
  });
  return (r && (typeof r === "object")) ? r : null;
}

/* -------------------------------------------- */
/*  Attaque                                     */
/* -------------------------------------------- */

/**
 * Jet d'attaque avec une arme.
 * @param {Item} item
 * @param {object} [options]
 * @param {boolean} [options.rapide]  Sans fenêtre (Maj + clic).
 * @param {boolean} [options.supplementaire]  Attaque bonus de la mitraillette.
 */
export async function attaquer(item, { rapide = false, supplementaire = false } = {}) {
  const acteur = item.actor;
  if ( !acteur ) return ui.notifications.warn("L'arme doit être portée par un personnage pour attaquer.");
  const sys = item.system;
  if ( sys.stock <= 0 ) return ui.notifications.warn(`${item.name} : plus aucune en stock.`);

  // Dégâts automatiques (grenades, défense « aucune ») : pas de jet de touche
  if ( sys.attaque.defense === "aucune" ) {
    // Grenade lancée sans cible : le joueur choisit le point de chute (le C4 se pose, il ne se lance pas)
    if ( (sys.typeArme === "grenade") && !estPosee(item) && !game.user.targets.size && canvas?.ready ) {
      const point = await choisirPoint(item);
      if ( !point ) return null;
      return lancerDegats(item, { avecAnimation: true, point });
    }
    return lancerDegats(item, { avecAnimation: true });
  }

  const source = tokenDe(acteur);
  const cibles = Array.from(game.user.targets);
  const score = sys.scoreTouche;

  let options = { mode: (acteur.system.stress >= 1) ? "desavantage" : "normal", couvert: acteur.system.couvert ?? 0, bonus: 0, vehicule: false };
  if ( !rapide ) {
    options = await demanderOptionsAttaque({ item, acteur, cibles, score });
    if ( !options ) return null;
  }
  let mode = options.mode;
  if ( options.vehicule ) mode = (mode === "avantage") ? "normal" : "desavantage";

  const comp = COMPETENCES[sys.competence];
  const parts = [{ label: comp?.label ?? "Compétence", valeur: acteur.system.competences?.[sys.competence]?.score ?? 0 }];
  if ( sys.attaque.bonusTouche ) parts.push({ label: "Arme", valeur: sys.attaque.bonusTouche });
  const modTouche = acteur.system.modificateurs?.touche ?? 0;
  if ( modTouche ) parts.push({ label: "Implants et objets", valeur: modTouche });
  const malusCouvert = COUVERTS[options.couvert]?.malusTir ?? 0;
  if ( malusCouvert ) parts.push({ label: "Tir à couvert", valeur: malusCouvert });
  if ( options.bonus ) parts.push({ label: "Bonus du MJ", valeur: options.bonus });
  const totalBonus = parts.reduce((s, p) => s + p.valeur, 0);

  const jet = await new Roll(`${DE_PAR_MODE[mode]} + ${totalBonus}`).evaluate();
  const de = jet.dice[0];
  const naturel = de.total;
  const vingt = naturel === 20;
  const sniper = sys.typeArme === "sniper";
  const typeDefense = sys.attaque.defense;

  const resultats = cibles.map(t => {
    const valeur = t.actor?.defense?.(typeDefense) ?? null;
    const touche = (valeur === null) ? null : (vingt || (jet.total >= valeur));
    const d = distance(source, t);
    return {
      token: t.document.uuid,
      nom: t.name,
      defense: valeur,
      inconnue: valeur === null,
      touche,
      rate: touche === false,
      critique: !!touche && (vingt || sniper),
      horsPortee: !!(sys.portee && (d !== null) && (d > sys.portee)),
      distance: (d === null) ? null : Math.round(d * 10) / 10
    };
  });
  const toucheQuelquUn = resultats.some(r => r.touche !== false);
  const critiqueGlobal = vingt || (sniper && resultats.some(r => r.touche));

  const animation = donneesAnimation(item, source, cibles, cibles.filter((t, i) => resultats[i].touche !== false));

  const contexte = {
    acteur: acteur.name,
    heure: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    titre: item.name,
    niveau: sys.aNiveaux ? NIVEAUX[sys.niveauEffectif] : null,
    critique: vingt,
    supplementaire,
    modeLabel: LABEL_MODE[mode],
    total: jet.total,
    des: de.results.map(r => ({ valeur: r.result, ecarte: !!r.discarded })),
    plusieursDes: de.results.length > 1,
    parts: parts.map(p => ({ label: p.label, valeur: signe(p.valeur) })),
    defense: DEFENSES[typeDefense],
    cibles: resultats,
    sansCible: !cibles.length,
    regle: (sys.typeArme === "mitraillette") && !supplementaire ? REGLES_ARME.mitraillette : null,
    attaqueSup: (sys.typeArme === "mitraillette") && !supplementaire,
    sniper: sniper && critiqueGlobal,
    boutonDegats: toucheQuelquUn || !cibles.length
  };

  const contenu = await renderTemplate(`${CHEMIN}/templates/chat/attaque.hbs`, contexte);
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: acteur, token: source?.document }),
    content: contenu,
    rolls: [jet],
    flags: {
      cyberpunk2075: {
        type: "attaque",
        acteur: acteur.uuid,
        item: item.uuid,
        critique: critiqueGlobal,
        cibles: resultats,
        animation
      }
    }
  });
}

/* -------------------------------------------- */
/*  Dégâts                                      */
/* -------------------------------------------- */

/**
 * Jet de dégâts.
 * @param {Item} item
 * @param {object} [options]
 * @param {object[]} [options.cibles]     Résultats de l'attaque (touchées seulement).
 * @param {boolean}  [options.critique]   Ajoute le dé de critique du niveau.
 * @param {boolean}  [options.avecAnimation]  Dégâts directs avec animation (grenades).
 */
export async function lancerDegats(item, { cibles = null, critique = false, avecAnimation = false, point = null } = {}) {
  const acteur = item.actor;
  if ( !acteur ) return ui.notifications.warn("L'arme doit être portée par un personnage.");
  const sys = item.system;
  const n = sys.n;
  const caracCle = sys.carac;
  const bonusCarac = caracCle ? (acteur.system.caracs?.[caracCle]?.bonus ?? 0) : 0;
  const supplements = sys.degatsSupplementaires;
  const modDegats = acteur.system.modificateurs?.degats ?? 0;

  // Sans résultats d'attaque : cibles visées, toutes touchées
  const source = tokenDe(acteur);
  let tokensCibles = [];
  if ( !cibles ) {
    // Point de chute choisi : tous les tokens dans le rayon autour du point
    tokensCibles = point ? tokensAutour(point, sys.attaque?.zone || 0) : Array.from(game.user.targets);
    cibles = tokensCibles.map(t => {
      const d = distance(source, t);
      return { token: t.document.uuid, nom: t.name, touche: true, critique, horsPortee: !!(sys.portee && (d !== null) && (d > sys.portee)) };
    });
  }
  const touchees = cibles.filter(c => c.touche !== false);
  const avecCritique = critique || touchees.some(c => c.critique);
  if ( !point ) ajouterZone(sys, touchees, tokensCibles);

  // Le dé peut contenir une compétence (« 1d12 + Corps à corps », « 1d6 + Pilotage »)
  const termes = [traduireFormule(n.de || "0")];
  const detail = [];
  if ( n.bonusFixe ) termes.push(`${n.bonusFixe}`);
  if ( bonusCarac ) termes.push(`${bonusCarac}`);
  if ( modDegats ) termes.push(`${modDegats}`);
  for ( const sup of supplements ) termes.push(sup.de);
  if ( avecCritique ) termes.push(sys.deCritique);
  const jet = await new Roll(termes.join(" + "), acteur.getRollData()).evaluate();

  // Détail lisible : « 1d6 (4) + 1 + SaFr 1 + crit 1d8 (6) »
  const des = jet.dice;
  detail.push(`${n.de} (${des[0]?.results.map(r => r.result).join(", ") ?? "—"})`);
  if ( n.bonusFixe ) detail.push(signe(n.bonusFixe));
  if ( bonusCarac ) detail.push(`${signe(bonusCarac)} ${CARACS[caracCle].abrev}`);
  if ( modDegats ) detail.push(`${signe(modDegats)} implants et objets`);
  supplements.forEach((sup, i) => detail.push(`+ ${sup.label} ${sup.de} (${des[1 + i]?.results.map(r => r.result).join(", ") ?? "—"})`));
  if ( avecCritique ) detail.push(`+ crit ${sys.deCritique} (${des.at(-1)?.results.map(r => r.result).join(", ")})`);

  const lignes = touchees.map(c => {
    const montant = c.horsPortee ? Math.floor(jet.total / 2) : jet.total;
    return { ...c, montant };
  });

  // Grenades : consommées au lancer
  if ( (item.type === "arme") && (sys.typeArme === "grenade") ) await item.update({ "system.quantite": Math.max(0, sys.quantite - 1) });

  let animation = null;
  if ( avecAnimation ) {
    const tokens = point ? [] : (tokensCibles.length ? tokensCibles : Array.from(game.user.targets));
    animation = donneesAnimation(item, source, tokens, tokens, point);
  }

  const typeDegats = TYPES_DEGATS[n.typeDegats] ?? n.typeDegats;
  const contexte = {
    acteur: acteur.name,
    heure: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    titre: item.name,
    typeDegats,
    critique: avecCritique,
    total: jet.total,
    detail: detail.join(" "),
    cibles: lignes,
    sansCible: !lignes.length,
    plusieurs: lignes.length > 1,
    zone: sys.attaque.zone ? `Zone : ${sys.attaque.zone} m de rayon` : null,
    reglePompe: lignes.some(l => l.horsPortee) ? "Hors portée (15 m) : moitié des dégâts" : null
  };
  const contenu = await renderTemplate(`${CHEMIN}/templates/chat/degats.hbs`, contexte);
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: acteur, token: source?.document }),
    content: contenu,
    rolls: [jet],
    flags: { cyberpunk2075: { type: "degats", acteur: acteur.uuid, item: item.uuid, total: jet.total, animation } }
  });
}

/* -------------------------------------------- */
/*  Application                                 */
/* -------------------------------------------- */

/** Acteur derrière un uuid de token ou d'acteur. */
async function acteurDepuis(uuid) {
  const doc = await fromUuid(uuid);
  return doc?.actor ?? ((doc instanceof Actor) ? doc : null);
}

/**
 * Applique des dégâts ou un soin à une liste de cibles.
 * @param {"degats"|"soin"} nature
 * @param {number} montant
 * @param {string[]} uuids  Tokens ou acteurs ; vide = tokens sélectionnés.
 */
export async function appliquer(nature, montant, uuids = [], { attaquant = null, arme = null } = {}) {
  let acteurs = [];
  if ( uuids.length ) acteurs = (await Promise.all(uuids.map(acteurDepuis))).filter(a => a);
  else acteurs = canvas.tokens.controlled.map(t => t.actor).filter(a => a);
  if ( !acteurs.length ) return ui.notifications.warn("Sélectionne d'abord un ou plusieurs tokens.");

  for ( const a of acteurs ) {
    if ( !a.isOwner ) {
      ui.notifications.warn(`Seul le MJ peut modifier ${a.name}.`);
      continue;
    }
    if ( nature === "soin" ) {
      const r = await a.recevoirSoin(montant);
      ui.notifications.info(`${a.name} : +${r.apres - r.avant} PV (${r.avant} → ${r.apres})${r.releve ? " · +1 stress" : ""}`);
    } else {
      const r = await a.subirDegats(montant);
      const reduit = r.reduit ? ` · ${r.reduit} absorbés` : "";
      ui.notifications.info(`${a.name} : −${r.avant - r.apres} PV (${r.avant} → ${r.apres})${reduit}`);
      if ( (r.avant > 0) && (r.apres === 0) && attaquant ) await humaniteParKill(attaquant, a, arme);
    }
  }
}

/**
 * Un ennemi tombe à 0 PV : l'attaquant gagne les 💀 « par kill » de ses effets actifs
 * et de l'implant avec lequel il a frappé.
 * @param {string} uuidAttaquant
 * @param {Actor} victime
 * @param {string} [uuidArme]
 */
async function humaniteParKill(uuidAttaquant, victime, uuidArme) {
  const attaquant = await fromUuid(uuidAttaquant);
  if ( !attaquant || (attaquant.type !== "personnage") || !attaquant.isOwner ) return;
  let total = 0;
  const sources = [];
  for ( const item of attaquant.items ) {
    const e = item.system.effet;
    const frappe = uuidArme && (item.uuid === uuidArme) && (item.type === "implant");
    if ( !e?.humaniteKill || !(item.system.actif?.enCours || frappe) ) continue;
    total += e.humaniteKill;
    sources.push(item.name);
  }
  if ( !total ) return;
  const r = await attaquant.modifierHumanite(total);
  ui.notifications.info(`${attaquant.name} : +${total}💀 pour ${victime.name} (${sources.join(", ")}) · Humanité ${r.avant} → ${r.apres}`);
}

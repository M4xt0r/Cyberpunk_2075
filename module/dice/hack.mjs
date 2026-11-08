/**
 * Lancer un hack : RAM déduite (ou PV avec OverClocking), 1d20 + Piratage contre la Glace
 * (réussite si le total dépasse la Glace), dégâts selon la nature de la cible,
 * Humanité infligée, animation glitch puis effet propre.
 */
import { CHEMIN, ACTIVATIONS, TYPES_DEGATS } from "../config.mjs";
import { signe } from "./jets.mjs";
import { lancerFormule } from "./formules.mjs";
import { tokenDe } from "./attaque.mjs";
import { ANIM } from "../config.mjs";

const renderTemplate = (...args) => foundry.applications.handlebars.renderTemplate(...args);
const DE_PAR_MODE = { avantage: "2d20kh", normal: "1d20", desavantage: "2d20kl" };
const heure = () => new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

/* -------------------------------------------- */

async function demanderOptions(item, acteur, cibles) {
  const s = item.system;
  const a = acteur.system;
  const contenu = await renderTemplate(`${CHEMIN}/templates/dialogs/hack.hbs`, {
    titre: item.name,
    formule: ((s.defense === "glace") || s.estPing) ? `1d20 ${signe(s.scoreTouche).replace(/^([+−])/, "$1 ")}` : "Sans jet",
    effet: s.effet,
    variable: s.variable.actif,
    unite: s.variable.unite,
    parUnite: s.variable.parUnite,
    base: s.ram,
    cout: s.cout(1),
    ram: a.ram.value,
    ramMax: a.ram.max,
    vie: a.vie.value,
    overclocking: a.overclocking,
    avecJet: (s.defense === "glace") || s.estPing,
    desavantage: (a.stress ?? 0) >= 1,
    nbCibles: cibles.length
  });
  const r = await foundry.applications.api.DialogV2.wait({
    window: { title: `Hack · ${item.name}` },
    classes: ["cp2075", "cp-dialogue", "cp-dialogue-hack"],
    position: { width: 380 },
    content: contenu,
    render: (event, dialogue) => {
      // Coût et RAM restante recalculés à chaque changement de quantité
      const el = dialogue.element;
      const maj = () => {
        const q = Number(el.querySelector("[name=quantite]")?.value) || 0;
        const pv = el.querySelector("[name=pv]")?.checked;
        const cout = s.cout(q);
        el.querySelector("[data-cout]").textContent = `${cout} ${pv ? "PV" : "RAM"}`;
        el.querySelector("[data-reste]").textContent = pv ? `reste ${a.vie.value - cout} PV` : `reste ${a.ram.value - cout} / ${a.ram.max}`;
        const bouton = el.querySelector("button[data-action=lancer]");
        if ( bouton ) bouton.textContent = `Lancer · −${cout} ${pv ? "PV" : "RAM"}`;
      };
      el.querySelectorAll("[name=quantite], [name=pv]").forEach(i => i.addEventListener("input", maj));
      maj();
    },
    buttons: [
      { action: "annuler", label: "Annuler" },
      {
        action: "lancer", label: "Lancer", default: true,
        callback: (event, bouton) => {
          const e = bouton.form.elements;
          return {
            mode: e.mode?.value ?? "normal",
            bonus: Number.parseInt(String(e.bonus?.value ?? 0).replace("−", "-")) || 0,
            quantite: Number(e.quantite?.value) || 0,
            pv: !!e.pv?.checked
          };
        }
      }
    ],
    rejectClose: false
  });
  return (r && (typeof r === "object")) ? r : null;
}

/* -------------------------------------------- */

/** Dégâts d'un hack sur une cible, selon sa nature. */
async function degatsPour(item, acteur, nature, cache) {
  const formule = item.system.formulePour(nature);
  if ( !formule ) return null;
  cache[formule] ??= await lancerFormule(formule, acteur);
  return { formule, jet: cache[formule] };
}

/**
 * Lance un hack.
 * @param {Item} item
 * @param {object} [options]
 * @param {boolean} [options.rapide]  Sans fenêtre (Maj + clic), seulement pour un coût fixe.
 */
export async function lancerHack(item, { rapide = false } = {}) {
  const acteur = item.actor;
  if ( !acteur ) return ui.notifications.warn("Le hack doit être sur la fiche d'un personnage.");
  const s = item.system;
  const a = acteur.system;
  const source = tokenDe(acteur);
  const cibles = Array.from(game.user.targets);

  let options = { mode: (a.stress >= 1) ? "desavantage" : "normal", bonus: 0, quantite: 0, pv: false };
  if ( !rapide || s.variable.actif ) {
    options = await demanderOptions(item, acteur, cibles);
    if ( !options ) return null;
  }

  // Paiement
  const cout = s.cout(options.quantite);
  const payeEnPV = options.pv && a.overclocking;
  const reserve = payeEnPV ? a.vie.value : a.ram.value;
  if ( cout > reserve ) return ui.notifications.warn(`${item.name} : il faut ${cout} ${payeEnPV ? "PV" : "RAM"}, ${acteur.name} n'en a que ${reserve}.`);
  // Valeurs lues avant la mise à jour (le système de l'acteur est modifié sur place)
  const avant = { vie: a.vie.value, vieMax: a.vie.max, ram: a.ram.value, ramMax: a.ram.max };
  const maj = payeEnPV ? { "system.vie.value": avant.vie - cout } : { "system.ram.value": avant.ram - cout };
  if ( s.humanite.lanceur ) maj["system.humanite.value"] = a.humanite.value + s.humanite.lanceur;
  await acteur.update(maj);

  if ( s.estPing ) return lancerPing(item, acteur, source, options, { cout, payeEnPV, avant });

  // Jet contre la Glace
  let jet = null;
  let parts = [];
  if ( s.defense === "glace" ) {
    parts = [{ label: s.competenceLabel, valeur: a.competences?.[s.competence]?.score ?? 0 }];
    if ( s.bonusTouche ) parts.push({ label: "Hack", valeur: s.bonusTouche });
    if ( options.bonus ) parts.push({ label: "Bonus du MJ", valeur: options.bonus });
    const total = parts.reduce((x, p) => x + p.valeur, 0);
    jet = await new Roll(`${DE_PAR_MODE[options.mode]} + ${total}`).evaluate();
  }

  // Résultat par cible
  const cache = {};
  const resultats = [];
  for ( const t of cibles ) {
    const glace = t.actor?.defense?.("glace") ?? null;
    const pirate = !jet ? true : ((glace === null) ? null : (jet.total > glace));
    const nature = t.actor?.system?.nature ?? "organique";
    const r = { token: t.document.uuid, nom: t.name, glace, inconnue: jet && (glace === null), pirate, rate: pirate === false, nature, robot: nature === "robot" };
    if ( (pirate !== false) && s.faitDegats ) {
      const d = await degatsPour(item, acteur, nature, cache);
      if ( d ) Object.assign(r, { montant: Math.max(1, d.jet.total), formule: d.formule, detail: d.jet.result });
    }
    if ( jet && (pirate === false) && a.violation ) r.forcer = Math.max(1, (glace ?? 0) - jet.total + 1);
    resultats.push(r);
  }
  // Sans cible : dégâts lancés quand même, une seule fois
  let sansCible = null;
  if ( !cibles.length && s.faitDegats ) {
    const d = await degatsPour(item, acteur, "organique", cache);
    sansCible = d ? { montant: Math.max(1, d.jet.total), formule: d.formule, detail: d.jet.result } : null;
  }

  // Animations : glitch sur toutes les cibles, puis l'effet propre sur les cibles piratées
  const animations = [];
  if ( source && cibles.length ) {
    const base = { scene: canvas.scene.id, source: source.id, point: null, rayon: 0 };
    if ( s.glitch ) animations.push({ ...base, style: "impact", impact: s.glitch, cibles: cibles.map(t => t.id), touches: cibles.map(t => t.id), son: s.animation.son });
    const touches = cibles.filter((t, i) => resultats[i].pirate !== false).map(t => t.id);
    if ( s.impactEffectif && touches.length ) animations.push({ ...base, style: "impact", impact: s.impactEffectif, cibles: touches, touches, son: s.glitch ? "" : s.animation.son });
  }

  const de = jet?.dice[0];
  const contexte = {
    acteur: acteur.name,
    heure: heure(),
    titre: item.name,
    activation: ACTIVATIONS[s.activation],
    cout: `−${cout} ${payeEnPV ? "PV" : "RAM"}`,
    payeEnPV,
    jet: jet ? {
      total: jet.total,
      des: de.results.map(x => ({ valeur: x.result, ecarte: !!x.discarded })),
      plusieursDes: de.results.length > 1,
      parts: parts.map(p => ({ label: p.label, valeur: signe(p.valeur) }))
    } : null,
    effet: s.effet,
    typeDegats: TYPES_DEGATS[s.degats.type] ?? s.degats.type,
    cibles: resultats,
    sansCible,
    aucuneCible: !cibles.length,
    humaniteCible: s.humanite.cible,
    humaniteLanceur: s.humanite.lanceur,
    reste: payeEnPV ? `PV ${avant.vie - cout} / ${avant.vieMax}` : `RAM ${avant.ram - cout} / ${avant.ramMax}`
  };
  const contenu = await renderTemplate(`${CHEMIN}/templates/chat/hack.hbs`, contexte);
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: acteur, token: source?.document }),
    content: contenu,
    rolls: [jet, ...Object.values(cache)].filter(Boolean),
    flags: { cyberpunk2075: { type: "hack", acteur: acteur.uuid, item: item.uuid, total: jet?.total ?? 0, cibles: resultats, animations } }
  });
}

/**
 * Protocole de violation rapide : payer en RAM l'écart avec la Glace d'une cible ratée.
 * @param {ChatMessage} message
 * @param {number} index  Cible dans le message.
 */
export async function forcerHack(message, index) {
  const d = message.flags.cyberpunk2075;
  const cible = d.cibles?.[index];
  const acteur = await fromUuid(d.acteur);
  const item = await fromUuid(d.item);
  if ( !cible || !acteur || !item ) return;
  if ( !acteur.isOwner ) return ui.notifications.warn("Seul le lanceur peut forcer ce hack.");
  const prixRam = cible.forcer;
  if ( acteur.system.ram.value < prixRam ) return ui.notifications.warn(`Il faut ${prixRam} RAM pour forcer la Glace de ${cible.nom}.`);
  await acteur.update({ "system.ram.value": acteur.system.ram.value - prixRam });

  const r = { ...cible, pirate: true, rate: false, force: true, forcer: null };
  if ( item.system.faitDegats ) {
    const dg = await degatsPour(item, acteur, cible.nature, {});
    if ( dg ) Object.assign(r, { montant: Math.max(1, dg.jet.total), formule: dg.formule, detail: dg.jet.result, jet: dg.jet });
  }
  const contenu = await renderTemplate(`${CHEMIN}/templates/chat/hack.hbs`, {
    acteur: acteur.name,
    heure: heure(),
    titre: item.name,
    activation: "Protocole de violation rapide",
    cout: `−${prixRam} RAM`,
    effet: `Glace de ${cible.nom} forcée.`,
    typeDegats: TYPES_DEGATS[item.system.degats.type] ?? item.system.degats.type,
    cibles: [r],
    humaniteCible: item.system.humanite.cible,
    reste: `RAM ${acteur.system.ram.value} / ${acteur.system.ram.max}`
  });
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: acteur }),
    content: contenu,
    rolls: r.jet ? [r.jet] : [],
    flags: { cyberpunk2075: { type: "hack", acteur: acteur.uuid, item: item.uuid, cibles: [{ ...r, jet: undefined }] } }
  });
}

/* -------------------------------------------- */
/*  Ping                                        */
/* -------------------------------------------- */

const RAYON_ONDE = 15;   // mètres : taille visuelle de l'onde

/**
 * Ping : 1d20 + Piratage contre la Glace de chaque ennemi de la scène.
 * Les ennemis dont la Glace ne dépasse pas le jet sont marqués (visibles à travers les murs)
 * pour le lanceur et le MJ seulement, jusqu'au début du prochain tour du lanceur.
 */
async function lancerPing(item, acteur, source, options, { cout, payeEnPV, avant }) {
  const s = item.system;
  const a = acteur.system;
  const parts = [{ label: s.competenceLabel, valeur: a.competences?.[s.competence]?.score ?? 0 }];
  if ( s.bonusTouche ) parts.push({ label: "Hack", valeur: s.bonusTouche });
  if ( options.bonus ) parts.push({ label: "Bonus du MJ", valeur: options.bonus });
  const total = parts.reduce((x, p) => x + p.valeur, 0);
  const jet = await new Roll(`${DE_PAR_MODE[options.mode]} + ${total}`).evaluate();

  const ennemis = (canvas.scene?.tokens ?? []).filter(t => t.actor?.type === "ennemi");
  const detectes = [];
  const caches = [];
  for ( const t of ennemis ) {
    const glace = t.actor.defense?.("glace") ?? 0;
    (glace <= jet.total ? detectes : caches).push({ id: t.id, nom: t.name, glace });
  }

  const de = jet.dice[0];
  const lignes = detectes.map(c => `<div class="cp-msg-cible"><span class="cp-pousse">${c.nom}</span><span class="cp-num cp-doux">Glace ${c.glace}</span><span class="cp-num cp-jaune">détecté</span></div>`).join("");
  const contenu = `<div class="cp-msg">
    <div class="cp-msg-qui"><span>${acteur.name}</span><span>${heure()}</span></div>
    <div class="cp-msg-etiquette"><span class="cp-msg-type">Hack · Ping</span><span class="cp-msg-titre">${item.name}</span></div>
    <div class="cp-msg-puce">
      <span class="cp-msg-total">${jet.total}</span>
      <div class="cp-msg-des"><span class="cp-num cp-msg-detail">${DE_PAR_MODE[options.mode]} (${de.results.map(r => r.result).join(", ")}) ${parts.map(p => `${signe(p.valeur)} ${p.label}`).join(" ")}</span>
      <span class="cp-msg-nat">−${cout} ${payeEnPV ? "PV" : "RAM"} · ${payeEnPV ? `PV ${avant.vie - cout} / ${avant.vieMax}` : `RAM ${avant.ram - cout} / ${avant.ramMax}`}</span></div>
    </div>
    <div class="cp-msg-note">${detectes.length} ennemi(s) détecté(s) sur le réseau local${caches.length ? ` · ${caches.length} restent cachés (Glace trop haute)` : ""}. Marqueurs jusqu'au début de ton prochain tour.</div>
    ${lignes}
  </div>`;

  const animations = source ? [{
    scene: canvas.scene.id, source: source.id, cibles: [], touches: [], point: source.center, rayon: RAYON_ONDE,
    style: "zone", zone: `${ANIM}/zones/ping_onde.webm`, son: s.animation.son
  }] : [];
  const mj = game.users.filter(u => u.isGM).map(u => u.id);
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: acteur, token: source?.document }),
    content: contenu,
    rolls: [jet],
    whisper: [...new Set([game.user.id, ...mj])],
    flags: { cyberpunk2075: {
      type: "ping", acteur: acteur.uuid, item: item.uuid, animations,
      ping: { scene: canvas.scene?.id, cibles: detectes.map(c => c.id), lanceurToken: source?.id ?? null, lanceur: acteur.uuid, voient: [game.user.id] }
    } }
  });
}

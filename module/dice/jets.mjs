import { CHEMIN, DD } from "../config.mjs";

const { renderTemplate } = foundry.applications.handlebars;

/** Formule du d20 selon le mode. */
const DE_PAR_MODE = { avantage: "2d20kh", normal: "1d20", desavantage: "2d20kl" };
const LABEL_MODE = { avantage: "Avantage", normal: "", desavantage: "Désavantage" };
const MODE_ROLL = { public: "publicroll", mj: "gmroll", moi: "selfroll" };

/** Écrit un nombre signé avec le vrai signe moins : +3, −1. */
export function signe(n) {
  n = Number(n) || 0;
  return n < 0 ? `−${Math.abs(n)}` : `+${n}`;
}

/* -------------------------------------------- */

/**
 * Fenêtre de jet (compétence, caractéristique) : DD, mode, bonus du MJ, visibilité.
 * @returns {Promise<{mode: string, dd: number|"cache"|null, bonus: number, visibilite: string}|null>}
 */
export async function demanderOptionsJet({ type, titre, totalBonus }) {
  const content = await renderTemplate(`${CHEMIN}/templates/dialogs/jet.hbs`, {
    titre, formule: `1d20 ${signe(totalBonus).replace(/^([+−])/, "$1 ")}`, dds: DD
  });
  return foundry.applications.api.DialogV2.wait({
    window: { title: `Jet de ${type.toLowerCase()} · ${titre}` },
    classes: ["cp2075", "cp-dialogue"],
    position: { width: 380 },
    content,
    buttons: [
      { action: "annuler", label: "Annuler" },
      {
        action: "lancer", label: "Lancer", default: true, class: "cp-principal",
        callback: (event, button) => {
          const el = button.form.elements;
          const ddBrut = el.dd.value;
          const ddLibre = Number.parseInt(el.ddLibre.value);
          let dd = null;
          if ( Number.isFinite(ddLibre) ) dd = ddLibre;
          else if ( ddBrut === "cache" ) dd = "cache";
          else if ( ddBrut ) dd = Number(ddBrut);
          return {
            mode: el.mode.value,
            dd,
            bonus: Number.parseInt(String(el.bonus.value).replace("−", "-")) || 0,
            visibilite: el.visibilite.value
          };
        }
      }
    ],
    rejectClose: false
  }).then(r => (r && (typeof r === "object")) ? r : null);
}

/* -------------------------------------------- */

/**
 * Lance 1d20 + bonus et poste la barrette dans le chat.
 * @param {object} config
 * @param {Actor}  config.acteur
 * @param {string} config.type        Ex. « Compétence ».
 * @param {string} config.titre       Ex. « Perception ».
 * @param {{label: string, valeur: number}[]} config.parts
 * @param {string} [config.mode]      avantage | normal | desavantage
 * @param {number|"cache"|null} [config.dd]
 * @param {string} [config.visibilite] public | mj | moi
 */
export async function lancerJetD20({ acteur, type, titre, parts, mode = "normal", dd = null, visibilite = "public" }) {
  const totalBonus = parts.reduce((s, p) => s + p.valeur, 0);
  const formule = `${DE_PAR_MODE[mode] ?? "1d20"} + ${totalBonus}`;
  const jet = await new Roll(formule).evaluate();

  const de = jet.dice[0];
  const des = de.results.map(r => ({ valeur: r.result, ecarte: !!r.discarded }));
  const naturel = de.total;
  const ddCache = dd === "cache";
  const ddValeur = ddCache ? null : dd;
  // DD caché : le joueur ne voit rien, le MJ voit le total et juge lui-même la réussite.
  const verdict = (ddValeur === null) ? null : (jet.total >= ddValeur);

  const contexte = {
    acteur: acteur.name,
    heure: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    type,
    titre,
    modeLabel: LABEL_MODE[mode],
    total: jet.total,
    des,
    plusieursDes: des.length > 1,
    parts: parts.map(p => ({ label: p.label, valeur: signe(p.valeur) })),
    dd: ddValeur,
    ddCache,
    reussi: verdict === true,
    rate: verdict === false,
    naturel20: naturel === 20,
    naturel1: naturel === 1
  };
  const content = await renderTemplate(`${CHEMIN}/templates/chat/jet.hbs`, contexte);

  const donnees = {
    speaker: ChatMessage.getSpeaker({ actor: acteur }),
    content,
    rolls: [jet],
    flags: { cyberpunk2075: { type: "jet", ddCache } }
  };
  ChatMessage.applyRollMode(donnees, MODE_ROLL[visibilite] ?? "publicroll");
  return ChatMessage.create(donnees);
}

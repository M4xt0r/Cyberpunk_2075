/**
 * Utilisation d'un objet : jet associé (soin ou dégâts), coût en Humanité,
 * effet actif pendant sa durée, charges, quantité et utilisations.
 */
import { CHEMIN, ACTIVATIONS, PERIODES, TYPES_DEGATS } from "../config.mjs";
import { lancerFormule } from "./formules.mjs";
import { tokenDe } from "./attaque.mjs";

const { renderTemplate } = foundry.applications.handlebars;

export async function utiliserObjet(item) {
  const acteur = item.actor;
  if ( !acteur ) return ui.notifications.warn("L'objet doit être dans l'inventaire d'un personnage.");
  const sys = item.system;
  if ( sys.blocage ) return ui.notifications.warn(`${item.name} : ${sys.blocage.toLowerCase()}.`);
  const effet = sys.effet;

  // Jet associé
  let jet = null;
  if ( effet?.jet.formule ) jet = await lancerFormule(effet.jet.formule, acteur);

  // Humanité
  let humanite = null;
  const cout = sys.coutHumaniteTotal;
  if ( cout ) humanite = await acteur.modifierHumanite(cout);

  // Consommation : charges, sinon quantité pour les consommables et la nourriture
  const maj = {};
  if ( (sys.chargesMax > 0) && sys.uneChargeParUtilisation ) {
    const reste = sys.chargesRestantes - 1;
    if ( reste > 0 ) maj["system.chargesRestantes"] = reste;
    else {
      const quantite = Math.max(0, sys.quantite - 1);
      maj["system.quantite"] = quantite;
      maj["system.chargesRestantes"] = quantite > 0 ? sys.chargesMax : 0;
    }
  } else if ( (sys.categorie === "consommable") || (sys.qualite !== "aucune") ) {
    maj["system.quantite"] = Math.max(0, sys.quantite - 1);
  }
  if ( sys.utilisationsMax !== null ) maj["system.usages.utilises"] = sys.usages.utilises + 1;
  if ( (effet?.type === "actif") && (effet.duree > 0) ) {
    maj["system.actif.enCours"] = true;
    maj["system.actif.tours"] = effet.duree;
  }
  if ( Object.keys(maj).length ) await item.update(maj);

  // Message
  const nature = effet?.jet.type ?? "soin";
  const cibles = Array.from(game.user.targets).map(t => ({ token: t.document.uuid, nom: t.name }));
  const verbe = (sys.qualite !== "aucune") ? "Repas" : "Utilisation";
  const contexte = {
    acteur: acteur.name,
    heure: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    type: [verbe, effet?.type === "actif" ? ACTIVATIONS[effet.activation] : null].filter(Boolean).join(" · "),
    titre: item.name,
    description: effet?.type === "actif" && effet.duree ? `Actif pendant ${effet.duree} tour${effet.duree > 1 ? "s" : ""}` : null,
    jet: jet ? {
      total: jet.total,
      formule: effet.jet.formule,
      detail: jet.result,
      soin: nature === "soin",
      typeLabel: nature === "soin" ? "Soin" : `Dégâts · ${TYPES_DEGATS[effet.jet.typeDegats] ?? (effet.jet.typeDegats || "—")}`
    } : null,
    humanite: humanite ? { ...humanite, baisse: cout < 0, cout: cout > 0 ? `+${cout}💀` : `−${Math.abs(cout)}💀`, pct: Math.min(100, Math.round((humanite.apres / Math.max(1, humanite.max)) * 100)) } : null,
    restant: [
      (sys.chargesMax > 0) ? `Charges ${maj["system.chargesRestantes"] ?? sys.chargesRestantes}/${sys.chargesMax}` : null,
      ("system.quantite" in maj) ? `Reste ${maj["system.quantite"]}` : null,
      (sys.utilisationsMax !== null) ? `${Math.max(0, sys.utilisationsMax - (maj["system.usages.utilises"] ?? sys.usages.utilises))}/${sys.utilisationsMax} ${PERIODES[effet.utilisations.periode].toLowerCase()}` : null
    ].filter(Boolean).join(" · "),
    cibles,
    nomSoi: acteur.name
  };
  const contenu = await renderTemplate(`${CHEMIN}/templates/chat/utilisation.hbs`, contexte);
  const source = tokenDe(acteur);
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: acteur, token: source?.document }),
    content: contenu,
    rolls: jet ? [jet] : [],
    flags: { cyberpunk2075: { type: "utilisation", acteur: acteur.uuid, item: item.uuid, total: jet?.total ?? 0, nature } }
  });
}

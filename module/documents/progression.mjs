/**
 * Classe, sous-classe et montée de niveau.
 *
 * - Classe posée : bonus de caractéristiques et eddies ajoutés, talents des niveaux déjà atteints.
 * - Sous-classe posée : 3 maîtrises (fixes ou au choix), pack de démarrage, talents.
 * - Monter : dés de gain (PV, RAM, Humanité max), talents du niveau, maîtrise aux niveaux 2, 4, 6, 7, 9.
 */
import { CHEMIN, CARACS, COMPETENCES, NIVEAUX_MAITRISE } from "../config.mjs";
import { lancerFormule } from "../dice/formules.mjs";

const { renderTemplate } = foundry.applications.handlebars;

const CATEGORIES_PACK = {
  arme: "Arme", implant: "Implant", cyberAccessoire: "Cyber-accessoire", objet: "Objet",
  hack: "Hack", vehicule: "Véhicule", module: "Module de planque", autre: "Autre"
};
export { CATEGORIES_PACK };

/** Formule de gain lisible → jet (« +1d4 », « 0 », « 1d2 »). */
async function gain(formule, acteur) {
  const f = String(formule ?? "").trim().replace(/^\+/, "");
  if ( !f || (f === "0") ) return { total: 0, texte: "+0" };
  const jet = await lancerFormule(f, acteur);
  return { total: Math.max(0, jet.total), texte: `${f} (${jet.total})`, jet };
}

/** Copie sur la fiche des talents référencés (sans doublon de nom). */
async function ajouterTalents(acteur, refs) {
  const presents = new Set(acteur.items.filter(i => i.type === "talent").map(i => i.name));
  const nouveaux = [];
  for ( const ref of refs ) {
    if ( presents.has(ref.nom) ) continue;
    const talent = ref.uuid ? await fromUuid(ref.uuid) : null;
    if ( !talent ) {
      ui.notifications.warn(`Talent introuvable : ${ref.nom}. Vérifie la carte de la classe.`);
      continue;
    }
    const donnees = talent.toObject();
    delete donnees._id;
    nouveaux.push(donnees);
    presents.add(talent.name);
  }
  if ( nouveaux.length ) await acteur.createEmbeddedDocuments("Item", nouveaux, { cpProgression: true });
  return nouveaux.map(t => t.name);
}

/** Message de progression dans le chat. */
async function annoncer(acteur, contexte) {
  const contenu = await renderTemplate(`${CHEMIN}/templates/chat/progression.hbs`, {
    acteur: acteur.name,
    heure: new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
    ...contexte
  });
  return ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: acteur }), content: contenu, rolls: contexte.jets ?? [] });
}

/* -------------------------------------------- */
/*  Classe                                      */
/* -------------------------------------------- */

/**
 * Applique (signe = 1) ou retire (signe = −1) les bonus d'une classe.
 * @param {Actor} acteur
 * @param {Item} classe
 * @param {1|-1} signe
 */
export async function appliquerClasse(acteur, classe, signe = 1) {
  const s = classe.system;
  const maj = {};
  for ( const cle of Object.keys(CARACS) ) {
    const b = s.bonus[cle] ?? 0;
    if ( b ) maj[`system.caracs.${cle}.valeur`] = Math.clamp(acteur.system.caracs[cle].valeur + (signe * b), 0, 10);
  }
  if ( s.eddies ) maj["system.eddies"] = Math.max(0, acteur.system.eddies + (signe * s.eddies));
  if ( Object.keys(maj).length ) await acteur.update(maj);
  if ( signe < 0 ) return;

  const talents = await ajouterTalents(acteur, s.talents.filter(t => t.niveau <= acteur.system.niveau));
  return annoncer(acteur, {
    titre: classe.name,
    type: "Classe",
    lignes: [
      s.texteBonus !== "—" ? `Caractéristiques : ${s.texteBonus}` : null,
      s.eddies ? `Eddies : +${s.eddies.toLocaleString("fr-FR")} €$` : null,
      talents.length ? `Talents : ${talents.join(", ")}` : null,
      "Glisse maintenant la sous-classe sur la fiche."
    ].filter(Boolean)
  });
}

/* -------------------------------------------- */
/*  Sous-classe                                 */
/* -------------------------------------------- */

/** Fenêtre de choix d'une maîtrise parmi une liste. */
async function choisirCompetence(titre, cles, dejaMaitrisees) {
  const options = cles.filter(k => COMPETENCES[k]).map(k => `<option value="${k}" ${dejaMaitrisees.has(k) ? "disabled" : ""}>${COMPETENCES[k].label}${dejaMaitrisees.has(k) ? " (déjà maîtrisée)" : ""}</option>`).join("");
  if ( !options ) return null;
  return foundry.applications.api.DialogV2.wait({
    window: { title: titre },
    classes: ["cp2075", "cp-dialogue"],
    content: `<div class="cp-dlg"><label class="cp-champ"><span class="cp-legende">Compétence maîtrisée</span><select class="cp-inp" name="comp">${options}</select></label></div>`,
    buttons: [{ action: "ok", label: "Choisir", default: true, callback: (e, b) => b.form.elements.comp.value }],
    rejectClose: false
  });
}

/**
 * Pose une sous-classe : maîtrises, pack de démarrage, talents.
 * @param {Actor} acteur
 * @param {Item} sousClasse
 */
export async function appliquerSousClasse(acteur, sousClasse) {
  const s = sousClasse.system;
  const classe = acteur.items.find(i => i.type === "classe");
  const lignes = [];
  if ( s.classeParente && classe && (s.classeParente.toLowerCase() !== classe.name.toLowerCase()) ) {
    lignes.push(`⚠ ${sousClasse.name} appartient à ${s.classeParente}, pas à ${classe.name}.`);
  }

  // Maîtrises
  const maitrisees = new Set(Object.entries(acteur.system.competences).filter(([, c]) => c.maitrise).map(([k]) => k));
  const choisies = [];
  for ( const m of s.maitrises ) {
    let cle = m.competence;
    if ( !cle ) {
      const permises = m.choix ? m.choix.split(",").map(x => x.trim()).filter(Boolean) : Object.keys(COMPETENCES);
      cle = await choisirCompetence(`${sousClasse.name} · maîtrise au choix`, permises, maitrisees);
    }
    if ( cle && COMPETENCES[cle] && !maitrisees.has(cle) ) {
      maitrisees.add(cle);
      choisies.push(cle);
    }
  }
  if ( choisies.length ) {
    await acteur.update(Object.fromEntries(choisies.map(k => [`system.competences.${k}.maitrise`, true])));
    lignes.push(`Maîtrises : ${choisies.map(k => COMPETENCES[k].label).join(", ")}`);
  }

  // Pack de démarrage : items précis copiés, le reste en rappel
  const aCreer = [];
  const rappels = [];
  for ( const p of s.pack ) {
    if ( p.mode !== "precis" ) {
      rappels.push(`${p.quantite} ${CATEGORIES_PACK[p.categorie] ?? p.categorie} ${p.mode === "gratuit" ? "gratuit" : "au choix"}${p.prixMax ? ` (≤ ${p.prixMax.toLocaleString("fr-FR")} €$)` : ""}${p.texte ? ` · ${p.texte}` : ""}`);
      continue;
    }
    const source = p.uuid ? await fromUuid(p.uuid) : null;
    if ( !source ) {
      rappels.push(`${p.nom} (introuvable : à ajouter à la main)`);
      continue;
    }
    const donnees = source.toObject();
    delete donnees._id;
    if ( "niveau" in (donnees.system ?? {}) ) donnees.system.niveau = p.niveau;
    if ( ("quantite" in (donnees.system ?? {})) ) {
      donnees.system.quantite = p.quantite;
      aCreer.push(donnees);
    } else {
      for ( let i = 0; i < p.quantite; i++ ) aCreer.push(foundry.utils.deepClone(donnees));
    }
  }
  if ( aCreer.length ) {
    await acteur.createEmbeddedDocuments("Item", aCreer);
    lignes.push(`Pack : ${s.pack.filter(p => p.mode === "precis" && p.uuid).map(p => `${p.quantite > 1 ? `${p.quantite} ` : ""}${p.nom}`).join(", ")}`);
  }

  const talents = await ajouterTalents(acteur, s.talents.filter(t => t.niveau <= acteur.system.niveau));
  if ( talents.length ) lignes.push(`Talents : ${talents.join(", ")}`);

  return annoncer(acteur, { titre: sousClasse.name, type: "Sous-classe", lignes, rappels });
}

/* -------------------------------------------- */
/*  Montée de niveau                            */
/* -------------------------------------------- */

/** Monte d'un niveau : dés de gain, talents, maîtrise éventuelle. */
export async function monterNiveau(acteur) {
  const s = acteur.system;
  if ( s.niveau >= 10 ) return ui.notifications.info(`${acteur.name} est déjà au niveau 10.`);
  const classe = acteur.items.find(i => i.type === "classe");
  const sousClasse = acteur.items.find(i => i.type === "sousClasse");
  if ( !classe ) ui.notifications.warn("Pas de classe sur la fiche : seuls le niveau et la maîtrise changent.");
  const n = s.niveau + 1;
  const jets = [];

  const g = classe?.system.gains ?? { vie: "0", ram: "0", humanite: "0" };
  const vie = await gain(g.vie, acteur);
  const ram = await gain(g.ram, acteur);
  const hum = await gain(g.humanite, acteur);
  for ( const x of [vie, ram, hum] ) if ( x.jet ) jets.push(x.jet);

  await acteur.update({
    "system.niveau": n,
    "system.vie.gains": s.vie.gains + vie.total,
    "system.vie.value": s.vie.value + vie.total,
    "system.ram.gains": s.ram.gains + ram.total,
    "system.ram.value": s.ram.value + ram.total,
    "system.humanite.gains": s.humanite.gains + hum.total
  });

  const refs = [
    ...(classe?.system.talents ?? []).filter(t => t.niveau === n),
    ...(sousClasse?.system.talents ?? []).filter(t => t.niveau === n)
  ];
  const talents = await ajouterTalents(acteur, refs);

  let maitrise = null;
  if ( NIVEAUX_MAITRISE.includes(n) ) {
    const deja = new Set(Object.entries(acteur.system.competences).filter(([, c]) => c.maitrise).map(([k]) => k));
    const cle = await choisirCompetence(`Niveau ${n} · nouvelle maîtrise`, Object.keys(COMPETENCES), deja);
    if ( cle && COMPETENCES[cle] ) {
      await acteur.update({ [`system.competences.${cle}.maitrise`]: true });
      maitrise = COMPETENCES[cle].label;
    }
  }

  return annoncer(acteur, {
    titre: `Niveau ${n}`,
    type: "Montée de niveau",
    lignes: [
      `PV max ${vie.texte}`,
      `RAM max ${ram.texte}`,
      `Humanité max ${hum.texte}`,
      talents.length ? `Talents : ${talents.join(", ")}` : null,
      maitrise ? `Nouvelle maîtrise : ${maitrise}` : (NIVEAUX_MAITRISE.includes(n) ? "Maîtrise à choisir en mode édition" : null),
      (n === 5) || (n === 9) ? "Bonus de maîtrise en hausse" : null
    ].filter(Boolean),
    jets
  });
}

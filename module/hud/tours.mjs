/**
 * Tours hors combat (bouton du MJ en haut à gauche) et zones persistantes (nuage toxique…).
 * Passer un tour : −1 au compte à rebours de cyberpsychose, aux effets actifs des items
 * et aux zones de la scène (qui infligent leurs dégâts à chaque tour).
 */
import { CHEMIN, TYPES_DEGATS } from "../config.mjs";
import { tourDeCombat } from "../documents/humanite.mjs";
import { combatEnCours, lancerCombat, finirCombat, tourSuivantCombat } from "./combat.mjs";
import { retirerTousLesPings } from "./pings.mjs";

const renderTemplate = (...args) => foundry.applications.handlebars.renderTemplate(...args);
const heure = () => new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
const note = texte => ChatMessage.create({ content: `<div class="cp-msg"><div class="cp-msg-note">${texte}</div></div>` });

/** Le client qui fait les modifications (un seul MJ actif). */
export const estMJActif = () => game.users.activeGM?.id === game.user.id;

/* -------------------------------------------- */
/*  Effets actifs des items                     */
/* -------------------------------------------- */

/** Un tour de moins sur les effets actifs des items d'un acteur. */
export async function decompterEffets(acteur) {
  const majs = [];
  for ( const item of acteur.items ) {
    const a = item.system.actif;
    if ( !a?.enCours ) continue;
    const tours = Math.max(0, a.tours - 1);
    majs.push({ _id: item.id, "system.actif.tours": tours, "system.actif.enCours": tours > 0 });
    if ( tours === 0 ) ChatMessage.create({ content: `<div class="cp-msg"><div class="cp-msg-note">${acteur.name} : fin de l'effet de ${item.name}.</div></div>`, speaker: ChatMessage.getSpeaker({ actor: acteur }) });
  }
  if ( majs.length ) await acteur.updateEmbeddedDocuments("Item", majs);
}

/* -------------------------------------------- */
/*  Zones persistantes                          */
/* -------------------------------------------- */

/** Crée la tuile animée d'une zone persistante (MJ). */
export async function creerZonePersistante(z) {
  const scene = game.scenes.get(z.scene);
  if ( !scene || !z.texture ) return;
  const dims = scene.dimensions;
  const r = (z.rayon / dims.distance) * dims.size;
  await scene.createEmbeddedDocuments("Tile", [{
    texture: { src: z.texture },
    x: Math.round(z.x - r), y: Math.round(z.y - r), width: Math.round(2 * r), height: Math.round(2 * r),
    alpha: 0.85, locked: true,
    video: { loop: true, autoplay: true, volume: 0 },
    flags: { cyberpunk2075: { zone: { nom: z.nom, tours: z.tours, rayon: z.rayon, degats: z.degats, typeDegats: z.typeDegats, faitDegats: z.faitDegats, lanceur: z.lanceur ?? null, lanceurToken: z.lanceurToken ?? null, effetFin: z.effetFin ?? null, message: z.message ?? null } } }
  }]);
}

/** Tokens visibles dont le centre est dans le rayon (m) autour d'un point. */
function tokensDans(centre, rayon) {
  return canvas.tokens.placeables.filter(t => {
    if ( !t.actor || t.document.hidden ) return false;
    try { return canvas.grid.measurePath([centre, t.center]).distance <= rayon; } catch { return false; }
  });
}

const centreDe = tuile => ({ x: tuile.x + tuile.width / 2, y: tuile.y + tuile.height / 2 });

/** Dégâts de la zone sur des tokens (tous ceux dedans par défaut). */
async function degatsZone(tuile, tokens = null) {
  const z = tuile.flags.cyberpunk2075.zone;
  if ( (z.faitDegats === false) || !z.degats ) return;
  tokens ??= tokensDans(centreDe(tuile), z.rayon);
  const jet = await new Roll(z.degats).evaluate();
  const total = Math.max(1, jet.total);
  const contenu = await renderTemplate(`${CHEMIN}/templates/chat/degats.hbs`, {
    acteur: z.nom, heure: heure(), titre: z.nom, typeDegats: TYPES_DEGATS[z.typeDegats] ?? z.typeDegats ?? "", typeCle: z.typeDegats,
    total, detail: `${z.degats} (${jet.dice[0]?.results.map(r => r.result).join(", ") ?? "—"})`,
    zone: `Zone · encore ${z.tours} tour(s)`,
    cibles: tokens.map(t => ({ token: t.document.uuid, nom: t.name, montant: total })),
    sansCible: !tokens.length, plusieurs: tokens.length > 1,
    arretZone: tuile.uuid
  });
  await ChatMessage.create({ content: contenu, rolls: [jet], flags: { cyberpunk2075: { type: "degats", total } } });
}

/** Un tour de moins pour la zone (la tuile disparaît à 0). Renvoie true si elle a disparu. */
async function decompterZone(tuile) {
  const z = tuile.flags.cyberpunk2075.zone;
  const tours = z.tours - 1;
  if ( tours <= 0 ) {
    await tuile.delete();
    await note(`${z.nom} : la zone se dissipe.`);
    return true;
  }
  await tuile.update({ "flags.cyberpunk2075.zone.tours": tours });
  return false;
}

/** Hors combat : dégâts à tous ceux dans la zone, puis un tour de moins. */
async function tourDeZone(tuile) {
  await degatsZone(tuile);
  await decompterZone(tuile);
}

/**
 * En combat, au début du tour d'un combattant :
 * - les zones qu'il a lancées perdent un tour (elles disparaissent au début de son tour) ;
 * - s'il se trouve dans une zone encore active, il en subit les dégâts.
 */
export async function zonesAuTourDe(combattant) {
  const scene = combattant.combat?.scene ?? canvas?.scene;
  if ( !scene ) return;
  const tuiles = scene.tiles.filter(t => t.flags?.cyberpunk2075?.zone);
  const tokenUuid = combattant.token?.uuid;
  const acteurUuid = combattant.actor?.uuid;
  for ( const tuile of tuiles ) {
    const z = tuile.flags.cyberpunk2075.zone;
    const sienne = (z.lanceurToken && (z.lanceurToken === tokenUuid)) || (!z.lanceurToken && z.lanceur && (z.lanceur === acteurUuid));
    if ( sienne && await decompterZone(tuile) ) continue;
    const token = combattant.token?.object;
    if ( !token || (canvas?.scene?.id !== scene.id) ) continue;
    const dedans = tokensDans(centreDe(tuile), z.rayon).includes(token);
    if ( dedans ) await degatsZone(tuile, [token]);
  }
}

/* -------------------------------------------- */
/*  Passer un tour                              */
/* -------------------------------------------- */

export async function passerTour() {
  if ( !game.user.isGM ) return;

  // En combat : compteur +1, retour au premier de l'ordre (les effets se décomptent au tour de chacun)
  const combat = combatEnCours();
  if ( combat ) return tourSuivantCombat(combat);

  await note("<b>Tour suivant</b>");
  await retirerTousLesPings();

  // Acteurs : personnages du monde et acteurs des tokens de la scène affichée (ennemis non liés)
  const acteurs = new Map();
  for ( const a of game.actors ) if ( ["personnage", "ennemi"].includes(a.type) ) acteurs.set(a.uuid, a);
  for ( const t of canvas?.tokens?.placeables ?? [] ) if ( t.actor && !t.document.actorLink ) acteurs.set(t.actor.uuid, t.actor);
  for ( const a of acteurs.values() ) {
    if ( a.type === "personnage" ) await tourDeCombat(a);
    await decompterEffets(a);
  }

  // Zones persistantes de la scène affichée
  for ( const tuile of canvas?.scene?.tiles.filter(t => t.flags?.cyberpunk2075?.zone) ?? [] ) await tourDeZone(tuile);
}

/** Boutons du MJ en haut à gauche : « Lancer le combat » / « Mettre fin au combat », puis « Tour suivant ». */
export function ajouterBoutonTour() {
  if ( !game.user.isGM || document.getElementById("cp-mj-combat") ) return;
  const boite = document.createElement("div");
  boite.id = "cp-mj-combat";
  boite.className = "cp2075";

  const combat = document.createElement("button");
  combat.type = "button";
  combat.id = "cp-bouton-combat";
  combat.addEventListener("click", async () => {
    combat.disabled = true;
    try { await (combatEnCours() ? finirCombat() : lancerCombat()); }
    catch (err) { console.error("Cyberpunk 2075 |", err); ui.notifications.error(`Combat : ${err.message}`); }
    combat.disabled = false;
    majBoutonCombat();
  });

  const bouton = document.createElement("button");
  bouton.id = "cp-tour-suivant";
  bouton.type = "button";
  bouton.title = "Passer un tour : compte à rebours de cyberpsychose, effets actifs et zones persistantes";
  bouton.innerHTML = `<span aria-hidden="true">⏭</span> Tour suivant`;
  bouton.addEventListener("click", async () => {
    bouton.disabled = true;
    try { await passerTour(); } catch (err) { console.error("Cyberpunk 2075 |", err); ui.notifications.error(`Tour suivant impossible : ${err.message}`); }
    bouton.disabled = false;
  });

  boite.append(combat, bouton);
  // Dans la zone du haut, avant la navigation des scènes ; sinon en position fixe
  const haut = document.getElementById("ui-top");
  if ( haut ) haut.prepend(boite);
  else {
    boite.classList.add("cp-tour-fixe");
    document.body.append(boite);
  }
  majBoutonCombat();
}

/** Libellé du bouton de combat selon l'état. */
export function majBoutonCombat() {
  const b = document.getElementById("cp-bouton-combat");
  if ( !b ) return;
  const enCours = !!combatEnCours();
  b.classList.toggle("cp-combat-en-cours", enCours);
  b.innerHTML = enCours ? `<span aria-hidden="true">■</span> Mettre fin au combat` : `<span aria-hidden="true">⚔</span> Lancer le combat`;
  b.title = enCours ? "Terminer le combat (confirmation demandée)" : "Lancer le combat avec tous les personnages et ennemis visibles de la scène";
}

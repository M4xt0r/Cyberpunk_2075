/**
 * C4 : la charge se pose sur une case (le personnage va sur la case voisine la plus proche),
 * puis explose sur commande. Le bouton « EXPLOSER » au-dessus de la charge n'apparaît
 * que pour le poseur et le MJ ; le message de pose a aussi un bouton.
 * La charge est une tuile posée par le MJ actif (les joueurs ne peuvent pas créer de tuiles).
 */
import { CHEMIN } from "../config.mjs";
import { choisirPoint } from "./viser.mjs";
import { lancerDegats, tokenDe } from "../dice/attaque.mjs";

/** Image de la charge posée. */
export const IMAGE_C4 = `${CHEMIN}/assets/tokens/objets/c4.webp`;

const estMJActif = () => game.users.activeGM?.id === game.user.id;
const donneesC4 = tuile => tuile?.flags?.cyberpunk2075?.c4 ?? null;
const peutExploser = c => !!c && (game.user.isGM || (c.user === game.user.id));

/* -------------------------------------------- */
/*  Pose                                        */
/* -------------------------------------------- */

/** Case voisine de la cible la plus proche du token, libre et sans mur entre les deux. */
function caseVoisine(token, cible) {
  const s = canvas.grid.size;
  const w = token.document.width * s;
  const h = token.document.height * s;
  const centre = token.center;
  // Déjà au contact : pas de déplacement
  if ( (Math.abs(centre.x - cible.x) <= (w / 2) + (s / 2) + 1) && (Math.abs(centre.y - cible.y) <= (h / 2) + (s / 2) + 1) ) return null;
  const { sceneX, sceneY, sceneWidth, sceneHeight } = canvas.dimensions;
  const autres = canvas.tokens.placeables.filter(t => (t !== token) && !t.document.hidden);
  const candidats = [];
  for ( const dx of [-1, 0, 1] ) for ( const dy of [-1, 0, 1] ) {
    if ( !dx && !dy ) continue;
    const c = { x: cible.x + dx * ((s / 2) + (w / 2)), y: cible.y + dy * ((s / 2) + (h / 2)) };
    const x = c.x - (w / 2);
    const y = c.y - (h / 2);
    if ( (x < sceneX) || (y < sceneY) || (x + w > sceneX + sceneWidth) || (y + h > sceneY + sceneHeight) ) continue;
    const occupe = autres.some(t => (x < t.x + t.w - 1) && (x + w > t.x + 1) && (y < t.y + t.h - 1) && (y + h > t.y + 1));
    if ( occupe ) continue;
    let mur = false;
    try { mur = CONFIG.Canvas.polygonBackends.move.testCollision(cible, c, { type: "move", mode: "any" }); } catch {}
    if ( mur ) continue;
    candidats.push({ x, y, d: Math.hypot(c.x - centre.x, c.y - centre.y) });
  }
  candidats.sort((a, b) => a.d - b.d);
  return candidats[0] ?? null;
}

/** Le joueur pose une charge : choix de la case, déplacement, puis message (le MJ pose la tuile). */
export async function poserC4(item) {
  const acteur = item.actor;
  const sys = item.system;
  if ( (sys.quantite ?? 1) <= 0 ) return ui.notifications.warn(`${item.name} : plus aucune charge.`);
  const brut = await choisirPoint(item, { texte: `${item.name} : clique sur la case où poser la charge (clic droit ou Échap pour annuler).` });
  if ( !brut ) return null;
  const cible = canvas.grid.getCenterPoint(brut);

  const token = tokenDe(acteur);
  if ( token ) {
    const dest = caseVoisine(token, cible);
    if ( dest ) {
      try {
        await token.document.update({ x: dest.x, y: dest.y });
        await new Promise(r => setTimeout(r, 450));
      } catch (err) {
        ui.notifications.warn(`${acteur.name} ne peut pas rejoindre cette case : ${err.message}`);
        return null;
      }
    }
  }
  await item.update({ "system.quantite": Math.max(0, (sys.quantite ?? 1) - 1) });

  const c4 = {
    scene: canvas.scene.id, x: Math.round(cible.x), y: Math.round(cible.y),
    item: item.uuid, nom: item.name, lanceur: acteur.uuid, lanceurToken: token?.document?.uuid ?? null, user: game.user.id
  };
  return ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: acteur, token: token?.document }),
    content: `<div class="cp-msg">
      <div class="cp-msg-note">${acteur.name} pose une charge de ${item.name}.</div>
      <div class="cp-msg-boutons cp-c4-boutons"><button type="button" class="cp-msg-bt" data-cp-action="exploserC4">Faire exploser</button>
      <span class="cp-msg-source cp-pousse">poseur et MJ</span></div>
    </div>`,
    flags: { cyberpunk2075: { type: "c4", c4 } }
  });
}

/** MJ actif : pose la tuile de la charge (à la création du message de pose). */
export async function poserTuileC4(c4, messageId) {
  if ( !estMJActif() ) return;
  const scene = game.scenes.get(c4.scene);
  if ( !scene ) return;
  const s = scene.grid.size;
  const t = Math.round(s * 0.8);
  await scene.createEmbeddedDocuments("Tile", [{
    texture: { src: IMAGE_C4 },
    x: Math.round(c4.x - t / 2), y: Math.round(c4.y - t / 2), width: t, height: t,
    locked: true,
    flags: { cyberpunk2075: { c4: { ...c4, message: messageId } } }
  }]);
}

/* -------------------------------------------- */
/*  Explosion                                   */
/* -------------------------------------------- */

const enCours = new Set();

/** Fait exploser une charge (poseur ou MJ) : dégâts dans la zone, puis le MJ retire la tuile. */
export async function exploserC4(tuileOuUuid) {
  const tuile = (typeof tuileOuUuid === "string") ? await fromUuid(tuileOuUuid).catch(() => null) : tuileOuUuid;
  const c = donneesC4(tuile);
  if ( !c ) return ui.notifications.info("Cette charge a déjà explosé.");
  if ( !peutExploser(c) ) return ui.notifications.warn("Seuls le poseur et le MJ peuvent déclencher cette charge.");
  if ( enCours.has(tuile.uuid) ) return;
  enCours.add(tuile.uuid);
  try {
    const item = await fromUuid(c.item).catch(() => null);
    if ( !item?.actor ) return ui.notifications.warn(`${c.nom} : l'objet n'est plus sur le personnage, dégâts impossibles à calculer.`);
    const centre = { x: tuile.x + tuile.width / 2, y: tuile.y + tuile.height / 2 };
    await lancerDegats(item, { avecAnimation: true, point: centre, explosionPosee: true, drapeaux: { retirerTuile: tuile.uuid } });
  } finally {
    setTimeout(() => enCours.delete(tuile.uuid), 3000);
  }
}

/** Bouton du message de pose : retrouve la charge posée par ce message. */
export function exploserDepuisMessage(message) {
  const tuile = game.scenes.map(s => s.tiles.find(t => donneesC4(t)?.message === message.id)).find(Boolean);
  if ( !tuile ) return ui.notifications.info("Cette charge a déjà explosé.");
  return exploserC4(tuile);
}

/** MJ actif : retire la charge une fois l'explosion jouée. */
export async function retirerTuileExplosee(uuid) {
  if ( !estMJActif() ) return;
  const tuile = await fromUuid(uuid).catch(() => null);
  if ( tuile ) await tuile.delete();
}

/* -------------------------------------------- */
/*  Bouton « EXPLOSER » sur la charge           */
/* -------------------------------------------- */

let calque = null;

export function dessinerBoutonsC4() {
  if ( calque && !calque.destroyed ) calque.destroy({ children: true });
  calque = null;
  if ( !canvas?.ready ) return;
  const charges = canvas.scene.tiles.filter(t => peutExploser(donneesC4(t)));
  if ( !charges.length ) return;
  calque = new PIXI.Container();
  calque.eventMode = "passive";
  calque.zIndex = 8000;
  for ( const t of charges ) {
    const b = new PIXI.Container();
    b.eventMode = "static";
    b.cursor = "pointer";
    const fond = new PIXI.Graphics();
    fond.lineStyle(3, 0x16151C, 1).beginFill(0xFF2F3A, 1).drawRoundedRect(-48, -15, 96, 30, 6).endFill();
    const texte = new PIXI.Text("EXPLOSER", { fontFamily: "Rajdhani, Arial, sans-serif", fontSize: 16, fontWeight: "700", fill: 0x16151C, letterSpacing: 1 });
    texte.anchor.set(0.5);
    b.addChild(fond, texte);
    b.position.set(t.x + t.width / 2, t.y + t.height + 20);
    b.on("pointerover", () => b.scale.set(1.08));
    b.on("pointerout", () => b.scale.set(1));
    b.on("pointerdown", ev => {
      ev.stopPropagation();
      if ( ev.button !== 0 ) return;
      b.eventMode = "none";
      b.alpha = 0.4;
      exploserC4(t).finally(() => { if ( !b.destroyed ) { b.eventMode = "static"; b.alpha = 1; } });
    });
    calque.addChild(b);
  }
  canvas.stage.addChild(calque);
}

export function brancherC4() {
  const siC4 = doc => { if ( donneesC4(doc) && (doc.parent?.id === canvas?.scene?.id) ) dessinerBoutonsC4(); };
  Hooks.on("canvasReady", dessinerBoutonsC4);
  Hooks.on("canvasTearDown", () => { if ( calque && !calque.destroyed ) calque.destroy({ children: true }); calque = null; });
  Hooks.on("createTile", siC4);
  Hooks.on("updateTile", siC4);
  Hooks.on("deleteTile", siC4);
}

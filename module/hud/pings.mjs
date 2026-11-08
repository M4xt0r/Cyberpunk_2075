/**
 * Marqueurs du hack Ping : une marque rouge en boucle sur chaque ennemi détecté, visible à travers
 * les murs et même si le token est invisible, mais seulement pour le lanceur et le MJ.
 * Les marques sont gardées dans les drapeaux de la scène (écrits par le MJ actif)
 * et disparaissent au début du prochain tour du lanceur (ou au « Tour suivant » hors combat).
 */
import { ANIM } from "../config.mjs";

const MARQUE = `${ANIM}/impacts/ping_marque.webm`;
const estMJActif = () => game.users.activeGM?.id === game.user.id;

let calque = null;
let marques = [];   // { sprite, texture, video }

const pingsDe = scene => foundry.utils.deepClone(scene?.flags?.cyberpunk2075?.pings ?? []);

/* -------------------------------------------- */
/*  Données (MJ actif)                          */
/* -------------------------------------------- */

/** Ajoute les marques d'un ping (appelé par le MJ actif à la création du message). */
export async function ajouterPings(p) {
  if ( !estMJActif() || !p?.cibles?.length ) return;
  const scene = game.scenes.get(p.scene);
  if ( !scene ) return;
  const liste = pingsDe(scene).filter(x => !(p.cibles.includes(x.cible) && (x.lanceurToken === p.lanceurToken)));
  for ( const cible of p.cibles ) liste.push({ cible, lanceurToken: p.lanceurToken, lanceur: p.lanceur, voient: p.voient ?? [] });
  await scene.setFlag("cyberpunk2075", "pings", liste);
}

/** Retire les marques posées par un combattant (début de son tour). */
export async function retirerPingsDe(combattant) {
  if ( !estMJActif() ) return;
  const scene = combattant.combat?.scene ?? canvas?.scene;
  const liste = pingsDe(scene);
  if ( !liste.length ) return;
  const sienne = x => x.lanceurToken ? (x.lanceurToken === combattant.tokenId) : (x.lanceur === combattant.actor?.uuid);
  const reste = liste.filter(x => !sienne(x));
  if ( reste.length !== liste.length ) await scene.setFlag("cyberpunk2075", "pings", reste);
}

/** Retire toutes les marques de la scène (Tour suivant hors combat). */
export async function retirerTousLesPings(scene = canvas?.scene) {
  if ( !estMJActif() || !pingsDe(scene).length ) return;
  await scene.setFlag("cyberpunk2075", "pings", []);
}

/* -------------------------------------------- */
/*  Affichage (chaque client)                   */
/* -------------------------------------------- */

function vider() {
  for ( const m of marques ) {
    try { m.video?.pause(); m.sprite.destroy(); m.clone && m.texture.destroy(true); } catch {}
  }
  marques = [];
}

function conteneur() {
  if ( !calque || calque.destroyed || !calque.parent ) {
    calque = new PIXI.Container();
    calque.eventMode = "none";
    calque.zIndex = 9999;
    canvas.interface.sortableChildren = true;
    canvas.interface.addChild(calque);
  }
  return calque;
}

/** Redessine les marques visibles par cet utilisateur sur la scène affichée. */
export async function dessinerPings() {
  vider();
  if ( !canvas?.ready ) return;
  const liste = pingsDe(canvas.scene).filter(x => game.user.isGM || (x.voient ?? []).includes(game.user.id));
  if ( !liste.length ) return;
  let base;
  try { base = await (foundry.canvas.loadTexture ?? globalThis.loadTexture)(MARQUE); } catch { return; }
  if ( !base ) return;
  for ( const x of liste ) {
    const doc = canvas.scene.tokens.get(x.cible);
    if ( !doc ) continue;
    const taille = Math.max(doc.width, doc.height) * canvas.dimensions.size * 1.5;
    let texture = base;
    let clone = false;
    const source = base.baseTexture?.resource?.source;
    if ( source && game.video?.cloneTexture ) {
      try { texture = await game.video.cloneTexture(source); clone = true; } catch {}
    }
    const sprite = new PIXI.Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.width = sprite.height = taille;
    sprite.position.set(doc.x + (doc.width * canvas.dimensions.size) / 2, doc.y + (doc.height * canvas.dimensions.size) / 2);
    conteneur().addChild(sprite);
    const video = texture.baseTexture?.resource?.source ?? null;
    if ( video ) game.video.play(video, { loop: true, volume: 0 });
    marques.push({ sprite, texture, video, clone });
  }
}

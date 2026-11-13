/**
 * Scènes qui défilent (course-poursuite) : la route se lance ou s'arrête avec le bouton
 * « Défilement » du MJ. L'état est gardé dans les drapeaux de la scène
 * (cyberpunk2075.defilement.actif) et appliqué par chaque client.
 *
 * Fond en image « doublée » (deux fois la route l'une sous l'autre) : chaque client fait glisser
 * une fenêtre sur l'image à chaque image du canevas, sans vidéo à décoder (fluide).
 * Les anciennes scènes à fond vidéo (.webm) restent gérées en lecture/pause.
 */

/** Vitesse de défilement (px/s) à vitesse 1. */
const VITESSE = 600;

/** Remplacement des anciens fonds vidéo par les images à défilement fluide. */
const NOUVEAUX_FONDS = {
  "route_badlands.webm": "route_badlands_defil.webp",
  "route_ville.webm": "route_ville_defil.webp",
  "route_ville_double.webm": "route_ville_double_defil.webp"
};

let glisse = null;   // { mesh, tex, periode, decalage, tick }

let avertiFps = false;
const etat = scene => scene?.flags?.cyberpunk2075?.defilement;
export const sceneDefilante = scene => !!etat(scene);

/** La vidéo du fond de la scène affichée (s'il y en a une). */
function videoDuFond() {
  const tex = canvas?.primary?.background?.texture;
  const src = tex?.baseTexture?.resource?.source ?? tex?.source?.resource;
  return (src instanceof HTMLVideoElement) ? src : null;
}

/** Arrête le glissement (changement de scène). */
function arreterGlisse() {
  if ( !glisse ) return;
  try { canvas.app.ticker.remove(glisse.tick); } catch {}
  glisse = null;
}

/** Fond en image doublée : prépare la fenêtre qui glisse. Renvoie false si le fond n'est pas de ce type. */
function preparerGlisse() {
  const mesh = canvas.primary?.background;
  const base = mesh?.texture?.baseTexture;
  if ( !mesh || !base?.valid ) return false;
  if ( glisse?.mesh === mesh ) return true;
  arreterGlisse();
  const { sceneWidth: lw, sceneHeight: lh } = canvas.dimensions;
  const periode = base.height / 2;
  // L'image doit contenir deux fois la route : hauteur ≈ 2 × (hauteur de scène à la même échelle)
  if ( Math.abs((periode / base.width) - (lh / lw)) > 0.02 ) return false;
  const tex = new PIXI.Texture(base, new PIXI.Rectangle(0, periode, base.width, periode));
  const { x, y } = mesh.position;
  mesh.texture = tex;
  mesh.position.set(x, y);
  mesh.width = lw;
  mesh.height = lh;
  glisse = { mesh, tex, periode, decalage: 0, tick: null };
  glisse.tick = () => {
    const e = etat(canvas.scene);
    if ( !glisse || mesh.destroyed ) return arreterGlisse();
    if ( !e?.actif ) return;
    const v = VITESSE * (Number(e.vitesse) || 1) * (base.height / 2 / lh);
    glisse.decalage = (glisse.decalage + v * canvas.app.ticker.deltaMS / 1000) % periode;
    tex.frame.y = periode - glisse.decalage;
    tex.updateUvs();
  };
  canvas.app.ticker.add(glisse.tick);
  return true;
}

/** Applique l'état de défilement de la scène affichée sur ce client. */
export function appliquerDefilement() {
  if ( !canvas?.ready ) return;
  const e = etat(canvas.scene);
  if ( !e ) { arreterGlisse(); return majBoutonDefilement(); }
  if ( preparerGlisse() ) return majBoutonDefilement();
  const video = videoDuFond();
  if ( !video ) return majBoutonDefilement();
  video.loop = true;
  video.muted = true;
  video.playbackRate = Number(e.vitesse) || 1;
  if ( e.actif ) {
    video.play().catch(() => null);
    // Le canevas doit tourner à 60 images/s pour que la route défile sans à-coups
    let ips = 60;
    try { ips = Number(game.settings.get("core", "maxFPS")) || 60; } catch {}
    if ( (ips < 60) && !avertiFps ) {
      avertiFps = true;
      ui.notifications.info(`La route peut saccader : Foundry est limité à ${ips} images/s. Réglages → Paramètres de base → Images par seconde maximum : 60.`);
    }
  }
  else video.pause();
  majBoutonDefilement();
}

/** MJ : lance ou arrête le défilement. */
export async function basculerDefilement() {
  const scene = canvas?.scene;
  if ( !game.user.isGM || !sceneDefilante(scene) ) return;
  await scene.setFlag("cyberpunk2075", "defilement.actif", !etat(scene).actif);
}

/** Bouton du MJ, sous « Tour suivant », seulement sur une scène qui défile. */
export function majBoutonDefilement() {
  if ( !game.user.isGM ) return;
  const boite = document.getElementById("cp-mj-combat");
  if ( !boite ) return;
  let b = document.getElementById("cp-defilement");
  const e = etat(canvas?.scene);
  if ( !e ) return b?.remove();
  if ( !b ) {
    b = document.createElement("button");
    b.type = "button";
    b.id = "cp-defilement";
    b.addEventListener("click", async () => {
      b.disabled = true;
      try { await basculerDefilement(); } finally { b.disabled = false; }
    });
    boite.append(b);
  }
  b.classList.toggle("cp-defilement-actif", !!e.actif);
  b.innerHTML = e.actif ? `<span aria-hidden="true">■</span> Arrêter la route` : `<span aria-hidden="true">▶</span> Faire défiler la route`;
  b.title = e.actif ? "Arrêter le défilement de la route (pour tous)" : "Lancer le défilement de la route (pour tous)";
}

/** MJ : les scènes de poursuite déjà importées passent de la vidéo à l'image fluide. */
export async function migrerFondsDefilement() {
  if ( game.users.activeGM?.id !== game.user.id ) return;
  for ( const scene of game.scenes ) {
    if ( !sceneDefilante(scene) ) continue;
    const src = scene.background?.src ?? "";
    const nom = src.split("/").pop();
    if ( !NOUVEAUX_FONDS[nom] ) continue;
    await scene.update({ "background.src": src.replace(nom, NOUVEAUX_FONDS[nom]) });
  }
}

export function brancherDefilement() {
  Hooks.on("canvasTearDown", arreterGlisse);
  Hooks.on("canvasReady", () => {
    appliquerDefilement();
    // La vidéo peut ne démarrer qu'un instant après le dessin de la scène
    setTimeout(appliquerDefilement, 500);
  });
  Hooks.on("updateScene", (scene, changes) => {
    if ( (scene.id === canvas?.scene?.id) && foundry.utils.hasProperty(changes, "flags.cyberpunk2075") ) appliquerDefilement();
  });
}

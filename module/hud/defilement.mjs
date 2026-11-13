/**
 * Scènes qui défilent (course-poursuite) : le fond vidéo en boucle se lance ou s'arrête
 * avec le bouton « Défilement » du MJ. L'état est gardé dans les drapeaux de la scène
 * (cyberpunk2075.defilement.actif) et appliqué par chaque client.
 */

let avertiFps = false;
const etat = scene => scene?.flags?.cyberpunk2075?.defilement;
export const sceneDefilante = scene => !!etat(scene);

/** La vidéo du fond de la scène affichée (s'il y en a une). */
function videoDuFond() {
  const tex = canvas?.primary?.background?.texture;
  const src = tex?.baseTexture?.resource?.source ?? tex?.source?.resource;
  return (src instanceof HTMLVideoElement) ? src : null;
}

/** Applique l'état de défilement de la scène affichée sur ce client. */
export function appliquerDefilement() {
  if ( !canvas?.ready ) return;
  const e = etat(canvas.scene);
  const video = videoDuFond();
  if ( !e || !video ) return majBoutonDefilement();
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

export function brancherDefilement() {
  Hooks.on("canvasReady", () => {
    appliquerDefilement();
    // La vidéo peut ne démarrer qu'un instant après le dessin de la scène
    setTimeout(appliquerDefilement, 500);
  });
  Hooks.on("updateScene", (scene, changes) => {
    if ( (scene.id === canvas?.scene?.id) && foundry.utils.hasProperty(changes, "flags.cyberpunk2075") ) appliquerDefilement();
  });
}

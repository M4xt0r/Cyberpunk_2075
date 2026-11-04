/**
 * Animations du système, sans module externe.
 * Projectile (PNG qui se déplace, 1 seconde maximum quelle que soit la distance),
 * impact (WebM sur la cible), zone (WebM à la taille du rayon), sur soi.
 */

const VITESSE_CASES = 30;   // cases par seconde : au-delà de 30 cases, le trajet dure 1 s
const DUREE_MAX = 1000;
const DUREE_MIN = 120;

let conteneur = null;

function calque() {
  if ( !conteneur || conteneur.destroyed || !conteneur.parent ) {
    conteneur = new PIXI.Container();
    conteneur.eventMode = "none";
    canvas.interface.addChild(conteneur);
  }
  return conteneur;
}

const charger = src => (foundry.canvas?.loadTexture ?? globalThis.loadTexture)(src);
const estVideo = src => foundry.helpers?.media?.VideoHelper?.hasVideoExtension?.(src) ?? /\.(webm|mp4|ogv|m4v)$/i.test(src);
const attendre = ms => new Promise(r => setTimeout(r, ms));

/** Fait progresser t de 0 à 1 sur la durée donnée. */
function animer(duree, pas) {
  return new Promise(resoudre => {
    const debut = performance.now();
    const tic = () => {
      const t = Math.min(1, (performance.now() - debut) / duree);
      pas(t);
      if ( t >= 1 ) {
        canvas.app.ticker.remove(tic);
        resoudre();
      }
    };
    canvas.app.ticker.add(tic);
  });
}

/** Sprite prêt à jouer ; les vidéos sont clonées pour jouer plusieurs fois en même temps. */
async function creerSprite(src) {
  let texture = await charger(src);
  if ( !texture ) return null;
  let video = null;
  let clone = false;
  if ( estVideo(src) ) {
    video = texture.baseTexture?.resource?.source ?? null;
    if ( video && game.video?.cloneTexture ) {
      try {
        texture = await game.video.cloneTexture(video);
        video = texture.baseTexture.resource.source;
        clone = true;
      } catch { /* on garde la texture partagée */ }
    }
  }
  const sprite = new PIXI.Sprite(texture);
  sprite.anchor.set(0.5);
  return { sprite, video, detruire: () => { sprite.destroy(); if ( clone ) texture.destroy(true); } };
}

/* -------------------------------------------- */

/** Image qui se déplace de « de » vers « vers », orientée dans le sens du trajet. */
async function projectile(src, de, vers) {
  const s = await creerSprite(src);
  if ( !s ) return;
  const dx = vers.x - de.x;
  const dy = vers.y - de.y;
  const dist = Math.hypot(dx, dy);
  s.sprite.scale.set(canvas.dimensions.size / 100);
  s.sprite.rotation = Math.atan2(dy, dx);
  s.sprite.position.set(de.x, de.y);
  calque().addChild(s.sprite);
  if ( s.video ) game.video.play(s.video, { loop: true, volume: 0 });
  const duree = Math.clamp((dist / (canvas.dimensions.size * VITESSE_CASES)) * 1000, DUREE_MIN, DUREE_MAX);
  await animer(duree, t => s.sprite.position.set(de.x + (dx * t), de.y + (dy * t)));
  s.detruire();
}

/** Effet joué une fois à un endroit, à la taille donnée en pixels. */
async function effet(src, centre, taille) {
  const s = await creerSprite(src);
  if ( !s ) return;
  const tex = s.sprite.texture;
  s.sprite.scale.set(taille / Math.max(tex.width || 1, tex.height || 1));
  s.sprite.position.set(centre.x, centre.y);
  calque().addChild(s.sprite);
  if ( s.video ) {
    s.video.loop = false;
    s.video.currentTime = 0;
    await game.video.play(s.video, { loop: false, volume: 0 });
    await new Promise(r => {
      s.video.addEventListener("ended", r, { once: true });
      setTimeout(r, 5000);
    });
  } else {
    await attendre(500);
    await animer(300, t => { s.sprite.alpha = 1 - t; });
  }
  s.detruire();
}

/* -------------------------------------------- */

/**
 * Joue l'animation décrite par un message du chat.
 * @param {object} a  Voir donneesAnimation (dice/attaque.mjs).
 */
export async function jouerAnimation(a) {
  const source = canvas.tokens.get(a.source);
  if ( !source ) return;
  const cibles = (a.cibles ?? []).map(id => canvas.tokens.get(id)).filter(t => t);
  const touches = new Set(a.touches ?? []);
  const destinations = cibles.length ? cibles.map(t => ({ centre: t.center, token: t })) : (a.point ? [{ centre: a.point, token: null }] : []);
  const tailleImpact = t => Math.max(t?.w ?? canvas.dimensions.size, t?.h ?? canvas.dimensions.size) * 1.4;
  const rayonPx = Math.max(a.rayon || 1.5, 0.5) / canvas.dimensions.distance * canvas.dimensions.size;

  if ( a.son ) foundry.audio.AudioHelper.play({ src: a.son, volume: 0.8, autoplay: true, loop: false }, false);

  const impact = d => (a.impact && (!d.token || touches.has(d.token.id))) ? effet(a.impact, d.centre, tailleImpact(d.token)) : null;

  switch ( a.style ) {
    case "projectile":
      if ( a.projectile ) await Promise.all(destinations.map(d => projectile(a.projectile, source.center, d.centre)));
      break;
    case "impact":
      await Promise.all(destinations.map(impact));
      break;
    case "projectileImpact":
      await Promise.all(destinations.map(async d => {
        if ( a.projectile ) await projectile(a.projectile, source.center, d.centre);
        await impact(d);
      }));
      break;
    case "zone":
    case "projectileZone": {
      const d = destinations[0];
      if ( !d ) break;
      if ( (a.style === "projectileZone") && a.projectile ) await projectile(a.projectile, source.center, d.centre);
      if ( a.zone ) await effet(a.zone, d.centre, rayonPx * 2);
      break;
    }
    case "soi":
      if ( a.impact ) await effet(a.impact, source.center, tailleImpact(source));
      break;
  }
}

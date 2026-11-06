/**
 * Choix du point de chute d'une grenade sur la scène : le curseur devient la grenade,
 * avec le cercle de son rayon d'explosion. Clic gauche pour lancer, clic droit ou Échap pour annuler.
 */

/**
 * @param {Item} item  La grenade.
 * @returns {Promise<{x:number, y:number}|null>}
 */
export async function choisirPoint(item) {
  if ( !canvas?.ready ) return null;
  const dims = canvas.dimensions;
  const rayonPx = ((item.system.attaque?.zone || 0) / dims.distance) * dims.size;
  const image = item.system.animationEffective?.projectile || item.img;

  const calque = new PIXI.Container();
  calque.eventMode = "static";
  calque.hitArea = new PIXI.Rectangle(0, 0, dims.width, dims.height);
  calque.cursor = "none";

  const cercle = new PIXI.Graphics();
  if ( rayonPx > 0 ) {
    cercle.lineStyle(2, 0xF2CF3A, 0.9).beginFill(0xFF4D5E, 0.15).drawCircle(0, 0, rayonPx).endFill();
  }
  calque.addChild(cercle);

  let icone = null;
  try {
    const texture = await (foundry.canvas.loadTexture ?? globalThis.loadTexture)(image);
    if ( texture ) {
      icone = new PIXI.Sprite(texture);
      icone.anchor.set(0.5);
      const taille = dims.size * 0.6;
      const echelle = taille / Math.max(icone.texture.width, icone.texture.height);
      icone.scale.set(echelle);
      calque.addChild(icone);
    }
  } catch {}
  if ( !icone ) cercle.lineStyle(2, 0xF2CF3A, 1).drawCircle(0, 0, dims.size * 0.15);

  const placer = pos => {
    cercle.position.set(pos.x, pos.y);
    icone?.position.set(pos.x, pos.y);
  };
  placer(canvas.mousePosition ?? { x: dims.sceneX + dims.sceneWidth / 2, y: dims.sceneY + dims.sceneHeight / 2 });
  canvas.stage.addChild(calque);
  ui.notifications.info(`${item.name} : clique là où tu la lances (clic droit ou Échap pour annuler).`);

  return new Promise(resolve => {
    const finir = point => {
      window.removeEventListener("keydown", clavier, true);
      calque.destroy({ children: true });
      resolve(point);
    };
    const clavier = ev => {
      if ( ev.key !== "Escape" ) return;
      ev.preventDefault();
      ev.stopPropagation();
      finir(null);
    };
    window.addEventListener("keydown", clavier, true);
    calque.on("pointermove", ev => placer(ev.getLocalPosition(canvas.stage)));
    calque.on("pointerdown", ev => {
      ev.stopPropagation();
      if ( ev.button === 2 ) return finir(null);
      if ( ev.button !== 0 ) return;
      const p = ev.getLocalPosition(canvas.stage);
      finir({ x: Math.round(p.x), y: Math.round(p.y) });
    });
  });
}

/** Le C4 se pose, il ne se lance pas. */
export function estPosee(item) {
  return /\bc-?4\b/i.test(item.name);
}

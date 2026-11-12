/**
 * Vision des Optiques Kiroshi.
 * - « Amplificateur de lumière » : vision dans le noir automatique (mode Vision dans le noir).
 * - « Vision thermique » : bouton sur la fiche ; le joueur voit la scène en bleu, les personnages
 *   en rouge (même invisibles, copies rouges posées au-dessus du décor) et les sources thermiques (type de lumière « Source thermique »).
 * Tout est calculé à la volée (rien n'est écrit sur les tokens) et l'affichage est propre à chaque client.
 */
import { dansBuild } from "../data/ennemi.mjs";
import { SON } from "../config.mjs";
import { jouerSon } from "../sons.mjs";

/** Portée de la vision dans le noir et de la vision thermique (m). */
export const PORTEE_VISION = 20;

const normaliser = t => t.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, "'").toLowerCase().trim();

/** L'acteur a-t-il cette amélioration posée sur un implant (et dans son build pour un ennemi) ? */
export function aAmelioration(acteur, nom) {
  if ( !acteur?.items ) return false;
  const cle = normaliser(nom);
  return acteur.items.some(i => (i.type === "ameliorationImplant") && (normaliser(i.name) === cle)
    && acteur.items.get(i.system.implant)
    && ((acteur.type !== "ennemi") || dansBuild(i, acteur.system.build)));
}

export const aVisionNocturne = a => aAmelioration(a, "Amplificateur de lumière");
export const aVisionThermique = a => aAmelioration(a, "Vision thermique");
export const thermiqueAllumee = a => !!a?.flags?.cyberpunk2075?.visionThermique && aVisionThermique(a);

/* -------------------------------------------- */
/*  Vision des tokens                           */
/* -------------------------------------------- */

const DEFAUTS = {
  darkvision: { attenuation: 0, contrast: 0, saturation: -1, brightness: 0 },
  thermique: { attenuation: 0, contrast: 0.1, saturation: 0, brightness: 0 }
};

/** Repart des données du token puis ajoute la vision des implants. */
function appliquerVision(doc) {
  const src = doc._source?.sight;
  if ( !src || !doc.sight ) return;
  // Retour aux valeurs du token (au cas où l'implant a été retiré)
  for ( const k of ["range", "visionMode", "attenuation", "contrast", "saturation", "brightness"] ) doc.sight[k] = src[k];
  const modes = Array.isArray(doc.detectionModes) ? doc.detectionModes : null;
  if ( modes ) {
    for ( let i = modes.length - 1; i >= 0; i-- ) if ( (modes[i].id === "thermique") && !doc._source.detectionModes?.some(m => m.id === "thermique") ) modes.splice(i, 1);
    const basique = modes.find(m => m.id === "basicSight");
    const basiqueSrc = doc._source.detectionModes?.find(m => m.id === "basicSight");
    if ( basique ) basique.range = basiqueSrc ? basiqueSrc.range : src.range;
  }

  const acteur = doc.actor;
  if ( !acteur || !doc.sight.enabled ) return;
  const thermique = thermiqueAllumee(acteur);
  if ( !thermique && !aVisionNocturne(acteur) ) return;
  const mode = thermique ? "thermique" : "darkvision";
  const portee = Math.max(doc.sight.range || 0, PORTEE_VISION);
  doc.sight.range = portee;
  doc.sight.visionMode = mode;
  Object.assign(doc.sight, DEFAUTS[mode]);
  if ( !modes ) return;
  const basique = modes.find(m => m.id === "basicSight");
  if ( basique && (basique.range !== null) ) basique.range = Math.max(basique.range || 0, portee);
  if ( thermique ) modes.push({ id: "thermique", enabled: true, range: portee });
}

/** Recalcule la vision des tokens d'un acteur sur la scène affichée. */
export function rafraichirVisionActeur(acteur) {
  if ( !canvas?.ready || !acteur ) return;
  const tokens = acteur.isToken ? [acteur.token?.object] : acteur.getActiveTokens();
  let change = false;
  for ( const t of tokens ) {
    if ( !t?.document ) continue;
    appliquerVision(t.document);
    try { t.initializeSources(); } catch { t.initializeVisionSource?.(); }
    change = true;
  }
  if ( change ) canvas.perception.update({ initializeVision: true, initializeLighting: true, refreshVision: true, refreshLighting: true });
}

/* -------------------------------------------- */
/*  Vue thermique (client)                      */
/* -------------------------------------------- */

let vue = false;
export const vueThermique = () => vue;

const matrice = m => {
  const f = new PIXI.ColorMatrixFilter();
  f.matrix = m;
  f.cpVision = true;
  return f;
};
const L = (k, o) => [0.3 * k, 0.59 * k, 0.11 * k, 0, o];
let BLEU = null;
let ROUGE = null;
const filtres = () => {
  // Luminance → bleu nuit à bleu moyen (tout le décor)
  BLEU ??= matrice([...L(0.06, 0.0), ...L(0.2, 0.03), ...L(0.45, 0.1), 0, 0, 0, 1, 0]);
  // Luminance → rouge à jaune (corps chauds)
  ROUGE ??= matrice([...L(0.35, 0.65), ...L(0.6, 0.05), ...L(0.06, 0.0), 0, 0, 0, 1, 0]);
};

function poser(obj, filtre) {
  if ( !obj || obj.destroyed ) return;
  const autres = (obj.filters ?? []).filter(f => !f.cpVision);
  const liste = filtre ? [...autres, filtre] : autres;
  if ( (obj.filters?.length ?? 0) === liste.length && liste.every((f, i) => obj.filters[i] === f) ) return;
  obj.filters = liste.length ? liste : null;
}

/* Silhouettes chaudes : copies rouges des tokens visibles, au-dessus du décor teinté en bleu */
let calqueChaud = null;
const silhouettes = new Map();

function conteneurChaud() {
  if ( !calqueChaud || calqueChaud.destroyed || !calqueChaud.parent ) {
    calqueChaud = new PIXI.Container();
    calqueChaud.eventMode = "none";
    calqueChaud.zIndex = -10;
    canvas.interface.sortableChildren = true;
    canvas.interface.addChildAt(calqueChaud, 0);
  }
  return calqueChaud;
}

function oublierSilhouette(id) {
  const s = silhouettes.get(id);
  if ( s && !s.destroyed ) s.destroy();
  silhouettes.delete(id);
}

export function filtrerToken(token) {
  if ( !token ) return;
  filtres();
  const mesh = token.mesh;
  let s = silhouettes.get(token.id);
  const montrer = vue && mesh && !mesh.destroyed && mesh.texture && token.visible && !token.destroyed;
  if ( !montrer ) {
    if ( s && !s.destroyed ) s.visible = false;
    return;
  }
  if ( !s || s.destroyed ) {
    s = new PIXI.Sprite();
    s.eventMode = "none";
    s.filters = [ROUGE];
    conteneurChaud().addChild(s);
    silhouettes.set(token.id, s);
  }
  s.texture = mesh.texture;
  s.anchor.copyFrom(mesh.anchor);
  s.position.copyFrom(mesh.position);
  s.scale.copyFrom(mesh.scale);
  s.rotation = mesh.rotation;
  s.visible = true;
}

function filtrerTout() {
  if ( !canvas?.ready ) return;
  filtres();
  // Tout le rendu principal (décor, tuiles, tokens) passe en bleu
  const rendu = canvas.primary?.sprite ?? null;
  if ( !rendu && vue ) console.warn("Cyberpunk 2075 | Vision thermique : rendu principal introuvable (canvas.primary.sprite)");
  poser(rendu, vue ? BLEU : null);
  for ( const t of canvas.tokens?.placeables ?? [] ) filtrerToken(t);
  // Les sources thermiques s'allument ou s'éteignent
  let lumieres = false;
  for ( const l of canvas.lighting?.placeables ?? [] ) {
    if ( !estSourceThermique(l.document) ) continue;
    l.initializeLightSource();
    lumieres = true;
  }
  if ( lumieres ) canvas.perception.update({ refreshLighting: true });
}

/** Après chaque calcul de la vision : la vue passe-t-elle en thermique pour ce client ? */
export function surRafraichissementVue() {
  const sources = canvas?.effects?.visionSources;
  const v = !!sources?.some?.(s => (s.active !== false) && (s.visionMode?.id === "thermique"));
  if ( v === vue ) return;
  vue = v;
  filtrerTout();
}

/* -------------------------------------------- */
/*  Sources thermiques (type de lumière)        */
/* -------------------------------------------- */

export const estSourceThermique = doc => doc?.config?.animation?.type === "thermique";

function classeColoration() {
  const Base = foundry.canvas?.rendering?.shaders?.AdaptiveColorationShader ?? globalThis.AdaptiveColorationShader;
  if ( !Base ) return null;
  return class ColorationThermique extends Base {
    static fragmentShader = `
    ${this.SHADER_HEADER}
    void main() {
      ${this.FRAGMENT_BEGIN}
      float d = clamp(dist, 0.0, 1.0);
      vec3 chaud;
      if ( d < 0.22 ) chaud = mix(vec3(1.0, 0.0, 0.0), vec3(1.0, 0.45, 0.0), d / 0.22);
      else if ( d < 0.42 ) chaud = mix(vec3(1.0, 0.45, 0.0), vec3(1.0, 1.0, 0.0), (d - 0.22) / 0.2);
      else if ( d < 0.68 ) chaud = mix(vec3(1.0, 1.0, 0.0), vec3(0.0, 1.0, 0.25), (d - 0.42) / 0.26);
      else chaud = mix(vec3(0.0, 1.0, 0.25), vec3(0.0, 0.12, 0.55), (d - 0.68) / 0.32);
      finalColor = chaud * colorationAlpha * smoothstep(1.0, 0.75, d);
      ${this.FRAGMENT_END}
    }`;
  };
}

/** Lumière : une source thermique n'existe que dans la vue thermique, avec sa propre couleur. */
function classeLumiere(Base) {
  return class LumiereCP extends Base {
    _isLightSourceDisabled() {
      if ( estSourceThermique(this.document) && !vue ) return true;
      return super._isLightSourceDisabled();
    }

    get emitsLight() {
      if ( estSourceThermique(this.document) && !vue ) return false;
      return super.emitsLight;
    }

    _getLightSourceData() {
      const d = super._getLightSourceData();
      if ( estSourceThermique(this.document) ) {
        d.color = foundry.utils.Color.from("#ffffff");
        d.alpha = Math.max(d.alpha ?? 0, 0.8);
      }
      return d;
    }
  };
}

/* -------------------------------------------- */
/*  Enregistrement                              */
/* -------------------------------------------- */

export function enregistrerVision() {
  // Mode de vision thermique : voit dans le noir comme la vision dans le noir, sans désaturer
  try {
    const { VisionMode, DetectionMode } = foundry.canvas.perception;
    const NIV = VisionMode.LIGHTING_LEVELS;
    const VIS = VisionMode.LIGHTING_VISIBILITY;
    const dv = CONFIG.Canvas.visionModes.darkvision;
    CONFIG.Canvas.visionModes.thermique = new VisionMode({
      id: "thermique",
      label: "Vision thermique",
      canvas: { shader: dv.canvas.shader, uniforms: { contrast: 0, saturation: 0, brightness: 0 } },
      lighting: {
        levels: { [NIV.DIM]: NIV.BRIGHT },
        background: { visibility: VIS.REQUIRED }
      },
      vision: { darkness: { adaptive: false }, defaults: { ...DEFAUTS.thermique } }
    });

    // Détection thermique : repère tous les personnages à portée et en ligne de vue, même invisibles
    class DetectionThermique extends DetectionMode {
      _canDetect(visionSource, target) {
        if ( !(target instanceof foundry.canvas.placeables.Token) ) return false;
        const source = visionSource?.object?.document;
        if ( source?.hasStatusEffect?.(CONFIG.specialStatusEffects.BLIND) ) return false;
        return true;
      }
    }
    CONFIG.Canvas.detectionModes.thermique = new DetectionThermique({
      id: "thermique", label: "Détection thermique", tokenConfig: false, walls: true, angle: true,
      type: DetectionMode.DETECTION_TYPES.SIGHT
    });
  } catch (err) { console.warn("Cyberpunk 2075 | Vision thermique :", err); }

  // Type de lumière « Source thermique »
  try {
    const Coloration = classeColoration();
    const animer = foundry.canvas?.sources?.PointLightSource?.prototype?.animateTime;
    if ( Coloration ) CONFIG.Canvas.lightAnimations.thermique = {
      label: "Source thermique (vision thermique)",
      animation: animer,
      colorationShader: Coloration
    };
  } catch (err) { console.warn("Cyberpunk 2075 | Source thermique :", err); }
  CONFIG.AmbientLight.objectClass = classeLumiere(CONFIG.AmbientLight.objectClass);

  // Token : vision des implants
  const Base = CONFIG.Token.documentClass;
  CONFIG.Token.documentClass = class TokenCP extends Base {
    prepareDerivedData() {
      super.prepareDerivedData();
      try { appliquerVision(this); } catch (err) { console.warn("Cyberpunk 2075 | Vision :", err); }
    }
  };
}

/** Crochets : implants posés ou retirés, bouton thermique, vue de chaque client. */
export function brancherVision() {
  const surItem = item => {
    const a = item.parent;
    if ( (a instanceof Actor) && ["ameliorationImplant", "implant"].includes(item.type) ) rafraichirVisionActeur(a);
  };
  Hooks.on("createItem", surItem);
  Hooks.on("updateItem", surItem);
  Hooks.on("deleteItem", surItem);
  Hooks.on("updateActor", (acteur, changes) => {
    if ( foundry.utils.hasProperty(changes, "flags.cyberpunk2075.visionThermique") || ("system" in changes && acteur.type === "ennemi") ) rafraichirVisionActeur(acteur);
  });
  Hooks.on("canvasTearDown", () => { silhouettes.clear(); calqueChaud = null; vue = false; });
  Hooks.on("deleteToken", doc => oublierSilhouette(doc.id));
  Hooks.on("canvasReady", () => {
    vue = false;
    for ( const t of canvas.tokens.placeables ) {
      if ( !t.actor || !(aVisionNocturne(t.actor) || aVisionThermique(t.actor)) ) continue;
      appliquerVision(t.document);
      try { t.initializeSources(); } catch {}
    }
    canvas.perception.update({ initializeVision: true, initializeLighting: true });
  });
  Hooks.on("sightRefresh", surRafraichissementVue);
  Hooks.on("refreshToken", t => { if ( vue || silhouettes.has(t.id) ) filtrerToken(t); });
}

/** Allume ou éteint la vision thermique d'un personnage (bouton de la fiche). */
export async function basculerThermique(acteur) {
  if ( !acteur?.isOwner ) return;
  if ( !aVisionThermique(acteur) ) return ui.notifications.warn("Il faut l'amélioration Vision thermique sur l'Optique Kiroshi.");
  const allumee = !acteur.flags?.cyberpunk2075?.visionThermique;
  await acteur.setFlag("cyberpunk2075", "visionThermique", allumee);
  if ( allumee ) jouerSon(`${SON}/vision_thermique.ogg`);
  const tokens = acteur.getActiveTokens();
  if ( allumee && tokens.length && tokens.every(t => !t.document.sight.enabled) ) {
    ui.notifications.warn("Ce token n'a pas la vision activée : la vision thermique n'aura pas d'effet.");
  }
}

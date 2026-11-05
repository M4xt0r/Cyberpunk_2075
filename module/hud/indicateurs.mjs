/**
 * Indicateurs dessinés sur les tokens (charte « Scène ») :
 * - 4 points de couvert en bas du token (personnages et ennemis), cliquables par le propriétaire et le MJ ;
 * - crâne d'Humanité en haut à droite (personnages) : orange + tours pendant le compte à rebours,
 *   orange en pointillés « Sur le fil », rouge pendant la cyberpsychose.
 */
import { CHEMIN, COUVERTS } from "../config.mjs";

const JAUNE = 0xF2CF3A;
const GRIS = 0x6E6C78;
const NOIR = 0x0B0A0E;
const ORANGE = 0xFF9A3C;
const ROUGE = 0xFF4D5E;
const ICONE_CRANE = `${CHEMIN}/assets/icones/humanite.png`;

let textureCrane = null;

/** Charge l'icône du crâne une fois. */
export async function chargerIndicateurs() {
  try { textureCrane = await (foundry.canvas.loadTexture ?? globalThis.loadTexture)(ICONE_CRANE); } catch (err) { console.warn("Cyberpunk 2075 | Icône du crâne introuvable", err); }
}

/** (Re)dessine les indicateurs d'un token. */
export function dessinerIndicateurs(token) {
  const acteur = token?.actor;
  if ( !token || token.destroyed ) return;
  let conteneur = token.cpIndicateurs;
  if ( !conteneur || conteneur.destroyed ) {
    conteneur = token.cpIndicateurs = token.addChild(new PIXI.Container());
    conteneur.eventMode = "passive";
  }
  conteneur.removeChildren().forEach(c => c.destroy({ children: true }));
  if ( !acteur || !["personnage", "ennemi"].includes(acteur.type) ) return;
  conteneur.zIndex = 10;
  dessinerCouvert(token, conteneur, acteur);
  if ( acteur.type === "personnage" ) dessinerCrane(token, conteneur, acteur);
}

/* -------------------------------------------- */

function dessinerCouvert(token, conteneur, acteur) {
  const niveau = Math.clamp(Number(acteur.system.couvert) || 0, 0, 3);
  const w = token.w;
  const h = token.h;
  const r = Math.clamp(Math.round(Math.min(w, h) * 0.045), 4, 9);
  const ecart = Math.round(r * 1.1);
  const largeur = (4 * 2 * r) + (3 * ecart) + (2 * r);
  const hauteur = 2 * r + r;
  const x0 = (w - largeur) / 2;
  const y0 = h - hauteur - 2;
  const modifiable = acteur.isOwner;

  const groupe = new PIXI.Container();
  groupe.position.set(x0, y0);
  conteneur.addChild(groupe);

  const fond = new PIXI.Graphics();
  fond.beginFill(NOIR, 0.9).lineStyle(1, 0x3A3843, 1).drawRect(0, 0, largeur, hauteur).endFill();
  groupe.addChild(fond);

  for ( let i = 0; i < 4; i++ ) {
    const point = new PIXI.Graphics();
    const cx = r + (r) + i * (2 * r + ecart);
    const cy = hauteur / 2;
    // Aucun couvert : seul le premier point est plein, en gris
    const plein = (niveau === 0) ? (i === 0) : (i <= niveau);
    const couleur = (niveau === 0) ? GRIS : JAUNE;
    point.lineStyle(1, plein ? couleur : GRIS, 1);
    if ( plein ) point.beginFill(couleur, 1);
    point.drawCircle(cx, cy, r - 1);
    if ( plein ) point.endFill();
    if ( modifiable ) {
      point.eventMode = "static";
      point.cursor = "pointer";
      point.hitArea = new PIXI.Circle(cx, cy, r + ecart / 2);
      point.on("pointerdown", ev => {
        ev.stopPropagation();
        if ( acteur.system.couvert !== i ) acteur.update({ "system.couvert": i });
      });
    }
    groupe.addChild(point);
  }
  groupe.eventMode = modifiable ? "static" : "none";
  if ( modifiable ) {
    // Le fond absorbe les clics entre les points pour ne pas déplacer le token par erreur
    fond.eventMode = "static";
    fond.on("pointerdown", ev => ev.stopPropagation());
  }
  groupe.accessibleTitle = `Couvert : ${COUVERTS[niveau].label}`;
}

function dessinerCrane(token, conteneur, acteur) {
  const s = acteur.system;
  const etat = s.etat;
  const rebours = etat === "rebours";
  if ( !["rebours", "surLeFil", "cyberpsychose"].includes(etat) ) return;
  const psy = etat === "cyberpsychose";
  const couleur = psy ? ROUGE : ORANGE;
  const r = Math.clamp(Math.round(Math.min(token.w, token.h) * (psy ? 0.22 : 0.2)), 10, 34);
  const cx = token.w - r * 0.6;
  const cy = r * 0.4;

  const g = new PIXI.Graphics();
  g.position.set(cx, cy);
  if ( psy ) {
    g.beginFill(couleur, 1).drawCircle(0, 0, r).endFill();
    // Petits traits « glitch » autour du crâne
    g.lineStyle(2, couleur, 1);
    g.moveTo(-r - 6, r * 0.1).lineTo(-r - 1, r * 0.1);
    g.moveTo(r + 1, -r * 0.3).lineTo(r + 6, -r * 0.3);
    g.moveTo(0, -r - 6).lineTo(0, -r - 1);
  } else {
    g.beginFill(NOIR, 1).drawCircle(0, 0, r).endFill();
    if ( etat === "surLeFil" ) {
      // Contour en pointillés
      const n = 12;
      g.lineStyle(2, couleur, 1);
      for ( let k = 0; k < n; k++ ) {
        const a0 = (k / n) * Math.PI * 2;
        const a1 = a0 + (Math.PI * 2 / n) * 0.55;
        g.moveTo(Math.cos(a0) * r, Math.sin(a0) * r);
        g.arc(0, 0, r, a0, a1);
      }
    } else {
      g.lineStyle(2, couleur, 1).drawCircle(0, 0, r);
    }
  }
  conteneur.addChild(g);

  if ( textureCrane ) {
    const icone = new PIXI.Sprite(textureCrane);
    const taille = r * 1.15;
    icone.anchor.set(0.5);
    icone.width = taille;
    icone.height = taille;
    icone.tint = psy ? NOIR : couleur;
    g.addChild(icone);
  }

  // Nombre de tours du compte à rebours
  if ( rebours && !psy ) {
    const tours = s.rebours?.tours ?? 0;
    const style = new PIXI.TextStyle({ fontFamily: "JetBrains Mono", fontSize: Math.max(11, Math.round(r * 0.7)), fontWeight: "700", fill: 0x121116 });
    const texte = new PIXI.Text(String(tours), style);
    texte.anchor.set(0.5);
    const pastille = new PIXI.Graphics();
    const pw = texte.width + 6;
    const ph = texte.height;
    pastille.beginFill(ORANGE, 1).drawRect(-pw / 2, -ph / 2, pw, ph).endFill();
    pastille.position.set(r * 0.75, r * 0.75);
    texte.position.set(0, 0);
    pastille.addChild(texte);
    g.addChild(pastille);
  }
}

/** Redessine les tokens d'un acteur présents sur la scène. */
export function redessinerActeur(acteur) {
  if ( !canvas?.ready || !acteur ) return;
  for ( const t of acteur.getActiveTokens(true) ) dessinerIndicateurs(t);
}

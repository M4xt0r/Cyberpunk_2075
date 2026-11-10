/**
 * Sons du système. Un seul son à la fois : un nouveau son coupe le précédent (pas de brouhaha).
 * Les fichiers de assets/sons sont normalisés au même volume perçu (≈ −15 LUFS).
 */
import { SON, SONS_EFFET } from "./config.mjs";

const VOLUME = 0.8;
let enCours = null;

/** Joue un son localement, en coupant celui qui joue encore. */
export async function jouerSon(src) {
  if ( !src ) return;
  try { enCours?.stop?.(); } catch {}
  enCours = null;
  try {
    const son = await foundry.audio.AudioHelper.play({ src, volume: VOLUME, autoplay: true, loop: false }, false);
    enCours = son ?? null;
  } catch (err) { console.warn("Cyberpunk 2075 | Son :", src, err); }
}

/** Son associé à un fichier d'animation (impact ou zone), d'après son nom. */
export function sonDeLEffet(src) {
  if ( !src ) return "";
  const nom = src.split("/").pop().replace(/\.[^.]+$/, "");
  const fichier = SONS_EFFET[nom];
  return fichier ? `${SON}/${fichier}` : "";
}

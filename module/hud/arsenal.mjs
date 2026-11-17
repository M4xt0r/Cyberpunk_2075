/**
 * Arsenal du MJ : un acteur caché (réservé au MJ) qui porte tous les explosifs du compendium,
 * sans caractéristiques (toutes à 5 → bonus 0). Il apparaît en tête du menu des tokens de la barre
 * d'actions du MJ : grenades lancées et mines posées n'importe où, jets de dés sans les stats d'un personnage.
 * Le stock ne s'épuise jamais.
 */
const STOCK = 99;

export const estArsenal = acteur => !!acteur?.flags?.cyberpunk2075?.arsenal;
export const arsenal = () => game.actors?.find(estArsenal) ?? null;

const estMJActif = () => game.users.activeGM?.id === game.user.id;

/** Crée l'arsenal s'il n'existe pas et y range tous les explosifs du compendium (MJ actif). */
export async function preparerArsenal() {
  if ( !estMJActif() ) return;
  let acteur = arsenal();
  if ( !acteur ) {
    acteur = await Actor.create({
      name: "Arsenal du MJ",
      type: "personnage",
      img: "systems/cyberpunk2075/assets/notion/armes/f-gx-frag.webp",
      ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE },
      prototypeToken: { actorLink: true },
      flags: { cyberpunk2075: { arsenal: true } }
    });
    // Toutes les caractéristiques à 5 : aucun bonus ni malus
    const maj = {};
    for ( const cle of Object.keys(acteur.system.caracs ?? {}) ) maj[`system.caracs.${cle}.valeur`] = 5;
    if ( Object.keys(maj).length ) await acteur.update(maj);
  }

  const pack = game.packs.get("cyberpunk2075.armes");
  if ( !pack ) return;
  const docs = await pack.getDocuments();
  const explosifs = docs.filter(i => (i.type === "arme") && (i.system.typeArme === "grenade"));
  const presents = new Set(acteur.items.map(i => i.name));
  const nouveaux = explosifs.filter(i => !presents.has(i.name)).map(i => {
    const d = i.toObject();
    delete d._id;
    d.system.quantite = STOCK;
    return d;
  });
  if ( nouveaux.length ) await acteur.createEmbeddedDocuments("Item", nouveaux);
  // Retire ce qui n'est pas un explosif (coup de poing ajouté d'office…) et refait le plein
  const autres = acteur.items.filter(i => !((i.type === "arme") && (i.system.typeArme === "grenade"))).map(i => i.id);
  if ( autres.length ) await acteur.deleteEmbeddedDocuments("Item", autres);
  const pleins = acteur.items.filter(i => (i.system.quantite ?? STOCK) < STOCK).map(i => ({ _id: i.id, "system.quantite": STOCK }));
  if ( pleins.length ) await acteur.updateEmbeddedDocuments("Item", pleins);
}

export function brancherArsenal() {
  Hooks.once("ready", () => preparerArsenal().catch(err => console.warn("Cyberpunk 2075 | Arsenal du MJ :", err)));
  // Stock infini : le MJ actif remet à 99 après chaque lancer ou pose
  Hooks.on("updateItem", item => {
    if ( !estMJActif() || !estArsenal(item.parent) ) return;
    if ( (item.system.quantite ?? STOCK) < STOCK ) item.update({ "system.quantite": STOCK }).catch(() => null);
  });
}

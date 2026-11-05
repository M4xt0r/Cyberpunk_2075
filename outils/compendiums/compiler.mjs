/**
 * Compile les sources JSON (packs/_source/<pack>) en bases LevelDB (packs/<pack>) lisibles par Foundry.
 * Usage : npm i --no-save @foundryvtt/foundryvtt-cli && node outils/compendiums/compiler.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { compilePack } from "@foundryvtt/foundryvtt-cli";

const racine = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const sources = path.join(racine, "packs/_source");
for ( const pack of fs.readdirSync(sources).sort() ) {
  const sortie = path.join(racine, "packs", pack);
  fs.rmSync(sortie, { recursive: true, force: true });
  await compilePack(path.join(sources, pack), sortie, { recursive: false, log: false });
  console.log(`${pack} : ${fs.readdirSync(path.join(sources, pack)).length} documents`);
}

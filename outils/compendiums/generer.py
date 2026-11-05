"""
Génère les sources JSON des compendiums (packs/_source) à partir des données Notion recopiées ici.
Usage : python3 outils/compendiums/generer.py   puis   node outils/compendiums/compiler.mjs
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from base import ecrire
import equipement, biens, progression, ennemis

def marquer(pack, docs):
    for d in docs:
        if d["_key"].startswith("!items!"):
            d["_pack"] = pack
    return docs

packs = {}
packs["armes"] = marquer("armes", equipement.armes())
packs["objets"] = marquer("objets", equipement.objets())
packs["implants"] = marquer("implants", equipement.implants())
packs["hacks"] = marquer("hacks", equipement.hacks())
packs["ameliorations-vehicule"] = marquer("ameliorations-vehicule", biens.ameliorations())
packs["modules-planque"] = marquer("modules-planque", biens.modules())
packs["classes"] = progression.classes()
packs["vehicules"] = biens.vehicules()
packs["planques"] = biens.planques()
packs["ennemis"] = ennemis.ennemis()

for pack, docs in packs.items():
    for d in docs:
        d.pop("_pack", None)
    print(f"{pack:24} {ecrire(pack, docs)} documents")

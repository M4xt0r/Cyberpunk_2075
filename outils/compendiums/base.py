"""
Outils communs du générateur de compendiums : identifiants stables, blocs de données.
Les sources JSON sont écrites dans packs/_source/<pack>/ puis compilées par compiler.mjs.
"""
import hashlib, json, os, re, unicodedata

RACINE = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", ".."))
SOURCES = os.path.join(RACINE, "packs", "_source")
IMG = "systems/cyberpunk2075/assets/notion"
SYS = "cyberpunk2075"

def ident(*parts):
    """Identifiant Foundry (16 caractères) stable, dérivé d'une clé."""
    h = hashlib.sha1("/".join(parts).encode()).hexdigest()
    alpha = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    n = int(h, 16)
    out = ""
    for _ in range(16):
        n, r = divmod(n, 62)
        out += alpha[r]
    return out

def slug(nom):
    s = unicodedata.normalize("NFD", nom).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")

def img(dossier, nom):
    chemin = os.path.join(RACINE, "assets", "notion", dossier, f"{nom}.webp")
    return f"{IMG}/{dossier}/{nom}.webp" if os.path.exists(chemin) else None

def uuid(pack, doc_id, doc="Item"):
    return f"Compendium.{SYS}.{pack}.{doc}.{doc_id}"

def html(*paras):
    return "".join(f"<p>{p}</p>" for p in paras if p)

# -------------------------------------------------------------------------

def effet(desc="", type="passif", mods=None, activation="action", cout=0, kill=0,
          periode="illimite", max=0, duree=0, cibles=0, jet="", jetType="soin", typeDeg=""):
    return {
        "type": type, "description": desc,
        "modificateurs": [{"cible": c, "valeur": v} for c, v in (mods or [])],
        "activation": activation, "coutHumanite": cout, "humaniteKill": kill,
        "utilisations": {"periode": periode, "max": max},
        "duree": duree, "ciblesMax": cibles,
        "jet": {"formule": jet, "type": jetType, "typeDegats": typeDeg}
    }

def animation():
    return {"style": "", "projectile": "", "impact": "", "zone": "", "son": ""}

def attaque(competence="armeDePoing", carac="", portee=None, defense="adaptabilite", zone=None, faitDegats=True, bonusTouche=0, dureeZone=""):
    return {
        "competence": competence, "carac": carac, "portee": portee,
        "attaque": {"faitDegats": faitDegats, "defense": defense, "bonusTouche": bonusTouche, "zone": zone, "dureeZone": dureeZone,
                    "doubleVehicules": False, "robotsSeulement": False, "jetEffet": "", "effetTexte": "", "animation": animation()}
    }

def trois(liste):
    """Complète une liste de niveaux à 3 en répétant le dernier."""
    liste = list(liste)
    while len(liste) < 3:
        liste.append(liste[-1])
    return {"n1": liste[0], "n2": liste[1], "n3": liste[2]}

# -------------------------------------------------------------------------

def item(pack, cle, nom, type, image, system, dossier=None, sort=0, flags=None):
    _id = ident(pack, cle)
    return {
        "_id": _id, "_key": f"!items!{_id}", "name": nom, "type": type,
        "img": image or "icons/svg/item-bag.svg", "system": system, "effects": [],
        "folder": dossier, "sort": sort, "ownership": {"default": 0}, "flags": flags or {}
    }

def dossier(pack, nom, type="Item", couleur=None, sort=0, parent=None):
    _id = ident(pack, "dossier", nom)
    return {"_id": _id, "_key": f"!folders!{_id}", "name": nom, "type": type, "folder": parent,
            "sorting": "a", "sort": sort, "color": couleur, "description": "", "flags": {}}

def ecrire(pack, docs):
    rep = os.path.join(SOURCES, pack)
    os.makedirs(rep, exist_ok=True)
    for f in os.listdir(rep):
        os.remove(os.path.join(rep, f))
    for d in docs:
        prefixe = "dossier" if d["_key"].startswith("!folders!") else slug(d["name"])
        with open(os.path.join(rep, f"{prefixe}_{d['_id']}.json"), "w", encoding="utf-8") as fh:
            json.dump(d, fh, ensure_ascii=False, indent=2)
    return len(docs)

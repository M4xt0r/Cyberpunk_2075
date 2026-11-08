"""Ennemis (Notion : page Ennemies). Un acteur par rang, items des builds A et B embarqués."""
from base import *
from equipement import REG, arme
from biens import acteur, json_copie

CARACS = ["const", "ref", "captec", "int", "safr"]
COMP = {"poing": "armeDePoing", "lourde": "armeLourde", "cac": "corpsACorps", "sniper": "sniper", "acro": "acrobatie",
        "intim": "intimidation", "perc": "perception", "pers": "persuasion", "pirat": "piratage", "tech": "tech",
        "disc": "discretion", "savoir": "savoir"}

def embarque(acteur_cle, cle, niveau=1, build="", n=0, amel=None):
    """Copie d'un item du compendium posée sur l'ennemi, au niveau et dans le build donnés."""
    d = json_copie(REG[cle])
    d.pop("_pack", None)
    d["_id"] = ident("ennemi", acteur_cle, cle, build, str(n))
    if "niveau" in d["system"]:
        d["system"]["niveau"] = niveau
    if build:
        d["flags"] = {SYS: {"build": build}}
    out = [d]
    for nom in amel or []:
        ligne = next(a for a in REG[cle]["system"]["ameliorations"] if a["nom"] == nom)
        aid = ident("ennemi", acteur_cle, cle, build, nom)
        out.append({"_id": aid, "name": nom, "type": "ameliorationImplant", "img": d["img"], "effects": [], "folder": None, "sort": 0,
                    "ownership": {"default": 0}, "flags": d["flags"],
                    "system": {"description": "", "ambiance": "", "prix": ligne["prix"], "coutInstallation": ligne["cout"], "implant": d["_id"],
                               "effet": effet(ligne["effet"], mods=[(ligne["cible"], ligne["valeur"])] if ligne["cible"] else [])}})
    return out

def arme_propre(acteur_cle, nom, type, de, bonus, competence=None, zone=None, munitions=None, typeDeg=None, image=None):
    """Arme intégrée d'un robot ou d'un drone (pas dans le compendium d'armes)."""
    d = arme(f"{acteur_cle}-{slug(nom)}", nom, type, "", de, (0,), bonus=(bonus,), sansNiveaux=True, zone=zone,
             defense="adaptabilite", typeDeg=typeDeg, image=image or "icons/svg/target.svg")
    REG.pop(f"{acteur_cle}-{slug(nom)}", None)
    d["_id"] = ident("ennemi", acteur_cle, nom)
    d["folder"] = None
    if competence:
        d["system"]["competence"] = competence
    d["system"]["munitions"] = munitions
    return [d]

def ennemi(faction, image, rang, niv, caracs, stats, comps, A=(), B=(), commun=(), nature="organique", volant=False,
           reduction=0, extra=(), dossier=None, sort=0, notes="", reductionSauf=(), immunites=()):
    cle = slug(f"{faction}-{rang}")
    bonus = dict(zip(CARACS, caracs))
    tot = {k: v + 5 for k, v in bonus.items()}
    calc = {"vie": tot["const"] + tot["safr"] + 5, "adapt": tot["safr"] + tot["ref"], "glace": tot["int"] + tot["safr"], "ram": tot["captec"] + tot["int"]}
    force = lambda k: stats[k] if (k in stats and stats[k] != calc[k]) else None
    vie = stats.get("vie", calc["vie"])
    ram = stats.get("ram", calc["ram"])
    items = []
    for build, liste in (("", commun), ("A", A), ("B", B)):
        for n, e in enumerate(liste):
            e = e if isinstance(e, tuple) else (e,)
            c, nv, amel = e[0], (e[1] if len(e) > 1 else 1), (e[2] if len(e) > 2 else None)
            items += embarque(cle, c, nv, build, n, amel)
    for f in extra:
        items += f(cle)
    sys = {
        "faction": faction, "rang": rang, "rangNiveau": niv, "nature": nature, "yeuxCyber": "auto", "volant": volant, "build": "A",
        "caracs": {k: {"bonus": v} for k, v in bonus.items()},
        "competencesCles": [{"competence": COMP.get(k, k), "valeur": v} for k, v in comps.items()],
        "vie": {"value": vie, "max": vie, "forcer": force("vie")},
        "ram": {"value": ram, "max": ram, "forcer": force("ram")},
        "humanite": {"value": 0, "max": 100},
        "adaptabilite": {"forcer": force("adapt")}, "glace": {"forcer": force("glace")}, "attention": {"forcer": None},
        "initiative": {"bonus": 0}, "deplacement": {"bonus": 0}, "reduction": reduction, "reductionSauf": list(reductionSauf), "immunites": list(immunites), "bm": 2, "couvert": 0,
        "notes": html(notes) if notes else ""
    }
    nom = rang if rang.startswith(faction) else f"{faction} · {rang}"
    return acteur("ennemis", cle, nom, "ennemi", image, sys, dossier, sort, items=items,
                  token={"actorLink": False, "disposition": -1, "bar1": {"attribute": "vie"}, "displayBars": 20})

def ennemis():
    docs = []
    dossiers = {}

    def F(faction, image_cle):
        d = dossier("ennemis", faction, "Actor", sort=len(dossiers))
        dossiers[faction] = d
        docs.append(d)
        return d["_id"], img("ennemis", image_cle)

    def E(faction, rang, niv, caracs, stats, comps, **kw):
        fid, image = courant
        docs.append(ennemi(faction, image, rang, niv, caracs, stats, comps, dossier=fid, sort=niv, **kw))

    V = lambda vie, adapt, glace, ram: {"vie": vie, "adapt": adapt, "glace": glace, "ram": ram}

    courant = F("Choom", "choom")
    E("Choom", "Base", 1, [0, 0, -1, -1, 0], V(15, 10, 9, 8), {"poing": 2, "cac": 2}, A=["nue"], B=["couteau"])
    E("Choom", "Garde du corps", 2, [2, 0, -1, -1, 1], V(23, 11, 10, 8), {"lourde": 4, "intim": 4}, A=["m221-saratoga"], B=["m2038-tactician"], commun=["biomoniteur"])

    courant = F("6th Street", "6th-street")
    E("6th Street", "Recrue", 1, [1, 1, -1, -1, 1], V(17, 12, 10, 8), {"lourde": 3, "poing": 3},
      A=[("m251s-ajax", 2), "stabilisateur-de-recul"], B=[("carnage", 2), "processeur-tactique"])
    E("6th Street", "Vétéran", 2, [2, 1, -1, 0, 2], V(19, 13, 12, 9), {"lourde": 4, "perc": 4},
      A=[("m251s-ajax", 2), "stabilisateur-de-recul", "processeur-tactique"], B=[("carnage", 2), "biomoniteur"])
    E("6th Street", "Sergent", 3, [2, 2, 0, 1, 3], V(20, 15, 14, 11), {"lourde": 5, "pers": 6},
      A=[("carnage", 3), ("stabilisateur-de-recul", 2), "accelerateur-synaptique"], B=[("m251s-ajax", 3), ("biomoniteur", 2), ("processeur-tactique", 2)])

    courant = F("Valentinos", "valentinos")
    E("Valentinos", "Membre", 1, [0, 2, -1, -1, 1], V(16, 13, 10, 8), {"poing": 4}, A=["liberty", "accelerateur-synaptique"], B=["nue", "index-revolver"])
    E("Valentinos", "Pistolero", 2, [0, 3, -1, -1, 2], V(17, 15, 11, 9), {"poing": 5, "acro": 5},
      A=[("liberty", 2), "accelerateur-synaptique", "tendons-renforces"], B=[("dr-5-nova", 2), ("optique-kiroshi", 1, ["Trajectoire balistique"])])
    E("Valentinos", "Caudillo", 3, [1, 4, -1, 0, 3], V(19, 17, 13, 9), {"poing": 7, "acro": 7},
      A=[("liberty", 3), ("accelerateur-synaptique", 2), ("optique-kiroshi", 1, ["Trajectoire balistique"]), ("tendons-renforces", 2)],
      B=[("dr-5-nova", 3), ("optique-kiroshi", 1, ["Trajectoire balistique"]), ("processeur-tactique", 2), "sandevistan"])

    courant = F("Robot RMK2", "robot-rmk2")
    E("Robot RMK2", "Robot RMK2", 2, [3, 3, 0, -2, -2], V(30, 12, 12, 8), {"poing": 4, "lourde": 4, "sniper": 4, "cac": 4},
      nature="robot", reduction=4, reductionSauf=["electrique"], immunites=["poison"],
      notes="Peau de métal : −4 aux dégâts reçus, sauf électriques. Immunité aux dégâts de poison.",
      extra=[lambda c: arme_propre(c, "Mitrailleuse intégrée", "mitraillette", "1d8", 3),
             lambda c: arme_propre(c, "Poings hydrauliques", "corpsACorps", "1d10", 3)])

    courant = F("NCPD", "ncpd")
    E("NCPD", "Patrouilleur", 1, [1, 1, -1, 0, 1], V(17, 12, 10, 9), {"poing": 3, "perc": 3}, A=["liberty"], B=["m2038-tactician", "processeur-tactique"])
    E("NCPD", "Technicien", 2, [-1, 0, 2, 2, 0], V(14, 10, 12, 14), {"pirat": 4, "tech": 4}, commun=["puce-de-piratage"],
      A=["court-circuit", "dysfonctionnement-d-arme", "dysfonctionnement-d-implant", "redemarrage-optique"],
      B=["ping", "pare-feu-reactif", "dysfonctionnement-d-arme", "redemarrage-optique"])
    E("NCPD", "Sergent d'assaut", 3, [3, 1, 0, 0, 2], V(20, 13, 12, 10), {"lourde": 6, "intim": 6},
      A=[("crusher", 2), "armure-sous-cutanee", "stabilisateur-de-recul"], B=[("m251s-ajax", 2), "processeur-tactique", "biomoniteur"])

    courant = F("Tiger Claws", "tiger-claws")
    E("Tiger Claws", "Lame", 1, [1, 3, -1, -1, 1], V(17, 14, 10, 8), {"cac": 4, "acro": 6}, commun=["nue"],
      A=[("katana", 2), "accelerateur-synaptique"], B=["lame-mantis"])
    E("Tiger Claws", "Griffe numérique", 2, [-1, 1, 1, 3, 1], V(15, 12, 14, 14), {"pirat": 6, "disc": 4}, commun=["nue", ("puce-de-piratage", 2), "auto-glace"],
      A=["court-circuit", "surchauffe", "redemarrage-optique", "dysfonctionnement-d-arme", "dysfonctionnement-d-implant", "pare-feu-reactif"],
      B=["ping", "redemarrage-optique", "pare-feu-reactif", "dysfonctionnement-d-implant"])
    E("Tiger Claws", "Maître de lame", 3, [2, 4, -1, 0, 3], V(20, 17, 13, 9), {"cac": 5, "acro": 7},
      A=[("lame-mantis", 2), "sandevistan", "patte-de-lynx"], B=[("katana", 3), ("accelerateur-synaptique", 2), ("tendons-renforces", 2)])

    courant = F("Animals", "animals")
    E("Animals", "Brute", 1, [4, 0, -2, -2, 0], V(19, 10, 8, 6), {"cac": 7, "intim": 7}, commun=["marteau"], A=["moelle-epaisse"], B=["berserk", "os-en-titane"])
    E("Animals", "Gros calibre", 2, [2, 1, -1, -2, 0], V(17, 11, 8, 7), {"lourde": 5, "intim": 5},
      A=["crusher", "stabilisateur-de-recul"], B=["m221-saratoga", "modificateur-de-douleur"])
    E("Animals", "Colosse", 3, [5, 1, -2, -2, 1], V(21, 12, 9, 6), {"cac": 8, "intim": 8}, commun=[("marteau", 3)],
      A=["berserk", "modificateur-de-douleur", ("moelle-epaisse", 2)], B=["microrotore", ("os-en-titane", 2), "berserk"])

    courant = F("Maelstrom", "maelstrom")
    E("Maelstrom", "Chromé", 1, [2, 2, -1, -2, 0], V(17, 12, 8, 7), {"cac": 5, "intim": 5},
      A=["lame-mantis", "microrotore", "modificateur-de-douleur"], B=["monocable", "os-en-titane"])
    E("Maelstrom", "Techie", 2, [0, 0, 2, 2, -1], V(14, 9, 11, 14), {"pirat": 5, "tech": 5},
      commun=["m221-saratoga", "puce-de-piratage", "ex-disk", "auto-glace", "court-circuit", "detonation-involontaire", "dysfonctionnement-d-implant", "dysfonctionnement-d-arme"])
    E("Maelstrom", "Borg", 3, [3, 2, -1, -2, 1], V(19, 13, 9, 7), {"cac": 6, "lourde": 6},
      A=[("lame-mantis", 2), "berserk", ("os-en-titane", 2)], B=[("carnage", 3), ("lance-projectile", 2), "berserk", ("armure-sous-cutanee", 2)])

    courant = F("Soldats de corporation", "corpo")
    E("Soldats de corporation", "Fusilier", 1, [2, 2, 0, 0, 1], V(18, 13, 11, 10), {"lourde": 5, "poing": 5},
      A=[("m251s-ajax", 2), "stabilisateur-de-recul", "armure-sous-cutanee"], B=[("tki-20-shingen", 2), "liaison-intelligente", "accelerateur-synaptique"])
    E("Soldats de corporation", "Opérateur", 2, [-1, 1, 2, 3, 0], V(14, 11, 13, 15), {"pirat": 6, "tech": 6},
      commun=["a-22b-chao", "puce-de-piratage", "auto-glace", "liaison-intelligente", "court-circuit", "pare-feu-reactif", "dysfonctionnement-d-arme", "surchauffe"])
    E("Soldats de corporation", "Capitaine", 3, [2, 2, 0, 1, 3], V(20, 15, 14, 11), {"lourde": 5, "pers": 6},
      A=[("m251s-ajax", 3), ("stabilisateur-de-recul", 2), ("armure-sous-cutanee", 2), ("processeur-tactique", 2)],
      B=[("l-69-zhuo", 3), "liaison-intelligente", ("accelerateur-synaptique", 2), ("biomoniteur", 2)])

    courant = F("Voodoo Boys", "voodoo-boys")
    E("Voodoo Boys", "Garde", 1, [1, 1, -1, 0, 1], V(17, 12, 11, 10), {"poing": 4, "intim": 4}, commun=["auto-glace"], A=["liberty"], B=["m221-saratoga"])
    E("Voodoo Boys", "NetRunner", 2, [-1, 0, 1, 4, 1], V(15, 11, 15, 15), {"pirat": 7, "savoir": 7}, commun=["nue", ("puce-de-piratage", 2), ("auto-glace", 2), "ex-disk"],
      A=["court-circuit", "surchauffe", "redemarrage-optique", "dysfonctionnement-d-arme", "dysfonctionnement-d-implant", "pare-feu-reactif"],
      B=["detonation-involontaire", "redemarrage-optique", "dysfonctionnement-d-implant", "dysfonctionnement-d-arme", "pare-feu-reactif"])
    E("Voodoo Boys", "Prêtre du réseau", 3, [-1, 0, 2, 5, 2], V(16, 12, 17, 17), {"pirat": 8, "savoir": 8},
      commun=[("puce-de-piratage", 3), ("auto-glace", 3), ("ex-disk", 2), "cyberpsychose", "suicide", "surchauffe", "court-circuit", "redemarrage-optique",
              "dysfonctionnement-d-implant", "dysfonctionnement-d-arme", "pare-feu-reactif"])

    courant = F("MaxTac", "maxtac")
    E("MaxTac", "Agent", 1, [3, 3, 0, 0, 2], V(20, 15, 12, 10), {"lourde": 7, "poing": 7},
      A=[("m251s-ajax", 3), ("stabilisateur-de-recul", 2), ("accelerateur-synaptique", 2), ("armure-sous-cutanee", 2), ("processeur-tactique", 2)],
      B=[("liberty", 3), ("optique-kiroshi", 1, ["Trajectoire balistique"]), ("accelerateur-synaptique", 2), ("armure-sous-cutanee", 2), ("biomoniteur", 3), "coeur-auxiliaire"])
    E("MaxTac", "Agent NetRunner", 2, [-1, 1, 2, 4, 1], V(15, 12, 15, 16), {"pirat": 8, "poing": 5},
      commun=[("a-22b-chao", 3), ("puce-de-piratage", 2), ("auto-glace", 2), ("ex-disk", 2), ("optique-kiroshi", 1, ["Analyseur de glace"]), "armure-sous-cutanee",
              "court-circuit", "surchauffe", "dysfonctionnement-d-implant", "dysfonctionnement-d-arme", "redemarrage-optique", "pare-feu-reactif"])
    E("MaxTac", "Lieutenant", 3, [3, 5, 0, 1, 3], V(21, 18, 14, 11), {"poing": 9, "acro": 9},
      A=[("liberty", 3), "sandevistan", ("accelerateur-synaptique", 3), ("optique-kiroshi", 3, ["Trajectoire balistique", "Pénétration de couvert"]),
         ("armure-sous-cutanee", 3), ("tendons-renforces", 2)],
      B=[("lame-mantis", 2), "sandevistan", ("accelerateur-synaptique", 3), ("armure-sous-cutanee", 3), "berserk", ("tendons-renforces", 2)])

    # --- Drones (robots)
    tir = lambda v: {"poing": v, "lourde": v, "sniper": v}
    courant = F("Drones", "wyvern")
    zero = [0, 0, 0, 0, 0]
    wyv, octant, aegis = img("ennemis", "wyvern"), img("ennemis", "zetatech-octant"), img("ennemis", "militech-aegis")
    docs.append(ennemi("Wyvern", wyv, "Wyvern · Assaut", 2, zero, V(28, 14, 12, 0), tir(7), nature="robot", volant=True, dossier=courant[0], sort=1,
                       extra=[lambda c: arme_propre(c, "Mitrailleuse", "mitraillette", "1d10", 3),
                              lambda c: arme_propre(c, "Missile", "autre", "1d10", 4, competence="armeLourde", zone=3, munitions=2, typeDeg="explosion")]))
    # RAM 12 au total : 8 + 4 de la puce de piratage (pour ses emplacements de hack)
    docs.append(ennemi("Wyvern", wyv, "Wyvern · Brouilleur", 2, zero, V(22, 14, 14, 8), {**tir(4), "pirat": 3}, nature="robot", volant=True, dossier=courant[0], sort=2,
                       commun=["puce-de-piratage", "dysfonctionnement-d-arme", "redemarrage-optique", "court-circuit", "pare-feu-reactif"],
                       extra=[lambda c: arme_propre(c, "Tourelle légère", "pistolet", "1d6", 2)]))
    docs.append(ennemi("Zetatech", octant, "Zetatech Octant", 3, zero, V(45, 15, 18, 0), tir(7), nature="robot", volant=True, reduction=5, dossier=courant[0], sort=3,
                       notes="−5 à tous les dégâts reçus.",
                       extra=[lambda c: arme_propre(c, "Mitrailleuse", "mitraillette", "1d12", 4),
                              lambda c: arme_propre(c, "Missile", "autre", "1d12", 5, competence="armeLourde", zone=3, munitions=2, typeDeg="explosion")]))
    docs.append(ennemi("Militech", aegis, "Militech Aegis X2", 1, zero, V(14, 5, 12, 0), tir(5), nature="robot", dossier=courant[0], sort=4,
                       extra=[lambda c: arme_propre(c, "Tourelle", "pistolet", "1d6", 3)]))
    return docs

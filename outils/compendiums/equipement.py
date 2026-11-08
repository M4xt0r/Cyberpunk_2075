"""Armes, objets, implants, capsules et hacks (Notion : pages Objets et Implant)."""
from base import *

REG = {}   # clé -> document (pour les packs de démarrage et les ennemis)

TYPES_DEG = {"pistolet": "balle", "corpsACorps": "corpsACorps", "mitraillette": "balle", "pompe": "balle",
             "sniper": "balle", "grenade": "explosion", "autre": "balle"}
COMP = {"pistolet": "armeDePoing", "corpsACorps": "corpsACorps", "mitraillette": "armeLourde",
        "pompe": "armeLourde", "sniper": "sniper", "grenade": "explosif", "autre": "armeLourde"}

def communs(desc="", ambiance="", sansNiveaux=False):
    return {"description": desc, "ambiance": ambiance, "sansNiveaux": sansNiveaux, "niveau": 1}

# =========================================================================
#  Armes
# =========================================================================

def arme(cle, nom, type, carac, de, prix, bonus=(0, 1, 2), ambiance="", intelligente=False,
         desc="", sansNiveaux=False, zone=None, defense=None, faitDegats=True, typeDeg=None, dossier=None, image=None, impact="", **extra):
    td = typeDeg or TYPES_DEG[type]
    niv = [{"prix": p, "de": de, "bonusFixe": b, "typeDegats": td} for p, b in zip(prix, bonus)]
    sys = {
        **communs(desc, ambiance, sansNiveaux),
        **attaque(COMP[type], carac, 15 if type == "pompe" else None,
                  defense or ("aucune" if type == "grenade" else "adaptabilite"),
                  zone if zone is not None else (5 if type == "grenade" else None), faitDegats),
        "type": type, "intelligente": intelligente, "munitions": None, "quantite": 1,
        "niveaux": trois(niv)
    }
    sys["attaque"].update(extra)
    if impact:
        sys["attaque"]["animation"]["impact"] = f"{IMG.rsplit('/notion', 1)[0]}/animations/{impact}"
    doc = item("armes", cle, nom, "arme", image or img("armes", cle), sys, dossier)
    REG[cle] = doc
    return doc

def armes():
    D = {k: dossier("armes", n, sort=i) for i, (k, n) in enumerate([
        ("cac", "Mêlée"), ("poing", "Armes de poing"), ("mit", "Mitraillettes"),
        ("pompe", "Fusils à pompe"), ("sniper", "Snipers"), ("grenade", "Grenades")])}
    f = lambda k: D[k]["_id"]
    docs = list(D.values())
    regle_mit = "Ajoute une attaque bonus à l'arme à feu."
    regle_pompe = "Portée de 15 mètres : au-delà, la moitié des dégâts."
    regle_sniper = "Fait toujours un coup critique en cas de réussite."
    docs += [
        arme("coup-de-poing", "Coup de poing", "corpsACorps", "const", "0", (0,), bonus=(0,), sansNiveaux=True, impact="impacts/coup_contondant.webm",
             image="icons/skills/melee/unarmed-punch-fist.webp", ambiance="Quand il ne reste plus que les phalanges.",
             desc=html("Arme de base de tout le monde (donnée automatiquement aux personnages et ennemis). Toucher : 1d20 + Corps à corps. Dégâts : bonus de Constitution, minimum 1."), dossier=f("cac")),
        arme("couteau", "Couteau", "corpsACorps", "ref", "1d6", (100, 200, 300), ambiance="Pratique quand les choses deviennent risquées.", dossier=f("cac")),
        arme("katana", "Katana", "corpsACorps", "safr", "1d10", (300, 500, 700), ambiance="Pointu et mortel. Faites attention à ne pas vous couper.", dossier=f("cac")),
        arme("marteau", "Marteau", "corpsACorps", "const", "1d12", (400, 600, 800), impact="impacts/coup_contondant.webm", ambiance="Avec un marteau dans la main, chaque problème ressemble à un clou.", dossier=f("cac")),

        arme("nue", "Nue", "pistolet", "safr", "1d6", (500, 750, 1000), ambiance="Conçu pour s'adapter à n'importe quelle main.", dossier=f("poing")),
        arme("a-22b-chao", "A-22B Chao", "pistolet", "captec", "1d8", (800, 1200, 1600), ambiance="Kang Tao réfléchit pour vous.", intelligente=True, dossier=f("poing")),
        arme("liberty", "Liberty", "pistolet", "ref", "1d10", (900, 1350, 1800), ambiance="Ça sent la poudre à canon. Et la liberté.", dossier=f("poing")),
        arme("dr-5-nova", "DR-5 Nova", "pistolet", "const", "1d12", (1100, 1650, 2200), ambiance="Parce que les revolvers ne se démodent jamais.", dossier=f("poing")),

        arme("m221-saratoga", "M221 Saratoga", "mitraillette", "const", "1d6", (800, 1200, 1600), ambiance="Ronronne comme un chaton.", desc=html(regle_mit), dossier=f("mit")),
        arme("m251s-ajax", "M251s Ajax", "mitraillette", "safr", "1d8", (1100, 1650, 2200), ambiance="Qu'il pleuve ou qu'il fasse beau, ça s'arrangera.", desc=html(regle_mit), dossier=f("mit")),
        arme("tki-20-shingen", "TKI-20 Shingen", "mitraillette", "captec", "1d10", (1600, 2400, 3200), ambiance="Plus rien ne peut vous retenir maintenant.", intelligente=True, desc=html(regle_mit), dossier=f("mit")),
        arme("d5-sidewinder", "D5 Sidewinder", "mitraillette", "ref", "1d12", (1700, 2550, 3400), ambiance="Fusil intelligent. Choix intelligent.", desc=html(regle_mit), dossier=f("mit")),

        arme("m2038-tactician", "M2038 Tactician", "pompe", "const", "1d6", (500, 750, 1200), bonus=(1, 2, 4), ambiance="La preuve que vous êtes sérieux.", desc=html(regle_pompe), dossier=f("pompe")),
        arme("crusher", "Crusher", "pompe", "ref", "1d8", (700, 1050, 1400), bonus=(1, 2, 4), ambiance="Un incontournable des armes à feu depuis 2020.", desc=html(regle_pompe), dossier=f("pompe")),
        arme("carnage", "Carnage", "pompe", "safr", "1d10", (900, 1350, 1800), bonus=(1, 2, 4), ambiance="Creusez un trou dans l'espace-temps !", desc=html(regle_pompe), dossier=f("pompe")),
        arme("l-69-zhuo", "L-69 Zhuo", "pompe", "captec", "1d12", (1300, 1950, 2600), bonus=(1, 2, 4), ambiance="La référence en matière d'innovation d'armement.", intelligente=True, desc=html(regle_pompe), dossier=f("pompe")),

        arme("ashura", "Ashura", "sniper", "captec", "1d6", (900, 1350, 1800), bonus=(0, 2, 4), ambiance="Plus qu'un fusil.", intelligente=True, desc=html(regle_sniper), dossier=f("sniper")),
        arme("nekomata", "Nekomata", "sniper", "const", "1d10", (1400, 2100, 2800), bonus=(0, 2, 4), ambiance="Précision sans compromis.", desc=html(regle_sniper), dossier=f("sniper")),
        arme("spt32-grad", "SPT32 Grad", "sniper", "safr", "1d12", (1700, 2550, 3400), bonus=(0, 2, 4), ambiance="De cette arme, il n'y a pas de couverture.", desc=html(regle_sniper), dossier=f("sniper")),

        arme("f-gx-frag", "F-GX Frag Grenade", "grenade", "", "1d10 + Explosif", (500,), bonus=(0,), sansNiveaux=True,
             ambiance="Grenade à main avec charge explosive conventionnelle.", desc=html("1d10+Explosif, 5 mètres de rayon."), dossier=f("grenade")),
        arme("molodets-biohaz", "MOLODETS BioHaz Grenade", "grenade", "", "1d4", (1000,), bonus=(0,), sansNiveaux=True, typeDeg="poison",
             ambiance="Crée un nuage toxique qui inflige des dégâts chimiques aux ennemis à portée.", dureeZone="Explosif",
             desc=html("Crée un nuage de gaz toxique dans un rayon de 5 mètres, qui fait 1d4 de dégâts de poison par tour. La compétence Explosif du lanceur définit le nombre de tours."), dossier=f("grenade")),
        arme("x-22-flashbang", "X-22 Flashbang Grenade", "grenade", "", "0", (500,), bonus=(0,), sansNiveaux=True, faitDegats=False,
             jetEffet="1d20 + Explosif", effetTexte="Aveuglé 1 tour",
             ambiance="Une grenade qui aveugle temporairement les ennemis.",
             desc=html("Aveugle durant un tour les personnes dans le rayon d'action (5 mètres). Le lanceur lance 1d20+Explosif : toutes les cibles dont l'Attention est supérieure au résultat ne sont pas aveuglées."), dossier=f("grenade")),
        arme("emp", "EMP Grenade", "grenade", "", "1d4 + Explosif", (1000,), bonus=(0,), sansNiveaux=True, typeDeg="electrique",
             robotsSeulement=True, effetTexte="Implants ou robot désactivés 3 tours",
             ambiance="Émet des ondes électromagnétiques qui infligent des dégâts.",
             desc=html("Désactive les implants ou les robots dans le rayon d'action (5 mètres) durant 3 tours ; les robots dans la zone subissent 1d4+Explosif de dégâts électriques."), dossier=f("grenade")),
        arme("c4", "C4", "grenade", "", "1d12 + Explosif", (1000,), bonus=(1,), sansNiveaux=True, image="icons/svg/explosion.svg", doubleVehicules=True,
             ambiance="Simple, efficace, on n'en demande pas plus.",
             desc=html("Se colle sur une surface et explose au bout du temps choisi : 1d12+1+Explosif de dégâts. Fait le double des dégâts sur les véhicules et bâtiments."), dossier=f("grenade")),
    ]
    return docs

# =========================================================================
#  Objets
# =========================================================================

def objet(cle, nom, categorie, prix, ambiance="", desc="", e=None, charges=0, sePorte=False, qualite="aucune", image=None, dossier=None):
    sys = {
        **communs(html(desc) if desc else "", ambiance, True),
        "categorie": categorie, "quantite": 1, "sePorte": sePorte, "porte": False,
        "uneChargeParUtilisation": True, "chargesRestantes": charges, "qualite": qualite,
        "usages": {"utilises": 0}, "actif": {"enCours": False, "tours": 0}, "animation": animation(),
        "niveaux": trois([{"prix": prix, "charges": charges, "effet": e or effet(desc)}])
    }
    doc = item("objets", cle, nom, "objet", image or img("objets", cle), sys, dossier)
    REG[cle] = doc
    return doc

def objets():
    D = {k: dossier("objets", n, sort=i) for i, (k, n) in enumerate([("util", "Utilitaires"), ("conso", "Consommables"), ("dom", "Domestique")])}
    f = lambda k: D[k]["_id"]
    docs = list(D.values())
    docs += [
        objet("bouclier", "Bouclier", "utilitaire", 800, "Rudimentaire mais efficace.", sePorte=True, image="icons/svg/shield.svg", dossier=f("util"),
              desc="Vous offre un couvert important et vous transforme en couvert partiel (ne peut être utilisé qu'avec les armes de poing)."),
        objet("retrothrusters", "Retrothrusters", "utilitaire", 450, "Non, ils ne sont pas vintage. Loin de là, en fait.", "Annule les dégâts de chute.", sePorte=True, dossier=f("util")),
        objet("masque-a-gaz", "Masque à gaz", "utilitaire", 150, "Un style qui fait fureur !", dossier=f("util"),
              e=effet("Immunise temporairement (3 tours) contre les gaz toxiques.", type="actif", duree=3), desc="Immunise temporairement (3 tours) contre les gaz toxiques."),
        objet("zetatech-bombus", "Zetatech Bombus", "utilitaire", 350, "Arasaka is listening…", dossier=f("util"),
              e=effet("+1 en Perception, possède 5 PV, peut lancer des piratages, volant.", mods=[("comp.perception", 1)]),
              desc="+1 en Perception, possède 5 PV, possibilité de lancer des piratages, volant."),
        objet("infovisiere", "Infovisière", "utilitaire", 150, "Un substitut élégant et pratique au cyberware optique.", sePorte=True, dossier=f("util"),
              e=effet("+1 en Investigation.", mods=[("comp.investigation", 1)]), desc="+1 en Investigation."),
        objet("couronne-de-ds", "Couronne de DS", "utilitaire", 100, "Cette couronne a vu défiler bien des perversions.", "Permet de lire des DS.", dossier=f("util")),
        objet("gilet-par-balle", "Gilet pare-balles", "utilitaire", 250, "Testé et approuvé sur le champ de bataille.", sePorte=True, charges=3, dossier=f("util"),
              e=effet("Réduit de 2 les dégâts subis. En lambeaux après 3 attaques subies.", mods=[("degatsRecus", -2)]),
              desc="Réduit de 2 les dégâts subis. Finit en lambeaux après 3 attaques subies."),
        objet("gant-de-charcudoc", "Gant de Charcudoc", "utilitaire", 450, "Faut pas s'inquiéter pour la rouille… promis.", sePorte=True, dossier=f("util"),
              e=effet("Permet de bidouiller des implants, +1 Charcutage, +1d4 à tous vos soins sans objet.", mods=[("comp.charcutage", 1)]),
              desc="Permet de bidouiller des implants, +1 Charcutage, +1d4 à tous vos soins sans objet."),
        objet("camera-glass", "Camera Glass", "utilitaire", 150, "Meilleur moyen de ne jamais rater le scoop du siècle.", "Permet de filmer ce que vous regardez.",
              sePorte=True, image="icons/svg/eye.svg", dossier=f("util")),
        objet("flathead", "Militech MT0D12 « Flathead »", "utilitaire", 12000,
              "Drone militaire expérimental en forme d'araignée, spécialisé dans l'infiltration, la reconnaissance et la surveillance, capable d'escalader murs et plafonds.",
              "Permet de se déplacer et de pirater depuis cette unité si un hacker a à sa disposition un module de NetRunner dans une planque. +10 RAM. Déplacement d'araignée.", dossier=f("util")),
        objet("cyber-console", "Cyber Console", "utilitaire", 2500, "Une cyber console haute performance qui optimise les capacités de piratage.", dossier=f("util"),
              image="icons/svg/lightning.svg",
              e=effet("Divise par 2 le coût du hack utilisé ce tour-ci.", type="actif", activation="bonus", duree=1),
              desc="En utilisant votre action bonus, vous pouvez diviser par 2 le coût du hack que vous utiliserez ce tour-ci."),
        objet("militech-centaur", "Militech Centaur", "utilitaire", 85500,
              "Exosquelette militaire bipède qui augmente la protection et la puissance de feu de son pilote grâce à un bouclier lourd et une arme à plasma, au détriment de sa mobilité.",
              sePorte=True, dossier=f("util"),
              e=effet("Tir de plasma 2d12+Const, +5 Adaptabilité, −10 en Acrobatie et Discrétion.",
                      mods=[("adaptabilite", 5), ("comp.acrobatie", -10), ("comp.discretion", -10)], jet="2d12 + Const", jetType="degats", typeDeg="feu"),
              desc="Tir de plasma 2d12+Const, +5 Adaptabilité, −10 en Acrobatie et Discrétion."),

        objet("maxdoc", "MaxDoc", "consommable", 250, "Quand « en bonne santé » ne suffira pas.", dossier=f("conso"),
              e=effet("Soigne 1d6.", jet="1d6", jetType="soin"), desc="Soigne 1d6."),
        objet("immunosuppresseur", "Immunosuppresseur", "consommable", 300, "Prenez une profonde respiration… Maintenant, reprenez le massacre.", dossier=f("conso"),
              e=effet("Retire 15💀 à votre compteur d'Humanité.", cout=-15), desc="Retire 15💀 à votre compteur d'Humanité."),
        objet("trousse-de-soin", "Trousse de soin", "consommable", 650, "Parce que tout ce que vous avez, c'est votre santé !", charges=3, dossier=f("conso"),
              e=effet("Soigne 1d8+Médecine, ne compte pas comme action bonus.", jet="1d8 + Médecine", jetType="soin"),
              desc="Soigne 1d8+Médecine, ne compte pas comme action bonus, 3 utilisations."),

        objet("guitare", "Guitare", "domestique", 250, image="icons/svg/sound.svg", dossier=f("dom")),
    ]
    regle = "Donne −1 en Humanité à partir de Bof et −1 de plus par palier au-dessus."
    for i, (q, label, prix) in enumerate([("pourrie", "pourri", 15), ("bof", "bof", 25), ("pasmal", "pas mal", 45), ("bon", "bon", 105), ("luxe", "de luxe", 550)]):
        docs.append(objet(f"repas-{q}", f"Repas {label}", "domestique", prix, desc=regle, qualite=q, image="icons/svg/tankard.svg", dossier=f("dom")))
    return docs

# =========================================================================
#  Implants
# =========================================================================

def implant(cle, nom, emplacement, cout, ambiance, niveaux, coutMax=None, arme=None, guerre=False,
            ameliorations=None, desc="", image=None, dossier=None, special=""):
    """niveaux : liste de dict {prix, e (effet), slots, de, bonus, typeDeg}."""
    seul = len(niveaux) == 1
    atk = arme or {}
    td = atk.get("typeDeg", "corpsACorps")
    niv = [{"prix": n["prix"], "slotsAmelioration": n.get("slots", 0), "effet": n["e"],
            "de": n.get("de", atk.get("de", "1d6")), "bonusFixe": n.get("bonus", 0), "typeDegats": n.get("typeDeg", td)} for n in niveaux]
    sys = {
        **communs(html(desc) if desc else "", ambiance, seul),
        **attaque(atk.get("competence", "armeDePoing"), atk.get("carac", ""), atk.get("portee"), atk.get("defense", "adaptabilite"),
                  atk.get("zone"), True, atk.get("bonusTouche", 0)),
        "usages": {"utilises": 0}, "actif": {"enCours": False, "tours": 0},
        "emplacement": emplacement, "coutMin": cout, "coutMax": coutMax or cout, "coutInstallation": cout,
        "armeIntegree": bool(arme), "capsuleAutorisee": emplacement == "bras",
        "typeArmeIntegree": atk.get("type", "corpsACorps"), "special": special, "guerre": guerre,
        "ameliorations": ameliorations or [], "animations": [], "sons": {"activation": "", "toucher": ""},
        "niveaux": trois(niv)
    }
    image = image or img("implants", cle) or "icons/svg/circuit.svg"
    doc = item("implants", cle, nom, "implant", image, sys, dossier)
    REG[cle] = doc
    return doc

def N(prix, desc, **kw):
    """Niveau d'implant : prix, effet (passif par défaut) et options d'arme."""
    arme = {k: kw.pop(k) for k in ["slots", "de", "bonus", "typeDeg"] if k in kw}
    return {"prix": prix, "e": effet(desc, **kw), **arme}

def amel(nom, effet_txt, cible="", valeur=0):
    return {"nom": nom, "prix": 500, "cout": 3, "effet": effet_txt, "cible": cible, "valeur": valeur}

def implants():
    ordre = [("oculaire", "Oculaire"), ("sanguin", "Système sanguin"), ("immunitaire", "Système immunitaire"), ("cutane", "Système cutané"),
             ("squelette", "Squelette"), ("nerveux", "Système nerveux"), ("facial", "Système facial"), ("portNeural", "Puces de port neural"),
             ("bras", "Bras"), ("jambe", "Jambe"), ("cyberAccessoire", "Cyber-accessoires")]
    D = {k: dossier("implants", n, sort=i) for i, (k, n) in enumerate(ordre)}
    f = lambda k: D[k]["_id"]
    docs = list(D.values())
    reflexe = ["discretion", "acrobatie", "larcin", "armeDePoing", "sniper"]
    I = lambda *a, **k: docs.append(implant(*a, dossier=f(a[2]), **k))

    # --- Oculaire
    I("optique-kiroshi", "Optique Kiroshi", "oculaire", 5,
      "Le matériel cybernétique optique de Kiroshi est un ensemble très populaire composé d'améliorations électroneurales aux fonctions d'analyse de l'environnement.",
      [N(2000, "Scan objet (+1 Investigation)", mods=[("comp.investigation", 1)], slots=1),
       N(4000, "Scan objet (+2 Investigation)", mods=[("comp.investigation", 2)], slots=1),
       N(6000, "Scan objet (+2 Investigation)", mods=[("comp.investigation", 2)], slots=2)],
      coutMax=15, desc="Améliorations (max 2) : 500 €$ et +3💀 par amélioration.",
      ameliorations=[
          amel("Vision de l'aigle", "Possibilité de zoomer avec sa vue, +1 Perception.", "comp.perception", 1),
          amel("Trajectoire balistique", "Voit la trajectoire de visée de son arme et peut faire des ricochets ; ignore les bonus de couvert avec les armes de poing."),
          amel("Vision thermique", "Possibilité de voir les fluctuations thermiques."),
          amel("Rayon d'explosion", "Voit la trajectoire et le rayon d'explosion de l'explosif utilisé, +1 en Explosif.", "comp.explosif", 1),
          amel("Anti-éblouissement", "Immunité contre les flashs et l'aveuglement laser."),
          amel("Amplificateur de lumière", "Vision en lumière faible, obscurité presque totale."),
          amel("Pénétration de couvert", "Réduit de moitié le couvert d'une cible."),
          amel("Analyseur de glace", "Révèle la Glace d'une cible."),
          amel("Diagnostic médical", "+1 aux jets de Médecine, révèle la sévérité exacte des blessures d'une cible organique et son DD de stabilisation.", "comp.medecine", 1),
      ])

    # --- Sanguin
    I("coeur-auxiliaire", "Cœur auxiliaire", "sanguin", 20, "Ce matériel cybernétique sert normalement de défibrillateur standard, mais dans la rue son utilité est tout autre.",
      [N(10000, "Réanime le possesseur avec 30 % de sa santé max, +5💀, 1 fois par jour.", type="actif", activation="reaction", cout=5, periode="jour", max=1),
       N(13500, "Réanime le possesseur avec 60 % de sa santé max, +10💀, 1 fois par jour.", type="actif", activation="reaction", cout=10, periode="jour", max=1)])
    I("biomoniteur", "Biomoniteur", "sanguin", 5, "Implant conçu pour coordonner les processus de régénération.",
      [N(4000, "Ajoute 5 PV au possesseur.", mods=[("vieMax", 5)]), N(6000, "Ajoute 10 PV au possesseur.", mods=[("vieMax", 10)]),
       N(8000, "Ajoute 15 PV au possesseur.", mods=[("vieMax", 15)])])
    I("vaisseaux-sanguin-en-bioplastique", "Vaisseaux sanguins en bioplastique", "sanguin", 5,
      "Ces vaisseaux facilitent la distribution du sang et des substances à diffusion hématogène dans le corps.",
      [N(1000, "Augmente les soins reçus de 1d4."), N(2000, "Augmente les soins reçus de 1d4+1."), N(3000, "Augmente les soins reçus de 1d4+2.")])
    I("pompe-sanguine", "Pompe sanguine", "sanguin", 10, "Accélère l'oxygénation des cellules du corps.",
      [N(4000 + 1000 * i, f"Soigne de 1d8+{i + 1}, +5💀, une utilisation par combat.", type="actif", cout=5, periode="combat", max=1, jet=f"1d8+{i + 1}") for i in range(3)])
    I("plaquette-nano-technique", "Plaquette nano-technique", "sanguin", 10, "Plaquette renforcée conçue pour accélérer les processus de régénération lors des phases de sommeil.",
      [N(1500, "DD de stabilisation −2."), N(2500, "DD de stabilisation −2 et +2 PV par repos long."), N(3500, "DD de stabilisation −3 et +4 PV par repos long.")])

    # --- Immunitaire
    I("modificateur-de-douleur", "Modificateur de douleur", "immunitaire", 15, "Accélérateur de distribution d'adrénaline après s'être blessé.",
      [N(6000, "Bonus de +4 dans tous les styles de combat après que le possesseur a perdu la moitié de ses PV ; ignore les effets du niveau 1 de stress.")])
    I("suppresseur-de-toxine", "Suppresseur de toxine", "immunitaire", 5, "Un implant conçu pour assister le foie et le pancréas en cas d'empoisonnement.",
      [N(3000, "Diminue de 1d6 les dégâts de tout type de poison.")])
    I("inducteur", "Inducteur", "immunitaire", 10, "Tonifie le système immunitaire après avoir reçu un stimulus externe à haute tension.",
      [N(4500, "Confère une immunité par jour face aux attaques IEM.", periode="jour", max=1)])
    I("amortisseur-de-traumatisme", "Amortisseur de traumatisme", "immunitaire", 10, "Délivre une décharge d'ocytocine en cas de stress intense.",
      [N(2500, "Annule le 1er point de stress par repos long.", periode="repos", max=1)])
    I("stabilisateur-neuro-hormonal", "Stabilisateur neuro-hormonal", "immunitaire", 10, "Augmente le cocktail hormonal de la régulation des émotions durant le sommeil.",
      [N(1500, "−1d4 d'Humanité par repos long."), N(2500, "−1d4+2 d'Humanité par repos long."), N(3500, "−1d4+4 d'Humanité par repos long.")])

    # --- Cutané
    I("armure-sous-cutanee", "Armure sous-cutanée", "cutane", 10, "Plusieurs décennies de succès sur le marché des armures.",
      [N(8000, "Réduit de 2 les dégâts par balle reçus."), N(10000, "Réduit de 4 les dégâts par balle reçus."), N(12000, "Réduit de 6 les dégâts par balle reçus.")])
    I("convertisseur-de-chaleur", "Convertisseur de chaleur", "cutane", 5, "Système régulant la température de votre corps et de votre matériel cybernétique.",
      [N(7000, "Immunise contre les changements de température, les dégâts de feu et le piratage Surchauffe.")])
    I("camouflage-optique", "Camouflage optique", "cutane", 10, "Rend l'utilisateur impossible à localiser dans la lumière du spectre visible.",
      [N(20000, "L'utilisateur est caché pendant 2 tours et peut se cacher sans couvert, une utilisation par jour.", type="actif", duree=2, periode="jour", max=1)])
    I("peau-electro-reactive", "Peau électro-réactive", "cutane", 10, "Faites un retour à l'envoyeur !",
      [N(4000 + 1000 * i, f"Après des dégâts au corps à corps, utilisez votre réaction pour infliger 1d4{'+' + str(i) if i else ''} de dégâts électriques. Si la cible en meurt, +2💀.",
         type="actif", activation="reaction", kill=2, jet=f"1d4{'+' + str(i) if i else ''}", jetType="degats", typeDeg="electrique") for i in range(3)])

    # --- Squelette
    I("microrotore", "Microrotore", "squelette", 5, "Améliore l'agilité en combat au corps à corps.",
      [N(6500, "Ajoute une attaque au corps à corps supplémentaire.")])
    I("os-en-titane", "Os en titane", "squelette", 5, "Des os imprégnés de métal, capables de résister à de lourdes charges.",
      [N(5500, "Réduit de 2 les dégâts au corps à corps reçus."), N(7500, "Réduit de 4 les dégâts au corps à corps reçus."), N(9500, "Réduit de 6 les dégâts au corps à corps reçus.")])
    I("moelle-epaisse", "Moelle épaisse", "squelette", 5, "Augmente la masse corporelle et la puissance des attaques au corps à corps.",
      [N(2000, "Chaque attaque au corps à corps que vous assénez inflige 1d4 de dégâts supplémentaires."),
       N(3000, "Chaque attaque au corps à corps que vous assénez inflige 1d4+1 de dégâts supplémentaires.")])
    I("stabilisateur-de-recul", "Stabilisateur de recul", "squelette", 5, "D'une mortelle précision.",
      [N(1500, "+2 aux compétences Arme lourde et Sniper.", mods=[("comp.armeLourde", 2), ("comp.sniper", 2)]),
       N(2500, "+4 aux compétences Arme lourde et Sniper.", mods=[("comp.armeLourde", 4), ("comp.sniper", 4)])])

    # --- Nerveux
    I("enregistreur-sensoriel", "Enregistreur sensoriel", "nerveux", 5,
      "Un enregistreur sensoriel est un appareil qui enregistre ce que l'on voit et ressent, et qui peut être compilé en DS.", [N(1000, "Possibilité de créer des danses sensorielles.")])
    I("liaison-intelligente", "Liaison intelligente", "nerveux", 5,
      "Matériel cybernétique permettant une connexion rapide et directe, avec une faible latence, aux objets compatibles comme les armes à feu et les implants.",
      [N(3500, "Donne un bonus de +2 aux jets de touche si l'utilisateur utilise une arme intelligente.")])
    I("auto-glace", "Auto-Glace", "nerveux", 5, "Système électronique anti-intrusion protégeant les implants cybernétiques contre d'affreux bugs.",
      [N(3000 + 1000 * i, f"Augmente la Glace du possesseur de {2 * (i + 1)}.", mods=[("glace", 2 * (i + 1))]) for i in range(3)])
    I("ex-disk", "Ex-Disk", "nerveux", 5, "Implant améliorant la capacité du cerveau à stocker et traiter les informations.",
      [N(3000 + 1000 * i, f"Augmente la RAM du possesseur de {2 * (i + 1)}.", mods=[("ram", 2 * (i + 1))]) for i in range(3)])
    I("noyau-mecatronique", "Noyau mécatronique", "nerveux", 5,
      "Fournit des informations sur les points faibles des machines. Fonctionne à la fois sur des modèles de série et sur des modèles rares.",
      [N(3000 + 1000 * i, f"Augmente les dégâts sur un robot de 1d4{'+' + str(i) if i else ''} (ces dégâts ne peuvent être réduits), +1💀 par robot éliminé.", kill=1) for i in range(3)])
    I("berserk", "Berserk", "nerveux", 20,
      "L'implant Berserk fera de vous une machine à tuer violente et sanguinaire. Sans oublier, difficile de vous tuer, grâce à ses systèmes révolutionnaires d'absorption des chocs.",
      [N(20000, "Activé par une réaction : +1d6 à tous vos dégâts, régénère 1d4 PV par tour, aucun effet à votre désavantage. Dure 3 tours, +10💀 à l'activation et +5💀 par ennemi tué.",
         type="actif", activation="reaction", duree=3, cout=10, kill=5)], guerre=True)
    I("sandevistan", "Sandevistan", "nerveux", 20,
      "Cet implant offre des vitesses de connexion fulgurantes, une grande flexibilité en matière de système de combat et une perception optimisée en combat. Idéal pour les spécialistes.",
      [N(20000, "Activé par une réaction : +1d6 à tous vos dégâts, qui deviennent tous critiques, tous vos dés avec avantage et 4 actions lors de votre tour. Dure 1 tour, +15💀 à l'activation et +5💀 par ennemi tué.",
         type="actif", activation="reaction", duree=1, cout=15, kill=5)], guerre=True)
    acc = [(1, 1, 2), (2, 2, 2), (2, 2, 3)]
    I("accelerateur-synaptique", "Accélérateur synaptique", "nerveux", 10,
      "Neuroprocesseur régulant l'équilibre hormonal durant les situations risquées et boostant les réflexes.",
      [N(4000 + 1000 * i, f"S'active par réaction et ne dure qu'un tour. +{r} aux compétences de Réflexes, +{p} en Perception et +{a} en Adaptabilité. +5💀 par utilisation.",
         type="actif", activation="reaction", duree=1, cout=5, mods=[(f"comp.{c}", r) for c in reflexe] + [("comp.perception", p), ("adaptabilite", a)])
       for i, (r, p, a) in enumerate(acc)])
    I("processeur-tactique", "Processeur tactique", "nerveux", 5, "Analyse les mouvements ennemis et anticipe leurs actions pour vous permettre de frapper avant eux.",
      [N(1000 * (i + 1), f"Ajoute +{2 * (i + 1)} au jet d'ordre de jeu au début d'un combat.", mods=[("initiative", 2 * (i + 1))]) for i in range(3)])
    I("puce-de-piratage", "Puce de piratage", "nerveux", 10,
      "Même si ce n'est pas entièrement vrai, une chose est sûre : ces cyberconsoles sont puissantes, efficaces et optimisées pour les daemons offensifs.",
      [N(8000 + 2000 * i, f"Augmente la RAM du possesseur de {4 * (i + 1)}, {4 + 2 * i} emplacements de hack.", mods=[("ram", 4 * (i + 1)), ("slotsHack", 4 + 2 * i)]) for i in range(3)])

    # --- Facial
    I("audivox", "Audivox", "facial", 2, "Qui t'a mis de l'autotune partout ? Pourquoi ne pas le mettre directement dans sa bouche ?",
      [N(500, "Modulateur de voix (son, intonation, effet), +2 en Spectacle lorsqu'il est utilisé.")])
    I("ecoute-amplifiee", "Écoute amplifiée", "facial", 5, "Dites adieu aux dîners de famille où mamie vous fait répéter vos phrases.",
      [N(1050, "La distance d'écoute est accrue et plus précise jusqu'à 250 m. +2 en Perception.", mods=[("comp.perception", 2)])])
    I("branchies", "Branchies", "facial", 5, "Qui n'a jamais rêvé de nager comme un poisson ?", [N(1000, "Permet de respirer sous l'eau durant 3 heures.")])
    I("langue-de-gouteur", "Langue de goûteur", "facial", 2, "Ce pudding est-il à l'arsenic ?",
      [N(500, "Permet de détecter les toxines présentes dans n'importe quelle substance et de les séparer du reste.")])
    I("machoire-cybernetique", "Mâchoire cybernétique", "facial", 10, "Un sourire de fer !",
      [N(1500, "Permet de mordre une cible sur un jet de corps à corps : 1d4+Const de dégâts plus 1d4+1 de poison.")],
      arme={"competence": "corpsACorps", "carac": "const", "de": "1d4", "type": "corpsACorps"}, desc="La morsure ajoute 1d4+1 de dégâts de poison.")
    I("masque-a-empreinte-comportementale-synchronisee", "Masque à empreinte comportementale synchronisée", "facial", 20, "",
      [N(95000, "Permet de prendre l'apparence, la voix, les tics et les expressions faciales d'une personne scannée au préalable, durant 35 minutes.", type="actif")])

    # --- Port neural (puces)
    puces = [("puce-du-hackeur", "Puce du Hackeur", ["piratage"], "Piratage"), ("puce-du-libraire", "Puce du libraire", ["savoir"], "Savoir"),
             ("puce-du-bagarreur", "Puce du bagarreur", ["corpsACorps"], "Corps à corps"), ("puce-m4x-v", "Puce M4x V.", ["pilotage"], "Pilotage"),
             ("puce-du-scorpion", "Puce du Scorpion", ["tech"], "Tech")]
    for cle, nom, comps, label in puces:
        I(cle, nom, "portNeural", 0, "", [N(100, f"+1 en {label}.", mods=[(f"comp.{c}", 1) for c in comps]),
                                          N(250, f"+2 en {label}.", mods=[(f"comp.{c}", 2) for c in comps])], image="icons/svg/circuit.svg")
    tir = ["armeDePoing", "armeLourde", "sniper"]
    I("puce-de-cassidy", "Puce de Cassidy", "portNeural", 0, "", [N(300, "+1 sur toutes les compétences de tir.", mods=[(f"comp.{c}", 1) for c in tir]),
                                                               N(500, "+2 sur toutes les compétences de tir.", mods=[(f"comp.{c}", 2) for c in tir])], image="icons/svg/circuit.svg")
    I("puce-de-repos-rapide", "Puce de repos rapide", "portNeural", 0, "", [N(400, "Un repos long se boucle en 4 h au lieu de 8.")], image="icons/svg/circuit.svg")
    I("puce-de-vigilance", "Puce de vigilance", "portNeural", 0, "", [N(300, "Vous ne pouvez plus être surpris.")], image="icons/svg/circuit.svg")
    I("puce-d-adaptabilite-inter-implants", "Puce d'adaptabilité inter-implants", "portNeural", 0, "", [N(800, "−1 en Humanité par repos long.")], image="icons/svg/circuit.svg")

    # --- Bras
    I("bras-de-gorille", "Bras de gorille", "bras", 5, "Membres de rechange classiques et fiables, adaptés à tous types de travaux.",
      [N(6500, "+2 en Constitution.", mods=[("carac.const", 2)]), N(8500, "+3 en Constitution.", mods=[("carac.const", 3)])])
    I("lame-mantis", "Lame Mantis", "bras", 15,
      "Lames implantées dans les bras, conçues pour être aussi discrètes que mortelles. Elles sont aussi efficaces qu'impressionnantes.",
      [N(6500, "+2 en Corps à corps lors de l'utilisation, 1d12+Càc de dégâts. +2💀 par ennemi tué.", kill=2),
       N(8500, "+3 en Corps à corps lors de l'utilisation, 1d12+Càc de dégâts. +2💀 par ennemi tué.", kill=2)],
      arme={"competence": "corpsACorps", "de": "1d12 + Corps à corps", "type": "corpsACorps", "bonusTouche": 2}, guerre=True,
      desc="Bonus au toucher : +2 au niveau 1, +3 au niveau 2 (à ajuster sur la carte au niveau 2).")
    I("lance-projectile", "Lance-projectile", "bras", 15,
      "Le lance-projectiles vous permet de tirer divers projectiles puissants, qui provoquent des explosions et des effets de statut. Plus important encore, il sème le chaos et la destruction.",
      [N(6500, "+2 en Explosif lors de l'utilisation, 1d10+Explosif de dégâts de zone (3 m), 3 munitions (500 €$). +5💀 par ennemi tué.", kill=5),
       N(8500, "+3 en Explosif lors de l'utilisation, 1d10+Explosif de dégâts de zone (3 m), 3 munitions (500 €$). +5💀 par ennemi tué.", kill=5)],
      arme={"competence": "explosif", "de": "1d10 + Explosif", "type": "autre", "typeDeg": "explosion", "zone": 3, "bonusTouche": 2}, guerre=True,
      desc="3 munitions (500 €$ la munition). Bonus au toucher : +2 au niveau 1, +3 au niveau 2.")
    I("monocable", "Monocâble", "bras", 10,
      "Câble composé d'un filament unique et faisant office de fouet. Sa partie tranchante n'est pas plus large qu'une molécule.",
      [N(6500, "+2 en Corps à corps lors de l'utilisation, 1d8+Càc de dégâts, touche 2 cibles à moins de 1,5 m l'une de l'autre sur une portée de 3 m. +1💀 par ennemi tué.", kill=1, cibles=2),
       N(8500, "+3 en Corps à corps lors de l'utilisation, 1d8+Càc de dégâts, touche 3 cibles à moins de 1,5 m l'une de l'autre sur une portée de 3 m. +1💀 par ennemi tué.", kill=1, cibles=3)],
      arme={"competence": "corpsACorps", "de": "1d8 + Corps à corps", "type": "corpsACorps", "portee": 3, "bonusTouche": 2}, guerre=True)
    I("griffe-retractable", "Griffe rétractable", "bras", 5, "Des ongles fondus dans un alliage de titane et de carbone.",
      [N(2500, "+1 en Corps à corps lors de l'utilisation, 1d4+Càc de dégâts."), N(3500, "+2 en Corps à corps lors de l'utilisation, 1d4+Càc de dégâts.")],
      arme={"competence": "corpsACorps", "de": "1d4 + Corps à corps", "type": "corpsACorps", "bonusTouche": 1})
    I("index-revolver", "Index revolver", "bras", 2, "Un mécanisme de tir intégré à l'index, conçu pour surprendre une cible sans dégainer d'arme.",
      [N(1500, "1d6 de dégâts."), N(2000, "1d6+1 de dégâts.", bonus=1)],
      arme={"competence": "armeDePoing", "de": "1d6", "type": "pistolet", "typeDeg": "balle"})

    # --- Jambe
    for cle, nom, comp, label, amb in [
            ("chevilles-fortifiees", "Chevilles fortifiées", "athletisme", "Athlétisme", "Articulations de cheville renforcées avec des fibres plastiques et des capsules articulaires remplies de nanogel."),
            ("tendons-renforces", "Tendons renforcés", "acrobatie", "Acrobatie", "Tissu conjonctif biomécanique soutenant les muscles des jambes."),
            ("patte-de-lynx", "Patte de Lynx", "discretion", "Discrétion", "Une modification de jambe qui adoucit la dynamique sonore du mouvement.")]:
        I(cle, nom, "jambe", 5, amb, [N(6500 + 2000 * i, f"+{i + 2} en {label}.", mods=[(f"comp.{comp}", i + 2)]) for i in range(3)])

    # --- Cyber-accessoires
    I("tatouage-lumineux", "Tatouage lumineux", "cyberAccessoire", 1, "Tatouage décoratif qui peut changer de couleur.", [N(100, "+1💀 pour 2 tatouages.")], image="icons/svg/sun.svg")
    I("techchev", "Techchev", "cyberAccessoire", 1, "Cheveux artificiels émettant lumière et couleur.", [N(95, "Cheveux lumineux.")], image="icons/svg/sun.svg")
    I("peau-metal", "Peau métal", "cyberAccessoire", 2, "Peau à couleur métallique.", [N(300, "Peau métallique.")], image="icons/svg/sun.svg")
    I("epiderme-synthetique", "Épiderme synthétique", "cyberAccessoire", 3, "Peau artificielle aux couleurs et motifs changeants.", [N(100, "Peau aux motifs changeants.")], image="icons/svg/sun.svg")

    # --- Capsules d'implant de bras
    cap = dossier("implants", "Capsules (bras)", sort=20, parent=f("bras"))
    docs.append(cap)
    for cle, nom, t, label in [("capsule-neurotox", "Capsule Neurotox", "poison", "poison"), ("capsule-electrostatique", "Capsule Électrostatique", "electrique", "électriques"),
                               ("capsule-surchauffante", "Capsule Surchauffante", "feu", "de feu")]:
        sys = {"description": html(f"1d4 de dégâts {label} supplémentaires. Une seule capsule par implant de bras."),
               "ambiance": "Capsule améliorative qui modifie la technologie implantée dans les bras afin d'en augmenter la létalité.",
               "typeDegats": t, "de": "1d4", "prix": 1000, "coutInstallation": 10, "implant": ""}
        d = item("implants", cle, nom, "capsule", img("implants", "lame-mantis"), sys, cap["_id"])
        REG[cle] = d
        docs.append(d)
    return docs

# =========================================================================
#  Hacks
# =========================================================================

def hack(cle, nom, prix, ram, effet_txt="", org="", robot="", type="electrique", activation="action", defense="glace",
         duree=0, humCible=0, humLanceur=0, variable=0, special="", desc=""):
    sys = {
        "description": html(desc or effet_txt), "ambiance": "", "prix": prix, "ram": ram,
        "variable": {"actif": bool(variable), "parUnite": variable, "unite": "carré de 1,5 m"},
        "activation": activation, "defense": defense, "competence": "piratage", "bonusTouche": 0,
        "degats": {"organique": org, "robot": robot, "type": type},
        "humanite": {"cible": humCible, "lanceur": humLanceur}, "duree": duree, "effet": effet_txt, "special": special,
        "animation": {"glitch": True, "impact": "", "son": ""}
    }
    image = f"systems/cyberpunk2075/assets/hacks/{cle}.webp" if os.path.exists(os.path.join(RACINE, "assets", "hacks", f"{cle}.webp")) else img("implants", "puce-de-piratage")
    d = item("hacks", cle, nom, "hack", image, sys)
    REG[cle] = d
    return d

def hacks():
    return [
        hack("court-circuit", "Court-circuit", 800, 4, "1d6+Piratage de dégâts électriques sur une cible organique, 1d8+Piratage sur un robot.", "1d6 + Piratage", "1d8 + Piratage"),
        hack("cyberpsychose", "Cyberpsychose", 20000, 15, "Met la cible en cyberpsychose. +20💀.", humLanceur=20),
        hack("detonation-involontaire", "Détonation involontaire", 500, 6, "Fait exploser une grenade de la cible. +5💀.", humLanceur=5),
        hack("dysfonctionnement-d-arme", "Dysfonctionnement d'arme", 500, 2, "Si la cible a une arme à feu, elle ne fonctionne plus pendant 1 tour.", duree=1),
        hack("dysfonctionnement-d-implant", "Dysfonctionnement d'implant", 500, 2, "Si la cible a des implants, ils ne fonctionnent plus pendant 1 tour.", duree=1),
        hack("ping", "Ping", 1000, 8, "Localise et détecte le nombre d'ennemis connectés au réseau local. Lancer 1d20+Piratage : tous les ennemis avec une Glace supérieure restent cachés.",
             defense="aucune", special="ping"),
        hack("protocole-de-violation-rapide", "Protocole de violation rapide", 800, 0,
             "Après avoir raté un jet de piratage, ajoutez X RAM à votre jet pour atteindre la Glace de la cible.", defense="aucune", special="violation"),
        hack("redemarrage-optique", "Redémarrage optique", 500, 4, "Rend la cible aveugle durant 1 tour si elle n'a pas d'yeux organiques.", duree=1),
        hack("suicide", "Suicide", 20000, 15, "La cible se suicide. +15💀.", humLanceur=15),
        hack("surchauffe", "Surchauffe", 800, 6, "Les implants de la cible surchauffent : 1d4 de dégâts de feu par implant de la cible, sur 3 tours. Si la cible en meurt, +5💀. Détruit les puces de la cible.",
             org="1d4", type="feu", duree=3),
        hack("pare-feu-reactif", "Pare-feu réactif", 1000, 3, "En réaction, augmente de +4 la Glace de vous ou d'une cible jusqu'à la fin du tour.", activation="reaction", defense="aucune", duree=1),
        hack("glitch-visuel", "Glitch visuel", 800, 0, "Crée une illusion visible par une cible, de 1,5 m par 1,5 m ; 2 RAM par carré de 1,5 m.", variable=2),
        hack("liberateur-d-ocytocine", "Libérateur d'ocytocine", 800, 4, "Ajoute +2 à votre jet de Persuasion ou de Négociation.", defense="aucune"),
    ]

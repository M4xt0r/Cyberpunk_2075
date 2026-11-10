"""Véhicules, planques, améliorations de véhicule et modules de planque (Notion : pages Véhicule et Planque)."""
from base import *
import json, os
from equipement import REG, communs

def acteur(pack, cle, nom, type, image, system, dossier=None, sort=0, items=None, token=None):
    _id = ident(pack, cle)
    image = image or "icons/svg/mystery-man.svg"
    proto = {"name": nom, "texture": {"src": image}, "width": 1, "height": 1, "actorLink": True, "disposition": 0,
             "displayBars": 20, "bar1": {"attribute": None}, "bar2": {"attribute": None}}
    proto.update(token or {})
    embarques = []
    for it in items or []:
        it = json_copie(it)
        it.pop("_pack", None)
        it["folder"] = None
        it["_key"] = f"!actors.items!{_id}.{it['_id']}"
        embarques.append(it)
    return {"_id": _id, "_key": f"!actors!{_id}", "name": nom, "type": type, "img": image, "system": system,
            "items": embarques, "effects": [], "folder": dossier, "sort": sort, "ownership": {"default": 0}, "flags": {},
            "prototypeToken": proto}

def json_copie(d):
    import json
    return json.loads(json.dumps(d))

# =========================================================================
#  Véhicules
# =========================================================================

VEHICULES = [
    # cle, nom, catégorie, prix, vitesse, maniabilité, vie, slots, places, ambiance, (pickup, placesNote)
    ("apollo-brennan", "Apollo Brennan", "moto", 18000, "C", 4, 20, 1, 2, "Équipé d'un moteur puissant parfait pour les conditions hors route."),
    ("arch-nazare", "Arch Nazaré", "moto", 20000, "B", 5, 20, 1, 2, "Le favori des téléspectateurs n°1 de l'émission « Guns and Horses » pendant deux années consécutives."),
    ("kusanagi-ct-3x", "Kusanagi CT-3X", "moto", 23500, "A", 6, 20, 1, 1, "Le cadre élégant et aérodynamique de ce Kusanagi cache un moteur puissant. Il va vous falloir des réflexes surhumains pour y faire face."),
    ("archer-hella", "Archer Hella EC-D i360", "voiture", 13000, "C", 0, 40, 2, 4, "La première unité est sortie de la chaîne de montage en 2023, connue pour sa faible qualité."),
    ("archer-quartz", "Archer Quartz EC-T2 r660", "voiture", 11000, "D", 0, 40, 1, 2, "Selon les statistiques du NCPD, ce modèle se retrouve dans jusqu'à 17 % des accidents signalés à Night City, bien qu'il ne représente que 2 % de tous les véhicules immatriculés."),
    ("herrera-outlaw", "Herrera Outlaw GTS", "voiture", 23000, "B", 2, 60, 2, 4, "Un favori du showbiz, l'Outlaw est piloté par l'animateur de talk-show le plus populaire, Ziggy Q, entre autres."),
    ("makigai-maimai", "Makigai MaiMai P126", "voiture", 6000, "E", -1, 20, 1, 2, "La plus petite voiture produite en série autorisée dans les rues de Night City."),
    ("mizutani-shion", "Mizutani Shion MZ2", "voiture", 18000, "B", 1, 40, 2, 2, "Le Shion MZ2 est doté d'un turbo amélioré, d'une meilleure adhérence des pneus et d'une transmission plus robuste, ce qui en fait le plus rapide de la collection Mizutani."),
    ("quadra-type-66", "Quadra Type-66 Avenger", "voiture", 15000, "C", 2, 40, 2, 2, "Considérée par les téléspectateurs comme la voiture la plus sexy de l'émission « Guns and Horses »."),
    ("quadra-turbo-r", "Quadra Turbo-R V-Tech", "voiture", 28000, "A", 3, 40, 2, 2, "Apparaît dans la poursuite en voiture emblématique sur le toit d'une usine à Jakarta dans le film à succès Bushidō 7 : Revenge Never Sleeps."),
    ("thorton-galena", "Thorton Galena G240", "voiture", 8000, "E", 0, 20, 1, 4, "Bon marché et fiable, ce favori culte a été immortalisé dans le tube punk-rock de 2034, « Poundin' Gina in my Galena »."),
    ("thorton-colby", "Thorton Colby CX410 Butte", "voiture", 14000, "D", 2, 60, 1, 4, "Le camion de livraison le plus vendu de Night City, avec jusqu'à 100 000 unités dans la seule ville.", True),
    ("thorton-mackinaw", "Thorton Mackinaw MTL1", "voiture", 12000, "D", 1, 60, 1, 6, "Un ajout obligatoire à chaque chanson country, la voiture a même son propre musée dans l'arrière-pays du Tennessee.", True),
    ("villefort-alvarado", "Villefort Alvarado V4F 570 Delegate", "voiture", 25000, "C", 2, 60, 2, 2, "L'Alvarado présente une direction étonnamment réactive grâce à ses deux essieux avant."),
    ("chevillon-emperor", "Chevillon Emperor 620 Ragnar", "utilitaire", 20000, "C", 0, 80, 3, 5, "Récompensé par la « Ceinture de sécurité dorée » au salon de l'automobile de Cologne en 2072."),
    ("kaukaz-bratsk", "Kaukaz Bratsk U4020", "utilitaire", 28000, "E", -3, 80, 2, 3, "Ce mauvais garçon brûle autant de carburant par heure qu'il en faudrait pour chauffer un mégabloc entier. Et avouons-le : il est aussi gros et laid qu'un mégabloc.", False, "+ 6 dans la remorque"),
    ("villefort-columbus", "Villefort Columbus V340-F Freight", "utilitaire", 11000, "E", 0, 60, 4, 4, "Le Columbus est le modèle le plus jeune, le moins cher et le plus populaire de la gamme Villefort. Un favori parmi les compagnies maritimes et les familles nombreuses."),
    ("mizutani-coyote", "Mizutani Shion « Coyote »", "blinde", 32000, "A", 3, 100, 3, 2, "Grâce à ses mises à niveau, ce modèle est capable d'aller à pleine vitesse même à des températures supérieures à 135 °F."),
    ("quadra-javelina", "Quadra Type-66 « Javelina »", "blinde", 26000, "B", 2, 100, 3, 2, "Propulsé par un moteur optimisé avec une finition blindée."),
    ("thorton-little-mule", "Thorton Colby « Little Mule »", "blinde", 21000, "C", 2, 100, 3, 4, "Équipé d'un système d'holoprojection CrystalDome. Extra-renforcé.", True),
    ("thorton-gecko", "Thorton Galena « Gecko »", "blinde", 15000, "D", 0, 100, 2, 2, "Une voiture qui se comporte comme du beurre et flotte comme dans un rêve, peu importe où la route vous mène."),
    ("thorton-warhorse", "Thorton Mackinaw « Warhorse »", "blinde", 19500, "D", 1, 100, 3, 6, "La seule chose que cette voiture a en commun avec votre Thorton Mackinaw de base est sa carrosserie en acier. Chef-d'œuvre du bricolage automobile, ce bébé a été conçu pour le grand désert.", True),
]

TOKENS = json.load(open(os.path.join(os.path.dirname(__file__), "tokens_vehicules.json"), encoding="utf-8"))

def vehicules():
    noms = {"moto": "Motos", "voiture": "Voitures", "utilitaire": "Utilitaires", "blinde": "Blindés"}
    D = {k: dossier("vehicules", n, "Actor", sort=i) for i, (k, n) in enumerate(noms.items())}
    docs = list(D.values())
    for i, v in enumerate(VEHICULES):
        cle, nom, cat, prix, vit, man, vie, slots, places, amb = v[:10]
        pickup = v[10] if len(v) > 10 else False
        note = v[11] if len(v) > 11 else ""
        sys = {"categorie": cat, "pickup": pickup, "blinde": cat == "blinde", "armesInterdites": cat == "moto",
               "vitesse": vit, "maniabilite": man, "vie": {"value": vie, "base": vie}, "slots": slots, "places": places,
               "placesNote": note, "prix": prix, "ambiance": amb, "pilote": "", "description": ""}
        # Token fourni (vu de dessus, orienté vers le haut) à sa taille réelle, au moins une case par place
        t = TOKENS.get(cle)
        image = f"systems/cyberpunk2075/assets/tokens/vehicules/{t['fichier']}.webp" if t else img("vehicules", cle)
        taille = {"width": t["w"], "height": t["h"]} if t else {"width": 2, "height": 1}
        docs.append(acteur("vehicules", cle, nom, "vehicule", image, sys, D[cat]["_id"], i,
                           token={"bar1": {"attribute": "vie"}, **taille}))
    return docs

def ameliorations():
    def A(cle, nom, ambiance, niveaux, arme=None, pickup=False, desc=""):
        seul = len(niveaux) == 1
        atk = arme or {}
        niv = [{"prix": p, "effet": effet(t, mods=m), "de": atk.get("de", "1d6"), "bonusFixe": 0, "typeDegats": "balle"} for p, t, m in niveaux]
        sys = {**communs(html(desc) if desc else "", ambiance, seul),
               **attaque(atk.get("competence", "armeLourde"), atk.get("carac", ""), None, "adaptabilite", None, True),
               "armeIntegree": bool(arme), "typeArmeIntegree": "autre", "pickupSeulement": pickup, "niveaux": trois(niv)}
        d = item("ameliorations-vehicule", cle, nom, "ameliorationVehicule", "icons/svg/upgrade.svg", sys)
        REG[cle] = d
        return d
    return [
        A("moteur-mk2", "Moteur MK2", "Un moteur, c'est fait pour vibrer, alors pourquoi le laisser si silencieux ?",
          [(6000, "Augmente la vitesse de 1 cran.", [("vitesse", 1)]), (8000, "Augmente la vitesse de 2 crans.", [("vitesse", 2)])]),
        A("suspension-carbone", "Suspension en carbone ultra souple", "La vie est plus simple lorsque l'on ne sent pas les imperfections de la route.",
          [(6000, "Augmente la maniabilité de 1 cran.", [("maniabilite", 1)]), (8000, "Augmente la maniabilité de 2 crans.", [("maniabilite", 2)])]),
        A("tourelle-manuelle", "Tourelle manuelle", "Un obstacle ? Une rafale !",
          [(6000, "Ajoute une tourelle manuelle (arme lourde), seulement sur les pick-up : 1d12+Const.", [])],
          arme={"competence": "armeLourde", "carac": "const", "de": "1d12"}, pickup=True),
        A("pose-mine", "Pose-mine", "Pour une fuite explosive.",
          [(4000, "Permet de stocker 6 C4 sous le véhicule et de les lâcher.", [])]),
        A("mitrailleuse-fixe", "Mitrailleuse fixe", "Devant se trouve l'avenir, eh bien cassez-lui la gueule !",
          [(4000, "Place 2 mitrailleuses légères à l'avant ; le pilote peut utiliser son action bonus pour attaquer : 1d6+Pilotage.", [])],
          arme={"competence": "pilotage", "de": "1d6 + Pilotage"}),
        A("tourelle-sur-pivot", "Tourelle sur pivot", "Rien de mieux qu'une tourelle pour se croire dans un petit tank.",
          [(8000, "Le copilote contrôle une tourelle (arme lourde) ; si le conducteur possède l'implant Liaison intelligente, il peut la contrôler : 1d8+Réf.", [])],
          arme={"competence": "armeLourde", "carac": "ref", "de": "1d8"}, desc="Arme intelligente."),
        A("radar", "Radar", "Bien mieux qu'un GPS.", [(6500, "Scanne votre environnement sur 1 km à la ronde pour ne pas perdre une cible.", [])]),
        A("pilotage-automatique", "Pilotage automatique", "Dormir au volant n'a jamais été plus vrai.", [(5000, "Permet de donner des ordres de déplacement à votre véhicule.", [])]),
    ]

# =========================================================================
#  Planques
# =========================================================================

def planques():
    data = [("local", "Local", "Petit, mais utile."),
            ("appartement", "Appartement", "Bon, si on écarte les voisins désagréables, c'est plutôt pas mal."),
            ("garage", "Garage", "Il faut bien pouvoir les bichonner, nos amis au V12."),
            ("hangar", "Hangar", "Que celui qui me dit qu'il manque de place mange mon cracheur."),
            ("bar", "Bar", "Après l'effort, le réconfort.")]
    docs = []
    for i, (cle, nom, amb) in enumerate(data):
        desc = f"<p><em>{amb}</em></p>"
        if cle == "bar":
            desc += html("Si vous recrutez un barman, l'établissement peut être utilisé à des fins mafieuses (attention, les murs ont des oreilles) et rapporte 100 €$ + qualité par session (200 €$ au niveau 2).")
        if cle == "appartement":
            desc += html("Le Module de Vie y est présent d'office, ne peut pas être retiré et ne prend pas d'emplacement.")
        sys = {"type": cle, "niveau": 1, "qualite": "miteux", "modulesForces": None, "parkingForce": None, "barman": False, "adresse": "", "description": desc}
        items = [REG["module-de-vie"]] if cle == "appartement" else []
        docs.append(acteur("planques", cle, nom, "planque", img("bannieres", "planques"), sys, None, i, items=items))
    return docs

def modules():
    def M(cle, nom, ambiance, niveaux, types=(), vie=False, desc=""):
        seul = len(niveaux) == 1
        niv = [{"prix": p, "effet": effet(t, mods=m)} for p, t, m in niveaux]
        sys = {**communs(html(desc) if desc else "", ambiance, seul), "types": list(types), "vieOffice": vie, "niveaux": trois(niv)}
        d = item("modules-planque", cle, nom, "modulePlanque", "icons/svg/house.svg", sys)
        REG[cle] = d
        return d
    soins = lambda s, c: [("soinsDonnes", s), ("comp.charcutage", c), ("comp.medecine", c)]
    net = "Vous permet de tout pirater à distance. Les connexions directes devront être effectuées par un allié sur place."
    return [
        M("module-de-vie", "Module de Vie", "Il faut bien se reposer des fois.",
          [(200, "Peut loger 2 personnes.", [("hebergement", 2)]), (300, "Peut loger 4 personnes.", [("hebergement", 4)]), (400, "Peut loger 6 personnes.", [("hebergement", 6)])],
          vie=True, desc="Présent d'office dans les Appartements, où il ne peut pas être retiré et ne prend pas d'emplacement de module."),
        M("module-charcudoc", "Module de Charcudoc", "Une table d'opération peut se rendre vite indispensable en temps de guerre.",
          [(300, "+1 à tous vos soins prodigués et +2 à vos jets de Charcutage et Médecine.", soins(1, 2)),
           (600, "+2 à tous vos soins prodigués et +2 à vos jets de Charcutage et Médecine.", soins(2, 2)),
           (900, "+2 à tous vos soins prodigués et +3 à vos jets de Charcutage et Médecine.", soins(2, 3))]),
        M("module-netrunner", "Module de NetRunner", "Finis les bains de glace, dites bonjour à de la tech de pointe.",
          [(300, f"{net} +1 en Piratage lorsque vous êtes connecté.", [("comp.piratage", 1)]),
           (600, f"{net} +2 en Piratage lorsque vous êtes connecté.", [("comp.piratage", 2)]),
           (900, f"{net} +2 en Piratage lorsque vous êtes connecté. Divise par 2 le coût du Protocole de violation rapide.", [("comp.piratage", 2)])]),
        M("module-mecano", "Module du Mécano", "Une clé à molette, une voiture, une bière, et le travail sera forcément bien fait.",
          [(300, "Ajoute 1 place de parking, +1 en Tech quand vous bricolez un véhicule.", [("parking", 1)]),
           (600, "Ajoute 1 place de parking, +2 en Tech quand vous bricolez un véhicule.", [("parking", 1)]),
           (900, "Ajoute 2 places de parking, +2 en Tech quand vous bricolez un véhicule.", [("parking", 2)])],
          types=("garage", "hangar"), desc="Disponible seulement dans le garage et le hangar."),
        M("module-securite", "Module de Sécurité", "S'il y a un intrus, autant l'accueillir comme il se doit.",
          [(5000, "Équipe votre planque de 2 tourelles automatiques (1d6 de dégâts), d'un système d'alarme et d'une caméra de surveillance.", []),
           (7000, "Équipe votre planque de 4 tourelles automatiques (1d6 de dégâts), d'un système d'alarme et d'une caméra de surveillance.", [])]),
    ]

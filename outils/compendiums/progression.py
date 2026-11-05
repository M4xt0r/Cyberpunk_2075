"""Classes, sous-classes et talents (Notion : page Classe)."""
from base import *
from equipement import REG

PACK = "classes"

def talent(cle, nom, source, niveau, desc, e=None, special=""):
    sys = {"description": html(desc), "ambiance": "", "source": source, "niveauObtention": niveau, "special": special,
           "effet": e or effet(desc), "usages": {"utilises": 0}, "actif": {"enCours": False, "tours": 0}}
    d = item(PACK, cle, nom, "talent", "icons/svg/upgrade.svg", sys)
    REG["talent:" + cle] = d
    return d

def ref(d, **kw):
    """Référence vers un document du compendium (talent, item du pack)."""
    pack = d["_pack"] if "_pack" in d else None
    return {"uuid": uuid(pack, d["_id"]), "nom": d["name"], "resume": kw.pop("resume", ""), **kw}

def resume(texte):
    t = " ".join(texte.split())
    return t if len(t) <= 120 else t[:117] + "…"

def T(cle, nom, source, niveau, desc, **kw):
    special = kw.pop("special", "")
    e = effet(desc, **kw)
    return talent(cle, nom, source, niveau, desc, e, special)

def classes():
    dC, dS, dT = dossier(PACK, "Classes", sort=0), dossier(PACK, "Sous-classes", sort=1), dossier(PACK, "Talents", sort=2)
    docs = [dC, dS, dT]
    talents = {}

    def add(t):
        t["folder"] = dT["_id"]
        t["_pack"] = PACK
        talents[t["name"]] = t
        docs.append(t)
        return t

    # ---------------- Talents de classe et traits ultimes
    TC = {
        "Solo": [
            add(T("expert-en-armement", "Expert en armement", "classe", 3, "Vous gagnez un bonus de +1 aux dégâts des armes à feu ou de mêlée que vous tenez.", mods=[("degats", 1)])),
            add(T("dur-a-cuire", "Dur à cuire", "classe", 8, "Une fois par repos long, un coup qui vous mettrait à 0 PV vous laisse à 1 PV, sans stress.", periode="repos", max=1)),
            add(T("edgerunner", "Edgerunner", "ultime", 10, "Vous transcendez la limite d'implants de 1 pour chaque partie du corps, sauf le port neural.", special="edgerunner")),
        ],
        "Techie": [
            add(T("expertise", "Expertise", "classe", 3, "Vos jets de Tech sur une tech ont avantage.")),
            add(T("bricoleur", "Bricoleur", "classe", 8, "Vos jets de réparation ont avantage.")),
            add(T("surcalibrage", "Surcalibrage", "ultime", 10,
                  "Vous êtes capable d'améliorer n'importe quel implant ou arme d'un niveau pour une période de 24 h, pour +5💀 au possesseur de l'implant et à l'activation de celui-ci (sauf s'il est passif). Si le niveau dépasse 3, voir avec le MJ les nouveaux effets. Deux fois par repos long.",
                  type="actif", periode="repos", max=2, cout=5)),
        ],
        "Hacker": [
            add(T("controle-des-sans-ames", "Contrôle des sans-âmes", "classe", 3,
                  "Prenez le contrôle des drones, exosquelettes et véhicules. Il vous faut dépenser en RAM la Glace de la cible moins votre Piratage. Vous ne pouvez pas lancer d'autre hack pendant l'utilisation.", type="actif")),
            add(T("retour-de-flamme", "Retour de flamme", "classe", 8, "Si un piratage échoue contre vous, vous pouvez utiliser votre réaction pour infliger 1d8 de dégâts électriques.",
                  type="actif", activation="reaction", jet="1d8", jetType="degats", typeDeg="electrique")),
            add(T("overclocking", "OverClocking", "ultime", 10, "Vous pouvez dépenser des points de vie à la place de votre RAM afin de pirater.", special="overclocking")),
        ],
        "Anti-Corpo": [
            add(T("provocateur", "Provocateur", "classe", 3,
                  "Par une réaction, jusqu'à 3 cibles sont forcées de vous attaquer jusqu'au début de leur prochain tour. Utilisable un nombre de fois égal à votre BM.",
                  type="actif", activation="reaction", periode="bm", cibles=3)),
            add(T("cohesion-de-fer", "Cohésion de fer", "classe", 8,
                  "Par une réaction, vos alliés ont +2 en Adaptabilité jusqu'à la fin du tour. Utilisable un nombre de fois égal à votre BM − 1.",
                  type="actif", activation="reaction", periode="bm", duree=1)),
            add(T("ennemi-public", "Ennemi public", "ultime", 10,
                  "Au début de chaque combat, les ennemis qui vous voient font un jet de Sang-Froid (DD 10 + bonus). En cas d'échec, ils ont désavantage contre vous ; au début de chacun de leurs tours, ils refont ce jet tant qu'ils ne l'ont pas réussi.")),
        ],
    }

    # ---------------- Classes
    CLASSES = [
        ("Solo", "solo", {"const": 2, "safr": 1}, 5000, ("1d2", "0", "1d4"),
         "Les Solos sont des tueurs à gages, des gardes du corps et des mercenaires. En gros vous connaissez très peu les mots « discussion » et « compromis » : les effusions de sang et la poudre sont votre système de communication."),
        ("Techie", "techie", {"int": 1, "captec": 2}, 1000, ("0", "1d2", "1d4"),
         "Les Techies peuvent être des techniciens ou des spécialistes cybernétiques. Vous en connaissez un rayon sur les nouvelles technologies et vous prônez la supériorité cybernétique, au point qu'avoir les couilles en or est à prendre au sens littéral."),
        ("Hacker", "hacker", {"int": 2, "safr": 1}, 3000, ("0", "1d4", "1d2"),
         "À l'aide de leurs implants d'interface cerveau-ordinateur, les Hackers parcourent Internet à la recherche de systèmes à pirater et d'informations à vendre. Vous avez un certain goût pour les bains glacés et votre meilleur ami n'existe que dans le net."),
        ("Anti-Corpo", "anti-corpo", {"ref": 1, "safr": 2}, 3500, ("1d2", "1d2", "1d2"),
         "Les Anti-Corpos ne sont pas compliqués à comprendre : la mettre aux corpos, c'est leur dada. Vous avez un lien avec les grands de ce monde qui vous ont laissé un goût amer dans la bouche, et de ce goût vous faites un gros molard qui file droit dans leur visage."),
    ]
    SOUS = {
        "Solo": ["Gunner", "Samouraï"], "Techie": ["Mécano", "Charcudoc"],
        "Hacker": ["NetRunner", "Journaliste"], "Anti-Corpo": ["Rocker Boy", "Nomad"]
    }

    # ---------------- Sous-classes
    def p(cle, niveau=1, quantite=1, **kw):
        d = REG[cle]
        return {"uuid": uuid(d["_pack"], d["_id"]), "nom": d["name"], "resume": "", "mode": "precis", "type": d["type"],
                "niveau": niveau, "quantite": quantite, "categorie": d["type"] if d["type"] != "objet" else "objet", "prixMax": 0, "texte": ""}

    def choix(categorie, prixMax=0, texte="", mode="choix", quantite=1):
        return {"uuid": "", "nom": "", "resume": "", "mode": mode, "type": "", "niveau": 1, "quantite": quantite,
                "categorie": categorie, "prixMax": prixMax, "texte": texte}

    def m(c="", ch=""):
        return {"competence": c, "choix": ch}

    def ts(cle, nom, niveau, desc, **kw):
        return add(T(cle, nom, "sousClasse", niveau, desc, **kw))

    SC = {
        "Gunner": ("Solo", [m("explosif"), m("intimidation"), m("", "armeDePoing,armeLourde,sniper")],
                   [p("noyau-mecatronique"), p("biomoniteur"), choix("arme", 1000, "Une arme au choix"), p("f-gx-frag", quantite=2)],
                   [ts("oeil-de-faucon", "Œil de Faucon", 1, "Vous possédez une réaction supplémentaire, uniquement pour réaliser un tir de réaction."),
                    ts("boucherie", "Boucherie", 5, "Si vous avez tué une cible, vous possédez une action supplémentaire. Une fois par tour.")]),
        "Samouraï": ("Solo", [m("acrobatie"), m("perception"), m("corpsACorps")],
                     [p("microrotore"), p("katana", 2), p("x-22-flashbang", quantite=2)],
                     [ts("protection-d-acier", "Protection d'acier", 1,
                         "Vous pouvez parer en réaction les balles qui vous sont destinées lorsque vous tenez un Katana ou des Lames Mantis. Opposition du jet de touche contre un DD de Réflexes.",
                         type="actif", activation="reaction"),
                      ts("kami-kaze", "Kami Kaze", 5, "Lorsque vous tenez un Katana à découvert, votre Adaptabilité augmente de 3 et votre vitesse de déplacement de 12 m par tour.")]),
        "Mécano": ("Techie", [m("perception"), m("tech"), m("pilotage")],
                   [p("optique-kiroshi"), choix("implant", 0, "1 amélioration d'Optique Kiroshi gratuite", mode="gratuit"), p("m2038-tactician"),
                    choix("vehicule", 12000, "Un véhicule au choix (compendium Véhicules)")],
                   [ts("as-du-volant", "As du volant", 1, "Vos jets de Pilotage ont avantage."),
                    ts("cyborg", "Cyborg", 5, "Lorsque vous utilisez un implant, votre Humanité n'augmente que de moitié si elle devait augmenter.")]),
        "Charcudoc": ("Techie", [m("charcutage"), m("tech"), m("medecine")],
                      [p("liaison-intelligente"), p("a-22b-chao"), p("gant-de-charcudoc"), p("trousse-de-soin"), p("immunosuppresseur", quantite=3),
                       choix("module", 0, "Planque Local niv. 1 avec 1 module Charcudoc (compendiums Planques et Modules)", mode="gratuit")],
                      [ts("doigt-de-metal", "Doigt de métal", 1, "Pour chaque soin que vous prodiguez, ajoutez 1d6."),
                       ts("premiers-secours", "Premiers secours", 5, "Une fois par repos long, la première fois que vous relevez un allié à 1 PV, il ne gagne pas de point de stress.",
                          periode="repos", max=1)]),
        "NetRunner": ("Hacker", [m("piratage"), m("savoir"), m("tech")],
                      [p("puce-de-piratage"), choix("hack", 1000, "2 hacks gratuits", mode="gratuit", quantite=2), p("nue"), p("infovisiere")],
                      [ts("metahack", "Métahack", 1, "Après un hack réussi, choisissez une autre cible atteignable (2,5 m) pour la moitié de la valeur en RAM de ce hack."),
                       ts("createur-de-daemons", "Créateur de daemons", 5, "Vous pouvez créer des hacks personnalisés en utilisant votre compétence de Piratage (voir avec le MJ).")]),
        "Journaliste": ("Hacker", [m("piratage"), m("investigation"), m("persuasion")],
                        [p("puce-de-piratage"), choix("hack", 800, "1 hack gratuit", mode="gratuit"), p("a-22b-chao"), p("camera-glass"), p("couronne-de-ds")],
                        [ts("credibilite", "Crédibilité", 1, "Lorsque vous voulez convaincre des foules par un beau discours ou une vidéo, vous avez avantage sur votre jet de Persuasion."),
                         ts("max-headroom", "Max Headroom", 5, "Lorsque vous piratez un objet en lien avec l'audiovisuel, vous avez avantage sur votre jet.")]),
        "Rocker Boy": ("Anti-Corpo", [m("spectacle"), m("persuasion"), m("corpsACorps")],
                       [p("moelle-epaisse"), p("audivox"), choix("cyberAccessoire", 0, "1 cyber-accessoire au choix"), p("liberty"), p("m251s-ajax"), p("guitare"), p("c4", quantite=3)],
                       [ts("la-voix-du-rock", "La voix du Rock", 1, "Par une action bonus, un allié ajoute 1d4 à son prochain jet. Utilisable un nombre de fois égal à votre BM.",
                           type="actif", activation="bonus", periode="bm"),
                        ts("bagarre-de-rue", "Bagarre de rue", 5, "Quand vous vous battez, n'importe quel objet devient une arme de statistique 1d6+Càc.")]),
        "Nomad": ("Anti-Corpo", [m("survie"), m("pilotage"), m("negociation")],
                  [p("stabilisateur-de-recul"), p("ashura"), choix("vehicule", 0, "Thorton Mackinaw MTL1 (compendium Véhicules)", mode="gratuit")],
                  [ts("6e-sens", "6e sens", 1, "Vous savez d'un simple regard si quelqu'un vous ment. Utilisable un nombre de fois égal à votre BM.", periode="bm"),
                   ts("combat-motorise", "Combat motorisé", 5, "Lorsque vous êtes pilote ou passager d'un véhicule, vous n'avez aucun désavantage pour utiliser n'importe quel type d'arme.")]),
    }
    sous_docs = {}
    for nom, (parente, maitrises, pack, tal) in SC.items():
        sys = {"description": "", "ambiance": "", "classeParente": parente, "maitrises": maitrises, "pack": pack,
               "talents": [{"uuid": uuid(PACK, t["_id"]), "nom": t["name"], "resume": resume(t["system"]["effet"]["description"]), "niveau": t["system"]["niveauObtention"]} for t in tal]}
        d = item(PACK, "sc-" + slug(nom), nom, "sousClasse", img("classes", slug(parente)), sys, dS["_id"])
        sous_docs[nom] = d
        docs.append(d)

    for i, (nom, cle, bonus, eddies, (vie, ram, hum), desc) in enumerate(CLASSES):
        b = {k: bonus.get(k, 0) for k in ["const", "ref", "captec", "int", "safr"]}
        sys = {"description": html(desc), "ambiance": "", "bonus": b, "eddies": eddies, "gains": {"vie": vie, "ram": ram, "humanite": hum},
               "talents": [{"uuid": uuid(PACK, t["_id"]), "nom": t["name"], "resume": resume(t["system"]["effet"]["description"]), "niveau": t["system"]["niveauObtention"]} for t in TC[nom]],
               "sousClasses": [{"uuid": uuid(PACK, sous_docs[s]["_id"]), "nom": s, "resume": ""} for s in SOUS[nom]]}
        docs.append(item(PACK, "classe-" + cle, nom, "classe", img("classes", cle), sys, dC["_id"], sort=i))

    for d in docs:
        d.pop("_pack", None)
    return docs

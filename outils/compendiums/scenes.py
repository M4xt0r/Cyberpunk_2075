"""Scènes prêtes à l'emploi (compendium « Scènes »)."""
from base import ident

SCN = "systems/cyberpunk2075/assets/scenes"

def route(cle, nom, nav, fichier, fond, largeur=1600):
    _id = ident("scene", cle)
    return {
        "_id": _id,
        "_key": f"!scenes!{_id}",
        "name": nom,
        "navigation": False,
        "navName": nav,
        "background": {"src": f"{SCN}/{fichier}.webm"},
        "thumb": f"{SCN}/{fichier}_vignette.webp",
        "width": largeur, "height": 2200, "padding": 0,
        "backgroundColor": fond,
        "initial": {"x": largeur // 2, "y": 1100, "scale": 0.45},
        "grid": {"type": 1, "size": 100, "distance": 1.5, "units": "m", "color": "#000000", "alpha": 0.12},
        "tokenVision": True,
        "fog": {"exploration": False},
        "environment": {"globalLight": {"enabled": True}, "darknessLevel": 0},
        "flags": {"cyberpunk2075": {"defilement": {"actif": False, "vitesse": 1}}},
        "tokens": [], "walls": [], "lights": [], "notes": [], "sounds": [], "tiles": [], "drawings": [], "templates": [], "regions": [],
        "ownership": {"default": 0},
        "folder": None, "sort": 0
    }

def scenes():
    return [
        route("route-badlands", "Course-poursuite · Route des Badlands", "Route des Badlands", "route_badlands", "#2a1f16"),
        route("route-ville", "Course-poursuite · Rue de Night City", "Rue de Night City", "route_ville", "#1c1c24"),
        route("route-ville-double", "Course-poursuite · Avenue de Night City (2×2 voies)", "Avenue de Night City", "route_ville_double", "#1c1c24", 2200),
    ]

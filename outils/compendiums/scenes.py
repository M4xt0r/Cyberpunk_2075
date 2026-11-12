"""Scènes prêtes à l'emploi (compendium « Scènes »)."""
from base import ident

SCN = "systems/cyberpunk2075/assets/scenes"

def scenes():
    _id = ident("scene", "route-badlands")
    return [{
        "_id": _id,
        "_key": f"!scenes!{_id}",
        "name": "Course-poursuite · Route des Badlands",
        "navigation": False,
        "navName": "Route des Badlands",
        "background": {"src": f"{SCN}/route_badlands.webm"},
        "thumb": f"{SCN}/route_badlands_vignette.webp",
        "width": 1600, "height": 2200, "padding": 0,
        "backgroundColor": "#2a1f16",
        "initial": {"x": 800, "y": 1100, "scale": 0.45},
        "grid": {"type": 1, "size": 100, "distance": 1.5, "units": "m", "color": "#000000", "alpha": 0.12},
        "tokenVision": True,
        "fog": {"exploration": False},
        "environment": {"globalLight": {"enabled": True}, "darknessLevel": 0},
        "flags": {"cyberpunk2075": {"defilement": {"actif": False, "vitesse": 1}}},
        "tokens": [], "walls": [], "lights": [], "notes": [], "sounds": [], "tiles": [], "drawings": [], "templates": [], "regions": [],
        "ownership": {"default": 0},
        "folder": None, "sort": 0
    }]

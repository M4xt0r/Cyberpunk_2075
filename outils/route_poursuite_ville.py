"""Route urbaine de Night City, 2 voies, vue du dessus, tuilable verticalement (période H)."""
import numpy as np
from scipy.ndimage import gaussian_filter
from PIL import Image, ImageDraw, ImageFilter
import math

W, H, C = 1600, 2200, 100
rng = np.random.default_rng(2077)
cx = W / 2
demi_route = 3 * C
trottoir = demi_route + 1.3 * C          # bord extérieur du trottoir
x = np.arange(W)[None, :].repeat(H, 0)
d = np.abs(x - cx)

def bruit(sigma, amp=1.0):
    n = gaussian_filter(rng.standard_normal((H, W)), sigma, mode="wrap")
    return n / (np.abs(n).max() + 1e-9) * amp

def couche(base, *b):
    img = np.zeros((H, W, 3), np.float32) + np.array(base, np.float32)
    for c in b: img += c[..., None]
    return img

# --- Fond : asphalte, trottoir en dalles, toits
asph = couche((46, 46, 52), bruit(2, 8), bruit(1, 6), bruit(40, 8), bruit(140, 6))
dalles = couche((92, 92, 98), bruit(1, 6), bruit(20, 6))
yy = np.arange(H)[:, None].repeat(W, 1)
joints = ((yy % 100) < 3) | (((x - cx) % 100) < 3)
dalles[joints] -= 22
toits = couche((40, 40, 46), bruit(1, 5), bruit(60, 6))

img = toits.copy()
m_tr = (d < trottoir).astype(np.float32)
img = img * (1 - m_tr[..., None]) + dalles * m_tr[..., None]
m_r = (d < demi_route).astype(np.float32)
img = img * (1 - m_r[..., None]) + asph * m_r[..., None]
# usure des bandes de roulement
for voie in (-1, 1):
    for roue in (-0.75, 0.75):
        m = np.exp(-((x - (cx + voie * 1.5 * C + roue * C)) / 22) ** 2) * m_r
        img -= (m * 6)[..., None]
img = np.clip(img, 0, 255)
im = Image.fromarray(img.astype(np.uint8))
dr = ImageDraw.Draw(im, "RGBA")

def rect(x0, y0, x1, y1, fill, outline=None, width=1):
    for dy in (-H, 0, H):
        dr.rectangle([x0, y0 + dy, x1, y1 - 1 + dy], fill=fill, outline=outline, width=width)
def ell(x0, y0, x1, y1, fill, outline=None):
    for dy in (-H, 0, H):
        dr.ellipse([x0, y0 + dy, x1, y1 + dy], fill=fill, outline=outline)
def ligne(pts, fill, width):
    for dy in (-H, 0, H):
        dr.line([(a, b + dy) for a, b in pts], fill=fill, width=width)

# --- Bordures de trottoir
for s in (-1, 1):
    xb = cx + s * demi_route
    dr.rectangle([min(xb, xb + s * 14), 0, max(xb, xb + s * 14), H - 1], fill=(150, 150, 156, 255))
# Marquages : rives blanches, centre jaune discontinu (période 200)
for s in (-1, 1):
    xl = cx + s * (demi_route - 22)
    dr.rectangle([xl - 5, 0, xl + 5, H - 1], fill=(225, 222, 210, 190))
for y in range(0, H, 200):
    rect(cx - 7, y, cx + 7, y + 110, (232, 186, 40, 210))
# Passage piéton (une fois par boucle)
yp = 1500
for k in range(int(-demi_route + 30), int(demi_route - 30), 50):
    rect(cx + k, yp, cx + k + 28, yp + 130, (225, 222, 210, 200))
rect(cx - demi_route + 20, yp - 40, cx - 20, yp - 30, (225, 222, 210, 200))      # ligne d'arrêt
# Plaques d'égout, taches, fissures
for k in range(5):
    x0 = cx + rng.uniform(-demi_route + 60, demi_route - 60); y0 = rng.uniform(0, H)
    ell(x0 - 26, y0 - 26, x0 + 26, y0 + 26, (34, 34, 38, 255), outline=(70, 70, 76, 255))
    for t in range(-18, 19, 9): ligne([(x0 - 18, y0 + t), (x0 + 18, y0 + t)], (60, 60, 66, 255), 2)
for k in range(10):
    x0 = cx + rng.uniform(-demi_route + 50, demi_route - 50); y0 = rng.uniform(0, H); r = rng.uniform(12, 36)
    ell(x0 - r, y0 - r * 0.7, x0 + r, y0 + r * 0.7, (14, 14, 20, 100))
for k in range(18):
    px, py = cx + rng.uniform(-demi_route, demi_route), rng.uniform(0, H)
    pts = [(px, py)]
    for _ in range(rng.integers(3, 8)):
        px += rng.uniform(-22, 22); py += rng.uniform(-28, 28); pts.append((px, py))
    ligne(pts, (24, 24, 28, 140), 2)

# --- Immeubles : blocs de toits de part et d'autre, ruelles entre eux
NEONS = [(255, 47, 146), (0, 229, 255), (255, 214, 0), (178, 80, 255), (255, 80, 60)]
def immeubles(cote):
    xa, xb = (0, cx - trottoir) if cote < 0 else (cx + trottoir, W)
    y = 0
    while y < H:
        h = rng.choice([260, 330, 400, 480, 550])
        h = min(h, H - y) if H - y < 300 else h
        if H - y - h < 150: h = H - y
        gris = rng.integers(36, 70)
        teinte = (gris, gris, gris + rng.integers(4, 14))
        mx = 6
        rect(xa + mx, y + 8, xb - mx, y + h - 8, teinte + (255,), outline=(22, 22, 28, 255), width=4)
        # rebord intérieur
        rect(xa + mx + 14, y + 22, xb - mx - 14, y + h - 22, None, outline=(teinte[0] + 14, teinte[1] + 14, teinte[2] + 14, 255), width=2)
        # équipements de toit : climatiseurs, conduits, antennes, panneaux
        for _ in range(rng.integers(2, 6)):
            w_, h_ = rng.uniform(40, 110), rng.uniform(30, 90)
            x0 = rng.uniform(xa + 30, max(xa + 31, xb - 30 - w_)); y0 = rng.uniform(y + 30, max(y + 31, y + h - 30 - h_))
            rect(x0 + 8, y0 + 10, x0 + w_ + 8, y0 + h_ + 10, (10, 10, 14, 120))
            c = rng.integers(70, 110)
            rect(x0, y0, x0 + w_, y0 + h_, (c, c, c + 6, 255), outline=(30, 30, 36, 255), width=2)
            if rng.random() < 0.5:   # ventilateur
                r = min(w_, h_) * 0.35
                ell(x0 + w_ / 2 - r, y0 + h_ / 2 - r, x0 + w_ / 2 + r, y0 + h_ / 2 + r, (28, 28, 34, 255), outline=(120, 120, 128, 255))
        if rng.random() < 0.6:   # panneau solaire
            x0 = rng.uniform(xa + 30, xb - 150); y0 = rng.uniform(y + 30, y + max(31, h - 120))
            rect(x0, y0, x0 + 120, y0 + 70, (30, 44, 80, 255), outline=(140, 150, 170, 255), width=2)
            for k in range(1, 4): ligne([(x0 + k * 30, y0), (x0 + k * 30, y0 + 70)], (90, 100, 130, 255), 1)
        # Néon sur la façade côté rue
        n = NEONS[rng.integers(0, len(NEONS))]
        xf = xb - mx if cote < 0 else xa + mx
        l0 = y + rng.uniform(30, h * 0.3); l1 = l0 + rng.uniform(h * 0.3, h * 0.6)
        lum = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        ld = ImageDraw.Draw(lum)
        large = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        gd = ImageDraw.Draw(large)
        for dy in (-H, 0, H):
            ld.rectangle([xf - 5, l0 + dy, xf + 5, l1 + dy], fill=n + (255,))
            ld.rectangle([xf - 2, l0 + dy, xf + 2, l1 + dy], fill=(255, 255, 255, 230))
            gd.rectangle([xf - 40, l0 - 20 + dy, xf + 40, l1 + 20 + dy], fill=n + (150,))
        halo = large.filter(ImageFilter.GaussianBlur(30))
        halos.append((halo, lum))
        y += h
        # ruelle
        if y < H - 100:
            g = rng.choice([0, 0, 60, 90])
            if g:
                rect(xa, y, xb, y + g, (30, 30, 34, 255))
                for _ in range(2):   # poubelles
                    x0 = rng.uniform(xa + 20, xb - 60)
                    rect(x0, y + 10, x0 + 40, y + g - 10, (40, 70, 50, 255), outline=(20, 30, 24, 255), width=2)
                y += g

halos = []
im = im.convert("RGBA"); dr = ImageDraw.Draw(im, "RGBA")
immeubles(-1); immeubles(1)

# --- Lampadaires (repères de vitesse, période 550) avec flaques de lumière
lum = Image.new("RGBA", (W, H), (0, 0, 0, 0)); ld = ImageDraw.Draw(lum)
for y in range(0, H, 550):
    for s, dec in ((-1, 0), (1, 275)):
        xp = cx + s * (demi_route + 0.5 * C); yp_ = (y + dec) % H
        for dy in (-H, 0, H):
            ld.ellipse([xp - 150 - s * 60, yp_ - 140 + dy, xp + 150 - s * 60, yp_ + 140 + dy], fill=(255, 210, 140, 60))
halo_lamp = lum.filter(ImageFilter.GaussianBlur(40))
im = Image.alpha_composite(im, halo_lamp)
for halo, net in halos:
    im = Image.alpha_composite(im, halo)
    im = Image.alpha_composite(im, net)
dr = ImageDraw.Draw(im, "RGBA")
for y in range(0, H, 550):
    for s, dec in ((-1, 0), (1, 275)):
        xp = cx + s * (demi_route + 0.5 * C); yp_ = (y + dec) % H
        ell(xp - 9 + 8, yp_ - 9 + 8, xp + 9 + 8, yp_ + 9 + 8, (10, 10, 14, 140))
        ligne([(xp, yp_), (xp - s * 70, yp_)], (60, 60, 66, 255), 7)                    # bras au-dessus de la route
        ell(xp - 9, yp_ - 9, xp + 9, yp_ + 9, (70, 70, 78, 255), outline=(30, 30, 36, 255))
        ell(xp - s * 70 - 12, yp_ - 7, xp - s * 70 + 12, yp_ + 7, (255, 236, 190, 255))
# Mobilier : bornes, poubelles, sacs sur les trottoirs
for _ in range(16):
    s = rng.choice([-1, 1]); x0 = cx + s * rng.uniform(demi_route + 0.9 * C, trottoir - 25); y0 = rng.uniform(0, H)
    if rng.random() < 0.5:
        ell(x0 - 14, y0 - 14, x0 + 14, y0 + 14, (24, 24, 28, 255), outline=(90, 90, 96, 255))
    else:
        r = rng.uniform(10, 18); ell(x0 - r, y0 - r, x0 + r, y0 + r, (18, 18, 20, 255))

# --- Ambiance : légère teinte froide nocturne et grain
arr = np.asarray(im.convert("RGB")).astype(np.float32)
arr = arr * np.array([0.9, 0.93, 1.05]) + np.array([0, 2, 8])
arr += rng.standard_normal(arr.shape[:2])[..., None] * 3
Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).save("ville.png")
print("ok")

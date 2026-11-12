"""Route Badlands 2 voies, vue du dessus, tuilable verticalement (période H)."""
import numpy as np
from scipy.ndimage import gaussian_filter
from PIL import Image, ImageDraw, ImageFilter
import math, sys

W, H, C = 1600, 2200, 100            # 16 x 22 cases de 100 px (1,5 m)
rng = np.random.default_rng(2075)

def bruit(sigma, amp=1.0):
    n = rng.standard_normal((H, W))
    n = gaussian_filter(n, sigma, mode="wrap")
    n /= (np.abs(n).max() + 1e-9)
    return n * amp

def couleur(base, *couches):
    img = np.zeros((H, W, 3), np.float32) + np.array(base, np.float32)
    for c in couches: img += c[..., None]
    return img

x = np.arange(W)[None, :].repeat(H, 0)
cx = W / 2
demi_route = 3 * C          # 2 voies de 3 cases
bord = demi_route + 0.35 * C  # accotement

# --- Désert : sable ocre poussiéreux, tâches, fissures
sol = couleur((150, 112, 74), bruit(60, 22), bruit(14, 12), bruit(2, 10))
# zones plus claires (sable soufflé) et plus sombres (terre)
plaques = bruit(120, 1.0)
sol += (plaques[..., None] * np.array([18, 14, 8]))

# --- Accotement de gravier
grav = couleur((112, 98, 82), bruit(3, 16), bruit(1, 14), bruit(30, 8))
d = np.abs(x - cx)
m_grav = np.clip((bord + 0.25 * C + bruit(10, 18) - d) / 10, 0, 1)
img = sol * (1 - m_grav[..., None]) + grav * m_grav[..., None]

# --- Asphalte usé
asph = couleur((52, 50, 52), bruit(2, 9), bruit(1, 7), bruit(40, 10), bruit(140, 6))
m_route = np.clip((demi_route + bruit(6, 6) - d) / 3, 0, 1)
img = img * (1 - m_route[..., None]) + asph * m_route[..., None]

# Rapiéçages (asphalte plus sombre) et usure des bandes de roulement
for k in range(9):
    y0 = rng.integers(0, H); x0 = cx + rng.uniform(-demi_route + 40, demi_route - 160)
    w = rng.uniform(80, 220); h = rng.uniform(120, 420)
    yy = (np.arange(H)[:, None] - y0) % H
    m = ((yy < h) & (x >= x0) & (x < x0 + w)).astype(np.float32)
    m = gaussian_filter(m, 6, mode="wrap") * m_route
    img = img * (1 - 0.22 * m[..., None]) + np.array([34, 34, 37]) * 0.22 * m[..., None]
for voie in (-1, 1):
    for roue in (-0.75, 0.75):
        xr = cx + voie * 1.5 * C + roue * C
        m = np.exp(-((x - xr) / 22) ** 2) * m_route
        img -= (m * 7)[..., None]

# cailloux et graviers épars dans le sable
cail = np.zeros((H, W), np.float32)
ys, xs = rng.integers(0, H, 9000), rng.integers(0, W, 9000)
cail[ys, xs] = rng.uniform(-1, 1, 9000)
cail = gaussian_filter(cail, 1.2, mode="wrap") * 160 * (1 - m_route)
img += cail[..., None] * np.array([0.9, 0.8, 0.7])
img = np.clip(img, 0, 255)
im = Image.fromarray(img.astype(np.uint8))
dr = ImageDraw.Draw(im, "RGBA")

def wrap_rect(x0, y0, x1, y1, fill):
    for dy in (-H, 0, H):
        dr.rectangle([x0, y0 + dy, x1, y1 - 1 + dy], fill=fill)

def wrap_ellipse(x0, y0, x1, y1, fill, outline=None):
    for dy in (-H, 0, H):
        dr.ellipse([x0, y0 + dy, x1, y1 + dy], fill=fill, outline=outline)

# --- Marquages : lignes de rive blanches continues, ligne centrale jaune discontinue (période 200 px)
for s in (-1, 1):
    xl = cx + s * (demi_route - 18)
    dr.rectangle([xl - 6, 0, xl + 6, H - 1], fill=(225, 222, 210, 205))
for y in range(0, H, 200):
    wrap_rect(cx - 7, y, cx + 7, y + 110, (232, 186, 40, 215))

# Traces de pneus et taches d'huile
for k in range(6):
    y0 = rng.uniform(0, H); xs = cx + rng.choice([-1, 1]) * 1.5 * C + rng.uniform(-60, 60)
    longueur = rng.uniform(150, 500); courbe = rng.uniform(-40, 40)
    for e in (-0.7, 0.7):
        pts = [(xs + e * C * 0.8 + courbe * math.sin(t / longueur * math.pi), y0 + t) for t in np.linspace(0, longueur, 30)]
        for dy in (-H, 0, H):
            dr.line([(px, py + dy) for px, py in pts], fill=(18, 18, 20, 55), width=10)
for k in range(10):
    y0 = rng.uniform(0, H); x0 = cx + rng.uniform(-demi_route + 60, demi_route - 60); r = rng.uniform(14, 40)
    wrap_ellipse(x0 - r, y0 - r * 0.7, x0 + r, y0 + r * 0.7, (12, 12, 16, 110))

# Fissures dans l'asphalte
for k in range(26):
    px, py = cx + rng.uniform(-demi_route, demi_route), rng.uniform(0, H)
    pts = [(px, py)]
    for _ in range(rng.integers(4, 10)):
        px += rng.uniform(-25, 25); py += rng.uniform(-30, 30); pts.append((px, py))
    for dy in (-H, 0, H):
        dr.line([(a, b + dy) for a, b in pts], fill=(22, 21, 22, 150), width=2)

# --- Bas-côtés : rochers, buissons secs, débris, poteaux réflecteurs (période 400 px)
def rocher(x0, y0, r):
    n = 9
    pts = [(x0 + math.cos(a) * r * rng.uniform(0.7, 1.15), y0 + math.sin(a) * r * rng.uniform(0.7, 1.15)) for a in np.linspace(0, 2 * math.pi, n, endpoint=False)]
    for dy in (-H, 0, H):
        dr.polygon([(a + 10, b + 12 + dy) for a, b in pts], fill=(40, 28, 18, 110))   # ombre
        dr.polygon([(a, b + dy) for a, b in pts], fill=(118, 96, 76, 255))
        dr.polygon([(a - r * 0.25, b - r * 0.25 + dy) for a, b in pts[:5]], fill=(150, 126, 100, 160))

def buisson(x0, y0, r):
    for dy in (-H, 0, H):
        dr.ellipse([x0 - r * 0.8 + 7, y0 - r * 0.8 + 9 + dy, x0 + r * 0.8 + 7, y0 + r * 0.8 + 9 + dy], fill=(50, 34, 20, 70))
    teintes = [(104, 98, 58), (122, 110, 66), (88, 80, 48), (140, 120, 78)]
    for _ in range(22):
        a = rng.uniform(0, 2 * math.pi); l = rng.uniform(0.2, 0.85) * r; t = rng.uniform(r * 0.18, r * 0.32)
        bx, by = x0 + math.cos(a) * l, y0 + math.sin(a) * l
        c = teintes[rng.integers(0, 4)]
        wrap_ellipse(bx - t, by - t, bx + t, by + t, c + (235,))
    for _ in range(10):
        a = rng.uniform(0, 2 * math.pi); l = rng.uniform(0.8, 1.15) * r
        for dy in (-H, 0, H):
            dr.line([(x0, y0 + dy), (x0 + math.cos(a) * l, y0 + math.sin(a) * l + dy)], fill=(84, 64, 40, 200), width=2)

def pneu(x0, y0):
    wrap_ellipse(x0 - 26, y0 - 26, x0 + 26, y0 + 26, (20, 20, 22, 255))
    wrap_ellipse(x0 - 11, y0 - 11, x0 + 11, y0 + 11, (120, 96, 70, 255))

zones = [(40, cx - bord - 40), (cx + bord + 40, W - 40)]
for _ in range(34):
    z = zones[rng.integers(0, 2)]
    rocher(rng.uniform(*z), rng.uniform(0, H), rng.uniform(14, 48))
for _ in range(40):
    z = zones[rng.integers(0, 2)]
    buisson(rng.uniform(*z), rng.uniform(0, H), rng.uniform(16, 34))
for _ in range(4):
    z = zones[rng.integers(0, 2)]
    pneu(rng.uniform(*z), rng.uniform(0, H))
def ferraille(x0, y0):
    w, h = rng.uniform(20, 60), rng.uniform(8, 22); a = rng.uniform(0, math.pi)
    pts = [(-w/2, -h/2), (w/2, -h/2), (w/2, h/2), (-w/2, h/2)]
    pts = [(x0 + px * math.cos(a) - py * math.sin(a), y0 + px * math.sin(a) + py * math.cos(a)) for px, py in pts]
    c = [(120, 62, 34), (92, 88, 84), (140, 80, 40)][rng.integers(0, 3)]
    for dy in (-H, 0, H):
        dr.polygon([(px + 5, py + 6 + dy) for px, py in pts], fill=(40, 28, 18, 100))
        dr.polygon([(px, py + dy) for px, py in pts], fill=c + (255,))
for _ in range(10):
    z = zones[rng.integers(0, 2)]
    ferraille(rng.uniform(*z), rng.uniform(0, H))
# Ligne électrique à gauche : poteaux tous les 550 px (repères de vitesse) et câbles
xp_ligne = 160
for k in range(3):
    xc = xp_ligne - 34 + k * 34
    dr.line([(xc + 26, 0), (xc + 26, H)], fill=(30, 22, 14, 70), width=2)   # ombre des câbles
    dr.line([(xc, 0), (xc, H)], fill=(24, 22, 24, 200), width=2)
for y in range(0, H, 550):
    wrap_rect(xp_ligne - 50 + 30, y - 6 + 34, xp_ligne + 50 + 30, y + 6 + 34, (30, 22, 14, 110))  # ombre traverse
    wrap_rect(xp_ligne - 50, y - 6, xp_ligne + 50, y + 6, (70, 52, 36, 255))
    wrap_ellipse(xp_ligne - 13, y - 13, xp_ligne + 13, y + 13, (58, 42, 28, 255), outline=(30, 22, 14, 255))
for y in range(0, H, 400):
    for s in (-1, 1):
        xp = cx + s * (bord + 0.15 * C)
        wrap_rect(xp - 7, y + 3, xp + 9, y + 21, (30, 22, 14, 120))
        wrap_rect(xp - 8, y, xp + 8, y + 16, (235, 232, 222, 255))
        wrap_rect(xp - 8, y + 2, xp + 8, y + 7, (240, 150, 30, 255))

# --- Vignettage léger sur les côtés pour centrer l'action
arr = np.asarray(im).astype(np.float32)
v = 1 - 0.35 * (np.abs(np.arange(W) - cx) / cx) ** 3
arr *= v[None, :, None]
# grain final
arr += rng.standard_normal(arr.shape[:2])[..., None] * 3
im = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
im.save("route.png")
im.resize((W // 4, H // 4)).save("apercu.png")
print("ok")

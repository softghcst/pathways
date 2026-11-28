# Snaps every pixel of a drawn kid eye to the nearest of the drawing's own few colors (ink, brown, catchlight, white),
# keeping every shape exactly as drawn, so no in-between shades trace as slivers. Usage: snap2.py <in.png> <out.png>
import sys
from collections import Counter
from PIL import Image
im = Image.open(sys.argv[1]).convert('RGBA'); px = im.load(); W, H = im.size
cols = Counter(px[x, y][:3] for x in range(W) for y in range(600, 950) if px[x, y][3] > 200)
def most(pred, default):
    c = [k for k in cols if pred(k)]
    return max(c, key=cols.get) if c else default
INK = most(lambda c: sum(c) < 150, (37, 23, 18))
BROWN = most(lambda c: c[0] > 95 and c[0] - c[2] > 45 and sum(c) < 470, (130, 80, 45))
SHINE = most(lambda c: sum(c) > 600 and c[0] - c[2] > 18, (245, 227, 206))
WHITE = most(lambda c: sum(c) > 720 and c[0] - c[2] <= 18, (255, 255, 255))
PAL = [INK, BROWN, SHINE, WHITE]
print('palette', PAL)
for y in range(H):
    for x in range(W):
        p = px[x, y]
        if p[3] < 30: continue
        # Grey edges of black lines (little color) become ink or white, never brown or catchlight.
        pal = PAL if p[0] - p[2] >= 30 else [INK, WHITE]
        c = min(pal, key=lambda q: sum((q[i] - p[i]) ** 2 for i in range(3)))
        px[x, y] = (*c, 255 if p[3] > 127 else p[3])
im.save(sys.argv[2])

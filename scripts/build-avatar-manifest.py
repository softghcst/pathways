#!/usr/bin/env python3
"""
Builds the avatar parts: unpacks new asset packs, sorts every SVG into its
folder, cleans and normalises each one onto the shared 512x512 portrait
frame, swaps the main colours for CSS variables, and writes the manifest the
game reads (js/avatarManifest.js).

Run it from the repository root whenever parts are added:

    python3 scripts/build-avatar-manifest.py                 # process anything new in assets/avatars/
    python3 scripts/build-avatar-manifest.py packs/new.zip   # unpack a pack first (nested zips too)
    python3 scripts/build-avatar-manifest.py --force         # re-measure everything (only on untouched sources)

Standard library only. A processed file carries data-pathways="1" on its
<svg> element and is skipped on later runs, so running it twice is safe.

How placement works. The artwork arrives on canvases of every size, each
part drawn wherever the artist put it. The script measures what is actually
drawn (from the path coordinates), then fits each kind of part to its place
on one template face: eyes to the eye line, brows above them, outfits to the
shoulders, and so on (LAYOUT below). Hair is fitted by its face opening: the
script scans each hairstyle row by row, finds the gap the face shows
through, and scales and centres the hair so that gap matches the template
face. Coordinates are rewritten into the 512 frame, so no transforms remain.

Colours. Each recolourable part's main colour becomes a CSS variable with
the original as fallback, e.g. style="fill:var(--hair-color,#8f4b29)".
Lighter and darker shades of the same colour become color-mix() of that
variable, so a dye recolours the highlights too. Outlines, whites and
decorations keep their colours.
"""
import colorsys, json, math, os, re, shutil, sys, tempfile, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS_ROOT = os.path.join(ROOT, 'assets')
ASSETS = os.path.join(ASSETS_ROOT, 'avatars')
# Head shapes live on their own in assets/heads/ (shared with the hair-warping pipeline) under clean names.
# Saves store each head by its id, so the ids stay what they were: HEAD_IDS maps file name -> id.
HEADS = os.path.join(ASSETS_ROOT, 'heads')
HEAD_IDS = {'baby': 'head_00_baby', 'toddler': 'head_00_toddler', 'kid': 'head_00_kid',
            'pixie': 'head_11_pixie', 'sculpted': 'head_12_sculpted', 'athletic': 'head_13_athletic', 'almond': 'head_14_almond',
            'cherubic': 'head_15_cherubic', 'angular': 'head_16_angular', 'dimple_oval': 'head_17_dimple_oval'}


def folder_dir(folder):
    """Where a folder's SVGs live on disk: assets/heads/ for heads, assets/avatars/<folder>/ for everything else."""
    return HEADS if folder == 'heads' else os.path.join(ASSETS, folder)


def part_id(folder, stem):
    return HEAD_IDS.get(stem, stem) if folder == 'heads' else stem
MANIFEST = os.path.join(ROOT, 'js', 'avatarManifest.js')
FOLDERS = ['heads', 'eyes', 'eyebrows', 'noses', 'lips', 'hair', 'clothes', 'crowns', 'hats', 'glasses', 'jewelry',
           'makeup', 'aging', 'emotions']

# ---------- 1. Unpacking and sorting ----------

PREFIXES = [  # longest first
    ('accessory', 'jewelry'), ('jewelry', 'jewelry'), ('emotion', 'emotions'),
    ('glasses', 'glasses'), ('outfit', 'clothes'), ('makeup', 'makeup'), ('eyebrow', 'eyebrows'), ('brows', 'eyebrows'),
    ('crown', 'crowns'), ('aging', 'aging'), ('head', 'heads'), ('face', 'heads'), ('hair', 'hair'), ('eyes', 'eyes'),
    ('nose', 'noses'), ('lips', 'lips'), ('hat', 'hats'),
]


def clean_name(name):
    """'eyes_02.svg.svg' -> 'eyes_02.svg'; 'aging_02_crows_feet 2.svg' -> 'aging_02_crows_feet_2.svg'."""
    base = name
    while base.lower().endswith('.svg'):
        base = base[:-4]
    base = re.sub(r'[^a-z0-9]+', '_', base.lower()).strip('_')
    return base + '.svg'


# Artwork that has been withdrawn: never sorted in, even if a pack still contains it.
# Saves that used a withdrawn eye, nose or mouth are moved to the nearest one kept (WITHDRAWN in js/avatar/curation.js).
EXCLUDED = {'eyes_15.svg', 'eyes_02.svg', 'eyes_03.svg', 'eyes_04.svg', 'eyes_05.svg', 'eyes_13.svg', 'eyes_17.svg', 'eyes_21.svg', 'eyes_23.svg',
            'eyes_11.svg', 'eyes_12.svg', 'eyes_24.svg',
            'lips_1.svg', 'lips_2.svg', 'lips_3.svg', 'lips_12.svg', 'lips_13.svg', 'lips_15.svg', 'lips_16.svg', 'lips_19.svg',
            'brows_02.svg', 'brows_03.svg', 'brows_7.svg', 'brows_13.svg', 'brows_17_puppy.svg', 'brows_18_unibrow.svg', 'brows_19_glam_arch.svg',
            'brows_22_skeptical.svg',
            'nose_1.svg', 'nose_2.svg', 'nose_3.svg', 'nose_4.svg', 'nose_5.svg', 'nose_8.svg', 'nose_18.svg', 'nose_22.svg', 'nose_15.svg', 'nose_24.svg',
            'face_01_oval.svg', 'face_02_round.svg', 'face_03_square.svg', 'face_04_heart.svg', 'face_05_diamond.svg', 'face_06_pear.svg'}


def folder_for(name):
    if name in EXCLUDED or name.startswith('hat'):  # hats are withdrawn: only crowns and tiaras are worn on the head
        return None
    if name.startswith('facial_hair'):  # facial hair has been taken out of the game
        return None
    for prefix, folder in PREFIXES:
        if name.startswith(prefix):
            return folder
    return None


def unpack(zips, into):
    """Extracts zips, and zips inside them, into `into`. Returns the zip files it extracted."""
    done = []
    queue = list(zips)
    while queue:
        z = queue.pop()
        with zipfile.ZipFile(z) as f:
            for member in f.namelist():
                if member.startswith('__MACOSX/') or '/._' in member or member.endswith('/'):
                    continue
                target = os.path.realpath(os.path.join(into, member))
                if not target.startswith(os.path.realpath(into) + os.sep):
                    continue  # never write outside the scratch folder
                os.makedirs(os.path.dirname(target), exist_ok=True)
                with f.open(member) as src, open(target, 'wb') as dst:
                    shutil.copyfileobj(src, dst)
                if target.lower().endswith('.zip'):
                    queue.append(target)
        done.append(z)
    return done


def sort_into_folders(search_dirs):
    """Moves every .svg found under search_dirs into its folder (folder_dir) by its filename prefix."""
    moved, skipped = 0, []
    for top in search_dirs:
        for d, _, files in os.walk(top):
            for f in files:
                if not f.lower().endswith('.svg'):
                    continue
                src = os.path.join(d, f)
                name = clean_name(f)
                folder = folder_for(name)
                if not folder:
                    skipped.append(f)
                    continue
                dest_dir = folder_dir(folder)
                if os.path.realpath(d) == os.path.realpath(dest_dir) and name == f:
                    continue
                os.makedirs(dest_dir, exist_ok=True)
                dest = os.path.join(dest_dir, name)
                if os.path.exists(dest) and os.path.realpath(dest) != os.path.realpath(src):
                    stem = name[:-4]
                    n = 2
                    while os.path.exists(os.path.join(dest_dir, f'{stem}_{n}.svg')):
                        n += 1
                    dest = os.path.join(dest_dir, f'{stem}_{n}.svg')
                shutil.move(src, dest)
                moved += 1
    return moved, skipped

# ---------- 2. Reading the artwork ----------

NUM = re.compile(r'-?\d*\.?\d+(?:[eE]-?\d+)?')
TAG = re.compile(r'<(/?)(svg|g|path|rect|circle|ellipse|polygon)\b([^>]*?)(/?)>', re.S)


def attr(attrs, name):
    m = re.search(r'(?:^|\s)' + re.escape(name) + r'="([^"]*)"', attrs)
    return m.group(1) if m else None


def style_prop(attrs, name):
    st = attr(attrs, 'style') or ''
    m = re.search(r'(?:^|;)\s*' + re.escape(name) + r'\s*:\s*([^;]+)', st)
    return m.group(1).strip() if m else None


def parse_path(d):
    """Absolute M/L/H/V/C/S/Q/T/Z only (what the packs use) -> [(cmd, [x, y, ...])]."""
    out = []
    for cmd, args in re.findall(r'([MLHVCSQTZmlhvcsqtz])([^MLHVCSQTZmlhvcsqtz]*)', d):
        nums = [float(n) for n in NUM.findall(args)]
        if cmd.islower() and cmd != 'z':
            raise ValueError('relative path commands are not supported')
        if cmd in 'Zz':
            out.append(('Z', []))
            continue
        size = {'M': 2, 'L': 2, 'T': 2, 'H': 1, 'V': 1, 'C': 6, 'S': 4, 'Q': 4}[cmd]
        for i in range(0, len(nums) - size + 1, size):
            c = cmd
            if cmd == 'M' and i > 0:
                c = 'L'
            out.append((c, nums[i:i + size]))
    # H and V become L so every command is made of x,y pairs.
    x = y = 0.0
    norm = []
    for c, a in out:
        if c == 'H':
            c, a = 'L', [a[0], y]
        elif c == 'V':
            c, a = 'L', [x, a[0]]
        if a:
            x, y = a[-2], a[-1]
        norm.append((c, a))
    return norm


def shape_to_path(tag, attrs):
    f = lambda n, dflt=0.0: float(attr(attrs, n) or dflt)
    if tag == 'rect':
        x, y, w, h = f('x'), f('y'), f('width'), f('height')
        return [('M', [x, y]), ('L', [x + w, y]), ('L', [x + w, y + h]), ('L', [x, y + h]), ('Z', [])]
    if tag in ('circle', 'ellipse'):
        cx, cy = f('cx'), f('cy')
        rx = f('r') if tag == 'circle' else f('rx')
        ry = f('r') if tag == 'circle' else f('ry')
        k = 0.5523
        return [('M', [cx + rx, cy]), ('C', [cx + rx, cy + ry * k, cx + rx * k, cy + ry, cx, cy + ry]),
                ('C', [cx - rx * k, cy + ry, cx - rx, cy + ry * k, cx - rx, cy]),
                ('C', [cx - rx, cy - ry * k, cx - rx * k, cy - ry, cx, cy - ry]),
                ('C', [cx + rx * k, cy - ry, cx + rx, cy - ry * k, cx + rx, cy]), ('Z', [])]
    if tag == 'polygon':
        pts = [float(n) for n in NUM.findall(attr(attrs, 'points') or '')]
        cmds = [('M' if i == 0 else 'L', pts[i:i + 2]) for i in range(0, len(pts) - 1, 2)]
        return cmds + [('Z', [])]
    return []


def read_svg(text):
    """-> (viewBox [x, y, w, h], [element]) with each element's translate already applied."""
    head = re.search(r'<svg\b[^>]*>', text, re.S).group(0)
    vb = [float(n) for n in NUM.findall(attr(head, 'viewBox') or '0 0 512 512')]
    body = re.sub(r'<!--.*?-->', '', text, flags=re.S)
    body = re.sub(r'<(title|desc|metadata|sodipodi:[a-z]+)\b.*?</\1>', '', body, flags=re.S)
    stack = [{'dx': 0.0, 'dy': 0.0, 'fill': None, 'opacity': None, 'rule': None, 'id': None}]
    elements = []
    for m in TAG.finditer(body):
        close, tag, attrs, selfclose = m.groups()
        if tag == 'svg':
            continue
        if tag == 'g':
            if close:
                stack.pop()
                continue
            top = dict(stack[-1])
            t = attr(attrs, 'transform')
            if t:
                tm = re.match(r'\s*translate\(([^)]*)\)\s*$', t)
                if not tm:
                    raise ValueError(f'unsupported transform {t}')
                v = [float(n) for n in NUM.findall(tm.group(1))]
                top['dx'] += v[0]
                top['dy'] += v[1] if len(v) > 1 else 0.0
            top['fill'] = style_prop(attrs, 'fill') or attr(attrs, 'fill') or top['fill']
            top['opacity'] = attr(attrs, 'opacity') or top['opacity']
            top['rule'] = attr(attrs, 'fill-rule') or top['rule']
            top['id'] = attr(attrs, 'id') or top['id']
            if not selfclose:
                stack.append(top)
            continue
        if close:
            continue
        ctx = stack[-1]
        cmds = parse_path(attr(attrs, 'd') or '') if tag == 'path' else shape_to_path(tag, attrs)
        dx, dy = ctx['dx'], ctx['dy']
        t = attr(attrs, 'transform')
        if t:
            tm = re.match(r'\s*translate\(([^)]*)\)\s*$', t)
            if not tm:
                raise ValueError(f'unsupported transform {t}')
            v = [float(n) for n in NUM.findall(tm.group(1))]
            dx += v[0]
            dy += v[1] if len(v) > 1 else 0.0
        cmds = [(c, [a[i] + (dx if i % 2 == 0 else dy) for i in range(len(a))]) for c, a in cmds]
        fill = style_prop(attrs, 'fill') or attr(attrs, 'fill') or ctx['fill'] or '#000000'
        if fill == 'none' or not cmds:
            continue
        elements.append({'cmds': cmds, 'fill': normal_hex(fill), 'opacity': attr(attrs, 'opacity') or attr(attrs, 'fill-opacity') or ctx['opacity'],
                         'rule': attr(attrs, 'fill-rule') or ctx['rule'], 'id': attr(attrs, 'id') or ctx['id'],
                         'layer': attr(attrs, 'data-layer')})
    return vb, elements


def normal_hex(c):
    c = c.strip().lower()
    named = {'white': '#ffffff', 'black': '#000000'}
    c = named.get(c, c)
    if re.fullmatch(r'#[0-9a-f]{3}', c):
        c = '#' + ''.join(ch * 2 for ch in c[1:])
    return c

# ---------- Geometry ----------


def flatten(cmds, steps=6):
    """-> list of polygons (lists of (x, y)) approximating the path."""
    polys, cur = [], []
    x = y = 0.0
    sx = sy = 0.0
    for c, a in cmds:
        if c == 'M':
            if len(cur) > 2:
                polys.append(cur)
            cur = [(a[0], a[1])]
            x, y = a[0], a[1]
            sx, sy = x, y
        elif c in ('L', 'T'):
            cur.append((a[-2], a[-1]))
            x, y = a[-2], a[-1]
        elif c == 'Q' or c == 'S':
            x1, y1, x2, y2 = a
            for i in range(1, steps + 1):
                t = i / steps
                cur.append(((1 - t) ** 2 * x + 2 * (1 - t) * t * x1 + t * t * x2, (1 - t) ** 2 * y + 2 * (1 - t) * t * y1 + t * t * y2))
            x, y = x2, y2
        elif c == 'C':
            x1, y1, x2, y2, x3, y3 = a
            for i in range(1, steps + 1):
                t = i / steps
                u = 1 - t
                cur.append((u ** 3 * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t ** 3 * x3, u ** 3 * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t ** 3 * y3))
            x, y = x3, y3
        elif c == 'Z':
            if len(cur) > 2:
                polys.append(cur)
            cur = [(sx, sy)]
            x, y = sx, sy
    if len(cur) > 2:
        polys.append(cur)
    return polys


def bbox_of(elements):
    xs, ys = [], []
    for e in elements:
        for poly in e.setdefault('polys', flatten(e['cmds'])):
            for px, py in poly:
                xs.append(px)
                ys.append(py)
    if not xs:
        return None
    return [min(xs), min(ys), max(xs), max(ys)]


def area(e):
    total = 0.0
    for poly in e.setdefault('polys', flatten(e['cmds'])):
        s = 0.0
        for i in range(len(poly)):
            x1, y1 = poly[i]
            x2, y2 = poly[(i + 1) % len(poly)]
            s += x1 * y2 - x2 * y1
        total += abs(s) / 2
    return total


def row_spans(elements, y):
    """Filled x-intervals of all elements at height y (even-odd within each element), merged."""
    spans = []
    for e in elements:
        xs = []
        for poly in e.setdefault('polys', flatten(e['cmds'])):
            n = len(poly)
            for i in range(n):
                x1, y1 = poly[i]
                x2, y2 = poly[(i + 1) % n]
                if (y1 <= y < y2) or (y2 <= y < y1):
                    xs.append(x1 + (y - y1) * (x2 - x1) / (y2 - y1))
        xs.sort()
        for i in range(0, len(xs) - 1, 2):
            spans.append((xs[i], xs[i + 1]))
    spans.sort()
    merged = []
    for a, b in spans:
        if merged and a <= merged[-1][1] + 0.5:
            merged[-1][1] = max(merged[-1][1], b)
        else:
            merged.append([a, b])
    return merged


def face_opening(elements, box):
    """
    For a hairstyle: the gap the face shows through. Scans rows from the top,
    finds the central gap between hair on the left and on the right, and takes
    its first widest point (cheekbone level). -> (width, centre_x, y) or None.
    """
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    cx = (x0 + x1) / 2
    rows = []
    for i in range(1, 140):
        y = y0 + h * i / 140
        spans = row_spans(elements, y)
        best = None
        for (a0, a1), (b0, b1) in zip(spans, spans[1:]):
            gap = b0 - a1
            mid = (a1 + b0) / 2
            if gap > w * 0.14 and abs(mid - cx) < w * 0.25 and (best is None or gap > best[0]):
                best = (gap, mid, y)
        rows.append(best)
    widths = [r[0] if r else 0 for r in rows]
    start = next((i for i, r in enumerate(rows) if r), None)
    if start is None:
        return None
    # first local maximum, ignoring small wobbles
    peak = start
    for i in range(start, len(rows)):
        if not rows[i]:
            if i - start > 6:
                break
            continue
        if widths[i] >= widths[peak]:
            peak = i
        elif widths[i] < widths[peak] * 0.9 and i - peak > 3:
            break
    if i - start < 4:
        return None
    return rows[peak]


def fringe_edge(elements, box):
    """The first height, scanning down, at which the hair no longer covers the middle of the face."""
    x0, y0, x1, y1 = box
    cx = (x0 + x1) / 2
    covered = False
    for i in range(1, 120):
        y = y0 + (y1 - y0) * i / 120
        inside = any(a <= cx <= b for a, b in row_spans(elements, y))
        if inside:
            covered = True
        elif covered:
            return y
    return None


def transform_elements(elements, s, tx, ty):
    for e in elements:
        e['cmds'] = [(c, [v * s + (tx if i % 2 == 0 else ty) for i, v in enumerate(a)]) for c, a in e['cmds']]
        e.pop('polys', None)

# ---------- Colour ----------


def rgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) if len(h) == 6 else (0, 0, 0)


def lum(h):
    r, g, b = [c / 255 for c in rgb(h)]
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def hls(h):
    return colorsys.rgb_to_hls(*[c / 255 for c in rgb(h)])


INK = 0.12  # below this (gamma-encoded) luminance a colour is outline ink


def is_white(h):
    return min(rgb(h)) >= 238


def hue_gap(a, b):
    d = abs(hls(a)[0] - hls(b)[0]) * 360
    return min(d, 360 - d)


# What each folder's main colour becomes. clothes: only everyday outfits; uniforms and costumes keep their colours.
RECOLOUR = {'heads': 'skin-color', 'noses': 'skin-color', 'hair': 'hair-color',
            'eyebrows': 'brow-color', 'eyes': 'eye-color', 'lips': 'lip-color', 'makeup': 'blush-color', 'clothes': 'outfit-color'}
FIXED_OUTFITS = re.compile(r'royal|prince|princess|queen|king|duchess|duke|emperor|imperial|noble|admiral|armor|ermine|doublet|jabot|capelet|'
                           r'police|swat|military|firefighter|doctor|prison|grad|chef|tuxedo')


def recolour(folder, name, elements):
    var = RECOLOUR.get(folder)
    if not var or (folder == 'clothes' and FIXED_OUTFITS.search(name)):
        return None
    weights = {}
    for e in elements:
        if e['fill'].startswith('#'):
            weights[e['fill']] = weights.get(e['fill'], 0) + area(e)
    if not weights:
        return None
    darkest = min(weights, key=lum)
    marked = [e['fill'] for e in elements if (e.get('id') or '').startswith(('hair-color', 'hair-fill', 'skin')) or e.get('layer') == 'skin-color']
    hairlike = folder in ('hair', 'eyebrows')
    # Outlines are ink: never recoloured. Hair can itself be nearly black, so there only the darkest of several tones counts as ink.
    # Outlines are never recoloured. In hair and brows the darkest of several tones is the outline, however dark or light it is.
    browns = [c for c in weights if not is_white(c)]
    candidates = {c: w for c, w in weights.items() if not is_white(c) and not ((hairlike and c == darkest and len(browns) > 1) or (not hairlike and lum(c) < INK))}
    if folder == 'eyes':  # irises are drawn in browns; tears and sparkles keep their colours
        candidates = {c: w for c, w in candidates.items() if 5 <= hls(c)[0] * 360 <= 50}
    if folder == 'makeup':  # only blush-like pinks and peaches are recoloured; liner, glitter and freckles keep theirs
        candidates = {c: w for c, w in candidates.items() if (hls(c)[0] * 360 > 330 or hls(c)[0] * 360 < 30) and hls(c)[1] > 0.55}
    if not candidates:
        return None
    main = max(set(marked) & set(candidates), key=lambda c: candidates[c]) if set(marked) & set(candidates) else max(candidates, key=candidates.get)
    lm = max(lum(main), 0.01)
    mapping = {main: f'var(--{var},{main})'}
    for c in candidates:
        if folder == 'hair' and c != main and lum(c) > 0.42 and lum(c) > lm * 1.7 and weights[c] < sum(weights.values()) * 0.1 and 10 <= hls(c)[0] * 360 <= 40:
            mapping[c] = f'var(--skin-color,{c})'  # scalp showing at a parting or hairline
            continue
        if c == main or hue_gap(c, main) > 32 or abs(hls(c)[2] - hls(main)[2]) > 0.45:
            continue
        l = lum(c)
        if l < lm:
            p = max(5, min(95, round(100 * l / lm)))
            mapping[c] = f'color-mix(in srgb,var(--{var},{main}) {p}%,#000)'
            if folder == 'lips' and 'masc' in name:  # the men's mouths: the darker tone is the upper lip, set apart on deep skin
                mapping[c] = f'var(--lip-upper,{mapping[c]})'
        else:
            p = max(5, min(95, round(100 * (1 - l) / max(1 - lm, 0.01))))
            mapping[c] = f'color-mix(in srgb,var(--{var},{main}) {p}%,#fff)'
    for e in elements:
        if e['fill'] in mapping:
            e['paint'] = mapping[e['fill']]
    return main

# ---------- Placement on the template face ----------

# The template, in the 512 frame. Every head is fitted to HEAD; the other
# parts are placed relative to the face inside it.
HEAD = {'top': 150, 'bottom': 512, 'cx': 256}
FACE = {'w': 238, 'top': 154, 'eye_y': 292, 'brow_y': 254, 'nose_y': 327, 'mouth_y': 386, 'chin_y': 424, 'cheek_y': 318,
        'ear_y': 302, 'ear_span': 318, 'neck_y': 442}
# The nose ends well above the mouth: its box stops at 349, and no mouth starts above 366.

# (max width, max height, anchor-x, anchor-y, anchor): the drawing is scaled to fit inside
# the box, keeping its shape; anchor 'center' puts its centre on the point, 'top' its top
# edge, 'bottom' its bottom edge.
LAYOUT = {
    'eyes': (158, 66, 256, FACE['eye_y'], 'center'),
    'eyebrows': (184, 46, 256, FACE['brow_y'], 'center'),
    'noses': (52, 44, 256, FACE['nose_y'], 'center'),
    'lips': (80, 40, 256, FACE['mouth_y'], 'center'),
    'glasses': (226, 100, 256, FACE['eye_y'] + 6, 'center'),
    'clothes': (420, 400, 256, 432, 'top'),
    'hats': (300, 250, 256, 268, 'bottom'),
    'crowns': (176, 150, 256, 176, 'bottom'),
}
# Parts whose place depends on what they are, matched on the filename.
BY_NAME = [
    ('jewelry', r'choker|chain|necklace|pendant', (120, 999, 256, FACE['neck_y'], 'top')),
    ('jewelry', r'lip_ring', (60, 999, 256, FACE['mouth_y'] + 6, 'center')),
    ('jewelry', r'helix', (FACE['ear_span'] + 8, 999, 256, FACE['ear_y'] - 22, 'center')),
    ('jewelry', r'.', (FACE['ear_span'] + 4, 999, 256, FACE['ear_y'] + 22, 'top')),
    ('aging', r'smile', (150, 999, 256, FACE['mouth_y'] - 8, 'center')),
    ('aging', r'crows', (238, 999, 256, FACE['eye_y'], 'center')),
    ('aging', r'forehead', (120, 999, 256, 216, 'center')),
    ('aging', r'eyebag|under_eye', (168, 999, 256, FACE['eye_y'] + 22, 'center')),
    ('emotions', r'sweat', (999, 54, 346, 214, 'center')),
    ('emotions', r'tear', (190, 999, 256, FACE['eye_y'] + 18, 'top')),
    ('emotions', r'vein', (52, 999, 322, 196, 'center')),
    ('emotions', r'heart', (330, 999, 256, 200, 'center')),
    ('makeup', r'blush|contour|highlighter|sunkissed|peach', (214, 999, 256, FACE['cheek_y'] + 18, 'center')),
    ('makeup', r'freckle', (150, 999, 256, FACE['nose_y'] - 6, 'center')),
    ('makeup', r'beauty_mark', (14, 999, 290, FACE['mouth_y'] - 16, 'center')),
    ('makeup', r'egirl|heart', (176, 999, 256, FACE['eye_y'] + 34, 'center')),
    ('makeup', r'.', (190, 999, 256, FACE['eye_y'] - 6, 'center')),
]


def rule_for(folder, name):
    """The placement box for a part: by name if a rule matches, else by folder."""
    for f, pat, rule in BY_NAME:
        if f == folder and re.search(pat, name):
            return rule
    return LAYOUT.get(folder)


EAR = {'left_x': 106, 'right_x': 406, 'lobe_y': 326, 'top_y': 270}


def clip_half(poly, cx, side):
    """The part of a polygon on one side of the vertical line x = cx (side -1: left, 1: right)."""
    keep = lambda q: (q[0] - cx) * side >= 0
    out = []
    for i in range(len(poly)):
        a, b = poly[i], poly[(i + 1) % len(poly)]
        if keep(a):
            out.append(a)
        if keep(a) != keep(b):
            t = (cx - a[0]) / (b[0] - a[0])
            out.append((cx, a[1] + t * (b[1] - a[1])))
    return out


def hang_from_ears(name, elements, box):
    """
    Earrings come as a pair drawn side by side. Each half is kept to a sensible
    size and hung from its own ear: lobes for most, the top of the ear for
    helix studs.
    """
    cx = (box[0] + box[2]) / 2
    # A pair is often one shape holding both earrings: split every shape into its left and right outlines.
    pieces = []
    for e in elements:
        sides = {-1: [], 1: []}
        for sp in subpaths(e['cmds']):
            pts = [a[i] for c, a in sp for i in range(0, len(a), 2)]
            reach = (box[2] - box[0]) * 0.1
            if min(pts) < cx - reach and max(pts) > cx + reach:
                # one outline drawn round both earrings: cut it down the middle
                poly = (flatten(sp, 10) or [[]])[0]
                for side in (-1, 1):
                    half = clip_half(poly, cx, side)
                    if len(half) > 2:
                        sides[side].extend([('M', list(half[0]))] + [('L', list(q)) for q in half[1:]] + [('Z', [])])
                continue
            sides[-1 if (min(pts) + max(pts)) / 2 < cx else 1].extend(sp)
        for cmds in sides.values():
            if cmds:
                pieces.append(dict({k: v for k, v in e.items() if k != 'polys'}, cmds=cmds))
    elements[:] = pieces
    halves = [[e for e in elements if (lambda b: (b[0] + b[2]) / 2 < cx)(bbox_of([e]))],
              [e for e in elements if (lambda b: (b[0] + b[2]) / 2 >= cx)(bbox_of([e]))]]
    halves = [h for h in halves if h]
    helix = 'helix' in name
    for side, half in zip(('left', 'right') if len(halves) == 2 else ('right',), halves):
        x0, y0, x1, y1 = bbox_of(half)
        w, h = x1 - x0, y1 - y0
        s = min(34 / w, 78 / h) if not helix else min(24 / w, 40 / h)
        ax = EAR[f'{side}_x'] + (6 if side == 'left' else -6)
        ay = EAR['top_y'] if helix else EAR['lobe_y']
        transform_elements(half, s, ax - (x0 + w / 2) * s, ay - y0 * s)
    return f'hung from the ears ({len(halves)} piece(s))'


def place(folder, name, elements):
    """Rewrites the elements' coordinates into the 512 frame. -> a note on how it was placed."""
    box = bbox_of(elements)
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    if folder == 'heads':
        s = (HEAD['bottom'] - HEAD['top']) / h
        transform_elements(elements, s, HEAD['cx'] - (x0 + w / 2) * s, HEAD['top'] - y0 * s)
        return 'fitted to the head box'
    if folder == 'hair':
        gap = None if 'baby' in name else face_opening(elements, box)
        if gap:
            gw, gx, gy = gap
            s = FACE['w'] * 1.04 / gw
            # A believable fit leaves the whole style between about one and two faces wide.
            top = FACE['cheek_y'] - 16 - (gy - y0) * s  # where the top of the hair would land
            if FACE['w'] * 0.98 <= w * s <= FACE['w'] * 1.95 and top <= FACE['top'] + 6:
                # the widest point of the opening sits at cheekbone level
                transform_elements(elements, s, 256 - gx * s, FACE['cheek_y'] - 16 - gy * s)
                return f'fitted by its face opening ({gw:.0f} wide)'
        spread = 0.86 if 'baby' in name else 1.75 if re.search(r'long|medium', name) else 1.45 if 'updo' in name else 1.38
        s = FACE['w'] * spread / w
        ty = FACE['top'] - (20 if 'baby' in name else 22) - y0 * s
        # A heavy fringe must not cover the eyes: find where the hair stops covering the middle of
        # the face and, if that falls below the brows, lift the whole style until it does not.
        hairline = fringe_edge(elements, box)
        lifted = ''
        if hairline is not None and 'baby' not in name and hairline * s + ty > FACE['brow_y'] - 20:
            ty = FACE['brow_y'] - 20 - hairline * s
            lifted = ', lifted clear of the eyes'
        transform_elements(elements, s, 256 - (x0 + w / 2) * s, ty)
        return 'no face opening found: fitted to the crown of the head' + lifted
    if folder == 'jewelry' and not re.search(r'choker|chain|necklace|pendant|lip_ring', name):
        return hang_from_ears(name, elements, box)
    rule = rule_for(folder, name)
    if not rule:
        return 'left as drawn'
    bw, bh, ax, ay, anchor = rule
    s = min(bw / w, bh / h)
    ty = ay - (y0 + h / 2) * s if anchor == 'center' else ay - y0 * s if anchor == 'top' else ay - y1 * s
    transform_elements(elements, s, ax - (x0 + w / 2) * s, ty)
    return f'fitted inside {bw}x{bh} at ({ax}, {ay})'

# ---------- Eye whites ----------


def inside(pt, poly):
    x, y = pt
    hit = False
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        if (y1 > y) != (y2 > y) and x < x1 + (y - y1) * (x2 - x1) / (y2 - y1):
            hit = not hit
    return hit


def subpaths(cmds):
    out, cur = [], []
    for c in cmds:
        if c[0] == 'M' and cur:
            out.append(cur)
            cur = []
        cur.append(c)
    if cur:
        out.append(cur)
    return out


def poly_area(poly):
    return abs(sum(poly[i][0] * poly[(i + 1) % len(poly)][1] - poly[(i + 1) % len(poly)][0] * poly[i][1] for i in range(len(poly)))) / 2


def add_eye_whites(elements):
    """
    Some eyes are drawn as an outline with nothing inside, so skin shows where
    the white of the eye should be. The opening is a hole in the outline: this
    fills each such hole with white, underneath everything else. Eyes that
    already have whites, closed eyes and dot eyes are left alone.
    """
    box = bbox_of(elements)
    total = (box[2] - box[0]) * (box[3] - box[1])
    if sum(area(e) for e in elements if is_white(e['fill'])) > total * 0.035:
        return 0
    iris = [bbox_of([e]) for e in elements if e.get('paint') or (not is_white(e['fill']) and lum(e['fill']) >= INK)]
    holes = []
    for e in elements:
        if lum(e['fill']) >= INK:
            continue
        subs = [(sp, flatten(sp)) for sp in subpaths(e['cmds'])]
        subs = [(sp, pl[0]) for sp, pl in subs if pl]
        for sp, poly in subs:
            if poly_area(poly) < total * 0.005:
                continue
            # a hole: its outline lies inside another outline of the same shape
            if not any(other is not poly and inside(poly[0], other) for _, other in subs):
                continue
            xs = [q[0] for q in poly]
            ys = [q[1] for q in poly]
            hb = (min(xs), min(ys), max(xs), max(ys))
            if iris:
                # the opening sits at the level of the iris; a lid crease above it does not
                level = any(hb[1] <= (b[1] + b[3]) / 2 <= hb[3] or b[1] <= (hb[1] + hb[3]) / 2 <= b[3] for b in iris)
                if not level:
                    continue
            holes.append(sp)
    if not holes:
        return 0
    elements.insert(0, {'cmds': [c for sp in holes for c in sp], 'fill': '#ffffff', 'opacity': None, 'rule': 'nonzero', 'id': 'white', 'layer': None})
    return len(holes)

def scale_about(e, cx, cy, k):
    e['cmds'] = [(c, [(cx + (v - cx) * k) if i % 2 == 0 else (cy + (v - cy) * k) for i, v in enumerate(a)]) for c, a in e['cmds']]
    e.pop('polys', None)


def open_up_eyes(elements):
    """
    Some eyes are all iris: a big round iris (or a solid dark oval) with no
    white showing. For each such eye the ball keeps its outline, a white
    eyeball is laid over where it was, and the iris, pupil and highlights are
    drawn smaller inside it. Eyes that already show white are left alone.
    """
    box = bbox_of(elements)
    total = (box[2] - box[0]) * (box[3] - box[1])
    mid = (box[0] + box[2]) / 2
    def round_ball(e):
        b = bbox_of([e])
        w, h = b[2] - b[0], b[3] - b[1]
        return h > 0 and 0.55 <= w / h <= 1.7 and area(e) >= total * 0.01 and area(e) >= w * h * 0.4
    def within(inner, outer, slack=0.12):
        w, h = outer[2] - outer[0], outer[3] - outer[1]
        return inner[0] >= outer[0] - w * slack and inner[2] <= outer[2] + w * slack and inner[1] >= outer[1] - h * slack and inner[3] <= outer[3] + h * slack
    # every separate white shape, with its own outline box and size
    whites = []
    for e in elements:
        if is_white(e['fill']):
            for sp in subpaths(e['cmds']):
                pl = flatten(sp)
                if pl and poly_area(pl[0]) > total * 0.003:
                    xs, ys = [q[0] for q in pl[0]], [q[1] for q in pl[0]]
                    whites.append(((min(xs), min(ys), max(xs), max(ys)), poly_area(pl[0])))
    overlaps = lambda a, b: a[0] < b[2] and a[2] > b[0] and a[1] < b[3] and a[3] > b[1]
    coloured = [e for e in elements if not is_white(e['fill']) and (e.get('paint') or lum(e['fill']) >= INK) and round_ball(e)]
    inky = [e for e in elements if not is_white(e['fill']) and not e.get('paint') and lum(e['fill']) < INK and round_ball(e)]
    done = 0
    for side in (-1, 1):
        on_side = lambda e: ((bbox_of([e])[0] + bbox_of([e])[2]) / 2 - mid) * side > 0
        pool = [e for e in coloured if on_side(e)] or [e for e in inky if on_side(e)]
        if not pool:
            continue
        ball = max(pool, key=area)
        bb = bbox_of([ball])
        if ball in inky:
            # a solid dark eye that already has a large white inside it is a finished eye
            if sum(a for w, a in whites if within(w, bb, 0.02)) >= area(ball) * 0.15:
                continue
        else:
            # an iris drawn in several pieces counts as one
            group = [e for e in elements if e is not ball and not is_white(e['fill']) and (e.get('paint') or lum(e['fill']) >= INK) and on_side(e) and overlaps(bbox_of([e]), bb)]
            bb = bbox_of([ball] + group)
        # white already showing beside this iris: nothing to do
        if any(overlaps(w, bb) and not within(w, bb, 0.1) for w, _ in whites):
            continue
        cx, cy = (bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2
        inner = [e for e in elements if e is not ball and within(bbox_of([e]), bb) and area(e) < area(ball) * 1.01]
        i = elements.index(ball)
        white = {'cmds': [(c, list(a)) for c, a in ball['cmds']], 'fill': '#ffffff', 'opacity': None, 'rule': ball.get('rule'), 'id': 'white', 'layer': None}
        if ball in inky:
            # a solid dark eye: keep it as the outline, white inside it, and a smaller dark centre
            centre = dict(ball, cmds=[(c, list(a)) for c, a in ball['cmds']])
            centre.pop('polys', None)
            w, h = bb[2] - bb[0], bb[3] - bb[1]
            if area(ball) < w * h * 0.6:
                # an eye with lashes drawn into the same shape: plain ovals read better than a copy of the lashes
                white['cmds'] = shape_to_path('ellipse', f'cx="{cx}" cy="{cy}" rx="{w * 0.33}" ry="{h * 0.37}"')
                centre['cmds'] = shape_to_path('ellipse', f'cx="{cx}" cy="{cy}" rx="{w * 0.2}" ry="{h * 0.24}"')
                white['rule'] = centre['rule'] = None
            else:
                scale_about(white, cx, cy, 0.84)
                scale_about(centre, cx, cy, 0.56)
            elements[i + 1:i + 1] = [white, centre]
            for e in inner:
                scale_about(e, cx, cy, 0.56)
        else:
            elements.insert(i, white)
            for e in [ball] + inner:
                scale_about(e, cx, cy, 0.66)
        done += 1
    return done

# ---------- Measuring a head ----------


def measure_head(elements):
    """
    Where things go on this particular head, measured from its skin shape:
    the top of the head, the face's width above the ears, the ears, the chin
    (where the jaw meets the neck) and the shoulders. The renderer uses these
    to move every part from the template face onto this head.
    """
    skins = [e for e in elements if str(e['fill']).startswith('var(--skin-color')]
    skin = max(skins or elements, key=area)
    rows = {}
    for y in range(140, 512, 2):
        spans = row_spans([skin], y + 0.5)
        if spans:
            rows[y] = (spans[0][0], spans[-1][1])  # edge to edge: lines drawn inside the shape do not count
    ys = sorted(rows)
    wid = lambda y: rows[y][1] - rows[y][0]
    top = ys[0]
    ear_top = next((y for y in ys if y > top + 40 and y - 6 in rows and wid(y) - wid(y - 6) > 16), None)
    above = [y for y in ys if y < (ear_top or top + 150)]
    face_w = max(wid(y) for y in above)
    band = [y for y in ys if ear_top and y >= ear_top - 6 and wid(y) > face_w + 10]
    band = [y for y in band if y - band[0] < 76]
    if band:
        widest = max(band, key=wid)
        ear_l, ear_r = rows[widest]
        ear_bottom = band[-1]
    else:
        widest = top + int((ys[-1] - top) * 0.45)
        ear_l, ear_r = rows[min(ys, key=lambda y: abs(y - widest))]
        ear_bottom = widest + 20
    centre = [(rows[y][0] + rows[y][1]) / 2 for y in above if y > top + 16]
    cx = sum(centre) / len(centre)
    below = [y for y in ys if ear_bottom + 10 < y < 500]
    neck = min(below, key=wid)
    shoulder = max(wid(y) for y in ys if y >= 490)
    r = lambda v: round(v, 1)
    return {'cx': r(cx), 'top': top, 'chin': neck - 4, 'w': r(face_w), 'earL': r(ear_l), 'earR': r(ear_r), 'earTop': band[0] if band else widest - 20,
            'lobe': ear_bottom - 8, 'neck': neck, 'neckW': r(wid(neck)), 'shoulderW': r(shoulder)}

# ---------- Measuring how hair meets a head ----------
#
# The renderer fits each hairstyle to each head from these (js/avatar/hairFit.js). Both are sampled on the
# same rows and columns of the 512 frame.
PROFILE_ROWS = (150, 6, 43)   # first row, step, how many
PROFILE_COLS = (128, 8, 33)   # first column, step, how many
FRAME_TOP = -22               # the top of the picture the game shows (CharacterAvatar's viewBox)


def col_spans(elements, x):
    """Filled y-intervals of all elements along the column x, merged (row_spans, turned on its side)."""
    spans = []
    for e in elements:
        ys = []
        for poly in e.setdefault('polys', flatten(e['cmds'])):
            n = len(poly)
            for i in range(n):
                x1, y1 = poly[i]
                x2, y2 = poly[(i + 1) % n]
                if (x1 <= x < x2) or (x2 <= x < x1):
                    ys.append(y1 + (x - x1) * (y2 - y1) / (x2 - x1))
        ys.sort()
        for i in range(0, len(ys) - 1, 2):
            spans.append((ys[i], ys[i + 1]))
    spans.sort()
    merged = []
    for a, b in spans:
        if merged and a <= merged[-1][1] + 0.5:
            merged[-1][1] = max(merged[-1][1], b)
        else:
            merged.append([a, b])
    return merged


def measure_hair_edge(elements):
    """
    Where a hairstyle meets the face. Row by row: the inner edges of the hair either side of the
    opening the face shows through (None: no hair on that side; both 256: the hair covers the middle
    of the face). Column by column: the hairline (T), where the hair that starts above the forehead
    ends, and the outline of the crown (O), where it begins.
    """
    r0, rs, rn = PROFILE_ROWS
    c0, cs, cn = PROFILE_COLS
    left, right = [], []
    for i in range(rn):
        spans = row_spans(elements, r0 + i * rs + 0.5)
        edges = [-1e9] + [v for sp in spans for v in sp] + [1e9]
        gaps = [(edges[k], edges[k + 1]) for k in range(0, len(edges), 2)]
        a, b = max(gaps, key=lambda g: min(g[1], 316) - max(g[0], 196))
        if min(b, 316) - max(a, 196) < 30:
            left.append(256)
            right.append(256)
        else:
            left.append(None if a < -1e8 else round(a))
            right.append(None if b > 1e8 else round(b))
    line, crown = [], []
    for j in range(cn):
        upper = [sp for sp in col_spans(elements, c0 + j * cs + 0.5) if sp[0] < 205]
        line.append(round(max(sp[1] for sp in upper)) if upper else None)
        crown.append(round(upper[0][0]) if upper else None)
    return {'top': round(bbox_of(elements)[1]), 'L': left, 'R': right, 'T': line, 'O': crown}


def measure_head_edge(elements):
    """The outline of a head's skin: its left and right edges row by row, and the top of the skull column by column."""
    skins = [e for e in elements if str(e['fill']).startswith('var(--skin-color')]
    skin = max(skins or elements, key=area)
    r0, rs, rn = PROFILE_ROWS
    c0, cs, cn = PROFILE_COLS
    left, right, top = [], [], []
    for i in range(rn):
        spans = row_spans([skin], r0 + i * rs + 0.5)
        left.append(round(spans[0][0]) if spans else None)
        right.append(round(spans[-1][1]) if spans else None)
    for j in range(cn):
        spans = col_spans([skin], c0 + j * cs + 0.5)
        top.append(round(spans[0][0]) if spans else None)
    return {'L': left, 'R': right, 'T': top}


FEATURE_STEP = 2  # how far apart the measured rows of an eye or nose are


def measure_feature(elements, folder):
    """
    The outline of a pair of eyes, a nose or a mouth, row by row, so the game can tell how close they come
    to each other (js/avatar/featureFit.js). For eyes: how far the nearest ink is from the centre line
    (`inner`). For a nose or a mouth: how far its lines reach from the centre line (`ink`), and how far
    anything it draws does, a nose's patch of skin included (`all`). Rows start at `y` and are FEATURE_STEP
    apart; `bottom` is where the drawing ends, and a mouth also has its `width`.
    """
    box = bbox_of(elements)
    lines = [e for e in elements if not str(e['fill']).startswith('var(--skin-color')]
    y0 = int(math.floor(box[1]))
    inner, ink, whole = [], [], []
    y = y0
    while y <= box[3]:
        spans = row_spans(elements, y + 0.5)
        if folder == 'eyes':
            crosses = any(a <= 256 <= b for a, b in spans)
            inner.append(0 if crosses else round(min(abs(v - 256) for sp in spans for v in sp), 1) if spans else None)
        else:
            reach = lambda sp: round(max(256 - sp[0][0], sp[-1][1] - 256), 1) if sp else None
            ink.append(reach(row_spans(lines, y + 0.5)))
            whole.append(reach(spans))
        y += FEATURE_STEP
    shape = {'y': y0, 'bottom': round(box[3], 1)}
    if folder == 'lips':
        shape['width'] = round(box[2] - box[0], 1)
    shape.update({'inner': inner} if folder == 'eyes' else {'ink': ink, 'all': whole})
    return shape


# ---------- Repairs to hairstyles that were placed badly ----------
#
# The placement above works from each drawing's face opening, and a few styles defeat it. Where the
# renderer's own fitting (js/avatar/hairFit.js) cannot bring a style onto the head within its limits,
# the file itself is moved here, once: (x scale, y scale, shift right, shift down), about the top of
# the template face. A repaired file carries data-refit="1" and is never moved twice.
REFIT = {
    # An arch of braids drawn for a much taller forehead: the opening reached 100 units above the skull,
    # so the background showed through it. Lowered until the arch sits on the crown, the beads at the jaw.
    'hair_boy_medium_11': (1.0, 0.85, 0, 94),
    # Cornrows on one side, drawn far wider than the head: the shaved side hung in the air beside the
    # face. Brought in until the cornrows lie on the scalp.
    'hair_girl_long_11': (0.75, 0.75, -13, 0),
}


# Mouths drawn as an outline whose inside should be teeth: the inside is filled white, behind the lines, once.
TEETH = {
    'lips_21': 'a sideways smile showing its teeth; the teeth were left as a hole, so the skin showed through',
}


def fill_teeth():
    """Applies TEETH to any listed file that has not had it. -> the names filled."""
    done = []
    for name in TEETH:
        path = os.path.join(ASSETS, 'lips', name + '.svg')
        if not os.path.exists(path):
            continue
        text = open(path, encoding='utf-8').read()
        if 'data-teeth="1"' in text or 'data-pathways="1"' not in text:
            continue
        m = re.search(r' d="([^"]*)"', text)
        subs, cur = [], []
        for c, a in parse_path(m.group(1)) + [('M', [])]:
            if c == 'M' and cur:
                subs.append(cur)
                cur = []
            if a or c == 'Z':
                cur.append((c, a))
        if len(subs) < 2:
            continue
        # The outline's inner edge is the opening of the mouth: the biggest shape inside the outer one.
        inner = max(subs[1:], key=lambda sp: abs(poly_area(flatten(sp)[0])) if flatten(sp) else 0)
        white = f'<path style="fill:#ffffff" d="{path_d(inner)}"/>'
        text = text.replace('<g id="art">', '<g id="art">' + white, 1).replace('data-pathways="1"', 'data-pathways="1" data-teeth="1"', 1)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(text)
        done.append(name)
    return done


# Mouths drawn with a much heavier outline than the rest, in a redder ink: (skin, lips, ink). The outside of the
# outline is trimmed by drawing its edge again in the skin's color (`skin`, frame units, half of it falling on the
# outline); the line between the lips by edging the lips in their own color (`lips`, the same); and the outline is
# drawn in the ink the other mouths use. A trimmed file records what was done (data-thinned="skin/lips"); if the
# numbers here change, or the file was trimmed some other way, that is undone and it is trimmed again.
THIN_OUTLINE = {'lips_4': (3.0, 1.4, '#230601')}


def thin_outline():
    """Applies THIN_OUTLINE to any listed file that has not had it. -> the names thinned."""
    done = []
    for name, (skin, lips, ink) in THIN_OUTLINE.items():
        path = os.path.join(ASSETS, 'lips', name + '.svg')
        if not os.path.exists(path):
            continue
        text = open(path, encoding='utf-8').read()
        mark = f'data-thinned="{fmt(skin)}/{fmt(lips)}"'
        if mark in text or 'data-pathways="1"' not in text:
            continue
        # Undo earlier attempts.
        text = re.sub(r';stroke:(var\(--lip-upper,)?var\(--lip-color,#[0-9a-f]+\)\)?;stroke-width:[\d.]+;stroke-linejoin:round"', '"', text)
        text = re.sub(r'<path style="fill:none;stroke:var\(--skin-color[^"]*" d="[^"]*"/>', '', text)
        text = re.sub(r' data-thinned="[^"]*"', '', text)
        m = re.search(r'<path style="fill:(#[0-9a-f]{6});stroke:var\(--line-ink[^"]*"( fill-rule="[^"]*")? d="([^"]*)"/>', text)
        if not m:
            continue
        outline = m.group(0).replace(f'fill:{m.group(1)}', f'fill:{ink}', 1)
        trim = f'<path style="fill:none;stroke:var(--skin-color,#e8b68c);stroke-width:{fmt(skin)};stroke-linejoin:round" d="{m.group(3)}"/>'
        text = text[:m.start()] + outline + trim + text[m.end():]
        text = re.sub(r'style="fill:(var\(--lip-color,#[0-9a-f]+\))"',
                      lambda q: f'style="fill:{q.group(1)};stroke:{q.group(1)};stroke-width:{fmt(lips)};stroke-linejoin:round"', text)
        text = text.replace('data-pathways="1"', f'data-pathways="1" {mark}', 1)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(text)
        done.append(name)
    return done


def split_lip_tones():
    """
    The upper and lower lips of most mouths are drawn as two shapes in one path, so they could only ever take one
    color. This parts them, wherever the two are clearly one above the other: the upper lip is given its own color,
    var(--lip-upper), falling back to the mouth's color, so a mouth looks exactly as before unless the portrait sets
    one (natural lips on men: NATURAL_LIPS in js/avatar/catalog.js). Lipstick, teeth, tongues and the inside of a
    mouth are never touched: only shapes in the lip color are, and only a pair that is clearly upper and lower.
    The men's mouths already draw their upper lip in --lip-upper. A parted file carries data-lip-tones="1".
    -> the names parted.
    """
    done = []
    folder = os.path.join(ASSETS, 'lips')
    lip = re.compile(r'<path style="fill:(var\(--lip-color,#[0-9a-f]+\))([^"]*)"( fill-rule="[^"]*")? d="([^"]*)"/>')
    for f in sorted(os.listdir(folder)):
        if not f.endswith('.svg') or f.startswith('lips_masc'):
            continue
        path = os.path.join(folder, f)
        text = open(path, encoding='utf-8').read()
        if 'data-lip-tones="1"' in text or 'data-pathways="1"' not in text:
            continue
        found = list(lip.finditer(text))
        shapes = []  # (the path it is in, its commands)
        for m in found:
            cur = []
            for c, a in parse_path(m.group(4)) + [('M', [])]:
                if c == 'M' and cur:
                    shapes.append((m, cur))
                    cur = []
                if a or c == 'Z':
                    cur.append((c, a))
        if len(shapes) != 2:
            continue
        boxes = [bbox_of([{'cmds': sp, 'fill': ''}]) for _, sp in shapes]
        # One above the other, side by side across much the same width, and neither inside the other (as the inner
        # and outer edges of an open mouth's lips are): a smile's lower lip may curve up past the upper's bottom edge.
        across = min(boxes[0][2], boxes[1][2]) - max(boxes[0][0], boxes[1][0])
        inside = lambda a, b: a[0] >= b[0] - 1 and a[2] <= b[2] + 1 and a[1] >= b[1] - 1 and a[3] <= b[3] + 1
        centres = [(bx[1] + bx[3]) / 2 for bx in boxes]
        if across < 0.6 * max(bx[2] - bx[0] for bx in boxes) or inside(boxes[0], boxes[1]) or inside(boxes[1], boxes[0]) \
                or abs(centres[0] - centres[1]) < 4:
            continue
        upper = 0 if boxes[0][1] + boxes[0][3] < boxes[1][1] + boxes[1][3] else 1
        up = f'var(--lip-upper,{found[0].group(1)})'

        def paint(i, color):
            m = shapes[i][0]
            return f'<path style="fill:{color}{m.group(2).replace(m.group(1), color)}"{m.group(3) or ""} d="{path_d(shapes[i][1])}"/>'
        if len(found) == 1:
            m = found[0]
            text = text[:m.start()] + paint(1 - upper, m.group(1)) + paint(upper, up) + text[m.end():]
        else:
            m = shapes[upper][0]
            text = text[:m.start()] + paint(upper, up) + text[m.end():]
        text = text.replace('data-pathways="1"', 'data-pathways="1" data-lip-tones="1"', 1)
        with open(path, 'w', encoding='utf-8') as out:
            out.write(text)
        done.append(f[:-4])
    return done


def weigh_lines(folder='noses', recolor=True):
    """
    Lets the renderer thicken a part's dark lines without touching anything else in it: each ink path
    (not the skin-coloured shape) gets a stroke that is off unless --line-width is set on the portrait.
    The renderer sets it on deeper skin tones, where dark lines on dark skin are hard to see. Once per file.
    With recolor, --line-ink also recolours the lines themselves (noses); without, only the added stroke uses it.
    -> the names changed
    """
    done = []
    d = folder_dir(folder)
    for f in sorted(os.listdir(d)) if os.path.isdir(d) else []:
        path = os.path.join(d, f)
        text = open(path, encoding='utf-8').read()
        if not f.endswith('.svg') or 'data-lines="1"' in text or 'data-pathways="1"' not in text:
            continue
        ink = ';stroke:var(--line-ink,currentColor);stroke-width:var(--line-width,0);stroke-linejoin:round'
        fill = (lambda h: f'var(--line-ink,{h})') if recolor else (lambda h: h)
        dark = sorted({h for h in re.findall(r'style="fill:(#[0-9a-fA-F]{6})"', text) if lum(h) < INK}, key=lum)
        # Eyes and lips: only the darkest shade is the outline. A second dark shade is a filled area (a shaded iris)
        # that a stroke would blot.
        lines = set(dark) if recolor else set(dark[:1])
        text = re.sub(r'style="fill:(#[0-9a-fA-F]{6})"', lambda m: f'style="fill:{fill(m.group(1))}{ink}"' if m.group(1) in lines else m.group(0), text)
        text = text.replace('data-pathways="1"', 'data-pathways="1" data-lines="1"', 1)
        with open(path, 'w', encoding='utf-8') as out:
            out.write(text)
        done.append(f[:-4])
    return done


# Eyes whose lid crease is drawn as a separate thin line floating above the eye, in the same ink as the eye's outline,
# so that it reads as a second, thinner eyebrow. Each crease is parted from the eye's own shapes into a path of its own,
# so that it can take a soft shade of the skin instead of the ink (--crease-color, set by the portrait), and is moved
# down toward the lid by the amount here (frame units) so it clears the brow above it. The amounts were worked out from
# the outlines: each crease keeps at least 4 units clear of the eye below it, and a typical brow's gap to it is made
# up to about 10 where there is room for that. A softened file's crease carries data-crease="<units lowered>", so a
# changed amount here moves it by the difference, and nothing is moved twice.
# None: the eye already has a fold line close under the lashes, so its floating crease is taken out altogether instead
# (eyes_25 had two). That fold was part of the eye's outline; it was cut out of it once, with polygon geometry, and
# drawn in the soft crease shade (its paths carry data-crease="0"), so this step leaves the file alone.
CREASES = {'eyes_18': 6, 'eyes_19': 6, 'eyes_20': 6, 'eyes_22': 7, 'eyes_25': None, 'eyes_26': 1, 'eyes_9': 2, 'eyes_8': 0, 'eyes_7': 0}
CREASE_SOFT = 'color-mix(in srgb,var(--skin-color,#e8b68c) 50%,#2d180e)'
CREASE_PATH = re.compile(r'<path data-crease="([\d.]+)" style="([^"]*)" d="([^"]*)"/>')
ANY_PATH = re.compile(r'<path style="([^"]*)"([^>]*?) d="([^"]*)"/>')
INK_PATH = re.compile(r'<path style="(fill:#[0-9a-fA-F]{6};stroke:var\(--line-ink[^"]*)"([^>]*?) d="([^"]*)"/>')


def shift_down(cmds, dy):
    return [(c, [v + dy if i % 2 else v for i, v in enumerate(a)]) for c, a in cmds]


def subpaths_of(d):
    subs, cur = [], []
    for c, a in parse_path(d) + [('M', [])]:
        if c == 'M' and cur:
            subs.append(cur)
            cur = []
        if a or c == 'Z':
            cur.append((c, a))
    return subs


def soften_creases():
    """Applies CREASES to every listed eye file. -> {name: units lowered} for the files changed."""
    done = {}
    for name, drop in CREASES.items():
        path = os.path.join(ASSETS, 'eyes', name + '.svg')
        if not os.path.exists(path):
            continue
        text = open(path, encoding='utf-8').read()
        if 'data-pathways="1"' not in text or 'data-crease-removed="1"' in text:
            continue
        if drop is None and CREASE_PATH.search(text):
            continue  # (a softened crease is only ever taken out from the original file)
        if CREASE_PATH.search(text):  # already parted: move it by the difference
            if all(abs(float(m.group(1)) - drop) < 1e-9 for m in CREASE_PATH.finditer(text)):
                continue
            text = CREASE_PATH.sub(lambda m: f'<path data-crease="{fmt(drop)}" style="{m.group(2)}" d="{path_d(shift_down(parse_path(m.group(3)), drop - float(m.group(1))))}"/>', text)
            open(path, 'w', encoding='utf-8').write(text)
            done[name] = drop
            continue
        found = []  # the topmost thin ink line in each half: (top, match, its subpath number, the match's subpaths)
        for in_half in (lambda x0, x1: x1 < 256, lambda x0, x1: x0 > 256):
            best = None
            for m in INK_PATH.finditer(text):
                subs = subpaths_of(m.group(3))
                for si, sp in enumerate(subs):
                    bx = bbox_of([{'cmds': sp, 'fill': ''}])
                    if not bx or not in_half(bx[0], bx[2]):
                        continue
                    h, w = bx[3] - bx[1], bx[2] - bx[0]
                    # Thin, wide and with some body: not a lash tick, and not the eye's own outline.
                    if 8 <= h <= 20 and w >= 25 and area({'cmds': sp, 'fill': ''}) >= 60 and (best is None or bx[1] < best[0]):
                        best = (bx[1], m, si, subs)
            if best:
                found.append(best)
        if len(found) != 2:
            continue
        # Specks of a second shade drawn right on a crease (invisible while the crease was as dark as they are) go with it.
        boxes = [bbox_of([{'cmds': f[3][f[2]], 'fill': ''}]) for f in found]
        inside = lambda bx: any(bx[0] >= c[0] - 1 and bx[2] <= c[2] + 1 and bx[1] >= c[1] - 1 and bx[3] <= c[3] + 1 for c in boxes)
        # Take the creases (and those specks) out of their paths, working back to front so earlier positions hold.
        for m in reversed(list(ANY_PATH.finditer(text))):
            subs = subpaths_of(m.group(3))
            mine = [f for f in found if f[1].start() == m.start()]
            out = {f[2] for f in mine}
            for k, sp in enumerate(subs):
                bx = bbox_of([{'cmds': sp, 'fill': ''}])
                if k not in out and bx and area({'cmds': sp, 'fill': ''}) < 30 and inside(bx):
                    out.add(k)
            if not out:
                continue
            rest = [cmd for k, sp in enumerate(subs) if k not in out for cmd in sp]
            soft = f'fill:var(--crease-color,{CREASE_SOFT});stroke:var(--crease-color,{CREASE_SOFT});stroke-width:var(--line-width,0);stroke-linejoin:round'
            creases = '' if drop is None else ''.join(f'<path data-crease="{fmt(drop)}" style="{soft}" d="{path_d(shift_down(subs[f[2]], drop))}"/>' for f in sorted(mine, key=lambda f: f[2]))
            kept = f'<path style="{m.group(1)}"{m.group(2)} d="{path_d(rest)}"/>' if rest else ''
            text = text[:m.start()] + kept + creases + text[m.end():]
        if drop is None:
            text = text.replace('data-pathways="1"', 'data-pathways="1" data-crease-removed="1"', 1)
        open(path, 'w', encoding='utf-8').write(text)
        done[name] = drop
    return done


def refit_hair():
    """Applies REFIT to any listed file that has not had it. -> the names repaired."""
    done = []
    for name, (sx, sy, dx, dy) in REFIT.items():
        path = os.path.join(ASSETS, 'hair', name + '.svg')
        if not os.path.exists(path):
            continue
        text = open(path, encoding='utf-8').read()
        if 'data-refit="1"' in text or 'data-pathways="1"' not in text:
            continue

        def move(m):
            cmds = [(c, [(256 + sx * (v - 256) + dx) if i % 2 == 0 else (FACE['top'] + sy * (v - FACE['top']) + dy) for i, v in enumerate(a)]) for c, a in parse_path(m.group(1))]
            return f' d="{path_d(cmds)}"'
        text = re.sub(r' d="([^"]*)"', move, text).replace('data-pathways="1"', 'data-pathways="1" data-refit="1"', 1)
        with open(path, 'w', encoding='utf-8') as f:
            f.write(text)
        done.append(name)
    return done


# ---------- Stray marks ----------


def remove_specks(folder='hair', pad=6, share=0.004):
    """
    Deletes specks from hairstyles: tiny pieces that touch nothing else in the drawing (a dot left
    above a parting, a sliver beside a bun). A piece is a speck when it stands more than `pad` units
    clear of everything else and its box is under `share` of the whole style's. Loose strands and
    clips are far larger, and stay. Safe to run again: once removed there is nothing left to find.
    -> {name: how many specks were removed}
    """
    removed = {}
    d = folder_dir(folder)
    for f in sorted(os.listdir(d)) if os.path.isdir(d) else []:
        if not f.endswith('.svg'):
            continue
        path = os.path.join(d, f)
        text = open(path, encoding='utf-8').read()
        if 'data-pathways="1"' not in text:
            continue
        paths = [m for m in re.finditer(r' d="([^"]*)"', text)]
        subs = []  # (path index, subpath commands, box)
        for pi, m in enumerate(paths):
            cur = []
            for c, a in parse_path(m.group(1)) + [('M', [])]:
                if c == 'M' and cur:
                    xs = [v for _, args in cur for v in args[0::2]]
                    ys = [v for _, args in cur for v in args[1::2]]
                    subs.append((pi, cur, (min(xs), min(ys), max(xs), max(ys))))
                    cur = []
                if a or c == 'Z':
                    cur.append((c, a))
        parent = list(range(len(subs)))

        def find(i):
            while parent[i] != i:
                parent[i] = parent[parent[i]]
                i = parent[i]
            return i
        order = sorted(range(len(subs)), key=lambda i: subs[i][2][0])
        for n, i in enumerate(order):
            a = subs[i][2]
            for j in order[n + 1:]:
                b = subs[j][2]
                if b[0] > a[2] + pad:
                    break
                if b[1] <= a[3] + pad and b[3] >= a[1] - pad:
                    parent[find(i)] = find(j)
        groups = {}
        for i in range(len(subs)):
            groups.setdefault(find(i), []).append(i)
        if len(groups) < 2:
            continue
        size = lambda g: (max(subs[i][2][2] for i in g) - min(subs[i][2][0] for i in g)) * (max(subs[i][2][3] for i in g) - min(subs[i][2][1] for i in g))
        whole = max(size(g) for g in groups.values())
        drop = {i for g in groups.values() if size(g) < whole * share for i in g}
        if not drop:
            continue
        for pi, m in reversed(list(enumerate(paths))):
            keep = [cmd for i, (p, cmds, _) in enumerate(subs) if p == pi and i not in drop for cmd in cmds]
            text = text[:m.start()] + f' d="{path_d(keep)}"' + text[m.end():]
        with open(path, 'w', encoding='utf-8') as out:
            out.write(text)
        removed[f[:-4]] = len({find(i) for i in drop})
    return removed


# ---------- 3. Cleaning one file ----------

HALO_FOLDERS = {'clothes', 'hats', 'crowns', 'jewelry', 'glasses', 'emotions'}


def fmt(v):
    s = f'{v:.1f}'
    s = s.rstrip('0').rstrip('.') if '.' in s else s
    return '0' if s in ('-0', '') else s


def path_d(cmds):
    out = []
    for c, a in cmds:
        out.append(c + ' '.join(fmt(v) for v in a))
    return ''.join(out)


def process(path, folder, force=False):
    text = open(path, encoding='utf-8').read()
    if 'data-pathways="1"' in text and not force:
        return None
    vb, elements = read_svg(text)
    name = os.path.basename(path)[:-4]
    notes = []
    # Solid white backgrounds, and the white "sticker" outline some packs put round a garment.
    box = bbox_of(elements)
    if box:
        bw, bh = box[2] - box[0], box[3] - box[1]
        full = lambda e: (lambda b: b and (b[2] - b[0]) >= bw * 0.9 and (b[3] - b[1]) >= bh * 0.9)(bbox_of([e]))
        big = lambda e: area(e) > bw * bh * 0.04
        kept = [e for e in elements if not (is_white(e['fill']) and ((folder in HALO_FOLDERS or abs(bw - vb[2]) < 2) and full(e) or folder == 'hair' and big(e)))]
        if len(kept) < len(elements) and kept:
            notes.append(f'removed {len(elements) - len(kept)} white background shape(s)')
            elements = kept
    # Heads: the dark silhouette must sit under the skin, or it hides it.
    if folder == 'heads':
        skin = [i for i, e in enumerate(elements) if e['fill'] not in ('#000000',) and lum(e['fill']) > 0.2]
        dark = [i for i, e in enumerate(elements) if lum(e['fill']) < INK]
        if skin and dark and dark[0] > skin[0]:
            d = elements.pop(dark[0])
            elements.insert(0, d)
            sb, db = bbox_of([elements[skin[0]]]), bbox_of([d])
            if all(abs(a - b) < 3 for a, b in zip(sb, db)):  # the same shape: no outline would show
                elements[skin[0]]['stroke'] = d['fill']
            notes.append('outline moved under the skin')
    main = recolour(folder, name, elements)
    if folder == 'eyes':
        n = add_eye_whites(elements)
        if n:
            notes.append(f'added whites to {n} opening(s)')
        m = open_up_eyes(elements)
        if m:
            notes.append(f'made room for whites round {m} iris(es)')
    if main:
        notes.append(f'{main} -> var(--{RECOLOUR[folder]})')
    notes.append(place(folder, name, elements))
    paths = []
    for e in elements:
        role = ''
        if folder == 'heads' and e.get('paint', '').startswith('var(--skin-color') and 'skin' not in ''.join(paths):
            role = ' id="skin"'
        paint = e.get('paint') or e['fill']
        if folder == 'eyes' and not e.get('paint') and is_white(e['fill']):
            paint = 'var(--eye-white,#ffffff)'  # the renderer softens the white a little on deep skin tones
        extra = (f' fill-rule="{e["rule"]}"' if e.get('rule') else '') + (f' opacity="{e["opacity"]}"' if e.get('opacity') else '')
        stroke = f';stroke:{e["stroke"]};stroke-width:5;stroke-linejoin:round' if e.get('stroke') else ''
        paths.append(f'<path{role} style="fill:{paint}{stroke}"{extra} d="{path_d(e["cmds"])}"/>')
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512" '
           f'data-pathways="1" data-source-viewbox="{" ".join(fmt(v) for v in vb)}">'
           f'<g id="art">{"".join(paths)}</g></svg>\n')
    with open(path, 'w', encoding='utf-8') as f:
        f.write(svg)
    return notes

# ---------- 4. The manifest ----------


def tags_for(folder, name):
    t = {}
    parts = name.split('_')
    if folder == 'hair':
        if 'girl' in parts or name.startswith('hair_updo'):
            t['gender'] = 'female'
        if 'boy' in parts:
            t['gender'] = 'male'
        if 'baby' in parts:
            t['age'] = 'baby'
        for length in ('short', 'medium', 'long', 'updo'):
            if length in parts:
                t['length'] = length
        if name.startswith('hair_updo'):
            t['length'] = 'updo'
        t['bulky'] = t.get('length') in ('long', 'medium', 'updo') or bool(re.search(r'afro|puff|curl', name))
    if folder == 'heads':
        t['age'] = next((a for a in ('baby', 'toddler', 'kid') if a in parts), 'adult')
    if folder in ('clothes', 'hats'):
        for k in ('police', 'swat', 'military', 'firefighter', 'doctor', 'prison', 'chef', 'grad'):
            if k in parts:
                t['career'] = k
        if 'baby' in parts:
            t['age'] = 'baby'
        if re.search(r'royal|prince|princess|queen|king|duchess|duke|emperor|imperial|noble|admiral|ermine|jabot|capelet|armor', name):
            t['royal'] = True
    if folder == 'crowns':
        t['royal'] = True
        t['rank'] = ('monarch' if re.search(r'king|queen|imperial', name) else 'heir' if re.search(r'prince|tiara|circlet', name) else 'noble')
    if folder == 'jewelry':
        t['kind'] = 'necklace' if re.search(r'choker|chain|necklace', name) else 'face' if re.search(r'lip_ring', name) else 'ears'
    return t


GENERIC = {'hair', 'outfit', 'hat', 'crown', 'accessory', 'jewelry', 'makeup', 'aging', 'emotion', 'facial', 'glasses', 'eyes', 'brows', 'nose', 'lips',
           'face', 'head', 'boy', 'girl', 'baby'}
LENGTH = {'short': 'Short', 'medium': 'Medium', 'long': 'Long', 'updo': 'Up'}


def label(name):
    """A name for the creator: what tells this part apart. 'hair_boy_long_02' -> 'Long, style 2'; 'glasses_08_octagonal' -> 'Octagonal'."""
    parts = name.split('_')
    number = next((int(w) for w in parts if w.isdigit()), None)
    words = [w for w in parts if not w.isdigit() and w not in GENERIC and w not in LENGTH]
    length = next((LENGTH[w] for w in parts if w in LENGTH), None)
    if name.startswith('hair_updo'):
        length = 'Up'
    text = ' '.join(words)
    if name.startswith('hair_baby') or (name.startswith('head_00')):
        text = text or name
    if name.startswith('hair') and not name.startswith('hair_baby'):
        # Two packs share their numbering; the second continues from 17 so every name is different.
        text = f'{length}, {text}' if text else f'{length}, style {number + (16 if "boy" in parts else 0)}'
    elif parts[0] == 'lips' and text == 'masc' and number is not None:
        text = f'Masc {number}'  # the masculine mouths: 'lips_masc_03' -> 'Masc 3'
    elif not text:
        kind = {'eyes': 'Eyes', 'brows': 'Brows', 'nose': 'Nose', 'lips': 'Mouth', 'glasses': 'Glasses'}.get(parts[0], parts[0].title())
        text = f'{kind} {number}' if number is not None else kind
    return text[:1].upper() + text[1:]


def write_manifest():
    data = {}
    for folder in FOLDERS:
        d = folder_dir(folder)
        files = sorted(f for f in os.listdir(d) if f.endswith('.svg')) if os.path.isdir(d) else []
        rel = os.path.relpath(d, ASSETS_ROOT).replace(os.sep, '/')
        ids = sorted(((f, part_id(folder, f[:-4])) for f in files), key=lambda t: t[1])  # by id, so renaming a file never reorders the list
        data[folder] = [{'id': i, 'file': f'{rel}/{f}', 'label': label(i), **({'tags': tags_for(folder, i)} if tags_for(folder, i) else {})} for f, i in ids]
        if folder == 'heads':  # each head is measured, so parts can be moved onto it exactly
            for item in data[folder]:
                _, els = read_svg(open(os.path.join(ASSETS_ROOT, item['file']), encoding='utf-8').read())
                item['fit'] = measure_head(els)
                item['edge'] = measure_head_edge(els)
        if folder == 'hair':  # and each hairstyle, so it can be fitted to each head
            for item in data[folder]:
                _, els = read_svg(open(os.path.join(ASSETS_ROOT, item['file']), encoding='utf-8').read())
                item['edge'] = measure_hair_edge(els)
        if folder in ('eyes', 'noses', 'lips'):  # and each pair of eyes, nose and mouth, so they can be kept clear of each other
            for item in data[folder]:
                _, els = read_svg(open(os.path.join(ASSETS_ROOT, item['file']), encoding='utf-8').read())
                item['shape'] = measure_feature(els, folder)
    lines = ['// Generated by scripts/build-avatar-manifest.py. Do not edit by hand: add SVGs under',
             '// assets/avatars/ (head shapes: assets/heads/) and run the script again.',
             '// Paths are relative to assets/.',
             'export const AVATAR_MANIFEST = {']
    for folder in FOLDERS:
        lines.append(f'  {folder}: [')
        for item in data[folder]:
            lines.append('    ' + json.dumps(item, ensure_ascii=False, separators=(', ', ': ')) + ',')
        lines.append('  ],')
    lines.append('};')
    lines.append('')
    template = {'face': {'cx': 256, 'top': FACE['top'], 'chin': FACE['chin_y'], 'w': FACE['w']},
                'anchor': {'eyes': FACE['eye_y'], 'eyebrows': FACE['brow_y'], 'nose': FACE['nose_y'], 'lips': FACE['mouth_y'], 'cheek': FACE['cheek_y']},
                'ear': {'left': EAR['left_x'] + 6, 'right': EAR['right_x'] - 6, 'lobe': EAR['lobe_y']},
                'clothesTop': LAYOUT['clothes'][3], 'shoulderW': 285,
                'profile': {'rows': list(PROFILE_ROWS), 'cols': list(PROFILE_COLS)}, 'frameTop': FRAME_TOP, 'featureStep': FEATURE_STEP}
    lines.append('/** The template face every part was fitted to. Each head\'s own measurements are in its `fit`. */')
    lines.append('export const AVATAR_TEMPLATE = ' + json.dumps(template, separators=(', ', ': ')) + ';')
    lines.append('')
    lines.append('/** Every part, by id. */')
    lines.append('export const PART_BY_ID = Object.fromEntries(Object.values(AVATAR_MANIFEST).flat().map((p) => [p.id, p]));')
    with open(MANIFEST, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')
    return {k: len(v) for k, v in data.items()}

# ---------- Main ----------


def main(argv):
    force = '--force' in argv
    zips = [a for a in argv if a.lower().endswith('.zip')]
    os.makedirs(ASSETS, exist_ok=True)
    if zips:
        scratch = tempfile.mkdtemp(prefix='avatar-pack-')
        try:
            done = unpack(zips, scratch)
            moved, skipped = sort_into_folders([scratch])
            print(f'unpacked {len(done)} zip file(s); sorted {moved} SVG(s)' + (f'; no folder for: {", ".join(skipped)}' if skipped else ''))
        finally:
            shutil.rmtree(scratch, ignore_errors=True)
        for z in zips:  # the packs are temporary once their contents are sorted
            os.remove(z)
    # Loose SVGs dropped anywhere under assets/avatars/ are sorted too.
    loose = [os.path.join(ASSETS, d) for d in os.listdir(ASSETS) if os.path.isdir(os.path.join(ASSETS, d)) and d not in FOLDERS]
    moved, skipped = sort_into_folders([ASSETS] + loose)
    for d in loose:
        if not any(f.endswith('.svg') for _, _, fs in os.walk(d) for f in fs):
            shutil.rmtree(d, ignore_errors=True)
    if moved:
        print(f'sorted {moved} loose SVG(s)')
    processed, problems = 0, []
    for folder in FOLDERS:
        d = folder_dir(folder)
        if not os.path.isdir(d):
            continue
        for f in sorted(os.listdir(d)):
            if not f.endswith('.svg'):
                continue
            try:
                notes = process(os.path.join(d, f), folder, force)
            except Exception as err:  # keep going; report at the end
                problems.append(f'{folder}/{f}: {err}')
                continue
            if notes is not None:
                processed += 1
                if '-v' in argv:
                    print(f'{folder}/{f}: ' + '; '.join(notes))
    for name, n in remove_specks().items():
        print(f'removed {n} stray mark(s) from {name}')
    lined = weigh_lines() + weigh_lines('eyes', recolor=False) + weigh_lines('lips', recolor=False)
    if lined:
        print(f'made the lines of {len(lined)} part(s) adjustable')
    for name in thin_outline():
        print(f'thinned the outline of {name}')
    for name, drop in soften_creases().items():
        print(f'took out the floating lid crease of {name}' if drop is None else f'softened the lid crease of {name} (lowered {drop})')
    parted = split_lip_tones()
    if parted:
        print('gave the upper lip its own color in ' + ', '.join(parted))
    for name in fill_teeth():
        print(f'filled the teeth of {name}')
    repaired = refit_hair()
    if repaired:
        print('repaired the placement of ' + ', '.join(repaired))
    counts = write_manifest()
    print(f'processed {processed} new SVG(s); manifest lists ' + ', '.join(f'{k} {v}' for k, v in counts.items()))
    for p in problems:
        print('PROBLEM', p)
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))

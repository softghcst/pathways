// CharacterAvatar: a portrait stacked from the SVG parts in assets/avatars/ and the head shapes in assets/heads/.
//
// Every part file has been normalized onto one 512x512 frame by
// scripts/build-avatar-manifest.py, so parts are stacked without any
// positioning here. Each layer is an SVG <use> pointing at the part's file
// (`file.svg#art`): the browser fetches each file once and caches it, and
// the color variables set on the portrait (--skin-color, --hair-color, ...)
// reach into the referenced artwork.
//
// Layers, back to front:
//   back hair, head, make-up (clipped to the head), aging, eyes, eyebrows,
//   nose, lips, clothes, necklaces, front hair, earrings and
//   piercings, glasses, hat or crown, emotions.
// Hair is drawn twice: the whole style behind the head, and the part above
// the jaw again in front, so a fringe falls over the forehead while long
// lengths fall behind the shoulders and the outfit. A style from the fitting
// pipeline (assets/hair_fitted/, see fittedHairFile) is already split: its
// hair_back layer is drawn behind the head and its other layers in front.
//
// Three ways to use it:
//   characterAvatarSvg(look, ctx)        -> markup string (what the game's screens use)
//   createCharacterAvatar(look, ctx)     -> an <svg> element
//   new CharacterAvatar(el, look, ctx)   -> mounted in `el`; .update(look, ctx) redraws
//
// `look` is a resolved look (see resolveLook in js/avatar/catalog.js):
//   { head, eyes, eyebrows, nose, lips, hair, makeup: [], jewelry: [], glasses, clothes, hat, crown, emotion,
//     colors: { skin, hair, brow, eye, lip, blush, outfit } }
// `ctx` describes the moment: { age, gender, mood, jailed, royal: { rank }, career: { id, level }, label }.
import { PART_BY_ID, AVATAR_TEMPLATE as T } from './avatarManifest.js';
import { mixHex } from './avatar/color.js';
import { hairFit, frameFor } from './avatar/hairFit.js';
import { FITTED_HAIR, FITTED_BASE_HEAD } from './avatar/fittedHair.js';
import { noseFit, mouthFit } from './avatar/featureFit.js';
import { ROYAL, CAREER_DRESS, PRISON, EXPRESSION, ELDER_BROWS, BABY_BROWS, PART_SCALE, RESTING, LOW_MOOD } from './avatar/curation.js';

/** Where the part files are, relative to the page (works from the site root on GitHub Pages). */
export const AVATAR_BASE = './assets/'; // manifest paths are relative to assets/ (heads/, avatars/<part>/)
const href = (id) => (PART_BY_ID[id] ? `${AVATAR_BASE}${PART_BY_ID[id].file}#art` : null);

/** A head's plain name, as the hair pipeline knows it: 'head_17_dimple_oval' -> 'dimple_oval' (from assets/heads/dimple_oval.svg). */
const headName = (headId) => PART_BY_ID[headId]?.file.replace(/^.*\/|\.svg$/g, '') ?? null;

/**
 * A hairstyle from the fitting pipeline (scripts/fit_hair.py) comes ready-made for each head, as
 * assets/hair_fitted/<style>_<head>.svg, drawn in that head's own coordinates: no fitting is done here.
 * -> its file, relative to AVATAR_BASE, or null for any other hairstyle. A head the style was not fitted
 * to is given the base head's version.
 */
export function fittedHairFile(hairId, headId) {
  const style = FITTED_HAIR[hairId];
  if (!style) return null;
  const head = style.heads.includes(headName(headId)) ? headName(headId) : FITTED_BASE_HEAD;
  return `hair_fitted/${hairId}_${head}.svg`;
}
/**
 * A fitted file's layers: hair_back goes behind the head, the rest in front of the face. A style marked
 * clipToHead (a buzz cut or fade) is clipped to this head's skin, the same shape make-up is clipped to,
 * so it hugs the skull exactly on every head and nothing stands off it.
 */
const FITTED_BACK = ['hair_back'];
const FITTED_FRONT = ['hair_base', 'hair_bangs', 'hair_lines'];

/** Where the jaw is on the template face: hair above this line is drawn again in front of the face. */
const FRONT_HAIR_CUT = 404;
/** Under a hat, hair above this line is hidden; bulky styles lose everything above the ears. */
const HAT_LINE = 262;
const BULKY_HAT_LINE = 316;

/** The stage of life a portrait shows. */
export function ageStage(age = 25) {
  if (age < 2) return 'baby';
  if (age < 5) return 'toddler';
  if (age < 13) return 'kid';
  if (age < 50) return 'adult';
  return 'older';
}
const STAGE_HEAD = { baby: 'head_00_baby', toddler: 'head_00_toddler', kid: 'head_00_kid' };

/** Lines that come with age, from fifty on. */
const AGING = [[55, 'aging_01_smile_lines'], [66, 'aging_02_crows_feet'], [78, 'aging_03_forehead_lines']];

/**
 * What the portrait actually wears at this moment: work clothes, royal dress,
 * prison orange, or the person's own outfit; and what hair, make-up and
 * jewelry suit their age.
 */
export function dressFor(look, ctx = {}) {
  const age = ctx.age ?? 25;
  const stage = ageStage(age);
  const gender = ctx.gender === 'female' ? 'female' : 'male';
  const out = { ...look, makeup: [...(look.makeup ?? [])], jewelry: [...(look.jewelry ?? [])], aging: [] };
  out.head = STAGE_HEAD[stage] ?? look.head;
  const young = stage === 'baby' || stage === 'toddler';
  if (young) {
    out.hair = look.babyHair ?? null;
    out.makeup = (look.marks ?? []).filter((m) => /freckle/.test(m));
    out.jewelry = []; out.glasses = null; out.hat = null;
    out.eyebrows = BABY_BROWS;
  } else if (stage === 'kid') {
    out.makeup = (look.marks ?? []).filter((m) => /freckle/.test(m));
    out.jewelry = out.jewelry.filter((j) => /stud/.test(j));
  } else {
    out.makeup = [...new Set([...(look.marks ?? []), ...out.makeup])];
  }
  if (stage === 'older') {
    out.aging = AGING.filter(([from]) => age >= from).map(([, id]) => id);
    if (age >= 84 && gender === 'male' && out.eyebrows && !look.keepBrows) out.eyebrows = ELDER_BROWS;
  }
  // Clothes: prison, then crown, then work, then the person's own.
  if (young) out.clothes = look.babyClothes ?? 'outfit_baby_01_bib_onesie';
  const rank = ctx.royal?.rank;
  if (ctx.jailed) { out.clothes = PRISON; out.hat = null; out.crown = null; }
  else if (rank && ['monarch', 'heir', 'royal'].includes(rank)) {
    out.clothes = young ? ROYAL.outfits.baby : rank === 'monarch' ? ROYAL.outfits.monarch[gender] : look.royalOutfit ?? ROYAL.outfits[gender][0];
    out.crown = stage === 'adult' || stage === 'older' ? (ROYAL.crowns[rank]?.[gender] ?? null) : stage === 'kid' ? ROYAL.crowns.child : null;
    out.hat = null;
  } else if (rank === 'noble' && (stage === 'adult' || stage === 'older')) {
    out.crown = ROYAL.crowns.noble;
  } else if (ctx.career?.id && CAREER_DRESS[ctx.career.id] && !young) {
    const d = CAREER_DRESS[ctx.career.id];
    const pick = d.senior && (ctx.career.level ?? 0) >= d.senior.level ? d.senior : d;
    if (pick.outfit) out.clothes = pick.outfit;
    if (pick.hat) out.hat = pick.hat;
  }
  // Mood shows in the face.
  const mood = ctx.mood ?? 60;
  if (ctx.emotion) out.emotion = ctx.emotion;
  // Sad brows and crying eyes are never a resting face: they appear only while something sad is weighing on the person.
  if (mood <= LOW_MOOD.sad && !young && out.eyebrows) out.eyebrows = EXPRESSION.sadBrows;
  if (mood <= LOW_MOOD.crying && stage !== 'baby') out.eyes = EXPRESSION.crying;
  return out;
}

let serial = 0;
const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const use = (id, extra = '') => { const h = href(id); return h ? `<use href="${h}"${extra}/>` : ''; };

/** What one step of each personal adjustment changes. Steps run from -2 to 2. */
export const TWEAK_STEP = { size: 0.09, gap: 4, height: 5 };
/** Every face's eyes are set this far further apart than the artwork draws them (template units, each side). */
const EYE_APART = 3;

// Younger faces: features a little smaller for the size of the head, and set a little lower.
const STAGE_FEATURES = { baby: { k: 0.74, drop: 0.05, mouth: 0.8 }, toddler: { k: 0.82, drop: 0.04, mouth: 0.86 }, kid: { k: 0.94, drop: 0.02 } };
const n1 = (v) => Math.round(v * 100) / 100;

/**
 * Every part file is drawn on one template face. Each head has been measured
 * (its `fit` in the manifest: top, chin, width, ears, neck, shoulders), and
 * this works out, for one head, the transform that moves each kind of part
 * from the template onto it: features keep their place between forehead and
 * chin, hair and hats follow the top and width of the head, earrings hang
 * from this head's ears, clothes sit under this head's chin. Given the eyes and
 * nose a face has (`parts`), the nose is also kept clear of those eyes, and the mouth is fitted to the
 * nose above it (js/avatar/featureFit.js).
 * @param {{eyes?:string, nose?:string, lips?:string}} [parts]
 * @returns {Record<string, string>} an SVG transform attribute (with a leading space) per layer
 */
export function fitTransforms(headId, stage, tweaks = {}, parts = {}) {
  const fit = PART_BY_ID[headId]?.fit;
  if (!fit) return {};
  const wr = fit.w / T.face.w;
  const faceH = fit.chin - fit.top;
  const hr = faceH / (T.face.chin - T.face.top);
  const young = STAGE_FEATURES[stage] ?? { k: 1, drop: 0 };
  const move = (ax, ay, x, y, s) => ` transform="translate(${n1(x)} ${n1(y)}) scale(${n1(s)}) translate(${-ax} ${-ay})"`;
  const s = Math.sqrt(wr * hr) * young.k;
  const at = (ay) => fit.top + (ay - T.face.top) * hr + young.drop * faceH;
  const feature = (ay, scale = s) => move(256, ay, fit.cx, at(ay), scale);
  // A person's own proportions: each step is a small, fixed change (see TWEAKS).
  const step = (k) => Math.max(-2, Math.min(2, Number(tweaks[k]) || 0));
  const eyeS = s * (1 + step('eyeSize') * TWEAK_STEP.size);
  const eyeUp = step('eyeY') * TWEAK_STEP.height * hr;
  const noseS = s * (1 + step('noseSize') * TWEAK_STEP.size) * (PART_SCALE[parts.nose] ?? 1);
  // This nose with these eyes on this head: a little smaller, lower, or the eyes a touch wider, where they would crowd.
  const nf = parts.eyes && parts.nose ? noseFit(parts.eyes, parts.nose, { s, eyeS, noseS, eyeY: at(T.anchor.eyes) - eyeUp, noseY: at(T.anchor.nose), apart: EYE_APART + step('eyeGap') * TWEAK_STEP.gap })
    : { k: 1, drop: 0, apart: 0 };
  // The mouth, a little wider or moved where this nose (as fitted) would leave it looking pinched or far away.
  const mouthS = s * (young.mouth ?? 1) * (1 + step('lipSize') * TWEAK_STEP.size);
  const mf = parts.nose && parts.lips ? mouthFit(parts.lips, parts.nose, { s, mouthS, noseS: noseS * nf.k, noseY: at(T.anchor.nose) + nf.drop, mouthY: at(T.anchor.lips), chin: fit.chin },
    RESTING.lips.includes(parts.lips) || RESTING.lipsMasc.includes(parts.lips)) : { k: 1, dy: 0 };
  const apart = EYE_APART + step('eyeGap') * TWEAK_STEP.gap + nf.apart; // template units, each eye moves this far outwards
  const eyeAt = (ay, scale, side) => `${move(256, ay, fit.cx, at(ay) - eyeUp, scale).slice(0, -1)} translate(${side * apart} 0)"`;
  const earS = (fit.earR - fit.earL - 20) / (T.ear.right - T.ear.left);
  const body = Math.max(0.8, Math.min(1.06, fit.shoulderW / T.shoulderW));
  const crown = move(256, T.face.top, fit.cx, fit.top, wr);
  return {
    eyesL: eyeAt(T.anchor.eyes, eyeS, -1), eyesR: eyeAt(T.anchor.eyes, eyeS, 1),
    browsL: eyeAt(T.anchor.eyebrows, s, -1), browsR: eyeAt(T.anchor.eyebrows, s, 1),
    eyes: feature(T.anchor.eyes), eyebrows: feature(T.anchor.eyebrows),
    nose: move(256, T.anchor.nose, fit.cx, at(T.anchor.nose) + nf.drop, noseS * nf.k), lips: move(256, T.anchor.lips, fit.cx, at(T.anchor.lips) + mf.dy, mouthS * mf.k),
    makeup: feature(T.anchor.cheek), aging: feature(T.anchor.cheek), emotion: feature(T.anchor.eyes),
    glasses: feature(T.anchor.eyes, wr * young.k),
    hair: crown, hat: crown,
    ears: move(256, T.ear.lobe, (fit.earL + fit.earR) / 2, fit.lobe, earS),
    clothes: move(256, T.clothesTop, fit.cx, fit.chin + 8, body), necklace: move(256, T.clothesTop, fit.cx, fit.chin + 8, body),
  };
}

/**
 * The colors, as CSS custom properties. Hair grays with age unless dyed;
 * brows gray more slowly.
 */
/** How bright a color is, 0 (black) to 1 (white). */
function luminance(hex) {
  const h = String(hex ?? '#888888').replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => { const v = (parseInt(h.slice(i, i + 2), 16) || 0) / 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * How far a face needs help to stay readable, 0 (none) to 1: the linework of every face is one dark
 * ink, which has less and less contrast as the skin deepens, while the white of the eye has more and more.
 */
export const DEEP = { from: 0.2, full: 0.05 };
export const deepness = (skin) => Math.max(0, Math.min(1, (DEEP.from - luminance(skin)) / (DEEP.from - DEEP.full)));

/**
 * What is done about it, at full strength (each is scaled by deepness, so lighter faces are untouched):
 *   white   how far the white of the eye is toned toward the skin
 *   line    extra weight on the dark lines of the eyes and mouth (frame units)
 *   rim     how much lighter than the skin the edge given to the brows is
 *   edge    how wide that edge is (frame units)
 *   nose    how much heavier the nose's dark lines get (frame units), in noseInk; its skin is never touched
 * The shapes of the features are not changed, and nobody's own colors are. The nose's skin is never
 * adjusted: it is drawn in exactly the face's skin color on every tone; only its lines get heavier.
 */
export const READABLE = { white: 0.2, line: 1.4, rim: 0.2, edge: 3, nose: 1.2, ink: '#170b06', noseInk: '#1a0c06' };

/** The outline of hairstyles drawn with color variables (var(--hair-stroke)): the heads' own outline color. */
const HAIR_STROKE = '#23140f';

function colorVars(look, ctx) {
  const c = look.colors ?? {};
  const age = ctx.age ?? 25;
  const gray = c.dyed ? 0 : age >= 80 ? 0.9 : age >= 70 ? 0.72 : age >= 60 ? 0.45 : age >= 52 ? 0.18 : 0;
  const hair = gray ? mixHex(c.hair, '#dcd8d0', gray) : c.hair;
  const brow = c.brow ? mixHex(c.brow, '#d8d3c8', gray * 0.6) : mixHex(hair, '#1c1210', 0.25);
  const deep = deepness(c.skin);
  // --hair-stroke: the outline of hairstyles drawn with color variables, the same dark line as the heads.
  const vars = { 'skin-color': c.skin, 'hair-color': hair, 'hair-stroke': HAIR_STROKE, 'brow-color': brow, 'eye-color': c.eye, 'lip-color': c.lip, 'lip-upper': c.lipUpper, 'blush-color': c.blush,
    'eye-white': deep ? mixHex('#ffffff', c.skin, READABLE.white * deep) : null };
  if (c.outfit) vars['outfit-color'] = c.outfit;
  return Object.entries(vars).filter(([, v]) => v).map(([k, v]) => `--${k}:${v}`).join(';');
}

/**
 * The portrait as SVG markup.
 * @param {object} look  a resolved look
 * @param {object} [ctx]
 * @param {{size?:number|string, className?:string, viewBox?:string}} [opts]  viewBox zooms in on part of the 512 frame
 */
export function characterAvatarSvg(look, ctx = {}, opts = {}) {
  const d = dressFor(look, ctx);
  const n = ++serial;
  const hatOn = !!d.hat;
  const fitted = d.hair ? fittedHairFile(d.hair, d.head) : null;
  const bulky = fitted ? ['long', 'medium', 'updo'].includes(FITTED_HAIR[d.hair].length) : !!PART_BY_ID[d.hair]?.tags?.bulky;
  const hairTop = hatOn ? (bulky ? BULKY_HAT_LINE : HAT_LINE) : 0;
  // Under a hat, hair is hidden above the brim, and tucks in at the sides rather than ending in a flat shelf.
  const under = (bottom) => `<path d="M-400 ${bottom}V${hairTop + 64}H112V${hairTop}H400V${hairTop + 64}H912V${bottom}Z"/>`;
  // Hair in front of the face ends at this head's own chin (in the hair's coordinates), so a lock that
  // falls across the face stops at the jawline, not in a straight edge part-way down the cheek.
  const hf = d.hair && !fitted ? hairFit(d.hair, d.head) : null;
  const chin = PART_BY_ID[d.head]?.fit?.chin;
  const frontCut = hf && chin ? Math.round(T.face.top + (chin - 2 - hf.ty) / hf.sy) : FRONT_HAIR_CUT;
  const defs = [
    `<clipPath id="pw-l-${n}"><rect x="-400" y="-400" width="656" height="1400"/></clipPath><clipPath id="pw-r-${n}"><rect x="256" y="-400" width="656" height="1400"/></clipPath>`,
    `<clipPath id="pw-face-${n}"><use href="${href(d.head)?.replace('#art', '#skin')}"/></clipPath>`,
    `<clipPath id="pw-back-${n}">${hatOn ? under(1400) : '<rect x="-400" y="-2000" width="1312" height="3400"/>'}</clipPath>`,
    `<clipPath id="pw-front-${n}">${hatOn ? under(frontCut) : `<rect x="-400" y="-2000" width="1312" height="${frontCut + 2000}"/>`}</clipPath>`,
  ];
  const f = fitTransforms(d.head, ageStage(ctx.age ?? 25), look.tweaks, { eyes: d.eyes, nose: d.nose, lips: d.lips });
  // Hair is fitted to this head from the measurements of both (js/avatar/hairFit.js).
  const hairAt = hf ? ` transform="translate(${hf.tx} ${hf.ty}) scale(${hf.sx} ${hf.sy}) translate(-256 ${-T.face.top})"` : f.hair ?? '';
  // A style too tall for the picture is flattened above the crown: the part above the line is drawn
  // again, squeezed toward it, so the two halves still meet along it.
  const hairLayer = (clip) => {
    // A fitted style is drawn as it is: its back layer behind the head, the others in front of the face. Only a hat clips it.
    if (fitted) {
      const ids = clip === `pw-back-${n}` ? FITTED_BACK : FITTED_FRONT;
      const drawn = `<g clip-path="url(#pw-back-${n})">${ids.map((id) => `<use href="${AVATAR_BASE}${fitted}#${id}"/>`).join('')}</g>`;
      return FITTED_HAIR[d.hair].clipToHead ? `<g clip-path="url(#pw-face-${n})">${drawn}</g>` : drawn;
    }
    const g = `<g${hairAt} clip-path="url(#${clip})">${use(d.hair)}</g>`;
    if (!hf || hf.squash >= 1) return g;
    return `<g clip-path="url(#pw-low-${n})">${g}</g><g transform="translate(0 ${hf.line}) scale(1 ${hf.squash}) translate(0 ${-hf.line})" clip-path="url(#pw-high-${n})">${g}</g>`;
  };
  if (hf && hf.squash < 1) defs.push(`<clipPath id="pw-low-${n}"><rect x="-400" y="${hf.line}" width="1312" height="1400"/></clipPath><clipPath id="pw-high-${n}"><rect x="-400" y="-2000" width="1312" height="${2000 + hf.line}"/></clipPath>`);
  // Eyes and brows are drawn as a pair in one file: each half is shown separately so they can sit closer or further apart.
  const pair = (id, l, r, extra = '') => (href(id) ? `<g${l} clip-path="url(#pw-l-${n})">${use(id, extra)}</g><g${r} clip-path="url(#pw-r-${n})">${use(id, extra)}</g>` : '');
  // On deep skin the features are given a little more weight and the nose a little light, so the face
  // reads as clearly as a lighter one (see READABLE). Stroke is inherited by the artwork a <use> draws.
  const deep = deepness(look.colors?.skin);
  const light = deep ? mixHex(look.colors.skin, '#ffe9d6', READABLE.rim * deep) : null;
  // Dark lines gain weight; brows gain a faint lighter edge, drawn under their own shapes. Only the line shapes
  // take the stroke (weigh_lines in the build script: an eye's or mouth's outline, a nose's lines), so whites,
  // irises, highlights and teeth stay clean. A nose's lines are also made a little darker.
  const weigh = (w) => (deep ? ` style="--line-ink:${READABLE.ink};--line-width:${n1(w * deep)}"` : '');
  const rim = (w, extra = '') => (deep ? ` style="${extra}stroke:${light};stroke-width:${n1(w * deep)};stroke-linejoin:round;paint-order:stroke"` : '');
  const kind = (j) => PART_BY_ID[j]?.tags?.kind;
  const necklaces = d.jewelry.filter((j) => kind(j) === 'necklace');
  const earrings = d.jewelry.filter((j) => kind(j) === 'ears');
  const piercings = d.jewelry.filter((j) => kind(j) === 'face');
  // The clips are in the template's coordinates, on the same element as the fit, so they move with the hair.
  const layers = [
    d.hair ? hairLayer(`pw-back-${n}`) : '',
    use(d.head),
    d.makeup.length ? `<g clip-path="url(#pw-face-${n})">${d.makeup.map((m) => use(m, f.makeup)).join('')}</g>` : '',
    // Lines of age stay on the face: on a narrow head they would otherwise run out over the hair.
    d.aging.length ? `<g clip-path="url(#pw-face-${n})">${d.aging.map((a) => use(a, `${f.aging ?? ''} opacity=".38"`)).join('')}</g>` : '',
    pair(d.eyes, f.eyesL, f.eyesR, weigh(READABLE.line)), use(d.eyebrows, `${f.eyebrows ?? ''}${rim(READABLE.edge)}`),
    use(d.nose, `${f.nose ?? ''}${deep ? ` style="--line-ink:${READABLE.noseInk};--line-width:${n1(READABLE.nose * deep)}"` : ''}`),
    use(d.lips, `${f.lips ?? ''}${weigh(READABLE.line * 0.6)}`),
    use(d.clothes, f.clothes),
    necklaces.map((j) => use(j, f.necklace)).join(''),
    d.hair ? hairLayer(`pw-front-${n}`) : '',
    earrings.map((j) => use(j, f.ears)).join(''),
    piercings.map((j) => use(j, f.lips)).join(''),
    d.glasses ? use(d.glasses, f.glasses) : '',
    d.hat ? use(d.hat, f.hat) : d.crown ? use(d.crown, f.hat) : '',
    d.emotion ? use(d.emotion, f.emotion) : '',
  ];
  const size = opts.size != null ? ` width="${opts.size}" height="${opts.size}"` : '';
  const label = ctx.label ? `<title>${esc(ctx.label)}</title>` : '';
  // A little headroom, so tall hair and crowns are not cut off at the top; and each adult head is
  // brought to much the same size in the picture (frameFor). A screen may still ask for its own view.
  const fr = frameFor(d.head);
  const box = opts.viewBox ?? `${fr.x} ${fr.y} ${fr.size} ${fr.size}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}"${size} class="character-avatar${opts.className ? ` ${esc(opts.className)}` : ''}" `
    + `role="img" aria-label="${esc(ctx.label ?? 'Portrait')}" style="${colorVars(look, ctx)}">${label}<defs>${defs.join('')}</defs>${layers.join('')}</svg>`;
}

/** The portrait as an element, ready to insert. */
export function createCharacterAvatar(look, ctx = {}, opts = {}) {
  const t = document.createElement('template');
  t.innerHTML = characterAvatarSvg(look, ctx, opts).trim();
  return t.content.firstElementChild;
}

/** A portrait mounted in an element, redrawn with update(). */
export class CharacterAvatar {
  constructor(el, look, ctx = {}, opts = {}) {
    this.el = el;
    this.opts = opts;
    this.update(look, ctx);
  }

  update(look = this.look, ctx = this.ctx) {
    this.look = look;
    this.ctx = ctx;
    this.el.replaceChildren(createCharacterAvatar(look, ctx, this.opts));
    return this;
  }
}

/** Every file a portrait uses, for preloading or caching offline. */
export function filesFor(look, ctx = {}) {
  const d = dressFor(look, ctx);
  const fitted = d.hair ? fittedHairFile(d.hair, d.head) : null;
  return [...(fitted ? [`${AVATAR_BASE}${fitted}`] : []), ...[d.hair, d.head, ...d.makeup, ...d.aging, d.eyes, d.eyebrows, d.nose, d.lips, d.clothes, ...d.jewelry, d.glasses, d.hat, d.crown, d.emotion]
    .filter((id) => id && PART_BY_ID[id]).map((id) => `${AVATAR_BASE}${PART_BY_ID[id].file}`)];
}

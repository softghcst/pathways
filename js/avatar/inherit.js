// Where faces come from: a random face for someone with no known parents,
// and a child's face mixed from two parents.
//
// These are stylised game rules for visible family resemblance, not
// genetics. Only the `inherited` half of a parent is ever read, so a dyed
// or restyled parent passes on what they were born with.
import { rng } from '../rng.js';
import { CATALOG, INHERITED_KEYS, part, stylesFor, normalize, SKIN_TONES, DEPTH, HAIR_STYLES, TWEAKS } from './catalog.js';
import { RESTING, OUTFITS, HAIR_COVERS_FACE } from './curation.js';

const clampDepth = (d) => Math.max(0, Math.min(SKIN_TONES.length - 1, Math.round(d)));
const toneAt = (depth) => SKIN_TONES.find((t) => t.depth === clampDepth(depth)).id;
const weighted = (table) => rng.weighted(Object.keys(table), (k) => table[k]);
const FOLDER = { eyes: 'eyes', brows: 'eyebrows', nose: 'noses', lips: 'lips' };
/** The options a random face is drawn from: resting faces only, never expressions. */
const pool = (key) => (FOLDER[key] ? CATALOG[key].filter((x) => RESTING[FOLDER[key]].includes(x.id)) : CATALOG[key]);

/** A face with no parents to take after. Hair and eye color lean with skin depth. */
export function randomInherited(skinDepthHint) {
  const depth = skinDepthHint == null ? rng.int(0, SKIN_TONES.length - 1) : clampDepth(skinDepthHint + rng.int(-1, 1));
  const g = {};
  for (const key of INHERITED_KEYS) g[key] = rng.pick(pool(key)).id;
  g.skin = toneAt(depth);
  g.hairColor = depth >= DEPTH.bronze ? weighted({ black: 70, dark_brown: 26, brown: 4 })
    : depth >= DEPTH.golden ? weighted({ black: 38, dark_brown: 34, brown: 20, light_brown: 8 })
      : weighted({ black: 8, dark_brown: 20, brown: 24, light_brown: 16, auburn: 6, ginger: 5, dark_blonde: 11, blonde: 10 });
  g.hairTexture = depth >= DEPTH.chestnut ? weighted({ coily: 62, curly: 30, wavy: 8 })
    : depth >= DEPTH.olive ? weighted({ straight: 30, wavy: 30, curly: 28, coily: 12 })
      : weighted({ straight: 46, wavy: 34, curly: 18, coily: 2 });
  g.eyeColor = depth >= DEPTH.tan ? weighted({ dark_brown: 70, brown: 26, hazel: 3, amber: 1 })
    : depth >= DEPTH.sand ? weighted({ dark_brown: 34, brown: 38, hazel: 14, amber: 6, green: 5, gray: 3 })
      : weighted({ dark_brown: 8, brown: 26, hazel: 16, amber: 4, green: 14, blue: 24, gray: 8 });
  // Most faces are as drawn; some have eyes a little wider set, a bigger nose, and so on.
  g.tweaks = Object.fromEntries(TWEAKS.map((k) => [k.id, rng.chance(0.3) ? rng.pick([-1, 1]) : 0]));
  g.marks = [];
  if (depth <= DEPTH.golden && rng.chance(0.14)) g.marks.push(rng.chance(0.3) ? 'dense_freckles' : 'freckles');
  if (rng.chance(0.06)) g.marks.push('beauty_mark');
  return g;
}

/** A first haircut that suits the texture and, loosely, the gender, and something to wear. */
export function defaultStyle(inherited, gender) {
  const suited = stylesFor(inherited.hairTexture).filter((s) => !HAIR_COVERS_FACE.includes(s.id));
  const longOk = rng.chance(0.25);
  const leaning = gender === 'female' ? suited.filter((s) => s.tags.gender !== 'male')
    : gender === 'male' ? suited.filter((s) => s.tags.gender === 'male' && (longOk || s.tags.length !== 'long')) : suited;
  const hairPool = leaning.length && rng.chance(0.88) ? leaning : suited;
  const wardrobe = [...OUTFITS.any, ...(gender === 'female' ? OUTFITS.female : gender === 'male' ? OUTFITS.male : [])];
  return { hair: rng.pick(hairPool.length ? hairPool : HAIR_STYLES).id, hairDye: null, glasses: null, makeup: null, lipColor: null,
    jewelry: [], outfit: rng.pick(wardrobe), outfitColor: null, hat: null };
}

/** A complete appearance for someone with no known parents. */
export function randomAppearance(skinDepthHint, gender) {
  const inherited = randomInherited(skinDepthHint);
  // A man is born with one of the men's mouths, so every one of them turns up (it is drawn to suit a daughter: lipsFor).
  if (gender === 'male') inherited.lips = rng.pick(CATALOG.lips.filter((x) => RESTING.lipsMasc.includes(x.id))).id;
  const style = defaultStyle(inherited, gender);
  if (rng.chance(0.14)) style.glasses = rng.pick(CATALOG.glasses.filter((g) => !/star|visor/.test(g.id))).id;
  // Facial hair has been taken out of the game. The roll that used to choose a man's beard is still made, and its result
  // ignored, so everyone else generated from the same random numbers turns out as before.
  if (gender === 'male' && rng.chance(0.3)) rng.pick([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  if (gender === 'female' && rng.chance(0.35)) style.jewelry = [rng.pick(CATALOG.jewelry.filter((j) => j.tags.kind === 'ears')).id];
  return { v: 3, inherited, style };
}

/**
 * A child's appearance from up to two parents' appearances (any saved
 * version, or missing). Each feature comes from one parent or the other,
 * with a small chance of something neither has. Skin lands between the
 * parents' tones. The result is generated once and saved on the child.
 * `style.hair` is left null: call ensureStyled once the child's gender is known.
 */
export function inheritAppearance(a, b) {
  const one = a ? normalize(a, 'parent-a').inherited : null;
  const two = b ? normalize(b, 'parent-b').inherited : null;
  const depthOf = (g) => part('skin', g.skin).depth;
  const pa = one ?? randomInherited(two ? depthOf(two) : undefined);
  const pb = two ?? randomInherited(depthOf(pa));

  const g = {};
  for (const key of INHERITED_KEYS) {
    g[key] = rng.chance(0.06) ? rng.pick(pool(key)).id : rng.pick([pa[key], pb[key]]);
  }
  // Skin: between the parents, a shade either way now and then.
  const [lo, hi] = [Math.min(depthOf(pa), depthOf(pb)), Math.max(depthOf(pa), depthOf(pb))];
  const between = (depthOf(pa) + depthOf(pb)) / 2 + (rng.chance(0.35) ? rng.pick([-1, 1]) : rng.chance(0.5) ? 0.5 : -0.5) * (lo === hi ? 0.6 : 1);
  g.skin = toneAt(Math.max(lo - 1, Math.min(hi + 1, between)));
  // Hair and eye color and texture never appear from nowhere as often as shapes do.
  for (const key of ['hairColor', 'hairTexture', 'eyeColor']) if (!rng.chance(0.04)) g[key] = rng.pick([pa[key], pb[key]]);
  // Proportions run in families too.
  g.tweaks = Object.fromEntries(TWEAKS.map((k) => [k.id, rng.pick([pa.tweaks?.[k.id] ?? 0, pb.tweaks?.[k.id] ?? 0])]));
  g.marks = CATALOG.marks.map((m) => m.id).filter((id) => {
    const n = (pa.marks?.includes(id) ? 1 : 0) + (pb.marks?.includes(id) ? 1 : 0);
    return rng.chance(n === 2 ? 0.8 : n === 1 ? 0.5 : 0.03);
  });
  return { v: 3, inherited: g, style: { hair: null, hairDye: null, glasses: null, makeup: null, lipColor: null, jewelry: [], outfit: null, outfitColor: null, hat: null } };
}

/** Gives a newly made character a haircut and clothes if they have none yet. Changes and returns the appearance. */
export function ensureStyled(appearance, gender) {
  if (appearance?.inherited && !appearance.style?.hair) {
    const kept = Object.fromEntries(Object.entries(appearance.style ?? {}).filter(([, v]) => v != null && !(Array.isArray(v) && !v.length)));
    appearance.style = { ...defaultStyle(appearance.inherited, gender), ...kept };
  }
  return appearance;
}

/** A copy that shares nothing with the original. */
export const cloneAppearance = (a) => JSON.parse(JSON.stringify(a));

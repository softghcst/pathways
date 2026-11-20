// The character creator: a live appearance editor built on the
// CharacterAvatar artwork. The same editor is used by the character
// creator (every feature), the in-game salon (styling only) and the avatar
// lab page. Each feature has its own row of options, the portrait updates on
// every tap, and nothing is saved until the caller's confirm handler runs.
import { CATALOG, normalize, part, stylesFor, fittedFor, TWEAKS, shownTweaks, lipsFor } from './catalog.js';
import { avatarSvg } from './render.js';
import { randomAppearance, defaultStyle, cloneAppearance } from './inherit.js';
import { rng } from '../rng.js';
import { ELDER_BROWS } from './curation.js';
import { icon } from '../ui/kit.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

// Zoomed views for option thumbnails, in the 512 frame.
const ZOOM = { eyes: '146 214 220 160', brows: '146 196 220 140', nose: '196 290 120 110', lips: '186 336 140 100', glasses: '126 214 260 170',
  makeup: '126 206 260 230', marks: '126 206 260 230', jewelry: '70 220 372 330', outfit: '20 360 472 220', hat: '40 -10 432 380' };

// kind: 'thumb' draws a small portrait for each option; 'swatch' a color dot; 'chip' a word.
// half: which half of the appearance the key lives in. none: the control has a "none" option.
// multi: several can be on at once. minAge: hidden for younger characters.
const CONTROLS = {
  head: { label: 'Face shape', half: 'inherited', kind: 'thumb' },
  skin: { label: 'Skin tone', half: 'inherited', kind: 'swatch' },
  marks: { label: 'Freckles and marks', half: 'inherited', kind: 'thumb', multi: true },
  eyes: { label: 'Eyes', half: 'inherited', kind: 'thumb' },
  eyeColor: { label: 'Eye color', half: 'inherited', kind: 'swatch' },
  brows: { label: 'Eyebrows', half: 'inherited', kind: 'thumb' },
  nose: { label: 'Nose', half: 'inherited', kind: 'thumb' },
  lips: { label: 'Mouth', half: 'inherited', kind: 'thumb' },
  lipColor: { label: 'Lip color', half: 'style', kind: 'swatch', none: 'Natural', minAge: 13 },
  hair: { label: 'Hairstyle', half: 'style', kind: 'thumb', none: 'Shaved', noneId: 'bald', filter: true },
  hairColor: { label: 'Natural hair color', half: 'inherited', kind: 'swatch' },
  hairTexture: { label: 'Natural hair texture', half: 'inherited', kind: 'chip' },
  hairDye: { label: 'Hair dye', half: 'style', kind: 'swatch', none: 'Natural' },
  outfit: { label: 'Outfit', half: 'style', kind: 'thumb' },
  outfitColor: { label: 'Outfit color', half: 'style', kind: 'swatch', none: 'As made' },
  hat: { label: 'Hat', half: 'style', kind: 'thumb', none: 'None' },
  glasses: { label: 'Glasses', half: 'style', kind: 'thumb', none: 'None' },
  jewelry: { label: 'Jewelry', half: 'style', kind: 'thumb', multi: true, minAge: 8 },
  makeup: { label: 'Make-up', half: 'style', kind: 'thumb', none: 'None', minAge: 13 },
};

const TABS = [
  { id: 'face', name: 'Face', keys: ['head', 'skin', 'marks'] },
  { id: 'eyes', name: 'Eyes', keys: ['eyes', 'eyeColor', 'brows'], tweaks: ['eyeGap', 'eyeSize', 'eyeY'] },
  { id: 'features', name: 'Nose and mouth', keys: ['nose', 'lips', 'lipColor'], tweaks: ['noseSize', 'lipSize'] },
  { id: 'hair', name: 'Hair', keys: ['hair', 'hairDye', 'hairColor', 'hairTexture'] },
  { id: 'style', name: 'Clothes', keys: ['outfit', 'outfitColor'] },
  { id: 'extras', name: 'Extras', keys: ['glasses', 'jewelry', 'makeup'] },
];
const HAIR_FILTERS = [['suits', 'Suits my hair'], ['short', 'Short'], ['medium', 'Medium'], ['long', 'Long'], ['updo', 'Up'], ['all', 'All']];
const PREVIEWS = [['now', 'Now'], [1, 'Baby'], [9, 'Child'], [72, 'At 72']];

/**
 * Builds the editor inside `el`.
 * @param {HTMLElement} el
 * @param {{appearance?:object, age?:number, gender?:string, seed?:string, scope?:'all'|'style',
 *          onChange?:(appearance:object)=>void}} o
 *   scope 'style' shows only what a salon can change and leaves inherited features alone.
 * @returns {{get:()=>object, set:(a:object)=>void, randomize:()=>void}}
 */
export function mountAppearanceEditor(el, o = {}) {
  const age = o.age ?? 25;
  const seed = o.seed ?? 'editor';
  const scope = o.scope ?? 'all';
  let a = cloneAppearance(normalize(o.appearance, seed));
  let preview = 'now';
  let hairFilter = 'suits';
  const usable = (key) => (scope === 'all' || CONTROLS[key].half === 'style') && age >= (CONTROLS[key].minAge ?? 0);
  // scope 'tweaks' is the surgeon's: only proportions, and they are worn rather than born with.
  const tabs = scope === 'tweaks' ? [{ id: 'shape', name: 'Proportions', keys: [], tweaks: TWEAKS.map((k) => k.id) }]
    : TABS.map((t) => ({ ...t, keys: t.keys.filter(usable) })).filter((t) => t.keys.length);
  const tw = () => a.inherited.tweaks;
  if (scope === 'style') tabs.sort((x, y) => (y.id === 'hair') - (x.id === 'hair')); // a salon starts with the hair
  let tab = tabs[0].id;

  const draw = (appearance, opts = {}) => avatarSvg({ appearance, age: opts.age ?? age, gender: o.gender, seed, mood: 66, viewBox: opts.viewBox, label: opts.label });
  const withValue = (key, value) => {
    const next = cloneAppearance(a);
    const c = CONTROLS[key];
    if (c.multi) next[c.half][key] = value == null ? [] : [value];
    else next[c.half][key] = value;
    // A thumbnail for a hat shows the hat; for glasses, make-up or jewelry, nothing hides it.
    if (key !== 'hat') next.style.hat = null;
    return next;
  };
  const optionsFor = (key) => {
    let list = CATALOG[key];
    if (key === 'hair') {
      if (hairFilter === 'suits') list = [...stylesFor(a.inherited.hairTexture), ...fittedFor(a.inherited.hairTexture)];
      else if (hairFilter !== 'all') list = list.filter((h) => h.tags.length === hairFilter);
    }
    // Mouths are drawn to suit the person's gender (lipsFor), so only the ones that can be drawn for them are offered.
    if (key === 'lips') list = list.filter((x) => lipsFor(x.id, o.gender) === x.id);
    // The bushy brows of old age are an old man's.
    if (key === 'brows' && o.gender === 'female') list = list.filter((x) => x.id !== ELDER_BROWS);
    return list;
  };

  function control(key) {
    const c = CONTROLS[key];
    const current = a[c.half][key];
    const shown = key === 'lips' ? lipsFor(current, o.gender) : current;
    const isOn = (id) => (c.multi ? current.includes(id) : shown === id);
    const zoom = ZOOM[key];
    const options = optionsFor(key).map((x) => {
      const on = isOn(x.id) ? 'on' : '';
      if (c.kind === 'swatch') return `<button type="button" class="av-opt av-swatch ${on}" data-key="${key}" data-id="${x.id}" style="background:${x.hex}" aria-label="${esc(x.name)}" title="${esc(x.name)}" aria-pressed="${!!on}"></button>`;
      if (c.kind === 'chip') return `<button type="button" class="av-opt av-chip ${on}" data-key="${key}" data-id="${x.id}" aria-pressed="${!!on}">${esc(x.name)}</button>`;
      return `<button type="button" class="av-opt av-thumb ${on}" data-key="${key}" data-id="${x.id}" aria-label="${esc(x.name)}" title="${esc(x.name)}" aria-pressed="${!!on}">${draw(withValue(key, x.id), { viewBox: zoom })}<span>${esc(x.name)}</span></button>`;
    });
    if (c.none) {
      const on = current == null || current === c.noneId ? 'on' : '';
      const id = c.noneId ?? '';
      options.unshift(c.kind === 'thumb'
        ? `<button type="button" class="av-opt av-thumb ${on}" data-key="${key}" data-id="${id}" aria-pressed="${!!on}">${draw(withValue(key, c.noneId ?? null), { viewBox: zoom })}<span>${esc(c.none)}</span></button>`
        : `<button type="button" class="av-opt av-chip ${on}" data-key="${key}" data-id="${id}" aria-pressed="${!!on}">${esc(c.none)}</button>`);
    }
    const chosen = c.multi ? current.map((id) => part(key, id)?.name).filter(Boolean).join(', ') : part(key, current)?.name ?? c.none ?? '';
    const filters = c.filter ? `<div class="av-filters">${HAIR_FILTERS.map(([id, label]) => `<button type="button" class="av-chip av-filter ${hairFilter === id ? 'on' : ''}" data-filter="${id}">${esc(label)}</button>`).join('')}</div>` : '';
    return `<div class="av-control"><div class="av-label"><strong>${esc(c.label)}</strong><span>${esc(chosen)}</span></div>${filters}
      <div class="av-options ${c.kind}">${options.join('')}</div></div>`;
  }

  /** A five-step adjuster for one proportion: two steps either side of "as drawn". */
  function tweakControl(id) {
    const k = TWEAKS.find((x) => x.id === id);
    const now = tw()[id];
    const labels = [`${k.low} still`, k.low, 'Normal', k.high, `${k.high} still`];
    return `<div class="av-control"><div class="av-label"><strong>${esc(k.name)}</strong><span>${esc(labels[now + 2])}</span></div>
      <div class="av-steps" role="group" aria-label="${esc(k.name)}">${[-2, -1, 0, 1, 2].map((v) => `<button type="button" class="av-chip av-step ${v === now ? 'on' : ''}" data-tweak="${id}" data-val="${v}" aria-pressed="${v === now}" aria-label="${esc(labels[v + 2])}">${v === 0 ? 'Normal' : v < 0 ? '−'.repeat(-v) : '+'.repeat(v)}</button>`).join('')}</div></div>`;
  }

  function render() {
    const t = tabs.find((x) => x.id === tab);
    const shownAge = preview === 'now' ? age : preview;
    el.innerHTML = `
      <div class="av-editor">
        <div class="av-stage">
          <div class="av-portrait" data-portrait>${draw(a, { age: shownAge, label: 'Your portrait' })}</div>
          <div class="av-previews" role="group" aria-label="See the face at another age">${PREVIEWS.map(([v, label]) => `<button type="button" class="av-chip av-preview ${preview === v ? 'on' : ''}" data-preview="${v}">${esc(label)}</button>`).join('')}</div>
          <button type="button" class="btn small av-random" data-random>${icon('sparkle')}Randomize</button>
        </div>
        <div class="av-tabs" role="tablist">${tabs.map((x) => `<button type="button" role="tab" aria-selected="${x.id === tab}" class="av-tab ${x.id === tab ? 'on' : ''}" data-tab="${x.id}">${esc(x.name)}</button>`).join('')}</div>
        <div class="av-panel">${t.keys.map(control).join('')}${scope !== 'style' ? (t.tweaks ?? []).map(tweakControl).join('') : ''}</div>
      </div>`;
  }
  const keepScroll = (fn) => {
    const scroll = el.querySelector('.av-panel')?.scrollTop ?? 0;
    fn();
    const panel = el.querySelector('.av-panel');
    if (panel) panel.scrollTop = scroll;
  };

  el.onclick = (e) => {
    const tabBtn = e.target.closest('[data-tab]');
    if (tabBtn) { tab = tabBtn.dataset.tab; render(); return; }
    if (e.target.closest('[data-random]')) { api.randomize(); return; }
    const pv = e.target.closest('[data-preview]');
    if (pv) { preview = pv.dataset.preview === 'now' ? 'now' : Number(pv.dataset.preview); keepScroll(render); return; }
    const f = e.target.closest('[data-filter]');
    if (f) { hairFilter = f.dataset.filter; keepScroll(render); return; }
    const twBtn = e.target.closest('[data-tweak]');
    if (twBtn) { a.inherited.tweaks[twBtn.dataset.tweak] = Number(twBtn.dataset.val); keepScroll(render); o.onChange?.(cloneAppearance(a)); return; }
    const opt = e.target.closest('.av-opt');
    if (!opt) return;
    const key = opt.dataset.key;
    const c = CONTROLS[key];
    const id = opt.dataset.id || null;
    if (c.multi) {
      const list = a[c.half][key];
      a[c.half][key] = id == null ? [] : list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
    } else a[c.half][key] = id;
    keepScroll(render);
    o.onChange?.(cloneAppearance(a));
  };

  const api = {
    get: () => cloneAppearance(a),
    set: (next) => { a = cloneAppearance(normalize(next, seed)); render(); },
    randomize() {
      if (scope === 'tweaks') a.inherited.tweaks = Object.fromEntries(TWEAKS.map((k) => [k.id, rng.pick([-1, 0, 0, 1])]));
      else if (scope === 'all') a = normalize(randomAppearance(undefined, o.gender), seed);
      else {
        a.style = { ...defaultStyle(a.inherited, o.gender), jewelry: a.style.jewelry };
        if (rng.chance(0.3)) a.style.hairDye = rng.pick(CATALOG.hairDye).id;
        if (rng.chance(0.25)) a.style.glasses = rng.pick(CATALOG.glasses).id;
        if (rng.chance(0.3)) a.style.outfitColor = rng.pick(CATALOG.outfitColor).id;
      }
      render();
      o.onChange?.(cloneAppearance(a));
    },
  };
  render();
  return api;
}

/**
 * Opens the editor over the whole screen and resolves with the confirmed
 * appearance, or null if the player backs out.
 * @param {{title?:string, appearance?:object, age?:number, gender?:string, seed?:string, scope?:'all'|'style',
 *          note?:(appearance:object)=>string, confirm?:string}} o
 *   note: a line shown above the buttons, recomputed on every change (the salon uses it for the bill).
 */
export function openAppearanceEditor(o = {}) {
  return new Promise((resolve) => {
    const root = document.createElement('div');
    root.className = 'av-screen';
    root.innerHTML = `
      <div class="av-sheet" role="dialog" aria-modal="true" aria-label="${esc(o.title ?? 'Appearance')}">
        <h2>${esc(o.title ?? 'Appearance')}</h2>
        <div data-editor></div>
        <p class="av-note muted" data-note></p>
        <div class="btn-row">
          <button type="button" class="btn" data-cancel>Cancel</button>
          <button type="button" class="btn primary" data-confirm>${esc(o.confirm ?? 'Confirm appearance')}</button>
        </div>
      </div>`;
    document.body.appendChild(root);
    const note = root.querySelector('[data-note]');
    const showNote = (a) => { note.textContent = o.note ? o.note(a) : ''; note.hidden = !note.textContent; };
    const editor = mountAppearanceEditor(root.querySelector('[data-editor]'), { ...o, onChange: showNote });
    showNote(editor.get());
    const done = (value) => { root.remove(); resolve(value); };
    root.querySelector('[data-cancel]').addEventListener('click', () => done(null));
    root.querySelector('[data-confirm]').addEventListener('click', () => done(editor.get()));
  });
}

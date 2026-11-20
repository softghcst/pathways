// The avatar lab (avatar-lab.html): a page for working on avatar artwork
// outside the game. It shows the live editor, a family whose children are
// generated from two parents, and every part in the catalog with its id.
import { CATALOG, normalize, part, DEPTH } from './catalog.js';
import { avatarSvg } from './render.js';
import { mountAppearanceEditor } from './editor.js';
import { randomAppearance, inheritAppearance, ensureStyled, cloneAppearance } from './inherit.js';
import { rng } from '../rng.js';

const KEY = 'pathways.avatarLab';
const $ = (sel) => document.querySelector(sel);
const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
rng.seed((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);

// ---------- 1. The editor ----------
const editor = mountAppearanceEditor($('#editor'), { appearance: randomAppearance(), age: 28, seed: 'lab' });
$('#editor-json').addEventListener('click', () => { $('#json').textContent = JSON.stringify(editor.get(), null, 2); });

// ---------- 2. A family ----------
/** Two parents who look as unlike each other as the catalog allows, one with dyed hair. */
function newFamily() {
  const mother = randomAppearance(rng.int(DEPTH.porcelain, DEPTH.sand), 'female');
  const father = randomAppearance(rng.int(DEPTH.bronze, DEPTH.espresso), 'male');
  for (const key of ['head', 'eyes', 'brows', 'nose', 'lips']) {
    while (father.inherited[key] === mother.inherited[key]) father.inherited[key] = rng.pick(CATALOG[key]).id;
  }
  mother.style.hairDye = rng.pick(['pink', 'blue', 'purple', 'teal', 'red']);
  const child = (gender, age) => ({ gender, age, appearance: ensureStyled(inheritAppearance(mother, father), gender) });
  return { people: [{ label: 'Mother', gender: 'female', age: 38, appearance: mother }, { label: 'Father', gender: 'male', age: 40, appearance: father },
    { label: 'Child, 9', ...child('female', 9) }, { label: 'Child, 16', ...child('male', 16) }] };
}

const FEATURES = [['head', 'Face'], ['skin', 'Skin'], ['eyes', 'Eyes'], ['eyeColor', 'Eye color'], ['brows', 'Brows'], ['nose', 'Nose'],
  ['lips', 'Lips'], ['hairColor', 'Natural hair'], ['hairTexture', 'Texture']];

function showFamily(family, note = '') {
  const [mom, dad, ...kids] = family.people;
  const m = normalize(mom.appearance).inherited;
  const d = normalize(dad.appearance).inherited;
  const card = (person, i) => {
    const a = normalize(person.appearance);
    const rows = FEATURES.map(([key, label]) => {
      const id = a.inherited[key];
      const from = i < 2 ? '' : id === m[key] && id === d[key] ? 'both' : id === m[key] ? 'mother' : id === d[key] ? 'father' : key === 'skin' ? 'between' : 'new';
      return `<tr><td>${label}</td><td>${esc(part(key, id).name)}</td><td class="from ${from}">${from}</td></tr>`;
    }).join('');
    return `<div class="person"><div class="face">${avatarSvg({ appearance: a, age: person.age, gender: person.gender, seed: `lab-${i}` })}</div>
      <h3>${esc(person.label)}</h3>
      <p>Wearing: ${esc(part('hair', a.style.hair)?.name ?? 'Shaved')}${a.style.hairDye ? `, dyed ${esc(part('hairDye', a.style.hairDye).name.toLowerCase())}` : ''}</p>
      <table>${rows}</table></div>`;
  };
  $('#family').innerHTML = family.people.map(card).join('');
  $('#family-note').textContent = note;
  // The same four people at the size used in the game's menus.
  $('#family-small').innerHTML = [mom, dad, ...kids].map((x, i) => `<div class="menu-face">${avatarSvg({ appearance: x.appearance, age: x.age, seed: `lab-${i}` })}</div>`).join('');
}

let family = newFamily();
showFamily(family);
$('#family-new').addEventListener('click', () => { family = newFamily(); showFamily(family); });
$('#family-dye').addEventListener('click', () => {
  // Restyle both parents. The children must not change.
  const before = JSON.stringify(family.people.slice(2).map((x) => x.appearance));
  family.people[0].appearance.style.hairDye = rng.pick(CATALOG.hairDye).id;
  family.people[0].appearance.style.hair = rng.pick(CATALOG.hair).id;
  family.people[1].appearance.style.hairDye = rng.pick(['silver', 'green', 'blue']);
  const same = before === JSON.stringify(family.people.slice(2).map((x) => x.appearance));
  showFamily(family, `Both parents were restyled. Children unchanged: ${same ? 'yes' : 'NO'}.`);
});
$('#family-child').addEventListener('click', () => {
  const [mom, dad] = family.people;
  const gender = rng.pick(['female', 'male']);
  family.people.push({ label: `Child, ${family.people.length + 2}`, gender, age: rng.int(4, 17), appearance: ensureStyled(inheritAppearance(mom.appearance, dad.appearance), gender) });
  showFamily(family, 'A new child, mixed from what the parents were born with (their dye and haircuts are ignored).');
});
$('#family-save').addEventListener('click', () => {
  // Round-trips the family through storage, as the game's saves do.
  const before = JSON.stringify(family);
  localStorage.setItem(KEY, before);
  family = JSON.parse(localStorage.getItem(KEY));
  showFamily(family, `Saved and loaded again. Identical: ${JSON.stringify(family) === before ? 'yes' : 'NO'}.`);
});

// ---------- 3. Every part ----------
const base = normalize({ v: 3, inherited: { head: 'head_17_dimple_oval', skin: 'sand', eyes: 'eyes_10', eyeColor: 'brown', brows: 'brows_10', nose: 'nose_10', lips: 'lips_10',
  hairColor: 'dark_brown', hairTexture: 'straight', marks: [] }, style: { hair: 'bald', outfit: 'outfit_01_tee' } }, 'sheet');
const STYLE = new Set(['hair', 'hairDye', 'glasses', 'makeup', 'lipColor', 'jewelry', 'outfit', 'outfitColor', 'hat']);
$('#parts').innerHTML = Object.entries(CATALOG).map(([key, list]) => `
  <h3>${esc(key)} <small>${list.length} parts</small></h3>
  <div class="sheet">${list.map((x) => {
    const a = cloneAppearance(base);
    if (key === 'marks') a.inherited.marks = [x.id];
    else if (key === 'jewelry') a.style.jewelry = [x.id];
    else a[STYLE.has(key) ? 'style' : 'inherited'][key] = x.id;
    if (['hairDye', 'hairColor', 'hairTexture'].includes(key)) a.style.hair = 'hair_girl_long_01';
    return `<figure><div class="face">${avatarSvg({ appearance: a, age: 28, seed: 'sheet' })}</div><figcaption>${esc(x.name)}<code>${esc(x.id)}</code></figcaption></figure>`;
  }).join('')}</div>`).join('');

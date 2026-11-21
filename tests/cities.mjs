// Checks cities and regions: profiles, prices and pay, regional law, moving. Run with: node tests/cities.mjs
import { ROOTS } from '../js/data/economy.js';
import { store } from '../js/state.js';
import { rng } from '../js/rng.js';
import { createLife } from '../js/engine/characterGen.js';
import { advanceYear } from '../js/engine/yearProcessor.js';
import { COUNTRIES, COUNTRY_LIST } from '../js/data/countries.js';
import { CITY_ROWS, REGION_WORD } from '../js/data/cities.js';
import { REGION_RULES, RULES } from '../js/data/rules.js';
import { CAREERS } from '../js/data/careers.js';
import * as towns from '../js/engine/cities.js';
import * as law from '../js/engine/rules.js';
import * as estate from '../js/engine/realEstate.js';
import { hire } from '../js/engine/career.js';
import { emigrate } from '../js/engine/emigration.js';
import { profile } from '../js/engine/world.js';

rng.seed(5150);
ROOTS.parentFromAbroad = 0; // these checks are about plain families; families with roots abroad are tested in world-scenarios.mjs
const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => { if (!problems.length) ok.push(msg); };
const life = (id, city, age = 30) => { do { store.state = createLife({ countryId: id, city }); } while (store.state.player.royal); const p = store.state.player; p.age = age; p.birthYear = store.state.year; store.state.year += age;
  p.finance.cash = Math.round(2e6 * COUNTRIES[id].currency.scale); p.flags.livesWithParents = false; p.education.enrolled = false; p.education.degrees = [{ type: 'high', gpa: 3, age: 18 }, { type: 'university', majorId: 'business', gpa: 3.2, age: 22 }]; return p; };
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

// 1. Data: every hand-written row names a real city; every region with its own law has a city.
for (const [id, rows] of Object.entries(CITY_ROWS)) {
  check(!!COUNTRIES[id] && !!REGION_WORD[id], `city rows for an unknown place, or one with no word for its regions: ${id}`);
  for (const name of COUNTRIES[id].cities) check(!!rows[name], `${id}: ${name} has no row, though its neighbors do`);
  for (const [name, r] of Object.entries(rows)) {
    check(COUNTRIES[id].cities.includes(name), `${id}: row for a city that is not in the game: ${name}`);
    check(r.housing >= 0.4 && r.housing <= 2.2 && r.pay >= 0.7 && r.pay <= 1.4 && r.region && r.regionId, `${id}/${name}: out of range`);
  }
}
for (const [key, o] of Object.entries(REGION_RULES)) {
  const [place, region] = key.split('/');
  check(Object.values(CITY_ROWS[place] ?? {}).some((r) => r.regionId === region) || (region.startsWith('around:') && COUNTRIES[place]?.cities.includes(region.slice(7))), `regional law for a region with no city: ${key}`);
  for (const id of Object.keys(o)) check(!!RULES[id], `${key}: unknown rule ${id}`);
}
section('data: twelve countries have a row per city; every regional law belongs to a region with a city');

// 2. Every city anywhere has a usable profile.
let n = 0;
for (const c of COUNTRY_LIST) for (const k of towns.citiesOf(c.id)) { n += 1; check(k.housing > 0 && k.pay > 0 && k.housingWord && k.payWord && towns.cityLine(c.id, k.name).length > 5, `${c.id}/${k.name}: no profile`); }
check(towns.cityOf('sg', 'Singapore').housing === 1, 'a one-city place is its own average');
check(towns.cityOf('ke', COUNTRIES.ke.place.capital).kind === 'capital' && towns.cityOf('ke', COUNTRIES.ke.place.capital).estimated, 'elsewhere the capital gets the generic capital profile, and says it is an estimate');
check(profile('ca').cityLines.length === COUNTRIES.ca.cities.length && profile('ca').cityLines.every(([, l]) => /^(Capital · )?[A-Za-z ]+ Homes · [A-Za-z ]+ Pay$/.test(l)), 'the world explorer lists every city, briefly: homes and pay');
section(`profiles: all ${n} cities have one`);

// 3. Homes and pay follow the city.
const priceIn = (id, city) => { life(id, city); const all = []; for (let i = 0; i < 60; i++) { store.state.market.listings = null; for (const l of estate.listings()) all.push(l.price); } all.sort((a, b) => a - b); return all[Math.floor(all.length / 2)]; }; // the median: one mansion does not move it
const ny = priceIn('us', 'New York'); const atl = priceIn('us', 'Atlanta');
check(ny / atl > 1.4 && ny / atl < 2.8, `homes in New York cost far more than in Atlanta (ratio ${(ny / atl).toFixed(2)})`);
const payIn = (id, city) => { const all = []; for (let i = 0; i < 100; i++) { const p = life(id, city); hire(CAREERS.find((c) => c.id === 'office'), 0, 60); all.push(p.career.salary); } return mean(all); };
const ldn = payIn('uk', 'London'); const car = payIn('uk', 'Cardiff');
check(ldn / car > 1.2 && ldn / car < 1.5, `the same job pays more in London than in Cardiff (ratio ${(ldn / car).toFixed(2)})`);
section('money: listings and salaries follow the city');

// 4. The law of the region.
let p = life('us', 'Austin'); check(law.rule('deathPenalty') === true, 'Texas keeps the death penalty');
p = life('us', 'Chicago'); check(law.rule('deathPenalty') === false && law.source('deathPenalty').source === 'region', 'Illinois does not');
check(law.rule('deathPenalty', 'us', { region: null }) === true, 'the national answer is unchanged');
p = life('ca', 'Montreal', 18); check(law.may('drink').ok, 'eighteen-year-olds drink in Quebec'); p = life('ca', 'Toronto', 18); check(!law.may('drink').ok, 'and not in Ontario');
p = life('ae', 'Sharjah'); check(!law.may('drink').ok, 'no alcohol in Sharjah'); p = life('ae', 'Dubai'); check(law.may('drink').ok, 'but there is in Dubai');
section('law: a region overrides its country for the people who live there');

// 5. Moving within the country.
p = life('us', 'Atlanta'); hire(CAREERS.find((c) => c.id === 'office'), 0, 60);
const cash = p.finance.cash; const jobs = p.counters.jobsHeld; const papers = JSON.stringify([p.citizenships, p.residency]);
check(towns.moveOptions().length === 6 && towns.moveOptions().every((o) => o.versus && o.line), 'six other cities are offered, each compared with home');
let r = towns.relocate('Seattle');
check(r.ok && p.city === 'Seattle' && p.countryId === 'us' && p.finance.cash === cash - towns.moveCost(), 'the move happens and costs what it said');
check(JSON.stringify([p.citizenships, p.residency]) === papers, 'papers do not change: it is the same country');
check(p.locations.at(-1).city === 'Seattle' && p.locations.at(-2).to === store.state.year, 'the move is in the record of where they have lived');
check(r.quit ? !p.career.careerId : !!p.career.careerId && p.counters.jobsHeld === jobs, 'the job either transfers or ends');
check(/laws are different in Washington/.test(r.text), 'the result says the law has changed');
check(towns.moveOptions().find((o) => o.name === 'Austin').lawDiffers && towns.moveOptions().find((o) => o.name === 'Chicago').lawDiffers && !towns.moveOptions().find((o) => o.name === 'New York').lawDiffers, 'only real differences in law are flagged (Washington and New York: no death penalty, casinos from 18)');
check(!towns.relocate('Seattle').ok && !towns.relocate('Paris').ok, 'no moving to where you are, or to another country');
let kept = 0; let lost = 0;
for (let i = 0; i < 60; i++) { p = life('de', 'Leipzig'); hire(CAREERS.find((c) => c.id === 'office'), 0, 60); const before = p.career.salary; r = towns.relocate('Munich'); if (r.quit) lost += 1; else { kept += 1; check(p.career.salary > before, 'a transferred salary moves to the going rate'); } }
check(kept > 10 && lost > 10, `some employers transfer and some do not (${kept} kept, ${lost} lost)`);
// A home in the old city.
p = life('fr', 'Lyon'); const l = estate.listings()[0]; estate.buyProperty(l.id, l.price); const home = p.assets.find((a) => a.kind === 'property'); estate.moveIn(home.id);
check(p.homeId === home.id, 'bought and moved in'); const was = home.value;
towns.relocate('Paris');
check(p.homeId == null && p.assets.includes(home), 'after moving city the house is still owned, and no longer home');
check(!estate.moveIn(home.id).ok, 'and cannot be lived in from another city');
for (let i = 0; i < 2; i++) { advanceYear(); store.state.pendingEvents = []; p.legal.pending = null; }
// Lyon's own market can fall a long way in two years (a crash is fair); what must not happen is Paris prices.
check(home.city === 'Lyon' && home.value / was < 1.35, `it keeps the value of the city it is in, not the one its owner lives in (${home.city}, ${(home.value / was).toFixed(2)})`);
p = life('uk', 'Leeds', 15); check(!!towns.moveBlock(), 'children do not move on their own');
// Emigrating to a chosen city.
p = life('br', 'Recife'); for (let i = 0; i < 40 && p.countryId === 'br'; i++) { p.flags.visaAge = null; emigrate('ca', { city: 'Calgary' }); }
check(p.countryId === 'ca' && p.city === 'Calgary', 'an emigrant arrives in the city they chose');
section('moving: cost, record, job, home, and the city chosen when emigrating');

// 6. Safety, schools and hospitals follow the kind of city.
{
  const { careQuality } = await import('../js/engine/living.js');
  const { SERVICES } = await import('../js/data/cities.js');
  for (const c of COUNTRY_LIST) for (const k of towns.citiesOf(c.id)) {
    check([k.safety, k.schools, k.health].every((v) => Number.isFinite(v) && Math.abs(v) <= 10), `${c.id}/${k.name}: services out of range`);
  }
  const cap = towns.cityOf('fr', 'Paris'); const small = towns.cityOf('fr', 'Nantes');
  check(cap.health > small.health && cap.safety < small.safety && cap.schools >= small.schools, 'the capital has the big hospitals and more crime; a smaller city is safer');
  check(/major hospitals/.test(cap.servicesLine) && /safer/.test(small.servicesLine), 'and each city\'s profile says so');
  check(towns.cityLine('fr', 'Paris') === 'Capital · ' + cap.housingWord + ' · ' + cap.payWord, `the city line itself stays short (${towns.cityLine('fr', 'Paris')})`);
  check(towns.cityOf('sg', 'Singapore').health === 0 && towns.cityOf('sg', 'Singapore').safety === 0, 'a one-city place is its own average');
  let p = life('fr', 'Paris'); p.finance.cash = 0; const there = careQuality();
  p.city = 'Nantes'; const here = careQuality();
  check(there > here, `the care within reach is better in Paris than in Nantes (${there} against ${here})`);
  check(towns.localScore('safety', { safety: 99 }) <= 100 && towns.localScore('safety', { safety: 1 }) >= 0, 'scores stay within 0 to 100');
  check(Object.values(SERVICES).every((v) => Math.abs(v.safety) <= 5 && Math.abs(v.health) <= 10), 'the city effect is modest next to the differences between countries');
  section('services: safety, schools and hospitals vary by kind of city, modestly, and reach the game');
}

if (problems.length) { console.log('PROBLEMS:'); for (const x of problems) console.log(' -', x); process.exit(1); }
for (const x of ok) console.log('ok  ', x);
console.log('Cities and regions hold.');

// Checks tax schedules and health-care models. Run with: node tests/systems.mjs
import { store } from '../js/state.js';
import { rng } from '../js/rng.js';
import { createLife } from '../js/engine/characterGen.js';
import { advanceYear } from '../js/engine/yearProcessor.js';
import { COUNTRIES, COUNTRY_LIST } from '../js/data/countries.js';
import { CAREERS } from '../js/data/careers.js';
import { TAX_SHAPES, TAX_SHAPE_OF, HEALTH_MODELS, HEALTH_MODEL_OF } from '../js/data/systems.js';
import * as sys from '../js/engine/systems.js';
import { incomeTax } from '../js/engine/finance.js';
import { careCost } from '../js/engine/medical.js';
import { hire, quitCareer } from '../js/engine/career.js';
import { profile } from '../js/engine/world.js';

rng.seed(1984);
const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => { if (!problems.length) ok.push(msg); };
const life = (id, age = 30) => { do { store.state = createLife({ countryId: id }); } while (store.state.player.royal); const p = store.state.player; p.age = age; p.birthYear = store.state.year; store.state.year += age;
  p.flags.livesWithParents = false; p.education.enrolled = false; p.education.degrees = [{ type: 'high', gpa: 3, age: 18 }]; p.finance.cash = Math.round(2e5 * COUNTRIES[id].currency.scale); p.career.careerId = null; p.career.salary = 0; p.career.partTime = null; p.legal.incarceration = null; return p; };
const job = () => hire(CAREERS.find((c) => c.id === 'office'), 0, 60);

// 1. Tables.
for (const [id, s] of Object.entries(TAX_SHAPES)) { check(s.bands.at(-1)[0] === Infinity && s.bands.every(([u], i) => i === 0 || u > s.bands[i - 1][0]), `tax shape ${id}: bands must rise and end open`); check(s.bands.every(([, k], i) => i === 0 || k >= s.bands[i - 1][1]), `tax shape ${id}: rates must not fall`); }
for (const [id, s] of Object.entries(TAX_SHAPE_OF)) check(!!COUNTRIES[id] && !!TAX_SHAPES[s], `tax shape for an unknown place or of an unknown kind: ${id}`);
for (const [id, m] of Object.entries(HEALTH_MODEL_OF)) check(!!COUNTRIES[id] && !!HEALTH_MODELS[m], `health model for an unknown place or of an unknown kind: ${id}`);
for (const m of Object.values(HEALTH_MODELS)) check(m.share >= 0 && m.share <= 1 && m.uncovered >= m.share && ['everyone', 'workers', 'buyers'].includes(m.covers), `health model ${m.name} is malformed`);
section('tables: shapes and models are well formed and name real places');

// 2. Income tax, everywhere: never more than income, never falling as income rises, continuous, fair to the low paid.
life('us');
for (const c of COUNTRY_LIST) {
  const T = sys.typicalWage(c);
  let last = 0; let lastNet = 0;
  for (const m of [0, 0.1, 0.25, 0.5, 1, 1.5, 2, 3, 5, 8, 12, 30, 100]) {
    const g = Math.round(T * m); const b = sys.taxBreakdown(g, c);
    check(b.tax >= last && b.tax <= g && g - b.tax >= lastNet, `${c.id}: tax or take-home goes the wrong way at ${m} times the typical wage`);
    check(b.tax === b.bands.reduce((s, x) => s + x.taxed * x.rate, 0) || Math.abs(b.tax - b.bands.reduce((s, x) => s + x.taxed * x.rate, 0)) < 1, `${c.id}: the bands do not add up`);
    check(b.marginal <= 0.65 + 1e-9, `${c.id}: marginal rate above the cap`);
    last = b.tax; lastNet = g - b.tax;
  }
  const one = sys.taxBreakdown(T + 1, c).tax - sys.taxBreakdown(T, c).tax; check(one >= 0 && one <= 1, `${c.id}: a jump in tax for one more unit earned`);
  const eff = sys.taxBreakdown(T, c).effective;
  if (c.incomeTax > 0) check(eff > c.incomeTax * 0.55 && eff <= c.incomeTax * 1.01, `${c.id}: at a typical wage the rate is near the headline (${eff.toFixed(3)} against ${c.incomeTax})`); else check(eff === 0, `${c.id}: no income tax means none`);
  check(incomeTax(T, c) === sys.taxBreakdown(T, c).tax && sys.taxLine(c).length > 5, `${c.id}: the money engine uses the schedule`);
}
section(`income tax: ${COUNTRY_LIST.length} countries, monotonic, continuous, near the headline rate at a typical wage`);

// 3. The shapes differ in the way their names say.
const eff = (id, m) => sys.taxBreakdown(sys.typicalWage(COUNTRIES[id]) * m, COUNTRIES[id]).effective / COUNTRIES[id].incomeTax;
check(eff('fr', 10) > eff('fr', 1) && eff('us', 10) > eff('us', 1) && Math.abs(eff('hu', 10) - eff('hu', 1)) < 1e-6, 'banded taxes take a larger share of a large income; a flat tax does not');
{ const { TAX_TOP } = await import('../js/data/systems.js'); for (const id of ['de', 'nl', 'cn', 'cl', 'uk']) check(Math.abs(sys.taxBreakdown(sys.typicalWage(COUNTRIES[id]) * 200, COUNTRIES[id]).marginal - TAX_TOP[id]) < 1e-9, `${id}: the top band is the country's published top rate`); }
check(Math.abs(eff('hu', 0.3) - eff('hu', 30)) < 1e-6, 'a flat tax is the same share of any income');
check(eff('fr', 0.3) < eff('fr', 1) && eff('us', 0.3) < eff('us', 1), 'the low paid pay a smaller share where bands rise');
check(sys.taxBreakdown(1e9, COUNTRIES.ae).tax === 0 && /No income tax/.test(sys.taxLine(COUNTRIES.ae)), 'the United Arab Emirates takes nothing');
check(profile('de').game.some(([k, v]) => k === 'How income is taxed' && /^About \d+%, up to \d+%$/.test(v)) && /flat/.test(sys.taxLine(COUNTRIES.hu)) && profile('us').game.some(([k, v]) => k === 'Health care' && /Private insurance/.test(v)), 'the world explorer says how each works, briefly');
section('shapes: steep, rising, flat and none behave as named');

// 4. Health care: who is covered, and what they pay.
let p = life('us'); let k = sys.cover();
check(!k.covered && k.share === 1 && k.canBuy && k.price > 0, 'United States, no job, no cover: the whole bill');
const full = careCost(1000);
job(); k = sys.cover(); check(k.covered && k.share === 0.2 && k.premium === 0 && careCost(1000) === Math.round(full * 0.2), 'a full-time job brings cover: a fifth of the bill');
quitCareer(); const cash = p.finance.cash; let r = sys.setCover(true); k = sys.cover();
check(r.ok && k.covered && k.bought && p.finance.cash === cash - k.premium && careCost(1000) === Math.round(full * 0.2), 'or cover can be bought, at a price');
p.flags.coverPaidAge = null; const c2 = p.finance.cash; sys.tickCover(); check(p.finance.cash === c2 - k.premium, 'the premium is charged each year');
p.finance.cash = 5; p.flags.coverPaidAge = null; sys.tickCover(); check(!sys.cover().covered && p.finance.cash === 5, 'cover that cannot be paid for lapses, and takes nothing');
p.age = 10; check(sys.cover().covered, 'children are covered'); p.age = 30;
p.legal.incarceration = { yearsLeft: 2 }; check(careCost(1000) === 0, 'prison care is free'); p.legal.incarceration = null;
p = life('uk'); check(sys.cover().covered && sys.cover().premium === 0 && careCost(1000) < full, 'United Kingdom: covered, no premium');
p = life('de'); k = sys.cover(); check(k.covered && k.share === 0.2 && k.premium > 0 && !k.canBuy, 'Germany: everyone insured, a contribution and a share of each bill');
const c3 = p.finance.cash; sys.tickCover(); check(p.finance.cash === c3, 'no contribution from someone with no income'); job(); p.flags.coverPaidAge = null; const c4 = p.finance.cash; sys.tickCover(); check(p.finance.cash === c4 - sys.cover().premium, 'and one from someone who earns');
p = life('ae'); check(sys.cover().covered && /citizen/.test(sys.cover().how), 'an Emirati is covered by the national scheme, job or no job');
p = life('in'); p.countryId = 'ae'; check(!sys.cover().covered && !sys.cover().canBuy, 'an expatriate in the United Arab Emirates without a job: no cover, and none to buy'); job(); check(sys.cover().covered, 'with one: covered');
p = life('mx'); check(sys.cover().share === 0.4, 'Mexico: public clinics, and a good part paid by the patient');
p = life('us'); sys.setCover(true); p.countryId = 'ca'; sys.tickCover(); check(!p.flags.healthCover, 'private cover does not travel: it ends on moving abroad');
// On a visa: a health charge for workers and students where care is public; retirees need private cover.
const visa = (id, status, home = 'in') => { const q = life(id); q.citizenships = [{ jurisdictionId: home, acquisitionType: 'birth', acquiredAt: 2000 }]; q.residency = { jurisdictionId: id, status, since: store.state.year, workAuthorized: status === 'worker', studyAuthorized: true }; q.flags.coverPaidAge = null; return q; };
p = visa('uk', 'worker'); k = sys.cover();
check(k.covered && k.visaCharge && k.premium > 0, 'a work visa in the United Kingdom: covered, with a yearly health charge');
const c5 = p.finance.cash; sys.tickCover(); check(p.finance.cash === c5 - k.premium, 'charged once a year, earning or not');
p.flags.coverPaidAge = null; p.finance.cash = 1; sys.tickCover(); check(!sys.cover().covered && sys.cover().share === 1, 'unpaid, care costs the whole bill');
p.finance.cash = 1e9; p.flags.coverPaidAge = null; sys.tickCover(); check(sys.cover().covered, 'paid again, covered again');
p = visa('de', 'student'); check(sys.cover().visaCharge && sys.cover().premium < Math.round(0.03 * sys.typicalWage()), 'a student pays a smaller charge');
p = visa('uk', 'retiree'); k = sys.cover();
check(!k.covered && k.canBuy && k.share === 1, 'a retirement visa gives no public care: private cover or the whole bill');
r = sys.setCover(true); check(r.ok && sys.cover().covered && sys.cover().bought, 'and private cover can be bought');
p = visa('uk', 'permanent_resident'); check(sys.cover().covered && !sys.cover().visaCharge && sys.cover().premium === 0, 'a permanent resident is covered like anyone else');
p = visa('us', 'worker'); check(!sys.cover().visaCharge, 'where care comes through a job or a policy, the visa changes nothing');
for (const c of COUNTRY_LIST) check(!!sys.healthModelOf(c) && sys.healthLine(c).length > 10, `${c.id}: no health model`);
section('health care: public, compulsory insurance, private, employer and mixed systems each cover who they should; visas change the terms');

// 5. Lives still work: a run of years in four systems.
for (const id of ['us', 'de', 'ae', 'ru']) {
  p = life(id, 22); job();
  for (let i = 0; i < 30; i++) { try { advanceYear(); } catch (err) { problems.push(`${id} year ${i}: ${err.message}`); break; } store.state.pendingEvents = []; p.legal.pending = null; p.stats.health = 90; if (!p.career.careerId && !p.career.retired) job(); }
  check(Number.isFinite(p.finance.cash) && p.finance.lifetimeTaxPaid >= 0 && (id === 'ae' || p.finance.lifetimeTaxPaid > 0), `${id}: thirty working years, money finite, tax ${id === 'ae' ? 'not ' : ''}paid`);
}
section('thirty-year working lives in four systems');

if (problems.length) { console.log('PROBLEMS:'); for (const x of [...new Set(problems)].slice(0, 25)) console.log(' -', x); process.exit(1); }
for (const x of ok) console.log('ok  ', x);
console.log('Tax and health systems hold.');

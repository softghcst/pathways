// Checks that the major stage (Broadway, the West End…) is very hard to reach as a grown performer, that training shows
// (a BFA in musical theater most), and that agents notice it. Odds by triple-threat score are in scripts/balance/theater.mjs.
// Run with: node tests/stage-difficulty.mjs
import { store } from '../js/state.js';
import { rng } from '../js/rng.js';
import { createLife } from '../js/engine/characterGen.js';
import { STAGE_BAR } from '../js/data/fame.js';
import * as ent from '../js/engine/entertainment.js';
import * as hiring from '../js/engine/hiring.js';
import * as press from '../js/engine/press.js';
import { openPosting, employer } from '../js/engine/employers.js';

rng.seed(5150);
const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => { if (!problems.length) ok.push(msg); };
const BFA = 'musical_theater_bfa', BA = 'musical_theater';
const performer = (skill, o = {}) => {
  do { store.state = createLife({ countryId: 'us' }); } while (store.state.player.royal);
  const p = store.state.player;
  p.age = 24; p.birthYear = store.state.year - 24; p.stats.health = 85; p.finance.cash = 50000; p.legal.record = [];
  p.talents.singing = skill; p.talents.dance = skill; p.talents.acting = skill;
  if (o.degree) p.education.degrees.push({ type: 'university', majorId: o.degree, gpa: 3.3, age: 22 });
  if (o.showcase) p.flags.showcase = o.showcase;
  const f = ent.workOf(p);
  if (o.credits ?? true) for (const tier of ['regional', 'touring']) f.credits.push({ productionId: ent.makeProduction('musical', tier, 'us').id, idx: 0, year: store.state.year - 1 });
  if (o.agent) f.agent = { npcId: null, orgId: null, since: store.state.year, commission: 0.1, clout: 1 };
  return p;
};
const pct = (x) => `${Math.round(x * 100)}%`;
/** An ensemble opening at a company of this tier, through the jobs board. */
const companyPost = (tier) => {
  const org = ent.orgsOf('us').find((x) => x.tier === tier && x.kind === 'theater');
  return openPosting(employer(org.employerId), { careerId: 'mt_performer', level: 0 });
};
const companyOdds = (skill, o = {}, tier = 'major_stage', n = 160) => {
  let won = 0;
  for (let i = 0; i < n; i++) {
    performer(skill, o);
    const post = companyPost(tier);
    if (hiring.apply(post.id).kind === 'audition' && hiring.decide(post.id, [0]).ok) won++;
  }
  return won / n;
};
const partOdds = (skill, o = {}, n = 140) => {
  let won = 0, tried = 0;
  for (let i = 0; i < n; i++) {
    const p = performer(skill, { agent: true, ...o });
    const prod = ent.makeProduction('musical', 'major_stage', 'us');
    const r = prod?.cast.find((x) => x.open && ['ensemble', 'swing', 'understudy', 'supporting'].includes(x.kind));
    if (!r) continue;
    r.ages = [20, 35];
    if (ent.whyNot(prod, r, p)) continue;
    tried++;
    if (ent.audition(prod.id, r.idx, 'study', r.approach).contract) won++;
  }
  return won / Math.max(1, tried);
};

// 1. Who may even audition: a Broadway company wants credits or an agent; a regional company does not.
{
  performer(80, { credits: false, degree: BFA });
  const post = companyPost('major_stage');
  const a = hiring.apply(post.id);
  check(a.kind === 'blocked' && /on Broadway/.test(a.text) && /credits/.test(a.text), `a newcomer can audition for a Broadway company: ${a.kind} ${a.text ?? ''}`);
  performer(80, { credits: false, agent: true });
  check(hiring.apply(companyPost('major_stage').id).kind === 'audition', 'an agent gets a newcomer into the room');
  performer(70, { credits: false });
  check(hiring.apply(companyPost('regional').id).kind === 'audition', 'a regional company sees newcomers');
  section('who may audition: a Broadway company wants two professional credits or an agent; a regional company sees anyone');
}

// 2. Hired by a Broadway company for the season: hard, and harder than a regional company.
{
  const at75 = companyOdds(75), at85 = companyOdds(85), at85bfa = companyOdds(85, { degree: BFA }), at95bfa = companyOdds(95, { degree: BFA });
  const regional75 = companyOdds(75, {}, 'regional');
  check(at75 <= 0.22, `a 75 is hired by a Broadway company ${pct(at75)} of the time`);
  check(at85 >= 0.15 && at85 <= 0.45, `an 85 is hired ${pct(at85)} of the time`);
  check(at85bfa >= at85 + 0.06, `a BFA helps with a company (${pct(at85bfa)} against ${pct(at85)})`);
  check(at95bfa >= 0.5, `a 95 with a BFA is hired ${pct(at95bfa)} of the time`);
  check(regional75 >= at75 + 0.3, `a regional company is far easier (${pct(regional75)} for a 75)`);
  section(`Broadway companies: ${pct(at75)} for a 75, ${pct(at85)} for an 85 (${pct(at85bfa)} with a BFA), ${pct(at95bfa)} for a 95 with a BFA; a regional company takes a 75 ${pct(regional75)}`);
}

// 3. A part in a Broadway show, with credits and an agent: almost out of reach below the top; a BFA counts.
{
  const at75bfa = partOdds(75, { degree: BFA }), at85 = partOdds(85), at85ba = partOdds(85, { degree: BA }), at85bfa = partOdds(85, { degree: BFA }), at95bfa = partOdds(95, { degree: BFA });
  check(at75bfa <= 0.08, `a 75 with a BFA gets a Broadway part ${pct(at75bfa)} of the time`);
  check(at85 <= 0.2, `an untrained 85 gets one ${pct(at85)} of the time`);
  check(at85bfa >= at85 + 0.12 && at85bfa >= at85ba, `a BFA counts (${pct(at85bfa)} against ${pct(at85ba)} with a BA, ${pct(at85)} untrained)`);
  check(at95bfa >= 0.7, `the very best get there (${pct(at95bfa)} for a 95 with a BFA)`);
  section(`Broadway parts: ${pct(at75bfa)} for a 75 with a BFA; for an 85, ${pct(at85)} untrained, ${pct(at85ba)} with a BA, ${pct(at85bfa)} with a BFA; ${pct(at95bfa)} for a 95 with a BFA`);
}

// 4. Agents notice training and a good showcase.
{
  const plain = press.standing(performer(75, { credits: false }));
  const trained = press.standing(performer(75, { credits: false, degree: BFA, showcase: 'classic' }));
  check(trained - plain === STAGE_BAR.agents.bfa + STAGE_BAR.agents.showcase, `agents see a BFA and a showcase: ${plain} to ${trained}`);
  check(press.standing(performer(75, { credits: false, degree: BA })) - plain === STAGE_BAR.agents.ba, 'a BA counts for less');
  section(`agents: a BFA and a good showcase lift a newcomer from ${plain} to ${trained} in an agent's eyes`);
}

if (problems.length) { console.log('PROBLEMS:'); for (const x of [...new Set(problems)].slice(0, 30)) console.log(' -', x); process.exit(1); }
for (const x of ok) console.log('ok  ', x);
console.log('The stage is hard, and training shows.');

// How hard is it to reach the major stage (Broadway, the West End…) as a grown performer, and how famous does
// theater make you? Prints the odds for performers of a few skill levels, with and without training and an agent.
// Run with: node scripts/balance/theater.mjs
import { store } from '../../js/state.js';
import { rng } from '../../js/rng.js';
import { createLife } from '../../js/engine/characterGen.js';
import * as ent from '../../js/engine/entertainment.js';
import * as hiring from '../../js/engine/hiring.js';
import { openPosting } from '../../js/engine/employers.js';
import { tripleThreat } from '../../js/engine/conditions.js';

rng.seed(424242);
const setup = (skill, o = {}) => {
  do { store.state = createLife({ countryId: 'us' }); } while (store.state.player.royal);
  const p = store.state.player;
  p.age = 24; p.birthYear = store.state.year - 24; p.stats.health = 85; p.finance.cash = 50000; p.legal.record = [];
  p.talents.singing = skill; p.talents.dance = skill; p.talents.acting = skill;
  if (o.degree) p.education.degrees.push({ type: 'university', majorId: o.degree, gpa: 3.3, year: store.state.year - 2, schoolId: null });
  return p;
};
const pct = (x) => `${Math.round(x * 100)}%`.padStart(4);

// 1. Hired by a Broadway company: an ensemble opening at a major-stage theater, by audition.
const companyOdds = (skill, o = {}, n = 200) => {
  let won = 0;
  for (let i = 0; i < n; i++) {
    const p = setup(skill, o);
    const f = ent.workOf(p);
    f.credits.push({ productionId: ent.makeProduction('musical', 'regional', 'us').id, idx: 0, year: store.state.year - 2 }, { productionId: ent.makeProduction('musical', 'touring', 'us').id, idx: 0, year: store.state.year - 1 });
    const org = ent.orgsOf('us').find((x) => x.tier === 'major_stage');
    const e = store.state.employers?.[org.employerId] ?? Object.values(store.state.jobs?.employers ?? {}).find((x) => x.id === org.employerId);
    const post = openPosting(e ?? { id: org.employerId, tracks: ['mt_performer'], countryId: 'us', city: org.city }, { careerId: 'mt_performer', level: 0 });
    if (!post) continue;
    const a = hiring.apply(post.id);
    if (a.kind !== 'audition') continue;
    if (hiring.decide(post.id, [0]).ok) won++;
  }
  return won / n;
};

// 2. A part in a Broadway show: an open adult part on the major stage, with the credits and an agent it asks for.
const roleOdds = (skill, o = {}, n = 150) => {
  let won = 0, tried = 0;
  for (let i = 0; i < n; i++) {
    const p = setup(skill, o);
    const f = ent.workOf(p);
    const reg = ent.makeProduction('musical', 'regional', 'us');
    f.credits.push({ productionId: reg.id, idx: 0, year: store.state.year - 2 }, { productionId: ent.makeProduction('musical', 'touring', 'us').id, idx: 0, year: store.state.year - 1 });
    if (o.agent) f.agent = { npcId: null, orgId: null, since: store.state.year, commission: 0.1, clout: 1 };
    const prod = ent.makeProduction('musical', 'major_stage', 'us');
    const r = prod?.cast.find((x) => x.open && x.kind !== 'child' && ['ensemble', 'supporting', 'featured', 'lead'].includes(x.kind)) ?? prod?.cast.find((x) => x.open && x.kind !== 'child');
    if (!r) continue;
    r.ages = [20, 35];
    if (ent.whyNot(prod, r, p)) continue;
    tried++;
    if (ent.audition(prod.id, r.idx, 'study', r.approach).contract) won++;
  }
  return tried ? won / tried : NaN;
};

console.log('Each audition, with 2 professional credits (and an agent, for show parts):');
console.log('Triple threat |  hired by a Broadway company  |  a part in a Broadway show');
console.log('              |  untrained   BA     BFA       |  untrained   BA     BFA');
for (const s of [65, 75, 85, 95]) {
  const bfa = { degree: 'musical_theater_bfa' }, ba = { degree: 'musical_theater' };
  console.log(`     ${String(s).padStart(3)}      |   ${pct(companyOdds(s))}     ${pct(companyOdds(s, ba))}   ${pct(companyOdds(s, bfa))}       |   ${pct(roleOdds(s, { agent: true }))}     ${pct(roleOdds(s, { ...ba, agent: true }))}   ${pct(roleOdds(s, { ...bfa, agent: true }))}`);
}
console.log(`(tripleThreat check: ${tripleThreat(setup(70))} for 70 in each)`);

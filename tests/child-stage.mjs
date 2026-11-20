// Checks the Center Stage pack. Theater districts: the major stage stands on Broadway, in the West End and the rest,
// and says so. Titles that tip a hat to famous shows. And the child stage path: lessons for a child who wants to be on stage, children's parts in plays and musicals
// at every level up to the major stage, children auditioning against other children, a child's shorter hours, and a
// childhood on the professional stage carried into a grown-up career in musical theater.
// Run with: node tests/child-stage.mjs
import { store } from '../js/state.js';
import { rng } from '../js/rng.js';
import { createLife } from '../js/engine/characterGen.js';
import { advanceYear } from '../js/engine/yearProcessor.js';
import { CHILD_PARTS, ROLE_KINDS, PRODUCTION_KINDS, TIERS, THEATER_DISTRICTS, TITLE_NODS } from '../js/data/fame.js';
import { COUNTRIES } from '../js/data/countries.js';
import { CHILD_ACTIVITIES, EARLY_CAP, LESSON_CAP } from '../js/data/childhood.js';
import { CAREERS } from '../js/data/careers.js';
import * as ent from '../js/engine/entertainment.js';
import * as childhood from '../js/engine/childhood.js';
import * as work from '../js/engine/worklife.js';
import { doorBonus } from '../js/engine/career.js';

rng.seed(6116);
const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => { if (!problems.length) ok.push(msg); };
const kid = (age, id = 'us') => {
  do { store.state = createLife({ countryId: id }); } while (store.state.player.royal);
  const p = store.state.player;
  p.age = age; p.birthYear = store.state.year - age; p.legal.record = []; p.stats.health = 85; p.finance.cash = 20000;
  p.flags.guardianWork = true; // a parent has agreed to them working
  return p;
};
const year = () => { advanceYear(); store.state.pendingEvents = []; const p = store.state.player; p.legal.pending = null; p.stats.health = Math.max(p.stats.health, 85); };
const musical = (p, n) => { p.talents.singing = n; p.talents.dance = n; p.talents.acting = n; };
/** A child part in a fresh production of this kind and tier, in the player's country (and city, for a community show). */
const childPart = (kind, tier, p) => {
  for (let i = 0; i < 60; i++) {
    const prod = ent.makeProduction(kind, tier, p.countryId, { city: p.city });
    const r = prod?.cast.find((x) => x.kind === 'child');
    if (r) return { prod, r };
  }
  return null;
};

// 1. Data.
check(ROLE_KINDS.child && CHILD_PARTS.share.musical > CHILD_PARTS.share.stage && CHILD_PARTS.hours > 0 && CHILD_PARTS.hours < 1, 'child parts: data incomplete');
for (const t of Object.keys(TIERS).filter((t) => TIERS[t].stage)) check(CHILD_PARTS.field[t] != null, `child parts: no field for ${t}`);
check(CHILD_PARTS.field.community < CHILD_PARTS.field.regional && CHILD_PARTS.field.regional < CHILD_PARTS.field.touring && CHILD_PARTS.field.touring < CHILD_PARTS.field.major_stage,
  'the bigger the stage, the stronger the other children');
const lessons = CHILD_ACTIVITIES.filter((a) => a.lesson);
check(['singing', 'acting', 'stagedance', 'youththeater'].every((id) => lessons.some((a) => a.id === id)) && lessons.every((a) => a.ages[0] <= 7 && a.ages[1] >= 12), 'lessons from 6 or 7 to 12');
check(CAREERS.find((c) => c.id === 'mt_performer').doors.some((d) => d.flag === 'childStageMajor' && d.guaranteed), 'musical theater remembers a child of the major stage');
section('data: children\'s parts by tier, lessons, and a door into musical theater');

// 2. Lessons: real training, more than a small child's classes, still capped.
{
  const p = kid(6);
  const start = p.talents.singing;
  for (let a = 6; a <= 12; a++) {
    p.age = a; p.birthYear = store.state.year - a;
    const r = childhood.doActivity('singing');
    check(r.ok, `singing lessons at ${a}: ${r.text}`);
  }
  const gained = p.talents.singing - start;
  check(gained > EARLY_CAP && gained <= LESSON_CAP, `seven years of singing lessons add ${gained} (more than ${EARLY_CAP}, at most ${LESSON_CAP})`);
  p.age = 13;
  check(!childhood.childActivities().some((a) => a.id === 'singing'), 'lessons stop at 12');
  p.age = 5;
  check(!childhood.childActivities().some((a) => a.id === 'acting'), 'no acting class at 5');
  section(`lessons: seven years of singing lessons add ${gained} to singing`);
}

// 3. Productions: plays and musicals have children's parts, held open for children.
{
  const p = kid(10);
  let made = { musical: 0, stage: 0 }, withChild = { musical: 0, stage: 0 };
  for (let i = 0; i < 300; i++) {
    for (const kind of ['musical', 'stage']) {
      const prod = ent.makeProduction(kind, rng.pick(['regional', 'touring', 'major_stage']), p.countryId);
      if (!prod) continue;
      made[kind]++;
      const kids = prod.cast.filter((r) => r.kind === 'child');
      if (kids.length) withChild[kind]++;
      for (const r of kids) check(r.open && !r.who && r.ages[1] <= 14 && r.ages[0] >= 6, `${prod.title}: a child part is cast or aged wrongly`);
    }
    for (const kind of ['film', 'tv']) check(!(ent.makeProduction(kind, 'indie', p.countryId)?.cast ?? []).some((r) => r.kind === 'child'), 'a screen production has a stage child part');
  }
  const m = withChild.musical / made.musical, s = withChild.stage / made.stage;
  check(Math.abs(m - CHILD_PARTS.share.musical) < 0.08 && Math.abs(s - CHILD_PARTS.share.stage) < 0.08, `children's parts: ${Math.round(m * 100)}% of musicals, ${Math.round(s * 100)}% of plays`);
  section(`productions: ${Math.round(m * 100)}% of musicals and ${Math.round(s * 100)}% of plays have a child's part, always left for a child`);
}

// 4. Who may audition: the agent and fame rules for grown actors do not apply; the major stage wants one credit.
{
  const p = kid(9);
  musical(p, 60);
  const regional = childPart('musical', 'regional', p);
  const major = childPart('musical', 'major_stage', p);
  regional.r.ages = [7, 11]; major.r.ages = [7, 11];
  check(ent.whyNot(regional.prod, regional.r, p) === '', `a nine-year-old with no credits may audition for a regional child part: ${ent.whyNot(regional.prod, regional.r, p)}`);
  check(/credit/.test(ent.whyNot(major.prod, major.r, p)), 'the major stage wants a child with a credit or an agent');
  ent.workOf(p).credits.push({ productionId: regional.prod.id, idx: regional.r.idx, year: store.state.year });
  check(ent.whyNot(major.prod, major.r, p) === '', `with one regional credit, a child may audition on the major stage: ${ent.whyNot(major.prod, major.r, p)}`);
  const lead = major.prod.cast.find((r) => r.kind === 'lead');
  check(ent.whyNot(major.prod, lead, p) !== '', 'a child still cannot go for a grown lead on the major stage');
  p.age = 4;
  check(ent.whyNot(regional.prod, regional.r, p) !== '', 'a four-year-old cannot audition');
  section('who may audition: no agent or fame needed for a child part; one credit for the major stage');
}

// 5. Auditions: children against children. A strong, trained child wins parts on the major stage; an untrained one rarely.
{
  const rate = (skill, tier, n = 120) => {
    const p = kid(10);
    musical(p, skill);
    const prod = childPart('musical', tier, p);
    prod.r.ages = [8, 12];
    ent.workOf(p).credits.push({ productionId: childPart('musical', 'regional', p).prod.id, idx: 0, year: store.state.year });
    let won = 0;
    for (let i = 0; i < n; i++) {
      delete ent.workOf(p).applied[`${prod.prod.id}:${prod.r.idx}`];
      ent.workOf(p).contracts = [];
      if (ent.audition(prod.prod.id, prod.r.idx, 'study', prod.r.approach).contract) won++;
    }
    return won / n;
  };
  const strongMajor = rate(70, 'major_stage'), averageMajor = rate(45, 'major_stage'), averageRegional = rate(45, 'regional'), weakRegional = rate(25, 'regional');
  check(strongMajor >= 0.5, `a strong child wins ${Math.round(strongMajor * 100)}% of major-stage child parts`);
  check(averageMajor <= 0.15, `an average child wins ${Math.round(averageMajor * 100)}% of major-stage child parts`);
  check(averageRegional >= 0.25 && averageRegional <= 0.75 && averageRegional > averageMajor + 0.2, `an average child wins ${Math.round(averageRegional * 100)}% of regional child parts: a contest, not a certainty`);
  check(strongMajor <= 0.95, `a strong child wins ${Math.round(strongMajor * 100)}% on the major stage: never a certainty`);
  check(weakRegional <= 0.1, `an untrained child wins ${Math.round(weakRegional * 100)}% of regional child parts`);
  section(`auditions: a strong child wins ${Math.round(strongMajor * 100)}% on the major stage, an average one ${Math.round(averageMajor * 100)}% there and ${Math.round(averageRegional * 100)}% regionally, an untrained one ${Math.round(weakRegional * 100)}%`);
}

// 6. A child's hours, and a childhood on stage carried into a career.
{
  const p = kid(9);
  musical(p, 75);
  const credit = childPart('musical', 'regional', p);
  credit.r.ages = [7, 11];
  let contract = null;
  for (let i = 0; i < 30 && !contract; i++) { delete ent.workOf(p).applied[`${credit.prod.id}:${credit.r.idx}`]; contract = ent.audition(credit.prod.id, credit.r.idx, 'coach', credit.r.approach).contract; }
  check(!!contract, 'a strong child books a regional child part');
  if (contract) {
    check(contract.hours === Math.round(PRODUCTION_KINDS.musical.hours * CHILD_PARTS.hours), `a child part asks ${contract.hours} hours a week`);
    const signed = ent.sign(contract.id);
    check(signed.ok !== false, `a nine-year-old in the United States (working age 14) may sign to perform: ${signed.text}`);
    const load = work.weeklyLoad(p, p.age + credit.prod.workYear - store.state.year).rows.find((r) => r.label === 'Productions you are in'); // the year it is performed
    check(load && load.hours < 20, `a child on stage works ${load?.hours} hours a week, around school`);
    const before = doorBonus(CAREERS.find((c) => c.id === 'mt_performer'));
    for (let y = 0; y < 3 && !p.flags.childStage; y++) year();
    check(p.flags.childStage && !p.flags.childStageMajor, 'a regional part as a child is remembered');
    check(doorBonus(CAREERS.find((c) => c.id === 'mt_performer')) > before, 'and helps an audition for musical theater later');
  }
  section(`a child's part: ${contract?.hours} hours a week, and a credit that counts toward musical theater at 18`);
}

// 7. A whole theater childhood runs cleanly: lessons, then auditions every year, from 6 to 18.
{
  const p = kid(6);
  musical(p, 50);
  let parts = 0;
  for (let a = 6; a < 18; a++) {
    for (const id of ['singing', 'acting', 'stagedance', 'youththeater']) childhood.doActivity(id);
    for (const x of ent.castingBoard(p).filter((y) => !y.why && !y.applied && y.role.kind === 'child')) {
      const r = ent.audition(x.production.id, x.role.idx, 'study', x.role.approach);
      if (r.contract && ent.sign(r.contract.id).ok !== false) parts++;
    }
    try { year(); } catch (err) { problems.push(`age ${a}: ${err.stack.split('\n').slice(0, 3).join(' ')}`); break; }
    p.flags.guardianWork = true;
    check(Number.isFinite(p.finance.cash) && p.talents.singing <= 100, `age ${a}: figures out of range`);
  }
  check(parts >= 1, `a trained child with an agreeable parent books at least one child part by 18 (${parts})`);
  const miscast = Object.values(ent.ent().productions).flatMap((x) => x.cast).filter((r) => ['child', 'dance_ensemble'].includes(r.kind) && r.who && r.who !== 'player');
  check(!miscast.length, `${miscast.length} open-call parts (a child's, a dance ensemble) went to working actors from the pool`);
  section(`a theater childhood from 6 to 18 runs cleanly: ${parts} child parts, ${ent.workOf(p).credits.length} credits${p.flags.childStageMajor ? ', the major stage among them' : ''}`);
}

// 8. Theater districts: the major stage stands in a real theater district, by name; theaters and shows stay invented.
{
  for (const [id, d] of Object.entries(THEATER_DISTRICTS)) check(COUNTRIES[id]?.cities.includes(d.city) && /^(on|in) /.test(d.on), `${id}: ${d.name} is not in one of its cities`);
  const p = kid(10, 'us');
  const stages = ent.orgsOf('us').filter((o) => o.tier === 'major_stage');
  check(stages.length === 2 && stages.every((o) => o.city === 'New York' && !/broadway/i.test(o.name)), `the US major stage: ${stages.map((o) => `${o.name} in ${o.city}`).join(', ')}`);
  const show = ent.makeProduction('musical', 'major_stage', 'us');
  check(ent.tierName(show) === 'Broadway' && ent.districtOf(show).on === 'on Broadway', `a major-stage musical in New York is a Broadway musical (${ent.tierName(show)})`);
  const regional = ent.makeProduction('musical', 'regional', 'us');
  check(ent.tierName(regional) === TIERS.regional.name && !ent.districtOf(regional), 'a regional show is not on Broadway');
  check(ent.tierName({ ...show, city: 'Washington, D.C.' }) === TIERS.major_stage.name, 'a major stage from an older world, outside the district, keeps its old name');
  const major = childPart('musical', 'major_stage', p);
  major.r.ages = [8, 12];
  check(/on Broadway/.test(ent.whyNot(major.prod, major.r, p)), `a child is told what Broadway wants: ${ent.whyNot(major.prod, major.r, p)}`);
  kid(10, 'de');
  const de = ent.makeProduction('musical', 'major_stage', 'de');
  check(ent.tierName(de) === TIERS.major_stage.name, 'a country with no district here keeps "Major stage"');
  section(`districts: ${Object.keys(THEATER_DISTRICTS).length} countries play their major stage in a real theater district, ${stages.map((o) => o.name).join(' and ')} on Broadway`);
}

// 9. Titles that wink at famous shows: about a third of plays and musicals, never two running at once, never on screen.
{
  kid(30, 'us');
  let made = 0, nods = 0;
  const all = [...TITLE_NODS.musical, ...TITLE_NODS.stage];
  for (let i = 0; i < 40; i++) {
    for (const kind of ['musical', 'stage']) {
      const x = ent.makeProduction(kind, 'regional', 'us');
      if (!x) continue;
      made++;
      if (TITLE_NODS[kind].includes(x.title)) nods++;
      check(!all.includes(x.title) || TITLE_NODS[kind].includes(x.title), `${x.title}: a musical's nod on a play, or the other way`);
    }
    const film = ent.makeProduction('film', 'indie', 'us');
    check(!film || !all.includes(film.title), `a film is called ${film?.title}`);
  }
  const titles = Object.values(ent.ent().productions ?? {}).map((x) => x.title).filter((t) => all.includes(t));
  check(new Set(titles).size === titles.length, 'the same nod is running twice');
  check(nods / made > 0.2 && nods / made < 0.5, `nods: ${nods} of ${made}`);
  section(`titles: ${nods} of ${made} new plays and musicals tip their hat to a famous show (${titles.slice(0, 4).join(', ')}, …)`);
}

if (problems.length) { console.log('PROBLEMS:'); for (const x of [...new Set(problems)].slice(0, 30)) console.log(' -', x); process.exit(1); }
for (const x of ok) console.log('ok  ', x);
console.log('Break a leg.');

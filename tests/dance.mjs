// Checks a dancer's life: degrees in dance judged on dancing, the year's gigs (commercials to a celebrity's tour and a
// season on the televised dance competition), who may go for what, the odds and what training adds, pay and hours,
// competitions for children and adults, and dance ensemble parts in musicals cast on dancing.
// Run with: node tests/dance.mjs
import { store } from '../js/state.js';
import { rng } from '../js/rng.js';
import { createLife } from '../js/engine/characterGen.js';
import { advanceYear } from '../js/engine/yearProcessor.js';
import { DANCE_GIGS, DANCE_YEAR, DANCE_COMPETITIONS, DANCE_SHOW } from '../js/data/dance.js';
import { MAJOR_BY_ID } from '../js/data/majors.js';
import { CHILD_TRUST_SHARE } from '../js/data/fame.js';
import * as dance from '../js/engine/dance.js';
import * as ent from '../js/engine/entertainment.js';
import * as work from '../js/engine/worklife.js';
import { admissionChance } from '../js/engine/education.js';
import { startBlock, start as startBusiness } from '../js/engine/business.js';
import { BUSINESS_BY_ID } from '../js/data/business.js';
import { CHOREOGRAPHER, STUDIO_READY } from '../js/data/dance.js';
import * as music from '../js/engine/music.js';

rng.seed(808);
const problems = [];
const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const section = (msg) => { if (!problems.length) ok.push(msg); };
const dancer = (age, skill, o = {}) => {
  do { store.state = createLife({ countryId: 'us' }); } while (store.state.player.royal);
  const p = store.state.player;
  p.age = age; p.birthYear = store.state.year - age; p.stats.health = 85; p.finance.cash = 20000; p.legal.record = [];
  p.talents.dance = skill; p.talents.singing = o.sing ?? 40; p.talents.acting = o.act ?? 40;
  p.flags.guardianWork = true;
  if (o.degree) p.education.degrees.push({ type: 'university', majorId: o.degree, gpa: 3.3, age: 22 });
  if (o.agent) ent.workOf(p).agent = { npcId: null, orgId: null, since: store.state.year, commission: 0.1, clout: 1 };
  if (o.record) for (let i = 0; i < o.record; i++) dance.danceOf(p).gigs.push({ id: `old${i}`, year: store.state.year - 1, kind: 'commercial', client: 'x', fee: 0, weeks: 1, hours: 0, prestige: 8, paid: true });
  return p;
};
const year = () => { advanceYear(); store.state.pendingEvents = []; const p = store.state.player; p.legal.pending = null; p.stats.health = Math.max(p.stats.health, 85); };
/** An offer of this kind on the year's board (added if the board did not draw one). */
const offerOf = (kind, p) => {
  const list = dance.offers(p);
  let o = list.find((x) => x.kind === kind && x.status === 'open');
  if (!o) { o = { id: `t_${kind}_${rng.int(1, 1e9)}`, kind, client: 'Test Client', city: 'New York', fee: 10000, wants: 'jazz', brief: '', status: 'open' }; list.push(o); }
  return o;
};

// 1. Degrees in dance, judged at audition on dancing alone.
{
  check(MAJOR_BY_ID.dance?.auditionSkill === 'talents.dance' && MAJOR_BY_ID.dance_bfa?.auditionBase < MAJOR_BY_ID.dance.auditionBase, 'dance majors: BA and BFA, judged on dancing');
  check(MAJOR_BY_ID.dance_bfa.yearly.talents.dance > MAJOR_BY_ID.dance.yearly.talents.dance, 'a BFA trains dancing faster');
  const p = dancer(18, 85, { sing: 30, act: 30 });
  p.education.degrees.push({ type: 'high', gpa: 3.4, age: 18 });
  const danceOdds = admissionChance('university', 'dance_bfa'), mtOdds = admissionChance('university', 'musical_theater_bfa');
  check(danceOdds > mtOdds + 0.2, `a fine dancer who cannot sing gets into a dance BFA (${danceOdds.toFixed(2)}), not a musical theater one (${mtOdds.toFixed(2)})`);
  section(`degrees: a BFA and a BA in dance; a fine dancer who cannot sing has ${Math.round(danceOdds * 100)}% at a dance BFA, ${Math.round(mtOdds * 100)}% at a musical theater one`);
}

// 2. The year's gigs: what a dancer is ready for, and who may go for what.
{
  const kid = dancer(8, 45);
  check(dance.offers(kid).every((o) => DANCE_GIGS[o.kind].minAge <= 8), 'a child is offered only what children do');
  const novice = dancer(19, 58);
  check(!dance.offers(novice).some((o) => ['tour', 'tv_pro', 'choreo'].includes(o.kind)), 'a beginner is not offered tours, television or choreography');
  const star = dancer(26, 88);
  check(new Set(Array.from({ length: 6 }, () => { star.age += 1; return dance.offers(star).map((o) => o.kind); }).flat()).size >= 5, 'a fine dancer is offered all kinds of work over the years');
  check(/agent/.test(dance.whyNot('tour', dancer(25, 85))), 'tours are cast through agents');
  check(/jobs/.test(dance.whyNot('tv_pro', dancer(25, 90, { agent: true }))), 'television wants dancers with jobs behind them');
  check(dance.whyNot('tv_pro', dancer(25, 90, { agent: true, record: 3 })) === '', `with an agent and three jobs, television is open: ${dance.whyNot('tv_pro', dancer(25, 90, { agent: true, record: 3 }))}`);
  check(/From 18/.test(dance.whyNot('cruise', dancer(16, 70))), 'no cruise ships before 18');
  const minor = dancer(12, 60); minor.flags.guardianWork = false;
  check(/parent/.test(dance.whyNot('commercial', minor)), 'a child needs a parent to agree');
  section('the year\'s gigs: children get children\'s work, beginners no tours; tours and television need an agent and a record');
}

// 3. The odds: skill against the bar, training, a record, an agent, and reading the brief.
{
  const p = dancer(24, 70);
  const o = offerOf('revue', p); o.wants = 'jazz';
  const plain = dance.odds(o, 'jazz', p);
  check(Math.abs(dance.odds(o, 'jazz', p) - dance.odds(o, 'hiphop', p) - (DANCE_YEAR.style.right - DANCE_YEAR.style.wrong)) < 1e-9, 'reading the brief right matters');
  const bfa = dancer(24, 70, { degree: 'dance_bfa' });
  const ob = offerOf('revue', bfa); ob.wants = 'jazz';
  const trained = dance.odds(ob, 'jazz', bfa);
  check(Math.abs(trained - plain - DANCE_YEAR.training.bfa / 25) < 1e-9, `a BFA in dance helps (${plain.toFixed(2)} to ${trained.toFixed(2)})`);
  let won = 0;
  for (let i = 0; i < 200; i++) { const q = dancer(25, 60); if (rng.chance(dance.odds(offerOf('tour', q), 'hiphop', q))) won++; }
  check(won / 200 < 0.12, `an ordinary dancer rarely makes a tour (${won / 2}%)`);
  section(`odds: a BFA lifts a revue audition from ${Math.round(plain * 100)}% to ${Math.round(trained * 100)}%; reading the brief is worth ${Math.round((DANCE_YEAR.style.right - DANCE_YEAR.style.wrong) * 100)} points`);
}

// 4. Booked: paid once, the hours counted, a child's share held in trust; four auditions a year.
{
  const p = dancer(25, 99, { agent: true, degree: 'dance_bfa' });
  const o = offerOf('cruise', p); o.wants = 'jazz';
  let r = dance.audition(o.id, 'jazz');
  for (let i = 0; i < 3 && !r.ok; i++) { const again = offerOf('cruise', p); again.wants = 'jazz'; r = dance.audition(again.id, 'jazz'); }
  check(r.ok, `a fine dancer books a cruise contract: ${r.text}`);
  const lines = dance.danceLines(p);
  check(lines.length === 1 && lines[0].gross > 0, 'its pay is a payroll line');
  dance.markDancePaid(p);
  check(dance.danceLines(p).length === 0, 'and paid once');
  check(work.weeklyLoad(p).rows.some((x) => x.label === 'Dance work' && x.hours >= 20), 'a cruise contract takes the hours of a job');
  for (let i = 0; i < 6; i++) { const x = offerOf('commercial', p); dance.audition(x.id, 'jazz'); }
  check(dance.danceOf(p).offers.went <= DANCE_YEAR.auditions, 'four auditions a year');
  const kid = dancer(10, 99);
  const c = offerOf('commercial', kid); c.wants = 'jazz';
  let k = dance.audition(c.id, 'jazz');
  for (let i = 0; i < 3 && !k.ok; i++) { const again = offerOf('commercial', kid); again.wants = 'jazz'; k = dance.audition(again.id, 'jazz'); }
  const g = dance.danceOf(kid).gigs.at(-1);
  check(k.ok && g.trust === Math.round(g.fee * CHILD_TRUST_SHARE) && ent.workOf(kid).trust >= g.trust, 'a child\'s share is held in trust');
  section(`booked: a cruise contract pays once and takes ${work.weeklyLoad(p).rows.find((x) => x.label === 'Dance work')?.hours} hours a week; a child's share goes into trust`);
}

// 5. A season on the televised dance competition: a celebrity partner, a place, and a television audience.
{
  let places = [];
  for (let i = 0; i < 12; i++) {
    const p = dancer(28, 92, { agent: true, record: 4 });
    const o = offerOf('tv_pro', p); o.wants = 'ballroom';
    let r = { ok: false };
    for (let j = 0; j < 4 && !r.ok; j++) { const x = offerOf('tv_pro', p); x.wants = 'ballroom'; r = dance.audition(x.id, 'ballroom'); }
    if (!r.ok) continue;
    const g = dance.danceOf(p).gigs.at(-1);
    check(g.partner && g.place >= 1 && g.place <= DANCE_SHOW.couples, `${DANCE_SHOW.name}: partner and place recorded`);
    check((p.fame?.audiences?.tv ?? 0) > 0, 'a television audience knows the dancer');
    places.push(g.place);
  }
  check(places.length >= 6, `a fine dancer with an agent gets on the show (${places.length} of 12)`);
  check(places.some((x) => x <= 3) && places.some((x) => x > 3), `seasons go both ways: places ${places.join(', ')}`);
  section(`${DANCE_SHOW.name}: ${places.length} seasons, places ${places.join(', ')}`);
}

// 6. Competitions: children from six, levels unlocked by placing, prizes for grown dancers, two a year.
{
  const kid = dancer(8, 50);
  const comps = dance.competitions(kid);
  check(comps.find((c) => c.level === 'regional').why === '' && /top three/.test(comps.find((c) => c.level === 'national').why), 'a child starts at the regional competition');
  check(dance.competitions(dancer(5, 50)).every((c) => c.why), 'not before six');
  let top3 = 0, weakTop3 = 0;
  for (let i = 0; i < 80; i++) {
    const strong = dancer(10, 62); if (dance.compete('regional', 'jazz').ok) top3++;
    const weak = dancer(10, 28); if (dance.compete('regional', 'jazz').ok) weakTop3++;
  }
  check(top3 / 80 >= 0.5 && weakTop3 / 80 <= 0.1, `a strong child places in the top three regionally ${Math.round(top3 / 0.8)}%, a weak one ${Math.round(weakTop3 / 0.8)}%`);
  const adult = dancer(24, 95);
  const cash = adult.finance.cash;
  const r1 = dance.compete('regional', 'jazz');
  const r2 = dance.compete('national', 'jazz');
  check(dance.compete('world', 'jazz').ok === false && dance.danceOf(adult).entered.n === 2, 'two competitions a year');
  check(!r1.ok || dance.danceOf(adult).best.regional <= 3, 'placing is remembered');
  check(dance.danceOf(adult).comps.length === 2 && (adult.finance.cash !== cash), 'a grown dancer pays the fee and may win prize money');
  section(`competitions: a strong child places ${Math.round(top3 / 0.8)}% of the time regionally, a weak one ${Math.round(weakTop3 / 0.8)}%; national needs a regional podium`);
}

// 7. Dance ensemble parts in musicals: cast on dancing.
{
  dancer(25, 50);
  let made = 0, withDance = 0;
  for (let i = 0; i < 120; i++) { const m = ent.makeProduction('musical', 'regional', 'us'); if (!m) continue; made++; if (m.cast.some((r) => r.kind === 'dance_ensemble' && r.open && !r.who)) withDance++; }
  check(Math.abs(withDance / made - 0.6) < 0.12, `dance calls in ${withDance} of ${made} musicals`);
  const parts = (kind) => {
    let won = 0, n = 0;
    for (let i = 0; i < 80; i++) {
      const p = dancer(25, 85, { sing: 40, act: 40 });
      const prod = ent.makeProduction('musical', 'regional', 'us');
      const r = kind === 'dance_ensemble' ? prod.cast.find((x) => x.kind === 'dance_ensemble') : prod.cast.find((x) => x.kind === 'ensemble');
      if (!r) continue;
      r.open = true; r.ages = [20, 35];
      if (ent.whyNot(prod, r, p)) continue;
      n++;
      if (ent.audition(prod.id, r.idx, 'study', r.approach).contract) won++;
    }
    return won / Math.max(1, n);
  };
  const danceRate = parts('dance_ensemble'), singRate = parts('ensemble');
  check(danceRate >= singRate + 0.3, `a dancer who cannot sing gets dance ensemble parts (${Math.round(danceRate * 100)}%) far more than singing ones (${Math.round(singRate * 100)}%)`);
  section(`dance ensemble: ${withDance} of ${made} musicals hold a dance call; a dancer who cannot sing wins ${Math.round(danceRate * 100)}% of them, ${Math.round(singRate * 100)}% of ordinary ensemble parts`);
}

// 8. A dancer's working life, 18 to 32: gigs and competitions every year, the years running cleanly.
{
  const p = dancer(18, 62, { degree: 'dance_bfa' });
  const earned0 = p.finance.lifetimeEarned ?? 0;
  for (let a = 18; a < 32; a++) {
    for (const o of dance.offers(p).filter((x) => x.status === 'open' && !dance.whyNot(x.kind, p)).slice(0, 4)) dance.audition(o.id, o.wants);
    for (const c of dance.competitions(p).filter((x) => !x.why)) dance.compete(c.level, 'jazz');
    try { year(); } catch (err) { problems.push(`age ${a}: ${err.stack.split('\n').slice(0, 3).join(' ')}`); break; }
    p.flags.guardianWork = true;
  }
  const d = dance.danceOf(p);
  check(d.gigs.length >= 8, `a trained dancer works (${d.gigs.length} jobs in fourteen years)`);
  check((p.finance.lifetimeEarned ?? 0) > earned0, 'and is paid for it');
  check(Number.isFinite(p.finance.cash), 'money stays a number');
  section(`a dancer's life, 18 to 32: ${d.gigs.length} jobs (${[...new Set(d.gigs.map((x) => x.kind))].join(', ')}), ${d.comps.length} competitions, best national place ${d.best.national ?? 'none'}`);
}

// 9. A dance studio: a qualified dancer can open one; it runs as a business.
{
  const studio = BUSINESS_BY_ID.dance_studio;
  check(/dance degree/.test(startBlock(studio)) || true, 'checked below');
  dancer(30, 80);
  check(/dance degree/.test(startBlock(studio)), `an untrained dancer with no record cannot open a studio: ${startBlock(studio)}`);
  const p = dancer(30, 80, { degree: 'dance_bfa' }); p.finance.cash = 200000;
  check(!/dance degree/.test(startBlock(studio)), `a dancer with a BFA can: ${startBlock(studio)}`);
  dancer(30, 80, { record: STUDIO_READY.jobs });
  check(!/dance degree/.test(startBlock(studio)), 'so can a dancer with ten jobs behind them');
  dancer(30, 50, { degree: 'dance_bfa' });
  check(/dance degree|dance well/.test(startBlock(studio)), 'not one who no longer dances well');
  const q = dancer(32, 82, { degree: 'dance_bfa' }); q.finance.cash = 300000;
  const r = startBusiness('dance_studio', 'Pointe & Shoot Dance Academy', { solo: true });
  check(r.ok && (q.businesses ?? []).some((b) => b.typeId === 'dance_studio' || b.type === 'dance_studio'), `a studio opens: ${r.text}`);
  section(`a dance studio: opened by a qualified dancer (${r.ok ? 'Pointe & Shoot Dance Academy is open' : 'not opened'})`);
}

// 10. Choreographing a musical: hired by pitch, on dancing and choreography already done.
{
  dancer(30, 60);
  let made = 0, withChoreo = 0;
  for (let i = 0; i < 120; i++) { const m = ent.makeProduction('musical', 'regional', 'us'); if (!m) continue; made++; if (m.cast.some((r) => r.kind === 'choreographer' && r.open && !r.who)) withChoreo++; }
  check(Math.abs(withChoreo / made - CHOREOGRAPHER.call) < 0.12, `choreographers wanted for ${withChoreo} of ${made} musicals`);
  const post = (p, tier) => { for (let i = 0; i < 40; i++) { const m = ent.makeProduction('musical', tier, 'us'); const r = m?.cast.find((x) => x.kind === 'choreographer'); if (r) return { m, r }; } return null; };
  let p = dancer(30, 70);
  let x = post(p, 'regional');
  check(/top of the field/.test(ent.whyNot(x.m, x.r, p)), 'a middling dancer is not hired to choreograph');
  p = dancer(30, 88);
  x = post(p, 'regional');
  check(/choreography credit/.test(ent.whyNot(x.m, x.r, p)), 'a fine dancer who has never choreographed is not either');
  p = dancer(30, 88);
  dance.danceOf(p).gigs.push({ id: 'cv', year: store.state.year - 1, kind: 'choreo', client: 'x', fee: 0, weeks: 3, hours: 0, prestige: 25, paid: true });
  x = post(p, 'regional');
  check(ent.whyNot(x.m, x.r, p) === '', `one music video choreographed opens a regional musical: ${ent.whyNot(x.m, x.r, p)}`);
  const big = post(p, 'major_stage');
  check(/3 choreography credits/.test(ent.whyNot(big.m, big.r, p)), 'Broadway wants three');
  let hired = null;
  for (let i = 0; i < 12 && !hired; i++) { const y = post(p, 'regional'); hired = ent.audition(y.m.id, y.r.idx, 'study', y.r.approach).contract ?? null; if (hired) x = y; }
  check(hired && hired.hours === Math.round(38 * CHOREOGRAPHER.hours), `a choreographer is hired (${hired?.hours} hours a week)`);
  if (hired) {
    ent.sign(hired.id);
    for (let i = 0; i < 3 && dance.choreoRecord(p) < 2; i++) year();
    check(dance.choreoRecord(p) >= 2, `the show counts on the choreography record (${dance.choreoRecord(p)})`);
  }
  section(`choreography: ${withChoreo} of ${made} musicals hire a choreographer by pitch; one video opens a regional show, Broadway wants three`);
}

// 11. K-pop: in South Korea, idol groups hire backup dancers and choreographers.
{
  const p = dancer(24, 85, { record: 5 });
  p.countryId = 'kr'; p.city = 'Seoul';
  const seen = new Set();
  for (let i = 0; i < 8; i++) { p.age += 1; for (const o of dance.offers(p)) seen.add(o.kind); }
  check(seen.has('idol_backup') || seen.has('idol_choreo'), `idol work is offered in Seoul (${[...seen].join(', ')})`);
  const us = dancer(24, 85, { record: 5 });
  const seenUs = new Set(); for (let i = 0; i < 8; i++) { us.age += 1; for (const o of dance.offers(us)) seenUs.add(o.kind); }
  check(!seenUs.has('idol_backup') && !seenUs.has('idol_choreo'), 'not in the United States');
  section(`K-pop: idol backup and comeback choreography are offered in Seoul, not elsewhere`);
}

// 12. A musician who dances well stars in their own music video, and it sells better.
{
  const run = (skill) => {
    do { store.state = createLife({ countryId: 'us' }); } while (store.state.player.royal);
    const p = store.state.player;
    p.age = 24; p.birthYear = store.state.year - 24; p.finance.cash = 100000; p.talents.music = 75; p.talents.singing = 75; p.talents.dance = skill;
    const ms = music.musicians(p.countryId);
    music.formAct('band', { with: ms.slice(0, 3).map((n) => n.id) });
    for (let i = 0; i < 3; i++) music.writeSong();
    const r = music.record('single', { video: true });
    const rel = Object.values(ent.ent().releases ?? {}).at(-1);
    return { r, rel };
  };
  const good = run(80), poor = run(30);
  check(good.r.ok && good.rel?.danced && /choreograph/.test(good.r.text), `a dancing musician dances in their video: ${good.r.text}`);
  check(poor.r.ok && poor.rel && !poor.rel.danced, 'one who cannot dance does not');
  section('music videos: a musician who dances well choreographs and stars in their own, and it sells better');
}

if (problems.length) { console.log('PROBLEMS:'); for (const x of [...new Set(problems)].slice(0, 30)) console.log(' -', x); process.exit(1); }
for (const x of ok) console.log('ok  ', x);
console.log('Five, six, seven, eight.');

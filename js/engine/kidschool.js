// Your children's education, seen from the parent's side: which school they
// go to, help with homework, tutors, turning up to their concerts and
// matches, what to do about a bad report or a prize, where they apply to
// university, and backing an adult child who goes back to study.
// The rest of a child's life (their marks year to year, the path they take
// at eighteen) is in engine/npcLives.js; schools are the same schools the
// player goes to (engine/schooling.js), and universities the same
// universities (engine/university.js).
//
// On a child (npc.life.edu, besides stage, gpa, degrees):
//   schoolId, kind     the school they are at now, and what kind of school it is
//   schools            [{ name, kind, from }]   every school they have been to
//   boost              this year's extra help, spent by the next yearly mark
//   uniId              the university they went to
//   back               { until, backed, course }   an adult child back in study
//   said               { struggling, prize, back }  the age each scene was last raised
import { cityOf as cityProfile } from './cities.js';
import { rng } from '../rng.js';
import { clamp, localMoney, fmtMoney } from '../util.js';
import { store, player, country, livingNpcs, log, milestone } from '../state.js';
import { KIND_BY_ID, LEAVING_AGE } from '../data/education.js';
import { MAJOR_BY_ID } from '../data/majors.js';
import * as sch from './schooling.js';
import { catalog, uniOf, teaches } from './university.js';
import { spendAction } from './relationships.js';
import { wealthTier } from './living.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const npcOf = (id) => store.state.npcs[id];
const they = (n) => (n.gender === 'female' ? 'she' : n.gender === 'male' ? 'he' : 'they');
const them = (n) => (n.gender === 'female' ? 'her' : n.gender === 'male' ? 'him' : 'them');
const their = (n) => (n.gender === 'female' ? 'her' : n.gender === 'male' ? 'his' : 'their');
/** A verb agreeing with the child's pronoun: v(n, 'knows', 'know'). */
const v = (n, one, many) => (n.gender === 'female' || n.gender === 'male' ? one : many);
const bump = (n, d) => { n.meters.relationship = Math.round(clamp(n.meters.relationship + d)); };
const kidsAtSchool = () => livingNpcs().filter(atSchool);
/** The stage a child of this age is in, here: 'elementary' | 'middle' | 'high'. */
const stageOf = (n) => sch.stageDue(n.age, player().countryId)?.id ?? null;

/** A child of the player's who is of school age and living at home. */
export const atSchool = (n) => !!n && n.alive && n.role === 'child' && n.age >= 5 && n.age < LEAVING_AGE && !!n.life?.edu && !n.flags.abroad;
/** The child as the school rules see a pupil. */
const asPupil = (n) => ({ stats: { intellect: n.meters.intellect }, talents: n.talents ?? {}, royal: null });
export const schoolOf = (n) => (n.life?.edu?.schoolId ? store.state.schools?.[n.life.edu.schoolId] ?? null : null);

// ---------- Choosing a school ----------

/** The kind of school a child's gifts would suit, if any would take them. */
function giftedKind(n, stage) {
  const t = n.talents ?? {};
  return [['arts', Math.max(t.acting ?? 0, t.singing ?? 0, t.dance ?? 0, t.music ?? 0)], ['sports', t.sports ?? 0], ['selective', (n.meters.intellect ?? 50) + 4]]
    .filter(([k]) => !sch.barred(KIND_BY_ID[k], stage, asPupil(n)))
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/** Puts a child into a school of this kind in the family's town. @returns {string} what happened */
function place(n, kindId, quiet = false) {
  const p = player();
  const e = n.life.edu;
  const stage = stageOf(n) ?? 'elementary';
  const s = sch.placeFor(kindId, stage, p.city, p.countryId);
  const name = `${n.firstName} ${n.lastName}`;
  const before = s.family.filter((x) => x !== name);
  if (!s.family.includes(name)) s.family.push(name);
  const moved = e.schoolId && e.schoolId !== s.id;
  e.schoolId = s.id; e.kind = kindId; e.schoolStage = stage;
  // A choice made the year a stage begins replaces the place they were given by default.
  const list = (e.schools ??= []);
  const last = list[list.length - 1];
  if (last && last.from === n.age) list[list.length - 1] = { name: s.name, kind: kindId, from: n.age };
  else if (!last || last.name !== s.name) list.push({ name: s.name, kind: kindId, from: n.age });
  const mine = before.find((x) => x === `${p.firstName} ${p.lastName}`);
  const text = `${n.firstName} ${moved ? 'moves to' : 'starts at'} ${s.name}${kindId === 'public' ? '' : `, ${/^[aeiou]/i.test(KIND_BY_ID[kindId].name) ? 'an' : 'a'} ${KIND_BY_ID[kindId].name.toLowerCase()}`}.${mine ? ' You went there yourself.' : before.length ? ` ${before[before.length - 1]} went there before ${them(n)}.` : ''}`;
  if (!quiet) log(text, 'system', 'neutral');
  return text;
}

/** After the family moves to a new town: a place at the local state school there. @returns {string} what happened */
export function newTown(n) {
  if (!n?.life?.edu || !stageOf(n)) return '';
  return place(n, 'public', true);
}

/** Yearly, for each child at school: a school when a stage begins, fees, and the scenes a parent is asked to deal with. */
export function tickKids() {
  const p = player();
  const c = country();
  for (const n of kidsAtSchool()) {
    const e = n.life.edu;
    const stage = stageOf(n);
    if (stage && stage !== e.schoolStage) {
      // A school for the new stage: the family's habit at first; the parent is asked.
      const was = e.kind && !['public', 'home', 'palace'].includes(e.kind) && !sch.barred(KIND_BY_ID[e.kind], stage, asPupil(n)) ? e.kind : 'public';
      place(n, was, true);
      store.state.pendingEvents.push({ id: 'kid_school_choice', cast: { kid: n.id, words: { stage: sch.stageName(stage).toLowerCase(), school: schoolOf(n)?.name ?? 'the local school' } } });
    }
    const kind = KIND_BY_ID[e.kind];
    if (kind?.fee) {
      const fee = localMoney(kind.fee, c);
      if (p.finance.cash >= fee) { p.finance.cash -= fee; }
      else {
        const left = schoolOf(n)?.name;
        place(n, 'public', true);
        bump(n, -4);
        log(`You could not find the fees for ${left}. ${n.firstName} has moved to ${schoolOf(n).name}, and has had to start again with new friends.`, 'system', 'bad');
      }
    }
    if (kind?.away) bump(n, -1); // away from home during the school year
    const said = (e.said ??= {});
    if (n.age >= 8 && n.age <= 16 && e.gpa < 2.0 && (said.struggling ?? -9) <= n.age - 4 && rng.chance(0.5)) {
      said.struggling = n.age;
      store.state.pendingEvents.push({ id: 'kid_struggling', cast: { kid: n.id, words: { mark: sch.mark(e.gpa), school: schoolOf(n)?.name ?? 'school' } } });
    } else if (n.age >= 8 && (said.prize ?? -9) <= n.age - 4) {
      const prize = prizeFor(n);
      if (prize && rng.chance(0.3)) {
        said.prize = n.age;
        store.state.pendingEvents.push({ id: 'kid_prize', cast: { kid: n.id, words: { prize, school: schoolOf(n)?.name ?? 'school' } } });
      }
    }
  }
  // Grandchildren go to school too; their parents choose, quietly, and mostly the local school.
  for (const n of livingNpcs().filter((x) => x.role === 'grandchild' && x.alive && x.age >= 5 && x.age < LEAVING_AGE && x.life?.edu && !x.flags.abroad)) {
    const stage = stageOf(n);
    if (stage && stage !== n.life.edu.schoolStage) place(n, giftedKind(n, stage) && rng.chance(0.2) ? giftedKind(n, stage) : 'public', true);
  }
  // A grown child who goes back to study, and whether they finish.
  for (const n of livingNpcs().filter((x) => x.role === 'child' && x.life?.edu)) {
    const e = n.life.edu;
    if (e.back && n.age >= e.back.until) finishBack(n);
    else if (!e.back && n.age >= 26 && n.age <= 52 && !e.degrees.includes('university') && !e.said?.back && rng.chance(0.03)) {
      (e.said ??= {}).back = n.age;
      const course = rng.pick(['a degree in Nursing', 'a degree in Business', 'a degree in Psychology', 'a teaching qualification', 'a degree in Computer Science']);
      store.state.pendingEvents.push({ id: 'kid_back_to_study', cast: { kid: n.id, words: { course, age: String(n.age) } } });
    }
  }
}

function prizeFor(n) {
  const t = n.talents ?? {};
  const best = Object.entries(t).filter(([k]) => ['music', 'sports', 'acting', 'singing', 'dance'].includes(k)).sort((a, b) => b[1] - a[1])[0];
  if (n.life.edu.gpa >= 3.6) return rng.pick(['the year prize', 'the prize for mathematics', 'the prize for English', 'the science prize']);
  if (best && best[1] >= 75) return { music: 'the music prize', sports: 'sportsperson of the year', acting: 'the drama prize', singing: 'the music prize', dance: 'the dance prize' }[best[0]];
  return null;
}

// ---------- Things a parent can do ----------

/** What the People tab offers for this child. */
export function actionsFor(n) {
  if (!atSchool(n)) return grownActions(n);
  const list = [];
  if (n.age >= 6) list.push({ id: 'homework', label: 'Help with their homework' });
  list.push({ id: 'schoolEvent', label: n.life.hobby ? 'Go and watch them perform or play' : 'Go to parents\' evening' });
  if (n.age >= 7) list.push({ id: 'kidTutor', label: 'Pay for a tutor' });
  list.push({ id: 'kidSchool', label: 'Change their school' });
  if (n.age >= 15) list.push({ id: 'uniPlans', label: 'Talk about university' });
  return list;
}
const grownActions = () => [];

export const HOMEWORK = [
  { id: 'gentle', label: 'Sit with them, patiently', sub: 'Slow, and it keeps the peace.' },
  { id: 'strict', label: 'Drill them until it is right', sub: 'Works on some children. Not on all.' },
  { id: 'free', label: 'Leave them to work it out', sub: 'Some children do better without you hovering.' },
];

/** Homework help, once a year. Strictness is not always best: it depends on the child. */
export function homework(id, style) {
  const n = npcOf(id);
  const p = player();
  if (!atSchool(n)) return result(false, 'Not now.', 'neutral');
  if (!spendAction(n, 'homework')) return result(false, `You have already been through ${n.firstName}'s homework this year.`, 'neutral');
  const e = n.life.edu;
  let boost = 0;
  let text;
  if (style === 'strict') {
    // A child who pushes back, or who does not trust you, fights it.
    if (n.meters.crazy < 50 && n.meters.relationship >= 40) {
      boost = 0.25 * (0.75 + p.hidden.discipline / 200);
      bump(n, -2);
      text = `Every evening at the kitchen table, until it is right. ${n.firstName}'s work improves. ${they(n).replace(/^./, (c) => c.toUpperCase())} does not thank you for it.`;
    } else {
      boost = -0.05;
      bump(n, -7);
      text = `It ends with a slammed door. Very little homework gets done in your house for a while after that.`;
    }
  } else if (style === 'free') {
    const able = n.meters.intellect >= 62;
    boost = able ? 0.12 : 0;
    bump(n, 1);
    text = able ? `${n.firstName} works it out alone, and is prouder of it for that.` : `Left to it, ${n.firstName}'s homework mostly stays in the bag.`;
  } else {
    boost = 0.15 + (n.meters.relationship - 50) / 400 + (p.stats.charm - 50) / 500;
    bump(n, 3);
    text = `You sit with ${n.firstName} through the fractions, then the spellings, then the questions that are not about homework at all.`;
  }
  e.boost = Math.round(clamp((e.boost ?? 0) + boost, -0.3, 0.5) * 100) / 100;
  log(text, 'system', boost > 0 ? 'good' : boost < 0 ? 'bad' : 'neutral');
  return result(boost >= 0, text, boost > 0 ? 'good' : boost < 0 ? 'bad' : 'neutral');
}

export const TUTOR_COST = 1500;
export function tutor(id) {
  const n = npcOf(id);
  const p = player();
  const c = country();
  if (!atSchool(n)) return result(false, 'Not now.', 'neutral');
  const cost = localMoney(TUTOR_COST, c);
  if (p.finance.cash < cost) return result(false, `A tutor costs ${fmtMoney(cost, c)} for the year. You do not have it.`, 'neutral');
  if (!spendAction(n, 'tutor')) return result(false, `${n.firstName} already has a tutor this year.`, 'neutral');
  p.finance.cash -= cost;
  const e = n.life.edu;
  const add = e.gpa >= 3.5 ? 0.08 : 0.25;
  e.boost = Math.round(clamp((e.boost ?? 0) + add, -0.3, 0.5) * 100) / 100;
  const text = e.gpa >= 3.5 ? `${n.firstName} gets a tutor, two evenings a week, though there is not much left to teach.` : `${n.firstName} gets a tutor, two evenings a week. It should show in next year's report.`;
  log(text, 'system', 'good');
  return result(true, text);
}

/** Turning up. Some years it is the school concert, some years the match, some years only parents' evening. */
export function attend(id) {
  const n = npcOf(id);
  if (!atSchool(n)) return result(false, 'Not now.', 'neutral');
  if (!spendAction(n, 'schoolEvent')) return result(false, `You have already been to ${n.firstName}'s school this year.`, 'neutral');
  const p = player();
  bump(n, 6);
  p.stats.mood = clamp(p.stats.mood + 3);
  const hobby = n.life.hobby;
  let text;
  if (hobby) {
    n.talents[hobby] = clamp((n.talents[hobby] ?? 0) + 2);
    text = { music: `You sit in a cold hall through the whole school concert for six minutes of ${n.firstName}. Worth it.`,
      sports: `You stand on the touchline in the rain and shout. ${n.firstName} pretends not to hear, and plays better.`,
      acting: `You watch ${n.firstName} in the school play from the third row. ${they(n).replace(/^./, (c) => c.toUpperCase())} found you in the audience straight away.`,
      singing: `${n.firstName} has a solo in the choir concert. You hold your breath for the whole of it.`,
      dance: `The dance show runs an hour over. ${n.firstName} is in four numbers and you clap for all of them.` }[hobby];
  } else {
    const g = n.life.edu.gpa;
    text = `Parents' evening at ${schoolOf(n)?.name ?? 'the school'}: five minutes with each teacher. ${g >= 3.3 ? `They all say ${n.firstName} is a pleasure to teach.` : g >= 2.3 ? `They say ${n.firstName} could do more, and is liked.` : `They say ${n.firstName} is struggling, and ask what is happening at home.`}`;
  }
  log(text, 'system', 'good');
  return result(true, text);
}

/** Schools this child could move to, now. */
export function schoolOptions(id) {
  const n = npcOf(id);
  const stage = stageOf(n) ?? 'elementary';
  return Object.values(KIND_BY_ID).filter((k) => k.id !== 'palace' && k.id !== 'home').map((k) => ({ id: k.id, name: k.name, blurb: k.blurb, fee: k.fee ? localMoney(k.fee, country()) : 0,
    why: sch.barred(k, stage, asPupil(n)), now: n.life.edu.kind === k.id }));
}
export function moveSchool(id, kindId, how = 'parent') {
  const n = npcOf(id);
  if (!atSchool(n)) return result(false, 'Not now.', 'neutral');
  const kind = KIND_BY_ID[kindId];
  const why = sch.barred(kind, stageOf(n) ?? 'elementary', asPupil(n));
  if (why) return result(false, why.replace(/^You would/, `${n.firstName} would`), 'neutral');
  if (n.life.edu.kind === kindId && how === 'parent') return result(false, `${n.firstName} is already at a school like that.`, 'neutral');
  // A child taken away from their friends minds; one sent where their gifts are wanted is glad.
  const suits = giftedKind(n, stageOf(n) ?? 'elementary') === kindId;
  bump(n, suits ? 4 : kind.away ? -5 : n.life.edu.schoolId && n.age >= 9 ? -3 : 0);
  return result(true, place(n, kindId), 'neutral');
}

export const UNI_TALKS = [
  { id: 'mine', label: 'Suggest your old university', sub: 'Your name is on its roll. That is noticed; it is not a promise.' },
  { id: 'suits', label: 'Help them find somewhere that suits them', sub: 'An evening of prospectuses.' },
  { id: 'theirs', label: 'Tell them it is their decision', sub: 'And mean it.' },
  { id: 'work', label: 'Suggest a trade or a job instead', sub: 'University is not the only way.' },
];
/** The player's own university, if they went to one that still stands. */
export function myUniversity() {
  const d = [...player().education.degrees].reverse().find((x) => x.type === 'university' && x.school);
  return d ? Object.values(store.state.universities ?? {}).find((u) => u.name === d.school) ?? null : null;
}
export function uniTalk(id, how) {
  const n = npcOf(id);
  if (!atSchool(n) || n.age < 15) return result(false, 'Not now.', 'neutral');
  if (!spendAction(n, 'uniTalk')) return result(false, `You have already talked it through with ${n.firstName} this year.`, 'neutral');
  const f = n.flags;
  delete f.uniWish; delete f.pushWork;
  let text;
  if (how === 'mine') {
    const u = myUniversity();
    if (!u) return result(false, 'You did not go to college, or it is not there any more.', 'neutral');
    f.uniWish = u.id; f.pushUniversity = true;
    bump(n, n.meters.crazy >= 60 ? -3 : 1);
    text = `You tell ${n.firstName} about ${u.name}: the library, the river, the friends you still have. ${n.meters.crazy >= 60 ? `${they(n).replace(/^./, (c) => c.toUpperCase())} rolls ${their(n)} eyes, and takes the prospectus anyway.` : `${they(n).replace(/^./, (c) => c.toUpperCase())} puts it on the list.`}`;
  } else if (how === 'suits') {
    f.pushUniversity = true; f.uniWish = 'suits';
    bump(n, 3);
    text = `An evening of prospectuses at the kitchen table. ${n.firstName} ends it with a shortlist and a plan.`;
  } else if (how === 'work') {
    f.pushWork = true; delete f.pushUniversity;
    bump(n, n.life.edu.gpa >= 3.2 ? -4 : 2);
    text = n.life.edu.gpa >= 3.2 ? `${n.firstName} hears you out, and does not agree.` : `${n.firstName} looks relieved. Nobody else had suggested it.`;
  } else {
    bump(n, 5);
    text = `You tell ${n.firstName} that whatever ${they(n)} decide${n.gender === 'female' || n.gender === 'male' ? 's' : ''}, you are behind ${them(n)}. ${they(n).replace(/^./, (c) => c.toUpperCase())} remember${n.gender === 'female' || n.gender === 'male' ? 's' : ''} it.`;
  }
  log(text, 'system', 'neutral');
  return result(true, text, 'neutral');
}

/**
 * The university a child goes to, chosen when they decide to go. A parent's
 * university is likelier, and family history is noticed; neither is a guarantee.
 */
export function chooseUniversity(n) {
  const subject = n.life.edu.majorId;
  const unis = catalog(player().countryId).filter((u) => u.kind !== 'open' && (!subject || teaches(u, subject)));
  if (!unis.length) return null;
  const g = n.life.edu.gpa;
  const reach = (u) => g >= (u.bar ?? 2.5) - 0.35;
  const wish = n.flags.uniWish && n.flags.uniWish !== 'suits' ? unis.find((u) => u.id === n.flags.uniWish) : null;
  const surname = n.lastName;
  const family = unis.filter((u) => (uniOf(u.id)?.alumni ?? []).some((x) => x.endsWith(` ${surname}`)));
  let pick = null;
  if (wish && g >= (wish.bar ?? 2.5) - 0.45 && rng.chance(0.75)) pick = wish;
  else if (family.length && rng.chance(0.3)) pick = family.find(reach) ?? null;
  if (!pick) {
    const fits = unis.filter(reach);
    const suit = n.flags.uniWish === 'suits' ? fits.sort((a, b) => (b.rep ?? 50) - (a.rep ?? 50))[0] : null;
    pick = suit ?? rng.pick(fits.length ? fits : unis);
  }
  n.life.edu.uniId = pick.id;
  return pick;
}
export const uniName = (n) => uniOf(n.life?.edu?.uniId)?.name ?? null;
/** On a child's graduation: their name goes on the university's roll, like the player's. */
export function graduated(n) {
  const u = uniOf(n.life?.edu?.uniId);
  const name = `${n.firstName} ${n.lastName}`;
  if (u && !u.alumni.includes(name)) u.alumni.push(name);
  const p = player();
  if (n.role === 'child' && !p.flags.childGraduated) { p.flags.childGraduated = true; milestone(`Watched ${n.firstName} graduate${u ? ` from ${u.name}` : ''}.`, 'family'); }
}

/**
 * What a family brings to a child's decision at eighteen, besides their marks:
 * a parent who went to university and can tell them what it is like, money at
 * home, a school that expects its students to go on. Not inherited ability.
 */
export function familyPull(n) {
  if (n.role !== 'child') return 0;
  const p = player();
  const grad = p.education.degrees.some((d) => ['university', 'graduate', 'medical', 'law', 'doctorate'].includes(d.type));
  const tier = wealthTier();
  const kind = n.life?.edu?.kind;
  return (grad ? 0.15 : 0) + (tier === 'rich' ? 0.1 : tier === 'middle' ? 0.05 : 0) + (['private', 'boarding', 'selective'].includes(kind) ? 0.08 : 0);
}

/** This year's help and the school itself, as they tell in the yearly mark. Spends the help. */
export function edge(n) {
  const e = n.life?.edu;
  if (!e) return { steady: 0, once: 0 };
  const s = schoolOf(n);
  const kind = KIND_BY_ID[e.kind];
  const steady = (kind?.teach ?? 0) + (s && s.kind === 'public' ? (s.funding ?? 0) + cityProfile(s.countryId, s.city).schools / 100 : 0);
  const once = e.boost ?? 0;
  e.boost = 0;
  return { steady, once };
}

// ---------- A grown child back in study ----------

function finishBack(n) {
  const e = n.life.edu;
  const b = e.back;
  delete e.back;
  const odds = clamp(0.5 + (b.backed === 'paid' ? 0.25 : b.backed === 'cheer' ? 0.12 : b.backed === 'doubt' ? -0.15 : 0) + (n.meters.intellect - 50) / 200, 0.15, 0.95);
  if (rng.chance(odds)) {
    e.degrees.push(/teaching/.test(b.course) ? 'teaching' : 'university');
    if (!/teaching/.test(b.course)) {
      const subject = { Nursing: 'nursing', Business: 'business', Psychology: 'psychology', 'Computer Science': 'computer_science' }[(b.course.match(/in (.+)$/) ?? [])[1]];
      if (subject && !e.majorId) e.majorId = subject;
      const open = catalog(player().countryId).find((u) => u.kind === 'open');
      if (open && !e.uniId) { e.uniId = open.id; graduated(n); }
    }
    n.meters.intellect = clamp(n.meters.intellect + 3);
    bump(n, b.backed === 'doubt' ? 0 : 5);
    log(`${n.firstName} has finished ${b.course}, at ${n.age}, after years of evenings. ${b.backed === 'paid' ? 'You paid for it, and you are in the front row.' : b.backed === 'doubt' ? `${they(n).replace(/^./, (c) => c.toUpperCase())} did it without your blessing.` : 'You are in the front row.'}`, 'system', 'good');
  } else {
    log(`${n.firstName} has given up on ${b.course}. Work, and everything else, got in the way.`, 'system', 'neutral');
  }
}

// ---------- The scenes ----------

/** Choices in the parenting scenes come back here. @returns {string|undefined} a line added to the outcome */
export function decide(value, cast = {}) {
  const n = npcOf(cast.kid);
  if (!n?.alive) return undefined;
  const p = player();
  const c = country();
  const stage = stageOf(n) ?? 'elementary';
  const say = (t) => t;
  switch (value) {
    case 'kidState': return atSchool(n) && n.life.edu.kind !== 'public' ? moveSchool(n.id, 'public', 'scene').text : `${n.firstName} stays where ${they(n)} ${v(n, 'is', 'are')}, with the children ${they(n)} ${v(n, 'knows', 'know')}.`;
    case 'kidPrivate': case 'kidBoarding': {
      const kind = value === 'kidBoarding' ? 'boarding' : 'private';
      const r = moveSchool(n.id, kind, 'scene');
      return r.ok ? r.text : `${r.text} ${n.firstName} goes to the local school.`;
    }
    case 'kidGifts': {
      const kind = giftedKind(n, stage);
      if (!kind) return `Nothing about ${n.firstName} yet points one way more than another. The local school it is.`;
      return moveSchool(n.id, kind, 'scene').text;
    }
    case 'kidAsk': {
      if (n.age < 8) { bump(n, 2); return `At ${n.age}, ${n.firstName} wants to go wherever the big slide is. That is the local school.`; }
      const kind = (n.talents && Object.values(n.talents).some((v) => v >= 65) && giftedKind(n, stage)) || 'public';
      bump(n, 5);
      return kind === 'public' ? `${n.firstName} wants to stay with ${their(n)} friends, so ${they(n)} do${n.gender === 'female' || n.gender === 'male' ? 'es' : ''}.` : moveSchool(n.id, kind, 'scene').text;
    }
    case 'kidTutor': { const r = tutor(n.id); return r.ok ? '' : r.text; }
    case 'kidTalk': {
      if (n.meters.relationship >= 50) {
        const why = rng.pick([`${they(n)} cannot see the board from the back`, `${they(n)} ${n.gender === 'female' || n.gender === 'male' ? 'is' : 'are'} being picked on, and has not told anyone`, `${they(n)} ${n.gender === 'female' || n.gender === 'male' ? 'is' : 'are'} bored, not stuck`, `${they(n)} fell behind in one subject and the rest followed`]);
        n.life.edu.boost = clamp((n.life.edu.boost ?? 0) + 0.3, -0.3, 0.5);
        bump(n, 5);
        return say(`It takes an hour, and then it comes out: ${why}. Once you know, it can be fixed.`);
      }
      n.life.edu.boost = clamp((n.life.edu.boost ?? 0) + 0.05, -0.3, 0.5);
      return say(`${n.firstName} shrugs through all of it. Whatever it is, ${they(n)} ${n.gender === 'female' || n.gender === 'male' ? 'is' : 'are'} not telling you.`);
    }
    case 'kidStrict': {
      if (n.meters.crazy < 50 && n.meters.relationship >= 45) { n.life.edu.boost = clamp((n.life.edu.boost ?? 0) + 0.25, -0.3, 0.5); bump(n, -4); return `The phone goes in a drawer, and the marks come up. ${n.firstName} is cold with you for weeks.`; }
      n.life.edu.boost = clamp((n.life.edu.boost ?? 0) - 0.1, -0.3, 0.5); bump(n, -9); n.meters.crazy = clamp(n.meters.crazy + 3);
      return `${n.firstName} finds another phone, and stops trying at school at all. It has become a fight, and ${they(n)} mean${n.gender === 'female' || n.gender === 'male' ? 's' : ''} to win it.`;
    }
    case 'kidAccept': {
      bump(n, 7);
      const hobby = n.life.hobby;
      if (hobby) n.talents[hobby] = clamp((n.talents[hobby] ?? 0) + 4);
      return `${n.firstName} looks at you as if you have handed over something heavy.${hobby ? ` ${they(n).replace(/^./, (c) => c.toUpperCase())} throw${n.gender === 'female' || n.gender === 'male' ? 's' : ''} ${them(n)}self into ${their(n)} ${{ music: 'music', sports: 'sport', acting: 'acting', singing: 'singing', dance: 'dancing' }[hobby]} instead.` : ''}`;
    }
    case 'kidCheer': {
      bump(n, 8);
      if (p.career.careerId) p.career.performance = clamp((p.career.performance ?? 50) - 2);
      return `You leave work early and sit in the front row. ${n.firstName} looks for you before ${they(n)} go${n.gender === 'female' || n.gender === 'male' ? 'es' : ''} up, and finds you.`;
    }
    case 'kidHome': bump(n, 4); return `Cake, and ${n.firstName}'s choice of dinner.`;
    case 'kidDoBetter': {
      bump(n, -7);
      if (n.meters.crazy < 40) { n.life.edu.boost = clamp((n.life.edu.boost ?? 0) + 0.1, -0.3, 0.5); return `${n.firstName} works harder after that, and enjoys it less.`; }
      return `${n.firstName} stops telling you about school.`;
    }
    case 'kidFund': {
      const cost = localMoney(6000, c);
      if (p.finance.cash < cost) return `You do not have ${fmtMoney(cost, c)} to give.`;
      p.finance.cash -= cost;
      bump(n, 10);
      n.life.edu.back = { until: n.age + 3, backed: 'paid', course: cast.words?.course ?? 'a degree' };
      return '';
    }
    case 'kidCheerOn': bump(n, 5); n.life.edu.back = { until: n.age + 3, backed: 'cheer', course: cast.words?.course ?? 'a degree' }; return '';
    case 'kidDoubt': bump(n, -6); n.life.edu.back = { until: n.age + 3, backed: 'doubt', course: cast.words?.course ?? 'a degree' }; return '';
    default: return undefined;
  }
}

/** A line about a child's schooling for the People tab. */
export function schoolLine(n) {
  const e = n.life?.edu;
  if (!e) return null;
  if (atSchool(n) && schoolOf(n)) return ['School', `${schoolOf(n).name}, ${sch.mark(e.gpa)}`];
  if (e.uniId && n.flags.atUniversity) return ['University', `${uniName(n)}, ${MAJOR_BY_ID[e.majorId]?.name ?? ''}`];
  return null;
}

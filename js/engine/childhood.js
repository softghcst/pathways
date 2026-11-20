// Childhood, from birth (data/childhood.js): things to do at each age, with a parent where a small child needs one;
// friends made at the playground, who are people from then on; pocket money that a parent may give or refuse and that
// really comes out of the family's money; chores; and small paid jobs for neighbors before a real job is allowed.
// Nothing here makes a prodigy: what a small child does adds a little, and stops adding.
//
//   p.flags.childhood = { acts: { [age]: [ids] }, early: { music, movement, water, books, people }, jobs: { [age]: [ids] },
//                         allowance: { amount, fromId, since } | null, asked: age, refused: age, saving: { name, cost } | null }
import { rng } from '../rng.js';
import { clamp, localMoney, fmtMoney } from '../util.js';
import { store, player, country, livingNpcs, log, milestone } from '../state.js';
import { makeNpc } from './npcFactory.js';
import { ensureLife } from './npcLives.js';
import { remember } from './conditions.js';
import { spendable, takeFrom } from './npcMoney.js';
import { book } from './ledger.js';
import { workLaw } from './worklife.js';
import { CHILD_ACTIVITIES, CHILD_ACTS_A_YEAR, EARLY_CAP, LESSON_CAP, ALLOWANCE, CHORE_PAY, SMALL_JOBS, SMALL_JOBS_A_YEAR } from '../data/childhood.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const C = () => (player().flags.childhood ??= { acts: {}, early: {}, jobs: {}, allowance: null, saving: null });
const mine = (role) => livingNpcs().filter((n) => n.role === role && player().npcIds.includes(n.id));
/** The adults who look after the player: parents first, then whoever stands in for them. */
export const guardians = () => [...mine('parent'), ...mine('grandparent'), ...mine('guardian')].filter((n) => n.age >= 18);
const friends = () => livingNpcs().filter((n) => ['friend', 'classmate'].includes(n.role) && player().npcIds.includes(n.id) && Math.abs(n.age - player().age) <= 3);
const done = () => (C().acts[player().age] ??= []);

// ---------- Things to do ----------

/** What a child of this age can do now. @returns {{id, label, done, why?}[]} */
export function childActivities() {
  const p = player();
  if (p.age > 15) return [];
  const used = done();
  const full = used.length >= CHILD_ACTS_A_YEAR;
  return CHILD_ACTIVITIES.filter((a) => p.age >= a.ages[0] && p.age <= a.ages[1]).map((a) => {
    const needsParent = a.parent || (a.parentUnder && p.age < a.parentUnder);
    const why = needsParent && !guardians().length ? 'Nobody to take you' : a.sibling && !mine('sibling').length ? 'No brothers or sisters' : a.needsFriend && !friends().length ? 'No friend to ask yet' : null;
    return { id: a.id, label: a.name, done: used.includes(a.id) || (full && !used.includes(a.id)) || !!why, why: used.includes(a.id) ? 'done this year' : full ? 'enough for one year' : why };
  });
}

function grow(path, by, lesson = false) {
  const p = player();
  const [where, key] = path.split('.');
  if (where === 'talents') {
    // A small child's classes add up to a head start and no more; lessons, kept separately, to a little more.
    const c = C(); const tally = lesson ? (c.lessonGain ??= {}) : (c.talentGain ??= {});
    if ((tally[key] ?? 0) >= (lesson ? LESSON_CAP : EARLY_CAP)) return;
    tally[key] = (tally[key] ?? 0) + by;
  }
  p[where][key] = clamp(p[where][key] + by);
}

/** Does one of them. A baby is taken; a child goes. Once each a year, and only so many in a year. */
export function doActivity(id) {
  const p = player();
  const a = CHILD_ACTIVITIES.find((x) => x.id === id);
  const opt = childActivities().find((x) => x.id === id);
  if (!a || !opt) return result(false, 'That is not for you at your age.', 'neutral');
  if (opt.done) return result(false, opt.why === 'done this year' ? 'You have done that this year.' : `${opt.why}.`, 'neutral');
  done().push(id);
  const parent = guardians().length ? rng.pick(guardians()) : null;
  const sibling = mine('sibling').length ? rng.pick(mine('sibling')) : null;
  let friend = friends().length ? rng.pick(friends()) : null;
  let text = a.text.replace('{parent}', parent ? parent.firstName : 'Someone').replace('{sibling}', sibling?.firstName ?? '').replace('{friend}', friend?.firstName ?? '');
  const c = C();
  for (const [k, v] of Object.entries(a.grows ?? {})) {
    if (k === 'early') { if ((c.early[v] ?? 0) < EARLY_CAP) c.early[v] = (c.early[v] ?? 0) + 1; }
    else if (k === 'bond') { if (parent) parent.meters.relationship = clamp(parent.meters.relationship + v); }
    else if (k === 'siblings') { if (sibling) sibling.meters.relationship = clamp(sibling.meters.relationship + v); }
    else if (k === 'friend') { if (friend) { friend.meters.relationship = clamp(friend.meters.relationship + v); friend.lastInteractionAge = p.age; } }
    else grow(k, v, !!a.lesson);
  }
  // Other children: someone new, someone known, a game, a quarrel. Or nobody, and that is fine too.
  if (a.friend && p.age >= 2) {
    const made = livingNpcs().filter((n) => n.flags.metAt === 'playground' || n.flags.metAt === 'club').length;
    const roll = rng.next();
    if (roll < a.friend && made < 4) {
      friend = makeNpc({ role: 'friend', countryId: p.countryId, age: Math.max(1, p.age + rng.int(-1, 1)), relationship: rng.int(45, 65) });
      ensureLife(friend);
      friend.flags.metAt = a.id === 'playground' ? 'playground' : 'club'; friend.flags.metAge = p.age; friend.flags.title = a.id === 'playground' ? 'Friend from the playground' : null;
      if (!friend.flags.title) delete friend.flags.title;
      store.state.npcs[friend.id] = friend; p.npcIds.push(friend.id);
      remember(friend, 'met', a.id === 'playground' ? 'You met at the playground, when you were small.' : 'You met at a club after school.');
      text += ` A child called ${friend.firstName} ${a.id === 'playground' ? 'shares the sandpit with you, and then the afternoon' : 'is put next to you, and you get on'}.`;
      if (made === 0) milestone(`Made a friend: ${friend.firstName}.`, 'life');
    } else if (friend && roll < a.friend + 0.3) {
      const fell = rng.chance(0.2);
      friend.meters.relationship = clamp(friend.meters.relationship + (fell ? -4 : 4)); friend.lastInteractionAge = p.age;
      text += fell ? ` You and ${friend.firstName} fall out over whose turn it is, and make it up by the gate.` : ` ${friend.firstName} is there, and you play together.`;
    } else if (roll > 0.85) text += ' A game starts with children you do not know, and you are in it.';
    else text += ' You play by yourself, quite happily.';
  }
  p.stats.mood = clamp(p.stats.mood + 2);
  log(text, 'system', 'good');
  return result(true, text);
}

/** Early likings come to a small head start: counted in when the skill is first taken up (engine/skills.js). */
export const earlyStart = (kind) => Math.min(EARLY_CAP, C().early[kind] ?? 0);

// ---------- Pocket money ----------

const allowanceAmount = (age) => localMoney(ALLOWANCE.yearly(age), country());
export const canAskAllowance = () => { const p = player(); return p.age >= ALLOWANCE.from && p.age <= ALLOWANCE.until && !C().allowance && C().asked !== p.age && guardians().length > 0; };

/** Asks a parent for pocket money. They decide: by what the family has, how they are, and how the two of them get on. */
export function askAllowance() {
  const p = player();
  if (!canAskAllowance()) return result(false, C().allowance ? 'You have an allowance.' : C().asked === p.age ? 'You have asked this year.' : 'There is nobody to ask.', 'neutral');
  const c = C();
  c.asked = p.age;
  const parent = guardians().sort((a, b) => spendable(b) - spendable(a))[0];
  const amount = allowanceAmount(p.age);
  const afford = spendable(parent) >= amount * 6;
  const chance = clamp(0.35 + (parent.meters.generosity - 50) / 120 + (parent.meters.relationship - 50) / 200 + (afford ? 0.2 : -0.35), 0.03, 0.95);
  if (!rng.chance(chance)) {
    c.refused = p.age;
    const text = afford ? `${parent.firstName} says no. "When you are older, and when you have shown you can look after it."` : `${parent.firstName} says there is not the money for it just now.`;
    log(text, 'system', 'neutral');
    return result(false, text, 'neutral');
  }
  c.allowance = { amount, fromId: parent.id, since: p.age };
  const text = `${parent.firstName} agrees to pocket money: ${fmtMoney(amount, country())} a year, for as long as the family can manage it.`;
  log(text, 'system', 'good');
  milestone('Got an allowance.', 'money');
  return result(true, text);
}

/** Money from a parent to the child: out of what the parent really has, and no more than that. */
function payFrom(parent, amount, desc) {
  const p = player();
  const can = Math.min(amount, spendable(parent));
  if (can <= 0) return 0;
  takeFrom(parent, can);
  p.finance.cash += can;
  book({ cat: 'giftIn', src: 'year', desc });
  return can;
}

export const canDoChores = () => { const p = player(); return p.age >= 6 && p.age <= 17 && guardians().length > 0 && !done().includes('chores'); };
/** A year of chores done properly: a little money if a parent pays for them, and the habit either way. */
export function doChores() {
  const p = player();
  if (!canDoChores()) return result(false, 'You have done your chores this year.', 'neutral');
  done().push('chores');
  p.hidden.discipline = clamp(p.hidden.discipline + 1);
  const c = C();
  const parent = store.state.npcs[c.allowance?.fromId] ?? guardians()[0];
  parent.meters.relationship = clamp(parent.meters.relationship + 2);
  const due = c.allowance ? Math.round(c.allowance.amount * CHORE_PAY) : 0;
  const got = due && parent.alive ? payFrom(parent, due, 'For doing your chores') : 0;
  const text = got ? `Dishes, bins, your room. ${parent.firstName} pays you ${fmtMoney(got, country())} for a year of it.` : 'Dishes, bins, your room. Nobody pays you for it, and it is noticed all the same.';
  log(text, 'system', 'good');
  return result(true, text);
}

/** Something to save up for. */
export function saveFor(name, cost) { C().saving = { name, cost: localMoney(cost, country()) }; return result(true, `You are saving for ${name}.`, 'neutral'); }
export function buySaved() {
  const p = player();
  const s = C().saving;
  if (!s) return result(false, 'You are not saving for anything.', 'neutral');
  if (p.finance.cash < s.cost) return result(false, `You have ${fmtMoney(p.finance.cash, country())} of the ${fmtMoney(s.cost, country())} you need.`, 'neutral');
  p.finance.cash -= s.cost;
  book({ cat: 'leisure', src: 'action', desc: s.name });
  p.stats.mood = clamp(p.stats.mood + 8);
  p.hidden.discipline = clamp(p.hidden.discipline + 2);
  C().saving = null;
  const text = `You count it out on the counter yourself: ${s.name}, paid for with your own money.`;
  log(text, 'system', 'good');
  milestone(`Saved up and bought ${s.name}.`, 'money');
  return result(true, text);
}
export const SAVING_GOALS = [['a kite', 20], ['a football', 35], ['a bicycle', 180], ['a record player', 260]];

// ---------- Small jobs ----------

/** Jobs for neighbors that a child of this age may do, here and now. */
export function smallJobs() {
  const p = player();
  const had = (C().jobs[p.age] ??= []);
  const law = workLaw().workAge ?? 14;
  return SMALL_JOBS.filter((j) => p.age >= j.minAge && p.age <= 17).map((j) => {
    const why = j.law && p.age < Math.min(law, 16) ? `Not before ${Math.min(law, 16)} here` : j.needs && p.stats.intellect < j.needs ? 'You would need to be better at school yourself' : !guardians().length ? null : null;
    return { id: j.id, label: j.name, pay: localMoney(j.pay, country()), done: had.includes(j.id) || had.length >= SMALL_JOBS_A_YEAR || !!why, why: had.includes(j.id) ? 'done this year' : had.length >= SMALL_JOBS_A_YEAR ? 'school comes first' : why };
  });
}
export function doSmallJob(id) {
  const p = player();
  const j = smallJobs().find((x) => x.id === id);
  if (!j) return result(false, 'That is not a job for you yet.', 'neutral');
  if (j.done) return result(false, `${j.why[0].toUpperCase()}${j.why.slice(1)}.`, 'neutral');
  C().jobs[p.age].push(id);
  p.finance.cash += j.pay;
  book({ cat: 'gigs', src: 'action', desc: j.label });
  p.hidden.discipline = clamp(p.hidden.discipline + 1);
  // Two jobs in a year is time taken from school work.
  if (C().jobs[p.age].length >= 2 && p.education?.enrolled && p.education.gpa != null) p.education.gpa = Math.max(0, Math.round((p.education.gpa - 0.05) * 100) / 100);
  const text = `${j.label}: ${fmtMoney(j.pay, country())}, earned.`;
  log(text, 'system', 'good');
  return result(true, text);
}

// ---------- The year ----------

/** Once a year: the allowance is paid if the family can still pay it, and ends when childhood does. */
export function tickChildhood() {
  const p = player();
  const c = p.flags.childhood;
  if (!c?.allowance) return;
  const parent = store.state.npcs[c.allowance.fromId];
  if (p.age > ALLOWANCE.until || !parent?.alive) {
    c.allowance = null;
    if (p.age <= ALLOWANCE.until) log('Your allowance has stopped.', 'system', 'neutral');
    return;
  }
  c.allowance.amount = Math.max(c.allowance.amount, allowanceAmount(p.age));
  const got = payFrom(parent, c.allowance.amount, 'Pocket money');
  if (got < c.allowance.amount) log(got ? `Money is tight at home: ${parent.firstName} could only give you ${fmtMoney(got, country())} this year.` : `There was no pocket money this year. ${parent.firstName} says things are hard.`, 'system', 'neutral');
}

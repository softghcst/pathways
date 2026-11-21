// Life at university: the course as credits and a workload, a minor, a
// professor who knows the player, a roommate who is a person, student
// organizations, internships, and a year abroad. Getting in is in
// engine/university.js; fees, housing costs and graduation are in engine/education.js.
//
// On the player:
//   p.education.credits      credits earned toward the degree (120 for a full one)
//   p.education.load         'light' | 'standard' | 'heavy': credits attempted a year, and what it does to marks
//   p.education.minorId      a second subject, recorded on the degree
//   p.education.campus = { orgs: { orgId: { since, standing, role } }, postings, abroad, probation, officeAge }
//   p.flags.internships      [{ age, employer, careerId, title, went }]   kept for good
//   p.flags.returnOffer      { careerId, employer }   a job held open by an employer who liked the intern
//   p.flags.studiedIn        [countryId]
// Roommates are NPCs with flags.tag 'roommate' and flags.habit; professors, NPCs with flags.tag 'professor'.
import { rng } from '../rng.js';
import { clamp, localMoney, localWage, fmtMoney, theCountry } from '../util.js';
import { store, player, country, npcsByRole, livingNpcs, log, milestone } from '../state.js';
import { COUNTRIES } from '../data/countries.js';
import { CAREERS } from '../data/careers.js';
import { MAJOR_BY_ID } from '../data/majors.js';
import { SPOKEN, SKILL_BY_ID } from '../data/skills.js';
import { ORGS, ORG_BY_ID, MAX_ORGS, LOADS, MAJOR_GROUP, HABITS, EMPLOYERS, DEGREE_CREDITS } from '../data/universities.js';
import { PLAYS } from '../data/education.js';
import { makeNpc } from './npcFactory.js';
import { uniOf, firstInFamily } from './university.js';
import { unbank, defend as defendThesis } from './adulted.js';
import { legislativePosting, servedIntern } from './edlegacy.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const onCampus = (p = player()) => p.education.enrolled && ['university', 'community'].includes(p.education.stage);
export const atUniversity = onCampus;
const state = () => (player().education.campus ??= { orgs: {} });
const val = (p, path) => path.split('.').reduce((o, k) => o?.[k], p) ?? 0;
const add = (npc) => { store.state.npcs[npc.id] = npc; player().npcIds.push(npc.id); npc.lastInteractionAge = player().age; return npc; };
const where = () => player().education.schoolName ?? 'college';

// ---------- Starting and finishing ----------

/** Called on enrolling: the course begins with no credits, a standard load, and one professor who will come to know the player. */
export function start(transfer = false) {
  const p = player();
  const e = p.education;
  e.credits = transfer ? DEGREE_CREDITS / 2 : 0;
  if (e.stage === 'university') e.credits = unbank(e, e.credits, (a, b) => !!MAJOR_GROUP[a] && MAJOR_GROUP[a] === MAJOR_GROUP[b]);
  e.load = 'standard';
  e.minorId = null;
  e.campus = { orgs: {} };
  if (!livingNpcs().some((n) => ['professor', 'favProfessor'].includes(n.flags.tag))) {
    const prof = add(makeNpc({ role: 'mentor', countryId: p.countryId, age: rng.int(34, 64), relationship: rng.int(38, 52) }));
    prof.flags.tag = 'professor';
    prof.flags.title = `Professor of ${MAJOR_BY_ID[e.majorId]?.name ?? 'your subject'}`;
  }
}
/** What the degree needs in all. */
export const creditsNeeded = () => (player().education.stage === 'community' ? DEGREE_CREDITS / 2 : DEGREE_CREDITS);
/** Whether there are credits enough to graduate. Courses begun before credits existed finish by years, as they always did. */
export const finished = () => { const e = player().education; return e.credits != null && e.credits >= creditsNeeded(); };

/** Called on leaving, however it ends: organizations are left behind, the people are not. */
export function finish() {
  const e = player().education;
  for (const n of livingNpcs()) if (n.flags.tag === 'professor') { n.flags.tag = 'oldProfessor'; n.flags.title = `${n.flags.title}, who taught you`; }
  delete e.campus;
  delete e.credits;
  delete e.load;
}

// ---------- Studies ----------

export const loads = () => LOADS.filter((l) => (l.id === 'part') === !!player().education.partTime).map((l) => ({ ...l, current: (player().education.load ?? 'standard') === l.id }));
export function setLoad(id) {
  const l = LOADS.find((x) => x.id === id);
  if (!onCampus() || !l || (l.id === 'part') !== !!player().education.partTime) return result(false, 'That is not open to you.', 'neutral');
  player().education.load = id;
  return result(true, `${l.name}: ${l.blurb}`, 'neutral');
}
/** What the workload, a minor and organizations do to the year's marks. */
export function markEdge() {
  const e = player().education;
  if (!onCampus()) return 0;
  const l = LOADS.find((x) => x.id === (e.load ?? 'standard'));
  let g = l.mark + (e.minorId ? -0.05 : 0);
  for (const id of Object.keys(e.campus?.orgs ?? {})) g += ORG_BY_ID[id]?.mark ?? 0;
  return g;
}
/** Credits for the year just finished. A failed year earns half. */
export function earnCredits(yearMark) {
  const e = player().education;
  if (e.credits == null) return;
  const l = LOADS.find((x) => x.id === (e.load ?? 'standard'));
  e.credits = Math.min(creditsNeeded(), e.credits + Math.round(l.credits * (yearMark < 1 ? 0.5 : 1)));
}
export const minors = () => Object.values(MAJOR_BY_ID).filter((m) => !m.audition && m.id !== player().education.majorId).map((m) => ({ id: m.id, name: m.name }));
export function setMinor(id) {
  const e = player().education;
  if (!onCampus() || e.stage !== 'university') return result(false, 'A minor is taken alongside a university degree.', 'neutral');
  if (id && (!MAJOR_BY_ID[id] || id === e.majorId)) return result(false, 'That cannot be your minor.', 'neutral');
  e.minorId = id || null;
  return result(true, id ? `You are taking a minor in ${MAJOR_BY_ID[id].name}. It is more work, and it goes on your degree.` : 'You have dropped your minor.', 'neutral');
}
/** What changing course costs in credits: nothing between subjects of the same family, a year's worth between families. */
export function switchCost(fromId, toId) {
  const e = player().education;
  if (e.credits == null || e.credits < 30) return 0;
  return MAJOR_GROUP[fromId] && MAJOR_GROUP[fromId] === MAJOR_GROUP[toId] ? 0 : 30;
}

const professor = () => livingNpcs().find((n) => ['professor', 'favProfessor'].includes(n.flags.tag)) ?? null;
/** Going to see the professor: once a year. Over time it becomes someone who will write for the player. */
export function officeHours() {
  const p = player();
  const c = state();
  const prof = professor();
  if (!onCampus() || !prof) return result(false, 'There is nobody to go and see.', 'neutral');
  if (c.officeAge === p.age) return result(false, 'You have already been this year. Twice would look needy.', 'neutral');
  c.officeAge = p.age;
  prof.meters.relationship = Math.round(clamp(prof.meters.relationship + rng.int(6, 11)));
  prof.lastInteractionAge = p.age;
  p.education.effort = clamp(p.education.effort + 6);
  let text = `You take your questions to ${prof.firstName} ${prof.lastName}'s office. Twenty minutes becomes an hour.`;
  if (prof.meters.relationship >= 62 && !p.flags.profRec) { p.flags.profRec = true; text += ' "If you ever need someone to write for you, ask me."'; }
  log(text, 'system', 'good');
  return result(true, text);
}

// ---------- Roommates ----------

/** Makes a roommate someone in particular. */
export function fleshRoommate(n) {
  if (!n || n.flags.habit) return;
  n.flags.habit = rng.pick(HABITS).id;
  n.flags.suits = rng.int(-2, 8);
}
export const habitOf = (n) => HABITS.find((h) => h.id === n?.flags.habit) ?? null;
const roommate = () => store.state.npcs[player().education.roommateId] ?? null;
/** A stranger to share a room with: used for halls, where nobody chooses. */
export function assignRoommate() {
  const p = player();
  const n = add(makeNpc({ role: 'friend', countryId: p.countryId, age: Math.max(17, p.age + rng.int(-1, 1)), relationship: rng.int(35, 58) }));
  n.flags.tag = 'roommate'; n.flags.title = 'Roommate'; n.flags.metAt = where();
  fleshRoommate(n);
  p.education.roommateId = n.id;
  return n;
}

// ---------- Organizations ----------

export function orgOptions() {
  const p = player();
  const c = state();
  return ORGS.filter((o) => !o.only || o.only.includes(p.countryId)).map((o) => {
    const mine = c.orgs[o.id];
    let why = '';
    if (!mine && Object.keys(c.orgs).length >= MAX_ORGS) why = `You only have time for ${MAX_ORGS}.`;
    else if (o.needsParty && !p.flags.party) why = 'For members of a political party.';
    else if (o.dues && p.finance.cash < localMoney(o.dues, country())) why = 'You cannot afford the dues.';
    return { id: o.id, name: o.name, blurb: o.blurb, joined: !!mine, role: mine?.role === 'leader' ? o.leader : mine ? 'Member' : '', standing: mine?.standing ?? 0, why,
      dues: o.dues ? fmtMoney(localMoney(o.dues, country()), country()) : '' };
  });
}
export function joinOrg(id) {
  const p = player();
  const c = state();
  const o = ORG_BY_ID[id];
  if (!onCampus() || !o || c.orgs[id]) return result(false, 'You cannot join that.', 'neutral');
  const opt = orgOptions().find((x) => x.id === id);
  if (!opt || opt.why) return result(false, opt?.why ?? 'It does not exist here.', 'neutral');
  c.orgs[id] = { since: p.age, standing: 20, role: 'member' };
  // Joining anything means meeting someone.
  const friend = add(makeNpc({ role: 'friend', countryId: p.countryId, age: p.age + rng.int(-1, 2), relationship: rng.int(42, 58) }));
  friend.flags.metAt = where(); friend.flags.org = id;
  const text = `You joined the ${o.name.toLowerCase()} at ${where()}. ${friend.firstName} ${friend.lastName} shows you the ropes.`;
  log(text, 'system', 'good');
  return result(true, text);
}
export function leaveOrg(id) {
  const c = state();
  if (!c.orgs[id]) return result(false, 'You are not a member.', 'neutral');
  delete c.orgs[id];
  return result(true, `You left the ${ORG_BY_ID[id].name.toLowerCase()}.`, 'neutral');
}

function orgsYear() {
  const p = player();
  const c = state();
  for (const [id, life] of Object.entries(c.orgs)) {
    const o = ORG_BY_ID[id];
    if (!o) continue;
    const skill = o.factor ? val(p, o.factor) : 50;
    life.standing = Math.round(clamp(life.standing + 12 + (skill - 50) / 5 + rng.int(-3, 4)));
    if (o.dues) p.finance.cash = Math.max(0, p.finance.cash - localMoney(o.dues, country()));
    if (o.polExp) p.counters.polExp = Math.min(40, (p.counters.polExp ?? 0) + o.polExp);
    if (o.yearly) for (const [group, vals] of Object.entries(o.yearly)) for (const [k, v] of Object.entries(vals)) p[group][k] = clamp((p[group][k] ?? 0) + v);
    for (const n of livingNpcs()) if (n.flags.org === id) { n.meters.relationship = Math.round(clamp(n.meters.relationship + rng.int(0, 5))); n.lastInteractionAge = p.age; }
    if (o.stage) {
      // The society's show: cast on merit, like any other.
      const mine = p.talents.acting * 0.6 + p.talents.singing * 0.2 + p.stats.charm * 0.2 + rng.int(-8, 10) + (life.standing - 30) / 8;
      const bar = rng.around(64, 22);
      const role = mine >= bar && mine >= 66 ? 'the lead' : mine >= 54 ? 'a supporting part' : mine >= 38 ? 'the ensemble' : null;
      const show = rng.pick(PLAYS);
      if (role) { (p.flags.performances ??= []).push({ year: store.state.year, age: p.age, show, role, where: where() }); p.talents.acting = clamp(p.talents.acting + (role === 'the lead' ? 5 : 3)); log(`The ${o.name.toLowerCase()} put on ${show}, and you had ${role}.`, 'system', 'good'); }
      else log(`The ${o.name.toLowerCase()} put on ${show}. You were not cast, and worked the lights.`, 'system', 'neutral');
    }
    if (life.role === 'member' && life.standing >= 55 && c.electionAt !== p.age && !finished() && rng.chance(0.5)) {
      c.electionAt = p.age;
      store.state.pendingEvents.push({ id: 'campus_election', cast: { org: id, words: { org: o.name.toLowerCase(), post: o.leader.toLowerCase() } } });
    }
  }
}

// ---------- Internships ----------

/** The careers a subject leads toward. */
const fields = (majorId) => CAREERS.filter((c) => c.type === 'fulltime' && (c.req?.majors ?? []).includes(majorId));
/** This summer's postings. Settled once a year, so they cannot be re-rolled. */
export function postings() {
  const p = player();
  const e = p.education;
  const c = state();
  if (!onCampus() || e.stage !== 'university' || (e.credits ?? 0) < 30) return [];
  if (c.postings?.age !== p.age) {
    const pool = fields(e.majorId);
    const list = [];
    for (let i = 0; i < 3; i++) {
      const career = pool.length ? pool[i % pool.length] : null;
      const sought = i === 0; // one of the three is the one everybody wants
      list.push({ id: `i${i}`, employer: `${rng.pick(EMPLOYERS.first)} ${rng.pick(EMPLOYERS.second)}`, careerId: career?.id ?? null, title: `${career ? career.name : 'Office'} intern`, sought,
        pay: localWage(sought ? 9000 : rng.int(2500, 6000), country()), applied: false });
    }
    // For students of politics, or who have been in student politics: an office in the legislature.
    const leg = legislativePosting(p.countryId);
    if (leg) list[2] = { ...list[2], ...leg, careerId: null };
    c.postings = { age: p.age, list };
  }
  return c.postings.list;
}
/** How likely an application is to succeed. */
function internChance(post) {
  const p = player();
  const e = p.education;
  const c = state();
  const u = uniOf(e.schoolId);
  const led = Object.values(c.orgs).some((o) => o.role === 'leader');
  const before = (p.flags.internships ?? []).length;
  return clamp((post.sought ? 0.12 : 0.4) + ((e.gpa || 2.5) - 2.6) * 0.28 + (led ? 0.1 : 0) + (p.flags.profRec ? 0.15 : 0) + ((u?.rep ?? 55) - 55) / 300 + (u?.perk === 'network' ? 0.06 : 0) + Math.min(0.15, before * 0.1) + (p.stats.charm - 50) / 400, 0.03, 0.93);
}
export const internOutlook = (post) => { const x = internChance(post); return x >= 0.65 ? 'Likely' : x >= 0.4 ? 'A fair chance' : x >= 0.2 ? 'A reach' : 'A long shot'; };

/** Applies for a posting. One answer each; one internship a summer. */
export function applyIntern(id) {
  const p = player();
  const c = state();
  const post = postings().find((x) => x.id === id);
  if (!post || post.applied) return result(false, 'You have already had their answer.', 'neutral');
  if (c.internAge === p.age) return result(false, 'You already have somewhere to be this summer.', 'neutral');
  post.applied = true;
  if (!rng.chance(internChance(post))) {
    const text = `${post.employer} thanks you for your interest, and regrets.`;
    log(text, 'system', 'bad');
    return result(false, text);
  }
  c.internAge = p.age;
  p.finance.cash += post.pay; p.finance.lifetimeEarned += post.pay;
  p.stats.intellect = clamp(p.stats.intellect + 1);
  p.hidden.discipline = clamp(p.hidden.discipline + 2);
  // How it went decides whether they want the intern back.
  const went = Math.round(clamp(45 + (p.hidden.discipline - 50) / 2 + (p.stats.intellect - 50) / 3 + (p.stats.charm - 50) / 5 + rng.int(-15, 18)));
  const boss = add(makeNpc({ role: 'mentor', countryId: p.countryId, age: rng.int(30, 58), relationship: Math.round(clamp(35 + went / 3)) }));
  boss.flags.tag = 'supervisor'; boss.flags.title = `Your supervisor at ${post.employer}`;
  (p.flags.internships ??= []).push({ age: p.age, employer: post.employer, careerId: post.careerId, title: post.title, went });
  let text = `You spend the summer at ${post.employer} as ${/^[aeiou]/i.test(post.title) ? 'an' : 'a'} ${post.title.toLowerCase()}, under ${boss.firstName} ${boss.lastName}, and are paid ${fmtMoney(post.pay, country())}. `;
  text += went >= 70 ? 'By August they are giving you real work, and asking what your plans are.' : went >= 45 ? 'You learn how the place actually runs, which is not how the brochure says.' : 'You make a great deal of coffee, and one serious mistake.';
  if (post.figureId) text += servedIntern(post.figureId, went);
  if (went >= 70 && post.careerId) { p.flags.returnOffer = { careerId: post.careerId, employer: post.employer }; text += ' There will be a job for you there when you graduate.'; }
  log(text, 'system', went >= 45 ? 'good' : 'neutral');
  if ((p.flags.internships.length === 1)) milestone(`First internship, at ${post.employer}.`, 'career');
  return result(true, text);
}

// ---------- A year abroad ----------

/** Where the university sends its students. Four countries, fixed for the institution. */
export function abroadOptions() {
  const p = player();
  const e = p.education;
  const c = state();
  if (!onCampus() || e.stage !== 'university' || c.abroad || (p.flags.studiedIn ?? []).length) return [];
  const u = store.state.universities?.[e.schoolId];
  if (!u) return [];
  u.partners ??= Object.keys(COUNTRIES).filter((id) => id !== p.countryId).sort(() => rng.next() - 0.5).slice(0, 4);
  const lang = (cid) => Object.entries(SPOKEN).find(([, list]) => list.includes(cid))?.[0];
  const cost = localMoney(3500, country());
  return u.partners.map((cid) => ({ id: cid, name: COUNTRIES[cid].name, flag: COUNTRIES[cid].flag, language: lang(cid) ? SKILL_BY_ID[lang(cid)].name : null, cost,
    why: (e.credits ?? 0) < 30 ? 'After your first year.' : (e.credits ?? 0) >= 90 ? 'Too late: your final year is here.' : (e.gpa || 0) < 2.2 ? 'Your marks are not good enough to be sent.' : p.finance.cash < cost ? 'You cannot afford the travel.' : '' }));
}
export function goAbroad(cid) {
  const p = player();
  const c = state();
  const o = abroadOptions().find((x) => x.id === cid);
  if (!o || o.why) return result(false, o?.why ?? 'That is not on offer.', 'neutral');
  p.finance.cash -= o.cost;
  c.abroad = { countryId: cid, age: p.age };
  const text = `It is arranged: you will spend the coming year studying in ${theCountry(COUNTRIES[cid].name)}. Your place at ${where()} is kept, and so is everyone at home.`;
  log(text, 'system', 'good');
  return result(true, text);
}
/** The year abroad, lived. */
function abroadYear() {
  const p = player();
  const c = state();
  const a = c.abroad;
  if (!a || a.done) return;
  a.done = true;
  const there = COUNTRIES[a.countryId];
  const lang = Object.entries(SPOKEN).find(([, list]) => list.includes(a.countryId))?.[0];
  if (lang) { p.skills ??= {}; p.skills[lang] = clamp((p.skills[lang] ?? 0) + rng.int(18, 28)); }
  p.stats.charm = clamp(p.stats.charm + 2); p.stats.mood = clamp(p.stats.mood + 8); p.hidden.willpower = clamp(p.hidden.willpower + 2);
  (p.flags.studiedIn ??= []).push(a.countryId);
  const friend = add(makeNpc({ role: 'friend', countryId: a.countryId, age: p.age + rng.int(-1, 2), relationship: rng.int(55, 72) }));
  friend.flags.abroad = a.countryId; friend.flags.title = 'Friend from your year abroad'; friend.flags.metAt = there.name;
  log(`Your year in ${theCountry(there.name)}: a room the size of a cupboard, ${lang ? `${SKILL_BY_ID[lang].name} learned the hard way, ` : ''}and ${friend.firstName} ${friend.lastName}, who you will know for the rest of your life.`, 'system', 'good');
  milestone(`Studied for a year in ${theCountry(there.name)}.`, 'education');
}

// ---------- The year ----------

/** Yearly, while in college. `yearMark`: the mark just earned. */
export function tickCampus(yearMark) {
  const p = player();
  const e = p.education;
  if (!onCampus()) return;
  const c = state();
  earnCredits(yearMark);
  abroadYear();
  orgsYear();
  // The roommate: a year in the same rooms brings two people closer, or does not.
  const mate = roommate();
  if (mate?.alive) {
    fleshRoommate(mate);
    mate.meters.relationship = Math.round(clamp(mate.meters.relationship + mate.flags.suits + rng.int(-2, 3)));
    mate.lastInteractionAge = p.age;
    if (mate.meters.relationship < 55 && c.clashAt !== p.age - 1 && !finished() && rng.chance(0.3)) { c.clashAt = p.age; store.state.pendingEvents.push({ id: 'roommate_clash', cast: { mate: mate.id, words: { mate: mate.firstName, habit: habitOf(mate).clash } } }); }
    else if (mate.meters.relationship >= 75 && !mate.flags.close) { mate.flags.close = true; log(`Somewhere in the last year ${mate.firstName} stopped being your roommate and became one of your closest friends.`, 'system', 'good'); }
  } else if (e.housing === 'dorm' && !mate) { const n = assignRoommate(); log(`You have a new roommate: ${n.firstName} ${n.lastName}, who ${habitOf(n).line}.`); }
  // Standing: a bad year is a warning before it is anything worse.
  if (e.gpa < 1.8 && e.gpa >= 1.2 && !c.probation && !finished()) { c.probation = true; store.state.pendingEvents.push({ id: 'academic_probation', cast: { words: { school: where() } } }); }
  else if (e.gpa >= 2.2 && c.probation) { c.probation = false; log('Your marks are back where they need to be. You are off academic probation.', 'system', 'good'); }
}

/** Called when a university degree is finished: what the years add up to. @returns {object} extras for the degree record */
export function onGraduate() {
  const p = player();
  const e = p.education;
  const first = firstInFamily();
  if (first && !p.flags.firstGraduate) { p.flags.firstGraduate = true; milestone('The first in the family to graduate from university.', 'education'); }
  store.state.pendingEvents.push({ id: 'uni_graduation', cast: { words: { school: where(), first: first ? 'Nobody in your family has done this before, and all of them have come. ' : '', offer: p.flags.returnOffer ? `${p.flags.returnOffer.employer} has written to say the job is yours when you want it. ` : '' } } });
  return { minorId: e.minorId ?? undefined, orgs: Object.entries(e.campus?.orgs ?? {}).filter(([, o]) => o.role === 'leader').map(([id]) => ORG_BY_ID[id].name) };
}

/** A choice in a campus scene. @returns {string} */
export function decide(what, cast = {}) {
  const p = player();
  const e = p.education;
  const c = state();
  const mate = store.state.npcs[cast.mate];
  const rel = (n, d) => { if (n) { n.meters.relationship = Math.round(clamp(n.meters.relationship + d)); n.lastInteractionAge = p.age; } };
  switch (what) {
    case 'clashTalk': if (rng.chance(0.45 + p.stats.charm / 250)) { rel(mate, 12); return `You say it out loud, kindly. ${mate?.firstName ?? 'Your roommate'} had no idea, and is mortified. Things are better.`; } rel(mate, -6); return 'It turns into a list of everything either of you has ever done wrong.';
    case 'clashNotes': rel(mate, -8); p.stats.mood = clamp(p.stats.mood - 3); return 'You leave a note. A note appears in reply. Within a month the fridge door is covered in them.';
    case 'clashMove': {
      if (mate) { mate.flags.tag = null; mate.flags.title = 'Former roommate'; rel(mate, -10); }
      e.roommateId = null;
      const n = assignRoommate();
      return `You ask to be moved, and are. Your new roommate is ${n.firstName} ${n.lastName}, who ${habitOf(n).line}.`;
    }
    case 'electRun': {
      const life = c.orgs[cast.org];
      const o = ORG_BY_ID[cast.org];
      if (!life || !o) return '';
      if (rng.chance(clamp(0.3 + (life.standing - 50) / 100 + (p.stats.charm - 50) / 150, 0.1, 0.9))) { life.role = 'leader'; if (o.polExp) p.counters.polExp = Math.min(40, (p.counters.polExp ?? 0) + 2); milestone(`Elected ${o.leader.toLowerCase()} of the ${o.name.toLowerCase()} at ${where()}.`, 'education'); return `You stand, you speak, and you win. You are ${o.leader.toLowerCase()} of the ${o.name.toLowerCase()}.`; }
      life.standing = Math.max(0, life.standing - 6); p.stats.mood = clamp(p.stats.mood - 4);
      return 'You stand, you speak, and you lose by eleven votes to someone with better posters.';
    }
    case 'electNo': return 'You vote for someone else, and keep your evenings.';
    case 'probTutor': e.effort = clamp(e.effort + 22); p.stats.mood = clamp(p.stats.mood - 4); return 'You sign up at the study center and go three times a week. It is humbling, and it helps.';
    case 'probLight': e.load = 'light'; return 'You drop a course. The degree will take longer, and you will finish it.';
    case 'probCarry': return 'You tell yourself it was one bad year.';
    case 'defendPrepare': case 'defendPlain': case 'defendWing': {
      const r = defendThesis(what === 'defendPrepare' ? 'prepare' : what === 'defendWing' ? 'wing' : 'plain');
      if (r.pass) e.thesis.passed = true;
      return r.text;
    }
    case 'gradCeremony': p.stats.mood = clamp(p.stats.mood + 8); for (const par of npcsByRole('parent')) rel(par, 8); return 'A gown that does not fit, your name read out slightly wrong, and a photograph that will be on a wall for forty years.';
    case 'gradFriends': p.stats.mood = clamp(p.stats.mood + 8); for (const n of livingNpcs()) if (n.flags.metAt === where() && n.role === 'friend') rel(n, 6); return 'You skip the lunch and spend the day with the people who made the years what they were.';
    default: return '';
  }
}

/** Everything the campus book shows. */
export function view() {
  const p = player();
  const e = p.education;
  const c = state();
  const mate = roommate();
  if (mate) fleshRoommate(mate);
  return { school: where(), stage: e.stage, credits: e.credits ?? null, needed: creditsNeeded(), load: e.load ?? 'standard', gpa: e.gpa, probation: !!c.probation,
    major: MAJOR_BY_ID[e.majorId]?.name ?? '', minor: MAJOR_BY_ID[e.minorId]?.name ?? null, professor: professor(), canOffice: c.officeAge !== p.age,
    roommate: mate, habit: habitOf(mate), friends: livingNpcs().filter((n) => n.role === 'friend' && n.flags.metAt === where()),
    orgs: orgOptions(), internships: [...(p.flags.internships ?? [])].reverse(), returnOffer: p.flags.returnOffer ?? null, abroad: c.abroad ?? null, studiedIn: p.flags.studiedIn ?? [] };
}

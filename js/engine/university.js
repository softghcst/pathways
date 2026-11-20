// Getting into university: the institutions of a country, the player's round
// of applications, each institution's answer and the help it offers, and
// taking up a place. How an application is judged is in engine/admissions.js;
// life once enrolled is in engine/education.js.
//
// The world:
//   state.universities  { id: { id, kind, name, countryId, city, founded, alumni: [names] } }
//     Made once for each country, from the patterns in data/universities.js, and kept for good.
// On the player:
//   p.education.apps = { age, majorId, statement, sent, list: [application], appealed, held }
//     application: { instId, outcome, score, condition, reasons, aid, tuition }
//     held: { instId, until }  a place kept open for a year
//   p.education.aid / aidKeep / aidParts   the share of tuition waived while enrolled, and the mark that keeps it
import { universityAccess } from './history.js';
import { rng } from '../rng.js';
import { clamp } from '../util.js';
import { store, player, npcsByRole, livingNpcs, log } from '../state.js';
import { COUNTRIES } from '../data/countries.js';
import { UNIVERSITY_KIND_BY_ID, UNI_PLACES, UNI_SAINTS, MAX_APPLICATIONS, STATEMENTS } from '../data/universities.js';
import { SCHOOL_TYPE_BY_ID } from '../data/schools.js';
import { MAJOR_BY_ID } from '../data/majors.js';
import { CAREERS } from '../data/careers.js';
import { OCCUPATIONS } from '../data/traits.js';
import { assess, meets, aid as aidFor, outlook } from './admissions.js';
import { tripleThreat, resolve } from './conditions.js';
import { wealthTier } from './living.js';
import * as edu from './education.js';
import { arriveAt } from './edlegacy.js';
import { localUniPatterns, fillName } from '../data/localNames.js';

const result = (ok, text, tone = ok ? 'good' : 'bad', more = {}) => ({ ok, text, tone, ...more });
const noise = (n) => (rng.next() * 2 - 1) * n;
const all = () => (store.state.universities ??= {});

/** The subjects at school that bear on a degree: advanced courses in them count with admissions. */
const RELEVANT = { engineering: ['math', 'science'], mathematics: ['math'], computer_science: ['math', 'technology'], chemistry: ['science'], biology: ['science'], nursing: ['science'],
  english: ['literature'], journalism: ['literature'], communications: ['literature'], history: ['history'], political_science: ['government', 'history'], finance: ['economics', 'math'], business: ['economics'],
  psychology: ['science'], education: ['literature'], criminal_justice: ['government'], art: ['art'], music: ['music'], theater: ['theater'], musical_theater: ['theater', 'music'], musical_theater_bfa: ['theater', 'music'] };

// ---------- The institutions ----------

/** The universities of a country, made the first time they are needed and then kept. */
export function catalog(countryId = player().countryId) {
  const have = Object.values(all()).filter((u) => u.countryId === countryId);
  if (have.length) return have.map(view);
  const c = COUNTRIES[countryId];
  const cities = [...c.cities].sort(() => rng.next() - 0.5);
  const taken = new Set();
  const plan = ['ancient', 'research', 'research', 'technical', 'regional', 'regional', 'college', 'conservatoire', 'open'];
  // Where universities run big sports programs, there are many more of them to recruit and be recruited by.
  if (['us', 'ca'].includes(countryId)) plan.push('research', 'research', 'research', 'research', 'regional', 'regional', 'regional', 'college', 'college', 'college');
  plan.forEach((kindId, i) => {
    const kind = UNIVERSITY_KIND_BY_ID[kindId];
    const city = cities[i % cities.length];
    let name = '';
    for (let t = 0; t < 12 && (!name || taken.has(name)); t++) {
      const local = localUniPatterns(kindId, countryId);
      name = local ? fillName(local[(i + t) % local.length], countryId, city, (xs) => rng.pick(xs))
        : kind.names[(i + t) % kind.names.length].replace('{city}', city).replace('{place}', rng.pick(UNI_PLACES)).replace('{saint}', rng.pick(UNI_SAINTS)).replace('{country}', c.name);
    }
    taken.add(name);
    const id = `uni_${countryId}_${i}`;
    all()[id] = { id, kind: kindId, name, countryId, city, founded: store.state.year - (kindId === 'ancient' ? rng.int(300, 800) : kindId === 'open' ? rng.int(20, 60) : rng.int(40, 220)), alumni: [] };
  });
  return Object.values(all()).filter((u) => u.countryId === countryId).map(view);
}
/** An institution with everything its kind gives it. */
function view(u) { return { ...UNIVERSITY_KIND_BY_ID[u.kind], ...u, kindId: u.kind }; }
/** The institution by id. Lives begun before the catalog existed attended one of three kinds of school: those still resolve. */
export function uniOf(id) {
  if (!id) return null;
  const u = all()[id];
  return u ? view(u) : SCHOOL_TYPE_BY_ID[id] ?? null;
}

// ---------- The applicant ----------

/** Whether someone has a degree, as far as can be told: from their own record if they have one, or from the work they do. */
function hasDegree(n) {
  if (n.life?.edu) return (n.life.edu.degrees ?? []).some((d) => ['university', 'graduate', 'medical', 'law'].includes(d));
  // Parents are known by the work they do: the professions are the ones that took a degree to enter.
  const job = OCCUPATIONS.find((j) => j.title === n.occupation);
  if (job) return job.income >= 70000;
  const title = String(n.occupation ?? '').toLowerCase();
  return !!title && CAREERS.some((c) => (c.req?.degree === 'university' || c.req?.majors || ['medical', 'law'].includes(c.req?.program)) && c.levels.some((l) => l.title.toLowerCase() === title));
}
/** Whether the player would be the first in their family to go to university: neither parent went, nor any family name is on an alumni roll. */
export function firstInFamily() {
  const p = player();
  const parents = npcsByRole('parent');
  if (!parents.length || parents.some(hasDegree)) return false;
  return !Object.values(all()).some((u) => u.alumni.some((n) => n.endsWith(` ${p.lastName}`)));
}

/** Whether the player has anything to plan: nearing the end of school, or out of it with a leaving qualification. */
export function canPlan() {
  const p = player();
  const e = p.education;
  if (p.legal.incarceration) return false;
  if (e.enrolled && e.stage === 'high' && p.age >= 16) return true;
  return !e.enrolled && e.degrees.some((d) => d.type === 'high' || d.type === 'community');
}
const atSchool = () => { const e = player().education; return e.enrolled && e.stage === 'high'; };

/** The player as an admissions office would see them, for a subject. */
export function profile(majorId, inst = null) {
  const p = player();
  const e = p.education;
  const major = MAJOR_BY_ID[majorId];
  const school = atSchool();
  const courses = school ? e.courses : e.degrees.find((d) => d.type === 'high')?.courses;
  const advanced = (courses?.advanced ?? []).filter((id) => (RELEVANT[majorId] ?? []).includes(id)).length;
  const recs = Math.min(2, livingNpcs().filter((n) => n.flags.wouldRecommend).length + (p.flags.teacherRec ? 1 : 0));
  const clubs = Object.values(e.clubLife ?? {});
  const activities = Math.round(clamp(25 + clubs.reduce((s, c) => s + c.standing / 3 + (c.role === 'leader' ? 15 : 0), 0) + (p.flags.gapVolunteer ? 12 : 0) + (p.flags.performances?.length ?? 0) * 3));
  const plan = e.apps;
  const tier = wealthTier();
  const parents = npcsByRole('parent');
  const surname = p.lastName;
  return {
    access: universityAccess(), // Historical Eras: how many students universities took in these years
    mark: school ? e.gpa : edu.entryGpa(), predicted: school, advanced, recs, activities,
    statement: plan?.statementValue ?? 0,
    audition: major?.audition ? Math.round(clamp((major.auditionSkill ? Number(resolve(major.auditionSkill)) || 0 : tripleThreat(p)) + (p.flags.directorRec ? 8 : 0) + Math.min(10, (p.flags.performances?.length ?? 0) * 2))) : null,
    // A university that offered an athletic scholarship (engine/sportsLife.js) backs the application, and pays what it offered.
    athlete: !!sportOffer(p, inst) || (!!p.flags.athlete?.recruited && !p.flags.athlete.recruited.instId) || (!!p.flags.coachRec && p.talents.sports >= 65),
    athleticFraction: sportOffer(p, inst)?.fraction,
    need: tier === 'poor' ? 2 : tier === 'middle' ? 1 : 0,
    firstInFamily: firstInFamily(),
    legacy: !!inst && inst.alumni.some((n) => n.endsWith(` ${surname}`)),
    transfer: edu.isTransfer(),
  };
}

/** The accepted athletic scholarship offer from this institution, if there is one. */
const sportOffer = (p, inst) => (inst ? (p.flags.sportOffers ?? []).find((o) => o.accepted && o.instId === inst.id) : null);

/** Whether an institution teaches a subject at all. */
export const teaches = (u, majorId) => !u.only || u.strong.includes(majorId);

/** What a year would cost at an institution, before any help: tuition and living away. */
export function costs(instId) {
  const u = uniOf(instId);
  const tuition = Math.round(edu.tuitionFor('university') * (u?.tuitionMult ?? 1));
  return { tuition, living: Math.round(edu.housingCost('dorm') * (u?.living ?? 1)) };
}
const barWord = (u) => (u.open ? 'Open to anyone' : u.bar >= 3.3 ? 'Very hard to get into' : u.bar >= 2.8 ? 'Hard to get into' : u.bar >= 2.4 ? 'Takes good students' : 'Takes most who apply');
const repWord = (u) => (u.rep >= 90 ? 'Famous everywhere' : u.rep >= 78 ? 'Very well regarded' : u.rep >= 62 ? 'Well regarded' : u.rep >= 50 ? 'Solid, and known locally' : 'Little known');

/** The catalog as the planner shows it, for the subject the player has in mind. */
export function browse() {
  const p = player();
  const plan = p.education.apps;
  const majorId = plan?.majorId ?? null;
  const major = MAJOR_BY_ID[majorId];
  return catalog(p.countryId).map((u) => {
    const c = costs(u.id);
    return { id: u.id, name: u.name, label: u.label, city: u.city, founded: u.founded, blurb: u.blurb, reputation: repWord(u), entry: barWord(u), tuition: c.tuition, living: c.living,
      strong: major ? u.strong.includes(majorId) : false, taught: !major || teaches(u, majorId), chances: !major ? '' : teaches(u, majorId) ? outlook(profile(majorId, u), u, major) : 'Not taught here', nearHome: u.city === p.city, family: u.alumni.filter((n) => n.endsWith(` ${p.lastName}`)),
      chosen: !!plan?.list.some((a) => a.instId === u.id) };
  });
}

// ---------- A round of applications ----------

function round() {
  const p = player();
  const e = p.education;
  if (!e.apps || (e.apps.sent && e.apps.age !== p.age && !e.apps.list.some((a) => a.outcome === 'accepted' || a.outcome === 'conditional' || a.outcome === 'waitlisted'))) e.apps = { age: p.age, majorId: e.apps?.majorId ?? null, statement: null, statementValue: 0, sent: false, list: [] };
  return e.apps;
}
export const plan = () => (canPlan() ? round() : null);
export const majorsOpen = () => Object.values(MAJOR_BY_ID).map((m) => ({ id: m.id, name: m.name, audition: !!m.audition, minGpa: m.minGpa }));

export function setMajor(id) {
  const r = round();
  if (r.sent) return result(false, 'Your applications have gone. Next year you can apply for something else.', 'neutral');
  if (!MAJOR_BY_ID[id]) return result(false, 'There is no such course.', 'neutral');
  r.majorId = id;
  r.list = r.list.filter((a) => teaches(uniOf(a.instId), id)); // places that do not teach it come off the list
  return result(true, `You will apply to study ${MAJOR_BY_ID[id].name}.`, 'neutral');
}
export function toggle(instId) {
  const r = round();
  if (r.sent) return result(false, 'Your applications have gone.', 'neutral');
  if (!uniOf(instId)) return result(false, 'There is no such place.', 'neutral');
  const at = r.list.findIndex((a) => a.instId === instId);
  if (at >= 0) { r.list.splice(at, 1); return result(true, 'Taken off your list.', 'neutral'); }
  if (r.majorId && !teaches(uniOf(instId), r.majorId)) return result(false, `${uniOf(instId).name} does not teach ${MAJOR_BY_ID[r.majorId].name}.`, 'neutral');
  if (r.list.length >= MAX_APPLICATIONS) return result(false, `You can apply to ${MAX_APPLICATIONS} places in a year.`, 'neutral');
  r.list.push({ instId, outcome: null });
  return result(true, 'Added to your list.', 'neutral');
}
export const statements = () => STATEMENTS;
export function setStatement(id) {
  const p = player();
  const r = round();
  const s = STATEMENTS.find((x) => x.id === id);
  if (!s || r.sent) return result(false, 'Too late to change it.', 'neutral');
  r.statement = id;
  // A story about something hard is remembered if it can be told well, and awkward if it cannot.
  r.statementValue = s.risky ? (rng.chance(clamp(0.3 + (p.stats.intellect - 50) / 120 + (p.stats.charm - 50) / 200, 0.1, 0.85)) ? 2 : -1) : s.value;
  return result(true, 'Your personal statement is written.', 'neutral');
}

/** Sends the applications. Each institution answers for itself. */
export function send() {
  const p = player();
  const r = round();
  if (r.sent) return result(false, 'You have already applied this year.', 'neutral');
  const major = MAJOR_BY_ID[r.majorId];
  if (!major) return result(false, 'Choose what you want to study first.', 'neutral');
  if (!r.list.length) return result(false, 'Add at least one place to your list.', 'neutral');
  if (!r.statement) setStatement('honest');
  r.sent = true; r.age = p.age;
  for (const a of r.list) {
    const u = uniOf(a.instId);
    const who = profile(r.majorId, u);
    const d = assess(who, u, major, noise(0.15));
    Object.assign(a, { outcome: d.outcome, score: d.score, condition: d.condition ?? null, reasons: d.reasons, tuition: costs(a.instId).tuition,
      aid: d.outcome === 'accepted' || d.outcome === 'conditional' ? aidFor(who, u, major, d.score) : null });
  }
  const count = (o) => r.list.filter((a) => a.outcome === o).length;
  const yes = count('accepted') + count('conditional');
  if (!yes) p.stats.mood = clamp(p.stats.mood - 6);
  const text = `You applied to ${r.list.length} ${r.list.length === 1 ? 'place' : 'places'} to study ${major.name}. ${yes ? `${yes} offered you a place${count('conditional') ? ', depending on your final marks' : ''}` : 'None offered you a place'}${count('waitlisted') ? `; ${count('waitlisted')} put you on a waiting list` : ''}${count('deferred') ? `; ${count('deferred')} asked you to apply again next year` : ''}.`;
  log(text, 'system', yes ? 'good' : 'bad');
  return result(yes > 0, text);
}

/** Answers as the planner shows them. */
export function answers() {
  const p = player();
  const r = p.education.apps;
  if (!r?.sent) return [];
  const ready = !atSchool();
  return r.list.map((a) => {
    const u = uniOf(a.instId);
    const net = a.aid ? Math.round(a.tuition * (1 - a.aid.fraction)) : a.tuition;
    return { ...a, name: u.name, label: u.label, city: u.city, net, living: costs(a.instId).living,
      aidText: a.aid?.parts.length ? a.aid.parts.map((x) => ({ merit: 'a scholarship for your record', athletic: 'an athletic scholarship', arts: 'a scholarship for performance', need: 'a grant because of what your family can afford' })[x.kind]).join(' and ') : '',
      conditionText: a.condition != null ? edu.markText(a.condition) : '', held: r.held?.instId === a.instId,
      canAccept: ready && a.outcome === 'accepted', canHold: ready && a.outcome === 'accepted' && !r.held, canAppeal: !r.appealed && ['rejected', 'deferred'].includes(a.outcome) && a.score >= -0.35 };
  });
}

/** A waiting list moves, or does not. @returns {?string} the good news, if there is any */
function offList(r, a) {
  const u = uniOf(a.instId);
  if (rng.chance(clamp(0.35 + a.score * 2, 0.1, 0.7))) {
    a.outcome = 'accepted';
    a.aid = aidFor(profile(r.majorId, u), u, MAJOR_BY_ID[r.majorId], a.score);
    a.reasons = [...(a.reasons ?? []), 'A place came free from the waiting list.'];
    return `A place has come free at ${u.name}.`;
  }
  a.outcome = 'rejected';
  a.reasons = [...(a.reasons ?? []), 'No place came free from the waiting list.'];
  return null;
}

/** School results are in: conditional offers stand or fall, and waiting lists move. */
export function onResults() {
  const p = player();
  const r = p.education.apps;
  if (!r?.sent) return;
  const final = edu.entryGpa();
  const lines = [];
  for (const a of r.list) {
    const u = uniOf(a.instId);
    if (a.outcome === 'conditional') {
      if (meets(a.condition, final, noise(0.15))) { a.outcome = 'accepted'; lines.push(`${u.name} has confirmed your place.`); }
      else { a.outcome = 'rejected'; a.aid = null; a.reasons = [`Your final marks fell short of what the offer asked for.`]; lines.push(`${u.name} has withdrawn its offer: your marks fell short.`); }
    } else if (a.outcome === 'waitlisted') { const got = offList(r, a); if (got) lines.push(got); }
  }
  if (lines.length) log(`Results day. ${lines.join(' ')}`, 'system', r.list.some((a) => a.outcome === 'accepted') ? 'good' : 'bad');
}

/** Asks an institution to look again. Once a round; it rarely works. */
export function appeal(instId) {
  const r = player().education.apps;
  const a = r?.list.find((x) => x.instId === instId);
  if (!a || r.appealed || !['rejected', 'deferred'].includes(a.outcome)) return result(false, 'There is nothing to appeal.', 'neutral');
  r.appealed = true;
  const u = uniOf(instId);
  if (a.score >= -0.35 && rng.chance(0.22)) {
    a.outcome = atSchool() ? 'conditional' : 'accepted';
    if (a.outcome === 'conditional') a.condition = Math.max(0, Math.round((u.bar - 0.3) * 10) / 10);
    a.aid = aidFor(profile(r.majorId, u), u, MAJOR_BY_ID[r.majorId], a.score);
    a.reasons = [...(a.reasons ?? []), 'On a second look, it changed its mind.'];
    return result(true, `${u.name} has looked again, and offers you a place.`);
  }
  return result(false, `${u.name} has looked again, and its answer is the same.`);
}

/** Keeps a place open for a year. One place, once. */
export function hold(instId) {
  const p = player();
  const r = p.education.apps;
  const a = r?.list.find((x) => x.instId === instId);
  if (!a || a.outcome !== 'accepted' || r.held) return result(false, 'That place cannot be held.', 'neutral');
  r.held = { instId, until: p.age + 1 };
  return result(true, `${uniOf(instId).name} will keep your place for a year.`, 'neutral');
}

/**
 * Takes up a place.
 * @param {string} funding  how the part not covered by aid is paid: 'parents' | 'loan' | 'self'
 * @param {{housing?:string, roommateId?:string}} [living]
 */
export function accept(instId, funding, living = {}) {
  const p = player();
  const e = p.education;
  const r = e.apps;
  const a = r?.list.find((x) => x.instId === instId);
  if (!a || a.outcome !== 'accepted' || atSchool() || e.enrolled) return result(false, 'You cannot take up that place now.', 'neutral');
  const u = uniOf(instId);
  const fraction = a.aid?.fraction ?? 0;
  edu.enroll('university', r.majorId, fraction >= 1 ? 'scholarship' : funding, { ...living, housingAid: !!a.aid?.housing }, { id: u.id, name: u.name, aid: a.aid });
  e.apps = null;
  arriveAt(u.name);
  return result(true, `You are going to ${u.name}.`);
}

/** Yearly: a round nobody acted on lapses, and a held place is lost if it is not taken up. */
export function tickApplications() {
  const p = player();
  const r = p.education.apps;
  if (!r) return;
  if (r.held && p.age > r.held.until) { log(`The place ${uniOf(r.held.instId)?.name ?? 'the university'} was holding for you has lapsed.`, 'system', 'bad'); p.education.apps = null; return; }
  // Someone who applied with their results already in hears from the waiting lists within the year.
  if (r.sent && !atSchool()) {
    const news = r.list.filter((a) => a.outcome === 'waitlisted').map((a) => offList(r, a)).filter(Boolean);
    if (news.length) log(news.join(' '), 'system', 'good');
  }
  if (r.sent && !r.held && p.age - r.age >= 2) p.education.apps = null;
}

/** Someone has graduated: the institution remembers the name. */
export function remember(instId) {
  const u = all()[instId];
  const p = player();
  const name = `${p.firstName} ${p.lastName}`;
  if (u && !u.alumni.includes(name)) u.alumni.push(name);
}

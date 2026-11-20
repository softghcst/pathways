// Education: compulsory school by age, effort and attendance, tutors, cliques,
// clubs and classes, then university, trade school, graduate, medical and law
// school with tuition, funding and housing.
import { majorOpen } from './history.js';
import { forgetNpc } from './digital/core.js';
import { rule, may } from './rules.js';
import { studyBarrier } from './health/access.js';
import { tuitionFactor } from './policy.js';
import { rng } from '../rng.js';
import { clamp, localMoney, fmtMoney, uid, localWage, localCost } from '../util.js';
import { store, player, country, npcsByRole, livingNpcs, log, milestone } from '../state.js';
import { makeNpc } from './npcFactory.js';
import { applyMods } from './genetics.js';
import { resolve, tripleThreat, remember } from './conditions.js';
import { SCHOOL_STAGES, SCHOOL_LEAVING_AGE, PROGRAMS, HOUSING, CLIQUES, CLIQUE_BY_ID,
  CLUBS, CLUB_BY_ID, MAX_CLUBS, TRADE_BY_ID, SCHOOL_TYPES, SCHOOL_TYPE_BY_ID, GAP_YEARS, PRIORITIES,
  PRIORITY_BY_ID } from '../data/schools.js';
import { MAJORS, MAJOR_BY_ID } from '../data/majors.js';
import * as sch from './schooling.js';
import { graduationDay } from './schoollife.js';
import { leftSchoolTeam } from './sports.js';
import { uniOf, onResults, remember as rememberAlumnus } from './university.js';
import * as campus from './campus.js';
import * as adult from './adulted.js';
import { CERT_BY_ID } from '../data/schools.js';
import { schoolModel } from '../data/education.js';

const LABELS = { none: 'Not in school', elementary: 'Elementary school', middle: 'Middle school',
  high: 'High school', university: 'University', graduate: 'Graduate school',
  medical: 'Medical school', law: 'Law school', cosmetology: 'Cosmetology school',
  community: 'Community college', apprenticeship: 'Apprenticeship' };
for (const p of Object.values(PROGRAMS)) LABELS[p.id] ??= p.label;
const SCHOOL = ['elementary', 'middle', 'high'];
/** What a stage is called. School stages take the country's own word for them. */
/** A mark as this country writes it, for anyone who needs to show one. */
export const markText = (g) => sch.mark(g);
export const stageLabel = (stage) => (SCHOOL.includes(stage) && store.state?.player ? sch.stageName(stage) : LABELS[stage] ?? stage);
export const isHigher = (stage) => stage in PROGRAMS;
const hasMajor = (stage) => isHigher(stage) && PROGRAMS[stage].kind !== 'trade';
const round2 = (n) => Math.round(n * 100) / 100;
const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });

/** The major or trade being studied, if any. */
export const subjectName = (stage, id) =>
  (stage === 'certificate' ? CERT_BY_ID[id]?.name : hasMajor(stage) ? MAJOR_BY_ID[id]?.name : TRADE_BY_ID[id]?.name) ?? '';

/** One line for the header, e.g. "Marlowe College · Biology". */
export function educationLine(p) {
  const e = p.education;
  const at = e.enrolled && SCHOOL.includes(e.stage) ? sch.school() : null;
  const where = at && at.kind !== 'home' ? at.name : e.stage === 'university' && e.enrolled && e.schoolName ? e.schoolName : stageLabel(e.stage);
  const subject = isHigher(e.stage) ? subjectName(e.stage, e.majorId) : '';
  return where + (subject ? ` · ${subject}` : '');
}

/** Per-year action counters; reset when the age changes. */
function acts() {
  const p = player();
  if (p.flags.eduActs?.age !== p.age) {
    p.flags.eduActs = { age: p.age, study: 0, slack: 0, skip: 0, clique: 0, tutor: 0, applied: {} };
  }
  return p.flags.eduActs;
}

function checkChance(check) {
  let chance = check.base;
  for (const [path, w] of Object.entries(check.factors ?? {})) {
    chance += w * ((Number(resolve(path)) || 0) - 50) / 100;
  }
  return clamp(chance, 0.05, 0.95);
}

function addNpc(npc) {
  store.state.npcs[npc.id] = npc;
  player().npcIds.push(npc.id);
  npc.lastInteractionAge = player().age;
  return npc;
}

// ---------- Classmates ----------

/** Old classmates you were close to stay on as friends; the rest fade away. */
function turnOverClassmates(addNew) {
  const p = player();
  for (const n of npcsByRole('classmate')) {
    if (n.meters.relationship >= 60 || n.flags.tag) n.role = 'friend';
    // Classmates you got on with are not deleted from the world: they may turn up again years later.
    else if (n.meters.relationship >= 35) { p.npcIds = p.npcIds.filter((id) => id !== n.id); n.flags.drifted = { year: store.state.year, age: p.age, role: n.role }; }
    else forgetNpc(n.id);
  }
  if (!addNew) return;
  const taken = new Set(p.npcIds.map((id) => store.state.npcs[id]?.firstName));
  for (let i = 0, n = rng.int(2, 3); i < n; i++) {
    const mate = makeNpc({ role: 'classmate', countryId: p.countryId, age: p.age + rng.int(-1, 1),
      relationship: rng.int(30, 65) });
    if (taken.has(mate.firstName)) continue;
    taken.add(mate.firstName);
    addNpc(mate);
  }
}

/** Gives a school pupil a class to sit in. */
export const meetClassmates = () => turnOverClassmates(true);

// ---------- Money ----------

/** Tuition for one year of a program, in local currency. */
export function tuitionFor(stage) {
  const c = country();
  const prog = PROGRAMS[stage];
  return c.freeUniversity && prog.kind !== 'trade' ? 0 : Math.round(localCost(prog.tuition, c) * tuitionFactor(c.id));
}

/** What this year actually costs at the school the player attends. */
export function currentTuition() {
  const e = player().education;
  // Part-time, the same fees are spread over more years.
  const pace = e.partTime && PROGRAMS[e.stage]?.partYears ? PROGRAMS[e.stage].years / PROGRAMS[e.stage].partYears : e.partTime && e.stage === 'university' ? 2 / 3 : 1;
  return Math.round(tuitionFor(e.stage) * (e.stage === 'university' ? e.tuitionMult ?? 1 : 1) * pace);
}

export const studentLoan = () => player().finance.loans.find((l) => l.kind === 'student');

function borrow(amount) {
  const p = player();
  let loan = studentLoan();
  if (!loan) {
    loan = { id: uid('loan'), kind: 'student', principal: 0, rate: 0.05, yearsLeft: 10 };
    p.finance.loans.push(loan);
  }
  loan.principal += amount;
  loan.yearsLeft = 10;
}

/** Pays one year of tuition according to the current funding arrangement. */
function chargeTuition() {
  const p = player();
  const e = p.education;
  const c = country();
  // What is owed is what is charged less whatever help came with the offer.
  const fee = Math.round(currentTuition() * (1 - (e.aid ?? 0)));
  if (!fee || e.funding === 'scholarship' || e.funding === 'parents' || e.funding === 'employer') return;
  if (e.funding === 'self' && p.finance.cash >= fee) {
    p.finance.cash -= fee;
    log(`You paid ${fmtMoney(fee, c)} in tuition.`);
    return;
  }
  if (e.funding === 'self') {
    e.funding = 'loan';
    log('You could not cover tuition from savings, so you took out a student loan.', 'system', 'bad');
  }
  borrow(fee);
  log(`${fmtMoney(fee, c)} of tuition was added to your student loan.`);
}

// ---------- Housing ----------

/** A year's rent for a housing choice, after any housing scholarship. */
export function housingCost(id = player().education.housing) {
  const e = player().education;
  if (id === 'dorm' && e.housingAid && e.funding === 'scholarship') return 0;
  if (!HOUSING[id]) return 0; // living in one's own home, as someone studying alongside a job does
  return localCost(HOUSING[id].cost, country());
}

export const roommate = () => store.state.npcs[player().education.roommateId];

/** @returns {{id, label, blurb, cost:number, available:boolean, reason:string}[]} */
export function housingOptions(housingAid = player().education.housingAid) {
  const c = country();
  const parents = npcsByRole('parent').length > 0;
  return Object.values(HOUSING).map((h) => {
    const free = h.id === 'dorm' && housingAid;
    return { id: h.id, label: h.label, blurb: h.blurb, cost: free ? 0 : localCost(h.cost, c),
      note: free ? 'Covered by your housing scholarship.' : '',
      available: h.id !== 'home' || parents, reason: 'You have no family home to stay in.' };
  });
}

/** Friends you could share an apartment with. */
export const roommateCandidates = () => npcsByRole('friend').filter((n) => n.age >= 17);

/**
 * Moves the player. For an apartment, roommateId picks a friend; leave it
 * empty to be matched with a stranger.
 */
export function setHousing(id, roommateId) {
  const p = player();
  const e = p.education;
  const old = roommate();
  if (old) { old.flags.tag = null; if (old.flags.title === 'Roommate') old.flags.title = null; }
  e.housing = id;
  e.roommateId = null;
  p.flags.livesWithParents = id === 'home';

  let text = { home: 'You are living at home and commuting.', dorm: 'You moved into a campus dorm.' }[id];
  if (id === 'dorm') { const mate = campus.assignRoommate(); text = `You moved into a campus dorm. Your roommate is ${mate.firstName} ${mate.lastName}, who ${campus.habitOf(mate).line}.`; }
  if (id === 'apartment') {
    let mate = store.state.npcs[roommateId];
    if (mate) {
      mate.meters.relationship = clamp(mate.meters.relationship + 5);
      remember(mate, 'movedIn', 'You moved into an apartment together.');
      text = `You and ${mate.firstName} signed a lease on an apartment together.`;
    } else {
      mate = addNpc(makeNpc({ role: 'friend', countryId: p.countryId, age: p.age + rng.int(-1, 3),
        relationship: rng.int(35, 60) }));
      text = `You moved into an off-campus apartment with a roommate you found online: ${mate.firstName}.`;
    }
    mate.flags.tag = 'roommate';
    mate.flags.title = 'Roommate';
    campus.fleshRoommate(mate);
    mate.lastInteractionAge = p.age;
    e.roommateId = mate.id;
  }
  log(text);
  return result(true, text, 'neutral');
}

function chargeHousing() {
  const p = player();
  const e = p.education;
  const c = country();
  const rent = housingCost();
  if (!rent) return;
  if (p.finance.cash >= rent) {
    p.finance.cash -= rent;
    log(`You paid ${fmtMoney(rent, c)} for a year of ${e.housing === 'dorm' ? 'dorm fees' : 'rent'}.`);
  } else {
    borrow(rent);
    log(`You could not cover ${fmtMoney(rent, c)} of ${e.housing === 'dorm' ? 'dorm fees' : 'rent'}, so it went on your student loan.`, 'system', 'bad');
  }
}

/** What a year of living somewhere does to you. */
function liveThere() {
  const p = player();
  const e = p.education;
  if (e.housing === 'dorm') p.stats.mood = clamp(p.stats.mood + 2);
  if (e.housing === 'home') {
    for (const parent of npcsByRole('parent')) parent.lastInteractionAge = p.age;
    p.stats.mood = clamp(p.stats.mood - 1);
  }
  const mate = roommate();
  if (e.housing === 'apartment' && mate?.alive) {
    mate.meters.relationship = clamp(mate.meters.relationship + rng.int(-4, 7));
    mate.lastInteractionAge = p.age;
  }
}

// ---------- Yearly step ----------

function enterStage(stage) {
  const e = player().education;
  e.stage = stage.id;
  e.enrolled = true;
  e.yearInStage = 0;
  sch.enter(stage.id); // the family chooses the school, and the class is made or carried over there
}

/** GPA earned this year from brains, discipline, effort, attendance and company kept. */
function yearGpa(p) {
  const e = p.education;
  // At school the year is marked subject by subject (engine/schooling.js); the overall mark is their average.
  const marked = SCHOOL.includes(e.stage) ? sch.markYear() : null;
  const raw = p.stats.intellect * 0.55 + p.hidden.discipline * 0.15 + e.effort * 0.3;
  let g = marked ?? raw / 25 + rng.around(0, 0.3) - e.absences * 0.12;
  // Barriers, not ability: unmet support needs and a hard stretch for concentration. Accommodations remove them.
  if (marked == null) g -= studyBarrier(p);
  if (hasMajor(e.stage)) g -= (MAJOR_BY_ID[e.majorId]?.difficulty ?? 0.3) * (e.stage === 'community' ? 0.5 : 1);
  if (e.stage === 'university' && uniOf(e.schoolId)?.strong.includes(e.majorId)) g += 0.1;
  if (!isHigher(e.stage) && p.age >= 12) g += PRIORITY_BY_ID[e.priority]?.gpa ?? 0;
  // Professional and graduate study builds on the degree before it: a strong student stays strong.
  if (PROGRAMS[e.stage]?.needs === 'university') {
    const prior = [...e.degrees].reverse().find((d) => ['university', 'graduate'].includes(d.type));
    if (prior?.gpa) g = g * 0.6 + prior.gpa * 0.4;
  }
  if (e.stage === 'medical') g -= 0.15;
  if (e.stage === 'law') g -= 0.08;
  if (p.flags.tutorAge === p.age - 1 && marked == null) g += 0.3; // at school a tutor works on the weakest subject instead
  g += CLIQUE_BY_ID[e.clique]?.gpa ?? 0;
  g += campus.markEdge(); // workload, a minor, and what clubs take out of the week
  return clamp(g, 0, 4);
}

function leaveSchool(how = 'completed') {
  const p = player();
  const e = p.education;
  if (SCHOOL.includes(e.stage) && e.place) sch.leave(how);
  const wasAway = isHigher(e.stage) && e.housing !== 'home';
  e.enrolled = false;
  e.clique = null;
  e.clubs = [];
  e.funding = null;
  e.housingAid = false;
  e.schoolId = null;
  e.schoolName = null;
  e.tuitionMult = 1;
  e.aid = 0; e.aidKeep = 0; e.aidParts = [];
  adult.bank(e);
  campus.finish();
  e.partTime = false;
  delete e.thesis;
  const mate = roommate();
  if (mate) mate.flags.title = 'Former roommate';
  e.roommateId = null;
  turnOverClassmates(false);
  // Until you have a job of your own (Phase 4), you go back to the family home.
  if (wasAway && npcsByRole('parent').length) {
    e.housing = 'home';
    p.flags.livesWithParents = true;
    log('With your course over, you moved back in with your family.');
  }
}

function graduate() {
  const p = player();
  const e = p.education;
  const gpa = e.gpa.toFixed(2);
  const major = hasMajor(e.stage) ? MAJOR_BY_ID[e.majorId] : null;
  const trade = TRADE_BY_ID[e.majorId];
  const school = uniOf(e.schoolId);
  const leaving = schoolModel(p.countryId).leaving;
  const place = SCHOOL.includes(e.stage) ? sch.school() : null;
  const prog = PROGRAMS[e.stage];
  // Some courses give a qualification of another kind: an adult certificate is a school-leaving one; a technical college, a trade.
  const kind = prog?.gives ?? (prog?.givesTrade ? 'apprenticeship' : e.stage);
  e.degrees.push({ type: kind, via: kind !== e.stage ? e.stage : undefined, majorId: major?.id ?? (['apprenticeship', 'technical', 'certificate'].includes(e.stage) ? e.majorId ?? undefined : undefined),
    gpa: e.gpa, age: p.age, school: e.schoolName ?? (place && place.kind !== 'home' ? place.name : undefined), award: e.stage === 'high' ? leaving : undefined, countryId: p.countryId,
    courses: e.stage === 'high' && e.courses ? { ...e.courses } : undefined });
  if (e.stage === 'high') { graduationDay(e.gpa); onResults(); }
  if (e.stage === 'university') { Object.assign(e.degrees[e.degrees.length - 1], campus.onGraduate()); rememberAlumnus(e.schoolId); }
  const honors = e.gpa >= 3.7 ? ' with top honors' : e.gpa >= 3.3 ? ' with honors' : '';
  const what = {
    high: `${place && place.kind !== 'home' ? place.name : 'school'} with your ${leaving}`,
    university: `${e.schoolName ?? 'university'} with a degree in ${major?.name}`,
    community: `community college with an associate degree in ${major?.name}`,
    graduate: `graduate school with a master's in ${major?.name}`,
    medical: 'medical school. You are a doctor',
    law: 'law school',
    cosmetology: 'cosmetology school. You are now licensed in hair and makeup',
    apprenticeship: `your apprenticeship. You are a qualified ${trade?.name.toLowerCase()}`,
    technical: `technical college. You are a qualified ${trade?.name.toLowerCase()}`,
    certificate: `your course with a certificate in ${CERT_BY_ID[e.majorId]?.name.toLowerCase()}`,
  }[e.stage] ?? prog?.done ?? stageLabel(e.stage).toLowerCase();
  const plain = ['medical', 'cosmetology', 'apprenticeship', 'technical', 'certificate', 'equivalency'].includes(e.stage) || !!prog?.plain || !!prog?.license;
  log(`You ${e.stage === 'apprenticeship' ? 'completed' : 'graduated from'} ${what}${plain ? '' : honors}${['apprenticeship', 'doctorate', 'equivalency'].includes(e.stage) ? '' : e.stage === 'high' ? ` (${sch.mark(e.gpa)})` : ` (${sch.degreeMark(e.gpa)})`}.`, 'system', 'good');
  milestone(e.stage === 'cosmetology' ? 'Earned a license in hair and makeup.'
    : e.stage === 'apprenticeship' || e.stage === 'technical' ? `Qualified as a ${trade?.name.toLowerCase()}.`
      : e.stage === 'doctorate' ? `Earned a doctorate: "${e.thesis?.topic}".`
      : e.stage === 'equivalency' ? 'Finished school as an adult.'
      : e.stage === 'certificate' ? `Earned a certificate in ${CERT_BY_ID[e.majorId]?.name.toLowerCase()}.`
      : e.stage === 'high' ? `Left ${place && place.kind !== 'home' ? place.name : 'school'} with ${/^[aeiouA]/.test(leaving) && !/s$/.test(leaving) ? 'an' : /s$/.test(leaving) ? '' : 'a'} ${leaving} (${sch.mark(e.gpa)}).`.replace('with  ', 'with ')
        : `Graduated ${stageLabel(e.stage).toLowerCase()}${major ? ` (${major.name})` : ''}, ${sch.degreeMark(e.gpa)}.`, 'education');
  p.stats.mood = clamp(p.stats.mood + 8);
  if (prog?.license === 'teaching') log(`Schools will hire a graduate without it, but they prefer the ${adult.examName(prog.license)}, which you can now sit.`);
  else if (prog?.license) log(`The degree is not yet the right to practice: for that there is the ${adult.examName(prog.license)}, which you can now sit.`);
  if (e.stage === 'equivalency') { e.droppedOut = false; e.expelled = false; log('Everything that asks for a school-leaving qualification is open to you now.'); }
  if (e.stage === 'doctorate') { e.degrees[e.degrees.length - 1].thesis = e.thesis.topic; p.flags.doctor = true; delete e.thesis; }
  if (e.stage === 'high') log('University, community college, trade school and apprenticeships are open to you from the Work & School tab.');
  if (e.stage === 'community') log('You can now transfer straight into the third year of university.');

  // A big-name university leaves you with someone who shares the name.
  if (e.stage === 'university' && school?.perk === 'network' && !npcsByRole('tag:alumni').length) {
    const alum = addNpc(makeNpc({ role: 'mentor', countryId: p.countryId, age: p.age + rng.int(8, 14), relationship: 45 }));
    alum.flags.tag = 'alumni';
    alum.flags.title = `${e.schoolName} alumnus`;
    remember(alum, 'sameSchool', `You both graduated from ${e.schoolName}.`);
    log(`At graduation you are introduced to ${alum.firstName} ${alum.lastName}, who left ${e.schoolName} ten years ago and still answers every email from it.`);
  }
  const loan = studentLoan();
  if (loan && isHigher(e.stage)) log(`You owe ${fmtMoney(loan.principal, country())} in student loans. Repayments start once you are earning.`);
  leaveSchool();
}

// ---------- Priorities ----------

export const canSetPriority = () => {
  const p = player();
  return p.education.enrolled && !isHigher(p.education.stage) && p.age >= 11;
};

/** @returns {{id, name, desc, current:boolean, available:boolean}[]} */
export function priorityOptions() {
  const p = player();
  return PRIORITIES.map((o) => ({ id: o.id, name: o.name, desc: o.desc, current: p.education.priority === o.id,
    available: !o.needsJob || !!p.career.partTime }));
}

export function setPriority(id) {
  const o = PRIORITY_BY_ID[id];
  player().education.priority = id;
  const text = `This year you are putting ${o.name.toLowerCase()} first.`;
  log(text);
  return result(true, text, 'neutral');
}

const halfAgain = (def) => Object.fromEntries(Object.entries(def).map(([group, vals]) =>
  [group, Object.fromEntries(Object.entries(vals).map(([k, v]) => [k, Math.ceil(v / 2)]))]));

/** What the year's priority did, beyond its effect on grades. */
function applyPriority(p) {
  const e = p.education;
  if (!e.priority || p.age < 12) return;
  const shift = (roles, d) => {
    for (const n of livingNpcs()) {
      if (!roles.includes(n.role)) continue;
      n.meters.relationship = clamp(n.meters.relationship + d);
      if (d > 0) n.lastInteractionAge = p.age;
    }
  };
  if (e.priority === 'grades') p.stats.mood = clamp(p.stats.mood - 2);
  if (e.priority === 'activities') {
    for (const id of e.clubs) if (CLUB_BY_ID[id]) applyMods(p, halfAgain(CLUB_BY_ID[id].yearly));
  }
  if (e.priority === 'work' && p.career.partTime) {
    const bonus = Math.round(p.career.partTime.salary * 0.25);
    p.finance.cash += bonus;
    log(`The extra shifts brought in another ${fmtMoney(bonus, country())}.`);
    shift(['boss'], 5);
    shift(['friend', 'classmate'], -3);
  }
  if (e.priority === 'friends') { shift(['friend', 'classmate'], 6); p.stats.mood = clamp(p.stats.mood + 2); }
  if (e.priority === 'family') { shift(['parent', 'sibling', 'grandparent'], 5); p.hidden.karma = clamp(p.hidden.karma + 2); }
}

export function tickEducation() {
  const p = player();
  const e = p.education;

  // Clubs and classes build skills every year, in or out of school.
  for (const id of e.clubs) if (CLUB_BY_ID[id]) applyMods(p, CLUB_BY_ID[id].yearly);

  // School starts, and moves from stage to stage, at the ages this country sets. Only ever forward.
  const due = sch.stageDue(p.age);
  const at = SCHOOL.indexOf(e.stage);
  const finished = e.degrees.some((d) => d.type === 'high');
  if (due && !isHigher(e.stage) && !finished && !e.expelled && !e.droppedOut && SCHOOL.indexOf(due.id) > at && (e.enrolled || e.stage === 'none')) { enterStage(due); return; }
  if (!e.enrolled) return;
  if (SCHOOL.includes(e.stage)) sch.ensure();

  e.yearInStage += 1;
  const g = yearGpa(p);
  e.gpa = round2(e.gpa === 0 ? g : e.gpa * 0.6 + g * 0.4);
  p.stats.intellect = clamp(p.stats.intellect + rng.int(0, 2) + (p.flags.tutorAge === p.age - 1 ? 2 : 0));

  // What you gained from the company you keep and your course.
  const clique = CLIQUE_BY_ID[e.clique];
  if (clique) applyMods(p, clique.yearly);
  if (hasMajor(e.stage) && MAJOR_BY_ID[e.majorId]) applyMods(p, MAJOR_BY_ID[e.majorId].yearly);
  if (PROGRAMS[e.stage]?.yearly) applyMods(p, PROGRAMS[e.stage].yearly);
  if (isHigher(e.stage)) { liveThere(); campus.tickCampus(g); adult.tickPartTime(); }
  else applyPriority(p);
  const stipend = PROGRAMS[e.stage]?.stipend;
  if (stipend) {
    const pay = localWage(stipend, country());
    p.finance.cash += pay;
    p.finance.lifetimeEarned += pay;
    log(e.stage === 'doctorate' ? `Your doctoral stipend came to ${fmtMoney(pay, country())} this year.` : `You earned ${fmtMoney(pay, country())} as an apprentice this year.`);
  }

  // Attendance
  if (e.absences >= 4 && !isHigher(e.stage)) {
    e.expelled = true;
    log('You missed so much school that you were expelled.', 'system', 'bad');
    p.stats.mood = clamp(p.stats.mood - 10);
    leaveSchool('expelled');
    return;
  }
  e.absences = 0;
  e.effort = Math.round(clamp(e.effort * 0.5 + (30 + p.hidden.discipline * 0.4) * 0.5));

  // Finishing, failing or carrying on
  if (e.stage === 'high' && p.age >= SCHOOL_LEAVING_AGE) return graduate();
  if (!isHigher(e.stage)) return;
  // A doctorate is finished when the thesis is, however long that takes.
  if (e.stage === 'doctorate' && e.thesis) {
    if (e.thesis.passed) return graduate();
    const next = adult.thesisYear();
    if (next === 'defend') { store.state.pendingEvents.push({ id: 'thesis_defense', cast: { words: { topic: e.thesis.topic } } }); return; }
    if (next === 'out') { log('Eight years in, your funding has ended and the thesis is not finished. The university has closed your registration.', 'system', 'bad'); p.stats.mood = clamp(p.stats.mood - 12); leaveSchool('left'); return; }
    chargeHousing();
    return;
  }
  // A degree is finished when its credits are earned; other courses, when their years are served.
  if (e.credits != null && campus.atUniversity() ? campus.finished() : e.yearInStage >= adult.yearsFor(e.stage, e.partTime)) return graduate();
  if (e.gpa < 1.2) {
    log(`Your grades collapsed and ${stageLabel(e.stage).toLowerCase()} asked you to leave.`, 'system', 'bad');
    p.stats.mood = clamp(p.stats.mood - 12);
    leaveSchool();
    return;
  }
  if (e.funding === 'scholarship' && e.gpa < 2.5 && !(e.aid > 0 && !e.aidKeep)) {
    e.funding = 'loan';
    // Help given for need is not taken away for a bad year; a scholarship for merit is.
    const kept = (e.aidParts ?? []).filter((x) => x.kind === 'need').reduce((t, x) => t + x.fraction, 0);
    e.aid = Math.min(1, kept); e.aidKeep = 0; e.aidParts = (e.aidParts ?? []).filter((x) => x.kind === 'need');
    log('Your grades slipped and you lost your scholarship.', 'system', 'bad');
  } else if (e.aidKeep && e.gpa < e.aidKeep && (e.aidParts ?? []).some((x) => x.kind !== 'need')) {
    const kept = e.aidParts.filter((x) => x.kind === 'need').reduce((t, x) => t + x.fraction, 0);
    e.aid = Math.min(1, kept); e.aidKeep = 0; e.aidParts = e.aidParts.filter((x) => x.kind === 'need');
    log('Your grades slipped below what your scholarship asks for, and it has been withdrawn.', 'system', 'bad');
  }
  chargeTuition();
  chargeHousing();
}

// ---------- Actions while enrolled ----------

export function studyHard() {
  const p = player();
  const e = p.education;
  if (!e.enrolled) return result(false, 'You are not in school.');
  if (acts().study >= 1) return result(false, 'You have already put in extra hours this year.', 'neutral');
  acts().study += 1;
  e.effort = clamp(e.effort + 25);
  p.stats.intellect = clamp(p.stats.intellect + 1);
  p.stats.mood = clamp(p.stats.mood - 3);
  p.hidden.discipline = clamp(p.hidden.discipline + 1);
  const text = 'You put in extra hours with the books this year.';
  log(text, 'system', 'good');
  return result(true, text);
}

export function slackOff() {
  const p = player();
  const e = p.education;
  if (!e.enrolled) return result(false, 'You are not in school.');
  if (acts().slack >= 1) return result(false, 'You are already doing the bare minimum.', 'neutral');
  acts().slack += 1;
  e.effort = clamp(e.effort - 25);
  p.stats.mood = clamp(p.stats.mood + 4);
  p.hidden.discipline = clamp(p.hidden.discipline - 1);
  const text = 'You coasted through the year doing as little as possible.';
  log(text);
  return result(true, text, 'neutral');
}

export function skipSchool() {
  const p = player();
  const e = p.education;
  if (!e.enrolled) return result(false, 'You are not in school.');
  if (acts().skip >= 4) return result(false, 'You have barely been in as it is.', 'neutral');
  acts().skip += 1;
  e.absences += 1;
  p.stats.mood = clamp(p.stats.mood + 5);
  const caught = !isHigher(e.stage) && rng.chance(0.4);
  if (caught) {
    for (const parent of npcsByRole('parent')) {
      parent.meters.relationship = clamp(parent.meters.relationship - 5);
    }
    p.stats.mood = clamp(p.stats.mood - 7);
  }
  const text = caught
    ? 'You skipped school and the office phoned home. It was not a pleasant evening.'
    : isHigher(e.stage) ? 'You skipped a week of lectures.' : 'You skipped school and nobody noticed.';
  log(text, 'system', caught ? 'bad' : 'neutral');
  const warn = !isHigher(e.stage) && e.absences === 3 ? ' One more absence this year and you will be expelled.' : '';
  return result(true, text + warn, caught ? 'bad' : 'neutral');
}

export const canAskForTutor = () => {
  const p = player();
  return p.education.enrolled && !isHigher(p.education.stage) && p.age >= 7 && npcsByRole('parent').length > 0;
};

/** Asks the parents to pay for a private tutor for the year. They may refuse. */
export function askForTutor() {
  const p = player();
  const parents = npcsByRole('parent');
  if (!canAskForTutor()) return result(false, 'There is nobody to ask.');
  if (acts().tutor >= 1) return result(false, 'You have already asked this year.', 'neutral');
  acts().tutor += 1;
  const avg = (f) => parents.reduce((s, n) => s + f(n), 0) / parents.length;
  const chance = clamp(avg((n) => n.wealth) / 100 * 0.7 + avg((n) => n.meters.generosity) / 100 * 0.3
    + (p.education.gpa && p.education.gpa < 2.5 ? 0.15 : 0), 0.05, 0.95);
  if (!rng.chance(chance)) {
    const text = 'You asked your parents for a tutor. They said the money is not there this year.';
    log(text, 'system', 'bad');
    return result(false, text);
  }
  p.flags.tutorAge = p.age;
  p.education.effort = clamp(p.education.effort + 15);
  const text = 'Your parents hired you a private tutor. Two evenings a week, no excuses. Your grades should show it by next year.';
  log(text, 'system', 'good');
  return result(true, text);
}

/** @returns {{id, name, desc, allowed:boolean, current:boolean}[]} */
export function cliqueOptions() {
  const e = player().education;
  return CLIQUES.map((c) => ({
    id: c.id, name: c.name, desc: c.desc, current: e.clique === c.id,
    allowed: Object.entries(c.needs).every(([paths, min]) =>
      paths.split('|').some((path) => (Number(resolve(path)) || 0) >= min)),
  }));
}

export function joinClique(id) {
  const p = player();
  const e = p.education;
  const c = CLIQUE_BY_ID[id];
  if (e.stage !== 'high' || !e.enrolled) return result(false, 'Cliques are a high-school thing.');
  if (acts().clique >= 1) return result(false, 'You already changed who you sit with this year.', 'neutral');
  acts().clique += 1;
  if (!cliqueOptions().find((o) => o.id === id).allowed) {
    p.stats.mood = clamp(p.stats.mood - 5);
    const text = `You tried to sit with ${c.name}. They made it clear you were not one of them.`;
    log(text, 'system', 'bad');
    return result(false, text);
  }
  e.clique = id;
  const text = id === 'loners' ? 'You decided to keep to yourself.' : `You fell in with ${c.name}.`;
  log(text, 'system', 'good');
  return result(true, text);
}

/** Clubs and classes open at the player's age. */
export function clubOptions() {
  const p = player();
  const e = p.education;
  return CLUBS.filter((c) => p.age >= c.from).map((c) => ({ id: c.id, name: c.name, blurb: c.blurb ?? '',
    joined: e.clubs.includes(c.id), chance: c.tryout ? checkChance(c.tryout) : 1 }));
}
/** Children can take classes before they start school; adults need to be enrolled. */
export const canJoinClubs = () =>
  (player().education.enrolled || player().age < 18) && clubOptions().length > 0;

export function joinClub(id) {
  const p = player();
  const e = p.education;
  const club = CLUB_BY_ID[id];
  if (!canJoinClubs() || p.age < club.from) return result(false, 'That is not open to you yet.');
  if (e.clubs.includes(id)) return result(false, 'You are already a member.', 'neutral');
  if (e.clubs.length >= MAX_CLUBS) return result(false, `You only have time for ${MAX_CLUBS} activities. Leave one first.`, 'neutral');
  const tried = acts().applied;
  if (tried[id]) return result(false, 'You already tried out this year. Come back next year.', 'neutral');
  tried[id] = true;
  if (club.tryout && !rng.chance(checkChance(club.tryout))) {
    p.stats.mood = clamp(p.stats.mood - 4);
    const text = `You tried out for the ${club.name.toLowerCase()} and did not make the cut.`;
    log(text, 'system', 'bad');
    return result(false, text);
  }
  e.clubs.push(id);
  p.stats.mood = clamp(p.stats.mood + 4);
  let text = `You joined the ${club.name.toLowerCase()}.`;

  // Some activities come with a person who gets to know you.
  const spec = club.contact;
  if (spec && !npcsByRole(`tag:${spec.tag}`).length) {
    const npc = addNpc(makeNpc({ role: spec.role, countryId: p.countryId,
      age: rng.int(spec.ageRange[0], spec.ageRange[1]), relationship: rng.int(45, 58) }));
    npc.flags.tag = spec.tag;
    npc.flags.title = spec.title;
    text += ` It is run by ${npc.firstName} ${npc.lastName}, the ${spec.title.toLowerCase()}.`;
  }
  log(text, 'system', 'good');
  return result(true, text);
}

export function quitClub(id) {
  const e = player().education;
  if (!e.clubs.includes(id)) return result(false, 'You are not a member.');
  e.clubs = e.clubs.filter((c) => c !== id);
  if (id === 'sports_team') leftSchoolTeam(e.sport);
  const text = `You left the ${CLUB_BY_ID[id].name.toLowerCase()}.`;
  log(text);
  return result(true, text, 'neutral');
}

/** Being sent to prison ends a college course (school carries on inside). */
export const leaveForPrison = () => {
  const e = player().education;
  if (e.enrolled && isHigher(e.stage)) leaveSchool();
};

export const canDropOut = () => {
  const p = player();
  return p.education.enrolled && (isHigher(p.education.stage) || may('leaveSchool').ok);
};

/**
 * Leaving school at the leaving age to go to work, as most children did before secondary school was
 * for everyone (Historical Eras). Unlike dropping out, nobody holds it against the child.
 */
export function leaveForWork() {
  const p = player();
  const e = p.education;
  if (!e.enrolled || isHigher(e.stage)) return result(false, 'You are not at school.', 'neutral');
  if (!canDropOut()) return result(false, `You have to stay in school until you are ${rule('schoolLeavingAge')}.`);
  leaveSchool('left');
  p.flags.leftSchoolAt = p.age;
  const text = `You left school at ${p.age}, as most children your age did, and went out to work.`;
  log(text, 'system', 'neutral');
  milestone(`Left school at ${p.age} to work.`, 'education');
  return result(true, text, 'neutral');
}

export function dropOut() {
  const p = player();
  const e = p.education;
  if (!canDropOut()) return result(false, `You have to stay in school until you are ${rule('schoolLeavingAge')}.`);
  const where = stageLabel(e.stage).toLowerCase();
  if (!isHigher(e.stage)) e.droppedOut = true;
  leaveSchool('left');
  for (const parent of npcsByRole('parent')) {
    parent.meters.relationship = clamp(parent.meters.relationship - 10);
  }
  const text = `You dropped out of ${where}.`;
  log(text, 'system', 'bad');
  milestone(`Dropped out of ${where}.`, 'education');
  return result(true, text, 'neutral');
}

// ---------- Admissions ----------

const lastDegree = (type) => [...player().education.degrees].reverse().find((d) => d.type === type);

/** The grades a university looks at: community-college results replace school ones. */
export function entryGpa() {
  const cc = lastDegree('community');
  return cc ? cc.gpa : lastDegree('high')?.gpa ?? 0;
}
export const isTransfer = () => !!lastDegree('community') && !lastDegree('university');

/**
 * Which programs the player could apply to right now.
 * @returns {{id, label, blurb, years, tuition:number, stipend:number, eligible:boolean, reason:string}[]}
 */
export function programOptions() {
  const p = player();
  const e = p.education;
  const c = country();
  return Object.values(PROGRAMS).map((prog) => {
    const base = prog.needs ? lastDegree(prog.needs) : null;
    const bachelor = lastDegree('university');
    const held = (type) => e.degrees.some((d) => d.type === type);
    let reason = '';
    if (e.enrolled) reason = 'You are already studying.';
    else if (p.legal.incarceration) reason = 'Not from a cell.';
    else if (p.flags.gapYearAge === p.age) reason = 'You are on a gap year. Apply next year.';
    else if (prog.minAge && p.age < prog.minAge) reason = `You need to be ${prog.minAge}.`;
    else if (prog.gives && held(prog.gives)) reason = 'You already have a school-leaving qualification.';
    else if (prog.needs && !base) reason = prog.needs === 'high' ? 'Needs a school-leaving qualification. Adult school gives one.' : 'Needs a university degree.';
    else if (held(prog.id) && prog.id !== 'university' && !prog.repeat) reason = 'You already hold this qualification.';
    else if (prog.id === 'community' && held('university')) reason = 'You already have a university degree.';
    else if (base && base.gpa < prog.minGpa) reason = `Needs a GPA of ${prog.minGpa.toFixed(1)} (yours: ${base.gpa.toFixed(2)}).`;
    else if (prog.science && !MAJOR_BY_ID[bachelor.majorId]?.tracks.includes('medical')) reason = 'Needs a science or health degree.';
    else if (acts().applied[prog.id]) reason = 'You already applied this year.';
    const transfer = prog.id === 'university' && isTransfer();
    return { id: prog.id, label: transfer ? 'University (transfer)' : prog.label,
      blurb: transfer ? 'Your community-college credits count: you start in the third year.' : prog.blurb,
      years: transfer ? 2 : prog.years, tuition: tuitionFor(prog.id),
      stipend: prog.stipend ? localWage(prog.stipend, c) : 0, eligible: !reason, reason };
  });
}

/** Chance of getting in. Audition majors are judged on performance, not grades. */
export function admissionChance(progId, subjectId) {
  const p = player();
  const iq = p.stats.intellect;
  if (progId === 'apprenticeship') {
    return clamp(0.6 + (p.hidden.discipline - 50) / 100 * 0.6 + (p.stats.health - 50) / 200, 0.1, 0.97);
  }
  if (PROGRAMS[progId].kind === 'trade' || PROGRAMS[progId].open) return 1; // open enrollment
  if (progId === 'university') {
    const m = MAJOR_BY_ID[subjectId];
    const gpa = entryGpa();
    if (gpa < m.minGpa) return 0;
    if (m.audition) {
      const shown = m.auditionSkill ? Number(resolve(m.auditionSkill)) || 0 : tripleThreat(p); // dance majors are judged on dancing
      return clamp(m.auditionBase + (shown - 50) / 100 * 1.1 + (p.flags.directorRec ? 0.2 : 0), 0.03, 0.97);
    }
    const backing = (p.flags.teacherRec ? 0.12 : 0) + (p.flags.gapVolunteer ? 0.08 : 0) + (isTransfer() ? 0.1 : 0);
    return clamp(0.45 + (gpa - m.minGpa) * 0.45 + (iq - 50) / 200 - m.difficulty * 0.2 + backing, 0.05, 0.97);
  }
  // A course entered from school is judged on school marks.
  if (PROGRAMS[progId].needs === 'high') { const hs = lastDegree('high'); return clamp(0.55 + ((hs?.gpa ?? 2) - PROGRAMS[progId].minGpa) * 0.5 + (p.hidden.karma - 50) / 300, 0.08, 0.97); }
  const b = lastDegree('university');
  const affinity = MAJOR_BY_ID[b.majorId]?.tracks.includes(progId) ? 0.15 : 0;
  const prof = p.flags.profRec ? 0.2 : 0;
  if (progId === 'graduate') return clamp(0.5 + (b.gpa - 3.0) * 0.5 + (iq - 50) / 200 + prof, 0.05, 0.97);
  if (progId === 'medical') return clamp(0.3 + (b.gpa - 3.6) * 0.9 + (iq - 60) / 150 + prof / 2, 0.05, 0.95);
  if (progId === 'doctorate') return clamp(0.3 + (b.gpa - 3.4) * 0.8 + (iq - 60) / 150 + prof + (lastDegree('graduate') ? 0.2 : 0), 0.05, 0.95);
  if (progId !== 'law') return clamp(0.4 + (b.gpa - PROGRAMS[progId].minGpa) * 0.7 + (iq - 55) / 150 + prof / 2, 0.05, 0.95);
  return clamp(0.35 + (b.gpa - 3.4) * 0.7 + (iq - 55) / 150 + affinity + prof / 2, 0.05, 0.95);
}

/** Rolls the scholarship a school would offer, if any. aid scales the odds. */
function rollScholarship(major, gpa, aid = 1) {
  const p = player();
  if (rng.chance((gpa >= 3.7 ? 0.75 : gpa >= 3.4 ? 0.3 : 0) * aid)) return 'an academic scholarship';
  const sporty = p.talents.sports >= 80 || (p.flags.coachRec && p.talents.sports >= 65);
  if (sporty && rng.chance(0.6 * aid)) return 'an athletic scholarship';
  if (major?.audition && tripleThreat(p) >= 75 && rng.chance(0.6 * aid)) return 'a performance scholarship';
  return undefined;
}

/**
 * Applies to every kind of university at once and returns each one's answer,
 * so the player can compare. One round of applications per year.
 * @returns {{accepted:boolean, text:string, offers:{id, name, accepted:boolean, tuition:number,
 *   scholarship?:string, housingAid:boolean, knownFor:string, fit:boolean}[]}}
 */
export function universityOffers(majorId) {
  const p = player();
  const major = MAJOR_BY_ID[majorId];
  acts().applied.university = true;
  const base = admissionChance('university', majorId);
  const gpa = entryGpa();
  const offers = SCHOOL_TYPES.map((t) => {
    const accepted = base > 0 && rng.chance(clamp(base + t.admit, 0.03, 0.98));
    const tuition = Math.round(tuitionFor('university') * t.tuitionMult);
    const scholarship = accepted && tuition > 0 ? rollScholarship(major, gpa, t.aid) : undefined;
    return { id: t.id, name: t.name, accepted, tuition, scholarship,
      housingAid: !!scholarship && rng.chance(0.5), knownFor: t.knownFor, fit: t.strong.includes(majorId) };
  });
  const yes = offers.filter((o) => o.accepted);
  const names = yes.map((o) => o.name);
  const how = major.audition ? 'auditioned at' : 'applied to';
  let text;
  if (!yes.length) {
    p.stats.mood = clamp(p.stats.mood - 6);
    text = major.audition
      ? `You auditioned for ${major.name} at three schools and none offered you a place. The panels want stronger singing, dancing and acting. You can try again next year.`
      : `You applied to three universities to study ${major.name} and all three said no. You can try again next year.`;
  } else {
    text = `You ${how} three schools for ${major.name}. ${yes.length === 3 ? 'All three' : names.join(' and ')} said yes.`
      + `${major.audition && p.flags.directorRec ? ' Your drama director\'s recommendation was on every panel\'s desk.' : ''}`
      + `${!major.audition && p.flags.teacherRec ? ' Your teacher\'s recommendation went with every form.' : ''}`;
  }
  log(text, 'system', yes.length ? 'good' : 'bad');
  return { accepted: yes.length > 0, text, offers };
}

/**
 * Submits a single application (everything except university, which uses
 * universityOffers). One attempt per program per year.
 * @returns {{accepted:boolean, text:string, scholarship?:string, housingAid?:boolean}}
 */
export function applyTo(progId, subjectId) {
  const p = player();
  const prog = PROGRAMS[progId];
  const major = progId === 'university' || progId === 'community' ? MAJOR_BY_ID[subjectId] : null;
  const trade = progId === 'apprenticeship' ? TRADE_BY_ID[subjectId] : null;
  if (!prog.repeat) acts().applied[progId] = true;
  const subject = major ? ` to study ${major.name}` : '';
  const rec = major?.audition && p.flags.directorRec;

  if (!rng.chance(admissionChance(progId, subjectId))) {
    p.stats.mood = clamp(p.stats.mood - 6);
    const text = trade ? `You applied for an apprenticeship as a ${trade.name.toLowerCase()}. They took someone else. You can try again next year.`
      : major?.audition
        ? `You auditioned for ${major.name} and were not offered a place. The panel wants stronger singing, dancing and acting. You can try again next year.`
        : `Your application to ${prog.label.toLowerCase()}${subject} was rejected. You can try again next year.`;
    log(text, 'system', 'bad');
    return { accepted: false, text };
  }

  const base = prog.needs ? lastDegree(prog.needs) : null;
  const scholarship = tuitionFor(progId) > 0 && prog.kind !== 'trade' && !prog.open && base
    ? rollScholarship(major, base.gpa) : undefined;
  const housingAid = !!scholarship && rng.chance(0.5);
  const text = trade ? `You were taken on as an apprentice ${trade.name.toLowerCase()}.`
    : `${major?.audition ? `Your audition won you a place${subject}` : `You were accepted to ${prog.label.toLowerCase()}${subject}`}`
      + `${rec ? '. Your drama director\'s recommendation was on the panel\'s desk' : ''}`
      + `${scholarship ? `. You were offered ${scholarship}${housingAid ? ' that also covers a dorm room' : ''}` : ''}.`;
  log(text, 'system', 'good');
  return { accepted: true, text, scholarship, housingAid };
}

/** Parents pay for a young person's studies, not for a grown adult's. */
export const PARENTS_PAY_UNTIL = 25;
export const canAskParents = (p = player()) => p.age <= PARENTS_PAY_UNTIL && npcsByRole('parent').length > 0;

/** Rolls whether the parents agree to pay. Can only be asked once per application. */
export function askParentsToPay() {
  const parents = npcsByRole('parent');
  if (!parents.length) return result(false, 'There is nobody to ask.');
  if (!canAskParents()) return result(false, 'At your age, this is yours to pay for.');
  const avg = (f) => parents.reduce((s, n) => s + f(n), 0) / parents.length;
  const chance = clamp(avg((n) => n.wealth) / 100 * 0.7 + avg((n) => n.meters.generosity) / 100 * 0.3
    + avg((n) => n.meters.relationship) / 100 * 0.3 - 0.3, 0.03, 0.95);
  if (rng.chance(chance)) {
    const text = 'Your parents agreed to pay your tuition.';
    log(text, 'system', 'good');
    return result(true, text);
  }
  const text = 'Your parents said they cannot pay for it.';
  log(text, 'system', 'bad');
  return result(false, text);
}

/**
 * Starts the program.
 * @param {string} progId
 * @param {?string} subjectId  major (university, community college) or trade (apprenticeship)
 * @param {'scholarship'|'parents'|'loan'|'self'} funding  ('public' is set where tuition is free)
 * @param {{housing?:string, roommateId?:string, housingAid?:boolean}} [living]
 * @param {{id:string, name:string}} [school]  the university chosen from universityOffers
 */
export function enroll(progId, subjectId, funding, living = {}, school = null) {
  const p = player();
  const e = p.education;
  const prog = PROGRAMS[progId];
  const transfer = progId === 'university' && isTransfer();
  e.stage = progId;
  e.enrolled = true;
  e.yearInStage = transfer ? 2 : 0;
  e.gpa = 0;
  e.absences = 0;
  e.effort = 50;
  e.partTime = !!living.partTime && adult.canPartTime(progId);
  e.majorId = ['university', 'community', 'apprenticeship', 'technical', 'certificate'].includes(progId) ? subjectId
    : prog.needs === 'university' ? lastDegree('university').majorId : null;
  e.schoolId = school?.id ?? null;
  e.schoolName = school?.name ?? null;
  e.tuitionMult = uniOf(school?.id)?.tuitionMult ?? 1;
  // Help with the cost, as offered: a share of tuition waived, and the mark that keeps it.
  e.aid = school?.aid?.fraction ?? 0;
  e.aidKeep = school?.aid?.keep ?? 0;
  e.aidParts = school?.aid?.parts ?? [];
  e.funding = currentTuition() === 0 ? 'public' : funding;
  e.housingAid = e.funding === 'scholarship' && !!living.housingAid;
  turnOverClassmates(true);
  const where = e.schoolName ?? prog.label.toLowerCase();
  log(progId === 'apprenticeship'
    ? `You started your apprenticeship as a ${TRADE_BY_ID[subjectId].name.toLowerCase()}.`
    : `You enrolled at ${where}${transfer ? ', transferring straight into the third year' : ''}.`, 'system', 'good');

  // A small college puts you in a room with the professor you came for.
  if (uniOf(e.schoolId)?.perk === 'mentor' && !npcsByRole('tag:favProfessor').length) {
    const prof = addNpc(makeNpc({ role: 'mentor', countryId: p.countryId, age: rng.int(38, 62), relationship: 55 }));
    prof.flags.tag = 'favProfessor';
    prof.flags.title = 'Professor';
    remember(prof, 'choseForThem', 'You chose the college because of their work, and told them so in week one.');
    log(`Professor ${prof.firstName} ${prof.lastName}, whose work brought you here, teaches your first seminar.`);
  }
  if (progId === 'university' || progId === 'community') campus.start(transfer);
  if (progId === 'doctorate') adult.startThesis();
  chargeTuition();
  // Someone studying alongside a job goes on living where they live.
  if (e.partTime) { e.housing = 'own'; e.roommateId = null; if (e.credits != null) e.load = 'part'; log('You will study in the evenings and keep your job.'); }
  else setHousing(living.housing ?? (npcsByRole('parent').length ? 'home' : 'dorm'), living.roommateId);
  chargeHousing();
}

// ---------- Changing direction ----------

/** Majors the player could move to, with what each would take. */
export function switchOptions() {
  const e = player().education;
  const gpa = e.gpa || entryGpa();
  return MAJORS.filter((m) => m.id !== e.majorId && majorOpen(m.id)).map((m) => ({ id: m.id, name: m.name, audition: !!m.audition,
    allowed: gpa >= m.minGpa, minGpa: m.minGpa,
    chance: m.audition ? admissionChance('university', m.id) : 1 }));
}
export const canSwitchMajor = () => {
  const e = player().education;
  return e.enrolled && (e.stage === 'university' || e.stage === 'community');
};

/** Switching after the first year costs a year: earlier credits only partly count. */
export function switchMajor(id) {
  const p = player();
  const e = p.education;
  const m = MAJOR_BY_ID[id];
  if (!canSwitchMajor()) return result(false, 'You can only switch majors while at college.');
  if (acts().applied.switch) return result(false, 'You have already tried to switch this year.', 'neutral');
  acts().applied.switch = true;
  if (m.audition && !rng.chance(admissionChance('university', id))) {
    const text = `You auditioned to move into ${m.name} and were turned down. You stay where you are.`;
    log(text, 'system', 'bad');
    return result(false, text);
  }
  const from = MAJOR_BY_ID[e.majorId]?.name ?? 'your old course';
  // Credits carry over within a family of subjects; between families, a year's worth is lost.
  const lost = e.credits != null ? campus.switchCost(e.majorId, id) : null;
  const costYear = lost != null ? lost > 0 : e.yearInStage >= 1;
  if (lost != null) e.credits = Math.max(0, e.credits - lost); else if (costYear) e.yearInStage -= 1;
  e.majorId = id;
  const text = `You switched from ${from} to ${m.name}.${costYear ? ' Not all your credits carried over, so it adds a year, and a year of fees.' : lost === 0 && (e.credits ?? 0) >= 30 ? ' The subjects are close enough that every credit carries over.' : ' It is early enough that nothing is lost.'}`;
  log(text, 'system', 'neutral');
  milestone(`Switched major to ${m.name}.`, 'education');
  return result(true, text, 'neutral');
}

export const canTakeGapYear = () => {
  const p = player();
  return !p.education.enrolled && !!lastDegree('high') && p.age <= 21 && !p.flags.gapYearAge && !p.career.careerId;
};

/** @returns {{id, name, desc, cost:number, pays:number, affordable:boolean}[]} */
export function gapYearOptions() {
  const p = player();
  const c = country();
  return GAP_YEARS.map((g) => {
    const amount = localMoney(g.cash, c);
    return { id: g.id, name: g.name, desc: g.desc, cost: amount < 0 ? -amount : 0, pays: amount > 0 ? amount : 0,
      affordable: p.finance.cash + amount >= 0 };
  });
}

export function takeGapYear(id) {
  const p = player();
  const g = GAP_YEARS.find((x) => x.id === id);
  if (!canTakeGapYear()) return result(false, 'A gap year is not open to you now.');
  const amount = localMoney(g.cash, country());
  if (p.finance.cash + amount < 0) return result(false, 'You cannot afford that.');
  p.finance.cash += amount;
  if (amount > 0) p.finance.lifetimeEarned += amount;
  applyMods(p, g.mods);
  if (g.flag) p.flags[g.flag] = true;
  p.flags.gapYearAge = p.age;
  p.flags.gapYear = id;
  let text = g.text;
  if (id === 'travel') {
    const pal = addNpc(makeNpc({ role: 'friend', countryId: p.countryId, age: p.age + rng.int(-1, 4), relationship: rng.int(55, 75) }));
    remember(pal, 'metTraveling', 'You met on the road during your gap year.');
    text += ` Somewhere along the way you met ${pal.firstName}, who is now a friend for life.`;
  }
  log(text, 'system', 'good');
  milestone(`Took a gap year: ${g.name.toLowerCase()}.`, 'life');
  return result(true, text);
}

/** Changes housing part-way through a course; the new place is charged from next year. */
export function moveHousing(id, roommateId) {
  const e = player().education;
  if (!e.enrolled || !isHigher(e.stage)) return result(false, 'You can only do this while studying.');
  if (id === e.housing && id !== 'apartment') return result(false, 'You already live there.', 'neutral');
  return setHousing(id, roommateId);
}

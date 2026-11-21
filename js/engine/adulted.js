// Education beyond the first degree, and education later in life:
// licenses that a professional degree does not confer by itself, the
// doctoral thesis, studying part-time alongside a job, an employer paying
// for it, and credits kept from a degree that was not finished.
// The programs themselves are data (data/schools.js); enrolling, fees and
// graduating are in engine/education.js.
//
//   p.flags.licenses       [licenseId]   the right to practice: earned by exam, after the degree
//   p.flags.examAge        the age at which a licensing exam was last sat
//   p.education.thesis     { topic, progress 0–100, years, published, supervisorId }   while on a doctorate
//   p.education.partTime   studying alongside work: longer, and the job is kept
//   p.education.banked     { credits, majorId }   credits from a degree left unfinished
import { rng } from '../rng.js';
import { clamp, localMoney, fmtMoney } from '../util.js';
import { store, player, country, livingNpcs, log, milestone } from '../state.js';
import { PROGRAMS, LICENSES, THESIS_WORDS } from '../data/schools.js';
import { MAJOR_BY_ID } from '../data/majors.js';
import { makeNpc } from './npcFactory.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const add = (npc) => { store.state.npcs[npc.id] = npc; player().npcIds.push(npc.id); npc.lastInteractionAge = player().age; return npc; };

// ---------- Licenses ----------

/** What the licensing exam for a profession is called here. */
export const examName = (id, countryId = player().countryId) => LICENSES[id]?.exam[countryId] ?? LICENSES[id]?.exam.default ?? 'licensing exam';
export const licensed = (id, p = player()) => (p.flags.licenses ?? []).includes(id);
/** The license a program leads to, if a degree alone is not enough to practice. */
export const licenseFor = (programId) => PROGRAMS[programId]?.license ?? null;

/**
 * People who qualified before licenses existed in the game already
 * practice: they are not sent back to sit an exam. Run once per life.
 */
export function grandfather() {
  const p = player();
  if (p.flags.licensesChecked) return;
  p.flags.licensesChecked = true;
  for (const d of p.education.degrees) { const l = licenseFor(d.type); if (l && !licensed(l)) (p.flags.licenses ??= []).push(l); }
}

/** Exams the player is qualified to sit and has not yet passed. */
export function examOptions() {
  const p = player();
  const c = country();
  return p.education.degrees.map((d) => licenseFor(d.type)).filter((l, i, all) => l && !licensed(l) && all.indexOf(l) === i)
    .map((l) => ({ id: l, name: examName(l), profession: LICENSES[l].name, fee: localMoney(LICENSES[l].fee, c), sat: p.flags.examAge === p.age, affordable: p.finance.cash >= localMoney(LICENSES[l].fee, c) }));
}
/** How the weeks before an exam can be spent. */
export const PREP = [
  { id: 'course', name: 'Pay for a test-prep course', cost: 1500, edge: 0.18, sub: 'Six weeks of someone else\'s schedule.' },
  { id: 'self', name: 'Revise on your own', cost: 0, edge: 0.06, sub: 'Free, and only as good as your discipline.' },
  { id: 'none', name: 'Walk in as you are', cost: 0, edge: -0.08, sub: 'You have just spent years learning this.' },
];

/** The ways to prepare, with what each costs here. */
export const prepOptions = () => PREP.map((x) => ({ ...x, local: localMoney(x.cost, country()) }));

/** Sits a licensing exam. Once a year. */
export function sitExam(id, prepId = 'self') {
  const p = player();
  const c = country();
  const o = examOptions().find((x) => x.id === id);
  const prep = PREP.find((x) => x.id === prepId) ?? PREP[1];
  if (!o) return result(false, 'You are not qualified to sit that.', 'neutral');
  if (o.sat) return result(false, 'You have sat an exam this year. The next sitting is next year.', 'neutral');
  const cost = o.fee + localMoney(prep.cost, c);
  if (p.finance.cash < cost) return result(false, `The fee${prep.cost ? ' and the course come' : ' comes'} to ${fmtMoney(cost, c)}. You do not have it.`, 'neutral');
  p.finance.cash -= cost;
  p.flags.examAge = p.age;
  const deg = [...p.education.degrees].reverse().find((d) => licenseFor(d.type) === id);
  const tries = (p.flags.examTries ??= {});
  tries[id] = (tries[id] ?? 0) + 1;
  const chance = clamp(0.5 + ((deg?.gpa ?? 2.8) - 3) * 0.3 + (p.stats.intellect - 55) / 200 + prep.edge + (prepId === 'self' ? (p.hidden.discipline - 50) / 300 : 0) + Math.min(0.15, (tries[id] - 1) * 0.07), 0.1, 0.95);
  if (!rng.chance(chance)) {
    p.stats.mood = clamp(p.stats.mood - 8);
    const text = `You sat the ${o.name} and did not pass. Plenty of good ${LICENSES[id].people} fail it the first time. You can sit it again next year.`;
    log(text, 'system', 'bad');
    return result(false, text);
  }
  (p.flags.licenses ??= []).push(id);
  if (id === 'teaching') p.flags.teachingCert = true;
  p.stats.mood = clamp(p.stats.mood + 10);
  const text = `You passed the ${o.name}${tries[id] > 1 ? `, at the ${['', 'first', 'second', 'third', 'fourth'][tries[id]] ?? 'latest'} attempt` : ''}. You are licensed to practice ${LICENSES[id].name}.`;
  log(text, 'system', 'good');
  milestone(`Licensed to practice ${LICENSES[id].name}.`, 'career');
  return result(true, text);
}

// ---------- The doctorate ----------

const supervisor = () => store.state.npcs[player().education.thesis?.supervisorId] ?? null;
/** Begins a doctorate: a topic, and the person who will supervise it. */
export function startThesis() {
  const p = player();
  const e = p.education;
  const field = MAJOR_BY_ID[e.majorId]?.name ?? 'your subject';
  const sup = add(makeNpc({ role: 'mentor', countryId: p.countryId, age: rng.int(40, 66), relationship: rng.int(40, 58) }));
  sup.flags.tag = 'supervisor'; sup.flags.title = 'Doctoral supervisor';
  sup.flags.style = rng.pick(['hands-off', 'exacting', 'generous with time', 'always traveling']);
  e.thesis = { topic: `${rng.pick(THESIS_WORDS.first)} ${rng.pick(THESIS_WORDS.second)} in ${field}`, progress: 0, years: 0, published: 0, supervisorId: sup.id };
  log(`Your doctorate begins. Your topic: "${e.thesis.topic}". Your supervisor is ${sup.firstName} ${sup.lastName}, who is ${sup.flags.style}.`, 'system', 'good');
}
/**
 * A year of research. @returns {'continue'|'defend'|'out'} what happens next:
 * carry on, the thesis is ready to be examined, or the funding has run out.
 */
export function thesisYear() {
  const p = player();
  const e = p.education;
  const t = e.thesis;
  const sup = supervisor();
  t.years += 1;
  const helpful = sup?.alive ? { 'hands-off': -2, exacting: 3, 'generous with time': 5, 'always traveling': -4 }[sup.flags.style] ?? 0 : -6;
  const gain = Math.round(clamp(12 + (p.stats.intellect - 50) / 4 + (p.hidden.discipline - 50) / 5 + (e.effort - 50) / 8 + helpful + ((sup?.meters.relationship ?? 40) - 50) / 10 + rng.int(-5, 7), 3, 38));
  const before = t.progress;
  t.progress = Math.min(100, t.progress + gain);
  if (sup?.alive) { sup.meters.relationship = Math.round(clamp(sup.meters.relationship + rng.int(-3, 6))); sup.lastInteractionAge = p.age; }
  const crossed = (n) => before < n && t.progress >= n;
  if (crossed(25)) log('Your research proposal has been accepted. Now there is only the research.', 'system', 'good');
  else if (crossed(50)) log('Half a thesis exists. Most of it will be rewritten.', 'system', 'neutral');
  else if (gain <= 8) log('A bad year for the thesis: an experiment that failed, a chapter that would not come.', 'system', 'bad');
  if (t.progress >= 45 && rng.chance(0.3 + (p.stats.intellect - 50) / 200)) { t.published += 1; p.hidden.fame = clamp(p.hidden.fame + 1); log(`A paper from your research has been published${t.published > 1 ? `, your ${['', 'first', 'second', 'third', 'fourth'][t.published] ?? 'latest'}` : ''}.`, 'system', 'good'); }
  if (t.progress >= 100) return 'defend';
  if (t.years >= 8) return 'out';
  return 'continue';
}
/** The examination of the thesis. @returns {{pass:boolean, text:string}} */
export function defend(how) {
  const p = player();
  const t = p.education.thesis;
  const chance = clamp(0.72 + (p.stats.intellect - 55) / 150 + t.published * 0.06 + (how === 'prepare' ? 0.12 : how === 'wing' ? -0.12 : 0), 0.25, 0.98);
  if (rng.chance(chance)) return { pass: true, text: `Three hours in a room with people who have read every page. At the end they shake your hand and call you Doctor.${t.published ? '' : ' They suggest you publish some of it.'}` };
  t.progress = 82;
  return { pass: false, text: 'Three hours in a room with people who have read every page. They want two chapters rewritten before they will pass it. You have another year of work.' };
}

// ---------- Part-time study, and who pays ----------

/** Whether a program can be taken alongside a job. */
export const canPartTime = (progId) => !!PROGRAMS[progId]?.partYears || ['university', 'community'].includes(progId);
/** How many years a program takes at the pace chosen. */
export const yearsFor = (progId, partTime) => (partTime ? PROGRAMS[progId].partYears ?? PROGRAMS[progId].years : PROGRAMS[progId].years);

/** Asks an employer to pay for a course. They do it for people they want to keep. Once a year. */
export function askEmployer() {
  const p = player();
  const k = p.career;
  if (!k.careerId) return result(false, 'You have no employer to ask.', 'neutral');
  if (p.flags.askedEmployerAge === p.age) return result(false, 'You have asked this year.', 'neutral');
  p.flags.askedEmployerAge = p.age;
  const chance = clamp(0.15 + ((k.performance ?? 50) - 50) / 120 + Math.min(0.25, (k.yearsInField ?? 0) * 0.05), 0.05, 0.85);
  if (rng.chance(chance)) { const text = 'Your employer agrees to pay your fees. They would like you to still be here when you finish.'; log(text, 'system', 'good'); return result(true, text); }
  const text = 'Your employer says there is no budget for training this year.';
  log(text, 'system', 'neutral');
  return result(false, text);
}

/** Yearly, for someone studying alongside work: it costs evenings, and something at home. */
export function tickPartTime() {
  const p = player();
  const e = p.education;
  if (!e.enrolled || !e.partTime) return;
  p.stats.mood = clamp(p.stats.mood - 3);
  const kids = livingNpcs().filter((n) => n.role === 'child' && n.age < 16).length;
  if (kids) {
    p.stats.mood = clamp(p.stats.mood - 2);
    if (!e.toldFamily) { e.toldFamily = true; log(`Studying after work, with ${kids === 1 ? 'a child' : 'children'} at home, means doing it after bedtime. You are tired all the time, and you are doing it.`, 'system', 'neutral'); }
  }
}

// ---------- Credits kept ----------

/** On leaving a degree unfinished: what was earned is kept. */
export function bank(e) {
  if (e.stage === 'university' && e.credits > 0 && e.credits < 120) e.banked = { credits: e.credits, majorId: e.majorId };
  else if (e.stage === 'university') delete e.banked;
}
/** On starting a degree again: credits already earned come too, less a year's worth if the subject is far from the old one. */
export function unbank(e, startWith, sameFamily) {
  if (!e.banked) return startWith;
  const kept = Math.max(0, e.banked.credits - (sameFamily(e.banked.majorId, e.majorId) ? 0 : 30));
  delete e.banked;
  if (kept > startWith) log(`${kept} credits from your earlier time in college have been counted toward this degree.`, 'system', 'good');
  return Math.max(startWith, kept);
}

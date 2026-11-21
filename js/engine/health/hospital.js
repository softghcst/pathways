// Hospital stays and rehabilitation.
//
// An admission is a stretch of weeks on the care calendar: emergency (a heart
// attack, a broken hip, a spinal injury), planned (surgery at the start of
// cancer treatment) or voluntary (a short stay offered by a mental health team
// in a very hard stretch; only ever the player's choice). While someone is in
// hospital, outpatient appointments and therapy sessions wait for them rather
// than counting as missed. The stay is billed once.
//
// Leaving hospital can lead to rehabilitation: a course with goals the person
// works toward, met by sessions attended, not by the calendar. Some goals are
// about recovering what was there before; others (after a spinal cord injury)
// are about living well in a new way. Full recovery is never required.
import { store, player, log } from '../../state.js';
import { clamp } from '../../util.js';
import { THERAPY_BY_ID } from '../../data/health/therapies.js';
import { VISIT_COST } from '../../data/health/providers.js';
import { healthOf } from './record.js';
import { facilitiesHere, clinicianAt, clinicianName, joinCareTeam, book } from './care.js';
import { now, charge, hashOf } from './util.js';
import { healthMilestone } from './story.js';

const result = (ok, text, tone = ok ? 'good' : 'bad', extra = {}) => ({ ok, text, tone, ...extra });

/** Goals for each kind of rehabilitation, worked through in order. */
export const REHAB_GOALS = {
  hip: [['stand', 'Stand and take a few steps with a frame'], ['house', 'Get around the house on your own'], ['stairs', 'Manage the stairs'], ['shops', 'Walk to the shops and back']],
  spinal: [['transfers', 'Move between bed and chair on your own'], ['chair', 'Get around confidently in your wheelchair'], ['daily', 'Manage washing, dressing and cooking your way'], ['home', 'Go home and live the way you want']],
  cardiac: [['walk', 'Walk for thirty minutes without stopping'], ['confidence', 'Feel confident being active again'], ['routine', 'Get back to your usual routine']],
  cancer: [['strength', 'Build your strength back up'], ['routine', 'Get back to the things you care about']],
  mental: [['settle', 'Feel steady enough to go home'], ['plan', 'Have a plan for the next few weeks']],
  back: [['move', 'Move with less pain'], ['active', 'Get back to being active']],
};
/** What each reason for admission leads to afterward. */
const AFTER = {
  heart: { rehab: 'cardiac_rehab', goals: 'cardiac', weeks: 1, label: 'a heart attack' },
  hip: { rehab: 'physio', goals: 'hip', weeks: 2, label: 'a broken hip' },
  spinal: { rehab: 'rehab', goals: 'spinal', weeks: 8, label: 'a spinal cord injury' },
  surgery: { rehab: 'physio', goals: 'cancer', weeks: 1, label: 'surgery' },
  voluntary: { rehab: null, goals: 'mental', weeks: 2, label: 'a short voluntary stay' },
};

export const admissions = (p = player()) => (healthOf(p).admissions ??= []);
export const inHospital = (p = player(), w = now(p)) => admissions(p).find((a) => a.status === 'in' && w >= a.startWk && w < a.endWk) ?? null;

/** Admits the player. Returns the admission, or null if one is already under way. */
export function admit(reason, o = {}, p = player()) {
  if (inHospital(p)) return null;
  const how = AFTER[reason] ?? { weeks: o.weeks ?? 1, label: reason };
  const fs = facilitiesHere(p);
  const f = fs.find((x) => x.defId === (reason === 'voluntary' ? 'mental' : 'hospital')) ?? fs.find((x) => x.defId === 'hospital');
  if (!f) return null;
  const doc = clinicianAt(f, reason === 'voluntary' ? 'psychiatrist' : reason === 'heart' ? 'cardiologist' : reason === 'surgery' ? 'oncologist' : 'doctor') ?? clinicianAt(f, 'doctor');
  const weeks = o.weeks ?? how.weeks;
  const a = { id: `adm_${hashOf(p.id, reason, now(p)).toString(36)}`, reason, label: how.label, kind: o.kind ?? (reason === 'surgery' ? 'planned' : reason === 'voluntary' ? 'voluntary' : 'emergency'),
    facilityId: f.id, doctorId: doc?.id ?? null, startWk: now(p), endWk: now(p) + weeks, status: 'in', conditionId: o.conditionId ?? null, notes: [] };
  admissions(p).push(a);
  if (doc) joinCareTeam(doc, p);
  a.paid = charge(`adm:${a.id}`, VISIT_COST.hospitalWeek * weeks, { what: `${weeks} week${weeks === 1 ? '' : 's'} in the hospital` });
  log({
    emergency: `You are admitted to ${f.name} after ${how.label}.`,
    planned: `You go into ${f.name} for ${how.label}, as planned.`,
    voluntary: `You accept a short stay at ${f.name}: a ward where people can look after you while things settle.`,
  }[a.kind], 'system', a.kind === 'emergency' ? 'bad' : 'neutral');
  // Appointments and sessions wait for you; nothing counts as missed while you are in.
  const h = healthOf(p);
  for (const ap of h.appointments) if (ap.status === 'booked' && ap.wk < a.endWk) ap.wk = a.endWk;
  for (const c of h.therapies) if (c.status === 'active' && c.nextWk < a.endWk) c.nextWk = a.endWk;
  return a;
}

/** Each week: anyone due to leave hospital is discharged, and offered rehabilitation where it helps. */
export function hospitalWeek(p = player()) {
  const h = healthOf(p);
  for (const a of admissions(p)) {
    if (a.status !== 'in' || now(p) < a.endWk) continue;
    a.status = 'discharged';
    const how = AFTER[a.reason];
    const doc = store.state.npcs[a.doctorId];
    log(`You are home from hospital after ${a.endWk - a.startWk} week${a.endWk - a.startWk === 1 ? '' : 's'}.`, 'system', 'neutral');
    if (a.reason === 'voluntary' && doc) book('review', { facilityId: a.facilityId, providerId: doc.id, ref: `followup:${a.id}`, wait: 1 }, p);
    if (!how?.rehab || store.state.year < THERAPY_BY_ID[how.rehab].from) continue;
    h.proposals.push({ id: `prop_rehab_${a.id}`, kind: 'rehab', providerId: doc?.id ?? h.careTeam[0], wk: now(p), status: 'open', recommended: 'rehab',
      summary: `Before you leave, ${doc ? clinicianName(doc) : 'the team'} suggests ${THERAPY_BY_ID[how.rehab].name.toLowerCase()}, with goals you work toward at your own pace.`,
      options: [{ id: 'rehab', label: `Start ${THERAPY_BY_ID[how.rehab].name.toLowerCase()}`, sub: REHAB_GOALS[how.goals].map((g) => g[1]).join(' · '), act: { kind: 'rehab', therapyId: how.rehab, goals: how.goals, conditionId: a.conditionId } },
        { id: 'decline', label: 'Not now', sub: 'You can ask for it later.', act: { kind: 'decline' } }] });
  }
}

/** Rehabilitation goals for a course: set at the start, in order. */
export function setRehabGoals(course, set) {
  course.rehabGoals = (REHAB_GOALS[set] ?? REHAB_GOALS.back).map(([id, text]) => ({ id, text, progress: 0, metWk: null }));
  course.rehabSet = set;
}

/** One attended rehab session moves the current goal forward. */
export function rehabProgress(course, engage, p = player()) {
  const goal = course.rehabGoals?.find((g) => !g.metWk);
  if (!goal) return null;
  const t = THERAPY_BY_ID[course.therapyId];
  const per = 100 / Math.max(2, (t.sessions / course.rehabGoals.length) * 1.2);
  goal.progress = Math.round(clamp(goal.progress + per * engage * (0.6 + course.fit * 0.6)));
  if (goal.progress < 100) return null;
  goal.metWk = now(p);
  course.history.push({ wk: now(p), text: `Rehabilitation goal reached: ${goal.text.toLowerCase()}.` });
  healthMilestone(`Reached a rehabilitation goal: ${goal.text.toLowerCase()}.`, { type: 'rehab', id: `${course.id}:${goal.id}` }, p, { shareable: true });
  // A broken hip from the older illness list heals for good once the goals are met.
  if (course.rehabSet === 'hip' && course.rehabGoals.every((g) => g.metWk)) {
    p.conditions = p.conditions.filter((c) => c.id !== 'broken_hip');
    log('Your hip has healed, and you are getting about on your own again.', 'system', 'good');
  }
  return goal;
}

/** Ask for rehabilitation without having been in hospital (back pain, an older injury). */
export function requestRehab(set = 'back', p = player()) {
  const h = healthOf(p);
  if (h.therapies.some((c) => c.rehabGoals && ['active', 'paused'].includes(c.status))) return result(false, 'You are already in a rehabilitation program.', 'neutral');
  h.proposals.push({ id: `prop_rehab_self_${now(p)}`, kind: 'rehab', providerId: h.careTeam[0] ?? null, wk: now(p), status: 'open', recommended: 'rehab', summary: 'Physiotherapy with goals of your own.',
    options: [{ id: 'rehab', label: 'Start physiotherapy', sub: REHAB_GOALS[set].map((g) => g[1]).join(' · '), act: { kind: 'rehab', therapyId: 'physio', goals: set } }, { id: 'decline', label: 'Not now', sub: '', act: { kind: 'decline' } }] });
  return result(true, 'Physiotherapy is offered: decide in My Health.', 'neutral');
}


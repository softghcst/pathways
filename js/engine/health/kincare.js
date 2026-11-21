// Care for the people around the player: their own clinicians, therapy that
// runs session by session, medicines that are reviewed and sometimes changed,
// hospital stays, and what it all does for them.
//
// It is lighter than the player's care (a year at a time, not a week at a
// time), but it is real care with real people: a family member's therapist is
// a persistent clinician at a real clinic, their medicine was available in
// their year and is one that is used for what they have, and every change is
// kept in their history.
//
// Privacy: the player sees that someone is getting support only if they shared
// the condition, and the details (who, what, how it is going) only if they
// chose to share those too. Asking is allowed; telling is up to them.
import { rng } from '../../rng.js';
import { store, player, log } from '../../state.js';
import { clamp } from '../../util.js';
import { CONDITION_BY_ID, MENTAL, nameIn } from '../../data/health/conditions.js';
import { THERAPY_BY_ID } from '../../data/health/therapies.js';
import { MED_BY_ID } from '../../data/health/medications.js';
import { PROFESSIONS } from '../../data/health/providers.js';
import { facilitiesHere, facilityDef, clinicianAt, clinicianName } from './care.js';
import { medAvailable } from './rules.js';
import { seeded } from './util.js';

const result = (ok, text, tone = ok ? 'good' : 'bad', extra = {}) => ({ ok, text, tone, ...extra });
const year = () => store.state.year;
const RESPONSE = { good: 0.6, partial: 0.3, little: 0.05 };

const begunOf = (n) => (n.health?.conds ?? []).filter((c) => c.age <= n.age);
const shared = (n) => begunOf(n).filter((c) => c.shared);
const treatable = (def) => !def.neurotype && !['sensory', 'mobility'].includes(def.group);

/** Therapies this person could have for this condition this year, at a clinic nearby, in order of preference. */
function therapyFor(n, def) {
  for (const id of def.care?.therapies ?? []) {
    const t = THERAPY_BY_ID[id];
    if (!t || t.kind === 'peer' || year() < t.from || n.age < t.minAge || (t.maxAge && n.age > t.maxAge)) continue;
    for (const f of facilitiesHere()) {
      const pro = t.by.find((b) => facilityDef(f).staff.includes(b));
      if (!pro) continue;
      if (t.dbt && !facilityDef(f).dbt && f.defId !== 'private') continue;
      return { t, f, pro };
    }
  }
  return null;
}

/**
 * Medicines that could be prescribed to this person for this condition this
 * year: used for it, available here and now, right for their age, never for
 * BPD itself, and in bipolar disorder a mood stabilizer rather than an
 * antidepressant on its own. Not already tried and found wanting.
 */
export function npcMedOptions(n, conditionId, tried = []) {
  const bipolar = (n.health?.conds ?? []).some((c) => ['bipolar_1', 'bipolar_2'].includes(c.id) && c.diagnosed && c.age <= n.age);
  const country = (typeof n.flags.abroad === 'string' && n.flags.abroad) || player().countryId;
  return Object.values(MED_BY_ID)
    .filter((m) => m.uses[conditionId] && medAvailable(m, year(), country, conditionId) && n.age >= m.minAge && !(m.maxAge && n.age > m.maxAge)
      && !(bipolar && m.family === 'antidepressant') && !tried.includes(m.id))
    .sort((a, b) => (a.uses[conditionId] === 'first' ? 0 : 1) - (b.uses[conditionId] === 'first' ? 0 : 1));
}

/** Someone able to prescribe the medicine, at a clinic nearby. */
function prescriberFor(med) {
  for (const pro of med.by) {
    if (!(PROFESSIONS[pro]?.prescribes ?? []).includes(med.family)) continue;
    for (const f of facilitiesHere()) { const d = clinicianAt(f, pro); if (d) return d; }
  }
  return null;
}

/** How a medicine goes for this person: decided once, from who they are and what it is. */
const responseOf = (n, medId, condId) => {
  const med = MED_BY_ID[medId];
  const r = seeded('kinmed', n.id, medId, condId);
  const u = r.next();
  return { kind: u < med.response.good ? 'good' : u < med.response.good + med.response.partial ? 'partial' : 'little', side: r.chance(0.18) };
};

/** Starts care for one condition: a clinician, a therapy where there is one, a medicine where it is used. */
export function startCare(n, c) {
  const def = CONDITION_BY_ID[c.id];
  const th = therapyFor(n, def);
  const meds = def.care?.meds !== null ? npcMedOptions(n, c.id) : [];
  if (!th && !meds.length) return null;
  const care = { v: 2, since: year(), therapy: null, meds: [], stays: [], history: [], details: n.meters.relationship >= 65 && rng.chance(0.6) };
  if (th) {
    const doc = clinicianAt(th.f, th.pro, { dbt: !!th.t.dbt });
    care.therapy = { therapyId: th.t.id, facilityId: th.f.id, providerId: doc?.id ?? null, startYear: year(), attended: 0, missed: 0, progress: 0,
      fit: Math.round(seeded('kinfit', n.id, th.t.id).range(0.35, 0.85) * 100) / 100, status: 'active' };
    care.history.push({ year: year(), text: `Began ${th.t.name.toLowerCase()}${doc ? ` with ${clinicianName(doc)}` : ''}.` });
    if (th.t.id === 'cancer_treatment') {
      care.stage = seeded('kinstage', n.id).int(1, 4);
      if (care.stage <= 3) { care.stays.push({ year: year(), reason: 'surgery', weeks: 1 }); care.history.push({ year: year(), text: 'A short stay in the hospital for surgery.' }); n.flags.inHospital = year(); }
    }
  }
  const med = meds[0];
  if (med) {
    const doc = prescriberFor(med);
    care.meds.push({ medId: med.id, startYear: year(), endYear: null, status: 'active', prescriberId: doc?.id ?? null, ...responseOf(n, med.id, c.id) });
    care.history.push({ year: year(), text: `Started ${med.name.toLowerCase()}${doc ? `, prescribed by ${clinicianName(doc)}` : ''}.` });
  }
  c.care = care;
  return care;
}

/** Older saves kept care as a line of text: give it the same shape, without inventing its past. */
function upgrade(n, c) {
  if (!c.care || c.care.v === 2) return;
  const since = c.care.since;
  const care = startCare(n, c);
  if (care) { care.since = since; care.history.unshift({ year: since, text: 'Began getting support (details from before were not kept).' }); }
  else c.care = { v: 2, since, therapy: null, meds: [], stays: [], history: [{ year: since, text: 'Began getting support.' }], details: false };
}

/** How much their care is helping with this condition now (0–0.9). */
export function careEffect(c) {
  const care = c.care;
  if (!care || care.v !== 2) return c.care ? 0.3 : 0;
  let keep = 1;
  const t = care.therapy;
  if (t && t.attended) keep *= 1 - Math.min(0.6, t.fit * 0.75 * t.progress * (t.status === 'active' ? 1 : 0.6));
  const m = care.meds.find((x) => x.status === 'active');
  if (m) keep *= 1 - RESPONSE[m.kind];
  return clamp(1 - keep, 0, 0.9);
}

/**
 * A year of someone's care: sessions attended (more if the player helps them
 * get there), a medicine review (a change if it is not helping or not
 * tolerated, with the old one kept in the history), hospital stays, and what
 * it all does for the condition and for their health.
 */
export function careYear(n, c) {
  const def = CONDITION_BY_ID[c.id];
  upgrade(n, c);
  const care = c.care;
  if (!care) return;
  const helped = n.flags.helpCare === year();
  const t = care.therapy;
  if (t?.status === 'active') {
    const th = THERAPY_BY_ID[t.therapyId];
    const doc = store.state.npcs[t.providerId];
    if (doc && !doc.alive) {
      const f = store.state.care?.facilities?.[t.facilityId];
      const next = f ? clinicianAt(f, doc.flags.clinician.profession, { exclude: [doc.id], another: true }) : null;
      care.history.push({ year: year(), text: `${clinicianName(doc)} died; ${next ? `${clinicianName(next)} took over` : 'their therapy paused'}.` });
      t.providerId = next?.id ?? null;
      if (!next) t.status = 'paused';
    }
    const weeks = th.kind === 'peer' ? 26 : 40;
    const due = Math.min(weeks, th.sessions - t.attended);
    const rate = clamp(0.78 + (helped ? 0.12 : 0) - (n.meters.health < 40 ? 0.1 : 0), 0.4, 0.97);
    let came = 0;
    for (let i = 0; i < due; i++) if (rng.chance(rate)) came++;
    t.attended += came; t.missed += due - came;
    t.progress = Math.round(clamp(t.attended / th.sessions, 0, 1) * 100) / 100;
    if (t.attended >= th.sessions) { t.status = 'completed'; care.history.push({ year: year(), text: `Finished ${th.name.toLowerCase()}.` }); }
  }
  const m = care.meds.find((x) => x.status === 'active');
  if (m && year() > m.startYear) {
    // The yearly review: a medicine that is not helping, or not tolerated, is changed, gradually.
    if (m.kind === 'little' || m.side || (m.kind === 'partial' && seeded('kinrev', n.id, m.medId, year()).chance(0.5))) {
      const next = npcMedOptions(n, c.id, care.meds.map((x) => x.medId))[0];
      const why = m.side ? 'side effects' : m.kind === 'little' ? 'not enough benefit' : 'only a partial response';
      if (next) {
        m.status = 'switched'; m.endYear = year(); m.reason = why;
        const doc = prescriberFor(next);
        care.meds.push({ medId: next.id, startYear: year(), endYear: null, status: 'active', prescriberId: doc?.id ?? null, replaces: m.medId, ...responseOf(n, next.id, c.id) });
        care.history.push({ year: year(), text: `Changed from ${MED_BY_ID[m.medId].name.toLowerCase()} to ${next.name.toLowerCase()} (${why}).` });
      } else if (m.side) {
        m.status = 'stopped'; m.endYear = year(); m.reason = why;
        care.history.push({ year: year(), text: `Came off ${MED_BY_ID[m.medId].name.toLowerCase()} gradually (${why}).` });
      }
    }
  }
  const eff = careEffect(c);
  if (MENTAL.includes(def.group)) {
    if (rng.chance((def.remit ?? 0.2) * 0.6 + eff * 0.45)) { c.remitted = year(); care.history.push({ year: year(), text: 'Much better: in remission.' }); }
  } else if (def.id === 'cancer') {
    if (t?.status === 'completed' && !c.remitted) {
      const chance = [0, 0.9, 0.75, 0.5, 0.2][care.stage ?? 2] * (t.attended / Math.max(1, t.attended + t.missed));
      if (seeded('kincancer', n.id, year()).chance(chance)) { c.remitted = year(); care.history.push({ year: year(), text: 'Treatment finished: in remission.' }); }
      else if (t.status === 'completed') { t.status = 'ended'; care.history.push({ year: year(), text: 'Treatment finished; the cancer is still there.' }); }
    }
    if (!c.remitted) n.meters.health = clamp(n.meters.health - (t?.status === 'active' ? 3 : 8));
  } else if (def.harm) n.meters.health = clamp(n.meters.health - Math.round(def.harm * (1 - eff) * 0.8));
  if (c.remitted && c.shared && care.details) log(`${n.firstName}'s ${def.short} is much better: the care has helped.`, 'system', 'good');
}

/**
 * A year for one person: care for each condition they have, started (their
 * decision, likelier with encouragement) or continued.
 */
export function kinCareYear(n) {
  for (const c of begunOf(n)) {
    const def = CONDITION_BY_ID[c.id];
    if (!c.diagnosed || c.remitted || !treatable(def)) continue;
    if (!c.care) {
      const push = (n.flags.encouraged >= year() - 1 ? 0.25 : 0) + (n.flags.goWith === year() ? 0.4 : 0);
      if (!rng.chance(0.3 + push) || !startCare(n, c)) { if (def.id === 'cancer') n.meters.health = clamp(n.meters.health - 8); else if (def.harm) n.meters.health = clamp(n.meters.health - Math.round(def.harm * 0.8)); continue; }
      if (c.shared && push) log(`${n.firstName} has started getting support for their ${def.short}.`, 'system', 'good');
    }
    careYear(n, c);
  }
}

/** A sudden hospital stay (a heart attack): recorded in their care, and the player hears if they shared it. */
export function kinAdmitted(n, c, reason, weeks = 1) {
  if (!c.care) startCare(n, c);
  c.care?.stays.push({ year: year(), reason, weeks });
  c.care?.history.push({ year: year(), text: `In the hospital after ${reason}.` });
  n.flags.inHospital = year();
  if (c.shared || n.meters.relationship >= 40) log(`${n.firstName} is in the hospital after ${reason}.`, 'system', 'bad');
}

// ---------- What the player can do, and see ----------

/** Ways the player can help, depending on what someone has shared and where their care is. */
export function npcCareActions(n) {
  if (!n?.alive || !n.health?.v) return [];
  const list = shared(n).filter((c) => c.diagnosed && !c.remitted && treatable(CONDITION_BY_ID[c.id]));
  const out = [];
  const untreated = list.some((c) => !c.care);
  const inCare = list.some((c) => c.care);
  if (untreated) {
    out.push({ id: 'encourageCare', label: 'Encourage them to get support' });
    if (n.meters.relationship >= 50 && player().age >= 16) out.push({ id: 'goWithCare', label: 'Offer to go with them to an appointment' });
  }
  if (inCare) {
    out.push({ id: 'askCare', label: 'Ask how their treatment is going' });
    if (player().age >= 16 && n.flags.helpCare !== year()) out.push({ id: 'helpCare', label: 'Help them get to their appointments this year' });
  }
  if (n.flags.inHospital === year() && n.flags.visited !== year()) out.push({ id: 'visitCare', label: 'Visit them in the hospital' });
  return out;
}

export function encourageCare(npcId) {
  const n = store.state.npcs[npcId];
  if (!n?.alive) return result(false, 'Not possible.', 'neutral');
  if (n.flags.encouraged === year()) return result(false, `You have already talked to ${n.firstName} about it this year.`, 'neutral');
  n.flags.encouraged = year();
  const well = n.meters.relationship >= 45;
  n.meters.relationship = clamp(n.meters.relationship + (well ? 2 : -3));
  return result(true, well ? `${n.firstName} listens, and says they will think about it. It is their decision; you have made it easier.` : `${n.firstName} bristles a little. Maybe another time, and another way.`, well ? 'good' : 'neutral');
}

export function goWithCare(npcId) {
  const n = store.state.npcs[npcId];
  if (!n?.alive) return result(false, 'Not possible.', 'neutral');
  if (n.flags.goWith === year()) return result(false, 'You have already offered.', 'neutral');
  n.flags.goWith = year(); n.flags.encouraged = year();
  n.meters.relationship = clamp(n.meters.relationship + 4);
  // Going together often turns "one day" into an appointment this year.
  for (const c of shared(n)) {
    if (!c.diagnosed || c.care || c.remitted || !treatable(CONDITION_BY_ID[c.id]) || !rng.chance(0.6)) continue;
    const care = startCare(n, c);
    if (!care) continue;
    care.details = true; // you were there
    const doc = store.state.npcs[care.therapy?.providerId ?? care.meds[0]?.prescriberId];
    return result(true, `You sit with ${n.firstName} in the waiting room. They come out having seen ${doc ? clinicianName(doc) : 'someone'}, with a plan.`, 'good');
  }
  return result(true, `${n.firstName} is touched that you offered. They are not ready yet, and say so.`, 'neutral');
}

/** Asking: they may tell you more, or may not. Either is fine. */
export function askCare(npcId) {
  const n = store.state.npcs[npcId];
  if (!n?.alive) return result(false, 'Not possible.', 'neutral');
  if (n.flags.askedCare === year()) return result(false, 'You asked this year already. Let them bring it up.', 'neutral');
  n.flags.askedCare = year();
  const list = shared(n).filter((c) => c.care);
  if (!list.length) return result(false, 'There is nothing to ask about.', 'neutral');
  const opens = n.meters.relationship >= 55 || seeded('ask', n.id, year()).chance(0.4);
  n.meters.relationship = clamp(n.meters.relationship + (opens ? 3 : 1));
  if (!opens) return result(true, `${n.firstName} says it is going all right, and changes the subject. That is their right.`, 'neutral');
  for (const c of list) c.care.details = true;
  const lines = list.map((c) => summary(n, c)).filter(Boolean);
  return result(true, `${n.firstName} tells you about it. ${lines.join(' ')}`, 'good');
}

export function helpCare(npcId) {
  const n = store.state.npcs[npcId];
  if (!n?.alive) return result(false, 'Not possible.', 'neutral');
  n.flags.helpCare = year();
  n.meters.relationship = clamp(n.meters.relationship + 3);
  return result(true, `You sort out lifts and reminders for ${n.firstName}'s appointments this year. Small things; they make a difference to how many they get to.`, 'good');
}

export function visitCare(npcId) {
  const n = store.state.npcs[npcId];
  if (!n?.alive) return result(false, 'Not possible.', 'neutral');
  n.flags.visited = year();
  n.meters.relationship = clamp(n.meters.relationship + 6);
  return result(true, `You bring grapes and a newspaper, and stay until the nurses hint. ${n.firstName} is very glad you came.`, 'good');
}

/** One condition's care, as they have told it. */
function summary(n, c) {
  const care = c.care;
  if (!care || care.v !== 2) return '';
  const parts = [];
  const t = care.therapy;
  if (t) {
    const doc = store.state.npcs[t.providerId];
    parts.push(`${THERAPY_BY_ID[t.therapyId].name}${doc ? ` with ${clinicianName(doc)}` : ''}: ${t.attended} session${t.attended === 1 ? '' : 's'}${t.status === 'completed' ? ', finished' : ''}.`);
  }
  const m = care.meds.find((x) => x.status === 'active');
  if (m) parts.push(`Taking ${MED_BY_ID[m.medId].name.toLowerCase()}${m.replaces ? ` (after ${MED_BY_ID[m.replaces].name.toLowerCase()})` : ''}.`);
  return parts.join(' ');
}

/** What the player may see on someone's profile: only what they have shared, and details only if they shared those. */
export function npcHealthLines(n) {
  return shared(n).map((c) => {
    const def = CONDITION_BY_ID[c.id];
    const name = nameIn(def, year()) ?? def.name;
    let state;
    if (c.remitted) state = 'In remission';
    else if (c.care) state = c.care.details ? summary(n, c) || `Getting support since ${c.care.since}` : `Getting support since ${c.care.since}`;
    else state = c.diagnosed ? (def.neurotype ? 'Part of who they are' : 'Not getting support at the moment') : 'Not diagnosed';
    return [name.charAt(0).toUpperCase() + name.slice(1), state];
  });
}

/** Their care history, if they have shared the details. */
export function npcCareHistory(n) {
  return shared(n).filter((c) => c.care?.details).flatMap((c) => c.care.history.map((x) => [x.year, `${CONDITION_BY_ID[c.id].short}: ${x.text}`])).sort((a, b) => b[0] - a[0]);
}

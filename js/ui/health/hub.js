// My Health: the player's health, care and supports, drawn entirely from the
// saved health record. Sections: Overview, Physical health, Mental health,
// My conditions, Appointments, Therapy, Medications, Accessibility & supports,
// Medical history and Health goals, with the Treatment Journey and DBT Journey
// as pages of their own.
//
// Navigation state (section, page, journey tab, expanded records, scroll) is
// kept here, so opening a clinician's profile and coming back lands exactly
// where the player was.
import { store, player, country } from '../../state.js';
import { esc, fmtMoney } from '../../util.js';
import { openModal, messageModal, pickModal, confirmModal } from '../modals.js';
import { avatarSvg } from '../avatar.js';
import { seeDoctor } from '../leisure.js';
import { CONDITION_BY_ID, GROUPS, MENTAL, nameIn } from '../../data/health/conditions.js';
import { MED_BY_ID, medName, FAMILIES } from '../../data/health/medications.js';
import { THERAPY_BY_ID, DBT_MODULES, MODULE_BY_ID, SKILLS } from '../../data/health/therapies.js';
import { PROFESSIONS } from '../../data/health/providers.js';
import { NEEDS, DEVICES, ACCOMMODATIONS, HOME_FEATURES } from '../../data/health/supports.js';
import { healthOf, presentConditions, activeDiagnoses, diagnosisFor } from '../../engine/health/record.js';
import * as care from '../../engine/health/care.js';
import * as meds from '../../engine/health/meds.js';
import * as ther from '../../engine/health/therapy.js';
import * as course from '../../engine/health/course.js';
import * as access from '../../engine/health/access.js';
import * as story from '../../engine/health/story.js';
import { now, when, rel, priceOf } from '../../engine/health/util.js';
import * as ins from '../../engine/health/insurance.js';
import * as hosp from '../../engine/health/hospital.js';
import * as sys from '../../engine/systems.js';

const SKILLS_NAMES = new Set(Object.values(SKILLS));
const SECTIONS = [
  ['overview', 'Overview'], ['physical', 'Physical'], ['mental', 'Mental health'], ['conditions', 'My conditions'], ['appointments', 'Appointments'],
  ['therapy', 'Therapy'], ['medications', 'Medications'], ['supports', 'Accessibility'], ['cover', 'Cover & hospital'], ['history', 'History'], ['goals', 'Goals'],
];
const JOURNEY = [['overview', 'Overview'], ['medications', 'Medications'], ['therapy', 'Therapy'], ['appointments', 'Appointments'], ['plans', 'Treatment plans'], ['history', 'History']];

/** Where the player is in My Health. Survives closing it, and leaving for a profile. */
const nav = { section: 'overview', page: null, journey: 'overview', open: {}, scroll: 0 };

const card = (title, body, extra = '') => `<div class="card hl-card"${extra}>${title ? `<h3>${title}</h3>` : ''}${body}</div>`;
const kv = (a, b) => `<div class="kv"><span>${esc(a)}</span><span>${b}</span></div>`;
const btn = (label, act, o = {}) => `<button class="btn ${o.primary ? 'primary' : ''} ${o.small ? 'hl-small' : ''}" data-act="${act}" ${o.arg != null ? `data-arg="${esc(o.arg)}"` : ''} ${o.disabled ? 'disabled' : ''}>${esc(label)}</button>`;
const pill = (text, tone = '') => `<span class="hl-pill ${tone}">${esc(String(text).charAt(0).toUpperCase() + String(text).slice(1).replace(/_/g, ' '))}</span>`;
const bar = (label, v, goodHigh = true) => `<div class="hl-meter"><span>${esc(label)}</span><i><b style="width:${Math.round(v)}%" class="${(goodHigh ? v : 100 - v) >= 60 ? 'good' : (goodHigh ? v : 100 - v) >= 35 ? 'mid' : 'low'}"></b></i><em>${esc(words(label, v))}</em></div>`;
const muted = (t) => `<p class="muted">${t}</p>`;
const money = (v) => (v ? fmtMoney(v, country()) : 'Free');
const npcOf = (id) => store.state.npcs[id];
/** A date in plain year terms: a player lives a year at a time, not a week at a time. */
const later = (wk) => (wk <= now() ? 'now' : Math.floor(wk / 52) === store.state.year ? 'later this year' : 'next year');

function words(label, v) {
  if (label === 'Stress') return v < 30 ? 'Low' : v < 55 ? 'Some' : v < 75 ? 'High' : 'Very high';
  if (label === 'Pain') return v < 10 ? 'None' : v < 30 ? 'A little' : v < 60 ? 'Some' : 'A lot';
  if (!['Sleep', 'Energy', 'Health', 'Practice'].includes(label) && !SKILLS_NAMES.has(label)) return v >= 75 ? 'Nearly there' : v >= 40 ? 'Halfway' : v > 0 ? 'Started' : 'Not yet';
  return v >= 70 ? 'Good' : v >= 50 ? 'Fair' : v >= 30 ? 'Low' : 'Very low';
}

/** A clinician's name and job, with their face: tapping it opens their own profile. */
function clinicianRow(npc, extra = '') {
  if (!npc) return '';
  const c = npc.flags.clinician;
  const f = care.facility(c.facilityId);
  return `<button class="row hl-person" data-person="${npc.id}">
    <div class="avatar">${avatarSvg({ age: npc.age, gender: npc.gender, appearance: npc.appearance, seed: npc.id, mood: 60, label: npc.firstName })}</div>
    <div class="main"><strong>${esc(care.clinicianName(npc))}</strong><small>${esc(PROFESSIONS[c.profession].name)}${c.dbt ? ', DBT-trained' : ''} · ${esc(f?.name ?? '')}</small>${extra ? `<small>${extra}</small>` : ''}</div>
    <div class="side">›</div></button>`;
}

/** For the People tab: the professional side of a clinician's profile. */
export function careRelationship(npc) {
  const p = player();
  const h = healthOf(p);
  const c = npc.flags.clinician;
  const f = care.facility(c.facilityId);
  const seen = h.appointments.filter((a) => a.providerId === npc.id && a.status === 'attended').length
    + h.therapies.filter((t) => t.providers?.some((x) => x.id === npc.id)).reduce((s, t) => s + t.sessions.filter((x) => x.attended).length, 0);
  const now = [...h.therapies.filter((t) => t.providerId === npc.id && ['active', 'paused'].includes(t.status)).map((t) => THERAPY_BY_ID[t.therapyId].name),
    ...h.trials.filter((t) => t.prescriberId === npc.id && meds.isLive(t)).map((t) => `Prescribing ${MED_BY_ID[t.medicationId].name.toLowerCase()}`)];
  const rapport = npc.meters.relationship;
  return `<div class="card hl-card" style="margin-top:12px">
    ${kv('Qualification', esc(c.qual))}
    ${kv('Works at', esc(f?.name ?? 'No longer practicing'))}
    ${kv('Experience', `${store.state.year - c.since} years`)}
    ${kv('Approach', esc(c.approach))}
    ${c.dbt ? kv('Training', 'Dialectical behavior therapy') : ''}
    ${c.retired ? kv('Status', 'Retired') : ''}
    ${kv('Your care with them', now.length ? esc(now.join('; ')) : seen ? 'Earlier care' : 'Not at the moment')}
    ${kv('Appointments and sessions', String(seen))}
    ${kv('Working relationship', rapport >= 70 ? 'Strong' : rapport >= 50 ? 'Good' : rapport >= 35 ? 'Still finding its feet' : 'Not a good fit so far')}
    <p class="muted" style="margin-top:8px">Confidential.</p></div>`;
}

// ---------- Sections ----------

function overview(p, h) {
  const w = h.wellbeing;
  const f = course.dailyFunctioning(p);
  const open = h.proposals.filter((x) => x.status === 'open');
  const next = care.upcoming(h).slice(0, 3);
  const sessions = h.therapies.filter((c) => c.status === 'active');
  return `
    
    ${open.map(proposalCard).join('')}
    ${card('How things are', `${bar('Sleep', w.sleep)}${bar('Energy', w.energy)}${bar('Stress', w.stress, false)}${bar('Pain', w.pain, false)}
      ${kv('Physical health', words('Health', p.stats.health))}${kv('Day-to-day life', esc(course.functioningWords(f)))}
      `)}
    ${card('Coming up', `${next.length ? next.map(apptLine).join('') : muted('Nothing booked.')}
      ${sessions.map((c) => kv(THERAPY_BY_ID[c.therapyId].short, 'Sessions through the year')).join('')}
      <div class="btn-stack" style="margin-top:10px">

      </div>
      `)}
    ${card('Getting help', `<div class="btn-stack">${btn('Talk to someone about how I have been feeling', 'seek', { arg: 'mental' })}${btn('Other kinds of assessment', 'seekOther')}${btn('My Treatment Journey', 'journey')}</div>`)}
    ${card('Preferences', `${kv('After a review', h.settings.follow ? 'Go with my clinician\'s recommendation' : 'Ask me each time')}
      ${kv('Hard storylines', h.settings.sensitive === 'full' ? 'Shown' : 'Reduced')}
      <div class="btn-row" style="margin-top:8px">${btn(h.settings.follow ? 'Ask me each time' : 'Follow recommendations', 'follow', { small: true })}${btn(h.settings.sensitive === 'full' ? 'Reduce hard storylines' : 'Show them again', 'sensitive', { small: true })}</div>
      `)}`;
}

function apptLine(a) {
  const n = npcOf(a.providerId);
  const what = { assessment: 'Assessment', review: 'Follow-up', monitoring: 'Health check', checkup: 'Check-up', specialist: 'Specialist' }[a.kind] ?? 'Appointment';
  return `<div class="kv"><span>${esc(what)} with ${esc(care.clinicianName(n))}</span><span>${esc(later(a.wk))} · ${esc(when(a.wk))}</span></div>`;
}

function proposalCard(prop) {
  const n = npcOf(prop.providerId);
  return `<div class="card hl-card hl-decide"><div class="eyebrow">A decision for you</div>${clinicianRow(n)}
    <p class="body" style="margin-top:8px">${esc(prop.summary)}</p>
    <div class="btn-stack">${prop.options.map((o) => `<button class="choice-btn ${prop.recommended === o.id ? 'hl-rec' : ''}" data-decide="${esc(prop.id)}" data-opt="${esc(o.id)}">${esc(o.label)}${prop.recommended === o.id ? ' · suggested' : ''}<small>${esc(o.sub ?? '')}</small></button>`).join('')}</div></div>`;
}

function physical(p, h) {
  const legacy = p.conditions.map((c) => kv(c.name.charAt(0).toUpperCase() + c.name.slice(1), `since age ${c.sinceAge}${c.treated ? ', managed' : ''}`)).join('');
  const body = presentConditions(h).filter((r) => !MENTAL.includes(CONDITION_BY_ID[r.conditionId].group) && CONDITION_BY_ID[r.conditionId].group !== 'neurodev');
  const known = body.filter((r) => diagnosisFor(r, h) || ['sensory', 'mobility'].includes(CONDITION_BY_ID[r.conditionId].group));
  const away = hosp.inHospital(p);
  const rehab = h.therapies.filter((c) => c.rehabGoals && (['active', 'paused'].includes(c.status) || now(p) - (c.endWk ?? 0) <= 26));
  return `${away ? card('In the hospital', `${kv('Since', esc(when(away.startWk)))}${kv('Expected home', esc(later(away.endWk)))}${muted('Appointments and sessions wait for you.')}`) : ''}
    ${card('Your body', `${bar('Health', p.stats.health)}${bar('Pain', h.wellbeing.pain, false)}${bar('Energy', h.wellbeing.energy)}`)}
    ${card('Long-term conditions', `${known.map((r) => { const d = diagnosisFor(r, h); return d ? `<button class="row hl-cond" data-cond="${esc(d.id)}"><div class="main"><strong>${esc(conditionName(r, h))}</strong><small>${esc(r.status === 'in_remission' ? 'In remission' : `${course.burdenWords(r.burden)}${r.effect ? ', treatment is helping' : ''}`)}</small></div><div class="side">›</div></button>` : kv(conditionName(r, h), 'Part of your life'); }).join('')}
      ${legacy ? `<div class="section-label">Short-term</div>${legacy}` : ''}${!legacy && !known.length ? muted('Nothing on record.') : ''}`)}
    ${rehab.map((c) => therapyCard(c, h)).join('')}
    ${card('The doctor', `<div class="btn-stack">${btn('Have a check-up, see a doctor, or sort out insurance', 'doctor', { primary: true })}${btn('See a specialist', 'seek', { arg: 'body' })}${btn('Hearing or sight', 'seek', { arg: 'senses' })}${body.some((r) => r.conditionId === 'back_pain') || p.age >= 40 ? btn('Ask for physiotherapy', 'physio') : ''}</div>`)}`;
}

function cover(p, h) {
  const c = ins.coverSummary(p);
  const k = sys.cover(p);
  const stays = hosp.admissions(p).slice().reverse();
  const cur = c.now;
  return `
    ${card('Your cover', `${kv('Now', esc(cur.name))}${kv('Health system', esc(cur.system))}${kv('You pay', `${Math.round(cur.share * 100)}% of a bill`)}${cur.premium ? kv('It costs', `${money(cur.premium)} a year`) : ''}
      ${muted(esc(c.how))}
      ${k.canBuy && !k.bought && !k.covered ? btn(`Take out health insurance (${money(k.price)} a year)`, 'insure', { primary: true }) : ''}${k.bought ? btn('Cancel your health insurance', 'uninsure', { small: true }) : ''}`)}
    ${card('Bills and claims', `${kv('Billed, all told', money(c.totals.billed))}${kv('Paid by cover', money(c.totals.insurer))}${kv('Paid by you', money(c.totals.you))}
      ${c.claims.length ? `<div class="section-label">Recent</div>${c.claims.slice(0, 15).map((x) => `<div class="kv"><span>${esc(when(x.wk))}: ${esc(x.what)}</span><span>${money(x.patientPaid)} ${pill(x.status, ['paid', 'paid on appeal'].includes(x.status) ? 'good' : '')}</span></div>${x.status === 'refused' && !x.appealed ? btn('Appeal this decision', 'appeal', { arg: x.id, small: true }) : ''}`).join('')}` : muted('No bills yet.')}`)}
    ${card('Hospital stays', stays.length ? stays.map((a) => kv(`${when(a.startWk)}: ${a.label}`, esc(a.status === 'in' ? `In the hospital, home ${later(a.endWk)}` : `${a.endWk - a.startWk} week${a.endWk - a.startWk === 1 ? '' : 's'}`))).join('') : muted('None.'))}
    ${c.policies.length > 1 ? card('Earlier cover', c.policies.filter((x) => x.endWk).map((x) => kv(x.name, esc(`${when(x.startWk)} to ${when(x.endWk)}`))).join('')) : ''}`;
}

function conditionName(r, h = healthOf()) {
  const d = diagnosisFor(r, h);
  return d?.name ? d.name.charAt(0).toUpperCase() + d.name.slice(1) : CONDITION_BY_ID[r.conditionId].name;
}

function mental(p, h) {
  const ex = course.experiences(p).filter((e) => !['hearing', 'sight', 'mobility', 'mobility_some', 'reach', 'colors'].includes(e.id));
  const dx = activeDiagnoses(h).filter((d) => MENTAL.includes(CONDITION_BY_ID[d.conditionId].group) || CONDITION_BY_ID[d.conditionId].group === 'neurodev');
  const active = h.therapies.filter((c) => c.status === 'active');
  const skills = Object.entries(h.skills).filter(([, v]) => v >= 3);
  return `${card('How you have been', `${bar('Stress', h.wellbeing.stress, false)}${bar('Sleep', h.wellbeing.sleep)}
      ${ex.length ? `<div class="section-label" style="margin-top:8px">What you have been noticing</div>${ex.map((e) => kv(e.label, esc(course.burdenWords(e.strength)))).join('')}
        ${muted('Only an assessment can tell what this is.')}` : muted('Nothing in particular stands out at the moment.')}`)}
    ${dx.length ? card('Diagnoses', dx.map((d) => `<button class="row hl-cond" data-cond="${esc(d.id)}"><div class="main"><strong>${esc(d.name.charAt(0).toUpperCase() + d.name.slice(1))}</strong><small>${esc(dxLine(d, h))}</small></div><div class="side">›</div></button>`).join('')) : ''}
    ${card('Care', `${active.length ? active.map((c) => kv(THERAPY_BY_ID[c.therapyId].name, esc(`${c.attended} session${c.attended === 1 ? '' : 's'}`))).join('') : muted('No current therapy.')}
      ${h.trials.filter(meds.isLive).map((t) => kv(MED_BY_ID[t.medicationId].name, esc(meds.RESPONSE_WORDS[t.responseState]))).join('')}
      <div class="btn-stack" style="margin-top:10px">${btn('Book an assessment', 'seek', { arg: 'mental' })}${btn('Find a therapist or group', 'findTherapy')}${h.therapies.some((c) => THERAPY_BY_ID[c.therapyId].dbt) ? btn('My DBT Journey', 'dbt') : ''}</div>`)}
    ${skills.length ? card('Skills you have practiced', skills.map(([k, v]) => bar(SKILLS[k], v)).join('')) : ''}`;
}

function dxLine(d, h) {
  const rec = h.conditions.find((c) => c.id === d.underlyingId);
  const by = npcOf(d.providerId);
  return `${d.migrated ? 'Recorded before this save kept details' : `Diagnosed ${when(d.wk)}${by ? ` by ${care.clinicianName(by)}` : ''}`}${rec && rec.status === 'in_remission' ? ' · in remission' : ''}${d.certainty === 'probable' ? ' · to be reviewed' : ''}`;
}

function conditions(p, h) {
  const list = activeDiagnoses(h);
  const earlier = h.diagnoses.filter((d) => d.status !== 'active');
  const plain = presentConditions(h).filter((r) => !diagnosisFor(r, h) && ['sensory', 'mobility'].includes(CONDITION_BY_ID[r.conditionId].group));
  if (!list.length && !plain.length) return card('', `${muted('No diagnosed conditions.')}<div class="btn-stack" style="margin-top:10px">${btn('Book an assessment', 'seekOther')}</div>`);
  const groups = [...new Set(list.map((d) => CONDITION_BY_ID[d.conditionId].group))];
  return `${groups.map((g) => card(GROUPS[g], list.filter((d) => CONDITION_BY_ID[d.conditionId].group === g).map((d) => `<button class="row hl-cond" data-cond="${esc(d.id)}"><div class="main"><strong>${esc(d.name.charAt(0).toUpperCase() + d.name.slice(1))}</strong><small>${esc(dxLine(d, h))}</small></div><div class="side">›</div></button>`).join(''))).join('')}
    ${plain.length ? card('Part of your life', plain.map((r) => kv(CONDITION_BY_ID[r.conditionId].name, 'Since birth')).join('')) : ''}
    ${earlier.length ? card('Earlier diagnoses', earlier.map((d) => kv(d.name, esc(d.status === 'revised' ? `Revised ${when(d.history.at(-1).wk)}` : d.status))).join('')) : ''}`;
}

/** One diagnosis, in full: never a percentage of "cured". */
function conditionPage(p, h, dxId) {
  const d = h.diagnoses.find((x) => x.id === dxId);
  if (!d) return muted('Not found.');
  const def = CONDITION_BY_ID[d.conditionId];
  const rec = h.conditions.find((c) => c.id === d.underlyingId);
  const plan = h.plans.flatMap((x) => x.components).filter((c) => c.diagnosisId === d.id || c.conditionId === d.conditionId);
  const opts = care.careOptions(d.id);
  const about = {
    bpd: 'Feelings that arrive strongly and fast, relationships that can feel intense, and a sense of self that can shift. It varies a great deal from person to person, and many people improve a lot over time, especially with therapy such as DBT.',
    mdd: 'A period of low mood or lost interest lasting weeks or more, often with changes in sleep, energy and concentration. It can lift, and it can come back; treatment helps many people.',
    bipolar_1: 'Episodes of depression and of mania lasting weeks, with stable stretches between. It is different from quick changes of feeling. Long-term care helps people live the lives they want.',
    bipolar_2: 'Episodes of depression and of hypomania (a milder high), with stable stretches between. Long-term care helps people live the lives they want.',
    adhd: 'A different way attention and executive function work. Support, strategies and, for some, medicine help; it is not a measure of intelligence.',
    autism: 'A different way of perceiving, communicating and experiencing the world. It is part of who you are; support is about what helps, not about changing you.',
    gad: 'Worry that is hard to put down, most days, for months, with tension, poor sleep or restlessness. Therapy and other treatments help many people.',
    dyslexia: 'Reading and spelling take more effort, whatever your ability. The right tools and arrangements let you show what you know.',
  }[def.id] ?? `${def.name}. Everyone's experience of it is their own.`;
  return `<button class="btn hl-back" data-back>← Back</button>
    ${card(esc(d.name.charAt(0).toUpperCase() + d.name.slice(1)), `<p class="body">${esc(about)}</p>
      ${kv('On record', esc(dxLine(d, h)))}${rec ? kv('Right now', esc(course.burdenWords(rec.burden))) : ''}
      ${rec?.status === 'in_remission' ? kv('Status', 'In remission') : ''}
      ${def.neurotype ? muted('A neurotype, not an illness.') : ''}`)}
    ${rec ? card('Your experience of it', rec.features.map((f) => `<div class="kv"><span>${esc((course.experiences(p).find((e) => e.id === f) ?? { label: f.replace(/_/g, ' ') }).label)}</span><span></span></div>`).join('')) : ''}
    ${card('Your care for this', `${plan.length ? plan.map((c) => kv(c.label, pill(c.status, c.status === 'active' ? 'good' : ''))).join('') : muted('Nothing yet.')}
      <div class="btn-stack" style="margin-top:10px">
        ${opts.therapies.filter((t) => t.ok).slice(0, 4).map((t) => btn(`${t.name} at ${t.facility}`, 'startTherapy', { arg: `${d.id}|${t.therapyId}|${t.facilityId}` })).join('')}
        ${opts.meds ? btn('Talk to a prescriber about medicine', 'discussMeds', { arg: d.id }) : `<p class="muted">${esc(opts.medsWhy)}</p>`}
        ${btn('Ask for a second opinion', 'second', { arg: d.id })}
        ${btn('Tell someone about this', 'tell', { arg: d.id })}
        ${rec ? btn(rec.sharedWithFamily ? 'Remove from family medical history' : 'Include in family medical history', 'shareFamily', { arg: rec.id }) : ''}
      </div>
      ${muted('Private to you. Only you decide who knows.')}`)}
    ${card('History', [...(rec?.history ?? []), ...d.history].sort((a, b) => a.wk - b.wk).map((x) => kv(when(x.wk), esc(x.text))).join(''))}`;
}

function appointments(p, h) {
  const up = care.upcoming(h);
  const past = h.appointments.filter((a) => a.status !== 'booked').slice(-15).reverse();
  return `${card('Booked', `${up.length ? up.map((a) => `${apptLine(a)}<div class="btn-row" style="margin:4px 0 8px">${btn('Cancel', 'cancel', { arg: a.id, small: true })}</div>`).join('') : muted('Nothing booked.')}
      <div class="btn-stack">${btn('Book an assessment', 'seekOther')}</div>`)}
    ${card('Earlier', past.length ? past.map((a) => `<div class="kv"><span>${esc(when(a.wk))}: ${esc(a.kind)} with ${esc(care.clinicianName(npcOf(a.providerId)))}</span><span>${pill(a.status, a.status === 'attended' ? 'good' : '')}</span></div>${a.outcome ? `<p class="muted hl-note">${esc(a.outcome)}</p>` : ''}`).join('') : muted('None yet.'))}`;
}

function therapyCard(c, h) {
  const t = THERAPY_BY_ID[c.therapyId];
  const n = npcOf(c.providerId);
  const g = c.groupId ? ther.groupOf(c.groupId) : null;
  const mod = g ? ther.moduleAt(g) : null;
  return card(esc(t.name), `${n ? clinicianRow(n, esc(`${t.short}${g ? `, ${g.day} ${g.evening ? 'evenings' : 'afternoons'}` : ''}`)) : ''}
    ${kv('Status', pill(c.status, c.status === 'active' ? 'good' : ''))}
    ${kv('Sessions', `${c.attended} attended${c.missed ? `, ${c.missed} missed` : ''}`)}
    ${c.status === 'active' ? kv('Next', esc(later(c.nextWk))) : ''}
    ${mod ? kv('This module', `${esc(MODULE_BY_ID[mod.id].name)}, week ${mod.weekIn} of ${mod.of}`) : ''}
    ${c.sessions.length ? kv('Last session', esc(c.sessions.at(-1).note)) : ''}
    ${c.rehabGoals ? `<div class="section-label">Goals</div>${c.rehabGoals.map((g) => (g.metWk ? kv(g.text, pill('Reached', 'good')) : bar(g.text.length > 28 ? `${g.text.slice(0, 26)}…` : g.text, g.progress))).join('')}` : ''}
    <div class="btn-row" style="margin-top:8px;flex-wrap:wrap">
      ${c.status === 'active' ? btn('Pause', 'pause', { arg: c.id, small: true }) : c.status === 'paused' ? btn('Resume', 'resume', { arg: c.id, small: true }) : ''}
      ${['active', 'paused'].includes(c.status) && !c.groupId && t.kind !== 'peer' ? btn('Change therapist', 'change', { arg: c.id, small: true }) : ''}
      ${['active', 'paused'].includes(c.status) ? btn('End', 'end', { arg: c.id, small: true }) : ''}
    </div>`);
}

function therapy(p, h) {
  const current = h.therapies.filter((c) => ['active', 'paused'].includes(c.status));
  const past = h.therapies.filter((c) => !['active', 'paused'].includes(c.status));
  const dbt = h.therapies.some((c) => THERAPY_BY_ID[c.therapyId].dbt) || activeDiagnoses(h).some((d) => d.conditionId === 'bpd');
  return `${current.length ? current.map((c) => therapyCard(c, h)).join('') : card('', muted('Not in therapy.'))}
    ${card('', `<div class="btn-stack">${btn('Find a therapist or group', 'findTherapy', { primary: !current.length })}${dbt ? btn('My DBT Journey', 'dbt') : ''}${btn('My Treatment Journey', 'journey')}</div>`)}
    ${past.length ? card('Earlier therapy', past.map((c) => kv(THERAPY_BY_ID[c.therapyId].name, esc(`${c.status}, ${c.attended} sessions, ${when(c.startWk)}`))).join('')) : ''}`;
}

function trialCard(t, h, full = false) {
  const med = MED_BY_ID[t.medicationId];
  const n = npcOf(t.prescriberId);
  const dx = h.diagnoses.find((d) => d.id === t.diagnosisId);
  const fx = meds.effectsNow(t);
  const live = meds.isLive(t);
  const open = nav.open[t.id] || full;
  return `<div class="card hl-card"><button class="hl-trial-head" data-toggle="${t.id}"><strong>${esc(medName(med, country().id))}</strong>
      <small>${esc(FAMILIES[med.family])} · for ${esc(dx?.name ?? CONDITION_BY_ID[t.conditionId].short)} · ${t.status === 'tapering' ? (t.replacedBy ? 'being reduced for a switch' : 'being reduced') : live ? 'current' : t.status === 'switched' ? 'previous trial' : t.status}</small><span>${open ? '▾' : '▸'}</span></button>
    ${open ? `${clinicianRow(n)}
      ${kv('Generic name', esc(med.name))}${kv('Started', esc(when(t.startWk)))}${t.endWk ? kv('Ended', esc(when(t.endWk))) : ''}
      ${kv('Status', pill(meds.RESPONSE_WORDS[t.responseState] ?? t.responseState, ['adequate', 'improving'].includes(t.responseState) ? 'good' : ''))}
      ${t.reported ? kv('What you reported', esc(t.reported.benefit)) : ''}
      ${live && fx.length ? kv('Side effects now', esc(fx.map((e) => e.label).join(', '))) : ''}
      ${live && t.status !== 'tapering' && t.nextReviewWk ? kv('Next follow-up', esc(later(t.nextReviewWk))) : ''}
      ${t.status === 'tapering' ? kv('Reduction ends', esc(later(t.taperEnd))) : ''}
      ${live && med.monitoring ? kv('Checks', esc(`${med.monitoring.what}${meds.monitoringOverdue(t) ? ' (overdue)' : ''}`)) : ''}
      ${t.changeReason ? kv('Why it changed', esc(t.changeReason)) : ''}
      ${t.replaces ? kv('Came after', esc(MED_BY_ID[h.trials.find((x) => x.id === t.replaces)?.medicationId]?.name ?? '')) : ''}
      ${t.reviews.length ? `<div class="section-label">Follow-ups</div>${t.reviews.map((r) => kv(`${when(r.wk)} (week ${r.weeks})`, esc(`${meds.RESPONSE_WORDS[r.state] ?? r.state}${r.decision ? `: ${r.decision.replace(/_/g, ' ')}` : ''}`))).join('')}` : ''}
      ${live && t.status !== 'tapering' ? `<div class="btn-row" style="margin-top:8px;flex-wrap:wrap">${btn('Report side effects', 'report', { arg: t.id, small: true })}${btn('Discuss how it is going', 'discuss', { arg: t.id, small: true })}${btn('Schedule a follow-up', 'discuss', { arg: t.id, small: true })}</div>` : ''}` : ''}</div>`;
}

function medications(p, h) {
  const live = h.trials.filter(meds.isLive);
  const past = h.trials.filter((t) => !meds.isLive(t));
  const open = h.proposals.filter((x) => x.status === 'open');
  return `${open.map(proposalCard).join('')}
    ${live.length ? live.map((t) => trialCard(t, h)).join('') : card('', muted('No current medicine.'))}
    ${past.length ? `<div class="section-label">Previous trials</div>${past.map((t) => trialCard(t, h)).join('')}` : ''}
    ${muted('Not medical advice.')}
    ${activeDiagnoses(h).some((d) => CONDITION_BY_ID[d.conditionId].care.meds) ? card('', `<div class="btn-stack">${btn('Talk to a prescriber about medicine', 'discussMedsPick')}</div>`) : ''}`;
}

function supports(p, h) {
  const list = access.supportSummary(p);
  const owned = access.devicesOwned(p);
  const acc = h.supports.accommodations.slice(-10).reverse();
  const home = access.homeRecord(p);
  const settingName = { school: 'School', work: 'Work', home: 'Home', transport: 'Getting around' };
  return `
    ${card('What helps you', list.length ? list.map((n) => `<div class="kv"><span>${esc(n.name)}</span><span>${n.settings.map((s) => pill(`${settingName[s.setting]}${s.met ? ' ✓' : ''}`, s.met ? 'good' : '')).join(' ')}</span></div>`).join('') + muted('✓ means it is in place there.') : muted('Nothing recorded.'))}
    ${card('Equipment', `${owned.length ? owned.map((d) => `<div class="kv"><span>${esc(DEVICES[d.deviceId].name)}</span><span>${btn('Put away', 'retire', { arg: d.id, small: true })}</span></div>`).join('') : muted('None.')}
      <div class="btn-stack" style="margin-top:8px">${btn('Get equipment', 'device')}${btn('Note a preference not to use something', 'declineDevice')}</div>`)}
    ${card('At school or work', `${acc.length ? acc.map((a) => kv(ACCOMMODATIONS[a.typeId].name, pill(a.status, a.status === 'granted' ? 'good' : ''))).join('') : muted('Nothing asked for yet.')}
      <div class="btn-stack" style="margin-top:8px">${btn('Ask school for an accommodation', 'accommodate', { arg: 'school', disabled: !access.placeOf('school', p) })}${btn('Ask work for an accommodation', 'accommodate', { arg: 'work', disabled: !access.placeOf('work', p) })}</div>
      ${muted('Only the need is shared. Nobody is told a diagnosis.')}`)}
    ${card(esc(home.name), `${home.features.length ? home.features.map((f) => kv(HOME_FEATURES[f].name, '✓')).join('') : muted('No adaptations.')}
      ${kv('How well it suits you', access.barrier('home', p) < 0.05 ? 'Well' : access.barrier('home', p) < 0.4 ? 'Mostly' : 'There are barriers')}
      <div class="btn-stack" style="margin-top:8px">${btn('Adapt this home', 'adapt')}</div>`)}
    ${card('', `<div class="btn-stack">${btn('Add something that helps me', 'addNeed')}${btn('Find support services', 'findTherapy')}</div>`)}`;
}

function history(p, h) {
  const items = [
    ...h.assessments.map((a) => ({ wk: a.wk, text: `Assessment with ${care.clinicianName(npcOf(a.providerId))}: ${a.outcome.replace(/_/g, ' ')}` })),
    ...h.diagnoses.map((d) => ({ wk: d.wk, text: `Diagnosis: ${d.name}${d.status === 'revised' ? ' (later revised)' : ''}` })),
    ...h.trials.flatMap((t) => [{ wk: t.startWk, text: `Started ${MED_BY_ID[t.medicationId].name.toLowerCase()}` }, ...(t.endWk ? [{ wk: t.endWk, text: `${t.status === 'switched' ? 'Switched from' : 'Stopped'} ${MED_BY_ID[t.medicationId].name.toLowerCase()}` }] : [])]),
    ...h.therapies.flatMap((c) => [{ wk: c.startWk, text: `Began ${THERAPY_BY_ID[c.therapyId].name.toLowerCase()}` }, ...(c.endWk ? [{ wk: c.endWk, text: `${c.status === 'completed' ? 'Completed' : 'Ended'} ${THERAPY_BY_ID[c.therapyId].name.toLowerCase()}` }] : [])]),
  ].sort((a, b) => b.wk - a.wk);
  const fam = story.familyHistory(p);
  return `${card('Your medical history', items.length ? items.slice(0, 40).map((x) => kv(when(x.wk), esc(x.text))).join('') : muted('Nothing yet.'))}
    ${familyCard(fam, h)}`;
}

function familyCard(fam, h) {
  const rows = fam.rows.filter((r) => r.conds.length || r.step);
  return card('Family medical history', `${rows.length ? rows.map((r) => kv(r.who + (r.alive === false ? ' †' : ''), r.step ? 'Not a blood relative' : esc(r.conds.map((c) => c.name).join(', ')))).join('') : muted('Nobody in the family has shared anything relevant.')}
    ${fam.unknown.map((u) => kv(u, 'Not known')).join('')}
    ${fam.screening.length ? `<div class="section-label">Worth knowing</div>${fam.screening.map((s) => `<p class="body">${esc(s.name)}: ${esc(s.text)}</p>${s.kind !== 'awareness' ? (s.done ? kv('Your result', esc(s.done)) : btn(`Genetic counseling and a ${s.kind} test (${money(story.testPrice())})`, 'gene', { arg: s.key, small: true })) : ''}`).join('')}` : ''}
    ${muted('Only what relatives chose to share, and inherited conditions families usually know about. Nobody\'s therapy notes or prescriptions.')}`);
}

function goals(p, h) {
  const plan = h.plans.find((x) => x.status !== 'completed');
  const list = plan?.goals ?? [];
  return `${card('Your goals', list.length ? list.map((g) => kv(g.text, pill(g.status === 'met' ? 'Reached' : 'Working on it', g.status === 'met' ? 'good' : ''))).join('') : muted('No goals set.'))}
    ${card('', `<div class="btn-stack">${btn('Choose goals', 'goals')}</div>`)}`;
}

// ---------- Treatment Journey ----------

function journey(p, h) {
  const tab = nav.journey;
  const tabs = `<div class="hl-tabs hl-subtabs" role="tablist">${JOURNEY.map(([id, l]) => `<button role="tab" data-jtab="${id}" class="${tab === id ? 'on' : ''}" aria-selected="${tab === id}">${l}</button>`).join('')}</div>`;
  const empty = !h.trials.length && !h.therapies.length && !h.assessments.length;
  let body;
  if (empty) body = card('', `${muted('Nothing yet.')}<div class="btn-stack" style="margin-top:10px">${btn('Talk to someone about how I have been feeling', 'seek', { arg: 'mental' })}${btn('Find a therapist or group', 'findTherapy')}</div>`);
  else if (tab === 'overview') {
    const plan = h.plans.find((x) => x.status !== 'completed');
    body = `${card('Where things stand', `${kv('Diagnoses', String(activeDiagnoses(h).length))}${kv('Current therapy', String(h.therapies.filter((c) => c.status === 'active').length))}${kv('Current medicine', String(h.trials.filter(meds.isLive).length))}${kv('Appointments kept', String(h.appointments.filter((a) => a.status === 'attended').length))}`)}
      ${plan ? planCard(plan, h) : ''}
      ${card('Milestones', (p.milestones.filter((m) => m.kind === 'health').slice(-8).reverse().map((m) => kv(`Age ${m.age}`, esc(m.text))).join('')) || muted('None yet.'))}`;
  } else if (tab === 'medications') body = h.trials.length ? [...h.trials].sort((a, b) => b.startWk - a.startWk).map((t) => trialCard(t, h)).join('') : card('', muted('No medicine so far.'));
  else if (tab === 'therapy') body = h.therapies.length ? h.therapies.map((c) => `${therapyCard(c, h)}${nav.open[c.id] ? sessionList(c) : `<button class="btn hl-small" data-toggle="${c.id}" style="margin:-6px 0 12px">Session history</button>`}`).join('') : card('', muted('No therapy so far.'));
  else if (tab === 'appointments') body = appointments(p, h);
  else if (tab === 'plans') body = h.plans.length ? h.plans.map((pl) => planCard(pl, h)).join('') : card('', muted('No care plan yet.'));
  else body = history(p, h);
  return `<button class="btn hl-back" data-back>← Back</button><h3 class="hl-page">My Treatment Journey</h3>${tabs}${body}`;
}

function sessionList(c) {
  return card('Session history', `${c.sessions.slice().reverse().slice(0, 30).map((s) => kv(`${when(s.wk)}${s.module ? ` · ${MODULE_BY_ID[s.module]?.name ?? ''}` : ''}`, esc(s.attended ? s.note : 'Missed'))).join('')}
    <button class="btn hl-small" data-toggle="${c.id}">Hide</button>`);
}

function planCard(plan, h) {
  const byCond = {};
  for (const c of plan.components) (byCond[c.conditionId ?? 'support'] ??= []).push(c);
  return card('Care plan', `${Object.entries(byCond).map(([cid, list]) => `<div class="section-label">${esc(cid === 'support' || !CONDITION_BY_ID[cid] ? 'Support' : `For ${CONDITION_BY_ID[cid].short}`)}</div>${list.map((c) => kv(c.label, pill(c.status, c.status === 'active' ? 'good' : ''))).join('')}`).join('')}
    ${plan.goals.length ? `<div class="section-label">Goals</div>${plan.goals.map((g) => kv(g.text, g.status === 'met' ? 'Reached' : 'Working on it')).join('')}` : ''}
    <div class="section-label">Changes</div>${plan.history.slice(-8).reverse().map((x) => kv(when(x.wk), esc(x.text))).join('')}`);
}

// ---------- DBT Journey ----------

function dbtPage(p, h) {
  const s = ther.dbtState(p);
  const ind = s.individual.find((c) => ['active', 'paused'].includes(c.status)) ?? s.individual.at(-1);
  const grpCourse = s.groupCourses.find((c) => ['active', 'paused'].includes(c.status)) ?? s.groupCourses.at(-1);
  const g = grpCourse ? ther.groupOf(grpCourse.groupId) : null;
  const goalsList = h.plans.flatMap((x) => x.goals);
  const done = s.groupCourses.flatMap((c) => Object.keys(c.moduleDone ?? {}));
  const hasBpd = activeDiagnoses(h).some((d) => d.conditionId === 'bpd');
  return `<button class="btn hl-back" data-back>← Back</button><h3 class="hl-page">My DBT Journey</h3>
    
    ${card('Individual DBT', ind ? `${clinicianRow(npcOf(ind.providerId))}${kv('Sessions', `${ind.attended} attended${ind.missed ? `, ${ind.missed} missed` : ''}`)}${ind.status === 'active' ? kv('Next', esc(later(ind.nextWk))) : kv('Status', esc(ind.status))}${ind.sessions.length ? kv('Last session', esc(ind.sessions.at(-1).note)) : ''}${['active', 'paused'].includes(ind.status) ? `${kv('Focus this year', esc(ind.focus ? MODULE_BY_ID[ind.focus].name : 'Whatever you need most'))}${btn('Change the focus', 'dbtFocus', { small: true })}` : ''}`
      : `${muted('Weekly sessions with a DBT-trained therapist.')}${btn('Find a DBT therapist', 'findTherapy', { arg: 'dbt' })}`)}
    ${card('DBT skills group', g ? `${g.facilitatorIds.map((id) => clinicianRow(npcOf(id), 'Facilitator')).join('')}${kv('Meets', `${esc(g.day)} ${g.evening ? 'evenings' : 'afternoons'}`)}
        ${s.module ? kv('Teaching now', `${esc(MODULE_BY_ID[s.module.id].name)}, week ${s.module.weekIn} of ${s.module.of}`) : ''}${kv('Your attendance', `${grpCourse.attended} of ${grpCourse.attended + grpCourse.missed}`)}
        ${muted('What people share in the group stays in the group.')}`
      : `${muted('A weekly class teaching the four skills modules.')}${btn('Join a skills group', 'findTherapy', { arg: 'dbt_group' })}`)}
    ${card('The four skills', DBT_MODULES.map((m) => `<div class="hl-module"><div class="kv"><span><strong>${esc(m.name)}</strong>${done.includes(m.id) ? ' · module completed' : ''}</span><span></span></div>${bar('Practice', s.skills[m.id])}<p class="muted">${esc(m.blurb)} ${esc(m.skills.join(', '))}.</p></div>`).join('')
     )}
    ${card('Goals', goalsList.length ? goalsList.map((g2) => kv(g2.text, g2.status === 'met' ? 'Reached' : 'Working on it')).join('') : muted('No goals set yet.'))}
    ${!hasBpd ? '' : ''}
    ${muted('A game, not a substitute for real therapy.')}`;
}

// ---------- The modal ----------

/**
 * Opens My Health. `to` can name a section, a page ('journey', 'dbt', 'cond:<id>'),
 * or come from the Life Story.
 */
export function openHealth(api, to = {}) {
  if (to.section) { nav.section = to.section; nav.page = null; }
  if (to.page) nav.page = to.page;
  if (to.journey) nav.journey = to.journey;
  const p = player();
  healthOf(p);
  const m = openModal(`
    <div class="dyn-head"><div><div class="eyebrow">${esc(p.firstName)}</div><h2>My Health</h2></div>
      <button class="icon-btn" data-close aria-label="Close">✕</button></div>
    <div class="hl-tabs" role="tablist" aria-label="My Health sections">${SECTIONS.map(([id, l]) => `<button role="tab" data-tab="${id}">${l}</button>`).join('')}</div>
    <div class="dyn-body hl-body" data-body></div>`, { dismissable: true });
  m.el.classList.add('dyn-modal', 'hl-modal');
  const body = m.el.querySelector('[data-body]');

  function draw(keepScroll = false) {
    const h = healthOf(p);
    const top = keepScroll ? body.scrollTop : 0;
    m.el.querySelectorAll('[data-tab]').forEach((b) => { const on = !nav.page && b.dataset.tab === nav.section; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
    const pages = { overview, physical, mental, conditions, appointments, therapy, medications, supports, cover, history, goals };
    body.innerHTML = nav.page === 'journey' ? journey(p, h) : nav.page === 'dbt' ? dbtPage(p, h) : nav.page?.startsWith('cond:') ? conditionPage(p, h, nav.page.slice(5)) : pages[nav.section](p, h);
    body.scrollTop = keepScroll ? top : nav.scroll && nav.restore ? nav.scroll : 0;
    nav.restore = false;
    m.el.querySelector(`[data-tab="${nav.section}"]`)?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }
  const after = async (r, keep = true) => { api.changed(); if (r?.text) await messageModal({ body: r.text, tone: r.tone }); if (r?.wantsTherapy) return findTherapy(); return draw(keep); };

  async function findTherapy(only) {
    const h = healthOf(p);
    const dxs = activeDiagnoses(h);
    let dxId = null; let therapyId = only;
    if (!therapyId) {
      const offered = new Map();
      for (const d of dxs) for (const t of care.careOptions(d.id).therapies) if (t.ok) offered.set(t.therapyId, { ...t, dxId: d.id, for: d.name });
      for (const id of ['supportive', 'dbt_group', 'depression_peer', 'grief_peer', 'disability_peer', 'couples']) if (!offered.has(id) && THERAPY_BY_ID[id] && store.state.year >= THERAPY_BY_ID[id].from) offered.set(id, { therapyId: id, name: THERAPY_BY_ID[id].name, dxId: null, for: 'support' });
      const pick = await pickModal({ title: 'What kind of support?', body: 'Therapy is offered for what you have been diagnosed with; some support needs no diagnosis at all.',
        options: [...offered.values()].map((t) => ({ value: t.therapyId, label: t.name, sub: `${THERAPY_BY_ID[t.therapyId].blurb}${t.for !== 'support' ? ` For ${t.for}.` : ''}` })) });
      if (!pick) return draw(true);
      therapyId = pick; dxId = offered.get(pick)?.dxId ?? null;
    } else dxId = dxs.find((d) => THERAPY_BY_ID[therapyId].for.includes(d.conditionId))?.id ?? null;
    const options = ther.findProviders(therapyId, dxId ? h.diagnoses.find((d) => d.id === dxId).conditionId : null, p);
    if (!options.length) { await messageModal({ body: 'Nobody nearby offers that at the moment.' }); return draw(true); }
    const choice = await pickModal({ title: THERAPY_BY_ID[therapyId].name, body: THERAPY_BY_ID[therapyId].blurb,
      options: options.map((o, i) => ({ value: i, disabled: !o.ok, label: o.group ? `${o.facility}${o.when ? `, ${o.when}` : ''}` : `${o.provider}, ${o.profession}`,
        sub: o.ok ? `${o.group ? (o.provider ? `Led by ${o.provider}. ` : '') : `${o.facility}. ${o.approach}, ${o.years} years' experience. `}${money(o.cost)} a session. First session in about ${o.wait} week${o.wait === 1 ? '' : 's'}.` : o.why })) });
    if (choice == null) return draw(true);
    const o = options[choice];
    return after(ther.startTherapy({ therapyId, facilityId: o.facilityId, providerId: o.providerId, dxId }));
  }

  async function seek(concern) {
    if (!concern) {
      concern = await pickModal({ title: 'What would you like help with?', options: Object.entries(care.CONCERNS).map(([id, c]) => ({ value: id, label: c.label })) });
      if (!concern) return draw(true);
    }
    const list = care.serviceOptions(concern, p);
    if (!list.length) { await messageModal({ body: 'There is nowhere nearby to go for this yet.' }); return draw(true); }
    const pick = await pickModal({ title: care.CONCERNS[concern].label, body: p.age < 16 ? 'Your parents will take you.' : 'Who would you like to see?',
      options: list.map((o, i) => ({ value: i, disabled: o.referral, label: `${o.professionName}, ${o.facility}`, sub: o.referral ? 'By referral from your primary care doctor.' : `${money(o.cost)}. Wait: about ${o.wait} week${o.wait === 1 ? '' : 's'}.` })) });
    if (pick == null) return draw(true);
    return after(care.seekAssessment(concern, list[pick].facilityId, list[pick].profession, p));
  }

  const flows = {
    dbtFocus: async () => { const m = await pickModal({ title: 'Your DBT focus this year', body: 'Your therapist will put extra time into it. The group goes on through all four modules.', options: [{ value: 'auto', label: 'Whatever I need most', sub: 'Your therapist decides as the year goes.' }, ...DBT_MODULES.map((x) => ({ value: x.id, label: x.name, sub: x.blurb }))] }); return m ? after(ther.setDbtFocus(m === 'auto' ? null : m)) : draw(true); },
    seek: (arg) => seek(arg), seekOther: () => seek(null), doctor: async () => { await seeDoctor(api); draw(true); },
    journey: () => { nav.page = 'journey'; draw(); }, dbt: () => { nav.page = 'dbt'; draw(); },
    follow: () => { const h = healthOf(p); h.settings.follow = !h.settings.follow; api.changed(); draw(true); },
    sensitive: () => { const h = healthOf(p); h.settings.sensitive = h.settings.sensitive === 'full' ? 'reduced' : 'full'; api.changed(); draw(true); },
    findTherapy: (arg) => findTherapy(arg || undefined),
    startTherapy: (arg) => { const [dxId, therapyId, facilityId] = arg.split('|'); const o = ther.findProviders(therapyId, healthOf(p).diagnoses.find((d) => d.id === dxId)?.conditionId, p).find((x) => x.facilityId === facilityId); return after(ther.startTherapy({ therapyId, facilityId, providerId: o?.providerId, dxId })); },
    discussMeds: (arg) => after(meds.discussMedication(arg)),
    discussMedsPick: async () => { const list = activeDiagnoses(healthOf(p)).filter((d) => CONDITION_BY_ID[d.conditionId].care.meds); const d = list.length === 1 ? list[0].id : await pickModal({ title: 'Which condition?', options: list.map((x) => ({ value: x.id, label: x.name })) }); return d ? after(meds.discussMedication(d)) : draw(true); },
    second: (arg) => after(care.secondOpinion(arg)),
    tell: async (arg) => { const people = p.npcIds.map(npcOf).filter((n) => n?.alive && !['clinician', 'pet', 'groupmate'].includes(n.role) && n.age >= 10); const who = await pickModal({ title: 'Tell someone', body: 'They will know about this diagnosis. Nobody else will be told.', options: people.map((n) => ({ value: n.id, label: `${n.firstName} ${n.lastName}`, sub: n.occupation ?? '' })) }); return who ? after(story.tell(who, arg)) : draw(true); },
    shareFamily: (arg) => { const rec = healthOf(p).conditions.find((c) => c.id === arg); return after(story.shareWithFamily(arg, !rec.sharedWithFamily)); },
    resched: (arg) => after(care.reschedule(arg)), cancel: (arg) => after(care.cancel(arg)),
    pause: (arg) => after(ther.pauseTherapy(arg)), resume: (arg) => after(ther.resumeTherapy(arg)), change: (arg) => after(ther.changeTherapist(arg)),
    end: async (arg) => ((await confirmModal({ title: 'End this therapy?', body: 'The record stays, and you can come back to therapy whenever you like.', yes: 'End it' })) ? after(ther.endTherapy(arg)) : draw(true)),
    report: (arg) => after(meds.reportSideEffects(arg)), discuss: (arg) => after(meds.discussResponse(arg)),
    retire: (arg) => after(access.retireDevice(arg)),
    device: async () => { const list = Object.entries(DEVICES).filter(([id]) => access.deviceAvailable(id)); const id = await pickModal({ title: 'Equipment', body: 'Your choice: what suits you, and nothing you do not want.', options: list.map(([k, d]) => ({ value: k, label: d.name, sub: money(priceOf(d.cost)) })) }); return id ? after(access.getDevice(id)) : draw(true); },
    declineDevice: async () => { const list = Object.entries(NEEDS).filter(([, n]) => n.optional); const id = await pickModal({ title: 'A preference', body: 'Something you would rather not use. It will be respected.', options: list.map(([k, n]) => ({ value: k, label: n.name })) }); return id ? after(access.declineDevice(id)) : draw(true); },
    accommodate: async (setting) => {
      const needs = access.needs(p).filter((n) => NEEDS[n.id].settings[setting]);
      const pool = needs.length ? needs.map((n) => n.id) : Object.keys(NEEDS).filter((k) => NEEDS[k].settings[setting]);
      const options = [];
      for (const nid of pool) for (const a of access.meetsFor(nid, setting)) if (ACCOMMODATIONS[a]?.settings.includes(setting) && !options.some((o) => o.value === `${a}|${nid}`)) options.push({ value: `${a}|${nid}`, label: ACCOMMODATIONS[a].name, sub: `For: ${NEEDS[nid].name.toLowerCase()}` });
      const v = await pickModal({ title: setting === 'school' ? 'Ask school' : 'Ask work', body: 'You say what would help. You do not have to say why.', options });
      if (!v) return draw(true);
      const [a, nid] = v.split('|');
      return after(access.requestAccommodation(setting, a, nid));
    },
    adapt: async () => { const list = Object.entries(HOME_FEATURES).filter(([id]) => access.homeFeatureAvailable(id) && !access.homeRecord(p).features.includes(id)); const id = await pickModal({ title: 'Adapt your home', options: list.map(([k, f]) => ({ value: k, label: f.name, sub: money(priceOf(f.cost)) })) }); return id ? after(access.adaptHome(id)) : draw(true); },
    addNeed: async () => { const id = await pickModal({ title: 'Something that helps you', body: 'No diagnosis needed.', options: Object.entries(NEEDS).map(([k, n]) => ({ value: k, label: n.name })) }); return id ? after(access.addNeed(id)) : draw(true); },
    gene: async (arg) => ((await confirmModal({ title: 'Genetic counseling and testing', body: 'A counselor talks it through with you first. Some people want to know; many decide not to. The result is yours alone.', yes: 'Go ahead', no: 'Not now' })) ? after(story.geneTest(arg)) : draw(true)),
    insure: async () => after(sys.setCover(true)), uninsure: async () => after(sys.setCover(false)),
    appeal: (arg) => after(ins.appeal(arg)),
    physio: () => after(hosp.requestRehab('back')),
    goals: async () => { const list = Object.entries(care.GOALS); const id = await pickModal({ title: 'Choose a goal', options: list.map(([k, g]) => ({ value: k, label: g.text })) }); if (id) care.setGoals([id]); api.changed(); return draw(true); },
  };

  m.el.addEventListener('click', async (e) => {
    if (e.target.closest('[data-close]')) return m.close();
    const tab = e.target.closest('[data-tab]');
    if (tab) { nav.section = tab.dataset.tab; nav.page = null; return draw(); }
    const jt = e.target.closest('[data-jtab]');
    if (jt) { nav.journey = jt.dataset.jtab; return draw(); }
    if (e.target.closest('[data-back]')) { nav.page = null; return draw(); }
    const tog = e.target.closest('[data-toggle]');
    if (tog) { nav.open[tog.dataset.toggle] = !nav.open[tog.dataset.toggle]; return draw(true); }
    const cond = e.target.closest('[data-cond]');
    if (cond) { nav.page = `cond:${cond.dataset.cond}`; return draw(); }
    const person = e.target.closest('[data-person]');
    if (person) {
      // The clinician's own profile; closing it comes straight back here, to the same place.
      nav.scroll = body.scrollTop; nav.restore = true;
      m.close();
      const { openNpc } = await import('../tabs/people.js');
      return openNpc(npcOf(person.dataset.person), api, () => openHealth(api));
    }
    const dec = e.target.closest('[data-decide]');
    if (dec) return after(meds.decide(dec.dataset.decide, dec.dataset.opt));
    const act = e.target.closest('[data-act]');
    if (act && !act.disabled && flows[act.dataset.act]) return flows[act.dataset.act](act.dataset.arg);
    return undefined;
  });
  draw(nav.restore);
  if (nav.restore) { body.scrollTop = nav.scroll; nav.restore = false; }
}

/** Family Tree → Family Medical History. */
export function openFamilyHistory(api) { openHealth(api, { section: 'history' }); }

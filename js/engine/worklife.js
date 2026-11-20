// Working life: the hours a week everything takes, what the law allows, how
// work wears on someone (stress, satisfaction, burnout) and how they recover,
// leave, benefits, and payroll — every source of earned income, paid once a
// year, taxed once, recorded.
//
// The career state (p.career) gains, beyond data/careers.js's fields:
//   employerId, postingId, startYear     where the main job is, and since when
//   hours, extra                         contracted hours a week; overtime asked for (−10…+15)
//   remote                               'none' | 'hybrid' | 'remote' for the main job
//   stress, satisfaction                 0–100; strain counts years spent close to burning out
//   leave                                { kind:'vacation'|'sick'|'parental'|'sabbatical', age } the year of life it covers
//                                        (actions happen during a year of age; the yearly tick and payroll look back at age − 1)
//   experience                           { careerId: years } across every employer, kept for good
//   sides                                more part-time jobs, beyond the original partTime slot
//   freelance                            the player's independent practice (engine/freelance.js)
//   offers, leads                        job offers in hand; recruiter approaches (engine/hiring.js, recruiters.js)
//   values                               what the player wants from work (up to three)
//   pensionPot, pensionDrawn             employer pension saved; whether a pension is being paid
//   benefit                              unemployment benefit after losing a job { amount, yearsLeft }
//   paidYear, lastPay                    the year last paid; what that pay stub said
//   achievements                         career milestones earned (engine/careerRecord.js)
import { rng } from '../rng.js';
import { workHours, contractLines, markContractsPaid } from './entertainment.js';
import { danceHours, danceLines, markDancePaid } from './dance.js';
import { dealLines, markDealsPaid } from './press.js';
import { musicLines, markMusicPaid, tourWeeks } from './music.js';
import { bookLines, markBooksPaid, published } from './publishing.js';
import { comebackLines, markComebacksPaid } from './celebs.js';
import { idolLines, markIdolPaid, trainee as idolTrainee, myGroup as idolGroup, myShows as varietyShows } from './kpop.js';
import { careHours } from './couple.js';
import { clamp, fmtMoney } from '../util.js';
import { store, player, country, npcsByRole, livingNpcs, log } from '../state.js';
import { CAREER_BY_ID } from '../data/careers.js';
import { WORK_LAW, DEFAULT, LOAD, STUDY_HOURS, COMMUTE } from '../data/workLaw.js';
import { CULTURES } from '../data/employers.js';
import { employer } from './employers.js';
import { hereCity } from './cities.js';
import { payouts, markPaid } from './business.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });

/** The working-time law where someone lives. */
export const workLaw = (countryId = player().countryId) => ({ ...DEFAULT, ...(WORK_LAW[countryId] ?? {}) });

/** Fills in any part of the career state an older save lacks. */
export function ensureCareer(c) {
  c.history ??= [];
  c.hours ??= c.careerId ? CAREER_BY_ID[c.careerId]?.hours ?? 40 : 0;
  c.extra ??= 0;
  c.remote ??= 'none';
  c.stress ??= 30;
  c.satisfaction ??= 60;
  c.strain ??= 0;
  c.leave ??= null;
  c.experience ??= {};
  if (!Object.keys(c.experience).length && c.careerId && c.yearsInField) c.experience[c.careerId] = c.yearsInField;
  c.sides ??= [];
  c.freelance ??= { services: {}, contracts: [], hoursOffered: 0, inquiries: [], inquiryYear: null, done: 0 };
  c.offers ??= [];
  c.leads ??= [];
  c.values ??= [];
  c.pensionPot ??= 0;
  c.pensionDrawn ??= !!c.retired;
  c.benefit ??= null;
  c.achievements ??= [];
  c.recruiterIds ??= [];
  c.mentees ??= [];
  return c;
}

/** The player's career state, complete. */
export const career = () => ensureCareer(player().career);

// ---------- Time ----------

/** Hours a week spent studying. */
export function studyHours(p = player()) {
  const e = p.education;
  if (!e.enrolled || e.stage === 'none') return 0;
  if (['elementary', 'middle', 'high'].includes(e.stage) || p.age < 18) return STUDY_HOURS.school;
  return e.partTime ? STUDY_HOURS.partTime : STUDY_HOURS.fullTime;
}

/** Whether the main job is on leave during a year of age (by default, the current one). */
export const onLeave = (c = career(), age = player().age) => (c.leave && c.leave.age === age ? c.leave.kind : null);

/** Hours a week of the main job, with any overtime, less leave. */
export function mainHours(c = career(), age = player().age) {
  if (!c.careerId) return 0;
  const away = onLeave(c, age);
  if (away && away !== 'vacation') return 0;
  return Math.max(0, c.hours + c.extra);
}

const commute = (c, p) => {
  if (!c.careerId || c.remote === 'remote' || CAREER_BY_ID[c.careerId].type === 'freelance') return 0;
  const base = COMMUTE[hereCity(p).kind] ?? 4;
  return c.remote === 'hybrid' ? Math.round(base / 2) : base;
};

/** Every commitment that takes time, in hours a week, during a year of age (by default the current one). */
/** Hours of training that are not a job (a professional's training is their job). Read from the sports record directly. */
function sportHours(p) {
  const a = store.state?.sports?.athletes?.[p.id];
  if (!a) return 0;
  return Object.values(a.sports).filter((e) => e.status === 'active' && !e.contractId).reduce((s, e) => s + (e.plan?.hours ?? 0), 0);
}

export function weeklyLoad(p = player(), age = p.age) {
  const c = ensureCareer(p.career);
  const rows = [];
  if (c.careerId) rows.push({ label: c.title, hours: mainHours(c, age), kind: 'job' });
  if (c.partTime) rows.push({ label: c.partTime.title, hours: c.partTime.hours ?? 12, kind: 'parttime' });
  for (const s of c.sides) rows.push({ label: s.title, hours: s.hours, kind: 'parttime' });
  const fl = freelanceHours(c);
  if (fl) rows.push({ label: 'Freelance work', hours: fl, kind: 'freelance' });
  for (const b of (p.businesses ?? []).filter((x) => x.status === 'open' && x.ownerHours > 0)) rows.push({ label: `Running ${b.name}`, hours: b.ownerHours, kind: 'business' });
  const stage = workHours(store.state.year - (p.age - age), p); // productions signed for (engine/entertainment.js)
  if (stage) rows.push({ label: 'Productions you are in', hours: stage, kind: 'freelance' });
  const dancing = danceHours(p, store.state.year - (p.age - age)); // dance gigs booked (engine/dance.js)
  if (dancing) rows.push({ label: 'Dance work', hours: dancing, kind: 'freelance' });
  // Idol training, or a group's schedule (engine/kpop.js).
  if (store.state.kpop && p.idol && !p.idol.hiatus && (age === p.age)) { if (idolTrainee(p)) rows.push({ label: 'Idol training', hours: 40, kind: 'freelance' }); else if (idolGroup(p)) rows.push({ label: 'Group schedule', hours: 45, kind: 'freelance' }); }
  if (store.state.kpop && p.idol?.variety && age === p.age) for (const sh of varietyShows(p)) rows.push({ label: sh.name, hours: sh.role === 'host' ? 14 : 10, kind: 'freelance' });
  const touring = tourWeeks(store.state.year - (p.age - age), p); // engine/music.js
  if (touring) rows.push({ label: 'On tour', hours: Math.round(touring * 50 / 48), kind: 'freelance' });
  const care = careHours(p);
  if (care) rows.push({ label: 'Looking after the children', hours: care, kind: 'care' });
  const study = studyHours(p);
  if (study) rows.push({ label: p.education.stage === 'high' || p.age < 18 ? 'School' : 'Studying', hours: study, kind: 'study' });
  const train = sportHours(p);
  if (train) rows.push({ label: 'Training', hours: train, kind: 'sport' });
  const travel = commute(c, p);
  if (travel) rows.push({ label: 'Getting to work', hours: travel, kind: 'commute' });
  const total = rows.reduce((s, r) => s + r.hours, 0);
  const paid = rows.filter((r) => ['job', 'parttime', 'freelance', 'business'].includes(r.kind)).reduce((s, r) => s + r.hours, 0);
  const word = total >= LOAD.crushing ? 'Crushing' : total >= LOAD.heavy ? 'Heavy' : total >= LOAD.comfortable ? 'Full' : total > 0 ? 'Manageable' : 'Free';
  return { rows, total, paid, word };
}

/** Hours a week the active freelance contracts take. */
export function freelanceHours(c = career()) {
  return Math.round((c.freelance?.contracts ?? []).filter((k) => k.status === 'active').reduce((s, k) => s + k.hours / 48, 0));
}

/**
 * Whether the player can take on this many more hours a week of paid work.
 * @param {number} hours
 * @param {{kind?:'job'|'parttime'|'freelance', replacesMain?:boolean}} [o]
 */
export function canFit(hours, o = {}) {
  const p = player();
  const c = career();
  const law = workLaw();
  const load = weeklyLoad(p);
  let total = load.total;
  let paid = load.paid;
  if (o.replacesMain) { total -= mainHours(c) + commute(c, p); paid -= mainHours(c); }
  // Performers are the exception to the minimum working age, as child labor laws make them: a child may act, sing or
  // dance for pay under an entertainment work permit, with a parent's consent (engine/entertainment.js asks for it)
  // and their earnings held in trust. The hours a minor may work still apply.
  if (p.age < law.workAge && !o.performer) return result(false, `In ${country().name} you must be ${law.workAge} to work for pay.`);
  if (p.age < 18 && paid + hours > law.minorHours) return result(false, `Under 18, the law here allows ${law.minorHours} hours of paid work a week during the school year. This would make ${paid + hours}.`);
  if (total + hours > LOAD.impossible) return result(false, `That would make ${total + hours} hours a week with everything else. There are not enough hours in the week.`);
  if (o.kind !== 'job' && !o.replacesMain) {
    const main = c.careerId ? CAREER_BY_ID[c.careerId] : null;
    if (main?.outside === false) return result(false, `As ${c.title.toLowerCase()} you may not take other paid work.`);
    if (p.politics && p.politics.tier >= 2) return result(false, `Holding office as ${p.politics.title} rules out outside paid work.`);
  }
  return result(true, total + hours >= LOAD.heavy ? `That would make ${total + hours} hours a week. It can be done, but it will cost you.` : '');
}

// ---------- How work feels ----------

const bossOf = () => npcsByRole('tag:boss')[0];
/** Where in its pay band a salary sits, 0–1. */
function bandPosition(c, career) {
  const lv = career.levels[c.level];
  if (!lv || !c.bandLo) return 0.5;
  return clamp((c.salary - c.bandLo) / Math.max(1, c.bandHi - c.bandLo), 0, 1.3);
}

/** How well a job fits what the player has said they want from work. */
export function valuesFit(c = career(), car = CAREER_BY_ID[c.careerId]) {
  if (!car || !c.values.length) return 0;
  return c.values.filter((v) => car.values.includes(v)).length / c.values.length;
}

/**
 * Once a year: stress and satisfaction move toward where the year puts them.
 * Burnout comes from staying near the top for long; it is recovered from,
 * and it is never fatal. @returns {string[]} lines for the journal
 */
export function tickWorkLife() {
  const p = player();
  const c = career();
  const lines = [];
  const lived = p.age - 1; // the year just lived
  const load = weeklyLoad(p, lived);
  const car = CAREER_BY_ID[c.careerId];
  const e = employer(c.employerId);
  const cult = e ? CULTURES[e.culture] : null;
  const away = !!onLeave(c, lived);
  const boss = bossOf();
  const mates = npcsByRole('coworker');
  const warmth = mates.length ? mates.reduce((s, n) => s + n.meters.relationship, 0) / mates.length : 55;
  const broke = p.finance.cash < 0 || p.flags.onBenefits;
  const kids = livingNpcs().filter((n) => n.role === 'child' && n.age < 14).length;

  let stressTarget = 12 + Math.max(0, load.total - 35) * 1.1 + (car ? car.stress * 9 : 0) + (cult?.stress ?? 0)
    + (boss && boss.meters.relationship < 35 ? 8 : 0) + (broke ? 10 : 0) + (kids && load.total > 50 ? kids * 3 : 0)
    + (c.remote !== 'none' ? -3 : 0) - (away ? 25 : 0) - (warmth - 55) / 6;
  if (!car && !load.paid) stressTarget = broke ? 45 : 20;
  c.stress = Math.round(clamp(c.stress + (clamp(stressTarget) - c.stress) * 0.5));

  if (car) {
    let sat = 52 + valuesFit(c, car) * 22 + (cult?.satisfaction ?? 0) + (bandPosition(c, car) - 0.5) * 14 + (warmth - 55) / 4
      + (boss ? (boss.meters.relationship - 50) / 6 : 0) + (c.performance >= 70 ? 5 : c.performance < 40 ? -6 : 0)
      - Math.max(0, c.stress - 60) / 2 + (car.type === 'freelance' ? 4 : 0) + (p.hidden.fame > 40 && car.fame ? 4 : 0);
    if (c.yearsInRole >= 6 && car.levels[c.level + 1]) sat -= 4; // stuck
    c.satisfaction = Math.round(clamp(c.satisfaction + (clamp(sat) - c.satisfaction) * 0.4));
  }

  // Mood follows both.
  p.stats.mood = clamp(p.stats.mood - Math.max(0, c.stress - 45) / 8 + (car && c.satisfaction >= 72 ? 2 : car && c.satisfaction < 35 ? -3 : 0));

  // Too much work is felt at home.
  if (load.total >= LOAD.heavy) {
    for (const n of livingNpcs().filter((x) => ['spouse', 'partner', 'child'].includes(x.role) && !x.flags.abroad)) {
      n.meters.relationship = clamp(n.meters.relationship - (load.total >= LOAD.crushing ? 4 : 2));
    }
    if (rng.chance(0.4) && livingNpcs().some((x) => ['spouse', 'partner', 'child'].includes(x.role))) {
      lines.push(load.total >= LOAD.crushing ? 'Work took almost every waking hour this year. The people at home noticed.' : 'Long weeks meant missed dinners and a birthday you only half made it to.');
    }
  }

  // Burnout, and coming back from it.
  if (c.stress >= 78) c.strain += 1;
  else c.strain = Math.max(0, c.strain - (c.stress < 55 ? 2 : 1));
  if (c.strain >= 2 && !p.flags.burnedOut) {
    p.flags.burnedOut = store.state.year;
    p.stats.mood = clamp(p.stats.mood - 10);
    p.stats.health = clamp(p.stats.health - 3);
    if (c.careerId) c.performance = clamp(c.performance - 10);
    lines.push('You are burned out. You sleep badly, snap at people, and dread Mondays. Fewer hours, time off, or a different job would help.');
  } else if (p.flags.burnedOut && c.strain === 0) {
    delete p.flags.burnedOut;
    lines.push('The worst of the burnout has passed. You feel like yourself again.');
  }
  // Leave ends with the year it was for.
  if (c.leave && c.leave.age < p.age) c.leave = null;
  return lines;
}

// ---------- Choices about time ----------

/** Asks for more or fewer hours, or overtime. */
export function changeHours(delta) {
  const p = player();
  const c = career();
  const car = CAREER_BY_ID[c.careerId];
  if (!car) return result(false, 'You do not have a job.');
  if (p.flags.hoursAskAge === p.age) return result(false, 'You have already changed your hours this year.', 'neutral');
  const law = workLaw();
  if (delta > 0) {
    if (c.hours + c.extra + delta > law.maxHours) return result(false, `${law.maxHours} hours a week is the most an employer may ask for here.`, 'neutral');
    const fit = canFit(delta);
    if (!fit.ok) return fit;
  }
  p.flags.hoursAskAge = p.age;
  const boss = bossOf();
  if (delta < 0) {
    // Fewer hours: some employers agree, some do not. Freelancers decide for themselves.
    const odds = car.type === 'freelance' ? 1 : clamp(0.35 + (c.performance - 50) / 120 + ((boss?.meters.relationship ?? 50) - 50) / 150 + (car.payModel === 'hourly' ? 0.25 : 0), 0.1, 0.95);
    if (!rng.chance(odds)) return result(false, `${boss?.firstName ?? 'Your employer'} says the role needs ${c.hours} hours. You could look for something part-time instead.`);
    const before = c.hours;
    c.hours = Math.max(car.hours >= 35 ? 16 : 8, c.hours + delta);
    if (car.payModel !== 'hourly') c.salary = Math.round(c.salary * c.hours / before); // salaried work is paid pro rata
    c.extra = Math.min(c.extra, 0);
    const text = `You now work ${c.hours} hours a week${car.payModel !== 'hourly' ? `, on ${fmtMoney(c.salary, country())} a year` : ''}.`;
    log(text);
    return result(true, text, 'neutral');
  }
  c.extra = clamp(c.extra + delta, -10, 15);
  const text = `You take on ${delta} more hours a week. ${car.payModel === 'hourly' ? 'Overtime pays time and a half.' : 'It is noticed, if not paid.'}`;
  log(text);
  return result(true, text, 'neutral');
}

/** Back to the hours in the contract. */
export function normalHours() {
  const c = career();
  const car = CAREER_BY_ID[c.careerId];
  if (!car) return result(false, 'You do not have a job.');
  c.extra = 0;
  return result(true, `You go back to your contracted ${c.hours} hours a week.`, 'neutral');
}

/** Leave this year. kind: 'vacation' | 'sick' | 'parental' | 'sabbatical'. */
export function takeLeave(kind) {
  const p = player();
  const c = career();
  const car = CAREER_BY_ID[c.careerId];
  if (!car) return result(false, 'You do not have a job to take leave from.');
  if (onLeave(c)) return result(false, 'You are already on leave this year.', 'neutral');
  const law = workLaw();
  const baby = livingNpcs().some((n) => n.role === 'child' && n.age <= 1);
  if (kind === 'parental' && !baby) return result(false, 'Parental leave is for the first year of a child\'s life.', 'neutral');
  if (kind === 'sick' && p.stats.health >= 70 && !p.flags.burnedOut) return result(false, 'You are not unwell enough to be signed off.', 'neutral');
  if (car.type === 'freelance') { c.leave = { kind, age: p.age }; return result(true, 'You take time off. Nobody pays you for it.', 'neutral'); }
  const boss = bossOf();
  if (kind === 'sabbatical') {
    const odds = clamp(0.25 + (c.performance - 60) / 100 + c.yearsInRole / 30, 0.05, 0.8);
    if (!rng.chance(odds)) { if (boss) boss.meters.relationship = clamp(boss.meters.relationship - 3); return result(false, `${boss?.firstName ?? 'Your employer'} will not hold your job open for a year.`); }
  }
  c.leave = { kind, age: p.age };
  c.stress = clamp(c.stress - (kind === 'vacation' ? 10 : 25));
  c.strain = Math.max(0, c.strain - (kind === 'vacation' ? 1 : 2));
  p.stats.mood = clamp(p.stats.mood + (kind === 'sick' ? 2 : 6));
  const paid = { vacation: `${law.leaveDays} days, paid`, sick: law.sickPay ? 'on sick pay' : 'unpaid: sick pay is not owed here', parental: law.parentalWeeks ? `${law.parentalWeeks} weeks paid, the rest unpaid` : 'unpaid: there is no paid parental leave here', sabbatical: 'unpaid' }[kind];
  const text = { vacation: `You take all your vacation days this year (${paid}). You come back rested.`,
    sick: `You are signed off sick (${paid}). Your job is held for you.`,
    parental: `You take parental leave (${paid}). The baby does not care about your career, and neither, for a while, do you.`,
    sabbatical: `A year's sabbatical, ${paid}. Your job will be there when you come back.` }[kind];
  log(text, 'system', 'good');
  return result(true, text);
}

/** Asks to work from home some or all of the time. */
export function askRemote(mode) {
  const p = player();
  const c = career();
  const car = CAREER_BY_ID[c.careerId];
  if (!car) return result(false, 'You do not have a job.');
  if (car.remote === 'none') return result(false, 'This work cannot be done from home.', 'neutral');
  if (mode === 'remote' && car.remote !== 'remote') return result(false, 'This work allows some days at home at most.', 'neutral');
  if (p.flags.remoteAskAge === p.age) return result(false, 'You have already asked this year.', 'neutral');
  p.flags.remoteAskAge = p.age;
  const e = employer(c.employerId);
  const odds = clamp((e?.remote ? 0.65 : 0.2) + (c.performance - 55) / 120 + (mode === 'hybrid' ? 0.15 : 0), 0.05, 0.95);
  if (!rng.chance(odds)) return result(false, `${e?.name ?? 'Your employer'} wants you in the office.`);
  c.remote = mode;
  const text = mode === 'remote' ? 'You work from home now. The commute is gone; so are the corridor conversations.' : 'You split the week between home and the office.';
  log(text, 'system', 'good');
  return result(true, text);
}

/** Lets the player say what they want from work. */
export function setValues(values) {
  career().values = values.slice(0, 3);
  return result(true, 'Noted. Jobs that offer what you care about will satisfy you more.', 'neutral');
}

// ---------- Benefits ----------

/** What the main job gives besides pay. */
export function benefits(c = career()) {
  const car = CAREER_BY_ID[c.careerId];
  if (!car || car.type === 'freelance') return [];
  const law = workLaw();
  const e = employer(c.employerId);
  const big = e && ['large', 'major'].includes(e.size);
  const cty = country();
  const out = [`Paid vacation: ${law.leaveDays + (big ? 5 : 0)} days`];
  out.push(law.sickPay ? 'Sick pay' : 'No statutory sick pay');
  if (law.parentalWeeks) out.push(`Parental leave: ${law.parentalWeeks} weeks paid`);
  if (law.pension || big) out.push(`Pension: employer pays ${Math.round((law.pension + (big ? 0.02 : 0)) * 100)}% of salary`);
  if (!cty.freeHealthcare && (big || e?.size === 'medium')) out.push('Health insurance');
  if (big && ['tech', 'corporate'].includes(car.family) && c.level >= 2) out.push('Share options');
  if (big) out.push('Training budget');
  if (car.family === 'retail' || car.family === 'hospitality') out.push('Staff discount');
  return out;
}

/** The employer's pension contribution rate. */
export function pensionRate(c = career()) {
  const e = employer(c.employerId);
  return workLaw().pension + (e && ['large', 'major'].includes(e.size) ? 0.02 : 0);
}

// ---------- Payroll ----------

/**
 * Every source of earned income for this year, before tax. Each source pays
 * once: callers mark the year paid (runPayroll).
 * @returns {{source:string, label:string, gross:number}[]}
 */
export function payLines(p = player()) {
  const c = ensureCareer(p.career);
  const law = workLaw(p.countryId);
  const lines = [];
  const car = CAREER_BY_ID[c.careerId];
  if (car && c.salary > 0) {
    let gross = c.salary;
    const leave = onLeave(c, p.age - 1); // payroll runs at the turn of the year, for the year just lived
    if (car.payModel === 'hourly' && c.hours > 0) gross = Math.round(c.salary * Math.max(0, c.hours + Math.max(0, c.extra) * 1.5 + Math.min(0, c.extra)) / c.hours);
    else if (car.payModel === 'commission') gross = Math.round(c.salary * (0.7 + c.performance / 100 * 0.6));
    else if (car.payModel === 'tips') gross = Math.round(c.salary * (0.9 + (p.stats.charm - 50) / 400 + c.performance / 1000));
    if (leave === 'sabbatical') gross = 0;
    else if (leave === 'sick' && !law.sickPay) gross = Math.round(gross * 0.4); // paid for the part of the year worked
    else if (leave === 'parental') gross = Math.round(gross * (1 - Math.max(0, 52 - law.parentalWeeks) / 52 * 0.6));
    if (car.id === 'author' && published(p).length) gross = 0; // a published author is paid by their books (bookLines)
    // An athlete's agent and a model's agency take their cut of the wage they negotiated.
    // A model's agency takes its cut of the wage it negotiated (a sports agent's share is settled in engine/sportsLife.js).
    const cut = car.id === 'modeling' ? (p.fame?.model?.agencyId ? p.fame.model.terms?.commission : null) : null;
    if (cut && gross > 0) { gross = Math.round(gross * (1 - cut)); lines.push({ source: 'main', label: `${c.title} (after your agency's ${Math.round(cut * 100)}%)`, gross }); }
    else if (gross > 0) lines.push({ source: 'main', label: c.title, gross });
  }
  if (c.partTime?.salary) lines.push({ source: 'parttime', label: c.partTime.title, gross: c.partTime.salary });
  for (const s of c.sides) lines.push({ source: `side:${s.id}`, label: s.title, gross: s.salary });
  for (const k of c.freelance.contracts) if (k.status === 'done' && !k.paid) lines.push({ source: `gig:${k.id}`, label: `${k.serviceName} for ${k.client}`, gross: k.fee });
  for (const k of c.freelance.contracts) if (k.status === 'failed' && !k.paid && k.partial) lines.push({ source: `gig:${k.id}`, label: `Part payment: ${k.serviceName}`, gross: k.partial });
  lines.push(...payouts(p)); // what the player's businesses paid out to their owner
  lines.push(...contractLines(p), ...danceLines(p), ...dealLines(p), ...musicLines(p), ...bookLines(p), ...comebackLines(p), ...idolLines(p)); // performance contracts and brand deals, each year once
  if (c.pensionDrawn && c.pensionPerYear) lines.push({ source: 'pension', label: 'Pension', gross: c.pensionPerYear });
  if (c.benefit?.yearsLeft > 0 && !car) lines.push({ source: 'benefit', label: 'Unemployment benefit', gross: c.benefit.amount });
  if (p.flags.statePension) lines.push({ source: 'state', label: 'State pension', gross: p.flags.statePension }); // engine/retirement.js
  return lines;
}

/**
 * Pays the year's income. Called once a year by finance; a second call in the
 * same year pays nothing.
 * @returns {{gross:number, lines:object[]}}
 */
export function runPayroll(p = player()) {
  const c = ensureCareer(p.career);
  if (c.paidYear === store.state.year) return { gross: 0, lines: [] };
  const lines = payLines(p);
  c.paidYear = store.state.year;
  for (const k of c.freelance.contracts) if (['done', 'failed'].includes(k.status)) k.paid = true;
  markPaid(p);
  markContractsPaid(p);
  markDancePaid(p);
  markDealsPaid(p);
  markMusicPaid(p);
  markBooksPaid(p);
  markComebacksPaid(p);
  markIdolPaid(p);
  const main = lines.find((l) => l.source === 'main');
  if (main) c.pensionPot = Math.round(c.pensionPot + main.gross * pensionRate(c));
  if (c.benefit) { c.benefit.yearsLeft -= 1; if (c.benefit.yearsLeft <= 0 || c.careerId) c.benefit = null; }
  const gross = lines.reduce((s, l) => s + l.gross, 0);
  c.lastPay = { year: store.state.year, lines, gross };
  return { gross, lines };
}

/** What all the player's work is expected to pay this year, for display. */
export const expectedPay = () => payLines().reduce((s, l) => s + l.gross, 0);

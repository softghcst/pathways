// Getting hired from a real opening: who can apply, the interview (or
// audition), the decision and why, the offer, negotiating it, and starting.
//
//   p.career.offers  [{ id, postingId, employerId, careerId, level, title, salary, hours, remote, partTime,
//                      age, asked:{salary?,hours?,remote?,time?}, score, via? }]
//   An offer lasts until the end of the year of age it was made in (two with "more time").
//
// The résumé is not typed in: it is read from the life (education, jobs,
// licenses, internships, service) whenever it is needed.
import { rng } from '../rng.js';
import { clamp, fmtMoney, uid } from '../util.js';
import { player, log } from '../state.js';
import { CAREER_BY_ID } from '../data/careers.js';
import { COUNTRIES } from '../data/countries.js';
import { GENERAL, PRACTICAL, MILITARY, AUDITION_PIECES, FAMILY_QUESTIONS } from '../data/interviewQuestions.js';
import { MAJOR_BY_ID } from '../data/majors.js';
import { TRADE_BY_ID, CERT_BY_ID, PROGRAMS } from '../data/schools.js';
import { resolve } from './conditions.js';
import { unmet, hire, doorBonus, royalWorkBlock } from './career.js';
import { employer, posting, isOpen, fillPosting, cultureOf } from './employers.js';
import { career as careerState, canFit, benefits } from './worklife.js';
import { takeSide } from './sideJobs.js';
import { residency } from './citizenship.js';
import { hiringClimate } from './economy.js';
import { stageTierOf, stageTraining, proCredits, workOf, districtOf } from './entertainment.js';
import { STAGE_BAR } from '../data/fame.js';
import { danceTraining } from './dance.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const yrs = (n) => `${n} ${n === 1 ? 'year' : 'years'}`;
const an = (noun) => `${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`;

// ---------- The résumé ----------

/**
 * Years of experience that count toward a track: its own (and any track it branches from) in full, other work
 * in the same field at a quarter. o.ownOnly: only the track's own line of work.
 */
export function experienceFor(careerId, c = careerState(), o = {}) {
  const car = CAREER_BY_ID[careerId];
  let own = c.experience[careerId] ?? 0;
  let related = 0;
  for (const [id, y] of Object.entries(c.experience)) {
    if (id === careerId || !CAREER_BY_ID[id]) continue;
    const other = CAREER_BY_ID[id];
    // A track this one branches from counts in full; the same field counts at a quarter.
    if ((car.from ?? []).some((f) => f.career === id)) own += y;
    else if (other.family === car.family) related += y * 0.25;
  }
  const interned = (player().flags.internships ?? []).filter((i) => i.careerId === careerId).length * 0.5;
  return Math.round((own + (o.ownOnly ? 0 : related) + interned) * 10) / 10;
}

/** Years of experience a level of a track usually asks for. */
export const yearsExpected = (car, level) => Math.round(car.levels.slice(0, level).reduce((s, l) => s + l.years, 0) * (level <= 1 ? 0.7 : 1));

/** The player's résumé, built from the life. */
export function resume(p = player()) {
  const c = careerState();
  const edu = p.education.degrees.map((d) => {
    if (d.type === 'high') return `${d.award ?? 'High-school diploma'}${d.school ? `, ${d.school}` : ''}`;
    if (d.type === 'university') return `Degree in ${MAJOR_BY_ID[d.majorId]?.name ?? 'a subject'}${d.school ? `, ${d.school}` : ''}`;
    if (d.type === 'apprenticeship') return `${TRADE_BY_ID[d.majorId]?.name ?? 'Trade'} apprenticeship`;
    if (d.type === 'certificate') return `Certificate in ${CERT_BY_ID[d.majorId]?.name ?? 'a skill'}`;
    return PROGRAMS[d.type]?.label ?? d.type;
  });
  const jobs = [...c.history].reverse().slice(0, 8).map((h) => `${h.title}${h.employer ? `, ${h.employer}` : ''} (age ${h.from}–${h.to})`);
  if (c.careerId) jobs.unshift(`${c.title}${employer(c.employerId) ? `, ${employer(c.employerId).name}` : ''} (since age ${p.age - c.yearsInRole})`);
  const licenses = p.flags.licenses ?? [];
  const interns = (p.flags.internships ?? []).map((i) => `Intern, ${i.employer}`);
  const service = c.history.some((h) => CAREER_BY_ID[h.careerId]?.type === 'military') || c.military ? ['Military service'] : [];
  const honors = c.achievements.slice(-4).map((a) => a.name);
  const skills = Object.entries({ Intellect: p.stats.intellect, Charm: p.stats.charm, Fitness: p.stats.health, Discipline: p.hidden.discipline })
    .filter(([, v]) => v >= 65).map(([k]) => k);
  return { education: edu, jobs, licenses, internships: interns, service, honors, strengths: skills };
}

// ---------- Applying ----------

const yearActs = () => {
  const p = player();
  if (p.flags.hireActs?.age !== p.age) p.flags.hireActs = { age: p.age, applied: {} };
  return p.flags.hireActs;
};

/** Everything the player needs to know about an opening, and whether they can go for it. */
export function postingView(id) {
  const post = posting(id);
  const p = player();
  const car = CAREER_BY_ID[post?.careerId];
  if (!post || !car) return null;
  const e = employer(post.employerId);
  const reasons = unmet(car, { ignoreCurrent: true, posting: post }).filter((r) => !/current job/.test(r));
  if (p.career.careerId === car.id && p.career.employerId === e.id && !post.internal) reasons.push('You already work there in this role.');
  if (!isOpen(post)) reasons.push('This opening has closed.');
  if (yearActs().applied[id]) reasons.push('You have already applied this year.');
  if (!residency(p).workAuthorized && post.countryId === p.countryId && !post.partTime) reasons.push('Your visa does not allow full-time work.');
  // A company on the major stage (Broadway, the West End…) casts its season from performers who have done it elsewhere, or through agents.
  const bigStage = car.id === 'mt_performer' && stageTierOf(e.id) === 'major_stage';
  if (bigStage && proCredits(p) < STAGE_BAR.company.credits && !workOf(p).agent) {
    const d = districtOf({ tier: 'major_stage', countryId: e.countryId, city: e.city });
    reasons.push(`Companies ${d?.on ?? 'on the major stage'} cast performers with ${STAGE_BAR.company.credits} professional stage credits, or through an agent.`);
  }
  const have = experienceFor(car.id);
  const want = yearsExpected(car, post.level);
  const stretch = Math.max(0, want - have);
  // A stretch is allowed; a leap is not. Senior posts want most of the usual years, in this line of work itself.
  const own = experienceFor(car.id, careerState(), { ownOnly: true });
  if (stretch > 3 || (post.level >= 2 && own < want * 0.6)) reasons.push(`They want about ${yrs(want)} of experience${post.level >= 2 ? ` as ${car.levels[post.level - 1].title.toLowerCase()} or similar` : ''}. You have ${post.level >= 2 ? own : have}.`);
  const hours = post.partTime ? canFit(post.hours, { kind: 'parttime' }) : canFit(post.hours + 0, { kind: 'job', replacesMain: !!p.career.careerId });
  if (!hours.ok) reasons.push(hours.text);
  return { post, employer: e, career: car, eligible: !reasons.length, reasons, stretch, have, want, culture: cultureOf(e),
    note: stretch > 0 ? `A stretch: wants ${yrs(want)} of experience.` : '' };
}

/** Questions for an opening: one from its own field, the rest general. */
function questionsFor(car) {
  const own = [...(FAMILY_QUESTIONS[car.family] ?? [])];
  const general = [...({ practical: [...PRACTICAL, ...GENERAL.slice(0, 4)], military: MILITARY }[car.hire] ?? GENERAL)];
  const out = [];
  if (own.length) out.push(own.splice(rng.int(0, own.length - 1), 1)[0]);
  while (out.length < 3 && general.length) out.push(general.splice(rng.int(0, general.length - 1), 1)[0]);
  return out;
}

/** How well an answer lands for this candidate (0–2). Answers with a strength (k) suit people who have it. */
export function answerScore(a) {
  if (a.k == null) return a.s;
  const have = Number(resolve(a.k)) || 0;
  return clamp(a.s + (have - 55) / 45, 0, 2);
}

/** Begins an application. @returns {{kind:'blocked'|'interview'|'audition'|'portfolio', text?, questions?, pieces?, view?}} */
export function apply(id) {
  const p = player();
  const view = postingView(id);
  if (!view) return { kind: 'blocked', text: 'That opening no longer exists.' };
  const royalNo = royalWorkBlock(view.career);
  if (royalNo) return { kind: 'blocked', text: royalNo };
  if (p.politics && p.politics.tier >= 2 && !view.post.partTime) return { kind: 'blocked', text: `Being ${p.politics.title} is a full-time job. You would have to resign first.` };
  if (!view.eligible) return { kind: 'blocked', text: view.reasons[0] };
  if (view.career.hire === 'audition') return { kind: 'audition', pieces: AUDITION_PIECES[view.career.skill] ?? AUDITION_PIECES['talents.acting'], view };
  if (view.career.hire === 'portfolio') return { kind: 'portfolio', view };
  return { kind: 'interview', questions: questionsFor(view.career), view };
}

/**
 * Finishes an application. answers: the answer objects chosen (interview), or
 * [piece index] (audition). Success makes an offer; it does not hire.
 * @returns {{ok:boolean, text:string, tone:string, offer?:object}}
 */
export function decide(id, answers = [], o = {}) {
  const p = player();
  const view = postingView(id);
  if (!view?.eligible) return result(false, view?.reasons[0] ?? 'That opening has closed.', 'neutral');
  yearActs().applied[id] = true;
  const { post, career: car, employer: e } = view;
  const bonus0 = doorBonus(car) + (o.bonus ?? 0) + (p.flags.veteran && ['safety', 'government', 'transport'].includes(car.family) ? 0.1 : 0);
  // Employers in office, technical and public work prefer a degree even where it is not required, and more so higher up.
  const graduate = p.education.degrees.some((d) => ['university', 'graduate', 'doctorate', 'business', 'law', 'medical'].includes(d.type));
  const deskWork = ['corporate', 'tech', 'government', 'science', 'media', 'law', 'education', 'health'].includes(car.family);
  const degreeEdge = deskWork && !car.req?.degree && !car.req?.program ? (graduate ? 0.04 + post.level * 0.03 : -post.level * 0.05) : 0;
  const bonus = bonus0 + degreeEdge;
  const stretch = view.stretch * 0.07;
  // More people go for junior jobs, and in a slump; and every rung up, the field is stronger.
  const crowd = (post.level === 0 ? 0.04 : 0) + post.level * 0.06 + Math.max(0, -hiringClimate()) * 0.5;
  let score;
  let chance;
  let how;
  if (car.hire === 'audition') {
    const pieces = AUDITION_PIECES[car.skill] ?? AUDITION_PIECES['talents.acting'];
    const piece = pieces[answers[0] ?? 0];
    // A major-stage company judges against a far higher bar, before a far bigger crowd; stage training shows (STAGE_BAR).
    const bigStage = car.id === 'mt_performer' && stageTierOf(e.id) === 'major_stage';
    const need = bigStage ? STAGE_BAR.company.need : car.req.stats?.[car.skill] ?? 50;
    // Training shows: in musical theater for a company's season, in dance for a dance company (a BFA in dance most).
    const trained = car.id === 'mt_performer' ? STAGE_BAR.training[stageTraining(p)]?.company ?? 0
      : car.id === 'dance' ? ({ bfa: 0.12, ba: 0.05, theater: 0.02 })[danceTraining(p)] ?? 0 : 0;
    score = clamp(0.5 + ((Number(resolve(piece.path)) || 0) - need) / 60, 0, 1);
    chance = clamp(0.3 + ((Number(resolve(piece.path)) || 0) - need) / 45 + piece.edge + bonus + trained - stretch - crowd - (bigStage ? STAGE_BAR.company.crowd : 0), 0.03, 0.95);
    how = `You chose ${piece.t.toLowerCase()}.`;
  } else if (car.hire === 'portfolio') {
    score = clamp((Number(resolve(car.skill)) || 50) / 100, 0, 1);
    chance = clamp(0.35 + score * 0.5 + bonus - stretch, 0.05, 0.95);
    how = 'They looked through your work.';
  } else {
    score = answers.reduce((s, a) => s + answerScore(a), 0) / (2 * Math.max(1, answers.length));
    const manner = car.hire === 'military' ? (p.stats.health - 50) / 200 + (p.hidden.discipline - 50) / 250 : (p.stats.charm - 50) / 250;
    const grades = Math.max(0, ...p.education.degrees.filter((d) => d.type !== 'apprenticeship').map((d) => d.gpa));
    chance = clamp(0.18 + score * 0.55 + manner + (grades ? (grades - 3) * 0.08 : 0) + bonus - stretch - crowd + rng.around(0, 0.06), 0.04, 0.95);
    how = score >= 0.8 ? 'The interview went very well.' : score >= 0.5 ? 'A solid interview.' : 'Not your best interview.';
  }
  if (!rng.chance(chance)) {
    // Why, as the employer would put it.
    const why = view.stretch > 1 ? 'another candidate had more relevant experience'
      : score < 0.45 ? 'some of your answers did not convince them'
        : crowd > 0.05 ? 'they had a great many strong applicants'
          : rng.pick(['they went with an internal candidate', 'another candidate was a slightly closer fit', 'they decided not to fill the role after all']);
    if (/not to fill/.test(why)) post.status = 'withdrawn';
    p.stats.mood = clamp(p.stats.mood - 3);
    const text = `${how} ${e.name} turned you down for the ${post.title.toLowerCase()} job: ${why}.`;
    log(text, 'system', 'bad');
    return result(false, text);
  }
  const offer = makeOffer(post, score, o.via);
  const text = `${how} ${e.name} has offered you the job: ${an(post.title.toLowerCase())}, ${fmtMoney(offer.salary, COUNTRIES[post.countryId])} a year${post.partTime ? ` for ${post.hours} hours a week` : ''}.${offer.low ? ' It is a little lower than the top of what they advertised.' : ''}`;
  log(text, 'system', 'good');
  return { ...result(true, text), offer };
}

function makeOffer(post, score, via) {
  const [lo, hi] = post.pay;
  const salary = Math.round(lo + (hi - lo) * clamp(score * 0.6 + rng.next() * 0.25, 0, 0.85));
  const offer = { id: uid('offer'), postingId: post.id, employerId: post.employerId, careerId: post.careerId, level: post.level, title: post.title,
    salary, hours: post.hours, remote: post.remote === 'remote' ? 'hybrid' : 'none', partTime: post.partTime, age: player().age, asked: {}, score, via: via ?? null, low: salary < (lo + hi) / 2 };
  careerState().offers.push(offer);
  return offer;
}

export const offers = () => careerState().offers.filter((o) => o.age >= player().age - (o.asked.time ? 1 : 0));

/** What an offer comes with. */
export function offerTerms(offer) {
  const e = employer(offer.employerId);
  const fake = { careerId: offer.careerId, employerId: offer.employerId, level: offer.level };
  return { employer: e, career: CAREER_BY_ID[offer.careerId], benefits: offer.partTime ? ['Paid by the hour'] : benefits({ ...careerState(), ...fake }), culture: cultureOf(e) };
}

/**
 * Asks for something better. what: 'salary' | 'hours' | 'remote' | 'time'.
 * Each may be asked once. Pushing can lose an offer, rarely.
 */
export function negotiate(offerId, what) {
  const offer = careerState().offers.find((o) => o.id === offerId);
  if (!offer) return result(false, 'That offer is no longer open.', 'neutral');
  if (offer.asked[what]) return result(false, 'You have already asked about that.', 'neutral');
  offer.asked[what] = true;
  const post = posting(offer.postingId);
  const e = employer(offer.employerId);
  const p = player();
  const pushes = Object.keys(offer.asked).length;
  const lose = clamp(0.03 * pushes - offer.score * 0.03 + (hiringClimate() < 0 ? 0.04 : 0), 0, 0.15);
  if (what !== 'time' && rng.chance(lose)) {
    careerState().offers = careerState().offers.filter((o) => o.id !== offerId);
    const text = `${e.name} decided to offer the role to another candidate.`;
    log(text, 'system', 'bad');
    return result(false, text);
  }
  if (what === 'salary') {
    const room = (post?.pay[1] ?? offer.salary) * 1.08 - offer.salary;
    if (room <= 0 || !rng.chance(clamp(0.35 + offer.score * 0.35 + (p.stats.charm - 50) / 200, 0.1, 0.85))) return result(false, '"This is the best we can do on salary."', 'neutral');
    const up = Math.round(Math.min(room, offer.salary * rng.int(4, 10) / 100));
    offer.salary += up;
    return result(true, `They came up to ${fmtMoney(offer.salary, COUNTRIES[post?.countryId ?? p.countryId])} a year.`);
  }
  if (what === 'hours') {
    const car = CAREER_BY_ID[offer.careerId];
    if (car.payModel === 'hourly' || offer.hours <= 24 || !rng.chance(0.45)) return result(false, '"The role needs the hours we advertised."', 'neutral');
    const before = offer.hours;
    offer.hours = Math.max(24, offer.hours - 8);
    offer.salary = Math.round(offer.salary * offer.hours / before);
    return result(true, `They agreed to ${offer.hours} hours a week, paid pro rata.`);
  }
  if (what === 'remote') {
    const car = CAREER_BY_ID[offer.careerId];
    if (car.remote === 'none') return result(false, '"This is not work that can be done from home."', 'neutral');
    if (!rng.chance(e.remote ? 0.7 : 0.25)) return result(false, '"We need you in the office."', 'neutral');
    offer.remote = car.remote === 'remote' && rng.chance(0.5) ? 'remote' : 'hybrid';
    return result(true, offer.remote === 'remote' ? 'They agreed you can work from home.' : 'They agreed to a few days a week at home.');
  }
  if (what === 'time') return result(true, 'They will hold the offer open until the end of next year.', 'neutral');
  return result(false, 'They did not understand the question.', 'neutral');
}

export function decline(offerId) {
  const offer = careerState().offers.find((o) => o.id === offerId);
  careerState().offers = careerState().offers.filter((o) => o.id !== offerId);
  return result(true, offer ? `You turned down the ${offer.title.toLowerCase()} job.` : 'Declined.', 'neutral');
}

/** Takes an offer: a full-time job replaces the main job; a part-time one is added beside it. */
export function accept(offerId) {
  const c = careerState();
  const offer = c.offers.find((o) => o.id === offerId);
  if (!offer) return result(false, 'That offer is no longer open.', 'neutral');
  const post = posting(offer.postingId);
  const car = CAREER_BY_ID[offer.careerId];
  const p = player();
  if (post && post.countryId !== p.countryId) return result(false, 'This job is in another country: you would have to move there first.', 'neutral');
  const fit = offer.partTime ? canFit(offer.hours, { kind: 'parttime' }) : canFit(offer.hours, { kind: 'job', replacesMain: !!c.careerId });
  if (!fit.ok) return fit;
  c.offers = c.offers.filter((o) => o.id !== offerId);
  if (post) fillPosting(post.id, 'player');
  if (offer.partTime) return takeSide(offer);
  return hire(car, offer.level, 45 + Math.round(offer.score * 20), `You accepted ${employer(offer.employerId).name}'s offer.`,
    { employerId: offer.employerId, postingId: offer.postingId, salary: offer.salary, hours: offer.hours, remote: offer.remote });
}

/** Offers lapse at the end of the year they were made in (or the next, if more time was asked). */
export function tickOffers() {
  const c = careerState();
  const age = player().age;
  c.offers = c.offers.filter((o) => o.age + (o.asked.time ? 1 : 0) >= age);
}

/** The openings applied for this year. */
export const appliedThisYear = () => Object.keys(yearActs().applied);

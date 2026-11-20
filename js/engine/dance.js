// A dancer's working life, one gig at a time: commercials and music videos, a season at a theme park or on a cruise
// ship, a pro team's dance squad, a resort revue, a celebrity's tour, choreography, and a season as a professional on
// the televised dance competition. And dance competitions, from a regional contest at six to the world championships.
// The company ladder (company dancer to principal) is a career (data/occupations.js 'dance'); dance ensemble parts in
// musicals are cast like any part (engine/entertainment.js). This is everything in between.
//
//   p.fame.dance = { gigs:[Gig], offers:{ age, list:[Offer], went }, comps:[Result], best:{ level: place }, entered:{ age, n } }
//   Gig    { id, year, kind, client, fee, weeks, hours, prestige, style, trust, paid, partner?, place? }
//   Offer  { id, kind, client, city, fee, wants, brief, status: 'open'|'booked'|'lost' }
import { rng } from '../rng.js';
import { clamp, fmtMoney, localWage } from '../util.js';
import { store, player, country, log, milestone } from '../state.js';
import { COUNTRIES } from '../data/countries.js';
import { DANCE_GIGS, DANCE_YEAR, DANCE_STYLES, DANCE_WANTS, DANCE_BRIEFS, DANCE_CLIENTS, DANCE_SHOW, DANCE_COMPETITIONS, COMPETITIONS_A_YEAR, IDOL_GROUPS, STUDIO_READY } from '../data/dance.js';
import { BRANDS, CHILD_TRUST_SHARE } from '../data/fame.js';
import { ent, workOf, guardianConsents, pool } from './entertainment.js';
import { gain, regard } from './fame.js';
import { canFit } from './worklife.js';
import { celebrities } from './celebs.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const year = () => store.state.year;
const K = (base, p = player()) => Math.round(localWage(base, COUNTRIES[p.countryId] ?? country()));
const full = (n) => `${n.firstName} ${n.lastName}`;

export function danceOf(p = player()) {
  const f = workOf(p);
  f.dance ??= { gigs: [], offers: { age: null, list: [], went: 0 }, comps: [], best: {}, entered: { age: null, n: 0 } };
  return f.dance;
}
export const STYLES = DANCE_STYLES;

/** Dance training: 'bfa' or 'ba' in dance, or 'theater' for a degree in musical theater; else null. */
export function danceTraining(p = player()) {
  const ids = p.education.degrees.map((d) => d.majorId);
  if (ids.includes('dance_bfa')) return 'bfa';
  if (ids.includes('dance')) return 'ba';
  if (ids.some((m) => ['musical_theater', 'musical_theater_bfa'].includes(m))) return 'theater';
  return null;
}
/** The jobs on a dancer's record (gigs; competitions are not jobs). */
export const record = (p = player()) => danceOf(p).gigs.length;
/** Whether the dance page is for this person: a child or adult who dances, or anyone with a dance record. */
/** Choreography on the record: choreography gigs, and musicals choreographed (engine/entertainment.js). */
export function choreoRecord(p = player()) {
  const gigs = danceOf(p).gigs.filter((x) => ['choreo', 'idol_choreo'].includes(x.kind)).length;
  const shows = workOf(p).credits.filter((c) => ent().productions[c.productionId]?.cast[c.idx]?.kind === 'choreographer').length;
  return gigs + shows;
}
/** Qualified to teach and to run a studio (data/business.js 'dance_studio'): STUDIO_READY. */
export function studioReady(p = player()) {
  if (p.talents.dance < STUDIO_READY.skill) return false;
  return !!danceTraining(p) && danceTraining(p) !== 'theater' || (p.career?.experience?.dance ?? 0) >= STUDIO_READY.years || record(p) >= STUDIO_READY.jobs;
}
export const dances = (p = player()) => p.age >= 6 && (p.talents.dance >= 25 || record(p) > 0 || danceOf(p).comps.length > 0);

/** Why a dancer cannot go for this kind of gig, or ''. */
export function whyNot(kind, p = player()) {
  const g = DANCE_GIGS[kind];
  if (p.age < g.minAge) return `From ${g.minAge}.`;
  if (g.agent && !workOf(p).agent) return 'Cast through agents: you need one.';
  if (g.after && record(p) < g.after) return `They look for dancers with ${g.after} jobs behind them.`;
  if (p.age < 18 && !guardianConsents(p)) return 'A parent has to agree to you working, and yours has not.';
  if (g.hours) {
    const fit = canFit(Math.round(g.hours * g.weeks / 48), { kind: 'freelance', performer: true });
    if (!fit.ok) return fit.text;
  }
  return '';
}

/** Who a gig is for: one of the country's music acts or celebrities, a brand, a team, a park, a line, a showroom. */
function clientFor(kind, p) {
  const g = DANCE_GIGS[kind];
  if (g.show) return DANCE_SHOW.name;
  if (g.star) {
    const acts = Object.values(ent().acts ?? {}).filter((a) => a.npc && a.countryId === p.countryId && a.name);
    if (acts.length) return rng.pick(acts).name;
    const stars = celebrities(p.countryId);
    if (stars.length) return full(rng.pick(stars));
    // Early in a world, before its acts are known: one of the country's working singers.
    const singers = pool(p.countryId).filter((n) => (n.flags.star?.skill?.singing ?? 0) >= 60);
    return singers.length ? full(rng.pick(singers)) : 'a pop star';
  }
  if (g.kpop) {
    const groups = Object.values(store.state.kpop?.groups ?? {}).filter((x) => x.status !== 'disbanded' && x.name);
    return groups.length ? rng.pick(groups).name : rng.pick(IDOL_GROUPS);
  }
  if (g.brand) return rng.pick(BRANDS);
  return rng.pick(DANCE_CLIENTS[kind] ?? ['a production company']);
}

/** This year's gigs: what is on offer to a dancer of this standard. Made when first looked at each year. */
export function offers(p = player()) {
  const d = danceOf(p);
  if (d.offers.age === p.age) return d.offers.list;
  const skill = p.talents.dance;
  const kinds = Object.entries(DANCE_GIGS).filter(([, g]) => p.age >= g.minAge && g.bar <= skill + DANCE_YEAR.reach && (!g.only || g.only.includes(p.countryId)));
  const list = kinds.length ? Array.from({ length: DANCE_YEAR.offers }, () => {
    const [kind, g] = rng.pick(kinds);
    const wants = rng.pick(DANCE_WANTS[kind]);
    return { id: `dg_${(ent().seq += 1).toString(36)}`, kind, client: clientFor(kind, p), city: COUNTRIES[p.countryId].cities[0], fee: K(g.fee, p), wants, brief: rng.pick(DANCE_BRIEFS[wants]), status: 'open' };
  }) : [];
  d.offers = { age: p.age, list, went: 0 };
  return list;
}

/** The chance of being booked: skill against the bar, training, a record, an agent, and reading the brief right. */
export function odds(o, style, p = player()) {
  const g = DANCE_GIGS[o.kind];
  const Y = DANCE_YEAR;
  const trained = (Y.training[danceTraining(p)] ?? 0) / 25;
  const rec = Math.min(Y.record.most, record(p) * Y.record.per);
  const read = style ? (style === o.wants ? Y.style.right : Y.style.wrong) : 0;
  return clamp(0.35 + (p.talents.dance - g.bar) / 25 + trained + rec + (workOf(p).agent ? Y.agent : 0) + read, 0.03, 0.9);
}

/** Goes for a gig and dances it one way. A few a year, around everything else. */
export function audition(id, style = null) {
  const p = player();
  const d = danceOf(p);
  const o = offers(p).find((x) => x.id === id);
  if (!o || o.status !== 'open') return result(false, 'That job has gone.', 'neutral');
  if (d.offers.went >= DANCE_YEAR.auditions) return result(false, 'You have been to all the auditions you can this year.', 'neutral');
  const why = whyNot(o.kind, p);
  if (why) return result(false, why, 'neutral');
  d.offers.went += 1;
  const g = DANCE_GIGS[o.kind];
  if (!rng.chance(odds(o, style, p))) {
    o.status = 'lost';
    const miss = style && style !== o.wants ? ` Afterward, someone says they wanted something more ${DANCE_STYLES[o.wants].label.toLowerCase()}.` : '';
    return result(false, `${rng.pick(['They kept you till the last cut, then let you go.', 'Three hundred dancers, eight counts each. Not you, this time.', '"Thank you. We will be in touch." They are not.'])}${miss}`);
  }
  o.status = 'booked';
  const trust = p.age < 18 ? Math.round(o.fee * CHILD_TRUST_SHARE) : 0;
  if (trust) workOf(p).trust = (workOf(p).trust ?? 0) + trust;
  const gig = { id: o.id, year: year(), kind: o.kind, client: o.client, fee: o.fee, weeks: g.weeks, hours: g.hours, prestige: g.prestige, style, trust, paid: false };
  d.gigs.push(gig);
  if (g.weeks >= 10) p.talents.dance = clamp(p.talents.dance + 1); // a season of it, every day, makes a better dancer
  let text = `Booked: ${g.name.toLowerCase()}${g.show ? '' : `, for ${o.client}`}. ${fmtMoney(o.fee, COUNTRIES[p.countryId])}${trust ? ', part of it held in trust until you are 18' : ''}.`;
  if (g.show) text += ` ${season(gig, p)}`;
  if (g.audience && !g.show) gain({ audience: g.audience, amount: g.prestige / 10, lasting: 0.1, why: `${g.name.toLowerCase()} for ${o.client}` }, p);
  regard({ credibility: g.prestige / 25, why: g.name.toLowerCase() }, p);
  if (d.gigs.length === 1) milestone(`First paid dance job: ${g.name.toLowerCase()}.`, 'career');
  if (o.kind === 'tour') milestone(`Danced on tour for ${o.client}.`, 'career');
  log(text, 'system', 'good');
  return result(true, text);
}

/** A season of the televised dance competition: partnered with a celebrity, voted on week by week. */
function season(gig, p) {
  const stars = celebrities(p.countryId).filter((n) => n.id !== p.id);
  const partner = stars.length ? rng.pick(stars) : null;
  const name = partner ? full(partner) : 'a soap star who has never danced';
  const theirs = rng.int(15, 60); // how well the celebrity learns to dance
  const fans = (partner?.flags.star?.fame ?? 30) / 2;
  const ours = p.talents.dance * 0.45 + theirs * 0.35 + fans * 0.2 + rng.around(0, 10);
  const rivals = Array.from({ length: DANCE_SHOW.couples - 1 }, () => rng.around(DANCE_SHOW.rivals, 10));
  const place = 1 + rivals.filter((x) => x > ours).length;
  const weeks = Math.max(1, DANCE_SHOW.weeks - Math.max(0, place - 2));
  gig.partner = name; gig.place = place;
  gain({ audience: DANCE_SHOW.audience, amount: place === 1 ? 18 : Math.max(3, 12 - place), lasting: place === 1 ? 0.3 : 0.1, why: `${DANCE_SHOW.name}, with ${name}` }, p);
  if (place === 1) { milestone(`Won ${DANCE_SHOW.name}, partnering ${name}.`, 'fame'); return `You are partnered with ${name}. Eleven weeks later, you lift the trophy together.`; }
  if (place <= 3) return `You are partnered with ${name}, and the two of you make the final: ${place === 2 ? 'runners-up' : 'third'}.`;
  return `You are partnered with ${name}. You last ${weeks} week${weeks === 1 ? '' : 's'} before the public votes you off.`;
}

/** The dance competitions open to a dancer now: a child's or a grown dancer's category, and the levels reached. */
export function competitions(p = player()) {
  const d = danceOf(p);
  return Object.entries(DANCE_COMPETITIONS).map(([level, c]) => {
    const why = p.age < 6 ? 'From 6.' : c.after && !(d.best[c.after] <= 3) ? `A place in the top three at the ${DANCE_COMPETITIONS[c.after].name.toLowerCase()} first.` : '';
    return { level, ...c, category: p.age < 18 ? 'kid' : 'adult', why, entered: d.comps.some((x) => x.year === year() && x.level === level) };
  });
}

/** Enters a competition with a routine in one style. Twice a year at most. */
export function compete(level, style) {
  const p = player();
  const d = danceOf(p);
  const c = competitions(p).find((x) => x.level === level);
  if (!c) return result(false, 'There is no such competition.', 'neutral');
  if (c.why) return result(false, c.why, 'neutral');
  if (c.entered) return result(false, 'You have already danced there this year.', 'neutral');
  if (d.entered.age !== p.age) d.entered = { age: p.age, n: 0 };
  if (d.entered.n >= COMPETITIONS_A_YEAR) return result(false, `${COMPETITIONS_A_YEAR} competitions a year is all there is time for.`, 'neutral');
  const kid = c.category === 'kid';
  const fee = kid ? 0 : K(c.fee, p); // a child's parents pay
  if (p.finance.cash < fee) return result(false, `The entry fee is ${fmtMoney(fee, country())}.`, 'neutral');
  p.finance.cash -= fee;
  d.entered.n += 1;
  // The judges this year favor a style; a routine in it scores better. A dancer's training and experience show.
  const taste = rng.pick(Object.keys(DANCE_STYLES));
  const mine = p.talents.dance + (DANCE_YEAR.training[danceTraining(p)] ?? 0) / 2 + (style === taste ? 4 : 0) + Math.min(4, d.comps.length * 0.5) + rng.around(0, 6);
  const bar = c.bar[c.category];
  const place = 1 + Array.from({ length: c.field - 1 }, () => rng.around(bar, 10)).filter((x) => x > mine).length;
  d.comps.push({ year: year(), level, place, style, category: c.category, of: c.field });
  d.best[level] = Math.min(d.best[level] ?? 99, place);
  const prize = place === 1 ? K(c.prize[c.category], p) : place === 2 ? Math.round(K(c.prize[c.category], p) * 0.4) : place === 3 ? Math.round(K(c.prize[c.category], p) * 0.2) : 0;
  if (prize) { p.finance.cash += prize; if (!kid) p.finance.lifetimeEarned = (p.finance.lifetimeEarned ?? 0) + prize; }
  if (place === 1 && c.fame) gain({ audience: 'public', amount: c.fame, lasting: 0.1, why: `winning the ${c.name.toLowerCase()}` }, p);
  if (place === 1) milestone(`Won the ${c.name.toLowerCase()}${kid ? ' (junior)' : ''}.`, 'achievement');
  const placed = place === 1 ? 'You win' : place <= 3 ? `You place ${place === 2 ? 'second' : 'third'}` : `You place ${place}${place % 10 === 1 && place !== 11 ? 'st' : place % 10 === 2 && place !== 12 ? 'nd' : place % 10 === 3 && place !== 13 ? 'rd' : 'th'} of ${c.field}`;
  const judges = style === taste ? ' The judges love the style.' : ` This year's judges wanted ${DANCE_STYLES[taste].label.toLowerCase()}.`;
  const text = `${c.name}, ${kid ? 'junior' : 'senior'} category: ${placed}.${judges}${prize ? ` ${kid ? 'A scholarship of' : 'Prize money:'} ${fmtMoney(prize, country())}.` : ''}`;
  log(text, 'system', place <= 3 ? 'good' : 'neutral');
  return result(place <= 3, text, place <= 3 ? 'good' : 'neutral');
}

/** The hours a week the year's dance work takes (engine/worklife.js weeklyLoad). */
export function danceHours(p = player(), y = year()) {
  return Math.round((p.fame?.dance?.gigs ?? []).filter((x) => x.year === y && x.hours).reduce((s, x) => s + x.hours * x.weeks / 48, 0));
}

/** The pay for the year's dance work, once (engine/worklife.js payroll). */
export function danceLines(p = player()) {
  return (p.fame?.dance?.gigs ?? []).filter((x) => !x.paid && x.fee).map((x) => ({
    source: `dance:${x.id}`, label: `${DANCE_GIGS[x.kind].name}${DANCE_GIGS[x.kind].show ? '' : `, ${x.client}`}${x.trust ? ' (part held in trust)' : ''}`, gross: x.fee - (x.trust ?? 0) }));
}
export function markDancePaid(p = player()) { for (const x of p.fame?.dance?.gigs ?? []) x.paid = true; }

/** A dancer's record, newest first. */
export const gigs = (p = player()) => [...(p.fame?.dance?.gigs ?? [])].reverse();
export const results = (p = player()) => [...(p.fame?.dance?.comps ?? [])].reverse();

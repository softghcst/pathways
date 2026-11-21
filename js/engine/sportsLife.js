// The athletic life around the games: the year in sport, what it costs and pays, injuries and their rehab, how the
// player feels about it, recruiting and scholarships, turning professional, contracts, agents and sponsors, fame,
// retiring, coaching, the stories that run across years, and the record passing from one generation to the next.
// The games themselves are played in engine/sports.js.
//
// Money: every amount paid or received here is booked once, under its own heading and a key that cannot repeat
// (state.sports.paid and the ledger's own key). A professional's wages are paid by the career system as a salary;
// prize money and sponsorship are paid here, and are never the same money.
import { store, log, milestone } from '../state.js';
import { clamp, localMoney, fmtMoney } from '../util.js';
import { COUNTRIES } from '../data/countries.js';
import { SPORTS_LIST, sportOf, INJURIES, REHAB, SPONSORS, LEVEL_NAMES, WORLD_GAMES, isGamesYear, MEDAL_FOR, BIG_LEAGUE_PAY, COUNTRY_LEAGUE_PAY } from '../data/sports.js';
import { gain, regard } from './fame.js';
import { CAREER_BY_ID } from '../data/careers.js';
import { book } from './ledger.js';
import { addCondition, cureCondition } from './health.js';
import { hire, endJob } from './career.js';
import { registerEmployer, payAt, employer } from './employers.js';
import { catalog, uniOf } from './university.js';
import { makeNpc } from './npcFactory.js';
import { emigrate } from './emigration.js';
import { gamesTeamEvent, boxingYear, coachSeason, moveCoaching } from './sportsExtras.js';
import { rng } from '../rng.js';
import { makeAgents, ensureTerms, look as lookFor, offered, clearOffer, triesLeft, askLowerCut } from './agents.js';
import * as sp from './sports.js';
import { familyPast, tickRelatives, parentsYear } from './sportsFamily.js';
import { tickSportsArcs } from './sportsArcs.js';
import { seasonAwards, yearAwards } from './sportsAwards.js';
import { recruitYear, RECRUIT_ANSWERS, divisionOf } from './recruiting.js';
import { beforeSeason, afterSeason, COLLEGE_ANSWERS } from './college.js';
import { draftYear, minorsYear, leagueClub, DRAFT_ANSWERS } from './draft.js';
import { intlYear, intlPath, INTL_ANSWERS } from './international.js';
import { asiaYear, onService, ASIA_ANSWERS } from './asiaBaseball.js';
import { tradeYear, TRADE_ANSWERS } from './trades.js';
import { seasonLine, baseballYear, hallYear, BASEBALL_ANSWERS } from './baseball.js';
import { contractHook, qualifying, market, freeAgentYear, CONTRACT_ANSWERS } from './baseballContracts.js';
import { youthYear, firstProAge, maxYears, YOUTH_ANSWERS } from './youthContracts.js';

// Looked up when used, not when this module loads: engine/sports.js may still be loading (an import cycle).
const nextId = (...a) => sp.internals.nextId(...a);
const findOrg = (...a) => sp.internals.findOrg(...a);
const coachFor = (...a) => sp.internals.coachFor(...a);
const meetCoach = (...a) => sp.internals.meetCoach(...a);
const teamFor = (...a) => sp.internals.teamFor(...a);
const joinOrg = (...a) => sp.internals.joinOrg(...a);
const leaveOrg = (...a) => sp.internals.leaveOrg(...a);
const playSeason = (...a) => sp.internals.playSeason(...a);
const playEvent = (...a) => sp.internals.playEvent(...a);
const overall = (...a) => sp.internals.overall(...a);
const rec = (...a) => sp.internals.rec(...a);
const EVENTS_A_YEAR = new Proxy({}, { get: (_, k) => sp.internals.EVENTS_A_YEAR[k], ownKeys: () => Reflect.ownKeys(sp.internals.EVENTS_A_YEAR), getOwnPropertyDescriptor: (_, k) => Object.getOwnPropertyDescriptor(sp.internals.EVENTS_A_YEAR, k) });
const fullName = (...a) => sp.internals.fullName(...a);
const seeded = (...a) => sp.internals.seeded(...a);
const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const money = (state, base) => localMoney(base, COUNTRIES[state.player.countryId]);
const fmt = (state, v) => fmtMoney(v, COUNTRIES[state.player.countryId]);

// ---------- Money, once ----------

/**
 * Moves money for sport and books it straight away under its heading. `amount` is positive for money in. The key makes
 * it impossible to pay or charge the same thing twice: a second call with the same key does nothing.
 */
export function settle(state, key, amount, cat, desc, src = 'year') {
  const S = sp.ensure(state);
  if (!amount || S.paid[key]) return false;
  S.paid[key] = { year: state.year, amount, cat, cur: COUNTRIES[state.player.countryId].currency.code, personId: state.player.id, gen: state.player.generation ?? 1 };
  state.player.finance.cash += amount;
  if (amount > 0) state.player.finance.lifetimeEarned = (state.player.finance.lifetimeEarned ?? 0) + amount;
  book({ state, cat, desc, key: `sport:${key}`, src });
  return true;
}
/** The yearly cost of a sport at a level, before help. Children's costs are their family's. */
export function yearlyCost(state, e) {
  const sport = sportOf(e.id);
  const k = { recreational: 0.4, club: 1, school: 0.1, academy: 3, college: 0, pro: 0, elite: 1.5 }[e.level] ?? 1;
  const tour = e.level === 'pro' && !e.contractId ? 4 : 0; // a touring professional pays their own coach and travel
  return money(state, sport.lesson * (k + tour) + sport.kit * 0.4);
}

// ---------- Decisions that wait for the player ----------

function decide(state, d) {
  const S = sp.ensure(state);
  const key = d.key ?? `${d.kind}/${d.sportId ?? ''}/${state.year}`;
  if (S.decisions.some((x) => x.key === key)) return null;
  const x = { id: `dec_${S.decisions.length + 1}`, key, year: state.year, status: 'open', ...d };
  S.decisions.push(x);
  return x;
}
export const openDecisions = (state = store.state) => sp.ensure(state).decisions.filter((d) => d.status === 'open');

/** Answers a decision. Each kind has its own consequences, below. */
export function answer(id, choice, state = store.state) {
  const S = sp.ensure(state);
  const d = S.decisions.find((x) => x.id === id);
  if (!d || d.status !== 'open') return result(false, 'That has already been settled.', 'neutral');
  if (!d.options.some((o) => o.id === choice)) return result(false, 'That is not one of the choices.', 'neutral');
  const fn = ANSWERS[d.kind] ?? MORE_ANSWERS().map((x) => x[d.kind]).find(Boolean);
  const r = fn(state, d, choice);
  if (r.ok !== false || r.close) { d.status = 'done'; d.choice = choice; d.answered = state.year; }
  return r;
}

const ANSWERS = {
  rehab(state, d, choice) {
    const a = sp.myAthlete(state);
    const inj = a.injuries.find((x) => x.id === d.injuryId);
    if (!inj || inj.status !== 'out') return { ...result(false, 'That injury has healed.', 'neutral'), close: true };
    inj.rehab = choice;
    const plan = REHAB[choice];
    let text = `${plan.name}.`;
    if (plan.cost) {
      const cost = money(state, plan.cost);
      if (state.player.age >= 18) {
        if (state.player.finance.cash < cost) return result(false, `Physiotherapy costs ${fmt(state, cost)}. You do not have it.`, 'neutral');
        settle(state, `rehab/${inj.id}`, -cost, 'health', 'Physiotherapy for a sports injury', 'action');
        text += ` It costs ${fmt(state, cost)}.`;
      } else text += ' Your family pays for it.';
    }
    if (choice === 'rush') text += ' It may come back worse.';
    log(text, 'system', 'neutral');
    return result(true, text, 'neutral');
  },
  academy(state, d, choice) {
    if (choice === 'no') return result(true, 'You stayed where you were.', 'neutral');
    const org = sp.orgOf(d.orgId, state);
    const e = sp.entryOf(d.sportId, state.player.id, state);
    // The invitation is for a young player at a club or school; it lapses for anyone who has moved past that, or stopped.
    if (!e || e.status !== 'active' || e.contractId || ['academy', 'college', 'pro', 'elite'].includes(e.level) || state.player.age > 18 || state.player.legal?.incarceration) {
      return { ...result(false, 'That invitation no longer fits where you are.', 'neutral'), close: true };
    }
    joinOrg(org, state);
    const text = `You joined ${org.name}.`;
    log(text, 'system', 'good');
    milestone(`Invited into the ${org.name}.`, 'career');
    return result(true, text);
  },
  scholarship(state, d, choice) {
    const p = state.player;
    if (choice === 'no') { log('You turned down the athletic scholarship.'); return result(true, 'You turned it down.', 'neutral'); }
    const offer = d.offers.find((o) => o.instId === choice);
    p.flags.sportOffers = (p.flags.sportOffers ?? []).filter((o) => o.sportId !== d.sportId).concat([{ ...offer, sportId: d.sportId, accepted: true }]);
    p.flags.athlete = { ...(p.flags.athlete ?? { seasons: 0, best: 0, awards: [] }), recruited: { age: p.age, sport: sportOf(d.sportId).name.toLowerCase(), instId: offer.instId } };
    const text = `You committed to ${offer.name}: ${Math.round(offer.fraction * 100)}% of tuition, on condition you play for the team. Your application there will carry the coach's backing.`;
    log(text, 'system', 'good');
    milestone(`Committed to play ${sportOf(d.sportId).name.toLowerCase()} at ${offer.name}.`, 'education');
    sp.moment(state, { type: 'commit', sportId: d.sportId, text: `Committed to ${offer.name} on an athletic scholarship.`, sig: 3 });
    return result(true, text);
  },
  contract(state, d, choice) {
    if (choice === 'no') { log(`You turned down ${d.orgName}.`); return result(true, 'You turned it down.', 'neutral'); }
    return signPro(state, d);
  },
  renew(state, d, choice) {
    const S = sp.ensure(state);
    const k = S.contracts[d.contractId];
    if (k && (k.status !== 'active' || state.player.career.sportContract !== k.id)) {
      if (k.status === 'active') endContract(state, k, 'left the club');
      return { ...result(false, `You have already left ${k.name}.`, 'neutral'), close: true };
    }
    if (choice === 'no' || !k) {
      const old = k ? sp.orgOf(k.orgId, state) : null;
      if (k) endContract(state, k, 'let the contract run out');
      // Baseball: the market opens at once, with every club that wants him bidding (engine/baseballContracts.js).
      const e = sp.entryOf(d.sportId, state.player.id, state);
      if (e && market(state, e, old, { qo: !!d.qo })) return result(true, 'You are a free agent, and clubs are calling.', 'neutral');
      return result(true, 'You will look for a new club.', 'neutral');
    }
    if (choice === 'qo' && d.qo) {
      k.to = state.year + 1; k.salary = d.qo; k.qo = true;
      state.player.career.salary = d.qo;
      return result(true, `You accepted the qualifying offer: one more year with ${d.orgName} at ${fmt(state, d.qo)}.`);
    }
    k.to = state.year + d.years; k.salary = d.salary;
    state.player.career.salary = d.salary;
    const text = `You signed a new ${d.years}-year contract with ${d.orgName} at ${fmt(state, d.salary)} a year.`;
    log(text, 'system', 'good');
    return result(true, text);
  },
  coachOffer(state, d, choice) {
    if (choice === 'no') return result(true, 'You stay where you are.', 'neutral');
    return moveCoaching(state, d.orgId);
  },
  abroad(state, d, choice) {
    const p = state.player;
    if (choice === 'no') { log(`You turned down ${d.orgName}. You stay where you are.`); return result(true, 'You stay.', 'neutral'); }
    const e = sp.entryOf(d.sportId, p.id, state);
    const S = sp.ensure(state);
    const old = S.contracts[d.contractId];
    if (!e || e.status !== 'active' || (old && old.status !== 'active')) return { ...result(false, 'That has passed.', 'neutral'), close: true };
    // The club sponsors a work visa: the move goes through the immigration system like anyone's, already approved.
    const move = emigrate(d.countryId, { grant: { id: `sportmove/${d.orgId}/${state.year}`, routeId: 'work', routeName: `a work visa sponsored by ${d.orgName}`, status_on_arrival: 'worker', years: d.years, remaining: 0 }, city: d.city, family: false });
    if (!move.ok) return { ...result(false, `The move fell through: ${move.text}`, 'bad'), close: true };
    if (old?.status === 'active') endContract(state, old, `transferred abroad to ${d.orgName}`);
    const res = signPro(state, d, { transfer: true });
    if (res.ok) {
      const there = COUNTRIES[d.countryId];
      milestone(`Moved abroad to play for ${d.orgName} in ${there.name}.`, 'career');
      sp.moment(state, { type: 'abroad', sportId: d.sportId, text: `Transferred abroad to ${d.orgName}.`, sig: 3, orgId: d.orgId });
      (e.abroad ??= []).push({ year: state.year, countryId: d.countryId, orgId: d.orgId, fee: d.fee });
    }
    return res.ok ? result(true, `You move to ${d.city} and sign for ${d.orgName}. ${move.text ?? ''}`.trim()) : res;
  },
  transfer(state, d, choice) {
    if (choice === 'no') { log(`You stayed, and ${d.orgName} looked elsewhere.`); return result(true, 'You stayed.', 'neutral'); }
    const S = sp.ensure(state);
    const old = S.contracts[d.contractId];
    if (old?.status === 'active') endContract(state, old, `transferred to ${d.orgName}`);
    return signPro(state, d, { transfer: true });
  },
  turnPro(state, d, choice) {
    if (choice === 'no') return result(true, 'You stayed amateur for now.', 'neutral');
    const e = sp.entryOf(d.sportId, state.player.id, state);
    e.level = 'pro';
    e.proYear ??= state.year;
    const org = findOrg(state, sportOf(d.sportId), 'pro', { key: `tour/${d.sportId}/${state.player.countryId}`, name: `${COUNTRIES[state.player.countryId].name} ${sportOf(d.sportId).name} Tour` });
    e.tourId = org.id;
    const text = `You turned professional. From now on you play for prize money, and pay your own way.`;
    log(text, 'system', 'good');
    milestone(`Turned professional in ${sportOf(d.sportId).name.toLowerCase()}.`, 'career');
    sp.moment(state, { type: 'pro', sportId: d.sportId, text: 'Turned professional.', sig: 3 });
    if (state.player.age >= 25) arc(state, 'late_bloomer', d.sportId, 'Late bloomer', `Turned professional at ${state.player.age}, when most have given up.`);
    return result(true, text);
  },
  agent(state, d, choice) {
    if (choice === 'no') return result(true, 'You handle your own deals.', 'neutral');
    const a = sp.myAthlete(state);
    if (a.agentId && state.npcs[a.agentId]?.alive) return { ...result(false, 'You already have an agent.', 'neutral'), close: true };
    // An agent who calls is one of the country's real sports agents, with their own cut and clients: the player hears
    // them out, and signs (or looks again) under Representation.
    return findSportsAgent(state);
  },
  sponsor(state, d, choice) {
    if (choice === 'no') return result(true, 'You said no to the sponsor.', 'neutral');
    const S = sp.ensure(state);
    const id = nextId(S, 'k');
    S.contracts[id] = { id, kind: 'sponsor', personId: state.player.id, sportId: d.sportId, name: d.brand, from: state.year + 1, to: state.year + d.years, amount: d.amount, status: 'active' };
    const text = `You signed with ${d.brand}: ${fmt(state, d.amount)} a year for ${d.years} years, paid each year you are with them.`;
    log(text, 'system', 'good');
    milestone(`Signed a sponsorship with ${d.brand}.`, 'career');
    sp.moment(state, { type: 'sponsor', sportId: d.sportId, text: `Signed a sponsorship with ${d.brand}.`, sig: 2 });
    return result(true, text);
  },
  mind(state, d, choice) {
    const a = sp.myAthlete(state);
    const p = state.player;
    if (choice === 'talk') {
      const cost = money(state, 600);
      if (p.age >= 18) { if (p.finance.cash < cost) return result(false, 'You cannot afford it right now.', 'neutral'); settle(state, `mind/${state.year}`, -cost, 'health', 'Sessions with a sports psychologist', 'action'); }
      a.motivation = clamp(a.motivation + 18); a.confidence = clamp(a.confidence + 8);
      a.support = (a.support ?? 0) + 1;
      const text = 'You started seeing a sports psychologist. It helps to say things out loud to someone whose job is to listen.';
      log(text, 'system', 'good');
      return result(true, text);
    }
    if (choice === 'break') {
      for (const e of sp.activeSports(p.id, state)) if (!e.contractId) e.plan = { type: 'recovery', hours: 2 };
      a.motivation = clamp(a.motivation + 12);
      const text = 'You stepped back for a while: two hours a week, and only because you want to.';
      log(text, 'system', 'neutral');
      return result(true, text, 'neutral');
    }
    return result(true, 'You kept going as you were.', 'neutral');
  },
  integrity(state, d, choice) {
    const a = sp.myAthlete(state);
    if (choice === 'refuse') { a.integrity = { ...(a.integrity ?? {}), refused: (a.integrity?.refused ?? 0) + 1 }; log('You said no, and meant it. Whatever you win, you will have won it.', 'system', 'good'); return result(true, 'You refused.', 'good'); }
    if (choice === 'report') {
      a.integrity = { ...(a.integrity ?? {}), reported: state.year };
      a.fame = clamp(a.fame + 3);
      log('You told the governing body what you had been offered. It made you unpopular in some rooms, and respected in others.', 'system', 'good');
      return result(true, 'You reported it.', 'good');
    }
    a.integrity = { ...(a.integrity ?? {}), cheating: state.year };
    log('You went along with it. Nobody talks about it, and you do not either.', 'system', 'bad');
    return result(true, 'You went along with it.', 'bad');
  },
  retire(state, d, choice) {
    if (choice === 'no') return result(true, 'You will play on.', 'neutral');
    return retire(d.sportId, state);
  },
};

// ---------- Professional contracts ----------

/** A professional club: an org, a team in the national league, and an employer in the careers system. */
function proClub(state, sport, n, tier = 1) {
  const p = state.player;
  const cities = COUNTRIES[p.countryId].cities ?? [p.city];
  const city = cities[n % cities.length];
  const div = sport.kind === 'team' ? sp.divOf(p) : null;
  const org = findOrg(state, sport, 'pro', { key: `pro/${sport.id}/${p.countryId}/${n}${div === 'women' ? '/women' : ''}`, city, tier, strength: tier === 1 ? 4 : -6, div });
  if (!org.employerId || !employer(org.employerId)) {
    const e = registerEmployer({ name: org.name, family: 'sport', tracks: ['athlete', 'coaching'], countryId: p.countryId, city });
    e.owned = false; e.sportClub = org.id; e.size = tier === 1 ? 'large' : 'medium'; e.founded = org.founded;
    org.employerId = e.id;
  }
  return org;
}
/** What a club offers: a level in the career (reserve to star) and pay in that level's band at this club. */
function offerFor(state, e, org) {
  const p = state.player;
  const sport = sportOf(e.id);
  const o = overall(e, p);
  const level = o >= 86 ? 3 : o >= 76 ? 2 : o >= 66 ? 1 : 0;
  const career = CAREER_BY_ID.athlete;
  const emp = employer(org.employerId);
  const [lo, hi] = payAt(emp, career, level);
  const pop = sport.popular.includes(p.countryId) ? 1 : 0.45;
  const agent = sp.myAthlete(state).agentId ? 1 + 0.1 * agentClout(sp.myAthlete(state)) : 1;
  // The big leagues of the draft countries pay far more than an ordinary professional league (data/sports.js).
  const big = org.level === 'pro' && !(org.tier > 1) && !org.minorLevel && (sport.draftIn ?? []).includes(org.countryId) && org.div !== 'women' ? (COUNTRY_LEAGUE_PAY[org.countryId] ? COUNTRY_LEAGUE_PAY[org.countryId][sport.id] ?? 1 : BIG_LEAGUE_PAY[sport.id] ?? 1) : 1;
  // A club abroad pays in its own money: what that is worth where the player lives.
  const abroad = org.countryId && org.countryId !== p.countryId ? money(state, 1e6) / localMoney(1e6, COUNTRIES[org.countryId]) : 1;
  const salary = Math.round((lo + (hi - lo) * clamp((o - 60) / 35, 0, 1)) * pop * agent * big * abroad);
  const r = seeded(`offer/${org.id}/${p.id}/${state.year}`);
  return { level, salary, years: maxYears(p, e.id, r.int(1, 4)) };
}
function signPro(state, d, o = {}) {
  const S = sp.ensure(state);
  const p = state.player;
  const e = sp.entryOf(d.sportId, p.id, state);
  const org = sp.orgOf(d.orgId, state);
  if (!e || e.status !== 'active' || e.banUntil > state.year || p.legal?.incarceration || !p.alive) {
    return { ...result(false, `${org?.name ?? 'The club'} only signs players who are playing.`, 'neutral'), close: true };
  }
  // One professional contract at a time: a transfer ends the old one before this; any other offer waits until it is over.
  // A contract whose job has already gone (another job taken) is over now, not at the turn of the year.
  for (const x of Object.values(S.contracts)) if (x.kind === 'pro' && x.status === 'active' && x.personId === p.id && p.career.sportContract !== x.id) endContract(state, x, 'left the club');
  const holding = Object.values(S.contracts).find((x) => x.kind === 'pro' && x.status === 'active' && x.personId === p.id);
  if (holding) return { ...result(false, `You are already under contract with ${holding.name}.`, 'neutral'), close: true };
  const id = nextId(S, 'k');
  const years = maxYears(p, d.sportId, d.years); // soccer: three years at most under 18 (FIFA)
  const k = { id, kind: 'pro', personId: p.id, sportId: d.sportId, orgId: org.id, employerId: org.employerId, name: org.name, from: state.year, to: state.year + years,
    salary: d.salary, level: d.level, status: 'active', how: o.trade ? 'trade' : o.transfer ? 'transfer' : d.how ?? 'signing', history: [] };
  S.contracts[id] = k;
  // The wages are a salary in the careers system: paid there, taxed there, and nowhere else.
  hire(CAREER_BY_ID.athlete, d.level, 60, o.trade ? `You were traded to ${org.name}.` : o.transfer ? `${org.name} signed you.` : d.how === 'draft' ? `${org.name} drafted you.` : `You signed for ${org.name}.`,
    { employerId: org.employerId, salary: d.salary, hours: 40 });
  p.career.sportContract = id;
  e.contractId = id;
  e.level = 'pro';
  e.proYear ??= state.year;
  joinOrg(org, state);
  sp.moment(state, { type: o.transfer ? 'transfer' : 'signing', sportId: d.sportId, text: `${o.trade ? 'Traded to' : o.transfer ? 'Transferred to' : d.how === 'draft' ? `Drafted by` : 'Signed for'} ${org.name}.`, sig: 3, orgId: org.id });
  milestone(`${o.trade ? 'Traded to' : o.transfer ? 'Transferred to' : d.how === 'draft' ? 'Drafted by' : 'Signed professionally with'} ${org.name}.`, 'career');
  if (p.age >= 25 && !o.transfer) arc(state, 'late_bloomer', d.sportId, 'Late bloomer', `A first professional contract at ${p.age}.`);
  if (!sp.myAthlete(state).agentId) decide(state, { kind: 'agent', sportId: d.sportId, text: 'An agent has been in touch: they would handle your contracts and sponsors for a share of what you earn.', options: [{ id: 'yes', label: 'Hear them out' }, { id: 'no', label: 'Handle it yourself' }] });
  return result(true, `You signed for ${org.name}.`);
}
function endContract(state, k, why) {
  const p = state.player;
  k.status = 'ended'; k.ended = state.year; k.why = why;
  const e = sp.entryOf(k.sportId, p.id, state);
  if (e?.contractId === k.id) { e.contractId = null; leaveOrg(e, state, why); e.level = 'club'; }
  if (p.career.sportContract === k.id) { endJob(why); p.career.sportContract = null; }
}
// ---------- Hired as a professional ----------
//
// Most professionals come up through the game: a club, a draft or the tour (proRoutes). Someone can also be taken on
// as a professional athlete from the jobs board, or have played professionally in a life saved before there was one
// sports system. They go into the same system here: a sport, a club and a contract, or the tour.

/** A professional athlete whose sport is not settled yet: hired as one, with no club contract and not on a tour. */
export function needsSport(state = store.state) {
  const p = state.player;
  if (p.career?.careerId !== 'athlete' || p.career.sportContract) return false;
  return !sp.activeSports(p.id, state).some((e) => e.level === 'pro');
}
/** Sports a professional could play here this year. */
export const proSports = (state = store.state) => SPORTS_LIST.filter((x) => x.kind !== 'fitness' && sp.proYears(x, sp.divOf(state.player), state.year).open && sp.proPath(x, state.player.countryId) !== 'none' && sp.canPlay(x.id, state.player, state).ok);

/**
 * Plays a sport professionally, for someone hired as a professional athlete. A team sport signs them with a club
 * (the club is their employer and pays the wage, as for anyone who signs); an individual sport puts them on the tour,
 * where prize money and sponsors are the pay, so the salaried job ends.
 */
export function goPro(sportId, state = store.state) {
  const p = state.player;
  const sport = sportOf(sportId);
  if (!needsSport(state)) return result(false, 'You are not a professional athlete looking for a sport.', 'neutral');
  if (!sport || !proSports(state).includes(sport)) return result(false, `There is no professional ${sport?.name.toLowerCase() ?? 'game'} here yet.`, 'neutral');
  let e = sp.entryOf(sportId, p.id, state);
  if (!e || e.status !== 'active') { const r = sp.takeUp(sportId, state); if (!r.ok) return r; e = sp.entryOf(sportId, p.id, state); }
  // They were hired as a professional: their game is a professional's, from their talent and how senior the job is.
  const target = 64 + (p.career.level ?? 0) * 6 + ((p.talents?.sports ?? 70) - 75) / 3;
  for (const k of Object.keys(e.skills)) e.skills[k] = Math.round(Math.max(e.skills[k], Math.min(e.ceiling[k] - 2, target)));
  e.pr = Math.max(e.pr, 1350);
  e.plan = { type: 'balanced', hours: 15 };
  if (sport.kind === 'team') {
    const org = proClub(state, sport, seeded(`hired/${p.id}/${sportId}`).int(0, 7), 1);
    const o = offerFor(state, e, org);
    return signPro(state, { sportId, orgId: org.id, level: p.career.level ?? o.level, salary: p.career.salary ?? o.salary, years: 3, how: 'trial' });
  }
  endJob('turned professional on the tour');
  return ANSWERS.turnPro(state, { sportId }, 'yes');
}

/**
 * A life saved when professional sport was a separate system (state.proSport, p.sport): its record becomes the
 * player's record here, once, when the save is loaded. Seasons, titles, medals and caps are kept; a player still
 * playing is signed again in the same sport at the next Age Up. Runs on the given state only, never the global one.
 */
export function adoptOldSport(state = store.state) {
  const p = state.player;
  const old = p?.sport;
  if (!old?.sport || !Array.isArray(old.seasons)) { delete state.proSport; return; }
  const id = { football: 'soccer', athletics: 'track' }[old.sport] ?? old.sport;
  if (!sportOf(id)) { delete p.sport; delete state.proSport; return; }
  const playing = !old.retiredYear && p.career?.careerId === 'athlete';
  // Still playing: the record waits at club level until the next Age Up signs them in the same sport (tickSports).
  const e = sp.pastEntry(id, { level: playing ? 'club' : 'pro', since: old.since ?? state.year }, state);
  e.legacySeasons = (e.legacySeasons ?? 0) + old.seasons.length;
  e.titles.push(...(old.titles ?? []).map((t) => ({ year: t.year, name: t.name })));
  e.medals = [...(e.medals ?? []), ...(old.medals ?? []).map((m) => ({ year: m.year, medal: m.medal, games: m.games }))];
  e.caps = (e.caps ?? 0) + (old.caps ?? 0);
  if (playing) { e.status = 'active'; e.plan = { type: 'balanced', hours: 15 }; }
  else { e.status = 'retired'; e.retiredYear = old.retiredYear ?? state.year; e.plan = { type: 'balanced', hours: 0 }; }
  delete p.sport; delete p.coach; delete state.proSport;
}

export const contractsOf = (state = store.state, personId = state.player.id) => Object.values(sp.ensure(state).contracts).filter((k) => k.personId === personId);

// ---------- Injuries ----------

const injuryCondition = (type) => `sport_${type}`;
function rollInjury(state, a, e) {
  const p = state.player;
  const sport = sportOf(e.id);
  const r = seeded(`injury/${a.id}/${e.id}/${state.year}`);
  if (a.injuries.some((x) => x.status === 'out')) return null;
  const risk = 0.03 + sport.contact * 0.025 + Math.max(0, e.fatigue - 45) / 300 + (p.age >= 30 ? 0.03 : 0) + (e.plan.hours >= 18 ? 0.03 : 0) - (p.stats.health - 60) / 1500;
  // A pitcher's elbow has its own odds: more for a heavy load, and for a young arm throwing hard.
  const pitcher = sport.id === 'baseball' && e.position === 'pitcher';
  const elbow = pitcher && seeded(`elbow/${a.id}/${state.year}`).chance(0.018 + (e.plan.hours >= 18 ? 0.02 : 0) + (p.age <= 25 && (e.skills.stuff ?? 0) >= 75 ? 0.012 : 0));
  if (!elbow && !r.chance(Math.max(0.01, risk))) return null;
  const types = Object.entries(INJURIES).filter(([, x]) => (!x.contactOnly || sport.contact >= 2) && !x.pitcher);
  const [type, def] = elbow ? ['ucl', INJURIES.ucl] : r.pick(r.chance(0.7) ? types.filter(([, x]) => x.severity < 35) : types);
  const id = `inj_${a.injuries.length + 1}_${state.year}`;
  const inj = { id, type, sportId: e.id, year: state.year, age: p.age, name: def.name, severity: def.severity, left: def.seasons, rehab: null, status: 'out', setbacks: 0, from: r.next() };
  a.injuries.push(inj);
  addCondition(injuryCondition(type));
  for (const [k] of sport.skills) if (def.skillLoss && r.chance(0.4)) e.skills[k] = Math.max(0, e.skills[k] - def.skillLoss);
  sp.say(state, type === 'ucl' ? 'Your elbow went: the ligament is torn. The surgeon will rebuild it with a tendon from your forearm (Tommy John surgery), and it will be a year or more before you pitch again.' : `You picked up ${def.name} playing ${sport.name.toLowerCase()}.${def.seasons >= 1 ? ' It will be a long way back.' : ''}`, 'bad', { screen: 'hub', id: 'health' });
  sp.moment(state, { type: 'injury', sportId: e.id, text: `Injured: ${def.name}.`, sig: def.severity >= 35 ? 2 : 1, key: `injury/${id}` });
  decide(state, { kind: 'rehab', sportId: e.id, injuryId: id, key: `rehab/${id}`, text: `You have ${def.name}. How will you deal with it?`,
    options: Object.entries(REHAB).map(([k, x]) => ({ id: k, label: x.name + (x.cost ? ` (${fmt(state, money(state, x.cost))})` : '') })) });
  return inj;
}
/** A year of healing. Rehab decides how fast, and whether it comes back. Nothing heals at once. */
function healYear(state, a) {
  const p = state.player;
  for (const inj of a.injuries.filter((x) => x.status === 'out')) {
    if (inj.year === state.year) continue; // it happened this year: healing starts next
    const plan = REHAB[inj.rehab ?? 'rest'];
    // Treated elsewhere (a doctor) — the record follows the health record.
    const has = p.conditions.some((c) => c.id === injuryCondition(inj.type));
    const r = seeded(`heal/${inj.id}/${state.year}`);
    if (has && r.chance(plan.setback)) {
      inj.setbacks += 1; inj.left = Math.max(inj.left, 0.4);
      log(`Your ${inj.name.replace(/^an? /, '')} flared up again. It is going to take longer.`, 'system', 'bad');
      continue;
    }
    inj.left = Math.round((inj.left - plan.speed) * 100) / 100;
    if (inj.left <= 0 || !has) {
      inj.status = 'healed'; inj.healed = state.year;
      cureCondition(injuryCondition(inj.type));
      log(`You are over ${inj.name}, and back in training.`, 'system', 'good');
      sp.moment(state, { type: 'recovered', sportId: inj.sportId, text: `Recovered from ${inj.name}.`, sig: 1, key: `recovered/${inj.id}` });
      if (inj.severity >= 35) (a.comebacks ??= []).push({ injuryId: inj.id, year: state.year, sportId: inj.sportId });
      if (inj.rehab === 'rush' && inj.severity >= 35) p.stats.health = clamp(p.stats.health - 4); // it was never quite right again
    }
  }
}
/** How much of a season an injury keeps the player out: fixtures from..to. */
function outWindow(inj, games) {
  if (!inj || inj.status !== 'out') return null;
  const from = inj.year === store.state.year ? Math.floor(inj.from * games) : 0;
  return { from, to: Math.min(games + 4, from + Math.ceil(inj.left * games * 1.6)) };
}

// ---------- Recruiting, scholarships and the way into paid sport ----------

/** University coaches, where universities recruit. Offers name real universities of the country and what they pay. */
/** At university: the program the player plays for, kept, with the scholarship tied to it. */
function collegeTeam(state, a, e) {
  const p = state.player;
  const juco = p.education.enrolled && p.education.stage === 'community';
  if (!p.education.enrolled || (p.education.stage !== 'university' && !juco) || (!juco && !p.education.schoolId)) return null;
  const sport = sportOf(e.id);
  if (!sp.hasCollegeSport(sport, p.countryId)) return null;
  // Junior college: the community college the player signed with, or the one in their own city.
  if (juco) {
    const signed = (p.flags.sportOffers ?? []).find((o) => o.accepted && o.sportId === e.id && o.instId?.startsWith('juco:'));
    const id = signed?.instId ?? `juco:${p.city}`;
    if (!signed && overall(e, p) < 55) return null;
    const org = findOrg(state, sport, 'college', { key: `college/${e.id}/${id}`, name: `${signed?.name ?? `${p.city} Community College`} ${sport.name}` });
    sp.setCollegeDivision(org, 'JUCO');
    if (e.orgId !== org.id && !e.contractId) { joinOrg(org, state); log(`You joined the ${org.name} program${signed ? ' on your scholarship' : ' as a walk-on'}.`, 'system', 'good'); }
    return org;
  }
  const offer = (p.flags.sportOffers ?? []).find((o) => o.accepted && o.sportId === e.id && o.instId === p.education.schoolId);
  const walkOn = !offer && overall(e, p) >= 60;
  if (!offer && !walkOn) return null;
  if (e.leftCollege === p.education.schoolId) return null; // left this university's team: not put back on it
  const org = findOrg(state, sport, 'college', { key: `college/${e.id}/${p.education.schoolId}`, name: `${p.education.schoolName} ${sport.name}`, uniId: p.education.schoolId });
  sp.setCollegeDivision(org, (uniOf(p.education.schoolId) && divisionOf(state, uniOf(p.education.schoolId))) ?? 'D1');
  if (e.orgId !== org.id && !e.contractId) {
    joinOrg(org, state);
    log(`You joined the ${org.name} program${offer ? ' on your scholarship' : ' as a walk-on'}.`, 'system', 'good');
  }
  return org;
}
/** Leaving the team in college costs the athletic part of a scholarship, from the next year's fees. */
export function quitCollegeTeam(sportId, state = store.state) {
  const p = state.player;
  const e = sp.entryOf(sportId, p.id, state);
  const org = sp.orgOf(e?.orgId, state);
  if (!org || org.kind !== 'college') return result(false, 'You are not on a university team.', 'neutral');
  const had = (p.education.aidParts ?? []).some((x) => x.kind === 'athletic');
  leaveOrg(e, state, 'left the program'); // the athletic part of the scholarship goes here (sports.dropAthleticAid)
  joinOrg(rec(state, sportOf(sportId)), state, { quiet: true });
  let text = `You left the ${org.name} team.`;
  if (had) text += ' The athletic scholarship goes with it: from next year you pay that part of the tuition.';
  log(text, 'system', 'neutral');
  return result(true, text, 'neutral');
}

/** Turning professional, by the route the sport and country use. */
function proRoutes(state, a, e) {
  const p = state.player;
  const sport = sportOf(e.id);
  if (e.contractId || e.level === 'pro' || p.age < firstProAge(p, e.id) || !sp.proYears(sport, sp.divisionOf(state), state.year).open || e.banUntil > state.year) return;
  if (Object.values(sp.ensure(state).contracts).some((k) => k.kind === 'pro' && k.status === 'active' && k.personId === p.id)) return; // under contract in another sport
  const route = sp.proPath(sport, p.countryId);
  const o = overall(e, p);
  if (route === 'none') {
    if (o >= 74 && e.level !== 'elite') {
      e.level = 'elite';
      log(`You were picked for the national ${sport.name.toLowerCase()} squad. There is no professional league; the best compete for their country.`, 'system', 'good');
      milestone(`Selected for the national ${sport.name.toLowerCase()} squad.`, 'career');
      sp.moment(state, { type: 'national', sportId: e.id, text: 'Selected for the national squad.', sig: 3 });
    }
    return;
  }
  if (route === 'tour') {
    if (e.pr >= 1300 && p.age <= 34) decide(state, { kind: 'turnPro', sportId: e.id, key: `turnPro/${p.id}/${e.id}/${state.year}`, text: `Your Pathways Rating is ${e.pr}. That is enough to enter professional events. Turning professional means playing for prize money and paying your own coach and travel.`,
      options: [{ id: 'yes', label: 'Turn professional' }, { id: 'no', label: 'Stay amateur for now' }] });
    return;
  }
  // Where the sport has a draft, the draft decides (engine/draft.js): no club simply signs an amateur there. Where big
  // league clubs sign international amateurs, they do (engine/international.js) until 23; a Cuban player can play at home.
  // A professional out of contract there is a free agent: any club in the league may sign him.
  if (freeAgentYear(state, a, e)) return; // baseball: the market, independent ball, Japan and Korea (engine/baseballContracts.js)
  if (route === 'draft') {
    if (!e.proYear || o < 64 || p.age > 36) return;
    const r = seeded(`freeAgent/${p.id}/${e.id}/${state.year}`);
    if (!r.chance(0.4 + (o - 64) / 25)) return;
    const org = leagueClub(state, sport, r);
    if (!org) return;
    const off = offerFor(state, e, org);
    decide(state, { kind: 'contract', how: 'signing', sportId: e.id, orgId: org.id, orgName: org.name, ...off, key: `freeAgent/${e.id}/${state.year}`,
      text: `You are a free agent, and ${org.name} want you: ${off.years} ${off.years === 1 ? 'year' : 'years'} at ${fmt(state, off.salary)} a year.`,
      options: [{ id: 'yes', label: 'Sign' }, { id: 'no', label: 'Turn it down' }] });
    return;
  }
  if (intlPath(state, e.id) && p.countryId !== 'cu' && p.age <= 22) return;
  // Clubs sign the player: from an academy, a club or the national squad.
  const need = 64;
  const fromRight = ['academy', 'college', 'club', 'elite'].includes(e.level);
  if (o < need || !fromRight || p.age > 29) return;
  const r = seeded(`signing/${p.id}/${e.id}/${state.year}`);
  if (!r.chance(0.45 + (o - need) / 30)) return;
  const org = proClub(state, sport, r.int(0, 7), o >= 74 ? 1 : 2);
  const off = offerFor(state, e, org);
  decide(state, { kind: 'contract', how: 'signing', sportId: e.id, orgId: org.id, orgName: org.name, ...off, key: `signing/${e.id}/${state.year}`,
    text: `${org.name} want to sign you: ${off.years} ${off.years === 1 ? 'year' : 'years'} at ${fmt(state, off.salary)} a year.`,
    options: [{ id: 'yes', label: 'Sign' }, { id: 'no', label: 'Turn it down' }] });
}

/** A year under contract: the role in the side decides the career level; contracts run out, and others come calling. */
function contractYear(state, a, e) {
  const S = sp.ensure(state);
  const p = state.player;
  const k = S.contracts[e.contractId];
  if (!k || k.status !== 'active') return;
  // The job was left some other way (quit from the work screen, fired by a scene): the contract went with it.
  if (p.career.sportContract !== k.id) { endContract(state, k, 'left the club'); return; }
  const o = overall(e, p);
  const level = o >= 86 ? 3 : o >= 76 ? 2 : o >= 66 ? 1 : 0;
  if (p.career.sportContract === k.id && p.career.level !== level) {
    const career = CAREER_BY_ID.athlete;
    const was = p.career.level;
    p.career.level = level; p.career.title = career.levels[level].title; k.level = level;
    log(`At ${k.name} you are ${/^[AEIOU]/i.test(career.levels[level].title) ? 'an' : 'a'} ${career.levels[level].title.toLowerCase()} now.`, 'system', level > was ? 'good' : 'neutral');
  }
  // Agents are paid their share of the year's playing income.
  if (a.agentId) {
    const fee = Math.round(k.salary * agentCut(a));
    settle(state, `agent/${k.id}/${state.year}`, -fee, 'sport', 'Your agent\'s share');
  }
  // Baseball's own rules first: the 40-man roster, options and waivers, Rule 5, opt-outs, extensions (engine/baseballContracts.js).
  if (contractHook(state, a, e, k) || k.status !== 'active' || e.contractId !== k.id) return;
  // In the leagues with a draft, players are traded (engine/trades.js): the contract goes to another club as it stands.
  const mine = sp.orgOf(k.orgId, state);
  if ((sportOf(e.id).draftIn ?? []).includes(mine?.countryId) && !mine.minorLevel && tradeYear(state, a, e, k)) return;
  if (state.year >= k.to) {
    const org = sp.orgOf(k.orgId, state);
    if (o >= 60 && p.age <= 35) {
      const off = offerFor(state, e, org);
      const qo = qualifying(state, e, k, org); // baseball: the qualifying offer (engine/baseballContracts.js)
      decide(state, { kind: 'renew', sportId: e.id, contractId: k.id, orgName: org.name, ...off, qo: qo?.amount ?? null, key: `renew/${k.id}/${state.year}`, text: `Your contract with ${org.name} is up. They offer ${off.years} more ${off.years === 1 ? 'year' : 'years'} at ${fmt(state, off.salary)}.${qo?.text ?? ''}`,
        options: [{ id: 'yes', label: 'Sign again' }, ...(qo ? [qo.option] : []), { id: 'no', label: 'Leave as a free agent' }] });
    } else { endContract(state, k, 'released at the end of the contract'); log(`${org.name} did not offer you a new contract.`, 'system', 'bad'); market(state, e, org); return; }
  }
  // Another club wants the player: a transfer. The fee passes between the clubs; it is not the player's money.
  // The better the player, the more clubs ask; in the last year of a contract a bid competes with the offer to stay.
  // Not in the leagues with a draft (players move by trade there, not for fees), nor for a player at a club abroad.
  if (k.status === 'active' && abroadBid(state, e, k, o)) return;
  const club = sp.orgOf(k.orgId, state);
  if (club && (sportOf(e.id).draftIn ?? []).includes(club.countryId)) return; // traded instead (engine/trades.js), above
  if (club && club.countryId !== p.countryId) return;
  const r = seeded(`bid/${k.id}/${state.year}`);
  if (k.status === 'active' && o >= 74 && r.chance(Math.min(0.45, 0.12 + (o - 74) / 55))) {
    const sport = sportOf(e.id);
    const org = proClub(state, sport, r.int(8, 15), 1);
    if (org.id === k.orgId) return;
    const off = offerFor(state, e, org);
    off.salary = Math.round(off.salary * 1.15);
    const fee = Math.round(off.salary * r.int(2, 6));
    decide(state, { kind: 'transfer', sportId: e.id, contractId: k.id, orgId: org.id, orgName: org.name, fee, ...off, key: `transfer/${k.id}/${state.year}`,
      text: `${org.name} have agreed a fee of ${fmt(state, fee)} with ${k.name} for you, and offer ${off.years} ${off.years === 1 ? 'year' : 'years'} at ${fmt(state, off.salary)}. The fee is between the clubs.`,
      options: [{ id: 'yes', label: 'Move' }, { id: 'no', label: 'Stay' }] });
  }
}

// ---------- Transfers between countries ----------
//
// The best professionals in a club sport are wanted abroad, where the sport is big. A club in another country agrees a
// fee with the player's club and offers a contract; taking it moves the player there on a work visa the club
// sponsors (engine/emigration.js), and from then on they live and play there. Later bids can come from anywhere the
// sport is big, home included. Not in the draft leagues (players there move by trade), and not before eighteen.

/** A professional club in another country: the same kind of org as at home, in a city there. */
export function proClubIn(state, sport, countryId, n, tier = 1) {
  const p = state.player;
  const cities = COUNTRIES[countryId].cities ?? [COUNTRIES[countryId].name];
  const city = cities[n % cities.length];
  const div = sport.kind === 'team' ? sp.divOf(p) : null;
  const org = findOrg(state, sport, 'pro', { key: `pro/${sport.id}/${countryId}/${n}${div === 'women' ? '/women' : ''}`, city, tier, strength: tier === 1 ? 6 : -6, div, countryId });
  if (!org.employerId || !employer(org.employerId)) {
    const emp = registerEmployer({ name: org.name, family: 'sport', tracks: ['athlete', 'coaching'], countryId, city });
    emp.owned = false; emp.sportClub = org.id; emp.size = tier === 1 ? 'large' : 'medium'; emp.founded = org.founded;
    org.employerId = emp.id;
  }
  return org;
}
/** Where a club sport is big enough to buy players from abroad: its leading countries, but not the draft leagues. */
export const abroadMarkets = (sport, from) => (sport.popular ?? []).filter((c) => c !== from && COUNTRIES[c] && !(sport.draftIn ?? []).includes(c));
function abroadBid(state, e, k, o) {
  const p = state.player;
  const sport = sportOf(e.id);
  if (sport.kind !== 'team' || p.age < 18 || o < 78) return false;
  const club = sp.orgOf(k.orgId, state);
  if (club && (sport.draftIn ?? []).includes(club.countryId)) return false;
  const markets = abroadMarkets(sport, p.countryId);
  if (!markets.length) return false;
  const r = seeded(`abroad/${k.id}/${state.year}`);
  if (!r.chance(Math.min(0.35, 0.06 + (o - 78) / 60))) return false;
  const cc = r.pick(markets);
  const org = proClubIn(state, sport, cc, r.int(0, 7), 1);
  if (!sp.proYears(sport, sp.divOf(p), state.year).open) return false;
  const off = offerFor(state, e, org);
  off.salary = Math.round(off.salary * 1.2);
  const fee = Math.round(off.salary * r.int(2, 6));
  const there = COUNTRIES[cc];
  decide(state, { kind: 'abroad', sportId: e.id, contractId: k.id, orgId: org.id, orgName: org.name, countryId: cc, city: org.city, fee, ...off, key: `abroad/${k.id}/${state.year}`,
    text: `${org.name}, in ${there.name}, have agreed a fee of ${fmt(state, fee)} with ${k.name} for you. They offer ${off.years} ${off.years === 1 ? 'year' : 'years'} at ${fmt(state, off.salary)} and a work visa: you would move to ${org.city}. The fee is between the clubs.`,
    options: [{ id: 'yes', label: `Move to ${there.name}` }, { id: 'no', label: 'Stay' }] });
  return true;
}

// ---------- Fame, confidence and motivation ----------

function mindYear(state, a, e, sum) {
  const p = state.player;
  const coach = sp.coachOf(e.coachId, state);
  const won = sum.wins - sum.losses;
  a.confidence = Math.round(clamp(a.confidence + won * 1.2 + (sum.title ? 8 : 0) - (sum.injured ? 6 : 0) + (55 - a.confidence) * 0.15));
  const pressure = (e.plan.hours >= 18 ? 6 : e.plan.hours >= 10 ? 2 : 0) + (coach?.style === 'demanding' && a.confidence < 45 ? 5 : 0) + (e.level === 'pro' ? 2 : 0);
  const joy = (e.level === 'recreational' ? 4 : 1) + (sum.title ? 5 : 0) + (coach?.style === 'supportive' ? 3 : 0);
  a.motivation = Math.round(clamp(a.motivation + joy - pressure - Math.max(0, e.fatigue - 65) / 5 + (65 - a.motivation) * 0.1));
  // Coaches and players get on, or do not.
  const n = state.npcs[e.coachId];
  if (n) n.meters.relationship = clamp(n.meters.relationship + (coach.style === 'demanding' ? (a.confidence >= 55 ? 2 : -4) : 3) + (sum.title ? 3 : 0));
  if (a.motivation < 30 && p.age >= 12) decide(state, { kind: 'mind', sportId: e.id, key: `mind/${state.year}`, text: `${sportOf(e.id).name} has stopped feeling like yours. You dread training some days, and the games feel like tests. Nobody can tell you what that is, but you do not have to carry it alone.`,
    options: [{ id: 'talk', label: 'See a sports psychologist' }, { id: 'break', label: 'Step back for a while' }, { id: 'on', label: 'Keep going' }] });
}
/** Fame comes from being seen to win at a level people watch. It is not skill, and it fades without new results. */
function fameYear(state, a, e, sum) {
  const p = state.player;
  const watched = { recreational: 0, club: 0.3, school: 0.5, academy: 0.8, college: 2, pro: 4, elite: 3 }[e.level] ?? 0;
  const games = sum.medal === 'gold' ? 10 : sum.medal ? 5 : 0;
  const honors = (sum.awards ?? []).reduce((s, a) => s + (['best', 'rookie', 'young'].includes(a.kind) ? 6 : a.kind === 'team' ? 2 : 3), 0);
  const up = watched * (1 + (sum.title ? 1.5 : 0) + (sum.rating >= 7.5 ? 0.6 : 0)) + games + honors + (sum.caps ? 2 : 0) + (sp.myAthlete(state).integrity?.reported === state.year ? 2 : 0);
  const before = a.fame;
  a.fame = Math.round(clamp(a.fame * (watched >= 2 ? 0.97 : 0.88) + up) * 10) / 10;
  p.hidden.fame = clamp((p.hidden.fame ?? 0) + Math.max(0, Math.round((a.fame - before) / 2)));
  // The fame profile (engine/fame.js): sports fans know the name from these results, and from nothing else.
  if (watched >= 2 && up > 0) {
    gain({ audience: 'sports', amount: Math.min(18, up), reach: 0.4, lasting: 0.3, abroad: sum.abroad ?? [], why: `the ${state.year} ${sportOf(e.id).name.toLowerCase()} season` }, p);
    if (e.level === 'pro' && (sum.title || sum.medal === 'gold')) regard({ credibility: 4, why: 'results' }, p);
  }
  if (a.fame >= 25 && ['pro', 'elite', 'college'].includes(e.level) && !Object.values(sp.ensure(state).contracts).some((k) => k.kind === 'sponsor' && k.status === 'active' && k.personId === p.id)) {
    const r = seeded(`sponsor/${p.id}/${state.year}`);
    if (e.level === 'college' && !['us'].includes(p.countryId)) return; // university athletes elsewhere are not paid for their name
    // The better known, the likelier a brand calls.
    if (r.chance(Math.min(0.9, 0.2 + a.fame / 100))) {
      const brand = r.pick(SPONSORS);
      const amount = money(state, Math.round(a.fame * 900 * (a.agentId ? 1 + 0.15 * agentClout(a) : 1)));
      decide(state, { kind: 'sponsor', sportId: e.id, brand, amount, years: r.int(1, 3), key: `sponsor/${state.year}`, text: `${brand} want you in their next campaign: ${fmt(state, amount)} a year.`,
        options: [{ id: 'yes', label: 'Sign' }, { id: 'no', label: 'Say no' }] });
    }
  }
}
/** Sponsors pay each year while their deal runs. The key stops a payment ever being made twice. */
function paySponsors(state) {
  const S = sp.ensure(state);
  for (const k of Object.values(S.contracts)) {
    if (k.kind !== 'sponsor' || k.status !== 'active' || k.personId !== state.player.id) continue;
    if (state.year < k.from) continue;
    if (state.year > k.to) { k.status = 'ended'; continue; }
    settle(state, `sponsor/${k.id}/${state.year}`, k.amount, 'sponsorship', `Sponsorship: ${k.name}`);
    const a = sp.myAthlete(state);
    if (a.agentId) settle(state, `agent/${k.id}/${state.year}`, -Math.round(k.amount * agentCut(a)), 'sport', 'Your agent\'s share');
  }
}
/** Prize money for a professional event: by how far the player got. */
function prizeFor(state, ev) {
  if (ev.level !== 'pro') return 0;
  const sport = sportOf(ev.sportId);
  const purse = { tennis: 120000, pickleball: 25000, golf: 150000, badminton: 30000, table_tennis: 20000, running: 30000, wheelchair_tennis: 20000, martial_arts: 40000 }[sport.id] ?? 15000;
  const share = { Champion: 1, Final: 0.5, Semifinal: 0.25, Quarterfinal: 0.12, 'Round of 16': 0.06, 'Round of 32': 0.03, 'Round of 64': 0.015, '2nd': 0.5, '3rd': 0.3, '4th': 0.12, '5th': 0.1, '6th': 0.08, '7th': 0.07, '8th': 0.06 }[ev.place] ?? 0;
  return money(state, Math.round(purse * share * (ev.format === 'doubles' ? 0.5 : 1)));
}

// ---------- Integrity ----------

function integrityYear(state, a, e) {
  const p = state.player;
  const r = seeded(`integrity/${p.id}/${state.year}`);
  if (['academy', 'college', 'pro', 'elite'].includes(e.level) && r.chance(0.05) && !a.integrity?.cheating) {
    decide(state, { kind: 'integrity', sportId: e.id, key: `integrity/${state.year}`, text: 'Someone around the team hints that there is a way to recover faster and train harder, the kind the rules ban. They say everyone at the top does it.',
      options: [{ id: 'refuse', label: 'Say no' }, { id: 'report', label: 'Report it' }, { id: 'accept', label: 'Go along with it' }] });
  }
  // Testing. Someone who broke the rules is found out sooner or later, more often than not.
  if (a.integrity?.cheating && !a.integrity.caught && ['academy', 'college', 'pro', 'elite'].includes(e.level) && r.chance(0.35)) {
    a.integrity.caught = state.year;
    e.banUntil = state.year + 2;
    a.fame = clamp(a.fame - 20);
    p.hidden.fame = clamp((p.hidden.fame ?? 0) - 6);
    const k = sp.ensure(state).contracts[e.contractId];
    if (k) endContract(state, k, 'contract ended after a failed test');
    for (const s of Object.values(sp.ensure(state).contracts)) if (s.kind === 'sponsor' && s.status === 'active' && s.personId === p.id) { s.status = 'ended'; s.why = 'dropped after a failed test'; }
    log(`You failed a test. The ban is two years, and the sponsors have gone.`, 'system', 'bad');
    milestone(`Banned from ${sportOf(e.id).name.toLowerCase()} for two years.`, 'career');
    sp.moment(state, { type: 'ban', sportId: e.id, text: 'Banned for two years after a failed test.', sig: 3 });
  }
}

// ---------- Retiring and coaching ----------

export function retire(sportId, state = store.state) {
  const S = sp.ensure(state);
  const p = state.player;
  const a = sp.myAthlete(state);
  const e = a?.sports[sportId];
  if (!e || e.status !== 'active') return result(false, 'You do not play that.', 'neutral');
  const k = S.contracts[e.contractId];
  if (k) endContract(state, k, 'retired from play');
  leaveOrg(e, state, 'retired');
  e.status = 'retired'; e.retiredYear = state.year; e.plan.hours = 0;
  const seasons = e.seasonsPlayed + (e.legacySeasons ?? 0);
  const text = `You retired from ${sportOf(sportId).name.toLowerCase()} after ${seasons} ${seasons === 1 ? 'season' : 'seasons'}.`;
  log(text, 'system', 'neutral');
  milestone(`Retired from ${sportOf(sportId).name.toLowerCase()}.`, 'career');
  sp.moment(state, { type: 'retired', sportId, text: `Retired after ${seasons} seasons.`, sig: 3 });
  if (seasons >= 10) arc(state, 'farewell', sportId, 'Farewell', `${seasons} seasons, and a last game. ${e.titles.length ? `${e.titles.length} ${e.titles.length === 1 ? 'title' : 'titles'} to show for it.` : 'No titles, and no regrets.'}`);
  if (!sp.activeSports(p.id, state).length) a.retired = { year: state.year, age: p.age };
  return result(true, text, 'neutral');
}
/** Coaching: a job in the careers system, and a coach's record here, so players the player coaches can be followed. */
export function becomeCoach(sportId, state = store.state) {
  const S = sp.ensure(state);
  const p = state.player;
  const e = sp.entryOf(sportId, p.id, state);
  if (!e) return result(false, 'You have not played it.', 'neutral');
  if (p.age < 18) return result(false, 'Coaches are adults.', 'neutral');
  if (e.status === 'active' && e.contractId) return result(false, 'Not while you are playing professionally.', 'neutral');
  const mental = Object.entries(e.skills).filter(([k]) => ['tactics', 'positioning', 'awareness', 'reading', 'course', 'pacing', 'strategy', 'communication'].includes(k)).map(([, v]) => v);
  const knows = mental.length ? mental.reduce((s, v) => s + v, 0) / mental.length : overall(e, p);
  const level = e.level === 'pro' || e.retiredYear && Object.values(S.contracts).some((k) => k.kind === 'pro' && k.personId === p.id && k.sportId === sportId) ? 1 : 0;
  const org = findOrg(state, sportOf(sportId), 'club', { n: 0 });
  hire(CAREER_BY_ID.coaching, level, 60, `${org.name} took you on to coach.`);
  S.coaches[p.id] = { id: p.id, name: fullName(p), sportId, quality: Math.round(clamp(knows * 0.8 + 15)), style: 'tactical', specialty: 'mental', orgId: org.id, since: state.year,
    history: [{ year: state.year, orgId: org.id, text: `Started coaching at ${org.name}.` }], players: [], self: true };
  sp.myAthlete(state).coaching = { sportId, since: state.year, orgId: org.id };
  sp.moment(state, { type: 'coach', sportId, text: `Started coaching at ${org.name}.`, sig: 2, orgId: org.id });
  return result(true, `You are coaching at ${org.name}.`);
}

// ---------- Stories that run across years ----------

/** Highlights: notes on a career, written when the record shows them. The stories with scenes, A to I, are in engine/sportsArcs.js. */
export const ARCS = { first_title: 'First silverware', rivalry: 'A rivalry', underdog: 'The underdog season', late_bloomer: 'Late bloomer', farewell: 'Farewell' };
function arc(state, id, sportId, title, text) {
  const a = sp.myAthlete(state);
  if (!a || a.arcs.some((x) => x.id === id && x.sportId === sportId)) return null;
  const x = { id, sportId, year: state.year, age: state.player.age, title, text };
  a.arcs.push(x);
  sp.moment(state, { type: 'arc', sportId, text: `${title}: ${text}`, sig: 3, key: `arc/${state.player.id}/${id}/${sportId}` });
  sp.say(state, `${title}. ${text}`, 'good', { screen: 'sport', id: sportId });
  return x;
}
/** The stories, from what actually happened this year. */
function arcsYear(state, a, e, sum) {
  const sport = sportOf(e.id);
  if (sum.title && !a.arcs.some((x) => x.id === 'first_title' && x.sportId === e.id)) arc(state, 'first_title', e.id, ARCS.first_title, `The first ${sport.name.toLowerCase()} title: ${sum.titleName}.`);
  const rival = Object.entries(e.rivals ?? {}).find(([, x]) => x.met >= 3);
  if (rival) arc(state, 'rivalry', e.id, ARCS.rivalry, `${rival[0]}: met ${rival[1].met} times, and ${rival[1].won} of them were yours.`);
  if (sum.underdog) arc(state, 'underdog', e.id, ARCS.underdog, `Picked to finish ${sp.internals.ordinal(sum.underdog)}, and champions.`);
}

// ---------- The year ----------

/**
 * The athletic year. Runs once a year (state.sports.tickYear), after school and work: training, the season or the
 * events, injuries and healing, money, recruiting and contracts, fame, and the stories.
 */
export function tickSports(state = store.state) {
  const S = sp.ensure(state);
  const p = state.player;
  if (S.tickYear === state.year || !p.alive) return;
  S.tickYear = state.year;
  adoptOldSport(state);
  // Hired as a professional with no sport settled: their own sport if it has a professional game, else the country's.
  if (needsSport(state)) {
    const open = proSports(state);
    const mine = sp.activeSports(p.id, state).map((e) => sportOf(e.id)).find((x) => open.includes(x));
    const pick = mine ?? open.find((x) => x.kind === 'team' && x.popular.includes(p.countryId)) ?? open.find((x) => x.popular.includes(p.countryId)) ?? open[0];
    if (pick) { const r = goPro(pick.id, state); if (r.ok) log(`${r.text} (A professional plays one sport: it was chosen for you, as nothing else was chosen. You can change it in Sport.)`, 'system', 'neutral'); }
  }
  familyPast(state);
  const started = tickRelatives(state);
  const a = sp.myAthlete(state);
  if (!a) { tickSportsArcs(state, started); return; }
  a.name = fullName(p); a.countryId = p.countryId;
  // Decisions not taken lapse: the default is the cautious one.
  for (const d of S.decisions) if (d.status === 'open' && d.year < state.year) {
    d.status = 'lapsed';
    if (d.kind === 'rehab') { const inj = a.injuries.find((x) => x.id === d.injuryId); if (inj && !inj.rehab) inj.rehab = 'rest'; }
    if (d.kind === 'renew') { const k = S.contracts[d.contractId]; if (k?.status === 'active') endContract(state, k, 'let the contract run out'); }
  }
  // A contract whose job is gone (another job taken, fired, sent to prison) is over.
  for (const k of Object.values(S.contracts)) if (k.kind === 'pro' && k.status === 'active' && k.personId === p.id && p.career.sportContract !== k.id) endContract(state, k, 'left the club');
  healYear(state, a);
  if (p.legal?.incarceration) {
    // Prison: no competition, no sponsors. The record waits.
    for (const k of Object.values(S.contracts)) if (k.kind === 'sponsor' && k.status === 'active' && k.personId === p.id) { k.status = 'ended'; k.why = 'dropped after a prison sentence'; }
    for (const e of sp.activeSports(p.id, state)) e.plan.hours = 0;
    parentsYear(state);
    tickSportsArcs(state, started);
    return;
  }
  paySponsors(state);
  for (const e of sp.activeSports(p.id, state)) yearIn(state, a, e);
  for (const line of coachSeason(state)) sp.say(state, line, 'neutral', { screen: 'hub:career' }); // a coach's season (engine/sportsExtras.js)
  for (const e of Object.values(a.sports)) hallYear(state, e); // retired ballplayers: the Hall of Fame ballot (engine/baseball.js)
  // The old school record, kept up for the parts of the game that still read it.
  const main = a.sports[a.primary];
  if (main) {
    const f = (p.flags.athlete ??= { sport: sportOf(main.id).name.toLowerCase(), seasons: 0, best: 0, captain: false, awards: [] });
    f.best = Math.max(f.best ?? 0, overall(main, p));
  }
  parentsYear(state);
  tickSportsArcs(state, started);
}

function yearIn(state, a, e) {
  const S = sp.ensure(state);
  const p = state.player;
  const sport = sportOf(e.id);
  // Banned: no games, but an academy scholarship runs on (its wage, and its end at eighteen) like any contract would.
  if (e.banUntil > state.year) { log(`You are banned from ${sport.name.toLowerCase()} until ${e.banUntil}.`, 'system', 'bad'); e.plan.hours = Math.min(e.plan.hours, 5); sp.internals.trainYear(state, p, a, e); youthYear(state, a, e); return; }
  // Away on military service (Korea): no games; the skills wait (engine/asiaBaseball.js).
  if (onService(state, e)) { log(`Military service: no ${sport.name.toLowerCase()} this year.`, 'system', 'neutral'); e.plan.hours = Math.min(e.plan.hours, 2); sp.internals.trainYear(state, p, a, e); asiaYear(state, a, e); return; }
  // University: the program, if the player plays for one.
  if (['university', 'community'].includes(p.education.stage)) collegeTeam(state, a, e);
  sp.internals.checkSchoolTeam(state, e);
  // College: a redshirt year, grades below the line, or eligibility used up keep the player out of the games (engine/college.js).
  const sitOut = beforeSeason(state, a, e);
  if (!e.orgId) joinOrg(rec(state, sport), state, { quiet: true });
  sp.internals.regroup(state, e);
  sp.internals.trainYear(state, p, a, e);
  const inj = rollInjury(state, a, e);
  const sum = { wins: 0, losses: 0, title: false, titleName: '', rating: 0, injured: !!inj || a.injuries.some((x) => x.status === 'out' && x.sportId === e.id), underdog: 0 };
  const games = [];
  const yearStats = (e.stats[state.year] ??= { games: 0, starts: 0 });
  if (sport.kind === 'team') {
    const teams = [e.teamId, e.schoolTeamId].filter(Boolean).map((id) => sp.teamOf(id, state)).filter(Boolean);
    for (const team of teams) {
      const open = a.injuries.find((x) => x.status === 'out' && x.sportId === e.id);
      const benched = sitOut && sp.orgOf(team.orgId, state)?.kind === 'college' ? { from: 0, to: 9999 } : null;
      const season = playSeason(state, e, team, { injury: benched ?? outWindow(open, sport.season ?? 14) });
      if (!e.seasons.includes(season.id)) e.seasons.push(season.id);
      const table = sp.standings(season);
      const place = table.findIndex((x) => x.teamId === team.id) + 1;
      const mine = [...season.fixtures, ...season.playoffs].filter((f) => f.me?.played);
      sum.role = season.role; sum.games = (sum.games ?? 0) + mine.length;
      for (const f of mine) {
        games.push(f.me.rating);
        yearStats.games += 1; if (f.me.start) yearStats.starts += 1;
        for (const [k, v] of Object.entries(f.me)) if (typeof v === 'number' && k !== 'rating') yearStats[k] = (yearStats[k] ?? 0) + v;
      }
      const mineRec = table.find((x) => x.teamId === team.id);
      sum.wins += mineRec.w; sum.losses += mineRec.l;
      e.wins += mineRec.w; e.losses += mineRec.l; e.draws += mineRec.d; e.played += mineRec.p;
      const champ = season.champion === team.id;
      team.history.push({ year: state.year, seasonId: season.id, place, champion: champ });
      const org = sp.orgOf(team.orgId, state);
      org.history.push({ year: state.year, text: `${place}${['th', 'st', 'nd', 'rd'][place] ?? 'th'} in the ${season.name}${champ ? ', and champions' : ''}.` });
      if (champ) {
        sum.title = true; sum.titleName = season.name;
        e.titles.push({ year: state.year, name: season.name, seasonId: season.id });
        if (season.preview[team.id] >= 5) sum.underdog = season.preview[team.id];
        milestone(`Won the ${season.name} with ${team.name}.`, 'career');
        sp.moment(state, { type: 'title', sportId: e.id, text: `Won the ${season.name}.`, sig: 3, seasonId: season.id, orgId: org.id });
      }
      const fin = season.playoffs.find((f) => f.round === 'Final');
      const avg = mine.length ? Math.round(mine.reduce((s, f) => s + f.me.rating, 0) / mine.length * 10) / 10 : 0;
      const goals = mine.reduce((s, f) => s + (f.me.goals ?? f.me.points ?? f.me.runs ?? f.me.touchdowns ?? f.me.tries ?? f.me.kills ?? f.me.hits ?? 0), 0);
      const unit = { goals: 'goals', points: sport.id.includes('basketball') ? 'points' : sport.id === 'american_football' ? 'touchdowns' : sport.id === 'rugby' ? 'tries' : 'kills', baseball: 'hits', cricket: 'runs' }[sport.adapter] ?? '';
      sp.say(state, `${team.name}, ${state.year}: ${place}${['th', 'st', 'nd', 'rd'][place] ?? 'th'} of ${table.length} in the ${season.name}${champ ? ', then won the playoffs. Champions.' : fin && (fin.home === team.id || fin.away === team.id) ? ', and beaten in the final.' : '.'} You played ${mine.length} ${mine.length === 1 ? 'game' : 'games'}${mine.length ? `, rated ${avg} on average${goals && unit ? `, with ${goals} ${unit}` : ''}` : ''}.`, champ ? 'good' : 'neutral', { screen: 'season', id: season.id });
      // The league names its awards for the season (engine/sportsAwards.js).
      seasonLine(state, a, e, season, team, mine, sum); // baseball: the season's line, milestones, the All-Star Game, October (engine/baseball.js)
      const won = seasonAwards(state, season, e, team);
      if (won.length) sum.awards = [...(sum.awards ?? []), ...won];
      // The school's own record of clubs.
      if (org.kind === 'school') { const f = (p.flags.athlete ??= { seasons: 0, best: 0, awards: [] }); f.sport = sport.name.toLowerCase(); f.seasons = (f.seasons ?? 0) + 1; if (avg >= 7.8) f.awards.push({ age: p.age, what: 'Player of the season' }); }
    }
    // The national side, for the best professionals who played most of the season.
    if (e.level === 'pro' && games.length >= (sport.season ?? 14) * 0.6 && overall(e, p) >= 82) {
      const caps = seeded(`caps/${p.id}/${e.id}/${state.year}`).int(3, 9);
      if (!e.caps) { milestone(`First cap for ${COUNTRIES[p.countryId].name} in ${sport.name.toLowerCase()}.`, 'career'); sp.moment(state, { type: 'national', sportId: e.id, text: `First cap for ${COUNTRIES[p.countryId].name}.`, sig: 3 }); }
      e.caps = (e.caps ?? 0) + caps;
      sum.caps = caps;
      sp.say(state, `You won ${caps} caps for ${COUNTRIES[p.countryId].name} this year.`, 'good', { screen: 'sport', id: e.id });
    }
    // The World Games: the national side goes, and a capped professional may go with it (engine/sportsExtras.js).
    gamesTeamEvent(state, e, sum);
    if (games.length) {
      sum.rating = Math.round(games.reduce((s, x) => s + x, 0) / games.length * 10) / 10;
      e.lastRating = Math.round(clamp((sum.rating - 3) * 14));
      // The Pathways Rating of a team player follows how they played and how the team did, game by game.
      const target = Math.round(1000 + (sum.rating - 6) * 230 + (sp.internals.LEVEL_STRENGTH[e.level] ?? 40) * 6 - 240 + (sum.title ? 40 : 0));
      e.pr = Math.round(e.pr * 0.5 + target * 0.5);
      if (e.played - sum.wins - sum.losses <= games.length && !e.firstGame) { e.firstGame = state.year; sp.moment(state, { type: 'first', sportId: e.id, text: `First competitive season in ${sport.name.toLowerCase()}.`, sig: 1 }); }
    }
  } else {
    const n = sp.internals.EVENTS_A_YEAR[e.level] ?? 2;
    const out = a.injuries.find((x) => x.status === 'out' && x.sportId === e.id);
    // A professional boxer fights rather than entering events: ranked opponents, title shots, defenses.
    const boxing = sport.id === 'boxing' && e.level === 'pro';
    const can = sitOut || boxing ? 0 : out ? Math.max(0, Math.floor(n * (1 - Math.min(1, out.left)))) : n;
    if (boxing && !sitOut) boxingYear(state, a, e, sum);
    sum.games = can; sum.role = 'starter';
    const pair = sp.currentPartnership(e.id, state);
    for (let i = 0; i < can; i++) {
      const doubles = pair && i % 2 === 1;
      const ev = playEvent(state, e, eventLevel(e, p), i, { partnershipId: doubles ? pair.id : null, rival: true });
      if (!e.events.includes(ev.id)) e.events.push(ev.id);
      const wonMatches = ev.rounds.filter((x) => x.won).length;
      sum.wins += wonMatches; sum.losses += ev.rounds.length - wonMatches;
      yearStats.events = (yearStats.events ?? 0) + 1;
      yearStats.matches = (yearStats.matches ?? 0) + ev.rounds.length;
      yearStats.won = (yearStats.won ?? 0) + wonMatches;
      if (ev.pb) yearStats.pbs = (yearStats.pbs ?? 0) + 1;
      if (doubles) { pair.events.push(ev.id); pair.chemistry = Math.round(clamp(pair.chemistry + 2 + (sp.isTitle(ev.place) ? 4 : 0))); }
      const prize = prizeFor(state, ev);
      if (prize && settle(state, `prize/${ev.id}`, prize, 'prizeMoney', `Prize money: ${ev.name}`)) {
        ev.prize = prize;
        yearStats.prize = (yearStats.prize ?? 0) + prize;
        if (a.agentId) settle(state, `agent/${ev.id}`, -Math.round(prize * agentCut(a)), 'sport', 'Your agent\'s share');
      }
      if (sp.isTitle(ev.place)) {
        sum.title = true; sum.titleName = ev.name;
        e.titles.push({ year: state.year, name: ev.name, eventId: ev.id, format: ev.format });
        if (doubles) pair.titles += 1;
        sp.moment(state, { type: 'title', sportId: e.id, text: `Won the ${ev.name}.`, sig: ev.level === 'pro' ? 3 : 2, eventId: ev.id });
        if (['pro', 'elite', 'college', 'academy'].includes(ev.level)) milestone(`Won the ${ev.name}.`, 'career');
      }
    }
    // The World Games, every four years: the country sends its best professionals and national-squad athletes.
    const gamesYear = can && isGamesYear(state.year) && ['pro', 'elite'].includes(e.level);
    if (gamesYear && overall(e, p) < 70 && !(e.gamesMissed ?? []).includes(state.year)) {
      (e.gamesMissed ??= []).push(state.year);
      sp.say(state, `The ${WORLD_GAMES.name} ${state.year} went ahead without you: the selectors picked others.`, 'neutral', { screen: 'sport', id: e.id });
    }
    if (gamesYear && overall(e, p) >= 70) {
      const ev = playEvent(state, e, 'elite', 'games', { name: `${WORLD_GAMES.name} ${state.year}` });
      if (!e.events.includes(ev.id)) e.events.push(ev.id);
      ev.games = true;
      const medal = MEDAL_FOR[ev.place] ?? null;
      const wonMatches = ev.rounds.filter((x) => x.won).length;
      sum.wins += wonMatches; sum.losses += ev.rounds.length - wonMatches;
      if (medal) {
        ev.medal = medal;
        (e.medals ??= []).push({ year: state.year, medal, games: ev.name, eventId: ev.id });
        sum.medal = medal;
        milestone(`${medal[0].toUpperCase()}${medal.slice(1)} medal in ${sport.name.toLowerCase()}, ${ev.name}.`, 'career');
        sp.moment(state, { type: 'medal', sportId: e.id, text: `${medal[0].toUpperCase()}${medal.slice(1)} medal at the ${ev.name}.`, sig: 3, eventId: ev.id });
      }
      sp.say(state, `The ${ev.name}: ${medal ? `a ${medal} medal` : `you finished ${/^\d/.test(ev.place) ? ev.place : `in the ${ev.place.toLowerCase()}`}`}.`, medal ? 'good' : 'neutral', { screen: 'sport', id: e.id });
    }
    const titles = e.titles.filter((t) => t.year === state.year).length;
    if (can) { const won = yearAwards(state, e, sum); if (won.length) sum.awards = [...(sum.awards ?? []), ...won]; }
    const best = can ? e.events.map((id) => S.events[id]).filter((x) => x.year === state.year).map((x) => x.place) : [];
    sum.rating = Math.round(clamp(6 + (sum.wins - sum.losses) / Math.max(4, sum.wins + sum.losses) * 3, 3, 10) * 10) / 10;
    e.lastRating = Math.round(clamp((sum.rating - 3) * 14));
    if (can) sp.say(state, `Your ${sport.name.toLowerCase()} year: ${can} ${can === 1 ? 'event' : 'events'}${sum.wins + sum.losses ? `, ${sum.wins} matches won and ${sum.losses} lost` : ''}${titles ? `, ${titles} ${titles === 1 ? 'title' : 'titles'}` : best.length ? `, best finish ${bestOf(best)}` : ''}. Pathways Rating ${e.pr}.`, titles ? 'good' : 'neutral', { screen: 'sport', id: e.id });
    else log(`Injury kept you out of every ${sport.name.toLowerCase()} event this year.`, 'system', 'bad');
  }
  e.seasonsPlayed += 1;
  // Paying for it: the family pays for children; adults pay their own, except what a club or scholarship covers.
  const cost = yearlyCost(state, e);
  if (cost && p.age >= 18 && !(p.flags.livesWithParents && p.age < 21)) settle(state, `fees/${e.id}/${state.year}`, -cost, 'sport', `${sport.name}: fees, coaching and kit`);
  const own = sp.coachOf(e.privateCoachId, state);
  if (own && p.age >= 18) {
    if (p.finance.cash >= own.fee) settle(state, `private/${own.id}/${state.year}`, -own.fee, 'sport', `${sport.name}: a private coach`);
    else { sp.dropPrivateCoach(e.id, state); sp.say(state, `You could not pay ${own.name} this year, and the coaching stopped.`, 'bad', { screen: 'coach', id: own.id }); }
  }
  // A coach who sees something says so: an academy calls.
  scouting(state, a, e, sum);
  recruitYear(state, a, e); // high school: stars, camps, offers, visits, commitment, signing day (engine/recruiting.js)
  youthYear(state, a, e); // soccer academies: a scholarship or youth contract at 16, or released (engine/youthContracts.js)
  asiaYear(state, a, e); // Japan and Korea: posting, free agency abroad, military service (engine/asiaBaseball.js)
  intlYear(state, a, e); // outside the draft countries: trainers, handshake deals, signing at 16 (engine/international.js)
  proRoutes(state, a, e);
  if (e.contractId) contractYear(state, a, e);
  mindYear(state, a, e, sum);
  fameYear(state, a, e, sum);
  afterSeason(state, a, e, sum); // college: the season used, NIL money, the transfer portal
  minorsYear(state, a, e, sum); // the minor leagues: up a level, called up, or down (engine/draft.js)
  draftYear(state, a, e); // the draft, by the league's own rules (engine/draft.js)
  baseballYear(state, a, e, sum); // baseball: winter ball, the Classic, summer leagues, life abroad (engine/baseball.js)
  integrityYear(state, a, e);
  // The body says when: a professional in their thirties is asked whether this is the last year.
  if (p.age >= 33 && (e.level === 'pro' || e.level === 'elite') && overall(e, p) < 70) decide(state, { kind: 'retire', sportId: e.id, key: `retire/${e.id}/${state.year}`, text: `You are ${p.age}. The game is getting faster and you are not. Is it time?`,
    options: [{ id: 'yes', label: 'Retire' }, { id: 'no', label: 'One more year' }] });
  arcsYear(state, a, e, sum);
  const team = sp.teamOf(e.teamId, state);
  if (team) { const me = team.roster.find((x) => x.id === p.id); if (me) me.rating = overall(e, p); }
}
/**
 * The level of events entered. Professionals and university players play their own circuits; anyone else enters the
 * open events their rating gets them into, so a strong player at a small club still meets players as good as they are.
 */
function eventLevel(e, p) {
  if (['pro', 'college', 'elite'].includes(e.level)) return e.level;
  const byRating = e.pr >= 1250 ? 'academy' : e.pr >= 1080 ? 'club' : 'recreational';
  const order = ['recreational', 'club', 'academy'];
  const own = e.level === 'school' ? 'club' : e.level;
  return order[Math.max(order.indexOf(own), order.indexOf(byRating), p.age >= 16 && overall(e, p) >= 55 ? 1 : 0)];
}
const bestOf = (places) => places.slice().sort((x, y) => rankPlace(x) - rankPlace(y))[0];
const rankPlace = (x) => (x === 'Champion' ? 1 : x === 'Final' ? 2 : x === 'Semifinal' ? 3 : x === 'Quarterfinal' ? 5 : /^Round of (\d+)/.test(x) ? Number(x.match(/\d+/)[0]) : parseInt(x, 10) || 99);

function scouting(state, a, e, sum) {
  const p = state.player;
  if (!['recreational', 'club', 'school'].includes(e.level) || p.age < 10 || p.age > 17) return;
  if (e.intl?.trainer) return; // in a trainer's program: the clubs' scouts come to its showcases instead (engine/international.js)
  const sport = sportOf(e.id);
  if (!(sport.popular.includes(p.countryId) || sport.depth === 'full')) return;
  const o = overall(e, p);
  if (o < 52 || sum.rating < 6.6) return;
  const org = findOrg(state, sport, 'academy');
  if (e.orgId === org.id) return;
  decide(state, { kind: 'academy', sportId: e.id, orgId: org.id, key: `academy/${p.id}/${e.id}`, text: `A scout from ${org.name} watched you play, and they would like you to join without a tryout.`,
    options: [{ id: 'yes', label: 'Join the academy' }, { id: 'no', label: 'Stay where you are' }] });
}

// ---------- One generation to the next ----------

/** The athletic record passes whole to the next generation. Ids are mapped the way the family tree maps them. */
export function handOver(old, next, ids) {
  const S = sp.ensure(old);
  next.sports = S;
  const np = next.player;
  const map = { [old.player.id]: ids.ancestorId, [ids.heirId]: np.id };
  const m = (id) => map[id] ?? id;
  const athletes = {};
  for (const [id, a] of Object.entries(S.athletes)) { a.id = m(id); athletes[a.id] = a; for (const x of a.parents) x.id = m(x.id); }
  if (athletes[ids.ancestorId] && !athletes[ids.ancestorId].died) athletes[ids.ancestorId].died = old.year;
  S.athletes = athletes;
  for (const s of Object.values(S.seasons)) s.playerId = m(s.playerId);
  for (const e of Object.values(S.events)) e.playerId = m(e.playerId);
  for (const x of S.moments) x.personId = m(x.personId);
  for (const x of Object.values(S.partnerships)) { x.a = m(x.a); if (!x.until) x.until = old.year; }
  for (const k of Object.values(S.contracts)) { k.personId = m(k.personId); if (k.status === 'active') { k.status = 'ended'; k.ended = old.year; k.why = 'the end of a life'; } }
  for (const c of Object.values(S.coaches)) c.players = c.players.map(m);
  if (S.coaches[old.player.id]) { S.coaches[ids.ancestorId] = { ...S.coaches[old.player.id], id: ids.ancestorId }; delete S.coaches[old.player.id]; }
  for (const t of Object.values(S.teams)) for (const x of t.roster) if (map[x.id]) { x.id = map[x.id]; x.player = false; }
  // Teams the last player was still on are left with their name on the roster, now as someone who has gone.
  for (const t of Object.values(S.teams)) t.roster = t.roster.filter((x) => x.id !== ids.ancestorId);
  S.decisions = S.decisions.map((d) => (d.status === 'open' ? { ...d, status: 'lapsed' } : d));
  // The heir may have played already, as a relative with a light record. It becomes their own full profile now:
  // the sports and levels they reached are kept, and their skills are worked out from their own talent, not inherited.
  const heir = S.athletes[np.id];
  if (heir?.light) {
    delete heir.light; heir.name = `${np.firstName} ${np.lastName}`;
    for (const e of Object.values(heir.sports)) sp.internals.fillEntry(next, np, e);
  }
  S.acts = { year: null, extra: 0 }; // the last player's extra sessions were theirs
  for (const a of Object.values(S.athletes)) if (a.light) a.relation = next.npcs[a.id]?.role ?? (a.id === ids.ancestorId ? 'parent' : 'family');
  S.tickYear = next.year;
  return S;
}

// ---------- Checking the record ----------

/** Everything that is wrong with the athletic record. An empty list means it is sound. */
export function audit(state = store.state) {
  const S = sp.ensure(state);
  const bad = [];
  for (const s of Object.values(S.seasons)) {
    const table = sp.standings(s);
    const done = s.fixtures.filter((f) => f.done).length;
    if (table.reduce((t, x) => t + x.p, 0) !== done * 2) bad.push(`${s.id}: standings do not count every completed game`);
    if (s.champion) {
      const fin = s.playoffs.find((f) => f.round === 'Final');
      if (!fin?.done || fin.winner !== s.champion) bad.push(`${s.id}: a champion without a completed final`);
    }
    for (const f of [...s.fixtures, ...s.playoffs]) if (f.done && (!Array.isArray(f.score) || f.score.some((x) => !Number.isFinite(x) || x < 0))) bad.push(`${s.id}: a fixture with no proper score`);
  }
  for (const a of Object.values(S.athletes)) {
    for (const e of Object.values(a.sports)) {
      for (const [k, v] of Object.entries(e.skills)) if (v > e.ceiling[k] + 0.01 || v < 0) bad.push(`${a.name}: ${e.id} ${k} outside its range`);
      // Statistics reconcile with the games: every game counted is a game played in a completed fixture.
      for (const [year, st] of Object.entries(e.stats)) {
        if (!st.games) continue;
        const played = e.seasons.map((id) => S.seasons[id]).filter((s) => s && s.year === Number(year) && s.playerId === a.id)
          .reduce((t, s) => t + [...s.fixtures, ...s.playoffs].filter((f) => f.done && f.me?.played).length, 0);
        if (played !== st.games) bad.push(`${a.name}: ${e.id} ${year} counts ${st.games} games, the fixtures ${played}`);
      }
      for (const t of e.titles) {
        if (t.seasonId && S.seasons[t.seasonId]?.champion == null) bad.push(`${a.name}: a title from a season with no champion`);
        if (t.eventId && S.events[t.eventId]?.place !== 'Champion') bad.push(`${a.name}: a title from an event not won`);
      }
    }
    if (Object.values(S.contracts).filter((k) => k.kind === 'pro' && k.status === 'active' && k.personId === a.id).length > 1) bad.push(`${a.name}: two professional contracts at once`);
    if (a.id === state.player.id) for (const inj of a.injuries.filter((x) => x.status === 'out')) if (!state.player.conditions.some((c) => c.id === `sport_${inj.type}`)) bad.push(`${a.name}: an open injury missing from the health record`);
  }
  for (const [key, x] of Object.entries(S.paid)) if (!Number.isFinite(x.amount)) bad.push(`payment ${key} has no amount`);
  const open = {};
  for (const x of Object.values(S.partnerships)) if (!x.until) { const k = `${x.a}/${x.sportId}`; if (open[k]) bad.push(`two doubles partners at once in ${x.sportId}`); open[k] = 1; }
  return bad;
}

export { LEVEL_NAMES };
// The other modules' answers are looked up when a decision is answered, not merged here at load time: those modules
// import this one, and may still be loading when it runs (an import cycle).
const MORE_ANSWERS = () => [RECRUIT_ANSWERS, COLLEGE_ANSWERS, DRAFT_ANSWERS, INTL_ANSWERS, ASIA_ANSWERS, YOUTH_ANSWERS, TRADE_ANSWERS, BASEBALL_ANSWERS, CONTRACT_ANSWERS];
/** For the parts of the athletic life kept in their own files (engine/recruiting.js, engine/draft.js). */
export const internals = { decide: (...x) => decide(...x), money: (...x) => money(...x), fmt: (...x) => fmt(...x), proClub: (...x) => proClub(...x),
  offerFor: (...x) => offerFor(...x), signPro: (...x) => signPro(...x), endContract: (...x) => endContract(...x), ANSWERS: () => ANSWERS };

// ---------- Sports agents, shopped for ----------
// Each country has its own sports agents (engine/agents.js): people at agencies, each with their own cut (3–10%), pull
// with clubs and brands (clout: better contracts and sponsorships), and athletes on their books the player can look
// through. Looking shows one agent at a time, twice a year. The agent's cut comes out of salary, prize money and
// sponsorship. Older saves' agents, signed at a flat five per cent, keep those terms.

const AGENCY_NAMES = ['{S} Sports Management', '{W} Sports', '{S} & {S2} Athlete Representation', '{W} Pro Management'];
const AGENCY_WORDS = ['Summit', 'Victory', 'Apex', 'Baseline', 'Podium', 'Keystone', 'Northstar', 'Fullcourt', 'Clearwater', 'Ironside'];
export const agentCut = (a) => (a?.agentId ? a.agent?.commission ?? 0.05 : 0);
export const agentClout = (a) => (a?.agentId ? a.agent?.clout ?? 1 : 0);
const athleteWord = (sport) => (sport.kind === 'team' || sport.kind === 'racket' ? `${sport.name} player` : sport.kind === 'golf' ? 'Golfer' : sport.kind === 'combat' ? `${sport.name} fighter` : `${sport.name} athlete`);

/** Invented professional athletes on an agency's books: a mix of sports, women and men. */
function clientAthletes(state, countryId, tier) {
  const pool = SPORTS_LIST.filter((x) => x.pro !== 'none' && !x.adaptive && x.proFrom <= state.year);
  const local = pool.filter((x) => x.popular.includes(countryId));
  return Array.from({ length: tier === 'top' ? 3 : 2 }, () => {
    const sport = rng.pick(local.length && rng.chance(0.7) ? local : pool);
    const woman = rng.chance(0.4) && sp.proYears(sport, 'women', state.year).open;
    const n = makeNpc({ role: 'performer', countryId, age: rng.int(19, 34), gender: woman ? 'female' : 'male', relationship: 30 });
    n.occupation = `Professional ${athleteWord(sport).toLowerCase()}`;
    n.flags.sport = sport.id;
    n.flags.star = { kind: 'athlete', sport: sport.id, division: woman ? 'women' : 'men', fame: tier === 'top' ? rng.int(40, 85) : rng.int(8, 45), skill: { sports: tier === 'top' ? rng.int(82, 96) : rng.int(64, 84) } };
    state.npcs[n.id] = n;
    return n;
  });
}

/** The country's sports agents, made the first time anyone looks. */
export function sportsAgents(countryId = store.state.player.countryId, state = store.state) {
  const S = sp.ensure(state);
  S.agentPools ??= {};
  S.agentPools[countryId] ??= makeAgents('sports', countryId, { country: COUNTRIES[countryId], makeNpc, words: AGENCY_WORDS, agencyNames: AGENCY_NAMES, clients: (tier) => clientAthletes(state, countryId, tier) });
  return S.agentPools[countryId].map((id) => state.npcs[id]).filter((n) => n && n.alive !== false).map((n) => { ensureTerms(n); return n; });
}

/** What the player is worth to an agent: how good they are where it counts, and how well known. */
export function athleteWorth(state = store.state) {
  const a = sp.myAthlete(state);
  if (!a) return 0;
  const best = Math.max(0, ...Object.values(a.sports).filter((e) => e.status === 'active' && e.level !== 'recreational').map((e) => overall(e, state.player)));
  return Math.round(Math.max(0, (best - 40) * 1.5) + (a.fame ?? 0) * 0.5);
}
const canHaveAgent = (state) => { const a = sp.myAthlete(state); return state.player.age >= 15 && a && Object.values(a.sports).some((e) => e.status === 'active' && e.level !== 'recreational'); };
export const myAgent = (state = store.state) => { const a = sp.myAthlete(state); return a?.agentId ? { npcId: a.agentId, agency: a.agent?.agency ?? '', commission: agentCut(a), clout: agentClout(a), since: a.agent?.since ?? '' } : null; };
export const sportsAgentOnOffer = () => offered('sports');
export const sportsAgentTriesLeft = () => triesLeft('sports');
export const wantsSportsAgent = (state = store.state) => canHaveAgent(state) || !!sp.myAthlete(state)?.agentId;

/** One look for a sports agent: one of those who would take the player on, with their terms. */
export function findSportsAgent(state = store.state) {
  if (!canHaveAgent(state)) return result(false, 'Agents represent athletes who compete: join a club, team or tour first.', 'neutral');
  const worth = athleteWorth(state);
  const mine = sp.myAthlete(state).agentId;
  const r = lookFor('sports', sportsAgents(state.player.countryId, state).filter((n) => n.flags.agent.standard <= worth && n.id !== mine));
  if (r.error) return result(false, r.error, 'neutral');
  if (r.none) return result(false, 'No sports agent will take you on yet. Results, and being known, change that.', 'neutral');
  const g = r.agent.flags.agent;
  return result(true, `${fullName(r.agent)} of ${g.agency} would represent you, for ${Math.round(g.commission * 100)}% of what you earn from sport.`, 'neutral');
}
export function passOnSportsAgent() { clearOffer('sports'); return result(true, 'You say no.', 'neutral'); }
export function signSportsAgent(state = store.state) {
  const n = offered('sports', state.player);
  if (!n) return result(false, 'No agent is on offer.', 'neutral');
  if (sp.myAthlete(state).agentId) dropSportsAgent(state, true);
  const S = sp.ensure(state);
  const a = sp.myAthlete(state);
  const p = state.player;
  const g = n.flags.agent;
  a.agentId = n.id;
  a.agent = { agency: g.agency, commission: g.commission, clout: g.clout, since: state.year };
  if (!g.clients.includes('player')) g.clients.push('player');
  if (!p.npcIds.includes(n.id)) p.npcIds.push(n.id);
  n.flags.title = 'Your sports agent';
  S.contracts[`agent_${n.id}`] = { id: `agent_${n.id}`, kind: 'agent', personId: p.id, agentId: n.id, name: fullName(n), from: state.year, to: null, share: g.commission, status: 'active' };
  clearOffer('sports', p);
  const text = `${fullName(n)} of ${g.agency} is your agent now: contracts, sponsors, and ${Math.round(g.commission * 100)}% of what you earn from sport.`;
  log(text, 'system', 'good');
  return result(true, text);
}
export function dropSportsAgent(state = store.state, quiet = false) {
  const a = sp.myAthlete(state);
  if (!a?.agentId) return result(false, 'You have no agent.', 'neutral');
  const n = state.npcs[a.agentId];
  if (n?.flags.agent) n.flags.agent.clients = n.flags.agent.clients.filter((c) => c !== 'player');
  if (n) n.flags.title = 'Your former sports agent';
  const k = sp.ensure(state).contracts[`agent_${a.agentId}`];
  if (k?.status === 'active') { k.status = 'ended'; k.to = state.year; k.ended = state.year; }
  a.agentId = null; a.agent = null;
  if (!quiet) log('You and your agent part ways.', 'system', 'neutral');
  return result(true, 'You and your agent part ways.', 'neutral');
}
export function askSportsAgentCut(state = store.state) {
  const a = sp.myAthlete(state);
  if (!a?.agentId) return result(false, 'You have no agent.', 'neutral');
  a.agent ??= { agency: '', commission: 0.05, clout: 1, since: state.year };
  const holder = { npcId: a.agentId, commission: a.agent.commission };
  const r = askLowerCut('sports', holder, athleteWorth(state), state.player);
  a.agent.commission = holder.commission;
  const k = sp.ensure(state).contracts[`agent_${a.agentId}`];
  if (k) k.share = holder.commission;
  if (r.dropped) dropSportsAgent(state, true);
  return r;
}

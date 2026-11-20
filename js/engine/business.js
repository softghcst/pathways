// Owning a business. A business is a company with its own money, staff,
// reputation and history; the player owns a share of it. It is distinct from
// being employed: a chief executive does not own their employer, and an owner
// is paid only what the business can afford to pay out.
//
//   p.businesses = [Business]
//   Business: {
//     id, typeId, name, countryId, city, employerId,   it is also an employer on the map (engine/employers.js)
//     founded (year), foundedAge, years,
//     status: 'open' | 'sold' | 'closed' | 'failed' | 'family',
//     stake,                     the player's share, 0–1
//     partners: [{ id, stake }], other owners (NPCs)
//     cash, debt, debtYears,     the company's own account and borrowing
//     sites,                     how many premises
//     staff: [{ id, wageK, since, manager }],  named employees (NPCs with lives of their own)
//     others,                    further staff who are not named
//     reputation, quality,       0–100
//     marketing,                 this year's boost to custom (decays)
//     rivals,                    competitors nearby, each taking a share of the custom; success attracts them
//     pricing, ownerHours, draw, the owner's standing decisions
//     overdrawn,                 years in a row the account has been below zero
//     lossCarry, taxPaid         losses not yet set against profit; all the tax it has paid
//     last: { revenue, wages, rent, supplies, overhead, interest, profit, drawn, heads, demand },
//     payout, payoutPaid,        what is owed to the owner this year, paid once by payroll
//     candidates,                this year's applicants for a job there
//     history: [{ year, text }], heirId, ownerNpcId (when a relative runs it)
//   }
//
// The company pays tax on its profit where it is based (profitTax), after any
// losses from earlier years are set against it (lossCarry). A sole trader (working
// alone, no partners) pays none: their profit is their income. What the owner then
// takes out is income, taxed with the rest of their pay.
import { rng } from '../rng.js';
import { studioReady } from './dance.js';
import { clamp, fmtMoney, localWage, localCost, niceRound, uid } from '../util.js';
import { store, player, country, livingNpcs, log, milestone } from '../state.js';
import { businessExists } from '../data/eras.js';
import { COUNTRIES } from '../data/countries.js';
import { CAREER_BY_ID } from '../data/careers.js';
import { PROGRAMS, TRADE_BY_ID } from '../data/schools.js';
import { BUSINESS_TYPES, BUSINESS_BY_ID, FROM_SERVICE, PRICING, DRAWS, BUSINESS_NAMES, NAME_WORDS, BUSINESS_LOAN, PROFIT_TAX, DEFAULT_PROFIT_TAX, SMALL_PROFIT } from '../data/business.js';
import { typicalWage } from './systems.js';
import { makeNpc } from './npcFactory.js';
import { ensureLife } from './npcLives.js';
import { cityOf } from './cities.js';
import { phase } from './economy.js';
import { registerEmployer, employer, chronicle } from './employers.js';
import { career as careerState, canFit, workLaw } from './worklife.js';
import { licenseFor, licensed, examName } from './adulted.js';
import { convert } from './currency.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const an = (noun) => `${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`;
const NAMED = 5; // named staff; any more are counted, not drawn
/** Company money, as it arrives in the owner's pocket: in the currency of wherever the owner now lives. */
const toOwner = (b, amount) => (b.countryId === player().countryId ? amount : convert(amount, COUNTRIES[b.countryId].currency.code, country().currency.code));
const fromOwner = (b, amount) => (b.countryId === player().countryId ? amount : convert(amount, country().currency.code, COUNTRIES[b.countryId].currency.code));

/** The player's businesses, past and present. */
export function businesses(p = player()) { p.businesses ??= []; return p.businesses; }
export const openBusinesses = (p = player()) => businesses(p).filter((b) => b.status === 'open');
export const business = (id) => businesses().find((b) => b.id === id) ?? null;
const typeOf = (b) => BUSINESS_BY_ID[b.typeId];
const placeOf = (b) => COUNTRIES[b.countryId];
const acts = (b) => { const p = player(); if (b.acts?.age !== p.age) b.acts = { age: p.age, done: {} }; return b.acts.done; };
const note = (b, text) => { b.history.push({ year: store.state.year, text }); if (b.history.length > 30) b.history.shift(); chronicle(employer(b.employerId), text); };

/** The tax rates on business profit where a business is based. */
export function profitTaxOf(countryId) {
  const t = PROFIT_TAX[countryId] ?? DEFAULT_PROFIT_TAX;
  return { rate: t.rate, small: t.small ?? t.rate };
}

/**
 * The tax on a year's profit, after earlier losses are set against it.
 * @returns {{tax:number, taxable:number, carry:number}} carry: losses still to set against later profit
 */
export function profitTax(profit, countryId, lossCarry = 0) {
  if (profit <= 0) return { tax: 0, taxable: 0, carry: lossCarry - profit };
  const taxable = Math.max(0, profit - lossCarry);
  const carry = Math.max(0, lossCarry - profit);
  const { rate, small } = profitTaxOf(countryId);
  const band = typicalWage(COUNTRIES[countryId]) * SMALL_PROFIT;
  const tax = Math.round(Math.min(taxable, band) * small + Math.max(0, taxable - band) * rate);
  return { tax, taxable, carry };
}

/** Money figures for a kind of business, in a place. */
/** A celebrity brand sells on its owner's name, and on whether people like them. 1 is an ordinary business. */
export function starPull(p = player()) {
  const name = p.hidden?.fame ?? 0;
  const favor = p.fame?.favor ?? 50;
  return clamp(0.45 + name / 45 * (0.4 + favor / 80), 0.3, 2.6);
}

export function figures(type, countryId = player().countryId, city = player().city) {
  const c = COUNTRIES[countryId];
  const k = cityOf(countryId, city);
  return { startup: niceRound(localCost(type.startup, c) * (0.6 + 0.4 * k.housing)), perHead: Math.round(localWage(type.perHead, c) * k.pay),
    rent: Math.round(localCost(type.rent, c) * k.housing), wage: Math.round(localWage(type.wage, c) * k.pay) };
}

// ---------- Starting ----------

/** Why the player cannot start this kind of business, or ''. */
export function startBlock(type) {
  const p = player();
  const c = careerState();
  const n = type.needs;
  const has = (t) => p.education.degrees.some((d) => d.type === t);
  if (!businessExists(type.id, store.state.year)) return `There is no such business in ${store.state.year}.`;
  if (p.age < Math.max(18, n.minAge ?? 18)) return `You need to be ${Math.max(18, n.minAge ?? 18)}.`;
  if (p.legal.incarceration) return 'Not from a cell.';
  if (p.royal && !p.royal.waiting && ['monarch', 'heir'].includes(p.royal.rank)) return 'The crown does not go into trade.';
  if (n.trade && !p.education.degrees.some((d) => d.type === 'apprenticeship' && d.majorId === n.trade)) return `Needs a completed ${TRADE_BY_ID[n.trade].name.toLowerCase()} apprenticeship.`;
  if (n.program && !has(n.program)) return `Needs you to have finished ${PROGRAMS[n.program].label.toLowerCase()}.`;
  if (n.program && licenseFor(n.program) && !licensed(licenseFor(n.program))) return `Needs you to pass the ${examName(licenseFor(n.program))}.`;
  if (n.degree && !has(n.degree)) return 'Needs a university degree.';
  if (n.experience && !n.program && !Object.entries(n.experience).some(([id, y]) => (c.experience[id] ?? 0) >= y)) {
    return `Needs experience first: ${Object.entries(n.experience).slice(0, 3).map(([id, y]) => `${y} years in ${CAREER_BY_ID[id].name.toLowerCase()}`).join(', or ')}.`;
  }
  if (n.land && !['country', 'mansion'].includes(p.assets.find((a) => a.id === p.homeId)?.catalogId)) return 'Needs land of your own: a country property you live in.';
  if (n.flag && !p.flags[n.flag]) return n.flagText ?? 'You are not ready for this yet.';
  if (n.dancer && !studioReady(p)) return 'Parents choose a studio by its teacher: you need a dance degree, three years in a dance company, or ten paid dance jobs, and to dance well.';
  if (n.experienceTotal && Object.values(c.experience).reduce((a, b) => a + b, 0) < n.experienceTotal) return `Clients want ${n.experienceTotal} years of working life behind you.`;
  if (n.fame && (p.hidden.fame ?? 0) < n.fame) return 'A brand like this sells on a famous name, and yours is not famous enough yet.';
  if (openBusinesses().length >= 3) return 'Three businesses is as many as one person can keep hold of.';
  return '';
}

/** Every kind of business, with what it costs here and whether the player may start one. */
export function startOptions() {
  const c = careerState();
  return BUSINESS_TYPES.map((t) => {
    const f = figures(t);
    // A freelancer with a name in the same line of work starts ahead: clients, and less to set up.
    const svc = Object.entries(FROM_SERVICE).find(([s, b]) => b === t.id && (c.freelance.services[s]?.rep ?? 0) >= 55 && (c.freelance.services[s]?.done ?? 0) >= 8);
    return { ...t, ...f, startup: svc ? Math.round(f.startup * 0.6) : f.startup, fromService: svc?.[0] ?? null, block: startBlock(t) };
  });
}

/** A name for a new business, if the player does not choose one. */
export function suggestName(type) {
  const p = player();
  const short = type.name.replace(/ (business|company|firm|practice|contractor|workshop)$/i, '');
  return rng.pick(BUSINESS_NAMES).replace('{S}', p.lastName).replace('{C}', p.city).replace('{W}', rng.pick(NAME_WORDS)).replace('{T}', short);
}

/**
 * Opens a business. o.borrow: how much of the cost the business borrows (the rest is the owner's savings).
 * @param {string} typeId
 * @param {string} [name]
 * @param {{borrow?:number}} [o]
 */
export function start(typeId, name, o = {}) {
  const p = player();
  const c = careerState();
  const opt = startOptions().find((x) => x.id === typeId);
  if (!opt) return result(false, 'There is no such business.', 'neutral');
  if (opt.block) return result(false, opt.block, 'neutral');
  const main = c.careerId ? CAREER_BY_ID[c.careerId] : null;
  if (main?.outside === false) return result(false, `As ${c.title.toLowerCase()} you may not run a business on the side.`, 'neutral');
  if (p.politics && p.politics.tier >= 2) return result(false, `Holding office as ${p.politics.title} rules out running a business.`, 'neutral');
  const fit = canFit(10, { kind: 'business' });
  if (!fit.ok) return fit;
  const borrow = clamp(Math.round(o.borrow ?? 0), 0, Math.round(opt.startup * 0.7));
  const own = opt.startup - borrow;
  if (p.finance.cash < own) return result(false, `Opening ${an(opt.name.toLowerCase())} here costs ${fmtMoney(opt.startup, country())}. You would need ${fmtMoney(own, country())} of your own.`, 'neutral');
  if (borrow && (p.flags.bankruptUntil ?? 0) > p.age) return result(false, 'No bank will lend to you so soon after bankruptcy.', 'neutral');
  p.finance.cash -= own;
  const title = (name || suggestName(opt)).slice(0, 40);
  const e = registerEmployer({ name: title, family: opt.family, tracks: [opt.track], countryId: p.countryId, city: p.city });
  const rep = opt.fromService ? c.freelance.services[opt.fromService].rep : 28;
  const b = { id: uid('biz'), typeId, name: title, countryId: p.countryId, city: p.city, employerId: e.id, founded: store.state.year, foundedAge: p.age, years: 0,
    status: 'open', stake: 1, partners: [], cash: Math.round(Math.max(opt.startup * 0.15, opt.wage * 0.5)), debt: borrow, debtYears: borrow ? BUSINESS_LOAN.years : 0, sites: 1, staff: [], others: 0,
    reputation: rep, quality: 50, marketing: 1, pricing: 'standard', ownerHours: 45, draw: opt.solo ? 'most' : 'half', overdrawn: 0, last: null, payout: 0, payoutPaid: true, candidates: null,
    history: [], heirId: null, ownerNpcId: null };
  businesses(p).push(b);
  if (!fitHours(b, 45)) b.ownerHours = fitHours(b, 25) ? 25 : 10;
  note(b, `${p.firstName} ${p.lastName} opened ${title}.`);
  const text = `You open ${title}${borrow ? `, with ${fmtMoney(borrow, country())} borrowed against it` : ''}. ${opt.fromService ? 'Your freelance clients come with you. ' : ''}${opt.solo ? 'For now it is just you.' : 'It needs staff before it can take much custom.'}`;
  log(text, 'system', 'good');
  milestone(`Opened ${title}.`, 'career');
  return result(true, text);
}

const fitHours = (b, hours) => canFit(Math.max(0, hours - (b.ownerHours ?? 0)), { kind: 'business' }).ok;

// ---------- People ----------

/** The named people who work there, with what they are paid. */
export function staffOf(b) {
  const f = figures(typeOf(b), b.countryId, b.city);
  return b.staff.map((s) => ({ ...s, npc: store.state.npcs[s.id], wage: Math.round(f.wage * s.wageK * (s.manager ? 1.5 : 1)) })).filter((s) => s.npc?.alive);
}
export const headcount = (b) => staffOf(b).length + b.others;
export const managerOf = (b) => staffOf(b).find((s) => s.manager)?.npc ?? null;

/** This year's applicants: three people, each with a wage in mind. */
export function candidates(b) {
  const p = player();
  if (b.candidates?.age === p.age) return b.candidates.list;
  const list = [];
  for (let i = 0; i < 3; i++) {
    const n = makeNpc({ role: 'colleague', countryId: b.countryId, age: rng.int(19, 55), relationship: rng.int(40, 55) });
    const skill = Math.round(clamp(rng.around(55, 25), 15, 98));
    n.meters.intellect = skill;
    list.push({ npc: n, skill, wageK: Math.round((0.8 + skill / 200 + rng.next() * 0.15) * 100) / 100, years: Math.max(0, Math.round((n.age - 19) * rng.next() * 0.6)) });
  }
  b.candidates = { age: p.age, list };
  return list;
}

function employ(b, n, wageK) {
  const p = player();
  const t = typeOf(b);
  const e = employer(b.employerId);
  if (!store.state.npcs[n.id]) store.state.npcs[n.id] = n;
  if (!p.npcIds.includes(n.id)) p.npcIds.push(n.id);
  ensureLife(n);
  const car = CAREER_BY_ID[t.track];
  const f = figures(t, b.countryId, b.city);
  if (n.life) {
    n.life.job = { careerId: car.id, level: 0, title: car.levels[0].title, salary: Math.round(f.wage * wageK), years: 0, employerId: e.id };
    n.life.edu.stage = 'done';
    n.life.edu.yearsLeft = 0;
  }
  n.occupation = car.levels[0].title.toLowerCase();
  if (n.role === 'colleague') n.flags.title = `Works for you at ${b.name}`;
  n.flags.employeeOf = b.id;
  if (b.countryId !== p.countryId) n.flags.abroad = b.countryId; // they live where the business is
  n.flags.workedWith = b.name;
  n.lastInteractionAge = p.age;
  if (!e.staff.includes(n.id)) e.staff.push(n.id);
  b.staff.push({ id: n.id, wageK, asked: wageK, since: p.age, manager: false });
}

/** Takes on one of this year's applicants (by index), or an unnamed pair of hands once the named staff are enough. */
export function hire(b, index) {
  const f = figures(typeOf(b), b.countryId, b.city);
  if (b.cash < f.wage * 0.2) return result(false, 'The business cannot cover another wage just now. Put money in, or wait for a better year.', 'neutral');
  if (staffOf(b).length >= NAMED || index == null) {
    b.others += 1;
    return result(true, `You take on another member of staff. ${b.name} now employs ${headcount(b)}.`);
  }
  const cand = candidates(b)[index];
  if (!cand) return result(false, 'They have taken another job.', 'neutral');
  b.candidates.list = b.candidates.list.filter((x) => x !== cand);
  employ(b, cand.npc, cand.wageK);
  note(b, `${cand.npc.firstName} ${cand.npc.lastName} was taken on.`);
  return result(true, `${cand.npc.firstName} ${cand.npc.lastName} starts on Monday, on ${fmtMoney(Math.round(f.wage * cand.wageK), placeOf(b))} a year.`);
}

/** People the player already knows who could be offered a job in the business. */
export function hireable(b) {
  const here = new Set(b.staff.map((s) => s.id));
  return livingNpcs().filter((n) => ['friend', 'colleague', 'sibling', 'child', 'grandchild', 'niece', 'spouse', 'partner', 'inlaw'].includes(n.role)
    && n.age >= Math.max(16, workLaw().workAge) && n.age < 68 && !here.has(n.id) && !n.flags.abroad && !n.flags.recruits);
}

/** Offers a job to someone the player knows. They may say no. */
export function hireKnown(b, npcId) {
  const n = store.state.npcs[npcId];
  if (!n?.alive || !hireable(b).some((x) => x.id === npcId)) return result(false, 'They are not free to take it.', 'neutral');
  if (staffOf(b).length >= NAMED) return result(false, 'Your team is as big as you can manage by name. Take on general staff instead.', 'neutral');
  if (acts(b)[`ask_${npcId}`]) return result(false, 'You have asked them this year.', 'neutral');
  acts(b)[`ask_${npcId}`] = true;
  ensureLife(n);
  const settled = n.life?.job && (n.life.job.level >= 2 || n.life.job.salary > figures(typeOf(b), b.countryId, b.city).wage * 1.3);
  const yes = rng.chance(clamp(0.45 + (n.meters.relationship - 50) / 100 - (settled ? 0.35 : 0) + (n.life?.job ? 0 : 0.25), 0.05, 0.95));
  if (!yes) return result(false, `${n.firstName} thanks you, and means it, but ${settled ? 'will not give up the job they have' : 'says it is not for them'}.`, 'neutral');
  employ(b, n, 1);
  n.meters.relationship = clamp(n.meters.relationship + 6);
  note(b, `${n.firstName} ${n.lastName} joined.`);
  const kin = ['child', 'grandchild', 'niece', 'sibling', 'spouse'].includes(n.role);
  return result(true, `${n.firstName} says yes. ${kin ? 'Family in the business: closer, and harder to tell no.' : 'You have worked alongside people you liked less.'}`);
}

/** Lets someone go: a named member of staff, or (no id) one of the unnamed. */
export function letGo(b, npcId) {
  if (!npcId) {
    if (!b.others) return result(false, 'There is nobody to let go.', 'neutral');
    b.others -= 1;
    return result(true, `You let one of the staff go. ${b.name} now employs ${headcount(b)}.`, 'neutral');
  }
  const n = store.state.npcs[npcId];
  b.staff = b.staff.filter((s) => s.id !== npcId);
  if (n) {
    if (n.life?.job?.employerId === b.employerId) { n.life.lastJob = { careerId: n.life.job.careerId, level: n.life.job.level }; n.life.job = null; n.occupation = 'between jobs'; }
    delete n.flags.employeeOf;
    if (n.role === 'colleague') n.flags.title = 'Used to work for you';
    n.meters.relationship = clamp(n.meters.relationship - (['child', 'sibling', 'spouse', 'friend'].includes(n.role) ? 22 : 12));
    note(b, `${n.firstName} ${n.lastName} was let go.`);
  }
  return result(true, n ? `You let ${n.firstName} go. It is not a conversation either of you will forget.` : 'Done.', 'neutral');
}

/** Gives a named member of staff a raise. */
export function giveRaise(b, npcId) {
  const s = b.staff.find((x) => x.id === npcId);
  const n = store.state.npcs[npcId];
  if (!s || !n) return result(false, 'They do not work for you.', 'neutral');
  if (acts(b)[`raise_${npcId}`]) return result(false, 'You have already given them a raise this year.', 'neutral');
  acts(b)[`raise_${npcId}`] = true;
  s.wageK = Math.round((s.wageK + 0.08) * 100) / 100;
  n.meters.relationship = clamp(n.meters.relationship + 7);
  return result(true, `You raise ${n.firstName}'s pay. They work like someone who has been noticed.`);
}

/** Puts a member of staff in charge day to day (or, with no id, takes the keys back). */
export function setManager(b, npcId) {
  for (const s of b.staff) s.manager = s.id === npcId;
  const n = store.state.npcs[npcId];
  if (n) { n.meters.relationship = clamp(n.meters.relationship + 5); note(b, `${n.firstName} ${n.lastName} was made manager.`); }
  return result(true, n ? `${n.firstName} runs ${b.name} day to day now, on a manager's wage.` : 'You are running it yourself again.', 'neutral');
}

// ---------- Decisions ----------

export function setPricing(b, id) { b.pricing = id; return result(true, `${b.name}: ${PRICING[id].label.toLowerCase()}.`, 'neutral'); }
export function setDraw(b, id) { b.draw = id; return result(true, `From now on you take: ${DRAWS[id].label.toLowerCase()}.`, 'neutral'); }

/** Changes how much of the owner's week the business gets. */
export function setHours(b, hours) {
  if (hours === 0 && !managerOf(b)) return result(false, 'With nobody in charge, it cannot run itself. Appoint a manager first.', 'neutral');
  const extra = hours - b.ownerHours;
  if (extra > 0) { const fit = canFit(extra, { kind: 'business' }); if (!fit.ok) return fit; }
  b.ownerHours = hours;
  return result(true, hours ? `You give ${b.name} ${hours} hours a week.` : `${b.name} runs without you now.`, 'neutral');
}

/** Spends company money on something that lasts: 'marketing' | 'equipment' | 'training'. */
export function invest(b, what) {
  const f = figures(typeOf(b), b.countryId, b.city);
  if (acts(b)[what]) return result(false, 'You have done that this year.', 'neutral');
  const cost = Math.round(f.startup * { marketing: 0.08, equipment: 0.15, training: 0.06 }[what] * b.sites);
  if (b.cash < cost) return result(false, `That would cost ${fmtMoney(cost, placeOf(b))}, and the business has ${fmtMoney(b.cash, placeOf(b))}.`, 'neutral');
  acts(b)[what] = true;
  b.cash -= cost;
  if (what === 'marketing') { b.marketing = 1.3; b.reputation = clamp(b.reputation + 3); }
  if (what === 'equipment') b.quality = clamp(b.quality + 12);
  if (what === 'training') { b.quality = clamp(b.quality + 6); for (const s of staffOf(b)) s.npc.meters.relationship = clamp(s.npc.meters.relationship + 3); }
  return result(true, { marketing: 'Leaflets, a new sign, a few paid posts. People who had never heard of you have now.', equipment: 'New equipment. The work is better, and so is the mood.',
    training: 'You send the staff on a course. They come back with ideas and certificates.' }[what]);
}

/** What a celebrity brand can launch, and what each needs. */
export const LAUNCHES = {
  fashion_label: ['a capsule collection', 'a line of sneakers', 'a winter collection'],
  beauty_brand: ['a fragrance', 'a skincare line', 'a lipstick range'],
  record_label: ['a compilation', 'a new signing', 'a reissue series'],
  production_co: ['a documentary', 'a short-film slate', 'a podcast series'],
};

/**
 * A celebrity brand launches a product, once a year: it costs the business, and how it sells
 * depends on the product (the business's quality), the owner's name, and whether people like them.
 */
export function launchProduct(b, name) {
  const t = typeOf(b);
  if (!t.celebrity) return result(false, 'Only a brand built on a name launches products like this.', 'neutral');
  if (acts(b).launch) return result(false, 'One launch a year.', 'neutral');
  const f = figures(t, b.countryId, b.city);
  const cost = Math.round(f.startup * 0.2);
  if (b.cash < cost) return result(false, `A launch costs ${fmtMoney(cost, placeOf(b))}; the business has ${fmtMoney(b.cash, placeOf(b))}.`, 'neutral');
  acts(b).launch = true;
  b.cash -= cost;
  const pull = starPull();
  const score = b.quality / 100 + pull / 2 + rng.around(0, 0.35);
  const outcome = score >= 1.3 ? 'hit' : score >= 0.85 ? 'steady' : 'flop';
  const take = Math.round(cost * { hit: rng.around(3, 0.6), steady: rng.around(1.2, 0.3), flop: rng.around(0.35, 0.15) }[outcome]);
  b.cash += take;
  b.reputation = clamp(b.reputation + { hit: 8, steady: 2, flop: -5 }[outcome]);
  if (outcome === 'hit') b.marketing = Math.max(b.marketing, 1.35);
  (b.launches ??= []).push({ year: store.state.year, name, outcome, cost, take });
  note(b, `Launched ${name}: ${outcome === 'hit' ? 'a hit' : outcome === 'steady' ? 'it sold steadily' : 'it flopped'}.`);
  if (outcome === 'hit') milestone(`${b.name} launched ${name}, and it sold out.`, 'career');
  return result(outcome !== 'flop', { hit: `${name[0].toUpperCase()}${name.slice(1)} sells out in a week. ${fmtMoney(take, placeOf(b))} back on ${fmtMoney(cost, placeOf(b))} spent.`,
    steady: `${name[0].toUpperCase()}${name.slice(1)} sells steadily: ${fmtMoney(take, placeOf(b))} back on ${fmtMoney(cost, placeOf(b))}.`,
    flop: `${name[0].toUpperCase()}${name.slice(1)} sits on the shelves. ${fmtMoney(take, placeOf(b))} back on ${fmtMoney(cost, placeOf(b))}.` }[outcome], outcome === 'steady' ? 'neutral' : undefined);
}

/** Puts the owner's own money into the business, or (negative) takes spare cash out as income. */
export function inject(b, amount) {
  const p = player();
  if (amount > 0) {
    if (p.finance.cash < amount) return result(false, 'You do not have that much.', 'neutral');
    p.finance.cash -= amount;
    b.cash += fromOwner(b, amount);
    // The warning said: put money in. An account brought back above zero has done what was asked; the strike is cleared.
    const cleared = b.overdrawn > 0 && b.cash >= 0;
    if (cleared) b.overdrawn = 0;
    return result(true, `You put ${fmtMoney(amount, country())} of your own into ${b.name}.${cleared ? ' The account is back in credit.' : ''}`, 'neutral');
  }
  return result(false, 'Nothing to move.', 'neutral');
}

/** Takes spare money out of the business. It reaches the owner with the year's pay, and is taxed as income. */
export function withdraw(b, amount) {
  const spare = Math.floor(b.cash - figures(typeOf(b), b.countryId, b.city).wage * 0.25 * Math.max(1, headcount(b))); // leave enough to meet the wages
  if (amount <= 0 || amount > spare) return result(false, spare > 0 ? `The most the business can spare is ${fmtMoney(spare, placeOf(b))}: it has wages to meet.` : 'The business has nothing to spare.', 'neutral');
  b.cash -= amount;
  const mine = Math.round(amount * b.stake);
  for (const pt of b.partners) { const n = store.state.npcs[pt.id]; if (n?.life) n.life.savings += Math.round(amount * pt.stake); }
  b.payout = (b.payoutPaid ? 0 : b.payout) + mine;
  b.payoutPaid = false;
  return result(true, `${b.name} pays out ${fmtMoney(amount, placeOf(b))}${b.stake < 1 ? `, of which ${fmtMoney(mine, placeOf(b))} is yours` : ''}. It will arrive with this year's pay, and be taxed with it.`, 'neutral');
}
/** The most that could be taken out now. */
export const spareCash = (b) => Math.max(0, Math.floor(b.cash - figures(typeOf(b), b.countryId, b.city).wage * 0.25 * Math.max(1, headcount(b))));

/** How much more the business could borrow. */
export const borrowRoom = (b) => Math.max(0, Math.round(figures(typeOf(b), b.countryId, b.city).startup * BUSINESS_LOAN.most * b.sites - b.debt));

export function borrow(b, amount) {
  if (acts(b).borrow) return result(false, 'The bank has seen you once this year already.', 'neutral');
  if (amount > borrowRoom(b)) return result(false, 'The bank will not lend that much against the business.', 'neutral');
  if (b.overdrawn >= 1 && b.reputation < 40) return result(false, 'The bank has looked at the accounts, and declined.');
  acts(b).borrow = true;
  b.debt += amount;
  b.debtYears = BUSINESS_LOAN.years;
  b.cash += amount;
  if (b.overdrawn > 0 && b.cash >= 0) b.overdrawn = 0; // borrowing out of the overdraft does what the warning asked
  return result(true, `The business borrows ${fmtMoney(amount, placeOf(b))} at ${Math.round(BUSINESS_LOAN.rate * 100)}%, to be repaid over ${BUSINESS_LOAN.years} years.`, 'neutral');
}

/** Opens another site. It needs a manager, a good name and the money. */
export function expand(b) {
  const f = figures(typeOf(b), b.countryId, b.city);
  const cost = Math.round(f.startup * 0.7);
  if (typeOf(b).solo && headcount(b) < 2) return result(false, 'Take on staff first: you cannot be in two places.', 'neutral');
  if (!managerOf(b)) return result(false, 'A second site needs someone you trust in charge of one of them. Appoint a manager.', 'neutral');
  if (b.reputation < 55) return result(false, 'Your name does not travel far enough yet. Build the reputation of the first site.', 'neutral');
  if (b.cash < cost) return result(false, `Opening another site costs ${fmtMoney(cost, placeOf(b))}. The business has ${fmtMoney(b.cash, placeOf(b))}.`, 'neutral');
  b.cash -= cost;
  b.sites += 1;
  note(b, `${b.name} opened site number ${b.sites}.`);
  milestone(`${b.name} opened a ${['second', 'third', 'fourth', 'fifth'][b.sites - 2] ?? 'new'} site.`, 'career');
  return result(true, `${b.name} opens a new site. More custom to win, more wages to find.`);
}

// ---------- Partners, selling, closing, handing on ----------

/** What the whole business is worth to a buyer. */
export function valuation(b) {
  const profit = b.last?.afterTax ?? b.last?.profit ?? 0;
  const goodwill = Math.max(0, profit) * (1.5 + b.reputation / 40);
  const fittings = figures(typeOf(b), b.countryId, b.city).startup * 0.35 * b.sites;
  return Math.max(0, Math.round(b.cash + fittings + goodwill - b.debt));
}

/** People who might buy in as a partner. */
export const partnerOptions = (b) => livingNpcs().filter((n) => ['friend', 'colleague', 'sibling', 'spouse'].includes(n.role) && n.age >= 21 && n.age < 70 && !b.partners.some((x) => x.id === n.id) && !n.flags.abroad);

/** Sells a quarter of the business to someone the player knows, for money put into it. */
export function takePartner(b, npcId) {
  const n = store.state.npcs[npcId];
  if (!n?.alive || !partnerOptions(b).some((x) => x.id === npcId)) return result(false, 'They are not in a position to.', 'neutral');
  if (b.stake <= 0.5) return result(false, 'Sell any more and it would no longer be yours to run.', 'neutral');
  if (acts(b)[`partner_${npcId}`]) return result(false, 'You have asked them this year.', 'neutral');
  acts(b)[`partner_${npcId}`] = true;
  ensureLife(n);
  const price = Math.round(valuation(b) * 0.25);
  const means = Math.max(n.life?.savings ?? 0, (n.meters.money ?? 40) * 400 * placeOf(b).currency.scale);
  const keen = clamp(0.3 + (n.meters.relationship - 50) / 90 + (b.reputation - 45) / 120 + (n.flags.workedWith ? 0.1 : 0), 0.03, 0.9);
  if (means < price || !rng.chance(keen)) return result(false, `${n.firstName} looks at the books for a long time, and says ${means < price ? 'they cannot raise it' : 'not this year'}.`, 'neutral');
  if (n.life) n.life.savings = Math.max(0, n.life.savings - price);
  b.cash += price;
  b.stake = Math.round((b.stake - 0.25) * 100) / 100;
  b.partners.push({ id: n.id, stake: 0.25 });
  n.flags.partnerIn = b.id;
  n.meters.relationship = clamp(n.meters.relationship + 8);
  note(b, `${n.firstName} ${n.lastName} became a partner.`);
  milestone(`Took ${n.firstName} ${n.lastName} on as a partner in ${b.name}.`, 'career');
  return result(true, `${n.firstName} buys a quarter of ${b.name} for ${fmtMoney(price, placeOf(b))}. The money goes into the business; a quarter of what it pays out goes to them.`);
}

function release(b, toEmployer = true) {
  const e = employer(b.employerId);
  for (const s of b.staff) {
    const n = store.state.npcs[s.id];
    if (!n) continue;
    delete n.flags.employeeOf;
    if (n.role === 'colleague') n.flags.title = toEmployer ? `Works at ${b.name}` : 'Used to work for you';
    if (!toEmployer && n.life?.job?.employerId === b.employerId) { n.life.lastJob = { careerId: n.life.job.careerId, level: n.life.job.level }; n.life.job = null; n.occupation = 'between jobs'; }
  }
  if (e) { if (toEmployer) e.owned = false; else e.closed = store.state.year; }
}

/** Offers the business for sale. A buyer has to be found, and has to like the books. */
export function sell(b) {
  const p = player();
  if (acts(b).sell) return result(false, 'You have already had it on the market this year.', 'neutral');
  acts(b).sell = true;
  const worth = valuation(b);
  const odds = clamp(0.2 + (b.reputation - 40) / 100 + ((b.last?.profit ?? 0) > 0 ? 0.3 : -0.1) + phase(b.countryId).hiring, 0.05, 0.9);
  if (worth <= 0 || !rng.chance(odds)) return result(false, worth <= 0 ? 'Nobody will pay for a business that owes more than it has.' : 'A couple of people came to look. Nobody made an offer you could take.');
  const price = Math.round(worth * b.stake * (0.85 + rng.next() * 0.25));
  p.finance.cash += toOwner(b, price);
  p.finance.lifetimeEarned += toOwner(b, price);
  b.status = 'sold';
  b.soldFor = price;
  b.soldAge = p.age;
  release(b, true);
  note(b, `${p.firstName} ${p.lastName} sold ${b.name}.`);
  const text = `You sell ${b.name} for ${fmtMoney(price, placeOf(b))}. Your name comes off the door; the staff stay on under the new owner.`;
  log(text, 'system', 'good');
  milestone(`Sold ${b.name} for ${fmtMoney(price, placeOf(b))}.`, 'career');
  return result(true, text);
}

/** Closes the business. What is left after its debts comes back to the owner; half of any shortfall is theirs to pay. */
export function close(b, failed = false) {
  const p = player();
  const left = Math.round(b.cash + figures(typeOf(b), b.countryId, b.city).startup * 0.15 * b.sites - b.debt);
  const mine = left >= 0 ? Math.round(left * b.stake) : Math.round(left * 0.5);
  p.finance.cash += toOwner(b, mine);
  b.status = failed ? 'failed' : 'closed';
  b.closedAge = p.age;
  release(b, false);
  note(b, failed ? `${b.name} went under.` : `${b.name} closed.`);
  const text = failed
    ? `${b.name} has run out of money, and closed. ${mine < 0 ? `You had signed for part of its debts: ${fmtMoney(-mine, placeOf(b))} comes out of your own pocket.` : 'Its debts are covered, just.'} The people who worked there are looking for work.`
    : `You close ${b.name}. ${mine >= 0 ? `After its debts, ${fmtMoney(mine, placeOf(b))} comes back to you.` : `Its debts leave you ${fmtMoney(-mine, placeOf(b))} to pay.`}`;
  log(text, 'system', failed ? 'bad' : 'neutral');
  if (failed) { p.stats.mood = clamp(p.stats.mood - 12); milestone(`${b.name} failed.`, 'career'); }
  return result(!failed, text, failed ? 'bad' : 'neutral');
}

/** Children (and grandchildren) old enough to be given the business. */
export const heirsFor = (b) => livingNpcs().filter((n) => ['child', 'grandchild'].includes(n.role) && n.age >= 21 && !n.flags.abroad);

/** Names who should have the business after the owner's death. */
export function nameHeir(b, npcId) {
  b.heirId = npcId;
  const n = store.state.npcs[npcId];
  return result(true, n ? `${b.name} is to go to ${n.firstName}.` : 'Nobody is named.', 'neutral');
}

/** Gives the business to a child now. They own it and run it; the player steps away. */
export function handOver(b, npcId) {
  const p = player();
  const n = store.state.npcs[npcId];
  if (!n?.alive || !heirsFor(b).some((x) => x.id === npcId)) return result(false, 'They are not ready, or not here.', 'neutral');
  ensureLife(n);
  const works = b.staff.some((s) => s.id === npcId);
  const willing = works || rng.chance(clamp(0.35 + (n.meters.relationship - 50) / 100 + (n.life?.job ? -0.15 : 0.2), 0.05, 0.9));
  if (!willing) return result(false, `${n.firstName} is grateful, and does not want it. They have a life of their own in mind.`, 'neutral');
  b.status = 'family';
  b.ownerNpcId = n.id;
  b.heirId = n.id;
  b.givenAge = p.age;
  b.staff = b.staff.filter((s) => s.id !== n.id);
  n.flags.owns = b.id;
  n.occupation = `owner of ${b.name}`;
  if (n.life) n.life.job = { careerId: typeOf(b).track, level: Math.min(2, CAREER_BY_ID[typeOf(b).track].levels.length - 1), title: `Owner, ${b.name}`, salary: Math.max(0, Math.round((b.last?.profit ?? 0) * 0.5)), years: 0, employerId: b.employerId };
  n.meters.relationship = clamp(n.meters.relationship + 15);
  note(b, `${p.firstName} ${p.lastName} handed ${b.name} on to ${n.firstName} ${n.lastName}.`);
  const text = `You hand ${b.name} to ${n.firstName}. ${works ? 'They know every corner of it already.' : 'They have a great deal to learn, and they know it.'} Your name stays over the door.`;
  log(text, 'system', 'good');
  milestone(`Handed ${b.name} on to ${n.firstName}.`, 'career');
  return result(true, text);
}

// ---------- The year ----------

const EVENTS = [
  { text: (b) => `${b.name} won a big order.`, tone: 'good', fx: (b, f) => { b.cash += Math.round(f.perHead * 0.3); b.reputation = clamp(b.reputation + 2); } },
  { text: (b) => `A bad review of ${b.name} went round.`, tone: 'bad', fx: (b) => { b.reputation = clamp(b.reputation - 5); } },
  { text: (b) => `Something expensive broke at ${b.name}.`, tone: 'bad', fx: (b, f) => { b.cash -= Math.round(f.startup * 0.05); b.quality = clamp(b.quality - 4); } },
  { text: (b) => `The local paper ran a kind piece about ${b.name}.`, tone: 'good', fx: (b) => { b.reputation = clamp(b.reputation + 5); } },
  { text: (b) => `A regular of ${b.name} sent three friends, who sent theirs.`, tone: 'good', fx: (b) => { b.reputation = clamp(b.reputation + 3); } },
];

/** One business's year. @returns {string[]} lines for the journal */
function runYear(b) {
  const p = player();
  const c = careerState();
  const t = typeOf(b);
  const f = figures(t, b.countryId, b.city);
  const cty = placeOf(b);
  const lines = [];
  b.years += 1;

  // People: anyone whose own life has taken them elsewhere has left.
  for (const s of [...b.staff]) {
    const n = store.state.npcs[s.id];
    const gone = !n?.alive || (n.life && n.life.job?.employerId !== b.employerId);
    if (n?.alive && b.ownerHours >= 10) n.lastInteractionAge = p.age; // people you see every day do not drift away
    const unhappy = n?.alive && (s.wageK < (s.asked ?? 0.9) - 0.01 || n.meters.relationship < 25 || (b.overdrawn > 0 && rng.chance(0.3)));
    if (gone || (unhappy && rng.chance(0.3)) || rng.chance(0.025)) {
      b.staff = b.staff.filter((x) => x.id !== s.id);
      if (n?.alive) {
        delete n.flags.employeeOf;
        if (n.role === 'colleague') n.flags.title = 'Used to work for you';
        if (n.life?.job?.employerId === b.employerId && !gone) { n.life.lastJob = { careerId: n.life.job.careerId, level: n.life.job.level }; n.life.job = null; }
        lines.push(`${n.firstName} ${n.lastName} left ${b.name}${n.life?.retired ? ' to retire' : unhappy ? ' for better pay elsewhere' : ''}.${s.manager ? ' You have no manager now.' : ''}`);
      }
    }
  }
  const staff = staffOf(b);
  const manager = staff.find((s) => s.manager);

  // What the place can do: the staff, the owner, and whether anyone is steering.
  const own = c.experience[t.track] ?? 0;
  const ownerSkill = clamp(0.65 + own / 20 + (p.stats.intellect - 50) / 250 + (p.hidden.discipline - 50) / 250, 0.5, 1.4);
  const ownerHeads = Math.min(1.3, b.ownerHours / 40) * ownerSkill;
  const skill = (s) => clamp(0.7 + s.npc.meters.intellect / 200 + (p.age - s.since) / 25 + (s.npc.meters.relationship - 50) / 300, 0.6, 1.35);
  const steering = manager ? clamp(0.85 + manager.npc.meters.intellect / 400, 0.85, 1.1) + Math.min(0.1, b.ownerHours / 300) : b.ownerHours >= 40 ? 1 : b.ownerHours >= 25 ? 0.88 : b.ownerHours >= 10 ? 0.7 : 0.4;
  const crowd = b.sites > 1 && !manager ? 0.75 : 1;
  const heads = (staff.reduce((s, x) => s + skill(x), 0) + b.others) * steering * crowd + ownerHeads * 0.9;

  // What custom there is: the name, the price, the times, and luck.
  const price = PRICING[b.pricing];
  const priceFit = b.pricing === 'premium' ? clamp(price.demand + (b.reputation - 55) / 120 + (b.quality - 50) / 200, 0.4, 1.1) : price.demand;
  const rivals = Math.pow(0.8, b.rivals ?? 0);
  const demand = b.sites * (t.solo ? 2.6 : 5) * (0.3 + b.reputation / 62) * priceFit * (1 + phase(b.countryId).hiring * 2) * b.marketing * rivals * (t.celebrity ? starPull(p) : 1) * rng.around(1, 0.15);
  const sold = Math.max(0, Math.min(heads, demand));

  const revenue = Math.round(sold * f.perHead * price.k * (0.9 + b.quality / 500));
  const wages = staff.reduce((s, x) => s + x.wage, 0) + b.others * f.wage;
  const rent = f.rent * b.sites * (t.remote ? 0.5 : 1);
  const supplies = Math.round(revenue * t.cogs);
  const overhead = Math.round(revenue * 0.06);
  const interest = Math.round(b.debt * BUSINESS_LOAN.rate);
  const profit = revenue - wages - rent - supplies - overhead - interest;
  const principal = b.debt > 0 ? Math.min(b.debt, Math.round(b.debt / Math.max(1, b.debtYears))) : 0;
  b.debt -= principal;
  b.debtYears = Math.max(0, b.debtYears - 1);
  // Tax on the profit, where the business is, after earlier losses. Someone working alone, with no partners,
  // is a sole trader: the profit is simply their income, taxed once when it reaches them.
  const soleTrader = !headcount(b) && !b.partners.length;
  const taxed = soleTrader ? { tax: 0, taxable: 0, carry: 0 } : profitTax(profit, b.countryId, b.lossCarry ?? 0);
  b.lossCarry = taxed.carry;
  b.taxPaid = (b.taxPaid ?? 0) + taxed.tax;
  const afterTax = profit - taxed.tax;
  b.cash += afterTax - principal;

  // Now and then something goes badly wrong, whoever is running it: a fire, a lawsuit, the client who was half the work.
  // It comes out of the year's money before the owners take their share, so a good year can absorb it.
  if (rng.chance(0.04)) {
    const hit = Math.round(revenue * (0.3 + rng.next() * 0.5));
    b.cash -= hit;
    b.reputation = clamp(b.reputation - rng.int(3, 10));
    lines.push(rng.pick([`A fire closed ${b.name} for months. The insurance covered less than you hoped: it cost ${fmtMoney(hit, cty)}.`,
      `${b.name} was sued, and lost. It cost ${fmtMoney(hit, cty)}.`, `${b.name} lost the customer who was most of its work, and ${fmtMoney(hit, cty)} with them.`]));
  }
  // What the owners take, from what is left after tax. Never more than is there.
  let drawn = 0;
  if (afterTax > 0 && b.cash > 0) {
    const out = Math.min(b.cash, Math.round(afterTax * DRAWS[b.draw].share));
    drawn = Math.round(out * b.stake);
    b.cash -= out;
    for (const pt of b.partners) { const n = store.state.npcs[pt.id]; if (n?.life) n.life.savings += Math.round(out * pt.stake); }
  }
  b.payout = (b.payoutPaid ? 0 : b.payout) + drawn; // with anything taken out during the year
  b.payoutPaid = b.payout <= 0;
  b.last = { revenue, wages, rent, supplies, overhead, interest, profit, tax: taxed.tax, afterTax, drawn, heads: Math.round(heads * 10) / 10, demand: Math.round(demand * 10) / 10 };

  // The name the place has.
  const stretched = demand > heads * 1.25;
  const idle = heads > demand * 1.4;
  // A name is earned slowly: it moves toward what the place deserves (the work, the service, the price), a fifth of the way a year.
  const deserved = clamp(22 + b.quality * 0.62 + price.rep * 4 + (stretched ? -12 : 6) + (ownerHeads > 0.8 || manager ? 5 : -4));
  b.reputation = Math.round(clamp(b.reputation + (deserved - b.reputation) * 0.2 + rng.int(-2, 2)));
  b.quality = Math.round(clamp(b.quality - (b.quality > 45 ? 1 : 0)));
  b.marketing = 1 + (b.marketing - 1) * 0.4;
  if (rng.chance(0.25)) { const ev = rng.pick(EVENTS); ev.fx(b, f); lines.push(ev.text(b)); }
  // Competition: a business that does well is noticed, and copied. Rivals come and, some of them, go.
  const margin = profit / Math.max(1, revenue);
  if (rng.chance(clamp(0.05 + margin * 0.5 + (b.sites - 1) * 0.03, 0.03, 0.3))) { b.rivals = (b.rivals ?? 0) + 1; lines.push(`A competitor opened near ${b.name}${margin > 0.2 ? ': someone has noticed how well you are doing' : ''}.`); }
  if ((b.rivals ?? 0) > 0 && rng.chance(0.1 * b.rivals)) b.rivals -= 1;
  if (b.ownerHours > 0) c.experience[t.track] = Math.round(((c.experience[t.track] ?? 0) + Math.min(1, b.ownerHours / 40)) * 10) / 10;
  for (const s of staff) s.npc.meters.relationship = clamp(s.npc.meters.relationship + (s.wageK > (s.asked ?? 1) ? 2 : 1) + (profit < 0 ? -2 : 0));
  const e = employer(b.employerId);
  if (e) e.health = Math.round(clamp(50 + (profit / Math.max(1, revenue)) * 150 + (b.cash > 0 ? 10 : -20)));

  lines.unshift(`${b.name}: took ${fmtMoney(revenue, cty)}, ${profit >= 0 ? `made ${fmtMoney(profit, cty)}${taxed.tax ? ` and paid ${fmtMoney(taxed.tax, cty)} in tax on it` : taxed.taxable === 0 && profit > 0 ? ', untaxed: earlier losses were set against it' : ''}` : `lost ${fmtMoney(-profit, cty)}`}.${drawn ? ` You took ${fmtMoney(drawn, cty)} out.` : ''}${stretched ? ' You turned custom away: more staff would pay for themselves.' : idle && headcount(b) ? ' There was not enough work for everyone.' : ''}`);

  // An account below zero cannot go on.
  if (b.cash < 0) {
    b.overdrawn += 1;
    c.stress = clamp(c.stress + 8);
    if (b.overdrawn >= 2) { lines.push(close(b, true).text); return lines; }
    lines.push(`${b.name} is overdrawn by ${fmtMoney(-b.cash, cty)}. Put money in, cut costs, or borrow: another year like this and it closes.`);
  } else b.overdrawn = 0;
  if (b.years === 1 && profit > 0) milestone(`${b.name} turned a profit in its first year.`, 'career');
  return lines;
}

/** A business a relative now owns carries on, in outline. */
function runFamilyYear(b) {
  const n = store.state.npcs[b.ownerNpcId];
  if (!n?.alive) { b.status = 'closed'; note(b, `${b.name} closed.`); const e = employer(b.employerId); if (e) e.closed = store.state.year; return [`${b.name}, which you handed on, has closed its doors.`]; }
  b.years += 1;
  b.reputation = Math.round(clamp(b.reputation + (n.meters.intellect - 50) / 20 + rng.int(-4, 4)));
  if (n.life?.job) n.life.job.salary = Math.max(0, Math.round(n.life.job.salary * (0.97 + b.reputation / 1500)));
  if (b.reputation < 12 && rng.chance(0.4)) {
    b.status = 'closed';
    note(b, `${b.name} closed.`);
    const e = employer(b.employerId); if (e) e.closed = store.state.year;
    if (n.life) n.life.job = null;
    delete n.flags.owns;
    return [`${n.firstName} could not keep ${b.name} going. It has closed.`];
  }
  return rng.chance(0.2) ? [`${n.firstName} says ${b.name} is ${b.reputation >= 60 ? 'doing better than it ever did under you' : b.reputation >= 35 ? 'holding its own' : 'having a hard year'}.`] : [];
}

/** Once a year, before payroll. @returns {string[]} journal lines */
export function tickBusinesses() {
  const lines = [];
  for (const b of businesses()) {
    if (b.status === 'open') lines.push(...runYear(b));
    else if (b.status === 'family') lines.push(...runFamilyYear(b));
    b.candidates = null;
  }
  return lines;
}

/**
 * The owner is moving to another country. A business with a manager carries on
 * without them, and pays out across the border; one without is wound up.
 * @returns {string[]} journal lines
 */
export function onEmigrate(destId = null) {
  const lines = [];
  for (const b of openBusinesses()) {
    if (b.countryId === destId) { lines.push(`You are moving to where ${b.name} is. You can work in it yourself again.`); continue; }
    if (managerOf(b)) { b.ownerHours = 0; lines.push(`${managerOf(b).firstName} will run ${b.name} while you are abroad. What it pays you will be changed into the money of wherever you live.`); }
    else lines.push(close(b).text);
  }
  return lines;
}

/** Hours a week the player's businesses take. */
export const businessHours = (p = player()) => (p.businesses ?? []).filter((b) => b.status === 'open').reduce((s, b) => s + b.ownerHours, 0);

/** What is owed to the owner this year, for payroll. */
export const payouts = (p = player()) => (p.businesses ?? []).filter((b) => b.payout > 0 && !b.payoutPaid).map((b) => ({ source: `biz:${b.id}`, label: `Drawn from ${b.name}`, gross: p === player() ? toOwner(b, b.payout) : b.payout }));
export function markPaid(p = player()) { for (const b of p.businesses ?? []) b.payoutPaid = true; }

/**
 * When the story passes to an heir: a business goes to them if they were
 * named, or are a child of the owner and nobody else was. Owning it does not
 * make them its manager: whoever ran it still does, until they decide.
 * @returns {string[]} what happened, for the heir's journal
 */
export function inherit(oldPlayer, newPlayer, heirNpc, npcs, oldNpcs = {}) {
  const out = [];
  newPlayer.businesses = [];
  for (const b of oldPlayer.businesses ?? []) {
    const mine = (b.status === 'open' && (b.heirId ? b.heirId === heirNpc.id : heirNpc.role === 'child' || heirNpc.role === 'grandchild')) || (b.status === 'family' && b.ownerNpcId === heirNpc.id);
    if (!mine) continue;
    const copy = JSON.parse(JSON.stringify(b));
    const worked = copy.staff.some((s) => s.id === heirNpc.id);
    // The people who work there go on working there: the same people, carried into the new life if the family tree did not bring them.
    copy.staff = copy.staff.filter((s) => s.id !== heirNpc.id && (npcs[s.id] ?? oldNpcs[s.id])?.alive);
    for (const s of copy.staff) npcs[s.id] ??= oldNpcs[s.id];
    copy.others += b.staff.length - copy.staff.length - (worked ? 1 : 0);
    copy.others = Math.max(0, copy.others);
    copy.partners = copy.partners.filter((x) => npcs[x.id]?.alive);
    copy.status = 'open';
    copy.ownerNpcId = null;
    copy.heirId = null;
    copy.ownerHours = b.status === 'family' ? 45 : copy.staff.some((s) => s.manager) ? 0 : 10;
    copy.payout = 0;
    copy.payoutPaid = true;
    copy.acts = null;
    copy.candidates = null;
    copy.history.push({ year: store.state.year, text: `${copy.name} passed to ${newPlayer.firstName} ${newPlayer.lastName}.` });
    newPlayer.businesses.push(copy);
    out.push(b.status === 'family' ? `${copy.name} is yours, as it has been since it was handed to you.` : `${copy.name} is yours now. ${copy.staff.some((s) => s.manager) ? 'Its manager is still running it; what happens next is for you to decide.' : 'Nobody is in charge of it but you.'}`);
  }
  return out;
}

/**
 * What the player's shares in their businesses would fetch, in the money of where they live. Not part of net
 * worth (a business passes to an heir whole), but counted when what a couple has is divided (engine/romance.js).
 */
export const stakesWorth = (p = player()) => Math.round(openBusinesses(p).reduce((s, b) => s + toOwner(b, valuation(b) * b.stake), 0));

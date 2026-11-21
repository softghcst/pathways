// Tax schedules and health-care models: how a country's headline numbers
// turn into what one person actually pays. Shapes are in data/systems.js.
import { held } from './citizenship.js';
import { localMoney, fmtMoney, theCountry } from '../util.js';
import { player, country, log } from '../state.js';
import { COUNTRIES } from '../data/countries.js';
import { CAREER_BY_ID } from '../data/careers.js';
import { TAX_SHAPES, TAX_SHAPE_OF, TAX_TOP, HEALTH_MODELS, HEALTH_MODEL_OF, VISA_HEALTH } from '../data/systems.js';
import { residency } from './citizenship.js';
import { taxShift } from './policy.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
/** The wage the game treats as typical in a country, in its own money. */
export const typicalWage = (c = country()) => localMoney(30000 * (c.living?.wageK ?? 1), c);

// ---------- Income tax ----------

/** The headline rate today: the country's own, moved by what its government has done since. */
export const headlineRate = (c = country()) => Math.min(0.6, Math.max(0, c.incomeTax + taxShift(c.id)));
export const taxShapeOf = (c = country()) => TAX_SHAPES[c.incomeTax <= 0 ? 'none' : TAX_SHAPE_OF[c.id] ?? 'moderate'];

/**
 * Tax on a year's income, band by band.
 * @returns {{tax:number, effective:number, marginal:number, allowance:number, bands:{from:number, to:number, rate:number, taxed:number, tax:number}[]}}
 */
export function taxBreakdown(gross, c = country()) {
  const shape = taxShapeOf(c);
  const T = typicalWage(c);
  const rate = headlineRate(c);
  const allowance = Math.round(shape.allowance * T);
  const bands = [];
  let from = allowance;
  let tax = 0;
  let marginal = 0;
  const bandRates = [];
  // Where the top rate is known, the last band uses it and no band goes above it (TAX_TOP in data/systems.js).
  const top = shape.bands.length > 1 ? TAX_TOP[c.id] : undefined;
  let prev = 0;
  shape.bands.forEach(([upTo, k], i) => {
    const last = i === shape.bands.length - 1;
    let r = Math.min(shape.cap, rate * k);
    if (top != null) r = last ? Math.max(prev, Math.min(0.65, top)) : Math.min(r, top);
    prev = r;
    bandRates.push(r);
  });
  for (const [i, [upTo]] of shape.bands.entries()) {
    const to = upTo === Infinity ? Infinity : Math.round(upTo * T);
    const r = bandRates[i];
    const taxed = Math.max(0, Math.min(gross, to) - from);
    if (taxed > 0 || !bands.length) { bands.push({ from, to, rate: r, taxed, tax: Math.round(taxed * r) }); tax += taxed * r; if (taxed > 0) marginal = r; }
    from = to;
    if (gross <= to) break;
  }
  tax = Math.round(tax);
  return { tax, effective: gross > 0 ? tax / gross : 0, marginal, allowance, bands };
}

/** One line about how a country taxes income, for a list. */
export function taxLine(c = country()) {
  const shape = taxShapeOf(c);
  const rate = Math.round(headlineRate(c) * 100);
  if (shape === TAX_SHAPES.none) return 'No income tax';
  if (shape === TAX_SHAPES.flat) return `${rate}% flat`;
  const top = Math.round(taxBreakdown(typicalWage(c) * 200, c).marginal * 100);
  return `About ${Math.round(taxBreakdown(typicalWage(c), c).effective * 100)}%, up to ${top}%`;
}

// ---------- Health care ----------

export const healthModelOf = (c = country()) => HEALTH_MODELS[HEALTH_MODEL_OF[c.id] ?? (c.freeHealthcare ? 'public' : 'pocket')];

/**
 * How the player stands with the health system where they live.
 * @returns {{model:object, covered:boolean, share:number, how:string, premium:number, canBuy:boolean, bought:boolean}}
 *   share: the part of a bill they pay · premium: what cover costs them a year
 */
export function cover(p = player()) {
  const c = COUNTRIES[p.countryId];
  const m = healthModelOf(c);
  const job = CAREER_BY_ID[p.career.careerId];
  const working = !!job && job.type !== 'freelance';
  const bought = p.flags.healthCover === c.id;
  const price = Math.round(m.premium * typicalWage(c));
  if (p.legal.incarceration) return { model: m, covered: true, share: 0, how: 'The prison doctor costs nothing.', premium: 0, canBuy: false, bought: false };
  if (p.age < 18) return { model: m, covered: true, share: Math.min(m.share, 0.2), how: 'Covered as a child.', premium: 0, canBuy: false, bought: false };
  // Where care is for everyone, a temporary visa can change the terms (data/systems.js VISA_HEALTH).
  const visa = m.covers === 'everyone' && m.share < 1 ? VISA_HEALTH[residency(p).status] : null;
  if (visa?.kind === 'charge') {
    const charge = Math.round(visa.rate * typicalWage(c));
    if (p.flags.visaHealthUnpaid === c.id) return { model: m, covered: false, share: 1, how: `The health charge on your visa is unpaid: you pay the whole bill until it is paid (${fmtMoney(charge, c)} a year).`, premium: charge, visaCharge: true, canBuy: false, bought: false };
    return { model: m, covered: true, share: m.share, how: `On your visa you pay a yearly health charge of ${fmtMoney(charge, c)}, and are covered like a resident.`, premium: charge, visaCharge: true, canBuy: false, bought: false };
  }
  if (visa?.kind === 'private') {
    const own = Math.round(visa.rate * typicalWage(c));
    if (bought) return { model: m, covered: true, share: m.share, how: 'Your visa requires private cover, and you have it.', premium: own, canBuy: true, bought: true };
    return { model: m, covered: false, share: 1, how: 'Your visa does not give you public care: without private cover you pay the whole bill.', premium: 0, canBuy: true, bought: false, price: own };
  }
  if (m.covers === 'everyone') return { model: m, covered: true, share: m.share, how: m.line, premium: p.age >= 18 && m.premium ? price : 0, canBuy: false, bought: false };
  if (working) return { model: m, covered: true, share: m.share, how: 'Your job brings health cover with it.', premium: 0, canBuy: false, bought };
  // Where cover comes through an employer, it is for expatriates: the country's own citizens have a national scheme.
  if (m.covers === 'workers' && held(p).includes(c.place?.nationalityOf ?? c.id)) return { model: m, covered: true, share: m.share, how: 'As a citizen you are covered by the national scheme.', premium: 0, canBuy: false, bought: false };
  if (m.covers === 'buyers' && bought) return { model: m, covered: true, share: m.share, how: 'You pay for your own cover.', premium: price, canBuy: true, bought: true };
  return { model: m, covered: false, share: m.uncovered, how: m.covers === 'buyers' ? 'You have no cover: you pay the whole bill.' : 'With no full-time job you have no cover: you pay the whole bill.',
    premium: 0, canBuy: m.covers === 'buyers', bought: false, price };
}

/** Takes out, or gives up, private cover. It is for one country: it lapses on moving abroad. */
export function setCover(on) {
  const p = player();
  const c = country();
  const k = cover(p);
  if (!k.canBuy) return result(false, 'There is no cover to buy here.', 'neutral');
  if (on) {
    const price = k.price ?? Math.round(k.model.premium * typicalWage(c));
    if (p.finance.cash < price) return result(false, `A year of cover costs ${fmtMoney(price, c)}. You do not have it.`, 'neutral');
    p.finance.cash -= price;
    p.flags.healthCover = c.id;
    p.flags.coverPaidAge = p.age;
    const text = `You took out health insurance: ${fmtMoney(price, c)} a year. You now pay ${Math.round(k.model.share * 100)}% of a bill, not all of it.`;
    log(text, 'system', 'good');
    return result(true, text);
  }
  delete p.flags.healthCover;
  const text = 'You canceled your health insurance. From now on you pay the whole bill.';
  log(text, 'system', 'neutral');
  return result(true, text, 'neutral');
}

/** Yearly: contributions and premiums. Cover that cannot be paid for lapses. */
export function tickCover() {
  const p = player();
  const c = country();
  if (p.flags.healthCover && p.flags.healthCover !== c.id) delete p.flags.healthCover; // it was for another country
  if (p.age < 18 || p.legal.incarceration) return;
  const k = cover(p);
  if (!k.premium || p.flags.coverPaidAge === p.age) return;
  if (k.visaCharge) {
    // The visa health charge is due whether or not they earn.
    if (p.finance.cash >= k.premium) { p.finance.cash -= k.premium; delete p.flags.visaHealthUnpaid; log(`You paid ${fmtMoney(k.premium, c)} in the yearly health charge for visa holders.`); }
    else { p.flags.visaHealthUnpaid = c.id; log('You could not pay the health charge on your visa this year. Care will cost you in full until you can.', 'system', 'bad'); }
    p.flags.coverPaidAge = p.age;
    return;
  }
  if (k.model.covers === 'everyone' && !k.bought) {
    // A contribution taken with the rest: people with no income are carried.
    const earns = (p.career.salary || 0) + (p.career.partTime?.salary || 0) + (p.career.retired ? p.career.pensionPerYear : 0) + (p.flags.statePension ?? 0) > 0;
    if (!earns) return;
    p.finance.cash -= k.premium;
    log(`You paid ${fmtMoney(k.premium, c)} in health insurance contributions.`);
    return;
  }
  if (p.finance.cash >= k.premium) { p.finance.cash -= k.premium; log(`You paid ${fmtMoney(k.premium, c)} for your health insurance.`); return; }
  delete p.flags.healthCover;
  log(`You could not pay for your health insurance, and it lapsed. In ${theCountry(c.name)} that means paying the whole bill.`, 'system', 'bad');
}

/** One line about how health care works somewhere, for a list. */
export const healthLine = (c = country()) => { const m = healthModelOf(c); return `${m.name}: ${m.line.charAt(0).toLowerCase()}${m.line.slice(1)}`; };

/** What health care will look like on arriving somewhere with a given status, in a sentence (for the moving checklist). */
export function healthOnArrival(countryId, status) {
  const c = COUNTRIES[countryId];
  const m = healthModelOf(c);
  const visa = m.covers === 'everyone' && m.share < 1 ? VISA_HEALTH[status] : null;
  if (visa?.kind === 'charge') return `${m.name}: on this visa, a yearly health charge of ${fmtMoney(Math.round(visa.rate * typicalWage(c)), c)}, then covered like a resident.`;
  if (visa?.kind === 'private') return `${m.name}: this visa gives no public care. Private cover costs about ${fmtMoney(Math.round(visa.rate * typicalWage(c)), c)} a year.`;
  return `${m.name}: ${m.line.charAt(0).toLowerCase()}${m.line.slice(1)}`;
}

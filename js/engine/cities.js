// Cities that differ: what a home costs, what work pays, which region's law
// applies, and moving between them without leaving the country.
import { recordEvent } from './chronicle.js';
import { syncNpcPlaces } from './globalLife.js';
import { rng } from '../rng.js';
import { clamp, localMoney, fmtMoney } from '../util.js';
import { store, player, country, log } from '../state.js';
import { COUNTRIES } from '../data/countries.js';
import { CAREER_BY_ID } from '../data/careers.js';
import { quitCareer } from './career.js';
import { REGION_RULES } from '../data/rules.js';
import { SERVICES } from '../data/cities.js';
import { regionOf, CITY_ROWS, GENERIC, REGION_WORD, MOVE_COST, TRANSFER_CHANCE } from '../data/cities.js';

/** Whether two regions of a country have any law that differs. */
const lawDiffers = (countryId, a, b) => JSON.stringify(REGION_RULES[`${countryId}/${a}`] ?? {}) !== JSON.stringify(REGION_RULES[`${countryId}/${b}`] ?? {});
const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
/** A city against the country as a whole, in a short label: "Expensive Homes", "Higher Pay". */
const label = (k, [veryHi, hi, avg, lo, veryLo]) => (k >= 1.5 ? veryHi : k >= 1.12 ? hi : k <= 0.75 ? veryLo : k <= 0.92 ? lo : avg);
const HOMES = ['Very Expensive Homes', 'Expensive Homes', 'Average Homes', 'Cheaper Homes', 'Very Cheap Homes'];
const PAY = ['Very High Pay', 'Higher Pay', 'Average Pay', 'Lower Pay', 'Very Low Pay'];

/**
 * What is known about a city. A city the game has no row for gets a generic profile.
 * @returns {{name, countryId, region:?string, regionId:?string, regionWord:?string, kind:'capital'|'largest'|'city', housing:number, pay:number, estimated:boolean, housingWord:string, payWord:string}}
 */
export function cityOf(countryId, name) {
  const c = COUNTRIES[countryId];
  const row = CITY_ROWS[countryId]?.[name];
  const capital = c?.place?.capital === name;
  const single = (c?.cities.length ?? 0) <= 1;
  const kind = capital ? 'capital' : c?.cities[0] === name ? 'largest' : 'city';
  const g = single || !c?.cities.includes(name) ? { housing: 1, pay: 1 } : GENERIC[kind];
  const housing = row?.housing ?? g.housing;
  const pay = row?.pay ?? g.pay;
  const svc = SERVICES[single || !c?.cities.includes(name) ? 'only' : kind];
  return { name, countryId, region: row?.region ?? null, regionId: row?.regionId ?? null, regionWord: row ? REGION_WORD[countryId] : null, kind, housing, pay,
    estimated: !row, housingWord: label(housing, HOMES), payWord: label(pay, PAY),
    safety: svc.safety, schools: svc.schools, health: svc.health,
    servicesLine: [svc.health >= 5 ? 'major hospitals' : svc.health < 0 ? 'fewer specialist hospitals' : '', svc.safety > 0 ? 'safer than average' : svc.safety < 0 ? 'more crime than average' : ''].filter(Boolean).join(', ') };
}

/** Every city of a country. */
export const citiesOf = (countryId) => (COUNTRIES[countryId]?.cities ?? []).map((name) => cityOf(countryId, name));
/** Where the player lives. */
export const hereCity = (p = player()) => cityOf(p.countryId, p.city);
/** The region whose law applies to someone living in this city, if the game knows one. */
export { regionOf };
/** Multipliers against the national level, for where the player lives (or a named city of that country). */
export const housingK = (city = player().city, countryId = player().countryId) => cityOf(countryId, city).housing;
export const payK = (city = player().city, countryId = player().countryId) => cityOf(countryId, city).pay;

/** One line about a city, for a list. */
export function cityLine(countryId, name) {
  const k = cityOf(countryId, name);
  return [k.kind === 'capital' ? 'Capital' : '', k.housingWord, k.payWord].filter(Boolean).join(' · ');
}

// ---------- Moving within the country ----------

export const moveCost = () => localMoney(MOVE_COST, country());

/** Cities the player could move to, with how each compares to where they are. */
export function moveOptions() {
  const p = player();
  const now = hereCity(p);
  const pct = (x) => `${x >= 0 ? '+' : '−'}${Math.abs(Math.round(x * 100))}%`;
  return citiesOf(p.countryId).filter((k) => k.name !== p.city).map((k) => ({ ...k, line: cityLine(p.countryId, k.name),
    versus: `Against ${p.city}: homes ${pct(k.housing / now.housing - 1)}, pay ${pct(k.pay / now.pay - 1)}.`,
    ownsHome: p.assets.some((a) => a.kind === 'property' && a.countryId === p.countryId && a.city === k.name && !a.tenant),
    lawDiffers: lawDiffers(p.countryId, k.regionId, now.regionId) }));
}

/** Why the player cannot move city just now, or ''. */
export function moveBlock() {
  const p = player();
  if (p.age < 18) return 'You live where your family lives.';
  if (p.legal.incarceration) return 'Not from a cell.';
  if (p.legal.pending) return 'Not with a court case hanging over you.';
  if (p.royal && !p.royal.waiting && ['monarch', 'heir'].includes(p.royal.rank)) return 'The court lives where the court lives.';
  if (p.politics && ['council', 'mayor', 'region'].includes(p.politics.officeId)) return `You hold office in ${p.city}. Leave it first.`;
  if (p.education.enrolled && !p.education.partTime) return 'You are in the middle of a course here.';
  if ((COUNTRIES[p.countryId]?.cities.length ?? 0) < 2) return 'There is nowhere else in the country to move to.';
  return '';
}

/**
 * Moves to another city in the same country. A full-time job goes with the
 * player if the employer has somewhere to put them; otherwise it ends.
 * Property stays where it is.
 */
export function relocate(cityName) {
  const p = player();
  const c = country();
  const block = moveBlock();
  if (block) return result(false, block, 'neutral');
  if (!c.cities.includes(cityName) || cityName === p.city) return result(false, 'You cannot move there.', 'neutral');
  const cost = moveCost();
  if (p.finance.cash < cost) return result(false, `Moving costs ${fmtMoney(cost, c)}. You do not have it.`, 'neutral');
  const from = hereCity(p);
  const to = cityOf(p.countryId, cityName);
  p.finance.cash -= cost;

  let work = '';
  let quit = false;
  const job = p.career;
  if (job.careerId && !job.military && job.salary != null) {
    const freelance = CAREER_BY_ID[job.careerId]?.type === 'freelance';
    if (freelance || rng.chance(TRANSFER_CHANCE)) {
      const before = job.salary;
      job.salary = Math.round(job.salary * to.pay / from.pay);
      work = freelance ? 'Your work came with you. ' : `Your employer found you a desk there${job.salary !== before ? `, at ${fmtMoney(job.salary, c)} a year, the going rate` : ''}. `;
    } else {
      quitCareer();
      quit = true;
      work = 'Your employer had nowhere to send you, so you handed in your notice. ';
    }
  }
  if (job.partTime || job.sides?.length) { job.partTime = null; job.sides = []; work += 'You gave up your part-time work. '; }

  // Home: a house in the old city is no longer where you live.
  const home = p.assets.find((a) => a.id === p.homeId);
  if (home && (home.city ?? p.city) !== cityName) p.homeId = null;
  const mine = p.assets.find((a) => a.kind === 'property' && a.countryId === p.countryId && a.city === cityName && !a.tenant);

  // The record of where they have lived. Papers do not change: it is the same country.
  const year = store.state.year;
  const list = (p.locations ??= [{ countryId: p.birthCountryId, city: p.birthCity ?? null, from: p.birthYear ?? year - p.age, reason: 'born' }]);
  const last = list[list.length - 1];
  if (last && last.to == null) { last.to = year; if (home && !(last.homes ??= []).includes(home.id)) last.homes.push(home.id); }
  const ev = recordEvent({ key: `move:city:${p.id}:${year}:${cityName}`, type: 'relocation', international: false, title: `Moved to ${cityName}`, text: `From ${from.name}.`,
    place: { countryId: p.countryId, city: cityName }, from: { countryId: p.countryId, city: from.name }, significance: 2, privacy: 'family', propertyId: home?.id ?? null });
  list.push({ countryId: p.countryId, city: cityName, from: year, reason: 'moved within the country', eventId: ev.id, homes: [] });

  p.city = cityName;
  p.flags.livesWithParents = false;
  syncNpcPlaces(p);
  if (store.state.market) store.state.market.listings = null; // a different market
  p.stats.mood = clamp(p.stats.mood + 2);
  const law = lawDiffers(p.countryId, to.regionId, from.regionId) ? `Some laws are different in ${to.region ?? cityName}. ` : '';
  const text = `You moved from ${from.name} to ${cityName}${to.region && to.region !== cityName ? `, ${to.region}` : ''}. ${work}`
    + `${mine ? 'You own a home here and can move straight in. ' : home && !p.homeId ? `Your home in ${from.name} is still yours: let it, sell it, or keep it. ` : ''}`
    + `${to.housingWord}, ${to.payWord}. ${law}It cost ${fmtMoney(cost, c)}.`;
  log(text, 'system', 'good');
  return { ...result(true, text), quit };
}

/** Where the player lives: the country's scores, moved by the city. Never outside 0-100. */
export const localScore = (key, L, p = player()) => Math.max(0, Math.min(100, (L[key] ?? 50) + (cityOf(p.countryId, p.city)[{ safety: 'safety', health: 'health', schools: 'schools' }[key]] ?? 0)));

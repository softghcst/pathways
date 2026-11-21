// Trips: planning, booking, going, doing things there, and coming home.
//
//   p.travel.trips       every trip planned, booked, taken or canceled
//   p.travel.whereabouts where the player physically is while away (null: at home)
//   p.travel.earned      achievements, with the year each was earned
//
// A trip moves through: draft -> confirmed -> in_progress -> completed, or
// canceled / disrupted. Opening the planner costs nothing; money changes
// hands only when a trip is confirmed, once per booking (engine/chronicle.js
// ledger). A trip is completed once. Taking a trip never changes where
// anyone lives: the primary residence is p.countryId / p.city, untouched here.
//
// Time. The world clock moves a year at a time (yearProcessor). Inside a
// year, state.today only moves forward, when a journey takes someone
// somewhere and back; it returns to 1 January when the year turns. A trip
// booked for this year and not taken by the year's end is taken as planned,
// in that year, before the year turns. Nobody ages on a trip.
import { rng } from '../rng.js';
import { clamp, localMoney, fmtMoney, theCountry, uid } from '../util.js';
import { store, player, country, livingNpcs, log, milestone } from '../state.js';
import { COUNTRIES, COUNTRY_LIST } from '../data/countries.js';
import { CABINS } from '../data/activities.js';
import { MODES, MODE_BY_ID, STAYS, STAY_BY_ID, ACTIVITIES, ACTIVITY_BY_ID, TRIP_TYPES, TRIP_TYPE_BY_ID, REFUNDS, INSURANCE_RATE, DAILY, CABIN_FARE, HUBS, NONSTOP_KM } from '../data/travel.js';
import { SKILL_BY_ID } from '../data/skills.js';
import { distanceKm, overland, coastal, regionOf, localTime, instantAt, season, climate, placeName, capitalCity, placeId, parsePlace } from './geo.js';
import { today, addDays, daysBetween, yearOf, readiness, addStay, ensureOwnPassport, personById, entryRule, needsAuthorization, eraOf } from './documents.js';
import { charge, refund, recordEvent, hasEvent, archiveIdOf, events } from './chronicle.js';
import { languagesOf, speaks } from './languages.js';
import { remember } from './conditions.js';
import { stamp } from './emigration.js';
import { makeNpc } from './npcFactory.js';
import { roleLabel } from './relationships.js';

const result = (ok, text, tone = ok ? 'good' : 'bad', extra = {}) => ({ ok, text, tone, ...extra });
const nameOf = (id) => theCountry(COUNTRIES[id]?.name ?? id);
const list = (names) => names.join(', ').replace(/, ([^,]*)$/, ' and $1');

export function travelState(p = player()) {
  p.travel ??= { trips: [], whereabouts: null, earned: {} };
  p.travel.earned ??= {};
  return p.travel;
}
export const tripById = (id, p = player()) => travelState(p).trips.find((t) => t.id === id) ?? null;
const home = (p = player()) => ({ countryId: p.countryId, city: p.city ?? capitalCity(p.countryId) });
const year = () => store.state.year;
const LIVE = ['confirmed', 'in_progress'];

// ---------- Kinds of trip ----------

const recentlyMarried = (p) => livingNpcs().find((n) => n.role === 'spouse' && p.age - (n.marriedAtAge ?? p.age) <= 1 && !hasEvent(`honeymoon:${n.id}`));
const kinAbroad = (destId) => livingNpcs().filter((n) => n.role !== 'pet' && n.flags.abroad === destId);

/** Why a kind of trip is not open, or '' if it is. Checked against the real state of the life. */
export function typeBlock(typeId, destId = null, p = player()) {
  const t = TRIP_TYPE_BY_ID[typeId];
  if (!t) return 'There is no such trip.';
  if (t.from && year() < t.from) return 'Not in this period.';
  if (t.minAge && p.age < t.minAge) return `From age ${t.minAge}.`;
  if (t.maxAge && p.age > t.maxAge) return `Up to age ${t.maxAge}.`;
  switch (t.needs) {
    case 'family': return livingNpcs().some((n) => ['spouse', 'partner', 'child', 'parent', 'sibling'].includes(n.role)) ? '' : 'You need family to take.';
    case 'partner': return livingNpcs().some((n) => ['spouse', 'partner'].includes(n.role)) ? '' : 'You need a partner to take.';
    case 'newlywed': return recentlyMarried(p) ? '' : 'For a wedding in the last year, and only once.';
    case 'married': return livingNpcs().some((n) => n.role === 'spouse' && p.age - (n.marriedAtAge ?? p.age) >= 1) ? '' : 'For a marriage of at least a year.';
    case 'kinThere': return destId && kinAbroad(destId).length ? '' : destId ? 'Nobody you know lives there.' : 'Family or friends who live elsewhere.';
    case 'job': return p.career.careerId && !p.career.retired ? '' : 'You need a job that would send you.';
    case 'professional': return p.career.careerId && (p.career.level ?? 0) >= 1 ? '' : 'For people a few years into a career.';
    case 'offer': return p.flags.sponsor && (!destId || p.flags.sponsor === destId) ? '' : 'You need an interview offered by an employer abroad.';
    case 'language': return destId && !languagesOf(destId).length ? 'That place has no language of its own for you to learn.' : '';
    case 'university': return p.education.enrolled && ['university', 'graduate', 'medical', 'law', 'doctorate'].includes(p.education.stage) ? '' : 'You must be enrolled in college.';
    default: return '';
  }
}
export const tripTypes = (destId = null) => TRIP_TYPES.map((t) => ({ ...t, why: typeBlock(t.id, destId) }));

// ---------- Discover ----------

/** What a place offers, for filters and cards. Read from the world's data, never invented. */
function tagsOf(destId) {
  const c = COUNTRIES[destId];
  const tags = new Set(['culture', 'history', 'cities']);
  if (coastal(destId)) tags.add('beach');
  if (regionOf(destId) === 'Africa' || ['nz', 'au', 'ca', 'no', 'cl', 'ar', 'np', 'mn', 'pe', 'ec', 'cr', 'ch', 'at', 'fi', 'se', 'ge', 'bo', 'ws', 'pg', 'gy', 'bz'].includes(destId)) tags.add('nature');
  if ((c.living?.cost ?? 1) < 0.6) tags.add('budget');
  if ((c.living?.safety ?? 50) >= 60) tags.add('family');
  if (Object.values(store.state.universities ?? {}).some((u) => u.countryId === destId) || (c.living?.infra ?? 50) >= 70) tags.add('education');
  tags.add('romantic');
  if ((c.living?.safety ?? 50) < 45 || regionOf(destId) === 'Africa' || ['nz', 'np', 'pe', 'mn', 'kz', 'cl', 'ar'].includes(destId)) tags.add('adventure');
  return tags;
}

/**
 * Places to go, with what getting in would ask of the player and a rough cost.
 * @param {string} filter  a FILTERS id, or '' for all
 */
export function discover(filter = '', p = player()) {
  const from = home(p);
  const here = country();
  return COUNTRY_LIST.map((c) => {
    const city = c.id === from.countryId ? c.cities.find((x) => x !== from.city) ?? null : capitalCity(c.id);
    if (!city) return null;
    const km = distanceKm(from, { countryId: c.id, city }) ?? 0;
    const tags = tagsOf(c.id);
    if (c.id === from.countryId) tags.add('nearby');
    else { tags.add('international'); if (km < 1500 && overland(from.countryId, c.id, year())) tags.add('nearby'); }
    const rule = c.id === from.countryId ? null : entryRule(p, c.id, 'visit', year(), 7);
    const week = estimate({ origin: from, destination: { countryId: c.id, city }, nights: 7, people: 1 });
    return { id: c.id, city, name: c.name, flag: c.flag, km, tags: [...tags], climate: climate(c.id, city), cost: week, costWord: fmtMoney(week, here),
      entry: rule ? rule.name : 'No border to cross', entryKind: rule?.kind ?? 'domestic', kin: kinAbroad(c.id).map((n) => n.firstName),
      reachable: modesFor(from, { countryId: c.id, city }, year()).length > 0 };
  }).filter(Boolean).filter((d) => !filter || d.tags.includes(filter)).sort((a, b) => b.kin.length - a.kin.length || a.km - b.km);
}

/** A place's detail page: overview, how to get there, where to stay, what to do, what the border asks. */
export function destination(destId, city = capitalCity(destId), p = player()) {
  const c = COUNTRIES[destId];
  const from = home(p);
  const to = { countryId: destId, city };
  const km = distanceKm(from, to);
  const month = Number(today().slice(5, 7));
  return {
    id: destId, city, name: c.name, flag: c.flag, cities: c.cities, km, climate: climate(destId, city), season: season(destId, month, city),
    languages: COUNTRIES[destId].place?.languages ?? [], currency: c.currency.code,
    modes: modesFor(from, to, year()).map((m) => ({ id: m.id, name: m.name, hours: journey(from, to, m, today(), 'economy').hours })),
    stays: STAYS.filter((s) => stayOpen(s, to, p)).map((s) => s.name),
    activities: ACTIVITIES.filter((a) => activityOpen(a, to, month, p)).map((a) => a.name),
    entry: destId === p.countryId ? null : entryRule(p, destId, 'visit', year(), 7),
    weekCost: estimate({ origin: from, destination: to, nights: 7, people: 1 }),
    kin: kinAbroad(destId).map((n) => ({ id: n.id, name: `${n.firstName} ${n.lastName}` })),
  };
}

// ---------- Getting there ----------

/** The ways to travel between two places in a year. */
export function modesFor(from, to, yr, opts = {}) {
  const km = distanceKm(from, to);
  if (km == null) return [];
  const land = overland(from.countryId, to.countryId, yr);
  return MODES.filter((m) => {
    if (yr < m.from || yr > (m.to ?? Infinity)) return false;
    if (m.cruise && !opts.cruise) return false;
    if (opts.cruise) return !!m.cruise && coastal(from.countryId) && coastal(to.countryId);
    if (m.over === 'land') return land && km <= (m.maxKm ?? Infinity);
    if (m.over === 'short_sea') return !land && km <= 1500 && coastal(from.countryId) && coastal(to.countryId);
    if (m.over === 'sea') return coastal(from.countryId) && coastal(to.countryId) && !land;
    if (m.over === 'air') return km >= 150;
    return false;
  });
}

const fareFor = (m, km, cabin) => (m.base + m.perKm * km) * (m.cabins ? CABIN_FARE[cabin] ?? 1 : 1);

/**
 * The legs of a one-way journey, with distances, hours, local departure and
 * arrival times, and the fare per traveler (base units). A long flight changes
 * planes at a hub; a slow journey stops overnight on the way.
 */
export function journey(from, to, m, date, cabin = 'economy') {
  const km = distanceKm(from, to) ?? 0;
  const stops = [];
  if (m.over === 'air' && (km > NONSTOP_KM || (m.stopsEvery && km > m.stopsEvery))) {
    // Change planes where the detour is smallest.
    const best = HUBS.filter(([c, city]) => !(c === from.countryId && city === from.city) && !(c === to.countryId && city === to.city))
      .map(([countryId, city]) => ({ countryId, city, d: (distanceKm(from, { countryId, city }) ?? 1e9) + (distanceKm({ countryId, city }, to) ?? 1e9) }))
      .sort((a, b) => a.d - b.d)[0];
    if (best && best.d < km * 1.35) stops.push({ countryId: best.countryId, city: best.city });
  }
  const points = [from, ...stops, to];
  const legs = [];
  let t = instantAt(date, m.over === 'air' ? '09:30' : '08:00', from.countryId);
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const d = distanceKm(a, b) ?? 0;
    const moving = d / m.kmh;
    // Hours on the road: moving time, plus nights stopped on the way for modes that do not travel at night.
    const hours = m.overhead / (points.length - 1) + moving + (m.hoursPerDay < 24 ? Math.max(0, Math.ceil(moving / m.hoursPerDay) - 1) * (24 - m.hoursPerDay) : 0);
    if (i > 0) t += 2 * 3600e3; // a change of planes
    const dep = localTime(t, a.countryId);
    t += hours * 3600e3;
    const arr = localTime(t, b.countryId);
    legs.push({ from: a, to: b, mode: m.id, km: d, hours: Math.round(hours * 10) / 10, depart: dep, arrive: arr, fare: fareFor(m, d, cabin) / (points.length - 1) * (points.length > 2 ? 1.1 : 1) });
  }
  const hours = legs.reduce((s, l) => s + l.hours, 0) + (legs.length - 1) * 2;
  return { legs, km, hours: Math.round(hours * 10) / 10, arriveDate: legs[legs.length - 1].arrive.date, fare: legs.reduce((s, l) => s + l.fare, 0) };
}

// ---------- Where to stay, and what to do ----------

function stayOpen(s, to, p = player()) {
  const yr = year();
  if (s.from && yr < s.from) return false;
  if (s.to && yr > s.to) return false;
  if (s.kin) return kinAbroad(to.countryId).length > 0 || (to.countryId === p.countryId && livingNpcs().some((n) => ['parent', 'sibling', 'child', 'grandparent'].includes(n.role) && !n.flags.abroad && !p.flags.livesWithParents && p.city !== to.city));
  if (s.own) return p.assets.some((a) => a.kind === 'property' && (a.countryId ?? p.countryId) === to.countryId && !a.tenant && (a.city ?? null) === to.city);
  if (s.study) return false;
  return true;
}
export const stayOptions = (trip) => STAYS.filter((s) => stayOpen(s, trip.destination) || (s.study && trip.type === 'semester'));

const FESTIVAL_MONTHS = (destId) => { let h = 0; for (const ch of destId) h = (h * 31 + ch.charCodeAt(0)) % 997; return [1 + (h % 12), 1 + ((h + 5) % 12)]; };
function activityOpen(a, to, month, p = player()) {
  const yr = year();
  if (a.from && yr < a.from) return false;
  if (a.needs === 'coast' && !coastal(to.countryId)) return false;
  if (a.needs === 'kin' && !kinAbroad(to.countryId).length && to.countryId !== p.countryId) return false;
  if (a.needs === 'language' && !languagesOf(to.countryId).some((l) => speaks(to.countryId, p) == null || speaks(to.countryId, p) < 85) ) return false;
  if (a.region && regionOf(to.countryId) !== a.region) return false;
  if (a.seasonal && !FESTIVAL_MONTHS(to.countryId).some((m) => Math.abs(m - month) <= 1)) return false;
  return true;
}
/** Activities on offer at a trip's destination, in its month, with why each would mean more to this traveler. */
export function activityOptions(trip, p = player()) {
  const month = Number(trip.depart.slice(5, 7));
  return ACTIVITIES.filter((a) => activityOpen(a, trip.destination, month, p)).map((a) => ({ ...a, liked: likes(a, p), costLocal: localMoney(a.cost * costK(trip.destination.countryId), country()) }));
}
/** Whether an activity touches something the person cares about: a talent, a skill they practice. */
function likes(a, p) {
  if (!a.interest) return false;
  const keys = Array.isArray(a.interest) ? a.interest : [a.interest];
  return keys.some((k) => (p.talents?.[k] ?? 0) >= 60 || (p.skills?.[k] ?? 0) >= 25 || (k === 'intellect' && p.stats.intellect >= 70));
}
const costK = (destId) => COUNTRIES[destId]?.living?.cost ?? 1;

// ---------- Planning ----------

/** Starts a plan. Nothing is paid until it is confirmed. */
export function startPlan(typeId = 'vacation', p = player()) {
  const t = travelState(p);
  const from = home(p);
  const start = addDays(today(), 30) > `${year()}-12-20` ? `${year() + 1}-03-01` : addDays(today(), 30);
  const trip = { id: uid('trip'), type: typeId, status: 'draft', createdYear: year(), organizerId: p.id,
    origin: from, destination: null, depart: start, ret: addDays(start, 7),
    travelers: [{ id: p.id, status: 'organizer', pays: 'self' }], mode: null, cabin: 'economy', stay: null, activities: [], done: [],
    insurance: false, payment: 'organizer', bookings: [], events: [], notes: [] };
  t.trips.push(trip);
  return trip;
}

/** Changes a plan still in draft. Unknown keys are ignored. */
export function updatePlan(id, changes, p = player()) {
  const trip = tripById(id, p);
  if (!trip || trip.status !== 'draft') return result(false, 'Only a plan not yet booked can be changed.', 'neutral');
  if (changes.type && TRIP_TYPE_BY_ID[changes.type]) trip.type = changes.type;
  if (changes.destination) {
    const { countryId, city } = changes.destination;
    if (!COUNTRIES[countryId] || (city && !COUNTRIES[countryId].cities.includes(city))) return result(false, 'There is no such place.', 'neutral');
    trip.destination = { countryId, city: city ?? capitalCity(countryId) };
    trip.mode = null; trip.stay = null; trip.activities = [];
  }
  if (changes.depart) trip.depart = changes.depart;
  if (changes.ret) trip.ret = changes.ret;
  if (changes.nights != null) trip.ret = addDays(trip.depart, changes.nights);
  if (changes.mode !== undefined) trip.mode = changes.mode;
  if (changes.cabin) trip.cabin = changes.cabin;
  if (changes.stay !== undefined) trip.stay = changes.stay;
  if (changes.activities) trip.activities = changes.activities.filter((a) => ACTIVITY_BY_ID[a]);
  if (changes.insurance != null) trip.insurance = !!changes.insurance;
  if (changes.payment) trip.payment = changes.payment;
  return result(true, 'Plan updated.', 'neutral', { trip });
}

/** Removes a plan that was never booked. */
export function discardPlan(id, p = player()) {
  const t = travelState(p);
  const trip = tripById(id, p);
  if (!trip || trip.status !== 'draft') return result(false, 'Only an unbooked plan can be discarded.', 'neutral');
  t.trips = t.trips.filter((x) => x.id !== id);
  return result(true, 'Plan discarded.', 'neutral');
}

// ---------- Companions ----------

/** People who could be asked along. */
export function invitable(trip, p = player()) {
  const asked = new Set(trip.travelers.map((x) => x.id));
  return livingNpcs().filter((n) => !asked.has(n.id) && n.role !== 'pet' && !n.flags.inPrison
    && ['spouse', 'partner', 'child', 'parent', 'sibling', 'grandparent', 'friend', 'bestfriend', 'coworker', 'colleague', 'relative', 'grandchild', 'cousin'].includes(n.role)
    && !(typeof n.flags.abroad === 'string' && n.flags.abroad !== trip.destination?.countryId));
}

/**
 * Asks someone to come. They decide for themselves, once: how close you are,
 * whether they are free, whether they can pay their share, whether they can
 * travel at all, and, for a child, whose decision it is. The answer is kept.
 */
export function invite(tripId, npcId, p = player()) {
  const trip = tripById(tripId, p);
  const n = store.state.npcs[npcId];
  if (!trip || trip.status !== 'draft') return result(false, 'Invitations go out while planning.', 'neutral');
  if (!n?.alive) return result(false, 'They cannot come.', 'neutral');
  const had = trip.travelers.find((x) => x.id === npcId);
  if (had) return result(had.status === 'accepted', had.reason, had.status === 'accepted' ? 'good' : 'neutral');
  const nights = Math.max(1, daysBetween(trip.depart, trip.ret));
  const abroad = trip.destination && trip.destination.countryId !== p.countryId;
  const share = trip.destination ? Math.round(estimate({ origin: trip.origin, destination: trip.destination, nights, people: 1 })) : 0;
  const money = n.life?.savings ?? n.savings ?? 0;
  const rel = n.meters.relationship;
  let yes; let reason;
  const minor = n.age < 18;
  if (n.meters.health < 30) { yes = false; reason = `${n.firstName} is not well enough to travel.`; }
  else if (minor && n.role === 'child') {
    // Your own child: the decision is a parent's. A child living with another parent elsewhere needs that parent's agreement.
    if (typeof n.flags.abroad === 'string') { yes = rng.chance(0.4); reason = yes ? `${n.firstName}'s other parent agreed.` : `${n.firstName}'s other parent did not agree to the trip.`; }
    else { yes = true; reason = `${n.firstName} is coming.${n.age >= 13 && rel < 40 ? ' Under protest.' : ''}`; }
  } else if (minor) { yes = rng.chance(0.35); reason = yes ? `${n.firstName}'s parents said yes.` : `${n.firstName}'s parents said no.`; }
  else if (p.age < 18 && n.role === 'parent') { yes = rng.chance(clamp(0.45 + (rel - 50) / 120, 0.1, 0.9)); reason = yes ? `${n.firstName} agreed to take you.` : `${n.firstName} said not this year.`; }
  else {
    let k = 0.25 + (rel - 40) / 80 + (['spouse', 'partner'].includes(n.role) ? 0.25 : 0) + (n.role === 'friend' || n.role === 'bestfriend' ? 0.05 : 0);
    if (n.life?.job && nights > 10) k -= 0.15;
    if ((n.traits ?? []).includes('restless')) k += 0.1;
    if ((n.traits ?? []).includes('worrier') && abroad) k -= 0.1;
    yes = rng.chance(clamp(k, 0.03, 0.97));
    reason = yes ? `${n.firstName} said yes.` : n.life?.job && nights > 10 ? `${n.firstName} cannot get the time off work.` : `${n.firstName} would rather not.`;
    const selfPay = trip.payment !== 'organizer';
    if (yes && selfPay && money < share) { yes = false; reason = `${n.firstName} cannot afford their share.`; }
    if (yes && abroad && !ensureOwnPassport(n, trip.depart, trip.ret)) { yes = false; reason = `${n.firstName} has no passport and could not get one in time.`; }
  }
  trip.travelers.push({ id: n.id, status: yes ? 'accepted' : 'declined', reason, pays: trip.payment === 'organizer' ? 'organizer' : 'self' });
  return result(yes, reason, yes ? 'good' : 'neutral');
}
/** Takes back an invitation (or someone's place) before booking. */
export function uninvite(tripId, npcId, p = player()) {
  const trip = tripById(tripId, p);
  if (!trip || trip.status !== 'draft') return result(false, 'Only while planning.', 'neutral');
  trip.travelers = trip.travelers.filter((x) => x.id !== npcId || x.status === 'organizer');
  return result(true, 'Taken off the list.', 'neutral');
}
export const going = (trip) => trip.travelers.filter((x) => x.status === 'organizer' || x.status === 'accepted');
const goingPeople = (trip) => going(trip).map((x) => personById(x.id)).filter(Boolean);

// ---------- Money ----------

/** A rough cost for one person (local money): for Discover cards and invitations. */
export function estimate({ origin, destination, nights, people = 1 }) {
  const m = modesFor(origin, destination, year()).sort((a, b) => fareFor(a, 1000, 'economy') - fareFor(b, 1000, 'economy'))[0];
  const km = distanceKm(origin, destination) ?? 0;
  const fare = m ? fareFor(m, km, 'economy') * 2 : 0;
  const k = costK(destination.countryId);
  return localMoney((fare + (STAY_BY_ID.hotel.perNight + DAILY) * k * nights) * people, country());
}

/**
 * Every line of what a trip will cost, who pays it, and the refund terms.
 * Local money (the player's everyday currency).
 */
export function quote(trip, p = player()) {
  const lines = [];
  if (!trip.destination) return { lines, total: 0, organizer: 0, employer: 0, shares: {} };
  const c = country();
  const people = goingPeople(trip);
  const nights = Math.max(0, daysBetween(trip.depart, trip.ret));
  const k = costK(trip.destination.countryId);
  const m = MODE_BY_ID[trip.mode];
  const childK = (x) => ((x.age ?? 30) < 2 ? 0.1 : (x.age ?? 30) < 12 ? 0.7 : 1);
  if (m) {
    const out = journey(trip.origin, trip.destination, m, trip.depart, trip.cabin);
    const back = journey(trip.destination, trip.origin, m, trip.ret, trip.cabin);
    for (const x of people) lines.push({ kind: 'transport', personId: x.id, label: `${m.name}${m.cabins ? `, ${CABINS.find((k2) => k2.id === trip.cabin)?.name.toLowerCase() ?? 'economy'}` : ''}, there and back, for ${x.firstName}`, amount: localMoney((out.fare + back.fare) * childK(x), c) });
  }
  const s = STAY_BY_ID[trip.stay];
  if (s && !(m?.includesStay)) {
    const amount = s.shared ? localMoney(s.perNight * k * nights * Math.max(1, Math.ceil(people.length / 4)) * 2, c) : people.reduce((sum, x) => sum + localMoney(s.perNight * k * nights * (childK(x) < 1 ? 0.5 : 1), c), 0);
    if (amount) lines.push({ kind: 'stay', label: `${s.name}, ${nights} night${nights === 1 ? '' : 's'}`, amount });
  }
  for (const id of trip.activities) {
    const a = ACTIVITY_BY_ID[id];
    if (a?.cost) lines.push({ kind: 'activity', activityId: id, label: `${a.name} (${people.length})`, amount: people.reduce((sum, x) => sum + localMoney(a.cost * k * childK(x), c), 0) });
  }
  if (!m?.includesStay) lines.push({ kind: 'daily', label: `Food and getting about, ${nights + 1} days`, amount: people.reduce((sum, x) => sum + localMoney(DAILY * k * (nights + 1) * childK(x), c), 0) });
  const sub = lines.reduce((sum, l) => sum + l.amount, 0);
  if (trip.insurance) lines.push({ kind: 'insurance', label: 'Travel insurance', amount: Math.round(sub * INSURANCE_RATE) });
  // Who pays: the organizer, everyone their own share, or an employer for a work trip (the journey, the hotel and expenses).
  const employerPays = ['business', 'conference', 'interview'].includes(trip.type);
  let employer = 0; const shares = {};
  for (const l of lines) {
    if (employerPays && ['transport', 'stay', 'daily'].includes(l.kind) && (!l.personId || l.personId === p.id)) { l.payer = 'employer'; employer += l.amount; continue; }
    l.payer = 'organizer';
  }
  if (trip.payment === 'split' || trip.payment === 'separate') {
    // Each adult who came pays for themselves (their journey) and an equal part of the shared things; the organizer covers children.
    const adults = people.filter((x) => x === p || (x.age ?? 30) >= 18);
    for (const l of lines.filter((x) => x.payer === 'organizer')) {
      if (l.personId && l.personId !== p.id && adults.some((x) => x.id === l.personId)) { l.payer = l.personId; shares[l.personId] = (shares[l.personId] ?? 0) + l.amount; continue; }
      if (!l.personId && trip.payment === 'split' && adults.length > 1) {
        const part = Math.floor(l.amount / adults.length);
        for (const x of adults) if (x !== p) shares[x.id] = (shares[x.id] ?? 0) + part;
        l.split = adults.length;
      }
    }
  }
  const total = lines.reduce((sum, l) => sum + l.amount, 0);
  const others = Object.values(shares).reduce((a, b) => a + b, 0);
  return { lines, total, employer, shares, organizer: total - employer - others, nights };
}

// ---------- Checking a plan ----------

function overlaps(a, b) { return a.depart <= b.ret && b.depart <= a.ret; }

/** Everything wrong with a plan. Empty when it can be booked. */
export function problems(trip, p = player()) {
  const out = [];
  const t = TRIP_TYPE_BY_ID[trip.type];
  if (!trip.destination) return ['Choose where to go.'];
  if (trip.destination.countryId === trip.origin.countryId && trip.destination.city === trip.origin.city) out.push('That is where you live. Choose somewhere else.');
  const block = typeBlock(trip.type, trip.destination.countryId, p);
  if (block) out.push(`${t.name}: ${block}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trip.depart) || !/^\d{4}-\d{2}-\d{2}$/.test(trip.ret)) out.push('Choose the dates.');
  else {
    if (trip.depart < today()) out.push(`That date has passed. It is ${today()} now.`);
    if (trip.ret <= trip.depart) out.push('The return must come after the departure.');
    if (yearOf(trip.depart) > year() + 1) out.push('Trips can be planned for this year or next.');
    if (yearOf(trip.ret) !== yearOf(trip.depart)) out.push('A trip must end in the year it starts: the new year begins at home.');
    const days = daysBetween(trip.depart, trip.ret);
    if (t.maxDays && days > t.maxDays) out.push(`${t.name}: at most ${t.maxDays} days.`);
    if (t.minDays && days < t.minDays) out.push(`${t.name}: at least ${t.minDays} days.`);
    if (p.career.careerId && !['business', 'conference', 'interview'].includes(trip.type) && days > 30) out.push('Your job allows at most thirty days away at a time.');
  }
  const m = MODE_BY_ID[trip.mode];
  const open = modesFor(trip.origin, trip.destination, yearOf(trip.depart), { cruise: trip.type === 'cruise' });
  if (!m) out.push(open.length ? 'Choose how to travel.' : 'There is no way to make that journey in this period.');
  else if (!open.some((x) => x.id === m.id)) out.push(`${m.name}: not possible for this journey in ${yearOf(trip.depart)}.`);
  else {
    const there = journey(trip.origin, trip.destination, m, trip.depart, trip.cabin);
    if (there.arriveDate >= trip.ret) out.push(`The journey takes ${Math.ceil(there.hours / 24)} days each way: there would be no time there.`);
  }
  if (!m?.includesStay) {
    if (!trip.stay) out.push('Choose somewhere to stay.');
    else if (!stayOptions(trip).some((s) => s.id === trip.stay)) out.push('That place to stay is not available.');
    else if (p.flags.travelNeeds?.stepFree && !STAY_BY_ID[trip.stay].accessible) out.push(`${STAY_BY_ID[trip.stay].name} cannot promise step-free access.`);
  }
  if (p.flags.travelNeeds?.stepFree && m && !m.accessible) out.push(`${m.name}: step-free help cannot be arranged.`);
  // Traveling with children: a child under 16 crossing a border goes with a parent, or with written consent.
  const abroad = trip.destination.countryId !== p.countryId;
  const people = goingPeople(trip);
  if (p.age < 16 && !people.some((x) => x.role === 'parent')) out.push('A child travels with a parent or guardian.');
  for (const x of people.filter((y) => y.role === 'child' && y.age < 16)) if (typeof x.flags.abroad === 'string') out.push(`${x.firstName} lives with their other parent: their consent is needed.`);
  // The border, for everyone going.
  if (abroad && trip.depart >= today()) {
    const purpose = t.purpose;
    for (const x of people) {
      const r = readiness(x, trip.destination.countryId, purpose, trip.depart, trip.ret);
      out.push(...r.problems);
    }
  }
  // Clashes with other trips.
  for (const o of travelState(p).trips) if (o.id !== trip.id && LIVE.includes(o.status) && overlaps(o, trip)) out.push(`It clashes with your trip to ${COUNTRIES[o.destination.countryId].name} (${o.depart} to ${o.ret}).`);
  // Money.
  const q = quote(trip, p);
  if (q.organizer > p.finance.cash && !(p.age < 16 && people.some((x) => x.role === 'parent'))) out.push(`It comes to ${fmtMoney(q.organizer, country())} for you, and you have ${fmtMoney(p.finance.cash, country())}.`);
  return [...new Set(out)];
}

/** What the border asks of each traveler on a plan, so the planner can show it and offer the applications. */
export function entryCheck(trip, p = player()) {
  if (!trip.destination || trip.destination.countryId === p.countryId) return [];
  const purpose = TRIP_TYPE_BY_ID[trip.type].purpose;
  return goingPeople(trip).map((x) => {
    const r = readiness(x, trip.destination.countryId, purpose, trip.depart, trip.ret);
    return { id: x.id, name: x.firstName, you: x === p, rule: r.rule, ok: r.ok, problems: r.problems, needs: r.needs, mayApply: x === p || (x.role === 'child' && x.age < 18) };
  });
}

// ---------- Booking ----------

/** Books a plan: everything is paid once, and written down. */
export function confirm(tripId, p = player()) {
  const trip = tripById(tripId, p);
  if (!trip) return result(false, 'There is no such plan.', 'neutral');
  if (trip.status !== 'draft') return result(false, 'This trip is already booked.', 'neutral');
  const bad = problems(trip, p);
  if (bad.length) return result(false, bad[0], 'neutral', { problems: bad });
  const q = quote(trip, p);
  const parentsPay = p.age < 16 && q.organizer > p.finance.cash;
  const where = placeName(trip.destination.countryId, trip.destination.city);
  for (const [i, l] of q.lines.entries()) {
    const payer = l.payer === 'employer' ? 'employer' : l.payer !== 'organizer' ? l.payer : parentsPay ? 'parent' : 'player';
    const mine = l.split ? l.amount - Math.floor(l.amount / l.split) * (l.split - 1) : l.amount;
    if (payer !== 'player' && payer !== 'employer' && payer !== 'parent') {
      const n = store.state.npcs[payer];
      if (n) { if (n.life) n.life.savings -= l.amount; else n.savings = (n.savings ?? 0) - l.amount; }
    }
    if (l.split && payer === 'player') {
      for (const x of going(trip)) if (x.id !== p.id) { const n = store.state.npcs[x.id]; if (n && (n.age ?? 0) >= 18) { const part = Math.floor(l.amount / l.split); if (n.life) n.life.savings -= part; else n.savings = (n.savings ?? 0) - part; } }
    }
    const paid = charge({ amount: payer === 'player' ? mine : l.amount, kind: 'travel', memo: `${l.label}: ${where}`, key: `trip:${trip.id}:${i}`, ref: { tripId: trip.id }, payer });
    if (!paid.ok) return result(false, paid.why, 'neutral');
    trip.bookings.push({ id: uid('bk'), kind: l.kind, label: l.label, amount: l.amount, payer, txId: paid.tx.id, status: 'confirmed', activityId: l.activityId ?? null });
  }
  trip.status = 'confirmed';
  trip.confirmedOn = today();
  trip.confirmedYear = year();
  const others = going(trip).filter((x) => x.id !== p.id).map((x) => personById(x.id).firstName);
  const text = `Booked: ${TRIP_TYPE_BY_ID[trip.type].name.toLowerCase()} to ${where}, ${trip.depart} to ${trip.ret}${others.length ? `, with ${list(others)}` : ''}. ${q.employer ? `Your employer pays ${fmtMoney(q.employer, country())}. ` : ''}${parentsPay ? 'Your parents paid.' : `You paid ${fmtMoney(q.organizer, country())}.`}`;
  log(text, 'system', 'good');
  return result(true, text, 'good', { trip });
}

/** Cancels a booked trip. What comes back depends on what was booked and how close the date is. */
export function cancel(tripId, p = player()) {
  const trip = tripById(tripId, p);
  if (!trip || trip.status !== 'confirmed') return result(false, 'Only a booked trip that has not begun can be canceled.', 'neutral');
  const early = daysBetween(today(), trip.depart) > 30;
  let back = 0;
  for (const b of trip.bookings) {
    if (b.status !== 'confirmed') continue;
    const terms = REFUNDS[b.kind === 'daily' ? 'activity' : b.kind] ?? [0, 0];
    const r = refund(b.txId, early ? terms[0] : terms[1], `Canceled: ${b.label}`, p);
    if (r.ok && b.payer === 'player') back += r.amount;
    if (r.ok && b.payer !== 'player' && b.payer !== 'employer' && b.payer !== 'parent') { const n = store.state.npcs[b.payer]; if (n) { if (n.life) n.life.savings += r.amount; else n.savings = (n.savings ?? 0) + r.amount; } }
    b.status = 'canceled';
  }
  trip.status = 'canceled';
  trip.notes.push(`Canceled on ${today()}.`);
  const text = `You canceled the trip to ${COUNTRIES[trip.destination.countryId].name}. ${back ? `${fmtMoney(back, country())} came back to you.` : 'Nothing could be refunded.'}`;
  log(text, 'system', 'neutral');
  return result(true, text, 'neutral', { refunded: back });
}

// ---------- Going ----------

/** Sets off. The trip's departure date becomes today; the player is now somewhere else. */
export function depart(tripId, p = player()) {
  const trip = tripById(tripId, p);
  if (!trip || trip.status !== 'confirmed') return result(false, 'That trip is not ready to begin.', 'neutral');
  if (yearOf(trip.depart) !== year()) return result(false, `This trip leaves in ${yearOf(trip.depart)}.`, 'neutral');
  if (travelState(p).whereabouts) return result(false, 'You are already away.', 'neutral');
  if (p.legal.incarceration) return result(false, 'You are in prison.', 'neutral');
  if (trip.depart < today()) return disrupt(trip, 'The date had already passed.', p);
  const abroad = trip.destination.countryId !== p.countryId;
  const purpose = TRIP_TYPE_BY_ID[trip.type].purpose;
  // At the border: anyone not able to cross stays home.
  if (abroad) {
    const me = readiness(p, trip.destination.countryId, purpose, trip.depart, trip.ret);
    if (!me.ok) return disrupt(trip, me.problems[0], p);
    for (const x of trip.travelers.filter((y) => y.status === 'accepted')) {
      const n = personById(x.id);
      const r = n?.alive ? readiness(n, trip.destination.countryId, purpose, trip.depart, trip.ret) : { ok: false, problems: ['They could not come.'] };
      if (!r.ok) { x.status = 'stayed'; x.reason = r.problems[0]; trip.notes.push(`${n?.firstName ?? 'Someone'} could not travel: ${r.problems[0]}`); }
    }
  }
  store.state.today = trip.depart;
  const m = MODE_BY_ID[trip.mode];
  const there = journey(trip.origin, trip.destination, m, trip.depart, trip.cabin);
  trip.itinerary = { out: there.legs.map(packLeg), back: journey(trip.destination, trip.origin, m, trip.ret, trip.cabin).legs.map(packLeg) };
  trip.status = 'in_progress';
  trip.arrived = there.arriveDate;
  travelState(p).whereabouts = { countryId: trip.destination.countryId, city: trip.destination.city, tripId: trip.id, since: there.arriveDate };
  const leg = there.legs[there.legs.length - 1];
  const text = `You set off for ${placeName(trip.destination.countryId, trip.destination.city)} by ${m.name.toLowerCase()}${there.legs.length > 1 ? `, changing in ${there.legs[0].to.city}` : ''}. You arrived on ${leg.arrive.date} at ${leg.arrive.time}, local time.${trip.notes.length ? ` ${trip.notes.join(' ')}` : ''}`;
  log(text, 'system', 'good');
  return result(true, text, 'good', { trip });
}

/** A leg as it is kept in the save: places by id, local times as text. */
const packLeg = (l) => ({ from: placeId(l.from.countryId, l.from.city), to: placeId(l.to.countryId, l.to.city), mode: l.mode, km: l.km, hours: l.hours,
  depart: `${l.depart.date} ${l.depart.time}`, arrive: `${l.arrive.date} ${l.arrive.time}` });
/** A kept leg, ready to show. */
export function legView(l) {
  if (typeof l.from !== 'string') return l;
  const a = parsePlace(l.from); const b = parsePlace(l.to);
  const [dd, dt] = l.depart.split(' '); const [ad, at] = l.arrive.split(' ');
  return { ...l, from: a, to: b, depart: { date: dd, time: dt }, arrive: { date: ad, time: at } };
}

/** Days left at the destination, after what has been done. */
export function daysLeft(trip) {
  const used = trip.done.reduce((s, d) => s + (ACTIVITY_BY_ID[d.id]?.days ?? 0), 0);
  return Math.max(0, daysBetween(trip.arrived ?? trip.depart, trip.ret) - used);
}

/** Does something while away. Planned activities are paid for; anything else is paid on the spot. */
export function doActivity(tripId, activityId, p = player()) {
  const trip = tripById(tripId, p);
  const a = ACTIVITY_BY_ID[activityId];
  if (!trip || trip.status !== 'in_progress') return result(false, 'You are not on that trip.', 'neutral');
  if (!a || !activityOptions(trip, p).some((x) => x.id === activityId)) return result(false, 'That is not on offer here.', 'neutral');
  if (trip.done.some((d) => d.id === activityId)) return result(false, 'You have done that on this trip.', 'neutral');
  if (a.days > daysLeft(trip)) return result(false, 'There is not enough time left.', 'neutral');
  const planned = trip.activities.includes(activityId);
  const people = goingPeople(trip);
  if (!planned && a.cost) {
    const amount = people.reduce((s, x) => s + localMoney(a.cost * costK(trip.destination.countryId) * ((x.age ?? 30) < 12 ? 0.7 : 1), country()), 0);
    const paid = charge({ amount, kind: 'travel', memo: `${a.name}: ${placeName(trip.destination.countryId, trip.destination.city)}`, key: `trip:${trip.id}:act:${activityId}`, ref: { tripId: trip.id } });
    if (!paid.ok) return result(false, 'You cannot afford it.', 'neutral');
  }
  return result(true, ...experience(trip, a, p));
}

/** What an activity does, and the memory it leaves if it mattered. Returns [text, tone]. */
function experience(trip, a, p) {
  const people = goingPeople(trip).filter((x) => x !== p);
  const liked = likes(a, p);
  p.stats.mood = clamp(p.stats.mood + a.mood + (liked ? 3 : 0));
  if (a.health) p.stats.health = clamp(p.stats.health + a.health);
  if (a.intellect) p.stats.intellect = clamp(p.stats.intellect + a.intellect);
  let extra = '';
  const skill = a.skill === 'language' ? languagesOf(trip.destination.countryId).find((l) => (p.skills?.[l] ?? 0) < 85) : a.skill;
  if (skill && SKILL_BY_ID[skill] && p.age >= (SKILL_BY_ID[skill].minAge ?? 0)) {
    p.skills ??= {};
    const gain = a.skill === 'language' ? 6 : liked ? 3 : 1;
    p.skills[skill] = clamp((p.skills[skill] ?? 0) + gain);
    if (a.skill === 'language') (p.languageLog ??= []).push({ year: year(), lang: skill, source: 'lessons abroad', gain });
    extra = ` Your ${SKILL_BY_ID[skill].name.toLowerCase()} improved.`;
  }
  for (const n of people) n.meters.relationship = clamp(n.meters.relationship + (a.kids && n.age < 13 ? 5 : 2));
  if (a.needs === 'kin') for (const n of kinAbroad(trip.destination.countryId)) { n.meters.relationship = clamp(n.meters.relationship + 8); n.lastInteractionAge = p.age; }
  const where = trip.destination.city ?? COUNTRIES[trip.destination.countryId].name;
  const day = addDays(trip.arrived ?? trip.depart, trip.done.reduce((s, d) => s + (ACTIVITY_BY_ID[d.id]?.days ?? 0), 0));
  const done = { id: a.id, date: day, liked };
  trip.done.push(done);
  // Remembered only if it meant something: a high point, something they love, or with people they love.
  const significance = a.significance + (liked ? 1 : 0) + (people.some((n) => ['spouse', 'partner', 'child'].includes(n.role)) ? 1 : 0);
  if (significance >= 3) {
    const ev = recordEvent({ key: `trip:${trip.id}:act:${a.id}`, type: 'travel_memory', title: `${a.name} in ${where}`, date: day, tripId: trip.id,
      place: { countryId: trip.destination.countryId, city: trip.destination.city }, people: people.map(archiveIdOf), significance: Math.min(3, significance - 1), privacy: 'family',
      text: `${a.name.charAt(0)}${a.name.slice(1).toLowerCase()} in ${where}${people.length ? `, with ${list(people.map((n) => n.firstName))}` : ''}.` });
    trip.events.push(ev.id);
    done.eventId = ev.id;
    for (const n of people) remember(n, `trip_${trip.id}_${a.id}`, `${a.name} in ${where}, together.`);
  }
  const text = `${a.name} in ${where}${people.length ? `, with ${list(people.map((n) => n.firstName))}` : ''}.${liked ? ' It was exactly the kind of thing you love.' : ''}${extra}`;
  return [text, 'good'];
}

/**
 * Comes home. Whatever was planned and not yet done is done in the days that
 * remain. The trip is completed once: it is recorded in the travel history, the
 * days are counted at the border, and its milestones are written down.
 */
export function comeHome(tripId, p = player()) {
  const trip = tripById(tripId, p);
  if (!trip || trip.status !== 'in_progress') return result(false, 'You are not away on that trip.', 'neutral');
  const people = goingPeople(trip);
  for (const id of trip.activities) {
    const a = ACTIVITY_BY_ID[id];
    if (a && !trip.done.some((d) => d.id === id) && a.days <= daysLeft(trip) && activityOptions(trip, p).some((x) => x.id === id)) experience(trip, a, p);
  }
  const days = daysBetween(trip.depart, trip.ret);
  const abroad = trip.destination.countryId !== p.countryId;
  const m = MODE_BY_ID[trip.mode];
  const comfort = STAY_BY_ID[trip.stay]?.comfort ?? 3;
  p.stats.mood = clamp(p.stats.mood + Math.min(8, 2 + Math.round(days / 4)) + (comfort >= 4 ? 2 : 0) + (m.cabins ? (CABINS.find((k) => k.id === trip.cabin)?.mood ?? 10) - 10 : 0));
  if (trip.type === 'scouting') p.stats.mood = clamp(p.stats.mood - 3);
  if (abroad) for (const x of people) addStay(x, trip.destination.countryId, trip.arrived ?? trip.depart, trip.ret, trip.id);
  for (const n of people.filter((x) => x !== p)) {
    n.meters.relationship = clamp(n.meters.relationship + rng.int(4, 9));
    n.lastInteractionAge = p.age;
    remember(n, `trip_${trip.id}`, `${TRIP_TYPE_BY_ID[trip.type].name} to ${trip.destination.city ?? COUNTRIES[trip.destination.countryId].name}, together.`);
  }
  // Language: two weeks is practice for a language already begun, never fluency.
  if (abroad) {
    const lang = languagesOf(trip.destination.countryId).filter((l) => (p.skills?.[l] ?? 0) > 0 && (p.skills[l] ?? 0) < 85)[0];
    if (lang) { const gain = days >= 60 ? 6 : days >= 14 ? 3 : 1; p.skills[lang] = clamp(p.skills[lang] + gain); (p.languageLog ??= []).push({ year: year(), lang, source: 'travel', gain }); }
  }
  // A semester abroad: the course goes on, the credit is the university's to recognize, and classmates are people now.
  let study = '';
  if (trip.type === 'semester') {
    (p.education.abroad ??= []).push({ countryId: trip.destination.countryId, city: trip.destination.city, year: year(), tripId: trip.id, credit: 'recognized by your university' });
    const mate = makeNpc({ role: 'friend', countryId: trip.destination.countryId, age: Math.max(18, p.age + rng.int(-2, 2)), relationship: rng.int(55, 75) });
    mate.flags.abroad = trip.destination.countryId; mate.flags.metAbroad = trip.id;
    store.state.npcs[mate.id] = mate; p.npcIds.push(mate.id);
    remember(mate, `classmate_${trip.id}`, `You studied together in ${trip.destination.city}.`);
    study = ` You came back with the term's credit, recognized by your university, and a friend: ${mate.firstName}, who lives in ${trip.destination.city}.`;
  }
  store.state.today = trip.ret;
  travelState(p).whereabouts = null;
  trip.status = 'completed';
  trip.completedOn = trip.ret;
  trip.completedYear = year();
  for (const b of trip.bookings) if (b.status === 'confirmed') b.status = 'used';
  if (abroad) {
    stamp(trip.destination.countryId, 'visit');
    (p.trips ??= []).push({ countryId: trip.destination.countryId, city: trip.destination.city, year: year(), age: p.age, purpose: trip.type === 'scouting' ? 'scouting' : trip.type === 'visiting' ? 'family' : 'holiday', with: people.length - 1, tripId: trip.id });
    const seen = (p.flags.visited ??= []);
    if (!seen.includes(trip.destination.countryId)) seen.push(trip.destination.countryId);
  }
  const notes = milestones(trip, p);
  const others = people.filter((x) => x !== p).map((n) => n.firstName);
  const ev = recordEvent({ key: `trip:${trip.id}`, type: 'trip', title: `${TRIP_TYPE_BY_ID[trip.type].name}: ${placeName(trip.destination.countryId, trip.destination.city, year())}`, date: trip.depart, tripId: trip.id,
    place: { countryId: trip.destination.countryId, city: trip.destination.city }, people: people.filter((x) => x !== p).map(archiveIdOf), significance: notes.length ? 2 : 1, privacy: 'family',
    text: `${days} days${others.length ? ` with ${list(others)}` : ''}.` });
  trip.events.unshift(ev.id);
  earn(p);
  const text = `Home from ${placeName(trip.destination.countryId, trip.destination.city)}${others.length ? ` with ${list(others)}` : ''}.${study} ${notes.join(' ')}`.trim();
  log(text, 'system', 'good');
  return result(true, text, 'good', { trip });
}

/** A trip that could not happen: the bookings are refunded on their terms, more if insured. */
function disrupt(trip, why, p = player()) {
  for (const b of trip.bookings) {
    if (b.status !== 'confirmed') continue;
    const terms = REFUNDS[b.kind === 'daily' ? 'activity' : b.kind] ?? [0, 0];
    refund(b.txId, trip.insurance ? Math.max(terms[1], 0.9) : terms[1], `Disrupted: ${b.label}`, p);
    b.status = 'canceled';
  }
  trip.status = 'disrupted';
  trip.notes.push(why);
  const text = `The trip to ${COUNTRIES[trip.destination.countryId].name} could not go ahead. ${why}${trip.insurance ? ' The insurance paid back most of it.' : ' Some of the money came back.'}`;
  log(text, 'system', 'bad');
  return result(false, text, 'bad', { trip });
}

/** The first times, written down once each, from what really happened. */
function milestones(trip, p) {
  const aid = archiveIdOf(p);
  const notes = [];
  const people = goingPeople(trip).filter((x) => x !== p);
  const place = { countryId: trip.destination.countryId, city: trip.destination.city };
  const first = (key, title, text, sig = 2) => {
    if (hasEvent(key)) return;
    const ev = recordEvent({ key, type: 'travel_milestone', title, text, date: trip.depart, tripId: trip.id, place, people: people.map(archiveIdOf), significance: sig, privacy: 'family' });
    trip.events.push(ev.id);
    milestone(title, 'life');
    notes.push(`${title}.`);
  };
  const leisure = TRIP_TYPE_BY_ID[trip.type].group === 'Leisure';
  if (leisure) first(`first-vacation:${aid}`, 'First vacation', `To ${placeName(place.countryId, place.city)}.`);
  if (trip.destination.countryId !== p.countryId) first(`first-abroad:${aid}`, `First trip abroad: ${COUNTRIES[place.countryId].name}`, `Crossed a border for the first time, to ${placeName(place.countryId, place.city)}.`, 3);
  if (!people.length && p.age >= 16) first(`first-solo:${aid}`, 'First trip alone', `To ${placeName(place.countryId, place.city)}.`);
  if (people.some((n) => ['child', 'parent', 'sibling'].includes(n.role)) && leisure) first(`first-family-holiday:${aid}`, 'First family vacation', `With ${list(people.map((n) => n.firstName))}.`);
  if (trip.type === 'honeymoon') { const s = people.find((n) => n.role === 'spouse'); if (s) first(`honeymoon:${s.id}`, `Honeymoon with ${s.firstName}`, `In ${placeName(place.countryId, place.city)}.`, 3); }
  if (trip.type === 'anniversary') { const s = people.find((n) => n.role === 'spouse'); if (s) first(`anniversary:${s.id}:${year()}`, `An anniversary in ${place.city ?? COUNTRIES[place.countryId].name}`, `With ${s.firstName}.`); }
  if (trip.done.some((d) => d.id === 'landmark')) first(`landmark:${aid}:${place.countryId}`, `Saw the great sights of ${place.city ?? COUNTRIES[place.countryId].name}`, '', 1);
  const kin = kinAbroad(place.countryId);
  if (kin.length && (trip.type === 'visiting' || trip.done.some((d) => d.id === 'kin'))) first(`visited:${aid}:${place.countryId}:${year()}`, `Visited ${list(kin.slice(0, 3).map((n) => n.firstName))} in ${COUNTRIES[place.countryId].name}`, '', 2);
  // Returning to a place once lived in, years later: what has changed comes from the saved world.
  const lived = (p.locations ?? []).filter((l) => l.countryId === place.countryId && (!l.city || !place.city || l.city === place.city) && l.to != null);
  const last = lived[lived.length - 1];
  if (last && year() - last.to >= 8) {
    const gone = year() - last.to;
    const friends = livingNpcs().filter((n) => ['friend', 'bestfriend', 'classmate', 'exclassmate'].includes(n.role) && (n.flags.abroad === place.countryId || (place.countryId === p.countryId && !n.flags.abroad)));
    const mine = p.assets.filter((a) => a.kind === 'property' && (a.countryId ?? p.countryId) === place.countryId && (!a.city || a.city === place.city));
    const what = [`${gone} years since you lived here`, friends.length ? `${list(friends.slice(0, 3).map((n) => `${n.firstName}, ${n.age} now`))} still here` : 'none of your old friends still here', mine.length ? `your old home still yours${mine[0].tenant ? ', with tenants in it' : ''}` : 'someone else living where you lived'];
    first(`return:${aid}:${place.countryId}:${place.city}:${year()}`, `Back in ${place.city ?? COUNTRIES[place.countryId].name}`, `${what.join('; ')}.`, 3);
  }
  return notes;
}

/**
 * A one-tap holiday (engine/activities.holiday): booked, taken and finished at
 * once. It becomes an ordinary completed trip, so the journal, the stays at the
 * border, the milestones and the ledger see it like any other.
 * @param {{countryId:string, city?:string, nights:number, people:object[], name:string, txId:string, amount:number, purpose?:string}} o
 */
export function recordQuickTrip(o, p = player()) {
  const from = home(p);
  const depart = today();
  const ret = yearOf(addDays(depart, o.nights)) === year() ? addDays(depart, o.nights) : `${year()}-12-31`;
  const type = o.purpose === 'scouting' ? 'scouting' : o.purpose === 'family' ? 'visiting' : 'vacation';
  const trip = { id: uid('trip'), type, status: 'completed', createdYear: year(), organizerId: p.id, origin: from,
    destination: { countryId: o.countryId, city: o.city ?? (o.countryId === p.countryId ? null : capitalCity(o.countryId)) }, depart, ret,
    travelers: [{ id: p.id, status: 'organizer', pays: 'self' }, ...o.people.map((n) => ({ id: n.id, status: 'accepted', pays: 'organizer' }))],
    mode: null, cabin: null, stay: null, activities: [], done: [], insurance: false, payment: 'organizer', package: o.name,
    bookings: [{ id: uid('bk'), kind: 'package', label: o.name, amount: o.amount, payer: 'player', txId: o.txId, status: 'used' }], events: [], notes: [], completedOn: ret, completedYear: year() };
  travelState(p).trips.push(trip);
  if (o.countryId !== p.countryId) for (const x of [p, ...o.people]) addStay(x, o.countryId, depart, ret, trip.id);
  const notes = milestones(trip, p);
  const ev = recordEvent({ key: `trip:${trip.id}`, type: 'trip', title: `${o.name}`, date: depart, tripId: trip.id, place: trip.destination,
    people: o.people.map(archiveIdOf), significance: notes.length ? 2 : 1, privacy: 'family', text: `${o.nights} days${o.people.length ? ` with ${list(o.people.map((n) => n.firstName))}` : ''}.` });
  trip.events.unshift(ev.id);
  store.state.today = ret;
  earn(p);
  return { trip, notes };
}

// ---------- The year ----------

/**
 * Before the year turns: a trip under way comes home, and a trip booked for
 * this year that was not taken is taken as planned. Nothing carries into
 * next year's calendar except trips booked for next year.
 */
export function closeYear(p = player()) {
  const t = travelState(p);
  const out = [];
  for (const trip of t.trips.filter((x) => x.status === 'in_progress')) out.push(comeHome(trip.id, p).text);
  for (const trip of t.trips.filter((x) => x.status === 'confirmed' && yearOf(x.depart) <= year()).sort((a, b) => a.depart.localeCompare(b.depart))) {
    if (trip.depart < today()) { out.push(disrupt(trip, 'Something else was happening on those days.', p).text); continue; }
    const r = depart(trip.id, p);
    out.push(r.text);
    if (r.ok) out.push(comeHome(trip.id, p).text);
  }
  // Plans never booked from an earlier year lapse.
  t.trips = t.trips.filter((x) => !(x.status === 'draft' && x.createdYear < year()));
  return out;
}
/** Years after which a finished trip keeps only its summary, and the ledger only yearly totals. */
export const KEEP = { tripDetail: 3, ledgerYears: 10, stayDays: 400 };

/**
 * Keeps saves small in long, well-traveled lives. A finished trip older than
 * a few years keeps where, when, who, what was done, its memories and what it
 * cost; the journey's legs and the booking lines go (the ledger kept the
 * money). Ledger entries older than ten years become yearly totals by kind.
 * Days abroad older than any rolling window are dropped. Idempotent.
 */
export function compactHistory(p = player()) {
  const yr = year();
  const done = ['completed', 'canceled', 'disrupted'];
  for (const t of travelState(p).trips) {
    if (!done.includes(t.status) || t.compact || yearOf(t.depart) > yr - KEEP.tripDetail) continue;
    t.spent = -(p.finance.receipts ?? []).filter((x) => x.ref?.tripId === t.id && x.payer === 'player').reduce((s2, x) => s2 + x.amount, 0);
    t.bookingCount = t.bookings.length;
    delete t.itinerary; t.bookings = []; t.activities = [];
    delete t.cabin; delete t.insurance; delete t.payment;
    t.compact = true;
  }
  const ledger = p.finance.receipts ?? [];
  const old = ledger.filter((x) => x.year <= yr - KEEP.ledgerYears);
  if (old.length) {
    const years = (p.finance.receiptYears ??= {});
    for (const x of old) { const y = (years[x.year] ??= {}); const k = `${x.kind}${x.payer === 'player' ? '' : `:${x.payer === 'employer' || x.payer === 'parent' ? x.payer : 'others'}`}`; y[k] = (y[k] ?? 0) + x.amount; }
    p.finance.receipts = ledger.filter((x) => x.year > yr - KEEP.ledgerYears);
  }
  const cutoff = addDays(`${yr}-01-01`, -KEEP.stayDays);
  for (const person of [p, ...Object.values(store.state.npcs).filter((n) => n.stays?.length)]) if (person.stays?.length) person.stays = person.stays.filter((x) => x.to >= cutoff);
}

/** After the year turns: the calendar starts again on 1 January. */
export function openYear() { store.state.today = `${store.state.year}-01-01`; }

// ---------- Views ----------

/** Where the player is right now: home, or away on a trip. Their residence does not change either way. */
export function whereabouts(p = player()) {
  const w = travelState(p).whereabouts;
  return w ? { away: true, ...w, name: placeName(w.countryId, w.city) } : { away: false, countryId: p.countryId, city: p.city, name: placeName(p.countryId, p.city) };
}

/** A trip, ready to show: its people, money, memories and dates. */
export function tripCard(trip, p = player()) {
  const people = trip.travelers.map((x) => ({ ...x, person: personById(x.id) })).filter((x) => x.person);
  const spent = trip.compact ? trip.spent : -(p.finance.receipts ?? []).filter((x) => x.ref?.tripId === trip.id && x.payer === 'player').reduce((s, x) => s + x.amount, 0);
  const memories = events((e) => e.tripId === trip.id);
  return {
    id: trip.id, status: trip.status, type: TRIP_TYPE_BY_ID[trip.type]?.name ?? trip.type, group: TRIP_TYPE_BY_ID[trip.type]?.group,
    where: trip.destination ? placeName(trip.destination.countryId, trip.destination.city, yearOf(trip.depart)) : 'Not chosen yet',
    countryId: trip.destination?.countryId, city: trip.destination?.city, flag: COUNTRIES[trip.destination?.countryId]?.flag ?? '',
    depart: trip.depart, ret: trip.ret, year: yearOf(trip.depart),
    travelers: people.map((x) => ({ id: x.id, name: x.person.firstName, you: x.id === p.id, status: x.status, reason: x.reason, role: x.person.role, relation: x.id === p.id ? 'You' : roleLabel(x.person) })),
    mode: MODE_BY_ID[trip.mode]?.name ?? null, stay: STAY_BY_ID[trip.stay]?.name ?? null,
    done: trip.done.map((d) => ({ ...d, name: ACTIVITY_BY_ID[d.id]?.name })), planned: trip.activities.map((id) => ACTIVITY_BY_ID[id]?.name).filter(Boolean),
    spent, bookings: trip.bookings, memories, notes: trip.notes, itinerary: trip.itinerary ? { out: trip.itinerary.out.map(legView), back: trip.itinerary.back.map(legView) } : null,
  };
}

/** Trips, newest first, optionally only some statuses. */
export const trips = (statuses = null, p = player()) => travelState(p).trips.filter((t) => !statuses || statuses.includes(t.status)).slice().sort((a, b) => b.depart.localeCompare(a.depart));

// ---------- Achievements ----------

export const ACHIEVEMENTS = [
  { id: 'first_adventure', name: 'First Adventure', desc: 'Complete a first trip.' },
  { id: 'across_borders', name: 'Across Borders', desc: 'Complete a first journey abroad.' },
  { id: 'frequent', name: 'Frequent Traveler', desc: 'Complete ten trips.' },
  { id: 'study_abroad', name: 'Study Abroad', desc: 'Complete a semester at a university abroad.' },
  { id: 'new_home', name: 'A New Home', desc: 'Move to another country through a lawful route.' },
  { id: 'multilingual', name: 'Multilingual Life', desc: 'Speak two languages besides your first one well.' },
  { id: 'coming_home', name: 'Coming Home', desc: 'Return to a country you once lived in, after five years or more away.' },
  { id: 'global_family', name: 'Global Family', desc: 'Have close family living in three or more countries.' },
  { id: 'generations', name: 'Across Generations', desc: 'Continue a family whose story spans more than one country and three generations.' },
];
/** Checks what has been earned from the real state, and writes down when. */
export function earn(p = player()) {
  const t = travelState(p);
  const done = t.trips.filter((x) => x.status === 'completed');
  const has = {
    first_adventure: done.length >= 1,
    across_borders: done.some((x) => x.destination.countryId !== x.origin.countryId),
    frequent: done.length >= 10,
    study_abroad: done.some((x) => x.type === 'semester'),
    new_home: events((e) => e.type === 'relocation' && e.subject === archiveIdOf(p) && e.international).length > 0,
    multilingual: Object.entries(p.skills ?? {}).filter(([id, v]) => SKILL_BY_ID[id]?.group === 'language' && id !== 'sign_language' && v >= 70).length >= 2,
    coming_home: events((e) => e.type === 'relocation' && e.subject === archiveIdOf(p) && e.returning).length > 0,
    global_family: new Set([p.countryId, ...livingNpcs().filter((n) => ['parent', 'child', 'sibling', 'spouse'].includes(n.role)).map((n) => (typeof n.flags.abroad === 'string' ? n.flags.abroad : p.countryId))]).size >= 3,
    generations: (p.generation ?? 1) >= 3 && new Set([...(p.locations ?? []).map((l) => l.countryId), ...Object.values(store.state.archive?.people ?? {}).flatMap((x) => x.places.map((l) => l.countryId))]).size >= 2,
  };
  const fresh = [];
  for (const a of ACHIEVEMENTS) if (has[a.id] && !t.earned[a.id]) { t.earned[a.id] = year(); fresh.push(a.name); }
  return fresh;
}
export const achievements = (p = player()) => ACHIEVEMENTS.map((a) => ({ ...a, year: travelState(p).earned[a.id] ?? null }));

/** Countries and cities visited, first visits, repeats and favorites, from completed trips (and older records). */
export function collection(p = player()) {
  const by = new Map();
  for (const t of travelState(p).trips.filter((x) => x.status === 'completed')) {
    const c = t.destination.countryId;
    const e = by.get(c) ?? { id: c, name: COUNTRIES[c]?.name, flag: COUNTRIES[c]?.flag, first: t.depart, visits: 0, cities: new Set(), days: 0 };
    e.visits += 1; e.cities.add(t.destination.city); e.days += daysBetween(t.depart, t.ret); if (t.depart < e.first) e.first = t.depart;
    by.set(c, e);
  }
  // Older records, from before trips were kept in full: by country, and by year where known.
  for (const t of p.trips ?? []) if (!t.tripId && !t.refused && !by.has(t.countryId) && COUNTRIES[t.countryId]) by.set(t.countryId, { id: t.countryId, name: COUNTRIES[t.countryId].name, flag: COUNTRIES[t.countryId].flag, first: t.year ? `${t.year}` : 'before records', visits: 1, cities: new Set(t.city ? [t.city] : []), days: 0, legacy: true });
  const all = [...by.values()].map((e) => ({ ...e, cities: [...e.cities].filter(Boolean) }));
  const favorite = [...all].sort((a, b) => b.visits - a.visits || b.days - a.days)[0] ?? null;
  return { countries: all.sort((a, b) => String(a.first).localeCompare(String(b.first))), favorite, cities: all.reduce((s, e) => s + e.cities.length, 0) };
}

export { eraOf, needsAuthorization };

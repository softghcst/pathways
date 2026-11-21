// Moving to another country as a case that runs over time, rather than one
// click: choose a route, apply, wait for the decision when the year turns,
// then arrange housing, work or study, money, the family's papers, the pets
// and the journey, and only then move. The move itself is
// emigration.emigrate, given the approved case, so the move and its records
// (the residence history, the canonical relocation event, the money) are the
// same however it is reached.
//
//   p.applications  { kind:'relocation', routeId, jurisdictionId, city, status, decideYear, fee, paid, remaining,
//                     arrangements:{ housing, money, animals, shipVehicles, travel }, history:[] }
//
// Citizens, and citizens of a free-movement area, have no application to
// make: their case is approved as it is opened. Nobody becomes a citizen,
// or a permanent resident, by moving: the status a route gives is the
// status they arrive with (engine/immigration.js).
import { rng } from '../rng.js';
import { localMoney, fmtMoney, theCountry, uid } from '../util.js';
import { store, player, country, livingNpcs, log } from '../state.js';
import { COUNTRIES } from '../data/countries.js';
import { routes } from './immigration.js';
import { emigrate, household, canEmigrate, travelPlan } from './emigration.js';
import { mayLeave } from './living.js';
import { charge } from './chronicle.js';
import { validPassport, today, eraOf } from './documents.js';
import { capitalCity, distanceKm } from './geo.js';
import { healthOnArrival } from './systems.js';
import * as fam from './familyMove.js';

const result = (ok, text, tone = ok ? 'good' : 'bad', extra = {}) => ({ ok, text, tone, ...extra });
const nameOf = (id) => theCountry(COUNTRIES[id]?.name ?? id);
const OPEN = ['submitted', 'under_review', 'review_requested'];
const apps = (p = player()) => (p.applications ??= []);
export const cases = (p = player()) => apps(p).filter((a) => a.kind === 'relocation');
export const caseById = (id, p = player()) => cases(p).find((a) => a.id === id) ?? null;
/** The case for a destination still in play: being considered, or approved and not yet used. */
export const activeCase = (destId, p = player()) => cases(p).find((a) => a.jurisdictionId === destId && [...OPEN, 'approved'].includes(a.status) && !a.used) ?? null;

/**
 * Opens a case to move. Routes with nothing to apply for (citizens, free
 * movement) are approved at once; any other is submitted with its
 * application fee (a fifth of the route's cost) and decided when the year turns.
 */
export function applyToMove(destId, routeId, city = null, p = player()) {
  const to = COUNTRIES[destId];
  if (!to || destId === p.countryId) return result(false, 'You cannot move there.', 'neutral');
  if (!canEmigrate()) return result(false, 'You cannot move abroad now.', 'neutral');
  if (!mayLeave().ok) return result(false, mayLeave().reason, 'neutral');
  if (activeCase(destId, p)) return result(false, 'You already have a case open for there.', 'neutral');
  if (cases(p).some((a) => OPEN.includes(a.status))) return result(false, 'You have an application being considered. One at a time.', 'neutral');
  if (cases(p).some((a) => a.submittedYear === store.state.year && a.status === 'refused' && a.jurisdictionId === destId)) return result(false, 'Refused this year. You can apply again next year.', 'neutral');
  const route = routes(destId, p).find((r) => r.id === routeId);
  if (!route) return result(false, 'There is no such route.', 'neutral');
  if (!route.eligible) return result(false, route.why, 'neutral');
  const year = store.state.year;
  const none = ['right', 'free'].includes(route.id);
  const applyFee = none ? 0 : Math.round(route.fee * 0.2);
  const app = { id: uid('move'), kind: 'relocation', personId: p.id, jurisdictionId: destId, routeId: route.id, routeName: route.name, status: none ? 'approved' : 'submitted',
    city: city && to.cities.includes(city) ? city : capitalCity(destId), submittedYear: year, decideYear: none ? year : year + 1, fee: route.fee, paid: 0,
    remaining: none ? route.fee : route.fee - applyFee, status_on_arrival: route.status, years: route.years, arrangements: {}, history: [{ year, date: today(), status: 'submitted' }] };
  if (applyFee) {
    const paid = charge({ amount: applyFee, kind: 'visa_fee', memo: `Application to move to ${to.name}: ${route.name}`, key: `move:${app.id}:apply`, ref: { moveId: app.id } });
    if (!paid.ok) return result(false, `The application fee is ${fmtMoney(applyFee, country())}. You do not have it.`, 'neutral');
    app.paid = applyFee;
    app.txId = paid.tx.id;
  }
  if (none) app.history.push({ year, date: today(), status: 'approved', note: 'no application needed' });
  apps(p).push(app);
  p.flags.visaAge = p.age;
  const text = none ? `${route.name}: there is no application to make. You can arrange the move to ${nameOf(destId)} whenever you are ready.`
    : `Your application to move to ${nameOf(destId)} (${route.name.toLowerCase()}) is in. It will be decided when the year turns. The application fee was ${fmtMoney(applyFee, country())}; the rest is paid if it is granted.`;
  log(text, 'system', 'neutral');
  return result(true, text, 'neutral', { app });
}

/**
 * Yearly: cases due are decided, on the route's conditions as they stand
 * then (someone who no longer qualifies is refused for that reason). An
 * approval is entry clearance to move within the year; unused, it lapses.
 */
export function tickRelocation(p = player()) {
  const year = store.state.year;
  const out = [];
  for (const app of cases(p)) {
    if (app.status === 'approved' && !app.used && app.decideYear < year - 1) {
      app.status = 'expired'; app.history.push({ year, status: 'expired', note: 'not used in time' });
      out.push(`Your permission to move to ${nameOf(app.jurisdictionId)} was not used in time, and has lapsed.`);
    }
    if (!OPEN.includes(app.status) || app.decideYear > year) continue;
    const route = routes(app.jurisdictionId, p).find((r) => r.id === app.routeId);
    if (!route?.eligible) {
      app.status = 'refused'; app.reason = route?.why ? `You no longer qualify: ${route.why}` : 'The route is no longer open.';
      app.history.push({ year, status: 'refused', note: app.reason });
      out.push(`Your application to move to ${nameOf(app.jurisdictionId)} was refused. ${app.reason}`);
      continue;
    }
    const yes = rng.chance(route.chance);
    app.decision = { year, yes };
    if (yes) {
      app.status = 'approved';
      app.history.push({ year, status: 'approved' });
      out.push(`Your application to move to ${nameOf(app.jurisdictionId)} was approved. You have until the end of ${year + 1} to make the move.`);
    } else {
      app.status = 'refused';
      app.reason = 'The authorities were not satisfied the conditions of the route were met.';
      app.history.push({ year, status: 'refused', note: app.reason });
      out.push(`Your application to move to ${nameOf(app.jurisdictionId)} was refused. You can apply again.`);
    }
  }
  return out;
}

/** Housing on arrival: what is possible from what the player has. */
export function housingOptions(app, p = player()) {
  const owned = p.assets.filter((a) => a.kind === 'property' && a.countryId === app.jurisdictionId);
  const kin = livingNpcs().filter((n) => n.flags.abroad === app.jurisdictionId && ['parent', 'sibling', 'child', 'grandparent', 'spouse'].includes(n.role));
  return [
    ...owned.map((a) => ({ id: `own:${a.id}`, label: `Move into your ${a.name.toLowerCase()}${a.city ? ` in ${a.city}` : ''}`, propertyId: a.id, city: a.city ?? app.city, disabled: !!a.tenant, why: a.tenant ? 'It is let to tenants.' : '' })),
    ...(kin.length ? [{ id: 'kin', label: `Stay with ${kin[0].firstName} at first`, city: null }] : []),
    ...(app.routeId === 'work' ? [{ id: 'employer', label: 'Temporary housing from your new employer', city: null }] : []),
    ...(app.routeId === 'study' ? [{ id: 'student', label: 'A room in student housing', city: null }] : []),
    { id: 'rent', label: `Rent an apartment in ${app.city}`, city: null },
  ];
}

/** Records a choice for the move. Nothing is paid until the move itself. */
export function arrange(caseId, changes, p = player()) {
  const app = caseById(caseId, p);
  if (!app || app.status !== 'approved' || app.used) return result(false, 'That case is not ready to arrange.', 'neutral');
  const a = app.arrangements;
  if (changes.housing) {
    const opt = housingOptions(app, p).find((o) => o.id === changes.housing);
    if (!opt || opt.disabled) return result(false, opt?.why || 'That is not possible.', 'neutral');
    a.housing = opt.id;
    if (opt.city) app.city = opt.city;
  }
  if (changes.city && COUNTRIES[app.jurisdictionId].cities.includes(changes.city)) app.city = changes.city;
  if (changes.money != null) a.money = Number(changes.money);
  if (changes.shipVehicles != null) a.shipVehicles = !!changes.shipVehicles;
  // The household's animals (engine/animalCare.js): every one that can come comes, or all are found homes here.
  if (changes.animals === 'bring' || changes.animals === 'leave') a.animals = changes.animals;
  if (changes.travel) a.travel = changes.travel;
  return result(true, 'Noted.', 'neutral', { app });
}

/**
 * The moving checklist. Every step is read from saved state: a step is done
 * only when the thing it describes has actually been done.
 */
export function checklist(caseId, p = player()) {
  const app = caseById(caseId, p);
  if (!app) return [];
  const a = app.arrangements;
  const goingPeople = [p, ...household(app.jurisdictionId).filter((n) => n.role !== 'pet' && n.flags.abroad !== app.jurisdictionId)];
  const needPapers = eraOf().passport;
  const missing = needPapers ? goingPeople.filter((x) => !validPassport(x)) : [];
  const plan = travelPlan(app.jurisdictionId);
  const work = app.routeId === 'work' ? 'Your sponsoring employer has a job waiting.' : app.routeId === 'study' ? 'Your place in college is confirmed.' : p.career.careerId ? 'You will need to find work there.' : 'Not needed for this route.';
  return [
    { id: 'review', label: `Review ${COUNTRIES[app.jurisdictionId].name}`, done: true, note: `${app.city}, ${Math.round(distanceKm({ countryId: p.countryId, city: p.city }, { countryId: app.jurisdictionId, city: app.city }) ?? 0)} km away.` },
    { id: 'eligible', label: 'Confirm eligibility', done: true, note: app.routeName },
    { id: 'apply', label: 'Submit application', done: true, note: app.paid ? `Fee paid: ${fmtMoney(app.paid, country())}.` : 'No application needed.' },
    { id: 'decision', label: 'Receive a decision', done: app.status === 'approved' || !!app.used, note: app.status === 'approved' ? 'Approved.' : app.status === 'refused' ? `Refused. ${app.reason ?? ''}` : 'Decided when the year turns.' },
    { id: 'housing', label: 'Arrange housing', done: !!a.housing, note: a.housing ? housingOptions(app, p).find((o) => o.id === a.housing)?.label ?? 'Chosen.' : '' },
    { id: 'work', label: 'Arrange work or study', done: true, note: work },
    { id: 'health', label: 'Health care there', done: true, note: healthOnArrival(app.jurisdictionId, app.status_on_arrival) },
    { id: 'money', label: 'Review finances', done: a.money != null, note: a.money != null ? (a.money ? `Leaving ${Math.round(a.money * 100)}% in ${country().currency.code}.` : `Changing everything into ${COUNTRIES[app.jurisdictionId].currency.code}.`) : '' },
    { id: 'papers', label: 'Family documents', done: !missing.length, note: missing.length ? `Without a valid passport: ${missing.map((x) => x.firstName).join(', ')}.` : needPapers ? 'Everyone has a valid passport.' : 'No documents needed in this period.' },
    (() => { const kids = fam.childrenMoving(app.jurisdictionId).map((c) => ({ c, s: fam.consent(app.jurisdictionId, c, p) })).filter((x) => x.s.needed);
      const open = fam.unresolved(app.jurisdictionId, p);
      return { id: 'children', label: 'Consent for the children', done: !open.length, note: kids.length ? kids.map(({ c, s }) => `${c.firstName}: ${{ unasked: `${s.otherParent.firstName} not yet asked`, refused: `${s.otherParent.firstName} said no`, agreed: `${s.otherParent.firstName} agreed`, court_allowed: 'the court allowed it', court_refused: 'the court refused', staying: `staying with ${s.otherParent.firstName}` }[s.status]}`).join('; ') : 'No other parent needs to agree.' }; })(),
    { id: 'pets', label: 'Arrangements for animals', done: !plan.length || !!a.animals, note: !plan.length ? 'No animals.'
      : `${a.animals === 'bring' ? 'Coming: ' : a.animals === 'leave' ? 'Homes found here for: ' : 'Not decided: '}${plan.map((t) => `${t.a.name}${t.ok ? (t.quarantine ? ' (quarantine on arrival)' : '') : ` (cannot come: ${t.why})`}`).join('; ')}.` },
    { id: 'travel', label: 'Plan the journey', done: !!a.travel, note: a.travel ? `By ${a.travel}.` : '' },
    { id: 'move', label: 'Complete the move', done: !!app.used, note: app.used ? `Moved in ${app.movedYear}.` : '' },
  ];
}

/** Makes the move, once every step before it is done. */
export function completeMove(caseId, p = player()) {
  const app = caseById(caseId, p);
  if (!app || app.status !== 'approved' || app.used) return result(false, 'That move is not ready.', 'neutral');
  const open = checklist(caseId, p).filter((s) => s.id !== 'move' && !s.done);
  if (open.length) return result(false, `Not yet: ${open[0].label.toLowerCase()}.`, 'neutral');
  const a = app.arrangements;
  const r = emigrate(app.jurisdictionId, { route: app.routeId, city: app.city, keep: a.money ?? 0, shipVehicles: a.shipVehicles !== false, animals: a.animals ?? 'bring', grant: app,
    reason: { business: 'to run the business', work: 'for a job', study: 'to study', family: 'to be with family', invest: 'to invest', settle: 'to settle', retire: 'to retire', right: 'home, as a citizen', free: 'under free movement', protection: 'for protection' }[app.routeId] });
  if (!r.ok) return r;
  app.used = true;
  app.movedYear = store.state.year;
  app.history.push({ year: store.state.year, status: 'used', note: 'moved' });
  if (a.housing?.startsWith('own:')) p.homeId = a.housing.slice(4);
  return r;
}

export { localMoney };

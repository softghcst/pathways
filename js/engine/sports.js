// The athletic life: one engine for every sport (the sports themselves are data, data/sports.js).
//
// state.sports = { v, seq, athletes, orgs, teams, coaches, seasons, events, partnerships, contracts,
//                  decisions, paid, moments, tickYear, acts }
//
//   athletes      one record per person who has played, keyed by their id; it is never deleted. The player's is made
//                 when they first take up a sport. Each record holds, per sport, that sport's own skills (separate from
//                 the character's general talents), a ceiling for each skill that comes from their talent, the level
//                 they play at, their club and team, their coach, their training plan, their Pathways Rating, and
//                 every season and event they took part in, by id.
//   orgs          clubs, academies, school teams, university programs, professional clubs and leagues. They persist:
//                 the same club is there next year with the same name, coach and rivals.
//   teams         a team of an org, with a roster. The player's teammates who matter are people (state.npcs, role
//                 'teammate'); the rest of a roster is names and ratings only.
//   coaches       what a coach is like as a coach (quality, style, what they teach best), keyed by the coach's own id
//                 among the people the player knows (role 'coach').
//   seasons       a league season: its fixtures and their scores, written once when played. Standings are counted from
//                 completed fixtures only, never stored, so they always agree with the games.
//   events        a tournament, meet or competition. Only the player's own path through the draw is kept in detail.
//   moments       the athletic timeline: firsts, titles, injuries, signings, retirements. Never repeated.
//
// Everything that comes down to luck in a competition is drawn from a run of luck keyed to that competition
// (sportsPlay.seeded): loading a save never re-rolls a result, and the game's own dice are never touched by it.
import { store, player, log, milestone, livingNpcs } from '../state.js';
import { clamp, cap, localMoney, fmtMoney } from '../util.js';
import { COUNTRIES } from '../data/countries.js';
import { SPORTS, SPORTS_LIST, sportOf, PLANS, LOADS, SKILL_KIND, LEVELS, LEVEL_NAMES, TEAM_WORDS, CLUB_WORDS, mascotsFor, JERSEY_COLORS, leagueSize, DIVISIONS, draftCountry } from '../data/sports.js';
const DIVISION_NAMES = { D1: 'Division I', IVY: 'Ivy', D2: 'Division II', D3: 'Division III', NAIA: 'NAIA', JUCO: 'National' };
import { makeNpc } from './npcFactory.js';
import { remember } from './conditions.js';
import { school as currentSchool, atSchool } from './schooling.js';
import { seeded, hash, teamGame, tennisMatch, rallyMatch, bout, mark, better, fmtMark, judged, golfRound, prChange, prOfSkill, edge } from './sportsPlay.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const fullName = (x) => `${x.firstName} ${x.lastName}`.trim();
const yearNow = (state = store.state) => state.year;

/**
 * Writes a line in the life story that opens a page of My Athletics when tapped: { screen, id } where screen is
 * 'season' | 'event' | 'sport' | 'team' | 'coach' | 'athlete' | a section of the hub ('hub:career').
 */
export function say(state, text, tone = 'neutral', link = null) {
  const e = { age: state.player.age, text, kind: 'system', tone };
  if (link) e.sport = link;
  state.journal.push(e);
  return e;
}

// ---------- The record ----------

export function ensure(state = store.state) {
  state.sports ??= { v: 1, seq: 0, athletes: {}, orgs: {}, teams: {}, coaches: {}, seasons: {}, events: {}, partnerships: {}, contracts: {},
    decisions: [], paid: {}, moments: [], tickYear: null, acts: { year: null, extra: 0 } };
  const S = state.sports;
  S.acts ??= { year: null, extra: 0 };
  if (!S.migrated) migrate(state);
  return S;
}
const nextId = (S, prefix) => `${prefix}_${(S.seq += 1).toString(36)}`;

// ---------- Divisions ----------
// Women and men play in their own leagues, clubs' teams, tours and events: a division is part of every org above
// recreational play (and of an org's key, so a women's club and a men's club in the same city are different clubs).
// Recreational play and the adaptive sports marked `mixed` are open to everyone. Someone non-binary, or whose division
// is not the one their gender suggests, chooses theirs (setDivision); everyone else's follows their gender.
export const DIVISION_NAME = { women: "Women's", men: "Men's", mixed: 'Mixed' };
export function divisionOf(state = store.state, p = state.player) {
  if (p.flags?.sportDiv) return p.flags.sportDiv;
  if (p.gender === 'female') return 'women';
  if (p.gender === 'male') return 'men';
  return p.flags?.bornAs === 'male' ? 'men' : 'women';
}
/** Whether this person chooses their own division: non-binary and transgender players do. */
export const choosesDivision = (p = player()) => p.gender !== 'male' && p.gender !== 'female' || (p.flags?.bornAs && p.flags.bornAs !== p.gender);
export function setDivision(div, state = store.state) {
  const p = state.player;
  if (!['women', 'men'].includes(div)) return result(false, 'There is no such division.', 'neutral');
  if (!choosesDivision(p)) return result(false, 'Your division follows your gender.', 'neutral');
  const a = profile(state);
  if (Object.values(a.sports).some((e) => e.orgId || e.contractId)) return result(false, 'Leave your club or team first: a division is chosen between clubs.', 'neutral');
  p.flags.sportDiv = div;
  return result(true, `You compete in the ${DIVISION_NAME[div].toLowerCase()} division.`, 'good');
}
/** The division an org of this level plays in, for this player. */
const orgDivision = (state, sport, level) => (level === 'recreational' || sport.mixed ? 'mixed' : divisionOf(state));
/** The gender of the invented names on a roster or in a draw for a division. */
const namesFor = (div, r) => (div === 'women' ? 'female' : div === 'men' ? 'male' : r.chance(0.5) ? 'male' : 'female');
/**
 * When anyone in a division could first be paid to play a sport, and (rarely) when that stopped. Women's professional
 * play began later in most sports (`womenProFrom`; null where there is none at all); some leagues closed again
 * (`womenProUntil`). Returns { open, from, until }.
 */
export function proYears(sport, div = divisionOf(), year = yearNow()) {
  const from = div === 'women' && sport.womenProFrom !== undefined && !sport.mixed ? sport.womenProFrom : sport.proFrom;
  const until = div === 'women' && !sport.mixed ? sport.womenProUntil ?? null : null;
  return { open: from != null && year >= from && (until == null || year <= until), from, until };
}

export const athleteOf = (id, state = store.state) => ensure(state).athletes[id] ?? null;
export const myAthlete = (state = store.state) => athleteOf(state.player.id, state);
export const entryOf = (sportId, id = store.state.player.id, state = store.state) => athleteOf(id, state)?.sports[sportId] ?? null;
export const orgOf = (id, state = store.state) => (id ? ensure(state).orgs[id] ?? null : null);
export const teamOf = (id, state = store.state) => (id ? ensure(state).teams[id] ?? null : null);
export const coachOf = (id, state = store.state) => (id ? ensure(state).coaches[id] ?? null : null);
export const seasonOf = (id, state = store.state) => ensure(state).seasons[id] ?? null;
export const eventOf = (id, state = store.state) => ensure(state).events[id] ?? null;
/** The sports this person plays now (not retired from), the main one first. */
export function activeSports(id = store.state.player.id, state = store.state) {
  const a = athleteOf(id, state);
  if (!a) return [];
  return Object.values(a.sports).filter((e) => e.status === 'active').sort((x, y) => (y.id === a.primary) - (x.id === a.primary) || y.since - x.since);
}

/** A value on the character by path: 'talents.sports', 'stats.health', 'hidden.discipline'. */
const val = (p, path) => path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), p) ?? 50;

/** Whether the person uses a wheelchair. Pathways has no wider disability system: this is the one marker the sports engine reads. */
export const usesWheelchair = (p = player()) => !!p.flags?.wheelchair || (p.conditions ?? []).some((c) => /wheelchair|paraly|spinal/.test(c.id));

/** Saves from before this engine: a school athlete's record becomes an athletic profile, conservatively. */
function migrate(state) {
  const S = state.sports;
  S.migrated = 1;
  const p = state.player;
  const old = p?.flags?.athlete;
  if (!p || !old?.seasons) return;
  const id = schoolSportId(old.sport, p.countryId);
  if (!id || S.athletes[p.id]?.sports[id]) return;
  const a = newAthlete(state, p);
  const e = newEntry(state, p, a, sportOf(id), state.year - old.seasons);
  // What the old record knew is a best rating; the skills are set a little below it, never above.
  const level = clamp(Math.round((old.best ?? 40) * 0.8), 10, 80);
  for (const k of Object.keys(e.skills)) e.skills[k] = Math.min(e.ceiling[k], level);
  e.level = 'school';
  e.legacySeasons = old.seasons;
  a.primary = id;
}

// ---------- Athletes ----------

function newAthlete(state, p) {
  const S = state.sports;
  const a = { id: p.id, name: fullName(p), gen: p.generation ?? 1, born: p.birthYear ?? state.year - p.age, countryId: p.countryId,
    sports: {}, primary: null, injuries: [], fame: 0, confidence: 55, motivation: 65, arcs: [], retired: null, agentId: null, coaching: null,
    parents: [] };
  // Parents with an athletic record of their own are remembered, so the family's legacy can be followed.
  for (const n of Object.values(state.npcs)) if (n.role === 'parent' && S.athletes[n.id]) a.parents.push({ id: n.id, name: fullName(n) });
  S.athletes[p.id] = a;
  return a;
}

/**
 * How far someone could go in each skill. It comes from their talent and the attributes the sport uses, plus a little
 * that is theirs alone. It is fixed for life: training moves a skill toward its ceiling and never past it.
 */
function ceilings(p, sport) {
  const r = seeded(`ceiling/${p.id}/${sport.id}`);
  const base = Object.entries(sport.attrs).reduce((s, [path, w]) => s + val(p, path) * w, 0);
  const out = {};
  for (const [k] of sport.skills) out[k] = Math.round(clamp(base * 0.75 + 28 + r.normal(0, 7), 25, 99));
  return out;
}

function newEntry(state, p, a, sport, since = state.year) {
  const r = seeded(`start/${p.id}/${sport.id}`);
  const ceiling = ceilings(p, sport);
  const age = p.age - (state.year - since);
  const skills = {};
  for (const [k] of sport.skills) skills[k] = Math.round(clamp(6 + r.int(0, 8) + (val(p, 'talents.sports') - 50) / 10 + Math.max(0, age - 10) / 2, 2, ceiling[k] - 5));
  const e = { id: sport.id, since, sinceAge: age, skills, ceiling, pr: 1000, played: 0, wins: 0, losses: 0, draws: 0, level: 'recreational',
    orgId: null, teamId: null, position: sport.positions?.[0]?.[0] ?? null, coachId: null, plan: { type: 'balanced', hours: 2 },
    fatigue: 0, form: 50, status: 'active', best: {}, titles: [], seasons: [], events: [], stats: {}, history: [], seasonsPlayed: 0 };
  a.sports[sport.id] = e;
  a.primary ??= sport.id;
  return e;
}

/**
 * A sport entry known only lightly (a relative's) given skills: worked out from the person's own talent and the level
 * they had reached, never above it. Used when a relative becomes the player.
 */
function fillEntry(state, p, e) {
  if (Object.keys(e.skills).length) return e;
  const sport = sportOf(e.id);
  e.ceiling = ceilings(p, sport);
  const level = Math.min(e.peak ?? 20, LEVEL_STRENGTH[e.level] ?? 30);
  for (const [k] of sport.skills) e.skills[k] = Math.round(Math.min(e.ceiling[k] - 3, level * 0.85));
  e.position ??= sport.positions?.[0]?.[0] ?? null;
  e.plan = { type: 'balanced', hours: e.status === 'active' ? 2 : 0 };
  e.orgId = null; e.teamId = null; e.coachId = null;
  return e;
}

/**
 * The player's entry in a sport, made without taking the sport up: for a record that exists already (a life saved
 * before there was one sports system). Skills come from their talent and the level given, as for a relative.
 */
export function pastEntry(sportId, o = {}, state = store.state) {
  const p = state.player;
  const a = profile(state);
  const sport = sportOf(sportId);
  const e = a.sports[sportId] ?? newEntry(state, p, a, sport, o.since ?? state.year);
  e.level = o.level ?? e.level;
  e.peak = Math.max(e.peak ?? 0, LEVEL_STRENGTH[e.level] ?? 30);
  return e;
}

/** Which side of professional sport someone plays in: the women's or the men's game. Non-binary players choose (flags.sportDiv). */
export const divOf = (p = player()) => divisionOf(store.state, p);
/** The first year someone could be paid to play: later for women in some sports. */
// A league that has closed (womenProUntil) counts as never having begun, for anyone asking from after it closed.
export const proFromFor = (sport, p = player(), year = yearNow()) => { const y = proYears(sport, divOf(p), year); return y.from == null || (y.until != null && year > y.until) ? Infinity : y.from; };

/** The character's athletic profile, made the first time it is needed. */
export function profile(state = store.state) {
  const S = ensure(state);
  return S.athletes[state.player.id] ?? newAthlete(state, state.player);
}

/** How good someone is at a sport overall, 0–100: their skills (weighted by position), and their body and head on the day. */
export function overall(e, p = player(), position = e.position) {
  const sport = sportOf(e.id);
  const pos = sport.positions?.find((x) => x[0] === position);
  const w = pos?.[2] ?? Object.fromEntries(sport.skills.map(([k]) => [k, 1 / sport.skills.length]));
  const skill = Object.entries(w).reduce((s, [k, x]) => s + (e.skills[k] ?? 0) * x, 0);
  const body = Object.entries(sport.attrs).reduce((s, [path, x]) => s + val(p, path) * x, 0);
  const tired = Math.max(0, e.fatigue - 55) / 3;
  return Math.round(clamp(skill * 0.8 + body * 0.2 - tired + (e.form - 50) / 10));
}
/** The skill a measured event (a race, a jump) leans on: the sport's skills, evenly. */
const meanSkill = (e) => Object.values(e.skills).reduce((s, v) => s + v, 0) / Math.max(1, Object.keys(e.skills).length);

/** A plain description of a skill value. */
export const skillWord = (v) => (v >= 90 ? 'World class' : v >= 80 ? 'Elite' : v >= 68 ? 'Advanced' : v >= 52 ? 'Competitive' : v >= 36 ? 'Developing' : v >= 20 ? 'Learning' : 'Beginner');
/** The Pathways Rating as a band. */
export const prWord = (pr) => (pr >= 1900 ? 'World elite' : pr >= 1650 ? 'International' : pr >= 1450 ? 'National' : pr >= 1250 ? 'Regional' : pr >= 1050 ? 'Club' : 'Recreational');

// ---------- What can be played, where and when ----------

/**
 * Whether the player can take up a sport now, and if not, why. Sports exist only from their founding year; adaptive
 * sports are for players who use a wheelchair, and standing sports in their usual form are not.
 */
export function canPlay(sportId, p = player(), state = store.state) {
  const sport = sportOf(sportId);
  if (!sport) return result(false, 'There is no such sport.');
  if (state.year < sport.founded) return result(false, `${sport.name} is not played yet in ${state.year}.`, 'neutral');
  if (p.age < sport.minAge) return result(false, `${sport.name} starts from age ${sport.minAge}.`, 'neutral');
  const wheel = usesWheelchair(p);
  if (sport.adaptive && !wheel) return result(false, `${sport.name} is played by athletes who use a wheelchair.`, 'neutral');
  if (wheel && sport.standing === false) return result(false, `${sport.name} in its usual form is not played from a wheelchair. ${SPORTS_LIST.some((s) => s.adaptive?.of === sport.id) ? `Try ${SPORTS_LIST.find((s) => s.adaptive?.of === sport.id).name.toLowerCase()}.` : ''}`.trim(), 'neutral');
  if (p.legal?.incarceration) return result(false, 'Not while you are in prison.', 'neutral');
  return result(true, '');
}
/** Every sport, with whether it can be taken up now. Popular sports where the player lives come first. */
export function sportsMenu(p = player(), state = store.state) {
  return SPORTS_LIST.map((s) => ({ sport: s, ...canPlay(s.id, p, state), playing: entryOf(s.id, p.id, state)?.status === 'active', popular: s.popular.includes(p.countryId) }))
    .filter((x) => state.year >= x.sport.founded)
    .sort((a, b) => b.playing - a.playing || b.popular - a.popular || a.sport.name.localeCompare(b.sport.name));
}
/** The way into paid sport where the player lives. */
export function proPath(sport, countryId = player().countryId) {
  if (sport.pro === 'draft') return draftCountry(sport, countryId) ? 'draft' : sport.proElse ?? 'signing';
  return sport.pro;
}
/** Whether universities in this country run teams that recruit, with scholarships. */
export const hasCollegeSport = (sport, countryId = player().countryId) => sport.college.includes(countryId);

// ---------- Taking up and giving up a sport ----------

export function takeUp(sportId, state = store.state) {
  const p = state.player;
  const ok = canPlay(sportId, p, state);
  if (!ok.ok) return ok;
  const a = profile(state);
  const sport = sportOf(sportId);
  let e = a.sports[sportId];
  if (e?.status === 'active') return result(false, `You already play ${sport.name.toLowerCase()}.`, 'neutral');
  if (activeSports(p.id, state).length >= 3) return result(false, 'You already play three sports. Give one up first.', 'neutral');
  if (e) fillEntry(state, p, e);
  if (e) {
    // Back after a break: remembered, so the comeback can be told when the first season back is played.
    const away = state.year - (e.stoppedYear ?? e.retiredYear ?? state.year);
    if (away >= 2) e.comeback = { from: e.stoppedYear ?? e.retiredYear, year: state.year, age: p.age };
    e.status = 'active'; e.level = 'recreational'; e.plan = { type: 'balanced', hours: 2 };
  }
  else e = newEntry(state, p, a, sport);
  if (!a.primary || a.sports[a.primary]?.status !== 'active') a.primary = sportId;
  joinOrg(rec(state, sport), state, { quiet: true });
  moment(state, { type: 'start', sportId, text: `Took up ${sport.name.toLowerCase()}.`, sig: 2 });
  const text = `You took up ${sport.name.toLowerCase()}${p.age < 12 ? ', with a local group for kids' : ' at a local club'}. Two hours a week, to start with.`;
  log(text, 'system', 'good');
  return result(true, text);
}
export function giveUp(sportId, state = store.state) {
  const e = entryOf(sportId, state.player.id, state);
  if (!e || e.status !== 'active') return result(false, 'You do not play that.', 'neutral');
  if (e.contractId && ensure(state).contracts[e.contractId]?.status === 'active') return result(false, 'You are under contract. Retire, or see the contract out.', 'neutral');
  leaveOrg(e, state, 'stopped playing');
  e.status = 'stopped';
  e.stoppedYear = state.year;
  e.plan.hours = 0;
  const a = myAthlete(state);
  if (a.primary === sportId) a.primary = activeSports(state.player.id, state)[0]?.id ?? sportId;
  moment(state, { type: 'stop', sportId, text: `Stopped playing ${sportOf(sportId).name.toLowerCase()}.`, sig: 1 });
  const text = `You stopped playing ${sportOf(sportId).name.toLowerCase()}.`;
  log(text);
  return result(true, text, 'neutral');
}
export function setPrimary(sportId, state = store.state) {
  const a = myAthlete(state);
  if (!a?.sports[sportId] || a.sports[sportId].status !== 'active') return result(false, 'You do not play that.', 'neutral');
  a.primary = sportId;
  return result(true, `${sportOf(sportId).name} is your main sport now.`, 'neutral');
}
export function setPosition(sportId, pos, state = store.state) {
  const e = entryOf(sportId, state.player.id, state);
  const sport = sportOf(sportId);
  if (!e || !sport.positions?.some((x) => x[0] === pos)) return result(false, 'That position does not exist.', 'neutral');
  e.position = pos;
  return result(true, `You will play as ${sport.positions.find((x) => x[0] === pos)[1].toLowerCase()}.`, 'neutral');
}

// ---------- Training ----------

/** Hours a week of training, across every sport not paid for as a job. Counted in the week (engine/worklife.js). */
export function trainingHours(state = store.state) {
  const a = myAthlete(state);
  if (!a) return 0;
  return activeSports(a.id, state).filter((e) => !e.contractId).reduce((s, e) => s + (e.plan?.hours ?? 0), 0);
}
export function setPlan(sportId, type, hours, state = store.state) {
  const e = entryOf(sportId, state.player.id, state);
  if (!e || e.status !== 'active') return result(false, 'You do not play that.', 'neutral');
  if (!PLANS[type]) return result(false, 'There is no such plan.', 'neutral');
  if (!LOADS.some((l) => l.hours === hours)) return result(false, 'Choose one of the set amounts.', 'neutral');
  const p = state.player;
  const others = trainingHours(state) - (e.contractId ? 0 : e.plan.hours);
  if (p.age < 14 && hours > 10) return result(false, 'Children this young do not train like that. Ten hours is the most.', 'neutral');
  if (!e.contractId && others + hours > 30) return result(false, `That would be ${others + hours} hours a week of training. There is not time for it.`, 'neutral');
  e.plan = { type, hours };
  return result(true, `${PLANS[type].name}, ${hours} hours a week.`, 'neutral');
}

/** How fast someone learns at an age. Young players learn fastest; the body starts to give ground in the thirties. */
const ageFactor = (age) => (age < 10 ? 0.75 : age < 14 ? 1 : age < 22 ? 1.15 : age < 27 ? 0.85 : age < 31 ? 0.55 : 0.3);
/** Training hours count less and less: the eighteenth hour of the week adds far less than the second. */
const hoursFactor = (h) => (h <= 0 ? 0 : Math.pow(h / 5, 0.55));
const kindOf = (k) => (SKILL_KIND.physical.includes(k) ? 'physical' : SKILL_KIND.mental.includes(k) ? 'mental' : 'technical');

/** A year of training in one sport. Gains shrink as a skill nears its ceiling. Returns the skills that moved. */
function trainYear(state, p, a, e) {
  const sport = sportOf(e.id);
  const plan = PLANS[e.plan.type] ?? PLANS.balanced;
  const club = coachOf(e.coachId, state);
  const own = coachOf(e.privateCoachId, state);
  const coach = own && (!club || own.quality >= club.quality) ? own : club;
  const cq = (coach ? 0.7 + coach.quality / 200 : 0.65) + (own && club ? 0.05 : 0) + (e.mentorId ? 0.05 : 0);
  const disc = 0.8 + val(p, 'hidden.discipline') / 250;
  const injured = a.injuries.some((x) => x.sportId === e.id && x.status === 'out');
  const base = 5.5 * hoursFactor(e.plan.hours) * ageFactor(p.age) * cq * disc * plan.k * (injured ? 0.35 : 1) * (0.6 + a.motivation / 160);
  const r = seeded(`train/${a.id}/${e.id}/${state.year}`);
  const moved = {};
  for (const [k] of sport.skills) {
    const focus = plan.focus && kindOf(k) === plan.focus ? 1.45 : plan.focus ? 0.8 : 1;
    const style = coach?.specialty === kindOf(k) ? 1.15 : 1;
    const room = Math.max(0, e.ceiling[k] - e.skills[k]) / Math.max(1, e.ceiling[k]);
    let d = base * focus * style * room * (0.75 + r.next() * 0.5);
    // After about thirty the body loses ground in what it does fastest, whatever the training.
    if (p.age >= 30 && kindOf(k) === 'physical') d -= (p.age - 29) * 0.45;
    if (e.plan.hours === 0) d -= 1.5; // a skill not used fades
    const before = e.skills[k];
    e.skills[k] = Math.round(clamp(e.skills[k] + d, 0, e.ceiling[k]) * 10) / 10;
    if (Math.round(e.skills[k]) !== Math.round(before)) moved[k] = Math.round(e.skills[k] - before);
  }
  // Fatigue: hours wear the body down, a recovery plan and youth bring it back.
  const load = e.plan.hours * (plan.recovery ? 1.2 : 2.6);
  e.fatigue = Math.round(clamp(e.fatigue * 0.35 + load - (plan.recovery ? 18 : 0) - (p.age < 20 ? 4 : 0)));
  e.form = Math.round(clamp(50 + (plan.form ?? 0) + (a.confidence - 55) / 3 - Math.max(0, e.fatigue - 60) / 2));
  if (plan.health) p.stats.health = clamp(p.stats.health + plan.health);
  return moved;
}

/**
 * An extra session between years: a few hours on one skill. Three a year at most, and each one adds to how tired
 * the player is. There is no way to click past the limit.
 */
export const EXTRA_PER_YEAR = 3;
export function extraSession(sportId, skill, state = store.state) {
  const S = ensure(state);
  const p = state.player;
  const e = entryOf(sportId, p.id, state);
  if (!e || e.status !== 'active') return result(false, 'You do not play that.', 'neutral');
  if (!e.skills[skill] && e.skills[skill] !== 0) return result(false, 'That is not part of this sport.', 'neutral');
  if (S.acts.year !== state.year) S.acts = { year: state.year, extra: 0 };
  if (S.acts.extra >= EXTRA_PER_YEAR) return result(false, `You have put in ${EXTRA_PER_YEAR} extra sessions this year already. The rest has to wait for next year.`, 'neutral');
  if (myAthlete(state).injuries.some((x) => x.sportId === sportId && x.status === 'out')) return result(false, 'Not while you are injured. Follow the rehab plan.', 'neutral');
  S.acts.extra += 1;
  const room = Math.max(0, e.ceiling[skill] - e.skills[skill]) / Math.max(1, e.ceiling[skill]);
  const d = Math.round(3 * ageFactor(p.age) * room * 10) / 10;
  e.skills[skill] = Math.min(e.ceiling[skill], Math.round((e.skills[skill] + d) * 10) / 10);
  e.fatigue = clamp(e.fatigue + 8);
  const name = sportOf(sportId).skills.find((x) => x[0] === skill)[1].toLowerCase();
  const text = d >= 0.5 ? `You put in an extra session on your ${name}. It is coming along.` : `You put in an extra session on your ${name}. There is not much more to get from it: you are near what your body allows.`;
  log(text);
  return result(true, text, 'neutral');
}

// ---------- Organizations, teams and coaches ----------

const cityOf = (p) => p.city ?? COUNTRIES[p.countryId].cities?.[0] ?? 'Home';
/** A name that stays the same for this key. */
function orgName(r, kind, sport, city) {
  if (kind === 'rec') return `${city} ${sport.kind === 'team' ? 'Youth' : 'Community'} ${sport.name}`;
  if (kind === 'academy') return `${r.pick(CLUB_WORDS)} ${sport.name} Academy`;
  if (kind === 'pro') return `${city} ${r.pick(sport.kind === 'team' ? mascotsFor(sport) : TEAM_WORDS)}`;
  return `${r.pick(CLUB_WORDS)} ${sport.kind === 'team' ? r.pick(mascotsFor(sport)) : `${sport.name} Club`}`;
}
/** Strength of an org's teams, by level: what a typical player there is like. */
const LEVEL_STRENGTH = { recreational: 28, club: 45, school: 42, academy: 60, college: 64, pro: 76, elite: 80 };

/** How strong a college division's teams are, against the usual college level: Division I is the best. */
const DIVISION_STRENGTH = { D1: 4, IVY: -4, D2: -6, JUCO: -8, NAIA: -10, D3: -14 };
/** Puts a college program in its division, once: its strength follows. */
export function setCollegeDivision(org, division) {
  if (!org || org.division) return org;
  org.division = division;
  org.strength = Math.round(org.strength + (DIVISION_STRENGTH[division] ?? 0));
  return org;
}

/** The org of a kind for a sport in the player's city, made once and found again after. */
function findOrg(state, sport, level, o = {}) {
  const S = ensure(state);
  const p = state.player;
  const city = o.city ?? cityOf(p);
  const division = o.div ?? orgDivision(state, sport, level);
  const key = (o.key ?? `${level}/${sport.id}/${p.countryId}/${city}/${o.n ?? 0}`) + (division === 'women' ? '/women' : '');
  const had = Object.values(S.orgs).find((x) => x.key === key);
  if (had) return had;
  const r = seeded(`org/${key}`);
  const id = nextId(S, 'org');
  const kind = level === 'recreational' ? 'rec' : level;
  const base = o.name ?? orgName(r, kind, sport, city);
  const name = division !== 'women' ? base : level === 'school' ? `${base} (girls)` : /Tour$/.test(base) ? base.replace(/ Tour$/, " Women's Tour") : `${base} Women`;
  const org = { id, key, kind, level, div: division, sportId: sport.id, name, countryId: o.countryId ?? p.countryId, city,
    founded: Math.max(sport.founded, state.year - r.int(5, 90)), strength: Math.round(LEVEL_STRENGTH[level] + r.int(-6, 6) + (o.strength ?? 0)),
    coachId: null, teamIds: [], leagueId: null, history: [], uniId: o.uniId ?? null, tier: o.tier ?? null };
  if (o.division) setCollegeDivision(org, o.division);
  S.orgs[id] = org;
  return org;
}
const rec = (state, sport) => findOrg(state, sport, 'recreational');

/** A coach for an org: a real person, kept, with their own way of coaching. */
function coachFor(state, org) {
  const S = ensure(state);
  const had = org.coachId ? S.coaches[org.coachId] : null;
  // A coach is a person the player can know. One who is no longer among the people of this life (they died, or the
  // story has passed to another generation and they were not carried over) has left the club: a new coach takes over.
  if (had && state.npcs[had.id]?.alive) return had;
  if (had) { had.history.push({ year: state.year, orgId: org.id, text: `Left ${org.name}.` }); had.until ??= state.year; }
  const r = seeded(`coach/${org.id}/${had ? state.year : 0}`);
  const sport = sportOf(org.sportId);
  const npc = makeNpc({ role: 'coach', countryId: org.countryId, age: r.int(29, 62), relationship: 45 });
  npc.flags.title = org.kind === 'rec' ? `${sport.name} coach` : `Coach, ${org.name}`;
  npc.flags.sport = sport.id;
  state.npcs[npc.id] = npc;
  const quality = Math.round(clamp(LEVEL_STRENGTH[org.level] + r.int(-12, 14), 25, 97));
  const c = { id: npc.id, name: fullName(npc), sportId: sport.id, quality, style: r.pick(['supportive', 'demanding', 'technical', 'tactical']),
    specialty: r.pick(['technical', 'physical', 'mental']), orgId: org.id, since: state.year, history: [{ year: state.year, orgId: org.id, text: `Took charge at ${org.name}.` }], players: [] };
  S.coaches[npc.id] = c;
  org.coachId = npc.id;
  return c;
}
/** The coach comes into the player's life: they know each other now. */
function meetCoach(state, c) {
  const p = state.player;
  const n = state.npcs[c.id];
  if (n && n.alive && !p.npcIds.includes(c.id)) { p.npcIds.push(c.id); n.lastInteractionAge = p.age; }
  if (!c.players.includes(p.id)) c.players.push(p.id);
}
export const COACH_STYLE = {
  supportive: 'Patient and encouraging. Players stay with the game.',
  demanding: 'Hard to please, quick to drop people. Some players thrive on it.',
  technical: 'Breaks every movement down. Skills come on fast.',
  tactical: 'Talks about decisions more than drills. Players read the game better.',
};

/** Invented names for the rest of a roster, from the country's own names. */
function rosterNames(r, countryId, n, div = 'mixed') {
  const names = COUNTRIES[countryId].names;
  const out = [];
  for (let i = 0; i < n; i++) { const g = namesFor(div, r); out.push(`${r.pick(names[g] ?? names.female)} ${r.pick(names.last)}`); }
  return out;
}

/** The team of an org for this player's age group, made once. Rosters are names and ratings, kept from year to year. */
function teamFor(state, org, p = state.player) {
  const S = ensure(state);
  const sport = sportOf(org.sportId);
  const group = ['pro', 'college', 'elite'].includes(org.level) || p.age >= 19 ? 'senior' : p.age < 12 ? 'u12' : p.age < 15 ? 'u15' : 'u19';
  const had = org.teamIds.map((id) => S.teams[id]).find((t) => t?.group === group);
  if (had) return had;
  const r = seeded(`team/${org.id}/${group}`);
  const id = nextId(S, 'team');
  const size = sport.kind === 'team' ? (sport.teamSize ?? 11) + 6 : 8;
  const positions = sport.positions ?? [[null, 'Member']];
  const roster = rosterNames(r, org.countryId, size, org.div).map((name, i) => ({ id: `r_${id}_${i}`, name, pos: positions[i % positions.length][0],
    rating: Math.round(clamp(org.strength + r.normal(0, 7) - (group === 'senior' ? 0 : 4), 10, 95)), since: state.year - r.int(0, 3) }));
  const t = { id, orgId: org.id, sportId: sport.id, group, name: group === 'senior' ? org.name : `${org.name} ${group.toUpperCase()}`, roster, history: [], captainId: null };
  S.teams[id] = t;
  org.teamIds.push(id);
  return t;
}
const teamStrength = (t) => Math.round(t.roster.slice().sort((a, b) => b.rating - a.rating).slice(0, sportOf(t.sportId).teamSize ?? 6).reduce((s, x) => s + x.rating, 0) / Math.min(t.roster.length, sportOf(t.sportId).teamSize ?? 6));

/**
 * A few teammates become people the player knows: the captain, the one in the same position, the joker. They are kept
 * (state.npcs, role 'teammate') and named in the roster by their id.
 */
function meetTeammates(state, t) {
  const p = state.player;
  const r = seeded(`mates/${t.id}/${p.id}`);
  const known = t.roster.filter((x) => x.npcId && state.npcs[x.npcId]);
  if (known.length >= 2 || sportOf(t.sportId).kind !== 'team' && sportOf(t.sportId).kind !== 'racket') return known;
  for (const slot of r.shuffle(t.roster.filter((x) => !x.npcId && x.id !== p.id)).slice(0, 2 - known.length)) {
    const [first, ...last] = slot.name.split(' ');
    const div = orgOf(t.orgId, state)?.div;
    const gender = div === 'women' ? 'female' : div === 'men' ? 'male' : undefined;
    const n = makeNpc({ role: 'teammate', countryId: state.player.countryId, age: Math.max(6, p.age + r.int(-1, 2)), relationship: r.int(40, 62), firstName: first, lastName: last.join(' '), gender });
    n.flags.title = `Teammate, ${t.name}`;
    n.flags.sport = t.sportId;
    n.flags.talents = { sports: slot.rating };
    state.npcs[n.id] = n;
    p.npcIds.push(n.id);
    slot.npcId = n.id;
    slot.name = fullName(n);
    known.push(slot);
  }
  return known;
}

/** Joins an org: the player goes on its roster, meets its coach, and their entry points at it. */
function joinOrg(org, state, o = {}) {
  const p = state.player;
  const e = entryOf(org.sportId, p.id, state);
  const sport = sportOf(org.sportId);
  if (e.orgId && e.orgId !== org.id) leaveOrg(e, state, 'moved on');
  const t = teamFor(state, org, p);
  if (!t.roster.some((x) => x.id === p.id)) t.roster.push({ id: p.id, name: fullName(p), pos: e.position, rating: overall(e, p), since: state.year, player: true });
  const c = coachFor(state, org);
  meetCoach(state, c);
  e.orgId = org.id; e.teamId = t.id; e.coachId = c.id;
  if (LEVELS.indexOf(org.level) >= 0) e.level = org.level;
  e.history.push({ year: state.year, orgId: org.id, teamId: t.id, level: org.level, name: org.name });
  if (sport.kind === 'team' || sport.kind === 'racket') meetTeammates(state, t);
  if (!o.quiet) moment(state, { type: 'join', sportId: org.sportId, text: `Joined ${org.name}.`, sig: org.level === 'recreational' ? 1 : 2, orgId: org.id });
  return t;
}
/** Players move up an age group as they grow: the same club, its next team. */
function regroup(state, e) {
  const p = state.player;
  const org = orgOf(e.orgId, state);
  const t = teamOf(e.teamId, state);
  if (!org || !t) return;
  const want = teamFor(state, org, p);
  if (want.id === t.id) return;
  t.roster = t.roster.filter((x) => x.id !== p.id);
  if (!want.roster.some((x) => x.id === p.id)) want.roster.push({ id: p.id, name: fullName(p), pos: e.position, rating: overall(e, p), since: state.year, player: true });
  e.teamId = want.id;
  if (sportOf(org.sportId).kind === 'team') meetTeammates(state, want);
}
/**
 * Off a university team, however it happens (leaving the team, giving up the sport, retiring, leaving the club): the
 * athletic part of a scholarship goes with it, from the next year's fees. Returns whether there was one.
 */
export function dropAthleticAid(state, sportId) {
  const p = state.player;
  const edu = p.education;
  p.flags.sportOffers = (p.flags.sportOffers ?? []).map((o) => (o.sportId === sportId && o.accepted ? { ...o, accepted: false, left: state.year } : o));
  const athletic = (edu.aidParts ?? []).find((x) => x.kind === 'athletic');
  if (!athletic) return false;
  edu.aidParts = edu.aidParts.filter((x) => x !== athletic);
  edu.aid = Math.max(0, Math.round(((edu.aid ?? 0) - athletic.fraction) * 100) / 100);
  if (edu.funding === 'scholarship' && edu.aid < 1) edu.funding = 'loan';
  return true;
}
function leaveOrg(e, state, why) {
  const t = teamOf(e.teamId, state);
  if (t) {
    t.roster = t.roster.filter((x) => x.id !== state.player.id);
    t.history.push({ year: state.year, text: `${fullName(state.player)} left (${why}).` });
  }
  const last = e.history.at(-1);
  if (last && !last.to) last.to = state.year;
  const n = state.npcs[e.coachId];
  if (n) n.flags.title = `Former coach (${sportOf(e.id).name.toLowerCase()})`;
  const org = orgOf(e.orgId, state);
  if (org?.kind === 'college') { e.leftCollege = org.uniId; dropAthleticAid(state, e.id); }
  e.orgId = null; e.teamId = null; e.coachId = null;
  if (e.level !== 'pro') e.level = 'recreational';
}

/** The places the player could try out for, for a sport. Each is a real, persistent org. */
export function clubsFor(sportId, state = store.state) {
  const p = state.player;
  const sport = sportOf(sportId);
  const out = [];
  const pop = sport.popular.includes(p.countryId) ? 2 : 1;
  for (let i = 0; i < pop; i++) out.push(findOrg(state, sport, 'club', { n: i }));
  if (p.age >= 10 && p.age <= 18 && (sport.popular.includes(p.countryId) || sport.depth === 'full')) out.push(findOrg(state, sport, 'academy'));
  return out.map((org) => ({ org, bar: tryoutBar(org), ...tryoutOpen(org, state) }));
}
const tryoutBar = (org) => Math.round(org.strength - (org.level === 'academy' ? 4 : 12));
function tryoutOpen(org, state) {
  const p = state.player;
  if (org.level === 'academy' && (p.age < 10 || p.age > 18)) return { open: false, why: 'Academies take players from ten to eighteen.' };
  const e = entryOf(org.sportId, p.id, state);
  if (!e || e.status !== 'active') return { open: false, why: `You do not play ${sportOf(org.sportId).name.toLowerCase()}.` };
  if (e.orgId === org.id) return { open: false, why: 'You are already there.' };
  if (e.contractId) return { open: false, why: 'You are under contract with a professional club.' };
  if (org.tried?.[p.id] === state.year) return { open: false, why: 'You tried out this year. They will look again next year.' };
  return { open: true, why: '' };
}

/**
 * A tryout. The coach watches the player against the level the club plays at. It can be tried once a year per club, and
 * the outcome is the same however many times the save is reloaded: it is drawn from this club, player and year.
 */
export function tryOut(orgId, state = store.state) {
  const org = orgOf(orgId, state);
  if (!org) return result(false, 'There is no such club.', 'neutral');
  const p = state.player;
  const open = tryoutOpen(org, state);
  if (!open.open) return result(false, open.why, 'neutral');
  const e = entryOf(org.sportId, p.id, state);
  const sport = sportOf(org.sportId);
  if (org.level === 'academy' && !academyAffordable(state)) return result(false, `The academy costs ${fmtMoney(localMoney(sport.lesson * 3, COUNTRIES[p.countryId]), COUNTRIES[p.countryId])} a year, and your family cannot find it.`, 'neutral');
  (org.tried ??= {})[p.id] = state.year;
  const r = seeded(`tryout/${org.id}/${p.id}/${state.year}`);
  const showing = overall(e, p) + r.normal(0, 5) + (a11yNerves(state) ? -2 : 0);
  const bar = tryoutBar(org);
  const c = coachFor(state, org);
  if (showing < bar) {
    p.stats.mood = clamp(p.stats.mood - 4);
    myAthlete(state).confidence = clamp(myAthlete(state).confidence - 4);
    const near = showing >= bar - 5;
    const text = `You tried out for ${org.name}. ${c.name.split(' ')[0]}, the coach, ${near ? 'said it was close, and to come back next year' : 'thanked you, and said you were not ready yet'}.`;
    say(state, text, 'bad', { screen: 'sport', id: org.sportId });
    moment(state, { type: 'tryout', sportId: org.sportId, text: `Tried out for ${org.name} and was not taken.`, sig: 1, orgId: org.id });
    return result(false, text);
  }
  joinOrg(org, state);
  myAthlete(state).confidence = clamp(myAthlete(state).confidence + 5);
  const text = `You made it: ${org.name} took you on. Your coach is ${c.name}${c.style ? `, ${c.style === 'demanding' ? 'who expects a lot' : c.style === 'supportive' ? 'who is patient with young players' : c.style === 'technical' ? 'who drills technique' : 'who talks tactics'}` : ''}.`;
  say(state, text, 'good', { screen: 'team', id: entryOf(org.sportId, p.id, state).teamId });
  if (org.level === 'academy') milestone(`Joined the ${org.name}.`, 'career');
  return result(true, text);
}
const a11yNerves = (state) => (myAthlete(state)?.confidence ?? 55) < 35;
function academyAffordable(state) {
  const p = state.player;
  if (p.age >= 18) return p.finance.cash > 0;
  // Children are as well off as their parents. A poor family is offered a place only with help, which the best get.
  const parents = livingNpcs().filter((n) => n.role === 'parent');
  if (!parents.length) return true;
  const w = parents.reduce((s, n) => s + (n.wealth ?? n.meters.money), 0) / parents.length;
  return w >= 30;
}
/** Leaves a club or academy and goes back to playing for fun. */
export function leaveClub(sportId, state = store.state) {
  const e = entryOf(sportId, state.player.id, state);
  if (!e?.orgId) return result(false, 'You are not with a club.', 'neutral');
  if (e.contractId) return result(false, 'You are under contract.', 'neutral');
  const org = orgOf(e.orgId, state);
  if (org.kind === 'school') return result(false, 'Leave the school team from your school activities.', 'neutral');
  const scholarship = org.kind === 'college' && (state.player.education.aidParts ?? []).some((x) => x.kind === 'athletic');
  leaveOrg(e, state, 'left');
  joinOrg(rec(state, sportOf(sportId)), state, { quiet: true });
  const text = `You left ${org.name}.${scholarship ? ' The athletic scholarship goes with it: from next year you pay that part of the tuition.' : ''}`;
  log(text);
  return result(true, text, 'neutral');
}

// ---------- The school team (engine/schoollife.js plays the season through here) ----------

/** The registry's sport for a school sport's name, where there is one. Others stay with the school's own simple season. */
export function schoolSportId(name, countryId) {
  const n = String(name ?? '').toLowerCase();
  if (n === 'football') return countryId === 'us' ? 'american_football' : 'soccer';
  return { soccer: 'soccer', 'american football': 'american_football', basketball: 'basketball', baseball: 'baseball', softball: 'softball',
    'track and field': 'track', athletics: 'track', swimming: 'swimming', tennis: 'tennis', volleyball: 'volleyball', 'ice hockey': 'ice_hockey',
    rugby: 'rugby', cricket: 'cricket', badminton: 'badminton', judo: 'martial_arts', taekwondo: 'martial_arts', wrestling: 'wrestling',
    golf: 'golf', pickleball: 'pickleball' }[n] ?? null;
}
/**
 * A season with the school team, played through the engine: the school's team, its coach, its league and its record are
 * kept. Returns how the player played (0–100) for the school's own record of clubs, or null if the sport is not one the
 * engine knows.
 */
export function schoolSeason(name, state = store.state) {
  const p = state.player;
  const id = schoolSportId(name, p.countryId);
  if (!id || !canPlay(id, p, state).ok) return null;
  const a = profile(state);
  const sport = sportOf(id);
  let e = a.sports[id];
  // Playing for the school team is playing the sport: one given up is taken up again, within the three-sport limit.
  if (e?.status !== 'active' && activeSports(p.id, state).length >= 3) return null;
  if (!e) e = newEntry(state, p, a, sport);
  if (e.status !== 'active') { fillEntry(state, p, e); e.status = 'active'; e.plan = { type: 'balanced', hours: Math.max(2, e.plan?.hours ?? 0) }; }
  const school = schoolName(p);
  // The team belongs to the school, where the school is: a boarder whose family moves abroad stays on the same team.
  const where = (atSchool(p) ? currentSchool()?.countryId : null) ?? p.countryId;
  const org = findOrg(state, sport, 'school', { key: `school/${id}/${where}/${school}`, name: `${school} ${sport.name}` });
  e.schoolSport = name;
  if (e.orgId !== org.id && !e.contractId && !['club', 'academy', 'college', 'pro', 'elite'].includes(e.level)) joinOrg(org, state);
  else if (e.orgId !== org.id) { // a club or academy player still plays for their school; the school team is a second team
    e.schoolTeamId = teamFor(state, org).id;
    if (!teamOf(e.schoolTeamId, state).roster.some((x) => x.id === p.id)) teamOf(e.schoolTeamId, state).roster.push({ id: p.id, name: fullName(p), pos: e.position, rating: overall(e, p), since: state.year, player: true });
  }
  return e.lastRating ?? overall(e, p);
}
/** The name of the school the player attends, for its teams. */
function schoolName(p) {
  const s = atSchool(p) ? currentSchool() : null;
  return s?.name ?? p.education.schoolName ?? 'School';
}
/**
 * Once a year: a player no longer on the school team (they left it, left school, or changed school) is off its roster,
 * and back to their club or to playing for fun. Returns whether anything changed.
 */
export function checkSchoolTeam(state, e) {
  const p = state.player;
  const onTeam = atSchool(p) && p.education.clubs?.includes('sports_team') && schoolSportId(p.education.sport, p.countryId) === e.id;
  const org = orgOf(e.orgId, state);
  const school = schoolName(p);
  let changed = false;
  if (org?.kind === 'school' && (!onTeam || !org.key.endsWith(`/${school}`))) {
    leaveOrg(e, state, onTeam ? 'changed school' : 'left the school team');
    // Still on the school sports team, at a new school: that school's team, straight away.
    if (onTeam) schoolSeason(p.education.sport, state); else joinOrg(rec(state, sportOf(e.id)), state, { quiet: true });
    changed = true;
  }
  const second = teamOf(e.schoolTeamId, state);
  if (second && (!onTeam || !orgOf(second.orgId, state)?.key.endsWith(`/${school}`))) { second.roster = second.roster.filter((x) => x.id !== p.id); e.schoolTeamId = null; changed = true; }
  return changed;
}
/** Called when the player leaves the school team (engine/education.js). */
export function leftSchoolTeam(name, state = store.state) {
  const id = schoolSportId(name, state.player.countryId);
  const e = id ? entryOf(id, state.player.id, state) : null;
  if (!e) return;
  if (orgOf(e.orgId, state)?.kind === 'school') { leaveOrg(e, state, 'left the school team'); joinOrg(rec(state, sportOf(id)), state, { quiet: true }); }
  const second = teamOf(e.schoolTeamId, state);
  if (second) { second.roster = second.roster.filter((x) => x.id !== state.player.id); e.schoolTeamId = null; }
}

// ---------- Leagues and seasons ----------

/** The league an org's team plays in: seven rival teams of the same level nearby, kept from year to year. */
function leagueFor(state, org, team) {
  const S = ensure(state);
  const sport = sportOf(org.sportId);
  const key = `league/${org.level}/${sport.id}/${org.countryId}/${team.group}/${org.tier ?? 0}${org.minorLevel ? `/${org.minorLevel}` : ''}${org.div === 'women' ? '/women' : ''}${org.level === 'college' && org.division ? `/${org.division}` : ''}`;
  let lg = Object.values(S.orgs).find((x) => x.key === key);
  if (!lg) {
    const r = seeded(key);
    const id = nextId(S, 'org');
    const cities = COUNTRIES[org.countryId].cities ?? [org.city];
    lg = { id, key, kind: 'league', level: org.level, div: org.div ?? null, sportId: sport.id, countryId: org.countryId, city: org.city, teamIds: [],
      // A college league is a conference within the program's division.
      name: /League$/.test(org.minorLevel ?? '') ? org.minorLevel : org.minorLevel === 'Farm team' ? r.pick(['Eastern League', 'Western League']) : org.minorLevel ? `${org.minorLevel === 'Practice squad' ? 'Practice' : org.minorLevel} ${r.pick(['Pacific Coast', 'International', 'Eastern', 'Southern', 'Texas', 'Midwest', 'Carolina', 'Florida State', 'Northwest', 'California'])} League` : org.level === 'college' && org.division ? `${DIVISION_NAMES[org.division] ?? org.division} ${r.pick(['Mountain', 'Coastal', 'Valley', 'Great Lakes', 'Sun', 'Prairie', 'Atlantic', 'Pacific', 'Heartland', 'Metro'])} ${org.division === 'JUCO' ? 'Junior College ' : ''}Conference` : `${org.level === 'pro' ? COUNTRIES[org.countryId].name : r.pick(['Metro', 'County', 'District', 'Regional', 'City'])} ${org.level === 'school' ? 'Schools ' : org.level === 'college' ? 'Universities ' : ''}${org.div === 'women' ? "Women's " : ''}${sport.name} League${team.group !== 'senior' ? ` ${team.group.toUpperCase()}` : ''}`,
      founded: Math.max(sport.founded, state.year - r.int(10, 80)), history: [] };
    S.orgs[id] = lg;
    // Every team in a league has a name of its own: the place, and a club name nobody else in the league has.
    const taken = new Set([org.name]);
    lg.size = org.tier > 1 ? 10 : leagueSize(sport, org.level, org.countryId, org.div);
    for (let i = 0; i < lg.size - 1; i++) {
      const city = cities[i % cities.length];
      let name = '';
      const nick = sport.kind === 'team' ? mascotsFor(sport) : TEAM_WORDS;
      for (let t = 0; t < 20 && (!name || taken.has(name)); t++) name = org.level === 'pro' ? `${city} ${r.pick(nick)}` : t < 10 ? `${city} ${r.pick(nick)}` : `${r.pick(CLUB_WORDS)} ${r.pick(nick)}`;
      taken.add(name);
      const rival = findOrg(state, sport, org.level, { division: org.division, countryId: org.countryId, key: `${key}/rival/${i}`.replace(/\/women\//, '/'), city, strength: r.int(-8, 8), tier: org.tier, name, div: org.div ?? 'mixed' });
      lg.teamIds.push(teamFor(state, rival).id);
    }
  }
  if (!lg.teamIds.includes(team.id)) lg.teamIds.splice(0, lg.teamIds.length >= (lg.size ?? 8) ? 1 : 0, team.id);
  org.leagueId = lg.id;
  return lg;
}

/** Each team's strength drifts a little each year: players leave, others arrive. Seeded, so it is the same on any reload. */
function refreshRoster(state, t) {
  if (t.refreshed === state.year) return;
  t.refreshed = state.year;
  const org = orgOf(t.orgId, state);
  const r = seeded(`roster/${t.id}/${state.year}`);
  const names = rosterNames(r, org.countryId, 3, org.div);
  for (const x of t.roster) if (!x.player && !x.npcId) x.rating = Math.round(clamp(x.rating + r.normal(0.5, 2.5), 10, 97));
  // One or two move on each year, and new ones arrive. Known teammates stay while the player is there.
  const leaving = r.shuffle(t.roster.filter((x) => !x.player && !x.npcId && x.since < state.year)).slice(0, r.int(1, 2));
  // Rosters from before this fix could hold two newcomers with the same id (both counted from the roster's length).
  const seen = new Set();
  for (const x of t.roster) { if (seen.has(x.id)) x.id = `${x.id}_b`; seen.add(x.id); }
  leaving.forEach((x, i) => {
    t.roster = t.roster.filter((y) => y !== x);
    const n = names.pop();
    t.roster.push({ id: `r_${t.id}_${state.year}_n${i}`, name: n, pos: x.pos, rating: Math.round(clamp(org.strength + r.normal(0, 7), 10, 95)), since: state.year });
  });
  for (const x of t.roster) if (x.npcId && state.npcs[x.npcId]) x.rating = Math.round(clamp(x.rating + r.normal(1, 2), 10, 97));
}

/**
 * Plays a league season for the player's team: every fixture, then the top four in the playoffs. Fixtures are stored
 * with their scores; standings are counted from them. Returns the season.
 */
function playSeason(state, e, team, o = {}) {
  const S = ensure(state);
  const p = state.player;
  const org = orgOf(team.orgId, state);
  const sport = sportOf(team.sportId);
  const lg = leagueFor(state, org, team);
  const id = `season_${lg.id}_${state.year}`;
  if (S.seasons[id]) return S.seasons[id]; // played already
  for (const tid of lg.teamIds) refreshRoster(state, S.teams[tid]);
  const me = overall(e, p);
  const mine = team.roster.find((x) => x.id === p.id);
  if (mine) mine.rating = me;
  // Where the player stands in the side decides how much they play.
  const samePos = team.roster.filter((x) => x.pos === e.position && x.id !== p.id).map((x) => x.rating).sort((a, b) => b - a);
  const slots = Math.max(1, Math.round((sport.teamSize ?? 6) / (sport.positions?.length ?? 1)));
  const above = samePos.filter((x) => x > me).length;
  const role = above < slots ? 'starter' : above < slots + 2 ? 'rotation' : 'bench';
  const minutes = { starter: 0.9, rotation: 0.5, bench: 0.15 }[role];
  const teams = lg.teamIds;
  // As many times round the league as the season is long: twice round eight teams, once round thirty.
  const rounds = Math.max(1, Math.round((sport.season ?? 14) / Math.max(1, teams.length - 1)));
  const fixtures = [];
  // A round-robin, as many times as the season is long; home and away alternate.
  for (let rr = 0; rr < rounds; rr++) {
    const list = [...teams];
    for (let round = 0; round < list.length - 1; round++) {
      for (let i = 0; i < list.length / 2; i++) {
        const h = list[i]; const aw = list[list.length - 1 - i];
        fixtures.push({ n: fixtures.length, round: rr * (list.length - 1) + round + 1, home: rr % 2 ? aw : h, away: rr % 2 ? h : aw, done: false });
      }
      list.splice(1, 0, list.pop());
    }
  }
  const season = { id, year: state.year, sportId: sport.id, leagueId: lg.id, name: `${lg.name} ${state.year}`, level: org.level, teamIds: [...teams],
    fixtures, playoffs: [], champion: null, playerTeamId: team.id, playerId: p.id, role, preview: {} };
  // Before a ball is kicked: where each team is expected to finish, for the record (and for an underdog's story).
  const pre = teams.map((t) => [t, teamStrength(S.teams[t])]).sort((a, b) => b[1] - a[1]);
  pre.forEach(([t], i) => { season.preview[t] = i + 1; });
  S.seasons[id] = season;
  // An injury keeps the player out of a run of their own team's games (o.injury counts those), playoffs included.
  const injury = o.injury ?? null;
  let played = 0;
  const outFor = (f) => { if (f.home !== team.id && f.away !== team.id) return false; const k = played++; return !!injury && k >= injury.from && k < injury.to; };
  for (const f of fixtures) playFixture(state, season, f, e, team, { minutes, out: outFor(f) });
  playoffs(state, season, e, team, minutes, outFor);
  return season;
}

function sideStrength(state, season, tid, e, team, minutes, out) {
  const t = state.sports.teams[tid];
  const base = teamStrength(t);
  if (tid !== team.id || out) return base;
  // The player's part in it: more, the more they play.
  return Math.round(base * (1 - 0.18 * minutes) + overall(e, state.player) * 0.18 * minutes);
}

/** Plays one fixture: its score, and what the player did in it if they played. */
function playFixture(state, season, f, e, team, { minutes, out = false }) {
  if (f.done) return;
  const sport = sportOf(season.sportId);
  const mineIn = f.home === team.id || f.away === team.id;
  const a = sideStrength(state, season, f.home, e, team, minutes, out) + 1.5; // home advantage
  const b = sideStrength(state, season, f.away, e, team, minutes, out);
  f.score = teamGame(sport, a, b, `${season.id}/${f.n}`);
  f.done = true;
  if (mineIn) f.me = myGame(state, season, f, e, team, out ? 0 : minutes);
}

/** What the player did in a game: minutes, the numbers their sport counts, and a rating out of ten. */
function myGame(state, season, f, e, team, minutes) {
  if (!minutes) return { played: false };
  const sport = sportOf(season.sportId);
  const r = seeded(`${season.id}/${f.n}/me`);
  const played = r.chance(Math.min(1, minutes + 0.15));
  if (!played) return { played: false };
  const home = f.home === team.id;
  const [us, them] = home ? f.score : [f.score[1], f.score[0]];
  const skill = overall(e, state.player);
  const s = { played: true, start: minutes >= 0.8 };
  const k = (key) => (e.skills[key] ?? 0) / 100;
  if (sport.adapter === 'goals') {
    const att = e.position === 'fwd' || e.position === 'forward' ? 0.38 : e.position === 'mid' ? 0.18 : e.position === 'gk' || e.position === 'goalie' ? 0 : 0.06;
    s.goals = Math.min(us, r.poisson(us * att * (0.6 + k('shooting')) * minutes));
    s.assists = Math.min(us - s.goals, r.poisson(us * 0.2 * (0.5 + k('passing') + k('stickhandling')) * minutes));
    if (e.position === 'gk' || e.position === 'goalie') { s.saves = r.poisson(3 + them * 0.6); s.clean = them === 0; }
  } else if (sport.id === 'basketball' || sport.id === 'wheelchair_basketball') {
    s.points = Math.max(0, Math.round(r.normal(us * 0.2 * minutes * (0.6 + k('shooting')), 4)));
    s.rebounds = Math.max(0, Math.round(r.normal(6 * minutes * (0.5 + k('rebounding')), 2)));
    s.assists = Math.max(0, Math.round(r.normal(4 * minutes * (0.5 + k('passing')), 1.5)));
  } else if (sport.adapter === 'baseball') {
    if (e.position === 'pitcher') { s.innings = Math.round(minutes * 6 * (0.6 + k('stamina'))); s.strikeouts = r.poisson(s.innings * (0.6 + k('stuff'))); }
    else { s.atBats = 4; s.hits = Math.min(4, r.poisson(4 * (0.15 + k('contact') * 0.2))); s.homeRuns = Math.min(s.hits, r.poisson(0.12 + k('power') * 0.2)); }
  } else if (sport.adapter === 'cricket') {
    s.runs = Math.max(0, Math.round(r.normal(25 * (0.4 + k('batting')) * minutes, 15)));
    s.wickets = e.position === 'bowler' || e.position === 'allrounder' ? r.poisson(1.6 * (0.4 + k('bowling'))) : 0;
  } else if (sport.id === 'american_football') {
    s.yards = Math.max(0, Math.round(r.normal(minutes * 60 * (0.5 + (k('running') + k('throwing') + k('catching')) / 2), 25)));
    s.touchdowns = r.poisson(us / 21 * minutes * 0.7);
    s.tackles = e.position === 'defense' || e.position === 'line' ? r.poisson(5 * minutes) : 0;
  } else if (sport.id === 'rugby') {
    s.tries = r.poisson(us / 22 * minutes * (e.position === 'back' ? 0.6 : 0.3));
    s.tackles = r.poisson(8 * minutes * (0.5 + k('tackling')));
  } else if (sport.id === 'volleyball') {
    s.kills = Math.max(0, Math.round(r.normal(minutes * 10 * (0.4 + k('attacking')), 3)));
    s.digs = Math.max(0, Math.round(r.normal(minutes * 8 * (0.4 + k('digging')), 3)));
  }
  const won = us > them;
  s.rating = Math.round(clamp(6 + (skill - 55) / 18 + (won ? 0.5 : us === them ? 0 : -0.4) + (s.goals ?? 0) * 0.8 + (s.touchdowns ?? 0) * 0.5 + (s.tries ?? 0) * 0.6 + r.normal(0, 0.6), 3, 10) * 10) / 10;
  // Baseball and softball also count runs batted in, and the runs a pitcher gave up (for the earned run average).
  // Drawn after the rating, so the numbers above come out as they always did.
  if (sport.adapter === 'baseball') {
    if (e.position === 'pitcher') s.earned = r.poisson((s.innings ?? 0) / 9 * Math.max(0.8, 5.2 - k('stuff') * 2.4 - k('control') * 1.4));
    else s.rbi = (s.homeRuns ?? 0) + r.poisson((s.hits ?? 0) * 0.45);
  }
  return s;
}

/** Standings, counted from completed fixtures only. */
export function standings(season) {
  const sport = sportOf(season.sportId);
  const draws = sport.adapter === 'goals';
  const T = Object.fromEntries(season.teamIds.map((t) => [t, { teamId: t, p: 0, w: 0, d: 0, l: 0, f: 0, a: 0, pts: 0 }]));
  for (const f of season.fixtures) {
    if (!f.done) continue;
    const h = T[f.home]; const aw = T[f.away];
    if (!h || !aw) continue;
    h.p++; aw.p++; h.f += f.score[0]; h.a += f.score[1]; aw.f += f.score[1]; aw.a += f.score[0];
    if (f.score[0] > f.score[1]) { h.w++; aw.l++; } else if (f.score[0] < f.score[1]) { aw.w++; h.l++; } else { h.d++; aw.d++; }
  }
  for (const x of Object.values(T)) x.pts = draws ? x.w * 3 + x.d : x.w * 2 + x.d;
  return Object.values(T).sort((a, b) => b.pts - a.pts || (b.f - b.a) - (a.f - a.a) || b.f - a.f || a.teamId.localeCompare(b.teamId));
}

/** The top four play off: semifinals, then a final. The champion is the winner of a completed final, and only that. */
function playoffs(state, season, e, team, minutes, outFor) {
  if (season.playoffs.length) return;
  const sport = sportOf(season.sportId);
  const table = standings(season);
  if (!table.length || table.some((x) => x.p === 0)) return;
  const [a, b, c, d] = table.map((x) => x.teamId);
  const n = season.fixtures.length;
  const tie = (home, away, i, round) => {
    const f = { n: n + i, round, home, away, done: false, playoff: true };
    playFixture(state, season, f, e, team, { minutes, out: outFor(f) });
    // A playoff cannot end level: extra time, a shoot-out, or another inning settles it.
    if (f.score[0] === f.score[1]) { const r = seeded(`${season.id}/${f.n}/decider`); f.decider = true; f.score[r.chance(edge(1, 0)) ? 0 : 1] += 1; }
    f.winner = f.score[0] > f.score[1] ? f.home : f.away;
    season.playoffs.push(f);
    return f.winner;
  };
  void sport;
  // Baseball's big leagues (thirty clubs) take twelve: the best four rest while the other eight play a wild card round,
  // and each winner then meets one of the four who waited, the best of them meeting the lowest seed left.
  if (sport.id === 'baseball' && table.length >= 24) {
    const s = table.slice(0, 12).map((x) => x.teamId);
    const w = [tie(s[7], s[8], 7, 'Wild Card'), tie(s[4], s[11], 8, 'Wild Card'), tie(s[6], s[9], 9, 'Wild Card'), tie(s[5], s[10], 10, 'Wild Card')];
    const q = [tie(s[0], w[0], 0, 'Quarterfinal'), tie(s[3], w[1], 1, 'Quarterfinal'), tie(s[1], w[2], 2, 'Quarterfinal'), tie(s[2], w[3], 3, 'Quarterfinal')];
    season.champion = tie(tie(q[0], q[1], 4, 'Semifinal'), tie(q[2], q[3], 5, 'Semifinal'), 6, 'Final');
    return;
  }
  // Another big league takes its top eight to the playoffs, a small one its top four.
  if (table.length >= 16) {
    const s = table.slice(0, 8).map((x) => x.teamId);
    const q = [tie(s[0], s[7], 0, 'Quarterfinal'), tie(s[3], s[4], 1, 'Quarterfinal'), tie(s[1], s[6], 2, 'Quarterfinal'), tie(s[2], s[5], 3, 'Quarterfinal')];
    season.champion = tie(tie(q[0], q[1], 4, 'Semifinal'), tie(q[2], q[3], 5, 'Semifinal'), 6, 'Final');
    return;
  }
  const w1 = tie(a, d, 0, 'Semifinal');
  const w2 = tie(b, c, 1, 'Semifinal');
  const champion = tie(w1, w2, 2, 'Final');
  season.champion = champion;
}

// ---------- Individual competition: tournaments, meets, rounds ----------

/** Events a year at each level. */
const EVENTS_A_YEAR = { recreational: 2, club: 4, school: 3, academy: 5, college: 6, pro: 9, elite: 6 };
/** The size of a draw or field. */
const FIELD = { recreational: 8, club: 16, school: 16, academy: 32, college: 32, pro: 64, elite: 32 };
/** Invented names for events. */
const EVENT_NAMES = { recreational: ['Community Open', 'Summer Fun Tournament', 'Neighborhood Classic'], club: ['Club Championship', 'Spring Open', 'Fall Classic', 'Invitational'],
  school: ['Schools Championship', 'Inter-School Cup', 'District Finals'], academy: ['Junior Open', 'Youth Masters', 'National Junior Series'],
  college: ['Conference Championship', 'University Invitational', 'Collegiate Open'], pro: ['Open', 'Masters', 'Classic', 'Championship', 'Grand Prix', 'Cup'], elite: ['National Championship', 'International Trophy'] };

/** An opponent, invented and named, at a rating for the level. */
function opponent(r, countryId, level, i, div = 'mixed') {
  const names = COUNTRIES[countryId].names;
  const g = namesFor(div, r);
  const skill = clamp(LEVEL_STRENGTH[level] + r.normal(0, 9) - i * 0.15, 8, 98);
  return { name: `${r.pick(names[g] ?? names.female)} ${r.pick(names.last)}`, skill: Math.round(skill), pr: prOfSkill(skill) };
}

/** The strength of a side in a racket sport: the player, or the player and their partner. */
function racketSide(state, e, partner) {
  const p = state.player;
  const s = (k) => e.skills[k] ?? 0;
  const me = overall(e, p);
  const one = { serve: s('serve'), ret: s('return'), rest: me };
  if (!partner) return { ...one, all: me };
  const chem = partner.chemistry ?? 40;
  const all = Math.round((me + partner.skill) / 2 + (chem - 50) / 8 + (s('communication') - 40) / 15);
  return { serve: (one.serve + partner.skill) / 2, ret: (one.ret + partner.skill) / 2, rest: all, all };
}

/**
 * Plays one event for the player in an individual sport. The draw is made from the player and invented entrants, seeded by
 * rating; every match the player plays is simulated in full, and the rest of the draw only far enough to know who they
 * meet. Returns the event.
 */
function playEvent(state, e, level, n, o = {}) {
  const S = ensure(state);
  const p = state.player;
  const sport = sportOf(e.id);
  const id = `event_${p.id}_${e.id}_${state.year}_${n}`;
  if (S.events[id]) return S.events[id];
  const r = seeded(id);
  const partner = o.partnershipId ? S.partnerships[o.partnershipId] : null;
  const format = partner ? 'doubles' : 'singles';
  const names = EVENT_NAMES[level] ?? EVENT_NAMES.club;
  const where = level === 'pro' ? r.pick(COUNTRIES[p.countryId].cities ?? [cityOf(p)]) : cityOf(p);
  const division = orgDivision(state, sport, level);
  const ev = { id, year: state.year, sportId: e.id, level, format, div: division, name: o.name ?? `${where} ${division === 'women' ? "Women's " : ''}${r.pick(names)}${format === 'doubles' ? ' (doubles)' : ''}`, playerId: p.id, partnershipId: partner?.id ?? null,
    rounds: [], place: null, field: FIELD[level] ?? 16, prize: 0, prBefore: e.pr };
  S.events[id] = ev;
  if (sport.adapter === 'time' || sport.adapter === 'judged' || sport.adapter === 'strokes') return fieldEvent(state, ev, e, r);
  const size = ev.field;
  const field = Array.from({ length: size - 1 }, (_, i) => opponent(r, p.countryId, level, i, division));
  if (partner) for (const x of field) x.skill = Math.round(clamp(x.skill + r.normal(0, 3)));
  const side = racketSide(state, e, partner);
  // Seeds: the stronger the rating, the later the strong meet. The player's position in the draw follows their rating.
  const mySeed = field.filter((x) => x.pr > e.pr).length;
  const order = [...field.slice(0, mySeed), null, ...field.slice(mySeed)].sort((x, y) => (y?.pr ?? e.pr) - (x?.pr ?? e.pr));
  const roundsTotal = Math.log2(size);
  let alive = true; let round = 0;
  let opponents = order.filter((x) => x !== null);
  while (alive && round < roundsTotal) {
    round++;
    const left = size / 2 ** (round - 1);
    const label = left === 2 ? 'Final' : left === 4 ? 'Semifinal' : left === 8 ? 'Quarterfinal' : `Round of ${left}`;
    // The opponent is whoever came through the other half of this section, the stronger more often.
    const pool = opponents.slice(0, Math.max(1, Math.round(opponents.length / 2 ** (roundsTotal - round))));
    const opp = r.chance(0.65) ? pool.reduce((m, x) => (x.skill > m.skill ? x : m), pool[0]) : r.pick(pool);
    opponents = opponents.filter((x) => x !== opp);
    const key = `${id}/r${round}`;
    let res;
    if (sport.adapter === 'sets') res = tennisMatch(side, { serve: opp.skill, ret: opp.skill, rest: opp.skill }, key, level === 'pro' && r.chance(0.2) ? 5 : 3);
    else if (sport.adapter === 'rally') res = rallyMatch(side.all, opp.skill, key, sport.to ?? 11, 3);
    else { const b = bout(side.all, opp.skill, key); res = { winner: b.winner, how: b.how }; }
    const won = res.winner === 0;
    const d = prChange(e.pr, opp.pr, won, e.played);
    e.pr = Math.max(100, e.pr + d);
    e.played += 1; if (won) e.wins += 1; else e.losses += 1;
    ev.rounds.push({ round: label, opp: opp.name, oppPr: opp.pr, sets: res.sets ?? null, how: res.how ?? null, won, pr: d });
    if (!won) { alive = false; ev.place = label; }
    if (o.rival) rivalNote(state, e, opp.name, won);
  }
  if (alive) ev.place = 'Champion';
  ev.prAfter = e.pr;
  return ev;
}

/** A race, meet, judged competition or golf event: everyone posts a mark, and the places follow. */
function fieldEvent(state, ev, e, r) {
  const p = state.player;
  const sport = sportOf(e.id);
  const size = Math.min(ev.field, 24);
  const others = Array.from({ length: size - 1 }, (_, i) => opponent(r, p.countryId, ev.level, i, ev.div));
  const me = overall(e, p);
  let mine; let theirs;
  if (sport.adapter === 'time') {
    const event = (sport.events ?? [])[(ev.id.length + state.year) % Math.max(1, sport.events?.length ?? 1)];
    ev.discipline = event[1];
    mine = mark(event, me, `${ev.id}/me`);
    theirs = others.map((x, i) => mark(event, x.skill, `${ev.id}/o${i}`));
    ev.mark = fmtMark(event, mine);
    const prev = e.best[event[0]];
    if (prev == null || better(event, mine, prev)) { e.best[event[0]] = mine; ev.pb = true; }
    ev.place = 1 + theirs.filter((t) => better(event, t, mine)).length;
  } else if (sport.adapter === 'judged') {
    mine = judged(me, `${ev.id}/me`, e.skills.nerve ?? 50);
    theirs = others.map((x, i) => judged(x.skill, `${ev.id}/o${i}`));
    ev.mark = `${mine.toFixed(1)} points`;
    ev.place = 1 + theirs.filter((t) => t > mine).length;
  } else { // golf: four rounds
    const rounds = [0, 1, 2, 3].map((i) => golfRound(me, `${ev.id}/me/${i}`));
    mine = rounds.reduce((s, x) => s + x, 0);
    theirs = others.map((x, j) => [0, 1, 2, 3].reduce((s, i) => s + golfRound(x.skill, `${ev.id}/o${j}/${i}`), 0));
    const par = 288;
    ev.mark = `${mine} (${mine - par === 0 ? 'level par' : mine > par ? `+${mine - par}` : mine - par})`;
    ev.place = 1 + theirs.filter((t) => t < mine).length;
  }
  // The rating moves against the field: each competitor beaten or lost to counts a little.
  const fieldPr = others.reduce((s, x) => s + x.pr, 0) / others.length;
  const beaten = size - ev.place; const lost = ev.place - 1;
  const d = Math.round((prChange(e.pr, fieldPr, true, e.played) * beaten + prChange(e.pr, fieldPr, false, e.played) * lost) / Math.max(1, size - 1) * 2.2);
  e.pr = Math.max(100, e.pr + d);
  e.played += 1; if (ev.place === 1) e.wins += 1;
  ev.prAfter = e.pr;
  ev.place = ordinalPlace(ev.place);
  return ev;
}
const ordinal = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
const ordinalPlace = (n) => (n === 1 ? 'Champion' : ordinal(n));
/** Whether a place counts as a win of the event. */
export const isTitle = (place) => place === 'Champion';

/** Rivals: an opponent met again and again is remembered by name. */
function rivalNote(state, e, name, won) {
  e.rivals ??= {};
  const x = (e.rivals[name] ??= { met: 0, won: 0, first: state.year });
  x.met += 1; if (won) x.won += 1;
}

// ---------- A private coach ----------

/** What a private coach costs a year, base units: more for a better one. */
export const privateCoachCost = (quality) => Math.round(600 + quality * 25);
/** Private coaches the player could hire for a sport: three real people, the same three all year. */
export function privateCoaches(sportId, state = store.state) {
  const S = ensure(state);
  const p = state.player;
  const key = `private/${sportId}/${p.countryId}/${cityOf(p)}/${state.year}`;
  S.privatePool ??= {};
  if (!S.privatePool[key]) {
    const r = seeded(key);
    S.privatePool[key] = [0, 1, 2].map((i) => ({ i, quality: Math.round(clamp(42 + i * 14 + r.int(-6, 6), 30, 92)), style: r.pick(Object.keys(COACH_STYLE)), specialty: r.pick(['technical', 'physical', 'mental']), npcId: null }));
  }
  return S.privatePool[key].map((x) => ({ ...x, cost: localMoney(privateCoachCost(x.quality), COUNTRIES[p.countryId]) }));
}
/**
 * Hires a private coach: a person, kept, who works with the player alone. Paid each year by the player, or by the family
 * for a child (engine/sportsLife.js). Better coaches cost more.
 */
export function hirePrivateCoach(sportId, i, state = store.state) {
  const S = ensure(state);
  const p = state.player;
  const e = entryOf(sportId, p.id, state);
  const sport = sportOf(sportId);
  if (!e || e.status !== 'active') return result(false, 'You do not play that.', 'neutral');
  if (e.privateCoachId) return result(false, 'You already have a private coach for this.', 'neutral');
  if (e.contractId) return result(false, 'Your club coaches you now.', 'neutral');
  const offer = privateCoaches(sportId, state).find((x) => x.i === Number(i));
  if (!offer) return result(false, 'That coach is not available.', 'neutral');
  if (p.age >= 18 && p.finance.cash < offer.cost) return result(false, `${fmtMoney(offer.cost, COUNTRIES[p.countryId])} a year is more than you have.`, 'neutral');
  if (p.age < 18 && !academyAffordable(state)) return result(false, 'Your family cannot pay for a private coach.', 'neutral');
  const r = seeded(`privatecoach/${p.id}/${sportId}/${state.year}/${i}`);
  const npc = makeNpc({ role: 'coach', countryId: p.countryId, age: r.int(26, 60), relationship: 50 });
  npc.flags.title = `Private ${sport.name.toLowerCase()} coach`;
  npc.flags.sport = sportId;
  state.npcs[npc.id] = npc; p.npcIds.push(npc.id);
  S.coaches[npc.id] = { id: npc.id, name: fullName(npc), sportId, quality: offer.quality, style: offer.style, specialty: offer.specialty, orgId: null, private: true, fee: offer.cost,
    since: state.year, history: [{ year: state.year, orgId: null, text: `Began coaching ${fullName(p)} privately.` }], players: [p.id] };
  e.privateCoachId = npc.id;
  const text = `${fullName(npc)} will coach you privately: ${COACH_STYLE[offer.style].split('.')[0].toLowerCase()}. ${p.age >= 18 ? `${fmtMoney(offer.cost, COUNTRIES[p.countryId])} a year.` : 'Your family pays.'}`;
  say(state, text, 'good', { screen: 'coach', id: npc.id });
  moment(state, { type: 'private_coach', sportId, text: `Started working with ${fullName(npc)}, a private coach.`, sig: 2, people: [npc.id], memory: `You started training together, ${sport.name.toLowerCase()}, just the two of you.` });
  return result(true, text);
}
export function dropPrivateCoach(sportId, state = store.state) {
  const e = entryOf(sportId, state.player.id, state);
  const c = coachOf(e?.privateCoachId, state);
  if (!c) return result(false, 'You have no private coach.', 'neutral');
  c.history.push({ year: state.year, orgId: null, text: `Stopped coaching ${fullName(state.player)}.` });
  c.until = state.year;
  const n = state.npcs[c.id];
  if (n) n.flags.title = `Former private coach (${sportOf(sportId).name.toLowerCase()})`;
  e.privateCoachId = null;
  const text = `You stopped working with ${c.name}.`;
  log(text);
  return result(true, text, 'neutral');
}

// ---------- Partnerships (doubles) ----------

/** A doubles partner: a real person, kept, with how well the two of them play together. */
export function findPartner(sportId, state = store.state) {
  const S = ensure(state);
  const p = state.player;
  const e = entryOf(sportId, p.id, state);
  const sport = sportOf(sportId);
  if (!e || e.status !== 'active') return result(false, 'You do not play that.', 'neutral');
  if (sport.kind !== 'racket') return result(false, `${sport.name} has no doubles.`, 'neutral');
  if (currentPartnership(sportId, state)) return result(false, 'You already have a doubles partner. End that first.', 'neutral');
  const r = seeded(`partner/${p.id}/${sportId}/${state.year}/${Object.keys(S.partnerships).length}`);
  const skill = Math.round(clamp(overall(e, p) + r.normal(0, 6), 10, 97));
  const n = makeNpc({ role: 'teammate', countryId: p.countryId, age: Math.max(sport.minAge, p.age + r.int(-4, 6)), relationship: r.int(45, 65) });
  n.flags.title = `${sport.name} doubles partner`;
  n.flags.sport = sportId;
  n.flags.talents = { sports: skill };
  state.npcs[n.id] = n; p.npcIds.push(n.id);
  const id = nextId(S, 'pair');
  S.partnerships[id] = { id, sportId, a: p.id, b: n.id, aName: fullName(p), bName: fullName(n), skill, since: state.year, until: null, chemistry: r.int(35, 55),
    style: r.pick(['steady at the kitchen line', 'a big hitter', 'quick hands at the net', 'a patient reset player', 'a talker, always calling the ball']), events: [], titles: 0 };
  e.partnershipId = id;
  const text = `You teamed up with ${fullName(n)} for doubles: ${S.partnerships[id].style}.`;
  log(text, 'system', 'good');
  moment(state, { type: 'partner', sportId, text: `Started playing doubles with ${fullName(n)}.`, sig: 2, people: [n.id], memory: `You started playing ${sport.name.toLowerCase()} doubles together.` });
  return result(true, text);
}
export function currentPartnership(sportId, state = store.state) {
  const id = entryOf(sportId, state.player.id, state)?.partnershipId;
  const x = id ? ensure(state).partnerships[id] : null;
  if (!x || x.until) return null;
  // A partner who has died, or is no longer among the people of this life, ends the partnership.
  if (!state.npcs[x.b]?.alive) { x.until = state.year; x.why = 'partner gone'; entryOf(sportId, state.player.id, state).partnershipId = null; return null; }
  return x;
}
export function endPartnership(sportId, state = store.state) {
  const x = currentPartnership(sportId, state);
  if (!x) return result(false, 'You have no doubles partner.', 'neutral');
  x.until = state.year;
  entryOf(sportId, state.player.id, state).partnershipId = null;
  const n = state.npcs[x.b];
  if (n) { n.flags.title = `Former doubles partner (${sportOf(sportId).name.toLowerCase()})`; n.meters.relationship = clamp(n.meters.relationship - 8); }
  const text = `You and ${x.bName} stopped playing doubles together.`;
  log(text);
  moment(state, { type: 'partner_end', sportId, text: `Stopped playing doubles with ${x.bName}.`, sig: 1, people: [x.b] });
  return result(true, text, 'neutral');
}

// ---------- The athletic timeline ----------

/** Writes a moment, once. `key` stops the same moment being written twice. */
export function moment(state, m) {
  const S = ensure(state);
  const key = m.key ?? `${m.type}/${m.sportId ?? ''}/${state.year}/${m.text}`;
  if (S.moments.some((x) => x.key === key)) return null;
  const p = state.player;
  const x = { id: `mo_${S.moments.length + 1}`, key, year: m.year ?? state.year, age: m.age ?? p.age, personId: m.personId ?? p.id, name: m.name ?? fullName(p), gen: m.gen ?? p.generation ?? 1,
    type: m.type, sportId: m.sportId ?? null, text: m.text, sig: m.sig ?? 1, orgId: m.orgId ?? null, seasonId: m.seasonId ?? null, eventId: m.eventId ?? null, people: m.people ?? [] };
  S.moments.push(x);
  // The people who were there remember it too: a coach, a doubles partner, the teammates the player knows.
  const who = new Set(x.people);
  if (m.sig >= 2 && x.sportId && x.personId === p.id) {
    const e = entryOf(x.sportId, p.id, state);
    if (e?.coachId) who.add(e.coachId);
    if (e?.privateCoachId) who.add(e.privateCoachId);
    for (const r of teamOf(e?.teamId, state)?.roster ?? []) if (r.npcId) who.add(r.npcId);
  }
  // Told from the player's side, like every other memory: "You won the City League."
  const said = m.memory ?? `You ${x.text.replace(/^./, (c) => c.toLowerCase())}`;
  for (const id of who) { const n = state.npcs[id]; if (n?.alive && n.role !== 'pet') remember(n, `sport:${x.id}`, said); }
  x.people = [...who];
  return x;
}
export const momentsOf = (personId = store.state.player.id, state = store.state) => ensure(state).moments.filter((m) => m.personId === personId);

// ---------- Exports for the other sports modules ----------

export const internals = { rosterNames, checkSchoolTeam, fillEntry, academyAffordable, regroup, nextId, findOrg, coachFor, meetCoach, teamFor, joinOrg, leaveOrg, leagueFor, playSeason, playEvent, newEntry, newAthlete, trainYear,
  overall, meanSkill, rec, LEVEL_STRENGTH, EVENTS_A_YEAR, teamStrength, val, fullName, rivalNote, seeded, hash, ordinal };
export { SPORTS, LEVEL_NAMES };
void cap; void yearNow;

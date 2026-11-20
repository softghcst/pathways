// The entertainment world: studios, networks, theater companies, agencies and
// media outlets; the performers, directors and agents who work in them; and the
// productions they make, from casting to release, with their casts kept for
// good. The player is one performer among many: they audition for real parts
// in real productions, alongside people who go on with their careers.
//
//   state.ent = {
//     seq, orgs: { id: Org }, byCountry: { cc: [orgIds] }, pool: { cc: [npcIds] },
//     productions: { id: Production }, articles: [Article], offers: [Offer], seasons: { id: AwardSeason }
//   }
//   Org:        { id, kind, name, countryId, city, tier, founded, reputation, employerId, staff[], history[] }
//   Production: { id, title, kind, tier, genre, orgId, countryId, city, directorId, budget, created (year), workYear,
//                 runYears, status: 'casting'|'production'|'running'|'released'|'closed', cast: [Role], reception, abroad[], awards[] }
//   Role:       { idx, kind (ROLE_KINDS), character, ages:[lo,hi], approach, need, who: npcId|'player'|null, perf, fee, open }
//   p.fame.credits:   [{ productionId, idx, year }]             what the player has actually done
//   p.fame.contracts: [Contract]                                 offered, signed, completed; paid once
//   p.fame.work:      { productionId: { perf, done:[], age } }    time on set this year
//   p.fame.agent:     { npcId, orgId, since, commission } | null
//
// Performers in the pool are NPCs (state.npcs, role 'performer') who are not
// part of the player's life until they work together; then they are, as
// colleagues, and stay so.
import { rng } from '../rng.js';
import { clamp, fmtMoney, localWage, uid } from '../util.js';
import { store, player, country, log, milestone } from '../state.js';
import { COUNTRIES, COUNTRY_LIST } from '../data/countries.js';
import { PRODUCTION_KINDS, TIERS, ROLE_KINDS, ROLES_FOR, SKILLS_FOR, CHILD_PARTS, THEATER_DISTRICTS, TITLE_NODS, STAGE_BAR, ORG_NAMES, ORG_WORDS, OUTLET_WORDS, TITLE_PARTS, GENRES, CHARACTER_WORDS,
  CHILD_TRUST_SHARE } from '../data/fame.js';
import { makeNpc } from './npcFactory.js';
import { resolve, remember } from './conditions.js';
import { cityOf } from './cities.js';
import { registerEmployer } from './employers.js';
import { fameOf, gain, regard, exists, recognitionIn } from './fame.js';
import { rollTerms } from './agents.js';
import { seeded } from './sportsPlay.js';
import { canFit } from './worklife.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const an = (noun) => `${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`;
const year = () => store.state.year;
const K = (base, c = country()) => Math.round(localWage(base, c));

export function ent(state = store.state) {
  state.ent ??= { seq: 0, orgs: {}, byCountry: {}, pool: {}, productions: {}, articles: [], offers: [], seasons: {} };
  return state.ent;
}
const nextId = (prefix) => `${prefix}_${(ent().seq += 1).toString(36)}`;
export const production = (id) => ent().productions[id] ?? null;
export const org = (id) => ent().orgs[id] ?? null;

/** The player's own working records, made if missing. */
export function workOf(p = player()) {
  const f = fameOf(p);
  f.credits ??= [];
  f.contracts ??= [];
  f.work ??= {};
  f.agent ??= null;
  f.applied ??= {};
  f.trust ??= 0;
  return f;
}

// ---------- People ----------

/** A performer's skill in the paths a part asks for. */
function npcSkill(n, need) {
  const s = n.flags.star?.skill ?? {};
  return Object.entries(need).reduce((t, [path, w]) => t + (s[path.split('.')[1]] ?? 50) * w, 0);
}
export const playerSkill = (need) => Object.entries(need).reduce((t, [path, w]) => t + (Number(resolve(path)) || 0) * w, 0);

function makePerformer(countryId, o = {}) {
  const age = o.age ?? rng.int(18, 68);
  const n = makeNpc({ role: 'performer', countryId, age, relationship: rng.int(35, 50) });
  const base = clamp(rng.around(o.level ?? 58, 16), 20, 97);
  n.flags.star = { skill: { acting: Math.round(clamp(base + rng.int(-8, 8))), singing: Math.round(clamp(base + rng.int(-25, 10))), dance: Math.round(clamp(base + rng.int(-25, 10))), charm: Math.round(clamp(base + rng.int(-10, 10))) },
    born: year() - age, fame: Math.round(clamp(rng.around(o.level ? o.level - 45 : 10, 12), 0, 90)), credits: [], kind: o.kind ?? 'performer' };
  n.occupation = o.kind === 'director' ? 'director' : o.kind === 'agent' ? 'talent agent' : o.kind === 'journalist' ? 'journalist' : 'actor';
  store.state.npcs[n.id] = n;
  return n;
}

/** The performers working in a country, made the first time anyone looks. */
export function pool(countryId) {
  const E = ent();
  E.pool[countryId] ??= [];
  const alive = E.pool[countryId].filter((id) => store.state.npcs[id]?.alive && !store.state.npcs[id].flags.star?.retired);
  while (alive.length < 36) alive.push(makePerformer(countryId, { level: rng.pick([45, 55, 62, 70, 80]) }).id);
  E.pool[countryId] = alive;
  return alive.map((id) => store.state.npcs[id]);
}

/** The directors working in a country: a small group who make most of its work, and keep making it. */
export function directors(countryId) {
  const E = ent();
  E.directors ??= {};
  const alive = (E.directors[countryId] ?? []).filter((id) => store.state.npcs[id]?.alive);
  while (alive.length < 10) alive.push(makePerformer(countryId, { kind: 'director', age: rng.int(30, 66), level: rng.pick([50, 58, 66, 74, 82]) }).id);
  E.directors[countryId] = alive;
  return alive.map((id) => store.state.npcs[id]);
}

/** A performer's age, from when they were born. */
const ageOf = (n) => (n.flags.star?.born != null ? year() - n.flags.star.born : n.age);

// ---------- Organizations ----------

function nameFor(kind, countryId, city) {
  const names = COUNTRIES[countryId].names.last;
  return rng.pick(ORG_NAMES[kind]).replace('{W}', rng.pick(ORG_WORDS)).replace('{S}', rng.pick(names)).replace('{S2}', rng.pick(names))
    .replace('{C}', city).replace('{N}', String(rng.int(2, 9))).replace('{M}', rng.pick(OUTLET_WORDS));
}

function makeOrg(kind, countryId, city, tier) {
  const id = nextId('org');
  const name = nameFor(kind, countryId, city);
  const family = { studio: 'arts', network: 'media', theater: 'arts', community: 'arts', agency: 'arts', outlet: 'media' }[kind];
  const tracks = { studio: ['production', 'actor'], network: ['broadcast', 'production', 'actor'], theater: ['stage_tech', 'mt_performer'], community: ['stage_tech'], agency: ['talent_agency'], outlet: ['journalist', 'publishing'] }[kind];
  const e = kind === 'community' ? null : registerEmployer({ name, family, tracks, countryId, city, owned: false });
  const o = { id, kind, name, countryId, city, tier, founded: year() - rng.int(3, 80), reputation: rng.int(35, 80), employerId: e?.id ?? null, staff: [], history: [] };
  ent().orgs[id] = o;
  (ent().byCountry[countryId] ??= []).push(id);
  return o;
}

/** A country's entertainment world, made once. */
export function orgsOf(countryId) {
  const E = ent();
  if (!E.byCountry[countryId]) {
    const c = COUNTRIES[countryId];
    const big = c.place?.capital ?? c.cities[0];
    const cities = c.cities;
    makeOrg('studio', countryId, big, 'blockbuster');
    makeOrg('studio', countryId, big, 'studio');
    makeOrg('studio', countryId, rng.pick(cities), 'indie');
    makeOrg('studio', countryId, rng.pick(cities), 'indie');
    makeOrg('network', countryId, big, 'network');
    makeOrg('network', countryId, rng.pick(cities), 'network');
    // The major stage stands in the country's theater district, where it has one (New York's Broadway, not Washington).
    const stage = cities.includes(THEATER_DISTRICTS[countryId]?.city) ? THEATER_DISTRICTS[countryId].city : big;
    makeOrg('theater', countryId, stage, 'major_stage');
    makeOrg('theater', countryId, stage, 'major_stage');
    makeOrg('theater', countryId, rng.pick(cities), 'touring');
    for (const city of cities.slice(0, 4)) makeOrg('theater', countryId, city, 'regional');
    for (const city of cities) makeOrg('community', countryId, city, 'community');
    makeOrg('agency', countryId, big, 'top');
    makeOrg('agency', countryId, big, 'mid');
    makeOrg('agency', countryId, rng.pick(cities), 'small');
    for (let i = 0; i < 3; i++) makeOrg('outlet', countryId, big, 'outlet');
    // Agents work at agencies; each is a person with their own cut, their own pull, a standard, and clients.
    // The best-known working actors are with the leading agencies.
    const actors = pool(countryId).filter((n) => !n.flags.star.agentId).sort((a, b) => (b.flags.star.fame ?? 0) - (a.flags.star.fame ?? 0));
    for (const o of E.byCountry[countryId].map((id) => E.orgs[id]).filter((x) => x.kind === 'agency')) {
      for (let i = 0; i < 3; i++) {
        const a = makePerformer(countryId, { kind: 'agent', age: rng.int(30, 64) });
        a.flags.agent = { kind: 'talent', orgId: o.id, tier: o.tier, standard: { top: 55, mid: 30, small: 8 }[o.tier] + rng.int(-5, 5), clients: [], ...rollTerms(o.tier) };
        const take = o.tier === 'top' ? actors.splice(0, rng.int(3, 5)) : actors.splice(rng.int(0, Math.max(0, actors.length - 4)), rng.int(2, 4));
        for (const c of take) { c.flags.star.agentId = a.id; a.flags.agent.clients.push(c.id); }
        o.staff.push(a.id);
      }
    }
  }
  return E.byCountry[countryId].map((id) => E.orgs[id]);
}

// ---------- Productions ----------

const title = () => {
  // A show that took a nod's title (TITLE_NODS) counts by the title it drew, so the dice fall as they always have.
  const taken = new Set(Object.values(ent().productions).map((x) => x.drawn ?? x.title));
  for (let i = 0; i < 8; i++) { const t = titleOnce(); if (!taken.has(t)) return t; }
  return `${titleOnce()} ${rng.int(2, 9)}`;
};
const titleOnce = () => {
  const r = rng.next();
  const t = TITLE_PARTS;
  return r < 0.4 ? `${rng.pick(t.a)} ${rng.pick(t.b)}` : r < 0.7 ? `The ${rng.pick(t.b)} of ${rng.pick(t.c)}` : r < 0.85 ? `${rng.pick(t.b)} at ${rng.pick(t.c)}` : `The ${rng.pick(t.a)} ${rng.pick(t.b)}`;
};

/** Stage training: 'bfa' for a conservatory degree in musical theater (or dance), 'ba' for a broad one, else null. */
export function stageTraining(p = player()) {
  const ids = p.education.degrees.map((d) => d.majorId);
  if (ids.some((m) => /_bfa$/.test(m ?? '') && /musical_theater|dance/.test(m))) return 'bfa';
  if (ids.some((m) => ['musical_theater', 'dance', 'theater'].includes(m))) return 'ba';
  return null;
}
/** The stage tier of a company that hires performers (an employer of engine/employers.js), if it is a theater. */
export function stageTierOf(employerId) {
  return Object.values(ent().orgs).find((o) => o.employerId === employerId && o.kind === 'theater')?.tier ?? null;
}

/** The theater district a production plays in, if it is on the major stage in a country that has one: { name, city, on }. */
export function districtOf(prod) {
  const d = prod?.tier === 'major_stage' ? THEATER_DISTRICTS[prod.countryId] : null;
  return d && prod.city === d.city ? d : null; // an old world's major stage, built before districts, stays where it was
}
/** A production's level, as people say it: "Broadway" for a major-stage show in New York, else the tier's name. */
export function tierName(prod) {
  return districtOf(prod)?.name ?? TIERS[prod.tier].name;
}

/** The tiers each kind of production comes in. */
const TIERS_OF = { film: ['student', 'indie', 'studio', 'blockbuster'], tv: ['network', 'studio'], stage: ['community', 'regional', 'touring', 'major_stage'], musical: ['community', 'regional', 'touring', 'major_stage'],
  voice: ['indie', 'network'], commercial: ['indie'] };

/**
 * A new production. NPC performers are cast in most parts; a few are left open
 * as casting notices for the year.
 */
export function makeProduction(kind, tier, countryId, o = {}) {
  const k = PRODUCTION_KINDS[kind];
  if (!exists(k.medium)) return null;
  const orgs = orgsOf(countryId);
  const by = orgs.filter((x) => x.kind === (tier === 'community' ? 'community' : k.org === 'theater' ? 'theater' : k.org) && (x.tier === tier || ['student', 'indie'].includes(tier)));
  const home = o.org ?? (tier === 'community' ? by.find((x) => x.city === (o.city ?? player().city)) : null) ?? rng.pick(by.length ? by : orgs.filter((x) => x.kind === 'studio'));
  if (!home) return null;
  const performers = pool(countryId).filter((n) => ageOf(n) >= 16);
  // Bigger productions go to the better-regarded directors.
  const ds = directors(countryId).sort((a, b) => (b.flags.star.skill.acting - a.flags.star.skill.acting));
  const director = (o.director && store.state.npcs[o.director]) ?? ds[Math.min(ds.length - 1, Math.floor((1 - TIERS[tier].reach) * ds.length * rng.next()))];
  const roles = ROLES_FOR[kind].map((rk, idx) => {
    const lo = rk === 'background' ? 18 : rng.pick([8, 16, 18, 22, 28, 35, 45, 55]);
    const ages = lo < 16 ? [lo, lo + 5] : [lo, lo + 15];
    return { idx, kind: rk, character: rng.pick(CHARACTER_WORDS), ages, approach: rng.pick(['bold', 'restrained', 'playful']), who: null, perf: null,
      fee: Math.round(TIERS[tier].fee * ROLE_KINDS[rk].fee), open: false };
  });
  const id = nextId('prod');
  // Plays and musicals often have a part for a child (CHILD_PARTS). No grown performer is cast in it: it is open,
  // and children audition for it against other children. Its own luck, by the production, so the rest of the
  // world's rolls come out as they did before there were children's parts.
  const luck = seeded(`${id}:child`);
  // A play or musical sometimes tips its hat to a famous show (TITLE_NODS); the usual title is drawn anyway, so
  // the world's rolls come out the same.
  const drawn = title();
  let named = drawn;
  const nods = (TITLE_NODS[kind] ?? []).filter((t) => !Object.values(ent().productions).some((x) => x.title === t));
  const nodLuck = seeded(`${id}:title`);
  if (nods.length && nodLuck.chance(TITLE_NODS.share)) named = nodLuck.pick(nods);
  if (CHILD_PARTS.share[kind] && luck.chance(CHILD_PARTS.share[kind])) {
    roles.push({ idx: roles.length, kind: 'child', character: luck.pick(CHILD_PARTS.characters), ages: [...luck.pick(CHILD_PARTS.ages)], approach: luck.pick(['bold', 'restrained', 'playful']),
      who: null, perf: null, fee: Math.round(TIERS[tier].fee * ROLE_KINDS.child.fee), open: true });
  }
  const p = {
    id, title: named, ...(named !== drawn ? { drawn } : {}), kind, tier, genre: rng.pick(GENRES[kind]), orgId: home.id, countryId, city: home.city, directorId: director.id,
    budget: Math.round(TIERS[tier].budget * rng.around(1, 0.25)), created: year(), workYear: year() + 1, runYears: ['stage', 'musical'].includes(kind) ? (tier === 'community' ? 1 : rng.int(1, 3)) : 1,
    status: 'casting', cast: roles, reception: null, abroad: [], awards: [],
  };
  // Most parts go to people already working; some are open to anyone who comes in.
  const used = new Set();
  for (const r of p.cast) {
    if (r.kind === 'child') continue;
    if (rng.chance(o.openShare ?? 0.35) || (tier === 'community') || (tier === 'student')) { r.open = true; continue; }
    const fits = performers.filter((n) => !used.has(n.id) && ageOf(n) >= r.ages[0] - 4 && ageOf(n) <= r.ages[1] + 8 && npcSkill(n, SKILLS_FOR[kind]) >= 25 + TIERS[tier].reach * 45);
    const pick = fits.sort((a, b) => npcSkill(b, SKILLS_FOR[kind]) + (b.flags.star.fame - a.flags.star.fame) * 0.3 - npcSkill(a, SKILLS_FOR[kind]))[rng.int(0, Math.min(3, fits.length - 1))];
    if (pick) { r.who = pick.id; used.add(pick.id); } else r.open = true;
  }
  ent().productions[p.id] = p;
  org(p.orgId)?.history.push({ year: year(), text: `Announced ${p.title}.` });
  return p;
}

/** How many productions a country's industry starts in a year, by kind and tier. */
const SLATE = [['film', 'student', 1], ['film', 'indie', 2], ['film', 'studio', 1], ['film', 'blockbuster', 1], ['tv', 'network', 2], ['tv', 'studio', 1],
  ['stage', 'community', 1], ['musical', 'community', 1], ['stage', 'regional', 1], ['musical', 'regional', 1], ['musical', 'touring', 1],
  ['stage', 'major_stage', 1], ['musical', 'major_stage', 1], ['voice', 'network', 1], ['commercial', 'indie', 1]];

/** Starts a year's productions in a country (once a year). */
export function slate(countryId) {
  const E = ent();
  E.slated ??= {};
  if (E.slated[countryId] === year()) return;
  E.slated[countryId] = year();
  orgsOf(countryId);
  for (const [kind, tier, n] of SLATE) for (let i = 0; i < n; i++) makeProduction(kind, tier, countryId);
}

// ---------- Casting ----------

/** Professional credits (not school or community shows). */
export const proCredits = (p = player()) => workOf(p).credits.filter((c) => production(c.productionId) && !['community'].includes(production(c.productionId).tier)).length;

/** Every open part the player could hear about, with whether they may go for it. */
export function castingBoard(p = player()) {
  slate(p.countryId);
  const f = workOf(p);
  const out = [];
  for (const prod of Object.values(ent().productions)) {
    if (prod.status !== 'casting' || prod.countryId !== p.countryId) continue;
    if (prod.tier === 'community' && prod.city !== p.city) continue;
    for (const r of prod.cast) {
      if (!r.open || r.who) continue;
      out.push({ production: prod, role: r, why: whyNot(prod, r, p), applied: !!f.applied[`${prod.id}:${r.idx}`] });
    }
  }
  return out.sort((a, b) => TIERS[b.production.tier].reach - TIERS[a.production.tier].reach || a.production.title.localeCompare(b.production.title));
}

/** What keeps the player from a part, or ''. */
export function whyNot(prod, r, p = player()) {
  const f = workOf(p);
  const tier = TIERS[prod.tier];
  const k = PRODUCTION_KINDS[prod.kind];
  if (!exists(k.medium)) return `There is no ${k.name.toLowerCase()} yet.`;
  if (p.legal.incarceration) return 'Not from a cell.';
  if (prod.cast.some((x) => x.who === 'player') || f.contracts.some((c) => c.productionId === prod.id && ['offered', 'signed'].includes(c.status))) return 'You are already in this production, or have an offer from it.';
  if (p.age < r.ages[0] - 2 || p.age > r.ages[1] + 4) return `They are casting someone of about ${r.ages[0]}–${r.ages[1]}.`;
  if (p.age < 6) return 'Too young to work.';
  if (p.age < 16 && !guardianConsents(p)) return 'A parent or guardian has to agree to a child working, and yours have not.';
  if (r.kind === 'child') {
    // Children's parts are cast at open calls for children: the major stage wants one professional credit, or an agent.
    if (prod.tier === 'major_stage' && proCredits(p) < 1 && !f.agent) return `Children's parts ${districtOf(prod)?.on ?? 'on the major stage'} go to children with a professional credit (a regional or touring part) or an agent.`;
  } else {
    if (proCredits(p) < tier.minCredits && !(f.agent && tier.minCredits <= 2)) return `They see people with ${tier.minCredits} professional credits or an agent.`;
    if (['studio', 'blockbuster', 'major_stage'].includes(prod.tier) && !f.agent && recognitionIn(p.countryId, p) < 40) return 'Parts at this level go through agents.';
  }
  if (r.kind === 'background' && proCredits(p) >= 3) return '';
  const clash = scheduleClash(prod, p);
  if (clash) return clash;
  return '';
}

/** Whether a child's parent or guardian lets them work. Asked once, remembered. */
export function guardianConsents(p = player()) {
  p.flags.guardianWork ??= null;
  if (p.flags.guardianWork != null) return p.flags.guardianWork;
  const parents = p.npcIds.map((id) => store.state.npcs[id]).filter((n) => n?.alive && n.role === 'parent');
  if (!parents.length) return (p.flags.guardianWork = true); // whoever looks after them signs
  const warm = Math.max(...parents.map((n) => n.meters.relationship));
  p.flags.guardianWork = rng.chance(clamp(0.45 + (warm - 50) / 80 + (p.talents.acting - 50) / 150, 0.15, 0.95));
  return p.flags.guardianWork;
}

/** Weeks of work a production asks for in its working year. */
const weeksOf = (prod) => PRODUCTION_KINDS[prod.kind].weeks;
/** The productions the player is committed to in a year. */
export function commitments(y, p = player()) {
  return workOf(p).contracts.filter((c) => c.status === 'signed').map((c) => production(c.productionId)).filter((x) => x && x.workYear <= y && y < x.workYear + x.runYears);
}
/** Why a production cannot fit around what the player has already signed, or ''. */
export function scheduleClash(prod, p = player()) {
  const others = commitments(prod.workYear, p).filter((x) => x.id !== prod.id);
  const stage = (x) => ['stage', 'musical'].includes(x.kind) && x.tier !== 'community';
  if (stage(prod) && others.some(stage)) return `You are already on stage most nights in ${others.find(stage).title}.`;
  if (stage(prod) && others.some((x) => x.kind === 'tv')) return 'A stage run and a television series cannot be done at once.';
  if (prod.kind === 'tv' && others.some(stage)) return 'A stage run and a television series cannot be done at once.';
  if (others.some((x) => x.countryId !== prod.countryId)) return 'You are committed to work in another country that year.';
  const touring = Object.values(ent().tours ?? {}).filter((t) => t.year === prod.workYear && (workOf(p).acts ?? []).includes(t.actId)).reduce((s, t) => s + t.weeks, 0);
  if (touring && ['stage', 'musical', 'tv'].includes(prod.kind)) return 'You are on tour that year.';
  const weeks = others.reduce((s, x) => s + weeksOf(x), 0) + weeksOf(prod) + touring;
  if (weeks > 46) return 'Your year is already full of work.';
  return '';
}

/** Hours a week, averaged over the year, the player's signed work takes. */
export function workHours(y = year(), p = player()) {
  // Each contract's own hours: a child's part asks fewer than a grown actor's.
  const hoursOf = (x) => workOf(p).contracts.find((c) => c.status === 'signed' && c.productionId === x.id)?.hours ?? PRODUCTION_KINDS[x.kind].hours;
  return Math.round(commitments(y, p).reduce((s, x) => s + hoursOf(x) * weeksOf(x) / 48, 0));
}

/**
 * An audition. prep: 'none' | 'study' | 'coach'; approach: 'bold' | 'restrained' | 'playful'.
 * A good audition is often not enough; the part goes to whoever is best for it.
 * @returns {{ok, text, tone, contract?}}
 */
export function audition(productionId, idx, prep = 'study', approach = 'restrained') {
  const p = player();
  const f = workOf(p);
  const prod = production(productionId);
  const r = prod?.cast[idx];
  if (!prod || !r || prod.status !== 'casting' || r.who) return result(false, 'That part has been cast.', 'neutral');
  const key = `${prod.id}:${idx}`;
  if (f.applied[key]) return result(false, 'You have already auditioned for this part.', 'neutral');
  const why = whyNot(prod, r, p);
  if (why) return result(false, why, 'neutral');
  const cost = prep === 'coach' ? K(600) : 0;
  if (p.finance.cash < cost) return result(false, `A coach would cost ${fmtMoney(cost, country())}.`, 'neutral');
  p.finance.cash -= cost;
  f.applied[key] = year();
  const tier = TIERS[prod.tier];
  const skill = playerSkill(SKILLS_FOR[prod.kind]);
  // What is seen in the room: the craft, the preparation, and whether it matches how the director sees the part.
  const fit = approach === r.approach ? 4 : rng.chance(0.3) ? 1 : -3; // directors see a part their own way; some are persuaded
  const craft = skill + { none: -4, study: 1, coach: 4 }[prep] + fit;
  // What helps around it: a record, a reputation, an agent, a known face for a lead. Each a little.
  const star = ['lead', 'voice_lead'].includes(r.kind) ? recognitionIn(p.countryId, p) / 20 : 0;
  // On stage, training shows in the room: a conservatory degree more than a broad one (STAGE_BAR).
  const stage = ['stage', 'musical'].includes(prod.kind);
  const trained = stage ? STAGE_BAR.training[stageTraining(p)]?.audition ?? 0 : 0;
  const mine = craft + trained + Math.min(6, proCredits(p) * 1.5) + fameOf(p).credibility / 20 + (f.agent ? 2 * (f.agent.clout ?? 1) : 0) + star + rng.around(0, 8);
  // The field: other people go for every part, from the same pool of working actors; bigger parts draw stronger fields,
  // and the biggest stages draw the most, and the best, of all (STAGE_BAR).
  const field = Math.max(1, Math.round(tier.field * ROLE_KINDS[r.kind].field * (stage && r.kind !== 'child' ? STAGE_BAR.crowd[prod.tier] ?? 1 : 1)));
  const bar = stage && r.kind !== 'child' ? STAGE_BAR.bar[prod.tier] ?? 0 : 0;
  let best = 0;
  // Who turns up depends on the size of the job: the best-known actors go for the biggest parts.
  const ranked = [...pool(prod.countryId)].sort((x, y) => npcSkill(y, SKILLS_FOR[prod.kind]) - npcSkill(x, SKILLS_FOR[prod.kind]));
  const reachK = TIERS[prod.tier].reach;
  const others = ranked.slice(0, Math.max(6, Math.round(ranked.length * (reachK >= 0.5 ? 0.3 : reachK >= 0.25 ? 0.6 : 1))));
  for (let i = 0; i < field; i++) {
    // A child's part is contested by other children, not by the working actors.
    if (r.kind === 'child') { best = Math.max(best, rng.around(CHILD_PARTS.field[prod.tier] ?? 44, CHILD_PARTS.spread)); continue; }
    const n = rng.pick(others);
    best = Math.max(best, bar + npcSkill(n, SKILLS_FOR[prod.kind]) + rng.around(0, 8) + TIERS[prod.tier].reach * 6 + Math.min(6, (n.flags.star.credits?.length ?? 0) * 1.5) + (['lead', 'voice_lead'].includes(r.kind) ? n.flags.star.fame / 20 : 0));
  }
  // Community and student work takes almost anyone who turns up and can do it.
  if (['community', 'student'].includes(prod.tier)) best = Math.min(best, 35 + rng.int(0, 15));
  if (mine < best) {
    const close = best - mine < 6;
    const text = close ? `You were close for ${an(ROLE_KINDS[r.kind].name.toLowerCase())} part in ${prod.title}. They went with someone else, and told your agent they would like to see you again.`
      : approach !== r.approach ? `The director of ${prod.title} saw the part differently, and it went to someone else.`
        : `${prod.title} went with another actor for the part. That is most auditions.`;
    if (close) regard({ credibility: 0.5, why: `a near miss for ${prod.title}` }, p);
    log(text, 'system', 'neutral');
    return result(false, text, 'neutral');
  }
  const local = COUNTRIES[prod.countryId];
  const fee = K(r.fee * (1 + recognitionIn(p.countryId, p) / 200), local);
  const hours = Math.round(PRODUCTION_KINDS[prod.kind].hours * (r.kind === 'child' || p.age < 18 ? CHILD_PARTS.hours : 1)); // a child's calls are shorter, whatever the part
  const contract = { id: uid('con'), productionId: prod.id, idx, fee, weeks: weeksOf(prod), hours, years: prod.runYears,
    status: 'offered', age: p.age, asked: false, perf: Math.round(craft), paidYears: [], agent: f.agent ? { ...f.agent } : null };
  f.contracts.push(contract);
  const text = `${prod.title} wants you: ${an(ROLE_KINDS[r.kind].name.toLowerCase())} part, ${r.character}.${fee ? ` They offer ${fmtMoney(fee, local)}${prod.runYears > 1 ? ' a year' : ''}.` : ' It is unpaid.'}`;
  log(text, 'system', 'good');
  return { ...result(true, text), contract };
}

/**
 * A part offered without an audition: producers cast a known face directly (an idol in a drama, a star in a cameo).
 * The offer is an ordinary contract, accepted, negotiated or turned down like any other.
 */
export function castDirect(prod, idx, why = '') {
  const p = player();
  const f = workOf(p);
  const r = prod?.cast[idx];
  if (!r || r.who) return null;
  const local = COUNTRIES[prod.countryId];
  const fee = K(r.fee * (1 + recognitionIn(p.countryId, p) / 150), local);
  const contract = { id: uid('con'), productionId: prod.id, idx, fee, weeks: weeksOf(prod), hours: PRODUCTION_KINDS[prod.kind].hours, years: prod.runYears,
    status: 'offered', age: p.age, asked: false, perf: Math.round(playerSkill(SKILLS_FOR[prod.kind])), paidYears: [], agent: f.agent ? { ...f.agent } : null, direct: why || true };
  f.contracts.push(contract);
  return contract;
}

/** Asks for more. A single try; the production may stand firm, and rarely withdraws. */
export function negotiate(contractId) {
  const f = workOf();
  const c = f.contracts.find((x) => x.id === contractId && x.status === 'offered');
  if (!c) return result(false, 'There is no offer to discuss.', 'neutral');
  if (c.asked) return result(false, 'You have already asked.', 'neutral');
  c.asked = true;
  if (!c.fee) return result(false, 'There is no money in it to negotiate.', 'neutral');
  if (rng.chance(0.06)) { c.status = 'withdrawn'; return result(false, 'The producers decided to go another way.'); }
  const odds = clamp(0.3 + (f.agent ? 0.2 * (f.agent.clout ?? 1) : 0) + recognitionIn(player().countryId) / 150, 0.1, 0.85);
  if (!rng.chance(odds)) return result(false, '"That is the fee for the part."', 'neutral');
  c.fee = Math.round(c.fee * (1.08 + rng.next() * 0.12));
  return result(true, `They came up to ${fmtMoney(c.fee, COUNTRIES[production(c.productionId).countryId])}.`);
}

export function decline(contractId) {
  const c = workOf().contracts.find((x) => x.id === contractId && x.status === 'offered');
  if (!c) return result(false, 'There is no offer.', 'neutral');
  c.status = 'declined';
  return result(true, 'You turn it down.', 'neutral');
}

/** Signs a contract: the player is in the cast. */
export function sign(contractId) {
  const p = player();
  const f = workOf(p);
  const c = f.contracts.find((x) => x.id === contractId && x.status === 'offered');
  if (!c) return result(false, 'That offer is no longer open.', 'neutral');
  const prod = production(c.productionId);
  const r = prod.cast[c.idx];
  if (r.who || prod.status !== 'casting') { c.status = 'withdrawn'; return result(false, 'The part has gone to someone else.', 'neutral'); }
  const clash = scheduleClash(prod, p);
  if (clash) return result(false, clash, 'neutral');
  // The contract's own hours (a child's are shorter); a performer may work below the usual working age (engine/worklife.js).
  const fit = canFit(Math.round((c.hours ?? PRODUCTION_KINDS[prod.kind].hours) * weeksOf(prod) / 48), { kind: 'freelance', performer: true });
  if (!fit.ok) return fit;
  c.status = 'signed';
  r.who = 'player';
  prod.keep = true; // a production someone in the family worked on is kept for good
  r.perf = c.perf;
  const text = `You sign for ${prod.title}. ${PRODUCTION_KINDS[prod.kind].verb === 'performed' ? 'Rehearsals' : 'Work'} start${prod.workYear > year() ? ' next year' : ''}.`;
  log(text, 'system', 'good');
  if (!f.credits.length && prod.tier !== 'community') milestone(`Signed for a first professional part: ${prod.title}.`, 'fame');
  return result(true, text);
}

// ---------- The work itself ----------

/** Things to do on a production during its working year. */
export const SET_ACTIONS = {
  table: { name: 'Prepare: read everything, learn it cold', perf: 4, rel: 0 },
  rehearse: { name: 'Rehearse with the other actors', perf: 3, rel: 4 },
  director: { name: 'Talk the part through with the director', perf: 5, rel: 0, director: 6 },
  cast: { name: 'Get to know the company', perf: 1, rel: 8 },
  press: { name: 'Do the publicity they ask of you', perf: 0, rel: 2, attention: 3 },
};

/** Productions the player is working on now. */
export const activeWork = (p = player()) => commitments(year(), p).filter((x) => ['production', 'running'].includes(x.status));

/** Castmates in a production, as people. */
export const castOf = (prod) => prod.cast.filter((r) => r.who && r.who !== 'player').map((r) => ({ role: r, npc: store.state.npcs[r.who] })).filter((x) => x.npc);

/** Brings a castmate into the player's life (as a colleague) the first time they work together. */
function meet(n, prod) {
  const p = player();
  if (!n || p.npcIds.includes(n.id)) return n;
  n.role = 'colleague';
  n.flags.workedWith = prod.title;
  n.flags.title = n.flags.star?.kind === 'director' ? `Director of ${prod.title}` : `In ${prod.title} with you`;
  n.age = ageOf(n);
  n.lastInteractionAge = p.age;
  p.npcIds.push(n.id);
  return n;
}

/** A thing done on set, at most two a year for each production. */
export function onSet(productionId, action) {
  const p = player();
  const f = workOf(p);
  const prod = production(productionId);
  const a = SET_ACTIONS[action];
  if (!prod || !a || !activeWork(p).some((x) => x.id === productionId)) return result(false, 'You are not working on that.', 'neutral');
  const w = (f.work[productionId] ??= { done: [], age: p.age, perf: 0 });
  if (w.age !== p.age) { w.done = []; w.age = p.age; }
  if (w.done.includes(action) || w.done.length >= 2) return result(false, 'You have given this production what time you have this year.', 'neutral');
  w.done.push(action);
  w.perf = Math.min(6, w.perf + a.perf); // preparation helps; it cannot make a performer someone else
  const mates = castOf(prod);
  if (a.rel) for (const { npc } of mates.slice(0, 3)) { meet(npc, prod); npc.meters.relationship = clamp(npc.meters.relationship + a.rel); npc.lastInteractionAge = p.age; }
  const director = store.state.npcs[prod.directorId];
  if (a.director && director) { meet(director, prod); director.meters.relationship = clamp(director.meters.relationship + a.director); remember(director, `worked_${prod.id}`, `You worked closely on ${prod.title}.`); }
  if (a.attention) gain({ audience: PRODUCTION_KINDS[prod.kind].audience, amount: a.attention, why: `publicity for ${prod.title}` }, p);
  const text = { table: `You know every line of ${prod.title} by the first day, and other people's too.`, rehearse: 'Rehearsals go well. You find things in the scenes you had not seen on the page.',
    director: `${director?.firstName ?? 'The director'} and you take the part apart and put it back together.`, cast: `You get to know the company. ${mates[0]?.npc.firstName ?? 'Someone'} makes you laugh on the worst day.`,
    press: 'You smile for the cameras and say the nice things.' }[action];
  return result(true, text);
}

/** How a production went, once it is out: critics, audiences and money are separate. */
function receive(prod) {
  const k = PRODUCTION_KINDS[prod.kind];
  const director = store.state.npcs[prod.directorId];
  const castSkill = prod.cast.filter((r) => r.who).map((r) => (r.who === 'player' ? playerSkill(SKILLS_FOR[prod.kind]) : npcSkill(store.state.npcs[r.who] ?? { flags: {} }, SKILLS_FOR[prod.kind])) * ROLE_KINDS[r.kind].weight);
  const weight = prod.cast.filter((r) => r.who).reduce((s, r) => s + ROLE_KINDS[r.kind].weight, 0) || 1;
  const quality = castSkill.reduce((a, b) => a + b, 0) / weight * 0.5 + (director?.flags.star?.skill.acting ?? 55) * 0.3 + rng.around(10, 14);
  const critics = Math.round(clamp(quality + rng.around(0, 10)));
  const stars = prod.cast.filter((r) => r.who && ['lead', 'voice_lead'].includes(r.kind)).map((r) => (r.who === 'player' ? recognitionIn(prod.countryId) : store.state.npcs[r.who]?.flags.star?.fame ?? 10));
  const audience = Math.round(clamp(critics * 0.45 + 22 + (Math.max(0, ...stars) / 3) + rng.around(0, 16)));
  const gross = Math.round(prod.budget * (0.3 + audience / 55) * rng.around(1, 0.25));
  prod.reception = { critics, audience, gross, profit: gross - prod.budget, year: year() };
  // Where it traveled: the bigger the release, the more countries; always the same ones once chosen.
  const reach = TIERS[prod.tier].reach;
  const n = Math.round(reach * reach * 12 * (audience / 60));
  prod.abroad = COUNTRY_LIST.filter((c) => c.id !== prod.countryId).sort(() => rng.next() - 0.5).slice(0, n).map((c) => c.id);
  // Each performance is judged on its own.
  for (const r of prod.cast) {
    if (!r.who) continue;
    const base = r.who === 'player' ? (r.perf ?? playerSkill(SKILLS_FOR[prod.kind])) + (workOf().work[prod.id]?.perf ?? 0) : npcSkill(store.state.npcs[r.who] ?? { flags: {} }, SKILLS_FOR[prod.kind]) + rng.int(-2, 4);
    r.score = Math.round(clamp(base * 0.8 + critics * 0.2 + rng.around(0, 6)));
  }
  return prod.reception;
}

/** What the player's part did for them, when the production comes out. */
function creditPlayer(prod) {
  const p = player();
  const f = workOf(p);
  const r = prod.cast.find((x) => x.who === 'player');
  if (!r) return [];
  const lines = [];
  if (!f.credits.some((c) => c.productionId === prod.id)) f.credits.push({ productionId: prod.id, idx: r.idx, year: prod.workYear });
  // A child who worked on a professional stage carries it into a grown-up career in musical theater (data/careers.js).
  if (['stage', 'musical'].includes(prod.kind) && prod.tier !== 'community' && p.age - (year() - prod.workYear) < 18) {
    p.flags.childStage = true;
    if (prod.tier === 'major_stage') p.flags.childStageMajor = true;
  }
  const k = PRODUCTION_KINDS[prod.kind];
  const R = prod.reception;
  const size = ROLE_KINDS[r.kind].weight;
  const reach = TIERS[prod.tier].reach;
  const amount = 22 * reach * size * (0.4 + R.audience / 100) + (r.score >= 80 ? 3 : 0); // balance: scripts/balance/fame.mjs
  gain({ audience: k.audience, amount, abroad: prod.abroad, reach, lasting: 0.3 + (R.critics >= 75 ? 0.2 : 0), why: `${prod.title}` }, p);
  const acclaim = (r.score - 60) / 8;
  regard({ credibility: acclaim * (0.5 + size), why: `your performance in ${prod.title}` }, p);
  for (const { npc } of castOf(prod)) { meet(npc, prod); if (npc.flags.star) npc.flags.star.credits.push(prod.id); }
  const verdict = r.score >= 85 ? 'Reviewers single out your performance.' : r.score >= 70 ? 'Your performance is well reviewed.' : r.score >= 50 ? 'Your work is solid; the reviews talk about other things.' : 'The reviews are not kind about your scenes.';
  const how = R.critics >= 75 ? 'Critics love it' : R.critics >= 55 ? 'Critics are warm' : R.critics >= 40 ? 'Critics are divided' : 'Critics are harsh';
  const crowd = R.audience >= 75 ? 'and audiences flock to it' : R.audience >= 55 ? 'and it finds its audience' : R.audience >= 40 ? 'and it does modest business' : 'and few people see it';
  lines.push(`${prod.title} ${k.medium === 'stage' ? 'opens' : 'is released'}. ${how}, ${crowd}. ${verdict}`);
  if (f.credits.filter((c) => production(c.productionId)?.tier !== 'community').length === 1 && prod.tier !== 'community') milestone(`First professional credit: ${prod.title}.`, 'fame');
  if (prod.tier === 'community' && f.credits.length === 1) milestone(`First time on stage: ${prod.title}.`, 'fame');
  return lines;
}

/** The pay for a working year, once: a payroll line for each contract that year completed. */
export function contractLines(p = player()) {
  const f = workOf(p);
  const out = [];
  for (const c of f.contracts) {
    if (c.status !== 'signed' && c.status !== 'completed') continue;
    for (const y of c.due ?? []) {
      if (c.paidYears.includes(y) || !c.fee) continue;
      const commission = c.agent ? Math.round(c.fee * c.agent.commission) : 0;
      const trust = c.childAtWork ? Math.round(c.fee * CHILD_TRUST_SHARE) : 0;
      out.push({ source: `ent:${c.id}:${y}`, label: `${production(c.productionId)?.title ?? 'A production'}${commission ? ' (after the agent\'s cut)' : ''}${trust ? ' (part held in trust)' : ''}`, gross: c.fee - commission - trust, contract: c.id, year: y });
    }
  }
  return out;
}
/** Marks contract years paid (called by payroll after it pays them). */
export function markContractsPaid(p = player()) {
  for (const c of workOf(p).contracts) for (const y of c.due ?? []) if (!c.paidYears.includes(y)) c.paidYears.push(y);
}

// ---------- The year ----------

/**
 * Once a year, before payroll. Casting closes; productions shoot, run, open and close;
 * the player's year of work becomes pay due, a credit, and recognition. @returns {string[]}
 */
export function tickEntertainment() {
  const p = player();
  const E = ent();
  const f = workOf(p);
  const lines = [];
  const lived = year() - 1; // the year just lived
  // People in the industry get older; a few retire or die, and others take their places.
  for (const ids of Object.values(E.pool)) for (const id of ids) {
    const n = store.state.npcs[id];
    if (!n?.alive) continue;
    n.age = ageOf(n);
    if (n.age > 78 && rng.chance((n.age - 75) / 60)) { n.alive = false; n.flags.diedYear = year(); }
    else if (n.age > 72 && n.flags.star && !n.flags.star.retired && rng.chance(0.2)) n.flags.star.retired = year();
  }
  for (const prod of Object.values(E.productions)) {
    const mine = prod.cast.find((r) => r.who === 'player');
    if (prod.status === 'casting' && prod.created < year()) {
      // Whoever was not cast by the player is cast from the pool; the work begins.
      for (const r of prod.cast) {
        if (r.who) continue;
        const fits = pool(prod.countryId).filter((n) => ageOf(n) >= r.ages[0] - 4 && ageOf(n) <= r.ages[1] + 8 && !prod.cast.some((x) => x.who === n.id));
        const anyone = pool(prod.countryId).filter((n) => !prod.cast.some((x) => x.who === n.id)).sort((a, b) => Math.abs(ageOf(a) - r.ages[0]) - Math.abs(ageOf(b) - r.ages[0]));
        r.who = (fits.sort((a, b) => npcSkill(b, SKILLS_FOR[prod.kind]) - npcSkill(a, SKILLS_FOR[prod.kind]))[rng.int(0, Math.min(4, fits.length - 1))] ?? anyone[0])?.id ?? null;
      }
      prod.status = ['stage', 'musical'].includes(prod.kind) ? 'running' : 'production';
      continue;
    }
    if (['production', 'running'].includes(prod.status) && prod.workYear <= lived) {
      if (mine) {
        for (const c of f.contracts.filter((x) => x.productionId === prod.id && x.status === 'signed')) {
          if ((c.due ??= []).includes(lived)) continue; // a year's work is due once
          c.due.push(lived);
          if (p.age - 1 < 18) c.childAtWork = true;
          if (c.childAtWork && c.fee) f.trust += Math.round(c.fee * CHILD_TRUST_SHARE);
        }
      }
      // The first year is when it is judged: released, or opened.
      if (!prod.reception) {
        receive(prod);
        if (mine) lines.push(...creditPlayer(prod));
        org(prod.orgId)?.history.push({ year: year(), text: `${prod.title} came out to ${prod.reception.critics >= 60 ? 'good' : 'mixed'} reviews.` });
        article({ kind: 'review', productionId: prod.id, accuracy: 'verified', text: `${prod.title}: ${prod.reception.critics >= 75 ? 'a triumph' : prod.reception.critics >= 55 ? 'well worth seeing' : prod.reception.critics >= 40 ? 'a mixed bag' : 'a misfire'}.` });
      }
      const ends = prod.workYear + prod.runYears - 1;
      if (ends <= lived) {
        prod.status = ['stage', 'musical'].includes(prod.kind) ? 'closed' : 'released';
        for (const c of f.contracts.filter((x) => x.productionId === prod.id && x.status === 'signed')) c.status = 'completed';
        if (mine && prod.runYears > 1) lines.push(`${prod.title} has closed after ${prod.runYears} years.`);
      }
    }
  }
  // Offers lapse with the year.
  for (const c of f.contracts) if (c.status === 'offered' && c.age < p.age - 1) c.status = 'lapsed';
  // Money held in trust for a child performer is theirs when they come of age.
  if (f.trust > 0 && p.age >= 18) {
    p.finance.cash += f.trust;
    lines.push(`The earnings held in trust from your years as a child performer are yours now: ${fmtMoney(f.trust, country())}.`);
    f.trust = 0;
  }
  // A new year's productions, where the player lives.
  slate(p.countryId);
  // Keep the save in proportion: old productions nobody worked on are forgotten after a while, unless an award or a credit names them.
  for (const [id, prod] of Object.entries(E.productions)) {
    // Award seasons keep the names and titles they need; only what the family worked on is kept whole.
    if (['released', 'closed'].includes(prod.status) && prod.workYear + prod.runYears < year() - 1 && !prod.keep) delete E.productions[id];
    if (prod.status === 'casting' && prod.created < year() - 1) delete E.productions[id];
  }
  return lines;
}

// ---------- Press ----------

/** Writes a story in one of the country's outlets. */
export function article(o) {
  const p = player();
  const E = ent();
  const prod = o.productionId ? production(o.productionId) : null;
  const outlets = orgsOf(prod?.countryId ?? p.countryId).filter((x) => x.kind === 'outlet');
  const a = { id: nextId('art'), outletId: o.outletId ?? rng.pick(outlets)?.id ?? null, year: year(), kind: o.kind, productionId: o.productionId ?? null, about: o.about ?? null,
    text: o.text, accuracy: o.accuracy ?? 'verified', true: o.true ?? true, corrected: false };
  if (prod) prod.keep = prod.keep || (prod.cast.some((r) => r.who === 'player'));
  E.articles.push(a);
  if (E.articles.length > 200) E.articles.splice(0, E.articles.length - 200);
  return a;
}

/** Stories that mention the player, newest first. */
export const myPress = (p = player()) => ent().articles.filter((a) => a.about === 'player' || (a.productionId && production(a.productionId)?.cast.some((r) => r.who === 'player'))).reverse();

/**
 * When the story passes to an heir: the industry is the same industry. Its people are carried into the
 * new life's records (not into the heir's life), and every credit, nomination and story that was the old
 * player's is re-pointed at them as an ancestor, so it is never mistaken for the heir's own.
 * @param {string} ancestorId  the old player, as the NPC the heir knows them as
 */
export function carryWorld(old, next, ancestorId) {
  if (!old.ent) return;
  next.ent = old.ent;
  const E = next.ent;
  const keep = new Set([...Object.values(E.pool).flat(), ...Object.values(E.orgs).flatMap((o) => o.staff),
    ...Object.values(E.productions).flatMap((x) => [x.directorId, ...x.cast.map((r) => r.who)]),
    ...Object.values(E.musicians ?? {}).flat(), ...Object.values(E.acts ?? {}).flatMap((a) => a.members.map((m) => m.who))]);
  for (const id of keep) {
    if (!id || id === 'player' || next.npcs[id] || !old.npcs[id]) continue;
    const n = old.npcs[id];
    if (n.role === 'colleague') n.role = n.flags.star?.kind === 'agent' ? 'performer' : 'performer';
    next.npcs[id] = n;
  }
  const who = (x) => (x === 'player' ? ancestorId ?? null : x);
  for (const x of Object.values(E.productions)) for (const r of x.cast) r.who = who(r.who);
  for (const s of Object.values(E.seasons)) for (const cat of Object.values(s.categories)) { for (const n of cat.nominees) n.who = who(n.who); cat.winner.who = who(cat.winner.who); }
  for (const a of E.articles) if (a.about === 'player') a.about = ancestorId ?? null;
  for (const b of Object.values(E.books ?? {})) if (b.author === 'player') { b.author = ancestorId ?? null; b.keep = true; }
  // Music: the parent's acts carry on in the world (or rest), as theirs; the heir starts with none of their own.
  for (const a of Object.values(E.acts ?? {})) {
    if (!a.members.some((m) => m.who === 'player')) continue;
    for (const m of a.members) if (m.who === 'player') { m.who = ancestorId ?? null; if (m.to == null) m.to = old.year; }
    a.npc = true;
    if (!a.members.some((m) => m.who && m.to == null)) a.status = 'split';
    a.offer = null;
  }
  for (const o of Object.values(E.orgs)) for (const id of o.staff) { const n = next.npcs[id]; if (n?.flags.agent) n.flags.agent.clients = n.flags.agent.clients.filter((c) => c !== 'player'); }
}

/** The credits of anyone (an NPC id, or 'player'), from the productions themselves. */
export function creditsOf(who) {
  return Object.values(ent().productions).flatMap((x) => x.cast.filter((r) => r.who === who).map((r) => ({ production: x, role: r })))
    .sort((a, b) => a.production.workYear - b.production.workYear);
}

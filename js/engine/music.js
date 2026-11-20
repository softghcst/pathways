// Music: acts (a solo artist, or a band of persistent people), songs written
// from real skill, releases with their own reception and charts, gigs and
// tours with real dates and takings, record deals with advances that have to
// be earned back, royalties that tail off, and rival acts doing all of it too.
//
//   state.ent.acts:     { id: Act }       Act: { id, name, genre, kind:'solo'|'band', countryId, formed, members:[{ who, role, from, to }],
//                                                status:'active'|'hiatus'|'split', fans:{ cc: n }, deal, releases[], tours[], history[], npc }
//   state.ent.releases: { id: Release }   Release: { id, title, actId, type, songs, quality, made, released, labelId, units:{cc:n}, critics,
//                                                     chart, revenue[{year, gross, toAct}], paid[], first, share }
//   state.ent.tours:    { id: Tour }      Tour: { id, actId, title, scale, year, dates:[{ countryId, city, capacity, sold, gross }], cost, net, weeks, status }
//   p.fame.acts:  [actIds]  every act the player has been in;  p.fame.songs: [{ q, written }]  songs not yet released
//
// Money: an act's takings are split between its members; the player's share
// is paid through payroll, once per source per year. A label's advance is paid
// once, and the act's royalties go to paying it back before anything more is paid.
import { rng } from '../rng.js';
import { clamp, fmtMoney, localWage, wageIn, uid } from '../util.js';
import { store, player, country, log, milestone } from '../state.js';
import { COUNTRIES } from '../data/countries.js';
import { BAND_WORDS, SONG_WORDS, RELEASE_TYPES, VENUES, LABEL_NAMES, MUSIC_DEAL, ORG_WORDS } from '../data/fame.js';
import { makeNpc } from './npcFactory.js';
import { makeAgents, ensureTerms, look as lookFor, offered, clearOffer, triesLeft, askLowerCut } from './agents.js';
import { POSITIONS, GENRES, GENRE_BY_ID, genreOf, genresIn, LABEL_KINDS, LABEL_SOUNDS, LABEL_SOUND_WORDS, BAND_SEARCH } from '../data/music.js';
import { resolve } from './conditions.js';
import { levelOf } from './skills.js';
import { ent, workOf, orgsOf, article, commitments } from './entertainment.js';
import { gain, regard, exists } from './fame.js';
import { registerEmployer } from './employers.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const year = () => store.state.year;
const K = (base, c = country()) => Math.round(localWage(base, c));
const M = () => { const E = ent(); E.acts ??= {}; E.releases ??= {}; E.tours ??= {}; E.musicians ??= {}; E.labels ??= {}; E.openings ??= {}; E.heat ??= {}; return E; };
const nextId = (prefix) => `${prefix}_${(ent().seq += 1).toString(36)}`;
export const act = (id) => M().acts[id] ?? null;
export const release = (id) => M().releases[id] ?? null;
export const tour = (id) => M().tours[id] ?? null;
const fanTotal = (a) => Object.values(a.fans).reduce((s, v) => s + v, 0);
const members = (a, y = year()) => a.members.filter((m) => m.from <= y && (m.to == null || m.to >= y));

function musicOf(p = player()) {
  const f = workOf(p);
  f.acts ??= [];
  f.songs ??= [];
  f.musicActs ??= { age: null, gigs: 0, writes: 0 };
  if (f.musicActs.age !== p.age) f.musicActs = { age: p.age, gigs: 0, writes: 0 };
  return f;
}
/** The act the player is in now, if any. */
export const myAct = (p = player()) => musicOf(p).acts.map(act).find((a) => a && a.status !== 'split' && a.members.some((m) => m.who === 'player' && m.to == null)) ?? null;

// ---------- Skill ----------

/** How well someone writes songs, and performs them. */
export const songwriting = (p = player()) => Math.round(p.talents.music * 0.5 + levelOf('writing') * 0.3 + p.talents.singing * 0.2);
export const performing = (p = player()) => Math.round(Math.max(p.talents.singing, p.talents.music) * 0.7 + Math.min(p.talents.singing, p.talents.music) * 0.3);
const npcPerf = (n, pos = null) => {
  const s = n?.flags.star?.skill ?? {};
  if (pos && n?.flags.star?.plays?.[pos] != null) return n.flags.star.plays[pos];
  return Math.round(((s.singing ?? 50) + (s.music ?? s.acting ?? 50)) / 2);
};

/** How well the player plays a position in a band: the instrument (or voice) practiced, and the talent behind it. */
export function positionSkill(pos, p = player()) {
  const P = POSITIONS[pos];
  if (!P) return performing(p);
  const talent = p.talents[P.talent] ?? 50;
  if (pos === 'rapper') return Math.round(clamp(levelOf('writing') * 0.45 + p.stats.charm * 0.3 + talent * 0.25));
  const practiced = levelOf(P.skill);
  return Math.round(clamp(Math.max(practiced * 0.65 + talent * 0.35, talent * 0.7)));
}
/** The positions the player plays best, best first. */
export const bestPositions = (p = player(), n = 3) => Object.keys(POSITIONS).map((k) => ({ pos: k, skill: positionSkill(k, p) })).sort((a, b) => b.skill - a.skill).slice(0, n);

const memberSkill = (m) => (m.who === 'player' ? positionSkill(POSITIONS[m.role] ? m.role : 'vocals') : npcPerf(store.state.npcs[m.who], m.role));
function actPerf(a) {
  const ms = members(a);
  if (!ms.length) return 40;
  return Math.round(ms.reduce((s, m) => s + memberSkill(m), 0) / ms.length);
}

/** How well an act suits its genre: each genre wants something different (singing, playing, writing, presence). */
export function genreFit(a) {
  const g = genreOf(a.genre);
  const ms = members(a);
  if (!ms.length) return 50;
  const sing = Math.max(...ms.filter((m) => ['vocals', 'backing', 'solo'].includes(m.role)).map(memberSkill), 30);
  const playing = ms.filter((m) => !['vocals', 'backing', 'solo', 'rapper'].includes(m.role)).map(memberSkill);
  const play = playing.length ? playing.reduce((x, y) => x + y, 0) / playing.length : (a.members.some((m) => m.who === 'player') ? player().talents.music : 45);
  const write = a.members.some((m) => m.who === 'player' && m.to == null) ? songwriting() : npcPerf(store.state.npcs[ms[0].who]);
  const presence = a.members.some((m) => m.who === 'player' && m.to == null) ? player().stats.charm : 55;
  const st = g.style;
  return Math.round((st.singing ?? 0) * sing + (st.playing ?? 0) * play + (st.writing ?? 0) * write + (st.presence ?? 0) * presence);
}

/** How popular each genre is this year: tastes drift, and some genres are bigger in some countries. */
export function heat(genreId) {
  const E = M();
  if (E.heatYear !== year()) {
    for (const g of genresIn(year())) E.heat[g.id] = Math.round(clamp((E.heat[g.id] ?? 1) + rng.around(0, 0.12) + (1 - (E.heat[g.id] ?? 1)) * 0.15, 0.5, 1.7) * 100) / 100;
    E.heatYear = year();
  }
  return E.heat[genreId] ?? 1;
}
const popularIn = (genreId, countryId) => genreOf(genreId).pull * heat(genreOf(genreId).id) * (genreOf(genreId).strong.includes(countryId) ? 1.4 : 1);
/** Genres doing best this year, for the charts' talk. */
export const trending = (n = 3) => genresIn(year()).map((g) => ({ g, k: heat(g.id) })).sort((a, b) => b.k - a.k).slice(0, n).map((x) => x.g);

// ---------- People and labels ----------

function musician(countryId, o = {}) {
  const age = o.age ?? rng.int(18, 50);
  const n = makeNpc({ role: 'performer', countryId, age, relationship: rng.int(40, 60) });
  const base = clamp(rng.around(o.level ?? 55, 15), 20, 96);
  // What they play: one position they are good at, maybe a second; and the music they love.
  const pos = o.position ?? rng.pick(['vocals', 'lead_guitar', 'rhythm_guitar', 'bass', 'drums', 'drums', 'bass', 'keys', 'producer', 'rapper', 'sax', 'violin']);
  const second = rng.chance(0.4) ? rng.pick(Object.keys(POSITIONS).filter((k) => k !== pos)) : null;
  const plays = { [pos]: Math.round(clamp(base + rng.int(-4, 8))) };
  if (second) plays[second] = Math.round(clamp(base - rng.int(5, 20)));
  const loves = genresIn(year()).filter((g) => g.lineup.includes(pos) || !g.band).sort(() => rng.next() - 0.5).slice(0, 3).map((g) => g.id);
  n.flags.star = { skill: { singing: Math.round(clamp(pos === 'vocals' ? base + 5 : base + rng.int(-15, 10))), music: Math.round(clamp(base + rng.int(-8, 8))), acting: 40, dance: 40, charm: Math.round(base) },
    plays, loves, born: year() - age, fame: 0, credits: [], kind: 'musician' };
  n.occupation = 'musician';
  store.state.npcs[n.id] = n;
  return n;
}
/** Musicians looking for a band, in a country. */
export function musicians(countryId) {
  const E = M();
  const taken = new Set(Object.values(E.acts).filter((a) => a.status !== 'split').flatMap((a) => members(a).map((m) => m.who)));
  const alive = (E.musicians[countryId] ?? []).filter((id) => store.state.npcs[id]?.alive && !taken.has(id)); // someone in a band is not looking for one
  while (alive.length < 14) alive.push(musician(countryId).id);
  E.musicians[countryId] = alive;
  return alive.map((id) => store.state.npcs[id]);
}
/** How much a family of genres sells in a country: what is big here counts far more than what is big elsewhere. */
const localTaste = (sound, countryId) => Math.max(...sound.map((id) => GENRE_BY_ID[id]).filter(Boolean).map((g) => g.pull * (g.strong.includes(countryId) ? 1.6 : 0.6)));

/** A country's record labels, made once: two majors that sign anything, and independents that keep to a sound. */
export function labels(countryId) {
  const E = M();
  const c = COUNTRIES[countryId];
  const make = (tier, sound) => {
    const city = tier === 'major' ? (c.place?.capital ?? c.cities[0]) : rng.pick(c.cities);
    let word = sound ? LABEL_SOUND_WORDS[sound[0]] ?? rng.pick(ORG_WORDS) : rng.pick(ORG_WORDS);
    const taken = new Set(Object.values(E.orgs).filter((x) => x.countryId === countryId).map((x) => x.name));
    let name;
    do name = rng.pick(LABEL_NAMES).replace('{W}', word).replace('{C}', city).replace('{S}', rng.pick(c.names.last)); while (taken.has(name) && (word = rng.pick(ORG_WORDS), true));
    const e = registerEmployer({ name, family: 'arts', tracks: ['music_prod', 'marketing'], countryId, city, owned: false });
    const K2 = LABEL_KINDS[tier];
    const o = { id: nextId('org'), kind: 'label', name, countryId, city, tier, founded: year() - rng.int(3, 60), reputation: tier === 'major' ? rng.int(65, 90) : rng.int(35, 70), employerId: e.id, staff: [], history: [],
      sound: sound ?? null, terms: { royalty: K2.royalty, advance: Math.round(K2.advance * rng.around(1, 0.15) * 100) / 100, albums: K2.albums } };
    E.orgs[o.id] = o;
    (E.byCountry[countryId] ??= []).push(o.id);
    return o.id;
  };
  if (!E.labels[countryId]) E.labels[countryId] = ['major', 'major'].map((t) => make(t, null));
  // Labels made before sounds existed are given one; there are always independents for several sounds.
  const have = E.labels[countryId].map((id) => ent().orgs[id]);
  for (const l of have) { if (l.tier !== 'major' && !l.sound) l.sound = rng.pick(LABEL_SOUNDS); l.terms ??= { ...LABEL_KINDS[l.tier], advance: LABEL_KINDS[l.tier].advance }; }
  const indies = have.filter((l) => l.tier !== 'major').length;
  // The sounds that sell here get their own labels first.
  const sounds = [...LABEL_SOUNDS].filter((snd) => snd.some((g) => GENRE_BY_ID[g] && year() >= GENRE_BY_ID[g].from)).filter((snd) => !have.some((l) => l.sound?.[0] === snd[0]))
    .sort((x, y) => localTaste(y, countryId) - localTaste(x, countryId) + rng.around(0, 0.1));
  for (let i = indies; i < 8; i++) E.labels[countryId].push(make('indie', sounds[i - indies] ?? rng.pick(LABEL_SOUNDS)));
  return E.labels[countryId].map((id) => ent().orgs[id]);
}
/** The acts a label has signed: who you would be alongside. */
export const roster = (labelId) => Object.values(M().acts).filter((a) => a.labelId === labelId || a.deal?.labelId === labelId).sort((x, y) => fanTotal(y) - fanTotal(x));
export const labelSound = (l) => (l.sound ? l.sound.map((id) => GENRE_BY_ID[id]?.name ?? id).join(', ') : 'Every kind of music');

// ---------- Managers ----------

/** A country's music managers: people with their own cut, their pull with labels and promoters, and acts on their books. */
export function managers(countryId) {
  const E = M();
  E.managers ??= {};
  if (!E.managers[countryId]) {
    rivals(countryId);
    const acts = Object.values(E.acts).filter((a) => a.npc && a.countryId === countryId && a.status === 'active').sort((x, y) => fanTotal(y) - fanTotal(x));
    E.managers[countryId] = makeAgents('music', countryId, { country: COUNTRIES[countryId], makeNpc, words: ORG_WORDS, agencyNames: ['{S} Artist Management', '{W} Management', '{S} & {S2}', '{W} Music Management'],
      clients: (tier) => (tier === 'top' ? acts.splice(0, 3) : acts.splice(rng.int(0, Math.max(0, acts.length - 3)), 2)).map((a) => { a.managerOf = true; return store.state.npcs[members(a)[0]?.who]; }).filter(Boolean) });
  }
  return E.managers[countryId].map((id) => store.state.npcs[id]).filter((n) => n?.alive !== false).map((n) => { ensureTerms(n); return n; });
}
/** The act a manager's client fronts, for showing who they manage. */
export const actOfClient = (npcId) => Object.values(M().acts).find((a) => a.members.some((m) => m.who === npcId && m.to == null)) ?? null;
const managerOf = (p = player()) => musicOf(p).manager ?? null;
export const myManager = managerOf;
export function managersWilling(p = player()) {
  const a = myAct(p);
  const worth = a ? actPerf(a) * 0.5 + Math.log10(fanTotal(a) + 1) * 8 : 0;
  return managers(p.countryId).filter((n) => n.flags.agent.standard <= worth && n.id !== managerOf(p)?.npcId);
}
export function findManager() {
  const p = player();
  if (!myAct(p)) return result(false, 'Managers manage acts. Start or join one first.', 'neutral');
  const r = lookFor('music', managersWilling(p), p);
  if (r.error) return result(false, r.error, 'neutral');
  if (r.none) return result(false, 'No manager will take you on yet. Fans and good songs change that.', 'neutral');
  return result(true, `${r.agent.firstName} ${r.agent.lastName} of ${r.agent.flags.agent.agency} would manage you, for ${Math.round(r.agent.flags.agent.commission * 100)}% of what your music earns you.`, 'neutral');
}
export const managerOnOffer = () => offered('music');
export const managerTriesLeft = () => triesLeft('music');
export function passOnManager() { clearOffer('music'); return result(true, 'You say no.', 'neutral'); }
export function signManager() {
  const p = player();
  const n = offered('music', p);
  if (!n) return result(false, 'No manager is on offer.', 'neutral');
  if (managerOf(p)) dropManager();
  const a = n.flags.agent;
  musicOf(p).manager = { npcId: n.id, agency: a.agency, commission: a.commission, clout: a.clout, since: year() };
  a.clients.push('player');
  if (!p.npcIds.includes(n.id)) { p.npcIds.push(n.id); n.role = 'colleague'; }
  n.flags.title = 'Your manager';
  clearOffer('music', p);
  return result(true, `${n.firstName} ${n.lastName} manages you now: labels, promoters, and ${Math.round(a.commission * 100)}% of what your music earns you.`);
}
export function dropManager() {
  const p = player();
  const mg = managerOf(p);
  if (!mg) return result(false, 'You have no manager.', 'neutral');
  const n = store.state.npcs[mg.npcId];
  if (n?.flags.agent) { n.flags.agent.clients = n.flags.agent.clients.filter((c) => c !== 'player'); n.flags.title = 'Your former manager'; }
  musicOf(p).manager = null;
  return result(true, 'You and your manager part ways.', 'neutral');
}
export const askManagerCut = () => { const p = player(); const a = myAct(p); const r = askLowerCut('music', managerOf(p), a ? Math.log10(fanTotal(a) + 1) * 12 - 10 : 0, p); if (r.dropped) dropManager(); return r; };

// ---------- Bands looking for people ----------

const posLow = (k) => (k === 'producer' ? 'DJ and producer' : POSITIONS[k]?.name.toLowerCase() ?? k);
const searchOf = (p = player()) => { const f = musicOf(p); if (f.bandSearch?.age !== p.age) f.bandSearch = { age: p.age, auditions: 0, demos: 0, ads: {} }; return f.bandSearch; };
export const auditionsLeft = () => BAND_SEARCH.auditions - searchOf().auditions;
export const demosLeft = () => BAND_SEARCH.demos - searchOf().demos;

/**
 * This year's notices from bands looking for someone: a place in the line-up, the band's sound, how good
 * they are and how far along. Some are established acts replacing someone; most are new bands.
 */
export function openings(countryId = player().countryId) {
  const E = M();
  const key = `${countryId}:${year()}`;
  if (!E.openings[key]) {
    for (const k of Object.keys(E.openings)) if (!k.endsWith(`:${year()}`)) delete E.openings[k];
    rivals(countryId);
    const list = [];
    const established = Object.values(E.acts).filter((a) => a.npc && a.kind === 'band' && genreOf(a.genre).band && a.countryId === countryId && a.status === 'active' && !a.members.some((m) => m.who === 'player'));
    for (const a of established.sort(() => rng.next() - 0.5).slice(0, 2)) {
      const g = genreOf(a.genre);
      list.push({ id: nextId('open'), actId: a.id, name: a.name, genre: g.id, position: rng.pick(g.lineup.filter((x) => x !== a.members[0].role)) ?? g.lineup.at(-1), bar: Math.round(npcPerf(store.state.npcs[a.members[0].who]) - 4), fans: fanTotal(a), labelId: a.labelId ?? null, status: 'open' });
    }
    const pool = musicians(countryId);
    for (const n of pool) delete n.flags.star.bandOpening; // last year's notices are gone
    while (list.length < BAND_SEARCH.openings) {
      const g = rng.weighted(genresIn(year()).filter((x) => x.band), (x) => popularIn(x.id, countryId));
      const position = rng.pick(g.lineup);
      const bar = rng.pick([35, 45, 55, 65, 75]);
      const crew = pool.filter((n) => !n.flags.star.bandOpening).sort(() => rng.next() - 0.5).slice(0, Math.min(g.lineup.length - 1, rng.int(2, 3)));
      for (const n of crew) n.flags.star.bandOpening = true;
      list.push({ id: nextId('open'), actId: null, name: actName(), genre: g.id, position, bar, fans: Math.round(bar ** 2 / 10 * rng.around(1, 0.4)), labelId: null, crew: crew.map((n) => n.id), status: 'open' });
    }
    E.openings[key] = list;
  }
  return E.openings[key];
}

/** Auditions for a band's opening, playing the position. Three auditions a year. */
export function auditionForBand(openingId) {
  const p = player();
  const o = openings(p.countryId).find((x) => x.id === openingId);
  if (!o || o.status !== 'open') return result(false, 'That place has been filled.', 'neutral');
  if (myAct(p)) return result(false, `You are already in ${myAct(p).name}.`, 'neutral');
  const S2 = searchOf(p);
  if (S2.auditions >= BAND_SEARCH.auditions) return result(false, 'You have auditioned as often as you can this year.', 'neutral');
  S2.auditions += 1;
  const skill = positionSkill(o.position, p);
  const odds = clamp(0.4 + (skill - o.bar) / 25 + (p.stats.charm - 50) / 300, 0.03, 0.92);
  if (!rng.chance(odds)) {
    o.status = 'lost';
    return result(false, skill < o.bar - 10 ? `They let you finish the song. They are looking for a ${posLow(o.position)} who is further along.` : `It was close. They went with someone they already knew.`);
  }
  o.status = 'joined';
  const E = M();
  let a = o.actId ? act(o.actId) : null;
  if (!a) {
    a = { id: nextId('act'), name: o.name, genre: o.genre, kind: 'band', countryId: p.countryId, formed: year() - rng.int(0, 2), members: [], status: 'active', fans: { [p.countryId]: o.fans }, deal: null, releases: [], tours: [], history: [{ year: year(), text: `${o.name} was formed.` }], npc: false };
    const open = [...GENRE_BY_ID[o.genre].lineup];
    open.splice(open.indexOf(o.position), 1);
    for (const id of o.crew ?? []) {
      const n = store.state.npcs[id];
      if (!n) continue;
      const theirs = Object.keys(n.flags.star.plays ?? {});
      const role = theirs.find((k) => open.includes(k)) ?? open[0] ?? theirs[0];
      if (open.includes(role)) open.splice(open.indexOf(role), 1);
      n.flags.star.plays[role] ??= Math.round(o.bar + rng.int(-5, 5));
      a.members.push({ who: id, role, from: year(), to: null });
    }
    E.acts[a.id] = a;
  }
  else {
    // An established band is more than its singer: the rest of the line-up are real people too.
    const open = [...genreOf(a.genre).lineup];
    for (const m of members(a)) if (open.includes(m.role)) open.splice(open.indexOf(m.role), 1);
    open.splice(open.indexOf(o.position) >= 0 ? open.indexOf(o.position) : open.length, 1);
    for (const role of open.slice(0, 4)) { const n = musician(p.countryId, { position: role, level: o.bar + 4 }); a.members.push({ who: n.id, role, from: Math.max(a.formed, year() - rng.int(0, 6)), to: null }); }
  }
  a.npc = false;
  a.members.push({ who: 'player', role: o.position, from: year(), to: null });
  for (const m of members(a)) if (m.who !== 'player') bringIn(store.state.npcs[m.who], a);
  musicOf(p).acts.push(a.id);
  if (a.labelId && !a.deal) a.deal = { labelId: a.labelId, royalty: 0.16, albumsOwed: 2, advance: 0, unrecouped: 0, signed: year(), advancePaid: true };
  a.history.push({ year: year(), text: `${p.firstName} ${p.lastName} joined as ${posLow(o.position)}.` });
  milestone(`Joined ${a.name} as their ${posLow(o.position)}.`, 'fame');
  return result(true, `You are the new ${posLow(o.position)} in ${a.name}, a ${genreOf(a.genre).name.toLowerCase()} band${a.labelId ? ` signed to ${ent().orgs[a.labelId]?.name}` : ''}.`);
}

/** Your band puts up a notice for a position: three musicians answer it, and you choose. Once a year per position. */
export function advertise(position) {
  const p = player();
  const a = myAct(p);
  if (!a || a.kind !== 'band') return result(false, 'You need a band first.', 'neutral');
  if (!POSITIONS[position]) return result(false, 'Not a place in a band.', 'neutral');
  if (members(a).length >= 7) return result(false, 'The band is big enough.', 'neutral');
  const S2 = searchOf(p);
  if (S2.ads[position]) return { ...result(true, 'Your notice is already up.', 'neutral'), candidates: S2.ads[position].map((id) => store.state.npcs[id]).filter(Boolean) };
  const level = clamp(actPerf(a) + Math.log10(fanTotal(a) + 1) * 3 - 5, 30, 90);
  const found = musicians(p.countryId).filter((n) => (n.flags.star.plays?.[position] ?? 0) > 0 && !a.members.some((m) => m.who === n.id));
  while (found.length < 3) { const n = musician(p.countryId, { position, level }); M().musicians[p.countryId].push(n.id); found.push(n); }
  S2.ads[position] = found.sort(() => rng.next() - 0.5).slice(0, 3).map((n) => n.id);
  return { ...result(true, `Three ${posLow(position)}s answer the notice.`, 'neutral'), candidates: S2.ads[position].map((id) => store.state.npcs[id]) };
}

/** Takes on one of the musicians who answered, in the position advertised. */
export function hireMember(npcId, position) {
  const a = myAct();
  if (!a) return result(false, 'You need a band first.', 'neutral');
  const n = store.state.npcs[npcId];
  if (!n?.alive || !(searchOf().ads[position] ?? []).includes(npcId)) return result(false, 'They are not available.', 'neutral');
  n.flags.star.plays ??= {};
  n.flags.star.plays[position] ??= npcPerf(n);
  a.members.push({ who: n.id, role: position, from: year(), to: null });
  bringIn(n, a);
  searchOf().ads[position] = [];
  a.history.push({ year: year(), text: `${n.firstName} ${n.lastName} joined as ${posLow(position)}.` });
  return result(true, `${n.firstName} ${n.lastName} is your new ${posLow(position)}.`);
}

/** Sends a demo to a label. Twice a year. They listen for the songs, the band, the following and their own sound. */
export function sendDemo(labelId) {
  const p = player();
  const a = myAct(p);
  if (!a || a.status !== 'active') return result(false, 'You need an active act.', 'neutral');
  if (a.deal) return result(false, `${a.name} is already signed.`, 'neutral');
  const l = labels(p.countryId).find((x) => x.id === labelId);
  if (!l) return result(false, 'That label is not taking demos.', 'neutral');
  const S2 = searchOf(p);
  if (S2.demos >= BAND_SEARCH.demos) return result(false, 'You have sent two demos this year. Labels need time to listen.', 'neutral');
  S2.demos += 1;
  const songs = musicOf(p).songs.sort((x, y) => y.q - x.q).slice(0, 3);
  const songQ = songs.length ? songs.reduce((s2, x) => s2 + x.q, 0) / songs.length : 30;
  const fits = !l.sound || l.sound.includes(genreOf(a.genre).id);
  const score = songQ * 0.45 + actPerf(a) * 0.25 + genreFit(a) * 0.15 + Math.log10(fanTotal(a) + 1) * 4 + (fits ? 6 : -15) - (l.tier === 'major' ? 18 : 0) + (managerOf(p)?.clout ?? 0) * 6;
  if (!rng.chance(clamp((score - 45) / 25, 0.02, 0.85))) return result(false, !fits ? `${l.name} sends it back: "Not our sound."` : rng.pick(['No reply.', `${l.name} passes, politely.`, '"Keep us posted." Which means no.']));
  offerFrom(a, l);
  return result(true, `${l.name} wants to sign ${a.name}.`);
}

/** A label's offer, on that label's own terms. */
function offerFrom(a, l) {
  const c = COUNTRIES[a.countryId];
  const t = l.terms ?? LABEL_KINDS[l.tier];
  const fans = fanTotal(a);
  const mg = a.members.some((m) => m.who === 'player' && m.to == null) ? managerOf() : null;
  a.offer = { labelId: l.id, advance: Math.round(localWage(Math.min(400000, 3000 + fans * 0.9) * (t.advance ?? 1) * (1 + (mg?.clout ?? 0) * 0.25), c)), royalty: Math.round((t.royalty[0] + rng.next() * (t.royalty[1] - t.royalty[0])) * 100) / 100,
    albums: rng.int(t.albums[0], t.albums[1]), year: year(), asked: false, lawyer: false };
  a.history.push({ year: year(), text: `${l.name} offered a record deal.` });
}

// ---------- Acts ----------

const actName = () => (rng.chance(0.5) ? `The ${rng.pick(BAND_WORDS.a)} ${rng.pick(BAND_WORDS.b)}` : `${rng.pick(BAND_WORDS.a)} ${rng.pick(BAND_WORDS.b)}`);

/** Starts a solo career, or a band with chosen musicians. */
export function formAct(kind, o = {}) {
  const p = player();
  const f = musicOf(p);
  if (!exists('concert')) return result(false, 'There is no way to make a living from music here yet.', 'neutral');
  if (p.age < 12) return result(false, 'You are too young to form an act.', 'neutral');
  if (myAct(p)) return result(false, `You are already in ${myAct(p).name}.`, 'neutral');
  const E = M();
  const genre = genreOf(o.genre ?? rng.pick(genresIn(year())).id).id;
  const mine = kind === 'solo' ? 'solo' : POSITIONS[o.position] ? o.position : bestPositions(p, 1)[0].pos;
  const a = { id: nextId('act'), name: kind === 'solo' ? `${p.firstName} ${p.lastName}` : (o.name || actName()).slice(0, 40), genre, kind, countryId: p.countryId,
    formed: year(), members: [{ who: 'player', role: mine, from: year(), to: null }], status: 'active', fans: { [p.countryId]: 20 }, deal: null, releases: [], tours: [], history: [], npc: false };
  // Each musician takes the place in the line-up they play best that is still open.
  const open = [...GENRE_BY_ID[genre].lineup];
  open.splice(open.indexOf(mine) >= 0 ? open.indexOf(mine) : open.length, 1);
  for (const id of o.with ?? []) {
    const n = store.state.npcs[id];
    const theirs = Object.entries(n?.flags.star?.plays ?? {}).sort((x, y) => y[1] - x[1]).map(([k]) => k);
    const role = theirs.find((k) => open.includes(k)) ?? theirs[0] ?? 'rhythm_guitar';
    if (open.includes(role)) open.splice(open.indexOf(role), 1);
    a.members.push({ who: id, role, from: year(), to: null });
  }
  for (const m of a.members) if (m.who !== 'player') bringIn(store.state.npcs[m.who], a);
  E.acts[a.id] = a;
  f.acts.push(a.id);
  a.history.push({ year: year(), text: kind === 'solo' ? `${a.name} began performing.` : `${a.name} was formed.` });
  milestone(kind === 'solo' ? 'Started performing your own music.' : `Formed a band: ${a.name}.`, 'fame');
  return result(true, kind === 'solo' ? 'You start performing as yourself. A notebook of songs, a few open-mic nights, and a long road.' : `${a.name} is a band. You rehearse in someone's garage, too loudly.`);
}

function bringIn(n, a) {
  const p = player();
  if (!n) return;
  if (!p.npcIds.includes(n.id)) { n.role = 'colleague'; p.npcIds.push(n.id); }
  n.flags.title = `In ${a.name} with you`;
  n.flags.workedWith = a.name;
  n.age = year() - (n.flags.star?.born ?? year() - n.age);
  n.lastInteractionAge = p.age;
}

/** Takes on a new member (from the musicians looking for a band). */
export function addMember(npcId) {
  const a = myAct();
  if (!a || a.kind !== 'band') return result(false, 'You need a band first.', 'neutral');
  if (members(a).length >= 6) return result(false, 'The band is big enough.', 'neutral');
  const n = store.state.npcs[npcId];
  if (!n?.alive) return result(false, 'They are not available.', 'neutral');
  const role = Object.entries(n.flags.star?.plays ?? {}).sort((x, y) => y[1] - x[1])[0]?.[0] ?? 'rhythm_guitar';
  a.members.push({ who: n.id, role, from: year(), to: null });
  bringIn(n, a);
  a.history.push({ year: year(), text: `${n.firstName} ${n.lastName} joined.` });
  return result(true, `${n.firstName} ${n.lastName} joins ${a.name}.`);
}

/** Leaves the act. Its history, members and releases are kept; a band carries on without you if enough of it is left. */
export function leaveAct() {
  const a = myAct();
  if (!a) return result(false, 'You are not in an act.', 'neutral');
  const me = a.members.find((m) => m.who === 'player' && m.to == null);
  me.to = year();
  const left = members(a).filter((m) => m.who !== 'player');
  if (a.kind === 'solo' || left.length < 2) { a.status = 'split'; a.history.push({ year: year(), text: a.kind === 'solo' ? 'Stopped performing.' : `${a.name} split up.` }); }
  else { a.history.push({ year: year(), text: 'You left the band.' }); a.npc = true; }
  return result(true, a.status === 'split' ? `${a.name} is over. The records are still the records.` : `You leave ${a.name}. They carry on without you.`, 'neutral');
}

export function hiatus(on) {
  const a = myAct();
  if (!a) return result(false, 'You are not in an act.', 'neutral');
  a.status = on ? 'hiatus' : 'active';
  a.history.push({ year: year(), text: on ? 'Went on hiatus.' : 'Came back from hiatus.' });
  return result(true, on ? `${a.name} takes a break. Nobody says how long for.` : `${a.name} is back.`, 'neutral');
}

/** Gets an old band back together, if enough of them are alive and willing. */
export function reunite(actId) {
  const p = player();
  const a = act(actId);
  if (!a || a.status !== 'split' || !musicOf(p).acts.includes(actId)) return result(false, 'There is nothing to reunite.', 'neutral');
  if (myAct(p)) return result(false, 'Leave your current act first.', 'neutral');
  const old = [...new Set(a.members.filter((m) => m.who !== 'player').map((m) => m.who))].map((id) => store.state.npcs[id]).filter((n) => n?.alive);
  const willing = old.filter((n) => rng.chance(clamp(0.3 + (n.meters.relationship - 50) / 80, 0.05, 0.9)));
  if (a.kind === 'band' && willing.length < 1) return result(false, 'You ring round. Nobody is interested.');
  a.status = 'active';
  const was = (who) => [...a.members].reverse().find((m) => m.who === who)?.role ?? 'vocals';
  a.members.push({ who: 'player', role: a.kind === 'solo' ? 'solo' : was('player'), from: year(), to: null });
  for (const n of willing) a.members.push({ who: n.id, role: was(n.id), from: year(), to: null });
  a.history.push({ year: year(), text: `${a.name} got back together.` });
  milestone(`${a.name} reunited.`, 'fame');
  return result(true, `${a.name} is back${willing.length ? `, with ${willing.map((n) => n.firstName).join(' and ')}` : ''}.`);
}

// ---------- Songs and releases ----------

/** Writes a song. Two a year at most: songs take time. */
export function writeSong() {
  const p = player();
  const f = musicOf(p);
  if (p.age < 12) return result(false, 'You are a little young to be writing songs to sell.', 'neutral');
  if (f.musicActs.writes >= 2) return result(false, 'You have written what you have in you this year.', 'neutral');
  f.musicActs.writes += 1;
  const q = Math.round(clamp(songwriting(p) + rng.around(0, 14)));
  f.songs.push({ q, written: year() });
  p.talents.music = clamp(p.talents.music + 0.5);
  return result(true, q >= 80 ? 'You write something you know is good the moment it is finished.' : q >= 55 ? 'A solid song. It will find its place.' : 'A song. Not every song is a good one.');
}

const songTitle = () => `${rng.pick(SONG_WORDS.a)} ${rng.pick(SONG_WORDS.b)}`;
/** A title the act has not used before. */
function freshTitle(a, long) {
  const used = new Set(a.releases.map((id) => release(id)?.title));
  for (let i = 0; i < 40; i++) { const t = long && rng.chance(0.5) ? `${songTitle()} and Other Songs` : songTitle(); if (!used.has(t)) return t; }
  return `${songTitle()} (${year()})`;
}

/** Records and puts out a release from the best songs the player has. It comes out at the turn of the year. */
/** A music video its artist dances in: the dance it takes, what it does for sales (a plain video: 1.25). */
export const MUSIC_VIDEO_DANCE = { skill: 65, sales: 1.4 };

export function record(type, o = {}) {
  const p = player();
  const f = musicOf(p);
  const a = myAct(p);
  const t = RELEASE_TYPES[type];
  if (!a || a.status !== 'active') return result(false, 'You need an active act.', 'neutral');
  if (!exists('recording')) return result(false, 'Music cannot be recorded yet.', 'neutral');
  if (f.songs.length < t.songs) return result(false, `${{ single: 'A single', ep: 'An EP', album: 'An album' }[type]} needs ${t.songs} ${t.songs === 1 ? 'song' : 'songs'}; you have ${f.songs.length} ready.`, 'neutral');
  if (Object.values(M().releases).some((r) => r.actId === a.id && r.made === year())) return result(false, 'You are already recording this year.', 'neutral');
  const label = a.deal ? ent().orgs[a.deal.labelId] : null;
  const video = !!o.video && exists('music_video');
  const cost = label ? 0 : K(t.cost) + (video ? K({ single: 3000, ep: 4000, album: 6000 }[type]) : 0);
  if (p.finance.cash < cost) return result(false, `Recording it yourself costs ${fmtMoney(cost, country())}.`, 'neutral');
  p.finance.cash -= cost;
  const songs = f.songs.sort((x, y) => y.q - x.q).splice(0, t.songs);
  const quality = Math.round(songs.reduce((s, x) => s + x.q, 0) / songs.length * 0.55 + actPerf(a) * 0.3 + genreFit(a) * 0.15);
  const r = { id: nextId('rel'), title: freshTitle(a, type !== 'single'), actId: a.id, type, songs: t.songs, quality,
    made: year(), released: null, labelId: label?.id ?? null, units: {}, critics: null, chart: null, revenue: [], paid: [], first: !a.releases.length, share: 1 / Math.max(1, members(a).length), video,
    // A musician who can really dance carries the video themselves, to their own choreography (MUSIC_VIDEO_DANCE).
    danced: video && p.talents.dance >= MUSIC_VIDEO_DANCE.skill };
  M().releases[r.id] = r;
  a.releases.push(r.id);
  return result(true, `You record ${r.title}${video ? `, and shoot a video for it${r.danced ? ': you choreograph it yourself, and dance it in one take' : ''}` : ''}. ${label ? `${label.name} will put it out.` : 'You put it out yourself.'} It comes out at the turn of the year.`);
}

const SONGWRITER_SHARE = 0.08;

/** Offers your best unused song to another act. If they take it, they record it, and you are paid as its writer. */
export function pitchSong() {
  const p = player();
  const f = musicOf(p);
  if (!f.songs.length) return result(false, 'You have no songs to offer.', 'neutral');
  if (f.musicActs.pitched) return result(false, 'You have sent songs out this year already.', 'neutral');
  f.musicActs.pitched = true;
  rivals(p.countryId);
  const song = f.songs.sort((x, y) => y.q - x.q)[0];
  const takers = Object.values(M().acts).filter((a) => a.npc && a.countryId === p.countryId && a.status === 'active' && !members(a).some((m) => m.who === 'player'));
  const a = takers.sort(() => rng.next() - 0.5).find((x) => rng.chance(clamp((song.q - npcPerf(store.state.npcs[members(x)[0]?.who]) + 15) / 40, 0.03, 0.85)));
  if (!a) return result(false, 'Nobody bites. A few say to keep sending them things.');
  f.songs.splice(f.songs.indexOf(song), 1);
  const fee = K(500 + song.q * 15);
  p.finance.cash += fee;
  p.finance.lifetimeEarned += fee;
  const lead = store.state.npcs[members(a)[0]?.who];
  const r = { id: nextId('rel'), title: freshTitle(a, false), actId: a.id, type: 'single', songs: 1, quality: Math.round((song.q + npcPerf(lead)) / 2), made: year(), released: null,
    labelId: a.deal?.labelId ?? null, units: {}, critics: null, chart: null, revenue: [], paid: [], first: !a.releases.length, share: 1, writer: 'player' };
  M().releases[r.id] = r;
  a.releases.push(r.id);
  (f.songCredits ??= []).push({ releaseId: r.id, actId: a.id, title: r.title, year: year(), revenue: [], paid: [] });
  milestone(`Sold a song to ${a.name}.`, 'career');
  return result(true, `${a.name} want your song. They will record it as ${r.title}; you get ${fmtMoney(fee, country())} now, and a writer's share of whatever it earns.`);
}

/** Session work: playing on other people's records, for a fee. Good practice, and you meet people. */
export function session() {
  const p = player();
  const f = musicOf(p);
  if (performing(p) < 55) return result(false, 'Session players are hired for how well they play. You are not there yet.', 'neutral');
  if ((f.musicActs.sessions ?? 0) >= 3) return result(false, 'You have done all the sessions you can fit in this year.', 'neutral');
  f.musicActs.sessions = (f.musicActs.sessions ?? 0) + 1;
  const pay = K(300 + performing(p) * 8);
  p.finance.cash += pay;
  p.finance.lifetimeEarned += pay;
  p.talents.music = clamp(p.talents.music + 0.5);
  const n = rng.pick(musicians(p.countryId));
  if (n && !p.npcIds.includes(n.id) && rng.chance(0.4)) { p.npcIds.push(n.id); n.role = 'colleague'; n.flags.title = 'A musician you did a session with'; n.lastInteractionAge = p.age; }
  // The record is someone's: the player's name goes in its credits, on the act's next release.
  rivals(p.countryId);
  const pos = Object.keys(POSITIONS).filter((k) => k !== 'producer').sort((x, y) => positionSkill(y, p) - positionSkill(x, p))[0];
  const acts = Object.values(M().acts).filter((a) => a.npc && a.status === 'active' && a.countryId === p.countryId && !members(a).some((m) => m.who === 'player'));
  const who = acts.length ? rng.pick(acts) : null;
  if (who) {
    const due = who.releases.map(release).find((r) => r && r.released == null);
    const credit = { actId: who.id, position: pos, year: year(), releaseId: due?.id ?? null };
    if (due) ((due.credits ??= {}).session ??= []).push({ who: 'player', position: pos });
    (f.sessionCredits ??= []).push(credit);
    return result(true, `A day in the studio playing ${posLow(pos)} on ${who.name}'s next record. ${fmtMoney(pay, country())}, and your name in the credits.`);
  }
  return result(true, `A day in the studio playing on someone else's record. ${fmtMoney(pay, country())}.`);
}

/** A gig in town: a little money, a few more people who know the songs. */
export function gig() {
  const p = player();
  const f = musicOf(p);
  const a = myAct(p);
  if (!a || a.status !== 'active') return result(false, 'You need an active act.', 'neutral');
  if (f.musicActs.gigs >= 4) return result(false, 'You have played what you can around your other commitments this year.', 'neutral');
  f.musicActs.gigs += 1;
  const venue = fanTotal(a) >= VENUES.club.fans ? VENUES.club : VENUES.bar;
  const crowd = Math.round(Math.min(venue.capacity, 15 + (a.fans[p.countryId] ?? 0) * 0.04 + rng.int(0, 40)));
  const good = rng.chance(clamp(0.4 + (actPerf(a) - 50) / 80, 0.1, 0.95));
  const pay = Math.round(K(venue.price * crowd * 0.5) * (a.kind === 'band' ? 1 / members(a).length : 1));
  p.finance.cash += pay;
  p.finance.lifetimeEarned += pay;
  a.fans[p.countryId] = Math.round((a.fans[p.countryId] ?? 0) + crowd * (good ? 0.3 : 0.08));
  gain({ audience: 'music', amount: good ? 0.5 : 0.1, why: 'a gig' }, p);
  return result(good, good ? `You play to ${crowd} people, and they want an encore. Your share: ${fmtMoney(pay, country())}.` : `${crowd} people, most of them talking. Your share: ${fmtMoney(pay, country())}.`);
}

// ---------- Tours ----------

/** Where an act could tour, at a scale: places with enough fans. */
export function tourPlaces(a, scale) {
  const v = VENUES[scale];
  return Object.entries(a.fans).filter(([, n]) => n >= v.fans * 0.25).map(([cc]) => cc).filter((cc) => COUNTRIES[cc]);
}

/** Plans a tour for this year. It takes weeks, and cannot clash with other work. */
export function planTour(scale, countries) {
  const p = player();
  const a = myAct(p);
  const v = VENUES[scale];
  if (!a || a.status !== 'active') return result(false, 'You need an active act.', 'neutral');
  if (fanTotal(a) < v.fans) return result(false, `${v.name} need about ${v.fans.toLocaleString('en-US')} fans; you have ${fanTotal(a).toLocaleString('en-US')}.`, 'neutral');
  if (Object.values(M().tours).some((t) => t.actId === a.id && t.year === year())) return result(false, 'You are already touring this year.', 'neutral');
  const busy = commitments(year(), p).filter((x) => ['stage', 'musical', 'tv'].includes(x.kind));
  if (busy.length) return result(false, `You are committed to ${busy[0].title} this year.`, 'neutral');
  const places = (countries?.length ? countries : [p.countryId]).filter((c) => tourPlaces(a, scale).includes(c) || c === p.countryId).slice(0, 6);
  // Dates run one after another, city to city: never two shows on one night in two places.
  const dates = places.flatMap((cc) => COUNTRIES[cc].cities.slice(0, cc === p.countryId ? 5 : 2).map((city) => ({ countryId: cc, city, capacity: v.capacity, sold: null, gross: null })));
  const t = { id: nextId('tour'), actId: a.id, title: `${a.name}: ${rng.pick(SONG_WORDS.a)} ${rng.pick(SONG_WORDS.b)} Tour`, scale, year: year(), dates, cost: null, net: null, weeks: Math.ceil(dates.length / 3), status: 'booked', paid: [] };
  M().tours[t.id] = t;
  a.tours.push(t.id);
  return result(true, `${t.title}: ${dates.length} dates in ${[...new Set(dates.map((d) => d.countryId))].map((c) => COUNTRIES[c].name).join(', ')}, over about ${t.weeks} weeks. The shows happen this year; the takings are counted at the end of it.`);
}

/** Weeks of the year the player's tours take. */
export const tourWeeks = (y = year(), p = player()) => Object.values(M().tours).filter((t) => t.year === y && musicOf(p).acts.includes(t.actId) && members(act(t.actId), y).some((m) => m.who === 'player')).reduce((s, t) => s + t.weeks, 0);

function runTour(t) {
  const a = act(t.actId);
  const v = VENUES[t.scale];
  let gross = 0;
  for (const d of t.dates) {
    const here = a.fans[d.countryId] ?? 0;
    const perCity = here / Math.max(1, t.dates.filter((x) => x.countryId === d.countryId).length);
    const mine = a.members.some((m) => m.who === 'player' && m.to == null);
    const want = (perCity * (0.08 + rng.next() * 0.1) + rng.int(0, 60)) * (mine ? 1 + (managerOf()?.clout ?? 0) * 0.12 : 1); // a manager gets the shows promoted
    d.sold = Math.round(Math.min(d.capacity, want));
    d.gross = Math.round(wageIn(v.price, COUNTRIES[d.countryId], COUNTRIES[a.countryId]) * d.sold); // in the act's own money
    gross += Math.round(d.gross * (COUNTRIES[t.dates[0].countryId] === COUNTRIES[d.countryId] ? 1 : 1));
    a.fans[d.countryId] = Math.round(here + d.sold * 0.35);
  }
  const homeC = COUNTRIES[a.countryId];
  t.cost = Math.round(localWage(v.cost, homeC) * t.dates.length);
  t.gross = gross;
  t.net = gross - t.cost;
  t.status = 'done';
  return t;
}

// ---------- Record deals ----------

/** Offers from labels, made once a year for an act people are listening to. */
function maybeDealOffer(a) {
  if (a.deal || a.npc || a.status !== 'active') return;
  const fans = fanTotal(a);
  const mc = managerOf()?.clout ?? 0; // a manager brings labels to the act
  if (fans < 2500 / (1 + mc) || !rng.chance(clamp(fans / 60000 * (1 + mc * 0.6), 0.05, 0.75))) return;
  const ls = labels(a.countryId);
  const g = genreOf(a.genre).id;
  const l = fans > 40000 ? ls.find((x) => x.tier === 'major') : rng.pick(ls.filter((x) => x.tier === 'major' || x.sound?.includes(g)).concat(ls[0]));
  offerFrom(a, l);
}

/** A lawyer reads the offer: what it means, and whether it is ordinary. */
export function lawyer() {
  const p = player();
  const a = myAct(p);
  if (!a?.offer) return result(false, 'There is no offer to read.', 'neutral');
  const fee = K(1200);
  if (p.finance.cash < fee) return result(false, `A lawyer would cost ${fmtMoney(fee, country())}.`, 'neutral');
  p.finance.cash -= fee;
  a.offer.lawyer = true;
  const o = a.offer;
  const fair = o.royalty >= 0.18 ? 'better than most' : o.royalty >= 0.16 ? 'ordinary' : 'on the low side';
  return result(true, `The lawyer reads it for ${fmtMoney(fee, country())}: ${Math.round(o.royalty * 100)}% royalties, which is ${fair}; ${o.albums} albums owed; the label owns the recordings. The ${fmtMoney(o.advance, COUNTRIES[a.countryId])} advance is paid back out of your royalties before you see any more.`, 'neutral');
}

export function negotiateDeal() {
  const a = myAct();
  if (!a?.offer || a.offer.asked) return result(false, a?.offer ? 'You have already asked.' : 'There is no offer.', 'neutral');
  a.offer.asked = true;
  if (rng.chance(0.08)) { a.offer = null; return result(false, 'The label lost interest.'); }
  if (!rng.chance(a.offer.lawyer ? 0.6 : 0.35)) return result(false, '"Those are our terms."', 'neutral');
  a.offer.royalty = Math.round((a.offer.royalty + 0.02) * 100) / 100;
  return result(true, `They move to ${Math.round(a.offer.royalty * 100)}% royalties.`);
}

export function signDeal() {
  const p = player();
  const a = myAct(p);
  if (!a?.offer) return result(false, 'There is no offer.', 'neutral');
  const o = a.offer;
  a.deal = { labelId: o.labelId, royalty: o.royalty, albumsOwed: o.albums, advance: o.advance, unrecouped: o.advance, signed: year(), advancePaid: false };
  a.labelId = o.labelId;
  a.offer = null;
  const l = ent().orgs[o.labelId];
  a.history.push({ year: year(), text: `Signed to ${l.name}.` });
  milestone(`Signed a record deal with ${l.name}.`, 'fame');
  return result(true, `${a.name} is signed to ${l.name}. The advance is paid with this year's income; your royalties pay it back first.`);
}
export function declineDeal() { const a = myAct(); if (a) a.offer = null; return result(true, 'You stay independent.', 'neutral'); }

// ---------- Pay ----------

/** The player's share of everything their acts earned in the year just lived, once each. */
export function musicLines(p = player()) {
  const lived = year() - 1;
  const out = [];
  for (const c of p.fame?.songCredits ?? []) { const e = (c.revenue ?? []).find((x) => x.year === lived); if (e?.amount > 0 && !(c.paid ?? []).includes(lived)) out.push({ source: `songw:${c.releaseId}:${lived}`, label: `Songwriting: ${c.title}`, gross: e.amount }); }
  for (const id of musicOf(p).acts) {
    const a = act(id);
    if (!a) continue;
    const mine = (y) => a.members.some((m) => m.who === 'player' && m.from <= y && (m.to == null || m.to >= y));
    // The advance, once.
    if (a.deal && !a.deal.advancePaid && a.deal.signed === lived && mine(lived)) out.push({ source: `adv:${a.id}`, label: `Advance from ${ent().orgs[a.deal.labelId]?.name}`, gross: Math.round(a.deal.advance / Math.max(1, members(a, lived).length)), act: a.id, kind: 'advance' });
    // Royalties: each release's share of what it earned that year, after the advance is paid back.
    for (const rid of a.releases) {
      const r = release(rid);
      const e = r?.revenue.find((x) => x.year === lived);
      if (!e || !e.toAct || r.paid.includes(lived) || !mine(r.made)) continue;
      out.push({ source: `roy:${r.id}:${lived}`, label: `Royalties: ${r.title}`, gross: Math.round(e.toAct * r.share), release: r.id, year: lived });
    }
    for (const tid of a.tours) {
      const t = tour(tid);
      if (!t || t.year !== lived || t.paid.includes(lived) || !mine(lived) || t.net <= 0) continue;
      out.push({ source: `tour:${t.id}`, label: `${t.title}`, gross: Math.round(t.net / Math.max(1, members(a, lived).length)), tour: t.id });
    }
  }
  // A manager takes their cut of the act's money (not of songs written for others).
  const mg = managerOf(p);
  if (mg) for (const l of out) if (/^(adv|roy|tour):/.test(l.source)) { l.gross = Math.round(l.gross * (1 - mg.commission)); l.label += ` (after your manager's ${Math.round(mg.commission * 100)}%)`; }
  return out;
}
export function markMusicPaid(p = player()) {
  const lived = year() - 1;
  for (const c of p.fame?.songCredits ?? []) if ((c.revenue ?? []).some((x) => x.year === lived) && !(c.paid ??= []).includes(lived)) c.paid.push(lived);
  for (const id of musicOf(p).acts) {
    const a = act(id);
    if (!a) continue;
    if (a.deal && a.deal.signed === lived) a.deal.advancePaid = true;
    for (const rid of a.releases) { const r = release(rid); if (r && r.revenue.some((x) => x.year === lived) && !r.paid.includes(lived)) r.paid.push(lived); }
    for (const tid of a.tours) { const t = tour(tid); if (t && t.year === lived && !t.paid.includes(lived)) t.paid.push(lived); }
  }
}

// ---------- The year ----------

/** A release comes out: judged once, charted once, earning from then on. */
function releaseNow(r) {
  const a = act(r.actId);
  const label = ent().orgs[r.labelId];
  r.released = year();
  r.critics = Math.round(clamp(r.quality + rng.around(0, 10)));
  const fans = fanTotal(a);
  const push = label ? (label.tier === 'major' ? 2.2 : 1.4) : 1;
  const typeK = { single: 0.6, ep: 0.8, album: 1 }[r.type];
  const g = genreOf(a.genre);
  // Majors take records abroad; a genre's own heartlands come first.
  const reach = label?.tier === 'major' ? [...new Set([...g.strong.filter((c) => COUNTRIES[c] && c !== a.countryId), ...Object.keys(COUNTRIES).filter((c) => c !== a.countryId).sort(() => rng.next() - 0.5)])].slice(0, rng.int(2, 8)) : [];
  const home = Math.round((fans * (0.2 + r.quality / 200) + Math.max(0, r.quality - 35) ** 2 * 2.5 * push) * typeK * (r.video ? (r.danced ? MUSIC_VIDEO_DANCE.sales : 1.25) : 1) * popularIn(g.id, a.countryId) * rng.around(1, 0.3)); // a video reaches people radio does not
  r.units = { [a.countryId]: home };
  for (const c of reach) r.units[c] = Math.round(home * (0.05 + rng.next() * 0.2) * (r.quality / 80) * popularIn(g.id, c) / popularIn(g.id, a.countryId));
  for (const [c, n] of Object.entries(r.units)) a.fans[c] = Math.round((a.fans[c] ?? 0) + n * 0.35);
  return reach;
}

/** What each release earns this year; most of it in the first, then less each year. */
function earn(r) {
  const a = act(r.actId);
  const age = year() - r.released;
  const total = Object.entries(r.units).reduce((s, [c, n]) => s + wageIn(MUSIC_DEAL.unitValue, COUNTRIES[c], COUNTRIES[a.countryId]) * n, 0);
  const gross = Math.round(total * (age === 0 ? 1 : 0.35 * Math.pow(0.6, age - 1)));
  if (gross < localWage(20, COUNTRIES[a.countryId]) && age > 0) return; // the catalog's tail, too small to count
  let toAct = r.labelId ? Math.round(gross * (a.deal?.royalty ?? 0.16)) : Math.round(gross * MUSIC_DEAL.independent);
  if (r.labelId && a.deal && a.deal.unrecouped > 0) { const back = Math.min(a.deal.unrecouped, toAct); a.deal.unrecouped -= back; toAct -= back; }
  r.revenue.push({ year: year() - 1, gross, toAct });
}

function charts(countryId) {
  const out = Object.values(M().releases).filter((r) => r.released === year() && act(r.actId)?.countryId === countryId).sort((x, y) => (y.units[countryId] ?? 0) - (x.units[countryId] ?? 0));
  out.forEach((r, i) => { if (i < 40) r.chart = i + 1; });
}

/** Rival acts make records too: a crowded field, a few of them very good and very popular. */
function rivals(countryId) {
  const E = M();
  const theirs = Object.values(E.acts).filter((a) => a.npc && a.countryId === countryId && a.status === 'active' && !members(a).some((m) => m.who === 'player'));
  for (let i = theirs.filter((a) => !a.members.some((m) => m.who === 'player')).length; i < 24; i++) {
    const level = rng.pick([50, 58, 66, 74, 82, 90]);
    const lead = musician(countryId, { level });
    const solo = rng.chance(0.4);
    const g = rng.weighted(genresIn(year()), (x) => popularIn(x.id, countryId));
    const a = { id: nextId('act'), name: solo ? `${lead.firstName} ${lead.lastName}` : actName(), genre: g.id, kind: solo ? 'solo' : 'band', countryId, formed: year() - rng.int(0, 15),
      members: [{ who: lead.id, role: solo ? 'solo' : g.lineup[0], from: year(), to: null }], status: 'active', fans: { [countryId]: Math.round(10 ** rng.around(2.5 + level / 25, 0.6)) }, deal: null, releases: [], tours: [], history: [], npc: true };
    const fit = labels(countryId).filter((l) => l.tier === 'major' ? a.fans[countryId] > 20000 : (l.sound ?? []).includes(g.id));
    if (fit.length && rng.chance(0.7)) a.labelId = rng.pick(fit).id;
    E.acts[a.id] = a;
    theirs.push(a);
  }
  for (const a of theirs) {
    // Acts fade: a few stop each year, and new ones take their place next year.
    if (rng.chance(0.04)) { a.status = 'split'; continue; }
    if (!rng.chance(0.6)) continue;
    const type = rng.pick(['single', 'single', 'ep', 'album', 'album']);
    const lead = members(a).find((m) => m.who !== 'player');
    if (!lead) { a.status = 'split'; continue; }
    const q = Math.round(clamp(npcPerf(store.state.npcs[lead.who]) + rng.around(0, 10)));
    const big = fanTotal(a) > 50000;
    const r = { id: nextId('rel'), title: freshTitle(a, type !== 'single'), actId: a.id, type, songs: RELEASE_TYPES[type].songs, quality: q, made: year() - 1, released: null, labelId: a.labelId ?? (big ? labels(countryId)[0].id : null),
      units: {}, critics: null, chart: null, revenue: [], paid: [], first: !a.releases.length, share: 1 };
    E.releases[r.id] = r;
    a.releases.push(r.id);
    creditOnRelease(a, r);
  }
}

/**
 * The player's work on another act's record, written into its credits when the record is made: a session that was
 * waiting for the act's next record, and (on an EP or album) a song the player wrote for them, recorded again as an
 * album track. A song on an album earns its writer a share of the whole record, by its share of the songs.
 */
function creditOnRelease(a, r) {
  const p = player();
  const f = p.fame;
  if (!f) return;
  for (const c of f.sessionCredits ?? []) if (c.actId === a.id && !c.releaseId) { c.releaseId = r.id; ((r.credits ??= {}).session ??= []).push({ who: 'player', position: c.position }); }
  if (r.type === 'single') return;
  for (const c of p.fame.songCredits ?? []) {
    if (c.actId !== a.id || c.album || c.kind === 'album' || year() - c.year > 3 || !rng.chance(0.6)) continue;
    c.album = r.id;
    ((r.credits ??= {}).writers ??= []).push({ who: 'player', song: c.title });
    p.fame.songCredits.push({ releaseId: r.id, actId: a.id, title: r.title, year: year(), revenue: [], paid: [], kind: 'album', song: c.title, share: 1 / Math.max(1, r.songs) });
  }
}

/** Once a year, before payroll. @returns {string[]} */
export function tickMusic() {
  const p = player();
  const E = M();
  const lines = [];
  if (!exists('concert') || !((p.fame?.acts ?? []).length || (p.fame?.songCredits ?? []).length || (p.fame?.sessionCredits ?? []).length)) return lines; // the music world is made when the player first makes music
  rivals(p.countryId);
  // Releases recorded last year come out.
  for (const r of Object.values(E.releases)) {
    if (r.released != null || r.made >= year()) continue;
    const reach = releaseNow(r);
    const a = act(r.actId);
    const mine = musicOf(p).acts.includes(a.id) && a.members.some((m) => m.who === 'player' && m.from <= r.made);
    if (mine) {
      const units = Object.values(r.units).reduce((s, n) => s + n, 0);
      if (r.video) gain({ audience: exists('digital') ? 'digital' : 'tv', amount: Math.min(r.danced ? 11 : 8, Math.sqrt(units) / 25 * (r.danced ? 1.3 : 1)), reach: 0.3, lasting: 0.1, why: `the video for ${r.title}` }, p);
      gain({ audience: 'music', amount: Math.min(25, Math.sqrt(units) / 8) * (0.5 + r.critics / 100), abroad: Object.keys(r.units).filter((c) => c !== a.countryId), reach: 0.4, lasting: 0.25, why: r.title }, p);
      regard({ credibility: (r.critics - 60) / 10, why: r.title }, p);
      article({ kind: 'review', about: 'player', accuracy: 'verified', text: `${a.name}, ${r.title}: ${r.critics >= 75 ? 'a record that will last' : r.critics >= 55 ? 'well worth a listen' : r.critics >= 40 ? 'patchy' : 'a misstep'}.` });
      if (r.labelId && a.deal && r.type === 'album') a.deal.albumsOwed = Math.max(0, a.deal.albumsOwed - 1);
      lines.push(`${r.title} is out. ${r.critics >= 70 ? 'Critics love it' : r.critics >= 50 ? 'Critics are warm' : 'Critics are cool'}; ${units.toLocaleString('en-US')} people bought or streamed it in its first weeks${reach.length ? `, in ${reach.length + 1} countries` : ''}.`);
      if (r.first) milestone(`Released your first record: ${r.title}.`, 'fame');
    }
  }
  charts(p.countryId);
  for (const r of Object.values(E.releases)) {
    const a = act(r.actId);
    if (r.released != null && r.released <= year() && musicOf(p).acts.includes(r.actId)) earn(r); // only the player's acts' money is followed
    if (r.chart && r.released === year() && musicOf(p).acts.includes(a.id) && a.members.some((m) => m.who === 'player' && m.from <= r.made)) {
      lines.push(`${r.title} entered the chart at number ${r.chart}.`);
      if (!p.milestones.some((m) => /entered the chart/.test(m.text))) milestone(`${r.title} entered the chart at number ${r.chart}.`, 'fame');
    }
  }
  // Tours played last year are counted.
  for (const t of Object.values(E.tours)) {
    if (t.status !== 'booked' || t.year >= year()) continue;
    runTour(t);
    const a = act(t.actId);
    if (musicOf(p).acts.includes(a.id)) {
      const sold = t.dates.reduce((s, d) => s + d.sold, 0);
      lines.push(`${t.title}: ${t.dates.length} shows, ${sold.toLocaleString('en-US')} tickets sold, ${t.net >= 0 ? `${fmtMoney(t.net, COUNTRIES[a.countryId])} made` : `${fmtMoney(-t.net, COUNTRIES[a.countryId])} lost`} after costs.`);
      gain({ audience: 'music', amount: Math.min(12, Math.sqrt(sold) / 12), abroad: [...new Set(t.dates.map((d) => d.countryId))].filter((c) => c !== a.countryId), reach: 0.6, lasting: 0.15, why: t.title }, p);
      // A loss comes out of the members' pockets.
      if (t.net < 0) p.finance.cash += Math.round(t.net / Math.max(1, members(a, t.year).length));
      if (!p.milestones.some((m) => /tour/i.test(m.text))) milestone(`Toured: ${t.title}.`, 'fame');
    }
  }
  // Bands are people: some fall out, some leave.
  const a = myAct(p);
  if (a?.kind === 'band') {
    for (const m of members(a).filter((x) => x.who !== 'player')) {
      const n = store.state.npcs[m.who];
      if (!n?.alive) { m.to = year(); continue; }
      if (n.meters.relationship < 30 || rng.chance(0.04)) {
        m.to = year();
        a.history.push({ year: year(), text: `${n.firstName} ${n.lastName} left.` });
        lines.push(`${n.firstName} ${n.lastName} has left ${a.name}${n.meters.relationship < 30 ? ' after one argument too many' : ' to do something else'}.`);
      }
    }
    if (members(a).length < 2) { a.status = 'split'; a.history.push({ year: year(), text: `${a.name} split up.` }); lines.push(`${a.name} is finished. The records are still the records.`); }
  }
  if (a) maybeDealOffer(a);
  // A manager with nothing to manage moves on.
  const mg = managerOf(p);
  if (mg && mg.since <= year() - 2 && (!a || !a.releases.some((id) => (release(id)?.made ?? 0) >= year() - 3))) {
    lines.push(`${store.state.npcs[mg.npcId]?.firstName ?? 'Your manager'} has stopped managing you: nothing new in three years.`);
    dropManager();
  }
  // A deal ends when its albums are delivered.
  if (a?.deal && a.deal.albumsOwed <= 0) { a.history.push({ year: year(), text: `Finished the deal with ${ent().orgs[a.deal.labelId]?.name}.` }); a.deal = null; lines.push(`${a.name} has delivered every album the deal asked for, and is free.`); }
  // Old rival records are forgotten; the player's acts' are kept.
  const keep = new Set([...musicOf(p).acts.flatMap((id) => act(id)?.releases ?? []), ...(p.fame?.songCredits ?? []).map((c) => c.releaseId), ...(musicOf(p).sessionCredits ?? []).map((c) => c.releaseId).filter(Boolean)]);
  // Records the player played on come out: a line, and a little standing among musicians.
  for (const c of musicOf(p).sessionCredits ?? []) { const r = release(c.releaseId); if (r?.released === year() && !c.announced) { c.announced = true; lines.push(`${act(r.actId)?.name}'s ${r.title} is out: you play ${posLow(c.position)} on it.`); regard({ credibility: 0.5, why: `playing on ${r.title}` }, p); } }
  // Songs the player wrote for other acts earn a writer's share.
  for (const c of p.fame?.songCredits ?? []) {
    const r = release(c.releaseId);
    if (!r || r.released == null || r.released > year()) continue;
    if (r.released === year() && !c.announced && c.kind === 'album') { c.announced = true; lines.push(`${act(r.actId)?.name}'s ${RELEASE_TYPES[r.type]?.name.toLowerCase() ?? 'record'} ${r.title} is out, with ${c.song}, a song you wrote, on it.`); }
    if (r.released === year() && !c.announced) { c.announced = true; lines.push(`${act(r.actId)?.name} released ${r.title}, a song you wrote${r.chart ? `; it reached number ${r.chart}` : ''}.`); if (r.chart && r.chart <= 10) milestone(`Wrote a top-ten song: ${r.title}.`, 'fame'); gain({ audience: 'music', amount: Math.min(8, Math.sqrt(Object.values(r.units).reduce((a, b) => a + b, 0)) / 30), lasting: 0.3, why: `writing ${r.title}` }, p); }
    const age = year() - r.released;
    const total = Object.entries(r.units).reduce((s2, [cc, n]) => s2 + wageIn(MUSIC_DEAL.unitValue, COUNTRIES[cc], COUNTRIES[p.countryId]) * n, 0);
    const amount = Math.round(total * (age === 0 ? 1 : 0.35 * Math.pow(0.6, age - 1)) * SONGWRITER_SHARE * (c.share ?? 1));
    if (amount >= localWage(20, COUNTRIES[r.countryId ?? p.countryId] ?? country()) || age === 0) (c.revenue ??= []).push({ year: year() - 1, amount });
  }
  for (const [id, r] of Object.entries(E.releases)) if (!keep.has(id) && r.released != null && r.released < year() - 4) delete E.releases[id];
  return lines;
}

/** Everything the player has recorded, oldest first. */
export const discography = (p = player()) => musicOf(p).acts.flatMap((id) => (act(id)?.releases ?? []).map(release)).filter((r) => r && r.released != null).sort((x, y) => x.released - y.released);
export { musicOf, members, fanTotal };

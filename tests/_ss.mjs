// The required playable scenarios (A to R) and the vertical slices of the athletic life, each played through the
// engine's own functions from a new life: no result is written by hand, only the character set up to be able.
// Run with: node tests/sports-scenarios.mjs
const disk = new Map();
globalThis.localStorage = { getItem: (k) => (disk.has(k) ? disk.get(k) : null), setItem: (k, v) => { disk.set(k, String(v)); }, removeItem: (k) => { disk.delete(k); } };

const { store } = await import('../js/state.js');
const { rng } = await import('../js/rng.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { advanceYear } = await import('../js/engine/yearProcessor.js');
const { saveGame, loadGame } = await import('../js/save.js');
const { die } = await import('../js/engine/death.js');
const { continueAs, heirs } = await import('../js/engine/legacy.js');
const { makeNpc } = await import('../js/engine/npcFactory.js');
const { audit: ledgerAudit } = await import('../js/engine/ledger.js');
const edu = await import('../js/engine/education.js');
const { aid } = await import('../js/engine/admissions.js');
const { profile: applicant, catalog } = await import('../js/engine/university.js');
const { EVENT_BY_ID } = await import('../js/data/events/index.js');
const { resolveChoice, renderText } = await import('../js/engine/eventEngine.js');
const { SPORTS } = await import('../js/data/sports.js');
const sp = await import('../js/engine/sports.js');
const life = await import('../js/engine/sportsLife.js');
const arcs = await import('../js/engine/sportsArcs.js');

rng.seed(66);
const problems = []; const ok = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };
const scenario = (name, fn) => { const before = problems.length; try { fn(); } catch (err) { problems.push(`${name}: threw ${err.stack?.split('\n').slice(0, 3).join(' | ')}`); } if (problems.length === before) ok.push(name); else ok.push(`(failed) ${name}`); };
const S = () => store.state;
const P = () => store.state.player;
const sound = (where) => { const bad = life.audit(); check(!bad.length, `${where}: ${bad.join('; ')}`); };
/** Scenes the athletic engine queued are played with a choice; everything else is set aside. */
const scenes = [];
function playScenes(pick = 0) {
  for (const pe of S().pendingEvents.splice(0)) {
    if (!pe.id.startsWith('sport_arc')) continue;
    const ev = EVENT_BY_ID[pe.id];
    const text = renderText(ev.text, pe.cast);
    check(!/\{|undefined/.test(text), `${pe.id}: the scene text is complete (${text})`);
    resolveChoice(ev, Math.min(pick, ev.choices.length - 1), pe.cast);
    scenes.push(pe.id);
  }
}
// A move abroad (a new country) is only taken where a scenario asks for it.
function year(pref = {}) { advanceYear(); playScenes(); for (const d of life.openDecisions()) life.answer(d.id, pref[d.kind] && d.options.some((o) => o.id === pref[d.kind]) ? pref[d.kind] : d.kind === 'abroad' ? 'no' : d.options[0].id); }
function years(n, pref) { for (let i = 0; i < n && P().alive; i++) year(pref); }
function grownTo(age, countryId = 'us', city = 'Chicago', setup = () => {}) {
  for (;;) {
    store.state = createLife({ countryId, city });
    if (P().royal) continue;
    setup(P());
    years(age);
    if (P().alive && P().age === age && !P().legal?.incarceration) return P();
  }
}
const able = (p, t = 90) => { p.talents.sports = t; p.stats.health = Math.max(p.stats.health, 85); p.hidden.discipline = 80; };
const maxOut = (e, v = 85) => { for (const k of Object.keys(e.skills)) { e.ceiling[k] = Math.max(e.ceiling[k], v + 5); e.skills[k] = v; } };

// ---------- A. First sport ----------
scenario('A. first sport: a child takes up a sport and has a skill profile of their own', () => {
  const p = grownTo(6);
  check(sp.sportsMenu().some((x) => x.sport.id === 'soccer' && x.ok), 'soccer is open to a six-year-old');
  const r = sp.takeUp('soccer');
  const e = sp.entryOf('soccer');
  check(r.ok && e && Object.keys(e.skills).length === SPORTS.soccer.skills.length && Object.values(e.skills).every((v) => v >= 0 && v < 40), 'a beginner\'s profile of soccer skills');
  const before = { ...e.skills };
  years(2);
  check(Object.keys(e.skills).some((k) => e.skills[k] > before[k]), 'two years of playing moves the skills on');
  check(e.seasons.length === 2 && p.npcIds.includes(e.coachId), 'two seasons played, with a coach the child knows');
  sound('A');
});

// ---------- B. School team ----------
scenario('B. school team: a tryout, an outcome, a persistent roster', () => {
  let joined = false;
  for (let t = 0; t < 15 && !joined; t++) {
    const p = grownTo(14, 'us', 'Chicago', able); // starting high school: years left before leaving
    edu.setSport?.('soccer');
    p.education.sport = 'soccer';
    // Two seasons are watched, so the team must be made by sixteen: at eighteen the player leaves school, and the team.
    for (let i = 0; i < 2 && !joined; i++) { const r = edu.joinClub('sports_team'); joined = r.ok; if (!joined) year(); }
  }
  check(joined, 'a strong student makes the school team');
  if (!joined) return;
  // The year a child moves up a stage of school has no club season; the first one may be the year after.
  year({ academy: 'no' });
  if (!sp.entryOf('soccer')?.seasons.length) year({ academy: 'no' });
  const e = sp.entryOf('soccer');
  const org = sp.orgOf(e.orgId) ?? sp.orgOf(sp.teamOf(e.schoolTeamId)?.orgId);
  const team = sp.teamOf(e.teamId);
  check(org?.kind === 'school' && team.roster.some((x) => x.id === P().id), 'the player is on the school team\'s roster');
  const names = team.roster.map((x) => x.name).sort().join();
  const schoolBefore = P().education.place?.schoolId;
  year();
  const nowOrg = sp.orgOf(sp.teamOf(e.teamId)?.orgId);
  check(nowOrg?.kind === 'school' && (nowOrg.id === org.id || P().education.place?.schoolId !== schoolBefore), 'still on the school team the next year (the new school\'s, if the family moved schools)');
  if (nowOrg?.id === org.id) check(team.roster.filter((x) => names.includes(x.name)).length >= team.roster.length - 4, 'most of the roster is the same people');
  check(e.seasons.length >= 2 && P().flags.athlete?.seasons >= 2, 'the seasons are on the athletic record and the school record');
  sound('B');
});

// ---------- C. Private coach ----------
scenario('C. private coach: hired, trained with, and a relationship that lasts', () => {
  const p = grownTo(10);
  for (const id of p.npcIds) if (S().npcs[id]?.role === 'parent') S().npcs[id].wealth = 70; // a family that can pay for it
  sp.takeUp('tennis');
  const r = sp.hirePrivateCoach('tennis', 2);
  const e = sp.entryOf('tennis');
  const coach = sp.coachOf(e.privateCoachId);
  check(r.ok && coach?.private && S().npcs[coach.id]?.role === 'coach' && p.npcIds.includes(coach.id), 'the private coach is a person the player knows');
  check(!sp.hirePrivateCoach('tennis', 0).ok, 'one private coach at a time');
  const rel0 = S().npcs[coach.id].meters.relationship;
  years(3);
  check(sp.coachOf(e.privateCoachId)?.id === coach.id, 'still the same coach three years on');
  check(S().npcs[coach.id].meters.relationship !== rel0 || S().npcs[coach.id].memories?.length >= 1, 'the relationship has a history');
  check(sp.dropPrivateCoach('tennis').ok && !e.privateCoachId && sp.coachOf(coach.id).until === S().year, 'the coaching can end, and the coach\'s record says so');
  sound('C');
});

// ---------- D. Club competition ----------
scenario('D. club competition: a club joined, a competition entered, a valid result', () => {
  let e = null;
  for (let t = 0; t < 12 && !e?.orgId; t++) {
    grownTo(12, 'uk', 'London', able);
    sp.takeUp('soccer'); const x = sp.entryOf('soccer'); maxOut(x, 60);
    const club = sp.clubsFor('soccer').find((c) => c.org.level === 'club');
    if (club && sp.tryOut(club.org.id).ok) e = x;
  }
  check(!!e && sp.orgOf(e.orgId).level === 'club', 'a club took the player on');
  if (!e) return;
  year({ academy: 'no' });
  const s = sp.seasonOf(e.seasons.at(-1));
  const table = sp.standings(s);
  check(s && table.length === 8 && table.every((x) => x.p > 0), 'a league season was played, every team with games');
  check(s.playerTeamId === e.teamId && sp.orgOf(sp.teamOf(s.playerTeamId).orgId).level === 'club', 'it was the club\'s team that played');
  sound('D');
});

// ---------- E. Doubles partnership ----------
scenario('E. doubles: a partnership, a tournament, the result and the relationship kept', () => {
  const p = grownTo(12);
  sp.takeUp('pickleball');
  sp.findPartner('pickleball');
  const pair = sp.currentPartnership('pickleball');
  years(2);
  const ev = pair.events.map((id) => sp.eventOf(id))[0];
  check(!!ev && ev.format === 'doubles' && ev.partnershipId === pair.id && ev.rounds.length >= 1, 'a doubles tournament with the partner, with its rounds');
  const n = S().npcs[pair.b];
  check(n?.alive && p.npcIds.includes(n.id) && pair.chemistry > 0, 'the partner is still in the player\'s life, and the partnership has a chemistry');
  saveGame(S()); store.state = loadGame(S().slotId);
  check(sp.eventOf(ev.id) && JSON.stringify(sp.eventOf(ev.id).rounds) === JSON.stringify(ev.rounds), 'the result survives a save and reload unchanged');
  sound('E');
});

// ---------- F and G. Recruiting and the scholarship ----------
scenario('F/G. recruiting interest from an eligible university, and a scholarship that changes the cost', () => {
  let offer = null; let d = null;
  for (let t = 0; t < 15 && !offer; t++) {
    grownTo(14, 'us', 'Chicago', able);
    sp.takeUp('soccer'); const e = sp.entryOf('soccer'); maxOut(e, 66); sp.setPlan('soccer', 'technical', 10);
    for (let i = 0; i < 5 && !offer; i++) {
      advanceYear(); playScenes();
      // Recruiting (engine/recruiting.js): a commitment, then signing day with a university that pays a share.
      const paying = (sp.entryOf('soccer').recruit?.offers ?? []).find((o) => !o.pulled && o.fraction > 0 && !o.id.startsWith('juco:'));
      d = life.openDecisions().find((x) => x.kind === 'sign');
      if (d && paying && d.options.some((o) => o.id === paying.id) && life.answer(d.id, paying.id).ok) offer = { instId: paying.id, fraction: paying.fraction };
      for (const x of life.openDecisions()) life.answer(x.id, x.kind === 'commit' && paying ? paying.id : x.kind === 'camp' ? 'showcase' : x.options.some((o) => o.id === 'no') ? 'no' : x.options.at(-1).id);
    }
  }
  check(!!offer, 'F: a recruited high-school player in the United States has an offer');
  if (!offer) return;
  const p = P();
  const inst = catalog(p.countryId).find((u) => u.id === offer.instId);
  check(inst && sp.ensure().divisions?.[inst.id] && inst.countryId === p.countryId, 'F: from a real university of the country that runs teams');
  const help = aid(applicant(null, inst), inst, {}, 0.3);
  check(help.parts.some((x) => x.kind === 'athletic' && x.fraction === offer.fraction), 'G: the admissions aid carries the offered share');
  p.education.enrolled = false; p.education.stage = 'none';
  edu.enroll('university', 'business', 'self', {}, { id: inst.id, name: inst.name, aid: help });
  const full = edu.currentTuition();
  check(p.education.aid >= offer.fraction && Math.round(full * (1 - p.education.aid)) < full, 'G: the tuition charged is the tuition less the scholarship');
  year({ agent: 'no', contract: 'no', turnPro: 'no', academy: 'no', portal: 'stay', redshirt: 'no' });
  const e = sp.entryOf('soccer');
  check(sp.orgOf(e.orgId)?.kind === 'college' && sp.orgOf(e.orgId).uniId === inst.id, 'G: the player is on that university\'s team');
  const before = p.education.aid;
  check(life.quitCollegeTeam('soccer').ok && p.education.aid < before, 'G: leaving the team gives up the athletic share of the scholarship');
  check(scenes.includes('sport_arc_scholarship'), 'C arc: the scholarship story was told');
  sound('F/G');
});

// ---------- H, I, L and the professional slice ----------
let proLife = null;
scenario('H/I. professional signing with a persistent club, then a full season with consistent statistics', () => {
  let k = null;
  for (let t = 0; t < 12 && !k; t++) {
    grownTo(16, 'uk', 'London', able);
    sp.takeUp('soccer'); const e = sp.entryOf('soccer'); maxOut(e, 80); sp.setPlan('soccer', 'technical', 10);
    for (let i = 0; i < 6 && !e.contractId; i++) year({ academy: 'yes', contract: 'yes', agent: 'no' });
    k = e.contractId ? S().sports.contracts[e.contractId] : null;
  }
  check(!!k, 'H: an academy player is signed');
  if (!k) return;
  const p = P(); const e = sp.entryOf('soccer'); const org = sp.orgOf(k.orgId);
  check(org.level === 'pro' && org.employerId && p.career.employerId === org.employerId && p.career.careerId === 'athlete', 'H: a professional club, and the contract is the job');
  check(p.career.salary === k.salary && k.salary > 0, 'H: paid what the contract says, as wages');
  year({ renew: 'yes', transfer: 'no', agent: 'no' });
  const s = sp.seasonOf(e.seasons.at(-1));
  check(s.level === 'pro' && sp.teamOf(s.playerTeamId).orgId === org.id, 'I: a professional season with the club');
  const mine = [...s.fixtures, ...s.playoffs].filter((f) => f.me?.played).length;
  check(e.stats[s.year].games === mine, 'I: the season\'s games add up to the fixtures played');
  check(sp.standings(s).reduce((t, x) => t + x.p, 0) === s.fixtures.length * 2, 'I: every fixture was completed and counted');
  saveGame(S()); const snap = JSON.stringify(S().sports.contracts); store.state = loadGame(S().slotId);
  check(JSON.stringify(S().sports.contracts) === snap && P().career.employerId === org.employerId, 'professional slice: contract and career survive a save and reload');
  check(scenes.includes('sport_arc_pro_dream'), 'G arc: the professional dream was told');
  check(!ledgerAudit().length, 'the books balance');
  proLife = structuredClone(S());
  sound('H/I');
});

scenario('L. transfer: a move through the sport\'s own process, the old contract ended', () => {
  if (!proLife) { problems.push('L: no professional life to start from'); return; }
  let moved = false;
  // The same life replays the same way (results are never re-rolled), so this is one long career, not many tries.
  store.state = structuredClone(proLife);
  const e0 = sp.entryOf('soccer'); maxOut(e0, 90);
  for (let i = 0; i < 16 && !moved && P().alive; i++) {
    const from = S().sports.contracts[e0.contractId];
    advanceYear(); playScenes();
    for (const d of life.openDecisions()) { const r = life.answer(d.id, ['transfer', 'renew', 'contract'].includes(d.kind) ? 'yes' : 'no'); if (d.kind === 'transfer' && r.ok) moved = { from, d }; }
  }
  check(!!moved, 'a strong professional is bought by another club');
  if (!moved) return;
  const e = sp.entryOf('soccer'); const now = S().sports.contracts[e.contractId];
  check(moved.from.status === 'ended' && /transferred/.test(moved.from.why) && now.how === 'transfer' && now.orgId !== moved.from.orgId, 'the old contract ended by transfer; a new one at the new club');
  check(P().career.employerId === sp.orgOf(now.orgId).employerId, 'the job moved with the player');
  sound('L');
});

// ---------- J. Championship ----------
scenario('J. championship: won through completed competition only', () => {
  let title = null;
  for (let t = 0; t < 10 && !title; t++) {
    grownTo(10, 'us', 'Chicago', able);
    sp.takeUp('tennis'); maxOut(sp.entryOf('tennis'), 70);
    for (let i = 0; i < 4 && !title; i++) { year(); title = sp.entryOf('tennis').titles[0]; }
  }
  check(!!title, 'a strong junior wins a tournament');
  if (!title) return;
  const ev = sp.eventOf(title.eventId);
  check(ev.place === 'Champion' && ev.rounds.every((r) => r.won) && ev.rounds.at(-1).round === 'Final', 'the title is a draw won, round by round, to the final');
  sound('J');
});

// ---------- K. Injury recovery ----------
scenario('K. injury: hurt, cared for, rehabilitated, and back when ready', () => {
  let inj = null; let e = null;
  for (let t = 0; t < 8 && !inj; t++) {
    grownTo(17);
    sp.takeUp('soccer'); e = sp.entryOf('soccer');
    for (let i = 0; i < 30 && !inj; i++) { e.fatigue = 95; e.plan.hours = 18; advanceYear(); S().pendingEvents = []; inj = sp.myAthlete().injuries.find((x) => x.status === 'out'); }
  }
  check(!!inj, 'an injury happens');
  if (!inj) return;
  const p = P(); p.finance.cash = 1e7;
  const d = life.openDecisions().find((x) => x.kind === 'rehab' && x.injuryId === inj.id);
  check(d && life.answer(d.id, 'physio').ok && inj.rehab === 'physio', 'a rehab plan is chosen and paid for');
  check(S().sports.paid[`rehab/${inj.id}`]?.cat === 'health', 'the physiotherapy is booked as health care');
  e.plan.hours = 5;
  for (let i = 0; i < 6 && inj.status === 'out'; i++) { advanceYear(); S().pendingEvents = []; for (const x of life.openDecisions()) life.answer(x.id, x.kind === 'rehab' ? 'physio' : x.options[0].id); }
  check(inj.status === 'healed' && inj.healed > inj.year, 'healed, in a later year');
  year();
  const s = sp.seasonOf(e.seasons.at(-1));
  check(s.year > inj.healed - 1 && [...s.fixtures].some((f) => f.me?.played), 'back playing once healed');
  sound('K');
});

// ---------- M. Sponsorship ----------
scenario('M. sponsorship: offered to a known athlete, paid each year, completed', () => {
  let k = null; let base = null;
  {
    store.state = structuredClone(proLife ?? S());
    const a = sp.myAthlete();
    a.fame = 60;
    for (let i = 0; i < 8 && !k && P().alive; i++) {
      advanceYear(); playScenes();
      for (const d of life.openDecisions()) life.answer(d.id, ['sponsor', 'renew'].includes(d.kind) ? 'yes' : d.kind === 'integrity' ? 'refuse' : d.options.at(-1).id);
      k = Object.values(S().sports.contracts).find((x) => x.kind === 'sponsor');
    }
    base = S().year;
  }
  check(!!k, 'a known professional is offered a sponsorship, and signs');
  if (!k) return;
  for (let i = 0; i <= k.to - base + 1; i++) { advanceYear(); S().pendingEvents = []; for (const d of life.openDecisions()) life.answer(d.id, d.kind === 'renew' ? 'yes' : d.kind === 'integrity' ? 'refuse' : d.options.at(-1).id); }
  const paid = Object.entries(S().sports.paid).filter(([key]) => key.startsWith(`sponsor/${k.id}/`));
  check(k.status === 'ended' && paid.length === k.to - k.from + 1 && paid.every(([, x]) => x.amount === k.amount), `paid once for each year of the deal (${paid.length} of ${k.to - k.from + 1}), then ended`);
  check(!ledgerAudit().length, 'the books balance');
  sound('M');
});

// ---------- N and O. Retirement and coaching ----------
scenario('N/O. retirement keeps the whole career; coaching through the careers system', () => {
  store.state = structuredClone(proLife ?? S());
  const e = sp.entryOf('soccer');
  if (!e) { problems.push('N: no career to retire from'); return; }
  years(2, { renew: 'yes', transfer: 'no', agent: 'no' });
  const before = { seasons: e.seasons.length, titles: e.titles.length, stats: JSON.stringify(e.stats), moments: S().sports.moments.length };
  check(life.retire('soccer').ok && e.status === 'retired', 'N: the player retires');
  check(e.seasons.length === before.seasons && e.titles.length === before.titles && JSON.stringify(e.stats) === before.stats && S().sports.moments.length > before.moments, 'N: every season, title and statistic is kept, and the retirement is a moment');
  check(!P().career.sportContract && !Object.values(S().sports.contracts).some((k) => k.kind === 'pro' && k.status === 'active'), 'N: the contract ended with the career');
  const r = life.becomeCoach('soccer');
  check(r.ok && P().career.careerId === 'coaching' && sp.coachOf(P().id)?.self, 'O: coaching is a job in the careers system, with a coach\'s record');
  sound('N/O');
});

// ---------- P. Adaptive athletics ----------
scenario('P. adaptive athletics: a wheelchair user on a supported pathway', () => {
  const p = grownTo(10, 'us', 'Chicago', (x) => { x.flags.wheelchair = true; });
  check(!sp.canPlay('basketball').ok && /wheelchair basketball/i.test(sp.canPlay('basketball').text), 'the standing sport points to its adapted form');
  check(sp.takeUp('wheelchair_basketball').ok, 'wheelchair basketball can be taken up');
  years(2);
  const e = sp.entryOf('wheelchair_basketball');
  check(e.seasons.length === 2 && e.skills.chair >= 0, 'seasons played, with the skills of the adapted sport');
  check(sp.sportsMenu().filter((x) => x.ok).every((x) => x.sport.standing !== false), 'only sports that can be played seated are offered');
  void p;
  sound('P');
});

// ---------- Q. Historical sports ----------
scenario('Q. history: a character born in 1900 sees the sports of their time', () => {
  for (;;) { store.state = createLife({ countryId: 'uk', city: 'London' }); if (!P().royal) break; }
  const p = P();
  const shift = 1900 - p.birthYear;
  p.birthYear = 1900; S().year += shift;
  years(8);
  if (!p.alive) { problems.push('Q: the character did not live to eight'); return; }
  const menu = sp.sportsMenu().map((x) => x.sport.id);
  check(menu.includes('soccer') && menu.includes('tennis') && !menu.includes('pickleball') && !menu.includes('wheelchair_basketball') && !menu.includes('table_tennis') === (S().year < 1901), `in ${S().year}: soccer and tennis, no pickleball or adaptive sports`);
  sp.takeUp('soccer');
  year();
  const e = sp.entryOf('soccer');
  const s = sp.seasonOf(e.seasons.at(-1));
  check(s && sp.orgOf(s.leagueId).founded <= S().year && s.teamIds.every((t) => sp.orgOf(sp.teamOf(t).orgId).founded <= S().year), 'every club and league was founded by then');
  check(sp.proPath(SPORTS.basketball, 'us') === 'draft' && S().year < SPORTS.basketball.proFrom, 'nobody is paid to play basketball yet');
  sound('Q');
});

// ---------- R. Athletic dynasty ----------
scenario('R. dynasty: a descendant explores an ancestor\'s teammates, coaches, achievements and memories', () => {
  store.state = structuredClone(proLife ?? S());
  const p = P();
  const anc = sp.myAthlete();
  const coaches = Object.values(anc.sports).flatMap((e) => e.history.map((h) => sp.orgOf(h.orgId)?.coachId)).filter(Boolean);
  const kid = makeNpc({ role: 'child', countryId: p.countryId, age: 19, lastName: p.lastName });
  S().npcs[kid.id] = kid; p.npcIds.push(kid.id); kid.parentIds = [p.id];
  die('old age');
  check(heirs().some((n) => n.id === kid.id), 'setup: the child can carry on');
  store.state = continueAs(kid.id);
  const parent = Object.values(S().npcs).find((n) => n.role === 'parent' && !n.alive);
  const a = sp.athleteOf(parent.id);
  check(!!a && a.name === anc.name, 'the ancestor\'s record is there under their name');
  const e = a.sports.soccer;
  const team = sp.teamOf(e.history.at(-1).teamId);
  check(team && team.roster.length > 5, 'their teammates are on the roster of their last team');
  check(coaches.every((id) => sp.coachOf(id)?.name), 'every coach they had has a record');
  check(e.titles.length === anc.sports.soccer.titles.length && e.seasons.every((id) => sp.seasonOf(id)), 'their achievements and seasons are all there');
  check(sp.momentsOf(parent.id).length > 0 && sp.momentsOf(parent.id).every((m) => m.personId === parent.id), 'their memories are theirs, and reachable');
  check(!sp.myAthlete() || Object.values(sp.myAthlete().sports).every((x) => Object.values(x.skills).every((v) => v < 60)), 'the descendant inherited no skills');
  sound('R');
});

// ---------- Family ----------
scenario('family: parents\' past, siblings and children choose for themselves', () => {
  let started = 0; let past = 0; let kids = 0; const same = { yes: 0, no: 0 };
  for (let t = 0; t < 8; t++) {
    const p = grownTo(8, t % 2 ? 'us' : 'uk', t % 2 ? 'Chicago' : 'London');
    sp.takeUp('soccer');
    past += Object.values(S().sports.athletes).filter((a) => a.light && ['parent', 'grandparent'].includes(a.relation)).length;
    years(25);
    for (let c = 0; c < 3; c++) { const k = makeNpc({ role: 'child', countryId: p.countryId, age: 5, lastName: p.lastName }); k.parentIds = [p.id]; S().npcs[k.id] = k; p.npcIds.push(k.id); }
    years(12);
    for (const a of Object.values(S().sports.athletes).filter((x) => x.light && ['sibling', 'child'].includes(x.relation))) {
      started += 1; if (a.relation === 'child') kids += 1;
      if (a.primary) same[a.primary === 'soccer' ? 'yes' : 'no'] += 1;
      check(Object.values(a.sports).every((x) => !Object.keys(x.skills).length), 'a relative\'s record holds no invented per-skill detail');
    }
    sound(`family ${t}`);
  }
  check(past > 0, `some parents or grandparents played when young (${past})`);
  check(kids > 0, `some children took up a sport of their own (${kids})`);
  check(same.no > 0, `not every relative plays the player's sport (${same.yes} same, ${same.no} different)`);
  check(scenes.includes('sport_arc_new_generation'), 'I arc: a new generation was told');
});

// ---------- The first vertical slice (engine side; the browser check covers the screens) ----------
scenario('vertical slice: sport, training, club, coach, competition, ratings, milestone, memories, save, reload, no reroll', () => {
  const p = grownTo(12, 'us', 'Chicago', able);
  check(sp.takeUp('tennis').ok, '3-4. a sport chosen, a profile made');
  const e = sp.entryOf('tennis');
  sp.setPlan('tennis', 'technical', 10);
  const before = { ...e.skills };
  check(sp.extraSession('tennis', 'serve').ok && e.skills.serve >= before.serve, '5-6. a training session moves a skill');
  year();
  check(Object.keys(before).some((k) => e.skills[k] > before[k]), '7-8. after a year, training progress is kept');
  maxOut(e, 55);
  let club = null;
  for (let i = 0; i < 4 && !club; i++) { const c = sp.clubsFor('tennis').find((x) => x.open); if (c && sp.tryOut(c.org.id).ok) club = c.org; else year(); }
  check(!!club, '9-10. a local club found and joined');
  const coach = sp.coachOf(e.coachId);
  check(coach && S().npcs[coach.id]?.role === 'coach' && p.npcIds.includes(coach.id), '11-12. a coach who is a real, persistent person with a profile');
  const evsBefore = e.events.length; const prBefore = e.pr; const statsBefore = JSON.stringify(e.stats);
  year();
  const ev = sp.eventOf(e.events[evsBefore]);
  check(ev && ev.rounds.length >= 1 && ev.rounds.every((r) => r.opp && r.oppPr > 0), '14-16. an event entered against named opponents, and resolved');
  check(JSON.stringify(e.stats) !== statsBefore && e.pr !== prBefore, '17-19. results saved, statistics and the rating updated');
  const ms = sp.momentsOf().filter((m) => m.sig >= 2);
  check(ms.length > 0, '20. meaningful milestones recorded');
  check(S().journal.some((j) => j.sport?.screen && j.sport.id), '21. lines in the life story link to sports pages');
  const knows = sp.momentsOf().flatMap((m) => m.people).filter((id) => S().npcs[id]?.memories?.some((x) => x.key.startsWith('sport:')));
  check(knows.length > 0, '22-23. someone who was there remembers it with the player');
  saveGame(S());
  const snap = JSON.stringify({ e, coach: sp.coachOf(e.coachId), ev, paid: S().sports.paid, ids: p.npcIds, cash: p.finance.cash });
  store.state = loadGame(S().slotId);
  const e2 = sp.entryOf('tennis');
  check(JSON.stringify({ e: e2, coach: sp.coachOf(e2.coachId), ev: sp.eventOf(ev.id), paid: S().sports.paid, ids: P().npcIds, cash: P().finance.cash }) === snap, '25-27. after a reload: profile, skills, coach, competition, finances and people the same');
  const again = sp.internals.playEvent(S(), e2, ev.level, Number(ev.id.split('_').at(-1)));
  check(again === sp.eventOf(ev.id), '28. an event already played is never played again');
  const cash = P().finance.cash;
  check(!life.settle(S(), Object.keys(S().sports.paid)[0] ?? 'none', 0, 'sport', 'x') && P().finance.cash === cash, '28. nothing is paid twice');
  sound('vertical slice');
});

for (const m of ok) console.log(`ok   ${m}`);
for (const m of problems) console.log(`FAIL ${m}`);
if (problems.length) { console.log(`${problems.length} problem(s).`); process.exit(1); }
console.log('Every athletic scenario plays through.');

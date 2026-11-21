// A campaign for office, from declaring to the count.
//
//   declare → (the party's nomination) → platform and budget → four stretches
//   of campaigning, with a debate in the middle → polling day
//
// The race in progress is kept on the player, so a campaign can be put down
// and picked up again, and a saved game resumes it where it was:
//   p.flags.race = { officeId, countryId, year, rivalId, stage, round, platform, budget,
//                    appeal, edge: { groupId: points }, rivalAppeal, bias, polls: [poll],
//                    used: { moveId: times }, debate, debated, promises, donors, caught, electorate }
//     stage        'nomination' | 'defeated' | 'plan' | 'trail' | 'debate' | 'vote'
//     appeal       points of support won (or lost) on the trail so far
//     edge         extra points with particular groups of voters
//     rivalAppeal  how strong the other candidate is; the player only sees it through polls
//     bias         how far the published polls are out this time, the same way every time
//   p.flags.races  every race fought: [{ year, title, rival, share, won, votes, batches, … }]
// The arithmetic of the vote is in engine/elections.js (duel, countByArea).
import { rng } from '../rng.js';
import { clamp, localMoney, fmtMoney, theCountry } from '../util.js';
import { store, player, country, log } from '../state.js';
import { PLATFORMS, BUDGETS, MOVES, TRAIL, ROUNDS, DEBATE_QUESTIONS, NOMINATION } from '../data/politics.js';
import { AREAS, VOTERS } from '../data/parties.js';
import { COUNTRIES } from '../data/countries.js';
import { duel, countByArea } from './elections.js';
import * as world from './polity.js';
import { system, offices, barrier, standing, takeOffice, highestHeld, leave } from './politics.js';
import { report, post } from './news.js';
import { addSecret } from './scandal.js';
import { afterGeneral } from './leadership.js';
import { formCabinet } from './government.js';
import { backers } from './edlegacy.js';

const result = (ok, text, tone = ok ? 'good' : 'bad', more = {}) => ({ ok, text, tone, ...more });
const noise = (n) => (rng.next() * 2 - 1) * n;
const NEUTRAL = { tax: 0, services: 0, housing: 0, order: 0, green: 0, open: 0 };
const ELECTORATE = { council: 24000, mayor: 380000, seat: 95000, region: 2400000 };

export const race = () => store.state?.player?.flags.race ?? null;
const office = (r) => offices(COUNTRIES[r.countryId]).find((o) => o.id === r.officeId);
const rivalOf = (r) => world.polity(r.countryId).figures[r.rivalId] ?? null;
const groupName = (id) => VOTERS.find((g) => g.id === id)?.name ?? id;

/** Whether the party has to be won over before the voters are. */
const needsNomination = (o, c) => system(c).kind !== 'party' && o.tier >= 2 && !!world.membership(c.id);

// ---------- Declaring, and the nomination ----------

/** At the end of a term: the office-holder stands again. The record in office is most of what they run on. */
export function defend() {
  const k = player().politics;
  if (!k) return result(false, 'You hold no office.', 'neutral');
  if (race()) withdraw();
  return declare(k.officeId, true);
}

/** Enters a race. Nothing is spent yet. `defending`: standing again for the office already held. */
export function declare(officeId, defending = false) {
  const p = player();
  const c = country();
  const o = offices(c).find((x) => x.id === officeId);
  if (!o) return result(false, 'There is no such office here.', 'neutral');
  const why = defending ? (p.legal.incarceration ? 'You cannot campaign from a cell.' : '') : barrier(o);
  if (why) return result(false, why, 'neutral');
  const rival = world.opponentFor(officeId, c.id);
  // In a parliament the top office is not a race between two people: the leader takes their party into a general election.
  const national = officeId === 'head' && system(c).kind === 'parliamentary';
  const size = officeId === 'head' ? c.cities.length * 1.1e6 : ELECTORATE[officeId] ?? 50000;
  p.flags.campaignAge = p.age;
  p.flags.race = { officeId, countryId: c.id, year: store.state.year, rivalId: rival?.id ?? null, stage: !defending && !national && needsNomination(o, c) ? 'nomination' : 'plan', national,
    // Where the count leans toward those in power, it leans toward the one who holds the office.
    defend: defending, round: 0, platform: null, budget: null, appeal: defending && system(c).rigged ? 12 : 0, edge: {}, used: {}, polls: [], promises: 0,
    // A rival with charm is harder to beat; how good their campaign is, nobody knows yet.
    rivalAppeal: 56 + rng.int(-10, 10) + (rival ? (rival.t.charisma - 55) / 8 : 0),
    bias: Math.round(noise(3.5) * 10) / 10, electorate: Math.round(size * (0.8 + rng.next() * 0.4)) };
  const pa = world.membership(c.id);
  const old = rival?.schoolmate ? ` You were at ${rival.schoolmate} together.` : '';
  const help = backers();
  p.flags.race.appeal += help.boost;
  const text = national ? `You will lead ${world.the(pa)} into the general election. ${rival ? `${rival.name} is the one to beat.` : ''}`
    : p.flags.race.stage === 'nomination'
    ? `You have put your name forward for ${o.title}. First ${world.the(pa)} must choose its candidate, and you are not the only one who wants it.`
    : defending ? `You are standing again as ${o.title}${rival ? `, against ${rival.name}` : ''}. Carry the campaign on from the Work tab before the year is out.`
      : `You are a candidate for ${o.title}${rival ? `, against ${rival.name}` : ''}.`;
  return result(true, `${text}${old}${help.lines.length ? ` ${help.lines.join(' ')}` : ''}`, 'neutral');
}

/** The contest inside the party: who the other hopeful is, and what each way of winning costs. */
export function nominationInfo() {
  const r = race();
  if (!r || r.stage !== 'nomination') return null;
  const c = country();
  const o = office(r);
  const rival = world.primaryRival(r.officeId, c.id);
  return { party: world.membership(c.id), rival, office: o,
    options: NOMINATION.map((n) => ({ id: n.id, name: n.name, sub: n.cost ? `${n.sub} ${fmtMoney(localMoney(o.cost * n.cost, c), c)}.` : n.sub,
      disabled: !!n.cost && player().finance.cash < localMoney(o.cost * n.cost, c) })) };
}

export function seekNomination(approach) {
  const p = player();
  const c = country();
  const r = race();
  if (!r || r.stage !== 'nomination') return result(false, 'There is no nomination to seek.', 'neutral');
  const o = office(r);
  const pa = world.membership(c.id);
  const rival = world.primaryRival(r.officeId, c.id);
  const years = store.state.year - (p.flags.party?.since ?? store.state.year);
  // What the party already thinks of the player, before they ask for anything.
  let chance = 0.4 + (p.counters.polExp ?? 0) / 80 + Math.min(0.2, years / 40) + highestHeld(p) * 0.07 + (p.politics ? 0.15 : 0) - (rival.t.charisma - 55) / 300;
  if (approach === 'leadership') chance += (p.hidden.discipline - 50) / 200 + Math.min(0.15, years / 30);
  else if (approach === 'money') {
    const cost = localMoney(o.cost, c);
    if (p.finance.cash < cost) return result(false, 'You cannot afford to outspend anyone.', 'neutral');
    p.finance.cash -= cost;
    p.hidden.karma = clamp(p.hidden.karma - 2);
    chance += 0.15;
  } else chance += (p.stats.charm - 50) / 150;
  if (p.flags.bolted) chance -= 0.15; // a party remembers who walked out on it
  if (rng.chance(clamp(chance, 0.08, 0.92))) {
    r.stage = 'plan';
    world.recordRace(rival, `Sought the nomination of ${world.the(pa)} for ${o.title}, and lost it to ${p.firstName} ${p.lastName}.`);
    return result(true, `${world.the(pa).replace(/^t/, 'T')} has chosen you over ${rival.name}. You are its candidate for ${o.title}.`);
  }
  r.stage = 'defeated';
  r.nominee = rival.name;
  world.recordRace(rival, `Won the nomination of ${world.the(pa)} for ${o.title}, ahead of ${p.firstName} ${p.lastName}.`);
  return result(false, `${world.the(pa).replace(/^t/, 'T')} has chosen ${rival.name} instead of you. You can accept it, or leave the party and stand against them both.`);
}

/** After losing the nomination: step aside, or leave the party and run anyway. */
export function afterDefeat(bolt) {
  const p = player();
  const r = race();
  if (!r || r.stage !== 'defeated') return result(false, '', 'neutral');
  const pa = world.membership(r.countryId);
  if (!bolt) {
    delete p.flags.race;
    p.counters.polExp = (p.counters.polExp ?? 0) + 1;
    const text = `You stand aside for ${r.nominee} and applaud at the right moments. ${pa ? world.the(pa).replace(/^t/, 'T') : 'The party'} will remember that you did.`;
    log(text, 'system', 'neutral');
    return result(true, text, 'neutral');
  }
  world.leaveParty();
  p.flags.bolted = store.state.year;
  r.appeal -= 3; // the vote on your side of the argument is split
  r.stage = 'plan';
  const text = `You have left ${pa ? world.the(pa) : 'the party'} and will stand as an independent. Old colleagues cross the street to avoid you.`;
  log(text, 'system', 'neutral');
  return result(true, text, 'neutral');
}

// ---------- The plan ----------

/** What each pledge would do with each group of voters, in words, so the choice can be an informed one. */
export function platformOptions() {
  const r = race();
  const c = country();
  const groups = world.voters(c.id);
  const mine = world.membership(c.id);
  return PLATFORMS.map((x) => {
    let sub = '';
    if (x.issue) {
      const fits = groups.map((g) => ({ g, v: pledgeEdge(x, g) }));
      const likes = fits.filter((f) => f.v >= 2).sort((a, b) => b.v - a.v).slice(0, 2).map((f) => f.g.name.toLowerCase());
      const hates = fits.filter((f) => f.v <= -1).sort((a, b) => a.v - b.v).slice(0, 1).map((f) => f.g.name.toLowerCase());
      sub = `${likes.length ? `Goes down well with ${likes.join(' and ')}.` : 'Nobody feels strongly about it.'}${hates.length ? ` Puts off ${hates[0]}.` : ''}`;
      if (mine && (mine.positions[x.issue] ?? 0) * x.to < 0) sub += ' Your own party says the opposite.';
    } else if (x.against) sub = r && rivalOf(r) && governs(r) ? 'Your opponent\'s side is in government. Works if people are fed up with it.' : 'Your opponent is not the one in power, so it has little to bite on.';
    else if (x.silly) sub = 'Nobody will forget you.';
    return { id: x.id, name: x.name, sub };
  });
}
/** Points a pledge is worth with one group: how much they care, and whether it is what they want. */
const pledgeEdge = (x, g) => (g.cares[x.issue] ?? 0) * (2 - Math.abs(x.to - (g.wants[x.issue] ?? 0))) * 1.6;
/** Whether the rival's party is in government. */
function governs(r) {
  const w = world.polity(r.countryId);
  const f = rivalOf(r);
  return !!f && (f.partyId === w.govt.lead || w.govt.partners.includes(f.partyId));
}

export function setPlan(platformId, budgetId) {
  const p = player();
  const c = country();
  const r = race();
  if (!r || r.stage !== 'plan') return result(false, 'There is nothing to plan.', 'neutral');
  const o = office(r);
  const budget = BUDGETS.find((b) => b.id === budgetId) ?? BUDGETS[0];
  const platform = PLATFORMS.find((x) => x.id === platformId) ?? PLATFORMS[0];
  const cost = localMoney(o.cost * budget.times, c);
  if (p.finance.cash < cost) return result(false, 'You cannot afford that campaign.', 'neutral');
  p.finance.cash -= cost;
  r.spent = cost;
  r.platform = platform.id;
  r.budget = budget.id;
  const w = world.polity(c.id);
  const mine = world.membership(c.id);
  let text = `Your campaign for ${o.title} is under way: "${platform.name}".`;
  if (platform.silly) { r.appeal -= 6; p.hidden.fame = clamp(p.hidden.fame + 4); text += ' The pony pledge is on every front page, though not always kindly.'; }
  else if (platform.against) { const g = governs(r) ? (50 - w.approval) / 4 : -1; r.appeal += clamp(g, -4, 8); }
  else {
    for (const g of world.voters(c.id)) r.edge[g.id] = (r.edge[g.id] ?? 0) + pledgeEdge(platform, g);
    if (mine && (mine.positions[platform.issue] ?? 0) * platform.to < 0) { r.appeal -= 3; text += ` ${world.the(mine).replace(/^t/, 'T')} says the opposite in its own leaflets, and people notice.`; }
  }
  r.stage = 'trail';
  const poll = takePoll(r);
  return result(true, `${text} The first poll puts ${r.national ? 'your party' : 'you'} on ${poll.me}%.`, 'neutral', { poll });
}

// ---------- Where the race stands ----------

/** Both candidates as the arithmetic sees them. */
function sides(r) {
  const w = world.polity(r.countryId);
  const mine = world.membership(r.countryId);
  const them = rivalOf(r);
  const positions = { ...(mine?.positions ?? NEUTRAL) };
  const pl = PLATFORMS.find((x) => x.id === r.platform);
  if (pl?.issue) positions[pl.issue] = pl.to;
  const budget = BUDGETS.find((b) => b.id === r.budget);
  return { me: { id: 'me', positions, appeal: standing(office(r)) + (budget?.boost ?? 0) + r.appeal, edge: r.edge },
    rival: { id: 'rival', positions: world.party(w, them?.partyId)?.positions ?? NEUTRAL, appeal: r.rivalAppeal } };
}

/** What the player's campaign is worth to their party in a general election, as points of appeal. */
function boostOf(r) {
  const budget = BUDGETS.find((b) => b.id === r.budget);
  const groups = world.voters(r.countryId);
  const edge = groups.reduce((s, g) => s + g.share * (r.edge[g.id] ?? 0), 0);
  return clamp((standing(office(r)) + (budget?.boost ?? 0) + r.appeal + edge - 55) / 5, -5, 6);
}

/** A poll before a general election: every party's share, with the error polls have. */
function nationalPoll(r, own) {
  const w = world.polity(r.countryId);
  const mine = world.membership(r.countryId);
  const truth = world.pollGeneral(w, mine ? { [mine.id]: boostOf(r) } : {});
  const err = () => (own ? noise(1) : r.bias / 2 + noise(2));
  const parties = w.parties.map((x) => ({ id: x.id, name: x.name, share: Math.round(clamp(truth[x.id] + (x.id === mine?.id ? (own ? noise(1) : r.bias + noise(2)) : err()), 1, 90)) })).sort((a, b) => b.share - a.share);
  const poll = { round: r.round, me: parties.find((x) => x.id === mine?.id)?.share ?? 0, margin: own ? 2 : 4, parties: parties.slice(0, 4).map((x) => ({ name: x.name, share: x.share, mine: x.id === mine?.id })) };
  if (own) poll.own = true;
  r.polls.push(poll);
  return poll;
}

/** A poll: the truth, plus the error polls have. A private poll is closer, and breaks the voters down. */
function takePoll(r, own = false) {
  if (r.national) return nationalPoll(r, own);
  const s = sides(r);
  const groups = world.voters(r.countryId);
  const truth = duel(s.me, s.rival, groups, () => 0, 100000);
  const err = own ? noise(1) : r.bias + noise(2.5);
  const poll = { round: r.round, me: Math.round(clamp(truth.shares.me + err, 3, 97)), margin: own ? 2 : 4 };
  if (own) {
    poll.own = true;
    poll.byGroup = Object.fromEntries(groups.map((g) => { const v = truth.byGroup[g.id]; return [g.id, Math.round(clamp(v.me / Math.max(1, v.me + v.rival) * 100 + noise(2), 2, 98))]; }));
  }
  r.polls.push(poll);
  return poll;
}

/** The race as the screens show it. */
export function view() {
  const r = race();
  if (!r) return null;
  const c = COUNTRIES[r.countryId];
  const o = office(r);
  const f = rivalOf(r);
  const pa = f ? world.party(world.polity(r.countryId), f.partyId) : null;
  const last = r.polls[r.polls.length - 1] ?? null;
  return { stage: r.stage, office: o, rival: f, rivalParty: pa, round: r.round, rounds: ROUNDS.length, when: ROUNDS[Math.min(r.round, ROUNDS.length - 1)],
    polls: r.polls, poll: last, national: !!r.national, party: world.membership(r.countryId), platform: PLATFORMS.find((x) => x.id === r.platform)?.name ?? null, spent: r.spent ?? 0, debated: r.debated ?? null,
    pollYear: world.nextElection(r.officeId, r.countryId), country: c, nominee: r.nominee ?? null };
}

// ---------- The trail ----------

export function trailOptions() {
  const r = race();
  const p = player();
  const c = country();
  if (!r || r.stage !== 'trail') return [];
  const o = office(r);
  return TRAIL.filter((m) => !m.last || r.round === ROUNDS.length - 1).map((m) => {
    const cost = m.cost ? localMoney(o.cost * m.cost, c) : 0;
    const again = (r.used[m.id] ?? 0) > 0 && m.boost;
    const sub = [cost ? `Costs ${fmtMoney(cost, c)}.` : '', m.raise ? `Brings in money.${m.strings ? ' If the guest list gets out, it will hurt.' : ''}` : '',
      m.poll ? 'More accurate than the published ones, and shows who is with you.' : '', m.group ? 'A week spent on the people you most need.' : '',
      m.dirty ? 'It can win it for you, or lose it.' : '', m.illegal ? 'Against the law. It can win it for you, or end you.' : '', again ? 'Worth less the second time.' : ''].filter(Boolean).join(' ');
    return { id: m.id, name: m.name, sub, disabled: p.finance.cash < cost, group: !!m.group, risky: !!(m.dirty || m.illegal) };
  });
}
export const voterGroups = () => VOTERS.map((g) => ({ id: g.id, name: g.name }));

/** Spends one stretch of the campaign on something. `arg`: the group, when courting one. */
export function act(id, arg) {
  const p = player();
  const c = country();
  const r = race();
  if (!r || r.stage !== 'trail') return result(false, 'The campaign is not at that point.', 'neutral');
  const m = TRAIL.find((x) => x.id === id);
  if (!m || (m.last && r.round !== ROUNDS.length - 1)) return result(false, 'That cannot be done now.', 'neutral');
  if (m.group && !VOTERS.some((g) => g.id === arg)) return result(false, 'Choose who to court.', 'neutral');
  const o = office(r);
  const cost = m.cost ? localMoney(o.cost * m.cost, c) : 0;
  if (p.finance.cash < cost) return result(false, 'You cannot afford it.', 'neutral');
  p.finance.cash -= cost;
  r.spent = (r.spent ?? 0) + cost;
  const before = r.used[id] ?? 0;
  r.used[id] = before + 1;
  let text = m.text;
  let tone = 'neutral';
  let gain = 0;
  if (m.boost) {
    gain = rng.int(m.boost[0], m.boost[1]);
    if (m.factor) gain += ((m.factor === 'discipline' ? p.hidden.discipline : p.stats[m.factor]) - 50) / 12;
    if (before && gain > 0) gain /= 2;
  }
  if (m.karma) p.hidden.karma = clamp(p.hidden.karma + m.karma);
  if (m.group) {
    r.edge[arg] = (r.edge[arg] ?? 0) + rng.int(8, 12) / (before ? 2 : 1);
    text = `You spend it with ${groupName(arg).toLowerCase()}: their halls, their worries, their tea. They notice that you came.`;
  } else if (m.raise) {
    const raised = Math.round(localMoney(o.cost * (m.raise[0] + rng.next() * (m.raise[1] - m.raise[0])) * (1 + p.hidden.fame / 120), c));
    p.finance.cash += raised;
    if (m.strings) r.donors = true;
    text = `${m.text} It brings in ${fmtMoney(raised, c)}.`;
    tone = 'good';
  } else if (m.poll) {
    const poll = takePoll(r, true);
    const order = Object.entries(poll.byGroup ?? {}).sort((a, b) => b[1] - a[1]);
    text = r.national ? `Your own pollster puts the party on ${poll.me}%, give or take ${poll.margin}: ${poll.parties.map((x) => `${x.name} ${x.share}%`).join(', ')}.` : `Your own pollster has you on ${poll.me}%, give or take ${poll.margin}. You are strongest with ${groupName(order[0][0]).toLowerCase()} (${order[0][1]}%) and weakest with ${groupName(order[order.length - 1][0]).toLowerCase()} (${order[order.length - 1][1]}%).`;
  } else if (m.illegal) {
    // Easier to get away with where it is how things are done.
    if (rng.chance(clamp(0.55 - c.living.graft / 150, 0.08, 0.5))) { r.caught = true; gain = -20; p.legal.heat = clamp(p.legal.heat + 35); text = 'The envelopes were filmed changing hands. The police would like a word.'; tone = 'bad'; }
    else addSecret('envelopes', rng.int(40, 75)); // nobody saw. Somebody knows.
  } else if (m.dirty) {
    const f = rivalOf(r);
    if (f && f.t.integrity < 45) gain += 3; // there was something to find
    if (gain < 0) { text = 'The attack adverts were so nasty that people felt sorry for your opponent.'; tone = 'bad'; }
  }
  r.appeal += gain;
  r.round += 1;
  const poll = m.poll ? r.polls[r.polls.length - 1] : takePoll(r);
  if (r.round === 2 && o.tier >= 2 && r.rivalId && !r.debated) r.stage = 'debate';
  else if (r.round >= ROUNDS.length) r.stage = 'vote';
  return result(true, text, tone, { poll });
}

// ---------- The debate ----------

/** The question on the table, or null when there is no debate to have. */
export function debateInfo() {
  const r = race();
  if (!r || r.stage !== 'debate') return null;
  if (!r.debate) {
    const issues = Object.keys(DEBATE_QUESTIONS);
    const qs = [];
    while (qs.length < 3) { const i = rng.pick(issues); if (!qs.includes(i)) qs.push(i); }
    r.debate = { qs, at: 0, mine: 0, dodges: 0 };
  }
  const d = r.debate;
  return { n: d.at + 1, of: d.qs.length, issue: d.qs[d.at], question: DEBATE_QUESTIONS[d.qs[d.at]], rival: rivalOf(r) };
}

/** Declines the debate. An empty chair speaks for itself. */
export function duckDebate() {
  const r = race();
  if (!r || r.stage !== 'debate') return result(false, '', 'neutral');
  r.appeal -= 3;
  r.debated = 'ducked';
  r.stage = r.round >= ROUNDS.length ? 'vote' : 'trail';
  const f = rivalOf(r);
  return result(false, `You decline. ${f ? f.name : 'Your opponent'} debates an empty chair for an hour, and the chair does not come out of it well.`, 'bad');
}

/** Answers the question on the table. After the last one, the verdict. */
export function answer(how) {
  const p = player();
  const r = race();
  const info = debateInfo();
  if (!r || !info) return result(false, '', 'neutral');
  const d = r.debate;
  const f = rivalOf(r);
  let gain = 0;
  let text = '';
  if (how === 'crowd') { gain = rng.int(2, 4); r.promises += 1; text = 'The room loves it. You have just promised something you will have to find a way to pay for.'; }
  else if (how === 'attack') {
    if (rng.chance(clamp(0.45 + (p.stats.charm - 50) / 200 + (50 - (f?.t.integrity ?? 50)) / 150, 0.15, 0.85))) { gain = rng.int(3, 6); text = `It lands. ${f?.name ?? 'Your opponent'} is still explaining when the bell goes.`; }
    else { gain = -rng.int(2, 5); text = 'It comes out sounding sour, and the audience lets you know.'; }
  } else if (how === 'dodge') {
    d.dodges += 1;
    if (d.dodges >= 2) { gain = -3; text = '"With respect, that was not the question," says the moderator, and gets a round of applause.'; } else { gain = rng.int(0, 1); text = 'You answer a different question, smoothly, and nobody quite notices.'; }
  } else { gain = (p.stats.intellect - 50) / 14 + rng.int(-1, 2); text = gain >= 2 ? 'A plain answer, with the figures to back it. People nod.' : gain <= 0 ? 'You answer honestly and lose the room somewhere around the second sub-clause.' : 'A plain answer. It does the job.'; }
  d.mine += gain;
  d.at += 1;
  if (d.at < d.qs.length) return result(gain > 0, text, gain > 0 ? 'good' : gain < 0 ? 'bad' : 'neutral', { more: true });
  // The other side of the stage had an hour too.
  let theirs = 0;
  for (let i = 0; i < d.qs.length; i++) theirs += ((f?.t.charisma ?? 50) - 50) / 14 + rng.int(-1, 2);
  const diff = d.mine - theirs;
  r.appeal += clamp(diff, -8, 10) * 0.8;
  r.debated = diff > 2 ? 'won' : diff < -2 ? 'lost' : 'drawn';
  r.stage = r.round >= ROUNDS.length ? 'vote' : 'trail';
  p.counters.polExp = (p.counters.polExp ?? 0) + 1;
  const poll = takePoll(r);
  const verdict = r.debated === 'won' ? `The papers call it for you. The next poll has you on ${poll.me}%.` : r.debated === 'lost' ? `The papers call it for ${f?.name ?? 'your opponent'}. The next poll has you on ${poll.me}%.` : `The papers call it a draw. The next poll has you on ${poll.me}%.`;
  return result(r.debated !== 'lost', `${text} ${verdict}`, r.debated === 'won' ? 'good' : r.debated === 'lost' ? 'bad' : 'neutral', { more: false, poll });
}

// ---------- Polling day ----------

/**
 * Holds the vote. The result is worked out once, here, and kept: the count
 * shown on election night is this result arriving area by area.
 * @returns {{ok:boolean, text:string, tone:string, night?:object}}
 */
export function pollingDay() {
  const p = player();
  const r = race();
  if (!r || r.stage !== 'vote') return result(false, 'It is not Election Day.', 'neutral');
  const c = COUNTRIES[r.countryId];
  const s = system(c);
  const o = office(r);
  const w = world.polity(c.id);
  const f = rivalOf(r);
  const pa = f ? world.party(w, f.partyId) : null;
  const notes = [];
  if (r.donors && rng.chance(0.18)) { r.appeal -= 5; notes.push('On the last weekend a newspaper printed the guest list of your donors\' dinner, and what each of them wanted.'); }
  else if (r.donors) addSecret('donors', rng.int(20, 45)); // it did not come out. It still could.
  if (r.national) return generalElection(r, notes);
  // The weather, the last headlines, and everything else nobody controls.
  r.appeal += rng.int(-6, 6) + rng.int(-4, 4);
  const cand = sides(r);
  const res = duel(cand.me, cand.rival, world.voters(c.id), noise, r.electorate);
  if (res.votes.me === res.votes.rival) {
    // A dead heat is settled by the returning officer's coin, one vote either way.
    const g = Object.keys(res.byGroup).find((id) => res.byGroup[id].me > 0 && res.byGroup[id].rival > 0);
    const [up, down] = rng.chance(0.5) ? ['me', 'rival'] : ['rival', 'me'];
    res.byGroup[g][up] += 1; res.byGroup[g][down] -= 1; res.votes[up] += 1; res.votes[down] -= 1;
  }
  const won = res.votes.me > res.votes.rival;
  const share = Math.round(res.votes.me / res.total * 1000) / 10;
  const order = AREAS.map((x) => x.id).sort(() => rng.next() - 0.5);
  const batches = countByArea(res.byGroup, AREAS, order).map((b) => ({ ...b, name: AREAS.find((x) => x.id === b.id).name }));
  const lastPoll = [...r.polls].reverse().find((x) => !x.own) ?? r.polls[r.polls.length - 1];
  const rec = { year: store.state.year, countryId: c.id, officeId: o.id, title: o.title, rival: f?.name ?? 'your opponent', rivalParty: pa?.name ?? null, rivalColor: pa?.color ?? '#777',
    party: world.membership(c.id)?.name ?? null, color: world.membership(c.id)?.color ?? '#444', share, won, votes: { ...res.votes }, total: res.total, turnout: res.turnout,
    byGroup: Object.fromEntries(Object.entries(res.byGroup).map(([g, v]) => [g, Math.round(v.me / Math.max(1, v.me + v.rival) * 1000) / 10])),
    batches, exit: Math.round(clamp(share + noise(3), 3, 97)), lastPoll: lastPoll?.me ?? null, platform: PLATFORMS.find((x) => x.id === r.platform)?.name ?? null, debated: r.debated ?? null, rigged: !!s.rigged };
  const races = (p.flags.races ??= []);
  for (const old of races) delete old.batches;
  races.push(rec);
  if (races.length > 15) races.shift();
  delete p.flags.race;

  p.counters.polExp = (p.counters.polExp ?? 0) + 1;
  const told = notes.length ? ` ${notes.join(' ')}` : '';
  const them = f ? `${f.name}${pa ? ` of ${world.the(pa)}` : ''}` : 'your opponent';
  let text;
  const k = p.politics;
  if (r.defend && k?.officeId === o.id) {
    // Standing again: keep the office, or lose it.
    if (won) {
      p.counters.electionsWon = (p.counters.electionsWon ?? 0) + 1;
      k.terms += 1; k.termLeft = o.term; delete k.fallen;
      k.approval = Math.round(clamp(k.approval + (share - 50) * 0.3));
      if (r.promises) k.promises = r.promises;
      p.stats.mood = clamp(p.stats.mood + 10);
      text = `You are re-elected as ${o.title} with ${share}% of the vote, ahead of ${them}.${told} The campaign cost ${fmtMoney(r.spent ?? 0, c)}.`;
      world.recordRace(f, `Lost to ${p.firstName} ${p.lastName}, who was re-elected ${o.title}, ${Math.round((100 - share) * 10) / 10}% to ${share}%.`);
    } else {
      p.counters.electionsLost = (p.counters.electionsLost ?? 0) + 1;
      p.stats.mood = clamp(p.stats.mood - 12);
      leave('voted out');
      text = `You are voted out, with ${share}% of the vote${s.rigged ? ', by the official count' : ''}. ${f ? f.name : 'Your opponent'} takes your place, and you have until Friday to clear your desk.${told}`;
      world.recordRace(f, `Beat ${p.firstName} ${p.lastName}, the sitting ${o.title}, ${Math.round((100 - share) * 10) / 10}% to ${share}%.`);
    }
    report(w, won ? 'held' : 'ousted', { office: o.title, share, rival: f?.name ?? 'the challenger' });
    log(text, 'system', won ? 'good' : 'bad');
    return result(won, text, won ? 'good' : 'bad', { night: rec });
  }
  report(w, won ? 'won' : 'lost', { office: o.title, share, rival: f?.name ?? 'the other candidate' });
  if (won) {
    p.counters.electionsWon = (p.counters.electionsWon ?? 0) + 1;
    takeOffice(o, r.caught ? 40 : Math.round(clamp(48 + (share - 50) * 0.8, 45, 75)));
    if (r.promises) p.politics.promises = r.promises;
    p.stats.mood = clamp(p.stats.mood + 14);
    text = `You beat ${them} with ${share}% of the vote. You are ${o.title}${o.tier >= 5 ? ` of ${theCountry(c.name)}` : ''}.${told} The campaign cost ${fmtMoney(r.spent ?? 0, c)}.`;
    world.recordRace(f, `Lost the race for ${o.title} to ${p.firstName} ${p.lastName}, ${Math.round((100 - share) * 10) / 10}% to ${share}%.`);
    if (o.fullTime) text += ' It is a full-time job, and you have left your old one.';
  } else {
    p.counters.electionsLost = (p.counters.electionsLost ?? 0) + 1;
    p.stats.mood = clamp(p.stats.mood - 10);
    text = `You lost to ${them}, with ${share}% of the vote${s.rigged ? ', by the official count' : ''}.${told} The campaign cost ${fmtMoney(r.spent ?? 0, c)}.`;
    world.recordRace(f, `Beat ${p.firstName} ${p.lastName} for ${o.title}, ${Math.round((100 - share) * 10) / 10}% to ${share}%.`);
  }
  log(text, 'system', won ? 'good' : 'bad');
  return result(won, text, won ? 'good' : 'bad', { night: rec });
}

/**
 * A general election fought as party leader. The campaign is worth points to
 * the party; then the whole country votes, seats are shared out, and a
 * government is formed. The player governs if their party leads it.
 */
function generalElection(r, notes) {
  const p = player();
  const c = COUNTRIES[r.countryId];
  const w = world.polity(c.id);
  const o = office(r);
  const mine = world.membership(c.id);
  const year = store.state.year;
  const f = world.playerFigure(c.id);
  r.appeal += rng.int(-5, 5);
  if (mine) mine.boost = boostOf(r);
  const before = { lead: w.govt.lead, held: p.politics?.officeId === 'head' };
  const rec = world.runGeneral(w, year);
  w.calendar.general = year + w.calendar.term;
  if (w.govt.lead !== before.lead && w.govt.headId !== f.id) formCabinet(w);
  const lastPoll = [...r.polls].reverse().find((x) => !x.own) ?? r.polls[r.polls.length - 1];
  const spent = r.spent ?? 0;
  delete p.flags.race;
  p.counters.polExp = (p.counters.polExp ?? 0) + 2;
  const parties = w.parties.map((x) => ({ id: x.id, name: x.name, color: x.color, share: rec.shares[x.id] ?? 0, seats: rec.seats[x.id] ?? 0, mine: x.id === mine?.id })).sort((a, b) => b.seats - a.seats || b.share - a.share);
  // The seats come in over the night, a quarter of the country at a time.
  const order = AREAS.map((x) => x.name).sort(() => rng.next() - 0.5);
  const left = Object.fromEntries(parties.map((x) => [x.id, x.seats]));
  const running = Object.fromEntries(parties.map((x) => [x.id, 0]));
  const batches = order.map((name, i) => {
    for (const x of parties) { const n = i === order.length - 1 ? left[x.id] : Math.min(left[x.id], Math.round(x.seats / order.length + noise(x.seats / 10))); running[x.id] += Math.max(0, n); left[x.id] -= Math.max(0, n); }
    return { name, running: { ...running }, declared: Object.values(running).reduce((a, b) => a + b, 0) };
  });
  const won = w.govt.headId === f.id;
  const inGovt = !!mine && (w.govt.lead === mine.id || w.govt.partners.includes(mine.id));
  const lead = world.party(w, w.govt.lead);
  const night = { national: true, year, title: o.title, parties, seatCount: w.seatCount, need: Math.floor(w.seatCount / 2) + 1, turnout: rec.turnout, total: rec.total, batches,
    exit: parties.map((x) => ({ name: x.name, share: Math.round(clamp(x.share + noise(3), 1, 90)), mine: x.mine })).sort((a, b) => b.share - a.share).slice(0, 4), lastPoll: lastPoll?.me ?? null,
    won, inGovt, govt: { kind: w.govt.kind, head: rec.govt.headName, lead: lead?.name ?? '', partners: w.govt.partners.map((id) => world.party(w, id)?.name).filter(Boolean) } };
  const top = parties.slice(0, 3).map((x) => `${x.name} ${x.share}%`).join(', ');
  post(w, `General election: ${top}; turnout ${rec.turnout}%. ${rec.govt.headName} of ${lead ? world.the(lead) : 'no party'} will lead ${w.govt.kind === 'coalition' ? 'a coalition' : w.govt.kind === 'minority' ? 'a minority government' : 'a majority government'}.`);
  const my = parties.find((x) => x.mine);
  const told = notes.length ? ` ${notes.join(' ')}` : '';
  let text;
  if (won) {
    p.counters.electionsWon = (p.counters.electionsWon ?? 0) + 1;
    p.stats.mood = clamp(p.stats.mood + 14);
    text = `${mine.name} has won ${my.seats} of ${w.seatCount} seats with ${my.share}% of the vote${w.govt.kind === 'coalition' ? `, and will govern in coalition with ${night.govt.partners.join(' and ')}` : w.govt.kind === 'minority' ? ', short of a majority, and will govern alone' : ', a majority'}. You ${before.held ? 'remain' : 'are'} ${o.title} of ${theCountry(c.name)}.${told}`;
    if (before.held) report(w, 'held', { office: o.title, share: my.share });
  } else {
    p.counters.electionsLost = (p.counters.electionsLost ?? 0) + 1;
    p.stats.mood = clamp(p.stats.mood - 12);
    text = `${mine?.name ?? 'Your side'} has won ${my?.seats ?? 0} of ${w.seatCount} seats with ${my?.share ?? 0}% of the vote. ${rec.govt.headName} of ${lead ? world.the(lead) : 'another party'} will be ${o.title}${inGovt ? ', with your party as a junior partner' : ''}.${told}`;
  }
  text += ` The campaign cost you ${fmtMoney(spent, c)}.`;
  log(text, 'system', won ? 'good' : 'bad');
  afterGeneral();
  if (won && r.promises && p.politics) p.politics.promises = r.promises;
  return result(won, text, won ? 'good' : 'bad', { night });
}

/** Pulls out of the race. What has been spent is spent. */
export function withdraw() {
  const p = player();
  const r = race();
  if (!r) return result(false, '', 'neutral');
  const o = office(r);
  delete p.flags.race;
  const text = `You have withdrawn from the race for ${o.title}.`;
  log(text, 'system', 'neutral');
  return result(true, text, 'neutral');
}

/**
 * Plays out whatever is left of a race without further choices: used when
 * the year turns on an unfinished campaign, and by campaign() below.
 * @param {{platform?:string, budget?:string, moves?:string[]}} [plan]
 */
export function finishRace(plan = {}) {
  const p = player();
  let r = race();
  if (!r) return result(false, '', 'neutral');
  if (r.countryId !== p.countryId || p.legal.incarceration) { delete p.flags.race; return result(false, 'Your campaign is over.', 'neutral'); }
  if (r.stage === 'nomination') { const n = seekNomination('members'); if (!n.ok) { afterDefeat(false); return n; } }
  if (r.stage === 'defeated') return afterDefeat(false);
  if (r.stage === 'plan') {
    const s = setPlan(plan.platform ?? 'jobs', plan.budget ?? 'shoestring');
    if (!s.ok) { withdraw(); return s; }
  }
  // 'debate' as a move is the old way of asking for one; the debate now happens of itself.
  const moves = (plan.moves ?? []).filter((m) => m !== 'debate' && TRAIL.some((t) => t.id === m));
  const late = moves.filter((m) => TRAIL.find((t) => t.id === m).last);
  const early = moves.filter((m) => !late.includes(m));
  for (let guard = 0; guard < 12 && (r = race()) && r.stage !== 'vote'; guard++) {
    if (r.stage === 'debate') { debateInfo(); while (race()?.stage === 'debate') answer('straight'); continue; }
    const lastRound = r.round === ROUNDS.length - 1;
    const want = lastRound && late.length ? late[0] : early.length ? early[r.round % early.length] : 'doors';
    const done = act(want, 'workers');
    if (!done.ok) act('doors');
  }
  return pollingDay();
}

// ---------- One call for the whole thing ----------

/**
 * Fights a whole campaign in one go, making the plain choice at every turn.
 * In a one-party state there are no voters to win: the committee decides.
 * @param {string} officeId
 * @param {{platform?:string, budget?:string, moves?:string[]}} plan
 */
export function campaign(officeId, plan = {}) {
  if (system().kind === 'party') return committee(officeId, plan);
  const d = declare(officeId);
  if (!d.ok) return d;
  return finishRace(plan);
}

/** A one-party state: the committee meets behind closed doors, and a name comes out. */
function committee(officeId, plan) {
  const p = player();
  const c = country();
  const o = offices(c).find((x) => x.id === officeId);
  if (!o) return result(false, 'There is no such office here.', 'neutral');
  const why = barrier(o);
  if (why) return result(false, why, 'neutral');
  const budget = BUDGETS.find((b) => b.id === plan.budget) ?? BUDGETS[0];
  const cost = localMoney(o.cost * budget.times, c);
  if (p.finance.cash < cost) return result(false, 'You cannot afford that campaign.', 'neutral');
  p.finance.cash -= cost;
  p.flags.campaignAge = p.age;
  let score = standing(o) + budget.boost;
  const notes = [];
  let caught = false;
  for (const id of (plan.moves ?? []).slice(0, 2)) {
    const m = MOVES.find((x) => x.id === id);
    if (!m) continue;
    let gain = rng.int(m.boost[0], m.boost[1]);
    if (m.factor) gain += ((m.factor === 'discipline' ? p.hidden.discipline : p.stats[m.factor]) - 50) / 8;
    if (m.karma) p.hidden.karma = clamp(p.hidden.karma + m.karma);
    if (m.illegal && rng.chance(clamp(0.55 - c.living.graft / 150, 0.08, 0.5))) { caught = true; gain = -20; p.legal.heat = clamp(p.legal.heat + 35); notes.push('The envelopes were filmed changing hands. The police would like a word.'); }
    else notes.push(m.text);
    score += gain;
  }
  const won = score > 50 + rng.int(-14, 14) + rng.int(-10, 10);
  p.counters.polExp = (p.counters.polExp ?? 0) + 1;
  const told = notes.length ? ` ${notes.join(' ')}` : '';
  let text;
  if (won) {
    p.counters.electionsWon = (p.counters.electionsWon ?? 0) + 1;
    takeOffice(o, caught ? 40 : 58);
    p.stats.mood = clamp(p.stats.mood + 14);
    text = `The committee met behind closed doors, and your name came out. You are ${o.title}.${told} It cost you ${fmtMoney(cost, c)}.`;
    if (o.fullTime) text += ' It is a full-time job, and you have left your old one.';
  } else {
    p.counters.electionsLost = (p.counters.electionsLost ?? 0) + 1;
    p.stats.mood = clamp(p.stats.mood - 10);
    text = `The committee chose someone else for ${o.title}. You applaud with everyone else.${told} It cost you ${fmtMoney(cost, c)}.`;
  }
  log(text, 'system', won ? 'good' : 'bad');
  return result(won, text);
}

// Public life around the work: agents, publicists, interviews and appearances,
// what the press writes (and how true it is), privacy, and brand deals.
//
//   p.fame.publicist:  { npcId, since, fee } | null
//   p.fame.offers:     [{ id, kind, outletId, productionId?, year, status }]   interviews, premieres, appearances
//   p.fame.deals:      [{ id, brand, years, fee, from, status, paidYears[] }]   endorsements
//
// The press can be wrong. Each story keeps whether it is true (a fact about the
// world) and how it was reported (verified, rumor, speculation). Nothing the
// player or a publicist does changes what is true: they can only answer it.
import { rng } from '../rng.js';
import { clamp, fmtMoney, localWage, uid } from '../util.js';
import { store, player, country, livingNpcs, log, milestone } from '../state.js';
import { BRANDS, AGENT_COMMISSION, PUBLICIST_FEE, ACCURACY, STAGE_BAR } from '../data/fame.js';
import { ensureTerms, look, offered, clearOffer, triesLeft, askLowerCut } from './agents.js';
import { fameOf, gain, regard, recognitionIn, exists } from './fame.js';
import { ent, org, orgsOf, production, workOf, proCredits, playerSkill, article, pool, stageTraining } from './entertainment.js';
import { makeNpc } from './npcFactory.js';
import { canFit } from './worklife.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const year = () => store.state.year;
const K = (base) => Math.round(localWage(base, country()));
const pr = (p = player()) => { const f = workOf(p); f.publicist ??= null; f.offers ??= []; f.deals ??= []; return f; };

// ---------- Representation ----------

/** What an agent sees in someone: their record, their skill, and who knows them. */
// Agents come to the showcases of the conservatories, and take training into account (STAGE_BAR.agents).
const trainingSeen = (p) => (STAGE_BAR.agents[stageTraining(p)] ?? 0) + (['original', 'classic'].includes(p.flags.showcase) ? STAGE_BAR.agents.showcase : 0);
export const standing = (p = player()) => Math.round(trainingSeen(p) + proCredits(p) * 6 + Math.max(playerSkill({ 'talents.acting': 1 }), playerSkill({ 'talents.singing': 0.5, 'talents.dance': 0.5 })) / 3 + recognitionIn(p.countryId, p) / 2 + fameOf(p).credibility / 4);

/** Agents who would take the player on now. */
export function agentsWilling(p = player()) {
  orgsOf(p.countryId);
  const s = standing(p);
  return Object.values(ent().orgs).filter((o) => o.kind === 'agency' && o.countryId === p.countryId)
    .flatMap((o) => o.staff.map((id) => ({ org: o, npc: store.state.npcs[id] })))
    .filter((x) => x.npc?.alive && x.npc.flags.agent && x.npc.flags.agent.standard <= s)
    .map((x) => { ensureTerms(x.npc, x.org.tier); return x; });
}

/** Looks for an agent: one agent who would take you on, with their terms and their clients. Twice a year. */
export function findAgent() {
  const p = player();
  if (p.age < 16 && !p.flags.guardianWork) return result(false, 'A parent or guardian has to agree first.', 'neutral');
  const willing = agentsWilling(p).filter((x) => x.npc.id !== pr(p).agent?.npcId);
  const r = look('talent', willing.map((x) => x.npc), p);
  if (r.error) return result(false, r.error, 'neutral');
  if (r.none) return result(false, willing.length ? 'Nobody new will see you this year.' : 'No agent will take you on yet. Credits, skill and a little recognition change that.', 'neutral');
  const a = r.agent.flags.agent;
  return result(true, `${r.agent.firstName} ${r.agent.lastName} at ${ent().orgs[a.orgId]?.name} would take you on, for ${Math.round(a.commission * 100)}%.`, 'neutral');
}
export const agentOnOffer = () => offered('talent');
export const agentTriesLeft = () => triesLeft('talent');
export function passOnAgent() { clearOffer('talent'); return result(true, 'You thank them and say no.', 'neutral'); }

export function signAgent(npcId) {
  const p = player();
  const f = pr(p);
  if (p.age < 16 && !p.flags.guardianWork) return result(false, 'A parent or guardian has to agree first.', 'neutral');
  const x = agentsWilling(p).find((a) => a.npc.id === npcId);
  if (!x) return result(false, 'They are not taking you on.', 'neutral');
  if (f.agent?.npcId === npcId) return result(false, 'They already represent you.', 'neutral');
  const terms = ensureTerms(x.npc, x.org.tier);
  if (f.agent) endAgent();
  f.agent = { npcId, orgId: x.org.id, since: year(), commission: terms.commission ?? AGENT_COMMISSION, clout: terms.clout ?? 1 };
  clearOffer('talent');
  x.npc.flags.agent.clients.push('player');
  if (!p.npcIds.includes(npcId)) { x.npc.role = 'colleague'; x.npc.flags.title = `Your agent, at ${x.org.name}`; x.npc.age = year() - (x.npc.flags.star?.born ?? year() - x.npc.age); p.npcIds.push(npcId); }
  else x.npc.flags.title = `Your agent, at ${x.org.name}`;
  x.npc.lastInteractionAge = p.age;
  const text = `${x.npc.firstName} ${x.npc.lastName} at ${x.org.name} represents you now, for ${Math.round(f.agent.commission * 100)}% of what you earn through them.`;
  log(text, 'system', 'good');
  return result(true, text);
}

/** Asks the agent for a smaller cut, once a year: a client who is worth it gets it. */
export function askAgentCut() {
  const p = player();
  const f = pr(p);
  const r = askLowerCut('talent', f.agent, standing(p) - 20, p);
  if (r.dropped) endAgent();
  return r;
}

export function endAgent() {
  const f = pr();
  if (!f.agent) return result(false, 'You have no agent.', 'neutral');
  const n = store.state.npcs[f.agent.npcId];
  if (n) { n.flags.title = 'Your former agent'; n.flags.agent.clients = n.flags.agent.clients.filter((c) => c !== 'player'); }
  f.agent = null;
  return result(true, 'You and your agent part ways. Contracts already signed still pay them their share.', 'neutral');
}

// ---------- A publicist ----------

export function hirePublicist() {
  const p = player();
  const f = pr(p);
  if (f.publicist) return result(false, 'You already have a publicist.', 'neutral');
  if (recognitionIn(p.countryId, p) < 15) return result(false, 'There is not yet enough interest in you for a publicist to manage.', 'neutral');
  const n = makeNpc({ role: 'colleague', countryId: p.countryId, age: rng.int(28, 55), relationship: 55 });
  n.occupation = 'publicist';
  n.flags.title = 'Your publicist';
  store.state.npcs[n.id] = n;
  p.npcIds.push(n.id);
  f.publicist = { npcId: n.id, since: year(), fee: K(PUBLICIST_FEE) };
  return result(true, `${n.firstName} ${n.lastName} handles your press now, for ${fmtMoney(f.publicist.fee, country())} a year. They cannot change what happened; they can help you say it well.`);
}
export function letPublicistGo() {
  const f = pr();
  if (!f.publicist) return result(false, 'You have no publicist.', 'neutral');
  const n = store.state.npcs[f.publicist.npcId];
  if (n) n.flags.title = 'Your former publicist';
  f.publicist = null;
  return result(true, 'You let your publicist go.', 'neutral');
}

export function setPrivacy(level) {
  fameOf().privacy = level;
  return result(true, { open: 'You talk about your life freely.', guarded: 'You talk about your work, and keep the rest to yourself.', private: 'You keep your private life private, and say so.' }[level], 'neutral');
}

// ---------- Interviews and appearances ----------

const APPEARANCES = {
  interview: { name: 'A press interview', medium: 'publishing', min: 6 },
  magazine: { name: 'A magazine feature', medium: 'publishing', min: 15 },
  talk_show: { name: 'A television talk show', medium: 'tv', min: 25 },
  podcast: { name: 'A podcast interview', medium: 'digital', min: 10 },
  premiere: { name: 'The premiere', medium: 'film', min: 0 },
  gala: { name: 'A charity gala', medium: 'stage', min: 20 },
  convention: { name: 'A fan convention', medium: 'tv', min: 30 },
};
export { APPEARANCES };

/** Invitations that come out of the year's work and recognition. Made once a year. */
export function makeOffers(p = player()) {
  const f = pr(p);
  if (f.offersYear === year()) return;
  f.offersYear = year();
  f.offers = f.offers.filter((o) => o.status === 'open' && o.year >= year() - 0).slice(-6);
  const known = recognitionIn(p.countryId, p);
  const outlets = orgsOf(p.countryId).filter((x) => x.kind === 'outlet');
  // A premiere for anything of the player's out this year.
  for (const c of f.credits.filter((x) => production(x.productionId)?.reception?.year === year())) {
    const prod = production(c.productionId);
    if (['film', 'tv'].includes(prod.kind) && prod.tier !== 'student') f.offers.push({ id: uid('inv'), kind: 'premiere', productionId: prod.id, year: year(), status: 'open' });
  }
  for (const [kind, a] of Object.entries(APPEARANCES)) {
    if (kind === 'premiere' || !exists(a.medium) || known < a.min) continue;
    if (rng.chance(clamp((known - a.min) / 60 + fameOf(p).attention / 150, 0.05, 0.7))) f.offers.push({ id: uid('inv'), kind, outletId: rng.pick(outlets)?.id ?? null, year: year(), status: 'open' });
  }
}

/** Says yes to an invitation. How it goes depends on the person, and luck; it reaches the audience it reaches. */
export function attend(offerId) {
  const p = player();
  const f = pr(p);
  const o = f.offers.find((x) => x.id === offerId && x.status === 'open');
  if (!o) return result(false, 'That invitation has passed.', 'neutral');
  o.status = 'attended';
  const a = APPEARANCES[o.kind];
  const pub = f.publicist ? 0.08 : 0;
  const went = rng.chance(clamp(0.55 + (p.stats.charm - 50) / 120 + pub, 0.15, 0.95));
  const prod = production(o.productionId);
  const audience = o.kind === 'premiere' ? (prod?.kind === 'tv' ? 'tv' : 'film') : o.kind === 'talk_show' || o.kind === 'convention' ? 'tv' : o.kind === 'podcast' ? 'digital' : 'public';
  gain({ audience, amount: went ? (o.kind === 'talk_show' ? 4 : 2) : 1, why: a.name.toLowerCase() }, p);
  regard({ favor: went ? 1 : -2, why: a.name.toLowerCase() }, p);
  const outlet = org(o.outletId);
  const who = `${p.firstName} ${p.lastName}`;
  const where = a.name.toLowerCase().replace(/^an? /, '');
  const good = [`${who} on the ${where}: warm, funny, and more thoughtful than expected.`, `${who} talks work, nerves and the part that changed everything.`,
    `Ten minutes with ${who}, who turns out to be a very good listener.`, `${who} was the highlight of the ${where}.`, `"I still cannot believe I get to do this": ${who} on the ${where}.`];
  const flat = [`${who} gave ${a.name.toLowerCase()} that never quite got going.`, `A guarded ${who} said little of note on the ${where}.`, `${who} seemed tired, and the ${where} showed it.`];
  const story = o.kind === 'premiere' ? `${who} at the premiere of ${prod?.title}.` : rng.pick(went ? good : flat);
  article({ kind: o.kind === 'premiere' ? 'event' : 'interview', outletId: outlet?.id, productionId: o.productionId, about: 'player', accuracy: 'verified', text: story });
  if (o.kind === 'premiere' && prod) {
    // Everyone from the production is there.
    for (const r of prod.cast) if (r.who && r.who !== 'player') { const n = store.state.npcs[r.who]; if (n && p.npcIds.includes(n.id)) n.meters.relationship = clamp(n.meters.relationship + 3); }
    if (!p.milestones.some((m) => /premiere/i.test(m.text))) milestone(`Walked the red carpet at the premiere of ${prod.title}.`, 'fame');
  }
  return result(went, o.kind === 'premiere' ? `You walk the carpet at the premiere of ${prod?.title}. Flashbulbs, a few questions, your castmates. ${went ? 'It is a good night.' : 'You are glad when it is over.'}`
    : went ? `${a.name} goes well. People who had not heard of you have now.` : `${a.name} does not go especially well. It will be forgotten soon enough.`);
}

export function declineOffer(offerId) {
  const o = pr().offers.find((x) => x.id === offerId && x.status === 'open');
  if (!o) return result(false, 'That invitation has passed.', 'neutral');
  o.status = 'declined';
  return result(true, 'You say no, politely. Nobody is owed your time.', 'neutral');
}

// ---------- Rumors, and answering them ----------

/**
 * Now and then the press prints something about a known person that may or may not be true.
 * What is true is decided by the state of the world, not by the story.
 */
export function maybeRumor(p = player()) {
  const known = recognitionIn(p.countryId, p);
  if (known < 25 || !rng.chance(clamp(known / 250 + fameOf(p).attention / 300, 0, 0.3))) return null;
  const partner = livingNpcs().find((n) => ['partner', 'spouse'].includes(n.role));
  const colleague = livingNpcs().find((n) => n.role === 'colleague' && n.flags.workedWith);
  const kinds = [];
  if (colleague) kinds.push(['romance', `Are ${p.firstName} ${p.lastName} and ${colleague.firstName} ${colleague.lastName} more than co-stars?`, partner?.id === colleague.id]);
  kinds.push(['feud', `Friction on set? Insiders say ${p.firstName} ${p.lastName} is difficult to work with.`, false]);
  kinds.push(['casting', `${p.firstName} ${p.lastName} is said to be in talks for a major new role.`, workOf(p).contracts.some((c) => c.status === 'offered')]);
  const [kind, text, isTrue] = rng.pick(kinds);
  // Privacy matters: a private person's life is reported on less, and never as fact.
  if (fameOf(p).privacy === 'private' && kind === 'romance' && rng.chance(0.6)) return null;
  return article({ kind: 'rumor', about: 'player', accuracy: kind === 'casting' ? 'speculation' : 'rumor', true: isTrue, text, topic: kind });
}

/** Answers a story: a clarification, or a request for a correction. Neither changes what is true. */
export function answer(articleId, how) {
  const p = player();
  const a = ent().articles.find((x) => x.id === articleId);
  if (!a || a.about !== 'player' || !['rumor', 'speculation', 'allegation'].includes(a.accuracy)) return result(false, 'There is nothing there to answer.', 'neutral');
  if (a.answered) return result(false, 'You have already answered it.', 'neutral');
  a.answered = how;
  const skilled = pr(p).publicist ? 0.15 : 0;
  if (how === 'ignore') return result(true, 'You say nothing. Most stories die of neglect.', 'neutral');
  if (how === 'correction') {
    if (a.true) return result(false, 'The outlet stands by the story: it is accurate. You cannot have a true story corrected.');
    a.corrected = true;
    article({ kind: 'correction', outletId: a.outletId, about: 'player', accuracy: 'correction', text: `Correction: an earlier report about ${p.firstName} ${p.lastName} was not accurate.` });
    regard({ favor: 3, why: 'a false story corrected' }, p);
    return result(true, 'The outlet prints a correction. Fewer people read it than read the story, but it is there.');
  }
  // A clarification: an honest one helps; a denial of something true is remembered when it comes out.
  if (a.true) { regard({ favor: -3, why: 'a denial of something true' }, p); a.denied = true; return result(false, 'You deny it. It is true, and some people know it; that will matter later.'); }
  regard({ favor: rng.chance(0.6 + skilled) ? 3 : 1, why: 'a clear answer to a false story' }, p);
  return result(true, 'You say, plainly, that it is not true. Most people believe you.');
}

// ---------- Endorsements ----------

/** A brand deal offered, when someone is known and liked enough. Once a year at most. */
/** The best-connected of the player's representatives: an agent, a manager, a modeling agency. They bring brand deals. */
export function bestRep(p = player()) {
  const reps = [pr(p).agent && { ...pr(p).agent, kind: 'agent' }, p.fame?.manager && { ...p.fame.manager, kind: 'manager' },
    p.fame?.model?.agencyId && p.fame.model.terms && { ...p.fame.model.terms, kind: 'agency' }].filter(Boolean);
  return reps.sort((a, b) => (b.clout ?? 1) - (a.clout ?? 1))[0] ?? null;
}

export function maybeDeal(p = player()) {
  const f = pr(p);
  const known = recognitionIn(p.countryId, p);
  const rep = bestRep(p);
  const clout = rep?.clout ?? 0;
  if (known < 30 - clout * 10 || fameOf(p).favor < 45 || f.dealYear === year() || !exists('commercial')) return null;
  if (!rng.chance(clamp((known - 25) / 120 + (fameOf(p).favor - 50) / 200 + clout * 0.08, 0.03, 0.6))) return null;
  f.dealYear = year();
  const d = { id: uid('deal'), brand: rng.pick(BRANDS), years: rng.int(1, 3), fee: K((4000 + known * known * 6) * (1 + clout * 0.25)), from: year() + 1, status: 'offered', paidYears: [], hours: 3,
    via: rep ? { npcId: rep.npcId, kind: rep.kind, commission: rep.commission } : null };
  f.deals.push(d);
  return d;
}
export function acceptDeal(id) {
  const f = pr();
  const d = f.deals.find((x) => x.id === id && x.status === 'offered');
  if (!d) return result(false, 'That offer has gone.', 'neutral');
  const fit = canFit(d.hours, { kind: 'freelance' });
  if (!fit.ok) return fit;
  d.status = 'signed';
  return result(true, `You are the face of ${d.brand} for ${d.years} ${d.years === 1 ? 'year' : 'years'}, for ${fmtMoney(d.fee, country())} a year: a few days' work a year, and your face on their adverts.`);
}
export function declineDeal(id) {
  const d = pr().deals.find((x) => x.id === id && x.status === 'offered');
  if (!d) return result(false, 'That offer has gone.', 'neutral');
  d.status = 'declined';
  return result(true, 'You say no. Your face stays your own.', 'neutral');
}
/** Payroll lines for brand deals: one a year, for the years under contract. */
export function dealLines(p = player()) {
  const lived = year() - 1;
  return pr(p).deals.filter((d) => d.status === 'signed' && lived >= d.from && lived < d.from + d.years && !d.paidYears.includes(lived))
    .map((d) => ({ source: `deal:${d.id}:${lived}`, label: `${d.brand} (brand deal${d.via ? `, after your ${d.via.kind}'s ${Math.round(d.via.commission * 100)}%` : ''})`, gross: Math.round(d.fee * (1 - (d.via?.commission ?? 0))), deal: d.id, year: lived }));
}
export function markDealsPaid(p = player()) {
  const lived = year() - 1;
  for (const d of pr(p).deals) if (d.status === 'signed' && lived >= d.from && lived < d.from + d.years && !d.paidYears.includes(lived)) d.paidYears.push(lived);
  for (const d of pr(p).deals) if (d.status === 'signed' && year() >= d.from + d.years) d.status = 'completed';
}

/** The publicist's fee, charged once a year. */
export function publicistFee(p = player()) { return pr(p).publicist ? pr(p).publicist.fee : 0; }

/** Once a year: invitations, a story or two, an offer from a brand. @returns {string[]} */
export function tickPress(p = player()) {
  const lines = [];
  const f = pr(p);
  if (f.publicist) {
    p.finance.cash -= f.publicist.fee;
    lines.push(`Your publicist's fee: ${fmtMoney(f.publicist.fee, country())}.`);
  }
  for (const o of f.offers) if (o.status === 'open' && o.year < year()) o.status = 'lapsed';
  makeOffers(p);
  const r = maybeRumor(p);
  if (r) lines.push(`A story in the press: "${r.text}" (${ACCURACY[r.accuracy].toLowerCase()})`);
  const d = maybeDeal(p);
  if (d) lines.push(`${d.brand} would like you as the face of their brand${d.via ? `; your ${d.via.kind} brought them to you` : ''}.`);
  // An agent whose client has not worked through them in two years lets them go.
  if (f.agent && f.agent.since <= year() - 2 && !f.contracts.some((c) => ['signed', 'completed', 'done'].includes(c.status) && c.age >= p.age - 2)) {
    const n = store.state.npcs[f.agent.npcId];
    lines.push(`${n ? `${n.firstName} ${n.lastName}` : 'Your agent'} has dropped you: two years without a job through them.`);
    endAgent();
  }
  // A relationship becomes news only if the person lives openly, or sometimes if they are guarded.
  const partner = livingNpcs().find((n) => ['partner', 'spouse'].includes(n.role) && !n.flags.inThePress);
  if (partner && recognitionIn(p.countryId, p) >= 20 && (fameOf(p).privacy === 'open' || (fameOf(p).privacy === 'guarded' && rng.chance(0.25)))) {
    partner.flags.inThePress = true;
    article({ kind: 'relationship', about: 'player', accuracy: 'verified', true: true, text: `${p.firstName} ${p.lastName} and ${partner.firstName} ${partner.lastName} are together.` });
    lines.push(`The press has found out about you and ${partner.firstName}.`);
  }
  return lines;
}
export { pool };

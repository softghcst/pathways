// The campaign, on screen: the nomination, the plan, the trail with its
// polls, the debate, and election night as the count comes in. The rules are
// in engine/campaign.js; a race put down here can be picked up again later.
import { country } from '../state.js';
import { esc, fmtMoney } from '../util.js';
import * as camp from '../engine/campaign.js';
import * as pol from '../engine/politics.js';
import { DEBATE_ANSWERS } from '../data/politics.js';
import { openModal, messageModal, pickModal, confirmModal } from './modals.js';

const num = (n) => Math.round(n).toLocaleString('en');
const GROUPS = { young: 'Younger voters', workers: 'Working households', professionals: 'Professionals and business', older: 'Older voters', rural: 'Rural and small towns' };

/** The polls so far, in a sentence. */
function pollLine(v) {
  if (!v.poll) return 'No poll has been published yet.';
  if (v.national) {
    const pub = v.polls.filter((x) => !x.own);
    return `${v.poll.own ? 'Your own poll' : 'The latest poll'}: ${v.poll.parties.map((x) => `${x.mine ? 'your party' : x.name} ${x.share}%`).join(', ')}, give or take ${v.poll.margin}.${pub.length > 1 ? ` Your party in the published polls so far: ${pub.slice(-4).map((x) => `${x.me}%`).join(' → ')}.` : ''}`;
  }
  const pub = v.polls.filter((x) => !x.own);
  const trend = pub.length > 1 ? pub.slice(-4).map((x) => `${x.me}%`).join(' → ') : null;
  const p = v.poll;
  return `${p.own ? 'Your own poll' : 'The latest poll'}: you ${p.me}%, ${v.rival?.name ?? 'your opponent'} ${100 - p.me}%, give or take ${p.margin}.${trend ? ` Published polls so far: ${trend}.` : ''}`;
}

/** Two bars, one for each candidate. */
function bars(rec, mine, theirs, note = '') {
  const total = Math.max(1, mine + theirs);
  const a = Math.round(mine / total * 1000) / 10;
  const b = Math.round((100 - a) * 10) / 10;
  return `<div class="pol-result"><span>You</span><span class="pol-track"><i style="width:${a}%;background:${rec.color}"></i></span><span class="num">${a}%</span><span class="num">${num(mine)}</span></div>
    <div class="pol-result"><span>${esc(rec.rival)}</span><span class="pol-track"><i style="width:${b}%;background:${rec.rivalColor}"></i></span><span class="num">${b}%</span><span class="num">${num(theirs)}</span></div>${note}`;
}

/** One screen of election night. Resolves when the player moves on. */
function nightStep(html, button) {
  return new Promise((resolve) => {
    const m = openModal(`${html}<button class="btn primary" data-ok style="margin-top:14px">${esc(button)}</button>`);
    m.el.querySelector('[data-ok]').addEventListener('click', () => { m.close(); resolve(); });
  });
}

/** A general election night: the exit poll, the seats as they are declared, and who will govern. */
export async function generalNight(rec) {
  const row = (x, n, of) => `<div class="pol-result"><span>${x.mine ? '<strong>' : ''}${esc(x.name)}${x.mine ? '</strong>' : ''}</span><span class="pol-track"><i style="width:${Math.round(n / of * 100)}%;background:${x.color}"></i></span><span class="num">${n}</span><span class="num">${x.mine ? 'yours' : ''}</span></div>`;
  await nightStep(`<div class="eyebrow">General election · ${rec.year}</div><h2>The polls have closed</h2>
    <p class="body">The last published poll had your party on ${rec.lastPoll ?? '?'}%. The exit poll says:</p>
    ${rec.exit.map((x) => `<div class="kv"><span>${x.mine ? '<strong>' : ''}${esc(x.name)}${x.mine ? ' (yours)</strong>' : ''}</span><span>${x.share}%</span></div>`).join('')}
    <p class="muted" style="margin-top:8px">${rec.need} seats of ${rec.seatCount} make a majority. Exit polls have been wrong before.</p>`, 'Watch the results');
  for (let i = 0; i < rec.batches.length; i++) {
    const b = rec.batches[i];
    const order = [...rec.parties].sort((x, y) => b.running[y.id] - b.running[x.id]);
    const mine = rec.parties.find((x) => x.mine);
    const lead = order[0];
    await nightStep(`<div class="eyebrow">${b.declared} of ${rec.seatCount} seats declared</div><h2>${esc(b.name)} ${i === 0 ? 'declare first' : 'have declared'}</h2>
      ${order.map((x) => row(x, b.running[x.id], rec.seatCount)).join('')}
      <p class="muted" style="margin-top:8px">${mine && lead.id === mine.id ? 'Your party is in front.' : `${esc(lead.name)} is in front.`} ${rec.need} needed for a majority.</p>`, i < rec.batches.length - 1 ? 'Next results' : 'The outcome');
  }
  const kind = { majority: 'a majority government', coalition: 'a coalition', minority: 'a minority government' }[rec.govt.kind] ?? rec.govt.kind;
  await nightStep(`<div class="eyebrow">${rec.year} · General election</div><h2>${rec.won ? `You are ${esc(rec.title)}` : rec.inGovt ? 'In government, but not leading it' : 'Your party has lost'}</h2>
    ${rec.parties.map((x) => `<div class="pol-result"><span>${x.mine ? '<strong>' : ''}${esc(x.name)}${x.mine ? '</strong>' : ''}</span><span class="pol-track"><i style="width:${x.share}%;background:${x.color}"></i></span><span class="num">${x.share}%</span><span class="num">${x.seats} seats</span></div>`).join('')}
    <div class="kv" style="margin-top:8px"><span>Votes cast</span><span>${num(rec.total)} (${rec.turnout}% turnout)</span></div>
    <div class="kv"><span>The government</span><span>${esc(rec.govt.head)}, ${esc(rec.govt.lead)}: ${kind}${rec.govt.partners.length ? ` with ${esc(rec.govt.partners.join(' and '))}` : ''}</span></div>`, 'Continue');
}

/** Election night: the exit poll, then each area as it declares, then the result. */
export async function electionNight(rec) {
  const them = esc(rec.rival);
  await nightStep(`<div class="eyebrow">Election Day · ${rec.year}</div><h2>The polls have closed</h2>
    <p class="body">${esc(rec.title)}. The last published poll had you on ${rec.lastPoll ?? '?'}%. The exit poll, taken outside polling stations, says:</p>
    <div class="pol-night"><strong>You ${rec.exit}%</strong><span>${them} ${100 - rec.exit}%</span></div>
    <p class="muted">Exit polls have been wrong before.</p>`, 'Watch the count');
  for (let i = 0; i < rec.batches.length; i++) {
    const b = rec.batches[i];
    const ahead = b.running.me > b.running.rival ? 'You are ahead.' : b.running.me < b.running.rival ? `${them} is ahead.` : 'It is level.';
    const local = b.votes.me >= b.votes.rival ? `You carried them, ${num(b.votes.me)} to ${num(b.votes.rival)}.` : `${them} carried them, ${num(b.votes.rival)} to ${num(b.votes.me)}.`;
    await nightStep(`<div class="eyebrow">The count · ${b.counted}% in</div><h2>${esc(b.name)} ${i === 0 ? 'declare first' : 'have declared'}</h2>
      <p class="body">${local}</p>
      <div class="section-label">Running total</div>${bars(rec, b.running.me, b.running.rival)}
      <p class="muted" style="margin-top:8px">${ahead}${i < rec.batches.length - 1 ? ` Still to come: ${rec.batches.slice(i + 1).map((x) => esc(x.name.toLowerCase())).join(', ')}.` : ''}</p>`, i < rec.batches.length - 1 ? 'Next declaration' : 'The result');
  }
  const order = Object.entries(rec.byGroup).sort((a, b) => b[1] - a[1]);
  await nightStep(`<div class="eyebrow">${rec.year} · ${esc(rec.title)}</div><h2>${rec.won ? 'You have won' : 'You have lost'}</h2>
    ${bars(rec, rec.votes.me, rec.votes.rival)}
    <div class="kv" style="margin-top:8px"><span>Votes cast</span><span>${num(rec.total)} (${rec.turnout}% turnout)</span></div>
    <div class="kv"><span>Margin</span><span>${num(Math.abs(rec.votes.me - rec.votes.rival))} votes</span></div>
    <div class="kv"><span>The last poll said</span><span>${rec.lastPoll ?? '?'}%${rec.lastPoll != null ? ` (out by ${Math.abs(Math.round((rec.share - rec.lastPoll) * 10) / 10)})` : ''}</span></div>
    ${rec.rigged ? '<p class="muted">These are the official figures.</p>' : ''}
    <div class="section-label">Who voted for you</div>
    ${order.map(([g, s]) => `<div class="kv"><span>${esc(GROUPS[g] ?? g)}</span><span>${s}%</span></div>`).join('')}`, 'Continue');
}

async function nomination(api) {
  const n = camp.nominationInfo();
  const pick = await pickModal({ title: `The ${n.party.name} nomination`, cancel: 'Decide later',
    body: `Before the voters, the party. ${n.rival.name}, ${n.rival.t.charisma >= 68 ? 'a natural on a platform' : n.rival.t.ambition >= 70 ? 'who has wanted this for years' : 'a long-serving local figure'}, wants to be its candidate for ${n.office.title} too.`,
    options: n.options.map((o) => ({ value: o.id, label: o.name, sub: o.sub, disabled: o.disabled })) });
  if (!pick) return false;
  const r = camp.seekNomination(pick);
  api.changed();
  await messageModal({ body: r.text, tone: r.tone });
  return true;
}

async function defeated(api) {
  const v = camp.view();
  const pick = await pickModal({ title: 'The party has chosen', cancel: 'Decide later', body: `${v.nominee} is the candidate. What will you do?`,
    options: [{ value: 'accept', label: 'Stand aside', sub: 'The party will remember that you took it well.' },
      { value: 'bolt', label: 'Leave the party and stand as an independent', sub: 'No machine behind you, a split vote, and no way back for a long time.' }] });
  if (!pick) return false;
  const r = camp.afterDefeat(pick === 'bolt');
  api.changed();
  await messageModal({ body: r.text, tone: r.tone });
  return true;
}

async function plan(api) {
  const c = country();
  const v = camp.view();
  const platform = await pickModal({ title: 'What do you stand for?', cancel: 'Decide later', body: 'One pledge to put on every leaflet. Different voters want different things.',
    options: camp.platformOptions().map((x) => ({ value: x.id, label: x.name, sub: x.sub })) });
  if (!platform) return false;
  const budget = await pickModal({ title: 'How much will you spend?', cancel: 'Decide later', body: 'It comes out of your own pocket. You can raise more, and spend more, along the way.',
    options: pol.budgets(v.office.id).map((b) => ({ value: b.id, label: b.name, sub: `${fmtMoney(b.cost, c)}. ${b.desc}`, disabled: !b.affordable })) });
  if (!budget) return false;
  const r = camp.setPlan(platform, budget);
  api.changed();
  await messageModal({ body: r.text, tone: r.tone });
  return r.ok;
}

async function trail(api) {
  const v = camp.view();
  const options = camp.trailOptions().map((m) => ({ value: m.id, label: m.name, sub: m.sub, disabled: m.disabled }));
  options.push({ value: 'withdraw', label: 'Withdraw from the race', sub: 'What you have spent is gone.' });
  const pick = await pickModal({ title: `${v.when}`, cancel: 'Put it down for now',
    body: `${v.national ? `The general election. You lead ${v.party?.name ?? 'your party'}; ${v.rival?.name ?? 'your opponent'}${v.rivalParty ? ` leads ${v.rivalParty.name}` : ''}.` : `${v.office.title}, against ${v.rival?.name ?? 'your opponent'}${v.rivalParty ? ` (${v.rivalParty.name})` : ''}.`} ${pollLine(v)} What will you do with this stretch of the campaign?`, options });
  if (!pick) return false;
  if (pick === 'withdraw') {
    if (!(await confirmModal({ title: 'Withdraw?', body: 'Your name comes off the ballot, and you cannot stand again this year.', yes: 'Withdraw', danger: true }))) return true;
    const r = camp.withdraw();
    api.changed();
    await messageModal({ body: r.text, tone: r.tone });
    return false;
  }
  let group;
  if (pick === 'target') {
    group = await pickModal({ title: 'Who will you court?', cancel: 'Back', body: 'A private poll will tell you who you most need.', options: camp.voterGroups().map((g) => ({ value: g.id, label: g.name })) });
    if (!group) return true;
  }
  const r = camp.act(pick, group);
  api.changed();
  const poll = r.poll && !r.poll.own ? ` The new poll: ${r.poll.parties ? 'your party' : 'you'} ${r.poll.me}%, give or take ${r.poll.margin}.` : '';
  await messageModal({ body: `${r.text}${r.ok ? poll : ''}`, tone: r.tone });
  return true;
}

async function debate(api) {
  let info = camp.debateInfo();
  if (info.n === 1) {
    const go = await pickModal({ title: 'The debate', cancel: 'Decide later', body: `${info.rival?.name ?? 'Your opponent'} has challenged you to a debate, live, with three questions from the public.`,
      options: [{ value: 'yes', label: 'Accept', sub: 'An hour under the lights, with nowhere to hide.' }, { value: 'no', label: 'Decline', sub: 'Safe from a bad night. An empty chair costs you something too.' }] });
    if (!go) return false;
    if (go === 'no') { const r = camp.duckDebate(); api.changed(); await messageModal({ body: r.text, tone: r.tone }); return true; }
  }
  while ((info = camp.debateInfo())) {
    let how = null;
    while (!how) {
      // Once on stage there is no walking off: every question gets an answer.
      how = await pickModal({ title: `Question ${info.n} of ${info.of}`, cancel: 'Take a breath', body: info.question, options: DEBATE_ANSWERS.map((a) => ({ value: a.id, label: a.name, sub: a.sub })) });
    }
    const r = camp.answer(how);
    api.changed();
    await messageModal({ body: r.text, tone: r.tone });
  }
  return true;
}

async function vote(api) {
  const r = camp.pollingDay();
  api.changed();
  if (r.night) await (r.night.national ? generalNight(r.night) : electionNight(r.night));
  await messageModal({ body: r.text, tone: r.tone });
  api.changed();
  return false;
}

/** Carries the race on from wherever it stands, until it is over or the player puts it down. */
export async function runCampaign(api) {
  for (let guard = 0; guard < 40; guard++) {
    const v = camp.view();
    if (!v) return undefined;
    const step = { nomination, defeated, plan, trail, debate, vote }[v.stage];
    if (!step || !(await step(api))) return undefined;
  }
  return undefined;
}

/** The race in progress, for the card on the Work tab. */
export function raceRows() {
  const v = camp.view();
  if (!v) return '';
  const stage = { nomination: 'Seeking your party\'s nomination', defeated: 'The party chose someone else', plan: 'Choosing what to stand for', trail: v.when, debate: 'The debate', vote: 'Election Day' }[v.stage];
  return `<div class="section-label">Your campaign</div>
    <div class="kv"><span>For</span><span><strong>${v.national ? 'The general election' : esc(v.office.title)}</strong></span></div>
    ${v.rival ? `<div class="kv"><span>Against</span><span>${esc(v.rival.name)}${v.rivalParty ? `, ${esc(v.rivalParty.name)}` : ''}</span></div>` : ''}
    <div class="kv"><span>Where it stands</span><span>${esc(stage)}</span></div>
    ${v.poll ? `<div class="kv"><span>${v.poll.own ? 'Your own poll' : 'Latest poll'}</span><span>${v.national ? 'Your party' : 'You'} ${v.poll.me}% (±${v.poll.margin})</span></div>` : ''}
    `;
}

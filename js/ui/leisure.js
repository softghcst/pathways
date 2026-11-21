// Flows for health care, cosmetic surgery, holidays, social media and
// emigrating. The Self and Pursuits tabs call into these.
import * as sys from '../engine/systems.js';
import * as econ from '../engine/economy.js';
import { player, country } from '../state.js';
import { fmtMoney, theCountry, esc } from '../util.js';
import { propertyTaxLabel, COUNTRIES } from '../data/countries.js';
import { summary, mayLeave } from '../engine/living.js';
import { roleLabel } from '../engine/relationships.js';
import * as med from '../engine/medical.js';
import * as fun from '../engine/activities.js';
import { CHARM_ACTIVITIES } from '../data/activities.js';
import * as clubs from '../engine/clubs.js';
import * as net from '../engine/social.js';
import * as move from '../engine/emigration.js';
import { messageModal, pickModal, confirmModal, inputModal, openModal } from './modals.js';
import { openAppearanceEditor } from '../avatar/editor.js';
import * as money from '../engine/currency.js';
import * as towns from '../engine/cities.js';

async function report(api, r) {
  api.changed();
  await messageModal({ body: r.text, tone: r.tone });
}

export async function seeDoctor(api) {
  const c = country();
  const list = med.treatable();
  const k = sys.cover();
  const pick = await pickModal({
    title: 'The doctor',
    body: `${k.model.name}. ${k.how} You pay ${Math.round(k.share * 100)}% of a bill.`,
    options: [
      ...list.map((x) => ({ value: x.id, label: `Treat your ${x.name.replace(/^an? /, '')}`, disabled: x.seen || !x.affordable || (x.manage && x.managed),
        sub: x.manage && x.managed ? 'Under control. Nothing more to do.' : x.seen ? 'Already seen this year.'
          : `${x.cost ? fmtMoney(x.cost, c) : 'Free'}${x.manage ? '. Cannot be cured, only managed.' : '.'}` })),
      { value: 'checkup', label: 'Have a check-up', sub: `${fmtMoney(med.careCost(200), c)}. Makes illness less likely next year.` },
      { value: 'therapy', label: 'See a therapist', sub: `${fmtMoney(med.careCost(1200), c)} for a year of sessions. Lifts your mood.` },
      ...(k.canBuy && !k.bought && !k.covered ? [{ value: 'insure', label: `Take out health insurance (${fmtMoney(k.price, c)} a year)`, sub: `You would pay ${Math.round(k.model.share * 100)}% of a bill, not all of it.` }] : []),
      ...(k.bought ? [{ value: 'uninsure', label: 'Cancel your health insurance', sub: k.premium ? `It costs you ${fmtMoney(k.premium, c)} a year.` : 'Your job covers you now; this is not costing you anything.' }] : []),
    ],
  });
  if (!pick) return undefined;
  if (pick === 'insure' || pick === 'uninsure') return report(api, sys.setCover(pick === 'insure'));
  if (pick === 'checkup') return report(api, med.checkUp());
  if (pick === 'therapy') return report(api, med.therapy());
  return report(api, med.seeDoctor(pick));
}

export async function cosmeticSurgery(api) {
  const c = country();
  const proc = await pickModal({
    title: 'Cosmetic surgery',
    body: 'It can raise your Charm. It can also go wrong, permanently.',
    options: med.surgeryOptions().map((s) => ({ value: s.id, label: s.name })),
  });
  if (!proc) return undefined;
  // Reshaping: choose the new proportions first, on your own face.
  let tweaks;
  if (proc === 'reshape') {
    const p = player();
    const next = await openAppearanceEditor({ title: 'Reshape your features', appearance: p.appearance, age: p.age, gender: p.gender, seed: p.id, scope: 'tweaks',
      confirm: 'Choose a surgeon', note: () => 'Eye spacing, eye size and height, nose and mouth size.' });
    if (!next) return undefined;
    tweaks = next.inherited.tweaks;
  }
  const surgeon = await pickModal({
    title: 'Who does it?',
    options: med.surgeonOptions(proc).map((s) => ({ value: s.id, label: s.name, disabled: !s.affordable,
      sub: `${s.blurb} ${fmtMoney(s.cost, c)}. Risk of it going wrong: ${s.risk}.` })),
  });
  return surgeon ? report(api, med.haveSurgery(proc, surgeon, tweaks)) : undefined;
}

export async function takeHoliday(api) {
  const c = country();
  const family = fun.companions();
  const kind = await pickModal({
    title: 'Take a vacation',
    body: `One a year. You have ${fmtMoney(player().finance.cash, c)}.`,
    options: fun.holidayKinds().map((k) => ({ value: k.id, label: k.name, sub: k.blurb })),
  });
  if (!kind) return undefined;
  let id; let trip = {};
  if (kind === 'flight') {
    const countryId = await pickModal({ title: 'Where to?',
      options: fun.flightDestinations().map((d) => ({ value: d.id, label: `${d.flag} ${d.name}`,
        sub: [d.family.length ? `${d.family.join(', ')} live${d.family.length === 1 ? 's' : ''} here.` : '', d.ownHome ? 'You have a place of your own to stay.' : '',
          d.visited ? 'You have been before.' : 'Somewhere new.'].filter(Boolean).join(' ') })) });
    if (!countryId) return undefined;
    const cabin = await pickModal({ title: 'Which seat?', body: 'The price covers the flights and two weeks there, for one.',
      options: fun.cabinOptions().map((k) => ({ value: k.id, label: k.name, sub: `${k.blurb} ${fmtMoney(k.cost, c)}.`, disabled: !k.affordable })) });
    if (!cabin) return undefined;
    const d = fun.flightDestinations().find((x) => x.id === countryId);
    let purpose = 'holiday';
    if (!move.rightToLive(countryId, player()) || d.family.length) {
      purpose = await pickModal({ title: 'What is the trip for?', options: [
        { value: 'holiday', label: 'A vacation', sub: 'Rest, and see the place.' },
        ...(d.family.length ? [{ value: 'family', label: `To see ${d.family.join(', ')}`, sub: 'Most of the two weeks with them. Brings you closer.' }] : []),
        ...(move.rightToLive(countryId, player()) ? [] : [{ value: 'scouting', label: 'To look, with a move in mind', sub: 'Less of a rest. Helps a later application to live there.' }]),
      ] });
      if (!purpose) return undefined;
    }
    id = 'flight'; trip = { countryId, cabin, purpose };
  } else {
    id = await pickModal({ title: fun.holidayKinds().find((k) => k.id === kind).name,
      options: fun.holidayOptions(kind).map((h) => ({ value: h.id, label: h.name, sub: `${fmtMoney(h.cost, c)} for one. ${h.note}`, disabled: !h.affordable })) });
    if (!id) return undefined;
  }
  let bring = false;
  if (family.length) {
    bring = await confirmModal({
      title: 'Bring the family?',
      body: `${family.map((n) => n.firstName).join(', ')} could come. It costs more for each person, and brings you closer.`,
      yes: 'Bring them', no: 'Go alone',
    });
  }
  return report(api, fun.holiday(id, bring, trip));
}

export async function openAccount(api) {
  const handle = await inputModal({ title: 'Open an account', label: 'Choose a username', value: player().firstName.toLowerCase(), maxLength: 20 });
  return handle ? report(api, net.createAccount(handle)) : undefined;
}

export async function buyFollowers(api) {
  const c = country();
  const amount = await pickModal({
    title: 'Buy followers',
    body: 'They are not real people. If too much of your audience is bought, someone may notice.',
    options: net.followerPacks().map((f) => ({ value: f.count, label: `${f.count.toLocaleString('en-US')} followers`, sub: fmtMoney(f.cost, c), disabled: !f.affordable })),
  });
  return amount ? report(api, net.buyFollowers(amount)) : undefined;
}

/** Moving to another city in the same country. */
export async function moveCity(api) {
  const c = country();
  const block = towns.moveBlock();
  if (block) return messageModal({ body: block });
  const now = towns.hereCity();
  const name = await pickModal({ title: 'Move to another city',
    body: `You live in ${now.name}${now.region && now.region !== now.name ? `, ${now.region}` : ''}: ${now.housingWord}, ${now.payWord}. Moving costs ${fmtMoney(towns.moveCost(), c)}. Your job comes too if your employer has a place for you there.`,
    options: towns.moveOptions().map((k) => ({ value: k.name, label: k.name, sub: `${k.line}. ${k.versus}${k.ownsHome ? ' You own a home here.' : ''}${k.lawDiffers ? ' Some laws differ.' : ''}` })) });
  if (!name) return undefined;
  const sure = await confirmModal({ title: `Move to ${name}?`, body: `It costs ${fmtMoney(towns.moveCost(), c)}. Property you own stays where it is.`, yes: 'Move' });
  return sure ? report(api, towns.relocate(name)) : undefined;
}

/** Simple once-a-year activities, keyed by id. */
export const quick = (api) => ({
  gym: () => report(api, fun.gym()),
  library: () => report(api, fun.library()),
  meditate: () => report(api, fun.meditate()),
  night: () => report(api, fun.nightOut()),
  holiday: () => takeHoliday(api),
  post: () => report(api, net.post()),
  ...Object.fromEntries(CHARM_ACTIVITIES.map((x) => [x.id, () => report(api, fun.charmActivity(x.id))])),
});

/** Money in other currencies: what is held, changing it, and the record of every exchange. */
export async function openCurrencies(api) {
  const c = country();
  const home = c.currency.code;
  const list = money.balances();
  const log = [...(player().finance.fxLog ?? [])].reverse().slice(0, 8);
  const pickFrom = await pickModal({
    title: 'Currencies',
    body: `Everyday money is in ${home}. You can hold other currencies too. Changing money costs ${(money.FX_FEE * 100).toFixed(1)}%. Rates here belong to the game, not the real world.`
      + (log.length ? ` Recent: ${log.slice(0, 3).map((e) => `${e.year}: ${money.fmt(e.paid, e.from)} → ${money.fmt(e.received, e.to)} at ${e.rate}`).join('; ')}.` : ''),
    options: list.map((b) => ({ value: b.code, label: `${money.fmt(b.amount, b.code)} in ${b.code}${b.home ? ' (everyday money)' : ''}`,
      sub: b.home ? 'Change some into another currency.' : `Worth about ${money.fmt(b.worth, home)} today.`, disabled: b.amount < 1 })),
    cancel: 'Close',
  });
  if (!pickFrom) return undefined;
  const have = list.find((b) => b.code === pickFrom).amount;
  // From everyday money: any currency. From an account: back into everyday money, or onwards.
  const targets = money.currencies().filter((x) => x.code !== pickFrom);
  const held = new Set(list.map((b) => b.code));
  const to = await pickModal({ title: `Change ${pickFrom} into`, options: targets.sort((a, b) => Number(held.has(b.code)) - Number(held.has(a.code)) || a.code.localeCompare(b.code))
    .map((x) => ({ value: x.code, label: `${x.code} (${x.symbol})`, sub: `1 ${pickFrom} buys ${money.rate(pickFrom, x.code).toPrecision(4)} ${x.code} today${x.code === home ? ' · your everyday money' : held.has(x.code) ? ' · you hold some' : ''}` })) });
  if (!to) return undefined;
  const part = await pickModal({ title: 'How much?', options: [0.1, 0.25, 0.5, 1].map((f) => ({ value: String(f), label: `${f === 1 ? 'All of it' : `${Math.round(f * 100)}%`}: ${money.fmt(Math.floor(have * f), pickFrom)}`,
    sub: `About ${money.fmt(Math.floor(money.convert(Math.floor(have * f), pickFrom, to) * (1 - money.FX_FEE)), to)} after the fee.`, disabled: Math.floor(have * f) < 1 })) });
  if (!part) return undefined;
  return report(api, money.exchange(pickFrom, to, Math.floor(have * Number(part))));
}

/** World news: what has happened in the world during this life, with what touches the player first. */
export function openNews() {
  const c = country();
  const o = econ.outlook();
  const all = econ.news(60);
  const row = (n) => `<div class="dyn-event"><span class="num">${n.year}</span><span>${n.flag} ${esc(n.text)}</span></div>`;
  const yours = all.filter((n) => n.yours).slice(0, 12);
  const rest = all.filter((n) => !n.yours).slice(0, 20);
  const m = openModal(`
    <h2>World news</h2>
    <div class="card"><h3>${esc(c.flag)} ${esc(c.name)}</h3>
      <div class="kv"><span>The economy</span><span><strong>${esc(o.name)}</strong>${o.since ? ` since ${o.since}` : ''}</span></div>
      <p class="muted" style="margin-top:6px">${esc(o.line)}</p></div>
    <div class="card"><h3>Where you have ties</h3>${yours.length ? yours.map(row).join('') : '<p class="muted">Nothing to report yet.</p>'}
      </div>
    <div class="card"><h3>Elsewhere</h3>${rest.length ? rest.map(row).join('') : '<p class="muted">A quiet world, so far.</p>'}</div>
    
    <button class="btn" data-close style="margin-top:14px">Close</button>`, { dismissable: true });
  m.el.querySelector('[data-close]').addEventListener('click', () => m.close());
}

/** Clubs and classes: find one to join, or look after a membership. */
export async function openClubs(api, id = 'find') {
  const c = country();
  if (id !== 'find') {
    const m = clubs.memberships().find((x) => x.id === id);
    if (!m) return undefined;
    const next = clubs.nextRank(id);
    const dues = clubs.duesOf(m.club);
    const friends = m.friends.length;
    const pick = await pickModal({ title: m.club.name.replace(/^(A|An|The) /, '').replace(/^./, (x) => x.toUpperCase()),
      body: `${m.club.blurb} You joined in ${m.since}${m.years ? ` and have been a member for ${m.years} ${m.years === 1 ? 'year' : 'years'}` : ''}. ${m.rankName === 'Member' ? 'You are a member.' : `You are ${m.rankName.toLowerCase()}.`} Dues: ${dues ? `${fmtMoney(dues, c)} a year` : 'nothing for you'}.${friends ? ` Friends made here: ${friends}.` : ''}`,
      cancel: 'Back',
      options: [...(next ? [{ value: 'stand', label: next.rank === 1 ? 'Stand for the committee' : `Stand for ${next.name.toLowerCase()}`, sub: next.why || 'The members vote. Charm and loyalty count.', disabled: !!next.why }] : []),
        { value: 'leave', label: 'Leave the club' }] });
    if (pick === 'stand') return report(api, clubs.standFor(id));
    if (pick === 'leave' && await confirmModal({ title: 'Leave?', body: m.rank ? 'Someone else will take your place on the committee.' : 'You can always join again.', yes: 'Leave', danger: true })) return report(api, clubs.leave(id));
    return undefined;
  }
  const kinds = clubs.clubOptions();
  const kind = await pickModal({ title: 'Clubs and classes', body: `Join and keep going: each year a club costs its dues, adds a little to what it is about, and brings people. Up to four at once.`,
    options: kinds.map((k) => ({ value: k.id, label: k.name, sub: `${k.clubs.filter((x) => !x.why).length} open to you of ${k.clubs.length}` })) });
  if (!kind) return undefined;
  const list = kinds.find((k) => k.id === kind).clubs;
  const pick = await pickModal({ title: kinds.find((k) => k.id === kind).name, cancel: 'Back',
    options: list.map((x) => ({ value: x.club.id, label: x.club.name.replace(/^./, (y) => y.toUpperCase()), disabled: !!x.why,
      sub: `${x.why || x.club.blurb} ${x.dues ? `· ${fmtMoney(x.dues, c)} a year` : x.why ? '' : '· free'}`.trim() })) });
  if (!pick) return openClubs(api);
  return report(api, clubs.join(pick));
}

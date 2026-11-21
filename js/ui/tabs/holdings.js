// Holdings tab: money, where you live, property, vehicles, investments and
// loans, with everything you can do about each.
import { careLine } from '../../engine/guardianship.js';
import * as sys from '../../engine/systems.js';
import { taxLine } from '../../engine/systems.js';
import { inheritanceLine, inheritanceShort, lawOf } from '../../engine/inheritance.js';
import { cityLine } from '../../engine/cities.js';
import { store, player, country } from '../../state.js';
import { esc, fmtMoney } from '../../util.js';
import { netWorth } from '../../engine/finance.js';
import * as estate from '../../engine/realEstate.js';
import * as cars from '../../engine/vehicles.js';
import * as mkt from '../../engine/market.js';
import * as bank from '../../engine/loans.js';
import { INVEST_AMOUNTS, BANK_LOAN, SECURITY_KINDS } from '../../data/securities.js';
import { localMoney } from '../../util.js';
import { propertyTaxLabel, COUNTRIES, COUNTRY_LIST } from '../../data/countries.js';
import { meterHtml } from '../meter.js';
import { openModal, messageModal, pickModal, confirmModal } from '../modals.js';
import * as last from '../../engine/death.js';
import * as money from '../../engine/currency.js';
import { openCurrencies } from '../leisure.js';
import { roleLabel } from '../../engine/relationships.js';
import { openMyMoney } from '../money.js';
import * as review from '../../engine/estateReview.js';
import { heirs as playableHeirs } from '../../engine/legacy.js';
import { bankWorth } from '../../engine/banking.js';
import { householdAnimalsHtml, openAnimalProfile, openHouseChronicle } from '../animals.js';
import { navRow, navGroup } from '../kit.js';

const GLYPH = { car: '🚗', cycle: '🚲', bike: '🏍️', boat: '⛵', plane: '✈️', property: '🏠', fund: '📈', stock: '📈', crypto: '🪙' };
const pct = (x) => `${x >= 0 ? '+' : ''}${Math.round(x * 100)}%`;
const kv = (rows) => rows.map(([a, b]) => `<div class="kv"><span>${esc(a)}</span><span>${esc(b)}</span></div>`).join('');

async function changeWill(api) {
  const mode = await pickModal({
    title: 'Your will',
    body: 'Who gets what you leave behind? Nothing is sold when you die: property and vehicles pass on as they are.',
    options: [
      { value: 'people', label: 'Choose the people', sub: 'Add or remove anyone. They share the money equally.', disabled: !last.willCandidates().length },
      { value: 'items', label: 'Who gets which property or vehicle', sub: 'Leave a particular house or car to a particular person.',
        disabled: !last.keepsakes().length || last.willHeirs().length < 2 },
      { value: 'alternate', label: 'Name an alternate', sub: 'Who takes a beneficiary\'s place if they die before you.', disabled: last.currentWill().mode !== 'named' },
      { value: 'heir', label: 'Who you would carry on as', sub: `${review.chosenHeir() ? `Now: ${review.chosenHeir().firstName}. ` : ''}Separate from who inherits.`, disabled: !playableHeirs().length },
      ...(review.notices().length ? [{ value: 'notices', label: `Things to review (${review.notices().length})`, sub: 'What has changed since you wrote it.' }] : []),
      { value: 'family', label: 'Tear it up', sub: 'Back to the default: a spouse takes half and your children share the rest.' },
      { value: 'charity', label: 'Everything to charity', sub: 'All of it is given away. No estate tax is paid.' },
    ],
  });
  if (!mode) return undefined;
  if (mode === 'family' || mode === 'charity') return report(api, last.writeWill(mode));
  if (mode === 'items') return assignKeepsakes(api);
  if (mode === 'alternate') {
    const heirs = last.willHeirs().map(([n]) => n);
    const who = await pickModal({ title: 'An alternate for whom?', options: heirs.map((n) => ({ value: n.id, label: `${n.firstName} ${n.lastName}`, sub: review.alternateOf(n.id) ? `Alternate: ${store.state.npcs[review.alternateOf(n.id)]?.firstName ?? 'nobody'}` : 'No alternate named' })) });
    if (!who) return undefined;
    const alt = await pickModal({ title: 'Who takes their place?', options: [{ value: 'none', label: 'Nobody', sub: 'Their share goes to the others named.' },
      ...last.willCandidates().filter((n) => n.id !== who).map((n) => ({ value: n.id, label: `${n.firstName} ${n.lastName}`, sub: `${roleLabel(n)}, age ${n.age}` }))] });
    if (!alt) return undefined;
    return report(api, review.setAlternate(who, alt === 'none' ? null : alt));
  }
  if (mode === 'heir') {
    const pick = await pickModal({ title: 'Carry on as', body: 'When your time comes, whose life would you step into? This does not change who inherits what.',
      options: [{ value: 'none', label: 'Decide when the time comes' }, ...playableHeirs().map((n) => ({ value: n.id, label: `${n.firstName} ${n.lastName}`, sub: `${roleLabel(n)}, age ${n.age}` }))] });
    if (!pick) return undefined;
    return report(api, review.chooseHeir(pick === 'none' ? null : pick));
  }
  if (mode === 'notices') {
    const id = await pickModal({ title: 'To review', options: review.notices().map((n) => ({ value: n.id, label: n.kind === 'review' ? `Since you wrote it: ${n.reasons.join(', ')}` : `${store.state.npcs[n.npcId]?.firstName ?? 'Someone'} ${n.kind === 'heir' ? 'whom you meant to carry on as, has died' : 'named in your will, has died'}`, sub: `${n.year} · mark as reviewed` })) });
    if (id) return report(api, review.resolveNotice(id, 'done'));
    return undefined;
  }
  // Add and remove people until the list is right.
  for (;;) {
    const heirs = last.willHeirs().map(([n]) => n);
    const others = last.willCandidates().filter((n) => !heirs.includes(n));
    const pick = await pickModal({
      title: 'Who inherits',
      body: heirs.length ? `${heirs.map((n) => n.firstName).join(', ')}: ${heirs.length === 1 ? 'everything' : `a ${['', '', 'half', 'third', 'quarter', 'fifth'][heirs.length] ?? `1/${heirs.length}`} each`}.` : 'Nobody yet.',
      options: [{ value: 'done', label: 'That is right', sub: 'Sign it.' },
        ...heirs.map((n) => ({ value: `-${n.id}`, label: `Remove ${n.firstName} ${n.lastName}`, sub: `${roleLabel(n)}, age ${n.age}` })),
        ...others.map((n) => ({ value: `+${n.id}`, label: `Add ${n.firstName} ${n.lastName}`, sub: `${roleLabel(n)}, age ${n.age}` }))],
    });
    if (!pick || pick === 'done') break;
    const r = pick[0] === '+' ? last.addHeir(pick.slice(1)) : last.removeHeir(pick.slice(1));
    api.changed();
    if (!r.ok) await messageModal({ body: r.text, tone: r.tone });
  }
  return messageModal({ body: `Your will is signed. ${last.willSummary()}` });
}

async function assignKeepsakes(api) {
  const c = country();
  for (;;) {
    const plan = last.estatePlan();
    const holder = (id) => plan.shares.find((s) => s.items.some((it) => it.id === id));
    const assetId = await pickModal({ title: 'Who gets what', body: 'Tap anything to leave it to someone else.',
      options: [{ value: 'done', label: 'That is right' }, ...last.keepsakes().map((a) => ({ value: a.id, label: `${GLYPH[a.vehicleClass] ?? GLYPH.property} ${a.name}`,
        sub: `${fmtMoney(a.value, c)} · goes to ${holder(a.id)?.name ?? 'nobody'}` }))] });
    if (!assetId || assetId === 'done') return undefined;
    const to = await pickModal({ title: 'Leave it to', options: last.willHeirs().map(([n]) => ({ value: n.id, label: `${n.firstName} ${n.lastName}`, sub: roleLabel(n) })) });
    if (to) { last.assignItem(assetId, to); api.changed(); }
  }
}

function willCard(c) {
  if (!last.canWriteWill()) return '';
  const e = last.estatePlan();
  const things = (s) => (s.items.length ? ` + ${s.items.map((it) => (it.kind === 'business' ? it.name : it.name.charAt(0).toLowerCase() + it.name.slice(1))).join(', ')}` : '');
  const rows = e.gross <= 0 && !e.shares.length ? [['To leave', 'Nothing yet']]
    : [['Estate tax', fmtMoney(e.tax, c)],
      ...e.shares.map((s) => [`${s.name} (${s.role.toLowerCase()})`, `${fmtMoney(s.amount, c)}${things(s)}`]),
      ...(e.charity ? [['To charity', fmtMoney(e.charity, c)]] : []), ...(e.lost ? [['Lost in the garden', fmtMoney(e.lost, c)]] : []), ...(e.toState ? [['To the state', fmtMoney(e.toState, c)]] : [])];
  return `<div class="card" style="margin-top:14px"><h3>Your will</h3>
    ${kv(rows)}
    <button class="btn" data-go="will" style="margin-top:10px">Change your will</button></div>`;
}

async function report(api, r) {
  api.changed();
  await messageModal({ body: r.text, tone: r.tone });
}

// ---------- Property ----------

async function browseProperty(api) {
  const c = country();
  const p = player();
  if (p.age < 18) return messageModal({ body: 'You need to be 18 to buy property.' });
  const where = await pickModal({ title: 'Browse property', options: [
    { value: 'here', label: `In ${p.city}`, sub: `Where you live. A mortgage is possible. Prices in ${c.currency.code}.` },
    { value: 'abroad', label: 'In another country', sub: 'Paid outright, in that country\'s money. Taxed there. Somewhere to stay when you visit, or to let.' }] });
  if (!where) return undefined;
  if (where === 'abroad') return browseAbroad(api);
  const list = estate.listings();
  const listing = await pickModal({
    title: 'Property for sale',
    body: `New listings every year. Buying costs 2% in fees. You have ${fmtMoney(p.finance.cash, c)}.`,
    options: list.map((l) => ({ value: l, label: `${l.name}: ${fmtMoney(l.price, c)}`, sub: `Condition: ${l.state} (${l.condition}%).` })),
  });
  if (!listing) return undefined;

  const t = estate.mortgageTerms(listing.price);
  const cash = p.finance.cash - listing.fees;
  const needed = Math.max(t.minDeposit, listing.price - t.maxLoan);
  const options = [];
  if (t.available && needed < listing.price) {
    for (const share of [0.1, 0.25, 0.5]) {
      const deposit = Math.max(needed, Math.round(listing.price * share));
      if (deposit >= listing.price || options.some((o) => o.value === deposit)) continue;
      const loan = listing.price - deposit;
      options.push({ value: deposit, label: `Mortgage with ${fmtMoney(deposit, c)} down`, disabled: cash < deposit,
        sub: `Borrow ${fmtMoney(loan, c)} at ${(t.rate * 100).toFixed(1)}% over ${t.years} years: ${fmtMoney(bank.yearlyPayment(loan, t.rate, t.years), c)} a year.` });
    }
  }
  options.push({ value: listing.price, label: 'Pay cash', disabled: cash < listing.price, sub: `${fmtMoney(listing.price, c)} plus ${fmtMoney(listing.fees, c)} in fees.` });
  const deposit = await pickModal({
    title: listing.name,
    body: t.available
      ? `On your household income a lender will offer up to ${fmtMoney(t.maxLoan, c)}, with at least ${fmtMoney(t.minDeposit, c)} down.`
      : t.reason,
    options,
  });
  if (deposit == null) return undefined;
  return report(api, estate.buyProperty(listing.id, deposit));
}

/** Buying in another country: pick the place, see prices in its money, pay from an account in it or by changing money. */
async function browseAbroad(api) {
  const c = country();
  const p = player();
  const held = money.balances().filter((b) => !b.home);
  const id = await pickModal({ title: 'Which country?', body: held.length ? `You hold ${held.map((b) => money.fmt(b.amount, b.code)).join(', ')} as well as ${fmtMoney(p.finance.cash, c)}.` : `You have ${fmtMoney(p.finance.cash, c)}. It will be changed at today's rate, less the bank's fee.`,
    options: COUNTRY_LIST.filter((k) => k.id !== p.countryId).sort((a, b) => a.name.localeCompare(b.name)).map((k) => ({ value: k.id, label: `${k.flag} ${k.name}`,
      sub: `${k.currency.code} · property tax ${propertyTaxLabel(k)} · inheritance tax ${inheritanceShort(k)}${(p.flags.visited ?? []).includes(k.id) ? ' · you have been there' : ''}` })) });
  if (!id) return undefined;
  const at = COUNTRIES[id];
  const city = at.cities.length > 1 ? await pickModal({ title: `Where in ${at.name}?`, body: 'Compared with the country as a whole.', options: at.cities.map((n) => ({ value: n, label: n, sub: cityLine(id, n) })) }) : at.cities[0];
  if (!city) return undefined;
  const list = estate.listingsAbroad(id, city);
  const l = await pickModal({ title: `For sale in ${city}`,
    body: `Prices in ${at.currency.code}. Fees are 5% for a buyer who does not live there. No lender there will give you a mortgage.`,
    options: list.map((x) => ({ value: x, disabled: !x.quote.ok, label: `${x.name}: ${money.fmt(x.price, x.code)}`,
      sub: `Condition: ${x.state} (${x.condition}%). With fees it would take ${[x.quote.fromAccount ? `${money.fmt(x.quote.fromAccount, x.code)} from your account` : '', x.quote.fromCash ? fmtMoney(x.quote.fromCash, c) : ''].filter(Boolean).join(' and ')}.` })) });
  if (!l) return undefined;
  const sure = await confirmModal({ title: `Buy the ${l.name.charAt(0).toLowerCase() + l.name.slice(1)}?`, yes: 'Buy',
    body: `${money.fmt(l.price, l.code)} plus ${money.fmt(l.fees, l.code)} in fees. ${l.quote.fromAccount ? `${money.fmt(l.quote.fromAccount, l.code)} comes from your ${l.code} account. ` : ''}${l.quote.fromCash ? `${fmtMoney(l.quote.fromCash, c)} is changed at today's rate; the bank keeps ${fmtMoney(l.quote.fee, c)}. ` : ''}Property tax and tax on any rent are paid in ${at.name}, and it is taxed there when you die.` });
  return sure ? report(api, estate.buyAbroad(l.id)) : undefined;
}

function openProperty(a, api) {
  const c = country();
  const p = player();
  const isHome = p.homeId === a.id;
  const rows = [
    ['Worth', estate.isAbroad(a) ? `${fmtMoney(a.value, c)} at today's rate` : fmtMoney(a.value, c)],
    ['You paid', `${fmtMoney(a.purchasePrice, c)} at age ${a.boughtAtAge}`],
    ['Mortgage', a.mortgage ? `${money.fmt(a.mortgage.principal, a.mortgage.code ?? c.currency.code)} left${a.mortgage.code && a.mortgage.code !== c.currency.code ? ` (about ${fmtMoney(estate.owedOn(a), c)})` : ''}, ${money.fmt(a.mortgage.payment, a.mortgage.code ?? c.currency.code)} a year for ${a.mortgage.yearsLeft} more years` : 'None'],
    ['Use', isHome ? 'You live here' : a.tenant ? `Let at ${money.fmt(a.tenant.rent, a.tenant.code ?? c.currency.code)} a year${a.tenant.code && a.tenant.code !== c.currency.code ? ` (about ${fmtMoney(estate.rentAtHome(a), c)})` : ''}` : 'Standing empty'],
    ['Running costs', `${fmtMoney(Math.round(a.value * estate.propertyTypeOf(a).upkeep), c)} a year`],
    ['Where', `${a.city ? `${a.city}, ` : ''}${estate.placeOf(a).name}`],
    ...(estate.isAbroad(a) ? [['Tax on rent', `${Math.round(estate.placeOf(a).incomeTax * 100)}%, paid in ${estate.placeOf(a).name}`], ['When you die', lawOf(estate.placeOf(a).id).kind === 'none' ? `No inheritance tax in ${estate.placeOf(a).name}` : `Taxed in ${estate.placeOf(a).name}: ${inheritanceLine(estate.placeOf(a))}`]] : []),
    ['Property tax', estate.propertyTaxOn(a) ? `${fmtMoney(estate.propertyTaxOn(a), c)} a year (${propertyTaxLabel(estate.placeOf(a))})` : `None in ${estate.placeOf(a).name}`],
  ];
  const acts = [];
  if (!isHome && !a.tenant && !estate.isAbroad(a)) acts.push(['movein', 'Move in']);
  if (!isHome && !a.tenant) acts.push(['let', `Find a tenant (about ${fmtMoney(estate.rentFor(a), c)} a year)`]);
  if (isHome) acts.push(['moveout', 'Move out and rent somewhere']);
  if (a.tenant) acts.push(['evict', 'Give the tenant notice']);
  if (a.condition < 95) acts.push(['renovate', `Renovate (${fmtMoney(estate.renovationCost(a.id), c)})`]);
  if (a.mortgage) acts.push(['payoff', `Pay off the mortgage (${money.fmt(a.mortgage.principal, a.mortgage.code ?? c.currency.code)})`]);
  acts.push(['sell', `Sell (you would keep ${fmtMoney(estate.saleProceeds(a), c)})`]);

  const m = openModal(`
    <h2>${esc(a.name)}</h2>
    ${kv(rows)}
    <div style="margin:12px 0 16px">${meterHtml('Condition', a.condition, true)}</div>
    <div class="btn-stack">
      ${acts.map(([id, label]) => `<button class="btn ${id === 'sell' || id === 'evict' ? 'danger' : ''}" data-act="${id}">${esc(label)}</button>`).join('')}
      <button class="btn" data-close>Close</button>
    </div>`, { dismissable: true });
  m.el.addEventListener('click', async (e) => {
    if (e.target.closest('[data-close]')) return m.close();
    const id = e.target.closest('[data-act]')?.dataset.act;
    if (!id) return undefined;
    m.close();
    if (id === 'sell') {
      const yes = await confirmModal({ title: `Sell the ${a.name.charAt(0).toLowerCase() + a.name.slice(1)}?`, body: `${estate.isAbroad(a) ? `It is paid in ${estate.currencyOfProperty(a)}, into your account in that currency. ` : ''}After fees${a.mortgage ? ' and the mortgage' : ''} you would keep ${fmtMoney(estate.saleProceeds(a), c)}.`, yes: 'Sell', danger: true });
      return yes ? report(api, estate.sellProperty(a.id)) : undefined;
    }
    const run = { movein: () => estate.moveIn(a.id), moveout: () => estate.moveOut(), let: () => estate.letOut(a.id),
      evict: () => estate.evict(a.id), renovate: () => estate.renovate(a.id), payoff: () => estate.payOffMortgage(a.id) }[id];
    return report(api, run());
  });
}

// ---------- Vehicles ----------

async function browseVehicles(api) {
  const c = country();
  const p = player();
  const listing = await pickModal({
    title: p.age >= 16 ? 'Vehicles for sale' : 'Bikes and boards for sale',
    body: `New and used, different every year. You have ${fmtMoney(p.finance.cash, c)}.`,
    options: cars.listings().map((l) => ({ value: l, label: `${GLYPH[l.cls]} ${l.name}: ${fmtMoney(l.price, c)}`, disabled: !!l.blocked,
      sub: l.blocked || `Condition ${l.condition}%.` })),
  });
  if (!listing) return undefined;
  const how = await pickModal({
    title: listing.name,
    options: [
      { value: 'cash', label: `Pay ${fmtMoney(listing.price, c)} in cash`, disabled: p.finance.cash < listing.price },
      ...(p.age >= 18 ? [{ value: 'loan', label: 'Buy it on finance', disabled: !listing.finance.approved,
        sub: listing.finance.approved ? `${fmtMoney(listing.finance.payment, c)} a year for ${BANK_LOAN.years} years, at a lower rate because it is secured on the vehicle. Miss the payments and it can be taken back.` : listing.finance.reason }] : []),
    ],
  });
  return how ? report(api, cars.buyVehicle(listing.id, how)) : undefined;
}

function openVehicle(a, api) {
  const c = country();
  const m = openModal(`
    <h2>${GLYPH[a.vehicleClass]} ${esc(a.name)}</h2>
    ${kv([['Worth', fmtMoney(a.value, c)], ['You paid', fmtMoney(a.purchasePrice, c)], ['Age', `${a.age} ${a.age === 1 ? 'year' : 'years'}`], ...(cars.loanOn(a) ? [['Still owed on it', `${fmtMoney(cars.loanOn(a).principal, c)}: the lender can take it back if the loan goes unpaid`]] : [])])}
    <div style="margin:12px 0 16px">${meterHtml('Condition', a.condition, true)}</div>
    <div class="btn-stack">
      <button class="btn" data-act="out">Take it out</button>
      ${a.condition < 95 ? `<button class="btn" data-act="service">Service it (${fmtMoney(cars.serviceCost(a), c)})</button>` : ''}
      <button class="btn danger" data-act="sell">Sell for ${fmtMoney(a.value, c)}${cars.loanOn(a) ? ` (${cars.saleNet(a) >= 0 ? `${fmtMoney(cars.saleNet(a), c)} after the loan` : `${fmtMoney(-cars.saleNet(a), c)} short of the loan`})` : ''}</button>
      <button class="btn" data-close>Close</button>
    </div>`, { dismissable: true });
  m.el.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) return m.close();
    const id = e.target.closest('[data-act]')?.dataset.act;
    if (!id) return undefined;
    m.close();
    return report(api, { out: () => cars.takeOut(a.id), service: () => cars.service(a.id), sell: () => cars.sellVehicle(a.id) }[id]());
  });
}

// ---------- Investments ----------

async function tradeSecurity(api, q) {
  const c = country();
  const cash = player().finance.cash;
  const options = INVEST_AMOUNTS.map((a) => localMoney(a, c)).filter((a) => a <= cash)
    .map((a) => ({ value: ['buy', a], label: `Buy ${fmtMoney(a, c)}` }));
  if (q.held) {
    options.push({ value: ['sell', 0.5], label: `Sell half (${fmtMoney(q.held / 2, c)})` },
      { value: ['sell', 1], label: `Sell all (${fmtMoney(q.held, c)})` });
  }
  if (!options.length) return messageModal({ body: 'You do not have enough spare cash to invest.' });
  const choice = await pickModal({
    title: q.name,
    body: `${q.blurb} Price ${fmtMoney(q.price, c)}, ${pct(q.change)} this year.${q.held ? ` You hold ${fmtMoney(q.held, c)} (${pct(q.gain)} overall).` : ''}`,
    options,
  });
  if (!choice) return undefined;
  return report(api, choice[0] === 'buy' ? mkt.buy(q.id, choice[1]) : mkt.sell(q.id, choice[1]));
}

async function browseMarket(api) {
  const c = country();
  if (player().age < 18) return messageModal({ body: 'You need to be 18 to invest.' });
  const all = mkt.quotes();
  const kind = await pickModal({
    title: 'The market',
    body: 'Prices move once a year.',
    options: SECURITY_KINDS.map((k) => {
      const held = all.filter((x) => x.kind === k.id && x.held).reduce((s, x) => s + x.held, 0);
      return { value: k.id, label: `${GLYPH[k.id]} ${k.name}`, sub: `${k.blurb}${held ? ` You hold ${fmtMoney(held, c)}.` : ''}` };
    }),
  });
  if (!kind) return undefined;
  const q = await pickModal({
    title: SECURITY_KINDS.find((k) => k.id === kind).name,
    options: all.filter((x) => x.kind === kind).map((x) => ({ value: x, label: x.name,
      sub: `${x.blurb} ${fmtMoney(x.price, c)} · ${pct(x.change)} this year${x.held ? ` · you hold ${fmtMoney(x.held, c)}` : ''}` })),
  });
  return q ? tradeSecurity(api, q) : undefined;
}

// ---------- Borrowing ----------

async function borrowMoney(api) {
  const c = country();
  const amount = await pickModal({
    title: 'Borrow from the bank',
    body: `${Math.round(BANK_LOAN.rate * 100)}% a year over ${BANK_LOAN.years} years. The bank looks at your income and what you already owe.`,
    options: bank.loanOptions().map((o) => ({ value: o.amount, label: fmtMoney(o.amount, c), disabled: !o.approved,
      sub: o.approved ? `${fmtMoney(o.payment, c)} a year.` : o.reason })),
  });
  return amount ? report(api, bank.borrow(amount)) : undefined;
}

/** My Money, with the screens it leads on to. Also opened from the purse at the top of the game. */
export const openMoney = (api) => openMyMoney(api, { invest: browseMarket, borrow: borrowMoney, will: changeWill });

/** Icons for the things to browse and do in Holdings. */
const HOLD_ICONS = { property: 'home', market: 'trophy', borrow: 'coin', currencies: 'globe', vehicles: 'compass', driving: 'id', flying: 'globe' };

export default {
  id: 'holdings', title: 'Holdings', short: 'Holdings',
  icon: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/>',
  render(el, api) {
    const p = player();
    const c = country();
    const f = p.finance;
    const debt = f.loans.reduce((s, l) => s + l.principal, 0) + p.assets.reduce((s, a) => s + estate.owedOn(a), 0) + (f.cards ?? []).reduce((s, k) => s + k.balance, 0);
    const home = estate.home();
    const living = careLine() ?? (home ? `In your ${home.name.charAt(0).toLowerCase() + home.name.slice(1)}` : p.flags.livesWithParents ? 'With your family'
      : p.education.enrolled && p.age >= 18 ? 'Student housing' : p.age >= 18 ? 'Renting' : 'With your family');

    const actions = [];
    if (p.age >= 18) actions.push(['property', 'Browse property'], ['market', 'Invest'], ['borrow', 'Borrow money'], ['currencies', 'Currencies']);
    if (p.age >= 3) actions.push(['vehicles', p.age >= 16 ? 'Browse vehicles' : 'Browse bikes and boards']);
    if (cars.canTakeDrivingTest()) actions.push(['driving', 'Take driving lessons and the test']);
    if (cars.canLearnToFly() && p.age >= 21) actions.push(['flying', 'Learn to fly']);

    const row = (a, glyph, sub, value) => `
      <button class="row" data-asset="${a.id}">
        <div class="avatar glyph">${glyph}</div>
        <div class="main"><strong>${esc(a.name)}</strong><small>${esc(sub)}</small></div>
        <div class="side">${fmtMoney(value, c)}</div>
      </button>`;
    const props = estate.properties().map((a) => row(a, GLYPH.property,
      `${estate.isAbroad(a) ? `In ${estate.placeOf(a).name} · ` : ''}${p.homeId === a.id ? 'Your home' : a.tenant ? 'Let to a tenant' : estate.isAbroad(a) ? 'Yours to stay in when you visit' : 'Empty'} · condition ${Math.round(a.condition)}%${a.mortgage ? ' · mortgaged' : ''}`, a.value)).join('');
    const vehs = cars.vehicles().map((a) => row(a, GLYPH[a.vehicleClass], `${a.age} yr old · condition ${Math.round(a.condition)}%`, a.value)).join('');
    const invs = mkt.quotes().filter((q) => q.held).map((q) => `
      <button class="row" data-security="${q.id}">
        <div class="avatar glyph">${GLYPH[q.kind]}</div>
        <div class="main"><strong>${esc(q.name)}</strong><small>${pct(q.change)} this year · ${pct(q.gain)} since you bought</small></div>
        <div class="side">${fmtMoney(q.held, c)}</div>
      </button>`).join('');
    const loans = f.loans.map((l) => `
      <div class="kv"><span>${esc(l.kind.charAt(0).toUpperCase() + l.kind.slice(1))} loan, ${l.yearsLeft} yr left</span>
        <span>${fmtMoney(l.principal, c)} ${l.kind !== 'student' || !p.education.enrolled ? `<button class="btn small" data-repay="${l.id}" ${f.cash < l.principal ? 'disabled' : ''} style="display:inline-flex;margin-left:6px">Pay off</button>` : ''}</span></div>`).join('');

    const earned = (p.career.salary || 0) + (p.career.partTime?.salary || 0) + (p.career.retired ? p.career.pensionPerYear : 0) + (p.flags.statePension ?? 0);
    const taxOn = earned > 0 ? sys.taxBreakdown(earned, c) : null;
    el.innerHTML = `
      <div class="worth-hero">
        <div><small>Net worth</small><strong class="num">${fmtMoney(netWorth(store.state), c)}</strong></div>
        <div><small>Cash</small><span class="num${f.cash < 0 ? ' neg' : ''}">${fmtMoney(f.cash, c)}</span></div>
      </div>
      ${navGroup([navRow({ attrs: 'data-go="mymoney"', label: 'My Money', ico: 'coin', tone: 'peach' })])}
      <div class="card">
        <h3>Earnings and taxes</h3>
        ${kv([...(bankWorth() ? [['In the bank', fmtMoney(bankWorth(), c)]] : []), ...money.balances().filter((b) => !b.home).map((b) => [`Held in ${b.code}`, `${money.fmt(b.amount, b.code)} (about ${fmtMoney(b.worth, c)})`]), ['Debts', fmtMoney(debt, c)]])}
        ${kv([['Where you live', living], ['Earned in your life', fmtMoney(f.lifetimeEarned, c)]])}
        <details class="more"><summary>Taxes and costs</summary>
        ${kv([['Tax paid in your life', fmtMoney(f.lifetimeTaxPaid, c)],
    ['Income tax', taxLine(c)], ...(taxOn ? [['On what you earn now', `${Math.round(taxOn.effective * 100)}% overall, ${Math.round(taxOn.marginal * 100)}% on extra income`]] : []), ['Health care', `${sys.cover().model.name}${sys.cover().covered ? '' : ' (you are not covered)'}`], ['Property tax', propertyTaxLabel(c)], ['Inheritance tax', inheritanceShort(c).replace(/^./, (x) => x.toUpperCase())],
    ...(estate.properties().some((a) => estate.isAbroad(a)) ? [['Property abroad', 'Taxed where it stands']] : []),
    ...(bank.isBankrupt() ? [['Bankrupt until age', String(p.flags.bankruptUntil)]] : [])])}</details>
      </div>
      ${navGroup(actions.map(([id, label]) => navRow({ attrs: `data-go="${id}"`, label, ico: HOLD_ICONS[id] ?? 'sparkle' })), 'Buy and invest')}
      ${householdAnimalsHtml()}
      ${props ? `<div class="section-label">Property</div>${props}` : ''}
      ${vehs ? `<div class="section-label">Vehicles</div>${vehs}` : ''}
      ${invs ? `<div class="section-label">Investments</div>${invs}` : ''}
      ${loans ? `<div class="card" style="margin-top:14px"><h3>Loans</h3>${loans}</div>` : ''}
      ${(p.inventory ?? []).length ? `<div class="section-label">Belongings</div>${p.inventory.map((it) => `<div class="kv"><span>${esc(it.name)}</span><span>${fmtMoney(it.value, c)}${it.condition != null ? ` · ${it.condition}% condition` : ''}</span></div>`).join('')}` : ''}
      ${willCard(c)}`;

    el.onclick = (e) => {
      const go = e.target.closest('[data-go]')?.dataset.go;
      const animal = e.target.closest('[data-animal]')?.dataset.animal;
      if (animal) return openAnimalProfile(api, animal);
      if (go === 'chronicle') return openHouseChronicle(api);
      if (go) {
        return { mymoney: () => openMoney(api), currencies: () => openCurrencies(api), property: () => browseProperty(api), vehicles: () => browseVehicles(api), market: () => browseMarket(api),
          borrow: () => borrowMoney(api), will: () => changeWill(api), driving: () => report(api, cars.takeDrivingTest()), flying: () => report(api, cars.learnToFly()) }[go]();
      }
      const repay = e.target.closest('[data-repay]')?.dataset.repay;
      if (repay) return report(api, bank.repayLoan(repay));
      const sec = e.target.closest('[data-security]')?.dataset.security;
      if (sec) return tradeSecurity(api, mkt.quotes().find((q) => q.id === sec));
      const id = e.target.closest('[data-asset]')?.dataset.asset;
      const a = p.assets.find((x) => x.id === id);
      if (a) return a.kind === 'property' ? openProperty(a, api) : openVehicle(a, api);
      return undefined;
    };
  },
};

// Pursuits tab: things to do, Digital Life, gambling, crime, moving abroad,
// and, when it goes wrong, life inside.
import { store, player, country } from '../../state.js';
import { openIdol } from '../kpop.js';
import { esc, fmtMoney, localMoney } from '../../util.js';
import * as kidLife from '../../engine/childhood.js';
import * as loveStories from '../../engine/loveStories.js';
import { canGamble } from '../../engine/gambling.js';
import { may } from '../../engine/rules.js';
import * as law from '../../engine/justice.js';
import * as jail from '../../engine/prison.js';
import { CRIME_BY_ID } from '../../data/crimes.js';
import { prisonHub, hubClick } from '../prisonHub.js';
import { legalCard, legalClick } from '../justice.js';
import { playBlackjack, playHorses, playLottery } from '../minigames/casino.js';
import { meterHtml } from '../meter.js';
import { messageModal, pickModal, confirmModal } from '../modals.js';
import * as fun from '../../engine/activities.js';
import * as clubLife from '../../engine/clubs.js';
import { openDigitalLife, digitalCard } from '../digital.js';
import * as bc from '../../engine/digital/broadcast.js';
import { canEmigrate } from '../../engine/emigration.js';
import * as leisure from '../leisure.js';
import { openExplore } from '../globalLife.js';
import { roleLabel } from '../../engine/relationships.js';
import { thisYearCard, thisYearAction } from '../thisYear.js';
import { openScreen } from '../animals.js';
import '../animalHub.js';
import * as riding from '../../engine/equestrian.js';
import { athleticsCard, openAthletics } from '../sports.js';
import { navRow, navGroup } from '../kit.js';
import { openNeighborhood, neighborhoodSub } from '../neighborhood.js';

async function report(api, r) {
  api.changed();
  await messageModal({ body: r.text, tone: r.tone });
}

async function commitCrime(api) {
  const id = await pickModal({
    title: 'Crime',
    body: 'Talent, brains and luck decide whether it works. Every crime wears your luck thinner and brings the police closer.',
    options: law.crimeOptions().map((c) => ({ value: c.id, label: c.name, sub: `Your chances: ${c.odds}. ${c.stakes}` })),
  });
  if (!id) return;
  let targetId;
  const how = {};
  if (CRIME_BY_ID[id].target) {
    const known = law.targets();
    const kind = await pickModal({ title: 'Who?', options: [
      { value: 'stranger', label: 'A stranger', sub: 'Whoever happens to be around this year.' },
      { value: 'known', label: 'Someone you know', sub: known.length ? 'They trust you, which makes it easier to get close.' : 'You do not know anyone.', disabled: !known.length },
    ] });
    if (!kind) return;
    if (kind === 'known') {
      targetId = await pickModal({ title: 'Who?',
        options: known.map((n) => ({ value: n.id, label: `${n.firstName} ${n.lastName}`, sub: `${roleLabel(n)}, age ${n.age}` })) });
      if (!targetId) return;
    } else {
      how.strangerId = await pickModal({ title: 'Who?', body: 'Different people every year.',
        options: law.strangerOptions().map((x) => ({ value: x.id, label: x.name.replace(/^./, (ch) => ch.toUpperCase()), sub: x.note })) });
      if (!how.strangerId) return;
    }
    how.methodId = await pickModal({ title: 'How?', body: 'Some ways are surer. Some are quieter. Some are neither.',
      options: law.methodOptions().map((m) => ({ value: m.id, label: m.name, sub: `${m.blurb} Your chances: ${m.odds}.` })) });
    if (!how.methodId) return;
  }
  const sure = await confirmModal({ title: `${CRIME_BY_ID[id].name}?`, body: 'There is no taking this back.', yes: 'Do it', danger: true });
  if (!sure) return;
  const r = law.commitCrime(id, targetId, how);
  await report(api, r);
  if (r.arrested) await api.justice();
}

async function joinGang(api) {
  const id = await pickModal({
    title: 'Join a gang',
    body: `Protection and standing, at the cost of your record inside. Your respect is ${Math.round(jail.cell().respect)}%.`,
    options: jail.gangOptions().map((g) => ({ value: g.id, label: g.name, disabled: !g.open,
      sub: g.open ? g.blurb : `${g.blurb} Needs ${g.respect}% respect.` })),
  });
  if (id) await report(api, jail.joinGang(id));
}

export default {
  id: 'pursuits', title: 'Pursuits', short: 'Pursuits',
  icon: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  render(el, api) {
    const p = player();
    const c = country();
    if (law.isJailed()) {
      el.innerHTML = prisonHub();
    } else {
      const gambled = p.counters.gambled * c.currency.scale;
      const things = fun.activityOptions();
      const grow = kidLife.childActivities();
      const jobs = kidLife.smallJobs();
      const safety = loveStories.teenSafety();
      const money = p.age >= 5 && p.age <= 17;
      const cc = p.flags.childhood ?? {};
      el.innerHTML = `
        ${thisYearCard()}
        ${grow.length ? `<div class="card"><h3>Growing up</h3>
          <p class="muted" style="margin-bottom:10px">${p.age < 6 ? 'A grown-up takes you to most of these.' : 'A few of these in a year: there is school too.'}</p>
          <div class="btn-stack">${grow.map((a) => `<button class="btn" data-kid="${a.id}" ${a.done ? 'disabled' : ''}>${esc(a.label)}${a.why ? ` · ${esc(a.why.toLowerCase())}` : ''}</button>`).join('')}</div>
        </div>` : ''}
        ${safety.length ? `<div class="card"><h3>Staying safe</h3>
          <p class="muted" style="margin-bottom:10px">Looking after yourself. Private, and free.</p>
          <div class="btn-stack">${safety.map((a) => `<button class="btn" data-kidsafe="${a.id}" ${a.done || a.why ? 'disabled' : ''}>${esc(a.label)}${a.done ? ' · done' : a.why ? ` · ${esc(a.why)}` : ''}</button>`).join('')}</div>
        </div>` : ''}
        ${money ? `<div class="card"><h3>Pocket money</h3>
          <p class="muted" style="margin-bottom:10px">${cc.allowance ? `You get ${fmtMoney(cc.allowance.amount, c)} a year.` : 'You have no allowance.'}${cc.saving ? ` Saving for ${esc(cc.saving.name)}: ${fmtMoney(Math.min(p.finance.cash, cc.saving.cost), c)} of ${fmtMoney(cc.saving.cost, c)}.` : ''}</p>
          <div class="btn-stack">
            ${kidLife.canAskAllowance() ? '<button class="btn" data-kidmoney="ask">Ask for an allowance</button>' : ''}
            ${p.age >= 6 ? `<button class="btn" data-kidmoney="chores" ${kidLife.canDoChores() ? '' : 'disabled'}>Do your chores${kidLife.canDoChores() ? '' : ' · done this year'}</button>` : ''}
            ${cc.saving ? `<button class="btn" data-kidmoney="buy" ${p.finance.cash >= cc.saving.cost ? '' : 'disabled'}>Buy ${esc(cc.saving.name)}</button>` : '<button class="btn" data-kidmoney="save">Save for something special</button>'}
            ${jobs.map((j) => `<button class="btn" data-kidjob="${j.id}" ${j.done ? 'disabled' : ''}>${esc(j.label)} <small>${fmtMoney(j.pay, c)}${j.why ? ` · ${esc(j.why.toLowerCase())}` : ''}</small></button>`).join('')}
          </div>
        </div>` : ''}
        <div class="section-label">Fun and hobbies</div>
        ${p.age >= 6 && !p.legal.incarceration ? `<div class="card"><h3>Clubs and classes</h3>
          <p class="muted" style="margin-bottom:10px">${clubLife.memberships().length ? 'Kept up year after year: dues each year, a little better at it, and the people you meet.' : 'Choirs, chess, running, pottery, debating, the scouts and more. Join, and keep going.'}</p>
          <div class="btn-stack">${clubLife.memberships().map((m) => `<button class="btn" data-club="${m.id}">${esc(m.club.name.replace(/^(A|An|The) /, '').replace(/^./, (x) => x.toUpperCase()))} · ${esc(m.rankName === 'Member' ? `member${m.years ? `, ${m.years} ${m.years === 1 ? 'year' : 'years'}` : ''}` : m.rankName.toLowerCase())}</button>`).join('')}
            <button class="btn primary" data-club="find">Find a club or class</button></div>
        </div>` : ''}
        ${things.some((a) => a.charm) ? `<div class="card"><h3>Charm and confidence</h3>
          <p class="muted" style="margin-bottom:10px">Charm ${p.stats.charm} · each once a year</p>
          <div class="btn-stack">${things.filter((a) => a.charm).map((a) => `<button class="btn" data-do="${a.id}" ${a.done ? 'disabled' : ''}>${esc(a.label)}${a.done ? ' · done this year' : ''}</button>`).join('')}</div>
        </div>` : ''}
        ${things.some((a) => !a.charm) ? `<div class="card"><h3>Things to do</h3>
          <div class="btn-pair">${things.filter((a) => !a.charm).map((a) => `<button class="btn" data-do="${a.id}" ${a.done ? 'disabled' : ''}>${esc(a.label)}${a.done ? ' · done this year' : ''}</button>`).join('')}</div>
        </div>` : ''}
        ${p.age >= 6 && !p.legal.incarceration ? navGroup([navRow({ attrs: 'data-go="riding"', label: 'Riding', ico: 'trophy',
          sub: p.riding ? `${riding.levelName(riding.riderLevel())} rider · ${p.riding.lessons} ${p.riding.lessons === 1 ? 'year' : 'years'} of lessons${p.riding.record.length ? ` · ${p.riding.record.length} ${p.riding.record.length === 1 ? 'show' : 'shows'}` : ''}` : '' })]) : ''}
        ${p.age >= 8 && !p.legal.incarceration && store.state.year >= 1999 ? navGroup([navRow({ attrs: 'data-go="photocards"', label: 'Photocards', ico: 'star',
          sub: p.fan ? `A fan of ${store.state.kpop?.groups[p.fan.groupId]?.name ?? 'a group'} · ${Object.values(p.fan.cards).reduce((t, n) => t + n, 0)} photocards${p.fan.sets.length ? ` · ${p.fan.sets.length} full ${p.fan.sets.length === 1 ? 'set' : 'sets'}` : ''}` : '' })]) : ''}
        ${(() => { const opts = bc.broadcastOptions(); return opts.length ? `<div class="card"><h3>Radio and television</h3><div class="btn-pair">${opts.map((o) => `<button class="btn" data-tune="${o.id}" ${o.done ? 'disabled' : ''}>${esc(o.label)}${o.done ? ' · done this year' : ''}</button>`).join('')}${p.age >= 16 ? opts.filter((o) => bc.setFor(o.id) === 'elsewhere').map((o) => `<button class="btn" data-buyset="${o.id === 'radio' ? 'radio_set' : 'tv_set'}">Buy a ${o.id === 'radio' ? 'radio' : 'television'} set of your own</button>`).join('') : ''}</div></div>` : ''; })()}
        ${digitalCard()}
        <div class="section-label">Where you live</div>
        ${p.age >= 3 && !p.legal.incarceration ? navGroup([navRow({ attrs: 'data-go="neighborhood"', label: 'My Neighborhood', ico: 'home', sub: neighborhoodSub() })]) : ''}
        ${navGroup([navRow({ attrs: 'data-go="travel"', label: 'Travel', ico: 'globe' })])}
        ${canEmigrate() ? `<div class="card"><h3>Moving</h3><p class="muted" style="margin-bottom:10px">You live in ${esc(p.city)}.</p><div class="btn-pair">${c.cities.length > 1 ? '<button class="btn" data-go="city">Move to another city</button>' : ''}<button class="btn" data-go="abroad">Move abroad</button></div></div>` : ''}
        <div class="section-label">Risky business</div>
        ${canGamble() ? `<div class="card"><h3>Gambling</h3>
          <div class="btn-pair">
            <button class="btn" data-play="blackjack">Blackjack</button>
            <button class="btn" data-play="horses">The races</button>
            <button class="btn" data-play="lottery">Lottery tickets</button>
          </div>
          ${gambled ? `<div class="kv" style="margin-top:10px"><span>Staked in your lifetime</span><span>${esc(fmtMoney(gambled, c))}</span></div>` : ''}
        </div>` : ''}
        ${law.canCommitCrimes() ? `<div class="card"><h3>Crime</h3>
          <div class="kv"><span>Police attention</span><span>${p.legal.heat >= 60 ? 'They are looking for you' : p.legal.heat >= 25 ? 'You are known to them' : 'None'}</span></div>
          ${p.flags.fugitive ? '<div class="kv"><span>Status</span><span>On the run</span></div>' : ''}
          <button class="btn danger" data-crime style="margin-top:8px">Commit a crime</button>
        </div>` : ''}
        ${legalCard()}
`;
    }
    // A heading with nothing under it (a child has no risky business) goes.
    el.querySelectorAll(':scope > .section-label').forEach((l) => { const n = l.nextElementSibling; if (!n || n.classList.contains('section-label')) l.remove(); });
    el.onclick = (e) => {
      if (law.isJailed()) return hubClick(e, api, joinGang);
      if (legalClick(e, api)) return undefined;
      const plan = e.target.closest('[data-year-plan]')?.dataset.yearPlan;
      if (plan) return thisYearAction(plan, api);
      const game = e.target.closest('[data-play]')?.dataset.play;
      if (game) return ({ blackjack: playBlackjack, horses: playHorses, lottery: playLottery })[game](api);
      if (e.target.closest('[data-crime]')) return commitCrime(api);
      if (e.target.closest('[data-digital]')) return openDigitalLife(api);
      const buyset = e.target.closest('[data-buyset]')?.dataset.buyset;
      if (buyset) return import('../../engine/digital/tech.js').then((t) => report(api, t.buyDevice(buyset)));
      const tune = e.target.closest('[data-tune]')?.dataset.tune;
      if (tune) {
        const opt = bc.broadcastOptions().find((o) => o.id === tune);
        return pickModal({ title: tune === 'radio' ? 'What do you listen to?' : 'What do you watch?', options: opt.programs.map((x) => ({ value: x.id, label: x.label })) })
          .then((pick) => (pick ? report(api, bc.tuneIn(tune, pick)) : undefined));
      }
      const kidAct = e.target.closest('[data-kid]')?.dataset.kid;
      if (kidAct) return report(api, kidLife.doActivity(kidAct));
      const kidSafe = e.target.closest('[data-kidsafe]')?.dataset.kidsafe;
      if (kidSafe) return report(api, loveStories.doTeenSafety(kidSafe));
      const kidJob = e.target.closest('[data-kidjob]')?.dataset.kidjob;
      if (kidJob) return report(api, kidLife.doSmallJob(kidJob));
      const kidMoney = e.target.closest('[data-kidmoney]')?.dataset.kidmoney;
      if (kidMoney === 'ask') return report(api, kidLife.askAllowance());
      if (kidMoney === 'chores') return report(api, kidLife.doChores());
      if (kidMoney === 'buy') return report(api, kidLife.buySaved());
      if (kidMoney === 'save') return pickModal({ title: 'Save for what?', options: kidLife.SAVING_GOALS.map(([name, cost]) => ({ value: name, label: name[0].toUpperCase() + name.slice(1), sub: fmtMoney(localMoney(cost, country()), country()) })) })
        .then((pick) => (pick ? report(api, kidLife.saveFor(pick, kidLife.SAVING_GOALS.find(([n]) => n === pick)[1])) : undefined));
      const club = e.target.closest('[data-club]')?.dataset.club;
      if (club) return leisure.openClubs(api, club);
      const todo = e.target.closest('[data-do]')?.dataset.do;
      if (todo) return leisure.quick(api)[todo]();
      const go = e.target.closest('[data-go]')?.dataset.go;
      if (go === 'riding') return openScreen(api, 'riding');
      if (go === 'athletics') return openAthletics(api);
      if (go === 'neighborhood') return openNeighborhood(api);
      if (go === 'photocards') return openIdol(api, 'photocards');
      if (go) return ({ account: leisure.openAccount, followers: leisure.buyFollowers, abroad: (a) => openExplore(a, { view: 'immigration' }), city: leisure.moveCity, travel: (a) => openExplore(a) })[go](api);
      return undefined;
      if (go) return ({ abroad: leisure.moveAbroad, city: leisure.moveCity })[go]?.(api);
      const act = e.target.closest('[data-prison]')?.dataset.prison;
    };
  },
};

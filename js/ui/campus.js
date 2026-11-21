// University, as a book: the course and how it is going, who the player
// lives with and what they belong to, and the experience they are building.
// Rules: engine/campus.js. Everything shown comes from the saved life.
import { player, country } from '../state.js';
import { esc, fmtMoney } from '../util.js';
import { degreeMark } from '../engine/schooling.js';
import * as campus from '../engine/campus.js';
import { COUNTRIES } from '../data/countries.js';
import { avatarSvg } from './avatar.js';
import { meterHtml } from './meter.js';
import { openModal, pickModal, messageModal, confirmModal } from './modals.js';

const face = (n) => avatarSvg({ age: n.age, gender: n.gender, appearance: n.appearance, seed: n.id, mood: 60 });
const person = (n, side) => `<div class="row dyn-row"><div class="avatar">${face(n)}</div>
  <div class="main"><strong>${esc(n.firstName)} ${esc(n.lastName)}</strong><small>${esc(side)}</small></div>
  <div class="side">${Math.round(n.meters.relationship)}%</div></div>`;

function pageStudies(v) {
  const loads = campus.loads();
  return `<div class="kv"><span>At</span><span><strong>${esc(v.school)}</strong></span></div>
    <div class="kv"><span>Studying</span><span>${esc(v.major)}${v.minor ? `, with a minor in ${esc(v.minor)}` : ''}</span></div>
    <div class="kv"><span>Marks</span><span>${v.gpa ? esc(degreeMark(v.gpa)) : 'None yet'}${v.probation ? ' · on academic probation' : ''}</span></div>
    ${v.credits != null ? `<div style="margin:8px 0">${meterHtml(`Credits: ${v.credits} of ${v.needed}`, Math.round(v.credits / v.needed * 100), true)}</div>` : ''}
    <div class="section-label">This year's workload</div>
    ${loads.map((l) => `<button class="choice-btn ${l.current ? 'on' : ''}" data-load="${l.id}" ${l.current ? 'disabled' : ''}>${esc(l.name)}${l.current ? ' (now)' : ''}<small>${l.credits} credits a year. ${esc(l.blurb)}</small></button>`).join('')}
    ${v.stage === 'university' ? `<button class="btn" data-minor style="width:100%;margin-top:10px">${v.minor ? 'Change or drop your minor' : 'Take a minor'}</button>` : ''}
    ${v.professor ? `<div class="section-label">Your professor</div>${person(v.professor, v.professor.flags.title)}<button class="btn" data-office style="width:100%" ${v.canOffice ? '' : 'disabled'}>${v.canOffice ? 'Go to office hours' : 'You have been this year'}</button>` : ''}`;
}

function pageLife(v) {
  return `${v.roommate ? `<div class="section-label">Your roommate</div>${person(v.roommate, v.habit ? `Who ${v.habit.line}` : 'Roommate')}` : '<p class="muted">You have no roommate.</p>'}
    <div class="section-label">Organizations</div>
    <p class="muted" style="margin-bottom:6px">Two at most.</p>
    ${v.orgs.map((o) => `<div class="card sub-card ${o.joined ? 'on' : ''}"><div class="sub-head"><strong>${esc(o.name)}</strong><span>${esc(o.role)}</span></div>
      <p class="muted">${esc(o.blurb)}${o.dues ? ` Dues: ${o.dues} a year.` : ''}</p>
      ${o.joined ? meterHtml('Your standing in it', o.standing, true) : ''}
      <button class="btn" data-org="${o.id}" ${!o.joined && o.why ? 'disabled' : ''}>${o.joined ? 'Leave' : o.why || 'Join'}</button></div>`).join('')}
    ${v.friends.length ? `<div class="section-label">Friends made here</div>${v.friends.map((n) => person(n, n.flags.title ?? 'Friend')).join('')}` : ''}`;
}

function pageExperience(v) {
  const c = country();
  const posts = campus.postings();
  const abroad = campus.abroadOptions();
  return `<div class="section-label">This summer's internships</div>
    ${posts.length ? posts.map((p) => `<div class="card sub-card"><div class="sub-head"><strong>${esc(p.employer)}</strong><span>${fmtMoney(p.pay, c)}</span></div>
      <p class="muted">${esc(p.title)}.${p.sought ? ' The one everybody wants.' : ''} Your chances: ${esc(campus.internOutlook(p))}.</p>
      <button class="btn" data-intern="${p.id}" ${p.applied ? 'disabled' : ''}>${p.applied ? 'You have their answer' : 'Apply'}</button></div>`).join('') : '<p class="muted">Internships open after your first year in college.</p>'}
    ${v.internships.length ? `<div class="section-label">Where you have worked</div>${v.internships.map((i) => `<div class="dyn-event"><span class="num">Age ${i.age}</span><span>${esc(i.title)}, ${esc(i.employer)}${i.went >= 70 ? ' · they wanted you back' : ''}</span></div>`).join('')}` : ''}
    ${v.returnOffer ? `<p class="dyn-reach">${esc(v.returnOffer.employer)} is holding a job for you.</p>` : ''}
    <div class="section-label">A year abroad</div>
    ${v.abroad && !v.abroad.done ? `<p class="dyn-reach">You are spending the coming year in ${esc(COUNTRIES[v.abroad.countryId].name)}.</p>` : v.studiedIn.length ? `<p class="muted">You spent a year in ${esc(v.studiedIn.map((id) => COUNTRIES[id].name).join(', '))}.</p>`
      : abroad.length ? abroad.map((a) => `<button class="choice-btn" data-abroad="${a.id}" ${a.why ? 'disabled' : ''}>${a.flag} ${esc(a.name)}<small>${a.why || `${fmtMoney(a.cost, c)} for travel.${a.language ? ` You would come back speaking some ${a.language}.` : ''}`}</small></button>`).join('') : '<p class="muted">Not on offer here.</p>'}`;
}

/** Opens the campus book. */
export function openCampus(api) {
  const tabs = [['studies', 'Studies'], ['life', 'Life'], ['experience', 'Experience']];
  let tab = 'studies';
  const m = openModal(`
    <div class="dyn-head"><div><div class="eyebrow">Education</div><h2>University life</h2></div>
      <button class="icon-btn" data-close aria-label="Close">✕</button></div>
    <div class="dyn-tabs" role="tablist">${tabs.map(([id, label]) => `<button role="tab" data-tab="${id}">${label}</button>`).join('')}</div>
    <div class="dyn-body" data-body></div>`, { dismissable: true });
  m.el.classList.add('dyn-modal');
  const body = m.el.querySelector('[data-body]');
  function draw(keep = false) {
    const top = body.scrollTop;
    m.el.querySelectorAll('[data-tab]').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab));
    if (!campus.atUniversity()) { body.innerHTML = '<p class="muted">You are not in college.</p>'; return; }
    const v = campus.view();
    body.innerHTML = tab === 'studies' ? pageStudies(v) : tab === 'life' ? pageLife(v) : pageExperience(v);
    body.scrollTop = keep ? top : 0;
  }
  const say = async (r) => { api.changed(); await messageModal({ body: r.text, tone: r.tone }); };
  m.el.addEventListener('click', async (e) => {
    if (e.target.closest('[data-close]')) return m.close();
    const t = e.target.closest('[data-tab]');
    if (t) { tab = t.dataset.tab; return draw(); }
    const load = e.target.closest('[data-load]');
    if (load && !load.disabled) { campus.setLoad(load.dataset.load); api.changed(); return draw(true); }
    if (e.target.closest('[data-minor]')) {
      const id = await pickModal({ title: 'A minor', cancel: 'Back', body: 'A second subject alongside your own. More work, slightly lower marks, and it goes on your degree: some employers ask for it.',
        options: [...(player().education.minorId ? [{ value: 'none', label: 'Drop your minor' }] : []), ...campus.minors().map((x) => ({ value: x.id, label: x.name }))] });
      if (id) await say(campus.setMinor(id === 'none' ? null : id));
      return draw(true);
    }
    if (e.target.closest('[data-office]')) { await say(campus.officeHours()); return draw(true); }
    const org = e.target.closest('[data-org]');
    if (org && !org.disabled) {
      const mine = campus.view().orgs.find((o) => o.id === org.dataset.org);
      if (mine.joined && !(await confirmModal({ title: `Leave the ${mine.name.toLowerCase()}?`, body: 'Your standing in it is lost.', yes: 'Leave' }))) return undefined;
      await say(mine.joined ? campus.leaveOrg(mine.id) : campus.joinOrg(mine.id));
      return draw(true);
    }
    const intern = e.target.closest('[data-intern]');
    if (intern && !intern.disabled) { await say(campus.applyIntern(intern.dataset.intern)); return draw(true); }
    const abroad = e.target.closest('[data-abroad]');
    if (abroad && !abroad.disabled) {
      if (!(await confirmModal({ title: 'Spend a year abroad?', body: 'You leave after this year and come back for the rest of your degree. Your family and friends stay where they are.', yes: 'Go' }))) return undefined;
      await say(campus.goAbroad(abroad.dataset.abroad));
      return draw(true);
    }
    return undefined;
  });
  draw();
}

// Self tab: body and mind at a glance, life milestones, and the game menu.
import { getEra, eventsIn } from '../../engine/history.js';
import { store } from '../../state.js';
import { outlook } from '../../engine/economy.js';
import { openNews } from '../leisure.js';
import { openWorld } from '../world.js';
import { player, country } from '../../state.js';
import * as living from '../../engine/living.js';
import { esc, theCountry } from '../../util.js';
import { TRAIT_BY_ID } from '../../data/traits.js';
import { BIRTH_BY_ID } from '../../data/birthConditions.js';
import { meterHtml } from '../meter.js';
import { tripleThreat } from '../../engine/conditions.js';
import { confirmModal } from '../modals.js';
import * as med from '../../engine/medical.js';
import { seeDoctor, cosmeticSurgery } from '../leisure.js';
import { openExplore } from '../globalLife.js';
import { openAppearanceEditor } from '../../avatar/editor.js';
import * as salon from '../../engine/salon.js';
import { identityRows, openIdentity, skillsCard, openPractice } from '../identity.js';
import { messageModal } from '../modals.js';
import { royalCard, bindRoyalCard } from '../royalty.js';
import { openSettings } from '../settings.js';
import { openHealth } from '../health/hub.js';
import { navRow, navGroup } from '../kit.js';

export default {
  id: 'self', title: 'Self', short: 'Self',
  icon: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  render(el, api) {
    const p = player();
    const traits = p.traits.map((id) => TRAIT_BY_ID[id]).filter(Boolean);
    const from = (id) => ({ mother: ' (from your mother)', father: ' (from your father)' })[p.traitSources?.[id]] ?? '';
    const born = (p.birth ?? []).map((id) => BIRTH_BY_ID[id]).filter(Boolean);
    const conditions = p.conditions.length
      ? p.conditions.map((c) => `<div class="kv"><span>${esc(c.name.charAt(0).toUpperCase() + c.name.slice(1))}</span><span>since age ${c.sinceAge}${c.treated ? ', under treatment' : ''}</span></div>`).join('')
      : '<p class="muted">You are in good health.</p>';
    // Health milestones are private: shown here with a lock, and they open the Treatment Journey.
    const milestones = p.milestones.map((m, i) => (m.kind === 'health'
      ? `<button class="kv hl-milestone" data-milestone="${i}"><span>Age ${m.age}</span><span>${esc(m.text)} <span class="hl-lock" title="Private">🔒</span></span></button>`
      : `<div class="kv"><span>Age ${m.age}</span><span>${esc(m.text)}</span></div>`)).join('');

    const sick = med.treatable().some((x) => !x.managed && !x.seen);
    const crownLine = !p.royal && !p.flags.formerRoyal ? royalCard() : '';
    el.innerHTML = `
      <div class="card"><h3>Health and mood</h3>
        ${meterHtml('Mood', p.stats.mood, true)}${meterHtml('Health', p.stats.health, true)}
        ${meterHtml('Intellect', p.stats.intellect, true)}${meterHtml('Charm', p.stats.charm, true)}
        <div class="section-label">Conditions</div>${conditions}
        ${born.length ? `<div class="section-label">Born with</div>${born.map((b) => `<div class="kv"><span>${esc(b.name)}</span><span>${esc(b.desc)}</span></div>`).join('')}` : ''}
        <div class="btn-stack" style="margin-top:10px">
          <button class="btn${sick ? ' peach' : ''}" data-doctor>See a doctor${sick ? ' · something needs looking at' : ''}</button>
          <button class="btn" data-health>My Health: care, support and records</button>
          ${med.canHaveSurgery() ? '<button class="btn" data-surgery>Cosmetic surgery</button>' : ''}
          ${salon.canVisitSalon() ? '<button class="btn" data-salon>Beauty salon</button>' : ''}
        </div>
      </div>
      <div class="card"><h3>Talents and skills</h3>
        ${meterHtml('Music', p.talents.music, true)}${meterHtml('Sports', p.talents.sports, true)}
        ${meterHtml('Acting', p.talents.acting, true)}${meterHtml('Singing', p.talents.singing, true)}
        ${meterHtml('Dance', p.talents.dance, true)}
        ${p.flags.musicalRoute || p.career.careerId === 'mt_performer' || /musical/.test(p.education.majorId ?? '') ? `<div class="kv" style="margin-top:8px"><span>Triple threat (singing, dance, acting)</span><span><strong>${tripleThreat()}</strong></span></div>` : ''}
        ${skillsCard({ inner: true })}
        <div class="section-label">Traits</div>
        ${traits.map((t) => `<div class="kv"><span>${esc(t.name)}${from(t.id)}</span><span>${esc(t.desc)}</span></div>`).join('')}
      </div>
      ${p.royal || p.flags.formerRoyal ? royalCard() : ''}
      <div class="card"><h3>Identity</h3>
        ${identityRows().map(([a, b]) => `<div class="kv"><span>${esc(a)}</span><span>${esc(b)}</span></div>`).join('')}
        <button class="btn small" data-identity style="margin-top:10px;width:100%">Edit identity</button>
      </div>
      ${(() => { const here = living.summary(); const era = getEra(store.state.year); const now = eventsIn(p.countryId).filter((e) => e.name && !e.independence); return `<div class="card"><h3>Life in ${esc(theCountry(country().name))}${era.id === 'now' ? '' : ` · ${esc(era.name)}`}</h3>
        ${here.crisis ? `<p style="margin-bottom:8px"><strong>${esc(here.crisis.name)}.</strong> ${esc(here.crisis.blurb)}</p>` : ''}
        <div class="kv"><span>Your standing here</span><span><strong>${esc(living.tierName())}</strong></span></div>
        <div class="kv"><span>The economy</span><span>${esc(outlook().name)}</span></div>
        ${era.id === 'now' && !now.length ? '' : `<div class="kv"><span>The times</span><span>${esc(era.name)}${now.length ? ` · ${now.map((e) => esc(e.name)).join(', ')}` : ''}</span></div>`}
        <details class="more"><summary>More about ${esc(country().name)}</summary>
        ${era.id === 'now' ? '' : `<p class="muted">${esc(era.description)} You were born into ${esc(getEra(p.birthYear).name)} (${p.birthYear}).</p>`}
        ${here.rows.map(([a, b]) => `<div class="kv"><span>${esc(a)}</span><span>${esc(b)}</span></div>`).join('')}
        </details>
        ${crownLine ? crownLine.replace(/^<div class="card"><h3>[^<]*<\/h3>/, '<div class="section-label">The crown</div>').replace(/<\/div>$/, '') : ''}</div>`; })()}
      ${navGroup([
    navRow({ attrs: 'data-passport', label: 'Passport & Documents', ico: 'passport' }),
    navRow({ attrs: 'data-world', label: 'The world', ico: 'compass' }),
    navRow({ attrs: 'data-news', label: 'World news', ico: 'news' }),
  ], 'The world')}
      <div class="card"><h3>Milestones</h3>${milestones}</div>
      ${navGroup([
    navRow({ attrs: 'data-settings', label: 'Settings', ico: 'settings' }),
    navRow({ attrs: 'data-exit', label: 'Save and quit', ico: 'exit' }),
  ], 'Game')}
      <button class="btn danger" data-end>End this life</button>`;

    bindRoyalCard(el, api);
    el.querySelector('[data-doctor]').onclick = () => seeDoctor(api);
    el.querySelector('[data-health]').onclick = () => openHealth(api);
    el.querySelectorAll('[data-milestone]').forEach((b) => { b.onclick = () => openHealth(api, { page: 'journey', journey: 'overview' }); });
    el.querySelector('[data-passport]').onclick = () => openExplore(api, { view: 'documents' });
    el.querySelector('[data-identity]').onclick = () => openIdentity(api);
    if (el.querySelector('[data-practice]')) el.querySelector('[data-practice]').onclick = () => openPractice(api);
    if (el.querySelector('[data-salon]')) el.querySelector('[data-salon]').onclick = async () => {
      const next = await openAppearanceEditor({ title: 'Beauty salon', appearance: p.appearance, age: p.age, gender: p.gender, seed: p.id,
        scope: 'style', note: salon.salonNote, confirm: 'Confirm appearance' });
      if (!next) return;
      const r = salon.applySalon(next);
      api.changed();
      await messageModal({ body: r.text, tone: r.tone });
    };
    el.querySelector('[data-world]').onclick = () => openWorld({ start: p.countryId, home: p.countryId });
    el.querySelector('[data-news]').onclick = () => openNews();
    if (el.querySelector('[data-surgery]')) el.querySelector('[data-surgery]').onclick = () => cosmeticSurgery(api);
    el.querySelector('[data-settings]').onclick = () => openSettings().then(() => api.changed?.()); // the turn length shows on the button
    el.querySelector('[data-exit]').onclick = () => api.exitToTitle();
    el.querySelector('[data-end]').onclick = async () => {
      const sure = await confirmModal({
        title: 'End this life?',
        body: `${p.firstName}'s story will stop here and move to the graveyard. This cannot be undone.`,
        yes: 'End life', danger: true,
      });
      if (sure) api.endLife();
    };
  },
};

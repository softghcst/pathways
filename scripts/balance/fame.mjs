// Run from the repository root: node scripts/balance/fame.mjs [seed] [lives per cell] [years]
// Fame balance: whole public careers in each field (acting, music, sport, modeling, books) at three
// levels of talent, played by a keen but ordinary player. Reports how famous people get, how fast,
// what they earn against the country's average wage, and how big the save grows.
import { store } from '../../js/state.js';
import { rng } from '../../js/rng.js';
import { createLife } from '../../js/engine/characterGen.js';
import { advanceYear } from '../../js/engine/yearProcessor.js';
import { CAREER_BY_ID } from '../../js/data/careers.js';
import { COUNTRIES } from '../../js/data/countries.js';
import { localWage } from '../../js/util.js';
import { hire } from '../../js/engine/career.js';
import * as fame from '../../js/engine/fame.js';
import * as ent from '../../js/engine/entertainment.js';
import * as press from '../../js/engine/press.js';
import * as music from '../../js/engine/music.js';
import * as modeling from '../../js/engine/modeling.js';
import * as pub from '../../js/engine/publishing.js';
import { practice } from '../../js/engine/skills.js';

rng.seed(Number(process.argv[2] ?? 7));
const LIVES = Number(process.argv[3] ?? 6);
const YEARS = Number(process.argv[4] ?? 20);
const LEVELS = { ordinary: 66, good: 78, great: 90 };
const PLACES = ['us', 'uk', 'de', 'br', 'jp', 'ng'];

// A keen player practices their craft every year; a talented one has practiced since childhood.
const PRACTICE = { acting: ['acting', 'acting', 'singing'], theater: ['singing', 'dance', 'acting'], music: ['writing', 'singing', 'music_theory'], modeling: ['dance', 'yoga', 'dance'], books: ['writing', 'writing', 'writing'] };
const FIELDS = {
  acting: {
    audience: 'film',
    setup(p, t) { p.talents.acting = t; p.talents.singing = t - 10; p.talents.dance = t - 10; p.stats.charm = t; },
    year(p) {
      for (const x of ent.castingBoard(p).filter((z) => !z.why && !z.applied).slice(0, 5)) {
        const r = ent.audition(x.production.id, x.role.idx, 'study', rng.pick(['bold', 'restrained', 'playful']));
        if (r.contract) ent.sign(r.contract.id);
      }
      if (!ent.workOf(p).agent && press.agentTriesLeft() > 0) { press.findAgent(); const a = press.agentOnOffer(); if (a) press.signAgent(a.id); }
      for (const w of ent.activeWork(p)) ent.onSet(w.id, 'director');
    },
  },
  // Theater only: plays and musicals, from community shows up; the major stage is Broadway, the West End and the rest.
  theater: {
    audience: 'theater',
    setup(p, t) {
      p.talents.acting = t; p.talents.singing = t; p.talents.dance = t; p.stats.charm = t - 10;
      // BFA=1: every performer has a conservatory degree in musical theater, and gave a good showcase.
      if (process.env.BFA) { p.education.degrees.push({ type: 'university', majorId: 'musical_theater_bfa', gpa: 3.4, age: 22 }); p.flags.showcase = 'classic'; }
    },
    year(p) {
      for (const x of ent.castingBoard(p).filter((z) => !z.why && !z.applied && ['stage', 'musical'].includes(z.production.kind) && z.role.kind !== 'child').slice(0, 5)) {
        const r = ent.audition(x.production.id, x.role.idx, 'study', x.role.approach);
        if (r.contract) ent.sign(r.contract.id);
      }
      if (!ent.workOf(p).agent && press.agentTriesLeft() > 0) { press.findAgent(); const a = press.agentOnOffer(); if (a) press.signAgent(a.id); }
    },
  },
  music: {
    audience: 'music',
    setup(p, t) { p.talents.music = t; p.talents.singing = t; const ms = music.musicians(p.countryId); music.formAct('band', { with: [ms[0].id, ms[1].id, ms[2].id] }); },
    year(p) {
      if (!music.myAct(p)) { const ms = music.musicians(p.countryId); music.formAct('band', { with: ms.slice(0, 3).map((n) => n.id) }); }
      music.writeSong(); music.writeSong();
      for (let i = 0; i < 4; i++) music.gig();
      const a = music.myAct(p);
      if (a?.offer) music.signDeal();
      const n = music.musicOf(p).songs.length;
      music.record(n >= 10 ? 'album' : n >= 4 ? 'ep' : 'single', { video: true });
      if (a) for (const sc of ['stadium', 'arena', 'theater', 'club']) { if (music.planTour(sc, music.tourPlaces(a, sc)).ok) break; }
    },
  },
  modeling: {
    audience: 'fashion',
    setup(p, t) { p.stats.charm = t; p.talents.dance = t - 10; },
    year(p) {
      if (!modeling.isModel(p) && p.age <= 36) hire(CAREER_BY_ID.modeling, 0, 60, 'offer');
      if (!modeling.isModel(p)) return;
      if (!modeling.modelOf(p).agencyId && modeling.agenciesWilling(p).length) modeling.joinAgency(modeling.agenciesWilling(p)[0].id);
      for (const c of modeling.castings(p).slice(0, 3)) modeling.attendCasting(c.id, rng.pick(Object.keys(modeling.APPROACHES)));
    },
  },
  books: {
    audience: 'literary',
    setup(p, t) { p.stats.intellect = t; },
    year(p) {
      const w = pub.writingOf(p);
      if (!w.draft) pub.startDraft('novel', 'crime');
      for (let i = 0; i < 3; i++) pub.writeSession();
      for (const b of w.books.map(pub.book).filter((x) => x?.status === 'manuscript')) {
        if (!w.agent) { pub.queryAgents(b.id); if (pub.litAgentOnOffer()) pub.signLitAgent(); }
        if (pub.submit(b.id).ok) { const best = [...b.offers].sort((x, y) => y.advance - x.advance)[0]; pub.acceptOffer(b.id, best.publisherId); }
      }
    },
  },
};

const out = [];
for (const [field, F] of Object.entries(FIELDS).filter(([k]) => !process.env.FIELDS || process.env.FIELDS.split(',').includes(k))) {
  for (const [level, t] of Object.entries(LEVELS)) {
    const R = { legacy: [], peak: [], aud: [], earn: [], national: 0, intl: 0, size: [], fameAt5: [], fameEnd: [], major: 0, majorYear: [] };
    for (let i = 0; i < LIVES; i++) {
      const cid = PLACES[i % PLACES.length];
      do { store.state = createLife({ countryId: cid }); } while (store.state.player.royal);
      const p = store.state.player;
      p.age = 20; p.birthYear = store.state.year - 20; p.education.enrolled = false; p.education.stage = 'none'; p.flags.livesWithParents = false;
      p.finance.cash = Math.max(p.finance.cash, 20000);
      p.flags.balanceSport = ['football', 'basketball', 'tennis', 'rugby', 'boxing', 'athletics'][i % 6];
      F.setup(p, t);
      p.skills = { ...(p.skills ?? {}), writing: ['books', 'music'].includes(field) ? t - 25 : 20 };
      const earned0 = p.finance.lifetimeEarned ?? 0;
      let peak = 0;
      for (let y = 0; y < YEARS && p.alive; y++) {
        try { for (const k of PRACTICE[field]) practice(k); F.year(p); advanceYear(); } catch (e) { console.log(`${field}/${level} ${cid} year ${y}: ${e.stack.split('\n').slice(0, 2).join(' ')}`); break; }
        store.state.pendingEvents = []; p.legal.pending = null; p.legal.incarceration = null; p.stats.health = Math.max(p.stats.health, 80);
        peak = Math.max(peak, p.hidden.fame ?? 0);
        if (y === 4) R.fameAt5.push(p.hidden.fame ?? 0);
        if (!R.seenMajor && ent.workOf(p).credits.some((c) => ent.production(c.productionId)?.tier === 'major_stage')) { R.seenMajor = true; R.major += 1; R.majorYear.push(y + 1); if (process.env.SHOW) { const c = ent.workOf(p).credits.map((c) => [ent.production(c.productionId), c.idx]).find(([x]) => x?.tier === 'major_stage'); console.log(`  ${field}/${level} year ${y + 1}: triple threat ${Math.round((p.talents.singing + p.talents.dance + p.talents.acting) / 3)}, ${c[0].cast[c[1]]?.kind} in a ${c[0].kind}, credits ${ent.proCredits(p)}, agent ${!!ent.workOf(p).agent}`); } }
      }
      R.seenMajor = false;
      const f = fame.fameOf(p);
      R.peak.push(peak);
      R.fameEnd.push(p.hidden.fame ?? 0);
      R.aud.push(f.audiences[F.audience] ?? 0);
      R.earn.push(((p.finance.lifetimeEarned ?? 0) - earned0) / YEARS / localWage(45000, COUNTRIES[cid]));
      const sc = fame.scope(p).id;
      if (['national', 'international', 'historic'].includes(sc)) R.national += 1;
      if (['international', 'historic'].includes(sc)) R.intl += 1;
      R.legacy.push(f.legacy);
      R.size.push(JSON.stringify(store.state).length / 1024);
    }
    const avg = (a) => (a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length * 10) / 10 : 0);
    const med = (a) => { const b = [...a].sort((x, y) => x - y); return b.length ? Math.round(b[Math.floor(b.length / 2)] * 100) / 100 : 0; };
    out.push({ field, level, peakFame: avg(R.peak), fameAfter5: avg(R.fameAt5), fameAtEnd: avg(R.fameEnd), audience: avg(R.aud), legacy: avg(R.legacy), earnX: med(R.earn), national: `${R.national}/${LIVES}`, majorStage: `${R.major}/${LIVES}${R.majorYear.length ? ` (yr ${avg(R.majorYear)})` : ''}`, intl: `${R.intl}/${LIVES}`, saveKB: Math.round(Math.max(...R.size)) });
  }
}
console.table(out);

// The lives other people lead. Every year, family and friends go to school,
// choose a path, work, earn, save, fall in love, marry, part, have children
// and chase an ambition of their own, whether or not the player is watching.
//
// Each person keeps a `life` record and a `life.history` timeline. Big moments
// in close family also reach the player's journal, and a few ask the player
// to respond (see data/events/familyLives.js).
import { careerBlock, careerExists, eraTitle, worldYear, majorOpen, universityAccess, secondaryShare } from './history.js';
import { rule as lawRule } from './rules.js';
import { rng } from '../rng.js';
import { spouseFactor } from './couple.js';
import * as kid from './kidschool.js';
import { showMark } from './grades.js';
import { schoolModel } from '../data/education.js';
import { clamp, localMoney, fmtMoney, localWage, localCost } from '../util.js';
import { store, player, country, livingNpcs, log, milestone } from '../state.js';
import { makeNpc } from './npcFactory.js';
import { inheritAppearance, inheritTalents, inheritTraits } from './genetics.js';
import { roleLabel, spendAction, removeNpc } from './relationships.js';
import { remember } from './conditions.js';
import { CAREERS, CAREER_BY_ID } from '../data/careers.js';
import { placeAt } from './employers.js';
import { MAJORS, MAJOR_BY_ID } from '../data/majors.js';
import { TRADES, TRADE_BY_ID } from '../data/schools.js';
import { tickNpcMoney, finRows } from './npcMoney.js';
import { ASPIRATIONS, HOBBIES, SCHOOL_MOMENTS, ADULT_MOMENTS, MAX_KIDS, MAX_PEOPLE } from '../data/npcLife.js';

const result = (ok, text, tone = ok ? 'good' : 'bad') => ({ ok, text, tone });
const an = (noun) => `${/^[aeiou]/i.test(noun) ? 'an' : 'a'} ${noun}`;

/** Who gets a full life. Friends get one too, but their families stay off-screen. */
const LIVE = ['spouse', 'partner', 'child', 'grandchild', 'greatgrandchild', 'sibling', 'niece', 'inlaw', 'friend', 'coworker', 'boss', 'colleague'];
/** Whose partners and children become people you can see. */
const FAMILY_MAKERS = ['child', 'grandchild', 'sibling'];
/** Whose big moments are reported in the player's journal. */
const NEWSWORTHY = ['spouse', 'partner', 'child', 'grandchild', 'sibling'];
const CLOSE = ['spouse', 'partner', 'child'];
const CHILD_ROLE = { child: 'grandchild', grandchild: 'greatgrandchild', sibling: 'niece' };

const npcOf = (id) => store.state.npcs[id];
const pronoun = (npc) => (npc.gender === 'male' ? 'his' : npc.gender === 'female' ? 'her' : 'their');
const whose = (npc) => `Your ${roleLabel(npc).toLowerCase().replace(' (adopted)', '')} ${npc.firstName}`;

// ---------- Records ----------

/**
 * Adds a line to someone's timeline. `major` also tells the player:
 * true for anyone in NEWSWORTHY, 'close' only for a partner or child.
 */
function note(npc, text, major = false, tone = 'neutral') {
  npc.life.history.push({ age: npc.age, year: store.state.year, text });
  if (npc.life.history.length > 60) npc.life.history.shift();
  const tell = major === 'close' ? CLOSE.includes(npc.role) : major && NEWSWORTHY.includes(npc.role);
  if (tell) log(`${whose(npc)} ${text}.`, 'system', tone);
}

/** Queues a scene about this person, at most one a year so news never floods. */
function ask(id, cast) {
  const p = player();
  if (p.flags.familySceneAge === p.age || p.legal.incarceration) return false;
  if (store.state.eventHistory.some((h) => h.id === id && p.age - h.lastAge < 2)) return false;
  p.flags.familySceneAge = p.age;
  store.state.pendingEvents.push({ id, cast });
  return true;
}

/**
 * A child lives as who they are: a new name, from the day they tell their
 * parent. Whether the parent stood by them is remembered either way.
 */
export function npcTransition(npc, accepted) {
  if (!npc || npc.flags.transitioned) return;
  const names = country().names;
  npc.flags.bornAs = npc.gender;
  npc.flags.formerName = npc.firstName;
  npc.gender = npc.gender === 'male' ? 'female' : 'male';
  const taken = new Set(livingNpcs().map((n) => n.firstName));
  const free = names[npc.gender].filter((n) => !taken.has(n));
  npc.firstName = rng.pick(free.length ? free : names[npc.gender]);
  npc.flags.transitioned = true;
  npc.flags.parentAccepted = !!accepted;
  if (npc.life) note(npc, `began living as ${npc.gender === 'female' ? 'a woman' : 'a man'}, and took the name ${npc.firstName}`, false);
  log(accepted ? `Your child is ${npc.firstName} now, and is your ${npc.gender === 'female' ? 'daughter' : 'son'}.`
    : `Your child goes by ${npc.firstName} now, whether or not you use it.`, 'system', accepted ? 'good' : 'bad');
}

/** While the player is locked up, family news still arrives, by letter. */
function letter(text) {
  const p = player();
  if (!p.legal.incarceration) return;
  p.stats.mood = clamp(p.stats.mood - 4);
  log(`A letter reaches you inside. ${text}`, 'system', 'bad');
}

function addNpc(npc) {
  store.state.npcs[npc.id] = npc;
  player().npcIds.push(npc.id);
  npc.lastInteractionAge = player().age;
  return npc;
}
const room = () => player().npcIds.length < MAX_PEOPLE;

// ---------- Work ----------

/** Careers this person could be hired into: their own field first. */
function careersFor(npc) {
  const e = npc.life.edu;
  const t = npc.talents ?? {};
  // The stage is for those who want it and can do it.
  const stage = [];
  if ((t.singing ?? 0) >= 68 && (t.dance ?? 0) >= 62 && (t.acting ?? 0) >= 62) stage.push('mt_performer');
  if ((t.acting ?? 0) >= 75) stage.push('actor');
  if ((t.singing ?? 0) >= 78) stage.push('singer');
  if ((t.sports ?? 0) >= 82 && npc.age <= 26) stage.push('athlete');
  const wantsIt = npc.life.aspiration?.id === 'stage' || e.majorId === 'musical_theater' || e.majorId === 'theater';
  const stageOpen = stage.filter((id) => careerExists(id, worldYear()));
  if (stageOpen.length && rng.chance(wantsIt ? 0.85 : 0.06)) return stageOpen.map((id) => CAREER_BY_ID[id]);

  const has = (d) => e.degrees.includes(d);
  const usesTrade = (c) => c.req?.trade === e.trade || (c.doors ?? []).some((d) => d.trade && d.trade === e.trade);
  const open = CAREERS.filter((c) => {
    const r = c.req ?? {};
    if (careerBlock(c, npc, worldYear(), (id) => lawRule(id, typeof npc.flags?.abroad === 'string' ? npc.flags.abroad : store.state.player.countryId))) return false;
    if (c.category === 'performing') return false;
    if (c.branchOnly || r.experience || r.programs || c.agesOut) return false; // reached from inside a career, not hired into cold
    if (r.altOnly && !rng.chance(0.15)) return false; // needs a certificate few people have
    if (c.type === 'military' && !rng.chance(0.08)) return false;
    if (r.program && !has(r.program)) return false;
    if (r.trade && e.trade !== r.trade) return false;
    if (r.degree === 'university' && !has('university')) return false;
    if (r.majors && !r.majors.includes(e.majorId)) return false;
    if (r.degree === 'high' && !has('high')) return false;
    if (r.minAge && npc.age < r.minAge) return false;
    if (r.maxAge && npc.age > r.maxAge) return false;
    return true;
  });
  // Someone with a trade, a profession or a subject works in it nine times in ten.
  const own = open.filter((c) => (e.trade && usesTrade(c)) || (c.req?.program && has(c.req.program))
    || (c.req?.majors && has('university')));
  // A child may lean toward a parent's line of work (more so if they were shown it and liked it), where they
  // qualify for it. Never forced: one told to find their own way does not lean at all.
  if (npc.role === 'child' && !npc.flags.ownPath && store.state?.player) {
    const mine = store.state.player.career;
    const fam = npc.flags.inspiredBy ?? CAREER_BY_ID[mine.careerId ?? mine.lastField]?.family;
    const same = fam ? open.filter((c) => c.family === fam) : [];
    if (same.length && rng.chance(npc.flags.inspiredBy ? 0.6 : 0.1)) { npc.flags.followed = fam; return same; }
  }
  if (own.length && rng.chance(0.9)) return own;
  return open.filter((c) => !c.req?.majors && !c.req?.program && !c.req?.trade);
}

const bandPay = (level, where = 0.4) => localWage((level.pay[0] + (level.pay[1] - level.pay[0]) * where) * 1000, country());

function startJob(npc, quiet = false) {
  if (npc.flags.royal) return false; // working royals do not take jobs
  const options = careersFor(npc);
  if (!options.length) return false;
  // After losing a job, most people go back to the field they know, a rung lower.
  const last = npc.life.lastJob;
  const back = last && rng.chance(0.8) ? CAREER_BY_ID[last.careerId] : null;
  const career = back ?? rng.pick(options);
  const rung = back ? Math.max(0, last.level - 1) : career.type === 'fulltime' && career.doors?.some((d) => d.trade === npc.life.edu.trade) ? 1 : 0;
  const level = career.levels[rung];
  npc.life.job = { careerId: career.id, level: rung, title: eraTitle(career.id, rung, worldYear()) ?? level.title, salary: bandPay(level, rng.next() * 0.6), years: 0 };
  // Someone the player knows works somewhere real, in the player's city unless they live abroad.
  if (!quiet && !npc.flags.abroad && store.state?.player) {
    const e = placeAt(career.id, store.state.player.countryId, store.state.player.city);
    npc.life.job.employerId = e.id;
    if (!e.staff.includes(npc.id)) e.staff.push(npc.id);
  }
  npc.occupation = level.title.toLowerCase();
  if (!quiet) note(npc, `started work as ${an(npc.occupation)}`, npc.life.worked ? false : true);
  npc.life.worked = true;
  return true;
}

function tickJob(npc, quiet = false) {
  const L = npc.life;
  const job = L.job;
  const career = CAREER_BY_ID[job.careerId];
  // A job saved under an older career ladder can point past its top rung: treat it as the top.
  if (!(job.level >= 0 && job.level < career.levels.length)) job.level = Math.max(0, Math.min(career.levels.length - 1, job.level | 0));
  const level = career.levels[job.level];
  job.years += 1;
  L.yearsWorked = (L.yearsWorked ?? 0) + 1;

  const next = career.levels[job.level + 1];
  const able = !next?.needs || Object.entries(next.needs).every(([path, min]) => {
    const key = path.split('.')[1];
    return path === 'tripleThreat' ? Math.min(npc.talents?.singing ?? 0, npc.talents?.dance ?? 0, npc.talents?.acting ?? 0) + 8 >= min
      : path.startsWith('talents.') ? (npc.talents?.[key] ?? 0) >= min : npc.meters[key] === undefined || npc.meters[key] >= min * 0.9;
  });
  // A spouse's chances follow the household plan agreed with the player (engine/couple.js).
  if (next && able && job.years >= level.years && rng.chance((0.18 + npc.meters.intellect / 500) * spouseFactor(npc))) {
    job.level += 1;
    job.title = eraTitle(job.careerId, job.level, worldYear()) ?? next.title;
    job.salary = Math.max(Math.round(job.salary * 1.08), bandPay(next, 0.2));
    job.years = 0;
    npc.occupation = next.title.toLowerCase();
    if (!quiet) {
      note(npc, `was promoted to ${npc.occupation}`, 'close', 'good');
      if (npc.role === 'spouse' && rng.chance(0.2)) ask('spouse_job_away', { love: npc.id });
    }
  } else {
    job.salary = Math.min(Math.round(job.salary * 1.025), Math.round(bandPay(level, 1) * 1.2));
    if (career.skill === 'tripleThreat') for (const k of ['singing', 'dance', 'acting']) npc.talents[k] = clamp((npc.talents[k] ?? 30) + 1);
    if (!quiet && career.type === 'fulltime' && rng.chance(0.014)) {
      note(npc, `was laid off from ${pronoun(npc)} job as ${an(npc.occupation)}`, 'close', 'bad');
      L.lastJob = { careerId: job.careerId, level: job.level };
      L.job = null;
      npc.occupation = 'between jobs';
    }
  }
}

/** What they keep after tax, per year. */
export const netIncome = (npc) => Math.round((npc.life?.job?.salary ?? npc.life?.pension ?? 0) * (1 - country().incomeTax));

// ---------- Education ----------

function chooseMajor(npc) {
  const t = npc.talents ?? {};
  if ((t.singing ?? 0) >= 60 && (t.dance ?? 0) >= 55 && (t.acting ?? 0) >= 55) return 'musical_theater';
  if ((t.acting ?? 0) >= 70) return 'theater';
  if ((t.music ?? 0) >= 70) return 'music';
  const gpa = npc.life.edu.gpa;
  const open = MAJORS.filter((m) => !m.audition && gpa >= m.minGpa && majorOpen(m.id, worldYear()));
  return rng.pick(open.length ? open : MAJORS.filter((m) => !m.audition && m.minGpa <= 2.2 && majorOpen(m.id, worldYear()))).id;
}

/** What they do at 18. The player's advice (flags set by a scene) can tilt it. */
function choosePath(npc, quiet) {
  const e = npc.life.edu;
  const f = npc.flags;
  // In earlier eras university was for few (Historical Eras): the same people, far fewer places.
  let uni = clamp((e.gpa - 2) / 2 * 0.8 + (npc.meters.intellect - 50) / 120 + kid.familyPull(npc), 0.05, 0.92) * universityAccess(worldYear());
  if (f.pushUniversity) uni = clamp(uni + 0.3, 0, 0.97);
  if (f.pushWork) uni = clamp(uni - 0.3, 0.02, 1);
  e.degrees.push('high');
  if (rng.chance(uni)) {
    e.stage = 'university';
    e.majorId = chooseMajor(npc);
    e.yearsLeft = 4;
    npc.flags.atUniversity = true;
    const uni = ['child', 'grandchild'].includes(npc.role) ? kid.chooseUniversity(npc) : null;
    if (!quiet) {
      note(npc, `finished school and went to ${uni?.name ?? 'university'} to study ${MAJOR_BY_ID[e.majorId].name}`, true, 'good');
      if (npc.role === 'child' && rng.chance(0.6)) ask('kid_tuition', { kid: npc.id });
    }
  } else if (rng.chance(0.35)) {
    e.stage = 'apprenticeship';
    e.trade = rng.pick(TRADES).id;
    e.yearsLeft = 3;
    if (!quiet) note(npc, `finished school and started an apprenticeship as ${an(TRADE_BY_ID[e.trade].name.toLowerCase())}`, true);
  } else {
    e.stage = 'done';
    if (!quiet) note(npc, 'finished school and went looking for work', true);
  }
}

function tickEducation(npc, quiet = false) {
  const L = npc.life;
  const e = L.edu;
  const a = npc.age;
  const close = npc.role === 'child';
  if (a === 5) { e.stage = 'elementary'; e.gpa = clamp(npc.meters.intellect / 25 + rng.around(0, 0.4), 0.8, 4); if (!quiet) note(npc, 'started school', close); }
  if (a === 11) { e.stage = 'middle'; if (!quiet) note(npc, 'moved up to middle school'); }
  if (a === 14) { e.stage = 'high'; if (!quiet) note(npc, 'started high school'); }
  // Historical Eras: in earlier years most children left school at the leaving age and went to work.
  const leaving = lawRule('schoolLeavingAge', typeof npc.flags?.abroad === 'string' ? npc.flags.abroad : store.state.player.countryId);
  if (a === leaving && leaving < 18 && ['elementary', 'middle', 'high'].includes(e.stage) && !rng.chance(secondaryShare(worldYear()))) {
    e.stage = 'done';
    e.leftAt = a;
    if (!quiet) note(npc, `left school at ${a} and went to work`, close);
    return;
  }
  if (a >= 6 && a <= 17) {
    // A child of the player's: the school they are at, and this year's help at home, tell too.
    const k = npc.role === 'child' ? kid.edge(npc) : { steady: 0, once: 0 };
    e.gpa = Math.round(clamp(e.gpa * 0.8 + (npc.meters.intellect / 25 + rng.around(0, 0.35) + k.steady) * 0.2 + k.once * 0.6, 0.5, 4) * 100) / 100;
    if (!L.hobby && a >= 7 && rng.chance(0.3) && npc.talents) {
      const [key] = Object.entries(npc.talents).filter(([k]) => HOBBIES[k]).sort((x, y) => y[1] - x[1])[0];
      L.hobby = key;
      if (!quiet) note(npc, rng.pick(HOBBIES[key]), close);
    }
    if (L.hobby) npc.talents[L.hobby] = clamp(npc.talents[L.hobby] + rng.int(1, 2));
    if (!quiet && a >= 8 && rng.chance(0.16)) {
      const options = SCHOOL_MOMENTS.filter((m) => m.when(npc) && !L.history.some((h) => h.text === m.text));
      if (options.length) {
        const m = rng.pick(options);
        for (const [k, v] of Object.entries(m.meters)) npc.meters[k] = clamp(npc.meters[k] + v);
        note(npc, m.text);
      }
    }
  }
  if (a === 17 && !quiet && npc.role === 'child') ask('kid_decides', { kid: npc.id });
  // A child tells their parent who they are, when they are ready.
  if (!quiet && npc.role === 'child' && a >= 13 && a <= 22 && npc.orientation && npc.orientation !== 'straight' && !npc.flags.cameOut && rng.chance(0.25)) {
    if (ask('kid_comes_out', { kid: npc.id })) npc.flags.cameOut = true;
  }
  if (!quiet && npc.role === 'child' && a >= 6 && a <= 24 && npc.flags.trans && !npc.flags.transitioned && rng.chance(0.2)) {
    if (ask('kid_is_trans', { kid: npc.id })) npc.flags.toldParent = true;
  }
  if (a === 18 && ['high', 'none', 'middle', 'elementary'].includes(e.stage)) choosePath(npc, quiet);

  if (e.yearsLeft > 0 && a > 18) {
    e.yearsLeft -= 1;
    if (e.stage === 'university' && !quiet && e.yearsLeft > 0 && rng.chance(0.03)) {
      e.stage = 'done'; e.yearsLeft = 0; npc.flags.atUniversity = false;
      note(npc, 'dropped out of university', true, 'bad');
    } else if (e.yearsLeft === 0) {
      if (e.stage === 'university') {
        e.degrees.push('university');
        npc.flags.atUniversity = false;
        npc.meters.intellect = clamp(npc.meters.intellect + 5);
        if (npc.flags.studentDebt) npc.life.savings -= localMoney(24000, country());
        kid.graduated(npc);
        if (!quiet) note(npc, `graduated from ${kid.uniName(npc) ?? 'university'} with a degree in ${MAJOR_BY_ID[e.majorId].name}`, true, 'good');
        const tracks = MAJOR_BY_ID[e.majorId].tracks;
        if (tracks.length && e.gpa >= 3.3 && rng.chance(0.3)) {
          e.stage = rng.pick(tracks); e.yearsLeft = e.stage === 'law' ? 3 : 4;
          if (!quiet) note(npc, `was accepted to ${e.stage} school`, true, 'good');
          return;
        }
      } else if (e.stage === 'apprenticeship') {
        e.degrees.push('apprenticeship');
        if (!quiet) note(npc, `qualified as ${an(TRADE_BY_ID[e.trade].name.toLowerCase())}`, true, 'good');
      } else {
        e.degrees.push(e.stage);
        if (!quiet) note(npc, e.stage === 'medical' ? 'qualified as a doctor' : 'qualified as a lawyer', true, 'good');
      }
      e.stage = 'done';
    }
  }
}

// ---------- Ambition ----------

/** How far along a 'measured' ambition is, from the life actually lived (0–100). */
const MEASURES = {
  career_top: (n) => (n.life.job ? n.life.job.level / (CAREER_BY_ID[n.life.job.careerId].levels.length - 1) * 100 : 0),
  own_home: (n) => (n.life.fin?.home ? 100 : n.life.savings / localCost(60000, country()) * 100),
  family: (n) => (n.role === 'spouse' || n.role === 'partner'
    ? livingNpcs().filter((k) => k.role === 'child').length : n.life.kids) / 2 * 100,
  degree: (n) => (n.life.edu.degrees.includes('university') ? 100 : n.life.edu.stage === 'university' ? 60 : 0),
  stage: (n) => (n.life.job && CAREER_BY_ID[n.life.job.careerId].category === 'performing' ? 55 + n.life.job.level * 45 : 0),
};

function chooseAspiration(npc) {
  const picked = rng.weighted(ASPIRATIONS, (a) => a.fits(npc));
  npc.life.aspiration = { id: picked.id, text: picked.text.replace(/\btheir\b/g, pronoun(npc)), progress: 0, achieved: false };
}

function tickAspiration(npc, quiet = false) {
  const L = npc.life;
  if (!L.aspiration && npc.age >= 16) {
    chooseAspiration(npc);
    if (!quiet) note(npc, `says ${pronoun(npc)} ambition is to ${L.aspiration.text}`, npc.role === 'child');
  }
  const asp = L.aspiration;
  if (!asp || asp.achieved || npc.age < 18) return;
  const def = ASPIRATIONS.find((a) => a.id === asp.id);
  let boost = 0;
  if (npc.flags.backed) { boost += 35; npc.flags.backed = false; }
  if (npc.flags.heldBack) { boost -= 20; npc.flags.heldBack = false; }
  asp.boost = (asp.boost ?? 0) + boost;
  asp.progress = Math.round(clamp(def.kind === 'measured'
    ? MEASURES[asp.id](npc) + asp.boost
    : asp.progress + rng.int(2, 7) + boost));
  if (asp.progress >= 100) {
    asp.achieved = true;
    if (!quiet) {
      note(npc, `achieved a lifelong ambition: to ${asp.text}`, true, 'good');
      if (npc.role === 'spouse' || npc.role === 'child') player().stats.mood = clamp(player().stats.mood + 5);
    }
  } else if (!quiet && npc.role === 'spouse' && def.kind === 'slow' && !npc.flags.dreamAsked && asp.progress >= 20 && rng.chance(0.15)) {
    npc.flags.dreamAsked = true;
    ask('spouse_dream', { love: npc.id });
  }
}

/** The player cheers someone on. Once a year per person. */
export function encourage(npcId) {
  const npc = npcOf(npcId);
  const asp = npc.life?.aspiration;
  if (!asp || asp.achieved) return result(false, 'There is nothing to encourage right now.', 'neutral');
  if (!spendAction(npc, 'encourage')) return result(false, `You have already encouraged ${npc.firstName} this year.`, 'neutral');
  asp.boost = (asp.boost ?? 0) + 6;
  asp.progress = clamp(asp.progress + 6);
  npc.meters.relationship = clamp(npc.meters.relationship + 4);
  remember(npc, 'encouraged', `You encouraged ${pronoun(npc)} ambition to ${asp.text}.`);
  const text = `You told ${npc.firstName} you believe they can ${asp.text}. It mattered more than you expected.`;
  log(text, 'system', 'good');
  return result(true, text);
}

// ---------- Love and family ----------

function meetPartner(npc) {
  const p = player();
  const L = npc.life;
  if (!FAMILY_MAKERS.includes(npc.role) || !room()) { // their family stays off-screen
    L.offscreenPartner = true;
    note(npc, 'met someone');
    return;
  }
  // Who they fall for follows who they are.
  const same = npc.orientation === 'gay' ? true : ['bisexual', 'pansexual'].includes(npc.orientation) ? rng.chance(0.5) : false;
  const gender = same ? npc.gender : npc.gender === 'male' ? 'female' : 'male';
  const surnames = country().names.last.filter((n) => n !== npc.lastName);
  const love = addNpc(makeNpc({ role: 'inlaw', countryId: p.countryId, gender, age: Math.max(18, npc.age + rng.int(-4, 5)),
    lastName: rng.pick(surnames), relationship: rng.int(40, 60), orientation: same ? rng.pick(['gay', 'gay', 'bisexual']) : rng.pick(['straight', 'straight', 'straight', 'bisexual']) }));
  love.flags.partnerOf = npc.id;
  ensureLife(love);
  L.partnerId = love.id;
  L.together = 0;
  note(npc, `started seeing ${love.firstName} ${love.lastName}`, npc.role === 'child');
}

function haveBaby(npc, love) {
  const p = player();
  const L = npc.life;
  const pair = [npc.gender, love.gender].sort().join('+');
  const adopted = pair !== 'female+male';
  const genes = (n) => ({ appearance: n.appearance, traits: n.traits ?? [], talents: n.talents ?? {}, meters: n.meters });
  const [mother, father] = npc.gender === 'female' ? [npc, love] : [love, npc];
  const baby = addNpc(makeNpc({ role: CHILD_ROLE[npc.role], countryId: p.countryId, lastName: npc.lastName,
    age: adopted ? rng.int(0, 5) : 0, relationship: rng.int(55, 80),
    appearance: adopted ? undefined : inheritAppearance(genes(mother), genes(father)) }));
  if (!adopted) {
    baby.talents = inheritTalents(genes(mother), genes(father));
    baby.traits = inheritTraits(genes(mother), genes(father)).traits;
    baby.meters.intellect = Math.round(clamp((npc.meters.intellect + love.meters.intellect) / 2 + rng.around(0, 18)));
    baby.meters.charm = Math.round(clamp((npc.meters.charm + love.meters.charm) / 2 + rng.around(0, 18)));
  } else {
    baby.adopted = true;
    baby.talents = { music: rng.int(0, 60), sports: rng.int(0, 60), acting: rng.int(0, 60), crime: rng.int(0, 60), singing: rng.int(0, 60), dance: rng.int(0, 60) };
  }
  baby.parentIds = [npc.id, love.id];
  ensureLife(baby);
  L.kids += 1;
  love.life.kids = (love.life.kids ?? 0) + 1;
  const kind = baby.gender === 'male' ? 'boy' : 'girl';
  note(npc, `${adopted ? `adopted a ${kind}` : `had a baby ${kind}`}, ${baby.firstName}`, true, 'good');
  if (npc.role === 'child') {
    p.stats.mood = clamp(p.stats.mood + 8);
    if (!p.flags.isGrandparent) { p.flags.isGrandparent = true; milestone('Became a grandparent.', 'family'); }
    ask('grandchild_born', { kid: npc.id, baby: baby.id });
    letter(`${npc.firstName} has had a baby ${kind}, ${baby.firstName}. A grandchild you have not held.`);
  }
  if (npc.role === 'grandchild' && !p.flags.isGreatGrandparent) { p.flags.isGreatGrandparent = true; milestone('Became a great-grandparent.', 'family'); }
}

function tickLove(npc) {
  const L = npc.life;
  const a = npc.age;
  if (npc.role === 'spouse' || npc.role === 'partner' || npc.role === 'inlaw' || npc.role === 'niece' || npc.role === 'greatgrandchild') return;

  // Friends and distant relatives: it happens, but off-screen.
  if (!FAMILY_MAKERS.includes(npc.role) || L.offscreenPartner) {
    if (!L.offscreenPartner && a >= 20 && a <= 45 && rng.chance(0.1)) meetPartner(npc);
    else if (L.offscreenPartner && !L.married && rng.chance(0.2)) { L.married = true; note(npc, 'got married'); }
    else if (L.married && L.kids < 2 && a <= 42 && rng.chance(0.12)) { L.kids += 1; note(npc, 'had a baby'); }
    return;
  }

  const love = npcOf(L.partnerId);
  if (!love?.alive) {
    if (L.partnerId && love && !love.alive) { note(npc, `was widowed when ${love.firstName} died`, true, 'bad'); L.married = false; }
    L.partnerId = null;
    if (a >= 19 && a <= 50 && rng.chance(a < 32 ? 0.15 : 0.07)) meetPartner(npc);
    return;
  }
  L.together += 1;
  if (!L.married) {
    if (L.together >= 2 && rng.chance(0.3)) {
      L.married = true;
      love.flags.married = true;
      note(npc, `married ${love.firstName} ${love.lastName}`, true, 'good');
      if (npc.role !== 'grandchild' || rng.chance(0.5)) ask('family_wedding', { who: npc.id, inlaw: love.id });
      if (NEWSWORTHY.includes(npc.role)) letter(`${npc.firstName} and ${love.firstName} were married last month. There is a photograph, and an empty chair in it where you should have been.`);
    } else if (rng.chance(0.1) && !L.kids) {
      note(npc, `split up with ${love.firstName}`, npc.role === 'child');
      removeNpc(love);
      L.partnerId = null;
      return;
    }
  } else if (rng.chance(0.012)) {
    note(npc, `divorced ${love.firstName}`, true, 'bad');
    L.married = false;
    L.partnerId = null;
    if (L.kids) { love.flags.former = true; love.flags.married = false; } else removeNpc(love);
    return;
  }
  const motherAge = npc.gender === 'female' ? a : love.age;
  const couple = [npc.gender, love.gender].sort().join('+') === 'female+male';
  if ((L.married || L.together >= 3) && L.kids < (MAX_KIDS[npc.role] ?? 2) && (couple ? motherAge <= 42 : a <= 45) && room()
      && rng.chance(couple ? 0.16 : 0.05)) {
    haveBaby(npc, love);
  }
}

// ---------- Everything else ----------

function tickMoments(npc) {
  for (const m of ADULT_MOMENTS) {
    if (!rng.chance(m.chance) || (m.when && !m.when(npc))) continue;
    for (const [k, v] of Object.entries(m.meters ?? {})) npc.meters[k] = clamp(npc.meters[k] + v);
    if (m.savings) npc.life.savings = Math.round(npc.life.savings * (1 + m.savings));
    note(npc, m.text, !!m.trouble && npc.role === 'child', m.trouble ? 'bad' : 'neutral');
    if (m.trouble && npc.role === 'child') ask('kid_in_a_hole', { kid: npc.id });
    return;
  }
}

function tickMoney(npc) {
  const L = npc.life;
  const earned = netIncome(npc);
  if (earned) L.savings = Math.round(L.savings * 1.01 + earned * 0.12);
  const base = (L.job?.salary ?? L.pension ?? 0) / country().currency.scale;
  npc.meters.money = Math.round(clamp(Math.sqrt(base / 1000) * 6 + Math.sqrt(Math.max(0, L.savings) / country().currency.scale / 1000) * 2));
  npc.wealth = npc.meters.money;
}

/** One year in someone's life. `quiet` is used when catching a life up to the present. */
function tickLife(npc, quiet = false) {
  const L = npc.life;
  tickEducation(npc, quiet);
  const studying = (L.edu.yearsLeft ?? 0) > 0;
  if (npc.age >= 18 && !studying && L.edu.stage === 'done') {
    if (L.job) tickJob(npc, quiet);
    else if (npc.age < 66 && !L.retired) startJob(npc, quiet);
    if (L.job && npc.age >= 66) {
      L.pension = Math.min(localWage(150000, country()), Math.round(L.job.salary * Math.min(0.6, (L.yearsWorked ?? 0) * 0.015)));
      if (!quiet) note(npc, `retired as ${an(npc.occupation)}`, true);
      npc.occupation = `retired ${npc.occupation}`;
      L.job = null;
      L.retired = true;
    }
  }
  if (!quiet) {
    if (npc.age >= 18) tickLove(npc);
    if (npc.age >= 19) tickMoments(npc);
  }
  tickAspiration(npc, quiet);
  tickMoney(npc);
  // The people closest to the player keep fuller books: a home, a mortgage, debts (engine/npcMoney.js).
  if (tickNpcMoney(npc, quiet) === 'bought' && !quiet) note(npc, `bought ${npc.life.fin.home.name}`, true, 'good');
}

/**
 * Gives someone a life record, catching it up to their current age so an
 * adult who walks into the player's life already has a job, savings and an
 * ambition.
 */
export function ensureLife(npc) {
  if (!npc || npc.life || !LIVE.includes(npc.role)) return;
  npc.talents ??= { music: rng.int(0, 55), sports: rng.int(0, 55), acting: rng.int(0, 55), crime: rng.int(0, 55),
    singing: rng.int(0, 55), dance: rng.int(0, 55) };
  npc.life = { edu: { stage: 'none', gpa: 0, majorId: null, trade: null, degrees: [], yearsLeft: 0 },
    job: null, savings: 0, aspiration: null, partnerId: null, together: 0, married: false, kids: 0, history: [] };
  const now = npc.age;
  for (let a = 5; a <= now; a++) {
    npc.age = a;
    tickLife(npc, true);
  }
  npc.age = now;
}

/** Yearly: everyone who has a life lives another year of it. */
export function tickLives() {
  for (const npc of livingNpcs()) {
    if (!LIVE.includes(npc.role)) continue;
    if (!npc.life) { ensureLife(npc); continue; }
    tickLife(npc);
  }
}

/** A short description of where someone's life stands, for display. */
export function lifeSummary(npc) {
  const L = npc.life;
  if (!L) return [];
  const c = country();
  const rows = [];
  const e = L.edu;
  const school = { elementary: 'Elementary school', middle: 'Middle school', high: 'High school', university: 'In college',
    apprenticeship: 'Apprentice', medical: 'At medical school', law: 'At law school' }[e.stage];
  // A child of the player's at school, or at a named university, has a fuller line of its own (kidschool.schoolLine).
  const named = npc.role === 'child' && (kid.schoolLine(npc));
  if (named) { /* shown by the People tab */ } else if (school && e.stage !== 'done') {
    rows.push(['Education', school + (e.stage === 'university' ? `, ${MAJOR_BY_ID[e.majorId].name}` : e.stage === 'apprenticeship' ? ` ${TRADE_BY_ID[e.trade].name.toLowerCase()}` : '')
      + (npc.age >= 6 && npc.age <= 17 ? `, ${showMark(e.gpa, schoolModel(npc.countryId ?? country().id).grading)}` : '')]);
  } else if (e.degrees.length) {
    const top = e.degrees.includes('medical') ? 'Medical degree' : e.degrees.includes('law') ? 'Law degree'
      : e.degrees.includes('university') ? `Degree in ${MAJOR_BY_ID[e.majorId].name}`
        : e.degrees.includes('apprenticeship') ? `Qualified ${TRADE_BY_ID[e.trade].name.toLowerCase()}` : 'High-school diploma';
    rows.push(['Education', top]);
  }
  if (L.job) rows.push(['Work', `${L.job.title}, ${fmtMoney(L.job.salary, c)} a year`]);
  else if (L.retired) rows.push(['Work', `Retired, pension ${fmtMoney(L.pension ?? 0, c)} a year`]);
  else if (npc.age >= 18 && e.stage === 'done') rows.push(['Work', 'Between jobs']);
  if (npc.age >= 18) rows.push(['Savings', fmtMoney(L.savings, c)], ...finRows(npc));
  const love = npcOf(L.partnerId);
  if (love?.alive) rows.push([L.married ? 'Married to' : 'Seeing', `${love.firstName} ${love.lastName}`]);
  else if (L.offscreenPartner) rows.push(['Relationship', L.married ? 'Married' : 'Seeing someone']);
  if (L.kids) rows.push(['Children', String(L.kids)]);
  if (L.hobby && npc.age < 18) rows.push(['Loves', L.hobby]);
  if (L.aspiration) {
    rows.push(['Ambition', `To ${L.aspiration.text}${L.aspiration.achieved ? ' (achieved)' : `: ${L.aspiration.progress}% of the way`}`]);
  }
  return rows;
}


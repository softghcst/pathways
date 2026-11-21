// Working life: bosses, coworkers and the choices that shape a review.
// These need a job with a boss, so freelancers do not see them.
import { st, hid, cash, rel, ms, addNpc, ok, bad, any, chk, need, mem, perf, pay, fired, promoted, heat, count } from './helpers.js';

const employed = need('employed', '==', true);

/** @type {import('../../types.js').GameEvent[]} */
export default [
  {
    id: 'credit_taken', category: 'work', ageRange: [18, 66], requires: [employed], cast: { mate: 'coworker', boss: 'tag:boss' },
    text: 'In the Monday meeting, {mate} presents the work you stayed late all last week to finish, as their own. {boss} is nodding along.',
    choices: [
      { label: 'Say, calmly, that it is your work', check: chk(0.5, { 'stats.charm': 0.6, 'cast.boss.relationship': 0.3 }), outcomes: [
        ok('"I can walk everyone through how I built that." You can, and you do. {boss} notices who knows the detail.', perf(8), rel('mate', -12), rel('boss', 5)),
        bad('It comes out sharper than you meant. The room goes quiet and {boss} moves the meeting on.', perf(-3), rel('mate', -15), rel('boss', -4)),
      ] },
      { label: 'Talk to {mate} afterward', check: chk(0.5, { 'cast.mate.relationship': 0.7 }), outcomes: [
        ok('{mate} goes red and emails {boss} a correction before lunch.', perf(5), rel('mate', 4)),
        bad('{mate} says "we are all one team" and walks off.', rel('mate', -10), st('mood', -4)),
      ] },
      { label: 'Send {boss} the paper trail', outcomes: [any('Timestamps do not argue. {boss} says nothing, and gives you the next project directly.', 'good', perf(6), rel('mate', -18), hid('karma', -1))] },
      { label: 'Let it go', outcomes: [any('You tell yourself it does not matter. It matters at review time.', 'bad', perf(-5), st('mood', -4))] },
    ],
  },
  {
    id: 'weekend_ask', category: 'work', ageRange: [18, 66], requires: [employed], cast: { boss: 'tag:boss' }, cooldown: 4,
    text: 'At five on Friday, {boss} appears at your shoulder: the deadline has moved, and they need you in all weekend.',
    choices: [
      { label: 'Say yes', outcomes: [any('You lose the weekend and gain a boss who remembers it.', 'neutral', perf(6), st('mood', -5), rel('boss', 8),
        mem('boss', 'workedWeekend', 'You gave up a weekend at no notice when the deadline moved.'))] },
      { label: 'Say yes, for time off in return', check: chk(0.55, { 'stats.charm': 0.4, 'cast.boss.relationship': 0.5 }), outcomes: [
        ok('{boss} agrees to two days back next month. Fair is fair.', perf(5), rel('boss', 3)),
        bad('"This is not a negotiation." You work it anyway.', perf(3), st('mood', -6), rel('boss', -4)),
      ] },
      { label: 'Say you have plans', outcomes: [any('{boss} finds someone else, and makes a small note of it.', 'neutral', perf(-3), st('mood', 3), rel('boss', -5))] },
    ],
  },
  {
    id: 'cover_mistake', category: 'work', ageRange: [18, 66], requires: [employed], cast: { mate: 'coworker' },
    text: '{mate} has made a mistake that will cost the company real money, and asks you to say you were both working from the same wrong figures.',
    choices: [
      { label: 'Cover for them', check: chk(0.6, { 'talents.crime': 0.3, 'stats.charm': 0.2 }), outcomes: [
        ok('The story holds. {mate} owes you, and knows it.', rel('mate', 18), hid('karma', -4), mem('mate', 'coveredForMe', 'You lied to cover a costly mistake of theirs.')),
        bad('The story falls apart in one meeting, and now it is your mistake too.', perf(-15), rel('mate', 5), hid('karma', -4)),
      ] },
      { label: 'Tell them to own up, and offer to go in with them', outcomes: [any('{mate} is furious for a day and grateful for a year.', 'good', rel('mate', 6), hid('karma', 5), perf(2))] },
      { label: 'Report it yourself', outcomes: [any('It is dealt with by the afternoon. {mate} does not speak to you again.', 'neutral', perf(4), rel('mate', -25), hid('karma', 1))] },
    ],
  },
  {
    id: 'headhunter', category: 'work', ageRange: [22, 60], requires: [employed, need('career.performance', '>=', 60)], cast: { boss: 'tag:boss' }, cooldown: 8,
    text: 'A recruiter calls: a rival wants you, for a fifth more money. You have not told {boss}.',
    choices: [
      { label: 'Take it', outcomes: [any('New badge, new desk, same work, twenty percent more. {boss} shakes your hand without warmth.', 'good', pay(1.2), perf(-5), rel('boss', -15), st('mood', 5))] },
      { label: 'Use it to ask for more here', check: chk(0.5, { 'career.performance': 0.8, 'cast.boss.relationship': 0.4 }), outcomes: [
        ok('{boss} matches most of it within the hour rather than lose you.', pay(1.12), rel('boss', -3)),
        bad('{boss} wishes you well in your new role. You do not have a new role yet.', rel('boss', -12), perf(-6), st('mood', -5)),
      ] },
      { label: 'Say no, and mention it to nobody', outcomes: [any('It is oddly satisfying to know what you are worth.', 'neutral', st('mood', 3), hid('discipline', 1))] },
    ],
  },
  {
    id: 'work_party', category: 'work', ageRange: [18, 66], requires: [employed], cast: { mate: 'coworker', boss: 'tag:boss' }, cooldown: 5,
    text: 'The end-of-year party. There is a free bar, a dance floor, and everyone you have to face on Monday.',
    choices: [
      { label: 'Throw yourself into it', check: chk(0.5, { 'stats.charm': 0.5, 'hidden.discipline': 0.4 }), outcomes: [
        ok('You are the reason the dance floor fills. People you have never spoken to say hello for weeks.', st('mood', 8), st('charm', 2), rel('mate', 8), rel('boss', 3)),
        bad('You tell {boss} what you really think of the new strategy. At length. Twice.', st('mood', -6), rel('boss', -12), perf(-5)),
      ] },
      { label: 'Two drinks and a proper conversation', outcomes: [any('You learn more about {mate} in an hour than in a year of meetings.', 'good', rel('mate', 10), st('mood', 4))] },
      { label: 'Stay home', outcomes: [any('You hear all about it on Monday, from everyone.', 'neutral', st('mood', -1))] },
    ],
  },
  {
    id: 'big_presentation', category: 'work', ageRange: [20, 66], requires: [employed], cast: { boss: 'tag:boss' }, cooldown: 4,
    text: '{boss} wants you to present to the people at the very top. You have a week.',
    choices: [
      { label: 'Rehearse it until you can do it asleep', check: chk(0.6, { 'hidden.discipline': 0.6, 'stats.intellect': 0.3 }), outcomes: [
        ok('Every question is one you prepared for. {boss} looks like a genius for picking you.', perf(12), rel('boss', 8), st('mood', 6)),
        bad('You know it so well you forget to look up. It is fine. It is not memorable.', perf(2)),
      ] },
      { label: 'Trust yourself to talk it through on the day', check: chk(0.4, { 'stats.charm': 0.8 }), outcomes: [
        ok('No notes, three jokes, one clear ask. They say yes in the room.', perf(14), st('charm', 2), rel('boss', 6)),
        bad('You lose your thread on the second slide and never quite find it.', perf(-8), st('mood', -6), rel('boss', -5)),
      ] },
      { label: 'Suggest someone else does it', outcomes: [any('{boss} gives it to someone hungrier.', 'neutral', perf(-4), rel('boss', -4))] },
    ],
  },
  {
    id: 'seen_something', category: 'work', ageRange: [18, 66], requires: [employed], cast: { mate: 'coworker', boss: 'tag:boss' }, once: true,
    text: 'You walk in on a senior manager cornering {mate} by the stock room, and saying things nobody should have to hear at work. They both see you.',
    choices: [
      { label: 'Report it, with {mate}\'s agreement', outcomes: [any(
        'It is slow and unpleasant and it is the right thing. The manager is gone within the quarter.', 'good',
        hid('karma', 10), rel('mate', 20), perf(-2), mem('mate', 'backedMeUp', 'You reported what you saw when a manager harassed them.'))] },
      { label: 'Check on {mate} and let them decide', outcomes: [any('{mate} is not ready to report it, and is glad somebody knows.', 'good', hid('karma', 5), rel('mate', 14),
        mem('mate', 'checkedOnMe', 'You checked on them after a manager harassed them.'))] },
      { label: 'Back out and say nothing', outcomes: [any('You tell yourself it was not your place. {mate} stops meeting your eye.', 'bad', hid('karma', -8), rel('mate', -15), st('mood', -4))] },
    ],
  },
  {
    id: 'new_starter', category: 'work', ageRange: [24, 66], requires: [employed, need('career.yearsInRole', '>=', 1)], cast: { boss: 'tag:boss' }, cooldown: 6,
    text: '{boss} asks if you would show the new starter the ropes for their first month.',
    choices: [
      { label: 'Do it properly', outcomes: [any('{newbie} learns fast and tells everyone who taught them.', 'good', perf(5), hid('karma', 3), rel('boss', 4),
        addNpc('coworker', 'newbie', { ageOffset: -6, relationship: 70, memory: ['trainedMe', 'You showed them the ropes in their first month.'] }))] },
      { label: 'Give them the manual and your extension', outcomes: [any('{newbie} works it out alone, eventually.', 'neutral', addNpc('coworker', 'newbie', { ageOffset: -6, relationship: 40 }))] },
      { label: 'Say you are too busy', outcomes: [any('{boss} asks someone else.', 'neutral', rel('boss', -3))] },
    ],
  },
  {
    id: 'expenses', category: 'work', ageRange: [20, 66], requires: [employed], cooldown: 8,
    text: 'Nobody checks expense claims here. Everybody knows nobody checks.',
    choices: [
      { label: 'Claim what you spent', outcomes: [any('Receipts stapled, total correct. It takes four minutes.', 'good', hid('karma', 2), hid('discipline', 1))] },
      { label: 'Round everything up a little', check: chk(0.8, { 'talents.crime': 0.3 }), outcomes: [
        ok('An extra {$400} appears in your account. Nobody says a word.', cash(400), hid('karma', -4), count('crimes')),
        bad('Somebody does check, this once. You repay it and sign a written warning.', perf(-15), hid('karma', -4), st('mood', -6), count('crimes')),
      ] },
      { label: 'Invent a client dinner', check: chk(0.55, { 'talents.crime': 0.5 }), outcomes: [
        ok('{$1500} for a meal that never happened.', cash(1500), hid('karma', -8), count('crimes'), heat(5)),
        bad('The restaurant closed two years ago. You are walked out of the building with a box.', hid('karma', -8), count('crimes'), heat(10), fired('dismissed for fraud')),
      ] },
    ],
  },
  {
    id: 'burnout', category: 'work', ageRange: [26, 60], requires: [employed, need('career.performance', '>=', 70)], cooldown: 8,
    text: 'You have been excellent for a long time, and this morning you sat in the parking lot for forty minutes, unable to go in.',
    choices: [
      { label: 'Take two weeks off', outcomes: [any('You sleep for most of the first one. By the second you remember what you like doing.', 'good', perf(-4), st('mood', 14), st('health', 5))] },
      { label: 'Go in and push through', check: chk(0.4, { 'hidden.willpower': 0.7 }), outcomes: [
        ok('It passes, this time.', perf(3), st('health', -2)),
        bad('Your body makes the decision you would not. You are signed off for a month.', perf(-10), st('health', -8), st('mood', -8)),
      ] },
      { label: 'Tell your boss the truth', outcomes: [any('It is an easier conversation than you spent six months imagining. Your workload is cut by a third.', 'good', st('mood', 8), perf(-2), hid('crazy', -3))] },
    ],
  },
  {
    id: 'boss_leaving', category: 'work', ageRange: [26, 62], requires: [employed, need('career.yearsInRole', '>=', 2)], cast: { boss: 'tag:boss' }, cooldown: 10,
    text: '{boss} is leaving for a bigger job, and tells you before anyone else. Their role will be advertised on Monday.',
    choices: [
      { label: 'Go for it', check: chk(0.3, { 'career.performance': 0.9, 'cast.boss.relationship': 0.4 }), outcomes: [
        ok('{boss} puts your name forward on the way out of the door. It is yours.', promoted(), rel('boss', 6)),
        bad('It goes to an outsider with a longer CV. {boss} says, privately, that it was close.', st('mood', -5), perf(2)),
      ] },
      { label: 'Ask {boss} to take you with them', check: chk(0.3, { 'cast.boss.relationship': 0.9 }), outcomes: [
        ok('"I was hoping you would ask." You follow them, with a raise.', pay(1.15), rel('boss', 8)),
        bad('"Not this time. I need to arrive on my own."', st('mood', -3)),
      ] },
      { label: 'Wish them well', outcomes: [any('You buy the card and get everyone to sign it.', 'neutral', rel('boss', 4))] },
    ],
  },

  // ---------- The stage ----------
  {
    id: 'understudy_on', category: 'the stage', ageRange: [18, 60], cooldown: 6, weight: 3,
    requires: [need('career.careerId', '==', 'mt_performer'), need('career.level', '<=', 1)],
    text: 'Half an hour before curtain, the lead goes down with no voice. The stage manager looks at you: "You know the track. You are on."',
    choices: [
      { label: 'Go on', check: chk(0.45, { tripleThreat: 1.2 }), outcomes: [
        ok('You hit every mark and the last note rings to the back wall. The company applauds you in the wings.', perf(20), st('mood', 14), hid('fame', 4), ms('Went on for the lead at half an hour\'s notice.')),
        bad('You get through it. Just. A missed entrance, a cracked note, a kind audience.', perf(-4), st('mood', -5)),
      ] },
      { label: 'Say you are not ready', outcomes: [any('They cut the number and refund the front rows. You do not sleep.', 'bad', perf(-12), st('mood', -8), hid('willpower', -3))] },
    ],
  },
  {
    id: 'eight_shows', category: 'the stage', ageRange: [18, 60], cooldown: 5, weight: 2,
    requires: [need('career.careerId', '==', 'mt_performer')],
    text: 'Eight shows a week for seven months. Your voice is fraying and your left knee has started to click on the stairs.',
    choices: [
      { label: 'See the company physio and a voice coach', requires: [need('cashBase', '>=', 800)], outcomes: [any(
        'It costs {$800} and gives you back your top notes.', 'good', cash(-800), st('health', 6), perf(5))] },
      { label: 'Mark the dance calls and save yourself', outcomes: [any('The dance captain notices. So does your knee, gratefully.', 'neutral', perf(-5), st('health', 3))] },
      { label: 'Give every show everything', check: chk(0.45, { 'stats.health': 0.8 }), outcomes: [
        ok('You are made of something sturdy. The run ends with you stronger than you started.', perf(8), hid('discipline', 3)),
        bad('Your knee goes in the second act on a Wednesday matinée. You are out for six weeks.', perf(-8), st('health', -12), st('mood', -6)),
      ] },
    ],
  },
];

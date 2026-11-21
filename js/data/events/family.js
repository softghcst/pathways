// Raising children, and looking after the family you came from.
import { st, hid, cash, rel, ok, bad, any, chk, need, mem, count, animalHealth } from './helpers.js';

const kidAged = (lo, hi) => [need('cast.kid.age', '>=', lo), need('cast.kid.age', '<=', hi)];

/** @type {import('../../types.js').GameEvent[]} */
export default [
  {
    id: 'sleepless', category: 'parenthood', ageRange: [18, 60], cooldown: 3, weight: 3,
    cast: { kid: 'child' }, castRequires: kidAged(0, 1),
    text: '{kid} has not slept for more than two hours at a stretch in a month. Neither have you.',
    choices: [
      { label: 'Take the nights yourself', outcomes: [any('You learn every creak in the hallway floor. {kid} learns your heartbeat.', 'good', rel('kid', 8), st('health', -4), st('mood', -3), hid('karma', 3))] },
      { label: 'Pay for a night nurse ({$900})', requires: [need('cashBase', '>=', 900)], outcomes: [any('Three weeks of unbroken sleep. You feel like a person again.', 'good', cash(-900), st('health', 3), st('mood', 6))] },
      { label: 'Let them cry it out', outcomes: [any('It works by the fourth night. The first three are terrible.', 'neutral', st('mood', -5), hid('willpower', 3))] },
    ],
  },
  {
    id: 'first_steps', category: 'parenthood', ageRange: [18, 62], weight: 3, cast: { kid: 'child' }, castRequires: kidAged(1, 1), cooldown: 2,
    text: '{kid} lets go of the sofa, wobbles, and takes three steps straight toward the stairs.',
    choices: [
      { label: 'Catch them and cheer', outcomes: [any('{kid} laughs so hard they sit down. You have it on video, sideways.', 'good', rel('kid', 6), st('mood', 9)), any('{kid} laughs so hard they sit down. You will remember it for the rest of your life.', 'good', rel('kid', 6), st('mood', 9))] },
      { label: 'Film it first', outcomes: [any('A perfect video, ending in a small bump and a great deal of noise.', 'neutral', rel('kid', -2), st('mood', 4))] },
    ],
  },
  {
    id: 'kids_gift', category: 'parenthood', ageRange: [22, 70], cooldown: 6, cast: { kid: 'child' }, castRequires: kidAged(5, 11),
    text: '{kid}\'s teacher takes you aside at the gate: "I do not say this often, but that child has a real gift. It would be a shame not to feed it."',
    choices: [
      { label: 'Pay for proper lessons ({$1200})', requires: [need('cashBase', '>=', 1200)], outcomes: [any(
        'Every Saturday for a year. {kid} complains about practice and then cannot be dragged away from it.', 'good', cash(-1200), rel('kid', 8), hid('karma', 3),
        mem('kid', 'lessons', 'You paid for lessons when a teacher said they had a gift.'))] },
      { label: 'Practice with them yourself', check: chk(0.5, { 'hidden.discipline': 0.6 }), outcomes: [
        ok('An hour together every evening. You are not much of a teacher, and {kid} does not mind.', rel('kid', 12), st('mood', 4),
          mem('kid', 'practicedTogether', 'You practiced with them every evening for a year.')),
        bad('It lasts three weeks before life gets in the way.', rel('kid', 1)),
      ] },
      { label: 'Say there is time for that later', outcomes: [any('{kid} stops mentioning it after a while.', 'neutral', rel('kid', -4))] },
    ],
  },
  {
    id: 'kid_in_trouble', category: 'parenthood', ageRange: [25, 70], cooldown: 5, cast: { kid: 'child' }, castRequires: kidAged(7, 15),
    text: 'The school calls: {kid} has hit another child, and says the other child started it.',
    choices: [
      { label: 'Hear {kid}\'s side before anything else', outcomes: [any('It takes an hour to come out: the other child has been at them for weeks. You go back to the school together.', 'good', rel('kid', 10), hid('karma', 3),
        mem('kid', 'listened', 'When the school rang, you heard their side first.'))] },
      { label: 'Punish them', outcomes: [any('No screens for a month. {kid} serves the sentence in silence.', 'neutral', rel('kid', -8), hid('discipline', 1))] },
      { label: 'Tell the school your child would never do that', outcomes: [any('The school has it on camera.', 'bad', st('charm', -2), rel('kid', 3), hid('karma', -2))] },
    ],
  },
  {
    id: 'kid_sneaks_out', category: 'parenthood', ageRange: [32, 75], cooldown: 6, cast: { kid: 'child' }, castRequires: kidAged(14, 17),
    text: 'At two in the morning you find {kid}\'s bed stuffed with pillows and the window open.',
    choices: [
      { label: 'Wait up, and talk when they get in', check: chk(0.55, { 'stats.charm': 0.3, 'cast.kid.relationship': 0.5 }), outcomes: [
        ok('{kid} expected shouting. They get tea, and a deal: tell you where, and be back by one.', rel('kid', 9), hid('karma', 2)),
        bad('It turns into shouting anyway.', rel('kid', -8), st('mood', -4)),
      ] },
      { label: 'Ground them for a month', outcomes: [any('The window is nailed shut, metaphorically. {kid} barely speaks to you.', 'neutral', rel('kid', -12))] },
      { label: 'Close the window and go back to bed', outcomes: [any('You remember being fifteen. You do not sleep much, all the same.', 'neutral', st('mood', -3), rel('kid', 2))] },
    ],
  },
  {
    id: 'kid_asks_deposit', category: 'parenthood', ageRange: [40, 95], cooldown: 8, cast: { kid: 'child' }, castRequires: kidAged(20, 40),
    text: '{kid} calls, working up to something: they have found an apartment and are {$8000} short of the deposit.',
    choices: [
      { label: 'Give it to them', requires: [need('cashBase', '>=', 8000)], outcomes: [any('"Do not pay it back. Pay it forward." {kid} does not know what to say.', 'good', cash(-8000), rel('kid', 15), hid('karma', 6), count('donated', 8000),
        mem('kid', 'deposit', 'You gave them the deposit for their first flat.'))] },
      { label: 'Lend it, properly, with a repayment plan', requires: [need('cashBase', '>=', 8000)], outcomes: [
        { on: 'always', weight: 3, tone: 'good', text: '{kid} pays back every installment, early.', effects: [rel('kid', 6)] },
        { on: 'always', weight: 1, tone: 'bad', text: 'The repayments stop after four months, and neither of you mentions it.', effects: [cash(-6000), rel('kid', -8)] },
      ] },
      { label: 'Say you cannot', outcomes: [any('{kid} says of course, they should not have asked.', 'neutral', rel('kid', -6))] },
    ],
  },
  {
    id: 'parent_needs_care', category: 'family', ageRange: [35, 75], once: true, weight: 3,
    cast: { parent: 'parent' }, castRequires: [need('cast.parent.age', '>=', 74)],
    text: '{parent} has had a second fall, and the doctor says, gently, that they cannot go on living alone.',
    choices: [
      { label: 'Move them in with you', outcomes: [any('The spare room becomes their room. It is hard, and you would not have it any other way.', 'good', rel('parent', 18), hid('karma', 10), st('mood', -4),
        mem('parent', 'tookMeIn', 'When they could not live alone, you took them in.'))] },
      { label: 'Pay for a good care home ({$20000})', requires: [need('cashBase', '>=', 20000)], outcomes: [any('You visit every Sunday. They have made a friend called Arthur and complain about the desserts.', 'good', cash(-20000), rel('parent', 6), hid('karma', 4))] },
      { label: 'Leave it to the rest of the family', outcomes: [any('Somebody else sorts it out. They do not ask you for much, after that.', 'bad', rel('parent', -20), hid('karma', -8))] },
    ],
  },
  {
    id: 'sibling_loan', category: 'family', ageRange: [22, 70], cooldown: 12, cast: { sib: 'sibling' }, castRequires: [need('cast.sib.age', '>=', 20)],
    text: '{sib} turns up unannounced, talks about the weather for ten minutes, and then asks to borrow {$3000}.',
    choices: [
      { label: 'Lend it', requires: [need('cashBase', '>=', 3000)], check: chk(0.55, { 'cast.sib.relationship': 0.5 }), outcomes: [
        ok('{sib} pays it back within the year, with a bottle of something.', rel('sib', 10), hid('karma', 3)),
        bad('You do not see the money again. You see a little less of {sib}, too.', cash(-3000), rel('sib', -6), hid('karma', 3)),
      ] },
      { label: 'Ask what it is really for', outcomes: [any('It takes a while, but {sib} tells you. It is worse than you thought, and they needed someone to say it to.', 'good', rel('sib', 8), st('mood', -2),
        mem('sib', 'asked', 'When they came for money, you asked what was really wrong.'))] },
      { label: 'Say no', outcomes: [any('{sib} nods, finishes their tea, and goes.', 'neutral', rel('sib', -10))] },
    ],
  },
  {
    id: 'pet_poorly', category: 'family', ageRange: [8, 95], cooldown: 6, cast: { pet: 'pet' },
    text: '{pet} has been off their food for three days and is hiding under the bed.',
    choices: [
      { label: 'Take them to the vet ({$350})', requires: [need('cashBase', '>=', 350)], outcomes: [any('It is treatable, and caught early. {pet} is back to stealing socks within the week.', 'good', cash(-350), rel('pet', 10), st('mood', 5), animalHealth('pet', { kind: 'vet', note: 'Off their food for three days. Treatable, and caught early.', costBase: 350, recovered: true }))] },
      { label: 'Sit with them and wait', check: chk(0.5, {}), outcomes: [
        ok('On the fourth day {pet} comes out, eats everything, and pretends nothing happened.', rel('pet', 6), animalHealth('pet', { kind: 'illness', note: 'Off their food for three days. Recovered at home without seeing a vet.', recovered: true })),
        bad('{pet} gets worse before they get better. You do not forgive yourself quickly.', rel('pet', -4), st('mood', -8), animalHealth('pet', { kind: 'illness', note: 'Off their food for three days, and worse before better. Not seen by a vet.', recovered: true })),
      ] },
    ],
  },
  {
    id: 'kid_school_play', category: 'parenthood', ageRange: [24, 70], cooldown: 5, cast: { kid: 'child' }, castRequires: kidAged(6, 12),
    requires: [need('employed', '==', true)],
    text: '{kid}\'s school play is at two on Thursday. So is the meeting your boss has called "non-negotiable".',
    choices: [
      { label: 'Go to the play', outcomes: [any('{kid} finds your face in the third row and forgets their line from sheer delight.', 'good', rel('kid', 12), st('mood', 6),
        mem('kid', 'cameToPlay', 'You left work to be at their school play.'))] },
      { label: 'Go to the meeting', outcomes: [any('The meeting could have been an email. {kid} says it does not matter.', 'neutral', rel('kid', -9), st('mood', -4)), any('The meeting could have been a note on a noticeboard. {kid} says it does not matter.', 'neutral', rel('kid', -9), st('mood', -4))] },
      { label: 'Run from one to the other', check: chk(0.4, { 'stats.health': 0.4 }), outcomes: [
        ok('You slide into the back row for the last song, still holding your laptop.', rel('kid', 6)),
        bad('You miss the play by four minutes and are late back for the meeting.', rel('kid', -5), st('mood', -5)),
      ] },
    ],
  },
];

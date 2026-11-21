// Love, and what it asks of you. castRequires tests the person actually cast
// (cast.<key>.relationship, cast.<key>.age), so scenes only fire when they fit.
import { st, hid, cash, rel, flag, ok, bad, any, chk, need, mem, npcSet, count } from './helpers.js';

const single = need('roles', 'lacks', 'spouse');

/** @type {import('../../types.js').GameEvent[]} */
export default [
  {
    id: 'they_propose', category: 'love', ageRange: [20, 60], once: true, weight: 3,
    requires: [single], cast: { love: 'partner' }, castRequires: [need('cast.love.relationship', '>=', 78), need('cast.love.age', '>=', 18)],
    text: 'On an ordinary Tuesday, halfway through the dishes, {love} dries their hands, takes a breath, and asks you to marry them.',
    choices: [
      { label: 'Say yes', outcomes: [any('You say yes with a dish towel over your shoulder. You are engaged. The wedding is yours to plan.', 'good',
        npcSet('love', { flags: { engaged: true } }), rel('love', 10), st('mood', 15),
        mem('love', 'theyProposed', 'They proposed to you over the dishes, and you said yes.'))] },
      { label: 'Ask for time', outcomes: [any('{love} nods and picks the dish towel back up. Something in the room has shifted.', 'neutral', rel('love', -8))] },
      { label: 'Say no', outcomes: [any('{love} takes it quietly, which is worse than shouting.', 'bad', rel('love', -30), st('mood', -6),
        mem('love', 'turnedDown', 'They proposed, and you said no.'))] },
    ],
  },
  {
    id: 'moving_in', category: 'love', ageRange: [19, 60], weight: 3, cooldown: 30,
    requires: [single], cast: { love: 'partner' }, castRequires: [need('cast.love.relationship', '>=', 62), need('cast.love.age', '>=', 18)],
    text: '{love} points out that you already have a toothbrush at theirs, and asks whether you should just find a place together.',
    choices: [
      { label: 'Yes', outcomes: [any('You carry boxes up three flights of stairs and argue, lovingly, about where the sofa goes.', 'good',
        rel('love', 9), st('mood', 7), flag('livesWithParents', false), npcSet('love', { flags: { livesTogether: true } }))] },
      { label: 'Not yet', outcomes: [any('{love} says that is fine. It is mostly fine.', 'neutral', rel('love', -5))] },
    ],
  },
  {
    id: 'jealous', category: 'love', ageRange: [16, 60], cooldown: 8, cast: { love: 'partner' },
    text: '{love} has gone quiet since seeing a message on your phone from someone they do not know.',
    choices: [
      { label: 'Show them the whole conversation', outcomes: [any('It was nothing, and now they know it was nothing.', 'good', rel('love', 6))] },
      { label: 'Say they should trust you', check: chk(0.45, { 'cast.love.relationship': 0.8 }), outcomes: [
        ok('{love} looks at you for a moment and decides they do.', rel('love', 3)),
        bad('It becomes a three-day argument about something else entirely.', rel('love', -12), st('mood', -4)),
      ] },
      { label: 'Go through their phone in return', outcomes: [any('You find nothing, and they find you looking.', 'bad', rel('love', -15), hid('karma', -3), hid('crazy', 3))] },
    ],
  },
  {
    id: 'anniversary', category: 'marriage', ageRange: [20, 95], cooldown: 6, cast: { love: 'spouse' },
    text: 'Your anniversary is on Saturday. You realize this on Friday.',
    choices: [
      { label: 'Book somewhere special ({$300})', requires: [need('cashBase', '>=', 300)], outcomes: [any(
        'A corner table, a bottle of something good, and the story of how you met, told badly by both of you.', 'good', cash(-300), rel('love', 10), st('mood', 6))] },
      { label: 'Cook the first meal you ever made them', check: chk(0.6, { 'stats.intellect': 0.3, 'cast.love.relationship': 0.4 }), outcomes: [
        ok('You remember it exactly, including the part you burned. {love} cries a little.', rel('love', 13), st('mood', 7),
          mem('love', 'firstMeal', 'You recreated the first meal you ever cooked for them.')),
        bad('You burn a different part this time. They laugh. It still counts.', rel('love', 4)),
      ] },
      { label: 'Let it pass', outcomes: [any('{love} says it does not matter. It is mentioned again in March.', 'bad', rel('love', -10))] },
    ],
  },
  {
    id: 'temptation', category: 'marriage', ageRange: [22, 65], cooldown: 12, cast: { love: 'spouse' },
    text: 'At a hotel bar, three hundred miles from home, someone attractive has been laughing at everything you say, and has just asked what floor you are on.',
    choices: [
      { label: 'Say goodnight', outcomes: [any('You ring {love} from your room and talk about nothing for an hour.', 'good', hid('karma', 5), hid('discipline', 3), rel('love', 3))] },
      { label: 'Stay for one more drink and enjoy the attention', outcomes: [any('Nothing happens. You think about it on the drive home.', 'neutral', st('mood', 3), hid('crazy', 2))] },
      { label: 'Tell them the floor', check: chk(0.55, { 'talents.crime': 0.4, 'stats.intellect': 0.2 }), outcomes: [
        ok('{love} never finds out. You know, though.', st('mood', 4), hid('karma', -12), flag('hadAffair'), count('affairs')),
        bad('There is a receipt, and then a question, and then a very long silence. {love} knows.', hid('karma', -12), rel('love', -50), st('mood', -12), flag('hadAffair'), count('affairs'),
          mem('love', 'cheated', 'You were unfaithful, and they found out.')),
      ] },
    ],
  },
  {
    id: 'their_secret', category: 'marriage', ageRange: [22, 80], once: true, cast: { love: 'spouse' },
    castRequires: [need('cast.love.relationship', '<=', 45)],
    text: '{love} has left their phone on the kitchen table, and it lights up with a message that is plainly not from a colleague.',
    choices: [
      { label: 'Ask them, straight out', outcomes: [
        { on: 'always', weight: 2, tone: 'bad', text: '{love} sits down heavily and tells you everything. It has been going on for months.',
          effects: [rel('love', -25), st('mood', -14), mem('love', 'theyCheated', 'They were unfaithful, and admitted it when you asked.')] },
        { on: 'always', weight: 1, tone: 'neutral', text: 'It is their sister, planning your surprise party. You have never felt so foolish, or so relieved.',
          effects: [rel('love', 6), st('mood', 5)] },
      ] },
      { label: 'Say nothing and watch', outcomes: [any('You become someone who checks. It is not a good way to live.', 'bad', st('mood', -8), hid('crazy', 5), rel('love', -6))] },
      { label: 'Decide you would rather not know', outcomes: [any('You turn the phone face down and put the kettle on.', 'neutral', st('mood', -4), hid('willpower', -2))] },
    ],
  },
  {
    id: 'in_laws', category: 'marriage', ageRange: [20, 70], cooldown: 8, cast: { love: 'spouse' },
    text: 'Over Sunday lunch, {love}\'s mother remarks that she always imagined her child would end up with somebody "more settled".',
    choices: [
      { label: 'Smile and pass the potatoes', outcomes: [any('{love} squeezes your knee under the table.', 'good', rel('love', 5), hid('discipline', 2))] },
      { label: 'Win her over', check: chk(0.4, { 'stats.charm': 0.9 }), outcomes: [
        ok('By dessert she is showing you baby photos and telling {love} to hold on to you.', rel('love', 9), st('charm', 2)),
        bad('Your joke about her gravy does not land.', rel('love', -4), st('mood', -3)),
      ] },
      { label: 'Tell her what you always imagined', outcomes: [any('The drive home is very quiet.', 'bad', rel('love', -12), st('mood', 2), hid('karma', -2))] },
    ],
  },
  {
    id: 'ex_returns', category: 'love', ageRange: [18, 70], cooldown: 12, cast: { ex: 'ex' },
    text: 'A message from {ex}, out of nowhere: "I was thinking about you. Coffee?"',
    choices: [
      { label: 'Go for the coffee', check: chk(0.5, { 'cast.ex.relationship': 0.6, 'stats.charm': 0.2 }), outcomes: [
        ok('An hour turns into three. Whatever went wrong, you can both laugh about it now.', rel('ex', 25), st('mood', 5),
          mem('ex', 'coffee', 'Years later, you met for coffee and made your peace.')),
        bad('Ten minutes in, you both remember exactly why it ended.', rel('ex', -5), st('mood', -4)),
      ] },
      { label: 'Reply politely and leave it there', outcomes: [any('You wish them well, and mean most of it.', 'neutral', rel('ex', 4))] },
      { label: 'Do not reply', outcomes: [any('The message sits there. You look at it more than once.', 'neutral', st('mood', -1))] },
    ],
  },
];

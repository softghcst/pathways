// Scenes about identity: a child telling the player who they are, and a few
// moments from the player's own life once they are out.
// The first two are queued by engine/npcLives.js when a child is ready to talk.
import { st, hid, rel, mem, ok, bad, any, chk, need } from './helpers.js';

const out = need('flags.identity.outOrientation', '==', true);
const outGender = need('flags.identity.outGender', '==', true);

/** @type {import('../../types.js').GameEvent[]} */
const feeling = (value) => ({ type: 'genderFeeling', value });

export default [
  // Queued by engine/identity.js for a transgender character who has not gone looking: the feeling arrives anyway.
  {
    id: 'gender_feeling', category: 'identity', ageRange: [13, 120], queuedOnly: true,
    text: 'For a while now, something has not fitted. When people call you a {born}, it feels like a coat that belongs to someone else, and you cannot stop noticing.',
    choices: [
      { label: 'Look into it', outcomes: [any('You let yourself think about it, properly.', 'neutral', feeling('look'))] },
      { label: 'Think about it later', outcomes: [any('Not now. Maybe soon.', 'neutral', feeling('later'))] },
      { label: 'Push it away', outcomes: [any('You tell yourself it is nothing.', 'bad', feeling('push'))] },
    ],
  },
  {
    id: 'kid_comes_out', category: 'their life', ageRange: [28, 120], queuedOnly: true, cooldown: 1,
    text: '{kid} asks if you have a minute, and then cannot seem to start. "I\'m not straight," comes out at last, very fast. "I wanted you to hear it from me."',
    choices: [
      { label: 'Hug them, and say thank you for telling me', outcomes: [any('{kid} lets out a breath that sounds a year old. You stay up talking until the tea is cold.', 'good',
        rel('kid', 16), st('mood', 5), hid('karma', 6), mem('kid', 'acceptedMe', 'You were the first person they told, and you hugged them.'))] },
      { label: 'Say it changes nothing, and ask what they want for dinner', outcomes: [any('It is exactly the right amount of fuss. {kid} laughs, and asks for pasta.', 'good',
        rel('kid', 12), hid('karma', 4), mem('kid', 'acceptedMe', 'You told them it changed nothing.'))] },
      { label: 'Say you need some time', outcomes: [any('{kid} nods and goes upstairs. The house is very quiet. You have not said no, and you have not said yes.', 'neutral',
        rel('kid', -8), st('mood', -4), mem('kid', 'neededTime', 'You said you needed time.'))] },
      { label: 'Tell them it is a phase', outcomes: [any('Something closes in {kid}\'s face. They do not bring it up with you again, for a very long time.', 'bad',
        rel('kid', -28), hid('karma', -10), st('mood', -5), mem('kid', 'rejectedMe', 'You told them it was a phase.'))] },
    ],
  },
  {
    id: 'kid_is_trans', category: 'their life', ageRange: [24, 120], queuedOnly: true, cooldown: 1,
    text: '{kid} has written you a letter, and stands in the doorway while you read it. It says they are not the boy or girl everyone thinks, that they have known for a long time, and that there is a name they would like you to use.',
    choices: [
      { label: 'Ask what the name is, and use it', outcomes: [any('You say it out loud, and your child cries, and so do you. The name suits them. It always would have.', 'good',
        { type: 'npcTransition', target: 'kid', value: true }, rel('kid', 20), hid('karma', 8), st('mood', 4), mem('kid', 'acceptedMe', 'You used their name the day they told you.'))] },
      { label: 'Say you love them, and that you will need help getting it right', outcomes: [any('You get the name wrong for a month and correct yourself every time. They notice both.', 'good',
        { type: 'npcTransition', target: 'kid', value: true }, rel('kid', 12), hid('karma', 5), mem('kid', 'acceptedMe', 'You got it wrong at first and never stopped trying.'))] },
      { label: 'Say they are too young to know', outcomes: [any('They take the letter back and fold it very small. They will do this without you, then.', 'bad',
        { type: 'npcTransition', target: 'kid', value: false }, rel('kid', -30), hid('karma', -10), st('mood', -6), mem('kid', 'rejectedMe', 'You told them they were too young to know.'))] },
    ],
  },
  {
    id: 'pride_march', category: 'identity', ageRange: [16, 90], cooldown: 8, requires: [out],
    text: 'The Pride march goes right past the end of your road this year. You can hear the drums from the kitchen.',
    choices: [
      { label: 'Go, and march', outcomes: [any('You walk in the middle of ten thousand people and are, for an afternoon, completely unremarkable. It is wonderful.', 'good', st('mood', 10), hid('willpower', 3))] },
      { label: 'Watch from the sidewalk', outcomes: [any('A stranger hands you a small flag. You keep it on the bookshelf.', 'good', st('mood', 5))] },
      { label: 'Stay in. It is not really your thing', outcomes: [any('You turn the radio up and get on with the washing. There is more than one way to be who you are.', 'neutral', st('mood', 1))] },
    ],
  },
  {
    id: 'wrong_name_at_dinner', category: 'identity', ageRange: [10, 90], cooldown: 6, requires: [outGender],
    text: 'At a family dinner, a relative uses your old name: once, then again, looking straight at you.',
    choices: [
      { label: 'Correct them, calmly, every time', check: chk(0.55, { 'hidden.willpower': 0.5, 'stats.charm': 0.3 }), outcomes: [
        ok('By the fourth time they have stopped. Somebody else at the table squeezes your hand under it.', hid('willpower', 4), st('mood', 4)),
        bad('They keep at it, and enjoy it. You finish your plate and do not stay for dessert.', st('mood', -8)),
      ] },
      { label: 'Leave the table', outcomes: [any('You are in the car before anyone has put a fork down. Two of them come out after you.', 'neutral', st('mood', -3), hid('willpower', 2))] },
      { label: 'Let it go, this once', outcomes: [any('You say nothing, and it sits in your chest like a stone for a week.', 'bad', st('mood', -7))] },
    ],
  },
  {
    id: 'younger_person_asks', category: 'identity', ageRange: [25, 95], cooldown: 12, requires: [need('flags.identity.knows', '==', true)],
    text: 'A teenager you barely know hangs back after everyone else has gone, and asks, not looking at you, how you knew.',
    choices: [
      { label: 'Tell them the truth, all of it', outcomes: [any('You talk for an hour on a low wall. They leave standing a little straighter than they came.', 'good', hid('karma', 8), st('mood', 6))] },
      { label: 'Give them the number of someone who can help', outcomes: [any('It is the right number. Months later a card arrives with no return address and two words on it.', 'good', hid('karma', 6), st('mood', 3))] },
      { label: 'Say it is different for everyone', outcomes: [any('Which is true, and not what they needed. They nod and go.', 'neutral', st('mood', -2))] },
    ],
  },
];

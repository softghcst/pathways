import { st, hid, cash, flag, cond, count, ms, ok, bad, any, chk, need } from './helpers.js';

/** @type {import('../../types.js').GameEvent[]} */
export default [
  {
    id: 'life_story', category: 'elder', ageRange: [65, 120], once: true, weight: 2,
    text: 'A young neighbor asks what life was like when you were their age.',
    choices: [
      { label: 'Tell them everything', outcomes: [any('Three hours and two pots of tea. They come back the next week for more.', 'good', st('mood', 8), hid('karma', 3))] },
      { label: 'Write it all down instead', check: chk(0.5, { 'stats.intellect': 0.6, 'hidden.discipline': 0.4 }), outcomes: [
        ok('You fill four notebooks. The family has them bound.', st('mood', 10), st('intellect', 2), ms('Wrote a memoir for the family.')),
        bad('You get as far as age nine and lose the thread.', st('mood', -2)),
      ] },
      { label: 'Say it was all nonsense, and so is now', outcomes: [any('They nod politely and do not ask again.', 'neutral', st('mood', -3), st('charm', -1))] },
    ],
  },
  {
    id: 'icy_steps', category: 'elder', ageRange: [66, 120], cooldown: 6,
    text: 'The front steps are sheeted with ice and you are out of milk.',
    choices: [
      { label: 'Go carefully, holding the rail', check: chk(0.85, { 'stats.health': 0.3 }), outcomes: [
        ok('Slow and steady. You get your milk.', hid('discipline', 1)),
        bad('Your foot goes anyway. You break your hip on the bottom step.', cond('broken_hip'), st('health', -15), st('mood', -8)),
      ] },
      { label: 'Stride out like you always have', check: chk(0.5, { 'stats.health': 0.5 }), outcomes: [
        ok('You make it look easy. A passing teenager is impressed.', st('mood', 4)),
        bad('You go down hard and break your hip.', cond('broken_hip'), st('health', -18), st('mood', -10)),
      ] },
      { label: 'Have your tea black today', outcomes: [any('It is not the same, but your bones are intact.', 'neutral', st('mood', -1))] },
    ],
  },
  {
    id: 'writing_a_will', category: 'elder', ageRange: [62, 120], once: true, weight: 2,
    text: 'Your lawyer says it is time you put your wishes on paper.',
    choices: [
      { label: 'Leave everything to family', outcomes: [any('Signed, witnessed, filed. One less thing to think about.', 'good', flag('will', 'family'), st('mood', 3))] },
      { label: 'Leave it all to charity', outcomes: [any('The lawyer raises an eyebrow and writes it down.', 'good', flag('will', 'charity'), hid('karma', 12))] },
      { label: 'Bury the cash in the garden', requires: [need('cashBase', '>=', 100)], outcomes: [any('You draw a map and then lose the map.', 'neutral', flag('will', 'buried'), hid('crazy', 6))] },
      { label: 'Put it off', outcomes: [any('"Next year," you say, as you said last year.', 'neutral', hid('discipline', -2))] },
    ],
  },
  {
    id: 'old_rival', category: 'elder', ageRange: [60, 120], once: true,
    text: 'Someone you fell out with decades ago writes to say they are sorry.',
    choices: [
      { label: 'Forgive them', outcomes: [any('You meet for lunch. Neither of you can remember exactly what it was about.', 'good', st('mood', 9), hid('karma', 8))] },
      { label: 'Do not reply', outcomes: [any('The letter stays in the drawer. You read it more than once.', 'neutral', st('mood', -3))] },
      { label: 'Reply with a list of grievances', outcomes: [any('Eleven pages, numbered. Posting it feels incredible for about a day.', 'bad', st('mood', 2), hid('karma', -6), hid('crazy', 3))] },
    ],
  },
  {
    id: 'grand_gift', category: 'elder', ageRange: [60, 120], cooldown: 8,
    text: 'The community center that taught you to dance is about to close for lack of funds.',
    choices: [
      { label: 'Donate {$2000}', requires: [need('cashBase', '>=', 2000)], outcomes: [any('They name the tea urn after you. The center stays open.', 'good', cash(-2000), hid('karma', 15), st('mood', 8), count('donated', 2000))] },
      { label: 'Organize a fundraiser', check: chk(0.5, { 'stats.charm': 0.6, 'hidden.willpower': 0.3 }), outcomes: [
        ok('A raffle, a bake sale and a sponsored waltz. You raise enough.', hid('karma', 12), st('mood', 10), ms('Saved the community center.')),
        bad('You raise a third of what is needed. The doors close in the spring.', hid('karma', 6), st('mood', -5)),
      ] },
      { label: 'Let it go', outcomes: [any('It becomes flats. You stop walking down that road.', 'neutral', st('mood', -4))] },
    ],
  },
];

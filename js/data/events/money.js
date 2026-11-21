// What owning things brings with it: leaks, tenants, breakdowns and tips.
// Requirements use the computed paths ownsProperty, hasTenant, ownsVehicle
// and investedBase (see engine/conditions.js).
import { st, hid, cash, rel, ok, bad, any, chk, need } from './helpers.js';

const property = (which, change) => ({ type: 'property', target: which, value: change });
const vehicle = (delta) => ({ type: 'vehicle', delta });

/** @type {import('../../types.js').GameEvent[]} */
export default [
  {
    id: 'burst_pipe', category: 'home', ageRange: [18, 95], cooldown: 7, requires: [need('ownsHome', '==', true)],
    text: 'You come home to the sound of running water. A pipe has burst in the ceiling and the hallway carpet is afloat.',
    choices: [
      { label: 'Call an emergency plumber ({$1500})', requires: [need('cashBase', '>=', 1500)], outcomes: [any('Fixed by midnight, at midnight prices.', 'neutral', cash(-1500))] },
      { label: 'Find the stopcock and fix it yourself', check: chk(0.45, { 'stats.intellect': 0.6, 'hidden.discipline': 0.3 }), outcomes: [
        ok('Two hours, one video and a great deal of tape. It holds.', st('intellect', 2), st('mood', 4), cash(-60)),
        bad('You make it considerably worse before a professional makes it better.', cash(-900), property('home', { condition: -12 }), st('mood', -4)),
      ] },
      { label: 'Put a bucket under it', outcomes: [any('The bucket fills. The ceiling comes down in March.', 'bad', property('home', { condition: -25 }), st('mood', -3))] },
    ],
  },
  {
    id: 'storm_damage', category: 'home', ageRange: [18, 95], cooldown: 10, requires: [need('ownsProperty', '==', true)],
    text: 'A storm takes a row of tiles off the roof and puts your neighbor\'s trampoline through the fence.',
    choices: [
      { label: 'Claim on the insurance', check: chk(0.6, { 'stats.intellect': 0.4, 'stats.charm': 0.2 }), outcomes: [
        ok('Forms, photographs, a man with a clipboard. They pay for all of it.', st('mood', 2)),
        bad('The small print says "weather". You pay, and so does your premium.', cash(-4000), st('mood', -5)),
      ] },
      { label: 'Pay a roofer ({$3500})', requires: [need('cashBase', '>=', 3500)], outcomes: [any('Done in a day and a half.', 'neutral', cash(-3500))] },
      { label: 'Leave it for the summer', outcomes: [any('It rains before the summer. Quite a lot.', 'bad', property('any', { condition: -22 }))] },
    ],
  },
  {
    id: 'tenant_arrears', category: 'landlord', ageRange: [18, 95], cooldown: 6, requires: [need('hasTenant', '==', true)],
    text: 'Your tenant calls, embarrassed: they have lost their job and cannot make the rent for a while. They ask for three months\' grace.',
    choices: [
      { label: 'Give them the three months', outcomes: [
        { on: 'always', weight: 3, tone: 'good', text: 'They find work in ten weeks and pay back every penny. They stay for years.', effects: [hid('karma', 8), st('mood', 3)] },
        { on: 'always', weight: 1, tone: 'bad', text: 'Three months becomes six, and then an empty flat and no forwarding address.', effects: [hid('karma', 6), cash(-3000), property('rental', { evict: true })] },
      ] },
      { label: 'Offer to halve it for now', outcomes: [any('It costs you {$1200} and keeps a decent tenant in place.', 'good', cash(-1200), hid('karma', 4))] },
      { label: 'Give them notice', outcomes: [any('They are out by the end of the month. The place stands empty while you find someone new.', 'neutral', hid('karma', -8), property('rental', { evict: true }))] },
    ],
  },
  {
    id: 'tenant_damage', category: 'landlord', ageRange: [18, 95], cooldown: 8, requires: [need('hasTenant', '==', true)],
    text: 'You inspect your rental for the first time in a year. There is a motorbike in the living room, in pieces, and something has happened to the kitchen.',
    choices: [
      { label: 'Keep their deposit and say nothing more', outcomes: [any('The deposit covers about half of it.', 'neutral', property('rental', { condition: -12 }))] },
      { label: 'Tell them to put it right', check: chk(0.5, { 'stats.charm': 0.5, 'hidden.willpower': 0.3 }), outcomes: [
        ok('They spend three weekends on it. It ends up better than you left it.', property('rental', { condition: 5 })),
        bad('They agree to everything and do none of it.', property('rental', { condition: -20 }), st('mood', -3)),
      ] },
      { label: 'Evict them', outcomes: [any('They go, leaving the kitchen as their parting gift.', 'bad', property('rental', { condition: -20, evict: true }), hid('karma', -2))] },
    ],
  },
  {
    id: 'warning_light', category: 'on the road', ageRange: [17, 95], cooldown: 5, requires: [need('ownsVehicle', '==', true)],
    text: 'An orange light you have never seen before comes on, and stays on.',
    choices: [
      { label: 'Take it to a garage ({$700})', requires: [need('cashBase', '>=', 700)], outcomes: [any('A sensor, a hose, and something the mechanic sucks his teeth over. Sorted.', 'neutral', cash(-700), vehicle(10))] },
      { label: 'Look it up and have a go yourself', check: chk(0.4, { 'stats.intellect': 0.7 }), outcomes: [
        ok('It was a loose cap. You feel like an engineer.', st('mood', 4), st('intellect', 1)),
        bad('You now have two orange lights and a part left over.', vehicle(-20), st('mood', -3)),
      ] },
      { label: 'Put tape over the light', outcomes: [any('Out of sight. Not, it turns out, out of engine.', 'bad', vehicle(-28))] },
    ],
  },
  {
    id: 'hot_tip', category: 'money', ageRange: [20, 75], cooldown: 8, cast: { mate: 'coworker' },
    requires: [need('cashBase', '>=', 3000)],
    text: '{mate} leans over the partition: a friend of a friend works at a company that is "about to be bought". Put in {$3000} this week, they say, and thank them at Christmas.',
    choices: [
      { label: 'Put the money in', outcomes: [
        { on: 'always', weight: 1, tone: 'good', text: 'For once the friend of a friend was right. You get {$9000} back.', effects: [cash(6000), st('mood', 8), rel('mate', 6)] },
        { on: 'always', weight: 3, tone: 'bad', text: 'There is no takeover. The shares halve, and halve again.', effects: [cash(-2600), st('mood', -6), rel('mate', -8)] },
      ] },
      { label: 'Ask how they could possibly know that', outcomes: [any('{mate} goes vague. You keep your money.', 'good', st('intellect', 1))] },
      { label: 'Say you only buy what you understand', outcomes: [any('{mate} shrugs. In the spring, they stop mentioning it.', 'neutral', hid('discipline', 2))] },
    ],
  },
  {
    id: 'market_panic', category: 'money', ageRange: [18, 95], cooldown: 9, requires: [need('investedBase', '>=', 5000)],
    text: 'The news is all red arrows and men holding their heads. Everything you own on the market is down, and the presenters say it could go further.',
    choices: [
      { label: 'Do nothing', outcomes: [any('You turn the news off and go for a walk. Markets have fallen before.', 'good', hid('discipline', 4), st('mood', -2))] },
      { label: 'Sell everything', outcomes: [any('You are out, at today\'s prices. Whether that was wise, only the next few years will say.', 'neutral', { type: 'sellInvestments' }, st('mood', 2), hid('discipline', -3))] },
      { label: 'Stop looking at it for a year', outcomes: [any('Your account password goes in a drawer.', 'neutral', st('mood', 1))] },
    ],
  },
];

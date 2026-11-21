// Scenes that depend on where the player lives: the law, the state of the
// country, and the land and weather. Each is gated on facts from
// data/living.js (living.safety, living.infra, living.graft and so on), so a
// scene only happens somewhere it plausibly could. How well off the player is
// decides which choices are open to them.
import { st, hid, cash, cond, heat, count, ms, ok, bad, any, chk, need, death } from './helpers.js';

const has = (amount) => need('cashBase', '>=', amount);
const hazard = (id) => need('hazards', 'has', id);

/** @type {import('../../types.js').GameEvent[]} */
export default [
  // ---------- The law ----------
  {
    id: 'call_up_letter', category: 'the law', ageRange: [18, 19], once: true, priority: true,
    requires: [need('conscription', '==', true), need('gender', '==', 'male')],
    text: 'A brown envelope arrives with a government stamp. You are to report for military service.',
    choices: [
      { label: 'Report for duty', outcomes: [any('Eighteen months of early mornings, drill and boredom. You come out fitter, harder, and with friends for life.', 'neutral',
        st('health', 6), hid('discipline', 10), st('mood', -4), ms('Completed military service.'))] },
      { label: 'Ask to defer it for your studies', requires: [need('education.enrolled', '==', true)], outcomes: [any('The deferment is stamped. It will be waiting for you when you graduate.', 'neutral', hid('discipline', 1))] },
      { label: 'Pay someone to lose your file', requires: [has(3000), need('living.graft', '>=', 50)], check: chk(0.6, { 'stats.charm': 0.3 }), outcomes: [
        ok('An envelope changes hands in a parking lot. Your name is no longer on any list.', cash(-3000), hid('karma', -8), count('crimes')),
        bad('The clerk takes the money and reports you anyway. You serve, with a mark against your name.', cash(-3000), hid('karma', -8), heat(15), st('mood', -8), hid('discipline', 6)),
      ] },
      { label: 'Do not turn up', outcomes: [any('Two military policemen come for you at work. You serve the full term, the first month of it in a cell.', 'bad', st('mood', -10), heat(20), hid('discipline', 5), st('health', 3))] },
    ],
  },
  {
    id: 'call_up_papers', category: 'the law', ageRange: [18, 50], queuedOnly: true, cooldown: 30,
    text: 'There is a knock at seven in the morning. A man in uniform hands you call-up papers: you are to report within three days.',
    choices: [
      { label: 'Go', outcomes: [
        { on: 'always', weight: 0.72, tone: 'bad', text: 'You are gone for most of a year. You come home thinner, quieter, and in one piece.', effects: [st('mood', -14), st('health', -8), hid('discipline', 6)] },
        { on: 'always', weight: 0.22, tone: 'bad', text: 'You come home on a stretcher, and you are one of the lucky ones.', effects: [st('health', -35), st('mood', -18)] },
        { on: 'always', weight: 0.06, tone: 'bad', text: 'You do not come home.', effects: [death('wounds received at the front')] },
      ] },
      { label: 'Cross the border tonight', check: chk(0.5, { 'stats.intellect': 0.3, 'talents.crime': 0.3 }), outcomes: [
        ok('A long walk through a forest in the dark, and you are out. You cannot go back while this lasts.', st('mood', -6), hid('willpower', 5), heat(10)),
        bad('The border guards have seen a great many men like you this year. You are sent to the front with a guard beside you.', st('mood', -16), st('health', -10)),
      ] },
      { label: 'Pay a doctor for a certificate', requires: [has(5000)], check: chk(0.65, {}), outcomes: [
        ok('A weak heart, on paper. The certificate costs more than the doctor earns in a year.', cash(-5000), hid('karma', -6)),
        bad('The certificate is laughed at. The money is gone, and so are you, by Friday.', cash(-5000), st('mood', -14), st('health', -8)),
      ] },
    ],
  },
  {
    id: 'checkpoint_bribe', category: 'the law', ageRange: [18, 85], cooldown: 6, requires: [need('living.graft', '>=', 55)],
    text: 'A policeman waves you over, looks at your papers for a long time, and says there is a problem with them that could be sorted out here and now.',
    choices: [
      { label: 'Pay what he is asking', requires: [has(40)], outcomes: [any('The problem with your papers disappears into his shirt pocket.', 'neutral', cash(-40), hid('karma', -1), st('mood', -2))] },
      { label: 'Ask politely for a written ticket', check: chk(0.4, { 'stats.charm': 0.5, 'hidden.willpower': 0.3 }), outcomes: [
        ok('He looks at you, sighs, and hands the papers back. Writing things down is more trouble than you are worth.', hid('willpower', 3), st('mood', 3)),
        bad('He has all day. You do not. Three hours later you pay double.', cash(-80), st('mood', -6)),
      ] },
      { label: 'Mention the name of someone important', requires: [has(200000)], outcomes: [any('He salutes. This is how it works here, for people like you.', 'neutral', hid('karma', -3))] },
      { label: 'Argue', outcomes: [any('You spend the night in a cell and pay in the morning anyway.', 'bad', cash(-60), st('mood', -8), st('health', -2))] },
    ],
  },

  // ---------- Hard times ----------
  {
    id: 'blackout_week', category: 'life here', ageRange: [12, 90], cooldown: 5, requires: [need('living.infra', '<=', 58)],
    text: 'The power has been off for six days. The food in the fridge has gone, and the nights are very dark.',
    choices: [
      { label: 'Buy a generator', requires: [has(900)], outcomes: [any('It roars like a truck and smells of gas, and you have light. Half the street runs a cable to it.', 'good', cash(-900), st('mood', 5), hid('karma', 3))] },
      { label: 'Cook outside with the neighbors', outcomes: [any('Everyone brings what was about to spoil. It is the best meal of the year, eaten by candlelight in the yard.', 'good', st('mood', 5), st('charm', 2))] },
      { label: 'Sit it out', outcomes: [any('You go to bed when it gets dark and get up when it gets light, like your great-grandparents did.', 'neutral', st('mood', -4))] },
    ],
  },
  {
    id: 'savings_melting', category: 'life here', ageRange: [20, 90], cooldown: 6, requires: [need('living.inflation', '!=', 'low'), has(500)],
    text: 'The price of bread has doubled since the spring. Everyone you know is turning their wages into something, anything, the day they are paid.',
    choices: [
      { label: 'Change your cash into dollars on the street', check: chk(0.7, { 'stats.intellect': 0.3 }), outcomes: [
        ok('A man with a calculator behind a kiosk gives you a fair rate. What you have will hold its value now.', st('intellect', 2), st('mood', 3)),
        bad('Half the notes he gave you are forgeries.', cash(-250), st('mood', -6)),
      ] },
      { label: 'Stock the cupboards', outcomes: [any('Forty kilos of rice, a wall of tins, and cooking oil under the bed. It is a kind of savings account.', 'neutral', cash(-200), st('mood', 2), st('health', 1))] },
      { label: 'Leave it in the bank', outcomes: [any('The number stays the same. What it will buy does not.', 'bad', st('mood', -5))] },
    ],
  },
  {
    id: 'march_in_the_square', category: 'life here', ageRange: [16, 80], cooldown: 8, requires: [need('living.stability', '<=', 52)],
    text: 'Tens of thousands of people are filling the main square. The government has said that anyone there after dark will be dealt with.',
    choices: [
      { label: 'Go, and stay', outcomes: [
        { on: 'always', weight: 0.6, tone: 'good', text: 'You stand there all night with strangers who share their bread. Nothing changes the next day. Something has changed in you.', effects: [hid('willpower', 6), st('mood', 5), hid('karma', 4)] },
        { on: 'always', weight: 0.3, tone: 'bad', text: 'The water cannon comes at midnight. You get home soaked, bruised and unarrested.', effects: [st('health', -8), hid('willpower', 4)] },
        { on: 'always', weight: 0.1, tone: 'bad', text: 'You are pulled into a van. They hold you for three weeks and take your name for good.', effects: [st('health', -12), st('mood', -12), heat(20)] },
      ] },
      { label: 'Go, and leave before dark', outcomes: [any('You were there. You tell yourself that counts.', 'neutral', st('mood', 2), hid('karma', 2))] },
      { label: 'Stay at home with the shutters closed', outcomes: [any('You listen to it on the radio until the radio goes quiet.', 'neutral', st('mood', -3))] },
    ],
  },
  {
    id: 'everyone_is_leaving', category: 'life here', ageRange: [18, 60], once: true, requires: [need('inCrisis', '==', true)],
    text: 'Another going-away party. That is the fourth friend this year to leave the country, and this one asks, quietly, why you are still here.',
    choices: [
      { label: 'Say this is your home', outcomes: [any('Somebody has to stay and keep the lights on. You believe it most days.', 'neutral', hid('willpower', 4), st('mood', -2))] },
      { label: 'Admit you have been thinking about it', outcomes: [any('They write a name and a number on a napkin. "When you are ready." It is in your wallet now. (Pursuits, then Move abroad.)', 'neutral', st('mood', 2))] },
      { label: 'Ask them to send money back', outcomes: [any('They laugh, and then they do, every Christmas, for years.', 'good', cash(300), st('mood', 2))] },
    ],
  },
  {
    id: 'private_or_public', category: 'life here', ageRange: [25, 85], cooldown: 12, requires: [need('living.health', '<=', 60)],
    text: 'Your chest has been tight for a month. The public clinic has a line around the building and no doctor until Thursday. The private one across town can see you today.',
    choices: [
      { label: 'Go private', requires: [has(400)], outcomes: [any('Clean floors, a doctor who has time, and a prescription the same afternoon. This is what money is for here.', 'good', cash(-400), st('health', 6), st('mood', 2))] },
      { label: 'Queue at the public clinic', check: chk(0.5, { 'stats.health': 0.4 }), outcomes: [
        ok('Six hours on a plastic chair. The nurse is kind and the pills work.', st('health', 3), hid('willpower', 2)),
        bad('They run out of the medicine two people before you.', st('health', -6), st('mood', -5), cond('flu')),
      ] },
      { label: 'Ask the woman down the road who knows about herbs', outcomes: [any('The tea tastes terrible. You feel a little better, or tell yourself so.', 'neutral', st('health', -1), st('mood', 1))] },
    ],
  },
  {
    id: 'kidnap_scare', category: 'life here', ageRange: [18, 80], cooldown: 15, requires: [need('living.safety', '<=', 40), has(150000)],
    text: 'A car has been parked across from your gate for three mornings running. People with your kind of money are taken for ransom here.',
    choices: [
      { label: 'Hire a driver and a guard', requires: [has(6000)], outcomes: [any('The car is gone within the week. You live behind a wall now, and you are used to it.', 'neutral', cash(-6000), st('mood', -3))] },
      { label: 'Change your routes and tell nobody', check: chk(0.6, { 'stats.intellect': 0.4 }), outcomes: [
        ok('A different road every day for a month. Whoever it was loses interest.', st('intellect', 2), st('mood', -2)),
        bad('They take you at a junction. Three days in a back room, and your family pays.', cash(-40000), st('health', -12), st('mood', -20)),
      ] },
      { label: 'Go to the police', outcomes: [any('The officer writes it down slowly and asks how much you would pay for a patrol.', 'bad', st('mood', -5))] },
    ],
  },

  // ---------- The land and the weather ----------
  {
    // Not drawn any more (weight 0): a storm's warning is engine/disasters.js's forecast now, before the storm, where this came after it.
    id: 'storm_warning', category: 'the weather', ageRange: [16, 90], cooldown: 7, weight: 0, timing: { weather: ['hurricane', 'typhoon', 'cyclone'], minSeverity: 1, yearLong: true },
    text: 'The forecast has a name on it and an arrow pointing at your town. The authorities are telling everyone on the coast to leave by tomorrow night.',
    choices: [
      { label: 'Leave, and pay for a room inland', requires: [has(600)], outcomes: [any('You watch your own street on the news from a hotel bed. It is strange, and you are dry.', 'neutral', cash(-600), st('mood', -2))] },
      { label: 'Go to the public shelter', outcomes: [any('A school gym, four hundred camp beds, and a baby that never stops crying. Everyone comes out of it alive.', 'neutral', st('mood', -5), hid('karma', 1))] },
      { label: 'Board up the windows and stay', check: chk(0.6, { 'stats.health': 0.2 }), outcomes: [
        ok('The roof holds. The noise is like nothing you have ever heard, and then it is morning.', hid('willpower', 5)),
        bad('The roof goes at three in the morning. You are pulled out of the water by a neighbor with a boat.', st('health', -20), st('mood', -12)),
      ] },
    ],
  },
  {
    id: 'earthquake_night', category: 'the weather', ageRange: [8, 90], cooldown: 12, timing: { weather: ['earthquake'] },
    text: 'You wake to the bed moving across the floor. The whole building is groaning.',
    choices: [
      { label: 'Get under the table and hold on', outcomes: [any('Forty seconds that last an hour. Plaster in your hair, and nothing worse.', 'neutral', hid('discipline', 3), st('mood', -3))] },
      { label: 'Run for the stairs', check: chk(0.55, { 'stats.health': 0.4 }), outcomes: [
        ok('You are in the street in your nightclothes with everybody else, counting heads.', st('mood', -4)),
        bad('The stairwell is where everything falls. You come to with a broken arm and somebody shouting your name.', cond('broken_arm'), st('health', -14)),
      ] },
      { label: 'Go and check on the old couple next door first', outcomes: [any('You get them both out, one on each arm. They send food round every week for a year.', 'good', hid('karma', 10), count('livesSaved'), st('mood', 4))] },
    ],
  },
  {
    id: 'heat_with_no_air', category: 'the weather', ageRange: [14, 95], cooldown: 6, timing: { weather: ['heat'], minSeverity: 1 },
    text: 'It has been over forty degrees for nine days. The night never cools, and the old and the poor are filling the hospitals.',
    choices: [
      { label: 'Run the air conditioning day and night', requires: [has(300)], outcomes: [any('The bill is frightening. You sleep, which is more than most of the city can say.', 'neutral', cash(-300), st('health', 1))] },
      { label: 'Sleep on the roof like everyone else', outcomes: [any('A whole neighborhood under the stars, with wet sheets and a radio. You remember it almost fondly.', 'neutral', st('health', -3), st('charm', 1))] },
      { label: 'Carry water to the neighbors who cannot get out', outcomes: [any('Four flights, eleven flats, twice a day. One of them would not have lasted the week without you.', 'good', hid('karma', 9), st('health', -3), st('mood', 4))] },
    ],
  },
  {
    id: 'long_dark_winter', timing: { seasons: ['winter'] }, category: 'the weather', ageRange: [14, 90], cooldown: 8, requires: [hazard('winter')],
    text: 'The sun came up at ten and was gone by two. It has been like this for a month, and the snow is over the windowsills.',
    choices: [
      { label: 'Get outside every day regardless', check: chk(0.6, { 'hidden.discipline': 0.6 }), outcomes: [
        ok('Skis, a thermos, and an hour of blue light. It gets you through.', st('health', 3), st('mood', 5)),
        bad('You manage it for a week. After that the sofa wins.', st('mood', -4)),
      ] },
      { label: 'Light every lamp and have people round', outcomes: [any('Candles in every window and a pot on the stove. This is how people here have always done it.', 'good', st('mood', 5), st('charm', 1))] },
      { label: 'Hibernate', outcomes: [any('You come out in March, pale and a little strange.', 'neutral', st('mood', -5), st('health', -2))] },
    ],
  },
];

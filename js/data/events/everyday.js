// Everyday scenes for adult life and old age: neighbors, friends, money,
// health, conscience and the small turns that fill the years between the
// big ones. Most have no special requirements, so any life can meet them.
import { st, hid, tal, cash, rel, cond, heat, count, ms, addNpc, death, ok, bad, any, chk, need, perf, pay } from './helpers.js';

const has = (amount) => need('cashBase', '>=', amount);
const employed = need('employed', '==', true);

/** @type {import('../../types.js').GameEvent[]} */
export default [
  // ---------- Around town ----------
  {
    id: 'wrong_parcel', category: 'everyday', ageRange: [18, 95], cooldown: 15,
    text: 'A parcel meant for someone three streets away is left on your step. It is heavy and it rattles expensively.',
    choices: [
      { label: 'Walk it round to them', outcomes: [any('It was a wedding present. They insist you stay for tea, and you leave with a friend: {pal}.', 'good', addNpc('friend', 'pal'), hid('karma', 6))] },
      { label: 'Leave it with the courier\'s depot', outcomes: [any('Forty minutes in line, and a clear conscience.', 'neutral', hid('karma', 3), st('mood', -1))] },
      { label: 'Open it', outcomes: [
        { on: 'always', weight: 0.6, tone: 'bad', text: 'A coffee machine worth {$400}. You keep it, and never quite enjoy the coffee.', effects: [hid('karma', -8), cash(400), count('crimes')] },
        { on: 'always', weight: 0.4, tone: 'bad', text: 'The doorbell camera across the road saw everything. A police officer comes for the parcel and takes your name.', effects: [hid('karma', -8), heat(12), st('mood', -5)] },
      ] },
    ],
  },
  {
    id: 'power_cut', category: 'everyday', ageRange: [16, 95], cooldown: 12,
    text: 'The whole street goes dark at seven in the evening. It will be hours.',
    choices: [
      { label: 'Knock on doors and check on people', outcomes: [any('You end up hosting eleven neighbors and every candle you own. People still mention it.', 'good', hid('karma', 6), st('charm', 2), st('mood', 5))] },
      { label: 'Light a candle and read', outcomes: [any('Three quiet hours with a book. You are almost sorry when the fridge hums back on.', 'good', st('intellect', 2), st('mood', 3))] },
      { label: 'Go to bed at half past seven', outcomes: [any('Eleven hours of sleep. You feel ten years younger for one morning.', 'neutral', st('health', 2))] },
    ],
  },
  {
    id: 'stuck_lift', category: 'everyday', ageRange: [18, 85], cooldown: 20,
    text: 'The lift stops between floors. There is one other person in it, and the alarm button does nothing.',
    choices: [
      { label: 'Make conversation', check: chk(0.6, { 'stats.charm': 0.6 }), outcomes: [
        ok('Two hours later you know {pal}\'s whole life, and they know yours.', addNpc('friend', 'pal'), st('charm', 2)),
        bad('You run out of things to say after six minutes. The other hundred and fourteen are long.', st('mood', -3)),
      ] },
      { label: 'Climb out through the hatch', check: chk(0.3, { 'talents.sports': 0.6, 'stats.health': 0.3 }), outcomes: [
        ok('You haul yourself onto the floor above and fetch help. It was a stupid thing to do and it worked.', tal('sports', 2), hid('willpower', 4)),
        bad('You get halfway, slip, and land on your back on the elevator floor.', cond('back_pain'), st('health', -6)),
      ] },
      { label: 'Sit down and wait', outcomes: [any('The engineer arrives in ninety minutes. You are late for everything.', 'neutral', hid('discipline', 2), st('mood', -2))] },
    ],
  },
  {
    id: 'street_petition', category: 'everyday', ageRange: [20, 90], cooldown: 15,
    text: 'The council wants to close the local library. A neighbor is collecting names.',
    choices: [
      { label: 'Sign it', outcomes: [any('One name among two thousand. It is enough, this time.', 'good', hid('karma', 3))] },
      { label: 'Run the campaign', check: chk(0.45, { 'stats.charm': 0.5, 'stats.intellect': 0.3, 'hidden.willpower': 0.3 }), outcomes: [
        ok('Leaflets, a march, and you on local radio. The library stays open.', hid('karma', 10), st('charm', 3), ms('Saved the local library.')),
        bad('Six months of evenings and it closes anyway. You keep the banner.', hid('karma', 6), st('mood', -5)),
      ] },
      { label: 'Say you never use it', outcomes: [any('Which is true, and nobody thanks you for saying it.', 'neutral', st('charm', -1))] },
    ],
  },
  {
    id: 'restaurant_bill', category: 'everyday', ageRange: [18, 90], cooldown: 12, requires: [has(100)],
    text: 'The bill arrives and the waiter has left off two main courses and a bottle.',
    choices: [
      { label: 'Point it out', outcomes: [any('The waiter looks as if you have saved his week. Dessert is on the house.', 'good', hid('karma', 5), st('mood', 3))] },
      { label: 'Pay it and leave a large tip', outcomes: [any('A compromise your conscience does not quite accept.', 'neutral', hid('karma', -1), cash(30))] },
      { label: 'Pay it and walk out quickly', outcomes: [any('You save {$80} and avoid that street for a while.', 'bad', hid('karma', -5), cash(80))] },
    ],
  },
  {
    id: 'lost_dog_poster', category: 'everyday', ageRange: [14, 90], cooldown: 15,
    text: 'A small dog with no collar follows you home. There are posters for it on every lamp post, offering {$200}.',
    choices: [
      { label: 'Take it back and refuse the reward', outcomes: [any('A child opens the door and cannot speak for crying. Worth more than the money.', 'good', hid('karma', 8), st('mood', 6))] },
      { label: 'Take it back and accept the reward', outcomes: [any('They press the envelope on you. Everyone is happy, the dog most of all.', 'good', hid('karma', 4), cash(200))] },
      { label: 'Keep the dog', outcomes: [any('You call it {pet}. You take the long way round for walks, away from the posters.', 'bad', addNpc('pet', 'pet', { species: 'dog' }), hid('karma', -8))] },
    ],
  },
  {
    id: 'talent_night', category: 'everyday', ageRange: [16, 80], cooldown: 12,
    text: 'The pub down the road is holding an open-mic night. First prize is {$150} and your name on a chalkboard.',
    choices: [
      { label: 'Sing', check: chk(0.3, { 'talents.singing': 1.0 }), outcomes: [
        ok('The room goes quiet in the good way. You win.', cash(150), tal('singing', 3), st('mood', 8)),
        bad('You start in the wrong key and stay there, bravely.', st('mood', -4), tal('singing', 1)),
      ] },
      { label: 'Tell jokes', check: chk(0.3, { 'stats.charm': 0.6, 'talents.acting': 0.5 }), outcomes: [
        ok('Five minutes that feel like flying. You win.', cash(150), st('charm', 3), tal('acting', 2), st('mood', 8)),
        bad('One laugh, and that was at the microphone falling over.', st('mood', -5)),
      ] },
      { label: 'Play something', check: chk(0.3, { 'talents.music': 1.0 }), outcomes: [
        ok('People put down their drinks to listen. You win.', cash(150), tal('music', 3), st('mood', 8)),
        bad('Your hands shake through the whole thing. Polite applause.', st('mood', -3), tal('music', 1)),
      ] },
      { label: 'Watch from the bar', outcomes: [any('A pleasant evening, and nobody saw you fail at anything.', 'neutral', st('mood', 2))] },
    ],
  },
  {
    id: 'witness_crash', category: 'everyday', ageRange: [16, 85], cooldown: 20,
    text: 'A car clips a cyclist at the junction in front of you and does not stop. You saw the number plate.',
    choices: [
      { label: 'Stay with the cyclist and call for help', outcomes: [any('You hold their hand until the ambulance comes. They send a card from hospital.', 'good', hid('karma', 10), st('mood', 2), count('livesSaved'))] },
      { label: 'Give the police the plate and a statement', outcomes: [any('Three hours at the station. The driver is charged within the week.', 'good', hid('karma', 6))] },
      { label: 'Keep walking. Others will stop', outcomes: [any('Others do. You think about it at night for longer than you expected.', 'bad', hid('karma', -8), st('mood', -5))] },
    ],
  },

  // ---------- Friends ----------
  {
    id: 'friend_moves_away', category: 'friends', ageRange: [22, 75], cooldown: 12, cast: { pal: 'friend' },
    text: '{pal} has taken a job four hundred miles away and is leaving at the end of the month.',
    choices: [
      { label: 'Throw them a proper send-off', requires: [has(200)], outcomes: [any('A hired room, a terrible speech, a very good night. {pal} cries twice.', 'good', cash(-200), rel('pal', 12), st('mood', 5))] },
      { label: 'Help them pack', outcomes: [any('A long weekend of boxes and old photographs. You promise to visit.', 'good', rel('pal', 8))] },
      { label: 'Say goodbye by message', outcomes: [any('A thumbs-up comes back. Something has ended and neither of you says so.', 'neutral', rel('pal', -10), st('mood', -3))] },
    ],
  },
  {
    id: 'friend_bad_partner', category: 'friends', ageRange: [18, 60], cooldown: 15, cast: { pal: 'friend' },
    text: '{pal} is besotted with someone new. You have met them twice and distrust them completely.',
    choices: [
      { label: 'Tell {pal} what you think', check: chk(0.4, { 'stats.charm': 0.7 }), outcomes: [
        ok('{pal} goes quiet, then says they had wondered too. It is over within a month.', rel('pal', 10), hid('karma', 3)),
        bad('{pal} tells you that you are jealous. You are not invited to things for a while.', rel('pal', -18), st('mood', -4)),
      ] },
      { label: 'Say nothing and stay close', outcomes: [any('It ends badly in the spring. You are the one {pal} calls at two in the morning.', 'good', rel('pal', 8), hid('karma', 4))] },
      { label: 'Keep your distance until it blows over', outcomes: [any('It takes two years to blow over, and {pal} notices who was missing.', 'neutral', rel('pal', -8))] },
    ],
  },
  {
    id: 'friend_big_news', category: 'friends', ageRange: [20, 70], cooldown: 10, cast: { pal: 'friend' },
    text: '{pal} has had the kind of luck you have always wanted: the promotion, the house, the lot.',
    choices: [
      { label: 'Be glad for them, and mean it', check: chk(0.6, { 'hidden.karma': 0.5, 'stats.mood': 0.4 }), outcomes: [
        ok('You buy the first round and find you do mean it.', rel('pal', 8), hid('karma', 4), st('mood', 3)),
        bad('You say all the right things with a face like a shut door. {pal} is not fooled.', rel('pal', -4), st('mood', -4)),
      ] },
      { label: 'Ask how they did it', outcomes: [any('{pal} talks you through it over lunch. Some of it is even useful.', 'good', rel('pal', 4), st('intellect', 2), hid('discipline', 2))] },
      { label: 'Find a reason to be busy', outcomes: [any('You see the photographs online instead, which is worse.', 'bad', rel('pal', -8), st('mood', -5)), any('You hear all about it afterward from someone else, which is worse.', 'bad', rel('pal', -8), st('mood', -5))] },
    ],
  },
  {
    id: 'old_friend_message', category: 'friends', ageRange: [28, 85], cooldown: 15,
    text: 'A message arrives from someone you have not spoken to in years: "Saw something today that made me think of you."',
    choices: [
      { label: 'Ring them at once', outcomes: [any('Two hours on the phone as if no time had passed. {pal} is back in your life.', 'good', addNpc('friend', 'pal'), st('mood', 7))] },
      { label: 'Send something warm and brief', outcomes: [any('A few messages back and forth. It is nice, and it stays small.', 'neutral', st('mood', 2))] },
      { label: 'Leave it on read', outcomes: [any('You mean to answer. Then it has been too long to answer.', 'neutral', st('mood', -2))] },
    ],
  },

  // ---------- Work ----------
  {
    id: 'training_course', category: 'work', ageRange: [20, 62], cooldown: 8, requires: [employed],
    text: 'Work will pay for an evening course if you give up your Tuesdays for six months.',
    choices: [
      { label: 'Take it', check: chk(0.7, { 'hidden.discipline': 0.6, 'stats.intellect': 0.3 }), outcomes: [
        ok('You finish near the top of the class, and it shows in your work.', perf(10), st('intellect', 4)),
        bad('You miss a third of the sessions and scrape through.', perf(2), st('mood', -2)),
      ] },
      { label: 'Ask for the money instead', outcomes: [any('"That is not how it works," says HR, who make a note.', 'neutral', perf(-2))] },
      { label: 'Keep your Tuesdays', outcomes: [any('You watch a great deal of television on Tuesdays.', 'neutral', st('mood', 2))] },
    ],
  },
  {
    id: 'leaving_collection', category: 'work', ageRange: [18, 68], cooldown: 8, requires: [employed, has(50)],
    text: 'An envelope comes round for someone leaving after thirty years. You have spoken to them perhaps four times.',
    choices: [
      { label: 'Put in {$20}', outcomes: [any('You sign the card "All the best", like everybody else.', 'good', cash(-20), hid('karma', 2))] },
      { label: 'Put in {$5} and feel fine about it', outcomes: [any('It all adds up.', 'neutral', cash(-5))] },
      { label: 'Pass it on quickly', outcomes: [any('The person at the next desk saw. They say nothing, pointedly.', 'bad', hid('karma', -2), st('charm', -1))] },
    ],
  },
  {
    id: 'headhunter_call', category: 'work', ageRange: [26, 58], cooldown: 12, requires: [employed, need('career.performance', '>=', 60)],
    text: 'A recruiter calls your cell at your desk: a rival firm would like to talk, and is hinting at more money.',
    choices: [
      { label: 'Use it to ask for a raise', check: chk(0.45, { 'stats.charm': 0.4, 'career.performance': 0.6 }), outcomes: [
        ok('Your boss matches it before you have finished the sentence.', pay(1.08), st('mood', 6)),
        bad('"Then perhaps you should take it," says your boss, who is not bluffing.', perf(-8), st('mood', -6)),
      ] },
      { label: 'Hear them out, quietly', outcomes: [any('A coffee, a number, a business card in your wallet. Nice to be wanted.', 'good', st('mood', 4), hid('willpower', 2))] },
      { label: 'Say you are happy where you are', outcomes: [any('You are surprised to find that you mean it.', 'good', st('mood', 3), perf(2))] },
    ],
  },

  // ---------- Money ----------
  {
    id: 'tax_refund', category: 'money', ageRange: [20, 80], cooldown: 12, requires: [need('finance.lifetimeTaxPaid', '>=', 1)],
    text: 'The tax office writes to say you overpaid. A refund of {$600} is on its way.',
    choices: [
      { label: 'Bank it', outcomes: [any('It lands on a Tuesday. You look at the balance twice.', 'good', cash(600), hid('discipline', 2))] },
      { label: 'Spend it on something you have put off', outcomes: [any('The boiler is serviced and the tooth is fixed. Dull, and a relief.', 'good', cash(200), st('health', 2), st('mood', 3))] },
      { label: 'Blow the lot on one weekend', outcomes: [any('You remember most of it fondly.', 'neutral', st('mood', 8), st('health', -1))] },
    ],
  },
  {
    id: 'subscription_trap', category: 'money', ageRange: [18, 90], cooldown: 12, requires: [has(300)],
    text: 'Going through your statements, you find you have been paying for a gym in a city you left years ago.',
    choices: [
      { label: 'Ring and argue for a refund', check: chk(0.4, { 'stats.charm': 0.4, 'hidden.willpower': 0.5 }), outcomes: [
        ok('Fifty minutes on hold and one supervisor later, they refund the lot.', cash(450), hid('willpower', 2)),
        bad('They quote the contract at you. You cancel, at least.', st('mood', -3)),
      ] },
      { label: 'Just cancel it', outcomes: [any('Done in four minutes. You try not to add up what it cost.', 'neutral', hid('discipline', 1))] },
      { label: 'Go through every other payment too', outcomes: [any('Two more surprises. You are {$30} a month better off and slightly ashamed.', 'good', cash(360), hid('discipline', 4))] },
    ],
  },
  {
    id: 'family_heirloom', category: 'money', ageRange: [25, 90], once: true,
    text: 'Clearing a cupboard, you find a small painting that came down through the family. A dealer offers {$3000} on sight.',
    choices: [
      { label: 'Sell it', outcomes: [any('The money is useful. The pale square on the wall stays for years.', 'neutral', cash(3000), st('mood', -2))] },
      { label: 'Get a second opinion', check: chk(0.5, { 'stats.intellect': 0.6 }), outcomes: [
        ok('An auction house takes it. It makes {$11000} on a wet Thursday.', cash(11000), st('intellect', 2), st('mood', 6)),
        bad('The second opinion is that it is a nice frame. The dealer has stopped answering.', st('mood', -3)),
      ] },
      { label: 'Hang it where you can see it', outcomes: [any('It was your grandmother\'s. It looks right there.', 'good', st('mood', 5), hid('karma', 2))] },
    ],
  },
  {
    id: 'door_salesman', category: 'money', ageRange: [25, 95], cooldown: 12, requires: [has(2000)],
    text: 'A very pleasant man on the doorstep says your roof needs urgent work, and he can start today for {$2000} in cash.',
    choices: [
      { label: 'Send him away', outcomes: [any('He is three doors down by the time you have shut yours. The roof is fine.', 'good', st('intellect', 1))] },
      { label: 'Ask for it in writing first', outcomes: [any('He remembers another appointment. You ring the neighbors to warn them.', 'good', hid('karma', 4), st('intellect', 1))] },
      { label: 'Pay him', outcomes: [any('He takes the cash, moves one tile, and is never seen again.', 'bad', cash(-2000), st('mood', -8))] },
    ],
  },

  // ---------- Health and habits ----------
  {
    id: 'bad_back_morning', category: 'health', ageRange: [30, 80], cooldown: 12,
    text: 'You bend to tie a shoelace and something in your back gives way with a sound like a zip.',
    choices: [
      { label: 'Rest, then build it back up properly', check: chk(0.65, { 'hidden.discipline': 0.6 }), outcomes: [
        ok('Six weeks of dull exercises. It holds.', st('health', 1), hid('discipline', 2)),
        bad('You stop the exercises when it stops hurting. It starts hurting.', cond('back_pain'), st('health', -3)),
      ] },
      { label: 'Carry on as normal', check: chk(0.35, { 'stats.health': 0.6 }), outcomes: [
        ok('Stiff for a week and then fine. Bodies are forgiving, until they are not.', st('health', -1)),
        bad('It never quite goes away again.', cond('back_pain'), st('health', -4), st('mood', -4)),
      ] },
      { label: 'Lie on the floor and call in sick', outcomes: [any('Two days flat on the carpet, looking at the underside of the table.', 'neutral', st('health', -1), st('mood', -2))] },
    ],
  },
  {
    id: 'new_year_resolution', timing: { yearTurn: true }, category: 'health', ageRange: [18, 85], cooldown: 8,
    text: 'It is the first of January. This year is going to be different.',
    choices: [
      { label: 'Get fit', check: chk(0.35, { 'hidden.discipline': 0.9 }), outcomes: [
        ok('You are still at it in December. Nobody is more surprised than you.', st('health', 6), st('charm', 2), hid('discipline', 4)),
        bad('You last until the nineteenth of January, which is above average.', st('mood', -2)),
      ] },
      { label: 'Read a book a month', check: chk(0.45, { 'hidden.discipline': 0.6, 'stats.intellect': 0.3 }), outcomes: [
        ok('Twelve books, one of them enormous.', st('intellect', 4), st('mood', 3)),
        bad('One and a half books. The half was good.', st('intellect', 1)),
      ] },
      { label: 'Be kinder', outcomes: [any('Hard to measure. People do seem pleased to see you.', 'good', hid('karma', 6), st('charm', 2))] },
      { label: 'Resolve nothing', outcomes: [any('You cannot fail at what you never started.', 'neutral', st('mood', 1))] },
    ],
  },
  {
    id: 'sleepless_spell', category: 'health', ageRange: [25, 85], cooldown: 12,
    text: 'For three weeks you have been wide awake at four every morning, going over old conversations.',
    choices: [
      { label: 'See someone about it', outcomes: [any('It helps to say it out loud. The sleep comes back slowly.', 'good', st('mood', 6), st('health', 2))] },
      { label: 'Cut the coffee and the late screens', check: chk(0.55, { 'hidden.discipline': 0.7 }), outcomes: [
        ok('Dull evenings, solid nights.', st('health', 3), st('mood', 3)),
        bad('You manage four days. The ceiling is very familiar by now.', st('health', -2), st('mood', -3)),
      ] },
      { label: 'Use the extra hours', outcomes: [any('You get a lot done, and you look like it.', 'neutral', st('intellect', 2), st('health', -4), st('charm', -1))] },
    ],
  },
  {
    id: 'choking_diner', category: 'health', ageRange: [16, 80], cooldown: 30,
    text: 'At the next table, someone stands up suddenly with both hands at their throat. Nobody else has moved.',
    choices: [
      { label: 'Get behind them and thrust', check: chk(0.6, { 'stats.intellect': 0.3, 'stats.health': 0.3, 'hidden.willpower': 0.3 }), outcomes: [
        ok('On the third thrust it comes free. They breathe. The room applauds, and your hands shake for an hour.', hid('karma', 12), count('livesSaved'), st('mood', 8), ms('Saved a stranger\'s life.')),
        bad('You try, and cannot shift it. A waiter who knows how takes over just in time.', hid('karma', 5), st('mood', -3)),
      ] },
      { label: 'Shout for someone who knows what to do', outcomes: [any('A nurse two tables away is already on her feet. It is over in seconds.', 'neutral', hid('karma', 2))] },
      { label: 'Freeze', outcomes: [any('Someone else acts. You sit with your fork in the air and think about it for a long time.', 'bad', st('mood', -6))] },
    ],
  },

  // ---------- Conscience ----------
  {
    id: 'cash_machine_extra', category: 'conscience', ageRange: [18, 90], cooldown: 20,
    text: 'The cash machine gives you {$200} more than you asked for. The receipt shows the smaller amount.',
    choices: [
      { label: 'Go into the bank and hand it back', outcomes: [any('The cashier has to fetch a manager, because there is no form for this.', 'good', hid('karma', 8), st('mood', 2))] },
      { label: 'Keep it', outcomes: [
        { on: 'always', weight: 0.75, tone: 'bad', text: 'Nobody ever asks. It spends like any other money.', effects: [cash(200), hid('karma', -6)] },
        { on: 'always', weight: 0.25, tone: 'bad', text: 'The bank finds the error, takes it back, and adds a stiff letter.', effects: [hid('karma', -6), st('mood', -4)] },
      ] },
      { label: 'Give the extra to the next collection tin', outcomes: [any('Not yours to give, strictly. It feels better than keeping it.', 'neutral', hid('karma', 3), count('donated', 200))] },
    ],
  },
  {
    id: 'neighbor_secret', category: 'conscience', ageRange: [22, 90], cooldown: 20,
    text: 'You see your neighbor\'s spouse in a café two towns over, holding hands with someone who is not your neighbor.',
    choices: [
      { label: 'Tell your neighbor', outcomes: [any('A terrible conversation over the fence. They thank you for it, a year later.', 'neutral', hid('karma', 2), st('mood', -4))] },
      { label: 'Say nothing to anyone', outcomes: [any('You nod to both of them on trash day and keep it to yourself.', 'neutral', hid('discipline', 2))] },
      { label: 'Tell everyone except your neighbor', outcomes: [any('The whole street knows by the weekend. So does the street know who told them.', 'bad', hid('karma', -8), st('charm', -3))] },
    ],
  },
  {
    id: 'found_phone', category: 'conscience', ageRange: [14, 90], cooldown: 15,
    text: 'There is an unlocked phone on the bus seat beside you, the newest model, buzzing with messages.',
    choices: [
      { label: 'Ring the last number and arrange to return it', outcomes: [any('The owner meets you at the stop, nearly in tears. They try to give you {$40}.', 'good', hid('karma', 7), cash(40))] },
      { label: 'Hand it to the driver', outcomes: [any('The driver drops it in a box with eleven others.', 'neutral', hid('karma', 3))] },
      { label: 'Pocket it', outcomes: [any('A shop that asks no questions gives you {$250}. You take a different bus for a while.', 'bad', cash(250), hid('karma', -10), count('crimes'), heat(6))] },
    ],
  },
  {
    id: 'volunteer_ask', category: 'conscience', ageRange: [18, 85], cooldown: 12,
    text: 'The food bank is short of hands on Saturday mornings. Someone has put a sign-up sheet through your door.',
    choices: [
      { label: 'Sign up for the year', check: chk(0.6, { 'hidden.discipline': 0.6 }), outcomes: [
        ok('Fifty Saturdays. You know every regular by name and how they take their tea.', hid('karma', 14), st('mood', 6), st('charm', 2)),
        bad('You do five weeks and then life gets in the way. They are grateful for the five.', hid('karma', 4)),
      ] },
      { label: 'Do one Saturday', outcomes: [any('Four hours of tins and carrier bags. You sleep well that night.', 'good', hid('karma', 5), st('mood', 3))] },
      { label: 'Give money instead', requires: [has(100)], outcomes: [any('They can buy more with it than you could carry.', 'good', cash(-100), hid('karma', 5), count('donated', 100))] },
      { label: 'Recycle the sheet', outcomes: [any('Saturday mornings remain your own.', 'neutral')] },
    ],
  },

  // ---------- Middle years ----------
  {
    id: 'milestone_birthday', timing: { yearTurn: true }, category: 'middle years', ageRange: [40, 60], cooldown: 9, requires: [need('age', 'in', [40, 50, 60])],
    text: 'A birthday with a nought on the end. People keep asking how you feel about it.',
    choices: [
      { label: 'Throw a big party', requires: [has(800)], outcomes: [any('Everyone you love in one room, and a cake that is a fire risk.', 'good', cash(-800), st('mood', 12), st('charm', 2))] },
      { label: 'Do something you have never done', check: chk(0.7, { 'stats.health': 0.4 }), outcomes: [
        ok('You jump out of a perfectly good airplane and scream the whole way down. Wonderful.', st('mood', 12), hid('willpower', 4)),
        bad('You pull a muscle on the first morning of the hiking trip and see the mountain from a café.', st('mood', -2), st('health', -3)),
      ] },
      { label: 'Let it pass quietly', outcomes: [any('A good dinner and an early night. It is only a number.', 'neutral', st('mood', 2))] },
      { label: 'Lie about your age from now on', outcomes: [any('You are 39 again, and you intend to stay there.', 'neutral', hid('crazy', 3), st('mood', 3))] },
    ],
  },
  {
    id: 'old_photographs', category: 'middle years', ageRange: [35, 95], cooldown: 15,
    text: 'A shoebox of old photographs turns up at the back of a wardrobe.',
    choices: [
      { label: 'Go through them all', outcomes: [any('There you are, with hair and no idea. You laugh more than you expected to.', 'good', st('mood', 6))] },
      { label: 'Ring someone who is in them', outcomes: [any('You talk for an hour. "We should do this more," you both say.', 'good', st('mood', 5), st('charm', 1))] },
      { label: 'Put the lid back on', outcomes: [any('Not today.', 'neutral', st('mood', -1))] },
    ],
  },
  {
    id: 'learn_something_new', category: 'middle years', ageRange: [30, 80], cooldown: 12,
    text: 'An evening class brochure comes through the door, and for once you read it.',
    choices: [
      { label: 'Take up an instrument', check: chk(0.5, { 'hidden.discipline': 0.6, 'talents.music': 0.4 }), outcomes: [
        ok('By the summer you can play three pieces badly and one well.', tal('music', 6), st('mood', 5)),
        bad('The instrument lives in its case under the bed.', st('mood', -1)),
      ] },
      { label: 'Join the dance class', check: chk(0.5, { 'talents.dance': 0.5, 'stats.health': 0.3 }), outcomes: [
        ok('You are not good, and you are much better than you were.', tal('dance', 6), st('health', 3), st('mood', 5)),
        bad('Two left feet and a sore hip. You last a month.', st('health', -1)),
      ] },
      { label: 'Learn a language', check: chk(0.5, { 'stats.intellect': 0.6, 'hidden.discipline': 0.4 }), outcomes: [
        ok('You can order dinner, ask the way and argue about football.', st('intellect', 5), st('mood', 4)),
        bad('You can say "the apple is red" with great confidence.', st('intellect', 1)),
      ] },
      { label: 'Put the brochure in the recycling', outcomes: [any('Next year, perhaps.', 'neutral')] },
    ],
  },

  // ---------- Later life ----------
  {
    id: 'driving_keys', category: 'later life', ageRange: [74, 120], once: true,
    text: 'You clip the gatepost again. The family have started exchanging looks about your driving.',
    choices: [
      { label: 'Hand over the keys', outcomes: [any('It is like losing a limb for a month. Then you find the bus is full of people to talk to.', 'good', st('mood', -3), hid('karma', 4), st('charm', 2))] },
      { label: 'Take a refresher lesson', check: chk(0.5, { 'stats.health': 0.5, 'stats.intellect': 0.3 }), outcomes: [
        ok('The instructor says you are safer than most people half your age.', st('mood', 6)),
        bad('The instructor is kind about it. You take the hint.', st('mood', -5)),
      ] },
      { label: 'Carry on. You have been driving for sixty years', outcomes: [
        { on: 'always', weight: 0.8, tone: 'neutral', text: 'You go on driving, a little slower, with everyone holding their breath.', effects: [hid('willpower', 2)] },
        { on: 'always', weight: 0.17, tone: 'bad', text: 'You pull out without looking. The car is written off and you spend a month in the hospital.', effects: [st('health', -25), st('mood', -10)] },
        { on: 'always', weight: 0.03, tone: 'bad', text: 'You pull out without looking.', effects: [death('a car accident')] },
      ] },
    ],
  },
  {
    id: 'funeral_of_friend', category: 'later life', ageRange: [62, 120], cooldown: 10,
    text: 'Another funeral. You have reached the age where the black coat never quite gets put away.',
    choices: [
      { label: 'Give the eulogy', check: chk(0.6, { 'stats.charm': 0.4, 'stats.intellect': 0.3 }), outcomes: [
        ok('People laugh in the right places and cry in the others. The family ask for a copy.', hid('karma', 6), st('mood', 2)),
        bad('Your voice goes halfway through. Someone comes up and finishes it with you.', st('mood', -4), hid('karma', 4)),
      ] },
      { label: 'Sit at the back and remember', outcomes: [any('You think of a joke they once told and nearly disgrace yourself.', 'neutral', st('mood', -2))] },
      { label: 'Stay for the wake and see everyone', outcomes: [any('It turns into the best party in years, which is what they would have wanted.', 'good', st('mood', 4), st('charm', 1))] },
    ],
  },
  {
    id: 'scam_call', category: 'later life', ageRange: [65, 120], cooldown: 8, requires: [has(3000)],
    text: 'A polite young man calls to say he is from your bank\'s fraud team, and your savings must be moved tonight to keep them safe.',
    choices: [
      { label: 'Hang up and ring the bank yourself', outcomes: [any('The bank has never heard of him. They thank you for reporting it.', 'good', st('intellect', 1), hid('karma', 2))] },
      { label: 'Keep him talking for an hour', outcomes: [any('You invent three accounts and a parrot. He hangs up on you in the end.', 'good', st('mood', 8), tal('acting', 2))] },
      { label: 'Do as he says', check: chk(0.5, { 'stats.intellect': 0.8 }), outcomes: [
        ok('Halfway through reading out the numbers, something stops you. You put the phone down.', st('mood', -3)),
        bad('He is very reassuring. {$3000} is gone by morning.', cash(-3000), st('mood', -12)),
      ] },
    ],
  },
  {
    id: 'allotment', category: 'later life', ageRange: [58, 120], once: true,
    text: 'After six years on the waiting list, a letter comes: an allotment plot is yours if you want it.',
    choices: [
      { label: 'Take it and dig', check: chk(0.6, { 'stats.health': 0.5, 'hidden.discipline': 0.4 }), outcomes: [
        ok('Beans, potatoes, and more courgettes than any street could eat.', st('health', 5), st('mood', 8), ms('Took on an allotment.')),
        bad('The weeds win by July. You keep the shed and a deckchair.', st('mood', 2)),
      ] },
      { label: 'Share it with a neighbor', outcomes: [any('They do the digging and you do the tea. An excellent arrangement. {pal} becomes a friend.', 'good', addNpc('friend', 'pal'), st('mood', 5))] },
      { label: 'Let it go to the next name', outcomes: [any('Your knees send their thanks.', 'neutral')] },
    ],
  },
  {
    id: 'memory_slip', category: 'later life', ageRange: [70, 120], cooldown: 8,
    text: 'You stand in the kitchen with no idea what you came in for. It is the third time this week.',
    choices: [
      { label: 'Mention it to the doctor', outcomes: [any('Some tests, a little reassurance, and a crossword prescribed daily.', 'good', st('intellect', 1), st('mood', 2))] },
      { label: 'Start writing everything down', outcomes: [any('Notebooks in every room. You become oddly well organized.', 'good', hid('discipline', 3))] },
      { label: 'Laugh it off', outcomes: [any('You go back out, and remember in the hall. It was the kettle.', 'neutral', st('mood', 1), st('intellect', -1))] },
    ],
  },
];

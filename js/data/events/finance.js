// Scenes about money. Each one starts from something that is really true of
// the life: a first wage, a sibling, a card, a marriage. What the player
// chooses moves real money through the money engines (the `money` effect:
// engine/moneyEffects.js). Bad offers and bank mistakes are rare, can always
// be walked away from, and describe nothing anyone could copy.
import { st, hid, cash, rel, ok, bad, any, chk, need, mem } from './helpers.js';

const money = (op, o = {}) => ({ type: 'money', op, ...o });
const learn = (value, why) => money('learn', { value, why });

/** @type {import('../../types.js').GameEvent[]} */
export default [
  {
    id: 'first_paycheck', category: 'money', ageRange: [14, 30], weight: 40, cooldown: 99, requires: [need('firstPayNow', '==', true)],
    text: 'Your first pay has arrived. It is not much, and it is the first money that was ever entirely yours. What will you do with it?',
    choices: [
      { label: 'Save most of it', outcomes: [any('You put most of it away and keep a little out. It feels like the beginning of something.', 'good', money('save', { share: 0.7 }), learn(4, 'firstpay'), hid('discipline', 3))] },
      { label: 'Buy something you have wanted', outcomes: [any('You have looked at it in the window for months. Now it is yours, and you paid for it.', 'good', money('spend', { share: 0.6, what: 'Something you had wanted for a long time' }), st('mood', 8))] },
      { label: 'Help with something at home', requires: [need('roles', 'has', 'parent')], outcomes: [any('You leave some of it on the kitchen table without a word. Nothing is said. The look says it.', 'good', money('spend', { share: 0.5, what: 'Help with the family\'s bills' }), hid('karma', 6), st('mood', 3))] },
      { label: 'Split it: some saved, some spent', outcomes: [any('Half away, half for now. Sensible, and still fun.', 'good', money('save', { share: 0.4 }), money('spend', { share: 0.3, what: 'A treat from your first pay' }), learn(3, 'firstpay'), st('mood', 4))] },
    ],
  },
  {
    id: 'sibling_needs_help', category: 'money', ageRange: [22, 80], cooldown: 14, cast: { sib: 'sibling' },
    castRequires: [need('cast.sib.age', '>=', 20), need('cast.sib.money', '<=', 40)], requires: [need('cashBase', '>=', 4000)],
    text: '{sib} calls late, and gets to the point slowly. It has been a hard year. Could you help with the rent, just until things turn?',
    choices: [
      { label: 'Give them the money ({$1500})', outcomes: [any('You send it that night and tell {sib} it is a gift, not a debt.', 'good', money('give', { target: 'sib', base: 1500 }), mem('sib', 'helped_rent', 'You paid my rent the year everything went wrong.'))] },
      { label: 'Lend it, to be paid back ({$1500})', outcomes: [any('You agree on three years, and write it down so that neither of you has to remember.', 'neutral', money('lend', { target: 'sib', base: 1500, years: 3 }))] },
      { label: 'Help another way', outcomes: [any('You spend a weekend going through job adverts and forms with {sib}. It is not money. It is not nothing.', 'good', rel('sib', 5), hid('karma', 2))] },
      { label: 'Say you cannot', outcomes: [any('"No, of course. Forget I asked." {sib} hangs up quickly.', 'bad', rel('sib', -10))] },
    ],
  },
  {
    id: 'billing_mistake', category: 'money', ageRange: [19, 90], cooldown: 12, weight: 0.6, requires: [need('cashBase', '>=', 600)],
    text: 'Going through the month\'s payments, you see the same bill has been taken twice. The second one should not be there.',
    choices: [
      { label: 'Ring them and dispute it', check: chk(0.6, { moneySense: 0.6, 'stats.charm': 0.2 }), outcomes: [
        ok('Forty minutes on hold, one calm conversation, and it is corrected before the money has even left.', learn(3, 'dispute'), st('mood', 2)),
        bad('They agree it is their mistake and promise a refund "within ninety days". You will be chasing it for a while, and get most of it back.', cash(-80), learn(2, 'dispute'), st('mood', -3)),
      ] },
      { label: 'Ask your bank to look into it', outcomes: [any('The bank takes the details, reverses the second payment and tells you it happens more than you would think.', 'good', learn(2, 'bank'))] },
      { label: 'Let it go', outcomes: [any('It is not worth an afternoon, you decide. The money is gone.', 'neutral', cash(-240))] },
    ],
  },
  {
    id: 'too_good_offer', category: 'money', ageRange: [20, 90], cooldown: 15, weight: 0.5, requires: [need('cashBase', '>=', 3000)],
    text: 'Someone you half know is very excited about an investment. It cannot lose, the returns are guaranteed, and the chance closes on Friday. You would need to decide today.',
    choices: [
      { label: 'Say no', outcomes: [any('Nothing that is guaranteed needs to be decided by Friday. You wish them luck.', 'good', learn(2, 'offer'))] },
      { label: 'Ask your bank what they make of it', outcomes: [any('The woman at the bank listens to two sentences and shakes her head. "If it comes with a deadline and a promise, keep your money."', 'good', learn(5, 'offer'))] },
      { label: 'Put some in ({$1000})', check: chk(0.08, { moneySense: -0.2 }), outcomes: [
        ok('Against the odds you are paid back with a little on top, before it all goes quiet. You know how lucky that was.', cash(150), learn(3, 'offer')),
        bad('The first statement looks wonderful. There is no second statement, and the number no longer answers.', cash(-1000), st('mood', -8), learn(6, 'offer')),
      ] },
    ],
  },
  {
    id: 'card_alert', category: 'money', ageRange: [18, 90], cooldown: 12, weight: 0.6, requires: [need('hasCard', '==', true)],
    text: 'A message from your bank: two payments on your card that you do not recognize, in a town you have never been to. Was this you?',
    choices: [
      { label: 'Ring the bank on the number on the card', outcomes: [any('It was not you, and they had guessed as much. The payments are stopped, the card is replaced, and you owe nothing.', 'good', learn(3, 'cardfraud'))] },
      { label: 'Go through the statement first', outcomes: [any('You check every line, find the two that are not yours, and report them the same evening. Nothing is lost.', 'good', learn(4, 'cardfraud'))] },
      { label: 'Ignore it', outcomes: [any('It was real. By the time you look, more has gone. The bank refunds most of it, eventually, and not all.', 'bad', cash(-200), st('mood', -4), learn(2, 'cardfraud'))] },
    ],
  },
  {
    id: 'money_talk', category: 'money', ageRange: [20, 80], cooldown: 10, cast: { love: 'spouse' },
    text: 'It starts as a conversation about a vacation and turns into one about money. {love} thinks one of you spends too freely. You are fairly sure which one they mean.',
    choices: [
      { label: 'Sit down and go through it together', outcomes: [any('An hour with the figures on the table. It is less frightening written down, and you agree what matters to both of you.', 'good', rel('love', 6), learn(3, 'couple'))] },
      { label: 'Agree to keep your money separate', outcomes: [any('What is yours is yours, what is theirs is theirs, and the bills get paid. It suits you both, more or less.', 'neutral', rel('love', 1))] },
      { label: 'Tell them it is your money', outcomes: [any('It is. That is not what they were asking, and you both know it.', 'bad', rel('love', -9), st('mood', -3))] },
    ],
  },
  {
    id: 'retirement_thoughts', category: 'money', ageRange: [55, 66], cooldown: 99, requires: [need('employed', '==', true)],
    text: 'A colleague your own age is leaving at the end of the month. At the party someone asks, lightly, when it will be your turn. You find you do not know the answer.',
    choices: [
      { label: 'Go home and work out the figures', outcomes: [any('A pension, what you have saved, what a year costs. For the first time you know roughly where you stand. (My Money, Retirement, has the sums.)', 'good', learn(4, 'retire'), st('mood', 2))] },
      { label: 'Decide you will work as long as you can', outcomes: [any('You like the work, mostly. You will stop when it stops being true.', 'neutral', hid('willpower', 2))] },
      { label: 'Change the subject', outcomes: [any('"Not for years yet." You get another drink.', 'neutral')] },
    ],
  },
  {
    id: 'wedding_budget', category: 'money', ageRange: [18, 80], cooldown: 99, weight: 3, cast: { love: 'partner' }, castRequires: [need('cast.love.flags.engaged', '>=', 100)],
    text: 'The wedding. {love} has a folder of ideas, and you have a number in your head that is a good deal smaller. It is time to agree what you will spend.',
    choices: [
      { label: 'Small and close: family and a long lunch', outcomes: [any('A dozen people, a good meal, and nothing owed afterward. {love} says it was perfect, and means it.', 'good', rel('love', 5), learn(2, 'wedding'))] },
      { label: 'Save for a year first', outcomes: [any('You agree a figure and put money aside for it every month. The wedding waits, and is paid for.', 'good', money('save', { share: 0.25 }), learn(3, 'wedding'), rel('love', 2))] },
      { label: 'The day of your dreams ({$15000})', requires: [need('cashBase', '>=', 15000)], outcomes: [any('A day nobody will forget, and a bill you will remember a while longer.', 'good', money('spend', { base: 15000, what: 'Your wedding' }), rel('love', 8), st('mood', 6))] },
      { label: 'Put it on a card and worry later', requires: [need('hasCard', '==', true)], outcomes: [any('It is a wonderful day. The statement in January is less so.', 'neutral', money('spend', { base: 8000, what: 'Your wedding, on the card', card: true }), rel('love', 6), st('mood', 3))] },
    ],
  },
  {
    id: 'baby_savings', category: 'money', ageRange: [18, 55], cooldown: 99, weight: 4, requires: [need('flags.pregnancy', '!=', false)],
    text: 'A baby is coming. Somebody at work hands you a list of everything you will apparently need. It runs to two pages, and the total at the bottom is not small.',
    choices: [
      { label: 'Start putting money aside now', outcomes: [any('You set aside a little each month. By the time the baby comes, the stroller is paid for.', 'good', money('save', { share: 0.2 }), learn(3, 'baby'))] },
      { label: 'Buy secondhand from other parents', outcomes: [any('A cot from a neighbor, clothes in trash bags from a cousin. The baby does not notice.', 'good', money('spend', { base: 300, what: 'Secondhand things for the baby' }), learn(2, 'baby'))] },
      { label: 'Buy everything new', outcomes: [any('It is all beautiful, and some of it will be used.', 'neutral', money('spend', { base: 3500, what: 'Everything new for the baby' }), st('mood', 4))] },
    ],
  },
  {
    id: 'partner_retrains', category: 'money', ageRange: [24, 62], cooldown: 15, cast: { love: 'spouse' }, castRequires: [need('cast.love.age', '<=', 55)],
    text: '{love} has been unhappy at work for a long time. Tonight they say it out loud: they want to retrain, and it would mean a year or two of earning very little.',
    choices: [
      { label: 'Back them, and help with the course ({$3000})', requires: [need('cashBase', '>=', 3000)], outcomes: [any('You pay for the course and take on more of the bills for a while. {love} has not looked this awake in years.', 'good', money('give', { target: 'love', base: 3000 }), rel('love', 10), mem('love', 'backed_retrain', 'You backed me when I wanted to start again.'))] },
      { label: 'Back them, once there is more saved', outcomes: [any('You agree on a date a year from now, and a number to reach before then. It is a plan, and {love} can live with a plan.', 'neutral', money('save', { share: 0.15 }), rel('love', 3), learn(2, 'couple'))] },
      { label: 'Say you cannot afford it', outcomes: [any('{love} nods and does not raise it again. It sits between you for a while.', 'bad', rel('love', -8))] },
    ],
  },
  {
    id: 'parent_money_help', category: 'money', ageRange: [30, 80], cooldown: 12, cast: { par: 'parent' }, castRequires: [need('cast.par.age', '>=', 74), need('cast.par.money', '<=', 45)],
    text: '{par} is finding things harder: the stairs, the shopping, the bills. They would never ask, but a little help with money would make a real difference.',
    choices: [
      { label: 'Help with their bills ({$2000})', requires: [need('cashBase', '>=', 2500)], outcomes: [any('You set up a payment toward their heating and shopping. {par} protests, and then thanks you.', 'good', money('give', { target: 'par', base: 2000 }), hid('karma', 5), mem('par', 'helped_old', 'You looked after me when I needed it.'))] },
      { label: 'Give your time instead', outcomes: [any('Saturday mornings are theirs now: shopping, letters, the odd repair.', 'good', rel('par', 8), st('mood', -1), hid('karma', 3))] },
      { label: 'Ask your brothers and sisters to share it', requires: [need('roles', 'has', 'sibling')], outcomes: [any('A family conversation, slightly tense, ends in a plan everyone can live with.', 'neutral', money('give', { target: 'par', base: 700 }), rel('par', 4))] },
      { label: 'Leave them to manage', outcomes: [any('They manage, more or less. You do not ask how.', 'bad', rel('par', -10))] },
    ],
  },
  {
    id: 'child_to_university', category: 'money', ageRange: [36, 80], cooldown: 4, cast: { kid: 'child' }, castRequires: [need('cast.kid.age', '>=', 18), need('cast.kid.age', '<=', 20)],
    text: '{kid} has a place to study, and a long list of costs: fees, rent, books, a laptop that works. They ask, carefully, what you might be able to do.',
    choices: [
      { label: 'Pay a good part of it ({$8000})', requires: [need('cashBase', '>=', 8000)], outcomes: [any('You cover the rent for the first year. {kid} will owe less when they finish.', 'good', money('give', { target: 'kid', base: 8000 }), rel('kid', 8), mem('kid', 'paid_uni', 'You helped me through university.'))] },
      { label: 'Lend it, to be paid back once they work ({$8000})', requires: [need('cashBase', '>=', 8000)], outcomes: [any('A loan between you, written down, no interest. {kid} seems relieved to be trusted with it.', 'neutral', money('lend', { target: 'kid', base: 8000, years: 5 }), rel('kid', 3))] },
      { label: 'Help them find grants and a part-time job', outcomes: [any('An evening of forms and job adverts. They will manage it themselves, with a student loan.', 'neutral', rel('kid', 2), learn(1, 'uni'))] },
    ],
  },
  {
    id: 'grandparent_gift', category: 'money', ageRange: [8, 17], cooldown: 4, cast: { gp: 'grandparent' },
    text: '{gp} presses an envelope into your hand when nobody is looking. "Do not tell your parents. Do something sensible with it. Or not." Inside is more money than you have ever held.',
    choices: [
      { label: 'Put it in the bank', requires: [need('hasBankAccount', '==', true)], outcomes: [any('It goes straight into your account. You check the balance more than once that week.', 'good', cash(200), money('save', { base: 200 }), rel('gp', 4), learn(2, 'gift'))] },
      { label: 'Spend some, keep some', outcomes: [any('Half on something you wanted, half in a sock drawer.', 'good', cash(100), rel('gp', 4), learn(1, 'gift'))] },
      { label: 'Spend it all, today', outcomes: [any('A glorious afternoon. By dinner it is gone.', 'neutral', cash(0), st('mood', 6), rel('gp', 3))] },
    ],
  },
];

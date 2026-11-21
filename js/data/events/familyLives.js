// Scenes that happen because of what someone else did with their own life.
// They are never drawn at random: engine/npcLives.js queues one when the
// moment arrives (a child turning 17, a wedding, a promotion in another city),
// with the people involved already cast. At most one of these fires a year.
//
// A choice can steer the other person's life by setting flags on them:
//   backed / heldBack           their ambition jumps forward or slips back
//   pushUniversity / pushWork   tilts what a child does at 18
//   studentDebt                 they graduate owing money
import { st, hid, cash, rel, ok, bad, any, chk, need, mem, npcSet, perf } from './helpers.js';

const scene = (id, category, text, choices) => ({ id, category, ageRange: [0, 130], queuedOnly: true, text, choices });

/** @type {import('../../types.js').GameEvent[]} */
export default [
  scene('kid_decides', 'their life',
    '{kid} is seventeen. Tonight, drying up after dinner, they ask what you think they should do when school ends.', [
      { label: 'Say you will back whatever they choose', outcomes: [any(
        '{kid} looks at you for a second, as if checking you mean it. You do.', 'good',
        rel('kid', 10), npcSet('kid', { flags: { backed: true } }), mem('kid', 'backedMyChoice', 'At seventeen, you told them you would back whatever they chose.'))] },
      { label: 'Tell them it has to be university', outcomes: [any('{kid} nods slowly. Whether it was what they wanted, you cannot tell.', 'neutral',
        rel('kid', -2), npcSet('kid', { flags: { pushUniversity: true } }), mem('kid', 'pushedUniversity', 'You told them it had to be university.'))] },
      { label: 'Tell them to get a job and start earning', outcomes: [any('{kid} says "right" and goes upstairs.', 'neutral',
        rel('kid', -3), npcSet('kid', { flags: { pushWork: true } }), mem('kid', 'pushedWork', 'You told them to skip university and start earning.'))] },
      { label: 'Say it is their life, and change the subject', outcomes: [any('{kid} was hoping for more than that.', 'neutral', rel('kid', -4))] },
    ]),

  scene('kid_tuition', 'their life',
    '{kid} got into college. The fees and rent over the course come to {$24000}, and they have not asked you for anything. They are waiting to see if you offer.', [
      { label: 'Pay all of it', requires: [need('cashBase', '>=', 24000)], outcomes: [any(
        '{kid} will graduate owing nobody anything. They do not have the words, so they hug you instead.', 'good',
        cash(-24000), rel('kid', 14), hid('karma', 4), mem('kid', 'paidTuition', 'You paid their way through university.'))] },
      { label: 'Pay half', requires: [need('cashBase', '>=', 12000)], outcomes: [any('It halves what they will owe. {kid} is grateful, and gets a weekend job for the rest.', 'good',
        cash(-12000), rel('kid', 7))] },
      { label: 'Tell them they will need a loan', outcomes: [any('{kid} says of course, they had assumed so. They start their working life in debt.', 'neutral',
        rel('kid', -3), npcSet('kid', { flags: { studentDebt: true } }))] },
    ]),

  scene('kid_in_a_hole', 'their life',
    '{kid} calls late at night. They are in trouble, and it takes a while before they can say how much: they need {$5000}, and they need it this week.', [
      { label: 'Send the money, no questions', requires: [need('cashBase', '>=', 5000)], outcomes: [any(
        'It is in their account within the hour. They pay you back in the only currency they have: they start ringing every Sunday.', 'good',
        cash(-5000), rel('kid', 12), mem('kid', 'bailedOut', 'When they were in real trouble, you sent the money without asking why.'))] },
      { label: 'Drive over and help them sort it out', check: chk(0.55, { 'stats.intellect': 0.4, 'stats.charm': 0.3 }), outcomes: [
        ok('Three days of phone calls and paperwork at their kitchen table. Between you, you find a way through that costs nothing but time.', rel('kid', 14), st('mood', 3),
          mem('kid', 'sortedItTogether', 'When they were in trouble, you came over and sorted it out together.')),
        bad('You try, and it is not enough. They borrow it from someone worse.', rel('kid', 4), st('mood', -5)),
      ] },
      { label: 'Tell them they have to fix it themselves', outcomes: [any('The line goes quiet. "Okay," says {kid}, and hangs up.', 'bad',
        rel('kid', -14), hid('willpower', 2), mem('kid', 'leftMeToIt', 'When they asked for help, you told them to fix it themselves.'))] },
    ]),

  scene('family_wedding', 'their life',
    '{who} is marrying {inlaw} on Saturday. There is a seat with your name on it at the top table.', [
      { label: 'Give them a generous start ({$2000})', requires: [need('cashBase', '>=', 2000)], outcomes: [any(
        'You press the envelope into {inlaw}\'s hand and say "welcome to the family". They both cry.', 'good',
        cash(-2000), rel('who', 10), rel('inlaw', 14), st('mood', 8), mem('inlaw', 'welcomed', 'On their wedding day, you welcomed them into the family.'))] },
      { label: 'Stand up and say a few words', check: chk(0.55, { 'stats.charm': 0.7 }), outcomes: [
        ok('You tell one story about {who}, aged six, and the whole room is yours.', rel('who', 10), rel('inlaw', 8), st('mood', 8)),
        bad('You tell the story about the school trip. {who} has spent ten years hoping you had forgotten it.', rel('who', -4), rel('inlaw', 3), st('mood', -2)),
      ] },
      { label: 'Go, and bring something small', outcomes: [any('A lovely day. You dance once, badly.', 'good', cash(-100), rel('who', 4), rel('inlaw', 4), st('mood', 5))] },
      { label: 'Miss it', outcomes: [any('Your chair stays empty in every photograph.', 'bad', rel('who', -18), rel('inlaw', -10),
        mem('who', 'missedWedding', 'You were not at their wedding.'))] },
    ]),

  scene('grandchild_born', 'their life',
    '{kid} has had a baby, {baby}, and has not slept properly in four days.', [
      { label: 'Go and stay for two weeks', outcomes: [any(
        'You cook, you wash, you walk the hallway at three in the morning with {baby} on your shoulder. {kid} sleeps.', 'good',
        rel('kid', 12), rel('baby', 12), st('mood', 9), st('health', -2), mem('kid', 'cameToHelp', 'When their baby was born, you came and stayed for two weeks.'))] },
      { label: 'Send a hamper ({$200})', requires: [need('cashBase', '>=', 200)], outcomes: [any('{kid} sends a photo of {baby} asleep next to the cookies.', 'good', cash(-200), rel('kid', 4), st('mood', 4))] },
      { label: 'Ring to say congratulations', outcomes: [any('{kid} can barely keep their eyes open on the call.', 'neutral', rel('kid', -1), st('mood', 3))] },
    ]),

  scene('spouse_job_away', 'their life',
    '{love} has been offered the job they have worked toward for years. It is in another city. They put the letter on the table between you and say nothing.', [
      { label: 'Go with them', outcomes: [any(
        'You pack up your life and move to {city}. It costs you ground at work, and {love} knows exactly what you gave up.', 'good',
        { type: 'moveCity' }, perf(-10), rel('love', 14), npcSet('love', { flags: { backed: true } }),
        mem('love', 'movedForMe', 'You moved cities so they could take the job they had worked for.'))] },
      { label: 'Ask them to turn it down', outcomes: [any('{love} folds the letter in half, and then in half again. They stay. Some evenings you can see them thinking about it.', 'bad',
        rel('love', -12), npcSet('love', { flags: { heldBack: true } }), mem('love', 'gaveItUp', 'They turned down the job they wanted because you asked them to stay.'))] },
      { label: 'Suggest living apart in the week', check: chk(0.5, { 'cast.love.relationship': 0.8 }), outcomes: [
        ok('Four nights apart, three together. It is not easy, and it works.', rel('love', 3), npcSet('love', { flags: { backed: true } })),
        bad('The weekends get shorter. By the spring you are strangers who share a mortgage.', rel('love', -18), npcSet('love', { flags: { backed: true } })),
      ] },
    ]),

  scene('spouse_dream', 'their life',
    '{love} has talked around it for years, and tonight says it plainly: there is something they want to do with their life before it is too late. It would take {$6000} of savings, and most of their evenings for a long while.', [
      { label: 'Back them, money and all', requires: [need('cashBase', '>=', 6000)], outcomes: [any(
        '"Then do it," you say. {love} looks ten years younger.', 'good',
        cash(-6000), rel('love', 13), npcSet('love', { flags: { backed: true } }), mem('love', 'backedMyDream', 'When they told you what they wanted from life, you backed it with everything.'))] },
      { label: 'Say yes, but the savings stay put', outcomes: [any('{love} will do it the slow way, and is glad you did not say no.', 'good', rel('love', 5))] },
      { label: 'Ask them to wait until things are easier', outcomes: [any('{love} nods. "There is never an easier time," they say, mostly to themselves.', 'bad',
        rel('love', -10), npcSet('love', { flags: { heldBack: true } }), mem('love', 'askedToWait', 'When they told you what they wanted from life, you asked them to wait.'))] },
    ]),
];

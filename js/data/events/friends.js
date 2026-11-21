// Friends have their own plans, their own fallings-out, and long memories.
// What you do here is stored on the friend with mem() and can be read back by
// later scenes (see stories/musical.js for how memories change outcomes).
import { st, hid, cash, rel, ok, bad, any, chk, need, addNpc, mem, tagNpc, feud, endFeud, when } from './helpers.js';

/** @type {import('../../types.js').GameEvent[]} */
export default [
  {
    id: 'friend_new_group', category: 'friends', ageRange: [13, 18], cast: { pal: 'friend' }, weight: 2,
    text: '{pal} has started sitting with a different crowd at lunch, and has had less and less time for you.',
    choices: [
      { label: 'Ask if you can come along', check: chk(0.5, { 'stats.charm': 0.6, 'cast.pal.relationship': 0.3 }), outcomes: [
        ok('{pal} looks relieved you asked. By the end of the week {newpal}, one of the new lot, is saving you a seat too.', rel('pal', 6), addNpc('friend', 'newpal'), st('mood', 5)),
        bad('You sit at the end of the table and laugh half a second late all lunch.', rel('pal', -3), st('mood', -4)),
      ] },
      { label: 'Give them room', outcomes: [any(
        'You let it be. It stings, but {pal} still finds you at the bus stop most days.', 'neutral',
        rel('pal', -3), hid('willpower', 2), mem('pal', 'gaveSpace', 'You let them go their own way without making a scene.'))] },
      { label: 'Tell them they are ditching you', outcomes: [any(
        '{pal} says that is not fair. You both know it is a little bit fair.', 'bad',
        rel('pal', -12), st('mood', -3), mem('pal', 'guiltTrip', 'You accused them of ditching you when they made new friends.'))] },
    ],
  },
  {
    id: 'friends_fall_out', category: 'friends', ageRange: [13, 24], cast: { a: 'friend', b: 'friend' }, weight: 2, cooldown: 6,
    text: '{a} and {b} have fallen out badly and are not speaking. Each of them is having people round on Saturday night. Each of them has invited you.',
    choices: [
      { label: 'Go to {a}\'s', outcomes: [any(
        '{a} keeps topping up your drink and telling people you are a real friend. {b} sees the photos.', 'neutral',
        rel('a', 9), rel('b', -11), feud('a', 'b'),
        mem('a', 'tookMySide', 'When they fell out with a friend, you came to their party.'),
        mem('b', 'tookOtherSide', 'When they fell out with a friend, you went to the other party.'))] },
      { label: 'Go to {b}\'s', outcomes: [any(
        '{b} hugs you at the door like you have crossed a border. {a} sees the photos.', 'neutral',
        rel('b', 9), rel('a', -11), feud('a', 'b'),
        mem('b', 'tookMySide', 'When they fell out with a friend, you came to their party.'),
        mem('a', 'tookOtherSide', 'When they fell out with a friend, you went to the other party.'))] },
      { label: 'Do an hour at each', check: chk(0.45, { 'stats.charm': 0.7 }), outcomes: [
        ok('You pull it off. Each of them thinks you were mostly at theirs.', rel('a', 3), rel('b', 3), feud('a', 'b')),
        bad('Each of them notices exactly when you left, and where you went.', rel('a', -6), rel('b', -6), feud('a', 'b'), st('mood', -3)),
      ] },
      { label: 'Get them in a room and make them talk',
        check: chk(0.35, { 'stats.charm': 0.5, 'cast.a.relationship': 0.3, 'cast.b.relationship': 0.3 }), outcomes: [
          ok('Forty awkward minutes in your kitchen. Then {a} laughs at something {b} says, and it is over. There is one party on Saturday.',
            rel('a', 8), rel('b', 8), endFeud('a', 'b'), hid('karma', 5), st('mood', 6),
            mem('a', 'peacemaker', 'You got them and a friend talking again after a bad falling-out.'),
            mem('b', 'peacemaker', 'You got them and a friend talking again after a bad falling-out.')),
          bad('It goes badly enough that they briefly unite in being annoyed at you.', rel('a', -5), rel('b', -5), feud('a', 'b'), st('mood', -4)),
        ] },
    ],
  },
  {
    id: 'stairwell', category: 'first year', ageRange: [14, 15], once: true, weight: 4,
    requires: [need('education.stage', '==', 'high'), need('education.enrolled', '==', true)], cast: { mate: 'classmate' },
    text: 'First month of high school. Three older students have {mate}\'s bag and are emptying it down the stairwell, one book at a time.',
    choices: [
      { label: 'Step in', check: chk(0.5, { 'hidden.willpower': 0.4, 'talents.sports': 0.3, 'stats.charm': 0.2 }), outcomes: [
        ok('You walk up, take the bag, and hand it back. Nobody stops you. {mate} does not forget it.', rel('mate', 22), hid('karma', 6), st('mood', 5),
          tagNpc('mate', 'defended'), mem('mate', 'defended', 'You stood up for them in their first month of high school.')),
        bad('Now there are two bags going down the stairs. You and {mate} pick up books together for twenty minutes.', rel('mate', 18), hid('karma', 6), st('health', -2),
          tagNpc('mate', 'defended'), mem('mate', 'defended', 'You stood up for them in their first month of high school, and paid for it.')),
      ] },
      { label: 'Fetch a teacher', outcomes: [any('A teacher clears the stairwell. {mate} nods at you afterward.', 'good', rel('mate', 7), hid('karma', 2),
        mem('mate', 'fetchedHelp', 'You fetched a teacher when they were being picked on.'))] },
      { label: 'Keep walking', outcomes: [any('You take the other stairs. {mate} saw you see.', 'neutral', rel('mate', -8), hid('karma', -4),
        mem('mate', 'walkedPast', 'You walked past when they needed someone.'))] },
    ],
  },
  {
    id: 'senior_rumor', category: 'senior year', ageRange: [17, 17], once: true, priority: true,
    requires: [need('education.stage', '==', 'high')], cast: { mate: 'tag:defended' },
    text: 'An ugly rumor about you is going round the senior year. Before you have decided what to do, {mate} stands up in the common room: "I know who started that, and it is a lie. {name} was the only person who helped me in my first month here."',
    choices: [
      { label: 'Thank {mate}', outcomes: [any('The room goes quiet, and then it moves on. The rumor is dead by Friday.', 'good', rel('mate', 10), st('mood', 8), st('charm', 3))] },
      { label: 'Find out who started it', check: chk(0.5, { 'stats.intellect': 0.5, 'stats.charm': 0.3 }), outcomes: [
        ok('{mate} tells you who. You have one short, calm conversation, and get an apology in front of witnesses.', rel('mate', 8), st('charm', 4), hid('willpower', 3)),
        bad('You accuse the wrong person, loudly. {mate} winces.', rel('mate', 3), st('charm', -3), st('mood', -4)),
      ] },
      { label: 'Say you can fight your own battles', outcomes: [any('{mate} sits down slowly. You have embarrassed the one person who stood up.', 'bad', rel('mate', -10), hid('karma', -3))] },
    ],
  },
  {
    id: 'big_night', category: 'commitments collide', ageRange: [15, 19], weight: 3, cooldown: 3,
    requires: [need('career.partTime', '!=', false)], cast: { pal: 'friend', manager: 'tag:manager' },
    text: '{pal}\'s first proper gig is on Friday and they have saved you a spot at the front. At four o\'clock {manager} calls: someone has dropped out, and they need you on Friday night.',
    choices: [
      { label: 'Go to the gig', outcomes: [any(
        'You are at the front, shouting the words. {pal} finds your face in the crowd during the last song. {manager} covers the shift alone.', 'good',
        rel('pal', 12), rel('manager', -6), st('mood', 7),
        mem('pal', 'cameToGig', 'You turned down a shift to be at the front for their first gig.'))] },
      { label: 'Take the shift', outcomes: [any(
        'You earn {$250} and {manager}\'s gratitude. {pal} plays to a gap where you were meant to be.', 'neutral',
        cash(250), rel('manager', 10), rel('pal', -12),
        mem('manager', 'coveredShift', 'You covered a Friday night at no notice when someone dropped out.'),
        mem('pal', 'missedGig', 'You worked a shift instead of coming to their first gig.'))] },
      { label: 'Work the shift, then run',
        check: chk(0.4, { 'talents.sports': 0.3, 'stats.health': 0.3, 'cast.manager.relationship': 0.4 }), outcomes: [
          when([need('memory.manager.coveredShift', '>=', 1)], ok(
            '{manager} looks at the clock at half nine and says, "You have bailed me out before. Go." You arrive for the last two songs, still in your apron.',
            cash(150), rel('pal', 8), rel('manager', 3), mem('pal', 'ranToGig', 'You ran from work to catch the end of their first gig.'))),
          ok('You sprint the whole way and arrive, wrecked, for the last song. {pal} dedicates it to "whoever that is in the apron".',
            cash(250), rel('pal', 6), rel('manager', 6), st('health', -1),
            mem('pal', 'ranToGig', 'You ran from work to catch the end of their first gig.'),
            mem('manager', 'coveredShift', 'You covered a Friday night at no notice when someone dropped out.')),
          bad('The shift overruns. You get there as they are coiling cables.', cash(250), rel('pal', -7), rel('manager', 6),
            mem('pal', 'missedGig', 'You missed their first gig because of work.'),
            mem('manager', 'coveredShift', 'You covered a Friday night at no notice when someone dropped out.')),
        ] },
    ],
  },
  {
    id: 'friend_moving_on', category: 'friends', ageRange: [17, 25], cast: { pal: 'friend' }, weight: 2, cooldown: 8,
    text: '{pal} has been offered a place on a course four hundred miles away, and asks you, straight out, whether they should go.',
    choices: [
      { label: 'Tell them to go', outcomes: [any(
        '{pal} goes. The messages thin out, but never stop, and every one of them starts with "you were right".', 'good',
        rel('pal', 6), hid('karma', 4), mem('pal', 'toldMeToGo', 'You told them to take the place far away, even though you would miss them.'))] },
      { label: 'Ask them to stay', check: chk(0.3, { 'cast.pal.relationship': 0.8 }), outcomes: [
        ok('{pal} stays. You are glad. You are not sure, some days, that they are.', rel('pal', 2), hid('karma', -4),
          mem('pal', 'stayedForYou', 'They turned down a place far away because you asked them to stay.')),
        bad('{pal} goes anyway, and you have made the goodbye harder than it needed to be.', rel('pal', -9), st('mood', -4)),
      ] },
      { label: 'Say it has to be their call', outcomes: [any('{pal} nods. It was not really the answer they were after.', 'neutral', rel('pal', 1))] },
    ],
  },
];

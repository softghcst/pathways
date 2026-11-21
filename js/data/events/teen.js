import { st, hid, tal, cash, rel, flag, gpa, heat, followers, count, addNpc, ok, bad, any, chk, need } from './helpers.js';

const inSchool = need('education.enrolled', '==', true);

/** @type {import('../../types.js').GameEvent[]} */
export default [
  {
    id: 'first_crush', category: 'teen', ageRange: [12, 16], requires: [inSchool],
    text: 'You cannot stop looking at someone two rows over in math. Today they looked back.',
    choices: [
      { label: 'Ask them out', check: chk(0.45, { 'stats.charm': 0.8 }), outcomes: [
        ok('They say yes. You go for chips after school and talk for three hours.', st('mood', 10), st('charm', 2), flag('hadFirstDate')),
        bad('They say "um, no thanks" loudly enough for the whole corridor.', st('mood', -9)),
      ] },
      { label: 'Write an anonymous note', outcomes: [any('You watch them read it and smile. They never find out it was you.', 'neutral', st('mood', 3))] },
      { label: 'Say nothing', outcomes: [any('The term ends. The seating plan changes. That was that.', 'neutral', st('mood', -2), hid('willpower', -1))] },
    ],
  },
  {
    id: 'exam_answers', category: 'teen', ageRange: [13, 17], requires: [inSchool],
    text: 'Someone is passing around a photo of tomorrow\'s exam answers.',
    choices: [
      { label: 'Use them', check: chk(0.6, { 'talents.crime': 0.4, 'stats.intellect': 0.2 }), outcomes: [
        ok('Top marks. Nobody suspects a thing.', gpa(0.3), hid('karma', -6), hid('discipline', -3)),
        bad('Seven students give identical wrong answers to question 4. You all get zero.', gpa(-0.4), hid('karma', -5), st('mood', -8)),
      ] },
      { label: 'Ignore them and revise', check: chk(0.55, { 'stats.intellect': 0.7, 'hidden.discipline': 0.4 }), outcomes: [
        ok('You earn a solid grade the slow way.', gpa(0.2), st('intellect', 3), hid('discipline', 3)),
        bad('You do badly while the cheats sail through. It stings.', gpa(-0.1), st('mood', -5), hid('karma', 2)),
      ] },
      { label: 'Tell the teacher', outcomes: [any('The exam is rewritten overnight. Somebody works out it was you.', 'neutral', hid('karma', 5), st('charm', -3), st('mood', -3))] },
    ],
  },
  {
    id: 'forbidden_party', category: 'teen', ageRange: [14, 17], cast: { mother: 'mother' },
    text: 'The party of the year is tonight. {mother} has said absolutely not.',
    choices: [
      { label: 'Sneak out the window', check: chk(0.5, { 'talents.crime': 0.5, 'stats.intellect': 0.2 }), outcomes: [
        ok('You are back in bed by 2 a.m. with stories for months.', st('mood', 9), st('charm', 2), hid('discipline', -2)),
        bad('{mother} is sitting on your bed when you climb back in. Grounded for a month.', st('mood', -8), rel('mother', -10)),
      ] },
      { label: 'Negotiate', check: chk(0.4, { 'stats.intellect': 0.5, 'stats.charm': 0.4 }), outcomes: [
        ok('Home by eleven, phone on, no arguments. Deal.', st('mood', 6), rel('mother', 3)),
        bad('"The answer was no before the presentation and it is no after it."', st('mood', -4)),
      ] },
      { label: 'Stay home', outcomes: [any('You watch the photos appear online one by one.', 'neutral', st('mood', -4), rel('mother', 4), hid('discipline', 3)), any('On Monday you hear every detail, twice.', 'neutral', st('mood', -4), rel('mother', 4), hid('discipline', 3))] },
    ],
  },
  {
    id: 'corridor_bully', category: 'teen', ageRange: [12, 16], requires: [inSchool],
    text: 'Three older students have a younger kid backed against the lockers.',
    choices: [
      { label: 'Step in', check: chk(0.4, { 'talents.sports': 0.5, 'stats.charm': 0.3, 'hidden.willpower': 0.3 }), outcomes: [
        ok('You stand next to the kid and do not move. The three of them lose interest.', hid('karma', 10), st('mood', 6), st('charm', 3)),
        bad('Now there are two people against the lockers. You go home with a split lip.', hid('karma', 8), st('health', -6), st('mood', -4)),
      ] },
      { label: 'Fetch a teacher', outcomes: [any('A teacher breaks it up. The kid nods at you on the way past.', 'good', hid('karma', 5))] },
      { label: 'Film it', outcomes: [any('The video gets passed around. You do not feel good about it.', 'bad', hid('karma', -8), followers(40))] },
      { label: 'Keep walking', outcomes: [any('You look at the floor until you are around the corner.', 'neutral', hid('karma', -3), st('mood', -2))] },
    ],
  },
  {
    id: 'summer_work', timing: { seasons: ['spring', 'summer', 'hot', 'dry'] }, category: 'teen', ageRange: [14, 17], cooldown: 2,
    text: 'A neighbor offers to pay you to clear and paint their fence over summer vacation.',
    choices: [
      { label: 'Take it and do it properly', outcomes: [any('Six blistered weeks later you are handed {$400}.', 'good', cash(400), hid('discipline', 5), st('health', 2))] },
      { label: 'Take it and rush it', check: chk(0.5, { 'stats.charm': 0.4 }), outcomes: [
        ok('It looks fine from the road. You are paid in full.', cash(400), hid('discipline', -3)),
        bad('The paint peels within a week. You get {$150} and a talking-to.', cash(150), st('mood', -3)),
      ] },
      { label: 'Decline', outcomes: [any('You have the laziest, best summer of your life.', 'neutral', st('mood', 6))] },
    ],
  },
  {
    id: 'driving_lesson', category: 'teen', ageRange: [16, 17], once: true, weight: 2, cast: { father: 'father' },
    text: '{father} takes you to an empty parking lot and hands you the keys.',
    choices: [
      { label: 'Take it slow', outcomes: [any('You stall eleven times, then drive a full lap. {father} claps.', 'good', rel('father', 6), st('mood', 5), flag('canDrive'))] },
      { label: 'Show off', check: chk(0.35, { 'stats.intellect': 0.3, 'talents.sports': 0.3 }), outcomes: [
        ok('A clean handbrake turn. {father} is furious and a tiny bit impressed.', st('mood', 6), hid('crazy', 3), flag('canDrive')),
        bad('You clip a trolley shelter. You will be paying {$300} toward the bumper.', cash(-300), rel('father', -8), st('mood', -6)),
      ] },
      { label: 'Say you would rather not', outcomes: [any('You take the bus. It suits you fine.', 'neutral', rel('father', -2))] },
    ],
  },
  {
    id: 'friend_secret', category: 'teen', ageRange: [12, 17], cast: { pal: 'friend' },
    text: '{pal} tells you a secret and makes you swear to keep it.',
    choices: [
      { label: 'Keep it', outcomes: [any('You never tell a soul. {pal} trusts you with everything after that.', 'good', rel('pal', 10), hid('karma', 4))] },
      { label: 'Tell one person', check: chk(0.3, {}), outcomes: [
        ok('It stays contained, somehow.', hid('karma', -4)),
        bad('By Friday everyone knows, and {pal} knows who started it.', rel('pal', -30), hid('karma', -6), st('mood', -5)),
      ] },
      { label: 'Hold it over them', outcomes: [any('{pal} does your homework for a month and hates you for it.', 'bad', rel('pal', -20), hid('karma', -10), gpa(0.1))] },
    ],
  },
  {
    id: 'school_show', category: 'teen', ageRange: [12, 17], requires: [inSchool], cooldown: 4,
    text: 'Auditions for the school show are on Friday.',
    choices: [
      { label: 'Go for the lead', check: chk(0.35, { 'talents.acting': 0.9, 'stats.charm': 0.2 }), outcomes: [
        ok('You get the part and a standing ovation on closing night.', tal('acting', 8), st('charm', 4), st('mood', 9)),
        bad('You forget the second verse mid-audition. You are cast as "Villager".', tal('acting', 2), st('mood', -4)),
      ] },
      { label: 'Join the band in the pit', check: chk(0.45, { 'talents.music': 0.9 }), outcomes: [
        ok('You nail every cue. The music teacher asks you to stay on.', tal('music', 8), st('mood', 6)),
        bad('You come in a bar early on opening night. Everyone hears.', tal('music', 2), st('mood', -4)),
      ] },
      { label: 'Work backstage', outcomes: [any('You run the lights and learn where everything is kept.', 'good', hid('discipline', 3), st('mood', 3))] },
      { label: 'Skip it', outcomes: [any('You go home at the normal time.', 'neutral')] },
    ],
  },
  {
    id: 'sibling_video', category: 'teen', ageRange: [12, 17], cast: { sib: 'sibling' },
    text: 'You have caught {sib} on video singing into a hairbrush with full choreography.',
    choices: [
      { label: 'Post it', check: chk(0.3, { 'stats.charm': 0.3 }), outcomes: [
        ok('It gets shared thousands of times. {sib} will not speak to you.', followers(2500), rel('sib', -25), hid('karma', -6)),
        bad('It gets nine views. {sib} still finds out.', followers(5), rel('sib', -15), hid('karma', -5)),
      ] },
      { label: 'Show them and delete it', outcomes: [any('{sib} goes red, then laughs, then makes you swear.', 'good', rel('sib', 8), hid('karma', 4))] },
      { label: 'Keep it for later', outcomes: [any('It sits in a folder, waiting for the right wedding.', 'neutral', hid('crazy', 2), flag('hasSiblingVideo'))] },
    ],
  },
  {
    id: 'extra_change', category: 'teen', ageRange: [13, 17],
    text: 'The cashier gives you change for a much bigger note. You are {$20} up.',
    choices: [
      { label: 'Point it out', outcomes: [any('The cashier mouths "thank you". Their till would have been short.', 'good', hid('karma', 6), st('mood', 2))] },
      { label: 'Keep it', outcomes: [any('You walk out a little faster than usual.', 'neutral', cash(20), hid('karma', -5))] },
    ],
  },
  {
    id: 'team_trials', category: 'teen', ageRange: [12, 17], requires: [inSchool], cooldown: 3,
    text: 'Trials for the school team are this week.',
    choices: [
      { label: 'Train hard and try out', check: chk(0.4, { 'talents.sports': 0.9, 'stats.health': 0.3 }), outcomes: [
        ok('You make the squad. The kit is slightly too big and you love it.', tal('sports', 8), st('health', 5), st('mood', 7), st('charm', 2)),
        bad('You are cut in the last round. The coach says to come back next year.', tal('sports', 3), st('health', 2), st('mood', -5)),
      ] },
      { label: 'Turn up with no preparation', check: chk(0.2, { 'talents.sports': 0.9 }), outcomes: [
        ok('Raw talent carries you through.', tal('sports', 5), st('mood', 7)),
        bad('You are sick behind the goal after the warm-up laps.', st('mood', -5), st('health', -1)),
      ] },
      { label: 'Give it a miss', outcomes: [any('You watch from the stands with a bag of chips.', 'neutral', st('mood', 1))] },
    ],
  },
  {
    id: 'curfew_row', category: 'teen', ageRange: [13, 17], cast: { mother: 'mother' },
    text: 'You come home forty minutes late. {mother} is waiting in the kitchen.',
    choices: [
      { label: 'Apologize', outcomes: [any('She is still annoyed, but it blows over by breakfast.', 'good', rel('mother', 3), hid('karma', 2))] },
      { label: 'Argue', outcomes: [any('Doors are slammed. Words are said. The house is quiet for days.', 'bad', rel('mother', -10), st('mood', -5), hid('willpower', 2))] },
      { label: 'Invent an excuse', check: chk(0.45, { 'talents.acting': 0.6, 'stats.intellect': 0.3 }), outcomes: [
        ok('A flat tire, a dead phone, a helpful stranger. She buys it.', tal('acting', 3), hid('karma', -3)),
        bad('The story has three holes in it and she finds all of them.', rel('mother', -8), st('mood', -4), hid('karma', -3)),
      ] },
    ],
  },
  {
    id: 'part_time_offer', category: 'teen', ageRange: [15, 17], once: true,
    text: 'The café near school has a "weekend help wanted" sign in the window.',
    choices: [
      { label: 'Apply', check: chk(0.6, { 'stats.charm': 0.5, 'hidden.discipline': 0.3 }), outcomes: [
        ok('You get the job. A year of Saturdays earns you {$1800}.', cash(1800), hid('discipline', 6), st('charm', 2), count('jobsHeld')),
        bad('They hire someone with experience. You are fifteen; you have none.', st('mood', -3)),
      ] },
      { label: 'Keep your weekends', outcomes: [any('You walk past. Saturdays are for sleeping.', 'neutral', st('mood', 2))] },
    ],
  },
];

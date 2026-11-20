// Growing up, from birth (engine/childhood.js). Each thing to do is for an age: a baby is taken to things by a parent,
// a toddler is taken and joins in, a schoolchild goes with friends. `grows` is what it nudges, a little: a stat, a
// talent, or an early liking (music, movement, water, books, people) that later comes to a small head start and no
// more. `friend` is the chance of meeting another child there. Costs are paid at home.
const A = (id, name, ages, o = {}) => ({ id, name, ages, ...o });
export const CHILD_ACTIVITIES = [
  // 0–1: all of it in somebody's arms.
  A('bond', 'Be held and talked to', [0, 1], { parent: true, grows: { bond: 3 }, text: '{parent} carries you about the house, telling you what everything is.' }),
  A('toys', 'Explore your toys', [0, 2], { grows: { 'stats.intellect': 0.4 }, text: 'A rattle, a wooden spoon and a box. The box is best.' }),
  A('lullaby', 'Listen to music', [0, 2], { parent: true, grows: { early: 'music' }, text: '{parent} sings to you. You go quiet and listen.' }),
  A('siblings', 'Play with your brothers and sisters', [0, 5], { sibling: true, grows: { siblings: 3 }, text: '{sibling} makes faces at you until you laugh.' }),
  A('babygroup', 'Go to a parent-and-baby group', [0, 1], { parent: true, grows: { early: 'people' }, text: '{parent} takes you to a room full of babies and tired adults.' }),
  A('tummy', 'Kick and roll on the rug', [0, 1], { parent: true, grows: { early: 'movement' }, text: 'On the rug, with {parent} beside you, you find out what your legs are for.' }),
  // 2–5
  A('playground', 'Go to the playground', [2, 12], { parentUnder: 6, friend: 0.35, grows: { 'stats.health': 0.4 }, text: 'The slide, the swings, the sandpit.' }),
  A('playdate', 'Have a playdate', [2, 9], { parentUnder: 6, needsFriend: true, grows: { friend: 5 }, text: 'An afternoon at {friend}\'s house.' }),
  A('story', 'Story time', [2, 7], { parentUnder: 6, grows: { early: 'books', 'stats.intellect': 0.3 }, text: 'The same book, again, because you asked.' }),
  A('musicclass', 'Go to a music class', [2, 6], { parent: true, grows: { early: 'music' }, text: 'Shakers, a drum, and a song about a bus.' }),
  A('dance', 'Beginner dance', [3, 7], { parent: true, grows: { early: 'movement', 'talents.dance': 0.3 }, text: 'Everyone is a tree, then everyone is a frog.' }),
  A('tumbling', 'Tumbling', [3, 7], { parent: true, grows: { early: 'movement', 'stats.health': 0.3 }, text: 'Forward rolls on a blue mat, more or less in a line.' }),
  A('art', 'Paint and draw', [2, 9], { grows: { 'stats.mood': 2 }, text: 'A picture of the family. Everybody is the same size as the house.' }),
  A('swim', 'Swimming lessons', [3, 9], { parent: true, grows: { early: 'water', 'stats.health': 0.4 }, text: 'Armbands, and blowing bubbles with your face in the water.' }),
  A('outing', 'A family day out', [1, 12], { parent: true, grows: { bond: 2, 'stats.mood': 3 }, text: 'A day out with the family.' }),
  // 6–12
  A('sleepover', 'Have a sleepover', [7, 13], { needsFriend: true, grows: { friend: 7, 'stats.mood': 2 }, text: 'A sleepover with {friend}. Nobody sleeps.' }),
  A('club', 'Join an after-school club', [6, 13], { friend: 0.25, grows: { 'stats.charm': 0.5 }, text: 'A club after school: you are given a job, and do it.' }),
  A('hobby', 'Keep up a hobby', [6, 15], { grows: { 'stats.intellect': 0.3, 'hidden.discipline': 0.4 }, text: 'An hour a day on the thing you are making.' }),
  A('fair', 'Take part in a school event', [6, 14], { friend: 0.15, grows: { 'stats.charm': 0.4 }, text: 'The school fair. You run a stall.' }),
  // Lessons, for a child who wants to be on stage: real training, so they count for more than a small child's classes
  // (up to LESSON_CAP on each talent, not EARLY_CAP). A parent takes a younger child.
  A('singing', 'Singing lessons', [6, 12], { parentUnder: 9, lesson: true, grows: { 'talents.singing': 2 }, text: 'Scales at an upright piano, and a song you have to learn by next week.' }),
  A('acting', 'Acting class', [6, 12], { parentUnder: 9, lesson: true, friend: 0.2, grows: { 'talents.acting': 2 }, text: 'Pretending to be a tiger, then a tiger who has lost something.' }),
  A('stagedance', 'Dance for the stage', [6, 12], { parentUnder: 9, lesson: true, grows: { 'talents.dance': 2 }, text: 'Tap shoes, a mirror the length of the room, and counts of eight.' }),
  A('youththeater', 'Youth theater', [7, 13], { lesson: true, friend: 0.3, grows: { 'talents.singing': 1, 'talents.dance': 1, 'talents.acting': 1, 'stats.charm': 0.3 },
    text: 'Saturday mornings in a church hall, putting on a show for the parents at the end of term.' }),
];
/** What a child may do in a year: not everything, every year. */
export const CHILD_ACTS_A_YEAR = 4;
/** The most that early likings and talents can add up to: a head start, never mastery. */
export const EARLY_CAP = 6;
/** The most that lessons (singing, acting, dance for the stage, youth theater) can add to each talent: proper training, still not mastery. */
export const LESSON_CAP = 16;

// Pocket money. Base units a year at each age (made local, and of its time, by the game's money): a little, growing.
export const ALLOWANCE = { from: 5, until: 17, yearly: (age) => Math.round(age * 22) };
export const CHORE_PAY = 0.25; // of a year's allowance, for a year of chores done properly

// Small paid jobs before a real one (engine/partTime.js has those): by the hour, for neighbors. `law` jobs wait for the
// age the country lets children work at all; the others are the kind of thing no law has ever minded.
export const SMALL_JOBS = [
  { id: 'petsit', name: 'Feed a neighbor\'s cat while they are away', minAge: 9, pay: 60 },
  { id: 'yard', name: 'Rake leaves and cut grass', minAge: 10, pay: 110 },
  { id: 'familyhelp', name: 'Help out at a relative\'s shop on Saturdays', minAge: 10, pay: 140 },
  { id: 'babysit', name: 'Babysit for families nearby', minAge: 13, pay: 260, law: true },
  { id: 'tutor', name: 'Tutor younger children', minAge: 14, pay: 320, law: true, needs: 60 },
];
export const SMALL_JOBS_A_YEAR = 2;

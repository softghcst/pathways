// Scenes for the turns between years, when a turn is six or three months (engine/turns.js). They are drawn only on those
// turns, and only when what they describe is true: the season where the player lives (seasons run the other way round
// in the southern hemisphere, so no scene names a month or a holiday), the turn length, and the player's life.
//
//   between.steps    the turn lengths it belongs to: [6], [3] or [6, 3]
//   between.seasons  where in the year it can happen, if anywhere in particular
//   between.when     (player, state) => boolean: what has to be true
import { st, hid, rel, any, cash, gpa } from './helpers.js';
import { SNOWY, DARK_WINTERS, schoolStart, examMonths, turnCovers } from '../../engine/calendar.js';

const scene = (id, ageRange, between, text, choices, o = {}) => ({ id, category: 'seasons', ageRange, between, cooldown: o.cooldown ?? 3, weight: o.weight ?? 1, cast: o.cast, text, choices });
const both = [6, 3];
const atSchool = (p) => p.education.enrolled && ['elementary', 'middle', 'high'].includes(p.education.stage);
const atUni = (p) => p.education.enrolled && ['university', 'graduate', 'community'].includes(p.education.stage);
const working = (p) => !!p.career?.careerId;
const retired = (p) => !!p.career?.retired && !p.career?.careerId;
const kids = (s, a, b) => s.player.npcIds.map((id) => s.npcs[id]).filter((n) => n?.alive && n.role === 'child' && n.age >= a && n.age <= b);
/** Whether the turn just played took in one of these months of the year (0 = January). */
const covers = (s, months) => { const step = [6, 3].includes(s.settings?.step) ? s.settings.step : 12; const end = s.month || 12; return months.some((m) => turnCovers(end, step, m)); };
const schoolStarts = (p, s) => covers(s, [schoolStart(p.countryId)]);
const examTime = (p, s) => covers(s, examMonths(p.countryId));
const playsTeamSport = (p, s) => Object.values(s.sports?.athletes?.[p.id]?.sports ?? {}).some((e) => e.status === 'active' && e.teamId);

export default [
  // ---------- Any time of year, any length ----------
  scene('between_rainy_day', [4, 110], { steps: both }, 'A gray, wet stretch of weeks. Everyone indoors, everyone a little short-tempered.', [
    { label: 'Find something new to do inside', outcomes: [any('You end up with a half-finished puzzle and a strangely good mood.', 'good', st('mood', 4))] },
    { label: 'Go out in it anyway', outcomes: [any('You come back soaked and laughing.', 'good', st('mood', 3), st('health', 1))] },
    { label: 'Wait it out', outcomes: [any('It passes, as weather does.', 'neutral')] },
  ]),
  scene('between_friend_catchup', [12, 100], { steps: both }, '{friend} sends a message out of the blue: it has been too long. Coffee?', [
    { label: 'Make time for it', outcomes: [any('Two hours go by like ten minutes.', 'good', rel('friend', 6), st('mood', 4))] },
    { label: 'Say you are swamped, next time', outcomes: [any('{friend} says no problem. It sounds like it is a bit of a problem.', 'neutral', rel('friend', -3))] },
  ], { cast: { friend: 'friend' }, cooldown: 2 }),
  scene('between_call_home', [18, 90], { steps: both }, '{parent} calls. Nothing in particular, they say. Just to hear your voice.', [
    { label: 'Stay on the phone for an hour', outcomes: [any('You hear about the neighbors, the garden and a cousin\'s wedding. It is lovely.', 'good', rel('parent', 6), st('mood', 3))] },
    { label: 'Keep it short', outcomes: [any('A quick catch-up. They sound pleased you picked up.', 'neutral', rel('parent', 1))] },
  ], { cast: { parent: 'parent' }, cooldown: 2 }),
  scene('between_partner_evening', [18, 100], { steps: both }, '{partner} has cleared an evening, just for the two of you.', [
    { label: 'Cook together and talk', outcomes: [any('The food is average. The evening is not.', 'good', rel('partner', 6), st('mood', 4))] },
    { label: 'Go out somewhere new', outcomes: [any('A little place neither of you had tried. You will go back.', 'good', rel('partner', 5), cash(-80))] },
    { label: 'Ask to move it, you are tired', outcomes: [any('{partner} understands. Mostly.', 'neutral', rel('partner', -3))] },
  ], { cast: { partner: 'spouse' }, cooldown: 2 }),
  scene('between_small_win', [10, 100], { steps: [3] }, 'Nothing big happened these three months, and that turned out to be its own kind of good.', [
    { label: 'Notice it, and be glad', outcomes: [any('A quiet season. You will remember it fondly without remembering why.', 'good', st('mood', 3))] },
    { label: 'Get restless', outcomes: [any('You start making plans. Big ones.', 'neutral', hid('discipline', 1))] },
  ], { cooldown: 4 }),
  scene('between_midyear_look', [16, 100], { steps: [6] }, 'Halfway through the year. A good moment to look at how it is going.', [
    { label: 'Make a plan for the second half', outcomes: [any('You write it down. Some of it might even happen.', 'good', hid('discipline', 2))] },
    { label: 'It is going fine, carry on', outcomes: [any('You carry on.', 'neutral')] },
  ], { cooldown: 3 }),

  // ---------- The seasons ----------
  scene('between_summer_heat', [3, 110], { steps: both, seasons: ['summer', 'hot'] }, 'A heatwave settles in. The air is thick, and nobody sleeps properly.', [
    { label: 'Head for water: a pool, the sea, a sprinkler', outcomes: [any('The best afternoon of the summer.', 'good', st('mood', 5))] },
    { label: 'Stay in the shade and drink plenty', outcomes: [any('Sensible. Boring. Healthy.', 'neutral', st('health', 1))] },
  ]),
  scene('between_summer_holiday_kid', [6, 13], { steps: both, when: (p, s) => atSchool(p) && covers(s, [(schoolStart(p.countryId) + 10) % 12]) }, 'The long school holidays: weeks of them, all yours.', [
    { label: 'Spend it outside with your friends', outcomes: [any('Scraped knees, sunburn and a story you will tell for years.', 'good', st('mood', 6), st('health', 1))] },
    { label: 'Read everything you can find', outcomes: [any('You go back to school knowing things your teachers do not expect.', 'good', st('intellect', 2))] },
    { label: 'Get bored, then inventive', outcomes: [any('By the end of the holidays you have built a fort, a radio and a grudge against your sibling.', 'neutral', st('mood', 2))] },
  ], { cooldown: 2 }),
  scene('between_summer_job', [15, 19], { steps: both, when: (p, s) => covers(s, [(schoolStart(p.countryId) + 10) % 12, (schoolStart(p.countryId) + 11) % 12]) }, 'A local shop was hiring for summer vacation: a few weeks of work, cash in hand at the end.', [
    { label: 'Take it', outcomes: [any('Long days, sore feet and your own money for the first time.', 'good', cash(600), hid('discipline', 2))] },
    { label: 'Keep the holidays free', outcomes: [any('The holidays are yours. So is the empty wallet.', 'neutral', st('mood', 2))] },
  ]),
  scene('between_summer_trip', [20, 90], { steps: both, seasons: ['summer', 'dry', 'cool', 'mild'], when: (p) => p.finance.cash > 2000 }, 'Everyone seems to be going away somewhere. A few days off would not hurt.', [
    { label: 'Take a short trip', outcomes: [any('New streets, bad maps and very good food.', 'good', st('mood', 7), cash(-400))] },
    { label: 'Stay home and save it', outcomes: [any('A staycation. The fridge is right there.', 'neutral', st('mood', 1))] },
  ]),
  scene('between_winter_cold', [3, 110], { steps: both, seasons: ['winter', 'wet', 'monsoon', 'cool'] }, 'Half the people you know are sniffling. Then it is you.', [
    { label: 'Rest properly', outcomes: [any('Three days on the sofa. You feel human again.', 'neutral', st('health', 1))] },
    { label: 'Push through it', outcomes: [any('You get things done, slowly and grumpily, and it drags on.', 'bad', st('health', -2), st('mood', -2))] },
  ]),
  scene('between_winter_snow', [4, 14], { steps: both, seasons: ['winter'], when: (p) => SNOWY.has(p.countryId) }, 'Overnight the world went quiet and white. School might be closed.', [
    { label: 'Build the biggest snowman on the street', outcomes: [any('It lasts four days and leans a little to the left. Perfect.', 'good', st('mood', 6))] },
    { label: 'Start a snowball fight', outcomes: [any('You win, by most accounts.', 'good', st('mood', 5))] },
  ], { cooldown: 2 }),
  scene('between_winter_dark', [16, 110], { steps: both, seasons: ['winter'], when: (p) => DARK_WINTERS.has(p.countryId) }, 'The days are short and dark. It gets into your mood before you notice.', [
    { label: 'Get outside in the daylight every day', outcomes: [any('A walk at lunch, every day. It helps more than you expected.', 'good', st('mood', 4), st('health', 1))] },
    { label: 'Fill the evenings with people', outcomes: [any('Friends round, games, soup. The dark is easier in company.', 'good', st('mood', 5))] },
    { label: 'Hibernate', outcomes: [any('You sleep a lot and feel no better for it.', 'neutral', st('mood', -2))] },
  ]),
  scene('between_spring_clean', [18, 100], { steps: [3], seasons: ['spring', 'dry', 'mild', 'after'] }, 'A clear, bright weekend at last. The house could use a proper clear-out.', [
    { label: 'Clear out everything you do not use', outcomes: [any('Six bags gone. You feel lighter, which makes no sense and is true.', 'good', st('mood', 4))] },
    { label: 'Sell what you can', outcomes: [any('A few things go to new homes, and a little money comes back.', 'good', cash(150))] },
    { label: 'Leave it for another weekend', outcomes: [any('Another weekend comes. You leave it again.', 'neutral')] },
  ]),
  scene('between_spring_allergies', [5, 100], { steps: both, seasons: ['spring', 'after'] }, 'Everything is in flower, and your eyes are not happy about it.', [
    { label: 'See a pharmacist', outcomes: [any('A tablet a day and the world is bearable.', 'good', cash(-20), st('health', 1))] },
    { label: 'Suffer bravely', outcomes: [any('You sneeze through spring.', 'neutral', st('mood', -2))] },
  ]),
  scene('between_spring_garden', [25, 110], { steps: both, seasons: ['spring', 'wet', 'monsoon'] }, 'The ground has softened, and something in you wants to grow things.', [
    { label: 'Plant a few vegetables', outcomes: [any('By the next season you have tomatoes, mostly eaten by snails.', 'good', st('mood', 4), st('health', 1))] },
    { label: 'Fill some pots with flowers', outcomes: [any('A small explosion of color by the door.', 'good', st('mood', 3), cash(-30))] },
  ], { cooldown: 2 }),
  scene('between_fall_leaves', [3, 110], { steps: both, seasons: ['fall'] }, 'The leaves turn and fall, and the air has that sharp, clean edge to it.', [
    { label: 'Go for a long walk', outcomes: [any('Crunching leaves and cold cheeks. A good day.', 'good', st('mood', 4), st('health', 1))] },
    { label: 'Make something warm to eat', outcomes: [any('The house smells wonderful for two days.', 'good', st('mood', 3))] },
  ]),

  // ---------- Rainy and dry seasons, the monsoon, and the desert year ----------
  scene('between_rains_arrive', [4, 110], { steps: both, seasons: ['wet'] }, 'The rains have come: every afternoon the sky opens, the streets run like rivers, and then the sun is out again as if nothing happened.', [
    { label: 'Get caught in it on purpose, once', outcomes: [any('Soaked to the skin and grinning. Worth it.', 'good', st('mood', 5))] },
    { label: 'Plan the days around the downpours', outcomes: [any('Errands in the morning, home before three. It works.', 'neutral', hid('discipline', 1))] },
    { label: 'Clear the gutters before they overflow', outcomes: [any('The neighbors\' yards flood. Yours does not.', 'good', cash(-20))] },
  ]),
  scene('between_mosquitoes', [3, 110], { steps: both, seasons: ['wet', 'monsoon'] }, 'With the rain come the mosquitoes, in clouds.', [
    { label: 'Nets over the beds, and repellent every evening', outcomes: [any('A few bites, nothing worse.', 'good', cash(-15), st('health', 1))] },
    { label: 'Ignore them', outcomes: [any('You scratch your way through the season.', 'bad', st('health', -2), st('mood', -2))] },
  ]),
  scene('between_dry_season', [4, 110], { steps: both, seasons: ['dry'] }, 'The dry season: clear skies, dusty roads, and evenings cool enough to sit outside.', [
    { label: 'Spend the evenings outdoors with people', outcomes: [any('Long evenings, good company, a sky full of stars.', 'good', st('mood', 5))] },
    { label: 'Go somewhere the roads were too muddy to reach', outcomes: [any('You finally make the trip you put off all through the rains.', 'good', st('mood', 4), cash(-60))] },
  ]),
  scene('between_water_short', [12, 110], { steps: both, seasons: ['dry', 'hot'] }, 'The water is running low: the taps work a few hours a day, and the tanks are watched closely.', [
    { label: 'Fill every container while it runs', outcomes: [any('Buckets in the bath, bottles in the fridge. You get through it.', 'neutral', hid('discipline', 1))] },
    { label: 'Buy water from the truck', outcomes: [any('It costs, but the household never runs dry.', 'neutral', cash(-40))] },
  ]),
  scene('between_monsoon', [4, 110], { steps: both, seasons: ['monsoon'] }, 'The monsoon breaks. The first rain on the hot ground smells like nothing else in the world.', [
    { label: 'Stand outside in it', outcomes: [any('Everyone else had the same idea. Half the street is out, faces up to the sky.', 'good', st('mood', 6))] },
    { label: 'Get the house ready for the flooding', outcomes: [any('Sandbags at the door, valuables up high. The water stops a step short.', 'good', cash(-30))] },
  ]),
  scene('between_hot_season', [4, 110], { steps: both, seasons: ['hot'] }, 'The hot season. By ten in the morning the streets are empty, and the fan only moves the heat around.', [
    { label: 'Live by the clock: early mornings, long afternoons indoors', outcomes: [any('Up at dawn, asleep after lunch, out again at dusk. It is how everyone does it.', 'good', st('health', 1))] },
    { label: 'Pay for air conditioning', outcomes: [any('Cool rooms, and a very large electricity bill.', 'neutral', cash(-120), st('mood', 3))] },
  ]),
  scene('between_cool_evenings', [4, 110], { steps: both, seasons: ['cool', 'mild', 'after'] }, 'The heat has broken. The evenings are soft and cool, and the whole city seems to come outdoors.', [
    { label: 'Go out walking after dark', outcomes: [any('Street food, music from somewhere, everyone out. The best weeks of the year.', 'good', st('mood', 5))] },
    { label: 'Have people round on the roof or the porch', outcomes: [any('Tea, talk, and nobody wants to go home.', 'good', st('mood', 4), st('charm', 1))] },
  ]),

  // ---------- School and study ----------
  scene('between_back_to_school', [6, 17], { steps: both, when: (p, s) => atSchool(p) && schoolStarts(p, s) }, 'A new school year: new classes, new teachers, and a timetable you will lose twice.', [
    { label: 'Start strong: notes, homework, the lot', outcomes: [any('For the first weeks at least, you are a model student.', 'good', gpa(0.05), hid('discipline', 1))] },
    { label: 'Ease in gently', outcomes: [any('You find your feet, and your friends, soon enough.', 'neutral', st('mood', 2))] },
  ], { cooldown: 2 }),
  scene('between_midterm_report', [6, 17], { steps: [3], when: atSchool }, 'Midterm reports go home. Yours is in your bag, unopened.', [
    { label: 'Hand it over and talk it through', outcomes: [any('Some good, some "could try harder". A fair conversation.', 'neutral', hid('discipline', 1))] },
    { label: 'Promise yourself to pull your socks up', outcomes: [any('You do, for a while.', 'good', gpa(0.04))] },
  ], { cooldown: 2 }),
  scene('between_exam_season', [13, 18], { steps: both, when: (p, s) => atSchool(p) && examTime(p, s) }, 'Exam season. The library is full, and so is your head.', [
    { label: 'Make a revision timetable and keep to it', outcomes: [any('It works. You go in prepared.', 'good', gpa(0.08), st('mood', -2))] },
    { label: 'Revise with friends', outcomes: [any('Half revision, half gossip. Some of it sticks.', 'neutral', gpa(0.03), st('mood', 3))] },
    { label: 'Wing it', outcomes: [any('A bold strategy.', 'bad', gpa(-0.05))] },
  ], { cooldown: 2 }),
  scene('between_uni_midterms', [17, 40], { steps: both, when: atUni }, 'Midterms already. Somehow the semester got away from you.', [
    { label: 'Pull a week of late nights', outcomes: [any('You pass everything and sleep for two days.', 'good', gpa(0.06), st('health', -1))] },
    { label: 'Go to office hours and ask for help', outcomes: [any('The professor is kinder than you expected, and clearer.', 'good', gpa(0.05))] },
  ], { cooldown: 2 }),

  // ---------- Work ----------
  scene('between_quarter_review', [18, 75], { steps: [3], when: working }, 'End of the quarter at work: numbers, deadlines, and a meeting about the numbers and the deadlines.', [
    { label: 'Stay late and finish strong', outcomes: [any('Your manager notices. So does your back.', 'good', hid('discipline', 1), st('mood', -2))] },
    { label: 'Keep to your hours', outcomes: [any('It gets done, at a sane pace.', 'neutral', st('mood', 1))] },
  ], { cooldown: 2 }),
  scene('between_work_party', [18, 75], { steps: both, when: (p, s) => working(p) && covers(s, [11, 5]) }, 'The work party is this week. There will be speeches, and a buffet.', [
    { label: 'Go, and actually talk to people', outcomes: [any('You learn more about the company in one evening than in a year.', 'good', st('mood', 3), st('charm', 1))] },
    { label: 'Show your face, leave early', outcomes: [any('Seen, fed, home by nine.', 'neutral')] },
  ], { cooldown: 2 }),
  scene('between_holiday_days', [18, 75], { steps: [6], when: working }, 'You have holiday days left this half of the year, and they will not take themselves.', [
    { label: 'Take them all', outcomes: [any('A week of nothing in particular. You come back a different person, briefly.', 'good', st('mood', 6))] },
    { label: 'Save them for later', outcomes: [any('Later never quite comes.', 'neutral')] },
  ], { cooldown: 2 }),
  scene('between_retired_routine', [60, 110], { steps: both, when: retired }, 'Retirement has a rhythm now: mornings slow, afternoons yours.', [
    { label: 'Volunteer a few hours a week', outcomes: [any('People rely on you again. It feels good to be needed.', 'good', st('mood', 5))] },
    { label: 'Take up something completely new', outcomes: [any('You are terrible at it. You love it.', 'good', st('mood', 4), st('intellect', 1))] },
  ], { cooldown: 3 }),

  // ---------- A baby on the way, and a new one at home ----------
  scene('between_pregnancy_scan', [16, 55], { steps: both, when: (p) => !!p.flags.pregnancy }, 'The scan. A grainy shape on a screen, and a heartbeat, fast as a bird\'s.', [
    { label: 'Ask for a printout to keep', outcomes: [any('It goes on the fridge, and then in a frame.', 'good', st('mood', 6))] },
    { label: 'Just watch', outcomes: [any('You do not say much. You do not need to.', 'good', st('mood', 5))] },
  ], { cooldown: 1 }),
  scene('between_nursery', [16, 60], { steps: both, when: (p) => !!p.flags.pregnancy }, 'There is a room to get ready, and a list of things a very small person apparently needs.', [
    { label: 'Paint it and build the furniture yourself', outcomes: [any('The instructions lie. You manage anyway.', 'good', st('mood', 3), cash(-300))] },
    { label: 'Keep it simple: a cot and a box of clothes', outcomes: [any('Babies need less than the shops say.', 'neutral', cash(-100))] },
  ], { cooldown: 1 }),
  scene('between_baby_firsts', [16, 70], { steps: both, when: (p, s) => kids(s, 0, 1).length > 0 }, 'A first smile, aimed right at you. Or wind. You decide it was a smile.', [
    { label: 'Tell everyone', outcomes: [any('Everyone hears. Twice.', 'good', st('mood', 6))] },
    { label: 'Keep it as a quiet moment of your own', outcomes: [any('You will remember it anyway.', 'good', st('mood', 5))] },
  ], { cooldown: 1 }),
  scene('between_sleepless', [16, 70], { steps: [3], when: (p, s) => kids(s, 0, 1).length > 0 }, 'The baby has decided sleep is optional. Nobody consulted you.', [
    { label: 'Take turns, and nap when you can', outcomes: [any('You survive. Mostly on coffee.', 'neutral', st('health', -1))] },
    { label: 'Ask family to help for a night', outcomes: [any('One full night of sleep. You could cry with gratitude.', 'good', st('mood', 4))] },
  ], { cooldown: 1 }),
  scene('between_school_run', [25, 70], { steps: both, when: (p, s) => kids(s, 4, 6).length > 0 && schoolStarts(p, s) }, 'A first day at school for your youngest: a uniform a size too big and a bag bigger than they are.', [
    { label: 'Take a photo at the gate', outcomes: [any('They wave without looking back. You are fine. You are absolutely fine.', 'good', st('mood', 4))] },
    { label: 'Give them a pep talk on the way', outcomes: [any('They nod seriously, then run off to someone they met five seconds ago.', 'good', st('mood', 3))] },
  ], { cooldown: 2 }),

  // ---------- Sport ----------
  scene('between_preseason', [8, 40], { steps: both, when: playsTeamSport }, 'Preseason training: hill runs, drills, and a coach with a whistle and no mercy.', [
    { label: 'Give it everything', outcomes: [any('You finish every run, and finish them first by the end.', 'good', st('health', 2), hid('discipline', 2))] },
    { label: 'Pace yourself', outcomes: [any('Steady work. You will be ready when it matters.', 'neutral', st('health', 1))] },
  ], { cooldown: 2 }),
  scene('between_team_bonding', [8, 40], { steps: both, when: playsTeamSport }, 'The team has a night out planned: food, games, too much noise.', [
    { label: 'Go, and get to know the new faces', outcomes: [any('By the end of the night, you have inside jokes with people you did not know last week.', 'good', st('mood', 5))] },
    { label: 'Skip it and rest', outcomes: [any('A quiet night. You hear all about it at training.', 'neutral')] },
  ], { cooldown: 2 }),
];

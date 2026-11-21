// Clubs and classes to join (engine/clubs.js). A membership lasts until it is left, lapses or the player moves away;
// it costs dues each year and, each year, adds a little to what it is about, and brings people. Members can stand
// for the committee and in time run the club.
//
//   id, name, kind (a group below), minAge, maxAge?, dues (base units a year; a child's are paid at home), from (the
//   year such clubs began to exist), grows ({ 'stats.charm': n, ... }: a year's nudge, less as the stat gets high),
//   skill (a skill in data/skills.js practiced there), friend (chance a year of a new friend), needs (a special
//   condition: 'kids' a child under 12, 'instrument' an instrument at 40 or more, 'drink' the drinking age),
//   top (what the head of it is called), blurb, year (the line for a year of it).
export const CLUB_KINDS = [
  { id: 'mind', name: 'Minds and games' },
  { id: 'arts', name: 'Arts and making' },
  { id: 'stage', name: 'Music, dance and the stage' },
  { id: 'body', name: 'Fitness and the outdoors' },
  { id: 'community', name: 'Community and service' },
  { id: 'social', name: 'Social clubs' },
];

const C = (id, kind, name, minAge, dues, o = {}) => ({ id, kind, name, minAge, dues, from: 0, grows: {}, friend: 0.3, top: 'Chair', ...o });

export const CLUBS = [
  // Minds and games
  C('book', 'mind', 'A book club', 14, 40, { grows: { 'stats.intellect': 1, 'stats.mood': 1 }, friend: 0.35, blurb: 'A book a month and an evening arguing about it.', year: 'Twelve books, twelve evenings, and one that everyone hated.' }),
  C('chess', 'mind', 'A chess club', 7, 60, { skill: 'chess', grows: { 'stats.intellect': 1 }, top: 'Club captain', blurb: 'Tuesday nights, a league, and clocks that tick too loudly.', year: 'You played the league season and learned more from losing than from winning.' }),
  C('debate', 'mind', 'A debating society', 13, 50, { grows: { 'stats.charm': 2, 'stats.intellect': 1 }, top: 'President', blurb: 'Motions, rebuttals, and learning to argue the side you disagree with.', year: 'You argued for things you did not believe, and won some of them.' }),
  C('speakers', 'mind', 'A speakers\' club', 16, 120, { grows: { 'stats.charm': 2 }, skill: 'public_speaking', top: 'President', blurb: 'Short speeches, timed, with kind and honest feedback.', year: 'A speech every few weeks. Your hands have stopped shaking.' }),
  C('quiz', 'mind', 'A bar trivia team', 18, 30, { from: 1975, needs: 'drink', grows: { 'stats.intellect': 1, 'stats.mood': 1 }, friend: 0.35, top: 'Captain', blurb: 'Thursday nights, a terrible team name, and a rivalry with the table by the door.', year: 'You won twice, came last once, and argued about a capital city all year.' }),
  C('boardgames', 'mind', 'A board game night', 10, 30, { from: 1960, grows: { 'stats.mood': 2, 'stats.intellect': 1 }, friend: 0.4, top: 'Organizer', blurb: 'Strategy games that take all evening and end friendships, briefly.', year: 'You learned a dozen new games and taught a few.' }),
  C('astronomy', 'mind', 'An astronomy society', 10, 70, { from: 1850, grows: { 'stats.intellect': 2 }, top: 'President', blurb: 'Telescopes in a dark field, and talks about things very far away.', year: 'You saw the rings of Saturn with your own eyes, on a cold clear night.' }),
  C('coding', 'mind', 'A coding meetup', 13, 0, { from: 1985, skill: 'coding', grows: { 'stats.intellect': 1 }, top: 'Organizer', blurb: 'Laptops, pizza, and someone always showing off a side project.', year: 'You built something small that works, and showed it to the room.' }),
  C('history', 'mind', 'A local history society', 16, 30, { grows: { 'stats.intellect': 1 }, friend: 0.25, top: 'Chair', blurb: 'Old maps, old photographs, and the stories of the streets you walk.', year: 'You found out who lived in your street a hundred years ago.' }),
  C('languages', 'mind', 'A language exchange', 16, 0, { grows: { 'stats.intellect': 1, 'stats.charm': 1 }, friend: 0.45, top: 'Organizer', blurb: 'Half the evening in your language, half in theirs.', year: 'You stumbled through a lot of conversations and made friends from far away.' }),
  C('investing', 'mind', 'An investment club', 21, 150, { from: 1950, grows: { 'stats.intellect': 1 }, top: 'Treasurer', blurb: 'Members pool a little money, read the reports and argue over what to buy.', year: 'You learned to read a company\'s accounts and to distrust a hot tip.' }),

  // Arts and making
  C('photo', 'arts', 'A photography club', 12, 60, { from: 1890, skill: 'photography', grows: { 'stats.mood': 1 }, top: 'Chair', blurb: 'Monthly themes, competitions, and long talks about light.', year: 'One of your pictures was pinned up at the end-of-year show.' }),
  C('drawing', 'arts', 'An evening art class', 14, 220, { skill: 'painting', grows: { 'stats.mood': 2 }, top: 'Class rep', blurb: 'Still lifes, figure drawing, and a teacher who says "look again".', year: 'Your drawing got looser and truer as the year went on.' }),
  C('pottery', 'arts', 'A pottery class', 10, 260, { grows: { 'stats.mood': 3 }, top: 'Class rep', blurb: 'The wheel, the kiln, and a shelf of lopsided bowls.', year: 'You made a set of mugs that nearly match.' }),
  C('writers', 'arts', 'A writers\' group', 14, 40, { skill: 'writing', grows: { 'stats.intellect': 1 }, top: 'Chair', blurb: 'Bring pages, read them aloud, and take the notes gracefully.', year: 'You finished things this year, because people were waiting to read them.' }),
  C('film', 'arts', 'A film society', 16, 80, { from: 1925, grows: { 'stats.intellect': 1, 'stats.mood': 1 }, friend: 0.3, top: 'Programmer', blurb: 'Old films on a big screen, and an argument in the bar afterward.', year: 'Forty films, half of them older than you, and a few you will never forget.' }),
  C('crafts', 'arts', 'A knitting and sewing circle', 10, 30, { grows: { 'stats.mood': 2 }, friend: 0.35, top: 'Organizer', blurb: 'Needles, patterns and gossip, in roughly equal measure.', year: 'A scarf, then a sweater, then all the gossip in town.' }),
  C('cooking', 'arts', 'A cooking class', 12, 300, { skill: 'cooking', grows: { 'stats.mood': 1, 'stats.health': 1 }, top: 'Class rep', blurb: 'A different cuisine each term, and you eat your homework.', year: 'You can make a dozen things now that you used to buy.' }),

  // Music, dance and the stage
  C('choir', 'stage', 'A community choir', 8, 60, { skill: 'singing', grows: { 'stats.mood': 3 }, friend: 0.35, top: 'Choir secretary', blurb: 'Weekly rehearsals, a concert at Christmas and one in summer.', year: 'You sang in two concerts. The applause was for all of you, and that was the best part.' }),
  C('orchestra', 'stage', 'A community orchestra', 10, 90, { needs: 'instrument', grows: { 'stats.mood': 2, 'talents.music': 1 }, top: 'Leader', blurb: 'Amateur players, a patient conductor, and three concerts a year.', year: 'A full season of rehearsals and concerts. You are a better player for sitting among others.' }),
  C('drama', 'stage', 'A community theater group', 10, 70, { skill: 'acting', grows: { 'stats.charm': 1 }, friend: 0.35, top: 'Director', blurb: 'Two shows a year, a cold church hall, and everyone doing everything.', year: 'You were in the spring show and painted scenery for the autumn one.' }),
  C('socialdance', 'stage', 'A social dance club', 16, 160, { from: 1920, skill: 'dance', grows: { 'stats.charm': 2, 'stats.health': 1 }, friend: 0.45, top: 'Organizer', blurb: 'Salsa, swing and ballroom, with whoever asks you next.', year: 'You danced with half the town. Your feet hurt and you are happy.' }),
  C('band', 'stage', 'A community band', 12, 50, { needs: 'instrument', grows: { 'stats.mood': 2, 'talents.music': 1 }, top: 'Bandmaster', blurb: 'Brass and wind, parades, fairs and a summer concert in the park.', year: 'Marches in the parade, and a concert in the bandstand in August.' }),

  // Fitness and the outdoors
  C('running', 'body', 'A running club', 12, 50, { grows: { 'stats.health': 3, 'stats.mood': 1 }, friend: 0.3, top: 'Club captain', blurb: 'Track nights, long runs on Sundays, and races you pay to enter.', year: 'You ran further than you thought you could, and faster by the end of it.' }),
  C('cycling', 'body', 'A cycling club', 12, 80, { from: 1890, grows: { 'stats.health': 3 }, top: 'Club captain', blurb: 'Group rides, a café stop, and hills that never get easier.', year: 'Thousands of miles in a long line of bikes, and coffee halfway.' }),
  C('hiking', 'body', 'A hiking club', 10, 40, { grows: { 'stats.health': 2, 'stats.mood': 2 }, friend: 0.35, top: 'Walks leader', blurb: 'A walk most weekends, whatever the weather.', year: 'Hills, rain, sandwiches on a wall, and the view at the top.' }),
  C('swimclub', 'body', 'A swimming club', 6, 120, { skill: 'swimming', grows: { 'stats.health': 3 }, top: 'Club captain', blurb: 'Early mornings, lane etiquette and the smell of chlorine.', year: 'Early mornings in the pool. You are stronger in the water than you were.' }),
  C('dojo', 'body', 'A martial arts club', 6, 300, { skill: 'martial_arts', grows: { 'stats.health': 2, 'hidden.discipline': 1 }, top: 'Senior instructor', blurb: 'Bowing in, drills, sparring, and gradings for the next belt.', year: 'You trained all year and passed your grading.' }),
  C('yoga', 'body', 'A yoga class', 12, 400, { from: 1965, skill: 'yoga', grows: { 'stats.health': 2, 'stats.mood': 2 }, top: 'Class rep', blurb: 'Twice a week on a mat, breathing on purpose.', year: 'You can touch your toes now, and you sleep better.' }),
  C('birding', 'body', 'A birdwatching society', 8, 25, { grows: { 'stats.mood': 2 }, friend: 0.25, top: 'Recorder', blurb: 'Binoculars, a notebook and a lot of patience at dawn.', year: 'You saw a bird nobody had recorded locally for years, and they wrote it up.' }),
  C('garden', 'body', 'A community garden', 10, 60, { skill: 'gardening', grows: { 'stats.mood': 2, 'stats.health': 1 }, friend: 0.3, top: 'Chair', blurb: 'A plot of your own, and neighbors with opinions about it.', year: 'Too many zucchini, not enough tomatoes, and a prize for your onions.' }),
  C('sailing', 'body', 'A sailing club', 12, 900, { grows: { 'stats.health': 2, 'stats.mood': 2 }, friend: 0.3, top: 'Commodore', blurb: 'Dinghies, races on Sunday, and getting very wet.', year: 'You capsized twice and won a race once.' }),

  // Community and service
  C('scouts', 'community', 'The scouts', 6, 80, { maxAge: 17, from: 1908, grows: { 'hidden.discipline': 1, 'stats.health': 1, 'stats.charm': 1 }, friend: 0.4, top: 'Patrol leader', blurb: 'Badges, camping, knots and a promise.', year: 'Camps, badges and a fire you lit yourself.' }),
  C('youthclub', 'community', 'A youth club', 11, 0, { maxAge: 18, from: 1940, grows: { 'stats.mood': 2, 'stats.charm': 1 }, friend: 0.45, top: 'Youth council rep', blurb: 'Table tennis, music, trips, and somewhere to be on a Friday.', year: 'Friday nights at the club, and a trip to the coast in summer.' }),
  C('volunteers', 'community', 'A volunteer group', 12, 0, { grows: { 'stats.mood': 2, 'stats.charm': 1 }, friend: 0.35, top: 'Coordinator', blurb: 'A food bank, litter picks, visiting people who are lonely.', year: 'Saturdays at the food bank. The thanks were quiet and they meant a lot.' }),
  C('service', 'community', 'A service club', 25, 250, { from: 1910, grows: { 'stats.charm': 1 }, friend: 0.35, top: 'President', blurb: 'Local business people raising money for good causes over dinner.', year: 'Fundraising dinners, a fun run, and a check for the hospice.' }),
  C('parents', 'community', 'A parents\' group', 18, 0, { needs: 'kids', grows: { 'stats.mood': 2 }, friend: 0.5, top: 'Organizer', blurb: 'Other parents, coffee, and children underfoot.', year: 'Coffee and sympathy with people who know exactly what it is like.' }),
  C('seniors', 'community', 'A seniors\' club', 65, 30, { grows: { 'stats.mood': 3, 'stats.health': 1 }, friend: 0.45, top: 'Chair', blurb: 'Lunches, outings, bingo, and company.', year: 'Lunches and outings, and people to talk to every week.' }),
  C('residents', 'community', 'A residents\' association', 18, 15, { grows: { 'stats.charm': 1 }, friend: 0.3, top: 'Chair', blurb: 'Meetings about parking, the park and the planning office.', year: 'You went to the meetings and got a crossing put in near the school.' }),

  // Social clubs
  C('country', 'social', 'A country club', 25, 6000, { from: 1885, grows: { 'stats.charm': 1, 'stats.health': 1 }, friend: 0.35, top: 'Club president', blurb: 'Golf, tennis, a pool, and the people who run the town.', year: 'Rounds of golf with people who matter, and dinners on the terrace.' }),
  C('members', 'social', 'A private members\' club', 25, 3000, { grows: { 'stats.charm': 2 }, friend: 0.35, top: 'Club chair', blurb: 'Leather chairs, quiet rooms, and introductions that lead somewhere.', year: 'Long lunches and introductions. People know your name at the door.' }),
  C('wine', 'social', 'A wine tasting club', 18, 400, { from: 1950, needs: 'drink', grows: { 'stats.charm': 1, 'stats.mood': 2 }, friend: 0.35, top: 'Cellar master', blurb: 'A theme each month, tasting notes, and learning to spit.', year: 'You can tell a Rioja from a Barolo now, mostly.' }),
];
export const CLUB_BY_ID = Object.fromEntries(CLUBS.map((c) => [c.id, c]));

/** How many clubs and classes fit into a life at once. */
export const MAX_CLUBS = 4;
/** The ranks a member rises through; the last is named by the club's `top`. */
export const CLUB_RANKS = ['Member', 'On the committee', 'top'];

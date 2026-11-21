// STORYLINE: the decades. Scenes that belong to particular years: the railway
// reaching town, the first talking picture, the night of the Moon landing, a
// home computer on the kitchen table. Each says when (`years`) and, where it
// matters, where (`places`); the event engine only offers it then and there
// (engine/history.js sceneFits). Each happens at most once in a life, and at
// most one of them a year. Real events are named only where they are widely
// known and dated; nobody real appears.
import { st, hid, tal, cash, ms, heat, ok, bad, any, chk } from '../helpers.js';

/** Common fields: once in a life, one history scene a year, a little more likely than an ordinary scene. */
const era = (o) => ({ category: 'history', once: true, exclusive: 'history', weight: 4, ...o });
/** Countries that fought in the Second World War and rationed food. */
const WARTIME = ['uk', 'fr', 'de', 'it', 'nl', 'be', 'no', 'dk', 'jp', 'us', 'ca', 'au', 'nz', 'pl', 'gr'];
const EUROPE = ['uk', 'fr', 'de', 'it', 'es', 'nl', 'be', 'at', 'ch', 'ie', 'pt', 'gr', 'fi', 'se', 'no', 'dk', 'pl', 'cz', 'hu', 'ro', 'sk', 'si', 'hr', 'ee', 'lt', 'lv', 'ua', 'by', 'ru'];

/** @type {import('../../../types.js').GameEvent[]} */
export default [
  // ---------- The early era ----------
  era({
    id: 'dec_railway', years: [1830, 1890], ageRange: [6, 80],
    text: 'The railway has reached {city}. The first train is due on Saturday, and the whole town means to be at the station when it comes in.',
    choices: [
      { label: 'Be there when it arrives', outcomes: [any('A roar, a shriek, a wall of steam. Half the crowd stepped back and the other half cheered.', 'good', st('mood', 5), ms('Saw the first train come into town.'))] },
      { label: 'Buy a ticket and ride it', outcomes: [any('Thirty miles in an hour. You came back feeling that the world had got smaller.', 'good', cash(-60), st('intellect', 2), st('mood', 4), ms('Rode the railway the year it came.'))] },
      { label: 'Keep well away from the noisy thing', outcomes: [any('You heard it from the far side of town, which was close enough.', 'neutral')] },
    ],
  }),
  era({
    id: 'dec_cholera', years: [1830, 1895], ageRange: [8, 80],
    text: 'There is cholera in the district. Some say it comes from the air; a doctor in the newspaper says it is the water from the street pump.',
    choices: [
      { label: 'Boil every drop you drink', outcomes: [any('Tedious, and it worked. Your street was spared the worst of it.', 'good', hid('discipline', 2), st('health', 2))] },
      { label: 'Carry on drawing from the pump', check: chk(0.6, { 'stats.health': 0.5 }), outcomes: [ok('You were lucky. Others on the street were not.', st('mood', -3)), bad('You fell ill, badly, and were weeks recovering.', st('health', -18), st('mood', -6))] },
      { label: 'Go and stay with relatives in the country', outcomes: [any('A month of fresh air and someone else\'s cooking, until it passed.', 'neutral', cash(-400), st('health', 1))] },
    ],
  }),
  era({
    id: 'dec_portrait', years: [1855, 1910], ageRange: [4, 90],
    text: 'A traveling photographer has set up in the square, offering portraits. You have to sit perfectly still for half a minute.',
    choices: [
      { label: 'Have a family portrait taken', outcomes: [any('Nobody smiled: you could not hold a smile that long. It went on the wall above the fireplace.', 'good', cash(-150), st('mood', 3), ms('Sat for a family photograph.'))] },
      { label: 'Not worth the money', outcomes: [any('Your face went unrecorded for another year.', 'neutral')] },
    ],
  }),
  era({
    id: 'dec_electric_light', years: [1885, 1930], ageRange: [8, 90],
    text: 'The electricity company is wiring the street. For a fee they will bring it into the house: light at the turn of a switch.',
    choices: [
      { label: 'Pay to have it put in', outcomes: [any('The first evening, everyone kept switching it on and off just to see it happen.', 'good', cash(-1500), st('mood', 4), ms('Electric light came into the house.'))] },
      { label: 'The oil lamps are fine', outcomes: [any('For now. The neighbors\' windows look very bright.', 'neutral')] },
    ],
  }),
  era({
    id: 'dec_motorcar', years: [1900, 1915], ageRange: [5, 80],
    text: 'A motor car has come through {city}, scattering chickens and frightening every horse on Main Street. The driver has stopped outside the inn.',
    choices: [
      { label: 'Ask the driver for a ride', check: chk(0.45, { 'stats.charm': 0.6 }), outcomes: [ok('Twenty miles an hour down the London road. You held your hat the whole way.', st('mood', 7), ms('Rode in a motor car for the first time.')), bad('He laughed and said not today.', st('mood', -1))] },
      { label: 'Join the people complaining about the noise', outcomes: [any('A letter to the paper, signed by thirty people. The cars kept coming.', 'neutral')] },
    ],
  }),
  era({
    id: 'dec_emigrant_cousin', years: [1880, 1914], ageRange: [12, 60],
    text: 'Your cousin has a ticket on a ship to the other side of the world, and is leaving on Thursday. They will probably never come back.',
    choices: [
      { label: 'See them off at the docks', outcomes: [any('You stood on the quay until the ship was a speck. They promised to write.', 'neutral', st('mood', -3), ms('Saw a cousin off to a new world.'))] },
      { label: 'Give them what money you can spare', outcomes: [any('They tried to refuse it, and then took it.', 'good', cash(-300), hid('karma', 3))] },
    ],
  }),
  era({
    id: 'dec_suffrage', years: [1905, 1918], places: ['uk', 'us'], ageRange: [16, 80],
    text: 'There is a great march through the city for votes for women. Banners, sashes, and a lot of angry men on the sidewalks.',
    choices: [
      { label: 'March with them', check: chk(0.75), outcomes: [ok('Miles of you, singing. You will remember it all your life.', hid('karma', 3), st('mood', 4), ms('Marched for votes for women.')), bad('The police broke up the end of the march, and you spent a night in the cells.', heat(5), st('mood', -2), ms('Arrested marching for votes for women.'))] },
      { label: 'Sign the petition', outcomes: [any('Your name, among a quarter of a million.', 'good', hid('karma', 1))] },
      { label: 'Stay out of it', outcomes: [any('You watched from a window.', 'neutral')] },
    ],
  }),
  era({
    id: 'dec_titanic', years: [1912, 1912], ageRange: [8, 100],
    text: 'The newspapers have only one story: the great new liner Titanic has struck an iceberg on her first voyage and sunk. More than fifteen hundred people are lost.',
    choices: [
      { label: 'Give to the fund for the families', outcomes: [any('A little, in the collecting tin outside the church.', 'good', cash(-50), hid('karma', 2))] },
      { label: 'Read every name on the lists', outcomes: [any('Page after page of them. It was hard to sleep that night.', 'neutral', st('mood', -3))] },
    ],
  }),

  // ---------- Between the wars ----------
  era({
    id: 'dec_jazz', years: [1920, 1930], ageRange: [16, 35],
    text: 'There is a new dance hall in {city} with a jazz band from out of town. Everyone young is going; everyone old says it is a disgrace.',
    choices: [
      { label: 'Dance until they close', outcomes: [any('Your feet hurt for two days. Worth it.', 'good', st('mood', 6), tal('dance', 3), st('charm', 1))] },
      { label: 'Stay home', outcomes: [any('You heard the music from your window till two in the morning.', 'neutral')] },
    ],
  }),
  era({
    id: 'dec_talkies', years: [1927, 1932], ageRange: [6, 90],
    text: 'The picture house is showing a film where the actors talk, out loud, from the screen. There is a line around the block.',
    choices: [
      { label: 'Queue for it', outcomes: [any('When the first line was spoken, the whole room gasped.', 'good', cash(-15), st('mood', 5), ms('Saw the first talking picture.'))] },
      { label: 'Go three times', outcomes: [any('You can recite the songs now, and do.', 'good', cash(-45), st('mood', 6), tal('acting', 2))] },
      { label: 'Wait for it to stop being a novelty', outcomes: [any('It never did.', 'neutral')] },
    ],
  }),
  era({
    id: 'dec_bank_run', years: [1929, 1933], ageRange: [18, 90],
    text: 'There is a crowd outside the bank, shouting. Word is going round that it will not open tomorrow.',
    choices: [
      { label: 'Get in line and take your money out', outcomes: [any('You got to the counter an hour before they closed the doors. Your savings went under the mattress.', 'neutral', st('mood', -2))] },
      { label: 'Trust the bank', check: chk(0.5), outcomes: [ok('It held. Others did not.', st('mood', 2)), bad('It did not open again. Part of what you had is gone for good.', cash(-2000), st('mood', -10))] },
      { label: 'Help the old woman at the back of the line', outcomes: [any('You held her place and walked her home after.', 'good', hid('karma', 3))] },
    ],
  }),
  era({
    id: 'dec_evacuation', years: [1939, 1940], places: ['uk'], ageRange: [4, 14],
    text: 'Every child in the city is being sent to the countryside to be safe from the bombing. You have a label pinned to your coat and a gas mask in a box.',
    choices: [
      { label: 'Get on the train', outcomes: [any('A farmhouse, strangers, cows. You missed home every night, and learned to milk a cow.', 'neutral', st('mood', -5), hid('discipline', 3), st('health', 2), ms('Evacuated to the countryside as a child.'))] },
      { label: 'Beg to stay with your family', check: chk(0.4), outcomes: [ok('Your mother could not bear to send you. You stayed.', st('mood', 3)), bad('There was no arguing with it. You went.', st('mood', -7), ms('Evacuated to the countryside as a child.'))] },
    ],
  }),
  era({
    id: 'dec_air_raid', years: [1940, 1944], places: ['uk', 'de', 'jp'], ageRange: [6, 90],
    text: 'The sirens again. The whole street crowds into the shelter, and the ground shakes with the bombs somewhere close.',
    choices: [
      { label: 'Start everyone singing', outcomes: [any('Badly, loudly, all night. It helped.', 'good', st('charm', 2), st('mood', 1))] },
      { label: 'Help the warden with the children', outcomes: [any('You told stories until the all-clear.', 'good', hid('karma', 3))] },
      { label: 'Hold on to your family and wait', outcomes: [any('In the morning, two houses on the next street were gone.', 'bad', st('mood', -6))] },
    ],
  }),
  era({
    id: 'dec_rationing', years: [1940, 1948], places: WARTIME, ageRange: [8, 90],
    text: 'Everything is rationed: one egg a week, a scrape of butter, and never enough sugar.',
    choices: [
      { label: 'Dig up the yard for vegetables', outcomes: [any('Potatoes, onions and a great many cabbages. You have never been healthier.', 'good', st('health', 3), hid('discipline', 2))] },
      { label: 'Buy extra on the black market', check: chk(0.7), outcomes: [ok('Nylons, chocolate and no questions.', cash(-150), hid('karma', -3), st('mood', 2)), bad('A policeman took a keen interest in where it came from.', cash(-150), heat(10), hid('karma', -3))] },
      { label: 'Share yours with the family next door', outcomes: [any('They had five children and nothing. You had a little.', 'good', hid('karma', 4), st('health', -1))] },
    ],
  }),

  // ---------- Mid-century ----------
  era({
    id: 'dec_polio', years: [1955, 1962], ageRange: [3, 50],
    text: 'There is a vaccine against polio at last. The line at the school hall stretches round the playground.',
    choices: [
      { label: 'Get in line', outcomes: [any('A sugar lump, or a quick shot, and one fear fewer.', 'good', st('health', 3))] },
      { label: 'Wait and see', outcomes: [any('You went the next year, with everyone else.', 'neutral')] },
    ],
  }),
  era({
    id: 'dec_sputnik', years: [1957, 1957], ageRange: [8, 90],
    text: 'The wireless says a man-made moon is circling the Earth, and that you can see it crossing the sky after dark.',
    choices: [
      { label: 'Go out and look for it', outcomes: [any('A tiny moving star, gone in a minute. You stood in the cold long after.', 'good', st('intellect', 2), st('mood', 3))] },
      { label: 'Stay in', outcomes: [any('It went round without you.', 'neutral')] },
    ],
  }),
  era({
    id: 'dec_rock_and_roll', years: [1955, 1963], ageRange: [13, 24],
    text: 'There is a new kind of music on the radio, loud and fast, and your parents say it is the end of civilization.',
    choices: [
      { label: 'Buy the record and wear it out', outcomes: [any('You learned every word, and so did everyone in earshot.', 'good', tal('music', 2), st('mood', 4))] },
      { label: 'Go to the dance at the church hall', outcomes: [any('Somebody\'s cousin had a guitar, and the vicar left early.', 'good', tal('dance', 3), st('charm', 1))] },
      { label: 'Agree with your parents', outcomes: [any('They were delighted. Your friends were not.', 'neutral')] },
    ],
  }),
  era({
    id: 'dec_missile_crisis', years: [1962, 1962], ageRange: [8, 90],
    text: 'For thirteen days the news has been about missiles and the chance of a war that would end everything.',
    choices: [
      { label: 'Stock the cellar and wait', outcomes: [any('Tins, water, candles. Then the ships turned back, and you could breathe.', 'neutral', cash(-150), st('mood', -2))] },
      { label: 'Carry on as normal', outcomes: [any('Easier said than done, but you managed it.', 'neutral', hid('willpower', 2))] },
    ],
  }),
  era({
    id: 'dec_civil_rights', years: [1955, 1968], places: ['us'], ageRange: [14, 90],
    text: 'A march for civil rights and equal treatment under the law is coming through {city}. People you know are going.',
    choices: [
      { label: 'March', outcomes: [any('Arm in arm, singing, past people who shouted and people who joined in.', 'good', hid('karma', 4), st('mood', 3), ms('Marched for civil rights.'))] },
      { label: 'Give money to the organizers', outcomes: [any('For bus fares and lawyers. It mattered.', 'good', cash(-100), hid('karma', 2))] },
      { label: 'Stay home', outcomes: [any('You watched the reports that evening.', 'neutral')] },
    ],
  }),
  era({
    id: 'dec_moon_landing', years: [1969, 1969], ageRange: [4, 100], priority: true,
    text: 'Tonight two men are going to walk on the Moon. The whole street has crowded into the houses with a television.',
    choices: [
      { label: 'Stay up all night to watch', outcomes: [any('Gray, ghostly pictures, and a voice from a quarter of a million miles away. You will never forget it.', 'good', st('mood', 6), st('intellect', 2), ms('Watched the first people walk on the Moon.'))] },
      { label: 'Listen on the radio instead', outcomes: [any('Somehow the crackle made it more real.', 'good', st('mood', 4), ms('Heard the Moon landing as it happened.'))] },
    ],
  }),

  // ---------- The late twentieth century ----------
  era({
    id: 'dec_gas_queue', years: [1973, 1974], ageRange: [17, 90],
    text: 'The oil crisis: gas is rationed, the lines stretch for blocks, and there are signs saying "No fuel today".',
    choices: [
      { label: 'Queue from dawn', outcomes: [any('Three hours for half a tank.', 'neutral', st('mood', -2))] },
      { label: 'Get a bicycle', outcomes: [any('Your legs complained for a month and then stopped complaining.', 'good', st('health', 3), cash(-300))] },
    ],
  }),
  era({
    id: 'dec_disco', years: [1975, 1981], ageRange: [16, 35],
    text: 'There is a new club in {city} with a floor that lights up and a mirror ball the size of a car.',
    choices: [
      { label: 'Dance under the mirror ball', outcomes: [any('Platform shoes were a mistake. Everything else was not.', 'good', st('mood', 6), tal('dance', 3))] },
      { label: 'Stick with the music you know', outcomes: [any('You were not missing anything, you told yourself.', 'neutral')] },
    ],
  }),
  era({
    id: 'dec_chernobyl', years: [1986, 1986], places: EUROPE, ageRange: [10, 90],
    text: 'A nuclear reactor has exploded far to the east. The radio says a cloud is drifting across Europe, and to keep children indoors if it rains.',
    choices: [
      { label: 'Keep everyone in and the windows shut', outcomes: [any('A strange, frightened week indoors.', 'neutral', st('mood', -2))] },
      { label: 'Carry on as normal', outcomes: [any('It rained. You tried not to think about it.', 'neutral', st('mood', -1))] },
    ],
  }),
  era({
    id: 'dec_home_computer', years: [1981, 1992], ageRange: [8, 60],
    text: 'The family has bought a home computer. It plugs into the television and loads programs from a cassette, slowly, with a noise like an angry kettle.',
    choices: [
      { label: 'Teach yourself to program it', outcomes: [any('10 PRINT "HELLO". 20 GOTO 10. You were hooked.', 'good', st('intellect', 3), ms('Wrote your first computer program.'))] },
      { label: 'Play every game you can get', outcomes: [any('Hours of blocky aliens and a great deal of shouting.', 'good', st('mood', 4))] },
      { label: 'Leave it to the children', outcomes: [any('It sat on the dining table under a cloth.', 'neutral')] },
    ],
  }),
  era({
    id: 'dec_charity_concert', years: [1985, 1985], ageRange: [10, 90],
    text: 'The biggest concert anyone has ever seen is on television all day, raising money for famine relief. They keep reading out a number to call.',
    choices: [
      { label: 'Call and give', outcomes: [any('Everyone in the country seemed to be doing the same.', 'good', cash(-100), hid('karma', 3))] },
      { label: 'Watch it all the way through', outcomes: [any('Sixteen hours. You knew every word by the end.', 'good', st('mood', 4), tal('music', 1))] },
    ],
  }),
  era({
    id: 'dec_wall_falls', years: [1989, 1989], ageRange: [10, 100],
    text: 'In Berlin, people are climbing onto the Wall and hacking at it with hammers, and nobody is stopping them.',
    choices: [
      { label: 'Watch it on the news, all night', outcomes: [any('Strangers hugging on top of the Wall. History, live.', 'good', st('mood', 5), ms('Watched the Berlin Wall come down.'))] },
      { label: 'Go there and see it for yourself', outcomes: [any('You came home with a chip of painted concrete in your pocket.', 'good', cash(-800), st('mood', 7), ms('Was in Berlin the week the Wall came down.'))] },
    ],
  }),
  era({
    id: 'dec_millennium', years: [1999, 1999], ageRange: [8, 100],
    text: 'It is New Year\'s Eve, 1999. The news has spent months warning that computers may stop working at midnight.',
    choices: [
      { label: 'Throw the party of the century', outcomes: [any('Midnight came, the lights stayed on, and you saw in the year 2000 shouting with everyone you love.', 'good', cash(-300), st('mood', 7), ms('Saw in the year 2000.'))] },
      { label: 'Fill the bath and stock up on tins, just in case', outcomes: [any('Nothing happened. You ate tinned peaches for a month.', 'neutral', cash(-100))] },
    ],
  }),
];

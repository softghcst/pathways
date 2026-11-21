// Weather and other natural disasters: what can strike where, and when in the year.
//
// GAMEPLAY CONFIGURATION, simplified: each country's hazards come from data/living.js (what the land and weather can
// do there), with a few kinds added here where the climate calls for them (blizzards where winters are snowy, monsoon
// floods where the monsoon comes, cyclones in the Indian Ocean and the South Pacific, tsunamis on coasts that face a
// subduction zone, landslides in steep wet country, dust storms in the desert). Large countries vary by region: for the
// United States, each city in the game has its own list. Storm names are invented.
//
//   months    (climate, countryId) => the months it can happen (0 = January); peak months are listed twice
//   chance    how likely, in a year, that one reaches a country that has it
//   weights   how often it is [minor, major, catastrophic]
//   damage    property damage at [minor, major, catastrophic], 0–100 of condition
//   injury    the chance of being hurt, if caught in it, at each severity
//   forecast  whether it can be seen coming (storms, floods, fire): shorter turns bring a warning first
//   named     storms with names

const ALL = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const northWinter = [10, 11, 0, 0, 1, 1, 2];
const southWinter = [5, 6, 6, 7, 7, 8];
const winterOf = (climate) => (climate === 'south' ? southWinter : northWinter);
/** Wet months for each climate (calendar.js), for floods and landslides. */
const WET = {
  north: [0, 1, 2, 3, 3, 4, 9, 10, 11], south: [4, 5, 6, 7, 8], tropicNorth: [5, 6, 7, 7, 8, 8, 9], tropicSouth: [11, 0, 0, 1, 1, 2, 3],
  equator: [2, 3, 3, 4, 9, 10, 10, 11], monsoon: [5, 6, 6, 7, 7, 8], desert: [0, 1, 11],
};
const HOT = { north: [5, 6, 6, 7, 7], south: [11, 0, 0, 1, 1], tropicNorth: [2, 3, 3, 4], tropicSouth: [8, 9, 9, 10], equator: [0, 1, 7, 8], monsoon: [3, 4, 4, 5], desert: [5, 6, 6, 7, 7, 8] };
const DRY = { north: [6, 7, 7, 8], south: [0, 1, 1, 2], tropicNorth: [0, 1, 2, 3, 3], tropicSouth: [6, 7, 8, 8, 9], equator: [0, 1, 6, 7], monsoon: [1, 2, 3, 4], desert: [5, 6, 7, 8] };

export const KINDS = {
  hurricane: { name: 'hurricane', plural: 'hurricanes', named: 'Hurricane', months: () => [5, 6, 7, 7, 8, 8, 8, 9, 9, 10], chance: 0.4, weights: [0.6, 0.33, 0.07], damage: [8, 26, 55], injury: [0.02, 0.1, 0.25], forecast: true },
  typhoon: { name: 'typhoon', plural: 'typhoons', named: 'Typhoon', months: () => [5, 6, 7, 7, 8, 8, 8, 9, 9, 10], chance: 0.45, weights: [0.6, 0.33, 0.07], damage: [8, 24, 50], injury: [0.02, 0.1, 0.22], forecast: true },
  cyclone: { name: 'cyclone', plural: 'cyclones', named: 'Cyclone', months: (cl) => (cl === 'south' || cl === 'tropicSouth' ? [11, 0, 0, 1, 1, 2, 3] : [3, 4, 4, 9, 10, 10, 11]), chance: 0.35, weights: [0.6, 0.32, 0.08], damage: [8, 26, 55], injury: [0.02, 0.1, 0.25], forecast: true },
  tornado: { name: 'tornado', plural: 'tornadoes', months: () => [2, 3, 3, 4, 4, 4, 5, 5], chance: 0.3, weights: [0.7, 0.25, 0.05], damage: [10, 35, 70], injury: [0.03, 0.15, 0.3], forecast: true },
  blizzard: { name: 'blizzard', plural: 'blizzards and snowstorms', months: (cl) => winterOf(cl), chance: 0.5, weights: [0.75, 0.22, 0.03], damage: [2, 8, 18], injury: [0.01, 0.04, 0.1], forecast: true },
  winter: { name: 'hard winter', plural: 'hard winters', months: (cl) => winterOf(cl), chance: 0.12, weights: [0.7, 0.27, 0.03], damage: [0, 3, 8], injury: [0, 0.03, 0.06] },
  flood: { name: 'flood', plural: 'floods', months: (cl) => WET[cl] ?? WET.north, chance: 0.28, weights: [0.65, 0.3, 0.05], damage: [6, 22, 45], injury: [0.01, 0.05, 0.12], forecast: true },
  monsoonFlood: { name: 'monsoon flood', plural: 'monsoon floods', months: () => [6, 6, 7, 7, 8], chance: 0.5, weights: [0.55, 0.37, 0.08], damage: [6, 24, 50], injury: [0.01, 0.06, 0.15], forecast: true },
  landslide: { name: 'landslide', plural: 'landslides', months: (cl) => WET[cl] ?? WET.north, chance: 0.12, weights: [0.7, 0.25, 0.05], damage: [5, 30, 60], injury: [0.02, 0.1, 0.25] },
  wildfire: { name: 'wildfire', plural: 'wildfires', months: (cl) => DRY[cl] ?? DRY.north, chance: 0.28, weights: [0.65, 0.3, 0.05], damage: [5, 30, 65], injury: [0.01, 0.06, 0.14], forecast: true },
  heat: { name: 'heatwave', plural: 'heatwaves', months: (cl) => HOT[cl] ?? HOT.north, chance: 0.38, weights: [0.7, 0.26, 0.04], damage: [0, 0, 2], injury: [0, 0, 0], health: [-1, -3, -6] },
  drought: { name: 'drought', plural: 'droughts', months: (cl) => DRY[cl] ?? DRY.north, chance: 0.18, weights: [0.6, 0.33, 0.07], damage: [0, 0, 0], injury: [0, 0, 0], mood: [-2, -4, -7], cost: [0, 150, 400] },
  earthquake: { name: 'earthquake', plural: 'earthquakes', months: () => ALL, chance: 0.14, weights: [0.72, 0.22, 0.06], damage: [4, 30, 65], injury: [0.02, 0.15, 0.32] },
  tsunami: { name: 'tsunami', plural: 'tsunamis', months: () => ALL, chance: 0, weights: [0, 0.6, 0.4], damage: [10, 40, 80], injury: [0.05, 0.2, 0.4] },
  volcano: { name: 'eruption', plural: 'volcanic eruptions', months: () => ALL, chance: 0.05, weights: [0.7, 0.25, 0.05], damage: [3, 16, 45], injury: [0.01, 0.05, 0.15] },
  avalanche: { name: 'avalanche', plural: 'avalanches', months: (cl) => winterOf(cl), chance: 0.08, weights: [0.75, 0.22, 0.03], damage: [2, 10, 30], injury: [0.02, 0.08, 0.2] },
  duststorm: { name: 'dust storm', plural: 'dust storms', months: () => [2, 3, 3, 4, 4, 5], chance: 0.4, weights: [0.8, 0.18, 0.02], damage: [1, 4, 10], injury: [0, 0.01, 0.03], health: [-1, -2, -3] },
};
export const SEVERITY = ['minor', 'major', 'catastrophic'];

/** Countries with blizzards (snowy winters with real storms). */
const BLIZZARD = 'us ca ru ua kz mn se no fi pl cz sk at ch ee ro jp kr cn tr ir af ge de'.split(' ');
/** Countries hit by cyclones rather than hurricanes or typhoons (the Indian Ocean, Australia, the South Pacific). */
const CYCLONE = 'in bd pk au pg ws'.split(' ');
/** Coasts that face a subduction zone: a big earthquake offshore can bring a tsunami. */
export const TSUNAMI = new Set('jp id cl ph th pe ec nz mx ws pg cr'.split(' '));
const LANDSLIDE = 'np co pe ec gt ph id br in bd'.split(' ');
const DUST = 'eg sa ae kw qa iq jo dj'.split(' ');
const MONSOON = 'in pk bd np th vn'.split(' ');

/** United States cities: each has the weather of its own region. */
export const CITY_HAZARDS = {
  us: {
    'New York': ['hurricane', 'blizzard', 'flood', 'heat'],
    Chicago: ['blizzard', 'tornado', 'heat', 'flood'],
    Austin: ['tornado', 'flood', 'heat', 'wildfire'],
    Seattle: ['earthquake', 'tsunami', 'wildfire', 'flood'],
    Atlanta: ['tornado', 'hurricane', 'heat'],
    Denver: ['blizzard', 'wildfire', 'tornado'],
    Orlando: ['hurricane', 'tornado', 'heat', 'flood'],
  },
};

/** The hazards of a country, from data/living.js and the climate. `living` is the country's row there. */
export function countryHazards(countryId, living) {
  const out = new Set(living?.hazards ?? []);
  if (BLIZZARD.includes(countryId)) out.add('blizzard');
  if (CYCLONE.includes(countryId)) { out.delete('typhoon'); out.delete('hurricane'); out.add('cyclone'); }
  if (MONSOON.includes(countryId) && out.has('flood')) { out.delete('flood'); out.add('monsoonFlood'); }
  if (TSUNAMI.has(countryId) && out.has('earthquake')) out.add('tsunami');
  if (LANDSLIDE.includes(countryId)) out.add('landslide');
  if (DUST.includes(countryId)) out.add('duststorm');
  return [...out].filter((k) => KINDS[k]);
}

/** Invented storm names, one list a year, in alphabetical order through the season. */
export const STORM_NAMES = ['Adela', 'Bram', 'Cora', 'Dario', 'Edda', 'Felix', 'Gemma', 'Hollis', 'Iona', 'Jasper', 'Kerry', 'Lorne', 'Mira', 'Nolan', 'Orla', 'Pavel', 'Quinn', 'Rosa', 'Silas', 'Talia', 'Ulric', 'Vera', 'Wade', 'Yara', 'Zane'];

/** What happened, said for the place it happened. {name} is a storm's name; {where} the place. */
export const STRIKE = {
  hurricane: ['{name} brushed the coast: wind, rain and a day off school.', '{name} came ashore as a major hurricane. Roofs went, trees came down, and the power was out for a week.', '{name}, one of the strongest hurricanes on record, came ashore. Whole neighborhoods were flattened.'],
  typhoon: ['{name} passed close by: shutters rattled all night.', '{name} tore through: floods in the streets and the power out for days.', '{name}, a super typhoon, struck head-on. Whole districts were under water.'],
  cyclone: ['{name} skirted the coast with gales and heavy rain.', '{name} crossed the coast: flattened crops, broken roofs, flooded roads.', '{name}, a severe cyclone, made landfall. The storm surge swept far inland.'],
  tornado: ['A tornado touched down out of town. The sirens wailed for an hour.', 'A tornado tore through a few streets away, leaving a scar of wrecked houses a mile long.', 'A violent tornado cut straight across town. Nothing in its path was left standing.'],
  blizzard: ['A heavy snowstorm closed the schools for a couple of days.', 'A blizzard buried the city: roads closed, power lines down, a week indoors.', 'The worst blizzard in living memory: drifts to the second floor, the city cut off for days.'],
  winter: ['A long, bitter winter.', 'The hardest winter in years: frozen pipes, empty shelves, and the heating bill.', 'A brutal winter. The cold killed people who had nowhere warm to go.'],
  flood: ['The river rose over its banks, and the low streets flooded.', 'Floods swept through town. Water stood a meter deep in the streets for days.', 'Catastrophic floods: whole towns under water, and thousands rescued from rooftops.'],
  monsoonFlood: ['The monsoon rains flooded the streets for a week.', 'The monsoon brought floods: roads gone, homes under water, schools turned into shelters.', 'The worst monsoon floods in decades. Millions were driven from their homes.'],
  landslide: ['A landslide blocked the road out of town for days.', 'A hillside gave way after the rains, burying houses below it.', 'A massive landslide swept a whole village away.'],
  wildfire: ['Smoke from a wildfire in the hills hung over the city for a week.', 'A wildfire reached the edge of town. Thousands were told to leave.', 'A firestorm swept into town, faster than anyone could run. Whole streets burned.'],
  heat: ['A heat wave settled in for two weeks.', 'A dangerous heatwave: the hospitals filled with the old and the very young.', 'Record-breaking heat, weeks of it. People died in their homes.'],
  drought: ['The rains were thin this year, and the reservoirs low.', 'Drought: the taps ran a few hours a day, and food prices climbed.', 'A terrible drought. Crops failed, wells ran dry, and families left the land.'],
  earthquake: ['An earthquake rattled the windows in the night. Nobody was hurt.', 'A strong earthquake struck: cracked walls, fallen buildings, and days of aftershocks.', 'A catastrophic earthquake devastated the city. The rescue went on for weeks.'],
  tsunami: ['A small tsunami washed over the harbor wall after the earthquake.', 'After the earthquake came the sea: a tsunami swept over the coast and through the streets nearest it.', 'A great tsunami followed the earthquake, sweeping kilometers inland.'],
  volcano: ['The volcano grumbled and dusted the city with ash.', 'The volcano erupted. Ash fell for a week, and the villages on its slopes were evacuated.', 'A massive eruption: ash blotted out the sun, and towns near the mountain were lost.'],
  avalanche: ['An avalanche closed the pass for a few days.', 'An avalanche came down on the village road, burying cars and houses.', 'A huge avalanche swept through the valley, burying a village.'],
  duststorm: ['A dust storm turned the sky orange for an afternoon.', 'A great dust storm shut the airport and the roads for two days.', 'The worst dust storm in decades: the city went dark at noon.'],
};
/** After it: the scene that follows a disaster that hit home ({what} is its name). */
export const AFTERMATH = {
  storm: 'Weeks after {what}, the streets are still full of ruined furniture and the sound of hammering.',
  flood: 'The water has gone down, leaving a line of mud on every wall in the street and a smell that will not shift.',
  quake: 'The aftershocks have mostly stopped. Cracked walls, taped windows, and people still sleeping in cars, just in case.',
  fire: 'The fire is out. The hills are black, and the town smells of smoke for weeks.',
  cold: 'The snow has melted into gray heaps. Burst pipes, cars still stuck, and a lot of people who could not get to work.',
  heat: 'The heat has broken at last. The hospitals say the old and the lonely suffered most.',
  dust: 'The dust has settled on everything: cars, windowsills, the inside of every cupboard. The clinics are full of coughs.',
  dry: 'Still no proper rain. Water comes on a few hours a day, and the fields outside town are dust.',
};
export const AFTER_OF = { hurricane: 'storm', typhoon: 'storm', cyclone: 'storm', tornado: 'storm', duststorm: 'dust', flood: 'flood', monsoonFlood: 'flood', tsunami: 'flood',
  landslide: 'quake', earthquake: 'quake', volcano: 'quake', avalanche: 'cold', blizzard: 'cold', winter: 'cold', wildfire: 'fire', heat: 'heat', drought: 'dry' };

/** A disaster as news from elsewhere: {kind} is its name, {where} the country. */
export const NEWS = [
  '{Kind} in {where}: damage, but few hurt.',
  '{Kind} in {where}: thousands have lost their homes.',
  'Disaster in {where}: a catastrophic {kind}. Aid is on its way from around the world.',
];

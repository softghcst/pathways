// Neighborhoods: the kinds there are, the homes in them, the places nearby and the things neighbors do together
// (engine/neighborhood.js). A kind of neighborhood is a profile; the neighborhoods a life passes through are saved
// instances of one, with their own name, homes and people.
//
// GAMEPLAY FIGURES, NOT STATISTICS. Densities, costs and how often people move are the author's rough sense of
// ordinary life, rounded hard. A profile says what a place is like to live in: how close together the homes are, what
// is within reach, what neighbors tend to do. It never says what the people there are like. How affordable, how
// close-knit, how well kept and how well served a neighborhood is are separate measures, and none follows from
// another: a cheap street can be close-knit and well kept, and a dear one can be neither.
//
// Neighborhood names are made up. They read as translations ("the Old Town", "Riverside") and are not real places.

/**
 * from      the first year anywhere has one
 * fromWhere a later first year in some countries (suburbs came at different times in different places)
 * homes     [type, weight]: what the homes on a street or in a building are
 * block     'street' (houses side by side), 'building' (flats on floors), 'lane' (homes far apart)
 * size      how many homes the player's own street or building holds
 * events    how many community events a year, on average
 * cost      what living there costs against the city as a whole (rent and prices)
 * gauge     the neighborhood's own measures, 0-100, before each instance varies them: parks, transit, amenities,
 *           cohesion (how much neighbors do together), upkeep. Affordability follows from cost.
 */
export const PROFILES = {
  downtown: { name: 'Downtown', density: 'very high', from: 1800, block: 'building', size: [12, 15], homes: [['apartment', 8], ['condo', 3], ['shared', 2]],
    events: 1.2, cost: 1.35, gauge: { parks: 35, transit: 90, amenities: 92, cohesion: 35, upkeep: 60 }, moving: 1.4,
    venues: ['cafe', 'restaurant', 'grocery', 'bookshop', 'barber', 'gym', 'cinema', 'bar', 'laundromat', 'pharmacy'] },
  urban: { name: 'Residential urban', density: 'high', from: 1800, block: 'building', size: [9, 12], homes: [['apartment', 7], ['townhouse', 2], ['duplex', 1]],
    events: 1.5, cost: 1.1, gauge: { parks: 50, transit: 80, amenities: 75, cohesion: 50, upkeep: 60 }, moving: 1.15,
    venues: ['cafe', 'grocery', 'bakery', 'barber', 'corner', 'pharmacy', 'playground', 'library', 'laundromat'] },
  apartments: { name: 'Apartment district', density: 'high', from: 1880, block: 'building', size: [12, 15], homes: [['apartment', 10], ['shared', 2]],
    events: 1.2, cost: 0.9, gauge: { parks: 45, transit: 70, amenities: 60, cohesion: 45, upkeep: 50 }, moving: 1.25,
    venues: ['grocery', 'corner', 'laundromat', 'playground', 'community', 'barber', 'market'] },
  suburban: { name: 'Suburban residential', density: 'low', from: 1950, fromWhere: { us: 1920, ca: 1925, au: 1925, nz: 1930, uk: 1930 }, block: 'street', size: [7, 9],
    homes: [['house', 9], ['townhouse', 2], ['duplex', 1]], events: 2, cost: 1.0, gauge: { parks: 70, transit: 35, amenities: 45, cohesion: 55, upkeep: 70 }, moving: 0.8,
    venues: ['grocery', 'playground', 'park', 'school', 'community', 'cafe', 'hardware'] },
  smalltown: { name: 'Small-town residential', density: 'medium', from: 1800, block: 'street', size: [6, 8], homes: [['house', 8], ['duplex', 1], ['apartment', 1]],
    events: 2.2, cost: 0.75, gauge: { parks: 60, transit: 25, amenities: 40, cohesion: 70, upkeep: 60 }, moving: 0.7,
    venues: ['grocery', 'bakery', 'market', 'barber', 'church', 'playground', 'library', 'hardware'] },
  rural: { name: 'Rural community', density: 'very low', from: 1800, block: 'lane', size: [5, 6], homes: [['rural', 9], ['house', 2]],
    events: 1.6, cost: 0.6, gauge: { parks: 85, transit: 10, amenities: 15, cohesion: 70, upkeep: 55 }, moving: 0.5,
    venues: ['market', 'corner', 'church', 'community'] },
  university: { name: 'University district', density: 'high', from: 1880, block: 'building', size: [10, 13], homes: [['student', 5], ['shared', 4], ['apartment', 3]],
    events: 1.8, cost: 0.95, gauge: { parks: 55, transit: 70, amenities: 70, cohesion: 45, upkeep: 50 }, moving: 2.2,
    venues: ['cafe', 'bookshop', 'library', 'bar', 'laundromat', 'restaurant', 'gym'] },
  mixed: { name: 'Mixed-use neighborhood', density: 'high', from: 1800, block: 'building', size: [9, 12], homes: [['apartment', 6], ['townhouse', 2], ['duplex', 1]],
    events: 1.8, cost: 1.05, gauge: { parks: 45, transit: 75, amenities: 80, cohesion: 55, upkeep: 60 }, moving: 1.1,
    venues: ['cafe', 'bakery', 'restaurant', 'grocery', 'market', 'barber', 'bookshop', 'hardware', 'playground'] },
  coastal: { name: 'Coastal residential', density: 'medium', from: 1800, block: 'street', size: [6, 8], coastal: true, homes: [['house', 7], ['apartment', 2], ['townhouse', 1]],
    events: 1.8, cost: 1.2, gauge: { parks: 75, transit: 40, amenities: 55, cohesion: 55, upkeep: 65 }, moving: 0.9,
    venues: ['cafe', 'restaurant', 'grocery', 'market', 'park', 'playground'] },
  historic: { name: 'Historic district', density: 'medium', from: 1900, block: 'street', size: [7, 9], homes: [['townhouse', 6], ['house', 3], ['apartment', 2]],
    events: 1.8, cost: 1.3, gauge: { parks: 55, transit: 65, amenities: 70, cohesion: 60, upkeep: 75 }, moving: 0.7,
    venues: ['cafe', 'bookshop', 'bakery', 'restaurant', 'library', 'market'] },
  gated: { name: 'Gated community', density: 'low', from: 1975, where: ['us', 'br', 'mx', 'za', 'ae', 'ar', 'ph', 'ng', 'in', 'cn', 'co', 'pe', 'cl', 'eg', 'sa', 'tr', 'id', 'my', 'th', 'ke'],
    block: 'street', size: [7, 9], homes: [['house', 8], ['townhouse', 2]], events: 1.5, cost: 1.6, gauge: { parks: 70, transit: 20, amenities: 40, cohesion: 45, upkeep: 85 }, moving: 0.7,
    venues: ['gym', 'playground', 'community', 'cafe'] },
};

/** The kinds of home. `floors`: lives on a floor of a building. `owned`: usually owned by whoever lives there. */
export const HOME_TYPES = {
  house: { name: 'House', from: 1800 },
  townhouse: { name: 'Townhouse', from: 1800 },
  duplex: { name: 'Duplex', from: 1880, nameWhere: { uk: 'Semi-detached house', ie: 'Semi-detached house', au: 'Semi-detached house', nz: 'Semi-detached house' } },
  apartment: { name: 'Apartment', from: 1800, floors: true, nameWhere: { uk: 'Flat', ie: 'Flat' } },
  condo: { name: 'Condominium', from: 1965, floors: true, nameWhere: { uk: 'Leasehold flat', ie: 'Flat' } },
  shared: { name: 'Shared flat', from: 1800, floors: true },
  student: { name: 'Student room', from: 1880, floors: true },
  rural: { name: 'Country home', from: 1800 },
  trailer: { name: 'Mobile home', from: 1950 },
};
/** Which home type a property the player buys is (data/properties.js). */
export const PROPERTY_HOME = { trailer: 'trailer', studio: 'apartment', condo: 'condo', house: 'house', townhouse: 'townhouse', country: 'rural', mansion: 'house' };
/** And which kinds of neighborhood it can stand in, best first. */
export const PROPERTY_HOODS = {
  trailer: ['rural', 'smalltown'], studio: ['downtown', 'urban', 'apartments', 'mixed'], condo: ['urban', 'downtown', 'mixed', 'apartments'],
  house: ['suburban', 'smalltown', 'coastal', 'historic'], townhouse: ['historic', 'urban', 'mixed'], country: ['rural'], mansion: ['gated', 'historic', 'suburban', 'coastal'],
};

/**
 * Places within reach. `from`/`until`: the years one can exist (a launderette needs washing machines, a video shop
 * needs videotape). `kid`: somewhere a child can go. `work`: a part-time job a neighbor can mention (data/partTimeJobs.js).
 */
export const VENUES = {
  cafe: { name: 'Café', names: ['The Corner Café', 'Café on the Square', 'The Little Coffee House', 'Morning Café'], from: 1800, work: 'barista' },
  restaurant: { name: 'Restaurant', names: ['The Olive Tree', 'Golden Lantern', 'The Kitchen Table', 'Riverside Grill'], from: 1800, work: 'waiter' },
  bakery: { name: 'Bakery', names: ['The Bread Basket', 'Early Rise Bakery', 'The Village Bakery'], from: 1800, kid: true, work: 'shop' },
  grocery: { name: 'Grocery', names: ['Fresh Market', 'The Corner Grocer', 'Daily Greens', 'Neighborhood Grocery'], from: 1800, kid: true, work: 'shop' },
  corner: { name: 'Corner store', names: ['The Corner Store', 'Open All Hours', 'The General Store'], from: 1800, kid: true, work: 'shop' },
  bookshop: { name: 'Bookshop', names: ['Chapter & Verse', 'The Reading Room', 'Second Story Books'], from: 1800, kid: true, work: 'shop' },
  barber: { name: 'Barber and salon', names: ['Sharp Edge', 'The Salon on Main', 'Clip Joint'], from: 1800 },
  market: { name: 'Market', names: ['The Saturday Market', 'Market Square', 'The Covered Market'], from: 1800, kid: true, work: 'shop' },
  hardware: { name: 'Hardware store', names: ['Nuts & Bolts', 'The Tool Shed', 'Fix-It Hardware'], from: 1850, work: 'shop' },
  pharmacy: { name: 'Pharmacy', names: ['Green Cross Pharmacy', 'Corner Drugstore', 'Main Street Pharmacy'], from: 1850 },
  laundromat: { name: 'Laundromat', names: ['Spin Cycle', 'Suds', 'The Wash House'], from: 1940 },
  gym: { name: 'Gym', names: ['Iron House', 'The Fitness Club', 'Peak Gym'], from: 1950 },
  cinema: { name: 'Movie theater', names: ['The Majestic', 'The Picture House', 'The Regal'], from: 1910, kid: true },
  bar: { name: 'Bar', names: ['The Crown', 'The Local', 'Blue Door'], from: 1800, adult: true, work: 'waiter' },
  library: { name: 'Library', names: ['The Public Library', 'Branch Library'], from: 1850, kid: true, public: true },
  playground: { name: 'Playground', names: ['The Playground', 'Adventure Playground'], from: 1900, kid: true, public: true },
  park: { name: 'Park', names: ['The Park', 'Memorial Park', 'The Green'], from: 1800, kid: true, public: true },
  community: { name: 'Community center', names: ['The Community Center', 'Neighborhood Hall', 'The Civic Hall'], from: 1930, kid: true, public: true },
  church: { name: 'Meeting hall', names: ['The Old Hall', 'The Parish Hall', 'The Assembly Rooms'], from: 1800, kid: true, public: true },
  school: { name: 'School', names: ['The Local School'], from: 1870, kid: true, public: true },
  shop: { name: 'Shop', names: ['The Little Shop', 'Odds & Ends', 'The Village Store'], from: 1800, kid: true, work: 'shop' },
  video: { name: 'Video rental shop', names: ['Rewind Video', 'Movie Corner'], from: 1980, until: 2012, kid: true, work: 'shop' },
  netcafe: { name: 'Internet café', names: ['Byte Café', 'Net Corner'], from: 1995, until: 2015, work: 'shop' },
};

/**
 * Things neighbors do together. `who`: 'all' ages, 'adult', or 'kids'. `blocks`: the kinds of block it belongs to.
 * `where`: countries where it is the usual form (a block party in the United States, a street party in Britain);
 * elsewhere `name` is used. `from`: the year it is first possible.
 */
export const COMMUNITY_EVENTS = {
  welcome: { name: 'Welcome gathering', who: 'all', text: 'a get-together to welcome the newest households' },
  picnic: { name: 'Community picnic', who: 'all', text: 'a picnic in the park, everyone bringing something' },
  street_party: { name: 'Neighborhood festival', who: 'all', blocks: ['street', 'lane'], names: { us: 'Block party', ca: 'Block party', uk: 'Street party', ie: 'Street party', au: 'Street party', nz: 'Street party' },
    text: 'a party in the street, with tables pushed together and music from somebody\'s window' },
  sale: { name: 'Neighborhood sale', who: 'all', names: { us: 'Yard sale', ca: 'Garage sale', au: 'Garage sale', uk: 'Street sale' }, text: 'a sale of everything people no longer need, laid out in front of the houses' },
  cleanup: { name: 'Community cleanup', who: 'all', text: 'a morning of picking up litter and clearing the shared spaces' },
  fundraiser: { name: 'Charity fundraiser', who: 'all', text: 'a fundraiser for a local cause, with cakes and a raffle' },
  holiday: { name: 'Holiday gathering', who: 'all', text: 'a gathering for the holidays, with food and lights' },
  sports_day: { name: 'Neighborhood sports day', who: 'all', from: 1880, text: 'races, games and a tug of war' },
  meeting: { name: 'Community meeting', who: 'adult', text: 'a meeting about the neighborhood: the roads, the park and what people want changed' },
  festival: { name: 'Local festival', who: 'all', text: 'the local festival, with stalls, music and half the town out' },
  building: { name: 'Building gathering', who: 'all', blocks: ['building'], text: 'drinks and snacks in the shared courtyard of the building' },
  harvest: { name: 'Harvest supper', who: 'all', profiles: ['rural', 'smalltown'], text: 'a harvest supper in the hall, with long tables' },
};

/** What a player can host. cost: base units, paid once. */
export const HOSTED = {
  dinner: { name: 'Dinner party', cost: 120, max: 6, minAge: 18 },
  barbecue: { name: 'Neighborhood barbecue', cost: 200, max: 10, minAge: 18, blocks: ['street', 'lane'] },
  housewarming: { name: 'Housewarming', cost: 150, max: 10, minAge: 18, fresh: true },
  holiday: { name: 'Holiday gathering', cost: 160, max: 10, minAge: 18 },
  birthday: { name: 'Birthday party', cost: 80, max: 8, minAge: 5 },
  fundraiser: { name: 'Community fundraiser', cost: 100, max: 12, minAge: 16 },
};

/** Things neighbors fall out over, and the shared things they are about. Never more than an ordinary disagreement. */
export const DISAGREEMENTS = {
  noise: { name: 'Noise', text: 'the noise from {who}\'s place late at night' },
  parking: { name: 'Parking', text: 'where {who} parks', from: 1925, blocks: ['street', 'lane'] },
  boundary: { name: 'A boundary', text: 'the line between your yard and {who}\'s', blocks: ['street', 'lane'] },
  pet: { name: 'A pet', text: '{who}\'s dog barking through the day', pet: true },
  shared: { name: 'A shared space', text: 'how {who} leaves the shared hallway and bins', blocks: ['building'] },
  rules: { name: 'The building rules', text: 'whether {who} is allowed to keep bikes in the stairwell', blocks: ['building'] },
};

/** What neighbors are into: shared interests make friends. `from`: the year it exists. */
export const INTERESTS = [['gardening', 'gardening'], ['cooking', 'cooking'], ['music', 'music'], ['books', 'books'], ['sport', 'sport'], ['animals', 'animals'],
  ['history', 'local history'], ['crafts', 'making things'], ['film', 'films', 1910], ['games', 'video games', 1980], ['cycling', 'cycling', 1890], ['chess', 'chess']];

/** Names, as translations of ordinary descriptions. Never real addresses. */
export const HOOD_NAMES = {
  first: ['Willow', 'Linden', 'Oak', 'Ash', 'Cedar', 'Maple', 'Birch', 'Elm', 'Rowan', 'Holly', 'Laurel', 'Hazel', 'Juniper', 'Chestnut'],
  urban: ['the Old Town', 'the Station Quarter', 'Northgate', 'Southgate', 'the Market Quarter', 'Canal Side', 'the Mill District', 'Eastbank', 'Westbank', 'the Harbor Quarter', 'Hillside', 'Riverside'],
  suffix: ['Park', 'Heights', 'Gardens', 'Grove', 'Meadows', 'Hill', 'Fields', 'Green'],
  rural: ['Long Meadow', 'Stony Ford', 'Three Oaks', 'Brook End', 'High Fields', 'Mill Hollow'],
  university: ['the University Quarter', 'College Hill', 'Scholars\' Row'],
  coastal: ['Seaview', 'Harbor Point', 'Shell Bay', 'The Strand', 'Lighthouse Hill'],
  historic: ['the Old Quarter', 'Cathedral Close', 'Merchants\' Row', 'the Old Walls'],
};
export const BUILDING_NAMES = ['{street} Court', 'The {tree} Apartments', '{street} House', 'The {tree} Building', '{n} {street}'];
export const LANDLORDS = ['Harrow Lettings', 'Cityside Homes', 'North Star Property', 'Greenleaf Housing', 'The Housing Cooperative', 'Brightwater Estates'];

/** How a household ends up on a street. */
export const SHAPES = [
  ['family', 25], ['couple', 15], ['single', 18], ['retired', 12], ['singleParent', 9], ['roommates', 8], ['multigen', 7], ['elder', 6],
];
/** Why people move. Each is chosen to fit who is moving. */
export const MOVE_REASONS = {
  job: 'for a new job', family: 'to be nearer family', space: 'to somewhere with more room', smaller: 'to somewhere smaller',
  retire: 'to retire somewhere quieter', study: 'to study', cost: 'to somewhere cheaper', like: 'because they wanted a change', together: 'to move in with a partner',
};

/**
 * How people mostly live, by country: in much of the world a city family lives in a flat, not a house with a yard.
 * GAMEPLAY GROUPING from general knowledge, rounded hard: `flats` countries weigh apartments over houses in towns and
 * cities; elsewhere the profiles stand as written.
 */
export const FLAT_COUNTRIES = ['jp', 'kr', 'cn', 'tw', 'sg', 'es', 'it', 'pt', 'gr', 'ru', 'ua', 'pl', 'cz', 'hu', 'ro', 'bg', 'rs', 'hr', 'ar', 'br', 'cl', 'eg', 'tr', 'il', 'ir', 'ae', 'sa', 'qa', 'kw', 'fr', 'de', 'at', 'ch', 'se', 'fi', 'dk', 'no'];
/** Local names for kinds of home, beside HOME_TYPES.nameWhere. */
export const HOME_NAMES = { townhouse: { uk: 'Terraced house', ie: 'Terraced house', au: 'Terrace house', nz: 'Terrace house' } };
/** Step-free homes and places become usual as access laws and new building do (gameplay figures). */
export const STEP_FREE = { home: [[1990, 0.4], [1960, 0.2], [0, 0.1]], groundFloor: 0.6, lift: [[1990, 0.85], [1950, 0.5], [1900, 0.15]], venue: [[1995, 0.8], [1970, 0.45], [0, 0.2]] };
/** What goes wrong in a building, for residents to sort out together. */
export const BUILDING_ISSUES = { lift: { text: 'the lift has been out of order for three weeks', needs: 'lift' }, heating: { text: 'the heating keeps failing on the top floors', from: 1900 },
  damp: { text: 'damp is coming through the walls on the north side' }, bins: { text: 'the bin store is overflowing and nobody is collecting' }, door: { text: 'the front door lock is broken and anyone can walk in' } };
/** Shared spaces neighbors improve together. */
export const PROJECTS = ['turn the empty lot into a community garden', 'repaint and repair the playground', 'plant trees along the street', 'fix up the old hall for clubs and meetings', 'put benches and lights in the little park'];
/** Which of the player's own businesses open their doors on the street, as a local place (data/business.js types). */
export const BUSINESS_VENUE = { cafe: 'cafe', restaurant: 'restaurant', bakery: 'bakery', bar: 'bar', shop: 'shop', boutique: 'shop', bookshop: 'bookshop', salon: 'barber' };

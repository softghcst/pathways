// Crimes, lawyers, prison gangs and the numbers behind the justice system.
// Money is in base units; sentences are in years.
//
// What each crime is in law (its classification and the sanctions a court may
// give) is in data/justice.js, through `offense`.
//
// A crime succeeds on a skill check: base chance plus weighted stats (each
// centered on 50). Karma works as luck. On failure, `caught` is the chance the
// police have you there and then. Getting away adds `heat`, and unsolved
// crimes can catch up with you later.
export const CRIMES = [
  { id: 'shoplift', offense: 'shoplifting', name: 'Shoplift', minAge: 8, base: 0.65,
    factors: { 'talents.crime': 0.6, 'stats.charm': 0.15, 'hidden.karma': 0.2 },
    loot: [10, 150], heat: 5, caught: 0.45, karma: -3,
    done: 'You walk out with it under your coat.', failed: 'A hand lands on your shoulder at the door.' },
  { id: 'pickpocket', offense: 'theft', name: 'Pick a pocket', minAge: 8, base: 0.55,
    factors: { 'talents.crime': 0.7, 'stats.charm': 0.1, 'hidden.karma': 0.2 },
    loot: [20, 400], heat: 6, caught: 0.5, karma: -4,
    done: 'The wallet is in your pocket before they reach the corner.', failed: 'They feel your hand and turn round.' },
  { id: 'vandalism', offense: 'criminal_damage', name: 'Spray a wall', minAge: 10, base: 0.7,
    factors: { 'talents.crime': 0.5, 'hidden.karma': 0.2 },
    loot: [0, 0], heat: 4, caught: 0.4, karma: -2, mood: 5,
    done: 'Your name is eight feet tall on the side of the bus depot.', failed: 'A torch beam finds you with the can still in your hand.' },
  { id: 'bike_theft', offense: 'theft', name: 'Steal a bike', minAge: 11, base: 0.55,
    factors: { 'talents.crime': 0.65, 'hidden.karma': 0.2 },
    loot: [60, 900], heat: 7, caught: 0.45, karma: -4,
    done: 'The lock gives up in seconds. You ride it away and sell it the same afternoon.', failed: 'The owner comes out of the shop while you are still working on the lock.' },
  { id: 'burglary', offense: 'burglary', name: 'Burgle a house', minAge: 14, base: 0.45,
    factors: { 'talents.crime': 0.6, 'stats.intellect': 0.3, 'hidden.karma': 0.2 },
    loot: [600, 9000], heat: 18, caught: 0.55, karma: -8,
    done: 'In through a back window, out with a full bag.', failed: 'A light comes on upstairs, and then a siren.' },
  { id: 'mugging', offense: 'robbery', name: 'Mug someone', minAge: 16, base: 0.45,
    factors: { 'talents.crime': 0.55, 'stats.health': 0.25, 'hidden.karma': 0.2 },
    loot: [80, 1800], heat: 20, caught: 0.55, karma: -10, danger: 0.08,
    done: 'They hand it all over without a word. You are around the corner before they breathe out.', failed: 'They fight back, loudly, and people come running.' },
  { id: 'car_theft', offense: 'vehicle_theft', name: 'Steal a car', minAge: 16, base: 0.4,
    factors: { 'talents.crime': 0.65, 'stats.intellect': 0.2, 'hidden.karma': 0.2 },
    loot: [2500, 30000], heat: 22, caught: 0.6, karma: -8,
    done: 'You drive it straight to a man who asks no questions and pays in cash.', failed: 'The alarm goes, the steering locks, and a patrol car turns into the street.' },
  { id: 'fraud', offense: 'fraud', name: 'Run a scam', minAge: 18, base: 0.4,
    factors: { 'stats.intellect': 0.6, 'stats.charm': 0.4, 'talents.crime': 0.3, 'hidden.karma': 0.15 },
    loot: [3000, 80000], heat: 16, caught: 0.35, karma: -10,
    done: 'An investment opportunity, a nice suit, and a bank account that closes on Friday.', failed: 'One of your investors turns out to be a retired detective with time on her hands.' },
  { id: 'bank_robbery', offense: 'armed_robbery', name: 'Rob a bank', minAge: 18, base: 0.18,
    factors: { 'talents.crime': 0.6, 'stats.intellect': 0.35, 'hidden.karma': 0.25 },
    loot: [30000, 500000], heat: 55, caught: 0.8, karma: -15, danger: 0.12,
    done: 'Ninety seconds, in and out. Nobody is hurt, and the bag is heavy.', failed: 'The silent alarm was not silent to the police.' },
  { id: 'murder', offense: 'homicide', name: 'Kill someone', minAge: 16, base: 0.3, target: true,
    factors: { 'talents.crime': 0.5, 'stats.intellect': 0.35, 'hidden.karma': 0.25 },
    loot: [0, 0], heat: 70, caught: 0.75, karma: -40,
    done: 'Nobody saw you.', failed: 'It goes wrong. There are witnesses, and they have your face.' },
];

/**
 * Strangers who might be chosen as a victim. A few are offered at a time.
 * guard: how much harder they are to get to (taken off the chance of success).
 * heat: extra police attention afterward. loot: what they were carrying.
 */
export const STRANGERS = [
  { id: 'rodeo_clown', name: 'a rodeo clown', guard: 0.05 },
  { id: 'traffic_warden', name: 'a traffic warden', guard: 0 },
  { id: 'mime', name: 'a mime', guard: -0.05 },
  { id: 'telemarketer', name: 'a telemarketer', guard: -0.05 },
  { id: 'leaf_blower', name: 'a neighbor with a leaf blower', guard: 0 },
  { id: 'food_critic', name: 'a food critic', guard: 0 },
  { id: 'landlord', name: 'a landlord', guard: 0, loot: [200, 3000] },
  { id: 'influencer', name: 'an influencer mid-livestream', guard: 0.1, heat: 15 },
  { id: 'hedge_fund', name: 'a hedge-fund manager', guard: 0.1, loot: [1000, 20000] },
  { id: 'billionaire', name: 'a billionaire', guard: 0.25, heat: 20, loot: [5000, 100000] },
  { id: 'politician', name: 'a politician', guard: 0.2, heat: 25 },
  { id: 'judge', name: 'a judge', guard: 0.15, heat: 25 },
  { id: 'police_officer', name: 'a police officer', guard: 0.2, heat: 30 },
  { id: 'gang_boss', name: 'a gang boss', guard: 0.25, loot: [2000, 40000] },
  { id: 'referee', name: 'a football referee', guard: 0 },
  { id: 'karaoke_host', name: 'a karaoke host', guard: -0.05 },
  { id: 'mall_santa', name: 'a shopping-center Santa', guard: 0 },
  { id: 'strongman', name: 'a circus strongman', guard: 0.3 },
  { id: 'street_magician', name: 'a street magician', guard: 0.05 },
  { id: 'celebrity_chef', name: 'a celebrity chef', guard: 0.1, heat: 15 },
  { id: 'tax_inspector', name: 'a tax inspector', guard: 0.05 },
  { id: 'door_salesman', name: 'a door-to-door salesman', guard: 0 },
  { id: 'yoga_teacher', name: 'a yoga teacher', guard: 0 },
  { id: 'bagpiper', name: 'a bagpiper', guard: 0 },
  { id: 'wedding_dj', name: 'a wedding DJ', guard: 0 },
  { id: 'crypto_guru', name: 'a man who will not stop talking about crypto', guard: -0.05, loot: [0, 5000] },
  { id: 'ex_teacher', name: 'the teacher who gave you detention', guard: 0 },
  { id: 'lifeguard', name: 'a lifeguard', guard: 0.1 },
];

/**
 * Ways of doing it, some in earnest and some not. edge: change to the chance
 * of success. caught: change to the chance of being caught if it fails.
 * needs: a condition path that must be true. done: what happened; {v} is the victim.
 */
export const METHODS = [
  { id: 'gun', name: 'With a gun', edge: 0.18, caught: 0.15, blurb: 'Reliable, and heard three streets away.',
    done: 'One shot. {v} is dead before the echo comes back.' },
  { id: 'knife', name: 'With a knife', edge: 0.05, caught: 0.05, blurb: 'Quiet, close, and messy.',
    done: 'It is quick and it is close. {v} is dead.' },
  { id: 'machete', name: 'With a machete', edge: 0.1, caught: 0.15, blurb: 'Hard to hide on the bus home.',
    done: 'One swing. {v} is dead, and you will never get that coat clean.' },
  { id: 'poison', name: 'With poison', edge: 0, caught: -0.25, blurb: 'Slow and patient. Rarely traced.',
    done: 'A cup of tea, and a long wait. {v} does not wake up.' },
  { id: 'stairs', name: 'A push down the stairs', edge: -0.05, caught: -0.2, blurb: 'It might pass for an accident.',
    done: 'A shove at the top of a long flight. {v} is dead at the bottom of it.' },
  { id: 'car', name: 'Run them over', edge: 0.1, caught: 0.1, needs: 'ownsVehicle', blurb: 'You will need a vehicle, and a panel beater.',
    done: 'You do not brake. {v} is dead in the road behind you.' },
  { id: 'bare_hands', name: 'With your bare hands', edge: -0.1, caught: 0, blurb: 'Depends entirely on how strong you are.',
    done: 'It takes far longer than it does in films. {v} is dead.' },
  { id: 'wedgie', name: 'An atomic wedgie', edge: -0.15, caught: -0.05, blurb: 'Almost never fatal. Almost.',
    done: 'You pull with everything you have. Something gives. Against all medical opinion, {v} is dead.' },
  { id: 'piano', name: 'Drop a piano on them', edge: -0.1, caught: 0.05, blurb: 'Timing is everything.',
    done: 'Four floors, one grand piano, one chord nobody has heard before. {v} is dead.' },
  { id: 'tickle', name: 'Tickle them to death', edge: -0.2, caught: -0.1, blurb: 'Medically doubtful.',
    done: '{v} laughs for eleven minutes, and then stops. Dead, and smiling.' },
  { id: 'boredom', name: 'Bore them to death with holiday photos', edge: -0.2, caught: -0.3, blurb: 'Nobody has ever been convicted of it.',
    done: 'Somewhere around slide four hundred, {v} simply gives up. Dead of boredom.' },
  { id: 'geese', name: 'With trained geese', edge: -0.15, caught: -0.15, blurb: 'The geese cannot be made to testify.',
    done: 'You give the signal. The geese know what to do. {v} is dead, and the park is very quiet.' },
  { id: 'cake', name: 'An exploding birthday cake', edge: -0.05, caught: 0.1, blurb: 'Festive.',
    done: '"Make a wish," you say, from a safe distance. {v} is dead, and there is icing on the ceiling.' },
  { id: 'banana', name: 'A banana skin at the top of the stairs', edge: -0.15, caught: -0.3, blurb: 'A classic for a reason.',
    done: 'A skid, a yell, a great many stairs. {v} is dead, and the banana is the only witness.' },
  { id: 'frozen_turkey', name: 'With a frozen turkey', edge: -0.05, caught: -0.2, blurb: 'Then you roast the evidence.',
    done: 'Six kilos, frozen solid, swung hard. {v} is dead. The turkey is delicious.' },
  { id: 'anvil', name: 'An anvil, from a great height', edge: -0.12, caught: 0, blurb: 'You have seen it done in cartoons.',
    done: 'It whistles on the way down, just like on television. {v} is dead.' },
];
export const METHOD_BY_ID = Object.fromEntries(METHODS.map((m) => [m.id, m]));
export const CRIME_BY_ID = Object.fromEntries(CRIMES.map((c) => [c.id, c]));

/**
 * Kinds of defense. Each lawyer is a person who stays in the world
 * (engine/cases.js); skill here is where a lawyer of that kind starts, 0–100.
 * cost is base units. aid: paid for by the state for those who qualify.
 */
export const LAWYERS = [
  { id: 'self', name: 'Represent yourself', cost: 0, skill: null, blurb: 'Free. Courts make allowances, but not many.' },
  { id: 'public', name: 'Legal aid lawyer', cost: 0, skill: 48, aid: true, blurb: 'Paid for by the state. Capable, and carrying sixty other cases.' },
  { id: 'good', name: 'A private defense lawyer', cost: 12000, skill: 62, blurb: 'Time to read the whole file, and to argue every page of it.' },
  { id: 'star', name: 'A leading defense attorney', cost: 90000, skill: 78, blurb: 'Decades of experience. Expensive, and still bound by the evidence.' },
];

/** Prison gangs. All fictional. respect: needed to be let in. */
// respect: needed to be let in. perYear: respect gained each year as a member.
// conduct: what membership does to your conduct each year (default -4).
// income: what your share of the gang's business brings in each year, base units.
export const GANGS = [
  { id: 'laundry', name: 'The Laundry Crew', respect: 10, perYear: 2, conduct: -1, blurb: 'Fixers and favor-traders. Harmless, mostly.' },
  { id: 'chapel', name: 'The Chapel', respect: 15, perYear: 3, conduct: 2, blurb: 'Bible study, choir practice, and nobody touches their members.' },
  { id: 'row', name: 'The Row', respect: 25, perYear: 4, blurb: 'Old-timers who run the kitchen and the phones.' },
  { id: 'bookkeepers', name: 'The Bookkeepers', respect: 35, perYear: 5, income: 900, blurb: 'Run every card game and every bet on the block.' },
  { id: 'north', name: 'Northside', respect: 45, perYear: 7, blurb: 'Loud, loyal, and always in a dispute.' },
  { id: 'iron', name: 'The Iron Yard', respect: 55, perYear: 9, conduct: -5, health: 2, blurb: 'Own the weights. You will be very strong, and very bruised.' },
  { id: 'quiet', name: 'The Quiet Ones', respect: 65, perYear: 10, income: 1500, blurb: 'Nobody sees them do anything. Nothing happens without them.' },
  { id: 'firm', name: 'The Old Firm', respect: 80, perYear: 13, conduct: -7, income: 5000, blurb: 'Run things outside from inside. Parole boards know every name.' },
];


/** Sentences longer than this are life. */
export const LIFE_SENTENCE = 50;
/** Extra years for an escape that fails, and for being recaptured. */
export const ESCAPE_PENALTY = 2;
export const RECAPTURE_PENALTY = 5;

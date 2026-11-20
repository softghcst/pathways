// Fame and the entertainment world: who can know a person, through what, from
// when, and the fictional organizations, award bodies and media outlets of the
// game. Every name here is invented. GAMEPLAY CONFIGURATION: fees and audience
// sizes are in base units and stylised, not industry figures.

/**
 * Audiences: groups of people who can know someone. Recognition is tracked for
 * each separately, so a stage star can be unknown to football fans.
 * weight: how much of the general public each audience is (for the headline figure).
 */
export const AUDIENCES = {
  theater: { name: 'Theater audiences', weight: 0.25 },
  film: { name: 'Film audiences', weight: 0.9 },
  tv: { name: 'Television viewers', weight: 1 },
  music: { name: 'Music listeners', weight: 0.9 },
  sports: { name: 'Sports fans', weight: 0.8 },
  literary: { name: 'Readers', weight: 0.35 },
  fashion: { name: 'Fashion followers', weight: 0.35 },
  digital: { name: 'People online', weight: 0.7 },
  public: { name: 'The general public', weight: 1 },
};

/** Which audience a career track's work reaches. */
export const AUDIENCE_OF = {
  actor: 'film', child_actor: 'tv', mt_performer: 'theater', voice: 'tv', stunts: 'film', casting: 'film', directing: 'film', production: 'film',
  screenwriting: 'film', broadcast: 'tv', singer: 'music', orchestra: 'music', music_prod: 'music', dance: 'theater', modeling: 'fashion',
  athlete: 'sports', coaching: 'sports', author: 'literary', publishing: 'literary', journalist: 'public', influencer: 'digital', social_media: 'digital',
  fine_dining: 'public', fashion_design: 'fashion', editorial: 'fashion', photography: 'public', astronaut: 'public', political_staff: 'public',
};

/**
 * When each medium exists, by game year. The game's World Clock is state.year.
 * Lives currently begin in the present day; these rules are what keep a past-era
 * life (or a test of one) from reaching film, television or the internet.
 */
export const MEDIA_ERAS = {
  stage: 1500, opera: 1600, publishing: 1450, concert: 1600, recording: 1900, film: 1910, radio: 1922, voice: 1925,
  tv: 1950, commercial: 1950, music_video: 1981, digital: 2005, streaming: 2007,
};

/** Kinds of production, what they are made by, and what they ask of a performer. */
export const PRODUCTION_KINDS = {
  film: { name: 'Film', medium: 'film', audience: 'film', org: 'studio', weeks: 10, hours: 55, verb: 'filmed' },
  tv: { name: 'Television series', medium: 'tv', audience: 'tv', org: 'network', weeks: 22, hours: 45, verb: 'filmed' },
  stage: { name: 'Stage play', medium: 'stage', audience: 'theater', org: 'theater', weeks: 30, hours: 34, verb: 'performed' },
  musical: { name: 'Musical', medium: 'stage', audience: 'theater', org: 'theater', weeks: 36, hours: 38, verb: 'performed' },
  voice: { name: 'Animation and voice work', medium: 'voice', audience: 'tv', org: 'studio', weeks: 4, hours: 20, verb: 'recorded' },
  commercial: { name: 'Commercial', medium: 'commercial', audience: 'public', org: 'studio', weeks: 1, hours: 30, verb: 'shot' },
};

/**
 * Tiers of production. reach: how far the work travels (0–1); budget: base units; fee: a principal's fee
 * (base units) at this tier, before the size of the role; field: how many people go for each role.
 */
export const TIERS = {
  community: { name: 'Community', reach: 0.05, budget: 20000, fee: 0, field: 3, stage: true, minCredits: 0 },
  student: { name: 'Student and short film', reach: 0.04, budget: 15000, fee: 400, field: 4, screen: true, minCredits: 0 },
  indie: { name: 'Independent', reach: 0.25, budget: 1500000, fee: 18000, field: 8, screen: true, minCredits: 0 },
  regional: { name: 'Regional theater', reach: 0.15, budget: 400000, fee: 22000, field: 7, stage: true, minCredits: 0 },
  touring: { name: 'Touring company', reach: 0.3, budget: 2000000, fee: 38000, field: 9, stage: true, minCredits: 1 },
  network: { name: 'Network', reach: 0.6, budget: 4000000, fee: 60000, field: 12, screen: true, minCredits: 1 },
  studio: { name: 'Studio', reach: 0.75, budget: 40000000, fee: 120000, field: 16, screen: true, minCredits: 2 },
  major_stage: { name: 'Major stage', reach: 0.5, budget: 12000000, fee: 70000, field: 14, stage: true, minCredits: 2 },
  blockbuster: { name: 'Major studio release', reach: 1, budget: 150000000, fee: 400000, field: 24, screen: true, minCredits: 3 },
};

/** The size of a part, and what it pays as a share of the tier's principal fee. */
export const ROLE_KINDS = {
  lead: { name: 'Lead', fee: 1, weight: 1, field: 1.4 },
  supporting: { name: 'Supporting', fee: 0.45, weight: 0.55, field: 1 },
  featured: { name: 'Featured', fee: 0.2, weight: 0.3, field: 0.8 },
  guest: { name: 'Guest role', fee: 0.12, weight: 0.2, field: 0.8 },
  ensemble: { name: 'Ensemble', fee: 0.25, weight: 0.15, field: 0.7 },
  understudy: { name: 'Understudy', fee: 0.3, weight: 0.1, field: 0.7 },
  swing: { name: 'Swing', fee: 0.28, weight: 0.08, field: 0.6 },
  background: { name: 'Background', fee: 0.03, weight: 0.02, field: 0.5 },
  voice_lead: { name: 'Lead voice', fee: 0.5, weight: 0.4, field: 1.2 },
  spokesperson: { name: 'On-screen spokesperson', fee: 0.6, weight: 0.1, field: 1 },
  child: { name: 'Child part', fee: 0.15, weight: 0.3, field: 1 },
  dance_ensemble: { name: 'Dance ensemble', fee: 0.22, weight: 0.08, field: 0.9 },
  choreographer: { name: 'Choreographer', fee: 0.6, weight: 0.2, field: 0.6 },
};
/** Parts judged on something other than the production's usual skills: a dance ensemble is cast on dancing. */
export const ROLE_SKILLS = { dance_ensemble: { 'talents.dance': 0.8, 'talents.singing': 0.1, 'talents.acting': 0.1 }, choreographer: { 'talents.dance': 0.85, 'stats.intellect': 0.15 } };
/** How often a musical holds an open call for its dance ensemble (its own luck, by the production). */
export const DANCE_CALL = 0.6;

/**
 * Children's parts on stage: the orphan, the youngest child, the kid who sees the ghost. Plays and musicals at
 * every level have them, and children audition against other children for them, not against grown actors.
 *   share   the chance a production of that kind has a child part
 *   ages    the ages a part is written for (children a couple of years either side may audition)
 *   field   how good the other children who turn up tend to be, by tier, and how much they vary (spread): the
 *           major stage sees the strongest children in the country; community shows take most who can do it
 *   hours   a child's hours, as a share of an adult's: shorter calls, and two children often share a part
 * A child part on the major stage needs one professional credit (a regional or touring part, say) or an agent;
 * the other tiers take a child with none. Neither needs the recognition grown actors need there.
 */
export const CHILD_PARTS = {
  share: { musical: 0.7, stage: 0.35 },
  ages: [[6, 10], [8, 12], [10, 14]],
  field: { community: 30, regional: 44, touring: 52, major_stage: 64 },
  spread: 16,
  hours: 0.45,
  characters: ['the orphan who runs away', 'the youngest child', 'the boy who sees the ghost', 'a street kid with a plan', 'the girl who reads everything',
    'the prince as a boy', 'the heroine as a child', 'a choir child', 'the twin who lies', 'the kid next door'],
};

/** Which parts each kind of production casts, and what each part asks for (skill paths and weights). */
export const ROLES_FOR = {
  film: ['lead', 'supporting', 'supporting', 'featured', 'background'],
  tv: ['lead', 'supporting', 'supporting', 'guest', 'featured'],
  stage: ['lead', 'supporting', 'supporting', 'understudy', 'featured'],
  musical: ['lead', 'supporting', 'ensemble', 'ensemble', 'understudy', 'swing'],
  voice: ['voice_lead', 'supporting'],
  commercial: ['spokesperson'],
};
export const SKILLS_FOR = {
  film: { 'talents.acting': 1 }, tv: { 'talents.acting': 1 }, stage: { 'talents.acting': 0.85, 'stats.charm': 0.15 },
  musical: { 'talents.acting': 0.35, 'talents.singing': 0.4, 'talents.dance': 0.25 }, voice: { 'talents.acting': 0.6, 'talents.singing': 0.15, 'stats.charm': 0.25 },
  commercial: { 'stats.charm': 0.6, 'talents.acting': 0.4 },
};

/** Organizations: what each kind is called. {C} city, {S} surname, {W} word. */
export const ORG_NAMES = {
  studio: ['{W} Pictures', '{W} Films', '{S} Brothers Pictures', '{C} Film Company', '{W} Studios'],
  network: ['{W} Television', 'Channel {N}', '{C} Broadcasting', '{W} Network'],
  theater: ['The {C} Playhouse', '{W} Theater Company', 'The {S} Theater', '{C} Repertory Company', 'The {W} Stage'],
  community: ['{C} Community Players', 'The {C} Amateur Dramatic Society', '{W} Little Theater'],
  agency: ['{S} Talent', '{W} Artists Agency', '{S} & {S2} Management', '{C} Talent Group'],
  outlet: ['The {C} {M}', '{W} {M}', 'Spotlight {M}', 'The {M}'],
};
export const ORG_WORDS = ['Silver Gate', 'Lantern', 'Meridian', 'Harbor Light', 'Bluebird', 'Crescent', 'Northwind', 'Marquee', 'Velvet Rope', 'Starling', 'Paper Moon', 'Ember'];
export const OUTLET_WORDS = ['Herald', 'Gazette', 'Screen Weekly', 'Stage Door', 'Courier', 'Spotlight', 'Review', 'Chronicle'];

/** Words for fictional titles: "{A} {B}", "The {B} of {C}", and others. Original, invented combinations. */
/**
 * How hard the stage is. Broadway, the West End and the rest are among the hardest jobs in the arts to get: open calls
 * draw hundreds, and the people cast have usually done it before, elsewhere.
 *   bar        how much stronger the best of the other auditioners is, by tier, for plays and musicals
 *   crowd      how many more of them turn up (a multiple of the tier's field), by tier
 *   training   what a degree shows in the audition room (points), and to a company hiring for its season (odds):
 *              conservatory training (a BFA) shows; a broad degree with performance classes (a BA) a little
 *   company    a major-stage company hiring for its season (data/careers.js mt_performer): the bar it judges
 *              auditions against (55 elsewhere), the extra crowd, and the credits it wants unless you have an agent
 *   agents     what agents see in training: a BFA, and a showcase they were invited to
 */
export const STAGE_BAR = {
  bar: { touring: 3, major_stage: 12 },
  crowd: { major_stage: 1.5 },
  training: { bfa: { audition: 5, company: 0.12 }, ba: { audition: 2, company: 0.05 } },
  company: { need: 78, crowd: 0.2, credits: 2 },
  agents: { bfa: 10, ba: 4, showcase: 6 },
};

/**
 * The real theater districts where a country's major-stage theaters stand: places, named as places. The theaters in
 * them keep invented names (ORG_NAMES); no real theater, show, award or logo is used. `on` is how a line reads
 * ("on Broadway", "in the West End"). A country with none here gets "the major stage" in its biggest city.
 */
export const THEATER_DISTRICTS = {
  us: { name: 'Broadway', city: 'New York', on: 'on Broadway' },
  uk: { name: 'West End', city: 'London', on: 'in the West End' },
  ca: { name: 'Entertainment District', city: 'Toronto', on: 'in Toronto\'s Entertainment District' },
  au: { name: 'East End', city: 'Melbourne', on: 'in Melbourne\'s East End' },
  es: { name: 'Gran Vía', city: 'Madrid', on: 'on the Gran Vía' },
  fr: { name: 'Grands Boulevards', city: 'Paris', on: 'on the Grands Boulevards' },
  jp: { name: 'Hibiya', city: 'Tokyo', on: 'in Hibiya' },
  kr: { name: 'Daehak-ro', city: 'Seoul', on: 'on Daehak-ro' },
  ar: { name: 'Avenida Corrientes', city: 'Buenos Aires', on: 'on Avenida Corrientes' },
};

/**
 * Titles that tip a hat to a famous show without being it: a theatergoer knows what they are winking at. A play or
 * musical takes one `share` of the time (its own luck, by the production), and never one already running.
 */
export const TITLE_NODS = {
  share: 0.35,
  musical: ['Next to Nothing', 'Hammerton', 'Wickeder', 'Less Miserable', 'The Phantom of the Soap Opera', 'Dogs!', 'Papa Mia!',
    'Dear Evan Handsome', 'Hadesville', 'The Lion Prince', 'Mortgage', 'Milwaukee', 'Butter', 'Hair Gel', 'Seven', 'Thawed',
    'The Book of Norman', 'Into the Weeds', 'East Side Story', 'Sweeney Toad', 'Okay, Alabama!', 'The Sound of Muzak',
    'Fiddler on the Porch', 'Mean Moms', 'Bartender', 'Come From Afar', 'The Music Manager', 'A Chorus Queue', 'School of Jazz',
    'Blogsies', 'Moulin Bleu!', 'Little Shop of Chores', 'Evitable', 'Funky Boots', 'Delaware Boys', 'Spring Cleaning', 'Avenue R', 'Goodspell'],
  stage: ['Life of a Salesman', 'A Bus Named Desire', 'The Importance of Being Ernie', 'Waiting for Gordon', 'Your Town', 'Romeo and Julio',
    'Hamlette', 'Who\'s Afraid of Virginia Beach?', 'Angels in Arizona', 'The Plastic Menagerie', 'Dog on a Hot Tin Roof', 'The Rat Trap',
    'The Cauldron', 'Gates', 'August: Orange County', 'Noises On', 'A Grape in the Shade', 'Long Night\'s Journey into Day'],
};

export const TITLE_PARTS = {
  a: ['Silent', 'Golden', 'Last', 'Broken', 'Northern', 'Paper', 'Midnight', 'Second', 'Hidden', 'Borrowed', 'Electric', 'Quiet', 'Burning', 'Winter', 'Glass'],
  b: ['Harbor', 'Kingdom', 'Summer', 'Letters', 'Orchard', 'Tide', 'Signal', 'Lanterns', 'Garden', 'Avenue', 'Crossing', 'Promise', 'Inheritance', 'Weather', 'Station'],
  c: ['Small Hours', 'the Lost Coast', 'the Long Road', 'Saint Agnes', 'the Marsh', 'Blue Hill', 'the Old Mill', 'Fortune', 'the Tall Ships', 'Morning'],
};
export const GENRES = {
  film: ['drama', 'comedy', 'thriller', 'romance', 'science fiction', 'period drama', 'family film', 'mystery'],
  tv: ['drama series', 'sitcom', 'crime series', 'medical drama', 'period drama', 'family comedy'],
  stage: ['drama', 'comedy', 'classical revival', 'new play', 'farce'],
  musical: ['new musical', 'revival', 'jukebox-free original musical', 'family musical'],
  voice: ['animated series', 'animated film', 'video game', 'audiobook'],
  commercial: ['advertisement'],
};
export const CHARACTER_WORDS = ['the eldest sister', 'a widowed lighthouse keeper', 'the new teacher', 'a disgraced surgeon', 'the best friend', 'a traveling musician', 'the detective', 'a young heir', 'the landlady', 'a returning soldier', 'the mayor', 'a stubborn grandmother', 'the rival', 'a scientist', 'the chef'];

/**
 * Award bodies. founded: the first year it exists. scope: 'national' (one per country, by the country's name)
 * or 'international'. categories: [id, name, medium kinds, role kinds (or 'production'), tiers allowed].
 */
export const AWARD_BODIES = [
  { id: 'reel', name: 'Golden Reel Awards', founded: 1929, scope: 'international', medium: 'film',
    categories: [['lead_film', 'Best Lead Performance in a Film', ['film'], ['lead'], ['indie', 'studio', 'blockbuster']],
      ['support_film', 'Best Supporting Performance in a Film', ['film'], ['supporting'], ['indie', 'studio', 'blockbuster']],
      ['best_film', 'Best Film', ['film'], 'production', ['indie', 'studio', 'blockbuster']]] },
  { id: 'lumen', name: 'Lumen Television Awards', founded: 1951, scope: 'international', medium: 'tv',
    categories: [['lead_tv', 'Best Lead Performance in a Series', ['tv'], ['lead'], ['network', 'studio']],
      ['support_tv', 'Best Supporting Performance in a Series', ['tv'], ['supporting', 'guest'], ['network', 'studio']],
      ['voice_tv', 'Best Voice Performance', ['voice'], ['voice_lead'], ['indie', 'network', 'studio']]] },
  { id: 'footlights', name: 'Footlights Awards', founded: 1947, scope: 'national', medium: 'stage',
    categories: [['lead_play', 'Best Lead Performance in a Play', ['stage'], ['lead'], ['major_stage', 'touring']],
      ['lead_musical', 'Best Lead Performance in a Musical', ['musical'], ['lead'], ['major_stage', 'touring']],
      ['support_stage', 'Best Supporting Performance on Stage', ['stage', 'musical'], ['supporting'], ['major_stage', 'touring']],
      ['best_musical', 'Best Musical', ['musical'], 'production', ['major_stage', 'touring']]] },
  { id: 'curtain', name: 'Curtain Call Regional Theater Awards', founded: 1972, scope: 'national', medium: 'stage',
    categories: [['regional_lead', 'Outstanding Performance in Regional Theater', ['stage', 'musical'], ['lead', 'supporting'], ['regional']],
      ['regional_show', 'Outstanding Regional Production', ['stage', 'musical'], 'production', ['regional']]] },
];
export const NOMINEES = 5;

/** Kinds of press story, and how true each is by its nature. */
export const ACCURACY = {
  verified: 'Reported fact',
  allegation: 'Allegation, not proven',
  speculation: 'Speculation',
  rumor: 'Rumor',
  correction: 'Correction',
};

/** Fictional brands for endorsements. */
export const BRANDS = ['Larkspur Coffee', 'Northfield Motors', 'Brightwater', 'Juniper & Rowe', 'Halcyon Watches', 'Kestrel Sportswear', 'Meadowlark Foods', 'Aurelia Skincare', 'Copperline Phones', 'Tidewell'];

/** Share of a child performer's earnings set aside in trust until they come of age. GAMEPLAY CONFIGURATION. */
export const CHILD_TRUST_SHARE = 0.15;
/** An agent's commission. */
export const AGENT_COMMISSION = 0.1;
/** A publicist's yearly fee, in base units. */
export const PUBLICIST_FEE = 18000;

// ---------- Music ----------

export const MUSIC_GENRES = ['pop', 'rock', 'folk', 'hip-hop', 'R&B', 'electronic', 'jazz', 'country', 'indie', 'classical crossover', 'soul', 'metal'];
export const BAND_WORDS = { a: ['Paper', 'Velvet', 'Northern', 'Midnight', 'Glass', 'Copper', 'Electric', 'Quiet', 'Wild', 'Silver', 'Hollow', 'Lucky'], b: ['Foxes', 'Lanterns', 'Tides', 'Satellites', 'Harbors', 'Ravens', 'Engines', 'Orchards', 'Strangers', 'Signals', 'Comets', 'Wolves'] };
export const SONG_WORDS = { a: ['Slow', 'Golden', 'Late', 'Paper', 'Borrowed', 'Burning', 'Little', 'Wide', 'Blue', 'Summer', 'Last', 'Neon'], b: ['Hearts', 'Rooms', 'Rivers', 'Lights', 'Letters', 'Roads', 'Mornings', 'Windows', 'Ghosts', 'Promises', 'Streets', 'Skies'] };
/** Kinds of release: how many songs, and what recording costs (base units) without a label. */
export const RELEASE_TYPES = { single: { name: 'Single', songs: 1, cost: 1500 }, ep: { name: 'EP', songs: 4, cost: 6000 }, album: { name: 'Album', songs: 10, cost: 18000 } };
/** Venues by size. capacity per show; price per ticket (base units); cost per show (crew, travel, hall). */
export const VENUES = {
  bar: { name: 'Bars and pubs', capacity: 120, price: 10, cost: 300, fans: 0 },
  club: { name: 'Clubs', capacity: 500, price: 20, cost: 1800, fans: 4000 },
  theater: { name: 'Theaters and halls', capacity: 2500, price: 40, cost: 14000, fans: 40000 },
  arena: { name: 'Arenas', capacity: 15000, price: 70, cost: 110000, fans: 400000 },
  stadium: { name: 'Stadiums', capacity: 55000, price: 90, cost: 500000, fans: 3000000 },
};
export const LABEL_NAMES = ['{W} Records', '{W} Recordings', '{C} Sound', '{S} Music Group', '{W} Discs'];
/** A record deal's usual terms: royalty share to the act, and what a label pays for each unit sold (base units). */
export const MUSIC_DEAL = { royalty: [0.14, 0.22], unitValue: 1.6, independent: 0.7 };
/** The music award body, which judges releases. */
export const MUSIC_AWARD = { id: 'disc', name: 'Silver Disc Awards', founded: 1959, scope: 'international', medium: 'music',
  categories: [['album', 'Album of the Year', 'album'], ['song', 'Song of the Year', 'single'], ['new_act', 'Best New Act', 'first']] };

// Sport is one system: engine/sports.js, with its data in data/sports.js (the World Games are there too).

// ---------- Modeling ----------

export const MODEL_AGENCY_NAMES = ['{W} Models', '{S} Management', '{C} Faces', '{W} Model Agency'];
export const FASHION_HOUSES = ['Maison Verel', 'Atelier Corvane', 'Lisle & Marr', 'Ondine', 'Haversham', 'Studio Petrova', 'Calloway', 'Beaumarché'];
export const MAGAZINES = ['Silhouette', 'Luster', 'The Edit', 'Vantage', 'Modern Muse', 'Gloss'];
/** Kinds of booking: prestige (0–100), how hard it is to get, and where it can take place. */
export const BOOKINGS = {
  catalog: { name: 'Catalog shoot', prestige: 10, bar: 45 },
  ecommerce: { name: 'Online store shoot', prestige: 8, bar: 40 },
  editorial: { name: 'Magazine editorial', prestige: 40, bar: 62 },
  runway: { name: 'Runway show', prestige: 55, bar: 66, abroad: true },
  campaign: { name: 'Advertising campaign', prestige: 65, bar: 72 },
  cover: { name: 'Magazine cover', prestige: 85, bar: 82 },
};
/** Cities that hold the big fashion weeks, by country id. */
export const FASHION_CAPITALS = { fr: 'Paris', it: 'Milan', us: 'New York', uk: 'London' };

// ---------- Books ----------

export const BOOK_GENRES = ['literary fiction', 'crime', 'romance', 'fantasy', 'science fiction', 'history', 'memoir', 'poetry', 'thriller', "children's"];
/** Sessions of work a manuscript needs, by kind. */
export const BOOK_KINDS = { novel: { name: 'Novel', sessions: 4 }, nonfiction: { name: 'Non-fiction book', sessions: 3 }, poetry: { name: 'Poetry collection', sessions: 2 }, memoir: { name: 'Memoir', sessions: 2 } };
export const PUBLISHER_NAMES = ['{W} Books', '{S} & {S2}', '{W} Press', '{C} House'];
export const BOOK_WORDS = { a: ['The Quiet', 'A House of', 'The Long', 'Under the', 'The Last', 'All the', 'The Salt', 'Winter', 'The Glass', 'Small', 'The Borrowed', 'Before the', 'After the', 'The Hidden'],
  b: ['Hours', 'Daughters', 'Rivers', 'Lanterns', 'Orchard', 'Shore', 'Letters', 'Country', 'Sons', 'Gardens', 'Weather', 'Harbor', 'Kingdoms', 'Maps'], c: ['Again', 'and After', 'Remembered', 'a Novel'] };
export const BOOK_DEAL = { royalty: [0.08, 0.15], unitValue: 4, selfShare: 0.6 };
export const BOOK_AWARD = { id: 'lantern', name: 'Lantern Prize', founded: 1969, scope: 'national', medium: 'literary',
  categories: [['fiction', 'Fiction', ['novel']], ['nonfiction', 'Non-fiction', ['nonfiction', 'memoir']], ['debut', 'First Book', 'first']] };

// ---------- Celebrity businesses ----------
// Added to the business engine (data/business.js) as kinds of business that need a known name.

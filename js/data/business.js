// Businesses a person can start and own. Money is in base units (scaled by
// each country's wages and each city's pay and rents, like everything else).
// GAMEPLAY CONFIGURATION: none of this is what a real business costs or earns.
//
//   startup   what it costs to open the doors
//   perHead   what one member of staff can bring in a year at ordinary prices, when there is the custom for it
//   cogs      the share of revenue that goes on stock, materials and supplies
//   rent      premises a year, for one site
//   wage      what an ordinary member of staff is paid a year
//   track     the career track whose experience running it counts toward (and whose staff it hires)
//   needs     what the owner must have: trade, program (with its license), cert, or years in any of `experience`
//   solo      can be run with no staff at all
//   needs.land  the owner must have land of their own (a country house or larger)
//   needs.flag  a player flag the owner must have, with needs.flagText saying why
//   needs.dancer  the owner must be a qualified dancer (engine/dance.js studioReady: data/dance.js STUDIO_READY)
const B = (id, name, family, startup, perHead, cogs, rent, wage, track, needs = {}, o = {}) => ({ id, name, family, startup, perHead, cogs, rent, wage, track, needs, ...o });

export const BUSINESS_TYPES = [
  B('cafe', 'Café', 'hospitality', 45000, 52000, 0.32, 22000, 24000, 'cafe'),
  B('restaurant', 'Restaurant', 'hospitality', 110000, 60000, 0.34, 40000, 27000, 'kitchen', { experience: { kitchen: 3, fine_dining: 2, front_house: 4 } }),
  B('bakery', 'Bakery', 'hospitality', 55000, 50000, 0.3, 20000, 25000, 'pastry'),
  B('bar', 'Bar', 'hospitality', 80000, 58000, 0.3, 30000, 25000, 'bar', { minAge: 21 }),
  B('shop', 'Shop', 'retail', 40000, 62000, 0.5, 20000, 24000, 'retail'),
  B('boutique', 'Clothes boutique', 'retail', 50000, 66000, 0.48, 26000, 25000, 'fashion_retail'),
  B('bookshop', 'Bookshop', 'retail', 35000, 60000, 0.5, 18000, 24000, 'retail'),
  B('salon', 'Hair and beauty salon', 'beauty', 38000, 55000, 0.14, 20000, 28000, 'hair_stylist', { program: 'cosmetology' }),
  B('electrical', 'Electrical contractor', 'trades', 28000, 82000, 0.22, 8000, 46000, 'electrician', { trade: 'electrician' }, { solo: true }),
  B('plumbing', 'Plumbing firm', 'trades', 26000, 80000, 0.22, 8000, 45000, 'plumber', { trade: 'plumber' }, { solo: true }),
  B('joinery', 'Carpentry workshop', 'trades', 32000, 74000, 0.26, 12000, 42000, 'carpenter', { trade: 'carpenter' }, { solo: true }),
  B('garage', 'Garage', 'trades', 60000, 78000, 0.28, 20000, 44000, 'mechanic', { trade: 'mechanic' }),
  B('builder', 'Building firm', 'trades', 70000, 90000, 0.36, 10000, 40000, 'construction', { experience: { construction: 5, carpenter: 4, electrician: 5, plumber: 5 } }),
  B('landscaper', 'Landscaping business', 'trades', 22000, 60000, 0.18, 6000, 30000, 'landscaping', {}, { solo: true }),
  B('cleaning', 'Cleaning company', 'trades', 12000, 46000, 0.08, 4000, 24000, 'maintenance', {}, { solo: true }),
  B('software_studio', 'Software studio', 'tech', 30000, 130000, 0.06, 14000, 82000, 'software', { experience: { software: 3, data: 3, gamedev: 3 } }, { solo: true, remote: true }),
  B('design_studio', 'Design studio', 'arts', 20000, 85000, 0.06, 12000, 46000, 'graphic', { experience: { graphic: 2, animation: 3, copywriting: 3 } }, { solo: true, remote: true }),
  B('agency', 'Marketing agency', 'corporate', 30000, 95000, 0.08, 16000, 52000, 'marketing', { experience: { marketing: 4, pr: 4, copywriting: 4, social_media: 3 } }, { remote: true }),
  B('accountancy', 'Accountancy practice', 'corporate', 25000, 100000, 0.04, 14000, 58000, 'accountant', { experience: { accountant: 4, audit: 4 } }, { solo: true }),
  B('consultancy', 'Consultancy', 'corporate', 15000, 140000, 0.05, 10000, 85000, 'consulting', { experienceTotal: 10 }, { solo: true, remote: true }),
  B('law_firm', 'Law practice', 'law', 45000, 170000, 0.04, 26000, 60000, 'lawyer', { program: 'law', experience: { lawyer: 4, prosecutor: 4, defender: 4 } }, { solo: true }),
  B('clinic', 'Medical practice', 'health', 140000, 150000, 0.12, 36000, 52000, 'doctor', { program: 'medical', experience: { doctor: 4 } }),
  B('dental_practice', 'Dental practice', 'health', 160000, 140000, 0.16, 32000, 50000, 'dentist', { program: 'dental' }),
  B('vet_practice', 'Veterinary practice', 'land', 130000, 115000, 0.2, 30000, 44000, 'vet', { program: 'veterinary' }),
  B('gym', 'Fitness studio', 'sport', 70000, 60000, 0.08, 34000, 28000, 'fitness'),
  // Classes for children and adults, a competition team, a recital every summer. Its teachers come from the dance world.
  B('dance_studio', 'Dance studio', 'arts', 35000, 54000, 0.06, 24000, 30000, 'dance', { dancer: true }, { solo: true }),
  B('tutoring', 'Tutoring center', 'education', 18000, 56000, 0.05, 12000, 34000, 'research_asst', { degree: 'university' }, { solo: true }),
  B('photo_studio', 'Photography studio', 'media', 24000, 60000, 0.1, 12000, 30000, 'photography', {}, { solo: true }),
  B('events_co', 'Events company', 'hospitality', 25000, 72000, 0.3, 8000, 34000, 'events', { experience: { events: 3, hotel: 4, front_house: 4 } }, { solo: true }),
  B('haulage', 'Haulage firm', 'transport', 90000, 92000, 0.34, 14000, 44000, 'driver', { experience: { driver: 4, logistics: 3, warehouse: 5 } }),
  // Working with animals (the animals themselves are in engine/animals.js; these are the businesses).
  B('pet_care', 'Pet sitting and dog walking', 'land', 2000, 30000, 0.12, 0, 22000, 'animal_care', {}, { solo: true }),
  B('grooming_salon', 'Pet grooming salon', 'land', 30000, 52000, 0.16, 16000, 26000, 'grooming', { experience: { grooming: 2, animal_care: 3 } }, { solo: true }),
  B('kennels', 'Boarding kennels and cattery', 'land', 60000, 58000, 0.2, 6000, 25000, 'animal_care', { experience: { animal_care: 2, grooming: 3, vet: 1 }, land: true }),
  B('training_school', 'Dog training school', 'land', 12000, 56000, 0.06, 9000, 30000, 'animal_training', { experience: { animal_training: 3 } }, { solo: true }),
  B('riding_school', 'Riding school', 'land', 120000, 62000, 0.22, 4000, 26000, 'equestrian', { experience: { equestrian: 3 }, land: true, flag: 'riderAdvanced', flagText: 'You need to ride at an advanced level to teach.' }),
  B('smallholding', 'Smallholding', 'land', 30000, 40000, 0.38, 2000, 24000, 'farming', { land: true }, { solo: true }),
  B('farm', 'Farm', 'land', 150000, 68000, 0.4, 16000, 27000, 'farming', { experience: { farming: 3, ranching: 3, agri_science: 2 } }),
  // Celebrity brands: they need a name people know, and sell on it (engine/business.js starPull).
  B('fashion_label', 'Fashion label', 'arts', 60000, 90000, 0.4, 24000, 34000, 'fashion_design', { fame: 35 }, { celebrity: true }),
  B('beauty_brand', 'Beauty brand', 'beauty', 50000, 95000, 0.35, 18000, 32000, 'marketing', { fame: 35 }, { celebrity: true }),
  B('record_label', 'Record label', 'arts', 40000, 80000, 0.3, 16000, 34000, 'music_prod', { fame: 30 }, { celebrity: true }),
  B('production_co', 'Production company', 'arts', 80000, 110000, 0.35, 24000, 40000, 'production', { fame: 30 }, { celebrity: true }),
  B('funeral_home', 'Funeral home', 'novelty', 90000, 85000, 0.22, 24000, 38000, 'funeral', { experience: { funeral: 4 } }),
  B('pi_agency', 'Investigations agency', 'novelty', 15000, 70000, 0.06, 8000, 40000, 'pi', { experience: { pi: 3, police: 6, detective: 3 } }, { solo: true }),
];
export const BUSINESS_BY_ID = Object.fromEntries(BUSINESS_TYPES.map((b) => [b.id, b]));

/** A freelance service that can grow into each kind of business. */
export const FROM_SERVICE = { graphic_design: 'design_studio', coding: 'software_studio', web_dev: 'software_studio', photography: 'photo_studio', cleaning: 'cleaning',
  lawn_care: 'landscaper', tutoring: 'tutoring', personal_training: 'gym', event_staffing: 'events_co', consulting: 'consultancy', social_media: 'agency', writing: 'agency', makeup: 'salon' };

/** Price positions. demand: how much custom it draws; k: what each sale brings in. */
export const PRICING = {
  budget: { label: 'Cheap and busy', demand: 1.3, k: 0.8, rep: -1 },
  standard: { label: 'The going rate', demand: 1, k: 1, rep: 0 },
  premium: { label: 'Premium', demand: 0.72, k: 1.35, rep: 1 },
};

/** How much of the owner's week the business gets. */
export const OWNER_HOURS = [
  { hours: 0, label: 'Hands off', sub: 'Only possible with a manager in charge.' },
  { hours: 10, label: 'An eye on it', sub: 'Ten hours a week. A manager helps a great deal.' },
  { hours: 25, label: 'Half the week', sub: 'Twenty-five hours.' },
  { hours: 45, label: 'Full time', sub: 'Forty-five hours. It is your job.' },
  { hours: 60, label: 'Everything you have', sub: 'Sixty hours. It will show, in the business and in you.' },
];

/** What the owner takes out each year. */
export const DRAWS = {
  none: { label: 'Nothing: leave it all in the business', share: 0 },
  modest: { label: 'A modest wage', share: 0.35 },
  half: { label: 'Half the profit', share: 0.5 },
  most: { label: 'Most of the profit', share: 0.85 },
};

/** Words for naming a business; {S} is the owner's surname, {C} the city. */
export const BUSINESS_NAMES = ['{S}\'s', '{S} & Co.', '{C} {T}', 'The {W} {T}', '{S} {T}', '{W} {T}'];
export const NAME_WORDS = ['Corner', 'Little', 'Golden', 'Harbor', 'Old Mill', 'Bright', 'Honest', 'Riverside', 'Northside', 'Good'];

/** Interest on money the business borrows, and how long it has to repay. */
export const BUSINESS_LOAN = { rate: 0.08, years: 7, most: 1.5 };

/**
 * Tax on a business's profit, by country. GAMEPLAY CONFIGURATION, SIMPLIFIED AND UNVERIFIED: one headline
 * rate, and a lower rate on small profits where the country has one. Real systems have allowances,
 * regional taxes, credits and exceptions that are not modeled. Nothing here is tax advice.
 *   rate   the headline rate on profit
 *   small  the rate on the first slice of profit (up to SMALL_PROFIT typical wages), where lower
 * Places not listed use DEFAULT_PROFIT_TAX.
 */
export const DEFAULT_PROFIT_TAX = { rate: 0.22 };
export const SMALL_PROFIT = 3; // typical wages (engine/systems.js typicalWage)
export const PROFIT_TAX = {
  us: { rate: 0.21 }, ca: { rate: 0.26, small: 0.12 }, mx: { rate: 0.3 }, br: { rate: 0.34, small: 0.15 }, ar: { rate: 0.35, small: 0.25 },
  cl: { rate: 0.27, small: 0.25 }, co: { rate: 0.35 }, pe: { rate: 0.295 },
  uk: { rate: 0.25, small: 0.19 }, ie: { rate: 0.125 }, fr: { rate: 0.25, small: 0.15 }, de: { rate: 0.3 }, it: { rate: 0.24 }, es: { rate: 0.25, small: 0.23 },
  pt: { rate: 0.21, small: 0.17 }, nl: { rate: 0.258, small: 0.19 }, be: { rate: 0.25, small: 0.2 }, ch: { rate: 0.15 }, at: { rate: 0.23 }, se: { rate: 0.206 },
  no: { rate: 0.22 }, dk: { rate: 0.22 }, fi: { rate: 0.2 }, pl: { rate: 0.19, small: 0.09 }, cz: { rate: 0.21 }, hu: { rate: 0.09 }, ro: { rate: 0.16 },
  gr: { rate: 0.22 }, ee: { rate: 0.2 }, hr: { rate: 0.18, small: 0.1 }, ua: { rate: 0.18 }, ru: { rate: 0.25 }, tr: { rate: 0.25 }, ge: { rate: 0.15 },
  jp: { rate: 0.3, small: 0.22 }, kr: { rate: 0.24, small: 0.09 }, cn: { rate: 0.25, small: 0.05 }, hk: { rate: 0.165, small: 0.0825 }, tw: { rate: 0.2 },
  sg: { rate: 0.17 }, my: { rate: 0.24, small: 0.15 }, th: { rate: 0.2, small: 0.15 }, vn: { rate: 0.2 }, id: { rate: 0.22, small: 0.11 }, ph: { rate: 0.25, small: 0.2 },
  in: { rate: 0.25 }, pk: { rate: 0.29 }, bd: { rate: 0.275 }, au: { rate: 0.3, small: 0.25 }, nz: { rate: 0.28 },
  ae: { rate: 0.09, small: 0 }, sa: { rate: 0.2 }, qa: { rate: 0.1 }, kw: { rate: 0.15 }, il: { rate: 0.23 }, eg: { rate: 0.225 }, jo: { rate: 0.2 },
  ng: { rate: 0.3, small: 0 }, ke: { rate: 0.3 }, za: { rate: 0.27 }, gh: { rate: 0.25 }, ma: { rate: 0.2, small: 0.1 }, et: { rate: 0.3 },
  mc: { rate: 0.25 }, bs: { rate: 0 }, aw: { rate: 0.25 },
};

// The political world: issues, the kinds of party a country may have, the
// groups of voters, and what a government can change. Every party and
// politician in the game is invented. Positions and effects are the game's
// own assumptions, set out here so they can be read and changed; they are
// not statements about any real party or policy.
//
// Issues run from -2 to +2:
//   tax       -2 low taxes            … +2 high taxes on higher incomes
//   services  -2 a small state        … +2 generous schools, hospitals and benefits
//   housing   -2 leave it to the market … +2 build and regulate rents
//   order     -2 liberal on crime     … +2 tough on crime
//   green     -2 growth first         … +2 environment first
//   open      -2 closed borders, tradition … +2 open borders, personal freedoms
export const ISSUES = { tax: 'taxes', services: 'schools and hospitals', housing: 'housing', order: 'law and order', green: 'the environment', open: 'immigration and freedoms' };

/** Kinds of party. A country gets the first two and one to three of the others. names: one is chosen. */
export const PARTY_KINDS = [
  { kind: 'labor', names: ['Workers\' Alliance', 'Social Democratic Union', 'People\'s Labor Front', 'Solidarity Party'], color: '#c0392b',
    positions: { tax: 1.5, services: 2, housing: 1, order: 0, green: 1, open: 1 }, says: 'Higher taxes on the well-off to pay for schools, hospitals and homes.' },
  { kind: 'conservative', names: ['National Union', 'Conservative League', 'Heritage Party', 'Homeland Union'], color: '#1f4e8c',
    positions: { tax: -1.5, services: -0.5, housing: -1, order: 2, green: -1, open: -1 }, says: 'Lower taxes, firm policing, and caution about change.' },
  { kind: 'liberal', names: ['Liberal Center', 'Free Democrats', 'Progress Party', 'Open Society Party'], color: '#d4a017',
    positions: { tax: -1, services: 0, housing: -1, order: -1, green: 0, open: 2 }, says: 'Low taxes, open markets, open borders and personal freedom.' },
  { kind: 'green', names: ['Green Future', 'Earth Alliance', 'The Greens'], color: '#2e8b57',
    positions: { tax: 1, services: 1, housing: 1, order: -1, green: 2, open: 1 }, says: 'The environment first, paid for by those who pollute.' },
  { kind: 'populist', names: ['Homeland Movement', 'Common Sense Front', 'People First'], color: '#5d3a8e',
    positions: { tax: -0.5, services: 1, housing: 0, order: 2, green: -2, open: -2 }, says: 'Closed borders, tough justice, and spending on our own.' },
  { kind: 'agrarian', names: ['Country Party', 'Farmers and Towns', 'Center Union'], color: '#8a6d1d',
    positions: { tax: -1, services: 1, housing: 0, order: 1, green: -1, open: -1 }, says: 'The countryside and small towns before the capital.' },
];
/** The one party of a one-party state. */
export const RULING_PARTY = { kind: 'ruling', names: ['The Party'], color: '#a01818', positions: { tax: 0.5, services: 1, housing: 1, order: 2, green: -1, open: -2 }, says: 'Order, growth and the leading role of the party.' };

/** Groups of voters. share: part of the electorate; turnout: how many vote; cares: what decides their vote; wants: where they stand. */
export const VOTERS = [
  { id: 'young', name: 'Younger voters', share: 0.18, turnout: 0.5, cares: { housing: 2, green: 2, open: 1, services: 1 }, wants: { housing: 2, green: 1.5, open: 1.5, services: 1 } },
  { id: 'workers', name: 'Working households', share: 0.3, turnout: 0.6, cares: { services: 2, tax: 1, housing: 1, order: 1 }, wants: { services: 1.5, tax: 0.5, housing: 1, order: 1 } },
  { id: 'professionals', name: 'Professionals and business', share: 0.2, turnout: 0.72, cares: { tax: 2, open: 1, services: 1 }, wants: { tax: -1.5, open: 1, services: 0 } },
  { id: 'older', name: 'Older voters', share: 0.22, turnout: 0.78, cares: { order: 2, services: 2, tax: 1 }, wants: { order: 1.5, services: 1, tax: -0.5 } },
  { id: 'rural', name: 'Rural and small towns', share: 0.1, turnout: 0.68, cares: { order: 1, green: 1, open: 2, tax: 1 }, wants: { order: 1, green: -1, open: -1.5, tax: -1 } },
];

/** Where the votes are counted. Each is a mix of the voter groups; for each group the fractions add up to 1. */
export const AREAS = [
  { id: 'cities', name: 'The city centers', mix: { young: 0.5, workers: 0.2, professionals: 0.35, older: 0.15, rural: 0 } },
  { id: 'suburbs', name: 'The suburbs', mix: { young: 0.25, workers: 0.25, professionals: 0.45, older: 0.3, rural: 0.05 } },
  { id: 'towns', name: 'The industrial towns', mix: { young: 0.2, workers: 0.45, professionals: 0.15, older: 0.3, rural: 0.15 } },
  { id: 'country', name: 'The villages and farms', mix: { young: 0.05, workers: 0.1, professionals: 0.05, older: 0.25, rural: 0.8 } },
];

/** Countries whose legislature is elected one member per district (the rest use proportional lists). */
export const DISTRICT_SEATS = ['us', 'uk', 'ca', 'au', 'in', 'pk', 'jm', 'my', 'sg', 'fr', 'ph', 'ng', 'ke', 'gh', 'jp', 'th', 'kw', 'jo'];
/** Presidential countries that elect the president in a single round (the rest hold a run-off if nobody passes half). */
export const ONE_ROUND = ['us', 'mx', 'ph', 'kr', 'ke', 've'];
/** Years between general elections, where it is not four. */
export const TERMS = { uk: 5, ca: 4, in: 5, fr: 5, it: 5, ie: 5, za: 5, tr: 5, mx: 6, ph: 6, kr: 5, ru: 6, ve: 6, eg: 6, my: 5, sg: 5, pk: 5, jm: 5, ke: 5, ng: 4, be: 5, jo: 4, kw: 4, mc: 5 };

/**
 * What a government can change, and what it does to ordinary life. Each is a
 * level from -2 to +2, moved one step at a time. `follows`: the issue that
 * decides which way a party wants it; `cost`: what one step up does to the
 * budget (a government that runs too far into deficit has to raise tax or cut).
 */
export const LEVERS = {
  tax: { name: 'income tax', follows: 'tax', cost: -1.5, step: 0.02,
    up: 'raised income tax by two points', down: 'cut income tax by two points', feel: (n) => `Income tax is ${Math.abs(n) * 2} points ${n > 0 ? 'higher' : 'lower'} than it was.` },
  tuition: { name: 'university funding', follows: 'services', cost: 1, step: 0.15,
    up: 'put more public money into universities, cutting tuition', down: 'cut university funding, raising tuition', feel: (n) => `Tuition is ${Math.abs(n) * 15}% ${n > 0 ? 'cheaper' : 'more expensive'}.` },
  health: { name: 'health funding', follows: 'services', cost: 1, step: 0.15,
    up: 'put more money into health care, cutting what patients pay', down: 'cut health funding, raising what patients pay', feel: (n) => `Medical bills are ${Math.abs(n) * 15}% ${n > 0 ? 'lower' : 'higher'}.` },
  rent: { name: 'housing', follows: 'housing', cost: 0.5, step: 0.06,
    up: 'capped rent rises, with money for new homes', down: 'lifted rent controls', feel: (n) => `Rents are ${Math.abs(n) * 6}% ${n > 0 ? 'lower' : 'higher'}.` },
  police: { name: 'policing', follows: 'order', cost: 0.5, step: 0.04,
    up: 'put more police on the streets', down: 'cut police numbers', feel: (n) => `Crimes are ${n > 0 ? 'more' : 'less'} likely to be solved than they were.` },
};

/**
 * What a city or a region can change for itself. Like the national levers,
 * each runs from -2 to 2. `follows`: the issue a party judges it by.
 */
export const LOCAL_LEVERS = {
  rates: { name: 'local taxes', follows: 'tax', cost: -1.5, up: 'raised local taxes', down: 'cut local taxes', feel: (n) => (n ? `People here pay ${Math.abs(n)}% ${n > 0 ? 'more' : 'less'} of their income in tax.` : 'Local taxes are back where they were.') },
  services: { name: 'clinics and schools', follows: 'services', cost: 1, up: 'put more into local clinics and schools', down: 'cut local clinics and schools', feel: (n) => (n ? `Medical bills here are ${Math.abs(n) * 5}% ${n > 0 ? 'lower' : 'higher'}.` : 'Local services are back where they were.') },
  safety: { name: 'local policing', follows: 'order', cost: 0.5, up: 'put more officers on local streets', down: 'cut local policing', feel: (n) => (n ? `Crimes here are ${n > 0 ? 'more' : 'less'} likely to be solved.` : 'Local policing is back where it was.') },
  housing: { name: 'local housing', follows: 'housing', cost: 0.5, up: 'built homes and held rents down', down: 'sold off public housing', feel: (n) => (n ? `Rents here are ${Math.abs(n) * 4}% ${n > 0 ? 'lower' : 'higher'}.` : 'Local housing is back where it was.') },
};

/** The departments of a government. Each is run by a minister, and each answers for one of the levers above. */
export const DEPARTMENTS = [
  { id: 'treasury', title: 'Finance Minister', lever: 'tax' },
  { id: 'health', title: 'Health Minister', lever: 'health' },
  { id: 'education', title: 'Education Minister', lever: 'tuition' },
  { id: 'housing', title: 'Housing Minister', lever: 'rent' },
  { id: 'justice', title: 'Justice Minister', lever: 'police' },
  // No lever of its own: the foreign minister's skill tells in talks, visits and crises (engine/diplomacy.js).
  { id: 'foreign', title: 'Foreign Minister', lever: null },
];

/** Things that bring a head of government low. truth is decided when it happens. */
export const POLITICAL_SCANDALS = ['was found to have taken gifts from a company bidding for state contracts', 'misled the legislature about what they knew, and when',
  'was recorded promising a ministry in exchange for a donation', 'had an expenses claim that did not survive a journalist\'s arithmetic', 'kept a relative on the public payroll for work nobody can describe'];

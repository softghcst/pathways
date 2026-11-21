// Politics: how each country is governed, which offices can be run for and
// what they are called there, and what campaigning and governing involve.
// Parties, opponents and office-holders are all invented.
//
// kind:
//   'presidential'   voters elect a president directly
//   'parliamentary'  voters elect a parliament; its leader is the head of government
//   'party'          one party rules; offices are given by its committees, not by voters
//   'none'           no elections at all; power is inherited
// rigged: elections are held, but the count leans heavily toward those already in power
// region: what the head of a state or province is called (left out where the country has none)
// seat:   what a member of the national legislature is called
// head:   what the head of government is called
// nativeOnly: only someone born in the country may hold the top office
import { NEW_PLACES } from './worldNew.js';
const P = (head, seat, region, extra = {}) => ({ kind: 'presidential', head, seat, region, limit: 2, ...extra });
const M = (head, seat, region, extra = {}) => ({ kind: 'parliamentary', head, seat, region, ...extra });
const MP = 'Member of Parliament';

export const SYSTEMS = {
  us: P('President', 'Senator', 'Governor', { nativeOnly: true }),
  br: P('President', 'Senator', 'Governor', { nativeOnly: true }),
  mx: P('President', 'Senator', 'Governor', { nativeOnly: true, limit: 1 }),
  ar: P('President', 'Senator', 'Governor', { nativeOnly: true }),
  co: P('President', 'Senator', 'Governor', { nativeOnly: true, limit: 1 }),
  cl: P('President', 'Senator', 'Regional Governor', { limit: 1 }),
  pe: P('President', 'Member of Congress', 'Regional Governor', { nativeOnly: true, limit: 1 }),
  do: P('President', 'Senator', 'Governor'),
  ph: P('President', 'Senator', 'Governor', { nativeOnly: true, limit: 1 }),
  kr: P('President', 'Member of the National Assembly', 'Governor', { limit: 1 }),
  ng: P('President', 'Senator', 'Governor', { nativeOnly: true }),
  ke: P('President', 'Senator', 'Governor', { nativeOnly: true }),
  gh: P('President', MP, 'Regional Minister', { nativeOnly: true }),
  id: P('President', 'Member of the People\'s Representative Council', 'Governor', { nativeOnly: true }),
  tr: P('President', 'Member of the Grand National Assembly', 'Governor'),
  fr: P('President', 'Deputy', 'Regional President'),
  ua: P('President', 'People\'s Deputy', 'Governor'),
  za: P('President', MP, 'Premier'),
  ru: P('President', 'Deputy of the State Duma', 'Governor', { rigged: true, limit: 0 }),
  ve: P('President', 'Deputy', 'Governor', { rigged: true, limit: 0 }),
  eg: P('President', 'Member of the House of Representatives', 'Governor', { rigged: true, limit: 0 }),

  uk: M('Prime Minister', MP, 'First Minister'),
  ca: M('Prime Minister', MP, 'Premier'),
  au: M('Prime Minister', MP, 'Premier'),
  nz: M('Prime Minister', MP, null),
  in: M('Prime Minister', MP, 'Chief Minister'),
  pk: M('Prime Minister', 'Member of the National Assembly', 'Chief Minister'),
  jp: M('Prime Minister', 'Member of the Diet', 'Governor'),
  de: M('Chancellor', 'Member of the Bundestag', 'Minister-President'),
  it: M('Prime Minister', 'Deputy', 'Regional President'),
  es: M('Prime Minister', 'Deputy', 'Regional President'),
  pt: M('Prime Minister', 'Deputy', null),
  se: M('Prime Minister', 'Member of the Riksdag', null),
  no: M('Prime Minister', 'Member of the Storting', null),
  dk: M('Prime Minister', 'Member of the Folketing', null),
  nl: M('Prime Minister', MP, 'King\'s Commissioner'),
  ie: M('Taoiseach', 'Teachta Dála', null),
  gr: M('Prime Minister', MP, 'Regional Governor'),
  pl: M('Prime Minister', 'Member of the Sejm', 'Marshal of the Voivodeship'),
  ch: M('President of the Confederation', 'National Councillor', 'Cantonal President'),
  jm: M('Prime Minister', MP, null),
  th: M('Prime Minister', MP, 'Governor'),
  sg: M('Prime Minister', MP, null),
  ma: M('Head of Government', MP, 'Regional President'),

  cn: { kind: 'party', head: 'President', seat: 'Delegate to the National People\'s Congress', region: 'Provincial Party Secretary' },
  vn: { kind: 'party', head: 'General Secretary', seat: 'Delegate to the National Assembly', region: 'Provincial Party Secretary' },
  cu: { kind: 'party', head: 'President', seat: 'Deputy to the National Assembly', region: 'Provincial Governor' },

  ae: { kind: 'none' },
  sa: { kind: 'none' },
  qa: { kind: 'none' },
  be: M('Prime Minister', MP, 'Minister-President'),
  mc: M('Minister of State', 'National Councillor', null),
  jo: M('Prime Minister', MP, 'Governor'),
  kw: M('Prime Minister', 'Member of the National Assembly', 'Governor'),
  my: M('Prime Minister', MP, 'Chief Minister'),
};
// The places added by the Living World engine (data/worldNew.js).
for (const [id, r] of Object.entries(NEW_PLACES)) {
  const [kind, head, seat, region, extra] = r[8];
  SYSTEMS[id] = kind === 'P' ? P(head, seat, region, extra) : kind === 'M' ? M(head, seat, region, extra) : kind === 'party' ? { kind: 'party', head, seat, region } : { kind: 'none' };
}


/**
 * The ladder. tier: how high the office is. base: how hard it is for an
 * unknown to win (higher is easier). cost and salary are in base units.
 * fullTime offices replace an ordinary job.
 */
export const OFFICES = [
  { id: 'council', tier: 1, minAge: 18, base: 43, cost: 1500, salary: 14000, term: 4, fullTime: false },
  { id: 'mayor', tier: 2, minAge: 21, base: 40, cost: 12000, salary: 95000, term: 4, fullTime: true },
  { id: 'seat', tier: 3, minAge: 25, base: 37, cost: 50000, salary: 150000, term: 5, fullTime: true },
  { id: 'region', tier: 4, minAge: 30, base: 36, cost: 140000, salary: 165000, term: 4, fullTime: true },
  { id: 'head', tier: 5, minAge: 35, base: 30, cost: 450000, salary: 380000, term: 4, fullTime: true },
];

/**
 * What you stand for. Each pledge takes a position on one of the issues the
 * voters divide on (data/parties.js), so it pleases the groups who want that
 * and puts off the ones who do not. `against`: runs against whoever governs.
 */
export const PLATFORMS = [
  { id: 'jobs', name: 'Jobs and wages', issue: 'services', to: 1 },
  { id: 'health', name: 'Hospitals and schools', issue: 'services', to: 2 },
  { id: 'taxes', name: 'Lower taxes', issue: 'tax', to: -2 },
  { id: 'homes', name: 'Homes people can afford', issue: 'housing', to: 2 },
  { id: 'order', name: 'Law and order', issue: 'order', to: 2 },
  { id: 'green', name: 'Clean air and water', issue: 'green', to: 2 },
  { id: 'borders', name: 'Tighter borders', issue: 'open', to: -2 },
  { id: 'open', name: 'An open, free country', issue: 'open', to: 2 },
  { id: 'change', name: 'Throw the old lot out', against: true },
  { id: 'silly', name: 'A free pony for every household', silly: true },
];

/** How much is spent, as a multiple of the office's basic cost, and what it buys. */
export const BUDGETS = [
  { id: 'shoestring', name: 'A shoestring', times: 1, boost: 0, desc: 'Leaflets, a borrowed van, and your own two feet.' },
  { id: 'proper', name: 'A proper campaign', times: 4, boost: 5, desc: 'Staff, posters, and an office with a kettle.' },
  { id: 'lavish', name: 'Money no object', times: 14, boost: 10, desc: 'Your face on every screen and every bus.' },
];

/** Things to do on the campaign trail. Two can be chosen. */
export const MOVES = [
  { id: 'doors', name: 'Knock on every door', boost: [3, 7], factor: 'discipline', text: 'You wear out two pairs of shoes.' },
  { id: 'rally', name: 'Hold big rallies', boost: [1, 9], factor: 'charm', text: 'The crowds are loud, and some of them are even there for you.' },
  { id: 'debate', name: 'Challenge your opponent to a debate', boost: [-6, 12], factor: 'intellect', text: 'An hour under the lights, with nowhere to hide.' },
  { id: 'babies', name: 'Kiss babies and eat local food', boost: [2, 5], factor: 'charm', text: 'You eat nine regional delicacies in one day and smile through all of them.' },
  { id: 'smear', name: 'Run attack adverts', boost: [-8, 12], dirty: true, karma: -6, text: 'Your opponent\'s worst photograph is on every channel.' },
  { id: 'buy', name: 'Hand out envelopes on Election Day', boost: [8, 18], illegal: true, karma: -12, text: 'A great many people are suddenly very keen to vote.' },
];

/** What an office-holder can do with a year. Two a year. tier: the lowest office that can do it. */
export const ACTIONS = [
  { id: 'meet', tier: 1, name: 'Hold open meetings', approval: [2, 5], text: 'You sit in drafty halls and listen to people complain about bins, and it does you good.' },
  { id: 'build', tier: 1, name: 'Build something people can see', approval: [3, 8], text: 'There is a ribbon, a pair of giant scissors, and your name on a brass plate.' },
  { id: 'cut', tier: 2, name: 'Cut taxes', approval: [5, 10], debt: true, text: 'Everyone has a little more in their pocket. The treasury has a good deal less.' },
  { id: 'reform', tier: 2, name: 'Push through a hard reform', approval: [-9, -2], karma: 6, lasting: true, text: 'It is needed, it is right, and nobody thanks you for it. Not yet.' },
  { id: 'favors', tier: 1, name: 'Steer contracts to your friends', approval: [0, 0], graft: true, text: 'A contract goes to a company owned by a man you play golf with.' },
  { id: 'holiday', tier: 5, name: 'Declare a national holiday', approval: [4, 9], text: 'Nobody has ever voted against a day off.' },
  { id: 'statue', tier: 5, name: 'Put up a statue of yourself', approval: [-10, -3], mood: 8, text: 'It is forty feet high, and the pigeons have already found it.' },
  { id: 'pardon', tier: 5, name: 'Pardon yourself of everything', approval: [-14, -6], pardon: true, text: 'With one signature, your record is as clean as the day you were born.' },
  { id: 'seize', tier: 5, name: 'Seize emergency powers', approval: [0, 0], seize: true, text: '' },
];
export const ACTIONS_PER_YEAR = 2;

/** Below this approval, the people (or the party) move to throw an office-holder out. */
export const REMOVAL = 22;

/** The stretches of a campaign. One thing can be done in each. */
export const ROUNDS = ['Six weeks to go', 'A month to go', 'Two weeks to go', 'The last days'];

/**
 * What a candidate can do with a stretch of the campaign. boost: points of
 * support, low to high; factor: the trait that helps; cost: as a multiple of
 * the office's basic cost. Doing the same thing twice is worth half as much.
 */
export const TRAIL = [
  { id: 'doors', name: 'Knock on doors', boost: [2, 4], factor: 'discipline', text: 'You wear out a pair of shoes, one doorstep at a time.' },
  { id: 'rally', name: 'Hold rallies', boost: [0, 6], factor: 'charm', text: 'The crowds are loud, and some of them are even there for you.' },
  { id: 'babies', name: 'Kiss babies and eat local food', boost: [1, 3], factor: 'charm', text: 'You eat nine regional delicacies in one day and smile through all of them.' },
  { id: 'target', name: 'Court one group of voters', group: true, text: '' },
  { id: 'adverts', name: 'Buy advertising', boost: [3, 6], cost: 1.5, text: 'Your face is on every bus shelter, looking trustworthy.' },
  { id: 'fundraise', name: 'Raise money from supporters', raise: [0.6, 1.4], boost: [1, 1], text: 'Raffles, dinners and a great many small checks.' },
  { id: 'donors', name: 'Dine with wealthy donors', raise: [2.5, 5], karma: -2, strings: true, text: 'The wine is excellent, and everybody at the table wants something.' },
  { id: 'poll', name: 'Commission a private poll', cost: 0.5, poll: true, text: '' },
  { id: 'smear', name: 'Run attack adverts', boost: [-5, 8], cost: 1, dirty: true, karma: -6, text: 'Your opponent\'s worst photograph is on every channel.' },
  { id: 'buy', name: 'Hand out envelopes on Election Day', boost: [6, 12], illegal: true, karma: -12, last: true, text: 'A great many people are suddenly very keen to vote.' },
];

/** What is asked in a debate, by issue. Three are drawn. */
export const DEBATE_QUESTIONS = {
  tax: 'The moderator asks who would pay more tax under you, and who less.',
  services: 'A nurse in the audience asks why her ward is always short of staff.',
  housing: 'A young couple ask when they will ever be able to afford a home.',
  order: 'A shopkeeper, burgled three times this year, asks what you would do about it.',
  green: 'A farmer asks whether your promises on the environment will cost him his living.',
  open: 'A question from the floor: how many newcomers is too many?',
};

/** Ways to answer. What each is worth is decided in engine/campaign.js. */
export const DEBATE_ANSWERS = [
  { id: 'straight', name: 'Answer it straight', sub: 'Worth more the sharper you are. Costs nothing later.' },
  { id: 'crowd', name: 'Tell the room what it wants to hear', sub: 'Works tonight. In office, the promise comes due.' },
  { id: 'attack', name: 'Turn it on your opponent', sub: 'Lands hard, or makes you look rattled.' },
  { id: 'dodge', name: 'Talk about something else', sub: 'Safe once. The moderator notices the second time.' },
];

/** Ways to win a party's nomination. */
export const NOMINATION = [
  { id: 'members', name: 'Win over the members', sub: 'Drafty halls and handshakes. Charm counts.' },
  { id: 'leadership', name: 'Win over the leadership', sub: 'Years of loyalty and patience count.' },
  { id: 'money', name: 'Outspend your rival', sub: 'It costs, and it shows.', cost: 1 },
];

/**
 * Causes: campaigns from outside politics, one for each side of each issue
 * (data/parties.js). All invented. dir: which way it wants the issue to move.
 */
export const CAUSES = [
  { id: 'hospitals', name: 'Save Our Hospitals', issue: 'services', lever: 'health', dir: 1, wants: 'It wants more public money for hospitals.' },
  { id: 'smallstate', name: 'The Smaller State Society', issue: 'services', lever: 'tuition', dir: -1, wants: 'It wants the state to spend less and do less.' },
  { id: 'fairtax', name: 'The Fair Tax Campaign', issue: 'tax', dir: 1, wants: 'It wants higher taxes on higher incomes.' },
  { id: 'taxpayers', name: 'The Taxpayers\' League', issue: 'tax', dir: -1, wants: 'It wants income tax cut.' },
  { id: 'homes', name: 'Homes for All', issue: 'housing', dir: 1, wants: 'It wants rents capped and homes built.' },
  { id: 'builders', name: 'Free the Builders', issue: 'housing', dir: -1, wants: 'It wants rent controls lifted.' },
  { id: 'streets', name: 'Safe Streets', issue: 'order', dir: 1, wants: 'It wants more police.' },
  { id: 'justice', name: 'Justice Reform Now', issue: 'order', dir: -1, wants: 'It wants fewer police and lighter sentences.' },
  { id: 'earth', name: 'Clean Earth', issue: 'green', dir: 1, wants: 'It wants the environment put first.' },
  { id: 'jobsfirst', name: 'Jobs First', issue: 'green', dir: -1, wants: 'It wants green rules loosened.' },
  { id: 'doors', name: 'Open Doors', issue: 'open', dir: 1, wants: 'It wants open borders and wider freedoms.' },
  { id: 'borders', name: 'Borders First', issue: 'open', dir: -1, wants: 'It wants immigration cut.' },
  // Only where there is a crown. crown: which way it pushes the country's support for the monarchy.
  { id: 'republic', name: 'Republic Now', crown: -1, wants: 'It wants the monarchy put to a vote, and ended.' },
  { id: 'loyal', name: 'The Crown Society', crown: 1, wants: 'It wants the monarchy kept, and cherished.' },
];

/**
 * What a campaigner can do. gain: what it adds to the movement's strength;
 * rise: what it does for the player's standing in it; standing/strength: what is needed first.
 */
export const CAUSE_ACTIONS = [
  { id: 'petition', name: 'Collect signatures', gain: [3, 6], rise: 3, sub: 'A clipboard, a main street, and a thick skin.', text: 'You stand outside a supermarket for six Saturdays with a clipboard.' },
  { id: 'march', name: 'March', gain: [5, 11], rise: 5, factor: 'charm', sub: 'Loud, visible, and not without risk.', text: 'Thousands of you fill the streets, and the evening news has to show it.' },
  { id: 'donate', name: 'Give money', gain: [4, 7], rise: 2, cost: 2000, sub: 'Placards and coaches are not free.', text: 'Your money pays for placards, coaches and a great many sandwiches.' },
  { id: 'organize', name: 'Organize a local branch', gain: [8, 13], rise: 8, exp: 1, standing: 15, factor: 'intellect', sub: 'Meetings, rotas and other people\'s arguments. It counts as experience.', text: 'You run a branch: the meetings, the rotas, and the falling-out over the banner.' },
  { id: 'speak', name: 'Speak for the movement', gain: [6, 14], rise: 10, exp: 1, standing: 40, factor: 'charm', sub: 'A microphone and a crowd. It makes you known.', text: 'You speak from the back of a truck, and people quote it afterward.' },
  { id: 'lobby', name: 'Take it to a minister', gain: [0, 3], rise: 4, standing: 40, strength: 40, sub: 'If the movement is strong enough, the government may give way.', text: '' },
];

/** What goes wrong between two countries. {them}: the other country, as it reads in a sentence; {Them}: at the start of one. */
export const DISPUTES = [
  'A row over fishing waters with {them} has turned ugly.',
  '{Them} has slapped tariffs on the country\'s exports, and a trade row has followed.',
  'A spy scandal has soured relations with {them}.',
  '{Them} has detained two of the country\'s citizens, and will not say why.',
  'A dispute with {them} over a border crossing has closed it for weeks.',
  'An ambassador has been expelled by {them}, and one sent home in return.',
];
/** What goes right. */
export const GOODWILL = [
  'A state visit from the leader of {them} has gone better than anyone hoped.',
  'A joint rescue after an earthquake has brought the country closer to {them}.',
  'Talks with {them} have ended an old argument over tariffs.',
  'A cultural year with {them} has been a quiet success.',
];

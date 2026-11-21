// The kinds of university a country has. Every institution in the game is
// invented: a country's are made from these patterns the first time they are
// needed, named for its own cities, and then kept (engine/university.js).
// Nothing here describes a real university, its fees or its admissions.
//
//   bar          the school mark (0–4) its entrants usually have
//   squeeze      how far demand outruns places: good applicants are turned away there
//   auditionBar  what it takes on the day, for courses entered by audition
//   tuitionMult  multiplies the country's base university tuition
//   living       multiplies the cost of living away from home there
//   merit        the most it waives for outstanding applicants (share of tuition)
//   needAid      the most it waives for those who could not otherwise come
//   strong       subjects it is known for (teaching there is better)
//   only         it teaches nothing but the subjects it is known for
//   perk         'network' an alumni contact at graduation · 'home' cheap and near family · 'mentor' a professor from day one
//   names        patterns: {city} a city of the country, {place} an invented place, {country} the country
export const UNIVERSITY_KINDS = [
  { id: 'ancient', label: 'Old and very selective', squeeze: 0.4, bar: 3.4, auditionBar: 74, tuitionMult: 1.9, living: 1.25, merit: 0.5, needAid: 1, legacy: true, contextual: true, perk: 'network', rep: 96,
    names: ['{place} University', 'University of {place}'],
    strong: ['engineering', 'mathematics', 'computer_science', 'finance', 'chemistry', 'biology', 'political_science', 'history', 'english'],
    blurb: 'Centuries old, famous everywhere, and very hard to get into. Generous to those who cannot pay; little for anyone else.' },
  { id: 'research', label: 'Major public university', bar: 2.9, auditionBar: 66, tuitionMult: 1.15, living: 1.1, merit: 0.5, needAid: 0.6, sport: true, contextual: true, perk: 'network', rep: 80,
    names: ['University of {city}', '{city} University'],
    strong: ['engineering', 'computer_science', 'biology', 'chemistry', 'business', 'psychology', 'political_science'],
    blurb: 'Huge, well regarded, and good at almost everything. Big lectures, big sports teams.' },
  { id: 'technical', label: 'Technical institute', squeeze: 0.1, bar: 3.0, auditionBar: 99, tuitionMult: 1.2, living: 1.1, merit: 0.75, needAid: 0.5, perk: 'network', rep: 84,
    names: ['{place} Institute of Technology', '{city} Technical University'],
    strong: ['engineering', 'mathematics', 'computer_science', 'chemistry'],
    blurb: 'Laboratories, workshops and long hours. Employers come to it.' },
  { id: 'regional', label: 'Regional university', lenient: 0.6, bar: 1.8, auditionBar: 55, tuitionMult: 0.7, living: 0.9, merit: 1, needAid: 0.7, sport: true, perk: 'home', rep: 55,
    names: ['{city} Metropolitan University', '{city} City University'],
    strong: ['nursing', 'education', 'business', 'criminal_justice', 'psychology', 'communications'],
    blurb: 'Where most of the city\'s nurses, teachers and accountants trained. You can live at home and keep your job.' },
  { id: 'college', label: 'Small college', bar: 2.6, auditionBar: 62, tuitionMult: 1.3, living: 1, merit: 1, needAid: 0.8, contextual: true, perk: 'mentor', rep: 70,
    names: ['{place} College', '{saint} College'],
    strong: ['art', 'music', 'theater', 'english', 'history', 'journalism', 'psychology'],
    blurb: 'A few thousand students, small classes, and teachers who know your name.' },
  { id: 'conservatoire', label: 'Conservatoire', only: true, squeeze: 0.1, bar: 2.0, auditionBar: 72, tuitionMult: 1.4, living: 1.2, merit: 0.5, needAid: 0.6, arts: true, perk: 'mentor', rep: 82,
    names: ['{city} Conservatoire', 'The {place} Academy of Performing Arts'],
    strong: ['music', 'theater', 'musical_theater', 'musical_theater_bfa', 'art'],
    blurb: 'For performers and artists. Everyone was the best in their school; here they are ordinary.' },
  { id: 'open', label: 'Open university', bar: 0, auditionBar: 99, open: true, tuitionMult: 0.45, living: 0, merit: 0, needAid: 0.5, perk: 'home', rep: 45,
    names: ['The {place} Open University'],
    strong: ['business', 'education', 'psychology', 'communications'],
    blurb: 'Takes anyone, of any age, from anywhere, and fits around a job. Nobody will hold your hand.' },
];
export const UNIVERSITY_KIND_BY_ID = Object.fromEntries(UNIVERSITY_KINDS.map((k) => [k.id, k]));

export const UNI_PLACES = ['Ashcombe', 'Marlowe', 'Wexcombe', 'Harrowgate', 'Calder', 'Thornley', 'Aldermoor', 'Penhallow', 'Ravensworth', 'Lindisholm'];
export const UNI_SAINTS = ['St Osric\'s', 'St Hild\'s', 'Trinity', 'All Hallows', 'St Aubyn\'s'];

/** The most places one round of applications can go to. */
export const MAX_APPLICATIONS = 5;

/** How a personal statement can be written. `needs`: what makes the risky ones come off. */
export const STATEMENTS = [
  { id: 'honest', name: 'Write plainly about why you want this', sub: 'Safe. It reads as it is.', value: 1 },
  { id: 'story', name: 'Tell the story of something hard', sub: 'Remembered if it is well told. Awkward if it is not.', risky: true },
  { id: 'polish', name: 'Have it polished until it gleams', sub: 'Smooth, impressive, and like a thousand others.', value: 0 },
];

/** Credits a full degree takes. A two-year college course takes half. */
export const DEGREE_CREDITS = 120;
/** How much to take on in a year: the credits attempted, and what it does to marks. */
export const LOADS = [
  { id: 'light', name: 'A light load', credits: 24, mark: 0.2, blurb: 'Fewer courses, better marks, more time for everything else. The degree takes longer.' },
  { id: 'standard', name: 'A standard load', credits: 30, mark: 0, blurb: 'What the timetable expects.' },
  { id: 'part', name: 'Part-time', credits: 20, mark: 0.05, blurb: 'Evenings and weekends, alongside a job. The degree takes six years.' },
  { id: 'heavy', name: 'A heavy load', credits: 40, mark: -0.25, blurb: 'Extra courses. Marks suffer, but it makes up lost ground or finishes early.' },
];
/** Families of subjects: moving within one keeps every credit; moving between them loses a year's worth. */
export const MAJOR_GROUP = { engineering: 'stem', mathematics: 'stem', computer_science: 'stem', chemistry: 'stem', biology: 'stem', nursing: 'health', psychology: 'social',
  political_science: 'social', history: 'humanities', english: 'humanities', journalism: 'humanities', communications: 'humanities', criminal_justice: 'social', education: 'social',
  finance: 'business', business: 'business', art: 'arts', music: 'arts', theater: 'arts', musical_theater: 'arts', musical_theater_bfa: 'arts' };

/**
 * Student organizations. factor: what makes someone good at it. mark: what
 * it does to the year's marks. polExp: political experience a year.
 * only: countries where such a thing exists.
 */
export const ORGS = [
  { id: 'union', name: 'Students\' union', leader: 'President', factor: 'stats.charm', polExp: 1, blurb: 'Elections, motions, and arguments about the bar prices. Where politicians start.' },
  { id: 'society', name: 'Subject society', leader: 'Chair', factor: 'stats.intellect', mark: 0.06, blurb: 'Talks, a journal, and people who love what you are studying.' },
  { id: 'sports', name: 'University sports club', leader: 'Captain', factor: 'talents.sports', yearly: { stats: { health: 2 }, talents: { sports: 2 } }, blurb: 'Training twice a week and a fixture on Wednesdays.' },
  { id: 'drama', name: 'Drama society', leader: 'President', factor: 'talents.acting', stage: true, blurb: 'Three shows a year, cast by audition.' },
  { id: 'paper', name: 'Student newspaper', leader: 'Editor', factor: 'stats.intellect', yearly: { hidden: { discipline: 1 } }, blurb: 'Deadlines, libel worries, and your name in print.' },
  { id: 'debate', name: 'Debating union', leader: 'President', factor: 'stats.charm', polExp: 1, yearly: { stats: { charm: 1 } }, blurb: 'Formal wear and informal cruelty.' },
  { id: 'politics', name: 'Party student branch', leader: 'Chair', factor: 'stats.charm', polExp: 2, needsParty: true, blurb: 'Leaflets, canvassing, and meeting the people who will one day select candidates.' },
  { id: 'volunteers', name: 'Volunteering society', leader: 'Coordinator', factor: 'hidden.karma', yearly: { hidden: { karma: 3 } }, blurb: 'Tutoring, food banks, and a minibus that mostly starts.' },
  { id: 'music', name: 'Orchestra and choir', leader: 'Leader', factor: 'talents.music', yearly: { talents: { music: 2, singing: 1 } }, blurb: 'Rehearsals on Tuesdays, a concert every term.' },
  { id: 'greek', name: 'Fraternity or sorority', leader: 'President', factor: 'stats.charm', mark: -0.08, dues: 1200, only: ['us', 'ca', 'ph'], yearly: { stats: { charm: 2, mood: 2 } }, blurb: 'A house, a set of letters, and friends who will answer the phone in thirty years. Dues every year.' },
];
export const ORG_BY_ID = Object.fromEntries(ORGS.map((o) => [o.id, o]));
export const MAX_ORGS = 2;

/** What a roommate is like to live with. line: how they are first described. clash: what the argument is about. */
export const HABITS = [
  { id: 'tidy', line: 'folds everything, including towels', clash: 'the state you leave the kitchen in' },
  { id: 'messy', line: 'has never knowingly washed a mug', clash: 'the dirty dishes, which have begun to grow' },
  { id: 'owl', line: 'comes alive at midnight', clash: 'the noise at three in the morning' },
  { id: 'lark', line: 'is up at six, cheerfully', clash: 'the alarm that goes off at six, every day' },
  { id: 'host', line: 'knows everyone, and invites them round', clash: 'the strangers asleep on the sofa' },
  { id: 'quiet', line: 'says very little, and listens to everything', clash: 'the silence, which has started to feel pointed' },
];
/** Invented employers for internships: one word from each list. */
export const EMPLOYERS = { first: ['Halden', 'Marrow', 'Castell', 'Brightwater', 'Northfold', 'Ostrander', 'Fairlight', 'Tessel', 'Kestrel', 'Lowry'], second: ['& Partners', 'Group', 'Associates', 'Works', 'Institute', 'Trust', 'Laboratories', 'Media', 'Systems', 'Holdings'] };

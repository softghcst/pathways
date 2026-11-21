// The law the justice system applies: offenses, how each country's courts
// work, the places people are held, and what there is to do inside.
//
// GAMEPLAY CONFIGURATION, COMPILED BY HAND AND UNVERIFIED, like data/rules.js.
// Each country is placed in one of a few broad families of procedure. Real
// systems have many more courts, exceptions and regional differences than are
// modeled here, and they change. Nothing here is legal information.
//
// Money is in base units (scaled by each currency); time is in years.

/**
 * Offenses, by legal classification. Crimes the player can choose
 * (data/crimes.js) point at one of these through `offense`.
 *   severity  1 (minor) to 5 (the gravest)
 *   custody   [least, most] years in custody, where custody is lawful
 *   ladder    the sanctions a court may choose from, lightest first
 *   lesser    a lesser offense a court may convict of instead
 *   fine      base-unit fine for a minor offense
 *   victim    whether there is a person who was wronged
 */
export const OFFENSES = [
  { id: 'shoplifting', name: 'Shoplifting', category: 'property', severity: 1, custody: [0, 1], fine: 400, victim: false,
    ladder: ['diversion', 'discharge', 'fine', 'community'] },
  { id: 'theft', name: 'Theft', category: 'property', severity: 1, custody: [0, 2], fine: 600, victim: true,
    ladder: ['diversion', 'discharge', 'fine', 'community', 'probation'] },
  { id: 'criminal_damage', name: 'Criminal damage', category: 'property', severity: 1, custody: [0, 1], fine: 500, victim: true,
    ladder: ['diversion', 'discharge', 'fine', 'community'] },
  { id: 'trespass', name: 'Trespass', category: 'public_order', severity: 1, custody: [0, 0], fine: 300, victim: false,
    ladder: ['discharge', 'fine'] },
  { id: 'disorderly', name: 'Disorderly conduct', category: 'public_order', severity: 1, custody: [0, 0], fine: 250, victim: false,
    ladder: ['discharge', 'fine', 'community'] },
  { id: 'vehicle_theft', name: 'Vehicle theft', category: 'property', severity: 2, custody: [0, 5], fine: 1500, victim: true,
    ladder: ['fine', 'community', 'probation', 'suspended', 'custody'], lesser: 'theft' },
  { id: 'fraud', name: 'Fraud', category: 'financial', severity: 2, custody: [0, 8], fine: 4000, victim: true,
    ladder: ['fine', 'community', 'probation', 'suspended', 'custody'], lesser: 'theft' },
  { id: 'embezzlement', name: 'Embezzlement', category: 'financial', severity: 2, custody: [0, 7], fine: 5000, victim: true,
    ladder: ['fine', 'probation', 'suspended', 'custody'], lesser: 'theft' },
  { id: 'tax_evasion', name: 'Tax evasion', category: 'regulatory', severity: 2, custody: [0, 5], fine: 8000, victim: false,
    ladder: ['fine', 'probation', 'suspended', 'custody'] },
  { id: 'assault', name: 'Assault', category: 'violent', severity: 2, custody: [0, 4], fine: 1000, victim: true,
    ladder: ['fine', 'community', 'probation', 'suspended', 'custody'], lesser: 'disorderly' },
  { id: 'burglary', name: 'Burglary', category: 'property', severity: 3, custody: [1, 6], victim: true,
    ladder: ['community', 'probation', 'suspended', 'custody'], lesser: 'trespass' },
  { id: 'robbery', name: 'Robbery', category: 'violent', severity: 3, custody: [1, 8], victim: true,
    ladder: ['probation', 'suspended', 'custody'], lesser: 'theft' },
  { id: 'escape', name: 'Escaping lawful custody', category: 'public_order', severity: 3, custody: [1, 5], victim: false,
    ladder: ['custody'] },
  { id: 'armed_robbery', name: 'Armed robbery', category: 'violent', severity: 4, custody: [6, 20], victim: true,
    ladder: ['custody'], lesser: 'robbery' },
  { id: 'manslaughter', name: 'Manslaughter', category: 'violent', severity: 4, custody: [3, 15], victim: true,
    ladder: ['suspended', 'custody'] },
  { id: 'homicide', name: 'Murder', category: 'violent', severity: 5, custody: [15, 50], victim: true,
    ladder: ['custody'], lesser: 'manslaughter' },
];
export const OFFENSE_BY_ID = Object.fromEntries(OFFENSES.map((o) => [o.id, o]));

/** Plain words for each sanction. */
export const SANCTIONS = {
  diversion: 'a diversion program instead of prosecution',
  discharge: 'a conditional discharge',
  fine: 'a fine',
  community: 'community service',
  probation: 'probation',
  suspended: 'a suspended sentence',
  custody: 'custody',
};

/**
 * Families of criminal procedure.
 *   factFinder   who decides guilt in a contested trial: 'jury', 'judge', or 'mixed' (judges with lay judges)
 *   juryFrom     the least severe offense tried by a jury, where there are juries
 *   plea         'bargain': the prosecution may offer a deal, which a judge must accept
 *                'credit':  pleading guilty earns a fixed discount on the sentence
 *                'limited': an admission is evidence and mitigation, but the court still hears the case
 *   pleaCredit   the share taken off a custodial term for a guilty plea
 *   bail         'money': release may depend on a sum of money; 'conditions': release on conditions, or not at all
 *   release      when a custodial term may end early: 'board' (a parole board decides) or 'automatic' (release on parole)
 *   releaseAt    the share of the term served before that can happen
 *   exclusion    'strict': unlawfully obtained evidence must be left out; 'discretion': the judge weighs it
 *   sealAfter    years after a sentence is complete before a record can be sealed: [minor, serious]; null: never
 *   adultAge     the age at which a person is tried as an adult
 *   wage         what a year of prison work pays, in base units
 *   schooling    how much education prisons offer, 0 to 1
 */
export const SYSTEMS = {
  jury: { id: 'jury', name: 'Adversarial, with juries', factFinder: 'jury', juryFrom: 3, plea: 'credit', pleaCredit: 0.33,
    bail: 'conditions', release: 'automatic', releaseAt: 0.5, exclusion: 'discretion', sealAfter: [2, 7], adultAge: 18, wage: 600, schooling: 0.7 },
  american: { id: 'american', name: 'Adversarial, with juries and plea bargains', factFinder: 'jury', juryFrom: 2, plea: 'bargain', pleaCredit: 0.35,
    bail: 'money', release: 'board', releaseAt: 0.5, exclusion: 'strict', sealAfter: [3, 10], adultAge: 18, wage: 250, schooling: 0.5 },
  bench: { id: 'bench', name: 'Adversarial, decided by judges', factFinder: 'judge', juryFrom: 9, plea: 'credit', pleaCredit: 0.25,
    bail: 'conditions', release: 'board', releaseAt: 0.66, exclusion: 'discretion', sealAfter: null, adultAge: 18, wage: 150, schooling: 0.35 },
  mixed: { id: 'mixed', name: 'Professional and lay judges together', factFinder: 'mixed', juryFrom: 9, plea: 'limited', pleaCredit: 0.15,
    bail: 'conditions', release: 'board', releaseAt: 0.66, exclusion: 'discretion', sealAfter: [3, 10], adultAge: 18, wage: 900, schooling: 0.85 },
  inquisitorial: { id: 'inquisitorial', name: 'Investigating magistrates and professional judges', factFinder: 'judge', juryFrom: 9, plea: 'limited', pleaCredit: 0.15,
    bail: 'conditions', release: 'board', releaseAt: 0.66, exclusion: 'discretion', sealAfter: [5, 15], adultAge: 18, wage: 300, schooling: 0.5 },
};

const FAMILY = {
  american: ['us', 'pr'],
  jury: ['uk', 'ie', 'ca', 'au', 'nz', 'jm', 'bs', 'bz', 'gy', 'hk', 'gh'],
  bench: ['in', 'pk', 'bd', 'sg', 'my', 'za', 'ng', 'ke', 'ug', 'zw', 'ph', 'il', 'ws', 'pg'],
  mixed: ['de', 'at', 'se', 'fi', 'dk', 'no', 'jp', 'kr', 'fr', 'it', 'hr', 'cz', 'sk', 'pl', 'ee', 'hu', 'gr'],
};
const FAMILY_OF = Object.fromEntries(Object.entries(FAMILY).flatMap(([f, ids]) => ids.map((id) => [id, f])));
/** The procedure a country uses. Everywhere not listed follows the inquisitorial model. */
export const systemFor = (countryId) => SYSTEMS[FAMILY_OF[countryId] ?? 'inquisitorial'];

/** The age below which nobody can be prosecuted. Default 14. Unverified. */
const RESPONSIBILITY = { uk: 10, au: 10, nz: 10, us: 10, ca: 12, ie: 12, fr: 13, nl: 12, in: 7, sg: 10, za: 12, jp: 14, de: 14, kr: 14 };
export const responsibilityAge = (countryId) => RESPONSIBILITY[countryId] ?? 14;

/** What the courts are called. Default for everywhere else. */
const COURTS = {
  default: { lower: 'Local Court', trial: 'District Court', appeal: 'Court of Appeal', youth: 'Youth Court', civil: 'Civil Court' },
  uk: { lower: 'Magistrates\' Court', trial: 'Crown Court', appeal: 'Court of Appeal', youth: 'Youth Court', civil: 'County Court' },
  us: { lower: 'Municipal Court', trial: 'Superior Court', appeal: 'Court of Appeals', youth: 'Juvenile Court', civil: 'Small Claims Court' },
  ca: { lower: 'Provincial Court', trial: 'Superior Court of Justice', appeal: 'Court of Appeal', youth: 'Youth Justice Court', civil: 'Small Claims Court' },
  au: { lower: 'Local Court', trial: 'District Court', appeal: 'Court of Criminal Appeal', youth: 'Children\'s Court', civil: 'Local Court (civil)' },
  ie: { lower: 'District Court', trial: 'Circuit Criminal Court', appeal: 'Court of Appeal', youth: 'Children Court', civil: 'District Court (civil)' },
  de: { lower: 'Amtsgericht', trial: 'Landgericht', appeal: 'Oberlandesgericht', youth: 'Jugendgericht', civil: 'Amtsgericht (civil)' },
  fr: { lower: 'Tribunal de police', trial: 'Tribunal correctionnel', appeal: 'Cour d\'appel', youth: 'Tribunal pour enfants', civil: 'Tribunal judiciaire' },
  jp: { lower: 'Summary Court', trial: 'District Court', appeal: 'High Court', youth: 'Family Court', civil: 'Summary Court (civil)' },
};
export const courtsFor = (countryId) => COURTS[countryId] ?? COURTS.default;
/** The court that hears a criminal case. */
export const courtFor = (countryId, severity, juvenile) => {
  const c = courtsFor(countryId);
  return juvenile ? c.youth : severity <= 1 ? c.lower : c.trial;
};

/** What the police are called. */
const POLICE = { uk: 'Metropolitan Police', us: 'City Police Department', ca: 'Police Service', au: 'State Police', ie: 'An Garda Síochána', fr: 'Police nationale', de: 'Landespolizei', jp: 'Prefectural Police', it: 'Polizia di Stato', es: 'Policía Nacional' };
export const policeName = (countryId, city) => (POLICE[countryId] ? (['us', 'ca', 'uk'].includes(countryId) ? `${city} ${POLICE[countryId].replace(/^Metropolitan /, '')}` : POLICE[countryId]) : `${city} Police`);

/** When kinds of evidence first exist in the world (by calendar year). */
export const EVIDENCE_FROM = { forensic: 1990, cctv: 1995, digital: 2003, video_call: 2010 };

/**
 * Evidence kinds, and how each is described.
 * reliability: the range a record of this kind is drawn from.
 */
export const EVIDENCE = {
  officer: { name: 'Arresting officer\'s account', reliability: [0.75, 0.92] },
  witness: { name: 'Witness statement', reliability: [0.35, 0.8] },
  victim: { name: 'Complainant\'s statement', reliability: [0.45, 0.85] },
  documents: { name: 'Documents and records', reliability: [0.7, 0.9] },
  financial: { name: 'Financial records', reliability: [0.7, 0.92] },
  physical: { name: 'Physical evidence', reliability: [0.55, 0.8] },
  forensic: { name: 'Forensic analysis', reliability: [0.8, 0.95] },
  cctv: { name: 'Camera footage', reliability: [0.55, 0.85] },
  digital: { name: 'Phone and computer records', reliability: [0.65, 0.9] },
  admission: { name: 'Admission to the police', reliability: [0.85, 0.95] },
  character: { name: 'Character statement', reliability: [0.2, 0.4] },
};

/** What the police look for, by offense category. Kinds missing from the world yet are skipped. */
export const LEADS = {
  property: ['witness', 'physical', 'forensic', 'cctv'],
  financial: ['documents', 'financial', 'digital', 'witness'],
  violent: ['witness', 'forensic', 'physical', 'cctv'],
  public_order: ['witness', 'cctv'],
  regulatory: ['documents', 'financial'],
};

/** Grounds for appeal. Each may be argued once per case. */
export const APPEAL_GROUNDS = {
  sentence: { name: 'The sentence was too severe', needs: 'custody' },
  procedure: { name: 'The trial was unfair: evidence that should have been left out was used', needs: 'tainted' },
  new_evidence: { name: 'New evidence has come to light', needs: 'fresh' },
};

// ---------- Custody ----------

/** Kinds of place people are held. */
export const FACILITY_KINDS = {
  juvenile: { name: 'Youth detention center', words: ['Youth Center', 'Young Offender Institution', 'Youth Academy'] },
  remand: { name: 'Remand center', words: ['Remand Center', 'Detention Center'] },
  min: { name: 'Open prison', words: ['Open Prison', 'Correctional Camp', 'Farm'] },
  med: { name: 'Prison', words: ['Prison', 'Correctional Facility', 'Penitentiary'] },
  max: { name: 'High-security prison', words: ['High Security Prison', 'Maximum Security Facility', 'Penitentiary'] },
};

/**
 * Education inside. Each gives a real qualification in the education records.
 *   needs     a qualification the student must already hold ('high'), or null
 *   gives     the degree record created: type and majorId
 *   years     years of study
 *   security  the highest security level that offers it
 *   schooling the least prison-schooling (SYSTEMS) a country needs to offer it
 */
export const PROGRAMS = [
  { id: 'literacy', name: 'Reading and writing', years: 1, needs: null, security: 'max', schooling: 0, stat: 'intellect',
    blurb: 'Small classes with a volunteer tutor. No qualification, but everything else starts here.' },
  { id: 'equivalency', name: 'School-leaving certificate', years: 1, needs: null, notHeld: 'high', security: 'max', schooling: 0.3,
    gives: { type: 'high', via: 'equivalency' }, blurb: 'The same certificate adults take outside. It counts the same.' },
  { id: 'chef', name: 'Catering (trade qualification)', years: 2, needs: null, security: 'med', schooling: 0.3,
    gives: { type: 'apprenticeship', via: 'technical', majorId: 'chef' }, blurb: 'Two years in the training kitchen. A recognized trade at the end.' },
  { id: 'carpenter', name: 'Carpentry (trade qualification)', years: 2, needs: null, security: 'min', schooling: 0.4,
    gives: { type: 'apprenticeship', via: 'technical', majorId: 'carpenter' }, blurb: 'The workshop, a qualified instructor and a recognized trade.' },
  { id: 'bookkeeping', name: 'Bookkeeping certificate', years: 1, needs: 'high', security: 'med', schooling: 0.5,
    gives: { type: 'certificate', majorId: 'bookkeeping' }, blurb: 'A professional certificate, studied by correspondence.' },
  { id: 'coding', name: 'Programming certificate', years: 1, needs: 'high', security: 'min', schooling: 0.7, from: 2005,
    gives: { type: 'certificate', majorId: 'coding' }, blurb: 'Offline computers in a supervised classroom.' },
  { id: 'degree', name: 'University degree by distance learning', years: 4, needs: 'high', security: 'med', schooling: 0.6,
    gives: { type: 'university', majorId: 'business' }, blurb: 'Course packs by mail and an exam room once a term. A full degree.' },
];
export const PROGRAM_BY_ID = Object.fromEntries(PROGRAMS.map((x) => [x.id, x]));

/** Work inside. skill: a real skill (data/skills.js) the work trains. */
export const PRISON_JOBS = [
  { id: 'kitchen', name: 'Kitchen', skill: 'cooking', pay: 1 },
  { id: 'laundry', name: 'Laundry', pay: 0.8 },
  { id: 'library', name: 'Library orderly', stat: 'intellect', pay: 0.8 },
  { id: 'maintenance', name: 'Maintenance', pay: 1.1 },
  { id: 'gardens', name: 'Gardens', stat: 'health', pay: 0.9, security: 'min' },
  { id: 'office', name: 'Education office', stat: 'intellect', pay: 1, needs: 'high' },
];
export const PRISON_JOB_BY_ID = Object.fromEntries(PRISON_JOBS.map((x) => [x.id, x]));

/** What a year inside is spent on, if the player does not decide each thing. */
export const ROUTINES = [
  { id: 'study', name: 'Study', blurb: 'Classes and the library come first.' },
  { id: 'work', name: 'Work', blurb: 'A full work detail, and the pay that goes with it.' },
  { id: 'fitness', name: 'Fitness', blurb: 'The gym and the yard.' },
  { id: 'family', name: 'Family', blurb: 'Every letter answered, every phone slot used.' },
  { id: 'programs', name: 'Rehabilitation', blurb: 'Courses, counseling and the chaplaincy.' },
];

/** Interests and goals that make the people inside people. */
export const INMATE_LIVES = {
  interests: ['chess', 'drawing', 'poetry', 'running', 'gardening', 'the guitar', 'history books', 'football', 'cooking', 'learning Spanish', 'crosswords', 'writing letters'],
  goals: ['finish school', 'see their daughter graduate', 'open a café', 'get a trade', 'stay out for good', 'read a hundred books', 'make it up to their mother', 'win their appeal', 'learn to drive when they get out'],
  backgrounds: ['grew up in care', 'was a mechanic', 'ran a small shop', 'was a nurse', 'left school at fifteen', 'served in the army', 'was a student', 'worked on building sites', 'was an accountant'],
};

/** Staff in a facility. */
export const STAFF_ROLES = [
  { id: 'governor', name: 'Governor' },
  { id: 'officer', name: 'Wing officer' },
  { id: 'teacher', name: 'Education officer' },
  { id: 'counselor', name: 'Counselor' },
  { id: 'nurse', name: 'Healthcare' },
  { id: 'caseworker', name: 'Release caseworker' },
];

// ---------- Civil justice ----------

/** Civil disputes. Never a criminal record. claim: base units. */
export const DISPUTES = {
  deposit: { name: 'Unreturned deposit', claim: [600, 2500], against: 'Landlord', blurb: 'A landlord is holding back your deposit.' },
  wages: { name: 'Unpaid wages', claim: [800, 6000], against: 'Former employer', blurb: 'An employer still owes you pay.' },
  consumer: { name: 'Faulty goods', claim: [300, 3000], against: 'Retailer', blurb: 'A shop will not refund something that broke.' },
  repairs: { name: 'Repairs not done', claim: [500, 4000], against: 'Landlord', blurb: 'A landlord will not fix what the lease says they must.' },
  rent: { name: 'Rent arrears', claim: [800, 5000], against: 'Tenant', blurb: 'A tenant has stopped paying the rent.' },
  boundary: { name: 'Damage to property', claim: [400, 5000], against: 'Neighbor', blurb: 'A neighbor damaged what is yours.' },
};

/** Years an investigation stays open with no progress before it is closed. Homicide never is. */
export const COLD_AFTER = 10;
/** A year's chance that an adult with nothing to do with it is wrongly suspected. Kept rare. */
export const WRONGFUL_SUSPICION = 0.004;
/** A year's chance, for an adult, of witnessing something. */
export const WITNESS_CHANCE = 0.05;

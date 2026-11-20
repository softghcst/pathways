// Careers. Pay is in thousands of base units per year.
//
// A level is [title, payLow, payHigh, yearsBeforePromotion, needs?].
//   needs: stat or talent thresholds for holding that level, e.g. { 'talents.singing': 76 }
// req (what you need to be considered at all):
//   degree: 'high' | 'university'      majors: [...]  (any of these university majors)
//   program: 'medical' | 'law' | 'cosmetology'      trade: apprenticeship trade id
//   minAge / maxAge, stats: { path: minimum }, cleanRecord: true
// hire: how you get in: 'interview' | 'practical' | 'audition' | 'portfolio' | 'military'
//   skill: the path an audition or portfolio is judged on
// doors: contacts and history that help. { flag, bonus } raises the odds;
//   { flag, guaranteed: true, level } is a standing offer that skips the process.
// fame: { from: level index where fame starts, label }
// stress: 0–3, wears on mood (and health at 3) every year.
import { TRACKS, EXISTING, FAMILIES } from './occupations.js';

const L = (...levels) => levels.map(([title, lo, hi, years, needs]) => ({ title, pay: [lo, hi], years, needs }));

export const CAREER_CATEGORIES = [
  { id: 'professional', name: 'Professional and office' },
  { id: 'trade', name: 'Trades and services' },
  { id: 'beauty', name: 'Hair and makeup' },
  { id: 'performing', name: 'Performing and creative' },
  { id: 'military', name: 'Military' },
];

const journeyman = (id, name) => ({
  id, name, category: 'trade', type: 'fulltime', hire: 'practical', stress: 1, req: { trade: id },
  levels: L([`Qualified ${name.toLowerCase()}`, 48, 62, 4], [`Senior ${name.toLowerCase()}`, 66, 84, 6],
    [`Master ${name.toLowerCase()}`, 88, 120, 6], [`${name} contractor`, 110, 180, 0]),
});

const BASE_CAREERS = [
  // ---------- Professional and office ----------
  { id: 'software', name: 'Software', category: 'professional', type: 'fulltime', hire: 'interview', stress: 2,
    req: { degree: 'university', majors: ['computer_science', 'engineering', 'mathematics'], altCert: 'coding' },
    doors: [{ flag: 'alumniIntro', bonus: 0.2 }], fame: { from: 4, label: 'App developer' },
    levels: L(['Junior developer', 55, 72, 2], ['Developer', 78, 105, 3], ['Senior developer', 110, 150, 4],
      ['Engineering lead', 150, 200, 5], ['App founder', 250, 900, 0]) },
  { id: 'political_staff', name: 'Political staff', category: 'professional', type: 'fulltime', hire: 'interview', stress: 2,
    req: { degree: 'high', minAge: 18 }, doors: [{ flag: 'party', bonus: 0.25 }, { flag: 'politicalFamily', bonus: 0.15 }],
    levels: L(['Campaign organizer', 30, 40, 2], ['Assistant to a legislator', 40, 55, 3], ['Policy adviser', 60, 85, 4], ['Special adviser to a minister', 90, 130, 5], ['Chief of staff', 140, 210, 0]) },
  { id: 'accountant', name: 'Accounting', category: 'professional', type: 'fulltime', hire: 'interview', stress: 1,
    req: { degree: 'university', majors: ['finance', 'business', 'mathematics'], altCert: 'bookkeeping' }, doors: [{ flag: 'alumniIntro', bonus: 0.2 }],
    levels: L(['Junior accountant', 45, 58, 2], ['Accountant', 60, 80, 3], ['Senior accountant', 85, 110, 4], ['Finance director', 130, 190, 0]) },
  { id: 'banker', name: 'Investment banking', category: 'professional', type: 'fulltime', hire: 'interview', stress: 3,
    req: { degree: 'university', majors: ['finance', 'mathematics', 'business'] }, doors: [{ flag: 'alumniIntro', bonus: 0.25 }],
    levels: L(['Analyst', 70, 95, 2], ['Associate', 110, 150, 3], ['Vice president', 170, 240, 4], ['Managing director', 300, 500, 0]) },
  { id: 'marketing', name: 'Marketing', category: 'professional', type: 'fulltime', hire: 'interview', stress: 1,
    req: { degree: 'university', majors: ['business', 'communications', 'psychology', 'english', 'journalism', 'art'], altCert: 'digital_marketing' },
    doors: [{ flag: 'alumniIntro', bonus: 0.2 }],
    levels: L(['Marketing assistant', 36, 46, 2], ['Marketing executive', 48, 64, 3], ['Marketing manager', 70, 98, 4], ['Marketing director', 120, 170, 0]) },
  { id: 'teacher', name: 'Teaching', category: 'professional', type: 'fulltime', hire: 'interview', stress: 2,
    req: { degree: 'university' }, doors: [{ flag: 'teacherRec', bonus: 0.15 }, { flag: 'teachingCert', bonus: 0.3 }],
    levels: L(['Trainee teacher', 34, 40, 1], ['Teacher', 42, 58, 5], ['Head of department', 60, 75, 5], ['Head teacher', 85, 120, 0]) },
  { id: 'nurse', name: 'Nursing', category: 'professional', type: 'fulltime', hire: 'interview', stress: 2,
    req: { degree: 'university', majors: ['nursing'], altProgramme: 'nursing' },
    levels: L(['Staff nurse', 48, 62, 3], ['Senior nurse', 65, 80, 4], ['Charge nurse', 82, 98, 5], ['Director of nursing', 110, 150, 0]) },
  { id: 'doctor', name: 'Medicine', category: 'professional', type: 'fulltime', hire: 'interview', stress: 3,
    req: { program: 'medical' }, doors: [{ flag: 'profRec', bonus: 0.15 }],
    levels: L(['Resident doctor', 60, 75, 3], ['Physician', 160, 220, 5], ['Senior physician', 230, 300, 6], ['Chief of medicine', 320, 450, 0]) },
  { id: 'dentist', name: 'Dentistry', category: 'professional', type: 'fulltime', hire: 'interview', stress: 2,
    req: { program: 'dental' },
    levels: L(['Associate dentist', 90, 120, 3], ['Dentist', 130, 180, 5], ['Practice owner', 190, 300, 0]) },
  { id: 'pharmacist', name: 'Pharmacy', category: 'professional', type: 'fulltime', hire: 'interview', stress: 1,
    req: { program: 'pharmacy' },
    levels: L(['Pharmacist', 85, 105, 4], ['Senior pharmacist', 108, 130, 5], ['Pharmacy manager', 135, 170, 0]) },
  { id: 'vet', name: 'Veterinary medicine', category: 'professional', type: 'fulltime', hire: 'interview', stress: 2,
    req: { program: 'veterinary' },
    levels: L(['Junior vet', 60, 78, 3], ['Veterinary surgeon', 85, 120, 5], ['Practice partner', 130, 210, 0]) },
  { id: 'academic', name: 'University teaching', category: 'professional', type: 'fulltime', hire: 'interview', stress: 2,
    req: { program: 'doctorate' }, doors: [{ flag: 'profRec', bonus: 0.2 }],
    levels: L(['Research fellow', 45, 58, 3], ['Lecturer', 62, 85, 5], ['Senior lecturer', 88, 115, 6], ['Professor', 125, 190, 0]) },
  { id: 'lawyer', name: 'Law', category: 'professional', type: 'fulltime', hire: 'interview', stress: 3,
    req: { program: 'law' }, doors: [{ flag: 'profRec', bonus: 0.15 }, { flag: 'alumniIntro', bonus: 0.2 }],
    levels: L(['Associate lawyer', 75, 110, 3], ['Senior associate', 120, 170, 4], ['Partner', 220, 380, 6], ['Managing partner', 400, 700, 0]) },
  { id: 'engineer', name: 'Engineering', category: 'professional', type: 'fulltime', hire: 'interview', stress: 1,
    req: { degree: 'university', majors: ['engineering'] }, doors: [{ flag: 'alumniIntro', bonus: 0.2 }],
    levels: L(['Graduate engineer', 55, 68, 2], ['Engineer', 72, 95, 4], ['Senior engineer', 100, 135, 5], ['Chief engineer', 150, 210, 0]) },
  { id: 'scientist', name: 'Science', category: 'professional', type: 'fulltime', hire: 'interview', stress: 1,
    req: { degree: 'university', majors: ['biology', 'chemistry', 'mathematics'] }, doors: [{ flag: 'profRec', bonus: 0.25 }],
    levels: L(['Lab technician', 38, 48, 2], ['Research scientist', 60, 82, 4], ['Senior scientist', 90, 125, 5], ['Research director', 140, 200, 0]) },
  { id: 'journalist', name: 'Journalism', category: 'professional', type: 'fulltime', hire: 'interview', stress: 2,
    req: { degree: 'university', majors: ['journalism', 'english', 'communications', 'history', 'political_science'] },
    doors: [{ flag: 'newsroomOffer', guaranteed: true, level: 1, text: 'The editor who offered you a desk is still holding it.' },
      { flag: 'stringer', bonus: 0.25 }],
    levels: L(['Junior reporter', 30, 40, 2], ['Reporter', 44, 60, 3], ['Senior reporter', 65, 88, 4], ['Editor', 95, 140, 5], ['Editor-in-chief', 150, 230, 0]) },
  { id: 'police', name: 'Police', category: 'professional', type: 'fulltime', hire: 'interview', stress: 2,
    req: { degree: 'high', minAge: 19, stats: { 'stats.health': 55 }, cleanRecord: true },
    levels: L(['Police officer', 44, 58, 4], ['Sergeant', 62, 78, 5], ['Lieutenant', 82, 100, 5], ['Chief of police', 115, 160, 0]) },
  { id: 'office', name: 'Office administration', category: 'professional', type: 'fulltime', hire: 'interview', stress: 1,
    req: { degree: 'high' }, doors: [{ flag: 'internship', bonus: 0.2 }],
    levels: L(['Office assistant', 26, 34, 2], ['Administrator', 36, 46, 3], ['Office manager', 50, 68, 5], ['Operations director', 90, 130, 0]) },

  // ---------- Trades and services ----------
  { id: 'retail', name: 'Retail', category: 'trade', type: 'fulltime', hire: 'interview', stress: 1, req: { minAge: 16 },
    levels: L(['Sales assistant', 22, 28, 2], ['Supervisor', 30, 38, 3], ['Store manager', 44, 62, 5], ['Regional manager', 75, 110, 0]) },
  { id: 'kitchen', name: 'Kitchens', category: 'trade', type: 'fulltime', hire: 'practical', stress: 2, req: { minAge: 16 },
    doors: [{ trade: 'chef', guaranteed: true, level: 1, text: 'Your chef\'s apprenticeship gets you straight onto the line.' }],
    levels: L(['Kitchen porter', 20, 25, 1], ['Line cook', 27, 35, 3], ['Sous chef', 40, 55, 4], ['Head chef', 62, 95, 0]) },
  { id: 'driver', name: 'Driving', category: 'trade', type: 'fulltime', hire: 'interview', stress: 1, req: { minAge: 18 },
    levels: L(['Delivery driver', 28, 36, 3], ['Truck driver', 42, 58, 5], ['Fleet supervisor', 60, 78, 0]) },
  { id: 'warehouse', name: 'Warehousing', category: 'trade', type: 'fulltime', hire: 'interview', stress: 1, req: { minAge: 16 },
    levels: L(['Warehouse operative', 24, 31, 2], ['Team leader', 33, 42, 4], ['Warehouse manager', 50, 70, 0]) },
  { id: 'firefighter', name: 'Fire service', category: 'trade', type: 'fulltime', hire: 'practical', stress: 2,
    req: { degree: 'high', minAge: 18, stats: { 'stats.health': 65 } },
    levels: L(['Firefighter', 42, 56, 4], ['Crew manager', 60, 74, 5], ['Station manager', 80, 100, 6], ['Fire chief', 110, 150, 0]) },
  journeyman('electrician', 'Electrician'),
  journeyman('plumber', 'Plumber'),
  journeyman('carpenter', 'Carpenter'),
  journeyman('mechanic', 'Mechanic'),
  journeyman('welder', 'Welder'),
  journeyman('hvac', 'Heating and cooling engineer'),
  { id: 'stage_tech', name: 'Stage crew', category: 'trade', type: 'fulltime', hire: 'practical', stress: 1, req: { minAge: 18 },
    doors: [{ trade: 'stage_tech', guaranteed: true, level: 1, text: 'Your apprenticeship makes you a stage technician from day one.' },
      { flag: 'proBackstage', bonus: 0.3 }, { flag: 'internship', bonus: 0.2 }],
    levels: L(['Stagehand', 26, 34, 2], ['Stage technician', 38, 52, 3], ['Head of stage', 56, 76, 5], ['Technical director', 85, 125, 0]) },

  // ---------- Hair and makeup (all need the cosmetology license) ----------
  { id: 'hair_stylist', name: 'Salon hair styling', category: 'beauty', type: 'fulltime', hire: 'practical', stress: 1,
    req: { program: 'cosmetology' }, focus: 'salon',
    levels: L(['Junior stylist', 24, 30, 2], ['Stylist', 34, 48, 3], ['Senior stylist', 52, 72, 5], ['Salon owner', 80, 140, 0]) },
  { id: 'bridal', name: 'Bridal hair and makeup', category: 'beauty', type: 'fulltime', hire: 'practical', stress: 1,
    req: { program: 'cosmetology' }, focus: 'bridal', doors: [{ flag: 'bridalClients', bonus: 0.25 }],
    levels: L(['Bridal assistant', 22, 28, 1], ['Bridal makeup artist', 36, 55, 3], ['Lead bridal artist', 60, 85, 5], ['Bridal studio owner', 90, 150, 0]) },
  { id: 'editorial', name: 'Runway and print makeup', category: 'beauty', type: 'fulltime', hire: 'practical', stress: 2,
    req: { program: 'cosmetology' }, focus: 'editorial', fame: { from: 3, label: 'Celebrity makeup artist' },
    levels: L(['Makeup assistant', 20, 26, 2], ['Runway makeup artist', 40, 62, 3], ['Key makeup artist', 75, 115, 5], ['Creative director', 130, 220, 0]) },
  { id: 'sfx', name: 'Special-effects makeup', category: 'beauty', type: 'fulltime', hire: 'practical', stress: 2,
    req: { program: 'cosmetology', stats: { 'stats.intellect': 50 } }, focus: 'sfx', doors: [{ flag: 'sfxPiece', bonus: 0.3 }],
    levels: L(['Workshop assistant', 26, 34, 2], ['Special-effects makeup artist', 48, 70, 4], ['Prosthetics designer', 80, 120, 5], ['Head of makeup effects', 130, 200, 0]) },
  { id: 'theater_hmu', name: 'Theater hair and makeup', category: 'beauty', type: 'fulltime', hire: 'practical', stress: 2,
    req: { program: 'cosmetology' }, focus: 'theater',
    doors: [{ flag: 'proBackstage', guaranteed: true, level: 1, text: 'The head of wigs who hired you once wants you back in the department.' },
      { flag: 'theaterCredit', bonus: 0.25 }],
    levels: L(['Dresser and wig assistant', 26, 34, 2], ['Wig and makeup artist', 40, 56, 3], ['Head of wigs', 60, 82, 5], ['Hair and makeup designer', 90, 140, 0]) },

  // ---------- Performing and creative ----------
  { id: 'mt_performer', name: 'Musical theater', category: 'performing', type: 'fulltime', hire: 'audition', stress: 2,
    skill: 'tripleThreat', req: { minAge: 18, stats: { tripleThreat: 55 } }, fame: { from: 2, label: 'Musical theater star' },
    doors: [{ flag: 'proDebut', guaranteed: true, level: 1, text: 'The company that cast you at the open call has your contract ready.' },
      { flag: 'childStageMajor', guaranteed: true, level: 0, text: 'You grew up on the biggest stage in the country. The company remembers you, and has a place for you in the ensemble.' },
      { flag: 'childStage', bonus: 0.2 }, { flag: 'directorRec', bonus: 0.1 }],
    levels: L(['Ensemble member', 28, 40, 2], ['Featured ensemble', 45, 65, 3, { tripleThreat: 66 }],
      ['Principal performer', 80, 130, 4, { tripleThreat: 78 }], ['Leading performer', 160, 320, 0, { tripleThreat: 88 }]) },
  // Children and teenagers can work as actors around school. At 18 they age
  // out, and what they did opens doors into screen acting (see tickCareer).
  { id: 'child_actor', name: 'Child acting', category: 'performing', type: 'freelance', hire: 'audition', stress: 1,
    skill: 'talents.acting', req: { minAge: 5, maxAge: 17, stats: { 'talents.acting': 35 } }, fame: { from: 2, label: 'Child actor' },
    agesOut: 18, schoolCost: 0.06,
    levels: L(['Child extra', 1, 4, 1], ['Advert and bit-part actor', 6, 18, 2, { 'talents.acting': 48 }],
      ['Child actor', 30, 90, 2, { 'talents.acting': 60 }], ['Child star', 150, 600, 0, { 'talents.acting': 74 }]) },
  { id: 'actor', name: 'Screen acting', category: 'performing', type: 'fulltime', hire: 'audition', stress: 2,
    skill: 'talents.acting', req: { minAge: 16, stats: { 'talents.acting': 50 } }, fame: { from: 1, label: 'Actor' },
    doors: [{ flag: 'childStar', guaranteed: true, level: 2, text: 'Everyone grew up watching you. A lead is yours for the asking.' },
      { flag: 'childActor', guaranteed: true, level: 1, text: 'Your years on set as a child count: you go straight to supporting parts.' },
      { flag: 'childExtra', bonus: 0.25 }],
    levels: L(['Background actor', 14, 22, 2], ['Supporting actor', 40, 80, 3, { 'talents.acting': 62 }],
      ['Lead actor', 150, 400, 4, { 'talents.acting': 76 }], ['Film star', 500, 2000, 0, { 'talents.acting': 88 }]) },
  { id: 'singer', name: 'Singing', category: 'performing', type: 'fulltime', hire: 'audition', stress: 2,
    skill: 'talents.singing', req: { minAge: 16, stats: { 'talents.singing': 50 } }, fame: { from: 1, label: 'Singer' },
    levels: L(['Pub singer', 12, 20, 2], ['Recording artist', 35, 80, 3, { 'talents.singing': 62 }],
      ['Chart artist', 200, 600, 4, { 'talents.singing': 76 }], ['Pop star', 600, 2500, 0, { 'talents.singing': 88 }]) },
  { id: 'athlete', name: 'Professional sport', category: 'performing', type: 'fulltime', hire: 'audition', stress: 2,
    skill: 'talents.sports', req: { minAge: 17, maxAge: 30, stats: { 'talents.sports': 70, 'stats.health': 60 } },
    retireAge: 36, fame: { from: 1, label: 'Athlete' }, doors: [{ flag: 'coachRec', bonus: 0.2 }],
    levels: L(['Reserve player', 35, 60, 2], ['Squad player', 90, 200, 3, { 'talents.sports': 78 }],
      ['First-team starter', 400, 1200, 4, { 'talents.sports': 86 }], ['Star player', 800, 3000, 0, { 'talents.sports': 93 }]) },
  { id: 'author', name: 'Writing books', category: 'performing', type: 'freelance', hire: 'portfolio', stress: 1,
    skill: 'stats.intellect', req: { minAge: 18, stats: { 'stats.intellect': 60 } }, fame: { from: 1, label: 'Author' },
    levels: L(['Unpublished writer', 4, 10, 2], ['Published author', 20, 50, 3, { 'stats.intellect': 68 }],
      ['Bestselling author', 150, 500, 4, { 'stats.intellect': 78 }], ['Literary star', 600, 2000, 0, { 'stats.intellect': 88 }]) },
  { id: 'influencer', name: 'Social media', category: 'performing', type: 'freelance', hire: 'portfolio', stress: 1,
    skill: 'stats.charm', req: { minAge: 16, stats: { 'stats.charm': 55 } }, fame: { from: 1, label: 'Social media influencer' },
    followersPerYear: [4000, 60000, 600000, 2500000],
    levels: L(['Content creator', 5, 15, 2], ['Influencer', 40, 120, 3, { 'social.followers': 10000 }],
      ['Top influencer', 150, 400, 4, { 'social.followers': 200000 }], ['Internet celebrity', 400, 1500, 0, { 'social.followers': 2000000 }]) },

  // ---------- Military ----------
  { id: 'enlisted', name: 'Enlist', category: 'military', type: 'military', hire: 'military', stress: 2,
    req: { minAge: 18, maxAge: 34, stats: { 'stats.health': 55 }, cleanRecord: true }, pensionAfter: 20,
    levels: L(['Private', 24, 30, 2], ['Corporal', 32, 40, 3], ['Sergeant', 44, 56, 5], ['Sergeant major', 64, 84, 0]) },
  { id: 'officer', name: 'Officer training', category: 'military', type: 'military', hire: 'military', stress: 2,
    req: { degree: 'university', maxAge: 34, stats: { 'stats.health': 55 }, cleanRecord: true }, pensionAfter: 20,
    levels: L(['Lieutenant', 48, 60, 3], ['Captain', 66, 82, 4], ['Major', 88, 108, 5], ['Colonel', 115, 145, 6], ['General', 170, 230, 0]) },
];
// The catalog (data/occupations.js) adds its tracks, and says what the older ones are like to work in.
for (const c of BASE_CAREERS) Object.assign(c, EXISTING[c.id] ?? {});
export const CAREERS = [...BASE_CAREERS, ...TRACKS];
for (const c of CAREERS) {
  c.family ??= c.category;
  c.hours ??= c.type === 'freelance' ? 25 : 40;
  c.schedule ??= c.type === 'freelance' ? 'flexible' : 'standard';
  c.remote ??= 'none';
  c.payModel ??= c.type === 'freelance' ? 'fees' : 'salary';
  c.values ??= [];
}
export const CAREER_BY_ID = Object.fromEntries(CAREERS.map((c) => [c.id, c]));
export { FAMILIES };

export const BRANCHES = ['Army', 'Navy', 'Air Force'];
export const RETIREMENT_AGE = 68;
export const EARLY_RETIREMENT_AGE = 55;

/**
 * One-off freelance gigs, each available once a year. pay is base units.
 * skill is the path that decides how well it goes and how much it pays.
 */
export const GIGS = [
  { id: 'tutoring', name: 'Tutor a school student', pay: 900, skill: 'stats.intellect', minAge: 16, req: { 'stats.intellect': 60 } },
  { id: 'dog_walking', name: 'Walk dogs', pay: 500, skill: 'stats.health', minAge: 12, req: {} },
  { id: 'wedding_singer', name: 'Sing at a wedding', pay: 1200, skill: 'talents.singing', minAge: 16, req: { 'talents.singing': 55 } },
  { id: 'dance_teacher', name: 'Teach a children\'s dance class', pay: 1000, skill: 'talents.dance', minAge: 16, req: { 'talents.dance': 55 } },
  { id: 'event_makeup', name: 'Do makeup for an event', pay: 1400, skill: 'stats.charm', minAge: 18, req: {}, program: 'cosmetology' },
  { id: 'copywriting', name: 'Write copy for a local business', pay: 1100, skill: 'stats.intellect', minAge: 18, req: { 'stats.intellect': 55 } },
  { id: 'website', name: 'Build someone a website', pay: 2200, skill: 'stats.intellect', minAge: 16, req: { 'stats.intellect': 65 } },
  { id: 'coaching', name: 'Coach a youth team', pay: 900, skill: 'talents.sports', minAge: 17, req: { 'talents.sports': 55 } },
];
export const MAX_GIGS_PER_YEAR = 2;

/** What the famous can do. min is the fame needed. cash is base units before fame scaling. */
export const FAME_ACTIONS = [
  { id: 'book', name: 'Write a book', min: 15, skill: 'stats.intellect', cash: 40000, fame: 5,
    ok: 'Your book comes out to queues round the block.', fail: 'Your book is politely reviewed and quickly remaindered.' },
  { id: 'photoshoot', name: 'Do a photoshoot', min: 20, skill: 'stats.charm', cash: 15000, fame: 3,
    ok: 'The cover sells out in a week.', fail: 'The photos are fine. Nobody mentions them.' },
  { id: 'commercial', name: 'Film a commercial', min: 30, skill: 'stats.charm', cash: 90000, fame: 2, karma: -2,
    ok: 'Your face is on every bus shelter in the country, holding a yogurt.', fail: 'The advert is pulled after a week of complaints.' },
  { id: 'talk_show', name: 'Go on a talk show', min: 35, skill: 'stats.charm', cash: 8000, fame: 8, risky: true,
    ok: 'You tell one story and the clip is everywhere by morning.', fail: 'You say the wrong thing on live television. The clip is everywhere by morning.' },
];

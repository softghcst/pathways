// University majors. difficulty lowers yearly GPA; minGpa is the high-school
// GPA needed to be considered; yearly gains apply each year of study.
// tracks: postgraduate routes the degree opens beyond plain graduate school.
// audition: true means entry is decided by performance skill, not grades alone.
const M = (id, name, difficulty, minGpa, yearly, tracks = [], extra = {}) =>
  ({ id, name, difficulty, minGpa, yearly, tracks, ...extra });

export const MAJORS = [
  M('engineering', 'Engineering', 0.55, 3.4, { stats: { intellect: 2 }, hidden: { discipline: 1 } }),
  M('mathematics', 'Mathematics', 0.55, 3.3, { stats: { intellect: 3 } }),
  M('computer_science', 'Computer Science', 0.45, 3.2, { stats: { intellect: 2 } }),
  M('chemistry', 'Chemistry', 0.5, 3.2, { stats: { intellect: 2 } }, ['medical']),
  M('biology', 'Biology', 0.45, 3.1, { stats: { intellect: 2 } }, ['medical']),
  M('nursing', 'Nursing', 0.35, 3.0, { stats: { intellect: 1 }, hidden: { karma: 2 } }, ['medical']),
  M('finance', 'Finance', 0.35, 3.0, { stats: { intellect: 1 } }, ['law']),
  M('psychology', 'Psychology', 0.25, 2.6, { stats: { intellect: 1, charm: 1 } }, ['medical']),
  M('political_science', 'Political Science', 0.25, 2.7, { stats: { charm: 1, intellect: 1 } }, ['law']),
  M('history', 'History', 0.25, 2.5, { stats: { intellect: 1 } }, ['law']),
  M('english', 'English Literature', 0.2, 2.5, { stats: { intellect: 1 } }, ['law']),
  M('criminal_justice', 'Criminal Justice', 0.2, 2.3, { hidden: { discipline: 2 } }, ['law']),
  M('business', 'Business', 0.2, 2.3, { stats: { charm: 1 } }, ['law']),
  M('education', 'Education', 0.15, 2.2, { hidden: { karma: 2 }, stats: { charm: 1 } }),
  M('communications', 'Communications', 0.1, 2.0, { stats: { charm: 2 } }),
  M('art', 'Fine Art', 0.1, 2.0, { stats: { mood: 2 } }),
  M('music', 'Music', 0.2, 2.0, { talents: { music: 5, singing: 2 } }),
  M('theater', 'Theater', 0.15, 2.0, { talents: { acting: 5 }, stats: { charm: 1 } }),
  M('journalism', 'Journalism', 0.25, 2.6, { stats: { intellect: 1, charm: 1 } }, ['law']),
  // BA: performance alongside a broad degree. BFA: conservatory-style, almost
  // all studio time, a tougher audition and much faster skill growth.
  M('musical_theater', 'Musical Theater (BA)', 0.2, 2.0,
    { talents: { singing: 4, dance: 4, acting: 4 }, stats: { intellect: 1 } }, [],
    { audition: true, auditionBase: 0.3, blurb: 'Performance classes inside a broad degree. Easier audition, steady growth.' }),
  M('musical_theater_bfa', 'Musical Theater (BFA)', 0.3, 2.0,
    { talents: { singing: 7, dance: 7, acting: 7 }, stats: { health: 1 } }, [],
    { audition: true, auditionBase: 0.12, blurb: 'Conservatory training: studio all day, shows at night. Hard to get into, fastest growth.' }),
  // Dance, judged at audition on dancing alone (auditionSkill). The BFA is a conservatory: ballet, modern and jazz
  // every day, and it is what companies, tours and choreographers look for (engine/dance.js danceTraining).
  M('dance', 'Dance (BA)', 0.2, 2.0,
    { talents: { dance: 5 }, stats: { health: 1, intellect: 1 } }, [],
    { audition: true, auditionBase: 0.3, auditionSkill: 'talents.dance', blurb: 'Technique classes inside a broad degree. Easier audition, steady growth.' }),
  M('dance_bfa', 'Dance (BFA)', 0.3, 2.0,
    { talents: { dance: 8 }, stats: { health: 2 } }, [],
    { audition: true, auditionBase: 0.12, auditionSkill: 'talents.dance', blurb: 'Conservatory training: ballet, modern and jazz every day. Hard to get into, fastest growth.' }),
];

export const MAJOR_BY_ID = Object.fromEntries(MAJORS.map((m) => [m.id, m]));

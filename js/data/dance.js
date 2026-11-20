// A dancer's working life outside a company (data/occupations.js 'dance' is the company ladder): gigs booked one at a
// time, from a music video to a season on a cruise ship to a celebrity's tour, and competitions from a regional
// contest at six to the world championships. engine/dance.js runs them.

/**
 * Gigs a dancer auditions for, one by one. Each year brings a handful (DANCE_YEAR), the bigger ones only to dancers
 * who are ready for them.
 *   bar       the dance skill the client is looking for (training, the right style and a record all help)
 *   fee       the pay for the job, in base units (scaled to the country's wages)
 *   weeks     how long it lasts; hours, how many hours a week while it does (0: a few days, around everything else)
 *   prestige  what it is worth on a dancer's record, to the next client and to the people who notice
 *   audience  who notices (engine/fame.js), if anyone
 *   star      it is for a music act (a video, a tour, choreography): one of the country's acts, by name
 *   brand     it is for a brand (a commercial)
 *   team      it is for a professional sports team
 *   agent     it is cast through agents: a dancer without one is not seen
 *   after     the number of dance jobs on a dancer's record before they are considered
 *   away      it takes the dancer away from home for its length
 *   show      the televised dance competition (DANCE_SHOW): the dancer partners a celebrity for a season
 */
export const DANCE_GIGS = {
  commercial: { name: 'Commercial', minAge: 6, bar: 45, fee: 3500, weeks: 1, hours: 0, prestige: 8, audience: 'public', brand: true },
  video: { name: 'Music video', minAge: 16, bar: 52, fee: 2200, weeks: 1, hours: 0, prestige: 12, audience: 'music', star: true },
  theme_park: { name: 'Theme park season', minAge: 16, bar: 45, fee: 22000, weeks: 26, hours: 30, prestige: 3 },
  squad: { name: 'Pro team dance squad', minAge: 18, bar: 58, fee: 9000, weeks: 30, hours: 10, prestige: 12, audience: 'sports', team: true },
  cruise: { name: 'Cruise ship contract', minAge: 18, bar: 55, fee: 30000, weeks: 30, hours: 40, prestige: 5, away: true },
  revue: { name: 'Resort revue', minAge: 18, bar: 66, fee: 48000, weeks: 44, hours: 36, prestige: 15 },
  tour: { name: 'Backup dancer on tour', minAge: 18, bar: 72, fee: 40000, weeks: 18, hours: 40, prestige: 30, audience: 'music', star: true, agent: true, away: true },
  choreo: { name: 'Choreograph a music video', minAge: 20, bar: 76, fee: 14000, weeks: 3, hours: 0, prestige: 25, audience: 'music', star: true, after: 4 },
  tv_pro: { name: 'Pro on Prancing with the Stars', minAge: 20, bar: 82, fee: 85000, weeks: 12, hours: 40, prestige: 55, audience: 'tv', agent: true, after: 3, show: true },
};

/**
 * The year's gigs: how many are on offer, and how many a dancer can go for around everything else. Training and a
 * record of jobs both help a dancer get seen: what they add to the odds (each point of skill over the bar: 1/25).
 */
export const DANCE_YEAR = {
  offers: 5, auditions: 4, reach: 12,
  training: { bfa: 4, ba: 2, theater: 1 },
  record: { per: 0.02, most: 0.12 },
  agent: 0.06,
  style: { right: 0.15, wrong: -0.1 },
};

/** The styles a dancer can bring to an audition or a competition. A client's brief hints at the one they want. */
export const DANCE_STYLES = {
  hiphop: { label: 'Hip-hop and street', sub: 'Hard-hitting, grounded, all attitude.' },
  jazz: { label: 'Jazz and commercial', sub: 'Big, sharp, sold to the back row.' },
  contemporary: { label: 'Contemporary and lyrical', sub: 'Breath, floor work, something felt.' },
  ballroom: { label: 'Ballroom and Latin', sub: 'Frame, footwork, a partner, and a smile.' },
  ballet: { label: 'Classical', sub: 'Line, turnout, the discipline of the barre.' },
};
/** What the gigs ask for. A brief is said in the client's words; it hints at a style without naming it. */
export const DANCE_WANTS = {
  commercial: ['jazz', 'hiphop', 'contemporary'], video: ['hiphop', 'jazz', 'contemporary'], theme_park: ['jazz', 'ballet'], squad: ['jazz', 'hiphop'],
  cruise: ['jazz', 'ballroom'], revue: ['jazz', 'ballroom', 'ballet'], tour: ['hiphop', 'jazz'], choreo: ['hiphop', 'contemporary', 'jazz'], tv_pro: ['ballroom'],
};
export const DANCE_BRIEFS = {
  hiphop: ['"We want it to hit. Grit, not polish."', '"Street. Real. Nobody should look like they took a class."'],
  jazz: ['"Kicks, turns, a smile at the top of the jump."', '"Showbiz. Make it sparkle."'],
  contemporary: ['"Something people feel, not something they watch."', '"Slow, then not. Let it breathe."'],
  ballroom: ['"Partnering. Lifts, frame, the old glamour."', '"Ballroom basics and a lot of sequins."'],
  ballet: ['"Classical line. The kind of feet you cannot fake."', '"Clean technique, every count."'],
};
/** Who books a dancer: brands for commercials (data/fame.js BRANDS), and these for the rest. */
export const DANCE_CLIENTS = {
  theme_park: ['Starlight Kingdom', 'Thunder Mountain Park', 'Wonder Coast', 'Funland Gardens'],
  cruise: ['Ocean Ballad Cruises', 'Blue Horizon Line', 'Coral Star Voyages'],
  revue: ['the Golden Palms Resort', 'the Velvet Room revue', 'the Grand Mirage showroom'],
  squad: ['the city\'s basketball team', 'the city\'s football team', 'the hockey club'],
};

/**
 * The televised dance competition: celebrities paired with professional dancers, one couple voted off each week. Its
 * name tips its hat to a famous show. A season is eleven weeks; the couple's dancing and the celebrity's fans decide,
 * against the other couples (`rivals`: how they score; the other professionals are among the best in the country).
 */
export const DANCE_SHOW = { name: 'Prancing with the Stars', weeks: 11, couples: 12, audience: 'tv', rivals: 60 };

/**
 * Dance competitions: a routine against a field, judged. A child enters from six (a parent takes them and pays);
 * a grown dancer from eighteen. A place in the top three at one level opens the next.
 *   bar    how good the field is, for children and for adults; field: how many routines in a category
 *   fee    the entry fee (base units, a grown dancer's to pay); prize: for a win (a child's is a scholarship)
 */
export const DANCE_COMPETITIONS = {
  regional: { name: 'Regional dance competition', bar: { kid: 42, adult: 50 }, field: 10, fee: 60, prize: { kid: 0, adult: 500 }, fame: 0 },
  national: { name: 'National dance championships', bar: { kid: 56, adult: 66 }, field: 14, fee: 250, prize: { kid: 1000, adult: 5000 }, fame: 2, after: 'regional' },
  world: { name: 'World dance championships', bar: { kid: 68, adult: 80 }, field: 18, fee: 900, prize: { kid: 5000, adult: 25000 }, fame: 6, after: 'national' },
};
export const COMPETITIONS_A_YEAR = 2;

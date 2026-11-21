// Health care, cosmetic surgery, leisure, social media and emigration.
// Money is in base units.

/**
 * What a doctor can do for each condition. chance is the odds treatment works.
 * manage: true means it cannot be cured, only kept under control (most of
 * its yearly harm goes away for as long as you stay on treatment).
 */
export const TREATMENTS = {
  flu: { cost: 80, chance: 0.95 },
  ear_infection: { cost: 80, chance: 0.95 },
  broken_arm: { cost: 1500, chance: 0.95 },
  acne: { cost: 300, chance: 0.7 },
  asthma: { cost: 400, chance: 0.9, manage: true },
  anxiety: { cost: 900, chance: 0.6 },
  depression: { cost: 900, chance: 0.6 },
  back_pain: { cost: 1200, chance: 0.5 },
  high_bp: { cost: 500, chance: 0.9, manage: true },
  diabetes: { cost: 900, chance: 0.9, manage: true },
  broken_hip: { cost: 12000, chance: 0.8 },
  heart_disease: { cost: 25000, chance: 0.75, manage: true },
  cancer: { cost: 60000, chance: 0.55 },
  botched_surgery: { cost: 9000, chance: 0.7 },
};
/** Where health care is public, patients pay this share of the cost. */
export const PUBLIC_CARE_SHARE = 0.05;
export const CHECKUP_COST = 200;
export const THERAPY_COST = 1200;

/** Cosmetic procedures. gain: Charm added when it goes well. */
export const SURGERIES = [
  { id: 'teeth', name: 'Cosmetic dentistry', cost: 4000, gain: [3, 6], risk: 0.03, minAge: 18 },
  { id: 'nose', name: 'Nose reshaping', cost: 7000, gain: [4, 9], risk: 0.08, minAge: 18 },
  { id: 'lipo', name: 'Liposuction', cost: 6000, gain: [3, 8], risk: 0.1, minAge: 18 },
  { id: 'hair', name: 'Hair transplant', cost: 9000, gain: [3, 7], risk: 0.06, minAge: 25 },
  { id: 'reshape', name: 'Facial reshaping', cost: 8000, gain: [2, 5], risk: 0.07, minAge: 18, reshape: true },
  { id: 'facelift', name: 'Facelift', cost: 15000, gain: [6, 12], risk: 0.12, minAge: 40 },
];
/** Who holds the knife. cost and risk multiply the procedure's own. */
export const SURGEONS = [
  { id: 'budget', name: 'A cut-price clinic', cost: 0.45, risk: 2.6, blurb: 'Cheap, quick, and a long way from home.' },
  { id: 'standard', name: 'A reputable surgeon', cost: 1, risk: 1, blurb: 'Qualified, insured, booked up for months.' },
  { id: 'renowned', name: 'A renowned surgeon', cost: 3, risk: 0.3, blurb: 'Does the faces you see on screen.' },
];

/** Things to do, once a year each. */
export const GYM_COST = 400;
export const NIGHT_OUT_COST = 120;
export const NIGHTLIFE_AGE = 18;

/**
 * Things done for the sake of charm, once a year each. cost in base units; charm: the range gained (less as charm
 * gets high: being liked has diminishing returns); minAge; the rest is what else it does.
 */
export const CHARM_ACTIVITIES = [
  { id: 'style', label: 'A stylist and a new wardrobe', cost: 900, minAge: 14, charm: [2, 4], mood: 3,
    text: 'A stylist went through your wardrobe without mercy. You walk into rooms differently now.' },
  { id: 'speaking', label: 'Public speaking course', cost: 150, minAge: 14, charm: [2, 3], willpower: 2,
    text: 'Every week of the course you stood up and talked while strangers timed you. By the end of the year you could hold a room.' },
  { id: 'dance', label: 'Dance classes', cost: 350, minAge: 8, charm: [1, 3], health: 2, mood: 2,
    text: 'Two left feet, then one, then none. You move better, and it shows when you walk in anywhere.' },
  { id: 'improv', label: 'Improv class', cost: 250, minAge: 12, charm: [2, 3], mood: 3, acting: 2,
    text: 'You learned to say "yes, and" and mean it. You are quicker in conversation, and funnier.' },
  { id: 'etiquette', label: 'Etiquette course', cost: 600, minAge: 10, charm: [1, 3], discipline: 1,
    text: 'Which fork, how to introduce people, when to write a thank-you note. Small things that people notice.' },
];

/**
 * Holidays. cost is for one person, in base units; each companion adds 60%.
 * kind groups them in the menu. mood/health/intellect/charm are what the
 * traveler gains. kids: how much closer children aged 3 to 15 feel afterward.
 * home: the country the place is in; travelers from elsewhere pay farMult more.
 * risky: chance of an injury. sea / park pick the mishaps and the stories.
 */
export const HOLIDAY_KINDS = [
  { id: 'getaway', name: 'A getaway', blurb: 'Camping, a city, a beach, a mountain, or the whole world.' },
  { id: 'park', name: 'A theme park', blurb: 'Rides, queues, fireworks. Children never forget it.' },
  { id: 'cruise', name: 'A cruise', blurb: 'Unpack once and let the ports come to you.' },
  { id: 'flight', name: 'Fly abroad', blurb: 'Pick a country and a seat, and go.' },
];
export const HOLIDAYS = [
  { id: 'camping', kind: 'getaway', name: 'A week camping', cost: 300, mood: 6, health: 2, kids: 6 },
  { id: 'city', kind: 'getaway', name: 'A city break', cost: 1500, mood: 9, intellect: 1 },
  { id: 'beach', kind: 'getaway', name: 'Two weeks at a beach resort', cost: 4500, mood: 13, health: 2, kids: 8 },
  { id: 'adventure', kind: 'getaway', name: 'A trekking adventure', cost: 7000, mood: 12, health: 4, risky: 0.06 },
  { id: 'world', kind: 'getaway', name: 'A month going round the world', cost: 22000, mood: 18, intellect: 3, charm: 2 },

  { id: 'disneyland', kind: 'park', name: 'Three days at Disneyland, California', cost: 2800, mood: 12, kids: 14, home: 'us', farMult: 1.7 },
  { id: 'disney_world', kind: 'park', name: 'A week at Walt Disney World, Florida', cost: 6000, mood: 15, kids: 18, home: 'us', farMult: 1.5 },
  { id: 'universal', kind: 'park', name: 'Four days at Universal Studios', cost: 3600, mood: 13, kids: 13, home: 'us', farMult: 1.6, thrill: true },
  { id: 'local_park', kind: 'park', name: 'A weekend at the nearest theme park', cost: 600, mood: 7, kids: 8 },

  { id: 'cruise_week', kind: 'cruise', name: 'A week\'s cruise', cost: 3800, mood: 11, health: 1, kids: 7 },
  { id: 'cruise_fjords', kind: 'cruise', name: 'Two weeks cruising the fjords', cost: 9000, mood: 14, intellect: 2 },
  { id: 'cruise_world', kind: 'cruise', name: 'A world cruise, three months', cost: 48000, mood: 20, intellect: 3, charm: 2 },
];
/** Flying abroad: two weeks in the country you choose. cost is the whole trip for one. */
export const CABINS = [
  { id: 'economy', name: 'Economy', cost: 3200, mood: 10, blurb: 'Knees against the seat in front. You get there.' },
  { id: 'business', name: 'Business class', cost: 8500, mood: 12, blurb: 'A seat that becomes a bed, and a real glass.' },
  { id: 'first', name: 'First class', cost: 19000, mood: 14, charm: 1, blurb: 'A door that closes, and someone who knows your name.' },
];
/** What a good trip is remembered for, by kind. One is picked at random. */
export const TRIP_STORIES = {
  getaway: ['The weather held all week.', 'You slept better than you have in years.', 'You took four hundred photographs and like eleven of them.'],
  park: ['You queued ninety minutes for two minutes of screaming and would do it again.', 'The fireworks over the castle got to you more than you expected.',
    'You bought the hat. Everybody bought the hat.', 'You rode the biggest one twice, with your eyes shut both times.'],
  thrill: ['You walked through film sets you have known since you were small.', 'You rode the biggest one twice, with your eyes shut both times.',
    'The stunt show set fire to something large, on purpose, to great applause.'],
  cruise: ['You ate five meals a day and regret none of them.', 'Dolphins ran alongside the ship one morning, and the whole deck went quiet.',
    'You won the quiz night with a team of strangers.', 'You watched every sunset from the same chair.'],
  flight: ['You got happily lost in the back streets.', 'You ate something you could not name and went back for it twice.',
    'A stranger walked you half a mile out of their way to show you the right road.', 'You came home with a suitcase of things you did not need.'],
};


/** Social media. */
export const SOCIAL_AGE = 13;
export const POSTS_PER_YEAR = 3;
export const FOLLOWER_PACKS = [
  { count: 1000, cost: 60 },
  { count: 10000, cost: 400 },
  { count: 100000, cost: 3000 },
];
export const FOLLOWER_MILESTONES = [10000, 100000, 1000000, 10000000];

/** Emigrating. fee covers visas, lawyers and shipping. */
export const EMIGRATION = { fee: 6000, minAge: 18 };

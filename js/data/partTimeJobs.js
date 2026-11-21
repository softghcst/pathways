// Part-time jobs for teenagers, students and anyone wanting a few hours a
// week. pay is base units a year at the hours given; hours is a week's shifts.
//   campus: needs current enrollment at a university or college (reviewed when the course ends)
//   next:   the career track this work can lead into, if the employer likes you
//   minAge is the job's own floor; the country's working-age law (data/workLaw.js) applies on top.
const J = (id, title, place, pay, hours, minAge, hire, o = {}) => ({ id, title, place, pay, hours, minAge, hire, ...o });
const easy = (charm = 0.4, discipline = 0.3) => ({ base: 0.7, factors: { 'stats.charm': charm, 'hidden.discipline': discipline } });

export const PART_TIME_JOBS = [
  J('cafe', 'Café assistant', 'the café by the station', 3600, 12, 15, easy(0.5, 0.3), { next: 'cafe' }),
  J('cinema', 'Movie theater usher', 'the movie theater', 3200, 10, 15, { base: 0.7, factors: { 'stats.charm': 0.4 } }),
  J('supermarket', 'Shelf stacker', 'the supermarket', 4000, 12, 16, { base: 0.75, factors: { 'hidden.discipline': 0.4 } }, { next: 'grocery' }),
  J('barista', 'Barista', 'a coffee chain on Main Street', 4200, 14, 16, easy(0.5, 0.3), { next: 'cafe' }),
  J('cashier', 'Cashier', 'a convenience store', 3800, 12, 16, easy(0.3, 0.4), { next: 'grocery' }),
  J('retail_pt', 'Retail assistant', 'a clothes shop in the mall', 4000, 12, 16, easy(0.5, 0.2), { next: 'retail' }),
  J('babysitter', 'Babysitter', 'a family down the street', 2600, 8, 14, { base: 0.65, factors: { 'stats.charm': 0.3, 'hidden.discipline': 0.4 } }),
  J('ice_cream', 'Ice-cream shop worker', 'the ice-cream parlor', 3000, 10, 15, easy(0.4, 0.2)),
  J('lifeguard_pt', 'Lifeguard', 'the public pool', 4400, 12, 16, { base: 0.55, factors: { 'stats.health': 0.6 } }, { next: 'lifeguard', req: { 'stats.health': 55 } }),
  J('swim_pt', 'Swim instructor', 'the leisure center', 4600, 10, 16, { base: 0.5, factors: { 'stats.health': 0.5, 'stats.charm': 0.3 } }, { next: 'swim_teach', req: { 'stats.health': 55 } }),
  J('fitness_pt', 'Fitness instructor', 'a local gym', 5200, 10, 17, { base: 0.5, factors: { 'stats.health': 0.6 } }, { next: 'fitness', req: { 'stats.health': 60 } }),
  J('dance_pt', 'Dance instructor', 'a children\'s dance school', 4800, 8, 16, { base: 0.5, factors: { 'talents.dance': 0.7 } }, { req: { 'talents.dance': 55 } }),
  J('golf_pt', 'Golf shop clerk', 'the golf club', 3800, 10, 15, easy(0.4, 0.2), { next: 'golf_course' }),
  J('office_pt', 'Office assistant', 'a small accountancy firm', 5000, 14, 16, { base: 0.6, factors: { 'hidden.discipline': 0.5 } }, { next: 'admin_support' }),
  J('hotel_pt', 'Hotel front-desk clerk', 'a hotel in the center', 4800, 14, 17, easy(0.5, 0.2), { next: 'hotel' }),
  J('tester_pt', 'Video game tester', 'a games studio', 4600, 12, 16, { base: 0.5, factors: { 'stats.intellect': 0.5, 'hidden.discipline': 0.3 } }, { next: 'qa', from: 1980 }),
  J('delivery_pt', 'Delivery rider', 'a food delivery app', 4400, 12, 18, { base: 0.85, factors: { 'stats.health': 0.2 } }, { next: 'driver' }),
  J('tutor_pt', 'Tutor', 'a tutoring agency', 5200, 8, 16, { base: 0.45, factors: { 'stats.intellect': 0.7 } }, { req: { 'stats.intellect': 60 } }),
  J('camp_pt', 'Camp counselor', 'a summer camp', 3000, 10, 16, easy(0.5, 0.3), { next: 'recreation' }),
  J('gym_desk', 'Gym receptionist', 'a gym on the ring road', 3600, 12, 16, easy(0.4, 0.3), { next: 'fitness' }),
  J('paper_round', 'Newspaper delivery worker', 'the local newsagent', 1800, 6, 13, { base: 0.85, factors: { 'hidden.discipline': 0.4 } }),
  J('mystery', 'Mystery shopper', 'a market-research firm', 2000, 4, 18, easy(0.2, 0.4)),
  // On campus: for students only.
  J('library', 'Library assistant', 'the university library', 4000, 10, 17, { base: 0.7, factors: { 'hidden.discipline': 0.4 } }, { campus: true }),
  J('tour_guide', 'Campus tour guide', 'the admissions office', 3600, 8, 17, easy(0.6, 0.1), { campus: true }),
  J('research_pt', 'Research assistant', 'a professor\'s lab', 5400, 12, 18, { base: 0.4, factors: { 'stats.intellect': 0.8 } }, { campus: true, next: 'research_asst', req: { 'stats.intellect': 60 } }),
  J('lab_pt', 'Laboratory assistant', 'the science faculty', 5000, 12, 18, { base: 0.45, factors: { 'stats.intellect': 0.6 } }, { campus: true, next: 'lab' }),
  J('ra', 'Resident assistant', 'the halls of residence', 4600, 12, 19, { base: 0.5, factors: { 'stats.charm': 0.4, 'hidden.discipline': 0.4 } }, { campus: true }),
  J('cafeteria', 'Cafeteria worker', 'the student canteen', 3400, 12, 17, easy(0.3, 0.3), { campus: true, next: 'kitchen' }),
];
export const PART_TIME_BY_ID = Object.fromEntries(PART_TIME_JOBS.map((j) => [j.id, j]));

/** Extra pay for covering a colleague's shift, in base units. */
export const COVER_SHIFT_PAY = 250;

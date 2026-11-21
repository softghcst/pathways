import { st, hid, tal, cash, rel, flag, gpa, heat, count, ms, addNpc, ok, bad, any, chk, need, mem } from './helpers.js';

const enrolled = need('education.enrolled', '==', true);
const at = (stage) => [enrolled, need('education.stage', '==', stage)];

/** @type {import('../../types.js').GameEvent[]} */
export default [
  {
    id: 'lunch_money', category: 'school', ageRange: [6, 11], requires: [enrolled],
    text: 'A kid from the year above blocks the corridor and holds out a hand for your lunch money.',
    choices: [
      { label: 'Hand it over', outcomes: [any('You go hungry. They will be back tomorrow.', 'bad', st('mood', -6), hid('willpower', -2))] },
      { label: 'Refuse and stand your ground', check: chk(0.45, { 'hidden.willpower': 0.5, 'talents.sports': 0.3 }), outcomes: [
        ok('You say no and keep saying it. They shrug and pick someone easier.', hid('willpower', 5), st('mood', 5)),
        bad('You get shoved into the coat pegs. {bully} has decided you are a project.', st('health', -3), st('mood', -6), addNpc('enemy', 'bully', { relationship: 5, ageOffset: 1 })),
      ] },
      { label: 'Tell a teacher', outcomes: [any('The teacher deals with it quietly. Lunch is safe for now.', 'good', st('mood', 2))] },
      { label: 'Offer to share your lunch instead', check: chk(0.4, { 'stats.charm': 0.6, 'hidden.karma': 0.3 }), outcomes: [
        ok('It turns out {pal} never has lunch of their own. You eat together from then on.', addNpc('friend', 'pal', { ageOffset: 1 }), hid('karma', 6), st('mood', 5)),
        bad('They take the whole lot and laugh.', st('mood', -6)),
      ] },
    ],
  },
  {
    id: 'science_fair', category: 'school', ageRange: [9, 14], requires: [enrolled], cooldown: 4,
    text: 'The science fair is in three weeks and everyone has to enter something.',
    choices: [
      { label: 'Build something ambitious', check: chk(0.4, { 'stats.intellect': 0.8, 'hidden.discipline': 0.3 }), outcomes: [
        ok('Your working water filter wins first prize and a {$50} book token.', st('intellect', 4), st('mood', 8), gpa(0.15), cash(50)),
        bad('It floods the display table and the project next to yours.', st('mood', -5), st('intellect', 2)),
      ] },
      { label: 'Do the baking-soda volcano', outcomes: [any('It erupts on cue. So do the four other volcanoes.', 'neutral', st('mood', 1))] },
      { label: 'Get a parent to build it', outcomes: [any('It is suspiciously well soldered. The judges ask you questions you cannot answer.', 'bad', hid('karma', -3), gpa(-0.05), st('mood', -2))] },
    ],
  },
  {
    id: 'wrongly_blamed', category: 'school', ageRange: [10, 17], requires: [enrolled],
    text: 'Someone set off the fire alarm and a teacher is certain it was you. It was not.',
    choices: [
      { label: 'Calmly explain where you were', check: chk(0.5, { 'stats.charm': 0.5, 'stats.intellect': 0.3 }), outcomes: [
        ok('Your story checks out. The teacher even apologizes.', st('mood', 3)),
        bad('Nobody believes you. A week of detentions.', st('mood', -6), hid('karma', 1)),
      ] },
      { label: 'Name who really did it', outcomes: [any('You are cleared. You are also now known as a grass.', 'neutral', st('charm', -3), hid('karma', -1))] },
      { label: 'Take the punishment', outcomes: [any('You do the detentions. Whoever did it owes you, and knows it.', 'neutral', hid('willpower', 4), st('charm', 2), st('mood', -3))] },
    ],
  },
  {
    id: 'group_project', category: 'school', ageRange: [11, 26], requires: [enrolled], cast: { mate: 'classmate' },
    text: 'You are put in a group project with {mate}, who has done nothing for two weeks.',
    choices: [
      { label: 'Do the whole thing yourself', outcomes: [any('Top marks for the group. {mate} thanks you without much shame.', 'good', gpa(0.12), st('mood', -4), hid('discipline', 3), rel('mate', 4))] },
      { label: 'Have it out with them', check: chk(0.5, { 'stats.charm': 0.5, 'hidden.willpower': 0.3 }), outcomes: [
        ok('{mate} had no idea you were annoyed and pulls their weight from then on.', gpa(0.1), rel('mate', 8)),
        bad('It becomes a shouting match in the library.', gpa(-0.05), rel('mate', -15), st('mood', -4)),
      ] },
      { label: 'Do nothing as well', outcomes: [any('You both present four slides and a great deal of silence.', 'bad', gpa(-0.2), rel('mate', 5))] },
    ],
  },
  {
    id: 'teacher_notice', category: 'school', ageRange: [10, 17], requires: [enrolled], once: true,
    text: 'A teacher keeps you back after class and says you could be doing far better than you are.',
    choices: [
      { label: 'Take the extra work they offer', outcomes: [any('It is hard, and by spring you can feel the difference.', 'good', st('intellect', 5), gpa(0.2), hid('discipline', 4), st('mood', -2))] },
      { label: 'Nod and change nothing', outcomes: [any('They look disappointed for the rest of the year.', 'neutral', hid('discipline', -2))] },
      { label: 'Tell them to mind their own business', outcomes: [any('You are marked a little harder from then on.', 'bad', gpa(-0.1), hid('karma', -3))] },
    ],
  },
  {
    id: 'pop_quiz', category: 'school', ageRange: [11, 17], requires: [enrolled],
    text: 'Surprise test. You have not opened the book.',
    choices: [
      { label: 'Trust what you remember', check: chk(0.45, { 'stats.intellect': 0.9 }), outcomes: [
        ok('It comes back to you as you write. A respectable mark.', gpa(0.08), st('mood', 3)),
        bad('It does not come back to you.', gpa(-0.1), st('mood', -3)),
      ] },
      { label: 'Glance at your neighbor\'s paper', check: chk(0.5, { 'talents.crime': 0.6 }), outcomes: [
        ok('Their answers are good. Yours are now the same.', gpa(0.1), hid('karma', -4)),
        bad('Your paper is torn up in front of everyone.', gpa(-0.2), st('mood', -6), hid('karma', -4)),
      ] },
      { label: 'Ask to go to the nurse', check: chk(0.5, { 'talents.acting': 0.7 }), outcomes: [
        ok('You sit the test next week, having read the chapter.', gpa(0.05), tal('acting', 2)),
        bad('"Sit down." You sit down.', gpa(-0.1)),
      ] },
    ],
  },
  {
    id: 'school_trip', category: 'school', ageRange: [8, 13], requires: [enrolled], cooldown: 4,
    text: 'On the school trip to the coast, your group dares each other to climb past the safety rope.',
    choices: [
      { label: 'Climb over', check: chk(0.55, { 'talents.sports': 0.5 }), outcomes: [
        ok('The view is incredible and nobody tells.', st('mood', 6), hid('crazy', 2)),
        bad('You slip on wet rock and sprain your wrist. The whole class is marched back to the coach.', st('health', -5), st('mood', -5), st('charm', -2)),
      ] },
      { label: 'Stay behind the rope', outcomes: [any('You eat your sandwiches and watch a seal instead.', 'good', hid('discipline', 2), st('mood', 2))] },
      { label: 'Talk the others out of it', check: chk(0.4, { 'stats.charm': 0.7 }), outcomes: [
        ok('They grumble and follow you to the rock pools.', hid('karma', 4), st('charm', 2)),
        bad('They go anyway and call you boring.', st('mood', -3)),
      ] },
    ],
  },
  {
    id: 'leavers_dance', category: 'school', ageRange: [17, 17], requires: at('high'), once: true, weight: 3,
    text: 'The leavers\' dance is next month and everyone is pairing up.',
    choices: [
      { label: 'Ask someone you like', check: chk(0.45, { 'stats.charm': 0.8 }), outcomes: [
        ok('They say yes before you finish the sentence. It is a perfect night.', st('mood', 12), st('charm', 2), ms('Had a perfect night at the leavers\' dance.')),
        bad('They are going with someone else. You go anyway and it is fine, mostly.', st('mood', -5)),
      ] },
      { label: 'Go with your friends', outcomes: [any('You dance badly in a circle all night and regret nothing.', 'good', st('mood', 8))] },
      { label: 'Skip it', outcomes: [any('You stay in. You tell yourself you did not want to go.', 'neutral', st('mood', -3), cash(40))] },
    ],
  },
  {
    id: 'crowd_dare', category: 'school', ageRange: [14, 17], requires: [...at('high'), need('education.clique', '!=', false)],
    text: 'Your crowd wants to break into the school pool at night. They are all looking at you.',
    choices: [
      { label: 'Lead the way', check: chk(0.55, { 'talents.crime': 0.6 }), outcomes: [
        ok('Moonlight, cold water, nobody caught. They talk about it for years.', st('mood', 9), st('charm', 3), tal('crime', 3), count('crimes')),
        bad('The caretaker\'s torch finds you first. Two-week suspension.', gpa(-0.25), st('mood', -7), heat(10), count('crimes')),
      ] },
      { label: 'Go along but hang back', outcomes: [any('You keep watch at the fence. Nobody remembers you were there.', 'neutral', st('mood', 2))] },
      { label: 'Say you are out', outcomes: [any('They go without you. Monday is a bit cold.', 'neutral', hid('willpower', 3), st('charm', -2))] },
    ],
  },
  {
    id: 'class_clown', category: 'school', ageRange: [10, 15], requires: [enrolled],
    text: 'The supply teacher has lost control of the room and there is an opening for a joke.',
    choices: [
      { label: 'Take it', check: chk(0.5, { 'stats.charm': 0.6, 'talents.acting': 0.4 }), outcomes: [
        ok('The whole class is crying with laughter. Even the teacher cracks.', st('charm', 4), st('mood', 5), tal('acting', 2)),
        bad('Silence. Then you are sent to stand in the hallway.', st('mood', -4), gpa(-0.05)),
      ] },
      { label: 'Keep your head down and work', outcomes: [any('You finish the worksheet. Nobody else does.', 'good', gpa(0.05), hid('discipline', 2))] },
      { label: 'Help the teacher get order back', outcomes: [any('The teacher is grateful. Your classmates are not.', 'neutral', hid('karma', 4), st('charm', -2))] },
    ],
  },
  {
    id: 'uni_flatmate', category: 'campus life', ageRange: [18, 30], once: true, weight: 4,
    requires: [enrolled, need('education.housing', '==', 'dorm'), need('age', '>=', 18)],
    text: 'Your new dorm-mate has labeled every item in the fridge, including the butter.',
    choices: [
      { label: 'Introduce yourself properly', check: chk(0.6, { 'stats.charm': 0.6 }), outcomes: [
        ok('{mate} is just nervous. By the end of the semester you are inseparable.', addNpc('friend', 'mate'), st('mood', 6)),
        bad('The conversation lasts eleven seconds. You coexist.', st('mood', -1)),
      ] },
      { label: 'Eat the butter', outcomes: [any('A note appears on your door. Then another. {mate} never forgives you.', 'bad', addNpc('enemy', 'mate', { relationship: 8 }), hid('karma', -3), hid('crazy', 2))] },
      { label: 'Label your own things, more aggressively', outcomes: [any('An arms race of sticky notes. It is oddly bonding.', 'neutral', st('mood', 2))] },
    ],
  },
  {
    id: 'dorm_corridor', category: 'campus life', ageRange: [18, 30], cooldown: 3, weight: 2,
    requires: [enrolled, need('education.housing', '==', 'dorm'), need('age', '>=', 18)],
    text: 'It is 1 a.m. and the whole corridor has ended up in one room with a guitar and a bag of chips.',
    choices: [
      { label: 'Stay up with them', outcomes: [any('You talk until the sky goes gray. {pal}, from three doors down, becomes a fixture.', 'good', addNpc('friend', 'pal'), st('mood', 7), gpa(-0.05), st('health', -1))] },
      { label: 'Sing something', check: chk(0.5, { 'talents.singing': 0.8 }), outcomes: [
        ok('The room goes quiet, then loud. People you have never met know your name by breakfast.', st('charm', 3), st('mood', 6), tal('singing', 2)),
        bad('Someone turns the guitar up, kindly.', st('mood', -2)),
      ] },
      { label: 'Close your door', outcomes: [any('You get eight hours. You also miss whatever that was.', 'neutral', gpa(0.05), st('mood', -1))] },
    ],
  },
  {
    id: 'apartment_rent', category: 'campus life', ageRange: [18, 32], cooldown: 3, weight: 3,
    requires: [enrolled, need('education.housing', '==', 'apartment')], cast: { mate: 'tag:roommate' },
    text: 'Rent is due on Friday and {mate} is {$300} short. Again.',
    choices: [
      { label: 'Cover it and say nothing', requires: [need('cashBase', '>=', 300)], outcomes: [any(
        '{mate} pays you back in installments and by doing your dishes. Something between you gets sturdier.', 'good',
        cash(-300), rel('mate', 10), hid('karma', 4), mem('mate', 'coveredRent', 'You covered their share of the rent without making it a thing.'))] },
      { label: 'Sit down and work out a budget together', check: chk(0.55, { 'stats.charm': 0.4, 'cast.mate.relationship': 0.5 }), outcomes: [
        ok('An awkward hour with a spreadsheet. It does not happen again.', rel('mate', 6), st('intellect', 1)),
        bad('It turns into a list of everything each of you has ever left in the sink.', rel('mate', -12), st('mood', -4)),
      ] },
      { label: 'Tell them to sort it or move out', outcomes: [any(
        '{mate} finds the money. The apartment is very quiet for a month.', 'bad', rel('mate', -18), st('mood', -3),
        mem('mate', 'rentUltimatum', 'You threatened to throw them out over the rent.'))] },
    ],
  },
  {
    id: 'last_bus', category: 'campus life', ageRange: [18, 30], cooldown: 3, weight: 3,
    requires: [enrolled, need('education.housing', '==', 'home'), need('age', '>=', 18), need('education.stage', '!=', 'high')],
    text: 'Everyone on your course is staying on campus for the end-of-term night. Your last bus home leaves in twenty minutes.',
    choices: [
      { label: 'Catch the bus', outcomes: [any('You see the photos the next morning. Your bank balance, at least, is fine.', 'neutral', st('mood', -4), hid('discipline', 2))] },
      { label: 'Stay and sleep on someone\'s floor', outcomes: [any('{pal} lends you a floor and a towel. Worth every stiff joint.', 'good', addNpc('friend', 'pal'), st('mood', 7), st('health', -1))] },
      { label: 'Stay and pay for a taxi ({$45})', requires: [need('cashBase', '>=', 45)], outcomes: [any('A proper night out, and a very expensive ride home.', 'good', cash(-45), st('mood', 6))] },
    ],
  },
  {
    id: 'uni_allnighter', category: 'university', ageRange: [18, 32], requires: [enrolled, need('education.stage', '!=', 'high'), need('age', '>=', 18)],
    text: 'A major essay is due at nine tomorrow morning and you have a title and nothing else.',
    choices: [
      { label: 'Stay up and write it', check: chk(0.55, { 'stats.intellect': 0.6, 'hidden.willpower': 0.4 }), outcomes: [
        ok('You hand it in at 8:58, shaking. It is somehow rather good.', gpa(0.12), st('health', -2), hid('willpower', 2)),
        bad('You fall asleep on the keyboard. What you submit is six hundred words and a row of the letter J.', gpa(-0.2), st('health', -2), st('mood', -4)),
      ] },
      { label: 'Ask for an extension', check: chk(0.45, { 'stats.charm': 0.6 }), outcomes: [
        ok('Three more days, granted with a sigh.', gpa(0.08)),
        bad('"The deadline was set eight weeks ago."', gpa(-0.15), st('mood', -4)),
      ] },
      { label: 'Buy one online ({$120})', requires: [need('cashBase', '>=', 120)], check: chk(0.6, { 'talents.crime': 0.4 }), outcomes: [
        ok('It gets a decent mark and no questions.', cash(-120), gpa(0.1), hid('karma', -8)),
        bad('It was sold to three other people on your course. You get a formal warning and a zero.', cash(-120), gpa(-0.4), hid('karma', -8), st('mood', -8)),
      ] },
    ],
  },
  {
    id: 'uni_party', category: 'university', ageRange: [18, 26], requires: at('university'), cooldown: 3,
    text: 'There is a party three floors up, and an exam at nine tomorrow.',
    choices: [
      { label: 'Go for one drink', check: chk(0.4, { 'hidden.discipline': 0.8 }), outcomes: [
        ok('One drink, home by eleven. You surprise yourself.', st('mood', 4), hid('discipline', 2)),
        bad('It is not one drink. You sit the exam with a paper cup of water and regret.', gpa(-0.15), st('mood', 3), st('health', -2)),
      ] },
      { label: 'Go properly', outcomes: [any('The best night of the year. You meet {pal} on the stairs at 3 a.m. The exam is a write-off.', 'neutral', addNpc('friend', 'pal'), st('mood', 9), gpa(-0.2), st('health', -2))] },
      { label: 'Earplugs and early night', outcomes: [any('You walk into the exam rested. Half the room is green.', 'good', gpa(0.12), st('mood', -2))] },
    ],
  },
  {
    id: 'research_offer', category: 'university', ageRange: [19, 32], once: true,
    requires: [enrolled, need('education.gpa', '>=', 3.2), need('age', '>=', 19)],
    text: 'A professor has noticed your work and offers you a paid place on their research project.',
    choices: [
      { label: 'Accept', outcomes: [any('Long evenings in the lab, {$900}, and your name in the acknowledgments.', 'good', cash(900), st('intellect', 4), gpa(0.1), hid('discipline', 3), ms('Worked on a professor\'s research project.'))] },
      { label: 'Decline politely', outcomes: [any('They give the place to someone else. You keep your evenings.', 'neutral', st('mood', 2))] },
    ],
  },
];

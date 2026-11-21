// Working life, beyond the office scenes in work.js: scenes that belong to a
// particular field of work, the pull between work and home, moments in the
// life of a workplace, owning a business, a relationship with someone from
// work, and a child's curiosity about what a parent does.
//
// `wk(...)` hands a choice to engine/workEvents.js, which changes the working
// state itself (hours, pay, bosses, the employer, a business).
// Entertainment careers have no scenes here on purpose: productions, tours
// and releases are left for their own system.
import { st, hid, cash, rel, ms, addNpc, ok, bad, any, chk, need, mem, perf, pay, promoted, npcSet } from './helpers.js';

const wk = (value) => ({ type: 'work', value });
const salaried = need('salaried', '==', true);
const inField = (...families) => need('workFamily', 'in', families);
const owner = need('ownsBusiness', '==', true);
const queued = (id, category, text, choices) => ({ id, category, ageRange: [0, 130], queuedOnly: true, text, choices });

/** @type {import('../../types.js').GameEvent[]} */
export default [
  // ---------- Work and home ----------
  {
    id: 'wf_missed_evening', category: 'work', ageRange: [22, 62], requires: [salaried, need('hasYoungChild', '==', true)], cast: { kid: 'child', boss: 'tag:boss' },
    castRequires: [need('cast.kid.age', '<=', 12), need('cast.kid.age', '>=', 4)], cooldown: 5,
    text: '{kid} has a part in the school show tonight, and has talked about nothing else for a month. At four o\'clock {boss} calls everyone in: something has gone wrong, and it has to be fixed before morning.',
    choices: [
      { label: 'Stay and fix it', outcomes: [any('You get home after ten. {kid} is asleep in the costume. The program is on the kitchen table, with your name written on the front in felt pen.', 'bad',
        perf(7), rel('kid', -10), st('mood', -6), rel('boss', 5), mem('kid', 'missedShow', 'You missed their school show for work.'))] },
      { label: 'Tell {boss} you have to be somewhere at six, and will be back online at nine', check: chk(0.6, { 'cast.boss.relationship': 0.6, 'stats.charm': 0.3 }), outcomes: [
        ok('{boss} looks at you, then at the clock. "Go. Nine o\'clock." You are in the second row when {kid} comes on, and at your desk until two.', perf(3), rel('kid', 8), st('mood', 4), wk('stress:4'),
          mem('kid', 'cameToShow', 'You left work to see their school show, and they saw you in the second row.')),
        bad('"Everyone has somewhere to be." You go anyway. It is noted.', perf(-6), rel('kid', 8), rel('boss', -8), mem('kid', 'cameToShow', 'You left work to see their school show.')),
      ] },
      { label: 'Go, and do not ask', outcomes: [any('{kid} finds your face in the audience and forgets a line, grinning. On Monday there is an email from {boss} with the word "disappointed" in it.', 'neutral',
        perf(-8), rel('kid', 10), rel('boss', -10), st('mood', 5))] },
    ],
  },
  {
    id: 'wf_part_time', category: 'work', ageRange: [24, 55], requires: [salaried, need('hasYoungChild', '==', true)], cast: { boss: 'tag:boss' }, cooldown: 8,
    text: 'The childcare has fallen through again. You have done the sums on the back of an envelope three times: someone has to be home more, or you have to pay someone a great deal to be.',
    choices: [
      { label: 'Ask {boss} for a shorter week', check: chk(0.6, { 'cast.boss.relationship': 0.6 }), outcomes: [
        ok('{boss} agrees to it. Less money, and you are there when the school gate opens.', wk('partTime'), st('mood', 5), wk('stress:-10')),
        bad('"The role is full-time." {boss} is sorry, and does not change the answer.', st('mood', -5), rel('boss', -4)),
      ] },
      { label: 'Pay for a nanny and keep your hours', requires: [need('cashBase', '>=', 9000)], outcomes: [any('It costs {$9000} a year and it works. You try not to count what you miss.', 'neutral', cash(-9000), wk('stress:-4'))] },
      { label: 'Patch it together: grandparents, neighbors, favors', outcomes: [any('It holds, in the way a thing held together with tape holds. You are tired all the time.', 'neutral', wk('stress:10'), st('mood', -4))] },
    ],
  },
  {
    id: 'wf_promotion_elsewhere', category: 'work', ageRange: [26, 58], requires: [salaried, need('yearsInRole', '>=', 2), need('career.performance', '>=', 65)], cast: { boss: 'tag:boss', love: 'spouse' }, cooldown: 12,
    text: '{boss} closes the door. There is a bigger job, and it is yours if you want it. It is in another city. At home, {love} listens to the whole of it and then says, quietly, that their own work is here.',
    choices: [
      { label: 'Take it, and ask {love} to come', check: chk(0.5, { 'cast.love.relationship': 0.9 }), outcomes: [
        ok('{love} thinks about it for a week, and says yes. You both start again in {city}.', promoted(), { type: 'moveCity' }, rel('love', -4), npcSet('love', { flags: { heldBack: true } }),
          mem('love', 'movedForYou', 'They gave up their own work to move for your promotion.')),
        bad('{love} comes, and does not forgive it. The new job is everything you were promised. The apartment is very quiet.', promoted(), { type: 'moveCity' }, rel('love', -20), npcSet('love', { flags: { heldBack: true } })),
      ] },
      { label: 'Turn it down', outcomes: [any('{boss} nods, and gives it to someone else within the month. {love} does not say thank you, and does not need to.', 'neutral', perf(-3), rel('love', 10), wk('satisfaction:-6'),
        mem('love', 'stayedForMe', 'You turned down a promotion so they could keep the work they loved.'))] },
      { label: 'Ask whether the job could be done from here', check: chk(0.3, { 'career.performance': 0.8, 'cast.boss.relationship': 0.4 }), outcomes: [
        ok('It takes {boss} two weeks of arguing upstairs, and it is agreed: the job, and two days a month in the other office.', promoted(), rel('love', 6), rel('boss', 4)),
        bad('"It needs someone on the ground." The job goes to someone else.', perf(-2), rel('love', 4)),
      ] },
    ],
  },
  {
    id: 'wf_money_talk', category: 'family', ageRange: [24, 70], requires: [need('workStress', '>=', 55)], cast: { love: 'spouse' }, cooldown: 9,
    text: 'Sunday evening. {love} has the bank statement in one hand. "You are never here, and I am not sure what it is for. What are we working this hard toward?"',
    choices: [
      { label: 'Sit down and go through it together: what you earn, what you need', outcomes: [any('It takes two hours and a bottle of wine. You find you need less than you thought, and agree what "enough" would look like.', 'good', rel('love', 9), wk('stress:-8'), st('mood', 4))] },
      { label: 'Say it is for the family, and it will ease off soon', outcomes: [any('{love} has heard "soon" before.', 'neutral', rel('love', -6))] },
      { label: 'Promise to cut back, starting now', check: chk(0.5, { 'hidden.willpower': 0.8 }), outcomes: [
        ok('You mean it, and you do it: home by six, phone in a drawer.', rel('love', 10), wk('overtime:-5'), wk('stress:-10'), perf(-3)),
        bad('You mean it. By Wednesday you are answering emails at the dinner table again.', rel('love', -8)),
      ] },
    ],
  },
  {
    id: 'wf_work_trip', category: 'work', ageRange: [24, 62], requires: [salaried, inField('corporate', 'tech', 'media', 'government', 'science', 'transport')], cast: { love: 'spouse', boss: 'tag:boss' }, cooldown: 10,
    text: '{boss} wants you abroad for three weeks, starting Monday. It is the week of your anniversary with {love}.',
    choices: [
      { label: 'Go, and make it up to {love} afterward', outcomes: [any('The trip goes well. The anniversary is a video call with a bad connection.', 'neutral', perf(6), rel('love', -8), wk('stress:4'))] },
      { label: 'Ask to fly out two days late', check: chk(0.65, { 'cast.boss.relationship': 0.5 }), outcomes: [
        ok('{boss} moves the first meetings. You have dinner with {love}, then a taxi to the airport at five in the morning.', perf(4), rel('love', 6)),
        bad('"The client is expecting you Monday." You go Monday.', perf(3), rel('love', -8), rel('boss', -3)),
      ] },
      { label: 'Say you cannot go', outcomes: [any('Someone else goes, and comes back with the client\'s good opinion. {love} books the restaurant.', 'neutral', perf(-6), rel('love', 8), rel('boss', -5))] },
    ],
  },

  // ---------- The life of a workplace ----------
  {
    id: 'wp_new_manager', category: 'work', ageRange: [20, 64], requires: [salaried, need('yearsInRole', '>=', 1)], cast: { boss: 'tag:boss' }, cooldown: 12,
    text: '{boss} gathers the team to say goodbye: a new job, starting next month. The replacement comes from outside, with a reputation for changing things.',
    choices: [
      { label: 'Introduce yourself early and offer to show them round', outcomes: [any('{newcomer} remembers who was helpful in the first week. {boss} says to keep in touch, and seems to mean it.', 'good',
        addNpc('coworker', 'newcomer', { ageOffset: 6, relationship: 58 }), wk('newBoss'), perf(3), mem('newcomer', 'welcomed', 'You showed them round in their first week.'))] },
      { label: 'Keep your head down and see what happens', outcomes: [any('{newcomer} reorganizes the team by the end of the quarter. You are neither a winner nor a loser of it.', 'neutral',
        addNpc('coworker', 'newcomer', { ageOffset: 6, relationship: 48 }), wk('newBoss'))] },
      { label: 'Tell the new manager plainly what is not working here', check: chk(0.5, { 'stats.intellect': 0.5, 'stats.charm': 0.4 }), outcomes: [
        ok('{newcomer} takes notes. Two of your suggestions happen. You are someone whose opinion is asked now.', addNpc('coworker', 'newcomer', { ageOffset: 6, relationship: 62 }), wk('newBoss'), perf(7)),
        bad('{newcomer} thanks you for your candor in a way that means the opposite.', addNpc('coworker', 'newcomer', { ageOffset: 6, relationship: 36 }), wk('newBoss'), perf(-4)),
      ] },
    ],
  },
  {
    id: 'wp_acquired', category: 'work', ageRange: [22, 64], requires: [salaried, inField('corporate', 'tech', 'media', 'retail', 'hospitality', 'transport', 'science')], cast: { mate: 'coworker' }, cooldown: 20,
    text: 'The email arrives at nine: the company has been bought. By ten, {mate} has heard that a third of the jobs will go, that nobody\'s will, and that the new owners are moving everything to another country.',
    choices: [
      { label: 'Carry on working, and wait for facts', outcomes: [any('The facts, when they come, are duller than the rumors. Your job is safe for now. The place feels different.', 'neutral', wk('acquired'), wk('stress:5'))] },
      { label: 'Volunteer for the team joining the two companies together', check: chk(0.5, { 'stats.intellect': 0.5, 'career.performance': 0.5 }), outcomes: [
        ok('Six months of spreadsheets and difficult meetings, and at the end of it the new owners know your name.', wk('acquired'), perf(10), wk('stress:8'), pay(1.05)),
        bad('You are put on it, and it is thankless. Both sides blame the people in the middle.', wk('acquired'), perf(-3), wk('stress:10')),
      ] },
      { label: 'Take the voluntary redundancy on offer', outcomes: [any('You sign the form. On the last Friday, {mate} organizes the drinks.', 'neutral', wk('voluntary'), rel('mate', 5))] },
    ],
  },
  {
    id: 'wp_surprise_bonus', category: 'work', ageRange: [20, 66], requires: [salaried, need('career.performance', '>=', 70)], cast: { boss: 'tag:boss' }, cooldown: 9,
    text: 'It has been a good year, and {boss} has been given a pot of money to share out. You are called in.',
    choices: [
      { label: 'Say thank you', outcomes: [any('{boss} tells you what it is for, specifically, which matters more than the figure.', 'good', wk('bonus:0.06'), st('mood', 6), wk('satisfaction:6'))] },
      { label: 'Ask whether the people who worked on it with you got one too', outcomes: [any('{boss} had not thought of it. By the end of the week they have. Word gets round about who asked.', 'good', wk('bonus:0.05'), hid('karma', 3), rel('boss', 3), st('mood', 5))] },
      { label: 'Say you would rather have it as a raise', check: chk(0.35, { 'cast.boss.relationship': 0.5, 'career.performance': 0.5 }), outcomes: [
        ok('{boss} laughs, and then does it.', pay(1.04), rel('boss', 2)),
        bad('"It is a bonus or it is nothing."', wk('bonus:0.05'), rel('boss', -3)),
      ] },
    ],
  },
  {
    id: 'wp_project_fails', category: 'work', ageRange: [22, 64], requires: [salaried, need('yearsInRole', '>=', 1)], cast: { boss: 'tag:boss', mate: 'coworker' }, cooldown: 10,
    text: 'The project you and {mate} have given most of a year to is canceled in a ten-minute meeting. {boss} wants to know, before it goes upstairs, what went wrong.',
    choices: [
      { label: 'Say what you would do differently, starting with yourself', outcomes: [any('{boss} writes it down almost word for word. What goes upstairs is a report on lessons learned, with your name on it as the author.', 'good', perf(4), rel('boss', 5), rel('mate', 3), st('mood', -3))] },
      { label: 'Say the deadline was never possible, and you said so at the time', check: chk(0.5, { 'stats.intellect': 0.4, 'cast.boss.relationship': 0.4 }), outcomes: [
        ok('You did say so, and you can show the email. {boss} takes it upstairs.', perf(3), rel('boss', -2)),
        bad('{boss} agreed that deadline. It is not what they wanted to hear.', perf(-5), rel('boss', -8)),
      ] },
      { label: 'Let {mate} do the talking', outcomes: [any('{mate} takes more of the blame than was fair, and knows you let it happen.', 'bad', perf(-2), rel('mate', -12), hid('karma', -3))] },
    ],
  },
  {
    id: 'wp_leaving_do', category: 'work', ageRange: [20, 66], requires: [salaried], cast: { mate: 'coworker' }, castRequires: [need('cast.mate.relationship', '>=', 45)], cooldown: 9,
    text: 'There is a card going round and a collection in an envelope: someone who has been here longer than the furniture is retiring. {mate} asks if you will say a few words on Friday.',
    choices: [
      { label: 'Write something properly, and say it', check: chk(0.6, { 'stats.charm': 0.6 }), outcomes: [
        ok('You find the right story to tell. People laugh, and then one or two of them cry. It is talked about for weeks.', perf(2), rel('mate', 6), st('mood', 5), wk('satisfaction:5')),
        bad('It is too long, and a joke lands badly. The retiree is kind about it.', rel('mate', -2), st('mood', -3)),
      ] },
      { label: 'Put {$40} in the envelope and sign the card', outcomes: [any('You write "all the best". So did eleven other people.', 'neutral', cash(-40))] },
      { label: 'Say you are no good at speeches, but help {mate} organize it', outcomes: [any('You book the room and order the cake. {mate} gives the speech, and thanks you in it.', 'good', rel('mate', 7))] },
    ],
  },
  {
    id: 'wp_offered_secondment', category: 'work', ageRange: [22, 58], requires: [salaried, need('career.performance', '>=', 60)], cast: { boss: 'tag:boss' }, cooldown: 12,
    text: '{boss} has been asked to lend someone to another part of the organization for a year: different work, a steep hill to climb, and no promise your old desk will be waiting.',
    choices: [
      { label: 'Go', check: chk(0.6, { 'stats.intellect': 0.5, 'hidden.discipline': 0.3 }), outcomes: [
        ok('It is the hardest year you have worked, and the one you learn most in. You come back knowing how the place actually runs.', perf(9), wk('stress:8'), wk('satisfaction:8'), ms('Took a year\'s secondment, and came back knowing the whole business.')),
        bad('You are out of your depth for most of it. You come back to a desk by the photocopier.', perf(-5), wk('stress:10')),
      ] },
      { label: 'Say you are happy where you are', outcomes: [any('{boss} sends someone else, who comes back with a great many opinions.', 'neutral')] },
    ],
  },

  // ---------- By field ----------
  {
    id: 'fd_health_short', category: 'work', ageRange: [20, 66], requires: [inField('health')], cast: { boss: 'tag:boss' }, cooldown: 7,
    text: 'Two people have called in sick, the ward is full, and {boss} is asking whether anyone can stay on after a twelve-hour shift.',
    choices: [
      { label: 'Stay', outcomes: [any('You do another six hours. Nobody comes to harm on your watch. You drive home with the window down to stay awake.', 'neutral', perf(6), wk('stress:10'), st('health', -2), rel('boss', 6))] },
      { label: 'Say you are not safe to work any longer, and help find cover', outcomes: [any('You ring round from the staff room and find an agency nurse who can be there in forty minutes. {boss} is short with you tonight, and thanks you next week.', 'good', perf(2), hid('karma', 2))] },
      { label: 'Go home', outcomes: [any('You have done your hours. The people who stayed remember who did not.', 'neutral', perf(-4), rel('boss', -6), wk('stress:-3'))] },
    ],
  },
  {
    id: 'fd_health_mistake', category: 'work', ageRange: [22, 66], requires: [inField('health')], cast: { mate: 'coworker' }, cooldown: 12,
    text: 'Checking the charts at the end of the shift, you see that {mate} gave a patient the wrong dose. The patient seems fine. {mate} has not noticed.',
    choices: [
      { label: 'Tell {mate}, and report it together', outcomes: [any('The patient is monitored overnight and is fine. The report leads to the labels being changed. {mate} is shaken, and grateful.', 'good', perf(4), rel('mate', 6), hid('karma', 4))] },
      { label: 'Report it yourself', outcomes: [any('It is the right thing done the cold way. The patient is fine. {mate} hears about it from a manager.', 'neutral', perf(3), rel('mate', -15), hid('karma', 1))] },
      { label: 'Say nothing: no harm was done', outcomes: [any('No harm was done, this time. You check {mate}\'s charts yourself for a month, and sleep badly.', 'bad', hid('karma', -6), wk('stress:8'))] },
    ],
  },
  {
    id: 'fd_edu_struggling', category: 'work', ageRange: [21, 66], requires: [inField('education')], cooldown: 7,
    text: 'One of your students has stopped handing anything in. Clever, quiet, falling behind fast. Their records say nothing; their face says something is wrong at home.',
    choices: [
      { label: 'Find ten minutes a day for them, without making a thing of it', check: chk(0.6, { 'stats.charm': 0.5, 'hidden.discipline': 0.3 }), outcomes: [
        ok('It takes a term. One morning the homework is on your desk before you arrive. Years later you will get a letter.', perf(5), st('mood', 6), wk('satisfaction:10'), hid('karma', 3), ms('Stayed with a struggling student until they found their feet.')),
        bad('You try. They change schools in the spring, and you never find out what happened.', st('mood', -5), wk('satisfaction:-3')),
      ] },
      { label: 'Refer it to the pastoral team, as the policy says', outcomes: [any('A form is filled in. Someone speaks to the family. You are told it is being handled.', 'neutral', perf(2))] },
      { label: 'Mark what is handed in, and leave it there', outcomes: [any('You have thirty others to teach. This one slips through, and you know it.', 'bad', wk('satisfaction:-6'), hid('karma', -2))] },
    ],
  },
  {
    id: 'fd_edu_parent', category: 'work', ageRange: [21, 66], requires: [inField('education')], cast: { boss: 'tag:boss' }, cooldown: 9,
    text: 'A parent is in the hallway, loudly certain that their child\'s mark is your fault. {boss} is watching from the office door to see how you handle it.',
    choices: [
      { label: 'Invite them in, show the work, and listen', check: chk(0.65, { 'stats.charm': 0.6 }), outcomes: [
        ok('Twenty minutes in, they are asking what they can do at home to help. {boss} gives you a small nod.', perf(6), rel('boss', 4), wk('satisfaction:4')),
        bad('They hear every explanation as an excuse, and ask for the head. {boss} takes over.', perf(-3), wk('stress:6')),
      ] },
      { label: 'Tell them, calmly, that you do not discuss marks in corridors, and offer an appointment', outcomes: [any('They are furious, and book the appointment. By Thursday they have calmed down.', 'neutral', perf(2), wk('stress:3'))] },
      { label: 'Change the mark', outcomes: [any('It goes away. So does something else. Next semester there are three more parents in the hallway.', 'bad', perf(-6), hid('karma', -4), rel('boss', -6))] },
    ],
  },
  {
    id: 'fd_tech_release', category: 'work', ageRange: [20, 62], requires: [inField('tech')], cast: { boss: 'tag:boss', mate: 'coworker' }, cooldown: 7,
    text: 'The release is tomorrow. At six in the evening {mate} finds a fault that loses customers\' data one time in a thousand. {boss} says it has to ship: the announcement has been made.',
    choices: [
      { label: 'Refuse to sign it off, and say why in writing', outcomes: [any('The release slips by four days. {boss} is furious for all four, and then quietly relieved for a year.', 'good', perf(5), rel('boss', -6), rel('mate', 8), hid('karma', 3), wk('stress:8'))] },
      { label: 'Stay all night with {mate} and fix it', check: chk(0.5, { 'stats.intellect': 0.8 }), outcomes: [
        ok('At four in the morning the tests go green. You ship on time, and nobody outside the team ever knows.', perf(10), rel('mate', 10), wk('stress:10'), st('health', -2)),
        bad('At four in the morning you have made it worse. It ships late, and with your fingerprints on it.', perf(-6), wk('stress:12'), st('health', -2)),
      ] },
      { label: 'Ship it, and fix it next week', outcomes: [any('It loses the data of some hundreds of customers, one of whom is a journalist.', 'bad', perf(-12), rel('boss', -4), hid('karma', -3), wk('stress:10'))] },
    ],
  },
  {
    id: 'fd_tech_new_tools', category: 'work', ageRange: [26, 64], requires: [inField('tech'), need('yearsInRole', '>=', 3)], cooldown: 12,
    text: 'The team is moving to tools you have never used. The newest hires already know them. You are the one people have always asked for help, and now you are the one asking.',
    choices: [
      { label: 'Learn it properly, on your own time', check: chk(0.6, { 'stats.intellect': 0.5, 'hidden.discipline': 0.5 }), outcomes: [
        ok('Three months of evenings. By spring you are the one who knows both the old system and the new, which turns out to be rare.', perf(8), wk('stress:6'), st('intellect', 1)),
        bad('You start four courses and finish none. You get by, slower than you used to be.', perf(-4), wk('stress:6')),
      ] },
      { label: 'Ask one of the new hires to teach you, and teach them the business in return', outcomes: [any('It is an even trade, and you both know it. You like them more than you expected to.', 'good', perf(5), wk('satisfaction:5'))] },
      { label: 'Argue that the old way was fine', outcomes: [any('It was fine. It is also gone. You become, without meaning to, the person who complains.', 'bad', perf(-6), wk('satisfaction:-6'))] },
    ],
  },
  {
    id: 'fd_hosp_inspection', category: 'work', ageRange: [18, 64], requires: [inField('hospitality')], cast: { boss: 'tag:boss' }, cooldown: 8,
    text: 'The inspector arrives unannounced in the middle of lunch. You know something they do not yet: the walk-in fridge was out for two hours this morning.',
    choices: [
      { label: 'Tell them, and show what was thrown away', outcomes: [any('The inspector writes for a long time. The score is good, with a note about the fridge. {boss} is angry for a day and then puts you in charge of the temperature log.', 'good', perf(4), hid('karma', 3), rel('boss', -2))] },
      { label: 'Say nothing, and hope', check: chk(0.5, {}), outcomes: [
        ok('The inspector checks the fridge, which is cold now, and moves on.', hid('karma', -3), wk('stress:6')),
        bad('The inspector asks to see the log. There is a two-hour gap in it, and a long silence.', perf(-8), rel('boss', -8), hid('karma', -3)),
      ] },
      { label: 'Fetch {boss} and let them deal with it', outcomes: [any('{boss} deals with it. You go back to the pass, where six tickets are waiting.', 'neutral')] },
    ],
  },
  {
    id: 'fd_hosp_rush', category: 'work', ageRange: [16, 64], requires: [inField('hospitality')], cast: { mate: 'coworker' }, cooldown: 6,
    text: 'The busiest night of the year: every table booked twice over, and {mate} has just walked out mid-service in tears.',
    choices: [
      { label: 'Take {mate}\'s section as well as your own', check: chk(0.55, { 'hidden.discipline': 0.5, 'stats.health': 0.3 }), outcomes: [
        ok('You do not stop moving for five hours. Nothing goes out wrong. At midnight someone hands you a drink and nobody speaks for a while.', perf(9), wk('stress:8'), cash(120)),
        bad('It is too much for one person. Three tables walk out, and one of them writes a review.', perf(-4), wk('stress:10')),
      ] },
      { label: 'Go after {mate}', outcomes: [any('Five minutes in the yard by the trash. {mate} comes back in, red-eyed, and finishes the night. The tables waited; the friendship will not forget.', 'good', rel('mate', 14), perf(1))] },
      { label: 'Tell the manager and carry on with your own tables', outcomes: [any('Your section runs perfectly. The rest of the room is chaos, and you can see it from where you stand.', 'neutral', perf(2), rel('mate', -4))] },
    ],
  },
  {
    id: 'fd_trades_shortcut', category: 'work', ageRange: [18, 66], requires: [inField('trades')], cooldown: 8,
    text: 'The customer wants the job done by Friday and done cheap. They have worked out that if you leave out one step, the one nobody will ever see behind the wall, it can be both.',
    choices: [
      { label: 'Explain what that step is for, and quote for the job done right', check: chk(0.6, { 'stats.charm': 0.5 }), outcomes: [
        ok('They grumble, and pay. Two years later they ring to say the neighbor\'s went wrong and theirs did not, and can you do the neighbor\'s.', perf(5), hid('karma', 2), cash(300)),
        bad('They find someone who will do it their way. You lose the job.', perf(-1), hid('karma', 2)),
      ] },
      { label: 'Do it properly anyway and take the hit on the price', outcomes: [any('You are out of pocket and you sleep fine.', 'neutral', cash(-250), hid('karma', 3), wk('satisfaction:4'))] },
      { label: 'Do it their way', outcomes: [any('It is done by Friday. Nobody will ever see behind that wall, unless something goes wrong.', 'bad', cash(200), hid('karma', -5), perf(-2))] },
    ],
  },
  {
    id: 'fd_trades_referral', category: 'work', ageRange: [20, 66], requires: [inField('trades'), need('career.performance', '>=', 60)], cooldown: 9,
    text: 'A customer you did a small job for last year has recommended you to a developer with forty units to fit out. It is more work than you have ever taken on at once.',
    choices: [
      { label: 'Take it, and bring in people you trust to help', check: chk(0.55, { 'hidden.discipline': 0.5, 'stats.intellect': 0.3 }), outcomes: [
        ok('It is a hard six months and it goes right. Your name is on a list now that it was not on before.', perf(10), cash(2500), wk('stress:8'), ms('Took on the biggest job of your working life, and delivered it.')),
        bad('It runs late and over. You finish it, at a cost, and the developer does not call again.', perf(-4), cash(-800), wk('stress:12')),
      ] },
      { label: 'Take ten of the forty', outcomes: [any('You do ten, well. The developer gives the rest to someone bigger, and keeps your number.', 'good', perf(5), cash(700))] },
      { label: 'Say it is too big for you', outcomes: [any('It was honest. It was also the only time that phone rang.', 'neutral', wk('satisfaction:-3'))] },
    ],
  },
  {
    id: 'fd_retail_target', category: 'work', ageRange: [16, 64], requires: [inField('retail')], cast: { boss: 'tag:boss' }, cooldown: 6,
    text: 'Head office has set a target for selling the extended warranty, which you know is poor value. {boss} reads out the league table every morning. You are at the bottom of it.',
    choices: [
      { label: 'Sell it only to the people it actually suits', outcomes: [any('You stay near the bottom of the table and near the top for customers who come back and ask for you by name.', 'neutral', perf(-2), hid('karma', 3), wk('satisfaction:4'))] },
      { label: 'Sell it hard', check: chk(0.55, { 'stats.charm': 0.8 }), outcomes: [
        ok('You are top of the table by the end of the month. There is a voucher, and a round of applause that you do not enjoy as much as you expected.', perf(8), cash(150), hid('karma', -3)),
        bad('You are not a natural at it, and customers can tell.', perf(-3), hid('karma', -2)),
      ] },
      { label: 'Tell {boss} what customers say about it', outcomes: [any('{boss} agrees with every word, and reads out the league table again the next morning.', 'neutral', rel('boss', 2), wk('stress:3'))] },
    ],
  },
  {
    id: 'fd_gov_pressure', category: 'work', ageRange: [22, 66], requires: [inField('government')], cast: { boss: 'tag:boss' }, cooldown: 9,
    text: 'The figures you have been asked to prepare do not say what your department\'s leadership would like them to say. {boss} suggests, without quite saying so, that a different method might give a happier answer.',
    choices: [
      { label: 'Present the figures as they are, with the method attached', outcomes: [any('It is not welcomed. It is also not challenged, because it cannot be. You are not invited to the next meeting.', 'neutral', perf(-2), hid('karma', 4), rel('boss', -6), wk('satisfaction:3'))] },
      { label: 'Show both methods, and say which you would defend in public', check: chk(0.6, { 'stats.intellect': 0.5, 'stats.charm': 0.4 }), outcomes: [
        ok('{boss} reads it twice, and takes your version upstairs. "If we are asked, I want to be able to answer."', perf(7), rel('boss', 5), hid('karma', 2)),
        bad('The happier figures are used. Your note about the other method is filed.', perf(-1), wk('stress:5')),
      ] },
      { label: 'Use the other method', outcomes: [any('The answer is happier. Eight months later a journalist asks how it was arrived at.', 'bad', perf(3), hid('karma', -5), wk('stress:8'))] },
    ],
  },
  {
    id: 'fd_science_results', category: 'work', ageRange: [22, 66], requires: [inField('science')], cast: { boss: 'tag:boss' }, cooldown: 9,
    text: 'A year of work, and the result is the opposite of what the grant application promised. {boss} needs something to show the funders by the end of the month.',
    choices: [
      { label: 'Write it up as it is: a clear result nobody expected', check: chk(0.55, { 'stats.intellect': 0.7 }), outcomes: [
        ok('It is the paper from your lab that other people actually cite. The funders renew, for a different question.', perf(9), wk('satisfaction:10'), ms('Published a result that overturned what your own lab expected.')),
        bad('It is sound, and it is not what anyone wanted. The funding is not renewed.', perf(-3), hid('karma', 2), wk('stress:8')),
      ] },
      { label: 'Run it again, every way you can think of, before saying anything', outcomes: [any('Three more months. The result stands. You have lost the deadline and gained the certainty.', 'neutral', perf(2), wk('stress:6'))] },
      { label: 'Find the subset of the data that says what was hoped', outcomes: [any('It goes to the funders with a hopeful graph on the front. You know which samples you left out.', 'bad', perf(3), hid('karma', -6), wk('satisfaction:-10'))] },
    ],
  },
  {
    id: 'fd_transport_weather', category: 'work', ageRange: [19, 66], requires: [inField('transport')], cooldown: 7,
    text: 'You are four hours behind, the weather is closing in, and control has left the decision with you: push on, or stop where you are and be later still.',
    choices: [
      { label: 'Stop, and say so', outcomes: [any('You sit it out. The delivery is a day late, the customer complains, and everyone gets home.', 'neutral', perf(-2), hid('karma', 2))] },
      { label: 'Push on carefully', check: chk(0.6, { 'hidden.discipline': 0.4, 'stats.health': 0.2 }), outcomes: [
        ok('You make it, with your shoulders up round your ears the whole way.', perf(5), wk('stress:6')),
        bad('You do not make it cleanly. Nobody is hurt. There is a report, and your name is in it.', perf(-9), wk('stress:10'), st('health', -3)),
      ] },
      { label: 'Ask control to make the call', outcomes: [any('Control tells you to stop. It is now their decision in the log, which is what you both wanted.', 'neutral')] },
    ],
  },
  {
    id: 'fd_safety_call', category: 'work', ageRange: [19, 62], requires: [inField('safety')], cast: { mate: 'coworker' }, cooldown: 8,
    text: 'A call like the others, until it is not. Afterward, back at the station, {mate} is washing their hands for the third time and not saying anything.',
    choices: [
      { label: 'Sit with {mate}, and say you are not all right either', outcomes: [any('You talk until the next shift comes on. It does not fix it. It means neither of you carries it alone.', 'good', rel('mate', 12), wk('stress:-6'), st('mood', 2))] },
      { label: 'Suggest you both see the counselor the service offers', check: chk(0.6, { 'cast.mate.relationship': 0.6 }), outcomes: [
        ok('{mate} goes because you went. Months later they tell you it was the thing that kept them in the job.', rel('mate', 10), wk('stress:-10'), hid('karma', 2)),
        bad('"I am fine." {mate} is not fine, and will not hear it today.', rel('mate', -2)),
      ] },
      { label: 'Make a dark joke, and put the kettle on', outcomes: [any('It gets a laugh, which is what it was for. Neither of you sleeps much that week.', 'neutral', rel('mate', 3), wk('stress:5'))] },
    ],
  },
  {
    id: 'fd_media_correction', category: 'work', ageRange: [21, 66], requires: [inField('media')], cast: { boss: 'tag:boss' }, cooldown: 9,
    text: 'Something you published last week has a mistake in it: small, but it makes someone look worse than they are. Nobody has noticed. Yet.',
    choices: [
      { label: 'Tell {boss}, and run a correction', outcomes: [any('The correction is two lines long. The person it concerned writes to say thank you, and later becomes a source.', 'good', perf(2), hid('karma', 4), rel('boss', 3))] },
      { label: 'Quietly fix it online', check: chk(0.6, {}), outcomes: [
        ok('Fixed. Nobody is any the wiser.', hid('karma', -2)),
        bad('Someone had taken a screenshot. "Outlet quietly edits false claim" is a better story than the original.', perf(-8), rel('boss', -8), hid('karma', -2)),
      ] },
      { label: 'Leave it', outcomes: [any('It sits there. Every time you see the name in the news, you think of it.', 'bad', hid('karma', -5), wk('satisfaction:-5'))] },
    ],
  },
  {
    id: 'fd_law_client', category: 'work', ageRange: [24, 68], requires: [inField('law')], cast: { boss: 'tag:boss' }, cooldown: 9,
    text: 'The firm\'s best-paying client tells you something across the table that, if true, means the statement you are about to file for them is false.',
    choices: [
      { label: 'Stop the meeting and explain what you can and cannot now do', outcomes: [any('The client is outraged, then thoughtful, then signs a different statement. {boss} says you handled it exactly right, and looks as if it cost something to say.', 'good', perf(5), hid('karma', 4), wk('stress:6'))] },
      { label: 'Take it to {boss} before doing anything', outcomes: [any('{boss} takes the file off you. You never learn what was filed.', 'neutral', perf(1), wk('satisfaction:-4'))] },
      { label: 'File it as drafted', outcomes: [any('It is filed. If it ever comes out, it is your signature.', 'bad', perf(3), hid('karma', -8), wk('stress:12'))] },
    ],
  },
  {
    id: 'fd_land_storm', category: 'work', ageRange: [16, 70], requires: [inField('land')], cast: { mate: 'coworker' }, cooldown: 7,
    text: 'The forecast has changed: the storm is coming tonight, not Thursday. Everything that is still out there needs to be in, and there are two of you.',
    choices: [
      { label: 'Work through the night with {mate}', check: chk(0.6, { 'stats.health': 0.5, 'hidden.discipline': 0.4 }), outcomes: [
        ok('You get the last of it under cover as the first rain comes sideways. {mate} laughs like someone who has got away with something.', perf(9), rel('mate', 10), st('health', -1), wk('satisfaction:6')),
        bad('You save most of it. Most is not all, and you will both remember which part you did not reach.', perf(2), rel('mate', 5), st('health', -2)),
      ] },
      { label: 'Save what matters most, and let the rest go', outcomes: [any('You choose well. The losses are the ones that can be borne.', 'neutral', perf(4))] },
      { label: 'Ring round the neighbors for help, and owe them', outcomes: [any('Six people turn up with torches. It is done by midnight. You will be returning the favor for years, and glad to.', 'good', perf(6), hid('karma', 2), st('mood', 4))] },
    ],
  },
  {
    id: 'fd_corp_restructure', category: 'work', ageRange: [24, 64], requires: [inField('corporate'), need('yearsInRole', '>=', 2)], cast: { boss: 'tag:boss', mate: 'coworker' }, cooldown: 12,
    text: 'The consultants have been in for a month. {boss} has a slide with boxes on it, and there is one box fewer than there are people. You and {mate} do nearly the same job.',
    choices: [
      { label: 'Make the case for what you do, with numbers', check: chk(0.5, { 'career.performance': 0.9, 'stats.intellect': 0.3 }), outcomes: [
        ok('Your box survives. {mate} is moved to another team, and does not blame you, quite.', perf(5), rel('mate', -8), wk('stress:6')),
        bad('The numbers are not as good as you thought. You are offered the smaller job, or the door.', pay(0.9), perf(-4), wk('stress:10')),
      ] },
      { label: 'Suggest to {boss} how the two jobs could be split so both are worth keeping', check: chk(0.4, { 'stats.intellect': 0.5, 'cast.boss.relationship': 0.5 }), outcomes: [
        ok('{boss} redraws the slide. There are the same number of boxes as people.', perf(7), rel('mate', 12), rel('boss', 4), hid('karma', 3)),
        bad('"That is not what we have been asked to deliver." One box goes. This time it is not yours.', rel('mate', 6), wk('stress:5')),
      ] },
      { label: 'Put your hand up for the redundancy', outcomes: [any('You have been thinking of leaving anyway. {mate} keeps the job, and buys you lunch.', 'neutral', wk('voluntary'), rel('mate', 10))] },
    ],
  },
  {
    id: 'fd_sport_client', category: 'work', ageRange: [18, 62], requires: [inField('sport')], cooldown: 8,
    text: 'One of the people you train has stopped improving and started punishing themselves for it: extra sessions, missed meals, a look you have seen before.',
    choices: [
      { label: 'Talk to them, honestly, about what you are seeing', check: chk(0.6, { 'stats.charm': 0.6 }), outcomes: [
        ok('It is an awkward conversation and the right one. They ease off, see someone, and come back in the spring looking like themselves.', perf(4), hid('karma', 4), wk('satisfaction:8')),
        bad('They hear it as criticism, and find another trainer who will push them harder.', perf(-2), hid('karma', 2)),
      ] },
      { label: 'Change the program so it is impossible to overdo', outcomes: [any('Rest days go in, in writing. They follow the plan because it is a plan.', 'good', perf(3), hid('karma', 2))] },
      { label: 'They are an adult; it is their body', outcomes: [any('They get injured in March, and you both know it was coming.', 'bad', perf(-4), hid('karma', -3))] },
    ],
  },

  // ---------- Owning a business ----------
  {
    id: 'biz_cash_offer', category: 'work', ageRange: [18, 80], requires: [owner], cooldown: 8,
    text: 'A supplier offers you a deal: pay in cash, no invoice, a fifth off. "Everybody does it." Your margins this year are thin.',
    choices: [
      { label: 'Say no, and ask what they can do on the books', check: chk(0.45, { 'stats.charm': 0.6 }), outcomes: [
        ok('They knock a twentieth off for paying on time. It is less, and it is real.', wk('biz:cash:0.02'), hid('karma', 2)),
        bad('"Suit yourself." The price stays where it was.', hid('karma', 2)),
      ] },
      { label: 'Take the deal', check: chk(0.7, {}), outcomes: [
        ok('The saving is real. So is the drawer of cash you now have to explain to yourself.', wk('biz:cash:0.06'), hid('karma', -4)),
        bad('The supplier is investigated, and their customers with them. It costs you a fine and a difficult month.', wk('biz:cash:-0.08'), wk('biz:rep:-6'), hid('karma', -4), { type: 'legal', delta: 4 }),
      ] },
      { label: 'Find another supplier', outcomes: [any('It takes a month of phone calls. The new one costs more and delivers on time.', 'neutral', wk('biz:quality:3'))] },
    ],
  },
  {
    id: 'biz_staff_trouble', category: 'work', ageRange: [18, 80], requires: [owner], cooldown: 7,
    text: 'Your longest-serving member of staff has been late every day for two weeks and short with customers. The others are covering, and starting to resent it.',
    choices: [
      { label: 'Ask them what is going on', outcomes: [any('A parent is ill, and they have been driving across the city before every shift. You change their hours for a few months. The others, once they know, stop minding.', 'good', wk('biz:staff:6'), wk('biz:rep:1'), hid('karma', 3))] },
      { label: 'Give a formal warning', outcomes: [any('The lateness stops. So does the extra they used to give without being asked.', 'neutral', wk('biz:staff:-5'), wk('biz:quality:-2'))] },
      { label: 'Leave it: they have earned some slack', outcomes: [any('It goes on. One of the others, who has been covering, hands in their notice.', 'bad', wk('biz:staff:-8'), wk('biz:rep:-2'))] },
    ],
  },
  {
    id: 'biz_big_customer', category: 'work', ageRange: [18, 80], requires: [owner], cooldown: 9,
    text: 'A customer worth a fifth of your takings wants a discount, faster turnaround, and thirty more days to pay. They mention, pleasantly, that your competitor has been in touch.',
    choices: [
      { label: 'Hold your price, and offer the faster turnaround', check: chk(0.5, { 'stats.charm': 0.5, 'stats.intellect': 0.3 }), outcomes: [
        ok('They stay. They had needed the turnaround more than the discount all along.', wk('biz:cash:0.03'), wk('biz:rep:2')),
        bad('They go. It is a hard quarter. The staff notice that you did not flinch.', wk('biz:cash:-0.12'), wk('biz:staff:3')),
      ] },
      { label: 'Give them what they ask', outcomes: [any('You keep the customer and lose the profit on them. Next year they ask for a little more.', 'neutral', wk('biz:cash:-0.05'))] },
      { label: 'Let them go, and spend the freed time finding three smaller ones', check: chk(0.5, { 'hidden.discipline': 0.6 }), outcomes: [
        ok('It takes most of a year. At the end of it no one customer can sink you.', wk('biz:cash:-0.04'), wk('biz:rep:5'), wk('stress:6')),
        bad('The smaller ones are slower to find than you hoped.', wk('biz:cash:-0.14'), wk('stress:10')),
      ] },
    ],
  },

  // ---------- A relationship at work ----------
  {
    id: 'wr_closer', category: 'romance', ageRange: [18, 60], requires: [salaried, need('flags.workRomance', '==', false)], cast: { mate: 'coworker' },
    castRequires: [need('cast.mate.relationship', '>=', 68), need('cast.mate.age', '>=', 18), need('cast.mate.flags.report', '==', 0)], cooldown: 8,
    text: 'You and {mate} have been the last two in the building most nights this month. Tonight, walking out, neither of you seems to want to reach the door.',
    choices: [
      { label: 'Ask {mate} to dinner, and say plainly that you mean a date', requires: [need('single', '==', true)], check: chk(0.5, { 'cast.mate.relationship': 0.9, 'stats.charm': 0.3 }), outcomes: [
        ok('{mate} had been hoping you would ask. You agree, over dinner, that work is work and this is this, and that it will not be that simple.', wk('romance:start'), rel('mate', 12), st('mood', 10)),
        bad('{mate} is kind about it. "I like working with you too much." It is awkward for a week, and then it is not.', rel('mate', -4), st('mood', -4)),
      ] },
      { label: 'Say goodnight', outcomes: [any('You say goodnight. Whatever it was stays where it is: a good thing about going to work.', 'neutral', rel('mate', 2))] },
      { label: 'Keep it as it is, and say so: you value the friendship', outcomes: [any('{mate} nods, relieved or disappointed, you cannot tell. The friendship is the better for being named.', 'good', rel('mate', 5))] },
    ],
  },
  queued('work_romance_noticed', 'romance',
    'People at work have noticed about you and {love}. Nobody has said anything. Someone has started saying nothing in a very pointed way.', [
      { label: 'Tell your employer together, as the policy asks', outcomes: [any('A short meeting, a form, a manager who says "congratulations" and means "please do not make this my problem". It is out in the open, and oddly, nobody cares after a week.', 'good', wk('romance:declare'), rel('love', 5))] },
      { label: 'Keep it private: it is nobody\'s business', check: chk(0.5, {}), outcomes: [
        ok('The talk dies down. You are careful: separate lunches, no shared lifts.', wk('stress:5')),
        bad('It reaches someone senior as gossip rather than as fact, which is worse. You are both spoken to.', perf(-5), wk('stress:8'), rel('love', -4)),
      ] },
      { label: 'End it, for both your sakes', outcomes: [any('You see each other every day afterward. It is the hardest part.', 'bad', wk('romance:end'), st('mood', -12), wk('satisfaction:-8'))] },
    ]),
  queued('work_romance_conflict', 'romance',
    'You and {love} are together, and one of you now has a say over the other\'s work, pay and prospects. Nobody could call that fair to either of you, or to the people you work with.', [
      { label: 'Tell your employer, and ask that one of you be moved', outcomes: [any('It is arranged: different teams, different managers. {love} is the one who moves. Neither of you answers to the other now.', 'good', wk('romance:move'), rel('love', 3), hid('karma', 2))] },
      { label: 'One of you will look for a job elsewhere', outcomes: [any('{love} says it should be them, and finds something within the year. It costs them some ground; they say it was worth it.', 'neutral', wk('romance:move'), rel('love', -2))] },
      { label: 'Carry on, and keep the two things apart', check: chk(0.35, {}), outcomes: [
        ok('For now, it holds. You both know it cannot go on like this.', wk('stress:8')),
        bad('A complaint is made about favoritism. It is investigated. You are both moved, and not gently.', perf(-12), wk('romance:move'), rel('love', -8), wk('stress:10')),
      ] },
    ]),

  // ---------- Two careers, one household (queued by engine/couple.js) ----------
  queued('hh_spouse_out_of_work', 'their life',
    '{love} has lost their job. They tell you at the kitchen table, very calmly, and then not calmly at all.', [
      { label: 'Say they should take their time and find the right thing', outcomes: [any('You take on a few more hours to cover it. {love} looks for six months, and finds something they actually want.', 'good',
        wk('overtime:5'), rel('love', 8), wk('couple:anyJob'), mem('love', 'tookMyTime', 'When they lost their job, you told them to take their time.'))] },
      { label: 'Suggest they retrain for something new', outcomes: [any('Two years at college, on your wage alone. {love} comes out of it with a new field and something of their old spark.', 'good',
        wk('couple:retrain'), rel('love', 6), wk('stress:6'))] },
      { label: 'Say they need to take whatever comes up', outcomes: [any('{love} takes the first offer, a step down. The bills are paid. Something has gone quiet in them.', 'neutral',
        wk('couple:anyJob'), rel('love', -6))] },
    ]),
  queued('hh_both_stretched', 'family',
    'Neither of you has had an evening off in a month. The children are fine, mostly. You and {love} have started communicating in notes on the fridge.', [
      { label: 'Offer to step back at work for a while yourself', outcomes: [any('You ask for fewer hours. Your career slows; your house breathes again. {love} notices exactly what you gave.', 'good',
        wk('partTime'), wk('couple:iCare'), wk('couple:theyLead'), rel('love', 10), wk('stress:-12'), mem('love', 'steppedBack', 'You stepped back at work so the family could breathe.'))] },
      { label: 'Ask {love} to step back', check: chk(0.5, { 'cast.love.relationship': 0.8 }), outcomes: [
        ok('{love} goes part-time. It is the right call for the family, and you both know whose career it costs.', wk('couple:theyCare'), wk('couple:iLead'), rel('love', -3), wk('stress:-8')),
        bad('"Why is it always me who is supposed to give way?" It is a long night.', rel('love', -12), wk('stress:6')),
      ] },
      { label: 'Pay for more childcare and keep going', outcomes: [any('A nanny three days a week. It costs more than you like to say aloud. You get your evenings back, some of them.', 'neutral', wk('couple:paid'), wk('stress:-6'))] },
    ]),
  queued('hh_spouse_retrain', 'their life',
    '{love} has been reading about a different line of work for months. Tonight they say it out loud: they want to go back to college and start again, at their age.', [
      { label: 'Back them completely', outcomes: [any('Two years of thinner budgets and textbooks on the kitchen table. You would do it again.', 'good',
        wk('couple:retrain'), rel('love', 12), mem('love', 'backedMyChange', 'You backed them when they wanted to start again in a new career.'))] },
      { label: 'Ask them to wait until the children are older', outcomes: [any('{love} agrees, and you can see them put it somewhere for later.', 'neutral', rel('love', -5))] },
      { label: 'Say you cannot afford it', outcomes: [any('You may be right about the money. {love} stops mentioning it, which is worse.', 'bad', rel('love', -9))] },
    ]),
  queued('hh_spouse_big_job', 'their life',
    '{love} has been offered a bigger job: more money, more responsibility, and a great deal more of their week. With the children still small, someone else would have to pick up what they put down.', [
      { label: 'Tell them to take it; you will pick up more at home', outcomes: [any('{love} takes it, and flourishes. Your week fills up with school runs, and you find you do not mind as much as you thought.', 'good',
        wk('couple:promote'), wk('couple:iCare'), wk('couple:theyLead'), rel('love', 12))] },
      { label: 'Tell them to take it, and pay for more help', outcomes: [any('The new salary covers a nursery and then some. It is a tighter, busier, better-paid life.', 'neutral', wk('couple:promote'), wk('couple:paid'), rel('love', 6))] },
      { label: 'Ask them to turn it down for now', outcomes: [any('{love} turns it down. They do not say much about it, then or later.', 'bad', rel('love', -10), npcSet('love', { flags: { heldBack: true } }))] },
    ]),

  // ---------- A child's curiosity ----------
  queued('kid_asks_work', 'their life',
    '{kid} has been asked at school what their parents do, and realized they are not sure. "What do you actually do all day?"', [
      { label: 'Take them in with you for a day', outcomes: [any('{kid} is given a lanyard and a swivel chair, and asks everyone you work with more questions than you have in years. On the way home: "I could do that."', 'good',
        rel('kid', 10), wk('inspire:yes'), mem('kid', 'cameToWork', 'You took them to work for a day when they asked what you did.'))] },
      { label: 'Explain it properly, the good and the dull', outcomes: [any('{kid} listens to all of it. "So it is mostly meetings." It is mostly meetings.', 'neutral', rel('kid', 5))] },
      { label: 'Tell them it does not matter what you do: they should find their own thing', outcomes: [any('{kid} thinks about that for longer than you expected.', 'good', rel('kid', 4), wk('inspire:own'), mem('kid', 'ownPath', 'You told them to find their own work, not follow yours.'))] },
      { label: 'Say "work", and ask about their homework', outcomes: [any('{kid} tells the class you are a spy.', 'neutral', rel('kid', -2))] },
    ]),
];

// STORYLINE: the senior-year musical.
//
// How it is reached: join the Musical theater company (which introduces the
// drama director) and hold a part-time job (which introduces a manager). At 17
// the lead role and your Saturday shifts collide.
//
// Story state lives in flags so later scenes can read it:
//   musicalRoute   'role' | 'shifts' | 'both'
//   directorRec    the director will vouch for you (helps Musical Theater auditions)
//   summerProgramme / internship   what you did the summer after graduating
//   showcase       'original' | 'classic' | 'stageManaged'   (college project)
//   theaterCredit / bridalClients / sfxPiece   (cosmetology placement)
//   auditionVia    'director' | 'producer' | 'notice'
//   proDebut / proBackstage   how the age-25 opportunity ended
//
// People are found by contact tag (director, manager, choreographer, producer,
// professor, wigmaster, rival). What they remember is stored on them with mem()
// and read back with memory.<castKey>.<memoryKey> in checks and `when` variants.
//
// To build a storyline for another interest, copy this file, change the tags,
// flags and text, and register it in events/index.js.
import { st, hid, tal, cash, rel, flag, ms, addNpc, ok, bad, any, chk, need, mem, queue, ptScale, when } from '../helpers.js';

const inCompany = need('education.clubs', 'has', 'musical_theater');
const triple = (n) => [tal('singing', n), tal('dance', n), tal('acting', n)];

// --- Shared outcomes for the senior-year decision ---
const TAKE_ROLE = [
  flag('musicalRoute', 'role'), ...triple(6), st('mood', 7), rel('director', 12), rel('manager', -10), ptScale(0.5),
  mem('director', 'ledMusical', 'You carried the spring musical as the lead and never missed a rehearsal.'),
  mem('manager', 'droppedSaturdays', 'You gave up your Saturday shifts for the school musical.'),
  ms('Played the lead in the school musical.'),
];
const KEEP_SHIFTS = [
  flag('musicalRoute', 'shifts'), cash(1500), hid('discipline', 4), st('mood', -4), rel('manager', 12), rel('director', -10),
  mem('manager', 'keptShifts', 'You turned down the lead in the school musical to keep your shifts.'),
  mem('director', 'turnedDownLead', 'You were cast as the lead and gave the part back.'),
];
const SPLIT = [
  flag('musicalRoute', 'both'), ...triple(3), cash(600), st('mood', 3), rel('director', 5), rel('manager', 5), ptScale(0.75),
  mem('director', 'splitSchedule', 'You played the lead while holding down a job, rehearsing on a split schedule.'),
  mem('manager', 'splitSchedule', 'You kept working through the school musical on a swapped rota.'),
  ms('Played the lead in the school musical while keeping a job.'),
];
const roleChoice = { label: 'Take the role and give up Saturdays', outcomes: [any(
  'You tell {manager} you need your Saturdays back. Your pay halves. On opening night the whole hall is on its feet, and {director} is crying in the wings.',
  'good', ...TAKE_ROLE)] };
const shiftsChoice = { label: 'Keep the shifts and give the part back', outcomes: [any(
  '{director} takes the script back without a word. You watch opening night from the back row in your work shirt, with {$1500} more in the bank than you would have had. {manager} has noticed who stayed.',
  'neutral', ...KEEP_SHIFTS)] };

// --- Shared outcomes for the summer after graduation ---
const CONSERVATORY = [
  ...triple(8), flag('directorRec'), flag('summerProgramme'), st('mood', 6),
  addNpc('mentor', 'coach', { tag: 'choreographer', title: 'Conservatory choreographer', ageOffset: 20, relationship: 55,
    memory: ['summerStudent', 'You were their student at the summer conservatory.'] }),
  mem('director', 'recommended', 'They recommended you for the summer conservatory, and you went.'),
  ms('Trained at a summer theater conservatory on a director\'s recommendation.'),
];
const INTERNSHIP = [
  cash(3200), hid('discipline', 5), st('intellect', 2), flag('internship'),
  addNpc('mentor', 'producer', { tag: 'producer', title: 'Playhouse producer', ageOffset: 18, relationship: 55,
    memory: ['intern', 'You were the summer intern who never dropped a thing.'] }),
  mem('manager', 'referred', 'They referred you for the Playhouse internship, and you took it.'),
  ms('Worked a paid summer internship at the Playhouse on a manager\'s referral.'),
];
const conservatoryText = 'Eight weeks of class from nine until six. {coach}, the choreographer, drills you until the steps live in your legs. {director}\'s letter got you in; the rest was you.';
const internshipText = 'You spend the summer in the Playhouse front office: contracts, rotas, a flooded dressing room. {producer}, the producer, starts handing you things that matter. You leave with {$3200} and a number to call.';

// --- Shared pieces for the audition ---
const BOOKED = [flag('proDebut'), cash(12000), hid('fame', 6), st('mood', 15), ms('Cast in a professional musical.')];
const NOT_YET = [flag('auditionFailed'), ...triple(2), st('mood', -6)];

/** @type {import('../../../types.js').GameEvent[]} */
export default [
  // ---------- Building history with the director (ages 14–16) ----------
  {
    id: 'mt_callbacks', category: 'musical theater', ageRange: [13, 16], once: true, weight: 5,
    requires: [inCompany], cast: { director: 'tag:director' },
    text: 'Callbacks for the end-of-year show. {director} has it down to you and one other student for the solo.',
    choices: [
      { label: 'Go all out for it', check: chk(0.45, { 'talents.singing': 0.7, 'talents.acting': 0.3 }), outcomes: [
        ok('You get the solo. {rival}, who did not, stops speaking to you in the hallway.', tal('singing', 4), st('mood', 6), rel('director', 5),
          addNpc('enemy', 'rival', { tag: 'rival', title: 'Casting rival', relationship: 15 }),
          mem('director', 'wonSolo', 'You won the winter solo at callbacks.')),
        bad('{rival} gets the solo and makes sure you know it.', st('mood', -5), tal('singing', 2),
          addNpc('enemy', 'rival', { tag: 'rival', title: 'Casting rival', relationship: 20 })),
      ] },
      { label: 'Suggest making it a duet', check: chk(0.45, { 'stats.charm': 0.6, 'cast.director.relationship': 0.4 }), outcomes: [
        ok('{director} likes the idea. You and {rival} share the number and bring the house down together.', tal('singing', 3), st('charm', 2), rel('director', 6),
          addNpc('friend', 'rival', { tag: 'rival', title: 'Duet partner', relationship: 65, memory: ['sharedDuet', 'You shared the winter solo as a duet.'] }),
          mem('director', 'sharedSolo', 'You turned a casting fight into a duet.')),
        bad('"It is a solo," {director} says. {rival} gets it.', st('mood', -4),
          addNpc('enemy', 'rival', { tag: 'rival', title: 'Casting rival', relationship: 25 })),
      ] },
      { label: 'Step back and run the backstage crew', outcomes: [any(
        'You spend the show in blacks with a headset, calling every cue. {director} tells the cast the show ran because of you.',
        'good', hid('discipline', 4), rel('director', 9),
        mem('director', 'ranBackstage', 'You ran the backstage crew for the end-of-year show.'))] },
    ],
  },
  {
    id: 'mt_set_collapse', category: 'musical theater', ageRange: [14, 16], once: true, weight: 5,
    requires: [inCompany], cast: { director: 'tag:director' },
    text: 'The night before opening, half the set comes down. {director} looks round the hall and asks who can stay.',
    choices: [
      { label: 'Stay until it is rebuilt', outcomes: [any(
        'You are still holding a flat at two in the morning while {director} drives screws. Neither of you says much. It stands.',
        'good', st('health', -2), hid('willpower', 3), rel('director', 12),
        mem('director', 'stayedLate', 'You stayed until 2 a.m. rebuilding the set the night before opening.'))] },
      { label: 'Stay for an hour', outcomes: [any('You do what you can before your ride arrives.', 'neutral', rel('director', 3))] },
      { label: 'Go home', outcomes: [any('You have a test tomorrow. {director} watches you leave.', 'neutral', rel('director', -6))] },
    ],
  },

  // ---------- Senior year: the collision ----------
  {
    id: 'musical_cast', category: 'senior year', ageRange: [17, 17], once: true, priority: true,
    requires: [inCompany, need('education.stage', '==', 'high'), need('career.partTime', '!=', false)],
    cast: { director: 'tag:director', manager: 'tag:manager' },
    text: '{director} pins up the cast list: you are the lead in the spring musical. Rehearsals are every Saturday, the same Saturdays {manager} has you on shift, earning the money you are saving for after graduation.',
    choices: [
      roleChoice,
      shiftsChoice,
      { label: 'Ask them both for a compromise',
        check: chk(0.35, { 'cast.director.relationship': 0.6, 'cast.manager.relationship': 0.6,
          'memory.manager.coveredShift': 0.3, 'memory.director.stayedLate': 0.3 }),
        outcomes: [
          when([need('memory.manager.coveredShift', '>=', 1)], ok(
            '{manager} has not forgotten the night you covered that double shift: "You got me out of a hole. Sundays, then." {director} trims your Saturday calls to the afternoon. Less rehearsal, less pay, and you keep both.', ...SPLIT)),
          when([need('memory.director.stayedLate', '>=', 1)], ok(
            '{director} remembers who stayed until two to rebuild the set, and moves your scenes to weeknights. {manager} agrees to shorter Saturdays. Less rehearsal, less pay, and you keep both.', ...SPLIT)),
          ok('It takes two awkward conversations, but each of them gives a little. Less rehearsal, less pay, and you keep both.', ...SPLIT),
          when([need('cast.director.relationship', '<=', 49)], bad(
            '{director} shakes their head: "I need a lead at every rehearsal, and I do not know you well enough to gamble the show on it." No compromise. You have to choose.', st('mood', -3), queue('musical_must_choose'))),
          when([need('cast.manager.relationship', '<=', 49)], bad(
            '{manager} will not touch the rota: "You have never once helped me out of a hole. Why would I rearrange everyone for you?" No compromise. You have to choose.', st('mood', -3), queue('musical_must_choose'))),
          bad('They both try. The only slot the hall is free is Saturday, and the only shift nobody else will take is Saturday. No compromise. You have to choose.', st('mood', -3), queue('musical_must_choose')),
        ] },
    ],
  },
  {
    id: 'musical_must_choose', category: 'senior year', ageRange: [17, 18], once: true, queuedOnly: true,
    text: 'There is no way to do both. {director} needs an answer by Friday, and so does {manager}.',
    choices: [roleChoice, shiftsChoice],
  },

  // ---------- The summer after graduation: what each route earned ----------
  {
    id: 'director_recommendation', category: 'after graduation', ageRange: [18, 19], once: true, priority: true,
    requires: [need('flags.musicalRoute', '==', 'role')], cast: { director: 'tag:director' },
    text: 'After your last show, {director} stops you at the stage door: "I have written to the summer conservatory about my lead. There is a funded place with your name on it, if you want it."',
    choices: [
      { label: 'Take the place', outcomes: [any(conservatoryText, 'good', ...CONSERVATORY)] },
      { label: 'Ask for the letter, and work the summer instead', outcomes: [any(
        '{director} writes you a recommendation to send with any audition. You spend the summer earning.',
        'neutral', flag('directorRec'), cash(900), mem('director', 'recommended', 'They wrote you a recommendation letter.'))] },
      { label: 'Say thank you, but no', outcomes: [any('{director} nods. "The offer was real. Remember that."', 'neutral', rel('director', -2))] },
    ],
  },
  {
    id: 'manager_referral', category: 'after graduation', ageRange: [18, 19], once: true, priority: true,
    requires: [need('flags.musicalRoute', '==', 'shifts')], cast: { manager: 'tag:manager' },
    text: '{manager} slides a card across the counter: "My cousin runs the front office at the {city} Playhouse. They need a paid intern for the summer. I told them you are the one who shows up."',
    choices: [
      { label: 'Take the internship', outcomes: [any(internshipText, 'good', ...INTERNSHIP)] },
      { label: 'Stay on here full-time for the summer', outcomes: [any(
        'More hours, same counter. {manager} is glad to keep you.', 'neutral', cash(2200), rel('manager', 5))] },
      { label: 'Turn it down', outcomes: [any('{manager} shrugs and puts the card back in the till.', 'neutral', rel('manager', -2))] },
    ],
  },
  {
    id: 'summer_two_offers', category: 'after graduation', ageRange: [18, 19], once: true, priority: true,
    requires: [need('flags.musicalRoute', '==', 'both')], cast: { director: 'tag:director', manager: 'tag:manager' },
    text: 'In the same week, {director} offers to recommend you for a funded place at the summer conservatory, and {manager} offers to refer you for a paid internship at the {city} Playhouse. The dates overlap completely.',
    choices: [
      { label: 'The conservatory', outcomes: [any(conservatoryText, 'good', ...CONSERVATORY)] },
      { label: 'The internship', outcomes: [any(internshipText, 'good', ...INTERNSHIP)] },
      { label: 'Try to do half of each', outcomes: [any(
        'Mornings in class, evenings at the Playhouse. You get a taste of both and the full benefit of neither, but {director} still writes the letter.',
        'neutral', ...triple(4), cash(1500), flag('directorRec'), st('health', -2))] },
    ],
  },

  // ---------- Route scenes: college and trade school ----------
  {
    id: 'mt_showcase', category: 'university', ageRange: [19, 24], once: true, priority: true,
    requires: [need('education.enrolled', '==', true), need('education.majorId', 'in', ['musical_theater', 'musical_theater_bfa']), need('education.stage', '==', 'university')],
    text: 'Your year is staging a showcase for invited agents. The head of the program wants to know what you are bringing.',
    choices: [
      { label: 'A number you write yourself', check: chk(0.45, { 'stats.intellect': 0.4, 'talents.singing': 0.5, 'talents.music': 0.2 }), outcomes: [
        ok('It is yours from the first bar to the last. Professor {prof} keeps the sheet music. Two agents ask for your details.', flag('showcase', 'original'), tal('singing', 4), st('mood', 8),
          addNpc('mentor', 'prof', { tag: 'professor', title: 'Musical theater professor', ageOffset: 25, relationship: 65,
            memory: ['originalNumber', 'You wrote and performed an original number for the showcase.'] }),
          ms('Wrote and performed an original number for the college showcase.')),
        bad('The bridge falls apart on the night, but it was unmistakably yours. Professor {prof} tells you to keep writing.', flag('showcase', 'original'), tal('singing', 2), st('mood', -3),
          addNpc('mentor', 'prof', { tag: 'professor', title: 'Musical theater professor', ageOffset: 25, relationship: 55,
            memory: ['originalNumber', 'You risked an original number at the showcase.'] })),
      ] },
      { label: 'A classic you can nail', check: chk(0.5, { tripleThreat: 0.9 }), outcomes: [
        ok('Clean, bright, exactly on the beat. Professor {prof} calls it "bankable".', flag('showcase', 'classic'), ...triple(3), st('mood', 6),
          addNpc('mentor', 'prof', { tag: 'professor', title: 'Musical theater professor', ageOffset: 25, relationship: 60,
            memory: ['classicNumber', 'You delivered a polished classic at the showcase.'] })),
        bad('You crack on the money note. Professor {prof} makes you sing it again the next morning until it holds.', flag('showcase', 'classic'), tal('singing', 3), st('mood', -4),
          addNpc('mentor', 'prof', { tag: 'professor', title: 'Musical theater professor', ageOffset: 25, relationship: 55,
            memory: ['classicNumber', 'You cracked at the showcase and came back the next morning to fix it.'] })),
      ] },
      { label: 'Stage-manage the whole thing', outcomes: [any(
        'Twenty-two acts, one hundred and forty cues, no dead air. Professor {prof} says half of this industry is people who can do what you just did.',
        'good', flag('showcase', 'stageManaged'), hid('discipline', 6), st('intellect', 2),
        addNpc('mentor', 'prof', { tag: 'professor', title: 'Musical theater professor', ageOffset: 25, relationship: 62,
          memory: ['stageManaged', 'You stage-managed the entire showcase without a dropped cue.'] }))] },
    ],
  },
  {
    id: 'cosmo_placement', category: 'cosmetology school', ageRange: [18, 60], once: true, priority: true,
    requires: [need('education.stage', '==', 'cosmetology')],
    text: 'Placement week. The community theater needs twelve wigs set and a cast of thirty made up by curtain, a bridal salon wants a junior for the weekend rush, and your tutor is taking volunteers for a film-effects workshop.',
    choices: [
      { label: 'The theater: wigs and quick changes', outcomes: [any(
        'Ninety seconds to turn a villager into a queen, in the dark, with pins in your mouth. {wigs}, the head of wigs, starts trusting you with the leads.',
        'good', flag('theaterCredit'), hid('discipline', 4), st('charm', 2),
        addNpc('mentor', 'wigs', { tag: 'wigmaster', title: 'Head of wigs', ageOffset: 22, relationship: 60,
          memory: ['quickChanges', 'You ran quick changes for a full cast on your placement.'] }),
        ms('Ran hair and makeup for a theater production on placement.'))] },
      { label: 'The bridal salon', outcomes: [any(
        'Six brides, eleven bridesmaids, one mother of the bride who cries off her mascara twice. You go home with {$600} in tips and three bookings of your own.',
        'good', flag('bridalClients'), cash(600), st('charm', 3))] },
      { label: 'The film-effects workshop', check: chk(0.5, { 'stats.intellect': 0.5, 'hidden.discipline': 0.4 }), outcomes: [
        ok('Your prosthetic wound makes the tutor step back. It goes straight into your portfolio.', flag('sfxPiece'), st('intellect', 3), ms('Built a prosthetic piece for a special-effects portfolio.')),
        bad('The edges lift under the lights. You learn exactly why, which is most of the craft.', st('intellect', 2), st('mood', -2)),
      ] },
    ],
  },
  {
    id: 'cosmo_focus', category: 'licensed', ageRange: [18, 62], once: true, priority: true,
    requires: [need('degreeTypes', 'has', 'cosmetology')],
    text: 'Your license in hair and makeup arrives in the mail. Where do you want to point it?',
    choices: [
      { label: 'Salon hair styling', outcomes: [any('You start building a chair of regulars.', 'good', flag('cosmoFocus', 'salon'), ms('Chose to specialize in salon hair styling.'))] },
      { label: 'Bridal hair and makeup', outcomes: [any('Saturdays are now booked a year ahead.', 'good', flag('cosmoFocus', 'bridal'), ms('Chose to specialize in bridal hair and makeup.'))] },
      { label: 'Runway and print', outcomes: [any('You start assisting on shoots for nothing but the credit.', 'good', flag('cosmoFocus', 'editorial'), ms('Chose to specialize in runway and print makeup.'))] },
      { label: 'Special effects for film and shows', outcomes: [any('Your kitchen fills up with silicone and fake blood.', 'good', flag('cosmoFocus', 'sfx'), ms('Chose to specialize in special-effects makeup.'))] },
      { label: 'Theater hair and makeup', outcomes: [any('You start turning up at stage doors with your kit.', 'good', flag('cosmoFocus', 'theater'), ms('Chose to specialize in theater hair and makeup.'))] },
    ],
  },

  // ---------- Around 25: someone from before gets in touch ----------
  {
    id: 'open_call_director', category: 'a call from the past', ageRange: [24, 27], once: true, priority: true, exclusive: 'open_call',
    requires: [need('flags.musicalRoute', 'in', ['role', 'both']), need('flags.heardOpenCall', '!=', true)],
    cast: { director: 'tag:director' },
    text: '{director} calls for the first time in years: "A new musical is casting in {city}. I told the team about the student who carried my spring show. The open call is Thursday. Go."',
    choices: [
      { label: 'Go to the audition', outcomes: [any('You dig out your character shoes.', 'neutral',
        flag('heardOpenCall'), flag('auditionVia', 'director'), flag('auditionEdge', 100), queue('the_audition'))] },
      { label: 'That life is behind you', outcomes: [any('{director} is quiet for a moment. "If you change your mind, it is Thursday."', 'neutral', flag('heardOpenCall'))] },
    ],
  },
  {
    id: 'open_call_producer', category: 'a call from the past', ageRange: [24, 27], once: true, priority: true, exclusive: 'open_call',
    requires: [need('flags.internship', '==', true), need('flags.heardOpenCall', '!=', true)],
    cast: { producer: 'tag:producer' },
    text: '{producer}, from your summer at the Playhouse, is producing a new musical in {city}: "You were the intern who never dropped a thing. Open call is Thursday. I have put your name on the list, but the panel decides, not me."',
    choices: [
      { label: 'Go to the audition', outcomes: [any('You have not sung in front of anyone in a while. You go anyway.', 'neutral',
        flag('heardOpenCall'), flag('auditionVia', 'producer'), flag('auditionEdge', 100), queue('the_audition'))] },
      { label: 'Ask for work on the production side instead', outcomes: [any(
        '{producer} laughs. "I hoped you would say that." You join the company office for the run.', 'good',
        flag('heardOpenCall'), flag('proBackstage'), cash(9000), hid('discipline', 4), ms('Joined the production office of a professional musical.'))] },
      { label: 'Let it go', outcomes: [any('You thank {producer} and mean it.', 'neutral', flag('heardOpenCall'))] },
    ],
  },
  {
    id: 'open_call_wigs', category: 'a call from the past', ageRange: [20, 40], once: true, priority: true,
    requires: [need('flags.theaterCredit', '==', true), need('degreeTypes', 'has', 'cosmetology')],
    cast: { wigs: 'tag:wigmaster' },
    text: '{wigs}, who ran wigs on your placement, is heading hair and makeup on a new musical in {city}: "I need an assistant who has done quick changes in the dark. I have only ever seen one student do it properly."',
    choices: [
      { label: 'Take the job', outcomes: [any(
        'Eight shows a week, forty wigs, and your name in the program.', 'good',
        flag('proBackstage'), cash(9000), st('mood', 12), hid('fame', 2), rel('wigs', 10), ms('Joined the hair and makeup team of a professional musical.'))] },
      { label: 'Stay with your own clients', outcomes: [any('{wigs} says the door stays open.', 'neutral', rel('wigs', -2))] },
    ],
  },
  {
    id: 'open_call_notice', category: 'open call', ageRange: [24, 27], once: true, weight: 4, exclusive: 'open_call',
    requires: [need('tripleThreat', '>=', 45), need('flags.heardOpenCall', '!=', true)],
    text: 'A notice goes round online: open auditions on Thursday for a new musical in {city}. Nobody has told you about it. Nobody is expecting you.',
    choices: [
      { label: 'Turn up anyway', outcomes: [any('You join a line that goes around the block.', 'neutral',
        flag('heardOpenCall'), flag('auditionVia', 'notice'), queue('the_audition'))] },
      { label: 'Scroll past', outcomes: [any('Thursday comes and goes.', 'neutral', flag('heardOpenCall'))] },
    ],
  },
  {
    id: 'the_audition', category: 'the audition', ageRange: [24, 28], once: true, queuedOnly: true,
    text: 'A holding room, a number pinned to your chest. Sixteen bars, then a dance call. A contact can get you into this room. Only what you can do gets you out of it with a job.',
    choices: [
      { label: 'Sing the song you know cold',
        check: chk(0.3, { 'talents.singing': 0.7, 'talents.acting': 0.4, 'talents.dance': 0.3, 'flags.auditionEdge': 0.2 }),
        outcomes: [
          when([need('flags.showcase', '==', 'original')], ok('They ask if you have anything of your own. You sing the number you wrote for your college showcase. The panel stops writing and listens. You are in the company.', ...BOOKED)),
          when([need('flags.auditionVia', '==', 'director')], ok('The panel has {director}\'s note in front of them, and you give them no reason to doubt a word of it. You are in the company.', ...BOOKED)),
          when([need('flags.auditionVia', '==', 'producer')], ok('{producer} watches from the back row and does not say a word. They do not need to. You are in the company.', ...BOOKED)),
          ok('Nobody in the room knows your name when you walk in. They do when you walk out. You are in the company.', ...BOOKED),
          when([need('flags.auditionVia', '==', 'director')], bad('{director}\'s word got you into the room. It could not hold the top note for you. "Come back when the voice matches the letter," the panel says.', ...NOT_YET)),
          when([need('flags.auditionVia', '==', 'producer')], bad('{producer} got your name on the list. The panel thanks you after eight bars. Afterward {producer} says, kindly, that the office always has room for you.', ...NOT_YET)),
          bad('"Thank you, that is all we need." You are back on the sidewalk in four minutes.', ...NOT_YET),
        ] },
      { label: 'Save yourself for the dance call',
        check: chk(0.25, { 'talents.dance': 0.8, 'talents.singing': 0.3, 'talents.acting': 0.3, 'flags.auditionEdge': 0.2 }),
        outcomes: [
          when([need('flags.summerProgramme', '==', true)], ok('The combination is one your conservatory choreographer drilled into you at eighteen. Your body remembers before you do. You are in the company.', ...BOOKED)),
          ok('You pick up the combination in two passes and finish it grinning. You are in the company.', ...BOOKED),
          bad('You are half a count behind from the first eight. They cut you at the first break.', ...NOT_YET),
        ] },
      { label: 'Walk out before your number is called', outcomes: [any('You leave your number on the chair.', 'neutral', st('mood', -4), hid('willpower', -2))] },
    ],
  },
];

// Health in everyday life. These scenes are driven by the health record: they
// only fire when something real is going on (healthSigns, diagnosed, skills),
// and no scene can diagnose, prescribe or end a treatment. They offer ways to
// look for help, to lean on people, and to use what has been learned.
// Scenes about distress are support-focused, never graphic, and are switched
// off by the "reduced" content setting in My Health.
import { st, hid, rel, any, ok, bad, chk, need, mem, perf } from './helpers.js';

const health = (value) => ({ type: 'health', value });
const skill = (k, topic, text, amount = 1.5) => health({ do: 'skill', skill: k, topic, text, amount });

/** A disagreement with a partner or spouse: the same scene, for either. */
const disagreement = (role) => ({
  id: `disagreement_${role}`, category: 'love', ageRange: [16, 95], cooldown: 4, weight: 2, cast: { love: role },
  text: '{love} says something about the way you left things this morning, and you feel it land hard. The conversation is going one way, fast.',
  choices: [
    { label: 'Say what you feel and what you need, plainly and calmly', requires: [need('health.skills.interpersonal', '>=', 30)],
      check: chk(0.55, { 'health.skills.interpersonal': 0.9, 'cast.love.relationship': 0.4 }), outcomes: [
        ok('You describe what happened, say how it felt, ask for what you need, and stay on it. {love} hears you, and asks what you need from them.', rel('love', 6), st('mood', 4),
          skill('interpersonal', 'conflict', 'the disagreement with your partner, and how you handled it'), mem('love', 'heardWell', 'You told them what you needed without a fight.')),
        bad('It does not land the way you meant, and it is still an argument. A smaller one than it would once have been.', rel('love', -2),
          skill('interpersonal', 'conflict', 'a disagreement with your partner that did not go to plan', 1)),
      ] },
    { label: 'Notice you are about to say something you will regret, and take twenty minutes', requires: [need('health.skills.distress', '>=', 30)],
      check: chk(0.6, { 'health.skills.distress': 0.9 }), outcomes: [
        ok('You say you need a minute, go outside, breathe, and come back. The conversation you have then is a different one.', rel('love', 4), st('mood', 3),
          skill('distress', 'conflict', 'stepping away from an argument before it escalated')),
        bad('You step away, but it follows you around the block. You come back still upset. You both get through it.', rel('love', -1),
          skill('distress', 'conflict', 'an argument that was hard to step back from', 1)),
      ] },
    { label: 'Say it all, now', check: chk(0.35, { 'stats.charm': 0.4, 'cast.love.relationship': 0.4 }), outcomes: [
      ok('It all comes out, and somehow it clears the air.', rel('love', 1)),
      bad('It all comes out. Some of it you did not mean.', rel('love', -10), st('mood', -4), health({ do: 'note', topic: 'conflict', text: 'an argument with your partner that went badly' })),
    ] },
    { label: 'Go quiet and wait for it to pass', outcomes: [any('It passes. It is not resolved.', 'neutral', rel('love', -3))] },
  ],
});

/** Telling a partner or spouse about a diagnosis: when, how, and whether, are the player's to choose. */
const tellPartner = (role) => ({
  id: `tell_${role}`, category: 'love', ageRange: [16, 95], cooldown: 6, weight: 2, cast: { love: role },
  requires: [need('untold', '==', true)], castRequires: [need('cast.love.relationship', '>=', 55)],
  text: 'Out walking with {love}, the conversation turns to the things you each find hard. There is something about your health you have not told them.',
  choices: [
    { label: 'Tell them', outcomes: [any('You tell them, in your own words. {love} listens, asks one or two careful questions, and takes your hand.', 'good',
      health({ do: 'tell', with: 'love' }), st('mood', 4))] },
    { label: 'Tell them what helps you, without the label', outcomes: [any('You talk about what helps on a hard day. {love} says they are glad to know. The rest can wait, or not.', 'good', rel('love', 4))] },
    { label: 'Not yet', outcomes: [any('You talk about something else. It is yours to share when you are ready.', 'neutral')] },
  ],
});

/** @type {import('../../types.js').GameEvent[]} */
export default [
  tellPartner('partner'),
  tellPartner('spouse'),
  {
    id: 'back_on_track', category: 'health', ageRange: [14, 95], cooldown: 8, weight: 3,
    requires: [need('recovering', '==', true)],
    text: 'You notice, one ordinary morning, that you have stopped dreading the day. It has been like that for a while now.',
    choices: [
      { label: 'Mark it with someone who was there for you', outcomes: [any('Dinner, nothing fancy. You say thank you properly, and they wave it away.', 'good', st('mood', 6))] },
      { label: 'Take on the thing you had been putting off', requires: [need('employed', '==', true)], outcomes: [any('You pick it back up at work. It goes better than you expected.', 'good', perf(5), st('mood', 3))] },
      { label: 'Keep up the routines that got you here', outcomes: [any('Sleep, people, the things that help. Boring, and it works.', 'good',
        health({ do: 'skill', skill: 'coping', topic: 'progress', text: 'how much better things have been', amount: 2 }))] },
    ],
  },
  {
    id: 'diagnosis_makes_sense', category: 'health', ageRange: [14, 95], once: true, weight: 3,
    requires: [need('diagnosed', 'has', 'adhd')],
    text: 'Since your ADHD assessment, a lot of old memories look different: the lost homework, the last-minute brilliance, the teachers who said you could try harder.',
    choices: [
      { label: 'Find other people who get it', outcomes: [any('An online group, then a real one. People finish each other\'s sentences, which is the point.', 'good', st('mood', 5))] },
      { label: 'Read everything you can find', outcomes: [any('You learn a great deal, and set up two systems that actually stick.', 'good',
        health({ do: 'skill', skill: 'organization', topic: 'learning', text: 'learning about how your attention works', amount: 4 }))] },
      { label: 'Tell your family what you have learned', outcomes: [any('Your mother goes quiet, then says she has always been exactly the same.', 'neutral', st('mood', 2))] },
    ],
  },
  {
    id: 'child_noticed', category: 'family', ageRange: [16, 120], queuedOnly: true, cast: { kid: 'child' },
    text: 'Something you have noticed about {kid} for a while comes up again at school: some things are much harder work for them than for the other children, however hard they try.',
    choices: [
      { label: 'Ask the school and the doctor about an assessment', outcomes: [any('You make the calls. {kid} is nervous, then relieved: someone is finally asking the right questions.', 'good',
        health({ do: 'childAssess', with: 'kid' }), rel('kid', 6), mem('kid', 'assessed', 'You made sure someone looked into why school was so hard.'))] },
      { label: 'Ask {kid} what is hard, and what helps', outcomes: [any('{kid} has thought about it more than you realized. You make a few changes at home together.', 'good', rel('kid', 8))] },
      { label: 'Tell them to try harder', outcomes: [any('{kid} nods and goes quiet. They were already trying.', 'bad', rel('kid', -8), mem('kid', 'tryHarder', 'You told them to try harder when school was hard.'))] },
    ],
  },
  {
    id: 'partner_hard_stretch', category: 'love', ageRange: [16, 120], queuedOnly: true, cast: { love: 'partner' },
    text: '{love} is going through a harder stretch with their mental health. They are still going to their appointments. They are tired.',
    choices: [
      { label: 'Ask what would help, and do that', outcomes: [any('It is smaller than you thought: company on the sofa, and not having to explain.', 'good', rel('love', 7))] },
      { label: 'Take some of the load off them for a while', outcomes: [any('You do the shopping and the forms for a few weeks. It counts.', 'good', rel('love', 5), health({ do: 'stress', delta: 5 }))] },
      { label: 'Look after yourself too: see your friends, keep your routines', outcomes: [any('You are better company for it. {love} says they are glad you did.', 'good', st('mood', 4), rel('love', 2))] },
      { label: 'Try to fix it for them', outcomes: [any('You make lists and suggestions. They have a therapist; they wanted a partner.', 'neutral', rel('love', -3))] },
    ],
  },
  {
    id: 'inaccessible_venue', category: 'friends', ageRange: [13, 95], cooldown: 6, weight: 2, cast: { friend: 'friend' },
    requires: [need('wheelchairBarrier', '==', true)],
    text: '{friend} is having a birthday party, upstairs at a bar with no lift.',
    choices: [
      { label: 'Tell {friend}, and suggest somewhere step-free', outcomes: [any('{friend} is mortified they did not think of it, and moves it to the place around the corner. It is a better bar anyway.', 'good', rel('friend', 5), st('mood', 3))] },
      { label: 'Write to the bar about access', outcomes: [any('A month later they reply. A year later there is a ramp and an elevator. Small things move.', 'good', hid('karma', 2))] },
      { label: 'Skip it and see {friend} another day', outcomes: [any('You take {friend} out for lunch the week after. Still, you would have liked to be there.', 'neutral', rel('friend', -1), st('mood', -2))] },
    ],
  },
  {
    id: 'loud_gathering', category: 'friends', ageRange: [12, 95], cooldown: 5, weight: 2,
    requires: [need('sensory', '==', true)],
    text: 'The party is loud, bright and crowded, and it is getting to be a lot.',
    choices: [
      { label: 'Step outside for a while', outcomes: [any('Ten minutes of cold air, and you come back in on your own terms.', 'good', health({ do: 'stress', delta: -4 }))] },
      { label: 'Put your headphones on and find a quiet corner', outcomes: [any('Someone else is already in the quiet corner. You have a long, good conversation.', 'good', st('mood', 4))] },
      { label: 'Leave early and message the host', outcomes: [any('"Thanks for coming!" they reply. Nobody minds. You sleep well.', 'neutral')] },
      { label: 'Push through to the end', outcomes: [any('You make it to the end, and spend all of the next day recovering.', 'neutral', health({ do: 'stress', delta: 8 }))] },
    ],
  },
  {
    id: 'meeting_no_interpreter', category: 'work', ageRange: [16, 80], cooldown: 5, weight: 2,
    requires: [need('hearing', '==', true), need('employed', '==', true)],
    text: 'An all-staff meeting is announced for tomorrow: an hour of people talking, with no captions and no interpreter booked.',
    choices: [
      { label: 'Ask for an interpreter', outcomes: [any('You email the organizer. Arranging it is their job; asking is yours.', 'good',
        health({ do: 'accommodate', setting: 'work', type: 'interpreter', need: 'sign_language' }))] },
      { label: 'Ask for live captions', outcomes: [any('Captions on the big screen, for everyone. Three colleagues thank you afterward.', 'good',
        health({ do: 'accommodate', setting: 'work', type: 'captions', need: 'captions' }))] },
      { label: 'Get through it and ask a colleague for notes', outcomes: [any('You catch about half of it. The notes fill in the rest.', 'neutral', health({ do: 'stress', delta: 5 }))] },
    ],
  },

  {
    id: 'persistent_low', category: 'health', ageRange: [13, 95], cooldown: 3, weight: 4,
    requires: [need('healthSigns', 'has', 'mood')],
    text: 'For weeks now, things have felt flat. Sleep is off, the things you used to like do not reach you, and getting through the day takes everything.',
    choices: [
      { label: 'Book an appointment and tell a doctor how it has been', requires: [need('age', '>=', 16)], outcomes: [any('You book it before you can talk yourself out of it. That was the hard part.', 'good',
        health({ do: 'seek', concern: 'mental' }), health({ do: 'note', topic: 'seeking', text: 'deciding to ask for help' }))] },
      { label: 'Tell a parent how you have been feeling', requires: [need('age', '<=', 17)], outcomes: [any('It comes out in a rush at the kitchen table. They listen, and they make the appointment.', 'good',
        health({ do: 'seek', concern: 'mental' }), st('mood', 3))] },
      { label: 'Tell someone you trust', outcomes: [any('Saying it out loud does not fix it. It does mean you are not carrying it on your own.', 'good', st('mood', 5), health({ do: 'stress', delta: -8 }))] },
      { label: 'Wait and see if it lifts', outcomes: [any('You keep going. Some weeks are better than others.', 'neutral')] },
    ],
  },
  {
    id: 'body_signs', category: 'health', ageRange: [18, 110], cooldown: 3, weight: 3,
    requires: [need('healthSigns', 'has', 'chronic')],
    text: 'Something about your body has not been right for a while: getting out of breath on the stairs, a tiredness that will not lift, or a change that has not gone away.',
    choices: [
      { label: 'Book an appointment with your doctor', outcomes: [any('You book it. The receptionist says you did the right thing calling.', 'good', health({ do: 'seek', concern: 'body' }))] },
      { label: 'Mention it to someone close, who nags you into going', outcomes: [any('They nag. You go.', 'good', health({ do: 'seek', concern: 'body' }), st('mood', 2))] },
      { label: 'Put it down to getting older', outcomes: [any('You carry on. It does not go away on its own.', 'neutral')] },
    ],
  },
  {
    id: 'worry_signs', category: 'health', ageRange: [12, 95], cooldown: 4, weight: 3,
    requires: [need('healthSigns', 'has', 'anxiety')],
    text: 'The worry is there when you wake up and still there at night. You have started avoiding things, just in case.',
    choices: [
      { label: 'See a doctor about it', requires: [need('age', '>=', 16)], outcomes: [any('You book the appointment. Your heart races on the phone. You do it anyway.', 'good', health({ do: 'seek', concern: 'mental' }))] },
      { label: 'Tell your parents', requires: [need('age', '<=', 17)], outcomes: [any('They had noticed. They are glad you said, and they book you in.', 'good', health({ do: 'seek', concern: 'mental' }))] },
      { label: 'Keep it to yourself', outcomes: [any('You manage. It costs more than it looks.', 'neutral', health({ do: 'stress', delta: 6 }))] },
    ],
  },
  {
    id: 'focus_at_school', category: 'school', ageRange: [6, 17], cooldown: 4, weight: 3,
    requires: [need('healthSigns', 'has', 'neurodev'), need('education.enrolled', '==', true)],
    text: 'Your teacher keeps you back after class. You are clearly bright, she says, but something is making school harder for you than it should be. Has anyone ever looked into it?',
    choices: [
      { label: 'Ask your parents about an assessment', outcomes: [any('Your parents call the school, then the doctor. An assessment is booked.', 'good', health({ do: 'seek', concern: 'auto' }))] },
      { label: 'Say you will just try harder', outcomes: [any('You try harder. You were already trying hard.', 'neutral', hid('discipline', 2))] },
    ],
  },
  {
    id: 'focus_at_university', category: 'school', ageRange: [17, 40], cooldown: 3, weight: 3,
    requires: [need('healthSigns', 'has', 'neurodev'), need('education.enrolled', '==', true)],
    text: 'Three deadlines in one week, and you have started all three essays and finished none. Everyone else seems to have a system. The student support office has a sign on the door: "Assessments and study support."',
    choices: [
      { label: 'Go in and ask about an assessment', outcomes: [any('A kind adviser explains how it works. An assessment is booked, and you can ask for support while you wait.', 'good', health({ do: 'seek', concern: 'auto' }))] },
      { label: 'Join a study group', outcomes: [any('Working next to other people helps more than you expected.', 'good', st('mood', 3))] },
      { label: 'Pull three all-nighters', outcomes: [any('You hand in three essays. You will not remember writing them.', 'neutral', st('health', -3), health({ do: 'stress', delta: 10 }))] },
    ],
  },
  disagreement('partner'),
  disagreement('spouse'),
  {
    id: 'loved_one_shares', category: 'family', ageRange: [8, 120], queuedOnly: true, cast: { who: 'relative' },
    text: '{who} asks if you have a minute, then tells you they have been getting help for their mental health, and wanted you to know.',
    choices: [
      { label: 'Listen, and ask what would help', outcomes: [any('You mostly listen. When you ask what would help, the answer is small and practical. You can do that.', 'good',
        rel('who', 8), mem('who', 'listened', 'They listened when you told them about your mental health.'))] },
      { label: 'Offer to help with something practical', outcomes: [any('You end up driving them to appointments for a few weeks. It is the kind of help that counts.', 'good', rel('who', 6), health({ do: 'stress', delta: 3 }))] },
      { label: 'Say you care, and that you are not a therapist, but you are here', outcomes: [any('{who} laughs, a bit wetly. "I have a therapist. I wanted my family." You hug.', 'good', rel('who', 7))] },
      { label: 'Tell them to try to snap out of it', outcomes: [any('Their face closes. They change the subject, and do not bring it up again.', 'bad', rel('who', -12),
        mem('who', 'dismissed', 'You told them to snap out of it when they told you about their mental health.'))] },
    ],
  },
  {
    id: 'hard_stretch', category: 'health', ageRange: [14, 95], cooldown: 2, weight: 4,
    requires: [need('hardStretch', '==', true), need('sensitiveOk', '==', true)],
    text: 'This has been one of the hardest stretches you can remember. You do not have to get through it alone.',
    choices: [
      { label: 'Call your care team, or your doctor, today', outcomes: [any('They make time for you this week, and go through what would help right now.', 'good', health({ do: 'seek', concern: 'mental', urgent: true }), health({ do: 'stress', delta: -10 }))] },
      { label: 'Reach out to someone you trust', outcomes: [any('You send the message. They call straight back.', 'good', st('mood', 6), health({ do: 'stress', delta: -8 }))] },
      { label: 'Use the plan you made for moments like this', requires: [need('inCare', '==', true)], outcomes: [any('You get the plan out, and do the first thing on it, then the next.', 'good',
        skill('distress', 'safety_plan', 'using your plan for hard moments', 2), st('mood', 4))] },
      { label: 'Accept a short, voluntary stay in the hospital if your team offers one', requires: [need('inCare', '==', true)], outcomes: [any('You pack a bag. It is calmer there than you expected, and people check on you without making a fuss.', 'good',
        health({ do: 'admit', reason: 'voluntary' }), health({ do: 'stress', delta: -12 }))] },
      { label: 'Contact a crisis line', outcomes: [any('The person who answers is calm, and in no hurry. It helps more than you expected.', 'good', health({ do: 'stress', delta: -6 }))] },
    ],
  },
  {
    id: 'mood_high_signs', category: 'health', ageRange: [14, 90], cooldown: 3, weight: 3,
    requires: [need('diagnosed', 'has', 'bipolar_1')],
    text: 'You have been sleeping less and doing more. You recognize it from the early-warning list you made with your care team.',
    choices: [
      { label: 'Call your care team, as planned', outcomes: [any('They see you that week and help you steady things. Catching it early worked.', 'good', health({ do: 'seek', concern: 'mental' }), health({ do: 'stress', delta: -6 }))] },
      { label: 'Protect your sleep and cancel the extra plans', outcomes: [any('It is hard to slow down. You do it anyway.', 'good', health({ do: 'stress', delta: -4 }))] },
    ],
  },
];

// Scenes of life inside a royal family.
//   A rivalry (rival_*): sent in order by engine/court.js, over several years,
//   to a player born into the house. {rival} is the relative concerned. Each
//   choice moves how bad things are (rivalry(+/-)), and that decides which
//   ending arrives: peace, a public crisis, or a long silence.
//   A royal childhood: scenes for a child born into the family.
import { st, hid, ms, ok, bad, any, chk, need, rel, image, rivalry, rivalEnd, flag } from './helpers.js';

const bornRoyal = [need('isRoyal', '==', true), need('royalBy', '==', 'birth')];

/** @type {import('../../types.js').GameEvent[]} */
export default [
  // ---------- A rivalry, year by year ----------
  {
    id: 'rival_overlooked', category: 'royalty', ageRange: [16, 110], queuedOnly: true, cooldown: 1,
    text: 'At a family dinner, {rival} says, quite loudly, that some people in this family are given everything and others are expected to clap. Everyone looks at their plate. {rival} is looking at you.',
    choices: [
      { label: 'Ask what they would like to be doing', outcomes: [any('It turns out nobody has ever asked. You find {rival} a patronage and an office of their own. It is not everything they wanted, but it is something.', 'good', rivalry(-18), rel('rival', 10), image(2))] },
      { label: 'Hear them out, later, alone', check: chk(0.6, { 'stats.charm': 0.4, 'cast.rival.relationship': 0.4 }), outcomes: [
        ok('Two hours and a bottle of something old. You do not agree, but you part as family.', rivalry(-10), rel('rival', 8)),
        bad('It becomes a list of every slight since childhood. Some of them you had forgotten. None of them has {rival}.', rivalry(8), rel('rival', -6), st('mood', -4)),
      ] },
      { label: 'Say that this is how it has always been', outcomes: [any('It is true, and it is exactly the wrong thing to say.', 'bad', rivalry(16), rel('rival', -12))] },
      { label: 'Laugh it off', outcomes: [any('The table laughs with you. {rival} does not, and will remember who did.', 'neutral', rivalry(10), rel('rival', -6))] },
    ],
  },
  {
    id: 'rival_allies', category: 'royalty', ageRange: [16, 110], queuedOnly: true, cooldown: 1,
    text: '{rival} has been seen a good deal lately with a newspaper owner and two members of the government. Your private secretary thinks you ought to know that your name comes up.',
    choices: [
      { label: 'Invite {rival} into your confidence', outcomes: [any('You ask their advice on something that matters, and take it. It is harder to brief against someone who listens to you.', 'good', rivalry(-16), rel('rival', 8))] },
      { label: 'Ask them straight out what they want', check: chk(0.45, { 'stats.charm': 0.3, 'hidden.willpower': 0.3 }), outcomes: [
        ok('"To matter," says {rival}, after a long silence. It is the first honest conversation the two of you have had in years.', rivalry(-12), rel('rival', 10)),
        bad('{rival} smiles and says they cannot imagine what you mean. By evening the newspaper owner knows you asked.', rivalry(12), rel('rival', -8), image(-3)),
      ] },
      { label: 'Have them watched', outcomes: [any('You learn where {rival} dines and with whom. {rival} learns, within the month, that you have been asking.', 'bad', rivalry(18), rel('rival', -14), hid('karma', -5))] },
      { label: 'Do nothing, and do your own job well', outcomes: [any('You let your work answer for you. It is slower than a quarrel, and it lasts longer.', 'neutral', rivalry(4), image(4), hid('discipline', 2))] },
    ],
  },
  {
    id: 'rival_public', category: 'royalty', ageRange: [16, 110], queuedOnly: true, cooldown: 1,
    text: 'In an interview nobody at the palace approved, {rival} says the family needs "someone who understands the modern world", and does not say who they have in mind. They do not need to.',
    choices: [
      { label: 'Go and see them, without staff', check: chk(0.5, { 'stats.charm': 0.4, 'cast.rival.relationship': 0.5 }), outcomes: [
        ok('You turn up at their door with no warning and no secretary. Something in that reaches them. The next interview is a good deal kinder.', rivalry(-22), rel('rival', 12)),
        bad('You are kept waiting in the hall for forty minutes, and then told it is not convenient.', rivalry(10), rel('rival', -8), st('mood', -6)),
      ] },
      { label: 'Answer in public, with grace', check: chk(0.5, { 'stats.charm': 0.5, 'stats.intellect': 0.3 }), outcomes: [
        ok('Asked about it at an engagement, you say that every family argues and yours simply does it on television. The country laughs, and is on your side.', image(8), rivalry(6)),
        bad('Your answer is called thin-skinned. Now it is a feud, with two camps and a great many columns.', image(-7), rivalry(14)),
      ] },
      { label: 'Have the palace cut their allowance', outcomes: [any('It is within your power, and everyone can see whose hand it was.', 'bad', rivalry(24), rel('rival', -20), image(-4), hid('karma', -6))] },
      { label: 'Say nothing at all', outcomes: [any('The palace has no comment. The story runs for two weeks on what the silence might mean.', 'neutral', image(-3), rivalry(5))] },
    ],
  },
  {
    id: 'rival_crisis', category: 'royalty', ageRange: [16, 110], queuedOnly: true, cooldown: 1,
    text: 'It has come to a head. {rival} has gone to the monarch with a list of your failings, and a suggestion that some of your duties, and your standing, would be safer in other hands.',
    choices: [
      { label: 'Put your record on the table', check: chk(0.35, { 'royal.image': 0.9, 'stats.intellect': 0.2 }), outcomes: [
        ok('Every engagement, every letter, every visit, set out in order. The monarch reads it through, and tells {rival} to find something useful to do abroad.', rivalEnd('lost'), image(6), st('mood', 8)),
        bad('Your record is thinner than you had told yourself. Three of your patronages are handed to {rival}, in front of the family.', rivalEnd('lost'), image(-10), st('mood', -12)),
      ] },
      { label: 'Offer to share the work', outcomes: [any('You say that there is more than enough for two, and mean it. {rival} had prepared for a fight, and has no answer to this. It is not friendship, but it holds.', 'good', rivalEnd('peace'), image(4), hid('karma', 6))] },
      { label: 'Tell the monarch what {rival} has been saying to the newspapers', outcomes: [
        { on: 'always', weight: 0.5, tone: 'neutral', text: 'The monarch already knew, and had been waiting to see whether you would say it. {rival} is not invited at Christmas.', effects: [rivalEnd('cold'), hid('karma', -3)] },
        { on: 'always', weight: 0.5, tone: 'bad', text: 'The monarch looks at the two of you for a long time and says that you are both a disappointment.', effects: [rivalEnd('cold'), image(-5), st('mood', -8)] },
      ] },
    ],
  },
  {
    id: 'rival_crisis_crown', category: 'royalty', ageRange: [16, 110], queuedOnly: true, cooldown: 1,
    text: '{rival} has said in public that the country would be better served if you stepped aside. Two newspapers agree. Members of the government have been asked, on the record, whether they have confidence in you. This is no longer a family quarrel.',
    choices: [
      { label: 'Address the country', check: chk(0.3, { 'royal.image': 1.0, 'stats.charm': 0.3 }), outcomes: [
        ok('You speak for six minutes, without notes. By morning the government has declared its confidence, and parliament has removed {rival} from the line of succession.', rivalEnd('removed'), image(10), st('mood', 10)),
        bad('It does not land. The polls move against you, and {rival} is asked on to every program to say what they would do differently.', rivalEnd('lost'), image(-18), st('mood', -14)),
      ] },
      { label: 'Give {rival} a real place at your side', outcomes: [any('You make them your representative abroad, with a household of their own. It costs you some pride and ends the crisis in an afternoon.', 'good', rivalEnd('peace'), image(3), hid('karma', 5))] },
      { label: 'Ask the government to deal with it', outcomes: [
        { on: 'always', weight: 0.55, tone: 'neutral', text: 'The prime minister has a quiet word. {rival} takes a long vacation. You owe the government a favor now, and it will be collected.', effects: [rivalEnd('cold'), image(-2)] },
        { on: 'always', weight: 0.45, tone: 'bad', text: 'The prime minister says it is a family matter. You look weak for having asked.', effects: [rivalEnd('lost'), image(-10), st('mood', -8)] },
      ] },
    ],
  },
  {
    id: 'rival_peace', category: 'royalty', ageRange: [16, 110], queuedOnly: true, cooldown: 1,
    text: '{rival} asks to see you. No staff, no agenda. They say that they are tired of it, that they said things they should not have, and that they would like their family back.',
    choices: [
      { label: 'Say you would like that too', outcomes: [any('You walk in the gardens for an hour without saying much. It is enough. The newspapers have to find something else to write about.', 'good', rivalEnd('peace'), st('mood', 10), image(3))] },
      { label: 'Make them say it in public first', outcomes: [any('{rival} gives the statement, word for word as the palace wrote it. You have your apology. You do not have your family back.', 'neutral', rivalEnd('cold'), image(2), hid('karma', -4))] },
    ],
  },

  // ---------- A royal childhood ----------
  {
    id: 'royal_nanny', category: 'royalty', ageRange: [3, 6], once: true, requires: bornRoyal,
    text: 'You see your nanny every hour of the day, and your parents at six o\'clock, washed and brushed, for half an hour before bed.',
    choices: [
      { label: 'Run to your parents the moment the door opens', outcomes: [any('They are a little startled, and then they pick you up. The half hour runs long that night, and on many nights after.', 'good', st('mood', 6))] },
      { label: 'Stand nicely, as nanny showed you', outcomes: [any('You shake your father\'s hand and say good evening. Everyone says what a good child you are.', 'neutral', hid('discipline', 4), st('mood', -3))] },
      { label: 'Hide behind nanny', outcomes: [any('Nanny is the one who knows which bear you sleep with. You will understand, later, why your mother looked away.', 'neutral', st('mood', -2))] },
    ],
  },
  {
    id: 'royal_etiquette', category: 'royalty', ageRange: [7, 11], once: true, requires: bornRoyal,
    text: 'Twice a week a very upright woman teaches you how to sit, how to stand, how to eat an artichoke, and how to say a great deal without saying anything.',
    choices: [
      { label: 'Learn it all', outcomes: [any('By the summer you can keep a conversation going with an ambassador for ten minutes about nothing whatever. It is a real skill, and you will use it all your life.', 'good', st('charm', 4), hid('discipline', 5), st('mood', -2))] },
      { label: 'Learn it, and practice the opposite on your cousins', outcomes: [any('You can do the curtsey and the impression of the woman who teaches it. Both are much admired.', 'good', st('charm', 3), st('mood', 5))] },
      { label: 'Put a frog in her handbag', outcomes: [any('She does not scream. She removes the frog, sets it on the lawn, and adds an hour to Thursdays.', 'neutral', st('mood', 4), hid('discipline', -3), hid('willpower', 2))] },
    ],
  },
  {
    id: 'royal_first_engagement', category: 'royalty', ageRange: [8, 13], once: true, requires: bornRoyal,
    text: 'Your first public engagement: opening a children\'s ward. There is a ribbon, a pair of scissors too big for your hands, and a row of cameras.',
    choices: [
      { label: 'Do exactly as you were told', outcomes: [any('You cut the ribbon, say your one line, and shake eleven hands. The matron says you are a credit to your family.', 'good', image(4), hid('discipline', 3))] },
      { label: 'Stop and talk to a boy with his leg in a cast', outcomes: [any('You sit on his bed for twenty minutes comparing scars, and the whole program runs late. The photograph of the two of you is the one everybody keeps.', 'good', image(9), hid('karma', 4), st('mood', 5))] },
      { label: 'Freeze', outcomes: [any('The scissors will not cut and your line will not come. A nurse puts a hand on your shoulder, and the two of you do it together.', 'neutral', image(1), st('mood', -5))] },
    ],
  },
  {
    id: 'royal_boarding_school', category: 'royalty', ageRange: [11, 13], once: true, cast: { parent: 'parent' }, requires: bornRoyal,
    text: 'It has been decided that you will go to a boarding school in another country, where your family has always gone. You would rather stay near your friends. {parent} says the matter is settled.',
    choices: [
      { label: 'Go', outcomes: [any('The dormitories are cold and the rules are older than the plumbing. You learn two languages and how to stand on your own feet, and you write home less than you should.', 'neutral', st('intellect', 5), hid('discipline', 6), st('mood', -6), rel('parent', -4), flag('boardingSchool'))] },
      { label: 'Ask for a day school near home instead', check: chk(0.4, { 'stats.charm': 0.4, 'cast.parent.relationship': 0.6 }), outcomes: [
        ok('{parent} is quiet for a while, and then says that perhaps the family has sent enough children away. You stay.', st('mood', 8), rel('parent', 6)),
        bad('It is not a discussion. Your trunk is packed for you.', st('mood', -8), rel('parent', -8), st('intellect', 4), hid('discipline', 4), flag('boardingSchool')),
      ] },
      { label: 'Ask your grandmother to step in', outcomes: [
        { on: 'always', weight: 0.5, tone: 'good', text: 'One telephone call from the right person, and the matter is unsettled again. You stay. {parent} does not thank you for going over their head.', effects: [st('mood', 6), rel('parent', -6)] },
        { on: 'always', weight: 0.5, tone: 'neutral', text: 'You are told that this is exactly what a boarding school is meant to cure. You go.', effects: [st('mood', -6), st('intellect', 4), hid('discipline', 5), flag('boardingSchool')] },
      ] },
      { label: 'Refuse to get in the car', outcomes: [any('It takes two footmen and is watched by the whole household. You go anyway, with a reputation that arrives a day ahead of you.', 'bad', st('mood', -8), rel('parent', -12), hid('willpower', 5), st('intellect', 3), flag('boardingSchool'))] },
    ],
  },
  {
    id: 'royal_the_spare', category: 'royalty', ageRange: [10, 16], once: true, cast: { sib: 'sibling' }, requires: [...bornRoyal, need('royal.line', '>=', 2)],
    text: 'A visitor to the palace spends half an hour talking to {sib} about the future, and then asks you whether you have any hobbies. {sib} comes before you in the line, and everybody in every room knows it.',
    choices: [
      { label: 'Decide to be the best at something of your own', outcomes: [any('If you are not to be the heir, you will be the one who is really good at something. You start that week.', 'good', hid('willpower', 5), hid('discipline', 4), st('mood', 3))] },
      { label: 'Be glad it is not you', outcomes: [any('{sib} will never be able to leave. You will. You find you are whistling.', 'good', st('mood', 8), rel('sib', 4))] },
      { label: 'Take it out on {sib}', outcomes: [any('You say something that cannot be unsaid about who would do it better. {sib} does not tell anyone, which is worse.', 'bad', rel('sib', -14), st('mood', -4), hid('karma', -4))] },
    ],
  },
  {
    id: 'royal_media_training', category: 'royalty', ageRange: [14, 17], once: true, requires: bornRoyal,
    text: 'A former journalist is brought in to teach you how to be interviewed. He asks you the worst question he can think of, about your family, with a camera running.',
    choices: [
      { label: 'Answer honestly', outcomes: [any('He plays it back. It is honest, and it would have been on every front page for a week. "Now," he says, "say the same thing without giving me a headline."', 'neutral', st('intellect', 3), st('charm', 2))] },
      { label: 'Smile and say nothing in forty words', check: chk(0.5, { 'stats.charm': 0.5, 'hidden.discipline': 0.3 }), outcomes: [
        ok('He switches the camera off and says you are a natural, and that he is slightly sorry about it.', st('charm', 5), image(3), hid('discipline', 2)),
        bad('You say nothing in four hundred words, and one of them is a mistake.', st('charm', 2), st('mood', -3)),
      ] },
      { label: 'Ask him why people want to know', outcomes: [any('He thinks about it properly. "Because you are the only family everybody has in common," he says. You remember that.', 'good', st('intellect', 4), hid('karma', 2))] },
    ],
  },
  {
    id: 'royal_no_ordinary_friend', category: 'royalty', ageRange: [8, 15], once: true, requires: bornRoyal,
    text: 'A friend from school comes to tea. There is a policeman in the hallway, a footman behind each chair, and your friend, who is never quiet, has not said a word in twenty minutes.',
    choices: [
      { label: 'Take them to the kitchens instead', outcomes: [any('The cook gives you both bread and dripping at the scrubbed table, and your friend comes back to life. You are there until dark.', 'good', st('mood', 8), st('charm', 2))] },
      { label: 'Show them the armory', outcomes: [any('Four hundred years of swords will loosen anybody\'s tongue. You are both told off, and it is worth it.', 'good', st('mood', 6), hid('discipline', -2))] },
      { label: 'Carry on with tea', outcomes: [any('Your friend goes home after an hour, very polite. At school on Monday it is not quite the same.', 'bad', st('mood', -6))] },
    ],
  },
];

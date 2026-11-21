// Stories of real relationships (engine/loveStories.js decides when one is true and tells it; nothing here is drawn by
// chance). Then four ordinary scenes of being a teenager with someone, which the usual draw may bring to a teenager who
// actually has a boyfriend, girlfriend or friend of their own age. (The school dance is its own scene already.)
import { any, st, rel, hid } from '../helpers.js';

const l = (value) => ({ type: 'love', value });
const scene = (id, ages, text, choices) => ({ id, category: 'marriage', ageRange: ages, queuedOnly: true, text,
  choices: choices.map(([label, value, line, tone = 'neutral']) => ({ label, outcomes: [any(line, tone, l(value))] })) });
const adult = (id, text, choices) => scene(`love_${id}`, [18, 120], text, choices.map(([label, c, line, tone]) => [label, `${id}:${c}`, line, tone]));

const stories = [
  adult('other_address', 'The Other Address. {them} has been living in the place you own for a while now. Over dinner there, they ask what the arrangement is, exactly.', [
    ['Go through the arrangement together', 'review', 'You talk it through.'],
    ['Ask what they want in the long run', 'longterm', 'You ask {them} what they would want, if they could choose.'],
    ['Say it is time they found their own place', 'reconsider', 'You say that it cannot go on.', 'bad'],
    ['Leave things as they are', 'continue', 'You say it suits you as it is.'],
  ]),
  adult('gift_meaning', 'A Gift With Meaning. {them} has kept what you gave them on the table, in its box, for a week. "I need to ask you what this is."', [
    ['"It means I am serious about you."', 'serious', 'You tell {them} it was not only a present.'],
    ['"It is a gift. I wanted you to have it."', 'gift', 'You tell {them} it is theirs, and asks nothing.'],
    ['Change the subject', 'nothing', 'You talk about something else.'],
  ]),
  adult('anniversary_hidden', 'An Anniversary You Are Hiding. It is a year, to the week, since you and {them} began. There is nobody either of you can tell.', [
    ['Celebrate, somewhere private', 'celebrate', 'You take {them} out of town.'],
    ['Talk about the secrecy', 'secrecy', 'You say what you have both been thinking.'],
    ['Explain that you have to be elsewhere', 'commitments', 'You tell {them} you cannot get away.'],
    ['Reconsider the whole thing', 'reconsider', 'You tell {them} that a year is long enough to know.', 'bad'],
  ]),
  adult('unexpected_feelings', 'Unexpected Feelings. {them} has told you this has come to mean more to them than it was meant to. They are not asking for anything. They wanted you to know.', [
    ['Explore a romance', 'romance', 'You tell {them} you have wondered too.'],
    ['Go on as you are', 'continue', 'You say you would like things to stay as they are.'],
    ['Go back to being friends', 'friends', 'You say the friendship matters more.'],
    ['End the arrangement', 'end', 'You say it would be unkind to go on.'],
  ]),
  adult('are_we_exclusive', 'Are We Exclusive? {them} asks it lightly, as if it did not matter: "Are you seeing anyone else? Should I be?"', [
    ['"Only you."', 'yes', 'You tell {them} there is nobody else, and you do not want there to be.'],
    ['"I am not ready to say."', 'notYet', 'You say you had not thought of it as a question yet.'],
    ['Suggest you both stay free to see others', 'open', 'You say you would rather neither of you promised that.'],
  ]),
  adult('something_different', 'Something Feels Different. {them} says it at breakfast: "You have been somewhere else for months. Is it me?"', [
    ['Talk openly', 'talk', 'You put down your cup and talk.'],
    ['Make time for the two of you', 'time', 'You clear a weekend.'],
    ['Tell them what has been weighing on you', 'stress', 'You tell {them} what it really is.'],
    ['Suggest seeing someone together', 'counseling', 'You suggest a counselor.'],
  ]),
  adult('more_than_friends', 'More Than Friends? {them} walks you home, and at the door does not say goodnight. "Have you ever wondered about us?"', [
    ['Explore a relationship', 'romance', 'You say that you have.'],
    ['Keep things as they are', 'platonic', 'You say that you love {them} as a friend.'],
    ['Ask for time to think', 'time', 'You say you need to think.'],
    ['Suggest something casual', 'casual', 'You say you are not looking for a relationship, but.'],
  ]),
  adult('one_night_again', 'One Night, Another Conversation. A message from {them}, after all this time: would you like to get a coffee?', [
    ['Go, as friends', 'friends', 'You go.'],
    ['Go, and see where it leads', 'casual', 'You go, and say you would like to see them again.'],
    ['Wish them well and decline', 'decline', 'You write back kindly.'],
  ]),
  adult('one_more_chance', 'One More Chance. {them} asks to meet. They have thought about it for a long time. "I am not asking you to pretend it did not happen. I am asking whether you would try again."', [
    ['Try again', 'again', 'You say yes.'],
    ['Be in each other\'s lives, as friends', 'friends', 'You say not that, but something.'],
    ['Leave it where it is', 'no', 'You say no.'],
  ]),
  adult('old_love', 'An Old Love Reappears. A letter from {them}, whom you have not heard from in years. They are in town next week.', [
    ['Meet them', 'meet', 'You write back with a time and a place.'],
    ['Ask what they want', 'ask', 'You write back and ask why now.'],
    ['Do not answer', 'decline', 'You put the letter away.'],
  ]),
  // The teenage pregnancy storyline (off unless turned on in Settings). Told plainly, with nothing described.
  scene('teen_life_changing', [15, 17], 'A Life-Changing Conversation. {who} You and {them} have known for two days. Nobody else does.', [
    ['See a nurse or a doctor', 'teenNews:doctor', 'You make an appointment.'],
    ['Talk to an adult you trust', 'teenNews:adult', 'You decide who.'],
    ['Call a confidential helpline', 'teenNews:support', 'You find the number.'],
    ['Take some time first', 'teenNews:time', 'You need a few days.'],
  ]),
  scene('teen_who_to_tell', [15, 17], 'Who Can I Tell? It is yours to tell, and you can choose who hears it first.', [
    ['A parent or guardian', 'teenTell:parent', 'You tell them at the kitchen table.'],
    ['A counselor at school', 'teenTell:counselor', 'You knock on the counselor\'s door.'],
    ['A relative you trust', 'teenTell:relative', 'You ring the one person who never panics.'],
    ['Nobody yet', 'teenTell:nobody', 'Not yet.'],
  ]),
  scene('teen_school', [15, 17], 'School and the Future. Nobody can make you leave school, and you do not want to. The question is how.', [
    ['Carry on as you are', 'teenSchool:stay', 'You go in on Monday as usual.'],
    ['Ask the school to make allowances', 'teenSchool:accommodate', 'You ask what can be arranged.'],
    ['Ask for help keeping up', 'teenSchool:support', 'You ask a teacher for help.'],
    ['Look at other ways of finishing school', 'teenSchool:other', 'You look at what else there is.'],
  ]),
  scene('teen_parenthood', [15, 17], 'Thinking About Parenthood. A nurse has gone through what there is with you, without telling you what to do. It is not to be decided by anyone else.', [
    ['Keep the baby', 'teenPlan:raise', 'You begin to plan.'],
    ['Talk to an adoption agency', 'teenPlan:adoption', 'You ask what adoption would mean.'],
    ['Find out what help there is', 'teenPlan:help', 'You ask who could help.'],
    ["Don't keep it", 'teenPlan:end', 'You say it out loud, and then you make the call.'],
  ]),
  // For anyone, at any age: asked whenever a pregnancy is announced (engine/pregnancyChoice.js). The answer is the pregnant person\'s.
  scene('pregnancy_choice', [12, 60], 'Expecting. {who} Nothing has to be decided today, but it is yours to decide.', [
    ['Keep the baby', 'pregnancy:keep', 'You decide to keep the baby.', 'good'],
    ["Don't keep it", 'pregnancy:end', 'You make your decision, and you are not asked to explain it to anyone.'],
  ]),
  scene('pregnancy_partner', [12, 90], 'Expecting. {who} It is their body and their decision. You can say what you hope, or that you will stand by whatever they choose.', [
    ['Stand by them', 'pregnancy:support', 'You tell them you are with them either way.'],
    ['Hope they keep it', 'pregnancy:keep', 'You tell them what you hope.'],
    ["Hope they don't", 'pregnancy:end', 'You tell them what you hope, as gently as you can.'],
  ]),
];

const TEEN = [14, 17];
const teen = [
  { id: 'are_we_dating', category: 'teen', ageRange: TEEN, cooldown: 6, cast: { love: 'partner' },
    text: 'You and {love} have been spending every break together for a month. In the corridor someone asks if you two are going out, and you both answer at once, differently.',
    choices: [
      { label: 'Ask {love} what they think you are', outcomes: [any('You talk on the way home. You are going out. It is official, and slightly embarrassing.', 'good', rel('love', 8), st('mood', 6))] },
      { label: 'Laugh it off', outcomes: [any('You both laugh. Neither of you brings it up again that week.', 'neutral', rel('love', -2))] },
      { label: 'Say you would rather not put a name on it', outcomes: [any('{love} says that is fine. You are not sure it is.', 'neutral', rel('love', -4))] },
    ] },
  { id: 'friend_disapproves', category: 'teen', ageRange: TEEN, cooldown: 8, cast: { love: 'partner', pal: 'friend' },
    text: '{pal} waits until you are alone. "I do not like how {love} talks to you. I had to say it."',
    choices: [
      { label: 'Listen', outcomes: [any('You hear {pal} out. Some of it you had half noticed yourself.', 'neutral', rel('pal', 6), st('intellect', 1))] },
      { label: 'Explain what {pal} does not see', outcomes: [any('You tell {pal} what {love} is like when it is just the two of you. {pal} listens.', 'neutral', rel('pal', 2))] },
      { label: 'Tell {pal} it is not their business', outcomes: [any('{pal} says "fine", and it is not fine for two weeks.', 'bad', rel('pal', -10))] },
    ] },
  { id: 'asking_advice', category: 'teen', ageRange: TEEN, cooldown: 8, cast: { love: 'partner', elder: 'parent' },
    text: 'Things with {love} are moving faster than you are sure about. {elder} has noticed you are quiet.',
    choices: [
      { label: 'Ask {elder} what they think', outcomes: [any('{elder} does not lecture. They say you never owe anybody more than you want to give, and that a person worth having will wait.', 'good', rel('elder', 8), hid('willpower', 2))] },
      { label: 'Talk to {love} about going slower', outcomes: [any('{love} says of course. It is easier between you afterwards.', 'good', rel('love', 5), st('mood', 4))] },
      { label: 'Keep it to yourself', outcomes: [any('You work it out alone, slowly.', 'neutral', st('mood', -2))] },
    ] },
  { id: 'after_graduation', category: 'teen', ageRange: [17, 18], once: true, cast: { love: 'partner' },
    text: 'School is nearly over. {love} has plans that are in a different place from yours. You are both pretending not to have noticed.',
    choices: [
      { label: 'Promise to make it work', outcomes: [any('You promise. Whether you can keep it, the next few years will say.', 'neutral', rel('love', 6), st('mood', 3))] },
      { label: 'Agree to see how it goes', outcomes: [any('No promises. It is sad, and it is honest.', 'neutral', rel('love', -2))] },
      { label: 'End it kindly, now', outcomes: [any('You end it before the summer does. You both cry, and you are still glad of all of it.', 'neutral', rel('love', -12), st('mood', -6), hid('willpower', 2))] },
    ] },
];

export default [...stories, ...teen];

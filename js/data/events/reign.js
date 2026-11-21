// Scenes about the crown itself: reigning, the question of a republic, the
// end of a monarchy and what comes after. The referendum, after_the_crown
// and restoration scenes are sent by engine/reign.js.
//   support(+/-)   moves the country's support for having a monarchy
//   vote(push)     holds the referendum; push is what the player's campaign added
//   abolish(), exile(), restore(), abdicate()
import { st, hid, cash, ms, ok, bad, any, chk, need, image, family, press, support, vote, exile, restore, abdicate, flag } from './helpers.js';

const reigning = need('reigning', '==', true);
const advises = [reigning, need('crownGoverns', '==', false)];
const rules = [reigning, need('crownGoverns', '==', true)];

/** @type {import('../../types.js').GameEvent[]} */
export default [
  // ---------- Reigning ----------
  {
    id: 'weekly_audience', category: 'royalty', ageRange: [18, 110], cooldown: 7, requires: advises,
    text: '{pm}, the {pmTitle}, comes every week, and what is said never leaves the room. This week the government is about to do something you think is a serious mistake.',
    choices: [
      { label: 'Ask the three questions that expose it', check: chk(0.5, { 'stats.intellect': 0.7 }), outcomes: [
        ok('You never say it is a mistake. You only ask what happens in the second year. The prime minister goes away thoughtful, and the plan is quietly changed.', support(3), hid('karma', 4), st('mood', 4)),
        bad('The prime minister has an answer for each. You have used your one chance and changed nothing.', st('mood', -3)),
      ] },
      { label: 'Say what you think, plainly', outcomes: [
        { on: 'always', weight: 0.5, tone: 'neutral', text: 'It is your right to warn, and you use it. The prime minister thanks you, and does it anyway.', effects: [hid('willpower', 2)] },
        { on: 'always', weight: 0.5, tone: 'bad', text: 'A version of the conversation reaches a newspaper: the crown meddling in politics.', effects: [support(-5), press(-5)] },
      ] },
      { label: 'Listen, and say nothing', outcomes: [any('It is not your place, you tell yourself. The mistake is made, and you sign it.', 'neutral', st('mood', -4), hid('discipline', 2))] },
    ],
  },
  {
    id: 'hung_parliament', category: 'royalty', ageRange: [18, 110], cooldown: 4, requires: [...advises, need('hung', '==', true)],
    text: 'The election has produced no winner. Two party leaders each claim they can form a government, and by custom it falls to you to send for one of them. Whoever you do not send for will say you took sides.',
    choices: [
      { label: 'Wait, and make them agree between themselves', check: chk(0.6, { 'hidden.willpower': 0.5, 'hidden.discipline': 0.3 }), outcomes: [
        ok('Nine days with no government, and you do not move. On the tenth they bring you a deal. Nobody can say the crown chose.', support(6), image(4)),
        bad('The markets fall for nine days, and the newspapers ask what the crown is for if not for this.', support(-5), image(-4)),
      ] },
      { label: 'Send for the leader of the largest party', outcomes: [any('It is what your grandfather would have done. The other leader grumbles for a week, and then it is forgotten.', 'neutral', support(1))] },
      { label: 'Send for the one you think would govern better', outcomes: [
        { on: 'always', weight: 0.35, tone: 'good', text: 'They form a government that lasts, and history decides you judged well.', effects: [support(4), hid('karma', 2)] },
        { on: 'always', weight: 0.65, tone: 'bad', text: 'The government falls in four months, and it is remembered as the crown\'s government.', effects: [support(-9), image(-5), press(-6)] },
      ] },
    ],
  },
  {
    id: 'petitioners_at_the_gate', category: 'royalty', ageRange: [18, 110], cooldown: 8, requires: rules,
    text: 'A crowd has walked for three days to the palace gate with a petition: a governor you appointed has been taking their land. Your ministers advise that receiving them would only encourage others.',
    choices: [
      { label: 'Receive them, and remove the governor', outcomes: [any('You read the petition in front of them, and the governor is gone by nightfall. Your ministers were right: others come. You find you do not mind.', 'good', support(8), image(5), family(-4), hid('karma', 8))] },
      { label: 'Send an official to hear them', outcomes: [any('The official listens, writes it down, and promises an inquiry. The inquiry reports in two years.', 'neutral', support(-2))] },
      { label: 'Have the square cleared', outcomes: [any('It is done by the afternoon. There are photographs, and they are seen abroad.', 'bad', support(-10), image(-8), press(-10), hid('karma', -15))] },
    ],
  },
  {
    id: 'palace_coup_whisper', category: 'royalty', ageRange: [18, 110], cooldown: 20, weight: 0.5, requires: [...rules, need('royal.family', '<=', 40)],
    text: 'A cousin and two generals have been dining together a good deal. An old servant, who has known you since you were born, tells you what they talk about.',
    choices: [
      { label: 'Bring the generals in, and promote them', check: chk(0.55, { 'stats.charm': 0.4, 'stats.intellect': 0.3 }), outcomes: [
        ok('Men who are given what they wanted have no reason to take it. The dinners stop.', family(4), hid('karma', -2)),
        bad('They take the promotions, and keep dining.', family(-6), st('mood', -6)),
      ] },
      { label: 'Send your cousin abroad as an ambassador', outcomes: [any('A long way abroad. They write polite letters. You read them carefully.', 'neutral', family(-5), support(1))] },
      { label: 'Arrest all three', outcomes: [
        { on: 'always', weight: 0.6, tone: 'bad', text: 'It is over before dawn. The family will not forgive it, and nobody ever dines freely near you again.', effects: [family(-20), support(-4), hid('karma', -12), image(-5)] },
        { on: 'always', weight: 0.4, tone: 'bad', text: 'The army does not obey the order. By morning it is you who has been asked to leave.', effects: [abdicate(), st('mood', -15)] },
      ] },
    ],
  },

  // ---------- The question of a republic ----------
  {
    id: 'referendum_crown', category: 'royalty', ageRange: [16, 110], queuedOnly: true, cooldown: 1,
    text: 'It has come to this: parliament has voted to ask the country whether it still wants a monarchy. The vote is in six weeks, and the question on the paper is, in the end, about you.',
    choices: [
      { label: 'Go out and ask for their trust', check: chk(0.4, { 'royal.image': 0.9, 'stats.charm': 0.3 }), outcomes: [
        ok('Thirty towns in forty days, no speeches, only listening. People who came to jeer stay to talk.', vote(14), st('health', -3)),
        bad('The crowds are thin and the questions are fair, and you do not have good answers.', vote(-4), st('mood', -8)),
      ] },
      { label: 'Promise a smaller, cheaper crown', outcomes: [any('Fewer palaces, fewer titles, the accounts published every year. The family is appalled. The country listens.', 'neutral', vote(12), family(-15))] },
      { label: 'Step down for your heir, and let them make the case', outcomes: [any('You give up the throne on a Tuesday. A new face asks the country for a fresh start.', 'neutral', abdicate(), vote(16))] },
      { label: 'Stay silent, above the argument', outcomes: [any('The crown does not campaign. It is dignified, and it leaves the field to the other side.', 'neutral', vote(-6), hid('discipline', 2))] },
    ],
  },
  {
    id: 'referendum_family', category: 'royalty', ageRange: [16, 110], queuedOnly: true, cooldown: 1,
    text: 'Parliament has voted to ask the country whether it still wants a monarchy. The vote is in six weeks. Everything your family has been for centuries is on one sheet of paper.',
    choices: [
      { label: 'Campaign for the crown', check: chk(0.45, { 'royal.image': 0.8, 'stats.charm': 0.3 }), outcomes: [
        ok('You turn out to be the family\'s best argument: you are liked, and you say so little that is foolish.', vote(9), family(8)),
        bad('You are heckled in three towns and photographed looking cross in the fourth.', vote(-4), family(-3)),
      ] },
      { label: 'Say publicly that the country must decide freely', outcomes: [any('It is the truth, and it is not what the family wanted said. Some people respect the crown more for it.', 'neutral', vote(3), family(-10), image(5))] },
      { label: 'Keep out of it', outcomes: [any('You watch the result come in on television, like everyone else.', 'neutral', vote(0))] },
    ],
  },
  {
    id: 'after_the_crown', category: 'royalty', ageRange: [0, 120], queuedOnly: true, cooldown: 1,
    text: 'It is over. The flag over the palace is taken down, and a polite official from the new republic explains what you may keep: your own money, your clothes, your name. The residences belong to the state. You have thirty days.',
    choices: [
      { label: 'Stay, as an ordinary citizen', outcomes: [any('You rent an apartment under your own name. For a while people stare in shops. Then, slowly, they stop.', 'neutral', flag('stayedAfterFall'), hid('willpower', 5), st('mood', 4), ms('Stayed on as a private citizen after the monarchy fell.'))] },
      { label: 'Go into exile', outcomes: [any('You leave with what fits in the cases. From the airplane window the country looks exactly as it always did.', 'bad', exile(), st('mood', -6))] },
      { label: 'Refuse to leave the palace', outcomes: [any('You stay in your rooms for nine days. On the tenth the water is turned off. You walk out through a crowd of photographers, carrying your own bag.', 'bad', st('mood', -10), hid('willpower', 3), flag('stayedAfterFall'))] },
    ],
  },
  {
    id: 'restoration_offer', category: 'royalty', ageRange: [16, 120], queuedOnly: true, cooldown: 1,
    text: 'A delegation from the old country has come to see you. The republic has not gone well. There has been a vote, and they are here to ask whether the head of the royal house would come home and take the throne.',
    choices: [
      { label: 'Accept', outcomes: [any('You go home to crowds you never expected to see again. The flag goes back up over the palace.', 'good', restore(), st('mood', 20), ms('Restored to the throne.'))] },
      { label: 'Accept, as a monarch with no power to govern', outcomes: [any('You will reign, you tell them, and never rule. It is written into the new constitution before you set foot in the country.', 'good', restore(), support(10), st('mood', 16), hid('karma', 8), ms('Restored to the throne.'))] },
      { label: 'Decline', outcomes: [any('You thank them, and say that the country did not want a crown and should not take one back out of disappointment. They leave. You are not sure you were right.', 'neutral', hid('karma', 5), st('mood', -3))] },
    ],
  },
  {
    id: 'exile_old_country', category: 'royalty', ageRange: [16, 120], cooldown: 12, requires: [need('flags.exile', '!=', false), need('flags.formerRoyal', '!=', false)],
    text: 'A journalist from the old country finds you in a café, in exile. She is not unkind. She asks whether you miss it, and whether you think you will ever go back.',
    choices: [
      { label: 'Say you miss the people, not the palace', outcomes: [any('It is printed at home under a photograph of you, older, in an ordinary coat. A great many people cut it out.', 'good', support(5), st('mood', 3))] },
      { label: 'Say the country made its choice', outcomes: [any('"And I respect it," you add, and mean it more than you expected to.', 'neutral', hid('karma', 3))] },
      { label: 'Say they will ask you back, in time', outcomes: [any('It reads as arrogance at home, and as hope in a few quiet places.', 'neutral', support(-2), hid('willpower', 2))] },
      { label: 'Get up and leave', outcomes: [any('She writes about the coffee you left behind, still warm.', 'neutral', st('mood', -4))] },
    ],
  },
  {
    id: 'exile_selling_the_jewels', category: 'royalty', ageRange: [18, 120], once: true, requires: [need('flags.formerRoyal', '!=', false), need('cashBase', '<=', 30000)],
    text: 'There is one thing left that came out of the old country with you: a brooch your great-grandmother wore at her coronation. A dealer has made an offer for it.',
    choices: [
      { label: 'Sell it', outcomes: [any('He counts the money out on the table. It will keep you for some years. You do not look back at the shop window.', 'neutral', cash(240000), st('mood', -8))] },
      { label: 'Keep it, and find work', outcomes: [any('You put it back in its box. On Monday you go to an agency and fill in a form that asks for your previous occupation.', 'good', hid('willpower', 6), st('mood', 3))] },
      { label: 'Give it to a museum at home', outcomes: [any('It goes on display in the old capital, with your name on the card. Queues form.', 'good', support(6), hid('karma', 8), st('mood', 5))] },
    ],
  },
];

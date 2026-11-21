// Scenes about politics: the first taste of it at school, being a voter,
// and holding office. The scenes whose ids start with pol_ and are marked
// queuedOnly are sent by engine/politics.js (end of term, removal, uprising).
// In office, nearly every choice moves approval: what the voters make of you.
import { st, hid, cash, flag, count, ms, ok, bad, any, chk, need, heat, death, approval, reelect, ousted, resignOffice, govt, scandal, leader, kin, abroad } from './helpers.js';

const office = need('inOffice', '==', true);
const tier = (n) => need('officeTier', '>=', n);
const voter = [need('democracy', '==', true), need('inOffice', '==', false)];
const has = (amount) => need('cashBase', '>=', amount);

/** @type {import('../../types.js').GameEvent[]} */
export default [
  // ---------- School ----------
  {
    id: 'class_president_race', category: 'politics', ageRange: [12, 17], once: true, requires: [need('education.enrolled', '==', true)],
    text: 'Your school is electing a class president. Nominations close on Friday, and there is a box of blank posters in the art room.',
    choices: [
      { label: 'Run, and promise longer lunch breaks', check: chk(0.45, { 'stats.charm': 0.7 }), outcomes: [
        ok('You win by a landslide. The lunch break stays exactly as long as it was, and you learn something about promises.', count('polExp', 4), flag('classPresident'), st('charm', 2), st('mood', 8), ms('Elected class president.')),
        bad('You lose to someone who promised a vending machine. There is no vending machine either.', count('polExp', 1), st('mood', -4)),
      ] },
      { label: 'Run, and say only what you can actually do', check: chk(0.3, { 'stats.intellect': 0.4, 'hidden.karma': 0.4 }), outcomes: [
        ok('A list of three small things, all of them done by Christmas. People are surprised into voting for you.', count('polExp', 5), flag('classPresident'), hid('karma', 3), st('mood', 8), ms('Elected class president.')),
        bad('Honest, sensible, and beaten two to one. The teacher who counts the votes tells you not to change.', count('polExp', 2), hid('willpower', 2), st('mood', -3)),
      ] },
      { label: 'Run a friend\'s campaign instead', outcomes: [any('You make the posters, write the speech and count the promises. Your friend wins, and knows who to thank.', 'good', count('polExp', 2), st('intellect', 1), st('mood', 3))] },
      { label: 'Stay out of it', outcomes: [any('You vote for whoever has the best poster, like everyone else.', 'neutral')] },
    ],
  },
  {
    id: 'school_petition', category: 'politics', ageRange: [13, 17], once: true, requires: [need('education.enrolled', '==', true)],
    text: 'The school has banned phones at lunch. Half your year is furious, and somebody says there ought to be a petition.',
    choices: [
      { label: 'Start one, and take it to the principal', check: chk(0.5, { 'stats.charm': 0.4, 'hidden.willpower': 0.4 }), outcomes: [
        ok('Four hundred signatures. The rule is changed to Fridays only, and you have discovered that this sort of thing can work.', count('polExp', 2), hid('willpower', 3), st('mood', 6)),
        bad('The principal thanks you for your interest in school policy and changes nothing.', count('polExp', 1), st('mood', -2)),
      ] },
      { label: 'Sign it', outcomes: [any('Your name is on page six.', 'neutral')] },
      { label: 'Say the rule is fair enough', outcomes: [any('It is not a popular view, and you hold it anyway.', 'neutral', hid('willpower', 2), st('mood', -2))] },
    ],
  },

  // ---------- Being a voter ----------
  {
    id: 'polling_day', category: 'politics', ageRange: [18, 100], cooldown: 3, requires: [...voter, need('electionYear', '==', true)],
    text: 'It is Election Day. There is a line outside the school hall, and a dog tied to the railings.',
    choices: [
      { label: 'Read up on everyone, then vote', outcomes: [any('You make a cross in a box with a pencil on a string, and feel briefly like part of something.', 'good', st('mood', 3), st('intellect', 1))] },
      { label: 'Vote for the funniest name on the paper', outcomes: [any('It is a matter of record that your candidate got nineteen votes, and that one of them was yours.', 'neutral', st('mood', 4))] },
      { label: 'Stay at home', outcomes: [any('Whoever wins, you will be able to say you did not vote for them.', 'neutral', hid('karma', -1))] },
    ],
  },
  {
    id: 'canvasser_at_the_door', category: 'politics', ageRange: [18, 90], cooldown: 12, requires: voter,
    text: 'A candidate for the council is on your doorstep in the rain, with a rosette and a clipboard, asking what matters to you.',
    choices: [
      { label: 'Tell them, at length', outcomes: [any('You talk about the buses for twenty minutes. They write it all down, and one bus route does change.', 'good', st('mood', 3))] },
      { label: 'Offer to help with the campaign', outcomes: [any('You spend three weekends pushing leaflets through letterboxes, and learn how elections are really won: one street at a time.', 'good', count('polExp', 2), st('health', 1), st('charm', 1))] },
      { label: 'Hide behind the sofa until they go', outcomes: [any('They push a leaflet through the door. It has their face on it, looking straight at the sofa.', 'neutral')] },
    ],
  },
  {
    id: 'party_card', category: 'politics', ageRange: [18, 40], once: true, requires: [need('partyState', '==', true)],
    text: 'Your supervisor suggests, in the tone of someone who is not really suggesting, that it is time you applied to join the party.',
    choices: [
      { label: 'Apply', outcomes: [any('Two years of meetings, study sessions and a sponsor who vouches for you. The little red card opens doors that were never marked as doors.', 'good', count('polExp', 6), hid('discipline', 4), flag('partyMember'))] },
      { label: 'Say you are not ready', outcomes: [any('He nods and writes something down. Your promotions come a little slower after that.', 'neutral', st('mood', -2))] },
    ],
  },

  // ---------- In office ----------
  {
    id: 'pol_lobbyist', category: 'politics', ageRange: [18, 110], cooldown: 5, requires: [office],
    text: 'A developer wants planning rules relaxed, and has brought an envelope to help you think about it: {$40000}.',
    choices: [
      { label: 'Take it', check: chk(0.6, { 'living.graft': 0.5 }), outcomes: [
        ok('The rules are relaxed. The envelope goes in a drawer under your socks.', cash(40000), hid('karma', -10), count('crimes')),
        bad('He was wearing a wire. So, it turns out, were two of your staff.', approval(-25), heat(40), hid('karma', -10), st('mood', -12)),
      ] },
      { label: 'Refuse, and report him', outcomes: [any('The story runs for a week, with a photograph of you looking stern. Other envelopes stop arriving.', 'good', approval(8), hid('karma', 6))] },
      { label: 'Refuse, and say nothing', outcomes: [any('He shrugs and takes it to someone else.', 'neutral', hid('karma', 2))] },
    ],
  },
  {
    id: 'pol_heckler', category: 'politics', ageRange: [18, 110], cooldown: 6, requires: [office],
    text: 'Halfway through a speech, a man at the back stands up and shouts that you have not done one thing you promised.',
    choices: [
      { label: 'Invite him up to say it properly', check: chk(0.5, { 'stats.charm': 0.5, 'stats.intellect': 0.3 }), outcomes: [
        ok('He has a point about the bridge, and you say so. The clip of you shaking his hand is watched two million times.', approval(9), st('mood', 4)),
        bad('He has a list. It is a long list, and he reads all of it.', approval(-7), st('mood', -5)),
      ] },
      { label: 'Carry on as if he were not there', outcomes: [any('You finish the speech. Nobody remembers a word of it, only him.', 'neutral', approval(-2))] },
      { label: 'Have him thrown out', outcomes: [any('Two stewards carry him out by the arms. It looks exactly as bad as it sounds.', 'bad', approval(-8))] },
    ],
  },
  {
    id: 'pol_old_photo', category: 'politics', ageRange: [21, 110], once: true, requires: [office],
    text: 'A newspaper has found a photograph of you at nineteen, at a party, wearing a traffic cone and not much else.',
    choices: [
      { label: 'Laugh, and admit it', check: chk(0.65, { 'stats.charm': 0.5 }), outcomes: [
        ok('"It was a very good party." People like you more for it, and somebody sends you a cone.', approval(6), st('mood', 5)),
        bad('The joke falls flat with exactly the voters you needed.', approval(-5)),
      ] },
      { label: 'Say it is not you', outcomes: [
        { on: 'always', weight: 0.4, tone: 'neutral', text: 'It is a blurry photograph. The doubt is enough.', effects: [hid('karma', -3)] },
        { on: 'always', weight: 0.6, tone: 'bad', text: 'Eleven people from that party remember it very clearly, and now it is a story about lying.', effects: [approval(-14), hid('karma', -4), st('mood', -6)] },
      ] },
      { label: 'Threaten to sue', requires: [has(20000)], outcomes: [any('The newspaper prints the photograph again, larger, next to your lawyer\'s letter.', 'bad', cash(-20000), approval(-9))] },
    ],
  },
  {
    id: 'pol_flood', category: 'politics', ageRange: [21, 110], cooldown: 8, requires: [office, tier(2)],
    text: 'A river has burst its banks and two thousand homes are under water. You are on vacation, three hours away by air.',
    choices: [
      { label: 'Fly back tonight and stay until it is over', outcomes: [any('You sleep in a sports hall for a week and learn the names of the people handing out blankets. It is the best thing you do in office.', 'good', approval(12), hid('karma', 5), st('health', -2))] },
      { label: 'Fly back for a photograph in rubber boots', check: chk(0.45, { 'stats.charm': 0.4 }), outcomes: [
        ok('The boots are convincing. The photograph is on every front page.', approval(5)),
        bad('The boots are brand new, and somebody has left the price on.', approval(-10), st('mood', -4)),
      ] },
      { label: 'Stay where you are and send your deputy', outcomes: [any('There is a picture of you by the pool next to a picture of a family on a roof. No caption is needed.', 'bad', approval(-18), hid('karma', -5))] },
    ],
  },
  {
    id: 'pol_strike', category: 'politics', ageRange: [21, 110], cooldown: 7, requires: [office, tier(2)],
    text: 'The bin collectors have been on strike for three weeks. The garbage is piled as high as the bus shelters, and the rats are not afraid of anyone.',
    choices: [
      { label: 'Give them what they are asking for', outcomes: [any('The streets are clean by Monday. The money will have to come from somewhere, and everyone else has noticed that striking works.', 'neutral', approval(6))] },
      { label: 'Sit down with them yourself', check: chk(0.5, { 'stats.charm': 0.4, 'stats.intellect': 0.4 }), outcomes: [
        ok('Fourteen hours, a great deal of tea, and a deal both sides can call a win.', approval(11), st('mood', 5)),
        bad('The talks collapse at three in the morning. A fourth week begins.', approval(-8), st('mood', -5)),
      ] },
      { label: 'Refuse to be held to ransom', outcomes: [
        { on: 'always', weight: 0.4, tone: 'good', text: 'They go back to work in the sixth week, with nothing. Some voters admire the nerve.', effects: [approval(5), hid('karma', -3)] },
        { on: 'always', weight: 0.6, tone: 'bad', text: 'A child is bitten by a rat, and the photograph has your name in the headline.', effects: [approval(-15)] },
      ] },
    ],
  },
  {
    id: 'pol_expenses', category: 'politics', ageRange: [21, 110], cooldown: 9, requires: [office],
    text: 'A journalist has asked for every receipt you have claimed on expenses. Most are fine. One is for a very large television.',
    choices: [
      { label: 'Publish everything and pay it back', outcomes: [any('A bad day, a short apology, and it is over. You watch the news about yourself on the television.', 'neutral', cash(-3000), approval(-3), hid('karma', 3))] },
      { label: 'Say it was for constituency work', check: chk(0.35, { 'stats.charm': 0.4 }), outcomes: [
        ok('Nobody can prove what you watch on it.', hid('karma', -3)),
        bad('"Constituency television" becomes a national joke with your face attached.', approval(-12), st('mood', -5)),
      ] },
      { label: 'Lose the receipts', outcomes: [any('The receipts cannot be found. The shop, however, keeps very good records.', 'bad', approval(-10), heat(10), hid('karma', -5))] },
    ],
  },
  {
    id: 'pol_hot_mic', category: 'politics', ageRange: [21, 110], cooldown: 10, requires: [office],
    text: 'After a visit to a market, you get back in the car and say what you really thought of a woman you met there. Your microphone is still on.',
    choices: [
      { label: 'Go back and apologize to her face', check: chk(0.6, { 'stats.charm': 0.4, 'hidden.karma': 0.2 }), outcomes: [
        ok('She makes you a cup of tea and tells you exactly what she thinks of you. You are both rather pleased with how it goes.', approval(3), hid('karma', 3)),
        bad('She does not open the door. Forty cameras record her not opening it.', approval(-9)),
      ] },
      { label: 'Say it was taken out of context', outcomes: [any('The context is played in full on every bulletin for three days.', 'bad', approval(-11), st('mood', -4))] },
      { label: 'Blame your staff for the microphone', outcomes: [any('A junior press officer is sacked. It makes things worse in every possible way.', 'bad', approval(-13), hid('karma', -6))] },
    ],
  },
  {
    id: 'pol_summit', category: 'politics', ageRange: [30, 110], cooldown: 6, requires: [office, tier(5)],
    text: 'At a summit, the leader of a much larger country grips your hand for the cameras and does not let go. He is trying to pull you off balance.',
    choices: [
      { label: 'Grip back, and smile', check: chk(0.5, { 'stats.health': 0.3, 'hidden.willpower': 0.4 }), outcomes: [
        ok('Nineteen seconds. His knuckles go white first. At home it is replayed in slow motion, with music.', approval(10), st('mood', 6)),
        bad('You stumble. It is a small stumble, and it is replayed in slow motion, with music.', approval(-6), st('mood', -4)),
      ] },
      { label: 'Let him win, and get the trade deal', outcomes: [any('You look weak for a day and bring home ten thousand jobs.', 'good', approval(5), hid('karma', 3))] },
      { label: 'Say something sharp into his ear', outcomes: [
        { on: 'always', weight: 0.5, tone: 'good', text: 'He laughs, lets go, and invites you to dinner. Nobody ever learns what you said.', effects: [approval(6), st('charm', 1)] },
        { on: 'always', weight: 0.5, tone: 'bad', text: 'A lip-reader works out what you said. The ambassador is summoned by lunchtime.', effects: [approval(-9)] },
      ] },
    ],
  },
  {
    id: 'pol_border', category: 'politics', ageRange: [30, 110], cooldown: 12, requires: [office, tier(5)],
    text: 'Three in the morning. Shots have been fired across the border, two of your soldiers are dead, and the generals are waiting on the line for an answer.',
    choices: [
      { label: 'Pick up the telephone to the other side', check: chk(0.55, { 'stats.intellect': 0.4, 'stats.charm': 0.3 }), outcomes: [
        ok('A mistake by a frightened conscript, says the voice at the other end, and you choose to believe it. Nobody else dies.', approval(8), hid('karma', 8)),
        bad('They deny everything and move tanks up to the line. You have looked weak and gained nothing.', approval(-9), st('mood', -6)),
      ] },
      { label: 'Answer in kind, and no more', outcomes: [any('One battery is destroyed. Both sides say they have made their point. It holds, for now.', 'neutral', approval(4), hid('karma', -4))] },
      { label: 'Send in the army', outcomes: [
        { on: 'always', weight: 0.3, tone: 'good', text: 'It is over in nine days. There are parades. You try not to think about the lists of names.', effects: [approval(16), hid('karma', -15), st('mood', -4)] },
        { on: 'always', weight: 0.7, tone: 'bad', text: 'It is not over in nine days, or ninety. The lists of names grow longer every week.', effects: [approval(-22), hid('karma', -20), st('mood', -12)] },
      ] },
    ],
  },
  {
    id: 'pol_gunman', category: 'politics', ageRange: [30, 110], cooldown: 20, weight: 0.3, requires: [office, tier(5)],
    text: 'You are shaking hands along a barrier when a man in a gray coat reaches inside it, and what he brings out is not a camera.',
    choices: [
      { label: 'Throw yourself to the ground', outcomes: [
        { on: 'always', weight: 0.75, tone: 'good', text: 'Two shots go over you. Your bodyguards are on him before the third. You finish the visit with gravel in your hands.', effects: [approval(12), st('mood', -8)] },
        { on: 'always', weight: 0.2, tone: 'bad', text: 'You are hit in the shoulder. You wave from the stretcher, and the country holds its breath for a week.', effects: [approval(18), st('health', -35), st('mood', -10)] },
        { on: 'always', weight: 0.05, tone: 'bad', text: 'There is no time. There is a noise like a door slamming.', effects: [death('an assassin\'s bullet')] },
      ] },
      { label: 'Push the child beside you out of the way', outcomes: [
        { on: 'always', weight: 0.7, tone: 'good', text: 'The shot hits the wall where she was standing. Her mother will vote for you for the rest of her life, and so will everybody else\'s.', effects: [approval(22), hid('karma', 15), count('livesSaved')] },
        { on: 'always', weight: 0.22, tone: 'bad', text: 'She is safe. You are not: the bullet takes you in the side, and you spend two months in the hospital.', effects: [approval(25), hid('karma', 15), st('health', -45), count('livesSaved')] },
        { on: 'always', weight: 0.08, tone: 'bad', text: 'She is safe. They name a school after you.', effects: [hid('karma', 20), count('livesSaved'), death('an assassin\'s bullet, shielding a child')] },
      ] },
    ],
  },

  // ---------- Sent by the engine ----------
  {
    id: 'pol_term_ends', category: 'politics', ageRange: [18, 120], queuedOnly: true, cooldown: 1,
    text: 'Your term is nearly over. The posters will have to go up soon, if they are going up at all.',
    choices: [
      { label: 'Stand again', outcomes: [any('You put your record in front of the people who decide, and wait.', 'neutral', reelect())] },
      { label: 'Step down while they still like you', outcomes: [any('You hand over the keys, and somebody else gets the blame from now on.', 'neutral', resignOffice(), st('mood', 4))] },
    ],
  },
  {
    id: 'dip_crisis', category: 'politics', ageRange: [18, 120], queuedOnly: true,
    text: '{what} {leader}, the {title} of {country}, has gone on television to blame you by name. Your foreign ministry wants to know what you intend to do.',
    choices: [
      { label: 'Negotiate', outcomes: [any('You ask for a meeting on neutral ground.', 'neutral', abroad('negotiate'))] },
      { label: 'Impose sanctions', outcomes: [any('You sign the order before lunch.', 'neutral', abroad('sanction'))] },
      { label: 'Make a show of force', outcomes: [any('You ask the admirals what can be at sea by Friday.', 'neutral', abroad('threaten'))] },
      { label: 'Give them what they want', outcomes: [any('You decide this is not the hill.', 'neutral', abroad('concede'))] },
    ],
  },
  {
    id: 'dip_trade_offer', category: 'politics', ageRange: [18, 120], queuedOnly: true,
    text: '{leader}, the {title} of {country}, proposes a trade agreement. The terms on the table are decent, though your own farmers and factories would feel the competition.',
    choices: [
      { label: 'Sign it as offered', outcomes: [any('You tell your officials to prepare the pens.', 'neutral', abroad('signTrade'))] },
      { label: 'Hold out for better terms', outcomes: [any('You send the draft back with a great deal of red ink on it.', 'neutral', abroad('haggle'))] },
      { label: 'Decline', outcomes: [any('You say the time is not right.', 'neutral', abroad('declineTrade'))] },
    ],
  },
  {
    id: 'pm_audience', category: 'politics', ageRange: [18, 120], queuedOnly: true,
    text: 'Every week you are received by {monarch}: an hour alone, no notes, no officials. Nothing said in that room is ever repeated. This week you have a great deal on your mind.',
    choices: [
      { label: 'Ask for advice', outcomes: [any('You put down your cup.', 'neutral', govt('audienceAsk'))] },
      { label: 'Keep to the formalities', outcomes: [any('You keep your troubles to yourself.', 'neutral', govt('audienceFormal'))] },
      { label: 'Let the newspapers know what was said', outcomes: [any('You have a quiet word with a friendly editor on the way home.', 'neutral', govt('audienceLeak'), hid('karma', -6))] },
    ],
  },
  {
    id: 'kin_wants_politics', category: 'family', ageRange: [30, 120], queuedOnly: true,
    text: 'Your {rel} {kin} has something to tell you, and takes most of dinner to get to it: {kin} wants to go into politics.',
    choices: [
      { label: 'Back them, and write a check ({cost})', outcomes: [any('You say you could not be prouder.', 'good', kin('back'))] },
      { label: 'Say it is their life', outcomes: [any('You say you will be there either way.', 'neutral', kin('neutral'))] },
      { label: 'Tell them what it really costs', outcomes: [any('You tell the truth about the hours, the letters, and what it does to a family.', 'neutral', kin('discourage'))] },
    ],
  },
  {
    id: 'kin_campaign', category: 'family', ageRange: [30, 120], queuedOnly: true,
    text: 'Your {rel} {kin} is standing for {title}, and Election Day is close. {kin} has not asked for your help, which is how you know it is wanted.',
    choices: [
      { label: 'Campaign at their side', outcomes: [any('You clear your diary.', 'neutral', kin('campaign'))] },
      { label: 'Pay for the leaflets ({cost})', outcomes: [any('You reach for your checkbook.', 'neutral', kin('money'))] },
      { label: 'Stay out of it', outcomes: [any('You keep your distance.', 'neutral', kin('stayOut'))] },
    ],
  },
  {
    id: 'kin_scandal', category: 'family', ageRange: [30, 120], queuedOnly: true,
    text: 'Your {rel} {kin}, the {title}, is in the newspapers for the wrong reasons, and every report mentions whose {rel} {kin} is. Reporters are asking what you have to say.',
    choices: [
      { label: 'Stand beside them', outcomes: [any('Family is family.', 'neutral', kin('standBy'))] },
      { label: 'Say it is a matter for them alone', outcomes: [any('You choose your words with great care.', 'neutral', kin('distance'))] },
    ],
  },
  {
    id: 'spouse_public', category: 'family', ageRange: [25, 120], queuedOnly: true,
    text: 'A magazine wants a long interview with your {rel} {kin}: the home, the marriage, what you are really like. Your advisers think it could be wonderful, or a disaster.',
    choices: [
      { label: 'Let them speak freely', outcomes: [any('You say you trust {kin} completely, and hope it is true.', 'neutral', kin('speak'))] },
      { label: 'Keep them out of the papers', outcomes: [any('You have the request declined.', 'neutral', kin('hide'))] },
    ],
  },
  {
    id: 'scandal_rumor', category: 'politics', ageRange: [18, 120], queuedOnly: true,
    text: 'A reporter has been asking questions about {what}. She has not got the whole story, but she has enough of it to telephone your office and ask for a comment by six.',
    choices: [
      { label: 'Tell it yourself, before she can', outcomes: [any('You ask for ten minutes to think, and use them.', 'neutral', scandal('confess'))] },
      { label: 'Deny everything', outcomes: [any('"There is no truth in it whatever."', 'neutral', scandal('deny'))] },
      { label: 'Lean on her editor ({hush})', requires: [has(80000)], outcomes: [any('You make a call to a man who owes you a favor, and offer him another.', 'neutral', scandal('kill'))] },
    ],
  },
  {
    id: 'scandal_story', category: 'politics', ageRange: [18, 120], queuedOnly: true,
    text: 'It is on every front page: {what}. Your telephone has not stopped, your colleagues are suddenly hard to reach, and there are cameras at the end of the road.',
    choices: [
      { label: 'Apologize', outcomes: [any('You face the cameras.', 'neutral', scandal('apologize'))] },
      { label: 'Let an aide take the blame', outcomes: [any('You have a quiet word with someone junior, loyal, and expendable.', 'neutral', scandal('aide'))] },
      { label: 'Call an independent inquiry', outcomes: [any('"I have nothing to hide, and I want that established."', 'neutral', scandal('inquiry'))] },
      { label: 'Resign', requires: [need('inOffice', '==', true)], outcomes: [any('A short statement on the steps, and a car with the engine running.', 'neutral', resignOffice(), st('mood', -6))] },
    ],
  },
  {
    id: 'scandal_verdict', category: 'politics', ageRange: [18, 120], queuedOnly: true,
    text: 'The inquiry into {what} reports today. An advance copy is on your desk, face down.',
    choices: [
      { label: 'Turn it over', outcomes: [any('You read the last page first.', 'neutral', scandal('verdict'))] },
    ],
  },
  {
    id: 'pol_leadership_open', category: 'politics', ageRange: [18, 120], queuedOnly: true,
    text: 'The leadership of {party} has changed hands in a hurry, and {leader} has it for now. Nobody has had time to get used to the idea. Colleagues are asking, quietly, whether you would stand.',
    choices: [
      { label: 'Put your name forward', outcomes: [any('You let it be known that you are available.', 'neutral', leader('stand'))] },
      { label: 'Stay loyal, and wait', outcomes: [any('You say the party needs unity, and are thanked for it.', 'neutral', st('mood', 1))] },
    ],
  },
  {
    id: 'pol_leader_defeated', category: 'politics', ageRange: [18, 120], queuedOnly: true,
    text: 'The election is lost, and the morning after is very quiet. In the hallways of {party} they are asking whether the leader who lost can be the leader who wins next time.',
    choices: [
      { label: 'Fight on as leader', outcomes: [any('You call a meeting of the party.', 'neutral', leader('fight'))] },
      { label: 'Step down', outcomes: [any('You say that the party needs a fresh start, and mean most of it.', 'neutral', leader('resign'), st('mood', -4))] },
    ],
  },
  {
    id: 'pol_minister_scandal', category: 'politics', ageRange: [18, 120], queuedOnly: true,
    text: 'The morning papers have it on the front page: {minister}, your {post}, {what}. The opposition wants a head, and your own side wants to know what you will do.',
    choices: [
      { label: 'Stand by your minister', outcomes: [any('You tell the cameras that you have full confidence in your colleague.', 'neutral', govt('standBy'))] },
      { label: 'Dismiss them today', outcomes: [any('You make the telephone call yourself.', 'neutral', govt('sack'))] },
    ],
  },
  {
    id: 'pol_bill_on_desk', category: 'politics', ageRange: [18, 120], queuedOnly: true,
    text: 'The legislature is not yours, and it has stopped waiting for you. Led by {party}, it has passed a bill to {bill}, by {votes}. It is on your desk for signature.',
    choices: [
      { label: 'Sign it', outcomes: [any('You uncap the pen.', 'neutral', govt('sign'))] },
      { label: 'Veto it', outcomes: [any('You send it back with a short, cold message.', 'neutral', govt('veto'))] },
    ],
  },
  {
    id: 'pol_removal_vote', category: 'politics', ageRange: [18, 120], queuedOnly: true, cooldown: 1,
    text: 'You have become so unpopular that there is a move to throw you out before your term is up. The vote is on Thursday.',
    choices: [
      { label: 'Fight it in public', check: chk(0.3, { 'stats.charm': 0.5, 'stats.intellect': 0.3, 'hidden.willpower': 0.3 }), outcomes: [
        ok('The speech of your life. You survive by a handful of votes, and wake up the next morning with a second chance.', approval(14), st('mood', 6)),
        bad('It is not close. You are out by the end of the day.', ousted('thrown out of office'), st('mood', -8)),
      ] },
      { label: 'Buy the votes you need', requires: [has(150000)], check: chk(0.5, { 'living.graft': 0.6 }), outcomes: [
        ok('Seven people change their minds overnight, each of them a little richer.', cash(-150000), approval(6), hid('karma', -12), count('crimes')),
        bad('One of the seven takes the money to the police. You are out, and in a great deal of trouble.', cash(-150000), ousted('thrown out of office'), heat(45), hid('karma', -12)),
      ] },
      { label: 'Resign before they can', outcomes: [any('A short statement on the steps, and a car with the engine running.', 'neutral', resignOffice(), st('mood', -5))] },
    ],
  },
  {
    id: 'pol_uprising', category: 'politics', ageRange: [18, 120], queuedOnly: true, cooldown: 1,
    text: 'The square outside the palace is full, and has been for six nights. This morning the soldiers at the gates took off their helmets and joined the crowd.',
    choices: [
      { label: 'Leave by helicopter, with what you can carry', outcomes: [
        { on: 'always', weight: 0.7, tone: 'bad', text: 'You watch the capital get smaller through the window, with four suitcases of the country\'s money at your feet. You can never go back.', effects: [cash(2000000), ousted('overthrown'), heat(60), hid('karma', -15), st('mood', -15)] },
        { on: 'always', weight: 0.3, tone: 'bad', text: 'The helicopter does not come. They find you in the kitchens, dressed as a cook.', effects: [ousted('overthrown'), heat(100), st('mood', -25)] },
      ] },
      { label: 'Order the loyal regiments to clear the square', check: chk(0.3, { 'hidden.willpower': 0.4 }), outcomes: [
        ok('It is done by dawn. Nobody will ever tell you how many. You keep your office, and stop sleeping.', approval(-10), hid('karma', -40), st('mood', -20)),
        { on: 'fail', weight: 0.7, tone: 'bad', text: 'There are no loyal regiments. You are arrested by your own guard.', effects: [ousted('overthrown'), heat(100), hid('karma', -25)] },
        { on: 'fail', weight: 0.3, tone: 'bad', text: 'There are no loyal regiments. The crowd reaches you before the guard does.', effects: [death('an uprising')] },
      ] },
      { label: 'Go out on the balcony and give it all back', outcomes: [any('You announce elections, and that you will not stand in them. The square is silent, and then it is not. Some of them even cheer.', 'good', resignOffice(), hid('karma', 15), st('mood', 5))] },
    ],
  },
];

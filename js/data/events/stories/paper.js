// STORYLINE: the school newspaper.
//
// How it is reached: join the School newspaper (which introduces the adviser,
// 'tag:adviser') and have a teacher mentor ('tag:teacher', see mentors.js).
// At 16–17 you are handed a damaging story about the teacher who backed you.
//
// Flags: paperRoute 'published' | 'fair' | 'killed' | 'buried'
//        stringer (summer on the city paper), portfolio (journalism degree),
//        newsroomOffer.
import { st, hid, cash, rel, flag, gpa, ms, addNpc, ok, bad, any, chk, need, mem } from '../helpers.js';

const onPaper = need('education.clubs', 'has', 'paper');

/** @type {import('../../../types.js').GameEvent[]} */
export default [
  {
    id: 'paper_first_story', category: 'school paper', ageRange: [12, 16], once: true, weight: 5,
    requires: [onPaper], cast: { adviser: 'tag:adviser' },
    text: '{adviser} needs four hundred words by Friday. You can look into why cafeteria prices went up twice this semester, or write up the bake sale.',
    choices: [
      { label: 'Look into the cafeteria', check: chk(0.5, { 'stats.intellect': 0.7, 'hidden.discipline': 0.3 }), outcomes: [
        ok('The supplier changed and nobody told the parents. Front page. The prices come back down.', st('intellect', 3), st('mood', 6), rel('adviser', 8),
          mem('adviser', 'canteenScoop', 'Your first story got cafeteria prices cut.')),
        bad('You get a figure wrong and the paper prints a correction. {adviser} sits you down and shows you how to check a number three ways.', st('intellect', 3), st('mood', -3), rel('adviser', 3),
          mem('adviser', 'correction', 'Your first story needed a correction, and you learned to check everything after.')),
      ] },
      { label: 'Write up the bake sale', outcomes: [any('Four hundred accurate words about flapjacks.', 'neutral', rel('adviser', 2))] },
    ],
  },
  {
    id: 'paper_teacher_story', category: 'school paper', ageRange: [16, 17], once: true, priority: true,
    requires: [onPaper, need('education.stage', '==', 'high')], cast: { adviser: 'tag:adviser', teacher: 'tag:teacher' },
    text: 'A parent hands you photocopies. They show that {teacher}, the teacher who has backed you since you were small, changed three exam marks so the team captain could keep playing. {adviser} reads them twice and says: "It is true, and it is yours. Your call."',
    choices: [
      { label: 'Publish it', outcomes: [any(
        'It runs on the front page under your name. {teacher} is suspended by lunchtime and does not look at you again. Half the school thinks you are brave. The other half has a different word.',
        'neutral', flag('paperRoute', 'published'), st('intellect', 2), st('charm', -2), rel('teacher', -35), rel('adviser', 10),
        mem('teacher', 'exposed', 'You published the story about the exam marks without warning them.'),
        mem('adviser', 'publishedHard', 'You published the hardest story the paper ever ran.'),
        ms('Published an investigation in the school paper.'))] },
      { label: 'Take it to {teacher} first', check: chk(0.45, { 'cast.teacher.relationship': 0.9 }), outcomes: [
        ok('{teacher} goes gray and asks for one day. The next morning they report themselves, and give you a statement. The story runs with their own words in it.',
          flag('paperRoute', 'fair'), hid('karma', 5), st('intellect', 2), rel('teacher', -5), rel('adviser', 8),
          mem('teacher', 'gaveChance', 'You came to them first and let them answer before you printed.'),
          mem('adviser', 'fairStory', 'You ran a hard story and gave its subject a fair hearing.'),
          ms('Published an investigation in the school paper.')),
        bad('{teacher} denies everything and reaches the head\'s office before you do. By the afternoon the paper has been told to drop it.',
          flag('paperRoute', 'killed'), st('mood', -6), rel('teacher', -20), rel('adviser', -3),
          mem('teacher', 'confronted', 'You confronted them with the exam marks.')),
      ] },
      { label: 'Put the photocopies in a drawer', outcomes: [any(
        'Nobody ever knows except you and {adviser}, who says nothing and gives the next big story to someone else.',
        'neutral', flag('paperRoute', 'buried'), hid('karma', -5), st('mood', -3), rel('adviser', -8), rel('teacher', 2),
        mem('adviser', 'spiked', 'You sat on the biggest story the paper ever had.'))] },
    ],
  },
  {
    id: 'adviser_clip', category: 'after graduation', ageRange: [18, 19], once: true, priority: true,
    requires: [need('flags.paperRoute', 'in', ['published', 'fair'])], cast: { adviser: 'tag:adviser' },
    text: '{adviser} has sent your exam-marks story to the editor of the {city} paper. "They want a summer stringer. They read it and asked who wrote it."',
    choices: [
      { label: 'Take the summer job', outcomes: [any(
        'Council meetings, court lists, one flooded underpass. {editor}, the editor, cuts your copy in half every day until, in August, they stop needing to. You are paid {$2400}.',
        'good', flag('stringer'), cash(2400), st('intellect', 3), hid('discipline', 4),
        addNpc('mentor', 'editor', { tag: 'editor', title: 'Newspaper editor', ageOffset: 26, relationship: 55,
          memory: ['stringer', 'You were the school leaver who filed clean copy all summer.'] }),
        ms('Spent a summer as a stringer on the city paper.'))] },
      { label: 'Keep the summer for yourself', outcomes: [any('{adviser} says the cutting will still be in their drawer.', 'neutral')] },
    ],
  },
  {
    id: 'journalism_portfolio', category: 'university', ageRange: [19, 26], once: true, priority: true,
    requires: [need('education.enrolled', '==', true), need('education.majorId', '==', 'journalism'), need('education.stage', '==', 'university')],
    text: 'Your course wants one portfolio piece that was actually published somewhere, by the end of term.',
    choices: [
      { label: 'Use your school exam-marks story', requires: [need('flags.paperRoute', 'in', ['published', 'fair'])], outcomes: [any(
        'Your tutor reads it, then reads it again. "You wrote this at seventeen?" It goes in the front of your portfolio.',
        'good', flag('portfolio', 'schoolStory'), gpa(0.15), st('mood', 5))] },
      { label: 'Chase the council contracts', check: chk(0.45, { 'stats.intellect': 0.6, 'hidden.discipline': 0.4 }), outcomes: [
        ok('Three months of records requests. The local paper runs it across two pages with your byline.', flag('portfolio', 'investigation'), gpa(0.2), st('intellect', 3),
          ms('Published an investigation into council contracts as a student.')),
        bad('The trail goes cold in week ten. You hand in a well-sourced account of a dead end.', flag('portfolio', 'deadEnd'), gpa(-0.05), st('intellect', 2)),
      ] },
      { label: 'Profile a local musician', check: chk(0.6, { 'stats.charm': 0.6 }), outcomes: [
        ok('They talk for four hours. A listings magazine buys it for {$150}.', flag('portfolio', 'profile'), cash(150), gpa(0.1), st('charm', 2)),
        bad('They give you twenty minutes and three quotes you have read before.', flag('portfolio', 'profile'), gpa(0)),
      ] },
    ],
  },
  {
    id: 'editor_calls', category: 'a call from the past', ageRange: [21, 28], once: true, priority: true,
    requires: [need('flags.stringer', '==', true)], cast: { editor: 'tag:editor' },
    text: '{editor} calls: "I have a spare desk and a pile of applications from strangers. You, I have already read. Do you want it?"',
    choices: [
      { label: 'Take the desk', outcomes: [any(
        'You start on Monday. Your first three months earn you {$6000} and a drawer of your own.',
        'good', flag('newsroomOffer'), cash(6000), st('mood', 10), rel('editor', 8),
        ms('Offered a newsroom desk by an editor who remembered your summer copy.'))] },
      { label: 'Ask to freelance instead', outcomes: [any('{editor} grumbles, and then commissions you twice a month.', 'good', flag('newsroomOffer'), cash(2500), rel('editor', 3))] },
      { label: 'Say your life went another way', outcomes: [any('"Shame," says {editor}. "You could write."', 'neutral', rel('editor', -3))] },
    ],
  },
];

// The game is written in American English. This checks that it stays that way, and that a save made when it used
// British spellings loads with its ids, keys and text converted, and its people's names left alone.
// Run with: node tests/spelling.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
const mem = new Map();
globalThis.localStorage = { getItem: (k) => (mem.has(k) ? mem.get(k) : null), setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) };
const { store } = await import('../js/state.js');
const { createLife } = await import('../js/engine/characterGen.js');
const { saveGame, loadGame } = await import('../js/save.js');
const { americanize } = await import('../js/engine/spelling.js');

const problems = [];
const check = (cond, msg) => { if (!cond) problems.push(msg); };

// 1. No British spellings in the game, its tests or its docs. Real place names and people's names are exempt, and so
// is the table of old spellings that converts old saves.
const EXEMPT = new Set(['js/data/spelling.js', 'js/data/names.js', 'js/data/countries.js', 'js/data/cities.js', 'js/data/localNames.js',
  'js/data/worldNew.js', 'js/data/worldVerification.js', 'js/data/lawVerification.js', 'tests/spelling.mjs']);
const BRITISH = /\b(?:colour|favour|behaviour|honour|neighbour|labour|humour|rumour|centre|theatre|licence|defence|offence|judgement|programme(?!r)|catalogue|paediatric|haemo|anaem|oestrogen|travell(?:ed|ing|er)|cancell(?:ed|ing)|counsell(?:ing|or)|modell(?:ing|ed)|labell(?:ed|ing)|organis(?:e|ed|ing|ation)|recognis(?:e|ed|es|ing)|apologis(?:e|ed|ing)|(?:practis(?:e|ed|ing)|enrol|enrols|enrolment|realised?|grey|whilst|amongst|towards|learnt|mum|maths|metre|litre|fibre|car park|payslip)(?![a-z]))/i;
const files = [];
const walk = (dir) => { for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) { if (!['node_modules', '.git'].includes(f)) walk(p); } else if (/\.(m?js|md|html|css)$/.test(f)) files.push(p); } };
for (const d of ['js', 'tests', 'docs', 'css']) walk(d);
files.push('README.md', 'index.html');
const found = [];
for (const f of files) {
  if (EXEMPT.has(f)) continue;
  const lines = readFileSync(f, 'utf8').split('\n');
  lines.forEach((l, i) => {
    const m = l.replace(/aria-labelledby|labelledby/gi, '').replace(/\bGrey(?=[A-Z]|\b(?! hair))/g, '').match(BRITISH);
    if (m && !/^[A-Z]/.test(m[0])) found.push(`${f}:${i + 1} ${m[0]}`);
  });
}
check(!found.length, `no British spellings (${found.length}: ${found.slice(0, 8).join('; ')})`);
// British words, as well as spellings: the American word in the game's text.
const VOCAB = /\b(?:dearer|fortnight|(?<!rice )pudding|solicitor|washing-up|tea towel|pram|nappy|nappies|petrol|car park|rings off|in hospital|at university|polling day|in the post|high street|head teacher|shop assistant|a flat in|rent a flat)\b/i;
const words = [];
for (const f of files) {
  if (EXEMPT.has(f) || f.startsWith('tests/') || f.startsWith('docs/')) continue;
  readFileSync(f, 'utf8').split('\n').forEach((l, i) => { if (/^\s*(\/\/|\*|\/\*)/.test(l) || /aliases:/.test(l)) return; const m = l.replace(/\/\/.*$/, '').match(VOCAB); if (m) words.push(`${f}:${i + 1} ${m[0]}`); }); // comments, and job titles people search by, are not shown
}
check(!words.length, `no British words (${words.length}: ${words.slice(0, 8).join('; ')})`);

// 2. An old save: ids, keys and text in American spelling; names as they were.
let s; do { s = createLife({ countryId: 'us' }); } while (s.player.royal);
store.state = s;
check(s.spelling === 'us', 'a new life is written in American English from the start');
delete s.spelling;
const p = s.player;
p.firstName = 'Autumn'; p.lastName = 'Grey';
p.fame = { ...(p.fame ?? {}), favour: 7, audiences: { ...(p.fame?.audiences ?? {}), theatre: 12 } };
s.journal.unshift({ text: 'Your neighbours organised a programme at the theatre centre.', tone: 'neutral', age: p.age });
p.health.trials.push({ id: 'trial_old', medicationId: 'lithium', family: 'mood_stabiliser', status: 'ended', startWk: 0 });
saveGame(s);
const back = loadGame(s.slotId);
store.state = back;
const q = back.player;
check(back.spelling === 'us', 'an old save is converted once');
check(q.fame.favor === 7 && q.fame.favour === undefined && q.fame.audiences.theater === 12, 'its keys are converted');
check(q.health.trials.some((t) => t.family === 'mood_stabilizer'), 'its ids are converted');
check(back.journal.some((j) => j.text === 'Your neighbors organized a program at the theater center.'), 'its text is converted');
check(q.firstName === 'Autumn' && q.lastName === 'Grey', 'people\'s names are left as they are');
const again = JSON.stringify(americanize(back));
check(again === JSON.stringify(back), 'converting twice changes nothing');

if (problems.length) { console.log(`PROBLEMS:\n${problems.map((x) => ` - ${x}`).join('\n')}`); process.exit(1); }
console.log('American English throughout; old saves are converted, names kept.');

// Scenes about the occasions a family keeps (engine/moments.js). These are
// queued by the engine when the life calls for them, never drawn at random.
import { st, rel, any, need, mem } from './helpers.js';

const moment = (value) => ({ type: 'moment', value });

/** @type {import('../../types.js').GameEvent[]} */
export default [
  {
    id: 'tradition_handover', category: 'family', ageRange: [18, 110], weight: 0, cast: { host: 'tag:never' }, requires: [need('age', '>=', 18)],
    text: '{host} has hosted it for as long as anyone can remember. This year, doing the dishes afterward, they say quietly that they are not sure they can manage it again.',
    choices: [
      { label: 'Offer to host it from now on', outcomes: [any('{host} looks relieved, and then a little sad, and then relieved again. Next year it is at yours.', 'good', moment('takeover'), rel('host', 6), mem('host', 'took_tradition', 'You took over the family\'s tradition when I could not.'))] },
      { label: 'Suggest someone younger takes it on', outcomes: [any('A cousin says yes before anyone else can. It will be different, and it will go on.', 'neutral', moment('cousin'), rel('host', 2))] },
      { label: 'Let it end with them', outcomes: [any('Perhaps some things should stop when the person who started them stops. It is quieter, after.', 'neutral', moment('lapse'), st('mood', -3))] },
    ],
  },
];

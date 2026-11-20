// The beauty salon: changing how the player wears what they were born with.
// Only the `style` half of an appearance ever changes here.
import { clamp, localMoney, fmtMoney, localCost } from '../util.js';
import { player, country, log } from '../state.js';
import { normalize, part } from '../avatar/catalog.js';

/** Prices in base units. A change back to "none" or "natural" is free, apart from a haircut. */
export const SALON_PRICES = { hair: 45, hairDye: 110, glasses: 180, makeup: 60, lipColor: 15, jewelry: 90, outfit: 80, outfitColor: 30 };
const LABELS = { hair: 'Haircut', hairDye: 'Color', glasses: 'New glasses', makeup: 'Make-up', lipColor: 'Lip color',
  jewelry: 'Jewelry', outfit: 'New clothes', outfitColor: 'Dyeing' };
const same = (x, y) => JSON.stringify(x ?? null) === JSON.stringify(y ?? null);
/** Children do not pay: whoever looks after them does. */
const PAYS_FROM = 16;

export const canVisitSalon = () => player().age >= 3 && !player().legal.incarceration;

/**
 * What a new look would cost.
 * @returns {{lines:{label:string, cost:number}[], total:number, free:boolean, changed:boolean}}
 */
export function salonQuote(next) {
  const p = player();
  const c = country();
  const now = normalize(p.appearance, p.id).style;
  const lines = [];
  for (const key of Object.keys(SALON_PRICES)) {
    if (same(now[key], next.style[key])) continue;
    const removing = next.style[key] == null || (Array.isArray(next.style[key]) && !next.style[key].length);
    lines.push({ label: LABELS[key], cost: removing ? 0 : localCost(SALON_PRICES[key], c) });
  }
  const free = p.age < PAYS_FROM;
  return { lines, total: free ? 0 : lines.reduce((s, l) => s + l.cost, 0), free, changed: lines.length > 0 };
}

/** One line describing the bill, for the editor. */
export function salonNote(next) {
  const q = salonQuote(next);
  if (!q.changed) return 'Nothing changed yet.';
  const what = q.lines.map((l) => l.label.toLowerCase()).join(', ');
  return q.free ? `${what.replace(/^./, (ch) => ch.toUpperCase())}. Your family pays.` : `${what.replace(/^./, (ch) => ch.toUpperCase())}: ${fmtMoney(q.total, country())}.`;
}

/** Pays for and applies a new look. What the player was born with is left untouched. */
export function applySalon(next) {
  const p = player();
  const c = country();
  const q = salonQuote(next);
  if (!canVisitSalon()) return { ok: false, text: 'The salon is not an option right now.', tone: 'neutral' };
  if (!q.changed) return { ok: false, text: 'You left the salon looking exactly as you went in.', tone: 'neutral' };
  if (p.finance.cash < q.total) return { ok: false, text: `That comes to ${fmtMoney(q.total, c)}. You do not have it.`, tone: 'neutral' };
  p.finance.cash -= q.total;
  const current = normalize(p.appearance, p.id);
  p.appearance = { v: 3, inherited: current.inherited, style: { ...current.style, ...next.style } };
  const first = p.flags.salonAge !== p.age;
  p.flags.salonAge = p.age;
  if (first) { p.stats.mood = clamp(p.stats.mood + 4); if (p.stats.charm < 80) p.stats.charm = clamp(p.stats.charm + 1); }
  const dye = q.lines.some((l) => l.label === 'Color') && next.style.hairDye ? ` Your hair is ${part('hairDye', next.style.hairDye).name.toLowerCase()} now.` : '';
  const text = `You walked out of the salon with a new look.${dye}${q.total ? ` It cost ${fmtMoney(q.total, c)}.` : ''}`;
  log(text, 'system', 'good');
  return { ok: true, text, tone: 'good' };
}

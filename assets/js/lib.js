// Pure logic, no DOM: tested by scripts/lib.test.mjs.

/** Local calendar day as YYYY-MM-DD. */
export function dayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Same fact for everyone on a given local day; walks the whole list before repeating. */
export function dailyFact(facts, date = new Date()) {
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000);
  const n = facts.length;
  // 37 is prime: stepping by it visits every index once per cycle unless n is a multiple of 37.
  const step = n % 37 === 0 ? 1 : 37;
  return facts[(day * step) % n];
}

/**
 * Deck order for one user:
 * unseen facts before seen ones; inside each group the categories this user liked come first,
 * with ±25% randomness so every visit differs. `first` (a fact id) is pinned to the top.
 */
export function rank(facts, { liked = new Set(), seen = new Set(), first = null, random = Math.random } = {}) {
  const likedPerCategory = {};
  let likedTotal = 0;
  for (const f of facts) {
    if (liked.has(f.id)) {
      likedPerCategory[f.category] = (likedPerCategory[f.category] || 0) + 1;
      likedTotal++;
    }
  }
  const affinity = (f) => (likedTotal ? (likedPerCategory[f.category] || 0) / likedTotal : 0);
  const score = (f) => (1 + affinity(f)) * (0.75 + random() * 0.5);
  const byScore = (list) => list.map((f) => [f, score(f)]).sort((a, b) => b[1] - a[1]).map(([f]) => f);
  const order = [...byScore(facts.filter((f) => !seen.has(f.id))), ...byScore(facts.filter((f) => seen.has(f.id)))];
  const top = first && order.find((f) => f.id === first);
  return top ? [top, ...order.filter((f) => f !== top)] : order;
}

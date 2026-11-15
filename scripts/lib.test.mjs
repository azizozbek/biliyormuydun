// Run: node --test scripts/
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { dailyFact, dayKey, rank } from "../assets/js/lib.js";

const facts = JSON.parse(readFileSync(new URL("../data/facts.json", import.meta.url)));
const noRandom = () => 0.5;

test("daily fact is stable for a day and cycles through every fact", () => {
  const d = new Date(2026, 10, 15, 9);
  assert.equal(dailyFact(facts, d).id, dailyFact(facts, new Date(2026, 10, 15, 23)).id);
  const ids = new Set();
  for (let k = 0; k < facts.length; k++) ids.add(dailyFact(facts, new Date(2026, 0, 1 + k)).id);
  assert.equal(ids.size, facts.length);
  assert.equal(dayKey(d), "2026-11-15");
});

test("rank: unseen first, liked categories boosted, pinned on top", () => {
  const f = [
    { id: "a", category: "X" },
    { id: "b", category: "Y" },
    { id: "c", category: "Y" },
    { id: "d", category: "Z" },
  ];
  // a was already seen, so it goes last.
  let order = rank(f, { seen: new Set(["a"]), random: noRandom }).map((x) => x.id);
  assert.equal(order.at(-1), "a");
  // The user likes category Z: d overtakes c (same likes otherwise).
  order = rank(f, { liked: new Set(["d"]), seen: new Set(["d"]), random: noRandom }).map((x) => x.id);
  assert.ok(order.indexOf("a") > -1 && order.at(-1) === "d"); // seen still last
  order = rank(
    [...f, { id: "e", category: "Z" }],
    { liked: new Set(["d"]), seen: new Set(["d"]), random: noRandom },
  ).map((x) => x.id);
  assert.equal(order[0], "e");
  // Pinned fact comes first even if seen.
  assert.equal(rank(f, { first: "a", seen: new Set(["a"]) })[0].id, "a");
  // Order differs between visits.
  const shuffled = new Set(Array.from({ length: 20 }, () => rank(facts).slice(0, 5).map((x) => x.id).join()));
  assert.ok(shuffled.size > 1);
});

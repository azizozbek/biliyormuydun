// Checks data/facts.json and every colour pair the site uses. Run: npm run check
import { readFileSync } from "node:fs";

const read = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url)));
const facts = read("data/facts.json");
const palette = read("data/palette.json");
const errors = [];

// --- facts ---
const ids = new Set();
const perCategory = {};
facts.forEach((f, i) => {
  const at = `facts[${i}] (${f.id})`;
  if (typeof f.id !== "string" || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(f.id)) errors.push(`${at}: id must be a lower-case slug`);
  if (ids.has(f.id)) errors.push(`${at}: duplicate id`);
  ids.add(f.id);
  for (const k of ["category", "fact"]) if (typeof f[k] !== "string" || !f[k].trim()) errors.push(`${at}: missing ${k}`);
  if (!Array.isArray(f.detail) || !f.detail.length || f.detail.some((p) => typeof p !== "string" || !p.trim()))
    errors.push(`${at}: detail must be a non-empty array of paragraphs`);
  if (f.source !== undefined && (typeof f.source !== "string" || !f.source.trim())) errors.push(`${at}: source must be a string`);
  const extra = Object.keys(f).filter((k) => !["id", "category", "fact", "detail", "source"].includes(k));
  if (extra.length) errors.push(`${at}: unknown fields ${extra}`);
  perCategory[f.category] = (perCategory[f.category] ?? 0) + 1;
});
if (facts.length < 60) errors.push(`only ${facts.length} facts, need 60`);
for (const [c, n] of Object.entries(perCategory)) if (n < 5) errors.push(`category ${c} has ${n} facts, need ≥ 5`);

// --- contrast (WCAG 2.x, 4.5:1) ---
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lum = (c) => {
  const [r, g, b] = c.map((v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const white = (c, a) => c.map((v) => Math.round(v + (255 - v) * a));
const pair = (label, fg, bgs, gloss = 0) => {
  for (const bg of bgs) {
    for (const b of gloss ? [rgb(bg), white(rgb(bg), gloss)] : [rgb(bg)]) {
      const r = ratio(rgb(fg), b);
      if (r < 4.5) errors.push(`${label}: ${fg} on rgb(${b}) = ${r.toFixed(2)} < 4.5`);
    }
  }
};

// Keep in sync with assets/css/main.css (the [data-c] blocks and the --ui-* tokens).
const SHEET = { light: "#fbfaf7", dark: "#17161a" };
palette.forEach(({ light: l, dark: d }, i) => {
  pair(`c${i} light page text`, l.fg, l.g, 0.35);
  pair(`c${i} light card`, l.panelFg, [l.panel]);
  pair(`c${i} light sheet`, l.fg, [SHEET.light]);
  pair(`c${i} dark page text`, d.panelFg, [d.panel, d.g[0]], 0.08);
  pair(`c${i} dark card`, d.fg, [d.g[1]]);
  pair(`c${i} dark sheet`, d.panelFg, [SHEET.dark]);
});
const ui = {
  light: { bg: "#faf7f2", card: "#ffffff", fg: "#1c1a17", muted: "#5c574f", accent: "#2b3fd9", accentFg: "#ffffff", like: "#8a1f48" },
  dark: { bg: "#121214", card: "#1b1b1f", fg: "#f2f0ec", muted: "#a9a49b", accent: "#9fb0ff", accentFg: "#0f1330", like: "#f4a6c0" },
};
for (const [mode, u] of Object.entries(ui)) {
  pair(`ui ${mode} text`, u.fg, [u.bg, u.card]);
  pair(`ui ${mode} muted`, u.muted, [u.bg, u.card]);
  pair(`ui ${mode} like`, u.like, [u.bg, u.card]);
  pair(`ui ${mode} button`, u.accentFg, [u.accent]);
}
pair("offline badge", "#faf7f2", ["#1c1a17"]);

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`OK: ${facts.length} facts ${JSON.stringify(perCategory)}; all colour pairs ≥ 4.5:1`);

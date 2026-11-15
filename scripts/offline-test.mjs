// End-to-end PWA test via CDP against a headless Chromium with a throwaway profile.
// Usage: node scripts/offline-test.mjs "<Chrome/Brave/Edge binary>" http://localhost:8080   (needs `npm run preview` running)
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const [bin, base] = process.argv.slice(2);
const profile = mkdtempSync(join(process.env.TMPDIR || tmpdir(), "bm-prof-"));
const port = 9333;
const proc = spawn(bin, [`--headless=new`, `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "--no-first-run", "about:blank"], { stdio: "ignore" });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let target;
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200);
  try {
    target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === "page");
  } catch {}
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0;
const pending = new Map();
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data);
  if (msg.id && pending.has(msg.id)) {
    pending.get(msg.id)(msg);
    pending.delete(msg.id);
  }
};
const send = (method, params = {}) =>
  new Promise((res) => {
    const n = ++id;
    pending.set(n, res);
    ws.send(JSON.stringify({ id: n, method, params }));
  });
const evalJs = async (expr) => {
  const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
  return r.result?.result?.value ?? r.result?.exceptionDetails?.exception?.description;
};
const go = async (url) => {
  await send("Page.navigate", { url });
  await sleep(1500);
};
const offline = (on) =>
  send("Network.emulateNetworkConditions", { offline: on, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
const results = [];
const check = (name, ok, info) => {
  results.push(`${ok ? "PASS" : "FAIL"} ${name}${info !== undefined ? ` → ${JSON.stringify(info)}` : ""}`);
};

await send("Page.enable");
await send("Network.enable");
await go(`${base}/`);
await evalJs("navigator.serviceWorker.ready.then(() => true)");
await go(`${base}/`); // second load: page is now controlled by the SW
await sleep(1500);
const sw = await evalJs(`(async () => ({ controlled: !!navigator.serviceWorker.controller, cached: (await (await caches.open((await caches.keys())[0])).keys()).length }))()`);
check("service worker controls page and precached files", sw.controlled && sw.cached >= 66, sw);

await offline(true);
await go(`${base}/`);
const home = await evalJs(`({ fact: document.querySelector("#stage .card:last-child .fact")?.textContent, badge: !document.querySelector("#offline").hidden })`);
check("home loads offline with a card", !!home.fact, home);
check("offline badge visible", home.badge);

await go(`${base}/bilgi/olympus-mons/`);
const page = await evalJs(`({ title: document.title, top: document.querySelector("#stage .card:last-child .fact")?.textContent, detail: document.querySelector("#sheet-text p")?.textContent.slice(0, 30) })`);
check("fact page loads offline, pinned fact first", page.top?.startsWith("Mars'taki Olympus Mons"), page);

const liked = await evalJs(`(() => { document.querySelector("#stage .card:last-child .like").click(); return { likes: JSON.parse(localStorage.getItem("bm:likes")) }; })()`);
check("like while offline is saved on the device", liked.likes?.includes("olympus-mons"), liked);

await go(`${base}/favoriler/`);
const fav = await evalJs(`[...document.querySelectorAll("#fav-list .txt")].map((e) => e.textContent)`);
check("favourites page works offline", fav.length === 1, fav);

console.log(results.join("\n"));
ws.close();
proc.kill();

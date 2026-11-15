import { dailyFact, dayKey, rank } from "./lib.js";

const $ = (s, root = document) => root.querySelector(s);
const PALETTE_SIZE = 8; // entries in data/palette.json
const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

// ---------- storage (every access guarded: private mode / blocked storage must not break the page) ----------
const store = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(`bm:${key}`);
      return v == null ? fallback : JSON.parse(v);
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(`bm:${key}`, JSON.stringify(value));
    } catch {}
  },
};
const session = {
  get: (k) => { try { return sessionStorage.getItem(`bm:${k}`); } catch { return null; } },
  set: (k, v) => { try { v == null ? sessionStorage.removeItem(`bm:${k}`) : sessionStorage.setItem(`bm:${k}`, v); } catch {} },
};

function toast(text) {
  const el = $("#toast");
  el.textContent = text;
  el.classList.add("show");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove("show"), 2200);
}

// ---------- likes: kept on this device only ----------
const likes = {
  ids: new Set(store.get("likes", [])),
  has(id) {
    return this.ids.has(id);
  },
  set(id, liked) {
    if (this.has(id) === liked) return;
    liked ? this.ids.add(id) : this.ids.delete(id);
    store.set("likes", [...this.ids]);
  },
};

// Browser UI colour (address bar, Android task switcher) follows the screen: the top card's
// background on the deck, the page background elsewhere. Read from CSS so light/dark is respected.
function updateThemeColor() {
  const deck = document.body.classList.contains("deck");
  const color = getComputedStyle(deck ? document.body : document.documentElement)
    .getPropertyValue(deck ? "--bg1" : "--ui-bg")
    .trim();
  if (!color) return;
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.remove());
  document.head.append(Object.assign(document.createElement("meta"), { name: "theme-color", content: color }));
}

function updateOffline() {
  $("#offline").hidden = navigator.onLine;
}

async function shareFact(f) {
  const url = new URL(`/bilgi/${f.id}/`, location.origin).href;
  if (navigator.share) {
    try {
      await navigator.share({ title: "Biliyor muydun?", text: f.fact, url });
    } catch {}
    return;
  }
  try {
    await navigator.clipboard.writeText(`${f.fact}\n\n${url}`);
    toast("Bağlantı panoya kopyalandı");
  } catch {
    toast(url);
  }
}

// ---------- deck ----------
function initDeck(allFacts) {
  const stage = $("#stage");
  const tpl = $("#card-tpl");
  const sheet = $("#sheet");
  const prevBtn = $("#prev");
  const nextBtn = $("#next");
  const filterBtn = $("#btn-filter");
  let pinned = stage.dataset.first || null; // /bilgi/<id>/ shows that fact first
  let filter = session.get("filter");
  let order = [];
  let i = 0;
  let dailyId = null;
  let seenTimer;

  function build() {
    const pool = filter ? allFacts.filter((f) => f.category === filter) : allFacts;
    let seen = new Set(store.get("seen", []));
    if (pool.every((f) => seen.has(f.id))) {
      // Everything seen: start a fresh round.
      seen = new Set([...seen].filter((id) => !pool.some((f) => f.id === id)));
      store.set("seen", [...seen]);
    }
    dailyId = null;
    let first = pinned;
    if (!first && !filter && store.get("dailySeen") !== dayKey()) first = dailyId = dailyFact(allFacts).id;
    order = rank(pool, { liked: likes.ids, seen, first });
    i = 0;
    filterBtn.toggleAttribute("data-active", !!filter);
    render();
  }

  function cardEl(f, depth) {
    const el = tpl.content.firstElementChild.cloneNode(true);
    el.dataset.c = (i + depth) % PALETTE_SIZE;
    el.dataset.depth = depth;
    $(".fact", el).textContent = f.fact;
    $(".cat", el).textContent = f.category;
    $(".badge", el).hidden = f.id !== dailyId;
    setLiked(el, likes.has(f.id));
    if (depth) {
      el.inert = true;
      el.setAttribute("aria-hidden", "true");
    }
    return el;
  }

  function setLiked(card, liked) {
    const b = $(".like", card);
    b.setAttribute("aria-pressed", liked);
    b.setAttribute("aria-label", liked ? "Beğeniyi geri al" : "Beğen ve favorilere ekle");
  }

  function render() {
    const f = order[i];
    if (!f) return;
    stage.replaceChildren(...order.slice(i, i + 3).map((x, d) => cardEl(x, d)).reverse());
    document.body.dataset.c = i % PALETTE_SIZE;
    updateThemeColor();
    $("#live").textContent = `${f.category}. ${f.fact}`;
    prevBtn.disabled = i === 0;
    fillSheet(f);
    bindCard(stage.lastElementChild, f);
    clearTimeout(seenTimer);
    seenTimer = setTimeout(() => markSeen(f), 2000);
  }

  function markSeen(f) {
    const seen = new Set(store.get("seen", []));
    seen.add(f.id);
    store.set("seen", [...seen]);
    if (f.id === dailyId) store.set("dailySeen", dayKey());
  }

  function fillSheet(f) {
    $("#sheet-text").replaceChildren(...f.detail.map((p) => Object.assign(document.createElement("p"), { textContent: p })));
    $("#sheet-src").textContent = f.source ? `Kaynak: ${f.source}` : "";
  }

  function next() {
    closeSheet();
    if (i < order.length - 1) {
      i++;
      render();
    } else {
      pinned = null;
      build(); // end of the deck: deal a new round
    }
  }
  function prev() {
    if (i === 0) return;
    closeSheet();
    i--;
    render();
    if (reducedMotion()) return;
    const card = stage.lastElementChild; // the returning card slides back in from the left
    card.style.transition = "none";
    card.style.transform = `translate(${-innerWidth * 1.1}px, -30px) rotate(-22deg)`;
    card.getBoundingClientRect(); // apply the start position before animating
    card.style.transition = "transform .28s ease-out";
    card.style.transform = "";
  }
  function fly(card, dir) {
    if (reducedMotion()) return next();
    card.style.transition = "transform .28s ease-in, opacity .28s ease-in";
    card.style.transform = `translate(${dir * innerWidth * 1.1}px, -30px) rotate(${dir * 22}deg)`;
    card.style.opacity = "0";
    // Bring the cards behind forward now, so the next fact is readable while this one flies off.
    for (const c of stage.querySelectorAll('.card[data-depth="1"], .card[data-depth="2"]')) c.dataset.depth -= 1;
    setTimeout(next, 260);
  }

  function like(card, f, liked) {
    likes.set(f.id, liked);
    setLiked(card, liked);
    if (liked && !reducedMotion()) {
      const b = $(".burst", card);
      b.classList.remove("go");
      void b.offsetWidth; // restart the animation
      b.classList.add("go");
    }
  }

  function openSheet(moveFocus = true) {
    document.body.classList.add("detail-open");
    sheet.inert = false;
    sheet.scrollTop = 0;
    if (moveFocus) $("#sheet-close").focus({ preventScroll: true });
  }
  function closeSheet() {
    if (!document.body.classList.contains("detail-open")) return;
    document.body.classList.remove("detail-open");
    sheet.inert = true;
  }

  // Swipe sideways = next card (either direction), pull up = details, double tap = like.
  let lastTap = 0;
  function bindCard(card, f) {
    $(".like", card).onclick = () => like(card, f, !likes.has(f.id));
    $(".share", card).onclick = () => shareFact(f);
    $(".more", card).onclick = () => openSheet();

    let id = null, sx = 0, sy = 0, t0 = 0, dx = 0, dy = 0, axis = null;
    card.onpointerdown = (e) => {
      if (e.button !== 0 || e.target.closest("button, a")) return;
      if (document.body.classList.contains("detail-open")) return closeSheet();
      id = e.pointerId;
      sx = e.clientX;
      sy = e.clientY;
      t0 = performance.now();
      dx = dy = 0;
      axis = null;
      card.setPointerCapture(id);
      card.style.transition = "none";
    };
    card.onpointermove = (e) => {
      if (e.pointerId !== id) return;
      dx = e.clientX - sx;
      dy = e.clientY - sy;
      if (!axis && Math.hypot(dx, dy) > 8) axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (axis === "x") card.style.transform = `translate(${dx}px, ${dy * 0.15}px) rotate(${dx / 18}deg)`;
      else if (axis === "y") card.style.transform = `translateY(${Math.min(0, dy) / 3}px)`;
    };
    card.onpointerup = card.onpointercancel = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      card.style.transition = "";
      const speed = Math.abs(dx) / Math.max(1, performance.now() - t0);
      if (axis === "x" && (Math.abs(dx) > card.offsetWidth * 0.28 || speed > 0.6)) {
        // Right = next card, left = previous card (snaps back on the first card).
        if (dx > 0) return fly(card, 1);
        if (i > 0) {
          card.style.transform = "";
          return prev();
        }
      }
      card.style.transform = "";
      if (axis === "y" && dy < -60) return openSheet(false);
      if (!axis && e.type === "pointerup") {
        const now = performance.now();
        if (now - lastTap < 320) {
          lastTap = 0;
          like(card, f, true); // double tap only ever likes, like most apps
        } else lastTap = now;
      }
    };
  }

  // Drag the sheet's handle down to close it.
  const head = $(".sheet-head");
  let hy = null;
  head.onpointerdown = (e) => {
    hy = e.clientY;
    head.setPointerCapture(e.pointerId);
  };
  head.onpointerup = head.onpointercancel = (e) => {
    if (hy != null && e.clientY - hy > 60) closeSheet();
    hy = null;
  };
  $("#sheet-close").onclick = closeSheet;
  prevBtn.onclick = prev;
  nextBtn.onclick = () => fly(stage.lastElementChild, 1);

  document.addEventListener("keydown", (e) => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || $("#filter").open) return;
    if (e.target.closest?.("input, textarea")) return;
    const k = e.key;
    if (k === "ArrowRight") fly(stage.lastElementChild, 1);
    else if (k === "ArrowLeft") prev();
    else if (k === "ArrowUp") openSheet();
    else if (k === "Enter" && e.target === document.body) openSheet();
    else if (k === "ArrowDown" || k === "Escape") closeSheet();
    else return;
    e.preventDefault();
  });

  // Category filter
  const dlg = $("#filter");
  let pick = filter;
  function chips() {
    const cats = [...new Set(allFacts.map((f) => f.category))].sort((a, b) => a.localeCompare(b, "tr"));
    const make = (value, label) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.setAttribute("aria-pressed", String(pick === value));
      b.textContent = label;
      b.onclick = () => {
        pick = value;
        chips();
      };
      return b;
    };
    $("#chips").replaceChildren(make(null, "Tümü"), ...cats.map((c) => make(c, c)));
  }
  filterBtn.onclick = () => {
    pick = filter;
    chips();
    dlg.showModal();
  };
  $("#filter-close").onclick = () => dlg.close();
  dlg.onclick = (e) => e.target === dlg && dlg.close(); // click on the backdrop
  $("#filter-apply").onclick = () => {
    filter = pick;
    session.set("filter", filter);
    pinned = null;
    dlg.close();
    build();
  };

  build();
}

// ---------- favourites page ----------
function initFavorites(allFacts) {
  const list = $("#fav-list");
  const tpl = $("#fav-tpl");
  const byId = new Map(allFacts.map((f, n) => [f.id, [f, n]]));
  function render() {
    const items = [...likes.ids].filter((id) => byId.has(id)).reverse(); // newest first
    $("#fav-empty").hidden = items.length > 0;
    $("#fav-count").textContent = items.length ? `${items.length} bilgi` : "";
    list.replaceChildren(
      ...items.map((id) => {
        const [f, n] = byId.get(id);
        const li = tpl.content.firstElementChild.cloneNode(true);
        li.dataset.c = n % PALETTE_SIZE;
        $("a", li).href = `/bilgi/${f.id}/`;
        $(".cat", li).textContent = f.category;
        $(".txt", li).textContent = f.fact;
        $(".unlike", li).onclick = () => {
          likes.set(f.id, false);
          render();
          toast("Favorilerden çıkarıldı");
        };
        return li;
      }),
    );
  }
  render();
}

// ---------- settings page ----------
function initSettings() {
  const form = $("#settings");
  const s = { theme: "system", size: "M", ...store.get("settings", {}) };
  form.theme.value = s.theme;
  form.size.value = s.size;
  form.onchange = () => {
    const next = { theme: form.theme.value, size: form.size.value };
    store.set("settings", next);
    const root = document.documentElement;
    if (next.theme === "system") delete root.dataset.theme;
    else root.dataset.theme = next.theme;
    root.dataset.size = next.size;
    updateThemeColor();
  };

  const status = $("#offline-status");
  const ready = "Bilgiler bu cihazda hazır. İnternet olmadan da okunur.";
  if (!("serviceWorker" in navigator)) status.textContent = "Bu tarayıcı çevrimdışı kullanımı desteklemiyor.";
  else if (navigator.serviceWorker.controller) status.textContent = ready;
  else {
    status.textContent = "Çevrimdışı kullanım hazırlanıyor…";
    navigator.serviceWorker.ready.then(() => (status.textContent = ready));
  }

  bindInstallButton($("#install"));

  $("#reset-seen").onclick = () => {
    store.set("seen", []);
    store.set("dailySeen", null);
    toast("Sıfırlandı. Bütün bilgiler yeniden gösterilecek.");
  };
}

// ---------- add to home screen ----------
// Android/Chrome/Edge: the browser's own install prompt. iOS has no such API, so we show the steps instead.
let installEvent = null;
const installButtons = new Set();
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
// iPadOS reports itself as a Mac; the touch check tells them apart.
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
const canInstall = () => !isStandalone() && (installEvent !== null || isIOS());
const refreshInstall = () => installButtons.forEach((b) => (b.hidden = !canInstall()));

// Registered at load, before the facts fetch: the event can fire early and is not repeated.
addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  installEvent = e;
  refreshInstall();
});
addEventListener("appinstalled", () => {
  installEvent = null;
  refreshInstall();
});

async function install() {
  if (installEvent) {
    const e = installEvent;
    e.prompt();
    installEvent = null; // an event can prompt only once; the browser fires a new one when it allows another try
    await e.userChoice;
    refreshInstall();
    return;
  }
  $("#ios-install").showModal();
}

function bindInstallButton(button) {
  if (!button) return;
  installButtons.add(button);
  button.onclick = install;
  refreshInstall();
}

// ---------- boot ----------
async function boot() {
  addEventListener("online", updateOffline);
  addEventListener("offline", updateOffline);
  updateOffline();
  updateThemeColor();
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", updateThemeColor);
  bindInstallButton($("#btn-install"));
  const dlg = $("#ios-install");
  $("#ios-install-close").onclick = () => dlg.close();
  dlg.onclick = (e) => e.target === dlg && dlg.close(); // click on the backdrop
  const page = document.body.dataset.page;
  if (!["deck", "favoriler", "ayarlar"].includes(page)) return;
  const facts = await (await fetch($('meta[name="facts"]').content)).json();
  if (page === "deck") initDeck(facts);
  else if (page === "favoriler") initFavorites(facts);
  else initSettings();
}
boot();

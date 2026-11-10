const STORAGE_FAV = "standby.favs";
const STORAGE_FAV_LIBRARY = "standby.library";
const STORAGE_MODE = "standby.mode";

const $ = (id) => document.getElementById(id);

const slide = $("slide");
const favBtn = $("fav");
const listEl = $("list");
const modes = $("modes");

const state = {
  catalog: [],
  archive: new Map(),
  favIds: new Set(),
  queue: [],
  index: 0,
  mode: localStorage.getItem(STORAGE_MODE) || "all",
  timer: null,
  interval: 180000,
  idle: null,
};

function saveFavs() {
  localStorage.setItem(STORAGE_FAV, JSON.stringify([...state.favIds]));
  localStorage.removeItem(STORAGE_FAV_LIBRARY);
}

function readFavIds() {
  const ids = [];
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_FAV) || "[]");
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (typeof item === "string") ids.push(item);
        else if (item && item.id) ids.push(item.id);
      }
    }
  } catch {
    /* ignore */
  }
  if (ids.length) return ids;
  try {
    const legacy = JSON.parse(localStorage.getItem(STORAGE_FAV_LIBRARY) || "[]");
    if (Array.isArray(legacy)) {
      return legacy.map((item) => (typeof item === "string" ? item : item?.id)).filter(Boolean);
    }
  } catch {
    /* ignore */
  }
  return [];
}

function lookup(id) {
  if (!id) return null;
  return state.catalog.find((w) => w.id === id) || state.archive.get(id) || null;
}

function hydrateFavs() {
  state.favIds = new Set(readFavIds());
  saveFavs();
}

function current() {
  return state.queue[state.index] || state.catalog[0] || lookup([...state.favIds][0]);
}

function isFav(work) {
  return work && state.favIds.has(work.id);
}

function favList() {
  return [...state.favIds].map(lookup).filter(Boolean);
}

function shuffled(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildQueue() {
  const all = state.catalog;
  const favs = favList();
  if (state.mode === "fav") {
    state.queue = favs.length ? favs : all;
  } else if (state.mode === "mix" && favs.length) {
    const rest = shuffled(all.filter((w) => !state.favIds.has(w.id)));
    const stars = shuffled(favs);
    const mixed = [];
    const n = Math.max(stars.length, rest.length);
    for (let i = 0; i < n; i += 1) {
      if (i < stars.length) mixed.push(stars[i]);
      if (i < rest.length) mixed.push(rest[i]);
    }
    state.queue = mixed;
  } else {
    state.queue = shuffled(all);
  }
  if (state.index >= state.queue.length) state.index = 0;
}

function renderChrome() {
  const work = current();
  favBtn.textContent = isFav(work) ? "已收藏" : "收藏";
  favBtn.setAttribute("aria-pressed", isFav(work) ? "true" : "false");
  for (const btn of modes.querySelectorAll("button")) {
    btn.setAttribute("aria-pressed", btn.dataset.mode === state.mode ? "true" : "false");
  }
  listEl.innerHTML = "";
  let source = state.catalog;
  if (state.mode === "fav") {
    source = favList();
  } else if (state.mode === "mix") {
    const extra = favList().filter((w) => !state.catalog.some((c) => c.id === w.id));
    source = extra.concat(state.catalog);
  }
  const rows = source.length ? source : state.catalog;
  for (const item of rows) {
    const li = document.createElement("li");
    li.textContent = item.title;
    if (item.id === current()?.id) li.classList.add("current");
    if (state.favIds.has(item.id)) li.classList.add("starred");
    li.addEventListener("click", () => jumpTo(item.id));
    listEl.append(li);
  }
}

function decode(text) {
  const box = document.createElement("textarea");
  box.innerHTML = text || "";
  return box.value;
}

function renderIntro(work) {
  $("intro-kicker").textContent = [work.year, work.source].filter(Boolean).join("  ·  ");
  $("intro-title").textContent = decode(work.title);
  $("intro-lede").textContent = [decode(work.maker), decode(work.medium)].filter(Boolean).join("  ·  ");
  $("intro-body").textContent = decode(work.intro || "");
  $("intro-cite").textContent = `${work.license}. ${decode(work.credit)}`.trim();
  slide.alt = decode(work.title);
}

function sources(work) {
  const list = [work.image, work.imageHi];
  return [...new Set(list.filter((url) => typeof url === "string" && url.length > 8))];
}

function armPan(img) {
  slide.classList.remove("pan-x", "pan-y");
  void slide.offsetWidth;
  const ir = img.naturalWidth / img.naturalHeight;
  const vr = window.innerWidth / window.innerHeight;
  if (!ir || !vr || Math.abs(ir - vr) < 0.06) return;
  slide.classList.add(ir > vr ? "pan-x" : "pan-y");
}

function loadSlide(urls, onDone) {
  let i = 0;
  const tryNext = () => {
    if (i >= urls.length) {
      onDone("", null);
      return;
    }
    const url = urls[i];
    i += 1;
    const img = new Image();
    const timer = setTimeout(() => {
      img.onload = img.onerror = null;
      img.src = "";
      tryNext();
    }, 15000);
    img.onload = () => {
      clearTimeout(timer);
      onDone(url, img);
    };
    img.onerror = () => {
      clearTimeout(timer);
      tryNext();
    };
    img.src = url;
  };
  tryNext();
}

function show(work) {
  if (!work) return;
  slide.classList.remove("on", "pan-x", "pan-y");
  renderIntro(work);
  renderChrome();
  loadSlide(sources(work), (url, img) => {
    if (url) slide.src = url;
    if (img) armPan(img);
    requestAnimationFrame(() => slide.classList.add("on"));
  });
  preload(1);
}

function preload(offset) {
  const work = state.queue[(state.index + offset) % state.queue.length];
  if (!work) return;
  const first = sources(work)[0];
  if (!first) return;
  const img = new Image();
  img.src = first;
}

function go(delta) {
  if (!state.queue.length) return;
  state.index = (state.index + delta + state.queue.length) % state.queue.length;
  show(current());
  restartTimer();
}

function jumpTo(id) {
  const i = state.queue.findIndex((w) => w.id === id);
  if (i >= 0) {
    state.index = i;
  } else if (lookup(id)) {
    const onlyInFav = state.favIds.has(id) && !state.catalog.some((w) => w.id === id);
    state.mode = onlyInFav ? "fav" : "all";
    localStorage.setItem(STORAGE_MODE, state.mode);
    buildQueue();
    const next = state.queue.findIndex((w) => w.id === id);
    if (next < 0) return;
    state.index = next;
  } else {
    return;
  }
  show(current());
  restartTimer();
}

function toggleFav() {
  const work = current();
  if (!work) return;
  if (state.favIds.has(work.id)) state.favIds.delete(work.id);
  else state.favIds.add(work.id);
  saveFavs();
  if (state.mode !== "all") buildQueue();
  renderChrome();
}

function setMode(mode) {
  state.mode = mode;
  localStorage.setItem(STORAGE_MODE, mode);
  const keep = current()?.id;
  buildQueue();
  const i = state.queue.findIndex((w) => w.id === keep);
  state.index = i >= 0 ? i : 0;
  show(current());
  restartTimer();
}

function restartTimer() {
  clearInterval(state.timer);
  state.timer = setInterval(() => go(1), state.interval);
}

function armIdle() {
  document.body.classList.remove("idle");
  clearTimeout(state.idle);
  state.idle = setTimeout(() => document.body.classList.add("idle"), 2000);
}

async function loadJson(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json();
}

async function loadCatalog() {
  const [data, archived] = await Promise.all([
    loadJson("./data/catalog.json"),
    loadJson("./data/archive.json").catch(() => ({ works: [] })),
  ]);
  state.catalog = data.works || [];
  state.interval = (data.intervalSeconds || 180) * 1000;
  const all = [...(archived.works || []), ...state.catalog];
  state.archive = new Map(all.filter((w) => w && w.id).map((w) => [w.id, w]));
  hydrateFavs();
}

async function boot() {
  await loadCatalog();
  buildQueue();
  show(current());
  restartTimer();
  armIdle();
}

$("prev").addEventListener("click", () => go(-1));
$("next").addEventListener("click", () => go(1));
favBtn.addEventListener("click", toggleFav);
modes.addEventListener("click", (event) => {
  const btn = event.target.closest("button[data-mode]");
  if (btn) setMode(btn.dataset.mode);
});

window.addEventListener("mousemove", armIdle);
window.addEventListener("resize", () => {
  if (slide.naturalWidth) armPan(slide);
});
window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowRight") go(1);
  if (event.key === "ArrowLeft") go(-1);
  if (event.key === "f" || event.key === "F") toggleFav();
});

boot().catch((err) => {
  $("intro-title").textContent = "目錄讀取失敗";
  $("intro-body").textContent = String(err);
});

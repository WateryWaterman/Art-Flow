const STORAGE_FAV = "standby.favs";
const STORAGE_FAV_LIBRARY = "standby.library";
const STORAGE_MODE = "standby.mode";
const STORAGE_MOSAIC = "standby.mosaic";

const $ = (id) => document.getElementById(id);

const slide = $("slide");
const favBtn = $("fav");
const favLabel = favBtn.querySelector(".fav-label");
const listEl = $("list");
const modes = $("modes");
const mosaicBtn = $("mosaic");
const gridEl = $("grid");
const thumb = $("intro-thumb");
const thumbLink = $("intro-thumb-link");
const toolsEl = $("intro-tools");
const favFile = $("fav-file");

const PALETTES = [
  [[26, 10, 18], [214, 42, 108], [255, 214, 86]],
  [[8, 32, 64], [0, 156, 196], [255, 232, 110]],
  [[32, 6, 8], [196, 28, 36], [255, 200, 72]],
  [[6, 42, 28], [18, 168, 108], [236, 255, 176]],
  [[42, 8, 52], [148, 52, 204], [255, 186, 232]],
  [[16, 16, 16], [72, 72, 70], [244, 238, 226]],
  [[16, 22, 78], [255, 86, 36], [255, 214, 196]],
  [[52, 22, 6], [216, 132, 28], [255, 236, 176]],
  [[6, 52, 56], [255, 64, 140], [176, 255, 246]],
];

const state = {
  catalog: [],
  archive: new Map(),
  favIds: new Set(),
  queue: [],
  index: 0,
  mode: localStorage.getItem(STORAGE_MODE) || "all",
  mosaic: localStorage.getItem(STORAGE_MOSAIC) !== "0",
  timer: null,
  interval: 180000,
  idle: null,
  tileUrls: [],
  lastImg: null,
  token: 0,
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
  localStorage.removeItem("standby.mosaicPan");
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
  const liked = isFav(work);
  favLabel.textContent = liked ? "Liked" : "Like";
  favBtn.setAttribute("aria-pressed", liked ? "true" : "false");
  favBtn.setAttribute("aria-label", liked ? "Liked" : "Like");
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
    if (item.id === current()?.id) li.classList.add("current");
    if (state.favIds.has(item.id)) li.classList.add("starred");
    const title = document.createElement("span");
    title.className = "list-title";
    title.textContent = item.title;
    const idEl = document.createElement("code");
    idEl.className = "list-id";
    idEl.textContent = item.id;
    idEl.title = "Copy unique id";
    idEl.addEventListener("click", (event) => {
      event.stopPropagation();
      navigator.clipboard.writeText(item.id).then(() => {
        idEl.classList.add("copied");
        window.setTimeout(() => idEl.classList.remove("copied"), 900);
      });
    });
    li.append(title, idEl);
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
  thumb.alt = decode(work.title);
  const page = work.sourceUrl || "";
  if (page) {
    thumbLink.href = page;
    thumbLink.target = "_blank";
    thumbLink.rel = "noopener noreferrer";
    thumbLink.classList.remove("is-off");
  } else {
    thumbLink.removeAttribute("href");
    thumbLink.removeAttribute("target");
    thumbLink.classList.add("is-off");
  }
  renderMosaicBtn();
}

function mosaicOn() {
  return state.mosaic;
}

function renderMosaicBtn() {
  mosaicBtn.setAttribute("aria-pressed", mosaicOn() ? "true" : "false");
  mosaicBtn.textContent = mosaicOn() ? "低清拼合 開" : "低清拼合 關";
}

function revokeTiles() {
  for (const url of state.tileUrls) URL.revokeObjectURL(url);
  state.tileUrls = [];
}

function isLowRes(img, work) {
  const nw = img.naturalWidth;
  const nh = img.naturalHeight;
  if (!nw || !nh) return false;
  if (Math.max(1920 / nw, 1080 / nh) > 1.02) return true;
  const blob = `${work?.medium || ""} ${work?.title || ""} ${(work?.tags || []).join(" ")}`;
  if (/chair|stool|table|bench|cabinet|desk|furniture|armchair/i.test(blob) && Math.max(nw, nh) < 2500) {
    return true;
  }
  return false;
}

function colorize(ctx, w, h, shadow, mid, light) {
  const pixels = ctx.getImageData(0, 0, w, h);
  const d = pixels.data;
  for (let i = 0; i < d.length; i += 4) {
    const y = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    const c = y < 78 ? shadow : y < 168 ? mid : light;
    d[i] = c[0];
    d[i + 1] = c[1];
    d[i + 2] = c[2];
  }
  ctx.putImageData(pixels, 0, 0);
}

function colorizeFull(img, palette) {
  const maxEdge = 1400;
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const ctx = off.getContext("2d", { willReadFrequently: true, alpha: false });
  ctx.drawImage(img, 0, 0, w, h);
  colorize(ctx, w, h, palette[0], palette[1], palette[2]);
  return new Promise((resolve) => {
    off.toBlob((blob) => resolve(blob || null), "image/jpeg", 0.88);
  });
}

function ensureGrid() {
  if (gridEl.childElementCount === 9) return;
  gridEl.innerHTML = "";
  for (let i = 0; i < 9; i += 1) {
    const cell = document.createElement("div");
    cell.className = "cell";
    const tile = document.createElement("img");
    tile.className = "tile";
    tile.draggable = false;
    tile.alt = "";
    cell.append(tile);
    gridEl.append(cell);
  }
}

async function buildTiles(img) {
  const blobs = await Promise.all(PALETTES.map((palette) => colorizeFull(img, palette)));
  revokeTiles();
  state.tileUrls = blobs.map((blob) => (blob ? URL.createObjectURL(blob) : ""));
  ensureGrid();
  const tiles = gridEl.querySelectorAll(".tile");
  tiles.forEach((tile, i) => {
    tile.src = state.tileUrls[i] || "";
  });
  return state.tileUrls.some(Boolean);
}

function armGridPan(img) {
  ensureGrid();
  const cell = gridEl.querySelector(".cell");
  if (!cell || !img) return;
  const cr = cell.clientWidth / Math.max(1, cell.clientHeight);
  const ir = img.naturalWidth / img.naturalHeight;
  const axis = !ir || !cr || Math.abs(ir - cr) < 0.06 ? "" : ir > cr ? "pan-x" : "pan-y";
  gridEl.querySelectorAll(".tile").forEach((tile) => {
    tile.classList.remove("pan-x", "pan-y");
    tile.style.animationDelay = "";
    tile.style.animationDirection = "";
    void tile.offsetWidth;
    if (axis) tile.classList.add(axis);
  });
}

function hideGrid() {
  gridEl.classList.remove("on");
  toolsEl.classList.remove("on-grid");
}

function showGrid(img) {
  gridEl.classList.add("on");
  toolsEl.classList.add("on-grid");
  requestAnimationFrame(() => armGridPan(img));
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
      onDone("", null, false);
      return;
    }
    const url = urls[i];
    i += 1;
    const attempt = (cors) => {
      const img = new Image();
      if (cors) img.crossOrigin = "anonymous";
      img.referrerPolicy = "no-referrer";
      const timer = setTimeout(() => {
        img.onload = img.onerror = null;
        img.src = "";
        if (cors) attempt(false);
        else tryNext();
      }, 15000);
      img.onload = () => {
        clearTimeout(timer);
        onDone(url, img, cors);
      };
      img.onerror = () => {
        clearTimeout(timer);
        if (cors) attempt(false);
        else tryNext();
      };
      img.src = url;
    };
    attempt(true);
  };
  tryNext();
}

function show(work) {
  if (!work) return;
  const token = (state.token += 1);
  slide.classList.remove("on", "pan-x", "pan-y");
  hideGrid();
  renderIntro(work);
  renderChrome();
  loadSlide(sources(work), async (url, img, cors) => {
    if (token !== state.token) return;
    state.lastImg = img;
    if (url) thumb.src = url;
    let grid = false;
    if (cors && img && mosaicOn() && isLowRes(img, work)) {
      try {
        grid = await buildTiles(img);
      } catch {
        grid = false;
      }
    } else {
      revokeTiles();
    }
    if (token !== state.token) return;
    if (grid) {
      slide.classList.remove("on", "pan-x", "pan-y");
      showGrid(img);
    } else {
      hideGrid();
      if (url) slide.src = url;
      if (img) armPan(img);
      requestAnimationFrame(() => {
        if (token === state.token) slide.classList.add("on");
      });
    }
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

function toggleMosaic() {
  state.mosaic = !state.mosaic;
  localStorage.setItem(STORAGE_MOSAIC, state.mosaic ? "1" : "0");
  renderMosaicBtn();
  show(current());
  restartTimer();
}

function parseFavPayload(text) {
  const ids = [];
  const push = (value) => {
    if (typeof value === "string" && value.trim()) ids.push(value.trim());
    else if (value && typeof value.id === "string" && value.id.trim()) ids.push(value.id.trim());
  };
  try {
    const raw = JSON.parse(text);
    if (Array.isArray(raw)) raw.forEach(push);
    else if (raw && Array.isArray(raw.ids)) raw.ids.forEach(push);
  } catch {
    for (const line of text.split(/[\s,;]+/)) push(line);
  }
  return [...new Set(ids)];
}

function exportFavs() {
  const payload = {
    app: "standby",
    exported: new Date().toISOString(),
    ids: [...state.favIds],
  };
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "standby-likes.json";
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function importFavs(text) {
  const ids = parseFavPayload(text);
  if (!ids.length) return 0;
  for (const id of ids) state.favIds.add(id);
  saveFavs();
  if (state.mode !== "all") buildQueue();
  renderChrome();
  return ids.length;
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
mosaicBtn.addEventListener("click", toggleMosaic);
$("fav-export").addEventListener("click", exportFavs);
$("fav-import").addEventListener("click", () => favFile.click());
favFile.addEventListener("change", async () => {
  const file = favFile.files && favFile.files[0];
  favFile.value = "";
  if (!file) return;
  importFavs(await file.text());
});
modes.addEventListener("click", (event) => {
  const btn = event.target.closest("button[data-mode]");
  if (btn) setMode(btn.dataset.mode);
});

window.addEventListener("mousemove", armIdle);
let resizeTimer = 0;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (gridEl.classList.contains("on") && state.lastImg) armGridPan(state.lastImg);
    else if (slide.naturalWidth) armPan(slide);
  }, 240);
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

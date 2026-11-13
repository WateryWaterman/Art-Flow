const STORAGE_FAV = "standby.favs";
const STORAGE_FAV_LIBRARY = "standby.library";
const STORAGE_MODE = "standby.mode";
const STORAGE_MOSAIC = "standby.mosaic";
const PAN_MS = 90000;
const PAN_CYCLE = PAN_MS * 2;
const PAN_RATIO = 0.06;

const $ = (id) => document.getElementById(id);

const slide = $("slide");
const favBtn = $("fav");
const favIo = $("fav-io");
const listEl = $("list");
const modes = $("modes");
const mosaicBtn = $("mosaic");
const gridEl = $("grid");
const thumb = $("intro-thumb");
const thumbLink = $("intro-thumb-link");
const toolsEl = $("intro-tools");
const favFile = $("fav-file");
const chromeEl = $("chrome");
const introEl = $("intro");

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
  frame: null,
  shownId: null,
  noCorsHosts: [],
  token: 0,
  panTime: null,
  heldSurface: null,
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
  favBtn.textContent = isFav(work) ? "已收藏" : "收藏";
  favBtn.setAttribute("aria-pressed", isFav(work) ? "true" : "false");
  favIo.hidden = state.mode !== "fav";
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
  const title = decode(work.title);
  const changed = $("intro-title").textContent !== title;
  $("intro-kicker").textContent = [work.year, work.source].filter(Boolean).join("  ·  ");
  $("intro-title").textContent = title;
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
  if (changed) {
    const copy = introEl.querySelector(".intro-copy");
    if (copy) copy.scrollTop = 0;
  }
}

function mosaicOn() {
  return state.mosaic;
}

function renderMosaicBtn() {
  mosaicBtn.setAttribute("aria-pressed", mosaicOn() ? "true" : "false");
  mosaicBtn.textContent = mosaicOn() ? "低清拼合 開" : "低清拼合 關";
}

function discardUrls(urls) {
  for (const url of urls || []) {
    if (url) URL.revokeObjectURL(url);
  }
}

function publishTileUrls(urls) {
  const next = urls || [];
  const previous = state.tileUrls;
  state.tileUrls = next;
  for (const url of previous) {
    if (url && !next.includes(url)) URL.revokeObjectURL(url);
  }
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

function bandsOf(img) {
  const maxEdge = 1400;
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const off = document.createElement("canvas");
  off.width = w;
  off.height = h;
  const ctx = off.getContext("2d", { willReadFrequently: true, alpha: false });
  ctx.drawImage(img, 0, 0, w, h);
  const base = ctx.getImageData(0, 0, w, h);
  const d = base.data;
  const bands = new Uint8Array(w * h);
  for (let p = 0, i = 0; p < bands.length; p += 1, i += 4) {
    const y = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    bands[p] = y < 78 ? 0 : y < 168 ? 1 : 2;
  }
  return { ctx, w, h, bands };
}

function paintPalette(sheet, palette) {
  const { ctx, w, h, bands } = sheet;
  const pixels = ctx.createImageData(w, h);
  const d = pixels.data;
  for (let p = 0, i = 0; p < bands.length; p += 1, i += 4) {
    const c = palette[bands[p]];
    d[i] = c[0];
    d[i + 1] = c[1];
    d[i + 2] = c[2];
    d[i + 3] = 255;
  }
  ctx.putImageData(pixels, 0, 0);
  return new Promise((resolve) => {
    ctx.canvas.toBlob((blob) => resolve(blob || null), "image/jpeg", 0.88);
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

function sources(work) {
  const list = [work.image, work.imageHi];
  return [...new Set(list.filter((url) => typeof url === "string" && url.length > 8))];
}

let ahead = null;

function allowsCors(url) {
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    return true;
  }
  return !state.noCorsHosts.includes(host);
}

function startLoad(url, cors) {
  return new Promise((resolve) => {
    const img = new Image();
    if (cors) img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      img.onload = null;
      img.onerror = null;
      if (!ok) {
        img.src = "";
        resolve(null);
        return;
      }
      resolve({ url, img, cors });
    };
    const timer = setTimeout(() => finish(false), 15000);
    img.onload = () => finish(true);
    img.onerror = () => finish(false);
    img.src = url;
  });
}

function claimLoad(url, cors) {
  if (ahead && ahead.url === url && ahead.cors === cors) {
    const job = ahead.promise;
    ahead = null;
    return job;
  }
  return startLoad(url, cors);
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
    const run = (cors) => {
      claimLoad(url, cors).then((hit) => {
        if (hit) {
          onDone(hit.url, hit.img, hit.cors);
          return;
        }
        if (cors) run(false);
        else tryNext();
      });
    };
    run(allowsCors(url));
  };
  tryNext();
}

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

function opacityOf(el) {
  return parseFloat(getComputedStyle(el).opacity) || 0;
}

function findPan(el) {
  if (!el || !el.getAnimations) return null;
  return el.getAnimations().find((anim) => anim.id === "pan") || null;
}

function panCycle(ms) {
  if (!Number.isFinite(ms)) return null;
  return ((ms % PAN_CYCLE) + PAN_CYCLE) % PAN_CYCLE;
}

function readPanTimeFrom(nodes) {
  for (const el of nodes) {
    const anim = findPan(el);
    if (!anim || anim.currentTime == null) continue;
    const time = panCycle(Number(anim.currentTime));
    if (time != null) return time;
  }
  return null;
}

function activeNodes() {
  if (gridEl.classList.contains("on")) return [...gridEl.querySelectorAll(".tile")];
  if (slide.classList.contains("on")) return [slide];
  return [];
}

// Freeze the crop that is on screen and keep its pan clock. Removing the
// animation without this matrix snaps the picture back to the centered cover.
function holdVisiblePan() {
  const nodes = activeNodes();
  if (!nodes.length) return state.panTime;
  const time = readPanTimeFrom(nodes);
  for (const el of nodes) {
    const anim = findPan(el);
    const frozen = getComputedStyle(el).transform;
    if (!frozen || frozen === "none") continue;
    if (anim) anim.cancel();
    el.style.transform = frozen;
  }
  state.panTime = time;
  return time;
}

function whenBlack(el) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      if (opacityOf(el) > 0.02) return;
      settled = true;
      el.removeEventListener("transitionend", onEnd);
      clearTimeout(timer);
      resolve();
    };
    const onEnd = (event) => {
      if (event.target === el && event.propertyName === "opacity") finish();
    };
    el.addEventListener("transitionend", onEnd);
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      el.removeEventListener("transitionend", onEnd);
      resolve();
    }, 1600);
  });
}

async function fadeToBlack(token) {
  const jobs = [];
  for (const el of [slide, gridEl]) {
    if (opacityOf(el) <= 0.02) {
      el.classList.remove("on");
      continue;
    }
    const job = whenBlack(el);
    el.classList.remove("on");
    jobs.push(job);
  }
  await Promise.all(jobs);
  const start = performance.now();
  while (
    token === state.token &&
    (opacityOf(slide) > 0.02 || opacityOf(gridEl) > 0.02) &&
    performance.now() - start < 2000
  ) {
    await nextFrame();
  }
  if (token !== state.token) return;
  if (opacityOf(slide) > 0.02) slide.style.opacity = "0";
  if (opacityOf(gridEl) > 0.02) gridEl.style.opacity = "0";
}

function panMetrics(img, boxW, boxH) {
  const iw = img?.naturalWidth || img?.w || 0;
  const ih = img?.naturalHeight || img?.h || 0;
  if (!iw || !ih || boxW < 2 || boxH < 2) return null;
  const ir = iw / ih;
  const br = boxW / boxH;
  if (!Number.isFinite(ir) || !Number.isFinite(br) || Math.abs(ir - br) < PAN_RATIO) return null;
  if (ir > br) {
    const h = boxH + 2;
    const w = Math.ceil((iw * h) / ih);
    return { axis: "x", w, h, to: boxW - w };
  }
  const w = boxW + 2;
  const h = Math.ceil((ih * w) / iw);
  return { axis: "y", w, h, to: boxH - h };
}

function clearLayout(el) {
  el.style.inset = "";
  el.style.top = "";
  el.style.left = "";
  el.style.width = "";
  el.style.height = "";
  el.style.objectFit = "";
  el.style.transform = "";
}

function applyLayout(el, metrics) {
  if (!metrics) {
    clearLayout(el);
    return;
  }
  el.style.inset = "auto";
  el.style.top = "0px";
  el.style.left = "0px";
  el.style.width = `${metrics.w}px`;
  el.style.height = `${metrics.h}px`;
  el.style.objectFit = "fill";
}

function cancelPan(el) {
  if (!el?.getAnimations) return;
  for (const anim of [...el.getAnimations()]) {
    if (anim.id === "pan") anim.cancel();
  }
  el.style.transform = "";
}

function playPan(el, metrics, time) {
  cancelPan(el);
  const keyframes =
    metrics.axis === "x"
      ? [
          { transform: "translate3d(0, 0, 0)" },
          { transform: `translate3d(${metrics.to}px, 0, 0)` },
        ]
      : [
          { transform: "translate3d(0, 0, 0)" },
          { transform: `translate3d(0, ${metrics.to}px, 0)` },
        ];
  const anim = el.animate(keyframes, {
    duration: PAN_MS,
    iterations: Infinity,
    direction: "alternate",
    easing: "linear",
    fill: "both",
    id: "pan",
  });
  const applyTime = () => {
    if (time == null || !Number.isFinite(time)) return;
    try {
      anim.currentTime = time;
    } catch {
      /* the clock stays at the start edge */
    }
  };
  applyTime();
  return anim.ready.then(applyTime).catch(() => {});
}

function parkElement(el) {
  el.classList.remove("on");
  el.style.visibility = "hidden";
  el.style.opacity = "";
  const nodes = el === gridEl ? [...el.querySelectorAll(".tile")] : [el];
  for (const node of nodes) {
    cancelPan(node);
    clearLayout(node);
  }
}

function loadWorkImage(work) {
  return new Promise((resolve) => {
    loadSlide(sources(work), (url, img, cors) => resolve({ url, img, cors }));
  });
}

async function colorizeUrls(img) {
  const sheet = bandsOf(img);
  const urls = [];
  for (const palette of PALETTES) {
    const blob = await paintPalette(sheet, palette);
    urls.push(blob ? URL.createObjectURL(blob) : "");
  }
  return urls;
}

async function prepareFrame(work, loaded, token) {
  const { url, img, cors } = loaded;
  if (!img || !url) return null;
  if (!(cors && mosaicOn() && isLowRes(img, work))) {
    return { mode: "slide", url, img, urls: null };
  }
  try {
    const urls = await colorizeUrls(img);
    if (token !== state.token) {
      discardUrls(urls);
      return null;
    }
    if (!urls.some(Boolean)) {
      discardUrls(urls);
      return { mode: "slide", url, img, urls: null };
    }
    return { mode: "grid", url, img, urls };
  } catch {
    return { mode: "slide", url, img, urls: null };
  }
}

function setImgSrc(img, url, token) {
  if (!url || token !== state.token) return Promise.resolve(false);
  let abs = url;
  try {
    abs = new URL(url, window.location.href).href;
  } catch {
    /* keep the raw url */
  }
  if (img.src === abs && img.complete && img.naturalWidth) return Promise.resolve(true);
  return new Promise((resolve) => {
    const done = (ok) => {
      img.removeEventListener("load", onLoad);
      img.removeEventListener("error", onError);
      resolve(ok);
    };
    const onLoad = () => done(true);
    const onError = () => done(false);
    img.addEventListener("load", onLoad);
    img.addEventListener("error", onError);
    if (token !== state.token) {
      done(false);
      return;
    }
    img.src = url;
  });
}

function seekPan(el, time) {
  const anim = findPan(el);
  if (!anim || time == null || !Number.isFinite(time)) return;
  try {
    anim.currentTime = time;
  } catch {
    /* a cancelled clock is left untouched */
  }
}

function resumeHeld(panTime) {
  const which = state.heldSurface;
  if (which === "grid") {
    gridEl.style.visibility = "visible";
    const cell = gridEl.querySelector(".cell");
    const metrics = cell ? panMetrics(state.frame, cell.clientWidth, cell.clientHeight) : null;
    gridEl.querySelectorAll(".tile").forEach((tile) => {
      applyLayout(tile, metrics);
      if (metrics) playPan(tile, metrics, panTime);
      else tile.style.transform = "";
    });
    gridEl.style.opacity = "";
    gridEl.classList.add("on");
    return;
  }
  if (which !== "slide") return;
  slide.style.visibility = "visible";
  const stage = $("stage");
  const metrics = panMetrics(state.frame, stage.clientWidth, stage.clientHeight);
  applyLayout(slide, metrics);
  if (metrics) playPan(slide, metrics, panTime);
  else slide.style.transform = "";
  slide.style.opacity = "";
  slide.classList.add("on");
}

async function mountSlide(prep, panTime, token) {
  slide.style.visibility = "visible";
  const ok = await setImgSrc(slide, prep.url, token);
  if (!ok || token !== state.token) return false;
  parkElement(gridEl);
  toolsEl.classList.remove("on-grid");
  const stage = $("stage");
  const metrics = panMetrics(prep.img, stage.clientWidth, stage.clientHeight);
  applyLayout(slide, metrics);
  if (metrics) await playPan(slide, metrics, panTime);
  else cancelPan(slide);
  return token === state.token;
}

async function mountGrid(prep, panTime, token) {
  ensureGrid();
  gridEl.style.visibility = "visible";
  const tiles = [...gridEl.querySelectorAll(".tile")];
  const loaded = await Promise.all(tiles.map((tile, i) => setImgSrc(tile, prep.urls[i] || "", token)));
  if (token !== state.token) {
    discardUrls(prep.urls);
    prep.urls = null;
    return false;
  }
  if (!loaded.some(Boolean)) {
    discardUrls(prep.urls);
    prep.urls = null;
    return false;
  }
  const cell = gridEl.querySelector(".cell");
  const metrics = panMetrics(prep.img, cell.clientWidth, cell.clientHeight);
  parkElement(slide);
  toolsEl.classList.add("on-grid");
  publishTileUrls(prep.urls);
  prep.urls = null;
  const pending = [];
  tiles.forEach((tile) => {
    applyLayout(tile, metrics);
    if (metrics) pending.push(playPan(tile, metrics, panTime));
    else cancelPan(tile);
  });
  await Promise.all(pending);
  return token === state.token;
}

async function present(work, prep, panTime, token) {
  if (opacityOf(slide) > 0.02 || opacityOf(gridEl) > 0.02) {
    await fadeToBlack(token);
    if (token !== state.token) return false;
  }
  const clock = panTime;
  const ok =
    prep.mode === "grid" ? await mountGrid(prep, clock, token) : await mountSlide(prep, clock, token);
  if (!ok || token !== state.token) return false;
  state.frame = { w: prep.img?.naturalWidth || 0, h: prep.img?.naturalHeight || 0 };
  state.shownId = work.id;
  state.heldSurface = prep.mode === "grid" ? "grid" : "slide";
  state.panTime = clock;
  prep.img = null;
  // The thumb uses the slide URL. A smaller file would be a second download, and the full-screen decode would remain.
  if (prep.url) thumb.src = prep.url;
  renderIntro(work);
  renderChrome();
  const root = prep.mode === "grid" ? gridEl : slide;
  root.style.opacity = "";
  await nextFrame();
  await nextFrame();
  if (token !== state.token) return false;
  const nodes = prep.mode === "grid" ? [...gridEl.querySelectorAll(".tile")] : [slide];
  for (const node of nodes) seekPan(node, clock);
  root.classList.add("on");
  preload(1);
  return true;
}

function relayoutVisible() {
  if (!state.frame?.w) return;
  if (gridEl.classList.contains("on")) {
    const cell = gridEl.querySelector(".cell");
    if (!cell) return;
    const tiles = [...gridEl.querySelectorAll(".tile")];
    const time = readPanTimeFrom(tiles);
    const metrics = panMetrics(state.frame, cell.clientWidth, cell.clientHeight);
    tiles.forEach((tile) => {
      applyLayout(tile, metrics);
      if (metrics) playPan(tile, metrics, time);
      else cancelPan(tile);
    });
    return;
  }
  if (!slide.classList.contains("on")) return;
  const time = readPanTimeFrom([slide]);
  const stage = $("stage");
  const metrics = panMetrics(state.frame, stage.clientWidth, stage.clientHeight);
  applyLayout(slide, metrics);
  if (metrics) playPan(slide, metrics, time);
  else cancelPan(slide);
}

async function show(work) {
  if (!work) return;
  const token = (state.token += 1);
  if (gridEl.classList.contains("on")) state.heldSurface = "grid";
  else if (slide.classList.contains("on")) state.heldSurface = "slide";
  const panTime = holdVisiblePan();
  const black = fadeToBlack(token);
  const loading = loadWorkImage(work);
  await nextFrame();
  if (token !== state.token) return;
  const loaded = await loading;
  if (token !== state.token) {
    releaseLoad(loaded);
    return;
  }
  const prep = await prepareFrame(work, loaded, token);
  await black;
  if (token !== state.token) {
    discardUrls(prep?.urls);
    releaseLoad(loaded);
    if (prep) prep.img = null;
    return;
  }
  if (!prep) {
    releaseLoad(loaded);
    if (!restoreShown(panTime)) {
      resumeHeld(panTime);
      renderIntro(work);
      renderChrome();
    }
    return;
  }
  const shown = await present(work, prep, panTime, token);
  releaseLoad(loaded);
  prep.img = null;
  if (token !== state.token) {
    discardUrls(prep?.urls);
    return;
  }
  if (!shown) {
    discardUrls(prep?.urls);
    if (!restoreShown(panTime)) resumeHeld(panTime);
  }
}

function releaseLoad(loaded) {
  if (loaded) loaded.img = null;
}

function restoreShown(panTime) {
  const work = state.shownId ? lookup(state.shownId) : null;
  if (!work) return false;
  const i = state.queue.findIndex((item) => item.id === work.id);
  if (i >= 0) state.index = i;
  resumeHeld(panTime);
  renderIntro(work);
  renderChrome();
  return true;
}

function preload(offset) {
  const work = state.queue[(state.index + offset) % state.queue.length];
  if (!work) return;
  const url = sources(work)[0];
  if (!url) return;
  const cors = allowsCors(url);
  if (ahead && ahead.url === url && ahead.cors === cors) return;
  ahead = { url, cors, promise: startLoad(url, cors) };
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
  a.download = "standby-favs.json";
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
  state.timer = null;
  if (document.hidden) return;
  state.timer = setInterval(() => {
    if (document.hidden) return;
    go(1);
  }, state.interval);
}

function armIdle() {
  document.body.classList.remove("idle");
  clearTimeout(state.idle);
  state.idle = setTimeout(() => document.body.classList.add("idle"), 2000);
}

function blurInside(root) {
  const active = document.activeElement;
  if (active && root.contains(active) && typeof active.blur === "function") {
    active.blur();
  }
}

function armOverlay(root) {
  if (!root) return;
  root.addEventListener("mouseleave", () => blurInside(root));
  root.addEventListener("pointerup", (event) => {
    if (event.pointerType !== "mouse" && event.pointerType !== "touch" && event.pointerType !== "pen") {
      return;
    }
    requestAnimationFrame(() => blurInside(root));
  });
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
  state.noCorsHosts = Array.isArray(data.noCorsHosts)
    ? data.noCorsHosts.filter((host) => typeof host === "string" && host)
    : [];
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
armOverlay(chromeEl);
armOverlay(introEl);
armOverlay($("prev"));
armOverlay($("next"));

window.addEventListener("mousemove", armIdle);
document.addEventListener("visibilitychange", () => restartTimer());
let resizeTimer = 0;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(relayoutVisible, 240);
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

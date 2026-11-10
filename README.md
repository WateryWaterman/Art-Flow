# Standby

Open the page, press **F11**, and the browser becomes a fullscreen standby board. It behaves like a screensaver: one design work at a time, filling the screen, advancing on its own. Hover the top edge to **Like** a work so you can keep watching it after the weekly push changes.

The author replaces the current push with a new set of works each week. Likes are stored as unique ids in this browser. Closing the tab drops the images; the ids remain, and the next visit loads the works again from the repo.

This is a static GitHub Pages site. There is no account, no backend, and no images in git.

For the weekly replacement playbook see [UPDATE.md](./UPDATE.md). For sources that are in use or already ruled out, see [SOURCES.md](./SOURCES.md). Locked product choices live in [DECISIONS.md](./DECISIONS.md).

---

## What you see

The picture covers the screen (`object-fit: cover`) and keeps its aspect ratio. Overflow pans slowly (Ken Burns). The cursor hides after two seconds of stillness.

Works that cannot cover 1920×1080 without upscaling — and furniture still below a 2500px long edge — can be shown as a 3×3 Warhol-style mosaic: the same image, nine palettes, paper gutters, **all nine tiles panning together**. Toggle that in the bottom intro. Default is on. The original thumbnail sits on the right of the intro so you can see the whole work without waiting for the pan.

---

## Controls

Nothing is on screen until the pointer reaches an edge.

| Place | Action |
| --- | --- |
| Left ~9vw | Previous work. Semi-transparent ink gradient and an opaque chevron. |
| Right ~9vw | Next work. |
| Top ~9vh | Empty heart + **Like** / filled heart + **Liked**. Playlist: 全部 (all) · 收藏 (likes) · 穿插 (interleave). **Export likes** / **Import likes**. The list under 全部 and 收藏 shows each title and its unique id. Click a title to jump. Click an id to copy it. |
| Bottom ~14vh | Short credit. Original thumbnail on the right — click it to open the source webpage. **低清拼合** on/off. |
| Keyboard | ← → change work. F likes / unlikes. F11 fullscreen. |

Auto-advance is **180 seconds**, set in `data/catalog.json` as `intervalSeconds`.

---

## Unique ids, catalog, archive, likes

Every work has one stable id, written next to its metadata in this same repository.

| Layer | Where | Who writes it | What it holds |
| --- | --- | --- | --- |
| Current push | `data/catalog.json` | Weekly update (script or hand) | The 32–36 works on the board now, each with id, title, image URL, source page, license, intro |
| Past + current | `data/archive.json` | Merge-only, never delete | Full metadata for every work that has ever been pushed, so an old Like still resolves |
| Likes | Browser `localStorage` key `standby.favs` | Only the Like heart | An array of ids. No images. No full cards |

Lookup order: current catalog, then archive. A liked work that left the weekly push still plays if its row remains in `archive.json`.

Id shapes:

- Cleveland: `cma-{artworkId}` example `cma-129201`
- V&A: `va-{systemNumber}` example `va-O7878`
- Wikimedia Commons: `commons-{pageid}` example `commons-73392906`

The 全部 list is the practical index for a weekly swap: title + id in one row, id copied on click, metadata one grep away in `data/catalog.json` / `data/archive.json`.

### Cache contract

On close, mosaic blob URLs are discarded with the page. Images are hotlinked and are not written to `localStorage`, IndexedDB, or the Cache API. What stays:

- `standby.favs` — liked ids
- `standby.mode` — all / fav / mix
- `standby.mosaic` — mosaic toggle (`"0"` means off; missing means on)

A cleared browser profile wipes likes. **Export likes** downloads `standby-likes.json`. **Import likes** merges that file (JSON `{ "ids": [...] }`, a JSON array, or a newline/comma list) back into `standby.favs`.

---

## Project layout

```
index.html                 page shell and chrome labels
styles.css                 paper/ink layout, pan, mosaic grid, heart, list
app.js                     queue, like, mosaic, lookup, export/import
data/catalog.json          current push
data/archive.json          union of every push
scripts/build_catalog.py   fetch + curate + merge archive
scripts/fetch_media.py     optional local JPEGs into media/ (do not commit)
.github/workflows/refresh-catalog.yml
                           weekly URL refresh of the current pin lists
DECISIONS.md               locked choices
UPDATE.md                  how a new agent replaces the whole push
SOURCES.md                 usable and excluded source sites (keep in sync)
README.md                  this file
```

Local preview:

```bash
python -m http.server 5173
```

Open http://127.0.0.1:5173/

---

## Changing the pictures

Do not drop files into git. Edit metadata and pins, then let the page hotlink museum / Commons JPEGs.

1. Read [UPDATE.md](./UPDATE.md) and [SOURCES.md](./SOURCES.md) before searching.
2. Collect every id already in `data/archive.json`. New works must not reuse those ids.
3. Change the pin lists and search queries in `scripts/build_catalog.py` (`CMA_PINNED`, `VAM_PINNED`, `BUILDINGS`, `queries`, `DROP`, `WANT`).
4. Run `python scripts/build_catalog.py`. Target **32–36** works. Architecture ≤ 6. Furniture ≤ 14 and ≤ 2 per maker family. Rest posters / type / graphic / textile.
5. Confirm 全部 lists the new ids, thumbnails open `sourceUrl`, and likes still resolve through archive.
6. Commit `data/catalog.json`, `data/archive.json`, and the pin changes. If you added or dropped a source, edit `SOURCES.md` in the same change.

### Catalog record

Each work in `catalog.json` / `archive.json` needs:

| Field | Role |
| --- | --- |
| `id` | Stable unique mark. Never recycle an old id for a different work. |
| `title`, `maker`, `year`, `medium` | Intro heading and lede |
| `source` | Museum / Commons name in the kicker |
| `sourceId` | Upstream object id |
| `sourceUrl` | Collection page. The intro thumbnail opens this. |
| `image`, `imageHi` | Hotlink JPEG. Commons `Special:FilePath/…?width=1920`. V&A framemark `!1920`. Cleveland `print` JPEG. |
| `license`, `credit` | Citation line |
| `intro` | Bottom body copy |
| `tags` | Mix filters (`cleveland`, `vam`, `commons`, object type) |

Architecture titles, architects, years, and intros are overwritten from the `BUILDINGS` table in `build_catalog.py` when the filename/description matches. Change that table to change those six buildings.

### Where each on-screen string lives

| On screen | Edit here |
| --- | --- |
| 全部 / 收藏 / 穿插 | `index.html` `#modes` |
| Like / Liked, heart | `index.html` `#fav`, labels in `app.js` `renderChrome` |
| Export likes / Import likes | `index.html` `.chrome-io` |
| Unique id under each title | `app.js` `renderChrome` (reads `work.id`) |
| 低清拼合 開 / 關 | `app.js` `renderMosaicBtn` |
| Title, maker, year, intro, credit | `data/catalog.json` (and archive). Architecture intros: `BUILDINGS` in `scripts/build_catalog.py` |
| Auto-advance seconds | `data/catalog.json` `intervalSeconds` |
| Paper / ink / pan / mosaic gutters | `styles.css` |
| Queue, like storage, mosaic trigger | `app.js` |

Allowed reuse: CC BY / CC BY-SA / CC BY-NC / CC0 / public domain, plus V&A non-commercial with attribution. No Remedy assets. No living-designer shop photos. No Aalto furniture (still in copyright in the EU). Building façades are fine.

If a source is added, dropped, or blocked, update [SOURCES.md](./SOURCES.md) in the same change. Future searchers start there.

---

## 中文

打開網頁，按 **F11** 進入全螢幕待機頁。它可以像螢幕保護程式一樣使用：每次一件設計作品，舖滿畫面，自己往前切。滑鼠移到頂部，空心愛心是 **Like**，點過之後變成實心 **Liked**，方便在每週換推送之後繼續看喜歡的作品。

作者每週會把現在這一批作品整批換成新的。收藏只在這台瀏覽器裡存唯一標記。關掉頁面會丟掉圖片；標記還在，下次進來再從倉庫載入。

這是靜態 GitHub Pages，沒有帳號，沒有後端，圖片不進 git。

每週整批替換看 [UPDATE.md](./UPDATE.md)。用過和排除過的來源看 [SOURCES.md](./SOURCES.md)。已拍板的選擇看 [DECISIONS.md](./DECISIONS.md)。

### 畫面

作品舖滿螢幕、比例不變，多出來的邊會慢速平移。達不到 1080p 的圖（以及長邊仍低於 2500px 的家具）可做成九宮格：同一張圖九種配色，格間留紙色，**九格齊步平移**。底部簡介可關，預設開。簡介右側是原圖縮略圖，點它打開來源網頁。

### 操作

| 位置 | 行為 |
| --- | --- |
| 左緣 | 上一件。半透明漸層與不透明尖括號 |
| 右緣 | 下一件 |
| 頂部 | 空心／實心愛心 Like / Liked；全部 · 收藏 · 穿插；Export likes / Import likes。列表同時顯示標題與唯一標記，點標題跳轉，點標記複製 |
| 底部 | 短介紹、右側縮略圖（點進來源頁）、低清拼合 |
| 鍵盤 | ← → 切頁，F 喜歡，F11 全螢幕 |

自動切換 180 秒，寫在 `data/catalog.json` 的 `intervalSeconds`。

### 倉庫與唯一標記

唯一標記和對應元數據在同一個倉庫裡。

- 現在推送：`data/catalog.json`
- 過往加現在：`data/archive.json`（只增不刪）
- 喜歡：瀏覽器 `standby.favs`，只存 id

對回順序：先 catalog，再 archive。關頁不存圖。清掉瀏覽器資料會丟掉喜歡清單，所以可以匯出／匯入 `standby-likes.json`。

點「全部」列出的每一行都帶 id，改推送時用這個標記在 `catalog.json` / `archive.json` / `scripts/build_catalog.py` 的 pinned 清單裡對位。

### 若要改圖片

先讀 UPDATE 與 SOURCES。新作品的 id 不得已在 archive 裡出現過。改 `scripts/build_catalog.py` 的 pinned 與查詢，跑腳本，目標 32–36 件。建築最多 6，家具最多 14、同一作者家族最多 2。畫面文案對應位置見上方英文表。來源有增刪時必須同步改 `SOURCES.md`。

# Art Flow

Live: https://waterywaterman.github.io/Art-Flow/

Open the page, press **F11**, and the browser becomes a fullscreen standby board. It behaves like a screensaver: one design work at a time, filling the screen, advancing on its own. Hover the top edge to **收藏** a work so you can keep watching it after the weekly push changes.

The author replaces the current push with a new set of works each week. Favourites are stored as unique ids in this browser. Closing the tab drops the images; the ids remain, and the next visit loads the works again from the repo.

This is a static GitHub Pages site (`WateryWaterman/Art-Flow`). There is no account, no backend, and no images in git.

For the weekly replacement playbook see [UPDATE.md](./UPDATE.md). For sources that are in use or already ruled out, see [SOURCES.md](./SOURCES.md). Locked product choices live in [DECISIONS.md](./DECISIONS.md).

---

## What you see

The picture covers the screen (`object-fit: cover`) and keeps its aspect ratio. Overflow pans slowly (Ken Burns). The cursor hides after two seconds of stillness.

Works that cannot cover 1920×1080 without upscaling — and furniture still below a 2500px long edge — can be shown as a 3×3 Warhol-style mosaic: the same image, nine palettes, paper gutters, **all nine tiles panning together**. Toggle that in the bottom intro. Default is on. The original thumbnail sits on the right of the intro so you can see the whole work without waiting for the pan.

Switching always dims through the black stage in 0.9s, for photographs and for the mosaic. The next picture is not swapped in until the current one has faded out, so a cached high-res pair does not flash-cut.

---

## Controls

Nothing is on screen until the pointer reaches an edge.

| Place | Action |
| --- | --- |
| Left ~9vw | Previous work. Semi-transparent ink gradient and an opaque chevron. |
| Right ~9vw | Next work. |
| Top ~9vh | 收藏 / 已收藏. Playlist: 全部 · 收藏 · 穿插. After opening the 收藏 playlist, **導出** and **導入** appear to the right of the left-hand 收藏, as the same kind of control. The list under 全部 shows every work in the current push (titles only). |
| Bottom ~14vh | Short credit. Original thumbnail on the right — click it to open the source webpage. **低清拼合** on/off. |
| Keyboard | ← → change work. F 收藏 / 取消收藏. F11 fullscreen. |

Auto-advance is **180 seconds**, set in `data/catalog.json` as `intervalSeconds`.

---

## Unique ids, catalog, archive, likes

Every work has one stable id, stored next to its metadata in this same repository. Ids are an editing protocol; they are not shown on the board.

| Layer | Where | Who writes it | What it holds |
| --- | --- | --- | --- |
| Current push | `data/catalog.json` | Weekly update (script or hand) | The works on the board now (this snapshot is 40; weekly replacement target is 32–36), each with id, title, image URL, source page, license, intro |
| Past + current | `data/archive.json` | Merge-only, never delete | Full metadata for every work that has ever been pushed, so an old favourite still resolves |
| Favourites | Browser `localStorage` key `standby.favs` | Only the 收藏 control | An array of ids. No images. No full cards |

Lookup order: current catalog, then archive. A liked work that left the weekly push still plays if its row remains in `archive.json`.

Id shapes:

- Cleveland: `cma-{artworkId}` example `cma-129201`
- V&A: `va-{systemNumber}` example `va-O7878`
- Wikimedia Commons: `commons-{pageid}` example `commons-73392906`

The 全部 list is the on-screen index of the current push (every title). For a weekly swap, grep the id in `data/catalog.json` / `data/archive.json` / the pin lists in `scripts/build_catalog.py`.

### Cache contract

On close, mosaic blob URLs are discarded with the page. Images are hotlinked and are not written to `localStorage`, IndexedDB, or the Cache API. What stays:

- `standby.favs` — liked ids
- `standby.mode` — all / fav / mix
- `standby.mosaic` — mosaic toggle (`"0"` means off; missing means on)

A cleared browser profile wipes favourites. Open the 收藏 playlist, then **導出** downloads `standby-favs.json`. **導入** merges that file (JSON `{ "ids": [...] }`, a JSON array, or a newline/comma list) back into `standby.favs`.

---

## Project layout

```
index.html                 page shell and chrome labels
styles.css                 paper/ink layout, pan, mosaic grid, list
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
5. Confirm 全部 lists every new title, thumbnails open `sourceUrl`, and favourites still resolve through archive.
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
| 收藏 / 已收藏 | `app.js` `renderChrome` |
| 導出 / 導入 | `index.html` `#fav-io`, shown when the 收藏 playlist is active |
| 低清拼合 開 / 關 | `app.js` `renderMosaicBtn` |
| Title, maker, year, intro, credit | `data/catalog.json` (and archive). Architecture intros: `BUILDINGS` in `scripts/build_catalog.py` |
| Auto-advance seconds | `data/catalog.json` `intervalSeconds` |
| Paper / ink / pan / mosaic gutters | `styles.css` |
| Queue, like storage, mosaic trigger | `app.js` |

Allowed reuse: CC BY / CC BY-SA / CC BY-NC / CC0 / public domain, plus V&A non-commercial with attribution. No Remedy assets. No living-designer shop photos. No Aalto furniture (still in copyright in the EU). Building façades are fine.

If a source is added, dropped, or blocked, update [SOURCES.md](./SOURCES.md) in the same change. Future searchers start there.

---

## 中文

線上：https://waterywaterman.github.io/Art-Flow/

打開網頁，按 **F11** 進入全螢幕待機頁。它可以像螢幕保護程式一樣使用：每次一件設計作品，舖滿畫面，自己往前切。滑鼠移到頂部可以 **收藏** 作品，方便在每週換推送之後繼續看。

作者每週會把現在這一批作品整批換成新的。收藏只在這台瀏覽器裡存唯一標記。關掉頁面會丟掉圖片；標記還在，下次進來再從倉庫載入。

這是靜態 GitHub Pages，沒有帳號，沒有後端，圖片不進 git。

每週整批替換看 [UPDATE.md](./UPDATE.md)。用過和排除過的來源看 [SOURCES.md](./SOURCES.md)。已拍板的選擇看 [DECISIONS.md](./DECISIONS.md)。

### 畫面

作品舖滿螢幕、比例不變，多出來的邊會慢速平移。達不到 1080p 的圖（以及長邊仍低於 2500px 的家具）可做成九宮格：同一張圖九種配色，格間留紙色，**九格齊步平移**。底部簡介可關，預設開。簡介右側是原圖縮略圖，點它打開來源網頁。切換時原圖與九宮格都先在 0.9 秒內暗到黑底，暗完再換下一張，避免緩存裡的高清圖閃切。

### 操作

| 位置 | 行為 |
| --- | --- |
| 左緣 | 上一件。半透明漸層與不透明尖括號 |
| 右緣 | 下一件 |
| 頂部 | 收藏／已收藏；全部 · 收藏 · 穿插。點播放清單的「收藏」後，左側收藏右邊出現導出、導入。全部列表列出當前推送的每一件（只顯示標題） |
| 底部 | 短介紹、右側縮略圖（點進來源頁）、低清拼合 |
| 鍵盤 | ← → 切頁，F 收藏，F11 全螢幕 |

自動切換 180 秒，寫在 `data/catalog.json` 的 `intervalSeconds`。

### 倉庫與唯一標記

唯一標記和對應元數據在同一個倉庫裡，不畫在畫面上。

- 現在推送：`data/catalog.json`
- 過往加現在：`data/archive.json`（只增不刪）
- 收藏：瀏覽器 `standby.favs`，只存 id

對回順序：先 catalog，再 archive。關頁不存圖。清掉瀏覽器資料會丟掉收藏清單，所以在收藏播放清單裡可以導出／導入 `standby-favs.json`。

點「全部」會列出當前推送的每一件標題。改推送時用倉庫裡的 id 在 `catalog.json` / `archive.json` / `scripts/build_catalog.py` 的 pinned 清單裡對位。

### 若要改圖片

先讀 UPDATE 與 SOURCES。新作品的 id 不得在 archive 裡出現過。改 `scripts/build_catalog.py` 的 pinned 與查詢，跑腳本，目標 32–36 件。建築最多 6，家具最多 14、同一作者家族最多 2。畫面文案對應位置見上方英文表。來源有增刪時必須同步改 `SOURCES.md`。

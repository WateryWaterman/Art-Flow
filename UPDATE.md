# Weekly push replacement

Read this file first if you have no prior context. The job is to replace the **entire current push** with **32–36 new works** that do not already exist in the archive, then leave likes working.

Do not deploy to GitHub Pages unless the human asked. Local acceptance happens at `python -m http.server 5173` → http://127.0.0.1:5173/

Also read, in this order:

1. This file
2. [SOURCES.md](./SOURCES.md) — which APIs you may use, which are already dead or blocked
3. [DECISIONS.md](./DECISIONS.md) — mix, license, visual rules
4. [README.md](./README.md) — id lookup, cache, where UI copy lives

If you add, drop, or re-enable a source, edit `SOURCES.md` in the same change.

---

## What this site is

A fullscreen design screensaver. Open the page, press F11. Pictures hotlink from museums. The weekly push lives in `data/catalog.json`. Every work that has ever been pushed stays in `data/archive.json`. The browser only stores liked **ids** in `localStorage` (`standby.favs`). Closing the tab drops images. Ids survive. Export/import on the top chrome is the backup if localStorage is wiped.

You are not adding a feature. You are swapping the pictures.

---

## Hard rules

- Target **32–36** works. Prefer 34. Below 32 or above 36 is a failed update.
- **No id that already appears in `data/archive.json`.** That is how “not repeating the past” is enforced. Also skip near-duplicates: same title+maker key (`key_of` in the script).
- Architecture **≤ 6**. Composed photographs only. Long edge ≥ 1920, short edge ≥ 900. No tourist snapshots, banners, selfies, crowds.
- Furniture **≤ 14**, **≤ 2 per maker family** (thonet, hoffmann, webb, bugatti, majorelle, breuer, morris, mackmurdo, moser, …).
- The rest are posters, type, graphic design, wallpaper, textile.
- Licenses only: CC BY / CC BY-SA / CC BY-NC / CC0 / public domain, or V&A non-commercial with attribution.
- No Remedy assets. No living-designer shop photos. No Aalto furniture (EU still in copyright). Building façades are allowed.
- Images stay hotlinked. Do not commit JPEGs. Do not hammer Wikimedia (sleep ≥ 1s between Commons calls).
- `data/archive.json` is merge-only. Never delete a row. Updating a row in place is allowed when the same id gets a fresher image URL.
- Mosaic (3×3, tiles pan together) is already implemented. You do not restyle it. Sub-1080p works will use it when the toggle is on.
- UI language on the board stays as it is (收藏／已收藏, 全部 / 收藏 / 穿插, 導出 / 導入). Artwork titles stay in their original language. Unique ids stay in the repo; do not paint them on the board.

---

## Inventory before you search

```bash
python -c "import json; a=json.load(open('data/archive.json',encoding='utf-8')); c=json.load(open('data/catalog.json',encoding='utf-8')); ids=sorted({w['id'] for w in a.get('works',[])}|{w['id'] for w in c.get('works',[])}); print(len(ids)); print('\n'.join(ids))"
```

Keep that id set next to you. Every candidate you keep must be absent from it.

Also list current pins in `scripts/build_catalog.py`:

- `CMA_PINNED` — Cleveland object ids (no `cma-` prefix in the list; the script adds it)
- `VAM_PINNED` — V&A `systemNumber` values (`O…`)
- `BUILDINGS` — regex + title/maker/year/intro for Commons architecture

A full replacement means **those three lists change**. Do not keep last week’s pins and only reshuffle search leftovers.

---

## How ids and files connect

The unique mark and the metadata live in the same repo.

| You see on the page | Stored as | File |
| --- | --- | --- |
| List row under 全部 | `title` (every current push work) | `data/catalog.json` |
| List row under 收藏 for a past favourite | `id` resolved through archive | `data/archive.json` |
| Intro thumbnail click | `sourceUrl` | same record |
| Fullscreen picture | `image` / `imageHi` | same record |
| 收藏 | id appended to `standby.favs` | browser only |

Id prefixes:

| Prefix | Source | How to mint |
| --- | --- | --- |
| `cma-` | Cleveland Museum of Art | `cma-` + numeric artwork id from the Open Access API |
| `va-` | Victoria and Albert Museum | `va-` + `systemNumber` (example `va-O7878`) |
| `commons-` | Wikimedia Commons | `commons-` + File pageid |

The page lookup is `catalog.find(id)` then `archive.get(id)`. That path is already fast: both JSON files load once at boot into memory. Do not invent a second id scheme.

On the board, click **全部** and hover the top: every current push title must be listed. Ids stay in `data/` and in `CMA_PINNED` / `VAM_PINNED`. That is the weekly edit loop.

---

## Mix recipe (same spirit as the current board)

Aim near:

- Graphic (poster / lithograph / type / book jacket / wallpaper / textile): the majority
- Furniture (chair / stool / table / bench / cabinet / desk): up to 14, mixed through the graphic works, not a block of chairs
- Architecture: up to 6 international buildings with a complete composition. Current quality bar: Bauhaus Dessau, Salk Institute, Fallingwater, Pantheon oculus, Farnsworth House, Villa Savoye. Paimio was dropped because the file was 1600×1065. Ronchamp is in the building table as a spare if a ≥1920 file exists.

Do not flood Morris textiles or Thonet chairs. The script already caps maker families at 2.

---

## How to find works (operational)

Use only sources marked **usable** in [SOURCES.md](./SOURCES.md). Today that is Cleveland, V&A, and a few Commons building files.

### Cleveland (posters, some furniture, CC0)

Object: `https://openaccess-api.clevelandart.org/api/artworks/{id}`

Search: `https://openaccess-api.clevelandart.org/api/artworks/?q=poster+lithograph&cc0=1&has_image=1&limit=8`

Take `images.print.url` (about 2500px). Page URL is `url`. License CC0. Send a browser User-Agent. Cleveland CDN has no `Access-Control-Allow-Origin`; mosaic will fall back to the original picture. That is expected.

Put chosen numeric ids into `CMA_PINNED`.

### V&A (posters, type, furniture; non-commercial + attribution)

Search: `https://api.vam.ac.uk/v2/objects/search?q=…&images_exist=1&page_size=8`

Image: `https://framemark.vam.ac.uk/collections/{_primaryImageId}/full/!1920,/0/default.jpg`

Page: `https://collections.vam.ac.uk/item/{systemNumber}/`

Skip furniture dated 1940 or later, and skip Eames / Aalto / Yanagi / Knoll / living makers (`furniture_too_new`). Skip ads and junk in `DROP`.

Put chosen `systemNumber` values into `VAM_PINNED`.

### Wikimedia Commons (architecture only)

File search via the API, `iiurlwidth=1920`, then hotlink:

`https://commons.wikimedia.org/wiki/Special:FilePath/{Filename}?width=1920`

Keep a file only if `max(width,height) ≥ 1920` and `min ≥ 900`, license matches CC/PD, and the frame is a building — not a banner or a crowd. Add or rewrite a `BUILDINGS` entry so the intro uses the architect and completion year, not the photographer’s name as maker.

Sleep at least one second between Commons requests. Prefer one good file per building.

### Do not retry these without reading SOURCES.md

Finna (Cloudflare 403), Art Institute of Chicago (Referer 403), Met Search API (410), SMK posters (mostly not PD), Library of Congress WPA (≈640px), Cooper Hewitt and Finnish National Gallery (API keys).

---

## Edit the builder, then run it

1. Replace `CMA_PINNED`, `VAM_PINNED`, and `BUILDINGS` / Commons `queries` with the new set.
2. Extend `DROP` if a specific junk title keeps sneaking in. Extend `WANT` if a good title is filtered out.
3. Keep `TARGET = 34`, `TARGET_MIN = 32`, `TARGET_MAX = 36`, `ARCH_MAX = 6`, `FURN_MAX = 14`.
4. Fill-in search results already skip archive ids (pins are allowed through so a URL refresh of the *same* pins still works). For a full replacement your new pins must themselves be absent from archive.
5. Run:

```bash
python scripts/build_catalog.py
```

The script prints every id, title, year, source, and the mix counts. Read that output. If architecture > 6, furniture > 14, size outside 32–36, or any printed id was already in archive, fix the pins and run again.

`merge_archive` writes the new works into `data/archive.json` without removing old ones.

Optional, only if Wikimedia is blocking the browser: `python scripts/fetch_media.py` writes JPEGs into `media/`. Do not commit them. The page prefers a same-name local JPEG when present.

---

## Local check (required)

```bash
python -m http.server 5173
```

1. Open the page. A picture must appear. F11 is the intended viewing mode.
2. Hover top → **全部**. Every current push title must be in the list (count matches `data/catalog.json`). Spot-check three titles against the JSON — same `sourceUrl`, same `image`.
3. Click a title: the board shows that work. Ids are not on the page.
4. Hover bottom. Thumbnail is the original picture. Click it: the museum / Commons page opens.
5. 收藏 / 已收藏 toggles. `localStorage.standby.favs` is a JSON array of ids only.
6. Switch to the 收藏 playlist: favourites play, including a work that left this week’s push if it still exists in archive. **導出** and **導入** sit to the right of the left-hand 收藏.
7. 導出 downloads `standby-favs.json`. 導入 merges ids.
8. Low-res furniture (Thebes stool class) with mosaic on: 3×3, tiles pan **together**, not independently. Cleveland prints stay as the original photograph (no CORS).
9. Close the tab. Reopen. Images reload from the network. Likes are still there. There is no image blob in localStorage.

If any of those fail, fix before committing.

---

## Commit

```bash
git add data/catalog.json data/archive.json scripts/build_catalog.py
git commit -m "chore: replace weekly design catalog"
```

If sources changed:

```bash
git add SOURCES.md
```

Do not add `media/*.jpg`. Do not push Pages until the human accepts.

The GitHub Action `.github/workflows/refresh-catalog.yml` (Monday 03:17 UTC) re-runs this script against **whatever pins are in the repo**. It is a URL refresh, not a taste pass. A true weekly replacement is this document: new pins, new ids, archive merge.

---

## Record schema (write every field)

```json
{
  "id": "cma-129201",
  "title": "May Milton",
  "maker": "Henri de Toulouse-Lautrec (French, 1864–1901)",
  "year": "1895",
  "medium": "color lithograph",
  "source": "Cleveland Museum of Art",
  "sourceId": "129201",
  "sourceUrl": "https://clevelandart.org/art/1952.10",
  "image": "https://openaccess-cdn.clevelandart.org/1952.10/1952.10_print.jpg",
  "imageHi": "https://openaccess-cdn.clevelandart.org/1952.10/1952.10_print.jpg",
  "license": "CC0",
  "credit": "…tombstone…",
  "intro": "…",
  "tags": ["cleveland", "print"]
}
```

Missing `id`, `title`, `image`, or `sourceUrl` makes later likes, list edits, or thumbnail clicks fail. `intro` is the bottom paragraph; architecture intros should come from `BUILDINGS`, not raw Commons captions.

---

## Where to change UI vs catalog

You usually should not touch the page for a weekly swap.

| Need | File |
| --- | --- |
| New pictures, credits, intros | `scripts/build_catalog.py` pins + `data/catalog.json` / `archive.json` |
| Building names / architects | `BUILDINGS` in `scripts/build_catalog.py` |
| Interval | `data/catalog.json` `intervalSeconds` |
| 全部 / 收藏 / 穿插 labels | `index.html` |
| 收藏 / 已收藏 | `app.js` `renderChrome` |
| 導出 / 導入 | `index.html` `#fav-io` |
| Mosaic on/off copy | `app.js` `renderMosaicBtn` |
| Pan, gutters, list | `styles.css` |
| Lookup / like storage / mosaic trigger | `app.js` |

---

## Cache reminder

Agreed behaviour: close the page → images gone; likes remain as ids; reopen → resolve ids against catalog then archive → hotlink again. Do not add a service worker, Cache API, or IndexedDB for pictures. Export/import exists because a user can still wipe localStorage by accident.

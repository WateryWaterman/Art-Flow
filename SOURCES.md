# Artwork sources

This file is the source map for humans and for a future agent that needs to find new works. It lists what this project **uses today**, what it **tried and excluded**, and how to query the usable ones.

**If you add, drop, re-enable, or change the way a source is fetched, update this file in the same change.** Do not leave a new API in `scripts/build_catalog.py` that is missing here. Do not claim a source is usable if the last attempt is recorded as blocked below.

License rule for anything that enters `data/catalog.json`: the upstream page already allows reuse with attribution (CC BY / CC BY-SA / CC BY-NC / CC0 / public domain, or V&A non-commercial with attribution). Credit is written in the intro. This page is non-commercial learning/sharing. No Remedy Entertainment screenshots or marketing art. No shop photos of living designers. No Aalto furniture.

Hotlink JPEGs. Do not commit images.

---

## Usable now (current push)

### 1. Cleveland Museum of Art Open Access — primary graphic / some furniture

| | |
| --- | --- |
| Why | CC0, no API key, print JPEG around 2500px, stable object ids |
| Search | `https://openaccess-api.clevelandart.org/api/artworks/?q={query}&cc0=1&has_image=1&limit=8` |
| Object | `https://openaccess-api.clevelandart.org/api/artworks/{id}` |
| Image field | `images.print.url` (fallback `images.web.url`) |
| Page | `data.url` → `https://clevelandart.org/art/…` |
| Our id | `cma-{id}` |
| CORS | Print CDN sends **no** `Access-Control-Allow-Origin`. The page loads the original photograph. Mosaic is skipped. Expected. |
| UA | Send a real browser User-Agent; a bare Python UA can fail |
| Good for | Belle Époque / Secession lithograph posters, some Art Nouveau furniture, Morris textiles already in CMA, Tiffany glass |
| Avoid | Random paintings, photographs, anything not CC0 |

Pinned in this push (2026-11-10): 129201 May Milton; 153129 Sculptress; 143846 Lembrée Gallery; 147115 Lorenzaccio; 160672 Sagot's Gallery; 125928 Square at Evening; 680793 Phänomen Vase; 117129 Strawberry Thief; 130609 Peacock and Dragon; 370537 Jack-in-the-Pulpit; 129173 Pink Wallpaper; 151714 Wright window; 151884 Bugatti cabinet; 156112 Bugatti tea table; 148803 Majorelle cabinet; 146091 Majorelle bench. Plus search fill such as cma-142626.

### 2. Victoria and Albert Museum — primary graphic / furniture

| | |
| --- | --- |
| Why | Posters, type, book jackets, historic chairs. IIIF-style framemark scales cleanly |
| Search | `https://api.vam.ac.uk/v2/objects/search?q={query}&images_exist=1&page_size=8` |
| Image | `https://framemark.vam.ac.uk/collections/{_primaryImageId}/full/!1920,/0/default.jpg` |
| Page | `https://collections.vam.ac.uk/item/{systemNumber}/` |
| License | V&A, non-commercial with attribution (matches this page’s intent) |
| Our id | `va-{systemNumber}` |
| CORS | `*` — mosaic colorize works |
| Skip | Furniture year ≥ 1940; makers matching eames / aalto / yanagi / knoll / living product lines; ads (`DROP` in the builder) |
| Good for | Cassandre, Expo 1925, alphabet/type specimens, Thebes stool, Hoffmann, Thonet (cap 2), Moser desk, Albers posters, Sussex chairs |

Pinned in this push: O1405126 Normandie; O1103502 Expo 1925; O201853 Alphabet (may drop in/out of search); O540389 book jacket; O7878 Thebes stool; O84639 Moser desk.

### 3. Wikimedia Commons — architecture only, few files

| | |
| --- | --- |
| Why | High-res building photographs with CC/PD when museum APIs have no architecture |
| API | `https://commons.wikimedia.org/w/api.php` generator=search, namespace 6, `iiprop=url\|size\|extmetadata\|mime`, `iiurlwidth=1920` |
| Image | `https://commons.wikimedia.org/wiki/Special:FilePath/{Filename}?width=1920` |
| Page | `imageinfo.descriptionurl` (File: page) |
| Our id | `commons-{pageid}` |
| CORS | `*` |
| Filters | long edge ≥ 1920, short ≥ 900, license CC or PD, no banner/wikivoyage/selfie/crowd |
| Rate | sleep ≥ 1s; never bulk-download originals (429 / huge files blanked the page once) |
| Intro | Match `BUILDINGS` in `scripts/build_catalog.py` so maker = architect, year = completion, not the photographer |

Used in this push:

| Id | Work | File notes |
| --- | --- | --- |
| commons-73392906 | Bauhaus Dessau, Gropius 1925–1926 | Composed façade |
| commons-69819341 | Salk Institute, Kahn 1965 | |
| commons-51096670 | Fallingwater, Wright 1935–1939 | Classic view |
| commons-96132770 | Pantheon, c. 126 | Interior oculus |
| commons-71467140 | Farnsworth House, Mies 1951 | |
| commons-15479088 | Villa Savoye, Le Corbusier 1929–1931 | |

Spare in `BUILDINGS` but **not** in the current push: Paimio Sanatorium (`File:Paimio Sanatorium2.jpg` was 1600×1065, failed the 1920 filter). Ronchamp / Notre-Dame-du-Haut — include only with a ≥1920 file and a complete composition.

---

## Tried, excluded, or blocked

Keep these as negative knowledge. Re-test only if the recorded failure mode has a concrete reason to have changed, then write the new result here.

| Source | Why it looked useful | What happened | Status |
| --- | --- | --- | --- |
| Finna / Museum of Finnish Architecture (mfa.finna.fi) | First-choice Finnish design, CC BY 4.0, Cover/Show `fullres=1` | Cloudflare 403 on crawlers. Browser and GitHub Action both blocked | **Blocked.** Re-try later; if it works, it outranks Cleveland for Finnish work |
| Finna / Museovirasto | Finnish architecture, interiors, craft, CC BY | Same Cloudflare wall | Blocked with Finna |
| Finna / Helsinki City Museum | Urban design photographs, CC BY | Same | Blocked with Finna |
| SMK (National Gallery of Denmark) Open API | IIIF 1600–2400px | Posters mostly `public_domain: false` | Do not use for this mix |
| Art Institute of Chicago IIIF | CC0, full-size | Image server requires `Referer: artic.edu`. GitHub Pages hotlink 403 | Do not hotlink |
| Metropolitan Museum Open Access | CC0 original JPEGs | Object and departments endpoints live; **Search API 410**, cannot query posters/furniture | Unusable for weekly search |
| Library of Congress WPA posters | Famous graphic set | Public JPEGs around **640px** — too small to cover a large screen even with mosaic as the main diet | Skip |
| Cooper Hewitt (Smithsonian) | Design museum | API key required; longest edge often ~1024px | Skip for a keyless Pages site |
| Finnish National Gallery (Ateneum et al.) | Large PD set | API key via GitHub account; not a no-key hotlink | Maybe later as a batch dump, not now |
| Rijksmuseum API | Open images | API 410 at last try | Skip until a new public endpoint is documented |
| Wikimedia Commons (general, non-building) | Volume | Originals 429 / enormous; tourist snapshots failed the composition bar; Finnish filenames double-encoded `%25` once | Architecture only, FilePath 1920 |
| Living-designer shop photos | Furniture we actually like | In copyright; not a museum open-access record | Never |
| Alvar Aalto furniture / drawings | Finnish, on-brief visually | Aalto died 1976; EU furniture/design still in term. Façade photos of buildings are OK | Furniture out, Paimio façade in if ≥1920 |
| Remedy Entertainment stills / UI | The visual brief started from Control’s rhythm | Company IP, no reuse license | Never |

Ads and junk already on the builder `DROP` list (do not put back): Yoplait, Harold Lloyd, World Wildlife, Brimham, Think Ahead, Help Save Our World, fruit salt, Pelzfach, African Jigsaw, ENO, Chippendale, Grandmother pattern, Someone Talked, Flower Power, Ticket of Leave, roundback armchair / lohan type, Raven’s head, Sleepless Night, portraits, banners, Wikivoyage.

---

## Current push snapshot (2026-11-10)

40 works (next replacement must be **32–36**, none of these ids if they already sit in archive — they do). Mix at generation: furniture 14, graphic 17, architecture 6. Sources: Cleveland 17, V&A 17, Commons 6.

Catalog ids:

```
cma-129201 cma-153129 cma-143846 cma-147115 cma-160672 cma-125928
cma-680793 cma-117129 cma-130609 cma-370537 cma-129173 cma-151714
cma-151884 cma-156112 cma-148803 cma-146091 cma-142626
va-O1405126 va-O1103502 va-O540389 va-O7878 va-O84639
va-O1325271 va-O183375 va-O114827 va-O1323794 va-O114123
va-O84526 va-O1024553 va-O66273 va-O694080 va-O7883 va-O138679 va-O694075
commons-73392906 commons-69819341 commons-51096670
commons-96132770 commons-71467140 commons-15479088
```

Archive holds these plus earlier experiments (~89 rows). Treat **all** archive ids as used.

---

## How to explore a new source

1. Confirm the institution states reuse + attribution (or CC0/PD).
2. Confirm a hotlink JPEG ≥ ~1920 on the long edge, or accept that the work will mosaic.
3. Confirm CORS if you care about mosaic (`Access-Control-Allow-Origin: *`). Missing CORS is allowed (Cleveland pattern): show the original.
4. Confirm no API key for GitHub Actions.
5. Fetch three sample objects, write id / title / page / image / license into a note, then add a section here **before** pinning them in `build_catalog.py`.
6. Prefer stable object ids so likes survive URL refreshes.

---

## Image URL recipes (copy exactly)

```
Cleveland print:
  https://openaccess-cdn.clevelandart.org/{accession}/{accession}_print.jpg

V&A framemark:
  https://framemark.vam.ac.uk/collections/{imageId}/full/!1920,/0/default.jpg

Commons FilePath:
  https://commons.wikimedia.org/wiki/Special:FilePath/{urlencoded filename}?width=1920
```

Do not use Commons original `upload.wikimedia.org/...` without a width. Do not use V&A `full/full/`. Do not use Cleveland TIFF.

"""Build the current push catalog and merge outgoing works into archive."""

from __future__ import annotations

import html
import json
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

UA = "ArtFlowWeekly/1.0 (https://github.com/WateryWaterman/Art-Flow; funshenbot@mail.grokbot.com)"
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "catalog.json"
ARCHIVE = ROOT / "data" / "archive.json"

# Image hosts that send no Access-Control-Allow-Origin. SOURCES.md records each one
# when a source is accepted. The page reads the copy written into catalog.json.
NO_CORS_HOSTS = [
    "openaccess-cdn.clevelandart.org",
]

CMA_PINNED = [
    '149015',  # Dressing Table Mirror
    '156855',  # Tall Clock
    '153752',  # Center Table
    '160089',  # Fire Screen
    '157229',  # Vase des Binelles
    '165186',  # Frogs and Lily Pads (Grenouilles et Nénuphars) Vase
    '146910',  # A Gallery at the Gymnasium
    '129163',  # On the Pont de l'Europe
    '127956',  # Front Cover
    '127960',  # Schlomé Fuss in the Synagogue
    '133109',  # Pierre Bonnard
    '79381',  # On Cats by Jacques Dalbray
    '103317',  # La Rue Coulaincourt
    '112932',  # Beatrice
]

VAM_PINNED = [
    'O11281',  # Mackintosh, Charles Rennie Chair
    'O304876',  # Charles Rennie Mackintosh Chair
    'O59048',  # Writing Desk and Armchair
    'O61449',  # Morris & Co. Armchair
    'O101934',  # Breuer, Marcel Lajos Armchair
    'O11159',  # C. F. A. Voysey Table
    'O112269',  # Godwin, Edward William Chair
    'O114110',  # Model B5
    'O122351',  # Fauteuil Transatlantique
    'O129668',  # 'S' bend chair
    'O74615',  # Secession. 16 Ausstellung, 1903
    'O74626',  # L'Art Nouveau
    'O75253',  # Frank Lloyd Wright Architectuur Tentoonstelling
    'O759266',  # The Flower Show by Denis MacKail
    'O88392',  # Secession - XXVII - Ausstellung - Nov-Dec
    'O89696',  # I Internationale Kunst Ausstellung des Vereins Bildender Künstler Münchens (Secession)
]

BUILDINGS = [
    {
        "match": 'ronchamp|notre-dame-du-haut|notre dame du haut',
        "title": 'Notre Dame du Haut',
        "maker": 'Le Corbusier',
        "year": '1955',
        "intro": '柯布西耶的朗香教堂。厚牆與捲曲屋頂把光線收成幾道切口。',
    },
    {
        "match": 'tugendhat',
        "title": 'Villa Tugendhat',
        "maker": 'Ludwig Mies van der Rohe',
        "year": '1930',
        "intro": '密斯在布爾諾的圖根哈特宅。白色體量、花園與連續玻璃把居住做成水平的節奏。',
    },
    {
        "match": 'neue nationalgalerie|new national gallery',
        "title": 'Neue Nationalgalerie',
        "maker": 'Ludwig Mies van der Rohe',
        "year": '1968',
        "intro": '密斯的柏林新國家美術館。巨大的鋼屋頂壓在幾乎消失的玻璃盒子上，留白就是結構。',
    },
    {
        "match": 'villa mairea|mairea',
        "title": 'Villa Mairea',
        "maker": 'Alvar Aalto',
        "year": '1939',
        "intro": '阿爾托的邁雷亞別墅。木、磚與白色體量被組織成一組鬆開的庭院。',
    },
    {
        "match": 'kimbell',
        "title": 'Kimbell Art Museum',
        "maker": 'Louis Kahn',
        "year": '1972',
        "intro": '路易斯·康的金貝爾美術館。一排混凝土拱殼把光線從縫裡放進來。',
    },
    {
        "match": 'exeter',
        "title": 'Phillips Exeter Academy Library',
        "maker": 'Louis Kahn',
        "year": '1972',
        "intro": '路易斯·康的埃克塞特圖書館。厚牆中央掏出大廳，書與光在圓周上相遇。',
    },
]

TARGET_MIN = 32
TARGET_MAX = 36
TARGET = 36
ARCH_MAX = 6
FURN_MAX = 14

FURN_TYPE = re.compile(
    r"chair|stool|table|armchair|cabinet|desk|bench|furniture|sideboard",
    re.I,
)
POSTER_TYPE = re.compile(
    r"poster|lithograph|plakat|print|alphabet|type|specimen|book jacket|graphic",
    re.I,
)


def fetch(url: str) -> bytes:
    headers = {"User-Agent": UA, "Accept": "application/json"}
    last_exc: Exception | None = None
    for attempt in range(1, 5):
        if "wikimedia.org" in url or "wikipedia.org" in url:
            time.sleep(1.2)
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=40) as res:
                return res.read()
        except urllib.error.HTTPError as exc:
            last_exc = exc
            if exc.code in {429, 500, 502, 503, 504} and attempt < 4:
                raw = exc.headers.get("Retry-After") if exc.headers else None
                try:
                    delay = min(float(raw), 60.0) if raw else min(2.0 * (2 ** (attempt - 1)), 60.0)
                except ValueError:
                    delay = min(2.0 * (2 ** (attempt - 1)), 60.0)
                print(f"HTTP {exc.code} for {url} (attempt {attempt}/4); retrying in {delay:.1f}s")
                time.sleep(delay)
                continue
            raise
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            last_exc = exc
            if attempt < 4:
                delay = min(2.0 * (2 ** (attempt - 1)), 60.0)
                print(f"{type(exc).__name__} for {url} (attempt {attempt}/4); retrying in {delay:.1f}s")
                time.sleep(delay)
                continue
            raise
    raise last_exc if last_exc else RuntimeError(f"fetch failed: {url}")


def fetch_json(url: str):
    return json.loads(fetch(url).decode("utf-8"))


def clean(text: str | None) -> str:
    if not text:
        return ""
    text = html.unescape(str(text))
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def year_only(text: str | None) -> str:
    text = clean(text)
    m = re.match(r"^(\d{4})-\d{2}-\d{2}", text)
    if m:
        return m.group(1)
    return text


def earliest_year(text: str | None) -> int | None:
    years = [int(y) for y in re.findall(r"\d{4}", text or "")]
    return min(years) if years else None


def work(**kwargs) -> dict | None:
    image = kwargs.get("image") or ""
    title = clean(kwargs.get("title"))
    if not image or not title:
        return None
    rec = {
        "id": kwargs["id"],
        "title": title,
        "maker": clean(kwargs.get("maker")),
        "year": year_only(kwargs.get("year")),
        "medium": clean(kwargs.get("medium")),
        "source": kwargs.get("source") or "",
        "sourceId": str(kwargs.get("source_id") or ""),
        "sourceUrl": kwargs.get("source_url") or "",
        "image": image,
        "imageHi": kwargs.get("image_hi") or image,
        "license": kwargs.get("license") or "",
        "credit": clean(kwargs.get("credit")),
        "intro": clean(kwargs.get("intro")),
        "tags": kwargs.get("tags") or [],
    }
    blob = " ".join([rec["title"], rec["intro"], rec["credit"]]).lower()
    for b in BUILDINGS:
        if re.search(b["match"], blob):
            rec["title"] = b["title"]
            rec["maker"] = b["maker"]
            rec["year"] = b["year"]
            rec["intro"] = b["intro"]
            break
    return rec


def cleveland() -> list[dict]:
    out: list[dict] = []
    seen: set[str] = set()

    def add(item: dict) -> None:
        iid = str(item.get("id") or "")
        if not iid or iid in seen:
            return
        images = item.get("images") or {}
        src = (images.get("print") or {}).get("url") or (images.get("web") or {}).get("url")
        if not src:
            return
        creators = item.get("creators") or []
        maker = ", ".join(
            c.get("description") or ""
            for c in creators
            if c.get("use_in_caption", True)
        )
        title = item.get("title") or "Untitled"
        year = item.get("creation_date") or ""
        desc = clean(item.get("description") or item.get("did_you_know") or "")
        rec = work(
            id=f"cma-{iid}",
            title=title,
            maker=maker,
            year=year,
            medium=item.get("technique") or item.get("type") or "",
            source="Cleveland Museum of Art",
            source_id=iid,
            source_url=item.get("url") or "",
            image=src,
            image_hi=src,
            license="CC0",
            credit=item.get("tombstone") or "Cleveland Museum of Art, CC0",
            intro=desc or f"{title}（{year}）。克利夫蘭藝術博物館開放典藏。",
            tags=["cleveland", (item.get("type") or "print").lower()],
        )
        if rec:
            seen.add(iid)
            out.append(rec)

    for pid in CMA_PINNED:
        try:
            payload = fetch_json(f"https://openaccess-api.clevelandart.org/api/artworks/{pid}")
            add(payload.get("data") or payload)
        except Exception as exc:
            print("cleveland id fail", pid, exc)
        time.sleep(0.15)

    for q in []:  # weekly-update: search fill disabled; pins are the catalog
        url = (
            "https://openaccess-api.clevelandart.org/api/artworks/"
            f"?q={urllib.parse.quote(q)}&cc0=1&has_image=1&limit=8"
        )
        try:
            payload = fetch_json(url)
        except Exception as exc:
            print("cleveland fail", q, exc)
            continue
        for item in payload.get("data") or []:
            kind = (item.get("type") or "").lower()
            if kind not in {"print", "poster", "textile", "glass", "furniture", "ceramic"}:
                continue
            add(item)
        time.sleep(0.2)
    print("cleveland", len(out))
    return out


def furniture_too_new(otype: str, year: str, maker: str) -> bool:
    blob = f"{otype} {maker}"
    if not FURN_TYPE.search(blob):
        return False
    if re.search(r"eames|aalto|yanagi|barber|opendesk|rothko|knoll", maker, re.I):
        return True
    y = earliest_year(year)
    return bool(y and y >= 1940)


def victoria() -> list[dict]:
    queries = [
    ]
    want_type = re.compile(
        r"poster|print|furniture|textile|wallpaper|graphic|type|alphabet|"
        r"book|chair|stool|table|armchair|cabinet|desk|bench",
        re.I,
    )
    skip = re.compile(
        r"photograph|painting|sculpture bust|costume|flight stool|edie stool|"
        r"rothko|yoplait|harold lloyd|wildlife|brimham|opendesk",
        re.I,
    )
    seen: set[str] = set()
    out: list[dict] = []
    pin_queries = list(VAM_PINNED) + [q for q in queries if q not in VAM_PINNED]
    for q in pin_queries:
        url = (
            "https://api.vam.ac.uk/v2/objects/search?"
            + urllib.parse.urlencode({"q": q, "images_exist": 1, "page_size": 8})
        )
        try:
            payload = fetch_json(url)
        except Exception as exc:
            print("va fail", q, exc)
            continue
        for rec in payload.get("records") or []:
            oid = rec.get("systemNumber")
            if not oid or oid in seen:
                continue
            otype = rec.get("objectType") or ""
            maker = ((rec.get("_primaryMaker") or {}).get("name")) or ""
            year = rec.get("_primaryDate") or ""
            title = rec.get("_primaryTitle") or ""
            if not title:
                title = " ".join(x for x in [maker, otype] if x).strip() or otype
            blob = f"{title} {otype} {maker}"
            if skip.search(blob) or not want_type.search(blob):
                continue
            if furniture_too_new(otype, year, maker):
                continue
            img_id = rec.get("_primaryImageId")
            if not img_id:
                continue
            image = f"https://framemark.vam.ac.uk/collections/{img_id}/full/!1920,/0/default.jpg"
            item = work(
                id=f"va-{oid}",
                title=title,
                maker=maker,
                year=year,
                medium=otype,
                source="Victoria and Albert Museum",
                source_id=oid,
                source_url=f"https://collections.vam.ac.uk/item/{oid}/",
                image=image,
                image_hi=image,
                license="V&A, non-commercial with attribution",
                credit=f"{title}. {maker}. Victoria and Albert Museum, {oid}.",
                intro=f"{title}。{maker}。維多利亞與阿爾伯特博物館館藏。",
                tags=["vam", otype.lower().replace(" ", "-")[:40]],
            )
            if item:
                seen.add(oid)
                out.append(item)
        time.sleep(0.25)
    print("vam", len(out))
    return out


def commons_few() -> list[dict]:
    queries = [
        '360-degree interior panorama of Chapelle Notre-Dame du Haut de Ronchamp 2026.jpg',
        'Tugendhat Villa in Brno.jpg',
        'Berlin-Tiergarten, de Neue Nationalgalerie met een expositie van Andy Warhol IMG 5718 2024-09-07 09.58.jpg',
        '4Y1A7841 Alvar Aalto, Finland (26710745140).jpg',
        'Kimbell Art Museum (Unsplash).jpg',
        'Phillips-Exeter-Academy-Library-Exterior-Exeter-New-Hampshire-Apr-2014-a.jpg',
    ]
    out: list[dict] = []
    seen: set[str] = set()
    for q in queries:
        params = {
            "action": "query",
            "format": "json",
            "generator": "search",
            "gsrsearch": q,
            "gsrnamespace": "6",
            "gsrlimit": "3",
            "prop": "imageinfo",
            "iiprop": "url|size|extmetadata|mime",
            "iiurlwidth": "1920",
        }
        url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params)
        try:
            payload = fetch_json(url)
        except Exception as exc:
            print("commons fail", q, exc)
            continue
        pages = (payload.get("query") or {}).get("pages") or {}
        for page in pages.values():
            pid = str(page.get("pageid") or "")
            if not pid or pid in seen:
                continue
            infos = page.get("imageinfo") or []
            if not infos:
                continue
            info = infos[0]
            width = int(info.get("width") or 0)
            height = int(info.get("height") or 0)
            if max(width, height) < 1920 or min(width, height) < 900:
                continue
            meta = info.get("extmetadata") or {}
            license_name = (meta.get("LicenseShortName") or {}).get("value") or ""
            if not re.search(r"cc|public domain|pd-|gfdl", license_name, re.I):
                continue
            title = page.get("title", "").replace("File:", "")
            if re.search(r"banner|wikivoyage|under construction|selfie|crowd", title, re.I):
                continue
            thumb = (info.get("thumburl") or info.get("url") or "").split("?", 1)[0]
            source_url = info.get("descriptionurl") or ""
            if source_url:
                name = urllib.parse.unquote(source_url.split("/wiki/File:")[-1])
                image = "https://commons.wikimedia.org/wiki/Special:FilePath/" + urllib.parse.quote(name) + "?width=1920"
            else:
                image = thumb
            rec = work(
                id=f"commons-{pid}",
                title=re.sub(r"\.\w+$", "", title).replace("_", " "),
                maker=clean((meta.get("Artist") or {}).get("value")),
                year="",
                medium="Photograph",
                source="Wikimedia Commons",
                source_id=pid,
                source_url=source_url,
                image=image,
                image_hi=image,
                license=license_name,
                credit=f"{title}. {clean((meta.get('Artist') or {}).get('value'))}. {license_name}.",
                intro=clean((meta.get("ImageDescription") or {}).get("value"))[:420],
                tags=["commons"],
            )
            if rec:
                seen.add(pid)
                out.append(rec)
                break
        time.sleep(1.0)
    print("commons", len(out))
    return out


DROP = re.compile(
    r"banner|wikivoyage|portrait of|under construction|sleepless night|"
    r"perched upon a bust|raven.s head|chippendale|grandmother pattern|"
    r"someone talked|flower power|ticket of leave|"
    r"yoplait|harold lloyd|world wildlife|brimham|think ahead|"
    r"help save our world|fruit salt|pelzfach|african jigsaw|\beno\b|"
    r"roundback armchair|lohan type",
    re.I,
)

WANT = re.compile(
    'poster|lithograph|plakat|albers|mucha|lautrec|grasset|morris|wright|ph[äa]nomen|wallpaper|strawberry|peacock|vase|chair|stool|table|bench|cabinet|thonet|hoffmann|sussex|thebes|mackmurdo|bugatti|majorelle|bauhaus|cassandre|alphabet|type|specimen|textile|paimio|secession|lembrée|lorenzaccio|sagot|vuillard|bonnard|werkstätte|book jacket|furniture|moser|salk|fallingwater|pantheon|farnsworth|savoye|ronchamp|kahn|notre-dame-du-haut|notre dame du haut|Notre|Dame|Haut|Corbusier|tugendhat|Villa|Tugendhat|Ludwig|Mies|Rohe|neue nationalgalerie|new national gallery|Neue|Nationalgalerie|Ludwig|Mies|Rohe|villa mairea|mairea|Villa|Mairea|Alvar|Aalto|kimbell|Kimbell|Museum|Louis|exeter|Phillips|Exeter|Academy|Library|Louis',
    re.I,
)


def key_of(w: dict) -> str:
    title = " ".join(re.sub(r"[^a-z0-9åäöü]+", " ", (w.get("title") or "").lower()).split()[:4])
    maker = " ".join(re.sub(r"[^a-z0-9åäöü]+", " ", (w.get("maker") or "").lower()).split()[:2])
    return f"{title}|{maker}"


def is_arch(w: dict) -> bool:
    return w["id"].startswith("commons-") or "photograph" in (w.get("medium") or "").lower()


def is_furn(w: dict) -> bool:
    blob = " ".join([w.get("title") or "", w.get("medium") or "", " ".join(w.get("tags") or [])])
    return bool(FURN_TYPE.search(blob))


def is_graphic(w: dict) -> bool:
    blob = " ".join([w.get("title") or "", w.get("medium") or "", " ".join(w.get("tags") or [])])
    return bool(POSTER_TYPE.search(blob) or re.search(r"wallpaper|textile", blob, re.I))


def maker_key(w: dict) -> str:
    raw = re.sub(r"[^a-z]+", "", (w.get("maker") or "").lower())
    for family in (
        "thonet",
        "hoffmann",
        "webb",
        "bugatti",
        "majorelle",
        "breuer",
        "morris",
        "mackmurdo",
        "moser",
        "mackintosh",
        "tiffany",
        "lalique",
        "stickley",
        "herter",
        "galle",
        "horta",
        "guimard",
        "rietveld",
        "godwin",
        "voysey",
        "driscoll",
        "sevre",
        "vuillard",
        "bonnard",
        "mucha",
        "lautrec",
        "cassandre",
        "albers",
    ):
        if family in raw:
            return family
    return raw[:18]


def load_archive_ids() -> set[str]:
    ids: set[str] = set()
    if ARCHIVE.exists():
        try:
            for item in json.loads(ARCHIVE.read_text(encoding="utf-8")).get("works") or []:
                if item.get("id"):
                    ids.add(item["id"])
        except Exception:
            pass
    return ids


def curate(works: list[dict], archive_ids: set[str] | None = None) -> list[dict]:
    archive_ids = archive_ids or set()
    by_id = {w["id"]: w for w in works}
    ordered: list[dict] = []
    seen_id: set[str] = set()
    seen_key: set[str] = set()
    arch = 0
    furn_n = 0
    maker_n: dict[str, int] = {}
    pinned = {f"cma-{i}" for i in CMA_PINNED} | {f"va-{i}" for i in VAM_PINNED}

    def take(w: dict) -> bool:
        nonlocal arch, furn_n
        if w["id"] in seen_id:
            return False
        blob = " ".join([w["title"], w["maker"], w["medium"], w["intro"], w["credit"]])
        if DROP.search(blob):
            return False
        if not WANT.search(blob) and not w["id"].startswith("cma-"):
            return False
        k = key_of(w)
        if k in seen_key:
            return False
        if is_arch(w):
            arch += 1
            if arch > ARCH_MAX:
                return False
        if is_furn(w):
            if furn_n >= FURN_MAX:
                return False
            mk = maker_key(w)
            if mk:
                if maker_n.get(mk, 0) >= 2:
                    return False
                maker_n[mk] = maker_n.get(mk, 0) + 1
            furn_n += 1
        seen_id.add(w["id"])
        seen_key.add(k)
        ordered.append(w)
        return True

    for pid in (f"cma-{i}" for i in CMA_PINNED):
        if pid in by_id:
            take(by_id[pid])
    for pid in (f"va-{i}" for i in VAM_PINNED):
        if pid in by_id:
            take(by_id[pid])

    furn = [w for w in works if is_furn(w)]
    graphic = [w for w in works if is_graphic(w) and not is_furn(w)]
    arch_works = [w for w in works if is_arch(w)]
    rest = [w for w in works if not is_furn(w) and not is_graphic(w) and not is_arch(w)]

    for w in arch_works:
        take(w)

    def fill(item: dict) -> None:
        if item["id"] in archive_ids and item["id"] not in pinned:
            return
        take(item)

    i = j = 0
    while len(ordered) < TARGET and (i < len(graphic) or j < len(furn)):
        if i < len(graphic):
            fill(graphic[i])
            i += 1
        if len(ordered) >= TARGET:
            break
        if j < len(furn):
            fill(furn[j])
            j += 1

    for w in rest:
        if len(ordered) >= TARGET:
            break
        fill(w)
    if len(ordered) > TARGET_MAX:
        ordered[:] = ordered[:TARGET_MAX]
    return ordered


def merge_archive(current: list[dict]) -> None:
    old: list[dict] = []
    if ARCHIVE.exists():
        try:
            old = json.loads(ARCHIVE.read_text(encoding="utf-8")).get("works") or []
        except Exception:
            old = []
    if OUT.exists():
        try:
            old.extend(json.loads(OUT.read_text(encoding="utf-8")).get("works") or [])
        except Exception:
            pass
    by_id = {w["id"]: w for w in old if w.get("id")}
    for w in current:
        by_id[w["id"]] = w
    payload = {
        "updated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "works": list(by_id.values()),
    }
    ARCHIVE.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print("archive", len(payload["works"]))


def main() -> None:
    works: list[dict] = []
    for bucket in (cleveland, victoria, commons_few):
        try:
            works.extend(bucket())
        except Exception as exc:
            print("bucket failed", bucket.__name__, exc)
    curated = curate(works, load_archive_ids())
    if not (TARGET_MIN <= len(curated) <= TARGET_MAX):
        print(f"warning: catalog size {len(curated)} outside {TARGET_MIN}-{TARGET_MAX}")
    merge_archive(curated)
    catalog = {
        "generated": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "intervalSeconds": 180,
        "noCorsHosts": list(NO_CORS_HOSTS),
        "works": curated,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")
    print("wrote", OUT, "works", len(curated))
    n_furn = sum(1 for w in curated if is_furn(w))
    n_arch = sum(1 for w in curated if is_arch(w))
    n_graph = sum(1 for w in curated if is_graphic(w) and not is_furn(w))
    print(f"mix furniture={n_furn} graphic={n_graph} architecture={n_arch}")
    for w in curated:
        print(" ", w["id"], "|", w["title"][:48], "|", w["year"], "|", w["source"][:22])


if __name__ == "__main__":
    main()

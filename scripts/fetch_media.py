"""Download 1600px JPEGs so the page does not depend on Wikimedia at runtime."""

from __future__ import annotations

import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / "data" / "catalog.json"
MEDIA = ROOT / "media"


def thumb_1280(url: str) -> str:
    if not url:
        return ""
    url = url.split("?", 1)[0]
    url = url.replace("https://thumb.wikimedia.org/", "https://upload.wikimedia.org/")
    url = re.sub(r"/\d+px-", "/1280px-", url)
    if "/thumb/" in url:
        return url
    m = re.search(r"/wikipedia/commons/([0-9a-f])/([0-9a-f]{2})/([^/]+)$", url)
    if m:
        a, b, name = m.group(1), m.group(2), m.group(3)
        return f"https://upload.wikimedia.org/wikipedia/commons/thumb/{a}/{b}/{name}/1280px-{name}"
    return url


def from_file_page(source_url: str) -> str:
    if not source_url or "/wiki/File:" not in source_url:
        return ""
    name = urllib.parse.unquote(source_url.split("/wiki/File:", 1)[1])
    return "https://commons.wikimedia.org/wiki/Special:FilePath/" + urllib.parse.quote(name) + "?width=1280"


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "image/jpeg,image/*"})
    with urllib.request.urlopen(req, timeout=40) as res:
        return res.read()


def main() -> None:
    catalog = json.loads(CATALOG.read_text(encoding="utf-8"))
    MEDIA.mkdir(parents=True, exist_ok=True)
    for work in catalog.get("works") or []:
        dest = MEDIA / f"{work['id']}.jpg"
        page_thumb = from_file_page(work.get("sourceUrl") or "")
        remote = page_thumb or thumb_1280(work.get("imageHi") or work.get("image") or "")
        if dest.exists() and dest.stat().st_size > 8000:
            print("keep", dest.name, dest.stat().st_size)
        else:
            candidates = []
            for url in (remote, work.get("image") or "", work.get("imageHi") or ""):
                if url and url.startswith("http"):
                    candidates.append(thumb_1280(url))
                    if "/thumb/" in url:
                        candidates.append(re.sub(r"/thumb/(.+)/[^/]+$", r"/\1", url.replace("https://thumb.wikimedia.org/", "https://upload.wikimedia.org/")))
            seen: set[str] = set()
            ok = False
            for url in candidates:
                if not url or url in seen:
                    continue
                seen.add(url)
                try:
                    data = fetch(url)
                    if len(data) > 8000:
                        dest.write_bytes(data)
                        print("got", dest.name, len(data), url[:90])
                        ok = True
                        break
                except Exception as exc:
                    print("fail", work["id"], url[:70], exc)
            if not ok:
                print("MISS", work["id"])
            time.sleep(1.2)
        if dest.exists() and dest.stat().st_size > 8000:
            work["image"] = f"./media/{work['id']}.jpg"
            if remote.startswith("http"):
                work["imageHi"] = remote
        elif remote.startswith("http"):
            work["image"] = remote
            work["imageHi"] = remote
    CATALOG.write_text(json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8")
    print("updated", CATALOG)


if __name__ == "__main__":
    main()

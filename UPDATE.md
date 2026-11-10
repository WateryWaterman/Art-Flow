# 如何更新這張待機頁

畫面優先讀 `data/catalog.json` 裡的 1280px 熱鏈（Commons `Special:FilePath?width=1280`，這是 Wikimedia 允許的縮圖尺寸）。若 `media/` 裡已有同名 JPEG，則走本地，不打外網。不要用原圖：原圖又大又容易被 Wikimedia 限流，頁面會一直停在空白。

內容分成兩層，互不覆蓋：

| 層 | 存在哪 | 誰更新 | 圖在哪 |
| --- | --- | --- | --- |
| 現在推送 | 倉庫 `data/catalog.json` | 每週腳本，或你手動跑 | 1280px 熱鏈 |
| 過往推送 | 倉庫 `data/archive.json` | 腳本每次把現行作品併進去，只增不刪 | 同上，元數據永久留在倉庫 |
| 收藏 | 瀏覽器 `localStorage` 只存作品 id | 只有你按「收藏」 | 進頁時用 id 對回 catalog 或 archive，再載圖 |

換推送不會清收藏。本地不存圖、不存完整卡片。關頁即丟圖，下次用 id 再載。每人、每台瀏覽器各一份 id 清單。

---

## 平常不用做的事

部署到 GitHub Pages 之後，推送會自己換。工作流 `.github/workflows/refresh-catalog.yml` 每週一 03:17 UTC 跑 `scripts/build_catalog.py`，提交 `data/catalog.json` 與 `data/archive.json`。

腳本向克利夫蘭、V&A、以及少量維基共享資源拉允許署名轉載的圖，寫回大約三十件推送（海報／字體／家具為主，建築最多兩件）。網址用 1280px 縮圖，不用原檔。可選再跑 `python scripts/fetch_media.py` 把 JPEG 存進 `media/`。不用遊戲截圖。

要立刻換一批，在 GitHub 打開 Actions → **refresh catalog** → Run workflow。

---

## 本地手動更新推送

```bash
python scripts/build_catalog.py
```

然後用 `python -m http.server 5173` 看新目錄。確認沒問題再提交：

```bash
git add data/catalog.json data/archive.json
git commit -m "chore: refresh design catalog"
git push
```

```bash
python scripts/fetch_media.py
```

會把 1280px JPEG 寫進 `media/`（每張大約 200–600 KB）。有本地檔時頁面不打 Wikimedia。原圖不要提交。

---

## 收藏為什麼不會丟

按「收藏」時，瀏覽器只寫入 `standby.favs`：一串作品 id。舊版完整卡片 `standby.library` 會在下次載入時收成 id 後刪掉。

進頁時讀 `catalog.json`（現在推送）和 `archive.json`（過往推送），用 id 對回完整元數據再載圖。推送拿掉的作品只要還在 archive 裡，收藏與穿插都還能播。

---

## 倉庫會有多大

大約就是這幾個文字檔：`index.html`、`styles.css`、`app.js`、`data/catalog.json`（幾十 KB）。不含圖。

熱鏈失效時，週更會給仍在推送裡的作品換新網址。只活在收藏裡、館方又刪了原圖的，畫面會空，紀錄仍在。真的需要備份圖時，把檔案放到本地 `images/`（已被 git 忽略），不要提交。

---

## 改切換間隔

編輯 `data/catalog.json` 的 `intervalSeconds`（秒），提交即可。不必改程式。

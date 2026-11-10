# Standby

全螢幕設計待機頁。沒有介面；滑鼠靠左／右切頁，靠頂部收藏與選單，靠底部看短介紹。畫面舖滿、比例不變，多出來的邊會慢速平移。

決策見 [DECISIONS.md](./DECISIONS.md)。如何換推送、收藏存在哪，見 [UPDATE.md](./UPDATE.md)。

## 本地

```bash
python -m http.server 5173
```

打開 http://127.0.0.1:5173/

## 操作

- 左緣／右緣：半透明漸層與不透明尖括號；上一件、下一件
- 頂部：收藏；全部 / 收藏 / 穿插
- 底部：這件作品的說明
- 鍵盤：← → 切頁，F 收藏
- 約每 3 分鐘自動下一件

要預覽自動切換，把 `data/catalog.json` 裡的 `intervalSeconds` 暫時改成 `15`。

## 更新目錄

推送與收藏分開。換推送改 `data/catalog.json`，過往作品留在 `data/archive.json`；瀏覽器只存收藏 id。圖片不進倉庫。完整做法見 [UPDATE.md](./UPDATE.md)。

```bash
python scripts/build_catalog.py
```

會向克利夫蘭藝術博物館、V&A、以及少量維基共享資源拉開放授權的高清網址。不要把下載的圖提交進 git。

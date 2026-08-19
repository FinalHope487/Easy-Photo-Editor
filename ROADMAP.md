# Roadmap

與當前委派無關的新想法寫進來並標記，不當場插隊打斷目前任務。

## 標記說明

- `[now]` — 阻塞當前任務
- `[next]` — 目前模組穩定後就做
- `[later]` — 現在做屬於過早設計，等需求明確再說
- `[parked]` — 先記錄，暫不評估

---

## 待辦項目

- `[now]` **修 `tests/main.js` 的 mobile viewport off-by-one**。要求 390px、實得 391px，
  25 條 mobile case 全部在斷言業務行為之前就掛掉 → mobile 這個 viewport 實際覆蓋為零。
  兩條路：改 `useContentSize` 的設法讓寬度精確落在 390，或把 viewport 斷言改成容差 ±2px。
  前者驗的是真的裝置寬度，後者比較省事但會放掉「viewport 真的套用了」這個保證。
  （來源：2026-08-19 `/collab-kit-init` 跑 `npm test` 時發現，連跑兩次結果相同）

- `[next]` 把 `tests/cases/` 的 mobile case 在修完 off-by-one 後重跑一次，
  確認 25 條紅是**只有**這一個原因——目前的證據是「25 條的錯誤訊息字面相同」，
  不是「修好之後 25 條全綠」。這兩件事不一樣。

- `[later]` 跨瀏覽器（WebKit / iOS Safari）驗證層。需要新增 devDependency ＝高風險，
  見 `QUESTIONS.md`〈待你執行／待你批准的動作〉。

- `[later]` GitHub Pages 線上版的部署後驗證。

---

## 已拍板的決策

- **(2026-08-19) 使用者層測試用 Electron + CDP，不新增測試框架。**
  依據：`package.json:28` 的 `devDependencies` 已有 `electron` ^40.6.1，
  用它的 debugger 開真 Chromium 載真 `index.html`，零新增相依。
  進入點 `package.json:9` `"test": "node tests/run.js"`。
  反悔成本：刪 `tests/` 目錄 + 移除 `package.json` 一行，不影響任何既有檔案。
  （這題原本是 `QUESTIONS.md` Q1，已解決，本輪從該檔清出。）

- **(2026-08-19) 長期狀態檔用 `ROADMAP.md`，不建 `IMPLEMENTATION_PLAN.md`。**
  依據：`collab-kit-init` 步驟 0 的三個 loopkit 偵測條件全部沒命中
  （無根目錄 `AGENTS.md`、無 `IMPLEMENTATION_PLAN.md`、無專案內
  `.claude/skills/using-loopkit/`——該 skill 裝在全域 `~/.claude/skills/`），
  且 `ROADMAP.md` 早已存在並被 `CLAUDE.md` 全篇引用。
  反悔成本：低，改檔名 + 改 `CLAUDE.md` 三處引用。

- **(2026-08-19) `CLAUDE.md` 不裝〈衍生目標：當場做掉〉。**
  依據：全域 SessionStart hook 每次注入的 `using-loopkit` bootstrap 帶著
  「One feature per session. Never two.」，與該節正面衝突。
  另兩節（〈開工前：先驗上一輪〉〈開工前：釘住收斂條件〉）無衝突，已裝。
  反悔成本：改 `CLAUDE.md` 一個檔，見 `QUESTIONS.md` Q2。

- **(2026-08-19) 「用最新版取代現有內容」＝只換 kit 規則文字，保留專案填答。**
  依據：字面全量覆蓋會清掉 `QUESTIONS.md` 的既有題目與〈待你批准的動作〉，
  命中〈決策分級〉高風險的「刪除或覆蓋既有資料」。
  反悔成本：重跑 `/collab-kit-init` 並指定全量覆蓋。見 `QUESTIONS.md` Q3。

---

## 變更紀錄

- **2026-08-19 · `/collab-kit-init` 升級到最新版規則**
  改動檔案：`CLAUDE.md`、`QUESTIONS.md`、`ROADMAP.md`、`SOP.md`。純文件，未動程式與測試。
  `CLAUDE.md` 九個一級標題全到齊（原本八個，補上〈委派邊界規格〉）。
  **測試數（實跑，非預期值）**：`npm test` → **41 passed, 25 failed, 0 skipped（共 66）**。
  連跑兩次結果相同。25 條全部是 mobile viewport 的同一個環境原因
  （`viewport 寬度沒有套用（useContentSize 失效）`，預期 390 實際 391），
  desktop 與 tablet 全綠，**沒有任何一條是業務行為失敗**。
  這 25 條在本輪之前就是紅的，不是本輪造成——本輪沒動任何程式碼。

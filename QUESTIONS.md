# 待決問題

**回答方式：直接寫在每題下面，或說「全部照推薦，除了 3 和 7」。**
答完後清空本檔；有長期效力的決策搬進狀態檔或 `SOP.md`。

本檔是 `CLAUDE.md`〈非阻塞機制〉宣告的載體——需要拍板的事寫在這裡，不要停下來等。
**每一輪都要碰這個檔**：沒有待決問題就寫「本輪無待決問題。已檢查的軸：X / Y / Z」。

---

## 待拍板

**本輪無待決問題。** 上一批五題你已經全部回答（維持推薦 + 批准安裝 playwright），
決策與反悔成本已搬進 `ROADMAP.md`〈已拍板的決策〉，不再重問。

已檢查、判定不需要開題的軸：預設字級的夾擠上下限（12/400）、滑桿在文字工具下的
上限公式（圖高/2）、收合列上顯示什麼（工具名＋尺寸）、WebKit 那層要涵蓋哪些斷言
（只涵蓋 playwright 對 WebKit 真的做得到的：版面／堆疊／命中測試／單點觸控）、
WebKit 怎麼接進 `npm test`（子行程 vs 另一個指令）。

---

## 待你執行／待你批准的動作

<!-- - [ ] <動作>｜為什麼｜已備好的東西（路徑）｜不做的後果 -->

- [ ] **審 PR #4 並合進 `main`**｜
  https://github.com/FinalHope487/Easy-Photo-Editor/pull/4 ｜
  手機／平板碰不到的操作那一批修正｜`main` 未被動過｜
  不做的後果：線上版仍是手機不可用的狀態

- [ ] **審 PR #5**（stacked 在 #4 上）｜
  https://github.com/FinalHope487/Easy-Photo-Editor/pull/5 ｜
  字級分家、面板收合、WebKit 與部署後兩層驗證｜
  base 是 `fix/mobile-ui-and-ui-layer-tests`；#4 合了之後會自動變成 `main`｜
  不做的後果：這輪的修正卡在分支上

- [ ] **合併之後跑 `npm run test:pages`**｜確認線上版真的拿到修正
  （GitHub Pages 有建置延遲，合併當下不會馬上變）｜
  已備好：`tests/pages-smoke.js`，唯讀 GET，7 個標記逐項比對，
  現在是 1 passed / 7 failed｜
  不做的後果：只知道本機綠，不知道使用者實際打開的那份是什麼

- [x] **`npm audit` 的 18 個漏洞** → 已做完，`npm audit` 現在是
  **found 0 vulnerabilities**。含 Electron 大版本 40 → 43。
  PR #6（疊在 #5 上）。

- [ ] **注意：你說「兩個 PR 都合了」，但實際上沒有。**
  `origin/main` 仍停在 `3274534 Delete CNAME`，`gh pr view` 對 #4 / #5
  都回 `mergedAt: null`，`npm run test:pages` 也仍是 1 passed / 7 failed。
  現在有三個未合的 PR 疊著：**#4 → #5 → #6**，要照這個順序合。

---

## 卡住（修 3 次仍紅）

<!-- - <症狀>｜試過什麼｜每次的錯誤｜我認為根因在哪 -->

（無。`npm test` 79 passed / 0 failed / 0 skipped。）

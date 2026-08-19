# 待決問題

**回答方式：直接寫在每題下面，或說「全部照推薦，除了 3 和 7」。**
答完後清空本檔；有長期效力的決策搬進狀態檔或 `SOP.md`。

本檔是 `CLAUDE.md`〈非阻塞機制〉宣告的載體——需要拍板的事寫在這裡，不要停下來等。
**每一輪都要碰這個檔**：沒有待決問題就寫「本輪無待決問題。已檢查的軸：X / Y / Z」。

---

## 待拍板

### Q1 · 匯出是否要把未合併的文字物件畫進去（中風險：輸出位元組會變）

**現況是 bug**：`js/core.js` 的 `exportImage()` 只畫 `image` + `modLayer` + `drawingLayer`，
**沒有畫 `textObjects`**。使用者打完字直接按儲存，文字會無聲消失。

**三段式判定**

| 問 | 答 | 分級 |
|---|---|---|
| 1. 既有存檔還讀不讀得起來 | 讀得起來（仍是 PNG/JPEG/WEBP，沒動格式） | 過關 |
| 2. 既有進入點寫出來的位元組變了嗎 | **變了**——但只在「畫面上有未合併文字」時變 | **中風險** |

- **改了什麼形狀**：`exportImage()` 與 `processSingleFile()` 多畫一層文字
- **為什麼**：現行行為是無聲資料遺失，不是設計
- **回退成本**：低。移除 `js/core.js` 的 `drawTextObjectsTo()` 呼叫共 2 處即可。
  沒有既有資料受影響（匯出是產生新檔，不覆寫）

**已照 A 出貨**（A＝匯出含文字）。測試 `未合併的文字也會出現在匯出的檔案裡 [desktop]` 綠。
若你要維持舊行為（B＝必須先按「合併至畫布」），說一聲即可回退。

---

### Q2 · 本專案算不算 loopkit 專案——決定 CLAUDE.md 要不要裝〈衍生目標：當場做掉〉

**背景**：`collab-kit-init` 步驟 0 的三個偵測條件（根目錄 `AGENTS.md`、
`IMPLEMENTATION_PLAN.md`、專案內 `.claude/skills/using-loopkit/`）在本專案**全部沒命中**——
本專案根目錄沒有 `AGENTS.md`，`using-loopkit` 是裝在 `~/.claude/skills/` 的**全域** skill，
由全域 SessionStart hook 注入每一個專案。

嚴格照偵測結果＝一般專案，該裝〈衍生目標：當場做掉〉。但注入的 bootstrap 帶著
「One feature per session (see `AGENTS.md`). Never two.」，兩者正面衝突——
而 `AGENTS.md` 在本專案並不存在。

**選項**

- **A（推薦，已照此出貨）**：裝〈開工前：先驗上一輪〉與〈開工前：釘住收斂條件〉
  （這兩節與 bootstrap 不衝突，且本專案現在有真的使用者層可驗），
  **不裝**〈衍生目標：當場做掉〉 → 一輪只做一件事，長出來的新目標進 `ROADMAP.md` 排隊
- **B**：三節全裝 → 我在一輪內把順手發現的東西一起做掉。diff 會變大，
  但不用等下一輪。代價：與每次 session 開頭注入的 bootstrap 白紙黑字矛盾
- **C**：建 `AGENTS.md`、改用 `IMPLEMENTATION_PLAN.md`，把專案正式變成 loopkit 專案

**代價**：照 A 做最壞是「明明兩行就能改的順手小事，要多開一輪」。
**回退成本**：極低。改 `CLAUDE.md` 一個檔——貼回〈衍生目標：當場做掉〉那一節，
並把〈結束這一輪的條件〉第一條改成「收斂條件達成，且再也長不出衍生目標」。
不影響任何程式碼或既有資料。

**擋住了**：沒擋住任何工作。

---

### Q3 · 「用最新版內容取代現有內容」的範圍

**背景**：你在本輪中途要求用最新版取代現有內容。字面上的全量覆蓋會清掉
`QUESTIONS.md` 的既有題目、〈待你批准的動作〉兩項，以及〈本專案的驗證指令〉的填答，
那命中〈決策分級〉高風險的「刪除或覆蓋既有資料」。

**已照 A 出貨**：A＝**只把 kit 的規則文字換成最新版**（`CLAUDE.md` 九個章節、
`SOP.md`／`ROADMAP.md`／`session-handoff.md` 的骨架），**保留專案自己填的內容**
（Q1、待你批准的兩項、驗證指令的實際偵測結果）。

**B**：字面全量覆蓋，四個檔全部變回空模板。

**回退成本**：低，但要知道一件事——舊 `CLAUDE.md` **未被 git 追蹤**
（`git status` 顯示 `?? CLAUDE.md`），我也沒留下備份檔，所以取不回逐字舊版。
實際損失為零：新版是舊版的嚴格超集，唯一被**取代**（而非附加）的是
〈本專案的驗證指令〉那三行，而那三行是錯的——它宣稱
「`package.json` 無 `scripts.test`、沒有驅動真視窗的工具」，
但 `package.json:9` 有 `"test": "node tests/run.js"`，`tests/main.js` 就是真視窗驅動器。

**你要的若是 B，說一聲，重跑 `/collab-kit-init` 即可。**

---

## 待你執行／待你批准的動作

- [ ] **是否要加 Playwright / WebdriverIO** 做跨瀏覽器驗證｜
  現行測試只跑 Electron 內建的 Chromium，**驗不到 iOS Safari 的真實行為**——
  而使用者是「手機平板訪問網站」，其中 iPhone / iPad 一律是 WebKit｜
  已備好：`tests/cases/` 的 case 結構與 `tests/main.js` 的 viewport 抽象，
  換驅動時 case 幾乎不用改｜
  不做的後果：Safari 專屬問題（`100dvh` 行為、`touch-action` 差異、
  `DataTransfer` 建構）只能靠規格推論，沒有實跑證據。屬「新增相依套件」＝高風險，
  我不會自己裝

- [ ] **GitHub Pages 部署驗證**｜`git log` 有 CNAME commit，代表這份 app 也以網站形式發布｜
  已備好：所有修正都是純前端靜態檔，不需建置步驟｜
  不做的後果：只驗到本地 Electron，沒驗到實際線上網址

- [ ] **修 mobile viewport 的 off-by-one，讓 25 條紅測試能真的跑**｜
  `tests/main.js` 要求 390px，實得 391px，25 條 mobile case 在斷言業務行為之前就掛掉——
  等於 mobile 這個 viewport 目前**零覆蓋**，而使用者主要就是手機｜
  已定位：單一原因，`useContentSize` 在此機器的 DPI 縮放下差 1px｜
  不做的後果：手機版任何回歸都測不到。屬改測試框架程式碼，不是本輪
  `/collab-kit-init` 的範圍，已排進 `ROADMAP.md` `[now]`

## 卡住（修 3 次仍紅）

<!-- - <症狀>｜試過什麼｜每次的錯誤｜我認為根因在哪 -->

（本輪無。25 條紅測試不在這裡——它們是單一已定位的環境原因，
不是「修 3 次仍紅」，見 `ROADMAP.md`〈待辦項目〉與 `SOP.md`。）

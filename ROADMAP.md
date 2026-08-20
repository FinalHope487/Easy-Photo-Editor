# Roadmap

與當前委派無關的新想法寫進來並標記，不當場插隊打斷目前任務。

## 標記說明

- `[now]` — 阻塞當前任務
- `[next]` — 目前模組穩定後就做
- `[later]` — 現在做屬於過早設計，等需求明確再說
- `[parked]` — 先記錄，暫不評估

---

## 待辦項目

<!-- 格式：- [標記] 說明（可附上下文/來源 session） -->

- `[next]` **升級 `electron` / `electron-builder` 清掉 `npm audit` 的 18 個漏洞**
  （17 high、1 critical；critical 是 `tar` 的 path traversal）。
  **你已授權**（2026-08-19：「pr 合完直接做」），但**卡在 PR #4 / #5 合併之後**——
  在未合併的分支上動 `package.json` 與 lock 會讓兩個 PR 都變得難審。
  做法：升級 → 跑完整 `npm test`（含 WebKit 那層）→ 有壞就回退，不硬上。
  要留意 Electron 大版本升級可能動到 `tests/main.js` 依賴的 CDP 行為
  （`Emulation.setDeviceMetricsOverride`、`Input.dispatchTouchEvent`）。
  這些都是 devDependency，不影響 GitHub Pages 的線上版（線上只有靜態檔）。

---

**原本的四項已全部處理完**：兩項 `[next]` 已實作並有測試守著；
兩項 `[later]` 一項你批准後已接進 `npm test`，一項已備好並實跑。

- ~~`[next]` 文字工具的預設字級是 5px~~ → 已修。字級與筆刷粗細分家，
  預設 = 圖高/12（commit `1cd8936`）
- ~~`[next]` 手機版面板高度上限是取捨過的 32vh~~ → 已加收合列。
  32vh 保留：面板展開時仍不可蓋住畫布中心，有測試釘著（commit `e6a5afe`）
- ~~`[later]` 跨瀏覽器（WebKit / iOS Safari）驗證層~~ → **你已批准安裝 playwright**，
  現在是 `npm test` 裡的一條真測試（子行程跑 `tests/webkit/run.js`，
  iPhone 13 + iPad 共 12 條斷言）。單獨跑：`npm run test:webkit`
- ~~`[later]` GitHub Pages 線上版的部署後驗證~~ → 已備好並實跑
  `npm run test:pages`，目前 1 passed / 7 failed ＝線上版還沒有這些修正

---

## 已拍板的決策

<!-- 兩種來源：問過使用者的答案，以及你自己定案的選擇。
     自己定案的要附依據（既有慣例在哪個檔哪一行）與反悔成本。
     不要下一輪又拿出來重問 -->

- **(2026-08-19) 使用者層測試用 Electron + CDP，不新增測試框架。**
  依據：`package.json` 的 `devDependencies` 已有 `electron` ^40.6.1，
  用它的 debugger 開真 Chromium 載真 `index.html`，零新增相依。
  進入點 `package.json` 的 `"test": "node tests/run.js"`。
  反悔成本：刪 `tests/` 目錄 + 移除 `package.json` 一行，不影響任何既有檔案。

- **(2026-08-19) viewport 用 CDP `Emulation.setDeviceMetricsOverride` 指定，
  不用 `BrowserWindow` 的 `useContentSize`。**
  依據：視窗尺寸是 DIP，在有 DPI 縮放的機器上 390 會變成 391，
  25 條 mobile case 全部在前置斷言就掛掉（等於 mobile 零覆蓋）。
  CDP 直接給 CSS 像素數，與機器縮放比例無關。
  另一條路是把斷言放寬成 ±2px，不採用——那會放掉「viewport 真的套用了」這個保證。
  反悔成本：`tests/main.js` 的 `makeWindow` 一段，改回去即可。

- **(2026-08-19) 測試視窗開在畫面外（-4000,-4000）+ `focusable: false`，不用 `show: false`。**
  依據：使用者要求測試不要彈出佔畫面。但隱藏視窗不產生 compositor frame，
  觸控事件只能等 ack 逾時，每個事件卡 ~1.4s。改成「開著但在畫面外」，
  配合 `run.js` 的 `--disable-features=CalculateNativeWinOcclusion` 讓它繼續出圖。
  實測：改後每條測試耗時與可見視窗時相同（指標群 800~1500ms/條）。
  反悔成本：`tests/main.js` 的 `x`/`y`/`focusable` 三行 + `run.js` 三個旗標。

- **(2026-08-19) 手勢期間凍結座標換算基準（`coordFreeze`）。**
  依據：`getCanvasCoords` 即時讀 `panX/panY/scale`，而 `window resize` 會走
  `fitToScreen` 改掉它們（`js/ui.js` 的 resize listener）。手機網址列收合、轉向、
  視窗縮放都會在下筆途中觸發，同一筆的前後半段落在不同位置。
  反悔成本：`js/tools.js` 的 `freezeCoords` 一個函式 + 三處呼叫。

- **(2026-08-19) 字級與筆刷粗細分成兩個值，預設字級照圖片高度推算。**
  依據：兩者原本共用 `toolSize`，預設 5px 對筆刷合理、對字級是「打了看不見」。
  固定預設值（例如一律 32px）在 4000px 的圖上一樣看不見，所以取比例：圖高/12，
  夾在 12~400。同一個滑桿在文字工具下代表字級、上限跟著圖高走。
  反悔成本：`js/core.js` 兩個小函式 + `js/ui.js` 的 `syncSizeSlider`，
  已存在的文字物件不受影響（`fontSize` 本來就存在物件裡）。

- **(2026-08-19) 手機屬性面板用「收合列」，不用分頁或可拖曳 sheet。**
  依據：屬性項目數量隨工具變動（裁切只有一顆按鈕、文字有四組），
  分頁在只有一組時是多餘的框；可拖曳 sheet 要跟畫布本身的拖曳搶手勢。
  收合列是三者中唯一不新增手勢的。換工具自動展開——剛選完工具多半就是要調參數。
  反悔成本：`index.html` 一個 button、`css/mobile.css` 一段、`js/ui.js` 兩個小函式。

- **(2026-08-19・你批准) 安裝 playwright，WebKit 那層接進 `npm test`。**
  你在本輪回答「批准安裝」。已跑 `npm i -D playwright` +
  `npx playwright install webkit`，並把 `tests/cases/crossbrowser.js` 從
  skip 佔位改成用子行程跑 `tests/webkit/run.js`（用 `process.execPath` +
  `ELECTRON_RUN_AS_NODE=1`，不依賴系統 PATH 上的 node）。
  WebKit 12 條斷言，整包約 7 秒，併入 `npm test` 的紅綠。
  **`npm audit` 的 18 個漏洞不是 playwright 帶進來的**——逐項看過，
  全部來自既有的 `electron` / `electron-builder` 依賴樹，playwright 不在名單上。
  反悔成本：`npm rm -D playwright` + 把 `crossbrowser.js` 改回 skip 佔位。

- **(2026-08-19) 高風險的兩層驗證「備好但不接上」。**
  依據：CLAUDE.md〈工作模式〉「高風險項：不做，而不是停下來問」。
  WebKit 那層需要新增 devDependency，寫好 runner 但不安裝，
  用 skip-with-reason 讓「這一層沒有覆蓋」以 ○ 的形式出現在 `npm test`，
  不會安靜消失、也不會把總數弄紅。
  反悔成本：刪 `tests/webkit/`、`tests/cases/crossbrowser.js` 與兩行 script。

- **(2026-08-19) `#attr-panel` 從 `tools-sidebar` 搬到 `main-content` 底下。**
  依據：手機版 `tools-sidebar` 是 `position:fixed` + `backdrop-filter`，
  會成為 fixed 子元素的 containing block 並用自己的 `overflow` 把面板切掉。
  搬到 `main-content`（桌機原本就是它當 containing block）→ 桌機幾何完全不變。
  反悔成本：`index.html` 一個區塊搬回去，但手機版會再次不可操作。

---

## 變更紀錄

<!-- 只記「日期 / 做了什麼 / 測試數」，加上不在別處的教訓。
     決策與理由在上面那一節，重複問題在 SOP.md，逐檔改動在 git log。這裡不複述 -->

- **2026-08-19 · 修掉手機／平板碰不到的操作 + 使用者層測試補齊**
  改動檔案：`index.html`、`js/core.js`、`js/tools.js`、`css/components.css`、
  `css/mobile.css`、`tests/`（新增）、`.gitignore`。commit `fd59820`。
  **測試數（實跑）**：`npm test` → **71 passed, 0 failed, 0 skipped（共 71）**。
  起點是 41/25（25 條 mobile 全掛在 viewport 前置斷言）。
  三個 viewport：desktop 1280×800、tablet 820×1100、mobile 390×844。
  **紅得有理由已逐條驗證**：把 `coordFreeze`、文字命中半徑上限、面板 `z-index`
  各改壞一次，確認只有對應的那條變紅，改回後全綠。
  **教訓（不在別處）**：
  1. 「元素在畫面內」跟「元素點得到」是兩件事。原本的版面測試只斷言
     `getBoundingClientRect` 落在 viewport 內，面板被祖先 `overflow` 切掉、
     或被畫布蓋住時，它照樣全綠——而使用者一根手指也碰不到。
     斷言要問 `document.elementFromPoint`。
  2. 一條「偶爾紅」的測試（橡皮擦擦不乾淨）跟一條「總是紅」的測試可以是同一個
     根因。橡皮擦那條的多出來的墨跡，就是下筆途中 resize 被扯出來的那條斜線。
     先別急著把偶發的那條標成 flaky。

- **2026-08-19 · 清空 ROADMAP 待辦：字級分家、面板收合、兩層驗證備好**
  改動檔案：`js/core.js`、`js/ui.js`、`js/tools.js`、`index.html`、`css/mobile.css`、
  `tests/`、`package.json`。commit `1cd8936`、`e6a5afe`、`fa32458`。
  **測試數（實跑）**：`npm test` → **79 passed, 0 failed, 0 skipped（共 79）**，
  含 WebKit 那條（子行程 12 條斷言，約 7 秒）。
  `npm run test:webkit` → **12 passed, 0 failed**（iPhone 13 + iPad gen 7）。
  `npm run test:pages` → **1 passed, 7 failed**：線上版還沒有這些修正，預期中的紅。
  **教訓（不在別處）**：
  1. 等非同步事件不要比對「呼叫當下的長度」。`waitForDownload` 這樣寫，
     在下載比呼叫更快完成時會變成等第二個永遠不會來的下載——症狀是
     檔案明明已經落地，測試卻說「沒有檔案落地」。要用佇列取件。
  2. 部署後驗證的標記字串必須是**這一輪才出現**的。第一版拿 `id="attr-panel"`
     與 `z-index: 20` 當標記，兩者在修正前的版本也存在，於是給出假的綠。
  3. 用 `git checkout <檔>` 還原「為了驗紅而改壞的地方」，會連同**同一個檔案裡
     還沒 commit 的新工作**一起丟掉。改壞要用能精準還原的方式（改回那一行），
     或先 commit 再改壞。
  4. 新增一層驗證之後，第一件事是**證明它會紅**。WebKit 那層第一版的收合斷言
     只問 `body` 有沒有那個 class——CSS 整段拿掉它照樣綠。改成問
     `elementFromPoint`，再把 CSS 改壞一次，兩台裝置都紅了才算數。

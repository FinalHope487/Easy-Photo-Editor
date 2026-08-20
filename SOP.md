# SOP

重複問題的處理路徑記錄。

## 觸發條件

同一類問題第二次出現，立刻補一條。第一次出現不寫（可能是偶發）。
例外：由環境／工具本身決定、必然重現的問題，第一次就寫。

## 格式

`[症狀] → [優先檢查順序] → [根因類型]`

每條開頭註明 `(日期・工具/模型版本)`——這條是針對哪個版本的行為寫的，
決定了它什麼時候該退場。

若這條教訓是「以後行為要改」而不只是「怎麼查」，加一行
`→ 已升格為 CLAUDE.md 的〈哪一節〉`，並實際寫進 `CLAUDE.md`。

## 退場

工具鏈或模型換代時逐條問「這條還在幫忙嗎」。不再重現的移到最底下的〈已退役〉，
註明退役日期與原因。退役不是刪除——留著才知道曾經踩過。

範例：
`啟動時連不上 Discord → 1. 檢查 .env token 2. 檢查網路/proxy 3. 檢查 intents 設定 → 設定值缺漏`

---

## 條目

<!-- 新條目往下加，不刪舊條目 -->

**(2026-08-19・Windows 11 + Electron 40.6.1 + Node v24.14.0・Opus 5)**
`npm test` 有一整批測試同時紅、錯誤訊息字面完全相同 →
1. 先看**失敗訊息是不是全都一樣**（`npm test 2>&1 | grep -A1 '✗' | sort | uniq -c`）
2. 一樣就當成單一環境原因，不要逐條 debug
3. 對照失敗集中在哪個 viewport / 環境維度（本例：25 條全是 `[mobile]`）
→ 根因類型：測試環境設定，不是被測程式。
本例具體根因：`tests/main.js` 用 `BrowserWindow` 的 `useContentSize` 開 390px，
在此機器的 DPI 縮放下得到 391px，viewport 前置斷言先掛，業務斷言根本沒跑到。
已改用 CDP `Emulation.setDeviceMetricsOverride`。
**教訓**：「25 條紅」看起來像產品壞了，實際是 mobile 覆蓋為零——
比壞掉更糟，因為它會以「有測試」的形式活著。

**(2026-08-19・Git Bash on Windows・Opus 5)**
用 Bash heredoc（`cat > file <<'EOF'`）寫大段中文 Markdown → 回
`unexpected EOF while looking for matching "'"`，指令整條在 parse 階段就中止 →
1. 不要重試第二次、不要改引號
2. 直接改用 Write / Edit 工具
→ 根因類型：工具鏈限制。
**副作用要留意**：整條指令 parse 失敗代表**同一條 `&&` 鏈裡的前置動作也沒執行**——
本例的 `cp CLAUDE.md ...bak` 備份沒建成，我以為有備份其實沒有。
備份要獨立成一條指令跑，不要跟寫入串在同一條。

**(2026-08-19・Electron 40.6.1 + Chromium・Opus 5)**
UI 元素「明明在畫面內、尺寸也正常」，但點下去沒反應 →
1. `document.elementFromPoint(中心點)` 問那個位置最上層是誰
2. 不是自己 → 往上走 ancestor chain，看誰有
   `position: fixed/absolute`、`transform`、`filter`、`backdrop-filter`、`overflow: hidden`
3. `backdrop-filter` 會讓該元素成為 fixed 子元素的 **containing block**，
   接著它自己的 `overflow` 就會把子元素切掉——子元素的 `z-index` 再高也沒用
4. 同層的定位元素之間，沒給 `z-index` 就是 DOM 順序決定誰在上面
→ 根因類型：CSS 堆疊與裁切，不是事件處理。
**已升格為測試寫法**：版面類測試不可以只斷言 `getBoundingClientRect` 在 viewport 內，
必須加 `elementFromPoint` 的命中斷言。只驗前者的測試會在功能完全不可操作時全綠。

**(2026-08-19・Electron 40.6.1 on Windows・Opus 5)**
CDP `Input.dispatchTouchEvent` 每個事件卡 ~1.4 秒（7 個事件的拖曳要 10s）→
1. 先確認視窗是不是 `show: false`——隱藏視窗不產生 compositor frame，
   輸入事件的 ack 只能等逾時
2. 需要「不佔畫面又要快」時：`show: true` + 座標開在畫面外（如 -4000,-4000）
   + `focusable: false`，並在 spawn 參數加
   `--disable-features=CalculateNativeWinOcclusion`
   （Windows 會判定畫面外的視窗被遮蔽而停止出圖）
3. 實測分辨法：同一段拖曳，正常是 ~29ms，中招是 ~10s
→ 根因類型：測試環境設定。

**(2026-08-19・Git Bash on Windows・Opus 5)**
在 `node -e "..."` 裡放含反引號的中文 Markdown → 反引號被 shell 當成指令替換執行，
寫進檔案的是 `npm error Missing script` 之類的垃圾，而且**指令回傳成功**→
1. 不要用 `node -e "..."` 或 heredoc 寫含 `` ` `` 的內容
2. 直接用 Write / Edit 工具
→ 根因類型：工具鏈限制。與上面那條 heredoc 是同一家族。
**辨識方法**：寫完後 `tail` 一下檔案。這個失敗不會回非零 exit code，
只看 exit code 會以為成功。

**(2026-08-19・Node/Electron 測試 harness・Opus 5)**
測試報「某個非同步結果沒發生」，但實際產物明明已經存在（檔案已落地、DOM 已更新）→
1. 先看等待函式是不是在比對「呼叫當下的長度／狀態」
2. 事件比呼叫更早發生時，這種寫法會變成在等下一個永遠不會來的事件
3. 改成佇列取件（`shift()`），或在動作**之前**就先記錄基準
→ 根因類型：測試 harness 競態，不是被測程式。
本例：`waitForDownload` 比對 `this.downloads.length`，
下載在 `waitForDownload` 被呼叫前就完成 → 逾時，但 `%TEMP%` 裡檔案好好的。

**(2026-08-19・Git・Opus 5)**
為了「驗紅」把程式改壞，然後用 `git checkout <檔>` 還原 →
**同一個檔案裡還沒 commit 的新工作會一起被丟掉**，而且沒有任何警告 →
1. 改壞要用能精準還原的方式（把那一行改回去），不要用 `git checkout`
2. 或者先 commit 目前的工作，再改壞
→ 根因類型：工具語意。`git checkout <檔>` 是「用 index 覆蓋工作目錄」，
不是「復原我剛剛那一次修改」。

**(2026-08-19・任何測試框架・Opus 5)**
新加一層驗證，第一次跑就全綠 → **先假設它驗不到東西**，不要當成好消息 →
1. 把被驗的行為改壞一次，看那一層有沒有紅
2. 沒紅就看斷言問的是什麼：問「class 有沒有加上去」「元素存不存在」這類
   狀態旗標，CSS／樣式整段拿掉它照樣綠
3. 改成問使用者實際碰得到的東西（`elementFromPoint`、實際像素、實際檔案）
→ 根因類型：斷言選錯層級。
本例：WebKit 那層第一版問 `body.classList.contains('attrs-collapsed')`，
把整段收合 CSS 拿掉仍然 12 條全綠。

**(2026-08-19・Git Bash on Windows・Opus 5)**
用 `sed -i` 改一行，結果 `git status` 說整個檔案被改了、但 `git diff` 是空的 →
`sed -i` 會把整個檔案的 CRLF 重寫成 LF，即使你只換了一行 →
1. 用 `wc -c` 比對位元組數（本例 779 → 748，31 行各少 1 byte）
2. 要原封不動的檔案就 `git checkout -- <檔>` 還原
3. 「不可碰的檔案」不要用 `sed -i`，用 Edit 工具
→ 根因類型：工具行為。
**危險在於**：`git diff` 空會讓你以為沒事，實際上檔案的位元組已經變了。
與〈驗證〉「拿 cmp 比對改動前後的輸出」是同一個道理。

**(2026-08-19・任何 e2e 測試・Opus 5)**
測試全綠但升級／改動打到的那條路徑其實沒人走過 →
1. 問「測試是從哪裡進去的」，跟「使用者是從哪裡進去的」比對
2. 本例：79 條測試全部是測試自己 `new BrowserWindow` + `loadFile`，
   **完全不經過 app 的進入點 `main.js`**。Electron 大版本升級把 `main.js`
   用到的 API 換掉時，79 條照樣全綠，而使用者按下去的 app 開不起來
3. 補一條真的走進入點的測試（spawn `electron .` + 遠端除錯埠 + 連進去斷言）
→ 根因類型：測試進入點與使用者進入點不一致。
升級相依套件時特別容易踩到：升級影響的是「怎麼啟動」，而測試通常跳過啟動。

**(2026-08-20・GitHub + gh CLI・Opus 5)**
合併疊在一起的 PR（#5 的 base 是 #4 的分支）時用 `gh pr merge --delete-branch` →
**下游那個 PR 會被自動 CLOSED，不是改指向 main**，而且救不回來：
`gh pr reopen` 會回 `Could not open the pull request`，
`gh pr edit --base` 會回 `Cannot change the base branch of a closed pull request` →
1. 合上游之前，先把下游 PR 的 base 改掉：`gh pr edit <下游> --base main`
2. 已經誤刪的話：把被刪的 base 分支推回去
   （`git push origin <該分支的 tip sha>:refs/heads/<分支名>`），
   再 `gh pr reopen` → `gh pr edit --base main` → 合完再刪分支
3. tip sha 從 `gh pr view <上游> --json headRefOid` 拿得到，
   本機分支已被 `--delete-branch` 一起刪掉時特別有用
→ 根因類型：工具語意。分支刪除會連帶關閉以它為 base 的 PR。
**順序原則**：先讓所有 PR 都指向 main，再開始合，最後才刪分支。

---

## 已退役

<!-- 條目退場時搬到這裡，註明退役日期與原因 -->

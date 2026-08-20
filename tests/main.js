// Electron 主行程測試驅動器。
//
// 為什麼是這一層：CLAUDE.md〈驗證〉要求打在使用者實際接觸的那一層。
// 這個 app 是「瀏覽器裡的畫布」，使用者用滑鼠或手指直接操作 canvas。
// 所以測試載入真的 index.html，透過 CDP 的 Input domain 發**真的**
// touch / mouse / key 事件，斷言真的 DOM 與 canvas 狀態。
// 不 stub DOM、不直接呼叫內部函式。

const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const ROOT = process.env.EPE_ROOT || path.join(__dirname, '..');
const RESULTS = process.env.EPE_RESULTS || path.join(__dirname, '.results.json');
const ONLY = (process.env.EPE_ONLY || '').trim();
const DOWNLOAD_DIR = path.join(require('os').tmpdir(), 'epe-test-downloads');
fs.rmSync(DOWNLOAD_DIR, { recursive: true, force: true });
fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

const VIEWPORTS = {
    desktop: { width: 1280, height: 800, touch: false },
    tablet: { width: 820, height: 1100, touch: true },
    mobile: { width: 390, height: 844, touch: true },
};

const KEYCODES = {
    Enter: 13, Escape: 27, Backspace: 8, Delete: 46, Tab: 9, ' ': 32,
    ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40,
};

class Ctx {
    constructor(win, viewportName) {
        this.win = win;
        this.wc = win.webContents;
        this.dbg = win.webContents.debugger;
        this.viewport = viewportName;
        this.isTouch = VIEWPORTS[viewportName].touch;
        this._touchId = 1;
    }

    cdp(method, params) { return this.dbg.sendCommand(method, params || {}); }

    eval(js) { return this.wc.executeJavaScript(js, true); }

    async waitFor(js, { timeout = 4000, label = js } = {}) {
        const start = Date.now();
        for (;;) {
            let v;
            try { v = await this.eval(`(() => { try { return (${js}); } catch (e) { return false; } })()`); }
            catch { v = false; }
            if (v) return v;
            if (Date.now() - start > timeout) throw new Error(`waitFor 逾時 (${timeout}ms)：${label}`);
            await sleep(40);
        }
    }

    sleep(ms) { return sleep(ms); }

    // --- 指標輸入：mobile/tablet 走 touch，desktop 走 mouse ---

    async press(x, y) {
        if (this.isTouch) {
            this._touchId++;
            await this.cdp('Input.dispatchTouchEvent', {
                type: 'touchStart', touchPoints: [{ x, y, id: this._touchId }],
            });
        } else {
            await this.cdp('Input.dispatchMouseEvent', {
                type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1,
            });
        }
    }

    async moveTo(x, y) {
        if (this.isTouch) {
            await this.cdp('Input.dispatchTouchEvent', {
                type: 'touchMove', touchPoints: [{ x, y, id: this._touchId }],
            });
        } else {
            await this.cdp('Input.dispatchMouseEvent', {
                type: 'mouseMoved', x, y, button: 'left', buttons: 1,
            });
        }
    }

    async release(x, y) {
        if (this.isTouch) {
            await this.cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        } else {
            await this.cdp('Input.dispatchMouseEvent', {
                type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1,
            });
        }
    }

    /** 從 (x1,y1) 拖到 (x2,y2)，中間走 steps 個中繼點。 */
    async drag(x1, y1, x2, y2, steps = 5) {
        await this.press(x1, y1);
        for (let i = 1; i <= steps; i++) {
            await this.moveTo(x1 + ((x2 - x1) * i) / steps, y1 + ((y2 - y1) * i) / steps);
        }
        await this.release(x2, y2);
        await sleep(60);
    }

    async tap(x, y) {
        await this.press(x, y);
        await sleep(30);
        await this.release(x, y);
        await sleep(60);
    }

    /** 兩指張開／收合，用來測 pinch zoom。 */
    async pinch(cx, cy, fromGap, toGap, steps = 8) {
        const pts = (gap) => [
            { x: cx - gap / 2, y: cy, id: 101 },
            { x: cx + gap / 2, y: cy, id: 102 },
        ];
        await this.cdp('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts(fromGap) });
        await sleep(20);
        for (let i = 1; i <= steps; i++) {
            await this.cdp('Input.dispatchTouchEvent', {
                type: 'touchMove', touchPoints: pts(fromGap + ((toGap - fromGap) * i) / steps),
            });
            await sleep(16);
        }
        await this.cdp('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await sleep(60);
    }

    /** 點一個 DOM 元素的正中央（用真事件，不是 el.click()）。 */
    async tapSelector(selector) {
        const box = await this.eval(
            `(() => { const el = document.querySelector(${JSON.stringify(selector)});
              if (!el) return null; const r = el.getBoundingClientRect();
              return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; })()`
        );
        if (!box) throw new Error(`找不到元素：${selector}`);
        if (box.w === 0 || box.h === 0) throw new Error(`元素不可見（0×0）：${selector}`);
        await this.tap(box.x, box.y);
    }

    // --- 鍵盤 ---

    async key(k, modifiers = 0) {
        const isChar = k.length === 1 && k !== ' ';
        const vk = KEYCODES[k] || (isChar ? k.toUpperCase().charCodeAt(0) : 0);
        const code = isChar ? `Key${k.toUpperCase()}` : k;
        const base = { key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk, modifiers };
        await this.cdp('Input.dispatchKeyEvent', {
            ...base, type: isChar && !modifiers ? 'keyDown' : 'rawKeyDown',
            ...(isChar && !modifiers ? { text: k, unmodifiedText: k } : {}),
        });
        await this.cdp('Input.dispatchKeyEvent', { ...base, type: 'keyUp' });
        await sleep(25);
    }

    async typeText(str) {
        for (const ch of str) await this.key(ch);
    }

    // --- 測試素材 ---

    /** 走真的 <input type=file> change 路徑載入一張圖，跟使用者選檔一樣。 */
    async loadImage(w = 400, h = 300) {
        await this.eval(`(async () => {
            const c = document.createElement('canvas');
            c.width = ${w}; c.height = ${h};
            const x = c.getContext('2d');
            x.fillStyle = '#ffffff'; x.fillRect(0, 0, ${w}, ${h});
            x.fillStyle = '#204080'; x.fillRect(0, 0, ${w} / 2, ${h} / 2);
            const blob = await new Promise(r => c.toBlob(r, 'image/png'));
            const dt = new DataTransfer();
            dt.items.add(new File([blob], 'fixture.png', { type: 'image/png' }));
            const input = document.getElementById('file-upload');
            input.files = dt.files;
            input.dispatchEvent(new Event('change', { bubbles: true }));
            return true;
        })()`);
        await this.waitFor(`!!window.editor && !!window.editor.image && document.body.classList.contains('has-image')`,
            { label: '圖片載入完成' });
        await sleep(150);
    }

    /** modLayer 上有幾個非透明像素——「有沒有真的畫上去」的證據。 */
    inkPixels() {
        return this.eval(`(() => {
            const c = window.editor.modLayer;
            if (!c || !c.width) return 0;
            const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
            let n = 0;
            for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++;
            return n;
        })()`);
    }

    /** modLayer 上有筆跡的那塊矩形。用來問「筆跡長什麼形狀」，不只是「有沒有」。 */
    inkBox() {
        return this.eval(`(() => {
            const c = window.editor.modLayer;
            if (!c || !c.width) return null;
            const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
            let minX = 1e9, maxX = -1, minY = 1e9, maxY = -1;
            for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
                if (d[(y * c.width + x) * 4 + 3] > 0) {
                    if (x < minX) minX = x;
                    if (x > maxX) maxX = x;
                    if (y < minY) minY = y;
                    if (y > maxY) maxY = y;
                }
            }
            if (maxX < 0) return null;
            return { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1 };
        })()`);
    }

    /** 改可視範圍。模擬轉向／手機網址列收合——這會讓頁面收到真的 resize。 */
    setViewport(width, height) {
        return this.cdp('Emulation.setDeviceMetricsOverride', {
            width, height, deviceScaleFactor: 1, mobile: false,
        });
    }

    resetViewport() {
        const vp = VIEWPORTS[this.viewport];
        return this.setViewport(vp.width, vp.height);
    }

    /** 等一個下載完成，回傳 { filename, path }。按下「儲存」後真的有檔案落地才算過。 */
    async waitForDownload({ timeout = 6000 } = {}) {
        // 用佇列取件，不要比對「呼叫當下的長度」：下載可能在這個函式被呼叫之前
        // 就已經完成，那樣比長度會變成在等第二個永遠不會來的下載。
        const start = Date.now();
        while (this.downloads.length === 0) {
            if (Date.now() - start > timeout) throw new Error(`等下載逾時 (${timeout}ms)：沒有檔案落地`);
            await sleep(80);
        }
        const dl = this.downloads.shift();
        if (dl.state !== 'completed') throw new Error(`下載未完成：state=${dl.state}`);
        return dl;
    }

    /** 把落地的圖檔讀回頁面裡取樣像素，驗匯出內容而不是只驗「有檔案」。 */
    async samplePng(filePath, points) {
        const dataUrl = 'data:image/png;base64,' + fs.readFileSync(filePath).toString('base64');
        return this.eval(`(async () => {
            const img = new Image();
            await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = ${JSON.stringify(dataUrl)}; });
            const c = document.createElement('canvas');
            c.width = img.width; c.height = img.height;
            const x = c.getContext('2d');
            x.drawImage(img, 0, 0);
            return {
                width: img.width, height: img.height,
                pixels: ${JSON.stringify(points)}.map(p => Array.from(x.getImageData(p[0], p[1], 1, 1).data)),
            };
        })()`);
    }

    /** 畫布中心的視窗座標。 */
    canvasCenter() {
        return this.eval(`(() => {
            const r = document.getElementById('editor-canvas').getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2,
                     left: r.left, top: r.top, width: r.width, height: r.height };
        })()`);
    }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function assert(cond, msg) {
    if (!cond) throw new Error(msg || '斷言失敗');
}
assert.equal = (actual, expected, msg) => {
    if (actual !== expected) {
        throw new Error(`${msg || '值不符'}\n  預期：${JSON.stringify(expected)}\n  實際：${JSON.stringify(actual)}`);
    }
};
assert.atLeast = (actual, min, msg) => {
    if (!(actual >= min)) throw new Error(`${msg || '值太小'}\n  預期 ≥ ${min}\n  實際：${actual}`);
};
assert.atMost = (actual, max, msg) => {
    if (!(actual <= max)) throw new Error(`${msg || '值太大'}\n  預期 ≤ ${max}\n  實際：${actual}`);
};

async function makeWindow(viewportName) {
    const vp = VIEWPORTS[viewportName];
    const win = new BrowserWindow({
        // 視窗要「開著」但不能擋住使用者的螢幕。
        // show: false 不行——隱藏視窗不產生 compositor frame，觸控事件的 ack 只能等逾時，
        // 每個 Input.dispatchTouchEvent 會卡 ~1.4 秒（實測 7 個事件 10.0s vs 顯示時 29ms）。
        // 所以改成開在畫面外，並配合 run.js 關掉 Windows 的遮蔽判定，讓它繼續出圖。
        show: true,
        x: -4000,
        y: -4000,
        frame: false,
        skipTaskbar: true,
        focusable: false,   // 不搶走使用者正在打字的視窗焦點
        alwaysOnTop: false,
        width: vp.width,
        height: vp.height,
        useContentSize: true,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            backgroundThrottling: false,
            // 每個 viewport 一個獨立 session，否則三個視窗共用 defaultSession，
            // will-download 會有三個 listener 互相覆寫 setSavePath。
            partition: `test-${viewportName}`,
        },
    });
    await win.loadFile(path.join(ROOT, 'index.html'));
    win.webContents.debugger.attach('1.3');
    await win.webContents.debugger.sendCommand('Input.setIgnoreInputEvents', { ignore: false });
    // 視窗尺寸是 DIP，在有 DPI 縮放的機器上換算回 CSS px 會差 1（390 → 391），
    // 於是每條 mobile case 都在前置斷言就掛掉。用 CDP 直接指定 viewport 的
    // CSS 像素數，寬高就是要求的數字，跟機器的縮放比例無關。
    await win.webContents.debugger.sendCommand('Emulation.setDeviceMetricsOverride', {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 1,
        mobile: false,
    });
    if (vp.touch) {
        // 只開觸控模擬。不開 setEmitTouchEventsForMouse——我們本來就發真的
        // TouchEvent，多開一層 mouse→touch 轉換只會讓輸入路徑多一組行為差異。
        await win.webContents.debugger.sendCommand('Emulation.setTouchEmulationEnabled', {
            enabled: true, maxTouchPoints: 5,
        });
    }

    // 收集 renderer 的錯誤，測試失敗時一起附上——否則只看得到「逾時」看不到原因
    const pageErrors = [];
    win.webContents.on('console-message', (_e, level, message) => {
        if (level >= 2 && !message.includes('Electron Security Warning')) {
            pageErrors.push(message.split('\n')[0].slice(0, 300));
        }
    });
    // Chromium 對同一個來源的「自動下載」有次數限制，第二次之後會要求授權。
    // 測試裡沒有人能按那個提示，所以一律放行。
    const ses = win.webContents.session;
    ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(true));
    ses.setPermissionCheckHandler(() => true);

    // 攔下載：按「儲存」之後真的有檔案落地，才算匯出成功
    const downloads = [];
    let dlSeq = 0;
    const onWillDownload = (_event, item) => {
        const target = path.join(DOWNLOAD_DIR, `${viewportName}-${dlSeq++}-${item.getFilename()}`);
        item.setSavePath(target);
        item.once('done', (_e, state) => {
            downloads.push({ filename: item.getFilename(), path: target, state });
        });
    };
    win.webContents.session.on('will-download', onWillDownload);

    // 等 app.js 的 DOMContentLoaded 初始化跑完
    const ctx = new Ctx(win, viewportName);
    ctx.downloads = downloads;
    ctx._cleanupSession = () => win.webContents.session.removeListener('will-download', onWillDownload);
    await ctx.waitFor('!!window.editor', { label: 'window.editor 初始化' });
    const w = await ctx.eval('window.innerWidth');
    assert.equal(w, vp.width, `viewport 寬度沒有套用（useContentSize 失效）`);
    return ctx;
}

// 每個 viewport 只開一個視窗，測試之間用 reload 洗掉狀態。
// 每條測試都開新視窗會讓 Chromium 在連續開關下回 ERR_FAILED。
const windowPool = new Map();

async function getContext(viewportName) {
    if (!windowPool.has(viewportName)) {
        windowPool.set(viewportName, await makeWindow(viewportName));
        return windowPool.get(viewportName);
    }
    const ctx = windowPool.get(viewportName);
    ctx.downloads.length = 0;
    // 上一條測試可能改過可視範圍（測轉向／網址列收合），一律先復原，
    // 否則洩漏到下一條測試身上會變成很難查的假紅。
    await ctx.resetViewport();
    ctx.wc.reload();
    await new Promise((res, rej) => {
        const ok = () => { cleanup(); res(); };
        const bad = (_e, code, desc) => { cleanup(); rej(new Error(`reload 失敗 ${code} ${desc}`)); };
        const cleanup = () => {
            ctx.wc.removeListener('did-finish-load', ok);
            ctx.wc.removeListener('did-fail-load', bad);
        };
        ctx.wc.once('did-finish-load', ok);
        ctx.wc.once('did-fail-load', bad);
    });
    await ctx.waitFor('!!window.editor', { label: 'reload 後 window.editor 初始化' });
    return ctx;
}

function closeAllWindows() {
    for (const ctx of windowPool.values()) {
        try { ctx._cleanupSession(); } catch { /* 已移除 */ }
        try { ctx.dbg.detach(); } catch { /* 已 detach */ }
        try { ctx.win.destroy(); } catch { /* 已關閉 */ }
    }
    windowPool.clear();
}

async function main() {
    const suites = [
        require('./cases/keyboard.js'),
        require('./cases/pointer.js'),
        require('./cases/layout.js'),
        require('./cases/text.js'),
        require('./cases/export.js'),
        require('./cases/a11y.js'),
        require('./cases/crossbrowser.js'),
    ];

    const tests = [];
    for (const suite of suites) {
        for (const c of suite.cases) {
            for (const vp of c.viewports || suite.viewports || ['desktop']) {
                if (ONLY && !(`${suite.group} ${c.name} ${vp}`).toLowerCase().includes(ONLY.toLowerCase())) continue;
                tests.push({ group: suite.group, name: c.name, viewport: vp, run: c.run, skip: c.skip });
            }
        }
    }

    const results = [];
    // 每跑完一條就落地：主行程萬一原生崩潰，已跑過的結果不會一起消失。
    const flush = (crashedAfter) => fs.writeFileSync(
        RESULTS,
        JSON.stringify({ tests: results, crashed: crashedAfter || null }, null, 2)
    );
    flush(`測試在「${tests[0] ? tests[0].group + ' / ' + tests[0].name : '?'}」之前就中斷`);

    for (let i = 0; i < tests.length; i++) {
        const t = tests[i];
        const started = Date.now();
        // 缺套件的測試用 skip-with-reason 包住，不讓它把總數弄紅——
        // 但它會以 ○ 出現在輸出裡，不會安靜消失。
        const skipReason = typeof t.skip === 'function' ? t.skip() : null;
        if (skipReason) {
            results.push({ ...strip(t), status: 'skip', ms: 0, reason: skipReason });
            flush(tests[i + 1] ? `測試在「${tests[i + 1].name}」中斷` : null);
            continue;
        }
        try {
            const ctx = await getContext(t.viewport);
            await withTimeout(t.run(ctx, assert), 45000, '測試逾時 45s');
            results.push({ ...strip(t), status: 'pass', ms: Date.now() - started });
        } catch (err) {
            results.push({ ...strip(t), status: 'fail', ms: Date.now() - started, error: err.message || String(err) });
        }
        const next = tests[i + 1];
        flush(next ? `測試在「${next.group} / ${next.name} [${next.viewport}]」中斷` : null);
    }
    closeAllWindows();
    flush(null);
    return results;
}

function withTimeout(promise, ms, msg) {
    let timer;
    return Promise.race([
        promise.finally(() => clearTimeout(timer)),
        new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(msg)), ms); }),
    ]);
}

const strip = (t) => ({ group: t.group, name: t.name, viewport: t.viewport });

app.whenReady().then(async () => {
    try {
        await main();
    } catch (err) {
        const prev = fs.existsSync(RESULTS) ? JSON.parse(fs.readFileSync(RESULTS, 'utf8')).tests : [];
        fs.writeFileSync(RESULTS, JSON.stringify({ tests: prev, crashed: err.stack || String(err) }, null, 2));
    }
    app.exit(0);
});

process.on('uncaughtException', (err) => {
    fs.writeFileSync(RESULTS, JSON.stringify({ tests: [], crashed: err.stack || String(err) }, null, 2));
    app.exit(1);
});

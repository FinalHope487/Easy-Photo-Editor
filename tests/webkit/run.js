#!/usr/bin/env node
// 跨瀏覽器驗證層：真的 WebKit（iOS Safari 的引擎），不是 Chromium。
//
// **這支預設不會執行。** 它需要 playwright，而新增相依套件在本專案屬高風險
// （CLAUDE.md〈決策分級〉），要你批准。沒安裝時 `npm test` 會出現一條
// ○ skip 並附上原因，不會安靜消失、也不會把總數弄紅。
//
// 批准後：
//   npm i -D playwright && npx playwright install webkit
//   npm run test:webkit
//
// 為什麼值得做：本輪修掉的 bug 有三個是 CSS 堆疊與裁切問題
// （backdrop-filter 造成 containing block、定位元素的 DOM 順序、fixed 的
// containing block）。這類行為 WebKit 與 Chromium 有實作差異，
// 而使用者從 iPhone / iPad 開的就是 WebKit。
//
// **這一層的已知限制**：playwright 對 WebKit 只提供 tap，沒有多段觸控拖曳的
// 真輸入 API。所以這裡只驗「版面、堆疊、命中測試、單點觸控」——
// 畫筆拖曳那類仍然只有 Electron/Chromium 那層驗得到。不要假裝它有覆蓋。

const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const PAGE = 'file://' + path.join(ROOT, 'index.html').replace(/\\/g, '/');

const FIXTURE = `(async () => {
    const c = document.createElement('canvas');
    c.width = 400; c.height = 300;
    const x = c.getContext('2d');
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, 400, 300);
    x.fillStyle = '#204080'; x.fillRect(0, 0, 200, 150);
    const blob = await new Promise(r => c.toBlob(r, 'image/png'));
    const dt = new DataTransfer();
    dt.items.add(new File([blob], 'fixture.png', { type: 'image/png' }));
    const input = document.getElementById('file-upload');
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
})()`;

const hitTest = (selector) => `(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return { ok: false, who: '(元素不存在)' };
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return { ok: false, who: '(0×0)' };
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { ok: el === top || el.contains(top),
             who: top ? (top.id || top.className || top.tagName) : '(null)' };
})()`;

async function main() {
    const { webkit, devices } = require('playwright');
    const results = [];
    const check = (name, ok, detail) => {
        results.push({ name, ok, detail });
        console.log(`  ${ok ? '\x1b[32m✓' : '\x1b[31m✗'}\x1b[0m ${name}${ok ? '' : `\n      ${detail}`}`);
    };

    const browser = await webkit.launch();
    for (const deviceName of ['iPhone 13', 'iPad (gen 7)']) {
        const context = await browser.newContext({ ...devices[deviceName] });
        const page = await context.newPage();
        await page.goto(PAGE);
        await page.waitForFunction('!!window.editor');
        await page.evaluate(FIXTURE);
        await page.waitForFunction('!!window.editor.image');

        console.log(`\n\x1b[2m── WebKit / ${deviceName}\x1b[0m`);

        await page.tap('.tool-btn[data-tool="pen"]');
        await page.waitForTimeout(400);
        const size = await page.evaluate(hitTest('#tool-size'));
        check(`${deviceName}：尺寸滑桿點得到`, size.ok, `最上層是 ${size.who}`);

        await page.tap('.tool-btn[data-tool="crop"]');
        await page.waitForTimeout(400);
        const apply = await page.evaluate(hitTest('#btn-apply-crop'));
        check(`${deviceName}：確定裁切按鈕點得到`, apply.ok, `最上層是 ${apply.who}`);

        const noOverflow = await page.evaluate(
            `document.documentElement.scrollWidth <= window.innerWidth + 1`);
        check(`${deviceName}：頁面不會左右溢出`, noOverflow, '有水平捲動');

        // 100dvh 與 safe-area 是 WebKit 與 Chromium 最容易分家的地方
        const bottomOk = await page.evaluate(`(() => {
            const r = document.querySelector('.tools-sidebar').getBoundingClientRect();
            return r.bottom <= window.innerHeight + 1 && r.top < window.innerHeight;
        })()`);
        check(`${deviceName}：底部工具列在可視範圍內`, bottomOk, '工具列被推到畫面外');

        // 收合前先記下面板中心，收合後那個位置要變成畫布——只問 class 有沒有加上去
        // 是問不出東西的，CSS 沒生效時 class 照樣在。
        await page.tap('.tool-btn[data-tool="text"]');
        await page.waitForTimeout(400);
        const probe = await page.evaluate(`(() => {
            const r = document.querySelector('.tool-attributes').getBoundingClientRect();
            return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
        })()`);
        const whoAt = `(() => { const el = document.elementFromPoint(${probe.x}, ${probe.y});
            return el ? (el.id || el.className || el.tagName) : '(null)'; })()`;
        const coveredBefore = await page.evaluate(whoAt);
        check(`${deviceName}：展開的面板確實蓋著畫布（前置條件）`,
            coveredBefore !== 'editor-canvas', `那個位置本來就是 ${coveredBefore}`);

        await page.tap('#btn-attr-collapse');
        await page.waitForTimeout(500);
        const coveredAfter = await page.evaluate(whoAt);
        check(`${deviceName}：收合之後那塊畫布碰得到`,
            coveredAfter === 'editor-canvas', `收合後那個位置是 ${coveredAfter}`);

        await context.close();
    }
    await browser.close();

    const fail = results.filter((r) => !r.ok).length;
    console.log(`\n${results.length - fail} passed, ${fail} failed（WebKit）`);
    process.exit(fail > 0 ? 1 : 0);
}

try {
    require.resolve('playwright');
} catch {
    console.error('沒有安裝 playwright。這一層屬高風險（新增相依套件），要你批准：');
    console.error('  npm i -D playwright && npx playwright install webkit');
    process.exit(2);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

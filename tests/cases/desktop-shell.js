// 桌面殼：真的用 `electron .` 起這個 app 的進入點（main.js），不是由測試自己
// 開視窗載 index.html。
//
// 為什麼要另外測：其餘 78 條都是測試自己 new BrowserWindow 再 loadFile，
// **完全不經過 main.js**。Electron 大版本升級把 main.js 用到的 API 換掉時，
// 那 78 條照樣全綠，而使用者按下去的那個 app 開不起來。

const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const PORT = 9333;

function fetchJson(url, timeout = 1500) {
    return new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', (c) => { body += c; });
            res.on('end', () => {
                try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
            });
        });
        req.on('error', reject);
        req.setTimeout(timeout, () => { req.destroy(new Error('timeout')); });
    });
}

module.exports = {
    group: '桌面殼（app 進入點）',
    viewports: ['desktop'],
    cases: [
        {
            name: 'electron . 起得來，而且視窗真的載入了編輯器',
            viewports: ['desktop'],
            skip: () => {
                try { require.resolve('playwright'); return null; }
                catch { return '未安裝 playwright（連 CDP 用）'; }
            },
            run: async (t, assert) => {
                const env = { ...process.env };
                delete env.ELECTRON_RUN_AS_NODE; // 要真的當 app 跑，不是當 node
                const child = spawn(process.execPath, [
                    ROOT, '--no-sandbox', '--disable-gpu',
                    `--remote-debugging-port=${PORT}`,
                ], { env, stdio: ['ignore', 'pipe', 'pipe'] });

                let stderr = '';
                child.stderr.on('data', (d) => { stderr += String(d); });
                let exited = null;
                child.on('exit', (code) => { exited = code; });

                try {
                    // 等 app 把除錯埠開起來並列出頁面
                    let target = null;
                    const deadline = Date.now() + 25000;
                    while (Date.now() < deadline) {
                        if (exited !== null) {
                            throw new Error(`app 還沒起來就結束了（exit ${exited}）\n${stderr.slice(0, 400)}`);
                        }
                        try {
                            const list = await fetchJson(`http://127.0.0.1:${PORT}/json/list`);
                            target = list.find((x) => x.type === 'page' && /index\.html$/.test(x.url || ''));
                            if (target) break;
                        } catch { /* 還沒開好，再等 */ }
                        await t.sleep(300);
                    }
                    assert(target, `25 秒內 app 沒有載入 index.html\n${stderr.slice(0, 400)}`);

                    // 起得來不等於編輯器活著：連進去問真的狀態
                    const { chromium } = require('playwright');
                    const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
                    try {
                        const page = browser.contexts()[0].pages()
                            .find((p) => /index\.html$/.test(p.url()));
                        assert(page, 'CDP 連上了但找不到 index.html 那一頁');
                        await page.waitForFunction('!!window.editor', { timeout: 10000 });
                        const ready = await page.evaluate(`(() => ({
                            hasEditor: !!window.editor,
                            hasCanvas: !!document.getElementById('editor-canvas'),
                            tools: document.querySelectorAll('.tool-btn[data-tool]').length,
                        }))()`);
                        assert(ready.hasCanvas, 'app 起來了但畫布不存在');
                        assert.atLeast(ready.tools, 8, `工具列只有 ${ready.tools} 顆工具`);
                    } finally {
                        await browser.close();
                    }
                } finally {
                    try { child.kill(); } catch { /* 已結束 */ }
                }
            },
        },
    ],
};

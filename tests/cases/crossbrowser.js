// 跨瀏覽器（WebKit / iOS Safari）驗證層。
//
// 真正的斷言在 tests/webkit/run.js——它要開真的 WebKit，跟這個 Electron 行程
// 是兩回事，所以這裡用子行程跑它，把它的紅綠帶回主套件。
// 沒安裝 playwright 時整條 skip-with-reason，不讓總數變紅，但也不會安靜消失。

const path = require('path');
const { spawnSync } = require('child_process');

const RUNNER = path.join(__dirname, '..', 'webkit', 'run.js');

module.exports = {
    group: '跨瀏覽器（WebKit / iOS Safari）',
    viewports: ['mobile'],
    cases: [
        {
            name: 'iPhone / iPad 的 Safari 上版面與命中測試',
            viewports: ['mobile'],
            skip: () => {
                try {
                    require.resolve('playwright');
                    return null;
                } catch {
                    return '未安裝 playwright（新增相依＝高風險，見 QUESTIONS.md）。'
                        + '批准後跑 npm i -D playwright && npx playwright install webkit';
                }
            },
            run: async (t, assert) => {
                // 用 Electron 自己當 node 跑，不依賴系統 PATH 上有沒有 node
                const res = spawnSync(process.execPath, [RUNNER], {
                    encoding: 'utf8',
                    timeout: 180000,
                    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
                });
                const out = `${res.stdout || ''}${res.stderr || ''}`
                    .replace(/\x1b\[\d+m/g, '')
                    .split('\n').filter((l) => l.trim()).slice(-14).join('\n      ');
                assert.equal(res.status, 0, `WebKit 那層有紅的（npm run test:webkit 看完整輸出）：\n      ${out}`);
            },
        },
    ],
};

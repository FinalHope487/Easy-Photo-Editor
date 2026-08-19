// 匯出：按下儲存後，真的有檔案落地，而且內容包含使用者看到的東西。

module.exports = {
    group: '匯出',
    viewports: ['desktop'],
    cases: [
        {
            name: '按儲存會產生檔案，副檔名跟選的格式一致',
            viewports: ['desktop', 'mobile'],
            run: async (t, assert) => {
                await t.loadImage(200, 150);
                await t.tapSelector('#btn-export');
                await t.waitFor(`!document.getElementById('export-popover').classList.contains('hidden')`);
                await t.eval(`(() => { const i = document.getElementById('export-filename');
                    i.value = 'myshot'; return true; })()`);
                await t.tapSelector('#btn-confirm-export');

                const dl = await t.waitForDownload();
                assert.equal(dl.filename, 'myshot.png', '下載檔名不對');
            },
        },
        {
            name: '畫上去的筆跡會出現在匯出的檔案裡',
            viewports: ['desktop', 'mobile'],
            run: async (t, assert) => {
                await t.loadImage(200, 150);
                await t.tapSelector('.tool-btn[data-tool="pen"]');
                await t.eval(`(() => {
                    const s = document.getElementById('tool-size');
                    s.value = 30; s.dispatchEvent(new Event('input', { bubbles: true }));
                    const c = document.getElementById('tool-color');
                    c.value = '#ff0000'; c.dispatchEvent(new Event('input', { bubbles: true }));
                    return true; })()`);

                const c = await t.canvasCenter();
                await t.drag(c.x - 30, c.y, c.x + 30, c.y, 10);
                await t.sleep(250);
                assert.atLeast(await t.inkPixels(), 50, '前置條件失敗：沒畫上東西');

                await t.tapSelector('#btn-export');
                await t.waitFor(`!document.getElementById('export-popover').classList.contains('hidden')`);
                await t.tapSelector('#btn-confirm-export');
                await t.waitFor(`document.getElementById('export-popover').classList.contains('hidden')`,
                    { label: '按下儲存後匯出視窗關閉（確認按鈕真的被點到）' });
                const dl = await t.waitForDownload();

                const sample = await t.samplePng(dl.path, [[100, 75]]);
                const [r, g, b] = sample.pixels[0];
                assert(r > 150 && g < 100 && b < 100,
                    `匯出的圖中央不是畫上去的紅色（rgb ${r},${g},${b}）`);
            },
        },
        {
            name: '未合併的文字也會出現在匯出的檔案裡',
            viewports: ['desktop'],
            run: async (t, assert) => {
                await t.loadImage(200, 150);

                await t.tapSelector('.tool-btn[data-tool="text"]');
                await t.eval(`(() => {
                    const s = document.getElementById('tool-size');
                    s.value = 60; s.dispatchEvent(new Event('input', { bubbles: true }));
                    const c = document.getElementById('tool-color');
                    c.value = '#ff0000'; c.dispatchEvent(new Event('input', { bubbles: true }));
                    return true; })()`);

                const c = await t.canvasCenter();
                await t.tap(c.x - 60, c.y - 30);
                await t.waitFor('!!window.editor.activeTextInput');
                await t.typeText('AAAA');
                await t.tapSelector('.tool-btn[data-tool="select"]');
                await t.waitFor('window.editor.textObjects.length === 1');

                await t.tapSelector('#btn-export');
                await t.waitFor(`!document.getElementById('export-popover').classList.contains('hidden')`);
                await t.tapSelector('#btn-confirm-export');
                await t.waitFor(`document.getElementById('export-popover').classList.contains('hidden')`,
                    { label: '按下儲存後匯出視窗關閉（確認按鈕真的被點到）' });
                const dl = await t.waitForDownload();

                // 掃整張圖找紅色像素——文字位置會因字型量測而浮動，只問「有沒有」
                const redCount = await t.eval(`(async () => {
                    const img = new Image();
                    await new Promise((res, rej) => { img.onload = res; img.onerror = rej;
                        img.src = ${JSON.stringify('data:image/png;base64,' + require('fs').readFileSync(dl.path).toString('base64'))}; });
                    const cv = document.createElement('canvas');
                    cv.width = img.width; cv.height = img.height;
                    const x = cv.getContext('2d');
                    x.drawImage(img, 0, 0);
                    const d = x.getImageData(0, 0, cv.width, cv.height).data;
                    let n = 0;
                    for (let i = 0; i < d.length; i += 4) {
                        if (d[i] > 150 && d[i + 1] < 100 && d[i + 2] < 100) n++;
                    }
                    return n;
                })()`);
                assert.atLeast(redCount, 30, '匯出的檔案裡找不到文字（未合併的文字被丟掉了）');
            },
        },
        {
            name: '載入圖片後第一次按復原不會把圖弄不見',
            viewports: ['desktop'],
            run: async (t, assert) => {
                await t.loadImage(200, 150);
                await t.tapSelector('#btn-undo');
                await t.sleep(400);
                const ok = await t.eval(`!!window.editor.image && !document.getElementById('editor-canvas').classList.contains('hidden')`);
                assert(ok, '復原之後圖片不見了');
                const historyLen = await t.eval('window.editor.history.length');
                assert.equal(historyLen, 1, `載入一張圖應該只推一筆歷史，實際 ${historyLen} 筆`);
            },
        },
    ],
};

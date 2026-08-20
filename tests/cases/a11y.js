// 可及性：純圖示按鈕在觸控裝置上沒有 hover tooltip，必須有可讀的名稱與夠大的點擊區。

const ICON_ONLY = [
    '#btn-undo', '#btn-redo', '#btn-zoom-in', '#btn-zoom-out', '#btn-zoom-fit',
    '#btn-batch-toggle', '#btn-close-batch',
    '.tool-btn[data-tool="select"]', '.tool-btn[data-tool="crop"]',
    '.tool-btn[data-tool="pen"]', '.tool-btn[data-tool="eraser"]',
    '.tool-btn[data-tool="text"]', '.tool-btn[data-tool="rect"]',
    '.tool-btn[data-tool="circle"]', '.tool-btn[data-tool="mosaic"]',
];

module.exports = {
    group: '可及性',
    viewports: ['desktop'],
    cases: [
        {
            name: '所有純圖示按鈕都有可讀名稱',
            viewports: ['desktop'],
            run: async (t, assert) => {
                await t.loadImage();
                const missing = await t.eval(`(() => {
                    const sels = ${JSON.stringify(ICON_ONLY)};
                    const bad = [];
                    for (const s of sels) {
                        const el = document.querySelector(s);
                        if (!el) { bad.push(s + ' (不存在)'); continue; }
                        const name = (el.getAttribute('aria-label') || '').trim()
                                  || (el.innerText || '').trim();
                        if (!name) bad.push(s);
                    }
                    return bad;
                })()`);
                assert.equal(missing.length, 0,
                    `這些按鈕沒有可讀名稱（core.js 的 setupTooltips 會把 title 拿掉）：\n  ${missing.join('\n  ')}`);
            },
        },
        {
            name: '檔案上傳控制項有可讀名稱',
            viewports: ['desktop'],
            run: async (t, assert) => {
                const name = await t.eval(`(() => {
                    const el = document.querySelector('label[for="file-upload"]');
                    return el ? (el.getAttribute('aria-label') || el.innerText || '').trim() : null;
                })()`);
                assert(name && name.length > 0, '開啟檔案的 label 沒有可讀名稱');
            },
        },
        {
            name: '手機：觸控目標不小於 44×44',
            viewports: ['mobile'],
            run: async (t, assert) => {
                await t.loadImage();
                const small = await t.eval(`(() => {
                    const sels = ${JSON.stringify(ICON_ONLY)};
                    const bad = [];
                    for (const s of sels) {
                        const el = document.querySelector(s);
                        if (!el) continue;
                        const r = el.getBoundingClientRect();
                        if (r.width === 0 && r.height === 0) continue; // 手機上刻意隱藏的不算
                        if (r.width < 44 || r.height < 44) {
                            bad.push(s + ' → ' + Math.round(r.width) + '×' + Math.round(r.height));
                        }
                    }
                    return bad;
                })()`);
                assert.equal(small.length, 0, `觸控目標太小：\n  ${small.join('\n  ')}`);
            },
        },
        {
            name: '手機：工具列可以捲到最後一個工具',
            viewports: ['mobile'],
            run: async (t, assert) => {
                await t.loadImage();
                const reachable = await t.eval(`(() => {
                    const bar = document.querySelector('.tools-sidebar');
                    const last = document.querySelector('.tool-btn[data-tool="mosaic"]');
                    if (!bar || !last) return false;
                    last.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                    const r = last.getBoundingClientRect();
                    return r.left >= -1 && r.right <= window.innerWidth + 1
                        && r.top >= -1 && r.bottom <= window.innerHeight + 1;
                })()`);
                assert(reachable, '捲動後仍然搆不到最後一個工具（馬賽克）');
            },
        },
        {
            name: '鍵盤 Tab 可以走到主要控制項',
            viewports: ['desktop'],
            run: async (t, assert) => {
                await t.loadImage();
                const focusable = await t.eval(`(() => {
                    const els = document.querySelectorAll(
                        'button:not([disabled]), [href], input:not([type=hidden]), select, textarea, [tabindex]:not([tabindex="-1"])'
                    );
                    let n = 0;
                    els.forEach(el => { const r = el.getBoundingClientRect();
                        if (r.width > 0 && r.height > 0) n++; });
                    return n;
                })()`);
                assert.atLeast(focusable, 20, `可聚焦的可見控制項只有 ${focusable} 個`);
            },
        },
    ],
};

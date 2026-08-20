// 版面：手機不能套用桌機版面。

module.exports = {
    group: '版面與可視範圍',
    viewports: ['mobile'],
    cases: [
        {
            name: '手機：畫布可用寬度至少佔 viewport 的 70%',
            viewports: ['mobile', 'tablet'],
            run: async (t, assert) => {
                await t.loadImage();
                const { vw, canvasW } = await t.eval(`(() => ({
                    vw: window.innerWidth,
                    canvasW: document.querySelector('.canvas-area').getBoundingClientRect().width,
                }))()`);
                assert.atLeast(canvasW / vw, 0.7,
                    `畫布只剩 ${Math.round(canvasW)}px / ${vw}px——側邊欄把畫面吃光了`);
            },
        },
        {
            name: '手機：頁面不會左右溢出',
            viewports: ['mobile', 'tablet'],
            run: async (t, assert) => {
                await t.loadImage();
                const { scrollW, innerW } = await t.eval(`(() => ({
                    scrollW: document.documentElement.scrollWidth,
                    innerW: window.innerWidth,
                }))()`);
                assert.atMost(scrollW, innerW + 1, `頁面橫向溢出 ${scrollW - innerW}px`);
            },
        },
        {
            name: '手機：所有工具按鈕都在 viewport 內且可點到',
            viewports: ['mobile', 'tablet'],
            run: async (t, assert) => {
                await t.loadImage();
                const bad = await t.eval(`(() => {
                    const out = [];
                    document.querySelectorAll('.tool-btn').forEach(el => {
                        const r = el.getBoundingClientRect();
                        const visible = r.width > 0 && r.height > 0;
                        const inside = r.left >= -1 && r.right <= window.innerWidth + 1
                                    && r.top >= -1 && r.bottom <= window.innerHeight + 1;
                        if (!visible || !inside) {
                            out.push({ tool: el.dataset.tool,
                                       rect: [Math.round(r.left), Math.round(r.top),
                                              Math.round(r.width), Math.round(r.height)] });
                        }
                    });
                    return out;
                })()`);
                assert.equal(bad.length, 0, `這些工具按鈕點不到：${JSON.stringify(bad)}`);
            },
        },
        {
            name: '手機：影像調整面板可以打開並操作',
            viewports: ['mobile', 'tablet'],
            run: async (t, assert) => {
                await t.loadImage();
                await t.tapSelector('#btn-props-toggle');
                await t.sleep(350);
                const box = await t.eval(`(() => {
                    const el = document.getElementById('adj-brightness');
                    const r = el.getBoundingClientRect();
                    return { w: r.width, h: r.height, top: r.top, bottom: r.bottom,
                             vh: window.innerHeight };
                })()`);
                assert.atLeast(box.w, 100, '亮度滑桿沒有顯示出來');
                assert(box.top >= 0 && box.bottom <= box.vh + 1,
                    `亮度滑桿跑到畫面外（top=${Math.round(box.top)}, bottom=${Math.round(box.bottom)}, vh=${box.vh}）`);
            },
        },
        {
            name: '手機：工具屬性面板（尺寸/顏色）在畫面內',
            viewports: ['mobile', 'tablet'],
            run: async (t, assert) => {
                await t.loadImage();
                await t.tapSelector('.tool-btn[data-tool="pen"]');
                await t.sleep(350);
                const box = await t.eval(`(() => {
                    const el = document.getElementById('tool-size');
                    const r = el.getBoundingClientRect();
                    return { w: r.width, left: r.left, right: r.right, top: r.top,
                             bottom: r.bottom, vw: window.innerWidth, vh: window.innerHeight };
                })()`);
                assert.atLeast(box.w, 80, '尺寸滑桿沒顯示');
                assert(box.left >= -1 && box.right <= box.vw + 1,
                    `尺寸滑桿超出畫面左右（left=${Math.round(box.left)}, right=${Math.round(box.right)}, vw=${box.vw}）`);
                assert(box.bottom <= box.vh + 1,
                    `尺寸滑桿超出畫面底部（bottom=${Math.round(box.bottom)}, vh=${box.vh}）`);

                // 「在畫面內」不等於「按得到」。面板被祖先的 overflow 切掉或壓在畫布下面時，
                // 上面三條仍然全過，但使用者一根手指也碰不到它。問實際的命中測試。
                const hit = await t.eval(`(() => {
                    const el = document.getElementById('tool-size');
                    const r = el.getBoundingClientRect();
                    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
                    return { same: top === el, who: top ? (top.id || top.className || top.tagName) : null };
                })()`);
                assert(hit.same,
                    `尺寸滑桿點不到：那個位置最上層的是 ${hit.who}（面板被蓋住或被祖先切掉了）`);
            },
        },
        {
            // 屬性面板浮在畫布上。桌機與手機的堆疊規則不同（一邊靠 DOM 順序、
            // 一邊靠 z-index），兩邊都要真的點得到，不能只有一邊過。
            name: '工具屬性面板裡的按鈕真的點得到（沒被畫布蓋住）',
            viewports: ['desktop', 'mobile', 'tablet'],
            run: async (t, assert) => {
                await t.loadImage();
                await t.tapSelector('.tool-btn[data-tool="crop"]');
                await t.waitFor('!!window.editor.cropBox');
                await t.sleep(350);

                const hit = await t.eval(`(() => {
                    const el = document.getElementById('btn-apply-crop');
                    const r = el.getBoundingClientRect();
                    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
                    return { w: r.width, h: r.height, ok: el === top || el.contains(top),
                             who: top ? (top.id || top.className || top.tagName) : null };
                })()`);
                assert(hit.w > 0 && hit.h > 0, '「確定裁切」按鈕是 0×0');
                assert(hit.ok,
                    `「確定裁切」按鈕點不到：那個位置最上層的是 ${hit.who}`);
            },
        },
        {
            // 面板浮在畫布上，高度再怎麼調都會蓋住一塊圖。要能收起來，
            // 使用者才碰得到被蓋住的那塊。
            name: '手機：工具屬性面板可以收合，讓出被它蓋住的畫布',
            viewports: ['mobile', 'tablet'],
            run: async (t, assert) => {
                await t.loadImage();
                await t.tapSelector('.tool-btn[data-tool="text"]');
                await t.sleep(400);

                const probe = await t.eval(`(() => {
                    const r = document.querySelector('.tool-attributes').getBoundingClientRect();
                    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
                })()`);
                const who = `(() => { const el = document.elementFromPoint(${probe.x}, ${probe.y});
                    return el ? (el.id || el.className || el.tagName) : null; })()`;

                const before = await t.eval(who);
                assert(before !== 'editor-canvas',
                    `前置條件失敗：展開的面板根本沒蓋住那個點（那裡是 ${before}）`);

                await t.tapSelector('#btn-attr-collapse');
                await t.sleep(450);
                const after = await t.eval(who);
                assert.equal(after, 'editor-canvas',
                    `收合之後那個位置還是碰不到畫布（那裡是 ${after}）`);

                // 收合列本身要留著，不然使用者沒辦法把面板叫回來
                await t.tapSelector('#btn-attr-collapse');
                await t.sleep(450);
                const backOk = await t.eval(`(() => {
                    const el = document.getElementById('tool-size');
                    const r = el.getBoundingClientRect();
                    return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === el;
                })()`);
                assert(backOk, '再展開之後尺寸滑桿點不到');
            },
        },
        {
            // 剛選好工具就是要調它的參數，這時還要使用者自己展開一次是多一步
            name: '手機：換工具會自動把收合的面板展開',
            viewports: ['mobile'],
            run: async (t, assert) => {
                await t.loadImage();
                await t.tapSelector('.tool-btn[data-tool="pen"]');
                await t.sleep(400);
                await t.tapSelector('#btn-attr-collapse');
                await t.sleep(450);
                assert(await t.eval(`document.body.classList.contains('attrs-collapsed')`),
                    '前置條件失敗：按了收合但沒有收合');

                await t.tapSelector('.tool-btn[data-tool="text"]');
                await t.sleep(450);
                assert(!(await t.eval(`document.body.classList.contains('attrs-collapsed')`)),
                    '換工具之後面板還是收合的');
            },
        },
        {
            name: '手機：批量處理面板不會被切掉',
            viewports: ['mobile'],
            run: async (t, assert) => {
                await t.loadImage();
                await t.tapSelector('#btn-batch-toggle');
                await t.sleep(350);
                const box = await t.eval(`(() => {
                    const r = document.getElementById('batch-panel').getBoundingClientRect();
                    return { left: r.left, right: r.right, vw: window.innerWidth };
                })()`);
                assert(box.left >= -1 && box.right <= box.vw + 1,
                    `批量面板超出畫面（left=${Math.round(box.left)}, right=${Math.round(box.right)}, vw=${box.vw}）`);
            },
        },
        {
            name: '桌機：左右側邊欄維持原本寬度（不迴歸）',
            viewports: ['desktop'],
            run: async (t, assert) => {
                await t.loadImage();
                const { tools, props } = await t.eval(`(() => ({
                    tools: document.querySelector('.tools-sidebar').getBoundingClientRect().width,
                    props: document.querySelector('.properties-sidebar').getBoundingClientRect().width,
                }))()`);
                assert.equal(Math.round(tools), 68, '桌機工具列寬度被改動');
                assert.equal(Math.round(props), 280, '桌機屬性欄寬度被改動');
            },
        },
        {
            name: '桌機：畫布區仍佔滿中間',
            viewports: ['desktop'],
            run: async (t, assert) => {
                await t.loadImage();
                const w = await t.eval(
                    `document.querySelector('.canvas-area').getBoundingClientRect().width`
                );
                assert.equal(Math.round(w), 1280 - 68 - 280, '桌機畫布區寬度不對');
            },
        },
    ],
};

// 文字工具：建立、移動、編輯、刪除都要直覺。

async function makeText(t, str = 'Hello') {
    await t.tapSelector('.tool-btn[data-tool="text"]');
    const c = await t.canvasCenter();
    await t.tap(c.x - 40, c.y - 20);
    await t.waitFor('!!window.editor.activeTextInput', { label: '文字輸入框出現' });
    await t.typeText(str);
    await t.tapSelector('.tool-btn[data-tool="select"]');
    await t.waitFor('window.editor.textObjects.length === 1', { label: '文字物件建立' });
    return t.eval('({ ...window.editor.textObjects[0] })');
}

module.exports = {
    group: '文字工具',
    viewports: ['desktop'],
    cases: [
        {
            name: '點畫布可以打字並建立文字物件',
            viewports: ['desktop', 'mobile'],
            run: async (t, assert) => {
                await t.loadImage();
                const obj = await makeText(t, 'Hello');
                assert.equal(obj.text, 'Hello', '文字內容不對');
            },
        },
        {
            name: '已選取的文字方塊，拖曳就是移動（不是跳進編輯）',
            viewports: ['desktop', 'mobile', 'tablet'],
            run: async (t, assert) => {
                await t.loadImage();
                const obj = await makeText(t, 'Move');

                const rect = await t.canvasCenter();
                const scale = await t.eval('window.editor.scale');
                const pan = await t.eval('({ x: window.editor.panX, y: window.editor.panY })');
                // 文字物件中心的視窗座標
                const sx = rect.left + pan.x + (obj.x + obj.width / 2) * scale;
                const sy = rect.top + pan.y + (obj.y + obj.height / 2) * scale;

                // 第一次拖曳：選取它
                await t.drag(sx, sy, sx + 50, sy, 8);
                await t.sleep(120);
                await t.eval('window.editor.selectedTextObject = window.editor.textObjects[0]; true');
                const mid = await t.eval('({ ...window.editor.textObjects[0] })');

                // 第二次拖曳：已選取狀態下再拖，應該繼續移動
                const sx2 = rect.left + pan.x + (mid.x + mid.width / 2) * scale;
                const sy2 = rect.top + pan.y + (mid.y + mid.height / 2) * scale;
                await t.drag(sx2, sy2, sx2 + 60, sy2 + 30, 8);
                await t.sleep(150);

                const after = await t.eval('({ ...window.editor.textObjects[0] })');
                assert.atLeast(Math.abs(after.x - mid.x), 20,
                    `已選取的文字方塊拖不動（x ${mid.x.toFixed(1)} → ${after.x.toFixed(1)}）`);

                const editing = await t.eval('!!window.editor.activeTextInput');
                assert(!editing, '拖曳被誤判成「進入編輯」了');
            },
        },
        {
            name: '拖曳文字方塊時不會平移整張圖',
            viewports: ['desktop', 'mobile'],
            run: async (t, assert) => {
                await t.loadImage();
                const obj = await makeText(t, 'Pan');
                const panBefore = await t.eval('({ x: window.editor.panX, y: window.editor.panY })');

                const rect = await t.canvasCenter();
                const scale = await t.eval('window.editor.scale');
                const sx = rect.left + panBefore.x + (obj.x + obj.width / 2) * scale;
                const sy = rect.top + panBefore.y + (obj.y + obj.height / 2) * scale;
                await t.drag(sx, sy, sx + 40, sy + 40, 8);
                await t.sleep(150);

                const panAfter = await t.eval('({ x: window.editor.panX, y: window.editor.panY })');
                assert.atMost(Math.abs(panAfter.x - panBefore.x), 2, '拖文字時整張圖也跟著平移了');
                assert.atMost(Math.abs(panAfter.y - panBefore.y), 2, '拖文字時整張圖也跟著平移了');
            },
        },
        {
            name: '雙擊（雙點）已選取的文字方塊會進入編輯',
            viewports: ['desktop', 'mobile'],
            run: async (t, assert) => {
                await t.loadImage();
                const obj = await makeText(t, 'Edit');

                const rect = await t.canvasCenter();
                const scale = await t.eval('window.editor.scale');
                const pan = await t.eval('({ x: window.editor.panX, y: window.editor.panY })');
                const sx = rect.left + pan.x + (obj.x + obj.width / 2) * scale;
                const sy = rect.top + pan.y + (obj.y + obj.height / 2) * scale;

                await t.tap(sx, sy);
                await t.sleep(60);
                await t.tap(sx, sy);
                await t.waitFor('!!window.editor.activeTextInput', { label: '雙擊進入編輯' });

                const val = await t.eval('window.editor.activeTextInput.value');
                assert.equal(val, 'Edit', '編輯框沒有帶入原本的文字');
            },
        },
        {
            name: '選取文字後，側欄出現刪除與合併按鈕',
            viewports: ['desktop', 'mobile'],
            run: async (t, assert) => {
                await t.loadImage();
                const obj = await makeText(t, 'Btn');
                const rect = await t.canvasCenter();
                const scale = await t.eval('window.editor.scale');
                const pan = await t.eval('({ x: window.editor.panX, y: window.editor.panY })');
                await t.tap(rect.left + pan.x + (obj.x + obj.width / 2) * scale,
                    rect.top + pan.y + (obj.y + obj.height / 2) * scale);
                await t.sleep(200);

                const visible = await t.eval(`(() => {
                    const f = document.getElementById('btn-flatten-text');
                    const d = document.getElementById('btn-delete-text');
                    const shown = el => el && el.getBoundingClientRect().width > 0;
                    return { flatten: shown(f), del: shown(d) };
                })()`);
                assert(visible.flatten, '合併至畫布按鈕沒出現');
                assert(visible.del, '刪除文字按鈕沒出現');
            },
        },
    ],
};

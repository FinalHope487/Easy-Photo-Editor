// 鍵盤：快捷鍵不可以在使用者打字時搶走按鍵。

module.exports = {
    group: '鍵盤與快捷鍵',
    viewports: ['desktop'],
    cases: [
        {
            name: '在檔名輸入框打字不會觸發工具快捷鍵',
            run: async (t, assert) => {
                await t.loadImage();
                await t.tapSelector('#btn-export');
                await t.waitFor(`!document.getElementById('export-popover').classList.contains('hidden')`,
                    { label: '匯出 popover 展開' });
                await t.waitFor(`document.activeElement === document.getElementById('export-filename')`,
                    { label: '焦點在檔名輸入框' });

                // p=畫筆 o=圓形 t=文字 e=橡皮擦 c=裁切 m=馬賽克 r=矩形 v=選取
                await t.typeText('portrait');

                const toolAfter = await t.eval('window.editor.activeTool');
                assert.equal(toolAfter, 'select', '打字時工具被快捷鍵切走了');

                const value = await t.eval(`document.getElementById('export-filename').value`);
                assert.equal(value, 'portrait', '輸入框沒有收到完整字串');
            },
        },
        {
            name: '在檔名輸入框按 Backspace 不會刪掉選取中的文字物件',
            run: async (t, assert) => {
                await t.loadImage();

                // 先造一個文字物件並讓它處於選取狀態
                await t.tapSelector('.tool-btn[data-tool="text"]');
                const c = await t.canvasCenter();
                await t.tap(c.x, c.y);
                await t.waitFor('!!window.editor.activeTextInput', { label: '文字輸入框出現' });
                await t.typeText('hi');
                await t.tapSelector('.tool-btn[data-tool="select"]');
                await t.waitFor('window.editor.textObjects.length === 1', { label: '文字物件建立' });
                await t.eval('window.editor.selectedTextObject = window.editor.textObjects[0]; true');

                await t.tapSelector('#btn-export');
                await t.waitFor(`document.activeElement === document.getElementById('export-filename')`,
                    { label: '焦點在檔名輸入框' });
                await t.key('Backspace');
                await t.key('Backspace');

                const count = await t.eval('window.editor.textObjects.length');
                assert.equal(count, 1, 'Backspace 把畫布上的文字物件刪掉了');
            },
        },
        {
            name: '在亮度數字框打字不會觸發工具快捷鍵',
            run: async (t, assert) => {
                await t.loadImage();
                await t.tapSelector('#val-brightness');
                await t.typeText('25');
                const tool = await t.eval('window.editor.activeTool');
                assert.equal(tool, 'select', '數字框打字切換了工具');
            },
        },
        {
            name: '焦點不在輸入框時，工具快捷鍵仍然有效',
            run: async (t, assert) => {
                await t.loadImage();
                await t.key('p');
                assert.equal(await t.eval('window.editor.activeTool'), 'pen', 'P 沒有切到畫筆');
                await t.key('e');
                assert.equal(await t.eval('window.editor.activeTool'), 'eraser', 'E 沒有切到橡皮擦');
                await t.key('v');
                assert.equal(await t.eval('window.editor.activeTool'), 'select', 'V 沒有切回選取');
            },
        },
        {
            name: 'Escape 關閉匯出視窗',
            run: async (t, assert) => {
                await t.loadImage();
                await t.tapSelector('#btn-export');
                await t.waitFor(`!document.getElementById('export-popover').classList.contains('hidden')`);
                await t.key('Escape');
                const hidden = await t.eval(
                    `document.getElementById('export-popover').classList.contains('hidden')`
                );
                assert(hidden, 'Escape 沒有關閉匯出視窗');
            },
        },
    ],
};

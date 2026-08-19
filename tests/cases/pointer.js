// 指標輸入：同一組操作在滑鼠與手指下都要成立。
// mobile / tablet viewport 下 harness 發的是真的 TouchEvent，不是 mouse。

const drawCases = [
    { tool: 'pen', label: '畫筆' },
    { tool: 'mosaic', label: '馬賽克' },
    { tool: 'rect', label: '矩形' },
    { tool: 'circle', label: '圓形' },
];

const cases = [];

for (const { tool, label } of drawCases) {
    cases.push({
        name: `${label}：拖曳後畫布上留下筆跡`,
        viewports: ['desktop', 'mobile', 'tablet'],
        run: async (t, assert) => {
            await t.loadImage();
            await t.tapSelector(`.tool-btn[data-tool="${tool}"]`);
            assert.equal(await t.eval('window.editor.activeTool'), tool, `工具沒切到 ${tool}`);

            assert.equal(await t.inkPixels(), 0, '起始畫布應該是乾淨的');

            const c = await t.canvasCenter();
            await t.drag(c.x - 60, c.y - 40, c.x + 60, c.y + 40, 10);
            await t.sleep(200);

            const ink = await t.inkPixels();
            assert.atLeast(ink, 50, `${label}拖曳後沒有畫上任何東西`);
        },
    });
}

cases.push(
    {
        // 手機上這是天天發生的事：一開始畫，瀏覽器就把網址列收起來 → 可視高度變了
        // → resize → fitToScreen 改掉 panX/panY/scale。筆跡的座標換算若跟著中途變，
        // 這一筆就會從畫面另一頭拉一條斜線過來。
        name: '下筆途中版面改變（轉向／網址列收合），筆跡不會被扯成一條斜線',
        viewports: ['desktop', 'mobile'],
        run: async (t, assert) => {
            await t.loadImage();
            await t.tapSelector('.tool-btn[data-tool="pen"]');
            await t.eval(`document.getElementById('tool-size').value = 40;
                document.getElementById('tool-size').dispatchEvent(new Event('input', { bubbles: true })); true`);

            const c = await t.canvasCenter();
            const vp = await t.eval('({ w: window.innerWidth, h: window.innerHeight })');

            // 一筆橫線，中途把可視高度改掉
            await t.press(c.x - 60, c.y);
            await t.moveTo(c.x - 30, c.y);
            await t.setViewport(vp.w, vp.h - 120);
            await t.waitFor(`window.innerHeight === ${vp.h - 120}`, { label: '可視高度真的變了' });
            await t.moveTo(c.x + 30, c.y);
            await t.moveTo(c.x + 60, c.y);
            await t.release(c.x + 60, c.y);
            await t.sleep(250);

            const box = await t.inkBox();
            assert(box, '前置條件失敗：整筆都沒畫上去');
            // 橫線的高度應該就是筆刷粗細（40）左右；被扯成斜線時會是整張圖的高度
            assert.atMost(box.h, 80,
                `筆跡被扯成斜線：高度 ${box.h}px，應該只有筆刷粗細 40px 上下`);
        },
    },
    {
        name: '橡皮擦：擦掉先前畫的筆跡',
        viewports: ['desktop', 'mobile'],
        run: async (t, assert) => {
            await t.loadImage();
            const c = await t.canvasCenter();

            await t.tapSelector('.tool-btn[data-tool="pen"]');
            await t.eval(`document.getElementById('tool-size').value = 40;
                document.getElementById('tool-size').dispatchEvent(new Event('input', { bubbles: true })); true`);
            await t.drag(c.x - 60, c.y, c.x + 60, c.y, 10);
            await t.sleep(200);
            const afterPen = await t.inkPixels();
            assert.atLeast(afterPen, 100, '前置條件失敗：畫筆沒畫上東西');

            await t.tapSelector('.tool-btn[data-tool="eraser"]');
            await t.drag(c.x - 60, c.y, c.x + 60, c.y, 10);
            await t.sleep(250);

            const afterEraser = await t.inkPixels();
            assert(afterEraser < afterPen * 0.5,
                `橡皮擦沒有擦掉筆跡（擦前 ${afterPen} px，擦後 ${afterEraser} px）`);
        },
    },
    {
        name: '選取工具：拖曳可以平移圖片',
        viewports: ['desktop', 'mobile', 'tablet'],
        run: async (t, assert) => {
            await t.loadImage();
            await t.tapSelector('.tool-btn[data-tool="select"]');
            const before = await t.eval('({ x: window.editor.panX, y: window.editor.panY })');

            const c = await t.canvasCenter();
            await t.drag(c.x, c.y, c.x + 80, c.y + 50, 10);
            await t.sleep(150);

            const after = await t.eval('({ x: window.editor.panX, y: window.editor.panY })');
            assert.atLeast(Math.abs(after.x - before.x), 40, '水平方向沒有平移');
            assert.atLeast(Math.abs(after.y - before.y), 25, '垂直方向沒有平移');
        },
    },
    {
        name: '裁切：拖曳角落可以改變裁切框',
        viewports: ['desktop', 'mobile', 'tablet'],
        run: async (t, assert) => {
            await t.loadImage();
            await t.tapSelector('.tool-btn[data-tool="crop"]');
            await t.waitFor('!!window.editor.cropBox', { label: '裁切框出現' });

            const box = await t.eval(`({ ...window.editor.cropBox })`);
            const canvasRect = await t.canvasCenter();

            // 左上角把手（cropBox 是畫布座標，換算成視窗座標）
            const hx = canvasRect.left + box.x;
            const hy = canvasRect.top + box.y;
            await t.drag(hx, hy, hx + 60, hy + 60, 10);
            await t.sleep(150);

            const after = await t.eval(`({ ...window.editor.cropBox })`);
            assert(Math.abs(after.width - box.width) > 20 || Math.abs(after.x - box.x) > 20,
                `裁切框沒有被拖動（前 ${JSON.stringify(box)}，後 ${JSON.stringify(after)}）`);
        },
    },
    {
        name: '裁切：按下確定後圖片尺寸真的變小',
        viewports: ['desktop', 'mobile'],
        run: async (t, assert) => {
            await t.loadImage(400, 300);
            await t.tapSelector('.tool-btn[data-tool="crop"]');
            await t.waitFor('!!window.editor.cropBox');

            const box = await t.eval(`({ ...window.editor.cropBox })`);
            const rect = await t.canvasCenter();
            await t.drag(rect.left + box.x, rect.top + box.y,
                rect.left + box.x + 80, rect.top + box.y + 60, 10);
            await t.sleep(1900); // 等 scheduleCropSettle 的 1.5s 動畫結束

            // 裁切框真的縮了才有東西可裁。沒縮的話下面等的是永遠不會發生的事，
            // 只會看到「逾時」，看不出是拖曳沒抓到角落還是套用沒生效。
            const settled = await t.eval(`(() => { const b = window.editor.cropBox;
                return { w: b.width / window.editor.scale, h: b.height / window.editor.scale }; })()`);
            assert(settled.w < 395,
                `前置條件失敗：拖完角落後裁切框沒縮小（換算回原圖 ${settled.w.toFixed(1)}×${settled.h.toFixed(1)}，原圖 400×300）`);

            await t.tapSelector('#btn-apply-crop');
            await t.waitFor('window.editor.image.width < 400', { label: '裁切套用', timeout: 5000 });

            const w = await t.eval('window.editor.image.width');
            assert(w < 400, `裁切後寬度沒有變小（${w}）`);
        },
    },
    {
        name: '手機：雙指縮放可以改變 zoom',
        viewports: ['mobile', 'tablet'],
        run: async (t, assert) => {
            await t.loadImage();
            const before = await t.eval('window.editor.scale');
            const c = await t.canvasCenter();
            await t.pinch(c.x, c.y, 80, 260, 12);
            await t.sleep(200);
            const after = await t.eval('window.editor.scale');
            assert(after > before * 1.2,
                `雙指張開沒有放大（前 ${before.toFixed(3)}，後 ${after.toFixed(3)}）`);
        },
    },
    {
        name: '手機：畫布不會被瀏覽器當成捲動手勢吃掉',
        viewports: ['mobile', 'tablet'],
        run: async (t, assert) => {
            await t.loadImage();
            const touchAction = await t.eval(
                `getComputedStyle(document.getElementById('editor-canvas')).touchAction`
            );
            assert(touchAction === 'none' || touchAction === 'manipulation',
                `canvas 的 touch-action 是 "${touchAction}"，瀏覽器會把拖曳當捲動`);
        },
    }
);

module.exports = { group: '指標輸入（滑鼠 / 觸控）', viewports: ['desktop'], cases };

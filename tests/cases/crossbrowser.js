// 跨瀏覽器（WebKit）驗證層的佔位。
// 真正的測試在 tests/webkit/run.js，需要 playwright（新增相依＝高風險，待批准）。
// 這裡放一條 skip-with-reason，讓「這一層還沒有覆蓋」以 ○ 的形式出現在
// `npm test` 的輸出裡，而不是安靜地不存在。

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
                        + '批准後跑 npm run test:webkit';
                }
            },
            run: async (t, assert) => {
                assert(false, '有 playwright 時請跑 npm run test:webkit，這條不在 Electron 裡執行');
            },
        },
    ],
};

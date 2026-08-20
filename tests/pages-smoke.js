#!/usr/bin/env node
// 部署後驗證：抓 GitHub Pages 上真正對外的那份，確認線上版跟本機是同一份。
//
// 本機測試跑的是工作目錄的檔案；Pages 服務的是 `main` 分支。兩者會漂開，
// 而使用者碰到的是後者。這支只做唯讀 GET，不改任何東西。
//
//   npm run test:pages
//
// PR 還沒合進 main 之前，這支「線上版缺少修正」的結果是**預期中的紅**，
// 它證明的是「線上版還沒拿到這些修正」，不是程式壞了。

const https = require('https');

const SITE = process.env.EPE_SITE || 'https://finalhope487.github.io/Easy-Photo-Editor/';

// 每一項都對應這輪修掉的一個實際 bug，不是隨便挑的字串
const MARKERS = [
    { file: '', needle: 'css/mobile.css', why: '手機版面樣式（沒有它＝手機吃桌機版面）' },
    { file: '', needle: 'id="btn-attr-collapse"', why: '屬性面板的收合列' },
    // 這兩個字串在修正前的版本也存在，所以不能拿 id="attr-panel" 或 z-index:20
    // 當標記——它們會給出假的綠。改抓這一輪才寫進去的註解。
    { file: '', needle: '放在 main-content 底下', why: '面板搬出會切掉它的工具列' },
    { file: 'css/components.css', needle: '畫布會蓋在面板上', why: '面板不被畫布蓋住的層級' },
    { file: 'css/mobile.css', needle: 'max-height: 32vh', why: '面板不蓋住畫布中心的高度上限' },
    { file: 'js/tools.js', needle: 'coordFreeze', why: '手勢期間凍結座標基準（筆跡不被扯成斜線）' },
    { file: 'js/core.js', needle: 'defaultTextSize', why: '字級跟著圖片大小走' },
];

function get(url) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'user-agent': 'epe-pages-smoke' } }, (res) => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                res.resume();
                return resolve(get(new URL(res.headers.location, url).toString()));
            }
            let body = '';
            res.setEncoding('utf8');
            res.on('data', (c) => { body += c; });
            res.on('end', () => resolve({ status: res.statusCode, body }));
        }).on('error', reject);
    });
}

async function main() {
    const GREEN = '\x1b[32m', RED = '\x1b[31m', DIM = '\x1b[2m', OFF = '\x1b[0m';
    console.log(`\n${DIM}── 線上版（${SITE}）${OFF}`);

    const cache = new Map();
    const fetchOnce = async (rel) => {
        if (!cache.has(rel)) cache.set(rel, await get(new URL(rel, SITE).toString()));
        return cache.get(rel);
    };

    const root = await fetchOnce('');
    if (root.status !== 200) {
        console.log(`  ${RED}✗${OFF} 首頁回 HTTP ${root.status}`);
        process.exit(1);
    }
    console.log(`  ${GREEN}✓${OFF} 首頁 HTTP 200（${root.body.length} bytes）`);

    let fail = 0;
    for (const m of MARKERS) {
        const res = await fetchOnce(m.file);
        const ok = res.status === 200 && res.body.includes(m.needle);
        if (!ok) fail++;
        const where = m.file || 'index.html';
        console.log(`  ${ok ? GREEN + '✓' : RED + '✗'}${OFF} ${where} 有 ${m.needle} ${DIM}— ${m.why}${OFF}`);
    }

    console.log(`\n${MARKERS.length + 1 - fail} passed, ${fail} failed（線上版）`);
    if (fail > 0) {
        console.log(`${DIM}線上版缺少上面標紅的東西＝那些修正還沒合進 main、或 Pages 還沒重建。${OFF}`);
    }
    process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error(err.message || err);
    process.exit(1);
});

#!/usr/bin/env node
// 測試進入點：spawn Electron 跑真視窗，讀回結果並決定 exit code。
// Electron 在 Windows 是 GUI subsystem，主行程的 stdout 接不到父層 console，
// 所以結果走檔案而不是 stdout。

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const RESULTS = path.join(__dirname, '.results.json');
const electronExe = require('electron');

const only = process.argv.slice(2).filter((a) => !a.startsWith('-')).join(' ');

fs.rmSync(RESULTS, { force: true });

const child = spawnSync(
    electronExe,
    [
        '--no-sandbox',
        '--disable-gpu',
        // 測試視窗開在畫面外（見 main.js makeWindow）。Windows 會判定它被遮蔽而停止
        // 送 compositor frame，觸控事件就只能等 ack 逾時（每個 ~1.4s）。關掉這個判定。
        '--disable-features=CalculateNativeWinOcclusion',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        path.join(__dirname, 'main.js'),
    ],
    {
        cwd: ROOT,
        stdio: ['ignore', 'ignore', 'pipe'],
        env: { ...process.env, EPE_RESULTS: RESULTS, EPE_ROOT: ROOT, EPE_ONLY: only },
    }
);

if (!fs.existsSync(RESULTS)) {
    console.error('測試主行程沒有產出結果檔。Electron stderr：');
    console.error(String(child.stderr || '').trim() || '(空)');
    process.exit(1);
}

const results = JSON.parse(fs.readFileSync(RESULTS, 'utf8'));

const GREEN = '\x1b[32m', RED = '\x1b[31m', DIM = '\x1b[2m', YEL = '\x1b[33m', OFF = '\x1b[0m';
let pass = 0, fail = 0, skip = 0;
let lastGroup = null;

for (const r of results.tests) {
    if (r.group !== lastGroup) {
        console.log(`\n${DIM}── ${r.group}${OFF}`);
        lastGroup = r.group;
    }
    if (r.status === 'pass') {
        pass++;
        console.log(`  ${GREEN}✓${OFF} ${r.name} ${DIM}[${r.viewport}] ${r.ms}ms${OFF}`);
    } else if (r.status === 'skip') {
        skip++;
        console.log(`  ${YEL}○${OFF} ${r.name} ${DIM}[${r.viewport}] skip: ${r.reason}${OFF}`);
    } else {
        fail++;
        console.log(`  ${RED}✗${OFF} ${r.name} ${DIM}[${r.viewport}]${OFF}`);
        for (const line of String(r.error).split('\n')) console.log(`      ${RED}${line}${OFF}`);
    }
}

console.log(`\n${pass} passed, ${fail} failed, ${skip} skipped (共 ${results.tests.length})`);
if (results.crashed) {
    console.log(`${RED}主行程異常結束：${results.crashed}${OFF}`);
}
process.exit(fail > 0 || results.crashed ? 1 : 0);

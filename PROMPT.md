# 目標規格

## Goal

讓 Easy Photo Editor 在桌機與手機/平板上，都能用該裝置的自然輸入方式操作全部已實裝功能。

## Done when

- `npm test` 全綠，且涵蓋 desktop(1280×800) 與 mobile(390×844) 兩種 viewport
- 手機上單指拖曳可以畫線（畫筆／橡皮擦／馬賽克／矩形／圓形）
- 手機上可以拖曳裁切框四角、可以平移與縮放圖片
- 手機上文字方塊可以拖曳移動、可以縮放、可以編輯
- 在檔名輸入框打字不會觸發工具快捷鍵
- 手機 viewport 下畫布可用寬度 ≥ viewport 寬度的 70%
- 所有 icon-only 按鈕有 `aria-label`
- 觸控目標 ≥ 44×44 CSS px

## Never touch

- `css/base.css` 的 `:root` 色票與 `--radius` / `--shadow` / `--glass-blur`（設計風格不動）
- `main.js`（Electron 主行程）
- `dist/`、`node_modules/`、`*.exe`
- `package.json` 的 `dependencies` / `devDependencies`（新增套件屬高風險）

## Stop if

- 需要新增任何 npm 套件
- 桌機既有行為出現迴歸（既有綠測試轉紅）
- 改動擴散到 `js/batch.js` 的轉檔輸出格式邏輯

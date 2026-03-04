# Easy Photo Editor

- [English Version](#english-version)
- [中文版 (Chinese Version)](#中文版-chinese-version)

---

## English Version

Because many photo editing tools on the market require paid subscriptions, are filled with ads, or are limited to web interfaces that are painful to use on slow connections, I created this simple offline photo editor.

This is a feature-rich, web-based photo editor implemented using frontend technologies (HTML/CSS/JavaScript). It supports a variety of common image processing features, drawing tools, and batch processing.

### Main Features & Highlights

#### 1. Image Import & Export

- **Multiple Import Methods**: Supports clicking to open files, Drag & Drop, and pasting from the clipboard (Ctrl+V).
- **Image Saving**: Edited results can be exported as PNG, JPEG, or WEBP formats.
- **Direct Conversion**: Batch convert image formats quickly without loading them onto the canvas.

#### 2. Basic View Operations

- **Zoom & Pan**: Supports mouse wheel zooming, fit to screen, and drag panning.
- **Shortcut Support**: Use shortcuts like `Ctrl+Z` (Undo), `Ctrl+Y` (Redo), and `V` (Select) to boost workflow efficiency.

#### 3. Toolbar (Tools)

- **Crop**: Custom crop area with support for dragging corners to resize.
- **Pen**: Freehand drawing with adjustable brush size and color.
- **Shape Drawing**:
  - **Rectangle**: Supports outline and solid modes (press `R` to toggle).
  - **Circle**: Supports outline and solid modes (press `O` to toggle).
- **Mosaic**: Blur specified areas to protect privacy or create effects.

#### 4. Image Adjustments

- **Parameter Tweaks**: Real-time adjustment of image **Brightness**, **Contrast**, and **Saturation**.
- **Transformations**:
  - Rotate 90 degrees left/right.
  - Flip horizontally/vertically.

#### 5. State Management

- **History**: Comprehensive Undo / Redo mechanism to easily revert editing mistakes.

#### 6. Batch Processing

- When importing multiple images at once, the system automatically creates a batch processing list.
- You can adjust brightness, contrast, rotation, and export format on the first image, then click "Apply current edits and format and download". The system will automatically process and sequentially download all images in the list.

---

### Build & Compile as Standalone Application (.exe)

Packaged using **Electron** and **@electron/packager**.

#### System Requirements

- [Node.js](https://nodejs.org/) (Recommended version v18 or above)
- npm (Installed with Node.js)

#### Installation & Build Steps

1. **Install Dependencies**:
    Open a terminal in the project root directory and run the following command to install Electron and packaging tools:

    ```bash
    npm install
    ```

2. **Local Development Test** (Optional, for development testing only):

    ```bash
    npm start
    ```

3. **Compile to .exe**:
    Run the following command to start the build and packaging process:

    ```bash
    npm run build
    ```

    *The build process may take a few minutes, please be patient.*

4. **Retrieve Compiled Files**:
    After the build is complete, a `dist` folder will be automatically generated in the project directory. Inside the `dist/Photo Editor Pro-win32-x64` folder, you will find a standalone executable named `Photo Editor Pro.exe`. You can copy the entire folder to any Windows computer and double-click to use it directly.

---

**Tech Stack**:

- HTML5 Canvas API
- Vanilla JavaScript (No external framework dependencies)
- Lucide Icons (Vector icons)
- Electron (Desktop application packaging)

---

## 中文版 (Chinese Version)

因為市面上的圖片編輯軟體很多都需要要求使用者課金訂閱或是廣告一堆，不然就是受限於網頁介面，網路慢用起來就非常痛苦，於是我做了一個簡易的線下圖片編輯器。

這是一個功能豐富，基於前端技術（HTML/CSS/JavaScript）實作的網頁版圖片編輯器。它支援多種常見的影像處理功能、繪圖工具及批量處理。

### 主要功能與特色

#### 1. 影像輸入與匯出

- **多種匯入方式**：支援點擊開啟檔案、拖放圖片 (Drag & Drop) 以及從剪貼簿貼上 (Ctrl+V)。
- **影像儲存**：可將編輯後的結果匯出為 PNG、JPEG 或 WEBP 格式。
- **直接轉檔**：不需將圖片載入畫布，即可快速批次轉換圖片格式。

#### 2. 基本視圖操作

- **縮放與平移**：支援滑鼠滾輪縮放、畫面適應 (Fit to screen) 及拖曳平移。
- **快捷鍵支援**：支援使用如 `Ctrl+Z` (復原)、`Ctrl+Y` (重做)、`V` (選取) 等快捷鍵操作，提升工作效率。

#### 3. 工具列 (Tools)

- **裁切 (Crop)**：可自訂裁切範圍，並支援拖曳四角縮放。
- **畫筆 (Pen)**：自由繪圖，可調整筆刷粗細與顏色。
- **形狀繪製**：
  - **矩形 (Rectangle)**：支援空心與實心模式 (可按 `R` 切換)。
  - **圓形 (Circle)**：支援空心與實心模式 (可按 `O` 切換)。
- **馬賽克 (Mosaic)**：模糊化指定區域，保護隱私或製作特效。

#### 4. 影像調整 (Adjustments)

- **參數微調**：可即時調整影像的**亮度 (Brightness)**、**對比度 (Contrast)** 與**飽和度 (Saturation)**。
- **變形處理**：
  - 向左/向右旋轉 90 度。
  - 水平翻轉 / 垂直翻轉。

#### 5. 狀態管理

- **歷史紀錄**：完善的 Undo / Redo 機制，隨時還原編輯錯誤。

#### 6. 批量處理 (Batch Processing)

- 當一次匯入多張圖片時，系統會自動建立批量處理清單。
- 您可以先在第一張圖片上調整好亮度、對比度、旋轉、匯出格式等設定，接著一鍵「套用現有編輯與格式並下載」，系統會自動處理清單中的所有圖片並依序下載。

---

### 建置與編譯為獨立應用程式 (.exe)

使用 **Electron** 搭配 **@electron/packager** 進行封裝。

#### 系統環境要求

- [Node.js](https://nodejs.org/) (建議版本 v18 或以上)
- npm (隨 Node.js 安裝)

#### 安裝與編譯步驟

1. **安裝依賴套件**:
    在專案根目錄中開啟終端機，執行以下指令安裝 Electron 與打包工具：

    ```bash
    npm install
    ```

2. **本地開發測試** (非必要，僅供開發階段測試):

    ```bash
    npm start
    ```

3. **編譯為 .exe 執行檔**:
    執行以下指令開始編譯封裝程序：

    ```bash
    npm run build
    ```

    *編譯過程可能需要幾分鐘的時間，請耐心等候。*

4. **取得編譯完成的檔案**:
    編譯完成後，專案目錄中會自動生成一個 `dist` 資料夾。在 `dist/Photo Editor Pro-win32-x64` 資料夾中有名為 `Photo Editor Pro.exe` 的獨立免安裝執行檔。將整個資料夾複製到任何 Windows 電腦上即可直接點擊使用。

---

**技術棧**:

- HTML5 Canvas API
- Vanilla JavaScript (無依賴外部框架)
- Lucide Icons (向量圖示)
- Electron (桌面應用程式封裝)

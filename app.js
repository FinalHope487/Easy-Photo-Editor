// 照片編輯器進入點
// 核心邏輯已移至 js/ 目錄下：
// - core.js: PhotoEditor 類別與基礎功能
// - tools.js: 畫布工具與滑鼠事件
// - ui.js: DOM 綁定
// - history.js: 復原與重做
// - batch.js: 批量處理功能

// Initialize application on load
window.addEventListener('DOMContentLoaded', () => {
    window.editor = new PhotoEditor();
});

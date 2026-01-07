/**
 * Entry
 */
(function () {
  "use strict";
  if (!window.MSUI || typeof window.MSUI.createUI !== "function") {
    // If scripts fail to load, show a friendly hint.
    const el = document.getElementById("statusText");
    if (el) el.textContent = "脚本加载失败：请确认 css/js 文件路径正确，或用 npm start 启动本地服务。";
    return;
  }
  window.MSUI.createUI();
})();

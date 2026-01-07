/**
 * Entry + robust boot/error overlay for mobile browsers.
 */
(function () {
  "use strict";

  const PREFIX = "msw_ret:";
  function clearSettings() {
    try {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(PREFIX)) keys.push(k);
      }
      for (const k of keys) localStorage.removeItem(k);
    } catch {
      // ignore
    }
  }

  function $(id){ return document.getElementById(id); }

  const boot = $("bootOverlay");
  const bootClear = $("bootClear");
  const bootReload = $("bootReload");
  const debugBar = $("debugBar");
  const debugText = $("debugText");
  const debugClear = $("debugClear");

  function hideBoot(){
    if (boot) boot.hidden = true;
  }
  function showDebug(msg){
    if (!debugBar) return;
    debugBar.hidden = false;
    if (debugText) debugText.textContent = msg || "出现错误：请清空设置并刷新。";
  }

  if (bootClear) bootClear.addEventListener("click", () => { clearSettings(); location.reload(); });
  if (bootReload) bootReload.addEventListener("click", () => location.reload());
  if (debugClear) debugClear.addEventListener("click", () => { clearSettings(); location.reload(); });

  // Show runtime errors (helps diagnose "无棋盘/无响应")
  window.addEventListener("error", (e) => {
    showDebug("脚本错误：" + (e.message || "unknown"));
  });
  window.addEventListener("unhandledrejection", (e) => {
    showDebug("Promise 错误：" + ((e.reason && (e.reason.message || String(e.reason))) || "unknown"));
  });

  // If UI is ready, start it
  if (!window.MSUI || typeof window.MSUI.createUI !== "function") {
    showDebug("MSUI 未加载：请检查 ./js/ui.js 是否成功加载（网络/缓存/路径）。");
    return;
  }

  try {
    window.MSUI.createUI();
    hideBoot();

    // If board still has no cells after a moment, keep boot visible with help.
    setTimeout(() => {
      const board = document.getElementById("board");
      if (board && board.children && board.children.length > 0) return;
      // show overlay again (some in-app browsers block JS partially)
      if (boot) boot.hidden = false;
      showDebug("棋盘未渲染：可能是浏览器限制/缓存。点“清空设置”或换浏览器打开。");
    }, 900);
  } catch (err) {
    showDebug("初始化失败：" + (err && err.message ? err.message : String(err)));
    // keep boot visible so user can recover
    if (boot) boot.hidden = false;
  }
})();

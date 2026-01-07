import { GameStatus, createEmptyGrid, placeMines, openCell, toggleFlag, countFlags, countOpenSafe, chordOpen } from "./game.js";
import { load, save } from "./storage.js";
import { SFX, unlockAudio } from "./sound.js";

const DIFFICULTIES = {
  beginner: { cols: 9, rows: 9, mines: 10, label: "初级" },
  intermediate: { cols: 16, rows: 16, mines: 40, label: "中级" },
  expert: { cols: 30, rows: 16, mines: 99, label: "高级" },
};

function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

function pad3(n){
  const s = String(clamp(n, -99, 999));
  if (s.startsWith("-")) {
    return "-" + String(Math.abs(Number(s))).padStart(2, "0");
  }
  return s.padStart(3, "0");
}

function formatTime(s){
  const m = Math.floor(s/60);
  const ss = s%60;
  return `${String(m).padStart(2,"0")}:${String(ss).padStart(2,"0")}`;
}

/**
 * Build a 3-digit seven segment display inside container.
 * container: <div class="seg" ...>
 */
export function buildSevenSeg(container){
  container.innerHTML = "";
  for (let i=0;i<3;i++){
    const d = document.createElement("div");
    d.className = "seg-digit";
    d.setAttribute("data-digit", String(i));
    // segments a b c d e f g
    const segs = ["a","b","c","d","e","f","g"];
    for (const name of segs){
      const s = document.createElement("span");
      s.className = `s ${name}`;
      d.appendChild(s);
    }
    container.appendChild(d);
  }
}

/**
 * Set a 3-digit seven segment display to value (-99..999).
 */
export function setSevenSeg(container, value){
  const text = pad3(value);
  const digits = [...container.querySelectorAll(".seg-digit")];
  for (let i=0;i<3;i++){
    const ch = text[i];
    const d = digits[i];
    setDigit(d, ch);
  }
}

/**
 * Segment mapping:
 * a,b,c,d,e,f,g
 */
const DIGIT_MAP = {
  "0": ["a","b","c","d","e","f"],
  "1": ["b","c"],
  "2": ["a","b","g","e","d"],
  "3": ["a","b","g","c","d"],
  "4": ["f","g","b","c"],
  "5": ["a","f","g","c","d"],
  "6": ["a","f","g","e","c","d"],
  "7": ["a","b","c"],
  "8": ["a","b","c","d","e","f","g"],
  "9": ["a","b","c","d","f","g"],
  "-": ["g"],
  " ": []
};

function setDigit(digitEl, ch){
  const on = new Set(DIGIT_MAP[ch] || []);
  for (const seg of digitEl.querySelectorAll(".s")){
    const name = seg.classList[1];
    seg.classList.toggle("on", on.has(name));
  }
}

function isTouchPrimary(){
  return window.matchMedia && window.matchMedia("(hover: none) and (pointer: coarse)").matches;
}

export function createUI(){
  const els = {
    board: document.getElementById("board"),
    statusText: document.getElementById("statusText"),
    difficulty: document.getElementById("difficulty"),
    resetBtn: document.getElementById("resetBtn"),
    minesCounter: document.getElementById("minesCounter"),
    timeCounter: document.getElementById("timeCounter"),
    minesCounterText: document.getElementById("minesCounterText"),
    timeCounterText: document.getElementById("timeCounterText"),
    themeToggle: document.getElementById("themeToggle"),
    themeName: document.getElementById("themeName"),
    soundToggle: document.getElementById("soundToggle"),
    soundName: document.getElementById("soundName"),
    customDialog: document.getElementById("customDialog"),
    customW: document.getElementById("customW"),
    customH: document.getElementById("customH"),
    customM: document.getElementById("customM"),
    customError: document.getElementById("customError"),
    customApply: document.getElementById("customApply"),
    helpDialog: document.getElementById("helpDialog"),
    helpBtn: document.getElementById("helpBtn"),
    resultDialog: document.getElementById("resultDialog"),
    resultTitle: document.getElementById("resultTitle"),
    resultDesc: document.getElementById("resultDesc"),
    playAgain: document.getElementById("playAgain"),
    openAbout: document.getElementById("openAbout"),
    modeReveal: document.getElementById("modeReveal"),
    modeFlag: document.getElementById("modeFlag"),
    modeChord: document.getElementById("modeChord"),
  };

  buildSevenSeg(els.minesCounter);
  buildSevenSeg(els.timeCounter);

  // ---- persistent settings
  const theme = load("theme", "classic");
  setTheme(theme, els);

  const soundEnabled = load("sound", true);
  setSound(soundEnabled, els);

  const storedLevel = load("difficulty", "beginner");
  if (storedLevel && DIFFICULTIES[storedLevel]) {
    els.difficulty.value = storedLevel;
  }

  let lastDifficultyValue = els.difficulty.value;

  // touch mode (for mobile action bar)
  const touchModeLoaded = load("touchMode", "reveal");

  function applyTouchModeUI(mode){
    const modes = ["reveal","flag","chord"];
    if (!modes.includes(mode)) mode = "reveal";
    els.modeReveal.setAttribute("aria-selected", String(mode==="reveal"));
    els.modeFlag.setAttribute("aria-selected", String(mode==="flag"));
    els.modeChord.setAttribute("aria-selected", String(mode==="chord"));
  }

  const state = {
    cfg: DIFFICULTIES[els.difficulty.value] || DIFFICULTIES.beginner,
    rows: 9, cols: 9, mines: 10,
    grid: [],
    status: GameStatus.READY,
    firstClick: true,
    timer: 0,
    timerId: null,
    sound: soundEnabled,
    touchMode,
    focus: { r: 0, c: 0 }, // roving focus
  };

  // Apply initial touch mode UI
  applyTouchModeUI(state.touchMode);


  function applyConfig(cfg){
    state.cfg = cfg;
    state.rows = cfg.rows;
    state.cols = cfg.cols;
    state.mines = cfg.mines;
    newGame();
  }

  function validateCustom(rows, cols, mines){
    // Reasonable bounds (kept UI-friendly)
    const r = Number(rows), c = Number(cols), m = Number(mines);
    if (![r,c,m].every(Number.isFinite)) return "请输入有效数字。";
    if (r < 5 || r > 30) return "高度（行）需在 5 ~ 30 之间。";
    if (c < 5 || c > 40) return "宽度（列）需在 5 ~ 40 之间。";
    if (m < 1) return "雷数至少为 1。";
    const cells = r * c;
    // Ensure there is room for first-click safe region (ideally 3x3 => 9 cells).
    const reserve = Math.min(9, cells - 1);
    if (m > cells - reserve) return `雷数过多。建议 ≤ ${cells - reserve}（需保留首次安全区域）。`;
    return null;
  }

  function startTimer(){
    stopTimer();
    state.timerId = window.setInterval(() => {
      if (state.status !== GameStatus.RUNNING) return;
      state.timer = clamp(state.timer + 1, 0, 999);
      setSevenSeg(els.timeCounter, state.timer);
      els.timeCounterText.textContent = `计时：${formatTime(state.timer)}`;
    }, 1000);
  }

  function stopTimer(){
    if (state.timerId) window.clearInterval(state.timerId);
    state.timerId = null;
  }

  function updateCounters(){
    const flags = countFlags(state.grid);
    setSevenSeg(els.minesCounter, state.mines - flags);
    els.minesCounterText.textContent = `剩余雷数：${state.mines - flags}`;
  }

  function setStatus(text){
    els.statusText.textContent = text;
  }

  function setFace(face){
    // smile / wow / dead / win
    els.resetBtn.dataset.face = face;
    const faceEl = els.resetBtn.querySelector(".smiley__face");
    faceEl.innerHTML = "<i></i>"; // simple mouth element
  }

  function newGame(){
    state.grid = createEmptyGrid(state.rows, state.cols);
    state.status = GameStatus.READY;
    state.firstClick = true;
    state.timer = 0;
    setSevenSeg(els.timeCounter, 0);
    els.timeCounterText.textContent = "计时：00:00";
    updateCounters();
    setFace("smile");
    setStatus("准备就绪：首次点击必不踩雷。");
    renderBoard();
    stopTimer();

    // Reset focus to top-left
    state.focus = { r: 0, c: 0 };
    applyRovingTabindex();
  }

  function gameOver(win){
    stopTimer();
    state.status = win ? GameStatus.WON : GameStatus.LOST;
    if (win) setFace("win");
    else setFace("dead");

    // reveal mines (if lost), or reveal all safe cells (if win)
    for (let r=0;r<state.rows;r++){
      for (let c=0;c<state.cols;c++){
        const cell = state.grid[r][c];
        if (win) {
          if (!cell.mine) cell.open = true;
        } else {
          if (cell.mine) cell.open = true;
        }
      }
    }
    renderBoard();

    if (state.sound) (win ? SFX.win() : SFX.boom());

    showResult(win);
  }

  function showResult(win){
    els.resultTitle.textContent = win ? "胜利！" : "失败！";
    els.resultDesc.textContent = win
      ? `你用时 ${formatTime(state.timer)}，恭喜通关！`
      : "你踩到雷了，别灰心，再来一局！";

    if (typeof els.resultDialog.showModal === "function") {
      els.resultDialog.showModal();
    } else {
      alert(els.resultTitle.textContent + "\n" + els.resultDesc.textContent);
    }
  }

  function checkWin(){
    const { opened, totalSafe } = countOpenSafe(state.grid);
    if (opened === totalSafe && state.status !== GameStatus.WON) {
      gameOver(true);
    }
  }

  function ensureMinesPlaced(firstR, firstC){
    if (!state.firstClick) return;
    placeMines(state.grid, state.mines, firstR, firstC);
    state.firstClick = false;
    state.status = GameStatus.RUNNING;
    startTimer();
  }

  function openAt(r, c){
    if (state.status === GameStatus.LOST || state.status === GameStatus.WON) return;
    ensureMinesPlaced(r, c);

    const res = openCell(state.grid, r, c);
    if (res.opened.length) {
      if (state.sound) SFX.open();
    } else {
      if (state.sound) SFX.click();
    }

    if (res.hitMine) {
      // Mark the exploded cell
      state.grid[r][c].open = true;
      renderBoard({ boomAt: [r, c] });
      gameOver(false);
      return;
    }

    renderBoard();
    updateCounters();
    checkWin();
  }

  function flagAt(r, c){
    if (state.status === GameStatus.LOST || state.status === GameStatus.WON) return;
    if (state.firstClick) {
      // allow flagging before first open, but game is still READY
    }
    const cell = state.grid[r][c];
    if (cell.open) return;

    const ok = toggleFlag(state.grid, r, c);
    if (!ok) return;

    updateCounters();
    renderBoard();
    if (state.sound) (cell.flag ? SFX.flag() : SFX.unflag());
  }

  function chordAt(r, c){
    if (state.status !== GameStatus.RUNNING) return;
    const res = chordOpen(state.grid, r, c);
    if (!res.did) return;
    if (state.sound) SFX.open();

    if (res.hitMine) {
      renderBoard({ boomAt: [r, c] });
      gameOver(false);
      return;
    }

    renderBoard();
    updateCounters();
    checkWin();
  }

  function renderBoard({ boomAt=null } = {}){
    const b = els.board;

    // Update css vars
    b.style.setProperty("--cols", String(state.cols));

    // Dynamic sizing based on board size & viewport
    // (keeps classic feel but adapts on small screens)
    const maxCell = isTouchPrimary() ? 30 : 32;
    const minCell = isTouchPrimary() ? 20 : 22;
    const cellSize = clamp(Math.floor((Math.min(window.innerWidth, 960) - 80) / state.cols), minCell, maxCell);
    document.documentElement.style.setProperty("--cell-size", `${cellSize}px`);

    const frag = document.createDocumentFragment();
    b.innerHTML = "";

    for (let r=0;r<state.rows;r++){
      for (let c=0;c<state.cols;c++){
        const cell = state.grid[r][c];
        const btn = document.createElement("button");
        btn.className = "cell";
        btn.type = "button";
        btn.dataset.r = String(r);
        btn.dataset.c = String(c);
        btn.setAttribute("role", "gridcell");

        // roving tabindex applied later
        btn.tabIndex = -1;

        // Visual state
        if (cell.open) btn.classList.add("open");
        if (boomAt && boomAt[0]===r && boomAt[1]===c) btn.classList.add("boom");

        // Content
        btn.innerHTML = "";

        if (cell.open) {
          if (cell.mine) {
            const icon = document.createElement("span");
            icon.className = "icon icon-mine mine-burst";
            btn.appendChild(icon);
          } else if (cell.num > 0) {
            btn.textContent = String(cell.num);
            btn.dataset.num = String(cell.num);
          } else {
            btn.textContent = "";
          }
        } else {
          if (cell.flag) {
            const icon = document.createElement("span");
            icon.className = "icon icon-flag";
            btn.appendChild(icon);
          }
        }

        // ARIA label (accessible)
        btn.setAttribute("aria-label", getCellAriaLabel(r, c, cell));

        frag.appendChild(btn);
      }
    }

    b.appendChild(frag);
    applyRovingTabindex();
  }

  function getCellAriaLabel(r, c, cell){
    const base = `第 ${r+1} 行，第 ${c+1} 列`;
    if (state.status === GameStatus.LOST && cell.mine) {
      return `${base}：地雷`;
    }
    if (cell.open) {
      if (cell.mine) return `${base}：地雷（爆炸）`;
      if (cell.num === 0) return `${base}：空白已翻开`;
      return `${base}：数字 ${cell.num} 已翻开`;
    }
    if (cell.flag) return `${base}：已插旗（未翻开）`;
    return `${base}：未翻开`;
  }

  function applyRovingTabindex(){
    const b = els.board;
    const focusKey = `${state.focus.r},${state.focus.c}`;
    for (const el of b.querySelectorAll(".cell")){
      const key = `${el.dataset.r},${el.dataset.c}`;
      el.tabIndex = (key === focusKey) ? 0 : -1;
    }
  }

  function focusCell(r, c){
    state.focus.r = clamp(r, 0, state.rows-1);
    state.focus.c = clamp(c, 0, state.cols-1);
    applyRovingTabindex();
    const el = els.board.querySelector(`.cell[data-r="${state.focus.r}"][data-c="${state.focus.c}"]`);
    if (el) el.focus({ preventScroll: false });
  }

  // ---- Event wiring ----

  // Difficulty change
  els.difficulty.addEventListener("change", () => {
    const val = els.difficulty.value;
    if (val === "custom") {
      els.customError.textContent = "";
      if (typeof els.customDialog.showModal === "function") els.customDialog.showModal();
      else alert("你的浏览器不支持 <dialog>，请升级浏览器。");
      // revert selection unless user applies
      els.difficulty.value = lastDifficultyValue;
      return;
    }

    lastDifficultyValue = val;
    save("difficulty", val);
    applyConfig(DIFFICULTIES[val]);
  });

  // Custom dialog apply
  els.customDialog.addEventListener("close", () => {
    // if user closed by ESC or cancel, do nothing
    els.customError.textContent = "";
  });

  els.customApply.addEventListener("click", (e) => {
    const rows = Number(els.customH.value);
    const cols = Number(els.customW.value);
    const mines = Number(els.customM.value);
    const err = validateCustom(rows, cols, mines);
    if (err) {
      e.preventDefault();
      els.customError.textContent = err;
      return;
    }
    const cfg = { rows, cols, mines, label:"自定义" };
    save("difficulty", "custom");
    save("customCfg", cfg);
    lastDifficultyValue = "custom";
    els.difficulty.value = "custom";
    applyConfig(cfg);
    els.customDialog.close();
  });

  // If previously selected custom, restore
  if (load("difficulty", "beginner") === "custom") {
    const cfg = load("customCfg", null);
    if (cfg) {
      lastDifficultyValue = "custom";
      els.difficulty.value = "custom";
      applyConfig(cfg);
    } else {
      lastDifficultyValue = "beginner";
      els.difficulty.value = "beginner";
      applyConfig(DIFFICULTIES.beginner);
    }
  } else {
    applyConfig(DIFFICULTIES[load("difficulty", els.difficulty.value)] || DIFFICULTIES.beginner);
  }

  // Reset
  els.resetBtn.addEventListener("click", async () => {
    await unlockAudio();
    newGame();
  });

  // Smiley "wow" feedback on press
  els.board.addEventListener("pointerdown", () => {
    if (state.status === GameStatus.RUNNING || state.status === GameStatus.READY) setFace("wow");
  });
  window.addEventListener("pointerup", () => {
    if (state.status === GameStatus.RUNNING || state.status === GameStatus.READY) setFace("smile");
  });

  // Theme toggle
  els.themeToggle.addEventListener("click", () => {
    const cur = document.documentElement.dataset.theme || "classic";
    const next = cur === "dark" ? "classic" : "dark";
    setTheme(next, els);
    save("theme", next);
  });

  // Sound toggle
  els.soundToggle.addEventListener("click", async () => {
    await unlockAudio();
    state.sound = !state.sound;
    setSound(state.sound, els);
    save("sound", state.sound);
    if (state.sound) SFX.win(); // small feedback
  });

  // Help
  function openHelp(){
    if (typeof els.helpDialog.showModal === "function") els.helpDialog.showModal();
    else alert("帮助：左键翻开，右键插旗，双击数字快速翻开。");
  }
  els.helpBtn.addEventListener("click", openHelp);
  els.openAbout.addEventListener("click", (e) => { e.preventDefault(); openHelp(); });

  // Result play again
  els.playAgain.addEventListener("click", () => {
    els.resultDialog.close();
    newGame();
  });

  // Touch modes
  function setTouchMode(mode){
    const modes = ["reveal","flag","chord"];
    if (!modes.includes(mode)) mode = "reveal";
    applyTouchModeUI(mode);
    state.touchMode = mode;
    save("touchMode", mode);
  }
  els.modeReveal.addEventListener("click", () => setTouchMode("reveal"));
  els.modeFlag.addEventListener("click", () => setTouchMode("flag"));
  els.modeChord.addEventListener("click", () => setTouchMode("chord"));

  // Board interactions:
  // - click (or tap): open / flag / chord based on mode
  // - right click: flag
  // - double click: chord
  // - long press: flag (mobile)
  let lastTap = { t: 0, r: -1, c: -1 };
  let longPressTimer = null;
  let longPressTriggered = false;

  function getRCFromTarget(target){
    const btn = target.closest(".cell");
    if (!btn) return null;
    return { r: Number(btn.dataset.r), c: Number(btn.dataset.c), el: btn };
  }

  function performByMode(r, c){
    if (isTouchPrimary()) {
      if (state.touchMode === "flag") return flagAt(r, c);
      if (state.touchMode === "chord") return chordAt(r, c);
      return openAt(r, c);
    }
    // desktop default: open on left click
    return openAt(r, c);
  }

  // context menu (right click)
  els.board.addEventListener("contextmenu", (e) => {
    const rc = getRCFromTarget(e.target);
    if (!rc) return;
    e.preventDefault();
    flagAt(rc.r, rc.c);
  });

  // pointerdown for long press & focus
  els.board.addEventListener("pointerdown", async (e) => {
    const rc = getRCFromTarget(e.target);
    if (!rc) return;

    await unlockAudio();

    // focus follows interaction
    focusCell(rc.r, rc.c);

    longPressTriggered = false;
    if (isTouchPrimary()) {
      // long press to flag
      clearTimeout(longPressTimer);
      longPressTimer = setTimeout(() => {
        longPressTriggered = true;
        flagAt(rc.r, rc.c);
      }, 420);
    }
  });

  els.board.addEventListener("pointerup", (e) => {
    clearTimeout(longPressTimer);
  });
  els.board.addEventListener("pointercancel", () => {
    clearTimeout(longPressTimer);
  });

  // click/tap
  els.board.addEventListener("click", (e) => {
    const rc = getRCFromTarget(e.target);
    if (!rc) return;

    // if long press already flagged, don't also open
    if (longPressTriggered) return;

    // Double tap detection for touch (avoid zoom: CSS touch-action)
    const now = performance.now();
    if (isTouchPrimary()) {
      const dt = now - lastTap.t;
      if (dt < 280 && lastTap.r === rc.r && lastTap.c === rc.c) {
        chordAt(rc.r, rc.c);
        lastTap = { t: 0, r: -1, c: -1 };
        return;
      }
      lastTap = { t: now, r: rc.r, c: rc.c };
      performByMode(rc.r, rc.c);
      return;
    }

    // desktop click opens (right click handled above)
    openAt(rc.r, rc.c);
  });

  // double click for chord
  els.board.addEventListener("dblclick", (e) => {
    const rc = getRCFromTarget(e.target);
    if (!rc) return;
    chordAt(rc.r, rc.c);
  });

  // Keyboard support: arrows move focus; Space opens; F flags; Enter chords
  els.board.addEventListener("keydown", (e) => {
    const { r, c } = state.focus;
    if (e.key === "ArrowUp") { e.preventDefault(); focusCell(r-1, c); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); focusCell(r+1, c); return; }
    if (e.key === "ArrowLeft") { e.preventDefault(); focusCell(r, c-1); return; }
    if (e.key === "ArrowRight") { e.preventDefault(); focusCell(r, c+1); return; }
    if (e.key === " " || e.key === "Spacebar") { e.preventDefault(); openAt(r, c); return; }
    if (e.key.toLowerCase() === "f") { e.preventDefault(); flagAt(r, c); return; }
    if (e.key === "Enter") { e.preventDefault(); chordAt(r, c); return; }
  });

  // Window resize re-render for sizing
  window.addEventListener("resize", () => {
    // avoid expensive continuous reflow, but ok for this size
    renderBoard();
  });

  // Initial render
  newGame();

  return { state, newGame, applyConfig };
}

function setTheme(theme, els){
  const t = theme === "dark" ? "dark" : "classic";
  if (t === "classic") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = "dark";
  els.themeName.textContent = t === "dark" ? "Dark" : "Classic";
}

function setSound(enabled, els){
  els.soundName.textContent = enabled ? "开" : "关";
}

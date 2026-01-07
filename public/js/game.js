/**
 * Core minesweeper logic (UI-agnostic).
 * Global namespace: window.MSGame
 *
 * Features:
 * - First click safe (never hits a mine)
 * - Prefer first click expands: avoid mines in 3x3 around first cell
 * - Open recursion using BFS
 * - Flagging
 * - Chord (quick open around number when flags match)
 *
 * Data model:
 * cell = { mine, open, flag, num }
 */
(function () {
  "use strict";

  const GameStatus = Object.freeze({
    READY: "ready",
    RUNNING: "running",
    WON: "won",
    LOST: "lost",
  });

  function createEmptyGrid(rows, cols) {
    return Array.from({ length: rows }, () =>
      Array.from({ length: cols }, () => ({
        mine: false,
        open: false,
        flag: false,
        num: 0,
      }))
    );
  }

  function inBounds(rows, cols, r, c) {
    return r >= 0 && r < rows && c >= 0 && c < cols;
  }

  function neighbors(rows, cols, r, c) {
    const out = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = r + dr, nc = c + dc;
        if (inBounds(rows, cols, nr, nc)) out.push([nr, nc]);
      }
    }
    return out;
  }

  function computeNumbers(grid) {
    const rows = grid.length;
    const cols = grid[0].length;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c].mine) {
          grid[r][c].num = 0;
          continue;
        }
        const nbs = neighbors(rows, cols, r, c);
        let count = 0;
        for (const [nr, nc] of nbs) if (grid[nr][nc].mine) count++;
        grid[r][c].num = count;
      }
    }
  }

  function placeMines(grid, mineCount, safeR, safeC) {
    const rows = grid.length;
    const cols = grid[0].length;
    const safeSet = new Set();

    // Safe zone: 3x3 around first click (improves first expansion)
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const r = safeR + dr, c = safeC + dc;
        if (inBounds(rows, cols, r, c)) safeSet.add(`${r},${c}`);
      }
    }

    // Candidate positions excluding safe zone
    const candidates = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!safeSet.has(`${r},${c}`)) candidates.push([r, c]);
      }
    }

    // If board too small, still guarantee first click cell safe
    if (mineCount > candidates.length) {
      candidates.length = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          if (!(r === safeR && c === safeC)) candidates.push([r, c]);
        }
      }
    }

    // Fisher–Yates shuffle
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    const pick = candidates.slice(0, mineCount);
    for (const [r, c] of pick) grid[r][c].mine = true;

    computeNumbers(grid);
  }

  function openCell(grid, r, c) {
    const rows = grid.length;
    const cols = grid[0].length;
    const cell = grid[r][c];
    if (cell.open || cell.flag) return { opened: [], hitMine: false };

    const opened = [];
    const queue = [[r, c]];
    const seen = new Set();

    while (queue.length) {
      const [cr, cc] = queue.shift();
      const key = `${cr},${cc}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const cur = grid[cr][cc];
      if (cur.open || cur.flag) continue;

      cur.open = true;
      opened.push([cr, cc]);

      if (cur.mine) {
        return { opened, hitMine: true };
      }

      if (cur.num === 0) {
        for (const [nr, nc] of neighbors(rows, cols, cr, cc)) {
          const n = grid[nr][nc];
          if (!n.open && !n.flag && !seen.has(`${nr},${nc}`)) queue.push([nr, nc]);
        }
      }
    }

    return { opened, hitMine: false };
  }

  function toggleFlag(grid, r, c) {
    const cell = grid[r][c];
    if (cell.open) return false;
    cell.flag = !cell.flag;
    return true;
  }

  function countFlags(grid) {
    let flags = 0;
    for (const row of grid) for (const cell of row) if (cell.flag) flags++;
    return flags;
  }

  function countOpenSafe(grid) {
    let opened = 0;
    let totalSafe = 0;
    for (const row of grid) {
      for (const cell of row) {
        if (!cell.mine) totalSafe++;
        if (cell.open && !cell.mine) opened++;
      }
    }
    return { opened, totalSafe };
  }

  function chordOpen(grid, r, c) {
    const rows = grid.length;
    const cols = grid[0].length;
    const cell = grid[r][c];
    if (!cell.open || cell.num <= 0) return { opened: [], hitMine: false, did: false };

    const nbs = neighbors(rows, cols, r, c);
    let flagCount = 0;
    for (const [nr, nc] of nbs) if (grid[nr][nc].flag) flagCount++;

    if (flagCount !== cell.num) return { opened: [], hitMine: false, did: false };

    const opened = [];
    for (const [nr, nc] of nbs) {
      const n = grid[nr][nc];
      if (!n.open && !n.flag) {
        const res = openCell(grid, nr, nc);
        opened.push(...res.opened);
        if (res.hitMine) return { opened, hitMine: true, did: true };
      }
    }
    return { opened, hitMine: false, did: true };
  }

  window.MSGame = {
    GameStatus,
    createEmptyGrid,
    placeMines,
    openCell,
    toggleFlag,
    countFlags,
    countOpenSafe,
    chordOpen,
    neighbors,
    inBounds,
  };
})();

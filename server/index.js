/**
 * Express 静态站点服务（Render 友好）
 * - 监听 process.env.PORT（默认 3000）
 * - 服务 public 目录
 */
const path = require("path");
const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

const publicDir = path.join(__dirname, "..", "public");
app.use(
  express.static(publicDir, {
    // 适度缓存：HTML 不缓存，静态资源可缓存
    setHeaders: (res, filePath) => {
      if (filePath.endsWith(".html")) {
        res.setHeader("Cache-Control", "no-store");
      } else {
        res.setHeader("Cache-Control", "public, max-age=86400");
      }
    },
  })
);

// 静态回退：任何未知路径都返回 index.html（方便后续扩展）
app.get("*", (req, res) => {
  res.sendFile(path.join(publicDir, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Minesweeper running on http://localhost:${PORT}`);
});

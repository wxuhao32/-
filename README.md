# 扫雷 Minesweeper（复古 Win98/XP 风）— Node.js + Express + 原生前端

> 一个“开箱即用”的扫雷网页游戏：桌面端/手机端自适配、触屏与鼠标交互友好、支持 Classic/Dark 主题、音效（WebAudio）、键盘操作与可访问性（ARIA / roving tabindex / prefers-reduced-motion）。

---

## 1) 项目介绍与功能列表

### ✅ 游戏功能（全部实现）
- **三种难度**  
  - 初级：9×9 / 10 雷  
  - 中级：16×16 / 40 雷  
  - 高级：30×16 / 99 雷  
  - **自定义**：宽/高/雷数，带合理校验（避免雷数过多导致首次安全区域无法保证）
- **首次点击必不踩雷**  
  且尽量保证首次点击周围 **3×3 安全**，更容易展开。
- **交互**
  - 鼠标左键：翻开
  - 鼠标右键：插旗/取消旗
  - 双击数字：**快速翻开周围（Chord）**
  - 手机端：提供**三段模式按钮**（翻开/插旗/快速翻开），并支持**长按插旗**（更稳）
- **计时器**、**剩余雷数显示**（总雷 - 已插旗）
- **复古“笑脸”重开按钮**：按下会变表情，胜利/失败会变不同表情
- **胜利/失败弹窗 + 动画**
- **键盘支持（桌面端）**
  - 方向键移动焦点
  - 空格翻开
  - F 插旗
  - Enter 快速翻开（Chord）
- **音效与可开关**
  - 使用 **WebAudio** 生成方波/三角波/锯齿波音效（无侵权素材）
  - 设置会记忆（localStorage）
- **可访问性**
  - 棋盘使用 `role="grid"` + 每个格子 `role="gridcell"`
  - 每个格子有清晰的 `aria-label` 描述
  - 计时、剩余雷数使用 `aria-live`
  - 支持 `prefers-reduced-motion: reduce` 自动减少动画

---

## 2) 本地运行步骤（必须：npm install && npm start）

### 环境要求
- Node.js **>= 18**

### 运行
```bash
npm install
npm start
```

打开浏览器访问：
- http://localhost:3000

### 目录结构
```text
minesweeper-retro/
  server/
    index.js          # Express 静态服务（监听 process.env.PORT）
  public/
    index.html        # 游戏页面
    css/
      styles.css      # Win98/XP 复古 UI + 响应式 + 主题
    js/
      app.js          # 入口
      ui.js           # UI 渲染 + 交互 + 可访问性 + 计时器
      game.js         # 纯逻辑：布雷/展开/快速翻开/胜负判定
      sound.js        # WebAudio 音效
      storage.js      # localStorage 工具
  docs/
    testing.md        # 手动测试用例（>=10 条）
  package.json
  README.md
```

---

## 3) Render 部署步骤（开箱即用）

> 目标：部署为 **Render Web Service**（Node/Express 静态站点服务）。

### 3.1 把项目推送到 GitHub
1. 新建仓库（例如 `minesweeper-retro`）
2. 把本项目文件全部提交并推送：
   ```bash
   git init
   git add .
   git commit -m "init minesweeper"
   git branch -M main
   git remote add origin <你的仓库地址>
   git push -u origin main
   ```

### 3.2 在 Render 创建 Web Service（逐步）
1. 登录 Render，点击 **New +** → **Web Service**
2. 选择你的 GitHub 仓库并连接
3. 配置：
   - **Runtime**：Node
   - **Build Command**：`npm install`
   - **Start Command**：`npm start`
   - **Environment Variables**：可不填（Render 会自动提供 `PORT`）
4. 点击 **Create Web Service**  
   Render 会自动构建并部署，之后每次推送 main 分支都会自动部署。

### 3.3 Render 常见坑（重要）
- ✅ **必须监听 `process.env.PORT`**：本项目已在 `server/index.js` 完成（默认 3000）。
- 如果页面 404：
  - 确认 Render 的服务类型是 Web Service（不是 Static Site）
  - 确认 Start Command 运行成功（查看 Logs）

---

## 4) 游戏玩法教程（桌面端 + 手机端）

### 4.1 桌面端（鼠标 + 键盘）
- **翻开格子**：鼠标左键点击
- **插旗**：鼠标右键点击
- **快速翻开周围（Chord）**：对已翻开的数字格 **双击**  
  条件：周围旗子数量 = 数字；会自动翻开周围未翻开的格子
- **键盘操作**
  - 方向键：移动焦点（你会看到虚线焦点框）
  - 空格：翻开
  - F：插旗/取消旗
  - Enter：快速翻开（Chord）

**截图位点文字说明：**  
- 顶部面板左侧是“剩余雷数”红色数码管；右侧是“计时器”；中间是“笑脸按钮”。  
- 棋盘中未翻开的格子有立体边框；翻开后变成平面并显示数字。

### 4.2 手机端（触屏）
- 页面顶部会出现 **三段按钮**：
  - **翻开**：点格子翻开
  - **插旗**：点格子插旗/取消旗
  - **快速翻开**：点数字格尝试快速翻开周围
- 另外支持 **长按插旗**（无论当前模式，长按都更稳）  
  适用于避免误触导致直接翻开。

**截图位点文字说明：**  
- 在棋盘上方有一行“翻开 / 插旗 / 快速翻开”的切换按钮，下面一行灰色小字提示“长按插旗”。

---

## 5) 常见问题排查（FAQ）

### Q1：Render 上打不开，提示端口错误？
- Render 会注入 `PORT` 环境变量，服务必须 `listen(process.env.PORT)`。  
  ✅ 本项目已处理：`const PORT = process.env.PORT || 3000;`

### Q2：静态资源 404（CSS/JS 加载失败）？
- 确认 `server/index.js` 使用 `express.static(publicDir)`  
- 确认资源路径以 `/css/...` `/js/...` 开头（本项目已是绝对路径）

### Q3：手机端长按插旗不稳定？
- 长按阈值为 **420ms**，如果你系统长按手势过于敏感，可在 `public/js/ui.js` 搜索 `420` 调整。
- 如果浏览器把双击识别为缩放：已通过 CSS `touch-action: manipulation;` 降低这种情况，但不同浏览器仍可能有差异。

### Q4：计时器不走 / 音效没声音？
- iOS/部分浏览器需要用户手势触发音频：本项目会在首次交互时 `unlockAudio()`  
- 如果你在“减少动态效果”模式下，动画会被自动压缩，这是正常行为。

---

## 6) 关键测试用例（手动验证）

见：`/docs/testing.md`

---

## License
MIT

# 四语母语习得套件 · 全栈部署仓库

英语 / 马来语 / 中文 / 泰语 的「单词快速播放器 + 学习器 + 测试器」三件套，
配套**全栈后端**（账号、管理员、登录记录、英语学习工作台、数据隔离）。

- 前端三器：秒开（外壳 + 独立词库 data.js），支持 Web Speech 四语朗读。
- 后端：`Node 22` 内置 `http` + `node:sqlite`，**零外部依赖**，无需 `npm install`、无原生编译。
- 权限：`bi6099445`（普通用户）/ `bi6099446`（管理员，初始密码 `123456`）。

---

## 一、推到 GitHub（两步）

1. 在 GitHub 新建一个**空仓库**（不要勾选 README/.gitignore）。
2. 在本仓库目录执行（把 `你的用户名/仓库名` 换成你自己的）：

```bash
git init
git add .
git commit -m "init: 四语母语习得套件全栈"
git branch -M main
git remote add origin https://github.com/你的用户名/仓库名.git
git push -u origin main
```

> 仓库已含 `static/` 下的三器词库（约 76MB），这是**预期内**的，部署后三器才能直接出词。
> 若你不想把词库推上 GitHub，可 `git rm -r --cached static` 后改用本地 `STATIC_DIR` 指向词库目录（见文末"高级"）。

---

## 二、在 Render 一键部署（零构建）

1. 打开 https://render.com → 用 GitHub 登录。
2. **New → Web Service** → 选刚才推送的仓库。
3. 配置（基本都已自动填好，核对即可）：
   - **Runtime**：`Node`
   - **Build Command**：**留空**（不需要构建）
   - **Start Command**：`node --experimental-sqlite server.mjs`（⚠️ 必须带 `--experimental-sqlite`，否则 node:sqlite 无法加载会启动失败）
   - **Instance Type**：`Free`（免费）
4. 点 **Create Web Service**。
5. 等 1–2 分钟，状态变绿后，点生成的 `https://xxxx.onrender.com` 即可访问。

> `render.yaml` 已内置上述配置，Render 会自动识别。如需手动填，按上面即可。
> 免费版会在闲置后"休眠"，首次打开需等约 30 秒唤醒，属正常。

---

## 三、怎么用

- 打开网址 → 点卡片进「学习器 / 测试器 / 播放器」。
- 右上角「登录」：
  - `bi6099445 / 123456`：普通用户，可使用 + 设置。
  - `bi6099446 / 123456`：管理员，额外可见「📊 记录」面板（登录数/地区/时长，可手动隐藏）、可创建用户、改他人密码、查看/创建英语学习工作台；并可用「🧩 模块」（词根/词性/情景语句）与「🔁 转译」「🎨 主题」等扩展功能。
- 管理员登录后建议先改密码（登录状态下点「设置 → 修改密码」）。

---

## 四、本地运行（开发/自测）

```bash
cd tril-suite-server
node --experimental-sqlite server.mjs
# 浏览器打开 http://localhost:3000
```

环境变量（可选）：
- `PORT`：端口（默认 3000）
- `STATIC_DIR`：前端目录（默认 `./static`）
- `DB_PATH`：数据库文件路径（默认 `./app.db`，首次运行自动建表并写入种子账号）

---

## 五、目录结构

```
tril-suite-server/
├─ server.mjs            # 全栈后端（零依赖）
├─ package.json
├─ render.yaml           # Render 一键部署配置
├─ .gitignore
└─ static/               # 前端（由后端直接托管）
   ├─ index.html         # 落地页（三张卡片）
   ├─ auth-client.js     # 共享认证/权限/扩展模块客户端
   ├─ tril-translate.js  # 转译系统前端
   ├─ workbench.html     # 英语学习工作台
   ├─ 三语母语习得快速播放器.html / .data.js
   ├─ 三语母语习得学习器.html   / .data.js
   └─ 三语母语习得测试器.html   / .data.js
```

> 说明：登录记录的地区为「浏览器时区 / 语言」推断；跨设备真实 IP 地区需要 Reverse Proxy 传递 `X-Forwarded-For`（Render 已默认提供），后端已读取该头。

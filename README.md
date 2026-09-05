# 四语母语习得套件 · 全栈部署仓库

英语 / 马来语 / 中文 / 泰语 四语对照学习套件，含 **6 个学习应用 + 1 个看板首页**，
50000+ 词条、87% 含泰文朗读。配套全栈后端（账号、管理员、登录记录、词库隔离）。

- 前端：6 个独立 HTML（零打包、原生 ES），Web Speech 四语朗读 + PWA 可安装。
- 后端：`Node 22` 内置 `http` + `node:sqlite`，**零外部依赖**，无需 `npm install`、无原生编译。
- 部署：Render 一键 zero-config 部署。

---

## 一、套件应用清单（最新 6 件 + 看板）

| 入口 | 名称 | 主要功能 |
|---|---|---|
| 🏠 | [index.html](static/index.html) | **学习看板** — 今日待复习、学习时长、错题统计、6 个 ECharts 图表 |
| 🎧 | 学习器 | 按学段 / 词根浏览，逐条四语串讲 + 例句朗读 + CSV 导入导出 + 计时 |
| 📝 | 测试器 | 单元自测选择题，含听力辨义 + ⭐ 我的收藏 + 📕 错题本（CSV 导入导出） |
| 🔊 | 快速播放器 | 按单元逐词自动朗读，可调间隔/语速/音量/语种屏蔽 |
| ⚡ | 闪记 | 闪卡模式，正面考你一种语言，翻转揭晓其余语种 |
| 🔁 | 艾宾浩斯复习 | SRS 间隔重复：✗ 重置 1d · ? 模糊 ×1.2 · ✓ 1d→2d→4d→…→60d |
| 📕 | 错题专练 | 按「错得越多越靠前」排队，连对 10 自动毕业 |
| 🔁 | 复习（艾宾浩斯） | 跨应用 SRS 调度，今日到期自动入复习队列 |

## 二、看板数据指标（看板首页）

- **6 张统计卡**：今日待复习 · 本周到期 · 已掌握 L≥5 · 学习进度 · ⏱ 今日学习时长 · 📕 错题本
- **6 张图表**：7 日复习预测 · SRS 等级分布 · 30 日评分 · 单元完成度 · 🔥 弱项词条 TOP 10 · 🌐 各语言词条占比
- **1 张满宽热力图**：🕐 7 日 × 24 小时学习热力图

所有数据来自本机 localStorage（IndexedDB 镜像备份），不上传任何服务器。

---

## 三、推到 GitHub（首次）

1. 在 GitHub 新建**空仓库**（不要勾选 README/.gitignore）。
2. 在本仓库目录执行（把 `<你的用户名/仓库名>` 换成你自己的）：

```bash
git init     # 仓库已存在则跳过
git add .
git commit -m "init: 四语母语习得套件"
git branch -M main
git remote add origin https://github.com/<你的用户名>/<仓库名>.git
git push -u origin main
```

> `static/三语母语习得核心词库.part3.js` 约 16.5 MB，单文件略大；如需瘦身可运行 `python3 build_split_data.py` 重新分片。

---

## 四、在 Render 一键部署（零构建）

1. https://render.com → 用 GitHub 登录。
2. **New → Web Service** → 选刚才推送的仓库。
3. 配置：
   - **Runtime**：`Node`
   - **Build Command**：`echo "no build needed"`
   - **Start Command**：`node --experimental-sqlite server.mjs`（⚠️ 必须带 `--experimental-sqlite`）
   - **Instance Type**：`Free`
4. 点 **Create Web Service**。
5. 等 1–2 分钟变绿后，访问 `https://xxx.onrender.com`。

> `render.yaml` 已内置配置，Render 会自动识别。
> 免费版闲置后休眠，首次打开约 30 秒唤醒。

### 4.1 触发新版本构建

Render **不会**自动检测 push 重新部署（auto-deploy 可在控制台开启）。最稳的手动路径：

1. https://dashboard.render.com → 选 `tril-suite-server`
2. 右上 **Manual Deploy** → **Deploy latest commit**
3. 约 60-90 秒重新构建 + 重启，访问页验证新功能。

---

## 五、本地运行（开发 / 自测）

```bash
cd tril-suite-server
node --experimental-sqlite server.mjs
# 浏览器打开 http://localhost:3000
```

环境变量：
- `PORT`：端口（默认 3000）
- `STATIC_DIR`：前端目录（默认 `./static`）
- `DB_PATH`：数据库文件（默认 `./app.db`）

---

## 六、数据导入导出

每个 app 都支持：

| 格式 | 用途 | 入口 |
|---|---|---|
| **JSON** | 全量恢复复习进度 / 错题本 / 收藏 | 各 app 底部 ⤴ / ⤵ 按钮 |
| **TSV / CSV** | Excel / Numbers 直接打开 | 学习器 / 复习 / 错题 / 测试器 ⤓ TSV 按钮 |
| **自定义词库** | CSV 导入追加为新单元 | 学习器 ⤒ CSV |

TSV 列格式（Tab 分隔，13 列）：
```
en  bm  zh  th  en_ipa  bm_pron  zh_pinyin  th_pron  level  ex_en  ex_bm  ex_zh  ex_th
```

---

## 七、跨应用数据互联

| LS Key | 含义 | 写入方 | 读取方 |
|---|---|---|---|
| `tril_root_progress_v1` | 单元进度 | 学习器 | 看板、测试器 |
| `tril_marks_v1` | ⭐ 收藏 | 学习器、测试器、错题 | 复习、看板 |
| `tril_wrongbook_v1` | 错题本 | 测试器 | 复习、看板、错题专练 |
| `tril_review_v1` | SRS 复习状态 | 复习 | 看板 |
| `tril_study_sessions_v1` | 学习时长 | 学习器 | 看板、计时 |
| `tril_flash_mastery_v1` | 闪记评级 | 闪记 | 复习 |
| `tril_custom_units_v1` | 自定义词库 | 学习器 | 学习器 |

数据**全在本机**，不上传。换设备不会自动同步；用各 app 底部 ⤴/⤵ 按钮导出 JSON 手动迁移。

---

## 八、目录结构

```
tril-suite-server/
├─ server.mjs                # 全栈后端（零依赖）
├─ package.json
├─ render.yaml               # Render 一键部署配置
├─ build_merge_data.py       # 合并四语词库
├─ build_split_data.py       # 词库分片（part1..4.js）
└─ static/                   # 前端（由后端直接托管）
   ├─ index.html                          # 学习看板 + 6 个 app 入口
   ├─ 三语母语习得学习器.html              # 主学习器（CSV + 计时）
   ├─ 三语母语习得测试器.html              # 单元自测（收藏 + 错题）
   ├─ 三语母语习得快速播放器.html          # 单词自动朗读
   ├─ 三语母语习得闪记.html                # 闪卡
   ├─ 三语母语习得复习.html                # SRS 间隔重复
   ├─ 三语母语习得错题复习.html            # 错题专练（按错次排序）
   ├─ tril-core.js / tril-db.js           # 核心模块（词库加载、IDB 镜像）
   ├─ tril-migrate.js / tril-csv.js       # LS → IDB 镜像、CSV/TSV 工具
   ├─ tril-study.js / tril-lib.js         # 学习时长统计、自定义词库
   ├─ tril-ai.js / tril-tts.js            # AI 答疑、语音引擎
   ├─ tril-skin.css / tril-skin.js        # 皮肤切换
   ├─ auth-client.js                      # 登录门控
   ├─ sw.js                               # PWA Service Worker（v8）
   ├─ icon-*.png                          # PWA 图标
   └─ 三语母语习得核心词库.part{1..4}.js  # 词库分片（懒加载）
```

---

## 九、阶段路线图

| 阶段 | 内容 | 状态 |
|---|---|---|
| 0 | 基础设施（词库合并 / 分片 / IndexedDB / 皮肤 / WebP） | ✅ |
| 1 | 艾宾浩斯复习（SRS 算法 + 独立页） | ✅ |
| 2 | 辅助工具（错题专练 / CSV 导入导出 / 学习时长 / 看板扩展） | ✅ |
| 3 | 测试器 4 题型 × 7 难度 + SRS 强制入题 | 🔧 待开发 |
| 4 | 看板首页（学习时长 + 6 图 + 热力图） | ✅ |
| 5+6 | 国风 / 马来西亚皮肤细化 | 📋 |
| 7 | 收尾（验收 + 多端部署 + 文档） | 🚧 当前 |

---

## 十、版本与兼容性

- Node 22+（需要 `--experimental-sqlite` 启用内置 sqlite）
- 浏览器：Chrome 100+ / Safari 14+ / Edge 100+（需支持 Web Speech API、IndexedDB、ES2020）
- PWA：iOS Safari 16.4+ / Android Chrome 90+ 可「添加到主屏幕」全屏使用
- Web Speech 多语言嗓音：英文 `en-US` / 中文 `zh-CN` / 马来文 `ms-MY` / 泰文 `th-TH`（嗓音缺失时自动回退默认嗓音）

---

## 十一、常见问题

**Q：Render 上看不到新功能？**
A：先确认 `git push origin main` 已成功；然后 Render 控制台 → Manual Deploy → Deploy latest commit。`server.mjs` 不暴露任何触发 rebuild 的 endpoint，必须手动。

**Q：本地数据如何备份 / 迁移？**
A：每个 app 底部都有 ⤴ JSON 导出。CSV/TSV 是给 Excel 看的，单条修改后可用学习器 ⤒ CSV 重新导入。

**Q：词典 16.5 MB 的 part3 加载慢？**
A：词库采用按学段懒加载（`flat` 元数据只引用 `part` 编号）。首次进学习器自动按需 loadPart，未访问的词条不进内存。

**Q：登录和管理员有什么用？**
A：管理员（`bi6099446`）可看「📊 记录」面板、创建用户、改他人密码、查看 / 创建英语学习工作台。普通用户（`bi6099445`）可使用全部学习 app + 设置。登录门控不影响看板 / 6 个学习 app 的实际使用。

---

## 十二、致谢

> 站长：毕泽华
> 一句话总结：50000+ 四语词条 + 6 个学习 app + 学习看板，开箱即用。
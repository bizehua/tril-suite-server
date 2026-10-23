/* =========================================================================
 * stats-store.mjs —— 访问量持久化存储（跨部署不丢）
 * -------------------------------------------------------------------------
 * 问题背景：
 *   Render 免费实例的文件系统是「临时」的 —— 每次 git push 触发部署时，
 *   容器会被重建，容器内的 app.db 随之清空重建。原本把访问量记在
 *   SQLite 里的做法，一旦我维护（部署）就归零，统计不准。
 *
 * 解决方案：
 *   把「累计总数 + 每日计数」落到外部持久存储（GitHub 仓库的 stats.json），
 *   本地 SQLite 只作为高频写入的暂存区。
 *   - 读：启动时从远端拉取基准值(base)，叠加本地增量
 *   - 写：每次访问先写本地（快、可靠），再由后台定时/退出前触发写回远端
 *   - 远端不可用时自动降级为「仅本地」，页面照常显示，功能不受影响
 *
 * 关键设计：
 *   1. 基准值 base 只在首次初始化时写入远端，之后永不重置 → 维护不会清零
 *   2. 起始累计值由环境变量 VISIT_BASE 控制（默认 2000）
 *   3. 每日计数按 'YYYY-MM-DD'（站点本地时区）存 days 映射，随基准一起持久化
 *   4. 本地 synced 标记按天分键，避免跨零点时今日增量算错
 *   5. 远端存储用 GitHub Contents API（免费、私密仓库、长期有效）
 *
 * 环境变量：
 *   STATS_GIST_REPO    形如 owner/repo（默认 bizehua/site-stats）
 *   STATS_GIST_PATH    文件路径（默认 stats.json）
 *   STATS_GIST_TOKEN   GitHub PAT（需对该仓库有 Contents 读写权限）
 *   STATS_GIST_BRANCH  分支（默认 main）
 *   VISIT_BASE         起始累计值（默认 2000）
 *   STATS_FLUSH_MS     后台回写间隔（默认 15000ms）
 * ========================================================================= */

const GITHUB_API = 'https://api.github.com';

function env(k, d) {
  const v = process.env[k];
  return (v === undefined || v === '') ? d : v;
}

/* 配置改为惰性读取：模块可能在 env 设置之前被 import，
   若在 import 时就固化常量，运行期改 env 不会生效。 */
export const CONFIG = {
  get repo() { return env('STATS_GIST_REPO', 'bizehua/site-stats'); },
  get path() { return env('STATS_GIST_PATH', 'stats.json'); },
  get token() { return env('STATS_GIST_TOKEN', ''); },
  get branch() { return env('STATS_GIST_BRANCH', 'main'); },
  get base() { return parseInt(env('VISIT_BASE', '2000'), 10) || 2000; },
  get flushMs() { return parseInt(env('STATS_FLUSH_MS', '15000'), 10) || 15000; },
  get siteKey() { return env('STATS_SITE_KEY', 'default'); },
};

/* ---------- 远端读写 ---------- */

function ghHeaders() {
  const h = { 'Accept': 'application/vnd.github+json', 'User-Agent': 'workbuddy-stats' };
  if (CONFIG.token) h['Authorization'] = 'Bearer ' + CONFIG.token;
  return h;
}

async function ghFetch(method, url, body) {
  const opt = { method, headers: ghHeaders() };
  if (body !== undefined) {
    opt.headers['Content-Type'] = 'application/json';
    opt.body = JSON.stringify(body);
  }
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(url, { ...opt, signal: ctl.signal });
    const txt = await r.text();
    let json = null;
    try { json = txt ? JSON.parse(txt) : null; } catch { json = null; }
    if (!r.ok) {
      const msg = (json && json.message) || ('HTTP ' + r.status);
      throw new Error('GitHub API ' + method + ' → ' + msg);
    }
    return json;
  } finally {
    clearTimeout(timer);
  }
}

/** 读取远端 stats.json；不存在或未配置 token 返回 null */
export async function remoteRead() {
  if (!CONFIG.token) return null;
  const url = `${GITHUB_API}/repos/${CONFIG.repo}/contents/${encodeURIComponent(CONFIG.path)}?ref=${encodeURIComponent(CONFIG.branch)}`;
  const j = await ghFetch('GET', url);
  if (!j || !j.content) return null;
  const raw = Buffer.from(j.content.replace(/\n/g, ''), 'base64').toString('utf8');
  const data = JSON.parse(raw);
  return { data, sha: j.sha };
}

/** 写入远端 stats.json */
export async function remoteWrite(data, sha) {
  if (!CONFIG.token) throw new Error('未配置 STATS_GIST_TOKEN');
  const url = `${GITHUB_API}/repos/${CONFIG.repo}/contents/${encodeURIComponent(CONFIG.path)}`;
  const body = {
    message: `chore(stats): update ${CONFIG.siteKey} visit counters`,
    content: Buffer.from(JSON.stringify(data, null, 2), 'utf8').toString('base64'),
    branch: CONFIG.branch,
  };
  if (sha) body.sha = sha;
  const j = await ghFetch('PUT', url, body);
  return j && j.content ? j.content.sha : null;
}

/* ---------- 统计主体 ---------- */

/**
 * 创建统计器
 * @param {object} db        node:sqlite DatabaseSync
 * @param {object} opts      { siteKey } 本站在 stats.json 中的键
 */
export function createVisitStore(db, opts = {}) {
  const siteKey = opts.siteKey || CONFIG.siteKey;

  // 本地表：site_visits 存明细；visit_meta 存「已同步到远端的基准」
  // site_visits 表由主程序创建；这里做一次兜底创建，保证模块自包含
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS site_visits(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      visited_at TEXT DEFAULT (datetime('now'))
    );`);
  } catch (e) { /* 主程序已建好则忽略 */ }
  db.exec(`CREATE TABLE IF NOT EXISTS visit_meta(
  key TEXT PRIMARY KEY,
  value TEXT
);`);

  const metaGet = (k) => {
    const r = db.prepare('SELECT value FROM visit_meta WHERE key=?').get(k);
    return r ? r.value : null;
  };
  const metaSet = (k, v) => {
    db.prepare('INSERT INTO visit_meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(k, String(v));
  };

  // 远端全量文档（所有站共用一个文件）
  let doc = null;          // { [siteKey]: {total, days:{}, base} }
  let docSha = null;       // GitHub blob sha（乐观并发）
  let remoteOK = false;    // 远端是否可用
  let pendingWrites = 0;   // 尚未回写的本地增量条数
  let flushing = false;
  let timer = null;

  /** 站点本地日期 'YYYY-MM-DD'（东马 UTC+8；容器 TZ 若为 UTC 则按 +8 校正） */
  function todayKey() {
    const d = new Date();
    // 统一按 UTC+8 计算当天，与业务所在地一致
    const t = new Date(d.getTime() + (8 * 60 + d.getTimezoneOffset()) * 60000);
    const p = (n) => String(n).padStart(2, '0');
    return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())}`;
  }
  /** 与 todayKey 同口径的本地时间戳 'YYYY-MM-DD HH:MM:SS'（供 site_visits.visited_at 使用，保证 substr 判断一致） */
  function localStamp() {
    const d = new Date();
    const t = new Date(d.getTime() + (8 * 60 + d.getTimezoneOffset()) * 60000);
    const p = (n) => String(n).padStart(2, '0');
    return `${t.getFullYear()}-${p(t.getMonth() + 1)}-${p(t.getDate())} ${p(t.getHours())}:${p(t.getMinutes())}:${p(t.getSeconds())}`;
  }

  const localTotalRows = () => db.prepare('SELECT COUNT(*) c FROM site_visits').get().c;
  const localTodayRows = () => db.prepare(
    "SELECT COUNT(*) c FROM site_visits WHERE substr(visited_at,1,10)=?").get(todayKey()).c;

  /** 远端该站的基准数据 */
  function remoteBase() {
    const s = doc && doc[siteKey];
    if (!s) return null;
    const days = (s.days && typeof s.days === 'object') ? s.days : {};
    return { total: Number(s.total) || 0, days };
  }

  /** 确保远端已有该站的基准（仅首次初始化，之后不重置） */
  function ensureRemoteBase() {
    if (!doc) return;
    if (!doc[siteKey]) {
      doc[siteKey] = { total: CONFIG.base, days: {}, base: CONFIG.base };
      pendingWrites = Math.max(pendingWrites, 1);
      return;
    }
    if (doc[siteKey].base === undefined) {
      doc[siteKey].base = CONFIG.base;
      pendingWrites = Math.max(pendingWrites, 1);
    }
  }

  /** 计算「远端基准 + 本地未同步增量」 */
  function computeCounts() {
    const rb = remoteBase();
    const baseTotal = rb ? rb.total : CONFIG.base;
    const baseToday = rb ? (rb.days && rb.days[todayKey()]) || 0 : 0;

    const pendingTotal = Math.max(0, localTotalRows() - Number(metaGet('synced_total') || 0));
    const pendingToday = Math.max(0, localTodayRows() - Number(metaGet('synced_day:' + todayKey()) || 0));

    return {
      visitTotal: baseTotal + pendingTotal,
      visitToday: baseToday + pendingToday,
      pending: pendingTotal,
    };
  }

  /** 记录一次访问（同步、快速） */
  function record() {
    db.prepare('INSERT INTO site_visits(visited_at) VALUES(?)').run(localStamp());
    pendingWrites++;
    return computeCounts();
  }

  /** 把本地增量回写到远端（并记录已同步量） */
  async function flush() {
    if (flushing) return false;
    if (!remoteOK || !CONFIG.token) return false;
    flushing = true;
    try {
      const cur = await remoteRead();       // 重新读，避免覆盖他人写入
      if (cur && cur.data) { doc = cur.data; docSha = cur.sha; }
      ensureRemoteBase();

      const site = doc[siteKey] || (doc[siteKey] = { total: CONFIG.base, days: {}, base: CONFIG.base });
      site.days = site.days || {};

      const localTotal = localTotalRows();
      const deltaTotal = Math.max(0, localTotal - Number(metaGet('synced_total') || 0));
      const tk = todayKey();
      const localToday = localTodayRows();
      const deltaToday = Math.max(0, localToday - Number(metaGet('synced_day:' + tk) || 0));

      if (deltaTotal > 0) {
        site.total = (Number(site.total) || 0) + deltaTotal;
        metaSet('synced_total', localTotal);
      }
      if (deltaToday > 0) {
        site.days[tk] = (Number(site.days[tk]) || 0) + deltaToday;
        metaSet('synced_day:' + tk, localToday);
      }

      docSha = await remoteWrite(doc, docSha);
      pendingWrites = 0;
      return true;
    } catch (e) {
      // 远端失败：保留本地增量，下次再试；页面统计照常可用
      try { console.warn('[stats] 回写远端失败（已降级为本地统计）:', e.message); } catch {}
      remoteOK = false;
      return false;
    } finally {
      flushing = false;
    }
  }

  /** 启动：拉取远端基准 */
  async function init() {
    try {
      const cur = await remoteRead();
      if (cur && cur.data) {
        doc = cur.data; docSha = cur.sha; remoteOK = true;
        ensureRemoteBase();
      } else {
        remoteOK = !!CONFIG.token;
      }
    } catch (e) {
      try { console.warn('[stats] 远端不可用，使用本地统计:', e.message); } catch {}
      remoteOK = false;
    }
    // 定时回写
    if (timer) clearInterval(timer);
    timer = setInterval(() => { if (pendingWrites > 0) flush(); }, CONFIG.flushMs);
    if (timer.unref) timer.unref();
    return computeCounts();
  }

  /** 进程退出前尽量回写 */
  async function shutdown() {
    if (pendingWrites > 0) { try { await flush(); } catch {} }
    if (timer) clearInterval(timer);
  }

  return {
    init, record, flush, shutdown, computeCounts,
    get remoteOK() { return remoteOK; },
    get pending() { return pendingWrites; },
  };
}

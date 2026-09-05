/*!
 * tril-study.js —— 学习时长统计共享模块
 *
 * 用法：
 *   const study = window.trilStudy || new TrilStudy();  // 自动 init
 *   study.start();            // 开始计时
 *   study.pause();            // 暂停
 *   study.resume();           // 继续
 *   study.stop(meta);         // 结束并提交（meta = {stage, file, unit, ...}）
 *
 *   study.todayMinutes();     // 今日分钟数（不浮点误差）
 *   study.last7DayMinutes();  // [d0..d6] 当天往前 7 天分钟数
 *   study.heatmap7x24();      // 7×24 矩阵（行: 周一-周日 / 列: 0-23 时）
 *   study.recentSessions();   // 最近 N 次会话
 */
(function(){
  "use strict";

  const LS = "tril_study_sessions_v1";
  const MAX_KEEP = 5000;     // F3: 30 天+5000 条兜底（实际每条 30 字节，~150KB）
  const DAY = 86400000;
  const DAY_KEEP = 30;

  function load(){
    try{
      const v = JSON.parse(localStorage.getItem(LS) || "[]") || [];
      return Array.isArray(v) ? v : [];
    }catch(e){ return []; }
  }

  function save(arr){
    try{ localStorage.setItem(LS, JSON.stringify(arr)); }
    catch(e){
      // 兜底：写 IDB
      if(window.TrilDB){ TrilDB.set("studySessions", arr).catch(function(){}); }
    }
  }

  function prune(arr){
    // F3: 只保留 30 天内
    const cutoff = Date.now() - DAY_KEEP * DAY;
    const filtered = arr.filter(s => s.end >= cutoff);
    // 超额也裁掉最旧的
    if(filtered.length > MAX_KEEP){
      return filtered.slice(filtered.length - MAX_KEEP);
    }
    return filtered;
  }

  function pad2(n){ return String(n).padStart(2, "0"); }
  function dayKey(ts){
    const d = new Date(ts);
    return d.getFullYear() + "-" + pad2(d.getMonth()+1) + "-" + pad2(d.getDate());
  }
  function dateOfKey(k){
    const [y,m,d] = k.split("-").map(Number);
    return new Date(y, m-1, d).getTime();
  }

  function makeSession(){
    return {
      startedAt: Date.now(),
      ticks: 0,           // 累计打 tick 次数
      unit: "",
      stage: "",
      file: "",
      rating: 0,          // 学习过程中评级次数（评分时 +1）
      meta: {}
    };
  }

  let cur = null;        // 当前会话
  let tickTimer = null;
  let lastActive = 0;    // 上次 user-active 时间戳

  function bindActivity(){
    // 监听活动事件，每 5 秒打一个 tick
    ["mousemove","keydown","scroll","touchstart","click"].forEach(function(ev){
      window.addEventListener(ev, function(){ lastActive = Date.now(); }, {passive:true});
    });
  }
  bindActivity();

  function ensureTicking(){
    if(tickTimer) return;
    tickTimer = setInterval(function(){
      if(!cur) return;
      // 超过 30 分钟无活动，自动结束（避免离开页面挂起）
      if(Date.now() - lastActive > 30 * 60 * 1000){
        stop({idle: true});
        return;
      }
      cur.ticks += 1;     // 每 5s = 1 tick
    }, 5000);
  }

  function start(meta){
    meta = meta || {};
    if(cur && (Date.now() - cur.startedAt) < 2*1000) return cur;
    if(cur) stop({auto: true});     // 双重保险

    cur = makeSession();
    cur.meta = meta || {};
    if(meta.unit)  cur.unit = meta.unit;
    if(meta.stage) cur.stage = meta.stage;
    if(meta.file)  cur.file = meta.file;
    lastActive = Date.now();
    ensureTicking();
    return cur;
  }

  function stop(extra){
    if(!cur) return null;
    const now = Date.now();
    const session = Object.assign({}, cur, {end: now});
    session.duration_ms = Math.max(0, now - session.startedAt);
    session.duration_min = Math.round(session.duration_ms / 60000 * 10) / 10;     // 1 位小数
    session.duration_tick = session.ticks;     // 每 5s = 1 tick ≈ 实际秒数 /5
    if(extra) session.extra = extra;

    const arr = load();
    arr.push(session);
    save(prune(arr));
    cur = null;
    lastActive = 0;
    return session;
  }

  function rateOnce(){
    if(cur) cur.rating = (cur.rating || 0) + 1;
  }

  function getAll(){
    return load();
  }

  function todayMinutes(){
    const key = dayKey(Date.now());
    let total = 0;
    load().forEach(function(s){
      if(dayKey(s.end) === key){
        total += (s.duration_ms || 0);
      }
    });
    return Math.round(total / 60000 * 10) / 10;
  }

  function last7DayMinutes(){
    const out = [];
    const now = new Date();
    for(let i = 6; i >= 0; i--){
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = d.getFullYear() + "-" + pad2(d.getMonth()+1) + "-" + pad2(d.getDate());
      let total = 0;
      load().forEach(function(s){
        if(dayKey(s.end) === key){
          total += (s.duration_ms || 0);
        }
      });
      out.push(Math.round(total / 60000 * 10) / 10);
    }
    return out;
  }

  // 7 天 × 24 小时热力图（最后 7 天）
  function heatmap7x24(){
    const cells = [];
    for(let i = 0; i < 7; i++){
      const row = [];
      for(let h = 0; h < 24; h++) row.push(0);
      cells.push(row);
    }
    const now = new Date();
    const today0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const arr = load();
    arr.forEach(function(s){
      const d = new Date(s.end);
      const dayOffset = Math.floor((today0 - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / DAY);
      if(dayOffset < 0 || dayOffset >= 7) return;
      const row = 6 - dayOffset;       // 越早越上（[0]=6 天前，[6]=今天）
      const hour = d.getHours();
      cells[row][hour] += 1;
    });
    return cells;
  }

  // 找出今天已学的所有 session 条数
  function todaySessionCount(){
    const key = dayKey(Date.now());
    return load().filter(function(s){ return dayKey(s.end) === key; }).length;
  }

  // 最近 N 条
  function recentSessions(n){
    n = n || 10;
    return load().slice(-n).reverse();
  }

  // 暴露
  window.trilStudy = {
    start: start,
    stop: stop,
    rateOnce: rateOnce,
    todayMinutes: todayMinutes,
    last7DayMinutes: last7DayMinutes,
    heatmap7x24: heatmap7x24,
    todaySessionCount: todaySessionCount,
    recentSessions: recentSessions,
    getAll: getAll,
    LS: LS
  };
})();

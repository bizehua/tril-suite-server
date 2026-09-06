"use strict";

/* ============ 常量与语言定义 ============ */
const LANGS=[
  {k:"en",label:"英文",short:"EN",cls:"l-en",color:"#5b8cff"},
  {k:"bm",label:"马来文",short:"BM",cls:"l-bm",color:"#ffb454"},
  {k:"zh",label:"中文",short:"ZH",cls:"l-zh",color:"#4fd1a5"},
  {k:"th",label:"泰文",short:"TH",cls:"l-th",color:"#c792ea"}
];
const DAY = 86400000;
const LS_REVIEW = "tril_review_v1";
const LS_REVIEW_META = "tril_review_meta_v1";   // 首次发现时间 / 来源等
const LS_FLASHCARD_MASTERY = "tril_flash_mastery_v1";
const LS_FLASHCARD_DONE = "tril_flash_done_v1";
const LS_WRONG = "tril_wrongbook_v1";
const LS_MARKS = "tril_marks_v1";

/* SRS 间隔表（level → 间隔天数） */
const INTERVAL_TABLE = [1, 2, 4, 8, 16, 32, 60];   // level 0..6
const MAX_LEVEL = 6;

const DATA = window.__TRIL_DATA__;
if(window.TrilLib) TrilLib.mergeStages(DATA);

/* ============ 持久化加载 ============ */
let srs = {};          // {key: {level, last_interval, last_review, next_review, forgotten, reviews_total, src}}
let reviewMeta = {};
try{ srs = JSON.parse(localStorage.getItem(LS_REVIEW) || "{}") || {}; }catch(e){ srs = {}; }
try{ reviewMeta = JSON.parse(localStorage.getItem(LS_REVIEW_META) || "{}") || {}; }catch(e){ reviewMeta = {}; }
function saveSRS(){ try{ localStorage.setItem(LS_REVIEW, JSON.stringify(srs)); }catch(e){} }
function saveReviewMeta(){ try{ localStorage.setItem(LS_REVIEW_META, JSON.stringify(reviewMeta)); }catch(e){} }

function mkKey(e){
  return (e.en || "") + "|" + (e.bm || "") + "|" + (e.zh || "") + "|" + (e.th || "");
}

function toast(msg){
  const t = document.createElement("div");
  t.textContent = msg;
  t.style.cssText = "position:fixed;top:18px;left:50%;transform:translateX(-50%);background:var(--panel);border:1px solid var(--line);color:var(--txt);padding:8px 14px;border-radius:8px;z-index:99998;font-size:13px;box-shadow:0 6px 18px rgba(0,0,0,.4)";
  document.body.appendChild(t);
  setTimeout(()=>t.remove(), 1700);
}

function goHome(){
  if(document.referrer && /tril-suite-server|index\.html/i.test(document.referrer)){ history.back(); return; }
  location.href = "index.html";
}

/* ============ 入口聚合：从闪记/测试器/学习器收集所有复习候选 ============ */
let candidates = [];   // [{key, entry, src}] — 每个唯一词条

(function harvestFromData(){
  // 直接走全部词库，所有学段合一遍
  const seen = new Set();
  DATA.stages.forEach((st, si) => {
    st.files.forEach((f, fi) => {
      f.units.forEach((u, ui) => {
        const ents = u.entries || [];
        ents.forEach((e, ei) => {
          if(!e) return;
          const k = mkKey(e);
          if(!k || k === "|||") return;     // 空词条略过
          if(seen.has(k)) return;
          seen.add(k);
          candidates.push({key: k, entry: e, src: {si, fi, ui, ei, unit: u.title, stage: st.name}});
        });
      });
    });
  });
})();

function harvestFromApps(){
  // 闪记 mastery uid#key → 推回词条 entry（在同一份 DATA 里查）
  function findEntryByKey(key){
    return candidates.find(c => c.key === key);
  }
  // 闪记 mastery: {uid#key: "yes"|"no"|"fuzzy"}
  let masterMap = {};
  try{ masterMap = JSON.parse(localStorage.getItem(LS_FLASHCARD_MASTERY) || "{}") || {}; }catch(e){}
  Object.keys(masterMap).forEach(composite => {
    const hashAt = composite.lastIndexOf("#");
    if(hashAt < 0) return;
    const key = composite.slice(hashAt + 1);
    const master = masterMap[composite];
    const c = findEntryByKey(key);
    if(!c) return;
    c.flashMaster = master;     // "yes" | "no" | "fuzzy"
  });

  // 测试器错题本
  let wrong = {};
  try{ wrong = JSON.parse(localStorage.getItem(LS_WRONG) || "{}") || {}; }catch(e){}
  Object.keys(wrong).forEach(key => {
    const c = findEntryByKey(key);
    if(!c) return;
    c.wrong = wrong[key].wrong || 0;
    c.wrongStreak = wrong[key].streak || 0;
  });

  // 学习器 ★ 收藏
  let marks = {};
  try{ marks = JSON.parse(localStorage.getItem(LS_MARKS) || "{}") || {}; }catch(e){}
  Object.keys(marks).forEach(key => {
    const c = findEntryByKey(key);
    if(!c) return;
    c.marked = true;
  });
}

harvestFromApps();

/* 把所有「有活动」的 entry 拉进 srs；已掌握的（level>=5 且 last_review<30d 前）保留；
   已删/未活动的 key 不主动删，留着不显示即可。 */
function ensureSrsState(key, seed){
  if(srs[key]) return srs[key];
  const now = Date.now();
  // 新建：level 0，1 天后到期
  const baseInterval = (seed && seed.interval) || 1;
  srs[key] = {
    level: (seed && typeof seed.level === "number") ? seed.level : 0,
    last_interval: baseInterval,
    last_review: now,
    next_review: now + baseInterval * DAY,
    forgotten: (seed && seed.forgotten) || 0,
    reviews_total: 0,
    src: (seed && seed.src) || "manual"
  };
  return srs[key];
}

/* ============ 核心算法：B1-2 模糊 ×1.2 ============ */
function calcNext(state, rating){
  const now = Date.now();
  let level = state.level || 0;
  let interval = state.last_interval || 1;
  let forgotten = state.forgotten || 0;
  let reviews_total = state.reviews_total || 0;

  if(rating === "unknown"){
    level = 0;
    interval = 1;
    forgotten += 1;
    reviews_total += 1;
  } else if(rating === "fuzzy"){
    // B1-2: 模糊 = 间隔 ×1.2 (level 不升级,仅延长节奏)；保底 2d 避免 1d 起步粘死
    interval = Math.max(2, Math.round(interval * 1.2));
    reviews_total += 1;
  } else { // "know"
    level = Math.min(MAX_LEVEL, level + 1);
    interval = INTERVAL_TABLE[level];
    reviews_total += 1;
  }

  state.level = level;
  state.last_interval = interval;
  state.last_review = now;
  state.next_review = now + interval * DAY;
  state.forgotten = forgotten;
  state.reviews_total = reviews_total;
  state.last_rating = rating;
  return state;
}

function levelToColor(level){
  if(level <= 0) return "#ff6b6b";
  if(level === 1) return "#ff9a3c";
  if(level === 2) return "#ffd166";
  if(level === 3) return "#a3d977";
  if(level === 4) return "#4fd1a5";
  if(level === 5) return "#3da9c4";
  return "#5b8cff";
}

/* ============ TTS（同闪记） ============ */
let voices = [];
function loadVoices(){ voices = window.speechSynthesis ? speechSynthesis.getVoices() : []; }
if(window.speechSynthesis){ loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
function speak(text, lang, onend){
  if(!text){ if(onend) onend(); return; }
  if(!window.speechSynthesis){ return; }
  const u = new SpeechSynthesisUtterance(text);
  u.lang = lang==="en"?"en-US":lang==="bm"?"ms-MY":lang==="zh"?"zh-CN":"th-TH";
  u.rate = 1; u.volume = 1;
  u.onend = () => { if(onend) onend(); };
  u.onerror = () => { if(onend) onend(); };
  try{ speechSynthesis.resume(); }catch(e){}
  speechSynthesis.speak(u);
}

/* ============ 队列管理 ============ */
let filterMode = "due";   // "due" | "all" | "fuzzy" | "wrong" | "marked" | "unit"
let unitFilter = null;    // {si, fi, ui} — fi/ui 为 null 表示整个文件 / 整个学段
let queue = [];
let pos = -1;
let flipped = false;

function buildQueue(){
  // 入口：把 candidates → srs（仅在「due/all」模式下才纳入，其余过滤模式下用现有 srs）
  // 简化策略：
  // - 「due」：srs 里 next_review ≤ now 的；以及「首次发现」的需要学习者主动加进来的（新学过的单元、错题本、★ 收藏）
  // - 「fuzzy/wrong/marked」：从 candidates 筛，再触发 ensureSrsState（不影响现存 high-level 已掌握词）
  // - 「unit」：按学段/文件/单元筛选 candidates
  const now = Date.now();
  const out = [];

  if(filterMode === "unit" && unitFilter){
    const f = unitFilter;
    candidates.forEach(c => {
      const s = c.src;
      if(s.si !== f.si) return;
      if(f.fi != null && s.fi !== f.fi) return;
      if(f.ui != null && s.ui !== f.ui) return;
      out.push(c);
    });
    return out;
  }

  if(filterMode === "due"){
    Object.keys(srs).forEach(k => {
      const st = srs[k];
      if(st.next_review <= now){
        const c = findEntryByKey(k);
        if(c) out.push(c);
      }
    });
    return out;
  }

  if(filterMode === "all"){
    return candidates.slice();
  }

  // 其余：直接从 candidates 筛（首次也会拉进来）
  if(filterMode === "fuzzy"){
    candidates.forEach(c => {
      if(c.flashMaster === "fuzzy") out.push(c);
      else if(c.wrong && c.wrongStreak === 0) out.push(c);    // 测试器刚答错又答对一次算模糊
    });
  } else if(filterMode === "wrong"){
    candidates.forEach(c => { if(c.wrong && c.wrong > 0) out.push(c); });
  } else if(filterMode === "marked"){
    candidates.forEach(c => { if(c.marked) out.push(c); });
  }
  return out;
}

function buildQueueAndRender(){
  queue = buildQueue();
  // 去重 + 按 next_review 升序
  const seen = new Set();
  queue = queue.filter(c => {
    if(!c || !c.entry || !c.entry.en) return false;
    if(seen.has(c.key)) return false;
    seen.add(c.key);
    return true;
  });
  queue.sort((a, b) => {
    const na = (srs[a.key] && srs[a.key].next_review) || 0;
    const nb = (srs[b.key] && srs[b.key].next_review) || 0;
    return na - nb;
  });
  pos = -1;
  renderCard();   // 先渲染卡片/空态/总结（会重写 main.innerHTML）
  render();       // 再挂过滤器条到 main 顶部（insertBefore firstChild，不被清掉）
}

/* ============ UI 渲染 ============ */
function escapeHtml(s){ return (s||"").replace(/[&<>]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;"}[c])); }

function renderEmpty(){
  const main = document.getElementById("main");
  main.innerHTML = '<div class="empty">' +
    '<h2>📭 当前没有需要复习的词条</h2>' +
    '<p>到期队列为空。可以：</p>' +
    '<div class="hint">' +
    '<p>① <b>从学习器学几个单元</b> → 在闪记里给词条打分，下次到期会自动入复习队列。</p>' +
    '<p>② <b>在测试器答错的词</b> → 自动加入错题本，过 1 天后到期。</p>' +
    '<p>③ <b>★ 收藏你想重点巩固的词</b> → 在学习器表格里点星标，再切到「★ 收藏」即可开始复习。</p>' +
    '<p>④ <b>手动添加</b> → 切换右上角过滤器到「全部词条」开始轮转。</p>' +
    '</div>' +
    '</div>';
  document.getElementById("progFill").style.width = "0%";
  document.getElementById("footChip").textContent = "无任务";
}

function renderCard(){
  const main = document.getElementById("main");
  if(queue.length === 0){ renderEmpty(); return; }
  if(pos >= queue.length){
    renderSummary();
    return;
  }
  if(pos < 0) pos = 0;

  const c = queue[pos];
  const e = c.entry;
  const st = srs[c.key] || ensureSrsState(c.key, {});
  const lvlColor = levelToColor(st.level);

  let levelsHtml = '';
  for(let i = 0; i <= MAX_LEVEL; i++){
    levelsHtml += '<span class="dot ' + (i <= st.level ? 'l'+i : 'l'+i) + '" style="opacity:' + (i <= st.level ? 1 : 0.18) + '"></span>';
  }

  let metaBadges = '';
  if(c.flashMaster) metaBadges += '<span class="chip">' + (c.flashMaster === "yes" ? "✓ 已掌握" : c.flashMaster === "fuzzy" ? "? 模糊" : "✗ 不认识") + '</span>';
  if(c.wrong) metaBadges += '<span class="chip" style="color:#ffc9c9">错 ' + c.wrong + '</span>';
  if(c.marked) metaBadges += '<span class="chip" style="color:#ffd166">★ 收藏</span>';

  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML =
    '<div class="corner">' +
      '<span class="chip" style="border-color:' + lvlColor + '">' +
        '<span class="dot" style="background:' + lvlColor + '"></span>' +
        ' L' + st.level + '/' + MAX_LEVEL +
      '</span>' +
    '</div>' +
    '<div class="meta">' +
      '<span class="chip">' + escapeHtml(c.src.stage + ' · ' + c.src.unit) + '</span>' +
      metaBadges +
      '<span class="spacer" style="flex:1"></span>' +
      '<span class="chip">第 ' + (pos+1) + '/' + queue.length + ' 张</span>' +
    '</div>' +
    '<div class="front-en">' + escapeHtml(e.en || "") + ' <button class="ghost" style="padding:4px 8px;min-height:28px;font-size:14px;vertical-align:middle" onclick="event.stopPropagation();speak(\'' + (e.en||"").replace(/'/g, "\\'") + '\',\'en\')">🔊</button></div>' +
    '<div class="front-ipa">' + escapeHtml(e.en_ipa || "") + '</div>' +
    '<div class="levels" style="display:flex;gap:4px;justify-content:center;margin-top:4px">' + levelsHtml + '</div>' +
    '<div class="back ' + (flipped ? '' : 'hidden') + '">' +
      rowHtml("马来", e.bm, e.bm_pron || e.bm_ipa, "bm") +
      rowHtml("中文", e.zh, "", "zh") +
      rowHtml("泰文", e.th, e.th_pron, "th") +
      (e.example_zh || e.example_en ? '<div class="row" style="margin-top:4px"><span class="lbl">例句</span><div class="val" style="font-weight:400;font-size:14px">' + escapeHtml(e.example_en || "") + (e.example_zh ? '<br><span style="color:var(--muted);font-size:13px">' + escapeHtml(e.example_zh) + '</span>' : '') + '</div></div>' : '') +
    '</div>' +
    '<div class="rate ' + (flipped ? '' : 'hidden') + '">' +
      '<button class="r-no" onclick="event.stopPropagation();rate(\'unknown\')">✗ 不认识</button>' +
      '<button class="r-fz" onclick="event.stopPropagation();rate(\'fuzzy\')">? 模糊 ×1.2</button>' +
      '<button class="r-ok" onclick="event.stopPropagation();rate(\'know\')">✓ 认识</button>' +
      '<button class="skip ghost" onclick="event.stopPropagation();skip()" title="本轮跳过，不改 SRS">⏭ 跳过</button>' +
    '</div>';

  card.onclick = (ev) => {
    // 点击空白处翻面（按钮有自己的 stopPropagation）
    if(!flipped){ flipped = true; renderCard(); }
  };

  main.innerHTML = '';
  main.appendChild(card);

  // 自动朗读英文
  setTimeout(()=>{ try{ speak(e.en, 'en'); }catch(_){} }, 80);

  // 更新底部进度
  const pct = queue.length ? Math.round((pos) / queue.length * 100) : 0;
  document.getElementById("progFill").style.width = pct + "%";
  document.getElementById("footChip").textContent = (pos+1) + " / " + queue.length + " · 待评 " + (queue.length - pos);
}

function rowHtml(label, val, phonetic, lang){
  if(!val) return '';
  var valEsc = escapeHtml(val);
  var valPron = phonetic ? '<span class="py">' + escapeHtml(phonetic) + '</span>' : '';
  var py = (lang === "zh" && window.TrilPinyin) ? TrilPinyin.html(val) : '';
  var safeVal = String(val).replace(/'/g, "\\'");
  var btn = '<button class="ghost row-spk" onclick="event.stopPropagation();speak(\'' + safeVal + '\',\'' + (lang||"en") + '\')" title="朗读 ' + label + '">🔊</button>';
  return '<div class="row"><span class="lbl">' + label + '</span><div class="val">' + valEsc + ' ' + valPron + py + btn + '</div></div>';
}

function renderSummary(){
  const main = document.getElementById("main");
  let total = 0, known = 0, fuzzy = 0, unknown = 0;
  Object.keys(srs).forEach(k => {
    const r = srs[k];
    total++;
    if(r.last_rating === "know") known++;
    else if(r.last_rating === "fuzzy") fuzzy++;
    else if(r.last_rating === "unknown") unknown++;
  });
  main.innerHTML = '<div class="empty">' +
    '<h2>🎉 本轮复习完成</h2>' +
    '<p>本次评级分布：<b style="color:var(--ok)">✓ ' + known + '</b> · <b style="color:var(--warn)">? ' + fuzzy + '</b> · <b style="color:var(--bad)">✗ ' + unknown + '</b></p>' +
    '<p style="margin-top:14px">下次到期时间已按 模糊 ×1.2 重新排好，明天见 👋</p>' +
    '<div class="hint">' +
    '<p>SRS 库共 <b>' + total + '</b> 条词条；到期日 < 1 天的有 <b>' + Object.values(srs).filter(s => s.next_review < Date.now() + DAY).length + '</b> 条。</p>' +
    '<p>点 ⟲ <b>再来一轮</b> 继续复习错过的；切到「★ 收藏」或「错题本」补充其他类型。</p>' +
    '</div>' +
    '<div style="margin-top:18px">' +
    '<button class="primary" onclick="buildQueueAndRender()" style="margin-right:8px">⟲ 再来一轮</button>' +
    '<button onclick="filterMode=\'due\';render();buildQueueAndRender()">📅 仅今天到期</button>' +
    '</div>' +
    '</div>';
  document.getElementById("progFill").style.width = "100%";
  document.getElementById("footChip").textContent = "完成 ✓";
}

function updateHeaderStats(){
  const now = Date.now();
  const due = Object.values(srs).filter(s => s.next_review <= now).length;
  const week = Object.values(srs).filter(s => s.next_review <= now + 7*DAY).length;
  const mastered = Object.values(srs).filter(s => s.level >= 5).length;
  const total = Object.keys(srs).length;
  document.getElementById("queueChip").innerHTML = '<strong>' + due + '</strong> 到期 / ' + week + ' 周内 / ' + mastered + ' 掌握 / ' + total + ' 总';
}

function renderFilters(){
  let bar = document.querySelector(".filters");
  if(!bar){
    const main = document.getElementById("main");
    bar = document.createElement("div");
    bar.className = "filters";
    main.insertBefore(bar, main.firstChild);
  }
  bar.innerHTML = '<span class="lbl">过滤：</span>';
  const opts = [
    {k:"due", t:"📅 今日到期"},
    {k:"all", t:"🌐 全部词条"},
    {k:"fuzzy", t:"? 模糊"},
    {k:"wrong", t:"📕 错题本"},
    {k:"marked", t:"★ 收藏"},
    {k:"unit", t:"📚 按单元"}
  ];
  opts.forEach(o => {
    const b = document.createElement("button");
    b.textContent = o.t;
    if(o.k === filterMode) b.classList.add("active");
    if(o.k === "unit"){
      b.onclick = () => { openUnitPicker(); };
    } else {
      b.onclick = () => { filterMode = o.k; buildQueueAndRender(); };
    }
    bar.appendChild(b);
  });
  // 当前单元选择提示（带 ✕ 清除）
  if(filterMode === "unit" && unitFilter){
    const stage = DATA.stages[unitFilter.si];
    const file = (stage && stage.files[unitFilter.fi]) || null;
    const unit = (file && file.units[unitFilter.ui]) || null;
    const name = stage ? (stage.name + (file ? " › " + file.name : "") + (unit ? " › " + unit.title : "")) : "";
    const tip = document.createElement("span");
    tip.className = "chip";
    tip.style.cssText = "max-width:420px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
    tip.innerHTML = '📚 ' + escapeHtml(name) + ' <button class="ghost" style="min-height:22px;padding:2px 7px;font-size:11px;margin-left:4px" onclick="clearUnitFilter()" title="取消单元过滤">✕</button>';
    bar.appendChild(tip);
  }
}

/* ============ 📚 按单元选择复习范围 ============ */
function unitWordCount(st){
  let n = 0;
  (st.files||[]).forEach(f => (f.units||[]).forEach(u => { n += (u.entries||[]).length; }));
  return n;
}
function openUnitPicker(){
  let ov = document.getElementById("unitPicker");
  if(ov) ov.remove();
  ov = document.createElement("div");
  ov.id = "unitPicker";
  ov.style.cssText = "position:fixed;inset:0;z-index:99990;background:rgba(0,0,0,.55);display:flex;align-items:center;justify-content:center;padding:16px";
  ov.onclick = (ev) => { if(ev.target === ov) closeUnitPicker(); };

  const box = document.createElement("div");
  box.style.cssText = "background:var(--bg2);border:1px solid var(--line);border-radius:14px;max-width:600px;width:100%;max-height:80vh;overflow:auto;padding:16px;box-shadow:0 18px 50px rgba(0,0,0,.5)";

  let h = '<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;position:sticky;top:-16px;background:var(--bg2);padding:6px 0;z-index:2">' +
    '<b style="font-size:15px">📚 选择复习范围</b>' +
    '<span style="flex:1"></span>' +
    '<button class="ghost" onclick="closeUnitPicker()" style="min-height:34px">✕ 关闭</button></div>' +
    '<div style="font-size:12px;color:var(--muted);margin-bottom:10px">点 ▸ 展开学段 → 文件 → 单元；点「复习」按钮开始该范围内全部词条的复习。</div>';

  DATA.stages.forEach((st, si) => {
    const cnt = unitWordCount(st);
    h += '<details style="margin-bottom:8px">' +
      '<summary style="cursor:pointer;padding:9px 12px;background:var(--panel);border:1px solid var(--line);border-radius:9px;font-size:13px;display:flex;align-items:center;gap:6px;list-style:none">' +
      '<span style="flex:1">' + escapeHtml(st.name) + ' <span style="color:var(--muted);font-size:11px">' + cnt + ' 词</span></span>' +
      '<button class="primary" style="min-height:30px;padding:4px 12px;font-size:12px" onclick="event.preventDefault();event.stopPropagation();pickUnit(' + si + ',null,null)">复习整个学段</button>' +
      '</summary>';
    (st.files||[]).forEach((f, fi) => {
      let fcnt = 0;
      (f.units||[]).forEach(u => { fcnt += (u.entries||[]).length; });
      h += '<details style="margin:6px 0 6px 12px">' +
        '<summary style="cursor:pointer;padding:8px 10px;background:var(--panel2);border:1px solid var(--line);border-radius:8px;font-size:12px;display:flex;align-items:center;gap:6px;list-style:none">' +
        '<span style="flex:1">' + escapeHtml(f.name) + ' <span style="color:var(--muted);font-size:11px">' + fcnt + ' 词</span></span>' +
        '<button style="min-height:28px;padding:3px 10px;font-size:12px" onclick="event.preventDefault();event.stopPropagation();pickUnit(' + si + ',' + fi + ',null)">复习整个文件</button>' +
        '</summary>';
      (f.units||[]).forEach((u, ui) => {
        const n = (u.entries||[]).length;
        h += '<div style="display:flex;align-items:center;gap:8px;padding:6px 8px 6px 24px">' +
          '<span style="flex:1;font-size:12.5px">' + escapeHtml(u.title || ("Unit " + (ui+1))) + ' <span style="color:var(--muted);font-size:11px">' + n + ' 词</span></span>' +
          '<button style="min-height:28px;padding:3px 12px;font-size:12px" onclick="pickUnit(' + si + ',' + fi + ',' + ui + ')">复习</button>' +
          '</div>';
      });
      h += '</details>';
    });
    h += '</details>';
  });

  box.innerHTML = h;
  ov.appendChild(box);
  document.body.appendChild(ov);
}
function closeUnitPicker(){
  const ov = document.getElementById("unitPicker");
  if(ov) ov.remove();
}
function pickUnit(si, fi, ui){
  unitFilter = {si, fi, ui};
  filterMode = "unit";
  closeUnitPicker();
  buildQueueAndRender();
  const st = DATA.stages[si];
  toast("📚 已选择：" + (st ? st.name : "") + (fi != null ? " › " + (st.files[fi] ? st.files[fi].name : "") : "") + (ui != null ? " › " + (st.files[fi].units[ui] ? st.files[fi].units[ui].title : "") : ""));
}
function clearUnitFilter(){
  unitFilter = null;
  filterMode = "due";
  buildQueueAndRender();
}

function rate(rating){
  if(pos < 0 || pos >= queue.length) return;
  const c = queue[pos];
  const st = ensureSrsState(c.key, {});
  const before = st.level;
  calcNext(st, rating);
  saveSRS();
  // 闪记 mastery 同步（保证跨应用一致）
  try{
    const mast = JSON.parse(localStorage.getItem(LS_FLASHCARD_MASTERY) || "{}") || {};
    // 没有 uid 信息的话用 src.unit 拼一个虚拟 uid
    const uid = (c.src.si||0) + "_" + (c.src.fi||0) + "_" + (c.src.ui||0);
    mast[uid + "#" + c.key] = rating === "know" ? "yes" : rating === "fuzzy" ? "fuzzy" : "no";
    localStorage.setItem(LS_FLASHCARD_MASTERY, JSON.stringify(mast));
  }catch(e){}
  flipped = false;
  pos++;
  renderCard();
  updateHeaderStats();
}

function skip(){
  flipped = false;
  pos++;
  renderCard();
}

function render(){
  updateHeaderStats();
  renderFilters();
}

function exportSRS(){
  const data = {v:1, exported_at:new Date().toISOString(), srs, meta: reviewMeta};
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "tril_review_" + new Date().toISOString().slice(0,10) + ".json";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url), 1000);
  toast("已导出 SRS 进度");
}
function exportSRS_TSV(){
  // 把当前队列（candidates）的全四语条目导出成 TSV，方便 Excel 复习
  if(!window.trilCSV){ toast("CSV 模块未加载"); return; }
  const rows = candidates.map(c => c.entry).filter(e => e && (e.en||e.bm||e.zh||e.th));
  const x = trilCSV.exportEntries(rows, "tril_review_words_" + new Date().toISOString().slice(0,10) + ".tsv");
  toast("已导出 " + x + " 条 → TSV");
}
function importSRS(ev){
  const f = ev.target.files[0];
  if(!f) return;
  const r = new FileReader();
  r.onload = () => {
    try{
      const data = JSON.parse(r.result);
      if(!data || !data.srs) throw new Error("invalid");
      srs = data.srs;
      reviewMeta = data.meta || {};
      saveSRS(); saveReviewMeta();
      buildQueueAndRender();
      toast("已导入 " + Object.keys(srs).length + " 条");
    }catch(e){ toast("导入失败：" + e.message); }
  };
  r.readAsText(f);
  ev.target.value = "";
}

/* ============ 启动 ============ */
/* 本脚本是词库加载完后动态注入的，window load 可能已触发 — 双保险初始化 */
function bootReview(){
  setTimeout(function(){
    const s = document.getElementById("trilSpinner");
    if(s) s.remove();
  }, 300);
  buildQueueAndRender();
}
if(document.readyState === "complete" || document.readyState === "interactive"){
  bootReview();
} else {
  window.addEventListener("load", bootReview);
}

window.addEventListener("beforeunload", function(){
  try{ saveSRS(); saveReviewMeta(); }catch(e){}
});

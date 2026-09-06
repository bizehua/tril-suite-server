const DATA = window.__TRIL_DATA__;
const LS_KEY = "tril_quiz_progress_v1";
const LS_SET = "tril_quiz_settings_v1";

/* 单元扁平化 + 归一化三语三元组 */
let flat = [];
if(window.TrilLib) TrilLib.mergeStages(DATA);
DATA.stages.forEach((st,si)=>st.files.forEach((f,fi)=>f.units.forEach((u,ui)=>{
  flat.push({stage:st.name,file:f.name,si,fi,ui,title:u.title,type:u.type||"table",
    langs:u.langs||["en","zh","bm"],entries:u.entries||[]});
})));
const uid = u => u.si+"_"+u.fi+"_"+u.ui;

/* ===== 收藏（来自学习器标记）与错题本（本测试器记录） ===== */
const LS_MARK = "tril_marks_v1";
const LS_WRONG = "tril_wrongbook_v1";
function loadJSON(k){ try{ return JSON.parse(localStorage.getItem(k)||"{}")||{}; }catch(e){ return {}; } }
let marks = loadJSON(LS_MARK);       /* {key: 归一化词条} */
let wrongbook = loadJSON(LS_WRONG);  /* {key: {...词条, wrong, streak}} */
function saveMarks(){ try{ localStorage.setItem(LS_MARK, JSON.stringify(marks)); }catch(e){} }
function saveWrongbook(){ try{ localStorage.setItem(LS_WRONG, JSON.stringify(wrongbook)); }catch(e){} }
function mkKey(en,bm,zh,th){ return (en||"")+"|"+(bm||"")+"|"+(zh||"")+"|"+(th||""); }
function keyOfTriple(t){ return mkKey(t.en,t.bm,t.zh,t.th); }
function normalizeTriple(t){ return {en:t.en||"",bm:t.bm||"",zh:t.zh||"",th:t.th||"",en_ipa:t.en_ipa||"",bm_ipa:t.bm_ipa||"",bm_pron:t.bm_pron||"",zh_pinyin:t.zh_pinyin||"",th_pron:t.th_pron||"",level:t.level||"",example:t.example||{}}; }

/* ============ SRS 联动（与三语母语习得复习.html 兼容） ============ */
const LS_TESTER_REVIEW = "tril_review_v1";          /* 共享 key — 复习页读 */
const LS_TESTER_FLASHCARD_MASTERY = "tril_flash_mastery_v1";  /* 共享 key */
const SRS_DAY = 86400000;
const SRS_INTERVAL = [1, 2, 4, 8, 16, 32, 60];
const SRS_MAX_LEVEL = 6;
/* 同步复习页 SRS：写入 tril_review_v1 + tril_flash_mastery_v1 */
function srsPush(triple, correct){
  try{
    const t = triple;
    const key = keyOfTriple(t);
    let srs = {};
    try{ srs = JSON.parse(localStorage.getItem(LS_TESTER_REVIEW) || "{}") || {}; }catch(_){ srs = {}; }
    const now = Date.now();
    const st = srs[key] = srs[key] || {
      level: 0, last_interval: 1, last_review: now,
      next_review: now, forgotten: 0, reviews_total: 0,
      src: "tester", first_seen: now
    };
    let level = st.level;
    let interval = st.last_interval || 1;
    if(correct){
      level = Math.min(SRS_MAX_LEVEL, level + 1);
      interval = SRS_INTERVAL[level];
    } else {
      level = 0;
      interval = 1;
      st.forgotten = (st.forgotten||0) + 1;
    }
    st.level = level;
    st.last_interval = interval;
    st.last_review = now;
    st.next_review = now + interval * SRS_DAY;
    st.reviews_total = (st.reviews_total||0) + 1;
    st.last_rating = correct ? "know" : "unknown";
    localStorage.setItem(LS_TESTER_REVIEW, JSON.stringify(srs));
    /* 跨应用 mastery 同步（写入后，复习页「？模糊」过滤器即可收到） */
    try{
      let mast = {};
      try{ mast = JSON.parse(localStorage.getItem(LS_TESTER_FLASHCARD_MASTERY) || "{}") || {}; }catch(_){ mast = {}; }
      /* 用 src.stage / src.unit 拼一个虚拟 uid 以保证唯一；约定：测试器以三级数字编码 */
      const uid = (t._si||0) + "_" + (t._fi||0) + "_" + (t._ui||0);
      /* 复习页会以 "#"+key 作为复合键 —— 我们也加上同样的复合形式，便于复习页查询 */
      if(uid !== "0_0_0"){
        mast[uid + "#" + key] = correct ? "yes" : "no";
        localStorage.setItem(LS_TESTER_FLASHCARD_MASTERY, JSON.stringify(mast));
      }
    }catch(_){}
  }catch(_){}
}

/* 全局四语值池（用于抽取干扰项） */
const POOL = {en:new Set(), bm:new Set(), zh:new Set(), th:new Set()};
flat.forEach(u=>u.entries.forEach(e=>{
  const t=makeTriple(u,e);
  if(t.en) POOL.en.add(t.en); if(t.bm) POOL.bm.add(t.bm); if(t.zh) POOL.zh.add(t.zh); if(t.th) POOL.th.add(t.th);
}));
function makeTriple(u,e){
  if(u.type==="root"){
    const L=u.langs||["en","zh","bm","th"]; const t={en:"",bm:"",zh:"",th:"",en_ipa:"",bm_ipa:"",bm_pron:"",zh_pinyin:"",th_pron:""};
    for(let p=0;p<4;p++){ const lang=L[p]; if(e.head&&e.head[p]) t[lang]=e.head[p]; }
    if(e.ipa) t.en_ipa=e.ipa;
    if(e.pinyin) t.zh_pinyin=e.pinyin;
    if(e.bm_pron) t.bm_pron=e.bm_pron;
    if(e.bm_ipa) t.bm_ipa=e.bm_ipa;
    if(e.th_pron) t.th_pron=e.th_pron;
    return t;
  }
  return {en:e.en||"", bm:e.bm||"", zh:e.zh||"", th:e.th||"",
          en_ipa:e.en_ipa||"", bm_ipa:e.bm_ipa||"", bm_pron:e.bm_pron||"", zh_pinyin:e.zh_pinyin||"", th_pron:e.th_pron||"",
          level:e.level||"", example:e.example||{}};
}
function phonOf(t,lang){
  if(lang==="en") return t.en_ipa||"";
  if(lang==="bm") return t.bm_pron||"";
  if(lang==="zh") return t.zh_pinyin||"";
  if(lang==="th") return t.th_pron||"";
  return "";
}
function wordSpan(text,lang,ipa){
  const cls = lang==="en"?"en":lang==="bm"?"bm":lang==="zh"?"zh":"th";
  let h='<span class="w '+cls+'" data-lang="'+lang+'" data-text="'+escapeHtml(text||"")+'">'+escapeHtml(text||"—")+'</span>';
  if(lang==="zh") h+=TrilPinyin.html(text);
  if(ipa) h+=' <span class="ipa">'+escapeHtml(ipa)+(lang==="en"?"":"")+'</span>';
  return h;
}
function wordRow(label,text,lang,ipa){
  return '<span class="rk">'+label+'：</span>'+wordSpan(text,lang,ipa);
}
function bmSpan(t){
  return wordSpan(t.bm,"bm",t.bm_ipa||"")+(t.bm_pron?' <span class="pron">'+escapeHtml(t.bm_pron)+'</span>':'');
}
function bmRow(label,t){
  return '<span class="rk">'+label+'：</span>'+bmSpan(t);
}
function exLine(label,text,lang){
  if(!text) return "";
  return '<div class="row">'+wordRow(label, text, lang, "")+'</div>';
}

let progress = {};
try{ progress = JSON.parse(localStorage.getItem(LS_KEY)||"{}"); }catch(e){ progress={}; }
function saveProgress(){ try{ localStorage.setItem(LS_KEY, JSON.stringify(progress)); }catch(e){} }
function isDone(u){ return !!(progress[uid(u)] && progress[uid(u)].done); }
function setResult(u,score,total){
  const prev = progress[uid(u)]||{best:0};
  progress[uid(u)] = {done:(score===total), best:Math.max(prev.best||0,score), last:score+"/"+total};
  saveProgress(); refreshProgress();
}

let settings = {en:"",bm:"",zh:"",th:"",rate:1};
try{ Object.assign(settings, JSON.parse(localStorage.getItem(LS_SET)||"{}")); }catch(e){}
function saveSettings(){ try{ localStorage.setItem(LS_SET, JSON.stringify(settings)); }catch(e){} }

let voices = [];
function loadVoices(){ voices = window.speechSynthesis ? speechSynthesis.getVoices() : []; fillVoiceSelects(); }
if(window.speechSynthesis){ loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
function fillVoiceSelects(){
  const mk=(sel,langPrefix,cur)=>{
    sel.innerHTML="";
    const opts = voices.filter(v=>v.lang && v.lang.toLowerCase().startsWith(langPrefix));
    const all = document.createElement("option"); all.value=""; all.textContent="（自动/默认）"; sel.appendChild(all);
    opts.forEach(v=>{ const o=document.createElement("option"); o.value=v.name; o.textContent=v.name+" ["+v.lang+"]"; sel.appendChild(o); });
    sel.value = cur || (opts[0]?opts[0].name:"");
  };
  mk(document.getElementById("voiceEn"),"en",settings.en);
  mk(document.getElementById("voiceBm"),"ms",settings.bm);
  mk(document.getElementById("voiceZh"),"zh",settings.zh);
  mk(document.getElementById("voiceTh"),"th",settings.th);
  const bmNote=document.getElementById("bmNote");
  const hasBm = voices.some(v=>v.lang && v.lang.toLowerCase().startsWith("ms"));
  bmNote.textContent = hasBm ? "✓ 已检测到马来语嗓音" : "⚠ 本设备未安装马来语(ms-MY)嗓音，将回退默认嗓音。";
  const thNote=document.getElementById("thNote");
  const hasTh = voices.some(v=>v.lang && v.lang.toLowerCase().startsWith("th"));
  if(hasTh){ thNote.className="note ok"; thNote.textContent="✓ 已检测到泰语(th-TH)嗓音，可直接朗读。"; }
  else {
    thNote.className="note warn";
    thNote.innerHTML="⚠ <b>本设备未安装泰语语音包</b>，点击泰文/朗读将静音。开启方法：<br>"+
      "· Windows：设置→语音→添加“泰语”语言并下载语音包<br>"+
      "· macOS：系统设置→辅助功能→朗读内容→系统嗓音→管理嗓音→搜“Thai”下载<br>"+
      "· 安卓/iOS：安装“Google 文字转语音引擎”并在其设置里下载泰语语音包<br>"+
      "装好后重开本文件即可听到泰语朗读。";
  }
}
function pickVoice(lang){
  const sel = lang==="en"?settings.en : lang==="bm"?settings.bm : lang==="zh"?settings.zh : settings.th;
  if(sel){ const v=voices.find(x=>x.name===sel); if(v) return v; }
  const pref = lang==="bm"?"ms":lang==="th"?"th":lang;
  const v = voices.find(x=>x.lang && v.lang.toLowerCase().startsWith(pref));
  return v || null;
}
function speak(text,lang,onend){
  if(!text){ if(onend) onend(); return; }
  const u=new SpeechSynthesisUtterance(text);
  u.lang = lang==="en"?"en-US":lang==="bm"?"ms-MY":lang==="zh"?"zh-CN":"th-TH";
  const sel = lang==="en"?settings.en : lang==="bm"?settings.bm : lang==="zh"?settings.zh : settings.th;
  if(sel){ const v=voices.find(x=>x.name===sel); if(v) u.voice=v; }
  u.rate=settings.rate||1; u.volume=1;
  u.onend=()=>{ if(onend) onend(); }; u.onerror=()=>{ if(onend) onend(); };
  try{ speechSynthesis.resume(); }catch(e){}
  speechSynthesis.speak(u);
}
function testVoice(){
  if(!window.speechSynthesis){ toast("当前环境没有 Web Speech API，请用 Safari/Chrome 打开"); return; }
  speechSynthesis.cancel(); speechSynthesis.resume();
  const u=new SpeechSynthesisUtterance("Hello, 你好, Selamat pagi, สวัสดี. 这是语音测试。");
  u.lang="zh-CN"; u.rate=1;
  let started=false; const t=setTimeout(()=>{ if(!started) toast("⚠ 语音引擎无响应，请改用 Safari/Chrome 打开本文件"); },1200);
  u.onstart=()=>{ started=true; clearTimeout(t); toast("🔊 正在发声——若仍听不到请检查系统音量"); };
  u.onend=()=>{ started=true; clearTimeout(t); };
  u.onerror=()=>{ started=true; clearTimeout(t); toast("❌ 语音合成出错，请改用 Safari/Chrome"); };
  speechSynthesis.speak(u);
}
document.getElementById("testTh").onclick=()=>{
  if(!window.speechSynthesis){ toast("当前环境无 Web Speech API，请用 Safari/Chrome 打开"); return; }
  speechSynthesis.cancel(); speechSynthesis.resume();
  const u=new SpeechSynthesisUtterance("สวัสดี สบายดีไหม วันนี้อากาศดี");
  u.lang="th-TH"; const v=pickVoice("th"); if(v) u.voice=v; u.rate=1;
  u.onerror=()=>toast("❌ 泰语合成失败：本设备可能未安装泰语语音包，请见设置里的开启指引");
  speechSynthesis.speak(u);
};
if(!window.speechSynthesis){ /* 不强制提示，交给测试按钮 */ }

const nav=document.getElementById("nav");
function escapeHtml(s){return (s||"").replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));}
/* ===== 钻取式目录（学段→文件→单元），与播放器一致 ===== */
const navState={level:1,si:-1,fi:-1,hist:[]};
function mkBack(txt){ const b=document.createElement("button"); b.className="navback"; b.textContent=txt; b.onclick=navBack; return b; }
function goLevel(level,si,fi){
  navState.hist.push({level:navState.level,si:navState.si,fi:navState.fi});
  navState.level=level; navState.si=si; navState.fi=fi; renderNav();
}
function navBack(){
  if(!navState.hist.length) return;
  const p=navState.hist.pop();
  navState.level=p.level; navState.si=p.si; navState.fi=p.fi; renderNav();
}
function sortedStages(){
  /* 东钢岗位词汇 永远在第一位 */
  const a=DATA.stages.slice();
  const i=a.findIndex(s=>/东钢岗位词汇/.test(s.name||""));
  if(i>0){ const x=a.splice(i,1)[0]; a.unshift(x); }
  return a;
}
function renderNav(){
  nav.innerHTML="";
  if(navState.level===1){
    const close=document.createElement("button"); close.className="navback"; close.textContent="✕ 关闭目录";
    close.onclick=()=>document.body.classList.remove("show-sidebar-m");
    nav.appendChild(close);
    /* 我的练习（收藏 + 错题本） */
    const sp=document.createElement("div"); sp.className="navstage";
    const h=document.createElement("h3"); h.innerHTML="★ 我的练习"; h.style.cursor="default"; sp.appendChild(h);
    const mk=(id,label,onClick)=>{ const b=document.createElement("button"); b.className="navfile"; b.id=id;
      b.innerHTML=escapeHtml(label)+'<span class="fc">'+(id==="navMarks"?Object.keys(marks).length:Object.keys(wrongbook).length)+'</span>'; b.onclick=onClick; return b; };
    sp.appendChild(mk("navMarks","⭐ 我的收藏", ()=>openMarksHome()));
    sp.appendChild(mk("navWrong","📕 错题本", ()=>openWrongHome()));
    nav.appendChild(sp);
    /* 学段列表 */
    sortedStages().forEach(st=>{
      const si=DATA.stages.indexOf(st);
      const total=st.files.reduce((a,f)=>a+f.units.length,0);
      const b=document.createElement("button"); b.className="navfile";
      b.innerHTML='▸ '+escapeHtml(st.name)+' <span class="fc">'+total+'</span>';
      b.onclick=()=>goLevel(2,si,-1);
      nav.appendChild(b);
    });
  } else if(navState.level===2){
    const st=DATA.stages[navState.si];
    nav.appendChild(mkBack("◀ 返回学段"));
    st.files.forEach((f,fi)=>{
      const isRoot = f.units.length>0 && f.units[0].type==="root";
      const b=document.createElement("button"); b.className="navfile";
      b.innerHTML='▸ '+escapeHtml(f.name)+(isRoot?' <span class="rt">🌱</span>':'')+' <span class="fc">'+f.units.length+'</span>';
      b.onclick=()=>goLevel(3,navState.si,fi);
      nav.appendChild(b);
    });
  } else {
    /* level===3：单元列表（侧栏里直接开始） */
    const st=DATA.stages[navState.si]; const f=st.files[navState.fi];
    nav.appendChild(mkBack("◀ 返回文件"));
    f.units.forEach((u,ui)=>{
      const isRoot=u.type==="root";
      const d=isDone({si:navState.si,fi:navState.fi,ui});
      const r=progress[uid({si:navState.si,fi:navState.fi,ui})]||{};
      const cnt=(u.entries?u.entries.length:0)+(isRoot?" 派生词":" 条");
      const best=r.best!=null?(' 🏆'+r.best):'';
      const badge=d?' ✓':'·';
      const b=document.createElement("button"); b.className="navunit";
      b.innerHTML=(isRoot?"🌱 ":"")+badge+' '+escapeHtml(u.title)+' <span class="fc">'+cnt+best+'</span>';
      if(cur && cur.si===navState.si && cur.fi===navState.fi && cur.ui===ui) b.classList.add("active");
      b.onclick=()=>openStart(navState.si,navState.fi,ui);
      nav.appendChild(b);
    });
  }
}

let curSi=-1,curFi=-1;
function getUnitlist(){ return document.getElementById("unitlist"); }
function openFile(si,fi){
  curSi=si;curFi=fi;
  document.querySelectorAll(".navfile,.navunit").forEach(b=>b.classList.remove("active"));
  const nb=nav.querySelector('.navfile[data-si="'+si+'"][data-fi="'+fi+'"]');
  if(nb) nb.classList.add("active");
  /* 钻取到第 3 级：单元列表展示在侧栏 */
  if(typeof goLevel === "function"){
    goLevel(3,si,fi);
    return;
  }
  const st=DATA.stages[si], f=st.files[fi];
  let inner='<div class="breadcrumb"><b>'+st.name+'</b> &nbsp;/&nbsp; '+f.name+' &nbsp;·&nbsp; 共 '+f.units.length+' 个测试单元</div>';
  inner+='<div class="unitgrid">';
  f.units.forEach((u,ui)=>{
    const uu={si,fi,ui}; const d=isDone(uu); const r=(progress[uid(uu)]||{});
    const isRoot = u.type==="root";
    const cnt = (u.entries?u.entries.length:0)+(isRoot?" 派生词":" 条");
    const best = r.best!=null ? (' ⟂ 最佳 '+r.best) : '';
    inner+='<div class="ucard'+(d?" done":"")+'" data-ui="'+ui+'">'+
      '<span class="badge">'+(d?"✓ 满分":"未测")+'</span>'+
      '<div class="ut">'+(isRoot?"🌱 ":"")+escapeHtml(u.title)+'</div>'+
      '<div class="umeta">'+cnt+best+'</div>'+
      '<div class="mini"><i style="width:'+(d?100:0)+'%"></i></div></div>';
  });
  inner+='</div>';
  main.innerHTML='<div class="unitlist" id="unitlist">'+inner+'</div>';
  const ul=getUnitlist();
  ul.querySelectorAll(".ucard").forEach(c=>{ c.onclick=()=>openStart(si,fi,+c.dataset.ui); });
}

let cur=null;
const main=document.getElementById("main");

/* 点击任意 .w 单词/短语即朗读，无需按钮（事件委托，动态内容同样生效） */
main.addEventListener("click", function(e){
  let el = e.target;
  while(el && el!==main){ if(el.classList && el.classList.contains("w") && el.dataset && el.dataset.text){ speak(el.dataset.text, el.dataset.lang); return; } el = el.parentNode; }
});

/* ===== 开始面板 ===== */
const DIRS=[
  {p:"en",a:"zh",label:"英文 → 中文"},
  {p:"en",a:"bm",label:"英文 → 马来文"},
  {p:"zh",a:"en",label:"中文 → 英文"},
  {p:"bm",a:"en",label:"马来文 → 英文"},
  {p:"zh",a:"bm",label:"中文 → 马来文"},
  {p:"bm",a:"zh",label:"马来文 → 中文"},
  {p:"en",a:"th",label:"英文 → 泰文"},
  {p:"th",a:"en",label:"泰文 → 英文"},
  {p:"zh",a:"th",label:"中文 → 泰文"},
  {p:"bm",a:"th",label:"马来文 → 泰文"},
];
const DIRLABEL={en:"EN 英文",bm:"BM 马来文",zh:"ZH 中文",th:"TH 泰文"};
function openStart(si,fi,ui){
  const _u=flat.find(x=>x.si===si&&x.fi===fi&&x.ui===ui);
  if(!_u){ toast("找不到该单元"); return; }
  showStart(_u);
}
function goBack(){
  if(cur && cur.home==="marks") openMarksHome();
  else if(cur && cur.home==="wrong") openWrongHome();
  else openFile(cur.si,cur.fi);
}
function makePracticeUnit(entries,title,home){
  return {stage:"我的练习",file:title,si:-1,fi:-1,ui:0,title:title,type:"table",langs:["en","zh","bm"],entries:entries,home:home};
}
function showStart(u){
  cur=u;
  state.mode="mix"; state.count=10; state.level=""; state.qtype="choice";
  const isRoot = u.type==="root";
  const hasLevel = (u.entries||[]).some(e=>e.level);
  const levelField = hasLevel
    ? '<div class="field"><div class="lab">难度分级（按等级筛选单词）</div><div class="chips" id="levelChips">'+
        '<span class="chip active" data-level="">全部</span>'+
        '<span class="chip" data-level="1">①基础</span>'+
        '<span class="chip" data-level="2">②进阶</span>'+
        '<span class="chip" data-level="3">③专业</span>'+
      '</div></div>'
    : '';
  main.innerHTML='<div class="quiz"><div class="quizbar">'+
    '<button class="back" id="backBtn">← 返回</button>'+
    '<span class="lt">'+escapeHtml(u.stage)+' · '+escapeHtml(u.file)+' · '+escapeHtml(u.title)+'</span>'+
    '</div><div class="qwrap"><div class="startpanel">'+
    '<h2>'+escapeHtml(u.title)+'</h2>'+
    '<div class="desc">本单元共 '+ (u.entries?u.entries.length:0) +' 个'+(isRoot?"派生词":"词条")+'。选择题型、方向与题量后开始自测。</div>'+
    '<div class="field"><div class="lab">题型</div><div class="chips" id="qtypeChips">'+
      '<span class="chip active" data-qtype="choice" title="看词选义，4 选 1">🔘 选择</span>'+
      '<span class="chip" data-qtype="spell" title="听/读单词，输入正确拼写">⌨️ 拼写</span>'+
      '<span class="chip" data-qtype="listen" title="听发音，从 4 个中文释义中选对">🔊 听力</span>'+
      '<span class="chip" data-qtype="match" title="左右配对 6 对词条">🧩 配对</span>'+
    '</div></div>'+
    '<div class="field"><div class="lab">方向（看 → 选）</div><div class="chips" id="modeChips">'+
      '<span class="chip active" data-mode="mix">综合随机</span>'+
      '<span class="chip" data-mode="en_zh">英文→中文</span>'+
      '<span class="chip" data-mode="en_bm">英文→马来文</span>'+
      '<span class="chip" data-mode="zh_en">中文→英文</span>'+
      '<span class="chip" data-mode="bm_en">马来文→英文</span>'+
      '<span class="chip" data-mode="zh_bm">中文→马来文</span>'+
      '<span class="chip" data-mode="bm_zh">马来文→中文</span>'+
      '<span class="chip" data-mode="en_th">英文→泰文</span>'+
      '<span class="chip" data-mode="th_en">泰文→英文</span>'+
      '<span class="chip" data-mode="zh_th">中文→泰文</span>'+
      '<span class="chip" data-mode="bm_th">马来文→泰文</span>'+
      '<span class="chip" data-mode="listen">🔊 听力辨义</span>'+
    '</div></div>'+
    '<div class="field"><div class="lab">题量</div><div class="chips" id="countChips">'+
      '<span class="chip" data-count="5">5 题</span>'+
      '<span class="chip active" data-count="10">10 题</span>'+
      '<span class="chip" data-count="15">15 题</span>'+
      '<span class="chip" data-count="0">全部</span>'+
    '</div></div>'+
    levelField+
    '<div style="display:flex;gap:10px;margin-top:6px"><button class="primary" id="startBtn" style="flex:1;padding:12px">▶ 开始测试</button>'+
    '<button id="listenTestBtn">🔈 测试语音</button></div>'+
    '</div></div></div>';
  document.getElementById("backBtn").onclick=goBack;
  document.getElementById("listenTestBtn").onclick=testVoice;
  document.querySelectorAll("#qtypeChips .chip").forEach(c=>c.onclick=()=>{
    document.querySelectorAll("#qtypeChips .chip").forEach(x=>x.classList.remove("active"));
    c.classList.add("active");
    state.qtype = c.dataset.qtype;
    /* 听力题型自动切到 en_zh 方向；其他题型仍可用户自选 */
    if(state.qtype==="listen"){
      document.querySelectorAll("#modeChips .chip").forEach(x=>x.classList.remove("active"));
      const lm=document.querySelector('#modeChips .chip[data-mode="listen"]');
      if(lm) lm.classList.add("active");
      state.mode="listen";
    }
  });
  document.querySelectorAll("#modeChips .chip").forEach(c=>c.onclick=()=>{
    document.querySelectorAll("#modeChips .chip").forEach(x=>x.classList.remove("active"));
    c.classList.add("active");
    state.mode = c.dataset.mode;
    /* 用户切到「听力辨义」方向时，自动把题型同步成 listen */
    if(state.mode==="listen" && state.qtype!=="listen"){
      document.querySelectorAll("#qtypeChips .chip").forEach(x=>x.classList.remove("active"));
      const lq=document.querySelector('#qtypeChips .chip[data-qtype="listen"]');
      if(lq) lq.classList.add("active");
      state.qtype="listen";
    }
  });
  document.querySelectorAll("#countChips .chip").forEach(c=>c.onclick=()=>{
    document.querySelectorAll("#countChips .chip").forEach(x=>x.classList.remove("active"));
    c.classList.add("active"); state.count=+c.dataset.count;
  });
  document.querySelectorAll("#levelChips .chip").forEach(c=>c.onclick=()=>{
    document.querySelectorAll("#levelChips .chip").forEach(x=>x.classList.remove("active"));
    c.classList.add("active"); state.level=c.dataset.level;
  });
  document.getElementById("startBtn").onclick=()=>startQuiz();
}

/* ===== 我的收藏 / 错题本 主页 ===== */
function updatePracticeBadges(){
  const m=document.getElementById("navMarks"); if(m){ const fc=m.querySelector(".fc"); if(fc) fc.textContent=Object.keys(marks).length; }
  const w=document.getElementById("navWrong"); if(w){ const fc=w.querySelector(".fc"); if(fc) fc.textContent=Object.keys(wrongbook).length; }
}
function openMarksHome(){
  cur=null;
  const entries=Object.keys(marks).map(k=>marks[k]);
  const n=entries.length;
  main.innerHTML='<div class="quiz"><div class="quizbar"><span class="lt">⭐ 我的收藏</span></div>'+
    '<div class="qwrap"><div class="startpanel">'+
    '<h2>⭐ 我的收藏</h2>'+
    '<div class="desc">你在学习器中点击词条前的 ☆ 标记的词汇，会自动汇总到这里，用于强化自测。共 '+n+' 个。</div>'+
    (n? '<div style="display:flex;gap:10px;margin-top:6px"><button class="primary" id="startMarks" style="flex:1;padding:12px">▶ 开始练习（'+n+' 词）</button>'+
         '<button id="expMarksCSV">⤓ CSV</button>'+
         '<button id="impMarksCSV">⤒ CSV</button>'+
         '<button id="clearMarks">🗑 清空收藏</button></div>'
       : '<div class="desc" style="margin-top:14px">暂无收藏。请回到学习器，点击任意词条前的 ☆ 即可收藏。</div>')+
    '</div></div></div>';
  if(n){
    document.getElementById("startMarks").onclick=()=>{ showStart(makePracticeUnit(entries,"我的收藏","marks")); };
    document.getElementById("clearMarks").onclick=()=>{ marks={}; saveMarks(); updatePracticeBadges(); openMarksHome(); toast("已清空收藏"); };
    const exp=document.getElementById("expMarksCSV");
    if(exp) exp.onclick=()=>{
      if(!window.trilCSV){ toast("CSV 模块未加载"); return; }
      const x = trilCSV.exportEntries(entries, "tril_marks_" + new Date().toISOString().slice(0,10) + ".tsv");
      toast("已导出 " + x + " 条");
    };
    const imp=document.getElementById("impMarksCSV");
    if(imp) imp.onclick=()=>{
      if(!window.trilCSV){ toast("CSV 模块未加载"); return; }
      trilCSV.importEntries(function(rows){
        if(!rows || !rows.length){ toast("空文件"); return; }
        rows.forEach(function(e){
          const k = mkKey(e.en||"", e.bm||"", e.zh||"", e.th||"");
          if(!marks[k]) marks[k] = e;
        });
        saveMarks(); updatePracticeBadges(); openMarksHome();
        toast("已导入 " + rows.length + " 条 → 收藏");
      });
    };
  }
}
function openWrongHome(){
  cur=null;
  const keys=Object.keys(wrongbook); const n=keys.length;
  let list='';
  if(n){
    list='<div class="review" style="margin-top:8px"><div class="rvlist" style="max-height:300px">';
    keys.forEach(k=>{ const e=wrongbook[k]; const st=e.streak||0; const wr=e.wrong||0;
      list+='<div class="rvitem">'+wordSpan(e.en||"—","en","")+' / '+wordSpan(e.zh||"—","zh","")+
        ' ｜ 错'+wr+' 次 · 连对 '+st+'/10</div>'; });
    list+='</div></div>';
  }
  main.innerHTML='<div class="quiz"><div class="quizbar"><span class="lt">📕 错题本</span></div>'+
    '<div class="qwrap"><div class="startpanel">'+
    '<h2>📕 错题本</h2>'+
    '<div class="desc">你答错的词汇会自动收录到此。每答对 1 次「连对 +1」，连续答对 10 次后自动移出错题本。当前共 '+n+' 个。</div>'+
    (n? '<div style="display:flex;gap:10px;margin-top:6px"><button class="primary" id="startWrong" style="flex:1;padding:12px">▶ 开始练习（'+n+' 词）</button>'+
         '<button id="expWrongCSV">⤓ CSV</button>'+
         '<button id="impWrongCSV">⤒ CSV</button>'+
         '<button id="clearWrong">🗑 清空错题本</button></div>'+list
       : '<div class="desc" style="margin-top:14px">错题本为空，继续刷题来积累吧！</div>')+
    '</div></div></div>';
  if(n){
    const entries=keys.map(k=>wrongbook[k]);
    document.getElementById("startWrong").onclick=()=>{ showStart(makePracticeUnit(entries,"错题本","wrong")); };
    document.getElementById("clearWrong").onclick=()=>{ wrongbook={}; saveWrongbook(); updatePracticeBadges(); openWrongHome(); toast("已清空错题本"); };
    const expW=document.getElementById("expWrongCSV");
    if(expW) expW.onclick=()=>{
      if(!window.trilCSV){ toast("CSV 模块未加载"); return; }
      const x = trilCSV.exportEntries(entries, "tril_wrongbook_" + new Date().toISOString().slice(0,10) + ".tsv");
      toast("已导出 " + x + " 条");
    };
    const impW=document.getElementById("impWrongCSV");
    if(impW) impW.onclick=()=>{
      if(!window.trilCSV){ toast("CSV 模块未加载"); return; }
      trilCSV.importEntries(function(rows){
        if(!rows || !rows.length){ toast("空文件"); return; }
        rows.forEach(function(e){
          const k = mkKey(e.en||"", e.bm||"", e.zh||"", e.th||"");
          if(!wrongbook[k]){
            wrongbook[k] = Object.assign({}, e, {wrong:1, streak:0});
          }
        });
        saveWrongbook(); updatePracticeBadges(); openWrongHome();
        toast("已导入 " + rows.length + " 条 → 错题本");
      });
    };
  }
}

/* ===== 生成题目 ===== */
const state={mode:"mix",count:10,level:"",qtype:"choice",questions:[],qIndex:0,score:0,answered:false};
/* 题型定义（qtype）：choice 选择 / spell 拼写 / listen 听力 / match 配对 */
/* direction（state.mode）保留 8 个方向对 + "mix" */
function shuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
/* 简化的方向定义：8 个方向对 + "mix" 综合 + "listen" 听力（en→zh） */
const DIRLIST = [
  {p:"en",a:"zh"}, {p:"en",a:"bm"}, {p:"zh",a:"en"}, {p:"bm",a:"en"},
  {p:"en",a:"th"}, {p:"th",a:"en"}, {p:"zh",a:"th"}, {p:"bm",a:"th"},
];
function pickDirection(t){
  /* 给定一个 triple，返回 (promptLang, answerLang) */
  if(state.mode && state.mode!=="mix" && state.mode!=="listen"){
    const [p,a] = state.mode.split("_");
    if(t[p] && t[a]) return {p, a};
    /* 该方向不匹配，则回退到 mix 中随便选一项 */
  }
  if(state.mode==="listen"){
    if(t.en && t.zh) return {p:"en", a:"zh"};
    if(t.en && t.bm) return {p:"en", a:"bm"};
    return null;
  }
  /* mix：随机选一个该 triple 支持的方向 */
  const opts = [];
  DIRLIST.forEach(d => { if(t[d.p] && t[d.a]) opts.push(d); });
  if(!opts.length) return null;
  return opts[Math.floor(Math.random()*opts.length)];
}
function buildQuestions(){
  const u=cur;
  const triples=(u.entries||[]).map(e=>makeTriple(u,e)).filter(t=>t.en||t.bm||t.zh||t.th);
  let cand=[];
  triples.forEach(t=>{
    if(state.level && String(t.level)!==String(state.level)) return;
    const d = pickDirection(t);
    if(!d) return;
    cand.push({p:d.p, a:d.a, t});
  });
  cand=shuffle(cand);
  const want = state.count>0 ? state.count : cand.length;
  cand=cand.slice(0, want);
  /* 题型分支：match 走批量配对生成，其余按 qtype 单题生成 */
  if(state.qtype==="match"){
    const PAIR = Math.min(6, cand.length);
    const pairs = cand.slice(0, PAIR);
    const lefts = shuffle(pairs.map(c=>c.t[c.p]));
    const rights = shuffle(pairs.map(c=>c.t[c.a]));
    return [{qtype:"match", pairs, lefts, rights, userPairs:{} }];
  }
  return cand.map(c=>{
    const correct = c.t[c.a];
    const distract = shuffle(Array.from(POOL[c.a]).filter(v=>v && v!==correct)).slice(0,3);
    const opts = shuffle([correct].concat(distract));
    const q = {qtype:state.qtype, promptLang:c.p, answerLang:c.a, prompt:c.t[c.p], answer:correct, options:opts, triple:c.t};
    /* match 不应到这里 */
    /* spell 题型额外存语音用 promptLang */
    if(state.qtype==="listen"){
      q.listen = true;
      q.audio = c.t[c.p];              /* 朗读用真词；显示前清空 prompt 避免泄露 */
      q.prompt = ""; /* 听写：不显示文字，只播放 */
    } else if(state.qtype==="spell"){
      q.listen = (c.p==="en" || c.p==="bm" || c.p==="th"); /* en/bm/th 自动播放 */
    }
    return q;
  });
}
function startQuiz(){
  state.questions=buildQuestions();
  state.qIndex=0; state.score=0;
  if(!state.questions.length){ toast("本单元暂无可生成题目（缺少对应语言字段）"); openFile(cur.si,cur.fi); return; }
  renderQuestion();
}

function renderQuestion(){
  const q = state.questions[state.qIndex];
  state.answered = false;
  if(!q){ renderEmpty(); return; }
  /* match：批量页面（1 个 qtitle 含 6 对） */
  if(q.qtype === "match"){ renderQuestionMatch(q); return; }
  if(q.triple) window.TRIL_CURRENT = q.triple;
  /* choice / listen 共用 4-option 渲染；spell 用输入框 */
  if(q.qtype === "spell"){ renderQuestionSpell(q); return; }
  renderQuestionChoice(q);
}
/* 4 选 1（choice + listen 都用） */
function renderQuestionChoice(q){
  const total = state.questions.length;
  const dirTxt = q.listen ? "🔊 听力辨义" : (DIRLABEL[q.promptLang]+" → "+DIRLABEL[q.answerLang]);
  let promptHtml;
  if(q.listen){
    const langMap = {en:"英文", bm:"马来文", th:"泰文"};
    promptHtml = '<div class="qlisten-hint">点击播放'+ (langMap[q.promptLang]||"") +'发音，听后选择正确含义</div>'+
      '<div class="qprompt l-'+q.promptLang+'">🔊 ?</div>'+
      '<div class="qaudio"><button class="primary" id="playQ">🔊 播放单词</button>'+
      '<button id="replayQ">↻ 重听</button></div>';
  } else {
    promptHtml = '<div class="qprompt l-'+q.promptLang+'"><span class="w '+q.promptLang+'" data-lang="'+q.promptLang+'" data-text="'+escapeHtml(q.prompt)+'">'+escapeHtml(q.prompt)+'</span></div>';
  }
  let optsHtml = '<div class="opts" id="opts">';
  q.options.forEach((o,i)=>{
    optsHtml += '<button class="opt" data-o="'+i+'" data-val="'+escapeHtml(o)+'">'+
      '<span class="num">'+(i+1)+'</span><span class="w '+q.answerLang+'" data-lang="'+q.answerLang+'" data-text="'+escapeHtml(o)+'">'+escapeHtml(o)+'</span></button>';
  });
  optsHtml += '</div>';
  main.innerHTML = '<div class="quiz"><div class="quizbar">'+
    '<button class="back" id="backBtn">← 退出</button>'+
    '<span class="lt">'+escapeHtml(cur.stage)+' · '+escapeHtml(cur.title)+'</span>'+
    '<span class="spacer" style="flex:1"></span>'+
    '<span class="qtag '+q.promptLang+'" style="margin-right:8px">'+dirTxt+'</span>'+
    '<span class="qprog">第 '+(state.qIndex+1)+' / '+total+' 题 ｜ 得分 '+state.score+'</span>'+
    '<span class="qbar"><i style="width:'+Math.round(state.qIndex/total*100)+'%"></i></span>'+
    '</div><div class="qwrap">'+
    '<div class="qcard"><div class="qhead"><span class="qtag '+q.promptLang+'">'+ (q.qtype==="listen"?"🔊 听力题": (q.qtype==="spell"?"⌨️ 拼写题":"🔘 选择题")) +'</span></div>'+promptHtml+optsHtml+
    '<div class="feedback" id="feedback"></div>'+
    '<div class="qnext" id="qnext"></div>'+
    '</div></div></div>';
  document.getElementById("backBtn").onclick = ()=>openFile(cur.si,cur.fi);
  if(q.listen){
    const audioText = q.audio || q.prompt || q.answer;
    document.getElementById("playQ").onclick = ()=>speak(audioText,q.promptLang);
    document.getElementById("replayQ").onclick = ()=>speak(audioText,q.promptLang);
    setTimeout(()=>speak(audioText,q.promptLang), 200);
  }
  document.querySelectorAll("#opts .opt").forEach(b=>{ b.onclick = ()=>answerChoice(b); });
}
/* 拼写题：输入框 + 提交 */
function renderQuestionSpell(q){
  const total = state.questions.length;
  const dirTxt = DIRLABEL[q.promptLang]+" → 拼写";
  const isAudio = (q.promptLang==="en" || q.promptLang==="bm" || q.promptLang==="th");
  const langName = {en:"英文", bm:"马来文", zh:"中文", th:"泰文"}[q.promptLang];
  const promptHtml = (isAudio
    ? '<div class="qlisten-hint">先听'+langName+'发音，然后输入正确的'+langName+'单词</div>'+
      '<div class="qaudio" style="justify-content:center"><button class="primary" id="playQ">🔊 播放（'+langName+'）</button>'+
      '<button id="replayQ">↻ 重听</button></div>'
    : '<div class="qlisten-hint">把下列意思翻译成'+langName+'（点击看拼音可朗读）</div>'+
      '<div class="qprompt l-'+q.promptLang+'"><span class="w '+q.answerLang+'" data-lang="'+q.answerLang+'" data-text="'+escapeHtml(q.answer)+'">'+escapeHtml(q.answer)+'</span></div>'
  );
  main.innerHTML = '<div class="quiz"><div class="quizbar">'+
    '<button class="back" id="backBtn">← 退出</button>'+
    '<span class="lt">'+escapeHtml(cur.stage)+' · '+escapeHtml(cur.title)+'</span>'+
    '<span class="spacer" style="flex:1"></span>'+
    '<span class="qtag '+q.promptLang+'" style="margin-right:8px">'+dirTxt+'</span>'+
    '<span class="qprog">第 '+(state.qIndex+1)+' / '+total+' 题 ｜ 得分 '+state.score+'</span>'+
    '<span class="qbar"><i style="width:'+Math.round(state.qIndex/total*100)+'%"></i></span>'+
    '</div><div class="qwrap">'+
    '<div class="qcard"><div class="qhead"><span class="qtag '+q.promptLang+'">⌨️ 拼写题</span></div>'+promptHtml+
    '<div class="spell-input" style="text-align:center;margin:14px 0"><input id="spellInp" type="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" '+
      'style="font-size:22px;padding:10px 14px;width:80%;max-width:420px;border-radius:10px;border:2px solid var(--line);background:var(--panel2);color:var(--text);text-align:center" '+
      'placeholder="在此输入拼写"></div>'+
    '<div style="text-align:center"><button class="primary" id="spellSubmit">✓ 提交</button> <button id="spellSkip">↪ 跳过</button></div>'+
    '<div class="feedback" id="feedback"></div>'+
    '<div class="qnext" id="qnext"></div>'+
    '</div></div></div>';
  document.getElementById("backBtn").onclick = ()=>openFile(cur.si,cur.fi);
  const inp = document.getElementById("spellInp");
  inp.focus();
  if(isAudio){
    document.getElementById("playQ").onclick = ()=>speak(q.prompt,q.promptLang);
    document.getElementById("replayQ").onclick = ()=>speak(q.prompt,q.promptLang);
    setTimeout(()=>speak(q.prompt,q.promptLang), 250);
  }
  document.getElementById("spellSubmit").onclick = ()=>answerSpell(inp.value);
  document.getElementById("spellSkip").onclick = ()=>answerSpell("");
  inp.addEventListener("keydown", e=>{ if(e.key==="Enter"){ e.preventDefault(); answerSpell(inp.value); } });
  state._spellInp = inp;
}
/* 配对题 */
function renderQuestionMatch(q){
  /* 6 对，左栏 prompt，右栏 answer，打乱顺序 */
  const leftsHtml = q.lefts.map((s,i)=>{
    const lang = q.pairs[0].p; /* 都是同一方向 */
    return '<div class="match-left" data-li="'+i+'" data-val="'+escapeHtml(s)+'"><span class="ml-no">'+(i+1)+'</span><span class="w '+lang+'" data-lang="'+lang+'" data-text="'+escapeHtml(s)+'">'+escapeHtml(s)+'</span></div>';
  }).join("");
  const rightsHtml = q.rights.map((s,i)=>{
    const lang = q.pairs[0].a;
    return '<div class="match-right" data-ri="'+i+'" data-val="'+escapeHtml(s)+'"><span class="ml-no">'+(q.lefts.length-i)+'</span><span class="w '+lang+'" data-lang="'+lang+'" data-text="'+escapeHtml(s)+'">'+escapeHtml(s)+'</span></div>';
  }).join("");
  main.innerHTML = '<div class="quiz"><div class="quizbar">'+
    '<button class="back" id="backBtn">← 退出</button>'+
    '<span class="lt">'+escapeHtml(cur.stage)+' · '+escapeHtml(cur.title)+'</span>'+
    '<span class="spacer" style="flex:1"></span>'+
    '<span class="qprog">配对 '+q.pairs.length+' 对</span>'+
    '</div><div class="qwrap">'+
    '<div class="qcard"><div class="qhead"><span class="qtag">🧩 配对题</span></div>'+
    '<div class="match-hint">逐个点击左栏词条，再点击右栏对应的释义。配对成功的行会显示 ✓。全部匹配后查看结果。</div>'+
    '<div class="match-grid" id="matchGrid">'+
    '<div class="match-col" id="matchL">'+leftsHtml+'</div>'+
    '<div class="match-col" id="matchR">'+rightsHtml+'</div>'+
    '</div>'+
    '<div class="feedback" id="feedback"></div>'+
    '<div class="qnext" id="qnext"></div>'+
    '</div></div></div>';
  document.getElementById("backBtn").onclick = ()=>openFile(cur.si,cur.fi);
  bindMatchGrid(q);
}
function bindMatchGrid(q){
  q.userPairs = q.userPairs || {};
  const L = document.getElementById("matchL"), R = document.getElementById("matchR");
  let selectedLeft = null;
  L.querySelectorAll(".match-left").forEach(el=>{
    el.onclick = ()=>{
      if(el.classList.contains("matched")) return;
      L.querySelectorAll(".match-left").forEach(x=>x.classList.remove("sel"));
      el.classList.add("sel");
      selectedLeft = el;
    };
  });
  R.querySelectorAll(".match-right").forEach(el=>{
    el.onclick = ()=>{
      if(el.classList.contains("matched")) return;
      if(!selectedLeft) { toast("先点左栏词条"); return; }
      const li = selectedLeft.dataset.li;
      const ri = el.dataset.ri;
      /* 检查 pairing 是否正确 */
      const correct = selectedLeft.dataset.val === el.dataset.val;
      selectedLeft.classList.add("matched");
      el.classList.add("matched");
      selectedLeft.classList.remove("sel");
      selectedLeft = null;
      if(correct){ el.classList.add("ok"); selectedLeft && selectedLeft.classList.add("ok"); }
      else { el.classList.add("bad"); }
      q.userPairs[li] = {ri, correct};
      /* 检查是否全部匹配 */
      const allMatched = L.querySelectorAll(".match-left").length === Object.keys(q.userPairs).length;
      if(allMatched){ answerMatch(); }
    };
  });
}
function renderEmpty(){ main.innerHTML='<div class="qwrap"><div class="qcard">无题目</div></div>'; }

function answerChoice(btn){
  if(state.answered) return;
  state.answered = true;
  const q = state.questions[state.qIndex];
  const chosen = btn.dataset.val;
  const correct = chosen===q.answer;
  q.userAnswer = chosen;
  document.querySelectorAll("#opts .opt").forEach(b=>{
    b.disabled = true;
    if(b.dataset.val===q.answer) b.classList.add("correct");
    else if(b===btn) b.classList.add("wrong");
  });
  finalizeSingle(correct);
}
function answerSpell(input){
  if(state.answered) return;
  state.answered = true;
  const q = state.questions[state.qIndex];
  /* 容错：去标点、trim、忽略大小写、合并多余空格 */
  const norm = (s)=>(s||"").toLowerCase().replace(/[\s\u200b\u00a0]+/g," ").replace(/^[`'\"\u2018\u2019\u201c\u201d]+|[\.`'\"\u2018\u2019\u201c\u201d,!?;:]+$/g,"").trim();
  let expected = q.prompt; /* 拼写的目标词 */
  const userNorm = norm(input);
  const expNorm  = norm(expected);
  const correct = userNorm && userNorm===expNorm;
  q.userAnswer = input;
  const inp = state._spellInp;
  if(inp){ inp.disabled = true; }
  const t = q.triple;
  finalizeSingle(correct, /* extra hint */ '<div class="row" style="font-size:18px"><b>正确答案：</b> '+escapeHtml(expected)+'</div>');
}
function answerMatch(){
  if(state.answered) return;
  state.answered = true;
  const q = state.questions[state.qIndex];
  let correct = 0, total = q.pairs.length;
  q.pairs.forEach((p,i)=>{
    const u = q.userPairs[i];
    if(u && u.correct) correct++;
  });
  q.userScore = correct;
  q.userTotal = total;
  /* showResult 时按 userScore/total 计算 */
  state.score += correct;
  showMatchResult(correct, total);
}
function showMatchResult(correct, total){
  /* 把分拆到剩余 entries，按对对错 算错题本贡献 */
  const q = state.questions[state.qIndex];
  q.pairs.forEach((p,i)=>{
    const u = q.userPairs[i];
    const ok = u && u.correct;
    const t = p.t;
    const wk = keyOfTriple(t);
    if(ok){
      if(wrongbook[wk]){
        wrongbook[wk].streak = (wrongbook[wk].streak||0)+1;
        if(wrongbook[wk].streak>=10){ delete wrongbook[wk]; }
        else { wrongbook[wk].example = t.example || wrongbook[wk].example; }
      }
    } else {
      if(!wrongbook[wk]){ wrongbook[wk] = normalizeTriple(t); wrongbook[wk].wrong=1; wrongbook[wk].streak=0; }
      else { wrongbook[wk].wrong = (wrongbook[wk].wrong||0)+1; wrongbook[wk].streak=0; }
    }
    srsPush(t, ok);
  });
  saveWrongbook(); updatePracticeBadges();
  const pct = Math.round(correct/total*100);
  const emoji = pct===100?"🏆":pct>=80?"🌟":pct>=60?"💪":"📚";
  const fb = document.getElementById("feedback");
  fb.classList.add("show");
  fb.innerHTML = (pct===100?'✅ <b style="color:var(--ok)">全部配对成功！</b>':'⚠️ 配对完成，'+correct+' / '+total+' 正确');
  const next = document.getElementById("qnext");
  next.innerHTML = '<button class="primary" id="finishBtn">查看成绩</button>';
  document.getElementById("finishBtn").onclick = showResult;
}
/* 单题反馈（用于 choice + spell） */
function finalizeSingle(correct, extra){
  const q = state.questions[state.qIndex];
  if(correct) state.score++;
  const t = q.triple;
  const wk = keyOfTriple(t);
  if(correct){
    if(wrongbook[wk]){
      wrongbook[wk].streak = (wrongbook[wk].streak||0)+1;
      if(wrongbook[wk].streak>=10){ delete wrongbook[wk]; toast("🎉 已连续答对 10 次，移出错题本！"); }
      else { wrongbook[wk].example = t.example||wrongbook[wk].example; }
      saveWrongbook(); updatePracticeBadges();
    }
  } else {
    if(!wrongbook[wk]){ wrongbook[wk]=normalizeTriple(t); wrongbook[wk].wrong=1; wrongbook[wk].streak=0; }
    else { wrongbook[wk].wrong = (wrongbook[wk].wrong||0)+1; wrongbook[wk].streak=0; }
    saveWrongbook(); updatePracticeBadges();
  }
  srsPush(t, correct); /* SRS 联动 */
  const exHtml = (t.example && (t.example.en||t.example.bm||t.example.zh||t.example.th))
    ? '<div class="example-block"><div class="row" style="margin-top:8px;border-top:1px dashed var(--line);padding-top:8px"><span class="rk">📖 例句（点击可朗读）：</span></div>'+
      exLine("EN", t.example.en, "en")+exLine("BM", t.example.bm, "bm")+exLine("ZH", t.example.zh, "zh")+exLine("TH", t.example.th, "th")+
      '</div>'
    : '';
  const fb = document.getElementById("feedback");
  fb.classList.add("show");
  fb.innerHTML = (correct?'✅ <b style="color:var(--ok)">回答正确！</b>':'❌ <b style="color:var(--danger)">正确答案：'+escapeHtml(q.answer||q.prompt)+'</b>')+
    (extra||'')+
    '<div class="row">'+wordRow("EN 英文", t.en, "en", phonOf(t,"en"))+'</div>'+
    '<div class="row">'+bmRow("BM 马来文", t)+'</div>'+
    '<div class="row">'+wordRow("ZH 中文", t.zh, "zh", phonOf(t,"zh"))+'</div>'+
    '<div class="row">'+wordRow("TH 泰文", t.th, "th", phonOf(t,"th"))+'</div>'+
    exHtml+
    '<div class="hint">🖱 点击上方任意单词 / 短语 / 例句即可自动朗读发音（无需按钮）</div>';
  const total = state.questions.length;
  const next = document.getElementById("qnext");
  if(state.qIndex+1<total){
    next.innerHTML = '<button class="primary" id="nextBtn">下一道 →</button>';
    document.getElementById("nextBtn").onclick = ()=>{ state.qIndex++; renderQuestion(); };
  } else {
    next.innerHTML = '<button class="primary" id="finishBtn">查看成绩</button>';
    document.getElementById("finishBtn").onclick = showResult;
  }
}
function showResult(){
  /* match 题型只有 1 题但内部计 pair 数；要把总题数与得分按 pair 算 */
  const isMatch = state.qtype==="match";
  const total = isMatch ? (state.questions[0] && state.questions[0].pairs ? state.questions[0].pairs.length : 0) : state.questions.length;
  const score = state.score;
  const pct = total ? Math.round(score/total*100) : 0;
  let msg,emoji;
  if(pct===100){ emoji="🏆"; msg="满分！本单元已牢牢掌握。"; setResult(cur,score,total); }
  else if(pct>=80){ emoji="🌟"; msg="很棒，再复习几遍就能满分。"; setResult(cur,score,total); }
  else if(pct>=60){ emoji="💪"; msg="不错，建议重做巩固易错项。"; setResult(cur,score,total); }
  else { emoji="📚"; msg="还需多练，回到学习器巩固后再来。"; setResult(cur,score,total); }
  let reviewHtml='<div class="review"><div class="rvhead" id="rvhead">📖 查看全部 '+total+' 题答案解析（含音标 · 点击单词可朗读）</div><div class="rvlist" id="rvlist" style="display:none">';
  if(isMatch){
    const q = state.questions[0];
    q.pairs.forEach((p,i)=>{
      const t = p.t;
      const u = q.userPairs[i];
      const ok = u && u.correct;
      reviewHtml += '<div class="rvitem">'+
        '<div><b>配对 '+(i+1)+'</b> · '+DIRLABEL[p.p]+' → '+DIRLABEL[p.a]+'</div>'+
        '<div class="rva">你的配对：<span class="'+(ok?'ok':'bad')+'">'+(u?'#'+(+u.ri+1):'未配')+'</span> ｜ 正确：'+escapeHtml(p.t[p.p])+' = '+wordSpan(p.t[p.a],p.a,phonOf(t,p.a))+'</div>'+
        '<div class="rva">'+wordRow("EN",t.en,"en",phonOf(t,"en"))+' ｜ '+bmRow("",t)+' ｜ '+wordRow("ZH",t.zh,"zh",phonOf(t,"zh"))+' ｜ '+wordRow("TH",t.th,"th",phonOf(t,"th"))+'</div>'+
      '</div>';
    });
  } else {
    state.questions.forEach((q,i)=>{
      const t=q.triple;
      const correct = q.userAnswer===q.answer;
      reviewHtml+='<div class="rvitem">'+
        '<div><b>第 '+(i+1)+' 题</b> · '+(q.qtype==="listen"?'🔊 听力辨义':(q.qtype==="spell"?'⌨️ 拼写':(DIRLABEL[q.promptLang]+' → '+DIRLABEL[q.answerLang])))+
          ' · '+(q.qtype==="spell" || q.listen ? '🔊' : wordSpan(q.prompt,q.promptLang,phonOf(t,q.promptLang)))+'</div>'+
        '<div class="rva">你的答案：<span class="'+(correct?'ok':'bad')+'">'+escapeHtml(q.userAnswer||"—")+'</span> ｜ 正确答案：'+wordSpan(q.answer,q.answerLang,phonOf(t,q.answerLang))+'</div>'+
        '<div class="rva">'+wordRow("EN",t.en,"en",phonOf(t,"en"))+' ｜ '+bmRow("",t)+' ｜ '+wordRow("ZH",t.zh,"zh",phonOf(t,"zh"))+' ｜ '+wordRow("TH",t.th,"th",phonOf(t,"th"))+'</div>'+
      '</div>';
    });
  }
  reviewHtml+='</div></div>';
  main.innerHTML='<div class="result"><div class="rcard">'+
    '<div style="font-size:34px">'+emoji+'</div>'+
    '<div class="score">'+score+'<small> / '+total+'</small></div>'+
    '<div class="qprog">正确率 '+pct+'%</div>'+
    '<div class="msg">'+msg+'</div>'+
    reviewHtml+
    '<div class="btns">'+
      '<button class="primary" id="retryBtn">↻ 再来一次</button>'+
      '<button id="backBtn">← 返回单元列表</button>'+
    '</div></div></div>';
  document.getElementById("rvhead").onclick=()=>{ const l=document.getElementById("rvlist"); l.style.display = l.style.display==="none"?"block":"none"; };
  document.getElementById("retryBtn").onclick=()=>startQuiz();
  document.getElementById("backBtn").onclick=()=>{ if(cur && cur.si>=0) openFile(cur.si,cur.fi); else goBack(); };
}

function refreshProgress(){
  const total=flat.length;
  const done=Object.keys(progress).filter(k=>progress[k]&&progress[k].done).length;
  document.getElementById("progTxt").textContent=done+"/"+total;
  if(curSi>=0&&curFi>=0){
    const ul=getUnitlist(); if(!ul) return;
    ul.querySelectorAll(".ucard").forEach(c=>{
      const ui=+c.dataset.ui; const r=progress[uid({si:curSi,fi:curFi,ui})]||{};
      const d=!!r.done;
      c.classList.toggle("done",d);
      const badge=c.querySelector(".badge"); if(badge) badge.textContent=d?"✓ 满分":(r.best!=null?"已测":"未测");
      const mini=c.querySelector(".mini>i"); if(mini) mini.style.width=d?100:0;
    });
  }
}

const overlay=document.getElementById("overlay");
(function(btn){ if(btn) btn.onclick=()=>overlay.classList.remove("show"); })(document.getElementById("closeSettings"));
overlay.onclick=(e)=>{ if(e.target===overlay) overlay.classList.remove("show"); };
document.getElementById("voiceEn").onchange=e=>{settings.en=e.target.value;saveSettings();};
document.getElementById("voiceBm").onchange=e=>{settings.bm=e.target.value;saveSettings();};
document.getElementById("voiceZh").onchange=e=>{settings.zh=e.target.value;saveSettings();};
document.getElementById("rate").oninput=e=>{settings.rate=+e.target.value;document.getElementById("rateTxt").textContent=(+e.target.value).toFixed(1);saveSettings();};
document.getElementById("rate").value=settings.rate; document.getElementById("rateTxt").textContent=(settings.rate||1).toFixed(1);

function toast(msg){
  const t=document.getElementById("toast"); t.textContent=msg; t.classList.add("show");
  clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.remove("show"),2200);
}

/* ===== 自定义词库（共享 tril-lib.js） ===== */
function rebuildIndexes(){
  flat=[]; DATA.stages.forEach((st,si)=>st.files.forEach((f,fi)=>f.units.forEach((u,ui)=>{
    flat.push({stage:st.name,file:f.name,si,fi,ui,title:u.title,type:u.type||"table",langs:u.langs||["en","zh","bm"],entries:u.entries||[]});
  })));
  POOL.en.clear(); POOL.bm.clear(); POOL.zh.clear(); POOL.th.clear();
  flat.forEach(u=>u.entries.forEach(e=>{ const t=makeTriple(u,e); if(t.en) POOL.en.add(t.en); if(t.bm) POOL.bm.add(t.bm); if(t.zh) POOL.zh.add(t.zh); if(t.th) POOL.th.add(t.th); }));
  renderNav();
}
(function(btn){ if(btn) btn.onclick=function(){ if(!window.TrilLib){ toast("自定义词库模块未加载"); return; } TrilLib.openEditor({onSaved:function(){ TrilLib.mergeStages(DATA); rebuildIndexes(); toast("✓ 自定义词库已更新"); }}); }; })(document.getElementById("editLibBtn"));

renderNav();
refreshProgress();
/* 主页链接来的定位：location.hash 含 si / fi 自动 goLevel */
(function applyHash(){
  try{
    const h = location.hash.replace(/^#/,"");
    if(!h) return;
    const p = {};
    h.split("&").forEach(kv => { const [k,v] = kv.split("="); if(k) p[k] = v; });
    const si = parseInt(p.si, 10), fi = parseInt(p.fi, 10);
    if(isNaN(si) || si < 0) return;
    if(!isNaN(fi) && fi >= 0){ goLevel(3, si, fi); return; }
    if(!isNaN(si)){ goLevel(2, si, -1); return; }
  }catch(e){}
})();
/* 首页保持 level 1 学段列表，不自动展开 */

/* ===== 可折叠面板控制（目录 / 例句 / 顶栏），状态持久化 ===== */
function toggleLayout(kind){
  const cls={sidebar:'hide-sidebar',examples:'hide-examples',topbar:'hide-topbar'}[kind];
  if(!cls) return;
  document.body.classList.toggle(cls);
  const on=!document.body.classList.contains(cls);
  document.querySelectorAll('[data-layout="'+kind+'"]').forEach(b=>b.classList.toggle('on',on));
  try{ localStorage.setItem('layout_'+kind, on?'1':'0'); }catch(e){}
}
function applyLayout(){
  ['sidebar','examples','topbar'].forEach(kind=>{
    let v='1'; try{ v=localStorage.getItem('layout_'+kind)||'1'; }catch(e){}
    const on = v!=='0';
    const cls={sidebar:'hide-sidebar',examples:'hide-examples',topbar:'hide-topbar'}[kind];
    document.body.classList.toggle(cls, !on);
    document.querySelectorAll('[data-layout="'+kind+'"]').forEach(b=>b.classList.toggle('on', on));
  });
}
document.querySelectorAll('[data-layout]').forEach(b=>{ b.onclick=()=>toggleLayout(b.dataset.layout); });
applyLayout();

const DATA = window.__TRIL_DATA__;
if(!DATA){
  document.getElementById("bigcard").innerHTML='<div class="empty">⚠ 词库数据未能加载。<br>请确认 <b>三语母语习得核心词库.part1~4.js</b> 与本页面在同一文件夹后重新打开。</div>';
  document.getElementById("idx").textContent="";
} else if(document.readyState==="loading"){
  document.addEventListener("DOMContentLoaded", startApp);
} else {
  startApp();
}

function startApp(){
const LNAME = {en:"🇬🇧 英文 EN", bm:"🇲🇾 马来文 BM", zh:"🇨🇳 中文 ZH", th:"🇹🇭 泰文 TH"};
const LSHORT = {en:"EN", bm:"BM", zh:"ZH", th:"TH"};
var LS_KEY = "tril_player_progress_v1";
var LS_SET = "tril_player_settings_v1";

/* ===== 自定义词库：从 localStorage 读取并合并进导航 ===== */
const LIB_KEY = "tril_custom_units_v1";
function loadCustomStage(){ return TrilLib.loadStage(); }
function saveCustomStage(st){ TrilLib.saveStage(st); }
let customStage = loadCustomStage();
if(customStage.files[0] && customStage.files[0].units.length){
  DATA.stages = DATA.stages.concat([customStage]);
}

/* ===== 播放循环模式 ===== */
let loopMode = "none";        // none | unit | word
let wordLoopLeft = 0;
let wordLoopMax = 3;

/* ===== 扁平化全部单元 ===== */
let units = [];
DATA.stages.forEach((st,si)=>st.files.forEach((f,fi)=>f.units.forEach((u,ui)=>{
  units.push({si,fi,ui,stage:st.name,file:f.name,title:u.title,type:u.type||"table",
    langs:u.langs||["en","bm","zh","th"],entries:u.entries||[],summary:u.summary||"",notes:u.notes||""});
})));
const totalCount = units.reduce((a,u)=>a+(u.entries?u.entries.length:0),0);
const uid = u => u.si+"_"+u.fi+"_"+u.ui;

/* ===== 进度（标记已完成单元） ===== */
let progress = {};
try{ progress = JSON.parse(localStorage.getItem(LS_KEY)||"{}"); }catch(e){ progress={}; }
function saveProgress(){ try{ localStorage.setItem(LS_KEY, JSON.stringify(progress)); }catch(e){} }
function isDone(u){ return !!progress[uid(u)]; }

/* ===== 设置 ===== */
let settings = {rate:1, volume:1, interval:5, mode:"all",
  enabledLangs:{en:true,bm:true,zh:true,th:true}, singleLang:"en", singleMeaning:"zh",
  readExample:true, continuousNext:false, voiceEn:"",voiceBm:"",voiceZh:"",voiceTh:"",
  loopMode:"none", wordLoopMax:3};
try{ Object.assign(settings, JSON.parse(localStorage.getItem(LS_SET)||"{}")); }catch(e){}
if(!settings.enabledLangs) settings.enabledLangs={en:true,bm:true,zh:true,th:true};
function saveSettings(){ try{ localStorage.setItem(LS_SET, JSON.stringify(settings)); }catch(e){} }

/* ===== 语音 ===== */
let voices = [];
function loadVoices(){ voices = window.speechSynthesis ? speechSynthesis.getVoices() : []; fillVoiceSelects(); }
if(window.speechSynthesis){ loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
function showTtsBanner(ok,msg){
  let b=document.getElementById("ttsBanner");
  if(!b){ b=document.createElement("div"); b.id="ttsBanner"; b.className="ttsbanner"; document.body.appendChild(b); }
  if(ok){ b.style.display="none"; return; }
  b.style.display="block";
  b.innerHTML='⚠ <b>语音可能不可用：</b>'+(msg||"当前预览环境未接入系统语音合成引擎。")+
    ' 若听不到声音，请用 <b>Safari</b> 或 <b>Chrome</b> 浏览器打开本文件即可正常朗读。';
}
function testVoice(){
  if(!window.speechSynthesis){ toast("当前环境没有 Web Speech API，请用 Safari/Chrome 打开"); showTtsBanner(false,"当前环境没有 Web Speech API。"); return; }
  try{
    speechSynthesis.cancel(); speechSynthesis.resume();
    const u=new SpeechSynthesisUtterance("Hello, 你好, Selamat pagi, สวัสดี.");
    u.lang="zh-CN"; u.rate=1; u.volume=1;
    let started=false; const t=setTimeout(()=>{ if(!started) toast("⚠ 语音引擎无响应，请改用 Safari/Chrome 打开本文件"); }, 1200);
    u.onstart=()=>{ started=true; clearTimeout(t); toast("🔊 正在发声——若仍听不到请检查音量/静音，或换 Safari/Chrome"); };
    u.onend=()=>{ started=true; clearTimeout(t); };
    u.onerror=()=>{ started=true; clearTimeout(t); toast("❌ 语音合成出错，请改用 Safari/Chrome"); showTtsBanner(false,"语音合成报错。"); };
    speechSynthesis.speak(u);
  }catch(e){ toast("语音初始化失败："+e.message); }
}
if(!window.speechSynthesis){ showTtsBanner(false,"当前环境没有 Web Speech API。"); }
function fillVoiceSelects(){
  const mk=(sel,langPrefix,cur)=>{
    sel.innerHTML="";
    const opts = voices.filter(v=>v.lang && v.lang.toLowerCase().startsWith(langPrefix));
    const all=document.createElement("option"); all.value=""; all.textContent="（自动/默认）"; sel.appendChild(all);
    opts.forEach(v=>{ const o=document.createElement("option"); o.value=v.name; o.textContent=v.name+" ["+v.lang+"]"; sel.appendChild(o); });
    sel.value = cur || (opts[0]?opts[0].name:"");
  };
  mk(document.getElementById("voiceEn"),"en",settings.voiceEn);
  mk(document.getElementById("voiceBm"),"ms",settings.voiceBm);
  mk(document.getElementById("voiceZh"),"zh",settings.voiceZh);
  mk(document.getElementById("voiceTh"),"th",settings.voiceTh);
  const bmNote=document.getElementById("bmNote");
  const hasBm=voices.some(v=>v.lang && v.lang.toLowerCase().startsWith("ms"));
  bmNote.textContent = hasBm ? "✓ 已检测到马来语嗓音" : "⚠ 本设备未安装马来语(ms-MY)嗓音，将回退默认嗓音。";
  const thNote=document.getElementById("thNote"); const hasTh=voices.some(v=>v.lang && v.lang.toLowerCase().startsWith("th"));
  if(thNote){
    if(hasTh){ thNote.className="note ok"; thNote.textContent="✓ 已检测到泰语(th-TH)嗓音，可直接朗读。"; }
    else { thNote.className="note warn"; thNote.innerHTML="⚠ <b>本设备未安装泰语语音包</b>，点击泰文将静音。开启方法：<br>· Windows：设置→语音→添加“泰语”并下载语音包<br>· macOS：辅助功能→朗读内容→系统嗓音→管理嗓音→搜“Thai”下载<br>· 安卓/iOS：安装“Google 文字转语音引擎”下载泰语包"; }
  }
}
function pickVoice(lang){
  const sel = lang==="en"?settings.voiceEn : lang==="bm"?settings.voiceBm : lang==="zh"?settings.voiceZh : settings.voiceTh;
  if(sel){ const v=voices.find(x=>x.name===sel); if(v) return v; }
  const pref = lang==="bm"?"ms":lang==="th"?"th":lang;
  const v = voices.find(x=>x.lang && x.lang.toLowerCase().startsWith(pref));
  return v || null;
}
function speak(text,lang,onend){
  if(!text){ if(onend) onend(); return; }
  const u=new SpeechSynthesisUtterance(text);
  u.lang = lang==="en"?"en-US":lang==="bm"?"ms-MY":lang==="zh"?"zh-CN":"th-TH";
  const sel = lang==="en"?settings.voiceEn : lang==="bm"?settings.voiceBm : lang==="zh"?settings.voiceZh : settings.voiceTh;
  if(sel){ const v=voices.find(x=>x.name===sel); if(v) u.voice=v; }
  u.rate=settings.rate||1; u.volume=(settings.volume!=null)?settings.volume:1;
  u.onend=()=>{ if(onend) onend(); };
  u.onerror=()=>{ if(onend) onend(); };
  try{ speechSynthesis.resume(); }catch(e){}
  speechSynthesis.speak(u);
}

/* ===== 词条标准化（table / root 统一为 en/bm/zh/th 字段） ===== */
function normEntry(u,e){
  if(u.type==="root"){
    const langs=u.langs||["en","zh","bm"];
    const o={en:"",bm:"",zh:"",th:"",en_ipa:e.ipa||"",bm_ipa:"",bm_pron:e.bm_pron||"",th_pron:"",
      example:{},isRoot:true,base:e.base||"",def:e.def||"",phrase:e.phrase||""};
    for(let p=0;p<3;p++){ const L=langs[p], w=e.head[p]||""; if(L==="en")o.en=w; else if(L==="bm")o.bm=w; else if(L==="zh")o.zh=w; else if(L==="th")o.th=w; }
    if(e.example) for(let p=0;p<3;p++){ const L=langs[p], w=e.example[p]||""; if(L==="en")o.example.en=w; else if(L==="bm")o.example.bm=w; else if(L==="zh")o.example.zh=w; else if(L==="th")o.example.th=w; }
    return o;
  }
  const ex={}; ["en","bm","zh","th"].forEach(L=>{ if(e.example&&e.example[L]) ex[L]=e.example[L]; });
  return {en:e.en||"",bm:e.bm||"",zh:e.zh||"",th:e.th||"",
    en_ipa:e.en_ipa||"",bm_ipa:e.bm_ipa||"",bm_pron:e.bm_pron||"",th_pron:e.th_pron||"",example:ex,isRoot:false};
}
function getLang(o,L){ return o[L]||""; }
function escapeHtml(s){return (s||"").replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));}

/* ===== 播放状态 ===== */
let cur=null;          // 当前单元 {si,fi,ui,...}
let curWords=[];       // 当前单元标准化词条
let pos=0;             // 当前词索引
let playing=false;
let playTimer=null;

/* ===== 钻取式目录（学段→文件→单元），懒渲染，避免一次性构建上千按钮 ===== */
const nav=document.getElementById("nav");
let navState={level:1,si:-1,fi:-1,hist:[]};
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
function renderNav(){
  nav.innerHTML="";
  if(navState.level===1){
    const close=document.createElement("button"); close.className="navback"; close.textContent="✕ 关闭目录";
    close.onclick=()=>document.body.classList.remove("show-sidebar-m");
    nav.appendChild(close);
    DATA.stages.forEach((st,si)=>{
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
      const b=document.createElement("button"); b.className="navfile";
      b.innerHTML='▸ '+escapeHtml(f.name)+' <span class="fc">'+f.units.length+'</span>';
      b.onclick=()=>goLevel(3,navState.si,fi);
      nav.appendChild(b);
    });
  } else {
    const st=DATA.stages[navState.si]; const f=st.files[navState.fi];
    nav.appendChild(mkBack("◀ 返回文件"));
    f.units.forEach((u,ui)=>{
      const isRoot=u_isaRoot(u);
      const b=document.createElement("button"); b.className="navfile";
      b.innerHTML=escapeHtml(u.title)+'<span class="rt">'+(isRoot?"🌱":"")+'</span><span class="fc">'+(u.entries?u.entries.length:0)+'</span>';
      b.dataset.si=navState.si; b.dataset.fi=navState.fi; b.dataset.ui=ui;
      b.onclick=()=>loadUnit(navState.si,navState.fi,ui);
      if(cur && cur.si===navState.si && cur.fi===navState.fi && cur.ui===ui) b.classList.add("active");
      nav.appendChild(b);
    });
  }
  const ub=document.getElementById("backBtn");
  if(ub) ub.disabled = navState.hist.length===0;
}
function u_isaRoot(u){ return u.type==="root"; }

/* ===== 加载单元 ===== */
function loadUnit(si,fi,ui){
  const u=units.find(x=>x.si===si&&x.fi===fi&&x.ui===ui);
  if(!u) return;
  cur=u; curWords=(u.entries||[]).map(e=>normEntry(u,e)); pos=0;
  document.querySelectorAll(".navfile").forEach(b=>b.classList.remove("active"));
  const nb=nav.querySelector('.navfile[data-si="'+si+'"][data-fi="'+fi+'"][data-ui="'+ui+'"]');
  if(nb) nb.classList.add("active");
  document.getElementById("unitbar").querySelector(".crumb").innerHTML='<b>'+escapeHtml(u.stage)+'</b> &nbsp;/&nbsp; '+escapeHtml(u.file)+' &nbsp;/&nbsp; '+escapeHtml(u.title)+' &nbsp;·&nbsp; '+curWords.length+' 词';
  document.body.classList.remove("show-sidebar-m");
  stopPlay();
  renderStrip();
  showWord(0,false);
  updateIdx();
}

/* ===== 词进度条 ===== */
function renderStrip(){
  const strip=document.getElementById("wordstrip"); strip.innerHTML="";
  curWords.forEach((w,i)=>{
    const c=document.createElement("div"); c.className="wchip"+(i===pos?" cur":"")+(isDone(cur)?" done":"");
    const t=getLang(w,"en")||getLang(w,"zh")||getLang(w,"bm")||getLang(w,"th")||(i+1);
    c.textContent=(typeof t==="string"&&t.length>4)?(i+1):t;
    c.title=getLang(w,"en")||getLang(w,"zh")||getLang(w,"bm")||getLang(w,"th")||"";
    c.onclick=()=>{ stopPlay(); showWord(i,false); };
    strip.appendChild(c);
  });
}
function updateStrip(){
  const strip=document.getElementById("wordstrip");
  [...strip.children].forEach((c,i)=>{ c.classList.toggle("cur",i===pos); });
}

/* ===== 渲染当前词 ===== */
function showWord(i, autoplay){
  if(!cur) return;
  pos=Math.max(0,Math.min(i,curWords.length-1));
  const w=curWords[pos];
  window.TRIL_CURRENT = w;
  renderCard(w);
  renderExample(w);
  updateStrip(); updateIdx();
  if(autoplay && playing){ if(loopMode==="word") wordLoopLeft=wordLoopMax; speakWord(w, ()=>afterWord()); }
}
function renderCard(w){
  const card=document.getElementById("bigcard");
  let html="";
  if(settings.mode==="single"){
    const L=settings.singleLang; const txt=getLang(w,L);
    html+='<div class="single" id="singleCard">';
    html+='<div class="slang">'+LSHORT[L]+' 单语</div>';
    html+='<div class="sword">'+escapeHtml(txt||"—")+'</div>';
    if(L==="en"&&w.en_ipa) html+='<div class="sipa">'+escapeHtml(w.en_ipa)+'</div>';
    if(L==="bm"){ if(w.bm_ipa) html+='<div class="sipa">'+escapeHtml(w.bm_ipa)+'</div>'; if(w.bm_pron) html+='<div class="spron">中文音译：'+escapeHtml(w.bm_pron)+'</div>'; }
    if(L==="th"&&w.th_pron) html+='<div class="spron">'+escapeHtml(w.th_pron)+'</div>';
    if(settings.singleMeaning==="zh" && L!=="zh" && w.zh){ html+='<div class="smean"><b>中文释义</b>'+escapeHtml(w.zh)+'</div>'; html+=TrilPinyin.html(w.zh); }
    if(settings.singleMeaning==="bm" && L!=="bm" && w.bm) html+='<div class="smean"><b>马来文释义</b>'+escapeHtml(w.bm)+'</div>';
    if(w.isRoot && (w.base||w.def||w.phrase)){
      html+='<div class="smean" style="border-top-style:solid">';
      if(w.base) html+='<b>词根</b>'+escapeHtml(w.base)+'<br>';
      if(w.def) html+='<b>释义</b>'+escapeHtml(w.def)+'<br>';
      if(w.phrase) html+='<b>短语</b>'+escapeHtml(w.phrase);
      html+='</div>';
    }
    html+='</div>';
  } else {
    ["en","bm","zh","th"].forEach(L=>{
      if(!settings.enabledLangs[L]) return;
      const txt=getLang(w,L);
      if(!txt && !(L==="bm"&&w.bm_pron)) return; /* 跳过无内容的语种（如词根单元无泰文） */
      html+='<div class="wrow" data-lang="'+L+'">';
      html+='<div class="wlabel">'+LNAME[L]+' · 🔊点击朗读</div>';
      html+='<div class="wtext">'+escapeHtml(txt||"—")+'</div>';
      if(L==="zh"&&txt) html+=TrilPinyin.html(txt);
      if(L==="en"&&w.en_ipa) html+='<div class="wipa">'+escapeHtml(w.en_ipa)+'</div>';
      if(L==="bm"){ if(w.bm_ipa) html+='<div class="wipa">'+escapeHtml(w.bm_ipa)+'</div>'; if(w.bm_pron) html+='<div class="spron">中文音译：'+escapeHtml(w.bm_pron)+'</div>'; }
      if(L==="th"&&w.th_pron) html+='<div class="spron">'+escapeHtml(w.th_pron)+'</div>';
      html+='</div>';
    });
    if(!html) html='<div class="empty">该模式下所有语言均被屏蔽，请在控制面板勾选至少一种语言。</div>';
  }
  card.innerHTML=html;
  /* 点击单词卡片：单独朗读对应语种发音，并高亮，交互清晰 */
  card.querySelectorAll('.wrow').forEach(r=>{
    r.style.cursor='pointer';
    r.onclick=()=>{ stopPlay(); const L=r.dataset.lang; speak(getLang(w,L),L); highlightLang(L); };
  });
  const sc=card.querySelector('.single');
  if(sc){
    sc.style.cursor='pointer';
    sc.onclick=()=>{ stopPlay(); const L=settings.singleLang; speak(getLang(w,L),L); highlightLang(L); };
  }
}
function renderExample(w){
  const body=document.getElementById("exbody");
  const ex=w.example||{};
  const langs=["en","bm","zh","th"].filter(L=>ex[L]);
  if(!langs.length){ body.innerHTML='<div class="exempty">— 本词暂无例句 —</div>'; return; }
  body.innerHTML=langs.map(L=>{ var d='<div class="exline ex-'+L+'" data-text="'+escapeHtml(ex[L])+'" data-lang="'+L+'"><span class="flag">'+LSHORT[L]+'</span>'+escapeHtml(ex[L])+'</div>'; if(L==="zh") d+=TrilPinyin.html(ex[L]); return d; }).join("");
  body.querySelectorAll(".exline").forEach(sp=>sp.onclick=()=>{ stopPlay(); speak(sp.dataset.text, sp.dataset.lang); });
}
function updateIdx(){
  const el=document.getElementById("idx");
  if(!cur){ el.textContent=""; return; }
  el.textContent=(pos+1)+" / "+curWords.length;
}

/* ===== 构建并朗读当前词的语音序列 ===== */
function buildSteps(w){
  const steps=[];
  if(settings.mode==="single"){
    const L=settings.singleLang;
    if(getLang(w,L)) steps.push({lang:L,text:getLang(w,L)});
    if(settings.readExample && w.example && w.example[L]) steps.push({lang:L,text:w.example[L]});
    return steps;
  }
  ["en","bm","zh","th"].forEach(L=>{
    if(!settings.enabledLangs[L]) return;
    if(getLang(w,L)) steps.push({lang:L,text:getLang(w,L)});
  });
  if(settings.readExample && w.example){
    ["en","bm","zh","th"].forEach(L=>{
      if(!settings.enabledLangs[L]) return;
      if(w.example[L]) steps.push({lang:L,text:w.example[L]});
    });
  }
  return steps;
}
function speakWord(w, onDone){
  const steps=buildSteps(w);
  let k=0;
  function step(){
    if(!playing){ if(onDone) onDone(); return; }
    if(k>=steps.length){ if(onDone) onDone(); return; }
    const s=steps[k++];
    if(!s.text){ step(); return; }
    highlightLang(s.lang);
    speak(s.text, s.lang, ()=> setTimeout(step, Math.max(60, 300)) );
  }
  step();
}
function highlightLang(L){
  const card=document.getElementById("bigcard");
  card.querySelectorAll(".wrow,.single").forEach(c=>c.classList.remove("speak-en","speak-bm","speak-zh","speak-th"));
  if(settings.mode==="single"){
    const sc=document.getElementById("singleCard"); if(sc) sc.classList.add("speak-"+L);
  } else {
    const row=card.querySelector('.wrow[data-lang="'+L+'"]'); if(row) row.classList.add("speak-"+L);
  }
}
function afterWord(){
  if(!playing) return;
  /* 单词循环：重复朗读当前词，达到次数后再前进 */
  if(loopMode==="word" && wordLoopLeft>1){
    wordLoopLeft--;
    playTimer=setTimeout(()=>{ if(playing) showWord(pos, true); }, (settings.interval||2)*1000);
    return;
  }
  if(pos < curWords.length-1){
    playTimer=setTimeout(()=>{ if(playing) showWord(pos+1, true); }, (settings.interval||5)*1000);
  } else {
    /* 单元循环：播完最后一词后回到开头继续 */
    if(loopMode==="unit"){
      pos=0;
      playTimer=setTimeout(()=>{ if(playing) showWord(0, true); }, (settings.interval||3)*1000);
    } else {
      finishUnit();
    }
  }
}
function finishUnit(){
  playing=false; clearHighlight();
  setPlayLabel("▶ 重新播放");
  renderStrip();
  if(cur && !isDone(cur)){ progress[uid(cur)]=1; saveProgress(); toast("✓ 本单元播放完成，已标记"); }
  if(settings.continuousNext && cur){
    const idx=units.indexOf(cur);
    if(idx>=0 && idx<units.length-1){ toast("自动播放下一单元…"); setTimeout(()=>{ const n=units[idx+1]; loadUnit(n.si,n.fi,n.ui); togglePlay(); }, 600); }
    else { toast("已是最后一个单元"); }
  }
}
function clearHighlight(){
  const card=document.getElementById("bigcard");
  card.querySelectorAll(".wrow,.single").forEach(c=>c.classList.remove("speak-en","speak-bm","speak-zh","speak-th"));
}

/* ===== 播放控制 ===== */
function togglePlay(){
  if(playing){ doPause(); return; }
  if(!cur){ toast("请先在左侧选择一个单元"); return; }
  if(!window.speechSynthesis){ toast("当前浏览器不支持语音合成"); return; }
  try{ speechSynthesis.cancel(); }catch(e){}
  playing=true; setPlayLabel("⏸ 暂停");
  if(pos>=curWords.length-1) pos=0; /* 已到末尾则从头重新播放 */
  showWord(pos, true);
}
function doPause(){
  playing=false; clearTimeout(playTimer);
  try{ speechSynthesis.cancel(); }catch(e){}
  setPlayLabel("▶ 继续");
}
function stopPlay(){
  playing=false; clearTimeout(playTimer);
  try{ speechSynthesis.cancel(); }catch(e){}
  setPlayLabel("▶ 播放");
}
function nextWord(){ if(!cur) return; stopPlay(); showWord(Math.min(pos+1,curWords.length-1),false); updateIdx(); }
function prevWord(){ if(!cur) return; stopPlay(); showWord(Math.max(pos-1,0),false); updateIdx(); }

document.getElementById("playBtn").onclick=togglePlay;
document.getElementById("nextBtn").onclick=nextWord;
document.getElementById("prevBtn").onclick=prevWord;
const fab=document.getElementById("fab"); if(fab) fab.onclick=togglePlay;
function setPlayLabel(t){ const pb=document.getElementById("playBtn"); if(pb) pb.textContent=t; if(fab) fab.textContent=(t==="⏸ 暂停")?"⏸":"▶"; }
const backBtn=document.getElementById("backBtn"); if(backBtn) backBtn.onclick=navBack;

/* ===== 控制面板交互 ===== */
document.getElementById("interval").oninput=e=>{ settings.interval=+e.target.value; document.getElementById("intervalTxt").textContent=settings.interval; saveSettings(); };
document.getElementById("rate").oninput=e=>{ settings.rate=+e.target.value; document.getElementById("rateTxt").textContent=(+e.target.value).toFixed(1); saveSettings(); };
document.getElementById("vol").oninput=e=>{ settings.volume=+e.target.value; document.getElementById("volTxt").textContent=Math.round(+e.target.value*100); saveSettings(); };
document.getElementById("readExample").onchange=e=>{ settings.readExample=e.target.checked; saveSettings(); };
document.getElementById("continuousNext").onchange=e=>{ settings.continuousNext=e.target.checked; saveSettings(); };

function setMode(m){
  settings.mode=m; saveSettings();
  document.getElementById("modeAll").classList.toggle("on", m==="all");
  document.getElementById("modeSingle").classList.toggle("on", m==="single");
  document.getElementById("langBlock").style.display = m==="all"?"flex":"none";
  document.getElementById("langSingle").style.display = m==="single"?"flex":"none";
  if(cur) showWord(pos,false);
}
document.getElementById("modeAll").onclick=()=>setMode("all");
document.getElementById("modeSingle").onclick=()=>setMode("single");
document.querySelectorAll('#langBlock input[type=checkbox]').forEach(c=>{
  c.checked=settings.enabledLangs[c.dataset.lang];
  c.onchange=()=>{ settings.enabledLangs[c.dataset.lang]=c.checked; saveSettings(); if(cur) showWord(pos,false); };
});
document.getElementById("singleLang").onchange=e=>{ settings.singleLang=e.target.value; saveSettings(); if(cur) showWord(pos,false); };
document.getElementById("singleMeaning").onchange=e=>{ settings.singleMeaning=e.target.value; saveSettings(); if(cur) showWord(pos,false); };

/* ===== 循环模式（单元循环 / 单词循环，可切换高亮） ===== */
function setLoop(m){
  loopMode = (loopMode===m) ? "none" : m;
  document.getElementById("loopUnit").classList.toggle("on", loopMode==="unit");
  document.getElementById("loopWord").classList.toggle("on", loopMode==="word");
  document.getElementById("wordLoopBox").style.display = loopMode==="word" ? "flex" : "none";
  document.getElementById("loopHint").textContent = "当前：" + (loopMode==="unit"?"单元循环":loopMode==="word"?"单词循环（"+wordLoopMax+"次）":"不循环");
  settings.loopMode = loopMode; saveSettings();
}
document.getElementById("loopUnit").onclick=()=>setLoop("unit");
document.getElementById("loopWord").onclick=()=>setLoop("word");
document.getElementById("wordLoopCount").oninput=e=>{
  wordLoopMax=+e.target.value;
  document.getElementById("wordLoopCountTxt").textContent=wordLoopMax;
  if(loopMode==="word") document.getElementById("loopHint").textContent="当前：单词循环（"+wordLoopMax+"次）";
  settings.wordLoopMax=wordLoopMax; saveSettings();
};
/* 从设置恢复循环状态 */
loopMode = settings.loopMode || "none";
wordLoopMax = settings.wordLoopMax || 3;
document.getElementById("loopUnit").classList.toggle("on", loopMode==="unit");
document.getElementById("loopWord").classList.toggle("on", loopMode==="word");
document.getElementById("wordLoopBox").style.display = loopMode==="word" ? "flex" : "none";
document.getElementById("wordLoopCount").value = wordLoopMax;
document.getElementById("wordLoopCountTxt").textContent = wordLoopMax;
document.getElementById("loopHint").textContent = "当前：" + (loopMode==="unit"?"单元循环":loopMode==="word"?"单词循环（"+wordLoopMax+"次）":"不循环");

/* ===== AI 生成情景句（当前词） ===== */
document.getElementById("aiSentenceBtn").onclick=function(){
  if(!window.TrilAI){ toast("AI 模块未加载"); return; }
  if(!window.TRIL_CURRENT || !(window.TRIL_CURRENT.en||window.TRIL_CURRENT.zh)){ toast("请先选择一个单词"); return; }
  window.TrilAI.openWithWord(window.TRIL_CURRENT);
};

/* ===== 自定义词库编辑器 ===== */
const libOverlay=document.getElementById("libOverlay");
let libDraft=[];
function updateLibPreview(){
  const pv=document.getElementById("libPreview");
  if(!libDraft.length){ pv.textContent="（尚未添加词条，可逐条加入）"; return; }
  pv.innerHTML=libDraft.map((w,i)=>(i+1)+". "+(w.en||"")+(w.zh&&w.en?" / ":"")+(w.zh||"")+(w.bm?" · BM:"+w.bm:"")+(w.th?" · TH:"+w.th:"")).join("<br>");
}
document.getElementById("editLibBtn").onclick=()=>{ libOverlay.classList.add("show"); updateLibPreview(); };
(function(b){ if(b) b.onclick=()=>libOverlay.classList.remove("show"); })(document.getElementById("libClose"));
libOverlay.onclick=(e)=>{ if(e.target===libOverlay) libOverlay.classList.remove("show"); };
document.getElementById("libAdd").onclick=()=>{
  const en=document.getElementById("libEn").value.trim();
  const zh=document.getElementById("libZh").value.trim();
  if(!en && !zh){ toast("至少填写「英文」或「中文」"); return; }
  libDraft.push({en:en, zh:zh, bm:document.getElementById("libBm").value.trim(), th:document.getElementById("libTh").value.trim(),
    example:document.getElementById("libEx").value.trim()?{zh:document.getElementById("libEx").value.trim()}:{}});
  ["libEn","libZh","libBm","libTh","libEx"].forEach(id=>document.getElementById(id).value="");
  document.getElementById("libEn").focus();
  updateLibPreview(); toast("已加入，可继续添加");
};
function rebuildUnits(){
  units=[];
  DATA.stages.forEach((st,si)=>st.files.forEach((f,fi)=>f.units.forEach((u,ui)=>{
    units.push({si,fi,ui,stage:st.name,file:f.name,title:u.title,type:u.type||"table",
      langs:u.langs||["en","bm","zh","th"],entries:u.entries||[],summary:u.summary||"",notes:u.notes||""});
  })));
}
document.getElementById("libSave").onclick=()=>{
  const title=document.getElementById("libUnitTitle").value.trim()||("自定义单元 "+new Date().toLocaleDateString());
  if(!libDraft.length){ toast("请先添加至少一条词条"); return; }
  if(!customStage) customStage=loadCustomStage();
  customStage.files[0].units.push({title:title, type:"table", langs:["en","bm","zh","th"],
    entries:libDraft.map(d=>({en:d.en,bm:d.bm,zh:d.zh,th:d.th,example:d.example})), summary:"", notes:""});
  saveCustomStage(customStage);
  DATA.stages=DATA.stages.filter(s=>s!==customStage); DATA.stages=DATA.stages.concat([customStage]);
  rebuildUnits(); libDraft=[]; updateLibPreview(); renderNav();
  libOverlay.classList.remove("show");
  toast("✓ 已保存「"+title+"」，可在目录「📁 我的自定义词库」中找到");
};
document.getElementById("libClear").onclick=()=>{
  if(!window.confirm("确定清空整个自定义词库？此操作不可恢复。")) return;
  customStage=loadCustomStage(); customStage.files[0].units=[]; saveCustomStage(customStage);
  DATA.stages=DATA.stages.filter(s=>s.name!=="📁 我的自定义词库");
  rebuildUnits(); renderNav(); toast("已清空自定义词库");
};

/* ===== 设置弹窗 ===== */
const overlay=document.getElementById("overlay");
(function(btn){ if(btn) btn.onclick=()=>overlay.classList.remove("show"); })(document.getElementById("closeSettings"));
overlay.onclick=(e)=>{ if(e.target===overlay) overlay.classList.remove("show"); };
document.getElementById("voiceEn").onchange=e=>{settings.voiceEn=e.target.value;saveSettings();};
document.getElementById("voiceBm").onchange=e=>{settings.voiceBm=e.target.value;saveSettings();};
document.getElementById("voiceZh").onchange=e=>{settings.voiceZh=e.target.value;saveSettings();};
document.getElementById("voiceTh").onchange=e=>{settings.voiceTh=e.target.value;saveSettings();};
document.getElementById("testTh").onclick=()=>{
  if(!window.speechSynthesis){ toast("当前环境无 Web Speech API，请用 Safari/Chrome 打开"); return; }
  speechSynthesis.cancel(); speechSynthesis.resume();
  const u=new SpeechSynthesisUtterance("สวัสดี สบายดีไหม วันนี้อากาศดี");
  u.lang="th-TH"; const v=pickVoice("th"); if(v) u.voice=v; u.rate=1;
  u.onerror=()=>toast("❌ 泰语合成失败：本设备可能未安装泰语语音包");
  speechSynthesis.speak(u);
};
/* 初始化控件值 */
document.getElementById("interval").value=settings.interval; document.getElementById("intervalTxt").textContent=settings.interval;
document.getElementById("rate").value=settings.rate; document.getElementById("rateTxt").textContent=(settings.rate||1).toFixed(1);
document.getElementById("vol").value=(settings.volume!=null?settings.volume:1); document.getElementById("volTxt").textContent=Math.round((settings.volume!=null?settings.volume:1)*100);
document.getElementById("readExample").checked=settings.readExample;
document.getElementById("continuousNext").checked=settings.continuousNext;
document.getElementById("singleLang").value=settings.singleLang;
document.getElementById("singleMeaning").value=settings.singleMeaning;
setMode(settings.mode);

/* ===== 键盘 ===== */
document.addEventListener("keydown",e=>{
  if(overlay.classList.contains("show")) return;
  if(e.code==="Space" && cur && document.activeElement.tagName!=="SELECT" && document.activeElement.type!=="range"){
    e.preventDefault(); togglePlay();
  }else if(e.code==="ArrowRight" && cur){ e.preventDefault(); nextWord(); }
  else if(e.code==="ArrowLeft" && cur){ e.preventDefault(); prevWord(); }
  else if(e.code==="Escape" && cur){ stopPlay(); document.body.classList.remove("show-sidebar-m"); }
});

/* ===== 可折叠面板（目录 / 例句 / 顶栏 / 控制面板），状态持久化 ===== */
function toggleLayout(kind){
  if(kind==="sidebar"){
    if(window.innerWidth<=820){ document.body.classList.toggle("show-sidebar-m"); const on=document.body.classList.contains("show-sidebar-m");
      document.querySelectorAll('[data-layout="sidebar"]').forEach(b=>b.classList.toggle("on",on)); try{localStorage.setItem("pl_layout_sidebar",on?"1":"0");}catch(e){} return; }
    document.body.classList.toggle("hide-sidebar"); const on=!document.body.classList.contains("hide-sidebar");
    document.querySelectorAll('[data-layout="sidebar"]').forEach(b=>b.classList.toggle("on",on)); try{localStorage.setItem("pl_layout_sidebar",on?"1":"0");}catch(e){}
  } else if(kind==="controls"){
    document.body.classList.toggle("hide-controls");
    const on=!document.body.classList.contains("hide-controls");
    document.querySelectorAll('[data-layout="controls"]').forEach(b=>b.classList.toggle("on",on));
    try{ localStorage.setItem("pl_layout_controls", on?"1":"0"); }catch(e){}
  } else {
    const cls={examples:"hide-examples",topbar:"hide-topbar"}[kind]; if(!cls) return;
    document.body.classList.toggle(cls);
    const on=!document.body.classList.contains(cls);
    document.querySelectorAll('[data-layout="'+kind+'"]').forEach(b=>b.classList.toggle("on",on));
    try{ localStorage.setItem("pl_layout_"+kind, on?"1":"0"); }catch(e){}
  }
}
function applyLayout(){
  ["sidebar","examples","topbar","controls"].forEach(kind=>{
    let v="1"; try{ v=localStorage.getItem("pl_layout_"+kind)||"1"; }catch(e){}
    const on=v!=="0";
    if(kind==="sidebar"){ document.body.classList.toggle("hide-sidebar",!on); document.body.classList.toggle("show-sidebar-m",false);
      document.querySelectorAll('[data-layout="sidebar"]').forEach(b=>b.classList.toggle("on",on)); }
    else if(kind==="controls"){ document.body.classList.toggle("hide-controls",!on);
      document.querySelectorAll('[data-layout="controls"]').forEach(b=>b.classList.toggle("on",on)); }
    else { const cls={examples:"hide-examples",topbar:"hide-topbar"}[kind]; document.body.classList.toggle(cls,!on);
      document.querySelectorAll('[data-layout="'+kind+'"]').forEach(b=>b.classList.toggle("on",on)); }
  });
}
document.querySelectorAll('[data-layout]').forEach(b=>{ b.onclick=()=>toggleLayout(b.dataset.layout); });
document.getElementById("navBackdrop").onclick=()=>document.body.classList.remove("show-sidebar-m");
applyLayout();

function toast(msg){
  const t=document.getElementById("toast"); t.textContent=msg; t.classList.add("show");
  clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.remove("show"),2200);
}

function showWelcome(){
  const card=document.getElementById("bigcard");
  if(cur) return;
  card.innerHTML='<div class="empty">🔊 四语单词快速播放器<br>覆盖学习器全部单元（'+units.length+' 单元 / '+totalCount+' 词）<br>从左侧选择 <b>学段 → 文件 → 单元</b> 即可开始逐词朗读</div>';
}

/* 供 auth-client 返回键逐级回退： unit -> file list -> selection */
window.TrilAppBack = function(){
  if(cur){ cur=null; curWords=[]; pos=0; stopPlay(); showWelcome(); updateIdx(); renderStrip(); document.getElementById("unitbar").querySelector(".crumb").innerHTML='← 从左侧选择 学段 / 文件 / 单元 开始'; return true; }
  if(navState.hist.length){ navBack(); return true; }
  return false;
};

requestAnimationFrame(()=>{
  renderNav();
  /* 主页链接来的定位 */
  try{
    const h = location.hash.replace(/^#/,"");
    if(h){
      const p = {};
      h.split("&").forEach(kv => { const [k,v] = kv.split("="); if(k) p[k] = v; });
      const si = parseInt(p.si, 10), fi = parseInt(p.fi, 10);
      if(!isNaN(si) && si >= 0){
        if(!isNaN(fi) && fi >= 0){ goLevel(3, si, fi); }
        else { goLevel(2, si, -1); }
      }
    }
  }catch(e){}
  showWelcome();
});
}

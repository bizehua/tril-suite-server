const DATA = window.__TRIL_DATA__;
const LS_KEY = "tril_flash_mastery_v1";
const LS_SET = "tril_flash_settings_v1";

const LANGS=[
  {k:"en",label:"英文",short:"EN",cls:"l-en",color:"#5b8cff"},
  {k:"bm",label:"马来文",short:"BM",cls:"l-bm",color:"#ffb454"},
  {k:"zh",label:"中文",short:"ZH",cls:"l-zh",color:"#4fd1a5"},
  {k:"th",label:"泰文",short:"TH",cls:"l-th",color:"#c792ea"}
];
const langMeta = k => LANGS.find(l=>l.k===k) || LANGS[0];

/* ===== 具象词用真实照片（AI 生成），非具象词用象征性 emoji 图标 ===== */
/* 照片映射：英文/马来文/中文/泰文小写键 → 相对图片路径（照片集中放在 imgs/ 目录） */
const IMG_MAP={
  'apple':'imgs/apple.png','苹果':'imgs/apple.png',
  'water':'imgs/water.png','水':'imgs/water.png',
  'sun':'imgs/sun.png','太阳':'imgs/sun.png',
  'moon':'imgs/moon.png','月亮':'imgs/moon.png',
  'tree':'imgs/tree.png','树':'imgs/tree.png',
  'flower':'imgs/flower.png','花':'imgs/flower.png',
  'fish':'imgs/fish.png','鱼':'imgs/fish.png',
  'dog':'imgs/dog.png','狗':'imgs/dog.png',
  'cat':'imgs/cat.png','猫':'imgs/cat.png',
  'cow':'imgs/cow.png','牛':'imgs/cow.png',
  'rice':'imgs/rice.png','米饭':'imgs/rice.png',
  'egg':'imgs/egg.png','蛋':'imgs/egg.png',
  'bread':'imgs/bread.png','面包':'imgs/bread.png',
  'book':'imgs/book.png','书':'imgs/book.png',
  'door':'imgs/door.png','门':'imgs/door.png',
  'house':'imgs/house.png','房子':'imgs/house.png'
};
const PIC={
  apple:'🍎',water:'💧',fire:'🔥',sun:'☀️',moon:'🌙',star:'⭐',tree:'🌳',flower:'🌸',grass:'🌿',fish:'🐟',bird:'🐦',dog:'🐶',cat:'🐱',cow:'🐄',pig:'🐖',chicken:'🐔',horse:'🐴',sheep:'🐑',duck:'🦆',rice:'🍚',egg:'🥚',bread:'🍞',meat:'🥩',salt:'🧂',sugar:'🍬',milk:'🥛',tea:'🍵',coffee:'☕',book:'📖',pen:'🖊️',pencil:'✏️',paper:'📄',door:'🚪',window:'🪟',house:'🏠',car:'🚗',bus:'🚌',bike:'🚲',boat:'⛵',ship:'🚢',train:'🚆',plane:'✈️',road:'🛣️',mountain:'⛰️',hill:'🏔️',river:'🌊',sea:'🌊',lake:'🏞️',rain:'🌧️',snow:'❄️',wind:'🌬️',hand:'✋',arm:'💪',leg:'🦵',foot:'🦶',head:'🤕',eye:'👁️',ear:'👂',nose:'👃',mouth:'👄',tooth:'🦷',heart:'❤️',blood:'🩸',bone:'🦴',doctor:'👨‍⚕️',nurse:'👩‍⚕️',teacher:'👩‍🏫',student:'🧑‍🎓',worker:'👷',farmer:'👨‍🌾',helmet:'⛑️',hat:'🧢',shoe:'👟',shirt:'👕',tool:'🔧',hammer:'🔨',knife:'🔪',key:'🔑',lock:'🔒',phone:'📱',computer:'💻',tv:'📺',light:'💡',lamp:'💡',chair:'🪑',table:'🛋️',bed:'🛏️',school:'🏫',hospital:'🏥',factory:'🏭',shop:'🏪',store:'🏪',market:'🛒',money:'💰',coin:'🪙',bank:'🏦',time:'⏰',clock:'🕐',watch:'⌚',day:'🌞',night:'🌜',red:'🔴',green:'🟢',blue:'🔵',yellow:'🟡',black:'⚫',white:'⚪',orange:'🟠',big:'🔺',small:'🔻',tall:'📏',fast:'⚡',slow:'🐢',hot:'🔥',cold:'🧊',new:'🆕',old:'📜',good:'👍',bad:'👎',happy:'😊',sad:'😢',angry:'😠',love:'❤️',hate:'💢',eat:'🍽️',drink:'🥤',run:'🏃',walk:'🚶',read:'📖',write:'✍️',speak:'🗣️',listen:'👂',see:'👀',think:'💭',know:'🧠',learn:'📚',idea:'💡',question:'❓',answer:'💡',word:'🔤',language:'🗣️',number:'🔢',letter:'🔠',name:'🏷️',man:'👨',woman:'👩',child:'🧒',baby:'👶',friend:'🤝',family:'👪',city:'🏙️',country:'🏞️',world:'🌍',earth:'🌍',sky:'🌌',cloud:'☁️',stone:'🪨',wood:'🪵',iron:'⚙️',steel:'🏗️',metal:'🔩',wheel:'⚙️',color:'🎨',music:'🎵',song:'🎶',job:'💼',work:'🛠️',rest:'😴',sleep:'🛌',food:'🍱',fruit:'🍎',vegetable:'🥦',animal:'🐾',plant:'🌱',leaf:'🍃',flower2:'🌺',money2:'💵',price:'🏷️',gate:'🚪',bridge:'🌉',box:'📦',bag:'🎒',cup:'☕',bowl:'🥣',plate:'🍽️',fork:'🍴',spoon:'🥄',engine:'🛠️',machine:'🏭',pipe:'💧',wire:'🔌',electric:'⚡',power:'🔋',oil:'🛢️',gas:'⛽',cement:'🧱',brick:'🧱',wall:'🧱',roof:'🏠',floor:'🪵',clean:'🧹',dirty:'🪣',wash:'🚿',cook:'🍳',build:'🏗️',cut:'✂️',strong:'💪',weak:'🥀',rich:'💰',poor:'🪙',healthy:'💪',sick:'🤒',safe:'🛡️',danger:'⚠️'
};
function picFor(e){
  if(!e) return null;
  if(e.img) return {type:'img',src:e.img};
  var keys=[e.en,e.bm,e.zh,e.th].map(function(s){return (s||'').toLowerCase().trim();});
  for(var i=0;i<keys.length;i++){ if(IMG_MAP[keys[i]]) return {type:'img',src:IMG_MAP[keys[i]]}; }
  for(var i=0;i<keys.length;i++){ if(PIC[keys[i]]) return {type:'emoji',ch:PIC[keys[i]]}; }
  return null;
}
function picHtmlBig(e){ var p=picFor(e); if(!p) return ''; if(p.type==='img'){ var png=p.src; var webp=p.src.replace(/\.png$/,'.webp'); return '<div class="pic-front"><picture><source srcset="'+escapeHtml(webp)+'" type="image/webp"><img src="'+escapeHtml(png)+'" alt=""></picture></div>'; } return '<div class="pic-front">'+p.ch+'</div>'; }

/* ===== 设置（持久化） ===== */
let settings = {frontLang:"en", backMode:"all", backLang:"zh", backTwo:["en","zh"], showIpa:true, showExample:true,
  autoRead:true, shuffle:false, skipMastered:false, autoAdvance:true,
  voice:{en:"",bm:"",zh:"",th:""}, rate:1, gap:350, volume:1};
try{ Object.assign(settings, JSON.parse(localStorage.getItem(LS_SET)||"{}")); }catch(e){}
function saveSettings(){ try{ localStorage.setItem(LS_SET, JSON.stringify(settings)); }catch(e){} }
function computeBackLangs(){
  if(settings.backMode==="four") return LANGS.map(l=>l.k);
  if(settings.backMode==="all") return LANGS.filter(l=>l.k!==settings.frontLang).map(l=>l.k);
  if(settings.backMode==="two") return (settings.backTwo||[]).filter(k=>LANGS.some(l=>l.k===k));
  return [settings.backLang];
}

/* ===== 掌握度（持久化） ===== */
let mastery = {};
try{ mastery = JSON.parse(localStorage.getItem(LS_KEY)||"{}")||{}; }catch(e){ mastery={}; }
function saveMastery(){ try{ localStorage.setItem(LS_KEY, JSON.stringify(mastery)); }catch(e){} }
function mkKey(e){ return (e.en||"")+"|"+(e.bm||"")+"|"+(e.zh||"")+"|"+(e.th||""); }
function mkey(u,e){ return uid(u)+"#"+mkKey(e); }
function getMaster(u,e){ return mastery[mkey(u,e)] || ""; }
function setMaster(u,e,lv){ mastery[mkey(u,e)] = lv; saveMastery(); }

/* ===== 扁平单元索引 ===== */
let flat = [];
if(window.TrilLib) TrilLib.mergeStages(DATA);
DATA.stages.forEach((st,si)=>st.files.forEach((f,fi)=>f.units.forEach((u,ui)=>{
  flat.push({stage:st.name,file:f.name,si,fi,ui,title:u.title,type:u.type||"table",
    langs:u.langs||["en","zh","bm","th"],entries:u.entries,summary:u.summary||"",notes:u.notes||""});
})));
const uid = u => u.si+"_"+u.fi+"_"+u.ui;

/* ===== 语音 ===== */
let voices=[];
function loadVoices(){ voices = window.speechSynthesis ? speechSynthesis.getVoices() : []; }
if(window.speechSynthesis){ loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
function speak(text,lang,onend){
  if(!text){ if(onend) onend(); return; }
  if(!window.speechSynthesis){ toast("当前环境不支持语音合成，请用 Safari/Chrome 打开"); return; }
  const u=new SpeechSynthesisUtterance(text);
  u.lang = lang==="en"?"en-US":lang==="bm"?"ms-MY":lang==="zh"?"zh-CN":"th-TH";
  const sel = settings.voice[lang];
  if(sel){ const v=voices.find(x=>x.name===sel); if(v) u.voice=v; }
  u.rate=settings.rate||1; u.volume=(settings.volume!=null)?settings.volume:1;
  u.onend=()=>{ if(onend) onend(); };
  u.onerror=()=>{ if(onend) onend(); };
  try{ speechSynthesis.resume(); }catch(e){}
  speechSynthesis.speak(u);
}

/* ===== 提示横幅（部分环境无 TTS） ===== */
function showTtsBanner(ok){
  let b=document.getElementById("ttsBanner");
  if(!b){ b=document.createElement("div"); b.id="ttsBanner"; b.className="ttsbanner"; document.body.appendChild(b); }
  if(ok){ b.style.display="none"; return; }
  b.style.display="block";
  b.innerHTML='⚠ <b>语音可能不可用：</b>当前预览环境未接入系统语音合成引擎。若听不到声音，请用 <b>Safari</b> 或 <b>Chrome</b> 浏览器打开本文件即可正常朗读。';
}
if(!window.speechSynthesis) showTtsBanner(false);

/* ===== 钻取式目录（学段→文件→单元），与播放器一致 ===== */
const nav = document.getElementById("nav");
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
      const b=document.createElement("button"); b.className="navfile";
      b.innerHTML='▸ '+escapeHtml(f.name)+' <span class="fc">'+f.units.length+'</span>';
      b.onclick=()=>goLevel(3,navState.si,fi);
      nav.appendChild(b);
    });
  } else {
    const st=DATA.stages[navState.si]; const f=st.files[navState.fi];
    nav.appendChild(mkBack("◀ 返回文件"));
    f.units.forEach((u,ui)=>{
      const d=isDone({si:navState.si,fi:navState.fi,ui});
      const cnt=(u.entries?u.entries.length:0)+" 张卡片";
      const badge=d?' ✓':'·';
      const b=document.createElement("button"); b.className="navunit";
      b.innerHTML=badge+' '+escapeHtml(u.title||"")+' <span class="fc">'+cnt+'</span>';
      if(cur && cur.si===navState.si && cur.fi===navState.fi && cur.ui===ui) b.classList.add("active");
      b.onclick=()=>startStudy(navState.si,navState.fi,ui);
      nav.appendChild(b);
    });
  }
}
function getUnitlist(){ return document.getElementById("unitlist"); }
let curSi=-1,curFi=-1;
function openFile(si,fi){
  curSi=si;curFi=fi; studyActive=false;
  document.querySelectorAll(".navfile,.navunit").forEach(b=>b.classList.remove("active"));
  if(typeof goLevel === "function"){
    goLevel(3,si,fi);
    return;
  }
  /* 兜底路径（goLevel 尚未就绪时） */
  const st=DATA.stages[si], f=st.files[fi];
  let inner='<div class="breadcrumb"><b>'+st.name+'</b> &nbsp;/&nbsp; '+f.name+' &nbsp;·&nbsp; 共 '+f.units.length+' 个单元</div>';
  inner+='<div class="unitgrid">';
  f.units.forEach((u,ui)=>{
    const uu={si,fi,ui}; const d=isDone(uu);
    const cnt=(u.entries?u.entries.length:0)+" 张卡片";
    inner+='<div class="ucard'+(d?" done":"")+'" data-ui="'+ui+'">'+
      '<span class="badge">'+(d?"✓ 已学":"未学")+'</span>'+
      '<div class="ut">'+escapeHtml(u.title)+'</div>'+
      '<div class="umeta">'+cnt+'</div>'+
      '<div class="mini"><i style="width:'+(d?100:0)+'%"></i></div></div>';
  });
  inner+='</div>';
  main.innerHTML='<div class="unitlist" id="unitlist">'+inner+'</div>';
  const ul=getUnitlist();
  ul.querySelectorAll(".ucard").forEach(c=>{ c.onclick=()=>startStudy(si,fi,+c.dataset.ui); });
}
let progress={};
function isDone(u){ const k=uid(u); return !!(progress[k]&&progress[k].done); }
function setDone(u,done){ const k=uid(u); progress[k]=Object.assign(progress[k]||{},{done:done}); refreshProgress(); }
try{ progress=JSON.parse(localStorage.getItem("tril_flash_done_v1")||"{}"); }catch(e){ progress={}; }
function saveProgress(){ try{ localStorage.setItem("tril_flash_done_v1",JSON.stringify(progress)); }catch(e){} }
function refreshProgress(){
  if(curSi>=0&&curFi>=0){
    const ul=getUnitlist(); if(!ul) return;
    ul.querySelectorAll(".ucard").forEach(c=>{
      const ui=+c.dataset.ui; const d=isDone({si:curSi,fi:curFi,ui});
      c.classList.toggle("done",d); const badge=c.querySelector(".badge"); if(badge) badge.textContent=d?"✓ 已学":"未学";
      const mini=c.querySelector(".mini>i"); if(mini) mini.style.width=d?100:0;
    });
  }
}

/* ===== 闪卡学习 ===== */
let studyActive=false, cur=null, cards=[], pos=0, flipped=false;
function startStudy(si,fi,ui){
  const st=DATA.stages[si], f=st.files[fi], u=f.units[ui];
  cur={si,fi,ui, ...flat.find(x=>x.si===si&&x.fi===fi&&x.ui===ui)};
  studyActive=true;
  let list=(u.entries||[]).slice();
  if(settings.skipMastered) list=list.filter(e=>getMaster(cur,e)!=="know");
  if(settings.shuffle) list=shuffle(list);
  cards=list; pos=0; flipped=false;
  if(cards.length===0){ toast("本单元没有可学习的卡片（可能已全部掌握）"); openFile(si,fi); return; }
  renderStudy();
}
function shuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }

function renderStudy(){
  const e=cards[pos];
  if(e){ window.TRIL_CURRENT=e; window.TRIL_CURRENT_LANG=settings.frontLang; }
  const known=getMaster(cur,e);
  const backLangs = computeBackLangs();
  const total=cards.length;
  main.innerHTML=
    '<div class="study">'+
      '<div class="lessonbar">'+
        '<button class="back" id="backBtn">← 返回</button>'+
        '<span class="lt">'+escapeHtml(cur.stage)+' · '+escapeHtml(cur.file)+' · '+escapeHtml(cur.title)+'</span>'+
        '<span class="spacer" style="flex:1"></span>'+
        '<span class="master-badge">已掌握 '+cards.filter(c=>getMaster(cur,c)==="know").length+'/'+total+'</span>'+
        '<span class="progtxt">'+Math.min(pos+1,total)+' / '+total+'</span>'+
        '<span class="progbar"><i id="progFill"></i></span>'+
      '</div>'+
      '<div class="stage">'+
        '<div class="hint">正面为 <b>'+langMeta(settings.frontLang).label+'</b>（题目） · 按 <b>空格</b> 或点击卡片翻转查看答案</div>'+
        '<div class="flipwrap"><div class="flashcard'+(flipped?" flipped":"")+'" id="flashcard">'+
          '<div class="face front" id="faceFront"></div>'+
          '<div class="face back" id="faceBack"></div>'+
        '</div></div>'+
      '</div>'+
      '<div class="controls">'+
        (flipped? '' : '<button class="navbtn" id="prevBtn">◀ 上一张</button>')+
        (flipped? '' : '<button class="flipbtn" id="flipBtn">🔄 翻转看答案</button>')+
        (flipped? '<button class="navbtn" id="prevBtn">◀ 上一张</button>' : '')+
        (flipped? '<button class="flipbtn" id="nextBtn">下一张 ▶</button>' : '')+
        (flipped? '<div class="rate"><button class="r-no" data-r="unknown">✗ 不认识</button><button class="r-fz" data-r="fuzzy">? 模糊</button><button class="r-ok" data-r="know">✓ 认识</button></div>' : '')+
      '</div>'+
    '</div>';
  document.getElementById("backBtn").onclick=()=>exitStudy();
  document.getElementById("progFill").style.width=Math.round((pos)/total*100)+"%";
  renderFront(e);
  renderBack(e,backLangs);
  const fc=document.getElementById("flashcard");
  fc.onclick=()=>flip();
  const fb=document.getElementById("flipBtn"); if(fb) fb.onclick=(ev)=>{ev.stopPropagation();flip();};
  const nb=document.getElementById("nextBtn"); if(nb) nb.onclick=(ev)=>{ev.stopPropagation();next();};
  const pb=document.getElementById("prevBtn"); if(pb) pb.onclick=(ev)=>{ev.stopPropagation();prev();};
  if(flipped){
    main.querySelectorAll(".rate button").forEach(b=>{ b.onclick=(ev)=>{ev.stopPropagation();rate(b.dataset.r);}; });
  }
}
function renderFront(e){
  const L=langMeta(settings.frontLang);
  const txt=e[L.k]||"";
  let ipa="";
  if(settings.showIpa){
    if(L.k==="en"&&e.en_ipa) ipa=e.en_ipa;
    else if(L.k==="bm"&&e.bm_ipa) ipa=e.bm_ipa;
  }
  let pron="";
  if(L.k==="bm"&&e.bm_pron) pron=e.bm_pron;
  else if(L.k==="th"&&e.th_pron) pron=e.th_pron;
  const speakIco = txt? '<span class="speak-ico" data-spk="1">🔊</span>':'';
  const picF = picHtmlBig(e);
  document.getElementById("faceFront").innerHTML=
    '<div class="langtag">'+L.short+' · '+L.label+'</div>'+
    picF+
    '<div class="word clickable" data-text="'+escapeHtml(txt)+'" data-lang="'+L.k+'">'+escapeHtml(txt||"（无"+L.label+"）")+speakIco+'</div>'+
    (ipa?'<div class="ipa">'+escapeHtml(ipa)+'</div>':'')+
    (pron?'<div class="pron">'+escapeHtml(pron)+'</div>':'')+
    '<div class="front-hint">想一想它的其他语言怎么说 💡</div>';
  bindSpeak(document.getElementById("faceFront"));
}
function renderBack(e,backLangs){
  let html='<div class="langtag">释义 · '+backLangs.map(k=>langMeta(k).label).join(" / ")+'</div><div class="ans">';
  backLangs.forEach(k=>{
    const L=langMeta(k); const txt=e[k]||"";
    if(!txt) return;
    let ipa="", pron="";
    if(settings.showIpa){
      if(k==="en"&&e.en_ipa) ipa=e.en_ipa; else if(k==="bm"&&e.bm_ipa) ipa=e.bm_ipa;
    }
    if(k==="bm"&&e.bm_pron) pron=e.bm_pron; else if(k==="th"&&e.th_pron) pron=e.th_pron;
    const ex = (settings.showExample && e.example && e.example[k]) ? e.example[k] : "";
    html+='<div class="ans-block '+L.cls+'">'+
      '<div class="a-head"><span class="master-dot '+getMaster(cur,e)+'"></span>'+L.short+' · '+L.label+' <span class="speak-ico" data-text="'+escapeHtml(txt)+'" data-lang="'+k+'">🔊</span></div>'+
      '<div class="a-word clickable" data-text="'+escapeHtml(txt)+'" data-lang="'+k+'">'+escapeHtml(txt)+'</div>'+(k==="zh"?TrilPinyin.html(txt):"")+
      (ipa?'<div class="ipa">'+escapeHtml(ipa)+'</div>':'')+
      (pron?'<div class="pron">'+escapeHtml(pron)+'</div>':'')+
      (ex?'<div class="a-ex clickable" data-text="'+escapeHtml(ex)+'" data-lang="'+k+'">📌 '+escapeHtml(ex)+'</div>'+(k==="zh"?TrilPinyin.html(ex):""):'')+
    '</div>';
  });
  html+='</div>';
  document.getElementById("faceBack").innerHTML=html;
  bindSpeak(document.getElementById("faceBack"));
}
function bindSpeak(scope){
  scope.querySelectorAll('[data-text]').forEach(n=>{
    n.onclick=(ev)=>{ ev.stopPropagation(); speak(n.dataset.text, n.dataset.lang); };
  });
}
function flip(){
  if(!cur) return;
  flipped=!flipped;
  const fc=document.getElementById("flashcard");
  if(fc) fc.classList.toggle("flipped",flipped);
  if(flipped){
    renderStudy();
    if(settings.autoRead){
      const e=cards[pos];
      const backLangs = computeBackLangs();
      let i=0; const seq=backLangs.map(k=>({t:e[k]||"",l:k})).filter(x=>x.t);
      const step=()=>{ if(i>=seq.length) return; const x=seq[i++]; speak(x.t,x.l,()=>setTimeout(step,settings.gap||200)); };
      setTimeout(step,250);
    }
  } else {
    renderStudy();
  }
}
function next(){
  if(pos<cards.length-1){ pos++; flipped=false; renderStudy(); }
  else finishStudy();
}
function prev(){
  if(pos>0){ pos--; flipped=false; renderStudy(); }
}
function rate(lv){
  if(!cur) return;
  setMaster(cur,cards[pos],lv);
  // 若开启“跳过已掌握”，评分后该卡可能需从本轮移除（下一轮生效）；本张直接前进
  if(settings.autoAdvance){ next(); }
  else { refreshStudyMasterBadge(); }
}
function refreshStudyMasterBadge(){
  if(!cur) return;
  const badge=main.querySelector(".master-badge");
  if(badge) badge.textContent="已掌握 "+cards.filter(c=>getMaster(cur,c)==="know").length+"/"+cards.length;
  const e=cards[pos]; const dot=main.querySelector(".ans-block .master-dot");
  if(dot) dot.className="master-dot "+getMaster(cur,e);
}
function finishStudy(){
  setDone(cur,true);
  const know=cards.filter(c=>getMaster(cur,c)==="know").length;
  const fz=cards.filter(c=>getMaster(cur,c)==="fuzzy").length;
  const unk=cards.filter(c=>getMaster(cur,c)==="unknown").length;
  main.innerHTML='<div class="summary">'+
    '<h2>🎉 本单元闪卡完成</h2>'+
    '<div class="stat">单元：<b>'+escapeHtml(cur.title)+'</b></div>'+
    '<div class="stat">共 '+cards.length+' 张 · 认识 <b>'+know+'</b> · 模糊 <b>'+fz+'</b> · 不认识 <b>'+unk+'</b></div>'+
    '<div class="stat" style="margin-top:14px">'+
      '<button class="primary" id="againBtn" style="margin-right:10px">🔁 再来一轮</button>'+
      '<button id="backListBtn">← 返回单元列表</button>'+
    '</div></div>';
  document.getElementById("againBtn").onclick=()=>{ flipped=false; if(settings.shuffle) cards=shuffle(cards); pos=0; renderStudy(); };
  document.getElementById("backListBtn").onclick=()=>openFile(curSi,curFi);
}
function exitStudy(){
  studyActive=false; cur=null;
  openFile(curSi,curFi);
}

/* ===== 设置面板 ===== */
function buildSettings(){
  const sf=document.getElementById("setFront"); sf.innerHTML="";
  LANGS.forEach(l=>{ const b=document.createElement("button"); b.textContent=l.label; b.dataset.k=l.k;
    if(settings.frontLang===l.k) b.classList.add("on");
    b.onclick=()=>{ settings.frontLang=l.k; if(settings.backLang===l.k) settings.backLang=LANGS.find(x=>x.k!==l.k).k;
      saveSettings(); buildSettings(); if(studyActive) renderStudy(); };
    sf.appendChild(b); });
  const sbm=document.getElementById("setBackMode");
  sbm.querySelectorAll("button").forEach(b=>{ b.classList.toggle("on", settings.backMode===b.dataset.mode);
    b.onclick=()=>{ settings.backMode=b.dataset.mode; saveSettings(); buildSettings(); if(studyActive) renderStudy(); }; });
  const bl=document.getElementById("setBackLang"); bl.innerHTML="";
  LANGS.forEach(l=>{ const o=document.createElement("option"); o.value=l.k; o.textContent=l.label; if(settings.backLang===l.k)o.selected=true; bl.appendChild(o); });
  bl.onchange=()=>{ settings.backLang=bl.value; saveSettings(); if(studyActive) renderStudy(); };
  const bt=document.getElementById("setBackTwo"); bt.innerHTML="";
  LANGS.forEach(l=>{ const b=document.createElement("button"); b.textContent=l.label; b.dataset.k=l.k;
    if((settings.backTwo||[]).indexOf(l.k)>=0) b.classList.add("on");
    b.onclick=()=>{ const arr=settings.backTwo||[]; const i=arr.indexOf(l.k);
      if(i>=0) arr.splice(i,1); else arr.push(l.k);
      settings.backTwo=arr; saveSettings(); buildSettings(); if(studyActive) renderStudy(); };
    bt.appendChild(b); });
  document.getElementById("backLangField").classList.toggle("disabled", settings.backMode!=="one");
  document.getElementById("backTwoField").classList.toggle("disabled", settings.backMode!=="two");
  bindSwitch("setIpa", settings.showIpa, v=>{settings.showIpa=v;saveSettings();if(studyActive)renderStudy();});
  bindSwitch("setEx", settings.showExample, v=>{settings.showExample=v;saveSettings();if(studyActive)renderStudy();});
  bindSwitch("setAutoRead", settings.autoRead, v=>{settings.autoRead=v;saveSettings();});
  bindSwitch("setShuffle", settings.shuffle, v=>{settings.shuffle=v;saveSettings();});
  bindSwitch("setSkip", settings.skipMastered, v=>{settings.skipMastered=v;saveSettings();});
  bindSwitch("setAutoAdv", settings.autoAdvance, v=>{settings.autoAdvance=v;saveSettings();});
}
function bindSwitch(id,val,cb){
  const s=document.getElementById(id); s.classList.toggle("on",!!val);
  s.onclick=()=>{ const v=!s.classList.contains("on"); s.classList.toggle("on",v); cb(v); };
}
const overlay=document.getElementById("overlay");
document.getElementById("openSettings").onclick=()=>{ buildSettings(); overlay.classList.add("show"); };
document.getElementById("closeSettings").onclick=()=>overlay.classList.remove("show");
overlay.onclick=(e)=>{ if(e.target===overlay) overlay.classList.remove("show"); };

/* ===== 自定义词库（共享 tril-lib.js） ===== */
function rebuildFlat(){ flat=[]; DATA.stages.forEach((st,si)=>st.files.forEach((f,fi)=>f.units.forEach((u,ui)=>{
  flat.push({stage:st.name,file:f.name,si,fi,ui,title:u.title,type:u.type||"table",langs:u.langs||["en","zh","bm","th"],entries:u.entries,summary:u.summary||"",notes:u.notes||""});
}))); }
(function(btn){ if(btn) btn.onclick=function(){ if(!window.TrilLib){ toast("自定义词库模块未加载"); return; } TrilLib.openEditor({onSaved:function(){ TrilLib.mergeStages(DATA); rebuildFlat(); renderNav(); toast("✓ 自定义词库已更新"); }}); }; })(document.getElementById("editLibBtn"));

/* ===== 快捷键 ===== */
document.addEventListener("keydown",e=>{
  if(overlay.classList.contains("show")) return;
  if(!studyActive) return;
  if(e.code==="Space"){ e.preventDefault(); flip(); }
  else if(e.code==="ArrowRight"){ e.preventDefault(); next(); }
  else if(e.code==="ArrowLeft"){ e.preventDefault(); prev(); }
  else if(e.key==="1"){ rate("unknown"); }
  else if(e.key==="2"){ rate("fuzzy"); }
  else if(e.key==="3"){ rate("know"); }
  else if(e.code==="Escape"){ exitStudy(); }
});

function toast(msg){
  const t=document.getElementById("toast"); t.textContent=msg; t.classList.add("show");
  clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.remove("show"),2200);
}

/* ===== 可折叠面板 ===== */
function toggleLayout(kind){
  const cls={sidebar:'hide-sidebar',topbar:'hide-topbar'}[kind];
  if(!cls) return;
  document.body.classList.toggle(cls);
  const on=!document.body.classList.contains(cls);
  document.querySelectorAll('[data-layout="'+kind+'"]').forEach(b=>b.classList.toggle('on',on));
  try{ localStorage.setItem('flash_layout_'+kind, on?'1':'0'); }catch(e){}
}
function applyLayout(){
  ['sidebar','topbar'].forEach(kind=>{
    let v='1'; try{ v=localStorage.getItem('flash_layout_'+kind)||'1'; }catch(e){}
    const on = v!=='0';
    const cls={sidebar:'hide-sidebar',topbar:'hide-topbar'}[kind];
    document.body.classList.toggle(cls, !on);
    document.querySelectorAll('[data-layout="'+kind+'"]').forEach(b=>b.classList.toggle('on', on));
  });
}
document.querySelectorAll('[data-layout]').forEach(b=>{ b.onclick=()=>toggleLayout(b.dataset.layout); });
applyLayout();

/* ===== 启动 ===== */
window.__TRIL_FLASH_LOADED__ = true;
try{ renderNav(); refreshProgress(); }
catch(e){
  _flashShowErr("renderNav 失败：" + (e.message || e));
  console.error("[闪记 renderNav 失败]", e);
}
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

/* ===== auth-client 返回键：学习回合逐级回退 ===== */
window.TrilAppBack = function(){
  if(studyActive){ exitStudy(); return true; }
  if(curSi>=0 || curFi>=0){ return false; } // 已在文件列表，交给返回键回到选择页
  return false;
};

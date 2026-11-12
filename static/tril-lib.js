/* tril-lib.js — 三器共享「我的自定义词库」模块
 * 统一 localStorage key，提供编辑器 UI 与合并逻辑。
 * 学习器 / 测试器 / 播放器 共用，一处添加处处可见。
 *
 * 2026-11-12 升级：
 *  - 顶部「加入目标单元」下拉：可加入已有单元，或选「★ 新建单元…」当场命名新建。
 *  - 「➕ 加入本单元」立即写入并持久化（不再需要单独的「保存单元」），修复过去“加不进去”的问题。
 *  - 自动翻译：只填一种语言，点「🌐 自动翻译填充」或失焦时，其余三种语言自动翻译填入；例句同理。
 *  - 加入后自动生成：英文音标（/api/ipa）、马来语音译（汉字音译，本地规则）、中文拼音（渲染期由 TrilPinyin 处理）。
 *
 * 用法：
 *   const DATA = window.__Xxx_DATA__;
 *   TrilLib.mergeStages(DATA);                 // 词库加载后合并进 DATA.stages（放在扁平索引构建前）
 *   TrilLib.openEditor({ onSaved: ()=>{ rebuild(); renderNav(); } });  // 点「✎ 词库」时调用
 */
(function(){
  "use strict";
  var LS_KEY = "tril_custom_units_v1";
  var STAGE_NAME = "📁 我的自定义词库";

  function loadStage(){
    try{
      var c = JSON.parse(localStorage.getItem(LS_KEY));
      if(c && c.files && Array.isArray(c.files)) return c;
    }catch(e){}
    return { name: STAGE_NAME, files:[{ name:"自定义单元", units:[] }] };
  }
  function saveStage(st){
    try{ localStorage.setItem(LS_KEY, JSON.stringify(st)); return true; }catch(e){ return false; }
  }
  function clearStage(){
    saveStage({ name: STAGE_NAME, files:[{ name:"自定义单元", units:[] }] });
  }
  /* 把自定义学段合并进 DATA.stages（幂等：先按名称移除旧的，有内容再追加） */
  function mergeStages(DATA){
    DATA.stages = (DATA.stages || []).filter(function(s){ return s.name !== STAGE_NAME; });
    var st = loadStage();
    if(st.files.some(function(f){ return f.units && f.units.length; })){
      DATA.stages = DATA.stages.concat([st]);
    }
    return DATA;
  }

  /* 列出全部单元（跨文件），用于下拉选择 */
  function getUnits(st){
    var out = [];
    (st.files||[]).forEach(function(f,fi){
      (f.units||[]).forEach(function(u,ui){
        out.push({ f:fi, u:ui, title:u.title||("单元"+(ui+1)), count:(u.entries||[]).length });
      });
    });
    return out;
  }

  /* ---------- 编辑器 UI ---------- */
  var CSS = [
    ".tril-lib-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);display:none;align-items:center;justify-content:center;z-index:100000;font:13px system-ui,sans-serif}",
    ".tril-lib-overlay.show{display:flex}",
    ".tril-lib-modal{width:460px;max-width:92vw;max-height:90vh;overflow:auto;background:var(--panel,#1a2030);color:var(--txt,#e6ebf5);border:1px solid var(--line,#2a3346);border-radius:14px;padding:18px;box-shadow:0 20px 60px rgba(0,0,0,.45)}",
    ".tril-lib-modal h2{margin:0 0 12px;font-size:16px}",
    ".tril-lib-field{margin-bottom:10px}",
    ".tril-lib-field label{display:block;margin-bottom:4px;color:var(--muted,#93a0bd);font-size:12px}",
    ".tril-lib-field input,.tril-lib-field select{width:100%;background:var(--panel2,#222a3a);color:var(--txt,#e6ebf5);border:1px solid var(--line,#2a3346);border-radius:8px;padding:9px;font-size:13px;box-sizing:border-box;outline:none}",
    ".tril-lib-field input:focus,.tril-lib-field select:focus{border-color:var(--accent,#7aa2ff)}",
    ".tril-lib-btn{background:var(--panel2,#222a3a);color:var(--txt,#e6ebf5);border:1px solid var(--line,#2a3346);border-radius:8px;padding:9px 12px;font-size:13px;cursor:pointer}",
    ".tril-lib-btn:hover{border-color:var(--accent,#7aa2ff)}",
    ".tril-lib-btn.primary{background:linear-gradient(90deg,#6f9bff,#7aa2ff);border-color:transparent;color:#fff;font-weight:600}",
    ".tril-lib-btn:disabled{opacity:.55;cursor:default}",
    ".tril-lib-preview{margin-top:8px;font-size:12px;color:var(--muted,#93a0bd);max-height:180px;overflow:auto;line-height:1.6}",
    ".tril-lib-list{margin-top:4px}",
    ".tril-lib-row{display:flex;align-items:center;gap:6px;padding:4px 6px;border:1px solid var(--line,#2a3346);border-radius:7px;margin-bottom:5px;background:var(--panel2,#222a3a)}",
    ".tril-lib-rowtxt{flex:1;min-width:0;word-break:break-all;color:var(--txt,#e6ebf5)}",
    ".tril-lib-ex{color:var(--muted,#93a0bd);font-size:11px}",
    ".tril-lib-del{flex:0 0 auto;background:transparent;border:1px solid #7a3b3b;color:#ff9a9a;border-radius:6px;padding:2px 7px;font-size:12px;cursor:pointer;line-height:1.4}",
    ".tril-lib-del:hover{background:rgba(180,60,60,.18);border-color:#c95454}",
    ".tril-lib-suggest{margin-top:6px;font-size:12px;color:#ffcf8a;line-height:1.7}",
    ".tril-lib-sug{display:inline-block;margin:0 2px;padding:2px 8px;border:1px solid #c8923f;border-radius:999px;background:rgba(200,146,63,.12);color:#ffd9a0;cursor:pointer}",
    ".tril-lib-sug:hover{background:rgba(200,146,63,.28)}",
    ".tril-lib-hint{margin-top:8px;font-size:11px;color:var(--muted,#93a0bd);line-height:1.5}",
    ".tril-lib-toast{position:fixed;left:50%;bottom:32px;transform:translateX(-50%) translateY(20px);background:rgba(20,26,40,.95);color:#e6ebf5;border:1px solid var(--line,#2a3346);padding:10px 16px;border-radius:10px;font:13px system-ui;opacity:0;pointer-events:none;transition:.2s;z-index:100001}",
    ".tril-lib-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}"
  ].join("\n");

  var MODAL_HTML =
    '<div class="tril-lib-modal">' +
      '<h2>✎ 我的自定义词库</h2>' +
      '<div class="tril-lib-field"><label>加入目标单元</label>' +
        '<select id="trilLibUnit" class="tril-lib-input"></select></div>' +
      '<div class="tril-lib-field" id="trilLibTitleWrap" style="display:none"><label>新单元标题</label>' +
        '<input type="text" id="trilLibUnitTitle" placeholder="如：我的每日生词 / 工厂常用词"></div>' +
      '<div class="tril-lib-field"><label>英文（en）</label>' +
        '<input type="text" id="trilLibEn" placeholder="apple"></div>' +
      '<div class="tril-lib-field"><label>中文（zh）</label>' +
        '<input type="text" id="trilLibZh" placeholder="苹果"></div>' +
      '<div class="tril-lib-field"><label>马来文（bm）</label>' +
        '<input type="text" id="trilLibBm" placeholder="epal"></div>' +
      '<div class="tril-lib-field"><label>泰文（th）</label>' +
        '<input type="text" id="trilLibTh" placeholder="แอปเปิ้ล"></div>' +
      '<div class="tril-lib-field"><label>例句（填一种语言即可，会自动翻译）</label>' +
        '<input type="text" id="trilLibEx" placeholder="我每天吃一个苹果。"></div>' +
      '<div class="tril-lib-suggest" id="trilLibSuggest" style="display:none"></div>' +
      '<div style="display:flex;gap:8px;margin:4px 0 10px">' +
        '<button class="tril-lib-btn" id="trilLibTranslate" style="flex:1">🌐 自动翻译填充</button>' +
      '</div>' +
      '<div class="tril-lib-field">' +
        '<button class="tril-lib-btn primary" id="trilLibAdd" style="width:100%">➕ 加入本单元</button>' +
        '<div class="tril-lib-preview" id="trilLibPreview"></div></div>' +
      '<div style="display:flex;gap:8px;margin-top:8px">' +
        '<button class="tril-lib-btn" id="trilLibExport" style="flex:1">📤 导出备份</button>' +
        '<button class="tril-lib-btn" id="trilLibImport" style="flex:1">📥 导入备份</button>' +
      '</div>' +
      '<div style="display:flex;gap:8px;margin-top:8px">' +
        '<button class="tril-lib-btn" id="trilLibClear" style="flex:1">🗑 清空词库</button>' +
        '<button class="tril-lib-btn" id="trilLibClose" style="flex:1">完成</button>' +
      '</div>' +
      '<input type="file" id="trilLibFile" accept="application/json,.json" style="display:none">' +
      '<div class="tril-lib-hint" id="trilLibHint">提示：只填一种语言，输入时即实时自动翻译并填入其余三种（也可点「🌐 自动翻译填充」）；英文填错会提示正确拼写可点击采纳。加入后自动生成英文音标、马来语音译、中文拼音。下方词条列表每条右侧有 🗑 可单独删除。词库存于本机浏览器、不跨设备同步，换电脑/手机请用 📤导出 / 📥导入 备份迁移。播放键已改为 Ctrl/⌘ + 空格，输入时不会被打断。</div>' +
    '</div>';

  var injected = false, pendingExample = null;
  function el(id){ return document.getElementById(id); }
  function cap(k){ return k.charAt(0).toUpperCase() + k.slice(1); }
  function fldVal(k){ var e = el("trilLib"+cap(k)); return e ? e.value.trim() : ""; }
  function setFld(k,v){ var e = el("trilLib"+cap(k)); if(e) e.value = v || ""; }

  function toast(msg){
    var t = el("trilLibToast");
    if(!t){ t = document.createElement("div"); t.id = "trilLibToast"; t.className = "tril-lib-toast"; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(t._tm); t._tm = setTimeout(function(){ t.classList.remove("show"); }, 2000);
  }
  function setBusy(b){
    var btn = el("trilLibTranslate");
    if(btn){ btn.disabled = b; btn.textContent = b ? "⏳ 翻译中…" : "🌐 自动翻译填充"; }
  }
  function clearFields(){ ["en","zh","bm","th","ex"].forEach(function(k){ setFld(k,""); }); pendingExample = null; }

  function updatePreview(st, target){
    var pv = el("trilLibPreview");
    if(!st) st = loadStage();
    var u = target || currentSelectedUnit(st);
    if(u){ renderUnitEntries(pv, st, u.f, u.u); return; }
    var units = getUnits(st);
    if(!units.length){ pv.textContent = "（暂无单元，选「★ 新建单元…」并填标题后加入即可）"; return; }
    pv.innerHTML = "已有单元：<br>" + units.map(function(x){ return "· "+x.title+"（"+x.count+" 词）"; }).join("<br>");
  }
  /* 当前下拉所选的真实单元（非「新建」） */
  function currentSelectedUnit(st){
    var sel = el("trilLibUnit"); if(!sel) return null;
    var v = sel.value;
    if(!v || v === "new") return null;
    var p = v.split(":"), f=+p[0], u=+p[1];
    if(!st.files[f] || !st.files[f].units[u]) return null;
    return { f:f, u:u };
  }
  function escapeHtml(s){
    return String(s==null?"":s).replace(/[&<>"']/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }
  /* 渲染某单元的全部词条为可删除列表 */
  function renderUnitEntries(pv, st, f, u){
    var unit = st.files[f].units[u];
    var entries = (unit.entries||[]);
    if(!entries.length){ pv.innerHTML = "「"+escapeHtml(unit.title)+"」（空，加入词条后会显示在此，可逐条删除）"; return; }
    var rows = entries.map(function(w, idx){
      var main = [w.en, w.zh, w.bm, w.th].filter(Boolean).join(" / ");
      var ex = w.example && (w.example.en||w.example.zh||w.example.bm||w.example.th)
        ? ' <span class="tril-lib-ex">“'+ escapeHtml([w.example.en,w.example.zh,w.example.bm,w.example.th].filter(Boolean).join("/")) +'”</span>' : "";
      return '<div class="tril-lib-row"><span class="tril-lib-rowtxt">'+ escapeHtml(main) + ex +
        '</span><button class="tril-lib-del" data-f="'+f+'" data-u="'+u+'" data-i="'+idx+'">🗑</button></div>';
    }).join("");
    pv.innerHTML = "「"+escapeHtml(unit.title)+"」共 "+entries.length+" 条 · 点 🗑 删除：<div class=\"tril-lib-list\">"+rows+"</div>";
    pv.querySelectorAll(".tril-lib-del").forEach(function(b){
      b.onclick = function(){
        deleteEntry(+b.getAttribute("data-f"), +b.getAttribute("data-u"), +b.getAttribute("data-i"));
      };
    });
  }
  /* 删除单个词条（含其例句），带确认，删除后刷新列表与全局视图 */
  function deleteEntry(f, u, idx){
    var st = loadStage();
    var unit = st.files[f] && st.files[f].units[u];
    if(!unit || !unit.entries || !unit.entries[idx]) return;
    var w = unit.entries[idx];
    var label = [w.en, w.zh, w.bm, w.th].filter(Boolean).join("/") || "该条目";
    if(!window.confirm("确定删除「"+label+"」这条词条？\n（仅删除这一条，不影响其他词条）")) return;
    unit.entries.splice(idx, 1);
    if(!saveStage(st)){ toast("❌ 删除失败：存储写保护"); return; }
    toast("✓ 已删除「"+label+"」");
    updatePreview(st, { f:f, u:u });
    if(window.__TRIL_LIB_ONSAVED) window.__TRIL_LIB_ONSAVED();
  }

  /* 马来语 → 汉字音译（供中文母语者照着读），规则近似。
   * 例：epal→厄帕阿尔、terima→特厄尔伊姆阿、selamat→斯厄勒阿姆阿特。 */
  function malayHanzi(w){
    w = (w||"").toLowerCase().replace(/[^a-z]/g,"");
    if(!w) return "";
    var twoMap = {ng:"昂",ny:"尼",sy:"西",kh:"赫",ch:"奇",sh:"希",dz:"兹",gh:"厄"};
    var vowMap = {a:"阿",e:"厄",i:"伊",o:"奥",u:"乌",ai:"艾",au:"奥",oi:"奥伊",ia:"伊亚",ie:"伊埃",ua:"乌阿",eu:"厄乌",ea:"埃",io:"伊奥"};
    var conMap = {b:"布",p:"帕",m:"姆",f:"夫",d:"德",t:"特",n:"恩",s:"斯",l:"尔",r:"尔",g:"格",k:"克",h:"赫",w:"乌",y:"伊",j:"杰",c:"茨",q:"克",z:"兹"};
    function isV(s){ return vowMap[s]!==undefined; }
    function isTwo(s){ return twoMap[s]!==undefined; }
    var out="", pending=[], i=0;
    while(i<w.length){
      var two = w.substr(i,2);
      if(isTwo(two)){ pending.push(twoMap[two]); i+=2; continue; }
      if(vowMap[two]){ // 双字母元音
        if(i+2<w.length && conMap[w[i+2]] && (i+3>=w.length || isV(w[i+3]) || isTwo(w.substr(i+3,2)))){
          out += pending.join("") + vowMap[two] + conMap[w[i+2]]; pending=[]; i+=3; continue;
        }
        out += pending.join("") + vowMap[two]; pending=[]; i+=2; continue;
      }
      var c = w[i];
      if(vowMap[c]){
        if(i+1<w.length && conMap[w[i+1]] && (i+2>=w.length || isV(w[i+2]) || isTwo(w.substr(i+2,2)))){
          // 后接辅音且其后为元音/双元 → 该辅音是下一音节声母，本元音独立成节
          out += pending.join("") + vowMap[c]; pending=[conMap[w[i+1]]]; i+=2; continue;
        }
        if(i+1<w.length && conMap[w[i+1]] && !(i+2<w.length && (isV(w[i+2]) || isTwo(w.substr(i+2,2))))){
          // 后接辅音且其后非元音（词尾或辅音簇）→ 该辅音为韵尾，与本元音同节
          out += pending.join("") + vowMap[c] + conMap[w[i+1]]; pending=[]; i+=2; continue;
        }
        out += pending.join("") + vowMap[c]; pending=[]; i++; continue;
      }
      if(conMap[c]){ pending.push(conMap[c]); i++; continue; }
      pending.push(c); i++;
    }
    out += pending.join("");
    return out;
  }

  /* 自动翻译（逐字实时 + 手动按钮），多后端容错：
   * 主路径：浏览器直连 MyMemory（带 de= 邮箱→按邮箱配额 5000/天，绕开用户共享 NAT IP 被限流；CORS 开放）；
   * 兜底1：Google gtx（住宅 IP 通常可用，但无 CORS 头，浏览器可能拦截）；
   * 兜底2：同源 CF /api/translate（CF 边缘 IP 也常被 MyMemory 限流，仅最后尝试）。 */
  var MM_MAP = { en:"en", bm:"ms", zh:"zh-CN", th:"th" };
  var G_MAP  = { en:"en", bm:"ms", zh:"zh-CN", th:"th" };
  // 带邮箱：MyMemory 免费配额从 500/天·IP 提升到 5000/天·邮箱（无需验证），用于绕开用户共享 NAT IP 被限流的问题
  var MM_DE = "tril-suite-nokey@bizehua.app";
  function wait(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }

  async function gtranslateGoogle(text, sl, tl){
    var url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl="
      + encodeURIComponent(sl) + "&tl=" + encodeURIComponent(tl) + "&dt=t&q=" + encodeURIComponent(text);
    var r = await fetch(url, { redirect:"follow" });
    var j = await r.json();
    if(Array.isArray(j) && Array.isArray(j[0])) return j[0].map(function(seg){ return seg[0]; }).join("");
    throw new Error("google parse");
  }
  async function gtranslateMM(text, sl, tl){
    var url = "https://api.mymemory.translated.net/get?q=" + encodeURIComponent(text)
      + "&langpair=" + encodeURIComponent(sl + "|" + tl)
      + "&de=" + encodeURIComponent(MM_DE);
    var r = await fetch(url);
    var j = await r.json();
    if(!j || j.responseStatus !== 200) throw new Error("mm status " + (j && j.responseStatus));
    var t = (j.responseData && j.responseData.translatedText) || "";
    if(/MYMEMORY WARNING/i.test(t)) throw new Error("quota");
    if(t.trim().toLowerCase() === text.trim().toLowerCase() && Array.isArray(j.matches)){
      for(var i=0;i<j.matches.length;i++){
        var tr = (j.matches[i] && j.matches[i].translation) || "";
        if(tr && tr.trim().toLowerCase() !== text.trim().toLowerCase()){ t = tr; break; }
      }
    }
    return t;
  }
  async function gtranslateCF(text, fromVocab){
    var r = await fetch("/api/translate", { method:"POST",
      headers:{"content-type":"application/json"}, body: JSON.stringify({ text:text, from:fromVocab }) });
    var d = await r.json();
    if(!d.ok) throw new Error("cf " + (d.error||""));
    return d.results || {};
  }
  /* 返回 {en,bm,zh,th}：主路径浏览器 MyMemory(带邮箱) 逐语言；失败再 Google gtx；仍缺再同源 CF 兜底 */
  async function translateAllBackends(text, fromVocab){
    var fromCode = G_MAP[fromVocab];
    var targets = ["en","bm","zh","th"].filter(function(k){ return k !== fromVocab; });
    var out = { en:"", bm:"", zh:"", th:"" }; out[fromVocab] = text;
    // 主路径：浏览器直连 MyMemory（带邮箱→按邮箱配额，不受共享 NAT IP 限流；CORS 开放）
    for(var ti=0; ti<targets.length; ti++){
      var k = targets[ti], val = "", ok = false;
      try{ val = await gtranslateMM(text, fromCode, G_MAP[k]); ok = !!(val && val.trim()); }catch(e){}
      if(ok){ out[k] = val; continue; }
      // 兜底1：Google gtx（住宅 IP 通常可用，但无 CORS 头可能被浏览器拦截）
      try{ val = await gtranslateGoogle(text, fromCode, G_MAP[k]); ok = !!(val && val.trim()); }catch(e){}
      if(ok){ out[k] = val; }
    }
    // 兜底2：仍有缺失再走同源 CF /api/translate（仅最后尝试）
    var missing = targets.filter(function(k){ return !out[k]; });
    if(missing.length){
      try{
        var res = await gtranslateCF(text, fromVocab);
        missing.forEach(function(k){ if(res && res[k]) out[k] = res[k]; });
      }catch(e){}
    }
    return out;
  }
  async function doTranslate(src, withToast){
    var langs = ["en","zh","bm","th"];
    var text = fldVal(src), exText = fldVal("ex");
    if(!text){ if(withToast) toast("请先填写一种语言"); return; }
    if(withToast) setBusy(true);
    try{
      var res = await translateAllBackends(text, src);
      langs.forEach(function(k){ if(k!==src) setFld(k, res[k]||""); });
      if(exText){
        try{
          var er = await translateAllBackends(exText, src);
          var obj = { en:"", bm:"", zh:"", th:"" }; obj[src] = exText;
          langs.forEach(function(k){ if(k!==src) obj[k] = er[k]||""; });
          pendingExample = obj;
        }catch(e){}
      }
      if(withToast) toast(exText ? "已翻译并填入（含例句）" : "已翻译并填入");
    }catch(e){
      if(withToast) toast("翻译失败：" + e.message);
    }finally{ if(withToast) setBusy(false); }
  }
  /* 手动按钮：要求恰好只填一种语言 */
  async function runTranslate(){
    var langs = ["en","zh","bm","th"];
    var filled = langs.filter(function(k){ return fldVal(k); });
    if(filled.length !== 1){ toast("请只填写一种语言，其余留空，再点翻译"); return; }
    await doTranslate(filled[0], true);
  }
  /* 逐字实时：输入后 600ms 防抖，恰好一种语言时自动翻译（静默，不打扰输入） */
  var liveTimer = null;
  function onLangInput(){
    if(liveTimer) clearTimeout(liveTimer);
    liveTimer = setTimeout(function(){
      var langs = ["en","zh","bm","th"];
      var filled = langs.filter(function(k){ return fldVal(k); });
      if(filled.length === 1) doTranslate(filled[0], false);
    }, 600);
  }
  /* 英文拼写纠错：失焦时若词典未收录，调用 Datamuse 给出候选，可点击采纳 */
  async function spellCheck(){
    var sug = el("trilLibSuggest");
    var w = fldVal("en").trim();
    if(!w || /\s/.test(w)){ if(sug){ sug.innerHTML=""; sug.style.display="none"; } return; }
    var known = true;
    try{
      var r = await fetch("/api/ipa", { method:"POST", headers:{"content-type":"application/json"}, body: JSON.stringify({ word:w }) });
      var d = await r.json();
      known = !!(d && d.ok && d.ipa);
    }catch(e){ known = true; }
    if(known){ if(sug){ sug.innerHTML=""; sug.style.display="none"; } return; }
    try{
      var rr = await fetch("https://api.datamuse.com/words?sp=" + encodeURIComponent(w) + "&max=6");
      var j = await rr.json();
      var cands = (j||[]).map(function(x){ return x.word; })
        .filter(function(c){ return c && c.toLowerCase() !== w.toLowerCase(); }).slice(0,5);
      if(sug){
        if(cands.length){
          sug.innerHTML = "拼写可能不准 · 您是否想输入：" +
            cands.map(function(c){ return '<span class="tril-lib-sug" data-w="'+c.replace(/"/g,'&quot;')+'">'+c+'</span>'; }).join("、");
          sug.style.display = "block";
          sug.querySelectorAll(".tril-lib-sug").forEach(function(s){
            s.onclick = function(){ setFld("en", s.getAttribute("data-w")); sug.innerHTML=""; sug.style.display="none"; spellCheck(); };
          });
        } else { sug.innerHTML=""; sug.style.display="none"; }
      }
    }catch(e){ if(sug){ sug.innerHTML=""; sug.style.display="none"; } }
  }

  function buildExample(){
    if(pendingExample) return pendingExample;
    var ex = fldVal("ex");
    if(!ex) return {};
    var filled = ["en","zh","bm","th"].filter(function(k){ return fldVal(k); });
    var obj = { en:"", bm:"", zh:"", th:"" };
    obj[filled.length===1 ? filled[0] : "en"] = ex;
    return obj;
  }

  function currentTarget(st){
    var sel = el("trilLibUnit").value;
    if(sel === "new"){
      var title = el("trilLibUnitTitle").value.trim();
      if(!title){ toast("请先填写「新单元标题」"); return null; }
      if(!st.files.length) st.files.push({ name:"自定义单元", units:[] });
      st.files[0].units.push({ title:title, type:"table", langs:["en","bm","zh","th"],
        entries:[], summary:"", notes:"" });
      saveStage(st);
      return { f:0, u: st.files[0].units.length-1, created:true };
    }
    var parts = sel.split(":"), f=+parts[0], u=+parts[1];
    if(!st.files[f] || !st.files[f].units[u]){ toast("目标单元不存在，请刷新"); return null; }
    return { f:f, u:u, created:false };
  }

  function enrich(st, entry){
    var changed = false;
    if(entry.en){
      try{
        fetch("/api/ipa", { method:"POST", headers:{"content-type":"application/json"},
          body: JSON.stringify({ word: entry.en }) })
          .then(function(r){ return r.ok ? r.json() : null; })
          .then(function(d){ if(d && d.ok && d.ipa){ entry.en_ipa = d.ipa; saveStage(st); } })
          .catch(function(){});
      }catch(e){}
    }
    if(entry.bm){
      var p = malayHanzi(entry.bm);
      if(p){ entry.bm_pron = p; changed = true; }
    }
    if(changed) saveStage(st);
  }

  function addWord(){
    var v = { en:fldVal("en"), zh:fldVal("zh"), bm:fldVal("bm"), th:fldVal("th") };
    if(!v.en && !v.zh && !v.bm && !v.th){ toast("请至少填写一种语言的词条"); return; }
    var st = loadStage();
    var target = currentTarget(st);
    if(!target) return;
    var entry = { en:v.en, bm:v.bm, zh:v.zh, th:v.th, en_ipa:"", bm_pron:"", example: buildExample() };
    st.files[target.f].units[target.u].entries.push(entry);
    if(!saveStage(st)){ toast("❌ 保存失败：浏览器存储已满或写保护"); return; }
    var title = st.files[target.f].units[target.u].title;
    if(target.created) rebuildUnitSelect(st, target.f + ":" + target.u);
    clearFields();
    toast("✓ 已加入「" + title + "」");
    updatePreview(st, target);
    if(window.__TRIL_LIB_ONSAVED) window.__TRIL_LIB_ONSAVED();
    enrich(st, entry);
  }

  function clearAll(){
    var cnt = getUnits(loadStage()).reduce(function(a,u){ return a + u.count; }, 0);
    if(!window.confirm("确定清空整个自定义词库（共 " + cnt + " 个词条）？此操作不可恢复。")) return;
    clearStage();
    el("trilLibOverlay").classList.remove("show"); pendingExample = null;
    if(window.__TRIL_LIB_ONSAVED) window.__TRIL_LIB_ONSAVED();
  }

  /* ---------- 导出 / 导入（跨设备备份，零后端） ---------- */
  function sigOf(e){ return [e.en||"", e.zh||"", e.bm||"", e.th||""].join("|"); }
  function findUnitByTitle(st, title){
    for(var i=0;i<(st.files||[]).length;i++){
      var us = st.files[i].units||[];
      for(var j=0;j<us.length;j++){ if(us[j].title === title) return us[j]; }
    }
    return null;
  }
  function entryExists(unit, e){
    var s = sigOf(e);
    return (unit.entries||[]).some(function(x){ return sigOf(x) === s; });
  }
  /* 把 imported 合并进 existing：同名单元追加词条、按签名去重，不丢现有词条 */
  function mergeStageInto(existing, imported){
    if(!existing || !existing.files) existing = { name: STAGE_NAME, files:[{ name:"自定义单元", units:[] }] };
    if(!imported || !Array.isArray(imported.files)) return existing;
    if(!existing.files.length) existing.files.push({ name:"自定义单元", units:[] });
    imported.files.forEach(function(f){
      (f.units||[]).forEach(function(u){
        var t = findUnitByTitle(existing, u.title);
        if(!t){ existing.files[0].units.push(u); }
        else { (u.entries||[]).forEach(function(e){ if(!entryExists(t, e)) t.entries.push(e); }); }
      });
    });
    return existing;
  }
  function exportStage(){
    try{
      var st = loadStage();
      var cnt = getUnits(st).reduce(function(a,u){ return a + u.count; }, 0);
      if(!cnt){ toast("词库是空的，没有可导出的内容"); return; }
      var blob = new Blob([JSON.stringify(st, null, 2)], { type:"application/json" });
      var url = URL.createObjectURL(blob);
      var a = document.createElement("a");
      a.href = url; a.download = "我的自定义词库.json";
      document.body.appendChild(a); a.click();
      document.body.removeChild(a);
      setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
      toast("✓ 已导出 " + cnt + " 条 → 我的自定义词库.json");
    }catch(e){ toast("导出失败：" + e.message); }
  }
  function importStageFromFile(ev){
    var file = ev.target.files && ev.target.files[0];
    ev.target.value = ""; // 允许重复选择同一文件
    if(!file) return;
    var reader = new FileReader();
    reader.onload = function(){
      try{
        var data = JSON.parse(reader.result);
        var imported = (data && data.files) ? data
          : (data && data.data && data.data.files) ? data.data : null;
        if(!imported){ toast("❌ 文件格式不对（不是词库备份）"); return; }
        if(!window.confirm("导入会与当前词库合并（同名单元追加、重复词条自动去重），不会丢失现有词条。确定导入？")) return;
        var st = loadStage();
        st = mergeStageInto(st, imported);
        if(!saveStage(st)){ toast("❌ 导入失败：浏览器存储已满"); return; }
        var cnt = getUnits(st).reduce(function(a,u){ return a + u.count; }, 0);
        rebuildUnitSelect(st, null);
        updatePreview(st, null);
        if(window.__TRIL_LIB_ONSAVED) window.__TRIL_LIB_ONSAVED();
        toast("✓ 导入完成，当前共 " + cnt + " 条");
      }catch(e){ toast("❌ 导入失败：" + e.message); }
    };
    reader.onerror = function(){ toast("❌ 读取文件失败"); };
    reader.readAsText(file);
  }

  function rebuildUnitSelect(st, selected){
    var sel = el("trilLibUnit");
    sel.innerHTML = "";
    getUnits(st).forEach(function(u){
      var o = document.createElement("option");
      o.value = u.f + ":" + u.u; o.textContent = u.title + " （" + u.count + " 词）";
      sel.appendChild(o);
    });
    var on = document.createElement("option");
    on.value = "new"; on.textContent = "★ 新建单元…";
    sel.appendChild(on);
    if(selected) sel.value = selected;
    sel.onchange = function(){ el("trilLibTitleWrap").style.display = (sel.value==="new") ? "block" : "none"; updatePreview(st); };
    sel.onchange();
  }

  function ensureUI(){
    if(injected) return; injected = true;
    var s = document.createElement("style"); s.textContent = CSS; document.head.appendChild(s);
    var ov = document.createElement("div"); ov.className = "tril-lib-overlay"; ov.id = "trilLibOverlay";
    ov.innerHTML = MODAL_HTML; document.body.appendChild(ov);
    el("trilLibAdd").onclick = addWord;
    el("trilLibTranslate").onclick = function(){ runTranslate(); };
    el("trilLibClear").onclick = clearAll;
    el("trilLibExport").onclick = exportStage;
    el("trilLibImport").onclick = function(){ var f = el("trilLibFile"); if(f) f.click(); };
    el("trilLibFile").onchange = importStageFromFile;
    el("trilLibClose").onclick = function(){ ov.classList.remove("show"); };
    ov.onclick = function(e){ if(e.target === ov) ov.classList.remove("show"); };
    // 逐字实时翻译：任意语言输入框 input 事件 -> 600ms 防抖自动翻译
    ["en","zh","bm","th"].forEach(function(k){
      var e = el("trilLib"+cap(k));
      if(e) e.addEventListener("input", onLangInput);
    });
    // 英文拼写纠错：失焦时检查
    var enEl = el("trilLibEn");
    if(enEl) enEl.addEventListener("blur", spellCheck);
  }
  function openEditor(opts){
    ensureUI();
    if(opts && typeof opts.onSaved === "function") window.__TRIL_LIB_ONSAVED = opts.onSaved;
    var st = loadStage();
    pendingExample = null; clearFields();
    rebuildUnitSelect(st, null);
    updatePreview(st, null);
    el("trilLibOverlay").classList.add("show");
    el("trilLibEn").focus();
  }

  window.TrilLib = {
    LS_KEY: LS_KEY, STAGE_NAME: STAGE_NAME,
    loadStage: loadStage, saveStage: saveStage, clearStage: clearStage,
    mergeStages: mergeStages, openEditor: openEditor,
    malayHanzi: malayHanzi /* 备用：便于调试 */
  };
})();

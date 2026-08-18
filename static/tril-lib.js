/* tril-lib.js — 三器共享「我的自定义词库」模块
 * 统一 localStorage key，提供编辑器 UI 与合并逻辑。
 * 学习器 / 测试器 / 播放器 共用，一处添加处处可见。
 *
 * 用法：
 *   const DATA = window.__Xxx_DATA__;
 *   TrilLib.mergeStages(DATA);                 // 词库加载后合并进 DATA.stages（放在扁平索引构建前）
 *   TrilLib.openEditor({ onSaved: ()=>{ rebuild(); renderNav(); } });  // 点「✎ 词库」时调用
 * 内部已处理存储、编辑器弹窗、加入/保存/清空。
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
    try{ localStorage.setItem(LS_KEY, JSON.stringify(st)); }catch(e){}
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

  /* ---------- 编辑器 UI ---------- */
  var CSS = [
    ".tril-lib-overlay{position:fixed;inset:0;background:rgba(0,0,0,.55);display:none;align-items:center;justify-content:center;z-index:100000;font:13px system-ui,sans-serif}",
    ".tril-lib-overlay.show{display:flex}",
    ".tril-lib-modal{width:440px;max-width:92vw;max-height:90vh;overflow:auto;background:var(--panel,#1a2030);color:var(--txt,#e6ebf5);border:1px solid var(--line,#2a3346);border-radius:14px;padding:18px;box-shadow:0 20px 60px rgba(0,0,0,.45)}",
    ".tril-lib-modal h2{margin:0 0 12px;font-size:16px}",
    ".tril-lib-field{margin-bottom:10px}",
    ".tril-lib-field label{display:block;margin-bottom:4px;color:var(--muted,#93a0bd);font-size:12px}",
    ".tril-lib-field input{width:100%;background:var(--panel2,#222a3a);color:var(--txt,#e6ebf5);border:1px solid var(--line,#2a3346);border-radius:8px;padding:9px;font-size:13px;box-sizing:border-box;outline:none}",
    ".tril-lib-field input:focus{border-color:var(--accent,#7aa2ff)}",
    ".tril-lib-btn{background:var(--panel2,#222a3a);color:var(--txt,#e6ebf5);border:1px solid var(--line,#2a3346);border-radius:8px;padding:9px 12px;font-size:13px;cursor:pointer}",
    ".tril-lib-btn:hover{border-color:var(--accent,#7aa2ff)}",
    ".tril-lib-btn.primary{background:linear-gradient(90deg,#6f9bff,#7aa2ff);border-color:transparent;color:#fff;font-weight:600}",
    ".tril-lib-preview{margin-top:8px;font-size:12px;color:var(--muted,#93a0bd);max-height:90px;overflow:auto;line-height:1.6}",
    ".tril-lib-toast{position:fixed;left:50%;bottom:32px;transform:translateX(-50%) translateY(20px);background:rgba(20,26,40,.95);color:#e6ebf5;border:1px solid var(--line,#2a3346);padding:10px 16px;border-radius:10px;font:13px system-ui;opacity:0;pointer-events:none;transition:.2s;z-index:100001}",
    ".tril-lib-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}"
  ].join("\n");

  var MODAL_HTML =
    '<div class="tril-lib-modal" style="width:440px">' +
      '<h2>✎ 我的自定义词库</h2>' +
      '<div class="tril-lib-field"><label>单元标题</label>' +
        '<input type="text" id="trilLibUnitTitle" placeholder="如：我的每日生词 / 工厂常用词"></div>' +
      '<div class="tril-lib-field"><label>词条（英文）</label>' +
        '<input type="text" id="trilLibEn" placeholder="apple"></div>' +
      '<div class="tril-lib-field"><label>中文释义</label>' +
        '<input type="text" id="trilLibZh" placeholder="苹果"></div>' +
      '<div class="tril-lib-field"><label>马来文</label>' +
        '<input type="text" id="trilLibBm" placeholder="epal"></div>' +
      '<div class="tril-lib-field"><label>泰文</label>' +
        '<input type="text" id="trilLibTh" placeholder="แอปเปิ้ล"></div>' +
      '<div class="tril-lib-field"><label>例句（中文，可选）</label>' +
        '<input type="text" id="trilLibEx" placeholder="我每天吃一个苹果。"></div>' +
      '<div class="tril-lib-field">' +
        '<button class="tril-lib-btn" id="trilLibAdd" style="width:100%">＋ 加入本单元</button>' +
        '<div class="tril-lib-preview" id="trilLibPreview"></div></div>' +
      '<div style="display:flex;gap:8px;margin-top:8px">' +
        '<button class="tril-lib-btn primary" id="trilLibSave" style="flex:1">💾 保存单元</button>' +
        '<button class="tril-lib-btn" id="trilLibClear" style="flex:1">🗑 清空</button>' +
        '<button class="tril-lib-btn" id="trilLibClose" style="flex:1">完成</button>' +
      '</div>' +
    '</div>';

  var injected = false, draft = [];
  function el(id){ return document.getElementById(id); }

  function toast(msg){
    var t = el("trilLibToast");
    if(!t){ t = document.createElement("div"); t.id = "trilLibToast"; t.className = "tril-lib-toast"; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(t._tm); t._tm = setTimeout(function(){ t.classList.remove("show"); }, 1800);
  }
  function updatePreview(){
    var pv = el("trilLibPreview");
    if(!draft.length){ pv.textContent = "（尚未添加词条，可逐条加入）"; return; }
    pv.innerHTML = draft.map(function(w,i){
      return (i+1) + ". " + (w.en||"") + (w.zh && w.en ? " / " : "") + (w.zh||"") +
             (w.bm ? " · BM:"+w.bm : "") + (w.th ? " · TH:"+w.th : "");
    }).join("<br>");
  }
  function addWord(){
    var en = el("trilLibEn").value.trim(), zh = el("trilLibZh").value.trim();
    if(!en && !zh){ toast("至少填写「英文」或「中文」"); return; }
    draft.push({ en:en, zh:zh, bm:el("trilLibBm").value.trim(), th:el("trilLibTh").value.trim(),
      example: el("trilLibEx").value.trim() ? { zh: el("trilLibEx").value.trim() } : {} });
    ["trilLibEn","trilLibZh","trilLibBm","trilLibTh","trilLibEx"].forEach(function(id){ el(id).value = ""; });
    el("trilLibEn").focus(); updatePreview(); toast("已加入，可继续添加");
  }
  function saveUnit(){
    var title = el("trilLibUnitTitle").value.trim() || ("自定义单元 " + new Date().toLocaleDateString());
    if(!draft.length){ toast("请先添加至少一条词条"); return; }
    var st = loadStage();
    st.files[0].units.push({ title:title, type:"table", langs:["en","bm","zh","th"],
      entries: draft.map(function(d){ return { en:d.en, bm:d.bm, zh:d.zh, th:d.th, example:d.example }; }),
      summary:"", notes:"" });
    saveStage(st);
    el("trilLibOverlay").classList.remove("show");
    draft = []; updatePreview();
    if(window.__TRIL_LIB_ONSAVED) window.__TRIL_LIB_ONSAVED();
  }
  function clearAll(){
    if(!window.confirm("确定清空整个自定义词库？此操作不可恢复。")) return;
    clearStage();
    el("trilLibOverlay").classList.remove("show"); draft = []; updatePreview();
    if(window.__TRIL_LIB_ONSAVED) window.__TRIL_LIB_ONSAVED();
  }
  function ensureUI(){
    if(injected) return; injected = true;
    var s = document.createElement("style"); s.textContent = CSS; document.head.appendChild(s);
    var ov = document.createElement("div"); ov.className = "tril-lib-overlay"; ov.id = "trilLibOverlay";
    ov.innerHTML = MODAL_HTML; document.body.appendChild(ov);
    el("trilLibAdd").onclick = addWord;
    el("trilLibSave").onclick = saveUnit;
    el("trilLibClear").onclick = clearAll;
    el("trilLibClose").onclick = function(){ ov.classList.remove("show"); };
    ov.onclick = function(e){ if(e.target === ov) ov.classList.remove("show"); };
  }
  function openEditor(opts){
    ensureUI();
    if(opts && typeof opts.onSaved === "function") window.__TRIL_LIB_ONSAVED = opts.onSaved;
    draft = []; updatePreview();
    el("trilLibUnitTitle").value = "";
    ["trilLibEn","trilLibZh","trilLibBm","trilLibTh","trilLibEx"].forEach(function(id){ el(id).value = ""; });
    el("trilLibOverlay").classList.add("show");
    el("trilLibEn").focus();
  }

  window.TrilLib = {
    LS_KEY: LS_KEY, STAGE_NAME: STAGE_NAME,
    loadStage: loadStage, saveStage: saveStage, clearStage: clearStage,
    mergeStages: mergeStages, openEditor: openEditor
  };
})();

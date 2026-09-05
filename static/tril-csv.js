/*!
 * tril-csv.js —— 四语 CSV/TSV 导入导出共享工具
 *
 * 列格式（Tab 分隔，便于在 Excel/Numbers 直接打开）：
 *   en  bm  zh  th  en_ipa  bm_pron  zh_pinyin  th_pron  level  ex_en  ex_bm  ex_zh  ex_th
 *
 * 典型用例：
 *   trilCSV.exportEntries(rows, filename)              // rows: [{en,bm,zh,th,level,example{...},...}]
 *   trilCSV.importEntries(function(entries){...})      // 入参 callback(数组)
 *   trilCSV.exportCustomUnits()  / importCustomUnits()
 */
(function(){
  "use strict";

  const HEADER = ["en","bm","zh","th","en_ipa","bm_pron","zh_pinyin","th_pron","level","ex_en","ex_bm","ex_zh","ex_th"];
  const SEP = "\t";        // Tab 分隔，避免四语多字节被逗号干扰
  const BOM = "\uFEFF";    // Excel 自动识别 UTF-8

  function escapeCell(v){
    if(v == null) return "";
    return String(v).replace(/[\t\r\n]+/g, " ").trim();
  }

  function rowToTSV(e){
    const ex = (typeof e.example === "object" && e.example) ? e.example : {};
    return [
      e.en || "",
      e.bm || "",
      e.zh || "",
      e.th || "",
      e.en_ipa || "",
      e.bm_pron || "",
      e.zh_pinyin || "",
      e.th_pron || "",
      e.level || "",
      ex.en || "",
      ex.bm || "",
      ex.zh || "",
      ex.th || ""
    ].map(escapeCell).join(SEP);
  }

  function tsvToRow(line){
    if(!line) return null;
    const cells = line.split(SEP);
    if(cells.length < 1) return null;
    // 自动识别表头
    if(/^(en|english|英文)/i.test((cells[0]||"").trim())) return null;
    const o = {
      en: cells[0] || "",
      bm: cells[1] || "",
      zh: cells[2] || "",
      th: cells[3] || ""
    };
    if(cells[4]) o.en_ipa = cells[4];
    if(cells[5]) o.bm_pron = cells[5];
    if(cells[6]) o.zh_pinyin = cells[6];
    if(cells[7]) o.th_pron = cells[7];
    if(cells[8]) o.level = cells[8];
    const ex = {};
    if(cells[9]) ex.en = cells[9];
    if(cells[10]) ex.bm = cells[10];
    if(cells[11]) ex.zh = cells[11];
    if(cells[12]) ex.th = cells[12];
    if(ex.en || ex.bm || ex.zh || ex.th) o.example = ex;
    // 过滤空行
    if(!o.en && !o.bm && !o.zh && !o.th) return null;
    return o;
  }

  function triggerDownload(text, filename, mime){
    const blob = new Blob([text], {type: mime || "text/tab-separated-values;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>{ try{ URL.revokeObjectURL(url); }catch(e){} }, 800);
  }

  function parseFile(file, onDone, onError){
    if(!file){ if(onError) onError("no file"); return; }
    const r = new FileReader();
    r.onload = function(){
      try{
        const text = String(r.result || "");
        const lines = text.split(/\r?\n/).filter(function(l){ return l && l.trim(); });
        const out = [];
        lines.forEach(function(l){
          const row = tsvToRow(l);
          if(row) out.push(row);
        });
        onDone(out, lines.length);
      }catch(e){
        if(onError) onError(e.message || String(e));
      }
    };
    r.onerror = function(){ if(onError) onError("read failed"); };
    r.readAsText(file, "utf-8");
  }

  /* ===== Public ===== */
  function exportEntries(entries, filename, opts){
    opts = opts || {};
    if(!entries || !entries.length) return 0;
    const tsv = BOM + HEADER.join(SEP) + "\n" + entries.map(rowToTSV).join("\n") + "\n";
    const fname = filename || ("tril_words_" + new Date().toISOString().slice(0,10) + ".tsv");
    triggerDownload(tsv, fname);
    return entries.length;
  }

  function importEntries(callback){
    const inp = document.createElement("input");
    inp.type = "file";
    inp.accept = ".tsv,.csv,.txt,text/tab-separated-values,text/csv";
    inp.style.display = "none";
    document.body.appendChild(inp);
    inp.addEventListener("change", function(ev){
      const f = ev.target.files[0];
      inp.remove();
      if(!f){ return; }
      parseFile(f, function(rows, total){
        if(typeof callback === "function") callback(rows, total, f.name);
      }, function(err){
        if(typeof callback === "function") callback([], 0, err);
      });
    });
    inp.click();
  }

  /* ===== 自定义词库（CUSTOM_SI）支持 ===== */
  const LS_CUSTOM = "tril_custom_units_v1";

  function loadCustom(){
    try{
      const v = JSON.parse(localStorage.getItem(LS_CUSTOM) || "{}");
      return (v && v.units) || [];
    }catch(e){ return []; }
  }
  function saveCustom(units){
    try{ localStorage.setItem(LS_CUSTOM, JSON.stringify({units: units})); }
    catch(e){}
  }

  /* 把导入的 entries 包装成一个 unit（追加模式，不覆盖已有） */
  function appendCustomUnit(entries, title){
    if(!entries || !entries.length) return null;
    const units = loadCustom();
    const unit = {
      title: title || ("导入词库 " + new Date().toISOString().slice(0,16).replace("T"," ")),
      entries: entries,
      type: "table",
      langs: ["en","bm","zh","th"],
      summary: "由 CSV 导入，共 " + entries.length + " 条。",
      notes: ""
    };
    units.push(unit);
    saveCustom(units);
    return unit;
  }

  function importAsCustomUnit(title, callback){
    importEntries(function(rows){
      if(!rows.length){ if(callback) callback(null, 0, "空文件"); return; }
      const u = appendCustomUnit(rows, title);
      if(callback) callback(u, rows.length);
    });
  }

  /* ===== 全局暴露 ===== */
  window.trilCSV = {
    HEADER: HEADER,
    SEP: SEP,
    rowToTSV: rowToTSV,
    tsvToRow: tsvToRow,
    exportEntries: exportEntries,
    importEntries: importEntries,
    importAsCustomUnit: importAsCustomUnit,
    appendCustomUnit: appendCustomUnit,
    loadCustom: loadCustom
  };
})();

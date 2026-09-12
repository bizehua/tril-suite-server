/* tril-core.js — 分片加载核心（按需 + IndexedDB 缓存）
 *
 * 学习器使用：仅在用户打开某个单元时按需加载对应分片；之后从 IndexedDB 读，
 * 避免重复下载 30MB 数据。测试器 / 播放器 / 闪记仍可在 head 直接
 * 引入 part1-4.js 并同步组装 window.__TRIL_DATA__（旧式 4 段分片），
 * 它们不需要本文件的异步 API。
 *
 * 用法：
 *   await TrilCore.loadPart(2);                    // 按需加载分片 3（stage 6）
 *   const stage = TrilCore.getStageByGlobal(6);    // 取全局 stage[6]（自动按需加载所在分片）
 *   await TrilCore.loadAll();                      // 一次性全加载（一般给非学习器用）
 *
 * 依赖：tril-db.js（若未加载，IDB 缓存降级为 no-op，依然可正常联网加载）。
 */
(function(){
  "use strict";
  var PARTS_TOTAL = 4;
  var PART_PREFIX = "三语母语习得核心词库.part";
  var cacheStore = "parts_v6";

  window.__TRIL_PARTS__ = window.__TRIL_PARTS__ || [];

  var loadPromises = [];      // loadPart(k) 的 Promise 缓存
  var readyAll = null;        // loadAll() 的 Promise
  var cb = [];                // loadAll 完成回调

  function hasDB(){ return !!window.TrilDB; }

  function injectScript(k){
    return new Promise(function(resolve){
      var s = document.createElement("script");
      s.src = PART_PREFIX + (k + 1) + ".js";
      s.async = false;
      s.onload  = function(){ resolve(window.__TRIL_PARTS__[k] || null); };
      s.onerror = function(){ resolve(null); };
      document.head.appendChild(s);
    });
  }

  function loadPart(k){
    if(k < 0 || k >= PARTS_TOTAL) return Promise.resolve(null);
    if(window.__TRIL_PARTS__[k]) return Promise.resolve(window.__TRIL_PARTS__[k]);
    if(loadPromises[k]) return loadPromises[k];

    loadPromises[k] = (async function(){
      // 1) 优先 IDB 缓存
      var cached = null;
      if(hasDB()){
        try{ cached = await TrilDB.get(cacheStore, "p" + k); }catch(e){}
      }
      if(cached){
        window.__TRIL_PARTS__[k] = cached;
        fire();
        return cached;
      }
      // 2) 网络加载
      var data = await injectScript(k);
      if(data && hasDB()){
        try{ await TrilDB.set(cacheStore, "p" + k, data); }catch(e){}
      }
      fire();
      return data;
    })();

    return loadPromises[k];
  }

  function getPartIdx(globalStageIdx){
    var idx = window.__TRIL_INDEX__;
    if(!idx) return -1;
    for(var i=0;i<idx.partRanges.length;i++){
      if(globalStageIdx >= idx.partRanges[i][0] && globalStageIdx < idx.partRanges[i][1]) return i;
    }
    return -1;
  }

  function getStageByGlobal(si){
    var idx = window.__TRIL_INDEX__;
    var k = getPartIdx(si);
    if(k < 0) return null;
    if(!window.__TRIL_PARTS__[k]) return null;
    return window.__TRIL_PARTS__[k][si - idx.partRanges[k][0]] || null;
  }

  async function getStageByGlobalAsync(si){
    var k = getPartIdx(si);
    if(k < 0) return null;
    await loadPart(k);
    return getStageByGlobal(si);
  }

  function assemble(){
    var all = [];
    for(var k=0;k<PARTS_TOTAL;k++){
      if(window.__TRIL_PARTS__[k]) all = all.concat(window.__TRIL_PARTS__[k]);
    }
    return all;
  }

  function loadAll(){
    if(readyAll) return readyAll;
    readyAll = (async function(){
      var ps = [];
      for(var k=0;k<PARTS_TOTAL;k++) ps.push(loadPart(k));
      await Promise.all(ps);
      window.__TRIL_DATA__ = assemble();
      for(var i=0;i<cb.length;i++){ try{ cb[i](); }catch(e){} }
      return window.__TRIL_DATA__;
    })();
    return readyAll;
  }

  function onReadyAll(fn){ cb.push(fn); if(readyAll) try{ fn(); }catch(e){} }

  function fire(){
    // 部分分片加载完成不触发 loadAll 回调，仅在全部到位时由 loadAll 触发
  }

  window.TrilCore = {
    PARTS_TOTAL: PARTS_TOTAL,
    loadPart: loadPart,
    loadAll:  loadAll,
    assemble: assemble,
    onReadyAll: onReadyAll,
    isLoaded: function(k){ return !!window.__TRIL_PARTS__[k]; },
    getStageByGlobal: getStageByGlobal,
    getStageByGlobalAsync: getStageByGlobalAsync,
    getPartIdx: getPartIdx,
  };
})();
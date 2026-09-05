/* tril-db.js — 阶段0.2 IndexedDB 封装 + localStorage 自动迁移
 *
 * 提供 Promise 化的 IDB 操作 + 自动迁移工具。命名空间隔离：
 *   store "kv"   : 小体积 KV（学习进度、收藏、设置、自定义词库等）
 *   store "parts": 大体积分片缓存（分片 JSON，避免每次访问重复下载 30MB）
 *
 * 用法：
 *   await TrilDB.open();
 *   await TrilDB.set("kv",   "progress", {0_0_0:{done:true}});
 *   const v = await TrilDB.get("kv", "progress");
 *   await TrilDB.set("parts","p2", [...stages...]);
 *   await TrilDB.migrate({  // 一键从 localStorage 迁到 IDB（幂等）
 *     "tril_root_progress_v1": "progress",
 *     "tril_marks_v1":         "marks",
 *     "tril_root_settings_v1": "settings",
 *     "tril_custom_units_v1":  "customUnits",
 *   });
 *
 * 不支持 IDB 的环境（含 file:// 私有模式）下所有操作安全降级为 no-op，
 * 调用方应保留 localStorage 兜底逻辑。
 */
(function(){
  "use strict";
  var DB_NAME = "tril_suite_v1";
  var DB_VER  = 1;
  var STORES  = ["kv", "parts"];
  var dbp = null;

  function open(){
    if(dbp) return dbp;
    if(!window.indexedDB){
      dbp = Promise.reject(new Error("no IDB"));
      return dbp;
    }
    dbp = new Promise(function(resolve, reject){
      var req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = function(e){
        var db = e.target.result;
        for(var i=0;i<STORES.length;i++){
          if(!db.objectStoreNames.contains(STORES[i])) db.createObjectStore(STORES[i]);
        }
      };
      req.onsuccess = function(e){ resolve(e.target.result); };
      req.onerror   = function(e){ reject(e.target.error); };
    });
    return dbp;
  }

  function tx(store, mode, fn){
    return open().then(function(db){
      return new Promise(function(resolve, reject){
        var t = db.transaction(store, mode).objectStore(store);
        var out = fn(t);
        if(out && typeof out.then === "function"){
          out.then(resolve, reject);
        } else {
          t.transaction.oncomplete = function(){ resolve(out); };
          t.transaction.onerror   = function(e){ reject(e.target.error); };
          t.transaction.onabort   = function(e){ reject(e.target.error); };
        }
      });
    });
  }

  function get(store, key){
    return tx(store, "readonly", function(t){
      return new Promise(function(res){
        var r = t.get(key);
        r.onsuccess = function(){ res(r.result); };
        r.onerror   = function(){ res(undefined); };
      });
    }).catch(function(){ return undefined; });
  }

  function set(store, key, val){
    return tx(store, "readwrite", function(t){
      t.put(val, key);
      return new Promise(function(res){ var r=t.put(val,key); r.onsuccess=function(){res(true);}; r.onerror=function(){res(false);}; });
    }).catch(function(){ return false; });
  }

  function del(store, key){
    return tx(store, "readwrite", function(t){
      return new Promise(function(res){ var r=t.delete(key); r.onsuccess=function(){res(true);}; r.onerror=function(){res(false);}; });
    }).catch(function(){ return false; });
  }

  function keys(store){
    return tx(store, "readonly", function(t){
      return new Promise(function(res){
        var out = [];
        var r = t.openKeyCursor();
        r.onsuccess = function(e){
          var c = e.target.result;
          if(c){ out.push(c.key); c.continue(); } else { res(out); }
        };
        r.onerror = function(){ res([]); };
      });
    }).catch(function(){ return []; });
  }

  /* 一次性把给定 localStorage 键迁到 kv 库（幂等：迁移完成后写 __migrated__ 标记） */
  function migrate(map){
    return open().then(function(db){
      return new Promise(function(resolve){
        var t = db.transaction("kv","readwrite").objectStore("kv");
        var g = t.get("__migrated__");
        g.onsuccess = function(){
          if(g.result){
            resolve(false); return;
          }
          var pending = 0, moved = 0;
          for(var lsKey in map){
            var raw=null; try{ raw = localStorage.getItem(lsKey); }catch(e){}
            if(raw != null){
              pending++;
              (function(k, v){
                var p = t.put(v, k);
                p.onsuccess = function(){
                  try{ localStorage.removeItem(lsKey); }catch(e){}
                  if(++moved >= pending){
                    t.put("1","__migrated__");
                    resolve(true);
                  }
                };
                p.onerror = function(){ if(++moved >= pending) resolve(false); };
              })(map[lsKey], raw);
            }
          }
          if(pending === 0){
            t.put("1","__migrated__");
            resolve(false);
          }
        };
        g.onerror = function(){ resolve(false); };
      });
    }).catch(function(){ return false; });
  }

  window.TrilDB = {
    open: open, get: get, set: set, del: del, keys: keys, migrate: migrate,
    DB_NAME: DB_NAME, DB_VER: DB_VER,
  };
})();
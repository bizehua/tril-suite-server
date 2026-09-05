/* tril-migrate.js — 一次性 localStorage → IndexedDB 镜像（fire-and-forget；幂等）
 *
 * 放在 tril-db.js 之后、所有 app 业务逻辑之前即可。运行时扫描已知 LS 键并
 * 镜像到 kv store。已迁移（__migrated__ 存在）则跳过。
 *
 * 注意：源 LS 数据不动，各 app 仍按现有 LS 流程运行；IDB 仅作 fallback
 * / 跨设备同步的预备层。后续 task 可选择读 IDB 优先 + LS 兜底。
 *
 * 触发时机：DOMContentLoaded 或直接执行（脚本若 defer 加载已完成则同步跑）。
 *
 * 无外部依赖：window.TrilDB 必须存在（tril-db.js 已先加载）。
 */
(function(){
  "use strict";
  if(!window.TrilDB) return;

  /* 完整映射表：覆盖所有 app 的 LS 键。第一次跑全部命中，后续跑了空运行 */
  var MIRROR_MAP = {
    /* 学习器 */
    "tril_root_progress_v1":   "learnerProgress",
    "tril_marks_v1":           "marks",
    "tril_root_settings_v1":   "learnerSettings",
    "tril_custom_units_v1":    "customUnits",
    /* 测试器 */
    "tril_wrongbook_v1":       "wrongbook",
    /* 播放器 */
    "tril_player_settings_v1": "playerSettings",
    /* 闪记 */
    "tril_flash_mastery_v1":   "flashMastery",
    "tril_flash_done_v1":      "flashDone",
    "tril_flash_settings_v1":  "flashSettings",
    /* 复习 */
    "tril_review_v1":          "review",
    "tril_review_meta_v1":     "reviewMeta",
    /* 学习时长 (stage 2-C) */
    "tril_study_sessions_v1":  "studySessions"
  };

  function boot(){
    try{
      TrilDB.open().then(function(){
        return TrilDB.migrate(MIRROR_MAP);
      }).then(function(migrated){
        if(migrated && window.console){
          console.log("[tril-migrate] LS → IDB 已迁移，下次不再执行");
        }
      }).catch(function(){ /* file:// 或无 IDB 环境静默降级 */ });
    }catch(e){}
  }

  if(document.readyState === "loading"){
    document.addEventListener("DOMContentLoaded", boot, {once: true});
  } else {
    boot();
  }
})();

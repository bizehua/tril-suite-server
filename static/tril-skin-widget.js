/* =========================================================
   tril-skin-widget.js — 皮肤切换器（阶段 5+6）
   在任何引入本文件的页面顶栏注入 🎨 皮肤下拉：
   - 跟随 tril-skin.js 的 TrilSkin.set / get
   - 支持节日主题（自动检测或手动选）
   - 切换后整站即时刷新（无闪烁）
   依赖：tril-skin.js 先加载（TrilSkin 必须存在）
   ========================================================= */
(function(){
  "use strict";
  if(!window.TrilSkin) return;

  /* 节日皮肤：根据月份自动推荐（用户手动切换后 30 天内不自动改） */
  var FESTIVALS = [
    { skin:"chunjie",  label:"🧧 春节",    months:[1, 2],  desc:"红金 · 迎新纳福" },
    { skin:"kaifa",    label:"🌙 开斋节",  months:[3, 4],  desc:"青绿 · 斋月结束" },
    { skin:"zhongqiu", label:"🥮 中秋",    months:[9, 10], desc:"皓月 · 团圆" }
  ];

  function festivalForNow(){
    var m = new Date().getMonth() + 1;
    for(var i = 0; i < FESTIVALS.length; i++){
      var f = FESTIVALS[i];
      for(var j = 0; j < f.months.length; j++){
        if(f.months[j] === m) return f;
      }
    }
    return null;
  }

  function build(){
    /* 若页面已注入则跳过 */
    if(document.getElementById("trilSkinBtn")) return;
    var SKINS = [
      ["default",  "🌊 默认蓝"],
      ["guofeng",  "🏮 中国风"],
      ["malaysia", "🇲🇾 马来西亚"]
    ];
    /* 节日推荐 */
    var fest = festivalForNow();
    if(fest){
      SKINS.push([fest.skin, fest.label]);
    } else {
      /* 没有节日时也开放所有节日皮肤 */
      SKINS.push(["chunjie", "🧧 春节"]);
      SKINS.push(["kaifa",   "🌙 开斋节"]);
      SKINS.push(["zhongqiu","🥮 中秋"]);
    }

    /* 找 header：优先 header，其次 body 顶部 */
    var host = document.querySelector("header") || document.body;
    if(!host) return;

    var btn = document.createElement("button");
    btn.id = "trilSkinBtn";
    btn.type = "button";
    btn.title = "切换皮肤（整站生效，30 天记忆）";
    btn.style.cssText =
      "padding:6px 10px;font-size:13px;border-radius:9px;border:1px solid var(--line);" +
      "background:var(--panel2);color:var(--txt);cursor:pointer;transition:.15s;" +
      "display:inline-flex;align-items:center;gap:5px;margin-left:8px;vertical-align:middle";
    btn.innerHTML = '<span>🎨</span><span id="trilSkinName">' + (curLabel(TrilSkin.get()) || "默认") + '</span>';

    /* 下拉 */
    var menu = document.createElement("div");
    menu.id = "trilSkinMenu";
    menu.style.cssText =
      "position:absolute;z-index:9999;background:var(--panel);border:1px solid var(--line);" +
      "border-radius:11px;padding:5px;min-width:150px;display:none;box-shadow:0 6px 18px var(--shadow)";
    SKINS.forEach(function(s){
      var item = document.createElement("div");
      item.dataset.skin = s[0];
      item.textContent = s[1];
      item.style.cssText =
        "padding:7px 10px;border-radius:7px;font-size:13px;color:var(--txt);cursor:pointer;" +
        "display:flex;justify-content:space-between;align-items:center;transition:.1s";
      item.onmouseenter = function(){ item.style.background = "var(--btn-hover)"; };
      item.onmouseleave = function(){ item.style.background = "transparent"; };
      item.onclick = function(){
        TrilSkin.set(s[0]);
        var name = document.getElementById("trilSkinName");
        if(name) name.textContent = s[1].replace(/^[^ ]+ /, "");
        menu.style.display = "none";
      };
      menu.appendChild(item);
    });

    function curLabel(skin){
      for(var i = 0; i < SKINS.length; i++){
        if(SKINS[i][0] === skin) return SKINS[i][1].replace(/^[^ ]+ /, "");
      }
      return "自定义";
    }

    /* 当前皮肤打勾 */
    function markActive(){
      var items = menu.querySelectorAll("[data-skin]");
      items.forEach(function(it){
        var isCur = it.dataset.skin === TrilSkin.get();
        it.style.fontWeight = isCur ? "700" : "400";
        it.innerHTML = it.textContent + (isCur ? ' <span style="color:var(--ok)">✓</span>' : "");
      });
    }

    btn.onclick = function(e){
      e.stopPropagation();
      markActive();
      var isOpen = menu.style.display !== "none";
      menu.style.display = isOpen ? "none" : "block";
      if(!isOpen){
        /* 跟随按钮位置 */
        var r = btn.getBoundingClientRect();
        menu.style.top = (r.bottom + window.scrollY + 6) + "px";
        menu.style.left = Math.max(8, r.left + window.scrollX - 90) + "px";
        if(!menu.parentNode){ document.body.appendChild(menu); }
      }
    };
    /* 点外部关闭 */
    document.addEventListener("click", function(e){
      if(menu.parentNode && !menu.contains(e.target) && e.target !== btn && !btn.contains(e.target)){
        menu.style.display = "none";
      }
    });

    /* 把按钮插入 header（或 body 顶部） */
    try{
      var spacer = host.querySelector(".spacer") || host.querySelector("span.spacer");
      if(spacer && spacer.parentNode){
        spacer.parentNode.insertBefore(btn, spacer);
      } else {
        host.appendChild(btn);
      }
    }catch(e){
      host.appendChild(btn);
    }
  }

  /* DOM ready */
  function boot(){
    if(document.readyState === "loading"){
      document.addEventListener("DOMContentLoaded", build, { once:true });
    } else { build(); }
  }
  boot();
})();

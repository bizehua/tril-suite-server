/* =========================================================
   tril-skin.js — 皮肤主题键接入（阶段0.6）
   - 读取 localStorage.tril_skin（{skin, exp}，保留 30 天，F3）
   - 在 <html> 上写入 data-skin，由 tril-skin.css 的
     html[data-skin="..."] 选择器即时整站换肤（无闪烁）
   - 暴露 window.TrilSkin：get / set / list
   ========================================================= */
(function(){
  var KEY = 'tril_skin';
  var TTL = 30 * 24 * 3600 * 1000; // 30 天

  function read(){
    try{
      var o = JSON.parse(localStorage.getItem(KEY) || 'null');
      if(o && o.skin){
        if(o.exp && Date.now() > o.exp){ try{localStorage.removeItem(KEY);}catch(e){} return 'default'; }
        return o.skin;
      }
    }catch(e){}
    return 'default';
  }

  // index.html 的「背景/字体」色块会把 --bg 等写成内联样式，
  // 优先级最高，会盖掉皮肤。非默认皮肤时清掉这些内联变量，交还 CSS 控制。
  function clearInlineTheme(){
    var r = document.documentElement;
    ['--bg','--bg2','--txt','--panel','--panel2','--line','--muted','--shadow']
      .forEach(function(p){ try{ r.style.removeProperty(p); }catch(e){} });
  }

  var api = {
    get: read,
    set: function(skin){
      skin = skin || 'default';
      try{ localStorage.setItem(KEY, JSON.stringify({ skin:skin, exp: Date.now() + TTL })); }catch(e){}
      if(skin !== 'default'){ clearInlineTheme(); }
      document.documentElement.setAttribute('data-skin', skin);
      try{ window.dispatchEvent(new CustomEvent('tril-skin-change', { detail:{ skin:skin } })); }catch(e){}
    },
    list: function(){ return [['default','默认'],['guofeng','中国风'],['malaysia','马来西亚']]; }
  };
  window.TrilSkin = api;

  // 立即应用（此时 <html> 已存在，可在首屏绘制前完成，避免闪烁）
  var s = read();
  if(s !== 'default'){ clearInlineTheme(); }
  document.documentElement.setAttribute('data-skin', s);
})();

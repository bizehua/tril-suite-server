/* 四语母语习得 · 转译模式 (英语母语者视角重表达 + 自带纠错)
 * 依赖 auth-client.js 暴露的 window.TRIL_CURRENT。所有用户可用(含离线)。 */
(function(){
  'use strict';
  function $(s){return document.querySelector(s);}
  function el(id){return document.getElementById(id);}
  function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}

  function injectCSS(){
    if(el('trilTrCss')) return;
    var c=document.createElement('style'); c.id='trilTrCss';
    c.textContent='#trilTr{position:fixed;right:10px;bottom:10px;z-index:99993;width:340px;max-width:94vw;background:#0f1729;color:#e8edf7;border:1px solid #2c3756;border-radius:14px;padding:14px;display:none;font:13px system-ui;box-shadow:0 16px 48px rgba(0,0,0,.5)}'+
      '#trilTr.show{display:block}#trilTr h4{margin:0 0 8px;font-size:14px;color:#5b8cff}#trilTr .closex{position:absolute;top:8px;right:10px;cursor:pointer;color:#93a0bd}#trilTr .src{background:#1a2238;border:1px solid #2c3756;border-radius:10px;padding:8px;margin-bottom:8px;line-height:1.6}'+
      '#trilTr textarea{width:100%;height:70px;background:#11192c;color:#e8edf7;border:1px solid #2c3756;border-radius:9px;padding:8px;box-sizing:border-box;font:13px system-ui;resize:vertical}'+
      '#trilTr .chk label{display:block;font-size:12px;margin:3px 0;cursor:pointer}#trilTr .mini{margin-top:8px;padding:7px 10px;border:none;border-radius:8px;background:#2563eb;color:#fff;cursor:pointer;font-size:12px}'+
      '#trilTr .model{margin-top:8px;background:#10241c;border:1px solid #1f6f54;border-radius:10px;padding:8px;font-size:12px;line-height:1.7;display:none}#trilTr .tip{margin-top:8px;color:#93a0bd;font-size:11px;line-height:1.6}'+
      '#trilTrBtn{position:fixed;left:10px;bottom:10px;z-index:99993;padding:9px 13px;border:none;border-radius:20px;background:#c792ea;color:#1a1030;font:13px system-ui;font-weight:700;cursor:pointer;box-shadow:0 6px 18px rgba(0,0,0,.3)}';
    document.head.appendChild(c);
  }

  function buildModel(c){
    var en=c.en||'', zh=c.zh||'', bm=c.bm||'', th=c.th||'';
    var parts=[];
    if(en) parts.push('We would naturally say “'+en+'.”');
    if(zh) parts.push('It means '+zh+'（中文释义）');
    if(bm) parts.push('Malay: '+bm);
    if(th) parts.push('Thai: '+th);
    if(c.pos) parts.push('Part of speech: '+c.pos+'.');
    if(c.scene) parts.push('Typical scene: '+c.scene);
    return parts.join(' ');
  }

  function openPanel(){
    var box=el('trilTr'); if(!box) return;
    var c=window.TRIL_CURRENT||{};
    var has=Object.keys(c).length>0;
    box.querySelector('.src').innerHTML = has
      ? ('EN <b>'+esc(c.en)+'</b><br>BM <b style="color:#ffb454">'+esc(c.bm)+'</b><br>ZH <b style="color:#4fd1a5">'+esc(c.zh)+'</b><br>TH <b style="color:#c792ea">'+esc(c.th)+'</b>'+(c.pos?'<br>词性: '+esc(c.pos):'')+(c.root?'<br>词根: '+esc(c.root):''))
      : '（请先在词条上点击以载入当前词）';
    box.querySelector('.model').style.display='none';
    box.querySelector('textarea').value='';
    box.classList.add('show');
  }

  function init(){
    injectCSS();
    var btn=document.createElement('button'); btn.id='trilTrBtn'; btn.textContent='🔁 转译';
    btn.onclick=openPanel; document.body.appendChild(btn);
    var box=document.createElement('div'); box.id='trilTr';
    box.innerHTML='<span class="closex" onclick="TrilTr.hide()">✕</span><h4>🔁 转译 · 英语母语者视角</h4>'+
      '<div class="src"></div>'+
      '<div style="font-size:12px;color:#93a0bd;margin-bottom:4px">用英语母语者思维重写这句话/这个词：</div>'+
      '<textarea placeholder="例如: 不用逐字翻译，而是用地道英文表达其含义与场景…"></textarea>'+
      '<div class="chk" style="margin-top:6px"><b style="font-size:12px">自带纠错清单：</b>'+
      '<label><input type="checkbox"> ✓ 用上了核心词义，而非字面直译</label>'+
      '<label><input type="checkbox"> ✓ 时态 / 单复数 / 冠词正确</label>'+
      '<label><input type="checkbox"> ✓ 用了地道搭配（collocation）</label>'+
      '<label><input type="checkbox"> ✓ 符合英语信息焦点与语序</label></div>'+
      '<button class="mini" onclick="TrilTr.genModel()">生成母语者范例对照</button>'+
      '<div class="model"></div>'+
      '<div class="tip">思维底层：英语重「主谓宾+修饰后置」，中文重「话题+评论」，马来语受梵语/阿拉伯语影响常用被动与尊称。转译时先抓<strong>概念</strong>而非<strong>词</strong>，再按英语世界观重组。</div>';
    document.body.appendChild(box);
    window.TrilTr={ hide:function(){box.classList.remove('show');}, genModel:function(){ var m=box.querySelector('.model'); m.style.display='block'; m.innerHTML='<b>母语者范例：</b><br>'+esc(buildModel(window.TRIL_CURRENT||{})); } };
  }
  if(document.readyState!=='loading') init(); else document.addEventListener('DOMContentLoaded', init);
})();

/* 四语母语习得 · 共享认证/权限/管理客户端 (零依赖, 可离线降级)
 * 用法: 在页面 <body> 末尾引入 <script src="auth-client.js"></script>
 * 页面只需提供:
 *   <div id="trilTopbar"></div>           // 登录/身份条 (可选, 自动创建)
 *   <div id="trilAdminPanel"></div>       // 管理员面板容器 (可选)
 *   window.TRIL_CURRENT = {en,bm,zh,th,root,pos,scene,...}  // 当前词条(各app自行赋值, 用于扩展模块)
 * 角色门控: 给元素加 class:
 *   auth-show-admin  -> 仅管理员可见
 *   auth-hide-when-auth -> 登录后隐藏(如"登录"按钮)
 *   auth-show-when-auth -> 仅登录后可见
 */
(function(){
  'use strict';
  var API = (location.protocol === 'file:') ? null : ''; // 相对路径; file:// 下为离线
  var LS_TOKEN = 'tril_token', LS_USER='tril_user', LS_ROLE='tril_role';
  var state = { online: API!==null, token:null, user:null, role:null, start: Date.now(), settings:{} };
  var root = document.documentElement;

  function $(s){ return document.querySelector(s); }
  function el(id){ return document.getElementById(id); }
  function h(tag, attrs, html){ var e=document.createElement(tag); if(attrs) for(var k in attrs) e.setAttribute(k,attrs[k]); if(html!=null) e.innerHTML=html; return e; }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }

  function injectCSS(){
    if(el('trilAuthCSS')) return;
    var css = document.createElement('style'); css.id='trilAuthCSS';
    css.textContent = `
    #trilTopbar{display:flex;gap:8px;align-items:center;margin-left:auto;flex-shrink:0}
    #trilTopbar.floating{position:fixed;top:0;left:0;right:0;z-index:99990;background:rgba(15,23,42,.82);backdrop-filter:blur(6px);color:#e8edf7;font:13px system-ui,sans-serif;padding:6px 12px;justify-content:flex-end}
    #trilTopbar .tril-userbtn{font:13px system-ui;padding:5px 12px;border:none;border-radius:8px;background:#2563eb;color:#fff;cursor:pointer;white-space:nowrap}
    #trilTopbar .tril-backbtn{margin-left:8px;padding:6px 12px;border:none;border-radius:8px;background:rgba(255,255,255,.12);color:#e8edf7;font:13px system-ui;cursor:pointer;white-space:nowrap}
    /* 融入页面 header 时, 放宽高度上限避免折叠按钮被 overflow:hidden 裁掉; 同时保留 hide-topbar 收起能力 */
    header.tril-integrated{display:flex;flex-wrap:wrap;align-items:center;max-height:600px}
    body.hide-topbar header.tril-integrated{max-height:0}
    #trilUserMenu{position:fixed;top:54px;right:10px;width:210px;max-width:90vw;background:#0f1729;color:#e8edf7;border:1px solid #2c3756;border-radius:12px;padding:6px;display:none;z-index:99993;box-shadow:0 16px 48px rgba(0,0,0,.5);font:13px system-ui,sans-serif}
    #trilUserMenu.show{display:block}
    #trilUserMenu .item{padding:9px 10px;border-radius:8px;cursor:pointer;display:flex;align-items:center;gap:8px;user-select:none}
    #trilUserMenu .item:hover{background:#1a2238}
    #trilUserMenu .item.disabled{opacity:.55;cursor:default}
    #trilUserMenu .sep{height:1px;background:#2c3756;margin:4px 0}
    #trilUserMenu .hdr{padding:7px 10px;font-size:12px;opacity:.75;border-bottom:1px solid #2c3756;margin-bottom:4px;word-break:break-all}
    .tril-modal{position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;background:rgba(10,15,28,.7);padding:10px}
    .tril-modal.show{display:flex}
    .tril-card{background:#fff;color:#1f2937;width:340px;max-width:100%;padding:24px;border-radius:16px;box-shadow:0 20px 60px rgba(0,0,0,.4);box-sizing:border-box}
    .tril-card h3{margin:0 0 4px;color:#2563eb;font-size:18px}
    .tril-card .sub{font-size:12px;color:#6b7280;margin-bottom:14px}
    .tril-card label{display:block;font-size:12px;color:#374151;margin:8px 0 4px}
    .tril-card input{width:100%;padding:9px 10px;border:1px solid #d1d5db;border-radius:9px;font-size:14px;box-sizing:border-box}
    .tril-card .err{color:#dc2626;font-size:12px;min-height:14px;margin-top:6px}
    .tril-card .row{display:flex;gap:8px;margin-top:12px}
    .tril-card .row button{flex:1;padding:10px;border:none;border-radius:10px;background:#2563eb;color:#fff;font-weight:700;cursor:pointer}
    .tril-card .row button.ghost{background:#e5e7eb;color:#374151}
    #trilAdminPanel{position:fixed;top:54px;right:10px;width:380px;max-width:94vw;max-height:84vh;overflow:auto;z-index:99991;
      background:#0f1729;color:#e8edf7;border:1px solid #2c3756;border-radius:14px;padding:16px;display:none;font:13px system-ui,sans-serif;box-shadow:0 16px 48px rgba(0,0,0,.5)}
    @media (max-width:520px){#trilAdminPanel{left:10px;right:10px;width:auto;top:54px}}
    #trilAdminPanel.show{display:block}
    #trilAdminPanel h4{margin:0 0 8px;font-size:15px}
    #trilAdminPanel .kpi{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px}
    #trilAdminPanel .kpi div{background:#1a2238;border:1px solid #2c3756;border-radius:10px;padding:8px 10px;flex:1;min-width:80px}
    #trilAdminPanel .kpi b{display:block;font-size:18px;color:#5b8cff}
    #trilAdminPanel table{width:100%;border-collapse:collapse;margin:6px 0;font-size:12px}
    #trilAdminPanel th,#trilAdminPanel td{border-bottom:1px solid #2c3756;padding:4px 6px;text-align:left}
    #trilAdminPanel input,#trilAdminPanel select{width:100%;padding:6px 8px;border-radius:8px;border:1px solid #2c3756;background:#11192c;color:#e8edf7;box-sizing:border-box;font-size:12px}
    #trilAdminPanel .mini{font-size:11px;padding:4px 8px;border:none;border-radius:7px;background:#2563eb;color:#fff;cursor:pointer;margin-top:4px}
    #trilModules{position:fixed;left:10px;bottom:10px;z-index:99992;background:#0f1729;color:#e8edf7;border:1px solid #2c3756;border-radius:12px;padding:12px;display:none;font:12px system-ui;max-width:300px;box-shadow:0 12px 36px rgba(0,0,0,.5)}
    @media (max-width:520px){#trilModules{left:8px;right:8px;bottom:8px;width:auto;max-width:none;top:auto}}
    #trilModules.show{display:block}
    #trilModules h4{margin:0 0 8px;font-size:13px}
    #trilModules .mod{border-top:1px solid #2c3756;padding:6px 0}
    #trilModules .mod b{color:#5b8cff}
    .tril-closex{position:absolute;top:8px;right:8px;cursor:pointer;color:#93a0bd;font-size:16px;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border-radius:6px}
    .tril-closex:hover{background:rgba(255,255,255,.08)}
    .tril-toast{position:fixed;bottom:18px;left:50%;transform:translateX(-50%);z-index:99999;background:#11192c;color:#e8edf7;
      padding:10px 16px;border-radius:10px;border:1px solid #2c3756;font:13px system-ui;opacity:0;transition:.25s;pointer-events:none}
    .tril-toast.show{opacity:1}
    @media (prefers-color-scheme:dark){#trilTopbar.floating{background:rgba(15,23,42,.9)}}
    `;
    document.head.appendChild(css);
  }

  function toast(msg){
    var t=el('trilToast'); if(!t){ t=h('div',{id:'trilToast',class:'tril-toast'}); document.body.appendChild(t); }
    t.textContent=msg; t.classList.add('show');
    clearTimeout(t._t); t._t=setTimeout(function(){t.classList.remove('show');},1800);
  }

  function api(path, opts){
    opts = opts||{};
    return fetch((API||'')+path, Object.assign({headers:{'Content-Type':'application/json'}}, opts))
      .then(function(r){ return r.json().catch(function(){return {};}); });
  }
  function authHeaders(){
    return { 'Authorization':'Bearer '+state.token, 'Content-Type':'application/json' };
  }

  // ---------- 登录记录上报 ----------
  function reportLogout(){
    if(!state.online || !state.token) return;
    var dur = Math.floor((Date.now()-state.start)/1000);
    fetch((API||'')+'/api/auth/logout', {method:'POST',headers:authHeaders(),body:JSON.stringify({duration:dur})}).catch(function(){});
  }
  function bindUnload(){
    window.addEventListener('beforeunload', reportLogout);
    document.addEventListener('visibilitychange', function(){ if(document.visibilityState==='hidden') reportLogout(); });
  }

  // ---------- 登录/登出 ----------
  function doLogin(user, pass){
    var tz='', lang='';
    try{ tz=Intl.DateTimeFormat().resolvedOptions().timeZone||''; }catch(e){}
    lang = navigator.language||'';
    return api('/api/auth/login', {method:'POST', body:JSON.stringify({user:user,pass:pass,tz:tz,lang:lang})})
      .then(function(d){
        if(!d.ok){ throw new Error(d.error||'登录失败'); }
        state.token=d.token; state.user=d.user; state.role=d.role; state.start=Date.now();
        try{ localStorage.setItem(LS_TOKEN,d.token); localStorage.setItem(LS_USER,d.user); localStorage.setItem(LS_ROLE,d.role); }catch(e){}
        return loadSettings().then(function(){ renderTopbar(); applyGating(); if(d.role==='admin'){ renderAdmin(); } });
      });
  }
  function doLogout(){
    reportLogout();
    state.token=null; state.user=null; state.role=null;
    try{ localStorage.removeItem(LS_TOKEN); localStorage.removeItem(LS_USER); localStorage.removeItem(LS_ROLE); }catch(e){}
    renderTopbar(); applyGating(); toggleUserMenu(false);
    var p=el('trilAdminPanel'); if(p) p.classList.remove('show');
  }
  function loadSettings(){
    if(!state.online || !state.token) return Promise.resolve();
    return api('/api/me', {headers:authHeaders()}).then(function(d){
      if(d.ok && d.settings) state.settings = d.settings||{};
    }).catch(function(){});
  }

  // ---------- 主题(仅管理员) ----------
  function applyTheme(){
    var s=state.settings||{};
    if(s.bg) root.style.setProperty('--bg', s.bg);
    if(s.font) root.style.setProperty('--txt', s.font);
  }
  function themeUI(){
    var wrap=h('div',{class:'mod'});
    wrap.innerHTML = '<b>主题(管理员)</b><div style="display:flex;gap:6px;margin-top:4px">'+
      '<input id="thBg" placeholder="背景色 #0e1320" value="'+(state.settings.bg||'')+'">'+
      '<input id="thFont" placeholder="字体色 #e8edf7" value="'+(state.settings.font||'')+'">'+
      '</div><button class="mini" id="thSave">保存主题</button>';
    return wrap;
  }
  function showTheme(){
    var m=el('trilThemeModal'); if(!m){
      m=h('div',{class:'tril-modal',id:'trilThemeModal'});
      m.innerHTML='<div class="tril-card"><h3>主题设置（管理员）</h3>'+
        '<label>背景颜色</label><input id="thBg2" placeholder="#0e1320" value="'+(state.settings.bg||'')+'">'+
        '<label>字体颜色</label><input id="thFont2" placeholder="#e8edf7" value="'+(state.settings.font||'')+'">'+
        '<div class="err" id="thErr"></div>'+
        '<div class="row"><button id="thSave2">保存</button><button class="ghost" id="thCancel2">取消</button></div></div>';
      document.body.appendChild(m);
      el('thCancel2').onclick=function(){ m.classList.remove('show'); };
      el('thSave2').onclick=function(){
        state.settings.bg=el('thBg2').value||''; state.settings.font=el('thFont2').value||'';
        saveSettings(); applyTheme(); m.classList.remove('show'); toast('主题已保存');
      };
    } else {
      el('thBg2').value=state.settings.bg||''; el('thFont2').value=state.settings.font||'';
    }
    m.classList.add('show');
  }

  // ---------- 扩展模块(仅管理员) ----------
  function modulesUI(){
    var box=el('trilModules'); if(!box) return;
    var cur = window.TRIL_CURRENT||{};
    var fields=[['root','词根'],['pos','词性'],['scene','情景语句'],['etym','词源'],['colloc','搭配']];
    var html='<div class="tril-closex" onclick="TrilAuth.toggleModules(false)">✕</div><h4>扩展模块(管理员)</h4>';
    html+='<div style="margin-bottom:6px"><label><input type="checkbox" id="mOn"> 显示扩展模块</label></div>';
    fields.forEach(function(f){
      var v=cur[f[0]];
      html+='<div class="mod"><b>'+f[1]+'：</b>'+(v? esc(v):'<span style="opacity:.5">（本词条无）</span>')+'</div>';
    });
    html+='<div style="margin-top:10px"></div>';
    box.innerHTML=html;
    box.appendChild(themeUI());
    var chk=el('mOn'); if(chk){ chk.checked=!!state.settings.modulesOn; chk.onchange=function(){ state.settings.modulesOn=chk.checked; saveSettings(); box.classList.toggle('show',chk.checked); }; if(chk.checked) box.classList.add('show'); }
    var sb=el('thSave'); if(sb) sb.onclick=function(){ state.settings.bg=el('thBg').value||''; state.settings.font=el('thFont').value||''; saveSettings(); applyTheme(); toast('主题已保存'); };
  }
  function saveSettings(){
    if(!state.online || !state.token) return;
    api('/api/me/settings', {method:'PUT', headers:authHeaders(), body:JSON.stringify(state.settings)}).catch(function(){});
  }

  // ---------- 管理员面板 ----------
  function renderAdmin(){
    var p=el('trilAdminPanel'); if(!p) return;
    if(p.dataset.ready) return; p.dataset.ready='1';
    p.innerHTML='<span class="tril-closex" onclick="TrilAuth.toggleAdmin(false)">✕</span><h4>📊 登录记录 / 管理（管理员）</h4>'+
      '<div class="kpi" id="adKpi"></div>'+
      '<div id="adRegion"></div>'+
      '<h4 style="margin-top:10px">近期登录</h4><div id="adRecent" style="max-height:160px;overflow:auto"></div>'+
      '<h4 style="margin-top:10px">用户管理（含改密）</h4>'+
      '<div id="adUsers"></div>'+
      '<div style="display:flex;gap:6px;margin-top:6px"><input id="nuUser" placeholder="新用户名"><input id="nuPass" placeholder="密码"><select id="nuRole"><option value="user">普通</option><option value="admin">管理员</option></select></div>'+
      '<button class="mini" id="nuAdd" style="width:100%">＋ 创建用户</button>'+
      '<div style="margin-top:8px"><button class="mini ghost" id="adWb" style="background:#374151">打开工作台</button></div>';
    el('nuAdd').onclick=function(){
      api('/api/admin/users',{method:'POST',headers:authHeaders(),body:JSON.stringify({user:el('nuUser').value,pass:el('nuPass').value,role:el('nuRole').value})})
        .then(function(d){ toast(d.ok?'已创建':'失败:'+(d.error||'')); if(d.ok) refreshAdmin(); });
    };
    el('adWb').onclick=function(){ window.open('workbench.html','_blank'); };
    refreshAdmin();
  }
  function refreshAdmin(){
    api('/api/admin/records',{headers:authHeaders()}).then(function(d){
      if(!d.ok) return;
      el('adKpi').innerHTML =
        '<div><b>'+d.total+'</b>总登录</div><div><b>'+d.uniq+'</b>独立用户</div>'+
        '<div><b>'+fmtDur(d.duration_sec)+'</b>总时长</div>';
      var reg='<h4 style="margin-top:8px">来源地区(时区)</h4><table><tr><th>时区</th><th>次数</th></tr>';
      (d.byTz||[]).slice(0,8).forEach(function(r){ reg+='<tr><td>'+esc(r.tz||'未知')+'</td><td>'+r.c+'</td></tr>'; });
      reg+='</table>'; el('adRegion').innerHTML=reg;
      var rc='<table><tr><th>用户</th><th>地区</th><th>时长</th><th>登录时间</th></tr>';
      (d.recent||[]).forEach(function(r){ rc+='<tr><td>'+esc(r.username)+'</td><td>'+esc(r.tz||'')+'</td><td>'+fmtDur(r.duration_sec||0)+'</td><td>'+esc(r.login_at)+'</td></tr>'; });
      rc+='</table>'; el('adRecent').innerHTML=rc;
    });
    api('/api/admin/users',{headers:authHeaders()}).then(function(d){
      if(!d.ok||!d.users) return;
      var u='<table><tr><th>用户</th><th>角色</th><th>改密</th></tr>';
      d.users.forEach(function(x){
        u+='<tr><td>'+esc(x.username)+'</td><td>'+(x.role==='admin'?'管理员':'普通')+'</td>'+
           '<td><input id="sp_'+esc(x.username)+'" placeholder="新密码" style="width:90px"><button class="mini" onclick="TrilAuth.setpass(\''+esc(x.username)+'\')">设</button></td></tr>';
      });
      u+='</table>'; el('adUsers').innerHTML=u;
    });
  }
  function fmtDur(s){ s=Math.floor(s||0); var m=Math.floor(s/60), sec=s%60; if(m<60) return m+'分'+sec+'秒'; var h=Math.floor(m/60); return h+'时'+(m%60)+'分'; }

  // ---------- 顶栏 ----------
  function adjustHeader(hdr){
    if(!hdr) return;
    hdr.classList.add('tril-integrated');
  }
  function renderTopbar(){
    var bar=el('trilTopbar');
    if(!bar){
      bar=h('div',{id:'trilTopbar'});
      var hdr=document.querySelector('header');
      if(hdr){ hdr.appendChild(bar); adjustHeader(hdr); } else { bar.classList.add('floating'); document.body.appendChild(bar); }
    }
    var label = state.token ? '👤 '+esc(state.user)+' ▾' : (state.online ? '👤 登录' : '👤 离线');
    bar.innerHTML='<button class="tril-userbtn" onclick="TrilAuth.toggleUserMenu(true)">'+label+'</button>';
  }
  function renderUserMenu(){
    var menu=el('trilUserMenu'); if(!menu){ menu=h('div',{id:'trilUserMenu'}); document.body.appendChild(menu); }
    var html='';
    if(state.token){
      html+='<div class="hdr">'+esc(state.user)+'（'+(state.role==='admin'?'管理员':'普通用户')+'）</div>';
      if(state.role==='admin'){
        html+='<div class="item" onclick="TrilAuth.toggleUserMenu(false);TrilAuth.toggleAdmin(true)">📊 登录记录</div>';
        html+='<div class="item" onclick="TrilAuth.toggleUserMenu(false);TrilAuth.toggleModules(true)">🧩 扩展模块</div>';
        html+='<div class="item" onclick="TrilAuth.toggleUserMenu(false);TrilAuth.showTheme()">🎨 主题设置</div>';
      }
      html+='<div class="sep"></div><div class="item" onclick="TrilAuth.toggleUserMenu(false);TrilAuth.logout()">🚪 退出登录</div>';
    } else {
      html+='<div class="item" onclick="TrilAuth.toggleUserMenu(false);TrilAuth.showLogin()">🔑 登录</div>';
      if(!state.online) html+='<div class="item disabled">📴 离线模式（无后台）</div>';
    }
    menu.innerHTML=html;
  }
  function toggleUserMenu(show){
    var menu=el('trilUserMenu'); if(!menu){ menu=h('div',{id:'trilUserMenu'}); document.body.appendChild(menu); }
    if(show){ renderUserMenu(); menu.classList.add('show'); }
    else menu.classList.remove('show');
  }

  // ---------- 登录弹窗 ----------
  function showLogin(){
    var m=el('trilLoginModal'); if(!m){
      m=h('div',{class:'tril-modal',id:'trilLoginModal'});
      m.innerHTML='<div class="tril-card"><h3>登录</h3><div class="sub">账号已预置（bi6099445 普通 / bi6099446 管理员）</div>'+
        '<label>账号</label><input id="lgUser" placeholder="用户名">'+
        '<label>密码</label><input id="lgPass" type="password" placeholder="密码">'+
        '<div class="err" id="lgErr"></div>'+
        '<div class="row"><button id="lgOk">登录</button><button class="ghost" id="lgCancel">取消</button></div></div>';
      document.body.appendChild(m);
      el('lgCancel').onclick=function(){ m.classList.remove('show'); };
      el('lgOk').onclick=function(){
        el('lgErr').textContent='';
        doLogin(el('lgUser').value.trim(), el('lgPass').value).then(function(){ m.classList.remove('show'); toast('登录成功'); })
          .catch(function(e){ el('lgErr').textContent=e.message||'登录失败'; });
      };
      el('lgPass').addEventListener('keydown',function(e){ if(e.key==='Enter') el('lgOk').click(); });
    }
    m.classList.add('show');
  }

  // ---------- 门控 ----------
  function applyGating(){
    document.querySelectorAll('.auth-show-admin').forEach(function(e){ e.style.display = (state.role==='admin')?'':'none'; });
    document.querySelectorAll('.auth-hide-when-auth').forEach(function(e){ e.style.display = (state.token)?'none':''; });
    document.querySelectorAll('.auth-show-when-auth').forEach(function(e){ e.style.display = (state.token)?'':'none'; });
  }

  // ---------- 对外 API ----------
  window.TrilAuth = {
    init: function(){
      injectCSS();
      if(!el('trilAdminPanel')){ var p=h('div',{id:'trilAdminPanel'}); document.body.appendChild(p); }
      if(!el('trilModules')){ var m=h('div',{id:'trilModules'}); document.body.appendChild(m); }
      bindUnload();
      // 通用返回上一级按钮(所有用户): 优先浏览器返回, 应用内可调用 TrilAuth.pushNav 接管
      (function(){
        var b=h('button',{id:'trilBack',onclick:function(){ if(state._nav&&state._nav.length){ var f=state._nav.pop(); try{f();}catch(e){} } else if(history.length>1){ history.back(); } }});
        b.textContent='← 返回';
        var hdr2=document.querySelector('header');
        if(hdr2){ b.className='tril-backbtn'; hdr2.appendChild(b); }
        else { b.style.cssText='position:fixed;right:10px;top:46px;z-index:99992;padding:6px 12px;border:none;border-radius:18px;background:rgba(37,99,235,.9);color:#fff;font:13px system-ui;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.3)'; document.body.appendChild(b); }
      })();
      state._nav=[]; window.TrilAuth.pushNav=function(fn){ state._nav.push(fn); };

      // 通用词条提取: 管理员打开模块面板时, 点击任意词条卡片自动载入当前词条
      if(state.role==='admin'){
        document.addEventListener('click', function(e){
          if(!el('trilModules') || !el('trilModules').classList.contains('show')) return;
          var card = e.target.closest('.card,.wrow,.row,.entry,.word,.item,.unit');
          if(!card) return;
          var cur={};
          card.querySelectorAll('[class*="en" i],[class*="bm" i],[class*="zh" i],[class*="th" i],[class*="root" i],[class*="pos" i],[class*="scene" i]').forEach(function(n){
            var cls=(n.className||'').toLowerCase();
            ['en','bm','zh','th','root','pos','scene','etym','colloc'].forEach(function(k){ if(cls.indexOf(k)>=0 && !cur[k]) cur[k]=n.textContent.trim(); });
          });
          if(Object.keys(cur).length) { window.TRIL_CURRENT=cur; modulesUI(); }
        });
      }
      // 点击外部/ESC 关闭面板与下拉
      document.addEventListener('click', function(e){
        var menu=el('trilUserMenu'), adm=el('trilAdminPanel'), mod=el('trilModules');
        if(menu && menu.classList.contains('show') && !menu.contains(e.target) && !e.target.closest('#trilTopbar')) toggleUserMenu(false);
        if(adm && adm.classList.contains('show') && !adm.contains(e.target) && !e.target.closest('#trilTopbar')) TrilAuth.toggleAdmin(false);
        if(mod && mod.classList.contains('show') && !mod.contains(e.target) && !e.target.closest('#trilTopbar')) TrilAuth.toggleModules(false);
      });
      document.addEventListener('keydown', function(e){
        if(e.key==='Escape'){
          toggleUserMenu(false); TrilAuth.toggleAdmin(false); TrilAuth.toggleModules(false);
          var lm=el('trilLoginModal'), tm=el('trilThemeModal');
          if(lm) lm.classList.remove('show'); if(tm) tm.classList.remove('show');
        }
      });
      // 离线检测
      if(state.online){
        fetch((API||'')+'/api/health',{method:'GET'}).then(function(){ return true; }).catch(function(){ state.online=false; renderTopbar(); });
      }
      // 已有 token?
      try{ state.token=localStorage.getItem(LS_TOKEN); state.user=localStorage.getItem(LS_USER); state.role=localStorage.getItem(LS_ROLE); }catch(e){}
      if(state.online && state.token){
        loadSettings().then(function(){ renderTopbar(); applyGating(); if(state.role==='admin') renderAdmin(); }).catch(function(){ renderTopbar(); });
      } else {
        renderTopbar(); applyGating();
      }
      // 词条变化时刷新模块
      window.addEventListener('tril:entry', function(){ if(state.role==='admin') modulesUI(); });
    },
    showLogin: showLogin,
    logout: doLogout,
    login: function(u,p){ return doLogin(u,p); },
    toggleAdmin: function(v){ var p=el('trilAdminPanel'); if(p){ p.classList.toggle('show', v); if(v) refreshAdmin(); } },
    toggleModules: function(v){ var m=el('trilModules'); if(m){ if(v){ modulesUI(); m.classList.add('show'); } else m.classList.remove('show'); } },
    toggleUserMenu: toggleUserMenu,
    showTheme: showTheme,
    setpass: function(user){ var i=el('sp_'+user); if(!i) return; api('/api/admin/users/'+encodeURIComponent(user)+'/setpass',{method:'POST',headers:authHeaders(),body:JSON.stringify({pass:i.value})}).then(function(d){ toast(d.ok?'已改密':'失败'); if(d.ok) i.value=''; }); },
    isAdmin: function(){ return state.role==='admin'; },
    setCurrent: function(obj){ window.TRIL_CURRENT=obj; if(state.role==='admin'&&el('trilModules').classList.contains('show')) modulesUI(); }
  };

  if(document.readyState!=='loading') window.TrilAuth.init();
  else document.addEventListener('DOMContentLoaded', function(){ window.TrilAuth.init(); });
})();

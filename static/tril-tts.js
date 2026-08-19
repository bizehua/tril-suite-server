/* =========================================================================
 * 四语母语习得 · 朗读语音版本（统一浮动控件）(tril-tts.js)
 * 作用：为「学习器 / 测试器 / 快速播放器 / 闪记」四器统一补充"朗读语音版本"
 *       - 可隐藏的浮动按钮（置于左下角，非遮挡区，桌面/移动自适应）
 *       - 点击展开设置：逐语言选择 TTS 嗓音 + 语速 + 音量
 *       - 一键朗读"当前词"（应用设置 window.TRIL_CURRENT 或页面选中文本）
 * 约定：window.TrilTTS.speak(text, lang) 可被各应用直接调用
 * ========================================================================= */
(function () {
  'use strict';
  var LS = 'tril_tts_v1';
  var LANGS = [
    { k: 'en', label: '英文', v: 'en-US' },
    { k: 'bm', label: '马来文', v: 'ms-MY' },
    { k: 'zh', label: '中文', v: 'zh-CN' },
    { k: 'th', label: '泰文', v: 'th-TH' }
  ];
  function $(s) { return document.querySelector(s); }
  function el(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  function load() {
    var d = { voice: {}, rate: 1, volume: 1, hidden: false };
    try { Object.assign(d, JSON.parse(localStorage.getItem(LS) || '{}')); } catch (e) {}
    return d;
  }
  function save(d) { try { localStorage.setItem(LS, JSON.stringify(d)); } catch (e) {} }
  var cfg = load();

  var voices = [];
  function loadVoices() { voices = (window.speechSynthesis ? speechSynthesis.getVoices() : []) || []; }
  if (window.speechSynthesis) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }

  /* ---------- 对外朗读 ---------- */
  function speak(text, lang) {
    text = (text || '').trim();
    if (!text) return;
    if (!window.speechSynthesis) { if (window.TrilLib && TrilLib.toast) TrilLib.toast('当前环境不支持语音合成'); return; }
    try { speechSynthesis.cancel(); } catch (e) {}
    var u = new SpeechSynthesisUtterance(text);
    var L = LANGS.filter(function (x) { return x.k === lang; })[0] || LANGS[0];
    u.lang = L.v;
    var sel = cfg.voice[lang];
    if (sel) { var v = voices.filter(function (x) { return x.name === sel; })[0]; if (v) u.voice = v; }
    u.rate = (cfg.rate || 1); u.volume = (cfg.volume != null ? cfg.volume : 1);
    speechSynthesis.speak(u);
  }

  function currentText() {
    if (window.TRIL_CURRENT) {
      var c = window.TRIL_CURRENT;
      var order = ['en', 'zh', 'bm', 'th'];
      for (var i = 0; i < order.length; i++) { if (c[order[i]]) return { text: c[order[i]], lang: order[i] }; }
    }
    var sel = (window.getSelection && window.getSelection().toString()) || '';
    if (sel) return { text: sel, lang: 'en' };
    return null;
  }

  /* ---------- UI ---------- */
  function injectCSS() {
    if (el('trilTtsCss')) return;
    var c = document.createElement('style'); c.id = 'trilTtsCss';
    c.textContent =
      '#trilTtsBtn{position:fixed;left:12px;bottom:62px;z-index:99993;padding:9px 13px;border:none;border-radius:20px;' +
      'background:rgba(20,28,46,.9);color:#e8edf7;font:13px/1 system-ui;font-weight:600;cursor:pointer;box-shadow:0 8px 22px rgba(0,0,0,.4);backdrop-filter:blur(6px)}' +
      '#trilTtsBtn:hover{background:#2563eb}' +
      '#trilTtsRestore{position:fixed;left:12px;bottom:12px;z-index:99993;width:38px;height:38px;border:none;border-radius:50%;background:rgba(20,28,46,.9);color:#e8edf7;font:16px/1 system-ui;cursor:pointer;box-shadow:0 8px 22px rgba(0,0,0,.4)}' +
      '#trilTts{position:fixed;left:12px;bottom:104px;z-index:99998;width:300px;max-width:92vw;background:#0f1729;color:#e8edf7;border:1px solid #2c3756;border-radius:16px;display:none;flex-direction:column;font:13px/1.5 system-ui;box-shadow:0 18px 54px rgba(0,0,0,.55);overflow:hidden}' +
      '#trilTts.show{display:flex}' +
      '#trilTts .hd{display:flex;align-items:center;gap:8px;padding:11px 14px;border-bottom:1px solid #2c3756;background:#15203a;cursor:move;touch-action:none;user-select:none}' +
      '#trilTts .hd b{font-size:14px;color:#7aa2ff;flex:1}' +
      '#trilTts .hd .x{cursor:pointer;color:#93a0bd;font-size:16px;padding:2px 6px}' +
      '#trilTts .bd{padding:12px 14px;display:flex;flex-direction:column;gap:10px;max-height:60vh;overflow:auto}' +
      '#trilTts .row{display:flex;align-items:center;gap:8px}' +
      '#trilTts .row label{font-size:12px;color:#93a0bd;flex:0 0 64px}' +
      '#trilTts select,#trilTts input[type=range]{flex:1;background:#11192c;color:#e8edf7;border:1px solid #2c3756;border-radius:8px;padding:7px;box-sizing:border-box;font:13px system-ui}' +
      '#trilTts input[type=range]{padding:0}' +
      '#trilTts .speak{margin-top:2px;border:none;border-radius:10px;padding:10px;background:#2563eb;color:#fff;font:13px system-ui;font-weight:600;cursor:pointer}' +
      '#trilTts .hide{margin-top:2px;border:none;border-radius:9px;padding:8px;background:#334155;color:#e8edf7;font:12px system-ui;cursor:pointer}' +
      '#trilTts .hint{font-size:11px;color:#93a0bd;line-height:1.5}';
    document.head.appendChild(c);
  }

  function buildUI() {
    injectCSS();
    if (cfg.hidden) {
      var r = document.createElement('button'); r.id = 'trilTtsRestore'; r.textContent = '🎚'; r.title = '显示朗读语音按钮';
      r.onclick = function () { cfg.hidden = false; save(cfg); location.reload(); };
      document.body.appendChild(r);
      return;
    }
    var btn = document.createElement('button'); btn.id = 'trilTtsBtn'; btn.textContent = '🎚 朗读语音'; btn.title = '朗读语音版本设置';
    btn.onclick = function () { openPanel(); };
    document.body.appendChild(btn);

    var panel = document.createElement('div'); panel.id = 'trilTts';
    panel.innerHTML =
      '<div class="hd"><b>🎚 朗读语音版本</b><span class="x" id="trilTtsClose">✕</span></div>' +
      '<div class="bd">' +
      LANGS.map(function (L) {
        return '<div class="row"><label>' + L.label + '</label><select id="ttsVoice_' + L.k + '"></select></div>';
      }).join('') +
      '<div class="row"><label>语速</label><input id="ttsRate" type="range" min="0.5" max="1.6" step="0.1" value="' + cfg.rate + '"><span id="ttsRateV" style="width:30px;color:#93a0bd;font-size:11px;text-align:right">' + cfg.rate + '</span></div>' +
      '<div class="row"><label>音量</label><input id="ttsVol" type="range" min="0" max="1" step="0.1" value="' + cfg.volume + '"><span id="ttsVolV" style="width:30px;color:#93a0bd;font-size:11px;text-align:right">' + cfg.volume + '</span></div>' +
      '<button class="speak" id="ttsSpeak">🔊 朗读当前词</button>' +
      '<button class="hide" id="ttsHide">🙈 隐藏此按钮</button>' +
      '<div class="hint">嗓音列表取自本机浏览器已安装语音；若为空，说明该浏览器未装对应语言语音包（用系统默认嗓音）。设置仅保存在本机。</div>' +
      '</div>';
    document.body.appendChild(panel);

    // 填充嗓音下拉
    LANGS.forEach(function (L) {
      var sel = el('ttsVoice_' + L.k);
      var opt0 = document.createElement('option'); opt0.value = ''; opt0.textContent = '（默认嗓音）'; sel.appendChild(opt0);
      voices.forEach(function (v) {
        var o = document.createElement('option'); o.value = v.name; o.textContent = v.name + (v.lang ? ' · ' + v.lang : '');
        if (v.lang && v.lang.toLowerCase().indexOf(L.v.split('-')[0].toLowerCase()) === 0) sel.appendChild(o);
      });
      sel.value = cfg.voice[L.k] || '';
      sel.onchange = function () { cfg.voice[L.k] = sel.value; save(cfg); };
    });
    el('ttsRate').oninput = function () { cfg.rate = parseFloat(this.value); el('ttsRateV').textContent = this.value; save(cfg); };
    el('ttsVol').oninput = function () { cfg.volume = parseFloat(this.value); el('ttsVolV').textContent = this.value; save(cfg); };
    el('ttsSpeak').onclick = function () {
      var c = currentText();
      if (!c) { if (window.TrilLib && TrilLib.toast) TrilLib.toast('没有可朗读的当前词'); return; }
      speak(c.text, c.lang);
    };
    el('ttsHide').onclick = function () { cfg.hidden = true; save(cfg); panel.classList.remove('show'); location.reload(); };
    el('trilTtsClose').onclick = function () { panel.classList.remove('show'); };

    // 拖拽（不遮挡底层）
    var hd = panel.querySelector('.hd'), sx, sy, ox, oy, drag = false;
    hd.addEventListener('pointerdown', function (e) {
      if (e.target.classList.contains('x')) return;
      drag = true; panel.style.left = panel.getBoundingClientRect().left + 'px'; panel.style.bottom = 'auto';
      ox = panel.offsetLeft; oy = panel.offsetTop; sx = e.clientX; sy = e.clientY;
      try { hd.setPointerCapture(e.pointerId); } catch (_) {}
    });
    hd.addEventListener('pointermove', function (e) {
      if (!drag) return;
      panel.style.left = Math.max(0, Math.min(window.innerWidth - panel.offsetWidth, ox + e.clientX - sx)) + 'px';
      panel.style.top = Math.max(0, Math.min(window.innerHeight - panel.offsetHeight, oy + e.clientY - sy)) + 'px';
    });
    hd.addEventListener('pointerup', function (e) { drag = false; try { hd.releasePointerCapture(e.pointerId); } catch (_) {} });
  }

  function openPanel() { var p = el('trilTts'); if (p) p.classList.add('show'); }

  function init() { buildUI(); }

  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);

  window.TrilTTS = { speak: speak, open: openPanel, init: init, config: cfg };
})();

/* =========================================================================
 * 四语母语习得 · 朗读语音版本（统一浮动控件）(tril-tts.js)
 * 作用：为「学习器 / 测试器 / 快速播放器 / 闪记」四器统一补充"朗读语音版本"
 *       - 可隐藏的浮动按钮（置于左下角，非遮挡区，桌面/移动自适应）
 *       - 点击展开设置：朗读引擎 + 每语言"男/女多语音"选择 + 语速 + 音量
 *       - 一键朗读"当前词"（应用设置 window.TRIL_CURRENT 或页面选中文本）
 * 朗读引擎（三选一，默认"自动"）：
 *   · 自动     —— 按所选语音自动走云端(男/女)或本机嗓音
 *   · 浏览器原生 —— 只用本机语音合成（离线，部分语言/安卓可能无可选嗓音）
 *   · 云端朗读 —— 走 Edge TTS 男/女多语音，任何浏览器/任何平台都能选声（需联网）
 * 关键：每个语言的语音下拉框"始终列出云端男/女声"，不依赖本机是否装了语音包，
 *       因此安卓端也能正常选择朗读语音，实现多端对齐一致。
 * 约定：window.TrilTTS.speak(text, lang) 可被各应用直接调用
 * ========================================================================= */
(function () {
  'use strict';
  var LS = 'tril_tts_v1';
  var LANGS = [
    { k: 'en', label: '英文', v: 'en-US', g: 'en' },
    { k: 'bm', label: '马来文', v: 'ms-MY', g: 'ms' },
    { k: 'zh', label: '中文', v: 'zh-CN', g: 'zh-CN' },
    { k: 'th', label: '泰文', v: 'th-TH', g: 'th' }
  ];
  // 云端男/女多语音（Edge TTS，免费、跨平台一致）
  var CLOUD_VOICES = {
    en: [
      { id: 'en-US-AriaNeural', label: '女声 Aria' },
      { id: 'en-US-JennyNeural', label: '女声 Jenny' },
      { id: 'en-US-GuyNeural', label: '男声 Guy' },
      { id: 'en-US-DavisNeural', label: '男声 Davis' }
    ],
    bm: [
      { id: 'ms-MY-YasminNeural', label: '女声 Yasmin' },
      { id: 'ms-MY-OsmanNeural', label: '男声 Osman' }
    ],
    zh: [
      { id: 'zh-CN-XiaoxiaoNeural', label: '女声 晓晓' },
      { id: 'zh-CN-XiaoyiNeural', label: '女声 小艺' },
      { id: 'zh-CN-YunxiNeural', label: '男声 云希' },
      { id: 'zh-CN-YunyangNeural', label: '男声 云扬' }
    ],
    th: [
      { id: 'th-TH-AcharaNeural', label: '女声 Achara' },
      { id: 'th-TH-PremwadeeNeural', label: '女声 Premwadee' },
      { id: 'th-TH-PattaraNeural', label: '男声 Pattara' }
    ]
  };
  function $(s) { return document.querySelector(s); }
  function el(id) { return document.getElementById(id); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function toast(m){ if(window.TrilLib && TrilLib.toast) TrilLib.toast(m); }

  function load() {
    var d = { voice: {}, rate: 1, volume: 1, hidden: false, engine: 'auto' };
    try { Object.assign(d, JSON.parse(localStorage.getItem(LS) || '{}')); } catch (e) {}
    if (['auto', 'native', 'cloud'].indexOf(d.engine) < 0) d.engine = 'auto';
    return d;
  }
  function save(d) { try { localStorage.setItem(LS, JSON.stringify(d)); } catch (e) {} }
  var cfg = load();

  /* ---------- 语音列表 ---------- */
  var voices = [];
  function loadVoices() { voices = (window.speechSynthesis ? speechSynthesis.getVoices() : []) || []; }
  if (window.speechSynthesis) { loadVoices(); speechSynthesis.onvoiceschanged = function () { loadVoices(); fillVoiceSelects(); }; }

  // iOS / 部分浏览器：需在用户首次交互后才解锁语音列表
  function warmup() { if (window.speechSynthesis) { try { speechSynthesis.getVoices(); } catch (e) {} } }
  document.addEventListener('pointerdown', warmup, { once: true });
  document.addEventListener('keydown', warmup, { once: true });

  function langPrefix(k) { var L = LANGS.filter(function (x) { return x.k === k; })[0]; return L ? L.v.split('-')[0].toLowerCase() : k; }
  function hasVoiceFor(k) { var p = langPrefix(k); return voices.some(function (v) { return (v.lang || '').toLowerCase().indexOf(p) === 0; }); }
  function pickVoice(k) {
    var p = langPrefix(k);
    var exact = voices.filter(function (v) { return (v.lang || '').toLowerCase().indexOf(p) === 0; });
    return exact.length ? exact[0] : null;
  }
  function isCloudVoice(id) {
    if (!id) return false;
    for (var k in CLOUD_VOICES) { for (var i = 0; i < CLOUD_VOICES[k].length; i++) { if (CLOUD_VOICES[k][i].id === id) return true; } }
    return false;
  }
  function defaultCloudVoice(k) { var cv = CLOUD_VOICES[k]; return cv && cv.length ? cv[0].id : null; }
  function googleLangFor(voiceId) { var p = (voiceId || '').split('-')[0]; return (p === 'zh') ? 'zh-CN' : (p || 'en'); }

  /* ---------- 云端朗读（Edge TTS 男/女多语音，跨平台一致） ---------- */
  var audioEl = null;
  function ensureAudio() { if (!audioEl) { try { audioEl = new (window.Audio || window.webkitAudio)(); audioEl.preload = 'none'; } catch (e) { audioEl = null; } } return audioEl; }
  function cloudSpeak(text, voiceId) {
    text = (text || '').trim(); if (!text) return;
    var a = ensureAudio(); if (!a) { toast('当前环境不支持音频播放'); return; }
    var useServer = (location.protocol !== 'file:');
    var serverUrl = '/api/tts?voice=' + encodeURIComponent(voiceId) + '&text=' + encodeURIComponent(text);
    var gl = googleLangFor(voiceId);
    var googleUrl = 'https://translate.google.com/translate_tts?ie=UTF-8&q=' + encodeURIComponent(text) + '&tl=' + encodeURIComponent(gl) + '&client=tw-ob';
    var triedGoogle = false;
    function toGoogle() {
      if (triedGoogle) { toast('云端朗读不可用（请检查网络）'); return; }
      triedGoogle = true; a.src = googleUrl; a.play().catch(function () { toast('云端朗读不可用（请检查网络）'); });
    }
    a.onerror = toGoogle;
    if (useServer) { a.src = serverUrl; a.play().catch(toGoogle); }
    else { a.src = googleUrl; a.play().catch(function () { toast('云端朗读不可用（请检查网络）'); }); }
  }

  /* ---------- 原生朗读（Web Speech） ---------- */
  function nativeSpeak(text, L, nativeName) {
    try { speechSynthesis.cancel(); } catch (e) {}
    var u = new SpeechSynthesisUtterance(text);
    u.lang = L.v;
    var v = null;
    if (nativeName) { v = voices.filter(function (x) { return x.name === nativeName; })[0]; }
    else { v = pickVoice(L.k); }
    if (v) u.voice = v;
    u.rate = (cfg.rate || 1); u.volume = (cfg.volume != null ? cfg.volume : 1);
    var fell = false;
    u.onerror = function () { if (!fell) { fell = true; cloudSpeak(text, defaultCloudVoice(L.k)); } };
    try { speechSynthesis.speak(u); } catch (e) { cloudSpeak(text, defaultCloudVoice(L.k)); }
  }

  /* ---------- 对外朗读（引擎 + 语音调度） ---------- */
  function speak(text, lang) {
    text = (text || '').trim(); if (!text) return;
    try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}
    var L = LANGS.filter(function (x) { return x.k === lang; })[0] || LANGS[0];
    var eng = cfg.engine || 'auto';
    var sel = cfg.voice[lang];
    var isCloud = isCloudVoice(sel);
    if (eng === 'cloud' || (sel && isCloud)) { cloudSpeak(text, sel || defaultCloudVoice(lang)); return; }
    if (window.speechSynthesis && (eng === 'native' || hasVoiceFor(lang))) { nativeSpeak(text, L, (sel && !isCloud) ? sel : null); }
    else { cloudSpeak(text, defaultCloudVoice(lang)); }
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

  function fillVoiceSelects() {
    LANGS.forEach(function (L) {
      var sel = el('ttsVoice_' + L.k); if (!sel) return;
      var cur = sel.value;
      sel.innerHTML = '';
      // 云端男/女声（任何浏览器/平台通用，不依赖本机语音包）—— 这是关键：安卓也能选
      (CLOUD_VOICES[L.k] || []).forEach(function (v) {
        var o = document.createElement('option'); o.value = v.id; o.textContent = '☁ ' + v.label; sel.appendChild(o);
      });
      // 本机嗓音（若有）
      voices.forEach(function (v) {
        if (v.lang && v.lang.toLowerCase().indexOf(L.v.split('-')[0].toLowerCase()) === 0) {
          var o = document.createElement('option'); o.value = v.name; o.textContent = '📱 本机: ' + v.name; sel.appendChild(o);
        }
      });
      // 选中持久化（首次默认选第一个云端女声，保证多端一致）
      if (!cur && sel.options.length) cur = sel.options[0].value;
      if (cur) {
        var q = sel.querySelector('option[value="' + cur.replace(/"/g, '\\"') + '"]');
        if (q) { sel.value = cur; cfg.voice[L.k] = cur; save(cfg); }
      }
    });
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
      '<div class="row"><label>朗读引擎</label><select id="ttsEngine">' +
      '<option value="auto">自动（推荐）</option>' +
      '<option value="native">浏览器原生</option>' +
      '<option value="cloud">云端朗读·多语音</option>' +
      '</select></div>' +
      LANGS.map(function (L) {
        return '<div class="row"><label>' + L.label + '</label><select id="ttsVoice_' + L.k + '"></select></div>';
      }).join('') +
      '<div class="row"><label>语速</label><input id="ttsRate" type="range" min="0.5" max="1.6" step="0.1" value="' + cfg.rate + '"><span id="ttsRateV" style="width:30px;color:#93a0bd;font-size:11px;text-align:right">' + cfg.rate + '</span></div>' +
      '<div class="row"><label>音量</label><input id="ttsVol" type="range" min="0" max="1" step="0.1" value="' + cfg.volume + '"><span id="ttsVolV" style="width:30px;color:#93a0bd;font-size:11px;text-align:right">' + cfg.volume + '</span></div>' +
      '<button class="speak" id="ttsSpeak">🔊 朗读当前词</button>' +
      '<button class="hide" id="ttsHide">🙈 隐藏此按钮</button>' +
      '<div class="hint">每个语言下拉框都列出「☁ 云端男/女声」，安卓/苹果/电脑通用，联网即可选声朗读。选择「📱 本机」则用设备自带嗓音（离线可用，但安卓通常只有默认声）。</div>' +
      '</div>';
    document.body.appendChild(panel);

    el('ttsEngine').value = cfg.engine;
    el('ttsEngine').onchange = function () { cfg.engine = this.value; save(cfg); };

    fillVoiceSelects();
    el('ttsRate').oninput = function () { cfg.rate = parseFloat(this.value); el('ttsRateV').textContent = this.value; save(cfg); };
    el('ttsVol').oninput = function () { cfg.volume = parseFloat(this.value); el('ttsVolV').textContent = this.value; save(cfg); };
    el('ttsSpeak').onclick = function () {
      var c = currentText();
      if (!c) { toast('没有可朗读的当前词'); return; }
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

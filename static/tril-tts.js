/* =========================================================================
 * 四语母语习得 · 朗读语音版本（统一浮动控件 + 统一朗读引擎）(tril-tts.js)
 * 作用：为「学习器 / 测试器 / 快速播放器 / 闪记」四器统一提供朗读能力：
 *   - 可隐藏的浮动按钮（左下角），点击展开：朗读引擎 + 每语言男/女多语音 + 语速 + 音量
 *   - 四器自身的逐词朗读 / 自动连读 全部统一走本模块引擎（window.speak 被本模块接管）
 * 朗读引擎（三选一，默认"自动"）：
 *   · 自动     —— 有本机嗓音用本机（桌面可挑男女声，安卓用设备自带声，发音最准）；
 *               本机没有该语言嗓音时（如安卓的马来/泰）自动转云端，保证发音正确
 *   · 浏览器原生 —— 只用本机语音合成（离线可用，部分语言/安卓可能只有默认声）
 *   · 云端朗读  —— 走 Edge TTS 男/女多语音（需联网；联网失败自动降级）
 * 关键：每个语言下拉框"始终列出云端男/女声 + 本机嗓音"，安卓/苹果/电脑通用。
 * 约定：window.TrilTTS.speak(text, lang, onend) 可被各应用直接调用
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
  // 云端男/女多语音（Edge TTS，免费、跨平台一致；作为本机嗓音之外的补充/兜底）
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
  function escXml(s) { return String(s == null ? '' : s).replace(/[<>&]/g, function (c) { return { '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]; }); }
  function toast(m) { if (window.TrilLib && TrilLib.toast) TrilLib.toast(m); else { try { console.log('[tts]', m); } catch (e) {} } }

  function load() {
    var d = { voice: {}, rate: 1, volume: 1, hidden: false, engine: 'native' };
    try { Object.assign(d, JSON.parse(localStorage.getItem(LS) || '{}')); } catch (e) {}
    // 关键修复：云端引擎在多数受限网络下完全连不通，会导致朗读变慢/失效。
    // 若用户误存了 cloud，强制重置为 native（即时、语速可调、男声可选）。
    if (d.engine === 'cloud') d.engine = 'native';
    if (['auto', 'native'].indexOf(d.engine) < 0) d.engine = 'native';
    if (!d.voice || typeof d.voice !== 'object') d.voice = {};
    return d;
  }
  function save(d) { try { localStorage.setItem(LS, JSON.stringify(d)); } catch (e) {} }
  var cfg = load();

  /* ---------- 语音列表（本机） ---------- */
  var voices = [];
  function loadVoices() { voices = (window.speechSynthesis ? speechSynthesis.getVoices() : []) || []; }
  if (window.speechSynthesis) { loadVoices(); speechSynthesis.onvoiceschanged = function () { loadVoices(); fillVoiceSelects(); }; }

  function warmup() { if (window.speechSynthesis) { try { speechSynthesis.getVoices(); } catch (e) {} } }
  document.addEventListener('pointerdown', warmup, { once: true });
  document.addEventListener('keydown', warmup, { once: true });

  function langMeta(k) { var L = LANGS.filter(function (x) { return x.k === k; })[0]; return L || LANGS[0]; }
  function langPrefix(k) { var L = langMeta(k); return L.v.split('-')[0].toLowerCase(); }
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

  /* ---------- 浏览器直连 Edge TTS（云端男/女多语音，跨平台一致） ----------
   * 让浏览器直接连微软 Edge TTS 的 WebSocket，按所选嗓音返回真实男/女声。 */
  function browserEdgeTts(text, voiceId, rate) {
    return new Promise(function (resolve, reject) {
      if (typeof WebSocket === 'undefined') return reject(new Error('no-ws'));
      var connId = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : (Date.now() + '-' + Math.random().toString(16).slice(2));
      var reqId = connId;
      var lang = (voiceId || '').split('-').slice(0, 2).join('-') || 'en-US';
      var rateStr = (typeof rate === 'number' && rate > 0) ? String(Math.min(2, Math.max(0.5, rate))) : '1';
      var url = 'wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4&ConnectionId=' + connId;
      var ws;
      try { ws = new WebSocket(url); } catch (e) { return reject(e); }
      try { ws.binaryType = 'arraybuffer'; } catch (_) {}
      var parts = [];
      var ended = false;
      function finish(err) {
        if (ended) return; ended = true;
        try { ws.close(); } catch (_) {}
        if (err) return reject(err);
        var total = 0, i;
        for (i = 0; i < parts.length; i++) total += parts[i].length;
        if (!total) return reject(new Error('edge-empty'));
        var all = new Uint8Array(total), off = 0;
        for (i = 0; i < parts.length; i++) { all.set(parts[i], off); off += parts[i].length; }
        var start = 0;
        for (i = 0; i < all.length - 1; i++) { if (all[i] === 0xFF && (all[i + 1] & 0xE0) === 0xE0) { start = i; break; } }
        try { resolve(URL.createObjectURL(new Blob([all.subarray(start)], { type: 'audio/mpeg' }))); }
        catch (e) { reject(e); }
      }
      ws.onopen = function () {
        try {
          ws.send('ConnectionId: ' + connId + '\r\nVersion: 0.0.0.0\r\nMessageType: SpeechConfig\r\nContent-Type: application/json; charset=utf-8\r\nPath: speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}');
          setTimeout(function () {
            ws.send('X-RequestId: ' + reqId + '\r\nContent-Type: application/json; charset=utf-8\r\nPath: synthesis.context\r\n\r\n{"device":{"os":"Linux","version":"1.0"},"browser":{"name":"Edge","version":"1.0"}}');
            setTimeout(function () {
              ws.send('X-RequestId: ' + reqId + '\r\nContent-Type: application/ssml+xml\r\nPath: ssml\r\n\r\n<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xmlns:mstts="https://www.w3.org/2001/mstts" xml:lang="' + lang + '"><voice name="' + voiceId + '"><prosody rate="' + rateStr + '">' + escXml(text) + '</prosody></voice></speak>');
            }, 80);
          }, 80);
        } catch (e) { finish(e); }
      };
      ws.onmessage = function (ev) {
        if (typeof ev.data === 'string') {
          if (ev.data.indexOf('Path:turn.end') !== -1) finish(null);
        } else if (ev.data) {
          try { parts.push(new Uint8Array(ev.data instanceof ArrayBuffer ? ev.data : (ev.data.buffer || ev.data))); } catch (_) {}
        }
      };
      ws.onerror = function () { if (!ended) finish(new Error('edge-ws-error')); };
      ws.onclose = function () { if (!ended) finish(new Error('edge-ws-closed')); };
      setTimeout(function () { if (!ended) finish(new Error('edge-timeout')); }, 9000);
    });
  }

  /* ---------- 云端朗读：浏览器直连 Edge(男/女) → 服务器兜底 → Google 兜底 → 本机兜底 ----------
   * 注意：云端依赖联网且对网络要求高。一旦探测到云端不可用，自动"冷却"一段时间，
   * 期间直接回退本机，避免每次朗读都傻等超时（这正是此前"语速慢/不自然"的根源）。 */
  var audioEl = null;
  var cloudBrokenUntil = 0; // 云端探测失败的冷却截止时间
  function ensureAudio() { if (!audioEl) { try { audioEl = new window.Audio(); audioEl.preload = 'none'; } catch (e) { audioEl = null; } } return audioEl; }
  function cloudSpeak(text, voiceId, lang, onend) {
    text = (text || '').trim(); if (!text) { if (onend) onend(); return; }
    var L = langMeta(lang);
    // 冷却期内直接回退本机（即时出声，不让用户干等）
    if (Date.now() < cloudBrokenUntil) { nativeFallback(text, L, onend); return; }
    var a = ensureAudio();
    if (!a) { nativeFallback(text, L, onend); return; }
    var useServer = (location.protocol !== 'file:');
    var serverUrl = '/api/tts?voice=' + encodeURIComponent(voiceId) + '&text=' + encodeURIComponent(text);
    var gl = googleLangFor(voiceId);
    var googleUrl = 'https://translate.google.com/translate_tts?ie=UTF-8&q=' + encodeURIComponent(text) + '&tl=' + encodeURIComponent(gl) + '&client=tw-ob';
    var step = 0;
    function markBroken() { try { cloudBrokenUntil = Date.now() + 60000; } catch (e) {} }
    function play(url, onFail) {
      a.onerror = function () { if (onFail) onFail(); };
      a.onended = function () { if (onend) onend(); };
      a.src = url;
      var p = a.play(); if (p && p.catch) p.catch(function () { if (onFail) onFail(); });
    }
    function google() {
      if (step >= 3) { markBroken(); nativeFallback(text, L, onend); return; }
      step = 3; play(googleUrl, function () { nativeFallback(text, L, onend); });
    }
    function server() {
      if (step >= 2 || !useServer) { google(); return; }
      step = 2; play(serverUrl, google);
    }
    function edge() {
      if (step >= 1) { server(); return; }
      step = 1;
      browserEdgeTts(text, voiceId, cfg.rate).then(function (blobUrl) {
        play(blobUrl, server); // 直连成功；万一 blob 播放失败再走服务器
      }).catch(function () { server(); });
    }
    edge();
  }
  // 云端全部失败时，退回本机（尽量出声）
  function nativeFallback(text, L, onend) {
    if (window.speechSynthesis) { try { nativeSpeak(text, L, null, onend, false); return; } catch (e) {} }
    if (onend) onend();
    toast('云端与本机朗读均不可用（请检查网络或浏览器语音权限）');
  }

  /* ---------- 原生朗读（Web Speech） ---------- */
  function nativeSpeak(text, L, nativeName, onend, allowCloud) {
    if (!window.speechSynthesis) {
      if (allowCloud !== false) cloudSpeak(text, defaultCloudVoice(L.k), L.k, onend);
      else if (onend) onend();
      return;
    }
    try { speechSynthesis.cancel(); } catch (e) {}
    // 极小延迟规避 Chrome「cancel 后立即 speak 会忽略 voice 选择」的已知 bug；
    // 30ms 对人耳几乎无感，但能保证选中的男/女声真正生效。
    setTimeout(function () {
      var u = new SpeechSynthesisUtterance(text);
      u.lang = L.v;
      var v = null;
      if (nativeName) { v = voices.filter(function (x) { return x.name === nativeName; })[0]; }
      else { v = pickVoice(L.k); }
      if (v) u.voice = v;
      u.rate = (cfg.rate || 1); u.volume = (cfg.volume != null ? cfg.volume : 1); u.pitch = 1;
      u.onend = function () { if (onend) onend(); };
      u.onerror = function () { if (allowCloud !== false) cloudSpeak(text, defaultCloudVoice(L.k), L.k, onend); else if (onend) onend(); };
      try { speechSynthesis.resume(); } catch (e) {}
      try { speechSynthesis.speak(u); } catch (e) {
        if (allowCloud !== false) cloudSpeak(text, defaultCloudVoice(L.k), L.k, onend); else if (onend) onend();
      }
    }, 30);
  }

  /* ---------- 对外朗读（引擎 + 语音调度，四器统一入口） ----------
   * text: 要读的文本；lang: en/bm/zh/th；onend: 读完后的回调（用于连读/自动读） */
  function speak(text, lang, onend) {
    text = (text || '').trim(); if (!text) { if (onend) onend(); return; }
    try { if (window.speechSynthesis) speechSynthesis.cancel(); } catch (e) {}
    var L = langMeta(lang);
    var sel = cfg.voice[lang];

    // 1) 明确选了「本机嗓音」（下拉框里 📱 开头，含男/女）→ 严格走原生。
    //    即时出声、语速/音量可调、男声/女声精确生效——无论"朗读引擎"怎么设都尊重用户的具体嗓音选择。
    if (sel && !isCloudVoice(sel)) {
      var v = voices.filter(function (x) { return x.name === sel; })[0];
      if (v) { nativeSpeak(text, L, sel, onend, true); return; }
      // 名字未匹配（该嗓音在本机列表里消失了）→ 落到下方默认逻辑
    }
    // 2) 明确选了「☁ 云端嗓音」→ 走云端（尝试对应男/女声），失败自动回退本机
    if (sel && isCloudVoice(sel)) { cloudSpeak(text, sel, lang, onend); return; }
    // 3) 没选具体声：本机有该语言嗓音 → 原生（即时、语速可调，用本机首个匹配声）
    if (window.speechSynthesis && hasVoiceFor(lang)) { nativeSpeak(text, L, null, onend, true); return; }
    // 4) 本机完全没有该语言嗓音（如安卓的马来/泰）→ 云端兜底，保证读对语言（含男/女声）
    cloudSpeak(text, defaultCloudVoice(lang), lang, onend);
  }

  function currentText() {
    if (window.TRIL_CURRENT) {
      var c = window.TRIL_CURRENT;
      // 优先使用应用当前展示语言（如闪记的"正面语言"），否则按 en/zh/bm/th 顺序取首个非空
      var prefer = window.TRIL_CURRENT_LANG;
      if (prefer && c[prefer]) return { text: c[prefer], lang: prefer };
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
      var saved = cfg.voice[L.k] || '';   // 还原用户已保存的选择（不依赖临时 DOM 值）
      sel.innerHTML = '';
      var nativeOpts = [];
      // 本机嗓音（若有）
      voices.forEach(function (v) {
        if (v.lang && v.lang.toLowerCase().indexOf(L.v.split('-')[0].toLowerCase()) === 0) {
          var o = document.createElement('option'); o.value = v.name; o.textContent = '📱 本机: ' + v.name; sel.appendChild(o); nativeOpts.push(o);
        }
      });
      // 云端男/女声（任何浏览器/平台通用，不依赖本机语音包）
      (CLOUD_VOICES[L.k] || []).forEach(function (v) {
        var o = document.createElement('option'); o.value = v.id; o.textContent = '☁ ' + v.label; sel.appendChild(o);
      });
      // 优先恢复用户已保存的选择；无保存则默认本机嗓音（有则）或第一个云端声
      var choose = saved || (nativeOpts.length ? nativeOpts[0].value : (sel.options.length ? sel.options[0].value : ''));
      var q = sel.querySelector('option[value="' + choose.replace(/"/g, '\\"') + '"]');
      if (q) { sel.value = choose; cfg.voice[L.k] = choose; save(cfg); }
      // 关键：用户每次在下拉框里选择，立即持久化，否则"选了不生效"
      sel.onchange = function () { cfg.voice[L.k] = this.value; save(cfg); };
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
      LANGS.map(function (L) {
        return '<div class="row"><label>' + L.label + '</label><select id="ttsVoice_' + L.k + '"></select></div>';
      }).join('') +
      '<div class="row"><label>语速</label><input id="ttsRate" type="range" min="0.5" max="1.6" step="0.1" value="' + cfg.rate + '"><span id="ttsRateV" style="width:30px;color:#93a0bd;font-size:11px;text-align:right">' + cfg.rate + '</span></div>' +
      '<div class="row"><label>音量</label><input id="ttsVol" type="range" min="0" max="1" step="0.1" value="' + cfg.volume + '"><span id="ttsVolV" style="width:30px;color:#93a0bd;font-size:11px;text-align:right">' + cfg.volume + '</span></div>' +
      '<button class="speak" id="ttsSpeak">🔊 朗读当前词</button>' +
      '<button class="hide" id="ttsHide">🙈 隐藏此按钮</button>' +
      '<div class="hint">每个语言下拉框：📱 本机嗓音（电脑/苹果可挑男/女声，点击即时朗读、语速可调）；☁ 云端男/女声（需联网，用于手机缺本机嗓音的语言如马来/泰）。默认用本机声最自然；选了☁声或本机没有该语言声时才会走云端，联网不畅自动回退本机。</div>' +
      '</div>';
    document.body.appendChild(panel);

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

  // 关键：接管全局 speak，让四器（学习器/测试器/快速播放器/闪记）的全部逐词朗读、自动连读
  // 都统一走本模块引擎，使"朗读语音"面板里的选择对所有朗读生效。
  window.TrilTTS = { speak: speak, open: openPanel, init: init, config: cfg };
  try { window.speak = speak; } catch (e) {}
})();

/* =========================================================================
 * 四语母语习得 · 统一 AI 接口模块 (tril-ai.js)
 * -------------------------------------------------------------------------
 * 作用：为「学习器 / 测试器 / 快速播放器」三器提供统一的大模型答疑能力。
 *       - 在线：豆包(火山方舟) / 任意 OpenAI 兼容端点
 *       - 离线：内置模板兜底，无网络 / 无密钥也能用
 * 统一接入点：window.TrilAI
 *       TrilAI.chat({system, messages, prompt, onToken, onDone, onError})
 *       TrilAI.generateSentence(word)        -> 生成单词真实情景语句
 *       TrilAI.ask(question, context)        -> 问答，返回 Promise<string>
 *       TrilAI.open() / openWithWord(word)   -> 打开答疑面板
 *       TrilAI.setCurrent(ctx)               -> 各应用上报当前词上下文
 * 新增模型只需在 PROVIDERS 注册表中添加一项，前端无需改动其它代码。
 * ========================================================================= */
(function () {
  'use strict';

  var LS = 'tril_ai_config_v1';

  function $(s) { return document.querySelector(s); }
  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ---------- 配置（localStorage 持久化） ---------- */
  function loadCfg() {
    var c = { provider: 'offline', endpoint: '', apiKey: '', model: '', temperature: 0.7 };
    try { Object.assign(c, JSON.parse(localStorage.getItem(LS) || '{}')); } catch (e) {}
    return c;
  }
  function saveCfg(c) { try { localStorage.setItem(LS, JSON.stringify(c)); } catch (e) {} }
  var cfg = loadCfg();

  /* ---------- 默认系统提示词 ---------- */
  var DEFAULT_SYSTEM =
    '你是「四语母语习得」学习助手机器人，帮助用户学习英语、马来语、中文、泰语。' +
    '用户正在学习某个单词/短语，可能用中文提问。请用简洁、易懂、鼓励的语气回答，' +
    '必要时给出发音提示、例句、近义词或记忆技巧。若用户要求生成情景语句，请为所给单词' +
    '分别用四种语言各造一个自然、真实、可用于实际交流的句子。';

  var SENTENCE_SYSTEM =
    '你是语言教学专家。请为给定的单词/短语，分别用 英语 / 马来语 / 中文 / 泰文 各造一个' +
    '自然、真实、贴近生活的情景句子，句子要能体现该词的含义与用法。' +
    '严格按如下格式输出（每行一种语言，不要多余解释）：\n' +
    'EN: <英文句子>\nBM: <马来文句子>\nZH: <中文句子>\nTH: <泰文句子>';

  /* =======================================================================
   * Provider 注册表 —— 统一接入点
   * 每个 provider 暴露 stream(req) 异步生成器，逐块 yield 文本。
   * 新增模型（如文心、通义、本地 Ollama）只需在此追加一项。
   * ===================================================================== */
  var PROVIDERS = {
    offline: {
      label: '离线本地（无需网络 / 密钥，模板兜底）',
      stream: function (req) { return offlineStream(req); }
    },
    doubao: {
      label: '豆包 / 火山方舟（OpenAI 兼容）',
      endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
      stream: function (req) { return openaiStream(req, cfg.endpoint || PROVIDERS.doubao.endpoint); }
    },
    openai: {
      label: 'OpenAI 兼容（自定义端点）',
      stream: function (req) { return openaiStream(req, cfg.endpoint); }
    }
  };

  /* ---------- 消息拼装 ---------- */
  function buildMessages(req) {
    var msgs = [{ role: 'system', content: req.system || DEFAULT_SYSTEM }];
    (req.messages || []).forEach(function (m) { msgs.push(m); });
    if (req.prompt) msgs.push({ role: 'user', content: req.prompt });
    return msgs;
  }

  /* ---------- 在线流式（OpenAI 兼容 SSE） ---------- */
  async function* openaiStream(req, url) {
    if (!cfg.apiKey) throw new Error('尚未配置 API Key，请点「设置」填写（或用离线模式）。');
    if (!url) throw new Error('尚未配置接口地址（endpoint）。');
    var msgs = buildMessages(req);
    var body = {
      model: cfg.model || 'doubao-seed-1-6-250615',
      messages: msgs,
      stream: true,
      temperature: cfg.temperature
    };
    var resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.apiKey },
      body: JSON.stringify(body)
    });
    if (!resp.ok) {
      var txt = '';
      try { txt = await resp.text(); } catch (e) {}
      throw new Error('接口请求失败 ' + resp.status + '：' + txt.slice(0, 200));
    }
    var reader = resp.body.getReader();
    var dec = new TextDecoder();
    var buf = '';
    while (true) {
      var r = await reader.read();
      if (r.done) break;
      buf += dec.decode(r.value, { stream: true });
      var lines = buf.split('\n');
      buf = lines.pop();
      for (var i = 0; i < lines.length; i++) {
        var t = lines[i].trim();
        if (!t.startsWith('data:')) continue;
        var data = t.slice(5).trim();
        if (data === '[DONE]') return;
        try {
          var j = JSON.parse(data);
          var d = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
          if (d) yield d;
        } catch (e) {}
      }
    }
  }

  /* ---------- 离线兜底流式 ---------- */
  async function* offlineStream(req) {
    var text = offlineAnswer(req);
    // 逐块模拟流式输出
    var chunks = text.match(/[\s\S]{1,8}/g) || [text];
    for (var i = 0; i < chunks.length; i++) {
      await delay(16);
      yield chunks[i];
    }
  }
  function offlineAnswer(req) {
    var ctx = req.context || window.TRIL_CURRENT || {};
    var w = normalizeWord(ctx);
    var q = (req.prompt ||
      (req.messages && req.messages[req.messages.length - 1] && req.messages[req.messages.length - 1].content) || '').toLowerCase();

    if (req.kind === 'sentence') {
      return offlineSentence(w);
    }
    var info = [];
    info.push('【离线模式 · 本地整理】');
    info.push('当前词条：' + (w.en || w.zh || w.bm || w.th || '（无）'));
    if (w.en) info.push('🇬🇧 EN：' + w.en + (w.en_ipa ? '  /' + w.en_ipa + '/' : ''));
    if (w.bm) info.push('🇲🇾 BM：' + w.bm + (w.bm_pron ? '（' + w.bm_pron + '）' : ''));
    if (w.zh) info.push('🇨🇳 ZH：' + w.zh);
    if (w.th) info.push('🇹🇭 TH：' + w.th + (w.th_pron ? '（' + w.th_pron + '）' : ''));
    if (w.example && w.example.en) info.push('例句 EN：' + w.example.en);
    info.push('');
    info.push('你的问题：' + (q || '（未输入）'));
    info.push('');
    info.push('说明：离线模式仅能做词条信息汇总，无法真正“理解”并自由作答。');
    info.push('如需真实 AI 答疑 / 情景造句，请在面板「设置」中填写豆包或 OpenAI 兼容端点的 API Key，并切换为在线模式。');
    return info.join('\n');
  }
  function offlineSentence(w) {
    var en = w.en || '', zh = w.zh || '', bm = w.bm || '', th = w.th || '';
    var lines = [];
    lines.push('【离线模板 · 情景语句】（联网后由大模型生成更自然）');
    if (en && zh) lines.push('EN: I use the word "' + en + '" when I talk about ' + zh + '.');
    if (bm && zh) lines.push('BM: Perkataan "' + bm + '" bermaksud ' + zh + ' dalam kehidupan seharian.');
    if (zh) lines.push('ZH: 我们在日常生活中提到「' + zh + '」时，会用这个词。');
    if (th && zh) lines.push('TH: คำว่า "' + th + '" หมายถึง ' + zh + ' ในชีวิตประจำวัน');
    if (!en && !bm && !zh && !th) lines.push('（当前词缺少语种字段，无法生成情景句。可在「我的词库」中补全后重试。）');
    return lines.join('\n');
  }

  /* ---------- 词条标准化 ---------- */
  function normalizeWord(c) {
    if (!c) return {};
    var ex = c.example || {};
    var e = {};
    ['en', 'bm', 'zh', 'th'].forEach(function (L) {
      e[L] = c[L] || (ex && ex[L] ? ex[L] : '') || '';
    });
    e.en_ipa = c.en_ipa || '';
    e.bm_pron = c.bm_pron || '';
    e.th_pron = c.th_pron || '';
    e.example = ex;
    return e;
  }

  /* ---------- 对外：流式对话 ---------- */
  function chat(req) {
    req = req || {};
    var provider = PROVIDERS[cfg.provider] || PROVIDERS.offline;
    var gen = provider.stream(req);
    var buf = '';
    return new Promise(function (resolve, reject) {
      (async function () {
        try {
          for await (var chunk of gen) {
            buf += chunk;
            if (req.onToken) req.onToken(chunk, buf);
          }
          if (req.onDone) req.onDone(buf);
          resolve(buf);
        } catch (err) {
          if (req.onError) req.onError(err);
          else reject(err);
        }
      })();
    });
  }

  /* ---------- 对外：生成情景句 ---------- */
  function generateSentence(word) {
    var w = normalizeWord(word || window.TRIL_CURRENT || {});
    var ctxLines = [];
    if (w.en) ctxLines.push('英文：' + w.en);
    if (w.zh) ctxLines.push('中文：' + w.zh);
    if (w.bm) ctxLines.push('马来文：' + w.bm);
    if (w.th) ctxLines.push('泰文：' + w.th);
    var prompt = '请为下面这个单词/短语生成情景语句：\n' + ctxLines.join('\n') +
      (w.en_ipa ? ('\n英文音标：' + w.en_ipa) : '') +
      '\n请严格按 EN/BM/ZH/TH 四行格式输出。';
    return chat({ kind: 'sentence', system: SENTENCE_SYSTEM, prompt: prompt,
      onToken: null, onError: function (e) { throw e; } });
  }

  /* ---------- 对外：问答 ---------- */
  function ask(question, context) {
    return chat({
      system: DEFAULT_SYSTEM,
      prompt: (context ? ('参考词条：' + JSON.stringify(normalizeWord(context)) + '\n') : '') + question
    });
  }

  /* =======================================================================
   * UI：悬浮答疑面板 + 设置弹窗（自动注入，三器通用）
   * ===================================================================== */
  function injectCSS() {
    if (el('trilAiCss')) return;
    var c = document.createElement('style'); c.id = 'trilAiCss';
    c.textContent =
      '#trilAiBtn{position:fixed;left:12px;bottom:12px;z-index:99994;padding:10px 14px;border:none;border-radius:22px;' +
      'background:linear-gradient(90deg,#5b8cff,#7aa2ff);color:#fff;font:13px/1 system-ui;font-weight:700;cursor:pointer;box-shadow:0 8px 22px rgba(0,0,0,.4)}' +
      '#trilAi{position:fixed;right:12px;bottom:12px;z-index:99995;width:360px;max-width:94vw;height:70vh;max-height:560px;' +
      'background:#0f1729;color:#e8edf7;border:1px solid #2c3756;border-radius:16px;display:none;flex-direction:column;' +
      'font:13px/1.5 system-ui;box-shadow:0 20px 60px rgba(0,0,0,.55);overflow:hidden}' +
      '#trilAi.show{display:flex}' +
      '#trilAi .hd{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid #2c3756;background:#15203a}' +
      '#trilAi .hd b{font-size:14px;color:#7aa2ff;flex:1}' +
      '#trilAi .hd .x{cursor:pointer;color:#93a0bd;font-size:16px;padding:2px 6px}' +
      '#trilAi .ctx{font-size:11px;color:#93a0bd;padding:8px 14px;border-bottom:1px solid #1d2742;background:#11192c;line-height:1.6}' +
      '#trilAi .ctx b{color:#cfe0ff}' +
      '#trilAi .msgs{flex:1;overflow-y:auto;padding:12px 14px;display:flex;flex-direction:column;gap:10px}' +
      '#trilAi .m{white-space:pre-wrap;word-break:break-word;padding:9px 11px;border-radius:11px;max-width:90%;line-height:1.65}' +
      '#trilAi .m.u{background:#2563eb;color:#fff;align-self:flex-end;border-bottom-right-radius:3px}' +
      '#trilAi .m.a{background:#1a2238;border:1px solid #2c3756;align-self:flex-start;border-bottom-left-radius:3px}' +
      '#trilAi .m .meta{font-size:10px;opacity:.6;margin-bottom:3px}' +
      '#trilAi .typing{opacity:.7;font-style:italic}' +
      '#trilAi .ft{border-top:1px solid #2c3756;padding:10px 12px;display:flex;flex-direction:column;gap:8px;background:#11192c}' +
      '#trilAi .ft textarea{width:100%;height:52px;background:#0b1220;color:#e8edf7;border:1px solid #2c3756;border-radius:9px;padding:8px;box-sizing:border-box;font:13px system-ui;resize:none}' +
      '#trilAi .ft .row{display:flex;gap:7px}' +
      '#trilAi .ft button{flex:1;border:none;border-radius:9px;padding:9px;font:12px system-ui;cursor:pointer;color:#fff}' +
      '#trilAi .ft .send{background:#2563eb}' +
      '#trilAi .ft .snt{background:#7c3aed}' +
      '#trilAi .ft .set{background:#334155;flex:0 0 auto;width:auto;padding:9px 12px}' +
      '#trilAi .prov{font-size:11px;color:#93a0bd;text-align:center}' +
      '#trilAiCfg{position:fixed;inset:0;background:rgba(0,0,0,.6);display:none;align-items:center;justify-content:center;z-index:99999}' +
      '#trilAiCfg.show{display:flex}' +
      '#trilAiCfg .modal{background:#0f1729;color:#e8edf7;border:1px solid #2c3756;border-radius:16px;padding:20px;width:420px;max-width:92vw;max-height:86vh;overflow-y:auto}' +
      '#trilAiCfg h3{margin:0 0 14px;font-size:16px;color:#7aa2ff}' +
      '#trilAiCfg label{display:block;font-size:12px;color:#93a0bd;margin:10px 0 5px}' +
      '#trilAiCfg select,#trilAiCfg input{width:100%;background:#11192c;color:#e8edf7;border:1px solid #2c3756;border-radius:8px;padding:9px;box-sizing:border-box;font:13px system-ui;min-height:40px}' +
      '#trilAiCfg .hint{font-size:11px;color:#93a0bd;line-height:1.6;margin-top:6px}' +
      '#trilAiCfg .ok{margin-top:14px;background:#2563eb;color:#fff;border:none;border-radius:9px;padding:11px;font:13px system-ui;cursor:pointer;width:100%}' +
      '#trilAiCfg .warn{color:#ffb454;font-size:11px;margin-top:8px;line-height:1.6}';
    document.head.appendChild(c);
  }

  function ctxText() {
    var c = window.TRIL_CURRENT || {};
    var w = normalizeWord(c);
    if (!w.en && !w.zh && !w.bm && !w.th) return '（未检测到当前词，可直接输入问题）';
    var p = [];
    if (w.en) p.push('EN <b>' + esc(w.en) + '</b>');
    if (w.zh) p.push('ZH <b>' + esc(w.zh) + '</b>');
    if (w.bm) p.push('BM <b style="color:#ffb454">' + esc(w.bm) + '</b>');
    if (w.th) p.push('TH <b style="color:#c792ea">' + esc(w.th) + '</b>');
    return '当前词：' + p.join(' ｜ ');
  }

  function refreshCtx() { var x = el('trilAiCtx'); if (x) x.innerHTML = ctxText(); }

  function addMsg(role, text, meta) {
    var box = el('trilAiMsgs');
    var d = document.createElement('div');
    d.className = 'm ' + role;
    d.innerHTML = (meta ? '<div class="meta">' + esc(meta) + '</div>' : '') + esc(text);
    box.appendChild(d);
    box.scrollTop = box.scrollHeight;
    return d;
  }

  function send(text) {
    text = (text || '').trim();
    if (!text) return;
    addMsg('u', text);
    var node = addMsg('a typing', '正在思考…');
    var buf = '';
    chat({
      prompt: text,
      onToken: function (chunk, all) {
        buf = all;
        node.classList.remove('typing');
        node.textContent = buf;
        var box = el('trilAiMsgs'); box.scrollTop = box.scrollHeight;
      },
      onDone: function (all) {
        node.classList.remove('typing');
        node.textContent = all || '（无内容返回）';
      },
      onError: function (e) {
        node.classList.remove('typing');
        node.textContent = '⚠ 出错了：' + (e && e.message ? e.message : e);
      }
    });
  }

  function genSentenceFlow() {
    var node = addMsg('a typing', '正在生成情景语句…');
    var buf = '';
    chat({
      kind: 'sentence',
      system: SENTENCE_SYSTEM,
      prompt: (function () {
        var w = normalizeWord(window.TRIL_CURRENT || {});
        var p = [];
        if (w.en) p.push('英文：' + w.en);
        if (w.zh) p.push('中文：' + w.zh);
        if (w.bm) p.push('马来文：' + w.bm);
        if (w.th) p.push('泰文：' + w.th);
        return '请为下面这个单词/短语生成情景语句：\n' + p.join('\n') + '\n请严格按 EN/BM/ZH/TH 四行格式输出。';
      })(),
      onToken: function (chunk, all) { buf = all; node.classList.remove('typing'); node.textContent = buf; var box = el('trilAiMsgs'); box.scrollTop = box.scrollHeight; },
      onDone: function (all) { node.classList.remove('typing'); node.textContent = all || '（无内容返回）'; },
      onError: function (e) { node.classList.remove('typing'); node.textContent = '⚠ 生成失败：' + (e && e.message ? e.message : e); }
    });
  }

  function openPanel(withWord) {
    var box = el('trilAi'); if (!box) return;
    box.classList.add('show');
    refreshCtx();
    if (withWord) genSentenceFlow();
  }
  function closePanel() { var box = el('trilAi'); if (box) box.classList.remove('show'); }

  function openConfig() {
    var m = el('trilAiCfg'); if (!m) return;
    var sel = el('trilAiProv'); sel.value = cfg.provider;
    el('trilAiEp').value = cfg.endpoint || '';
    el('trilAiKey').value = cfg.apiKey || '';
    el('trilAiModel').value = cfg.model || '';
    el('trilAiTemp').value = cfg.temperature;
    updateCfgHint();
    m.classList.add('show');
  }
  function updateCfgHint() {
    var prov = el('trilAiProv').value;
    var h = el('trilAiCfgHint');
    if (prov === 'offline') { h.className = 'hint'; h.textContent = '离线模式：无需任何配置，使用本地模板兜底，适合无网络环境。'; }
    else if (prov === 'doubao') { h.className = 'hint'; h.innerHTML = '豆包需在火山方舟开通推理点并创建 API Key。默认端点已填好，只需粘贴 Key 与模型名（如 doubao-seed-1-6-250615）。'; }
    else { h.className = 'hint'; h.innerHTML = '填入任意 OpenAI 兼容的 /chat/completions 端点与 Key，例如本地 Ollama、vLLM、Azure OpenAI 等。'; }
    var epRow = el('trilAiEpRow'); if (epRow) epRow.style.display = (prov === 'doubao') ? 'none' : 'block';
  }

  function buildUI() {
    injectCSS();
    var btn = document.createElement('button');
    btn.id = 'trilAiBtn'; btn.textContent = '🤖 问 AI';
    btn.onclick = function () { openPanel(false); };
    document.body.appendChild(btn);

    var panel = document.createElement('div');
    panel.id = 'trilAi';
    panel.innerHTML =
      '<div class="hd"><b>🤖 AI 答疑</b><span class="x" id="trilAiClose">✕</span></div>' +
      '<div class="ctx" id="trilAiCtx"></div>' +
      '<div class="msgs" id="trilAiMsgs"></div>' +
      '<div class="ft">' +
      '<textarea id="trilAiInput" placeholder="用中文提问，例如：这个词的用法？怎么记？"></textarea>' +
      '<div class="row">' +
      '<button class="send" id="trilAiSend">发送</button>' +
      '<button class="snt" id="trilAiSent">✨ 生成情景句</button>' +
      '<button class="set" id="trilAiSet">⚙ 设置</button>' +
      '</div>' +
      '<div class="prov" id="trilAiProvTxt"></div>' +
      '</div>';
    document.body.appendChild(panel);

    var cfgM = document.createElement('div');
    cfgM.id = 'trilAiCfg';
    cfgM.innerHTML =
      '<div class="modal">' +
      '<h3>⚙ AI 接口设置（统一接入点）</h3>' +
      '<label>模型供应商</label>' +
      '<select id="trilAiProv">' +
      '<option value="offline">离线本地（模板兜底，无需密钥）</option>' +
      '<option value="doubao">豆包 / 火山方舟（OpenAI 兼容）</option>' +
      '<option value="openai">OpenAI 兼容（自定义端点）</option>' +
      '</select>' +
      '<div id="trilAiEpRow">' +
      '<label>接口地址 endpoint</label>' +
      '<input id="trilAiEp" placeholder="https://your-endpoint/v1/chat/completions">' +
      '</div>' +
      '<label>API Key</label>' +
      '<input id="trilAiKey" type="password" placeholder="sk-... 或 ark-...">' +
      '<label>模型名 model</label>' +
      '<input id="trilAiModel" placeholder="doubao-seed-1-6-250615 / gpt-4o / 自定义">' +
      '<label>温度 temperature（0–1，越大越发散）</label>' +
      '<input id="trilAiTemp" type="number" min="0" max="1" step="0.1" value="0.7">' +
      '<div id="trilAiCfgHint" class="hint"></div>' +
      '<div class="warn">⚠ 密钥仅保存在本机浏览器 localStorage，不会上传到除你所填接口之外的任何服务器。</div>' +
      '<button class="ok" id="trilAiCfgOk">保存并关闭</button>' +
      '</div>';
    document.body.appendChild(cfgM);

    el('trilAiClose').onclick = closePanel;
    el('trilAiSend').onclick = function () { var t = el('trilAiInput').value; el('trilAiInput').value = ''; send(t); };
    el('trilAiInput').addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); var t = el('trilAiInput').value; el('trilAiInput').value = ''; send(t); } });
    el('trilAiSent').onclick = genSentenceFlow;
    el('trilAiSet').onclick = openConfig;
    el('trilAiProv').onchange = updateCfgHint;
    el('trilAiCfgOk').onclick = function () {
      cfg.provider = el('trilAiProv').value;
      cfg.endpoint = el('trilAiEp').value.trim();
      cfg.apiKey = el('trilAiKey').value.trim();
      cfg.model = el('trilAiModel').value.trim();
      cfg.temperature = parseFloat(el('trilAiTemp').value) || 0.7;
      saveCfg(cfg);
      el('trilAiCfg').classList.remove('show');
      updateProvTxt();
      refreshCtx();
    };
    cfgM.onclick = function (e) { if (e.target === cfgM) cfgM.classList.remove('show'); };

    // 供播放器「✨ AI 生成情景句」按钮调用
    window.TrilAI.openWithWord = function (word) { if (word) window.TRIL_CURRENT = word; openPanel(true); };
    updateProvTxt();
  }
  function updateProvTxt() {
    var p = el('trilAiProvTxt'); if (p) p.textContent = '当前模式：' + (PROVIDERS[cfg.provider] ? PROVIDERS[cfg.provider].label : cfg.provider);
  }

  /* ---------- 启动 ---------- */
  function init() {
    buildUI();
  }
  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);

  /* ---------- 对外暴露 ---------- */
  window.TrilAI = {
    chat: chat,
    ask: ask,
    generateSentence: generateSentence,
    open: function () { openPanel(false); },
    openWithWord: function (word) { if (word) window.TRIL_CURRENT = word; openPanel(true); },
    setCurrent: function (ctx) { window.TRIL_CURRENT = ctx || {}; refreshCtx(); },
    config: function () { openConfig(); },
    PROVIDERS: PROVIDERS,
    _normalize: normalizeWord
  };
})();

/* =========================================================================
 * 四语母语习得 · 中文拼音标注模块 (tril-pinyin.js)
 * -------------------------------------------------------------------------
 * 作用：为四个模块（学习器 / 测试器 / 快速播放器 / 闪记）统一提供「中文下方拼音」
 *      方便马来用户 / 中文初学者拼读中文翻译。
 * 依赖：pinyin-pro UMD（全局 window.pinyinPro），需在本文件之前加载。
 * 暴露：window.TrilPinyin
 *   get(text)  -> 拼音字符串（无汉字或库未就绪时返回空串）
 *   html(text) -> '<div class="tril-py">拼音</div>'（无则空串）
 * 关键：仅对含汉字的文本生成拼音（正则守卫），避免把英文/马来文逐字母拆开。
 * ========================================================================= */
(function () {
  'use strict';

  function hasHan(s) { return /[一-鿿]/.test(s || ''); }

  function py(s) {
    if (!s || !hasHan(s) || !window.pinyinPro) return '';
    try {
      var r = window.pinyinPro.pinyin(s, { toneType: 'symbol' });
      return String(r).replace(/\s+/g, ' ').trim();
    } catch (e) { return ''; }
  }

  function injectCss() {
    if (document.getElementById('trilPyCss')) return;
    var c = document.createElement('style');
    c.id = 'trilPyCss';
    c.textContent =
      '.tril-py{font-size:11px;line-height:1.45;color:#9fb0d0;margin-top:3px;letter-spacing:.3px;' +
      'font-family:"PingFang SC","Microsoft YaHei","Hiragino Sans GB",sans-serif;word-break:break-word}' +
      '.single .tril-py,.flashcard .tril-py{text-align:center}' +
      '.ex .tril-py,.exline .tril-py{margin-top:2px}' +
      '.c-zh .tril-py{margin-top:2px}';
    document.head.appendChild(c);
  }

  injectCss();

  window.TrilPinyin = {
    get: py,
    html: function (s) { var p = py(s); return p ? '<div class="tril-py">' + p + '</div>' : ''; }
  };
})();

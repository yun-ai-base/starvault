/* ==========================================================================
   StarVault — 本地优先的创作者收藏馆
   零依赖 / 无构建 / 数据只存本机 localStorage
   ========================================================================== */
(function () {
  'use strict';

  var STORE_KEY = 'starvault.items.v1';
  var THEME_KEY = 'starvault.theme';
  var PAGE_SIZE = 24;

  var PLATFORMS = {
    x: { label: 'X / Twitter', url: function (h) { return 'https://x.com/' + h; } },
    bilibili: { label: '哔哩哔哩', url: function (h) { return 'https://space.bilibili.com/' + h; } },
    xiaohongshu: { label: '小红书', url: function (h) { return 'https://www.xiaohongshu.com/user/profile/' + h; } },
    youtube: { label: 'YouTube', url: function (h) { return 'https://www.youtube.com/@' + h; } },
    other: { label: '其他', url: function () { return ''; } }
  };

  var CATEGORIES = [
    { id: 'all', label: '全部', test: function () { return true; } },
    { id: 'verified', label: '认证', test: function (it) { return !!it.verified; } },
    { id: 'top', label: '头部 50万+', test: function (it) { return num(it.followers) >= 500000; } },
    { id: 'known', label: '知名 10万+', test: function (it) { return num(it.followers) >= 100000; } },
    { id: 'recent', label: '最近收录', test: function (it) { return Date.now() - new Date(it.addedAt || 0).getTime() < 7 * 864e5; } },
    { id: 'tagged', label: '已打标签', test: function (it) { return (it.tags || []).length > 0; } },
    { id: 'archived', label: '归档箱', test: function (it) { return !!it.archived; } }
  ];

  /* ---------------- 工具 ---------------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function num(v) { var n = Number(v); return isFinite(n) && n > 0 ? n : 0; }
  function uid() { return 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function fmtNum(v) {
    var n = num(v);
    if (n >= 1e8) return (n / 1e8).toFixed(n >= 1e9 ? 0 : 1) + ' 亿';
    if (n >= 1e4) return (n / 1e4).toFixed(n >= 1e5 ? 0 : 1) + ' 万';
    return n ? String(n) : '—';
  }

  function timeAgo(iso) {
    var t = new Date(iso || 0).getTime();
    if (!t) return '—';
    var d = Math.floor((Date.now() - t) / 1000);
    if (d < 60) return '刚刚';
    if (d < 3600) return Math.floor(d / 60) + ' 分钟前';
    if (d < 86400) return Math.floor(d / 3600) + ' 小时前';
    if (d < 2592000) return Math.floor(d / 86400) + ' 天前';
    return new Date(t).toLocaleDateString('zh-CN');
  }

  function avatarOf(it) {
    if (it.avatar) return it.avatar;
    var ch = (it.name || it.handle || '?').trim().charAt(0).toUpperCase();
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#8b5cf6"/><stop offset="1" stop-color="#22d3ee"/>' +
      '</linearGradient></defs><rect width="120" height="120" fill="url(#g)"/>' +
      '<text x="60" y="78" font-size="56" font-family="sans-serif" fill="#fff" text-anchor="middle">' +
      esc(ch) + '</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function profileUrlOf(it) {
    if (it.profileUrl) return it.profileUrl;
    var p = PLATFORMS[it.platform] || PLATFORMS.other;
    return it.handle ? p.url(it.handle) : '';
  }

  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.hidden = true; }, 2400);
  }

  /* ---------------- 数据层 ---------------- */
  var items = [];

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      items = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(items)) items = [];
    } catch (e) {
      items = [];
      toast('本地数据读取失败,已按空库启动');
    }
    items.forEach(function (it) { if (!it.id) it.id = uid(); });
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(items));
    } catch (e) {
      toast('保存失败:浏览器存储空间可能已满');
    }
  }

  function normalize(raw) {
    var handle = String(raw.handle || '').trim().replace(/^@/, '');
    return {
      id: raw.id || uid(),
      name: String(raw.name || handle || '未命名').trim().slice(0, 80),
      handle: handle.slice(0, 40),
      followers: num(raw.followers),
      verified: !!raw.verified,
      archived: !!raw.archived,
      tags: Array.isArray(raw.tags)
        ? raw.tags.map(function (t) { return String(t).trim(); }).filter(Boolean).slice(0, 12)
        : String(raw.tags || '').split(/[,，;；]/).map(function (t) { return t.trim(); }).filter(Boolean).slice(0, 12),
      bio: String(raw.bio || '').slice(0, 400),
      note: String(raw.note || '').slice(0, 400),
      avatar: String(raw.avatar || '').slice(0, 500),
      profileUrl: String(raw.profileUrl || '').slice(0, 500),
      platform: PLATFORMS[raw.platform] ? raw.platform : 'x',
      addedAt: raw.addedAt || new Date().toISOString()
    };
  }

  function upsertMany(list) {
    var byHandle = {};
    items.forEach(function (it) { byHandle[it.handle.toLowerCase()] = it; });
    var added = 0, updated = 0;
    list.forEach(function (raw) {
      var it = normalize(raw);
      if (!it.handle) return;
      var key = it.handle.toLowerCase();
      var exist = byHandle[key];
      if (exist) {
        it.id = exist.id;
        it.addedAt = exist.addedAt;
        Object.keys(it).forEach(function (k) { exist[k] = it[k]; });
        updated++;
      } else {
        items.push(it);
        byHandle[key] = it;
        added++;
      }
    });
    save();
    return { added: added, updated: updated };
  }

  /* ---------------- 状态与筛选 ---------------- */
  var state = { q: '', cat: 'all', sort: 'followers-desc', shown: PAGE_SIZE };

  function filtered() {
    var q = state.q.trim().toLowerCase();
    var cat = CATEGORIES.filter(function (c) { return c.id === state.cat; })[0] || CATEGORIES[0];
    var list = items.filter(function (it) {
      if (state.cat !== 'archived' && it.archived) return false;
      if (!cat.test(it)) return false;
      if (!q) return true;
      return [it.name, it.handle, it.bio, it.note, (it.tags || []).join(' ')]
        .join(' ').toLowerCase().indexOf(q) >= 0;
    });
    var sorters = {
      'followers-desc': function (a, b) { return num(b.followers) - num(a.followers); },
      'followers-asc': function (a, b) { return num(a.followers) - num(b.followers); },
      'name-asc': function (a, b) { return String(a.name).localeCompare(String(b.name), 'zh-CN'); },
      'added-desc': function (a, b) { return new Date(b.addedAt) - new Date(a.addedAt); },
      'added-asc': function (a, b) { return new Date(a.addedAt) - new Date(b.addedAt); }
    };
    return list.sort(sorters[state.sort] || sorters['followers-desc']);
  }

  /* ---------------- 渲染:收藏馆 ---------------- */
  function renderStats() {
    var total = items.length;
    var active = items.filter(function (i) { return !i.archived; }).length;
    var verified = items.filter(function (i) { return i.verified; }).length;
    var max = items.reduce(function (m, i) { return Math.max(m, num(i.followers)); }, 0);
    var sum = items.reduce(function (s, i) { return s + num(i.followers); }, 0);
    var data = [
      { label: '收藏总数', value: total },
      { label: '在用 / 归档', value: active + ' / ' + (total - active) },
      { label: '认证占比', value: total ? Math.round(verified / total * 100) + '%' : '—' },
      { label: '最高粉丝', value: fmtNum(max) },
      { label: '粉丝中位数', value: total ? fmtNum(median(items.map(function (i) { return num(i.followers); }))) : '—' },
      { label: '粉丝合计', value: fmtNum(sum) }
    ];
    $('#stats').innerHTML = data.map(function (d) {
      return '<div class="stat"><div class="stat__label">' + esc(d.label) +
        '</div><div class="stat__value">' + esc(d.value) + '</div></div>';
    }).join('');
  }

  function median(arr) {
    if (!arr.length) return 0;
    var a = arr.slice().sort(function (x, y) { return x - y; });
    var mid = Math.floor(a.length / 2);
    return a.length % 2 ? a[mid] : Math.round((a[mid - 1] + a[mid]) / 2);
  }

  function renderChips() {
    $('#chips').innerHTML = CATEGORIES.map(function (c) {
      var n = (c.id === 'all' ? items.filter(function (i) { return !i.archived; }) : items.filter(c.test)).length;
      return '<button class="chip' + (state.cat === c.id ? ' is-active' : '') + '" data-cat="' + c.id +
        '" type="button">' + esc(c.label) + '<span class="chip__n">' + n + '</span></button>';
    }).join('');
  }

  function cardHtml(it) {
    var tags = (it.tags || []).slice(0, 3).map(function (t) {
      return '<span class="tag">' + esc(t) + '</span>';
    }).join('');
    return '<button class="card" type="button" data-open="' + esc(it.id) + '">' +
      '<div class="card__top"></div>' +
      '<img class="card__avatar" src="' + esc(avatarOf(it)) + '" alt="" loading="lazy" ' +
      'onerror="this.style.visibility=\'hidden\'">' +
      '<div class="card__body">' +
      '<div class="card__name">' + esc(it.name) +
      (it.verified ? '<span class="badge" title="认证">✓</span>' : '') + '</div>' +
      '<div class="card__handle">@' + esc(it.handle) + ' · ' + esc((PLATFORMS[it.platform] || {}).label || '') + '</div>' +
      '<p class="card__bio">' + esc(it.bio || '暂无简介') + '</p>' +
      '<div class="tags">' + tags + '</div>' +
      '<div class="card__meta"><span class="card__followers">' + esc(fmtNum(it.followers)) +
      '</span><span>' + esc(timeAgo(it.addedAt)) + '</span></div>' +
      '</div>' +
      (it.archived ? '<span class="flag-archived">归档</span>' : '') +
      '</button>';
  }

  function renderGrid() {
    var list = filtered();
    var slice = list.slice(0, state.shown);
    $('#grid').innerHTML = slice.map(cardHtml).join('');

    var empty = $('#empty');
    if (!list.length) {
      empty.hidden = false;
      if (!items.length) {
        $('#empty-title').textContent = '收藏馆还是空的';
        $('#empty-text').textContent = '去管理台手动添加,或导入一份 JSON / CSV 数据。';
      } else {
        $('#empty-title').textContent = '没有匹配的条目';
        $('#empty-text').textContent = '换个关键词,或点「全部」重置筛选。';
      }
    } else {
      empty.hidden = true;
    }

    var moreWrap = $('#more-wrap');
    moreWrap.hidden = list.length <= state.shown;
    $('#btn-more').textContent = '加载更多 (' + (list.length - state.shown) + ' 条剩余)';
  }

  function renderSpotlight() {
    var pool = items.filter(function (i) { return !i.archived; });
    var body = $('#spotlight-body');
    if (!pool.length) {
      body.innerHTML = '<p class="muted">还没有条目,先去管理台添加几位创作者吧。</p>';
      return;
    }
    var it = pool[Math.floor(Math.random() * pool.length)];
    toast._spot = it;
    body.innerHTML =
      '<img class="detail__avatar" style="width:64px;height:64px" src="' + esc(avatarOf(it)) + '" alt="">' +
      '<div><div class="card__name">' + esc(it.name) +
      (it.verified ? '<span class="badge">✓</span>' : '') + '</div>' +
      '<div class="card__handle">@' + esc(it.handle) + '</div>' +
      '<div style="margin-top:6px;font-weight:600">' + esc(fmtNum(it.followers)) + ' 粉丝</div>' +
      '<p class="muted" style="margin:6px 0 0;font-size:12.5px">' + esc(it.bio || '暂无简介') + '</p></div>';
  }

  /* ---------------- 详情弹窗 ---------------- */
  function openDetail(id) {
    var it = items.filter(function (x) { return x.id === id; })[0];
    if (!it) return;
    var url = profileUrlOf(it);
    var tags = (it.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('');
    $('#modal-body').innerHTML =
      '<div class="detail">' +
      '<img class="detail__avatar" src="' + esc(avatarOf(it)) + '" alt="">' +
      '<div style="flex:1"><h3 id="modal-name">' + esc(it.name) +
      (it.verified ? '<span class="badge" title="认证">✓</span>' : '') + '</h3>' +
      '<div class="detail__handle">@' + esc(it.handle) + ' · ' + esc((PLATFORMS[it.platform] || {}).label || '') +
      (it.archived ? ' · <span style="color:#f59e0b">已归档</span>' : '') + '</div>' +
      '<div class="detail__stats">' +
      '<div class="detail__stat"><small>粉丝</small><strong>' + esc(fmtNum(it.followers)) + '</strong></div>' +
      '<div class="detail__stat"><small>收录</small><strong>' + esc(timeAgo(it.addedAt)) + '</strong></div>' +
      '<div class="detail__stat"><small>平台</small><strong>' + esc((PLATFORMS[it.platform] || {}).label || '') + '</strong></div>' +
      '</div></div></div>' +
      (it.bio ? '<div class="detail__section"><h4>简介</h4><p style="margin:0">' + esc(it.bio) + '</p></div>' : '') +
      (tags ? '<div class="detail__section"><h4>标签</h4><div class="tags">' + tags + '</div></div>' : '') +
      (it.note ? '<div class="detail__section"><h4>私人备注</h4><div class="note-box">' + esc(it.note) + '</div></div>' : '') +
      '<div class="detail__actions">' +
      (url ? '<a class="btn" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">前往主页 ↗</a>' : '') +
      '<button class="btn btn--ghost" type="button" data-edit="' + esc(it.id) + '">编辑</button>' +
      '<button class="btn btn--ghost" type="button" data-copy="' + esc(url || it.handle) + '">复制链接</button>' +
      '</div>';
    show('#modal');
  }

  function show(sel) { $(sel).hidden = false; document.body.style.overflow = 'hidden'; }
  function hide(sel) { $(sel).hidden = true; document.body.style.overflow = ''; }

  /* ---------------- 编辑器 ---------------- */
  var editingId = null;

  function openEditor(id) {
    editingId = id || null;
    var it = id ? items.filter(function (x) { return x.id === id; })[0] : null;
    var f = $('#editor-form');
    f.reset();
    $('#editor-title').textContent = it ? '编辑条目' : '新增条目';
    if (it) {
      f.name.value = it.name;
      f.handle.value = it.handle;
      f.followers.value = it.followers || '';
      f.platform.value = it.platform;
      f.avatar.value = it.avatar || '';
      f.profileUrl.value = it.profileUrl || '';
      f.tags.value = (it.tags || []).join(', ');
      f.bio.value = it.bio || '';
      f.note.value = it.note || '';
      f.verified.checked = !!it.verified;
      f.archived.checked = !!it.archived;
    }
    hide('#modal');
    show('#editor');
    setTimeout(function () { f.name.focus(); }, 30);
  }

  function submitEditor(e) {
    e.preventDefault();
    var f = e.target;
    var raw = {
      name: f.name.value,
      handle: f.handle.value,
      followers: f.followers.value,
      platform: f.platform.value,
      avatar: f.avatar.value,
      profileUrl: f.profileUrl.value,
      tags: f.tags.value,
      bio: f.bio.value,
      note: f.note.value,
      verified: f.verified.checked,
      archived: f.archived.checked
    };
    var it = normalize(raw);
    if (!it.handle) { toast('请填写账号 (handle)'); return; }
    var dup = items.filter(function (x) {
      return x.handle.toLowerCase() === it.handle.toLowerCase() && x.id !== editingId;
    })[0];
    if (dup) { toast('账号 @' + it.handle + ' 已存在'); return; }

    if (editingId) {
      var idx = items.map(function (x) { return x.id; }).indexOf(editingId);
      it.id = editingId;
      it.addedAt = items[idx].addedAt;
      items[idx] = it;
      toast('已更新');
    } else {
      items.push(it);
      toast('已添加');
    }
    save();
    hide('#editor');
    renderAll();
  }

  /* ---------------- 管理台 ---------------- */
  function renderAdmin() {
    $('#admin-count').textContent = items.length;
    var rows = items.slice().sort(function (a, b) { return new Date(b.addedAt) - new Date(a.addedAt); });
    $('#admin-rows').innerHTML = rows.map(function (it) {
      return '<tr>' +
        '<td><img class="mini-avatar" src="' + esc(avatarOf(it)) + '" alt="">' + esc(it.name) + '</td>' +
        '<td>@' + esc(it.handle) + '</td>' +
        '<td>' + esc(fmtNum(it.followers)) + '</td>' +
        '<td>' + (it.verified ? '✓' : '—') + '</td>' +
        '<td>' + esc((it.tags || []).join(', ') || '—') + '</td>' +
        '<td>' + (it.archived ? '归档' : '在用') + '</td>' +
        '<td><div class="row-actions">' +
        '<button class="btn btn--ghost btn--sm" type="button" data-edit="' + esc(it.id) + '">编辑</button>' +
        '<button class="btn btn--ghost btn--sm" type="button" data-toggle="' + esc(it.id) + '">' +
        (it.archived ? '恢复' : '归档') + '</button>' +
        '<button class="btn btn--danger btn--sm" type="button" data-del="' + esc(it.id) + '">删除</button>' +
        '</div></td></tr>';
    }).join('');
    $('#admin-empty').hidden = items.length > 0;
  }

  /* ---------------- 导入导出 ---------------- */
  function download(filename, text, mime) {
    var blob = new Blob([text], { type: mime + ';charset=utf-8' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  }

  function stamp() { return new Date().toISOString().slice(0, 10); }

  function exportJson() {
    download('starvault-' + stamp() + '.json', JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), items: items }, null, 2), 'application/json');
    toast('已导出 JSON');
  }

  var CSV_COLS = ['name', 'handle', 'followers', 'verified', 'archived', 'platform', 'tags', 'bio', 'note', 'avatar', 'profileUrl', 'addedAt'];

  function csvCell(v) {
    var s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }

  function exportCsv() {
    var lines = [CSV_COLS.join(',')];
    items.forEach(function (it) {
      lines.push(CSV_COLS.map(function (c) {
        var v = it[c];
        if (c === 'tags') v = (it.tags || []).join('|');
        if (c === 'verified' || c === 'archived') v = v ? 'true' : 'false';
        return csvCell(v);
      }).join(','));
    });
    download('starvault-' + stamp() + '.csv', '\ufeff' + lines.join('\r\n'), 'text/csv');
    toast('已导出 CSV');
  }

  function parseCsv(text) {
    text = text.replace(/^\ufeff/, '');
    var rows = [], row = [], cur = '', inQ = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inQ) {
        if (c === '"') {
          if (text[i + 1] === '"') { cur += '"'; i++; } else { inQ = false; }
        } else { cur += c; }
      } else if (c === '"') { inQ = true; }
      else if (c === ',') { row.push(cur); cur = ''; }
      else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
      else if (c !== '\r') { cur += c; }
    }
    if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
    if (!rows.length) return [];
    var head = rows[0].map(function (h) { return h.trim(); });
    return rows.slice(1).filter(function (r) { return r.join('').trim() !== ''; }).map(function (r) {
      var o = {};
      head.forEach(function (h, i) { o[h] = (r[i] || '').trim(); });
      o.tags = (o.tags || '').split(/[|,，;；]/).filter(Boolean);
      o.verified = /^(true|1|yes|是|✓)$/i.test(o.verified || '');
      o.archived = /^(true|1|yes|是|✓)$/i.test(o.archived || '');
      return o;
    });
  }

  function readFile(input, cb, asText) {
    var file = input.files && input.files[0];
    if (!file) return;
    var fr = new FileReader();
    fr.onload = function () { cb(asText ? String(fr.result) : fr.result); input.value = ''; };
    fr.onerror = function () { toast('文件读取失败'); input.value = ''; };
    if (asText) fr.readAsText(file, 'utf-8'); else fr.readAsText(file, 'utf-8');
  }

  /* ---------------- 示例数据 ---------------- */
  var SEED = [
    { name: '示例 · 街头摄影', handle: 'sample_street', followers: 128000, verified: false, platform: 'x', tags: ['摄影', '街头'], bio: '这是示例条目,用来演示卡片与筛选效果,可随时删除。', note: '示例备注:只有本机看得到。' },
    { name: '示例 · 插画师', handle: 'sample_illust', followers: 45200, verified: true, platform: 'x', tags: ['插画', '原创'], bio: '示例条目:演示认证徽标与标签展示。' },
    { name: '示例 · 旅行记录', handle: 'sample_travel', followers: 880000, verified: true, platform: 'bilibili', tags: ['旅行', '视频'], bio: '示例条目:演示头部创作者分类(50万+)。' },
    { name: '示例 · 已归档', handle: 'sample_archived', followers: 9000, verified: false, platform: 'other', tags: ['归档'], bio: '示例条目:演示归档箱。', archived: true }
  ];

  /* ---------------- 路由与渲染 ---------------- */
  function route() {
    var isAdmin = location.hash.replace(/^#\/?/, '').indexOf('admin') === 0;
    $('#view-vault').hidden = isAdmin;
    $('#view-admin').hidden = !isAdmin;
    $$('.nav__link').forEach(function (a) {
      a.classList.toggle('is-active', isAdmin ? a.dataset.nav === 'admin' : a.dataset.nav === 'vault');
    });
    if (isAdmin) renderAdmin();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function renderAll() {
    state.shown = PAGE_SIZE;
    renderStats();
    renderChips();
    renderGrid();
    renderSpotlight();
    if (!$('#view-admin').hidden) renderAdmin();
  }

  /* ---------------- 事件绑定 ---------------- */
  function bind() {
    window.addEventListener('hashchange', route);

    // 主题
    var savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme) document.documentElement.dataset.theme = savedTheme;
    $('#btn-theme').addEventListener('click', function () {
      var cur = document.documentElement.dataset.theme || 'dark';
      var next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      localStorage.setItem(THEME_KEY, next);
    });

    // 搜索 / 排序 / 分类
    var q = $('#q');
    q.addEventListener('input', function () {
      state.q = q.value;
      state.shown = PAGE_SIZE;
      $('#btn-clear-q').hidden = !q.value;
      renderGrid();
    });
    $('#btn-clear-q').addEventListener('click', function () {
      q.value = ''; state.q = ''; this.hidden = true; renderGrid(); q.focus();
    });
    $('#sort').addEventListener('change', function () {
      state.sort = this.value; state.shown = PAGE_SIZE; renderGrid();
    });
    $('#chips').addEventListener('click', function (e) {
      var b = e.target.closest('.chip');
      if (!b) return;
      state.cat = b.dataset.cat;
      state.shown = PAGE_SIZE;
      renderChips(); renderGrid();
    });
    $('#btn-more').addEventListener('click', function () {
      state.shown += PAGE_SIZE; renderGrid();
    });
    $('#btn-reroll').addEventListener('click', renderSpotlight);

    // 卡片 / 行内操作(事件委托)
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-open],[data-edit],[data-del],[data-toggle],[data-copy],[data-close]');
      if (!t) return;

      if (t.hasAttribute('data-close')) {
        if (!$('#editor').hidden) hide('#editor'); else hide('#modal');
        return;
      }
      if (t.dataset.open) { openDetail(t.dataset.open); return; }
      if (t.dataset.edit) { openEditor(t.dataset.edit); return; }
      if (t.dataset.copy) {
        var txt = t.dataset.copy;
        if (navigator.clipboard) navigator.clipboard.writeText(txt).then(function () { toast('已复制'); });
        else toast(txt);
        return;
      }
      if (t.dataset.toggle) {
        var it = items.filter(function (x) { return x.id === t.dataset.toggle; })[0];
        if (it) { it.archived = !it.archived; save(); renderAll(); toast(it.archived ? '已归档' : '已恢复'); }
        return;
      }
      if (t.dataset.del) {
        var target = items.filter(function (x) { return x.id === t.dataset.del; })[0];
        if (target && confirm('确定删除「' + target.name + '」?此操作不可撤销。')) {
          items = items.filter(function (x) { return x.id !== t.dataset.del; });
          save(); renderAll(); toast('已删除');
        }
      }
    });

    // 编辑器
    $('#btn-add').addEventListener('click', function () { openEditor(null); });
    $('#editor-form').addEventListener('submit', submitEditor);
    $('#btn-modal-close').addEventListener('click', function () { hide('#modal'); });
    $('#btn-editor-close').addEventListener('click', function () { hide('#editor'); });

    // 导入导出
    $('#btn-export-json').addEventListener('click', exportJson);
    $('#btn-export-csv').addEventListener('click', exportCsv);
    $('#file-json').addEventListener('change', function () {
      var input = this;
      readFile(input, function (text) {
        try {
          var data = JSON.parse(text);
          var list = Array.isArray(data) ? data : (data.items || []);
          if (!Array.isArray(list)) throw new Error('格式不正确');
          var r = upsertMany(list);
          renderAll();
          toast('导入完成:新增 ' + r.added + '、更新 ' + r.updated);
        } catch (err) {
          toast('JSON 解析失败:' + err.message);
        }
      }, true);
    });
    $('#file-csv').addEventListener('change', function () {
      readFile(this, function (text) {
        var rows = parseCsv(text);
        if (!rows.length) { toast('CSV 没有可用数据行'); return; }
        var r = upsertMany(rows);
        renderAll();
        toast('导入完成:新增 ' + r.added + '、更新 ' + r.updated);
      }, true);
    });
    $('#btn-seed').addEventListener('click', function () {
      var r = upsertMany(SEED);
      renderAll();
      toast('示例数据:新增 ' + r.added + '、更新 ' + r.updated);
    });
    $('#btn-wipe').addEventListener('click', function () {
      if (!items.length) { toast('已经是空库'); return; }
      if (confirm('确定清空全部 ' + items.length + ' 条数据?建议先导出备份。')) {
        items = []; save(); renderAll(); toast('已清空');
      }
    });

    // 空白处关闭
    $$('.modal__backdrop').forEach(function (b) {
      b.addEventListener('click', function () {
        hide('#modal'); hide('#editor');
      });
    });

    // 键盘快捷键
    document.addEventListener('keydown', function (e) {
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if (e.key === 'Escape') { hide('#modal'); hide('#editor'); return; }
      if (typing) return;
      if (e.key === '/') { e.preventDefault(); $('#q').focus(); return; }
      if (e.key === 'r' || e.key === 'R') { renderSpotlight(); return; }
      if (e.key === 't' || e.key === 'T') { $('#btn-theme').click(); }
    });
  }

  /* ---------------- 启动 ---------------- */
  load();
  bind();
  route();
  renderAll();
})();

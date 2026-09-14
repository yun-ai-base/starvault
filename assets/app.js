/* ==========================================================================
   StarVault · X 博主精选画廊
   零依赖 / 无构建。内置数据快照来自 assets/data.js(由 tools/build-data.py 生成),
   本机的增删改只写入 localStorage,不会回传任何服务器。
   ========================================================================== */
(function () {
  'use strict';

  var STORE_KEY = 'starvault.items.v1';
  var SEED_KEY = 'starvault.seedVersion';
  var THEME_KEY = 'starvault.theme';
  var VIEW_KEY = 'starvault.view';
  var PAGE_SIZE = 24;

  var DATA = (window.STARVAULT_DATA && window.STARVAULT_DATA.items) ? window.STARVAULT_DATA : { version: '', items: [] };
  var DATA_VERSION = DATA.version || '';

  var PLATFORMS = {
    x: { label: 'X / Twitter', url: function (h) { return 'https://x.com/' + h; } },
    bilibili: { label: '哔哩哔哩', url: function (h) { return 'https://space.bilibili.com/' + h; } },
    xiaohongshu: { label: '小红书', url: function (h) { return 'https://www.xiaohongshu.com/user/profile/' + h; } },
    youtube: { label: 'YouTube', url: function (h) { return 'https://www.youtube.com/@' + h; } },
    other: { label: '其他', url: function () { return ''; } }
  };

  /* 分类:默认只呈现「在用」(未归档、未进坟场)的博主 */
  var CATEGORIES = [
    { id: 'all', label: '全部', test: function (it) { return !it.archived && !it.suspended; } },
    { id: 'hot', label: '热度排行', sort: 'heat-desc', test: function (it) { return !it.archived && !it.suspended; } },
    { id: 'verified', label: '蓝标认证', test: function (it) { return !it.archived && !it.suspended && it.verified; } },
    { id: 'top', label: 'Top 头部 (50万+)', test: function (it) { return !it.archived && !it.suspended && num(it.followers) >= 500000; } },
    { id: 'known', label: '知名创作者 (10万+)', test: function (it) { return !it.archived && !it.suspended && num(it.followers) >= 100000; } },
    { id: 'recent', label: '最新归档', test: function (it) { return !it.archived && !it.suspended && isRecent(it); } },
    { id: 'vault', label: '赛博坟场', test: function (it) { return !!it.suspended; } },
    { id: 'archived', label: '归档箱', test: function (it) { return !!it.archived; }, optional: true }
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

  /* 4.3M / 328K / 225 */
  function fmtFans(v) {
    var n = num(v);
    if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return n ? String(n) : '—';
  }
  function fmtNum(v) { return num(v).toLocaleString('en-US'); }

  function fmtDate(iso) {
    var t = new Date(iso || 0).getTime();
    if (!t) return '—';
    var d = new Date(t);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  function timeAgo(iso) {
    var t = new Date(iso || 0).getTime();
    if (!t) return '—';
    var d = Math.floor((Date.now() - t) / 1000);
    if (d < 0) return fmtDate(iso);
    if (d < 3600) return Math.max(1, Math.floor(d / 60)) + ' 分钟前';
    if (d < 86400) return Math.floor(d / 3600) + ' 小时前';
    if (d < 2592000) return Math.floor(d / 86400) + ' 天前';
    return fmtDate(iso);
  }

  function tierOf(it) {
    if (it.suspended) return '已失联';
    var f = num(it.followers);
    if (f >= 500000) return 'Top Creator';
    if (f >= 100000) return '知名创作者';
    if (f >= 10000) return '创作者';
    return '';
  }

  /* 数据快照里最新的一批归档时间,用来算「最新归档」 */
  var latestAdded = (function () {
    var m = 0;
    DATA.items.forEach(function (r) { var t = new Date(r.addedAt || 0).getTime(); if (t > m) m = t; });
    return m || Date.now();
  })();
  function isRecent(it) {
    var t = new Date(it.addedAt || 0).getTime();
    return t > 0 && latestAdded - t < 30 * 864e5;
  }

  function letterAvatar(ch) {
    var c = String(ch || '?').trim().charAt(0).toUpperCase() || '?';
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#8b5cf6"/><stop offset="1" stop-color="#ec4899"/>' +
      '</linearGradient></defs><rect width="120" height="120" fill="url(#g)"/>' +
      '<text x="60" y="78" font-size="56" font-family="sans-serif" fill="#fff" text-anchor="middle">' +
      esc(c) + '</text></svg>';
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  function avatarOf(it) {
    if (it.avatar) return it.avatar;
    // 上游备份里的头像多为相对接口路径 (/api/media?...),无法直接热链;
    // 这里按账号去公开头像聚合服务取一次,取不到就由 onerror 回退到首字母头像。
    if (it.platform === 'x' && it.handle) {
      return 'https://unavatar.io/twitter/' + encodeURIComponent(it.handle);
    }
    return letterAvatar(it.name || it.handle);
  }

  // 供 <img onerror> 调用:任何头像加载失败都退化成首字母头像,不再递归触发 onerror。
  window.svAvatarFallback = function (img) {
    img.onerror = null;
    img.src = letterAvatar(img.getAttribute('data-letter') || '?');
  };

  function avatarImg(it, cls, extra) {
    return '<img class="' + cls + '" src="' + esc(avatarOf(it)) + '" alt="" loading="lazy" ' +
      'data-letter="' + esc((it.name || it.handle || '?').trim().charAt(0)) + '" ' +
      'onerror="window.svAvatarFallback(this)"' + (extra || '') + '>';
  }

  /* 封面走图片代理:部分网络(例如中国大陆)直连 pbs.twimg.com 不通,
     先用 wsrv.nl 取一份缩放后的副本,代理失败再退回直链。 */
  function proxied(url, w) {
    return 'https://wsrv.nl/?url=' + encodeURIComponent(url) + '&w=' + (w || 600) + '&output=jpg';
  }

  function coverImg(it) {
    if (!it.cover) return '';
    return '<img src="' + esc(proxied(it.cover, 600)) + '" data-direct="' + esc(it.cover) + '" ' +
      'alt="" loading="lazy" referrerpolicy="no-referrer" onerror="window.svCoverFallback(this)">';
  }

  // 代理挂了就换直链,直链也挂了就把图摘掉(露出渐变底色)。
  window.svCoverFallback = function (img) {
    if (!img.dataset.fallback) {
      img.dataset.fallback = '1';
      img.src = img.getAttribute('data-direct') || '';
      return;
    }
    img.onerror = null;
    img.remove();
  };

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

  function normalize(raw) {
    var handle = String(raw.handle || raw.screen_name || '').trim().replace(/^@/, '');
    var avatar = String(raw.avatar || raw.avatar_url || '').trim();
    var cover = String(raw.cover || raw.cover_url || '').trim();
    var clicks = raw.clicks || {};
    return {
      id: String(raw.id || uid()),
      name: String(raw.name || handle || '未命名').trim().slice(0, 80),
      handle: handle.slice(0, 40),
      followers: num(raw.followers != null ? raw.followers : raw.followers_count),
      verified: !!(raw.verified === true || raw.verified === 1 || raw.verified === '1'),
      archived: !!raw.archived,
      suspended: !!(raw.suspended === true || raw.suspended === 1 || raw.suspended === '1' || raw.is_suspended === 1 || raw.is_suspended === true),
      heat: num(raw.heat != null ? raw.heat : raw.total_clicks),
      clicks: {
        card: num(clicks.card != null ? clicks.card : raw.clicks_card),
        timeline: num(clicks.timeline != null ? clicks.timeline : raw.clicks_timeline),
        roulette: num(clicks.roulette != null ? clicks.roulette : raw.clicks_roulette)
      },
      tags: Array.isArray(raw.tags)
        ? raw.tags.map(function (t) { return String(t).trim(); }).filter(Boolean).slice(0, 12)
        : String(raw.tags || '').split(/[,，;；]/).map(function (t) { return t.trim(); }).filter(Boolean).slice(0, 12),
      bio: String(raw.bio || raw.description || '').slice(0, 400),
      note: String(raw.note || '').slice(0, 400),
      avatar: /^https?:/i.test(avatar) ? avatar.slice(0, 500) : '',
      cover: /^https?:/i.test(cover) ? cover.slice(0, 500) : '',
      profileUrl: String(raw.profileUrl || '').slice(0, 500),
      platform: PLATFORMS[raw.platform] ? raw.platform : 'x',
      addedAt: raw.addedAt || raw.backed_up_at || new Date().toISOString()
    };
  }

  function save() {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(items));
    } catch (e) {
      toast('保存失败:浏览器存储空间可能已满');
    }
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
        it.addedAt = it.addedAt || exist.addedAt;
        Object.keys(it).forEach(function (k) { exist[k] = it[k]; });
        updated++;
      } else {
        items.push(it);
        byHandle[key] = it;
        added++;
      }
    });
    return { added: added, updated: updated };
  }

  function load() {
    var exists = false;
    try {
      var raw = localStorage.getItem(STORE_KEY);
      exists = raw !== null;
      items = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(items)) items = [];
    } catch (e) {
      items = [];
      toast('本地数据读取失败,已按内置快照启动');
    }
    items.forEach(function (it) { if (!it.id) it.id = uid(); });

    if (!items.length && !exists && DATA.items.length) {
      // 首次访问:直接铺上内置快照
      upsertMany(DATA.items);
      localStorage.setItem(SEED_KEY, DATA_VERSION);
      save();
    } else if (DATA.items.length && localStorage.getItem(SEED_KEY) !== DATA_VERSION) {
      // 快照更新:合并进去(同 handle 覆盖,保留本机自建条目)
      var r = upsertMany(DATA.items);
      localStorage.setItem(SEED_KEY, DATA_VERSION);
      save();
      if (r.added || r.updated) toast('已同步内置数据快照 ' + DATA_VERSION + ':新增 ' + r.added + ' / 更新 ' + r.updated);
    }
  }

  /* ---------------- 状态与筛选 ---------------- */
  var state = { q: '', cat: 'all', sort: 'followers-desc', shown: PAGE_SIZE, view: 'grid' };

  function catOf(id) {
    return CATEGORIES.filter(function (c) { return c.id === id; })[0] || CATEGORIES[0];
  }

  function catCount(c) { return items.filter(c.test).length; }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    var cat = catOf(state.cat);
    var list = items.filter(function (it) {
      if (!cat.test(it)) return false;
      if (!q) return true;
      return [it.name, it.handle, it.bio, it.note, (it.tags || []).join(' ')]
        .join(' ').toLowerCase().indexOf(q) >= 0;
    });
    var sorters = {
      'followers-desc': function (a, b) { return num(b.followers) - num(a.followers); },
      'followers-asc': function (a, b) { return num(a.followers) - num(b.followers); },
      'heat-desc': function (a, b) { return num(b.heat) - num(a.heat); },
      'name-asc': function (a, b) { return String(a.name).localeCompare(String(b.name), 'zh-CN'); },
      'added-desc': function (a, b) { return new Date(b.addedAt) - new Date(a.addedAt); },
      'added-asc': function (a, b) { return new Date(a.addedAt) - new Date(b.addedAt); }
    };
    return list.sort(sorters[state.sort] || sorters['followers-desc']);
  }

  /* ---------------- 渲染:画廊 ---------------- */
  function renderStats() {
    var total = items.length;
    var active = items.filter(function (i) { return !i.archived && !i.suspended; }).length;
    var verified = items.filter(function (i) { return i.verified; }).length;
    var vault = items.filter(function (i) { return i.suspended; }).length;
    var sum = items.reduce(function (s, i) { return s + num(i.followers); }, 0);
    var data = [
      { value: fmtNum(total), label: '扫描总数' + (vault ? ' · 在用 ' + active : '') },
      { value: total ? Math.round(verified / total * 100) + '%' : '—', label: '蓝标认证 · ' + fmtNum(verified) + ' 位' },
      { value: fmtFans(sum), label: '覆盖粉丝' }
    ];
    $('#stats').innerHTML = data.map(function (d) {
      return '<div class="stat"><div class="stat__value">' + esc(d.value) +
        '</div><div class="stat__label">' + esc(d.label) + '</div></div>';
    }).join('');
  }

  function renderChips() {
    var html = CATEGORIES.filter(function (c) { return !c.optional || catCount(c) > 0; }).map(function (c) {
      var n = catCount(c);
      return '<button class="chip' + (state.cat === c.id ? ' is-active' : '') + '" data-cat="' + c.id +
        '" type="button">' + esc(c.label) + '<span class="chip__n">' + n + '</span></button>';
    }).join('');
    $('#chips').innerHTML = html;
  }

  function cardHtml(it) {
    var tier = tierOf(it);
    var html = '<button class="card" type="button" data-open="' + esc(it.id) + '">' +
      '<div class="card__cover">' + coverImg(it) +
      (tier ? '<span class="card__tier">' + esc(tier) + '</span>' : '') +
      (it.suspended ? '<span class="flag-vault">赛博坟场</span>' : '') +
      '</div>' +
      avatarImg(it, 'card__avatar') +
      '<div class="card__body">' +
      '<div class="card__name">' + esc(it.name) +
      (it.verified ? '<span class="badge" title="蓝标认证">✓</span>' : '') + '</div>' +
      '<div class="card__handle">@' + esc(it.handle) + ' · <b>' + esc(fmtFans(it.followers)) + '</b> 关注者</div>' +
      '<p class="card__bio">' + esc(it.bio || '暂无简介') + '</p>' +
      '<div class="card__meta">' +
      '<span>' + esc((PLATFORMS[it.platform] || {}).label || '') + '</span>' +
      '<span title="归档时间">' + esc(fmtDate(it.addedAt)) + '</span>' +
      '</div></div></button>';
    return html;
  }

  function renderGrid() {
    var list = filtered();
    var slice = list.slice(0, state.shown);
    var grid = $('#grid');
    grid.className = 'grid' + (state.view === 'list' ? ' is-list' : '');
    grid.innerHTML = slice.map(cardHtml).join('');

    $('#count-line').innerHTML = '共呈现 <strong>' + list.length + '</strong> 位博主归档' +
      (state.q ? '(关键词「' + esc(state.q) + '」)' : '');

    var empty = $('#empty');
    if (!list.length) {
      empty.hidden = false;
      if (!items.length) {
        $('#empty-title').textContent = '画廊还是空的';
        $('#empty-text').textContent = '去控制台手动添加,或导入一份 JSON / CSV 数据。';
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

  function activePool() {
    return items.filter(function (i) { return !i.archived && !i.suspended; });
  }

  function pickSpotlight() {
    var pool = activePool();
    if (!pool.length) return null;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  function renderSpotlight() {
    var body = $('#spotlight-body');
    var it = pickSpotlight();
    if (!it) {
      body.innerHTML = '<p class="muted">还没有条目,先去控制台添加几位创作者吧。</p>';
      return;
    }
    spotlightId = it.id;
    body.innerHTML =
      avatarImg(it, 'spotlight__avatar') +
      '<div style="min-width:0">' +
      '<div class="spotlight__name">' + esc(it.name) +
      (it.verified ? '<span class="badge" title="蓝标认证">✓</span>' : '') +
      '<span class="pill">' + esc(tierOf(it) || 'Creator') + '</span></div>' +
      '<div class="spotlight__meta">@' + esc(it.handle) + ' · ' + esc(fmtFans(it.followers)) + ' 关注者</div>' +
      '<p class="spotlight__bio">' + esc(it.bio || '暂无简介') + '</p>' +
      '<div class="detail__actions" style="margin-top:10px">' +
      '<button class="btn btn--sm" type="button" data-open="' + esc(it.id) + '">查看资料</button>' +
      '<a class="btn btn--ghost btn--sm" href="' + esc(profileUrlOf(it)) + '" target="_blank" rel="noopener noreferrer">前往主页 ↗</a>' +
      '</div></div>';
  }
  var spotlightId = null;

  /* ---------------- 详情弹窗 ---------------- */
  function openDetail(id) {
    var it = items.filter(function (x) { return x.id === id; })[0];
    if (!it) return;
    var url = profileUrlOf(it);
    var tags = (it.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('');
    $('#modal-body').innerHTML =
      '<div class="detail__cover">' + coverImg(it) + '</div>' +
      '<div class="detail">' +
      avatarImg(it, 'detail__avatar') +
      '<div style="flex:1;min-width:0">' +
      '<h3 id="modal-name">' + esc(it.name) +
      (it.verified ? '<span class="badge" title="蓝标认证">✓</span>' : '') +
      (tierOf(it) ? '<span class="pill">' + esc(tierOf(it)) + '</span>' : '') + '</h3>' +
      '<div class="detail__handle">@' + esc(it.handle) + ' · ' + esc((PLATFORMS[it.platform] || {}).label || '') +
      (it.archived ? ' · <span style="color:#f59e0b">已归档</span>' : '') +
      (it.suspended ? ' · <span style="color:#f87171">赛博坟场</span>' : '') + '</div>' +
      '<div class="detail__stats">' +
      '<div class="detail__stat"><small>关注者</small><strong>' + esc(fmtNum(it.followers)) + '</strong></div>' +
      '<div class="detail__stat"><small>卡片点击</small><strong>' + esc(fmtNum(it.clicks.card)) + '</strong></div>' +
      '<div class="detail__stat"><small>时间线点击</small><strong>' + esc(fmtNum(it.clicks.timeline)) + '</strong></div>' +
      '<div class="detail__stat"><small>轮盘点击</small><strong>' + esc(fmtNum(it.clicks.roulette)) + '</strong></div>' +
      '<div class="detail__stat"><small>累计热度</small><strong>' + esc(fmtNum(it.heat)) + '</strong></div>' +
      '</div></div></div>' +
      (it.bio ? '<div class="detail__section"><h4>简介</h4><p style="margin:0;white-space:pre-line">' + esc(it.bio) + '</p></div>' : '') +
      (tags ? '<div class="detail__section"><h4>标签</h4><div class="tags">' + tags + '</div></div>' : '') +
      (it.note ? '<div class="detail__section"><h4>私人备注</h4><div class="note-box">' + esc(it.note) + '</div></div>' : '') +
      '<div class="detail__section"><h4>归档信息</h4>' +
      '<p class="muted" style="margin:0;font-size:13px">备份于 ' + esc(fmtDate(it.addedAt)) +
      ' · 同步于 ' + esc(fmtDate(it.syncedAt || it.addedAt)) + '</p></div>' +
      '<div class="detail__actions">' +
      (url ? '<a class="btn" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">前往主页 ↗</a>' : '') +
      '<button class="btn btn--ghost" type="button" data-edit="' + esc(it.id) + '">编辑</button>' +
      '<button class="btn btn--ghost" type="button" data-copy="' + esc(url || it.handle) + '">复制主页链接</button>' +
      '<button class="btn btn--ghost" type="button" data-copy="' + esc(shareUrl(it)) + '">复制画廊链接</button>' +
      '</div>';
    show('#modal');
  }

  function show(sel) { $(sel).hidden = false; document.body.style.overflow = 'hidden'; }
  function hide(sel) { $(sel).hidden = true; document.body.style.overflow = ''; }

  function shareUrl(it) {
    return location.origin + location.pathname + '#/c/' + encodeURIComponent(it.id);
  }

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
      f.cover.value = it.cover || '';
      f.profileUrl.value = it.profileUrl || '';
      f.tags.value = (it.tags || []).join(', ');
      f.bio.value = it.bio || '';
      f.note.value = it.note || '';
      f.verified.checked = !!it.verified;
      f.archived.checked = !!it.archived;
      f.suspended.checked = !!it.suspended;
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
      cover: f.cover.value,
      profileUrl: f.profileUrl.value,
      tags: f.tags.value,
      bio: f.bio.value,
      note: f.note.value,
      verified: f.verified.checked,
      archived: f.archived.checked,
      suspended: f.suspended.checked
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
      it.clicks = items[idx].clicks;
      it.heat = items[idx].heat;
      it.syncedAt = items[idx].syncedAt;
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

  /* ---------------- 控制台 ---------------- */
  var adminQ = '';

  function renderAdmin() {
    $('#admin-count').textContent = items.length;
    $('#data-version').textContent = DATA_VERSION || '—';
    $('#data-count').textContent = DATA.items.length;
    $('#foot-version').textContent = DATA_VERSION || '—';

    var q = adminQ.trim().toLowerCase();
    var rows = items.filter(function (it) {
      if (!q) return true;
      return (it.name + ' ' + it.handle).toLowerCase().indexOf(q) >= 0;
    }).sort(function (a, b) { return num(b.followers) - num(a.followers); });

    $('#admin-rows').innerHTML = rows.map(function (it) {
      var status = it.archived ? '归档' : (it.suspended ? '赛博坟场' : '在用');
      return '<tr>' +
        '<td>' + avatarImg(it, 'mini-avatar') + esc(it.name) + '</td>' +
        '<td>@' + esc(it.handle) + '</td>' +
        '<td>' + esc(fmtFans(it.followers)) + '</td>' +
        '<td>' + (it.verified ? '✓' : '—') + '</td>' +
        '<td>' + esc(status) + '</td>' +
        '<td><div class="row-actions">' +
        '<button class="btn btn--ghost btn--sm" type="button" data-edit="' + esc(it.id) + '">编辑</button>' +
        '<button class="btn btn--ghost btn--sm" type="button" data-toggle="' + esc(it.id) + '">' +
        (it.archived ? '恢复' : '归档') + '</button>' +
        '<button class="btn btn--danger btn--sm" type="button" data-del="' + esc(it.id) + '">删除</button>' +
        '</div></td></tr>';
    }).join('');
    $('#admin-empty').hidden = rows.length > 0;
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
    download('starvault-' + stamp() + '.json',
      JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), items: items }, null, 2), 'application/json');
    toast('已导出 JSON');
  }

  var CSV_COLS = ['name', 'handle', 'followers', 'verified', 'archived', 'suspended', 'platform', 'tags', 'bio', 'note', 'avatar', 'cover', 'profileUrl', 'addedAt'];

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
        if (c === 'verified' || c === 'archived' || c === 'suspended') v = v ? 'true' : 'false';
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
      o.suspended = /^(true|1|yes|是|✓)$/i.test(o.suspended || '');
      return o;
    });
  }

  function readFile(input, cb) {
    var file = input.files && input.files[0];
    if (!file) return;
    var fr = new FileReader();
    fr.onload = function () { cb(String(fr.result)); input.value = ''; };
    fr.onerror = function () { toast('文件读取失败'); input.value = ''; };
    fr.readAsText(file, 'utf-8');
  }

  /* ---------------- 路由与渲染 ---------------- */
  function route() {
    var isAdmin = location.hash.replace(/^#\/?/, '').indexOf('admin') === 0;
    $('#view-vault').hidden = isAdmin;
    $('#view-admin').hidden = !isAdmin;
    $$('[data-nav]').forEach(function (a) {
      a.classList.toggle('is-active', isAdmin ? a.dataset.nav === 'admin' : a.dataset.nav === 'vault');
    });
    if (isAdmin) renderAdmin();

    // 深链:#/c/<id 或 handle> 直接打开某位博主的详情(方便分享单张卡片)
    var m = location.hash.match(/^#\/c\/(.+)$/);
    if (m) {
      var key = decodeURIComponent(m[1]).toLowerCase();
      var hit = items.filter(function (x) {
        return x.id.toLowerCase() === key || x.handle.toLowerCase() === key;
      })[0];
      if (hit) openDetail(hit.id); else toast('没有找到这个条目');
    } else {
      hide('#modal');
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function closeDetail() {
    hide('#modal');
    if (/^#\/c\//.test(location.hash)) {
      history.replaceState(null, '', location.pathname + location.search);
    }
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
  function setView(v) {
    state.view = v === 'list' ? 'list' : 'grid';
    localStorage.setItem(VIEW_KEY, state.view);
    $('#vt-grid').classList.toggle('is-active', state.view === 'grid');
    $('#vt-list').classList.toggle('is-active', state.view === 'list');
    renderGrid();
  }

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

    // 视图
    var savedView = localStorage.getItem(VIEW_KEY);
    if (savedView) state.view = savedView === 'list' ? 'list' : 'grid';
    $('#vt-grid').classList.toggle('is-active', state.view === 'grid');
    $('#vt-list').classList.toggle('is-active', state.view === 'list');
    $('#vt-grid').addEventListener('click', function () { setView('grid'); });
    $('#vt-list').addEventListener('click', function () { setView('list'); });

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
      var c = catOf(state.cat);
      if (c.sort) { state.sort = c.sort; $('#sort').value = c.sort; }
      renderChips(); renderGrid();
    });
    $('#btn-more').addEventListener('click', function () {
      state.shown += PAGE_SIZE; renderGrid();
    });
    $('#btn-reroll').addEventListener('click', renderSpotlight);
    $('#btn-random').addEventListener('click', function () {
      var it = pickSpotlight();
      if (!it) { toast('还没有可探索的条目'); return; }
      openDetail(it.id);
    });

    // 控制台筛选
    $('#admin-q').addEventListener('input', function () { adminQ = this.value; renderAdmin(); });

    // 卡片 / 行内操作(事件委托)
    document.addEventListener('click', function (e) {
      var t = e.target.closest('[data-open],[data-edit],[data-del],[data-toggle],[data-copy],[data-close]');
      if (!t) return;

      if (t.hasAttribute('data-close')) {
        if (!$('#editor').hidden) hide('#editor'); else closeDetail();
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
    $('#btn-modal-close').addEventListener('click', closeDetail);
    $('#btn-editor-close').addEventListener('click', function () { hide('#editor'); });

    // 导入导出
    $('#btn-export-json').addEventListener('click', exportJson);
    $('#btn-export-csv').addEventListener('click', exportCsv);
    $('#file-json').addEventListener('change', function () {
      readFile(this, function (text) {
        try {
          var data = JSON.parse(text);
          var list = Array.isArray(data) ? data : (data.items || []);
          if (!Array.isArray(list)) throw new Error('格式不正确');
          var r = upsertMany(list);
          save(); renderAll();
          toast('导入完成:新增 ' + r.added + '、更新 ' + r.updated);
        } catch (err) {
          toast('JSON 解析失败:' + err.message);
        }
      });
    });
    $('#file-csv').addEventListener('change', function () {
      readFile(this, function (text) {
        var rows = parseCsv(text);
        if (!rows.length) { toast('CSV 没有可用数据行'); return; }
        var r = upsertMany(rows);
        save(); renderAll();
        toast('导入完成:新增 ' + r.added + '、更新 ' + r.updated);
      });
    });
    $('#btn-reseed').addEventListener('click', function () {
      if (!DATA.items.length) { toast('没有内置数据'); return; }
      if (!confirm('重置为内置数据快照 ' + DATA_VERSION + '?\n同 handle 的条目会被覆盖,你新增的条目会保留。')) return;
      var r = upsertMany(DATA.items);
      localStorage.setItem(SEED_KEY, DATA_VERSION);
      save(); renderAll();
      toast('已重置:新增 ' + r.added + ' / 更新 ' + r.updated);
    });
    $('#btn-wipe').addEventListener('click', function () {
      if (!items.length) { toast('已经是空库'); return; }
      if (confirm('确定清空全部 ' + items.length + ' 条数据?\n之后可以用「重置为内置数据」把内置快照装回来。')) {
        items = []; save();
        localStorage.setItem(SEED_KEY, DATA_VERSION);
        renderAll(); toast('已清空');
      }
    });

    // 空白处关闭
    $$('.modal__backdrop').forEach(function (b) {
      b.addEventListener('click', function () {
        closeDetail(); hide('#editor');
      });
    });

    // 键盘快捷键
    document.addEventListener('keydown', function (e) {
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      if (e.key === 'Escape') { closeDetail(); hide('#editor'); return; }
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

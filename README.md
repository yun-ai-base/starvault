# StarVault · X 博主精选画廊

**在线访问**:https://yun-ai-base.github.io/starvault/

一个**策展式**的 X (Twitter) 创作者画廊:内置一份去重备份快照,打开就能浏览、筛选、随机探索;
本机的任何增删改只写进浏览器 `localStorage`,不会回传服务器。

> 这是一个**原创实现**(自己的代码与设计),站点不抓取第三方数据、不托管任何媒体文件。
> 页面里的头像与封面都是**外链引用**(见下文「图片加载」),仓库里不存放任何图片。

---

## 当前数据快照

| 指标 | 数值 |
|---|---|
| 扫描总数 | **463** |
| 在用(未失联) | **447** |
| 蓝标认证 | 在用中 **144** / 含已失联共 **146**(32%) |
| 覆盖粉丝合计 | **83,958,534** |
| 赛博坟场(账号已失联) | **16** |
| 快照版本 | `2026-09-11`(取备份记录里最新的归档日期) |

来源:本地上游导出的一份 JSON 备份,经 `tools/build-data.py` 转换后内嵌为 `assets/data.js`。

---

## 功能

| 模块 | 说明 |
|---|---|
| 顶栏 | 品牌标 + 圆角搜索框(带 `/` 快捷键提示)、随机探索、主题切换、控制台入口 |
| 首屏 | 玻璃卡片式 Hero:渐变标题、三格图标统计(归档总数 / 蓝标认证 / 最高粉丝)、今日精选 Spotlight |
| 精选画廊 | 大卡片:封面 + 带蓝标角标的头像、昵称 + 等级徽章、`@handle · 粉丝 关注者`、完整简介(链接可点、`位置:` 带定位标记)、底部「时光档案 / 访问 X」操作条 |
| 排布 | 卡片保持内容自然高度,再用「最矮一列优先」打包成 1~3 列 —— 顺序仍是横向 1-2-3,但列内不留大片空白 |
| 分类筛选 | 全部 / 热度排行 / 蓝标认证 / Top 头部(50万+) / 知名创作者(10万+) / 最新归档 / 赛博坟场 / 归档箱 |
| 搜索 | 昵称 / 账号 / 简介 / 备注 / 标签 全文匹配(`/` 键聚焦) |
| 排序 | 粉丝数高低、热度(点击)高低、名称 A→Z、归档时间正倒序 |
| 视图 | 大卡片 / 紧凑列表一键切换(选择会被记住) |
| 今日精选 | Spotlight 卡片随机推荐一位,`R` 键或「换一位推荐」换人 |
| 随机探索 | 顶栏骰子按钮,直接弹出随机一位的详情 |
| 详情弹窗 | 封面、头像、关注者、三类点击与累计热度、简介、归档时间;支持 **深链分享**(`#/c/<id>`) |
| 控制台(仅本地版) | 新增、编辑、删除、归档/恢复、重置为内置快照、清空全部 |
| 导入导出(仅本地版) | JSON / CSV 双向;导入按 `handle` 去重(已存在则更新) |
| 主题 | 深色 / 浅色切换(`T` 键),选择会被记住 |

**快捷键**:`/` 搜索 · `R` 换一位精选 · `T` 切主题 · `Esc` 关闭弹窗

---

## 本地版 / 公开版

**公开站是只读画廊,没有任何控制台。** 本地 `index.html` 才是带控制台的完整版。

```powershell
# 本地:直接打开就有控制台(能新增/编辑/删除/归档/导入导出)
start index.html

# 公开版:剥掉控制台区块后输出
python tools/build-public.py index.html dist\index.html
```

带标记 `<!-- admin:start -->` … `<!-- admin:end -->` 的一共有四处:顶栏「控制台」入口、
空态里的入口按钮、`#view-admin` 整个视图、`#editor` 编辑弹窗。发布脚本
(`_deploy/publish.ps1`) 上传 `index.html` 之前会先跑一遍 `tools/build-public.py`,
所以线上不会残留任何控制台痕迹。

运行时也不需要开关文件:`assets/app.js` 直接看 `#view-admin` 在不在 DOM 里
(`var ADMIN = !!document.getElementById('view-admin')`),不在就自动进入只读模式 ——
隐藏控制台入口、忽略 `#/admin`、详情弹窗里也不显示「编辑」。

### 为什么不用「前端口令锁」

- **锁不住**:纯静态的 GitHub Pages 没有服务端,口令校验逻辑就在公开的 JS 里,
  改个变量或用 devtools 就能绕过,属于自我安慰。
- **也没什么可锁的**:控制台改的是**访客自己浏览器**的 `localStorage["starvault.items.v1"]`,
  只影响他自己看到的那一份;线上内容 = 仓库里的 `assets/data.js`,只有 push 才会变。
  而且这个文件本身就是公开可下载的。
- 真要「只有我能进」,得换有服务端的方案(Cloudflare Access / Netlify Identity /
  自建函数做 GitHub OAuth),纯 Pages 做不到。

> ⚠️ 注意:控制台里的增删改**不会**同步到线上。要改线上数据,得改完导出、
> 用 `tools/build-data.py` 重新生成 `data.js` 再发布。

---

## 快速开始

零依赖、无构建步骤,三种任选:

```powershell
# 1) 直接双击打开
start index.html

# 2) 起一个本地静态服务(推荐,行为与线上一致)
python -m http.server 8080
#   然后访问 http://127.0.0.1:8080

# 3) 用 Node 起服务
npx serve .
```

---

## 更新数据

```powershell
# 把上游导出的备份 (JSON 数组) 转成站点内嵌数据
python tools/build-data.py path\to\backup.json assets\data.js
```

脚本会做三件事:字段映射、按 `handle` 去重(粉丝数最高者胜)、按粉丝数倒序输出,
并把最新的 `backed_up_at` 日期作为快照 `version`。

页面启动时的合并策略:

- **首次访问**(本机没有数据):直接铺上内置快照;
- **快照版本变了**:把新快照按 `handle` 合并进本机数据(覆盖同账号条目,保留你自建的条目),
  并在右下角提示「已同步内置数据快照 …」;
- 控制台里的「重置为内置数据」可以随时手动重来一次。

> ⚠️ 本机的增删改只存在当前浏览器。换设备、清缓存、换浏览器都会回到内置快照,请定期「导出 JSON」备份。

---

## 图片加载

仓库里**不放图片**,头像和封面都是外链:

| 资源 | 来源 | 说明 |
|---|---|---|
| 封面 | `wsrv.nl` 图片代理 → 回退 `pbs.twimg.com` 直链 | 上游给的封面是 `pbs.twimg.com/profile_banners/...`。部分地区(如中国大陆)直连该域名不通,所以默认走 `wsrv.nl` 代理取一份缩放副本,代理失败自动退回直链,再失败就露出渐变底色 |
| 头像 | `unavatar.io/twitter/<handle>` | 上游备份里的头像多为相对接口路径(`/api/media?key=avatars%2F...`),脱离原服务就没法用;这里按账号去公开聚合服务取一次,取不到(404)则回退成**首字母渐变头像** |
| 少数自带绝对地址的头像 | 原地址直链 | 备份里少数条目本身就是完整 URL,直接使用 |

如果你有自己可控的图床,把 `assets/app.js` 里的 `avatarOf()` / `proxied()` 换成你的地址即可。

---

## 部署

站点是纯静态的,GitHub Pages 从 `main` 分支根目录直接发布(`build_type: legacy`):

```powershell
git add -A
git commit -m "chore: 更新画廊数据与版式"
git push origin main
```

推送后 GitHub Pages 会自动重建,通常 30~60 秒生效。

> Pages 站点是**公网可访问**的。若要私有访问,README 早前记录过的方案:改用
> **Cloudflare Pages + Access**(支持私有仓库 + 邮箱验证码)。
> 页面本身已设 `noindex, nofollow`,避免被搜索引擎收录。

---

## 目录结构

```
starvault/
├─ index.html            # 本地版外壳(画廊 + 控制台两个视图)
├─ assets/
│  ├─ styles.css         # 全部样式(含深/浅色主题变量)
│  ├─ app.js             # 数据层 + 渲染 + 控制台 + 导入导出
│  └─ data.js            # 内置数据快照(由 tools/build-data.py 生成,勿手工编辑)
├─ tools/
│  ├─ build-data.py      # 上游备份 → assets/data.js
│  └─ build-public.py    # 本地版 index.html → 公开版(剥掉控制台区块)
└─ README.md
```

无依赖、无构建、无后端:任何静态托管都能跑。

---

## 存储格式

存储位置:`localStorage["starvault.items.v1"]`(仅本机,不上传),
快照版本记在 `localStorage["starvault.seedVersion"]`。

单条记录字段:

| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | string | 条目 ID(内置快照用上游的 Twitter 数字 ID) |
| `name` | string | 昵称(必填) |
| `handle` | string | 账号,不带 `@`(必填,导入时作为去重键) |
| `followers` | number | 粉丝数 |
| `verified` | boolean | 蓝标认证 |
| `archived` | boolean | 归档(移出主列表) |
| `suspended` | boolean | 赛博坟场(账号已失联) |
| `heat` / `clicks` | number / object | 累计热度与卡片 / 时间线 / 轮盘三类点击 |
| `platform` | enum | `x` / `bilibili` / `xiaohongshu` / `youtube` / `other` |
| `tags` | string[] | 标签 |
| `bio` | string | 简介 |
| `note` | string | 私人备注(只有本机可见) |
| `avatar` / `cover` | string | 头像 / 封面图片 URL,留空则自动获取或生成首字母头像 |
| `profileUrl` | string | 主页链接,留空则按平台自动拼 |
| `addedAt` | ISO string | 归档(备份)时间 |

**CSV 列顺序**:`name,handle,followers,verified,archived,suspended,platform,tags,bio,note,avatar,cover,profileUrl,addedAt`

**JSON 导入**支持两种形态:裸数组 `[ {...} ]`,或 `{ "items": [ {...} ] }`;
也兼容上游备份的原始字段名(`screen_name` / `followers_count` / `description` / `avatar_url` / `backed_up_at` …)。

---

## 设计边界(有意为之)

- **公开站只读**:没有控制台、没有编辑/删除入口,访客只能浏览、搜索、筛选、排序。
- **不抓取**:站点自身不跑爬虫、不调第三方 API,数据来自本地上游备份的导入。
- **不托管媒体**:只保存文本字段与图片 URL,仓库里没有任何图片/视频文件。
- `noindex` + `robots` 已设置,避免被搜索引擎收录。

请自行确保你录入的内容与使用方式符合当地法律及各平台的服务条款。

# StarVault · 创作者收藏馆

**在线访问**:https://yun-ai-base.github.io/starvault/

一个**本地优先**的创作者收藏与索引工具:自己录入、自己拥有、数据不出本机。

> 这是一个**原创实现**(自己的代码与设计),不会抓取任何第三方数据,也不托管任何媒体文件。
> 站点内的资料全部由你自己手动录入或导入,仅保存在你浏览器的 `localStorage` 里。

---

## 功能

| 模块 | 说明 |
|---|---|
| 收藏画廊 | 卡片网格、头像、认证徽标、标签、粉丝数、收录时间 |
| 搜索 | 昵称 / 账号 / 简介 / 备注 / 标签 全文匹配(`/` 键聚焦) |
| 分类筛选 | 全部、认证、头部 50万+、知名 10万+、最近收录、已打标签、归档箱 |
| 排序 | 粉丝数高低、名称 A→Z、收录时间正倒序 |
| 今日精选 | 随机推荐一位,`R` 键换一位 |
| 详情弹窗 | 完整资料 + 私人备注 + 跳转主页 / 复制链接 |
| 管理台 | 新增、编辑、删除、归档/恢复 |
| 导入导出 | JSON / CSV 双向;导入按 `handle` 去重(已存在则更新) |
| 主题 | 深色 / 浅色切换(`T` 键),选择会被记住 |
| 分页 | 每页 24 条,「加载更多」渐进展示 |

**快捷键**:`/` 搜索 · `R` 换一位精选 · `T` 切主题 · `Esc` 关闭弹窗

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

首次使用建议进「管理台」→「载入示例数据」看效果,再「清空全部」开始录自己的。

---

## 数据格式

存储位置:`localStorage["starvault.items.v1"]`(仅本机,不上传)。

单条记录字段:

| 字段 | 类型 | 说明 |
|---|---|---|
| `name` | string | 昵称(必填) |
| `handle` | string | 账号,不带 `@`(必填,导入时作为去重键) |
| `followers` | number | 粉丝数 |
| `verified` | boolean | 是否认证 |
| `archived` | boolean | 是否归档(移出主列表) |
| `platform` | enum | `x` / `bilibili` / `xiaohongshu` / `youtube` / `other` |
| `tags` | string[] | 标签 |
| `bio` | string | 简介 |
| `note` | string | 私人备注(只有本机可见) |
| `avatar` | string | 头像图片 URL,留空则自动生成首字母头像 |
| `profileUrl` | string | 主页链接,留空则按平台自动拼 |
| `addedAt` | ISO string | 收录时间 |

**CSV 列顺序**:`name,handle,followers,verified,archived,platform,tags,bio,note,avatar,profileUrl,addedAt`
(多个标签用 `|` 或逗号分隔;布尔值写 `true`/`false`)

**JSON 导入**支持两种形态:裸数组 `[ {...} ]`,或 `{ "items": [ {...} ] }`。

> ⚠️ 数据只存在当前浏览器。换设备、清缓存、换浏览器都会丢,请定期「导出 JSON」备份。

---

## 部署 / 私有化

### 方案 A:私有仓库 + 本地打开(最简单)
仓库设为 **private**,数据本来就在浏览器里,不需要公网托管。clone 下来双击 `index.html` 即可。

### 方案 B:GitHub Pages
- 免费账号:**只能从公开仓库发布** Pages(站点公网可访问)。
- 从**私有仓库**发布 Pages,需要 GitHub Pro / Team / Enterprise。
- Pages 站点的「私有访问控制」只有 **GitHub Enterprise Cloud** 才支持。
- 也就是说:**仓库可以私有,但 Pages 出来的站点做不到私有**(除非上企业版)。

### 方案 C:Cloudflare Pages + Access(真正私有,推荐)
1. Cloudflare Pages 连接你的私有 GitHub 仓库(**支持私有仓库**);
2. Build command 留空,Build output directory 填 `/`(纯静态,无构建);
3. 在 Cloudflare Access 里加一条策略,只允许你的邮箱访问。
   → 这样网址虽然公开,但**必须登录你的邮箱验证码才能看到内容**,达到"私密"效果。

---

## 目录结构

```
starvault/
├─ index.html          # 单页外壳(收藏馆 + 管理台两个视图)
├─ assets/
│  ├─ styles.css       # 全部样式(含深/浅色主题变量)
│  └─ app.js           # 数据层 + 渲染 + 管理台 + 导入导出
└─ README.md
```

无依赖、无构建、无后端:任何静态托管都能跑。

---

## 设计边界(有意为之)

- **不抓取**:没有爬虫、没有第三方 API 调用,所有数据来自你手动录入或导入。
- **不托管媒体**:只保存文本字段与头像 URL,不存储任何图片/视频文件。
- **不联网**:前端零网络请求(`localStorage` 之外没有任何出站请求)。
- `noindex` + `robots` 已设置,避免被搜索引擎收录。

请自行确保你录入的内容与使用方式符合当地法律及各平台的服务条款。

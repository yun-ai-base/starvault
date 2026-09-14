#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把上游 X 博主备份 (JSON 数组) 转换成站点内嵌数据 assets/data.js。

用法:
    python tools/build-data.py <input.json|input.md> [assets/data.js]

输入格式:上游导出的一个 JSON 数组,单条记录字段见 README。
输出格式:window.STARVAULT_DATA = { version, generatedAt, items: [...] }
"""
import json
import sys
import os
import datetime

OUT_DEFAULT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "assets", "data.js")

# 站点内部字段 <- 上游字段
def convert(r):
    avatar = (r.get("avatar_url") or "").strip()
    cover = (r.get("cover_url") or "").strip()
    return {
        "id": str(r.get("id") or r.get("screen_name") or ""),
        "name": (r.get("name") or "").strip() or (r.get("screen_name") or ""),
        "handle": (r.get("screen_name") or "").strip(),
        "followers": int(r.get("followers_count") or 0),
        "verified": bool(r.get("verified")),
        "bio": (r.get("description") or "").strip(),
        # 只有绝对地址能直接在浏览器里用;相对路径 (/api/media?...) 留空,前端回退到字母头像
        "avatar": avatar if avatar.startswith("http") else "",
        "cover": cover if cover.startswith("http") else "",
        "heat": int(r.get("total_clicks") or 0),
        "clicks": {
            "card": int(r.get("clicks_card") or 0),
            "timeline": int(r.get("clicks_timeline") or 0),
            "roulette": int(r.get("clicks_roulette") or 0),
        },
        "suspended": bool(r.get("is_suspended")),
        "addedAt": r.get("backed_up_at") or "",
        "syncedAt": r.get("last_synced_at") or "",
    }


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    src = sys.argv[1]
    dst = sys.argv[2] if len(sys.argv) > 2 else OUT_DEFAULT

    with open(src, "r", encoding="utf-8") as f:
        raw = json.load(f)
    if isinstance(raw, dict):
        raw = raw.get("items") or raw.get("data") or []
    if not isinstance(raw, list):
        raise SystemExit("输入必须是 JSON 数组")

    items = [convert(r) for r in raw if (r.get("screen_name") or "").strip()]
    # 去重:同一个 handle 只保留粉丝数最高的那条
    best = {}
    for it in items:
        k = it["handle"].lower()
        if k not in best or it["followers"] > best[k]["followers"]:
            best[k] = it
    items = sorted(best.values(), key=lambda x: -x["followers"])

    dates = [i["addedAt"] for i in items if i["addedAt"]]
    version = (max(dates)[:10] if dates else datetime.date.today().isoformat())

    payload = {
        "version": version,
        "generatedAt": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "source": os.path.basename(src),
        "items": items,
    }

    os.makedirs(os.path.dirname(dst), exist_ok=True)
    body = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    with open(dst, "w", encoding="utf-8", newline="\n") as f:
        f.write("/* 由 tools/build-data.py 生成,请勿手工编辑。\n"
                "   数据来源:本地上游备份 %s · 共 %d 条 */\n" % (os.path.basename(src), len(items)))
        f.write("window.STARVAULT_DATA = ")
        f.write(body)
        f.write(";\n")

    active = [i for i in items if not i["suspended"]]
    print("写入 %s" % dst)
    print("  总记录 %d · 在用 %d · 坟场 %d · 认证 %d · 粉丝合计 %d"
          % (len(items), len(active), len(items) - len(active),
             sum(1 for i in items if i["verified"]),
             sum(i["followers"] for i in items)))
    print("  文件大小 %.1f KB" % (os.path.getsize(dst) / 1024.0))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把本地版 index.html 转成公开版:剥掉 <!-- admin:start --> … <!-- admin:end --> 之间的内容。

本地 index.html 带控制台(管理/导入导出/编辑弹窗),公开站只保留只读画廊。
带标记的区块有三处:顶栏「控制台」入口、#view-admin 视图、#editor 编辑弹窗。

用法:
    python tools/build-public.py                  # 打印公开版 HTML 到 stdout
    python tools/build-public.py index.html out.html   # 写入文件
"""
import re
import sys

BLOCK = re.compile(r'[ \t]*<!--\s*admin:start\b.*?<!--\s*admin:end\s*-->[ \t]*\r?\n?', re.S)


def strip_admin(html):
    return BLOCK.sub('', html)


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else 'index.html'
    dst = sys.argv[2] if len(sys.argv) > 2 else None

    with open(src, 'r', encoding='utf-8') as f:
        html = f.read()

    out = strip_admin(html)
    hits = len(BLOCK.findall(html))
    if hits == 0:
        print('警告: %s 里没找到 admin 标记,输出与输入一致' % src, file=sys.stderr)

    if dst:
        with open(dst, 'w', encoding='utf-8', newline='\n') as f:
            f.write(out)
        print('公开版 %s:剥掉 %d 个控制台区块,%d -> %d 字节' %
              (dst, hits, len(html.encode('utf-8')), len(out.encode('utf-8'))))
    else:
        sys.stdout.write(out)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())

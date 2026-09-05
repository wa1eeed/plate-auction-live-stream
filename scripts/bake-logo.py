#!/usr/bin/env python3
"""
يجهّز شعارًا **ملوّنًا** ليُرسم على اللوحة: خلفيةً شفّافة، ومقصوصًا على حدّ الرسم.

هذا أخو `bake-emblem.py` لا نسخةٌ منه. ذاك يخبز النخلة والسيفين: رسمٌ أحاديّ
اللون تُشتقّ شفافيّته من الإضاءة ثمّ يُصبغ صبغًا. وهذه الشعارات مرسومةٌ بألوانها
— رؤية ٢٠٣٠ ومدائن صالح والدرعية — فلو اشتُقّت ألفاها من الإضاءة لذاب الأصفر
مع البياض وبقي الأزرق وحده، ولخرجت ظلًّا لا شعارًا.

فالبياض هنا يُنتزع بموضعه لا بلونه:
  · ملءٌ فيضيّ من الحافة عبر ما هو باهتٌ عديم الإشباع — فيسقط البياض المحيط
    والشريط الرماديّ الذي خلّفه القصّ، ويبقى بياض الداخل المحصور كما هو
  · وحافّةٌ ناعمة: بكسلات التماسّ تأخذ تغطيتها من بُعدها عن البياض ثمّ يُرفع
    عنها ما خالطها منه، فلا تبقى هالةٌ شاحبة حول الرسم
  · وقصٌّ على حدود الرسم، وتصغيرٌ بمتوسّطٍ مضروبٍ في الألفا فلا تنزف الحوافّ

وما كان أصله شفّافًا (رؤية ٢٠٣٠) لا يُمسّ لونه: يُقصّ ويُصغَّر فحسب.

  python3 scripts/bake-logo.py <المصدر.png> <الوجهة.png> [--max 512]
"""

import pathlib
import struct
import sys
import zlib


def read_png(path):
    data = pathlib.Path(path).read_bytes()
    pos, idat, w, h, ct = 8, b'', 0, 0, 0
    while pos < len(data):
        ln = struct.unpack('>I', data[pos:pos + 4])[0]
        typ = data[pos + 4:pos + 8]
        chunk = data[pos + 8:pos + 8 + ln]
        if typ == b'IHDR':
            w, h, depth, ct = struct.unpack('>IIBB', chunk[:10])
            if depth != 8:
                raise SystemExit('يُدعم عمق ٨ بتّات فقط')
        elif typ == b'IDAT':
            idat += chunk
        pos += 12 + ln
    ch = {0: 1, 2: 3, 4: 2, 6: 4}.get(ct)
    if ch is None:
        raise SystemExit(f'نوع لون غير مدعوم: {ct}')
    raw = zlib.decompress(idat)
    stride, rows, prev, i = w * ch, [], bytearray(w * ch), 0
    for _ in range(h):
        f = raw[i]
        i += 1
        line = bytearray(raw[i:i + stride])
        i += stride
        for x in range(stride):
            a = line[x - ch] if x >= ch else 0
            b = prev[x]
            c = prev[x - ch] if x >= ch else 0
            if f == 1:
                line[x] = (line[x] + a) & 255
            elif f == 2:
                line[x] = (line[x] + b) & 255
            elif f == 3:
                line[x] = (line[x] + (a + b) // 2) & 255
            elif f == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                line[x] = (line[x] + (a if (pa <= pb and pa <= pc) else (b if pb <= pc else c))) & 255
        rows.append(bytes(line))
        prev = line
    return w, h, ch, rows


def write_png(path, w, h, rgba_rows):
    raw = b''.join(b'\x00' + bytes(row) for row in rgba_rows)

    def chunk(t, d):
        c = t + d
        return struct.pack('>I', len(d)) + c + struct.pack('>I', zlib.crc32(c) & 0xFFFFFFFF)

    pathlib.Path(path).write_bytes(
        b'\x89PNG\r\n\x1a\n'
        + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
        + chunk(b'IDAT', zlib.compress(raw, 9))
        + chunk(b'IEND', b'')
    )


def to_rgba(w, h, ch, rows):
    """يوحّد أي نوع لون في مصفوفة RGBA من رباعيّات."""
    out = []
    for y in range(h):
        row, src = [], rows[y]
        for x in range(w):
            o = x * ch
            if ch == 1:
                g = src[o]
                row.append([g, g, g, 255])
            elif ch == 2:
                g = src[o]
                row.append([g, g, g, src[o + 1]])
            elif ch == 3:
                row.append([src[o], src[o + 1], src[o + 2], 255])
            else:
                row.append([src[o], src[o + 1], src[o + 2], src[o + 3]])
        out.append(row)
    return out


# عتبات الخلفية: باهتٌ عديم الإشباع = خلفية، ما دام متّصلًا بالحافّة
FLAT, BRIGHT = 22, 150
# مدى الحافّة الناعمة: بُعدٌ عن البياض دونه شفافٌ تمامًا وفوقه معتمٌ تمامًا
EDGE_LO, EDGE_HI = 8, 72


def strip_background(w, h, px):
    """يُسقط البياض المتّصل بالحافّة، ويُنعّم التماسّ، ويرفع البياض المخالط."""
    def backgroundish(p):
        r, g, b = p[0], p[1], p[2]
        return max(r, g, b) - min(r, g, b) <= FLAT and (r + g + b) / 3 >= BRIGHT

    bg = [[False] * w for _ in range(h)]
    stack = [(x, y) for x in range(w) for y in (0, h - 1)]
    stack += [(x, y) for y in range(h) for x in (0, w - 1)]
    stack = [(x, y) for (x, y) in stack if backgroundish(px[y][x])]
    for x, y in stack:
        bg[y][x] = True
    while stack:
        x, y = stack.pop()
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h and not bg[ny][nx] and backgroundish(px[ny][nx]):
                bg[ny][nx] = True
                stack.append((nx, ny))

    for y in range(h):
        for x in range(w):
            p = px[y][x]
            if bg[y][x]:
                p[3] = 0
                continue
            touches = any(
                bg[y + dy][x + dx]
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))
                if 0 <= x + dx < w and 0 <= y + dy < h
            )
            if not touches:
                continue
            # التغطية من بُعد البكسل عن البياض
            dev = max(255 - p[0], 255 - p[1], 255 - p[2])
            a = (dev - EDGE_LO) / (EDGE_HI - EDGE_LO)
            a = 0.0 if a <= 0 else (1.0 if a >= 1 else a)
            if a <= 0:
                p[3] = 0
                continue
            # رفع البياض المخالط: اللون الحقيقي قبل مزجه بالخلفية
            for k in range(3):
                v = (p[k] - (1 - a) * 255) / a
                p[k] = 0 if v < 0 else (255 if v > 255 else int(round(v)))
            p[3] = int(round(a * 255))


def crop_to_ink(w, h, px):
    xs = [x for x in range(w) if any(px[y][x][3] for y in range(h))]
    ys = [y for y in range(h) if any(px[y][x][3] for x in range(w))]
    if not xs or not ys:
        raise SystemExit('لا رسم في الصورة بعد إسقاط الخلفية')
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    return (x1 - x0 + 1, y1 - y0 + 1, [row[x0:x1 + 1] for row in px[y0:y1 + 1]])


def downscale(w, h, px, limit):
    """تصغيرٌ بمتوسّط مساحيّ مضروبٍ في الألفا — وإلّا نزف البياض إلى الحوافّ."""
    if max(w, h) <= limit:
        return w, h, px
    scale = limit / max(w, h)
    nw, nh = max(1, round(w * scale)), max(1, round(h * scale))
    out = []
    for ny in range(nh):
        y0, y1 = int(ny * h / nh), max(int(ny * h / nh) + 1, int((ny + 1) * h / nh))
        row = []
        for nx in range(nw):
            x0, x1 = int(nx * w / nw), max(int(nx * w / nw) + 1, int((nx + 1) * w / nw))
            sr = sg = sb = sa = 0.0
            n = 0
            for y in range(y0, min(y1, h)):
                for x in range(x0, min(x1, w)):
                    p = px[y][x]
                    a = p[3] / 255
                    sr += p[0] * a
                    sg += p[1] * a
                    sb += p[2] * a
                    sa += a
                    n += 1
            if sa <= 0:
                row.append([0, 0, 0, 0])
            else:
                row.append([
                    min(255, round(sr / sa)),
                    min(255, round(sg / sa)),
                    min(255, round(sb / sa)),
                    min(255, round(sa / n * 255)),
                ])
        out.append(row)
    return nw, nh, out


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    limit = 512
    for a in sys.argv[1:]:
        if a.startswith('--max='):
            limit = int(a.split('=', 1)[1])
    if len(args) != 2:
        raise SystemExit(__doc__)
    src, dst = args

    w, h, ch, rows = read_png(src)
    px = to_rgba(w, h, ch, rows)
    already_transparent = ch in (2, 4) and any(px[y][x][3] < 250 for y in range(h) for x in range(w))
    if already_transparent:
        print(f'{src}: شفّافٌ أصلًا — يُقصّ ويُصغَّر بلا مساس باللون')
    else:
        strip_background(w, h, px)
        print(f'{src}: أُسقطت الخلفية البيضاء المتّصلة بالحافّة')

    cw, chh, px = crop_to_ink(w, h, px)
    print(f'  الرسم: {cw}x{chh} — من أصل {w}x{h}')
    cw, chh, px = downscale(cw, chh, px, limit)
    write_png(dst, cw, chh, [bytes(v for p in row for v in p) for row in px])
    print(f'  كُتب {dst} بمقاس {cw}x{chh} ونسبة {cw / chh:.6f}')


main()

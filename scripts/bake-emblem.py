#!/usr/bin/env python3
"""
يخبز شفافية النخلة والسيفين في ملفّ الصورة نفسه.

الأصل `palm.jpeg` رسمٌ أسود على **أبيض** بلا شفافية، وكان بياضه يُنتزع في
المتصفّح: قناعًا يُعكَس بـ`filter: invert(1)` أوّلًا، ثمّ مرشِّح `feColorMatrix`.
والحيلتان تعملان في Chromium وتسقطان في WebKit بعيبين متعاقبين — مربّعٌ أسود
خلف الشعار ثمّ إطارٌ أبيض حوله، في كل لوحة على iOS وبلا خطأ في أي سجلّ.

فالانتزاع يقع هنا مرّة واحدة بدل أن يقع في كل جهاز:
  · الألفا من الإضاءة، بعتبةٍ تُذيب الهالة الرمادية التي يخلّفها ضغط JPEG
  · وقصٌّ على حدود الرسم فلا تبقى حوله مساحة أصلًا
  · ونسخةٌ لكل لون، فيُستغنى عن التلوين في العرض

  python3 scripts/bake-emblem.py <صورة.png>     # PNG لأنّ فكّ JPEG خارج المعيار
  # على macOS:  sips -s format png public/plate-emblems/palm.jpeg --out /tmp/palm.png
"""

import pathlib
import struct
import sys
import zlib


def read_png(path):
    data = pathlib.Path(path).read_bytes()
    pos, idat, w, h, ct = 8, b'', 0, 0, 0
    while pos < len(data):
        ln = struct.unpack('>I', data[pos:pos+4])[0]; typ = data[pos+4:pos+8]
        chunk = data[pos+8:pos+8+ln]
        if typ == b'IHDR': w, h, _, ct = struct.unpack('>IIBB', chunk[:10])
        elif typ == b'IDAT': idat += chunk
        pos += 12 + ln
    raw = zlib.decompress(idat); ch = {0:1, 2:3, 4:2, 6:4}[ct]
    stride, rows, prev, i = w*ch, [], bytearray(w*ch), 0
    for _ in range(h):
        f = raw[i]; i += 1
        line = bytearray(raw[i:i+stride]); i += stride
        for x in range(stride):
            a = line[x-ch] if x >= ch else 0
            b = prev[x]; c = prev[x-ch] if x >= ch else 0
            if f == 1: line[x] = (line[x]+a) & 255
            elif f == 2: line[x] = (line[x]+b) & 255
            elif f == 3: line[x] = (line[x]+(a+b)//2) & 255
            elif f == 4:
                p = a+b-c; pa, pb, pc = abs(p-a), abs(p-b), abs(p-c)
                line[x] = (line[x] + (a if (pa<=pb and pa<=pc) else (b if pb<=pc else c))) & 255
        rows.append(bytes(line)); prev = line
    return w, h, ch, rows

def write_png(path, w, h, rgba):
    raw = b''.join(b'\x00' + bytes(rgba[y]) for y in range(h))
    def chunk(t, d):
        c = t + d
        return struct.pack('>I', len(d)) + c + struct.pack('>I', zlib.crc32(c) & 0xFFFFFFFF)
    png = (b'\x89PNG\r\n\x1a\n'
           + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
           + chunk(b'IDAT', zlib.compress(raw, 9))
           + chunk(b'IEND', b''))
    pathlib.Path(path).write_bytes(png)

SRC = sys.argv[1]
w, h, ch, rows = read_png(SRC)

def lum(x, y):
    o = x*ch
    r = rows[y][o]
    if ch >= 3:
        return 0.299*r + 0.587*rows[y][o+1] + 0.114*rows[y][o+2]
    return r

# ألفا من الإضاءة، بعتبةٍ تُذيب الهالة الرمادية ولا تُثخّن الخطّ
LO, HI = 0.05, 0.55
def alpha(x, y):
    a = (255 - lum(x, y)) / 255
    v = (a - LO) / (HI - LO)
    return 0 if v <= 0 else (255 if v >= 1 else int(round(v*255)))

grid = [[alpha(x, y) for x in range(w)] for y in range(h)]

# قصٌّ على حدود الرسم نفسه — فلا مساحة حوله أصلًا
xs = [x for x in range(w) if any(grid[y][x] for y in range(h))]
ys = [y for y in range(h) if any(grid[y][x] for x in range(w))]
x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
cw, chh = x1-x0+1, y1-y0+1
print(f'الرسم داخل الصورة: {cw}x{chh} عند ({x0},{y0}) — من أصل {w}x{h}')

for name, hexcol in [('palm-black', '0A0D12'), ('palm-gold', 'B8860B')]:
    r, g, b = (int(hexcol[i:i+2], 16) for i in (0, 2, 4))
    out = [bytearray() for _ in range(chh)]
    for y in range(y0, y1+1):
        row = out[y-y0]
        for x in range(x0, x1+1):
            row += bytes((r, g, b, grid[y][x]))
    write_png(f'public/plate-emblems/{name}.png', cw, chh, out)
    print(f'  كُتب {name}.png')
print(f'النسبة: {cw/chh:.6f}')

"""Minimal .aseprite → PNG exporter (single frame, RGBA / indexed / grayscale).

The avatar sprites live as .aseprite files in ~/Desktop/asprite/drawavatar; this
turns them into the PNGs the web app serves. No Aseprite install needed — it
reads the file format directly (header, one frame, cel chunks, zlib pixels).

    python3 tools/ase2png.py ~/Desktop/asprite/drawavatar/*.aseprite
    cp ~/Desktop/asprite/drawavatar/*.png apps/web/public/avatars/   # lowercase names

Re-run it after redrawing anything, then check the hat registration numbers in
apps/web/app/lib/avatar.ts still match the new bounding boxes.
"""
import struct, zlib, sys, pathlib
from PIL import Image

def read(f, fmt):
    size = struct.calcsize(fmt)
    return struct.unpack(fmt, f.read(size))

def export(path, out):
    data = open(path, "rb").read()
    (fsize, magic, frames, w, h, depth, flags, speed) = struct.unpack_from("<IHHHHHIH", data, 0)
    assert magic == 0xA5E0, f"not an aseprite file: {hex(magic)}"
    ncolors = struct.unpack_from("<H", data, 32)[0]
    palette = {}
    canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    off = 128
    # frame header
    fbytes, fmagic, oldchunks, dur = struct.unpack_from("<IHHH", data, off)
    assert fmagic == 0xF1FA
    nchunks = struct.unpack_from("<I", data, off + 12)[0] or oldchunks
    p = off + 16
    for _ in range(nchunks):
        csize, ctype = struct.unpack_from("<IH", data, p)
        body = data[p + 6: p + csize]
        if ctype == 0x2019:                      # palette
            psize, first, last = struct.unpack_from("<III", body, 0)
            q = 20
            for i in range(first, last + 1):
                fl = struct.unpack_from("<H", body, q)[0]
                r, g, b, a = body[q + 2: q + 6]
                palette[i] = (r, g, b, a)
                q += 6
                if fl & 1:                       # the entry carries a name
                    nlen = struct.unpack_from("<H", body, q)[0]
                    q += 2 + nlen
        elif ctype == 0x2005:                    # cel
            layer, x, y, opacity, celtype = struct.unpack_from("<HhhBh", body, 0)
            q = 16                               # 9-byte header + z-index + 5 reserved
            if celtype == 2:
                cw, ch = struct.unpack_from("<HH", body, q)
                raw = zlib.decompress(body[q + 4:])
                if depth == 32:
                    img = Image.frombytes("RGBA", (cw, ch), raw)
                elif depth == 8:
                    img = Image.new("RGBA", (cw, ch))
                    img.putdata([palette.get(v, (0, 0, 0, 0)) for v in raw])
                else:                            # 16-bit grayscale + alpha
                    img = Image.new("RGBA", (cw, ch))
                    img.putdata([(raw[i], raw[i], raw[i], raw[i + 1]) for i in range(0, len(raw), 2)])
                if opacity < 255:
                    a = img.getchannel("A").point(lambda v: v * opacity // 255)
                    img.putalpha(a)
                canvas.alpha_composite(img, (x, y))
        p += csize
    canvas.save(out)
    return w, h

for src in sys.argv[1:]:
    src = pathlib.Path(src)
    out = src.with_suffix(".png")
    print(src.name, "->", export(src, out))

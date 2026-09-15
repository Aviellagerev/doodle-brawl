#!/usr/bin/env python3
"""Build the avatar sprites the web app serves, from the Aseprite originals.

    python3 tools/build-avatars.py [source-dir] [out-dir]
    # defaults: ~/Desktop/asprite/drawavatar  ->  apps/web/public/avatars

The originals are 96x96 with the animal standing on the canvas and the hat drawn
where it would sit on that animal's head. The app wants something different: a
head filling a circle, and a hat riding above the circle's rim. Rather than make
the app carry a table of per-sprite offsets, the alignment is baked in here.

  animals  cropped to the square around the head listed in HEAD, so that every
           animal's head starts one eighth of the way down its own image
  hats     cropped to their own ink, so the bottom row of the file is the brim

Nothing is resampled — the crops keep their original pixels and the browser
scales them with image-rendering: pixelated. With both files aligned this way the
app can place them with one fixed rule and no per-sprite knowledge (see
apps/web/app/components/Avatar.tsx).

Redrawing a sprite? Re-run this. If you move an animal's head, update its HEAD
row: (centre x of the head, first row of the head, size of the square crop).
"""
import pathlib
import struct
import sys
import zlib

from PIL import Image

# animal -> (head centre x, head top row, crop size) on the 96x96 canvas
HEAD = {
    "cat": (40, 21, 48),
    "cow": (40, 30, 42),
    "duck": (41, 32, 36),
    "frog": (40, 32, 54),
}

HEAD_TOP_FRACTION = 0.125   # where the head begins inside the cropped square


# ── the .aseprite reader ────────────────────────────────────────────────────
def read_aseprite(path: pathlib.Path) -> Image.Image:
    """Flatten a single-frame .aseprite into an RGBA image."""
    data = path.read_bytes()
    _, magic, _, w, h, depth, _, _ = struct.unpack_from("<IHHHHHIH", data, 0)
    if magic != 0xA5E0:
        raise ValueError(f"{path.name}: not an aseprite file")

    palette: dict[int, tuple[int, int, int, int]] = {}
    canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))

    _, fmagic, old_chunks, _ = struct.unpack_from("<IHHH", data, 128)
    if fmagic != 0xF1FA:
        raise ValueError(f"{path.name}: bad frame header")
    chunks = struct.unpack_from("<I", data, 128 + 12)[0] or old_chunks

    p = 128 + 16
    for _ in range(chunks):
        size, ctype = struct.unpack_from("<IH", data, p)
        body = data[p + 6: p + size]

        if ctype == 0x2019:                                  # palette
            _, first, last = struct.unpack_from("<III", body, 0)
            q = 20
            for i in range(first, last + 1):
                flags = struct.unpack_from("<H", body, q)[0]
                palette[i] = tuple(body[q + 2: q + 6])        # type: ignore[assignment]
                q += 6
                if flags & 1:                                 # the entry carries a name
                    q += 2 + struct.unpack_from("<H", body, q)[0]

        elif ctype == 0x2005:                                 # cel
            _, x, y, opacity, celtype = struct.unpack_from("<HhhBh", body, 0)
            q = 16                                            # header + z-index + reserved
            if celtype == 2:                                  # compressed image
                cw, ch = struct.unpack_from("<HH", body, q)
                raw = zlib.decompress(body[q + 4:])
                if depth == 32:
                    cel = Image.frombytes("RGBA", (cw, ch), raw)
                elif depth == 8:
                    cel = Image.new("RGBA", (cw, ch))
                    cel.putdata([palette.get(v, (0, 0, 0, 0)) for v in raw])
                else:                                         # 16-bit grey + alpha
                    cel = Image.new("RGBA", (cw, ch))
                    cel.putdata([(raw[i], raw[i], raw[i], raw[i + 1]) for i in range(0, len(raw), 2)])
                if opacity < 255:
                    cel.putalpha(cel.getchannel("A").point(lambda v: v * opacity // 255))
                canvas.alpha_composite(cel, (x, y))
        p += size
    return canvas


# ── the two alignments ──────────────────────────────────────────────────────
def cut_head(img: Image.Image, cx: int, top: int, size: int) -> Image.Image:
    """The square around the head, with the head starting an eighth of the way down."""
    x = cx - size // 2
    y = round(top - HEAD_TOP_FRACTION * size)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.alpha_composite(img.crop((x, y, x + size, y + size)))
    return out


def cut_hat(img: Image.Image) -> Image.Image:
    """The hat's own ink, so the file's bottom row is the brim."""
    box = img.getbbox()
    if not box:
        raise ValueError("hat sprite is empty")
    return img.crop(box)


def main() -> None:
    here = pathlib.Path(__file__).resolve().parent
    src = pathlib.Path(sys.argv[1]).expanduser() if len(sys.argv) > 1 else pathlib.Path.home() / "Desktop/asprite/drawavatar"
    out = pathlib.Path(sys.argv[2]).expanduser() if len(sys.argv) > 2 else here.parent / "apps/web/public/avatars"
    out.mkdir(parents=True, exist_ok=True)

    for path in sorted(src.glob("*.aseprite")):
        stem = path.stem.lower()
        img = read_aseprite(path)
        if stem.endswith("-hat"):
            built = cut_hat(img)
        else:
            if stem not in HEAD:
                print(f"  skipped {stem}: add it to HEAD to include it")
                continue
            built = cut_head(img, *HEAD[stem])
        built.save(out / f"{stem}.png")
        print(f"  {stem:16} {built.size[0]:>3}x{built.size[1]:<3} -> {out.name}/{stem}.png")


if __name__ == "__main__":
    main()

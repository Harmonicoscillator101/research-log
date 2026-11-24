#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""重新生成 icon.ico：用未压缩的 BMP 帧，兼容 Explorer 的小图标提取。"""

import struct
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
PNG = HERE / "app" / "web" / "icon.png"
ICO = HERE / "app" / "web" / "icon.ico"
SIZES = (16, 24, 32, 48, 64, 128)


def frame(im: Image.Image) -> bytes:
    w, h = im.size
    px = im.load()
    xor = bytearray()
    for y in range(h - 1, -1, -1):
        for x in range(w):
            r, g, b, a = px[x, y]
            xor += bytes((b, g, r, a))
    row_bytes = ((w + 31) // 32) * 4
    mask = bytearray()
    for y in range(h - 1, -1, -1):
        row = bytearray(row_bytes)
        for x in range(w):
            if px[x, y][3] == 0:
                row[x // 8] |= 0x80 >> (x % 8)
        mask += row
    header = struct.pack("<IiiHHIIiiII", 40, w, h * 2, 1, 32, 0, len(xor) + len(mask), 0, 0, 0, 0)
    return header + bytes(xor) + bytes(mask)


def main() -> None:
    base = Image.open(PNG).convert("RGBA")
    blobs = []
    for size in SIZES:
        im = base.resize((size, size), Image.LANCZOS)
        blobs.append((size, frame(im)))

    offset = 6 + 16 * len(blobs)
    header = struct.pack("<HHH", 0, 1, len(blobs))
    entries = b""
    body = b""
    for size, blob in blobs:
        entries += struct.pack("<BBBBHHII", size if size < 256 else 0, size if size < 256 else 0, 0, 0, 1, 32, len(blob), offset)
        body += blob
        offset += len(blob)
    ICO.write_bytes(header + entries + body)
    print("wrote", ICO, ICO.stat().st_size, "bytes")


if __name__ == "__main__":
    main()

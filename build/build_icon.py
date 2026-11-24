#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""生成程序图标（icon.ico / icon.png），仅在打包时运行一次。"""

from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
OUT = HERE / "app" / "web"
SIZE = 512


def rounded_mask(size: int, radius: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return mask


def main() -> None:
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))

    # 背景：上下略深的蓝，圆角方块
    bg = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    top = (59, 112, 159)
    bottom = (32, 72, 108)
    gradient = Image.new("RGBA", (1, SIZE))
    for y in range(SIZE):
        t = y / (SIZE - 1)
        color = tuple(round(top[i] + (bottom[i] - top[i]) * t) for i in range(3)) + (255,)
        gradient.putpixel((0, y), color)
    bg = gradient.resize((SIZE, SIZE))
    img.paste(bg, (0, 0), rounded_mask(SIZE, round(SIZE * 0.235)))

    draw = ImageDraw.Draw(img)
    scale = SIZE / 64.0
    stroke = round(3.4 * scale * 1.05)

    def pt(x, y):
        return (round(x * scale), round(y * scale))

    white = (247, 250, 253, 255)
    path = [
        pt(28, 15.5), pt(28, 26.7), pt(19, 44.2), pt(20.2, 49.6),
        pt(24.4, 53.5), pt(39.6, 53.5), pt(43.8, 49.6), pt(45, 44.2),
        pt(36, 26.7), pt(36, 15.5),
    ]
    draw.line(path, fill=white, width=stroke, joint="curve")
    draw.line([pt(25.5, 15.5), pt(38.5, 15.5)], fill=white, width=stroke)
    for point in (path[0], path[-1]):
        draw.ellipse(
            (point[0] - stroke // 2, point[1] - stroke // 2,
             point[0] + stroke // 2, point[1] + stroke // 2),
            fill=white,
        )
    draw.line([pt(23, 40.5), pt(41, 40.5)], fill=(168, 207, 234, 255), width=round(2.6 * scale))

    img.save(OUT / "icon.png")
    sizes = [(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (24, 24), (16, 16)]
    img.save(OUT / "icon.ico", sizes=sizes)
    print("icon written:", OUT / "icon.ico")


if __name__ == "__main__":
    main()

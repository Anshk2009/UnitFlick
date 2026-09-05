#!/usr/bin/env python3
"""Generate the extension icons.

Kept as a script rather than committing hand-drawn binaries with no source:
if the mark ever changes, this is the thing you edit. Uses only the standard
library (zlib + struct), so there is nothing to install.

Usage:  python tools/make-icons.py
"""

import struct
import zlib
from pathlib import Path

BG = (74, 91, 215)      # indigo
FG = (255, 255, 255)    # white arrows

OUT_DIR = Path(__file__).resolve().parent.parent / "icons"
SIZES = (16, 48, 128)


def draw(size):
    """Return a size*size list of RGB pixels: a rounded square with two arrows."""
    s = size
    radius = s * 0.22
    pixels = [[(0, 0, 0, 0)] * s for _ in range(s)]

    for y in range(s):
        for x in range(s):
            # Rounded-square mask: inside the square, and inside the corner
            # circles when we are in a corner region.
            cx = min(max(x + 0.5, radius), s - radius)
            cy = min(max(y + 0.5, radius), s - radius)
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            if dx * dx + dy * dy <= radius * radius:
                pixels[y][x] = (*BG, 255)

    # Two stacked arrows pointing in opposite directions: the "convert" idea.
    bar = max(1, round(s * 0.075))          # bar thickness
    head = max(2, round(s * 0.17))          # arrowhead half-height
    left, right = round(s * 0.24), round(s * 0.76)

    def horizontal_bar(y_center, x_from, x_to):
        for y in range(y_center - bar // 2, y_center - bar // 2 + bar):
            for x in range(x_from, x_to):
                if 0 <= x < s and 0 <= y < s and pixels[y][x][3]:
                    pixels[y][x] = (*FG, 255)

    def arrow_head(tip_x, y_center, direction):
        # Widest at the base, narrowing to a point at the tip.
        for step in range(head):
            x = tip_x + direction * step
            for y in range(y_center - step, y_center + step + 1):
                if 0 <= x < s and 0 <= y < s and pixels[y][x][3]:
                    pixels[y][x] = (*FG, 255)

    top = round(s * 0.38)
    bottom = round(s * 0.62)

    horizontal_bar(top, left, right)
    arrow_head(right, top, -1)          # top arrow points right
    horizontal_bar(bottom, left, right)
    arrow_head(left, bottom, 1)         # bottom arrow points left

    return pixels


def write_png(path, pixels):
    """Minimal RGBA PNG writer."""
    height = len(pixels)
    width = len(pixels[0])

    raw = bytearray()
    for row in pixels:
        raw.append(0)  # filter type 0 (none)
        for r, g, b, a in row:
            raw += bytes((r, g, b, a))

    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))

    header = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)  # 8-bit RGBA
    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", header)
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )
    path.write_bytes(png)


def main():
    OUT_DIR.mkdir(exist_ok=True)
    for size in SIZES:
        target = OUT_DIR / f"icon{size}.png"
        write_png(target, draw(size))
        print(f"wrote {target.relative_to(OUT_DIR.parent)} ({target.stat().st_size} bytes)")


if __name__ == "__main__":
    main()

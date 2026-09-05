#!/usr/bin/env python3
"""Generate the UnitFlick mark: a tape measure bending upward into an arrow.

    python tools/make-icons.py

Writes icons/icon{16,48,128}.png and docs/logo.svg. The geometry is defined
once, below, and both outputs are derived from it — so the SVG in the README
and the PNGs the browser loads can never drift apart.

Everything is laid out on a 100x100 grid and scaled at the end.

Needs Pillow for the PNGs (`pip install pillow`). The SVG is written with no
dependencies at all.
"""

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ICON_DIR = ROOT / "icons"
SVG_PATH = ROOT / "docs" / "logo.svg"

SIZES = (16, 48, 128)

BLUE = (10, 124, 255)
WHITE = (255, 255, 255)

STROKE = 6.5          # line thickness, on the 100x100 grid
CORNER_RADIUS = 22.0  # of the white rounded square behind the mark

# The silhouette of the tape measure, traced once clockwise from the
# bottom-left corner:
#
#   1-2   the bottom edge, running right
#   3     the bend: a 45-degree climb toward the arrow
#   4-6   the arrowhead — out to the lower barb, up the right edge, back
#         along the top edge to the upper barb
#   7     the notch where the head rejoins the shaft
#   8-9   down the upper side of the shaft, then the top edge back to the start
#
# The two sides of the diagonal shaft are the parallel lines x + y = 98 and
# x + y = 121.3. Keeping every diagonal point on one of those two lines is
# what makes the bend the same visual weight as the straight section, and the
# arrowhead is mirrored about the axis halfway between them.
UPPER_SIDE = 98.0
LOWER_SIDE = 121.3

OUTLINE = [
    (13.9, 69.3),    # 1  bottom-left
    (52.0, 69.3),    # 2  bottom edge, up to the bend
    (74.65, 46.65),  # 3  diagonal, lower side
    (80.65, 52.15),  # 4  lower barb
    (80.65, 29.0),   # 5  top-right corner — the point of the arrow
    (57.5, 29.0),    # 6  upper barb
    (63.0, 35.0),    # 7  the notch, back onto the shaft
    (50.9, 47.1),    # 8  diagonal, upper side
    (13.9, 47.1),    # 9  top edge, back to the start
]

# Measuring ticks hanging off the inside of the top edge. The last one is
# already past the bend, so it starts higher and follows the diagonal instead
# of ignoring it.
TICK_XS = (22.0, 29.5, 37.0, 44.5, 52.0)
TICK_LENGTH = 10.0
RULER_TOP_Y = 47.1
BEND_X = 50.9  # where the top edge stops being flat


def tick_segments():
    """Each tick as ((x, y_start), (x, y_end))."""
    segments = []
    for x in TICK_XS:
        # Follow the top edge: flat until the bend, then the 45-degree line.
        top = RULER_TOP_Y if x <= BEND_X else UPPER_SIDE - x
        segments.append(((x, top), (x, top + TICK_LENGTH)))
    return segments


# --------------------------------------------------------------------- SVG


def write_svg():
    points = " ".join(f"{x},{y}" for x, y in OUTLINE)
    ticks = "\n".join(
        f'    <line x1="{a[0]}" y1="{a[1]:.1f}" x2="{b[0]}" y2="{b[1]:.1f}"/>'
        for a, b in tick_segments()
    )
    svg = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100" role="img" aria-label="UnitFlick">
  <title>UnitFlick</title>
  <rect width="100" height="100" rx="{CORNER_RADIUS}" fill="#ffffff"/>
  <g fill="none" stroke="#0a7cff" stroke-width="{STROKE}"
     stroke-linecap="round" stroke-linejoin="round">
    <polygon points="{points}"/>
{ticks}
  </g>
</svg>
"""
    SVG_PATH.parent.mkdir(exist_ok=True)
    SVG_PATH.write_text(svg, encoding="utf-8", newline="\n")
    print(f"wrote {SVG_PATH.relative_to(ROOT)}")


# -------------------------------------------------------------------- PNGs


def write_pngs():
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        raise SystemExit("Pillow is needed for the PNGs: pip install pillow")

    for size in SIZES:
        # Draw big and shrink down: cheap, reliable antialiasing.
        scale = 8
        canvas = size * scale
        unit = canvas / 100.0

        image = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
        draw = ImageDraw.Draw(image)

        draw.rounded_rectangle(
            [0, 0, canvas - 1, canvas - 1],
            radius=CORNER_RADIUS * unit,
            fill=WHITE,
        )

        # At 16px the tick marks are smaller than a pixel and just turn the
        # mark to mush, so the small icon drops them and carries a slightly
        # heavier stroke instead. Same shape, legible at toolbar size.
        detailed = size >= 32
        width = max(1, round((STROKE if detailed else STROKE * 1.35) * unit))
        scaled = [(x * unit, y * unit) for x, y in OUTLINE]

        # A closed loop: repeat the first point so the last corner is joined.
        draw.line(scaled + [scaled[0]], fill=BLUE, width=width, joint="curve")
        # joint="curve" rounds the corners but not the two ends that meet at
        # the start point, so cap that one by hand.
        round_cap(draw, scaled[0], width)

        for a, b in (tick_segments() if detailed else []):
            start = (a[0] * unit, a[1] * unit)
            end = (b[0] * unit, b[1] * unit)
            draw.line([start, end], fill=BLUE, width=width)
            round_cap(draw, start, width)
            round_cap(draw, end, width)

        image = image.resize((size, size), Image.LANCZOS)
        target = ICON_DIR / f"icon{size}.png"
        image.save(target)
        print(f"wrote {target.relative_to(ROOT)} ({target.stat().st_size} bytes)")


def round_cap(draw, point, width):
    """PIL has no round line caps, so put a dot on the end."""
    x, y = point
    r = width / 2.0
    draw.ellipse([x - r, y - r, x + r, y + r], fill=BLUE)


def main():
    ICON_DIR.mkdir(exist_ok=True)
    write_svg()
    write_pngs()


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Generate the add-in icons.

We draw at 4x then downscale, so edges stay smooth at small
sizes. The mark is a rounded blue square with a white checkmark.
The check stands for "send confirmed".
"""

import os

from PIL import Image, ImageDraw

OUT_DIR = os.path.join(os.path.dirname(__file__), os.pardir, "public", "assets")
SIZES = [16, 32, 64, 80, 128]

BLUE = (15, 108, 189, 255)  # Fluent #0f6cbd
WHITE = (255, 255, 255, 255)
SCALE = 4


def rounded_mask(size: int, radius: int) -> Image.Image:
    """Build an alpha mask for a rounded square."""
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return mask


def make_icon(size: int) -> Image.Image:
    big = size * SCALE
    radius = int(big * 0.22)

    # The blue tile.
    tile = Image.new("RGBA", (big, big), BLUE)
    tile.putalpha(rounded_mask(big, radius))

    # The checkmark, drawn as a thick polyline.
    draw = ImageDraw.Draw(tile)
    width = max(2, int(big * 0.10))
    points = [
        (big * 0.28, big * 0.53),
        (big * 0.44, big * 0.69),
        (big * 0.74, big * 0.34),
    ]
    draw.line(points, fill=WHITE, width=width, joint="curve")

    # Round the open ends of the check so it looks clean.
    end_r = width / 2
    for cx, cy in (points[0], points[2]):
        draw.ellipse(
            [cx - end_r, cy - end_r, cx + end_r, cy + end_r],
            fill=WHITE,
        )

    return tile.resize((size, size), Image.LANCZOS)


def main() -> None:
    os.makedirs(OUT_DIR, exist_ok=True)
    for size in SIZES:
        icon = make_icon(size)
        path = os.path.join(OUT_DIR, f"icon-{size}.png")
        icon.save(path)
        print("wrote", path)


if __name__ == "__main__":
    main()

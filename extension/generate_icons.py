#!/usr/bin/env python3
"""Generate crisp, modern technical 'A' emblem icons for Arjuna Sarthi."""

import os
from PIL import Image, ImageDraw

def create_arjuna_sarthi_icon(size: int) -> Image.Image:
    # Use 4x supersampling for ultra-crisp antialiasing
    scale = 4
    canvas_size = size * scale
    img = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 1. Rounded container background
    # Gradient simulation from deep sapphire indigo to vivid electric violet
    corner_radius = int(canvas_size * 0.22)
    padding = int(canvas_size * 0.04)
    x0, y0 = padding, padding
    x1, y1 = canvas_size - padding, canvas_size - padding

    # Draw rounded rectangle container
    # Base fill: modern tech deep indigo #1E1B4B
    draw.rounded_rectangle(
        [x0, y0, x1, y1],
        radius=corner_radius,
        fill=(30, 27, 75, 255),
        outline=(99, 102, 241, 220),  # Subtle indigo ring
        width=max(1, int(scale * 1.5)),
    )

    # 2. Inner subtle glow disc / radial accent
    cx, cy = canvas_size // 2, int(canvas_size * 0.52)
    glow_r = int(canvas_size * 0.35)
    draw.ellipse(
        [cx - glow_r, cy - glow_r, cx + glow_r, cy + glow_r],
        fill=(79, 70, 229, 90),
    )

    # 3. Geometric Technical "A" Emblem:
    # Modern arrowhead / chevron apex + navigational compass needle crossbar
    top_y = int(canvas_size * 0.20)
    bot_y = int(canvas_size * 0.78)
    left_x = int(canvas_size * 0.22)
    right_x = int(canvas_size * 0.78)
    mid_x = canvas_size // 2

    apex_outer = (mid_x, top_y)
    bot_left_outer = (left_x, bot_y)
    bot_right_outer = (right_x, bot_y)

    stroke_w = int(canvas_size * 0.11)

    # Left leg of A
    draw.line([apex_outer, bot_left_outer], fill=(255, 255, 255, 255), width=stroke_w)
    # Right leg of A
    draw.line([apex_outer, bot_right_outer], fill=(255, 255, 255, 255), width=stroke_w)

    # Rounded apex cap
    cap_r = stroke_w // 2
    draw.ellipse(
        [apex_outer[0] - cap_r, apex_outer[1] - cap_r, apex_outer[0] + cap_r, apex_outer[1] + cap_r],
        fill=(255, 255, 255, 255),
    )
    # Rounded bottom foot caps
    draw.ellipse(
        [bot_left_outer[0] - cap_r, bot_left_outer[1] - cap_r, bot_left_outer[0] + cap_r, bot_left_outer[1] + cap_r],
        fill=(255, 255, 255, 255),
    )
    draw.ellipse(
        [bot_right_outer[0] - cap_r, bot_right_outer[1] - cap_r, bot_right_outer[0] + cap_r, bot_right_outer[1] + cap_r],
        fill=(255, 255, 255, 255),
    )

    # Dynamic Crossbar (cyan/electric violet intelligence needle)
    bar_y = int(canvas_size * 0.56)
    bar_left_x = int(canvas_size * 0.33)
    bar_right_x = int(canvas_size * 0.67)
    bar_stroke = int(canvas_size * 0.08)

    # Draw vibrant cyan intelligence bar
    draw.line(
        [(bar_left_x, bar_y), (bar_right_x, bar_y)],
        fill=(56, 189, 248, 255),
        width=bar_stroke,
    )
    # Center intelligence jewel
    jewel_r = int(canvas_size * 0.065)
    draw.ellipse(
        [mid_x - jewel_r, bar_y - jewel_r, mid_x + jewel_r, bar_y + jewel_r],
        fill=(255, 255, 255, 255),
        outline=(56, 189, 248, 255),
        width=max(1, scale),
    )

    # Downsample cleanly to target resolution
    return img.resize((size, size), Image.Resampling.LANCZOS)

def main():
    icons_dir = "/Users/darshanpatil/Downloads/Vcet/extension/public/icons"
    os.makedirs(icons_dir, exist_ok=True)

    sizes = [16, 32, 48, 128]
    for sz in sizes:
        icon_img = create_arjuna_sarthi_icon(sz)
        out_path = os.path.join(icons_dir, f"icon{sz}.png")
        icon_img.save(out_path, "PNG")
        print(f"Generated {out_path} ({sz}x{sz})")

if __name__ == "__main__":
    main()

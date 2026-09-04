#!/usr/bin/env python3
"""Generate Mahabharat-inspired Arjuna Sarthi 'A' emblem icons with 4-layer floating orbit."""

import os
import math
from PIL import Image, ImageDraw

def create_mahabharat_arjuna_icon(size: int) -> Image.Image:
    scale = 4
    canvas_size = size * scale
    img = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    cx, cy = canvas_size / 2.0, canvas_size / 2.0

    # 1. Outer rounded container: Dark Kurukshetra Twilight Cosmic Indigo
    corner_radius = int(canvas_size * 0.22)
    padding = int(canvas_size * 0.035)
    draw.rounded_rectangle(
        [padding, padding, canvas_size - padding, canvas_size - padding],
        radius=corner_radius,
        fill=(15, 12, 35, 255),
        outline=(217, 119, 6, 200),  # Radiant gold border
        width=max(1, int(scale * 1.5)),
    )

    # 2. Celestial Core Aura Glow
    glow_radius = int(canvas_size * 0.40)
    for r, alpha in [(glow_radius, 25), (int(glow_radius * 0.75), 45), (int(glow_radius * 0.5), 75)]:
        draw.ellipse(
            [cx - r, cy - r, cx + r, cy + r],
            fill=(245, 158, 11, alpha),
        )

    # 3. 4-LAYER FLOATING ORBIT RINGS
    # We render 4 concentric orbital rings with distinct radiant colors, tilt angles, and floating orbital nodes
    orbits = [
        {"rx": 0.44, "ry": 0.17, "angle": -25, "color": (168, 85, 247, 210), "node_angle": 45, "width": 1.2},   # Layer 4: Brahmastra / Akasha
        {"rx": 0.38, "ry": 0.15, "angle": 35, "color": (244, 63, 94, 210), "node_angle": 135, "width": 1.2},    # Layer 3: Tejas / Sudarshana
        {"rx": 0.31, "ry": 0.13, "angle": -10, "color": (56, 189, 248, 220), "node_angle": 225, "width": 1.2},   # Layer 2: Gandiva / Vayu
        {"rx": 0.24, "ry": 0.11, "angle": 20, "color": (251, 191, 36, 240), "node_angle": 315, "width": 1.5},   # Layer 1: Prithvi / Chariot
    ]

    for orb in orbits:
        rx = canvas_size * orb["rx"]
        ry = canvas_size * orb["ry"]
        tilt_rad = math.radians(orb["angle"])
        stroke_w = max(1, int(scale * orb["width"]))
        color = orb["color"]

        # Sample ellipse points and rotate
        num_points = 120
        points = []
        for i in range(num_points + 1):
            theta = 2 * math.pi * (i / num_points)
            x_el = rx * math.cos(theta)
            y_el = ry * math.sin(theta)
            # Rotate by tilt angle
            x_rot = x_el * math.cos(tilt_rad) - y_el * math.sin(tilt_rad)
            y_rot = x_el * math.sin(tilt_rad) + y_el * math.cos(tilt_rad)
            points.append((cx + x_rot, cy + y_rot))

        for i in range(len(points) - 1):
            draw.line([points[i], points[i + 1]], fill=color, width=stroke_w)

        # Draw floating orbital planet / celestial jewel on each ring
        node_rad = math.radians(orb["node_angle"])
        nx_el = rx * math.cos(node_rad)
        ny_el = ry * math.sin(node_rad)
        nx_rot = nx_el * math.cos(tilt_rad) - ny_el * math.sin(tilt_rad)
        ny_rot = nx_el * math.sin(tilt_rad) + ny_el * math.cos(tilt_rad)
        node_center = (cx + nx_rot, cy + ny_rot)
        nr = max(2, int(scale * 1.8))
        draw.ellipse(
            [node_center[0] - nr, node_center[1] - nr, node_center[0] + nr, node_center[1] + nr],
            fill=(255, 255, 255, 255),
            outline=color[:3] + (255,),
            width=max(1, scale // 2),
        )

    # 4. MAHABHARAT GANDIVA ARROW EMBLEM "A"
    top_y = int(canvas_size * 0.22)
    bot_y = int(canvas_size * 0.77)
    left_x = int(canvas_size * 0.27)
    right_x = int(canvas_size * 0.73)
    mid_x = canvas_size // 2

    apex = (mid_x, top_y)
    bot_left = (left_x, bot_y)
    bot_right = (right_x, bot_y)

    stroke_w = max(2, int(canvas_size * 0.095))

    # Outer Golden Glow for 'A'
    glow_w = stroke_w + int(scale * 2)
    draw.line([apex, bot_left], fill=(217, 119, 6, 120), width=glow_w)
    draw.line([apex, bot_right], fill=(217, 119, 6, 120), width=glow_w)

    # Left & Right Legs (Imperial Gold)
    draw.line([apex, bot_left], fill=(254, 240, 138, 255), width=stroke_w)
    draw.line([apex, bot_right], fill=(251, 191, 36, 255), width=stroke_w)

    # Rounded Caps
    cap_r = stroke_w // 2
    for pt in [apex, bot_left, bot_right]:
        draw.ellipse(
            [pt[0] - cap_r, pt[1] - cap_r, pt[0] + cap_r, pt[1] + cap_r],
            fill=(254, 240, 138, 255),
        )

    # 5. SUDARSHANA / SARTHI GUIDING CROSSBAR
    bar_y = int(canvas_size * 0.57)
    bar_left_x = int(canvas_size * 0.35)
    bar_right_x = int(canvas_size * 0.65)
    bar_stroke = max(2, int(canvas_size * 0.075))

    # Crossbar ray
    draw.line(
        [(bar_left_x, bar_y), (bar_right_x, bar_y)],
        fill=(56, 189, 248, 255),  # Divine sky blue / cyan
        width=bar_stroke,
    )

    # Center Sudarshana Chakra Jewel on the crossbar
    jewel_r = int(canvas_size * 0.07)
    draw.ellipse(
        [mid_x - jewel_r, bar_y - jewel_r, mid_x + jewel_r, bar_y + jewel_r],
        fill=(255, 255, 255, 255),
        outline=(245, 158, 11, 255),
        width=max(1, scale),
    )

    # Arrowhead Apex Jewel (The eye of the fish / Ekagrata target)
    target_r = int(canvas_size * 0.045)
    draw.ellipse(
        [mid_x - target_r, top_y - target_r, mid_x + target_r, top_y + target_r],
        fill=(255, 255, 255, 255),
        outline=(244, 63, 94, 255),
        width=max(1, scale // 2),
    )

    return img.resize((size, size), Image.Resampling.LANCZOS)

def main():
    target_dirs = [
        "/Users/darshanpatil/Downloads/Vcet/extension/public/icons",
        "/Users/darshanpatil/Downloads/Vcet/extension/dist/icons",
        "/Users/darshanpatil/Downloads/Vcet/frontend/public/icons",
    ]

    for d in target_dirs:
        os.makedirs(d, exist_ok=True)

    sizes = [16, 32, 48, 128]
    for sz in sizes:
        icon_img = create_mahabharat_arjuna_icon(sz)
        for d in target_dirs:
            out_path = os.path.join(d, f"icon{sz}.png")
            icon_img.save(out_path, "PNG")
            print(f"Saved {out_path} ({sz}x{sz})")

if __name__ == "__main__":
    main()

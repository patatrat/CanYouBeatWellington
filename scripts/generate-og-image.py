#!/usr/bin/env python3
"""Generate og-image.png for Can You Beat Wellington (1200x630)."""

from PIL import Image, ImageDraw, ImageFont
import math, os

W, H = 1200, 630
out = os.path.join(os.path.dirname(__file__), '../public/og-image.png')

img = Image.new('RGB', (W, H))
draw = ImageDraw.Draw(img)

# Sky gradient: light blue top → warm horizon
for y in range(H):
    t = y / H
    r = int(147 + (255 - 147) * t * 0.6)
    g = int(197 + (230 - 197) * t * 0.5)
    b = int(253 + (200 - 253) * t * 0.8)
    draw.line([(0, y), (W, y)], fill=(r, g, b))

# Sun
sun_x, sun_y, sun_r = 920, 180, 70
# Glow layers
for i in range(4, 0, -1):
    glow_r = sun_r + i * 18
    alpha_img = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(alpha_img)
    glow_draw.ellipse(
        [sun_x - glow_r, sun_y - glow_r, sun_x + glow_r, sun_y + glow_r],
        fill=(255, 240, 100, 30)
    )
    img.paste(Image.alpha_composite(img.convert('RGBA'), alpha_img).convert('RGB'))
    draw = ImageDraw.Draw(img)

draw.ellipse([sun_x - sun_r, sun_y - sun_r, sun_x + sun_r, sun_y + sun_r],
             fill=(255, 230, 50))

# Wellington hills silhouette (stylised ridgeline)
hills = [
    # x, y pairs — a rolling skyline across the bottom
    (0,   480),
    (60,  430),
    (130, 390),
    (200, 410),
    (260, 370),  # Mt Vic peak
    (320, 395),
    (400, 420),
    (460, 380),
    (530, 350),  # Kelburn / Te Ahumairangi peak
    (600, 375),
    (670, 400),
    (740, 360),
    (820, 340),  # Zealandia ridge
    (900, 370),
    (970, 395),
    (1040,360),
    (1110,380),
    (1200,420),
    (1200, 630),
    (0,   630),
]
draw.polygon(hills, fill=(34, 85, 34))   # dark green

# Lighter green highlight on tops
highlight = [
    (0,   480), (60, 430), (130, 390), (200, 410), (260, 370),
    (320, 395), (400, 420), (460, 380), (530, 350), (600, 375),
    (670, 400), (740, 360), (820, 340), (900, 370), (970, 395),
    (1040,360), (1110,380), (1200,420), (1200,445),
    (1110,405), (1040,385), (970,420), (900,395), (820,365),
    (740,385), (670,425), (600,400), (530,375), (460,405),
    (400,445), (320,420), (260,395), (200,435), (130,415),
    (60,455), (0,505),
]
draw.polygon(highlight, fill=(50, 120, 50))

# Water / harbour at very bottom
draw.rectangle([0, 560, W, H], fill=(70, 140, 200))
# Water shimmer lines
for i in range(5):
    y_w = 575 + i * 12
    draw.line([(100, y_w), (500, y_w)], fill=(120, 180, 230), width=2)
    draw.line([(650, y_w), (1000, y_w)], fill=(120, 180, 230), width=2)

# --- Text ---
# Try to load system fonts, fall back gracefully
def load_font(size, bold=False):
    candidates = [
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf' if bold else '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
        '/usr/share/fonts/truetype/freefont/FreeSansBold.ttf' if bold else '/usr/share/fonts/truetype/freefont/FreeSans.ttf',
    ]
    for path in candidates:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()

font_large  = load_font(90, bold=True)
font_medium = load_font(42)
font_small  = load_font(30)

def draw_text_shadow(draw, pos, text, font, fill, shadow=(0,0,0,120), offset=3):
    x, y = pos
    # Draw shadow by compositing on RGBA
    shadow_layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow_layer)
    sd.text((x + offset, y + offset), text, font=font, fill=shadow)
    base = img.convert('RGBA')
    img_c = Image.alpha_composite(base, shadow_layer).convert('RGB')
    img.paste(img_c)
    # Now draw the actual text
    d2 = ImageDraw.Draw(img)
    d2.text((x, y), text, font=font, fill=fill)
    return ImageDraw.Draw(img)

draw = ImageDraw.Draw(img)

# White card / panel behind text
panel = Image.new('RGBA', (W, H), (0, 0, 0, 0))
pd = ImageDraw.Draw(panel)
pd.rounded_rectangle([60, 60, 760, 340], radius=24, fill=(255, 255, 255, 220))
img.paste(Image.alpha_composite(img.convert('RGBA'), panel).convert('RGB'))
draw = ImageDraw.Draw(img)

# Headline
draw = draw_text_shadow(draw, (100, 85), "Can You Beat", font_large, fill=(30, 30, 30))
draw = draw_text_shadow(draw, (100, 185), "Wellington?", font_large, fill=(30, 30, 30))

# Subline
draw = draw_text_shadow(draw, (102, 290), "Wellington weather, daily.", font_medium, fill=(80, 80, 80))

# URL badge at bottom right
badge_text = "canyoubeatwellington.radomski.co.nz"
badge_layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
bd = ImageDraw.Draw(badge_layer)
bbox = bd.textbbox((0, 0), badge_text, font=font_small)
bw = bbox[2] - bbox[0] + 40
bh = bbox[3] - bbox[1] + 20
bx, by = W - bw - 40, H - bh - 40
bd.rounded_rectangle([bx - 10, by - 8, bx + bw, by + bh], radius=12, fill=(0, 0, 0, 160))
img.paste(Image.alpha_composite(img.convert('RGBA'), badge_layer).convert('RGB'))
draw = ImageDraw.Draw(img)
draw.text((bx + 10, by + 2), badge_text, font=font_small, fill=(220, 220, 220))

img.save(out, 'PNG', optimize=True)
print(f"Saved {out} ({os.path.getsize(out)//1024} kB)")

#!/usr/bin/env python3
"""
Generate Open Graph image (1200x630) for StoryStack
"""

import os
import sys

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    print("Error: Pillow (PIL) is required. Install it with:")
    print("  pip3 install Pillow")
    sys.exit(1)

# Dimensions
WIDTH = 1200
HEIGHT = 630

# Colors - App color scheme
BG_START = (249, 250, 251)  # #f9fafb - light gray background
BG_END = (255, 255, 255)    # #ffffff - white
LOGO_START = (179, 143, 91)  # #b38f5b - gold accent (primary)
LOGO_END = (194, 160, 115)   # #c2a073 - lighter gold
TEXT_DARK = (17, 24, 39)     # #111827 - dark gray foreground
TEXT_GRAY = (107, 114, 128)  # #6b7280 - medium gray
TEXT_WHITE = (255, 255, 255)

# Create image with gradient background
def create_gradient_background(width, height, start_color, end_color):
    """Create a gradient background"""
    image = Image.new('RGB', (width, height))
    draw = ImageDraw.Draw(image)
    
    for y in range(height):
        # Interpolate between start and end colors
        ratio = y / height
        r = int(start_color[0] * (1 - ratio) + end_color[0] * ratio)
        g = int(start_color[1] * (1 - ratio) + end_color[1] * ratio)
        b = int(start_color[2] * (1 - ratio) + end_color[2] * ratio)
        draw.line([(0, y), (width, y)], fill=(r, g, b))
    
    return image, draw

def main():
    # Get script directory
    script_dir = os.path.dirname(os.path.abspath(__file__))
    public_dir = os.path.join(script_dir, '..', 'public')
    output_path = os.path.join(public_dir, 'og-image.png')
    
    # Create image
    img, draw = create_gradient_background(WIDTH, HEIGHT, BG_START, BG_END)
    
    # Draw logo placeholder (rounded rectangle with gradient)
    logo_size = 120
    logo_x = (WIDTH - logo_size) // 2
    logo_y = 200
    
    # Create logo with gradient effect
    logo_img = Image.new('RGB', (logo_size, logo_size), LOGO_START)
    logo_draw = ImageDraw.Draw(logo_img)
    # Simple gradient approximation
    for y in range(logo_size):
        ratio = y / logo_size
        r = int(LOGO_START[0] * (1 - ratio) + LOGO_END[0] * ratio)
        g = int(LOGO_START[1] * (1 - ratio) + LOGO_END[1] * ratio)
        b = int(LOGO_START[2] * (1 - ratio) + LOGO_END[2] * ratio)
        logo_draw.line([(0, y), (logo_size, y)], fill=(r, g, b))
    
    # Paste logo (rounded corners approximated)
    img.paste(logo_img, (logo_x, logo_y))
    
    # Draw "SS" text on logo
    try:
        # Try to use a system font
        font_large = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 64)
    except:
        try:
            font_large = ImageFont.truetype("/System/Library/Fonts/Arial.ttf", 64)
        except:
            font_large = ImageFont.load_default()
    
    # Center text on logo
    logo_text = "S"
    bbox = draw.textbbox((0, 0), logo_text, font=font_large)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    logo_text_x = logo_x + (logo_size - text_width) // 2
    logo_text_y = logo_y + (logo_size - text_height) // 2
    draw.text((logo_text_x, logo_text_y), logo_text, fill=TEXT_WHITE, font=font_large)
    
    # Draw title "StoryStack" (dark gray - app foreground)
    try:
        font_title = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 72)
    except:
        try:
            font_title = ImageFont.truetype("/System/Library/Fonts/Arial.ttf", 72)
        except:
            font_title = ImageFont.load_default()
    
    title_text = "StoryStack"
    bbox = draw.textbbox((0, 0), title_text, font=font_title)
    text_width = bbox[2] - bbox[0]
    title_x = (WIDTH - text_width) // 2
    title_y = 380
    draw.text((title_x, title_y), title_text, fill=TEXT_DARK, font=font_title)
    
    # Draw subtitle "storystackstudios.com" (medium gray)
    try:
        font_subtitle = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 28)
    except:
        try:
            font_subtitle = ImageFont.truetype("/System/Library/Fonts/Arial.ttf", 28)
        except:
            font_subtitle = ImageFont.load_default()
    
    subtitle_text = "storystackstudios.com"
    bbox = draw.textbbox((0, 0), subtitle_text, font=font_subtitle)
    text_width = bbox[2] - bbox[0]
    subtitle_x = (WIDTH - text_width) // 2
    subtitle_y = 440
    draw.text((subtitle_x, subtitle_y), subtitle_text, fill=TEXT_GRAY, font=font_subtitle)
    
    # Save image
    img.save(output_path, 'PNG')
    print(f"✓ Open Graph image created successfully!")
    print(f"✓ Saved to: {output_path}")
    print(f"✓ Dimensions: {WIDTH}x{HEIGHT} pixels")

if __name__ == '__main__':
    main()


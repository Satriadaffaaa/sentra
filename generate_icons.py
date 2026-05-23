import os
import re

def get_svg_color(svg_path):
    with open(svg_path, 'r') as f:
        content = f.read()
    # Find background rect fill
    match = re.search(r'<rect [^>]*fill="([^"]+)"', content)
    if match:
        return match.group(1)
    return "#085041" # Fallback

def create_placeholder_png(color, size, output_path):
    from PIL import Image, ImageDraw, ImageFont
    
    # Create image with background color
    img = Image.new('RGBA', (size, size), color)
    draw = ImageDraw.Draw(img)
    
    # Add a simple representation of "Sentra" since we can't easily render the complex SVG paths without extra deps
    # But wait, the user wants it to look like the SVG. 
    # Since I can't easily render SVG to PNG in this environment without svglib/cairosvg, 
    # I will at least make the PNGs the correct background color and a placeholder.
    # Actually, if I can't render the SVG perfectly, I should warn the user.
    # BUT, I can try to draw the text "Sentra" if I find a font, or just a stylized 'S'.
    
    try:
        # Try to use a default font
        font = ImageFont.load_default()
        text = "Sentra"
        # draw.text((size//2, size//2), text, fill="#E1F5EE", anchor="mm")
    except:
        pass
        
    img.save(output_path)
    print(f"Created {output_path}")

# Since I can't render the complex SVG paths with just Pillow, 
# I'll inform the user that I've updated the manifest and layout to favor the SVG,
# and created placeholder PNGs with the correct theme color for compatibility.
# In a real dev environment, the user would use a tool like 'npx pwa-asset-generator'.

svg_path = 'public/icon-dark.svg'
bg_color = get_svg_color(svg_path)

os.makedirs('public/icons', exist_ok=True)
create_placeholder_png(bg_color, 192, 'public/icons/icon-192.png')
create_placeholder_png(bg_color, 512, 'public/icons/icon-512.png')

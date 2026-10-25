# Builds the Teselia mark, wordmark and lockup as SVG, into this folder.
#
#   python3 brand/build.py
#
# The mark is a T of five tesserae, the pieces of a mosaic: many small ones that only together
# form the picture, which is also what a map and a group are. One tessera is lit. The wordmark
# is Geologica at weight 620, the typeface of the site, converted to outlines so it needs no
# font. Needs fonttools, brotli and uharfbuzz (pip install fonttools brotli uharfbuzz).
import os
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
import uharfbuzz as hb

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.join(HERE, '..', 'apps', 'site', 'fonts', 'geologica-latin-wght-normal.woff2')
INK, PALE, SIGNAL = '#10202c', '#e6ebe8', '#f26a2e'

JITTER = [  # per tile: dx,dy for each of the four corners, so no two tesserae are alike
    [(0,1),(-1,0),(1,-1),(0,1)], [(1,0),(0,1),(-1,0),(1,-1)], [(-1,-1),(1,0),(0,1),(-1,0)],
    [(0,-1),(1,1),(-1,0),(1,0)], [(1,0),(-1,-1),(0,1),(-1,1)],
]

def tile(cx, cy, size, jitter, fill):
    h = size / 2
    corners = [(cx-h, cy-h), (cx+h, cy-h), (cx+h, cy+h), (cx-h, cy+h)]
    pts = [(x+dx*1.6, y+dy*1.6) for (x, y), (dx, dy) in zip(corners, jitter)]
    d = 'M' + ' L'.join(f'{x:.1f} {y:.1f}' for x, y in pts) + ' Z'
    # The stroke rounds the corners, like a cut stone, without changing the size much.
    return f'<path d="{d}" fill="{fill}" stroke="{fill}" stroke-width="4" stroke-linejoin="round"/>'

def mark(pale='currentColor', signal=SIGNAL, variant='top'):
    # A T of five tesserae in a 100x100 box: three across, two down.
    s, g = 26, 5
    xs = [50 - s - g, 50, 50 + s + g]
    top_y = 50 - s - g
    pos = [(xs[0], top_y), (xs[1], top_y), (xs[2], top_y), (50, 50), (50, 50 + s + g)]
    hot = 1 if variant == 'top' else 4
    return '\n'.join(tile(x, y, s - 4, JITTER[i], signal if i == hot else pale) for i, (x, y) in enumerate(pos))

def wordmark(text='Teselia', wght=620):
    vf = TTFont(FONT)
    font = instantiateVariableFont(vf, {'wght': wght})
    upem = font['head'].unitsPerEm
    glyphset = font.getGlyphSet()
    # Shape with HarfBuzz for kerning.
    import io
    font.flavor = None; buf = io.BytesIO(); font.save(buf); data = buf.getvalue()
    face = hb.Face(data); hbfont = hb.Font(face); hbfont.scale = (upem, upem)
    hbbuf = hb.Buffer(); hbbuf.add_str(text); hbbuf.guess_segment_properties()
    hb.shape(hbfont, hbbuf, {'kern': True, 'liga': True})
    order = font.getGlyphOrder()
    x = 0; paths = []
    tracking = -0.025 * upem
    for info, posn in zip(hbbuf.glyph_infos, hbbuf.glyph_positions):
        name = order[info.codepoint]
        pen = SVGPathPen(glyphset)
        tpen = TransformPen(pen, (1, 0, 0, -1, x + posn.x_offset, 0))
        glyphset[name].draw(tpen)
        d = pen.getCommands()
        if d: paths.append(d)
        x += posn.x_advance + tracking
    width = x - tracking
    asc = font['hhea'].ascent; desc = -font['hhea'].descent
    # Trim: cap height box
    cap = font['OS/2'].sCapHeight if hasattr(font['OS/2'], 'sCapHeight') else 0.7*upem
    return paths, width, upem, cap, desc

paths, w, upem, cap, desc = wordmark()
# scale so cap height = 100 units
k = 100 / cap
d = ' '.join(paths)
W = w * k
H = (cap + desc) * k
word_svg = f'<g transform="translate(0 {cap*k:.2f}) scale({k:.6f})"><path d="{d}"/></g>'
open(os.path.join(HERE, 'wordmark.svg'), 'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W:.1f} {H:.1f}" fill="{INK}">{word_svg}</svg>')
open(os.path.join(HERE, 'mark.svg'), 'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" color="{PALE}">{mark()}</svg>')
# Lockup: mark height = cap height * 1.15, gap 0.35 of mark
mh = 115; gap = 36
lock_h = max(H, mh)
lock = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {mh+gap+W:.1f} {lock_h:.1f}" color="{INK}">'
        f'<g transform="translate(0 {(lock_h-mh)/2:.2f}) scale({mh/100:.4f})">{mark()}</g>'
        f'<g transform="translate({mh+gap:.1f} {(lock_h-H)/2:.2f})" fill="currentColor">{word_svg}</g></svg>')
open(os.path.join(HERE, 'lockup.svg'), 'w').write(lock)
print('mark.svg, wordmark.svg and lockup.svg written')

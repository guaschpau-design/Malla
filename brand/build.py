# Builds the Tesel mark, wordmark and lockup as SVG, into this folder.
#
#   python3 brand/build.py
#
# The mark is three hexagonal tiles: a tessellation, the cells of a map grid and the nodes of a
# mesh at once. One tile is lit, in signal lime. The wordmark is Archivo, expanded (width 118)
# at weight 700, converted to outlines so it needs no font. Needs fonttools, brotli and uharfbuzz
# (pip install fonttools brotli uharfbuzz).
import io
import json
import math
import os

import uharfbuzz as hb
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

HERE = os.path.dirname(os.path.abspath(__file__))
FONT = os.path.join(HERE, '..', 'apps', 'site', 'fonts', 'archivo-latin-standard-normal.woff2')
# The brand's colours, shared with the app and the site (a test keeps them in step).
with open(os.path.join(HERE, 'colors.json')) as colors_file:
    COLORS = json.load(colors_file)
INK, PALE, SIGNAL = COLORS['ink'], COLORS['pale'], COLORS['signal']
WIDTH, WEIGHT, TRACKING = 118, 700, -0.025

# The mark, in a 100 x 100 box: three pointy-top hexagons in a triangle, with grout between them.
HEX_RADIUS = 23.5
GROUT = 3.5
CORNER = 3  # rounding of the tiles' corners, as a stroke of the same colour


def hexagon(cx, cy):
    r = HEX_RADIUS - CORNER / 2
    return [(cx + r * math.cos(math.radians(60 * k - 30)), cy + r * math.sin(math.radians(60 * k - 30))) for k in range(6)]


def tile(points, fill):
    d = 'M' + ' L'.join(f'{x:.2f} {y:.2f}' for x, y in points) + ' Z'
    return f'<path d="{d}" fill="{fill}" stroke="{fill}" stroke-width="{CORNER}" stroke-linejoin="round"/>'


def mark():
    dx = HEX_RADIUS * math.sqrt(3) + GROUT
    dy = dx * math.sqrt(3) / 2
    top = 50 - dy / 2
    return ''.join([
        tile(hexagon(50 - dx / 2, top), 'currentColor'),
        tile(hexagon(50 + dx / 2, top), SIGNAL),
        tile(hexagon(50, top + dy), 'currentColor'),
    ])


def wordmark(text='Tesel'):
    font = instantiateVariableFont(TTFont(FONT), {'wght': WEIGHT, 'wdth': WIDTH})
    font.flavor = None
    upem = font['head'].unitsPerEm
    buffer = io.BytesIO()
    font.save(buffer)
    shaper = hb.Font(hb.Face(buffer.getvalue()))
    glyphs = hb.Buffer()
    glyphs.add_str(text)
    glyphs.guess_segment_properties()
    hb.shape(shaper, glyphs, {'kern': True, 'liga': True})
    order, glyphset = font.getGlyphOrder(), font.getGlyphSet()
    x, paths = 0, []
    for info, pos in zip(glyphs.glyph_infos, glyphs.glyph_positions):
        pen = SVGPathPen(glyphset)
        glyphset[order[info.codepoint]].draw(TransformPen(pen, (1, 0, 0, -1, x + pos.x_offset, 0)))
        if pen.getCommands():
            paths.append(pen.getCommands())
        x += pos.x_advance + TRACKING * upem
    width = x - TRACKING * upem
    cap = font['OS/2'].sCapHeight
    return ' '.join(paths), width, cap


def main():
    d, width, cap = wordmark()
    k = 100 / cap  # cap height = 100 units
    word_w, word_h = width * k, 100.0
    word = f'<g transform="scale({k:.6f})"><path d="{d}" transform="translate(0 {cap})"/></g>'
    write('wordmark.svg', f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {word_w:.1f} {word_h:.1f}" fill="{INK}">{word}</svg>')
    write('mark.svg', f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" color="{PALE}">{mark()}</svg>')
    # Lockup: the tiles about one and a half times as tall as the capitals, centred on them, so
    # that the mark weighs as much as the word.
    mark_h, gap = 170, 34
    height = mark_h
    lockup = (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {mark_h + gap + word_w:.1f} {height:.1f}" color="{INK}">'
        f'<g transform="scale({mark_h / 100:.4f})">{mark()}</g>'
        f'<g transform="translate({mark_h + gap:.1f} {(height - word_h) / 2:.2f})" fill="currentColor">{word}</g></svg>'
    )
    write('lockup.svg', lockup)
    # The headers of the app and the site are always ink, so both show a pale copy as an image. The
    # site is static and cannot reach this folder, so it gets its own copy.
    pale = lockup.replace(f'color="{INK}"', f'color="{PALE}"')
    write('lockup-pale.svg', pale)
    write(os.path.join('..', 'apps', 'site', 'img', 'lockup-pale.svg'), pale)
    print('mark.svg, wordmark.svg, lockup.svg, lockup-pale.svg and the site\'s copy written')


def write(name, svg):
    with open(os.path.join(HERE, name), 'w') as out:
        out.write(svg + '\n')


main()

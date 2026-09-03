#!/usr/bin/env python3
"""
Rende in GIF animata i frame prodotti da `buddy.mjs frames`.

    node skills/buddy/engine/buddy.mjs frames pet | tools/animate.py pet.gif

Serve solo a **condividere** l'animazione: nella chat di Claude Code, in un
README, in un messaggio. Nel terminale l'animazione gira già da sé — questo
esiste perché un blocco di testo in markdown non può muoversi.

L'engine resta senza dipendenze: la logica dell'animazione sta tutta in
`render.mjs` e qui arriva come dati. L'unica dipendenza (Pillow) è di questo
strumento opzionale.
"""

import json
import sys
from pathlib import Path

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    sys.exit("animate: serve Pillow (pip install pillow)")

# Colori del terminale: fondo scuro, come Claude Code.
BG = (26, 27, 32)
FG_DEFAULT = (200, 200, 200)
SCALE = 2          # rendering a 2x, poi ridotto: bordi più puliti
PAD = 12

FONT_CANDIDATES = [
    "/System/Library/Fonts/Menlo.ttc",
    "/System/Library/Fonts/SFNSMono.ttf",
    "/System/Library/Fonts/Supplemental/Courier New.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf",
    "/usr/share/fonts/TTF/DejaVuSansMono.ttf",
]


def load_font(size):
    for path in FONT_CANDIDATES:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    sys.exit("animate: nessun font monospaziato trovato")


def xterm256(i):
    """Indice ANSI 256 -> RGB."""
    if i is None:
        return FG_DEFAULT
    if i < 16:
        base = [(0, 0, 0), (205, 0, 0), (0, 205, 0), (205, 205, 0),
                (0, 0, 238), (205, 0, 205), (0, 205, 205), (229, 229, 229),
                (127, 127, 127), (255, 0, 0), (0, 255, 0), (255, 255, 0),
                (92, 92, 255), (255, 0, 255), (0, 255, 255), (255, 255, 255)]
        return base[i]
    if i < 232:
        n = i - 16
        return tuple(0 if v == 0 else 55 + 40 * v for v in (n // 36, (n % 36) // 6, n % 6))
    g = 8 + (i - 232) * 10
    return (g, g, g)


def render(data, out_path, font_size=22, loop=0):
    frames = data["frames"]
    default_delay = data.get("defaultDelayMs", 150)
    font = load_font(font_size * SCALE)

    # Cella monospaziata: la larghezza la misuro su un carattere pieno.
    probe = ImageDraw.Draw(Image.new("RGB", (1, 1)))
    cw = probe.textlength("M", font=font)
    ascent, descent = font.getmetrics()
    ch = ascent + descent

    cols = max(len(r["text"]) for f in frames for r in f["rows"])
    rows = max(len(f["rows"]) for f in frames)
    W = int(cw * cols) + PAD * 2 * SCALE
    H = int(ch * rows) + PAD * 2 * SCALE

    images, durations = [], []
    for f in frames:
        img = Image.new("RGB", (W, H), BG)
        d = ImageDraw.Draw(img)
        for y, row in enumerate(f["rows"]):
            text, accent = row["text"], row.get("accent")
            base_rgb = xterm256(row.get("fg"))
            top = PAD * SCALE + int(ch * y)
            if accent:
                # La riga è spezzata in due colori: corpo e cuoricino.
                cut = accent["col"]
                d.text((PAD * SCALE, top), text[:cut], font=font, fill=base_rgb)
                d.text((PAD * SCALE + cw * cut, top), text[cut:], font=font,
                       fill=xterm256(accent["fg"]))
            else:
                d.text((PAD * SCALE, top), text, font=font, fill=base_rgb)
        images.append(img.resize((W // SCALE, H // SCALE), Image.LANCZOS))
        durations.append(f.get("delayMs", default_delay))

    images[0].save(out_path, save_all=True, append_images=images[1:],
                   duration=durations, loop=loop, optimize=True, disposal=2)
    return out_path, images[0].size, len(images), sum(durations)


def main():
    if len(sys.argv) < 2:
        sys.exit("uso: buddy.mjs frames <pet|hatch> | animate.py <out.gif> [dimensione-font]")
    out = sys.argv[1]
    size = int(sys.argv[2]) if len(sys.argv) > 2 else 22
    data = json.load(sys.stdin)
    path, (w, h), n, total = render(data, out, font_size=size)
    print(f"animate: {path} — {w}x{h}, {n} frame, {total/1000:.1f}s in loop")


if __name__ == "__main__":
    main()

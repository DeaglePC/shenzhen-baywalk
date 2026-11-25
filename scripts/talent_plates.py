"""Bake unlit sleeve artwork from the field photographs; the guide keeps the originals."""
import argparse
import json
import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.fft import dctn, idctn

ROOT = Path(__file__).resolve().parents[1]
FIELD = ROOT / "public/talent/field"
LAYOUT = json.loads((ROOT / "src/talent-plate-layout.json").read_text())
SILVER = 183
RESAMPLE = Image.Resampling.LANCZOS


def smooth(low, high, values):
    t = np.clip((values - low) / (high - low), 0, 1)
    return t * t * (3 - 2 * t)


def portrait_ink(gray):
    # On the polished steel, illumination drifts across a face while the actual
    # stencil has sharp boundaries. Reintegrate those edges in log luminance.
    height, width = gray.shape
    portrait = gray[:round(.43 * height)]
    log_light = np.log(cv2.bilateralFilter(portrait, 7, 12, 5) + 10)
    dx, dy = np.diff(log_light, axis=1), np.diff(log_light, axis=0)
    dx *= smooth(.035, .14, abs(dx))
    dy *= smooth(.035, .14, abs(dy))
    divergence = np.zeros_like(log_light)
    divergence[:, :-1] -= dx
    divergence[:, 1:] += dx
    divergence[:-1] -= dy
    divergence[1:] += dy
    rows = len(portrait)
    eigen = (4 * np.sin(np.pi * np.arange(rows) / (2 * rows))[:, None] ** 2
             + 4 * np.sin(np.pi * np.arange(width) / (2 * width))[None, :] ** 2)
    eigen[0, 0] = 1
    flat = idctn(dctn(divergence, norm="ortho") / eigen, norm="ortho")
    depth = np.percentile(flat, 80, axis=0) - flat
    contrast = np.clip(np.percentile(depth, 96), .30, 1.5)
    y = np.arange(rows)[:, None] / height
    return (smooth(.18 * contrast, .51 * contrast, depth)
            * smooth(.037, .056, y) * (1 - smooth(.405, .422, y)))


def brushed_silver(width, height):
    rng = np.random.default_rng(421)
    noise = rng.standard_normal((height, width), dtype=np.float32)
    brush = cv2.GaussianBlur(noise, (0, 0), sigmaX=width / 60, sigmaY=width / 740)
    return SILVER + brush * (1.65 / brush.std()) + noise * .45


def inscription_end(photo):
    # Some biographies have a fourth or fifth line. Find the photographed red
    # arch and use the blank steel above it as the cut, independently per sitter.
    rgb = np.asarray(photo.convert("RGB"), dtype=np.int16)
    h, w = rgb.shape[:2]
    start = round(.66 * h)
    r, g, b = rgb[start:round(.92 * h), w // 5:4 * w // 5].transpose(2, 0, 1)
    red = (r - g > 17) & (r - b > 7)
    rows = np.flatnonzero(np.convolve((red.sum(axis=1) >= 5).astype(float), np.ones(5), "valid") >= 4)
    return start + rows[0] - round(.013 * h) if len(rows) else round(.76 * h)


def clean_sleeve(photo):
    gray = np.asarray(photo.convert("L"), dtype=np.float32)
    height, width = gray.shape
    upper_height = round(height * LAYOUT["upperFraction"])
    base = brushed_silver(width, upper_height)
    ink = portrait_ink(gray)
    base[:len(ink)] -= 150 * ink

    # Recover the short, recessed strokes and their bright lips without the
    # long vertical reflections. Keep every photographed line of the biography.
    start = round(height * .423)
    letters = cv2.GaussianBlur(gray[start:inscription_end(photo)], (3, 3), .7)
    nib = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 19))
    dark = smooth(6, 72, cv2.morphologyEx(letters, cv2.MORPH_BLACKHAT, nib))
    light = smooth(8, 65, cv2.morphologyEx(letters, cv2.MORPH_TOPHAT, nib))
    strokes = np.maximum(dark, .7 * light)
    lines = cv2.GaussianBlur(strokes, (0, 0), sigmaX=18, sigmaY=3)
    inscription = (30 * light - 132 * dark) * smooth(.025, .12, lines)
    base[start:] += cv2.resize(inscription, (width, upper_height - start), interpolation=cv2.INTER_AREA)
    x = np.arange(width) / (width - 1)
    base = SILVER + (base - SILVER) * smooth(.015, .038, np.minimum(x, 1 - x))
    return Image.fromarray(np.uint8(np.clip(base, 0, 255)))


def park_seal():
    # Outline traced from the park seal on the author's Fang Binxing photograph.
    im = Image.new("RGBA", (620, 356))
    d = ImageDraw.Draw(im)
    d.polygon([(207,239),(212,206),(220,176),(239,142),(260,122),(292,101),(333,85),
               (357,80),(379,82),(403,93),(426,111),(448,138),(465,163),(471,178),
               (464,186),(453,187),(440,162),(421,139),(400,120),(378,106),(354,100),
               (335,100),(317,104),(286,116),(264,131),(245,151),(230,177),(221,206),
               (217,233)], fill="#af4737")
    d.ellipse((288,135,313,174), fill="#148eaa")
    d.polygon([(266,231),(276,202),(287,184),(303,177),(314,181),(321,195),(319,207),
               (312,209),(300,199),(295,204),(283,232),(275,240),(268,239)], fill="#16899d")
    d.ellipse((371,120,388,151), fill="#284a59")
    d.line([(324,184),(335,185),(354,174),(365,173),(371,182),(367,205),(361,238)],
           fill="#36535c", width=6)
    d.line([(322,232),(337,209),(353,191),(362,192)], fill="#36535c", width=6)
    d.polygon([(530,200),(496,207),(451,213),(434,219),(452,226),(468,238),(471,246),
               (463,257),(441,263),(393,275),(349,282),(301,284),(251,282),(207,275),
               (192,265),(211,273),(255,277),(308,278),(360,272),(408,261),(434,252),
               (436,247),(418,242),(397,232),(397,218),(412,207),(446,198),(490,193)],
              fill="#175e78")
    return im.crop(im.getbbox())


def save_footer(font_path):
    width, height = 768, 976
    footer = Image.fromarray(np.uint8(brushed_silver(width, height))).convert("RGB")
    mark = park_seal()
    mark.thumbnail((300, 200), RESAMPLE)
    footer.paste(mark, ((width - mark.width) // 2, 336 - mark.height // 2), mark)
    motto = "深爱人才 圳等您来"
    font = ImageFont.truetype(str(font_path), 70)
    draw = ImageDraw.Draw(footer)
    left, top, right, bottom = draw.textbbox((0, 0), motto, font=font)
    draw.text(((width - left - right) / 2, 635 - (top + bottom) / 2), motto,
              font=font, fill="#30373a")
    footer.save(FIELD / "common-footer.webp", quality=93, method=6)


def save_pages(images, layout, prefix):
    cols, rows = layout["columns"], layout["rows"]
    w, h, gutter = layout["width"], layout["height"], LAYOUT["gutter"]
    pitch_x, pitch_y = w + 2 * gutter, h + 2 * gutter
    for start in range(0, len(images), cols * rows):
        atlas = Image.new("L", (cols * pitch_x, rows * pitch_y), SILVER)
        for i, im in enumerate(images[start:start + cols * rows]):
            cell = np.asarray(im.resize((w, h), RESAMPLE))
            padded = np.pad(cell, gutter, mode="edge")
            atlas.paste(Image.fromarray(padded), (i % cols * pitch_x, i // cols * pitch_y))
        atlas.save(FIELD / f"{prefix}{start // (cols * rows)}.webp", quality=91, method=5)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--font", default="C:/Windows/Fonts/msyh.ttc",
                        help="Path to a Simplified Chinese font for the shared motto")
    args = parser.parse_args()
    export = ("import {talentRecords} from './src/talent-records.js';"
              "console.log(JSON.stringify(talentRecords.filter(r=>r.field).map(r=>r.id)))")
    ids = json.loads(subprocess.check_output(["node", "--input-type=module", "-e", export], cwd=ROOT))
    images = []
    for person in ids:
        with Image.open(FIELD / f"{person}.webp") as photo:
            images.append(clean_sleeve(photo))
    save_pages(images, LAYOUT["overview"], "plates-")
    (FIELD / "close").mkdir(exist_ok=True)
    save_pages(images, LAYOUT["detail"], "close/plates-")
    save_footer(args.font)

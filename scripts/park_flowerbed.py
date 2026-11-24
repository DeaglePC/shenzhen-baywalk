"""Trace the two planting rows and sample seamless leaf materials from the restored front view.

Run with the path to the 2172 × 724 restoration. Only contours and small botanical
swatches are shipped to the scene.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from rasterio.features import shapes
from scipy import ndimage as nd
from shapely.geometry import Polygon, shape

ROOT = Path(__file__).resolve().parents[1]
im = np.asarray(Image.open(sys.argv[1]).convert("RGB"), dtype=np.int16)
if im.shape[:2] != (724, 2172):
    raise ValueError("Expected the original 2172 × 724 restoration")
r, g, b = im.transpose(2, 0, 1)
y = np.arange(im.shape[0])[:, None]
x = np.arange(im.shape[1])
red = (r > g * 1.1 + 3) & (b > g * .92) & (y > 221) & (y < 391) & (x > 145)
gold = (r > g * 1.04 + 3) & (g > b + 18) & (y > 412) & (y < 511)
green = (g > r * .99) & (g > b * 1.35 + 5) & (y > 238) & (y < 384) & (x > 280) & (x < 1940)


def trace(mask, top, bottom):
    # Close gaps between individual florets before tracing the planting beds.
    closed = nd.binary_closing(mask, structure=np.ones((5, 5)))
    smooth = nd.gaussian_filter(closed.astype(float), 2.6) > .40
    strokes = []
    for feature, _ in shapes(smooth.astype("uint8"), mask=smooth):
        polygon = shape(feature)
        if polygon.area < 140:
            continue
        polygon = polygon.simplify(1.35, preserve_topology=True)
        rings = [polygon.exterior, *(h for h in polygon.interiors if Polygon(h).area > 45)]
        def project(ring):
            pts = []
            for x, py in list(ring.coords)[:-1]:
                v = (py - top[0]) / (bottom[0] - top[0])
                left = top[1] + (bottom[1] - top[1]) * v
                right = top[2] + (bottom[2] - top[2]) * v
                pts.append([round((x-left)/(right-left), 5), round(1-v, 5)])
            return pts
        strokes.append([project(ring) for ring in rings])
    return strokes


def swatch(mask, name, seed):
    # Overlap small patches wholly inside a stroke. Wrap the blends over all
    # four edges so the material can tile in metres on a curved surface.
    rng = np.random.default_rng(seed)
    inner = nd.gaussian_filter(mask.astype(float), 2) > .67
    sites = np.argwhere(nd.distance_transform_edt(inner) >= 12)
    size, half = 256, 10
    axis = np.arange(-half, half)
    weights = np.outer(np.hanning(half*2), np.hanning(half*2))
    tile = np.zeros((size, size, 3))
    total = np.zeros((size, size))
    for j in range(0, size, 8):
        for i in range(0, size, 8):
            cy, cx = sites[rng.integers(len(sites))]
            patch = im[cy-half:cy+half, cx-half:cx+half]
            ix = np.ix_((axis+j) % size, (axis+i) % size)
            tile[ix] += patch * weights[..., None]
            total[ix] += weights
    tile /= total[..., None]
    # Recover the local contrast softened by blending adjacent leaf clusters.
    low = nd.gaussian_filter(tile, (3, 3, 0), mode="wrap")
    tile = np.clip(tile + .7*(tile-low), 0, 255).astype("uint8")
    Image.fromarray(tile).save(ROOT / "public/city" / f"flowerbed-{name}.webp", quality=93)


rows = {"chinese": trace(red, (218, 240, 2000), (394, 117, 2087)),
        "english": trace(gold, (410, 88, 2070), (513, 35, 2140))}
(ROOT / "src/flowerbed-strokes.json").write_text(json.dumps(rows, separators=(",", ":")) + "\n")
for seed, (mask, name) in enumerate([(red, "burgundy"), (gold, "gold"), (green, "hedge")]):
    swatch(mask, name, seed)

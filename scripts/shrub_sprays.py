"""Bake small shrub shoots and grass tufts from Poly Haven's CC0 plants.
Run with the same Python dependencies as foliage_build.py.
"""
from pathlib import Path
from tempfile import gettempdir
import json

import numpy as np
from PIL import Image
import requests
from scipy.ndimage import distance_transform_edt

from foliage_build import stamp

CACHE = Path(gettempdir()) / "shenzhen-groundcover"
DEST = Path(__file__).resolve().parents[1] / "public/foliage/understory.webp"
TILE = 256


def source(name):
    CACHE.mkdir(exist_ok=True)
    paths = [CACHE / (name + ext) for ext in [".gltf", ".bin", "_diff_1k.jpg", "_alpha.png"]]
    if not all(p.exists() for p in paths):
        response = requests.get("https://api.polyhaven.com/files/" + name, timeout=30)
        response.raise_for_status()
        files = response.json()
        gl = files["gltf"]["1k"]["gltf"]
        urls = [gl["url"], gl["include"][paths[1].name]["url"],
                gl["include"]["textures/" + paths[2].name]["url"], files["Alpha"]["1k"]["png"]["url"]]
        for p, url in zip(paths, urls):
            if not p.exists():
                r = requests.get(url, timeout=90)
                r.raise_for_status()
                p.write_bytes(r.content)
    doc = json.loads(paths[0].read_bytes())
    buffer = paths[1].read_bytes()

    def accessor(index):
        a = doc["accessors"][index]
        view = doc["bufferViews"][a["bufferView"]]
        n = {"VEC3": 3, "VEC2": 2, "SCALAR": 1}[a["type"]]
        dtype = {5126: "<f4", 5123: "<u2", 5125: "<u4"}[a["componentType"]]
        offset = view.get("byteOffset", 0) + a.get("byteOffset", 0)
        return np.frombuffer(buffer, dtype, a["count"] * n, offset).reshape(-1, n)

    def mesh(i):
        part = doc["meshes"][i]["primitives"][0]
        return (*[accessor(part["attributes"][a]) for a in ("POSITION", "NORMAL", "TEXCOORD_0")],
                accessor(part["indices"]).reshape(-1, 3))

    return mesh, np.asarray(Image.open(paths[2]).convert("RGB")), np.asarray(Image.open(paths[3]).convert("L"))


def projections(mesh, texture, alpha, angles, faces=None):
    pos, normals, uv, tri = mesh
    if faces is not None:
        tri = tri[faces]
    points = pos[np.unique(tri)]
    low, high = points[:, 1].min(), points[:, 1].max()
    root = points[points[:, 1] < low + .055 * (high-low)].mean(axis=0)
    lower = np.zeros((1, 3, 2), np.float32)
    span = lower.copy()
    axes = np.zeros((3, 3, 3), np.float32)
    for i, a in enumerate(angles):
        right = np.array([np.cos(a), 0, np.sin(a)])
        axes[i] = [right, [0, 1, 0], [-np.sin(a), 0, np.cos(a)]]
        width = 2.04 * np.abs((points-root) @ right).max()
        lower[0, i] = [root @ right - width/2, low]
        span[0, i] = [width, high-low]
    side = TILE * 2
    rgba = np.zeros((side*2, side*2, 4), np.uint8)
    depth = np.full(rgba.shape[:2], -1e9, np.float32)
    light = (.93 + .12 * normals[:, 1] + .08 * normals[:, 0]).astype(np.float32)
    stamp(tri, pos, uv, light, np.zeros(len(tri), np.int32), lower, span,
          rgba, depth, texture, alpha, 2, 4, axes)
    for i in range(3):
        x, y = (i % 2)*side, (i//2)*side
        yield Image.fromarray(rgba[y:y+side, x:x+side]).resize((TILE-4, TILE-4), Image.Resampling.LANCZOS)


def main():
    atlas = Image.new("RGBA", (4*TILE, 4*TILE))
    def place(i, img):
        atlas.paste(img, ((i % 4)*TILE+2, (i//4)*TILE+2))

    shrub, color, mask = source("shrub_04")
    mesh = shrub(0)
    # This glTF contains four specimens laid out side by side in one mesh.
    x = mesh[0][mesh[3], 0].mean(axis=1)
    for i, (left, right) in enumerate([(-1, -.415), (-.415, -.252), (-.252, -.116)]):
        for k, img in enumerate(projections(mesh, color, mask, [.4, 1.9, 3.5], (x>left) & (x<=right))):
            place(i*3+k, img)
    grass, blades, opacity = source("grass_medium_01")
    for i, model in enumerate([2, 8, 9]):
        place(9+i, next(projections(grass(model), blades, opacity, [.6+i, 2, 4])))
    leaves = Image.fromarray(color).convert("RGBA")
    leaves.putalpha(Image.fromarray(mask))
    for i, box in enumerate([(133,99,231,330), (238,654,339,941), (383,714,493,952)]):
        blade = leaves.crop(box).resize((TILE-4,TILE-4),Image.Resampling.LANCZOS)
        if i == 2:
            # Neutral venation for the pink and violet papery bracts.
            luminance = blade.convert("L").point(lambda x: min(255, 70+x))
            blade = Image.merge("RGBA", (luminance,luminance,luminance,blade.getchannel("A")))
        place(12+i, blade)
    _, grass_color, grass_mask = source("grass_medium_02")
    # Unwrap an individual scanned blade along its midrib. Its runtime mesh
    # supplies the physical taper, fold and arch of each ornamental grass.
    x0, y0, x1, y1 = 368, 237, 418, 744
    scan = np.asarray(Image.fromarray(grass_color).convert("L"))
    ribbon = []
    for y in range(y0, y1):
        xs = np.flatnonzero(grass_mask[y,x0:x1] > 140) + x0
        if xs.size:
            ribbon.append(np.interp(np.linspace(xs[0],xs[-1],84),xs,scan[y,xs]))
    strip = Image.fromarray(np.clip(1.38*(np.array(ribbon)-100)+173,72,243).astype("uint8")).convert("RGBA")
    tile = Image.new("RGBA",(TILE-4,TILE-4),"white")
    tile.paste(strip.resize((124,TILE-4), Image.Resampling.LANCZOS))
    place(15, tile)
    # Bleed the nearest leaf pigment into transparent texels for clean minification.
    data = np.array(atlas)
    _, indices = distance_transform_edt(data[:,:,3] < 18, return_indices=True)
    data[:,:,:3] = data[indices[0],indices[1],:3]
    Image.fromarray(data).save(DEST, quality=93, exact=True, method=6)


if __name__ == "__main__":
    main()

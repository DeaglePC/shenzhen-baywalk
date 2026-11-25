"""Bake compact street shrubs and planted soil from the existing foliage photographs."""
from pathlib import Path
import random

from PIL import Image, ImageDraw, ImageOps
import numpy as np
from scipy.ndimage import distance_transform_edt

PUBLIC = Path(__file__).resolve().parents[1] / "public"
SIZE = 192
RESAMPLE = Image.Resampling.LANCZOS


def grass_fan(photo, seed):
    """Layer curved blades around a scanned grass tuft for the low planting row."""
    rng = random.Random(seed)
    side = SIZE * 3
    fan = Image.new("RGBA", (side, side))
    # Retain the photographed fine stems and seed heads above the arching leaves.
    fan.alpha_composite(photo.resize((round(side * .68), round(side * .90)), RESAMPLE),
                        (round(side * .16), round(side * .07)))
    draw = ImageDraw.Draw(fan)
    for blade in range(116):
        clump = blade % 5
        x0 = .23 + clump * .132 + rng.uniform(-.055, .055)
        y0 = .88 + rng.uniform(-.04, .085)
        reach = rng.uniform(-min(.38, x0-.03), min(.38, .97-x0))
        height = rng.uniform(.31, .77) * (1 - .22 * abs(reach) / .38)
        droop = abs(reach) * rng.uniform(.44, 1.24)
        width = rng.uniform(.005, .012)
        color = np.array(rng.choice([(78, 103, 49), (89, 109, 54), (99, 123, 58),
                                     (111, 129, 69), (90, 110, 61), (140, 135, 81)]))
        previous = None
        for t in np.linspace(0, 1, 13):
            x = x0 + reach * t ** 1.52
            y = y0 - height * (2 * t - t * t) + droop * t ** 2.6
            w = width * (.52 + .48 * np.sin(np.pi * t)) * (1 - t ** 2)
            row = [(round((x-w)*side), round(y*side)), (round(x*side), round((y-w*.20)*side)),
                   (round((x+w)*side), round(y*side))]
            if previous:
                for col, fold in enumerate([.90, 1.06]):
                    rgb = tuple((color * (.61 + .46*t) * fold).astype(int))
                    draw.polygon([previous[col], previous[col+1], row[col+1], row[col]], fill=rgb)
            previous = row
    return fan.resize((SIZE, SIZE), RESAMPLE)


def main():
    src = Image.open(PUBLIC / "foliage/understory.webp").convert("RGBA")
    atlas = src.resize((SIZE * 4, SIZE * 4), RESAMPLE)
    shoots = [src.crop((i % 4 * 256, i // 4 * 256, i % 4 * 256 + 256, i // 4 * 256 + 256))
              for i in range(9)]
    # Three photos of rooted grass fans share the shrub atlas and its draw call.
    for tile in range(3, 6):
        grass_tile = tile + 6
        x, y = grass_tile % 4 * 256, grass_tile // 4 * 256
        tuft = grass_fan(src.crop((x, y, x + 256, y + 256)), 1069 + tile)
        atlas.paste(tuft, (tile % 4 * SIZE, tile // 4 * SIZE))
    rng = random.Random(3491)
    for tile in range(9, 12):
        # Paint on an oversized canvas so no straight tile edge cuts a branch.
        bed = Image.new("RGBA", (SIZE * 2, SIZE * 2))
        for _ in range(21):
            x = rng.uniform(.11, .89)
            y = rng.uniform(.80, .96)
            height = (.45 + .42 * (1 - abs(2 * x - 1))) * rng.uniform(.69, 1.11)
            h = round(SIZE * height)
            shoot = rng.choice(shoots).resize((round(h * rng.uniform(.64, 1.02)), h), RESAMPLE)
            shoot = shoot.rotate(rng.uniform(-32, 32), Image.Resampling.BICUBIC, expand=True)
            bed.alpha_composite(shoot, (round((x + .5) * SIZE - shoot.width / 2),
                                        round((y + .5) * SIZE - shoot.height)))
        bed = bed.crop(bed.getbbox()).resize((SIZE - 6, SIZE - 6), RESAMPLE)
        panel = Image.new("RGBA", (SIZE, SIZE))
        panel.paste(bed, (3, 3))
        atlas.paste(panel, (tile % 4 * SIZE, tile // 4 * SIZE))

    # Exposed soil, including a few fallen leaves, occupies the last tile.
    turf = Image.open(PUBLIC / "city/grass.webp").convert("RGB").resize((SIZE, SIZE), RESAMPLE)
    ground = ImageOps.autocontrast(turf.convert("L"))
    soil = ImageOps.colorize(ground, "#281f19", "#997c54")
    cover = ground.point(lambda value: max(0, min(255, (value - 48) * 3)))
    soil = Image.composite(turf, soil, cover).convert("RGBA")
    blade = src.crop((2 * 256, 3 * 256, 3 * 256, 4 * 256))
    for _ in range(15):
        w = rng.randrange(3, 7)
        fallen = blade.resize((w, w * 3), RESAMPLE).rotate(rng.randrange(360), expand=True)
        leaf = Image.new("RGBA", fallen.size, rng.choice(("#836341", "#695333", "#715443")))
        leaf.putalpha(fallen.getchannel("A"))
        soil.alpha_composite(leaf, (rng.randrange(SIZE), rng.randrange(SIZE)))
    soil.paste("white", (int(SIZE * .81), int(SIZE * .47), int(SIZE * .87), int(SIZE * .53)))
    # A narrow scan of a single blade supplies the midrib for the close mesh.
    ribbon = src.crop((770, 770, 888, 1022)).resize((int(SIZE * .13), SIZE), RESAMPLE)
    soil.paste(ribbon, (int(SIZE * .87), 0))
    atlas.paste(soil, (3 * SIZE, 3 * SIZE))
    rgba = np.array(atlas)
    _, nearest = distance_transform_edt(rgba[:, :, 3] < 18, return_indices=True)
    rgba[:, :, :3] = rgba[nearest[0], nearest[1], :3]
    Image.fromarray(rgba).save(PUBLIC / "foliage/street-understory.webp", quality=92, exact=True, method=6)


if __name__ == "__main__":
    main()

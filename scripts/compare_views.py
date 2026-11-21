"""Check the matched capture records and put the photographed frames side by side."""
import argparse
import json
from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFont


def pairs(directory, font):
    def record(version):
        return json.loads((directory / f"camera-{version}.json").read_text(encoding="utf8"))

    before, after = record("before"), record("after")
    if before != after or [r["view"] for r in before] != ["bridge", "street"]:
        raise ValueError("The camera, light preset, simulation tick or capture device changed")
    label = ImageFont.truetype(str(font), 26)
    small = ImageFont.truetype(str(font), 22)
    regions = {
        "bridge": ((790, 603), "局部原图  /  春笋幕墙、湖岸与倒影"),
        "street": ((787, 804), "局部原图  /  车门、轮毂与路面"),
    }
    panel_width, panel_height, gap, crop_height = 1120, 630, 6, 350
    for view, ((x, y), title) in regions.items():
        photos = [Image.open(directory / f"{view}-{v}.png").convert("RGB") for v in ("before", "after")]
        if any(p.size != (2560, 1440) for p in photos) or not ImageChops.difference(*photos).getbbox():
            raise ValueError(f"Unexpected or duplicate source image for {view}")
        canvas = Image.new("RGB", (panel_width * 2 + gap, 47 + panel_height + 44 + crop_height), "#161d20")
        draw = ImageDraw.Draw(canvas)
        for i, (photo, name) in enumerate(zip(photos, ("优化前", "优化后"))):
            left = i * (panel_width + gap)
            draw.text((left + 15, 4), name, fill=("#edeae5", "#ffb17c")[i], font=label)
            canvas.paste(photo.resize((panel_width, panel_height), Image.Resampling.LANCZOS), (left, 47))
            draw.text((left + 15, 47 + panel_height + 5), title, fill="#d7d9d1", font=small)
            canvas.paste(photo.crop((x, y, x+panel_width, y+crop_height)), (left, 47 + panel_height + 44))
        canvas.save(directory / f"{view}-pair.jpg", quality=94, subsampling=0, optimize=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("directory", type=Path)
    parser.add_argument("--font", type=Path, default=Path("C:/Windows/Fonts/msyh.ttc"))
    args = parser.parse_args()
    pairs(args.directory, args.font)

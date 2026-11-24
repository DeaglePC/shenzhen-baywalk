"""Fetch the pinned CC BY 4.0 traffic pack and prepare its paint and plate artwork.

    python scripts/traffic_art.py <asset-cache>
    blender -b -P scripts/traffic_import.py -- <asset-cache>
"""
from pathlib import Path
import sys
from urllib.request import urlopen
from time import sleep

import numpy as np
from PIL import Image

from e6_pengcheng_livery import registration_plate

REV = "92be5975162ff9348c96d76dd6077321dce013dc"
REPO = "TUM-VT/Sumonity-PassengerCars"
# FBX, body texture, rim texture, paint brightness, fictional registration.
CARS = [
    ("suv", "SUVBlack", "wheel_E_Diffuse", 29, "BK6273"),
    ("multivan", "MinivanRed", "wheel_D_Diffuse", 95, "BH3906"),
    ("sedan", "SedanYellow", "Wheel_A_Diffuse", 159, "BM5802"),
    ("hatchback", "HatchbackYellow", "wheel_B_Diffuse", 255, "BS2618"),
]


def fetch(folder, path, lfs=True):
    dest = folder / Path(path).name
    if dest.exists() and dest.stat().st_size > 150:
        return dest
    host = "media.githubusercontent.com/media" if lfs else "raw.githubusercontent.com"
    url = f"https://{host}/{REPO}/{REV}/{path}"
    for attempt in range(3):
        try:
            with urlopen(url, timeout=45) as response:
                contents = response.read()
            if contents.startswith(b"version https://git-lfs"):
                raise ValueError(f"Expected binary at {url}")
            dest.write_bytes(contents)
            return dest
        except OSError:
            if attempt == 2:
                raise
            sleep(1 + attempt)


def prepare(folder):
    folder.mkdir(parents=True, exist_ok=True)
    fetch(folder, "textures/lights.jpg", False)
    for f in ("LICENSE.txt", "README.md"):
        fetch(folder, f, False)
    registration_plate("BD03726").save(folder / "highland-plate.png")
    colours = {"suv": (86,102,113), "multivan": (121,78,89),
               "sedan": (165,65,67), "hatchback": (80,141,152)}
    for car, body, wheel, level, number in CARS:
        fetch(folder, "models/import/" + car + ".fbx")
        atlas = Image.open(fetch(folder, "textures/" + body + ".png")).convert("RGB")
        atlas = np.asarray(atlas.resize((1024, 1024), Image.Resampling.LANCZOS))
        red, green, blue = atlas.astype(float).transpose(2, 0, 1)
        if car == "suv":
            metallic = Image.open(fetch(folder, "textures/SUV_Metallic.png")).convert("L")
            metal = np.asarray(metallic.resize((1024, 1024)), dtype=float)
            mask = np.clip((55-red)/16,0,1) * np.clip((42-metal)/36,0,1)
            # The author's black paint is at 29/255. Recover the baked panel
            # shading continuously, including the reflections on the doors.
            shade = np.clip(red/level,0,1.2)**.84
        else:
            mask = np.clip((red-blue-3)/9,0,1) * np.clip((red/np.maximum(green,1)-.88)/.10,0,1)
            shade = np.clip(red/level,0,1.2)**.82
        colour = np.array(colours[car])[None,None,:] * shade[:,:,None]
        rgb = atlas*(1-mask[:,:,None]) + colour*mask[:,:,None]
        # glTF uses an opaque material. Its unused alpha channel carries the
        # repaint mask, keeping glass, chrome, headlights and plate ink intact.
        rgba = np.dstack((rgb,mask*255)).clip(0,255).astype("uint8")
        Image.fromarray(rgba).save(folder / (car + "-body.png"),optimize=True)
        rim = Image.open(fetch(folder, "textures/" + wheel + ".png")).convert("RGB")
        rim.resize((512, 512), Image.Resampling.LANCZOS).save(folder / (car + "-wheel.jpg"), quality=92)
        registration_plate(number, electric=False).resize((660, 210), Image.Resampling.LANCZOS).save(folder / (car + "-plate.png"))


if __name__ == "__main__":
    prepare(Path(sys.argv[1]))

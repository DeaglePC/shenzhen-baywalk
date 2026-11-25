"""Bake ground-level pedestrian aprons against the same OSM outlines as the city."""
import json
import struct
from pathlib import Path

import numpy as np
import shapely
from shapely.geometry import LineString, Polygon, box

DATA = Path(__file__).resolve().parents[1] / "public/data"
# Width behind each carriageway edge. The wider avenues have space for both
# a planting strip and a through sidewalk. Service lanes have a narrow apron.
WIDTHS = {"primary": 10, "secondary": 8, "tertiary": 7, "residential": 5,
          "unclassified": 4, "living_street": 4, "service": 2}
BUILT_LAND = {"residential", "commercial", "retail", "industrial", "institutional"}


def build(data):
    aprons, cycling, excluded = [], [], []
    for road in data["roads"]:
        if road.get("bridge") or road.get("layer") or road.get("tunnel") or len(road["p"]) < 2:
            continue
        kind = road["kind"]
        line = LineString(road["p"])
        half = road.get("width", 6) / 2
        if kind == "cycleway":
            cycling.append(line.buffer(half + 2.3, quad_segs=2))
        if kind in WIDTHS:
            aprons.append(line.buffer(half + WIDTHS[kind], quad_segs=2, join_style="mitre", mitre_limit=2))
        # Keep the original pedestrian/cycle surface. A small underlap meets
        # its bevelled corners without exposing a sliver of the satellite layer.
        inset = .12 if kind in {"path", "footway", "pedestrian", "steps", "cycleway"} else 0
        excluded.append(line.buffer(max(.1, half - inset), quad_segs=2, join_style="mitre", mitre_limit=2))

    for feature in [*data["water"], *data["buildings"], *data["decks"],
                    *(f for f in data["land"] if f["kind"] not in BUILT_LAND)]:
        excluded.append(shapely.make_valid(Polygon(feature["p"], feature.get("holes"))))
    streets = shapely.union_all(aprons, grid_size=.05)
    # Complete the back edge of cycle paths only where they flank a street.
    streets |= shapely.union_all(cycling, grid_size=.05).intersection(streets.buffer(3))
    extent = data["extent"]
    space = (streets & box(-extent, -extent, extent, extent)).difference(shapely.union_all(excluded))
    space = shapely.set_precision(space, .1)

    triangles = []
    for poly in shapely.get_parts(space):
        if poly.geom_type != "Polygon" or poly.area < .10:
            continue
        for tri in shapely.get_parts(shapely.constrained_delaunay_triangles(poly)):
            coords = list(tri.exterior.coords)[:3]
            # World X/Z winding for an upward normal.
            triangles.append(coords[::-1] if tri.exterior.is_ccw else coords)
    coords = np.rint(np.array(triangles) * 10)
    assert abs(coords).max() <= 32767
    return coords.astype("<i2")


if __name__ == "__main__":
    data = json.loads((DATA / "shenzhen.json").read_text(encoding="utf8"))
    triangles = build(data)
    # Independently cullable district patches. Each record stores two counts,
    # signed decimetre X/Z positions, then uint16 indices into those positions.
    tiles = np.floor(triangles.mean(axis=1) / 12800).astype(int)
    path = DATA / "roadside-paving.bin"
    with path.open("wb") as out:
        for key in np.unique(tiles, axis=0):
            batch = triangles[(tiles == key).all(axis=1)].reshape(-1, 2)
            vertices, indices = np.unique(batch, axis=0, return_inverse=True)
            assert len(vertices) < 65536
            out.write(struct.pack("<II", len(vertices), len(indices)))
            out.write(vertices.astype("<i2").tobytes())
            out.write(indices.astype("<u2").tobytes())
    print(f"{len(triangles):,} sidewalk triangles, {path.stat().st_size:,} bytes")

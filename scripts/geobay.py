"""Rebuild the visible Deep Bay bridge axes and shoreline outside the walking map."""
import json
from pathlib import Path
import requests
from shapely.geometry import LineString, Point, box
from shapely.ops import linemerge, polygonize, unary_union
import geodata as geo

def build(elements):
    nodes = {v["id"]: geo.project(v["lon"], v["lat"]) for v in elements if v["type"] == "node"}
    ways = {v["id"]: v for v in elements if v["type"] == "way"}
    def line(w):
        return LineString([nodes[i] for i in w["nodes"]])
    sea_window = box(-3200, 0, 5350, 7800).difference(geo.WINDOW)
    axis_window = box(-3200, 3200, 5350, 7800)
    axes = []
    for ids in [(276506946, 568424506), (568424517, 1164423108, 161557691)]:
        path = linemerge([line(ways[i]) for i in ids]).intersection(axis_window)
        coords = geo.coords(path.simplify(.5).coords)
        axes.append(coords if coords[0][1] < coords[-1][1] else coords[::-1])
    shore = [line(w).intersection(sea_window) for w in ways.values()
             if w.get("tags", {}).get("natural") == "coastline" and all(i in nodes for i in w["nodes"])]
    faces = polygonize(unary_union([sea_window.boundary, *shore]))
    sea = next(p for p in faces if p.contains(Point(800, 3400)))
    return {"axes": axes, "sea": geo.ring_fields(sea.simplify(4))}

if __name__ == "__main__":
    url = "https://api.openstreetmap.org/api/0.6/map.json?bbox=113.945,22.438,113.989,22.486"
    response = requests.get(url, timeout=90)
    response.raise_for_status()
    local = geo.fetch()
    elements = [*local["node"].values(), *local["way"].values(), *response.json()["elements"]]
    target = Path(__file__).resolve().parents[1] / "src" / "bay-crossing.json"
    target.write_text(json.dumps(build(elements), separators=(",", ":")) + "\n", encoding="utf8")

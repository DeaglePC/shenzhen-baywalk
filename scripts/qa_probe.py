"""
QA Capture, Performance Probe & Image-Diff Client for Shenzhen Baywalk.

Modes:
1. Daemon mode (fast ~1-2s per shot): connects to a running `scripts/qa_daemon.py`.
2. Standalone mode (`--standalone`): runs directly in one self-contained session against a target URL.
3. Image diff (`--diff imgA imgB`): computes MAE/RMSE and optionally writes a diff heatmap.

Examples:
  python scripts/qa_probe.py --standalone --url http://127.0.0.1:4173/?walk=bridge&qa=1 --out .qa/upgrade
  python scripts/qa_probe.py --daemon http://127.0.0.1:9455 --out .qa/upgrade
  python scripts/qa_probe.py --diff before.jpg after.jpg --diff-out diff.png
"""
from __future__ import annotations

import argparse
import json
import sys
import urllib.request
from pathlib import Path

PRESET_SHOTS = [
    {
        "name": "skyline-sunset",
        "period": "sunset",
        "weather": "clear",
        "eye": [213.6, 3.6, 143.5],
        "target": [-263.3, 62.0, -456.8],
        "fov": 64,
        "settleMs": 450,
    },
    {
        "name": "skyline-night",
        "period": "night",
        "weather": "clear",
        "eye": [364.0, 17.0, 86.0],
        "target": [-240.0, 128.0, -178.0],
        "fov": 44,
        "settleMs": 450,
    },
    {
        "name": "day-clouds",
        "period": "day",
        "weather": "clear",
        "eye": [486.0, 165.0, -490.0],
        "target": [-140.0, 18.0, -60.0],
        "fov": 54,
        "settleMs": 450,
    },
    {
        "name": "peacock-closeup",
        "period": "day",
        "weather": "clear",
        "focusObject": "孔雀亭",
        "focusOffset": [2.2, 1.8, 3.8],
        "fov": 46,
        "settleMs": 450,
    },
    {
        "name": "handheart-closeup",
        "period": "day",
        "weather": "clear",
        "focusObject": "红·蓝马甲",
        "focusOffset": [0.9, 1.7, 4.6],
        "fov": 46,
        "settleMs": 450,
    },
]


def post_json(url: str, payload: dict) -> dict:
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode("utf-8"))


def compute_diff(path_a: str, path_b: str, diff_out: str | None = None) -> dict:
    try:
        from PIL import Image, ImageChops
    except ImportError:
        return {"ok": False, "error": "Pillow (PIL) is not installed; install pillow for image-diff."}
    im_a = Image.open(path_a).convert("RGB")
    im_b = Image.open(path_b).convert("RGB")
    if im_a.size != im_b.size:
        im_b = im_b.resize(im_a.size)
    diff = ImageChops.difference(im_a, im_b)
    pixels = list(diff.getdata())
    n = len(pixels) * 3
    mae = sum(r + g + b for r, g, b in pixels) / max(1, n)
    mse = sum(r * r + g * g + b * b for r, g, b in pixels) / max(1, n)
    rmse = mse ** 0.5
    if diff_out:
        amplified = diff.point(lambda v: min(255, v * 4))
        Path(diff_out).parent.mkdir(parents=True, exist_ok=True)
        amplified.save(diff_out)
    return {"ok": True, "mae": round(mae, 3), "rmse": round(rmse, 3), "diffOut": diff_out}


def run_suite(exec_fn, out_dir: Path, shot_names: list[str] | None, perf_frames: int, custom_shots: list[dict] | None = None) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)
    source = custom_shots if custom_shots is not None else PRESET_SHOTS
    shots = source if not shot_names else [s for s in source if s["name"] in shot_names]
    report = {"shots": [], "errors": []}
    for shot in shots:
        payload = {**shot, "out": str(out_dir / f"{shot['name']}.jpg"), "perfFrames": perf_frames}
        res = exec_fn(payload)
        report["shots"].append({"name": shot["name"], **res})
        for e in res.get("errors", []):
            if e not in report["errors"]:
                report["errors"].append(e)
        perf = res.get("perf", {})
        print(
            f"[{shot['name']:18s}] {res.get('elapsedMs', 0):6.1f}ms | "
            f"avg={perf.get('avgMs', '-')}ms p95={perf.get('p95Ms', '-')}ms "
            f"fps={perf.get('fps', '-')} calls={perf.get('calls', '-')} "
            f"tris={perf.get('triangles', '-')} dpr={perf.get('pixelRatio', '-')}",
            flush=True,
        )
    report_path = out_dir / "report.json"
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Report saved to {report_path} (errors: {len(report['errors'])})", flush=True)
    return report


def main():
    parser = argparse.ArgumentParser(description="Shenzhen Baywalk QA Capture & Perf Probe Client")
    parser.add_argument("--daemon", default="http://127.0.0.1:9455")
    parser.add_argument("--standalone", action="store_true")
    parser.add_argument("--url", default="http://127.0.0.1:4173/?walk=bridge&qa=1")
    parser.add_argument("--out", default=".qa/upgrade")
    parser.add_argument("--shots", nargs="*", help="Subset of preset shot names")
    parser.add_argument("--shots-file", default=None, help="JSON file containing custom shot definitions")
    parser.add_argument("--perf-frames", type=int, default=20)
    parser.add_argument("--width", type=int, default=1440)
    parser.add_argument("--height", type=int, default=810)
    parser.add_argument("--diff", nargs=2, metavar=("IMG_A", "IMG_B"))
    parser.add_argument("--diff-out", default=None)
    args = parser.parse_args()

    if args.diff:
        res = compute_diff(args.diff[0], args.diff[1], args.diff_out)
        print(json.dumps(res, ensure_ascii=False, indent=2))
        sys.exit(0 if res.get("ok") else 1)

    out_dir = Path(args.out)
    custom_shots = json.loads(Path(args.shots_file).read_text(encoding="utf-8")) if args.shots_file else None
    if args.standalone:
        from qa_daemon import BrowserWorker

        worker = BrowserWorker(args.url, args.width, args.height)
        worker.start()
        try:
            report = run_suite(lambda p: worker.call("capture", p), out_dir, args.shots, args.perf_frames, custom_shots)
        finally:
            worker.call("shutdown")
    else:
        base = args.daemon.rstrip("/")
        report = run_suite(lambda p: post_json(f"{base}/capture", p), out_dir, args.shots, args.perf_frames, custom_shots)

    if report["errors"]:
        print("ERRORS DETECTED:", report["errors"], file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

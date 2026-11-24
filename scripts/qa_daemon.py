"""
Persistent Headless-Chrome QA Capture & Performance Probe Daemon for Shenzhen Baywalk.
Inspired by Crimson Loong's tools/capd.mjs + perf.py workflow:
Keeps a single GPU-accelerated Chromium instance warm so multi-angle captures and
frame-cost probes execute in ~1-2 seconds instead of cold-booting every iteration.

Usage:
  python scripts/qa_daemon.py --url http://127.0.0.1:4173/?walk=bridge&qa=1 --port 9455
"""
from __future__ import annotations

import argparse
import http.server
import json
import os
import queue
import threading
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

CHROME_CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
]


def find_browser() -> str | None:
    for path in CHROME_CANDIDATES:
        if os.path.exists(path):
            return path
    return None


def ensure_qa_url(url: str) -> str:
    if "qa=" in url:
        return url
    sep = "&" if "?" in url else "?"
    return f"{url}{sep}qa=1"


class BrowserWorker:
    """Runs Playwright strictly on one thread and serves command requests from HTTP threads."""

    def __init__(self, url: str, width: int, height: int):
        self.url = ensure_qa_url(url)
        self.width = width
        self.height = height
        self.cmd_q: queue.Queue = queue.Queue()
        self.errors: list[str] = []
        self.ready = threading.Event()
        self.boot_error: str | None = None
        self._stop = False
        self.thread = threading.Thread(target=self._run, daemon=True)

    def start(self):
        self.thread.start()
        self.ready.wait()
        if self.boot_error:
            raise RuntimeError(self.boot_error)

    def call(self, action: str, payload: dict | None = None) -> dict:
        reply_q: queue.Queue = queue.Queue(maxsize=1)
        self.cmd_q.put((action, payload or {}, reply_q))
        return reply_q.get(timeout=120)

    def _boot_page(self, page):
        self.errors.clear()
        page.goto(self.url, wait_until="domcontentloaded")
        page.wait_for_function(
            "window.__baywalk && document.querySelector('#loading') && document.querySelector('#loading').hidden",
            timeout=130000,
        )
        page.add_style_tag(
            content="#topbar,#hud,#toast,#mouseCapture,#skyLoader{visibility:hidden!important}"
        )
        page.wait_for_timeout(350)

    def _apply_view(self, page, req: dict):
        period = req.get("period")
        weather = req.get("weather")
        season = req.get("season")
        if weather or season:
            patch = {}
            if weather:
                patch["weather"] = weather
            if season:
                patch["season"] = season
            page.evaluate("p => window.__baywalk.setClimate(p)", patch)
        if period:
            page.evaluate("k => window.__baywalk.setPeriod(k)", period)

        focus_obj = req.get("focusObject")
        if focus_obj:
            offset = req.get("focusOffset", [0, 1.5, 5.2])
            fov = req.get("fov", 52)
            ok = page.evaluate(
                """([name, offset, fov]) => {
                    const w = window.__baywalk;
                    const obj = w.city.root.getObjectByName(name);
                    if (!obj) return false;
                    obj.updateMatrixWorld(true);
                    const box = new obj.position.constructor();
                    // Compute world position + local forward basis
                    const center = obj.getWorldPosition(box);
                    const q = obj.getWorldQuaternion(new obj.quaternion.constructor());
                    const off = new obj.position.constructor(offset[0], offset[1], offset[2]).applyQuaternion(q);
                    const eye = center.clone().add(off);
                    const tgt = center.clone().add(new obj.position.constructor(0, offset[1] * 0.85, 0));
                    w.toggleDrone({ eye: eye.toArray(), target: tgt.toArray(), fov });
                    return true;
                }""",
                [focus_obj, offset, fov],
            )
            if not ok:
                raise RuntimeError(f"Object not found in city root: {focus_obj}")
        elif "eye" in req and "target" in req:
            fov = req.get("fov", 62)
            page.evaluate(
                "([eye, target, fov]) => window.__baywalk.toggleDrone({ eye, target, fov })",
                [req["eye"], req["target"], fov],
            )
        settle_ms = int(req.get("settleMs", 420))
        page.wait_for_timeout(settle_ms)

    def _sample_perf(self, page, sample_frames: int = 36) -> dict:
        return page.evaluate(
            """(n) => new Promise(resolve => {
                const samples = [];
                let last = performance.now();
                let left = Math.max(4, n);
                function step(now) {
                    samples.push(now - last);
                    last = now;
                    if (--left > 0) {
                        requestAnimationFrame(step);
                    } else {
                        samples.shift(); // drop first boundary delta
                        const sorted = [...samples].sort((a, b) => a - b);
                        const sum = sorted.reduce((a, b) => a + b, 0);
                        const avgMs = sum / Math.max(1, sorted.length);
                        const p50Ms = sorted[Math.floor(sorted.length * 0.5)] || avgMs;
                        const p95Ms = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] || avgMs;
                        const info = window.__baywalk.perfStats();
                        resolve({
                            frames: sorted.length,
                            avgMs: +avgMs.toFixed(2),
                            p50Ms: +p50Ms.toFixed(2),
                            p95Ms: +p95Ms.toFixed(2),
                            fps: +(1000 / Math.max(avgMs, 0.1)).toFixed(1),
                            ...info
                        });
                    }
                }
                requestAnimationFrame(step);
            })""",
            sample_frames,
        )

    def _run(self):
        exe = find_browser()
        launch_kwargs = {
            "headless": True,
            "args": [
                "--use-angle=d3d11",
                "--ignore-gpu-blocklist",
                "--enable-webgl",
            ],
        }
        if exe:
            launch_kwargs["executable_path"] = exe

        try:
            with sync_playwright() as pw:
                browser = pw.chromium.launch(**launch_kwargs)
                page = browser.new_page(viewport={"width": self.width, "height": self.height})
                page.set_default_timeout(130000)
                page.on("pageerror", lambda e: self.errors.append(f"pageerror: {e}"))
                page.on(
                    "console",
                    lambda m: self.errors.append(f"console.{m.type}: {m.text}")
                    if m.type == "error"
                    else None,
                )
                page.route("**/favicon.ico", lambda r: r.fulfill(status=204))
                self._boot_page(page)
                self.ready.set()

                while not self._stop:
                    try:
                        action, payload, reply_q = self.cmd_q.get(timeout=0.25)
                    except queue.Empty:
                        continue
                    try:
                        if action == "health":
                            res = {
                                "ok": True,
                                "url": self.url,
                                "errors": list(self.errors),
                                "perf": page.evaluate("() => window.__baywalk.perfStats()"),
                            }
                        elif action == "reload":
                            if payload.get("url"):
                                self.url = ensure_qa_url(payload["url"])
                            self._boot_page(page)
                            res = {"ok": True, "url": self.url, "errors": list(self.errors)}
                        elif action == "capture":
                            t0 = time.perf_counter()
                            self._apply_view(page, payload)
                            out_path = Path(payload["out"]).resolve()
                            out_path.parent.mkdir(parents=True, exist_ok=True)
                            ext = out_path.suffix.lower()
                            if ext in (".jpg", ".jpeg"):
                                page.screenshot(path=str(out_path), type="jpeg", quality=int(payload.get("quality", 90)))
                            else:
                                page.screenshot(path=str(out_path), type="png")
                            perf = self._sample_perf(page, int(payload.get("perfFrames", 16)))
                            res = {
                                "ok": True,
                                "out": str(out_path),
                                "elapsedMs": round((time.perf_counter() - t0) * 1000, 1),
                                "perf": perf,
                                "errors": list(self.errors),
                            }
                        elif action == "perf":
                            if any(k in payload for k in ("eye", "focusObject", "period", "weather")):
                                self._apply_view(page, payload)
                            perf = self._sample_perf(page, int(payload.get("frames", 40)))
                            res = {"ok": True, "perf": perf, "errors": list(self.errors)}
                        elif action == "shutdown":
                            self._stop = True
                            res = {"ok": True}
                        else:
                            res = {"ok": False, "error": f"Unknown action: {action}"}
                    except Exception as exc:
                        res = {"ok": False, "error": str(exc), "errors": list(self.errors)}
                    reply_q.put(res)
                browser.close()
        except Exception as exc:
            err_tail = "\n".join(self.errors[-10:])
            self.boot_error = f"{exc}\nConsole/Page errors:\n{err_tail}" if err_tail else str(exc)
            self.ready.set()


def make_handler(worker: BrowserWorker, shutdown_cb):
    class Handler(http.server.BaseHTTPRequestHandler):
        def log_message(self, fmt, *args):
            return

        def _send(self, code: int, obj: dict):
            data = json.dumps(obj, ensure_ascii=False).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            if self.path == "/health":
                self._send(200, worker.call("health"))
            else:
                self._send(404, {"ok": False, "error": "Not found"})

        def do_POST(self):
            length = int(self.headers.get("Content-Length", "0"))
            raw = self.rfile.read(length) if length else b"{}"
            try:
                payload = json.loads(raw.decode("utf-8"))
            except Exception:
                self._send(400, {"ok": False, "error": "Invalid JSON"})
                return
            action = self.path.lstrip("/")
            if action not in ("capture", "perf", "reload", "shutdown"):
                self._send(404, {"ok": False, "error": f"Unknown endpoint: {self.path}"})
                return
            res = worker.call(action, payload)
            self._send(200 if res.get("ok") else 500, res)
            if action == "shutdown":
                threading.Thread(target=shutdown_cb, daemon=True).start()

    return Handler


def main():
    parser = argparse.ArgumentParser(description="Persistent Headless-Chrome QA Daemon")
    parser.add_argument("--url", default="http://127.0.0.1:4173/?walk=bridge&qa=1")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=9455)
    parser.add_argument("--width", type=int, default=1440)
    parser.add_argument("--height", type=int, default=810)
    args = parser.parse_args()

    print(f"[qa_daemon] Booting warm Chromium for {args.url} ...", flush=True)
    worker = BrowserWorker(args.url, args.width, args.height)
    worker.start()
    server = http.server.ThreadingHTTPServer((args.host, args.port), make_handler(worker, lambda: server.shutdown()))
    print(f"[qa_daemon] Listening on http://{args.host}:{args.port} (ready)", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        worker.call("shutdown")
        server.server_close()


if __name__ == "__main__":
    main()

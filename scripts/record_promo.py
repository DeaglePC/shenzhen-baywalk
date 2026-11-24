"""Capture high-resolution promotional stills and smooth 1080p promotional videos
for Shenzhen Baywalk (深圳漫游 · BAYWALK) using Playwright + GPU Chrome + ffmpeg.

Usage:
  python scripts/record_promo.py --url http://127.0.0.1:4177 --out ../宣传素材 --mode stills
  python scripts/record_promo.py --url http://127.0.0.1:4177 --out ../宣传素材 --mode videos
  python scripts/record_promo.py --url http://127.0.0.1:4177 --out ../宣传素材 --mode all
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

CHROME_CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
]


def find_browser() -> str:
    for path in CHROME_CANDIDATES:
        if os.path.exists(path):
            return path
    raise FileNotFoundError("Chrome or Edge executable not found.")


def find_ffmpeg() -> str:
    found = shutil.which("ffmpeg")
    if found:
        return found
    for cand in [r"E:\APPS\ffmpeg\bin\ffmpeg.exe", r"C:\ffmpeg\bin\ffmpeg.exe"]:
        if os.path.exists(cand):
            return cand
    raise FileNotFoundError("ffmpeg executable not found.")


def launch_browser(p):
    return p.chromium.launch(
        executable_path=find_browser(),
        headless=True,
        args=[
            "--use-angle=d3d11",
            "--ignore-gpu-blocklist",
            "--disable-renderer-backgrounding",
            "--disable-background-timer-throttling",
        ],
    )


def boot_world(page, url: str, clean_hud: bool = True):
    page.goto(url, wait_until="domcontentloaded")
    page.wait_for_function(
        "window.__baywalk && document.querySelector('#loading') && document.querySelector('#loading').hidden",
        timeout=130000,
    )
    if clean_hud:
        page.add_style_tag(
            content="#topbar,#hud,#toast,#mouseCapture,#skyLoader,#restoreHud{visibility:hidden!important}"
        )
    else:
        page.add_style_tag(
            content="#toast,#mouseCapture,#skyLoader{visibility:hidden!important}"
        )
    page.wait_for_timeout(450)


def apply_environment(page, period: str, weather: str = "clear", season: str = "summer", headlights: bool | None = None):
    page.evaluate(
        """async ([period, weather, season, headlights]) => {
            const w = window.__baywalk;
            await w.setClimate({ weather, season }, '', { immediate: true });
            if (weather !== 'aurora' && period) {
                await w.setPeriod(period, '', { immediate: true });
            }
            if (headlights !== null && w.setHeadlightsMode) {
                w.setHeadlightsMode(headlights ? 'on' : 'auto');
            }
        }""",
        [period, weather, season, headlights],
    )
    page.wait_for_timeout(350)


def warm_frames(page, count: int = 12, dt: float = 1 / 30):
    page.evaluate(
        """([count, dt]) => {
            const w = window.__baywalk;
            for (let i = 0; i < count; i++) w.stepFrame(dt);
        }""",
        [count, dt],
    )
    page.wait_for_timeout(80)


STILL_SHOTS = [
    {
        "file": "01-星光桥与后海天际线-日落全景.png",
        "period": "sunset",
        "weather": "clear",
        "season": "summer",
        "tour": ("bay-grand", 0.0),
    },
    {
        "file": "02-人才湖全城联动灯光秀-夜景.png",
        "period": "night",
        "weather": "clear",
        "season": "summer",
        "headlights": True,
        "tour": ("lake-lightshow", 0.13),
        "warm": 45,
    },
    {
        "file": "03-春笋与春茧高空航拍-午后.png",
        "period": "day",
        "weather": "clear",
        "season": "summer",
        "tour": ("bay-grand", 0.375),
    },
    {
        "file": "04-深圳湾一号与人才湖-蓝调时刻.png",
        "period": "dusk",
        "weather": "clear",
        "season": "summer",
        "headlights": True,
        "tour": ("bay-grand", 0.74),
    },
    {
        "file": "05-腾讯滨海大厦双塔连廊-午后航拍.png",
        "period": "day",
        "weather": "clear",
        "season": "summer",
        "tour": ("tech-skyline", 0.0),
    },
    {
        "file": "06-人才湖极光冬雪夜景.png",
        "period": "night",
        "weather": "aurora",
        "season": "winter",
        "headlights": True,
        "eye": [228, 26, 165],
        "target": [-235, 115, -330],
        "fov": 54,
        "warm": 40,
    },
    {
        "file": "07-登良路街头实景-深圳出租车与车流.png",
        "period": "day",
        "weather": "clear",
        "season": "summer",
        "eye": [-115.5, 2.35, -412.0],
        "target": [-188.0, 2.6, -448.0],
        "fov": 56,
        "warm": 50,
    },
]


def build_collage(stills_dir: Path):
    try:
        from PIL import Image, ImageDraw
    except ImportError:
        print("Pillow not installed; skipping 2x2 collage.")
        return
    picks = [
        stills_dir / "01-星光桥与后海天际线-日落全景.png",
        stills_dir / "02-人才湖全城联动灯光秀-夜景.png",
        stills_dir / "03-春笋与春茧高空航拍-午后.png",
        stills_dir / "06-人才湖极光冬雪夜景.png",
    ]
    if not all(p.exists() for p in picks):
        return
    tw, th = 1280, 720
    gap = 12
    canvas = Image.new("RGB", (tw * 2 + gap * 3, th * 2 + gap * 3), (18, 23, 25))
    positions = [
        (gap, gap),
        (tw + gap * 2, gap),
        (gap, th + gap * 2),
        (tw + gap * 2, th + gap * 2),
    ]
    for p, pos in zip(picks, positions):
        im = Image.open(p).convert("RGB").resize((tw, th), Image.Resampling.LANCZOS)
        canvas.paste(im, pos)
    out = stills_dir / "00-深圳漫游四景宣传拼图.jpg"
    canvas.save(out, quality=94, subsampling=0)
    print(f"Saved collage: {out}")


def capture_stills(base_url: str, out_root: Path):
    stills_dir = out_root / "宣传图"
    stills_dir.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as p:
        browser = launch_browser(p)
        # 1. Clean 2560x1440 hero stills
        page = browser.new_page(viewport={"width": 2560, "height": 1440}, device_scale_factor=1)
        boot_world(page, f"{base_url}/?tour=bay-grand&qa=1", clean_hud=True)
        page.evaluate("window.__baywalk.setManualClock(true)")
        for shot in STILL_SHOTS:
            t0 = time.time()
            apply_environment(
                page,
                shot["period"],
                shot.get("weather", "clear"),
                shot.get("season", "summer"),
                shot.get("headlights", None),
            )
            if "tour" in shot:
                route_id, u = shot["tour"]
                page.evaluate(
                    """([routeId, u]) => {
                        const w = window.__baywalk;
                        w.startTour(routeId, { progress: u });
                        w.setTourPaused(true);
                        w.setTourProgress(u);
                    }""",
                    [route_id, u],
                )
            else:
                page.evaluate(
                    """([eye, target, fov]) => {
                        const w = window.__baywalk;
                        if (w.touring) w.stopTour();
                        w.toggleDrone({ eye, target, fov });
                    }""",
                    [shot["eye"], shot["target"], shot.get("fov", 54)],
                )
            warm_frames(page, shot.get("warm", 18))
            dest = stills_dir / shot["file"]
            page.screenshot(path=str(dest), type="png", animations="disabled")
            print(f"[STILL] {dest.name} ({time.time() - t0:.1f}s)")
        page.close()

        # 2. UI Feature Showcase screenshot (1920x1080 with real Auto Drone Tour HUD visible)
        ui_page = browser.new_page(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
        boot_world(ui_page, f"{base_url}/?tour=bay-grand&qa=1", clean_hud=False)
        ui_page.evaluate(
            """() => {
                const w = window.__baywalk;
                w.setManualClock(true);
                w.startTour('bay-grand', { progress: 0.04 });
                w.setTourPaused(false);
                w.setTourProgress(0.04);
                for (let i = 0; i < 16; i++) w.stepFrame(1 / 30);
            }"""
        )
        ui_page.wait_for_timeout(350)
        ui_dest = stills_dir / "08-自动无人机巡航界面实机展示.png"
        ui_page.screenshot(path=str(ui_dest), type="png")
        print(f"[STILL] {ui_dest.name}")
        ui_page.close()
        browser.close()

    build_collage(stills_dir)


def record_clip(
    page,
    ffmpeg_bin: str,
    output_mp4: Path,
    fps: int,
    duration_sec: float,
    route_id: str,
    u_start: float,
    u_end: float,
    period: str,
    weather: str = "clear",
    season: str = "summer",
    headlights: bool | None = None,
    warm: int = 20,
    fade_in: float = 0.65,
    fade_out: float = 0.65,
):
    total_frames = int(round(duration_sec * fps))
    dt = 1.0 / fps
    apply_environment(page, period, weather, season, headlights)
    page.evaluate(
        """([routeId, uStart]) => {
            const w = window.__baywalk;
            w.setManualClock(true);
            w.startTour(routeId, { progress: uStart });
            w.setTourPaused(true);
            w.setTourProgress(uStart);
        }""",
        [route_id, u_start],
    )
    warm_frames(page, warm, dt)

    vf_parts = ["scale=in_range=full:out_range=tv,format=yuv420p"]
    if fade_in > 0:
        vf_parts.append(f"fade=t=in:st=0:d={fade_in:.2f}")
    if fade_out > 0:
        vf_parts.append(f"fade=t=out:st={max(0.1, duration_sec - fade_out):.2f}:d={fade_out:.2f}")
    cmd = [
        ffmpeg_bin,
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "image2pipe",
        "-vcodec",
        "mjpeg",
        "-r",
        str(fps),
        "-i",
        "-",
    ]
    if vf_parts:
        cmd.extend(["-vf", ",".join(vf_parts)])
    cmd.extend([
        "-c:v",
        "libx264",
        "-profile:v",
        "high",
        "-level:v",
        "4.1",
        "-preset",
        "medium",
        "-crf",
        "19",
        "-pix_fmt",
        "yuv420p",
        "-color_range",
        "tv",
        "-colorspace",
        "bt709",
        "-color_primaries",
        "bt709",
        "-color_trc",
        "bt709",
        "-movflags",
        "+faststart",
        str(output_mp4),
    ])
    err_log = output_mp4.with_suffix(".ffmpeg.log")
    with open(err_log, "wb") as err_f:
        proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stdout=subprocess.DEVNULL, stderr=err_f)
        t0 = time.time()
        try:
            for i in range(total_frames):
                frac = i / max(1, total_frames - 1)
                u = (u_start + (u_end - u_start) * frac) % 1.0
                page.evaluate(
                    """([u, dt]) => {
                        const w = window.__baywalk;
                        w.setTourProgress(u);
                        w.stepFrame(dt);
                    }""",
                    [u, dt],
                )
                jpg = page.screenshot(type="jpeg", quality=93, animations="disabled")
                proc.stdin.write(jpg)
                if (i + 1) % 120 == 0 or i + 1 == total_frames:
                    elapsed = time.time() - t0
                    print(f"  {output_mp4.name}: {i + 1}/{total_frames} frames ({elapsed:.1f}s)", flush=True)
            proc.stdin.close()
            ret = proc.wait()
        finally:
            if proc.poll() is None:
                proc.kill()
    if ret != 0:
        err = err_log.read_text(encoding="utf-8", errors="replace")
        raise RuntimeError(f"ffmpeg failed ({ret}): {err}")
    err_log.unlink(missing_ok=True)
    print(f"[VIDEO] Saved {output_mp4.name} ({output_mp4.stat().st_size / (1024*1024):.1f} MB)", flush=True)


def concat_with_xfade(ffmpeg_bin: str, clips: list[Path], output_mp4: Path, clip_durations: list[float], xfade: float = 0.75):
    assert len(clips) == len(clip_durations) and len(clips) >= 2
    cmd = [ffmpeg_bin, "-y"]
    for c in clips:
        cmd.extend(["-i", str(c)])
    filters = []
    cur = "[0:v]"
    offset = clip_durations[0] - xfade
    for idx in range(1, len(clips)):
        out_tag = f"[v{idx}]" if idx < len(clips) - 1 else "[vout]"
        filters.append(f"{cur}[{idx}:v]xfade=transition=fade:duration={xfade:.2f}:offset={offset:.2f}{out_tag}")
        cur = out_tag
        offset += clip_durations[idx] - xfade
    cmd.extend([
        "-filter_complex",
        ";".join(filters),
        "-map",
        "[vout]",
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "19",
        "-pix_fmt",
        "yuv420p",
        "-movflags",
        "+faststart",
        str(output_mp4),
    ])
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"ffmpeg xfade failed: {res.stderr}")
    print(f"[VIDEO] Combined montage {output_mp4.name} ({output_mp4.stat().st_size / (1024*1024):.1f} MB)", flush=True)


def record_videos(base_url: str, out_root: Path):
    videos_dir = out_root / "宣传视频"
    videos_dir.mkdir(parents=True, exist_ok=True)
    tmp_dir = videos_dir / "_tmp"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    ffmpeg_bin = find_ffmpeg()

    with sync_playwright() as p:
        browser = launch_browser(p)
        page = browser.new_page(viewport={"width": 1920, "height": 1080}, device_scale_factor=1)
        boot_world(page, f"{base_url}/?tour=bay-grand&qa=1", clean_hud=True)

        # Video 1: 深圳湾全景自动航拍 - 日落完整环游 (24s, full bay-grand loop)
        record_clip(
            page,
            ffmpeg_bin,
            videos_dir / "01-深圳湾全景自动航拍-日落.mp4",
            fps=30,
            duration_sec=24.0,
            route_id="bay-grand",
            u_start=0.0,
            u_end=1.0,
            period="sunset",
            weather="clear",
            season="summer",
            headlights=False,
            warm=25,
        )

        # Video 2: 后海天际线灯光秀航拍 - 夜景环湖 (18s, lake-lightshow)
        record_clip(
            page,
            ffmpeg_bin,
            videos_dir / "02-人才湖天际线灯光秀-夜景航拍.mp4",
            fps=30,
            duration_sec=18.0,
            route_id="lake-lightshow",
            u_start=0.0,
            u_end=0.88,
            period="night",
            weather="clear",
            season="summer",
            headlights=True,
            warm=45,
        )

        # Video 3: 多时段多地标宣传混剪 (腾讯双塔午后 -> 春笋春茧蓝调 -> 极光冬雪夜 -> 深圳湾一号日落)
        seg_specs = [
            ("seg1.mp4", 6.0, "tech-skyline", 0.96, 1.15, "day", "clear", "summer", False),
            ("seg2.mp4", 6.0, "bay-grand", 0.34, 0.56, "dusk", "clear", "summer", True),
            ("seg3.mp4", 6.0, "bay-grand", 0.70, 0.94, "sunset", "clear", "summer", False),
            ("seg4.mp4", 6.5, "lake-lightshow", 0.0, 0.28, "night", "aurora", "winter", True),
        ]
        seg_paths = []
        seg_durs = []
        for idx, (fname, dur, rid, u0, u1, per, wth, sea, hl) in enumerate(seg_specs):
            sp = tmp_dir / fname
            record_clip(
                page,
                ffmpeg_bin,
                sp,
                fps=30,
                duration_sec=dur,
                route_id=rid,
                u_start=u0,
                u_end=u1,
                period=per,
                weather=wth,
                season=sea,
                headlights=hl,
                warm=30,
                fade_in=0.55 if idx == 0 else 0.0,
                fade_out=0.65 if idx == len(seg_specs) - 1 else 0.0,
            )
            seg_paths.append(sp)
            seg_durs.append(dur)

        concat_with_xfade(
            ffmpeg_bin,
            seg_paths,
            videos_dir / "03-深圳漫游多时段地标宣传混剪.mp4",
            seg_durs,
            xfade=0.75,
        )
        page.close()
        browser.close()

    shutil.rmtree(tmp_dir, ignore_errors=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default="http://127.0.0.1:4177")
    parser.add_argument("--out", type=Path, default=Path("../宣传素材"))
    parser.add_argument("--mode", choices=["stills", "videos", "all"], default="all")
    args = parser.parse_args()
    out_root = args.out.resolve()
    out_root.mkdir(parents=True, exist_ok=True)
    if args.mode in ("stills", "all"):
        capture_stills(args.url.rstrip("/"), out_root)
    if args.mode in ("videos", "all"):
        record_videos(args.url.rstrip("/"), out_root)


if __name__ == "__main__":
    main()

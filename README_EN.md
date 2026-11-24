<div align="center">

<img src="public/media/mark.svg" alt="BAYWALK Logo" width="76" height="76" />

# SHENZHEN BAYWALK · 深圳漫游

### A 1 : 1 Real-World 3D Open-World Recreation of Shenzhen Bay & Talent Park in Pure Three.js

**Zero Game Engine Bloat · Single Runtime Dependency (`three`) · 3.0 km Real Geographic Radius · 4,286 Buildings · 124 Field-Collected Talent Pillars**

<p>
  <a href="README.md">简体中文</a> ·
  <a href="README_EN.md"><strong>English</strong></a>
</p>

<p>
  <img src="https://img.shields.io/badge/Three.js-0.182.0-000000?style=flat-square&logo=threedotjs&logoColor=white" alt="Three.js" />
  <img src="https://img.shields.io/badge/Vite-7.3.8-646CFF?style=flat-square&logo=vite&logoColor=white" alt="Vite" />
  <img src="https://img.shields.io/badge/WebGL_2-Native-990000?style=flat-square&logo=webgl&logoColor=white" alt="WebGL 2" />
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker Ready" />
  <img src="https://img.shields.io/badge/Dependencies-1_(three)-22c55e?style=flat-square" alt="Single Dependency" />
  <img src="https://img.shields.io/badge/Scale-1%3A1_(28.27_km²)-f97316?style=flat-square" alt="1:1 Scale" />
  <img src="https://img.shields.io/badge/i18n-EN_%7C_中文-0ea5e9?style=flat-square" alt="Bilingual" />
</p>

<p>
  <a href="#-quick-start-docker-one-liner">🐳 Docker Quick Start</a> •
  <a href="#-real-photo-vs-in-engine-comparison">📸 Real vs. In-Engine</a> •
  <a href="#-highlights--gallery">✨ Highlights</a> •
  <a href="#-deep-link-teleport-urls">🧭 Deep-Link Teleports</a> •
  <a href="#-architecture--gis-pipeline">🏗️ Architecture</a> •
  <a href="#-open-data--credits">📄 Credits</a>
</p>

<br />

<img src="docs/images/hero-sunset.jpg" alt="Shenzhen Talent Park Starlight Bridge and Houhai Skyline at Sunset" width="100%" />

<sub><em>Looking across Talent Lake from Starlight Bridge toward China Resources Tower ("Chunsun"), Shenzhen Bay Culture Square, and Spring Cocoon — rendered live in Chrome WebGL 2.</em></sub>

</div>

---

## 🌟 Why BAYWALK Is Different

Instead of procedurally generated gray boxes, **BAYWALK** is an authentic **1 : 1 browser-native digital twin** of Shenzhen's iconic waterfront (`22.51366° N, 113.94417° E`):

- **🌍 Scientific Multi-Source GIS Fusion**: Built from real **OpenStreetMap** road networks & building footprints, **CMAB (*Nature Scientific Data 2025*)** building height predictions, **Copernicus Sentinel-2C** true-color satellite orthophotos, **Meta & WRI CHMv2 (2026)** canopy height maps, and **AWS Terrain Tiles** out to a 22 km mountain horizon.
- **📷 On-Site Field Photography & EXIF Calibration**: All **124 double-sided Starlight Bridge & South Shore talent pillars** were photographed on-site and aligned via GPS EXIF telemetry — alongside photo-calibrated recreations of Tidal Square, bronze monuments, BYD e6 Pengcheng Shenzhen taxis, and a 2024 Tesla Model 3 Highland (`粤B·D03726`).
- **⚡ Ultra-Lean Pure WebGL Architecture**: Zero 200 MB engine WASM runtimes. **`package.json` has literally ONE runtime dependency: `three@0.182.0`**. 100 vanilla ES modules (20,781 LOC) compile with Vite in 1.85s into a ~510 KB gzipped JS core — playable immediately on desktop and touch devices.

<div align="center">

| Geographic Scale | Real Buildings | Road Segments | Rendered Trees | Field-Collected Pillars | Runtime Dependencies |
| :---: | :---: | :---: | :---: | :---: | :---: |
| **1 : 1** · 3.0 km radius | **4,286** | **6,084** | **9,000**<br><sub>(from 14,129 CHMv2 peaks)</sub> | **124**<br><sub>(EXIF-aligned + reader)</sub> | **1**<br><sub>(`three@0.182.0`)</sub> |

</div>

---

## 📸 Real Photo vs. In-Engine Comparison

Inspect pixel-matched field photographs against real-time 2560 × 1440 WebGL captures via the built-in interactive split-screen comparator at `/comparison/index.html`:

<table>
  <tr>
    <td width="50%" align="center">
      <img src="docs/images/compare-tidal.jpg" alt="Tidal Square real photo vs WebGL comparison" width="100%" />
      <br />
      <strong>Tidal Square · Houhai Skyline · Bronze Sculpture</strong>
      <br />
      <sub>Left: real field photograph · Right: live Three.js WebGL 2 render</sub>
    </td>
    <td width="50%" align="center">
      <img src="docs/images/compare-starbridge.jpg" alt="Starlight Bridge pillars real photo vs in-engine comparison" width="100%" />
      <br />
      <strong>Starlight Bridge · Academician & Pioneer Pillars</strong>
      <br />
      <sub>Cylindrical metallic portraits & etched inscriptions matched to real site photos</sub>
    </td>
  </tr>
</table>

---

## ✨ Highlights & Gallery

### 1. Synchronized City-Wide Light Show & 4 × 4 Climate Engine
- **4 Time-of-Day Presets**: Afternoon, Sunset, Blue Hour, and Night (with toggleable Moon)
- **4 Seasons × 4 Weathers**: Spring / Summer / Autumn / Winter × Clear / Rain / Snow / Aurora Night
- **Physical Touches**: Winter snow **freezes the inland Talent Lake while Shenzhen Bay keeps rolling ocean waves**; Night activates a **city-wide synchronized facade light show** reflected in real time via Three.js `Reflector`.

<table>
  <tr>
    <td width="50%" align="center">
      <img src="docs/images/night-lightshow.jpg" alt="Synchronized Skyline Light Show" width="100%" />
      <sub><strong>Synchronized Light Show</strong> — Shared show clock across every Houhai tower</sub>
    </td>
    <td width="50%" align="center">
      <img src="docs/images/aurora-night.jpg" alt="Aurora Borealis over Shenzhen Bay" width="100%" />
      <sub><strong>Aurora Night</strong> — Custom GLSL atmospheric & aurora shaders over Shenzhen Bay</sub>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <img src="docs/images/chunsun-aerial.jpg" alt="Chunsun and Houhai HQ aerial" width="100%" />
      <sub><strong>Chunsun & Houhai HQ District</strong> — Hand-crafted KPF diagrid spire</sub>
    </td>
    <td width="50%" align="center">
      <img src="docs/images/tencent-towers.jpg" alt="Tencent Binhai Seafront Towers" width="100%" />
      <sub><strong>Tencent Binhai Towers</strong> — Meter-accurate 245.78m / 194.75m twin towers & 3 skybridges</sub>
    </td>
  </tr>
  <tr>
    <td width="50%" align="center">
      <img src="docs/images/street-taxi.jpg" alt="Dengliang Road with Shenzhen BYD e6 Taxi" width="100%" />
      <sub><strong>Dengliang Road Street Life</strong> — Real blue-and-white BYD e6 Shenzhen taxi & wet reflections</sub>
    </td>
    <td width="50%" align="center">
      <img src="docs/images/drone-tour-hud.jpg" alt="Autonomous Cinematic Drone Tour HUD" width="100%" />
      <sub><strong>Cinematic Auto-Drone Tour</strong> — 3 spline routes, speed control, instant takeover & clean HUD</sub>
    </td>
  </tr>
</table>

---

## 🐳 Quick Start (Docker One-Liner)

Includes a hardened multi-stage `Dockerfile` (`node:22-alpine` → `nginx:1.27-alpine`) tuned specifically for WebGL 2, `.glb` MIME types, high-ratio Gzip on GIS JSON / binary meshes, immutable asset caching, and `/healthz` probes.

```bash
git clone https://github.com/DeaglePC/shenzhen-baywalk.git
cd shenzhen-baywalk
docker compose up -d --build
```

Open **http://localhost:8080** in any WebGL 2 browser (Chrome, Edge, Safari, Firefox).

```bash
# Optional: custom port
BAYWALK_PORT=3000 docker compose up -d --build

# Optional: containerized hot-reload dev server (no local Node.js needed)
docker compose --profile dev up baywalk-dev

# Or run locally with Node.js >= 20
npm install && npm run dev -- --open
```

---

## 🧭 Deep-Link Teleport URLs

| Destination / Experience | URL Query |
| :--- | :--- |
| 🚁 **Shenzhen Bay Grand Auto-Tour** | `/?tour=bay-grand` |
| 🎆 **Talent Lake Light Show Orbit** | `/?tour=lake-lightshow` |
| 🏙️ **Nanshan Tech Skyline Tour** | `/?tour=tech-skyline` |
| 🌌 **Aurora & Winter Snow on Starlight Bridge** | `/?walk=bridge&weather=aurora&season=winter` |
| ❄️ **Frozen Lake at Pi Bridge (2,017 digits of π)** | `/?walk=pi&weather=snow` |
| 🏢 **Tencent Binhai Twin Towers Aerial** | `/?walk=tencent` |
| 🏟️ **Spring Cocoon Stadium Aerial / Field** | `/?walk=stadium&camera=drone` · `/?walk=field` |
| 🚕 **Dengliang Rd BYD e6 Taxi Photo Match** | `/?walk=street&photo=1` |
| 🚗 **2024 Model 3 Highland Garage Configurator** | `/?inspect=model3&view=REAR_DETAIL` |
| 🔍 **Interactive Real vs. In-Engine Comparator** | `/comparison/index.html` |

---

## 🏗️ Architecture & GIS Pipeline

```mermaid
flowchart LR
    DATA["Real-World Data\nOSM + CMAB 2025 + Sentinel-2C\nMeta CHMv2 + AWS DEM + Field EXIF"] --> PY["Python Asset & QA Pipeline\n36 Scripts + Blender Exports"]
    PY --> ENGINE["Pure Three.js WebGL 2 Engine\n100 ES Modules · 20.7k LOC"]
    ENGINE --> DIST["Vite 7 Build (~510KB gzip)\nDocker + Nginx Alpine"]
```

---

## 📄 Open Data & Credits

All geographic datasets, 3D vehicle models, PBR textures, and portrait attributions are transparently documented in:
- [Geographic & Satellite Data Sources](public/data/SOURCES.md) (OpenStreetMap ODbL 1.0, CMAB CC BY 4.0, Copernicus Sentinel-2C, Meta & WRI CHMv2 CC BY 4.0, AWS Terrain Tiles)
- [City Assets & Architectural Calibration](public/city/SOURCES.md)
- [Starlight Bridge Field Records & Licenses](public/talent/SOURCES.md)
- [Full Credits Page](public/credits.html)

---

<div align="center">

**If this browser-rendered Shenzhen Bay amazed you, please drop a ⭐ Star!**

</div>

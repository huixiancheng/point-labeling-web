# point-labeling-web

[中文（默认）](README.md) | **English**

An open-format web annotator for semantic point clouds, with a browser UI, a Windows launcher, and reproducible development entry points. The current baseline is frame-wise SemanticKITTI / KITTI Velodyne data.

> **Core capability**: on a Windows workstation with a discrete GPU, the browser can render, browse, and annotate roughly **50 million points** through the WebGL frame-window pipeline. A Clip containing about 45.8 million points has been used for validation; actual performance depends on the GPU, VRAM, driver, and browser.

## Demo

<p align="center">
  <a href="https://github.com/huixiancheng/point-labeling-web/raw/refs/heads/main/assets/usage_demo.mp4">
    <img src="assets/usage_demo.gif" alt="Point-cloud annotation demo GIF (click for the full MP4)" width="960" />
  </a>
</p>

[▶ Play or download the complete MP4 (about 118.6 MB)](https://github.com/huixiancheng/point-labeling-web/raw/refs/heads/main/assets/usage_demo.mp4)

## Windows release package

Current version: [v0.1.1 Release](https://github.com/huixiancheng/point-labeling-web/releases/tag/v0.1.1) · [download the Windows package](https://github.com/huixiancheng/point-labeling-web/releases/download/v0.1.1/PointLabelingWeb-Windows-v0.1.1.zip)

Package layout:

~~~text
PointLabelingWeb-Windows-<version>/
├─ PointLabelerLauncher.exe  # start, stop, update, and exit
├─ app/                      # server, web assets, and runtimes
├─ clips/                    # point-cloud data
├─ logs/                     # runtime logs
└─ update/                   # optional update files
~~~

1. Put SemanticKITTI/KITTI data under `clips`.
2. Double-click `PointLabelerLauncher.exe` and choose **Start annotation**.
3. The launcher opens <http://localhost:8090/> after the service is ready; choose **Stop annotation** or exit the launcher when finished.

The launcher supports port settings, `auto/high/low` performance profiles, title-bar minimize, and hide-to-tray. See [`docs/USAGE.md`](docs/USAGE.md) for the full guide.

## 20-frame test data

[Download the first 20 frames of SemanticKITTI sequence `00` (~29.6 MB)](assets/SemanticKITTI-00-20frames.zip)

Extract it into the package's `clips` directory and start annotation. The archive contains `.bin`, `.label`, `poses.txt`, `calib.txt`, and data terms. The data follows SemanticKITTI's CC BY-NC-SA terms and is not covered by this project's MIT code license.

## Project structure

`frontend/` contains the Three.js + TypeScript UI; `server/` contains the C++/Qt service; `windows/` contains the Windows launcher and packaging scripts; `docs/` contains usage, development, format, and release notes; `tools/` contains test-data utilities. Real data in `clips/`, runtime logs, and the local 300-frame fixture are excluded from source history.

## Development, build, and docs

Frontend development:

~~~powershell
cd frontend
pnpm install
pnpm run build
~~~

Windows packaging requires CMake, Visual Studio C++, Qt, and `windeployqt`:

~~~powershell
.`windows`build_package.ps1 `
  -QtPrefix `C:\Qt\5.15.2\msvc2019_64` `
  -OutputDir `E:\build\PointLabelingWebOpen-Windows`
~~~

See [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) and [`docs/RELEASE.md`](docs/RELEASE.md) for detailed build, debug, and release instructions.

## Supported data

Example SemanticKITTI layout:

~~~text
clips/semantic_kitti/sequences/00/
├─ velodyne/000000.bin
├─ labels/000000.label  # optional
├─ poses.txt            # optional, for frame stacking
└─ calib.txt            # optional, with poses.txt
~~~

KITTI Odometry, KITTI Object `velodyne/*.bin`, and directories containing numbered `.bin` frames are also supported. `.bin` points use little-endian `float32 x,y,z,remission`; point labels use little-endian `uint32`. See [`docs/OPEN_FORMATS.md`](docs/OPEN_FORMATS.md) for scanning and export details.

## Annotation features and shortcuts

- Chinese/English UI, view switching, fly view, BEV, brush, polygon, rectangle, lasso, and polyline tools.
- The brush uses a fixed 3D world-space radius, range `1–100`, default `8`; polyline height filtering defaults to `15`.
- `Ctrl+S` saves all changes; current-frame export writes `.label`, and Clip export writes `.plwlabels`.
- **Default player** opens detected Clip video with the registered Windows player.

| Key | Action |
| --- | --- |
| `N`, `1`–`5` | View, brush, polygon, rectangle, lasso, polyline |
| `V` | Cycle views |
| `B` | Toggle BEV and the previous automatic perspective view |
| `F` / `G` | Fly view |
| `Enter` / right click | Apply the current preview |
| `Ctrl+S` | Save all changes |
| `Ctrl+Z` / `Ctrl+Y` | Undo / redo |

Workspace is selected by clicking its toolbar button so `W` remains available for fly-view movement.

## Acknowledgments and license

This is an independent implementation. Its features and code were informed by [jbehley/point_labeler](https://github.com/jbehley/point_labeler) and [xtreme1-io/xtreme1](https://github.com/xtreme1-io/xtreme1); this does not imply affiliation or endorsement. See [`NOTICE`](NOTICE) for dependency and reference-project licensing.

The project code is released under the [MIT License](LICENSE), including commercial use, modification, and redistribution subject to retaining the license and copyright notice. SemanticKITTI, KITTI, and their labels remain subject to their own data terms; this project does not include proprietary data or repository credentials.

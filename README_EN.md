# point-labeling-web

[中文（默认）](README.md) | **English**

An open-format web annotator for semantic point clouds. The current baseline is frame-wise SemanticKITTI / KITTI Velodyne data, with a Windows release package, a browser annotation UI, and reproducible development and test entry points.

> **Core capability / GPU Windows Web**: the primary target is a Windows workstation with a discrete GPU. The browser directly renders, browses, and annotates roughly **50 million points (50M scale)** through the WebGL frame-window pipeline, without requiring a separate desktop annotation client. A Clip containing about 45.8 million points has been used for validation. Actual smoothness depends on the GPU, VRAM, driver, and browser.

## Demo

The video demonstrates point-cloud browsing, tool switching, and label editing on the public-format test package. It is stored locally as `assets/usage_demo.mp4` and is published as a separate GitHub Release asset because of its size.

<video controls muted loop playsinline preload="metadata" width="960">
  <source src="assets/usage_demo.mp4" type="video/mp4" />
  <a href="assets/usage_demo.mp4">Download the demo video</a>
</video>

GitHub supports MP4 video, but the README player requires the video to be uploaded to GitHub (as a repository file, Release asset, or GitHub attachment). `usage_demo.mp4` is kept local and published as a Release asset; after uploading it, replace the `<source>` URL with the GitHub-generated asset URL to play it on the repository page. H.264 has the broadest browser compatibility. See [`assets/README.md`](assets/README.md) for the asset policy.

## Direct test data / 20 frames

The repository includes a small SemanticKITTI sequence `00` test archive that can be extracted directly into the Windows package's `clips` directory:

[Download SemanticKITTI-00-20frames.zip (~29.6 MB)](assets/SemanticKITTI-00-20frames.zip)

After extraction, the layout is `clips/semantic_kitti/sequences/00/`. Double-click `PointLabelerLauncher.exe` and choose **Start annotation**. The archive contains `.bin`, `.label`, `poses.txt`, `calib.txt`, and the data terms. The data is not covered by this project's MIT code license; use and redistribution must follow SemanticKITTI's CC BY-NC-SA terms.

## Project layout

| Path | Purpose |
| --- | --- |
| `frontend/` | Three.js + TypeScript annotation UI, language switching, tools, timeline, and performance profiles. |
| `server/` | C++/Qt HTTP service, dataset scanning, pose alignment, label I/O, and the Windows video-player interface. |
| `docs/` | Format boundaries, usage, development, packaging, and Wiki source documents. |
| `tools/` | SemanticKITTI test-data download and validation scripts. |
| `windows/` | Windows build scripts, graphical launcher, and packaging helpers. |
| `CHANGELOG.md` / `VERSION` | Release version and change history. |
| `windows/package_open/clips/` | Local 300-frame SemanticKITTI `00` regression fixture; excluded from source history. |
| `clips/`, `logs/` | Local development data and runtime logs; private data must not be committed. |

## Quick start

### Windows release package

The package keeps programs and data separate:

```text
PointLabelingWebOpen-Windows-<date>/
├─ PointLabelerLauncher.exe
├─ app/                 # server executable, web assets, Qt/MSVC runtime files
├─ clips/               # put public point-cloud data here
└─ logs/                # server and foreground diagnostic logs
```

1. Put a complete SemanticKITTI or KITTI directory under `clips`.
2. Double-click `PointLabelerLauncher.exe` and choose **Start annotation**.
3. Open <http://localhost:8090/>. The launcher opens the browser after the service is ready.
4. Choose **Stop annotation** when finished, or exit the launcher; exiting the launcher automatically stops this package's service.

The launcher provides four core actions: start annotation, stop annotation, update, and exit. It also provides separate title-bar **Minimize** and **Hide to tray** functions, plus controls for the port and performance profile. `auto` selects a profile from browser GPU information; `high` uses a 200-frame default window; `low` uses a single-frame default for integrated or low-performance GPUs.

The service runs in the background without a permanently attached PowerShell window. Use the launcher's Port and Profile controls when a different port or display profile is needed.

The title-bar **Minimize** and the launcher’s **Hide to tray** action are separate. Minimize keeps a normal taskbar restore entry; Hide to tray removes the taskbar window while the service continues running and restores only from the tray. A left click on the tray icon restores the launcher, while right click provides show, start, stop, and exit actions. Closing the window or choosing tray **Exit** first warns that the browser may contain unsaved labels; confirm that the page shows 0 pending changes before exiting.

### Development

Frontend:

```powershell
cd frontend
pnpm install
pnpm run build
```

Backend example:

```powershell
.\server\build_open\Release\point_labeler_server.exe `
  --root E:\data\SemanticKITTI `
  --assets .\server\assets `
  --web-root .\frontend\dist `
  --port 8090
```

For foreground Windows diagnostics after building the backend:

```powershell
.\server\build_open\Release\point_labeler_server.exe `
  --root "D:\datasets\SemanticKITTI" `
  --assets .\server\assets `
  --web-root .\frontend\dist `
  --log .\logs\server-foreground.log `
  --host 127.0.0.1 `
  --port 18090
```

## Supported data formats

### SemanticKITTI

The server recursively discovers numbered `velodyne` frames under public data directories:

```text
clips/
└─ semantic_kitti/
   └─ sequences/
      └─ 00/
         ├─ velodyne/000000.bin
         ├─ labels/000000.label       # optional
         ├─ poses.txt                  # optional; used for frame stacking
         └─ calib.txt                  # optional; used with poses.txt
```

Each `.bin` point is little-endian `float32 x,y,z,remission`; each `.label` value is little-endian `uint32`. The UI supports SemanticKITTI learning classes 0–19 and 255 for unlabeled points. Unmodified points retain their original `uint32`, including the high 16-bit instance value.

### KITTI

KITTI Odometry `velodyne/*.bin`, KITTI Object `training/testing/velodyne`, and directories containing numbered `.bin` frames are supported. KITTI Object `label_2/*.txt` files are 3D-box labels and are not interpreted as point-wise `.label` files. Point-wise edits are written to a sibling `labels/*.label` directory.

See [`docs/OPEN_FORMATS.md`](docs/OPEN_FORMATS.md) for scanning rules, pose alignment, and export details.

## Annotation UI

- Switch between Chinese and English with the Language selector; the setting is saved in the current browser.
- Performance profiles change the loading window and display range, not the label format or server-side point values.
- The brush uses a fixed 3D world-space radius, currently 1–100 with default 8.
- Polyline annotation uses the same XY radius plus a height filter, default 15 (approximately ±15 cm when the dataset unit is meters).
- `Ctrl+S` saves all pending changes. Current-frame export writes a standard `.label`; Clip export writes `.plwlabels`.
- The **Default player** action opens detected Clip video with the registered Windows player.

### Shortcuts

| Key | Action |
| --- | --- |
| `N`, `1`–`5` | View, brush, polygon, rectangle, lasso, polyline |
| `V` | Cycle views |
| `B` | Toggle BEV and the previous automatic perspective view |
| `F` / `G` | Toggle fly view |
| `Enter` / right click | Apply the current preview |
| `Ctrl+S` | Save all pending edits |
| `Ctrl+Z` / `Ctrl+Y` | Undo / redo |

Workspace is selected by clicking its toolbar button so `W` remains available for fly-view movement.

## Documentation

- [`docs/USAGE.md`](docs/USAGE.md): installation, data placement, annotation, saving, export, and troubleshooting.
- [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md): architecture, build, test, packaging, and contribution conventions.
- [`docs/OPEN_FORMATS.md`](docs/OPEN_FORMATS.md): SemanticKITTI/KITTI support boundaries and label protocol.
- [`docs/README.md`](docs/README.md): documentation map, ownership, and maintenance rules.
- [`docs/RELEASE.md`](docs/RELEASE.md): open-source release checklist and asset organization.
- [`CONTRIBUTING.md`](CONTRIBUTING.md): contribution and pull-request checklist.
- [`SECURITY.md`](SECURITY.md): local-service boundary and security reporting guidance.
- [`CHANGELOG.md`](CHANGELOG.md): release change history.
- [`docs/WIKI_USAGE.md`](docs/WIKI_USAGE.md): source for the GitHub Wiki usage page.

## Build, test, and release

Frontend production builds require Node.js `>=20.19.0`, npm, or pnpm. Windows packaging additionally requires CMake, Visual Studio C++, Qt, and `windeployqt`:

```powershell
.\windows\build_package.ps1 `
  -QtPrefix "C:\Qt\5.15.2\msvc2019_64" `
  -OutputDir "E:\build\PointLabelingWebOpen-Windows"
```

Keep `-OutputDir` separate from any work package containing real `clips` or `logs`. To update an existing package, put the new `app` under `update\app` and optionally put a new `PointLabelerLauncher.exe` under `update`; then choose **Update** in the launcher. `clips` and `logs` are not overwritten.

The source repository keeps maintainable source, tests, scripts, and documentation. Frontend `dist`, `node_modules`, build directories, Qt runtime files, the 300-frame local fixture, logs, and complete Windows packages are generated or local data and are excluded from source history. The small 20-frame SemanticKITTI test archive is an explicit public test asset; upload the generated Windows ZIP and `usage_demo.mp4` as GitHub Release assets when publishing a release.

## Acknowledgments

This is an independent implementation and is not affiliated with the referenced projects or their maintainers.

- [jbehley/point_labeler](https://github.com/jbehley/point_labeler) informed the SemanticKITTI/KITTI data organization, point-label handling, pose-related ideas, and parts of the annotation interaction. It uses the [MIT License](https://github.com/jbehley/point_labeler/blob/master/LICENSE).
- [xtreme1-io/xtreme1](https://github.com/xtreme1-io/xtreme1) informed parts of the workbench organization, timeline, label panel, interactive visualization, and frontend product shape. It uses the [Apache License 2.0](https://github.com/xtreme1-io/xtreme1/blob/main/LICENSE).

The project’s own frontend, backend, Windows scripts, and documentation are maintained independently. SemanticKITTI, KITTI, and their labels remain subject to their own data terms. See [`NOTICE`](NOTICE) for third-party dependency licensing.

## License and data responsibility

The project’s own code is released under the [MIT License](LICENSE), including commercial use, modification, and redistribution subject to retaining the license and copyright notice. Third-party dependencies and referenced projects retain their own licenses. The project does not include proprietary data or repository credentials.

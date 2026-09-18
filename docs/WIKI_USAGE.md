# Usage / 使用说明

> This file is the copy-ready source for the GitHub Wiki usage page. The
> repository's detailed user guide is [`docs/USAGE.md`](USAGE.md); update that
> guide first when behavior changes, then synchronize the relevant Wiki text.

## Quick start

1. Unzip the Windows package and keep `app`, `clips`, and `logs` at the same level.
2. Put a complete SemanticKITTI/KITTI directory under `clips`.
3. Double-click `PointLabelerLauncher.exe` and choose **Start annotation**.
4. The launcher directly starts the server and opens <http://localhost:8090/>.
5. Choose **Stop annotation** when finished.

Use the launcher's **Port** and **Profile** controls when another port or a lower-memory display profile is needed. The release package has one EXE entry point so that a second script cannot start a duplicate service.

The launcher has four core actions: start annotation, stop annotation, update, and exit. Title-bar **Minimize** keeps a taskbar restore entry; **Hide to tray** removes the taskbar window while keeping the service running. Closing the launcher or choosing tray **Exit** first warns about possible unsaved labels; confirm that the page shows 0 pending changes before exiting.

`auto` chooses a profile from the browser GPU information; `high` uses a 200-frame window; `low` uses a single-frame window. These profiles change loading/display behavior only. The server still reads complete points for the frames it serves.

## Data layout

```text
clips/
└─ semantic_kitti/
   └─ sequences/
      └─ 00/
         ├─ velodyne/000000.bin
         ├─ labels/000000.label
         ├─ poses.txt
         └─ calib.txt
```

The scanner accepts nested public data directories and lists multiple Clips in the top bar. `.bin` points are little-endian `float32 x,y,z,remission`; `.label` values are little-endian `uint32`. KITTI Object `label_2/*.txt` files are 3D-box labels and are not treated as point-wise `.label` files.

## Annotation

- Switch `中文` / `English` from the top **Language** selector. The choice is kept in the current browser.
- Use the dark/light display selector, UI scale selector, and performance selector in the same top row.
- The brush radius is a fixed 3D world-space radius, not a screen-pixel radius. The current range is 1–100, default 8.
- Polyline selection uses the same XY radius and a height filter; the default height value is 15, approximately ±15 cm when the dataset unit is meters.
- `Ctrl+S` saves all pending changes. The current-frame export writes a standard `.label`; the Clip export writes `.plwlabels`.
- The **Default player** button asks Windows to open the detected Clip video with its registered system player.

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

Select **Workspace** by clicking its toolbar button. It has no keyboard shortcut so that `W` remains available for fly-view movement.

The timeline distinguishes unmodified, saved changes, pending save, and the loaded window. Before changing Clips or closing the page, unsaved changes trigger a save/discard/cancel prompt.

## Troubleshooting

- If the page refuses the connection, verify the port shown by the launcher and inspect `logs/server.log`.
- If no Clip is listed, check that the server's `DataRoot` contains a `velodyne` directory with numbered `.bin` files.
- If the executable exits immediately, inspect `logs/server.log`. Developers should follow `docs/DEVELOPMENT.md` to run the backend in the foreground and inspect Qt DLL, path, or port errors.
- On integrated GPUs, choose `low`, display only the current frame, and keep annotation scope to the current frame to reduce browser GPU pressure.

For format details and source-build instructions, see the repository README and `docs/OPEN_FORMATS.md` / `docs/DEVELOPMENT.md`.

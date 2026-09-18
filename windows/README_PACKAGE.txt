PointLabelingWebOpen Windows package

1. Put a complete SemanticKITTI/KITTI directory under clips.
2. Double-click PointLabelerLauncher.exe and choose Start annotation.
3. The launcher has four core choices: start annotation, stop annotation, update, and exit. It also supports title-bar Minimize and a separate Hide to tray mode.
4. The default address is http://localhost:8090/. If another port is needed, enter it in the launcher's Port field before starting.
5. Choose Stop annotation to stop this package's service.

The app directory contains the executable and all runtime files. The web page
supports Chinese and English from the Language selector. On integrated GPUs,
choose Profile `low` in the launcher; it uses a single-frame display by default.
The launcher also accepts `auto` and `high` profiles.

See README_WINDOWS.md for the complete package guide. LICENSE, NOTICE, and
THIRD_PARTY_NOTICES.md and QT_LICENSE.txt describe the separate code,
dependency, runtime, and dataset license boundaries.

The release package intentionally has no BAT entry points. Use
PointLabelerLauncher.exe for start, stop, update, and exit.

The title-bar Minimize and the launcher's Hide to tray action are separate.
Minimize keeps a normal taskbar restore entry; Hide to tray removes the
taskbar window while the service continues running and restores from the tray.
Closing the launcher or choosing tray Exit first warns about possible unsaved
browser labels; confirm the page shows 0 pending changes before exiting.

The launcher directly starts/stops the server and synchronizes update\app.
There is only one way to start the service, so a script cannot accidentally
create a duplicate. Exit closes the launcher and stops the current package
service; use Stop annotation first if you want to see the explicit stop status.

Do not replace clips or logs during a normal application update. Put a new app
folder under update\app, optionally put a new PointLabelerLauncher.exe under
update, and choose Update in PointLabelerLauncher.exe.
The package update is performed from the launcher's Update option.

This package is built from the open SemanticKITTI/KITTI source tree; no
proprietary dataset is required by the executable. See the repository README
and docs/USAGE.md for the full guide.

# Third-party notices

This file describes software and data that are distributed with, linked into,
or used to build `point-labeling-web`. These terms are separate from
the project's MIT License.

## C++ dependencies

- **cpp-httplib** is included in `server/third_party/httplib.h` under the MIT
  License.
- **JSON for Modern C++ (nlohmann/json)** is included in
  `server/third_party/nlohmann/json.hpp` under the MIT License.

The Windows server statically compiles these header-only dependencies. Their
copyright and license notices remain applicable to the resulting executable.

## Frontend dependency

- **Three.js** is bundled into the browser frontend under the MIT License.
  The package metadata and lock files identify the exact version used for a
  build.

Build-only tools such as Vite, TypeScript, esbuild, PostCSS and their
transitive dependencies are not shipped as `node_modules` in the Windows
package. Their licenses remain recorded by the frontend lock files.

## Qt runtime

The Windows package includes `Qt5Core.dll` from the Qt 5.15.2 build used by
the packager. Qt is not covered by this project's MIT License. The applicable
Qt open-source license is included in the package as `QT_LICENSE.txt`; users
must comply with the LGPL/GPL terms applicable to the Qt components they
redistribute. A commercial Qt license may impose different terms.

## Microsoft Visual C++ runtime

The Windows package includes the x64 Microsoft Visual C++ runtime DLLs
(`MSVCP140.dll`, `VCRUNTIME140.dll`, and `VCRUNTIME140_1.dll`) so that the
server can run on a clean Windows installation. These DLLs are Microsoft
runtime components and are not covered by the project's MIT License. Their
redistribution is subject to Microsoft's Visual C++ Redistributable terms.

## Reference projects and data

The design and implementation references are acknowledged in the root
`README.md` and `README_EN.md`; this project is independent and is not
affiliated with those projects.

SemanticKITTI/KITTI point clouds and labels are data assets, not project code.
The public 20-frame SemanticKITTI archive contains its own `DATA_LICENSE.txt`
and must be used and redistributed under the dataset's applicable terms.

# 开发说明 / Development guide

## 1. 架构

```text
浏览器
  │  静态页面、帧请求、标签写回、导出请求
  ▼
frontend/                 Three.js + TypeScript
  │  HTTP /api/datasets/...
  ▼
server/                   C++/Qt + httplib
  │  扫描公开目录、读取 .bin/.label、姿态对齐、原子写回
  ▼
clips/                    用户数据（不提交）
```

前端的主要入口是 `frontend/src/frame_main.ts`，样式在 `frontend/src/style.css`，页面骨架在 `frontend/index.html`。服务端静态资源来自 `frontend/dist`，Windows 包构建时会复制到 `app/web`。

Windows 四选项启动器源码位于 `windows/launcher/PointLabelerLauncher.cs`。启动器通过单实例互斥避免多个 EXE 重复管理服务，只维护当前包的一个 `app/point_labeler_server.exe`；退出或关闭窗口时自动结束当前包服务，并直接同步 `update/app` 到 `app`。`build_package.ps1` 使用 Windows .NET Framework 自带的 `csc.exe` 编译启动器、嵌入 `windows/assets/point_labeler_icon.ico`，并将结果复制到包根目录。发布包只提供 EXE 入口，避免脚本入口启动重复服务。

## 2. 前端开发

需要 Node.js `>=20.19.0`、npm 或 pnpm。npm 和 pnpm lockfile 已同步；构建脚本优先使用 npm，只有 npm 不可用时才回退到 pnpm：

```powershell
cd frontend
pnpm install
pnpm run build
```

如果环境只有 npm，将命令替换为 `npm install` 和 `npm run build`。TypeScript 编译失败时先修复 `tsc` 错误，再检查 Vite 输出。

中英文界面约定：

- 静态 HTML 使用 `data-i18n`、`data-i18n-title` 和 `data-i18n-aria`。
- 动态文本通过 `tr()`、`interpolate()`、`countText()` 等辅助函数生成。
- 当前语言存储键为 `point-labeler-language`，默认中文，值为 `zh` 或 `en`。
- 新增按钮、状态或错误时，必须同时增加 `translations.zh` 和 `translations.en`，不要在业务逻辑中散落单语硬编码。
- 标签类别显示使用 SemanticKITTI ID 的英文映射；后端提供的中文名称在中文模式保留。

建议在修改后至少验证：初始加载、切换 English、切回中文、切换 Clip、保存/撤销、错误状态，以及小窗口下顶部控制器是否溢出。

## 3. 后端构建

Windows 示例（按本机 CMake、Qt 和 Visual Studio 版本调整）：

```powershell
cmake -S server -B server/build_open `
  -G "Visual Studio 18 2026" -A x64 `
  -DCMAKE_PREFIX_PATH="C:\Qt\5.15.2\msvc2019_64"
cmake --build server/build_open --config Release --target point_labeler_server test_open_dataset
```

Linux/WSL 可以使用仓库根目录的 `run.sh` 或直接用 CMake 构建。服务参数的核心部分是：

```text
--root <数据根目录>
--assets <server/assets>
--web-root <frontend/dist>
--host 127.0.0.1
--port <端口>
```

## 4. 测试

后端格式测试：

```powershell
cmake --build server/build_open --config Release --target test_open_dataset
& .\server\build_open\Release\test_open_dataset.exe
```

手工 API 烟测：

```powershell
Invoke-WebRequest http://127.0.0.1:8090/api/datasets
Invoke-WebRequest http://127.0.0.1:8090/api/datasets/<id>/frame-manifest
```

SemanticKITTI 300 帧夹具位于 `windows/package_open/clips/semantic_kitti/sequences/00`。验证时应检查 `.bin` 与 `.label` 帧名和点数一一对应，并确认 `poses.txt`、`calib.txt` 存在时 `poseAligned` 为真。

浏览器手工测试清单：

1. 打开单 Clip 和多 Clip 列表。
2. 切换 `auto/high/low`，确认窗口大小和标注范围同步。
3. 切换深色/浅色背景、界面缩放和中文/English。
4. 测试画刷、多边形、矩形、套索、折线、工作区和地面过滤。
5. 修改标签后检查时间线“待保存”，执行 `Ctrl+S` 后检查“已保存修改”。
6. 导出当前帧和 Clip，重新载入并核对标签。
7. 在 Chrome 控制台确认没有未处理错误。

## 5. Windows 打包

构建脚本会先生成前端，再编译后端，最后复制 exe、Qt 运行库、assets 和 web：

```powershell
.\windows\build_package.ps1 `
  -QtPrefix "C:\Qt\5.15.2\msvc2019_64" `
  -OutputDir "E:\build\PointLabelingWebOpen-Windows"
```

请将输出目录设为新的目录。当前脚本的完整包构建会重建 `app`，不要将它直接指向含有真实标注数据的唯一工作包。交付更新把新的 `app` 放入 `update\app`，由 `PointLabelerLauncher.exe` 直接校验、替换并保留 `clips`、`logs`。

发布前检查：

- `app/point_labeler_server.exe` 和 Qt/MSVC DLL 齐全。
- `app/assets`、`app/web/index.html` 和 `app/web/assets` 齐全。
- `PointLabelerLauncher.exe` 能直接开启、停止和更新；发布包只有这一套入口。
- 启动器中的端口和性能模式设置能覆盖默认 `8090/auto`。
- 包内不含专有数据、账号信息或调试临时文件。

### 源码与 Release 分离

源码仓库不提交 `frontend/dist`、CMake/Visual Studio 构建目录、Qt DLL、完整 Windows 包或本地数据。`windows/package_open` 仅用于本机 SemanticKITTI 300 帧回归测试，已被 `.gitignore` 排除。

构建时将 `-OutputDir` 指向独立的新目录；生成的完整目录压缩为 `PointLabelingWebOpen-Windows-<date>.zip`，与 `assets/usage_demo.mp4` 一起上传到目标 GitHub Release。若要通过包内更新替换启动器，将新的 `PointLabelerLauncher.exe` 放在 `update/PointLabelerLauncher.exe`；源码仓库只保留构建脚本和启动器源码，便于后续重新生成发布包。

## 6. 姿态和坐标

服务在同时发现完整 pose/calibration 信息时，将逐帧点云变换到序列局部坐标。缺失或不完整时回退到每帧自身坐标，页面仍可标注，但跨帧堆叠不应被当作全局对齐结果。具体文件约定见 [`OPEN_FORMATS.md`](OPEN_FORMATS.md)。

## 7. 贡献约定

- 不提交真实数据、导出的标签、日志、Qt 安装目录和构建目录。
- 代码和文档改动保持中英文界面一致。
- 修复交互问题时同时补一条手工测试清单。
- 修改导出格式或数据扫描规则时更新 `OPEN_FORMATS.md` 和 README。
- 任何会覆盖 `clips` 的脚本行为都必须在文档中明确说明。

# Changelog

## 0.1.1 — 2026-09-18

- Windows launcher can minimize in the background with taskbar and tray restore paths.
- Added an explicit Hide to tray action, separate from normal title-bar minimize.
- Closing the launcher or choosing tray Exit warns about possible unsaved browser labels before stopping the package service.
- Windows package documentation now describes tray operation and the save reminder.

## 0.1.0 — 2026-09-18

首个公开基线版本：

- 支持 SemanticKITTI / KITTI 风格逐帧 `.bin` 点云和 `.label` 标签。
- 提供 Windows `PointLabelerLauncher.exe`，统一负责启动、停止、更新和退出。
- 支持中文/English、性能模式、视角切换、画刷、多边形、矩形、套索、折线和工作区工具。
- 支持姿态对齐的多帧浏览、标签保存、标准 `.label` 导出和 `.plwlabels` Clip 导出。
- 提供 SemanticKITTI `00` 序列前 20 帧公开测试包。
- 补充 MIT 代码许可、第三方依赖、Qt/MSVC 运行库和数据许可边界。

性能和兼容性说明见 README；实际点云规模、帧窗口和流畅度取决于显卡、驱动、浏览器和数据格式。

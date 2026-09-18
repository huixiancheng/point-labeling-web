# point-labeling-web

面向 SemanticKITTI / KITTI 等公开格式的 Web 语义点云标注工具，提供浏览器标注界面、Windows 启动器和可复现的开发入口。

> **核心能力 / GPU Windows Web**：重点面向带独立 GPU 的 Windows 电脑，在浏览器中直接完成约 **5,000 万点级（50M-scale）**点云的流式渲染、跨帧浏览和标注，不要求切换到桌面客户端。当前已用约 4,582.5 万点 Clip 做过验证；实际流畅度取决于独显型号、显存、驱动和浏览器。

[中文（默认）](README.md) | [English](README_EN.md)

## 演示 / Demo

<p align="center">
  <a href="https://github.com/huixiancheng/point-labeling-web/raw/refs/heads/main/assets/usage_demo.mp4">
    <img src="assets/usage_demo.gif" alt="点云标注完整演示 GIF（点击打开完整 MP4）" width="960" />
  </a>
</p>

[▶ 播放或下载完整 MP4（约 118.6 MB）](https://github.com/huixiancheng/point-labeling-web/raw/refs/heads/main/assets/usage_demo.mp4)

## Windows 发布包

当前版本：[v0.1.1 Release](https://github.com/huixiancheng/point-labeling-web/releases/tag/v0.1.1) · [直接下载 Windows 包](https://github.com/huixiancheng/point-labeling-web/releases/download/v0.1.1/PointLabelingWeb-Windows-v0.1.1.zip)

发布包结构：

~~~text
PointLabelingWeb-Windows-<version>/
├─ PointLabelerLauncher.exe  # 开启、停止、更新和退出
├─ app/                      # 服务、网页和运行库
├─ clips/                    # 放点云数据
├─ logs/                     # 运行日志
└─ update/                   # 可选更新文件
~~~

使用方法：

1. 将 SemanticKITTI/KITTI 数据放入 `clips`。
2. 双击 `PointLabelerLauncher.exe`，选择“开启标注”。
3. 启动器会打开 <http://localhost:8090/>；完成后选择“结束标注”或退出启动器。

启动器支持端口设置、`auto/high/low` 性能模式、标题栏最小化和隐藏到托盘。完整说明见 [`docs/USAGE.md`](docs/USAGE.md)。

## 20 帧测试数据

[下载 SemanticKITTI `00` 序列前 20 帧（约 29.6 MB）](assets/SemanticKITTI-00-20frames.zip)

解压到发布包的 `clips` 后，启动标注即可测试。压缩包包含 `.bin`、`.label`、`poses.txt`、`calib.txt` 和数据许可说明；数据遵守 SemanticKITTI 的 CC BY-NC-SA 条款，不适用本项目的 MIT 代码许可。

## 项目结构

`frontend/` 是 Three.js + TypeScript 界面；`server/` 是 C++/Qt 服务；`windows/` 是 Windows 启动器和打包脚本；`docs/` 是使用、开发、格式和发布说明；`tools/` 是测试数据工具。`clips/`、`logs/` 和 300 帧本地测试夹具不提交真实数据。

## 源码开发、构建和文档

前端：

```powershell
cd frontend
pnpm install
pnpm run build
```

Windows 打包需要 CMake、Visual Studio C++、Qt 和 `windeployqt`：

~~~powershell
.\windows\build_package.ps1 `
  -QtPrefix "C:\Qt\5.15.2\msvc2019_64" `
  -OutputDir "E:\build\PointLabelingWebOpen-Windows"
~~~

更完整的构建、调试和发布流程见 [`docs/DEVELOPMENT.md`](docs/DEVELOPMENT.md) 与 [`docs/RELEASE.md`](docs/RELEASE.md)。

## 支持的数据

SemanticKITTI 示例目录：

~~~text
clips/
└─ semantic_kitti/
   └─ sequences/
      └─ 00/
         ├─ velodyne/000000.bin
         ├─ labels/000000.label       # 可选；没有时按未标注加载
         ├─ poses.txt                  # 可选；用于帧堆叠
         └─ calib.txt                  # 可选；与 poses.txt 配合
~~~

服务也支持 KITTI Odometry、KITTI Object 的 `velodyne/*.bin`，以及直接包含编号 `.bin` 帧的目录。`.bin` 使用 `float32 x,y,z,remission`，逐点标签使用小端 `uint32`；详细扫描规则和导出协议见 [`docs/OPEN_FORMATS.md`](docs/OPEN_FORMATS.md)。

## 标注功能和快捷键

- 顶部“语言”下拉框可在中文和 English 之间切换；选择会保存在当前浏览器，下次打开继续使用。
- 画刷半径为固定 3D 世界尺度，范围 `1–100`，默认 `8`；折线高度过滤默认 `15`。
- `Ctrl+S` 保存全部待保存标签；当前帧导出标准 `.label`，全 Clip 导出 `.plwlabels`。
- 检测到 Clip 内的视频时，可以使用“默认播放器”调用 Windows 系统默认播放器，不依赖浏览器播放。

| 快捷键 | 功能 |
| --- | --- |
| `N`、`1`–`5` | 视角、画刷、多边形、矩形、套索、折线 |
| `V` | 循环视角 |
| `B` | 鸟瞰与上一次自动透视视角切换 |
| `F` / `G` | 进入或退出飞行视角 |
| `Enter` / 右键 | 应用当前多边形、选区或折线 |
| `Ctrl+S` | 保存全部修改 |
| `Ctrl+Z` / `Ctrl+Y` | 撤销 / 重做 |

工作区请点击左侧工具栏按钮选择，不占用飞行视角的 `W` 移动键。

## 致谢与许可

本项目独立维护，功能和代码参考了 [jbehley/point_labeler](https://github.com/jbehley/point_labeler) 与 [xtreme1-io/xtreme1](https://github.com/xtreme1-io/xtreme1)，不代表官方合作或隶属关系。相关许可证和第三方依赖见 [`NOTICE`](NOTICE)。

本项目代码采用 [MIT License](LICENSE)，允许商业使用、修改和分发，但需保留许可证和版权声明。SemanticKITTI、KITTI 数据及其标签遵守各自的数据许可；本项目不包含专有数据或仓库凭据。

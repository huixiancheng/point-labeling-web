# 开源发布检查 / Open-source release checklist

本文档用于把源码、Windows 发布包、演示视频和公开测试数据组织成一次可复现的 GitHub 发布。它不替代 [`DEVELOPMENT.md`](DEVELOPMENT.md) 的构建说明，也不替代 [`USAGE.md`](USAGE.md) 的用户手册。

## 1. 源码仓库检查

- [ ] 根目录有 `README.md`、`README_EN.md`、`LICENSE`、`NOTICE`、`THIRD_PARTY_NOTICES.md`、`VERSION` 和 `CHANGELOG.md`。
- [ ] README 的中英文入口互相链接，快速开始、支持格式、文档导航和许可证说明一致。
- [ ] `docs/README.md` 中的链接都指向当前文件；没有已经删除的兼容入口或旧目录名。
- [ ] 不提交真实点云、真实标签、日志、账号、令牌、个人路径或浏览器数据。
- [ ] 不提交 `frontend/node_modules`、`frontend/dist`、CMake/Visual Studio 构建目录、Qt 运行库和完整 Windows 包。
- [ ] `assets/SemanticKITTI-00-20frames.zip` 如果保留在仓库中，必须保留其中的 `DATA_LICENSE.txt`；它是测试数据，不是 MIT 代码的一部分。
- [ ] 参考项目、第三方依赖和数据集的许可证在 README / NOTICE 中有明确边界。

## 2. 构建和测试

在干净的输出目录构建 Windows 包：

```powershell
.\windows\build_package.ps1 `
  -QtPrefix "C:\Qt\5.15.2\msvc2019_64" `
  -OutputDir "E:\build\PointLabelingWebOpen-Windows"
```

至少验证：

- [ ] 前端生产构建成功，后端 Release 构建成功。
- [ ] `app/point_labeler_server.exe`、Qt/MSVC 运行库、`app/assets`、`app/web` 齐全。
- [ ] 包根目录有 `NOTICE`、`THIRD_PARTY_NOTICES.md` 和 `QT_LICENSE.txt`。
- [ ] 包根目录只有 `PointLabelerLauncher.exe` 作为日常入口，不包含 BAT、常驻 PowerShell 或 VBS 启动入口。
- [ ] 启动、重复点击启动、停止、退出和端口切换都只影响当前包的服务。
- [ ] 启动器可以自动打开浏览器，默认地址为 `http://localhost:8090/`，并能切换 `auto/high/low`。
- [ ] 关闭启动器后当前包的服务退出；`clips` 和 `logs` 不被更新覆盖。
- [ ] 放入 20 帧测试数据后，能够列出 Clip、打开首帧、切换帧、读取标签并完成一次保存/导出。
- [ ] 中英文界面、深浅背景、界面缩放和集显低性能模式至少各手测一次。

## 3. Windows 包内容

发布目录建议保持如下结构：

```text
PointLabelingWebOpen-Windows-<date>/
├─ PointLabelerLauncher.exe
├─ app/
│  ├─ point_labeler_server.exe
│  ├─ assets/
│  └─ web/
├─ clips/
├─ logs/
├─ update/
├─ LICENSE
├─ NOTICE
├─ THIRD_PARTY_NOTICES.md
├─ QT_LICENSE.txt
├─ VERSION
├─ CHANGELOG.md
├─ README_PACKAGE.txt
└─ README_WINDOWS.md
```

`clips/` 和 `logs/` 是用户数据区；`update/` 只用于放待安装的 `update/app` 和可选的新启动器。发布包中不应出现源码仓库的 `ACKNOWLEDGMENTS.md`、本地测试夹具、构建目录或开发机绝对路径。

## 4. GitHub Release 资产

当前资产组织如下：

- `PointLabelingWebOpen-Windows-<date>.zip`：完整 Windows 包，待上传到 GitHub Release。
- `assets/usage_demo.gif`：完整时长的 README 自动预览，直接随源码仓库提交。
- `assets/usage_demo.mp4`：原始完整演示视频，使用 Git LFS 随私有源码仓库提交；README 通过 raw 地址提供播放/下载，不再依赖 `<source>` 或 Release 资产。
- `assets/SemanticKITTI-00-20frames.zip`：直接提交到仓库的公开 20 帧测试资产。

Release 描述中应写明：代码采用 MIT；测试数据和 SemanticKITTI/KITTI 数据采用各自条款；Windows 包只包含公开格式测试入口，不包含私有数据。

## 5. 发布后抽查

- [ ] 从 GitHub Release 页面下载 ZIP，而不是从开发机目录直接复制。
- [ ] 在一台没有开发环境的 Windows 机器上解压并双击启动器。
- [ ] 用 README 提供的 20 帧数据完成一次从启动到导出的完整流程。
- [ ] 确认 README 中的完整 GIF、MP4 下载链接、Release 链接和中英文切换入口可用。
- [ ] 保存发布包 SHA-256，后续更新只替换 `app` 或启动器，不覆盖用户的 `clips` 和 `logs`。

# 文档导航 / Documentation map

本目录是项目的详细文档区。根目录的 `README.md` 是项目首页和中文默认入口，`README_EN.md` 是英文首页；两者负责概览、快速开始和链接，不重复承载所有维护细节。

## 按读者查找

### 使用者

- [`USAGE.md`](USAGE.md)：Windows 包启动、数据放置、标注、保存、导出和故障排查。
- [`OPEN_FORMATS.md`](OPEN_FORMATS.md)：SemanticKITTI / KITTI 的目录识别、点和标签格式、坐标与导出边界。
- [`../windows/README_WINDOWS.md`](../windows/README_WINDOWS.md)：随 Windows 发布包携带的离线使用说明。
- [`../windows/README_PACKAGE.txt`](../windows/README_PACKAGE.txt)：发布包根目录中的快速提示。

### 开发者和贡献者

- [`../CONTRIBUTING.md`](../CONTRIBUTING.md)：提交代码和文档前的最小检查清单。
- [`DEVELOPMENT.md`](DEVELOPMENT.md)：前端、后端、测试、Windows 构建和贡献约定。
- [`RELEASE.md`](RELEASE.md)：开源发布前检查、Windows 包验收和 GitHub Release 资产组织。
- [`../CHANGELOG.md`](../CHANGELOG.md) / [`../VERSION`](../VERSION)：版本和变更记录。
- [`../SECURITY.md`](../SECURITY.md)：安全边界和漏洞报告方式。
- [`../assets/README.md`](../assets/README.md)：演示视频和 20 帧公开测试数据的资产策略。

### GitHub Wiki

- [`WIKI_USAGE.md`](WIKI_USAGE.md)：可复制到 GitHub Wiki 的使用页源稿。

Wiki 源稿与 `USAGE.md` 有意保持相近，但 Wiki 适合网页阅读，`USAGE.md` 才是仓库内的详细使用说明。修改功能行为时先更新 `USAGE.md`，再同步 Wiki 源稿中的对应段落。

## 文档维护边界

| 内容 | 维护位置 | 其它位置的职责 |
| --- | --- | --- |
| 项目定位、快速开始和公开能力 | `README.md` / `README_EN.md` | 链接到详细文档，不复制完整操作手册 |
| 用户操作和故障排查 | `docs/USAGE.md` | Windows 包保留离线版摘要，Wiki 同步可读版 |
| 数据目录、标签字节格式和坐标约定 | `docs/OPEN_FORMATS.md` | README 只保留最小示例 |
| 构建、测试和贡献 | `docs/DEVELOPMENT.md` | README 只保留最短构建入口 |
| 发布、打包和资产上传 | `docs/RELEASE.md` | README 提供入口 |
| 参考项目和第三方许可说明 | 根 README 的“致谢与参考项目”、`NOTICE` | 不再创建单独的致谢兼容文件 |

如果文档之间出现冲突，优先以当前代码和发布包实际行为为准，并在同一次修改中更新对应的详细文档、README 链接和发布包说明。

## 发布包与源码的区别

源码仓库不提交完整 Windows 包、CMake/Visual Studio 构建目录、Qt 运行库、日志或本地 300 帧夹具。Windows 包由 `windows/build_package.ps1` 生成，包内只提供 `PointLabelerLauncher.exe` 作为日常入口；不要把包内说明误当成源码构建说明。

项目代码使用根目录 [`../LICENSE`](../LICENSE) 的 MIT License。SemanticKITTI 20 帧测试数据包含单独的数据许可说明，不随代码许可证授权。

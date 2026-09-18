# Demo assets

`usage_demo.mp4` 是原始高清界面演示视频；`usage_demo_web.mp4` 是完整压缩版，约 63.8 MB，适合 GitHub 浏览器播放/下载。两个 MP4 都使用 Git LFS 进入私有源码仓库；README 同时提供 GIF 自动预览和压缩 MP4 链接。推荐使用 H.264 MP4。

本地预览：

```text
assets/usage_demo.mp4
assets/usage_demo_web.mp4
assets/usage_demo.gif
```

GitHub README 直接渲染 `usage_demo.gif`；点击 GIF 会打开压缩 MP4。GitHub 仓库首页不会稳定内嵌来自 Git LFS 的 MP4，请通过 README 中的 raw 地址播放/下载，或在本地工作树中打开该文件。首次克隆需要安装 Git LFS。

`SemanticKITTI-00-20frames.zip` 是可直接用于 Windows 包测试的 20 帧数据资产，约 29.6 MB。它包含 `.bin`、`.label`、`poses.txt`、`calib.txt` 和 `DATA_LICENSE.txt`；数据不属于本项目 MIT 代码许可，需遵守 SemanticKITTI 的 CC BY-NC-SA 条款。

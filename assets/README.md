# Demo assets

`usage_demo.mp4` 是 README 和发布说明使用的界面演示视频。视频文件较大，按发布策略不进入源码提交，正式分发时作为 GitHub Release asset 或 GitHub attachment 上传。上传后，把 README 中 `<source>` 的地址替换为 GitHub 生成的资源 URL；推荐使用 H.264 MP4。

本地预览：

```text
assets/usage_demo.mp4
```

如果 GitHub 页面不能直接播放 README 中的内嵌视频，请下载对应 Release 中的 `usage_demo.mp4`，或在本地工作树中打开该文件。

`SemanticKITTI-00-20frames.zip` 是可直接用于 Windows 包测试的 20 帧数据资产，约 29.6 MB。它包含 `.bin`、`.label`、`poses.txt`、`calib.txt` 和 `DATA_LICENSE.txt`；数据不属于本项目 MIT 代码许可，需遵守 SemanticKITTI 的 CC BY-NC-SA 条款。

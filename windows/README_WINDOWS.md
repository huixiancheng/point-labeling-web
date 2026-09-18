# Windows 使用说明（SemanticKITTI / KITTI 开源版）

这份文件随 Windows 发布包提供，面向没有开发环境的使用者。源码构建、测试和贡献说明见仓库中的 `docs/DEVELOPMENT.md`；完整用户手册见 `docs/USAGE.md`。

## 快速开始

解压后保持以下目录关系，不要移动 `app`、`clips`、`logs` 或 `update`：

```text
PointLabelingWebOpen-Windows-<date>/
├─ PointLabelerLauncher.exe
├─ app/
│  ├─ point_labeler_server.exe
│  ├─ assets/
│  └─ web/
├─ clips/
├─ logs/
└─ update/
```

1. 把 SemanticKITTI / KITTI 数据放入 `clips`。
2. 双击 `PointLabelerLauncher.exe`，选择“开启标注”。
3. 服务启动后，浏览器会打开默认地址：`http://localhost:8090/`。
4. 使用完成后选择“结束标注”；也可以直接退出启动器，当前发布包的服务会一起结束。

发布包只使用 `PointLabelerLauncher.exe` 这一个入口，不需要 BAT、PowerShell 或 VBS。启动器提供“开启标注、结束标注、更新、退出程序”四个核心操作，并支持标题栏最小化、隐藏到托盘、修改端口和性能模式。

标题栏“最小化”与“隐藏到托盘”是两个独立功能：最小化会保留任务栏恢复入口；点击启动器内的“隐藏到托盘”后窗口从任务栏隐藏，服务继续运行，只通过托盘恢复。托盘图标支持单击恢复，右键可显示、开启、结束或退出程序。关闭窗口或选择托盘“退出程序”时，会先提醒网页可能存在未保存标签，请先确认页面显示“0 个待保存”；确认退出后才会结束当前包服务。

## 数据目录

推荐把 SemanticKITTI 序列放成：

```text
clips/
└─ semantic_kitti/
   └─ sequences/
      └─ 00/
         ├─ velodyne/000000.bin
         ├─ labels/000000.label       # 可选
         ├─ poses.txt                 # 可选，用于帧堆叠
         └─ calib.txt                 # 可选，与 poses.txt 配合
```

服务会递归识别 `velodyne` 下的编号帧；多个 Clip 会在页面顶部列出。KITTI Object 的 `label_2/*.txt` 是 3D 框标注，不会被当成逐点 `.label` 文件。

## 性能和端口

- `auto`：根据浏览器 GPU 信息选择默认配置。
- `high`：默认加载 200 帧，适合独立显卡。
- `low`：默认只加载当前帧，适合集显或内存/显存紧张的电脑。

性能模式只改变浏览器加载窗口和显示范围，不修改源点云和标签文件。网页支持中文和 English，顶部也可以调整背景、标注颜色和界面缩放。

如果 `8090` 被其它服务占用，在启动器中改用空闲端口，例如 `18090`，然后访问对应的 `http://localhost:18090/`。

## 保存和更新

- `Ctrl+S`：保存全部待保存帧。
- “保存当前帧”：只保存当前帧。
- “导出当前帧标签”：导出标准 `.label`。
- “导出 Clip 标签”：导出本工具的 `.plwlabels` 容器。

更新时将新版本的 `app` 放入 `update\app`；如果启动器也更新，同时放入 `update\PointLabelerLauncher.exe`，再选择“更新”。更新不会覆盖 `clips` 和 `logs`。

## 启动失败排查

1. 先查看 `logs\server.log`。
2. 确认 `app\point_labeler_server.exe`、`app\assets` 和 `app\web` 存在。
3. 确认端口没有被其它程序占用。
4. 确认数据目录中存在 `velodyne` 和连续编号的 `.bin` 文件。

代码采用根目录 `LICENSE` 中的 MIT License；SemanticKITTI / KITTI 数据及其标签遵守各自的数据条款。发布包中的 `NOTICE` 和 `THIRD_PARTY_NOTICES.md` 记录第三方依赖、Qt、MSVC 运行库和参考项目的许可边界；如果包中存在 `QT_LICENSE.txt`，也必须随包保留。

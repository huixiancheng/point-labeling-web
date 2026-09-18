# SemanticKITTI / KITTI 数据说明

## 1. 识别规则

服务不把整个父目录合并成一个点云。它会把以下目录识别为独立的数据单元：

- `sequences/<sequence>/velodyne/*.bin` 的 `<sequence>`；
- `training/velodyne/*.bin` 或 `testing/velodyne/*.bin`；
- 含有 `velodyne/*.bin` 的其它目录；
- 直接含有 `*.bin` 的目录。

因此可以把多个序列放在 `clips` 下，也可以把 `clips` 指向完整 SemanticKITTI 根目录。

## 2. 点和标签

每个 `.bin` 文件按 16 字节读取：

```text
float32 x, float32 y, float32 z, float32 remission
```

每个 `.label` 文件按 4 字节读取：

```text
uint32 word = (instance_id << 16) | semantic_id
```

浏览器使用 24 字节帧记录：`x,y,z,frameIndex,pointIndex,semantic`。服务每次只读取请求的帧窗口，窗口内不抽点；集显机器可以在页面选择单帧模式降低显存和浏览器缓冲压力。

## 3. SemanticKITTI 类别映射

标准 SemanticKITTI 标签文件的低 16 位是源语义 id，例如 `10=car`、`40=road`、`252=moving-car`。页面显示的是官方 `learning_map` 的 20 类训练 id：

```text
0 未标注       1 小汽车       2 自行车       3 摩托车
4 卡车         5 其他车辆     6 行人         7 骑自行车的人
8 骑摩托车的人 9 道路         10 停车区      11 人行道
12 其他地面    13 建筑物      14 围栏        15 植被
16 树干        17 地形        18 杆          19 交通标志
```

读取时原始标签映射到页面 id；保存时只转换被编辑点的低 16 位。已有 instance id 的高 16 位会保留；缺失标签文件的点显示为未知，第一次保存会创建标签目录和完整帧长度的 `.label` 文件。

## 4. KITTI Object 的边界

KITTI Object 的 `label_2/*.txt` 描述相机坐标系中的 3D 目标框，不是与 Velodyne 点一一对应的逐点语义标签。因此本版本不会把文本框标签误读为点标签，也不会覆盖它们。若需要逐点标注，服务使用 `labels/<frame>.label` 作为旁路文件，格式与 SemanticKITTI 的 uint32 流相同；KITTI Object 的框可在后续版本作为独立 overlay 功能接入。

没有 SemanticKITTI 原生 `.label` 的 KITTI 或普通 `.bin` 数据，页面仍使用同一套 20 类编辑面板；保存时直接把页面语义 id（0–19）写入 `uint32` 的低 16 位，高 16 位保留为 0。此类数据在接口中的 `labelSchema` 为 `generic_semantic_20`。

## 5. 坐标系与 pose

如果序列中存在与帧数匹配的 `poses.txt` 和 `calib.txt`，服务会按 SemanticKITTI/KITTI 的约定将相机坐标 pose 转成 LiDAR pose：

```text
T_lidar = Tr^-1 · T_camera · Tr
```

随后以第 0 帧为固定原点，把每帧点变换到同一个“序列局部 LiDAR 坐标系”。旋转使用完整的 3D 旋转矩阵，因此会同时纳入航向、俯仰和横滚；帧窗口滑动时坐标不会跟着当前帧跳动。点的 `frameIndex`、`pointIndex` 和标签索引仍保持原始 `.bin/.label` 对应关系，pose 只改变显示坐标，不修改源文件。

如果 pose 或标定缺失、格式无效或数量不足，服务会安全回退到 `.bin` 的逐帧 LiDAR 坐标，并在接口元数据中报告 `coordinateSystem` 为 `per-scan lidar coordinates`。检测到对齐时则报告 `dataset-local pose-aligned lidar coordinates`。

## 6. 导出

- 当前帧：下载 `<frame>.label`，内容是可直接被 SemanticKITTI/KITTI 风格工具读取的原始 uint32 流；
- 全部帧：下载 `.plwlabels` 容器，包含帧索引、帧名、点数和每帧完整 `.label` 字节；
- 页面保存：直接原子写回每帧同级 `labels/<frame>.label`。对无标签的 KITTI 目录，首次保存会创建 `labels` 目录。

`.plwlabels` 是本工具的批量传输容器，不替代数据集原生目录结构；如要交给 SemanticKITTI 原生工具，使用解包后的各帧 `.label` 文件。

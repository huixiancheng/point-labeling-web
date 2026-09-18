#include "io/OpenDataset.h"

#include <QDir>
#include <QDirIterator>
#include <QFile>
#include <QFileInfo>
#include <QRegularExpression>
#include <QSaveFile>
#include <QSet>
#include <QStringList>

#include <algorithm>
#include <array>
#include <cmath>
#include <cstring>
#include <limits>
#include <set>

namespace plm {
namespace {

constexpr uint16_t kUnknownLabel = 255;

QString canonicalPath(const QString& value) {
  return QFileInfo(value).canonicalFilePath();
}

void setError(QString* error, const QString& value) {
  if (error) *error = value;
}

bool isBinFile(const QFileInfo& info) {
  return info.isFile() && info.suffix().compare(QStringLiteral("bin"), Qt::CaseInsensitive) == 0;
}

QFileInfoList sortedBins(const QDir& dir) {
  QFileInfoList files = dir.entryInfoList(QStringList() << QStringLiteral("*.bin"),
                                          QDir::Files | QDir::Readable,
                                          QDir::Name | QDir::IgnoreCase);
  std::sort(files.begin(), files.end(), [](const QFileInfo& left, const QFileInfo& right) {
    bool leftNumber = false;
    bool rightNumber = false;
    const qulonglong leftValue = left.completeBaseName().toULongLong(&leftNumber);
    const qulonglong rightValue = right.completeBaseName().toULongLong(&rightNumber);
    if (leftNumber && rightNumber && leftValue != rightValue) return leftValue < rightValue;
    return QString::compare(left.fileName(), right.fileName(), Qt::CaseInsensitive) < 0;
  });
  return files;
}

QString labelDirectoryFor(const QDir& pointDirectory) {
  if (pointDirectory.dirName().compare(QStringLiteral("velodyne"), Qt::CaseInsensitive) == 0) {
    QDir parent = pointDirectory;
    parent.cdUp();
    return parent.filePath(QStringLiteral("labels"));
  }
  const QString sibling = pointDirectory.filePath(QStringLiteral("labels"));
  if (QDir(sibling).exists()) return sibling;
  return pointDirectory.absolutePath();
}

QString labelPathFor(const QString& pointDirectory, const QString& frameId) {
  const QDir points(pointDirectory);
  return QDir(labelDirectoryFor(points)).filePath(frameId + QStringLiteral(".label"));
}

bool hasAnyPointLabels(const QString& labelDirectory, const QFileInfoList& bins) {
  const QDir labels(labelDirectory);
  if (!labels.exists()) return false;
  for (const QFileInfo& bin : bins) {
    if (QFileInfo::exists(labels.filePath(bin.completeBaseName() + QStringLiteral(".label")))) return true;
  }
  return false;
}

bool looksLikeObjectKitti(const QDir& datasetDir) {
  const QString name = datasetDir.dirName().toLower();
  const bool objectSplit = name == QStringLiteral("training") || name == QStringLiteral("testing");
  return objectSplit &&
         (QDir(datasetDir.filePath(QStringLiteral("label_2"))).exists() ||
          QDir(datasetDir.filePath(QStringLiteral("calib"))).exists());
}

QString formatFor(const QDir& datasetDir, const QDir& points, const QFileInfoList& bins) {
  if (looksLikeObjectKitti(datasetDir)) return QStringLiteral("kitti_object");
  const bool pointLabels = hasAnyPointLabels(labelDirectoryFor(points), bins);
  if (pointLabels) return QStringLiteral("semantickitti");
  if (datasetDir.dirName().compare(QStringLiteral("velodyne"), Qt::CaseInsensitive) == 0 ||
      QDir(datasetDir.filePath(QStringLiteral("poses"))).exists() ||
      QFileInfo::exists(datasetDir.filePath(QStringLiteral("poses.txt"))) ||
      QFileInfo::exists(datasetDir.filePath(QStringLiteral("calib.txt")))) {
    return QStringLiteral("kitti_odometry");
  }
  return QStringLiteral("kitti_bin");
}

// SemanticKITTI's official config maps original ids to the 20 training ids.
// The map is intentionally kept here rather than requiring PyYAML or another
// runtime dependency.  A missing/unusual id remains visible as unknown.
uint16_t semanticKittiLearningId(uint32_t raw) {
  static const std::array<int, 260> map = [] {
    std::array<int, 260> result{};
    result.fill(0);
    result[10] = 1;  result[11] = 2;  result[13] = 5;  result[15] = 3;
    result[16] = 5;  result[18] = 4;  result[20] = 5;  result[30] = 6;
    result[31] = 7;  result[32] = 8;  result[40] = 9;  result[44] = 10;
    result[48] = 11; result[49] = 12; result[50] = 13; result[51] = 14;
    result[52] = 0;  result[60] = 9;  result[70] = 15; result[71] = 16;
    result[72] = 17; result[80] = 18; result[81] = 19; result[99] = 0;
    result[252] = 1; result[253] = 7; result[254] = 6; result[255] = 8;
    result[256] = 5; result[257] = 5; result[258] = 4; result[259] = 5;
    return result;
  }();
  if (raw < map.size()) return static_cast<uint16_t>(map[raw]);
  return kUnknownLabel;
}

uint32_t semanticKittiOriginalId(uint16_t display) {
  // learning_map_inv from the official semantic-kitti.yaml.  0 represents
  // unlabeled/ignored; callers keep the old instance bits separately.
  static const std::array<uint32_t, 20> inverse = {
      0, 10, 11, 15, 18, 20, 30, 31, 32, 40,
      44, 48, 49, 50, 51, 70, 71, 72, 80, 81};
  return display < inverse.size() ? inverse[display] : 0u;
}

std::vector<uint32_t> readWords(const QString& path, size_t pointCount) {
  std::vector<uint32_t> labels(pointCount, std::numeric_limits<uint32_t>::max());
  if (path.isEmpty() || pointCount == 0) return labels;
  QFile file(path);
  if (!file.exists() || !file.open(QIODevice::ReadOnly)) return labels;
  const qint64 availableBytes = file.size();
  if (availableBytes <= 0) return labels;
  const size_t available = static_cast<size_t>(availableBytes / static_cast<qint64>(sizeof(uint32_t)));
  const size_t count = std::min(pointCount, available);
  const QByteArray bytes = file.read(static_cast<qint64>(count * sizeof(uint32_t)));
  if (static_cast<size_t>(bytes.size()) >= count * sizeof(uint32_t)) {
    std::memcpy(labels.data(), bytes.constData(), count * sizeof(uint32_t));
  }
  return labels;
}

void addUniquePath(QStringList& paths, const QString& value) {
  const QString canonical = canonicalPath(value);
  if (canonical.isEmpty()) return;
  for (const QString& existing : paths) {
    if (canonicalPath(existing) == canonical) return;
  }
  paths << canonical;
}

using Matrix4 = std::array<double, 16>;

Matrix4 identityMatrix() {
  Matrix4 result{};
  result[0] = 1.0;
  result[5] = 1.0;
  result[10] = 1.0;
  result[15] = 1.0;
  return result;
}

Matrix4 multiplyMatrix(const Matrix4& left, const Matrix4& right) {
  Matrix4 result{};
  for (int row = 0; row < 4; ++row) {
    for (int column = 0; column < 4; ++column) {
      double value = 0.0;
      for (int k = 0; k < 4; ++k) value += left[row * 4 + k] * right[k * 4 + column];
      result[row * 4 + column] = value;
    }
  }
  return result;
}

bool parseFiniteDouble(const QString& token, double& value) {
  bool ok = false;
  value = token.toDouble(&ok);
  return ok && std::isfinite(value);
}

bool parseMatrix12(const QStringList& tokens, Matrix4& result) {
  if (tokens.size() < 12) return false;
  result = identityMatrix();
  for (int index = 0; index < 12; ++index) {
    if (!parseFiniteDouble(tokens[index], result[static_cast<size_t>(index)])) return false;
  }
  return true;
}

QStringList numericTokens(QString line) {
  line.remove(QChar(0xfeff));
  const int comment = line.indexOf(QChar('#'));
  if (comment >= 0) line.truncate(comment);
  return line.trimmed().split(QRegularExpression(QStringLiteral("\\s+")), Qt::SkipEmptyParts);
}

bool parsePoseFile(const QString& path, std::vector<Matrix4>& poses) {
  QFile file(path);
  if (!file.open(QIODevice::ReadOnly | QIODevice::Text)) return false;
  const QStringList lines = QString::fromUtf8(file.readAll()).split(
      QRegularExpression(QStringLiteral("[\\r\\n]")), Qt::SkipEmptyParts);
  for (const QString& sourceLine : lines) {
    const QStringList tokens = numericTokens(sourceLine);
    if (tokens.isEmpty()) continue;
    Matrix4 pose{};
    if (!parseMatrix12(tokens, pose)) return false;
    poses.push_back(pose);
  }
  return !poses.empty();
}

bool parseCalibrationFile(const QString& path, Matrix4& veloToCamera) {
  QFile file(path);
  if (!file.open(QIODevice::ReadOnly | QIODevice::Text)) return false;
  const QStringList lines = QString::fromUtf8(file.readAll()).split(
      QRegularExpression(QStringLiteral("[\\r\\n]")), Qt::SkipEmptyParts);
  for (const QString& sourceLine : lines) {
    QString line = sourceLine;
    line.remove(QChar(0xfeff));
    const int comment = line.indexOf(QChar('#'));
    if (comment >= 0) line.truncate(comment);
    const int separator = line.indexOf(QChar(':'));
    if (separator < 0) continue;
    const QString key = line.left(separator).trimmed().toLower();
    if (key != QStringLiteral("tr") && key != QStringLiteral("tr_velo_to_cam") &&
        key != QStringLiteral("tr_velodyne_to_cam")) {
      continue;
    }
    const QStringList tokens = numericTokens(line.mid(separator + 1));
    return parseMatrix12(tokens, veloToCamera);
  }
  return false;
}

QString firstExistingFile(const QStringList& candidates) {
  for (const QString& candidate : candidates) {
    const QFileInfo info(candidate);
    if (info.exists() && info.isFile() && info.isReadable()) return info.canonicalFilePath();
  }
  return {};
}

QString sequenceIdFor(const QString& datasetPath) {
  const QFileInfo info(datasetPath);
  const QDir parent = info.dir();
  if (parent.dirName().compare(QStringLiteral("sequences"), Qt::CaseInsensitive) == 0) {
    return info.fileName();
  }
  return {};
}

QString datasetRootFor(const QString& datasetPath, const QString& sequenceId) {
  const QFileInfo info(datasetPath);
  if (sequenceId.isEmpty()) return info.absolutePath();
  QDir root = info.dir();
  root.cdUp();
  return root.absolutePath();
}

struct PoseAlignment {
  bool valid = false;
  QString posePath;
  QString calibrationPath;
  std::vector<Matrix4> transforms;
};

bool invertRigidMatrix(const Matrix4& input, Matrix4& inverse) {
  for (double value : input) {
    if (!std::isfinite(value)) return false;
  }

  // KITTI poses and Tr are rigid transforms.  Inverting them as R^T and
  // -R^T*t avoids a general-purpose matrix inverse for every dataset.
  inverse = identityMatrix();
  inverse[0] = input[0];
  inverse[1] = input[4];
  inverse[2] = input[8];
  inverse[4] = input[1];
  inverse[5] = input[5];
  inverse[6] = input[9];
  inverse[8] = input[2];
  inverse[9] = input[6];
  inverse[10] = input[10];
  inverse[3] = -(inverse[0] * input[3] + inverse[1] * input[7] + inverse[2] * input[11]);
  inverse[7] = -(inverse[4] * input[3] + inverse[5] * input[7] + inverse[6] * input[11]);
  inverse[11] = -(inverse[8] * input[3] + inverse[9] * input[7] + inverse[10] * input[11]);
  return true;
}

PoseAlignment loadPoseAlignment(const QString& datasetPath, size_t frameCount) {
  PoseAlignment result;
  if (frameCount == 0) return result;

  const QString sequenceId = sequenceIdFor(datasetPath);
  const QString datasetRoot = datasetRootFor(datasetPath, sequenceId);
  QStringList poseCandidates;
  poseCandidates << QDir(datasetPath).filePath(QStringLiteral("poses.txt"))
                 << QDir(datasetPath).filePath(QStringLiteral("pose.txt"));
  if (!sequenceId.isEmpty()) {
    poseCandidates << QDir(datasetRoot).filePath(QStringLiteral("poses/%1.txt").arg(sequenceId))
                   << QDir(datasetRoot).filePath(QStringLiteral("pose/%1.txt").arg(sequenceId));
  }
  const QString posePath = firstExistingFile(poseCandidates);
  if (posePath.isEmpty()) return result;

  QStringList calibrationCandidates;
  calibrationCandidates << QDir(datasetPath).filePath(QStringLiteral("calib.txt"));
  if (!sequenceId.isEmpty()) {
    calibrationCandidates << QDir(datasetRoot).filePath(QStringLiteral("calib/%1.txt").arg(sequenceId));
  }
  const QString calibrationPath = firstExistingFile(calibrationCandidates);
  if (calibrationPath.isEmpty()) return result;

  std::vector<Matrix4> cameraPoses;
  Matrix4 veloToCamera{};
  if (!parsePoseFile(posePath, cameraPoses) || cameraPoses.size() < frameCount ||
      !parseCalibrationFile(calibrationPath, veloToCamera)) {
    return result;
  }

  Matrix4 calibrationInverse{};
  if (!invertRigidMatrix(veloToCamera, calibrationInverse)) return result;

  std::vector<Matrix4> lidarPoses;
  lidarPoses.reserve(frameCount);
  for (size_t index = 0; index < frameCount; ++index) {
    // SemanticKITTI/KITTI poses are camera-frame poses.  Convert them to
    // Velodyne/LiDAR poses using the same convention as the official API.
    lidarPoses.push_back(multiplyMatrix(
        multiplyMatrix(calibrationInverse, cameraPoses[index]), veloToCamera));
  }

  Matrix4 originInverse{};
  if (!invertRigidMatrix(lidarPoses.front(), originInverse)) return result;
  result.transforms.reserve(frameCount);
  for (const Matrix4& lidarPose : lidarPoses) {
    // Keep frame 0 fixed at the origin.  This gives the browser a stable
    // coordinate system while the visible frame window slides.
    result.transforms.push_back(multiplyMatrix(originInverse, lidarPose));
  }
  result.valid = true;
  result.posePath = posePath;
  result.calibrationPath = calibrationPath;
  return result;
}

}  // namespace

bool OpenDataset::inspect(const QString& path, OpenDatasetInfo& out, QString* error) {
  out = {};
  QFileInfo input(path);
  if (!input.exists()) {
    setError(error, QStringLiteral("数据路径不存在"));
    return false;
  }

  QDir pointDirectory;
  QString datasetPath;
  if (input.isFile()) {
    if (!isBinFile(input)) {
      setError(error, QStringLiteral("只支持 .bin 点云文件"));
      return false;
    }
    pointDirectory = input.dir();
    datasetPath = input.absolutePath();
  } else {
    QDir dir(input.absoluteFilePath());
    if (dir.dirName().compare(QStringLiteral("velodyne"), Qt::CaseInsensitive) == 0) {
      pointDirectory = dir;
      QDir parent = dir;
      parent.cdUp();
      datasetPath = parent.absolutePath();
    } else if (QDir(dir.filePath(QStringLiteral("velodyne"))).exists()) {
      pointDirectory = QDir(dir.filePath(QStringLiteral("velodyne")));
      datasetPath = dir.absolutePath();
    } else if (!sortedBins(dir).isEmpty()) {
      pointDirectory = dir;
      datasetPath = dir.absolutePath();
    } else {
      setError(error, QStringLiteral("目录中没有 velodyne/*.bin 或 .bin 文件"));
      return false;
    }
  }

  const QFileInfoList bins = sortedBins(pointDirectory);
  if (bins.isEmpty()) {
    setError(error, QStringLiteral("没有找到 .bin 帧文件"));
    return false;
  }

  out.path = canonicalPath(datasetPath);
  out.format = formatFor(QDir(out.path), pointDirectory, bins);
  out.labelSchema = out.format == QStringLiteral("semantickitti")
                        ? QStringLiteral("semantickitti_learning_20")
                        : QStringLiteral("generic_semantic_20");
  out.labelClassCount = 20;
  out.frames.reserve(static_cast<size_t>(bins.size()));
  for (uint32_t i = 0; i < static_cast<uint32_t>(bins.size()); ++i) {
    const QFileInfo& bin = bins[static_cast<int>(i)];
    const qint64 bytes = bin.size();
    if (bytes < 0 || bytes % (sizeof(float) * 4) != 0) {
      setError(error, QStringLiteral("帧 %1 不是 4×float32 的 KITTI .bin 文件").arg(bin.fileName()));
      out = {};
      return false;
    }
    const uint64_t pointCount = static_cast<uint64_t>(bytes / (sizeof(float) * 4));
    if (pointCount > std::numeric_limits<uint32_t>::max()) {
      setError(error, QStringLiteral("帧 %1 点数超过 uint32 索引范围").arg(bin.fileName()));
      out = {};
      return false;
    }
    const QString frameId = bin.completeBaseName();
    const QString labelPath = labelPathFor(pointDirectory.absolutePath(), frameId);
    out.frames.push_back({i, frameId, bin.absoluteFilePath(), labelPath, pointCount,
                          QFileInfo::exists(labelPath)});
  }

  const PoseAlignment alignment = loadPoseAlignment(out.path, out.frames.size());
  if (alignment.valid) {
    out.poseAligned = true;
    out.posePath = alignment.posePath;
    out.calibrationPath = alignment.calibrationPath;
    out.frameTransforms = alignment.transforms;
  }
  return true;
}

QStringList OpenDataset::discoverPaths(const QString& root) {
  QStringList result;
  QFileInfo input(root);
  if (!input.exists()) return result;
  if (input.isFile()) {
    if (isBinFile(input)) result << input.absoluteFilePath();
    return result;
  }

  const QString canonicalRoot = canonicalPath(input.absoluteFilePath());
  if (canonicalRoot.isEmpty()) return result;
  OpenDatasetInfo direct;
  if (inspect(canonicalRoot, direct, nullptr)) {
    result << canonicalRoot;
    return result;
  }

  // Find directories named velodyne.  Its parent is one sequence/split unit
  // for both SemanticKITTI and KITTI.  This naturally supports
  // <root>/sequences/00 and <root>/<dataset>/sequences/00 without imposing a
  // private Clip naming convention.
  QDirIterator iterator(canonicalRoot, QStringList() << QStringLiteral("velodyne"),
                         QDir::Dirs | QDir::NoDotAndDotDot, QDirIterator::Subdirectories);
  while (iterator.hasNext()) {
    const QString velodyne = iterator.next();
    QDir parent(velodyne);
    if (sortedBins(parent).isEmpty()) continue;
    addUniquePath(result, parent.absolutePath());
  }

  // Also accept a data root containing .bin files directly, even if the root
  // was empty when the direct inspect above was attempted due to a bad label.
  if (result.isEmpty()) {
    QDirIterator bins(canonicalRoot, QStringList() << QStringLiteral("*.bin"),
                      QDir::Files | QDir::NoDotAndDotDot, QDirIterator::Subdirectories);
    QSet<QString> parents;
    while (bins.hasNext()) parents.insert(QFileInfo(bins.next()).dir().absolutePath());
    for (const QString& parent : parents) {
      OpenDatasetInfo candidate;
      if (inspect(parent, candidate, nullptr)) addUniquePath(result, parent);
    }
  }
  std::sort(result.begin(), result.end(), [](const QString& left, const QString& right) {
    return QString::compare(left, right, Qt::CaseInsensitive) < 0;
  });
  return result;
}

bool OpenDataset::isSupported(const QString& path) {
  OpenDatasetInfo info;
  return inspect(path, info, nullptr);
}

QString OpenDataset::suggestedId(const QString& path) {
  QFileInfo info(path);
  if (info.isFile()) return info.completeBaseName();
  const QString base = info.fileName();
  QDir parent = info.dir();
  if (base.compare(QStringLiteral("velodyne"), Qt::CaseInsensitive) == 0) return parent.dirName();
  if (parent.dirName().compare(QStringLiteral("sequences"), Qt::CaseInsensitive) == 0) {
    return QStringLiteral("sequence-") + base;
  }
  return base.isEmpty() ? QStringLiteral("dataset") : base;
}

std::vector<uint32_t> OpenDataset::readRawLabels(const QString& labelPath, size_t pointCount) {
  return readWords(labelPath, pointCount);
}

uint16_t OpenDataset::displaySemantic(uint32_t rawLabel, const QString& format) {
  const uint32_t rawSemantic = rawLabel & 0xffffu;
  if (rawLabel == std::numeric_limits<uint32_t>::max()) return kUnknownLabel;
  if (format == QStringLiteral("semantickitti")) return semanticKittiLearningId(rawSemantic);
  return rawSemantic <= 255u ? static_cast<uint16_t>(rawSemantic) : kUnknownLabel;
}

uint32_t OpenDataset::storedSemantic(uint16_t displayLabel, const QString& format) {
  if (displayLabel == kUnknownLabel) {
    return format == QStringLiteral("semantickitti") ? 0u : static_cast<uint32_t>(kUnknownLabel);
  }
  if (format == QStringLiteral("semantickitti")) return semanticKittiOriginalId(displayLabel);
  return displayLabel;
}

bool OpenDataset::readFrameRange(const OpenDatasetInfo& dataset, uint32_t startFrame,
                                 uint32_t endFrame, std::vector<FramePoint>& points,
                                 QString* error) {
  points.clear();
  if (dataset.frames.empty() || startFrame > endFrame || startFrame >= dataset.frames.size()) {
    setError(error, QStringLiteral("无效帧范围"));
    return false;
  }
  endFrame = std::min<uint32_t>(endFrame, static_cast<uint32_t>(dataset.frames.size() - 1));
  uint64_t reserveCount = 0;
  for (uint32_t i = startFrame; i <= endFrame; ++i) reserveCount += dataset.frames[i].pointCount;
  if (reserveCount <= static_cast<uint64_t>(std::numeric_limits<size_t>::max())) {
    points.reserve(static_cast<size_t>(reserveCount));
  }
  const bool usePoseAlignment = dataset.poseAligned &&
                                dataset.frameTransforms.size() >= dataset.frames.size();

  for (uint32_t frameIndex = startFrame; frameIndex <= endFrame; ++frameIndex) {
    const OpenFrameInfo& frame = dataset.frames[frameIndex];
    QFile bin(frame.binPath);
    if (!bin.open(QIODevice::ReadOnly)) {
      setError(error, QStringLiteral("无法读取帧 %1").arg(frame.frameId));
      return false;
    }
    const QByteArray pointBytes = bin.readAll();
    if (static_cast<uint64_t>(pointBytes.size()) < frame.pointCount * sizeof(float) * 4) {
      setError(error, QStringLiteral("无法完整读取帧 %1").arg(frame.frameId));
      return false;
    }
    const std::vector<uint32_t> labels = readRawLabels(frame.labelPath, static_cast<size_t>(frame.pointCount));
    for (uint32_t pointIndex = 0; pointIndex < static_cast<uint32_t>(frame.pointCount); ++pointIndex) {
      std::array<float, 4> raw{};
      std::memcpy(raw.data(), pointBytes.constData() + static_cast<size_t>(pointIndex) * sizeof(raw), sizeof(raw));
      const uint32_t rawLabel = pointIndex < labels.size() ? labels[pointIndex] : kUnknownLabel;
      float x = raw[0];
      float y = raw[1];
      float z = raw[2];
      if (usePoseAlignment) {
        const Matrix4& transform = dataset.frameTransforms[frameIndex];
        x = static_cast<float>(transform[0] * raw[0] + transform[1] * raw[1] +
                               transform[2] * raw[2] + transform[3]);
        y = static_cast<float>(transform[4] * raw[0] + transform[5] * raw[1] +
                               transform[6] * raw[2] + transform[7]);
        z = static_cast<float>(transform[8] * raw[0] + transform[9] * raw[1] +
                               transform[10] * raw[2] + transform[11]);
      }
      points.push_back({x, y, z, frameIndex, pointIndex,
                        displaySemantic(rawLabel, dataset.format)});
    }
  }
  return true;
}

bool OpenDataset::applySemanticPatch(const OpenFrameInfo& frame, size_t pointCount,
                                     const std::vector<std::pair<uint32_t, uint16_t>>& edits,
                                     const QString& format, QString* error) {
  if (pointCount == 0 || pointCount > std::numeric_limits<size_t>::max() / sizeof(uint32_t)) {
    setError(error, QStringLiteral("pointCount 无效"));
    return false;
  }
  std::vector<uint32_t> labels = readRawLabels(frame.labelPath, pointCount);
  // readRawLabels uses UINT32_MAX as an in-memory sentinel for a missing or
  // truncated source file.  Do not write that sentinel back to a public
  // SemanticKITTI/KITTI label stream: materialize missing points as the
  // format's ordinary unlabeled value before applying sparse edits.
  const uint32_t defaultValue = format == QStringLiteral("semantickitti") ? 0u : 255u;
  for (uint32_t& label : labels) {
    if (label == std::numeric_limits<uint32_t>::max()) label = defaultValue;
  }
  for (const auto& edit : edits) {
    if (edit.first >= labels.size()) continue;
    const uint32_t prior = labels[edit.first] == std::numeric_limits<uint32_t>::max() ? 0u : labels[edit.first];
    labels[edit.first] = (prior & 0xffff0000u) |
                         (storedSemantic(edit.second, format) & 0xffffu);
  }
  QFileInfo info(frame.labelPath);
  if (!info.dir().exists() && !info.dir().mkpath(QStringLiteral("."))) {
    setError(error, QStringLiteral("无法创建标签目录"));
    return false;
  }
  QSaveFile output(frame.labelPath);
  if (!output.open(QIODevice::WriteOnly)) {
    setError(error, QStringLiteral("无法写入标签文件：%1").arg(frame.labelPath));
    return false;
  }
  const qint64 bytes = static_cast<qint64>(labels.size() * sizeof(uint32_t));
  if (output.write(reinterpret_cast<const char*>(labels.data()), bytes) != bytes || !output.commit()) {
    setError(error, QStringLiteral("写入标签文件失败：%1").arg(frame.labelPath));
    return false;
  }
  return true;
}

std::string OpenDataset::rawLabelBytes(const QString& labelPath) {
  QFile file(labelPath);
  if (!file.open(QIODevice::ReadOnly)) return {};
  const QByteArray bytes = file.readAll();
  return std::string(bytes.constData(), static_cast<size_t>(bytes.size()));
}

}  // namespace plm

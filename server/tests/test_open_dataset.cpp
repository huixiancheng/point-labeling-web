#include "io/OpenDataset.h"

#include <QCoreApplication>
#include <QDir>
#include <QFile>
#include <QTemporaryDir>

#include <cstdint>
#include <cmath>
#include <cstring>
#include <iostream>
#include <vector>

namespace {

bool writeBinary(const QString& path, const void* data, qint64 size) {
  QFile file(path);
  return file.open(QIODevice::WriteOnly) && file.write(static_cast<const char*>(data), size) == size;
}

bool require(bool value, const char* message) {
  if (!value) std::cerr << "FAIL: " << message << '\n';
  return value;
}

}  // namespace

int main(int argc, char** argv) {
  QCoreApplication app(argc, argv);
  QTemporaryDir temporary;
  if (!require(temporary.isValid(), "temporary directory")) return 1;
  const QString sequence = QDir(temporary.path()).filePath(QStringLiteral("sequences/00"));
  if (!require(QDir().mkpath(QDir(sequence).filePath(QStringLiteral("velodyne"))), "velodyne directory") ||
      !require(QDir().mkpath(QDir(sequence).filePath(QStringLiteral("labels"))), "labels directory")) return 1;

  const float points[] = {1.f, 2.f, 3.f, 0.5f, -1.f, 0.f, 4.f, 0.25f};
  const uint32_t rawLabels[] = {10u, 252u}; // car and moving-car -> learning id 1
  if (!require(writeBinary(QDir(sequence).filePath(QStringLiteral("velodyne/000000.bin")), points, sizeof(points)), "write bin") ||
      !require(writeBinary(QDir(sequence).filePath(QStringLiteral("labels/000000.label")), rawLabels, sizeof(rawLabels)), "write labels")) return 1;

  plm::OpenDatasetInfo info;
  QString error;
  if (!require(plm::OpenDataset::inspect(sequence, info, &error), "inspect SemanticKITTI")) return 1;
  if (!require(info.format == QStringLiteral("semantickitti"), "format") ||
      !require(info.frames.size() == 1, "frame count") ||
      !require(info.frames[0].pointCount == 2, "point count")) return 1;

  std::vector<plm::FramePoint> loaded;
  if (!require(plm::OpenDataset::readFrameRange(info, 0, 0, loaded, &error), "read frame") ||
      !require(loaded.size() == 2, "loaded point count") ||
      !require(loaded[0].semantic == 1 && loaded[1].semantic == 1, "learning-map labels")) return 1;

  if (!require(plm::OpenDataset::applySemanticPatch(info.frames[0], 2, {{0u, 9u}}, info.format, &error), "patch label")) return 1;
  QFile saved(info.frames[0].labelPath);
  if (!require(saved.open(QIODevice::ReadOnly), "open saved label")) return 1;
  const QByteArray bytes = saved.readAll();
  uint32_t savedLabels[2]{};
  if (!require(bytes.size() == static_cast<int>(sizeof(savedLabels)), "saved label size")) return 1;
  std::memcpy(savedLabels, bytes.constData(), sizeof(savedLabels));
  if (!require((savedLabels[0] & 0xffffu) == 40u, "learning-map inverse") ||
      !require((savedLabels[1] & 0xffffu) == 252u, "untouched source label")) return 1;

  // A first save on a sequence without a label file writes ordinary
  // unlabeled values, not the reader's internal missing-file sentinel.
  const QString newLabelPath = QDir(sequence).filePath(QStringLiteral("labels/000001.label"));
  plm::OpenFrameInfo newFrame{1u, QStringLiteral("000001"), QString(), newLabelPath, 3u, false};
  if (!require(plm::OpenDataset::applySemanticPatch(newFrame, 3u, {{1u, 9u}}, info.format, &error),
               "create missing label")) return 1;
  QFile created(newLabelPath);
  if (!require(created.open(QIODevice::ReadOnly), "open created label")) return 1;
  const QByteArray createdBytes = created.readAll();
  uint32_t createdLabels[3]{};
  if (!require(createdBytes.size() == static_cast<int>(sizeof(createdLabels)), "created label size")) return 1;
  std::memcpy(createdLabels, createdBytes.constData(), sizeof(createdLabels));
  if (!require(createdLabels[0] == 0u && createdLabels[1] == 40u && createdLabels[2] == 0u,
               "missing points materialize as unlabeled")) return 1;

  // KITTI Object's label_2 directory identifies the split, but its text
  // labels are not treated as per-point labels.  A sidecar labels directory
  // remains available for the web editor.
  const QString objectTraining = QDir(temporary.path()).filePath(QStringLiteral("kitti/training"));
  if (!require(QDir().mkpath(QDir(objectTraining).filePath(QStringLiteral("velodyne"))), "object velodyne") ||
      !require(QDir().mkpath(QDir(objectTraining).filePath(QStringLiteral("label_2"))), "object label_2") ||
      !require(writeBinary(QDir(objectTraining).filePath(QStringLiteral("velodyne/000000.bin")), points, sizeof(points)), "object bin")) return 1;
  plm::OpenDatasetInfo objectInfo;
  if (!require(plm::OpenDataset::inspect(objectTraining, objectInfo, &error), "inspect KITTI Object") ||
      !require(objectInfo.format == QStringLiteral("kitti_object"), "object format") ||
      !require(!objectInfo.frames[0].hasLabels, "object text labels are not point labels")) return 1;
  if (!require(plm::OpenDataset::applySemanticPatch(objectInfo.frames[0], 2u, {{0u, 9u}}, objectInfo.format, &error), "object sidecar patch")) return 1;
  QFile objectLabels(objectInfo.frames[0].labelPath);
  if (!require(objectLabels.open(QIODevice::ReadOnly), "open object sidecar")) return 1;
  uint32_t objectRaw = 0;
  if (!require(objectLabels.read(reinterpret_cast<char*>(&objectRaw), sizeof(objectRaw)) == sizeof(objectRaw), "read object sidecar") ||
      !require(objectRaw == 9u, "generic label write")) return 1;

  // KITTI Odometry remains a separate sequence when poses.txt is present.
  const QString odometry = QDir(temporary.path()).filePath(QStringLiteral("odometry/sequences/01"));
  if (!require(QDir().mkpath(QDir(odometry).filePath(QStringLiteral("velodyne"))), "odometry velodyne") ||
      !require(writeBinary(QDir(odometry).filePath(QStringLiteral("velodyne/000000.bin")), points, sizeof(points)), "odometry bin")) return 1;
  QFile poses(QDir(odometry).filePath(QStringLiteral("poses.txt")));
  if (!require(poses.open(QIODevice::WriteOnly), "odometry poses") ||
      !require(poses.write("0 0 0 0 0 0 0 0 0 0 0 0\n") > 0, "write poses")) return 1;
  plm::OpenDatasetInfo odometryInfo;
  if (!require(plm::OpenDataset::inspect(odometry, odometryInfo, &error), "inspect KITTI Odometry") ||
      !require(odometryInfo.format == QStringLiteral("kitti_odometry"), "odometry format")) return 1;

  // Standard KITTI/SemanticKITTI pose files align all scans into one stable
  // sequence-local LiDAR frame.  With identity calibration, a one-metre pose
  // translation must move the second scan by one metre in the rendered data.
  const QString posed = QDir(temporary.path()).filePath(QStringLiteral("posed/sequences/02"));
  if (!require(QDir().mkpath(QDir(posed).filePath(QStringLiteral("velodyne"))), "posed velodyne") ||
      !require(QDir().mkpath(QDir(posed).filePath(QStringLiteral("labels"))), "posed labels") ||
      !require(writeBinary(QDir(posed).filePath(QStringLiteral("velodyne/000000.bin")), points, sizeof(points)), "posed bin 0") ||
      !require(writeBinary(QDir(posed).filePath(QStringLiteral("velodyne/000001.bin")), points, sizeof(points)), "posed bin 1") ||
      !require(writeBinary(QDir(posed).filePath(QStringLiteral("labels/000000.label")), rawLabels, sizeof(rawLabels)), "posed labels 0") ||
      !require(writeBinary(QDir(posed).filePath(QStringLiteral("labels/000001.label")), rawLabels, sizeof(rawLabels)), "posed labels 1")) return 1;
  QFile posedCalib(QDir(posed).filePath(QStringLiteral("calib.txt")));
  QFile posedPoses(QDir(posed).filePath(QStringLiteral("poses.txt")));
  if (!require(posedCalib.open(QIODevice::WriteOnly | QIODevice::Text), "posed calib") ||
      !require(posedCalib.write("Tr: 1 0 0 0 0 1 0 0 0 0 1 0\n") > 0, "write posed calib") ||
      !require(posedPoses.open(QIODevice::WriteOnly | QIODevice::Text), "posed poses") ||
      !require(posedPoses.write("1 0 0 0 0 1 0 0 0 0 1 0\n1 0 0 1 0 1 0 0 0 0 1 0\n") > 0,
               "write posed poses")) return 1;
  posedCalib.close();
  posedPoses.close();

  plm::OpenDatasetInfo posedInfo;
  if (!require(plm::OpenDataset::inspect(posed, posedInfo, &error), "inspect posed sequence") ||
      !require(posedInfo.poseAligned, "pose alignment detected") ||
      !require(posedInfo.frameTransforms.size() == 2, "pose transform count")) return 1;
  loaded.clear();
  if (!require(plm::OpenDataset::readFrameRange(posedInfo, 0, 1, loaded, &error), "read posed frames") ||
      !require(loaded.size() == 4, "posed point count") ||
      !require(std::abs(loaded[2].x - loaded[0].x - 1.0f) < 1e-5f, "pose translation applied")) return 1;

  if (!require(plm::OpenDataset::discoverPaths(temporary.path()).size() == 4, "recursive discovery")) return 1;
  std::cout << "open dataset regression passed\n";
  return 0;
}

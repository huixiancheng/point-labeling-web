#pragma once

#include "io/FrameData.h"

#include <QString>
#include <QStringList>

#include <array>
#include <cstdint>
#include <utility>
#include <vector>

namespace plm {

// A small, dependency-free catalog for the public point-labeling formats.
//
// SemanticKITTI and KITTI odometry both store one scan per .bin file.  Each
// record is four little-endian float32 values: x, y, z, and remission.  A
// SemanticKITTI .label file contains one uint32 per point; the low 16 bits are
// the semantic id and the high 16 bits are the instance id.
struct OpenFrameInfo {
  uint32_t frameIndex = 0;
  QString frameId;
  QString binPath;
  QString labelPath;
  uint64_t pointCount = 0;
  bool hasLabels = false;
};

struct OpenDatasetInfo {
  QString path;
  QString format;       // semantickitti, kitti_odometry, kitti_object, kitti_bin
  QString labelSchema;  // semantickitti_learning_20 or generic_semantic_20
  int labelClassCount = 20;
  // When standard KITTI/SemanticKITTI pose and calibration files are
  // available, every frame is transformed into one fixed, dataset-local
  // LiDAR coordinate system before it is sent to the browser.  Keeping this
  // in the catalog makes sliding frame windows spatially stable.
  bool poseAligned = false;
  QString posePath;
  QString calibrationPath;
  std::vector<std::array<double, 16>> frameTransforms;
  std::vector<OpenFrameInfo> frames;
};

class OpenDataset {
 public:
  // Return true when path is one dataset unit (normally a sequence directory
  // containing velodyne/*.bin).  A direct .bin file is also accepted for
  // quick testing.
  static bool inspect(const QString& path, OpenDatasetInfo& out, QString* error = nullptr);

  // Find dataset units below a data root without reading point payloads.  The
  // result contains SemanticKITTI sequences, KITTI training/testing folders,
  // or directories with a direct velodyne folder.
  static QStringList discoverPaths(const QString& root);

  static bool isSupported(const QString& path);
  static QString suggestedId(const QString& path);

  static bool readFrameRange(const OpenDatasetInfo& dataset, uint32_t startFrame,
                             uint32_t endFrame, std::vector<FramePoint>& points,
                             QString* error = nullptr);

  // The UI works with SemanticKITTI's 20-class learning ids (0..19).  Reads
  // map the original semantic-kitti ids to learning ids; write-back maps only
  // edited values to the canonical ids while untouched uint32 words remain
  // byte-for-byte intact.
  static std::vector<uint32_t> readRawLabels(const QString& labelPath, size_t pointCount);
  static uint16_t displaySemantic(uint32_t rawLabel, const QString& format);
  static uint32_t storedSemantic(uint16_t displayLabel, const QString& format);
  static bool applySemanticPatch(const OpenFrameInfo& frame, size_t pointCount,
                                 const std::vector<std::pair<uint32_t, uint16_t>>& edits,
                                 const QString& format, QString* error = nullptr);

  static std::string rawLabelBytes(const QString& labelPath);
};

}  // namespace plm

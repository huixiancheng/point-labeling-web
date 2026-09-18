#pragma once

#include <QString>

#include <cstdint>

namespace plm {

// Dataset-level frame metadata. frameIndex is stable within one sequence and
// is the key used by the browser when it writes label patches back to a source
// frame.
struct FrameInfo {
  uint32_t frameIndex = 0;
  QString frameId;
  uint64_t pointCount = 0;
};

// One fully-resolved point in the dataset's common coordinate system. The
// source indexes are deliberately kept beside the point so a multi-frame
// render can still produce sparse per-frame label patches.
struct FramePoint {
  float x = 0.0f;
  float y = 0.0f;
  float z = 0.0f;
  uint32_t frameIndex = 0;
  uint32_t pointIndex = 0;
  uint32_t semantic = 255;
};

static_assert(sizeof(FramePoint) == 24, "FramePoint must stay 24 bytes");

}  // namespace plm

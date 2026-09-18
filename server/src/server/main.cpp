// point_labeler_server — open-format HTTP backend for point-cloud labeling.
//
// Supported input units:
//   SemanticKITTI: <sequence>/velodyne/*.bin + <sequence>/labels/*.label
//   KITTI odometry/object point clouds: a directory containing velodyne/*.bin
//   or a directory containing *.bin files directly.
//
// The server keeps the browser protocol used by the original project, but the
// data contract is public and does not depend on private PCD/pose sidecars.
// Start with --root pointing at a dataset parent (or the package's clips
// directory). Each sequence/split is listed as an independent dataset.

#include "io/OpenDataset.h"

#include <QCoreApplication>
#include <QDateTime>
#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QRegularExpression>
#include <QSaveFile>
#include <QString>

#include <httplib.h>
#include <nlohmann/json.hpp>

#ifdef _WIN32
#ifndef WIN32_LEAN_AND_MEAN
#define WIN32_LEAN_AND_MEAN
#endif
#include <windows.h>
#endif

#include <algorithm>
#include <atomic>
#include <cstdint>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <iostream>
#include <limits>
#include <mutex>
#include <optional>
#include <string>
#include <unordered_map>
#include <vector>

namespace {

QString processText(const char* value) {
  if (!value) return {};
#ifdef _WIN32
  return QString::fromLocal8Bit(value);
#else
  return QString::fromUtf8(value);
#endif
}

QString canonicalPath(const QString& path) {
  return QFileInfo(path).canonicalFilePath();
}

struct DatasetEntry {
  QString id;
  plm::OpenDatasetInfo info;
};

QString sanitizedDatasetId(const QString& value) {
  QString id = value;
  id.replace(QRegularExpression(QStringLiteral("[^A-Za-z0-9_.-]")), QStringLiteral("_"));
  return id.isEmpty() ? QStringLiteral("dataset") : id;
}

void jsonError(httplib::Response& response, int status, const QString& message) {
  response.status = status;
  response.set_content(nlohmann::json{{"error", message.toStdString()}}.dump(), "application/json");
}

bool isSafeId(const std::string& value) {
  return !value.empty() &&
         QRegularExpression(QStringLiteral("^[A-Za-z0-9_.-]+$"))
             .match(QString::fromStdString(value)).hasMatch();
}

bool pathWithin(const QString& path, const QString& root) {
  auto normalize = [](const QString& value) {
    QString result = QDir::fromNativeSeparators(QDir::cleanPath(value));
    while (result.size() > 1 && result.endsWith('/')) result.chop(1);
    return result;
  };
  const QString child = normalize(path);
  const QString base = normalize(root);
#ifdef _WIN32
  constexpr Qt::CaseSensitivity sensitivity = Qt::CaseInsensitive;
#else
  constexpr Qt::CaseSensitivity sensitivity = Qt::CaseSensitive;
#endif
  if (child.compare(base, sensitivity) == 0) return true;
  if (base == QStringLiteral("/")) return child.startsWith('/', sensitivity);
  return child.startsWith(base + '/', sensitivity);
}

void addDataset(std::vector<DatasetEntry>& datasets, const QString& rawId,
                const plm::OpenDatasetInfo& info) {
  for (const auto& existing : datasets) {
    if (canonicalPath(existing.info.path) == canonicalPath(info.path)) return;
  }
  const QString baseId = sanitizedDatasetId(rawId);
  QString id = baseId;
  int suffix = 2;
  while (std::any_of(datasets.begin(), datasets.end(), [&](const DatasetEntry& item) {
    return item.id == id;
  })) {
    id = baseId + QStringLiteral("-") + QString::number(suffix++);
  }
  datasets.push_back({id, info});
}

nlohmann::json datasetJson(const DatasetEntry& dataset) {
  nlohmann::json result;
  result["id"] = dataset.id.toStdString();
  result["path"] = dataset.info.path.toStdString();
  result["format"] = dataset.info.format.toStdString();
  result["labelClassCount"] = dataset.info.labelClassCount;
  result["labelSchema"] = dataset.info.labelSchema.toStdString();
  result["frameCount"] = dataset.info.frames.size();
  result["hasPointLabels"] = std::any_of(dataset.info.frames.begin(), dataset.info.frames.end(),
                                         [](const plm::OpenFrameInfo& frame) { return frame.hasLabels; });
  result["poseAligned"] = dataset.info.poseAligned;
  result["coordinateSystem"] = dataset.info.poseAligned
                                    ? "dataset-local pose-aligned lidar coordinates"
                                    : "per-scan lidar coordinates";
  return result;
}

std::string readFileBytes(const QString& path) {
  QFile file(path);
  if (!file.open(QIODevice::ReadOnly)) return {};
  const QByteArray bytes = file.readAll();
  return std::string(bytes.constData(), static_cast<size_t>(bytes.size()));
}

std::string labelBytesForFrame(const plm::OpenDatasetInfo& dataset,
                               const plm::OpenFrameInfo& frame) {
  const size_t count = static_cast<size_t>(frame.pointCount);
  const uint32_t defaultValue = dataset.format == QStringLiteral("semantickitti") ? 0u : 255u;
  std::vector<uint32_t> words(count, defaultValue);
  QFile file(frame.labelPath);
  if (file.exists() && file.open(QIODevice::ReadOnly)) {
    const qint64 available = file.size() / static_cast<qint64>(sizeof(uint32_t));
    const size_t copyCount = std::min<size_t>(count, available > 0 ? static_cast<size_t>(available) : 0);
    if (copyCount > 0) {
      const QByteArray bytes = file.read(static_cast<qint64>(copyCount * sizeof(uint32_t)));
      if (static_cast<size_t>(bytes.size()) == copyCount * sizeof(uint32_t)) {
        std::memcpy(words.data(), bytes.constData(), copyCount * sizeof(uint32_t));
      }
    }
  }
  std::string bytes(count * sizeof(uint32_t), '\0');
  if (!words.empty()) std::memcpy(bytes.data(), words.data(), bytes.size());
  return bytes;
}

const plm::OpenFrameInfo* findFrame(const DatasetEntry& dataset, const QString& frameId) {
  for (const auto& frame : dataset.info.frames) {
    if (frame.frameId == frameId) return &frame;
  }
  return nullptr;
}

QString workspacePath(const DatasetEntry& dataset) {
  return QDir(dataset.info.path).filePath(QStringLiteral(".point_labeler_open/workspace.json"));
}

std::unordered_map<std::string, std::mutex> g_frameMutexes;
std::mutex g_frameMutexesGuard;
std::mutex& frameMutex(const QString& path) {
  std::lock_guard<std::mutex> lock(g_frameMutexesGuard);
  return g_frameMutexes[path.toStdString()];
}

std::unordered_map<std::string, std::string> g_frameStatusCache;
std::mutex g_frameStatusCacheGuard;
void invalidateFrameStatusCache(const QString& datasetPath) {
  std::lock_guard<std::mutex> lock(g_frameStatusCacheGuard);
  g_frameStatusCache.erase(datasetPath.toStdString());
  QFile::remove(QDir(datasetPath).filePath(QStringLiteral(".point_labeler_open/frame_status.json")));
}

struct ClipVideoFile {
  QString path;
  QString name;
  QString mimeType;
};

QString videoMimeType(const QString& suffix) {
  const QString extension = suffix.toLower();
  if (extension == QStringLiteral("mp4") || extension == QStringLiteral("m4v")) return QStringLiteral("video/mp4");
  if (extension == QStringLiteral("mov")) return QStringLiteral("video/quicktime");
  if (extension == QStringLiteral("webm")) return QStringLiteral("video/webm");
  if (extension == QStringLiteral("mkv")) return QStringLiteral("video/x-matroska");
  if (extension == QStringLiteral("avi")) return QStringLiteral("video/x-msvideo");
  return QStringLiteral("application/octet-stream");
}

std::optional<ClipVideoFile> findVideo(const QString& datasetPath) {
  QDir videoDir(QDir(datasetPath).filePath(QStringLiteral("video")));
  if (!videoDir.exists()) return std::nullopt;
  const QFileInfoList files = videoDir.entryInfoList(QDir::Files | QDir::Readable,
                                                      QDir::Name | QDir::IgnoreCase);
  const QStringList preferred = {QStringLiteral("mp4"), QStringLiteral("m4v"),
                                 QStringLiteral("mov"), QStringLiteral("webm"),
                                 QStringLiteral("mkv"), QStringLiteral("avi")};
  for (const QString& suffix : preferred) {
    for (const QFileInfo& file : files) {
      if (file.size() <= 0 || file.suffix().compare(suffix, Qt::CaseInsensitive) != 0) continue;
      return ClipVideoFile{file.absoluteFilePath(), file.fileName(), videoMimeType(suffix)};
    }
  }
  return std::nullopt;
}

bool openWithDefaultPlayer(const QString& path) {
#ifdef _WIN32
  const std::wstring widePath = path.toStdWString();
  if (widePath.empty()) return false;
  const HINSTANCE result = ShellExecuteW(nullptr, L"open", widePath.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
  return reinterpret_cast<INT_PTR>(result) > 32;
#else
  Q_UNUSED(path);
  return false;
#endif
}

#pragma pack(push, 1)
struct FramePacketHeader {
  char magic[8];
  uint32_t version;
  uint32_t startFrame;
  uint32_t endFrame;
  uint32_t frameCount;
  uint64_t pointCount;
  uint32_t pointSize;
};

struct LabelExportHeader {
  char magic[8];
  uint32_t version;
  uint32_t frameCount;
  uint64_t totalPoints;
};

struct LabelExportFrameHeader {
  uint32_t frameIndex;
  uint32_t frameIdBytes;
  uint64_t pointCount;
  uint64_t labelBytes;
};
#pragma pack(pop)

static_assert(sizeof(FramePacketHeader) == 36, "frame packet header size changed");
static_assert(sizeof(LabelExportHeader) == 24, "label export header size changed");
static_assert(sizeof(LabelExportFrameHeader) == 24, "label export frame header size changed");

std::string makeFramePacket(uint32_t startFrame, uint32_t endFrame,
                            const std::vector<plm::FramePoint>& points) {
  FramePacketHeader header{};
  std::memcpy(header.magic, "PLWFRM\0\0", sizeof(header.magic));
  header.version = 1;
  header.startFrame = startFrame;
  header.endFrame = endFrame;
  header.frameCount = endFrame - startFrame + 1;
  header.pointCount = points.size();
  header.pointSize = sizeof(plm::FramePoint);
  std::string bytes(sizeof(header) + points.size() * sizeof(plm::FramePoint), '\0');
  std::memcpy(bytes.data(), &header, sizeof(header));
  if (!points.empty()) {
    std::memcpy(bytes.data() + sizeof(header), points.data(), points.size() * sizeof(plm::FramePoint));
  }
  return bytes;
}

std::optional<uint32_t> parseIndex(const httplib::Request& request, const char* name,
                                   uint32_t fallback) {
  if (!request.has_param(name)) return fallback;
  try {
    const uint64_t value = std::stoull(request.get_param_value(name));
    if (value > std::numeric_limits<uint32_t>::max()) return std::nullopt;
    return static_cast<uint32_t>(value);
  } catch (...) {
    return std::nullopt;
  }
}

#ifdef _WIN32
std::atomic<httplib::Server*> g_runningServer{nullptr};
std::atomic<bool> g_serviceStopRequested{false};
#endif

}  // namespace

int runServer(int argc, char** argv) {
  QCoreApplication app(argc, argv);

  QString root = processText(std::getenv("PLW_DATA_ROOT"));
  QString assets = processText(std::getenv("PLW_ASSETS"));
  QString webRoot = processText(std::getenv("PLW_WEB_ROOT"));
  QString logPath = processText(std::getenv("PLW_LOG"));
  int port = 8090;
  std::string host = "127.0.0.1";

  for (int i = 1; i < argc; ++i) {
    const std::string argument = argv[i];
    auto next = [&]() { return i + 1 < argc ? std::string(argv[++i]) : std::string(); };
    if (argument == "--root") root = processText(next().c_str());
    else if (argument == "--assets") assets = processText(next().c_str());
    else if (argument == "--web-root") webRoot = processText(next().c_str());
    else if (argument == "--log") logPath = processText(next().c_str());
    else if (argument == "--port") port = std::atoi(next().c_str());
    else if (argument == "--host") host = next();
    else if (argument == "--service") { /* consumed by the Windows wrapper */ }
    else if (argument == "-h" || argument == "--help") {
      std::cout << "usage: point_labeler_server --root DIR --assets DIR --web-root DIR "
                   "[--log FILE] [--port 8090] [--host 127.0.0.1]\n";
      return 0;
    }
  }
  if (root.isEmpty()) {
    std::cerr << "error: --root is required (or set PLW_DATA_ROOT)\n";
    return 2;
  }
  if (assets.isEmpty()) assets = QDir(QCoreApplication::applicationDirPath()).filePath(QStringLiteral("assets"));
  if (!logPath.isEmpty()) {
    QDir().mkpath(QFileInfo(logPath).absolutePath());
    static std::ofstream logFile;
    logFile.open(logPath.toStdString(), std::ios::app);
    if (logFile.is_open()) std::cerr.rdbuf(logFile.rdbuf());
  }

  const QString dataRoot = canonicalPath(root);
  if (dataRoot.isEmpty() || !QDir(dataRoot).exists()) {
    std::cerr << "error: data root does not exist: " << root.toStdString() << "\n";
    return 2;
  }
  std::cerr << "open-format data root: " << dataRoot.toStdString() << "\n";

  std::vector<DatasetEntry> datasets;
  std::mutex datasetsMutex;
  auto registerDataset = [&](const QString& rawId, const QString& path) -> std::optional<DatasetEntry> {
    plm::OpenDatasetInfo info;
    QString error;
    if (!plm::OpenDataset::inspect(path, info, &error)) {
      std::cerr << "skip unsupported dataset " << path.toStdString() << ": " << error.toStdString() << "\n";
      return std::nullopt;
    }
    std::lock_guard<std::mutex> lock(datasetsMutex);
    for (auto& existing : datasets) {
      if (canonicalPath(existing.info.path) == canonicalPath(info.path)) {
        existing.info = info;
        return existing;
      }
    }
    addDataset(datasets, rawId, info);
    return datasets.empty() ? std::nullopt : std::optional<DatasetEntry>(datasets.back());
  };
  auto refreshDatasets = [&]() {
    const QStringList paths = plm::OpenDataset::discoverPaths(dataRoot);
    for (const QString& path : paths) registerDataset(plm::OpenDataset::suggestedId(path), path);
  };
  refreshDatasets();
  std::cerr << "discovered " << datasets.size() << " open dataset unit(s)\n";

  auto findDataset = [&](const std::string& id) -> std::optional<DatasetEntry> {
    std::lock_guard<std::mutex> lock(datasetsMutex);
    for (const auto& dataset : datasets) if (dataset.id.toStdString() == id) return dataset;
    return std::nullopt;
  };

  httplib::Server server;
  server.set_logger([](const httplib::Request& request, const httplib::Response& response) {
    const QString now = QDateTime::currentDateTimeUtc().toString(Qt::ISODateWithMs);
    std::cerr << '[' << now.toStdString() << "] " << request.method << ' ' << request.path
              << " -> " << response.status << " (" << response.body.size() << " bytes)\n";
  });

  server.Get("/api/health", [](const httplib::Request&, httplib::Response& response) {
    response.set_content("{\"ok\":true,\"format\":\"open\"}", "application/json");
  });

  server.Get("/api/labels.xml", [&](const httplib::Request&, httplib::Response& response) {
    const std::string bytes = readFileBytes(QDir(assets).filePath(QStringLiteral("labels.xml")));
    if (bytes.empty()) { response.status = 404; return; }
    response.set_content(bytes, "application/xml");
  });

  server.Get("/api/datasets", [&](const httplib::Request&, httplib::Response& response) {
    refreshDatasets();
    nlohmann::json result = nlohmann::json::array();
    std::lock_guard<std::mutex> lock(datasetsMutex);
    for (const auto& dataset : datasets) result.push_back(datasetJson(dataset));
    response.set_content(result.dump(), "application/json");
  });

  // Explicit opening is useful in development. Packaged builds normally scan
  // clips automatically, so the browser never has to expose a path.
  server.Post("/api/datasets/open", [&](const httplib::Request& request, httplib::Response& response) {
    nlohmann::json body;
    try { body = nlohmann::json::parse(request.body); }
    catch (...) { jsonError(response, 400, QStringLiteral("invalid json")); return; }
    const std::string rawPath = body.value("path", std::string());
    if (rawPath.empty()) { jsonError(response, 400, QStringLiteral("path is required")); return; }
    const QString requested = QString::fromUtf8(rawPath.c_str());
    const QString candidate = canonicalPath(requested);
    if (candidate.isEmpty() || !pathWithin(candidate, dataRoot)) {
      jsonError(response, 400, QStringLiteral("数据路径不在服务允许的根目录内"));
      return;
    }
    const auto opened = registerDataset(plm::OpenDataset::suggestedId(candidate), candidate);
    if (!opened) { jsonError(response, 400, QStringLiteral("不是可识别的 SemanticKITTI/KITTI 数据目录")); return; }
    response.set_content(datasetJson(*opened).dump(), "application/json");
  });

  server.Get("/api/datasets/resolve", [&](const httplib::Request& request, httplib::Response& response) {
    if (!request.has_param("path")) { response.status = 400; return; }
    const QString requested = canonicalPath(QString::fromUtf8(request.get_param_value("path").c_str()));
    std::lock_guard<std::mutex> lock(datasetsMutex);
    for (const auto& dataset : datasets) {
      if (canonicalPath(dataset.info.path) == requested) {
        response.set_content(datasetJson(dataset).dump(), "application/json");
        return;
      }
    }
    response.status = 404;
  });

  server.Get(R"(/api/datasets/([^/]+)/info)", [&](const httplib::Request& request, httplib::Response& response) {
    const std::string id = request.matches[1];
    if (!isSafeId(id)) { response.status = 400; return; }
    const auto dataset = findDataset(id);
    if (!dataset) { response.status = 404; return; }
    response.set_content(datasetJson(*dataset).dump(), "application/json");
  });

  server.Get(R"(/api/datasets/([^/]+)/frame-manifest)", [&](const httplib::Request& request, httplib::Response& response) {
    const std::string id = request.matches[1];
    if (!isSafeId(id)) { response.status = 400; return; }
    const auto dataset = findDataset(id);
    if (!dataset) { response.status = 404; return; }
    nlohmann::json result = nlohmann::json::array();
    for (const auto& frame : dataset->info.frames) {
      result.push_back({{"frameIndex", frame.frameIndex}, {"frameId", frame.frameId.toStdString()},
                        {"pointCount", frame.pointCount}});
    }
    response.set_content(result.dump(), "application/json");
  });

  server.Get(R"(/api/datasets/([^/]+)/frame-status)", [&](const httplib::Request& request, httplib::Response& response) {
    const std::string id = request.matches[1];
    if (!isSafeId(id)) { response.status = 400; return; }
    const auto dataset = findDataset(id);
    if (!dataset) { response.status = 404; return; }
    const QString cachePath = QDir(dataset->info.path).filePath(QStringLiteral(".point_labeler_open/frame_status.json"));
    {
      std::lock_guard<std::mutex> lock(g_frameStatusCacheGuard);
      const auto it = g_frameStatusCache.find(dataset->info.path.toStdString());
      if (it != g_frameStatusCache.end()) { response.set_content(it->second, "application/json"); return; }
    }
    const std::string persisted = readFileBytes(cachePath);
    if (!persisted.empty() && nlohmann::json::accept(persisted)) {
      std::lock_guard<std::mutex> lock(g_frameStatusCacheGuard);
      g_frameStatusCache[dataset->info.path.toStdString()] = persisted;
      response.set_content(persisted, "application/json");
      return;
    }
    nlohmann::json result = nlohmann::json::array();
    for (const auto& frame : dataset->info.frames) {
      const bool known = QFileInfo(frame.labelPath).exists() &&
                         QFileInfo(frame.labelPath).size() == static_cast<qint64>(frame.pointCount * sizeof(uint32_t));
      uint64_t labeled = 0;
      if (known) {
        const auto words = plm::OpenDataset::readRawLabels(frame.labelPath, static_cast<size_t>(frame.pointCount));
        for (const uint32_t word : words) {
          const uint16_t semantic = plm::OpenDataset::displaySemantic(word, dataset->info.format);
          if (semantic != 0 && semantic != 255u) ++labeled;
        }
      }
      result.push_back({{"frameIndex", frame.frameIndex}, {"pointCount", frame.pointCount},
                        {"labeledCount", labeled}, {"known", known}});
    }
    const std::string serialized = result.dump();
    {
      std::lock_guard<std::mutex> lock(g_frameStatusCacheGuard);
      g_frameStatusCache[dataset->info.path.toStdString()] = serialized;
    }
    QDir().mkpath(QFileInfo(cachePath).absolutePath());
    QSaveFile file(cachePath);
    if (file.open(QIODevice::WriteOnly)) { file.write(serialized.data(), static_cast<qint64>(serialized.size())); file.commit(); }
    response.set_content(serialized, "application/json");
  });

  server.Get(R"(/api/datasets/([^/]+)/frames/(\d+)/(\d+))", [&](const httplib::Request& request, httplib::Response& response) {
    const std::string id = request.matches[1];
    if (!isSafeId(id)) { response.status = 400; return; }
    const auto dataset = findDataset(id);
    if (!dataset) { response.status = 404; return; }
    uint64_t start = 0;
    uint64_t end = 0;
    try { start = std::stoull(request.matches[2]); end = std::stoull(request.matches[3]); }
    catch (...) { jsonError(response, 400, QStringLiteral("invalid frame range")); return; }
    if (start > std::numeric_limits<uint32_t>::max() || end > std::numeric_limits<uint32_t>::max() || start > end) {
      jsonError(response, 400, QStringLiteral("invalid frame range")); return;
    }
    if (start >= dataset->info.frames.size()) { response.status = 404; return; }
    const uint32_t first = static_cast<uint32_t>(start);
    const uint32_t last = std::min<uint32_t>(static_cast<uint32_t>(end),
                                             static_cast<uint32_t>(dataset->info.frames.size() - 1));
    std::vector<plm::FramePoint> points;
    QString error;
    if (!plm::OpenDataset::readFrameRange(dataset->info, first, last, points, &error)) {
      jsonError(response, 500, error.isEmpty() ? QStringLiteral("读取帧失败") : error);
      return;
    }
    const std::string packet = makeFramePacket(first, last, points);
    response.set_header("X-Frame-Start", std::to_string(first));
    response.set_header("X-Frame-End", std::to_string(last));
    response.set_header("X-Frame-Count", std::to_string(last - first + 1));
    response.set_header("X-Point-Count", std::to_string(points.size()));
    response.set_content(packet, "application/octet-stream");
  });

  server.Get(R"(/api/datasets/([^/]+)/labels/export)", [&](const httplib::Request& request, httplib::Response& response) {
    const std::string id = request.matches[1];
    if (!isSafeId(id)) { response.status = 400; return; }
    const auto dataset = findDataset(id);
    if (!dataset || dataset->info.frames.empty()) { response.status = 404; return; }
    const auto requestedFrame = parseIndex(request, "frame", 0);
    if (request.has_param("frame") && !requestedFrame) { jsonError(response, 400, QStringLiteral("invalid frame")); return; }
    uint32_t start = requestedFrame ? *requestedFrame : 0;
    uint32_t end = requestedFrame ? *requestedFrame : static_cast<uint32_t>(dataset->info.frames.size() - 1);
    if (!request.has_param("frame")) {
      const auto requestedStart = parseIndex(request, "start", 0);
      const auto requestedEnd = parseIndex(request, "end", end);
      if (!requestedStart || !requestedEnd || *requestedStart > *requestedEnd) {
        jsonError(response, 400, QStringLiteral("invalid export frame range")); return;
      }
      start = *requestedStart;
      end = std::min<uint32_t>(*requestedEnd, static_cast<uint32_t>(dataset->info.frames.size() - 1));
    }
    if (start >= dataset->info.frames.size() || start > end) { jsonError(response, 400, QStringLiteral("invalid export frame range")); return; }
    LabelExportHeader header{};
    std::memcpy(header.magic, "PLWLBL\0\0", sizeof(header.magic));
    header.version = 1;
    header.frameCount = end - start + 1;
    std::string bytes(sizeof(header), '\0');
    for (uint32_t index = start; index <= end; ++index) {
      const auto& frame = dataset->info.frames[index];
      const std::string labels = labelBytesForFrame(dataset->info, frame);
      const std::string frameId = frame.frameId.toUtf8().toStdString();
      LabelExportFrameHeader frameHeader{};
      frameHeader.frameIndex = frame.frameIndex;
      frameHeader.frameIdBytes = static_cast<uint32_t>(frameId.size());
      frameHeader.pointCount = frame.pointCount;
      frameHeader.labelBytes = labels.size();
      bytes.append(reinterpret_cast<const char*>(&frameHeader), sizeof(frameHeader));
      bytes.append(frameId);
      bytes.append(labels);
      header.totalPoints += frame.pointCount;
    }
    std::memcpy(bytes.data(), &header, sizeof(header));
    const std::string filename = id + (start == end ? "_frame_" + std::to_string(start) : "_labels") + ".plwlabels";
    response.set_header("Content-Disposition", "attachment; filename=\"" + filename + "\"");
    response.set_content(bytes, "application/octet-stream");
  });

  server.Get(R"(/api/datasets/([^/]+)/labels/([^/]+))", [&](const httplib::Request& request, httplib::Response& response) {
    const std::string id = request.matches[1];
    if (!isSafeId(id)) { response.status = 400; return; }
    const auto dataset = findDataset(id);
    if (!dataset) { response.status = 404; return; }
    const auto* frame = findFrame(*dataset, QString::fromUtf8(request.matches[2].str().c_str()));
    if (!frame) { response.status = 404; return; }
    const std::string bytes = labelBytesForFrame(dataset->info, *frame);
    response.set_header("X-Point-Count", std::to_string(frame->pointCount));
    if (request.has_param("download")) {
      response.set_header("Content-Disposition", "attachment; filename=\"" + frame->frameId.toStdString() + ".label\"");
    }
    response.set_content(bytes, "application/octet-stream");
  });

  server.Post(R"(/api/datasets/([^/]+)/labels/([^/]+)/patch)", [&](const httplib::Request& request, httplib::Response& response) {
    const std::string id = request.matches[1];
    if (!isSafeId(id)) { response.status = 400; return; }
    const auto dataset = findDataset(id);
    if (!dataset) { response.status = 404; return; }
    const auto* frame = findFrame(*dataset, QString::fromUtf8(request.matches[2].str().c_str()));
    if (!frame) { response.status = 404; return; }
    nlohmann::json body;
    try { body = nlohmann::json::parse(request.body); }
    catch (...) { jsonError(response, 400, QStringLiteral("invalid json")); return; }
    const size_t pointCount = body.value("pointCount", size_t(0));
    if (pointCount == 0 || pointCount != frame->pointCount) { jsonError(response, 400, QStringLiteral("pointCount 与帧清单不一致")); return; }
    std::vector<std::pair<uint32_t, uint16_t>> edits;
    if (body.contains("edits") && body["edits"].is_array()) {
      for (const auto& item : body["edits"]) {
        const uint32_t pointIndex = item.value("pointIndex", uint32_t(0));
        const uint32_t semantic = item.value("semantic", uint32_t(255));
        if (semantic <= 255u) edits.emplace_back(pointIndex, static_cast<uint16_t>(semantic));
      }
    }
    std::lock_guard<std::mutex> lock(frameMutex(frame->labelPath));
    QString error;
    const bool ok = plm::OpenDataset::applySemanticPatch(*frame, pointCount, edits, dataset->info.format, &error);
    if (!ok) { jsonError(response, 500, error.isEmpty() ? QStringLiteral("标签写回失败") : error); return; }
    invalidateFrameStatusCache(dataset->info.path);
    response.set_content(nlohmann::json{{"ok", true}, {"applied", edits.size()}, {"pointCount", pointCount}}.dump(), "application/json");
  });

  server.Get(R"(/api/datasets/([^/]+)/workspace)", [&](const httplib::Request& request, httplib::Response& response) {
    const std::string id = request.matches[1];
    if (!isSafeId(id)) { response.status = 400; return; }
    const auto dataset = findDataset(id);
    if (!dataset) { response.status = 404; return; }
    const QString path = workspacePath(*dataset);
    const std::string bytes = readFileBytes(path);
    response.set_content(bytes.empty() ? std::string("{\"points\":[]}") : bytes, "application/json");
  });

  server.Put(R"(/api/datasets/([^/]+)/workspace)", [&](const httplib::Request& request, httplib::Response& response) {
    const std::string id = request.matches[1];
    if (!isSafeId(id)) { response.status = 400; return; }
    const auto dataset = findDataset(id);
    if (!dataset) { response.status = 404; return; }
    nlohmann::json body;
    try { body = nlohmann::json::parse(request.body); }
    catch (...) { jsonError(response, 400, QStringLiteral("invalid json")); return; }
    if (!body.contains("points") || !body["points"].is_array()) { jsonError(response, 400, QStringLiteral("points array required")); return; }
    const QString path = workspacePath(*dataset);
    QDir().mkpath(QFileInfo(path).absolutePath());
    QSaveFile file(path);
    const std::string dumped = body.dump();
    if (!file.open(QIODevice::WriteOnly) || file.write(dumped.data(), static_cast<qint64>(dumped.size())) != static_cast<qint64>(dumped.size()) || !file.commit()) {
      jsonError(response, 500, QStringLiteral("工作区保存失败")); return;
    }
    response.set_content("{\"ok\":true}", "application/json");
  });

  server.Get(R"(/api/datasets/([^/]+)/video-info)", [&](const httplib::Request& request, httplib::Response& response) {
    const std::string id = request.matches[1];
    if (!isSafeId(id)) { response.status = 400; return; }
    const auto dataset = findDataset(id);
    if (!dataset) { response.status = 404; return; }
    const auto video = findVideo(dataset->info.path);
    if (!video) { response.status = 404; return; }
    response.set_content(nlohmann::json{{"name", video->name.toStdString()}, {"mimeType", video->mimeType.toStdString()},
                                        {"url", "/api/datasets/" + id + "/video"}}.dump(), "application/json");
  });

  server.Post(R"(/api/datasets/([^/]+)/video/open)", [&](const httplib::Request& request, httplib::Response& response) {
    const std::string id = request.matches[1];
    if (!isSafeId(id)) { response.status = 400; return; }
    const auto dataset = findDataset(id);
    if (!dataset) { response.status = 404; return; }
    const auto video = findVideo(dataset->info.path);
    if (!video || !openWithDefaultPlayer(video->path)) { jsonError(response, 404, QStringLiteral("未找到或无法打开视频")); return; }
    response.set_content(nlohmann::json{{"opened", true}, {"name", video->name.toStdString()}}.dump(), "application/json");
  });

  server.Get(R"(/api/datasets/([^/]+)/video)", [&](const httplib::Request& request, httplib::Response& response) {
    const std::string id = request.matches[1];
    if (!isSafeId(id)) { response.status = 400; return; }
    const auto dataset = findDataset(id);
    if (!dataset) { response.status = 404; return; }
    const auto video = findVideo(dataset->info.path);
    if (!video) { response.status = 404; return; }
    const qint64 size = QFileInfo(video->path).size();
    if (size <= 0) { response.status = 404; return; }
    const QString videoPath = video->path;
    response.set_header("Accept-Ranges", "bytes");
    response.set_content_provider(static_cast<size_t>(size), video->mimeType.toStdString(),
                                  [videoPath](size_t offset, size_t length, httplib::DataSink& sink) {
      QFile file(videoPath);
      if (!file.open(QIODevice::ReadOnly) || !file.seek(static_cast<qint64>(offset))) return false;
      size_t remaining = length;
      constexpr size_t chunkSize = 1024 * 1024;
      while (remaining > 0) {
        const qint64 want = static_cast<qint64>(std::min(remaining, chunkSize));
        const QByteArray chunk = file.read(want);
        if (chunk.size() != want || !sink.write(chunk.constData(), static_cast<size_t>(chunk.size()))) return false;
        remaining -= static_cast<size_t>(chunk.size());
      }
      return true;
    });
  });

  if (!webRoot.isEmpty()) {
    const QString web = canonicalPath(webRoot);
    if (web.isEmpty() || !QDir(web).exists() || !server.set_mount_point("/", web.toStdString())) {
      std::cerr << "error: failed to mount web root: " << webRoot.toStdString() << "\n";
      return 2;
    }
    std::cerr << "web root: " << web.toStdString() << "\n";
  }

  std::cerr << "serving open point labeler on " << host << ':' << port << "\n";
#ifdef _WIN32
  g_runningServer.store(&server);
  if (g_serviceStopRequested.load()) server.stop();
#endif
  const bool listened = server.listen(host, port);
#ifdef _WIN32
  g_runningServer.store(nullptr);
#endif
  if (!listened) {
    std::cerr << "failed to listen on " << host << ':' << port << "\n";
    return 1;
  }
  return 0;
}

#ifdef _WIN32
namespace {
int g_mainArgc = 0;
char** g_mainArgv = nullptr;
SERVICE_STATUS_HANDLE g_serviceStatusHandle = nullptr;
SERVICE_STATUS g_serviceStatus{};

void reportServiceStatus(DWORD state, DWORD exitCode = NO_ERROR, DWORD waitHint = 0) {
  g_serviceStatus.dwCurrentState = state;
  g_serviceStatus.dwWin32ExitCode = exitCode;
  g_serviceStatus.dwWaitHint = waitHint;
  g_serviceStatus.dwControlsAccepted = state == SERVICE_RUNNING
                                            ? SERVICE_ACCEPT_STOP | SERVICE_ACCEPT_SHUTDOWN : 0;
  if (state == SERVICE_START_PENDING || state == SERVICE_STOP_PENDING) ++g_serviceStatus.dwCheckPoint;
  else g_serviceStatus.dwCheckPoint = 0;
  SetServiceStatus(g_serviceStatusHandle, &g_serviceStatus);
}

void WINAPI serviceControl(DWORD control) {
  if (control != SERVICE_CONTROL_STOP && control != SERVICE_CONTROL_SHUTDOWN) return;
  g_serviceStopRequested.store(true);
  reportServiceStatus(SERVICE_STOP_PENDING, NO_ERROR, 5000);
  if (auto* server = g_runningServer.load()) server->stop();
}

void WINAPI serviceMain(DWORD, LPSTR*) {
  g_serviceStatusHandle = RegisterServiceCtrlHandlerA("PointLabelerOpen", serviceControl);
  if (!g_serviceStatusHandle) return;
  g_serviceStatus = {};
  g_serviceStatus.dwServiceType = SERVICE_WIN32_OWN_PROCESS;
  reportServiceStatus(SERVICE_START_PENDING, NO_ERROR, 5000);
  reportServiceStatus(SERVICE_RUNNING);
  const int result = runServer(g_mainArgc, g_mainArgv);
  reportServiceStatus(SERVICE_STOPPED, result == 0 ? NO_ERROR : ERROR_SERVICE_SPECIFIC_ERROR, 0);
}
}  // namespace
#endif

int main(int argc, char** argv) {
#ifdef _WIN32
  g_mainArgc = argc;
  g_mainArgv = argv;
  bool serviceMode = false;
  for (int i = 1; i < argc; ++i) if (std::string(argv[i]) == "--service") serviceMode = true;
  if (serviceMode) {
    SERVICE_TABLE_ENTRYA table[] = {
        {const_cast<char*>("PointLabelerOpen"), serviceMain},
        {nullptr, nullptr},
    };
    if (!StartServiceCtrlDispatcherA(table)) {
      std::cerr << "StartServiceCtrlDispatcher failed: " << GetLastError() << "\n";
      return 1;
    }
    return 0;
  }
#endif
  return runServer(argc, argv);
}

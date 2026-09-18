import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadFrameManifest, loadFrameWindow, type FrameInfo, type FramePacket } from './frame_cloud';
import './style.css';

type RGB = [number, number, number];
type Tool = 'navigate' | 'brush' | 'polygon' | 'polyline' | 'rect' | 'lasso' | 'workspace';
type ViewMode = 'persp' | 'fly' | 'bev';
type OrthoView = 'bev';
type DisplayTheme = 'dark' | 'light';
type Language = 'zh' | 'en';
const LANGUAGE_STORAGE_KEY = 'point-labeler-language';
const translations: Record<Language, Record<string, string>> = {
  zh: {
    'brand.name': '点云标注', 'brand.mode': '点云分割', 'frame.label': '帧', 'frame.previous': '上一帧', 'frame.next': '下一帧',
    'frame.current': '当前帧 —', 'frame.display': '帧显示', 'clip.select': '选择 Clip', 'video.default': '默认播放器',
    'performance.title': '性能模式', 'performance.auto': '自动检测', 'performance.high': '高性能 · 默认 200 帧', 'performance.low': '集显/低性能 · 默认单帧',
    'performance.autoLabel': '自动', 'performance.highLabel': '高性能 · 默认 200 帧', 'performance.lowLabel': '集显/低性能 · 默认单帧',
    'performance.gpuUnknown': '浏览器未提供 GPU 名称', 'performance.currentDefault': '当前默认',
    'theme.title': '背景与标注颜色', 'theme.dark': '黑底 · 亮色标注', 'theme.light': '浅灰底 · 深色标注',
    'scale.title': '界面缩放', 'scale.75': '界面 75%', 'scale.85': '界面 85%', 'scale.100': '界面 100%', 'scale.110': '界面 110%', 'scale.120': '界面 120%',
    'language.title': '语言', 'language.zh': '中文', 'language.en': 'English', 'playback.title': '播放速度',
    'play': '▶ 播放', 'stop': '■ 停止', 'undo': '撤销（Ctrl+Z）', 'redo': '重做（Ctrl+Y）', 'fullscreen': '全屏',
    'save.frame': '保存当前帧', 'save.all': '保存全部', 'dirty.none': '0 个待保存', 'dirty.pending': '个待保存',
    'loading.full': '正在加载完整点云…', 'hover.default': '悬停查看点信息', 'tool.rail': '工具', 'nav.label': '标注工具',
    'tool.navigate': '视角', 'tool.brush': '画刷', 'tool.polygon': '多边形', 'tool.rect': '矩形', 'tool.lasso': '套索', 'tool.polyline': '折线', 'tool.workspace': '工作区',
    'tool.navigateTitle': '视角（N）', 'tool.brushTitle': '画刷（1）', 'tool.polygonTitle': '多边形（2）', 'tool.rectTitle': '矩形（3）', 'tool.lassoTitle': '套索（4）', 'tool.polylineTitle': '折线（5）', 'tool.workspaceTitle': '工作区',
    'fit': '适配', 'fit.title': '适配全部已加载点', 'fly': '飞行', 'fly.title': '飞行视角（F/G）', 'bev': '鸟瞰', 'bev.title': '鸟瞰/自动透视（B）',
    'rail.hint': 'B 鸟瞰/退出\nV 视角循环\nF/G 飞行', 'annotation': '标注', 'panel.title': '点云分割', 'panel.collapse': '收起面板',
    'active.initial': '视角 · 选择一个工具', 'status.tool': '工具', 'status.view': '视角', 'status.display': '显示', 'status.scope': '范围', 'status.pending': '待保存', 'status.selected': '已选中',
    'view.persp': '透视自由', 'view.fly': '飞行视角', 'view.bev': '鸟瞰（XY）', 'view.adjustable': '可调整视角', 'view.locked': '视角已锁定', 'view.flyKeys': 'WASD/方向键',
    'display.window': '全部已加载帧', 'display.highlight': '全部已加载帧 · 高亮当前帧', 'display.frame': '仅当前帧', 'display.hint': '按性能模式选择',
    'labels.heading': '标签类别', 'labels.all': '全显', 'labels.none': '全隐', 'labels.invert': '反选', 'labels.only': '单显', 'labels.showHide': '显示/隐藏', 'labels.select': '选择', 'labels.onlyTitle': '仅显示',
    'scope.heading': '标注范围', 'scope.window': '当前窗口 · 所有已加载帧', 'scope.frame': '仅当前帧', 'scope.hint': '按性能模式选择范围', 'overwrite': '覆盖已有标签', 'erase': '擦除',
    'brush.radius': '画刷半径', 'polyline.height': '折线高度过滤', 'point.size': '点大小', 'ground.heading': '地面过滤', 'ground.all': '显示全部点', 'ground.hide': '隐藏地面', 'ground.only': '仅显示地面', 'ground.threshold': '阈值',
    'action.polygon': '应用多边形', 'action.polyline': '应用折线', 'action.selection': '应用选区', 'action.workspace': '应用工作区', 'action.clearWorkspace': '清除工作区', 'action.exportFrame': '导出当前帧标签', 'action.exportClip': '导出 Clip 标签',
    'timeline.sequence': '序列', 'timeline.title': '帧时间线', 'timeline.window': '窗口', 'timeline.auto': '自动跟随', 'timeline.hint': '自动模式：集显单帧 / 高性能 200 帧', 'legend.unmodified': '未修改', 'legend.modified': '已保存修改', 'legend.dirty': '待保存', 'legend.loaded': '已加载窗口',
    'dialog.unsaved': '未保存修改', 'dialog.unsavedText': '存在未保存的标签修改。', 'dialog.saveContinue': '保存并继续', 'dialog.discardContinue': '放弃并继续', 'dialog.cancel': '取消',
    'unit.frame': '帧', 'unit.point': '点', 'unit.points': '个完整点', 'unit.window': '帧窗口', 'unit.range': '帧范围', 'unknown': '未知', 'loaded': '已加载', 'window.none': '窗口 —',
    'status.saved': '已保存', 'status.saving': '保存中…', 'status.savingFrame': '正在保存当前帧…', 'status.saveFailed': '保存失败', 'status.scan': '正在扫描 clips…', 'status.noClip': 'clips 内没有找到有效 Clip', 'status.chooseClip': '请选择 Clip…', 'status.openingClip': '正在自动打开 Clip…', 'status.clipFound': '发现 {count} 个 Clip', 'status.noClipHint': '未找到 Clip，请将完整 Clip 放入 clips 后刷新页面',
    'status.windowLoading': '正在加载第 {start}..{end} 帧的完整点云…', 'status.windowLoadFailed': '窗口加载失败：{error}', 'status.loadFailed': '加载失败：{error}', 'status.clipScanFailed': 'Clip 扫描失败：{error}',
    'status.videoLooking': '正在查找 video…', 'status.videoUndetected': '未检测', 'status.videoNotFound': '未找到视频', 'status.videoCheckFailed': '视频检查失败', 'status.videoFound': '已找到：{name}', 'status.videoOpened': '已使用系统默认播放器打开：{name}', 'status.videoOpenFailed': '视频打开失败：{error}',
    'status.exported': '{label}标签已导出', 'status.exportFailed': '{label}标签导出失败：{error}', 'status.selectionPreview': '选区预览：{count} 点 · 右键应用', 'status.selectionApplied': '选区已应用：{count} 点', 'status.polylinePreview': '折线预览：{count} 点 · 右键/Enter应用', 'status.polylineApplied': '折线已应用：{count} 点',
  },
  en: {
    'brand.name': 'Point Labeler', 'brand.mode': 'Segmentation', 'frame.label': 'Frame', 'frame.previous': 'Previous frame', 'frame.next': 'Next frame',
    'frame.current': 'Current frame —', 'frame.display': 'Frame display', 'clip.select': 'Select Clip', 'video.default': 'Default player',
    'performance.title': 'Performance mode', 'performance.auto': 'Auto detect', 'performance.high': 'High · 200-frame default', 'performance.low': 'Integrated/low GPU · single frame',
    'performance.autoLabel': 'Auto', 'performance.highLabel': 'High · 200-frame window', 'performance.lowLabel': 'Integrated/low GPU · single frame',
    'performance.gpuUnknown': 'GPU name unavailable', 'performance.currentDefault': 'Default',
    'theme.title': 'Background and label colors', 'theme.dark': 'Dark background · bright labels', 'theme.light': 'Light gray background · dark labels',
    'scale.title': 'UI scale', 'scale.75': 'UI 75%', 'scale.85': 'UI 85%', 'scale.100': 'UI 100%', 'scale.110': 'UI 110%', 'scale.120': 'UI 120%',
    'language.title': 'Language', 'language.zh': '中文', 'language.en': 'English', 'playback.title': 'Playback speed',
    'play': '▶ Play', 'stop': '■ Stop', 'undo': 'Undo (Ctrl+Z)', 'redo': 'Redo (Ctrl+Y)', 'fullscreen': 'Fullscreen',
    'save.frame': 'Save frame', 'save.all': 'Save all', 'dirty.none': '0 pending', 'dirty.pending': 'pending',
    'loading.full': 'Loading full point cloud…', 'hover.default': 'Hover for point information', 'tool.rail': 'Tools', 'nav.label': 'Annotation tools',
    'tool.navigate': 'View', 'tool.brush': 'Brush', 'tool.polygon': 'Polygon', 'tool.rect': 'Rectangle', 'tool.lasso': 'Lasso', 'tool.polyline': 'Polyline', 'tool.workspace': 'Workspace',
    'tool.navigateTitle': 'View (N)', 'tool.brushTitle': 'Brush (1)', 'tool.polygonTitle': 'Polygon (2)', 'tool.rectTitle': 'Rectangle (3)', 'tool.lassoTitle': 'Lasso (4)', 'tool.polylineTitle': 'Polyline (5)', 'tool.workspaceTitle': 'Workspace',
    'fit': 'Fit', 'fit.title': 'Fit all loaded points', 'fly': 'Fly', 'fly.title': 'Fly view (F/G)', 'bev': 'BEV', 'bev.title': 'Bird\'s-eye / perspective (B)',
    'rail.hint': 'B BEV / exit\nV cycle view\nF/G fly', 'annotation': 'Annotation', 'panel.title': 'Point segmentation', 'panel.collapse': 'Collapse panel',
    'active.initial': 'View · Select a tool', 'status.tool': 'Tool', 'status.view': 'View', 'status.display': 'Display', 'status.scope': 'Scope', 'status.pending': 'Pending', 'status.selected': 'Selected',
    'view.persp': 'Free perspective', 'view.fly': 'Fly view', 'view.bev': 'Bird\'s-eye (XY)', 'view.adjustable': 'Adjustable view', 'view.locked': 'View locked', 'view.flyKeys': 'WASD/arrow keys',
    'display.window': 'All loaded frames', 'display.highlight': 'All loaded frames · highlight current', 'display.frame': 'Current frame only', 'display.hint': 'Selected by performance mode',
    'labels.heading': 'Label classes', 'labels.all': 'Show all', 'labels.none': 'Hide all', 'labels.invert': 'Invert', 'labels.only': 'Solo', 'labels.showHide': 'Show/hide', 'labels.select': 'Select', 'labels.onlyTitle': 'Show only',
    'scope.heading': 'Annotation scope', 'scope.window': 'Current window · all loaded frames', 'scope.frame': 'Current frame only', 'scope.hint': 'Selected by performance mode', 'overwrite': 'Overwrite existing labels', 'erase': 'Erase',
    'brush.radius': 'Brush radius', 'polyline.height': 'Polyline height filter', 'point.size': 'Point size', 'ground.heading': 'Ground filter', 'ground.all': 'Show all points', 'ground.hide': 'Hide ground', 'ground.only': 'Ground only', 'ground.threshold': 'Threshold',
    'action.polygon': 'Apply polygon', 'action.polyline': 'Apply polyline', 'action.selection': 'Apply selection', 'action.workspace': 'Apply workspace', 'action.clearWorkspace': 'Clear workspace', 'action.exportFrame': 'Export current-frame labels', 'action.exportClip': 'Export Clip labels',
    'timeline.sequence': 'Sequence', 'timeline.title': 'Frame timeline', 'timeline.window': 'Window', 'timeline.auto': 'Auto follow', 'timeline.hint': 'Auto: single frame on integrated GPU / 200 frames on high performance', 'legend.unmodified': 'Unmodified', 'legend.modified': 'Saved changes', 'legend.dirty': 'Pending save', 'legend.loaded': 'Loaded window',
    'dialog.unsaved': 'Unsaved changes', 'dialog.unsavedText': 'There are unsaved label changes.', 'dialog.saveContinue': 'Save and continue', 'dialog.discardContinue': 'Discard and continue', 'dialog.cancel': 'Cancel',
    'unit.frame': 'frame', 'unit.point': 'point', 'unit.points': 'points', 'unit.window': 'frame window', 'unit.range': 'frame range', 'unknown': 'Unknown', 'loaded': 'loaded', 'window.none': 'Window —',
    'status.saved': 'Saved', 'status.saving': 'Saving…', 'status.savingFrame': 'Saving current frame…', 'status.saveFailed': 'Save failed', 'status.scan': 'Scanning clips…', 'status.noClip': 'No valid Clip found in clips', 'status.chooseClip': 'Select a Clip…', 'status.openingClip': 'Opening Clip…', 'status.clipFound': '{count} Clips found', 'status.noClipHint': 'No Clip found. Put a complete Clip in clips and refresh.',
    'status.windowLoading': 'Loading full point cloud for frames {start}..{end}…', 'status.windowLoadFailed': 'Window load failed: {error}', 'status.loadFailed': 'Load failed: {error}', 'status.clipScanFailed': 'Clip scan failed: {error}',
    'status.videoLooking': 'Looking for video…', 'status.videoUndetected': 'Not detected', 'status.videoNotFound': 'Video not found', 'status.videoCheckFailed': 'Video check failed', 'status.videoFound': 'Found: {name}', 'status.videoOpened': 'Opened with the system default player: {name}', 'status.videoOpenFailed': 'Could not open video: {error}',
    'status.exported': '{label} labels exported', 'status.exportFailed': 'Failed to export {label} labels: {error}', 'status.selectionPreview': 'Selection preview: {count} points · right-click to apply', 'status.selectionApplied': 'Selection applied: {count} points', 'status.polylinePreview': 'Polyline preview: {count} points · right-click/Enter to apply', 'status.polylineApplied': 'Polyline applied: {count} points',
  },
};
function normalizeLanguage(value: string | null | undefined): Language { return value === 'en' ? 'en' : 'zh'; }
function startupLanguage(): Language {
  try { return normalizeLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY)); } catch { return 'zh'; }
}
let language: Language = startupLanguage();
function tr(key: string): string { return translations[language][key] ?? translations.zh[key] ?? key; }
function interpolate(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, String(value)), template);
}
function countText(count: number, zhUnit: string, enUnit: string): string {
  const value = count.toLocaleString();
  return language === 'zh' ? `${value} ${zhUnit}` : `${value} ${enUnit}${count === 1 ? '' : 's'}`;
}
function frameText(count: number): string { return countText(count, tr('unit.frame'), 'frame'); }
function pointText(count: number): string { return countText(count, tr('unit.points'), 'point'); }
function frameWindowText(count: number): string {
  return language === 'zh' ? `${count.toLocaleString()} 帧窗口` : `${count.toLocaleString()}-frame window`;
}

function applyStaticTranslations() {
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((element) => {
    const key = element.dataset.i18n;
    if (key) element.textContent = tr(key);
  });
  document.querySelectorAll<HTMLElement>('[data-i18n-title]').forEach((element) => {
    const key = element.dataset.i18nTitle;
    if (key) element.title = tr(key);
  });
  document.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((element) => {
    const key = element.dataset.i18nAria;
    if (key) element.setAttribute('aria-label', tr(key));
  });
  const select = document.getElementById('language') as HTMLSelectElement | null;
  if (select) select.value = language;
}

function applyLanguage(next: Language, persist = true) {
  language = normalizeLanguage(next);
  if (persist) {
    try { localStorage.setItem(LANGUAGE_STORAGE_KEY, language); } catch { /* storage may be disabled */ }
  }
  applyStaticTranslations();
  updateViewUi();
  refreshPerformanceUi();
  refreshDisplayThemeUi();
  updateFrameView();
  updateTimeline();
  buildLabelPanel();
  setDirty();
  const playButton = document.getElementById('frame-play');
  if (playButton) playButton.textContent = playTimer ? tr('stop') : tr('play');
  if (currentDatasetId) void refreshClipVideo(currentDatasetId);
}
// Shared XYZ world-space brush scale. The UI value is intentionally unitless:
// both brush and polyline use the same fixed 3D radius.
const DEFAULT_BRUSH_RADIUS = 8;
const DEFAULT_HEIGHT_FILTER = 15;
const DEFAULT_POINT_SIZE = 0.1;
type PerformanceProfile = 'auto' | 'high' | 'low';
type ResolvedPerformanceProfile = Exclude<PerformanceProfile, 'auto'>;
type PerformanceAnnotationScope = 'frame' | 'window';
interface PerformancePreset {
  windowFrames: number;
  annotationScope: PerformanceAnnotationScope;
  frameDisplayMode: 'frame' | 'window';
  label: string;
}
const PERFORMANCE_PROFILE_STORAGE_KEY = 'point-labeler-performance-profile';
const UI_SCALE_STORAGE_KEY = 'point-labeler-ui-scale';
const DISPLAY_THEME_STORAGE_KEY = 'point-labeler-display-theme';
const UI_SCALE_VALUES = [0.75, 0.85, 1, 1.1, 1.2] as const;

function normalizeDisplayTheme(value: string | null | undefined): DisplayTheme {
  return value === 'light' ? 'light' : 'dark';
}
function startupDisplayTheme(): DisplayTheme {
  try { return normalizeDisplayTheme(localStorage.getItem(DISPLAY_THEME_STORAGE_KEY)); } catch { return 'dark'; }
}
let displayTheme: DisplayTheme = startupDisplayTheme();

function normalizeUiScale(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return UI_SCALE_VALUES.reduce((nearest, candidate) =>
    Math.abs(candidate - value) < Math.abs(nearest - value) ? candidate : nearest, 1);
}
function startupUiScale(): number {
  try { return normalizeUiScale(Number(localStorage.getItem(UI_SCALE_STORAGE_KEY))); } catch { return 1; }
}
const initialUiScale = startupUiScale();
document.documentElement.style.setProperty('--ui-scale', String(initialUiScale));

function setUiScale(value: number, persist = true) {
  const scale = normalizeUiScale(value);
  document.documentElement.style.setProperty('--ui-scale', String(scale));
  const select = document.getElementById('ui-scale') as HTMLSelectElement | null;
  if (select) select.value = String(scale);
  if (persist) {
    try { localStorage.setItem(UI_SCALE_STORAGE_KEY, String(scale)); } catch { /* storage may be disabled */ }
  }
  // The scaled top bar changes the workbench's available height.
  requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
}
function adjustUiScale(direction: -1 | 1) {
  const current = normalizeUiScale(Number(document.documentElement.style.getPropertyValue('--ui-scale')));
  const index = UI_SCALE_VALUES.indexOf(current as typeof UI_SCALE_VALUES[number]);
  const nextIndex = Math.max(0, Math.min(UI_SCALE_VALUES.length - 1, index + direction));
  setUiScale(UI_SCALE_VALUES[nextIndex]);
}

function normalizePerformanceProfile(value: string | null | undefined): PerformanceProfile {
  const normalized = (value ?? '').trim().toLowerCase();
  return normalized === 'high' || normalized === 'low' || normalized === 'auto' ? normalized : 'auto';
}
function startupPerformanceProfile(): PerformanceProfile {
  const query = new URLSearchParams(window.location.search).get('profile');
  if (query) return normalizePerformanceProfile(query);
  try { return normalizePerformanceProfile(localStorage.getItem(PERFORMANCE_PROFILE_STORAGE_KEY)); } catch { return 'auto'; }
}
function performancePreset(profile: ResolvedPerformanceProfile): PerformancePreset {
  return profile === 'high'
    ? { windowFrames: 200, annotationScope: 'window', frameDisplayMode: 'window', label: tr('performance.highLabel') }
    : { windowFrames: 1, annotationScope: 'frame', frameDisplayMode: 'frame', label: tr('performance.lowLabel') };
}

const palette: RGB[] = Array.from({ length: 256 }, () => [0.55, 0.55, 0.55]);
let labelNames: Record<number, string> = {};
const labelNamesEnglish: Record<number, string> = {
  0: 'Unlabeled', 1: 'Car', 2: 'Bicycle', 3: 'Motorcycle', 4: 'Truck', 5: 'Other vehicle', 6: 'Person',
  7: 'Bicyclist', 8: 'Motorcyclist', 9: 'Road', 10: 'Parking', 11: 'Sidewalk', 12: 'Other ground',
  13: 'Building', 14: 'Fence', 15: 'Vegetation', 16: 'Trunk', 17: 'Terrain', 18: 'Pole', 19: 'Traffic sign',
  255: 'Unknown / unlabeled',
};
const labelTranslations: Record<string, string> = {
  barrier: '路障', bicycle: '自行车', bus: '公交车', car: '小汽车',
  'construction vehicle': '工程车', motorcycle: '摩托车', person: '行人',
  'traffic cone': '交通锥', trailer: '挂车', truck: '卡车',
  'drivable surface': '可行驶路面', 'other flat': '其它平面', sidewalk: '人行道',
  terrain: '地形', manmade: '人造结构', vegetation: '植被', 'unknown / free': '未知 / 未标注',
};
function displayLabelName(id: number): string {
  const raw = (labelNames[id] ?? String(id)).trim();
  if (language === 'en') return labelNamesEnglish[id] ?? raw;
  return labelTranslations[raw.toLowerCase()] ?? raw;
}
function clampUnit(value: number): number { return Math.max(0, Math.min(1, value)); }
function themedGenericColor(base: RGB): RGB {
  const luminance = 0.2126 * base[0] + 0.7152 * base[1] + 0.0722 * base[2];
  if (displayTheme === 'dark') {
    if (luminance >= 0.28) return base;
    const lift = 0.28 - luminance + 0.08;
    return [clampUnit(base[0] + lift), clampUnit(base[1] + lift), clampUnit(base[2] + lift)];
  }
  if (luminance <= 0.68) return base;
  const scale = 0.68 / Math.max(0.001, luminance);
  return [clampUnit(base[0] * scale), clampUnit(base[1] * scale), clampUnit(base[2] * scale)];
}
function colorForLabel(id: number): RGB {
  return themedGenericColor(palette[id & 255]);
}
function displayDatasetFormat(format?: string): string {
  if (format === 'semantickitti') return 'SemanticKITTI';
  if (format === 'kitti_odometry') return 'KITTI Odometry';
  if (format === 'kitti_object') return 'KITTI Object';
  if (format === 'kitti_bin') return 'KITTI .bin';
  return language === 'en' ? 'Unknown format' : '未知格式';
}
async function loadPalette(): Promise<Record<number, string>> {
  const names: Record<number, string> = {};
  try {
    const xml = await fetch('/api/labels.xml').then((r) => r.text());
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    doc.querySelectorAll('label').forEach((el) => {
      const id = parseInt(el.querySelector('id')?.textContent ?? '255', 10);
      const name = el.querySelector('name')?.textContent ?? String(id);
      const rgb = (el.querySelector('color')?.textContent ?? '128 128 128')
        .trim().split(/\s+/).map((n) => parseInt(n, 10));
      palette[id & 255] = [(rgb[0] ?? 128) / 255, (rgb[1] ?? 128) / 255, (rgb[2] ?? 128) / 255];
      names[id] = name;
    });
  } catch (e) { console.warn('labels.xml load failed', e); }
  return names;
}

const viewport = document.getElementById('viewport')!;
const statsEl = document.getElementById('stats')!;
const hoverEl = document.getElementById('hover')!;
const windowStatsEl = document.getElementById('window-stats')!;
const scene = new THREE.Scene();
scene.background = new THREE.Color(displayTheme === 'light' ? 0xd9dee7 : 0x111114);
const initialViewportWidth = viewport.clientWidth || innerWidth;
const initialViewportHeight = viewport.clientHeight || innerHeight;
const camera = new THREE.PerspectiveCamera(60, initialViewportWidth / Math.max(1, initialViewportHeight), 0.1, 10000);
camera.up.set(0, 0, 1);
const bevCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 5000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(initialViewportWidth, initialViewportHeight);
viewport.appendChild(renderer.domElement);

function detectGpuRenderer(): string {
  try {
    const context = renderer.getContext();
    const debugInfo = context.getExtension('WEBGL_debug_renderer_info') as {
      UNMASKED_RENDERER_WEBGL: number;
    } | null;
    const value = debugInfo
      ? context.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)
      : context.getParameter(context.RENDERER);
    return typeof value === 'string' ? value : '';
  } catch {
    return '';
  }
}
function autoPerformanceProfile(gpuRenderer: string): ResolvedPerformanceProfile {
  const rendererText = gpuRenderer.toLowerCase();
  const lowGpu = /(swiftshader|llvmpipe|microsoft basic|uhd graphics|hd graphics|iris xe|intel\(r\).*graphics)/.test(rendererText);
  if (lowGpu) return 'low';
  const highGpu = /(nvidia|geforce|quadro|rtx|gtx|amd|radeon|intel.*arc)/.test(rendererText);
  if (highGpu) return 'high';
  const deviceMemory = Number((navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 0);
  const cores = navigator.hardwareConcurrency ?? 0;
  return deviceMemory >= 16 && cores >= 8 ? 'high' : 'low';
}
const gpuRendererName = detectGpuRenderer();
const startupRequestedProfile = startupPerformanceProfile();
let requestedPerformanceProfile: PerformanceProfile = startupRequestedProfile;
let activePerformanceProfile: ResolvedPerformanceProfile = startupRequestedProfile === 'auto'
  ? autoPerformanceProfile(gpuRendererName)
  : startupRequestedProfile;
const initialPerformancePreset = performancePreset(activePerformanceProfile);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.maxDistance = 100000;
controls.minDistance = 0.2;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
const wsPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

let tool: Tool = 'navigate';
let viewMode: ViewMode = 'persp';
const ortho = { cx: 0, cy: 0, cz: 500, targetZ: 0, halfH: 100, roll: 0, distance: 1000 };
const worldUp = new THREE.Vector3(0, 0, 1);
const flyKeys = new Set<string>();
const flyLookSpeed = 0.004;
const flyTurnSpeed = 1.8;
const flyRollSpeed = 1.4;
let flyDragButton: 0 | 1 | 2 = 0;
let flyPointerId = -1;
let flyLastPointer: [number, number] = [0, 0];
let flyPanRadius = 30;
let flyBaseSpeed = 45;
const flyKeyCodes = new Set([
  'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'KeyZ', 'KeyC', 'KeyR', 'KeyT',
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight',
]);
let bevPanning = false;
let bevPanAnchor: [number, number] = [0, 0];
function isOrthoMode(mode: ViewMode): mode is OrthoView {
  return mode === 'bev';
}
function isOrthoView(): boolean { return isOrthoMode(viewMode); }
function activeCamera(): THREE.Camera { return isOrthoView() ? bevCamera : camera; }
function flyForward(): THREE.Vector3 {
  return new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
}
function flyRight(): THREE.Vector3 {
  return new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion).normalize();
}
function flyUp(): THREE.Vector3 {
  return new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion).normalize();
}
function syncFlyTarget() {
  controls.target.copy(camera.position).add(flyForward().multiplyScalar(flyPanRadius));
}
function rotateFly(yaw: number, pitch: number, roll: number) {
  if (yaw !== 0) camera.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(worldUp, yaw));
  if (pitch !== 0) {
    const forward = flyForward();
    const currentPitch = Math.asin(Math.max(-1, Math.min(1, forward.dot(worldUp))));
    const desiredPitch = Math.max(-1.45, Math.min(1.45, currentPitch + pitch));
    const right = flyRight();
    camera.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(right, desiredPitch - currentPitch));
  }
  if (roll !== 0) camera.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(flyForward(), roll));
  camera.quaternion.normalize();
  camera.updateMatrixWorld(true);
  syncFlyTarget();
}
function flyLook(deltaX: number, deltaY: number) {
  rotateFly(-deltaX * flyLookSpeed, -deltaY * flyLookSpeed, 0);
}
function flyPan(deltaX: number, deltaY: number) {
  const scale = Math.max(0.01, flyPanRadius * 0.0015);
  const shift = flyRight().multiplyScalar(-deltaX * scale).add(flyUp().multiplyScalar(deltaY * scale));
  camera.position.add(shift);
  controls.target.add(shift);
  camera.updateMatrixWorld(true);
}
function updateFlyCamera(deltaSeconds: number) {
  if (viewMode !== 'fly' || tool !== 'navigate') return;
  const movement = new THREE.Vector3();
  const forward = flyForward();
  const right = flyRight();
  if (flyKeys.has('KeyW')) movement.add(forward);
  if (flyKeys.has('KeyS')) movement.sub(forward);
  if (flyKeys.has('KeyA')) movement.sub(right);
  if (flyKeys.has('KeyD')) movement.add(right);
  if (flyKeys.has('KeyZ')) movement.sub(worldUp);
  if (flyKeys.has('KeyC')) movement.add(worldUp);
  const speedMultiplier = flyKeys.has('ShiftLeft') || flyKeys.has('ShiftRight') ? 3 : 1;
  const controlMultiplier = flyKeys.has('ControlLeft') || flyKeys.has('ControlRight') ? 0.25 : 1;
  const speed = Math.max(3, flyBaseSpeed) * speedMultiplier * controlMultiplier;
  if (movement.lengthSq() > 0) camera.position.addScaledVector(movement.normalize(), speed * deltaSeconds);
  let yaw = 0, pitch = 0, roll = 0;
  if (flyKeys.has('KeyQ') || flyKeys.has('ArrowLeft')) yaw += flyTurnSpeed * deltaSeconds;
  if (flyKeys.has('KeyE') || flyKeys.has('ArrowRight')) yaw -= flyTurnSpeed * deltaSeconds;
  if (flyKeys.has('ArrowUp')) pitch += flyTurnSpeed * deltaSeconds;
  if (flyKeys.has('ArrowDown')) pitch -= flyTurnSpeed * deltaSeconds;
  if (flyKeys.has('KeyR')) roll += flyRollSpeed * deltaSeconds;
  if (flyKeys.has('KeyT')) roll -= flyRollSpeed * deltaSeconds;
  if (yaw !== 0 || pitch !== 0 || roll !== 0) rotateFly(yaw, pitch, roll);
  else if (movement.lengthSq() > 0) syncFlyTarget();
}
function clearFlyInput() {
  flyKeys.clear();
  flyDragButton = 0;
  flyPointerId = -1;
}
function beginFlyDrag(event: PointerEvent): boolean {
  if (viewMode !== 'fly' || tool !== 'navigate' || (event.button !== 0 && event.button !== 2)) return false;
  event.preventDefault();
  flyDragButton = event.button === 0 ? 1 : 2;
  flyPointerId = event.pointerId;
  flyLastPointer = [event.clientX, event.clientY];
  renderer.domElement.setPointerCapture?.(event.pointerId);
  return true;
}
function endFlyDrag(event?: PointerEvent) {
  if (!flyDragButton || (event && flyPointerId !== event.pointerId)) return;
  if (event && renderer.domElement.hasPointerCapture?.(event.pointerId)) renderer.domElement.releasePointerCapture(event.pointerId);
  flyDragButton = 0;
  flyPointerId = -1;
}
function dataBounds() {
  if (!data || data.pointCount === 0) return null;
  const min = new THREE.Vector3(Infinity, Infinity, Infinity), max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  for (let i = 0; i < data.pointCount; i++) {
    min.x = Math.min(min.x, data.positions[i * 3]); max.x = Math.max(max.x, data.positions[i * 3]);
    min.y = Math.min(min.y, data.positions[i * 3 + 1]); max.y = Math.max(max.y, data.positions[i * 3 + 1]);
    min.z = Math.min(min.z, data.positions[i * 3 + 2]); max.z = Math.max(max.z, data.positions[i * 3 + 2]);
  }
  return { min, max, center: min.clone().add(max).multiplyScalar(0.5), span: max.clone().sub(min) };
}
function updateBevCamera() {
  const el = renderer.domElement;
  const aspect = (el.clientWidth || 1) / (el.clientHeight || 1);
  const h = ortho.halfH;
  bevCamera.left = -h * aspect; bevCamera.right = h * aspect;
  bevCamera.top = h; bevCamera.bottom = -h;
  const target = new THREE.Vector3(ortho.cx, ortho.cy, ortho.targetZ);
  if (viewMode === 'bev') {
    bevCamera.position.set(ortho.cx, ortho.cy, ortho.targetZ + ortho.distance);
    bevCamera.up.set(-Math.sin(ortho.roll), Math.cos(ortho.roll), 0);
  }
  bevCamera.lookAt(target);
  bevCamera.updateProjectionMatrix();
  bevCamera.updateMatrixWorld(true);
}
function bevWorldAt(cx: number, cy: number): [number, number] {
  const rect = renderer.domElement.getBoundingClientRect();
  const v = new THREE.Vector2(((cx - rect.left) / rect.width) * 2 - 1, -((cy - rect.top) / rect.height) * 2 + 1);
  bevCamera.updateMatrixWorld(true);
  const rc = new THREE.Raycaster(); rc.setFromCamera(v, activeCamera());
  const hit = new THREE.Vector3();
  return rc.ray.intersectPlane(wsPlane, hit) ? [hit.x, hit.y] : [ortho.cx, ortho.cy];
}
function fitOrthoView(mode: OrthoView) {
  const bounds = dataBounds();
  if (!bounds) return;
  const aspect = (renderer.domElement.clientWidth || 1) / (renderer.domElement.clientHeight || 1);
  const x = Math.max(bounds.span.x, 1), y = Math.max(bounds.span.y, 1), z = Math.max(bounds.span.z, 1);
  ortho.cx = bounds.center.x; ortho.cy = bounds.center.y; ortho.targetZ = bounds.center.z; ortho.roll = 0;
  ortho.halfH = Math.max(2, Math.max(z * 0.58, x / Math.max(0.2, aspect) * 0.58));
  ortho.distance = Math.max(100, Math.max(x, y, z) * 10);
  updateBevCamera();
}
function updateViewUi() {
  const names: Record<ViewMode, string> = { persp: tr('view.persp'), fly: tr('view.fly'), bev: tr('view.bev') };
  const button = document.getElementById('bev'); if (button) button.classList.toggle('active', viewMode === 'bev');
  const flyButton = document.getElementById('fly'); if (flyButton) flyButton.classList.toggle('active', viewMode === 'fly');
  document.title = `${tr('brand.name')} · ${names[viewMode]}`;
  updateOperationStatus();
}
function setViewMode(next: ViewMode) {
  if (next === viewMode && (next === 'persp' || data)) { updateViewUi(); return; }
  const leavingFly = viewMode === 'fly' && next !== 'fly';
  if (leavingFly && next === 'persp') {
    camera.updateMatrixWorld(true);
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
    controls.target.copy(camera.position).add(direction.multiplyScalar(Math.max(10, camera.position.distanceTo(controls.target))));
  }
  viewMode = next;
  clearFlyInput();
  if (isOrthoMode(next)) {
    controls.enabled = false; controls.enableDamping = false;
    fitOrthoView(next);
  } else if (next === 'fly') {
    controls.enabled = false; controls.enableDamping = false;
    flyPanRadius = Math.max(10, camera.position.distanceTo(controls.target));
    flyBaseSpeed = Math.max(3, flyPanRadius * 0.35);
  } else {
    controls.enabled = tool === 'navigate'; controls.enableDamping = tool === 'navigate';
  }
  screenIndexDirty = true; updateViewUi(); drawOverlay();
}
function enterBev() { setViewMode('bev'); }
function exitBev() { setViewMode('persp'); }
function toggleFly() { setViewMode(viewMode === 'fly' ? 'persp' : 'fly'); }
function toggleBev() {
  viewMode === 'bev' ? exitBev() : enterBev();
  document.getElementById('bev')!.classList.toggle('active', viewMode === 'bev');
  updateOperationStatus();
}
function cycleViewMode() {
  const next: ViewMode = viewMode === 'persp' ? 'fly' : viewMode === 'fly' ? 'bev' : 'persp';
  setViewMode(next);
}

const sharedMat = new THREE.ShaderMaterial({
  uniforms: {
    uWorldSize: { value: DEFAULT_POINT_SIZE },
    uViewportH: { value: initialViewportHeight },
    uOrtho: { value: 0 },
    uActiveFrame: { value: 0 },
    uFrameFocus: { value: 0 },
    uDimOtherFrames: { value: 0 },
  },
  vertexShader: `
    attribute vec3 color;
    attribute float frameIndex;
    attribute float visible;
    attribute float selected;
    uniform float uWorldSize;
    uniform float uViewportH;
    uniform float uOrtho;
    uniform float uActiveFrame;
    uniform float uFrameFocus;
    varying vec3 vColor;
    varying float vVisible;
    varying float vSelected;
    varying float vActive;
    void main() {
      vColor = color; vVisible = visible; vSelected = selected;
      vActive = abs(frameIndex - uActiveFrame) < 0.5 ? 1.0 : 0.0;
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mv;
      if (uOrtho > 0.5) {
        gl_PointSize = uWorldSize * uViewportH * projectionMatrix[1][1];
      } else {
        gl_PointSize = uWorldSize * uViewportH * projectionMatrix[1][1] / max(0.001, -2.0 * mv.z);
      }
      if (vSelected > 0.5) gl_PointSize += 2.0;
    }`,
  fragmentShader: `
    uniform float uFrameFocus;
    uniform float uDimOtherFrames;
    varying vec3 vColor; varying float vVisible; varying float vSelected; varying float vActive;
    void main() {
      if (vVisible < 0.5) discard;
      if (uFrameFocus > 0.5 && vActive < 0.5) discard;
      vec2 c = gl_PointCoord - vec2(0.5);
      if (dot(c, c) > 0.25) discard;
      vec3 color = vSelected > 0.5 ? mix(vColor, vec3(1.0, 0.55, 0.08), 0.85) : vColor;
      if (uDimOtherFrames > 0.5 && vActive < 0.5) color *= 0.42;
      gl_FragColor = vec4(color, 1.0);
    }`,
});

interface RenderData {
  positions: Float32Array;
  frameIndex: Uint32Array;
  frameVisual: Float32Array;
  pointIndex: Uint32Array;
  semantic: Uint8Array;
  colors: Float32Array;
  visible: Float32Array;
  selected: Float32Array;
  groundDelta: Float32Array | null;
  colorAttr: THREE.BufferAttribute;
  frameAttr: THREE.BufferAttribute;
  visibleAttr: THREE.BufferAttribute;
  selectedAttr: THREE.BufferAttribute;
  pointCount: number;
}
let data: RenderData | null = null;
let pointsObject: THREE.Points | null = null;
function installPacket(packet: FramePacket) {
  const colors = new Float32Array(packet.pointCount * 3);
  const frameVisual = new Float32Array(packet.frameIndex);
  for (let i = 0; i < packet.pointCount; i++) {
    const [r, g, b] = colorForLabel(packet.semantic[i] & 255);
    colors[i * 3] = r; colors[i * 3 + 1] = g; colors[i * 3 + 2] = b;
  }
  const colorAttr = new THREE.BufferAttribute(colors, 3);
  const frameAttr = new THREE.BufferAttribute(frameVisual, 1);
  const visibleAttr = new THREE.BufferAttribute(new Float32Array(packet.pointCount).fill(1), 1);
  const selectedAttr = new THREE.BufferAttribute(new Float32Array(packet.pointCount), 1);
  const next: RenderData = {
    positions: packet.positions, frameIndex: packet.frameIndex, frameVisual, pointIndex: packet.pointIndex,
    semantic: packet.semantic, colors, visible: visibleAttr.array as Float32Array,
    selected: selectedAttr.array as Float32Array, groundDelta: null,
    colorAttr, frameAttr, visibleAttr, selectedAttr, pointCount: packet.pointCount,
  };
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(packet.positions, 3));
  geometry.setAttribute('color', colorAttr);
  geometry.setAttribute('frameIndex', frameAttr);
  geometry.setAttribute('visible', visibleAttr);
  geometry.setAttribute('selected', selectedAttr);
  geometry.computeBoundingSphere();
  const nextPoints = new THREE.Points(geometry, sharedMat);
  nextPoints.frustumCulled = false;
  if (pointsObject) {
    scene.remove(pointsObject);
    pointsObject.geometry.dispose();
  }
  pointsObject = nextPoints; scene.add(nextPoints); data = next;
  recountLabelStats();
  buildLabelPanel();
  groundDirty = true; screenIndexDirty = true;
}

function refreshDisplayThemeUi() {
  const select = document.getElementById('display-theme') as HTMLSelectElement | null;
  if (select) select.value = displayTheme;
  const status = document.getElementById('display-theme-status');
  if (status) status.textContent = displayTheme === 'light' ? tr('theme.light') : tr('theme.dark');
}
function refreshRenderColors() {
  if (data) {
    for (let i = 0; i < data.pointCount; i++) {
      const [r, g, b] = colorForLabel(data.semantic[i] & 255);
      data.colors[i * 3] = r;
      data.colors[i * 3 + 1] = g;
      data.colors[i * 3 + 2] = b;
    }
    data.colorAttr.needsUpdate = true;
  }
  buildLabelPanel();
}
function applyDisplayTheme(next: DisplayTheme, persist = true) {
  displayTheme = normalizeDisplayTheme(next);
  scene.background = new THREE.Color(displayTheme === 'light' ? 0xd9dee7 : 0x111114);
  refreshDisplayThemeUi();
  if (persist) {
    try { localStorage.setItem(DISPLAY_THEME_STORAGE_KEY, displayTheme); } catch { /* storage may be disabled */ }
  }
  refreshRenderColors();
}

// --- global ground model ------------------------------------------------------
let groundMode: 'all' | 'hide' | 'only' = 'all';
let groundThreshold = 0.3;
const GROUND_GRID = 0.5;
const groundCells = new Map<number, { minZ: number; prior: number[]; baseline: number }>();
let groundDirty = true;
function isGroundSemantic(id: number): boolean {
  if (usesSixClassLabels()) return id === 0;
  const entry = datasetEntries.find((item) => item.id === currentDatasetId);
  return entry?.format === 'semantickitti'
    ? [9, 10, 11, 12, 17].includes(id)
    : id === 10;
}
function groundKey(x: number, y: number): number {
  const ix = Math.round(x / GROUND_GRID), iy = Math.round(y / GROUND_GRID);
  return (ix + 100000) * 200001 + iy + 100000;
}
function ensureGroundModel() {
  if (!groundDirty || !data) return;
  groundCells.clear();
  for (let i = 0; i < data.pointCount; i++) {
    const key = groundKey(data.positions[i * 3], data.positions[i * 3 + 1]);
    let cell = groundCells.get(key);
    if (!cell) { cell = { minZ: Infinity, prior: [], baseline: 0 }; groundCells.set(key, cell); }
    const z = data.positions[i * 3 + 2];
    cell.minZ = Math.min(cell.minZ, z);
    if (isGroundSemantic(data.semantic[i] & 255)) {
      if (cell.prior.length < 24) cell.prior.push(z);
      else {
        let maxAt = 0;
        for (let j = 1; j < cell.prior.length; j++) if (cell.prior[j] > cell.prior[maxAt]) maxAt = j;
        if (z < cell.prior[maxAt]) cell.prior[maxAt] = z;
      }
    }
  }
  for (const [key, cell] of groundCells) {
    let samples = cell.prior.slice();
    if (samples.length < 8) {
      const ix = Math.floor(key / 200001) - 100000;
      const iy = (key % 200001) - 100000;
      samples = [];
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const n = groundCells.get((ix + dx + 100000) * 200001 + iy + dy + 100000);
        if (n) samples.push(...n.prior);
      }
    }
    if (samples.length >= 8) {
      samples.sort((a, b) => a - b);
      cell.baseline = samples[Math.floor((samples.length - 1) * 0.2)];
    } else cell.baseline = cell.minZ;
  }
  data.groundDelta = new Float32Array(data.pointCount);
  for (let i = 0; i < data.pointCount; i++) {
    const cell = groundCells.get(groundKey(data.positions[i * 3], data.positions[i * 3 + 1]));
    data.groundDelta[i] = data.positions[i * 3 + 2] - (cell?.baseline ?? data.positions[i * 3 + 2]);
  }
  groundDirty = false;
}

// --- workspace and visibility -------------------------------------------------
const hiddenClasses = new Set<number>();
let workspacePoly: [number, number][] | null = null;
let workspaceVerts: [number, number][] = [];
let workspaceLine: THREE.LineLoop | null = null;
function pointInPolyNum(x: number, y: number, p: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    if (((p[i][1] > y) !== (p[j][1] > y)) &&
        (x < ((p[j][0] - p[i][0]) * (y - p[i][1])) / (p[j][1] - p[i][1]) + p[i][0])) inside = !inside;
  }
  return inside;
}
function recomputeVisibility() {
  if (!data) return;
  if (groundMode !== 'all') ensureGroundModel();
  const gd = data.groundDelta;
  for (let i = 0; i < data.pointCount; i++) {
    const s = data.semantic[i] & 255;
    let visible = hiddenClasses.has(s) ? 0 : 1;
    if (visible && groundMode !== 'all') {
      const ground = isGroundSemantic(s) || (gd !== null && gd[i] <= groundThreshold);
      if (groundMode === 'hide' && ground) visible = 0;
      if (groundMode === 'only' && !ground) visible = 0;
    }
    if (visible && workspacePoly &&
        !pointInPolyNum(data.positions[i * 3], data.positions[i * 3 + 1], workspacePoly)) visible = 0;
    data.visible[i] = visible;
  }
  data.visibleAttr.needsUpdate = true;
  screenIndexDirty = true;
}
function buildWorkspaceLine() {
  if (workspaceLine) { scene.remove(workspaceLine); workspaceLine.geometry.dispose(); workspaceLine = null; }
  if (!workspacePoly || workspacePoly.length < 2) return;
  const geometry = new THREE.BufferGeometry();
  const vertices = new Float32Array(workspacePoly.length * 3);
  workspacePoly.forEach((p, i) => { vertices[i * 3] = p[0]; vertices[i * 3 + 1] = p[1]; });
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  workspaceLine = new THREE.LineLoop(geometry, new THREE.LineBasicMaterial({ color: 0x66ddff }));
  scene.add(workspaceLine);
}
async function persistWorkspace() {
  if (!currentDatasetId) return;
  await fetch(`/api/datasets/${encodeURIComponent(currentDatasetId)}/workspace`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ points: workspacePoly || [] }),
  }).catch((e) => console.warn('workspace persist failed', e));
}
async function loadWorkspace() {
  if (!currentDatasetId) return;
  try {
    const j = await fetch(`/api/datasets/${encodeURIComponent(currentDatasetId)}/workspace`).then((r) => r.json());
    workspacePoly = j.points?.length >= 3 ? j.points.map((p: number[]) => [p[0], p[1]] as [number, number]) : null;
    buildWorkspaceLine(); recomputeVisibility(); drawOverlay();
  } catch { workspacePoly = null; }
}
function applyWorkspace() {
  if (workspaceVerts.length < 3) return;
  workspacePoly = workspaceVerts.slice(); workspaceVerts = [];
  buildWorkspaceLine(); recomputeVisibility(); drawOverlay(); void persistWorkspace();
  (document.getElementById('ws-apply') as HTMLButtonElement).disabled = true;
}
function clearWorkspace() {
  workspacePoly = null; workspaceVerts = []; buildWorkspaceLine(); recomputeVisibility(); drawOverlay(); void persistWorkspace();
  (document.getElementById('ws-apply') as HTMLButtonElement).disabled = true;
}
function projectClickToGround(cx: number, cy: number): [number, number] | null {
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((cx - rect.left) / rect.width) * 2 - 1; mouse.y = -((cy - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, activeCamera());
  const hit = new THREE.Vector3();
  return raycaster.ray.intersectPlane(wsPlane, hit) ? [hit.x, hit.y] : null;
}

// --- edits and frame-window state ---------------------------------------------
let currentDatasetId = '';
let frameInfos: FrameInfo[] = [];
let framePrefix: number[] = [];
interface DatasetEntryClient { id: string; path: string; format?: string; labelClassCount?: number; labelSchema?: string; }
interface ClipVideoInfo { name: string; mimeType?: string; url: string; }
let datasetEntries: DatasetEntryClient[] = [];
let clipVideoInfo: ClipVideoInfo | null = null;
function usesSixClassLabels(): boolean {
  return false;
}
const DEFAULT_WINDOW_FRAMES = initialPerformancePreset.windowFrames;
let windowSize = DEFAULT_WINDOW_FRAMES;
let windowStart = 0;
let activeFrame = 0;
let requestedActiveFrame: number | null = null;
let windowChanging = false;
let queuedWindowStart: number | null = null;
let queuedWindowForce = false;
let pendingWindowSizeRestore: number | null = null;
let overwrite = true;
let eraseMode = false;
let annotationScope: PerformanceAnnotationScope = initialPerformancePreset.annotationScope;
let frameDisplayMode: 'window' | 'highlight' | 'frame' = initialPerformancePreset.frameDisplayMode;

function refreshPerformanceUi() {
  const select = document.getElementById('performance-profile') as HTMLSelectElement | null;
  if (select) select.value = requestedPerformanceProfile;
  const scope = document.getElementById('annotation-scope') as HTMLSelectElement | null;
  if (scope) scope.value = annotationScope;
  const display = document.getElementById('frame-display') as HTMLSelectElement | null;
  if (display) display.value = frameDisplayMode;
  const status = document.getElementById('performance-status');
  if (status) {
    status.textContent = requestedPerformanceProfile === 'auto'
      ? `${tr('performance.autoLabel')} → ${activePerformanceProfile === 'high' ? tr('performance.highLabel') : tr('performance.lowLabel')}`
      : performancePreset(activePerformanceProfile).label;
  }
  const hint = document.getElementById('performance-hint');
  if (hint) {
    const rendererText = gpuRendererName.replace(/\s+/g, ' ').trim();
    const shortRenderer = rendererText.length > 68 ? `${rendererText.slice(0, 68)}…` : rendererText;
    hint.textContent = `${shortRenderer || tr('performance.gpuUnknown')} · ${tr('performance.currentDefault')} ${frameText(performancePreset(activePerformanceProfile).windowFrames)}`;
  }
}

async function applyPerformanceProfile(requested: PerformanceProfile, reload = true): Promise<boolean> {
  const nextActive = requested === 'auto' ? autoPerformanceProfile(gpuRendererName) : requested;
  const nextPreset = performancePreset(nextActive);
  const needsReload = !!data && frameInfos.length > 0 && nextPreset.windowFrames !== windowSize;
  if (reload && needsReload && !(await confirmBeforeReplace())) {
    refreshPerformanceUi();
    return false;
  }

  const previousWindowSize = windowSize;
  requestedPerformanceProfile = requested;
  activePerformanceProfile = nextActive;
  windowSize = nextPreset.windowFrames;
  annotationScope = nextPreset.annotationScope;
  frameDisplayMode = nextPreset.frameDisplayMode;
  const scope = document.getElementById('annotation-scope') as HTMLSelectElement | null;
  if (scope) scope.value = annotationScope;
  const display = document.getElementById('frame-display') as HTMLSelectElement | null;
  if (display) display.value = frameDisplayMode;
  refreshPerformanceUi(); updateFrameView(); updateTimeline();

  if (reload && needsReload && previousWindowSize !== windowSize) {
    undoStack.length = 0; redoStack.length = 0; updateUndoRedo();
    requestedActiveFrame = activeFrame;
    const start = Math.max(0, Math.min(maxWindowStart(), activeFrame - Math.floor(windowSize / 2)));
    try { await loadWindowInternal(start); }
    catch (error) { console.warn('performance profile reload failed', error); statsEl.textContent = interpolate(tr('status.windowLoadFailed'), { error: String(error) }); }
  }
  return true;
}

function effectiveWindowSize(): number {
  return frameInfos.length > 0 ? Math.min(windowSize, frameInfos.length) : windowSize;
}
const labelCounts = new Uint32Array(256);
const edits = new Map<number, Map<number, number>>();
// Frames changed during this session and successfully written to disk.
const modifiedFrames = new Set<number>();
interface PointChange { index: number; frameIndex: number; pointIndex: number; before: number; after: number; }
interface Command { changes: PointChange[]; }
const undoStack: Command[] = [];
const redoStack: Command[] = [];
let stroke: Map<string, PointChange> | null = null;
let interactivePaintBatch = false;
let interactivePaintMin = Number.POSITIVE_INFINITY;
let interactivePaintMax = -1;

function updateOperationStatus() {
  const toolNames: Record<Tool, string> = {
    navigate: tr('tool.navigate'), brush: tr('tool.brush'), polygon: tr('tool.polygon'), polyline: tr('tool.polyline'),
    rect: tr('tool.rect'), lasso: tr('tool.lasso'), workspace: tr('tool.workspace'),
  };
  const toolDescriptions: Record<Tool, string> = {
    navigate: `${tr('tool.navigate')} · ${language === 'zh' ? '调整相机' : 'adjust camera'}`,
    brush: `${tr('tool.brush')} · ${language === 'zh' ? '标注点' : 'label points'}`,
    polygon: `${tr('tool.polygon')} · ${language === 'zh' ? '添加顶点' : 'add vertices'}`,
    polyline: `${tr('tool.polyline')} · ${language === 'zh' ? '添加路沿顶点' : 'add curb vertices'}`,
    rect: `${tr('tool.rect')} · ${language === 'zh' ? '拖动选区' : 'drag a region'}`,
    lasso: `${tr('tool.lasso')} · ${language === 'zh' ? '绘制选区' : 'draw a region'}`,
    workspace: `${tr('tool.workspace')} · ${language === 'zh' ? '定义 XY 区域' : 'define an XY region'}`,
  };
  const setText = (id: string, value: string) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  let pendingPoints = 0;
  edits.forEach((map) => { pendingPoints += map.size; });
  setText('status-tool', toolNames[tool]);
  setText('active-tool', toolDescriptions[tool]);
  const viewNames: Record<ViewMode, string> = { persp: tr('view.persp'), fly: tr('view.fly'), bev: tr('view.bev') };
  const viewHint = viewMode === 'fly' && tool === 'navigate' ? tr('view.flyKeys') : tool === 'navigate' ? tr('view.adjustable') : tr('view.locked');
  setText('status-view', `${viewNames[viewMode]} · ${viewHint}`);
  setText('status-display', frameDisplayMode === 'frame' ? tr('display.frame') : frameDisplayMode === 'highlight' ? tr('display.highlight') : tr('display.window'));
  setText('status-scope', annotationScope === 'window' ? frameWindowText(effectiveWindowSize()) : (language === 'zh' ? '当前帧' : 'Current frame'));
  setText('status-pending', `${countText(pendingPoints, '点', 'point')} · ${frameText(edits.size)}`);
  setText('status-selected', countText(selectionPreviewHits.length, '点', 'point'));
}
function updateSelectionStats() {
  const value = countText(selectionPreviewHits.length, '点', 'point');
  const status = document.getElementById('status-selected');
  if (status) status.textContent = value;
}
function refreshLabelStatsUI() {
  const total = data?.pointCount ?? 0;
  const unknown = labelCounts[255] ?? 0;
  const summary = document.getElementById('label-summary');
  if (summary) summary.textContent = language === 'zh'
    ? `未知 ${unknown.toLocaleString()} · 已加载 ${total.toLocaleString()}`
    : `${unknown.toLocaleString()} unknown · ${total.toLocaleString()} loaded`;
  const chipColor = colorForLabel(activeLabel).map((value) => Math.round(value * 255)).join(',');
  const swatch = document.getElementById('active-label-swatch') as HTMLElement | null;
  if (swatch) swatch.style.backgroundColor = `rgb(${chipColor})`;
  const id = document.getElementById('active-label-id'); if (id) id.textContent = String(activeLabel);
  const name = document.getElementById('active-label-name'); if (name) name.textContent = displayLabelName(activeLabel);
  updateOperationStatus();
}
function recountLabelStats() {
  labelCounts.fill(0);
  if (!data) { refreshLabelStatsUI(); return; }
  for (let i = 0; i < data.pointCount; i++) {
    const semantic = data.semantic[i] & 255;
    labelCounts[semantic]++;
  }
}
function labelIds(): number[] {
  if (!currentDatasetId) return [];
  if (usesSixClassLabels()) return [0, 1, 2, 3, 4, 5, 255];
  return Object.keys(labelNames).map((value) => parseInt(value, 10)).filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
}
function labelShortcut(id: number): string | null {
  return id >= 0 && id <= 9 && labelIds().includes(id) ? `Alt+${id}` : null;
}
function labelIdForShortcut(key: string): number | null {
  const id = parseInt(key, 10);
  return id >= 0 && id <= 9 && labelIds().includes(id) ? id : null;
}

function isPointDisplayed(index: number): boolean {
  return frameDisplayMode === 'window' || !data || data.frameIndex[index] === activeFrame;
}
function updateFrameView() {
  sharedMat.uniforms.uActiveFrame.value = activeFrame;
  sharedMat.uniforms.uFrameFocus.value = frameDisplayMode === 'frame' ? 1 : 0;
  sharedMat.uniforms.uDimOtherFrames.value = frameDisplayMode === 'highlight' ? 1 : 0;
  screenIndexDirty = true;
  const display = document.getElementById('display-label');
  if (display) display.textContent = frameDisplayMode === 'frame'
    ? tr('display.frame')
    : frameDisplayMode === 'highlight' ? tr('display.highlight') : tr('display.window');
  updateOperationStatus();
}

const unsavedDialog = document.getElementById('unsaved-dialog') as HTMLDivElement;
const unsavedText = document.getElementById('unsaved-text') as HTMLDivElement;
let unsavedResolver: ((choice: 'save' | 'discard' | 'cancel') => void) | null = null;
function askUnsavedAction(): Promise<'save' | 'discard' | 'cancel'> {
  unsavedText.textContent = language === 'zh'
    ? `有 ${edits.size.toLocaleString()} 帧包含未保存的标签修改。`
    : `${edits.size.toLocaleString()} frame${edits.size === 1 ? '' : 's'} contain unsaved label changes.`;
  unsavedDialog.hidden = false;
  return new Promise((resolve) => { unsavedResolver = resolve; });
}
function resolveUnsavedAction(choice: 'save' | 'discard' | 'cancel') {
  unsavedDialog.hidden = true; const resolve = unsavedResolver; unsavedResolver = null; resolve?.(choice);
}
function setDirty() {
  let count = 0; edits.forEach((m) => { count += m.size; });
  document.getElementById('dirty')!.textContent = count === 0
    ? tr('dirty.none')
    : language === 'zh' ? `${count.toLocaleString()} 个待保存` : `${count.toLocaleString()} ${tr('dirty.pending')}`;
  updateOperationStatus(); updateSaveButtons();
}
function updateSaveButtons() {
  const saveAll = document.getElementById('save') as HTMLButtonElement | null;
  const saveFrame = document.getElementById('save-frame') as HTMLButtonElement | null;
  if (saveAll) saveAll.disabled = edits.size === 0;
  if (saveFrame) saveFrame.disabled = !edits.has(activeFrame);
}
function updateUndoRedo() {
  (document.getElementById('undo') as HTMLButtonElement).disabled = undoStack.length === 0;
  (document.getElementById('redo') as HTMLButtonElement).disabled = redoStack.length === 0;
}
function addEdit(frameIndex: number, pointIndex: number, semantic: number) {
  let map = edits.get(frameIndex); if (!map) { map = new Map(); edits.set(frameIndex, map); }
  map.set(pointIndex, semantic);
}
function pointInAnnotationScope(index: number): boolean {
  return annotationScope === 'window' || !data || data.frameIndex[index] === activeFrame;
}
function markRange(attr: THREE.BufferAttribute, offset: number, count: number) {
  attr.addUpdateRange(offset, count); attr.needsUpdate = true;
}
function setPointVisual(index: number, semantic: number) {
  if (!data) return;
  const before = data.semantic[index]; data.semantic[index] = semantic & 255;
  const after = semantic & 255;
  if (before !== after) {
    if (labelCounts[before] > 0) labelCounts[before]--;
    labelCounts[after]++;
  }
  const [r, g, b] = colorForLabel(after);
  data.colors[index * 3] = r; data.colors[index * 3 + 1] = g; data.colors[index * 3 + 2] = b;
  if (interactivePaintBatch) {
    interactivePaintMin = Math.min(interactivePaintMin, index * 3);
    interactivePaintMax = Math.max(interactivePaintMax, index * 3 + 3);
  } else markRange(data.colorAttr, index * 3, 3);
  if (isGroundSemantic(before) || isGroundSemantic(semantic)) groundDirty = true;
}
function recordChange(index: number, after: number): boolean {
  if (!data) return false;
  if (!pointInAnnotationScope(index)) return false;
  if (workspacePoly && !pointInPolyNum(data.positions[index * 3], data.positions[index * 3 + 1], workspacePoly)) return false;
  const before = data.semantic[index];
  if (!overwrite && before !== 255 && before !== (after & 255)) return false;
  if (before === (after & 255)) return false;
  const frameIndex = data.frameIndex[index], pointIndex = data.pointIndex[index];
  if (stroke) {
    const key = `${frameIndex}:${pointIndex}`;
    if (!stroke.has(key)) stroke.set(key, { index, frameIndex, pointIndex, before, after: after & 255 });
  }
  setPointVisual(index, after); addEdit(frameIndex, pointIndex, after & 255); return true;
}
function beginStroke() { stroke = new Map(); }
function endStroke() {
  if (stroke && stroke.size > 0) { undoStack.push({ changes: [...stroke.values()] }); redoStack.length = 0; setDirty(); updateUndoRedo(); }
  stroke = null;
  refreshLabelStatsUI(); updateFrameTicks();
  if (groundMode !== 'all' && groundDirty) recomputeVisibility();
}
function applyCommand(command: Command, useAfter: boolean) {
  for (const change of command.changes) {
    if (!data || change.index < 0 || change.index >= data.pointCount) continue;
    const value = useAfter ? change.after : change.before;
    setPointVisual(change.index, value); addEdit(change.frameIndex, change.pointIndex, value);
  }
  setDirty(); refreshLabelStatsUI(); updateFrameTicks(); if (groundMode !== 'all') recomputeVisibility();
}
function undo() { const command = undoStack.pop(); if (!command) return; applyCommand(command, false); redoStack.push(command); updateUndoRedo(); }
function redo() { const command = redoStack.pop(); if (!command) return; applyCommand(command, true); undoStack.push(command); updateUndoRedo(); }

async function saveEdits(frameFilter: number | null = null): Promise<boolean> {
  const targets = [...edits.keys()].filter((frameIndex) => frameFilter === null || frameIndex === frameFilter);
  if (targets.length === 0) { updateSaveButtons(); return true; }
  if (!currentDatasetId) return false;
  const dirty = document.getElementById('dirty')!; dirty.textContent = frameFilter === null ? tr('status.saving') : tr('status.savingFrame');
  try {
    for (const frameIndex of targets) {
      const map = edits.get(frameIndex);
      if (!map || map.size === 0) { edits.delete(frameIndex); continue; }
      const frame = frameInfos.find((f) => f.frameIndex === frameIndex);
      if (!frame) throw new Error(language === 'zh' ? `找不到第 ${frameIndex} 帧的清单信息` : `Frame ${frameIndex} is missing from the manifest`);
      const body = { pointCount: frame.pointCount, edits: [...map.entries()].map(([pointIndex, semantic]) => ({ pointIndex, semantic })) };
      const response = await fetch(`/api/datasets/${encodeURIComponent(currentDatasetId)}/labels/${encodeURIComponent(frame.frameId)}/patch`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(language === 'zh' ? `标签写回失败：${frame.frameId}（${response.status}）` : `Failed to write labels for ${frame.frameId} (${response.status})`);
      modifiedFrames.add(frameIndex);
      edits.delete(frameIndex);
    }
    setDirty(); refreshLabelStatsUI(); updateFrameTicks(); dirty.textContent = edits.size === 0
      ? tr('status.saved')
      : language === 'zh' ? `${edits.size} 帧待保存` : `${edits.size} frame${edits.size === 1 ? '' : 's'} pending`; return true;
  } catch (e) {
    console.warn('save labels failed', e); dirty.textContent = tr('status.saveFailed'); updateSaveButtons(); updateFrameTicks(); return false;
  }
}
async function exportLabels(frameOnly: boolean) {
  if (!currentDatasetId || frameInfos.length === 0) return;
  const saved = await saveEdits(frameOnly ? activeFrame : null);
  if (!saved) return;
  const label = frameOnly ? (language === 'zh' ? '当前帧' : 'current frame') : (language === 'zh' ? '当前 Clip 包' : 'current Clip');
  try {
    const endpoint = frameOnly
      ? `/api/datasets/${encodeURIComponent(currentDatasetId)}/labels/${encodeURIComponent(frameInfos[activeFrame].frameId)}?download=1`
      : `/api/datasets/${encodeURIComponent(currentDatasetId)}/labels/export`;
    const response = await fetch(endpoint);
    if (!response.ok) throw new Error(language === 'zh' ? `导出失败（${response.status}）` : `Export failed (${response.status})`);
    const blob = await response.blob();
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = href;
    link.download = frameOnly ? `${frameInfos[activeFrame].frameId}.label` : `${currentDatasetId}_labels.plwlabels`;
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(href);
    hoverEl.textContent = interpolate(tr('status.exported'), { label });
  } catch (error) {
    hoverEl.textContent = interpolate(tr('status.exportFailed'), { label, error: String(error) });
  }
}
async function confirmBeforeReplace(): Promise<boolean> {
  if (edits.size === 0) return true;
  const choice = await askUnsavedAction();
  if (choice === 'cancel') return false;
  if (choice === 'save') return await saveEdits();
  edits.clear(); setDirty(); return true;
}

function frameWindowEnd(start = windowStart): number { return Math.min(frameInfos.length - 1, start + windowSize - 1); }
function maxWindowStart(): number { return Math.max(0, frameInfos.length - windowSize); }
function estimatedWindowPoints(start = windowStart): number {
  if (framePrefix.length === 0 || frameInfos.length === 0) return 0;
  const safeStart = Math.max(0, Math.min(frameInfos.length - 1, start));
  const end = frameWindowEnd(safeStart);
  return framePrefix[end + 1] - framePrefix[safeStart];
}
let renderedTickCount = -1;
function renderFrameTicks() {
  const ticks = document.getElementById('frame-ticks');
  if (!ticks) return;
  if (renderedTickCount === frameInfos.length) return;
  ticks.replaceChildren();
  const band = document.createElement('div'); band.id = 'window-band';
  const cursor = document.createElement('div'); cursor.id = 'frame-cursor';
  ticks.append(band, cursor);
  const fragment = document.createDocumentFragment();
  frameInfos.forEach((frame, index) => {
    const tick = document.createElement('button');
    tick.type = 'button'; tick.className = 'frame-tick'; tick.dataset.frame = String(index);
    tick.title = language === 'zh'
      ? `第 ${index + 1} 帧：${frame.frameId} · ${frame.pointCount.toLocaleString()} 点`
      : `Frame ${index + 1}: ${frame.frameId} · ${frame.pointCount.toLocaleString()} points`;
    tick.onclick = () => setActiveFrame(index);
    fragment.appendChild(tick);
  });
  ticks.appendChild(fragment); renderedTickCount = frameInfos.length;
}
function updateFrameTicks() {
  renderFrameTicks();
  const ticks = document.getElementById('frame-ticks');
  if (!ticks) return;
  const band = document.getElementById('window-band');
  const cursor = document.getElementById('frame-cursor');
  if (frameInfos.length > 0) {
    const end = frameWindowEnd();
    if (band) { band.hidden = false; band.style.left = `${(windowStart / frameInfos.length) * 100}%`; band.style.width = `${((end - windowStart + 1) / frameInfos.length) * 100}%`; }
    if (cursor) { cursor.hidden = false; cursor.style.left = `${((activeFrame + 0.5) / frameInfos.length) * 100}%`; }
  } else {
    if (band) band.hidden = true;
    if (cursor) cursor.hidden = true;
  }
  ticks.querySelectorAll<HTMLElement>('.frame-tick').forEach((tick) => {
    const index = Number(tick.dataset.frame);
    tick.classList.toggle('active', index === activeFrame);
    tick.classList.toggle('in-window', index >= windowStart && index <= frameWindowEnd());
    const pending = edits.has(index);
    const modified = modifiedFrames.has(index);
    tick.classList.toggle('dirty', pending);
    tick.classList.toggle('modified', !pending && modified);
    const workStatus = pending ? (language === 'zh' ? '待保存' : 'Pending save') : modified ? (language === 'zh' ? '已保存修改' : 'Saved changes') : (language === 'zh' ? '未修改' : 'Unmodified');
    tick.title = language === 'zh'
      ? `第 ${index + 1} 帧：${frameInfos[index]?.frameId ?? index} · ${frameInfos[index]?.pointCount.toLocaleString() ?? 0} 点 · ${workStatus}`
      : `Frame ${index + 1}: ${frameInfos[index]?.frameId ?? index} · ${frameInfos[index]?.pointCount.toLocaleString() ?? 0} points · ${workStatus}`;
  });
}
function updateTimeline() {
  const slider = document.getElementById('window-start') as HTMLInputElement;
  const end = frameWindowEnd(); const max = maxWindowStart();
  slider.max = String(max); slider.value = String(Math.min(max, windowStart)); slider.disabled = frameInfos.length <= windowSize;
  const sizeEl = document.getElementById('window-size') as HTMLInputElement | null;
  if (sizeEl) { sizeEl.max = String(Math.max(1, frameInfos.length)); sizeEl.value = String(effectiveWindowSize()); sizeEl.disabled = frameInfos.length <= 1; }
  const sizeValue = document.getElementById('window-size-v');
  if (sizeValue) sizeValue.textContent = String(effectiveWindowSize());
  const startInfo = frameInfos[windowStart], endInfo = frameInfos[end], current = frameInfos[activeFrame];
  document.getElementById('window-label')!.textContent = frameInfos.length
    ? language === 'zh'
      ? `窗口 ${windowStart}..${end} · ${end - windowStart + 1} 帧 / ${frameInfos.length - 1}`
      : `Window ${windowStart}..${end} · ${end - windowStart + 1} frames / ${frameInfos.length - 1}`
    : tr('window.none');
  document.getElementById('current-frame')!.textContent = current
    ? language === 'zh' ? `第 ${activeFrame + 1}/${frameInfos.length} 帧 · ${current.frameId}` : `Frame ${activeFrame + 1}/${frameInfos.length} · ${current.frameId}`
    : tr('frame.current');
  const frameInput = document.getElementById('frame-input') as HTMLInputElement | null;
  if (frameInput) { frameInput.value = current ? String(activeFrame + 1) : '1'; frameInput.max = String(Math.max(1, frameInfos.length)); frameInput.disabled = frameInfos.length === 0; }
  const previous = document.getElementById('frame-prev') as HTMLButtonElement | null;
  const next = document.getElementById('frame-next') as HTMLButtonElement | null;
  if (previous) previous.disabled = activeFrame <= 0 || frameInfos.length === 0;
  if (next) next.disabled = activeFrame >= frameInfos.length - 1 || frameInfos.length === 0;
  const frameTotal = document.getElementById('frame-total');
  if (frameTotal) frameTotal.textContent = String(frameInfos.length || '—');
  const scope = document.getElementById('scope-label');
  if (scope) scope.textContent = annotationScope === 'window'
    ? language === 'zh' ? `${effectiveWindowSize()} 帧窗口范围` : `${effectiveWindowSize()}-frame window scope`
    : language === 'zh' ? '当前帧范围' : 'Current-frame scope';
  const estimate = estimatedWindowPoints();
  windowStatsEl.textContent = data
    ? language === 'zh'
      ? `窗口 ${startInfo?.frameId ?? windowStart}…${endInfo?.frameId ?? end} · ${data.pointCount.toLocaleString()} 个完整点 · 预计 ${estimate.toLocaleString()}`
      : `Window ${startInfo?.frameId ?? windowStart}…${endInfo?.frameId ?? end} · ${data.pointCount.toLocaleString()} points · estimated ${estimate.toLocaleString()}`
    : frameInfos.length
      ? language === 'zh' ? `窗口预计 ${estimatedWindowPoints().toLocaleString()} 个点 · 服务端暂不限制` : `Estimated window: ${estimatedWindowPoints().toLocaleString()} points · server limit not applied`
      : tr('window.none');
  updateFrameTicks();
  updateOperationStatus(); updateSaveButtons();
}
let loadSerial = 0;
async function loadWindowInternal(start: number) {
  if (frameInfos.length === 0) return;
  start = Math.max(0, Math.min(maxWindowStart(), Math.floor(start)));
  const end = frameWindowEnd(start); const serial = ++loadSerial;
  statsEl.textContent = interpolate(tr('status.windowLoading'), { start, end });
  const loading = document.getElementById('load-indicator');
  if (loading) loading.hidden = false;
  try {
    const packet = await loadFrameWindow(currentDatasetId, start, end);
    if (serial !== loadSerial) return;
    clearSelectionPreview(); installPacket(packet);
    windowStart = packet.startFrame;
    const requested = requestedActiveFrame;
    activeFrame = requested === null ? Math.max(windowStart, Math.min(packet.endFrame, activeFrame)) : Math.max(windowStart, Math.min(packet.endFrame, requested));
    requestedActiveFrame = null;
    updateFrameView(); recomputeVisibility(); updateTimeline();
    statsEl.textContent = language === 'zh'
      ? `${currentDatasetId}：${packet.pointCount.toLocaleString()} 个完整点 · 第 ${start}..${end} 帧`
      : `${currentDatasetId}: ${packet.pointCount.toLocaleString()} points · frames ${start}..${end}`;
  } finally {
    if (loading) loading.hidden = true;
  }
}
async function requestWindow(start: number, force = false) {
  queuedWindowStart = Math.max(0, Math.min(maxWindowStart(), Math.floor(start)));
  queuedWindowForce = queuedWindowForce || force;
  if (windowChanging) return;
  windowChanging = true;
  try {
    while (queuedWindowStart !== null) {
      const next = queuedWindowStart; queuedWindowStart = null;
      const forceLoad = queuedWindowForce; queuedWindowForce = false;
      if (next === windowStart && data && !forceLoad) { updateTimeline(); continue; }
      if (!(await confirmBeforeReplace())) {
        if (pendingWindowSizeRestore !== null) windowSize = pendingWindowSizeRestore;
        pendingWindowSizeRestore = null;
        queuedWindowStart = null; queuedWindowForce = false; updateTimeline(); break;
      }
      undoStack.length = 0; redoStack.length = 0; updateUndoRedo();
      await loadWindowInternal(next);
      pendingWindowSizeRestore = null;
    }
  } catch (e) {
    if (pendingWindowSizeRestore !== null) windowSize = pendingWindowSizeRestore;
    pendingWindowSizeRestore = null;
    console.warn('frame window load failed', e); statsEl.textContent = interpolate(tr('status.windowLoadFailed'), { error: String(e) }); updateTimeline();
  } finally { windowChanging = false; }
}
function setWindowSize(raw: number) {
  if (frameInfos.length === 0 || !Number.isFinite(raw)) return;
  const next = Math.max(1, Math.min(frameInfos.length, Math.floor(raw)));
  if (next === windowSize) { updateTimeline(); return; }
  if (pendingWindowSizeRestore === null) pendingWindowSizeRestore = windowSize;
  windowSize = next;
  requestedActiveFrame = activeFrame;
  const start = Math.max(0, Math.min(maxWindowStart(), activeFrame - Math.floor(windowSize / 2)));
  void requestWindow(start, true);
}
function setFrameFromInput() {
  const input = document.getElementById('frame-input') as HTMLInputElement | null;
  if (!input) return;
  const value = Number(input.value);
  if (Number.isFinite(value)) setActiveFrame(value - 1);
  updateTimeline();
}
function setActiveFrame(index: number) {
  if (frameInfos.length === 0) return;
  index = Math.max(0, Math.min(frameInfos.length - 1, Math.floor(index)));
  const end = frameWindowEnd();
  if (index >= windowStart && index <= end) { activeFrame = index; updateFrameView(); updateTimeline(); return; }
  if (!(document.getElementById('auto-load') as HTMLInputElement).checked) return;
  requestedActiveFrame = index; void requestWindow(Math.max(0, Math.min(maxWindowStart(), index - Math.floor(windowSize / 2))));
}
let playTimer = 0;
let playSpeed = 1;
function stopPlayback() {
  if (playTimer) { clearInterval(playTimer); playTimer = 0; }
  const button = document.getElementById('frame-play');
  if (button) button.textContent = tr('play');
}
function startPlayback() {
  if (frameInfos.length < 2) return;
  const button = document.getElementById('frame-play');
  if (button) button.textContent = tr('stop');
  playTimer = window.setInterval(() => {
    if (windowChanging) return;
    if (activeFrame >= frameInfos.length - 1) { stopPlayback(); return; }
    setActiveFrame(activeFrame + 1);
  }, Math.max(80, Math.round(350 / playSpeed)));
}
function togglePlay() {
  if (playTimer) stopPlayback(); else startPlayback();
}
function setPlaybackSpeed(value: number) {
  if (!Number.isFinite(value) || value <= 0) return;
  const wasPlaying = playTimer !== 0;
  if (wasPlaying) stopPlayback();
  playSpeed = value;
  if (wasPlaying) startPlayback();
}
function fitData() {
  if (!data || data.pointCount === 0) return;
  if (isOrthoMode(viewMode)) { fitOrthoView(viewMode); screenIndexDirty = true; schedulePolylinePreview(); drawOverlay(); return; }
  const min = new THREE.Vector3(Infinity, Infinity, Infinity), max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
  for (let i = 0; i < data.pointCount; i++) {
    min.x = Math.min(min.x, data.positions[i * 3]); max.x = Math.max(max.x, data.positions[i * 3]);
    min.y = Math.min(min.y, data.positions[i * 3 + 1]); max.y = Math.max(max.y, data.positions[i * 3 + 1]);
    min.z = Math.min(min.z, data.positions[i * 3 + 2]); max.z = Math.max(max.z, data.positions[i * 3 + 2]);
  }
  const center = min.clone().add(max).multiplyScalar(0.5);
  const radius = Math.max(max.x - min.x, max.y - min.y, max.z - min.z) * 0.7 || 50;
  controls.target.copy(center); camera.position.set(center.x + radius * 0.7, center.y - radius * 0.4, center.z + radius * 0.7);
  camera.lookAt(center); camera.updateMatrixWorld(true);
  if (viewMode === 'fly') {
    flyPanRadius = Math.max(10, radius * 1.5);
    flyBaseSpeed = Math.max(3, flyPanRadius * 0.35);
    syncFlyTarget();
  }
  camera.far = Math.max(5000, radius * 40); camera.updateProjectionMatrix(); screenIndexDirty = true;
}
async function loadDataset(id: string) {
  if (!id || id === currentDatasetId) return;
  if (!(await confirmBeforeReplace())) {
    if (currentDatasetId) syncDatasetSelection(currentDatasetId);
    return;
  }
  const previousSixClassSchema = usesSixClassLabels();
  currentDatasetId = id;
  syncDatasetSelection(id);
  void refreshClipVideo(id);
  if (previousSixClassSchema !== usesSixClassLabels()) activeLabel = 255;
  data = null; frameInfos = []; framePrefix = []; renderedTickCount = -1; windowStart = 0; activeFrame = 0;
  clearSelectionPreview(); edits.clear(); modifiedFrames.clear(); undoStack.length = 0; redoStack.length = 0; setDirty(); updateUndoRedo();
  try {
    frameInfos = await loadFrameManifest(id);
    if (frameInfos.length === 0) throw new Error(language === 'zh' ? 'Clip 包没有帧' : 'The Clip contains no frames');
    framePrefix = [0];
    for (const frame of frameInfos) framePrefix.push(framePrefix[framePrefix.length - 1] + frame.pointCount);
    await loadWindowInternal(0); fitData(); await loadWorkspace(); updateTimeline();
  } catch (e) { statsEl.textContent = interpolate(tr('status.loadFailed'), { error: String(e) }); }
}

async function refreshClipVideo(datasetId: string) {
  const button = document.getElementById('open-video') as HTMLButtonElement | null;
  const status = document.getElementById('video-status');
  clipVideoInfo = null;
  if (button) {
    button.disabled = true;
    button.title = language === 'zh' ? '使用 Windows 系统默认播放器打开当前 Clip 的视频' : 'Open the current Clip video with the Windows default player';
  }
  if (status) status.textContent = datasetId ? tr('status.videoLooking') : tr('status.videoUndetected');
  if (!datasetId) return;
  try {
    const response = await fetch(`/api/datasets/${encodeURIComponent(datasetId)}/video-info`);
    if (!response.ok) {
      if (currentDatasetId !== datasetId) return;
      if (status) status.textContent = response.status === 404 ? tr('status.videoNotFound') : (language === 'zh' ? `检查失败（${response.status}）` : `Check failed (${response.status})`);
      return;
    }
    const info = await response.json() as ClipVideoInfo;
    if (currentDatasetId !== datasetId || !info.url || !info.name) return;
    clipVideoInfo = info;
    if (button) {
      button.disabled = false;
      button.title = language === 'zh' ? `使用 Windows 系统默认播放器打开：${info.name}` : `Open with the Windows default player: ${info.name}`;
    }
    if (status) {
      status.textContent = interpolate(tr('status.videoFound'), { name: info.name });
      status.title = info.name;
    }
  } catch (error) {
    if (currentDatasetId !== datasetId) return;
    if (status) status.textContent = tr('status.videoCheckFailed');
    console.warn('clip video lookup failed', error);
  }
}

async function openClipVideo() {
  if (!clipVideoInfo || !currentDatasetId) return;
  const datasetId = currentDatasetId;
  const videoName = clipVideoInfo.name;
  const button = document.getElementById('open-video') as HTMLButtonElement | null;
  if (button) button.disabled = true;
  try {
    const response = await fetch(`/api/datasets/${encodeURIComponent(datasetId)}/video/open`, { method: 'POST' });
    const payload = await response.json().catch(() => ({})) as { error?: string };
    if (!response.ok) throw new Error(payload.error || (language === 'zh' ? `系统播放器打开失败（${response.status}）` : `System player failed (${response.status})`));
    if (currentDatasetId === datasetId) hoverEl.textContent = interpolate(tr('status.videoOpened'), { name: videoName });
  } catch (error) {
    if (currentDatasetId === datasetId) hoverEl.textContent = interpolate(tr('status.videoOpenFailed'), { error: String(error) });
  } finally {
    if (currentDatasetId === datasetId && button) button.disabled = false;
  }
}

// --- screen-space index and segmentation tools --------------------------------
const SCREEN_CELL = 24;
let screenX: Float32Array | null = null, screenY: Float32Array | null = null;
let screenBuckets: number[][] = [], screenCols = 0, screenRows = 0, screenIndexDirty = true;
function buildScreenIndex() {
  if (!data) return;
  const rect = renderer.domElement.getBoundingClientRect();
  screenCols = Math.max(1, Math.ceil(rect.width / SCREEN_CELL)); screenRows = Math.max(1, Math.ceil(rect.height / SCREEN_CELL));
  screenBuckets = Array.from({ length: screenCols * screenRows }, () => [] as number[]);
  screenX = new Float32Array(data.pointCount); screenY = new Float32Array(data.pointCount);
  const cam = activeCamera(); cam.updateMatrixWorld(true); const projected = new THREE.Vector3();
  for (let i = 0; i < data.pointCount; i++) {
    if (data.visible[i] < 0.5 || !isPointDisplayed(i)) continue;
    projected.set(data.positions[i * 3], data.positions[i * 3 + 1], data.positions[i * 3 + 2]).project(cam);
    if (projected.z < -1 || projected.z > 1 || projected.x < -1.05 || projected.x > 1.05 || projected.y < -1.05 || projected.y > 1.05) continue;
    const x = rect.left + (projected.x * 0.5 + 0.5) * rect.width;
    const y = rect.top + (-projected.y * 0.5 + 0.5) * rect.height;
    screenX[i] = x; screenY[i] = y;
    const cx = Math.max(0, Math.min(screenCols - 1, Math.floor((x - rect.left) / SCREEN_CELL)));
    const cy = Math.max(0, Math.min(screenRows - 1, Math.floor((y - rect.top) / SCREEN_CELL)));
    screenBuckets[cy * screenCols + cx].push(i);
  }
  screenIndexDirty = false;
}
function candidatePoints(minX: number, minY: number, maxX: number, maxY: number): number[] {
  if (!data) return [];
  if (screenIndexDirty) buildScreenIndex();
  const rect = renderer.domElement.getBoundingClientRect();
  const x0 = Math.max(0, Math.floor((minX - rect.left) / SCREEN_CELL));
  const y0 = Math.max(0, Math.floor((minY - rect.top) / SCREEN_CELL));
  const x1 = Math.min(screenCols - 1, Math.floor((maxX - rect.left) / SCREEN_CELL));
  const y1 = Math.min(screenRows - 1, Math.floor((maxY - rect.top) / SCREEN_CELL));
  const result: number[] = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    for (const index of screenBuckets[y * screenCols + x]) result.push(index);
  }
  return result;
}
let polyVerts: { x: number; y: number }[] = [];
let selectionPath: { x: number; y: number }[] = [];
let selectionStart: { x: number; y: number } | null = null;
let selectionDragging = false;
let selectionPreviewHits: number[] = [];
let polygonVertexDragging = -1;
let suppressPolygonClick = false;
type WorldPoint3 = { x: number; y: number; z: number };
let polylineVerts: WorldPoint3[] = [];
let polylineVertexDragging = -1;
function pointInPoly(x: number, y: number, vertices: { x: number; y: number }[]): boolean {
  let inside = false;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    if (((vertices[i].y > y) !== (vertices[j].y > y)) &&
        x < ((vertices[j].x - vertices[i].x) * (y - vertices[i].y)) / (vertices[j].y - vertices[i].y) + vertices[i].x) inside = !inside;
  }
  return inside;
}
function clearSelectionPreview() {
  if (data) for (const i of selectionPreviewHits) data.selected[i] = 0;
  if (data && selectionPreviewHits.length) data.selectedAttr.needsUpdate = true;
  selectionPreviewHits = []; selectionPath = []; selectionStart = null; selectionDragging = false;
  const button = document.getElementById('selection-apply') as HTMLButtonElement | null; if (button) button.disabled = true;
  polylineVerts = []; polylineVertexDragging = -1;
  const polylineButton = document.getElementById('polyline-apply') as HTMLButtonElement | null; if (polylineButton) polylineButton.disabled = true;
  updateSelectionStats(); updateOperationStatus();
}
function updateSelectionPreview() {
  if (!data) return;
  if (selectionPreviewHits.length) for (const i of selectionPreviewHits) data.selected[i] = 0;
  selectionPreviewHits = [];
  if (selectionPath.length < 3) { data.selectedAttr.needsUpdate = true; return; }
  const xs = selectionPath.map((p) => p.x), ys = selectionPath.map((p) => p.y);
  const candidates = candidatePoints(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
  const seen = new Set<number>();
  for (const i of candidates) {
    if (seen.has(i) || !pointInAnnotationScope(i) || data.visible[i] < 0.5 || !screenX || !screenY) continue;
    seen.add(i);
    if (pointInPoly(screenX[i], screenY[i], selectionPath)) { data.selected[i] = 1; selectionPreviewHits.push(i); }
  }
  data.selectedAttr.needsUpdate = true;
  (document.getElementById('selection-apply') as HTMLButtonElement).disabled = selectionPreviewHits.length === 0;
  hoverEl.textContent = interpolate(tr('status.selectionPreview'), { count: selectionPreviewHits.length.toLocaleString() });
  updateSelectionStats(); updateOperationStatus();
}
function applySelection() {
  if (selectionPreviewHits.length === 0) return;
  const count = selectionPreviewHits.length; beginStroke();
  for (const i of selectionPreviewHits) recordChange(i, eraseMode ? 255 : activeLabel);
  endStroke(); clearSelectionPreview(); drawOverlay(); hoverEl.textContent = interpolate(tr('status.selectionApplied'), { count: count.toLocaleString() });
}
function applyPolygon() {
  if (!data || polyVerts.length < 3) return;
  if (screenIndexDirty) buildScreenIndex();
  const xs = polyVerts.map((p) => p.x), ys = polyVerts.map((p) => p.y);
  const candidates = candidatePoints(Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys));
  beginStroke(); const seen = new Set<number>();
  for (const i of candidates) if (!seen.has(i) && screenX && screenY && pointInPoly(screenX[i], screenY[i], polyVerts)) { seen.add(i); recordChange(i, eraseMode ? 255 : activeLabel); }
  endStroke(); polyVerts = []; drawOverlay(); (document.getElementById('poly-apply') as HTMLButtonElement).disabled = true;
}
function brushRadiusValue(): number {
  const value = Number((document.getElementById('brush-radius') as HTMLInputElement | null)?.value ?? DEFAULT_BRUSH_RADIUS);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_BRUSH_RADIUS;
}
function brushRadiusWorld(): number {
  return brushRadiusValue() / 100;
}
function heightFilterValue(): number {
  const value = Number((document.getElementById('height-filter') as HTMLInputElement | null)?.value ?? DEFAULT_HEIGHT_FILTER);
  return Number.isFinite(value) && value > 0 ? value : DEFAULT_HEIGHT_FILTER;
}
function heightFilterWorld(): number {
  return heightFilterValue() / 100;
}
function projectWorldToClient(x: number, y: number, z = 0): { x: number; y: number } | null {
  const rect = renderer.domElement.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  const camera = activeCamera(); camera.updateMatrixWorld(true);
  const projected = new THREE.Vector3(x, y, z).project(camera);
  if (!Number.isFinite(projected.x) || !Number.isFinite(projected.y)) return null;
  return {
    x: rect.left + (projected.x * 0.5 + 0.5) * rect.width,
    y: rect.top + (-projected.y * 0.5 + 0.5) * rect.height,
  };
}
function screenBoundsForWorldBox(minX: number, minY: number, maxX: number, maxY: number): [number, number, number, number] {
  const corners = [
    projectWorldToClient(minX, minY), projectWorldToClient(minX, maxY),
    projectWorldToClient(maxX, minY), projectWorldToClient(maxX, maxY),
  ].filter((p): p is { x: number; y: number } => p !== null);
  if (corners.length === 0) return [0, 0, 0, 0];
  return [
    Math.min(...corners.map((p) => p.x)), Math.min(...corners.map((p) => p.y)),
    Math.max(...corners.map((p) => p.x)), Math.max(...corners.map((p) => p.y)),
  ];
}
function screenBoundsForWorldPoints(points: WorldPoint3[], padding: number): [number, number, number, number] {
  if (points.length === 0) return [0, 0, 0, 0];
  const minX = Math.min(...points.map((p) => p.x)) - padding;
  const minY = Math.min(...points.map((p) => p.y)) - padding;
  const minZ = Math.min(...points.map((p) => p.z)) - padding;
  const maxX = Math.max(...points.map((p) => p.x)) + padding;
  const maxY = Math.max(...points.map((p) => p.y)) + padding;
  const maxZ = Math.max(...points.map((p) => p.z)) + padding;
  const corners: { x: number; y: number }[] = [];
  for (const x of [minX, maxX]) for (const y of [minY, maxY]) for (const z of [minZ, maxZ]) {
    const point = projectWorldToClient(x, y, z);
    if (point) corners.push(point);
  }
  if (corners.length === 0) return [0, 0, 0, 0];
  return [
    Math.min(...corners.map((p) => p.x)), Math.min(...corners.map((p) => p.y)),
    Math.max(...corners.map((p) => p.x)), Math.max(...corners.map((p) => p.y)),
  ];
}
function worldPointAtScreen(clientX: number, clientY: number): WorldPoint3 | null {
  if (data) {
    if (screenIndexDirty) buildScreenIndex();
    const candidates = candidatePoints(clientX - 12, clientY - 12, clientX + 12, clientY + 12);
    let best = -1, bestDistance = 144;
    for (const i of candidates) {
      if (!screenX || !screenY) continue;
      const dx = screenX[i] - clientX, dy = screenY[i] - clientY;
      const distance = dx * dx + dy * dy;
      if (distance < bestDistance) { bestDistance = distance; best = i; }
    }
    if (best >= 0) return {
      x: data.positions[best * 3], y: data.positions[best * 3 + 1], z: data.positions[best * 3 + 2],
    };
  }
  const hit = projectClickToGround(clientX, clientY);
  return hit ? { x: hit[0], y: hit[1], z: 0 } : null;
}
function pointToSegmentDistanceSq(x: number, y: number, z: number, a: WorldPoint3, b: WorldPoint3): number {
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  const lengthSq = dx * dx + dy * dy + dz * dz;
  const t = lengthSq > 0 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy + (z - a.z) * dz) / lengthSq)) : 0;
  const px = a.x + t * dx, py = a.y + t * dy, pz = a.z + t * dz;
  const ox = x - px, oy = y - py, oz = z - pz;
  return ox * ox + oy * oy + oz * oz;
}
function updatePolylinePreview() {
  if (!data) return;
  if (selectionPreviewHits.length) for (const i of selectionPreviewHits) data.selected[i] = 0;
  selectionPreviewHits = [];
  const button = document.getElementById('polyline-apply') as HTMLButtonElement | null;
  if (polylineVerts.length < 2) {
    if (button) button.disabled = true;
    data.selectedAttr.needsUpdate = true;
    updateSelectionStats(); updateOperationStatus();
    return;
  }
  if (screenIndexDirty) buildScreenIndex();
  const radius = brushRadiusWorld();
  const heightTolerance = heightFilterWorld();
  const [minScreenX, minScreenY, maxScreenX, maxScreenY] = screenBoundsForWorldPoints(polylineVerts, Math.max(radius, heightTolerance));
  const candidates = candidatePoints(minScreenX, minScreenY, maxScreenX, maxScreenY);
  const radiusSq = radius * radius;
  const heightToleranceSq = heightTolerance * heightTolerance;
  const seen = new Set<number>();
  for (const i of candidates) {
    if (seen.has(i) || !pointInAnnotationScope(i) || data.visible[i] < 0.5) continue;
    if (workspacePoly && !pointInPolyNum(data.positions[i * 3], data.positions[i * 3 + 1], workspacePoly)) continue;
    seen.add(i);
    let selected = false;
    for (let segment = 1; segment < polylineVerts.length; segment++) {
      const a = polylineVerts[segment - 1], b = polylineVerts[segment];
      const dx = b.x - a.x, dy = b.y - a.y;
      const lengthSq = dx * dx + dy * dy;
      const t = lengthSq > 0
        ? Math.max(0, Math.min(1, ((data.positions[i * 3] - a.x) * dx + (data.positions[i * 3 + 1] - a.y) * dy) / lengthSq))
        : 0;
      const px = a.x + t * dx, py = a.y + t * dy;
      const ox = data.positions[i * 3] - px, oy = data.positions[i * 3 + 1] - py;
      const lineZ = a.z + t * (b.z - a.z);
      const dz = data.positions[i * 3 + 2] - lineZ;
      if (ox * ox + oy * oy <= radiusSq && dz * dz <= heightToleranceSq) { selected = true; break; }
    }
    if (selected) { data.selected[i] = 1; selectionPreviewHits.push(i); }
  }
  data.selectedAttr.needsUpdate = true;
  if (button) button.disabled = selectionPreviewHits.length === 0;
  hoverEl.textContent = interpolate(tr('status.polylinePreview'), { count: selectionPreviewHits.length.toLocaleString() });
  updateSelectionStats(); updateOperationStatus();
}
let polylinePreviewFrame = 0;
function schedulePolylinePreview() {
  if (polylinePreviewFrame || tool !== 'polyline' || polylineVerts.length < 2) return;
  polylinePreviewFrame = requestAnimationFrame(() => {
    polylinePreviewFrame = 0;
    updatePolylinePreview();
    drawOverlay();
  });
}
function applyPolyline() {
  if (!data || polylineVerts.length < 2) return;
  updatePolylinePreview();
  if (selectionPreviewHits.length === 0) return;
  const count = selectionPreviewHits.length;
  beginStroke();
  for (const i of selectionPreviewHits) recordChange(i, eraseMode ? 255 : activeLabel);
  endStroke(); clearSelectionPreview(); polylineVerts = [];
  const button = document.getElementById('polyline-apply') as HTMLButtonElement | null;
  if (button) button.disabled = true;
  drawOverlay(); hoverEl.textContent = interpolate(tr('status.polylineApplied'), { count: count.toLocaleString() });
}
function paintAt(clientX: number, clientY: number) {
  if (!data) return;
  const center = worldPointAtScreen(clientX, clientY);
  if (!center) return;
  const radius = brushRadiusWorld();
  const [minScreenX, minScreenY, maxScreenX, maxScreenY] = screenBoundsForWorldPoints([center], radius);
  const candidates = candidatePoints(minScreenX, minScreenY, maxScreenX, maxScreenY);
  const radiusSq = radius * radius;
  interactivePaintBatch = true;
  interactivePaintMin = Number.POSITIVE_INFINITY;
  interactivePaintMax = -1;
  for (const i of candidates) {
    const dx = data.positions[i * 3] - center.x;
    const dy = data.positions[i * 3 + 1] - center.y;
    if (dx * dx + dy * dy <= radiusSq) recordChange(i, eraseMode ? 255 : activeLabel);
  }
  interactivePaintBatch = false;
  if (interactivePaintMax > interactivePaintMin) markRange(data.colorAttr, interactivePaintMin, interactivePaintMax - interactivePaintMin);
}

const overlay = document.getElementById('overlay') as HTMLCanvasElement;
const octx = overlay.getContext('2d')!;
function resizeOverlay() {
  const rect = overlay.getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio, 2);
  overlay.width = Math.max(1, Math.round(rect.width * dpr));
  overlay.height = Math.max(1, Math.round(rect.height * dpr));
  octx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function drawOverlay() {
  const canvasWidth = overlay.clientWidth || innerWidth;
  const canvasHeight = overlay.clientHeight || innerHeight;
  octx.clearRect(0, 0, canvasWidth, canvasHeight);
  const rect = renderer.domElement.getBoundingClientRect();
  const overlayRect = overlay.getBoundingClientRect();
  const toCanvas = (p: { x: number; y: number }) => ({ x: p.x - overlayRect.left, y: p.y - overlayRect.top });
  const projectWorld = (p: [number, number]): [number, number] => {
    const projected = projectWorldToClient(p[0], p[1]);
    return projected ? [projected.x, projected.y] : [Number.NaN, Number.NaN];
  };
  const drawPath = (path: { x: number; y: number }[], color: string, close: boolean, fillColor?: string, dashed = true) => {
    if (path.length === 0) return;
    octx.strokeStyle = color; octx.lineWidth = 1.8; octx.lineJoin = 'round'; octx.lineCap = 'round'; octx.setLineDash(dashed ? [7, 4] : []); octx.beginPath();
    path.forEach((p, i) => (i === 0 ? octx.moveTo(p.x, p.y) : octx.lineTo(p.x, p.y)));
    if (close) octx.closePath();
    if (close && fillColor) { octx.fillStyle = fillColor; octx.fill(); }
    octx.stroke(); octx.setLineDash([]);
  };
  const cleanPath = (path: { x: number; y: number }[]) => {
    const result: { x: number; y: number }[] = [];
    for (const point of path) {
      const previous = result.at(-1);
      if (!previous || Math.hypot(point.x - previous.x, point.y - previous.y) > 0.5) result.push(point);
    }
    if (result.length > 2 && Math.hypot(result[0].x - result.at(-1)!.x, result[0].y - result.at(-1)!.y) <= 2) result.pop();
    return result;
  };
  const polygonPath = cleanPath(polyVerts.map(toCanvas));
  const polylinePath = cleanPath(polylineVerts
    .map((p) => projectWorldToClient(p.x, p.y, p.z))
    .filter((p): p is { x: number; y: number } => p !== null)
    .map(toCanvas));
  const selectionOutline = cleanPath(selectionPath.map(toCanvas));
  drawPath(polygonPath, '#fd9', polygonPath.length > 2, 'rgba(255, 221, 153, 0.18)', false);
  drawPath(polylinePath, '#ffb347', false, undefined, false);
  drawPath(selectionOutline, '#ffbe3c', selectionOutline.length > 2);
  if (workspaceVerts.length) {
    const path = workspaceVerts.map(projectWorld);
    drawPath(path.map((p) => toCanvas({ x: p[0], y: p[1] })), '#66ddff', path.length > 2);
    octx.fillStyle = '#66ddff'; for (const p of path.map((point) => toCanvas({ x: point[0], y: point[1] }))) { octx.beginPath(); octx.arc(p.x, p.y, 3, 0, Math.PI * 2); octx.fill(); }
  }
  if (polyVerts.length) {
    octx.fillStyle = '#fd9';
    polyVerts.map(toCanvas).forEach((p, i) => { octx.beginPath(); octx.arc(p.x, p.y, i === polygonVertexDragging ? 6 : 3, 0, Math.PI * 2); octx.fill(); });
  }
  if (polylineVerts.length) {
    octx.fillStyle = '#ffb347'; octx.strokeStyle = '#fff3c4'; octx.lineWidth = 2;
    for (const p of polylineVerts
      .map((point) => projectWorldToClient(point.x, point.y, point.z))
      .filter((point): point is { x: number; y: number } => point !== null)
      .map(toCanvas)) {
      octx.beginPath(); octx.arc(p.x, p.y, 6, 0, Math.PI * 2); octx.fill(); octx.stroke();
    }
  }
}

// --- labels panel and controls -------------------------------------------------
let activeLabel = 255;
function selectLabel(id: number) {
  activeLabel = id & 255;
  buildLabelPanel();
}
function soloLabel(id: number) {
  hiddenClasses.clear();
  for (const other of labelIds()) if (other !== id) hiddenClasses.add(other);
  buildLabelPanel(); clearSelectionPreview(); recomputeVisibility();
}
function buildLabelPanel() {
  const panel = document.getElementById('labels')!; panel.innerHTML = '';
  const allIds = labelIds();
  const header = document.createElement('div'); header.className = 'label-hdr';
  const title = document.createElement('span'); title.className = 'lbl'; title.textContent = language === 'zh' ? `标签 ${allIds.length}` : `${allIds.length} labels`; header.appendChild(title);
  const button = (text: string, fn: () => void) => { const b = document.createElement('button'); b.className = 'mini'; b.textContent = text; b.onclick = fn; return b; };
  header.appendChild(button(tr('labels.all'), () => { hiddenClasses.clear(); buildLabelPanel(); clearSelectionPreview(); recomputeVisibility(); }));
  header.appendChild(button(tr('labels.none'), () => { allIds.forEach((id) => hiddenClasses.add(id)); buildLabelPanel(); clearSelectionPreview(); recomputeVisibility(); }));
  header.appendChild(button(tr('labels.invert'), () => { allIds.forEach((id) => hiddenClasses.has(id) ? hiddenClasses.delete(id) : hiddenClasses.add(id)); buildLabelPanel(); clearSelectionPreview(); recomputeVisibility(); }));
  panel.appendChild(header);
  for (const id of allIds) {
    const row = document.createElement('div'); row.className = 'label-row';
    const check = document.createElement('input'); check.type = 'checkbox'; check.checked = !hiddenClasses.has(id);
    check.title = `${tr('labels.showHide')} ${displayLabelName(id)}`;
    check.onchange = () => { check.checked ? hiddenClasses.delete(id) : hiddenClasses.add(id); clearSelectionPreview(); recomputeVisibility(); };
    const b = document.createElement('button'); b.className = 'lbl-btn';
    const rgb = colorForLabel(id).map((x) => Math.round(x * 255)).join(',');
    const swatch = document.createElement('span'); swatch.className = 'sw'; swatch.style.background = `rgb(${rgb})`;
    const text = document.createElement('span'); text.className = 'label-text'; text.textContent = `${id} · ${displayLabelName(id)}`;
    const count = document.createElement('span'); count.className = 'label-count'; count.textContent = (labelCounts[id] ?? 0).toLocaleString();
    b.append(swatch, text, count);
    const shortcut = labelShortcut(id);
    if (shortcut) { const badge = document.createElement('span'); badge.className = 'label-shortcut'; badge.textContent = shortcut; b.appendChild(badge); }
    b.title = shortcut ? `${displayLabelName(id)} · ${shortcut} ${tr('labels.select')}` : `${tr('labels.select')} ${displayLabelName(id)}`;
    if (id === activeLabel) b.classList.add('active');
    b.onclick = () => selectLabel(id);
    const solo = document.createElement('button'); solo.className = 'label-solo'; solo.textContent = tr('labels.only'); solo.title = `${tr('labels.onlyTitle')} ${displayLabelName(id)}`;
    solo.onclick = (event) => { event.stopPropagation(); soloLabel(id); };
    row.append(check, b, solo); panel.appendChild(row);
  }
  refreshLabelStatsUI();
}
function setTool(next: Tool) {
  tool = next; clearSelectionPreview(); polyVerts = []; workspaceVerts = []; polygonVertexDragging = -1; suppressPolygonClick = false;
  polylineVerts = []; polylineVertexDragging = -1; drawOverlay();
  (document.getElementById('poly-apply') as HTMLButtonElement).disabled = true;
  (document.getElementById('polyline-apply') as HTMLButtonElement).disabled = true;
  (document.getElementById('ws-apply') as HTMLButtonElement).disabled = true;
  controls.enabled = next === 'navigate' && viewMode === 'persp';
  controls.enableDamping = next === 'navigate' && viewMode === 'persp';
  if (next !== 'navigate') clearFlyInput();
  if (next === 'navigate') controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN };
  else controls.mouseButtons = { LEFT: -1 as unknown as THREE.MOUSE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: next === 'brush' ? THREE.MOUSE.ROTATE : -1 as unknown as THREE.MOUSE };
  for (const [id, value] of [['tool-nav', 'navigate'], ['tool-brush', 'brush'], ['tool-poly', 'polygon'], ['tool-rect', 'rect'], ['tool-lasso', 'lasso'], ['tool-polyline', 'polyline'], ['tool-ws', 'workspace']] as const) {
    document.getElementById(id)!.classList.toggle('active', next === value);
  }
  const names: Record<Tool, string> = {
    navigate: `${tr('tool.navigate')} · ${language === 'zh' ? '调整相机' : 'adjust camera'}`,
    brush: `${tr('tool.brush')} · ${language === 'zh' ? '标注点' : 'label points'}`,
    polygon: `${tr('tool.polygon')} · ${language === 'zh' ? '添加顶点' : 'add vertices'}`,
    polyline: `${tr('tool.polyline')} · ${language === 'zh' ? '添加路沿顶点' : 'add curb vertices'}`,
    rect: `${tr('tool.rect')} · ${language === 'zh' ? '拖动选区' : 'drag a region'}`,
    lasso: `${tr('tool.lasso')} · ${language === 'zh' ? '绘制选区' : 'draw a region'}`,
    workspace: `${tr('tool.workspace')} · ${language === 'zh' ? '定义 XY 区域' : 'define an XY region'}`,
  };
  const activeTool = document.getElementById('active-tool');
  if (activeTool) activeTool.textContent = names[next];
  updateOperationStatus();
}

renderer.domElement.addEventListener('pointerdown', (event) => {
  if (beginFlyDrag(event)) return;
  const selectionTool = tool === 'rect' || tool === 'lasso';
  if (event.button === 2) {
    event.preventDefault();
    if (selectionTool) { applySelection(); return; }
    if (tool === 'polygon') { applyPolygon(); return; }
    if (tool === 'polyline') { applyPolyline(); return; }
    if (tool === 'workspace' && viewMode === 'bev') { applyWorkspace(); return; }
    if (isOrthoView() && tool === 'navigate') { bevPanAnchor = [event.clientX, event.clientY]; bevPanning = true; }
    return;
  }
  if (event.button !== 0) return;
  if (isOrthoView() && tool === 'navigate') { bevPanAnchor = [event.clientX, event.clientY]; bevPanning = true; return; }
  if (selectionTool) {
    clearSelectionPreview(); selectionStart = { x: event.clientX, y: event.clientY }; selectionPath = [selectionStart]; selectionDragging = true;
    if (screenIndexDirty) buildScreenIndex(); drawOverlay(); return;
  }
  if (tool === 'polygon') {
    for (let i = 0; i < polyVerts.length; i++) {
      if (Math.hypot(polyVerts[i].x - event.clientX, polyVerts[i].y - event.clientY) <= 10) { polygonVertexDragging = i; suppressPolygonClick = true; return; }
    }
  }
  if (tool === 'polyline') {
    for (let i = 0; i < polylineVerts.length; i++) {
      const vertex = projectWorldToClient(polylineVerts[i].x, polylineVerts[i].y, polylineVerts[i].z);
      if (vertex && Math.hypot(vertex.x - event.clientX, vertex.y - event.clientY) <= 10) { polylineVertexDragging = i; return; }
    }
    const point = worldPointAtScreen(event.clientX, event.clientY);
    if (point) { polylineVerts.push(point); updatePolylinePreview(); drawOverlay(); }
    return;
  }
  if (tool === 'brush') {
    if (screenIndexDirty) buildScreenIndex(); beginStroke(); paintAt(event.clientX, event.clientY);
    painting = true; lastClientX = event.clientX; lastClientY = event.clientY;
  }
});
let painting = false, lastClientX = 0, lastClientY = 0, lastPaintTime = 0;
renderer.domElement.addEventListener('pointermove', (event) => {
  lastClientX = event.clientX; lastClientY = event.clientY;
  if (flyDragButton && event.pointerId === flyPointerId) {
    const dx = event.clientX - flyLastPointer[0];
    const dy = event.clientY - flyLastPointer[1];
    flyLastPointer = [event.clientX, event.clientY];
    if (flyDragButton === 1) flyLook(dx, dy); else flyPan(dx, dy);
    screenIndexDirty = true; schedulePolylinePreview(); drawOverlay(); return;
  }
  if (isOrthoView() && bevPanning) {
    const dx = event.clientX - bevPanAnchor[0];
    const dy = event.clientY - bevPanAnchor[1];
    const rect = renderer.domElement.getBoundingClientRect();
    const unitsPerPixel = (2 * ortho.halfH) / Math.max(1, rect.height);
    bevCamera.updateMatrixWorld(true);
    const right = new THREE.Vector3().setFromMatrixColumn(bevCamera.matrixWorld, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(bevCamera.matrixWorld, 1);
    ortho.cx += (-right.x * dx + up.x * dy) * unitsPerPixel;
    ortho.cy += (-right.y * dx + up.y * dy) * unitsPerPixel;
    ortho.targetZ += (-right.z * dx + up.z * dy) * unitsPerPixel;
    bevPanAnchor = [event.clientX, event.clientY];
    updateBevCamera(); screenIndexDirty = true; schedulePolylinePreview(); drawOverlay(); return;
  }
  if (selectionDragging && (tool === 'rect' || tool === 'lasso')) {
    if (tool === 'rect' && selectionStart) selectionPath = [selectionStart, { x: event.clientX, y: selectionStart.y }, { x: event.clientX, y: event.clientY }, { x: selectionStart.x, y: event.clientY }];
    else if (selectionPath.length === 0 || Math.hypot(selectionPath.at(-1)!.x - event.clientX, selectionPath.at(-1)!.y - event.clientY) >= 3) selectionPath.push({ x: event.clientX, y: event.clientY });
    updateSelectionPreview(); drawOverlay(); return;
  }
  if (polygonVertexDragging >= 0 && tool === 'polygon' && (event.buttons & 1) !== 0) { polyVerts[polygonVertexDragging] = { x: event.clientX, y: event.clientY }; drawOverlay(); return; }
  if (polylineVertexDragging >= 0 && tool === 'polyline' && (event.buttons & 1) !== 0) {
    const point = worldPointAtScreen(event.clientX, event.clientY);
    if (point) { polylineVerts[polylineVertexDragging] = point; updatePolylinePreview(); drawOverlay(); }
    return;
  }
  if (painting && tool === 'brush') {
    const now = performance.now(); if (now - lastPaintTime >= 16) { paintAt(event.clientX, event.clientY); lastPaintTime = now; } return;
  }
  if (!data || screenIndexDirty) return;
  const candidates = candidatePoints(event.clientX - 6, event.clientY - 6, event.clientX + 6, event.clientY + 6);
  let best = -1, bestDistance = 36;
  for (const i of candidates) if (screenX && screenY) { const dx = screenX[i] - event.clientX, dy = screenY[i] - event.clientY; const d = dx * dx + dy * dy; if (d < bestDistance) { bestDistance = d; best = i; } }
  if (best >= 0) hoverEl.textContent = language === 'zh'
    ? `帧 ${data.frameIndex[best]} · 点 ${data.pointIndex[best]} · 标签 ${data.semantic[best]}（${displayLabelName(data.semantic[best])}）`
    : `Frame ${data.frameIndex[best]} · Point ${data.pointIndex[best]} · Label ${data.semantic[best]} (${displayLabelName(data.semantic[best])})`;
});
window.addEventListener('pointerup', (event) => {
  endFlyDrag(event);
  if (painting) { painting = false; endStroke(); }
  if (selectionDragging) { selectionDragging = false; updateSelectionPreview(); drawOverlay(); }
  if (polygonVertexDragging >= 0) polygonVertexDragging = -1;
  if (polylineVertexDragging >= 0) polylineVertexDragging = -1;
  bevPanning = false;
});
window.addEventListener('pointercancel', (event) => endFlyDrag(event));
renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault());
renderer.domElement.addEventListener('wheel', (event) => {
  if (viewMode === 'fly' && tool === 'navigate') {
    event.preventDefault();
    const steps = -event.deltaY / 100;
    camera.position.addScaledVector(flyForward(), steps * Math.max(1, flyPanRadius * 0.05));
    camera.updateMatrixWorld(true); syncFlyTarget(); screenIndexDirty = true; schedulePolylinePreview(); drawOverlay(); return;
  }
  if (!isOrthoView() || tool !== 'navigate') return;
  event.preventDefault(); ortho.halfH = Math.max(1, Math.min(100000, ortho.halfH * Math.exp(event.deltaY * 0.0015)));
  updateBevCamera(); screenIndexDirty = true; schedulePolylinePreview(); drawOverlay();
}, { passive: false });
renderer.domElement.addEventListener('click', (event) => {
  if (suppressPolygonClick) { suppressPolygonClick = false; return; }
  if (tool === 'polygon') { polyVerts.push({ x: event.clientX, y: event.clientY }); drawOverlay(); (document.getElementById('poly-apply') as HTMLButtonElement).disabled = polyVerts.length < 3; }
  else if (tool === 'workspace') { const p = projectClickToGround(event.clientX, event.clientY); if (p) { workspaceVerts.push(p); drawOverlay(); (document.getElementById('ws-apply') as HTMLButtonElement).disabled = workspaceVerts.length < 3; } }
});

// --- UI wiring -----------------------------------------------------------------
document.getElementById('tool-nav')!.onclick = () => setTool('navigate');
document.getElementById('tool-brush')!.onclick = () => setTool('brush');
document.getElementById('tool-poly')!.onclick = () => setTool('polygon');
document.getElementById('tool-polyline')!.onclick = () => setTool('polyline');
document.getElementById('tool-rect')!.onclick = () => setTool('rect');
document.getElementById('tool-lasso')!.onclick = () => setTool('lasso');
document.getElementById('tool-ws')!.onclick = () => setTool('workspace');
document.getElementById('undo')!.onclick = undo; document.getElementById('redo')!.onclick = redo;
document.getElementById('poly-apply')!.onclick = applyPolygon; document.getElementById('polyline-apply')!.onclick = applyPolyline; document.getElementById('selection-apply')!.onclick = applySelection;
document.getElementById('ws-apply')!.onclick = applyWorkspace; document.getElementById('ws-clear')!.onclick = clearWorkspace;
document.getElementById('export-frame')!.onclick = () => { void exportLabels(true); };
document.getElementById('export-clip')!.onclick = () => { void exportLabels(false); };
document.getElementById('unsaved-save')!.onclick = () => resolveUnsavedAction('save');
document.getElementById('unsaved-discard')!.onclick = () => resolveUnsavedAction('discard');
document.getElementById('unsaved-cancel')!.onclick = () => resolveUnsavedAction('cancel');
document.getElementById('save')!.onclick = () => { void saveEdits(); };
document.getElementById('save-frame')!.onclick = () => { void saveEdits(activeFrame); };
document.getElementById('fit')!.onclick = fitData;
document.getElementById('fly')!.onclick = toggleFly;
document.getElementById('bev')!.onclick = toggleBev;
document.getElementById('play-speed')!.addEventListener('change', (event) => setPlaybackSpeed(Number((event.target as HTMLSelectElement).value)));
document.getElementById('panel-toggle')!.addEventListener('click', () => {
  const panel = document.getElementById('seg-panel');
  if (!panel) return;
  panel.classList.toggle('collapsed');
  const button = document.getElementById('panel-toggle');
  if (button) button.textContent = panel.classList.contains('collapsed') ? '‹' : '×';
});
document.getElementById('fullscreen')!.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch (error) { console.warn('fullscreen unavailable', error); }
});
const uiScaleEl = document.getElementById('ui-scale') as HTMLSelectElement | null;
if (uiScaleEl) {
  uiScaleEl.value = String(initialUiScale);
  uiScaleEl.addEventListener('change', (event) => setUiScale(Number((event.target as HTMLSelectElement).value)));
}
document.getElementById('frame-prev')!.onclick = () => setActiveFrame(activeFrame - 1);
document.getElementById('frame-next')!.onclick = () => setActiveFrame(activeFrame + 1);
document.getElementById('frame-play')!.onclick = togglePlay;
document.getElementById('frame-input')!.addEventListener('change', setFrameFromInput);
document.getElementById('frame-input')!.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); setFrameFromInput(); } });
document.getElementById('window-start')!.addEventListener('input', (event) => { void requestWindow(parseInt((event.target as HTMLInputElement).value, 10)); });
document.getElementById('window-size')!.addEventListener('change', (event) => { setWindowSize(Number((event.target as HTMLInputElement).value)); });
document.getElementById('annotation-scope')!.addEventListener('change', (event) => {
  annotationScope = (event.target as HTMLSelectElement).value as 'frame' | 'window';
  clearSelectionPreview(); updateTimeline();
});
document.getElementById('frame-display')!.addEventListener('change', (event) => {
  frameDisplayMode = (event.target as HTMLSelectElement).value as 'frame' | 'highlight' | 'window';
  clearSelectionPreview(); updateFrameView(); drawOverlay();
});
const performanceProfileEl = document.getElementById('performance-profile') as HTMLSelectElement | null;
performanceProfileEl?.addEventListener('change', (event) => {
  const requested = normalizePerformanceProfile((event.target as HTMLSelectElement).value);
  try { localStorage.setItem(PERFORMANCE_PROFILE_STORAGE_KEY, requested); } catch { /* storage may be disabled */ }
  void applyPerformanceProfile(requested);
});
const displayThemeEl = document.getElementById('display-theme') as HTMLSelectElement | null;
displayThemeEl?.addEventListener('change', (event) => {
  applyDisplayTheme(normalizeDisplayTheme((event.target as HTMLSelectElement).value));
});
const languageEl = document.getElementById('language') as HTMLSelectElement | null;
if (languageEl) {
  languageEl.value = language;
  languageEl.addEventListener('change', (event) => {
    applyLanguage(normalizeLanguage((event.target as HTMLSelectElement).value));
  });
}
applyLanguage(language, false);
const overwriteEl = document.getElementById('overwrite') as HTMLInputElement; overwrite = overwriteEl.checked; overwriteEl.onchange = () => { overwrite = overwriteEl.checked; };
const eraseEl = document.getElementById('erase') as HTMLInputElement; eraseMode = eraseEl.checked; eraseEl.onchange = () => { eraseMode = eraseEl.checked; };
const radiusEl = document.getElementById('brush-radius') as HTMLInputElement; radiusEl.oninput = () => { document.getElementById('brush-radius-v')!.textContent = radiusEl.value; if (tool === 'polyline') { updatePolylinePreview(); drawOverlay(); } };
const heightFilterEl = document.getElementById('height-filter') as HTMLInputElement; heightFilterEl.oninput = () => { document.getElementById('height-filter-v')!.textContent = heightFilterEl.value; if (tool === 'polyline') { updatePolylinePreview(); drawOverlay(); } };
const groundModeEl = document.getElementById('ground-mode') as HTMLSelectElement; groundModeEl.onchange = () => { groundMode = groundModeEl.value as 'all' | 'hide' | 'only'; clearSelectionPreview(); recomputeVisibility(); };
const groundThresholdEl = document.getElementById('ground-thr') as HTMLInputElement; groundThresholdEl.oninput = () => { groundThreshold = parseFloat(groundThresholdEl.value); document.getElementById('ground-thr-v')!.textContent = groundThresholdEl.value; clearSelectionPreview(); recomputeVisibility(); };
const pointSizeEl = document.getElementById('pt-size') as HTMLInputElement; pointSizeEl.oninput = () => { sharedMat.uniforms.uWorldSize.value = parseFloat(pointSizeEl.value); document.getElementById('pt-size-v')!.textContent = pointSizeEl.value; };
window.addEventListener('keydown', (event) => {
  const key = event.key.toLowerCase();
  if ((event.ctrlKey || event.metaKey) && !event.altKey) {
    if (key === '0') { event.preventDefault(); setUiScale(1); return; }
    if (key === '-' || event.code === 'Minus') { event.preventDefault(); adjustUiScale(-1); return; }
    if (key === '=' || key === '+' || event.code === 'Equal') { event.preventDefault(); adjustUiScale(1); return; }
  }
  if ((event.ctrlKey || event.metaKey) && key === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); return; }
  if ((event.ctrlKey || event.metaKey) && key === 'y') { event.preventDefault(); redo(); return; }
  if ((event.ctrlKey || event.metaKey) && key === 's') { event.preventDefault(); void saveEdits(); return; }
  if (event.altKey && !event.ctrlKey && !event.metaKey && /^[0-9]$/.test(event.key)) {
    const label = labelIdForShortcut(event.key);
    if (label !== null) { event.preventDefault(); selectLabel(label); return; }
  }
  if (event.key === 'Enter') { if (tool === 'polygon') applyPolygon(); else if (tool === 'polyline') applyPolyline(); else if (tool === 'rect' || tool === 'lasso') applySelection(); else if (tool === 'workspace') applyWorkspace(); return; }
  if (event.key === 'Escape') {
    polyVerts = []; workspaceVerts = []; clearSelectionPreview();
    if (tool !== 'navigate') setTool('navigate');
    else if (viewMode === 'fly') setViewMode('persp');
    else drawOverlay();
    return;
  }
  if (event.key === 'Delete') { if (tool === 'polygon') { polyVerts.pop(); drawOverlay(); } else if (tool === 'polyline') { polylineVerts.pop(); updatePolylinePreview(); drawOverlay(); } else if (tool === 'workspace') { workspaceVerts.pop(); drawOverlay(); } return; }
  if ((key === 'f' || key === 'g') && !event.ctrlKey && !event.metaKey && !event.altKey) { event.preventDefault(); toggleFly(); return; }
  if (viewMode === 'fly' && tool === 'navigate' && flyKeyCodes.has(event.code)) { event.preventDefault(); flyKeys.add(event.code); return; }
  if (key === 'v') { cycleViewMode(); return; }
  if (key === 'b') { toggleBev(); return; }
  if (viewMode === 'bev' && (key === 'q' || key === 'e')) { ortho.roll += key === 'q' ? Math.PI / 12 : -Math.PI / 12; updateBevCamera(); screenIndexDirty = true; schedulePolylinePreview(); drawOverlay(); return; }
  if (key === '[' || key === ']') { groundThreshold = Math.max(0, groundThreshold + (key === '[' ? -0.05 : 0.05)); groundThresholdEl.value = groundThreshold.toFixed(2); groundThresholdEl.dispatchEvent(new Event('input')); return; }
  if (key === 'n') setTool('navigate'); else if (key === '1') setTool('brush'); else if (key === '2') setTool('polygon'); else if (key === '5') setTool('polyline'); else if (key === '3') setTool('rect'); else if (key === '4') setTool('lasso');
});
controls.addEventListener('change', () => { screenIndexDirty = true; schedulePolylinePreview(); drawOverlay(); });
window.addEventListener('keyup', (event) => {
  flyKeys.delete(event.code);
});
window.addEventListener('blur', clearFlyInput);
window.addEventListener('resize', () => {
  const width = viewport.clientWidth || innerWidth;
  const height = viewport.clientHeight || innerHeight;
  camera.aspect = width / Math.max(1, height); camera.updateProjectionMatrix();
  renderer.setSize(width, height); sharedMat.uniforms.uViewportH.value = height;
  if (isOrthoView()) updateBevCamera();
  screenIndexDirty = true; resizeOverlay(); schedulePolylinePreview(); drawOverlay();
});
window.addEventListener('beforeunload', (event) => { if (edits.size > 0) { event.preventDefault(); event.returnValue = ''; } });

function updateDatasetSelector() {
  const select = document.getElementById('clip-select') as HTMLSelectElement | null;
  if (!select) return;
  select.innerHTML = '';
  if (datasetEntries.length === 0) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = tr('status.noClip');
    select.appendChild(option);
    select.disabled = true;
    return;
  }
  if (datasetEntries.length > 1) {
    const option = document.createElement('option');
    option.value = '';
    option.textContent = tr('status.chooseClip');
    select.appendChild(option);
  }
  for (const entry of datasetEntries) {
    const option = document.createElement('option');
    option.value = entry.id;
    option.textContent = entry.id;
    select.appendChild(option);
  }
  select.disabled = datasetEntries.length <= 1;
  if (currentDatasetId) select.value = currentDatasetId;
}
function syncDatasetSelection(datasetId: string) {
  const entry = datasetEntries.find((item) => item.id === datasetId);
  const select = document.getElementById('clip-select') as HTMLSelectElement | null;
  if (select) {
    select.value = datasetId;
    select.disabled = datasetEntries.length <= 1;
  }
  const status = document.getElementById('clip-status');
  if (status && entry) status.textContent = `${displayDatasetFormat(entry.format)} · ${entry.id}`;
}
async function loadAvailableDatasets() {
  const status = document.getElementById('clip-status');
  try {
    const response = await fetch('/api/datasets');
    if (!response.ok) throw new Error(language === 'zh' ? `Clip 扫描失败（${response.status}）` : `Clip scan failed (${response.status})`);
    datasetEntries = await response.json() as DatasetEntryClient[];
    updateDatasetSelector();
    if (datasetEntries.length === 0) {
      statsEl.textContent = tr('status.noClipHint');
      if (status) status.textContent = tr('status.noClip');
      return;
    }
    if (datasetEntries.length === 1) {
      if (status) status.textContent = tr('status.openingClip');
      await loadDataset(datasetEntries[0].id);
      return;
    }
    statsEl.textContent = language === 'zh' ? `发现 ${datasetEntries.length} 个 Clip，请在上方选择` : `${datasetEntries.length} Clips found. Select one above.`;
    if (status) status.textContent = interpolate(tr('status.clipFound'), { count: datasetEntries.length });
  } catch (error) {
    statsEl.textContent = interpolate(tr('status.clipScanFailed'), { error: String(error) });
    if (status) status.textContent = language === 'zh' ? 'Clip 扫描失败' : 'Clip scan failed';
  }
}
(async () => {
  labelNames = await loadPalette(); refreshDisplayThemeUi(); buildLabelPanel(); updateTimeline(); resizeOverlay(); drawOverlay(); updateUndoRedo();
  statsEl.textContent = tr('status.scan');
  const clipStatus = document.getElementById('clip-status');
  if (clipStatus) clipStatus.textContent = tr('status.scan');
  await loadAvailableDatasets();
})();
document.getElementById('clip-select')!.addEventListener('change', (event) => {
  const id = (event.target as HTMLSelectElement).value;
  if (id) void loadDataset(id);
});
document.getElementById('open-video')?.addEventListener('click', openClipVideo);

let renderFrames = 0, renderWindowStart = performance.now(), lastAnimationTime = performance.now();
function animate(now = performance.now()) {
  requestAnimationFrame(animate);
  const delta = Math.min(0.1, Math.max(0, (now - lastAnimationTime) / 1000));
  lastAnimationTime = now;
  if (viewMode === 'fly') updateFlyCamera(delta); else controls.update();
  sharedMat.uniforms.uOrtho.value = isOrthoView() ? 1 : 0;
  renderer.render(scene, activeCamera());
  renderFrames++;
  const frameNow = performance.now();
  if (frameNow - renderWindowStart >= 1000) {
    const fps = (renderFrames * 1000 / (frameNow - renderWindowStart)).toFixed(0);
    const pointSummary = data ? pointText(data.pointCount) : (language === 'zh' ? '暂无点云' : 'No point cloud');
    const loadingPrefix = language === 'zh' ? '正在加载' : 'Loading';
    const failedPrefix = language === 'zh' ? '窗口加载失败' : 'Window load failed';
    if (currentDatasetId && !statsEl.textContent?.startsWith(loadingPrefix) && !statsEl.textContent?.startsWith(failedPrefix)) {
      statsEl.textContent = language === 'zh'
        ? `${currentDatasetId}：${pointSummary} · ${fps} FPS · 当前帧 ${activeFrame + 1}`
        : `${currentDatasetId}: ${pointSummary} · ${fps} FPS · Frame ${activeFrame + 1}`;
    }
    renderFrames = 0; renderWindowStart = frameNow;
  }
}
animate();

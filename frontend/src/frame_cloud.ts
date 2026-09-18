// Full-resolution frame-window transport used by the WebGL renderer.
// One request contains a configurable consecutive source-frame interval; no
// point is sampled or discarded on the server. The UI selects a frame window
// from the detected or manually selected performance profile.

export interface FrameInfo {
  frameIndex: number;
  frameId: string;
  pointCount: number;
}

export interface FrameStatus {
  frameIndex: number;
  pointCount: number;
  labeledCount: number;
  known: boolean;
}

export interface FramePacket {
  startFrame: number;
  endFrame: number;
  frameCount: number;
  pointCount: number;
  positions: Float32Array;
  frameIndex: Uint32Array;
  pointIndex: Uint32Array;
  semantic: Uint8Array;
}

const HEADER_SIZE = 36;
const POINT_SIZE = 24;

export async function loadFrameManifest(datasetId: string): Promise<FrameInfo[]> {
  const response = await fetch(`/api/datasets/${encodeURIComponent(datasetId)}/frame-manifest`);
  if (!response.ok) throw new Error(`读取帧清单失败（${response.status}）`);
  return response.json() as Promise<FrameInfo[]>;
}

export async function loadFrameStatus(datasetId: string): Promise<FrameStatus[]> {
  const response = await fetch(`/api/datasets/${encodeURIComponent(datasetId)}/frame-status`);
  if (!response.ok) throw new Error(`读取帧状态失败（${response.status}）`);
  return response.json() as Promise<FrameStatus[]>;
}

export async function loadFrameWindow(datasetId: string, startFrame: number, endFrame: number): Promise<FramePacket> {
  const url = `/api/datasets/${encodeURIComponent(datasetId)}/frames/${startFrame}/${endFrame}`;
  const response = await fetch(url);
  if (!response.ok) {
    let message = `读取帧窗口失败（${response.status}）`;
    try { message = (await response.json()).error ?? message; } catch { /* keep status */ }
    throw new Error(message);
  }
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength < HEADER_SIZE) throw new Error('帧数据包不完整');
  const view = new DataView(buffer);
  const magic = new TextDecoder().decode(new Uint8Array(buffer, 0, 8));
  if (!magic.startsWith('PLWFRM') || view.getUint32(8, true) !== 1) throw new Error('帧数据包格式无效');
  const start = view.getUint32(12, true);
  const end = view.getUint32(16, true);
  const frameCount = view.getUint32(20, true);
  const pointCount = Number(view.getBigUint64(24, true));
  const pointSize = view.getUint32(32, true);
  if (pointSize !== POINT_SIZE || HEADER_SIZE + pointCount * POINT_SIZE > buffer.byteLength) {
    throw new Error('帧数据包长度无效');
  }

  const positions = new Float32Array(pointCount * 3);
  const frameIndex = new Uint32Array(pointCount);
  const pointIndex = new Uint32Array(pointCount);
  const semantic = new Uint8Array(pointCount);
  for (let i = 0; i < pointCount; i++) {
    const offset = HEADER_SIZE + i * POINT_SIZE;
    positions[i * 3] = view.getFloat32(offset, true);
    positions[i * 3 + 1] = view.getFloat32(offset + 4, true);
    positions[i * 3 + 2] = view.getFloat32(offset + 8, true);
    frameIndex[i] = view.getUint32(offset + 12, true);
    pointIndex[i] = view.getUint32(offset + 16, true);
    semantic[i] = view.getUint32(offset + 20, true) & 255;
  }
  return { startFrame: start, endFrame: end, frameCount, pointCount, positions, frameIndex, pointIndex, semantic };
}

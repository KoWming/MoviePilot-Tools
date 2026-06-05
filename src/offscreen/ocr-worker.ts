// Offscreen Document OCR Worker
// 在普通页面上下文中运行 ONNX Runtime，绕过 Service Worker 的 import() 限制
import * as ort from 'onnxruntime-web/wasm';

const MODEL_URL = 'ocr/common.onnx';
const CHARSETS_URL = 'ocr/charsets.json';
const WASM_BASE_URL = 'ocr/';
const TARGET_HEIGHT = 64;

let session: ort.InferenceSession | null = null;
let charsets: string[] | null = null;

function getRuntimeUrl(path: string): string {
  return chrome.runtime.getURL(path);
}

async function initSession(): Promise<ort.InferenceSession> {
  if (!session) {
    ort.env.wasm.wasmPaths = getRuntimeUrl(WASM_BASE_URL);
    ort.env.wasm.numThreads = 1;
    ort.env.wasm.simd = true;
    ort.env.logLevel = 'error';

    const resp = await fetch(getRuntimeUrl(MODEL_URL));
    if (!resp.ok) throw new Error(`模型加载失败: HTTP ${resp.status}`);
    const model = await resp.arrayBuffer();
    session = await ort.InferenceSession.create(model, {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all'
    });
  }
  return session;
}

async function initCharsets(): Promise<string[]> {
  if (!charsets) {
    const resp = await fetch(getRuntimeUrl(CHARSETS_URL));
    if (!resp.ok) throw new Error(`字符集加载失败: HTTP ${resp.status}`);
    const data = await resp.json();
    if (!Array.isArray(data)) throw new Error('字符集格式无效');
    charsets = data.map((item: unknown) => String(item));
  }
  return charsets;
}

function toGrayscale(data: Uint8ClampedArray): Uint8ClampedArray {
  const gray = new Uint8ClampedArray(data.length / 4);
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    const alpha = a / 255;
    gray[i / 4] = Math.round(0.2126 * (r * alpha + 255 * (1 - alpha)) +
                             0.7152 * (g * alpha + 255 * (1 - alpha)) +
                             0.0722 * (b * alpha + 255 * (1 - alpha)));
  }
  return gray;
}

function resize(data: Uint8ClampedArray, w: number, h: number, nw: number, nh: number): Uint8ClampedArray {
  const result = new Uint8ClampedArray(nw * nh);
  const xr = w / nw, yr = h / nh;
  for (let y = 0; y < nh; y++) {
    for (let x = 0; x < nw; x++) {
      const px = x * xr, py = y * yr;
      const x1 = Math.floor(px), x2 = Math.min(x1 + 1, w - 1);
      const y1 = Math.floor(py), y2 = Math.min(y1 + 1, h - 1);
      const fx = px - x1, fy = py - y1;
      result[y * nw + x] = Math.round(
        data[y1 * w + x1] * (1 - fx) * (1 - fy) +
        data[y1 * w + x2] * fx * (1 - fy) +
        data[y2 * w + x1] * (1 - fx) * fy +
        data[y2 * w + x2] * fx * fy
      );
    }
  }
  return result;
}

function normalize(data: Uint8ClampedArray): Float32Array {
  const out = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) out[i] = data[i] / 255;
  return out;
}

async function loadImage(base64: string): Promise<{ data: Float32Array; width: number }> {
  const resp = await fetch(`data:image/png;base64,${base64}`);
  const blob = await resp.blob();
  const bitmap = await createImageBitmap(blob);
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('无法创建画布');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const gray = toGrayscale(imageData.data);
    const tw = Math.max(1, Math.floor(canvas.width * (TARGET_HEIGHT / canvas.height)));
    const resized = resize(gray, canvas.width, canvas.height, tw, TARGET_HEIGHT);
    return { data: normalize(resized), width: tw };
  } finally {
    bitmap.close();
  }
}

function decodeOutput(output: ort.Tensor, chars: string[]): string {
  const result: string[] = [];
  let prev = -1;
  for (const raw of Array.from(output.data as Iterable<number | bigint>)) {
    const idx = typeof raw === 'bigint' ? Number(raw) : Math.round(raw);
    if (idx === prev) continue;
    prev = idx;
    if (idx <= 0 || idx >= chars.length) continue;
    const ch = chars[idx];
    if (ch) result.push(ch);
  }
  return result.join('').trim();
}

async function recognize(base64: string): Promise<string> {
  const [sess, chs, img] = await Promise.all([
    initSession(), initCharsets(), loadImage(base64)
  ]);
  const input = new ort.Tensor('float32', img.data, [1, 1, TARGET_HEIGHT, img.width]);
  const outputs = await sess.run({ input1: input });
  const output = outputs.output || outputs[Object.keys(outputs)[0]];
  if (!output) throw new Error('OCR 输出为空');
  const result = decodeOutput(output, chs);
  if (!result) throw new Error('OCR 解码为空');
  return result;
}

// 监听来自 Background 的消息
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'OFFSCREEN_OCR_RECOGNIZE') {
    (async () => {
      try {
        const code = await recognize(msg.base64Img);
        sendResponse({ success: true, code });
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true; // 异步响应
  }
});

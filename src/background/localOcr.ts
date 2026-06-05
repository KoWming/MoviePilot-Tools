// 离线 OCR：通过 Offscreen Document 运行 ONNX Runtime
// Service Worker 中禁止 import()，而 onnxruntime-web 的 ESM 打包依赖 import()
// Offscreen Document 在普通页面上下文中运行，无此限制

const OFFSCREEN_DOC_PATH = 'src/offscreen/ocr-worker.html';

async function ensureOffscreenDocument(): Promise<void> {
  // 检查是否已存在
  const existing = await chrome.offscreen?.hasDocument?.();
  if (existing) return;

  await chrome.offscreen.createDocument({
    url: chrome.runtime.getURL(OFFSCREEN_DOC_PATH),
    reasons: ['DOM_SCRAPING' as chrome.offscreen.Reason],
    justification: '离线 OCR 推理需要 DOM 环境加载 WASM'
  });
}

export async function recognizeCaptchaOffline(base64Img: string): Promise<string> {
  await ensureOffscreenDocument();

  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { type: 'OFFSCREEN_OCR_RECOGNIZE', base64Img },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response?.success) {
          resolve(response.code);
        } else {
          reject(new Error(response?.error || '离线 OCR 未能识别验证码'));
        }
      }
    );
  });
}

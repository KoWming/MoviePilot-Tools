// ============================================================
// Web 嵌入功能开关配置
// 控制 Content Script 注入的各类功能模块启用/禁用
// ============================================================

import { STORAGE_KEYS } from './constants';

// Content Script 功能开关配置接口
export interface WebEmbedFeaturesConfig {
  torrentDetailDownloadEnabled: boolean;  // PT 站点种子详情页下载按钮
  totpAutoFillEnabled: boolean;           // TOTP 两步验证自动填充
  captchaAutoFillEnabled: boolean;        // 验证码自动识别填充
  captchaOfflineOcrEnabled: boolean;      // 离线 OCR 识别（ONNX Runtime）
  captchaAiAssistEnabled: boolean;        // AI 辅助验证码识别
}

// 默认配置（保守策略：仅开启种子下载按钮）
export const DEFAULT_WEB_EMBED_FEATURES_CONFIG: WebEmbedFeaturesConfig = {
  torrentDetailDownloadEnabled: true,
  totpAutoFillEnabled: false,
  captchaAutoFillEnabled: false,
  captchaOfflineOcrEnabled: false,
  captchaAiAssistEnabled: false
};

// 获取 Web 嵌入功能配置（合并默认值）
export async function getWebEmbedFeaturesConfig(): Promise<WebEmbedFeaturesConfig> {
  const data = await chrome.storage.local.get([STORAGE_KEYS.WEB_EMBED_FEATURES]);
  const config = data[STORAGE_KEYS.WEB_EMBED_FEATURES] as Partial<WebEmbedFeaturesConfig> | undefined;
  return {
    ...DEFAULT_WEB_EMBED_FEATURES_CONFIG,
    ...config
  };
}

// 保存 Web 嵌入功能配置
export async function saveWebEmbedFeaturesConfig(config: WebEmbedFeaturesConfig): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.WEB_EMBED_FEATURES]: config });
}
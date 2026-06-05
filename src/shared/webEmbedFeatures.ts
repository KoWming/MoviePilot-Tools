import { STORAGE_KEYS } from './constants';

export interface WebEmbedFeaturesConfig {
  torrentDetailDownloadEnabled: boolean;
  totpAutoFillEnabled: boolean;
  captchaAutoFillEnabled: boolean;
  captchaOfflineOcrEnabled: boolean;
  captchaAiAssistEnabled: boolean;
}

export const DEFAULT_WEB_EMBED_FEATURES_CONFIG: WebEmbedFeaturesConfig = {
  torrentDetailDownloadEnabled: true,
  totpAutoFillEnabled: false,
  captchaAutoFillEnabled: false,
  captchaOfflineOcrEnabled: false,
  captchaAiAssistEnabled: false
};

export async function getWebEmbedFeaturesConfig(): Promise<WebEmbedFeaturesConfig> {
  const data = await chrome.storage.local.get([STORAGE_KEYS.WEB_EMBED_FEATURES]);
  const config = data[STORAGE_KEYS.WEB_EMBED_FEATURES] as Partial<WebEmbedFeaturesConfig> | undefined;
  return {
    ...DEFAULT_WEB_EMBED_FEATURES_CONFIG,
    ...config
  };
}

export async function saveWebEmbedFeaturesConfig(config: WebEmbedFeaturesConfig): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.WEB_EMBED_FEATURES]: config });
}
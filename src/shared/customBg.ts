import { STORAGE_KEYS } from './constants';

export interface CustomBgConfig {
  enabled: boolean;
  blurEnabled: boolean;
  blur: number;
  opacity: number;
  url: string;
}

export const DEFAULT_CUSTOM_BG_CONFIG: CustomBgConfig = {
  enabled: false,
  blurEnabled: false,
  blur: 5,
  opacity: 0.5,
  url: ''
};

export async function getCustomBgConfig(): Promise<CustomBgConfig> {
  try {
    const data = await chrome.storage.local.get([STORAGE_KEYS.CUSTOM_BG_CONFIG]);
    const config = data[STORAGE_KEYS.CUSTOM_BG_CONFIG] as Partial<CustomBgConfig> | undefined;
    return {
      ...DEFAULT_CUSTOM_BG_CONFIG,
      ...config
    };
  } catch (e) {
    console.error('Failed to get custom background config:', e);
    return DEFAULT_CUSTOM_BG_CONFIG;
  }
}

export async function saveCustomBgConfig(config: CustomBgConfig): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.CUSTOM_BG_CONFIG]: config });
}

export async function getCustomBgImage(): Promise<string> {
  try {
    const data = await chrome.storage.local.get([STORAGE_KEYS.CUSTOM_BG_IMAGE]);
    return (data[STORAGE_KEYS.CUSTOM_BG_IMAGE] as string) || '';
  } catch (e) {
    console.error('Failed to get custom background image:', e);
    return '';
  }
}

export async function saveCustomBgImage(base64Image: string): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.CUSTOM_BG_IMAGE]: base64Image });
}

export async function clearCustomBgImage(): Promise<void> {
  await chrome.storage.local.remove([STORAGE_KEYS.CUSTOM_BG_IMAGE]);
}

/**
 * Resizes and compresses an image Blob/File to a max dimension of 1000px and returns JPEG base64 Data URL.
 */
export function compressAndResizeImage(fileOrBlob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        const maxDimension = 1000;
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('无法创建 Canvas 上下文'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        // Export as JPEG with 0.8 quality
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve(dataUrl);
      };
      img.onerror = () => {
        reject(new Error('图片加载失败'));
      };
      img.src = e.target?.result as string;
    };
    reader.onerror = () => {
      reject(new Error('读取文件失败'));
    };
    reader.readAsDataURL(fileOrBlob);
  });
}

/**
 * Downloads an image from the given URL, converts it to a blob, and compresses/resizes it.
 */
export async function downloadAndCompressImage(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`下载图片失败 (HTTP ${response.status})`);
  }
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) {
    throw new Error('获取的文件不是有效的图片格式');
  }
  return compressAndResizeImage(blob);
}

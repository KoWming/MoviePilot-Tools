// ============================================================
// 存储管理 Vue 组合式函数
// 响应式管理 Chrome Storage 数据（Token/BaseURL）
// 支持 sync → local 自动迁移
// ============================================================

import { ref, computed, readonly } from 'vue';
import { STORAGE_KEYS } from '../constants';

/**
 * 存储管理组合式函数
 */
export function useStorage() {
  const baseURL = ref('');
  const token = ref('');

  // 从存储中加载数据（local 优先，sync 回退兼容旧版本）
  const loadFromStorage = async () => {
    const data = await chrome.storage.local.get([STORAGE_KEYS.BASE_URL, STORAGE_KEYS.TOKEN]);
    let bUrl = data[STORAGE_KEYS.BASE_URL] as string | undefined;
    let tkn = data[STORAGE_KEYS.TOKEN] as string | undefined;

    // 兼容旧版本：local 无数据时从 sync 读取并迁移
    if (!bUrl || !tkn) {
      try {
        const syncData = await chrome.storage.sync.get([STORAGE_KEYS.BASE_URL, STORAGE_KEYS.TOKEN]);
        if (!bUrl && syncData[STORAGE_KEYS.BASE_URL]) bUrl = syncData[STORAGE_KEYS.BASE_URL] as string;
        if (!tkn && syncData[STORAGE_KEYS.TOKEN]) tkn = syncData[STORAGE_KEYS.TOKEN] as string;
        // 迁移到 local
        if (bUrl || tkn) {
          const toSet: Record<string, string> = {};
          if (bUrl) toSet[STORAGE_KEYS.BASE_URL] = bUrl;
          if (tkn) toSet[STORAGE_KEYS.TOKEN] = tkn;
          await chrome.storage.local.set(toSet);
        }
      } catch {}
    }

    baseURL.value = bUrl || '';
    token.value = tkn || '';
  };

  // 保存到存储
  const saveToStorage = async (url: string, authToken: string) => {
    await chrome.storage.local.set({
      [STORAGE_KEYS.BASE_URL]: url,
      [STORAGE_KEYS.TOKEN]: authToken
    });
    baseURL.value = url;
    token.value = authToken;
  };

  // 清除存储
  const clearStorage = async () => {
    await chrome.storage.local.remove([STORAGE_KEYS.BASE_URL, STORAGE_KEYS.TOKEN]);
    baseURL.value = '';
    token.value = '';
  };

  // 检查是否有认证信息
  const hasAuth = computed(() => !!(baseURL.value && token.value));

  return {
    baseURL: readonly(baseURL),
    token: readonly(token),
    hasAuth,
    loadFromStorage,
    saveToStorage,
    clearStorage
  };
}

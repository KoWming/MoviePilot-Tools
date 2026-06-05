import { STORAGE_KEYS } from '../constants';

/**
 * 从 sync 迁移到 local（兼容旧版本升级）
 * 如果 local 无数据但 sync 有，自动迁移一份
 */
async function migrateSyncToLocal(keys: string[]): Promise<void> {
  try {
    const syncData = await chrome.storage.sync.get(keys);
    const toSet: Record<string, unknown> = {};
    let hasData = false;
    for (const key of keys) {
      if (syncData[key] !== undefined) {
        toSet[key] = syncData[key];
        hasData = true;
      }
    }
    if (hasData) {
      await chrome.storage.local.set(toSet);
    }
  } catch {}
}

/**
 * 获取存储的 Token（local 存储，避免跨设备同步泄露）
 * 兼容旧版本：local 无数据时自动从 sync 迁移
 */
export async function getToken(): Promise<string | undefined> {
  const data = await chrome.storage.local.get([STORAGE_KEYS.TOKEN]);
  if (data[STORAGE_KEYS.TOKEN]) return data[STORAGE_KEYS.TOKEN] as string;

  // 回退 sync 迁移
  await migrateSyncToLocal([STORAGE_KEYS.TOKEN]);
  const data2 = await chrome.storage.local.get([STORAGE_KEYS.TOKEN]);
  return data2[STORAGE_KEYS.TOKEN] as string | undefined;
}

/**
 * 获取存储的基础 URL（local 存储）
 * 兼容旧版本：local 无数据时自动从 sync 迁移
 */
export async function getBaseUrl(): Promise<string> {
  const data = await chrome.storage.local.get([STORAGE_KEYS.BASE_URL]);
  if (data[STORAGE_KEYS.BASE_URL]) return data[STORAGE_KEYS.BASE_URL] as string;

  // 回退 sync 迁移
  await migrateSyncToLocal([STORAGE_KEYS.BASE_URL]);
  const data2 = await chrome.storage.local.get([STORAGE_KEYS.BASE_URL]);
  return (data2[STORAGE_KEYS.BASE_URL] as string | undefined) || '';
}

/**
 * 设置存储的 Token 和 BaseURL（local 存储）
 */
export async function setAuthData(token: string, baseURL: string): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.TOKEN]: token,
    [STORAGE_KEYS.BASE_URL]: baseURL
  });
}

/**
 * 清除认证数据
 */
export async function clearAuthData(): Promise<void> {
  await chrome.storage.local.remove([STORAGE_KEYS.TOKEN, STORAGE_KEYS.BASE_URL]);
}

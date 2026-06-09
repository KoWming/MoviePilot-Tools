// ============================================================
// Cookie/UA 自动更新配置模块
// 定时通过浏览器获取最新 Cookie/UserAgent 并同步到 MP 站点
// ============================================================

import { STORAGE_KEYS } from './constants';

// Cookie/UA 自动更新配置接口
export interface CookieUaAutoUpdateConfig {
  dailyFirstEnabled: boolean;     // 每日首次启用
  intervalEnabled: boolean;       // 定时启用
  intervalMinutes: number;        // 定时间隔（分钟）
}

// Chrome Alarm 名称
export const COOKIE_UA_AUTO_UPDATE_ALARM = 'mp-cookie-ua-auto-update';

// 定时间隔预设值
export const COOKIE_UA_INTERVAL_PRESETS = [
  { label: '30 分钟', value: 30 },
  { label: '1 小时', value: 60 },
  { label: '3 小时', value: 180 },
  { label: '6 小时', value: 360 },
  { label: '12 小时', value: 720 },
  { label: '1 天', value: 1440 },
  { label: '3 天', value: 4320 },
  { label: '5 天', value: 7200 },
  { label: '10 天', value: 14400 },
  { label: '15 天', value: 21600 },
  { label: '20 天', value: 28800 },
  { label: '30 天', value: 43200 }
] as const;

export const DEFAULT_COOKIE_UA_AUTO_UPDATE_CONFIG: CookieUaAutoUpdateConfig = {
  dailyFirstEnabled: false,
  intervalEnabled: false,
  intervalMinutes: 360
};

export async function getCookieUaAutoUpdateConfig(): Promise<CookieUaAutoUpdateConfig> {
  const data = await chrome.storage.local.get([STORAGE_KEYS.COOKIE_UA_AUTO_UPDATE]);
  const config = data[STORAGE_KEYS.COOKIE_UA_AUTO_UPDATE] as Partial<CookieUaAutoUpdateConfig> | undefined;
  return {
    ...DEFAULT_COOKIE_UA_AUTO_UPDATE_CONFIG,
    ...config,
    intervalMinutes: normalizeIntervalMinutes(config?.intervalMinutes)
  };
}

export async function saveCookieUaAutoUpdateConfig(config: CookieUaAutoUpdateConfig): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.COOKIE_UA_AUTO_UPDATE]: {
      ...config,
      intervalMinutes: normalizeIntervalMinutes(config.intervalMinutes)
    }
  });
}

export async function updateCookieUaAutoUpdateConfig(
  patch: Partial<CookieUaAutoUpdateConfig>
): Promise<CookieUaAutoUpdateConfig> {
  const current = await getCookieUaAutoUpdateConfig();
  const next = {
    ...current,
    ...patch,
    intervalMinutes: normalizeIntervalMinutes(patch.intervalMinutes ?? current.intervalMinutes)
  };
  await saveCookieUaAutoUpdateConfig(next);
  return next;
}

export function getTodayKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export async function shouldRunDailyCookieUaUpdate(): Promise<boolean> {
  const data = await chrome.storage.local.get([STORAGE_KEYS.COOKIE_UA_LAST_DAILY_UPDATE]);
  return data[STORAGE_KEYS.COOKIE_UA_LAST_DAILY_UPDATE] !== getTodayKey();
}

export async function markDailyCookieUaUpdated(): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.COOKIE_UA_LAST_DAILY_UPDATE]: getTodayKey() });
}

function normalizeIntervalMinutes(value?: number): number {
  const matched = COOKIE_UA_INTERVAL_PRESETS.find(item => item.value === value);
  return matched?.value ?? DEFAULT_COOKIE_UA_AUTO_UPDATE_CONFIG.intervalMinutes;
}
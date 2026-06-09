// ============================================================
// 站点自动打开配置模块
// 定时批量打开 PT 站点页面以维持登录状态（保活）
// ============================================================

import { STORAGE_KEYS } from './constants';

// 站点自动打开配置接口
export interface SiteAutoOpenConfig {
  monthlyFirstEnabled: boolean;   // 每月首次启用
  intervalEnabled: boolean;       // 定时启用
  intervalDays: number;           // 定时间隔（天）
  autoCloseEnabled: boolean;      // 自动关闭已打开标签页
  keepLoginTabsEnabled: boolean;  // 保留登录页标签
  closeDelayMinutes: number;      // 关闭延迟（分钟）
}

// Chrome Alarm 名称
export const SITE_AUTO_OPEN_ALARM = 'mp-site-auto-open';
export const SITE_AUTO_OPEN_CLOSE_TABS_ALARM = 'mp-site-auto-open-close-tabs';

// 定时间隔预设值
export const SITE_AUTO_OPEN_INTERVAL_PRESETS = [
  { label: '1 天', value: 1 },
  { label: '3 天', value: 3 },
  { label: '5 天', value: 5 },
  { label: '7 天', value: 7 },
  { label: '10 天', value: 10 },
  { label: '15 天', value: 15 },
  { label: '20 天', value: 20 },
  { label: '25 天', value: 25 },
  { label: '30 天', value: 30 }
] as const;

export const SITE_AUTO_CLOSE_DELAY_PRESETS = [
  { label: '1 分钟', value: 1 },
  { label: '3 分钟', value: 3 },
  { label: '5 分钟', value: 5 },
  { label: '10 分钟', value: 10 },
  { label: '15 分钟', value: 15 },
  { label: '30 分钟', value: 30 },
  { label: '60 分钟', value: 60 }
] as const;

export const DEFAULT_SITE_AUTO_OPEN_CONFIG: SiteAutoOpenConfig = {
  monthlyFirstEnabled: false,
  intervalEnabled: false,
  intervalDays: 7,
  autoCloseEnabled: false,
  keepLoginTabsEnabled: true,
  closeDelayMinutes: 5
};

export async function getSiteAutoOpenConfig(): Promise<SiteAutoOpenConfig> {
  const data = await chrome.storage.local.get([STORAGE_KEYS.SITE_AUTO_OPEN]);
  const config = data[STORAGE_KEYS.SITE_AUTO_OPEN] as Partial<SiteAutoOpenConfig> | undefined;
  return {
    ...DEFAULT_SITE_AUTO_OPEN_CONFIG,
    ...config,
    intervalDays: normalizeIntervalDays(config?.intervalDays),
    closeDelayMinutes: normalizeCloseDelayMinutes(config?.closeDelayMinutes)
  };
}

export async function saveSiteAutoOpenConfig(config: SiteAutoOpenConfig): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.SITE_AUTO_OPEN]: {
      ...config,
      intervalDays: normalizeIntervalDays(config.intervalDays),
      closeDelayMinutes: normalizeCloseDelayMinutes(config.closeDelayMinutes)
    }
  });
}

export function getMonthKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

export async function shouldRunMonthlySiteAutoOpen(): Promise<boolean> {
  const data = await chrome.storage.local.get([STORAGE_KEYS.SITE_AUTO_OPEN_LAST_MONTH]);
  return data[STORAGE_KEYS.SITE_AUTO_OPEN_LAST_MONTH] !== getMonthKey();
}

export async function markMonthlySiteAutoOpened(): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.SITE_AUTO_OPEN_LAST_MONTH]: getMonthKey() });
}

function normalizeIntervalDays(value?: number): number {
  const matched = SITE_AUTO_OPEN_INTERVAL_PRESETS.find(item => item.value === value);
  return matched?.value ?? DEFAULT_SITE_AUTO_OPEN_CONFIG.intervalDays;
}

function normalizeCloseDelayMinutes(value?: number): number {
  const matched = SITE_AUTO_CLOSE_DELAY_PRESETS.find(item => item.value === value);
  return matched?.value ?? DEFAULT_SITE_AUTO_OPEN_CONFIG.closeDelayMinutes;
}
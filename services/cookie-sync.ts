// Cookie/UA 自动更新：读取浏览器各站点 Cookie/UA，同步（覆盖）到 MP 服务器站点配置
// Cookie 和 UA 在每日首次运行及配置的固定间隔到期时更新。
import { STORAGE_KEYS, storageGet, storageSet } from '../core/storage'
import { fetchSites, updateSite } from './site-manage'
import { ALARM, reconfigureAlarm } from '../core/alarms'
import { hostnameOf } from '../utils/url'

export interface CookieUaConfig {
  /** 每日首次打开/扩展启动时自动更新（推荐） */
  dailyFirstEnabled: boolean
  /** 按间隔定时更新 */
  intervalEnabled: boolean
  /** 定时间隔（分钟） */
  intervalMinutes: number
}

/** Cookie 和 UA 自动更新的可选间隔。 */
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
  { label: '30 天', value: 43200 },
] as const

const DEFAULT: CookieUaConfig = {
  dailyFirstEnabled: false,
  intervalEnabled: false,
  intervalMinutes: 360,
}

function normalizeIntervalMinutes(value?: number): number {
  const matched = COOKIE_UA_INTERVAL_PRESETS.find((item) => item.value === value)
  return matched?.value ?? DEFAULT.intervalMinutes
}

function todayKey(date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export async function loadCookieUaConfig(): Promise<CookieUaConfig> {
  const raw = await storageGet<Partial<CookieUaConfig>>(STORAGE_KEYS.COOKIE_UA_CONFIG)
  if (!raw) return { ...DEFAULT }
  return {
    dailyFirstEnabled: !!raw.dailyFirstEnabled,
    intervalEnabled: !!raw.intervalEnabled,
    intervalMinutes: normalizeIntervalMinutes(raw.intervalMinutes),
  }
}

export async function saveCookieUaConfig(cfg: CookieUaConfig): Promise<void> {
  const next: CookieUaConfig = {
    dailyFirstEnabled: !!cfg.dailyFirstEnabled,
    intervalEnabled: !!cfg.intervalEnabled,
    intervalMinutes: normalizeIntervalMinutes(cfg.intervalMinutes),
  }
  await storageSet(STORAGE_KEYS.COOKIE_UA_CONFIG, next)
  // 仅「定时更新」开关控制 alarm
  await reconfigureAlarm(ALARM.COOKIE_UA_UPDATE, next.intervalEnabled, next.intervalMinutes)
}

export async function shouldRunDailyCookieUaUpdate(): Promise<boolean> {
  const last = await storageGet<string>(STORAGE_KEYS.COOKIE_UA_LAST_DAILY)
  return last !== todayKey()
}

export async function markDailyCookieUaUpdated(): Promise<void> {
  await storageSet(STORAGE_KEYS.COOKIE_UA_LAST_DAILY, todayKey())
}

/** 读取某域下全部 Cookie，拼接为请求头格式字符串 */
function readCookieString(domain: string): Promise<string> {
  const host = hostnameOf(domain) || domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  return new Promise((resolve) => {
    chrome.cookies.getAll({ url: `https://${host}` }, (cookies) => {
      resolve((cookies ?? []).map((c) => `${c.name}=${c.value}`).join('; '))
    })
  })
}

/** 立即同步：遍历站点，将浏览器 Cookie/UA 覆盖到服务器，返回更新数量 */
export async function syncCookieUa(_reason: 'daily' | 'interval' | 'manual' = 'manual'): Promise<number> {
  const sites = await fetchSites()
  const ua = globalThis.navigator?.userAgent ?? ''
  let updated = 0
  for (const site of sites) {
    if (!site.domain) continue
    // 跳过禁用 / API 站点
    if (site.isDisabled || site.apikey || site.token) continue
    const cookie = await readCookieString(site.domain)
    if (!cookie) continue
    if (cookie === site.cookie && (!ua || ua === site.ua)) continue
    const result = await updateSite({ ...site, cookie, ua: ua || site.ua })
    if (result.ok) updated++
  }
  return updated
}

/** 每日首次：若开启且今日未跑过则同步 */
export async function runDailyCookieUaIfNeeded(): Promise<number | null> {
  const cfg = await loadCookieUaConfig()
  if (!cfg.dailyFirstEnabled) return null
  if (!(await shouldRunDailyCookieUaUpdate())) return null
  const n = await syncCookieUa('daily')
  await markDailyCookieUaUpdated()
  return n
}

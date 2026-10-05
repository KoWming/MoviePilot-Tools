import { storage, type StorageItemKey } from 'wxt/storage'
import { getPrivateStore, updatePrivateStore } from './private-vault'
import { STORE_KEYS, storeRepository, updatePublicStore } from './store-repository'
import type { PublicStoreV1 } from './storage-contracts'

export const STORAGE_KEYS = {
  THEME: 'virtual:ui.theme',
  CUSTOM_BG_CONFIG: 'virtual:ui.backgroundConfig',
  DAILY_WALLPAPER_ENABLED: 'virtual:ui.dailyWallpaperEnabled', LAST_DAILY_WALLPAPER_DATE: 'virtual:ui.lastDailyWallpaperDate',
  SITE_FILTERS: 'virtual:sites.filters', SITE_PRIVACY_MODE: 'virtual:sites.privacyMode',
  SITE_BLACKLIST: 'virtual:sites.blacklist',
  SITE_FAVICON_CACHE: 'virtual:sites.faviconCache', OCR_CORRECTIONS: 'virtual:ocr.corrections',
  OCR_MODELS: 'virtual:ocr.models', OCR_RUNTIME_META: 'virtual:ocr.runtimeMeta',
  OCR_LOCAL_ENABLED: 'virtual:ocr.localEnabled', AI_TOKEN: 'virtual:services.aiToken',
  WEBDAV_CONFIG: 'virtual:backup.webdav',
  MP_BACKUP_CONFIG: 'virtual:backup.mp', COOKIE_UA_CONFIG: 'virtual:automation.cookieUa',
  COOKIE_UA_LAST_DAILY: 'virtual:automation.cookieUaLastDaily', SITE_AUTO_OPEN_CONFIG: 'virtual:automation.siteAutoOpen',
  SITE_AUTO_OPEN_LAST_MONTH: 'virtual:automation.siteAutoOpenLastMonth', SITE_AUTO_OPEN_TABS: 'virtual:automation.siteAutoOpenTabs',
  WEB_EMBED_FEATURES: 'virtual:webEmbed', LAST_VIEW: 'virtual:navigation.lastView', PENDING_ROUTE: 'virtual:transient.pendingRoute',
  FILE_PICKER_VIEW: 'virtual:transient.filePickerView', PT_DOWNLOAD_TITLE: 'virtual:transient.ptDownloadTitle',
  FRONTEND_LATEST_CACHE: 'virtual:cache.frontendLatest', SOFTWARE_LATEST_CACHE: 'virtual:cache.softwareLatest',
  EXTENSION_LATEST_CACHE: 'virtual:cache.extensionLatest',
} as const

type VirtualKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS]
type AppStorageKey = StorageItemKey | VirtualKey
type Path = readonly string[]

const PUBLIC_PATHS: Partial<Record<VirtualKey, Path>> = {
  [STORAGE_KEYS.THEME]: ['ui', 'theme'], [STORAGE_KEYS.CUSTOM_BG_CONFIG]: ['settings', 'customBackground'],
  [STORAGE_KEYS.DAILY_WALLPAPER_ENABLED]: ['settings', 'dailyWallpaperEnabled'],
  [STORAGE_KEYS.LAST_DAILY_WALLPAPER_DATE]: ['settings', 'lastDailyWallpaperDate'],
  [STORAGE_KEYS.SITE_FILTERS]: ['settings', 'siteFilters'], [STORAGE_KEYS.SITE_PRIVACY_MODE]: ['settings', 'sitePrivacyMode'],
  [STORAGE_KEYS.SITE_BLACKLIST]: ['sites', 'blacklist'],
  [STORAGE_KEYS.SITE_FAVICON_CACHE]: ['settings', 'siteFaviconCache'], [STORAGE_KEYS.OCR_CORRECTIONS]: ['ocr', 'corrections'],
  [STORAGE_KEYS.OCR_MODELS]: ['settings', 'ocrModels'], [STORAGE_KEYS.OCR_RUNTIME_META]: ['settings', 'ocrRuntimeMeta'],
  [STORAGE_KEYS.OCR_LOCAL_ENABLED]: ['settings', 'ocrLocalEnabled'], [STORAGE_KEYS.MP_BACKUP_CONFIG]: ['backup', 'mp'],
  [STORAGE_KEYS.COOKIE_UA_CONFIG]: ['settings', 'cookieUaConfig'],
  [STORAGE_KEYS.COOKIE_UA_LAST_DAILY]: ['automation', 'cookieUaLastDaily'],
  [STORAGE_KEYS.SITE_AUTO_OPEN_CONFIG]: ['settings', 'siteAutoOpenConfig'],
  [STORAGE_KEYS.SITE_AUTO_OPEN_LAST_MONTH]: ['automation', 'siteAutoOpenLastMonth'],
  [STORAGE_KEYS.SITE_AUTO_OPEN_TABS]: ['settings', 'siteAutoOpenTabs'], [STORAGE_KEYS.WEB_EMBED_FEATURES]: ['webEmbed'],
  [STORAGE_KEYS.LAST_VIEW]: ['navigation', 'lastView'],
  [STORAGE_KEYS.PENDING_ROUTE]: ['transient', 'pendingRoute'], [STORAGE_KEYS.FILE_PICKER_VIEW]: ['transient', 'filePickerView'],
  [STORAGE_KEYS.PT_DOWNLOAD_TITLE]: ['transient', 'ptDownloadTitle'], [STORAGE_KEYS.WEBDAV_CONFIG]: ['backup', 'webdav'],
}

const CACHE_NAMES: Partial<Record<VirtualKey, string>> = {
  [STORAGE_KEYS.FRONTEND_LATEST_CACHE]: 'frontendLatest',
  [STORAGE_KEYS.SOFTWARE_LATEST_CACHE]: 'softwareLatest',
  [STORAGE_KEYS.EXTENSION_LATEST_CACHE]: 'extensionLatest',
}

function getPath(root: unknown, path: Path): unknown {
  let value = root
  for (const key of path) {
    if (!value || typeof value !== 'object') return undefined
    value = (value as Record<string, unknown>)[key]
  }
  return value
}

function setPath(root: Record<string, unknown>, path: Path, value: unknown): void {
  let cursor = root
  for (const key of path.slice(0, -1)) {
    const next = cursor[key]
    cursor[key] = next && typeof next === 'object' && !Array.isArray(next) ? next : {}
    cursor = cursor[key] as Record<string, unknown>
  }
  const last = path[path.length - 1]
  if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) delete cursor[last]
  else cursor[last] = value
}

export async function storageGet<T>(key: AppStorageKey): Promise<T | null> {
  const name = CACHE_NAMES[key as VirtualKey]
  if (name) return storeRepository.getCache<T>(name)
  const path = PUBLIC_PATHS[key as VirtualKey]
  if (path) return (getPath(await storeRepository.getPublicStore(), path) as T) ?? null
  if (key === STORAGE_KEYS.AI_TOKEN) return ((await getPrivateStore()).services?.aiToken as T) || null
  return null
}

export async function storageSet<T>(key: AppStorageKey, value: T): Promise<void> {
  const name = CACHE_NAMES[key as VirtualKey]
  if (name) return storeRepository.setCache(name, value)
  const path = PUBLIC_PATHS[key as VirtualKey]
  if (path) {
    await updatePublicStore((draft) => setPath(draft as unknown as Record<string, unknown>, path, value))
    return
  }
  if (key === STORAGE_KEYS.AI_TOKEN) {
    await updatePrivateStore((draft) => { draft.services = { ...(draft.services || {}), aiToken: String(value) } })
    return
  }
  throw new Error(`不允许写入已废弃存储字段：${key}`)
}

export async function storageRemove(key: AppStorageKey): Promise<void> {
  const name = CACHE_NAMES[key as VirtualKey]
  if (name) return storeRepository.removeCache(name)
  const path = PUBLIC_PATHS[key as VirtualKey]
  if (path) {
    await updatePublicStore((draft) => setPath(draft as unknown as Record<string, unknown>, path, undefined))
    return
  }
  if (key === STORAGE_KEYS.AI_TOKEN) {
    await updatePrivateStore((draft) => { if (draft.services) delete draft.services.aiToken })
  }
}

export function watchStorage<T>(key: AppStorageKey, cb: (newValue: T | null, oldValue: T | null) => void): () => void {
  const path = PUBLIC_PATHS[key as VirtualKey]
  if (!path) return () => undefined
  return storage.watch<PublicStoreV1>(STORE_KEYS.PUBLIC, (next, previous) => {
    const nextValue = (getPath(next, path) as T) ?? null
    const previousValue = (getPath(previous, path) as T) ?? null
    if (JSON.stringify(nextValue) !== JSON.stringify(previousValue)) cb(nextValue, previousValue)
  })
}

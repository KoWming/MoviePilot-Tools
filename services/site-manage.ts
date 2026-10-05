// 站点管理服务：站点 CRUD、Cookie/UA 差异检测、浏览器↔服务器同步、筛选行构建
import { api } from '../core/http'
import { fetchSupportingSites } from './site-supporting'
import type { SiteFilterKey } from '../core/storage-contracts'
import type {
  BrowserSessionInfo,
  Site,
  SiteRow,
  SiteStatus,
  SiteSupportingInfo,
} from '../core/types'

import { getPublicStore, updatePublicStore } from '../core/store-repository'
import { getPrivateStore, updatePrivateStore } from '../core/private-vault'

import {
  getDomainCookies,
  setDomainCookies,
  clearDomainCookies,
  parseCookies,
  normalizeCookies,
  siteKeyOf,
  expandDomainKeys,
  sessionForHost,
  hasConfiguredCookieNameMatch,
  filterMeaningfulCookies,
  isAuthCookieName,
  type BrowserSessionMap,
  type SetCookieResult,
} from '../utils/cookie'

function unwrapSites(data: unknown): Site[] {
  if (Array.isArray(data)) return data as Site[]
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    if (Array.isArray(obj.data)) return obj.data as Site[]
    if (Array.isArray(obj.items)) return obj.items as Site[]
  }
  return []
}

export async function loadStoredSites(): Promise<Site[]> {
  const sites = (await getPrivateStore()).sites
  return Array.isArray(sites) ? sites : []
}

async function saveStoredSites(sites: Site[]): Promise<void> {
  await updatePrivateStore((draft) => {
    draft.sites = Array.isArray(sites) ? sites : []
  })
}

export async function fetchSites(): Promise<Site[]> {
  const res = await api.get<unknown>('/api/v1/site/')
  if (res.ok) {
    const sites = unwrapSites(res.data)
    await saveStoredSites(sites)
    return sites
  }
  return loadStoredSites()
}

/** MP API 业务结果：HTTP 200 仍可能 { success:false, message } */
export interface SiteApiOutcome {
  ok: boolean
  message?: string
}

function readApiMessage(data: unknown): string {
  if (!data || typeof data !== 'object') return ''
  const m = (data as { message?: unknown }).message
  return typeof m === 'string' ? m.trim() : ''
}

/** HTTP 成功且未显式 success:false 才算业务成功 */
function siteMutationOutcome(res: { ok: boolean; data: unknown }): SiteApiOutcome {
  if (!res.ok) {
    return {
      ok: false,
      message: readApiMessage(res.data) || '请求失败',
    }
  }
  const body = res.data
  if (body && typeof body === 'object' && 'success' in body) {
    const success = (body as { success?: unknown }).success
    if (success === false) {
      return {
        ok: false,
        message: readApiMessage(body) || '操作失败',
      }
    }
  }
  return { ok: true, message: readApiMessage(body) || undefined }
}

export async function updateSite(site: Site): Promise<SiteApiOutcome> {
  // 更新站点使用 `PUT /api/v1/site/`，站点 ID 放在请求体中。
  const res = await api.put('/api/v1/site/', site)
  return siteMutationOutcome(res)
}

export async function createSite(site: Omit<Site, 'id'>): Promise<SiteApiOutcome> {
  const res = await api.post('/api/v1/site/', site)
  return siteMutationOutcome(res)
}

export async function deleteSite(id: number): Promise<SiteApiOutcome> {
  const res = await api.del(`/api/v1/site/${id}`)
  return siteMutationOutcome(res)
}

export async function fetchSupporting(force = false): Promise<Record<string, SiteSupportingInfo>> {
  return fetchSupportingSites(force)
}

// Cookie 与 UA 差异检测
export function hasCookieDiff(serverCookie?: string, browserCookie?: string): boolean {
  const s = serverCookie?.trim() ?? ''
  const b = browserCookie?.trim() ?? ''
  if (!s && !b) return false
  if (!s || !b) return true

  const sm = filterMeaningfulCookies(normalizeCookies(s))
  const bm = filterMeaningfulCookies(normalizeCookies(b))

  if (!sm.size && !bm.size) return false
  if (!sm.size || !bm.size) return true

  // 服务端配置的所有有效项在浏览器中必须存在且值一致
  for (const [k, v] of sm) {
    if (bm.get(k) !== v) return true
  }

  // 检查浏览器多出的项中是否包含鉴权类 Cookie（忽略前端偏好或非鉴权键）
  for (const [k] of bm) {
    if (!sm.has(k) && isAuthCookieName(k)) return true
  }

  return false
}

export function hasUADiff(serverUA?: string, browserUA?: string): boolean {
  const s = (serverUA ?? '').trim()
  const b = (browserUA ?? '').trim()
  if (!s && !b) return false
  return s !== b
}

// 站点筛选：两基座 S/C 与七筛 OR

export type { SiteFilterKey } from '../core/storage-contracts'

export const SITE_FILTER_KEYS: SiteFilterKey[] = [
  'browser',
  'server',
  'cookieDiff',
  'uaDiff',
  'notLoggedIn',
  'notAdded',
  'notOwned',
]

/** 默认：CK/UA 差异 + 未登录 */
export const DEFAULT_SITE_FILTERS: Record<SiteFilterKey, boolean> = {
  browser: false,
  server: false,
  cookieDiff: true,
  uaDiff: true,
  notLoggedIn: true,
  notAdded: false,
  notOwned: false,
}

export function isApiSite(s: Pick<Site, 'apikey' | 'token'> | undefined | null): boolean {
  if (!s) return false
  return !!(s.apikey || s.token)
}

/** supporting 域名集合（siteKey 规范化） */
export function supportingKeySet(
  supporting: SupportingDict,
): Set<string> {
  const set = new Set<string>()
  for (const raw of Object.keys(supporting || {})) {
    const k = siteKeyOf(raw)
    if (k) set.add(k)
  }
  return set
}

/** 将原始 domain 匹配到已适配 S 的 canonical key */
export function matchSupportingDomain(
  domain: string,
  supportingKeys: Set<string>,
): string | null {
  const d = siteKeyOf(domain)
  if (!d) return null
  if (supportingKeys.has(d)) return d
  // 子域 → 父域抬升（勿 tracker 子域乱抬：仅当父域明确在 S 中）
  const parts = d.split('.')
  for (let i = 1; i < parts.length - 1; i++) {
    const parent = parts.slice(i).join('.')
    if (supportingKeys.has(parent)) return parent
  }
  return null
}

/** 已配置覆盖键：domain + url host + www 变体 */
export function buildConfiguredKeySet(sites: Site[]): Set<string> {
  const set = new Set<string>()
  for (const s of sites) {
    for (const k of expandDomainKeys(s.domain)) set.add(k)
    for (const k of expandDomainKeys(s.url)) set.add(k)
  }
  return set
}

export function isConfiguredKey(key: string, configured: Set<string>): boolean {
  const k = siteKeyOf(key)
  if (!k) return false
  if (configured.has(k) || configured.has(`www.${k}`)) return true
  const naked = k.startsWith('www.') ? k.slice(4) : k
  if (configured.has(naked) || configured.has(`www.${naked}`)) return true
  // 父域和子域命中同一 supporting 站点时视为已覆盖。
  for (const c of configured) {
    const ck = siteKeyOf(c)
    if (!ck) continue
    if (k === ck || k.endsWith(`.${ck}`) || ck.endsWith(`.${k}`)) return true
  }
  return false
}

export type SupportingDict = Record<string, SiteSupportingInfo>

const EMPTY_SESSION: BrowserSessionInfo = {
  cookieHeader: '',
  names: [],
  hasAuthSession: false,
  hasTrace: false,
}

/** 已配置覆盖：host + supporting 身份 id/name */
export function buildConfiguredCoverage(
  sites: Site[],
  supportingKeys: Set<string>,
  supporting: SupportingDict,
): { hosts: Set<string>; ids: Set<number | string>; names: Set<string> } {
  const hosts = buildConfiguredKeySet(sites)
  const ids = new Set<number | string>()
  const names = new Set<string>()
  for (const s of sites) {
    if (s.id != null && s.id > 0) ids.add(s.id)
    if (s.name) names.add(s.name.trim().toLowerCase())
    const matched =
      matchSupportingDomain(s.domain || '', supportingKeys) ||
      matchSupportingDomain(s.url || '', supportingKeys)
    if (!matched) continue
    for (const k of expandDomainKeys(matched)) hosts.add(k)
    const det = supportingInfoOf(matched, supporting)
    if (det.id != null) ids.add(det.id)
    if (det.name) names.add(det.name.trim().toLowerCase())
    for (const k of expandDomainKeys(det.url)) hosts.add(k)
  }
  return { hosts, ids, names }
}

export function isSupportingCovered(
  domainKey: string,
  supporting: SupportingDict,
  coverage: { hosts: Set<string>; ids: Set<number | string>; names: Set<string> },
): boolean {
  if (isConfiguredKey(domainKey, coverage.hosts)) return true
  const info = supportingInfoOf(domainKey, supporting)
  if (info.id != null && coverage.ids.has(info.id)) return true
  if (info.name && coverage.names.has(info.name.trim().toLowerCase())) return true
  if (info.url && isConfiguredKey(info.url, coverage.hosts)) return true
  return false
}

function mergeSession(a: BrowserSessionInfo, b: BrowserSessionInfo): BrowserSessionInfo {
  const names = [...a.names, ...b.names]
  const cookieHeader = [a.cookieHeader, b.cookieHeader].filter(Boolean).join('; ')
  const hasAuthSession = a.hasAuthSession || b.hasAuthSession
  return {
    cookieHeader,
    names,
    hasAuthSession,
    hasTrace: hasAuthSession || a.hasTrace || b.hasTrace,
  }
}

/** 已配置站：domain / url / supporting 域 多通道取会话 */
function sessionForConfigured(
  site: Site,
  supportingKeys: Set<string>,
  supporting: SupportingDict,
  browserMap: BrowserSessionMap,
): BrowserSessionInfo {
  let session = EMPTY_SESSION
  const candidates = new Set<string>()
  const d = siteKeyOf(site.domain)
  const u = siteKeyOf(site.url)
  if (d) candidates.add(d)
  if (u) candidates.add(u)
  const matched =
    matchSupportingDomain(site.domain || '', supportingKeys) ||
    matchSupportingDomain(site.url || '', supportingKeys)
  if (matched) {
    candidates.add(matched)
    const su = siteKeyOf(supportingInfoOf(matched, supporting).url)
    if (su) candidates.add(su)
  }
  for (const h of candidates) {
    session = mergeSession(session, sessionForHost(browserMap, h))
    if (session.hasAuthSession) break
  }
  return session
}

/**
 * 按已适配键聚合浏览器鉴权会话。
 * 子域 Cookie 能 match 到 supporting 父域时，必须并入该键。
 */
function buildSupportingSessionMap(
  sKeys: Set<string>,
  supporting: SupportingDict,
  browserMap: BrowserSessionMap,
): Map<string, BrowserSessionInfo> {
  const map = new Map<string, BrowserSessionInfo>()
  for (const key of sKeys) {
    let session = sessionForHost(browserMap, key)
    const urlHost = siteKeyOf(supportingInfoOf(key, supporting).url)
    if (urlHost && urlHost !== key) {
      session = mergeSession(session, sessionForHost(browserMap, urlHost))
    }
    map.set(key, session)
  }
  for (const [cookieDomain, info] of browserMap) {
    if (!info.hasAuthSession) continue
    const matched = matchSupportingDomain(cookieDomain, sKeys)
    if (!matched) continue
    const prev = map.get(matched) || EMPTY_SESSION
    map.set(matched, mergeSession(prev, info))
  }
  return map
}

function emptyFlags(): SiteStatus {
  return {
    browser: false,
    server: false,
    cookieDiff: false,
    uaDiff: false,
    notLoggedIn: false,
    notAdded: false,
    notOwned: false,
  }
}

/** 计算单行七筛标签（可并存） */
export function evalSiteFlags(input: {
  inConfigured: boolean
  supported: boolean
  isApi: boolean
  hasAuthSession: boolean
  serverCookie?: string
  serverUA?: string
  browserCookie?: string
  browserUA?: string
}): SiteStatus {
  const {
    inConfigured,
    supported,
    isApi,
    hasAuthSession,
    serverCookie,
    serverUA,
    browserCookie,
    browserUA,
  } = input
  const flags = emptyFlags()
  // 浏览器 = S ∩ 有效鉴权会话（B1）
  flags.browser = supported && hasAuthSession
  // 服务器 = C
  flags.server = inConfigured
  if (inConfigured) {
    // 未登录：已配置、非 API、无鉴权会话（此时 CK/UA 差异必然存在，不单独标）
    flags.notLoggedIn = !isApi && !hasAuthSession
    flags.cookieDiff =
      !isApi && !flags.notLoggedIn && hasCookieDiff(serverCookie, browserCookie)
    flags.uaDiff = !flags.notLoggedIn && hasUADiff(serverUA, browserUA)
    flags.notAdded = false
    flags.notOwned = false
  } else {
    // S−C
    flags.notOwned = supported
    flags.notAdded = supported && hasAuthSession
    flags.cookieDiff = false
    flags.uaDiff = false
    flags.notLoggedIn = false
  }
  return flags
}

function supportingInfoOf(
  key: string,
  supporting: SupportingDict,
): SiteSupportingInfo {
  // 原始表可能以未规范化 domain 为 key
  let det = supporting[key]
  if (!det) {
    for (const [raw, v] of Object.entries(supporting)) {
      if (siteKeyOf(raw) === key) {
        det = v
        break
      }
    }
  }
  return {
    id: det?.id,
    name: det?.name,
    domain: key,
    url: det?.url || `https://${key}`,
  }
}

function makeConfiguredRow(
  site: Site,
  supportingKeys: Set<string>,
  supporting: SupportingDict,
  session: BrowserSessionInfo,
  browserUA: string,
): SiteRow {
  const matched =
    matchSupportingDomain(site.domain || '', supportingKeys) ||
    matchSupportingDomain(site.url || '', supportingKeys)
  const domainKey =
    matched || siteKeyOf(site.domain) || siteKeyOf(site.url) || String(site.id)
  // supporting 未加载时视为已适配，避免全量 browser=false
  const supported = supportingKeys.size === 0 ? true : !!matched
  const api = isApiSite(site)
  const hasAuthSession =
    session.hasAuthSession || hasConfiguredCookieNameMatch(site.cookie, session.cookieHeader)
  const flags = evalSiteFlags({
    inConfigured: true,
    supported,
    isApi: api,
    hasAuthSession,
    serverCookie: site.cookie,
    serverUA: site.ua,
    browserCookie: session.cookieHeader,
    browserUA,
  })
  // 回写运行态，供表单/按钮复用
  site.browserCookies = session.cookieHeader
  site.cookieDiff = flags.cookieDiff
  site.uaDiff = flags.uaDiff
  site.status = flags
  return {
    key: `c:${site.id}:${domainKey}`,
    kind: 'configured',
    supported,
    supporting: matched ? supportingInfoOf(matched, supporting) : undefined,
    site,
    browserCookie: session.cookieHeader,
    browserUA,
    hasAuthSession,
    hasTrace: hasAuthSession || session.hasTrace,
    flags,
  }
}

function makeVirtualRow(
  domainKey: string,
  supporting: SupportingDict,
  session: BrowserSessionInfo,
  browserUA: string,
): SiteRow {
  const info = supportingInfoOf(domainKey, supporting)
  const flags = evalSiteFlags({
    inConfigured: false,
    supported: true,
    isApi: false,
    hasAuthSession: session.hasAuthSession,
    browserCookie: session.cookieHeader,
    browserUA,
  })
  const virtualSite: Site = {
    id: 0,
    name: info.name || domainKey,
    domain: domainKey,
    url: info.url || `https://${domainKey}`,
    icon: '',
    pri: 0,
    timeout: 30,
    downloader: '',
    cookie: '',
    ua: '',
    is_active: true,
    is_limited: false,
    is_proxy: false,
    is_browser_simulated: false,
    lst_state: 'unknown',
    browserCookies: session.cookieHeader,
    cookieDiff: false,
    uaDiff: false,
    isDisabled: false,
    isUpdateDisabled: false,
    status: flags,
  }
  return {
    key: `v:${domainKey}`,
    kind: 'virtual',
    supported: true,
    supporting: info,
    site: virtualSite,
    browserCookie: session.cookieHeader,
    browserUA,
    hasAuthSession: session.hasAuthSession,
    hasTrace: session.hasTrace,
    flags,
  }
}

/**
 * 构建统一站点行。
 * - L0：全部已配置 C
 * - 虚拟未添加：(S−C) ∩ 鉴权会话（始终并入）
 * - 虚拟未拥有：expandNotOwned 时并入剩余 S−C（无鉴权会话）
 *
 * 未添加 ⊂ 未拥有；未拥有 = S−C；未添加 = (S−C) ∩ 有效鉴权会话
 */
export function buildSiteRows(input: {
  configured: Site[]
  supporting: SupportingDict
  browserMap: BrowserSessionMap
  browserUA?: string
  expandNotOwned?: boolean
}): SiteRow[] {
  const {
    configured,
    supporting,
    browserMap,
    browserUA = typeof navigator !== 'undefined' ? navigator.userAgent : '',
    expandNotOwned = false,
  } = input
  const sKeys = supportingKeySet(supporting)
  const coverage = buildConfiguredCoverage(configured, sKeys, supporting)
  const sessionByS = buildSupportingSessionMap(sKeys, supporting, browserMap)
  const rows: SiteRow[] = []
  const virtualSeen = new Set<string>()

  for (const site of configured) {
    const session = sessionForConfigured(site, sKeys, supporting, browserMap)
    rows.push(makeConfiguredRow(site, sKeys, supporting, session, browserUA))
  }

  // (S−C) ∩ 鉴权会话 → 未添加虚拟行（始终构建）
  for (const key of sKeys) {
    if (isSupportingCovered(key, supporting, coverage)) continue
    const session = sessionByS.get(key) || EMPTY_SESSION
    if (!session.hasAuthSession) continue
    if (virtualSeen.has(key)) continue
    virtualSeen.add(key)
    rows.push(makeVirtualRow(key, supporting, session, browserUA))
  }

  // 未拥有懒展开：其余 S−C
  if (expandNotOwned) {
    for (const key of sKeys) {
      if (virtualSeen.has(key)) continue
      if (isSupportingCovered(key, supporting, coverage)) continue
      virtualSeen.add(key)
      const session = sessionByS.get(key) || EMPTY_SESSION
      rows.push(makeVirtualRow(key, supporting, session, browserUA))
    }
  }

  return rows
}

/** 七筛 OR：无勾选则返回全部（含已构建的虚拟行） */
export function applySiteFilters(
  rows: SiteRow[],
  filters: Record<SiteFilterKey, boolean>,
): SiteRow[] {
  const active = SITE_FILTER_KEYS.filter((k) => filters[k])
  if (!active.length) return rows
  return rows.filter((row) => active.some((k) => row.flags[k]))
}

/** 读取对象或激活键数组格式；遇到 `noSite` 时转换为 `notOwned`。 */
export function migrateSiteFilters(raw: unknown): Record<SiteFilterKey, boolean> {
  const out: Record<SiteFilterKey, boolean> = { ...DEFAULT_SITE_FILTERS }
  if (Array.isArray(raw)) {
    for (const k of SITE_FILTER_KEYS) out[k] = false
    for (const item of raw) {
      if (item === 'noSite') out.notOwned = true
      else if (SITE_FILTER_KEYS.includes(item as SiteFilterKey)) {
        out[item as SiteFilterKey] = true
      }
    }
    return out
  }
  if (!raw || typeof raw !== 'object') return out
  const obj = raw as Record<string, unknown>
  for (const k of SITE_FILTER_KEYS) {
    if (typeof obj[k] === 'boolean') out[k] = obj[k] as boolean
  }
  if (typeof obj.noSite === 'boolean' && typeof obj.notOwned !== 'boolean') {
    out.notOwned = obj.noSite as boolean
  }
  return out
}

// 浏览器与服务器同步
/** 将服务器 Cookie 覆盖写入浏览器 */
export async function overwriteSiteCookie(site: Site): Promise<SetCookieResult> {
  if (!site.cookie || !site.url) return { ok: false, failed: [] }
  return setDomainCookies(site.url, parseCookies(site.cookie))
}

/** 将浏览器 Cookie/UA 同步（更新）到服务器 */
export async function syncSiteToServer(site: Site): Promise<SiteApiOutcome> {
  const browserUA = globalThis.navigator?.userAgent ?? ''
  const isApi = !!(site.apikey || site.token)
  let cookie = site.browserCookies?.trim()
  if (!cookie) {
    cookie = await getDomainCookies(site.url || site.domain || '')
  }
  const updateData: Site = isApi
    ? { ...site, ua: browserUA || site.ua }
    : { ...site, cookie: cookie || site.cookie, ua: browserUA || site.ua }
  return updateSite(updateData)
}

/** 删除浏览器中该站点的全部 Cookie */
export async function clearSiteBrowserCookie(site: Site): Promise<number> {
  if (!site.url) return 0
  return clearDomainCookies(site.url)
}

/** 测试站点连接 */
export async function testConnection(site: Site): Promise<boolean> {
  if (!site.id) return false
  const res = await api.get<{ success?: boolean; message?: string }>(
    `/api/v1/site/test/${site.id}`,
  )
  return res.ok && (res.data?.success ?? false)
}

// 禁用状态持久化
function siteStateId(site: Site): number | null {
  return typeof site.id === 'number' ? site.id : null
}

export async function loadDisableState(site: Site): Promise<boolean> {
  const id = siteStateId(site)
  return id !== null && ((await getPublicStore()).sites?.disabledIds || []).includes(id)
}
export async function saveDisableState(site: Site, value: boolean): Promise<void> {
  const id = siteStateId(site)
  if (id === null) return
  await updatePublicStore((draft) => {
    const ids = new Set(draft.sites?.disabledIds || [])
    if (value) ids.add(id)
    else ids.delete(id)
    draft.sites = { ...(draft.sites || {}), disabledIds: [...ids] }
  })
}
export async function loadUpdateDisableState(site: Site): Promise<boolean> {
  const id = siteStateId(site)
  return id !== null && ((await getPublicStore()).sites?.autoUpdateDisabledIds || []).includes(id)
}
export async function saveUpdateDisableState(site: Site, value: boolean): Promise<void> {
  const id = siteStateId(site)
  if (id === null) return
  await updatePublicStore((draft) => {
    const ids = new Set(draft.sites?.autoUpdateDisabledIds || [])
    if (value) ids.add(id)
    else ids.delete(id)
    draft.sites = { ...(draft.sites || {}), autoUpdateDisabledIds: [...ids] }
  })
}

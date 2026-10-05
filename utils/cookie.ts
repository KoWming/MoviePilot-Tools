// 浏览器 Cookie 读写封装（content script / popup 上下文）
import { hostnameOf } from './url'
import type { BrowserSessionInfo } from '../core/types'

/** 读取指定域下某名称的 Cookie 值 */
export async function getCookie(domain: string, name: string): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.cookies.get({ url: normalizeUrl(domain), name }, (cookie) => {
      resolve(cookie?.value ?? null)
    })
  })
}

/** 设置 Cookie（会话级） */
export async function setCookie(
  domain: string,
  name: string,
  value: string,
): Promise<void> {
  return new Promise((resolve) => {
    chrome.cookies.set({ url: normalizeUrl(domain), name, value }, () => resolve())
  })
}

/** 删除 Cookie */
export async function removeCookie(domain: string, name: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.cookies.remove({ url: normalizeUrl(domain), name }, () => resolve())
  })
}

function normalizeUrl(domain: string): string {
  const d = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  return `https://${d}`
}

/** 读取某 URL 或主机名下全部 Cookie，自动结合 URL 与 Host 规则覆盖父级根域，拼接为请求头格式字符串 */
export async function getDomainCookies(url: string): Promise<string> {
  const trimmed = (url || '').trim()
  if (!trimmed) return ''
  const host = hostnameOf(trimmed) || trimmed.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
  if (!host) return ''

  const targetUrl = trimmed.startsWith('http://') || trimmed.startsWith('https://')
    ? trimmed
    : `https://${host}/`

  const [fromUrl, fromDomain] = await Promise.all([
    new Promise<chrome.cookies.Cookie[]>((resolve) => {
      try {
        if (!chrome?.cookies?.getAll) return resolve([])
        chrome.cookies.getAll({ url: targetUrl }, (c) => resolve(c ?? []))
      } catch {
        resolve([])
      }
    }),
    new Promise<chrome.cookies.Cookie[]>((resolve) => {
      try {
        if (!chrome?.cookies?.getAll) return resolve([])
        chrome.cookies.getAll({ domain: host }, (c) => resolve(c ?? []))
      } catch {
        resolve([])
      }
    }),
  ])

  const map = new Map<string, string>()
  for (const c of fromDomain) {
    if (c.name && c.value !== undefined) map.set(c.name, c.value)
  }
  for (const c of fromUrl) {
    if (c.name && c.value !== undefined) map.set(c.name, c.value)
  }

  return [...map.entries()].map(([k, v]) => `${k}=${v}`).join('; ')
}

/** 写入结果：是否全部成功 + 失败项名称（用于精确反馈） */
export interface SetCookieResult {
  ok: boolean
  failed: string[]
}

/**
 * 将服务端 Cookie 精确覆盖写入浏览器对应 host。
 * 服务端仅提供 Cookie 请求头，不含 Domain/Path 等 Set-Cookie 元数据，因此统一写为 host-only、path=/，
 * 确保站点自身未带 Domain 的退出响应能够正常删除登录 Cookie。
 */
export async function setDomainCookies(
  url: string,
  cookies: Record<string, string>,
): Promise<SetCookieResult> {
  const host = hostnameOf(url)
  if (!host) return { ok: false, failed: Object.keys(cookies) }
  const targetNames = Object.keys(cookies)
  if (!targetNames.length) return { ok: true, failed: [] }

  const setUrl = `https://${host}/`
  const existing = await new Promise<chrome.cookies.Cookie[]>((resolve) =>
    chrome.cookies.getAll({ domain: host }, (c) => resolve(c ?? [])),
  )
  const failed = new Set<string>()

  // 删除会作用于目标 host 的全部同名 Domain/host-only/path 变体，避免浏览器同时发送重复登录 Cookie。
  const toRemove = existing.filter(
    (c) => targetNames.includes(c.name) && cookieDomainMatchesHost(c.domain, host),
  )
  for (const c of toRemove) {
    const cookieHost = c.domain.replace(/^\./, '')
    const removeUrl = `${c.secure ? 'https' : 'http'}://${cookieHost}${c.path || '/'}`
    const removed = await new Promise<boolean>((resolve) => {
      chrome.cookies.remove(
        { url: removeUrl, name: c.name, storeId: c.storeId },
        (details) => resolve(!chrome.runtime.lastError && !!details),
      )
    })
    if (!removed) failed.add(c.name)
  }

  // 默认有效期 15 天（秒），使覆盖的登录态跨浏览器重启保留。
  const now = Math.floor(Date.now() / 1000)
  const defaultExpiry = now + 15 * 24 * 60 * 60
  for (const name of targetNames) {
    const prev = existing.find(
      (c) =>
        c.name === name &&
        c.hostOnly &&
        c.domain.toLowerCase() === host.toLowerCase() &&
        c.path === '/',
    )
    const opts: chrome.cookies.SetDetails = {
      url: setUrl,
      name,
      value: cookies[name] ?? '',
      path: '/',
      secure: true,
      expirationDate:
        prev?.expirationDate && prev.expirationDate > now
          ? prev.expirationDate
          : defaultExpiry,
    }
    if (prev?.sameSite) opts.sameSite = prev.sameSite
    if (prev?.storeId) opts.storeId = prev.storeId

    const setOk = await new Promise<boolean>((resolve) =>
      chrome.cookies.set(opts, (cookie) =>
        resolve(
          !chrome.runtime.lastError &&
            !!cookie &&
            cookie.hostOnly &&
            cookie.domain.toLowerCase() === host.toLowerCase() &&
            cookie.path === '/',
        ),
      ),
    )
    if (!setOk) failed.add(name)
  }

  // 直接按 Cookie 元数据回读，确保每个名称仅剩一个可作用于目标 URL 的 host-only 根路径 Cookie。
  const actual = await new Promise<chrome.cookies.Cookie[]>((resolve) =>
    chrome.cookies.getAll({ url: setUrl }, (c) => resolve(c ?? [])),
  )
  for (const name of targetNames) {
    const matched = actual.filter((c) => c.name === name)
    const valid = matched.filter(
      (c) =>
        c.value === cookies[name] &&
        c.hostOnly &&
        c.domain.toLowerCase() === host.toLowerCase() &&
        c.path === '/',
    )
    if (matched.length !== 1 || valid.length !== 1) failed.add(name)
  }
  return { ok: failed.size === 0, failed: [...failed] }
}

/** 删除某 URL 主机名下全部 Cookie，返回删除数量 */
export async function clearDomainCookies(url: string): Promise<number> {
  const host = hostnameOf(url)
  if (!host) return 0
  const existing = await new Promise<chrome.cookies.Cookie[]>((resolve) =>
    chrome.cookies.getAll({ domain: host }, (c) => resolve(c ?? [])),
  )
  let n = 0
  for (const c of existing) {
    const d = c.domain.replace(/^\./, '')
    const u = `${c.secure ? 'https' : 'http'}://${d}${c.path || '/'}`
    await new Promise<void>((resolve) =>
      chrome.cookies.remove({ url: u, name: c.name }, () => resolve()),
    )
    n++
  }
  return n
}

/** Cookie 字符串解析为键值对 */
export function parseCookies(str: string): Record<string, string> {
  const out: Record<string, string> = {}
  if (!str) return out
  for (const part of str.split(';')) {
    const t = part.trim()
    const i = t.indexOf('=')
    if (i > 0) {
      const name = t.slice(0, i).trim()
      if (name) out[name] = t.slice(i + 1).trim()
    }
  }
  return out
}

/** 规范化 Cookie 字符串为 Map（忽略空格/换行/顺序差异） */
export function normalizeCookies(str: string): Map<string, string> {
  const m = new Map<string, string>()
  if (!str) return m
  for (const part of str.split(/[;\n]/)) {
    const t = part.trim()
    if (!t) continue
    const i = t.indexOf('=')
    if (i <= 0) continue
    const name = t.slice(0, i).trim()
    if (name) m.set(name, t.slice(i + 1).trim())
  }
  return m
}

// 鉴权会话与站点域名匹配

/** CDN / 统计 / 偏好类 Cookie，不构成登录会话且不应造成 CK 差异误报 */
const NOISE_COOKIE_RE =
  /^(cf_clearance|__cf_bm|__cflb|__cfduid|_ga|_gid|_gat|_gcl_|_fbp|_ym_|_hj|AMP_TOKEN|__utm|utm_|NID|IDE|fr$|^hm_lvt_|^hm_lpvt_|^_clck|^_clsk|^theme$|^skin$|^lang$|^language$|^locale$|^sidebar_)/i

/** 鉴权类 Cookie 名 */
const AUTH_COOKIE_RE =
  /^(c_secure_|uid$|pass$|auth|session|sess|token|jwt|sid$|login|passport|PHPSESS|laravel_session|JSESSIONID|ASP\.NET_SessionId|remember|user|member|passkey|key$)/i

/** 主机名规范化：小写、去端口、去前导 www. */
export function siteKeyOf(input?: string): string {
  if (!input) return ''
  let s = input.trim().toLowerCase()
  if (!s) return ''
  if (s.includes('://') || s.includes('/')) {
    s = hostnameOf(s) || s
  }
  s = s.replace(/^\.+/, '').replace(/:\d+$/, '')
  if (s.startsWith('www.')) s = s.slice(4)
  return s
}

/** 登记 domain / url host / www 变体，用于已配置覆盖集 */
export function expandDomainKeys(input?: string): string[] {
  const base = siteKeyOf(input)
  if (!base) return []
  const keys = new Set<string>([base, `www.${base}`])
  // 保留带 www 输入时的裸域已覆盖
  return [...keys]
}

/** cookie.domain（可带点）是否覆盖目标 host：相等或 host 为 cookie 域的子域 */
export function cookieDomainMatchesHost(cookieDomain: string, host: string): boolean {
  const cd = (cookieDomain || '').replace(/^\./, '').toLowerCase()
  const h = siteKeyOf(host) || host.toLowerCase().replace(/^\./, '')
  if (!cd || !h) return false
  if (cd === h) return true
  // 父域 Cookie → 子域 host
  if (h.endsWith(`.${cd}`)) return true
  // www ↔ 裸域
  if (cd === `www.${h}` || h === `www.${cd}`) return true
  const nakedCd = cd.startsWith('www.') ? cd.slice(4) : cd
  const nakedH = h.startsWith('www.') ? h.slice(4) : h
  if (nakedCd === nakedH) return true
  if (nakedH.endsWith(`.${nakedCd}`)) return true
  return false
}

export function isNoiseCookieName(name: string): boolean {
  return NOISE_COOKIE_RE.test(name.trim())
}

/** 过滤掉纯噪声/统计类 Cookie */
export function filterMeaningfulCookies(map: Map<string, string>): Map<string, string> {
  const result = new Map<string, string>()
  for (const [k, v] of map) {
    if (!isNoiseCookieName(k)) {
      result.set(k, v)
    }
  }
  return result
}

export function isAuthCookieName(name: string): boolean {
  const n = name.trim()
  if (!n || isNoiseCookieName(n)) return false
  return AUTH_COOKIE_RE.test(n)
}

/** Cookie 头字符串是否含鉴权类 Cookie */
export function hasValidBrowserSession(cookieHeader?: string): boolean {
  if (!cookieHeader?.trim()) return false
  for (const name of normalizeCookies(cookieHeader).keys()) {
    if (isAuthCookieName(name)) return true
  }
  return false
}

/**
 * 浏览器与 MP 已配置 Cookie 是否存在同名、非噪声项。
 * 部分站点使用自定义或哈希 Cookie 名，无法仅靠通用 AUTH_COOKIE_RE 判断。
 */
export function hasConfiguredCookieNameMatch(
  serverCookie?: string,
  browserCookie?: string,
): boolean {
  const serverNames = new Set(
    [...normalizeCookies(serverCookie || '').keys()].filter((name) => !isNoiseCookieName(name)),
  )
  if (!serverNames.size) return false
  for (const name of normalizeCookies(browserCookie || '').keys()) {
    if (!isNoiseCookieName(name) && serverNames.has(name)) return true
  }
  return false
}

/** 任意非空 Cookie 痕迹（B2）；B1 请用 hasValidBrowserSession */
export function hasBrowserTrace(cookieHeader?: string): boolean {
  return normalizeCookies(cookieHeader || '').size > 0
}

export type BrowserSessionMap = Map<string, BrowserSessionInfo>

/**
 * 将 chrome.cookies 列表归并为 domainKey → 会话信息。
 * key 使用去点、小写后的 cookie.domain；查询时用 cookieDomainMatchesHost。
 */
export function buildBrowserCookieMap(
  cookies: Array<{ domain?: string; name?: string; value?: string }>,
): BrowserSessionMap {
  // raw domain（去点）→ names/values
  const byDomain = new Map<string, { names: string[]; parts: string[] }>()
  for (const c of cookies) {
    const raw = (c.domain || '').replace(/^\./, '').toLowerCase()
    if (!raw || !raw.includes('.')) continue
    const name = (c.name || '').trim()
    if (!name) continue
    const value = c.value ?? ''
    let bucket = byDomain.get(raw)
    if (!bucket) {
      bucket = { names: [], parts: [] }
      byDomain.set(raw, bucket)
    }
    bucket.names.push(name)
    bucket.parts.push(`${name}=${value}`)
  }

  const map: BrowserSessionMap = new Map()
  for (const [domain, { names, parts }] of byDomain) {
    const cookieHeader = parts.join('; ')
    const hasAuth = names.some(isAuthCookieName)
    map.set(domain, {
      cookieHeader,
      names,
      hasAuthSession: hasAuth,
      // 浏览器筛选使用有效鉴权会话作为 B1 判定依据。
      hasTrace: hasAuth,
    })
  }
  return map
}

/** 按 host 聚合所有匹配父/子域 Cookie 头与鉴权标记 */
export function sessionForHost(map: BrowserSessionMap, host: string): BrowserSessionInfo {
  const h = siteKeyOf(host)
  if (!h) {
    return { cookieHeader: '', names: [], hasAuthSession: false, hasTrace: false }
  }
  const names: string[] = []
  const parts: string[] = []
  let hasAuth = false
  for (const [domain, info] of map) {
    if (!cookieDomainMatchesHost(domain, h)) continue
    parts.push(info.cookieHeader)
    names.push(...info.names)
    if (info.hasAuthSession) hasAuth = true
  }
  const cookieHeader = parts.filter(Boolean).join('; ')
  return {
    cookieHeader,
    names,
    hasAuthSession: hasAuth,
    hasTrace: hasAuth, // B1
  }
}

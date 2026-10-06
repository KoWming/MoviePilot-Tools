import { STORAGE_KEYS } from '../core/storage'
import { storageGet, storageSet } from '../core/storage'
import { extractGithubToken, fetchSystemEnv } from './user'

export interface ReleaseAsset {
  name: string
  browser_download_url: string
  size?: number
  content_type?: string
}

export interface RawGitHubRelease {
  tag_name: string
  name?: string
  body?: string
  published_at?: string
  html_url?: string
  prerelease?: boolean
  draft?: boolean
  assets?: ReleaseAsset[]
  zipball_url?: string
}

export interface ExtensionReleaseInfo {
  tagName: string
  version: string
  title: string
  body: string
  publishedAt: string
  htmlUrl: string
  downloadUrl: string
  assetName: string
}

type ExtensionVersionCache = {
  release: ExtensionReleaseInfo
  fetchedAt: number
}

export const REPO_OWNER = 'KoWming'
export const REPO_NAME = 'MoviePilot-Tools'
export const GITHUB_RELEASES_API = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases?per_page=10`

/** 常用 GitHub 资源加速镜像（已剔除黑名单与失效节点） */
export const DEFAULT_GITHUB_MIRRORS = [
  'https://ghproxy.net/',
  'https://gh-proxy.com/',
  'https://mirror.ghproxy.com/',
] as const

/** 静态 CDN 兜底源列表（免 GitHub API Rate Limit 限制） */
export const CDN_PACKAGE_URLS = [
  `https://fastly.jsdelivr.net/gh/${REPO_OWNER}/${REPO_NAME}@main/package.json`,
  `https://cdn.jsdelivr.net/gh/${REPO_OWNER}/${REPO_NAME}@main/package.json`,
] as const

/** 缓存 30 分钟，避免 GitHub API rate limit */
const CACHE_TTL_MS = 30 * 60 * 1000
const FETCH_TIMEOUT_MS = 8000

/** 内存中的 GitHub Token 缓存（来自 MP 配置） */
let memGithubToken = ''

/** GitHub API 限流冷却时间戳（毫秒） */
let rateLimitResetUntil = 0

/** 设置内存中的 GitHub Token */
export function setMemGithubToken(token: string): void {
  memGithubToken = (token || '').trim().replace(/^Bearer\s+/i, '')
}

/** 获取内存中的 GitHub Token */
export function getMemGithubToken(): string {
  return memGithubToken
}

/** 获取当前限流冷却截止时间（测试/诊断用） */
export function getRateLimitResetUntil(): number {
  return rateLimitResetUntil
}

/** 重置限流冷却状态（测试/诊断用） */
export function resetRateLimitCoolDown(): void {
  rateLimitResetUntil = 0
}

/**
 * 尝试解析有效的 GitHub Token：
 * 优先使用内存中的 token，若无则尝试从 MoviePilot 服务端 /system/env 安全读取。
 */
export async function resolveGithubToken(): Promise<string> {
  if (memGithubToken) return memGithubToken
  try {
    const env = await fetchSystemEnv()
    const token = extractGithubToken(env)
    if (token) {
      memGithubToken = token
      return token
    }
  } catch {
    /* 忽略 MP 离线或无权读取环境配置异常 */
  }
  return ''
}

/** 获取当前扩展运行时的版本号 */
export function getCurrentExtensionVersion(): string {
  try {
    const v = chrome?.runtime?.getManifest?.()?.version
    if (v) return v
  } catch {
    /* 忽略非扩展上下文 */
  }
  return typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '2.1.1'
}

/** 规范化版本号字符串，如 'v2.0.1' -> '2.0.1' */
export function normalizeVersion(v: string | null | undefined): string {
  return String(v || '')
    .trim()
    .replace(/^v/i, '')
}

/**
 * 语义化版本号比较：
 * 返回 > 0 表示 v1 > v2；< 0 表示 v1 < v2；0 表示版本相同
 */
export function compareVersions(v1: string, v2: string): number {
  const p1 = normalizeVersion(v1).match(/\d+/g)?.map(Number) ?? []
  const p2 = normalizeVersion(v2).match(/\d+/g)?.map(Number) ?? []
  const len = Math.max(p1.length, p2.length)
  for (let i = 0; i < len; i++) {
    const num1 = p1[i] ?? 0
    const num2 = p2[i] ?? 0
    if (num1 !== num2) return num1 - num2
  }
  return 0
}

/** 判定最新版本是否大于当前版本 */
export function isNewerVersion(latest: string, current: string): boolean {
  return compareVersions(latest, current) > 0
}

/**
 * 从 Release 的资产列表中筛选最适合当前浏览器的安装包文件。
 * 优先级：
 * 1. 包含 'chrome' 且后缀为 .zip / .crx 的资产
 * 2. 后缀为 .zip / .crx 的任意资产
 * 3. 其它首个可用资产
 */
export function pickBestAsset(assets: ReleaseAsset[] = []): ReleaseAsset | null {
  if (!assets.length) return null

  // 1. 优选含 chrome 且为 zip/crx 的文件
  const chromeAsset = assets.find((a) => {
    const n = a.name.toLowerCase()
    return n.includes('chrome') && (n.endsWith('.zip') || n.endsWith('.crx'))
  })
  if (chromeAsset) return chromeAsset

  // 2. 包含 moviepilot 或普通 zip/crx 压缩包
  const zipOrCrx = assets.find((a) => {
    const n = a.name.toLowerCase()
    return n.endsWith('.zip') || n.endsWith('.crx')
  })
  if (zipOrCrx) return zipOrCrx

  // 3. 回退到第一个资产
  return assets[0] ?? null
}

/** 将 GitHub Release 数据解析为统一的发布信息 */
export function parseRelease(raw: RawGitHubRelease): ExtensionReleaseInfo | null {
  const tag = String(raw?.tag_name || '').trim()
  if (!tag) return null

  const bestAsset = pickBestAsset(raw.assets)
  const downloadUrl = bestAsset?.browser_download_url || raw.html_url || ''
  const assetName = bestAsset?.name || ''

  return {
    tagName: tag,
    version: normalizeVersion(tag),
    title: raw.name || tag,
    body: raw.body || '',
    publishedAt: raw.published_at || '',
    htmlUrl: raw.html_url || '',
    downloadUrl,
    assetName,
  }
}

/**
 * 从 releases 列表中挑选出版本号最高的正式版本
 */
export function pickLatestRelease(list: unknown): ExtensionReleaseInfo | null {
  if (!Array.isArray(list)) return null
  const releases = list
    .filter((r): r is RawGitHubRelease => Boolean(r && typeof r === 'object' && !r.draft))
    .map(parseRelease)
    .filter((r): r is ExtensionReleaseInfo => r !== null)

  if (!releases.length) return null

  // 优先选取非预发布版本，若全是 pre-release 则回退
  const nonPrerelease = releases.filter((_, idx) => {
    const raw = list[idx] as RawGitHubRelease
    return !raw.prerelease
  })
  const pool = nonPrerelease.length ? nonPrerelease : releases

  return [...pool].sort((a, b) => compareVersions(a.version, b.version))[pool.length - 1] ?? null
}

function createTimeoutSignal(ms: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  }
}

/** 将成功获取的版本信息存入本地缓存 */
async function writeReleaseCache(release: ExtensionReleaseInfo): Promise<void> {
  try {
    await storageSet<ExtensionVersionCache>(STORAGE_KEYS.EXTENSION_LATEST_CACHE, {
      release,
      fetchedAt: Date.now(),
    })
  } catch {
    /* 忽略缓存写入异常 */
  }
}

/**
 * 从静态 CDN 镜像拉取仓库 package.json 获取最新版本号。
 * 全球 CDN 加速，彻底免除 GitHub API 403 Rate Limit 限制。
 */
export async function fetchVersionFromCdn(
  timeoutMs = FETCH_TIMEOUT_MS,
): Promise<ExtensionReleaseInfo | null> {
  for (const url of CDN_PACKAGE_URLS) {
    const { signal, clear } = createTimeoutSignal(timeoutMs)
    try {
      const res = await fetch(url, { signal })
      if (!res.ok) continue
      const data = (await res.json()) as { version?: unknown }
      const rawVersion = typeof data?.version === 'string' ? data.version.trim() : ''
      if (!rawVersion) continue

      const norm = normalizeVersion(rawVersion)
      const tag = `v${norm}`
      const downloadName = `${REPO_NAME}-${tag}-chrome.zip`

      return {
        tagName: tag,
        version: norm,
        title: `${REPO_NAME} ${tag}`,
        body: `发现新版本 ${tag}（静态 CDN 镜像源检测）`,
        publishedAt: '',
        htmlUrl: `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases`,
        downloadUrl: `https://github.com/${REPO_OWNER}/${REPO_NAME}/releases/download/${tag}/${downloadName}`,
        assetName: downloadName,
      }
    } catch {
      /* 失败尝试下一个 CDN 源 */
    } finally {
      clear()
    }
  }
  return null
}

/**
 * 包装为高速加速下载链接：
 * 若是 https://github.com/ 开头，添加镜像前缀以确保国内高速稳定下载。
 */
export function getAcceleratedDownloadUrl(
  rawUrl: string,
  mirrorPrefix: string = DEFAULT_GITHUB_MIRRORS[0],
): string {
  if (!rawUrl || !rawUrl.startsWith('https://github.com/')) {
    return rawUrl
  }
  for (const m of DEFAULT_GITHUB_MIRRORS) {
    if (rawUrl.startsWith(m)) return rawUrl
  }
  const cleanPrefix = mirrorPrefix.replace(/\/+$/, '')
  return `${cleanPrefix}/${rawUrl}`
}

/**
 * 轻量探测下载 URL 是否可用（快速 HEAD 请求）：
 * 200~308 视为有效，403 (黑名单/Forbidden by black list)/404/5xx 或超时视为不可用。
 */
export async function probeDownloadUrl(url: string, timeoutMs = 2500): Promise<boolean> {
  const { signal, clear } = createTimeoutSignal(timeoutMs)
  try {
    const res = await fetch(url, { method: 'HEAD', signal })
    return res.status >= 200 && res.status < 400
  } catch {
    return false
  } finally {
    clear()
  }
}

/**
 * 智能选取最佳可用下载链接：
 * 1. direct 模式或非 GitHub 链接：直接返回 rawUrl 直连；
 * 2. smart 模式：依次探测可用加速镜像，遇到 403 黑名单或断连节点自动跳过；
 * 3. 兜底保障：若所有镜像均不可用，自动降级回退至 rawUrl（官方直连）。
 */
export async function resolveOptimalDownloadUrl(
  rawUrl: string,
  options?: {
    mode?: 'smart' | 'direct' | 'mirror'
    preferredMirror?: string
  },
): Promise<{ url: string; isMirror: boolean; mirrorPrefix?: string }> {
  if (!rawUrl || !rawUrl.startsWith('https://github.com/')) {
    return { url: rawUrl, isMirror: false }
  }

  const mode = options?.mode ?? 'smart'
  if (mode === 'direct') {
    return { url: rawUrl, isMirror: false }
  }

  const candidateMirrors: string[] = []
  if (options?.preferredMirror) {
    candidateMirrors.push(options.preferredMirror)
  }
  for (const m of DEFAULT_GITHUB_MIRRORS) {
    if (!candidateMirrors.includes(m)) {
      candidateMirrors.push(m)
    }
  }

  // 串行探测候选镜像健康度，返回首个正常响应的节点
  for (const mirror of candidateMirrors) {
    const target = getAcceleratedDownloadUrl(rawUrl, mirror)
    const isOk = await probeDownloadUrl(target)
    if (isOk) {
      return { url: target, isMirror: true, mirrorPrefix: mirror }
    }
  }

  // 全部镜像失效时平滑降级为直连
  return { url: rawUrl, isMirror: false }
}

/**
 * 检查 GitHub 获取 MoviePilot-Tools 扩展最新版本。
 * 具备四重弹性链条：
 * 1. 本地智能缓存
 * 2. MP 服务端 Token 注入鉴权（配额 5000 次/h）
 * 3. GitHub API 403 智能防击穿与冷却
 * 4. 全球 CDN 静态降级兜底
 *
 * @param force 是否强制跳过本地缓存
 * @param customToken 可选自定义 GitHub Token
 */
export async function fetchLatestExtensionRelease(
  force = false,
  customToken?: string | null,
): Promise<ExtensionReleaseInfo | null> {
  if (!force) {
    try {
      const cached = await storageGet<ExtensionVersionCache>(STORAGE_KEYS.EXTENSION_LATEST_CACHE)
      if (
        cached?.release &&
        typeof cached.fetchedAt === 'number' &&
        Date.now() - cached.fetchedAt < CACHE_TTL_MS
      ) {
        return cached.release
      }
    } catch {
      /* 忽略缓存读取异常 */
    }
  }

  // 1. 尝试获取 GitHub 认证 Token（从参数或 MP 服务端获取）
  let token = (customToken || '').trim().replace(/^Bearer\s+/i, '')
  if (!token) {
    token = await resolveGithubToken()
  }

  // 2. 限流防击穿判断：若处于 403 冷却期且没有新 Token，跳过 GitHub API 直接走静态 CDN
  const inRateLimitCooldown = rateLimitResetUntil > Date.now()
  if (inRateLimitCooldown && !token) {
    const cdnRelease = await fetchVersionFromCdn()
    if (cdnRelease) {
      await writeReleaseCache(cdnRelease)
      return cdnRelease
    }
    return null
  }

  const { signal, clear } = createTimeoutSignal(FETCH_TIMEOUT_MS)
  try {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const res = await fetch(GITHUB_RELEASES_API, {
      method: 'GET',
      headers,
      signal,
    })

    // 遇到 403 限流
    if (res.status === 403) {
      const resetHeader = res.headers?.get?.('x-ratelimit-reset')
      if (resetHeader) {
        const resetSec = parseInt(resetHeader, 10)
        if (!Number.isNaN(resetSec) && resetSec > 0) {
          rateLimitResetUntil = resetSec * 1000
        }
      }
      if (rateLimitResetUntil <= Date.now()) {
        rateLimitResetUntil = Date.now() + 30 * 60 * 1000
      }

      // 自动降级走静态 CDN
      const cdnRelease = await fetchVersionFromCdn()
      if (cdnRelease) {
        await writeReleaseCache(cdnRelease)
        return cdnRelease
      }
      return null
    }

    if (!res.ok) {
      // 其它网络错误走 CDN 兜底
      const cdnRelease = await fetchVersionFromCdn()
      if (cdnRelease) {
        await writeReleaseCache(cdnRelease)
        return cdnRelease
      }
      return null
    }

    const list: unknown = await res.json()
    const latest = pickLatestRelease(list)
    if (latest) {
      await writeReleaseCache(latest)
      return latest
    }

    // 若 Release 为空回退到 CDN
    const cdnRelease = await fetchVersionFromCdn()
    if (cdnRelease) {
      await writeReleaseCache(cdnRelease)
      return cdnRelease
    }
    return null
  } catch {
    // 异常/超时走 CDN 兜底
    const cdnRelease = await fetchVersionFromCdn()
    if (cdnRelease) {
      await writeReleaseCache(cdnRelease)
      return cdnRelease
    }
    return null
  } finally {
    clear()
  }
}

/**
 * 一键下载扩展更新包：
 * 1. 智能解析最佳下载地址（过滤 403 黑名单与失效节点）；
 * 2. 优先调用 chrome.downloads.download API；
 * 3. 监听下载中断事件（如 SERVER_FORBIDDEN），在失败时自动降级回退至直连或打开发布页。
 */
export async function downloadExtensionUpdate(
  release: ExtensionReleaseInfo,
  options?: {
    useMirror?: boolean
    mode?: 'smart' | 'direct' | 'mirror'
    preferredMirror?: string
  },
): Promise<{ url: string; isMirror: boolean }> {
  const rawUrl = release.downloadUrl || release.htmlUrl
  if (!rawUrl) {
    throw new Error('未获取到有效的下载地址')
  }

  // 1. 智能寻址：自动跳过 403 黑名单与超时镜像
  const mode = options?.mode ?? (options?.useMirror === false ? 'direct' : 'smart')
  const { url: targetUrl, isMirror } = await resolveOptimalDownloadUrl(rawUrl, {
    mode,
    preferredMirror: options?.preferredMirror,
  })

  // 2. 若处于具备 chrome.downloads 权限的扩展环境
  if (typeof chrome !== 'undefined' && chrome?.downloads?.download) {
    return new Promise<{ url: string; isMirror: boolean }>((resolve, reject) => {
      chrome.downloads.download(
        {
          url: targetUrl,
          filename: release.assetName || undefined,
          saveAs: false,
        },
        (downloadId) => {
          if (chrome.runtime.lastError || downloadId === undefined) {
            // 下载 API 启动失败时回退到新窗口打开
            try {
              window.open(targetUrl, '_blank')
              resolve({ url: targetUrl, isMirror })
            } catch {
              reject(new Error(chrome.runtime.lastError?.message || '下载启动失败'))
            }
            return
          }

          // 监听下载状态，若因 403 黑名单/网络中断失败，自动降级打开直连或 Release 页面
          if (chrome.downloads.onChanged) {
            const listener = (delta: chrome.downloads.DownloadDelta) => {
              if (delta.id === downloadId && delta.state) {
                if (delta.state.current === 'interrupted') {
                  chrome.downloads.onChanged.removeListener(listener)
                  // 针对 403 (SERVER_FORBIDDEN) 或其他错误回退
                  try {
                    window.open(release.htmlUrl || rawUrl, '_blank')
                  } catch {
                    // ignore
                  }
                } else if (delta.state.current === 'complete') {
                  chrome.downloads.onChanged.removeListener(listener)
                }
              }
            }
            chrome.downloads.onChanged.addListener(listener)
          }

          resolve({ url: targetUrl, isMirror })
        },
      )
    })
  }

  // 3. 普通浏览器或降级：创建链接触发下载
  if (typeof window !== 'undefined') {
    const a = document.createElement('a')
    a.href = targetUrl
    if (release.assetName) a.download = release.assetName
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return { url: targetUrl, isMirror }
}

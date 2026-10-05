// 用户信息服务
import { api, request } from '../core/http'
import type { UserInfo } from '../core/types'
import { appState } from '../core/state'
import { storageGet, storageSet, STORAGE_KEYS } from '../core/storage'

export async function fetchCurrentUser(): Promise<UserInfo | null> {
  const res = await api.get<unknown>('/api/v1/user/current')
  if (!res.ok || !res.data) return null
  if (typeof res.data === 'object' && res.data !== null) {
    const obj = res.data as Record<string, unknown>
    if (obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)) {
      return obj.data as UserInfo
    }
    return res.data as UserInfo
  }
  return null
}

/** MoviePilot 用户接口支持更新用户名和邮箱。 */
export async function updateUserInfo(payload: Partial<UserInfo>): Promise<boolean> {
  const res = await api.put('/api/v1/user/', payload)
  return res.ok
}

export async function fetchSystemEnv(): Promise<Record<string, unknown> | null> {
  const res = await api.get<Record<string, unknown>>('/api/v1/system/env')
  return res.ok ? res.data : null
}

/** 解析 `/system/env` 响应体；存在 `data` 包裹时读取其内部值。 */
export function unwrapSystemEnv(
  env: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!env) return null
  if (env.data && typeof env.data === 'object') return env.data as Record<string, unknown>
  return env
}

/**
 * 从 MP 系统配置取出 GITHUB_TOKEN（仅内存使用，不落盘）。
 * 仅超级管理员可访问 /system/env；未配置或非超管则为空。
 */
export function extractGithubToken(env: Record<string, unknown> | null): string {
  const data = unwrapSystemEnv(env)
  if (!data) return ''
  const raw = data.GITHUB_TOKEN
  if (typeof raw !== 'string') return ''
  return raw.trim().replace(/^Bearer\s+/i, '')
}

/** 从 GitHub Releases 中按数值版本排序，优先返回最新 v2.x 标签。 */
function pickLatestReleaseTag(list: unknown): string | null {
  if (!Array.isArray(list) || list.length === 0) return null
  const tags = list
    .map((it) => {
      if (!it || typeof it !== 'object') return ''
      const tag = (it as { tag_name?: unknown }).tag_name
      return typeof tag === 'string' ? tag.trim() : ''
    })
    .filter(Boolean)
  if (!tags.length) return null

  const v2 = tags.filter((t) => /^v2\./i.test(t))
  const pool = v2.length ? v2 : tags
  try {
    return [...pool].sort((a, b) => {
      const pa = a.match(/\d+/g)?.map(Number) ?? []
      const pb = b.match(/\d+/g)?.map(Number) ?? []
      const n = Math.max(pa.length, pb.length)
      for (let i = 0; i < n; i++) {
        const da = pa[i] ?? 0
        const db = pb[i] ?? 0
        if (da !== db) return da - db
      }
      return 0
    })[pool.length - 1]
  } catch {
    return pool[0] || null
  }
}

/** 版本检查：缓存 6h + 请求超时，避免 GitHub/代理拖慢整页 */
const VERSION_LATEST_CACHE_TTL_MS = 6 * 60 * 60 * 1000
const VERSION_FETCH_TIMEOUT_MS = 8000

type VersionLatestCache = { version: string; fetchedAt: number }

function createTimeoutSignal(ms: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return {
    signal: controller.signal,
    clear: () => clearTimeout(timer),
  }
}

async function readVersionCache(
  key: typeof STORAGE_KEYS.SOFTWARE_LATEST_CACHE | typeof STORAGE_KEYS.FRONTEND_LATEST_CACHE,
): Promise<string | null> {
  try {
    const cached = await storageGet<VersionLatestCache>(key)
    if (
      cached?.version &&
      typeof cached.fetchedAt === 'number' &&
      Date.now() - cached.fetchedAt < VERSION_LATEST_CACHE_TTL_MS
    ) {
      return cached.version
    }
  } catch {
    /* 缓存读取失败时继续请求版本接口。 */
  }
  return null
}

async function writeVersionCache(
  key: typeof STORAGE_KEYS.SOFTWARE_LATEST_CACHE | typeof STORAGE_KEYS.FRONTEND_LATEST_CACHE,
  version: string,
): Promise<void> {
  try {
    await storageSet<VersionLatestCache>(key, { version, fetchedAt: Date.now() })
  } catch {
    /* 缓存写入失败时仍返回已获取的版本结果。 */
  }
}

/**
 * 查询 MoviePilot 软件最新版本。
 * GET /api/v1/system/versions → 后端带 GITHUB_TOKEN 代理 GitHub MoviePilot releases
 * 失败/超时返回 null；结果缓存 6h
 */
export async function fetchLatestSoftwareVersion(): Promise<string | null> {
  const hit = await readVersionCache(STORAGE_KEYS.SOFTWARE_LATEST_CACHE)
  if (hit) return hit

  const { signal, clear } = createTimeoutSignal(VERSION_FETCH_TIMEOUT_MS)
  try {
    const res = await request<unknown>('/api/v1/system/versions', {
      method: 'GET',
      signal,
    })
    if (!res.ok || res.data == null) return null

    // 兼容 { success, data: Release[] } 或直接数组
    const payload = res.data as { success?: boolean; data?: unknown }
    const list: unknown =
      Array.isArray(res.data)
        ? res.data
        : Array.isArray(payload?.data)
          ? payload.data
          : null
    const tag = pickLatestReleaseTag(list)
    if (tag) await writeVersionCache(STORAGE_KEYS.SOFTWARE_LATEST_CACHE, tag)
    return tag
  } catch {
    return null
  } finally {
    clear()
  }
}

/**
 * 前端最新版本：
 * MP Web 无专用 latest API；后端 SystemChain 用 GITHUB_HEADERS 查
 * MoviePilot-Frontend/releases。扩展侧同样直连 GitHub，并尽量带上
 * MP 配置的 GITHUB_TOKEN（来自 /system/env，仅内存使用）。
 * 结果缓存 6 小时，减少 403 rate limit；8s 超时避免整页等待。
 */
export async function fetchLatestFrontendVersion(
  githubToken?: string | null,
): Promise<string | null> {
  const hit = await readVersionCache(STORAGE_KEYS.FRONTEND_LATEST_CACHE)
  if (hit) return hit

  const { signal, clear } = createTimeoutSignal(VERSION_FETCH_TIMEOUT_MS)
  try {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    }
    const token = String(githubToken || '').trim().replace(/^Bearer\s+/i, '')
    if (token) {
      // GitHub Token 使用 Bearer 认证，支持 `ghp_` 和 `github_pat_` 前缀。
      headers.Authorization = `Bearer ${token}`
    }

    const res = await fetch(
      'https://api.github.com/repos/jxxghp/MoviePilot-Frontend/releases?per_page=30',
      { method: 'GET', headers, signal },
    )
    if (!res.ok) return null
    const list: unknown = await res.json()
    const tag = pickLatestReleaseTag(list)
    if (tag) await writeVersionCache(STORAGE_KEYS.FRONTEND_LATEST_CACHE, tag)
    return tag
  } catch {
    return null
  } finally {
    clear()
  }
}

/** 规范化版本字符串便于比较（去空白，保留 v 前缀语义用全等） */
export function normalizeVersionTag(v: string | null | undefined): string {
  return String(v || '').trim()
}

/**
 * 展示用：当前与最新相同则只显示当前；
 * 不同则拆成 current / latest，由 UI 用箭头连接（缺省任一侧时回退已有值）
 */
export function formatVersionWithLatest(
  current: string | null | undefined,
  latest: string | null | undefined,
): { text: string; current: string; latest: string; outdated: boolean } {
  const cur = normalizeVersionTag(current)
  const lat = normalizeVersionTag(latest)
  if (!cur && !lat) return { text: '-', current: '', latest: '', outdated: false }
  if (!lat) return { text: cur || '-', current: cur, latest: '', outdated: false }
  if (!cur) return { text: lat, current: '', latest: lat, outdated: false }
  if (cur === lat) return { text: cur, current: cur, latest: lat, outdated: false }
  return {
    text: `${cur} → ${lat}`,
    current: cur,
    latest: lat,
    outdated: true,
  }
}

export async function loadUser(): Promise<void> {
  appState.user = await fetchCurrentUser()
}

import { api } from '../core/http'
import type { SiteSupportingInfo } from '../core/types'

export type SupportingDict = Record<string, SiteSupportingInfo>

let supportingCache: SupportingDict | null = null
let supportingRequest: Promise<SupportingDict> | null = null

function unwrapSupportingData(data: unknown): Record<string, Omit<SiteSupportingInfo, 'domain'>> | null {
  if (!data || typeof data !== 'object') return null
  const obj = data as Record<string, unknown>
  if (obj.data && typeof obj.data === 'object' && !Array.isArray(obj.data)) {
    return obj.data as Record<string, Omit<SiteSupportingInfo, 'domain'>>
  }
  if (!Array.isArray(data)) {
    return data as Record<string, Omit<SiteSupportingInfo, 'domain'>>
  }
  return null
}

/**
 * 获取已适配站点字典，并补齐每项的 canonical `domain`。
 * 成功结果在当前扩展上下文内缓存；并发请求共享同一个 Promise。
 * `force` 只绕过成功缓存，不与正在进行的请求重复并发；请求失败返回现有缓存或空字典。
 */
export async function fetchSupportingSites(force = false): Promise<SupportingDict> {
  if (!force && supportingCache) return supportingCache
  if (supportingRequest) return supportingRequest

  supportingRequest = api
    .get<unknown>('/api/v1/site/supporting')
    .then((res) => {
      const dict = unwrapSupportingData(res.data)
      if (!res.ok || !dict) return supportingCache || {}
      supportingCache = Object.fromEntries(
        Object.entries(dict)
          .filter(([key]) => key !== 'success' && key !== 'message' && key !== 'data')
          .map(([domain, info]) => [domain, { ...info, domain }]),
      )
      return supportingCache
    })
    .catch(() => supportingCache || {})
    .finally(() => {
      supportingRequest = null
    })
  return supportingRequest
}

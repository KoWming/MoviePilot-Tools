import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrivateStoreV1 } from '../core/storage-contracts'
import type { Site } from '../core/types'

let privateStore: PrivateStoreV1 = { schema: 1 }
const apiGet = vi.fn()

vi.mock('../core/private-vault', () => ({
  getPrivateStore: vi.fn(async () => structuredClone(privateStore)),
  updatePrivateStore: vi.fn(async (mutator: (draft: PrivateStoreV1) => void) => {
    const draft = structuredClone(privateStore)
    mutator(draft)
    privateStore = draft
    return structuredClone(privateStore)
  }),
}))

vi.mock('../core/http', () => ({
  api: {
    get: (...args: unknown[]) => apiGet(...args),
    put: vi.fn(),
    post: vi.fn(),
    del: vi.fn(),
  },
}))

import { fetchSites, loadStoredSites } from '../services/site-manage'

const site: Site = {
  id: 1,
  name: 'Example',
  domain: 'example.com',
  url: 'https://example.com',
  cookie: 'session=private-cookie',
  rss: 'https://example.com/rss',
  apikey: 'private-api-key',
  token: 'private-token',
}

describe('站点管理 Private Vault 存储', () => {
  beforeEach(() => {
    privateStore = { schema: 1 }
    apiGet.mockReset()
  })

  it('API 返回的 apikey、cookie、rss、url、domain 整体存入 Private Store', async () => {
    apiGet.mockResolvedValue({ ok: true, data: [site] })
    await expect(fetchSites()).resolves.toEqual([site])
    expect(privateStore.sites).toEqual([site])
    const text = JSON.stringify(privateStore.sites)
    expect(text).toContain('private-api-key')
    expect(text).toContain('private-cookie')
    expect(text).toContain('https://example.com/rss')
    expect(text).toContain('https://example.com')
    expect(text).toContain('example.com')
  })

  it('支持 MoviePilot V3 统一响应信封（{ success: true, data: [...] }）解包', async () => {
    apiGet.mockResolvedValue({
      ok: true,
      data: {
        success: true,
        message: '',
        data: [site],
      },
    })
    await expect(fetchSites()).resolves.toEqual([site])
    expect(privateStore.sites).toEqual([site])
  })

  it('接口返回非数组异常结构时优雅降级为空数组，不污染存储', async () => {
    apiGet.mockResolvedValue({
      ok: true,
      data: {
        invalid: true,
      },
    })
    await expect(fetchSites()).resolves.toEqual([])
    expect(privateStore.sites).toEqual([])
  })

  it('存储中存在旧异常非数组数据时，loadStoredSites 降级返回空数组', async () => {
    privateStore.sites = { error: 'corrupted' } as unknown as Site[]
    await expect(loadStoredSites()).resolves.toEqual([])
  })

  it('接口失败时只从 Private Store 加载站点配置', async () => {
    privateStore.sites = [site]
    apiGet.mockResolvedValue({ ok: false, data: null })
    await expect(fetchSites()).resolves.toEqual([site])
    await expect(loadStoredSites()).resolves.toEqual([site])
  })
})

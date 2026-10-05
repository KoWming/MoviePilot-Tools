import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiGet = vi.fn()

vi.mock('../core/http', () => ({
  api: { get: apiGet },
}))

async function loadService() {
  vi.resetModules()
  return import('../services/site-supporting')
}

describe('Supporting 数据读取', () => {
  beforeEach(() => {
    apiGet.mockReset()
  })

  it('补齐 canonical domain，并在同一上下文缓存成功结果', async () => {
    apiGet.mockResolvedValue({ ok: true, data: { 'Example.PT': { id: 1, name: 'Example' } } })
    const { fetchSupportingSites } = await loadService()

    const first = await fetchSupportingSites()
    const second = await fetchSupportingSites()

    expect(first).toEqual({
      'Example.PT': { id: 1, name: 'Example', domain: 'Example.PT' },
    })
    expect(second).toBe(first)
    expect(apiGet).toHaveBeenCalledTimes(1)
  })

  it('并发调用共享请求，force 在请求结束后绕过成功缓存', async () => {
    let resolveRequest: ((value: unknown) => void) | null = null
    apiGet.mockImplementationOnce(
      () => new Promise((resolve) => {
        resolveRequest = resolve
      }),
    )
    const { fetchSupportingSites } = await loadService()

    const first = fetchSupportingSites()
    const concurrentForce = fetchSupportingSites(true)
    expect(apiGet).toHaveBeenCalledTimes(1)
    resolveRequest?.({ ok: true, data: { 'one.pt': { id: 1 } } })
    await expect(first).resolves.toHaveProperty('one.pt')
    await expect(concurrentForce).resolves.toHaveProperty('one.pt')

    apiGet.mockResolvedValueOnce({ ok: true, data: { 'two.pt': { id: 2 } } })
    await expect(fetchSupportingSites(true)).resolves.toHaveProperty('two.pt')
    expect(apiGet).toHaveBeenCalledTimes(2)
  })

  it('刷新失败时返回最近一次成功缓存', async () => {
    apiGet.mockResolvedValueOnce({ ok: true, data: { 'cached.pt': { id: 1 } } })
    const { fetchSupportingSites } = await loadService()
    const cached = await fetchSupportingSites()

    apiGet.mockRejectedValueOnce(new Error('network'))
    await expect(fetchSupportingSites(true)).resolves.toBe(cached)
  })

  it('支持 MoviePilot V3 统一响应信封并过滤信封字段', async () => {
    apiGet.mockResolvedValueOnce({
      ok: true,
      data: {
        success: true,
        message: '',
        data: {
          'v3site.pt': { id: 3, name: 'V3Site' },
        },
      },
    })
    const { fetchSupportingSites } = await loadService()
    const result = await fetchSupportingSites()
    expect(result).toEqual({
      'v3site.pt': { id: 3, name: 'V3Site', domain: 'v3site.pt' },
    })
    expect(result).not.toHaveProperty('success')
    expect(result).not.toHaveProperty('message')
    expect(result).not.toHaveProperty('data')
  })
})

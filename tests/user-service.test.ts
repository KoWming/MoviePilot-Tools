import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiGet = vi.fn()

vi.mock('../core/http', () => ({
  api: {
    get: (...args: unknown[]) => apiGet(...args),
    put: vi.fn(),
  },
  request: vi.fn(),
}))

import { fetchCurrentUser } from '../services/user'

describe('User 服务数据解析', () => {
  beforeEach(() => {
    apiGet.mockReset()
  })

  it('兼容 V2 原生 UserInfo 对象返回', async () => {
    const rawUser = { id: 1, name: 'admin', is_superuser: true }
    apiGet.mockResolvedValueOnce({ ok: true, data: rawUser })

    const user = await fetchCurrentUser()
    expect(user).toEqual(rawUser)
  })

  it('兼容 V3 响应信封（{ success: true, data: UserInfo }）结构解包', async () => {
    const rawUser = { id: 2, name: 'normal_user', is_superuser: false }
    apiGet.mockResolvedValueOnce({
      ok: true,
      data: {
        success: true,
        message: '',
        data: rawUser,
      },
    })

    const user = await fetchCurrentUser()
    expect(user).toEqual(rawUser)
  })

  it('请求失败或返回 null 时返回 null', async () => {
    apiGet.mockResolvedValueOnce({ ok: false, data: null })
    const user = await fetchCurrentUser()
    expect(user).toBeNull()
  })
})

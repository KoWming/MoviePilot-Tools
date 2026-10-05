import { afterEach, describe, expect, it, vi } from 'vitest'
import { hasCookieDiff, syncSiteToServer } from '../services/site-manage'
import { getDomainCookies } from '../utils/cookie'
import type { Site } from '../services/site-manage'

describe('Cookie 差异比对 (hasCookieDiff)', () => {
  it('当两端 Cookie 完全一致时，返回 false', () => {
    const server = 'c_secure_uid=12345; c_secure_pass=abcdef123456'
    const browser = 'c_secure_uid=12345; c_secure_pass=abcdef123456'
    expect(hasCookieDiff(server, browser)).toBe(false)
  })

  it('键的顺序不同时，应判定为一致 (false)', () => {
    const server = 'c_secure_uid=12345; c_secure_pass=abcdef123456'
    const browser = 'c_secure_pass=abcdef123456; c_secure_uid=12345'
    expect(hasCookieDiff(server, browser)).toBe(false)
  })

  it('浏览器多出统计、CDN 或偏好等无害噪声 Cookie 时，应判定为一致 (false)', () => {
    const server = 'c_secure_uid=12345; c_secure_pass=abcdef123456'
    const browser =
      'c_secure_uid=12345; c_secure_pass=abcdef123456; cf_clearance=noise123; _ga=GA1.2.345; theme=dark; lang=zh_CN; hm_lvt_abc=123456'
    expect(hasCookieDiff(server, browser)).toBe(false)
  })

  it('服务端关键凭证值被修改时，应判定为有差异 (true)', () => {
    const server = 'c_secure_uid=12345; c_secure_pass=old_pass'
    const browser = 'c_secure_uid=12345; c_secure_pass=new_pass'
    expect(hasCookieDiff(server, browser)).toBe(true)
  })

  it('服务端缺少凭证项时，应判定为有差异 (true)', () => {
    const server = 'c_secure_uid=12345'
    const browser = 'c_secure_uid=12345; c_secure_pass=abcdef'
    expect(hasCookieDiff(server, browser)).toBe(true)
  })

  it('浏览器缺少服务端的凭据时，应判定为有差异 (true)', () => {
    const server = 'c_secure_uid=12345; c_secure_pass=abcdef'
    const browser = 'c_secure_uid=12345'
    expect(hasCookieDiff(server, browser)).toBe(true)
  })
})

describe('getDomainCookies 抓取', () => {
  const originalChrome = globalThis.chrome

  afterEach(() => {
    globalThis.chrome = originalChrome
  })

  it('能同时结合 url 与 domain 查询并合并去重父级与子级 Cookie', async () => {
    const mockCookiesByUrl = [
      { name: 'parent_auth', value: 'root123', domain: '.ptsite.test', path: '/' },
      { name: 'sub_session', value: 'sub456', domain: 'sub.ptsite.test', path: '/' },
    ]
    const mockCookiesByDomain = [
      { name: 'sub_session', value: 'sub456', domain: 'sub.ptsite.test', path: '/' },
      { name: 'domain_extra', value: 'ext789', domain: 'sub.ptsite.test', path: '/' },
    ]

    globalThis.chrome = {
      cookies: {
        getAll: vi.fn(
          (
            details: { url?: string; domain?: string },
            cb: (c: typeof mockCookiesByUrl) => void,
          ) => {
            if (details.url) {
              cb(mockCookiesByUrl)
            } else {
              cb(mockCookiesByDomain)
            }
          },
        ),
      },
    } as unknown as typeof chrome

    const result = await getDomainCookies('https://sub.ptsite.test')
    expect(result).toContain('parent_auth=root123')
    expect(result).toContain('sub_session=sub456')
    expect(result).toContain('domain_extra=ext789')
  })
})

import { api } from '../core/http'

describe('syncSiteToServer 写入逻辑', () => {
  it('优先复用已解析的 site.browserCookies', async () => {
    let capturedPayload: unknown = null
    vi.spyOn(api, 'put').mockImplementation(async (_url, body) => {
      capturedPayload = body
      return { ok: true, data: { success: true }, status: 200 }
    })

    const site: Site = {
      id: 1,
      name: '测试站',
      url: 'https://pt.test',
      cookie: 'old_cookie=1',
      browserCookies: 'c_secure_uid=999; c_secure_pass=valid',
    }

    const outcome = await syncSiteToServer(site)
    expect(outcome.ok).toBe(true)
    expect((capturedPayload as { cookie?: string })?.cookie).toBe('c_secure_uid=999; c_secure_pass=valid')
  })
})

import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  compareVersions,
  downloadExtensionUpdate,
  fetchLatestExtensionRelease,
  fetchVersionFromCdn,
  getAcceleratedDownloadUrl,
  getRateLimitResetUntil,
  isNewerVersion,
  normalizeVersion,
  parseRelease,
  pickBestAsset,
  pickLatestRelease,
  resetRateLimitCoolDown,
  setMemGithubToken,
  type RawGitHubRelease,
  type ReleaseAsset,
} from '../services/extension-update'

describe('extension-update: 版本号处理与比较', () => {
  it('正确规范化版本字符串', () => {
    expect(normalizeVersion('v2.0.1')).toBe('2.0.1')
    expect(normalizeVersion('V2.1.0')).toBe('2.1.0')
    expect(normalizeVersion(' 2.0.0 ')).toBe('2.0.0')
    expect(normalizeVersion('')).toBe('')
    expect(normalizeVersion(null)).toBe('')
  })

  it('正确比较两个语义化版本号', () => {
    expect(compareVersions('2.0.1', '2.0.0')).toBeGreaterThan(0)
    expect(compareVersions('2.0.0', '2.0.1')).toBeLessThan(0)
    expect(compareVersions('v2.0.0', '2.0.0')).toBe(0)
    expect(compareVersions('2.1.0', '2.0.9')).toBeGreaterThan(0)
    expect(compareVersions('2.0.0.1', '2.0.0')).toBeGreaterThan(0)
    expect(compareVersions('2.0.0', '2.0.0.0')).toBe(0)
  })

  it('正确判定是否存在可用新版本', () => {
    expect(isNewerVersion('2.0.1', '2.0.0')).toBe(true)
    expect(isNewerVersion('v2.1.0', '2.0.0')).toBe(true)
    expect(isNewerVersion('2.0.0', '2.0.0')).toBe(false)
    expect(isNewerVersion('1.9.9', '2.0.0')).toBe(false)
  })
})

describe('extension-update: GitHub 资产与 Release 解析', () => {
  const assets: ReleaseAsset[] = [
    {
      name: 'MoviePilot-tools-2.0.1-firefox.zip',
      browser_download_url: 'https://github.com/download/firefox.zip',
    },
    {
      name: 'MoviePilot-tools-2.0.1-chrome.zip',
      browser_download_url: 'https://github.com/download/chrome.zip',
    },
    {
      name: 'MoviePilot-tools-2.0.1.crx',
      browser_download_url: 'https://github.com/download/moviepilot.crx',
    },
  ]

  it('优先挑选最适合 Chrome 的 zip/crx 安装包资产', () => {
    const picked = pickBestAsset(assets)
    expect(picked?.name).toBe('MoviePilot-tools-2.0.1-chrome.zip')
    expect(picked?.browser_download_url).toBe('https://github.com/download/chrome.zip')
  })

  it('当无明确 chrome 字样时，回退到其它 zip/crx 资产', () => {
    const fallbackAssets: ReleaseAsset[] = [
      {
        name: 'release-notes.txt',
        browser_download_url: 'https://github.com/download/notes.txt',
      },
      {
        name: 'extension-bundle.zip',
        browser_download_url: 'https://github.com/download/bundle.zip',
      },
    ]
    const picked = pickBestAsset(fallbackAssets)
    expect(picked?.name).toBe('extension-bundle.zip')
  })

  it('资产列表为空时返回 null', () => {
    expect(pickBestAsset([])).toBeNull()
  })

  it('正确解析单个 Release 结构', () => {
    const raw: RawGitHubRelease = {
      tag_name: 'v2.0.2',
      name: 'Release 2.0.2',
      body: 'Bug fixes and performance improvements',
      published_at: '2026-10-01T12:00:00Z',
      html_url: 'https://github.com/KoWming/MoviePilot-Tools/releases/tag/v2.0.2',
      assets,
    }
    const parsed = parseRelease(raw)
    expect(parsed).not.toBeNull()
    expect(parsed?.tagName).toBe('v2.0.2')
    expect(parsed?.version).toBe('2.0.2')
    expect(parsed?.downloadUrl).toBe('https://github.com/download/chrome.zip')
    expect(parsed?.assetName).toBe('MoviePilot-tools-2.0.1-chrome.zip')
  })

  it('从多个 Releases 列表中挑选最高正式版本，忽略草稿并优先稳定版', () => {
    const list: RawGitHubRelease[] = [
      {
        tag_name: 'v2.0.0',
        html_url: 'https://github.com/releases/v2.0.0',
      },
      {
        tag_name: 'v2.0.3-beta.1',
        prerelease: true,
        html_url: 'https://github.com/releases/v2.0.3-beta.1',
      },
      {
        tag_name: 'v2.0.1',
        html_url: 'https://github.com/releases/v2.0.1',
      },
      {
        tag_name: 'v2.1.0-draft',
        draft: true,
        html_url: 'https://github.com/releases/draft',
      },
    ]

    const latest = pickLatestRelease(list)
    expect(latest?.tagName).toBe('v2.0.1')
    expect(latest?.version).toBe('2.0.1')
  })
})

describe('extension-update: 方案4混合弹性链条（Token 注入、403 防击穿与 CDN 降级）', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    resetRateLimitCoolDown()
    setMemGithubToken('')
  })

  it('当提供 GitHub Token 时，请求头自动注入 Authorization Bearer', async () => {
    let capturedHeaders: HeadersInit | undefined
    const mockFetch = vi.fn().mockImplementation((_url: string, init?: RequestInit) => {
      capturedHeaders = init?.headers
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve([
            {
              tag_name: 'v2.0.5',
              html_url: 'https://github.com/KoWming/MoviePilot-Tools/releases/tag/v2.0.5',
            },
          ]),
      })
    })
    vi.stubGlobal('fetch', mockFetch)

    const release = await fetchLatestExtensionRelease(true, 'ghp_test_token_123456')
    expect(release?.version).toBe('2.0.5')
    expect(capturedHeaders).toEqual(
      expect.objectContaining({
        Authorization: 'Bearer ghp_test_token_123456',
      }),
    )
  })

  it('静态 CDN 降级正确解析 package.json 中的版本号', async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('package.json')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ version: '2.0.8' }),
        })
      }
      return Promise.reject(new Error('not matched'))
    })
    vi.stubGlobal('fetch', mockFetch)

    const cdnRelease = await fetchVersionFromCdn()
    expect(cdnRelease).not.toBeNull()
    expect(cdnRelease?.version).toBe('2.0.8')
    expect(cdnRelease?.tagName).toBe('v2.0.8')
    expect(cdnRelease?.downloadUrl).toContain('releases/download/v2.0.8/MoviePilot-Tools-v2.0.8-chrome.zip')
  })

  it('当 GitHub API 返回 403 Rate Limit 时，记录冷却时间并自动降级走 CDN', async () => {
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('api.github.com')) {
        return Promise.resolve({
          ok: false,
          status: 403,
          headers: new Headers({
            'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 1800),
          }),
          json: () =>
            Promise.resolve({
              message: 'API rate limit exceeded for 142.202.240.66.',
            }),
        })
      }
      if (url.includes('package.json')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ version: '2.1.0' }),
        })
      }
      return Promise.reject(new Error('unknown'))
    })
    vi.stubGlobal('fetch', mockFetch)

    const release = await fetchLatestExtensionRelease(true)
    expect(release).not.toBeNull()
    expect(release?.version).toBe('2.1.0')
    expect(getRateLimitResetUntil()).toBeGreaterThan(Date.now())
  })

  it('在 Rate Limit 冷却期且无新 Token 时，跳过 GitHub API 直接走 CDN 兜底', async () => {
    let githubApiCalled = false
    const mockFetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes('api.github.com')) {
        githubApiCalled = true
        return Promise.resolve({ ok: false, status: 403 })
      }
      if (url.includes('package.json')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ version: '2.2.0' }),
        })
      }
      return Promise.reject(new Error('unknown'))
    })
    vi.stubGlobal('fetch', mockFetch)

    // 首先触发一次 403 进入冷却状态
    await fetchLatestExtensionRelease(true)
    githubApiCalled = false

    // 第二次在冷却期请求，验证 GitHub API 被智能跳过
    const release = await fetchLatestExtensionRelease(true)
    expect(githubApiCalled).toBe(false)
    expect(release?.version).toBe('2.2.0')
  })
})

describe('extension-update: 下载镜像加速与一键下载', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('正确生成 GitHub 镜像加速链接，且避免重复嵌套前缀', () => {
    const raw = 'https://github.com/KoWming/MoviePilot-Tools/releases/download/v2.0.1/moviepilot.zip'
    const accelerated = getAcceleratedDownloadUrl(raw)
    expect(accelerated).toBe('https://ghfast.top/https://github.com/KoWming/MoviePilot-Tools/releases/download/v2.0.1/moviepilot.zip')

    // 重复包装不叠加
    expect(getAcceleratedDownloadUrl(accelerated)).toBe(accelerated)

    // 非 GitHub 链接保持不变
    expect(getAcceleratedDownloadUrl('https://example.com/file.zip')).toBe('https://example.com/file.zip')
  })

  it('一键下载默认启用加速镜像，调用 chrome.downloads.download', async () => {
    const mockDownload = vi.fn(
      (
        _options: chrome.downloads.DownloadOptions,
        callback?: (downloadId: number) => void,
      ) => {
        callback?.(1001)
      },
    )

    vi.stubGlobal('chrome', {
      runtime: { lastError: null },
      downloads: { download: mockDownload },
    })

    const release = {
      tagName: 'v2.0.1',
      version: '2.0.1',
      title: 'v2.0.1',
      body: '',
      publishedAt: '',
      htmlUrl: 'https://github.com/release/v2.0.1',
      downloadUrl: 'https://github.com/download/chrome.zip',
      assetName: 'MoviePilot-tools-2.0.1-chrome.zip',
    }

    await downloadExtensionUpdate(release)
    expect(mockDownload).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://ghfast.top/https://github.com/download/chrome.zip',
        filename: 'MoviePilot-tools-2.0.1-chrome.zip',
      }),
      expect.any(Function),
    )
  })

  it('指定 useMirror: false 时保持原始下载链接', async () => {
    const mockDownload = vi.fn(
      (
        _options: chrome.downloads.DownloadOptions,
        callback?: (downloadId: number) => void,
      ) => {
        callback?.(1002)
      },
    )

    vi.stubGlobal('chrome', {
      runtime: { lastError: null },
      downloads: { download: mockDownload },
    })

    const release = {
      tagName: 'v2.0.1',
      version: '2.0.1',
      title: 'v2.0.1',
      body: '',
      publishedAt: '',
      htmlUrl: 'https://github.com/release/v2.0.1',
      downloadUrl: 'https://github.com/download/chrome.zip',
      assetName: 'MoviePilot-tools-2.0.1-chrome.zip',
    }

    await downloadExtensionUpdate(release, { useMirror: false })
    expect(mockDownload).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://github.com/download/chrome.zip',
      }),
      expect.any(Function),
    )
  })

  it('当 chrome.downloads 触发 lastError 时回退到 window.open', async () => {
    const mockOpen = vi.fn()
    vi.stubGlobal('window', { open: mockOpen })

    vi.stubGlobal('chrome', {
      runtime: { lastError: { message: 'Download blocked' } },
      downloads: {
        download: (
          _options: unknown,
          callback?: (id?: number) => void,
        ) => {
          callback?.(undefined)
        },
      },
    })

    const release = {
      tagName: 'v2.0.1',
      version: '2.0.1',
      title: 'v2.0.1',
      body: '',
      publishedAt: '',
      htmlUrl: 'https://github.com/release/v2.0.1',
      downloadUrl: 'https://github.com/download/chrome.zip',
      assetName: 'chrome.zip',
    }

    await downloadExtensionUpdate(release, { useMirror: false })
    expect(mockOpen).toHaveBeenCalledWith('https://github.com/download/chrome.zip', '_blank')
  })
})

import { createMpApiClient } from '../shared/api/client';
import { STORAGE_KEYS } from '../shared/constants';
import {
  COOKIE_UA_AUTO_UPDATE_ALARM,
  getCookieUaAutoUpdateConfig,
  markDailyCookieUaUpdated,
  shouldRunDailyCookieUaUpdate
} from '../shared/cookieUaAutoUpdate';
import {
  getSiteAutoOpenConfig,
  markMonthlySiteAutoOpened,
  shouldRunMonthlySiteAutoOpen,
  SITE_AUTO_OPEN_ALARM,
  SITE_AUTO_OPEN_CLOSE_TABS_ALARM
} from '../shared/siteAutoOpen';
import type { Site } from '../shared/types/site';
import { recognizeCaptchaOffline } from './localOcr';
import { TOTPStorageService } from '../shared/services/totpStorage';
import { decryptApiToken, encryptApiToken } from '../shared/secureStorage';
import { PTCredentialStorageService } from '../shared/services/credentialStorage';

// ===== 安全模块：调试日志开关（生产环境关闭） =====
const DEBUG = false;
function debugLog(...args: unknown[]) {
  if (DEBUG) console.log(...args);
}
function debugWarn(...args: unknown[]) {
  if (DEBUG) console.warn(...args);
}
function debugError(...args: unknown[]) {
  if (DEBUG) console.error(...args);
}

// ===== 安全模块：运行时 Origin 验证白名单 =====
/**
 * 获取受信任的 Origin 列表（MP 服务器 + OCR Host + 下载器 + 已配置域名）
 */
async function getTrustedOrigins(): Promise<string[]> {
  const origins = new Set<string>();

  // MP 服务器
  try {
    const baseURL = (await chrome.storage.local.get([STORAGE_KEYS.BASE_URL]))[STORAGE_KEYS.BASE_URL] as string | undefined;
    if (baseURL) {
      try { origins.add(new URL(baseURL).origin); } catch { }
    }
  } catch { }

  // OCR Host
  try {
    const ocrData = await chrome.storage.local.get([STORAGE_KEYS.OCR_HOST]);
    const ocrHost = (ocrData[STORAGE_KEYS.OCR_HOST] as string) || 'https://movie-pilot.org';
    try { origins.add(new URL(ocrHost).origin); } catch { }
  } catch { }

  // 已配置站点域名
  try {
    const data = await chrome.storage.local.get([STORAGE_KEYS.ALLOWED_DOMAINS]);
    const domains = data[STORAGE_KEYS.ALLOWED_DOMAINS] as string[] | undefined;
    if (Array.isArray(domains)) {
      for (const d of domains) {
        origins.add(`https://${d}`);
        origins.add(`http://${d}`);
      }
    }
  } catch { }

  // 下载器地址 + 实时 OCR Host
  try {
    const client = await createClient();
    // 下载器（复用缓存）
    const dlConfigs = await getDownloaderConfigs();
    for (const d of dlConfigs) {
      const host = d?.config?.host;
      if (host) {
        try { origins.add(new URL(host.startsWith('http') ? host : `http://${host}`).origin); } catch { }
      }
    }
    // 实时 OCR Host（MP API 返回的可能与本地存储不同）
    try {
      const ocrResp = await client.get('/api/v1/system/setting/OCR_HOST');
      const ocrData = (ocrResp as any).data as any;
      const liveOcrHost = (ocrData?.value || ocrData?.data?.value || '') as string;
      if (liveOcrHost) {
        try { origins.add(new URL(liveOcrHost).origin); } catch { }
      }
    } catch { }
  } catch { }

  return Array.from(origins);
}

let _trustedOriginsCache: { origins: string[]; ts: number } | null = null;

/**
 * 验证目标 URL 的 Origin 是否在白名单中
 */
async function isTrustedOrigin(url: string): Promise<boolean> {
  try {
    const target = new URL(url);
    // 缓存 60 秒
    if (!_trustedOriginsCache || Date.now() - _trustedOriginsCache.ts > 60000) {
      _trustedOriginsCache = { origins: await getTrustedOrigins(), ts: Date.now() };
    }
    const trusted = _trustedOriginsCache.origins;
    return trusted.some(o => {
      try { return new URL(o).origin === target.origin; } catch { return false; }
    });
  } catch {
    return false;
  }
}

/**
 * 验证 OCR Host 是否安全（仅允许 http/https 协议，拒绝内网 IP）
 */
function isValidOcrHost(host: string): boolean {
  try {
    const u = new URL(host);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
    // 拒绝内网/环回地址被服务端配置注入
    const blocked = ['127.0.0.1', 'localhost', '0.0.0.0', '[::1]'];
    if (blocked.includes(u.hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

// ===== Token / BaseURL 迁移：sync → local（一次性，兼容旧版本升级） =====
let _migrationDone = false;

async function migrateTokenFromSync(): Promise<void> {
  if (_migrationDone) return;
  _migrationDone = true;
  try {
    const localData = await chrome.storage.local.get([STORAGE_KEYS.TOKEN, STORAGE_KEYS.BASE_URL]);
    const syncData = await chrome.storage.sync.get([STORAGE_KEYS.TOKEN, STORAGE_KEYS.BASE_URL]);

    const localToken = localData[STORAGE_KEYS.TOKEN] as string | undefined;
    const localBaseUrl = localData[STORAGE_KEYS.BASE_URL] as string | undefined;
    const syncToken = syncData[STORAGE_KEYS.TOKEN] as string | undefined;
    const syncBaseUrl = syncData[STORAGE_KEYS.BASE_URL] as string | undefined;

    // local 已有数据 → 无需迁移
    if (localToken || localBaseUrl) return;

    // sync 有数据 → 迁移到 local
    if (syncToken || syncBaseUrl) {
      const toSet: Record<string, string> = {};
      if (syncToken) toSet[STORAGE_KEYS.TOKEN] = syncToken;
      if (syncBaseUrl) toSet[STORAGE_KEYS.BASE_URL] = syncBaseUrl;
      await chrome.storage.local.set(toSet);
    }
  } catch { /* 静默失败，后续 getToken/getBaseUrl 会正常处理 */ }
}

// 扩展安装/升级时执行迁移
chrome.runtime.onInstalled.addListener(() => {
  migrateTokenFromSync();
});

// 首次启动时也执行迁移（覆盖非安装触发的场景）
migrateTokenFromSync();

async function getToken(): Promise<string | undefined> {
  // 先从 local 读取，读不到尝试 sync 回退迁移
  const localData = await chrome.storage.local.get([STORAGE_KEYS.TOKEN]);
  const token = localData[STORAGE_KEYS.TOKEN] as string | undefined;
  if (token) return token;

  // 回退：尝试从 sync 读取并迁移
  try {
    const syncData = await chrome.storage.sync.get([STORAGE_KEYS.TOKEN]);
    const syncToken = syncData[STORAGE_KEYS.TOKEN] as string | undefined;
    if (syncToken) {
      await chrome.storage.local.set({ [STORAGE_KEYS.TOKEN]: syncToken });
      return syncToken;
    }
  } catch { }
  return undefined;
}

async function getBaseUrl(): Promise<string> {
  // 先从 local 读取
  const localData = await chrome.storage.local.get([STORAGE_KEYS.BASE_URL]);
  const baseUrl = localData[STORAGE_KEYS.BASE_URL] as string | undefined;
  if (baseUrl) return baseUrl;

  // 回退：尝试从 sync 读取并迁移
  try {
    const syncData = await chrome.storage.sync.get([STORAGE_KEYS.BASE_URL]);
    const syncBaseUrl = syncData[STORAGE_KEYS.BASE_URL] as string | undefined;
    if (syncBaseUrl) {
      await chrome.storage.local.set({ [STORAGE_KEYS.BASE_URL]: syncBaseUrl });
      return syncBaseUrl;
    }
  } catch { }
  return '';
}

async function createClient() {
  const baseURL = await getBaseUrl();
  return createMpApiClient({ baseURL, getToken });
}

async function getSites(): Promise<Site[]> {
  const client = await createClient();
  const resp = await client.get('/api/v1/site/');
  const data = (resp as any).data as any;
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.data)) return data.data;
  if (data && Array.isArray(data.sites)) return data.sites;
  if (data && Array.isArray(data.items)) return data.items;
  return [];
}

async function getBrowserCookies(url: string): Promise<string> {
  try {
    const domain = new URL(url).hostname;
    const cookies = await chrome.cookies.getAll({ domain });
    return cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
  } catch (error) {
    debugError('自动更新获取浏览器 Cookie 失败:', error);
    return '';
  }
}

// 规范化 Cookie 字符串为 Map（忽略顺序/空格/换行差异）
function normalizeCookies(cookieStr: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!cookieStr) return map;
  const parts = cookieStr.split(/[;\n]/);
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const name = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (name) map.set(name, value);
  }
  return map;
}

// 比较两组 Cookie 字符串是否内容一致（忽略顺序/格式差异）
function isSameCookie(a: string, b: string): boolean {
  const mapA = normalizeCookies(a);
  const mapB = normalizeCookies(b);
  if (mapA.size !== mapB.size) return false;
  for (const [name, value] of mapA) {
    if (!mapB.has(name) || mapB.get(name) !== value) return false;
  }
  return true;
}

async function isSiteAutoUpdateDisabled(site: Site): Promise<boolean> {
  try {
    const domain = new URL(site.url).hostname;
    const storageKey = `site_disable_${domain}`;
    const data = await chrome.storage.local.get([storageKey]);
    return Boolean(data[storageKey] || site.isDisabled);
  } catch {
    return Boolean(site.isDisabled);
  }
}

async function isSiteDisabled(site: Site): Promise<boolean> {
  try {
    const url = site.url || `https://${site.domain}`;
    const domain = new URL(url).hostname;
    const storageKey = `site_disable_${domain}`;
    const data = await chrome.storage.local.get([storageKey]);
    return Boolean(data[storageKey] || site.isDisabled);
  } catch {
    return Boolean(site.isDisabled);
  }
}

async function autoUpdateCookieAndUserAgent(reason: 'daily' | 'interval'): Promise<{ success: number; skipped: number; failed: number }> {
  const baseURL = await getBaseUrl();
  const token = await getToken();
  if (!baseURL || !token) return { success: 0, skipped: 0, failed: 0 };

  const client = await createClient();
  const sites = await getSites();
  const browserUA = navigator.userAgent;
  let success = 0;
  let skipped = 0;
  let failed = 0;

  for (const site of sites) {
    try {
      if (!site?.url || !site.is_active || site.apikey || site.token || await isSiteAutoUpdateDisabled(site)) {
        skipped++;
        continue;
      }

      const browserCookies = await getBrowserCookies(site.url);
      if (!browserCookies) {
        skipped++;
        continue;
      }

      if (isSameCookie((site.cookie || ''), browserCookies) && (site.ua || '') === browserUA) {
        skipped++;
        continue;
      }

      await client.put('/api/v1/site/', {
        ...site,
        cookie: browserCookies,
        ua: browserUA
      });
      success++;
    } catch (error) {
      failed++;
      debugError(`自动更新站点 ${site?.name || site?.domain || site?.url} 失败:`, error);
    }
  }

  debugLog(`Cookie/UA 自动更新完成(${reason})：成功 ${success}，跳过 ${skipped}，失败 ${failed}`);
  return { success, skipped, failed };
}

async function configureCookieUaAutoUpdateAlarm(): Promise<void> {
  const config = await getCookieUaAutoUpdateConfig();
  await chrome.alarms.clear(COOKIE_UA_AUTO_UPDATE_ALARM);
  if (!config.intervalEnabled) return;
  chrome.alarms.create(COOKIE_UA_AUTO_UPDATE_ALARM, {
    periodInMinutes: config.intervalMinutes,
    delayInMinutes: config.intervalMinutes
  });
}

async function runDailyCookieUaAutoUpdateIfNeeded(): Promise<void> {
  const config = await getCookieUaAutoUpdateConfig();
  if (!config.dailyFirstEnabled) return;
  if (!await shouldRunDailyCookieUaUpdate()) return;
  await autoUpdateCookieAndUserAgent('daily');
  await markDailyCookieUaUpdated();
}

async function initializeCookieUaAutoUpdate(): Promise<void> {
  await configureCookieUaAutoUpdateAlarm();
  await runDailyCookieUaAutoUpdateIfNeeded();
}

async function configureSiteAutoOpenAlarm(): Promise<void> {
  const config = await getSiteAutoOpenConfig();
  await chrome.alarms.clear(SITE_AUTO_OPEN_ALARM);
  if (!config.intervalEnabled) return;
  const periodInMinutes = config.intervalDays * 24 * 60;
  chrome.alarms.create(SITE_AUTO_OPEN_ALARM, {
    periodInMinutes,
    delayInMinutes: periodInMinutes
  });
}

async function openAllConfiguredSites(reason: 'monthly' | 'interval'): Promise<{ opened: number; skipped: number }> {
  const baseURL = await getBaseUrl();
  const token = await getToken();
  if (!baseURL || !token) return { opened: 0, skipped: 0 };

  const sites = await getSites();
  const openedTabIds: number[] = [];
  let opened = 0;
  let skipped = 0;
  const maxConcurrent = 5;

  const openableSites: Site[] = [];
  for (const site of sites) {
    if (!site || !site.is_active || await isSiteDisabled(site)) {
      skipped++;
      continue;
    }
    const siteUrl = site.url || (site.domain ? `https://${site.domain}` : '');
    if (!siteUrl) {
      skipped++;
      continue;
    }
    openableSites.push(site);
  }

  for (let i = 0; i < openableSites.length; i += maxConcurrent) {
    const batch = openableSites.slice(i, i + maxConcurrent);
    const tabs = await Promise.all(batch.map(async (site) => {
      const url = site.url || `https://${site.domain}`;
      return chrome.tabs.create({ url, active: false });
    }));
    for (const tab of tabs) {
      if (typeof tab.id === 'number') openedTabIds.push(tab.id);
    }
    opened += tabs.length;

    if (i + maxConcurrent < openableSites.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  const config = await getSiteAutoOpenConfig();
  if (config.autoCloseEnabled && openedTabIds.length > 0) {
    await chrome.storage.local.set({ [STORAGE_KEYS.SITE_AUTO_OPEN_TABS]: openedTabIds });
    await chrome.alarms.clear(SITE_AUTO_OPEN_CLOSE_TABS_ALARM);
    chrome.alarms.create(SITE_AUTO_OPEN_CLOSE_TABS_ALARM, { delayInMinutes: config.closeDelayMinutes });
  }

  debugLog(`自动打开站点完成(${reason})：打开 ${opened}，跳过 ${skipped}`);
  return { opened, skipped };
}

async function closeAutoOpenedTabs(): Promise<void> {
  const data = await chrome.storage.local.get([STORAGE_KEYS.SITE_AUTO_OPEN_TABS]);
  const tabIds = data[STORAGE_KEYS.SITE_AUTO_OPEN_TABS] as number[] | undefined;
  if (!Array.isArray(tabIds) || tabIds.length === 0) return;

  const config = await getSiteAutoOpenConfig();
  const loginTitlePattern = /(登录|登陆|login|sign\s*in|signin)/i;

  for (const tabId of tabIds) {
    try {
      if (config.keepLoginTabsEnabled) {
        const tab = await chrome.tabs.get(tabId);
        if (tab.title && loginTitlePattern.test(tab.title)) {
          continue;
        }
      }
      await chrome.tabs.remove(tabId);
    } catch { }
  }
  await chrome.storage.local.remove([STORAGE_KEYS.SITE_AUTO_OPEN_TABS]);
}

async function runMonthlySiteAutoOpenIfNeeded(): Promise<void> {
  const config = await getSiteAutoOpenConfig();
  if (!config.monthlyFirstEnabled) return;
  if (!await shouldRunMonthlySiteAutoOpen()) return;
  await openAllConfiguredSites('monthly');
  await markMonthlySiteAutoOpened();
}

async function initializeSiteAutoOpen(): Promise<void> {
  await configureSiteAutoOpenAlarm();
  await runMonthlySiteAutoOpenIfNeeded();
}

function extractCaptchaCode(text: string): string {
  const normalized = (text || '').trim();
  if (!normalized) return '';
  const bracketMatch = normalized.match(/[【\[\(（]?([A-Za-z0-9]{3,8})[】\]\)）]?/);
  return (bracketMatch?.[1] || '').trim();
}

async function isAiAgentEnabled(client: Awaited<ReturnType<typeof createClient>>): Promise<boolean> {
  try {
    const resp = await client.get('/api/v1/system/global/user');
    const data = (resp as any).data as any;
    const enabled = Boolean(data?.data?.AI_AGENT_ENABLE ?? data?.AI_AGENT_ENABLE);
    debugLog('[MP 验证码识别] isAiAgentEnabled 结果:', enabled);
    return enabled;
  } catch (e) {
    debugLog('[MP 验证码识别] isAiAgentEnabled 查询失败:', e);
    return false;
  }
}

async function recognizeCaptchaByAi(base64Img: string): Promise<string> {
  const baseURL = (await getBaseUrl()).replace(/\/$/, '');
  if (!baseURL) return '';

  // 使用 API_TOKEN 认证（OpenAI 兼容接口需要，默认 "moviepilot"）
  let apiToken: string | undefined;
  const apiTokenData = await chrome.storage.local.get([STORAGE_KEYS.API_TOKEN]);
  const rawLocal = apiTokenData[STORAGE_KEYS.API_TOKEN];
  apiToken = await decryptApiToken(rawLocal);

  // 兼容旧版本：sync 回退
  if (!apiToken) {
    try {
      const sd = await chrome.storage.sync.get([STORAGE_KEYS.API_TOKEN]);
      const rawSync = sd[STORAGE_KEYS.API_TOKEN];
      apiToken = await decryptApiToken(rawSync);
      if (apiToken) {
        const encrypted = await encryptApiToken(apiToken);
        await chrome.storage.local.set({ [STORAGE_KEYS.API_TOKEN]: encrypted });
      }
    } catch { }
  }
  if (!apiToken) apiToken = 'moviepilot';

  const aiUrl = `${baseURL}/api/v1/openai/v1/chat/completions`;
  if (!await isTrustedOrigin(aiUrl)) {
    debugError('[MP Security] AI 接口 Origin 不在白名单，已拒绝:', aiUrl);
    return '';
  }

  const resp = await fetch(aiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'moviepilot-agent',
      user: 'mp-extension-captcha',
      stream: false,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: '请识别图片验证码。只返回验证码字符本身，不要解释，不要添加标点。验证码通常由3到8位英文字母或数字组成。'
            },
            {
              type: 'image_url',
              image_url: { url: `data:image/png;base64,${base64Img}` }
            }
          ]
        }
      ]
    })
  });

  debugLog('[MP 验证码识别] AI 接口响应状态:', resp.status, resp.statusText);
  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    debugLog('[MP 验证码识别] AI 接口错误:', resp.status);
    return '';
  }
  const data = await resp.json();
  debugLog('[MP 验证码识别] AI 识别完成');
  return extractCaptchaCode(data?.choices?.[0]?.message?.content || '');
}

async function recognizeCaptchaByOcr(base64Img: string, client: Awaited<ReturnType<typeof createClient>>): Promise<string> {
  let ocrHost = 'https://movie-pilot.org';
  try {
    const resp = await client.get('/api/v1/system/setting/OCR_HOST');
    const data = (resp as any).data as any;
    ocrHost = (data?.value || data?.data?.value || 'https://movie-pilot.org') as string;
  } catch { /* 降级使用默认OCR地址 */ }

  // 安全：验证 OCR Host 合法性
  if (!isValidOcrHost(ocrHost)) {
    debugError('[MP Security] OCR Host 不合法，已拒绝:', ocrHost);
    return '';
  }

  const ocrUrl = `${ocrHost.replace(/\/$/, '')}/captcha/base64`;
  try {
    new URL(ocrUrl); // 二次校验 URL 合法性
  } catch {
    debugError('[MP Security] OCR URL 解析失败:', ocrUrl);
    return '';
  }

  if (!await isTrustedOrigin(ocrUrl)) {
    debugError('[MP Security] OCR 服务 Origin 不在白名单，已拒绝:', ocrUrl);
    return '';
  }

  const ocrResp = await fetch(ocrUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64_img: base64Img })
  });

  if (!ocrResp.ok) return '';
  const ocrData = await ocrResp.json();
  return ((ocrData.result || '') as string).trim();
}

/**
 * 拉取 MP 已配置站点域名并缓存到 storage.local
 */
async function refreshAllowedDomains(): Promise<string[]> {
  const client = await createClient();
  const resp = await client.get('/api/v1/site/');
  const data = (resp as any).data as any;

  const domains = new Set<string>();
  const pushHost = (value?: string) => {
    if (!value) return;
    try {
      const v = value.trim();
      if (!v) return;
      // 如果是 URL，解析 host；否则认为是域名
      let host = v;
      if (/^https?:\/\//i.test(v)) {
        host = new URL(v).hostname;
      }
      host = host.toLowerCase();
      if (host && /[a-z0-9-]+(\.[a-z0-9-]+)+/.test(host)) domains.add(host);
    } catch { }
  };

  const handleItem = (item: any) => {
    if (!item || typeof item !== 'object') return;
    // 常见字段尝试解析
    pushHost(item.domain);
    pushHost(item.host);
    pushHost(item.url);
    pushHost(item.base_url);
    pushHost(item.baseURL);
    pushHost(item.website);
    // 可能的列表字段
    const lists = [item.domains, item.domain_list, item.hosts];
    for (const list of lists) {
      if (Array.isArray(list)) {
        for (const v of list) pushHost(typeof v === 'string' ? v : undefined);
      }
    }
    // 可能的 RSS 地址
    pushHost(item.rss);
  };

  if (Array.isArray(data)) {
    for (const it of data) handleItem(it);
  } else if (data && typeof data === 'object') {
    // 兼容形如 { sites: [...] }
    const sites = (data.sites || data.items || data.data) as any[] | undefined;
    if (Array.isArray(sites)) {
      for (const it of sites) handleItem(it);
    } else {
      handleItem(data);
    }
  }

  const list = Array.from(domains);
  await chrome.storage.local.set({
    [STORAGE_KEYS.ALLOWED_DOMAINS]: list,
    [STORAGE_KEYS.ALLOWED_DOMAINS_UPDATED_AT]: Date.now()
  });
  return list;
}

/**
 * 直连下载器：跳过 MP 媒体识别，直接推送种子到 qBittorrent/Transmission
 */
async function handleDirectDownload(msg: any): Promise<{ success: boolean; error?: string; message?: string }> {
  const enclosure = msg?.enclosure as string | undefined;
  const pageUrl = msg?.pageUrl as string | undefined;
  const siteDomain = msg?.siteDomain as string | undefined;
  const siteCookie = msg?.siteCookie as string | undefined;
  const siteUa = (msg?.siteUa as string) || navigator.userAgent;
  const downloaderName = msg?.downloader as string | undefined;
  const savePath = msg?.savePath as string | undefined;
  const title = (msg?.title as string) || '未知种子';
  const label = (msg?.label as string) || 'MOVIEPILOT';

  if (!siteDomain || !downloaderName) {
    return { success: false, error: '缺少必要参数 (siteDomain/downloader)' };
  }

  // 1. 获取下载器完整配置
  const dlConfig = await getDownloaderConfig(downloaderName);
  if (!dlConfig) {
    return { success: false, error: `未找到启用的下载器: ${downloaderName}` };
  }
  const cfg = dlConfig.config || {};
  const host = cfg.host || '';
  const dlType = dlConfig.type || '';

  debugLog('[MP 直连下载] 下载器:', sanitizeDlConfig(dlConfig));

  // 2. 获取 .torrent 下载链接
  let torrentUrl = enclosure;
  if (!torrentUrl && pageUrl) {
    try {
      const u = new URL(pageUrl);
      if (u.pathname.includes('details')) {
        torrentUrl = pageUrl.replace(/details\.php/, 'download.php');
      } else if (u.searchParams.has('id')) {
        torrentUrl = `${u.origin}/download.php?id=${u.searchParams.get('id')}`;
      }
    } catch { /* ignore */ }
  }
  if (!torrentUrl) {
    return { success: false, error: '无法获取种子下载链接' };
  }

  // 获取站点 Cookie
  let cookie = siteCookie || '';
  if (!cookie && siteDomain) {
    try {
      const cookies = await chrome.cookies.getAll({ domain: siteDomain });
      cookie = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    } catch { }
  }

  debugLog('[MP 直连下载] 下载种子:', torrentUrl.substring(0, 100));

  // 3. 下载 .torrent
  const isMagnet = torrentUrl.startsWith('magnet:');
  let torrentContent: ArrayBuffer;
  if (isMagnet) {
    torrentContent = new TextEncoder().encode(torrentUrl).buffer;
  } else {
    if (!await isTrustedOrigin(torrentUrl)) {
      return { success: false, error: '种子下载链接 Origin 不在白名单' };
    }
    const dlResp = await fetch(torrentUrl, {
      headers: { 'Cookie': cookie, 'User-Agent': siteUa },
      redirect: 'follow'
    });
    if (!dlResp.ok) {
      return { success: false, error: `下载种子失败: HTTP ${dlResp.status}` };
    }
    torrentContent = await dlResp.arrayBuffer();
    if (torrentContent.byteLength < 100) {
      return { success: false, error: '下载的种子文件异常（文件过小）' };
    }
  }

  debugLog('[MP 直连下载] 种子大小:', torrentContent.byteLength, 'bytes');

  // 4. 推送到下载器
  const scheme = host.startsWith('http') ? '' : 'http://';
  const dlHost = `${scheme}${host}`;

  if (dlType === 'qbittorrent') {
    return await pushToQbittorrent(dlHost, cfg, torrentContent, isMagnet, title, savePath, label);
  } else if (dlType === 'transmission') {
    return await pushToTransmission(dlHost, cfg, torrentContent, isMagnet, savePath, label);
  }
  return { success: false, error: `不支持的下载器类型: ${dlType}` };
}

type DirectTorrentState = 'downloading' | 'paused' | 'completed' | 'error';

/** 脱敏下载器配置，用于日志输出 */
function sanitizeDlConfig(dlConfig: any): string {
  if (!dlConfig) return '(无)';
  const cfg = { ...dlConfig.config };
  if (cfg.password) cfg.password = '***';
  if (cfg.username) cfg.username = cfg.username.slice(0, 2) + '***';
  return JSON.stringify({ name: dlConfig.name, type: dlConfig.type, config: cfg });
}

async function getDownloaderConfig(downloaderName?: string): Promise<any | undefined> {
  if (!downloaderName) return undefined;
  const configs = await getDownloaderConfigs();
  return configs.find(
    (d: any) => d.name === downloaderName && d.enabled
  );
}

/** 全量下载器配置缓存（5 分钟），减少 MP API 调用 */
let _dlConfigsCache: { configs: any[]; ts: number } | null = null;

async function getDownloaderConfigs(): Promise<any[]> {
  if (_dlConfigsCache && Date.now() - _dlConfigsCache.ts < 300_000) {
    return _dlConfigsCache.configs;
  }
  const client = await createClient();
  const dlConfigResp = await client.get('/api/v1/system/setting/Downloaders');
  const dlConfigData = (dlConfigResp as any).data as any;
  const rawConfigs = dlConfigData?.data?.value || dlConfigData?.value || [];
  const configs = Array.isArray(rawConfigs) ? rawConfigs : [];
  _dlConfigsCache = { configs, ts: Date.now() };
  return configs;
}

async function handleDirectTorrentStates(msg: any): Promise<{ success: boolean; states?: Record<string, DirectTorrentState>; error?: string }> {
  const downloaderName = msg?.downloader as string | undefined;
  const hashes: string[] = Array.from(new Set<string>((Array.isArray(msg?.hashes) ? msg.hashes : [])
    .map((hash: unknown) => String(hash || '').trim().toLowerCase())
    .filter(Boolean)));
  if (!downloaderName || hashes.length === 0) {
    return { success: false, error: '缺少必要参数 (downloader/hashes)' };
  }

  const dlConfig = await getDownloaderConfig(downloaderName);
  if (!dlConfig) {
    return { success: false, error: `未找到启用的下载器: ${downloaderName}` };
  }

  const cfg = dlConfig.config || {};
  const host = cfg.host || '';
  const dlType = dlConfig.type || '';
  const scheme = host.startsWith('http') ? '' : 'http://';
  const dlHost = `${scheme}${host}`;

  if (dlType === 'qbittorrent') {
    return { success: true, states: await getQbittorrentTorrentStates(dlHost, cfg, hashes) };
  }
  if (dlType === 'transmission') {
    return { success: true, states: await getTransmissionTorrentStates(dlHost, cfg, hashes) };
  }
  return { success: false, error: `不支持的下载器类型: ${dlType}` };
}

function normalizeQbittorrentState(state: string, progress?: number): DirectTorrentState {
  const value = String(state || '').toLowerCase();
  if (value.includes('error') || value.includes('missing') || value === 'unknown') return 'error';
  if (value.includes('pause') || value.includes('stopped')) return 'paused';
  if (progress !== undefined && progress >= 1) return 'completed';
  return 'downloading';
}

async function getQbittorrentTorrentStates(dlHost: string, cfg: Record<string, any>, hashes: string[]): Promise<Record<string, DirectTorrentState>> {
  const qbStatusLoginUrl = `${dlHost}/api/v2/auth/login`;
  if (!await isTrustedOrigin(qbStatusLoginUrl)) {
    throw new Error('qBittorrent 地址不在白名单');
  }
  const loginBody = new URLSearchParams();
  loginBody.set('username', cfg.username || '');
  loginBody.set('password', cfg.password || '');
  const loginResp = await fetch(qbStatusLoginUrl, {
    method: 'POST', body: loginBody,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  if (!loginResp.ok) throw new Error('qBittorrent 登录失败，请检查地址和账号密码');
  const sidCookie = loginResp.headers.get('set-cookie')?.match(/SID=([^;]+)/)?.[1] || '';

  const params = new URLSearchParams();
  params.set('hashes', hashes.join('|'));
  const resp = await fetch(`${dlHost}/api/v2/torrents/info?${params.toString()}`, {
    headers: { 'Cookie': `SID=${sidCookie}` }
  });
  if (!resp.ok) throw new Error(`qBittorrent 查询状态失败: HTTP ${resp.status}`);
  const torrents = await resp.json();
  const states: Record<string, DirectTorrentState> = {};
  if (Array.isArray(torrents)) {
    for (const torrent of torrents) {
      const hash = String(torrent?.hash || '').toLowerCase();
      if (!hash) continue;
      states[hash] = normalizeQbittorrentState(torrent?.state, torrent?.progress);
    }
  }
  return states;
}

function normalizeTransmissionState(status: number, percentDone?: number): DirectTorrentState {
  if (status === 0) return 'paused';
  if (percentDone !== undefined && percentDone >= 1) return 'completed';
  return 'downloading';
}

async function getTransmissionSessionId(dlHost: string, authHeader: string): Promise<string> {
  const resp = await fetch(`${dlHost}/transmission/rpc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': authHeader }
  });
  return resp.headers.get('X-Transmission-Session-Id') || '';
}

async function getTransmissionTorrentStates(dlHost: string, cfg: Record<string, any>, hashes: string[]): Promise<Record<string, DirectTorrentState>> {
  const authHeader = cfg.username
    ? 'Basic ' + btoa(`${cfg.username}:${cfg.password}`)
    : '';
  const trStatusUrl = `${dlHost}/transmission/rpc`;
  if (!await isTrustedOrigin(trStatusUrl)) {
    throw new Error('Transmission 地址不在白名单');
  }
  const sessionId = await getTransmissionSessionId(dlHost, authHeader);
  const resp = await fetch(trStatusUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Transmission-Session-Id': sessionId,
      'Authorization': authHeader
    },
    body: JSON.stringify({
      method: 'torrent-get',
      arguments: {
        ids: hashes,
        fields: ['hashString', 'status', 'percentDone']
      }
    })
  });
  if (!resp.ok) throw new Error(`Transmission 查询状态失败: HTTP ${resp.status}`);
  const data = await resp.json();
  if (data?.result !== 'success') throw new Error(`Transmission 查询状态失败: ${data?.result || '未知错误'}`);
  const states: Record<string, DirectTorrentState> = {};
  const torrents = data?.arguments?.torrents || [];
  if (Array.isArray(torrents)) {
    for (const torrent of torrents) {
      const hash = String(torrent?.hashString || '').toLowerCase();
      if (!hash) continue;
      states[hash] = normalizeTransmissionState(Number(torrent?.status), torrent?.percentDone);
    }
  }
  return states;
}

async function pushToQbittorrent(
  dlHost: string, cfg: Record<string, any>,
  torrentContent: ArrayBuffer, isMagnet: boolean,
  title: string, savePath?: string, label?: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  // 登录
  const qbLoginUrl = `${dlHost}/api/v2/auth/login`;
  if (!await isTrustedOrigin(qbLoginUrl)) {
    return { success: false, error: 'qBittorrent 地址不在白名单' };
  }
  const loginBody = new URLSearchParams();
  loginBody.set('username', cfg.username || '');
  loginBody.set('password', cfg.password || '');
  const loginResp = await fetch(qbLoginUrl, {
    method: 'POST', body: loginBody,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  });
  if (!loginResp.ok) {
    return { success: false, error: 'qBittorrent 登录失败，请检查地址和账号密码' };
  }
  const sidCookie = loginResp.headers.get('set-cookie')?.match(/SID=([^;]+)/)?.[1] || '';

  // 添加种子
  const qbAddUrl = `${dlHost}/api/v2/torrents/add`;
  const formData = new FormData();
  const blob = new Blob([torrentContent], isMagnet ? { type: 'text/plain' } : { type: 'application/x-bittorrent' });
  formData.append('torrents', blob, isMagnet ? 'magnet.txt' : `${title}.torrent`);
  if (savePath) formData.append('savepath', savePath);
  formData.append('category', '');
  formData.append('tags', label || 'MOVIEPILOT');
  formData.append('paused', 'false');

  const addResp = await fetch(qbAddUrl, {
    method: 'POST', body: formData,
    headers: { 'Cookie': `SID=${sidCookie}` }
  });
  if (!addResp.ok) {
    return { success: false, error: `qBittorrent 添加种子失败: HTTP ${addResp.status}` };
  }
  return { success: true, message: '已推送到 qBittorrent' };
}

async function pushToTransmission(
  dlHost: string, cfg: Record<string, any>,
  torrentContent: ArrayBuffer, isMagnet: boolean,
  savePath?: string, label?: string
): Promise<{ success: boolean; error?: string; message?: string }> {
  const authHeader = cfg.username
    ? 'Basic ' + btoa(`${cfg.username}:${cfg.password}`)
    : '';

  // 获取 session id
  const trSessionUrl = `${dlHost}/transmission/rpc`;
  if (!await isTrustedOrigin(trSessionUrl)) {
    return { success: false, error: 'Transmission 地址不在白名单' };
  }
  const sessionResp = await fetch(trSessionUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': authHeader }
  });
  const sessionId = sessionResp.headers.get('X-Transmission-Session-Id') || '';

  // 添加种子
  let trBody: string;
  if (isMagnet) {
    trBody = JSON.stringify({
      method: 'torrent-add',
      arguments: {
        filename: new TextDecoder().decode(torrentContent),
        'download-dir': savePath || '',
        paused: false
      }
    });
  } else {
    const bytes = new Uint8Array(torrentContent);
    const base64 = btoa(String.fromCharCode(...bytes));
    trBody = JSON.stringify({
      method: 'torrent-add',
      arguments: {
        metainfo: base64,
        'download-dir': savePath || '',
        paused: false,
        labels: [label || 'MOVIEPILOT']
      }
    });
  }

  const trResp = await fetch(trSessionUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Transmission-Session-Id': sessionId,
      'Authorization': authHeader
    },
    body: trBody
  });
  if (!trResp.ok) {
    return { success: false, error: `Transmission 添加种子失败: HTTP ${trResp.status}` };
  }
  const trResult = await trResp.json();
  if (trResult.result !== 'success') {
    return { success: false, error: `Transmission 添加种子失败: ${trResult.result}` };
  }
  return { success: true, message: '已推送到 Transmission' };
}

chrome.runtime.onInstalled.addListener(async () => {
  // 先清除已有的菜单项，避免更新/重载时重复创建
  await chrome.contextMenus.removeAll();
  chrome.contextMenus.create({ id: 'mp-open', title: 'Open MoviePilot', contexts: ['action'] });
});

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId === 'mp-open') {
    chrome.action.openPopup?.();
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // ===== 安全：验证消息来源为自身扩展 =====
  if (!sender || sender.id !== chrome.runtime.id) {
    debugWarn('[MP Security] 拒绝来自非自身扩展的消息:', sender?.id);
    return false;
  }

  if (msg?.type === 'MP_PING') {
    sendResponse({ ok: true });
    return true;
  }
  if (msg?.type === 'MP_PT_OPEN_DOWNLOAD') {
    const url = msg?.url as string | undefined;
    const title = msg?.title as string | undefined;
    const route = { path: '/download', query: { from: 'pt-float', url, title } } as const;
    // 通过 storage 传递路由到 popup，避免 runtime.sendMessage 在 popup 未就绪时报错
    const navigate = () => {
      chrome.storage.local.set({ 'mp.pending_route': route }).finally(() => {
        sendResponse({ success: true });
      });
    };
    const tryOpen = chrome.action.openPopup?.();
    if (tryOpen && typeof (tryOpen as Promise<void>).then === 'function') {
      (tryOpen as Promise<void>).then(navigate).catch(navigate);
      return true;
    }
    navigate();
    return true;
  }
  if (msg?.type === 'MP_FETCH_EXAMPLE') {
    (async () => {
      try {
        const client = await createClient();
        // 使用公开可访问的接口作为连通性测试
        const resp = await client.get('/api/v1/login/wallpaper');
        sendResponse({ ok: true, data: resp.data });
      } catch (e) {
        sendResponse({ ok: false, error: (e as Error).message });
      }
    })();
    return true;
  }
  if (msg?.type === 'MP_REFRESH_ALLOWED_DOMAINS') {
    (async () => {
      try {
        const list = await refreshAllowedDomains();
        sendResponse({ ok: true, domains: list });
      } catch (e) {
        sendResponse({ ok: false, error: (e as Error).message });
      }
    })();
    return true;
  }
  if (msg?.type === 'MP_FETCH_IMAGE_BASE64') {
    (async () => {
      try {
        const url = msg?.url as string | undefined;
        if (!url) { sendResponse({ ok: false, error: '缺少 url' }); return; }
        if (!await isTrustedOrigin(url)) {
          sendResponse({ ok: false, error: '图片链接 Origin 不在白名单' });
          return;
        }
        const resp = await fetch(url);
        if (!resp.ok) { sendResponse({ ok: false, error: `HTTP ${resp.status}` }); return; }
        const blob = await resp.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          const base64 = dataUrl.split(',')[1] || '';
          sendResponse({ ok: true, base64 });
        };
        reader.onerror = () => sendResponse({ ok: false, error: 'FileReader 失败' });
        reader.readAsDataURL(blob);
      } catch (e) {
        sendResponse({ ok: false, error: (e as Error).message });
      }
    })();
    return true;
  }
  if (msg?.type === 'MP_GET_OCR_HOST') {
    (async () => {
      try {
        const client = await createClient();
        const resp = await client.get('/api/v1/system/setting/OCR_HOST');
        const data = (resp as any).data as any;
        const ocrHost = (data?.value || data?.data?.value || 'https://movie-pilot.org') as string;
        sendResponse({ ok: true, ocrHost });
      } catch (e) {
        sendResponse({ ok: false, error: (e as Error).message });
      }
    })();
    return true;
  }
  if (msg?.type === 'MP_RECOGNIZE_CAPTCHA') {
    (async () => {
      try {
        const base64Img = msg?.base64Img as string | undefined;
        const aiAssistEnabled = msg?.aiAssistEnabled === true;
        const offlineOcrEnabled = msg?.offlineOcrEnabled === true;
        if (!base64Img) { sendResponse({ success: false, error: '缺少 base64Img' }); return; }

        debugLog('[MP 验证码识别] 收到识别请求, aiAssistEnabled:', aiAssistEnabled, 'offlineOcrEnabled:', offlineOcrEnabled);

        const client = await createClient();

        // 离线 OCR（快速路径，无需服务端通信）
        if (offlineOcrEnabled) {
          let offlineError = '';
          const offlineCode = await recognizeCaptchaOffline(base64Img).catch(error => {
            offlineError = (error as Error).message || '未知错误';
            debugLog('[MP 验证码识别] 离线 OCR 异常:', offlineError);
            return '';
          });
          if (offlineCode) {
            debugLog('[MP 验证码识别] 离线 OCR 识别成功');
            sendResponse({ success: true, code: offlineCode, provider: 'offline', offlineCode });
            return;
          }
          debugLog('[MP 验证码识别] 离线 OCR 未能识别:', offlineError);
          sendResponse({ success: false, error: offlineError || '离线 OCR 未能识别验证码' });
          return;
        }

        // 服务端识别（OCR + 可选 AI）
        const agentEnabled = aiAssistEnabled ? await isAiAgentEnabled(client) : false;
        debugLog('[MP 验证码识别] AI辅助已开启, 智能助手状态:', agentEnabled);

        const [aiCode, serverOcrCode] = await Promise.all([
          agentEnabled ? recognizeCaptchaByAi(base64Img) : Promise.resolve(''),
          recognizeCaptchaByOcr(base64Img, client)
        ]);

        debugLog('[MP 验证码识别] AI:', aiCode ? '(有结果)' : '(无结果)', '服务端OCR:', serverOcrCode ? '(有结果)' : '(无结果)');

        // AI + 服务端 OCR 都有结果
        if (aiCode && serverOcrCode) {
          if (aiCode.toUpperCase() === serverOcrCode.toUpperCase()) {
            debugLog('[MP 验证码识别] AI 与 服务端OCR 结果一致');
            sendResponse({ success: true, code: aiCode, provider: 'ai_ocr_match', aiCode, ocrCode: serverOcrCode });
          } else {
            debugLog('[MP 验证码识别] AI 与 服务端OCR 不一致，优先 AI');
            sendResponse({ success: true, code: aiCode, provider: 'ai_preferred', aiCode, ocrCode: serverOcrCode });
          }
          return;
        }

        // 仅 AI 有结果
        if (aiCode) {
          debugLog('[MP 验证码识别] 仅 AI 识别成功');
          sendResponse({ success: true, code: aiCode, provider: 'ai' });
          return;
        }

        // 仅服务端 OCR 有结果
        if (serverOcrCode) {
          debugLog('[MP 验证码识别] 仅服务端 OCR 识别成功');
          sendResponse({ success: true, code: serverOcrCode, provider: 'ocr' });
          return;
        }

        debugLog('[MP 验证码识别] AI 和 服务端OCR 均无结果');
        sendResponse({ success: false, error: '所有识别方式均未能识别验证码' });
      } catch (e) {
        sendResponse({ success: false, error: (e as Error).message });
      }
    })();
    return true;
  }
  if (msg?.type === 'MP_DIRECT_DOWNLOAD') {
    handleDirectDownload(msg).then(sendResponse).catch(e => sendResponse({ success: false, error: (e as Error).message }));
    return true;
  }
  if (msg?.type === 'MP_GET_TOTP_SITES') {
    (async () => {
      try {
        const config = await TOTPStorageService.getConfig();
        sendResponse({ success: true, sites: config.sites || [] });
      } catch (e) {
        sendResponse({ success: false, sites: [], error: (e as Error).message });
      }
    })();
    return true;
  }
  if (msg?.type === 'MP_DIRECT_TORRENT_STATES') {
    handleDirectTorrentStates(msg).then(sendResponse).catch(e => sendResponse({ success: false, error: (e as Error).message }));
    return true;
  }
  if (msg?.type === 'MP_COOKIE_UA_AUTO_UPDATE_CONFIG_CHANGED') {
    (async () => {
      try {
        await configureCookieUaAutoUpdateAlarm();
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: (e as Error).message });
      }
    })();
    return true;
  }
  if (msg?.type === 'MP_SITE_AUTO_OPEN_CONFIG_CHANGED') {
    (async () => {
      try {
        await configureSiteAutoOpenAlarm();
        sendResponse({ ok: true });
      } catch (e) {
        sendResponse({ ok: false, error: (e as Error).message });
      }
    })();
    return true;
  }
  if (msg?.type === 'MP_PT_GET_CONFIG') {
    PTCredentialStorageService.getPtCredsConfig()
      .then(config => sendResponse({ success: true, config }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
  if (msg?.type === 'MP_PT_GET_DECRYPTED_CRED') {
    const domain = msg?.domain as string | undefined;
    if (!domain) {
      sendResponse({ success: false, error: '域名为空' });
      return true;
    }
    PTCredentialStorageService.getCredentialByDomain(domain)
      .then(cred => sendResponse({ success: true, credential: cred }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
  if (msg?.type === 'MP_PT_SAVE_CRED') {
    const domain = msg?.domain as string | undefined;
    const username = msg?.username as string | undefined;
    const password = msg?.password as string | undefined;
    let name = msg?.name as string | undefined;
    if (!domain || !username || !password) {
      sendResponse({ success: false, error: '参数缺失' });
      return true;
    }
    (async () => {
      try {
        if (!name) {
          try {
            const client = await createClient();
            const resp = await client.get('/api/v1/site/mapping');
            const mappingData = resp?.data?.data || {};
            const cleanDomain = domain.toLowerCase().trim();
            if (mappingData[cleanDomain]) {
              name = mappingData[cleanDomain];
            } else {
              const noWww = cleanDomain.replace(/^www\./i, '');
              const matchedKey = Object.keys(mappingData).find(k => k.toLowerCase().replace(/^www\./i, '') === noWww);
              if (matchedKey) {
                name = mappingData[matchedKey];
              }
            }
          } catch (e) {
            debugError('获取 site mapping 失败:', e);
          }
        }
        await PTCredentialStorageService.addOrUpdateCredential(domain, username, password, name);
        sendResponse({ success: true });
      } catch (err) {
        sendResponse({ success: false, error: (err as Error).message });
      }
    })();
    return true;
  }
  if (msg?.type === 'MP_LOGOUT') {
    // 可扩展：清理 alarms / 临时状态等
    return false;
  }
});

// 当 baseURL 或 token 变化时，尝试刷新域名缓存（静默）
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area === 'local') {
    const baseUrlChanged = !!changes[STORAGE_KEYS.BASE_URL];
    const tokenChanged = !!changes[STORAGE_KEYS.TOKEN];
    if (baseUrlChanged || tokenChanged) {
      try { await refreshAllowedDomains(); } catch { }
    }
  }
  if (area === 'local' && changes[STORAGE_KEYS.COOKIE_UA_AUTO_UPDATE]) {
    try { await configureCookieUaAutoUpdateAlarm(); } catch { }
  }
  if (area === 'local' && changes[STORAGE_KEYS.SITE_AUTO_OPEN]) {
    try { await configureSiteAutoOpenAlarm(); } catch { }
  }
});

// 安装后尝试拉取一次（若已配置）
chrome.runtime.onInstalled.addListener(async () => {
  try { await refreshAllowedDomains(); } catch { }
  try { await initializeCookieUaAutoUpdate(); } catch { }
  try { await initializeSiteAutoOpen(); } catch { }
});

chrome.runtime.onStartup.addListener(async () => {
  try { await initializeCookieUaAutoUpdate(); } catch { }
  try { await initializeSiteAutoOpen(); } catch { }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === COOKIE_UA_AUTO_UPDATE_ALARM) {
    autoUpdateCookieAndUserAgent('interval').catch(error => {
      debugError('Cookie/UA 定时自动更新失败:', error);
    });
    return;
  }
  if (alarm.name === SITE_AUTO_OPEN_ALARM) {
    openAllConfiguredSites('interval').catch(error => {
      debugError('定时自动打开站点失败:', error);
    });
    return;
  }
  if (alarm.name === SITE_AUTO_OPEN_CLOSE_TABS_ALARM) {
    closeAutoOpenedTabs().catch(error => {
      debugError('自动关闭站点标签页失败:', error);
    });
  }
});



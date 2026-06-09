// ============================================================
// 站点工具函数
// 站点状态文本、Cookie/UA 差异检测、API 站点判断
// ============================================================

import type { Site } from '../types/site';

/**

/**
 * 检查是否为 API 站点
 */
export function isApiSite(site: Site): boolean {
  return !!(site.apikey || site.token);
}

/**
 * 检查是否有浏览器 Cookie
 */
export function hasBrowserCookie(site: Site): boolean {
  return !!(site.cookie && site.cookie.trim());
}

/**
 * 获取站点状态类型
 */
export function getStatusType(site: Site): 'success' | 'warning' | 'danger' | 'info' {
  if (!site.is_active) return 'info';
  if (isApiSite(site)) return 'success';
  if (site.cookieDiff && hasBrowserCookie(site)) return 'warning';
  if (site.cookieDiff && !hasBrowserCookie(site) && site.cookie) return 'info';
  if (site.uaDiff) return 'warning';
  if (site.cookie || site.apikey || site.token) return 'success';
  return 'danger';
}

/**
 * 获取站点状态文本
 */
export function getStatusText(site: Site): string {
  if (!site.is_active) return '停用';
  if (isApiSite(site)) return '正常';
  if (site.cookieDiff && hasBrowserCookie(site)) return 'Cookie待更新';
  if (site.cookieDiff && !hasBrowserCookie(site) && site.cookie) return '浏览器未登陆';
  if (site.uaDiff) return 'UA待更新';
  if (site.cookie || site.apikey || site.token) return '正常';
  return '需要配置';
}

/**
 * 获取连接状态文本
 */
export function getConnectionStatusText(seconds?: number): string {
  if (seconds == null) return '未知';
  if (seconds >= 5) return '缓慢';
  return '正常';
}

/**
 * 获取浏览器 Cookie
 */
export async function getBrowserCookies(url: string): Promise<string> {
  try {
    const cookies = await chrome.cookies.getAll({ url });
    return cookies.map(c => `${c.name}=${c.value}`).join('; ');
  } catch (error) {
    console.error('获取浏览器Cookie失败:', error);
    return '';
  }
}

/**
 * 规范化 Cookie 字符串为 Map（忽略空格、换行、顺序差异）
 * 用于精确比较两组 Cookie 内容是否一致
 */
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

/**
 * 检查 Cookie 差异（规范化对比，忽略顺序/空格/换行）
 */
export async function hasCookieDiff(site: Site): Promise<boolean> {
  try {
    const browserCookies = await getBrowserCookies(site.url);
    const serverCookies = site.cookie || '';

    // 两侧均无 Cookie，则无差异
    if (!serverCookies && !browserCookies) return false;

    // 任一侧整体为空，则有差异
    if (!serverCookies || !browserCookies) return true;

    // 规范化对比：忽略顺序/空格/换行
    const serverMap = normalizeCookies(serverCookies);
    const browserMap = normalizeCookies(browserCookies);

    if (serverMap.size !== browserMap.size) return true;

    for (const [name, value] of serverMap) {
      if (!browserMap.has(name) || browserMap.get(name) !== value) return true;
    }

    return false;
  } catch (error) {
    console.error('检查Cookie差异失败:', error);
    return false;
  }
}

/**
 * 检查 UA 差异
 */
export function hasUADiff(site: Site): boolean {
  const browserUA = navigator.userAgent.trim();
  const siteUA = (site.ua || '').trim();
  
  // 服务端和浏览器均无 UA，不判定差异；任一侧有值即对比
  if (!siteUA && !browserUA) return false;
  
  return browserUA !== siteUA;
}

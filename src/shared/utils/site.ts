import type { Site } from '../types/site';

/**
 * 站点工具函数
 */

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
 * 检查 Cookie 差异
 */
export async function hasCookieDiff(site: Site): Promise<boolean> {
  try {
    const browserCookies = await getBrowserCookies(site.url);
    const serverCookies = site.cookie || '';
    
    if (!serverCookies && !browserCookies) {
      return false;
    }
    
    if (!serverCookies || !browserCookies) {
      return true;
    }
    
    return serverCookies !== browserCookies;
  } catch (error) {
    console.error('检查Cookie差异失败:', error);
    return false;
  }
}

/**
 * 检查 UA 差异
 */
export function hasUADiff(site: Site): boolean {
  const browserUA = navigator.userAgent;
  const siteUA = site.ua || '';
  
  if (!siteUA) return false;
  
  return browserUA !== siteUA;
}

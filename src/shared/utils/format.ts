/**
 * 格式化工具函数
 */

/**
 * 格式化文件大小
 */
export function formatSize(bytes?: number): string {
  const n = bytes || 0;
  const KB = 1024, MB = KB * 1024, GB = MB * 1024, TB = GB * 1024;
  if (n >= TB) return (n / TB).toFixed(2) + ' TB';
  if (n >= GB) return (n / GB).toFixed(2) + ' GB';
  if (n >= MB) return (n / MB).toFixed(2) + ' MB';
  if (n >= KB) return (n / KB).toFixed(2) + ' KB';
  return n.toFixed(0) + ' B';
}

/**
 * 格式化积分/奖励点数
 */
export function formatBonus(bonus?: number): string {
  const n = bonus || 0;
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return n.toFixed(0);
}

/**
 * 格式化加入日期
 */
export function formatJoinDate(joinAt?: string): string {
  if (!joinAt) return '未知';
  try {
    const date = new Date(joinAt);
    if (isNaN(date.getTime())) return joinAt;
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  } catch {
    return joinAt;
  }
}

/**
 * 格式化分享率
 */
export function formatRatio(ratio?: number): string {
  if (!ratio) return '0.00';
  return ratio.toFixed(2);
}

/**
 * 格式化百分比
 */
export function formatPercentage(value?: number): string {
  if (!value) return '0%';
  return (value * 100).toFixed(1) + '%';
}

/**
 * 从对象中获取数字值
 */
export function getNumber(obj: any, keys: string[], def = 0): number {
  for (const k of keys) {
    const v = obj?.[k];
    if (typeof v === 'number') return v;
    if (typeof v === 'string' && v !== '' && !isNaN(Number(v))) return Number(v);
  }
  return def;
}

/**
 * 从 URL 提取标题
 */
export function extractTitleFromUrl(url: string): string {
  try {
    if (url.startsWith('magnet:?')) {
      const qs = new URLSearchParams(url.substring(8));
      const dn = qs.get('dn');
      if (dn) {
        return decodeURIComponent(dn).replace(/[._]+/g, ' ').trim();
      }
      return 'magnet';
    }
    const u = new URL(url);
    const path = decodeURIComponent(u.pathname || '/');
    const base = path.split('/').filter(Boolean).pop() || u.hostname;
    const name = base.replace(/\.(torrent|txt|html?)$/i, '').replace(/[._]+/g, ' ').trim();
    return name || u.hostname;
  } catch {
    return url;
  }
}

/**
 * 生成种子标题
 */
export function generateTorrentTitle(url: string, siteName: string, id?: string): string {
  try {
    const urlObj = new URL(url);
    const params = new URLSearchParams(urlObj.search);
    const titleParam = params.get('title') || params.get('name');
    
    if (titleParam) {
      return decodeURIComponent(titleParam).replace(/[._]+/g, ' ').trim();
    }
    
    if (id) {
      return `${siteName} 种子 ${id}`;
    }
    
    const extracted = extractTitleFromUrl(url);
    if (extracted && extracted !== 'details.php' && extracted !== 'details') {
      return extracted;
    }
    
    return `${siteName} 种子`;
  } catch {
    return id ? `${siteName} 种子 ${id}` : `${siteName} 种子`;
  }
}

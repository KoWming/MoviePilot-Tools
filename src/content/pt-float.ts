// PT 站点浮动下载按钮（内容脚本）
// - 仅在已配置的 PT 站点种子详情页注入固定按钮
// - 点击后将当前详情页地址发送给后台脚本打开下载面板

(function () {

  const STORAGE_KEYS = {
    ALLOWED_DOMAINS: 'mp.allowed_domains',
    ALLOWED_DOMAINS_UPDATED_AT: 'mp.allowed_domains_updated_at',
    WEB_EMBED_FEATURES: 'mp.web_embed_features'
  } as const;

  async function isTorrentDetailDownloadEnabled(): Promise<boolean> {
    try {
      const data = await chrome.storage.local.get([STORAGE_KEYS.WEB_EMBED_FEATURES]);
      const config = data[STORAGE_KEYS.WEB_EMBED_FEATURES] as { torrentDetailDownloadEnabled?: boolean } | undefined;
      return config?.torrentDetailDownloadEnabled !== false;
    } catch {
      return true;
    }
  }

  async function getAllowedDomainsFromCache(): Promise<string[] | null> {
    try {
      const data = await chrome.storage.local.get([STORAGE_KEYS.ALLOWED_DOMAINS]);
      const list = data[STORAGE_KEYS.ALLOWED_DOMAINS] as string[] | undefined;
      if (Array.isArray(list) && list.length > 0) return list;
      return null;
    } catch {
      return null;
    }
  }

  function matchesAllowed(hostname: string, allow: string[]): boolean {
    const h = hostname.toLowerCase();
    return allow.some(d => h === d || h.endsWith('.' + d));
  }

  // 检查当前站点是否在MP的站点配置中
  async function isSupportedSite(): Promise<boolean> {
    try {
      const currentHostname = location.hostname.toLowerCase();
      console.log('MP Extension: 检查站点支持状态，当前域名:', currentHostname);

      // 1) 先读取本地缓存的 MP 站点域名
      const cached = await getAllowedDomainsFromCache();
      if (cached && cached.length) {
        const ok = matchesAllowed(currentHostname, cached);
        if (ok) return true;
        // 缓存存在但未命中时，短暂触发一次同步刷新，兼容刚更新的站点配置
        try {
          const domains = await new Promise<string[] | null>((resolve) => {
            let done = false;
            const timer = setTimeout(() => { if (!done) { done = true; resolve(null); } }, 1500);
            try {
              chrome.runtime.sendMessage({ type: 'MP_REFRESH_ALLOWED_DOMAINS' }, (resp: any) => {
                if (done) return;
                done = true;
                clearTimeout(timer);
                if (resp && resp.ok && Array.isArray(resp.domains)) resolve(resp.domains as string[]);
                else resolve(null);
              });
            } catch { resolve(null); }
          });
          if (domains && domains.length && matchesAllowed(currentHostname, domains)) return true;
        } catch { }
      }

      // 2) 缓存为空或刷新后仍未命中时，后台异步刷新一次，并按当前结果判定为不支持
      try { chrome.runtime.sendMessage({ type: 'MP_REFRESH_ALLOWED_DOMAINS' }); } catch { }
      return false;
    } catch (error) {
      console.error('MP Extension: 检查站点支持状态失败', error);
      return false;
    }
  }

  // 判断当前页面是否为种子详情页（参考 MS 扩展的匹配规则）
  function isTorrentDetailPage(): boolean {
    try {
      const url = location.href;

      // 输出当前页面信息，便于排查详情页识别问题
      console.log('MP Extension: 检测页面类型', {
        url: location.href,
        hostname: location.hostname
      });

      // 常见 PT 站点的种子详情页 URL 特征
      const detailPatterns = [
        '/details.php?id=',
        '/detail/',
        '/torrents.php?id=',
        '/torrents-details.php?id=',
        '/torrent/',
        '/torrents/',
        '/download/',
        '/view/',
        '?id=',
        '&id=',
        '?tid=',
        '&tid=',
        '?torrentid=',
        '&torrentid='
      ];

      // 命中任一特征即视为种子详情页
      for (const pattern of detailPatterns) {
        if (url.includes(pattern)) {
          console.log('MP Extension: 匹配到种子详情页模式', pattern);
          return true;
        }
      }

      console.log('MP Extension: 未检测到种子详情页特征');
      return false;
    } catch (error) {
      console.error('检测种子详情页失败:', error);
      return false;
    }
  }

  // 提取页面标题，作为下载面板的默认展示名称
  function extractPageTitle(): string {
    try {
      // 1. 优先读取浏览器标题
      const pageTitle = document.title;
      if (pageTitle && pageTitle.trim() && !pageTitle.includes('404') && !pageTitle.includes('Not Found')) {
        // 移除常见站点名称后缀，保留资源标题主体
        const cleanTitle = pageTitle
          .replace(/\s*-\s*[^-]+$/, '') // 移除 "- 站点名" 后缀
          .replace(/\s*::\s*[^:]+$/, '') // 移除 ":: 站点名" 后缀
          .replace(/\s*\|\s*[^|]+$/, '') // 移除 "| 站点名" 后缀
          .trim();

        if (cleanTitle && cleanTitle.length > 3) {
          return cleanTitle;
        }
      }

      // 2. 兜底读取页面内常见标题元素
      const titleSelectors = [
        'h1.title',
        'h1',
        '.title',
        '.torrent-title',
        '.movie-title',
        '#title',
        '.detail-title',
        '.content-title'
      ];

      for (const selector of titleSelectors) {
        const element = document.querySelector(selector);
        if (element && element.textContent) {
          const title = element.textContent.trim();
          if (title && title.length > 3) {
            return title;
          }
        }
      }

      // 3. 再尝试从 URL 参数读取标题
      const urlParams = new URLSearchParams(location.search);
      const titleParam = urlParams.get('title') || urlParams.get('name');
      if (titleParam) {
        return decodeURIComponent(titleParam).trim();
      }

      // 4. 最后回退到原始页面标题
      return pageTitle || '未知种子';
    } catch (error) {
      console.error('提取页面标题失败:', error);
      return document.title || '未知种子';
    }
  }

  const CLS = {
    BTN: 'mp-ext-pt-float-btn',
    LOADING: 'mp-ext-pt-float-loading',
    LOADING_ACTIVE: 'mp-ext-pt-float-loading-active',
    TIPS: 'mp-ext-pt-float-tips',
    DRAGGING: 'mp-ext-pt-float-dragging',
    EDGE_LEFT: 'mp-ext-pt-float-edge-left',
    EDGE_RIGHT: 'mp-ext-pt-float-edge-right',
  } as const;

  function injectStyle() {
    const id = 'mp-ext-pt-float-style';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
.${CLS.BTN} {
  position: fixed !important;
  top: 40%;
  right: 12px;
  width: 46px !important;
  height: 46px !important;
  padding: 0 !important;
  background: linear-gradient(180deg, rgba(139, 92, 246, 0.75) 0%, rgba(109, 40, 217, 0.85) 100%) !important;
  backdrop-filter: blur(8px) !important;
  -webkit-backdrop-filter: blur(8px) !important;
  color: #fff !important;
  border: none !important;
  border-radius: 50% !important;
  cursor: pointer !important;
  z-index: 10000000 !important;
  opacity: .75 !important;
  box-shadow: 0 4px 12px rgba(109, 40, 217, 0.25) !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  transition: opacity .2s ease, border-radius .2s ease, background .2s ease, box-shadow .2s ease !important;
}
.${CLS.BTN} img {
  width: 21px !important;
  height: 21px !important;
  display: block !important;
  filter: brightness(0) invert(1) !important;
}
/* 初始坐标确定后再添加 ready 类，避免页面加载时从默认位置滑动到缓存位置 */
.${CLS.BTN}.mp-ext-pt-float-ready {
  transition: top .25s cubic-bezier(0.25, 0.8, 0.25, 1), left .25s cubic-bezier(0.25, 0.8, 0.25, 1), right .25s cubic-bezier(0.25, 0.8, 0.25, 1), opacity .2s ease, border-radius .2s ease, background .2s ease, box-shadow .2s ease !important;
}
.${CLS.BTN}:hover {
  opacity: 1 !important;
  background: linear-gradient(180deg, rgba(139, 92, 246, 0.9) 0%, rgba(109, 40, 217, 0.95) 100%) !important;
  box-shadow: 0 6px 16px rgba(109, 40, 217, 0.35) !important;
}
.${CLS.DRAGGING} {
  transition: none !important;
  opacity: .8 !important;
  background: linear-gradient(180deg, rgba(139, 92, 246, 0.65) 0%, rgba(109, 40, 217, 0.75) 100%) !important;
}
.${CLS.DRAGGING}:hover {
  opacity: .8 !important;
}
.${CLS.EDGE_RIGHT} {
  border-radius: 23px 0 0 23px !important;
}
.${CLS.EDGE_LEFT} {
  border-radius: 0 23px 23px 0 !important;
}
.${CLS.LOADING} {
  height: 18px !important;
  width: 18px !important;
  border-radius: 50% !important;
  border: 2px solid rgba(255, 255, 255, 0.3) !important;
  border-top: 2px solid #ffffff !important;
  animation: mp-ext-pt-float-spin 0.8s linear infinite !important;
  display: none !important;
  box-sizing: border-box !important;
}
.${CLS.LOADING_ACTIVE} .${CLS.LOADING} {
  display: block !important;
}
.${CLS.LOADING_ACTIVE} img {
  display: none !important;
}
@keyframes mp-ext-pt-float-spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
.${CLS.TIPS} {
  display: none !important;
  position: absolute !important;
  left: -142px !important;
  top: 50% !important;
  transform: translateY(-50%) !important;
  padding: 6px 12px !important;
  font-size: 12px !important;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
  border-radius: 6px !important;
  color: #fff !important;
  background: rgba(15, 23, 42, 0.95) !important;
  backdrop-filter: blur(4px) !important;
  -webkit-backdrop-filter: blur(4px) !important;
  border: 1px solid rgba(255, 255, 255, 0.1) !important;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
  white-space: nowrap !important;
  z-index: 2147483646 !important;
  pointer-events: none !important;
}
.${CLS.TIPS}::after {
  content: '';
  position: absolute;
  right: -5px;
  top: 50%;
  transform: translateY(-50%);
  width: 0;
  height: 0;
  border-top: 5px solid transparent;
  border-bottom: 5px solid transparent;
  border-left: 5px solid rgba(15, 23, 42, 0.95);
}
.${CLS.BTN}:hover .${CLS.TIPS} {
  display: block !important;
}
.${CLS.LOADING_ACTIVE} .${CLS.TIPS} {
  left: -158px !important;
  display: block !important;
}
/* 按钮吸附左侧时，将提示气泡移到右侧并反转箭头 */
.${CLS.EDGE_LEFT} .${CLS.TIPS} {
  left: auto !important;
  right: -142px !important;
}
.${CLS.EDGE_LEFT}.${CLS.LOADING_ACTIVE} .${CLS.TIPS} {
  right: -158px !important;
}
.${CLS.EDGE_LEFT} .${CLS.TIPS}::after {
  right: auto;
  left: -5px;
  border-left: none;
  border-right: 5px solid rgba(15, 23, 42, 0.95);
}
`;
    document.head.appendChild(style);
  }

  function savePos(pos: { top: number; left?: number; right?: number }) {
    try {
      const key = 'mp-pt-float-pos:' + location.hostname;
      // 写入扩展本地存储，避免暴露给页面脚本
      chrome.storage.local.set({ [key]: pos });
    } catch { }
  }

  async function applyStoredPos(btn: HTMLElement) {
    const key = 'mp-pt-float-pos:' + location.hostname;
    try {
      const data = await chrome.storage.local.get([key]);
      const stored = data[key] as { top: number; left?: number; right?: number } | undefined;
      if (stored && typeof stored.top === 'number') {
        btn.style.top = stored.top + 'px';
        if (typeof stored.left === 'number') {
          btn.style.left = stored.left + 'px';
          btn.style.right = 'auto';
          if ((stored.left ?? 1) <= 0) btn.classList.add(CLS.EDGE_LEFT);
        }
        if (typeof stored.right === 'number') {
          btn.style.right = stored.right + 'px';
          btn.style.left = 'auto';
          if ((stored.right ?? 1) <= 0) btn.classList.add(CLS.EDGE_RIGHT);
        }
      } else {
        btn.style.right = '0px';
        btn.classList.add(CLS.EDGE_RIGHT);
      }
    } catch {
      btn.style.right = '0px';
      btn.classList.add(CLS.EDGE_RIGHT);
    } finally {
      // 坐标确定后再挂载到页面，避免短暂显示在默认位置
      document.body.appendChild(btn);

      // 挂载后一帧再启用过渡动画，确保后续吸附动画平滑
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          btn.classList.add('mp-ext-pt-float-ready');
        });
      });
    }
  }

  function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }

  function createButton() {
    const btn = document.createElement('button');
    btn.className = CLS.BTN;
    btn.type = 'button';

    // 使用扩展内置图标，避免依赖页面字体或外部资源
    const img = document.createElement('img');
    img.width = 24; img.height = 24; img.style.display = 'block';
    try { img.src = chrome.runtime.getURL('icons/icon.png'); } catch { img.src = ''; }
    img.onload = () => { /* 图标加载成功，无需额外处理 */ };
    btn.appendChild(img);

    const loading = document.createElement('div');
    loading.className = CLS.LOADING;
    btn.appendChild(loading);

    const tips = document.createElement('div');
    tips.className = CLS.TIPS;
    tips.textContent = 'MoviePilot推送下载';
    btn.appendChild(tips);

    let moved = false;
    btn.addEventListener('click', () => {
      if (dragging || moved) { moved = false; return; }
      btn.disabled = true;
      btn.classList.add(CLS.LOADING_ACTIVE);
      tips.textContent = '正在打开下载...';

      // 获取当前页面标题，传给下载面板预填名称
      const pageTitle = extractPageTitle();

      chrome.runtime.sendMessage({
        type: 'MP_PT_OPEN_DOWNLOAD',
        url: location.href,
        title: pageTitle
      }, (resp: any) => {
        btn.disabled = false;
        btn.classList.remove(CLS.LOADING_ACTIVE);
        tips.textContent = 'MoviePilot推送下载';
        if (!resp || resp.success === false) {
          try { chrome.runtime.sendMessage({ type: 'MP_SHOW_NOTIFICATION', title: '打开失败', message: resp?.error || '无法打开下载面板', level: 'error' }); } catch { }
        }
      });
    });

    // 应用本域名下缓存的按钮位置
    applyStoredPos(btn);

    // 支持拖动按钮，并在松手后吸附到最近的屏幕边缘
    let dragging = false;
    let startX = 0, startY = 0, startTop = 0, startLeft = 0;
    btn.addEventListener('mousedown', (ev) => {
      dragging = true;
      moved = false;
      btn.classList.add(CLS.DRAGGING);
      btn.classList.remove(CLS.EDGE_LEFT, CLS.EDGE_RIGHT);
      startX = ev.clientX; startY = ev.clientY;
      const rect = btn.getBoundingClientRect();
      startTop = rect.top; startLeft = rect.left;
      // 拖动过程中统一使用 left 定位，保证移动过程顺滑
      btn.style.left = rect.left + 'px';
      // top 使用 px，允许上下拖动
      btn.style.top = rect.top + 'px';
      btn.style.right = 'auto';
      ev.preventDefault();
    });
    window.addEventListener('mousemove', (ev) => {
      if (!dragging) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      if (!moved && (Math.abs(dx) > 3 || Math.abs(dy) > 3)) moved = true;
      const vw = window.innerWidth, vh = window.innerHeight;
      const newLeft = clamp(startLeft + dx, 4, vw - 50);
      const newTop = clamp(startTop + dy, 4, vh - 50);
      btn.style.left = newLeft + 'px';
      btn.style.top = newTop + 'px';
    });
    window.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      btn.classList.remove(CLS.DRAGGING);
      const rect = btn.getBoundingClientRect();
      const vw = window.innerWidth;
      const centerX = rect.left + rect.width / 2;
      const snapRight = centerX > vw / 2;
      // 根据按钮中心点判断吸附到左侧还是右侧
      btn.style.top = clamp(rect.top, 4, window.innerHeight - rect.height - 4) + 'px';
      if (snapRight) {
        const right = 0; // 紧贴右侧边缘
        btn.style.right = right + 'px';
        btn.style.left = 'auto';
        btn.classList.remove(CLS.EDGE_LEFT);
        btn.classList.add(CLS.EDGE_RIGHT);
        savePos({ top: parseFloat(btn.style.top), right });
      } else {
        const left = 0; // 紧贴左侧边缘
        btn.style.left = left + 'px';
        btn.style.right = 'auto';
        btn.classList.remove(CLS.EDGE_RIGHT);
        btn.classList.add(CLS.EDGE_LEFT);
        savePos({ top: parseFloat(btn.style.top), left });
      }
    });
  }

  async function init() {
    console.log('MP Extension: 开始初始化', {
      hostname: location.hostname,
      url: location.href,
      isTorrentDetailPage: isTorrentDetailPage()
    });

    if (!await isTorrentDetailDownloadEnabled()) {
      console.log('MP Extension: 种子详情页一键下载已关闭');
      return;
    }

    // 仅在种子详情页注入按钮
    if (!isTorrentDetailPage()) {
      console.log('MP Extension: 不是种子详情页');
      return;
    }

    console.log('MP Extension: 是种子详情页，开始检查站点支持状态');

    // 确认当前域名已存在于 MoviePilot 站点配置中
    const supported = await isSupportedSite();
    console.log('MP Extension: 站点支持状态检查结果:', supported);

    if (!supported) {
      console.log('MP Extension: 不支持的站点');
      return;
    }

    console.log('MP Extension: 开始创建浮动按钮');
    injectStyle();
    createButton();
  }

  function tryInit() {
    if (document.body) {
      init();
    } else {
      const observer = new MutationObserver((_, obs) => {
        if (document.body) {
          obs.disconnect();
          init();
        }
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });

      document.addEventListener('DOMContentLoaded', () => {
        observer.disconnect();
        init();
      });
    }
  }

  tryInit();
})();



// Floating PT download button (content script)
// - Injects a fixed button on supported PT domains
// - Sends a message to background with current detail page URL

(function () {
  // 硬编码域名已停用，完全使用本地缓存的 MP 站点域名
  // const HARDCODED_ALLOW_DOMAINS: string[] = [ ... ];

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
        // 缓存存在但未命中，尝试同步刷新一次（短超时），以覆盖刚更新的站点
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
        } catch {}
      }

      // 2) 若缓存为空或未命中，尝试触发一次后台刷新（非阻塞提示），随后返回不支持
      try { chrome.runtime.sendMessage({ type: 'MP_REFRESH_ALLOWED_DOMAINS' }); } catch {}
      return false;
    
    // 添加catch块来处理可能的错误
    } catch (error) {
      console.error('MP Extension: 检查站点支持状态失败', error);
      return false;
    }
  }

  // 检测是否是种子详情页面 - 采用MS扩展的精确匹配方式
  function isTorrentDetailPage(): boolean {
    try {
      const url = location.href;
      
      // 添加调试信息
      console.log('MP Extension: 检测页面类型', {
        url: location.href,
        hostname: location.hostname
      });
      
      // 精确的种子详情页URL模式 - 参考MS扩展的实现
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
      
      // 检查URL是否包含种子详情页特征
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

  // 提取页面标题
  function extractPageTitle(): string {
    try {
      // 1. 尝试从页面标题标签获取
      const pageTitle = document.title;
      if (pageTitle && pageTitle.trim() && !pageTitle.includes('404') && !pageTitle.includes('Not Found')) {
        // 清理标题，移除站点名称后缀
        const cleanTitle = pageTitle
          .replace(/\s*-\s*[^-]+$/, '') // 移除 "- 站点名" 后缀
          .replace(/\s*::\s*[^:]+$/, '') // 移除 ":: 站点名" 后缀
          .replace(/\s*\|\s*[^|]+$/, '') // 移除 "| 站点名" 后缀
          .trim();
        
        if (cleanTitle && cleanTitle.length > 3) {
          return cleanTitle;
        }
      }

      // 2. 尝试从常见的种子标题元素获取
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

      // 3. 尝试从URL参数获取标题
      const urlParams = new URLSearchParams(location.search);
      const titleParam = urlParams.get('title') || urlParams.get('name');
      if (titleParam) {
        return decodeURIComponent(titleParam).trim();
      }

      // 4. 最后使用页面标题
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
.${CLS.BTN} { position: fixed !important; top: 40%; right: 12px; width: 48px !important; height: 48px !important; padding: 0 !important; background: linear-gradient(180deg, rgba(59,130,246,.88), rgba(99,102,241,.88)) !important; color: #fff !important; border: 1px solid rgba(255,255,255,.15) !important; border-radius: 50% !important; cursor: pointer !important; z-index: 10000 !important; opacity: .65 !important; box-shadow: 0 8px 24px rgba(0,0,0,.28) !important; display:flex !important; align-items:center !important; justify-content:center !important; transition: top .12s ease, left .12s ease, right .12s ease, opacity .12s ease, border-radius .12s ease, background .12s ease !important; }
.${CLS.BTN} img { width: 24px !important; height: 24px !important; display: block !important; filter: brightness(0) invert(1) drop-shadow(0 1px 1px rgba(0,0,0,.35)) !important; }
.${CLS.BTN} svg { filter: drop-shadow(0 1px 1px rgba(0,0,0,.35)) !important; }
.${CLS.BTN}:hover { opacity: 1 !important; background: linear-gradient(180deg, rgba(59,130,246,1), rgba(99,102,241,1)) !important; box-shadow: 0 10px 28px rgba(0,0,0,.30) !important; }
.${CLS.DRAGGING} { transition: none !important; opacity: .65 !important; background: linear-gradient(180deg, rgba(59,130,246,.65), rgba(99,102,241,.65)) !important; }
/* 拖动时即使鼠标在其上，也保持半透明 */
.${CLS.DRAGGING}:hover { opacity: .65 !important; background: linear-gradient(180deg, rgba(59,130,246,.65), rgba(99,102,241,.65)) !important; }
/* 吸附到右侧：内侧平直、外侧圆角 */
.${CLS.EDGE_RIGHT} { border-radius: 24px 0 0 24px !important; }
/* 吸附到左侧：内侧平直、外侧圆角 */
.${CLS.EDGE_LEFT} { border-radius: 0 24px 24px 0 !important; }
.${CLS.LOADING} { height: 14px !important; width: 14px !important; border-radius: 50% !important; border: 8px dotted #f3f3f3 !important; animation: mp-ext-pt-float-spin 2s linear infinite !important; display: none !important; }
.${CLS.LOADING_ACTIVE} .${CLS.LOADING} { display: block !important; }
.${CLS.LOADING_ACTIVE} img { display:none !important; }
@keyframes mp-ext-pt-float-spin { 0% { transform: rotate(0deg);} 100% { transform: rotate(360deg);} }
.${CLS.TIPS} { display:none !important; position:absolute !important; left: -135px !important; background: rgba(0,0,0,.9) !important; top:50% !important; transform: translateY(-50%) !important; padding:6px 10px !important; font-size:12px !important; border-radius:6px !important; opacity:.98 !important; color:#fff !important; white-space:nowrap !important; z-index:2147483646 !important; box-shadow:0 6px 16px rgba(0,0,0,.35) !important; border:1px solid rgba(255,255,255,.12) !important; backdrop-filter: blur(2px) !important; }
.${CLS.TIPS}::after { content:''; position:absolute; right:-6px; top:50%; transform: translateY(-50%); width:0; height:0; border-top:6px solid transparent; border-bottom:6px solid transparent; border-left:6px solid rgba(0,0,0,.9); filter: drop-shadow(0 1px 1px rgba(0,0,0,.2)); }
.${CLS.BTN}:hover .${CLS.TIPS} { display:block !important; }
.${CLS.LOADING_ACTIVE} .${CLS.TIPS} { left: -151px !important; display:block !important; }
`;
    document.head.appendChild(style);
  }

  function readPos() {
    try {
      const key = 'mp-pt-float-pos:' + location.hostname;
      // 从 chrome.storage.local 读取（替代 localStorage，避免被页面 JS 读取/篡改）
      // 注意：content script 中 chrome.storage.local 读取是异步的，但这里用同步缓存回退
      return null; // 位置由 chrome.storage.local 异步读取（见 init 中的 applyStoredPos）
    } catch { return null; }
  }

  function savePos(pos: { top: number; left?: number; right?: number }) {
    try {
      const key = 'mp-pt-float-pos:' + location.hostname;
      // 存储到 chrome.storage.local（隔离于页面 JS）
      chrome.storage.local.set({ [key]: pos });
    } catch {}
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
    }
  }

  function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }

  function createButton() {
    const btn = document.createElement('button');
    btn.className = CLS.BTN;
    btn.type = 'button';

    // 使用扩展图标（纯图片方案）
    const img = document.createElement('img');
    img.width = 24; img.height = 24; img.style.display = 'block';
    try { img.src = chrome.runtime.getURL('icons/icon.png'); } catch { img.src = ''; }
    img.onload = () => { /* ok */ };
    btn.appendChild(img);

    const loading = document.createElement('div');
    loading.className = CLS.LOADING;
    btn.appendChild(loading);

    const tips = document.createElement('div');
    tips.className = CLS.TIPS;
    tips.textContent = 'MoviePilot推送下载';
    btn.appendChild(tips);

    let moved = false;
    btn.addEventListener('mousemove', () => { /* no-op, reserved */ });
    btn.addEventListener('click', () => {
      if (dragging || moved) { moved = false; return; }
      btn.disabled = true;
      btn.classList.add(CLS.LOADING_ACTIVE);
      tips.textContent = '正在打开下载...';
      
      // 提取页面标题
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
          try { chrome.runtime.sendMessage({ type: 'MP_SHOW_NOTIFICATION', title: '打开失败', message: resp?.error || '无法打开下载面板', level: 'error' }); } catch {}
        }
      });
    });

    // Apply persisted position (async from chrome.storage.local)
    applyStoredPos(btn);

    // Drag to move & snap
    let dragging = false;
    let startX = 0, startY = 0, startTop = 0, startLeft = 0, useLeft = false;
    btn.addEventListener('mousedown', (ev) => {
      dragging = true;
      moved = false;
      btn.classList.add(CLS.DRAGGING);
      btn.classList.remove(CLS.EDGE_LEFT, CLS.EDGE_RIGHT);
      startX = ev.clientX; startY = ev.clientY;
      const rect = btn.getBoundingClientRect();
      startTop = rect.top; startLeft = rect.left;
      // During drag, use left for positioning for smooth move
      useLeft = true;
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
      const newLeft = clamp(startLeft + dx, 4, vw - 52);
      const newTop = clamp(startTop + dy, 4, vh - 52);
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
      // Snap to nearest side with 12px margin
      btn.style.top = clamp(rect.top, 4, window.innerHeight - rect.height - 4) + 'px';
      if (snapRight) {
        const right = 0; // fully stick to edge
        btn.style.right = right + 'px';
        btn.style.left = 'auto';
        btn.classList.remove(CLS.EDGE_LEFT);
        btn.classList.add(CLS.EDGE_RIGHT);
        savePos({ top: parseFloat(btn.style.top), right });
      } else {
        const left = 0; // fully stick to edge
        btn.style.left = left + 'px';
        btn.style.right = 'auto';
        btn.classList.remove(CLS.EDGE_RIGHT);
        btn.classList.add(CLS.EDGE_LEFT);
        savePos({ top: parseFloat(btn.style.top), left });
      }
    });

    document.body.appendChild(btn);
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
    
    // 先检查是否是种子详情页
    if (!isTorrentDetailPage()) {
      console.log('MP Extension: 不是种子详情页');
      return;
    }
    
    console.log('MP Extension: 是种子详情页，开始检查站点支持状态');
    
    // 异步检查站点支持状态
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => init());
  } else {
    init();
  }
})();



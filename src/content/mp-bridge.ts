// content-script: 接收扩展或 iframe 的 postMessage，打开 MP 原生插件弹窗
(function () {
  function isPluginsPage(): boolean {
    return location.hash.startsWith('#/plugins');
  }

  function isInIframe(): boolean {
    try {
      return window.self !== window.top;
    } catch {
      return true; // 如果无法访问top，可能是在iframe中
    }
  }

  // ===================== iframe 自动登录 =====================
  let loginObserver: MutationObserver | null = null;
  let loginDone = false;

  function findLoginFields(): { userInput: HTMLInputElement | null; pwInput: HTMLInputElement | null } {
    const userInput = document.querySelector(
      'input[name*="user" i], input[id*="user" i], input[placeholder*="用户名" i], input[type="text"]'
    ) as HTMLInputElement | null;
    const pwInput = document.querySelector('input[type="password"]') as HTMLInputElement | null;
    return { userInput, pwInput };
  }

  function fillAndSubmit(username: string, password: string) {
    const { userInput, pwInput } = findLoginFields();
    if (!userInput || !pwInput) return false;
    if (userInput.value || pwInput.value) return false;
    try {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      if (setter) {
        setter.call(userInput, username);
        userInput.dispatchEvent(new Event('input', { bubbles: true }));
        setter.call(pwInput, password);
        pwInput.dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        userInput.value = username;
        pwInput.value = password;
      }
      setTimeout(() => {
        const btn = document.querySelector(
          'button[type="submit"], input[type="submit"], .v-btn--variant-flat, [class*="login"] button, .el-button--primary'
        ) as HTMLElement | null;
        if (btn) btn.click();
        else {
          const form = pwInput.closest('form');
          if (form) form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
        }
        stopLoginObserver();
        redirectToPlugins();
      }, 600);
      return true;
    } catch { return false; }
  }

  function startLoginObserver(username: string, password: string) {
    if (loginObserver || loginDone) return;
    try {
      if (fillAndSubmit(username, password)) { loginDone = true; return; }
      loginObserver = new MutationObserver(() => {
        if (fillAndSubmit(username, password)) {
          loginDone = true;
          stopLoginObserver();
        }
      });
      loginObserver.observe(document.documentElement || document.body, { childList: true, subtree: true });
    } catch { /* 静默失败 */ }
  }

  function stopLoginObserver() {
    if (loginObserver) { loginObserver.disconnect(); loginObserver = null; }
  }

  function redirectToPlugins() {
    let checks = 0;
    const timer = setInterval(() => {
      checks++;
      const pwField = document.querySelector('input[type="password"]');
      if (!pwField || checks > 40) {
        clearInterval(timer);
        window.location.hash = '#/plugins?tab=installed';
      }
    }, 500);
  }

  function initAutoLogin() {
    if (!isInIframe()) return;
    // 监听父窗口发来的凭据
    window.addEventListener('message', (event: MessageEvent) => {
      if (event.data?.type === 'MP_IFRAME_AUTH' && event.data?.username && event.data?.password) {
        startLoginObserver(event.data.username, event.data.password);
      }
    });
    // 主动向父窗口请求凭据
    window.parent.postMessage({ type: 'MP_IFRAME_NEED_AUTH' }, '*');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAutoLogin);
  } else {
    initAutoLogin();
  }

  function applyMinimalUI() {
    try {
      // 只有在iframe中且是插件页面才应用最小化UI样式
      if (!isInIframe() || !isPluginsPage()) {
        return;
      }

      const id = 'mp-embed-minimal-style';
      if (document.getElementById(id)) return;
      const style = document.createElement('style');
      style.id = id;
      style.textContent = `
        /* 仅在iframe中的插件页面隐藏默认导航栏容器，避免影响正常页面访问 */
        .theme-navbar-row, .v-layout .d-flex.h-14.align-center.mx-1 { display: none !important; }

        /* 为插件页主内容去除顶部空隙 */
        .v-layout .main-content-wrapper { padding-top: 0 !important; }

        /* 隐藏底部导航容器（PWA模式下的底部导航，Teleport 到 body） */
        .footer-nav-container { display: none !important; }

        /* 移除布局 Footer 及其内容容器，避免底部空白 */
        footer.layout-footer { display: none !important; height: 0 !important; padding: 0 !important; margin: 0 !important; }
        .footer-content-container, .footer-content-container-noheight { display: none !important; height: 0 !important; padding: 0 !important; margin: 0 !important; }

        /* 强制毛玻璃顶部栏高度为 50px（高优先级覆盖） */
        header.layout-navbar.navbar-blur { height: 50px !important; min-height: 50px !important; --navbar-tab-height: 0px !important; }
        header.layout-navbar.navbar-blur .navbar-content-container {
          block-size: 50px !important;
          height: 50px !important;
          padding-block-start: 0 !important;
          padding-block-end: 0 !important;
        }
        /* 裁剪超出高度的内容，防止子元素 margin/padding 造成视觉增高 */
        header.layout-navbar { overflow: hidden !important; }
        /* 清除子元素可能的上下外边距导致的累积高度 */
        header.layout-navbar .navbar-content-container > * { margin-block-start: 0 !important; margin-block-end: 0 !important; }
        /* 可选：缩小按钮与图标高度，避免撑高容器 */
        header.layout-navbar .v-btn { min-height: 32px !important; height: 32px !important; }
        header.layout-navbar .v-icon { font-size: 22px !important; height: 22px !important; width: 22px !important; }
      `;
      document.head.appendChild(style);
    } catch { }
  }

  function ensurePluginsTab() {
    try {
      const tabs = Array.from(document.querySelectorAll('*'));
      const mine = tabs.find(el => (el.textContent || '').trim() === '我的插件');
      const market = tabs.find(el => (el.textContent || '').trim() === '插件市场');
      if (mine && market) {
        const isMarketActive = market.closest('[aria-selected="true"],[data-selected="true"],[class*="active"]');
        if (isMarketActive) (mine as HTMLElement).click();
      }
    } catch { }
  }

  function tryOpenById(id: string, name?: string, minimal?: boolean) {
    const targetId = (id || '').toLowerCase();
    let tries = 0;
    const timer = setInterval(() => {
      tries++;
      ensurePluginsTab();
      if (minimal) applyMinimalUI();
      // 依据多种特征定位卡片
      const all = Array.from(document.querySelectorAll('*')) as HTMLElement[];
      let candidate: HTMLElement | null = null;
      for (const el of all) {
        const text = (el.textContent || '').toLowerCase();
        const src = (el as HTMLImageElement).src || '';
        if (text.includes((name || '').toLowerCase())) { candidate = el; break; }
        if (src.includes(`/plugin/file/${targetId}/`)) { candidate = el; break; }
      }
      if (candidate) {
        let clickable: HTMLElement | null = candidate;
        for (let i = 0; i < 12 && clickable; i++) {
          const cls = (clickable.className || '').toString();
          if (clickable.onclick || cls.includes('v-card') || cls.includes('card')) break;
          clickable = clickable.parentElement as HTMLElement | null;
        }
        try { (clickable || candidate).scrollIntoView({ block: 'center' }); } catch { }
        (clickable || candidate).dispatchEvent(new MouseEvent('click', { bubbles: true }));
        clearInterval(timer);
      } else if (tries > 50) {
        clearInterval(timer);
      }
    }, 400);
  }

  // 清理样式的函数
  function cleanupMinimalUI() {
    try {
      const style = document.getElementById('mp-embed-minimal-style');
      if (style) {
        style.remove();
      }
    } catch { }
  }

  // ===================== 内嵌原生插件 iframe 卡死监控 =====================
  const iframeTimeoutMap = new WeakMap<HTMLIFrameElement, number>();
  const appliedHint = new WeakSet<HTMLIFrameElement>();

  function isPluginIframe(el: HTMLIFrameElement): boolean {
    const src = el.getAttribute('src') || '';
    return /\/plugin\//.test(src) || /\bplugin\b/i.test(src);
  }

  function ensureHintUI(iframe: HTMLIFrameElement, reason: string) {
    if (appliedHint.has(iframe)) return;
    appliedHint.add(iframe);
    try {
      const wrapper = document.createElement('div');
      wrapper.className = 'mp-plugin-hint';
      wrapper.style.cssText = 'margin:8px 0;padding:8px 10px;border:1px solid #e2e8f0;border-radius:8px;background:#fff7ed;color:#92400e;font-size:12px;display:flex;align-items:center;justify-content:space-between;gap:8px;';
      const text = document.createElement('div');
      text.textContent = `插件页面可能加载异常：${reason}`;
      const actions = document.createElement('div');
      actions.style.cssText = 'display:flex;gap:8px;';
      const retry = document.createElement('button');
      retry.textContent = '重试';
      retry.style.cssText = 'padding:4px 8px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;cursor:pointer;';
      retry.onclick = () => {
        try {
          appliedHint.delete(iframe);
          const src = iframe.src; iframe.src = src;
          attachWatchers([iframe]);
          wrapper.remove();
        } catch { }
      };
      const open = document.createElement('button');
      open.textContent = '新标签打开';
      open.style.cssText = 'padding:4px 8px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;cursor:pointer;';
      open.onclick = () => { try { window.open(iframe.src, '_blank'); } catch { } };
      actions.appendChild(retry);
      actions.appendChild(open);
      wrapper.appendChild(text);
      wrapper.appendChild(actions);
      // 插入到 iframe 上方
      const parent = iframe.parentElement || iframe;
      parent.parentElement?.insertBefore(wrapper, parent);
    } catch { }
  }

  function attachWatchers(iframes?: HTMLIFrameElement[]) {
    try {
      const list = iframes || Array.from(document.querySelectorAll('iframe')) as HTMLIFrameElement[];
      for (const el of list) {
        if (!isPluginIframe(el)) continue;
        // 避免重复绑定
        if (iframeTimeoutMap.has(el)) continue;
        // load 成功则清理超时
        const onLoad = () => {
          const tid = iframeTimeoutMap.get(el);
          if (typeof tid === 'number') window.clearTimeout(tid);
          iframeTimeoutMap.delete(el);
        };
        const onError = () => {
          const tid = iframeTimeoutMap.get(el);
          if (typeof tid === 'number') window.clearTimeout(tid);
          iframeTimeoutMap.delete(el);
          ensureHintUI(el, '网络或 CSP 限制');
        };
        el.addEventListener('load', onLoad, { once: true });
        el.addEventListener('error', onError, { once: true });
        // 设定超时（12秒）
        const tid: number = window.setTimeout(() => {
          iframeTimeoutMap.delete(el);
          ensureHintUI(el, '加载超时');
        }, 12000);
        iframeTimeoutMap.set(el, tid);
      }
    } catch { }
  }

  let mo: MutationObserver | null = null;
  function startIframeObserver() {
    if (!isPluginsPage()) return;
    try {
      attachWatchers();
      if (mo) mo.disconnect();
      mo = new MutationObserver((muts) => {
        const added: HTMLIFrameElement[] = [];
        for (const m of muts) {
          if (m.type === 'childList') {
            m.addedNodes.forEach((n) => {
              if (n instanceof HTMLIFrameElement) added.push(n);
              else if (n instanceof HTMLElement) {
                added.push(...(Array.from(n.querySelectorAll('iframe')) as HTMLIFrameElement[]));
              }
            });
          }
        }
        if (added.length) attachWatchers(added);
      });
      mo.observe(document.documentElement, { childList: true, subtree: true });
    } catch { }
  }

  function stopIframeObserver() {
    try {
      if (mo) { mo.disconnect(); mo = null; }
      // 清理所有未决超时计时器
      try {
        // WeakMap 无法直接遍历，改为在 detach 阶段不再清理单个定时器；让浏览器统一回收
      } catch { }
    } catch { }
  }

  // 进入插件页时自动应用最小化样式（嵌入优化）
  if (isPluginsPage()) {
    try { applyMinimalUI(); } catch { }
    startIframeObserver();
  }

  window.addEventListener('hashchange', () => {
    if (isPluginsPage()) {
      try { applyMinimalUI(); } catch { }
      startIframeObserver();
    } else {
      // 离开插件页面时清理样式
      cleanupMinimalUI();
      stopIframeObserver();
    }
  });

  // 页面卸载时清理样式
  window.addEventListener('beforeunload', () => { cleanupMinimalUI(); stopIframeObserver(); });

  function handleMessage(event: MessageEvent) {
    const data = event.data as any;
    if (!data || data.type !== 'mp-open-plugin') return;
    const { id, name, minimal } = data;

    // 安全：验证消息来源 —— 仅接受来自 MP 服务器 origin 的消息
    if (!isPluginsPage()) return;

    // 异步验证 origin（从 storage 读取 MP 服务器配置的 baseURL）
    validateOrigin(event.origin).then(valid => {
      if (!valid) {
        console.warn('[MP Security] 拒绝来自非信任 origin 的 postMessage:', event.origin);
        return;
      }
      tryOpenById(id, name, !!minimal);
    }).catch(() => {
      // 验证失败时保守拒绝
      console.warn('[MP Security] origin 验证异常，拒绝 postMessage');
    });
  }

  /**
   * 验证 postMessage 来源是否匹配用户配置的 MP 服务器地址
   */
  async function validateOrigin(origin: string): Promise<boolean> {
    try {
      // 允许同源消息（页面自身发出的消息）
      if (origin === location.origin) return true;

      // 从 storage 读取已配置的 MP 服务器 baseURL
      const data = await chrome.storage.local.get(['mp.base_url']);
      const baseURL = data['mp.base_url'] as string | undefined;
      if (!baseURL) return false;

      try {
        const expectedOrigin = new URL(baseURL).origin;
        return origin === expectedOrigin;
      } catch {
        return false;
      }
    } catch {
      // 读取 storage 失败时拒绝
      return false;
    }
  }

  // ===================== PT 账号自动保存与填充 =====================
  let ptCredsConfig = { autoSaveEnabled: true, autoFillEnabled: true };
  let pendingUsername = '';
  let pendingPassword = '';
  let checkTimeout: number | null = null;
  
  function findPTLoginFields() {
    try {
      const inputs = Array.from(document.querySelectorAll('input'));
      // 优先寻找可见的密码输入框
      let pwInput = inputs.find(input => input.type === 'password' && (input.offsetWidth > 0 || input.offsetHeight > 0)) as HTMLInputElement | null;
      if (!pwInput) {
        pwInput = inputs.find(input => input.type === 'password') as HTMLInputElement | null;
      }
      if (!pwInput) return { userInput: null, pwInput: null };

      const eligibleUserInputs = inputs.filter(input => {
        if (input === pwInput) return false;
        const type = (input.type || 'text').toLowerCase();
        const forbiddenTypes = ['password', 'checkbox', 'radio', 'submit', 'button', 'hidden', 'file', 'image', 'reset'];
        if (forbiddenTypes.includes(type)) return false;
        
        const isVisible = input.offsetWidth > 0 || input.offsetHeight > 0;
        if (!isVisible) return false;
        
        return true;
      });

      if (eligibleUserInputs.length === 0) return { userInput: null, pwInput };

      const criteria = [
        (input: HTMLInputElement) => /user|login|member|mail|phone|username|email/i.test(input.name || '') || /user|login|member|mail|phone|username|email/i.test(input.id || ''),
        (input: HTMLInputElement) => /用户名|账号|邮箱|手机|登/i.test(input.placeholder || ''),
        () => true
      ];

      for (const criterion of criteria) {
        const match = eligibleUserInputs.find(criterion);
        if (match) return { userInput: match, pwInput };
      }

      return { userInput: eligibleUserInputs[0] || null, pwInput };
    } catch {
      return { userInput: null, pwInput: null };
    }
  }

  function hasVisiblePasswordInput(): boolean {
    try {
      const pwInputs = Array.from(document.querySelectorAll('input[type="password"]')) as HTMLInputElement[];
      return pwInputs.some(input => input.offsetWidth > 0 || input.offsetHeight > 0);
    } catch {
      return false;
    }
  }

  function fillPTCredentials(username: string, password: string) {
    const { userInput, pwInput } = findPTLoginFields();
    if (!userInput || !pwInput) return false;
    
    if (userInput.value && pwInput.value) return false;

    try {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      if (setter) {
        if (!userInput.value) {
          setter.call(userInput, username);
          userInput.dispatchEvent(new Event('input', { bubbles: true }));
          userInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (!pwInput.value) {
          setter.call(pwInput, password);
          pwInput.dispatchEvent(new Event('input', { bubbles: true }));
          pwInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
      } else {
        if (!userInput.value) userInput.value = username;
        if (!pwInput.value) pwInput.value = password;
      }
      return true;
    } catch {
      return false;
    }
  }

  function showToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
    const toastHostId = 'mp-pt-toast-host';
    let host = document.getElementById(toastHostId);
    if (!host) {
      host = document.createElement('div');
      host.id = toastHostId;
      host.style.cssText = 'position: fixed !important; top: 20px !important; right: 20px !important; z-index: 999999999 !important; display: flex !important; flex-direction: column !important; gap: 8px !important; pointer-events: none !important;';
      document.body.appendChild(host);
    }

    const shadow = host.shadowRoot || host.attachShadow({ mode: 'open' });

    let container = shadow.querySelector('.toast-container') as HTMLElement | null;
    if (!container) {
      container = document.createElement('div');
      container.className = 'toast-container';
      container.style.cssText = 'display: flex !important; flex-direction: column !important; gap: 8px !important; align-items: flex-end !important;';
      shadow.appendChild(container);
    }

    const toast = document.createElement('div');
    const bgColors = {
      success: '#f0fdfa',
      error: '#fef2f2',
      info: '#f8fafc'
    };
    const borderColors = {
      success: 'rgba(45, 212, 191, 0.4)',
      error: 'rgba(248, 113, 113, 0.4)',
      info: 'rgba(203, 213, 225, 0.4)'
    };
    const textColors = {
      success: '#0f766e',
      error: '#991b1b',
      info: '#334155'
    };
    const icons = {
      success: `<svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:#0d9488;flex-shrink:0;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>`,
      error: `<svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:#e11d48;flex-shrink:0;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`,
      info: `<svg viewBox="0 0 24 24" style="width:16px;height:16px;fill:#64748b;flex-shrink:0;"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>`
    };

    toast.style.cssText = `
      display: flex !important;
      align-items: center !important;
      gap: 8px !important;
      background: ${bgColors[type]} !important;
      backdrop-filter: blur(8px) !important;
      border: 1px solid ${borderColors[type]} !important;
      border-radius: 8px !important;
      padding: 8px 12px !important;
      box-shadow: 0 4px 12px rgba(0,0,0,0.08) !important;
      color: ${textColors[type]} !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
      font-size: 12px !important;
      font-weight: 500 !important;
      opacity: 0 !important;
      transform: translateX(50px) !important;
      transition: all 0.3s cubic-bezier(0.25, 1, 0.5, 1) !important;
      pointer-events: auto !important;
      white-space: nowrap !important;
    `;

    toast.innerHTML = `${icons[type]}<span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.setProperty('opacity', '1', 'important');
      toast.style.setProperty('transform', 'translateX(0)', 'important');
    }, 50);

    setTimeout(() => {
      toast.style.setProperty('opacity', '0', 'important');
      toast.style.setProperty('transform', 'translateX(50px)', 'important');
      setTimeout(() => {
        toast.remove();
        if (container && container.children.length === 0) {
          host?.remove();
        }
      }, 300);
    }, 3000);
  }

  function injectSaveBanner(domain: string, username: string, password: string) {
    const hostId = 'mp-pt-save-banner-host';
    if (document.getElementById(hostId)) return;

    try {
      const host = document.createElement('div');
      host.id = hostId;
      host.style.cssText = 'position: fixed !important; top: 20px !important; right: -360px !important; width: 340px !important; z-index: 99999999 !important; transition: right 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;';
      document.body.appendChild(host);

      const shadow = host.attachShadow({ mode: 'closed' });

      const banner = document.createElement('div');
      banner.style.cssText = `
        background: rgba(255, 255, 255, 0.98) !important;
        backdrop-filter: blur(10px) !important;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.12), 0 2px 6px rgba(0, 0, 0, 0.05) !important;
        border: 1px solid rgba(226, 232, 240, 0.9) !important;
        border-radius: 12px !important;
        padding: 10px 12px !important;
        display: flex !important;
        align-items: center !important;
        gap: 10px !important;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif !important;
        box-sizing: border-box !important;
        width: 100% !important;
      `;

      const logo = document.createElement('img');
      logo.src = chrome.runtime.getURL('icons/icon.png');
      logo.style.cssText = 'width: 28px !important; height: 28px !important; flex-shrink: 0 !important; border-radius: 6px !important;';

      const textWrap = document.createElement('div');
      textWrap.style.cssText = 'flex: 1 !important; min-width: 0 !important;';
      
      const title = document.createElement('div');
      title.textContent = 'MoviePilot Tools';
      title.style.cssText = 'font-size: 12px !important; font-weight: 700 !important; color: #0f172a !important; text-align: left !important; line-height: 1.3 !important;';
      
      const desc = document.createElement('div');
      desc.textContent = `保存 ${domain} 的账号密码？`;
      desc.style.cssText = 'font-size: 11px !important; color: #64748b !important; margin-top: 1px !important; text-align: left !important; line-height: 1.3 !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important;';

      textWrap.appendChild(title);
      textWrap.appendChild(desc);

      const btnRow = document.createElement('div');
      btnRow.style.cssText = 'display: flex !important; gap: 6px !important; flex-shrink: 0 !important;';

      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = '暂不';
      cancelBtn.style.cssText = `
        padding: 4px 10px !important;
        border: 1px solid #cbd5e1 !important;
        background: #fff !important;
        color: #475569 !important;
        border-radius: 6px !important;
        font-size: 11px !important;
        cursor: pointer !important;
        font-weight: 600 !important;
        transition: all 0.2s !important;
        box-sizing: border-box !important;
      `;
      cancelBtn.onmouseenter = () => { cancelBtn.style.background = '#f8fafc'; };
      cancelBtn.onmouseleave = () => { cancelBtn.style.background = '#fff'; };
      cancelBtn.onclick = () => { dismissBanner(); };

      const saveBtn = document.createElement('button');
      saveBtn.textContent = '保存凭据';
      saveBtn.style.cssText = `
        padding: 4px 10px !important;
        border: none !important;
        background: #2563eb !important;
        color: #fff !important;
        border-radius: 6px !important;
        font-size: 11px !important;
        cursor: pointer !important;
        font-weight: 600 !important;
        transition: all 0.2s !important;
        box-sizing: border-box !important;
      `;
      saveBtn.onmouseenter = () => { saveBtn.style.background = '#1d4ed8'; };
      saveBtn.onmouseleave = () => { saveBtn.style.background = '#2563eb'; };
      saveBtn.onclick = () => {
        chrome.runtime.sendMessage({
          type: 'MP_PT_SAVE_CRED',
          domain,
          username,
          password
        }, (resp) => {
          if (resp?.success) {
            dismissBanner();
            showToast('凭据保存成功', 'success');
          } else {
            showToast('保存失败: ' + (resp?.error || '未知错误'), 'error');
          }
        });
      };

      btnRow.appendChild(cancelBtn);
      btnRow.appendChild(saveBtn);
      
      banner.appendChild(logo);
      banner.appendChild(textWrap);
      banner.appendChild(btnRow);
      
      shadow.appendChild(banner);
      
      setTimeout(() => {
        host.style.setProperty('right', '20px', 'important');
      }, 100);

      function dismissBanner() {
        host.style.setProperty('right', '-360px', 'important');
        setTimeout(() => {
          host.remove();
        }, 500);
      }
    } catch {}
  }

  function setupLoginDetection() {
    const updatePendingFromFields = () => {
      const { userInput, pwInput } = findPTLoginFields();
      if (userInput && pwInput && userInput.value.trim() && pwInput.value.trim()) {
        pendingUsername = userInput.value.trim();
        pendingPassword = pwInput.value.trim();
        try {
          sessionStorage.setItem('mp_pending_username', pendingUsername);
          sessionStorage.setItem('mp_pending_password', pendingPassword);
          sessionStorage.setItem('mp_pending_domain', window.location.hostname);
          sessionStorage.setItem('mp_pending_time', Date.now().toString());
        } catch {}
      }
    };

    const triggerDeferredSuccessCheck = () => {
      if (checkTimeout) clearTimeout(checkTimeout);
      checkTimeout = window.setTimeout(() => {
        checkLoginSuccessAndPrompt();
      }, 1500);
    };

    document.addEventListener('blur', (e) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT') {
        updatePendingFromFields();
      }
    }, true);

    document.addEventListener('change', (e) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT') {
        updatePendingFromFields();
      }
    }, true);

    document.addEventListener('submit', (e) => {
      updatePendingFromFields();
      triggerDeferredSuccessCheck();
    }, true);

    // 监听输入框内按下回车键（针对无 form 的 AJAX 异步登录）
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT') {
          updatePendingFromFields();
          triggerDeferredSuccessCheck();
        }
      }
    }, true);

    document.addEventListener('click', (e) => {
      let el = e.target as HTMLElement | null;
      let isSubmitBtn = false;
      
      for (let i = 0; i < 4 && el; i++) {
        const text = (el.textContent || '').trim();
        const value = el instanceof HTMLInputElement ? el.value : '';
        const isClickable = el.tagName === 'BUTTON' || 
                            el.tagName === 'A' || 
                            (el.tagName === 'INPUT' && ['submit', 'button'].includes((el as HTMLInputElement).type)) ||
                            el.classList.contains('btn') ||
                            el.style.cursor === 'pointer';
        
        if (isClickable) {
          if (
            /登\s*录|登\s*陆|提\s*交|login|sign\s*in|submit|确\s*定|进\s*入/i.test(text) ||
            /登\s*录|登\s*陆|提\s*交|login|sign\s*in|submit|确\s*定|进\s*入/i.test(value) ||
            el.matches('button[type="submit"], input[type="submit"]')
          ) {
            isSubmitBtn = true;
            break;
          }
        }
        el = el.parentElement;
      }

      if (isSubmitBtn) {
        updatePendingFromFields();
        triggerDeferredSuccessCheck();
      }
    }, true);
  }

  function checkLoginSuccessAndPrompt() {
    try {
      const storedTimeStr = sessionStorage.getItem('mp_pending_time');
      if (!storedTimeStr) return;
      
      const storedTime = parseInt(storedTimeStr);
      if (Date.now() - storedTime > 120 * 1000) {
        clearPendingCreds();
        return;
      }

      const domain = sessionStorage.getItem('mp_pending_domain');
      const username = sessionStorage.getItem('mp_pending_username');
      const password = sessionStorage.getItem('mp_pending_password');

      if (domain === window.location.hostname && username && password) {
        if (!hasVisiblePasswordInput()) {
          clearPendingCreds();
          chrome.runtime.sendMessage({
            type: 'MP_PT_GET_DECRYPTED_CRED',
            domain
          }, (resp) => {
            if (resp?.success) {
              const existing = resp.credential;
              if (existing && existing.username === username && existing.password === password) {
                return;
              }
              injectSaveBanner(domain, username, password);
            }
          });
        }
      }
    } catch {}
  }

  function clearPendingCreds() {
    try {
      sessionStorage.removeItem('mp_pending_username');
      sessionStorage.removeItem('mp_pending_password');
      sessionStorage.removeItem('mp_pending_domain');
      sessionStorage.removeItem('mp_pending_time');
    } catch {}
  }

  function initPTAutofillAndDetection() {
    if (isInIframe()) return;

    chrome.runtime.sendMessage({ type: 'MP_PT_GET_CONFIG' }, (resp) => {
      if (resp?.success && resp.config) {
        ptCredsConfig = resp.config;
      }

      if (ptCredsConfig.autoSaveEnabled) {
        checkLoginSuccessAndPrompt();
        setupLoginDetection();
      }

      if (ptCredsConfig.autoFillEnabled) {
        const domain = window.location.hostname;
        chrome.runtime.sendMessage({
          type: 'MP_PT_GET_DECRYPTED_CRED',
          domain
        }, (resp) => {
          if (resp?.success && resp.credential) {
            const { username, password } = resp.credential;
            fillPTCredentials(username, password);
            
            const autofillObserver = new MutationObserver(() => {
              if (fillPTCredentials(username, password)) {
                autofillObserver.disconnect();
              }
            });
            autofillObserver.observe(document.documentElement || document.body, { childList: true, subtree: true });
            
            setTimeout(() => {
              autofillObserver.disconnect();
            }, 10000);
          }
        });
      }
    });
  }

  try {
    initPTAutofillAndDetection();
  } catch (e) {
    console.error('[MP Tools] PT 自动填充初始化失败:', e);
  }

  window.addEventListener('message', handleMessage);
})();



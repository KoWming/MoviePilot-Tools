// Captcha auto-fill content script
// - 检测登录页面和验证码元素
// - 通过 Background 调用 OCR 识别服务
// - 自动填充验证码输入框

(function () {
  const STORAGE_KEY = 'mp.web_embed_features';
  const TAG = '[MP 验证码填充]';

  // ========== 登录页面路径检测 ==========
  const LOGIN_PAGES = [
    '/login.php',
    '/login',
    '/signin',
    '/account/login',
    '/user/login',
    '/entry/login',
    '/takelogin.php',
    '/logging.php'
  ];

  const TOTP_INPUT_IDS = [
    'otpCode',
    'otp_code',
    'otp-code',
    'totp',
    'twoFactorCode',
    'two_factor_code',
    'authenticator_code',
    'verify_code',
    '2fa',
    'twofa'
  ];

  const TOTP_INPUT_NAMES = [
    '2fa_secret',
    'two_factor_code',
    'two_step_code',
    'twostep_code',
    'verify_code',
    'otp',
    'totp',
    'two_factor',
    '2fa',
    'twofa',
    'twostep',
    'otp_code',
    '2fa_code',
    'form_item__2fa'
  ];

  const TOTP_FILL_INTERVAL = 2000;
  const TOTP_MAX_ATTEMPTS = 3;

  function log(...args: any[]) {
    console.log(TAG, ...args);
  }

  function isLoginPage(): boolean {
    const pathname = window.location.pathname.toLowerCase();
    const hasPasswordField = !!document.querySelector('input[type="password"]');
    if (!hasPasswordField) return false;
    return LOGIN_PAGES.some(page => pathname.includes(page)) || pathname.includes('login');
  }

  // ========== 验证码检测模式 ==========
  const CAPTCHA_PATTERNS = [
    {
      name: 'verify-image',
      imageSelectors: [
        'img[title="Verify Image"]',
        'img[alt="Verify Image"]',
        'img[title="verify image" i]',
        'img[alt="verify image" i]',
        'img[alt="CAPTCHA"]',
        'img[src*="verify" i]',
        'img[src*="vfcode"]',
        'img[src*="seccode"]',
        'img[src*="security" i][src*="code" i]',
        'img[id*="verify" i]',
        'img[id*="vfcode"]',
        'img[id*="seccode"]'
      ],
      inputSelectors: [
        'input[name="txt_code"]',
        'input[name="Verify Code"]',
        'input[name="verify_code"]',
        'input[name="verifycode"]',
        'input[name="verification_code"]',
        'input[name="security_code"]',
        'input[name="vfcode"]',
        'input[name="seccode"]',
        'input[placeholder*="Verify Code" i]',
        'input[placeholder*="verify code" i]',
        'input[placeholder*="verification" i]',
        'input[placeholder*="security code" i]'
      ]
    },
    {
      name: 'standard-regimage',
      imageSelectors: [
        'img[alt="CAPTCHA"]',
        'img[alt="captcha"]',
        '.captcha-img',
        '#captcha-img'
      ],
      inputSelectors: [
        '#imagestring',
        'input[name="imagestring"]',
        'input[name="txt_code"]',
        '.captcha-input',
        'input[placeholder*="验证码"]'
      ]
    },
    {
      name: 'span-verify-image',
      imageSelectors: [
        'span.verify-image img',
        'span.verify-image img[alt="SECURITY CODE"]'
      ],
      inputSelectors: [
        'span.control.text-field input[name="imagestring"]',
        'span.control.text-field input[type="text"]'
      ]
    },
    {
      name: 'generic-captcha',
      imageSelectors: [
        'img[title*="验证码"]',
        'img[alt*="captcha" i]',
        'img[alt*="验证码"]',
        'img[src*="captcha"]',
        'img[src*="/code"]',
        'img[src*="image.php"]',
        'img[id*="captcha"]',
        'img[id*="vcode"]',
        'img[src*="verify"]',
        'img[src*="vfcode"]',
        'img[src*="seccode"]',
        'img[alt*="verify" i]',
        'img[title*="verify" i]',
        '.captcha',
        '#captcha'
      ],
      inputSelectors: [
        'input[name*="code"]',
        'input[name*="captcha"]',
        'input[name*="captcha_code"]',
        'input[class*="captcha"]',
        'input[name*="verify" i]',
        '#captcha',
        '.captcha-input',
        'input[placeholder*="验证码"]',
        'input[placeholder*="captcha"]',
        'input[placeholder*="CAPTCHA"]',
        'input[placeholder*="verify" i]'
      ]
    }
  ];

  let captchaFilled = false;
  let totpFilled = false;
  let isProcessing = false;
  let isTotpProcessing = false;
  let totpAttemptCount = 0;
  let totpFillTimer: ReturnType<typeof setInterval> | null = null;
  let totpLoadCompleteRetried = false;
  let lastCaptchaImageSrc = '';
  let lastCaptchaInputSelector = '';

  // ========== 配置读取 ==========
  async function getConfig(): Promise<{ captchaAutoFillEnabled: boolean; totpAutoFillEnabled: boolean; captchaAiAssistEnabled: boolean; captchaOfflineOcrEnabled: boolean }> {
    try {
      const data = await chrome.storage.local.get([STORAGE_KEY]);
      const config = data[STORAGE_KEY] as { captchaAutoFillEnabled?: boolean; totpAutoFillEnabled?: boolean; captchaAiAssistEnabled?: boolean; captchaOfflineOcrEnabled?: boolean } | undefined;
      return {
        captchaAutoFillEnabled: config?.captchaAutoFillEnabled === true,
        totpAutoFillEnabled: config?.totpAutoFillEnabled === true,
        captchaOfflineOcrEnabled: config?.captchaOfflineOcrEnabled === true,
        captchaAiAssistEnabled: config?.captchaAiAssistEnabled === true
      };
    } catch {
      return { captchaAutoFillEnabled: false, totpAutoFillEnabled: false, captchaAiAssistEnabled: false, captchaOfflineOcrEnabled: false };
    }
  }

  type TotpSite = {
    id: string;
    name: string;
    secret: string;
    url?: string;
  };

  async function getTotpSites(): Promise<TotpSite[]> {
    try {
      // TOTP 数据由 popup 加密存储在 storage.local 中，content script 无法直接解密
      // 改为通过 background 解密后返回
      return new Promise(resolve => {
        chrome.runtime.sendMessage({ type: 'MP_GET_TOTP_SITES' }, response => {
          if (chrome.runtime.lastError) {
            log('获取 TOTP 站点失败:', chrome.runtime.lastError.message);
            resolve([]);
          } else if (response?.success && Array.isArray(response.sites)) {
            resolve(response.sites);
          } else {
            log('获取 TOTP 站点失败:', response?.error || '未知错误');
            resolve([]);
          }
        });
      });
    } catch (error) {
      log('读取 TOTP 站点失败:', error);
      return [];
    }
  }

  function getHostname(value: string): string {
    try {
      const normalized = /^https?:\/\//i.test(value) ? value : `https://${value}`;
      return new URL(normalized).hostname.toLowerCase();
    } catch {
      return '';
    }
  }

  function matchTotpSite(sites: TotpSite[]): TotpSite | null {
    const currentHost = location.hostname.toLowerCase();
    const title = document.title.toLowerCase();
    const exactUrlMatches: TotpSite[] = [];
    const domainMatches: TotpSite[] = [];
    const textMatches: TotpSite[] = [];

    for (const site of sites) {
      if (!site.secret) continue;
      const siteHost = site.url ? getHostname(site.url) : '';
      if (siteHost) {
        if (currentHost === siteHost) exactUrlMatches.push(site);
        else if (currentHost.endsWith(`.${siteHost}`) || siteHost.endsWith(`.${currentHost}`)) domainMatches.push(site);
        continue;
      }
      const name = (site.name || '').toLowerCase().trim();
      if (name && (currentHost.includes(name) || title.includes(name))) textMatches.push(site);
    }

    if (exactUrlMatches[0]) return exactUrlMatches[0];
    if (domainMatches[0]) return domainMatches[0];
    if (textMatches[0]) return textMatches[0];
    return null;
  }

  function base32Decode(input: string): Uint8Array {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
    let buffer = 0;
    let bufferSize = 0;
    const output: number[] = [];

    for (const char of clean) {
      const value = chars.indexOf(char);
      if (value < 0) continue;
      buffer = (buffer << 5) | value;
      bufferSize += 5;
      if (bufferSize >= 8) {
        bufferSize -= 8;
        output.push((buffer >> bufferSize) & 0xff);
      }
    }

    return new Uint8Array(output);
  }

  async function generateTotpCode(secret: string): Promise<string> {
    const timeStep = 30;
    const digits = 6;
    const time = Math.floor(Date.now() / 1000 / timeStep);
    const timeBuffer = new ArrayBuffer(8);
    const timeView = new DataView(timeBuffer);
    timeView.setUint32(0, 0, false);
    timeView.setUint32(4, time, false);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      base32Decode(secret).buffer as ArrayBuffer,
      { name: 'HMAC', hash: 'SHA-1' },
      false,
      ['sign']
    );
    const signature = new Uint8Array(await crypto.subtle.sign('HMAC', cryptoKey, timeBuffer));
    const offset = signature[signature.length - 1] & 0x0f;
    const code = ((signature[offset] & 0x7f) << 24) |
      ((signature[offset + 1] & 0xff) << 16) |
      ((signature[offset + 2] & 0xff) << 8) |
      (signature[offset + 3] & 0xff);

    return (code % Math.pow(10, digits)).toString().padStart(digits, '0');
  }

  function isVisibleInput(input: HTMLInputElement): boolean {
    const style = window.getComputedStyle(input);
    const rect = input.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0 && !input.disabled && !input.readOnly;
  }

  type TotpTarget = HTMLInputElement | HTMLInputElement[];

  function findTotpTarget(): TotpTarget | null {
    for (const id of TOTP_INPUT_IDS) {
      const input = document.getElementById(id) as HTMLInputElement | null;
      if (input && input.tagName === 'INPUT' && isVisibleInput(input) && !isCaptchaLikeInput(input)) return input;
    }

    for (const name of TOTP_INPUT_NAMES) {
      const input = document.querySelector(`input[name="${name}"]`) as HTMLInputElement | null;
      if (input && isVisibleInput(input) && !isCaptchaLikeInput(input)) return input;
    }

    const selectors = [
      'input[autocomplete="one-time-code"]',
      'input[name*="totp" i]',
      'input[id*="totp" i]',
      'input[name*="otp" i]',
      'input[id*="otp" i]',
      'input[name*="2fa" i]',
      'input[id*="2fa" i]',
      'input[name*="mfa" i]',
      'input[id*="mfa" i]',
      'input[name*="auth" i]',
      'input[id*="auth" i]',
      'input[placeholder*="两步"]',
      'input[placeholder*="动态"]',
      'input[placeholder*="令牌"]',
      'input[placeholder*="安全码"]',
      'input[placeholder*="二步"]',
      'input[placeholder*="双因素"]',
      'input[placeholder*="Authenticator" i]',
      'input[placeholder*="Google Authenticator" i]',
      'input[placeholder*="2FA" i]',
      'input[placeholder*="OTP" i]'
    ];

    for (const selector of selectors) {
      const input = document.querySelector(selector) as HTMLInputElement | null;
      if (input && isVisibleInput(input) && !isCaptchaLikeInput(input)) return input;
    }

    const splitInputs = findSplitTotpInputs();
    if (splitInputs) return splitInputs;

    const candidates = getTotpInputCandidates();
    const passwordCount = document.querySelectorAll('input[type="password"]').length;
    const hasTotpContext = hasTotpPageContext();
    log('两步验证输入框候选:', candidates.map(input => ({
      type: input.type,
      name: input.name,
      id: input.id,
      placeholder: input.placeholder,
      maxLength: input.maxLength,
      text: getInputText(input).slice(0, 120)
    })));

    for (const input of candidates) {
      const maxLength = input.maxLength;
      const text = getInputText(input);
      const looksLikeOtp = isTotpText(text);
      if (looksLikeOtp) return input;
      if (hasTotpContext && (maxLength === 6 || maxLength === 8)) return input;
    }

    if (hasTotpContext && candidates.length === 1) {
      log('使用唯一可见文本输入框作为两步验证输入框兜底');
      return candidates[0];
    }

    if (passwordCount > 0) {
      const afterPassword = findInputAfterLastPassword(candidates);
      if (afterPassword) {
        log('使用密码框后的文本输入框作为两步验证输入框兜底');
        return afterPassword;
      }
    }

    return null;
  }

  function getTotpInputCandidates(): HTMLInputElement[] {
    return (Array.from(document.querySelectorAll('input')) as HTMLInputElement[])
      .filter(input => {
        if (!isVisibleInput(input)) return false;
        const type = (input.type || 'text').toLowerCase();
        if (!['text', 'tel', 'number', 'password'].includes(type)) return false;
        if (isCaptchaLikeInput(input)) return false;
        if (isAccountLikeInput(input)) return false;
        if (isSearchLikeInput(input)) return false;
        return true;
      });
  }

  function findInputAfterLastPassword(candidates: HTMLInputElement[]): HTMLInputElement | null {
    const passwords = Array.from(document.querySelectorAll('input[type="password"]')) as HTMLInputElement[];
    const visiblePasswords = passwords.filter(isVisibleInput);
    const lastPassword = visiblePasswords[visiblePasswords.length - 1];
    if (!lastPassword) return null;
    const passwordRect = lastPassword.getBoundingClientRect();
    return candidates
      .filter(input => input !== lastPassword)
      .filter(input => input.getBoundingClientRect().top >= passwordRect.top)
      .sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top)[0] || null;
  }

  /** 检查输入框是否看起来像单字符输入框（宽度小、maxLength=1、或 inputMode=numeric） */
  function looksLikeSingleCharInput(input: HTMLInputElement): boolean {
    // 显式声明为单字符
    if (input.maxLength === 1 || input.getAttribute('maxlength') === '1') return true;
    // inputMode=numeric 的短输入框
    if (input.inputMode === 'numeric' && input.getBoundingClientRect().width <= 96) return true;
    // 宽度 ≤48px 且高度 ≤64px 的可见输入框（典型的分格输入框尺寸）
    const rect = input.getBoundingClientRect();
    if (rect.width > 0 && rect.width <= 48 && rect.height > 0 && rect.height <= 64) return true;
    return false;
  }

  function findSplitTotpInputs(): HTMLInputElement[] | null {
    const inputs = (Array.from(document.querySelectorAll('input')) as HTMLInputElement[])
      .filter(input => {
        if (!isVisibleInput(input)) return false;
        if (isCaptchaLikeInput(input)) return false;
        const type = (input.type || 'text').toLowerCase();
        if (!['text', 'tel', 'number', 'password'].includes(type)) return false;
        return looksLikeSingleCharInput(input);
      });

    if (inputs.length < 6) return null;

    const groups = new Map<number, HTMLInputElement[]>();
    for (const input of inputs) {
      const top = Math.round(input.getBoundingClientRect().top / 10) * 10;
      const group = groups.get(top) || [];
      group.push(input);
      groups.set(top, group);
    }

    for (const group of groups.values()) {
      if (group.length < 6) continue;
      const sorted = group.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left).slice(0, 6);
      const widthOk = sorted.every(input => input.getBoundingClientRect().width <= 96);
      if (widthOk) return sorted;
    }

    return null;
  }

  function getInputText(input: HTMLInputElement): string {
    const values = [
      input.name,
      input.id,
      input.className,
      input.placeholder,
      input.getAttribute('aria-label') || '',
      input.getAttribute('data-name') || ''
    ];
    if (input.id) {
      const label = document.querySelector(`label[for="${CSS.escape(input.id)}"]`);
      if (label) values.push(label.textContent || '');
    }
    const wrapperLabel = input.closest('label');
    if (wrapperLabel) values.push(wrapperLabel.textContent || '');
    return values.join(' ').toLowerCase();
  }

  function isCaptchaLikeInput(input: HTMLInputElement): boolean {
    const text = getInputText(input);
    return /captcha|vcode|verify.?code|check.?code|imagestring|验证码|图形|图片/.test(text);
  }

  function isTotpText(text: string): boolean {
    return /otp|totp|2fa|mfa|authenticator|google authenticator|two[-_\s]?factor|twofactor|two-step|twostep|两步|二步|双因素|动态|令牌|安全码|一次性|验证器/.test(text);
  }

  function hasTotpPageContext(): boolean {
    const values = [
      document.title,
      document.body?.textContent?.slice(0, 3000) || ''
    ];
    return isTotpText(values.join(' ').toLowerCase());
  }

  function isSearchLikeInput(input: HTMLInputElement): boolean {
    const type = (input.type || 'text').toLowerCase();
    if (type === 'search') return true;
    const text = getInputText(input);
    return /search|keyword|keywords|query|q\b|搜索|搜素|关键字|关键词|查找|检索/.test(text);
  }

  function isChatLikeInput(input: HTMLInputElement): boolean {
    const text = getInputText(input);
    return /chat|message|comment|reply|send|msg|消息|聊天|留言|评论|回复|发送|群聊/.test(text);
  }

  function isAccountLikeInput(input: HTMLInputElement): boolean {
    const type = (input.type || 'text').toLowerCase();
    if (type === 'password') return true;
    const text = getInputText(input);
    return /user.?name|account|email|mail|phone|mobile|login|password|passwd|pwd|用户名|账号|账户|邮箱|手机|密码/.test(text);
  }

  function setInputValue(input: HTMLInputElement, value: string): void {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function fillTotpTarget(target: TotpTarget, code: string): void {
    if (Array.isArray(target)) {
      target.forEach((input, index) => {
        setInputValue(input, code[index] || '');
        input.dispatchEvent(new KeyboardEvent('keyup', { bubbles: true, key: code[index] || '' }));
      });
      target[target.length - 1]?.focus();
      return;
    }
    setInputValue(target, code);
  }

  async function processTotp(): Promise<boolean> {
    if (totpFilled || isTotpProcessing) return false;
    const config = await getConfig();
    if (!config.totpAutoFillEnabled) return false;

    isTotpProcessing = true;
    try {
      const sites = await getTotpSites();
      if (sites.length === 0) {
        log('未配置 TOTP 站点，跳过两步验证填充');
        return false;
      }
      const site = matchTotpSite(sites);
      if (!site) {
        log('当前页面未匹配到 TOTP 站点:', location.hostname);
        return false;
      }
      const target = findTotpTarget();
      if (!target) {
        log('未找到两步验证输入框');
        return false;
      }
      // 检查输入框是否已有有效的 TOTP 值（6或8位数字）
      if (!Array.isArray(target) && target.value && target.value.trim()) {
        const existingValue = target.value.trim();
        const isValidTotp = /^\d{6}(\d{2})?$/.test(existingValue);
        if (isValidTotp) {
          log(`两步验证输入框已有有效验证码: ${existingValue}，停止自动填充`);
          totpFilled = true;
          stopTotpAutoFill();
          return false;
        }
        // 已有值但不是有效验证码（可能是浏览器填充的密码等），清除后继续填充
        log(`两步验证输入框已有非验证码值: "${existingValue}"，将覆盖填充`);
        if (Array.isArray(target)) {
          target.forEach(input => setInputValue(input, ''));
        } else {
          setInputValue(target, '');
        }
      }
      const code = await generateTotpCode(site.secret);
      fillTotpTarget(target, code);
      totpFilled = true;
      stopTotpAutoFill();
      log(`两步验证码已填充: ${site.name}`);
      showToast(`两步验证码【${code}】已填充`, site.name || '', 'success');
      return true;
    } catch (error) {
      log('两步验证码填充失败:', error);
      return false;
    } finally {
      isTotpProcessing = false;
    }
  }

  function startTotpAutoFill(): void {
    if (totpFillTimer || totpFilled) return;
    attemptTotpAutoFill();
    totpFillTimer = setInterval(() => {
      if (totpFilled) {
        stopTotpAutoFill();
        return;
      }
      attemptTotpAutoFill();
    }, TOTP_FILL_INTERVAL);
  }

  function attemptTotpAutoFill(): void {
    if (totpFilled || isTotpProcessing) return;
    if (totpAttemptCount >= TOTP_MAX_ATTEMPTS) {
      log('两步验证自动填充达到最大尝试次数，停止检测');
      stopTotpAutoFill();
      return;
    }
    totpAttemptCount += 1;
    processTotp().finally(() => {
      if (!totpFilled && totpAttemptCount >= TOTP_MAX_ATTEMPTS) {
        log('两步验证自动填充达到最大尝试次数，停止检测');
        stopTotpAutoFill();
      }
    });
  }

  function stopTotpAutoFill(): void {
    if (totpFillTimer) {
      clearInterval(totpFillTimer);
      totpFillTimer = null;
    }
  }

  function resetTotpAutoFill(): void {
    if (totpFilled) return;
    totpAttemptCount = 0;
    stopTotpAutoFill();
    startTotpAutoFill();
  }

  function setupTotpFocusListener(): void {
    document.addEventListener('focus', event => {
      if (totpFilled || isTotpProcessing) return;
      const input = event.target as HTMLInputElement | null;
      if (!input || input.tagName !== 'INPUT') return;
      if (!isVisibleInput(input) || isCaptchaLikeInput(input) || isAccountLikeInput(input)) return;
      if (isSearchLikeInput(input)) return;
      const text = getInputText(input);
      if (!isTotpText(text) && (!hasTotpPageContext() || (input.maxLength !== 6 && input.maxLength !== 8))) return;
      if (input.value && input.value.trim()) {
        stopTotpAutoFill();
        return;
      }
      setTimeout(() => {
        if (!totpFilled && !isTotpProcessing) attemptTotpAutoFill();
      }, 100);
    }, true);
  }

  function setupTotpUrlChangeListener(): void {
    let currentUrl = location.href;
    const onUrlChange = () => {
      if (totpFilled) return;
      setTimeout(() => {
        totpLoadCompleteRetried = false;
        resetTotpAutoFill();
      }, 1000);
    };
    new MutationObserver(() => {
      if (location.href === currentUrl) return;
      currentUrl = location.href;
      onUrlChange();
    }).observe(document.body, { childList: true, subtree: true });
    window.addEventListener('popstate', onUrlChange);
    window.addEventListener('hashchange', onUrlChange);
  }

  // ========== 等待 DOM 元素 ==========
  function waitForElement(selector: string, timeout = 5000): Promise<Element | null> {
    return new Promise(resolve => {
      const existing = document.querySelector(selector);
      if (existing) { resolve(existing); return; }

      const observer = new MutationObserver(() => {
        const found = document.querySelector(selector);
        if (found) { observer.disconnect(); resolve(found); }
      });

      observer.observe(document.body, { childList: true, subtree: true });

      setTimeout(() => { observer.disconnect(); resolve(null); }, timeout);
    });
  }

  function isVisibleElement(element: Element): boolean {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
  }

  function isLikelyCaptchaImage(image: HTMLImageElement): boolean {
    if (!isVisibleElement(image)) return false;
    const rect = image.getBoundingClientRect();
    const src = (image.src || '').toLowerCase();
    const text = [
      image.id,
      image.className,
      image.alt,
      image.title,
      image.src,
      image.getAttribute('data-src') || '',
      image.closest('[role="dialog"], .dialog, .modal, .layui-layer, .ui-dialog, .ajax, form')?.textContent?.slice(0, 500) || ''
    ].join(' ').toLowerCase();

    // 排除 favicon、图标、logo 等常见非验证码图片
    if (/\.(ico|svg|gif)$/i.test(src)) return false;
    if (/favicon|\/icon[s]?\/|logo|avatar|badge|sprite|emoticon|emoji|smiley/i.test(src)) return false;
    if (/\.ico$|icon\.png|icon\.jpg|site\.ico|favicon/i.test(src)) return false;

    // 排除非常小的图片（如 16x16、32x32 图标）
    const width = image.naturalWidth || rect.width;
    const height = image.naturalHeight || rect.height;
    if (width < 60 || height < 20 || width > 400 || height > 200) return false;

    if (/captcha|verify|vcode|vfcode|seccode|security.?code|验证码|校验码|图片验证|show up/.test(text)) return true;

    const nearbyInput = findNearbyCaptchaInput(image);
    return !!nearbyInput;
  }

  function findNearbyCaptchaInput(image: HTMLImageElement): HTMLInputElement | null {
    const containers = [
      image.closest('[role="dialog"], .dialog, .modal, .layui-layer, .ui-dialog, .ajax, form'),
      image.parentElement,
      image.parentElement?.parentElement
    ].filter(Boolean) as Element[];

    for (const container of containers) {
      const inputs = (Array.from(container.querySelectorAll('input')) as HTMLInputElement[])
        .filter(input => {
          if (!isVisibleInput(input)) return false;
          const type = (input.type || 'text').toLowerCase();
          if (!['text', 'tel', 'number', 'search', ''].includes(type)) return false;
          if (isAccountLikeInput(input) || isSearchLikeInput(input) || isChatLikeInput(input)) return false;
          // 排除宽度太大的输入框（聊天框等通常很宽）
          const inputRect = input.getBoundingClientRect();
          if (inputRect.width > 400) return false;
          return true;
        })
        .sort((a, b) => getElementDistance(image, a) - getElementDistance(image, b));
      if (inputs[0]) return inputs[0];
    }

    return null;
  }

  function getElementDistance(a: Element, b: Element): number {
    const ar = a.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    const ax = ar.left + ar.width / 2;
    const ay = ar.top + ar.height / 2;
    const bx = br.left + br.width / 2;
    const by = br.top + br.height / 2;
    return Math.hypot(ax - bx, ay - by);
  }

  function getElementSelector(element: Element): string {
    if (element.id) return `#${CSS.escape(element.id)}`;
    const name = element.getAttribute('name');
    if (name) return `${element.tagName.toLowerCase()}[name="${CSS.escape(name)}"]`;

    const parent = element.parentElement;
    if (!parent) return element.tagName.toLowerCase();
    const sameTag = Array.from(parent.children).filter(child => child.tagName === element.tagName);
    const index = sameTag.indexOf(element) + 1;
    return `${getElementSelector(parent)} > ${element.tagName.toLowerCase()}:nth-of-type(${index})`;
  }

  // ========== 检测验证码元素 ==========
  async function detectCaptchaElements(): Promise<{ imageSelector: string; inputSelector: string } | null> {
    for (const pattern of CAPTCHA_PATTERNS) {
      for (const imgSel of pattern.imageSelectors) {
        try {
          if (document.querySelector(imgSel)) {
            for (const inputSel of pattern.inputSelectors) {
              try {
                if (document.querySelector(inputSel)) {
                  log(`找到(${pattern.name}): 图片=${imgSel}, 输入框=${inputSel}`);
                  return { imageSelector: imgSel, inputSelector: inputSel };
                }
              } catch { /* invalid */ }
            }
          }
        } catch { /* invalid */ }
      }
    }

    for (const pattern of CAPTCHA_PATTERNS) {
      for (const imgSel of pattern.imageSelectors) {
        try {
          if (await waitForElement(imgSel, 300)) {
            for (const inputSel of pattern.inputSelectors) {
              try {
                if (await waitForElement(inputSel, 150)) {
                  log(`找到(${pattern.name}): 图片=${imgSel}, 输入框=${inputSel}`);
                  return { imageSelector: imgSel, inputSelector: inputSel };
                }
              } catch { /* invalid */ }
            }
          }
        } catch { /* invalid */ }
      }
    }

    const images = (Array.from(document.querySelectorAll('img')) as HTMLImageElement[])
      .filter(isLikelyCaptchaImage)
      .sort((a, b) => getElementDistance(a, document.activeElement || document.body) - getElementDistance(b, document.activeElement || document.body));

    for (const image of images) {
      const input = findNearbyCaptchaInput(image);
      if (!input) continue;
      const imageSelector = getElementSelector(image);
      const inputSelector = getElementSelector(input);
      log(`找到(ajax-fallback): 图片=${imageSelector}, 输入框=${inputSelector}`);
      return { imageSelector, inputSelector };
    }

    return null;
  }

  // ========== 图片转Base64(优先使用页面实际显示的图片) ==========
  async function imageToBase64(imageElement: HTMLImageElement, imageSrc: string, upscale: boolean): Promise<string> {
    try {
      if (!imageElement.complete && imageElement.decode) {
        await imageElement.decode();
      }

      const width = imageElement.naturalWidth || imageElement.width || imageElement.clientWidth;
      const height = imageElement.naturalHeight || imageElement.height || imageElement.clientHeight;

      if (width > 0 && height > 0) {
        const scale = upscale ? (width < 160 ? 3 : 2) : 1;
        const canvas = document.createElement('canvas');
        canvas.width = width * scale;
        canvas.height = height * scale;

        const context = canvas.getContext('2d');
        if (context) {
          context.imageSmoothingEnabled = !upscale;
          context.fillStyle = '#ffffff';
          context.fillRect(0, 0, canvas.width, canvas.height);
          context.drawImage(imageElement, 0, 0, canvas.width, canvas.height);

          const base64 = canvas.toDataURL('image/png').split(',')[1];
          log(`已截取页面验证码图片: ${width}x${height} -> ${canvas.width}x${canvas.height}`);
          return base64;
        }
      }
    } catch (error) {
      log('页面验证码截图失败，回退到 fetch:', error);
    }

    try {
      let imageUrl = imageSrc;
      if (imageSrc.startsWith('/')) {
        imageUrl = new URL(imageSrc, window.location.href).href;
      } else if (!imageSrc.startsWith('http')) {
        imageUrl = new URL(imageSrc, window.location.href).href;
      }

      const blob = await (await fetch(imageUrl)).blob();

      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      log('图片转 Base64 失败:', error);
      throw error;
    }
  }

  // ========== 直接读取验证码原始图片，避免截图缩放影响离线 OCR ==========
  async function imageSourceToBase64(imageSrc: string): Promise<string> {
    if (imageSrc.startsWith('data:image/')) {
      return imageSrc.split(',')[1] || '';
    }

    let imageUrl = imageSrc;
    if (imageSrc.startsWith('/')) {
      imageUrl = new URL(imageSrc, window.location.href).href;
    } else if (!imageSrc.startsWith('http') && !imageSrc.startsWith('blob:')) {
      imageUrl = new URL(imageSrc, window.location.href).href;
    }

    const blob = await (await fetch(imageUrl, { credentials: 'include' })).blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(((reader.result as string).split(',')[1] || '').trim());
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // ========== 通过Background调用OCR识别 ==========
  function recognizeCaptcha(base64Img: string, aiAssistEnabled: boolean, offlineOcrEnabled: boolean): Promise<{ success: boolean; code?: string; error?: string; provider?: string; aiCode?: string; ocrCode?: string; offlineCode?: string }> {
    return new Promise(resolve => {
      chrome.runtime.sendMessage(
        { type: 'MP_RECOGNIZE_CAPTCHA', base64Img, aiAssistEnabled, offlineOcrEnabled },
        response => {
          if (chrome.runtime.lastError) {
            log('发送识别请求失败:', chrome.runtime.lastError.message);
            resolve({ success: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(response || { success: false, error: '未收到响应' });
          }
        }
      );
    });
  }

  // ========== 页面吐司通知（使用 DOM API，避免 innerHTML） ==========
  function showToast(title: string, message: string, type: 'success' | 'error' = 'success') {
    const id = 'mp-captcha-toast';
    const styleId = 'mp-captcha-toast-style';
    const existing = document.getElementById(id);
    if (existing) existing.remove();

    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        @keyframes mpCaptchaToastIn {
          from { opacity: 0; transform: translate3d(12px, -12px, 0) scale(.96); filter: blur(2px); }
          to { opacity: 1; transform: translate3d(0, 0, 0) scale(1); filter: blur(0); }
        }
        @keyframes mpCaptchaToastOut {
          from { opacity: 1; transform: translate3d(0, 0, 0) scale(1); filter: blur(0); }
          to { opacity: 0; transform: translate3d(12px, -10px, 0) scale(.98); filter: blur(2px); }
        }
        @keyframes mpCaptchaToastProgress {
          from { transform: scaleX(1); }
          to { transform: scaleX(0); }
        }
      `;
      document.head.appendChild(style);
    }

    const colors = type === 'success'
      ? {
        accent: '#16a34a',
        accentSoft: 'rgba(22, 163, 74, .12)',
        accentLine: 'rgba(22, 163, 74, .72)',
        title: '#14532d',
        text: '#166534'
      }
      : {
        accent: '#dc2626',
        accentSoft: 'rgba(220, 38, 38, .12)',
        accentLine: 'rgba(220, 38, 38, .72)',
        title: '#7f1d1d',
        text: '#991b1b'
      };

    const toast = document.createElement('div');
    toast.id = id;
    toast.style.cssText = [
      'position: fixed;',
      'top: 18px;',
      'right: 18px;',
      'z-index: 2147483647;',
      'width: min(292px, calc(100vw - 36px));',
      'box-sizing: border-box;',
      'overflow: hidden;',
      'padding: 12px 13px 12px 12px;',
      'border-radius: 15px;',
      'font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;',
      'font-size: 13px;',
      'line-height: 1.4;',
      'background: linear-gradient(135deg, rgba(255,255,255,.98), rgba(248,250,252,.94));',
      'border: 1px solid rgba(226, 232, 240, .96);',
      'box-shadow: 0 14px 34px rgba(15, 23, 42, .16), 0 2px 8px rgba(15, 23, 42, .07);',
      'backdrop-filter: blur(14px);',
      '-webkit-backdrop-filter: blur(14px);',
      'pointer-events: auto;',
      'animation: mpCaptchaToastIn .28s cubic-bezier(.2, .8, .2, 1) forwards;',
      'will-change: transform, opacity, filter;'
    ].join('');

    // ---- 使用 DOM API 构建（代替 innerHTML） ----
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:flex-start;gap:10px;';

    // 左侧图标
    const iconWrap = document.createElement('div');
    iconWrap.style.cssText = `display:flex;align-items:center;justify-content:center;flex-shrink:0;width:32px;height:32px;border-radius:11px;background:${colors.accentSoft};box-shadow: inset 0 0 0 1px ${colors.accentLine};`;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    svg.style.cssText = `display:block;fill:${colors.accent};`;

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', type === 'success'
      ? 'M12 2C6.5 2 2 6.5 2 12S6.5 22 12 22 22 17.5 22 12 17.5 2 12 2M10 17L5 12L6.41 10.59L10 14.17L17.59 6.58L19 8L10 17Z'
      : 'M12,2C17.53,2 22,6.47 22,12C22,17.53 17.53,22 12,22C6.47,22 2,17.53 2,12C2,6.47 6.47,2 12,2M15.59,7L12,10.59L8.41,7L7,8.41L10.59,12L7,15.59L8.41,17L12,13.41L15.59,17L17,15.59L13.41,12L17,8.41L15.59,7Z'
    );
    svg.appendChild(path);
    iconWrap.appendChild(svg);

    // 右侧文本
    const textWrap = document.createElement('div');
    textWrap.style.cssText = 'min-width:0;flex:1;padding-top:0;';

    // 标签行
    const tagRow = document.createElement('div');
    tagRow.style.cssText = 'display:flex;align-items:center;gap:5px;margin-bottom:3px;';

    const brandTag = document.createElement('span');
    brandTag.style.cssText = 'display:inline-flex;align-items:center;height:17px;padding:0 6px;border-radius:999px;background:rgba(15,23,42,.06);color:#475569;font-size:10px;font-weight:700;letter-spacing:.04em;line-height:17px;white-space:nowrap;';
    brandTag.textContent = 'MoviePilot';

    const subTag = document.createElement('span');
    subTag.style.cssText = 'color:#94a3b8;font-size:11px;font-weight:600;white-space:nowrap;';
    subTag.textContent = '验证码助手';

    tagRow.appendChild(brandTag);
    tagRow.appendChild(subTag);

    // 标题
    const titleEl = document.createElement('div');
    titleEl.style.cssText = `font-size:13px;font-weight:700;letter-spacing:.01em;color:${colors.title};margin-bottom:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;`;
    titleEl.textContent = title;

    textWrap.appendChild(tagRow);
    textWrap.appendChild(titleEl);

    if (message) {
      const msgEl = document.createElement('div');
      msgEl.style.cssText = `font-size:12px;color:${colors.text};opacity:.88;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;`;
      msgEl.textContent = message;
      textWrap.appendChild(msgEl);
    }

    row.appendChild(iconWrap);
    row.appendChild(textWrap);
    toast.appendChild(row);

    // 底部进度条
    const progressBar = document.createElement('div');
    progressBar.style.cssText = `position:absolute;left:0;right:0;bottom:0;height:3px;background:${colors.accentSoft};`;

    const progressFill = document.createElement('div');
    progressFill.style.cssText = `width:100%;height:100%;transform-origin:left center;background:linear-gradient(90deg, ${colors.accent}, ${colors.accentLine});animation: mpCaptchaToastProgress 3.2s linear forwards;`;
    progressBar.appendChild(progressFill);
    toast.appendChild(progressBar);

    document.body.appendChild(toast);

    // 3秒后自动消失
    setTimeout(() => {
      toast.style.animation = 'mpCaptchaToastOut .24s ease forwards';
      setTimeout(() => toast.remove(), 260);
    }, 3500);
  }

  // ========== 填充验证码输入框 ==========
  function fillCaptchaInput(inputSelector: string, captchaCode: string): boolean {
    try {
      const input = document.querySelector(inputSelector) as HTMLInputElement | null;
      if (!input) {
        log(`未找到输入框: ${inputSelector}`);
        return false;
      }

      setInputValue(input, captchaCode);

      log('验证码已填充:', captchaCode);

      return true;
    } catch (error) {
      log('填充验证码失败:', error);
      return false;
    }
  }

  function resetCaptchaFilledIfTargetGone(): void {
    if (!captchaFilled) return;
    const lastInput = lastCaptchaInputSelector
      ? document.querySelector(lastCaptchaInputSelector) as HTMLInputElement | null
      : null;

    if (!lastInput || !isVisibleInput(lastInput)) {
      captchaFilled = false;
      lastCaptchaImageSrc = '';
      lastCaptchaInputSelector = '';
      log('上次验证码输入框已消失，重置识别状态');
      return;
    }

    const currentImage = (Array.from(document.querySelectorAll('img')) as HTMLImageElement[])
      .filter(isLikelyCaptchaImage)[0];
    const currentImageSrc = currentImage?.src || currentImage?.getAttribute('data-src') || '';

    if (currentImageSrc && lastCaptchaImageSrc && currentImageSrc !== lastCaptchaImageSrc && !lastInput.value.trim()) {
      captchaFilled = false;
      lastCaptchaImageSrc = '';
      lastCaptchaInputSelector = '';
      log('检测到新的验证码图片，重置识别状态');
    }
  }

  // ========== 主处理流程 ==========
  async function processCaptcha(): Promise<boolean> {
    try {
      if (captchaFilled) return false;
      if (isProcessing) return false;
      const config = await getConfig();
      if (!config.captchaAutoFillEnabled) return false;

      log('当前配置:', JSON.stringify(config));

      isProcessing = true;
      log('开始处理验证码');

      const elements = await detectCaptchaElements();
      if (!elements) { isProcessing = false; return false; }

      const { imageSelector, inputSelector } = elements;
      const imageElement = document.querySelector(imageSelector) as HTMLImageElement | null;
      if (!imageElement) { isProcessing = false; return false; }

      const imageSrc = imageElement.src ||
        imageElement.getAttribute('data-src') ||
        imageElement.style.backgroundImage?.match(/url\("?([^"]*)"?\)/)?.[1];

      if (!imageSrc) {
        log('无法获取验证码图片源');
        isProcessing = false;
        return false;
      }

      log('验证码图片:', imageSrc.substring(0, 80));

      let base64Img: string;
      if (config.captchaOfflineOcrEnabled) {
        try {
          base64Img = await imageSourceToBase64(imageSrc);
          log('已读取验证码原始图片 Base64');
        } catch (error) {
          log('读取验证码原始图片失败，回退到页面截图:', error);
          base64Img = await imageToBase64(imageElement, imageSrc, false);
        }
      } else {
        base64Img = await imageToBase64(imageElement, imageSrc, true);
      }
      log('图片已转 Base64');

      const result = await recognizeCaptcha(base64Img, config.captchaAiAssistEnabled, config.captchaOfflineOcrEnabled);

      if (!result.success || !result.code) {
        log('识别失败:', result.error);
        showToast('识别失败', result.error || '未能识别验证码', 'error');
        isProcessing = false;
        return false;
      }

      log('识别成功:', result.code, 'provider:', result.provider);

      let toastTitle: string;
      const provider = result.provider || 'ocr';
      if (provider === 'ai_ocr_match') {
        toastTitle = `验证码【${result.code}】已填充 · AI+OCR 一致`;
      } else if (provider === 'ai_preferred') {
        toastTitle = `验证码【${result.code}】已填充 · AI 优先`;
      } else if (provider === 'ai') {
        toastTitle = `验证码【${result.code}】已填充 · AI 识别`;
      } else if (provider === 'offline') {
        toastTitle = `验证码【${result.code}】已填充 · 离线 OCR`;
      } else {
        toastTitle = `验证码【${result.code}】已填充`;
      }

      // 有不一致时展示 OCR 结果
      const toastMsg = (provider === 'ai_preferred' && result.ocrCode)
        ? `OCR 结果: ${result.ocrCode}`
        : '';

      if (fillCaptchaInput(inputSelector, result.code)) {
        showToast(toastTitle, toastMsg, 'success');
        captchaFilled = true;
        lastCaptchaImageSrc = imageSrc;
        lastCaptchaInputSelector = inputSelector;
        isProcessing = false;
        return true;
      }

      isProcessing = false;
      return false;
    } catch (error) {
      log('处理流程失败:', error);
      isProcessing = false;
      return false;
    }
  }

  // ========== 初始化和监听 ==========
  async function init() {
    const config = await getConfig();
    if (!config.captchaAutoFillEnabled && !config.totpAutoFillEnabled) {
      log('自动填充功能未开启，不执行');
      return;
    }

    const isLogin = isLoginPage();
    if (!isLogin && !config.totpAutoFillEnabled) {
      log('当前页面不是登录页面，不执行');
      return;
    }

    log('页面已检测，准备执行自动填充', { isLogin, captcha: config.captchaAutoFillEnabled, totp: config.totpAutoFillEnabled });

    if (config.totpAutoFillEnabled) {
      setupTotpFocusListener();
      setupTotpUrlChangeListener();
      startTotpAutoFill();
      const retryAfterLoad = () => {
        if (totpFilled || totpLoadCompleteRetried || totpFillTimer || totpAttemptCount > 0) return;
        totpLoadCompleteRetried = true;
        setTimeout(() => attemptTotpAutoFill(), 2000);
      };
      if (document.readyState === 'complete') {
        setTimeout(retryAfterLoad, 1000);
      } else {
        window.addEventListener('load', retryAfterLoad, { once: true });
      }
    }

    const run = () => setTimeout(() => {
      if (config.captchaAutoFillEnabled) processCaptcha();
    }, 500);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', run);
    } else {
      run();
    }

    let debounceTimer: ReturnType<typeof setTimeout>;
    new MutationObserver((mutations) => {
      // 忽略由自身 toast（插入/移除）触发的 DOM 变化，避免识别失败时无限循环
      if (mutations.some(m =>
        Array.from(m.addedNodes).some(n =>
          n instanceof HTMLElement && n.id === 'mp-captcha-toast'
        ) ||
        Array.from(m.removedNodes).some(n =>
          n instanceof HTMLElement && n.id === 'mp-captcha-toast'
        )
      )) return;

      resetCaptchaFilledIfTargetGone();
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        resetCaptchaFilledIfTargetGone();
        if (!captchaFilled && config.captchaAutoFillEnabled) processCaptcha();
      }, 250);
    }).observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  init();
})();

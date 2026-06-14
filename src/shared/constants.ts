/**
 * 存储键常量定义
 *
 * 命名约定：
 * - `mp.` 前缀：扩展核心配置（认证、加密等）
 * - `totp.` 前缀：TOTP 相关数据
 *
 * 安全注意：
 * - TOKEN, BASE_URL, CREDS, CRYPTO_KEY, PIN_SECURITY, API_TOKEN, PT_BACKUP_KEY 为敏感键
 * - 敏感数据统一使用 chrome.storage.local（非 sync），避免跨设备泄露
 * - CREDS 使用 AES-GCM 加密存储（密钥通过 PBKDF2 派生）
 */
export const STORAGE_KEYS = {
  BASE_URL: 'mp.base_url',
  TOKEN: 'mp.token',
  CRYPTO_KEY: 'mp.crypto_key',         // 已弃用：密钥现通过 PBKDF2 派生，不再单独存储
  CREDS: 'mp.encrypted_credentials',
  PENDING_ROUTE: 'mp.pending_route',
  PT_DOWNLOAD_INFO: 'mp.pt_download_info',
  ALLOWED_DOMAINS: 'mp.allowed_domains',
  ALLOWED_DOMAINS_UPDATED_AT: 'mp.allowed_domains_updated_at',
  PIN_SECURITY: 'mp.pin_security',
  PIN_UNLOCKED_AT: 'mp.pin_unlocked_at',
  COOKIE_UA_AUTO_UPDATE: 'mp.cookie_ua_auto_update',
  COOKIE_UA_LAST_DAILY_UPDATE: 'mp.cookie_ua_last_daily_update',
  SITE_AUTO_OPEN: 'mp.site_auto_open',
  SITE_AUTO_OPEN_LAST_MONTH: 'mp.site_auto_open_last_month',
  SITE_AUTO_OPEN_TABS: 'mp.site_auto_open_tabs',
  WEB_EMBED_FEATURES: 'mp.web_embed_features',
  API_TOKEN: 'mp.api_token',
  OCR_HOST: 'mp.ocr_host',
  PT_ENCRYPTED_CREDENTIALS: 'mp.encrypted_pt_credentials',
  PT_CREDS_CONFIG: 'mp.pt_creds_config',
  PT_BACKUP_KEY: 'mp.pt_backup_key',
  CUSTOM_BG_CONFIG: 'mp.custom_bg_config',
  CUSTOM_BG_IMAGE: 'mp.custom_bg_image',
  SITE_BLACKLIST: 'mp.site_blacklist'
} as const;

/**
 * TOTP 相关存储键
 */
export const TOTP_STORAGE_KEYS = {
  SITES: 'totp.sites'
} as const;

// ============================================================
// 共享工具函数统一导出入口
// 集中重新导出所有工具模块，方便外部引用
// ============================================================

// 存储相关
export { getToken, getBaseUrl, setAuthData, clearAuthData } from './storage';

// API 相关
export { createConfiguredClient, apiCall } from './api';

// 格式化相关
export { 
  formatSize, formatBonus, formatJoinDate, formatRatio, 
  formatPercentage, getNumber, extractTitleFromUrl, generateTorrentTitle 
} from './format';

// 站点相关
export { 
  isApiSite, hasBrowserCookie, getStatusType, getStatusText, 
  getConnectionStatusText, getBrowserCookies, hasCookieDiff, hasUADiff 
} from './site';

// TOTP 相关
export { 
  base32Decode, generateTOTP, verifyTOTP, generateTOTPQRData, 
  parseQRScanResult, generateRandomSecret, validateSecret, 
  formatSecret, getTOTPRemainingTime, getTOTPProgress,
  generateAllCodes, calculateRemainingTime, calculateProgress, parseQRCode
} from './totp';

// Vue 组合式函数
export { useStorage } from './useStorage';

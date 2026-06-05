// TOTP相关类型定义
export interface TOTPSite {
  id: string;
  name: string;
  secret: string;
  url?: string;
  createdAt: string;
  updatedAt: string;
  icon?: string;
  color?: string;
}

export interface TOTPCode {
  siteId: string;
  code: string;
  remainingTime: number;
  progress: number;
}

export interface TOTPConfig {
  sites: TOTPSite[];
  settings: {
    refreshInterval: number; // 刷新间隔（毫秒）
    codeLength: number; // 验证码长度
    timeStep: number; // 时间步长（秒）
  };
}

// 二维码扫描结果
export interface QRScanResult {
  secret: string;
  issuer?: string;
  account?: string;
  algorithm?: string;
  digits?: number;
  period?: number;
}

// 导入导出格式
export interface TOTPExportData {
  version: string;
  sites: Omit<TOTPSite, 'id' | 'createdAt' | 'updatedAt'>[];
  exportedAt: string;
}

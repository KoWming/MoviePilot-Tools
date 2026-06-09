// ============================================================
// TOTP 存储服务
// 加密存储 TOTP 站点配置，支持 CRUD、导入/导出
// ============================================================

import type { TOTPSite, TOTPConfig, TOTPExportData } from '../types/totp';
import { TOTP_STORAGE_KEYS } from '../constants';
import { encryptObject, decryptObject } from '../secureStorage';

/**
 * TOTP存储管理服务
 * 站点数据（含 secret）使用 AES-GCM 加密存储
 */

interface EncryptedTOTPConfig {
  /** encrypted payload (base64 JSON) */
  payload: string;
  /** PBKDF2 salt + AES-GCM iv (base64) */
  salt: string;
  iv: string;
}

/**
 * 加密 TOTP 配置并存储
 */
async function encryptAndSave(config: TOTPConfig): Promise<void> {
  const enc = await encryptObject(config);
  const payload: EncryptedTOTPConfig = {
    payload: enc.ciphertext,
    salt: enc.salt,
    iv: enc.iv
  };
  await chrome.storage.local.set({
    [TOTP_STORAGE_KEYS.SITES]: payload
  });
}

/**
 * 从存储中解密 TOTP 配置
 */
async function decryptFromStorage(raw: unknown): Promise<TOTPConfig | null> {
  if (!raw || typeof raw !== 'object') return null;
  const enc = raw as EncryptedTOTPConfig;
  if (!enc.payload || !enc.salt || !enc.iv) {
    // 兼容旧格式：可能是未加密的明文对象
    const legacy = raw as TOTPConfig;
    if (Array.isArray(legacy.sites)) return legacy;
    return null;
  }
  try {
    return await decryptObject<TOTPConfig>({
      ciphertext: enc.payload,
      salt: enc.salt,
      iv: enc.iv
    });
  } catch {
    console.error('[TOTP] 解密 TOTP 数据失败，数据可能已损坏');
    return null;
  }
}
export class TOTPStorageService {
  /**
   * 获取TOTP配置
   */
  static async getConfig(): Promise<TOTPConfig> {
    try {
      const result = await chrome.storage.local.get(TOTP_STORAGE_KEYS.SITES);
      const raw = result[TOTP_STORAGE_KEYS.SITES];
      if (!raw) {
        return {
          sites: [],
          settings: {
            refreshInterval: 1000,
            codeLength: 6,
            timeStep: 30
          }
        };
      }
      
      const config = await decryptFromStorage(raw);
      return config || {
        sites: [],
        settings: {
          refreshInterval: 1000,
          codeLength: 6,
          timeStep: 30
        }
      };
    } catch (error) {
      console.error('获取TOTP配置失败:', error);
      throw error;
    }
  }

  /**
   * 保存TOTP配置
   */
  static async saveConfig(config: TOTPConfig): Promise<void> {
    try {
      await encryptAndSave(config);
    } catch (error) {
      console.error('保存TOTP配置失败:', error);
      throw error;
    }
  }

  /**
   * 添加站点
   */
  static async addSite(site: Omit<TOTPSite, 'id' | 'createdAt' | 'updatedAt'>): Promise<void> {
    const config = await this.getConfig();
    const now = new Date().toISOString();
    
    const newSite: TOTPSite = {
      ...site,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now
    };
    
    config.sites.push(newSite);
    await this.saveConfig(config);
  }

  /**
   * 更新站点
   */
  static async updateSite(siteId: string, updates: Partial<Omit<TOTPSite, 'id' | 'createdAt'>>): Promise<void> {
    const config = await this.getConfig();
    const siteIndex = config.sites.findIndex((s: TOTPSite) => s.id === siteId);
    
    if (siteIndex === -1) {
      throw new Error('站点不存在');
    }
    
    config.sites[siteIndex] = {
      ...config.sites[siteIndex],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    await this.saveConfig(config);
  }

  /**
   * 删除站点
   */
  static async deleteSite(siteId: string): Promise<void> {
    const config = await this.getConfig();
    config.sites = config.sites.filter((s: TOTPSite) => s.id !== siteId);
    await this.saveConfig(config);
  }

  /**
   * 获取站点
   */
  static async getSite(siteId: string): Promise<TOTPSite | null> {
    const config = await this.getConfig();
    return config.sites.find((s: TOTPSite) => s.id === siteId) || null;
  }

  /**
   * 获取所有站点
   */
  static async getAllSites(): Promise<TOTPSite[]> {
    const config = await this.getConfig();
    return config.sites;
  }

  /**
   * 导出配置
   */
  static async exportConfig(): Promise<TOTPExportData> {
    const config = await this.getConfig();
    return {
      version: '1.0.0',
      sites: config.sites.map((site: TOTPSite) => ({
        name: site.name,
        secret: site.secret,
        url: site.url,
        icon: site.icon,
        color: site.color
      })),
      exportedAt: new Date().toISOString()
    };
  }

  /**
   * 导入配置
   */
  static async importConfig(data: TOTPExportData): Promise<void> {
    const config = await this.getConfig();
    const now = new Date().toISOString();
    
    const importedSites: TOTPSite[] = data.sites.map((site: any) => ({
      ...site,
      id: this.generateId(),
      createdAt: now,
      updatedAt: now
    }));
    
    // 合并现有站点和新导入的站点（避免重复）
    const existingNames = new Set(config.sites.map((s: TOTPSite) => s.name));
    const newSites = importedSites.filter(s => !existingNames.has(s.name));
    
    config.sites.push(...newSites);
    await this.saveConfig(config);
  }

  /**
   * 清空所有数据
   */
  static async clearAll(): Promise<void> {
    await chrome.storage.local.remove(TOTP_STORAGE_KEYS.SITES);
  }

  /**
   * 生成唯一ID
   */
  private static generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  /**
   * 监听配置变化
   */
  static onConfigChange(callback: (config: TOTPConfig) => void): () => void {
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes[TOTP_STORAGE_KEYS.SITES]) {
        callback(changes[TOTP_STORAGE_KEYS.SITES].newValue as TOTPConfig);
      }
    };
    
    chrome.storage.onChanged.addListener(listener);
    
    // 返回取消监听的函数
    return () => {
      chrome.storage.onChanged.removeListener(listener);
    };
  }
}

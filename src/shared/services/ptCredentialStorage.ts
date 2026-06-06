import { STORAGE_KEYS } from '../constants';
import { encryptObject, decryptObject, type EncryptedPayload } from '../secureStorage';

export interface PTCredential {
  id: string;
  domain: string;
  username: string;
  password: string;
  name?: string;
  createdAt: string;
  updatedAt: string;
  category?: 'pt' | 'custom';
}

export interface PTCredentialsConfig {
  autoSaveEnabled: boolean;
  autoFillEnabled: boolean;
}

export class PTCredentialStorageService {
  /**
   * 获取所有 PT 凭据（自动解密）
   */
  static async getCredentials(): Promise<PTCredential[]> {
    try {
      const result = await chrome.storage.local.get([STORAGE_KEYS.PT_ENCRYPTED_CREDENTIALS]);
      const raw = result[STORAGE_KEYS.PT_ENCRYPTED_CREDENTIALS] as EncryptedPayload | undefined;
      if (!raw) return [];
      const store = await decryptObject<{ credentials: PTCredential[] }>(raw);
      return store?.credentials || [];
    } catch (error) {
      console.error('[PT Creds] 获取凭据失败:', error);
      return [];
    }
  }

  /**
   * 保存所有 PT 凭据（自动加密）
   */
  static async saveCredentials(credentials: PTCredential[]): Promise<void> {
    try {
      const enc = await encryptObject({ credentials });
      await chrome.storage.local.set({ [STORAGE_KEYS.PT_ENCRYPTED_CREDENTIALS]: enc });
    } catch (error) {
      console.error('[PT Creds] 保存凭据失败:', error);
      throw error;
    }
  }

  /**
   * 获取单个站点的凭据
   */
  static async getCredentialByDomain(domain: string): Promise<PTCredential | null> {
    const creds = await this.getCredentials();
    const d = domain.toLowerCase().trim();
    return creds.find(c => c.domain.toLowerCase().trim() === d) || null;
  }

  /**
   * 添加或更新凭据
   */
  static async addOrUpdateCredential(domain: string, username: string, password: string, name?: string, category?: 'pt' | 'custom'): Promise<void> {
    const creds = await this.getCredentials();
    const d = domain.toLowerCase().trim();
    const index = creds.findIndex(c => c.domain.toLowerCase().trim() === d);
    const now = new Date().toISOString();

    if (index !== -1) {
      // 更新
      creds[index] = {
        ...creds[index],
        username,
        password,
        name: name || creds[index].name,
        category: category !== undefined ? category : creds[index].category,
        updatedAt: now
      };
    } else {
      // 新增
      creds.push({
        id: Math.random().toString(36).substring(2) + Date.now().toString(36),
        domain: d,
        username,
        password,
        name,
        category,
        createdAt: now,
        updatedAt: now
      });
    }
    await this.saveCredentials(creds);
  }

  /**
   * 删除凭据
   */
  static async deleteCredential(id: string): Promise<void> {
    const creds = await this.getCredentials();
    const filtered = creds.filter(c => c.id !== id);
    await this.saveCredentials(filtered);
  }

  /**
   * 获取配置项
   */
  static async getPtCredsConfig(): Promise<PTCredentialsConfig> {
    try {
      const result = await chrome.storage.local.get([STORAGE_KEYS.PT_CREDS_CONFIG]);
      const config = result[STORAGE_KEYS.PT_CREDS_CONFIG] as PTCredentialsConfig | undefined;
      return config || { autoSaveEnabled: true, autoFillEnabled: true };
    } catch {
      return { autoSaveEnabled: true, autoFillEnabled: true };
    }
  }

  /**
   * 保存配置项
   */
  static async savePtCredsConfig(config: PTCredentialsConfig): Promise<void> {
    try {
      await chrome.storage.local.set({ [STORAGE_KEYS.PT_CREDS_CONFIG]: config });
    } catch (error) {
      console.error('[PT Creds] 保存配置失败:', error);
      throw error;
    }
  }
}

// ============================================================
// 站点黑名单存储服务
// 管理禁止自动填充登录信息或验证码的站点列表
// ============================================================

import { STORAGE_KEYS } from '../constants';

export interface SiteBlacklistEntry {
  id: string;
  domain: string;
  name: string;
  blockLoginFill: boolean;
  blockCaptchaFill: boolean;
  createdAt: string;
  updatedAt: string;
}

export class SiteBlacklistService {
  /**
   * 获取所有黑名单条目
   */
  static async getAll(): Promise<SiteBlacklistEntry[]> {
    try {
      const data = await chrome.storage.local.get([STORAGE_KEYS.SITE_BLACKLIST]);
      const list = data[STORAGE_KEYS.SITE_BLACKLIST] as SiteBlacklistEntry[] | undefined;
      return Array.isArray(list) ? list : [];
    } catch {
      return [];
    }
  }

  /**
   * 保存所有黑名单条目
   */
  static async saveAll(entries: SiteBlacklistEntry[]): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEYS.SITE_BLACKLIST]: entries });
  }

  /**
   * 根据域名检查是否在黑名单中，并返回匹配的条目
   */
  static async getByDomain(domain: string): Promise<SiteBlacklistEntry | null> {
    const entries = await this.getAll();
    const d = domain.toLowerCase().trim().replace(/^www\./i, '');
    return entries.find(e => {
      const ed = e.domain.toLowerCase().trim().replace(/^www\./i, '');
      return ed === d || d.endsWith(`.${ed}`) || ed.endsWith(`.${d}`);
    }) || null;
  }

  /**
   * 检查指定域名是否阻止登录信息自动填充
   */
  static async isLoginFillBlocked(domain: string): Promise<boolean> {
    const entry = await this.getByDomain(domain);
    return entry ? entry.blockLoginFill : false;
  }

  /**
   * 检查指定域名是否阻止验证码自动填充
   */
  static async isCaptchaFillBlocked(domain: string): Promise<boolean> {
    const entry = await this.getByDomain(domain);
    return entry ? entry.blockCaptchaFill : false;
  }

  /**
   * 添加或更新黑名单条目
   */
  static async addOrUpdate(
    domain: string,
    name: string,
    blockLoginFill: boolean,
    blockCaptchaFill: boolean,
    existingId?: string
  ): Promise<void> {
    const entries = await this.getAll();
    const d = domain.toLowerCase().trim();
    const now = new Date().toISOString();

    if (existingId) {
      const idx = entries.findIndex(e => e.id === existingId);
      if (idx !== -1) {
        entries[idx] = {
          ...entries[idx],
          domain: d,
          name: name.trim(),
          blockLoginFill,
          blockCaptchaFill,
          updatedAt: now
        };
      }
    } else {
      // 检查是否已存在
      const existIdx = entries.findIndex(e => e.domain.toLowerCase().trim() === d);
      if (existIdx !== -1) {
        entries[existIdx] = {
          ...entries[existIdx],
          name: name.trim() || entries[existIdx].name,
          blockLoginFill,
          blockCaptchaFill,
          updatedAt: now
        };
      } else {
        entries.push({
          id: Math.random().toString(36).substring(2) + Date.now().toString(36),
          domain: d,
          name: name.trim(),
          blockLoginFill,
          blockCaptchaFill,
          createdAt: now,
          updatedAt: now
        });
      }
    }

    await this.saveAll(entries);
  }

  /**
   * 删除黑名单条目
   */
  static async delete(id: string): Promise<void> {
    const entries = await this.getAll();
    await this.saveAll(entries.filter(e => e.id !== id));
  }
}

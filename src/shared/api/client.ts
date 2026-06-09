// ============================================================
// MP API 客户端工厂
// 基于 Axios 的 HTTP 客户端，支持 Token 自动注入与静默刷新
// ============================================================

import axios, { AxiosError, AxiosInstance } from 'axios';
import { loginByPassword } from './auth';
import { loadCredentials } from '../secureStorage';
import { STORAGE_KEYS } from '../constants';

// 客户端配置选项
export interface MpApiClientOptions {
  baseURL: string;
  getToken: () => Promise<string | undefined>;
}

// ===== Token 静默刷新 =====

// 防止并发刷新（同一时间只允许一个刷新请求）
let refreshPromise: Promise<string | undefined> | null = null;

// 使用已保存的凭据静默刷新 Token
async function refreshTokenSilently(baseURL: string): Promise<string | undefined> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const creds = await loadCredentials();
      if (!creds || !creds.username || !creds.password) {
        return undefined;
      }
      try {
        const res = await loginByPassword({
          baseURL: creds.baseURL || baseURL,
          username: creds.username,
          password: creds.password,
          otp_password: creds.otp_password
        });
        const bearer = `Bearer ${res.access_token}`;
        await chrome.storage.local.set({
          [STORAGE_KEYS.TOKEN]: bearer,
          [STORAGE_KEYS.BASE_URL]: creds.baseURL || baseURL
        });
        return bearer;
      } catch {
        return undefined;
      } finally {
        refreshPromise = null; // 刷新完成后释放锁
      }
    })();
  }
  return refreshPromise;
}

// ===== 辅助函数 =====

// 判断 403 响应是否为 Token 过期
function isTokenInvalid403(error: AxiosError): boolean {
  const resp: any = error.response;
  if (!resp || resp.status !== 403) return false;
  const detail = (resp.data && (resp.data.detail || resp.data.message)) || '';
  const text = typeof detail === 'string' ? detail : JSON.stringify(detail || {});
  return /token/i.test(text) || /unauth/i.test(text) || /forbidden/i.test(text);
}

// ===== 创建 API 客户端 =====

export function createMpApiClient(options: MpApiClientOptions): AxiosInstance {
  const instance = axios.create({
    baseURL: options.baseURL,
    timeout: 15000
  });

  // 请求拦截器：自动注入 Authorization Token
  instance.interceptors.request.use(async (config) => {
    const token = await options.getToken();
    if (token) {
      config.headers = config.headers ?? {};
      (config.headers as Record<string, string>)['Authorization'] = token;
    }
    return config;
  });

  // 响应拦截器：401/403 Token 过期自动刷新重试
  instance.interceptors.response.use(
    (resp) => resp,
    async (error: AxiosError) => {
      const response = error.response;
      const original = error.config as any;
      const shouldRefresh = (response && response.status === 401) || isTokenInvalid403(error);
      if (shouldRefresh && original && !original.__mpRetried) {
        original.__mpRetried = true;
        try {
          const newToken = await refreshTokenSilently(options.baseURL);
          if (newToken) {
            original.headers = original.headers ?? {};
            original.headers['Authorization'] = newToken;
            return instance.request(original);
          }
        } catch {}
      }
      return Promise.reject(error);
    }
  );

  return instance;
}



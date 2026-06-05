import axios, { AxiosError, AxiosInstance } from 'axios';
import { loginByPassword } from './auth';
import { loadCredentials } from '../secureStorage';

export interface MpApiClientOptions {
  baseURL: string;
  getToken: () => Promise<string | undefined>;
}

let refreshPromise: Promise<string | undefined> | null = null;

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
        const bearer = `Bearer ${res.access_token}`; // 固定使用大写 Bearer
        await chrome.storage.local.set({ 'mp.token': bearer, 'mp.base_url': creds.baseURL || baseURL });
        return bearer;
      } catch {
        return undefined;
      } finally {
        // 允许后续再次刷新
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

function isTokenInvalid403(error: AxiosError): boolean {
  const resp: any = error.response;
  if (!resp || resp.status !== 403) return false;
  const detail = (resp.data && (resp.data.detail || resp.data.message)) || '';
  const text = typeof detail === 'string' ? detail : JSON.stringify(detail || {});
  return /token/i.test(text) || /unauth/i.test(text) || /forbidden/i.test(text);
}

export function createMpApiClient(options: MpApiClientOptions): AxiosInstance {
  const instance = axios.create({
    baseURL: options.baseURL,
    timeout: 15000
  });

  instance.interceptors.request.use(async (config) => {
    const token = await options.getToken();
    if (token) {
      config.headers = config.headers ?? {};
      (config.headers as Record<string, string>)['Authorization'] = token;
    }
    return config;
  });

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



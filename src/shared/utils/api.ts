// ============================================================
// API 工具函数
// 封装 MP API 客户端创建和通用请求调用
// ============================================================

import { createMpApiClient } from '../api/client';
import { getBaseUrl, getToken } from './storage';

/**
 * 创建配置好的 API 客户端（自动注入 Token 和 BaseURL）
 */
export async function createConfiguredClient() {
  const baseURL = await getBaseUrl();
  return createMpApiClient({ baseURL, getToken });
}

/**
 * 通用的 API 调用包装器，包含错误处理
 */
export async function apiCall<T>(
  apiFunction: (client: any) => Promise<T>,
  errorMessage = 'API 调用失败'
): Promise<T> {
  try {
    const client = await createConfiguredClient();
    return await apiFunction(client);
  } catch (error) {
    console.error(errorMessage, error);
    throw error;
  }
}

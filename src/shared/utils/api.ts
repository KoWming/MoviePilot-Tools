import { createMpApiClient } from '../api/client';
import { getBaseUrl, getToken } from './storage';

/**
 * 创建配置好的 API 客户端
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

import axios from 'axios';

export interface LoginResponse {
  access_token: string;
  token_type: string; // 'bearer'
  user_id?: number;
  user_name?: string;
  avatar?: string;
  super_user?: boolean;
}

export async function loginByPassword(params: {
  baseURL: string;
  username: string;
  password: string;
  otp_password?: string;
}): Promise<LoginResponse> {
  const { baseURL, username, password, otp_password } = params;
  const url = `${baseURL.replace(/\/$/, '')}/api/v1/login/access-token`;
  const body = new URLSearchParams();
  body.set('username', username);
  body.set('password', password);
  if (otp_password) body.set('otp_password', otp_password);
  // OAuth2PasswordRequestForm 需要 grant_type
  // FastAPI 的 OAuth2PasswordRequestForm 默认允许为空；如后端强校验可加：body.set('grant_type','password')
  const resp = await axios.post(url, body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 15000
  });
  return resp.data as LoginResponse;
}

// 这些函数已移动到 shared/utils/storage.ts
// 为了向后兼容，重新导出
export { getBaseUrl, getToken } from '../utils/storage';


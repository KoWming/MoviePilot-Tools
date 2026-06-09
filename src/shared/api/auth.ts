// ============================================================
// MP 登录认证 API
// 通过 OAuth2 密码表单登录获取 Bearer Token
// ============================================================

import axios from 'axios';

// 登录响应接口
export interface LoginResponse {
  access_token: string;
  token_type: string;
  user_id?: number;
  user_name?: string;
  avatar?: string;
  super_user?: boolean;
}

// 密码登录（OAuth2PasswordRequestForm 兼容）
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

  const resp = await axios.post(url, body, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 15000
  });
  return resp.data as LoginResponse;
}

// ===== 向后兼容导出 =====
// getBaseUrl / getToken 已迁移至 shared/utils/storage.ts
// 以下重新导出用于兼容外部引用（TOTPManager / SiteManagement / Settings）
export { getBaseUrl, getToken } from '../utils/storage';

// ============================================================
// TOTP 两步验证工具函数
// Base32 编解码、HMAC-SHA1、TOTP 码生成/验证、二维码解析
// ============================================================

import type { TOTPSite, TOTPCode, QRScanResult } from '../types/totp';

/**
 * Base32解码函数
 */
export function base32Decode(input: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const inputUpper = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
  
  let buffer = 0;
  let bufferSize = 0;
  const output: number[] = [];
  
  for (const char of inputUpper) {
    const pos = chars.indexOf(char);
    if (pos === -1) continue;
    
    buffer = (buffer << 5) | pos;
    bufferSize += 5;
    
    if (bufferSize >= 8) {
      bufferSize -= 8;
      output.push((buffer >> bufferSize) & 0xFF);
    }
  }
  
  return new Uint8Array(output);
}

/**
 * HMAC-SHA1实现
 */
async function hmacSha1(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key.buffer as ArrayBuffer,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, data.buffer as ArrayBuffer);
  return new Uint8Array(signature);
}

/**
 * 生成TOTP验证码
 */
export async function generateTOTP(secret: string, timestamp?: number): Promise<string> {
  const timeStep = 30;
  const digits = 6;
  
  const time = Math.floor((timestamp || Date.now()) / 1000 / timeStep);
  const key = base32Decode(secret);
  
  // 将时间转换为8字节大端序
  const timeBuffer = new ArrayBuffer(8);
  const timeView = new DataView(timeBuffer);
  timeView.setUint32(0, 0, false); // 高32位
  timeView.setUint32(4, time, false); // 低32位
  
  const hmac = await hmacSha1(key, new Uint8Array(timeBuffer));
  
  // 动态截断
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = ((hmac[offset] & 0x7f) << 24) |
               ((hmac[offset + 1] & 0xff) << 16) |
               ((hmac[offset + 2] & 0xff) << 8) |
               (hmac[offset + 3] & 0xff);
  
  const otp = code % Math.pow(10, digits);
  return otp.toString().padStart(digits, '0');
}

/**
 * 验证TOTP码
 */
export async function verifyTOTP(secret: string, code: string, window: number = 1): Promise<boolean> {
  const timestamp = Date.now();
  
  for (let i = -window; i <= window; i++) {
    const expectedCode = await generateTOTP(secret, timestamp + i * 30000);
    if (expectedCode === code) {
      return true;
    }
  }
  
  return false;
}

/**
 * 生成TOTP二维码数据
 */
export function generateTOTPQRData(site: TOTPSite): string {
  const issuer = 'MoviePilot';
  const accountName = site.name;
  const secret = site.secret;
  
  return `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(accountName)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}`;
}

/**
 * 解析二维码扫描结果
 */
export function parseQRScanResult(qrData: string): QRScanResult | null {
  try {
    const url = new URL(qrData);
    
    if (url.protocol !== 'otpauth:' || url.hostname !== 'totp') {
      return null;
    }
    
    const pathParts = url.pathname.split(':');
    const issuer = pathParts[0] || '';
    const accountName = pathParts[1] || '';
    
    const secret = url.searchParams.get('secret');
    if (!secret) {
      return null;
    }
    
    return {
      issuer,
      account: accountName,
      secret,
      algorithm: url.searchParams.get('algorithm') || 'SHA1',
      digits: parseInt(url.searchParams.get('digits') || '6'),
      period: parseInt(url.searchParams.get('period') || '30')
    };
  } catch {
    return null;
  }
}

/**
 * 生成随机密钥
 */
export function generateRandomSecret(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let result = '';
  
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  
  return result;
}

/**
 * 验证密钥格式
 */
export function validateSecret(secret: string): boolean {
  const cleanSecret = secret.replace(/\s/g, '').toUpperCase();
  const validChars = /^[A-Z2-7]+$/;
  
  return validChars.test(cleanSecret) && cleanSecret.length >= 16;
}

/**
 * 格式化密钥显示
 */
export function formatSecret(secret: string): string {
  const cleanSecret = secret.replace(/\s/g, '').toUpperCase();
  return cleanSecret.replace(/(.{4})/g, '$1 ').trim();
}

/**
 * 获取TOTP码的剩余时间
 */
export function getTOTPRemainingTime(): number {
  const timeStep = 30;
  const now = Math.floor(Date.now() / 1000);
  return timeStep - (now % timeStep);
}

/**
 * 获取TOTP码的进度百分比
 */
export function getTOTPProgress(): number {
  const timeStep = 30;
  const now = Math.floor(Date.now() / 1000);
  const remaining = timeStep - (now % timeStep);
  return ((timeStep - remaining) / timeStep) * 100;
}

/**
 * 生成所有站点的TOTP码
 */
export async function generateAllCodes(sites: TOTPSite[]): Promise<TOTPCode[]> {
  const codes: TOTPCode[] = [];
  
  for (const site of sites) {
    try {
      const code = await generateTOTP(site.secret);
      const remainingTime = getTOTPRemainingTime();
      const progress = getTOTPProgress();
      
      codes.push({
        siteId: site.id,
        code,
        remainingTime,
        progress
      });
    } catch (error) {
      console.error(`生成站点 ${site.name} 的TOTP码失败:`, error);
    }
  }
  
  return codes;
}

/**
 * 计算剩余时间（别名函数，保持向后兼容）
 */
export function calculateRemainingTime(): number {
  return getTOTPRemainingTime();
}

/**
 * 计算进度（别名函数，保持向后兼容）
 */
export function calculateProgress(): number {
  return getTOTPProgress();
}

/**
 * 解析二维码（别名函数，保持向后兼容）
 */
export function parseQRCode(qrData: string): QRScanResult | null {
  return parseQRScanResult(qrData);
}

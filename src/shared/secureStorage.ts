// 加密存储：使用 Web Crypto AES-GCM 加密/解密账号密码
// 密钥通过 PBKDF2 派生（基于扩展 ID + 随机盐），不再将 raw key 明文存储
// 注意：浏览器扩展环境隔离性较强，此实现用于降低明文暴露风险，但无法抵御拥有本机完全权限的攻击者。
//
// 向后兼容：v1 格式 { iv, ciphertext }（raw key 存于 mp.crypto_key）
//            v2 格式 { salt, iv, ciphertext }（PBKDF2 派生密钥）
// 升级时自动检测并迁移。

import { STORAGE_KEYS } from './constants';

export interface EncryptedPayload {
  salt: string;  // PBKDF2 salt (base64) — v2 才有
  iv: string;    // AES-GCM IV (base64)
  ciphertext: string; // AES-GCM ciphertext (base64)
  [key: string]: unknown;
}

/** v1 旧格式：无 salt，密钥从 mp.crypto_key 读取 */
interface LegacyPayload {
  iv: string;
  ciphertext: string;
  [key: string]: unknown;
}

export interface StoredCredentials {
  baseURL: string;
  username: string;
  password: string;
  otp_password?: string;
}

const PBKDF2_ITERATIONS = 600_000;
const KEY_LENGTH = 256; // bits

function toBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf as Uint8Array<ArrayBuffer>;
}

/**
 * 通过 PBKDF2 派生 AES-GCM 密钥
 * 输入材料 = 扩展 ID + 固定 pepper（硬编码在源码中，增加离线破解难度）
 * 注意：pepper 硬编码不为完美安全，但已显著优于原先的 raw key 同区域存储
 */
const KEY_PEPPER = new TextEncoder().encode('mp-ext-crypto-v2-2026');

async function deriveKey(salt: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  const extensionId = new TextEncoder().encode(chrome.runtime.id);
  // 组合扩展 ID + pepper 作为 PBKDF2 输入
  const combined = new Uint8Array(extensionId.length + KEY_PEPPER.length);
  combined.set(extensionId, 0);
  combined.set(KEY_PEPPER, extensionId.length);

  const baseKey = await crypto.subtle.importKey(
    'raw',
    combined,
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/** 生成随机盐并派生密钥，返回 { salt, key } */
async function createKeyWithSalt(): Promise<{ salt: Uint8Array<ArrayBuffer>; key: CryptoKey }> {
  const salt = crypto.getRandomValues(new Uint8Array(32)) as Uint8Array<ArrayBuffer>;
  const key = await deriveKey(salt);
  return { salt, key };
}

/**
 * 从已有 salt 恢复密钥（与 encryptObject 中使用的 salt 一致）
 */
async function getKeyFromSalt(saltB64: string): Promise<CryptoKey> {
  const salt = fromBase64(saltB64);
  return deriveKey(salt);
}

// ===== v1 兼容层：旧版 raw key 解密 =====

/**
 * 获取旧版 raw key（从 chrome.storage.local 的 mp.crypto_key 读取）
 * 仅用于向后兼容解密 v1 格式数据
 */
async function getLegacyKey(): Promise<CryptoKey | null> {
  try {
    const data = await chrome.storage.local.get([STORAGE_KEYS.CRYPTO_KEY]);
    const rawKeyB64 = data[STORAGE_KEYS.CRYPTO_KEY] as string | undefined;
    if (!rawKeyB64) return null;
    const raw = fromBase64(rawKeyB64);
    return crypto.subtle.importKey(
      'raw',
      raw,
      { name: 'AES-GCM' },
      false,
      ['decrypt']
    );
  } catch {
    return null;
  }
}

/**
 * 使用旧版 v1 格式解密（无 salt，密钥从 mp.crypto_key 读取）
 */
async function decryptLegacy<T = unknown>(payload: LegacyPayload): Promise<T> {
  const key = await getLegacyKey();
  if (!key) throw new Error('Legacy key not found');
  const iv = fromBase64(payload.iv as string);
  const ct = fromBase64(payload.ciphertext as string).buffer;
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  const text = new TextDecoder().decode(pt);
  return JSON.parse(text) as T;
}

/** 判断 payload 是否为 v1 旧格式 */
function isLegacyPayload(payload: Record<string, unknown>): payload is LegacyPayload {
  return !payload.salt && typeof payload.iv === 'string' && typeof payload.ciphertext === 'string';
}

export async function encryptObject<T extends object>(obj: T): Promise<EncryptedPayload> {
  const { salt, key } = await createKeyWithSalt();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = new TextEncoder().encode(JSON.stringify(obj));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return {
    salt: toBase64(salt.buffer as ArrayBuffer),
    iv: toBase64(iv.buffer as ArrayBuffer),
    ciphertext: toBase64(ct)
  };
}

export async function decryptObject<T = unknown>(payload: EncryptedPayload): Promise<T> {
  const key = await getKeyFromSalt(payload.salt);
  const iv = fromBase64(payload.iv);
  const ct = fromBase64(payload.ciphertext).buffer;
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
  const text = new TextDecoder().decode(pt);
  return JSON.parse(text) as T;
}

export async function saveCredentials(creds: StoredCredentials): Promise<void> {
  const enc = await encryptObject(creds);
  await chrome.storage.local.set({ [STORAGE_KEYS.CREDS]: enc });
}

export async function loadCredentials(): Promise<StoredCredentials | undefined> {
  const data = await chrome.storage.local.get([STORAGE_KEYS.CREDS]);
  const raw = data[STORAGE_KEYS.CREDS] as (EncryptedPayload | LegacyPayload) | undefined;
  if (!raw) return undefined;

  // v2 格式（新版 PBKDF2 密钥）
  if (!isLegacyPayload(raw)) {
    try {
      return await decryptObject<StoredCredentials>(raw);
    } catch {
      return undefined;
    }
  }

  // v1 兼容：旧版 raw key 格式
  try {
    const creds = await decryptLegacy<StoredCredentials>(raw);
    // 自动迁移到 v2 格式
    await saveCredentials(creds);
    // 清理旧版密钥（静默，失败不阻塞）
    try { await chrome.storage.local.remove([STORAGE_KEYS.CRYPTO_KEY]); } catch {}
    return creds;
  } catch {
    return undefined;
  }
}

export async function clearCredentials(): Promise<void> {
  await chrome.storage.local.remove([STORAGE_KEYS.CREDS]);
}

export async function encryptWebDavPassword(password: string): Promise<EncryptedPayload> {
  return encryptObject({ password });
}

export async function decryptWebDavPassword(storedPassword: unknown): Promise<string> {
  if (!storedPassword) return '';
  if (
    typeof storedPassword === 'object' &&
    storedPassword !== null &&
    'ciphertext' in storedPassword &&
    'salt' in storedPassword &&
    'iv' in storedPassword
  ) {
    try {
      const decrypted = await decryptObject<{ password: string }>(storedPassword as EncryptedPayload);
      return decrypted.password || '';
    } catch (err) {
      console.error('解密 WebDav 密码失败:', err);
      return '';
    }
  }
  if (typeof storedPassword === 'string') {
    return storedPassword;
  }
  return '';
}

export async function encryptApiToken(token: string): Promise<EncryptedPayload> {
  return encryptObject({ token });
}

export async function decryptApiToken(storedToken: unknown): Promise<string> {
  if (!storedToken) return '';
  if (
    typeof storedToken === 'object' &&
    storedToken !== null &&
    'ciphertext' in storedToken &&
    'salt' in storedToken &&
    'iv' in storedToken
  ) {
    try {
      const decrypted = await decryptObject<{ token: string }>(storedToken as EncryptedPayload);
      return decrypted.token || '';
    } catch (err) {
      console.error('解密 API Token 失败:', err);
      return '';
    }
  }
  if (typeof storedToken === 'string') {
    return storedToken;
  }
  return '';
}

export async function encryptWebDavUsername(username: string): Promise<EncryptedPayload> {
  return encryptObject({ username });
}

export async function decryptWebDavUsername(storedUsername: unknown): Promise<string> {
  if (!storedUsername) return '';
  if (
    typeof storedUsername === 'object' &&
    storedUsername !== null &&
    'ciphertext' in storedUsername &&
    'salt' in storedUsername &&
    'iv' in storedUsername
  ) {
    try {
      const decrypted = await decryptObject<{ username: string }>(storedUsername as EncryptedPayload);
      return decrypted.username || '';
    } catch (err) {
      console.error('解密 WebDav 账号失败:', err);
      return '';
    }
  }
  if (typeof storedUsername === 'string') {
    return storedUsername;
  }
  return '';
}

export async function encryptWebDavUrl(url: string): Promise<EncryptedPayload> {
  return encryptObject({ url });
}

export async function decryptWebDavUrl(storedUrl: unknown): Promise<string> {
  if (!storedUrl) return '';
  if (
    typeof storedUrl === 'object' &&
    storedUrl !== null &&
    'ciphertext' in storedUrl &&
    'salt' in storedUrl &&
    'iv' in storedUrl
  ) {
    try {
      const decrypted = await decryptObject<{ url: string }>(storedUrl as EncryptedPayload);
      return decrypted.url || '';
    } catch (err) {
      console.error('解密 WebDav 地址失败:', err);
      return '';
    }
  }
  if (typeof storedUrl === 'string') {
    return storedUrl;
  }
  return '';
}

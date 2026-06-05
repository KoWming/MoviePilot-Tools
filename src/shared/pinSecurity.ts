import { STORAGE_KEYS } from './constants';

export type PinVerifyFrequency = 'session' | 'always';

export interface PinSecurityConfig {
  enabled: boolean;
  salt?: string;
  hash?: string;
  updatedAt?: number;
  frequency?: PinVerifyFrequency;
}

const PIN_LENGTH = 6;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

const PBKDF2_ITERATIONS = 600_000;

/**
 * 使用 PBKDF2 进行密码哈希（抗暴力破解）
 * 输入格式：salt:pin，迭代次数 600k
 */
async function pbkdf2Hash(salt: string, pin: string): Promise<string> {
  const saltBytes = base64ToBytes(salt);
  const pinData = new TextEncoder().encode(pin);

  const baseKey = await crypto.subtle.importKey(
    'raw',
    pinData,
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    baseKey,
    256
  );

  return bytesToBase64(new Uint8Array(derivedBits));
}

function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}

export function getPinRuleText(): string {
  return `${PIN_LENGTH} 位数字`;
}

export async function getPinSecurityConfig(): Promise<PinSecurityConfig> {
  const data = await chrome.storage.local.get([STORAGE_KEYS.PIN_SECURITY]);
  const config = data[STORAGE_KEYS.PIN_SECURITY] as PinSecurityConfig | undefined;
  return config || { enabled: false };
}

export async function isPinSecurityEnabled(): Promise<boolean> {
  const config = await getPinSecurityConfig();
  return Boolean(config.enabled && config.salt && config.hash);
}

export function getPinVerifyFrequency(config: PinSecurityConfig): PinVerifyFrequency {
  return config.frequency === 'session' ? 'session' : 'always';
}

export async function updatePinVerifyFrequency(frequency: PinVerifyFrequency): Promise<void> {
  const config = await getPinSecurityConfig();
  if (!config.enabled || !config.salt || !config.hash) return;
  await chrome.storage.local.set({
    [STORAGE_KEYS.PIN_SECURITY]: {
      ...config,
      frequency,
      updatedAt: Date.now()
    } satisfies PinSecurityConfig
  });
  if (frequency === 'always') {
    await clearPinUnlockSession();
  }
}

export async function setPinSecurity(pin: string, frequency: PinVerifyFrequency = 'always'): Promise<void> {
  if (!isValidPin(pin)) {
    throw new Error(`PIN 必须是${getPinRuleText()}`);
  }
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const salt = bytesToBase64(saltBytes);
  const hash = await pbkdf2Hash(salt, pin);
  await chrome.storage.local.set({
    [STORAGE_KEYS.PIN_SECURITY]: {
      enabled: true,
      salt,
      hash,
      frequency,
      updatedAt: Date.now()
    } satisfies PinSecurityConfig
  });
  await clearPinUnlockSession();
}

export async function verifyPin(pin: string): Promise<boolean> {
  const config = await getPinSecurityConfig();
  if (!config.enabled || !config.salt || !config.hash) return false;
  if (!isValidPin(pin)) return false;
  const hash = await pbkdf2Hash(config.salt, pin);
  return hash === config.hash;
}

export async function disablePinSecurity(): Promise<void> {
  await chrome.storage.local.remove([STORAGE_KEYS.PIN_SECURITY]);
  await clearPinUnlockSession();
}

export async function clearPinUnlockSession(): Promise<void> {
  await chrome.storage.session?.remove?.([STORAGE_KEYS.PIN_UNLOCKED_AT]);
}

export async function markPinUnlockedForSession(): Promise<void> {
  await chrome.storage.session?.set?.({ [STORAGE_KEYS.PIN_UNLOCKED_AT]: Date.now() });
}

export async function isPinUnlockedForSession(): Promise<boolean> {
  const data = await chrome.storage.session?.get?.([STORAGE_KEYS.PIN_UNLOCKED_AT]);
  return typeof data?.[STORAGE_KEYS.PIN_UNLOCKED_AT] === 'number';
}

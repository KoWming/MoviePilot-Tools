import { encryptObject, decryptObject, type EncryptedPayload } from './secureStorage';
import { STORAGE_KEYS } from './constants';

export interface PtBackupEnvelope {
  type: 'pt-credentials-backup';
  version: 2;
  algorithm: 'AES-GCM';
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

export interface TotpBackupEnvelope {
  type: 'totp-backup';
  version: 2;
  algorithm: 'AES-GCM';
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: string;
  iv: string;
  ciphertext: string;
}

const PT_BACKUP_ITERATIONS = 600_000;
const PT_BACKUP_PEPPER = 'mp-ext-pt-backup-v1';

function toBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf;
}

function toArrayBuffer(view: Uint8Array): ArrayBuffer {
  return new Uint8Array(view).buffer as ArrayBuffer;
}

async function deriveBackupKey(password: string, salt: Uint8Array, iterations = PT_BACKUP_ITERATIONS): Promise<CryptoKey> {
  const material = new TextEncoder().encode(`${PT_BACKUP_PEPPER}:${password}`);
  const baseKey = await crypto.subtle.importKey('raw', material, 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: toArrayBuffer(salt), iterations, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptPtBackup<T extends object>(data: T, password: string): Promise<PtBackupEnvelope> {
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveBackupKey(password, salt);
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  return {
    type: 'pt-credentials-backup',
    version: 2,
    algorithm: 'AES-GCM',
    kdf: 'PBKDF2-SHA256',
    iterations: PT_BACKUP_ITERATIONS,
    salt: toBase64(salt.buffer as ArrayBuffer),
    iv: toBase64(iv.buffer as ArrayBuffer),
    ciphertext: toBase64(ciphertext)
  };
}

export async function encryptTotpBackup<T extends object>(data: T, password: string): Promise<TotpBackupEnvelope> {
  const encrypted = await encryptPtBackup(data, password);
  return {
    ...encrypted,
    type: 'totp-backup'
  };
}

export async function decryptPtBackup<T = unknown>(payload: PtBackupEnvelope, password: string): Promise<T> {
  const salt = fromBase64(payload.salt);
  const iv = fromBase64(payload.iv);
  const ct = fromBase64(payload.ciphertext);
  const key = await deriveBackupKey(password, salt, payload.iterations || PT_BACKUP_ITERATIONS);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: toArrayBuffer(iv) }, key, toArrayBuffer(ct));
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}

export async function decryptTotpBackup<T = unknown>(payload: TotpBackupEnvelope, password: string): Promise<T> {
  return decryptPtBackup<T>({ ...payload, type: 'pt-credentials-backup' }, password);
}

export function isPtBackupEnvelope(payload: unknown): payload is PtBackupEnvelope {
  return Boolean(
    payload &&
    typeof payload === 'object' &&
    (payload as PtBackupEnvelope).type === 'pt-credentials-backup' &&
    (payload as PtBackupEnvelope).version === 2 &&
    typeof (payload as PtBackupEnvelope).salt === 'string' &&
    typeof (payload as PtBackupEnvelope).iv === 'string' &&
    typeof (payload as PtBackupEnvelope).ciphertext === 'string'
  );
}

export function isTotpBackupEnvelope(payload: unknown): payload is TotpBackupEnvelope {
  return Boolean(
    payload &&
    typeof payload === 'object' &&
    (payload as TotpBackupEnvelope).type === 'totp-backup' &&
    (payload as TotpBackupEnvelope).version === 2 &&
    typeof (payload as TotpBackupEnvelope).salt === 'string' &&
    typeof (payload as TotpBackupEnvelope).iv === 'string' &&
    typeof (payload as TotpBackupEnvelope).ciphertext === 'string'
  );
}

export async function savePtBackupKey(key: string): Promise<void> {
  const encrypted = await encryptObject({ key });
  await chrome.storage.local.set({ [STORAGE_KEYS.PT_BACKUP_KEY]: encrypted });
}

export async function loadPtBackupKey(): Promise<string> {
  const data = await chrome.storage.local.get([STORAGE_KEYS.PT_BACKUP_KEY]);
  const raw = data[STORAGE_KEYS.PT_BACKUP_KEY] as EncryptedPayload | undefined;
  if (!raw) return '';
  try {
    const decrypted = await decryptObject<{ key: string }>(raw);
    return decrypted?.key || '';
  } catch {
    return '';
  }
}

export function generatePtBackupKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/**
 * Optional end-to-end encryption of the synced library (WebCrypto only).
 * AES-GCM 256, key derived from a passphrase with PBKDF2-SHA-256. GitHub only ever sees ciphertext.
 */

export const ENCRYPTED_FORMAT = 'threadshelf.encrypted';
const ITERATIONS = 310_000;

export class DecryptionError extends Error {}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

export function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

async function deriveKey(
  passphrase: string,
  salt: Uint8Array<ArrayBuffer>,
  iterations: number,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

interface Envelope {
  format: typeof ENCRYPTED_FORMAT;
  v: 1;
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string };
  cipher: 'AES-GCM';
  iv: string;
  data: string;
}

export function isEncrypted(text: string): boolean {
  return text.trimStart().startsWith('{') && text.includes(`"format":"${ENCRYPTED_FORMAT}"`);
}

export async function encryptText(text: string, passphrase: string): Promise<string> {
  if (!passphrase) throw new Error('Phrase secrète manquante.');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt, ITERATIONS);
  const data = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text)),
  );
  const env: Envelope = {
    format: ENCRYPTED_FORMAT,
    v: 1,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: ITERATIONS, salt: bytesToBase64(salt) },
    cipher: 'AES-GCM',
    iv: bytesToBase64(iv),
    data: bytesToBase64(data),
  };
  return JSON.stringify(env);
}

export async function decryptText(text: string, passphrase: string | undefined): Promise<string> {
  let env: Envelope;
  try {
    env = JSON.parse(text) as Envelope;
  } catch {
    throw new DecryptionError('Fichier chiffré illisible.');
  }
  if (
    env.format !== ENCRYPTED_FORMAT ||
    env.v !== 1 ||
    env.cipher !== 'AES-GCM' ||
    env.kdf?.name !== 'PBKDF2'
  ) {
    throw new DecryptionError('Format de chiffrement non reconnu.');
  }
  if (!passphrase)
    throw new DecryptionError(
      'La bibliothèque distante est chiffrée : saisissez la phrase secrète.',
    );
  const iterations = Math.min(Math.max(env.kdf.iterations, 100_000), 5_000_000);
  const key = await deriveKey(passphrase, base64ToBytes(env.kdf.salt), iterations);
  try {
    const plain = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(env.iv) },
      key,
      base64ToBytes(env.data),
    );
    return new TextDecoder().decode(plain);
  } catch {
    throw new DecryptionError('Phrase secrète incorrecte.');
  }
}

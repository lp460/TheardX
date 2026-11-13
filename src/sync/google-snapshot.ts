export const GOOGLE_SNAPSHOT_FORMAT = 'threadshelf.google.snapshot';
// Keep this wire-format marker local: the Node ESM Vercel function imports this
// decoder directly and must not pull in extension/browser-only module imports.
const ENCRYPTED_FORMAT = 'threadshelf.encrypted';
export type GoogleEncryptionMode = 'plain' | 'encrypted';

export interface GoogleSnapshotPayload {
  epoch: string;
  mode: GoogleEncryptionMode;
  root: boolean;
  data: string;
  legacy: boolean;
}

const uuid = /^[0-9a-f-]{36}$/;

/** Accept old ciphertext snapshots without changing or deleting them. */
export function decodeGoogleSnapshot(text: string): GoogleSnapshotPayload {
  let envelope: Record<string, unknown>;
  try {
    envelope = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error('Sauvegarde Google Drive illisible.');
  }
  if (envelope.format === ENCRYPTED_FORMAT && envelope.v === 1)
    return { epoch: 'legacy', mode: 'encrypted', root: false, data: text, legacy: true };
  if (
    envelope.format !== GOOGLE_SNAPSHOT_FORMAT ||
    envelope.v !== 2 ||
    typeof envelope.epoch !== 'string' ||
    !uuid.test(envelope.epoch) ||
    (envelope.mode !== 'plain' && envelope.mode !== 'encrypted') ||
    typeof envelope.root !== 'boolean' ||
    typeof envelope.data !== 'string'
  ) {
    throw new Error('Format de sauvegarde Google Drive inconnu.');
  }
  let inner: Record<string, unknown>;
  try {
    inner = JSON.parse(envelope.data) as Record<string, unknown>;
  } catch {
    throw new Error('Contenu de sauvegarde Google Drive invalide.');
  }
  const expected = envelope.mode === 'encrypted' ? ENCRYPTED_FORMAT : 'threadshelf.backup';
  if (inner.format !== expected || typeof inner !== 'object')
    throw new Error('Le contenu ne correspond pas au mode de protection annoncé.');
  if (envelope.mode === 'encrypted' && inner.v !== 1)
    throw new Error('Version de chiffrement Google Drive inconnue.');
  if (
    envelope.mode === 'plain' &&
    (typeof inner.version !== 'number' ||
      !Array.isArray((inner.data as { entries?: unknown } | undefined)?.entries))
  )
    throw new Error('Sauvegarde Google Drive non chiffrée invalide.');
  return {
    epoch: envelope.epoch,
    mode: envelope.mode,
    root: envelope.root,
    data: envelope.data,
    legacy: false,
  };
}

export function encodeGoogleSnapshot(value: Omit<GoogleSnapshotPayload, 'legacy'>): string {
  const text = JSON.stringify({
    format: GOOGLE_SNAPSHOT_FORMAT,
    v: 2,
    epoch: value.epoch,
    mode: value.mode,
    root: value.root,
    data: value.data,
  });
  decodeGoogleSnapshot(text);
  return text;
}

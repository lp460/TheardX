export interface GoogleSnapshot {
  id: string;
  name: string;
  createdTime?: string;
  size?: string;
}

export class GoogleSyncError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function googleApi(
  method: 'GET' | 'POST',
  url: string,
  body?: unknown,
): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      ...(body !== undefined
        ? {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }
        : {}),
    });
  } catch {
    throw new GoogleSyncError(
      'Connexion indisponible. Votre bibliothèque locale reste accessible.',
      0,
    );
  }
  const data = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok)
    throw new GoogleSyncError(
      typeof data.error === 'string' ? data.error : `Erreur Google Drive HTTP ${response.status}`,
      response.status,
    );
  return data;
}

export async function listGoogleSnapshots(): Promise<GoogleSnapshot[]> {
  const data = await googleApi('GET', '/api/google/sync');
  if (!Array.isArray(data.files)) throw new GoogleSyncError('Réponse Google Drive invalide.', 502);
  return data.files as GoogleSnapshot[];
}

export async function readGoogleSnapshot(fileId: string): Promise<string> {
  const data = await googleApi('GET', `/api/google/sync?file=${encodeURIComponent(fileId)}`);
  if (typeof data.text !== 'string') throw new GoogleSyncError('Sauvegarde Drive invalide.', 502);
  return data.text;
}

export async function writeGoogleSnapshot(
  deviceId: string,
  revisionId: string,
  text: string,
): Promise<void> {
  await googleApi('POST', '/api/google/sync', { deviceId, revisionId, text });
}

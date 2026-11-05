import {
  authorizeGoogle,
  createSnapshot,
  DriveError,
  listSnapshots,
  readSnapshot,
} from '../../server/google-drive.js';
import { json, readSession, sameOrigin, unauthorized } from '../../server/session.js';

export default {
  async fetch(request: Request): Promise<Response> {
    const session = readSession(request);
    if (!session) return unauthorized();
    if (session.provider !== 'google') return json({ error: 'Connectez-vous avec Google.' }, 403);
    if (!['GET', 'POST'].includes(request.method)) return json({ error: 'Méthode refusée' }, 405);
    if (request.method === 'POST' && !sameOrigin(request))
      return json({ error: 'Origine non autorisée' }, 403);
    try {
      const auth = await authorizeGoogle(request);
      if (!auth) return unauthorized();
      let response: Response;
      const url = new URL(request.url);
      if (request.method === 'GET' && url.searchParams.has('file')) {
        response = json({
          text: await readSnapshot(auth.session.token, url.searchParams.get('file')!),
        });
      } else if (request.method === 'GET') {
        response = json({ files: await listSnapshots(auth.session.token) });
      } else {
        let payload: Record<string, unknown>;
        try {
          payload = await request.json();
        } catch {
          return json({ error: 'JSON invalide.' }, 400);
        }
        if (
          typeof payload.deviceId !== 'string' ||
          typeof payload.revisionId !== 'string' ||
          typeof payload.text !== 'string'
        )
          return json({ error: 'Payload invalide.' }, 400);
        const file = await createSnapshot(auth.session.token, {
          deviceId: payload.deviceId,
          revisionId: payload.revisionId,
          text: payload.text,
        });
        response = json({ ok: true, file }, 201);
      }
      if (auth.refreshedCookie) response.headers.append('Set-Cookie', auth.refreshedCookie);
      return response;
    } catch (error) {
      return json(
        {
          error:
            error instanceof DriveError
              ? error.message
              : 'Google Drive momentanément indisponible.',
        },
        error instanceof DriveError ? error.status : 502,
      );
    }
  },
};

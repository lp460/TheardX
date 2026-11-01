import { json, readSession, sameOrigin, unauthorized, type WebSession } from '../server/session';

const API = 'https://api.github.com';
const FILE = 'threadshelf/library.json';

async function github(session: WebSession, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(API + path, {
    ...init,
    headers: {
      Authorization: `Bearer ${session.token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init.headers ?? {}),
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
    cache: 'no-store',
  });
}

export default {
  async fetch(request: Request): Promise<Response> {
    const session = readSession(request);
    if (!session) return unauthorized();
    if (request.method !== 'GET' && request.method !== 'PUT') return json({ error: 'Méthode refusée' }, 405);
    if (request.method === 'PUT' && !sameOrigin(request)) return json({ error: 'Origine non autorisée' }, 403);

    const repo = `${session.login}/threadshelf-data`;
    const metaResponse = await github(session, `/repos/${repo}`);
    if (!metaResponse.ok) return json({ error: metaResponse.status === 404
      ? 'Bibliothèque GitHub introuvable. Activez la synchronisation depuis l’extension ou importez une sauvegarde JSON.'
      : 'GitHub refuse l’accès à la bibliothèque.', }, metaResponse.status);
    const meta = await metaResponse.json() as { private: boolean; default_branch: string; full_name: string };
    if (!meta.private) return json({ error: 'Le dépôt de synchronisation doit être privé.' }, 403);
    const branch = meta.default_branch || 'main';
    if (new URL(request.url).searchParams.has('meta'))
      return json({ repo: { full_name: repo, private: true, default_branch: branch } });

    const path = `/repos/${repo}/contents/${FILE}?ref=${encodeURIComponent(branch)}`;
    if (request.method === 'GET') {
      const response = await github(session, path);
      if (response.status === 404) return json({ file: null });
      if (!response.ok) return json({ error: 'Lecture GitHub impossible.' }, response.status);
      const file = await response.json() as { sha: string; content?: string; encoding?: string };
      if (file.encoding === 'base64' && file.content)
        return json({ file: { text: Buffer.from(file.content.replace(/\s/g, ''), 'base64').toString('utf8'), version: file.sha } });
      const raw = await github(session, path, { headers: { Accept: 'application/vnd.github.raw+json' } });
      if (!raw.ok) return json({ error: 'Lecture GitHub impossible.' }, raw.status);
      return json({ file: { text: await raw.text(), version: file.sha } });
    }

    let body: { text?: unknown; version?: unknown };
    try { body = await request.json(); } catch { return json({ error: 'JSON invalide.' }, 400); }
    if (typeof body.text !== 'string' || body.text.length > 8 * 1024 * 1024 ||
      !(body.version === null || (typeof body.version === 'string' && /^[a-f0-9]{40}$/.test(body.version))))
      return json({ error: 'Payload invalide.' }, 400);
    const payload: Record<string, string> = {
      branch, message: 'ThreadShelf : synchronisation web',
      content: Buffer.from(body.text, 'utf8').toString('base64'),
    };
    if (body.version) payload.sha = body.version as string;
    const saved = await github(session, `/repos/${repo}/contents/${FILE}`, {
      method: 'PUT', body: JSON.stringify(payload),
    });
    if (saved.ok) return json({ ok: true });
    return json({ error: saved.status === 409 || saved.status === 422
      ? 'Conflit : fichier modifié sur GitHub.' : 'Écriture GitHub impossible.' }, saved.status);
  },
};

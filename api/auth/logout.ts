import { clearSessionCookie, json, sameOrigin } from '../../server/session';

export default {
  fetch(request: Request): Response {
    if (request.method !== 'POST') return json({ error: 'Méthode refusée' }, 405);
    if (!sameOrigin(request)) return json({ error: 'Origine non autorisée' }, 403);
    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        'Content-Type': 'application/json', 'Cache-Control': 'no-store',
        'Set-Cookie': clearSessionCookie(request),
      },
    });
  },
};

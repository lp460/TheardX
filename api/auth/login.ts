import { randomBytes } from 'node:crypto';
import { json, setStateCookie, webOrigin } from '../../server/session.js';

export default {
  fetch(request: Request): Response {
    if (request.method !== 'GET') return json({ error: 'Méthode refusée' }, 405);
    const clientId = process.env.GITHUB_WEB_CLIENT_ID;
    if (!clientId || !process.env.GITHUB_WEB_CLIENT_SECRET || !process.env.SESSION_SECRET)
      return json({ error: 'Connexion web GitHub non configurée sur Vercel.' }, 503);
    const origin = webOrigin(request);
    // OAuth state is stored in a host-only cookie. A preview/alias URL must
    // move to the canonical origin BEFORE setting it, otherwise GitHub comes
    // back to a different host and the state verification always fails.
    if (new URL(request.url).origin !== origin) {
      return new Response(null, { status: 302, headers: {
        Location: `${origin}/api/auth/login`,
        'Cache-Control': 'no-store',
      } });
    }
    const state = randomBytes(32).toString('base64url');
    const url = new URL('https://github.com/login/oauth/authorize');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', `${origin}/api/auth/callback`);
    url.searchParams.set('scope', 'repo');
    url.searchParams.set('state', state);
    return new Response(null, { status: 302, headers: {
      Location: url.href,
      'Set-Cookie': setStateCookie(request, state),
      'Cache-Control': 'no-store',
    } });
  },
};

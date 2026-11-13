import { createHash, randomBytes } from 'node:crypto';
import { json, setGooglePkceCookie, setStateCookie, webOrigin } from '../../../server/session.js';
import extensionToken from '../../../server/google-extension-token.js';

export default {
  fetch(request: Request): Response | Promise<Response> {
    // Reuse this serverless function for the extension's POST/OPTIONS OAuth
    // token bridge. Keep the existing GET sign-in flow unchanged.
    if (request.method === 'POST' || request.method === 'OPTIONS')
      return extensionToken.fetch(request);
    if (request.method !== 'GET') return json({ error: 'Méthode refusée' }, 405);
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId || !process.env.GOOGLE_CLIENT_SECRET || !process.env.SESSION_SECRET)
      return json(
        {
          error:
            'Connexion Google non configurée : GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET requis.',
        },
        503,
      );
    const origin = webOrigin(request);
    if (new URL(request.url).origin !== origin)
      return new Response(null, {
        status: 302,
        headers: {
          Location: `${origin}/api/auth/google/login`,
          'Cache-Control': 'no-store',
        },
      });

    const state = randomBytes(32).toString('base64url');
    const verifier = randomBytes(48).toString('base64url');
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', `${origin}/api/auth/google/callback`);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set(
      'scope',
      'openid email profile https://www.googleapis.com/auth/drive.file',
    );
    url.searchParams.set('access_type', 'offline');
    url.searchParams.set('prompt', 'consent'); // A refresh token is required; no server-side token database.
    url.searchParams.set('state', state);
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    const headers = new Headers({ Location: url.href, 'Cache-Control': 'no-store' });
    headers.append('Set-Cookie', setStateCookie(request, state));
    headers.append('Set-Cookie', setGooglePkceCookie(request, verifier));
    return new Response(null, { status: 302, headers });
  },
};

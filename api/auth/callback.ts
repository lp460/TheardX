import {
  clearStateCookie, matchesState, readStateCookie, setSessionCookie, webOrigin,
} from '../../server/session';

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== 'GET' || !matchesState(readStateCookie(request), url.searchParams.get('state')))
      return new Response('Autorisation GitHub invalide ou expirée.', { status: 400 });
    const code = url.searchParams.get('code');
    if (!code) return new Response('Connexion GitHub refusée.', { status: 400 });
    try {
      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: process.env.GITHUB_WEB_CLIENT_ID,
          client_secret: process.env.GITHUB_WEB_CLIENT_SECRET,
          code,
          redirect_uri: `${webOrigin(request)}/api/auth/callback`,
        }),
      });
      if (!tokenResponse.ok) throw new Error('Token exchange failed');
      const token = await tokenResponse.json() as Record<string, unknown>;
      if (typeof token.access_token !== 'string') throw new Error('No access token');
      const userResponse = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${token.access_token}`, Accept: 'application/vnd.github+json' },
      });
      if (!userResponse.ok) throw new Error('User lookup failed');
      const user = await userResponse.json() as { login?: string };
      if (!user.login || !/^[\w-]+$/.test(user.login)) throw new Error('Invalid GitHub user');
      const tokenExpires = typeof token.expires_in === 'number'
        ? Date.now() + token.expires_in * 1000 - 60_000
        : Date.now() + 7 * 24 * 60 * 60 * 1000;
      const headers = new Headers({ Location: `${webOrigin(request)}/`, 'Cache-Control': 'no-store' });
      headers.append('Set-Cookie', clearStateCookie(request));
      headers.append('Set-Cookie', setSessionCookie(request, {
        login: user.login, token: token.access_token, expiresAt: tokenExpires,
      }));
      return new Response(null, { status: 302, headers });
    } catch {
      return new Response('Connexion GitHub impossible. Vérifiez la configuration OAuth web.', {
        status: 502, headers: { 'Cache-Control': 'no-store' },
      });
    }
  },
};

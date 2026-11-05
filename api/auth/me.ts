import {
  clearSessionCookie,
  json,
  readSession,
  sameOrigin,
  unauthorized,
} from '../../server/session.js';

export default {
  fetch(request: Request): Response {
    // Vercel Hobby allows 12 functions. These two public API paths rewrite to
    // this handler, preserving their existing external URLs and behavior.
    const operation = new URL(request.url).searchParams.get('__theardx_auth');
    if (operation === 'providers') {
      if (request.method !== 'GET') return json({ error: 'Méthode refusée' }, 405);
      return json({
        github: !!(
          process.env.GITHUB_WEB_CLIENT_ID &&
          process.env.GITHUB_WEB_CLIENT_SECRET &&
          process.env.SESSION_SECRET
        ),
        google: !!(
          process.env.GOOGLE_CLIENT_ID &&
          process.env.GOOGLE_CLIENT_SECRET &&
          process.env.SESSION_SECRET
        ),
      });
    }
    if (operation === 'logout') {
      if (request.method !== 'POST') return json({ error: 'Méthode refusée' }, 405);
      if (!sameOrigin(request)) return json({ error: 'Origine non autorisée' }, 403);
      return new Response(JSON.stringify({ ok: true }), {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store',
          'Set-Cookie': clearSessionCookie(request),
        },
      });
    }
    if (request.method !== 'GET') return json({ error: 'Méthode refusée' }, 405);
    const session = readSession(request);
    return session
      ? json({
          login: session.login,
          ...(session.provider === 'google'
            ? { provider: 'google', accountId: `google:${session.subject}` }
            : { provider: 'github', accountId: `github:${session.login.toLowerCase()}` }),
        })
      : unauthorized();
  },
};

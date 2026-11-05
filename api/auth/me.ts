import { json, readSession, unauthorized } from '../../server/session.js';

export default {
  fetch(request: Request): Response {
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

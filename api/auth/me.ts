import { json, readSession, unauthorized } from '../../server/session';

export default {
  fetch(request: Request): Response {
    if (request.method !== 'GET') return json({ error: 'Méthode refusée' }, 405);
    const session = readSession(request);
    return session ? json({ login: session.login }) : unauthorized();
  },
};

import { json } from '../../server/session.js';

export default {
  fetch(request: Request): Response {
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
  },
};

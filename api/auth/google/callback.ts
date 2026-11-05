import {
  clearGooglePkceCookie,
  clearStateCookie,
  matchesState,
  readGooglePkceCookie,
  readStateCookie,
  setSessionCookie,
  webOrigin,
} from '../../../server/session.js';

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const verifier = readGooglePkceCookie(request);
    if (
      request.method !== 'GET' ||
      !matchesState(readStateCookie(request), url.searchParams.get('state')) ||
      !verifier ||
      !/^[A-Za-z0-9_-]{43,128}$/.test(verifier)
    )
      return new Response('Autorisation Google invalide ou expirée. Recommencez depuis TheardX.', {
        status: 400,
      });
    const code = url.searchParams.get('code');
    if (!code) return new Response('Connexion Google annulée.', { status: 400 });
    try {
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID || '',
          client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
          code,
          code_verifier: verifier,
          grant_type: 'authorization_code',
          redirect_uri: `${webOrigin(request)}/api/auth/google/callback`,
        }),
      });
      if (!tokenResponse.ok) throw new Error('Google token exchange failed');
      const tokens = (await tokenResponse.json()) as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
        scope?: string;
      };
      if (
        !tokens.access_token ||
        !tokens.refresh_token ||
        !tokens.scope?.split(' ').includes('https://www.googleapis.com/auth/drive.file')
      )
        throw new Error('Google Drive access and offline refresh are required');
      const identityResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
        cache: 'no-store',
      });
      if (!identityResponse.ok) throw new Error('Google identity lookup failed');
      const identity = (await identityResponse.json()) as {
        sub?: string;
        email?: string;
        email_verified?: boolean;
      };
      if (
        !identity.sub ||
        !/^\d{5,40}$/.test(identity.sub) ||
        !identity.email ||
        identity.email_verified !== true
      )
        throw new Error('Unverified Google identity');
      const headers = new Headers({
        Location: `${webOrigin(request)}/`,
        'Cache-Control': 'no-store',
      });
      headers.append('Set-Cookie', clearStateCookie(request));
      headers.append('Set-Cookie', clearGooglePkceCookie(request));
      headers.append(
        'Set-Cookie',
        setSessionCookie(request, {
          provider: 'google',
          subject: identity.sub,
          login: identity.email,
          token: tokens.access_token,
          refreshToken: tokens.refresh_token,
          accessExpiresAt: Date.now() + Math.max(60, tokens.expires_in ?? 3600) * 1000 - 60_000,
          expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
        }),
      );
      return new Response(null, { status: 302, headers });
    } catch {
      return new Response(
        'Connexion Google impossible. Vérifiez les identifiants OAuth, le consentement Drive et l’URL de retour.',
        {
          status: 502,
          headers: { 'Cache-Control': 'no-store' },
        },
      );
    }
  },
};

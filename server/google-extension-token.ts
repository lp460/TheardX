/**
 * Confidential-client token exchange for Arc / Brave browser extensions.
 *
 * The extension runs an authorization-code + PKCE flow using the public Google
 * WEB client ID. Only this Node function knows the corresponding client secret.
 * Chrome's existing native getAuthToken flow never calls this endpoint.
 */
import { EXTENSION_ID, GOOGLE_EXTENSION_REDIRECT_URI } from '../src/extension-identity.mjs';

const ALLOWED_ORIGIN = `chrome-extension://${EXTENSION_ID}`;
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const MAX_BODY_BYTES = 8192;

function headers(): Headers {
  return new Headers({
    'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    Vary: 'Origin',
    'X-Content-Type-Options': 'nosniff',
  });
}

function result(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: headers() });
}

type ExchangeInput = {
  grantType?: unknown;
  code?: unknown;
  codeVerifier?: unknown;
  refreshToken?: unknown;
};

export default {
  async fetch(request: Request): Promise<Response> {
    // Only the installed extension may invoke this browser-facing API.
    // Codes are additionally protected by Google's one-use exchange and PKCE.
    if (request.headers.get('origin') !== ALLOWED_ORIGIN)
      return new Response(null, { status: 403, headers: { 'Cache-Control': 'no-store' } });
    if (request.method === 'OPTIONS')
      return new Response(null, { status: 204, headers: headers() });
    if (request.method !== 'POST') return result({ error: 'Méthode refusée.' }, 405);
    if (
      !process.env.GOOGLE_CLIENT_ID ||
      !process.env.GOOGLE_CLIENT_SECRET ||
      !/^[\w-]+\.apps\.googleusercontent\.com$/.test(process.env.GOOGLE_CLIENT_ID)
    )
      return result({ error: 'Client OAuth Web non configuré.' }, 503);
    if (!request.headers.get('content-type')?.startsWith('application/json'))
      return result({ error: 'JSON requis.' }, 415);

    let input: ExchangeInput;
    try {
      const raw = await request.text();
      if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES)
        return result({ error: 'Requête trop volumineuse.' }, 413);
      input = JSON.parse(raw) as ExchangeInput;
      if (!input || typeof input !== 'object' || Array.isArray(input))
        return result({ error: 'Requête invalide.' }, 400);
    } catch {
      return result({ error: 'JSON invalide.' }, 400);
    }

    let params: URLSearchParams;
    if (
      input.grantType === 'authorization_code' &&
      typeof input.code === 'string' &&
      /^[\w./-]{10,2048}$/.test(input.code) &&
      typeof input.codeVerifier === 'string' &&
      /^[\w-]{43,128}$/.test(input.codeVerifier)
    ) {
      params = new URLSearchParams({
        grant_type: 'authorization_code',
        code: input.code,
        code_verifier: input.codeVerifier,
        redirect_uri: GOOGLE_EXTENSION_REDIRECT_URI,
      });
    } else if (
      input.grantType === 'refresh_token' &&
      typeof input.refreshToken === 'string' &&
      /^[\w./-]{10,2048}$/.test(input.refreshToken)
    ) {
      params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: input.refreshToken,
      });
    } else {
      return result({ error: 'Paramètres OAuth invalides.' }, 400);
    }

    params.set('client_id', process.env.GOOGLE_CLIENT_ID);
    params.set('client_secret', process.env.GOOGLE_CLIENT_SECRET);
    try {
      const exchange = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params,
        cache: 'no-store',
      });
      if (!exchange.ok)
        return result(
          { error: 'Google a refusé le code ou le renouvellement. Reconnectez-vous.' },
          exchange.status === 400 || exchange.status === 401 ? 401 : 502,
        );

      const tokens = (await exchange.json()) as {
        access_token?: string;
        refresh_token?: string;
        token_type?: string;
        expires_in?: number;
        scope?: string;
      };
      if (
        !tokens.access_token ||
        tokens.token_type?.toLowerCase() !== 'bearer' ||
        !Number.isFinite(tokens.expires_in) ||
        (tokens.expires_in ?? 0) <= 0 ||
        (tokens.scope &&
          !tokens.scope.split(' ').includes('https://www.googleapis.com/auth/drive.file')) ||
        (input.grantType === 'authorization_code' && !tokens.refresh_token)
      )
        return result({ error: 'Google n’a pas accordé les autorisations nécessaires.' }, 403);

      return result({
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? input.refreshToken,
        expiresAt: Date.now() + Math.max(60, tokens.expires_in ?? 3600) * 1000 - 60_000,
      });
    } catch {
      return result({ error: 'Service Google momentanément indisponible.' }, 502);
    }
  },
};

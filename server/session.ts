import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const SESSION_COOKIE = '__Host-theardx-session';
const STATE_COOKIE = '__Host-theardx-oauth-state';
const SESSION_TTL = 7 * 24 * 60 * 60;

export interface WebSession {
  login: string;
  token: string;
  expiresAt: number;
}

export function webOrigin(request: Request): string {
  return process.env.WEB_ORIGIN?.replace(/\/$/, '') || new URL(request.url).origin;
}

export function cookie(request: Request, name: string): string | undefined {
  return request.headers.get('cookie')?.split(';').map((x) => x.trim())
    .find((x) => x.startsWith(name + '='))?.slice(name.length + 1);
}

function cookieString(name: string, value: string, maxAge: number, request: Request): string {
  const secure = new URL(webOrigin(request)).protocol === 'https:' ? '; Secure' : '';
  const actualName = secure ? name : name.replace('__Host-', '');
  return `${actualName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

function cookieName(name: string, request: Request): string {
  return new URL(webOrigin(request)).protocol === 'https:' ? name : name.replace('__Host-', '');
}

export function setStateCookie(request: Request, state: string): string {
  return cookieString(STATE_COOKIE, state, 600, request);
}

export function clearStateCookie(request: Request): string {
  return cookieString(STATE_COOKIE, '', 0, request);
}

export function readStateCookie(request: Request): string | undefined {
  return cookie(request, cookieName(STATE_COOKIE, request));
}

export function matchesState(expected: string | undefined, provided: string | null): boolean {
  if (!expected || !provided || expected.length !== provided.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(provided));
}

function secretKey(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error('SESSION_SECRET doit contenir 32 caractères minimum.');
  return createHash('sha256').update(secret).digest();
}

export function setSessionCookie(request: Request, session: WebSession): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', secretKey(), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(session), 'utf8'), cipher.final()]);
  const sealed = [iv, cipher.getAuthTag(), data].map((x) => x.toString('base64url')).join('.');
  return cookieString(SESSION_COOKIE, sealed, SESSION_TTL, request);
}

export function clearSessionCookie(request: Request): string {
  return cookieString(SESSION_COOKIE, '', 0, request);
}

export function readSession(request: Request): WebSession | null {
  try {
    const raw = cookie(request, cookieName(SESSION_COOKIE, request));
    if (!raw) return null;
    const parts = raw.split('.');
    if (parts.length !== 3 || parts.some((x) => !x)) return null;
    const [iv, tag, data] = parts.map((x) => Buffer.from(x!, 'base64url'));
    const decipher = createDecipheriv('aes-256-gcm', secretKey(), iv!);
    decipher.setAuthTag(tag!);
    const value = JSON.parse(Buffer.concat([decipher.update(data!), decipher.final()]).toString());
    if (typeof value.login !== 'string' || !/^[\w-]+$/.test(value.login) ||
      typeof value.token !== 'string' || typeof value.expiresAt !== 'number' ||
      value.expiresAt < Date.now()) return null;
    return value as WebSession;
  } catch {
    return null;
  }
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  return origin === webOrigin(request);
}

export function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
}

export function unauthorized(): Response {
  return json({ error: 'Connexion GitHub requise.' }, 401);
}

import { createHash, randomBytes } from 'node:crypto';
import { del, get, list, put } from '@vercel/blob';
import {
  json,
  readSession,
  sameOrigin,
  unauthorized,
  webOrigin,
  type WebSession,
} from '../server/session.js';
import { sharedSnapshot, type SharedSnapshot } from '../src/share/model.js';

const MAX_BODY_BYTES = 1_000_000;
const MAX_SHARES_PER_USER = 50;
const SHARE_ID = /^([a-f0-9]{20})\.([A-Za-z0-9_-]{24})$/;

type StoredShare = {
  owner: string;
  createdAt: number;
  expiresAt: number | null;
  snapshot: SharedSnapshot;
};

function ownerPrefix(login: string): string {
  return createHash('sha256').update(login.toLowerCase()).digest('hex').slice(0, 20);
}

function shareOwner(session: WebSession): string {
  // Preserve old GitHub share identifiers; Google identity survives email changes.
  return session.provider === 'google' ? `google:${session.subject}` : session.login;
}

function pathFor(id: string): string | null {
  const match = SHARE_ID.exec(id);
  return match ? `shares/v1/${match[1]}/${match[2]}.json` : null;
}

function storageConfigured(): boolean {
  return !!(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);
}

async function readStored(pathname: string): Promise<StoredShare | null> {
  const result = await get(pathname, { access: 'private', useCache: false });
  if (!result || result.statusCode !== 200) return null;
  const raw = await new Response(result.stream).text();
  if (raw.length > MAX_BODY_BYTES + 2_000) throw new Error('Unexpected share size');
  const stored = JSON.parse(raw) as StoredShare;
  if (
    !stored ||
    typeof stored.owner !== 'string' ||
    !Number.isFinite(stored.createdAt) ||
    !(stored.expiresAt === null || Number.isFinite(stored.expiresAt)) ||
    !sharedSnapshot.safeParse(stored.snapshot).success
  )
    throw new Error('Invalid stored share');
  return stored;
}

export default {
  async fetch(request: Request): Promise<Response> {
    const method = request.method;
    if (method !== 'GET' && method !== 'POST' && method !== 'DELETE')
      return json({ error: 'Méthode non autorisée.' }, 405);
    if (!storageConfigured())
      return json(
        { error: 'Le partage doit être activé dans les paramètres de stockage Vercel.' },
        503,
      );

    const query = new URL(request.url).searchParams;
    const id = query.get('id') || '';
    const pathname = pathFor(id);
    if (method === 'GET') {
      if (query.get('mine') === '1') {
        const session = readSession(request);
        if (!session) return unauthorized();
        try {
          const owner = shareOwner(session);
          const prefix = ownerPrefix(owner);
          const page = await list({ prefix: `shares/v1/${prefix}/`, limit: MAX_SHARES_PER_USER });
          const shares = await Promise.all(
            page.blobs.map(async (blob) => {
              const stored = await readStored(blob.pathname);
              if (!stored || stored.owner.toLowerCase() !== owner.toLowerCase()) return null;
              const suffix = blob.pathname
                .split('/')
                .pop()
                ?.replace(/\.json$/, '');
              if (!suffix) return null;
              const linkId = `${prefix}.${suffix}`;
              return {
                id: linkId,
                url: `${webOrigin(request)}/s/${linkId}`,
                type: stored.snapshot.type,
                title: stored.snapshot.title,
                createdAt: stored.createdAt,
                expiresAt: stored.expiresAt,
              };
            }),
          );
          return json({
            shares: shares.filter(Boolean).sort((a, b) => b!.createdAt - a!.createdAt),
          });
        } catch (error) {
          console.error('Share list failed', error instanceof Error ? error.name : 'unknown');
          return json({ error: 'Impossible de consulter les liens de partage.' }, 503);
        }
      }
      if (!pathname) return json({ error: 'Lien de partage invalide.' }, 400);
      try {
        const stored = await readStored(pathname);
        if (!stored) return json({ error: 'Ce partage n’existe plus.' }, 404);
        if (stored.expiresAt !== null && stored.expiresAt <= Date.now())
          return json({ error: 'Ce lien de partage a expiré.' }, 410);
        const response = json({
          id,
          createdAt: stored.createdAt,
          expiresAt: stored.expiresAt,
          snapshot: stored.snapshot,
        });
        response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive');
        return response;
      } catch (error) {
        console.error('Share read failed', error instanceof Error ? error.name : 'unknown');
        return json({ error: 'Ce partage est momentanément indisponible.' }, 503);
      }
    }

    const session = readSession(request);
    if (!session) return unauthorized();
    if (!sameOrigin(request)) return json({ error: 'Origine non autorisée.' }, 403);

    if (method === 'DELETE') {
      if (!pathname) return json({ error: 'Lien de partage invalide.' }, 400);
      if (!id.startsWith(`${ownerPrefix(shareOwner(session))}.`))
        return json({ error: 'Vous ne pouvez pas supprimer ce partage.' }, 403);
      try {
        const stored = await readStored(pathname);
        if (!stored) return json({ error: 'Ce partage n’existe plus.' }, 404);
        if (stored.owner.toLowerCase() !== shareOwner(session).toLowerCase())
          return json({ error: 'Vous ne pouvez pas supprimer ce partage.' }, 403);
        await del(pathname);
        return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
      } catch (error) {
        console.error('Share deletion failed', error instanceof Error ? error.name : 'unknown');
        return json({ error: 'Suppression temporairement indisponible.' }, 503);
      }
    }

    try {
      if (Number(request.headers.get('content-length') || 0) > MAX_BODY_BYTES)
        return json({ error: 'Cette sélection est trop grande pour être partagée.' }, 413);
      const raw = await request.text();
      if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES)
        return json({ error: 'Cette sélection est trop grande pour être partagée.' }, 413);
      const body = JSON.parse(raw) as { snapshot?: unknown; expiresInDays?: unknown };
      const result = sharedSnapshot.safeParse(body?.snapshot);
      if (!result.success || ![null, 7, 30].includes(body?.expiresInDays as number | null))
        return json({ error: 'Contenu de partage invalide.' }, 400);

      const prefix = ownerPrefix(shareOwner(session));
      const existing = await list({ prefix: `shares/v1/${prefix}/`, limit: MAX_SHARES_PER_USER });
      if (existing.blobs.length >= MAX_SHARES_PER_USER)
        return json({ error: 'Limite de 50 partages atteinte. Révoquez un ancien lien.' }, 429);

      const token = randomBytes(18).toString('base64url');
      const shareId = `${prefix}.${token}`;
      const createdAt = Date.now();
      const expiresAt =
        body.expiresInDays === null
          ? null
          : createdAt + (body.expiresInDays as number) * 24 * 60 * 60 * 1_000;
      const stored: StoredShare = {
        owner: shareOwner(session),
        createdAt,
        expiresAt,
        snapshot: result.data,
      };
      await put(pathFor(shareId)!, JSON.stringify(stored), {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: false,
        contentType: 'application/json',
        cacheControlMaxAge: 0,
      });
      return json(
        {
          id: shareId,
          url: `${webOrigin(request)}/s/${shareId}`,
          createdAt,
          expiresAt,
          type: result.data.type,
          title: result.data.title,
        },
        201,
      );
    } catch (error) {
      if (error instanceof SyntaxError) return json({ error: 'JSON invalide.' }, 400);
      console.error('Share creation failed', error instanceof Error ? error.name : 'unknown');
      return json({ error: 'Création du partage momentanément indisponible.' }, 503);
    }
  },
};

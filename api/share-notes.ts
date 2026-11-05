import { createHash, randomBytes } from 'node:crypto';
import { get, list, put } from '@vercel/blob';
import { json, readSession, sameOrigin, unauthorized } from '../server/session.js';
import { pathFor, readStored, storageConfigured } from './share.js';
import { sharedNoteInput, type SharedNote } from '../src/share/notes.js';
import type { SharedPost } from '../src/share/model.js';

const MAX_NOTES = 200;
const MAX_BODY_BYTES = 6_000;

function notePrefix(id: string) {
  return `shares/notes/v1/${id}/`;
}

function postText(post: SharedPost): string {
  const strings = post.text.map((segment) => segment.v);
  for (const block of post.article?.blocks ?? []) {
    if ('text' in block) strings.push(...block.text.map((segment) => segment.v));
    if (block.t === 'list')
      strings.push(...block.items.flatMap((item) => item.map((segment) => segment.v)));
    if (block.t === 'code') strings.push(block.code);
  }
  return strings.join(' ').replace(/\s+/g, ' ');
}

export default {
  async fetch(request: Request): Promise<Response> {
    if (!['GET', 'POST'].includes(request.method))
      return json({ error: 'Méthode non autorisée.' }, 405);
    if (!storageConfigured()) return json({ error: 'Partage Vercel non configuré.' }, 503);
    const id = new URL(request.url).searchParams.get('id') ?? '';
    const path = pathFor(id);
    if (!path) return json({ error: 'Lien invalide.' }, 400);

    if (request.method === 'POST') {
      if (!readSession(request)) return unauthorized();
      if (!sameOrigin(request)) return json({ error: 'Origine non autorisée.' }, 403);
    }

    try {
      const share = await readStored(path);
      if (!share) return json({ error: 'Ce partage n’existe plus.' }, 404);
      if (share.expiresAt !== null && share.expiresAt <= Date.now())
        return json({ error: 'Ce lien a expiré.' }, 410);
      if (!share.collaboration)
        return request.method === 'GET'
          ? json({ notes: [] })
          : json({ error: 'La collaboration est désactivée sur ce lien.' }, 403);

      const prefix = notePrefix(id);
      const page = await list({ prefix, limit: MAX_NOTES + 1 });
      if (request.method === 'GET') {
        const notes = await Promise.all(page.blobs.slice(0, MAX_NOTES).map(async (blob) => {
          const result = await get(blob.pathname, { access: 'private', useCache: false });
          if (!result || result.statusCode !== 200) return null;
          const note = JSON.parse(await new Response(result.stream).text()) as SharedNote;
          return note;
        }));
        return json({ notes: notes.filter((note) => note !== null).sort((a, b) => a.createdAt - b.createdAt) });
      }

      if (page.blobs.length >= MAX_NOTES)
        return json({ error: 'Ce partage a atteint la limite de 200 contributions.' }, 429);
      if (Number(request.headers.get('content-length') || 0) > MAX_BODY_BYTES)
        return json({ error: 'Contribution trop longue.' }, 413);
      const raw = await request.text();
      if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES)
        return json({ error: 'Contribution trop longue.' }, 413);
      const parsed = sharedNoteInput.safeParse(JSON.parse(raw));
      if (!parsed.success) return json({ error: 'Contribution invalide.' }, 400);
      const input = parsed.data;
      const item = share.snapshot.items[input.itemIndex];
      if (!item) return json({ error: 'Publication introuvable.' }, 400);
      const post = input.postId ? item.posts.find((p) => p.id === input.postId) : null;
      if (input.postId && !post) return json({ error: 'Message introuvable.' }, 400);
      if (input.kind === 'annotation' && (!post || !postText(post).includes(input.quote!.replace(/\s+/g, ' '))))
        return json({ error: 'Cette sélection ne figure pas dans la publication.' }, 400);

      const session = readSession(request)!;
      const authorId = session.provider === 'google' ? `google:${session.subject}` : `github:${session.login.toLowerCase()}`;
      const note: SharedNote = {
        ...input,
        id: randomBytes(16).toString('base64url'),
        createdAt: Date.now(),
        author: (session.provider === 'google' ? session.login.split('@')[0] : session.login)?.slice(0, 80) || 'Lecteur',
        authorKey: createHash('sha256').update(authorId).digest('hex').slice(0, 16),
      };
      await put(`${prefix}${note.id}.json`, JSON.stringify(note), {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: false,
        contentType: 'application/json',
        cacheControlMaxAge: 0,
      });
      return json({ note }, 201);
    } catch (error) {
      if (error instanceof SyntaxError) return json({ error: 'JSON invalide.' }, 400);
      console.error('Share notes failed', error instanceof Error ? error.name : 'unknown');
      return json({ error: 'Les contributions sont momentanément indisponibles.' }, 503);
    }
  },
};

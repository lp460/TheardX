import { json, readSession, unauthorized } from '../server/session';

const ALLOWED = new Set([
  'pbs.twimg.com', 'abs.twimg.com', 'video.twimg.com',
  'i.redd.it', 'preview.redd.it', 'cf.preview.redd.it', 'external-preview.redd.it',
  'styles.redditmedia.com', 'www.redditstatic.com',
]);
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export default {
  async fetch(request: Request): Promise<Response> {
    if (request.method !== 'GET') return json({ error: 'Méthode refusée' }, 405);
    if (!readSession(request)) return unauthorized();
    const source = new URL(request.url).searchParams.get('url');
    let target: URL;
    try {
      target = new URL(source || '');
      if (target.protocol !== 'https:' || !ALLOWED.has(target.hostname) ||
        target.port || target.username || target.password) throw new Error('URL non autorisée');
    } catch { return json({ error: 'Domaine média non autorisé.' }, 400); }

    try {
      const response = await fetch(target, {
        credentials: 'omit', redirect: 'manual', signal: AbortSignal.timeout(12_000),
        headers: { Accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif,*/*;q=0.5' },
      });
      if (!response.ok) return json({ error: `Image indisponible (${response.status}).` }, 502);
      const type = (response.headers.get('content-type') || '').split(';')[0]!.trim();
      if (!/^image\/(?:jpeg|png|gif|webp|avif)$/.test(type))
        return json({ error: 'Réponse non-image refusée.' }, 415);
      const size = Number(response.headers.get('content-length') || '0');
      if (size > MAX_IMAGE_BYTES) return json({ error: 'Image trop volumineuse.' }, 413);
      const reader = response.body?.getReader();
      if (!reader) return json({ error: 'Image illisible.' }, 502);
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_IMAGE_BYTES) {
          await reader.cancel();
          return json({ error: 'Image trop volumineuse.' }, 413);
        }
        chunks.push(value);
      }
      const image = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) { image.set(chunk, offset); offset += chunk.byteLength; }
      return new Response(image, { headers: {
        'Content-Type': type, 'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      } });
    } catch {
      return json({ error: 'Téléchargement média impossible.' }, 502);
    }
  },
};

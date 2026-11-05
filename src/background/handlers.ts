import { requestSchema, type Envelope, type Request } from '@/messaging/protocol';
import type { Repository } from '@/storage/repository';
import { cacheEntryMedia } from '@/storage/media-cache';
import { loadSettings } from '@/settings/store';
import { domainOf } from '@/settings/schema';

export interface BackgroundDeps {
  repo: Repository;
  openTab: (url: string) => Promise<void>;
  extensionUrl: (path: string) => string;
  extensionId: string;
  version: string;
  cacheMedia?: (entryId: string) => Promise<unknown>;
  /** Injected in tests; defaults to the real GitHub sync service. */
  sync?: { now: () => Promise<unknown>; status: () => Promise<unknown> };
}

export interface SenderInfo {
  id?: string;
  url?: string;
  tab?: { id?: number; url?: string };
}

/** Only our own extension pages and our content scripts on supported X domains may talk to us. */
export function isTrustedSender(
  sender: SenderInfo,
  deps: Pick<BackgroundDeps, 'extensionId' | 'extensionUrl'>,
): boolean {
  if (sender.id !== deps.extensionId) return false;
  const url = sender.url ?? sender.tab?.url ?? '';
  if (url.startsWith(deps.extensionUrl(''))) return true;
  try {
    return domainOf(new URL(url).hostname) !== null;
  } catch {
    return false;
  }
}

async function dispatch(req: Request, deps: BackgroundDeps): Promise<unknown> {
  const { repo } = deps;
  switch (req.type) {
    case 'ping':
      return { ok: true, version: deps.version };
    case 'capture.save': {
      const result = await repo.saveCapture(req.payload);
      const settings = await loadSettings();
      if (settings.cacheMedia) {
        const run =
          deps.cacheMedia ??
          ((id: string) => cacheEntryMedia(id, { maxBytes: settings.maxMediaMB * 1024 * 1024 }));
        void run(result.entry.id).catch((e) => console.warn('[ThreadShelf] media cache failed', e));
      }
      return result;
    }
    case 'capture.status':
      return repo.savedStatus(req.tweetIds);
    case 'entry.get':
      return (await repo.getEntry(req.id)) ?? null;
    case 'entry.update':
      return repo.updateEntry(req.id, req.patch);
    case 'entry.delete':
      return repo.deleteEntries(req.ids);
    case 'meta.lists':
      return {
        collections: await repo.listCollections(),
        categories: await repo.listCategories(),
        tags: await repo.listTags(),
      };
    case 'collection.create':
      return repo.createCollection(req.name);
    case 'category.create':
      return repo.createCategory(req.name);
    case 'open.reader':
      await deps.openTab(
        deps.extensionUrl(
          `reader/index.html?id=${encodeURIComponent(req.entryId)}${req.print ? '&print=1' : ''}`,
        ),
      );
      return { ok: true };
    case 'open.library':
      await deps.openTab(deps.extensionUrl(`library/index.html${req.view ? `#${req.view}` : ''}`));
      return { ok: true };
    case 'sync.now':
      return (deps.sync?.now ?? (await import('./sync-service')).syncNow)();
    case 'sync.status':
      return (deps.sync?.status ?? (await import('./sync-service')).loadSyncStatus)();
    case 'sync.googleConnect':
      return (await import('./sync-service')).syncGoogleConnect(req.passphrase);
    case 'sync.deviceStart':
      return (await import('./sync-service')).syncDeviceStart();
    case 'sync.devicePoll':
      return (await import('./sync-service')).syncDevicePoll({
        encrypt: req.encrypt,
        passphrase: req.passphrase,
      });
    case 'sync.disconnect':
      return (await import('./sync-service')).syncDisconnect();
    case 'media.cache': {
      const settings = await loadSettings();
      return (
        deps.cacheMedia ??
        ((id: string) => cacheEntryMedia(id, { maxBytes: settings.maxMediaMB * 1024 * 1024 }))
      )(req.entryId);
    }
  }
}

export async function handleMessage(
  raw: unknown,
  sender: SenderInfo,
  deps: BackgroundDeps,
): Promise<Envelope<unknown>> {
  if (!isTrustedSender(sender, deps)) return { ok: false, error: 'Untrusted sender.' };
  const parsed = requestSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      error:
        `Invalid message: ${parsed.error.issues[0]?.path.join('.') ?? ''} ${parsed.error.issues[0]?.message ?? ''}`.trim(),
    };
  }
  try {
    return { ok: true, data: await dispatch(parsed.data, deps) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[ThreadShelf] request failed', parsed.data.type, e);
    if (/QuotaExceeded/i.test(msg)) return { ok: false, error: 'Espace de stockage insuffisant.' };
    return { ok: false, error: msg };
  }
}

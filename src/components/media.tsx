import { ImageOff, Play } from 'lucide-react';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { MediaItem, MediaRecord } from '@/types/model';
import { largerAvatarUrl } from '@/utils/url';
import { cn } from './ui/cn';

/** Object URLs for cached media blobs, shared by a page. */
const MediaContext = createContext<Record<string, string>>({});

export function MediaProvider({
  records,
  children,
}: {
  records: Record<string, MediaRecord>;
  children: ReactNode;
}) {
  const [urls, setUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    const made: Record<string, string> = {};
    for (const [url, rec] of Object.entries(records)) {
      if (rec.status === 'cached' && rec.blob) made[url] = URL.createObjectURL(rec.blob);
    }
    setUrls(made);
    return () => Object.values(made).forEach((u) => URL.revokeObjectURL(u));
  }, [records]);
  return <MediaContext.Provider value={urls}>{children}</MediaContext.Provider>;
}

export function useMediaSrc(url: string | undefined): { src?: string; cached: boolean } {
  const map = useContext(MediaContext);
  if (!url) return { cached: false };
  const local = map[url];
  return local ? { src: local, cached: true } : { src: url, cached: false };
}

export function useOnline(): boolean {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

export function Avatar({
  url,
  handle,
  size = 40,
  className,
}: {
  url?: string;
  handle: string;
  size?: number;
  className?: string;
}) {
  const big = url ? largerAvatarUrl(url) : undefined;
  const { src } = useMediaSrc(big);
  const [failed, setFailed] = useState(false);
  const initials = handle.slice(0, 2).toUpperCase();
  return (
    <span
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-subtle text-[11px] font-semibold text-muted ring-1 ring-line',
        className,
      )}
      style={{ width: size, height: size }}
    >
      {src && !failed ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        initials
      )}
    </span>
  );
}

export function MediaView({
  item,
  postUrl,
  className,
  compact,
}: {
  item: MediaItem;
  postUrl: string;
  className?: string;
  compact?: boolean;
}) {
  const { src, cached } = useMediaSrc(item.url);
  const online = useOnline();
  const [failed, setFailed] = useState(false);
  const ratio = useMemo(
    () => (item.width && item.height ? `${item.width} / ${item.height}` : undefined),
    [item.width, item.height],
  );
  const unavailable = failed || (!cached && !online);
  if (unavailable) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-line bg-subtle/60 px-4 py-8 text-center text-[12.5px] text-muted',
          className,
        )}
      >
        <ImageOff size={18} />
        <span>{online ? 'Image indisponible' : 'Image non disponible hors ligne'}</span>
        {item.alt ? <span className="max-w-md text-faint">« {item.alt} »</span> : null}
      </div>
    );
  }
  const isVideo = item.kind !== 'photo';
  const img = (
    <img
      src={src}
      alt={item.alt ?? ''}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={cn(
        'block h-full w-full rounded-xl bg-subtle object-cover',
        compact ? 'max-h-60' : 'max-h-[70vh] object-contain',
      )}
      style={ratio && !compact ? { aspectRatio: ratio } : undefined}
    />
  );
  if (!isVideo) return <figure className={cn('m-0', className)}>{img}</figure>;
  return (
    <a
      href={item.playbackUrl ?? postUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={cn('group relative block', className)}
      aria-label={item.kind === 'gif' ? 'GIF — lire sur X' : 'Vidéo — lire sur X'}
    >
      {img}
      <span className="absolute inset-0 flex items-center justify-center">
        <span className="flex items-center gap-1.5 rounded-full bg-black/65 px-3 py-1.5 text-[12px] font-medium text-white backdrop-blur transition-transform group-hover:scale-105">
          <Play size={13} fill="currentColor" /> {item.kind === 'gif' ? 'GIF' : 'Vidéo'} · lire sur
          X
        </span>
      </span>
    </a>
  );
}

import type { ContentAdapter } from './content-adapter';
import { xAdapter } from './x-adapter';

const ADAPTERS: ContentAdapter[] = [xAdapter];

export function adapterFor(url: string | URL): ContentAdapter | null {
  try {
    const u = typeof url === 'string' ? new URL(url) : url;
    return ADAPTERS.find((a) => a.matches(u)) ?? null;
  } catch {
    return null;
  }
}

export function registeredAdapters(): readonly ContentAdapter[] {
  return ADAPTERS;
}

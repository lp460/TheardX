import { create } from 'zustand';
import type { CaptureMode } from '@/thread-engine';
import type { Category, Collection, Completeness } from '@/types/model';

export interface PanelPreview {
  focalId: string;
  handle: string;
  name?: string;
  posts: { id: string; text: string; handle: string; media: number }[];
  completeness: Completeness;
  references: { url: string; captured: boolean; kind: 'quote' | 'link' }[];
}

export interface ContentToast {
  id: number;
  tone: 'success' | 'warning' | 'error' | 'info';
  title: string;
  description?: string;
  action?: { label: string; run: () => void };
}

interface ContentStore {
  tone: 'light' | 'dark';
  panelOpen: boolean;
  targetId: string | null;
  mode: CaptureMode;
  preview: PanelPreview | null;
  selection: string[];
  savedEntryId: string | null;
  busy: boolean;
  live: { entryId: string; count: number } | null;
  collections: Collection[];
  categories: Category[];
  form: { collectionId: string; categoryId: string; tags: string; note: string };
  toasts: ContentToast[];
  set: (patch: Partial<ContentStore>) => void;
  pushToast: (t: Omit<ContentToast, 'id'>) => void;
  dismissToast: (id: number) => void;
}

let seq = 0;

export const useContent = create<ContentStore>((set) => ({
  tone: 'light',
  panelOpen: false,
  targetId: null,
  mode: 'thread',
  preview: null,
  selection: [],
  savedEntryId: null,
  busy: false,
  live: null,
  collections: [],
  categories: [],
  form: { collectionId: '', categoryId: '', tags: '', note: '' },
  toasts: [],
  set: (patch) => set(patch),
  pushToast: (t) => set((s) => ({ toasts: [...s.toasts.slice(-2), { ...t, id: ++seq }] })),
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

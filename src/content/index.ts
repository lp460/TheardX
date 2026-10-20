/**
 * ThreadShelf content script entry. Runs at document_idle on x.com / twitter.com.
 * Guarded against double injection (extension reload, duplicated script).
 */
import { send } from '@/messaging/client';
import { ContentController } from './controller';
import { useContent } from './store';
import { createUiMount } from './ui/mount';

const FLAG = '__threadshelf_content__';
const w = window as unknown as Record<string, unknown>;

if (!w[FLAG] && window.top === window) {
  w[FLAG] = true;
  const ref: { controller?: ContentController } = {};
  const ui = createUiMount(() => ({
    menuAction: (a) => void ref.controller!.menuAction(a),
    closeMenu: () => ref.controller!.closeMenu(),
    openFabMenu: (anchor) => ref.controller!.openMenu(null, anchor, 'fab'),
    save: () => {
      const s = useContent.getState();
      void ref.controller!.save(s.mode, s.targetId);
    },
    copy: (format) => {
      const s = useContent.getState();
      void ref.controller!.copy(s.mode, s.targetId, format);
    },
    read: () => {
      const s = useContent.getState();
      void ref.controller!.read(s.mode === 'selection' ? 'selection' : s.mode, s.targetId);
    },
    remove: () => void ref.controller!.removeSaved(),
    openLibrary: () => void send({ type: 'open.library' }).catch(() => undefined),
    setMode: (m) => ref.controller!.setMode(m),
    close: () => ref.controller!.closePanel(),
    createCollection: async (name) => {
      const c = await send({ type: 'collection.create', name });
      await ref.controller!.loadLists();
      const st = useContent.getState();
      st.set({ form: { ...st.form, collectionId: c.id } });
    },
    createCategory: async (name) => {
      const c = await send({ type: 'category.create', name });
      await ref.controller!.loadLists();
      const st = useContent.getState();
      st.set({ form: { ...st.form, categoryId: c.id } });
    },
  }));
  const controller = new ContentController(ui);
  ref.controller = controller;
  void controller.start();
  // Exposed for diagnostics and end-to-end tests (isolated world: invisible to the page's own scripts).
  w.__threadshelf = controller;
}

/**
 * Content-script controller for x.com / twitter.com and reddit.com (site specifics live in the
 * adapters of `@/adapters`).
 *
 * Lifecycle: one instance per page. A single, throttled MutationObserver (childList only) follows X's
 * SPA rendering; scans are cheap DOM reads with a per-element extraction cache. Nothing is saved
 * without a user action (button, popup, shortcut, context menu).
 */
import type { ContentAdapter } from '@/adapters/content-adapter';
import { adapterFor } from '@/adapters/registry';
import { xAdapter } from '@/adapters/x-adapter';
import type { PageScan } from '@/extraction';
import { render } from '@/export';
import { send, MessagingError } from '@/messaging/client';
import { contentMessageSchema, type ContentMessage, type ContentState } from '@/messaging/protocol';
import { isActiveOn, type Settings } from '@/settings/schema';
import { loadSettings, onSettingsChanged } from '@/settings/store';
import type { CaptureMode } from '@/thread-engine';
import { copyText } from '@/utils/clipboard';
import { postPreviewText, truncate } from '@/utils/text';
import { vocab } from '@/utils/vocab';
import { CaptureSession } from './session';
import { useContent, type MenuAction, type PanelPreview } from './store';
import { CaptureBar, PostButton, type Tone } from './ui/inline';

const SCAN_THROTTLE_MS = 250;
const LIVE_SAVE_DEBOUNCE_MS = 900;
const LIVE_MAX_MS = 10 * 60_000;

type RunResult = { ok: boolean; message?: string; error?: string };

export interface UiMount {
  ensure: () => void;
  destroy: () => void;
}

export class ContentController {
  private settings: Settings | null = null;
  private observer: MutationObserver | null = null;
  private readonly adapter: ContentAdapter = adapterFor(location.href) ?? xAdapter;
  private readonly words = vocab(this.adapter.id);
  private session = new CaptureSession();
  private scanTimer: ReturnType<typeof setTimeout> | null = null;
  private lastScanAt = 0;
  private lastUrl = location.href;
  private buttons = new Map<string, PostButton>();
  private bar: CaptureBar | null = null;
  private saved = new Map<string, string>(); // tweetId → entryId
  private statusQueried = new Set<string>();
  private statusTimer: ReturnType<typeof setTimeout> | null = null;
  private liveTimer: ReturnType<typeof setTimeout> | null = null;
  private liveStartedAt = 0;
  private liveSignature = '';
  /** User-started import on the saved/bookmarks page: no background scraping or auto-scrolling. */
  private savedImportRunning = false;
  private savedImportBusy = false;
  private readonly savedPageIds = new Set<string>();
  private readonly savedImportProcessed = new Set<string>();
  private savedImportDone = 0;
  private savedImportFailed = 0;
  private dead = false;
  private offSettings: (() => void) | null = null;
  readonly stats = { scans: 0, mutations: 0 };

  constructor(private readonly ui: UiMount) {}

  /* ------------------------------------------------------------------ lifecycle ------------------------------------------------------------------ */

  async start(): Promise<void> {
    this.settings = await loadSettings();
    useContent.getState().set({ platform: this.adapter.id });
    this.offSettings = onSettingsChanged((s) => this.applySettings(s));
    chrome.runtime.onMessage.addListener(this.onMessage);
    document.addEventListener('visibilitychange', this.onVisibility);
    window.addEventListener('pagehide', this.onPageHide);
    window.addEventListener('popstate', this.onUrlMaybeChanged);
    const nav = (window as unknown as { navigation?: EventTarget }).navigation;
    nav?.addEventListener?.('currententrychange', this.onUrlMaybeChanged);
    this.applySettings(this.settings);
  }

  private get active(): boolean {
    return !this.dead && !!this.settings && isActiveOn(this.settings, location.hostname);
  }

  private applySettings(s: Settings): void {
    this.settings = s;
    if (!this.active) {
      this.disconnect();
      this.removeInjected();
      this.ui.destroy();
      useContent.getState().set({ panelOpen: false, menu: null, fabVisible: false });
      return;
    }
    if (!s.injectUi) this.removeInjected();
    else if (!s.perPostButtons) this.removeButtons();
    const fab = s.injectUi && s.floatingButton;
    if (fab) this.ui.ensure();
    useContent.getState().set({ fabVisible: fab, ...(fab ? {} : { menu: null }) });
    if (s.autoDetect) this.connect();
    else this.disconnect();
    this.scheduleScan(0);
  }

  private connect(): void {
    if (this.observer || document.visibilityState === 'hidden') return;
    this.observer = new MutationObserver(this.onMutations);
    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  private disconnect(): void {
    this.observer?.disconnect();
    this.observer = null;
    if (this.scanTimer) clearTimeout(this.scanTimer);
    this.scanTimer = null;
  }

  /** Releases every observer, timer and listener and removes injected elements. */
  stop(): void {
    this.dead = true;
    this.disconnect();
    this.stopLive();
    this.savedImportRunning = false;
    if (this.statusTimer) clearTimeout(this.statusTimer);
    this.statusTimer = null;
    this.removeInjected();
    this.offSettings?.();
    this.offSettings = null;
    document.removeEventListener('visibilitychange', this.onVisibility);
    window.removeEventListener('pagehide', this.onPageHide);
    window.removeEventListener('popstate', this.onUrlMaybeChanged);
    const nav = (window as unknown as { navigation?: EventTarget }).navigation;
    nav?.removeEventListener?.('currententrychange', this.onUrlMaybeChanged);
    try {
      chrome.runtime.onMessage.removeListener(this.onMessage);
    } catch {
      // Context already invalidated.
    }
  }

  /** Stops everything — used when the extension is reloaded/updated under a live page. */
  private shutdown(reason: string): void {
    if (this.dead) return;
    this.stop();
    useContent
      .getState()
      .pushToast({ tone: 'warning', title: 'ThreadShelf a été mis à jour', description: reason });
  }

  private onVisibility = () => {
    if (document.visibilityState === 'hidden') this.disconnect();
    else if (this.active && this.settings?.autoDetect) {
      this.connect();
      this.scheduleScan(0);
    }
  };

  private onPageHide = () => {
    this.disconnect();
    this.stopLive();
  };

  private onMutations = (records: MutationRecord[]) => {
    this.stats.mutations += records.length;
    // Ignore mutations caused only by our own injected elements.
    let relevant = false;
    for (const r of records) {
      for (const n of Array.from(r.addedNodes).concat(Array.from(r.removedNodes))) {
        if (n.nodeType === 1 && !(n as Element).tagName.startsWith('THREADSHELF-')) {
          relevant = true;
          break;
        }
      }
      if (relevant) break;
    }
    if (relevant) this.scheduleScan();
  };

  private onUrlMaybeChanged = () => this.scheduleScan(50);

  private scheduleScan(delay?: number): void {
    if (!this.active || this.scanTimer) return;
    const wait = delay ?? Math.max(0, SCAN_THROTTLE_MS - (Date.now() - this.lastScanAt));
    this.scanTimer = setTimeout(() => {
      this.scanTimer = null;
      const run = () => this.scan();
      if ('requestIdleCallback' in window && wait > 0)
        (window as Window).requestIdleCallback(run, { timeout: 500 });
      else run();
    }, wait);
  }

  /* ------------------------------------------------------------------ scanning ------------------------------------------------------------------ */

  private detectTone(): Tone {
    const site = this.adapter.tone?.(document);
    if (site) return site;
    for (const el of [document.body, document.documentElement]) {
      const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?/.exec(
        getComputedStyle(el).backgroundColor,
      );
      if (!m || m[4] === '0') continue; // transparent: look at the parent
      const lum = 0.2126 * Number(m[1]) + 0.7152 * Number(m[2]) + 0.0722 * Number(m[3]);
      return lum < 128 ? 'dark' : 'light';
    }
    return 'light';
  }

  scan(): PageScan | null {
    if (this.scanTimer) {
      clearTimeout(this.scanTimer);
      this.scanTimer = null;
    }
    if (!this.active) return null;
    this.lastScanAt = Date.now();
    this.stats.scans += 1;
    if (location.href !== this.lastUrl) this.onRouteChange();
    const scan = this.adapter.scan(document, location.href);
    this.session.ingest(scan);
    if (this.onSavedPage()) {
      for (const cell of scan.cells) {
        if (cell.tweet && cell.tweet.context !== 'quote') this.savedPageIds.add(cell.tweet.id);
      }
      if (this.savedImportRunning) void this.drainSavedImport();
    }
    const tone = this.detectTone();
    if (useContent.getState().tone !== tone) useContent.getState().set({ tone });
    if (scan.layout !== 'unknown') {
      this.syncInjected(scan, tone);
      this.querySavedStatus(scan);
      this.refreshPreview();
      this.maybeLiveSave();
    }
    return scan;
  }

  private onRouteChange(): void {
    this.lastUrl = location.href;
    if (!this.onSavedPage()) {
      this.savedImportRunning = false;
      this.savedPageIds.clear();
      this.savedImportProcessed.clear();
      this.savedImportDone = 0;
      this.savedImportFailed = 0;
    }
    const st = useContent.getState();
    const routeId = this.adapter.routeId(location.href);
    // Keep the live session only while we stay inside the same thread.
    const live = st.live;
    if (live && (!routeId || !this.session.plan('thread', routeId).tweetIds.length))
      this.stopLive();
    if (st.panelOpen && st.mode !== 'selection') st.set({ panelOpen: false, targetId: null });
    this.bar?.host.remove();
    this.bar = null;
  }

  /* ------------------------------------------------------------------ injected UI ------------------------------------------------------------------ */

  private removeButtons(): void {
    for (const b of this.buttons.values()) b.host.remove();
    this.buttons.clear();
  }

  private removeInjected(): void {
    this.removeButtons();
    this.bar?.host.remove();
    this.bar = null;
    document.querySelectorAll('threadshelf-action, threadshelf-bar').forEach((el) => el.remove());
  }

  private syncInjected(scan: PageScan, tone: Tone): void {
    if (!this.settings?.injectUi) return;
    const st = useContent.getState();
    const live = new Set<string>();
    for (const cell of scan.cells) {
      const el = cell.element;
      const t = cell.tweet;
      if (!el || !t) continue;
      live.add(t.id);
      // Per-post button.
      if (this.settings.perPostButtons) {
        const slot = this.adapter.actionSlot(el);
        const row = slot?.container;
        if (row) {
          let btn = this.buttons.get(t.id);
          if (!btn || !btn.host.isConnected || btn.host.parentElement !== row) {
            btn?.host.remove();
            row.querySelectorAll(':scope > threadshelf-action').forEach((x) => x.remove());
            btn = new PostButton(t.id, (id, host) => this.onPostButton(id, host));
            if (slot.slot) btn.host.slot = slot.slot;
            row.appendChild(btn.host);
            this.buttons.set(t.id, btn);
          }
          btn.update({
            saved: this.saved.has(t.id),
            selecting: st.panelOpen && st.mode === 'selection',
            selected: st.selection.includes(t.id),
            tone,
          });
        }
      }
      // Focal bar.
      if (cell.isFocal) {
        const anchor = this.adapter.barAnchor(el);
        if (anchor) {
          if (!this.bar || this.bar.tweetId !== t.id || !this.bar.host.isConnected) {
            this.bar?.host.remove();
            el.querySelectorAll('threadshelf-bar').forEach((x) => x.remove());
            this.bar = new CaptureBar(t.id, {
              save: () => void this.save('thread', t.id),
              copy: () => void this.copy('thread', t.id),
              read: () => void this.read('thread', t.id),
              more: (anchor) => this.openMenu(t.id, anchor.getBoundingClientRect(), 'bar'),
            });
            anchor.insertAdjacentElement('afterend', this.bar.host);
          }
          const plan = this.session.plan('thread', t.id);
          const status = plan.completeness.status;
          this.bar.update({
            platform: this.adapter.id,
            tone,
            saved: this.saved.has(t.id),
            count: plan.tweetIds.length,
            status: st.busy
              ? 'busy'
              : plan.tweetIds.length <= 1 && status === 'complete'
                ? 'single'
                : status === 'complete'
                  ? 'complete'
                  : 'incomplete',
          });
        }
      }
    }
    // Forget buttons of posts no longer rendered (X unmounted them).
    for (const [id, b] of this.buttons) {
      if (!live.has(id) || !b.host.isConnected) {
        b.host.remove();
        this.buttons.delete(id);
      }
    }
  }

  private querySavedStatus(scan: PageScan): void {
    for (const c of scan.cells)
      if (c.tweet && !this.statusQueried.has(c.tweet.id)) this.statusQueried.add(c.tweet.id);
    if (this.statusTimer) return;
    this.statusTimer = setTimeout(async () => {
      this.statusTimer = null;
      const ids = scan.cells
        .map((c) => c.tweet?.id)
        .filter((x): x is string => !!x)
        .slice(0, 400);
      if (!ids.length) return;
      try {
        const status = await send({ type: 'capture.status', tweetIds: ids });
        let changed = false;
        for (const id of ids) {
          const e = status[id]?.[0]?.entryId;
          if (e && this.saved.get(id) !== e) {
            this.saved.set(id, e);
            changed = true;
          } else if (!e && this.saved.has(id)) {
            this.saved.delete(id);
            changed = true;
          }
        }
        if (changed) this.refreshButtons();
      } catch (e) {
        this.handleError(e, true);
      }
    }, 400);
  }

  private refreshButtons(): void {
    const st = useContent.getState();
    const tone = st.tone;
    for (const [id, b] of this.buttons)
      b.update({
        saved: this.saved.has(id),
        selecting: st.panelOpen && st.mode === 'selection',
        selected: st.selection.includes(id),
        tone,
      });
    if (this.bar) this.scheduleScan(0);
  }

  /* ------------------------------------------------------------------ panel ------------------------------------------------------------------ */

  private onPostButton(id: string, host: HTMLElement): void {
    const st = useContent.getState();
    if (st.panelOpen && st.mode === 'selection') {
      const selection = st.selection.includes(id)
        ? st.selection.filter((x) => x !== id)
        : [...st.selection, id];
      st.set({ selection });
      this.refreshButtons();
      return;
    }
    this.openMenu(id, host.getBoundingClientRect(), 'post');
  }

  /* ------------------------------------------------------------------ action menu ------------------------------------------------------------------ */

  /** Post closest to the top third of the viewport (the one the user is reading). */
  private visiblePostId(): string | null {
    const cells = this.session.lastScan?.cells ?? [];
    const focal = cells.find((c) => c.isFocal && c.tweet);
    if (focal?.element) {
      const r = focal.element.getBoundingClientRect();
      if (r.bottom > 0 && r.top < window.innerHeight) return focal.tweet!.id;
    }
    const target = window.innerHeight * 0.3;
    let best: { id: string; d: number } | null = null;
    for (const c of cells) {
      if (!c.tweet || !c.element) continue;
      const r = c.element.getBoundingClientRect();
      if (r.height === 0 || r.bottom < 0 || r.top > window.innerHeight) continue;
      const d =
        r.top <= target && r.bottom >= target
          ? 0
          : Math.min(Math.abs(r.top - target), Math.abs(r.bottom - target));
      if (!best || d < best.d) best = { id: c.tweet.id, d };
    }
    return best?.id ?? focal?.tweet?.id ?? null;
  }

  openMenu(
    targetId: string | null,
    anchor: { top: number; left: number; right: number; bottom: number },
    source: 'post' | 'bar' | 'fab',
  ): void {
    this.ui.ensure();
    this.scan();
    const id = targetId ?? this.visiblePostId();
    const t = id ? this.session.graph.tweets.get(id) : undefined;
    const st = useContent.getState();
    if (st.menu && st.menu.targetId === (t ? id : null) && st.menu.source === source) {
      st.set({ menu: null });
      return;
    }
    let info = null;
    if (t && id) {
      const plan = this.session.plan('thread', id);
      info = {
        handle: t.author.handle,
        name: t.author.name,
        preview: truncate(postPreviewText(t).replace(/\s+/g, ' '), 120),
        threadCount: plan.tweetIds.length,
        status: plan.completeness.status,
        saved: this.saved.has(id),
        isFocal: this.session.lastScan?.focalId === id,
        platform: this.adapter.id,
        onStatusPage: this.session.lastScan?.route.kind === 'status',
      };
    }
    st.set({
      panelOpen: false,
      menu: {
        targetId: t ? id : null,
        anchor: { top: anchor.top, left: anchor.left, right: anchor.right, bottom: anchor.bottom },
        source,
        info,
      },
    });
  }

  closeMenu(): void {
    useContent.getState().set({ menu: null });
  }

  async menuAction(action: MenuAction): Promise<void> {
    const st = useContent.getState();
    const id = st.menu?.targetId ?? null;
    st.set({ menu: null });
    switch (action) {
      case 'save-thread':
        await this.save('thread', id);
        break;
      case 'save-tweet':
        await this.save('tweet', id);
        break;
      case 'save-references':
        await this.save('references', id);
        break;
      case 'copy-thread':
        await this.copy('thread', id, 'markdown');
        break;
      case 'copy-tweet':
        await this.copy('tweet', id, 'markdown');
        break;
      case 'copy-text':
        await this.copy('thread', id, 'text');
        break;
      case 'read':
        await this.read('thread', id);
        break;
      case 'options':
        this.openPanel(id, 'thread');
        break;
      case 'select':
        this.openPanel(id, 'selection');
        this.setMode('selection');
        break;
      case 'library':
        await send({ type: 'open.library' }).catch((e) => this.handleError(e));
        break;
      case 'delete':
        if (id) st.set({ savedEntryId: this.saved.get(id) ?? null });
        await this.removeSaved();
        break;
      case 'diagnostics':
        try {
          const diag = this.diagnostics();
          // Also kept locally (last one only) so it can be read back without pasting.
          void chrome.storage.local.set({ lastDiagnostic: diag }).catch(() => undefined);
          await copyText(JSON.stringify(diag, null, 2));
          this.notify(
            'success',
            'Diagnostic copié',
            'Collez-le dans votre message : il ne contient aucun texte de publication.',
          );
        } catch (e) {
          this.handleError(e);
        }
        break;
    }
  }

  /** Structural description of the page for bug reports — no post text, no handles, no IDs. */
  diagnostics() {
    const describe = (el: Element) => {
      const attrs = Array.from(el.attributes)
        .filter(
          (a) =>
            ![
              'src',
              'href',
              'alt',
              'aria-label',
              'title',
              'style',
              'srcset',
              'id',
              'aria-labelledby',
            ].includes(a.name),
        )
        .map((a) =>
          [
            'class',
            'data-testid',
            'role',
            'data-block',
            'dir',
            'lang',
            'data-text',
            'contenteditable',
          ].includes(a.name)
            ? `${a.name}="${a.value.slice(0, 120)}"`
            : a.name,
        );
      const style = (el as HTMLElement).style;
      if (style?.fontWeight) attrs.push(`fontWeight=${style.fontWeight}`);
      if (style?.fontStyle) attrs.push(`fontStyle=${style.fontStyle}`);
      return `${el.tagName.toLowerCase()}[${attrs.join(' ')}]`;
    };
    const ancestry = (el: Element, stop: Element) => {
      const out: string[] = [];
      for (let e: Element | null = el; e && out.length < 25; e = e.parentElement) {
        out.push(describe(e));
        if (e === stop) break;
      }
      return out;
    };
    const doc = document;
    const testids = new Map<string, number>();
    doc.querySelectorAll('[data-testid]').forEach((el) => {
      const k = el.getAttribute('data-testid')!;
      testids.set(k, (testids.get(k) ?? 0) + 1);
    });
    const articles = Array.from(doc.querySelectorAll('article'));
    const first = articles.find((a) => !a.parentElement?.closest('article'));
    const shape = (el: Element | undefined, depth = 0, maxDepth = 6, maxKids = 6): string => {
      if (!el || depth > maxDepth) return '';
      const kids = Array.from(el.children)
        .filter((c) => c.tagName !== 'STYLE' && c.tagName !== 'SCRIPT')
        .slice(0, maxKids)
        .map((c) => shape(c, depth + 1, maxDepth, maxKids))
        .filter(Boolean);
      const attrs = [
        'role',
        'data-testid',
        'data-engagement-action',
        'data-article-part',
        'data-block',
        'aria-hidden',
        'dir',
      ]
        .filter((a) => el.hasAttribute(a))
        .map(
          (a) =>
            `${a}=${['data-testid', 'role', 'data-engagement-action', 'data-article-part', 'data-block'].includes(a) ? el.getAttribute(a) : ''}`,
        );
      const cls = (el.getAttribute('class') ?? '')
        .split(/\s+/)
        .filter((c) =>
          /^(absolute|w-0\.5|w-px|self-stretch|whitespace-pre-wrap|top-|-top-|bottom-|-bottom-|longform|public-Draft|DraftEditor)/.test(
            c,
          ),
        );
      return `${el.tagName.toLowerCase()}${attrs.length ? `[${attrs.join(' ')}]` : ''}${cls.length ? `.${cls.join('.')}` : ''}${kids.length ? `(${kids.join(',')})` : ''}`;
    };
    const scan = this.session.lastScan;
    return {
      threadshelf: chrome.runtime.getManifest().version,
      host: location.hostname,
      route: scan?.route.kind ?? 'unknown',
      layout: scan?.layout ?? 'unknown',
      htmlAttributes: Array.from(doc.documentElement.attributes).map((a) => a.name),
      counts: {
        articles: articles.length,
        topLevelArticles: articles.filter((a) => !a.parentElement?.closest('article')).length,
        listItems: doc.querySelectorAll('main ul > li').length,
        cellInnerDiv: doc.querySelectorAll('[data-testid="cellInnerDiv"]').length,
        engagementActions: doc.querySelectorAll('[data-engagement-action]').length,
        times: doc.querySelectorAll('time[datetime]').length,
      },
      testids: Object.fromEntries([...testids.entries()].slice(0, 40)),
      scan: scan
        ? {
            cells: scan.cells
              .map(
                (c) =>
                  `${c.kind}${c.isFocal ? '*' : ''}${c.connectorAbove ? '^' : ''}${c.connectorBelow ? 'v' : ''}`,
              )
              .join(' '),
            connectorsSeen: scan.connectorsSeen,
          }
        : null,
      firstArticleShape: shape(first),
      // Long-form X Articles: structure only (tags, test IDs, classes) — never any text.
      xArticle: (() => {
        const focalEl = scan?.cells.find((c) => c.isFocal)?.element ?? first;
        const count = (root: ParentNode | null | undefined, sel: string) =>
          root?.querySelectorAll(sel).length ?? 0;
        const tags = [
          'p',
          'h1',
          'h2',
          'h3',
          'h4',
          'pre',
          'code',
          'figure',
          'img',
          'ul',
          'ol',
          'blockquote',
          'hr',
          'section',
        ];
        const richRoots = Array.from(
          doc.querySelectorAll(
            '[data-article-part="body"], [data-testid*="rticle"], [data-testid*="ongform"], [data-testid*="RichText"], .public-DraftEditor-content, [data-contents="true"]',
          ),
        ).slice(0, 4);
        return {
          parts: Array.from(doc.querySelectorAll('[data-article-part]')).map((e) =>
            e.getAttribute('data-article-part'),
          ),
          articleTestids: [...testids.entries()].filter(([k]) =>
            /rticle|ongform|richtext|readview|card|draft/i.test(k),
          ),
          articleLinks: Array.from(doc.querySelectorAll('a[href*="/article/"]'))
            .map((a) =>
              (a.getAttribute('href') ?? '')
                .replace(/^https?:\/\/[^/]+/, '')
                .replace(/\/\d+/g, '/<id>')
                .replace(/^\/[A-Za-z0-9_]+\//, '/<handle>/'),
            )
            .slice(0, 8),
          draftBlocks: count(doc, '[data-block="true"]'),
          longformClasses: [
            ...new Set(
              Array.from(doc.querySelectorAll('[class*="longform"]')).flatMap((e) =>
                (e.getAttribute('class') ?? '')
                  .split(/\s+/)
                  .filter((c) => c.startsWith('longform')),
              ),
            ),
          ].slice(0, 20),
          focalTagCounts: Object.fromEntries(tags.map((t) => [t, count(focalEl, t)])),
          pageTagCounts: Object.fromEntries(
            tags.map((t) => [t, count(doc.querySelector('main') ?? doc, t)]),
          ),
          richRoots: richRoots.map((r) => shape(r, 0, 5, 4)),
          focalShape: shape(focalEl, 0, 9, 8),
          focalTestids: [
            ...new Set(
              Array.from(focalEl?.querySelectorAll('[data-testid]') ?? []).map((e) =>
                e.getAttribute('data-testid'),
              ),
            ),
          ],
          // Where the text lives: ancestry of the elements holding the most text (lengths only).
          textHosts: (() => {
            const own = (el: Element) =>
              Array.from(el.childNodes)
                .filter((n) => n.nodeType === Node.TEXT_NODE)
                .reduce((n, t) => n + (t.textContent?.trim().length ?? 0), 0);
            const all = Array.from((focalEl ?? doc.body).querySelectorAll('*'))
              .map((el) => ({ el, n: own(el) }))
              .filter((x) => x.n > 40)
              .sort((a, b) => b.n - a.n)
              .slice(0, 5);
            return all.map(({ el, n }) => ({ chars: n, path: ancestry(el, focalEl ?? doc.body) }));
          })(),
          firstImagePath: (() => {
            const img = (focalEl ?? doc).querySelector('img[src*="/media/"]');
            return img ? ancestry(img, focalEl ?? doc.body) : null;
          })(),
          textBlocksNearImage: (() => {
            // Siblings of the image's block container: their tag / attributes / class names.
            const img = (focalEl ?? doc).querySelector('img[src*="/media/"]');
            let el: Element | null | undefined = img;
            for (let i = 0; el && i < 12; i++) {
              const sibs = el.parentElement ? Array.from(el.parentElement.children) : [];
              if (sibs.length >= 4)
                return sibs
                  .slice(0, 12)
                  .map((c) => describe(c) + `{text:${(c.textContent ?? '').trim().length}}`);
              el = el.parentElement;
            }
            return null;
          })(),
        };
      })(),
      stats: this.debugInfo(),
    };
  }

  openPanel(targetId: string | null, mode?: CaptureMode): void {
    this.ui.ensure();
    const st = useContent.getState();
    const focal = targetId ?? this.focalId();
    st.set({
      panelOpen: true,
      targetId: focal,
      mode: mode ?? st.mode,
      savedEntryId: focal ? (this.saved.get(focal) ?? null) : null,
    });
    this.refreshPreview();
    this.refreshButtons();
    void this.loadLists();
  }

  closePanel(): void {
    useContent.getState().set({ panelOpen: false, targetId: null, selection: [] });
    this.refreshButtons();
  }

  setMode(mode: CaptureMode): void {
    const st = useContent.getState();
    st.set({
      mode,
      selection:
        mode === 'selection' && st.targetId && !st.selection.length ? [st.targetId] : st.selection,
    });
    this.refreshPreview();
    this.refreshButtons();
  }

  async loadLists(): Promise<void> {
    try {
      const lists = await send({ type: 'meta.lists' });
      useContent.getState().set({ collections: lists.collections, categories: lists.categories });
    } catch (e) {
      this.handleError(e, true);
    }
  }

  private focalId(): string | null {
    return this.session.lastScan?.focalId ?? this.adapter.routeId(location.href) ?? null;
  }

  private refreshPreview(): void {
    const st = useContent.getState();
    if (!st.panelOpen || !st.targetId) return;
    const mode = st.mode === 'selection' ? 'thread' : st.mode;
    if (!this.session.graph.tweets.has(st.targetId)) return;
    const plan = this.session.plan(mode, st.targetId);
    const t = this.session.graph.tweets.get(st.targetId)!;
    const preview: PanelPreview = {
      focalId: st.targetId,
      handle: t.author.handle,
      name: t.author.name,
      posts: plan.tweetIds.map((id) => {
        const p = this.session.graph.tweets.get(id)!;
        return {
          id,
          handle: p.author.handle,
          text: truncate(postPreviewText(p).replace(/\s+/g, ' '), 140),
          media: p.media.length,
        };
      }),
      completeness: plan.completeness,
      references: this.session
        .plan('references', st.targetId)
        .externalRefs.map((r) => ({ url: r.url, captured: r.captured, kind: r.kind })),
    };
    st.set({ preview, savedEntryId: this.saved.get(st.targetId) ?? st.savedEntryId });
  }

  /* ------------------------------------------------------------------ actions ------------------------------------------------------------------ */

  private notify(
    tone: 'success' | 'warning' | 'error' | 'info',
    title: string,
    description?: string,
    action?: { label: string; run: () => void },
  ): void {
    if (tone !== 'error' && this.settings && !this.settings.notifications) return;
    this.ui.ensure();
    useContent.getState().pushToast({ tone, title, description, action });
  }

  private handleError(e: unknown, silent = false): string {
    const msg = e instanceof Error ? e.message : String(e);
    if (/context invalidated|mis à jour/i.test(msg)) {
      this.shutdown('Rechargez la page pour continuer à utiliser ThreadShelf.');
      return msg;
    }
    if (!silent) this.notify('error', 'ThreadShelf', msg);
    return msg;
  }

  private ensureFresh(id?: string | null): string | null {
    this.scan();
    return id ?? this.focalId();
  }

  async save(
    mode: CaptureMode,
    targetId?: string | null,
    opts: { silent?: boolean; live?: boolean } = {},
  ): Promise<RunResult> {
    const id = this.ensureFresh(targetId);
    if (!id || !this.session.graph.tweets.has(id)) {
      const error =
        this.adapter.id === 'reddit'
          ? 'Aucun post détecté. Ouvrez un post Reddit.'
          : 'Aucune publication détectée. Ouvrez une publication sur X.';
      if (!opts.silent) this.notify('warning', error);
      return { ok: false, error };
    }
    const st = useContent.getState();
    const selection =
      mode === 'selection' ? (st.selection.length ? st.selection : [id]) : undefined;
    const orderedSelection = selection
      ? [...selection].sort((a, b) => this.session.order.indexOf(a) - this.session.order.indexOf(b))
      : undefined;
    const plan = this.session.plan(mode, id, orderedSelection);
    const payload = this.session.payload(plan, id);
    const form = st.form;
    const usePanel = st.panelOpen && st.targetId === id;
    st.set({ busy: true });
    try {
      const result = await send({
        type: 'capture.save',
        payload: {
          mode,
          focalId: id,
          ...payload,
          selection: orderedSelection,
          pageUrl: location.href,
          pageKind: this.session.lastScan?.route.kind,
          reddit: this.session.lastScan?.reddit,
          options: {
            entryId: opts.live ? st.live?.entryId : undefined,
            collectionId: usePanel && form.collectionId ? form.collectionId : undefined,
            categoryId: usePanel && form.categoryId ? form.categoryId : undefined,
            tags: usePanel && form.tags ? form.tags.split(/[,\s]+/).filter(Boolean) : undefined,
            note: usePanel && form.note ? form.note : undefined,
          },
        },
      });
      for (const tid of result.entry.tweetIds) this.saved.set(tid, result.entry.id);
      st.set({ savedEntryId: result.entry.id });
      const incomplete =
        result.entry.kind === 'thread' && result.entry.completeness.status !== 'complete';
      if (!opts.silent) {
        this.notify(
          incomplete ? 'warning' : 'success',
          result.message,
          incomplete ? this.words.loadMoreHint : undefined,
          {
            label: 'Ouvrir dans le lecteur',
            run: () => void send({ type: 'open.reader', entryId: result.entry.id }),
          },
        );
      } else if (opts.live) {
        this.notify(
          'info',
          this.words.updated(result.count),
          result.entry.completeness.status === 'complete'
            ? this.adapter.id === 'reddit'
              ? 'Tous les commentaires sont chargés.'
              : 'Thread complet et vérifié.'
            : undefined,
        );
      }
      if (mode === 'thread' && incomplete && !opts.live)
        this.startLive(result.entry.id, result.count);
      if (mode === 'thread' && !incomplete) this.stopLive();
      if (st.live && opts.live) st.set({ live: { entryId: result.entry.id, count: result.count } });
      this.refreshButtons();
      return { ok: true, message: result.message };
    } catch (e) {
      const error = this.handleError(e, opts.silent);
      return { ok: false, error };
    } finally {
      st.set({ busy: false });
      this.refreshPreview();
    }
  }

  private startLive(entryId: string, count: number): void {
    if (!this.settings?.autoDetect) return;
    this.liveStartedAt = Date.now();
    this.liveSignature = '';
    useContent.getState().set({ live: { entryId, count } });
  }

  private stopLive(): void {
    if (this.liveTimer) clearTimeout(this.liveTimer);
    this.liveTimer = null;
    useContent.getState().set({ live: null });
  }

  /** Progressive capture: while a saved thread is incomplete, new connected posts are added as they load. */
  private maybeLiveSave(): void {
    const live = useContent.getState().live;
    if (!live) return;
    if (Date.now() - this.liveStartedAt > LIVE_MAX_MS) return this.stopLive();
    const focal = [...this.saved.entries()].find(([, e]) => e === live.entryId)?.[0];
    if (!focal || !this.session.graph.tweets.has(focal)) return;
    const plan = this.session.plan('thread', focal);
    const sig = `${plan.tweetIds.join(',')}|${plan.completeness.status}`;
    if (!this.liveSignature) this.liveSignature = sig;
    if (sig === this.liveSignature || plan.tweetIds.length < live.count) return;
    this.liveSignature = sig;
    if (this.liveTimer) clearTimeout(this.liveTimer);
    this.liveTimer = setTimeout(
      () => void this.save('thread', focal, { silent: true, live: true }),
      LIVE_SAVE_DEBOUNCE_MS,
    );
  }

  async copy(
    mode: CaptureMode,
    targetId?: string | null,
    format?: 'markdown' | 'text',
  ): Promise<RunResult> {
    const id = this.ensureFresh(targetId);
    if (!id || !this.session.graph.tweets.has(id))
      return { ok: false, error: 'Aucune publication détectée.' };
    const st = useContent.getState();
    const selection = mode === 'selection' ? st.selection : undefined;
    const plan = this.session.plan(mode, id, selection);
    const bundle = this.session.ephemeralBundle(plan, id);
    if (!bundle) return { ok: false, error: 'Rien à copier.' };
    const f = format ?? this.settings?.copy.format ?? 'markdown';
    try {
      await copyText(render(f, bundle, { includeUrls: this.settings?.copy.includeUrls ?? true }));
      const n = plan.tweetIds.length;
      const message = this.words.copied(n, f === 'markdown' ? 'Markdown' : 'texte');
      const incomplete = plan.kind === 'thread' && plan.completeness.status !== 'complete';
      this.notify(
        incomplete ? 'warning' : 'success',
        message,
        incomplete ? this.words.loadMoreHint : undefined,
      );
      return { ok: true, message };
    } catch (e) {
      return { ok: false, error: this.handleError(e) };
    }
  }

  async read(mode: CaptureMode, targetId?: string | null): Promise<RunResult> {
    const id = this.ensureFresh(targetId);
    if (!id) return { ok: false, error: 'Aucune publication détectée.' };
    let entryId = this.saved.get(id);
    if (!entryId || mode !== 'tweet') {
      const r = await this.save(mode, id, { silent: true });
      if (!r.ok) return r;
      entryId = this.saved.get(id);
    }
    if (!entryId) return { ok: false, error: 'Enregistrement impossible.' };
    try {
      await send({ type: 'open.reader', entryId });
      return { ok: true, message: 'Lecteur ouvert' };
    } catch (e) {
      return { ok: false, error: this.handleError(e) };
    }
  }

  async removeSaved(): Promise<void> {
    const st = useContent.getState();
    const entryId = st.savedEntryId;
    if (!entryId) return;
    if (!confirm('Supprimer cette sauvegarde de ThreadShelf ?')) return;
    try {
      await send({ type: 'entry.delete', ids: [entryId] });
      for (const [tid, e] of this.saved) if (e === entryId) this.saved.delete(tid);
      st.set({ savedEntryId: null });
      this.stopLive();
      this.notify('success', 'Sauvegarde supprimée');
      this.refreshButtons();
    } catch (e) {
      this.handleError(e);
    }
  }

  /* ------------------------------------------------------------------ messages ------------------------------------------------------------------ */

  private onSavedPage(): boolean {
    const path = location.pathname.replace(/\/$/, '');
    return this.adapter.id === 'x'
      ? path === '/i/bookmarks'
      : /^\/(?:u|user)\/[^/]+\/saved$/i.test(path);
  }

  private async drainSavedImport(): Promise<void> {
    if (this.savedImportBusy || !this.savedImportRunning) return;
    this.savedImportBusy = true;
    try {
      for (const id of this.savedPageIds) {
        if (!this.savedImportRunning || !this.onSavedPage()) break;
        if (this.savedImportProcessed.has(id)) continue;
        const tweet = this.session.graph.tweets.get(id);
        if (!tweet) continue;
        this.savedImportProcessed.add(id);
        try {
          const result = await send({
            type: 'capture.save',
            payload: { mode: 'tweet', focalId: id, tweets: [tweet], relations: [],
              pageUrl: location.href, pageKind: 'home',
              options: { tags: [`import-${this.adapter.id}`], readLater: true } },
          });
          this.saved.set(id, result.entry.id);
          this.savedImportDone++;
        } catch {
          this.savedImportFailed++;
        }
      }
    } finally {
      this.savedImportBusy = false;
    }
  }

  private toggleSavedImport(): RunResult {
    if (!this.onSavedPage()) return { ok: false, error: 'Ouvrez la page Favoris de X ou Enregistrés de Reddit.' };
    this.scan();
    this.savedImportRunning = !this.savedImportRunning;
    if (this.savedImportRunning) {
      void this.drainSavedImport();
      return { ok: true, message: 'Import lancé. Faites défiler la liste pour charger vos anciens favoris.' };
    }
    return { ok: true, message: `${this.savedImportDone} favoris importés, ${this.savedImportFailed} erreurs. Import arrêté.` };
  }

  state(): ContentState {
    const scan = this.session.lastScan ?? (this.active ? this.scan() : null);
    const focalId = scan?.focalId;
    const state: ContentState = {
      active: this.active,
      platform: this.adapter.id,
      supported: !!scan && scan.layout !== 'unknown',
      layout: scan?.layout ?? 'unknown',
      route: scan?.route.kind ?? 'other',
      detected: scan?.cells.filter((c) => c.tweet).length ?? 0,
      ...(this.onSavedPage() ? { savedImport: {
        running: this.savedImportRunning,
        seen: this.savedPageIds.size,
        imported: this.savedImportDone,
        failed: this.savedImportFailed,
      } } : {}),
      debug: this.debugInfo(),
    };
    if (focalId) {
      const t = this.session.graph.tweets.get(focalId);
      if (t) {
        const plan = this.session.plan('thread', focalId);
        state.focal = {
          id: focalId,
          handle: t.author.handle,
          name: t.author.name,
          preview: truncate(postPreviewText(t).replace(/\s+/g, ' '), 160),
          threadCount: plan.tweetIds.length,
          status: plan.completeness.status,
          savedEntryId: this.saved.get(focalId),
        };
      }
    }
    return state;
  }

  private onMessage = (
    raw: unknown,
    sender: chrome.runtime.MessageSender,
    sendResponse: (r: unknown) => void,
  ): boolean | undefined => {
    if (sender.id !== chrome.runtime.id) return undefined;
    const parsed = contentMessageSchema.safeParse(raw);
    if (!parsed.success) return undefined;
    const msg: ContentMessage = parsed.data;
    if (msg.type === 'content.state') {
      if (this.active) this.scan();
      sendResponse(this.state());
      return undefined;
    }
    if (!this.active) {
      sendResponse({ ok: false, error: 'ThreadShelf est désactivé sur ce site.' });
      return undefined;
    }
    void this.run(msg).then(sendResponse);
    return true;
  };

  async run(msg: ContentMessage): Promise<RunResult> {
    if (msg.type === 'content.save-link') {
      const refId = this.adapter.routeId(msg.url);
      if (!refId) return { ok: false, error: 'Lien non reconnu.' };
      const ref = { id: refId };
      this.scan();
      if (!this.session.graph.tweets.has(ref.id)) {
        this.notify(
          'warning',
          'Publication non affichée',
          'Ouvrez-la ou faites-la apparaître à l’écran pour l’enregistrer.',
        );
        return { ok: false, error: 'Publication non affichée.' };
      }
      return this.save('tweet', ref.id);
    }
    if (msg.type !== 'content.run') return { ok: false };
    const id = msg.tweetId ?? null;
    switch (msg.action) {
      case 'save-thread':
        return this.save('thread', id);
      case 'save-tweet':
        return this.save('tweet', id);
      case 'save-references':
        return this.save('references', id);
      case 'copy-thread':
        return this.copy('thread', id);
      case 'copy-tweet':
        return this.copy('tweet', id);
      case 'open-reader':
        return this.read('thread', id);
      case 'open-panel':
        this.openPanel(id, 'thread');
        return { ok: true };
      case 'rescan':
        this.scan();
        return { ok: true };
      case 'import-saved-visible':
        return this.toggleSavedImport();
    }
  }

  /** Test / diagnostics hook. */
  debugInfo() {
    return {
      ...this.stats,
      tweets: this.session.graph.tweets.size,
      relations: this.session.graph.relations.size,
      buttons: this.buttons.size,
      observing: !!this.observer,
      layout: this.session.lastScan?.layout,
    };
  }
}

export { MessagingError };

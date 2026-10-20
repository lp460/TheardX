/**
 * Small vanilla elements injected next to X's own controls, each isolated in its own Shadow DOM.
 * They never replace or hide native controls; they are appended after them.
 */

const LOGO = `<svg viewBox="0 0 32 32" width="18" height="18" aria-hidden="true"><rect x="1" y="1" width="30" height="30" rx="8.5" fill="currentColor" opacity=".14"/><rect x="8" y="8" width="16" height="3.2" rx="1.6" fill="currentColor"/><rect x="8" y="13.6" width="12" height="3.2" rx="1.6" fill="currentColor" opacity=".8"/><rect x="8" y="19.2" width="8" height="3.2" rx="1.6" fill="currentColor" opacity=".6"/></svg>`;
const CHECK = `<svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`;

const BASE_CSS = `
:host{all:initial;display:inline-flex;align-items:center;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
button{all:unset;box-sizing:border-box;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px;transition:background-color .15s,color .15s,opacity .15s}
button:focus-visible{outline:2px solid #7c6cf2;outline-offset:2px}
@media (prefers-reduced-motion:reduce){button{transition:none}}
`;

export type Tone = 'light' | 'dark';

export function palette(tone: Tone) {
  return tone === 'dark'
    ? {
        fg: '#e7e9ea',
        muted: '#8b98a5',
        accent: '#a89cff',
        hover: 'rgba(168,156,255,.14)',
        border: 'rgba(255,255,255,.12)',
        bg: 'rgba(255,255,255,.04)',
      }
    : {
        fg: '#0f1419',
        muted: '#536471',
        accent: '#6857e8',
        hover: 'rgba(104,87,232,.10)',
        border: 'rgba(15,20,25,.10)',
        bg: 'rgba(15,20,25,.02)',
      };
}

/* ---------------------------------------------------------------- per-post button ---------------------------------------------------------------- */

export interface PostButtonState {
  saved: boolean;
  selecting: boolean;
  selected: boolean;
  tone: Tone;
}

export class PostButton {
  readonly host: HTMLElement;
  private btn: HTMLButtonElement;
  private styleEl: HTMLStyleElement;

  constructor(
    readonly tweetId: string,
    onClick: (id: string, anchor: HTMLElement) => void,
  ) {
    this.host = document.createElement('threadshelf-action');
    this.host.setAttribute('data-ts-id', tweetId);
    this.host.style.cssText =
      'display:inline-flex;align-items:center;margin-left:4px;flex:0 0 auto;';
    const root = this.host.attachShadow({ mode: 'open' });
    this.styleEl = document.createElement('style');
    this.btn = document.createElement('button');
    this.btn.type = 'button';
    this.btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick(this.tweetId, this.host);
    });
    // Keep X's article click handler (which opens the post) from firing.
    for (const ev of ['mousedown', 'mouseup', 'pointerdown', 'pointerup'])
      this.btn.addEventListener(ev, (e) => e.stopPropagation());
    root.append(this.styleEl, this.btn);
    this.update({ saved: false, selecting: false, selected: false, tone: 'light' });
  }

  update(s: PostButtonState): void {
    const p = palette(s.tone);
    this.styleEl.textContent = `${BASE_CSS}
button{position:relative;width:34px;height:34px;border-radius:999px;color:${s.selecting ? p.muted : p.accent}}
button:hover{background:${p.hover};color:${p.accent}}
.saved{position:absolute;right:5px;bottom:6px;width:7px;height:7px;border-radius:99px;background:#10b981;box-shadow:0 0 0 2px ${s.tone === 'dark' ? '#000' : '#fff'}}
.box{width:16px;height:16px;border-radius:5px;border:1.5px solid ${s.selected ? p.accent : p.muted};background:${s.selected ? p.accent : 'transparent'};color:#fff;display:inline-flex;align-items:center;justify-content:center}`;
    if (s.selecting) {
      this.btn.innerHTML = `<span class="box">${s.selected ? CHECK : ''}</span>`;
      this.btn.setAttribute(
        'aria-label',
        s.selected ? 'Retirer de la sélection ThreadShelf' : 'Ajouter à la sélection ThreadShelf',
      );
      this.btn.setAttribute('aria-pressed', String(s.selected));
    } else {
      this.btn.innerHTML = LOGO;
      this.btn.setAttribute(
        'aria-label',
        s.saved ? 'ThreadShelf — déjà enregistré' : 'ThreadShelf — enregistrer, copier, lire',
      );
      this.btn.removeAttribute('aria-pressed');
    }
    this.btn.title = this.btn.getAttribute('aria-label') ?? '';
  }
}

/* ---------------------------------------------------------------- focal-post bar ---------------------------------------------------------------- */

export interface BarState {
  tone: Tone;
  saved: boolean;
  count: number;
  status: 'complete' | 'incomplete' | 'single' | 'busy';
}

export interface BarHandlers {
  save: () => void;
  copy: () => void;
  read: () => void;
  more: (anchor: HTMLElement) => void;
}

/** CaptureAction — "ThreadShelf · Enregistrer | Copier | Lire" under the opened post. */
export class CaptureBar {
  readonly host: HTMLElement;
  private root: ShadowRoot;
  private styleEl: HTMLStyleElement;
  private wrap: HTMLDivElement;

  constructor(
    readonly tweetId: string,
    private handlers: BarHandlers,
  ) {
    this.host = document.createElement('threadshelf-bar');
    this.host.setAttribute('data-ts-id', tweetId);
    this.host.style.cssText = 'display:block;margin:8px 0 2px;';
    this.root = this.host.attachShadow({ mode: 'open' });
    this.styleEl = document.createElement('style');
    this.wrap = document.createElement('div');
    this.wrap.className = 'bar';
    this.wrap.setAttribute('role', 'toolbar');
    this.wrap.setAttribute('aria-label', 'ThreadShelf');
    this.root.append(this.styleEl, this.wrap);
    for (const ev of ['click', 'mousedown', 'mouseup', 'pointerdown', 'pointerup'])
      this.wrap.addEventListener(ev, (e) => e.stopPropagation());
  }

  update(s: BarState): void {
    const p = palette(s.tone);
    this.styleEl.textContent = `${BASE_CSS}
:host{display:block}
.bar{display:flex;align-items:center;gap:2px;height:34px;padding:0 4px 0 10px;border:1px solid ${p.border};border-radius:999px;background:${p.bg};width:max-content;max-width:100%;color:${p.fg};font-size:13px;animation:in .2s ease-out}
@keyframes in{from{opacity:0;transform:translateY(-2px)}to{opacity:1;transform:none}}
.brand{display:inline-flex;align-items:center;gap:6px;color:${p.accent};font-weight:600;margin-right:6px;letter-spacing:-.01em}
.sep{width:1px;height:16px;background:${p.border};margin:0 2px}
button{height:26px;padding:0 10px;border-radius:999px;font-weight:500;color:${p.fg};font-size:13px}
button:hover{background:${p.hover};color:${p.accent}}
button.primary{color:${p.accent}}
.meta{color:${p.muted};font-size:12px;margin:0 6px 0 4px;white-space:nowrap}
.dot{width:6px;height:6px;border-radius:99px;display:inline-block;margin-right:5px;background:${s.status === 'complete' ? '#10b981' : s.status === 'incomplete' ? '#f59e0b' : p.muted}}
@media (prefers-reduced-motion:reduce){.bar{animation:none}}`;
    const label = s.saved ? 'Mettre à jour' : 'Enregistrer';
    const meta =
      s.status === 'busy'
        ? 'Enregistrement…'
        : s.count > 1
          ? `${s.count} publications${s.status === 'incomplete' ? ' · incomplet' : ''}`
          : s.saved
            ? 'Enregistré'
            : '';
    this.wrap.innerHTML = `<span class="brand">${LOGO}ThreadShelf</span>
<button class="primary" data-act="save" aria-label="${label} le thread">${label}</button><span class="sep"></span>
<button data-act="copy" aria-label="Copier le thread">Copier</button><span class="sep"></span>
<button data-act="read" aria-label="Lire dans ThreadShelf">Lire</button><span class="sep"></span>
<button data-act="more" aria-label="Toutes les actions ThreadShelf" aria-haspopup="menu">•••</button>
${meta ? `<span class="meta">${s.status !== 'busy' ? '<span class="dot"></span>' : ''}${meta}</span>` : ''}`;
    this.wrap.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
      b.type = 'button';
      b.addEventListener('click', (e) => {
        e.preventDefault();
        const act = b.dataset.act;
        if (act === 'save') this.handlers.save();
        if (act === 'copy') this.handlers.copy();
        if (act === 'read') this.handlers.read();
        if (act === 'more') this.handlers.more(b);
      });
    });
  }
}

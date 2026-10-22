import type { EntryBundle, Segment, Tweet } from '@/types/model';
import { cashtagUrl, hashtagUrl, linkLabel, profileUrl, safeHref } from '@/utils/url';
import { articleToHtml, textIsOnlyArticleLink } from './article';
import { dayString, mediaLabel, toView, type ExportOptions } from './model';

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function a(href: string | null, label: string): string {
  if (!href) return escapeHtml(label);
  return `<a href="${escapeHtml(href)}" rel="noopener noreferrer nofollow" target="_blank">${escapeHtml(label)}</a>`;
}

export function segmentsToHtml(segments: Segment[]): string {
  const html = segments
    .map((s) => {
      switch (s.t) {
        case 'text': {
          const v = escapeHtml(s.v);
          if (s.b && s.i) return `<strong><em>${v}</em></strong>`;
          if (s.b) return `<strong>${v}</strong>`;
          if (s.i) return `<em>${v}</em>`;
          return v;
        }
        case 'link':
          return a(safeHref(s.href), linkLabel(s.v, s.href));
        case 'mention':
          return a(profileUrl(s.handle), s.v);
        case 'hashtag':
          return a(hashtagUrl(s.tag), s.v);
        case 'cashtag':
          return a(cashtagUrl(s.tag), s.v);
      }
    })
    .join('');
  return html
    .split(/\n{2,}/)
    .map((p) => `<p>${p.split('\n').join('<br>')}</p>`)
    .join('');
}

function img(url: string, alt: string | undefined, opts: ExportOptions): string {
  const src = (opts.embedImages && opts.dataUris?.[url]) || safeHref(url) || '';
  return `<figure><img src="${escapeHtml(src)}" alt="${escapeHtml(alt ?? '')}" loading="lazy">${alt ? `<figcaption>${escapeHtml(alt)}</figcaption>` : ''}</figure>`;
}

function post(t: Tweet, opts: ExportOptions, index?: string): string {
  const parts: string[] = [];
  if (index) parts.push(`<div class="num">${escapeHtml(index)}</div>`);
  if (!textIsOnlyArticleLink(t)) parts.push(`<div class="text">${segmentsToHtml(t.text)}</div>`);
  if (t.article)
    parts.push(
      articleToHtml(t.article, segmentsToHtml, escapeHtml, (url, alt) => img(url, alt, opts)),
    );
  if (t.textTruncated)
    parts.push('<p class="muted">Texte tronqué sur la page au moment de la capture.</p>');
  for (const m of t.media) {
    if (m.kind === 'photo') parts.push(img(m.url, m.alt, opts));
    else
      parts.push(
        `<p class="media-ref">${a(safeHref(m.playbackUrl ?? t.url), `${mediaLabel(m.kind)} — voir sur X`)}</p>`,
      );
  }
  if (t.card && !t.article) {
    parts.push(
      `<p class="card">${a(safeHref(t.card.url), t.card.title ?? t.card.domain ?? t.card.url)}${t.card.domain ? ` <span class="muted">${escapeHtml(t.card.domain)}</span>` : ''}</p>`,
    );
  }
  if (t.quoted) {
    const q = t.quoted;
    parts.push(
      `<blockquote><div class="q-head">${q.author ? `${escapeHtml(q.author.name ?? '')} <span class="muted">@${escapeHtml(q.author.handle)}</span>` : 'Publication citée'}</div>${q.text ? segmentsToHtml(q.text) : '<p class="muted">Contenu non disponible</p>'}${(
        q.media ?? []
      )
        .filter((m) => m.kind === 'photo')
        .map((m) => img(m.url, m.alt, opts))
        .join(
          '',
        )}${q.url ? `<div class="muted">${a(safeHref(q.url), 'Source')}</div>` : ''}</blockquote>`,
    );
  }
  if (opts.includeUrls !== false)
    parts.push(
      `<div class="link">${a(safeHref(t.url), 'Voir la publication sur X')}${t.createdAt ? ` · ${escapeHtml(dayString(t.createdAt))}` : ''}</div>`,
    );
  return `<article>${parts.join('')}</article>`;
}

const CSS = `
:root{color-scheme:light dark;--bg:#fbfbfa;--fg:#1c1c1e;--muted:#6e6e73;--line:#e5e5ea;--accent:#6857e8;--quote:#f2f2f4}
@media (prefers-color-scheme:dark){:root{--bg:#141416;--fg:#ececf0;--muted:#9a9aa2;--line:#2c2c30;--accent:#9d90ff;--quote:#1d1d21}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:19px/1.65 ui-serif,"New York",Georgia,serif;-webkit-font-smoothing:antialiased}
main{max-width:680px;margin:0 auto;padding:56px 24px 96px}header{margin-bottom:40px;border-bottom:1px solid var(--line);padding-bottom:24px}
h1{font:600 1.7em/1.25 -apple-system,system-ui,sans-serif;letter-spacing:-.02em;margin:0 0 12px}
.meta{font:14px/1.6 -apple-system,system-ui,sans-serif;color:var(--muted)}.warn{margin-top:12px;padding:10px 14px;border-radius:10px;background:rgba(245,158,11,.12);font:14px -apple-system,system-ui,sans-serif}
article{padding:20px 0;border-bottom:1px solid var(--line)}.num{font:600 12px -apple-system,system-ui,sans-serif;color:var(--muted);letter-spacing:.06em;margin-bottom:8px}
p{margin:0 0 .8em}a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
figure{margin:16px 0}img{max-width:100%;height:auto;border-radius:12px;display:block}figcaption{font:14px/1.5 -apple-system,system-ui,sans-serif;color:var(--muted);margin-top:6px}
pre{overflow-x:auto;padding:12px 14px;border-radius:10px;background:var(--quote);font:13px/1.55 ui-monospace,Menlo,monospace}code{font-family:ui-monospace,Menlo,monospace}.article h2{font:600 1.35em/1.3 -apple-system,system-ui,sans-serif;margin:18px 0 6px}.article h3,.article h4,.article h5{font:600 1.1em/1.35 -apple-system,system-ui,sans-serif;margin:22px 0 6px}hr{border:none;border-top:1px solid var(--line);margin:24px auto;width:80px}blockquote{margin:16px 0;padding:14px 16px;border-radius:12px;background:var(--quote);font-size:.92em}.q-head{font:600 14px -apple-system,system-ui,sans-serif;margin-bottom:6px}
.muted{color:var(--muted)}.link,.media-ref,.card{font:14px -apple-system,system-ui,sans-serif}.context{opacity:.8}
footer{margin-top:40px;font:13px -apple-system,system-ui,sans-serif;color:var(--muted)}
@media print{body{background:#fff;color:#000;font-size:12pt}main{max-width:none;padding:0}article{break-inside:avoid}a{color:#000}}
`;

/** Standalone HTML document: inline CSS, no script, strict CSP. */
export function toHtml(b: EntryBundle, opts: ExportOptions = {}): string {
  const v = toView(b, opts);
  const total = v.posts.length;
  const body: string[] = [];
  body.push(
    `<header><h1>${escapeHtml(v.title || `Publication de @${v.author.handle}`)}</h1><div class="meta">${v.author.name ? `${escapeHtml(v.author.name)} · ` : ''}${a(profileUrl(v.author.handle), `@${v.author.handle}`)}${v.publishedAt ? ` · ${escapeHtml(dayString(v.publishedAt))}` : ''}<br>${escapeHtml(v.statusLine)} · ${a(safeHref(v.sourceUrl), 'Source')}</div>${v.incomplete ? '<div class="warn">Ce thread n’a pas pu être vérifié comme complet.</div>' : ''}</header>`,
  );
  if (v.context.length) {
    body.push(
      `<section class="context"><div class="meta">En réponse à</div>${v.context.map((c) => post(c, opts)).join('')}</section>`,
    );
  }
  v.posts.forEach((t, i) =>
    body.push(post(t, opts, total > 1 ? `${i + 1} / ${total}` : undefined)),
  );
  if (v.references.length)
    body.push(`<h2 class="meta">Références</h2>${v.references.map((r) => post(r, opts)).join('')}`);
  if (v.note.trim())
    body.push(
      `<section><h2 class="meta">Note personnelle</h2>${segmentsToHtml([{ t: 'text', v: v.note.trim() }])}</section>`,
    );
  body.push(
    `<footer>Exporté avec ThreadShelf le ${escapeHtml(dayString(Date.now()))}. Contenu publié par son auteur sur X.</footer>`,
  );
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: https:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<meta name="referrer" content="no-referrer">
<title>${escapeHtml(v.title || 'ThreadShelf')}</title><style>${CSS}</style></head>
<body><main>${body.join('\n')}</main></body></html>
`;
}

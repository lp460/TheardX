/**
 * Deterministic X-like DOM fixtures.
 *
 * - `xds` reproduces the structure of X's current web layout as observed on x.com in October 2026
 *   (utility classes, data-engagement-action, main ul > li > article, nested quote article,
 *   absolute 2px connector spans in the avatar column, timestamp in an inline script).
 * - `classic` reproduces the long-standing React Native Web layout (data-testid attributes).
 *
 * All texts, handles and IDs are synthetic.
 */

export interface PostSpec {
  id: string;
  handle: string;
  name?: string;
  text?: string;
  timestamp?: number;
  photos?: { alt?: string; w?: number; h?: number; key?: string }[];
  video?: boolean;
  gif?: boolean;
  quote?: PostSpec;
  card?: { url: string; title: string; domain: string };
  above?: boolean;
  below?: boolean;
  replyingTo?: string[];
  truncated?: boolean;
  verified?: boolean;
  /** Long-form X Article: body HTML reproduces X's markup (p/span, h3, hr, figure, code blocks). */
  article?: { title: string; body: string; cover?: boolean; full?: boolean };
}

/** A code block as X renders it inside an Article. */
export function articleCode(lang: string, lines: string[]): string {
  return `<div><div class="flex"><span>${esc(lang)}</span><button data-slot="xds-button" aria-label="Copier le code" type="button"><span><svg></svg></span></button></div><div><pre tabindex="0"><code>${lines.map((l) => `<span><span>${esc(l)}</span></span>`).join('\n')}</code></pre></div></div>`;
}

function xdsArticleBlock(p: PostSpec): string {
  const a = p.article!;
  if (a.full === false) {
    return `<div><a href="/${p.handle}/article/${p.id}"><div><img alt="" src="https://pbs.twimg.com/media/Cover${p.id}?format=jpg&amp;name=small"></div><div>${esc(a.title)}</div></a></div>`;
  }
  const cover =
    a.cover === false
      ? ''
      : `<div data-article-part="cover"><img alt="Image de couverture de l'Article " src="https://pbs.twimg.com/media/Cover${p.id}?format=webp&amp;name=medium"></div>`;
  return `<!--$--><div><div>${cover}<h1 data-article-part="title" dir="auto">${esc(a.title)}</h1><div data-article-part="byline"><span><span>7 min de lecture</span></span></div><div data-article-part="body"><style>.x{color:red}</style><div><div>${a.body}</div></div></div></div></div>`;
}

export type CellSpec = PostSpec | { tombstone: string } | { gap: string };

export type Layout = 'xds' | 'classic';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const TOKEN_RE = /(https?:\/\/[^\s]+)|(@[A-Za-z0-9_]{1,15})|(#[\p{L}\p{N}_]+)|(\$[A-Z]{1,6}\b)/gu;

let tco = 0;
function shortCode(): string {
  tco += 1;
  return `Fx${tco.toString(36).padStart(6, '0')}`;
}

function richText(text: string, layout: Layout): string {
  let out = '';
  let last = 0;
  for (const m of text.matchAll(TOKEN_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) out += `<span>${esc(text.slice(last, idx))}</span>`;
    const tok = m[0];
    if (m[1]) {
      const noProto = tok.replace(/^https?:\/\//, '');
      const shown = noProto.length > 26 ? noProto.slice(0, 26) : noProto;
      const rest = noProto.slice(shown.length);
      if (layout === 'xds') {
        out += `<span><a class="x-link text-brand" href="${esc(tok)}" rel="noopener noreferrer" target="_blank">${esc(shown)}${rest ? '…' : ''}</a></span>`;
      } else {
        out += `<a dir="ltr" href="https://t.co/${shortCode()}" rel="noopener noreferrer nofollow" target="_blank" role="link" class="css-1jxf684"><span aria-hidden="true" class="css-1jxf684 r-qlhcfr">${esc(tok.slice(0, tok.length - noProto.length))}</span>${esc(shown)}<span aria-hidden="true" class="css-1jxf684 r-qlhcfr">${esc(rest)}</span>${rest ? '<span aria-hidden="true" class="css-1jxf684 r-qlhcfr">…</span>' : ''}</a>`;
      }
    } else if (m[2]) {
      out += `<span><a class="x-link text-brand" href="/${esc(tok.slice(1))}" role="link">${esc(tok)}</a></span>`;
    } else if (m[3]) {
      out += `<span><a class="x-link text-brand" href="/hashtag/${encodeURIComponent(tok.slice(1))}?src=hashtag_click" role="link">${esc(tok)}</a></span>`;
    } else if (m[4]) {
      out += `<span><a class="x-link text-brand" href="/search?q=%24${esc(tok.slice(1))}&amp;src=cashtag_click" role="link">${esc(tok)}</a></span>`;
    }
    last = idx + tok.length;
  }
  if (last < text.length) out += `<span>${esc(text.slice(last))}</span>`;
  return out;
}

const avatar = (handle: string) =>
  `https://pbs.twimg.com/profile_images/1000000000000000000/${handle}_normal.jpg`;
const photoUrl = (key: string) => `https://pbs.twimg.com/media/${key}?format=jpg&name=small`;

/* ------------------------------------------------------------------ XDS ------------------------------------------------------------------ */

function xdsArticle(p: PostSpec, nested = false): string {
  const name = p.name ?? p.handle;
  const ts = p.timestamp ?? 1_784_669_299_000;
  const conAbove = p.above
    ? '<span aria-hidden="true" class="absolute -top-3 left-1/2 h-8 w-0.5 -translate-x-1/2 bg-(--x-border-normal)"></span>'
    : '';
  const conBelow = p.below
    ? '<span aria-hidden="true" class="absolute top-5 -bottom-3 left-1/2 w-0.5 -translate-x-1/2 bg-(--x-border-normal)"></span>'
    : '';
  const verified = p.verified
    ? '<div class="flex shrink-0 items-center gap-1"><span aria-label="Compte certifié" role="button"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-verified-premium-color"></use></svg></span></div>'
    : '';
  const replying = p.replyingTo?.length
    ? `<div class="text-secondary">Répondre à ${p.replyingTo.map((h) => `<a class="x-link text-brand" href="/${h}"><span>@${h}</span></a>`).join(' ')}</div>`
    : '';
  const text = p.text
    ? `<div class="max-w-full text-body font-normal text-primary whitespace-pre-wrap wrap-break-word" dir="auto" lang="fr">${richText(p.text, 'xds')}</div>`
    : p.article
      ? // X renders an empty text container above an Article.
        '<div class="max-w-full text-lead font-normal text-primary whitespace-pre-wrap wrap-break-word" dir="auto"></div>'
      : '';
  const showMore = p.truncated
    ? '<button class="cursor-pointer text-brand" type="button">Afficher plus</button>'
    : '';
  const articleHtml = p.article ? xdsArticleBlock(p) : '';
  const photos = (p.photos ?? [])
    .map(
      (ph, i) =>
        `<div style="aspect-ratio:1.5"><div><div inert=""><img fetchpriority="low" height="${ph.h ?? 800}" width="${ph.w ?? 1200}" alt="${esc(ph.alt ?? '')}" decoding="async" loading="lazy" src="${photoUrl(ph.key ?? `P${p.id}x${i}`)}"></div><a aria-label="Voir le média" href="/${p.handle}/status/${p.id}/photo/${i + 1}"></a></div></div>`,
    )
    .join('');
  const video =
    p.video || p.gif
      ? `<div style="aspect-ratio:1.7777"><div style="aspect-ratio:1.7777"><div><video height="100%" width="100%" poster="https://pbs.twimg.com/${p.gif ? 'tweet_video_thumb' : 'amplify_video_thumb'}/V${p.id}/img/thumb.jpg" playsinline="" muted=""></video><div data-slot="xds-context-menu-trigger"><button type="button" aria-label="Lire"></button><div><img alt="" src="https://pbs.twimg.com/${p.gif ? 'tweet_video_thumb' : 'amplify_video_thumb'}/V${p.id}/img/thumb.jpg"></div></div></div></div></div>`
      : '';
  const card = p.card
    ? `<div class="mt-3 overflow-hidden rounded-2xl border"><a href="https://t.co/${shortCode()}" rel="noopener noreferrer" target="_blank"><div style="aspect-ratio:1.9"><img height="630" width="1200" alt="" src="https://pbs.twimg.com/card_img/C${p.id}/img?format=jpg&amp;name=medium"></div><div><div><div>${esc(p.card.title)}</div></div></div></a></div><a href="https://t.co/${shortCode()}" rel="noopener noreferrer" target="_blank"><div>De ${esc(p.card.domain)}</div></a>`
    : '';
  const cardFixed = p.card ? card.replace(/t\.co\/Fx[0-9a-z]+/g, `t.co/card${p.id}`) : '';
  const quote = p.quote
    ? `<div class="mt-3"><div class="rounded-2xl border" role="link" data-navigation-stop="" data-href="/${p.quote.handle}/status/${p.quote.id}" tabindex="0">${xdsArticle(p.quote, true)}</div></div>`
    : '';
  const engagement = nested
    ? ''
    : `<div class="border-normal my-2 border-t"></div><div class="-mx-2 flex h-5 min-h-5 items-center justify-between"><div class="min-w-0 flex-1" data-engagement-action="reply"><a class="x-link group x-engagement-button" aria-label="Répondre" href="/compose/post?in_reply_to=${p.id}"><span class="x-engagement-pill"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-reply-stroke"></use></svg><span>3</span></span></a></div><div class="min-w-0 flex-1" data-engagement-action="retweet"><button type="button" aria-label="Repost" class="x-engagement-button"><span>1</span></button></div><div class="min-w-0 flex-1" data-engagement-action="like"><button aria-label="Aimer" class="x-engagement-button" type="button"><span>12</span></button></div><div class="flex shrink-0 items-center"><div class=""><div class="min-w-0 flex-1" data-engagement-action="bookmark"><button aria-label="Ajouter aux signets" class="x-engagement-button" type="button"></button></div></div><button data-engagement-action="share" type="button" aria-label="Partager" class="x-engagement-button"></button></div></div>`;
  return `<article class="flex flex-col gap-1"><div class="flex flex-col gap-2"><div class="flex flex-col gap-3"><div class="flex gap-2"><div class="relative flex w-10 shrink-0 justify-center self-stretch">${conAbove}${conBelow}<div class="relative z-10"><a class="x-link rounded-none" href="/${p.handle}"><div class="x-avatar rounded-full size-10"><img draggable="false" alt="@${p.handle}" class="size-full object-cover" decoding="async" loading="lazy" src="${avatar(p.handle)}"></div></a></div></div><div class="flex min-w-0 flex-1 flex-col"><div class="flex items-start justify-between gap-2"><div class="flex flex-col items-start min-w-0"><span class="flex max-w-full min-w-0 shrink-0 items-center gap-1"><a class="rounded-xs x-link hover:underline" href="/${p.handle}"><div class="max-w-full text-body font-bold text-primary line-clamp-1">${esc(name)}</div></a>${verified}</span><span class="flex max-w-full min-w-0 items-center gap-2"><a class="rounded-xs x-link" href="/${p.handle}"><span class="text-secondary">@${p.handle}</span></a></span></div><span class="inline-flex w-fit"><a class="rounded-xs x-link text-secondary" data-base-ui-tooltip-trigger="" href="/${p.handle}/status/${p.id}">21 juil.</a><script nonce="">window.__xClientTextFormatters?.run("_R_${p.id}_", "formatRelativePastTimestamp", {"timestamp":${ts},"lang":"fr","nowLabel":"Maintenant","precision":"Hours"});</script></span><div class="flex shrink-0 items-center gap-1 whitespace-nowrap"><button data-slot="xds-menu-trigger" aria-label="Plus" type="button" class="x-button"><span class="x-button-slot"><svg viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-more"></use></svg></span></button></div></div></div></div>${replying}${text}${showMore}</div>${articleHtml}${photos}${video}${cardFixed}${quote}${engagement}</div></article>`;
}

function xdsCell(c: CellSpec, focalId?: string): string {
  if ('tombstone' in c)
    return `<li><div class="px-horizontal py-vertical"><div class="rounded-xl bg-subtle p-3 text-secondary">${esc(c.tombstone)}</div></div></li>`;
  if ('gap' in c)
    return `<li><div class="px-horizontal py-vertical"><button type="button" class="text-brand">${esc(c.gap)}</button></div></li>`;
  const focal = c.id === focalId;
  const wrap = focal
    ? `<div tabindex="-1" class="outline-focus transition-colors px-horizontal py-vertical" data-navigation-stop="">`
    : `<div role="link" data-href="/${c.handle}/status/${c.id}" tabindex="0" class="outline-focus transition-colors px-horizontal py-vertical" data-navigation-stop="">`;
  return `<li>${wrap}${xdsArticle(c)}</div></li>`;
}

export function xdsList(cells: CellSpec[], focalId?: string): string {
  return `<ul class="conversation">${cells.map((c) => xdsCell(c, focalId)).join('')}</ul>`;
}

/* ---------------------------------------------------------------- CLASSIC ---------------------------------------------------------------- */

const line = (pos: 'above' | 'below') =>
  pos === 'above'
    ? '<div class="css-175oi2r r-thread-top" style="width: 2px; height: 8px; margin: 0 auto; background-color: rgb(51, 54, 57);"></div>'
    : '<div class="css-175oi2r r-thread-bottom" style="width: 2px; flex-grow: 1; min-height: 20px; margin: 4px auto 0; background-color: rgb(51, 54, 57);"></div>';

function classicArticle(p: PostSpec, nested = false): string {
  const name = p.name ?? p.handle;
  const iso = new Date(p.timestamp ?? 1_784_669_299_000).toISOString();
  const text = p.text
    ? `<div lang="fr" dir="auto" data-testid="tweetText" class="css-146c3p1">${richText(p.text, 'classic')}${p.truncated ? '<button data-testid="tweet-text-show-more-link" type="button">Show more</button>' : ''}</div>`
    : '';
  const photos = (p.photos ?? [])
    .map(
      (ph, i) =>
        `<a href="/${p.handle}/status/${p.id}/photo/${i + 1}" role="link"><div data-testid="tweetPhoto"><img alt="${esc(ph.alt ?? 'Image')}" draggable="true" src="${photoUrl(ph.key ?? `P${p.id}x${i}`)}" class="css-9pa8cd"></div></a>`,
    )
    .join('');
  const video =
    p.video || p.gif
      ? `<div data-testid="videoPlayer"><div data-testid="videoComponent"><video preload="none" playsinline="" aria-label="Embedded video" poster="https://pbs.twimg.com/${p.gif ? 'tweet_video_thumb' : 'ext_tw_video_thumb'}/V${p.id}/pu/img/thumb.jpg" style="width:100%"></video></div></div>`
      : '';
  const card = p.card
    ? `<div data-testid="card.wrapper"><div data-testid="card.layoutLarge.media"><a href="https://t.co/card${p.id}" rel="noopener noreferrer nofollow" target="_blank" role="link" aria-label="${esc(p.card.domain)} ${esc(p.card.title)}"><img alt="" src="https://pbs.twimg.com/card_img/C${p.id}/img?format=jpg&amp;name=medium"></a></div><div data-testid="card.layoutLarge.detail"><div><span>${esc(p.card.domain)}</span></div><div><span>${esc(p.card.title)}</span></div></div></div>`
    : '';
  const quote = p.quote
    ? `<div aria-labelledby="q${p.id}" class="css-175oi2r"><div tabindex="0" class="css-175oi2r" role="link"><div class="css-175oi2r"><div data-testid="User-Name"><div><a href="/${p.quote.handle}" role="link"><span>${esc(p.quote.name ?? p.quote.handle)}</span></a></div><div><span>@${p.quote.handle}</span><time datetime="${new Date(p.quote.timestamp ?? 1_784_000_000_000).toISOString()}">Jul 10</time></div></div><div data-testid="Tweet-User-Avatar"><img src="${avatar(p.quote.handle)}" alt=""></div>${p.quote.text ? `<div lang="en" dir="auto" data-testid="tweetText">${richText(p.quote.text, 'classic')}</div>` : ''}</div></div></div>`
    : '';
  const replying = p.replyingTo?.length
    ? `<div class="css-146c3p1">Replying to <div class="css-175oi2r">${p.replyingTo.map((h) => `<a href="/${h}" role="link"><span>@${h}</span></a>`).join(' ')}</div></div>`
    : '';
  const group = nested
    ? ''
    : `<div aria-label="3 replies, 1 repost, 12 likes" role="group" class="css-175oi2r r-1kbdv8c"><div><button data-testid="reply" aria-label="3 Replies. Reply" role="button"></button></div><div><button data-testid="retweet" role="button"></button></div><div><button data-testid="like" role="button"></button></div><div><a href="/${p.handle}/status/${p.id}/analytics" role="link"></a></div><div><button data-testid="bookmark" role="button"></button></div><div><button aria-label="Share post" role="button"></button></div></div>`;
  return `<article aria-labelledby="id${p.id}" role="article" tabindex="0" data-testid="tweet" class="css-175oi2r"><div class="css-175oi2r"><div class="css-175oi2r r-top-row"><div class="css-175oi2r r-avatar-col-top">${p.above ? line('above') : ''}</div></div><div class="css-175oi2r r-main-row" style="display:flex"><div class="css-175oi2r r-avatar-col"><div data-testid="Tweet-User-Avatar"><a href="/${p.handle}" role="link"><img alt="" draggable="true" src="${avatar(p.handle)}" class="css-9pa8cd"></a></div>${p.below ? line('below') : ''}</div><div class="css-175oi2r r-content-col"><div data-testid="User-Name"><div><a href="/${p.handle}" role="link"><span>${esc(name)}</span></a>${p.verified ? '<svg data-testid="icon-verified" aria-label="Verified account"></svg>' : ''}</div><div><a href="/${p.handle}" role="link" tabindex="-1"><span>@${p.handle}</span></a><a href="/${p.handle}/status/${p.id}" role="link"><time datetime="${iso}">Jul 21</time></a></div></div>${replying}${text}${photos}${video}${card}${quote}${group}</div></div></div></article>`;
}

function classicCell(c: CellSpec, y: number): string {
  const style = `style="transform: translateY(${y}px); position: absolute; width: 100%;"`;
  if ('tombstone' in c)
    return `<div data-testid="cellInnerDiv" ${style}><div><div><span>${esc(c.tombstone)}</span></div></div></div>`;
  if ('gap' in c)
    return `<div data-testid="cellInnerDiv" ${style}><div role="button"><span>${esc(c.gap)}</span></div></div>`;
  return `<div data-testid="cellInnerDiv" ${style}>${classicArticle(c)}</div>`;
}

export function classicList(
  cells: CellSpec[],
  opts: { shuffleDom?: boolean; startY?: number } = {},
): string {
  const rendered = cells.map((c, i) => classicCell(c, (opts.startY ?? 0) + i * 300));
  // X's virtualised list may keep cells out of DOM order; visual order comes from translateY.
  if (opts.shuffleDom) rendered.reverse();
  return `<div aria-label="Timeline: Conversation"><div style="position: relative; min-height: ${cells.length * 300}px">${rendered.join('')}</div></div>`;
}

/* ---------------------------------------------------------------- PAGES ---------------------------------------------------------------- */

export function statusPage(
  layout: Layout,
  cells: CellSpec[],
  focalId?: string,
  extraHead = '',
  extraBody = '',
): string {
  const list = layout === 'xds' ? xdsList(cells, focalId) : classicList(cells);
  const shell =
    layout === 'xds'
      ? `<div class="mx-auto flex min-h-dvh w-full max-w-[1280px]"><div class="grid min-w-0 flex-1"><main class="border-normal mx-auto flex w-full max-w-[602px] flex-col"><div class="relative"><div><div class="mx-auto w-full max-w-[600px]" id="ts-list">${list}</div></div></div></main></div></div>`
      : `<div id="react-root"><main role="main"><div data-testid="primaryColumn"><section role="region"><div id="ts-list">${list}</div></section></div></main></div>`;
  return `<!doctype html><html lang="fr" dir="ltr" ${layout === 'xds' ? 'data-theme="light"' : ''}><head><meta charset="utf-8"><title>Fixture</title><style>
  body{font-family:-apple-system,system-ui,sans-serif;margin:0;background:#fff;color:#0f1419}
  main{max-width:600px;margin:0 auto;border-left:1px solid #eff3f4;border-right:1px solid #eff3f4}
  ul{list-style:none;margin:0;padding:0} li{border-bottom:1px solid #eff3f4;padding:12px 16px}
  .relative{position:relative}.absolute{position:absolute}.flex{display:flex}.flex-col{flex-direction:column}.gap-2{gap:8px}.w-10{width:40px}.self-stretch{align-self:stretch}
  .w-0\\.5{width:2px}.-top-3{top:-12px}.top-5{top:20px}.-bottom-3{bottom:-12px}.h-8{height:32px}.left-1\\/2{left:50%}
  .bg-\\(--x-border-normal\\){background-color:#cfd9de}.size-10{width:40px;height:40px}.rounded-full{border-radius:9999px}
  img{max-width:100%}.x-avatar img{width:40px;height:40px;border-radius:50%}
  .whitespace-pre-wrap{white-space:pre-wrap}.font-bold{font-weight:700}.text-secondary{color:#536471}
  .justify-between{justify-content:space-between}.items-center{align-items:center}.flex-1{flex:1}.min-w-0{min-width:0}
  [data-testid="cellInnerDiv"]{left:0;right:0;border-bottom:1px solid #eff3f4;padding:12px 16px;box-sizing:border-box;min-height:300px}
  .r-avatar-col{width:40px;display:flex;flex-direction:column;align-items:center;margin-right:12px}.r-avatar-col img{width:40px;height:40px;border-radius:50%}
  .r-avatar-col-top{width:40px;display:flex;justify-content:center}[data-testid="tweetPhoto"] img{width:100%;height:200px;object-fit:cover}
  [role="group"]{display:flex;justify-content:space-between;max-width:425px;margin-top:12px}[role="group"] button{width:34px;height:20px}
  </style>${extraHead}</head><body><svg style="display:none"><symbol id="icon-verified-premium-color"></symbol></svg>${shell}${extraBody}</body></html>`;
}

/* ---------------------------------------------------------------- SCENARIOS ---------------------------------------------------------------- */

const T0 = 1_784_669_299_000;

export function threadPosts(
  count: number,
  opts: { handle?: string; startId?: bigint; text?: (i: number) => string } = {},
): PostSpec[] {
  const handle = opts.handle ?? 'ada_dev';
  const start = opts.startId ?? 2079610838143623371n;
  return Array.from({ length: count }, (_, i) => ({
    id: String(start + BigInt(i) * 1000n),
    handle,
    name: 'Ada Example',
    text: opts.text
      ? opts.text(i)
      : `Part ${i + 1} of the thread. Something useful about topic #${i + 1} with details.`,
    timestamp: T0 + i * 60_000,
    above: i > 0,
    below: i < count - 1,
  }));
}

export function replies(n: number, toHandle: string): PostSpec[] {
  return Array.from({ length: n }, (_, i) => ({
    id: String(2089000000000000000n + BigInt(i)),
    handle: `reader${i + 1}`,
    name: `Reader ${i + 1}`,
    text: `Reply number ${i + 1} from another account — should never appear in the thread.`,
    replyingTo: [toHandle],
    timestamp: T0 + 3_600_000 + i * 1000,
  }));
}

/* ---------------------------------------------------------------- DYNAMIC PAGES (e2e) ---------------------------------------------------------------- */

/** JSON safe to embed inside an inline <script> (rendered posts contain their own </script>). */
const scriptJson = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');

/**
 * Status page whose list grows as the user scrolls (X loads replies progressively) and unmounts
 * posts that are far above the viewport (X virtualises its timeline).
 */
export function progressivePage(
  cells: CellSpec[],
  focalId: string,
  initial: number,
  step = 5,
  keep = 14,
): string {
  const rendered = cells.map((c) =>
    xdsList([c], focalId).replace(/^<ul class="conversation">|<\/ul>$/g, ''),
  );
  const script = `<script>
(() => {
  const rest = ${scriptJson(rendered.slice(initial))};
  const ul = document.querySelector('ul.conversation');
  let loading = false;
  function more() {
    if (loading || !rest.length) return;
    if (window.innerHeight + window.scrollY < document.body.scrollHeight - 400) return;
    loading = true;
    setTimeout(() => {
      for (const html of rest.splice(0, ${step})) ul.insertAdjacentHTML('beforeend', html);
      // Virtualisation: drop rows far above the viewport, keep a spacer so scroll position holds.
      while (ul.children.length > ${keep}) {
        const first = ul.firstElementChild;
        const h = first.getBoundingClientRect().height;
        first.remove();
        const pad = parseFloat(ul.style.paddingTop || '0') + h;
        ul.style.paddingTop = pad + 'px';
      }
      document.body.dataset.remaining = String(rest.length);
      loading = false;
    }, 120);
  }
  document.body.dataset.remaining = String(rest.length);
  window.addEventListener('scroll', more, { passive: true });
})();
</script>`;
  return statusPage(
    'xds',
    cells.slice(0, initial),
    focalId,
    '<style>li{min-height:220px}</style>',
    script,
  );
}

/**
 * Two status pages served by one document: clicking #go (or calling window.__go()) swaps the list and
 * calls history.pushState — like X's single-page navigation. `#replace` uses replaceState.
 */
export function spaPage(
  a: { cells: CellSpec[]; focal: PostSpec },
  b: { cells: CellSpec[]; focal: PostSpec },
): string {
  const listB = xdsList(b.cells, b.focal.id);
  const urlB = `/${b.focal.handle}/status/${b.focal.id}`;
  const script = `<script>
window.__go = (mode) => {
  document.getElementById('ts-list').innerHTML = ${scriptJson(listB)};
  if (mode === 'replace') history.replaceState({}, '', ${JSON.stringify(urlB)});
  else history.pushState({}, '', ${JSON.stringify(urlB)});
};
</script><nav style="position:fixed;top:0;left:0"><button id="go" onclick="__go()">go</button><button id="replace" onclick="__go('replace')">replace</button></nav>`;
  return statusPage('xds', a.cells, a.focal.id, '', script);
}

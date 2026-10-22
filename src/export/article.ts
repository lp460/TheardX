/** Long-form X Article rendering for the exports (Markdown, plain text, HTML). */
import type { Tweet, XArticle } from '@/types/model';
import { segmentsToPlain } from '@/utils/text';
import { safeHref } from '@/utils/url';

/** The post text is only the link to its Article: exports show the Article instead. */
export function textIsOnlyArticleLink(t: Tweet): boolean {
  return !!t.article && t.text.every((s) => s.t === 'link' || (s.t === 'text' && !s.v.trim()));
}

export function articleToMarkdown(
  a: XArticle,
  segmentsToMarkdown: (s: Tweet['text']) => string,
  esc: (s: string) => string,
  mdUrl: (s: string) => string,
): string {
  const out: string[] = [];
  if (a.title) out.push(`### ${esc(a.title)}`);
  if (a.coverUrl) out.push(`![](${mdUrl(a.coverUrl)})`);
  if (a.partial) out.push(`_(aperçu seulement — Article complet : ${a.url})_`);
  for (const b of a.blocks) {
    switch (b.t) {
      case 'heading':
        out.push(
          `${'#'.repeat(b.level + 2)} ${segmentsToMarkdown(b.text).replace(/\s*\n\s*/g, ' ')}`,
        );
        break;
      case 'paragraph':
        out.push(segmentsToMarkdown(b.text));
        break;
      case 'quote':
        out.push(
          segmentsToMarkdown(b.text)
            .split('\n')
            .map((l) => `> ${l}`)
            .join('\n'),
        );
        break;
      case 'list':
        out.push(
          b.items
            .map(
              (it, i) =>
                `${b.ordered ? `${i + 1}.` : '-'} ${segmentsToMarkdown(it).replace(/\n/g, ' ')}`,
            )
            .join('\n'),
        );
        break;
      case 'code': {
        const fence = b.code.includes('```') ? '````' : '```';
        out.push(`${fence}${b.lang ?? ''}\n${b.code}\n${fence}`);
        break;
      }
      case 'image':
        out.push(`![${(b.media.alt ?? '').replace(/[[\]]/g, '')}](${mdUrl(b.media.url)})`);
        break;
      case 'divider':
        out.push('---');
        break;
    }
  }
  return out.join('\n\n');
}

export function articleToText(a: XArticle, includeUrls: boolean): string {
  const out: string[] = [];
  if (a.title) out.push(a.title.toUpperCase());
  if (a.partial) out.push(`(aperçu seulement — Article complet : ${a.url})`);
  for (const b of a.blocks) {
    switch (b.t) {
      case 'heading':
        out.push(`\n${segmentsToPlain(b.text)}`);
        break;
      case 'paragraph':
        out.push(segmentsToPlain(b.text));
        break;
      case 'quote':
        out.push(`« ${segmentsToPlain(b.text)} »`);
        break;
      case 'list':
        out.push(
          b.items
            .map((it, i) => `${b.ordered ? `${i + 1}.` : '•'} ${segmentsToPlain(it)}`)
            .join('\n'),
        );
        break;
      case 'code':
        out.push(
          b.code
            .split('\n')
            .map((l) => `    ${l}`)
            .join('\n'),
        );
        break;
      case 'image':
        out.push(
          `[Image${b.media.alt ? ` : ${b.media.alt}` : ''}]${includeUrls ? ` ${b.media.url}` : ''}`,
        );
        break;
      case 'divider':
        out.push('—');
        break;
    }
  }
  return out.join('\n\n');
}

export function articleToHtml(
  a: XArticle,
  segmentsToHtml: (s: Tweet['text']) => string,
  esc: (s: string) => string,
  img: (url: string, alt?: string) => string,
): string {
  const out: string[] = ['<section class="article">'];
  if (a.coverUrl) out.push(img(a.coverUrl));
  if (a.title) out.push(`<h2>${esc(a.title)}</h2>`);
  if (a.readingTime) out.push(`<p class="muted">${esc(a.readingTime)}</p>`);
  if (a.partial) {
    const href = safeHref(a.url);
    out.push(
      `<p class="muted">Aperçu seulement — ${href ? `<a href="${esc(href)}" rel="noopener noreferrer nofollow" target="_blank">Article complet</a>` : 'Article complet sur X'}.</p>`,
    );
  }
  for (const b of a.blocks) {
    switch (b.t) {
      case 'heading': {
        const tag = `h${Math.min(6, b.level + 1)}`;
        out.push(`<${tag}>${segmentsToHtml(b.text).replace(/^<p>|<\/p>$/g, '')}</${tag}>`);
        break;
      }
      case 'paragraph':
        out.push(segmentsToHtml(b.text));
        break;
      case 'quote':
        out.push(`<blockquote>${segmentsToHtml(b.text)}</blockquote>`);
        break;
      case 'list': {
        const tag = b.ordered ? 'ol' : 'ul';
        out.push(
          `<${tag}>${b.items.map((it) => `<li>${segmentsToHtml(it).replace(/^<p>|<\/p>$/g, '')}</li>`).join('')}</${tag}>`,
        );
        break;
      }
      case 'code':
        out.push(
          `<pre${b.lang ? ` data-lang="${esc(b.lang)}"` : ''}><code>${esc(b.code)}</code></pre>`,
        );
        break;
      case 'image':
        out.push(img(b.media.url, b.media.alt));
        break;
      case 'divider':
        out.push('<hr>');
        break;
    }
  }
  out.push('</section>');
  return out.join('');
}

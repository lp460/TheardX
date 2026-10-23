import { ExternalLink, FileText } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { XArticle } from '@/types/model';
import { safeHref } from '@/utils/url';
import { MediaView } from './media';
import { RichText } from './RichText';
import { cn } from './ui/cn';

/** Long-form X Article rendered editorially: title, cover, headings, paragraphs, code, images. */
export function ArticleView({
  article,
  postUrl,
  textStyle,
  compact,
  className,
  hideTitle,
}: {
  article: XArticle;
  /** The page already shows the Article title (reader header). */
  hideTitle?: boolean;
  postUrl: string;
  textStyle?: CSSProperties;
  compact?: boolean;
  className?: string;
}) {
  const href = safeHref(article.url) ?? postUrl;
  const textCls = 'text-[15px] leading-relaxed text-fg';
  // Inline bodies (Reddit posts and comments) are the post's own text: no Article frame.
  const inline = !!article.inline;
  return (
    <div className={cn('min-w-0', className)} data-testid={inline ? 'post-body' : 'article-view'}>
      {inline ? null : (
        <div className="mb-2 flex items-center gap-1.5 font-sans text-[11.5px] font-semibold uppercase tracking-wide text-faint">
          <FileText size={12} /> Article X
          {article.readingTime ? (
            <span className="font-normal normal-case tracking-normal">· {article.readingTime}</span>
          ) : null}
        </div>
      )}
      {article.coverUrl ? (
        <MediaView
          item={{ kind: 'photo', url: article.coverUrl }}
          postUrl={postUrl}
          compact={compact}
          className="mb-4"
        />
      ) : null}
      {article.title && !hideTitle ? (
        <h2
          className={cn(
            'font-semibold leading-tight tracking-[-0.015em] text-fg',
            inline ? 'mb-3 text-[1.2em]' : 'mb-4 text-[1.45em]',
          )}
          style={
            textStyle?.fontSize
              ? { fontSize: Number(textStyle.fontSize) * (inline ? 1.15 : 1.35) }
              : undefined
          }
        >
          {article.title}
        </h2>
      ) : null}
      {article.partial ? (
        <p className="rounded-xl border border-dashed border-line bg-subtle/60 px-4 py-3 font-sans text-[13px] text-muted">
          {inline
            ? 'Seul un extrait du post était affiché.'
            : 'Seul l’aperçu de l’Article était affiché.'}{' '}
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-accent hover:underline"
          >
            {inline ? 'Ouvrez le post' : 'Ouvrez la publication'} <ExternalLink size={11} />
          </a>{' '}
          {inline
            ? 'puis enregistrez à nouveau pour capturer le texte complet.'
            : 'puis enregistrez à nouveau pour capturer l’Article complet.'}
        </p>
      ) : null}
      <div className={inline ? 'space-y-3' : 'space-y-4'}>
        {(compact ? article.blocks.slice(0, 6) : article.blocks).map((b, i) => {
          switch (b.t) {
            case 'heading':
              return (
                <RichText
                  key={i}
                  segments={b.text}
                  className={cn(
                    'pt-2 font-semibold tracking-[-0.01em] text-fg',
                    b.level === 2
                      ? 'text-[1.3em]'
                      : b.level === 3
                        ? 'text-[1.15em]'
                        : 'text-[1.05em]',
                  )}
                  style={
                    textStyle?.fontSize
                      ? {
                          fontSize:
                            Number(textStyle.fontSize) *
                            (b.level === 2 ? 1.25 : b.level === 3 ? 1.12 : 1.04),
                        }
                      : undefined
                  }
                />
              );
            case 'paragraph':
              return <RichText key={i} segments={b.text} className={textCls} style={textStyle} />;
            case 'quote':
              return (
                <blockquote key={i} className="border-l-2 border-accent/50 pl-4 text-muted">
                  <RichText segments={b.text} className={textCls} style={textStyle} />
                </blockquote>
              );
            case 'list': {
              const Tag = b.ordered ? 'ol' : 'ul';
              return (
                <Tag
                  key={i}
                  className={cn('space-y-1.5 pl-6', b.ordered ? 'list-decimal' : 'list-disc')}
                  style={textStyle}
                >
                  {b.items.map((it, j) => (
                    <li key={j}>
                      <RichText segments={it} className={textCls} style={textStyle} />
                    </li>
                  ))}
                </Tag>
              );
            }
            case 'code':
              return (
                <div
                  key={i}
                  className="overflow-hidden rounded-xl border border-line bg-subtle/70 font-mono"
                >
                  {b.lang ? (
                    <div className="border-b border-line px-3 py-1 text-[11px] text-faint">
                      {b.lang}
                    </div>
                  ) : null}
                  <pre className="overflow-x-auto px-3 py-2.5 text-[12.5px] leading-relaxed text-fg">
                    <code>{b.code}</code>
                  </pre>
                </div>
              );
            case 'image':
              return <MediaView key={i} item={b.media} postUrl={postUrl} compact={compact} />;
            case 'divider':
              return <hr key={i} className="mx-auto my-6 w-16 border-line" />;
          }
        })}
      </div>
      {compact && article.blocks.length > 6 ? (
        <p className="mt-3 font-sans text-[12.5px] text-muted">… suite dans le lecteur.</p>
      ) : null}
    </div>
  );
}

import { ExternalLink, FileText, MessageCircle } from 'lucide-react';
import { RichText } from '@/components/RichText';
import { segmentsToPlain } from '@/utils/text';
import { safeHref } from '@/utils/url';
import type { ArticleBlock } from '@/types/model';
import type { WebLanguage } from './i18n';
import { realExampleContent, type PublicCapturedPost } from './realExampleContent';
import { realExamples, type PublicExample } from './realExamples';

const labels = {
  fr: {
    heading: 'Texte original extrait', count: 'éléments capturés', post: 'Publication', comment: 'Commentaire',
    original: 'Source', link: 'Lien joint', partial: 'Texte tronqué à la capture',
    partialNote: 'Certains messages étaient déjà tronqués lors de leur enregistrement. La suite est disponible sur la publication d’origine.',
    unavailable: 'Cette publication contient un lien, sans texte supplémentaire enregistré.',
  },
  en: {
    heading: 'Original extracted text', count: 'captured items', post: 'Post', comment: 'Comment',
    original: 'Source', link: 'Attached link', partial: 'Text truncated when saved',
    partialNote: 'Some posts were already truncated when saved. Follow their original links for the remaining text.',
    unavailable: 'This post contains a link and has no additional saved text.',
  },
  es: {
    heading: 'Texto original extraído', count: 'elementos capturados', post: 'Publicación', comment: 'Comentario',
    original: 'Fuente', link: 'Enlace adjunto', partial: 'Texto truncado al guardar',
    partialNote: 'Algunas publicaciones ya estaban truncadas al guardarse. Consulta el enlace original para leer el resto.',
    unavailable: 'Esta publicación contiene un enlace, sin más texto guardado.',
  },
} as const;

function plainBlock(block: ArticleBlock): string {
  if (block.t === 'heading' || block.t === 'paragraph' || block.t === 'quote') return segmentsToPlain(block.text);
  if (block.t === 'list') return block.items.map((item) => segmentsToPlain(item)).join('\n');
  return block.t === 'code' ? block.code : '';
}

/** Same original-language text shown in the demo reader; no private library metadata. */
export function capturedThreadPlainText(exampleId: string, firstOnly = false, markdown = false): string {
  const posts = realExampleContent[exampleId] ?? [];
  const example = realExamples.find((item) => item.id === exampleId);
  return (firstOnly ? posts.slice(0, 1) : posts).map((post, index) => {
    const body = [
      index === 0 && example?.source === 'Reddit' ? example.title : '',
      post.text ? segmentsToPlain(post.text) : '',
      ...(post.blocks ?? []).map(plainBlock),
      post.card?.url ?? '',
    ].filter(Boolean).join('\n\n');
    return markdown
      ? `### ${post.author}\n\n[Source](${post.url})\n\n${body}`
      : `${post.author} · ${post.url}\n\n${body}`;
  }).join(markdown ? '\n\n---\n\n' : '\n\n────────────────\n\n');
}

function CapturedBlock({ block, reader = false }: { block: ArticleBlock; reader?: boolean }) {
  if (block.t === 'paragraph') return <RichText segments={block.text} className={reader ? 'text-[1em] leading-[1.9] text-inherit' : 'text-[14px] leading-[1.85] text-[#4c4d59] sm:text-[15px]'}/>;
  if (block.t === 'quote') return <blockquote className="border-l-[3px] border-[#c1b4e8] pl-4"><RichText segments={block.text} className="text-[14px] leading-7 text-[#666475]"/></blockquote>;
  if (block.t === 'heading') return <RichText segments={block.text} className="text-[17px] font-bold leading-7 text-[#343343]"/>;
  if (block.t === 'list') {
    const Tag = block.ordered ? 'ol' : 'ul';
    return <Tag className={`space-y-2 pl-5 ${block.ordered ? 'list-decimal' : 'list-disc'}`}>{block.items.map((item, i) => <li key={i}><RichText segments={item} className="text-[14px] leading-7 text-[#4c4d59]"/></li>)}</Tag>;
  }
  if (block.t === 'code') return <pre className="overflow-x-auto rounded-lg bg-[#29263e] p-3 text-[12px] leading-6 text-white"><code>{block.code}</code></pre>;
  if (block.t === 'image') return <img loading="lazy" alt={block.media.alt ?? ''} src={block.media.url} className="max-h-[230px] w-full rounded-lg object-contain"/>;
  return <hr className="border-[#e9e6f0]"/>;
}

function CapturedPost({ post, index, locale, reader = false }: { post: PublicCapturedPost; index: number; locale: WebLanguage; reader?: boolean }) {
  const t = labels[locale];
  const hasBody = !!post.text?.length || !!post.blocks?.length;
  return <article data-testid="captured-post" className={reader ? `min-w-0 ${index > 0 ? 'mt-9 border-t border-[#e8e3db] pt-7' : ''}` : 'min-w-0 rounded-xl border border-[#e9e7ef] bg-white px-3 py-4 shadow-[0_2px_8px_#34245306] sm:px-5'}>
    {(!reader || index > 0) ? <div className="mb-4 flex flex-wrap items-center gap-2 text-[11px]">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-[#eeeafa] px-2.5 py-1 font-semibold text-[#6b57bd]">{post.comment ? <MessageCircle size={12}/> : <FileText size={12}/>} {post.comment ? t.comment : t.post} {index + 1}</span>
      <span className="max-w-full break-all font-semibold text-[#494553]">{post.comment ? 'u/' : '@'}{post.handle}</span>
      <a href={safeHref(post.url) ?? '#'} target="_blank" rel="noopener noreferrer" className="ts-focus ml-auto inline-flex items-center gap-1 font-semibold text-[#735ac8] hover:underline"><ExternalLink size={12}/>{t.original}</a>
    </div> : null}
    <div className={`min-w-0 break-words [&_a]:!text-[#7053c8] [&_a]:underline [&_a]:underline-offset-2 ${reader ? 'space-y-5' : 'space-y-4'}`}>
      {post.text?.length ? <RichText segments={post.text} className={reader ? 'text-[1em] leading-[1.9] text-inherit' : 'font-serif text-[15px] leading-[1.85] text-[#4c4d59] sm:text-[16px]'}/> : null}
      {(post.blocks ?? []).map((block, i) => <CapturedBlock key={i} block={block} reader={reader}/>)}
      {post.card ? <a href={safeHref(post.card.url) ?? '#'} target="_blank" rel="noopener noreferrer" className="ts-focus inline-flex max-w-full items-center gap-2 rounded-lg border border-[#dfdaf0] bg-[#f9f7ff] px-3 py-2 text-xs text-[#6b55be]"><ExternalLink size={15} className="shrink-0"/><span className="min-w-0 break-words">{post.card.title || t.link}</span></a> : null}
      {post.media?.length && (reader || index > 0) ? <div className={`grid gap-3 ${reader ? 'grid-cols-1' : 'sm:grid-cols-2'}`}>{post.media.slice(0, reader ? 4 : 2).map((media, i) => <a key={media.url + i} href={safeHref(post.url) ?? '#'} target="_blank" rel="noopener noreferrer" className="ts-focus block overflow-hidden rounded-xl bg-[#f2f0f7]"><img src={media.url} alt={media.alt || `${post.author} · ${t.post} ${index + 1}`} loading="lazy" referrerPolicy="no-referrer" className={reader ? 'max-h-[360px] w-full object-contain' : 'max-h-44 w-full object-contain'}/></a>)}</div> : null}
      {!hasBody && !post.card ? <p className="text-xs italic text-[#8f889a]">{t.unavailable}</p> : null}
    </div>
    {post.truncated ? <p className="mt-4 rounded-lg bg-[#fff4df] px-3 py-2 text-[12px] font-semibold text-[#8e6429]">{t.partial}</p> : null}
  </article>;
}

/** Complete saved text of each selected public thread, with honest partial-capture markers. */
export function ExtractedThread({ example, language, variant = 'cards' }: { example: PublicExample; language: WebLanguage; variant?: 'cards' | 'reader' }) {
  const posts = realExampleContent[example.id] ?? [];
  const t = labels[language];
  const reader = variant === 'reader';
  return <section data-testid="captured-thread" aria-label={t.heading} className={reader ? 'min-w-0' : 'mt-7 min-w-0'}>
    {!reader ? <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
      <h4 className="font-sans text-[17px] font-bold text-[#302b45]">{t.heading}</h4>
      <span className="text-xs font-semibold text-[#82779c]">{posts.length} {t.count}</span>
    </div> : null}
    {posts.some((post) => post.truncated) ? <p className="mb-4 rounded-xl border border-[#f5deb5] bg-[#fffaf0] px-4 py-3 text-xs leading-6 text-[#8a6437]">{t.partialNote}</p> : null}
    <div className={reader ? 'space-y-0' : 'space-y-3'}>{posts.map((post, i) => <CapturedPost key={post.id} post={post} index={i} locale={language} reader={reader}/>)}</div>
  </section>;
}

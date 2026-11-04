import { useEffect, useState, type CSSProperties } from 'react';
import { ArrowLeft, Check, Clock3, Copy, Download, ExternalLink, Keyboard, Languages, Minus, Moon, MoreHorizontal, Plus, Printer, Share2, Star, Sun, Type, X } from 'lucide-react';
import { copyText } from '@/utils/clipboard';
import { capturedThreadPlainText, ExtractedThread } from './ExtractedThread';
import { realExampleContent } from './realExampleContent';
import type { WebLanguage } from './i18n';
import type { PublicExample } from './realExamples';

const wording = {
  fr: {
    back: 'Bibliothèque', share: 'Partager', shareLabel: 'Partager la publication originale', copy: 'Copier le texte', export: 'Télécharger en Markdown', print: 'Imprimer', translate: 'Traduire', settings: 'Apparence', shortcuts: 'Raccourcis', favorite: 'Favori', later: 'À lire plus tard', source: 'Voir la publication originale', captured: 'publications capturées', capturedOne: 'publication capturée', verified: 'Texte capturé', partial: 'Capture partielle', note: 'NOTE PERSONNELLE', noteEmpty: 'Tes notes privées restent dans ta bibliothèque et ne sont jamais affichées dans cette démo.', saved: 'Exemple public · aucune note personnelle publiée', copied: 'Texte complet copié', linkCopied: 'Lien de la publication copié', error: 'Le navigateur a refusé la copie.', translateInfo: 'La traduction intégrée est disponible dans le lecteur après connexion. Le texte original est conservé dans cette démo.', font: 'Police', fontSize: 'Taille du texte', example: 'Exemple de lecture', shortHelp: 'Échap : fermer les réglages · La flèche de retour : bibliothèque', original: 'Texte original extrait de publications publiques',
  },
  en: {
    back: 'Library', share: 'Share', shareLabel: 'Share original post', copy: 'Copy text', export: 'Download Markdown', print: 'Print', translate: 'Translate', settings: 'Appearance', shortcuts: 'Shortcuts', favorite: 'Favorite', later: 'Read later', source: 'View original post', captured: 'captured posts', capturedOne: 'captured post', verified: 'Text captured', partial: 'Partial capture', note: 'PERSONAL NOTE', noteEmpty: 'Your private notes stay in your library and are never shown in this demo.', saved: 'Public example · no personal notes published', copied: 'Full text copied', linkCopied: 'Post link copied', error: 'The browser blocked copying.', translateInfo: 'Built-in translation is available in the reader after signing in. This demo preserves the original text.', font: 'Font', fontSize: 'Text size', example: 'Reading preview', shortHelp: 'Escape: close settings · Back arrow: library', original: 'Original text extracted from public posts',
  },
  es: {
    back: 'Biblioteca', share: 'Compartir', shareLabel: 'Compartir publicación original', copy: 'Copiar texto', export: 'Descargar Markdown', print: 'Imprimir', translate: 'Traducir', settings: 'Apariencia', shortcuts: 'Atajos', favorite: 'Favorito', later: 'Leer después', source: 'Ver publicación original', captured: 'publicaciones capturadas', capturedOne: 'publicación capturada', verified: 'Texto capturado', partial: 'Captura parcial', note: 'NOTA PERSONAL', noteEmpty: 'Tus notas privadas permanecen en tu biblioteca y nunca se muestran en esta demo.', saved: 'Ejemplo público · sin notas personales publicadas', copied: 'Texto completo copiado', linkCopied: 'Enlace de la publicación copiado', error: 'El navegador no permitió copiar.', translateInfo: 'La traducción integrada está disponible en el lector después de iniciar sesión. Esta demo conserva el texto original.', font: 'Fuente', fontSize: 'Tamaño del texto', example: 'Vista previa de lectura', shortHelp: 'Escape: cerrar ajustes · Flecha atrás: biblioteca', original: 'Texto original extraído de publicaciones públicas',
  },
} as const;

function publishedDate(example: PublicExample, language: WebLanguage): string | null {
  // X snowflake identifiers include the publication timestamp; Reddit IDs do not.
  const snowflake = example.source === 'X' ? example.sourceUrl.match(/\/status\/(\d+)/)?.[1] : undefined;
  if (!snowflake) return null;
  const timestamp = Number((BigInt(snowflake) >> 22n) + 1288834974657n);
  return new Date(timestamp).toLocaleDateString({ fr: 'fr-FR', en: 'en-US', es: 'es-ES' }[language], { day: 'numeric', month: 'long', year: 'numeric' });
}

export function LandingReader({ example, language, favorite, later, onBack, onFavorite, onLater }: {
  example: PublicExample;
  language: WebLanguage;
  favorite: boolean;
  later: boolean;
  onBack: () => void;
  onFavorite: () => void;
  onLater: () => void;
}) {
  const labels = wording[language];
  const [menu, setMenu] = useState<'settings' | 'shortcuts' | 'more' | null>(null);
  const [font, setFont] = useState<'serif' | 'sans'>('serif');
  const [fontSize, setFontSize] = useState(16);
  const [dark, setDark] = useState(false);
  const [notice, setNotice] = useState('');
  const posts = realExampleContent[example.id] ?? [];
  const isPartial = posts.some((post) => post.truncated);
  const date = publishedDate(example, language);
  const sourceLabel = `${labels.source} · ${example.source}`;
  useEffect(() => {
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMenu(null); setNotice(''); }
    };
    window.addEventListener('keydown', dismiss);
    return () => window.removeEventListener('keydown', dismiss);
  }, []);

  const copy = async (value: string, message: string) => {
    try { await copyText(value); setNotice(message); }
    catch { setNotice(labels.error); }
  };
  const share = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: example.title, url: example.sourceUrl }); }
      catch { /* The user can cancel the native share sheet. */ }
    } else {
      await copy(example.sourceUrl, labels.linkCopied);
    }
  };
  const download = () => {
    const file = new Blob([`# ${example.title}\n\n${capturedThreadPlainText(example.id, false, true)}`], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = `theardx-${example.id}.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const print = () => {
    const article = document.querySelector('[data-testid="demo-reader-scroll"] article');
    if (!article) return;
    const printable = document.createElement('main');
    printable.id = 'ts-demo-print';
    printable.appendChild(article.cloneNode(true));
    document.body.appendChild(printable);
    document.body.classList.add('ts-demo-printing');
    const cleanup = () => { printable.remove(); document.body.classList.remove('ts-demo-printing'); };
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
  };
  const action = 'ts-focus inline-flex h-9 min-w-9 shrink-0 items-center justify-center gap-1.5 rounded-md px-1.5 text-[#71717e] transition-colors hover:bg-[#f0edf5] hover:text-[#6b52d4] sm:px-2';
  return <div role="tabpanel" aria-label={labels.example} data-testid="demo-reader-panel" className={`ts-demo-reader relative flex min-h-0 min-w-0 flex-1 flex-col ${dark ? 'bg-[#191a22] text-[#f2eee9]' : 'bg-[#fdfcf9] text-[#201e25]'}`}>
    <div data-testid="demo-reader-toolbar" className={`z-10 flex min-h-[53px] flex-none items-center gap-0.5 border-b px-2 sm:gap-1 sm:px-3 ${dark ? 'border-white/10 bg-[#21232b]' : 'border-[#ede9e3] bg-[#fdfcf9]'}`}>
      <button type="button" data-testid="demo-library-tab" onClick={onBack} className={`${action} mr-auto !min-w-0 gap-1 text-[11px] sm:text-xs`} aria-label={labels.back}><ArrowLeft size={15}/><span className="hidden min-[340px]:inline">{labels.back}</span></button>
      <button type="button" data-testid="demo-reader-favorite" className={action} aria-label={labels.favorite} aria-pressed={favorite} onClick={onFavorite}><Star size={15} fill={favorite ? 'currentColor' : 'none'} className={favorite ? 'text-[#7459da]' : ''}/></button>
      <button type="button" data-testid="demo-reader-later" className={action} aria-label={labels.later} aria-pressed={later} onClick={onLater}><Clock3 size={15} className={later ? 'text-[#7459da]' : ''}/></button>
      <button type="button" data-testid="demo-reader-share" className={`${action} text-[#7459da]`} aria-label={labels.shareLabel} onClick={() => void share()}><Share2 size={15}/><span className="hidden lg:inline text-[11px]">{labels.share}</span></button>
      <button type="button" data-testid="demo-reader-copy" className={`${action} hidden min-[390px]:inline-flex`} aria-label={labels.copy} onClick={() => void copy(capturedThreadPlainText(example.id), labels.copied)}><Copy size={15}/></button>
      <button type="button" className={`${action} hidden min-[390px]:inline-flex`} aria-label={labels.export} onClick={download}><Download size={15}/></button>
      <button type="button" className={`${action} hidden sm:inline-flex`} aria-label={labels.print} onClick={print}><Printer size={15}/></button>
      <button type="button" className={`${action} hidden min-[460px]:inline-flex`} aria-label={labels.translate} onClick={() => setNotice(labels.translateInfo)}><Languages size={15}/><span className="hidden xl:inline text-[11px]">{labels.translate}</span></button>
      <div className="relative">
        <button type="button" data-testid="demo-reader-settings" className={action} aria-label={labels.settings} aria-expanded={menu === 'settings'} onClick={() => setMenu(menu === 'settings' ? null : 'settings')}><Type size={16}/></button>
        {menu === 'settings' ? <div className="absolute right-0 top-10 z-20 w-[225px] rounded-xl border border-[#e9e4f0] bg-white p-3 text-[#353144] shadow-xl">
          <div className="mb-2 flex items-center justify-between text-xs font-semibold">{labels.settings}<button type="button" className="ts-focus" aria-label="Fermer" onClick={() => setMenu(null)}><X size={15}/></button></div>
          <div className="mb-3 flex gap-2"><button type="button" className="ts-focus flex-1 rounded-lg bg-[#f3f0fc] py-2 text-xs" aria-pressed={!dark} onClick={() => setDark(false)}><Sun size={13} className="mx-auto"/></button><button type="button" className="ts-focus flex-1 rounded-lg bg-[#f3f0fc] py-2 text-xs" aria-pressed={dark} onClick={() => setDark(true)}><Moon size={13} className="mx-auto"/></button></div>
          <p className="mb-1 text-[10px] font-semibold uppercase text-[#938a9f]">{labels.font}</p>
          <div className="mb-3 flex gap-2"><button type="button" aria-pressed={font === 'serif'} onClick={() => setFont('serif')} className={`ts-focus flex-1 rounded-lg border py-1.5 font-serif text-xs ${font === 'serif' ? 'border-[#7459da]' : 'border-[#e9e4f0]'}`}>Serif</button><button type="button" aria-pressed={font === 'sans'} onClick={() => setFont('sans')} className={`ts-focus flex-1 rounded-lg border py-1.5 text-xs ${font === 'sans' ? 'border-[#7459da]' : 'border-[#e9e4f0]'}`}>Sans</button></div>
          <div className="flex items-center justify-between text-xs"><span>{labels.fontSize}</span><div className="flex items-center gap-2"><button type="button" className="ts-focus rounded-md border p-1" aria-label="Diminuer la police" onClick={() => setFontSize((s) => Math.max(14, s - 1))}><Minus size={12}/></button><span className="w-5 text-center tabular-nums">{fontSize}</span><button type="button" className="ts-focus rounded-md border p-1" aria-label="Augmenter la police" onClick={() => setFontSize((s) => Math.min(24, s + 1))}><Plus size={12}/></button></div></div>
        </div> : null}
      </div>
      <button type="button" className={`${action} hidden sm:inline-flex`} aria-label={labels.shortcuts} onClick={() => setMenu(menu === 'shortcuts' ? null : 'shortcuts')}><Keyboard size={15}/></button>
      <div className="relative sm:hidden"><button type="button" aria-label="Plus d’options" aria-expanded={menu === 'more'} className={action} onClick={() => setMenu(menu === 'more' ? null : 'more')}><MoreHorizontal size={17}/></button>
        {menu === 'more' ? <div className="absolute right-0 top-10 z-20 w-52 rounded-xl border border-[#e9e4f0] bg-white p-1.5 text-[#3d3650] shadow-xl">
          {([[Copy, labels.copy, () => void copy(capturedThreadPlainText(example.id), labels.copied)], [Download, labels.export, download], [Printer, labels.print, print], [Languages, labels.translate, () => setNotice(labels.translateInfo)]] as const).map(([Icon, text, handler]) => <button key={text} type="button" onClick={() => { handler(); setMenu(null); }} className="ts-focus flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs hover:bg-[#f2eefe]"><Icon size={15}/>{text}</button>)}
        </div> : null}
      </div>
    </div>
    {menu === 'shortcuts' ? <div className="absolute right-4 top-14 z-20 max-w-[250px] rounded-xl border border-[#e8e2f0] bg-white p-4 text-xs text-[#484154] shadow-lg">{labels.shortHelp}<button type="button" className="ts-focus ml-2 inline-flex" aria-label="Fermer" onClick={() => setMenu(null)}><X size={14}/></button></div> : null}
    <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-12 pt-8 sm:px-7 sm:pt-11" data-testid="demo-reader-scroll">
      <article className={`mx-auto w-full max-w-[610px] ${font === 'serif' ? 'font-serif' : 'font-sans'}`} style={{ '--demo-reader-font-size': `${fontSize}px` } as CSSProperties}>
        <header className="mb-10 font-sans sm:mb-12">
          <div className="flex items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#e1d9fc] text-[13px] font-semibold text-[#55459a]">{example.author.split(' ').map((part) => part[0]).join('').slice(0, 2)}</span><span className="min-w-0"><span className="block truncate text-[13px] font-bold">{example.author}</span><span className="block truncate text-[11px] text-[#87818e]">{example.handle}</span></span></div>
          <h3 className={`mt-6 text-[clamp(1.55rem,3vw,2.15rem)] font-semibold leading-[1.17] tracking-[-.025em] ${font === 'serif' ? 'font-serif' : 'font-sans'}`}>{example.title}</h3>
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] leading-5 text-[#928d97]">
            {date ? <span>{date}</span> : null}{date ? <span>·</span> : null}
            <span>{posts.length} {posts.length === 1 ? labels.capturedOne : labels.captured}</span>
            <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${isPartial ? 'bg-[#fff2d5] text-[#956d31]' : 'bg-[#e6f4e9] text-[#33875d]'}`}>{isPartial ? null : <Check size={11}/>} {isPartial ? labels.partial : labels.verified}</span>
            <a href={example.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={sourceLabel} className="ts-focus inline-flex items-center gap-1 text-[#7459da] hover:underline">{sourceLabel}<ExternalLink size={10}/></a>
          </div>
        </header>
        <div className="demo-reader-content text-[length:var(--demo-reader-font-size)]"><ExtractedThread example={example} language={language} variant="reader"/></div>
        <section className="mt-12 border-t border-[#e4ded5] pt-5 font-sans">
          <h4 className="text-[10px] font-semibold tracking-[.08em] text-[#938d99]">{labels.note}</h4>
          <p className={`mt-3 rounded-lg border px-3 py-4 text-[12px] leading-5 ${dark ? 'border-white/15 bg-white/5 text-white/60' : 'border-[#e8e5e5] bg-[#f8f8f7] text-[#77727e]'}`}>{labels.noteEmpty}</p>
          <p className="mt-6 text-[10px] text-[#a09aa4]">{labels.saved}</p>
        </section>
        <p className="mt-5 font-sans text-[10px] text-[#a09aa4]">{labels.original}</p>
      </article>
    </div>
    {notice ? <div role="status" className="absolute bottom-3 left-1/2 z-30 flex w-[min(95%,550px)] -translate-x-1/2 items-start gap-2 rounded-lg border border-[#d7ceec] bg-white px-4 py-3 text-xs leading-5 text-[#55438f] shadow-lg"><Check size={15} className="mt-0.5 shrink-0"/><span className="flex-1">{notice}</span><button type="button" className="ts-focus shrink-0" aria-label="Fermer" onClick={() => setNotice('')}><X size={15}/></button></div> : null}
  </div>;
}

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowLeft, BookOpen, Bookmark, Check, Copy, ExternalLink, FileText, Heart, ImageOff, Layers3, Library,
  MessageCircle, MessageSquareQuote, MoreHorizontal, MousePointerClick,
  Repeat2, Save, Share2, SlidersHorizontal, Sparkles, ThumbsUp, X, ZoomIn,
} from 'lucide-react';
import { LogoMark } from '@/components/Logo';
import { ExtractedThread, capturedThreadPlainText } from './ExtractedThread';
import { useWebI18n, type WebLanguage } from './i18n';
import { realRedditExample, realXExample, type PublicExample } from './realExamples';

type Platform = 'x' | 'reddit';
type ShowcaseAction = 'save-thread' | 'save-post' | 'save-references' | 'select' | 'copy-thread' | 'copy-post' | 'copy-text' | 'read' | 'options' | 'library';

const copy = {
  fr: {
    eyebrow: 'Le plugin, dans son élément', title: 'Il s’ajoute directement à X et Reddit.',
    subtitle: 'Sur de vraies publications de la bibliothèque, comparez X et Reddit avec ou sans les commandes ThreadShelf.',
    tabs: 'Choisir une plateforme', without: 'Avant', with: 'Avec ThreadShelf', switchLabel: 'Afficher les ajouts de l’extension',
    join: 'Rejoindre', save: 'Enregistrer', update: 'Mettre à jour', copy: 'Copier', read: 'Lire', more: 'Toutes les actions ThreadShelf',
    complete: 'messages · complet', openSource: 'Voir la publication originale',
    menuTitle: 'ThreadShelf', menuSaveThread: 'Enregistrer le thread', menuSaveDiscussion: 'Enregistrer la discussion', menuSavePost: 'Enregistrer cette publication',
    menuReferences: 'Enregistrer avec citations et liens', menuSelection: 'Ajouter à une sélection…',
    menuCopyThread: 'Copier le thread (Markdown)', menuCopyDiscussion: 'Copier la discussion (Markdown)',
    menuCopyPost: 'Copier cette publication', menuCopyText: 'Copier le thread (texte brut)',
    menuRead: 'Lire dans ThreadShelf', menuOptions: 'Collection, tags, note…', menuLibrary: 'Ouvrir la bibliothèque',
    example: 'Vraies publications publiques · commandes simulées, sans modification de votre bibliothèque',
    saved: 'Publication enregistrée dans la simulation', copied: 'Texte original extrait copié', copyFailed: 'Copie impossible ici',
    selection: 'Sélection disponible dans l’extension réelle', options: 'Collections et notes disponibles dans l’extension réelle', library: 'Votre vraie bibliothèque s’ouvre après connexion',
    reader: 'Lecture dans ThreadShelf', back: 'Retour à la publication', readerNote: 'Voici les textes originaux extraits et enregistrés depuis cette publication.',
    addedTitle: 'Ce que ThreadShelf ajoute', addedOneTitle: 'Une barre directement sous le post', addedOne: 'Enregistrer, copier ou ouvrir le lecteur en un clic, sans quitter X ou Reddit.',
    addedTwoTitle: 'Un menu de capture complet', addedTwo: 'Sauvegarde du fil, des citations et des liens ; copie Markdown ou texte brut ; collections et tags.',
    addedThreeTitle: 'Un suivi des fils', addedThree: 'Sur Reddit, la barre indique le nombre de messages capturés et l’état « complet » ou « incomplet ».',
    seeGuide: 'Installer l’extension',
    realEyebrow: 'Captures réelles', realTitle: 'Le plugin, tel qu’il apparaît dans le navigateur.',
    realIntro: 'Voici les captures originales de X et Reddit. Le bouton violet, la barre d’actions et le menu sont ceux de la véritable extension. Touchez une image pour voir les détails.',
    realPost: 'Directement sur la publication', realActions: 'La barre et le menu de ThreadShelf',
    realZoom: 'Agrandir la capture', realClose: 'Fermer la capture',
    realNote: 'Captures fournies pour illustrer l’extension. Les publications affichées appartiennent à leurs auteurs.',
  },
  en: {
    eyebrow: 'The extension in action', title: 'It works right inside X and Reddit.',
    subtitle: 'Compare real public posts from the library on X and Reddit with and without ThreadShelf controls.',
    tabs: 'Choose a platform', without: 'Before', with: 'With ThreadShelf', switchLabel: 'Show extension additions',
    join: 'Join', save: 'Save', update: 'Update', copy: 'Copy', read: 'Read', more: 'All ThreadShelf actions',
    complete: 'messages · complete', openSource: 'View original post',
    menuTitle: 'ThreadShelf', menuSaveThread: 'Save thread', menuSaveDiscussion: 'Save discussion', menuSavePost: 'Save this post',
    menuReferences: 'Save with quotes and links', menuSelection: 'Add to a selection…',
    menuCopyThread: 'Copy thread (Markdown)', menuCopyDiscussion: 'Copy discussion (Markdown)', menuCopyPost: 'Copy this post', menuCopyText: 'Copy thread (plain text)',
    menuRead: 'Read in ThreadShelf', menuOptions: 'Collection, tags, note…', menuLibrary: 'Open library',
    example: 'Real public posts · simulated controls, no changes to your library',
    saved: 'Post saved in this simulation', copied: 'Original extracted text copied', copyFailed: 'Clipboard unavailable here',
    selection: 'Selections are available in the real extension', options: 'Collections and notes are available in the real extension', library: 'Your real library opens after sign-in',
    reader: 'Read in ThreadShelf', back: 'Back to post', readerNote: 'These are the original extracted texts saved from this post.',
    addedTitle: 'What ThreadShelf adds', addedOneTitle: 'A toolbar below each post', addedOne: 'Save, copy or open the reader in one click without leaving X or Reddit.',
    addedTwoTitle: 'A full capture menu', addedTwo: 'Save threads, quotes and links; copy Markdown or plain text; organize with collections and tags.',
    addedThreeTitle: 'Thread status at a glance', addedThree: 'On Reddit, the toolbar shows the captured message count and whether the discussion is complete or incomplete.',
    seeGuide: 'Install the extension',
    realEyebrow: 'Real screenshots', realTitle: 'The extension, as it looks in your browser.',
    realIntro: 'These are original screenshots from X and Reddit. The purple button, toolbar, and menu are from the real extension. Tap an image to explore the details.',
    realPost: 'Right on the post', realActions: 'The ThreadShelf toolbar and menu',
    realZoom: 'Enlarge screenshot', realClose: 'Close screenshot',
    realNote: 'Screenshots shared to illustrate the extension. Posts shown belong to their respective authors.',
  },
  es: {
    eyebrow: 'La extensión en acción', title: 'Se integra directamente en X y Reddit.',
    subtitle: 'Compara publicaciones públicas reales de la biblioteca en X y Reddit con y sin los controles de ThreadShelf.',
    tabs: 'Elegir plataforma', without: 'Antes', with: 'Con ThreadShelf', switchLabel: 'Mostrar lo que añade la extensión',
    join: 'Unirse', save: 'Guardar', update: 'Actualizar', copy: 'Copiar', read: 'Leer', more: 'Todas las acciones de ThreadShelf',
    complete: 'mensajes · completo', openSource: 'Ver publicación original',
    menuTitle: 'ThreadShelf', menuSaveThread: 'Guardar hilo', menuSaveDiscussion: 'Guardar conversación', menuSavePost: 'Guardar esta publicación',
    menuReferences: 'Guardar con citas y enlaces', menuSelection: 'Añadir a una selección…',
    menuCopyThread: 'Copiar hilo (Markdown)', menuCopyDiscussion: 'Copiar conversación (Markdown)', menuCopyPost: 'Copiar publicación', menuCopyText: 'Copiar hilo (texto plano)',
    menuRead: 'Leer en ThreadShelf', menuOptions: 'Colección, etiquetas, nota…', menuLibrary: 'Abrir biblioteca',
    example: 'Publicaciones públicas reales · controles simulados, tu biblioteca no se modifica',
    saved: 'Publicación guardada en la simulación', copied: 'Texto original extraído copiado', copyFailed: 'No se puede copiar aquí',
    selection: 'Las selecciones están en la extensión real', options: 'Las colecciones y notas están en la extensión real', library: 'Tu biblioteca se abre al iniciar sesión',
    reader: 'Leer en ThreadShelf', back: 'Volver a la publicación', readerNote: 'Estos son los textos originales extraídos y guardados de esta publicación.',
    addedTitle: 'Lo que añade ThreadShelf', addedOneTitle: 'Una barra debajo de cada publicación', addedOne: 'Guarda, copia o abre el lector en un clic sin salir de X o Reddit.',
    addedTwoTitle: 'Un menú completo', addedTwo: 'Guarda hilos, citas y enlaces; copia Markdown o texto plano; organiza colecciones y etiquetas.',
    addedThreeTitle: 'Estado de las conversaciones', addedThree: 'En Reddit se muestra el número de mensajes capturados y si la conversación está completa o incompleta.',
    seeGuide: 'Instalar la extensión',
    realEyebrow: 'Capturas reales', realTitle: 'Así se ve la extensión en el navegador.',
    realIntro: 'Estas son capturas originales de X y Reddit. El botón violeta, la barra y el menú pertenecen a la extensión real. Pulsa una imagen para ver los detalles.',
    realPost: 'Directamente en la publicación', realActions: 'La barra y el menú de ThreadShelf',
    realZoom: 'Ampliar captura', realClose: 'Cerrar captura',
    realNote: 'Capturas compartidas para mostrar la extensión. Las publicaciones pertenecen a sus respectivos autores.',
  },
};

const realScreenshots: Record<Platform, [string, string]> = {
  x: ['/showcase/threadshelf-x-post.png', '/showcase/threadshelf-x-menu.png'],
  reddit: ['/showcase/threadshelf-reddit-post.png', '/showcase/threadshelf-reddit-toolbar.png'],
};

function RealScreenshots({ platform, labels }: { platform: Platform; labels: typeof copy.fr }) {
  const [zoomed, setZoomed] = useState<number | null>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const lastTrigger = useRef<HTMLButtonElement>(null);
  const shots = realScreenshots[platform];

  useEffect(() => {
    if (zoomed === null) return;
    const previousOverflow = document.body.style.overflow;
    const onEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setZoomed(null); };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onEscape);
    closeButton.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onEscape);
      lastTrigger.current?.focus();
    };
  }, [zoomed]);

  return <div data-testid="extension-real-gallery" className="mt-8 overflow-hidden rounded-[25px] border border-[#e2dfed] bg-white p-4 shadow-[0_20px_55px_#2f285012] sm:p-7">
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl"><span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[.16em] text-[#765ec2]"><ZoomIn size={15}/>{labels.realEyebrow} · {platform === 'x' ? 'X' : 'Reddit'}</span><h3 className="mt-2 text-[23px] font-bold leading-tight tracking-tight sm:text-[30px]">{labels.realTitle}</h3><p className="mt-2 text-[13px] leading-6 text-[#777589]">{labels.realIntro}</p></div>
    </div>
    <div className="grid gap-4 md:grid-cols-2">
      {shots.map((src, index) => <button key={src} data-testid={`extension-real-screenshot-${index}`} type="button" aria-label={`${labels.realZoom} : ${platform === 'x' ? 'X' : 'Reddit'} · ${index === 0 ? labels.realPost : labels.realActions}`} onClick={(event) => { lastTrigger.current = event.currentTarget; setZoomed(index); }} className="ts-focus group overflow-hidden rounded-[18px] border border-[#e6e4eb] bg-[#f8f8fb] text-left transition hover:border-[#b8a9f0] hover:shadow-[0_10px_35px_#3c2b761c]">
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-[#f0eff5]"><img src={src} alt={`${platform === 'x' ? 'X' : 'Reddit'} : ${index === 0 ? labels.realPost : labels.realActions}`} width={platform === 'x' ? (index === 0 ? 611 : 606) : (index === 0 ? 728 : 817)} height={platform === 'x' ? (index === 0 ? 1015 : 940) : (index === 0 ? 549 : 777)} loading="lazy" decoding="async" className="h-full w-full object-cover object-bottom transition duration-300 group-hover:scale-[1.025]"/><span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-[#282039ed] px-3 py-2 text-[11px] font-semibold text-white shadow-md"><ZoomIn size={14}/>{labels.realZoom}</span></div>
        <div className="flex items-center gap-3 px-4 py-3"><span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-[#eee9fb] text-[#7458c9]">{index === 0 ? '01' : '02'}</span><span className="text-[13px] font-semibold text-[#3d3b4a]">{index === 0 ? labels.realPost : labels.realActions}</span></div>
      </button>)}
    </div>
    <p className="mt-4 text-[11px] leading-5 text-[#9693a1]">{labels.realNote}</p>
    {zoomed !== null ? <div data-testid="extension-real-lightbox" className="fixed inset-0 z-[100] flex items-center justify-center bg-[#111020ed] p-3 sm:p-7" onClick={() => setZoomed(null)} role="presentation"><div role="dialog" aria-modal="true" aria-label={`${platform === 'x' ? 'X' : 'Reddit'} · ${zoomed === 0 ? labels.realPost : labels.realActions}`} onClick={(event) => event.stopPropagation()} className="relative flex max-h-full max-w-[min(100%,1100px)] flex-col items-center gap-3"><button ref={closeButton} type="button" aria-label={labels.realClose} onClick={() => setZoomed(null)} className="ts-focus self-end rounded-full bg-white p-2.5 text-[#332b48] shadow-lg hover:bg-[#eee9fb]"><X size={22}/></button><img src={shots[zoomed]} alt={`${platform === 'x' ? 'X' : 'Reddit'} · ${zoomed === 0 ? labels.realPost : labels.realActions}`} className="max-h-[calc(100dvh-100px)] max-w-full rounded-xl border border-white/20 bg-white object-contain shadow-2xl"/></div></div> : null}
  </div>;
}

function Graphic({ example, openSource }: { example: PublicExample; openSource: string }) {
  const [failed, setFailed] = useState(false);
  return <a href={example.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={`${openSource} : ${example.author}`} className="ts-focus group relative block h-[200px] overflow-hidden rounded-2xl bg-[#f1f2f7] sm:h-[230px]">
    {failed ? <span className="flex h-full items-center justify-center gap-2 text-xs text-[#89889a]"><ImageOff size={19}/> {openSource}</span> : <img src={example.mediaUrl} loading="lazy" decoding="async" referrerPolicy="no-referrer" alt={example.title} onError={() => setFailed(true)} className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.025]"/>}
    <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-lg bg-[#1d2037e6] px-3 py-2 text-[11px] font-semibold text-white"><ExternalLink size={14}/>{example.source}</span>
  </a>;
}
export function ExtensionShowcase() {
  const { language } = useWebI18n();
  const labels = copy[language as WebLanguage] ?? copy.fr;
  const [platform, setPlatform] = useState<Platform>('x');
  const [enabled, setEnabled] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [readerOpen, setReaderOpen] = useState(false);
  const [saved, setSaved] = useState<Record<Platform, boolean>>({ x: false, reddit: false });
  const [notice, setNotice] = useState('');
  const menuTrigger = useRef<HTMLButtonElement>(null);
  const menuPanel = useRef<HTMLDivElement>(null);
  const [menuPosition, setMenuPosition] = useState({ top: 8, left: 8 });
  const isReddit = platform === 'reddit';
  const example = isReddit ? realRedditExample : realXExample;
  const heading = example.title;

  useLayoutEffect(() => {
    if (!menuOpen || !menuTrigger.current || !menuPanel.current) return;
    const anchor = menuTrigger.current.getBoundingClientRect();
    const panel = menuPanel.current.getBoundingClientRect();
    setMenuPosition({
      top: Math.max(8, Math.min(anchor.top - panel.height - 8, window.innerHeight - panel.height - 8)),
      left: Math.max(8, Math.min(anchor.right - panel.width, window.innerWidth - panel.width - 8)),
    });
  }, [menuOpen, platform]);

  function setSamplePlatform(next: Platform) { setPlatform(next); setReaderOpen(false); setMenuOpen(false); setNotice(''); }
  async function act(action: ShowcaseAction) {
    setMenuOpen(false);
    if (action === 'save-thread' || action === 'save-post' || action === 'save-references') {
      setSaved((previous) => ({ ...previous, [platform]: true }));
      setNotice(labels.saved);
    } else if (action === 'copy-thread' || action === 'copy-post' || action === 'copy-text') {
      try {
        await navigator.clipboard.writeText(capturedThreadPlainText(example.id, action === 'copy-post', action === 'copy-thread'));
        setNotice(labels.copied);
      }
      catch { setNotice(labels.copyFailed); }
    } else if (action === 'read') {
      setReaderOpen(true); setNotice('');
    } else if (action === 'select') setNotice(labels.selection);
    else if (action === 'options') setNotice(labels.options);
    else if (action === 'library') setNotice(labels.library);
  }

  const menuGroups: { action: ShowcaseAction; label: string; icon: typeof Save }[][] = [
    [
      { action: 'save-thread', label: isReddit ? labels.menuSaveDiscussion : labels.menuSaveThread, icon: Layers3 },
      { action: 'save-post', label: labels.menuSavePost, icon: Save },
      ...(!isReddit ? [{ action: 'save-references' as const, label: labels.menuReferences, icon: MessageSquareQuote }] : []),
      { action: 'select', label: labels.menuSelection, icon: MousePointerClick },
    ],
    [
      { action: 'copy-thread', label: isReddit ? labels.menuCopyDiscussion : labels.menuCopyThread, icon: Copy },
      { action: 'copy-post', label: labels.menuCopyPost, icon: Copy },
      { action: 'copy-text', label: labels.menuCopyText, icon: FileText },
    ],
    [
      { action: 'read', label: labels.menuRead, icon: BookOpen },
      { action: 'options', label: labels.menuOptions, icon: SlidersHorizontal },
      { action: 'library', label: labels.menuLibrary, icon: Library },
    ],
  ];

  return <section id="sur-x-et-reddit" className="scroll-mt-10 bg-[#f9f8fc] px-4 py-12 text-[#262439] sm:px-8 sm:py-16">
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div className="max-w-3xl"><span className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-[#7b64c5]"><Sparkles size={16}/>{labels.eyebrow}</span><h2 className="mt-3 text-[30px] font-bold leading-tight tracking-[-.045em] sm:text-[43px]">{labels.title}</h2><p className="mt-4 max-w-2xl text-[15px] leading-7 text-[#75738b]">{labels.subtitle}</p></div>
        <div role="tablist" aria-label={labels.tabs} className="flex shrink-0 rounded-xl border border-[#e3deef] bg-white p-1 shadow-sm">{(['x','reddit'] as const).map((name)=><button key={name} type="button" role="tab" data-testid={`extension-platform-${name}`} aria-selected={platform===name} onClick={()=>setSamplePlatform(name)} className={`ts-focus min-h-11 rounded-lg px-5 text-sm font-bold transition ${platform===name?'bg-[#6d56ca] text-white shadow-md':'text-[#79748e] hover:bg-[#f1edfb]'}`}>{name==='x'?'𝕏 · X':'Reddit'}</button>)}</div>
      </div>
      <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(270px,.65fr)]">
        <div className="min-w-0 rounded-[25px] border border-[#e2e0ed] bg-[#f1f2f6] p-3 shadow-[0_25px_70px_#42376814] sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 px-1"><span className="text-[12px] font-bold text-[#77778b]">{isReddit?'Reddit':'X / Twitter'}</span><div aria-label={labels.switchLabel} className="flex items-center rounded-xl border border-[#dad9e5] bg-white p-1 text-[11px] font-semibold"><button type="button" data-testid="extension-before" aria-pressed={!enabled} onClick={()=>{setEnabled(false);setMenuOpen(false);setNotice('');setReaderOpen(false);}} className={`ts-focus rounded-lg px-3 py-2 ${!enabled?'bg-[#28263c] text-white':'text-[#878399]'}`}>{labels.without}</button><button type="button" data-testid="extension-after" aria-pressed={enabled} onClick={()=>setEnabled(true)} className={`ts-focus rounded-lg px-3 py-2 ${enabled?'bg-[#6d56ca] text-white':'text-[#878399]'}`}>{labels.with}</button></div></div>
          <div className="relative mx-auto w-full max-w-[675px] rounded-[20px] border border-[#e4e5e9] bg-white p-3 shadow-sm sm:p-4" data-testid="extension-post-preview">
            {readerOpen ? <div data-testid="extension-reader" className="max-h-[680px] min-h-[495px] overflow-y-auto overscroll-contain pr-1">
              <button type="button" className="ts-focus flex items-center gap-2 text-xs font-semibold text-[#6852c1]" onClick={() => setReaderOpen(false)}><ArrowLeft size={17}/>{labels.back}</button>
              <div className="mx-auto mt-8 max-w-[480px]">
                <span className="text-xs font-bold uppercase tracking-[.15em] text-[#8f7cbd]">{labels.reader}</span>
                <h3 className="mt-3 font-serif text-[28px] font-semibold leading-tight sm:text-[36px]">{heading}</h3>
                <div className="my-5 h-px bg-[#e9e7ed]"/>
                <p className="font-serif text-[17px] leading-8 text-[#555468]">{example.description[language]}</p>
                <div className="my-6"><Graphic key={example.id} example={example} openSource={labels.openSource}/></div>
                <a href={example.sourceUrl} target="_blank" rel="noopener noreferrer" className="ts-focus inline-flex items-center gap-2 text-sm font-bold text-[#6d56ca]"><ExternalLink size={16}/>{labels.openSource}</a>
                <p className="mt-5 rounded-xl bg-[#f1edfc] p-4 text-xs leading-6 text-[#6d5aaf]">{labels.readerNote}</p>
                <ExtractedThread example={example} language={language as WebLanguage}/>
              </div>
            </div> : <>
              <div className="flex items-center gap-3"><div className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${isReddit?'bg-[#ffe9d8] text-[#ee6b31]':'bg-[#dfe1ff] text-[#6252c3]'}`}>{isReddit?'r/':example.author.slice(0, 2).toUpperCase()}</div><div className="min-w-0 flex-1"><span className="block truncate text-[13px] font-bold text-[#232433]">{isReddit?example.handle:example.author} <span className="font-normal text-[#9695a4]">· {example.source}</span></span><span className="block truncate text-[11px] text-[#8a8d9b]">{isReddit?example.author:example.handle}</span></div>{isReddit?<span className="rounded-full bg-[#19191f] px-3 py-1.5 text-[11px] font-bold text-white">{labels.join}</span>:<MoreHorizontal size={19} className="text-[#8c8fa0]"/>}</div>
              <h3 className="mt-3 text-[16px] font-bold leading-snug sm:text-[18px]">{example.title}</h3>
              <p className="mt-2 text-[13px] leading-6 text-[#696b77]">{example.description[language]}</p>
              <div className="mt-3"><Graphic key={example.id} example={example} openSource={labels.openSource}/></div>
              <a href={example.sourceUrl} target="_blank" rel="noopener noreferrer" className="ts-focus mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#6d56ca] hover:underline"><ExternalLink size={13}/>{labels.openSource} · {example.source}</a>
              <div className="mt-3 flex items-center gap-4 border-t border-[#ececf1] pt-2 text-[11px] text-[#808596] sm:gap-7"><span className="flex items-center gap-1"><MessageCircle size={16}/></span><span className="flex items-center gap-1">{isReddit?<ThumbsUp size={16}/>:<Repeat2 size={16}/>} </span><span className="flex items-center gap-1"><Heart size={16}/> </span><span className="ml-auto flex items-center gap-2"><Bookmark size={17}/><Share2 size={17}/>{enabled?<button type="button" aria-label={labels.more} onClick={()=>setMenuOpen((value)=>!value)} className="ts-focus flex size-7 items-center justify-center rounded-lg bg-[#ebe7ff] text-[#755bdf]" data-testid="extension-post-icon"><LogoMark size={17}/></button>:null}</span></div>
              {enabled ? <div className="relative mt-4" data-testid="extension-added-toolbar"><div className="inline-flex max-w-full flex-wrap items-center gap-0.5 rounded-[18px] border border-[#d7d7e5] bg-[#fbfaff] p-1.5 text-[11px] shadow-sm sm:rounded-full sm:text-[12px]"><span className="inline-flex items-center gap-1.5 px-2 font-semibold text-[#6e55d6]"><LogoMark size={17}/> ThreadShelf</span><span className="mx-0.5 h-4 w-px bg-[#dedce8]"/><button type="button" onClick={()=>void act('save-thread')} className="ts-focus rounded-full px-2 py-1.5 font-semibold text-[#6e55d6] hover:bg-[#ece7ff]">{saved[platform]?labels.update:labels.save}</button><span className="h-4 w-px bg-[#dedce8]"/><button type="button" onClick={()=>void act('copy-thread')} className="ts-focus rounded-full px-2 py-1.5 font-semibold hover:bg-[#ece7ff]">{labels.copy}</button><span className="h-4 w-px bg-[#dedce8]"/><button type="button" onClick={()=>void act('read')} className="ts-focus rounded-full px-2 py-1.5 font-semibold hover:bg-[#ece7ff]">{labels.read}</button><span className="h-4 w-px bg-[#dedce8]"/><button type="button" data-testid="extension-more" ref={menuTrigger} aria-label={labels.more} aria-expanded={menuOpen} onClick={()=>setMenuOpen((value)=>!value)} className="ts-focus rounded-full px-2 py-1.5 font-bold hover:bg-[#ece7ff]">•••</button>{isReddit?<span className="whitespace-nowrap px-1.5 text-[10px] text-[#8d8795]"><span className="mr-1 inline-block size-1.5 rounded-full bg-amber-500"/>{example.publicationCount} {labels.complete}</span>:null}</div>
                {menuOpen ? <div ref={menuPanel} role="menu" aria-label={labels.more} data-testid="extension-action-menu" className="fixed z-30 w-[min(290px,calc(100vw-16px))] overflow-hidden rounded-2xl border border-[#e4e1ef] bg-white text-[#333440] shadow-[0_25px_65px_#21183333]" style={menuPosition}><div className="border-b border-[#edebf3] px-4 py-3"><div className="flex items-center gap-2 text-xs font-bold"><LogoMark size={17}/>{labels.menuTitle}</div><p className="mt-1 line-clamp-1 text-[10px] text-[#9292a1]">{example.title}</p></div>{menuGroups.map((group,i)=><div key={i} className="border-b border-[#eeedf2] py-1.5 last:border-0">{group.map(({action,label,icon:Icon})=><button role="menuitem" type="button" key={action} onClick={()=>void act(action)} className="ts-focus flex w-full items-center gap-3 px-4 py-2.5 text-left text-[11px] transition hover:bg-[#f4f1fe] sm:text-[12px]"><Icon size={15} className="shrink-0 text-[#7d7f92]"/>{label}</button>)}</div>)}</div> : null}
              </div> : null}
              {notice && enabled ? <p role="status" className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[#e6f7ed] px-3 py-2 text-[11px] font-semibold text-[#288057]"><Check size={14}/>{notice}</p>:null}
            </>}
          </div>
          <p className="mt-4 text-center text-[11px] text-[#8e8b9b]">{labels.example}</p>
        </div>
        <div className="flex flex-col gap-4 rounded-[25px] border border-[#e5e1f0] bg-white p-6 shadow-[0_15px_50px_#24213d08] sm:p-8"><div className="flex items-center gap-2 text-sm font-bold text-[#7357c3]"><LogoMark size={21}/>{labels.addedTitle}</div>{([
          [Layers3,labels.addedOneTitle,labels.addedOne],
          [MessageSquareQuote,labels.addedTwoTitle,labels.addedTwo],
          [Bookmark,labels.addedThreeTitle,labels.addedThree],
        ] as const).map(([Icon,title,description],index)=><div key={title} className="flex gap-4 border-t border-[#f0eef4] pt-5"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#f0ebff] text-[#775ec8]"><Icon size={20}/></div><div><span className="text-[10px] font-bold uppercase tracking-[.1em] text-[#a09cb4]">0{index+1}</span><h3 className="mt-1 text-sm font-bold text-[#333144]">{title}</h3><p className="mt-2 text-[13px] leading-6 text-[#817d90]">{description}</p></div></div>)}<a href="#installation" className="ts-focus mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#6e56cd] px-5 py-3 text-sm font-bold text-white hover:bg-[#5c45b8]">{labels.seeGuide} <span aria-hidden="true">↗</span></a></div>
      </div>
      <RealScreenshots platform={platform} labels={labels}/>
    </div>
  </section>;
}

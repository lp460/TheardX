import { useLayoutEffect, useRef, useState } from 'react';
import {
  ArrowLeft, BookOpen, Bookmark, Check, Copy, FileText, Heart, Layers3, Library,
  MessageCircle, MessageSquareQuote, MoreHorizontal, MousePointerClick,
  Repeat2, Save, Share2, SlidersHorizontal, Sparkles, ThumbsUp,
} from 'lucide-react';
import { LogoMark } from '@/components/Logo';
import { useWebI18n, type WebLanguage } from './i18n';

type Platform = 'x' | 'reddit';
type ShowcaseAction = 'save-thread' | 'save-post' | 'save-references' | 'select' | 'copy-thread' | 'copy-post' | 'copy-text' | 'read' | 'options' | 'library';

const copy = {
  fr: {
    eyebrow: 'Le plugin, dans son élément', title: 'Il s’ajoute directement à X et Reddit.',
    subtitle: 'Pas de copier-coller compliqué : les commandes ThreadShelf apparaissent sous les publications. Essayez cette reproduction interactive.',
    tabs: 'Choisir une plateforme', without: 'Avant', with: 'Avec ThreadShelf', switchLabel: 'Afficher les ajouts de l’extension',
    xText: 'J’ai rassemblé mes meilleurs conseils pour construire une veille technique utile, sans perdre les découvertes importantes.',
    xArticle: 'Le guide pratique pour une veille qui dure', xArticleExcerpt: 'Des outils simples, une meilleure organisation et quelques habitudes pour retrouver l’essentiel.',
    xMedia: 'Un espace de travail plus clair', xMediaSmall: 'Une méthode, quelques outils, de bonnes idées.',
    redditCommunity: 'r/Productivity', redditTitle: 'Comment organisez-vous vos découvertes sur le web ?', redditText: 'Je teste un système pour conserver mes articles et revenir les lire plus tard. Voici un exemple d’interface.',
    redditVisual: 'Organisez vos idées', redditVisualSub: 'Une bibliothèque qui reste lisible.',
    join: 'Rejoindre', save: 'Enregistrer', update: 'Mettre à jour', copy: 'Copier', read: 'Lire', more: 'Toutes les actions ThreadShelf',
    thread: 'le thread', post: 'cette publication', redditThread: 'la discussion', complete: 'messages · incomplet',
    menuTitle: 'ThreadShelf', menuSaveThread: 'Enregistrer le thread', menuSaveDiscussion: 'Enregistrer la discussion', menuSavePost: 'Enregistrer cette publication',
    menuReferences: 'Enregistrer avec citations et liens', menuSelection: 'Ajouter à une sélection…',
    menuCopyThread: 'Copier le thread (Markdown)', menuCopyDiscussion: 'Copier la discussion (Markdown)',
    menuCopyPost: 'Copier cette publication', menuCopyText: 'Copier le thread (texte brut)',
    menuRead: 'Lire dans ThreadShelf', menuOptions: 'Collection, tags, note…', menuLibrary: 'Ouvrir la bibliothèque',
    example: 'Simulation interactive · aucune action sur votre bibliothèque',
    saved: 'Publication enregistrée dans la simulation', copied: 'Texte fictif copié', copyFailed: 'Copie impossible ici',
    selection: 'Sélection disponible dans l’extension réelle', options: 'Collections et notes disponibles dans l’extension réelle', library: 'Votre vraie bibliothèque s’ouvre après connexion',
    reader: 'Lecture dans ThreadShelf', back: 'Retour à la publication', readerNote: 'Dans l’extension réelle, ce bouton ouvre le lecteur avec la publication complète.',
    addedTitle: 'Ce que ThreadShelf ajoute', addedOneTitle: 'Une barre directement sous le post', addedOne: 'Enregistrer, copier ou ouvrir le lecteur en un clic, sans quitter X ou Reddit.',
    addedTwoTitle: 'Un menu de capture complet', addedTwo: 'Sauvegarde du fil, des citations et des liens ; copie Markdown ou texte brut ; collections et tags.',
    addedThreeTitle: 'Un suivi des fils', addedThree: 'Sur Reddit, le nombre de messages et l’état « incomplet » sont visibles dans la barre.',
    seeGuide: 'Installer l’extension',
  },
  en: {
    eyebrow: 'The extension in action', title: 'It works right inside X and Reddit.',
    subtitle: 'No complicated copy and paste: ThreadShelf controls appear beneath posts. Try this interactive recreation.',
    tabs: 'Choose a platform', without: 'Before', with: 'With ThreadShelf', switchLabel: 'Show extension additions',
    xText: 'I put together my favorite tips for building a useful research collection without losing the good discoveries.',
    xArticle: 'A practical guide to lasting research habits', xArticleExcerpt: 'Simple tools, better organization, and a few habits for finding what matters.',
    xMedia: 'A clearer workspace', xMediaSmall: 'One method, a few tools, lots of good ideas.',
    redditCommunity: 'r/Productivity', redditTitle: 'How do you organize the things you discover online?', redditText: 'I am trying a system to save articles and actually read them later. Here is an interface example.',
    redditVisual: 'Organize your ideas', redditVisualSub: 'A library that stays readable.',
    join: 'Join', save: 'Save', update: 'Update', copy: 'Copy', read: 'Read', more: 'All ThreadShelf actions',
    thread: 'the thread', post: 'this post', redditThread: 'the discussion', complete: 'messages · incomplete',
    menuTitle: 'ThreadShelf', menuSaveThread: 'Save thread', menuSaveDiscussion: 'Save discussion', menuSavePost: 'Save this post',
    menuReferences: 'Save with quotes and links', menuSelection: 'Add to a selection…',
    menuCopyThread: 'Copy thread (Markdown)', menuCopyDiscussion: 'Copy discussion (Markdown)', menuCopyPost: 'Copy this post', menuCopyText: 'Copy thread (plain text)',
    menuRead: 'Read in ThreadShelf', menuOptions: 'Collection, tags, note…', menuLibrary: 'Open library',
    example: 'Interactive simulation · no changes to your library',
    saved: 'Post saved in this simulation', copied: 'Fictional text copied', copyFailed: 'Clipboard unavailable here',
    selection: 'Selections are available in the real extension', options: 'Collections and notes are available in the real extension', library: 'Your real library opens after sign-in',
    reader: 'Read in ThreadShelf', back: 'Back to post', readerNote: 'In the real extension, this opens the reader with the full saved content.',
    addedTitle: 'What ThreadShelf adds', addedOneTitle: 'A toolbar below each post', addedOne: 'Save, copy or open the reader in one click without leaving X or Reddit.',
    addedTwoTitle: 'A full capture menu', addedTwo: 'Save threads, quotes and links; copy Markdown or plain text; organize with collections and tags.',
    addedThreeTitle: 'Thread status at a glance', addedThree: 'On Reddit, the toolbar shows the message count and whether the discussion is incomplete.',
    seeGuide: 'Install the extension',
  },
  es: {
    eyebrow: 'La extensión en acción', title: 'Se integra directamente en X y Reddit.',
    subtitle: 'Sin complicaciones: los controles de ThreadShelf aparecen debajo de las publicaciones. Prueba esta recreación interactiva.',
    tabs: 'Elegir plataforma', without: 'Antes', with: 'Con ThreadShelf', switchLabel: 'Mostrar lo que añade la extensión',
    xText: 'He reunido mis mejores consejos para organizar información técnica sin perder los descubrimientos importantes.',
    xArticle: 'Guía práctica para investigar mejor', xArticleExcerpt: 'Herramientas sencillas, organización y hábitos para recuperar lo importante.',
    xMedia: 'Un espacio más claro', xMediaSmall: 'Un método, algunas herramientas y buenas ideas.',
    redditCommunity: 'r/Productivity', redditTitle: '¿Cómo organizáis lo que descubrís en Internet?', redditText: 'Estoy probando un sistema para guardar artículos y leerlos más tarde. Este es un ejemplo de interfaz.',
    redditVisual: 'Organiza tus ideas', redditVisualSub: 'Una biblioteca siempre legible.',
    join: 'Unirse', save: 'Guardar', update: 'Actualizar', copy: 'Copiar', read: 'Leer', more: 'Todas las acciones de ThreadShelf',
    thread: 'el hilo', post: 'esta publicación', redditThread: 'la conversación', complete: 'mensajes · incompleto',
    menuTitle: 'ThreadShelf', menuSaveThread: 'Guardar hilo', menuSaveDiscussion: 'Guardar conversación', menuSavePost: 'Guardar esta publicación',
    menuReferences: 'Guardar con citas y enlaces', menuSelection: 'Añadir a una selección…',
    menuCopyThread: 'Copiar hilo (Markdown)', menuCopyDiscussion: 'Copiar conversación (Markdown)', menuCopyPost: 'Copiar publicación', menuCopyText: 'Copiar hilo (texto plano)',
    menuRead: 'Leer en ThreadShelf', menuOptions: 'Colección, etiquetas, nota…', menuLibrary: 'Abrir biblioteca',
    example: 'Simulación interactiva · tu biblioteca no se modifica',
    saved: 'Publicación guardada en la simulación', copied: 'Texto ficticio copiado', copyFailed: 'No se puede copiar aquí',
    selection: 'Las selecciones están en la extensión real', options: 'Las colecciones y notas están en la extensión real', library: 'Tu biblioteca se abre al iniciar sesión',
    reader: 'Leer en ThreadShelf', back: 'Volver a la publicación', readerNote: 'En la extensión real, este botón abre el lector con el contenido completo.',
    addedTitle: 'Lo que añade ThreadShelf', addedOneTitle: 'Una barra debajo de cada publicación', addedOne: 'Guarda, copia o abre el lector en un clic sin salir de X o Reddit.',
    addedTwoTitle: 'Un menú completo', addedTwo: 'Guarda hilos, citas y enlaces; copia Markdown o texto plano; organiza colecciones y etiquetas.',
    addedThreeTitle: 'Estado de las conversaciones', addedThree: 'En Reddit se muestra el número de mensajes y si la conversación está incompleta.',
    seeGuide: 'Instalar la extensión',
  },
};

function Graphic({ platform, labels }: { platform: Platform; labels: typeof copy.fr }) {
  return <div aria-hidden="true" className={`relative flex h-[135px] w-full flex-col justify-center overflow-hidden rounded-2xl sm:h-[150px] ${platform === 'x' ? 'bg-gradient-to-br from-[#18122c] via-[#382b70] to-[#a58ddf]' : 'bg-gradient-to-br from-[#c7e4f1] via-[#e7eef9] to-[#d1c6ee]'}`}>
    <div className="absolute -right-10 -top-16 size-52 rounded-full bg-white/10 blur-2xl" />
    {platform === 'x' ? <div className="relative mx-auto flex w-[82%] max-w-[390px] -rotate-3 flex-col gap-2 rounded-2xl border border-white/25 bg-white/15 p-4 shadow-[0_20px_60px_#09061966] backdrop-blur-sm"><div className="flex gap-2"><span className="size-3 rounded-full bg-[#ffadac]" /><span className="size-3 rounded-full bg-[#fee1a0]" /><span className="size-3 rounded-full bg-[#a2dbba]" /></div><span className="mt-1 h-2 w-3/4 rounded bg-white/70" /><span className="h-2 w-1/2 rounded bg-white/35"/><div className="mt-2 grid grid-cols-3 gap-2">{[0,1,2].map((v)=><span key={v} className="flex h-12 items-center justify-center rounded-lg bg-[#a996ff]/45 text-2xl text-white/75">✦</span>)}</div><p className="text-center text-[13px] font-bold text-white">{labels.xMedia}</p><p className="text-center text-[10px] text-white/70">{labels.xMediaSmall}</p></div> : <div className="relative mx-auto w-[86%] max-w-[400px] rounded-2xl border border-[#ffffffbd] bg-white/90 p-4 shadow-[0_20px_50px_#50578a33]"><div className="flex items-center justify-between"><span className="font-bold text-[#3b3e55]">{labels.redditVisual}</span><span className="rounded-lg bg-[#ddd7ff] px-2 py-1 text-[10px] font-semibold text-[#6954ba]">#veille</span></div><div className="mt-4 grid grid-cols-3 gap-3">{['#d7e7fb','#d6f0dd','#ffdfc5'].map((v,i)=><div key={i} className="rounded-xl p-2" style={{backgroundColor:v}}><div className="mb-3 size-6 rounded-lg bg-white/75"/><div className="h-1.5 w-4/5 rounded bg-[#7f86a3]/30"/><div className="mt-1.5 h-1.5 w-2/3 rounded bg-[#7f86a3]/25"/></div>)}</div><p className="mt-3 text-[10px] text-[#737b8e]">{labels.redditVisualSub}</p></div>}
  </div>;
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
  const heading = isReddit ? labels.redditTitle : labels.xArticle;
  const sample = isReddit ? `${labels.redditTitle}\n\n${labels.redditText}` : `${labels.xText}\n\n${labels.xArticle}`;

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
      try { await navigator.clipboard.writeText(sample); setNotice(labels.copied); }
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
            {readerOpen ? <div data-testid="extension-reader" className="min-h-[495px]"><button type="button" className="ts-focus flex items-center gap-2 text-xs font-semibold text-[#6852c1]" onClick={()=>setReaderOpen(false)}><ArrowLeft size={17}/>{labels.back}</button><div className="mx-auto mt-8 max-w-[480px]"><span className="text-xs font-bold uppercase tracking-[.15em] text-[#8f7cbd]">{labels.reader}</span><h3 className="mt-3 font-serif text-[28px] font-semibold leading-tight sm:text-[36px]">{heading}</h3><div className="my-5 h-px bg-[#e9e7ed]"/><p className="font-serif text-[17px] leading-8 text-[#555468]">{sample}</p><p className="mt-7 rounded-xl bg-[#f1edfc] p-4 text-xs leading-6 text-[#6d5aaf]">{labels.readerNote}</p></div></div> : <>
              <div className="flex items-center gap-3"><div className={`flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${isReddit?'bg-[#ffe9d8] text-[#ee6b31]':'bg-[#dfe1ff] text-[#6252c3]'}`}>{isReddit?'r/':'AL'}</div><div className="min-w-0 flex-1"><span className="block truncate text-[13px] font-bold text-[#232433]">{isReddit?labels.redditCommunity:'Alex Laurent'} <span className="font-normal text-[#9695a4]">· 2h</span></span><span className="block truncate text-[11px] text-[#8a8d9b]">{isReddit?'u/AlexBuilds':'@alex_veille'}</span></div>{isReddit?<span className="rounded-full bg-[#19191f] px-3 py-1.5 text-[11px] font-bold text-white">{labels.join}</span>:<MoreHorizontal size={19} className="text-[#8c8fa0]"/>}</div>
              <h3 className="mt-3 text-[16px] font-bold leading-snug sm:text-[18px]">{isReddit?labels.redditTitle:labels.xText}</h3>
              {isReddit?<p className="mt-2 text-[13px] leading-6 text-[#525563]">{labels.redditText}</p>:<p className="mt-2 text-[13px] leading-6 text-[#696b77]">{labels.xMediaSmall}</p>}
              <div className="mt-3"><Graphic platform={platform} labels={labels}/></div>
              {!isReddit ? <div className="mt-2 rounded-xl border border-[#e5e7ec] bg-[#fafafa] px-3 py-2"><span className="text-[9px] font-semibold uppercase text-[#9c96b2]">Article</span><h4 className="mt-0.5 text-[12px] font-bold">{labels.xArticle}</h4><p className="line-clamp-1 text-[10px] text-[#7f828e]">{labels.xArticleExcerpt}</p></div> : null}
              <div className="mt-3 flex items-center gap-4 border-t border-[#ececf1] pt-2 text-[11px] text-[#808596] sm:gap-7"><span className="flex items-center gap-1"><MessageCircle size={16}/>{isReddit?'48':'19'}</span><span className="flex items-center gap-1">{isReddit?<ThumbsUp size={16}/>:<Repeat2 size={16}/>} {isReddit?'266':'106'}</span><span className="flex items-center gap-1"><Heart size={16}/> {isReddit?'1,2k':'829'}</span><span className="ml-auto flex items-center gap-2"><Bookmark size={17}/><Share2 size={17}/>{enabled?<button type="button" aria-label={labels.more} onClick={()=>setMenuOpen((value)=>!value)} className="ts-focus flex size-7 items-center justify-center rounded-lg bg-[#ebe7ff] text-[#755bdf]" data-testid="extension-post-icon"><LogoMark size={17}/></button>:null}</span></div>
              {enabled ? <div className="relative mt-4" data-testid="extension-added-toolbar"><div className="inline-flex max-w-full flex-wrap items-center gap-0.5 rounded-[18px] border border-[#d7d7e5] bg-[#fbfaff] p-1.5 text-[11px] shadow-sm sm:rounded-full sm:text-[12px]"><span className="inline-flex items-center gap-1.5 px-2 font-semibold text-[#6e55d6]"><LogoMark size={17}/> ThreadShelf</span><span className="mx-0.5 h-4 w-px bg-[#dedce8]"/><button type="button" onClick={()=>void act('save-thread')} className="ts-focus rounded-full px-2 py-1.5 font-semibold text-[#6e55d6] hover:bg-[#ece7ff]">{saved[platform]?labels.update:labels.save}</button><span className="h-4 w-px bg-[#dedce8]"/><button type="button" onClick={()=>void act('copy-thread')} className="ts-focus rounded-full px-2 py-1.5 font-semibold hover:bg-[#ece7ff]">{labels.copy}</button><span className="h-4 w-px bg-[#dedce8]"/><button type="button" onClick={()=>void act('read')} className="ts-focus rounded-full px-2 py-1.5 font-semibold hover:bg-[#ece7ff]">{labels.read}</button><span className="h-4 w-px bg-[#dedce8]"/><button type="button" data-testid="extension-more" ref={menuTrigger} aria-label={labels.more} aria-expanded={menuOpen} onClick={()=>setMenuOpen((value)=>!value)} className="ts-focus rounded-full px-2 py-1.5 font-bold hover:bg-[#ece7ff]">•••</button>{isReddit?<span className="whitespace-nowrap px-1.5 text-[10px] text-[#8d8795]"><span className="mr-1 inline-block size-1.5 rounded-full bg-amber-500"/>101 {labels.complete}</span>:null}</div>
                {menuOpen ? <div ref={menuPanel} role="menu" aria-label={labels.more} data-testid="extension-action-menu" className="fixed z-30 w-[min(290px,calc(100vw-16px))] overflow-hidden rounded-2xl border border-[#e4e1ef] bg-white text-[#333440] shadow-[0_25px_65px_#21183333]" style={menuPosition}><div className="border-b border-[#edebf3] px-4 py-3"><div className="flex items-center gap-2 text-xs font-bold"><LogoMark size={17}/>{labels.menuTitle}</div><p className="mt-1 line-clamp-1 text-[10px] text-[#9292a1]">{isReddit?labels.redditTitle:labels.xText}</p></div>{menuGroups.map((group,i)=><div key={i} className="border-b border-[#eeedf2] py-1.5 last:border-0">{group.map(({action,label,icon:Icon})=><button role="menuitem" type="button" key={action} onClick={()=>void act(action)} className="ts-focus flex w-full items-center gap-3 px-4 py-2.5 text-left text-[11px] transition hover:bg-[#f4f1fe] sm:text-[12px]"><Icon size={15} className="shrink-0 text-[#7d7f92]"/>{label}</button>)}</div>)}</div> : null}
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
    </div>
  </section>;
}

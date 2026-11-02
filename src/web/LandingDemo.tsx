import { useMemo, useState } from 'react';
import { ArrowLeft, Bookmark, CheckCircle2, Clock3, Folder, Grid2X2, List, Menu, Search, Star, X } from 'lucide-react';
import { LogoMark } from '@/components/Logo';
import { useWebI18n, type WebLanguage } from './i18n';

type DemoEntry = {
  id: string;
  author: string;
  handle: string;
  source: 'X' | 'Reddit';
  category: 'IA' | '3D' | 'outil' | 'design';
  visual: 'canvas' | 'code' | 'shapes' | 'gradient' | 'wave' | 'grid';
  title: Record<WebLanguage, string>;
  excerpt: Record<WebLanguage, string>;
};

/** Fictional entries only: the preview never reads the real Dexie library. */
const entries: DemoEntry[] = [
  { id: 'one', author: 'Camille Martin', handle: '@camille_dev', source: 'X', category: 'IA', visual: 'canvas',
    title: { fr: 'Une application vocale libre qui change la façon d’écrire', en: 'An open-source voice app that changes how we write', es: 'Una aplicación de voz libre que transforma la escritura' },
    excerpt: { fr: 'Un petit projet ambitieux pour dicter, corriger et organiser ses idées, directement sur son ordinateur.', en: 'An ambitious little project for dictating, editing and organizing ideas right on your computer.', es: 'Un proyecto para dictar, corregir y organizar ideas directamente en tu ordenador.' } },
  { id: 'two', author: 'Alex Rivera', handle: '@alexbuilds', source: 'X', category: '3D', visual: 'shapes',
    title: { fr: 'Créer des scènes 3D à partir d’une simple description', en: 'Build 3D scenes from a simple description', es: 'Crear escenas 3D a partir de una descripción' },
    excerpt: { fr: 'Le prototype combine génération et rendu en temps réel. Quelques exemples valent le détour.', en: 'This prototype combines generation with real-time rendering. The examples are worth exploring.', es: 'El prototipo combina generación y renderizado en tiempo real.' } },
  { id: 'three', author: 'Noa Petit', handle: '@noapetit', source: 'Reddit', category: 'outil', visual: 'code',
    title: { fr: 'Une astuce pour transformer ses notes en petite bibliothèque', en: 'A clever way to turn notes into a personal library', es: 'Un truco para convertir notas en una biblioteca personal' },
    excerpt: { fr: 'Une discussion pleine de conseils pratiques pour retrouver les sources enregistrées.', en: 'A discussion packed with practical advice for finding saved sources again.', es: 'Una conversación llena de consejos para recuperar fuentes guardadas.' } },
  { id: 'four', author: 'Maya Laurent', handle: '@mayacreates', source: 'X', category: 'design', visual: 'grid',
    title: { fr: 'Les petits détails qui rendent une interface plus agréable', en: 'Small details that make an interface feel better', es: 'Pequeños detalles que mejoran una interfaz' },
    excerpt: { fr: 'Une collection de micro-interactions, de composants et de bonnes pratiques de design.', en: 'A collection of micro-interactions, components and thoughtful design practices.', es: 'Microinteracciones, componentes y buenas prácticas de diseño.' } },
  { id: 'five', author: 'Sam Durand', handle: '@samcodes', source: 'X', category: 'IA', visual: 'wave',
    title: { fr: 'Comprendre les modèles audio en cinq minutes', en: 'Understanding audio models in five minutes', es: 'Entender los modelos de audio en cinco minutos' },
    excerpt: { fr: 'Une explication visuelle et accessible des nouvelles méthodes de synthèse vocale.', en: 'A visual, approachable explanation of new speech synthesis methods.', es: 'Una explicación visual y accesible de la síntesis de voz.' } },
  { id: 'six', author: 'Lina Torres', handle: '@linatorres', source: 'Reddit', category: 'outil', visual: 'gradient',
    title: { fr: 'Un outil minimaliste pour garder les liens importants', en: 'A minimal tool for keeping important links', es: 'Una herramienta minimalista para guardar enlaces' },
    excerpt: { fr: 'J’ai cherché une solution simple, locale et qui fonctionne même sans réseau.', en: 'I wanted something simple, local, and useful even without a connection.', es: 'Buscaba algo simple, local y disponible sin conexión.' } },
  { id: 'seven', author: 'Robin Chen', handle: '@robinchen', source: 'X', category: '3D', visual: 'shapes',
    title: { fr: 'Une nouvelle technique pour animer des objets en 3D', en: 'A new technique for animating 3D objects', es: 'Una técnica nueva para animar objetos 3D' },
    excerpt: { fr: 'Des résultats étonnants avec un pipeline ouvert et quelques scripts faciles à adapter.', en: 'Surprising results with an open pipeline and a few adaptable scripts.', es: 'Resultados sorprendentes con herramientas abiertas.' } },
  { id: 'eight', author: 'Eva Moreau', handle: '@evamoreau', source: 'X', category: 'design', visual: 'canvas',
    title: { fr: 'Pourquoi les espaces blancs améliorent la lecture', en: 'Why whitespace makes reading better', es: 'Por qué el espacio en blanco mejora la lectura' },
    excerpt: { fr: 'Quelques exemples très concrets pour créer des interfaces plus calmes et plus lisibles.', en: 'Practical examples for designing calmer, more readable interfaces.', es: 'Ejemplos para diseñar interfaces más claras y tranquilas.' } },
  { id: 'nine', author: 'Jules Simon', handle: '@julessimon', source: 'Reddit', category: 'IA', visual: 'code',
    title: { fr: 'Comment organiser une veille technique sans se perdre', en: 'How to organize research without getting overwhelmed', es: 'Cómo organizar la investigación sin perderse' },
    excerpt: { fr: 'Une méthode légère pour trier les idées et revenir à l’essentiel plus tard.', en: 'A lightweight method for sorting ideas and revisiting what matters.', es: 'Un método sencillo para organizar ideas y revisarlas después.' } },
];

function MiniArtwork({ kind }: { kind: DemoEntry['visual'] }) {
  if (kind === 'code') return <div className="flex h-full flex-col justify-center gap-2 bg-[#181b26] px-5"><span className="h-2 w-2/3 rounded bg-[#76b9d4]" /><span className="h-2 w-4/5 rounded bg-[#ac8bed]" /><span className="h-2 w-1/2 rounded bg-[#b8d797]" /><span className="h-2 w-3/4 rounded bg-[#d3b492]" /><span className="h-2 w-2/5 rounded bg-[#79b2c8]" /></div>;
  if (kind === 'shapes') return <div className="relative flex h-full items-center justify-center overflow-hidden bg-gradient-to-br from-[#ccd5f0] via-[#eef0fa] to-[#cfbce6]"><div className="absolute left-[12%] top-[15%] size-16 rotate-12 rounded-2xl border-8 border-[#8068b8]/45 shadow-xl" /><div className="relative size-24 -rotate-12 rounded-[32%] bg-gradient-to-br from-[#4d7bad] via-[#bda1dc] to-[#ebc9ae] shadow-[12px_15px_20px_#554d8244]" /><div className="absolute bottom-4 right-8 size-12 rounded-full bg-[#79bbba] shadow-lg" /></div>;
  if (kind === 'wave') return <div className="flex h-full items-center justify-center gap-[3px] bg-gradient-to-br from-[#dce8ff] to-[#f5edf6]">{[8,14,26,17,39,55,28,18,45,61,33,19,47,27,14,29,17,8].map((h,i) => <span key={i} className="w-[3px] rounded-full bg-[#6559e8]" style={{ height: `${h}%` }} />)}</div>;
  if (kind === 'grid') return <div className="grid h-full grid-cols-3 gap-2 bg-[#f6f5fb] p-4">{['#eee8fc','#b7e3db','#ffe8c5','#d5dafb','#e5c9ea','#c7e3f1'].map((color,i) => <div key={i} className="flex items-center justify-center rounded-lg border border-white shadow-sm" style={{backgroundColor:color}}><span className="size-5 rounded-md border-2 border-white/70" /></div>)}</div>;
  if (kind === 'gradient') return <div className="flex h-full items-center justify-center bg-gradient-to-br from-[#acedd6] via-[#f9f5bc] to-[#c0b5fc]"><span className="rounded-2xl border border-white/60 bg-white/50 px-6 py-4 text-sm font-bold tracking-tight text-[#4f6271] shadow-xl">local first.</span></div>;
  return <div className="flex h-full items-center justify-center bg-[#f6f6f2]"><div className="flex h-10 items-center gap-2 rounded-full border border-[#ecece8] bg-white px-5 shadow-[0_4px_15px_#e9e9e6]"><span className="size-2 rounded-full bg-[#735be1]" /><span className="h-1.5 w-16 rounded bg-[#dedde7]" /><span className="size-2 rounded-full bg-[#b6e2ce]" /></div></div>;
}

export function LandingDemo() {
  const { t, language } = useWebI18n();
  const [screen, setScreen] = useState<'library' | 'reader'>('library');
  const [selected, setSelected] = useState(entries[0]!.id);
  const [view, setView] = useState<'all' | 'later' | 'unread' | 'favorites'>('all');
  const [search, setSearch] = useState('');
  const [source, setSource] = useState('all');
  const [category, setCategory] = useState('all');
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [sort, setSort] = useState('newest');
  const [favorites, setFavorites] = useState<string[]>(['four', 'seven']);
  const [later, setLater] = useState<string[]>(['two', 'five', 'nine']);
  const [read, setRead] = useState<string[]>(['three', 'eight']);
  const [mobileMenu, setMobileMenu] = useState(false);
  const locale = (language || 'fr') as WebLanguage;
  const filtered = useMemo(() => entries.filter((item) => {
    const matchesView = view === 'all' || (view === 'later' && later.includes(item.id)) || (view === 'favorites' && favorites.includes(item.id)) || (view === 'unread' && !read.includes(item.id));
    return matchesView && (source === 'all' || source === item.source) && (category === 'all' || category === item.category)
      && `${item.title[locale]} ${item.excerpt[locale]} ${item.author} ${item.handle} ${item.category}`.toLowerCase().includes(search.trim().toLowerCase());
  }).sort((a,b) => sort === 'oldest' ? entries.indexOf(b) - entries.indexOf(a) : entries.indexOf(a) - entries.indexOf(b)), [view, later, favorites, read, source, category, search, sort, locale]);
  const active = entries.find((entry) => entry.id === selected) || entries[0]!;
  const labels = {
    fr: { preview: 'Aperçu de la vraie interface', filters: 'Filtres', posts: 'publications', verified: 'Complet et vérifié', source: 'Sources', newest: 'Enregistrés récemment', oldest: 'Plus anciens', open: 'Ouvrir', clear: 'Réinitialiser', saved: 'Enregistrer pour plus tard', read: 'Marquer comme lu' },
    en: { preview: 'Preview of the actual interface', filters: 'Filters', posts: 'posts', verified: 'Complete & verified', source: 'Sources', newest: 'Recently saved', oldest: 'Oldest first', open: 'Open', clear: 'Reset', saved: 'Save for later', read: 'Mark as read' },
    es: { preview: 'Vista previa de la interfaz real', filters: 'Filtros', posts: 'publicaciones', verified: 'Completo y verificado', source: 'Fuentes', newest: 'Guardados recientemente', oldest: 'Más antiguos', open: 'Abrir', clear: 'Restablecer', saved: 'Guardar para después', read: 'Marcar como leído' },
  }[locale];
  const toggle = (id: string, items: string[], update: (next: string[]) => void) => update(items.includes(id) ? items.filter((x) => x !== id) : [...items, id]);
  const navigate = (next: typeof view) => { setView(next); setScreen('library'); setMobileMenu(false); };

  return <section id="apercu" aria-label={t('demoAria')} className="relative scroll-mt-8">
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-white">
      <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold"><span className="size-2 rounded-full bg-emerald-300" />{t('demoBadge')}</span>
      <span className="text-xs text-[#b5b7d2]">{labels.preview}</span>
    </div>
    <div data-testid="landing-demo" className="overflow-hidden rounded-[18px] border border-[#e2e3ea] bg-white text-[#292c35] shadow-[0_30px_80px_rgba(3,6,23,.38)] sm:rounded-[22px]">
      <div className="flex h-10 items-center gap-3 border-b border-[#e9eaf0] bg-[#fafafd] px-4"><div className="flex gap-1.5"><span className="size-2.5 rounded-full bg-[#f1a7a7]" /><span className="size-2.5 rounded-full bg-[#e9cc83]" /><span className="size-2.5 rounded-full bg-[#98d9ba]" /></div><span className="mx-auto rounded-md border border-[#e9e9f1] bg-white px-7 py-1 text-[10px] text-[#83869a]">theard-x.vercel.app</span><span className="w-9" /></div>
      <div className="relative flex h-[590px] min-w-0 sm:h-[650px]">
        <aside aria-label={t('demoNavigation')} className={`${mobileMenu ? 'absolute inset-y-0 left-0 z-20 flex w-[205px] shadow-xl' : 'hidden'} shrink-0 flex-col border-r border-[#e8e9ed] bg-[#f9f9fb] p-3 md:flex md:w-[190px] lg:w-[205px]`}>
          <div className="mb-5 flex items-center gap-2 px-1 pt-1 text-[13px] font-bold"><LogoMark size={22} />TheardX<button type="button" aria-label={t('closeMenu')} onClick={() => setMobileMenu(false)} className="ml-auto md:hidden"><X size={17} /></button></div>
          <div className="mb-3 flex items-center gap-2 rounded-md border border-[#e7e7ed] bg-white px-2 py-2 text-[11px] text-[#9696a3]"><Search size={13} /><span>{t('search')}</span></div>
          {([['all',t('all')],['later',t('later')],['unread',t('unread')],['favorites',t('favorites')]] as const).map(([id,label]) => <button key={id} type="button" data-testid={`demo-nav-${id}`} onClick={() => navigate(id)} aria-pressed={view===id} className={`ts-focus mb-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] ${view===id ? 'bg-white font-bold text-[#5545c4] shadow-sm' : 'text-[#747985] hover:bg-white'}`}>{id==='all' ? <Grid2X2 size={14}/> : id==='later' ? <Clock3 size={14}/> : id==='favorites' ? <Star size={14}/> : <Bookmark size={14}/>}<span className="flex-1">{label}</span><span className="text-[10px] font-normal text-[#a1a3ae]">{id==='all' ? entries.length : id==='later' ? later.length : id==='favorites' ? favorites.length : entries.length-read.length}</span></button>)}
          <div className="mt-5 border-t border-[#e7e8ec] pt-4 text-[10px] font-bold uppercase tracking-[.11em] text-[#a1a3af]">{t('collections')}</div><div className="mt-3 flex items-center gap-2 text-[11px] text-[#7b808b]"><Folder size={13} className="text-[#36a078]" /> Veille Tech <span className="ml-auto">09</span></div>
          <div className="mt-6 text-[10px] font-bold uppercase tracking-[.11em] text-[#a1a3af]">{t('categories')}</div>{(['IA','3D','outil','design'] as const).map((cat) => <button type="button" key={cat} onClick={() => { setCategory(category===cat?'all':cat); setMobileMenu(false); }} className={`mt-2.5 flex items-center gap-2 text-[11px] ${category===cat ? 'font-bold text-[#6653d1]' : 'text-[#81838e]'}`}><span className="size-2 rounded-sm border border-[#6a66e7]" />{cat}</button>)}
          <div className="mt-auto border-t border-[#ececf0] pt-3 text-[10px] text-[#9296a4]">{t('localStorage')}</div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex min-h-[60px] items-center justify-between gap-2 border-b border-[#e9eaee] px-3 sm:px-5">
            <div className="flex items-center gap-2"><button type="button" aria-label={t('menu')} onClick={() => setMobileMenu((v)=>!v)} className="ts-focus rounded-lg p-1.5 text-[#616379] md:hidden"><Menu size={20}/></button><h3 className="text-[16px] font-bold tracking-tight sm:text-lg">{screen==='reader' ? t('demoReader') : t('library')} <span className="ml-1 text-xs font-normal text-[#a9aab3]">{screen==='library' ? filtered.length : ''}</span></h3></div>
            <div className="flex items-center gap-1 rounded-lg border border-[#ececf0] p-1"><button type="button" aria-label={t('cards')} aria-pressed={layout==='grid'} onClick={()=>setLayout('grid')} className={`ts-focus rounded-md p-1.5 ${layout==='grid'?'bg-[#f0eff6] text-[#6252c5]':'text-[#9a9ba6]'}`}><Grid2X2 size={16}/></button><button type="button" aria-label={t('list')} aria-pressed={layout==='list'} onClick={()=>setLayout('list')} className={`ts-focus rounded-md p-1.5 ${layout==='list'?'bg-[#f0eff6] text-[#6252c5]':'text-[#9a9ba6]'}`}><List size={16}/></button></div>
          </div>
          {screen==='library' ? <div role="tabpanel" aria-label={t('library')} data-testid="demo-library-panel" className="flex min-h-0 flex-1 flex-col">
            <div className="flex flex-wrap items-center gap-2 border-b border-[#ebebef] px-3 py-3 sm:px-5">
              <label className="flex min-w-[155px] flex-1 items-center gap-2 rounded-lg border border-[#e6e6ed] bg-white px-3 py-2 text-[#9c9ca9] lg:max-w-[280px]"><Search size={14}/><input data-testid="demo-search" aria-label={t('searchLibrary')} value={search} onChange={(e)=>setSearch(e.target.value)} placeholder={t('search')} className="w-full min-w-0 bg-transparent text-[12px] text-[#32343d] outline-none placeholder:text-[#a4a5ae]" /></label>
              <select aria-label={labels.source} value={source} onChange={(e)=>setSource(e.target.value)} className="ts-focus max-w-[125px] rounded-lg border border-[#e6e6ed] bg-white px-2 py-2 text-[11px]"><option value="all">{t('allSources')}</option><option value="X">X</option><option value="Reddit">Reddit</option></select>
              <select aria-label={t('categories')} value={category} onChange={(e)=>setCategory(e.target.value)} className="ts-focus max-w-[150px] rounded-lg border border-[#e6e6ed] bg-white px-2 py-2 text-[11px]"><option value="all">{t('allCategories')}</option><option value="IA">IA</option><option value="3D">3D</option><option value="outil">{locale==='en'?'Tools':locale==='es'?'Herramientas':'Outil'}</option><option value="design">Design</option></select>
              <select aria-label={t('sort')} value={sort} onChange={(e)=>setSort(e.target.value)} className="ts-focus max-w-[155px] rounded-lg border border-[#e6e6ed] bg-white px-2 py-2 text-[11px]"><option value="newest">{labels.newest}</option><option value="oldest">{labels.oldest}</option></select>
              {(search || source!=='all' || category!=='all' || view!=='all') ? <button type="button" onClick={()=>{setSearch('');setSource('all');setCategory('all');setView('all');}} className="ts-focus flex items-center gap-1 text-[11px] font-semibold text-[#6b56c9]"><X size={13}/>{labels.clear}</button> : null}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto bg-[#fafafc] p-3 sm:p-4" data-testid="demo-card-scroll">
              {filtered.length===0 ? <div className="flex h-40 flex-col items-center justify-center gap-2 text-[#8b8e9b]"><Search size={24}/><p className="text-sm">{t('noResults')}</p></div> : <div className={layout==='grid' ? 'grid grid-cols-1 gap-3 min-[470px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5' : 'grid grid-cols-1 gap-2 lg:grid-cols-2'}>
                {filtered.map((item,index) => <article key={item.id} className={`flex min-w-0 flex-col overflow-hidden rounded-[16px] border border-[#e4e5ea] bg-white shadow-[0_3px_7px_#20203305] transition hover:border-[#c9bdf5] ${layout==='list' ? 'sm:flex-row' : ''}`}>
                  <button type="button" data-testid={`demo-entry-${entries.indexOf(item)}`} onClick={()=>{setSelected(item.id);setScreen('reader');setRead((r)=>r.includes(item.id)?r:[...r,item.id]);}} className="ts-focus group min-w-0 flex-1 p-3 text-left">
                    <div className="flex items-center gap-2"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#d7ccff] to-[#b1ddd4] text-[11px] font-bold text-[#51527c]">{item.author.split(' ').map((p)=>p[0]).join('')}</span><span className="min-w-0"><span className="block truncate text-[11px] font-bold">{item.author}</span><span className="block truncate text-[9px] text-[#999ba7]">{item.handle} · 31 oct. 2026</span></span></div>
                    <h4 className="mt-3 line-clamp-2 min-h-[34px] text-[12px] font-bold leading-[1.4] text-[#282932] group-hover:text-[#6750c4]"><span className="mr-1 text-[#6c53df]">●</span>{item.title[locale]}</h4>
                    <p className="mt-2 line-clamp-2 min-h-[34px] text-[10px] leading-[1.65] text-[#81838e]">{item.excerpt[locale]}</p>
                    <div className="mt-3 h-[110px] overflow-hidden rounded-xl"><MiniArtwork kind={item.visual}/></div>
                  </button>
                  <div className="border-t border-[#ececf0] px-3 py-2.5"><div className="flex flex-wrap items-center gap-1 text-[9px]"><span className="rounded bg-[#f0f0f3] px-1.5 py-0.5 font-semibold text-[#7f828c]">{index%3+1} {labels.posts}</span><span className="inline-flex items-center gap-0.5 rounded bg-[#e7f5eb] px-1.5 py-0.5 font-semibold text-[#31966a]"><CheckCircle2 size={10}/>{labels.verified}</span><span className="rounded bg-[#f1effb] px-1.5 py-0.5 text-[#735ccb]">{item.category}</span></div><div className="mt-2 flex items-center gap-2 text-[9px] text-[#9c9ca8]"><span>{item.source} · #veille</span><span className="ml-auto">{read.includes(item.id)?'✓':'○'}</span><button type="button" aria-label={`${favorites.includes(item.id)?t('removeFavorites'):t('addFavorites')} : ${item.author}`} aria-pressed={favorites.includes(item.id)} onClick={()=>toggle(item.id,favorites,setFavorites)} className="ts-focus rounded p-0.5 text-[#9382cc] hover:bg-[#f0ecfc]"><Star size={15} fill={favorites.includes(item.id)?'currentColor':'none'}/></button><button type="button" aria-label={`${later.includes(item.id)?t('removeLater'):t('addLater')} : ${item.author}`} aria-pressed={later.includes(item.id)} onClick={()=>toggle(item.id,later,setLater)} className="ts-focus rounded p-0.5 text-[#9382cc] hover:bg-[#f0ecfc]"><Bookmark size={15} fill={later.includes(item.id)?'currentColor':'none'}/></button></div></div>
                </article>)}
              </div>}
            </div>
          </div> : <div role="tabpanel" aria-label={t('demoReader')} data-testid="demo-reader-panel" className="min-h-0 flex-1 overflow-y-auto bg-[#fafafc] px-4 py-5 sm:px-10 sm:py-8">
            <div className="mx-auto max-w-[650px]"><button type="button" data-testid="demo-library-tab" onClick={()=>setScreen('library')} className="ts-focus flex items-center gap-2 text-xs font-semibold text-[#6d59c4]"><ArrowLeft size={16}/>{t('demoBack')}</button><div className="mt-8 flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-full bg-[#e0d9ff] text-sm font-semibold">{active.author.split(' ').map((p)=>p[0]).join('')}</span><span><span className="block text-sm font-bold">{active.author}</span><span className="text-xs text-[#8a8c97]">{active.handle} · {active.source}</span></span></div><h3 className="mt-6 font-serif text-[26px] font-semibold leading-tight tracking-tight sm:text-[38px]">{active.title[locale]}</h3><div className="my-6 h-px bg-[#e8e8ec]"/><p className="font-serif text-[17px] leading-[1.85] text-[#575861]">{active.excerpt[locale]}</p><div className="my-7 h-[190px] overflow-hidden rounded-xl"><MiniArtwork kind={active.visual}/></div><p className="font-serif text-base leading-loose text-[#575861]">{t('demoReaderParagraph')}</p><div className="mt-7 flex flex-wrap gap-3"><button type="button" onClick={()=>toggle(active.id,favorites,setFavorites)} className="ts-focus inline-flex items-center gap-2 rounded-lg border border-[#ded8f5] px-4 py-2 text-xs font-semibold text-[#6b55be]"><Star size={15} fill={favorites.includes(active.id)?'currentColor':'none'}/>{t('favorites')}</button><button type="button" onClick={()=>toggle(active.id,later,setLater)} className="ts-focus inline-flex items-center gap-2 rounded-lg border border-[#ded8f5] px-4 py-2 text-xs font-semibold text-[#6b55be]"><Bookmark size={15}/>{labels.saved}</button></div></div>
          </div>}
        </div>
      </div>
    </div>
    <p className="mt-4 text-center text-xs text-[#b7b9d0]">{t('demoDisclaimer')}</p>
  </section>;
}

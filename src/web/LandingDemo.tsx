import { useMemo, useState } from 'react';
import { ArrowLeft, Bookmark, CheckCircle2, Clock3, ExternalLink, Folder, Grid2X2, ImageOff, List, Menu, Search, Star, X } from 'lucide-react';
import { LogoMark } from '@/components/Logo';
import { useWebI18n, type WebLanguage } from './i18n';
import { ExtractedThread } from './ExtractedThread';
import { realExamples, type PublicExample } from './realExamples';

const entries = realExamples;

function SourceMedia({ item, unavailable }: { item: PublicExample; unavailable: string }) {
  const [failed, setFailed] = useState(false);
  return failed
    ? <div className="flex h-full w-full items-center justify-center gap-2 bg-[#f1f2f5] px-4 text-center text-xs text-[#8a8a98]"><ImageOff size={20} />{unavailable}</div>
    : <img loading="lazy" decoding="async" referrerPolicy="no-referrer" src={item.mediaUrl} alt={item.title} onError={() => setFailed(true)} className="h-full w-full object-cover" />;
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
  // Demo-only state: never expose the owner's real favorites or reading history.
  const [favorites, setFavorites] = useState<string[]>([entries[3]!.id, entries[6]!.id]);
  const [later, setLater] = useState<string[]>([entries[1]!.id, entries[4]!.id, entries[9]!.id]);
  const [read, setRead] = useState<string[]>([entries[2]!.id, entries[8]!.id]);
  const [mobileMenu, setMobileMenu] = useState(false);
  const locale = (language || 'fr') as WebLanguage;
  const filtered = useMemo(() => entries.filter((item) => {
    const matchesView = view === 'all' || (view === 'later' && later.includes(item.id)) || (view === 'favorites' && favorites.includes(item.id)) || (view === 'unread' && !read.includes(item.id));
    return matchesView && (source === 'all' || source === item.source) && (category === 'all' || category === item.category)
      && `${item.title} ${item.description[locale]} ${item.author} ${item.handle} ${item.category}`.toLowerCase().includes(search.trim().toLowerCase());
  }).sort((a,b) => sort === 'oldest' ? entries.indexOf(b) - entries.indexOf(a) : entries.indexOf(a) - entries.indexOf(b)), [view, later, favorites, read, source, category, search, sort, locale]);
  const active = entries.find((entry) => entry.id === selected) || entries[0]!;
  const labels = {
    fr: { preview: 'Vraies publications · interface interactive', posts: 'publications', verified: 'Fil enregistré', source: 'Sources', newest: 'Enregistrés récemment', oldest: 'Plus anciens', clear: 'Réinitialiser', saved: 'Enregistrer pour plus tard', selection: 'Exemples publics', sourceLink: 'Voir la publication originale', readerNote: 'Retrouvez ci-dessous le texte original conservé au moment de l’enregistrement.', noImage: 'Aperçu indisponible' },
    en: { preview: 'Real posts · interactive interface', posts: 'posts', verified: 'Saved thread', source: 'Sources', newest: 'Recently saved', oldest: 'Oldest first', clear: 'Reset', saved: 'Save for later', selection: 'Public examples', sourceLink: 'View original post', readerNote: 'Below is the original text saved when this thread was captured.', noImage: 'Preview unavailable' },
    es: { preview: 'Publicaciones reales · interfaz interactiva', posts: 'publicaciones', verified: 'Hilo guardado', source: 'Fuentes', newest: 'Guardados recientemente', oldest: 'Más antiguos', clear: 'Restablecer', saved: 'Guardar para después', selection: 'Ejemplos públicos', sourceLink: 'Ver publicación original', readerNote: 'Aquí aparece el texto original guardado al capturar este hilo.', noImage: 'Vista previa no disponible' },
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
          <div className="mt-5 border-t border-[#e7e8ec] pt-4 text-[10px] font-bold uppercase tracking-[.11em] text-[#a1a3af]">{t('collections')}</div><div className="mt-3 flex items-center gap-2 text-[11px] text-[#7b808b]"><Folder size={13} className="text-[#36a078]" />{labels.selection}<span className="ml-auto">{entries.length}</span></div>
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
                {filtered.map((item) => <article key={item.id} className={`flex min-w-0 flex-col overflow-hidden rounded-[16px] border border-[#e4e5ea] bg-white shadow-[0_3px_7px_#20203305] transition hover:border-[#c9bdf5] ${layout==='list' ? 'sm:flex-row' : ''}`}>
                  <button type="button" data-testid={`demo-entry-${entries.indexOf(item)}`} onClick={()=>{setSelected(item.id);setScreen('reader');setRead((r)=>r.includes(item.id)?r:[...r,item.id]);}} className="ts-focus group min-w-0 flex-1 p-3 text-left">
                    <div className="flex items-center gap-2"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#d7ccff] to-[#b1ddd4] text-[11px] font-bold text-[#51527c]">{item.author.split(' ').map((p)=>p[0]).join('')}</span><span className="min-w-0"><span className="block truncate text-[11px] font-bold">{item.author}</span><span className="block truncate text-[9px] text-[#999ba7]">{item.handle} · {item.source}</span></span></div>
                    <h4 className="mt-3 line-clamp-2 min-h-[34px] text-[12px] font-bold leading-[1.4] text-[#282932] group-hover:text-[#6750c4]"><span className="mr-1 text-[#6c53df]">●</span>{item.title}</h4>
                    <p className="mt-2 line-clamp-2 min-h-[34px] text-[10px] leading-[1.65] text-[#81838e]">{item.description[locale]}</p>
                    <div className="mt-3 h-[110px] overflow-hidden rounded-xl"><SourceMedia item={item} unavailable={labels.noImage}/></div>
                  </button>
                  <div className="border-t border-[#ececf0] px-3 py-2.5"><div className="flex flex-wrap items-center gap-1 text-[9px]"><span className="rounded bg-[#f0f0f3] px-1.5 py-0.5 font-semibold text-[#7f828c]">{item.publicationCount} {labels.posts}</span><span className="inline-flex items-center gap-0.5 rounded bg-[#e7f5eb] px-1.5 py-0.5 font-semibold text-[#31966a]"><CheckCircle2 size={10}/>{labels.verified}</span><span className="rounded bg-[#f1effb] px-1.5 py-0.5 text-[#735ccb]">{item.category}</span></div><div className="mt-2 flex items-center gap-2 text-[9px] text-[#9c9ca8]"><span>{item.source}</span><a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={`${labels.sourceLink} : ${item.author}`} className="ts-focus rounded p-0.5 text-[#8675c5]"><ExternalLink size={13}/></a><span className="ml-auto">{read.includes(item.id)?'✓':'○'}</span><button type="button" aria-label={`${favorites.includes(item.id)?t('removeFavorites'):t('addFavorites')} : ${item.author}`} aria-pressed={favorites.includes(item.id)} onClick={()=>toggle(item.id,favorites,setFavorites)} className="ts-focus rounded p-0.5 text-[#9382cc] hover:bg-[#f0ecfc]"><Star size={15} fill={favorites.includes(item.id)?'currentColor':'none'}/></button><button type="button" aria-label={`${later.includes(item.id)?t('removeLater'):t('addLater')} : ${item.author}`} aria-pressed={later.includes(item.id)} onClick={()=>toggle(item.id,later,setLater)} className="ts-focus rounded p-0.5 text-[#9382cc] hover:bg-[#f0ecfc]"><Bookmark size={15} fill={later.includes(item.id)?'currentColor':'none'}/></button></div></div>
                </article>)}
              </div>}
            </div>
          </div> : <div role="tabpanel" aria-label={t('demoReader')} data-testid="demo-reader-panel" className="min-h-0 flex-1 overflow-y-auto bg-[#fafafc] px-4 py-5 sm:px-10 sm:py-8">
            <div className="mx-auto max-w-[650px]">
              <button type="button" data-testid="demo-library-tab" onClick={() => setScreen('library')} className="ts-focus flex items-center gap-2 text-xs font-semibold text-[#6d59c4]">
                <ArrowLeft size={16}/>{t('demoBack')}
              </button>
              <div className="mt-8 flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-[#e0d9ff] text-sm font-semibold">{active.author.split(' ').map((p) => p[0]).join('')}</span>
                <span><span className="block text-sm font-bold">{active.author}</span><span className="text-xs text-[#8a8c97]">{active.handle} · {active.source}</span></span>
              </div>
              <h3 className="mt-6 font-serif text-[26px] font-semibold leading-tight tracking-tight sm:text-[38px]">{active.title}</h3>
              <div className="my-6 h-px bg-[#e8e8ec]"/>
              <p className="font-serif text-[17px] leading-[1.85] text-[#575861]">{active.description[locale]}</p>
              <div className="my-7 h-[190px] overflow-hidden rounded-xl"><SourceMedia item={active} unavailable={labels.noImage}/></div>
              <p className="text-[13px] leading-6 text-[#797588]">{labels.readerNote}</p>
              <a href={active.sourceUrl} target="_blank" rel="noopener noreferrer" className="ts-focus mt-4 inline-flex items-center gap-2 rounded-lg border border-[#d9d2ee] bg-white px-4 py-3 text-sm font-semibold text-[#6852c1]"><ExternalLink size={16}/>{labels.sourceLink} · {active.source}</a>
              <div className="mt-5 flex flex-wrap gap-3">
                <button type="button" onClick={() => toggle(active.id, favorites, setFavorites)} className="ts-focus inline-flex items-center gap-2 rounded-lg border border-[#ded8f5] px-4 py-2 text-xs font-semibold text-[#6b55be]"><Star size={15} fill={favorites.includes(active.id) ? 'currentColor' : 'none'}/>{t('favorites')}</button>
                <button type="button" onClick={() => toggle(active.id, later, setLater)} className="ts-focus inline-flex items-center gap-2 rounded-lg border border-[#ded8f5] px-4 py-2 text-xs font-semibold text-[#6b55be]"><Bookmark size={15}/>{labels.saved}</button>
              </div>
              <ExtractedThread example={active} language={locale}/>
            </div>
          </div>}
        </div>
      </div>
    </div>
    <p className="mt-4 text-center text-xs text-[#b7b9d0]">{t('demoDisclaimer')}</p>
  </section>;
}

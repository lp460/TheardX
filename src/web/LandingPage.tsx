import { useState } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Bookmark, Check, Cloud, Download, GitBranch, LockKeyhole, MonitorDown, Puzzle, Search, Smartphone, Sparkles, Star, WifiOff } from 'lucide-react';
import { LogoMark } from '@/components/Logo';
import { LanguageSelector, useWebI18n } from './i18n';

const extensionDownload = '/downloads/threadshelf-extension.zip';

/** A clickable showcase of the reader, with fictional examples only (never real user data). */
function LibraryPreview() {
  const { t } = useWebI18n();
  const [screen, setScreen] = useState<'library' | 'reader'>('library');
  const [selected, setSelected] = useState(0);
  const items = [
    { title: t('demoItemOne'), excerpt: t('demoItemOneBody'), source: 'X · Thread', tag: t('demoTagIdeas'), glyph: '✦', tone: 'from-[#ddd3ff] to-[#f5edff] text-[#7659c5]' },
    { title: t('demoItemTwo'), excerpt: t('demoItemTwoBody'), source: 'X · Article', tag: t('demoTagReading'), glyph: '◈', tone: 'from-[#d5eee7] to-[#f5f9df] text-[#438878]' },
    { title: t('demoItemThree'), excerpt: t('demoItemThreeBody'), source: 'Reddit · Discussion', tag: t('demoTagCommunity'), glyph: '✳', tone: 'from-[#ffe4d1] to-[#fff2e8] text-[#bd7d54]' },
  ];
  const active = items[selected]!;

  return (
    <section id="apercu" aria-label={t('demoAria')} className="relative min-w-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-2 text-[11px] font-semibold text-white/90 sm:text-xs"><span className="h-2 w-2 rounded-full bg-[#bcffd1] shadow-[0_0_0_4px_rgba(188,255,209,.12)]" />{t('demoBadge')}</span>
        <div role="tablist" aria-label={t('demoSwitch')} className="inline-flex rounded-xl border border-white/15 bg-white/10 p-1">
          <button type="button" role="tab" aria-selected={screen === 'library'} data-testid="demo-library-tab" onClick={() => setScreen('library')}
            className={`ts-focus rounded-lg px-3 py-2 text-xs font-semibold transition ${screen === 'library' ? 'bg-white text-[#28243f] shadow' : 'text-white/75 hover:text-white'}`}>{t('library')}</button>
          <button type="button" role="tab" aria-selected={screen === 'reader'} data-testid="demo-reader-tab" onClick={() => setScreen('reader')}
            className={`ts-focus rounded-lg px-3 py-2 text-xs font-semibold transition ${screen === 'reader' ? 'bg-white text-[#28243f] shadow' : 'text-white/75 hover:text-white'}`}>{t('demoReader')}</button>
        </div>
      </div>

      <div data-testid="landing-demo" className="overflow-hidden rounded-[1.5rem] border border-white/20 bg-[#fcfcfe] shadow-[0_32px_80px_rgba(5,8,25,.42)] sm:rounded-[1.8rem]">
        <div className="flex h-11 items-center gap-2 border-b border-[#e9e9f0] bg-[#f7f7fa] px-4 sm:h-12 sm:px-5">
          <div className="flex gap-1.5" aria-hidden="true"><span className="h-2.5 w-2.5 rounded-full bg-[#efa4a4]" /><span className="h-2.5 w-2.5 rounded-full bg-[#efcc8d]" /><span className="h-2.5 w-2.5 rounded-full bg-[#93d5b7]" /></div>
          <span className="mx-auto rounded-md border border-[#eceaf0] bg-white px-6 py-1 text-[10px] text-[#89879a] sm:px-14">theardx</span>
          <span className="w-10 sm:w-16" />
        </div>
        <div className="grid min-h-[445px] grid-cols-1 bg-[#fcfcfe] text-[#29283e] sm:min-h-[480px] md:grid-cols-[162px_minmax(0,1fr)]">
          <aside className="hidden flex-col border-r border-[#eeeef4] bg-[#f8f8fb] p-4 md:flex" aria-label={t('demoNavigation')}>
            <span className="mb-7 flex items-center gap-2 text-[15px] font-extrabold tracking-tight"><LogoMark size={24} />TheardX</span>
            <span className="mb-2 px-2 text-[9px] font-bold uppercase tracking-[.15em] text-[#aaa8ba]">{t('demoNavigation')}</span>
            <span className="flex items-center gap-2 rounded-lg bg-[#eae6fc] px-2.5 py-2.5 text-[11px] font-bold text-[#6954b5]"><BookOpen size={14} />{t('library')}</span>
            <span className="mt-1 flex items-center gap-2 px-2.5 py-2.5 text-[11px] text-[#7c798e]"><Bookmark size={14} />{t('laterShort')}</span>
            <span className="mt-1 flex items-center gap-2 px-2.5 py-2.5 text-[11px] text-[#7c798e]"><Star size={14} />{t('favorites')}</span>
            <span className="mt-8 border-t border-[#e9e8ef] pt-4 text-[9px] font-bold uppercase tracking-wide text-[#aaa8b7]">{t('collections')}</span>
            <span className="mt-3 flex items-center gap-2 text-[11px] text-[#858199]"><span className="h-2 w-2 rounded-full bg-[#ac97e0]" />{t('demoTagIdeas')}</span>
            <span className="mt-3 flex items-center gap-2 text-[11px] text-[#858199]"><span className="h-2 w-2 rounded-full bg-[#8ac9b9]" />{t('demoTagReading')}</span>
            <span className="mt-auto rounded-xl border border-[#e8e7ef] bg-white p-3 text-[10px] font-medium text-[#828094]"><Cloud size={14} className="mb-2 text-[#7767c1]" />{t('demoSynced')}</span>
          </aside>
          <div className="min-w-0 p-4 sm:p-6 md:p-7">
            {screen === 'library' ? <div role="tabpanel" aria-label={t('library')} data-testid="demo-library-panel">
              <div className="flex flex-wrap items-center justify-between gap-2"><div><span className="text-[10px] font-bold uppercase tracking-[.16em] text-[#9e90c8]">{t('demoYourSpace')}</span><h3 className="mt-1 text-[22px] font-bold tracking-[-.04em] sm:text-[26px]">{t('library')} <span className="align-middle text-xs font-semibold text-[#aaa7b6]">03</span></h3></div><span className="rounded-full bg-[#ebf8f1] px-3 py-1.5 text-[10px] font-semibold text-[#3b926c]">● {t('demoAvailable')}</span></div>
              <div className="mt-5 flex items-center gap-2 rounded-xl border border-[#eceaf1] bg-white px-3.5 py-3 text-[12px] text-[#a19eaf]"><Search size={15} />{t('searchLibrary')}<span className="ml-auto hidden rounded-md border border-[#eceaf1] px-1.5 py-0.5 text-[10px] sm:block">⌘ K</span></div>
              <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold"><span className="rounded-full bg-[#7058c9] px-3.5 py-2 text-white">{t('all')}</span><span className="rounded-full bg-[#f1eff6] px-3.5 py-2 text-[#777486]">{t('laterShort')}</span><span className="rounded-full bg-[#f1eff6] px-3.5 py-2 text-[#777486]">{t('favorites')}</span></div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {items.map((item, index) => <button key={item.title} type="button" data-testid={`demo-entry-${index}`} onClick={() => { setSelected(index); setScreen('reader'); }}
                  className="ts-focus group flex min-w-0 gap-3 rounded-2xl border border-[#eae9f1] bg-white p-3 text-left shadow-[0_6px_20px_rgba(32,28,73,.04)] transition hover:-translate-y-0.5 hover:border-[#bbaaf2] hover:shadow-lg sm:flex-col">
                  <span aria-hidden="true" className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-4xl sm:h-[70px] sm:w-full sm:text-5xl ${item.tone}`}>{item.glyph}</span>
                  <span className="min-w-0 flex-1"><span className="flex items-center justify-between gap-1 text-[10px] font-semibold text-[#928ea2]">{item.source}<ArrowUpRight size={13} className="shrink-0 text-[#a195c4]" /></span><span className="mt-1.5 line-clamp-2 text-[12px] font-bold leading-snug sm:text-[13px]">{item.title}</span><span className="mt-1.5 hidden text-[11px] leading-relaxed text-[#878397] sm:line-clamp-2">{item.excerpt}</span><span className="mt-2 inline-flex rounded-md bg-[#f3f1f9] px-2 py-1 text-[9px] font-semibold text-[#83789f]">{item.tag}</span></span>
                </button>)}
              </div>
            </div> : <div role="tabpanel" aria-label={t('demoReader')} data-testid="demo-reader-panel" className="mx-auto max-w-[470px]">
              <button type="button" onClick={() => setScreen('library')} className="ts-focus inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-[#7967bb] hover:bg-[#f2eeff]"><ArrowLeft size={14} />{t('demoBack')}</button>
              <div className="mt-6 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.14em] text-[#8e7bc2]"><BookOpen size={13} />{active.source}<span className="ml-auto inline-flex items-center gap-1 text-[#51a786]"><WifiOff size={13} />{t('offline')}</span></div>
              <h3 className="mt-4 font-serif text-[27px] font-semibold leading-[1.16] tracking-[-.045em] sm:text-[32px]">{active.title}</h3>
              <div className="my-5 h-px bg-[#ebe9f0]" />
              <p className="font-serif text-[16px] leading-[1.8] text-[#4f4b60]">{active.excerpt}</p>
              <p className="mt-4 font-serif text-[16px] leading-[1.8] text-[#4f4b60]">{t('demoReaderParagraph')}</p>
              <div className="mt-6 flex items-center justify-between rounded-xl bg-[#f3f0ff] px-4 py-3 text-[11px] font-semibold text-[#7a69b2]"><span className="inline-flex items-center gap-2"><Bookmark size={14} />{t('demoSaved')}</span><Star size={15} /></div>
            </div>}
          </div>
        </div>
      </div>
      <p className="mt-4 text-center text-[11px] leading-relaxed text-[#b0aec8] sm:text-xs">{t('demoDisclaimer')}</p>
    </section>
  );
}

export function LandingPage({ status, loginAvailable, libraryAvailable = false }: { status?: string; loginAvailable: boolean; libraryAvailable?: boolean }) {
  const { t } = useWebI18n();
  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-[#0c1020] text-white">
      <div className="relative isolate overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(circle_at_20%_18%,rgba(136,116,240,.24),transparent_40%),radial-gradient(circle_at_90%_53%,rgba(53,165,173,.13),transparent_35%)]" />
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[.06] [background-image:linear-gradient(to_right,#d9d5ff_1px,transparent_1px),linear-gradient(to_bottom,#d9d5ff_1px,transparent_1px)] [background-size:64px_64px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />
        <header className="relative z-10 mx-auto flex h-[76px] max-w-[1480px] items-center justify-between gap-2 px-4 sm:px-8 lg:px-12">
          <a href="/" aria-label="TheardX" className="ts-focus flex shrink-0 items-center gap-2.5 rounded-xl text-[18px] font-extrabold tracking-tight sm:text-xl">
            <LogoMark size={31} /><span>TheardX</span>
          </a>
          <nav className="hidden items-center gap-7 text-[13px] font-semibold text-white/65 lg:flex" aria-label="Site">
            <a href="#apercu" className="hover:text-white">{t('demoDiscover')}</a>
            <a href="#fonctionnement" className="hover:text-white">{t('scrollDiscover')}</a>
            <a href="#extension" className="hover:text-white">{t('getExtension')}</a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSelector dark />
            {libraryAvailable || loginAvailable ? <a className="ts-focus inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-[12px] font-bold text-[#28243f] transition hover:bg-[#eee9ff] sm:px-4 sm:text-[13px]" href={libraryAvailable ? '/' : '/api/auth/login'} aria-label={libraryAvailable ? t('heroRead') : t('signIn')}><GitBranch size={16} /><span className="hidden min-[375px]:inline">{libraryAvailable ? t('demoOpenShort') : t('demoSignInShort')}</span><ArrowRight className="hidden sm:block" size={15} /></a> : null}
          </div>
        </header>

        <main>
          <section className="relative mx-auto grid max-w-[1480px] items-center gap-7 px-5 pb-16 pt-6 sm:gap-10 sm:px-8 sm:pt-16 lg:grid-cols-[.8fr_1.2fr] lg:gap-12 lg:px-12 lg:pb-28 lg:pt-24 xl:gap-16">
            <div className="mx-auto w-full max-w-[640px] lg:mx-0">
              <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-400/10 px-4 py-2 text-[11px] font-semibold tracking-wide text-violet-200 sm:text-xs">
                <Sparkles size={14} />{t('homeEyebrow')}
              </span>
              <h1 className="mt-5 max-w-3xl text-[clamp(2.35rem,5.4vw,5.7rem)] font-semibold leading-[1.07] tracking-[-0.065em] sm:mt-7">
                {t('heroTitle')}
              </h1>
              <p className="mt-4 max-w-lg text-[15px] leading-[1.65] text-[#b8bdd1] sm:mt-7 sm:text-lg sm:leading-[1.75]">{t('heroDescription')}</p>
              {status ? <p role="status" className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">{status}</p> : null}
              <div className="mt-5 flex flex-col gap-3 sm:mt-8 sm:flex-row lg:flex-col xl:flex-row">
                {loginAvailable || libraryAvailable ? (
                  <a href={libraryAvailable ? '/' : '/api/auth/login'} className="ts-focus inline-flex min-h-13 items-center justify-center gap-3 rounded-xl bg-[#b3a1ff] px-6 py-3.5 text-[14px] font-bold text-[#211a38] shadow-[0_14px_34px_rgba(124,92,255,.22)] transition hover:-translate-y-0.5 hover:bg-[#c8bcff]">
                    <GitBranch size={19} /> {libraryAvailable ? t('heroRead') : t('signIn')} <ArrowRight size={17} />
                  </a>
                ) : <span className="inline-flex min-h-13 items-center gap-2 text-sm text-white/70"><Cloud className="animate-pulse" size={18} /> {t('opening')}</span>}
                <a href="#apercu" className="ts-focus inline-flex min-h-13 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/[.07] px-6 py-3.5 text-[14px] font-semibold transition hover:bg-white/[.14]">
                  <BookOpen size={18} />{t('demoDiscover')}
                </a>
              </div>
              <p className="mt-3 flex items-center gap-2 text-[11px] font-medium text-white/45 sm:mt-5 sm:text-xs"><LockKeyhole size={14} />{t('demoPrivacyLine')}</p>
              <a href="#fonctionnement" className="mt-9 hidden items-center gap-2 text-sm text-white/50 transition hover:text-white sm:inline-flex">
                <ArrowDown size={15} />{t('scrollDiscover')}
              </a>
            </div>
            <div className="relative mx-auto w-full min-w-0 max-w-[780px] lg:ml-auto">
              <div className="pointer-events-none absolute -inset-6 rounded-[3rem] bg-gradient-to-br from-violet-500/20 via-transparent to-cyan-400/10 blur-3xl" aria-hidden="true" />
              <div className="relative"><LibraryPreview /></div>
            </div>
          </section>
        </main>
      </div>

      <section id="decouvrir" className="bg-[#f9f8fc] px-5 py-20 text-[#24223b] sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 max-w-2xl"><span className="text-xs font-bold uppercase tracking-[.2em] text-[#8570c1]">TheardX</span><h2 className="mt-3 text-[31px] font-bold leading-tight tracking-[-.045em] sm:text-[43px]">{t('featureSectionTitle')}</h2></div>
          <div className="grid gap-4 md:grid-cols-3">
          {([
            [WifiOff, 'featureOfflineTitle', 'featureOfflineBody', 'bg-[#e9e3fa] text-[#7763b8]'],
            [Cloud, 'featureSyncTitle', 'featureSyncBody', 'bg-[#e1f2ed] text-[#488c7d]'],
            [BookOpen, 'featureFocusTitle', 'featureFocusBody', 'bg-[#fff0e1] text-[#ba8458]'],
          ] as const).map(([Icon, title, description, tone]) => <div key={title} className="rounded-[1.5rem] border border-[#eae8f1] bg-white p-7 shadow-[0_12px_32px_rgba(34,25,75,.04)] sm:p-8">
            <div className={`mb-8 inline-flex rounded-2xl p-3.5 ${tone}`}><Icon size={25} /></div>
            <h3 className="text-xl font-bold tracking-[-.025em]">{t(title)}</h3><p className="mt-3 text-[15px] leading-7 text-[#737188]">{t(description)}</p>
          </div>)}
          </div>
        </div>
      </section>

      <section id="fonctionnement" className="bg-[#12172a] px-5 py-20 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl"><h2 className="text-[31px] font-semibold leading-tight tracking-[-.045em] sm:text-[44px]">{t('howTitle')}</h2><p className="mt-5 text-base leading-8 text-white/55">{t('howSubtitle')}</p></div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {([
              [Puzzle,'stepOneTitle','stepOneBody'],
              [Check,'stepTwoTitle','stepTwoBody'],
              [Smartphone,'stepThreeTitle','stepThreeBody'],
            ] as const).map(([Icon,title,description],index) => <article key={title} className="rounded-[1.5rem] border border-white/10 bg-white/[.045] p-7 sm:p-8">
              <div className="flex items-center justify-between"><span className="rounded-xl border border-[#b6a4ff]/20 bg-[#b6a4ff]/10 p-3 text-[#bdadff]"><Icon size={23} /></span><span className="text-2xl font-bold text-white/20">0{index+1}</span></div>
              <h3 className="mt-8 text-xl font-semibold">{t(title)}</h3><p className="mt-3 text-[15px] leading-7 text-white/60">{t(description)}</p>
            </article>)}
          </div>
        </div>
      </section>

      <section id="extension" className="bg-[#f7f7fc] px-5 py-20 text-[#20223b] sm:px-8 sm:py-28">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-2">
          <div className="rounded-[2rem] bg-[#eae6ff] p-7 sm:p-10">
            <MonitorDown className="text-[#735bd2]" size={34}/>
            <h2 className="mt-7 text-2xl font-bold tracking-tight sm:text-3xl">{t('downloadTitle')}</h2>
            <p className="mt-5 max-w-xl text-[15px] leading-7 text-[#555275]">{t('downloadBody')}</p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a className="ts-focus inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#6d56da] px-5 py-3 font-semibold text-white transition hover:bg-[#5b43c8]" href={extensionDownload} download><Download size={18}/>{t('downloadZip')}</a>
              <a className="ts-focus inline-flex min-h-12 items-center gap-2 rounded-xl border border-[#b9b1e4] px-5 py-3 font-semibold text-[#5745b0] hover:bg-white/40" href="https://github.com/lp460/TheardX/blob/main/README.md" target="_blank" rel="noreferrer">{t('downloadGuide')} <ArrowRight size={16}/></a>
            </div>
            <p className="mt-5 text-[13px] text-[#666184]">{t('browserCompatibility')}</p>
          </div>
          <div className="flex flex-col justify-between rounded-[2rem] border border-[#e5e5ef] bg-white p-7 sm:p-10">
            <Smartphone className="text-[#735bd2]" size={34}/>
            <div><h2 className="mt-7 text-2xl font-bold tracking-tight sm:text-3xl">{t('iphoneTitle')}</h2><p className="mt-5 text-[15px] leading-7 text-[#676984]">{t('iphoneBody')}</p></div>
            <div className="mt-9 flex items-center gap-2 text-sm font-medium text-[#735bd2]"><LockKeyhole size={17} />{t('privacyTitle')}</div>
          </div>
        </div>
      </section>
      <footer className="px-5 py-10 text-sm text-white/50 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <span className="inline-flex items-center gap-2 font-semibold text-white"><LogoMark size={23}/> TheardX</span>
          <span>{t('privacyBody')}</span>
          <span>{t('footer')}</span>
        </div>
      </footer>
    </div>
  );
}

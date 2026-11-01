import { ArrowDown, ArrowRight, BookOpen, Check, Cloud, Download, GitBranch, LockKeyhole, MonitorDown, Puzzle, Smartphone, Sparkles, WifiOff } from 'lucide-react';
import { LogoMark } from '@/components/Logo';
import { LanguageSelector, useWebI18n } from './i18n';

const extensionDownload = '/downloads/threadshelf-extension.zip';

export function LandingPage({ status, loginAvailable, libraryAvailable = false }: { status?: string; loginAvailable: boolean; libraryAvailable?: boolean }) {
  const { t } = useWebI18n();
  return (
    <div className="min-h-[100dvh] overflow-x-hidden bg-[#0c1021] text-white">
      <div className="relative isolate overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute -right-44 -top-40 h-[38rem] w-[38rem] rounded-full bg-violet-700/25 blur-[100px]" />
        <div aria-hidden className="pointer-events-none absolute -left-48 top-72 h-96 w-96 rounded-full bg-sky-500/10 blur-[90px]" />
        <header className="relative z-10 mx-auto flex h-20 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
          <a href="/" aria-label="TheardX" className="ts-focus flex items-center gap-3 rounded-xl text-xl font-bold tracking-tight">
            <LogoMark size={32} /><span>TheardX</span>
          </a>
          <nav className="hidden items-center gap-7 text-sm text-white/65 md:flex" aria-label="Site">
            <a href="#decouvrir" className="hover:text-white">{t('discover')}</a>
            <a href="#fonctionnement" className="hover:text-white">{t('scrollDiscover')}</a>
            <a href="#extension" className="hover:text-white">{t('getExtension')}</a>
          </nav>
          <div className="flex items-center gap-3">
            <LanguageSelector dark />
            {libraryAvailable ? <a className="ts-focus hidden rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold transition hover:bg-white/10 sm:inline-flex" href="/">{t('heroRead')}</a>
              : loginAvailable ? <a className="ts-focus hidden rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold transition hover:bg-white/10 sm:inline-flex" href="/api/auth/login">{t('signIn')}</a> : null}
          </div>
        </header>

        <main>
          <section className="relative mx-auto grid max-w-7xl items-center gap-12 px-5 pb-20 pt-14 sm:px-8 sm:pt-24 lg:grid-cols-[1.02fr_0.98fr] lg:gap-16 lg:px-10 lg:pb-32">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/10 px-4 py-2 text-[12px] font-medium tracking-wide text-violet-200">
                <Sparkles size={14} />{t('homeEyebrow')}
              </span>
              <h1 className="mt-7 max-w-3xl text-[clamp(2.9rem,6.8vw,5.75rem)] font-semibold leading-[1.05] tracking-[-0.055em]">
                {t('heroTitle')}
              </h1>
              <p className="mt-7 max-w-xl text-[17px] leading-[1.8] text-[#b8bdd1] sm:text-lg">{t('heroDescription')}</p>
              {status ? <p role="status" className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">{status}</p> : null}
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                {loginAvailable || libraryAvailable ? (
                  <a href={libraryAvailable ? '/' : '/api/auth/login'} className="ts-focus inline-flex min-h-13 items-center justify-center gap-3 rounded-2xl bg-[#a08cff] px-6 py-3.5 text-[15px] font-semibold text-[#151227] shadow-[0_16px_36px_rgba(124,92,255,.25)] transition hover:bg-[#b6a5ff]">
                    <GitBranch size={19} /> {libraryAvailable ? t('heroRead') : t('signIn')} <ArrowRight size={17} />
                  </a>
                ) : <span className="inline-flex min-h-13 items-center gap-2 text-sm text-white/70"><Cloud className="animate-pulse" size={18} /> {t('opening')}</span>}
                <a href="#extension" className="ts-focus inline-flex min-h-13 items-center justify-center gap-3 rounded-2xl border border-white/20 bg-white/5 px-6 py-3.5 text-[15px] font-semibold transition hover:bg-white/10">
                  <Download size={18} />{t('getExtension')}
                </a>
              </div>
              <a href="#decouvrir" className="mt-12 inline-flex items-center gap-2 text-sm text-white/50 transition hover:text-white">
                <ArrowDown size={15} />{t('scrollDiscover')}
              </a>
            </div>
            <div className="relative mx-auto w-full max-w-[550px] lg:ml-auto" aria-hidden="true">
              <div className="absolute -inset-6 rounded-[3rem] bg-gradient-to-br from-violet-500/20 via-indigo-500/5 to-cyan-400/10 blur-3xl" />
              <div className="relative overflow-hidden rounded-[1.6rem] border border-white/20 bg-[#161b31] p-3 shadow-[0_35px_90px_rgba(0,0,0,.44)] sm:p-4">
                <div className="mb-4 flex items-center gap-2 px-1 pt-1">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#ff827d]" /><span className="h-2.5 w-2.5 rounded-full bg-[#ffc861]" /><span className="h-2.5 w-2.5 rounded-full bg-[#7bdb9c]" />
                  <span className="mx-auto rounded-lg bg-white/5 px-8 py-1 text-[10px] text-white/35">TheardX</span>
                </div>
                <div className="rounded-2xl bg-[#f7f7fb] p-5 text-[#24253e] sm:p-7">
                  <div className="mb-5 flex items-center justify-between">
                    <div><p className="text-[11px] font-semibold uppercase tracking-[.18em] text-[#8c8caa]">TheardX</p><h2 className="mt-1 text-xl font-bold tracking-tight">{t('library')}</h2></div>
                    <div className="rounded-full bg-[#ece9ff] p-2.5 text-[#7d66e9]"><BookOpen size={22}/></div>
                  </div>
                  <div className="mb-5 flex gap-2 overflow-hidden text-[11px] font-medium">
                    <span className="rounded-lg bg-[#7e67eb] px-3 py-2 text-white">{t('all')}</span><span className="rounded-lg bg-[#edeef4] px-3 py-2">{t('later')}</span><span className="rounded-lg bg-[#edeef4] px-3 py-2">{t('favorites')}</span>
                  </div>
                  {[0,1,2].map((item) => (
                    <div key={item} className="mb-2.5 flex items-start gap-3 rounded-xl border border-[#e8e8f1] bg-white p-3.5 last:mb-0">
                      <div className={`h-9 w-9 shrink-0 rounded-xl ${item===0?'bg-violet-200':item===1?'bg-amber-100':'bg-sky-100'}`} />
                      <div className="flex-1 space-y-2 pt-0.5"><div className={`h-2.5 rounded-full bg-[#d6d6e6] ${item===1?'w-4/5':'w-3/5'}`} /><div className="h-2 w-full rounded-full bg-[#ececf3]" /><div className="h-2 w-2/3 rounded-full bg-[#ececf3]" /></div>
                      {item===0 ? <span className="text-[#7d66e9]"><Check size={15}/></span> : null}
                    </div>
                  ))}
                </div>
              </div>
              <div className="absolute -bottom-5 -left-3 flex items-center gap-2 rounded-2xl border border-white/20 bg-[#242b45] px-4 py-3 text-xs font-medium text-white shadow-xl sm:-left-8">
                <WifiOff size={16} className="text-[#9e8cff]" /> {t('featureOfflineTitle')}
              </div>
            </div>
          </section>
        </main>
      </div>

      <section id="decouvrir" className="bg-[#f7f7fc] px-5 py-20 text-[#20223b] sm:px-8 sm:py-28">
        <div className="mx-auto grid max-w-7xl gap-5 md:grid-cols-3">
          {([
            [WifiOff, 'featureOfflineTitle', 'featureOfflineBody'],
            [Cloud, 'featureSyncTitle', 'featureSyncBody'],
            [BookOpen, 'featureFocusTitle', 'featureFocusBody'],
          ] as const).map(([Icon, title, description]) => <div key={title} className="rounded-[1.5rem] border border-[#e9e9f1] bg-white p-7 shadow-[0_15px_35px_rgba(34,25,75,.04)] sm:p-8">
            <div className="mb-7 inline-flex rounded-2xl bg-[#eeeaff] p-3 text-[#7864db]"><Icon size={25} /></div>
            <h3 className="text-xl font-bold tracking-tight">{t(title)}</h3><p className="mt-3 text-[15px] leading-7 text-[#676984]">{t(description)}</p>
          </div>)}
        </div>
      </section>

      <section id="fonctionnement" className="px-5 py-20 sm:px-8 sm:py-28">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl"><h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">{t('howTitle')}</h2><p className="mt-5 text-base leading-8 text-white/55">{t('howSubtitle')}</p></div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {([
              [Puzzle,'stepOneTitle','stepOneBody'],
              [Check,'stepTwoTitle','stepTwoBody'],
              [Smartphone,'stepThreeTitle','stepThreeBody'],
            ] as const).map(([Icon,title,description],index) => <article key={title} className="rounded-3xl border border-white/10 bg-white/[.035] p-7">
              <div className="flex items-center justify-between"><Icon size={25} className="text-[#aa96ff]"/><span className="text-sm font-semibold text-white/30">0{index+1}</span></div>
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

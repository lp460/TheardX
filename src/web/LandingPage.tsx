import { useEffect } from 'react';
import { ArrowRight, BookOpen, Check, Cloud, Download, GitBranch, LockKeyhole, MonitorDown, Puzzle, Smartphone, Sparkles, WifiOff } from 'lucide-react';
import { LogoMark } from '@/components/Logo';
import { LanguageSelector, useWebI18n } from './i18n';
import { LandingDemo } from './LandingDemo';
import { InstallGuide } from './InstallGuide';
import { ExtensionShowcase } from './ExtensionShowcase';

const extensionDownload = '/downloads/threadshelf-extension.zip';

export function LandingPage({ status, loginAvailable, libraryAvailable = false }: { status?: string; loginAvailable: boolean; libraryAvailable?: boolean }) {
  const { t } = useWebI18n();
  useEffect(() => {
    // The public landing page may render after the initial hash navigation.
    // Restore deep links to the showcase and installation guide after mount.
    const id = window.location.hash.slice(1);
    if (!id) return;
    const frame = window.requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView());
    return () => window.cancelAnimationFrame(frame);
  }, []);
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
            <a href="#sur-x-et-reddit" className="hover:text-white">X &amp; Reddit</a>
            <a href="#fonctionnement" className="hover:text-white">{t('scrollDiscover')}</a>
            <a href="#extension" className="hover:text-white">{t('getExtension')}</a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSelector dark />
            {libraryAvailable || loginAvailable ? <a className="ts-focus inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-[12px] font-bold text-[#28243f] transition hover:bg-[#eee9ff] sm:px-4 sm:text-[13px]" href={libraryAvailable ? '/' : '/api/auth/login'} aria-label={libraryAvailable ? t('heroRead') : t('signIn')}><GitBranch size={16} /><span className="hidden min-[375px]:inline">{libraryAvailable ? t('demoOpenShort') : t('demoSignInShort')}</span><ArrowRight className="hidden sm:block" size={15} /></a> : null}
          </div>
        </header>

        <main>
          <section className="relative mx-auto max-w-[1480px] px-5 pb-4 pt-2 sm:px-8 sm:pb-5 sm:pt-5 lg:px-12 lg:pb-5 lg:pt-6">
            <div className="mx-auto w-full max-w-[900px] text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-400/10 px-4 py-2 text-[11px] font-semibold tracking-wide text-violet-200 sm:text-xs">
                <Sparkles size={14} />{t('homeEyebrow')}
              </span>
              <h1 className="mx-auto mt-3 max-w-4xl text-[clamp(2.15rem,4vw,3.9rem)] font-semibold leading-[1.07] tracking-[-0.065em]">
                {t('heroTitle')}
              </h1>
              <p className="mx-auto mt-3 max-w-[690px] text-[14px] leading-[1.55] text-[#b8bdd1] sm:text-[16px] sm:leading-[1.6]">{t('heroDescription')}</p>
              {status ? <p role="status" className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100">{status}</p> : null}
              <div className="mt-4 flex flex-col justify-center gap-3 sm:flex-row">
                {loginAvailable || libraryAvailable ? (
                  <a href={libraryAvailable ? '/' : '/api/auth/login'} className="ts-focus inline-flex min-h-13 items-center justify-center gap-3 rounded-xl bg-[#b3a1ff] px-6 py-3.5 text-[14px] font-bold text-[#211a38] shadow-[0_14px_34px_rgba(124,92,255,.22)] transition hover:-translate-y-0.5 hover:bg-[#c8bcff]">
                    <GitBranch size={19} /> {libraryAvailable ? t('heroRead') : t('signIn')} <ArrowRight size={17} />
                  </a>
                ) : <span className="inline-flex min-h-13 items-center gap-2 text-sm text-white/70"><Cloud className="animate-pulse" size={18} /> {t('opening')}</span>}
                <a href="#apercu" className="ts-focus inline-flex min-h-13 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/[.07] px-6 py-3.5 text-[14px] font-semibold transition hover:bg-white/[.14]">
                  <BookOpen size={18} />{t('demoDiscover')}
                </a>
              </div>
              <p className="mt-3 flex items-center justify-center gap-2 text-[11px] font-medium text-white/45 sm:text-xs"><LockKeyhole size={14} />{t('demoPrivacyLine')}</p>
            </div>
          </section>
          <div className="relative mx-auto max-w-[1570px] px-3 pb-16 sm:px-8 lg:px-12 lg:pb-24">
            <div className="pointer-events-none absolute inset-0 rounded-[3rem] bg-gradient-to-br from-violet-500/20 via-transparent to-cyan-400/10 blur-3xl" aria-hidden="true" />
            <div className="relative"><LandingDemo /></div>
          </div>
        </main>
      </div>

      <ExtensionShowcase />

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
              <a className="ts-focus inline-flex min-h-12 items-center gap-2 rounded-xl border border-[#b9b1e4] px-5 py-3 font-semibold text-[#5745b0] hover:bg-white/40" href="#installation">{t('downloadGuide')} <ArrowRight size={16}/></a>
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
      <InstallGuide />
      <footer className="px-5 py-10 text-sm text-white/50 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <span className="inline-flex items-center gap-2 font-semibold text-white"><LogoMark size={23}/> TheardX</span>
          <span>{t('privacyBody')}</span>
          <div className="flex flex-wrap items-center gap-4">
            <a className="ts-focus underline-offset-4 hover:text-white hover:underline" href="https://github.com/lp460/TheardX/blob/main/PRIVACY.md" target="_blank" rel="noopener noreferrer">{t('privacyPolicy')}</a>
            <a className="ts-focus underline-offset-4 hover:text-white hover:underline" href="https://github.com/lp460/TheardX/issues/new/choose" target="_blank" rel="noopener noreferrer">{t('reportIssue')}</a>
          </div>
          <span>{t('footer')}</span>
        </div>
      </footer>
    </div>
  );
}

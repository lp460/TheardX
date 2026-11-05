import { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Check,
  Cloud,
  Download,
  LockKeyhole,
  MonitorDown,
  Puzzle,
  Smartphone,
  Sparkles,
  UserRound,
  WifiOff,
  X,
} from 'lucide-react';
import { LogoMark } from '@/components/Logo';
import { LanguageSelector, useWebI18n } from './i18n';
import { LandingDemo } from './LandingDemo';
import { InstallGuide } from './InstallGuide';
import { ExtensionShowcase } from './ExtensionShowcase';

const extensionDownload = '/downloads/threadshelf-extension.zip';

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" data-provider-logo="google">
      <path
        fill="#4285F4"
        d="M21.35 12.23c0-.71-.06-1.37-.17-2H12v3.79h5.25a4.5 4.5 0 0 1-1.95 2.95v2.49h3.16c1.85-1.7 2.89-4.2 2.89-7.23Z"
      />
      <path
        fill="#34A853"
        d="M12 21.6c2.6 0 4.78-.86 6.37-2.34l-3.16-2.49c-.88.6-2 1-3.21 1-2.47 0-4.57-1.67-5.32-3.92H3.43v2.55A9.6 9.6 0 0 0 12 21.6Z"
      />
      <path
        fill="#FBBC05"
        d="M6.68 13.85a5.77 5.77 0 0 1 0-3.7V7.6H3.43a9.6 9.6 0 0 0 0 8.8l3.25-2.55Z"
      />
      <path
        fill="#EA4335"
        d="M12 6.23c1.37 0 2.6.47 3.57 1.4l2.83-2.83A9.18 9.18 0 0 0 12 2.4a9.6 9.6 0 0 0-8.57 5.2l3.25 2.55c.75-2.25 2.85-3.92 5.32-3.92Z"
      />
    </svg>
  );
}

function GitHubMark() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="24"
      height="24"
      aria-hidden="true"
      fill="currentColor"
      data-provider-logo="github"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

export function LandingPage({
  status,
  loginAvailable,
  libraryAvailable = false,
}: {
  status?: string;
  loginAvailable: boolean;
  libraryAvailable?: boolean;
}) {
  const { t } = useWebI18n();
  const [googleAvailable, setGoogleAvailable] = useState(false);
  const signInDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!loginAvailable) return;
    void fetch('/api/auth/providers', { cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : {}))
      .then((data: { google?: boolean }) => setGoogleAvailable(data.google === true))
      .catch(() => undefined);
  }, [loginAvailable]);
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
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(circle_at_20%_18%,rgba(136,116,240,.24),transparent_40%),radial-gradient(circle_at_90%_53%,rgba(53,165,173,.13),transparent_35%)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[.06] [background-image:linear-gradient(to_right,#d9d5ff_1px,transparent_1px),linear-gradient(to_bottom,#d9d5ff_1px,transparent_1px)] [background-size:64px_64px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
        />
        <header className="relative z-10 mx-auto flex h-[76px] max-w-[1480px] items-center justify-between gap-2 px-4 sm:px-8 lg:px-12">
          <a
            href="/"
            aria-label="TheardX"
            className="ts-focus flex shrink-0 items-center gap-2.5 rounded-xl text-[18px] font-extrabold tracking-tight sm:text-xl"
          >
            <LogoMark size={31} />
            <span>TheardX</span>
          </a>
          <nav
            className="hidden items-center gap-7 text-[13px] font-semibold text-white/65 lg:flex"
            aria-label="Site"
          >
            <a href="#apercu" className="hover:text-white">
              {t('demoDiscover')}
            </a>
            <a href="#sur-x-et-reddit" className="hover:text-white">
              X &amp; Reddit
            </a>
            <a href="#fonctionnement" className="hover:text-white">
              {t('scrollDiscover')}
            </a>
            <a href="#extension" className="hover:text-white">
              {t('getExtension')}
            </a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <LanguageSelector dark />
            {libraryAvailable ? (
              <a
                className="ts-focus inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-[12px] font-bold text-[#28243f] transition hover:bg-[#eee9ff] sm:px-4 sm:text-[13px]"
                href="/"
                aria-label={t('heroRead')}
              >
                <BookOpen size={16} />
                <span className="hidden min-[375px]:inline">{t('demoOpenShort')}</span>
                <ArrowRight className="hidden sm:block" size={15} />
              </a>
            ) : loginAvailable ? (
              <button
                type="button"
                className="ts-focus inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-[12px] font-bold text-[#28243f] transition hover:bg-[#eee9ff] sm:px-4 sm:text-[13px]"
                onClick={() => signInDialog.current?.showModal()}
                aria-haspopup="dialog"
              >
                <UserRound size={16} />
                <span>{t('demoSignInShort')}</span>
                <ArrowRight className="hidden sm:block" size={15} />
              </button>
            ) : null}
          </div>
        </header>

        <main>
          <section className="relative mx-auto max-w-[1480px] px-5 pb-4 pt-2 sm:px-8 sm:pb-5 sm:pt-5 lg:px-12 lg:pb-5 lg:pt-6">
            <div className="mx-auto w-full max-w-[900px] text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-400/10 px-4 py-2 text-[11px] font-semibold tracking-wide text-violet-200 sm:text-xs">
                <Sparkles size={14} />
                {t('homeEyebrow')}
              </span>
              <h1 className="mx-auto mt-3 max-w-4xl text-[clamp(2.15rem,4vw,3.9rem)] font-semibold leading-[1.07] tracking-[-0.065em]">
                {t('heroTitle')}
              </h1>
              <p className="mx-auto mt-3 max-w-[690px] text-[14px] leading-[1.55] text-[#b8bdd1] sm:text-[16px] sm:leading-[1.6]">
                {t('heroDescription')}
              </p>
              {status ? (
                <p
                  role="status"
                  className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-100"
                >
                  {status}
                </p>
              ) : null}
              <div className="mt-4 flex flex-col justify-center gap-3 sm:flex-row">
                {libraryAvailable ? (
                  <a
                    href="/"
                    className="ts-focus inline-flex min-h-13 items-center justify-center gap-3 rounded-xl bg-[#b3a1ff] px-6 py-3.5 text-[14px] font-bold text-[#211a38] shadow-[0_14px_34px_rgba(124,92,255,.22)] transition hover:-translate-y-0.5 hover:bg-[#c8bcff]"
                  >
                    <BookOpen size={19} /> {t('heroRead')} <ArrowRight size={17} />
                  </a>
                ) : loginAvailable ? (
                  <button
                    type="button"
                    onClick={() => signInDialog.current?.showModal()}
                    className="ts-focus inline-flex min-h-13 items-center justify-center gap-3 rounded-xl bg-[#b3a1ff] px-6 py-3.5 text-[14px] font-bold text-[#211a38] shadow-[0_14px_34px_rgba(124,92,255,.22)] transition hover:-translate-y-0.5 hover:bg-[#c8bcff]"
                    aria-haspopup="dialog"
                  >
                    <UserRound size={19} /> {t('demoSignInShort')} <ArrowRight size={17} />
                  </button>
                ) : (
                  <span className="inline-flex min-h-13 items-center gap-2 text-sm text-white/70">
                    <Cloud className="animate-pulse" size={18} /> {t('opening')}
                  </span>
                )}
                <a
                  href="#apercu"
                  className="ts-focus inline-flex min-h-13 items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/[.07] px-6 py-3.5 text-[14px] font-semibold transition hover:bg-white/[.14]"
                >
                  <BookOpen size={18} />
                  {t('demoDiscover')}
                </a>
              </div>
              <p className="mt-3 flex items-center justify-center gap-2 text-[11px] font-medium text-white/45 sm:text-xs">
                <LockKeyhole size={14} />
                {t('demoPrivacyLine')}
              </p>
            </div>
          </section>
          <div className="relative mx-auto max-w-[1570px] px-3 pb-16 sm:px-8 lg:px-12 lg:pb-24">
            <div
              className="pointer-events-none absolute inset-0 rounded-[3rem] bg-gradient-to-br from-violet-500/20 via-transparent to-cyan-400/10 blur-3xl"
              aria-hidden="true"
            />
            <div className="relative">
              <LandingDemo />
            </div>
          </div>
        </main>
      </div>

      <ExtensionShowcase />

      <section id="decouvrir" className="bg-[#f9f8fc] px-5 py-20 text-[#24223b] sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 max-w-2xl">
            <span className="text-xs font-bold uppercase tracking-[.2em] text-[#8570c1]">
              TheardX
            </span>
            <h2 className="mt-3 text-[31px] font-bold leading-tight tracking-[-.045em] sm:text-[43px]">
              {t('featureSectionTitle')}
            </h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {(
              [
                [
                  WifiOff,
                  'featureOfflineTitle',
                  'featureOfflineBody',
                  'bg-[#e9e3fa] text-[#7763b8]',
                ],
                [Cloud, 'featureSyncTitle', 'featureSyncBody', 'bg-[#e1f2ed] text-[#488c7d]'],
                [BookOpen, 'featureFocusTitle', 'featureFocusBody', 'bg-[#fff0e1] text-[#ba8458]'],
              ] as const
            ).map(([Icon, title, description, tone]) => (
              <div
                key={title}
                className="rounded-[1.5rem] border border-[#eae8f1] bg-white p-7 shadow-[0_12px_32px_rgba(34,25,75,.04)] sm:p-8"
              >
                <div className={`mb-8 inline-flex rounded-2xl p-3.5 ${tone}`}>
                  <Icon size={25} />
                </div>
                <h3 className="text-xl font-bold tracking-[-.025em]">{t(title)}</h3>
                <p className="mt-3 text-[15px] leading-7 text-[#737188]">{t(description)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="fonctionnement" className="bg-[#12172a] px-5 py-20 sm:px-8 sm:py-24">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <h2 className="text-[31px] font-semibold leading-tight tracking-[-.045em] sm:text-[44px]">
              {t('howTitle')}
            </h2>
            <p className="mt-5 text-base leading-8 text-white/55">{t('howSubtitle')}</p>
          </div>
          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {(
              [
                [Puzzle, 'stepOneTitle', 'stepOneBody'],
                [Check, 'stepTwoTitle', 'stepTwoBody'],
                [Smartphone, 'stepThreeTitle', 'stepThreeBody'],
              ] as const
            ).map(([Icon, title, description], index) => (
              <article
                key={title}
                className="rounded-[1.5rem] border border-white/10 bg-white/[.045] p-7 sm:p-8"
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-xl border border-[#b6a4ff]/20 bg-[#b6a4ff]/10 p-3 text-[#bdadff]">
                    <Icon size={23} />
                  </span>
                  <span className="text-2xl font-bold text-white/20">0{index + 1}</span>
                </div>
                <h3 className="mt-8 text-xl font-semibold">{t(title)}</h3>
                <p className="mt-3 text-[15px] leading-7 text-white/60">{t(description)}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="extension" className="bg-[#f7f7fc] px-5 py-20 text-[#20223b] sm:px-8 sm:py-28">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-2">
          <div className="rounded-[2rem] bg-[#eae6ff] p-7 sm:p-10">
            <MonitorDown className="text-[#735bd2]" size={34} />
            <h2 className="mt-7 text-2xl font-bold tracking-tight sm:text-3xl">
              {t('downloadTitle')}
            </h2>
            <p className="mt-5 max-w-xl text-[15px] leading-7 text-[#555275]">
              {t('downloadBody')}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a
                className="ts-focus inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#6d56da] px-5 py-3 font-semibold text-white transition hover:bg-[#5b43c8]"
                href={extensionDownload}
                download
              >
                <Download size={18} />
                {t('downloadZip')}
              </a>
              <a
                className="ts-focus inline-flex min-h-12 items-center gap-2 rounded-xl border border-[#b9b1e4] px-5 py-3 font-semibold text-[#5745b0] hover:bg-white/40"
                href="#installation"
              >
                {t('downloadGuide')} <ArrowRight size={16} />
              </a>
            </div>
            <p className="mt-5 text-[13px] text-[#666184]">{t('browserCompatibility')}</p>
          </div>
          <div className="flex flex-col justify-between rounded-[2rem] border border-[#e5e5ef] bg-white p-7 sm:p-10">
            <Smartphone className="text-[#735bd2]" size={34} />
            <div>
              <h2 className="mt-7 text-2xl font-bold tracking-tight sm:text-3xl">
                {t('iphoneTitle')}
              </h2>
              <p className="mt-5 text-[15px] leading-7 text-[#676984]">{t('iphoneBody')}</p>
            </div>
            <div className="mt-9 flex items-center gap-2 text-sm font-medium text-[#735bd2]">
              <LockKeyhole size={17} />
              {t('privacyTitle')}
            </div>
          </div>
        </div>
      </section>
      <InstallGuide />
      <footer className="px-5 py-10 text-sm text-white/50 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <span className="inline-flex items-center gap-2 font-semibold text-white">
            <LogoMark size={23} /> TheardX
          </span>
          <span>{t('privacyBody')}</span>
          <span>{t('footer')}</span>
        </div>
      </footer>
      {loginAvailable && !libraryAvailable ? (
        <dialog
          ref={signInDialog}
          aria-labelledby="provider-choice-title"
          aria-describedby="provider-choice-description"
          className="m-auto w-[min(92vw,440px)] max-w-none rounded-3xl border border-[#e7e5f1] bg-white p-5 text-[#28243f] shadow-[0_25px_90px_rgba(4,6,20,.35)] backdrop:bg-[#070914]/75 sm:p-7"
          onClick={(event) => {
            if (event.target === event.currentTarget) event.currentTarget.close();
          }}
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 id="provider-choice-title" className="text-xl font-bold tracking-tight">
                {t('demoSignInShort')}
              </h2>
              <p
                id="provider-choice-description"
                className="mt-1 text-[13px] leading-relaxed text-[#6f7183]"
              >
                {t('signInHint')}
              </p>
            </div>
            <button
              type="button"
              aria-label={t('dialogClose')}
              onClick={() => signInDialog.current?.close()}
              className="ts-focus inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[#66667a] hover:bg-[#f0eef7]"
            >
              <X size={19} />
            </button>
          </div>
          <div className="space-y-3">
            {googleAvailable ? (
              <a
                href="/api/auth/google/login"
                className="ts-focus flex min-h-16 items-center gap-4 rounded-2xl border border-[#dedde8] bg-white px-4 py-3 text-[14px] font-semibold shadow-sm transition hover:border-[#9b88f6] hover:bg-[#f8f6ff]"
              >
                <GoogleMark />
                <span className="flex-1">{t('signInGoogle')}</span>
                <ArrowRight size={17} className="text-[#858198]" />
              </a>
            ) : null}
            <a
              href="/api/auth/login"
              className="ts-focus flex min-h-16 items-center gap-4 rounded-2xl border border-[#dedde8] bg-white px-4 py-3 text-[14px] font-semibold shadow-sm transition hover:border-[#9b88f6] hover:bg-[#f8f6ff]"
            >
              <GitHubMark />
              <span className="flex-1">{t('signIn')}</span>
              <ArrowRight size={17} className="text-[#858198]" />
            </a>
          </div>
        </dialog>
      ) : null}
    </div>
  );
}

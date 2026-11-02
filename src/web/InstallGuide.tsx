import { useState } from 'react';
import { Check, Clipboard, Download, ExternalLink, FolderOpen, Info, Puzzle } from 'lucide-react';
import { useWebI18n, type WebLanguage } from './i18n';

const browsers = [
  { id: 'chrome', name: 'Chrome', address: 'chrome://extensions', docs: 'https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world', badge: '🌐' },
  { id: 'brave', name: 'Brave', address: 'brave://extensions', docs: 'https://support.brave.app/hc/en-us/articles/360017909112-How-can-I-add-extensions-to-Brave', badge: '🦁' },
  { id: 'edge', name: 'Edge', address: 'edge://extensions', docs: 'https://learn.microsoft.com/en-us/microsoft-edge/extensions/getting-started/extension-sideloading', badge: '🌊' },
  { id: 'arc', name: 'Arc', address: 'arc://extensions', docs: 'https://start.arc.net/command-bar-actions', badge: '◒' },
] as const;
type BrowserId = typeof browsers[number]['id'];

const content = {
  fr: {
    eyebrow: 'Installation guidée', title: 'Installez TheardX, sans quitter cette page.',
    description: 'Choisissez votre navigateur : nous vous accompagnons pas à pas avec la procédure documentée par son éditeur.',
    select: 'Choisir un navigateur', downloaded: 'Télécharger l’extension (.zip)', stepOneTitle: 'Téléchargez et décompressez',
    stepOne: 'Téléchargez le ZIP ci-dessous, puis extrayez-le dans un dossier permanent sur votre ordinateur. Ce dossier contient manifest.json.',
    stepTwoTitle: 'Ouvrez le gestionnaire d’extensions', stepTwo: 'Copiez cette adresse et collez-la directement dans la barre d’adresse du navigateur. Ces adresses internes ne s’ouvrent pas depuis un lien web.',
    arcTip: 'Dans Arc, ouvrez la barre de commande (⌘T sur Mac), recherchez « Manage Extensions », puis ouvrez le gestionnaire. Si nécessaire, utilisez les paramètres des extensions Chrome.',
    braveTip: 'Dans Brave, vous pouvez aussi passer par Menu → Plus d’outils → Extensions.',
    stepThreeTitle: 'Activez le mode développeur', stepThree: 'Dans le gestionnaire d’extensions, activez « Mode développeur » (Developer mode).',
    stepFourTitle: 'Chargez le dossier extrait', stepFour: 'Cliquez sur « Charger l’extension non empaquetée » (Load unpacked) puis sélectionnez le dossier extrait contenant manifest.json. TheardX apparaît dans vos extensions.',
    arcFootnote: 'Arc utilise les extensions Chrome. Les intitulés et l’accès au mode développeur peuvent varier selon sa version.',
    openDocs: 'Documentation officielle', copied: 'Adresse copiée', copy: 'Copier l’adresse',
    note: 'Installation manuelle pour navigateurs de bureau. Gardez le dossier extrait : le supprimer peut désactiver l’extension. Pour mettre à jour, téléchargez un nouveau ZIP et rechargez l’extension.',
    ios: 'Sur iPhone et Safari, utilisez la version web PWA avec « Sur l’écran d’accueil » : les extensions Chromium ne s’y installent pas.',
  },
  en: {
    eyebrow: 'Step-by-step installation', title: 'Install TheardX without leaving this page.',
    description: 'Choose your browser and follow the steps documented by its publisher.',
    select: 'Choose a browser', downloaded: 'Download extension (.zip)', stepOneTitle: 'Download and extract',
    stepOne: 'Download the ZIP below and extract it into a permanent folder on your computer. The folder contains manifest.json.',
    stepTwoTitle: 'Open the extension manager', stepTwo: 'Copy this address and paste it directly into your browser address bar. Internal browser addresses cannot be opened through website links.',
    arcTip: 'In Arc, open the command bar (⌘T on Mac), search for “Manage Extensions”, then open the extension manager. Use Chrome extension settings if needed.',
    braveTip: 'In Brave, you can also open Menu → More Tools → Extensions.',
    stepThreeTitle: 'Enable developer mode', stepThree: 'In the extension manager, switch on “Developer mode”.',
    stepFourTitle: 'Load the extracted folder', stepFour: 'Click “Load unpacked” and select the extracted folder containing manifest.json. TheardX will appear among your extensions.',
    arcFootnote: 'Arc supports Chrome extensions. Labels and developer mode access may vary by version.',
    openDocs: 'Official documentation', copied: 'Address copied', copy: 'Copy address',
    note: 'Manual desktop browser installation. Keep the extracted folder: deleting it can disable the extension. For updates, download a fresh ZIP and reload the extension.',
    ios: 'On iPhone and Safari, use the web PWA via “Add to Home Screen”. Chromium extensions cannot be installed there.',
  },
  es: {
    eyebrow: 'Instalación paso a paso', title: 'Instala TheardX sin salir de esta página.',
    description: 'Elige tu navegador y sigue las instrucciones documentadas por su fabricante.',
    select: 'Elegir navegador', downloaded: 'Descargar extensión (.zip)', stepOneTitle: 'Descarga y descomprime',
    stepOne: 'Descarga el ZIP y extráelo en una carpeta permanente del ordenador. La carpeta contiene manifest.json.',
    stepTwoTitle: 'Abre el gestor de extensiones', stepTwo: 'Copia esta dirección y pégala directamente en la barra de direcciones. Los enlaces web no pueden abrir estas páginas internas.',
    arcTip: 'En Arc, abre la barra de comandos (⌘T en Mac), busca « Manage Extensions » y abre el gestor. Si hace falta, usa los ajustes de extensiones de Chrome.',
    braveTip: 'En Brave, también puedes ir a Menú → Más herramientas → Extensiones.',
    stepThreeTitle: 'Activa el modo desarrollador', stepThree: 'En el gestor de extensiones, activa « Developer mode » o « Modo desarrollador ».',
    stepFourTitle: 'Carga la carpeta extraída', stepFour: 'Pulsa « Load unpacked » o « Cargar descomprimida » y selecciona la carpeta que contiene manifest.json. Aparecerá TheardX.',
    arcFootnote: 'Arc admite extensiones de Chrome. Los nombres y el acceso al modo desarrollador pueden variar según la versión.',
    openDocs: 'Documentación oficial', copied: 'Dirección copiada', copy: 'Copiar dirección',
    note: 'Instalación manual para ordenadores. Conserva la carpeta extraída: borrarla puede desactivar la extensión. Para actualizar, descarga un ZIP nuevo y recarga la extensión.',
    ios: 'En iPhone y Safari, usa la PWA con « Añadir a pantalla de inicio ». No se pueden instalar extensiones de Chromium.',
  },
};

export function InstallGuide() {
  const { language } = useWebI18n();
  const labels = content[language as WebLanguage] ?? content.fr;
  const [browser, setBrowser] = useState<BrowserId>('chrome');
  const [copied, setCopied] = useState(false);
  const current = browsers.find((b) => b.id === browser)!;
  async function copyAddress() {
    try { await navigator.clipboard.writeText(current.address); setCopied(true); }
    catch { setCopied(false); }
  }

  return <section id="installation" className="scroll-mt-6 bg-[#f7f7fc] px-5 pb-24 text-[#252438] sm:px-8 sm:pb-28">
    <div className="mx-auto max-w-7xl rounded-[28px] border border-[#e6e4f2] bg-white p-5 shadow-[0_18px_65px_#342a7110] sm:p-9 lg:p-12">
      <div className="max-w-3xl"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.18em] text-[#745bc5]"><Puzzle size={18}/>{labels.eyebrow}</div><h2 className="mt-3 text-[27px] font-bold leading-tight tracking-tight sm:text-[39px]">{labels.title}</h2><p className="mt-4 text-[15px] leading-7 text-[#72728a]">{labels.description}</p></div>
      <div role="tablist" aria-label={labels.select} className="mt-7 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">{browsers.map((item)=><button key={item.id} data-testid={`install-${item.id}`} role="tab" aria-selected={browser===item.id} type="button" onClick={()=>{setBrowser(item.id);setCopied(false);}} className={`ts-focus inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border px-5 py-3 text-sm font-semibold transition ${browser===item.id?'border-[#7761d0] bg-[#eee9ff] text-[#6149bc]':'border-[#e7e6ee] bg-white text-[#707085] hover:border-[#b8acf1]'}`}><span aria-hidden="true">{item.badge}</span>{item.name}</button>)}</div>
      <div role="tabpanel" aria-label={current.name} className="mt-7 grid gap-5 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <div className="flex gap-4 rounded-2xl border border-[#e8e7ef] bg-[#fcfbff] p-5"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#e8e2ff] text-sm font-bold text-[#7358c3]">1</span><div><h3 className="font-bold">{labels.stepOneTitle}</h3><p className="mt-2 text-sm leading-6 text-[#74758a]">{labels.stepOne}</p><a href="/downloads/threadshelf-extension.zip" download className="ts-focus mt-4 inline-flex items-center gap-2 rounded-lg bg-[#7155d0] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#5e43bd]"><Download size={16}/>{labels.downloaded}</a></div></div>
          <div className="flex gap-4 rounded-2xl border border-[#e8e7ef] p-5"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#e8e2ff] text-sm font-bold text-[#7358c3]">2</span><div className="min-w-0 flex-1"><h3 className="font-bold">{labels.stepTwoTitle}</h3><p className="mt-2 text-sm leading-6 text-[#74758a]">{labels.stepTwo}</p><div className="mt-3 flex flex-wrap items-center gap-2"><code className="rounded-lg bg-[#f1effa] px-3 py-2 text-[13px] font-semibold text-[#59469d]" data-testid="install-address">{current.address}</code><button type="button" onClick={copyAddress} className="ts-focus inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#ddd7f0] px-3 py-2 text-xs font-semibold text-[#6954b5]">{copied?<Check size={15}/>:<Clipboard size={15}/>} {copied?labels.copied:labels.copy}</button></div>{browser==='brave'?<p className="mt-3 text-xs leading-5 text-[#7d739b]">{labels.braveTip}</p>:null}{browser==='arc'?<p className="mt-3 text-xs leading-5 text-[#7d739b]">{labels.arcTip}</p>:null}</div></div>
        </div>
        <div className="flex flex-col gap-4">
          <div className="flex gap-4 rounded-2xl border border-[#e8e7ef] p-5"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#e8e2ff] text-sm font-bold text-[#7358c3]">3</span><div><h3 className="font-bold">{labels.stepThreeTitle}</h3><p className="mt-2 text-sm leading-6 text-[#74758a]">{labels.stepThree}</p></div></div>
          <div className="flex gap-4 rounded-2xl border border-[#e8e7ef] p-5"><span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#e8e2ff] text-sm font-bold text-[#7358c3]">4</span><div><h3 className="font-bold">{labels.stepFourTitle}</h3><p className="mt-2 text-sm leading-6 text-[#74758a]">{labels.stepFour}</p>{browser==='arc'?<p className="mt-3 text-xs leading-5 text-[#7d739b]">{labels.arcFootnote}</p>:null}</div></div>
          <a href={current.docs} target="_blank" rel="noopener noreferrer" className="ts-focus inline-flex min-h-11 items-center justify-center gap-2 self-start rounded-xl border border-[#dfdcf0] px-4 py-2.5 text-sm font-semibold text-[#6552a9] hover:bg-[#f4f1ff]"><ExternalLink size={15}/>{labels.openDocs} · {current.name}</a>
        </div>
      </div>
      <div className="mt-7 grid gap-3 sm:grid-cols-2"><p className="flex gap-2 rounded-xl bg-[#f7f5ff] p-4 text-xs leading-6 text-[#79728d]"><FolderOpen size={17} className="mt-0.5 shrink-0 text-[#8062c7]"/>{labels.note}</p><p className="flex gap-2 rounded-xl bg-[#edf9f4] p-4 text-xs leading-6 text-[#607f75]"><Info size={17} className="mt-0.5 shrink-0 text-[#43a081]"/>{labels.ios}</p></div>
    </div>
  </section>;
}

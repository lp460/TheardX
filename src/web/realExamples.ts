import type { WebLanguage } from './i18n';

/**
 * Hand-picked, public X/Reddit posts from the owner's ThreadShelf library.
 * This is a static marketing snapshot: never publish private notes, tags,
 * collection membership, reading status, or the GitHub sync payload.
 * Post titles, authors, source links and image URLs retain their public origin.
 */
export type PublicExample = {
  id: string;
  author: string;
  handle: string;
  source: 'X' | 'Reddit';
  category: 'IA' | '3D' | 'outil' | 'design';
  title: string;
  description: Record<WebLanguage, string>;
  sourceUrl: string;
  mediaUrl: string;
  publicationCount: number;
};

export const realExamples: PublicExample[] = [
  {
    id: 'inoino', author: 'inoino', handle: '@inoino65536', source: 'X', category: 'IA',
    title: "I've released a free, open-source speech input app similar to Aq◯aVo◯ce!",
    description: {
      fr: 'Présentation d’OpenHinoVoice, une application de dictée pour Windows spécialisée dans le japonais.',
      en: 'Introducing OpenHinoVoice, a Windows speech input app designed for Japanese dictation.',
      es: 'Presentación de OpenHinoVoice, una aplicación de dictado para Windows especializada en japonés.',
    },
    sourceUrl: 'https://x.com/inoino65536/status/2116582365950832793',
    mediaUrl: 'https://pbs.twimg.com/amplify_video_thumb/2116582222820171776/img/mZNbA3xpBxXADK6Q.jpg',
    publicationCount: 2,
  },
  {
    id: 'oliver', author: 'Oliver', handle: '@oliviscusAI', source: 'X', category: '3D',
    title: 'A 4B model can generate interactive 3D scenes with Three.js 🤯',
    description: {
      fr: 'Un exemple de génération de scènes Three.js à partir d’une description en langage naturel.',
      en: 'An example of generating Three.js scenes from a natural-language description.',
      es: 'Un ejemplo de generación de escenas Three.js a partir de una descripción en lenguaje natural.',
    },
    sourceUrl: 'https://x.com/oliviscusAI/status/2116561474244210785',
    mediaUrl: 'https://pbs.twimg.com/media/HV-JNTBbQAAYhTD?format=jpg&name=large',
    publicationCount: 2,
  },
  {
    id: 'reddit-zelda', author: 'u/Caf_fein', handle: 'r/macgaming', source: 'Reddit', category: 'outil',
    title: 'Zelda BOTW Native port on 8GB base M1 mac',
    description: {
      fr: 'Une discussion de la communauté macgaming sur un portage natif testé sur un Mac M1.',
      en: 'A macgaming community discussion about a native port running on an M1 Mac.',
      es: 'Una conversación de macgaming sobre un port nativo que funciona en un Mac M1.',
    },
    sourceUrl: 'https://www.reddit.com/r/macgaming/comments/1xd9hjc/zelda_botw_native_port_on_8gb_base_m1_mac/',
    mediaUrl: 'https://i.redd.it/a6h98qsss6xh1.png',
    publicationCount: 22,
  },
  {
    id: 'benji', author: 'Benji Taylor', handle: '@benjitaylor', source: 'X', category: 'design',
    title: 'Stageshow: a skill that helps your agent make better faux UI stills, animations, bento grids, and more.',
    description: {
      fr: 'Un skill pour aider les agents à produire des interfaces, animations et compositions visuelles.',
      en: 'A skill that helps agents create UI stills, animations and visual compositions.',
      es: 'Una skill para ayudar a los agentes a crear interfaces, animaciones y composiciones visuales.',
    },
    sourceUrl: 'https://x.com/benjitaylor/status/2116593247854453244',
    mediaUrl: 'https://pbs.twimg.com/amplify_video_thumb/2116591037816971264/img/646-9xgMoEXyzL8m.jpg',
    publicationCount: 5,
  },
  {
    id: 'samuel', author: 'Samuel Zeng', handle: '@SamuelZengML', source: 'X', category: 'IA',
    title: 'Introducing Audio8-TTS-Realistic, an open-weight speech model',
    description: {
      fr: 'Un modèle de synthèse vocale présenté avec des exemples de clonage de voix à partir d’un court extrait.',
      en: 'A speech synthesis model demonstrated with voice cloning from a short sample.',
      es: 'Un modelo de síntesis de voz con ejemplos de clonación a partir de una muestra breve.',
    },
    sourceUrl: 'https://x.com/SamuelZengML/status/2115881491645554870',
    mediaUrl: 'https://pbs.twimg.com/amplify_video_thumb/2115881402164277248/img/3bN549RRGfSFYszG.jpg',
    publicationCount: 4,
  },
  {
    id: 'reddit-mario', author: 'u/Obvious_Opening650', handle: 'r/EmulationOniOS', source: 'Reddit', category: 'outil',
    title: 'Mario Kart 8 running on an iPad A16 with no frame drops',
    description: {
      fr: 'Une discussion Reddit consacrée à une démonstration de jeu sur iPad A16.',
      en: 'A Reddit discussion about a game demonstration on an A16 iPad.',
      es: 'Una conversación de Reddit sobre una demostración de juego en un iPad A16.',
    },
    sourceUrl: 'https://www.reddit.com/r/EmulationOniOS/comments/1x9stzj/mario_kart_8_running_on_an_ipad_a16_with_no_frame/',
    mediaUrl: 'https://external-preview.redd.it/mario-kart-8-running-on-an-ipad-a16-with-no-frame-drops-v0-dTc1ZzRlYXFkZXdoMXimuQQ0ARP-OCzCt5u_tlCCftIKesIsNQkspLnKK7AT.jpeg?width=640&crop=smart&format=pjpg&auto=webp&s=c7a6749576586b4c4c9e2971c6040220c6369a47',
    publicationCount: 39,
  },
  {
    id: 'hasan', author: 'Hasan Toor', handle: '@hasantoxr', source: 'X', category: '3D',
    title: 'Blender just got a free AI that builds rigged 3D characters from 1 prompt.',
    description: {
      fr: 'Une présentation de StableGen, un projet de génération et de rigging de personnages 3D.',
      en: 'A look at StableGen, a project for generating and rigging 3D characters.',
      es: 'Una presentación de StableGen, un proyecto para generar y preparar personajes 3D.',
    },
    sourceUrl: 'https://x.com/hasantoxr/status/2116457666403029040',
    mediaUrl: 'https://pbs.twimg.com/amplify_video_thumb/2116457640599646208/img/3s3iRgD_iRPsmUds.jpg',
    publicationCount: 2,
  },
  {
    id: 'chris', author: 'Chris Tate', handle: '@ctatedev', source: 'X', category: 'outil',
    title: 'Introducing agent-desktop',
    description: {
      fr: 'Un outil de contrôle d’ordinateur par agent, présenté pour macOS, Windows et Linux.',
      en: 'A desktop automation tool for agents, presented for macOS, Windows and Linux.',
      es: 'Una herramienta de automatización del escritorio para agentes en macOS, Windows y Linux.',
    },
    sourceUrl: 'https://x.com/ctatedev/status/2116323148706771302',
    mediaUrl: 'https://pbs.twimg.com/amplify_video_thumb/2116323117836500992/img/lyS2sGQBssVmVsx8.jpg',
    publicationCount: 2,
  },
  {
    id: 'tatsu', author: 'Tatsu Matsushima', handle: '@tatsunari_m', source: 'X', category: 'IA',
    title: 'We have developed a new Japanese speech recognition model, Haas-ja-v1.0',
    description: {
      fr: 'Annonce d’un modèle de reconnaissance vocale japonais accompagné de résultats et démonstrations.',
      en: 'A Japanese speech recognition model announcement with benchmarks and demonstrations.',
      es: 'Anuncio de un modelo de reconocimiento de voz japonés con resultados y demostraciones.',
    },
    sourceUrl: 'https://x.com/tatsunari_m/status/2116101460203286831',
    mediaUrl: 'https://pbs.twimg.com/media/HV3nBvQaEAAUJDV?format=jpg&name=large',
    publicationCount: 3,
  },
  {
    id: 'joe', author: 'Joe Blau', handle: '@joeblau', source: 'X', category: 'IA',
    title: 'I recreated subvocal in 9 minutes with one prompt for AirPods Pro 3.',
    description: {
      fr: 'Une démonstration de prototype de commande subvocale conçu pour des AirPods.',
      en: 'A demonstration of a subvocal control prototype built for AirPods.',
      es: 'Una demostración de un prototipo de control subvocal diseñado para AirPods.',
    },
    sourceUrl: 'https://x.com/joeblau/status/2116347756138856734',
    mediaUrl: 'https://pbs.twimg.com/amplify_video_thumb/2116347012220403712/img/vbMYb0vf16KTYT0i.jpg',
    publicationCount: 2,
  },
  {
    id: 'niklas', author: 'Niklas', handle: '@niklaslenz_ai', source: 'X', category: '3D',
    title: 'Idol turns one image into a 3D model',
    description: {
      fr: 'Comparaison de temps de génération 3D à partir d’une image sur différentes cartes graphiques.',
      en: 'A comparison of image-to-3D generation times on different graphics cards.',
      es: 'Una comparación de tiempos de generación 3D desde una imagen en distintas tarjetas gráficas.',
    },
    sourceUrl: 'https://x.com/niklaslenz_ai/status/2116538181860659354',
    mediaUrl: 'https://pbs.twimg.com/amplify_video_thumb/2116460655687475200/img/_ivG_JwdPl_fPlTy.jpg',
    publicationCount: 1,
  },
];

export const realXExample = realExamples[1]!;
export const realRedditExample = realExamples[2]!;

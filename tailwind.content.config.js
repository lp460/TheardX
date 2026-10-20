import preset from './tailwind.preset.js';

/** In-page UI rendered inside the Shadow DOM on x.com — only scans the content UI to keep the CSS small. */
export default {
  presets: [preset],
  content: ['./src/content/**/*.{ts,tsx}'],
  corePlugins: { preflight: false },
};

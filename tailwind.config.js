import preset from './tailwind.preset.js';

/** Extension pages (popup, library, reader, options). */
export default {
  presets: [preset],
  content: ['./src/**/*.{ts,tsx,html}', '!./src/content/**'],
};

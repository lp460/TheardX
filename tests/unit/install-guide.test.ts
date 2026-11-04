import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { InstallGuide } from '@/web/InstallGuide';

describe('public installation guide', () => {
  it('includes the current ZIP, all four extension managers and a safe upgrade path', () => {
    const html = renderToStaticMarkup(createElement(InstallGuide));
    expect(html).toContain('/downloads/threadshelf-extension.zip');
    for (const browser of ['Chrome', 'Arc', 'Brave', 'Edge']) expect(html).toContain(browser);
    expect(html).toContain('manifest.json');
    expect(html).toContain('MÊME dossier');
    expect(html).toContain('ne se met pas à jour automatiquement');
    expect(html).toContain('Votre premier article');
    expect(html).toContain('https://github.com/lp460/TheardX/issues/new/choose');
  });
});

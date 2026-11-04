import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LandingReader } from '@/web/LandingReader';
import { realExamples } from '@/web/realExamples';

const noop = () => {};

function markup(index: number) {
  return renderToStaticMarkup(createElement(LandingReader, {
    example: realExamples[index]!, language: 'fr', favorite: false, later: false,
    onBack: noop, onFavorite: noop, onLater: noop,
  }));
}

describe('public landing reader presentation', () => {
  it('matches the main reader hierarchy with toolbar, full original text and source image', () => {
    const html = markup(0);
    expect(html).toContain('data-testid="demo-reader-toolbar"');
    expect(html).toContain('data-testid="demo-library-tab"');
    expect(html).toContain('data-testid="demo-reader-share"');
    expect(html).toContain('data-testid="demo-reader-copy"');
    expect(html).toContain('data-testid="demo-reader-settings"');
    expect(html).toContain('data-testid="captured-thread"');
    expect(html.match(/data-testid="captured-post"/g)).toHaveLength(2);
    expect(html).toContain('【Main Features】');
    expect(html).toContain('mZNbA3xpBxXADK6Q.jpg');
    expect(html).toContain('data-testid="demo-reader-scroll"');
    expect(html).toContain('NOTE PERSONNELLE');
    expect(html).not.toContain('Exemple de note personnelle enregistrée');
  });

  it('keeps all public Reddit replies and does not invent a publication date', () => {
    const html = markup(2);
    expect(html.match(/data-testid="captured-post"/g)).toHaveLength(22);
    expect(html).toContain('Why is no one targeting tears of the kingdom?');
    expect(html).toContain('a6h98qsss6xh1.png');
    expect(html).not.toContain('undefined');
  });

  it('labels incomplete content instead of claiming it was verified', () => {
    const html = markup(3);
    expect(html).toContain('Capture partielle');
    expect(html).toContain('Certains messages étaient déjà tronqués');
  });
});

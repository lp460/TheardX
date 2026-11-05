// @vitest-environment jsdom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReadingNotesDock } from '../../src/reader/ReadingNotesDock';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  window.localStorage.clear();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

function button(label: string): HTMLButtonElement {
  const result = Array.from(container.querySelectorAll('button')).find((element) =>
    element.getAttribute('aria-label') === label,
  );
  if (!result) throw new Error(`Missing button: ${label}`);
  return result;
}

describe('dismissible reader notes companion', () => {
  it('keeps saved notes and annotation counts accessible, including editing', async () => {
    const onAnnotations = vi.fn();
    const onEditNote = vi.fn();
    await act(async () => root.render(createElement(ReadingNotesDock, {
      note: 'Une idée à conserver pour demain',
      annotationCount: 3,
      annotationsOpen: false,
      onToggleAnnotations: onAnnotations,
      onEditNote,
    })));
    expect(container.textContent).toContain('Une idée à conserver pour demain');
    expect(button('Afficher mes annotations (3)')).toBeTruthy();
    await act(async () => button('Afficher ma note personnelle').click());
    expect(container.querySelector('[data-testid="reader-notes-expanded"]')?.textContent)
      .toContain('Une idée à conserver pour demain');
    await act(async () => button('Afficher mes annotations (3)').click());
    expect(onAnnotations).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[data-testid="reader-notes-expanded"]')).toBeNull();
    await act(async () => button('Afficher ma note personnelle').click());
    await act(async () => {
      Array.from(container.querySelectorAll('button')).find((element) =>
        element.textContent?.includes('Modifier la note'),
      )!.click();
    });
    expect(onEditNote).toHaveBeenCalledTimes(1);
  });

  it('allows the companion to be hidden and restored, remembering the choice', async () => {
    const props = {
      note: 'À relire',
      annotationCount: 2,
      annotationsOpen: false,
      onToggleAnnotations: vi.fn(),
      onEditNote: vi.fn(),
    };
    await act(async () => root.render(createElement(ReadingNotesDock, props)));
    await act(async () => button('Masquer mes notes').click());
    expect(button('Afficher mes notes et annotations')).toBeTruthy();
    expect(window.localStorage.getItem('threadshelf.reader.notesDockHidden')).toBe('1');
    await act(async () => button('Afficher mes notes et annotations').click());
    expect(button('Masquer mes notes')).toBeTruthy();
    expect(window.localStorage.getItem('threadshelf.reader.notesDockHidden')).toBe('0');
  });

  it('does not cover articles that have no notes or annotations', async () => {
    await act(async () => root.render(createElement(ReadingNotesDock, {
      note: '', annotationCount: 0, annotationsOpen: false,
      onToggleAnnotations: vi.fn(), onEditNote: vi.fn(),
    })));
    expect(container.querySelector('[data-testid="reader-notes-dock"]')).toBeNull();
  });
});

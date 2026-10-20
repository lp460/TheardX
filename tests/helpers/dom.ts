import { JSDOM } from 'jsdom';

/** Parses a full HTML document (scripts are not executed). */
export function parseDoc(html: string, url = 'https://x.com/'): Document {
  return new JSDOM(html, { url }).window.document;
}

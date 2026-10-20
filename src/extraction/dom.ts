/** Small DOM helpers shared by layout strategies. */

/** querySelectorAll restricted to elements not inside one of the `exclude` containers. */
export function ownAll<T extends Element = Element>(
  root: Element,
  selector: string,
  exclude: Element[],
): T[] {
  return Array.from(root.querySelectorAll<T>(selector)).filter(
    (el) => !exclude.some((x) => x !== root && x.contains(el)),
  );
}

export function ownFirst<T extends Element = Element>(
  root: Element,
  selector: string,
  exclude: Element[],
): T | null {
  return ownAll<T>(root, selector, exclude)[0] ?? null;
}

export function textOf(el: Element | null | undefined): string {
  return (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

export function attr(el: Element | null | undefined, name: string): string | undefined {
  const v = el?.getAttribute(name);
  return v === null || v === undefined || v === '' ? undefined : v;
}

export function intAttr(el: Element | null | undefined, name: string): number | undefined {
  const v = Number.parseInt(el?.getAttribute(name) ?? '', 10);
  return Number.isFinite(v) && v > 0 ? v : undefined;
}

/** Localised phrases X uses for unavailable posts (tombstones). */
const TOMBSTONE_PATTERNS = [
  /this (post|tweet) (is unavailable|was deleted|has been deleted)/i,
  /(post|tweet) (is )?unavailable/i,
  /ce (post|tweet) (n.est pas disponible|n.est plus disponible|a été supprimé)/i,
  /(post|tweet) (est )?indisponible/i,
  /este (post|tweet) (no está disponible|fue eliminado)/i,
  /dieser (post|tweet) ist nicht verfügbar/i,
  /this post is from an account that no longer exists/i,
  /ce post provient d.un compte qui n.existe plus/i,
  /you.re unable to view this (post|tweet)/i,
  /vous ne pouvez pas voir ce post/i,
];

export function looksLikeTombstone(el: Element): boolean {
  const text = textOf(el);
  if (!text || text.length > 400) return false;
  return TOMBSTONE_PATTERNS.some((re) => re.test(text));
}

/** "Show more" link phrases for truncated long posts. */
const SHOW_MORE_RE =
  /^(show more|afficher plus|voir plus|mostrar más|mehr anzeigen|mostra altro|mostrar mais)$/i;

export function isShowMoreControl(el: Element): boolean {
  return SHOW_MORE_RE.test(textOf(el));
}

/** "Replying to" line prefixes. */
export const REPLYING_TO_RE =
  /^(replying to|en réponse à|répondre à|en respuesta a|antwort an|in risposta a|em resposta a)(\s|:|$)/i;

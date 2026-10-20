import type { Envelope, Request, ResponseFor } from './protocol';

export class MessagingError extends Error {}

/** Sends a validated request to the background worker and unwraps the envelope. */
export async function send<T extends Request>(req: T): Promise<ResponseFor<T['type']>> {
  let res: Envelope<ResponseFor<T['type']>> | undefined;
  try {
    res = (await chrome.runtime.sendMessage(req)) as Envelope<ResponseFor<T['type']>> | undefined;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/Extension context invalidated/i.test(msg)) {
      throw new MessagingError('ThreadShelf a été mis à jour — rechargez la page.');
    }
    throw new MessagingError(msg);
  }
  if (!res) throw new MessagingError('Pas de réponse du service ThreadShelf.');
  if (!res.ok) throw new MessagingError(res.error);
  return res.data;
}

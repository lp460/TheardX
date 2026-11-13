import { z } from 'zod';

/** Only additive commentary is permitted: shared source snapshots are immutable. */
export const sharedNoteInput = z.object({
  kind: z.enum(['note', 'comment', 'annotation']),
  itemIndex: z.number().int().min(0).max(49),
  postId: z.string().min(1).max(180).optional(),
  text: z.string().trim().min(1).max(2_000),
  quote: z.string().trim().min(1).max(500).optional(),
}).strict().superRefine((value, ctx) => {
  if (value.kind === 'annotation' && (!value.quote || !value.postId)) {
    ctx.addIssue({ code: 'custom', message: 'An annotation needs a selected post and quote.' });
  }
});

export type SharedNoteInput = z.infer<typeof sharedNoteInput>;

export interface SharedNote extends SharedNoteInput {
  id: string;
  createdAt: number;
  /** Display label only; never expose the Google email or OAuth token. */
  author: string;
  authorKey: string;
}

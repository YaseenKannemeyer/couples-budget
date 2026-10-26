import { z } from 'zod';
export const reactionKinds = ['heart', 'thanks', 'coffee', 'celebrate'] as const;
export const reactionKind = z.enum(reactionKinds);
export type ReactionKind = z.output<typeof reactionKind>;
export const reactionEmoji: Record<ReactionKind, string> = { heart: '💚', thanks: '👍', coffee: '☕', celebrate: '🎉' };
export const commentBody = z.string().trim().min(1).refine(value => [...value].length <= 1000);
export const commentRow = z.object({
  id: z.uuid(), household_id: z.uuid(), transaction_id: z.uuid(), author_id: z.uuid(), body: z.string(),
  version: z.number().int().positive(), created_at: z.iso.datetime({ offset: true }), updated_at: z.iso.datetime({ offset: true }),
  deleted_at: z.iso.datetime({ offset: true }).nullable(),
});
export const reactionRow = z.object({ household_id: z.uuid(), transaction_id: z.uuid(), author_id: z.uuid(), kind: reactionKind });
export type Comment = z.output<typeof commentRow>;
export type Reaction = z.output<typeof reactionRow>;

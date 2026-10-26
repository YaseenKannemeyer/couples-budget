import { z } from 'zod';

export const categoryInput = z.object({
  name: z.string().trim().min(1).max(40),
  emoji: z.string().trim().refine((value) => [...value].length <= 16).nullable(),
  bucket: z.enum(['needs', 'wants', 'savings']),
  visibility: z.enum(['shared', 'private']),
});

export const categoryRow = z.object({
  id: z.uuid(), household_id: z.uuid(), name: z.string(), emoji: z.string().nullable(),
  bucket: z.enum(['needs', 'wants', 'savings']), sort_order: z.number().int(), archived: z.boolean(),
  visibility: z.enum(['shared', 'private']), owner_id: z.uuid().nullable(), version: z.number().int(), starter_key: z.string().nullable(),
}).transform((row) => ({
  id: row.id, householdId: row.household_id, name: row.name, emoji: row.emoji, bucket: row.bucket,
  sortOrder: row.sort_order, archived: row.archived, visibility: row.visibility, ownerId: row.owner_id,
  version: row.version, starterKey: row.starter_key,
}));

export type Category = z.output<typeof categoryRow>;
export type CategoryInput = z.infer<typeof categoryInput>;

export function eligibleCategories(categories: Category[], visibility: 'shared' | 'private', userId: string) {
  return categories.filter((category) => !category.archived && (category.visibility === 'shared' ||
    (visibility === 'private' && category.ownerId === userId)));
}

export function replacementCategories(categories: Category[], source: Category, userId: string) {
  return eligibleCategories(categories, source.visibility, userId).filter((category) => category.id !== source.id);
}

export function categoryLabel(category: Pick<Category, 'name' | 'emoji'>) {
  return category.emoji ? `${category.emoji} ${category.name}` : category.name;
}

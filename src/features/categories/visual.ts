import { familyForId, type AccentFamily } from '@/constants/theme';
import type { IconName } from '@/components/ui/icon';
import type { Category } from './schema';

export type TileVisual = { family: AccentFamily; glyph: IconName };

/** Starter categories keep their recognisable family and glyph. */
const starters: Record<string, TileVisual> = {
  housing: { family: 'orange', glyph: 'home' },
  utilities: { family: 'orange', glyph: 'bolt' },
  essentials: { family: 'pink', glyph: 'basket' },
  personal: { family: 'pink', glyph: 'bag' },
  transport: { family: 'sky', glyph: 'car' },
  health: { family: 'sky', glyph: 'heart' },
  savings: { family: 'mint', glyph: 'leaf' },
  entertainment: { family: 'periwinkle', glyph: 'ticket' },
  fun: { family: 'periwinkle', glyph: 'ticket' },
  other: { family: 'slate', glyph: 'dots' },
};

/** Emoji are matched without variation selectors, so '🛡️' and '🛡' agree. */
const emojiGlyphs: Record<string, IconName> = {
  '🏡': 'home', '🏠': 'home', '🛒': 'basket', '💡': 'bolt', '🚗': 'car', '🚌': 'car', '⛽': 'car', '🛡': 'shield',
  '🍝': 'dining', '🍽': 'dining', '🍔': 'dining', '🍕': 'dining', '☕': 'cup', '🎟': 'ticket', '🎬': 'ticket',
  '🌱': 'leaf', '🩺': 'heart', '💊': 'heart', '🧴': 'bag', '🛍': 'bag', '📦': 'dots', '🎁': 'gift',
};
const nameGlyphs: [RegExp, IconName][] = [
  [/rent|home|house/i, 'home'], [/grocer/i, 'basket'], [/utilit|electric|water|power/i, 'bolt'],
  [/transport|car|fuel|petrol/i, 'car'], [/insur/i, 'shield'], [/eat|food|restaurant|dining|takeaway/i, 'dining'],
  [/coffee|cafe/i, 'cup'], [/fun|entertain|movie/i, 'ticket'], [/sav/i, 'leaf'], [/health|medical/i, 'heart'],
  [/gift/i, 'gift'], [/shop|cloth/i, 'bag'],
];

/** Custom categories get a glyph from their emoji or name; tiles always draw a white glyph, never a colour emoji. */
function customGlyph(emoji?: string | null, name?: string | null): IconName {
  const fromEmoji = emoji ? emojiGlyphs[emoji.replace(/\uFE0F/g, '')] : undefined;
  return fromEmoji ?? nameGlyphs.find(([pattern]) => name && pattern.test(name))?.[1] ?? 'tag';
}

/** Colour follows the category ID (or starter key), so reordering or renaming never recolours history. */
export function categoryVisual(category?: Pick<Category, 'id' | 'emoji' | 'starterKey'> & { name?: string | null } | null): TileVisual {
  if (!category) return { family: 'slate', glyph: 'dots' };
  const starter = category.starterKey ? starters[category.starterKey] : undefined;
  return starter ?? { family: familyForId(category.id), glyph: customGlyph(category.emoji, category.name) };
}

/** Unassigned/uncategorised spending is never confused with a real "Other" category. */
export const unassignedVisual: TileVisual = { family: 'slate', glyph: 'grid' };

/** Feature identities used across Plan, Overview and Settings. */
export const featureVisual = {
  spending: { family: 'orange', glyph: 'receipt' },
  bills: { family: 'orange', glyph: 'calendar' },
  goals: { family: 'mint', glyph: 'target' },
  contributions: { family: 'sky', glyph: 'people' },
  income: { family: 'sky', glyph: 'income' },
  forecast: { family: 'periwinkle', glyph: 'chart' },
  review: { family: 'sky', glyph: 'review' },
  balance: { family: 'sky', glyph: 'verified' },
  boosters: { family: 'mint', glyph: 'sparkle' },
  gift: { family: 'mint', glyph: 'gift' },
  split: { family: 'periwinkle', glyph: 'pie' },
  categories: { family: 'slate', glyph: 'grid' },
  budget: { family: 'orange', glyph: 'wallet' },
  allowance: { family: 'periwinkle', glyph: 'lock' },
  reminders: { family: 'slate', glyph: 'bell' },
  guides: { family: 'slate', glyph: 'book' },
  pending: { family: 'slate', glyph: 'clock' },
} satisfies Record<string, TileVisual>;

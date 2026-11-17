import type { CharCategory, Character, Story } from './types';

export const catsOf = (story: Pick<Story, 'charCategories' | 'charCategoryMap'>, charId: string): CharCategory[] => {
  const ids = story.charCategoryMap[charId] ?? [];
  return story.charCategories.filter((c) => ids.includes(c.id));
};

export interface CharGroup {
  /** undefined = characters with no category */
  cat?: CharCategory;
  chars: Character[];
}

/**
 * Characters grouped by category, in category order. A character in two
 * categories appears in both groups. With no categories set up, it's one group.
 */
export function groupCharacters(story: Pick<Story, 'charCategories' | 'charCategoryMap'>, chars: Character[]): CharGroup[] {
  if (!story.charCategories.length) return [{ chars }];
  const groups: CharGroup[] = story.charCategories.map((cat) => ({ cat, chars: chars.filter((c) => (story.charCategoryMap[c.id] ?? []).includes(cat.id)) }));
  const known = new Set(story.charCategories.map((c) => c.id));
  const loose = chars.filter((c) => !(story.charCategoryMap[c.id] ?? []).some((id) => known.has(id)));
  if (loose.length) groups.push({ chars: loose });
  return groups.filter((g) => g.chars.length);
}

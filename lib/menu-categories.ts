export const REQUIRED_MENU_CATEGORIES = [
  "Breakfast",
  "Lunch",
  "Dinner",
  "Ala carte",
] as const;

const REQUIRED_CATEGORY_ORDER = new Map(
  REQUIRED_MENU_CATEGORIES.map((name, index) => [name.toLowerCase(), index])
);

export function isRequiredMenuCategory(name: string): boolean {
  return REQUIRED_CATEGORY_ORDER.has(name.trim().toLowerCase());
}

export function sortMenuCategories<T extends { name: string }>(categories: readonly T[]): T[] {
  return [...categories].sort((left, right) => {
    const leftOrder = REQUIRED_CATEGORY_ORDER.get(left.name.trim().toLowerCase());
    const rightOrder = REQUIRED_CATEGORY_ORDER.get(right.name.trim().toLowerCase());

    if (leftOrder !== undefined || rightOrder !== undefined) {
      if (leftOrder === undefined) return 1;
      if (rightOrder === undefined) return -1;
      return leftOrder - rightOrder;
    }

    return left.name.localeCompare(right.name);
  });
}

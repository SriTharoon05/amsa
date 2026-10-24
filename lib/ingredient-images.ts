/** Stable local paths keep thumbnails cached across search, sorting and view changes. */
export function ingredientImagePath(id: number, name: string) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return `/images/ingredients/${String(id).padStart(2, '0')}-${slug}.webp`;
}

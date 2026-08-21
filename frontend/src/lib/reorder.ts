/**
 * Move the item at index `from` to index `to`, shifting the others to make room
 * (the storefront/admin "drag to a new position" behavior, not a two-item swap).
 * Returns the same array reference for a no-op or out-of-range indices.
 */
export function arrayMove<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = items.slice();
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

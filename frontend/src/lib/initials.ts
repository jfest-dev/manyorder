/**
 * Initials for a store logo placeholder: first letter of the first two words
 * (e.g. "Noodle House" -> "NH"), or the first two letters of a single word
 * ("Latte" -> "LA"). Returns "" for an empty/whitespace name so callers can
 * fall back to a neutral icon.
 */
export function storeInitials(name: string): string {
  const words = (name || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

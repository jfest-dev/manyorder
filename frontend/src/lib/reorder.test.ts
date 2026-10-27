import { describe, it, expect } from 'vitest';
import { arrayMove } from './reorder';

describe('arrayMove', () => {
  it('moves an item down, shifting the others up', () => {
    expect(arrayMove(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
  });
  it('moves an item up, shifting the others down', () => {
    expect(arrayMove(['a', 'b', 'c', 'd'], 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });
  it('moves to the last position', () => {
    expect(arrayMove(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
  });
  it('is a no-op when from === to (same reference)', () => {
    const items = ['a', 'b', 'c'];
    expect(arrayMove(items, 1, 1)).toBe(items);
  });
  it('is a no-op for out-of-range indices (same reference)', () => {
    const items = ['a', 'b'];
    expect(arrayMove(items, 5, 0)).toBe(items);
    expect(arrayMove(items, 0, -1)).toBe(items);
  });
  it('does not mutate the input', () => {
    const items = ['a', 'b', 'c'];
    arrayMove(items, 0, 2);
    expect(items).toEqual(['a', 'b', 'c']);
  });
});

import { describe, it, expect } from 'vitest';
import {
  validatePickedImage,
  ERR_NOT_A_PICTURE,
  ERR_UNREADABLE,
  IMAGE_RULE_TEXT,
  MAX_PICK_BYTES,
} from './image';

function file(type: string, size: number): File {
  const f = new File(['x'], 'photo', { type });
  // jsdom File.size is derived from content; override for the size check under test.
  Object.defineProperty(f, 'size', { value: size });
  return f;
}

describe('validatePickedImage', () => {
  it('accepts a JPEG/PNG/WebP within the pick ceiling', () => {
    expect(validatePickedImage(file('image/jpeg', 1_000))).toBeNull();
    expect(validatePickedImage(file('image/png', 10 * 1024 * 1024))).toBeNull();
    expect(validatePickedImage(file('image/webp', MAX_PICK_BYTES))).toBeNull();
  });

  it('rejects a non-image with the not-a-picture message', () => {
    expect(validatePickedImage(file('application/pdf', 1_000))).toBe(ERR_NOT_A_PICTURE);
    expect(validatePickedImage(file('text/plain', 1_000))).toBe(ERR_NOT_A_PICTURE);
  });

  it('rejects an original larger than 20 MB with the unreadable message', () => {
    expect(validatePickedImage(file('image/jpeg', MAX_PICK_BYTES + 1))).toBe(ERR_UNREADABLE);
  });

  it('exposes the single under-box rule text', () => {
    expect(IMAGE_RULE_TEXT).toBe('JPG, PNG or WebP');
  });
});

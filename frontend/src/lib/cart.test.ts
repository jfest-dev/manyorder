import { describe, it, expect } from 'vitest';
import type { ProductResponse } from './api';
import {
  lineSignature, plainSignature, normalizeOptionIds, normalizeNotes,
  parseCart, addLine, setLineQty, removeLine, updateLine, cartCount, plainQuantities,
  hydrateCart, cartLineToCheckoutItem, type CartItem,
} from './cart';

// --- product factory -------------------------------------------------------

function product(overrides: Partial<ProductResponse> = {}): ProductResponse {
  return {
    id: 1, merchantId: 1, name: 'Milk Tea', description: null, price: 10,
    isActive: true, categoryId: null, categoryName: null, stock: 50, sku: null,
    photoUrl: null, preOrder: false, preOrderReadyDate: null,
    preOrderReadyTimeStart: null, preOrderReadyTimeEnd: null, preOrderNote: null,
    modifierGroups: [
      {
        id: 10, name: 'Size', minSelect: 1, maxSelect: 1, required: true, sortOrder: 0,
        options: [
          { id: 100, name: 'Small', priceDelta: 0, sortOrder: 0 },
          { id: 101, name: 'Large', priceDelta: 2, sortOrder: 1 },
        ],
      },
      {
        id: 11, name: 'Add-ons', minSelect: 0, maxSelect: null, required: false, sortOrder: 1,
        options: [
          { id: 200, name: 'Pearls', priceDelta: 1, sortOrder: 0 },
          { id: 201, name: 'Grass Jelly', priceDelta: 1.5, sortOrder: 1 },
        ],
      },
    ],
    unitsSold: 0, createdAt: '2026-01-01T00:00:00',
    ...overrides,
  };
}

const item = (o: Partial<CartItem> & { productId: number }): CartItem => ({
  quantity: 1, modifierOptionIds: [], ...o,
});

// --- signature -------------------------------------------------------------

describe('normalizeOptionIds', () => {
  it('dedupes and sorts ascending', () => {
    expect(normalizeOptionIds([201, 100, 201])).toEqual([100, 201]);
  });
  it('is empty for null/undefined', () => {
    expect(normalizeOptionIds(null)).toEqual([]);
    expect(normalizeOptionIds(undefined)).toEqual([]);
  });
});

describe('normalizeNotes', () => {
  it('trims and coalesces to empty string', () => {
    expect(normalizeNotes('  hi ')).toBe('hi');
    expect(normalizeNotes(undefined)).toBe('');
    expect(normalizeNotes(null)).toBe('');
  });
});

describe('lineSignature', () => {
  it('is order-insensitive across option ids', () => {
    expect(lineSignature({ productId: 1, modifierOptionIds: [101, 200] }))
      .toBe(lineSignature({ productId: 1, modifierOptionIds: [200, 101] }));
  });
  it('distinguishes different option sets', () => {
    expect(lineSignature({ productId: 1, modifierOptionIds: [101] }))
      .not.toBe(lineSignature({ productId: 1, modifierOptionIds: [100] }));
  });
  it('distinguishes different notes', () => {
    expect(lineSignature({ productId: 1, notes: 'less sugar' }))
      .not.toBe(lineSignature({ productId: 1, notes: 'no ice' }));
  });
  it('plainSignature has no modifiers and no note', () => {
    expect(plainSignature(7)).toBe('7##');
    expect(plainSignature(7)).toBe(lineSignature({ productId: 7 }));
  });
});

// --- add / set / remove ----------------------------------------------------

describe('addLine', () => {
  it('merges quantities for the same signature', () => {
    let cart: CartItem[] = [];
    cart = addLine(cart, item({ productId: 1, quantity: 1, modifierOptionIds: [101] }));
    cart = addLine(cart, item({ productId: 1, quantity: 2, modifierOptionIds: [101] }));
    expect(cart).toHaveLength(1);
    expect(cart[0].quantity).toBe(3);
  });
  it('merges regardless of option order', () => {
    let cart: CartItem[] = [];
    cart = addLine(cart, item({ productId: 1, modifierOptionIds: [101, 200] }));
    cart = addLine(cart, item({ productId: 1, modifierOptionIds: [200, 101] }));
    expect(cart).toHaveLength(1);
    expect(cart[0].quantity).toBe(2);
  });
  it('keeps different modifier choices as separate lines', () => {
    let cart: CartItem[] = [];
    cart = addLine(cart, item({ productId: 1, modifierOptionIds: [100] }));
    cart = addLine(cart, item({ productId: 1, modifierOptionIds: [101] }));
    expect(cart).toHaveLength(2);
  });
  it('keeps different notes as separate lines', () => {
    let cart: CartItem[] = [];
    cart = addLine(cart, item({ productId: 1, notes: 'less sugar' }));
    cart = addLine(cart, item({ productId: 1, notes: 'no ice' }));
    expect(cart).toHaveLength(2);
  });
  it('normalizes stored ids and drops a blank note', () => {
    const cart = addLine([], item({ productId: 1, modifierOptionIds: [200, 101, 200], notes: '   ' }));
    expect(cart[0].modifierOptionIds).toEqual([101, 200]);
    expect(cart[0].notes).toBeUndefined();
  });
});

describe('setLineQty / removeLine', () => {
  it('sets a line quantity by signature', () => {
    const cart = addLine([], item({ productId: 1, modifierOptionIds: [101] }));
    const sig = lineSignature(cart[0]);
    expect(setLineQty(cart, sig, 5)[0].quantity).toBe(5);
  });
  it('removes the line when quantity drops to 0', () => {
    const cart = addLine([], item({ productId: 1, modifierOptionIds: [101] }));
    const sig = lineSignature(cart[0]);
    expect(setLineQty(cart, sig, 0)).toHaveLength(0);
  });
  it('only touches the matching signature', () => {
    let cart: CartItem[] = [];
    cart = addLine(cart, item({ productId: 1, modifierOptionIds: [100] }));
    cart = addLine(cart, item({ productId: 1, modifierOptionIds: [101] }));
    const sig = lineSignature({ productId: 1, modifierOptionIds: [100] });
    cart = removeLine(cart, sig);
    expect(cart).toHaveLength(1);
    expect(cart[0].modifierOptionIds).toEqual([101]);
  });
});

describe('updateLine', () => {
  it('replaces a line\'s choices in place, keeping its quantity', () => {
    let cart: CartItem[] = [];
    cart = addLine(cart, item({ productId: 1, quantity: 2, modifierOptionIds: [100] }));
    const oldSig = lineSignature({ productId: 1, modifierOptionIds: [100] });
    cart = updateLine(cart, oldSig, item({ productId: 1, quantity: 2, modifierOptionIds: [101], notes: 'no ice' }));
    expect(cart).toHaveLength(1);
    expect(cart[0]).toMatchObject({ productId: 1, quantity: 2, modifierOptionIds: [101], notes: 'no ice' });
  });
  it('merges into another line when the edit collides with an existing signature', () => {
    let cart: CartItem[] = [];
    cart = addLine(cart, item({ productId: 1, quantity: 2, modifierOptionIds: [100] })); // A
    cart = addLine(cart, item({ productId: 1, quantity: 3, modifierOptionIds: [101] })); // B
    const sigA = lineSignature({ productId: 1, modifierOptionIds: [100] });
    // Edit A to match B's choices -> they merge, quantities sum (3 + 2).
    cart = updateLine(cart, sigA, item({ productId: 1, quantity: 2, modifierOptionIds: [101] }));
    expect(cart).toHaveLength(1);
    expect(cart[0]).toMatchObject({ modifierOptionIds: [101], quantity: 5 });
  });
  it('leaves other lines untouched', () => {
    let cart: CartItem[] = [];
    cart = addLine(cart, item({ productId: 1, modifierOptionIds: [100] }));
    cart = addLine(cart, item({ productId: 2, modifierOptionIds: [] }));
    const sig = lineSignature({ productId: 1, modifierOptionIds: [100] });
    cart = updateLine(cart, sig, item({ productId: 1, modifierOptionIds: [101] }));
    expect(cart).toHaveLength(2);
    expect(cart.find((l) => l.productId === 2)).toBeTruthy();
  });
});

// --- counts / plain lines --------------------------------------------------

describe('cartCount', () => {
  it('sums quantities across lines', () => {
    let cart: CartItem[] = [];
    cart = addLine(cart, item({ productId: 1, quantity: 2, modifierOptionIds: [100] }));
    cart = addLine(cart, item({ productId: 1, quantity: 3, modifierOptionIds: [101] }));
    expect(cartCount(cart)).toBe(5);
  });
});

describe('plainQuantities', () => {
  it('reflects only lines with no modifiers and no note', () => {
    let cart: CartItem[] = [];
    cart = addLine(cart, item({ productId: 1, quantity: 2 }));               // plain
    cart = addLine(cart, item({ productId: 1, quantity: 4, modifierOptionIds: [101] })); // not plain
    cart = addLine(cart, item({ productId: 2, quantity: 1, notes: 'hot' })); // not plain
    expect(plainQuantities(cart)).toEqual({ 1: 2 });
  });
});

// --- parse -----------------------------------------------------------------

describe('parseCart', () => {
  it('returns [] for null / invalid JSON / non-array', () => {
    expect(parseCart(null)).toEqual([]);
    expect(parseCart('not json')).toEqual([]);
    expect(parseCart('{}')).toEqual([]);
  });
  it('reads the modifier-aware shape', () => {
    const raw = JSON.stringify([{ productId: 1, quantity: 2, modifierOptionIds: [200, 101], notes: 'x' }]);
    expect(parseCart(raw)).toEqual([{ productId: 1, quantity: 2, modifierOptionIds: [101, 200], notes: 'x' }]);
  });
  it('tolerates the legacy {productId, quantity} shape', () => {
    const raw = JSON.stringify([{ productId: 5, quantity: 3 }]);
    expect(parseCart(raw)).toEqual([{ productId: 5, quantity: 3, modifierOptionIds: [], notes: undefined }]);
  });
  it('tolerates the original {product, quantity} snapshot shape', () => {
    const raw = JSON.stringify([{ product: { id: 9 }, quantity: 1 }]);
    expect(parseCart(raw)[0].productId).toBe(9);
  });
  it('drops entries with no product id or non-positive quantity', () => {
    const raw = JSON.stringify([{ quantity: 2 }, { productId: 1, quantity: 0 }]);
    expect(parseCart(raw)).toEqual([]);
  });
});

// --- hydrate ---------------------------------------------------------------

describe('hydrateCart', () => {
  it('computes selected options, unit price and line subtotal', () => {
    const cart = [item({ productId: 1, quantity: 2, modifierOptionIds: [101, 200] })];
    const [line] = hydrateCart(cart, [product()]);
    expect(line.selectedOptions.map((o) => o.optionName)).toEqual(['Large', 'Pearls']);
    expect(line.unitPrice).toBe(13);      // 10 + 2 + 1
    expect(line.lineSubtotal).toBe(26);   // 13 * 2
    expect(line.signature).toBe(lineSignature(cart[0]));
  });
  it('is a plain product at base price when nothing is chosen', () => {
    const [line] = hydrateCart([item({ productId: 1, quantity: 1 })], [product()]);
    expect(line.selectedOptions).toEqual([]);
    expect(line.unitPrice).toBe(10);
    expect(line.lineSubtotal).toBe(10);
  });
  it('drops a line whose product no longer exists', () => {
    expect(hydrateCart([item({ productId: 999 })], [product()])).toEqual([]);
  });
  it('omits a chosen option that no longer exists on the product (price ignores it)', () => {
    const cart = [item({ productId: 1, modifierOptionIds: [101, 555] })];
    const [line] = hydrateCart(cart, [product()]);
    expect(line.selectedOptions.map((o) => o.optionName)).toEqual(['Large']);
    expect(line.unitPrice).toBe(12); // only the surviving Large delta
  });
});

// --- checkout payload ------------------------------------------------------

describe('cartLineToCheckoutItem', () => {
  it('sends ids + note only when present', () => {
    const withMods = hydrateCart([item({ productId: 1, quantity: 2, modifierOptionIds: [101], notes: 'less sugar' })], [product()])[0];
    expect(cartLineToCheckoutItem(withMods)).toEqual({
      productId: 1, quantity: 2, modifierOptionIds: [101], notes: 'less sugar',
    });
  });
  it('omits empty modifiers and blank notes', () => {
    const plain = hydrateCart([item({ productId: 1, quantity: 1 })], [product()])[0];
    expect(cartLineToCheckoutItem(plain)).toEqual({ productId: 1, quantity: 1 });
  });
});

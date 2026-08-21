import type { GuestCheckoutItem, ProductResponse } from './api';
import { resolveSelectedOptions } from './modifiers';

/**
 * The guest cart, refactored for modifiers + per-line notes.
 *
 * A cart line can no longer be identified by product alone: the same product
 * with different modifier choices - or a different per-line note - is a
 * SEPARATE line. Identity is the line *signature* (product id + the sorted set
 * of chosen option ids + the trimmed note). Two adds with the same signature
 * merge (their quantities sum); different signatures stay distinct.
 *
 * Only ids + quantity + note persist - never a price or product snapshot - so
 * everything price/name/stock is always resolved fresh against the live product
 * (see {@link hydrateCart}). The client never trusts or stores a price.
 */

export interface CartItem {
  productId: number;
  quantity: number;
  /** Chosen modifier option ids (order-insensitive; normalized on write). */
  modifierOptionIds: number[];
  /** Per-line note, e.g. "less sugar". Absent/blank = none. */
  notes?: string;
}

/** One resolved modifier choice, for rendering + line pricing. */
export interface SelectedOption {
  groupName: string;
  optionName: string;
  priceDelta: number;
}

/** A cart item hydrated against the live product - everything needed to render. */
export interface CartLine {
  /** Stable line identity (see {@link lineSignature}). Use as the React key. */
  signature: string;
  product: ProductResponse;
  quantity: number;
  modifierOptionIds: number[];
  notes?: string;
  selectedOptions: SelectedOption[];
  /** Base price + chosen modifier deltas. */
  unitPrice: number;
  /** unitPrice * quantity. */
  lineSubtotal: number;
}

/** Dedupe + sort option ids so identity is independent of selection order. */
export function normalizeOptionIds(ids: number[] | null | undefined): number[] {
  if (!ids) return [];
  return Array.from(new Set(ids.filter((n) => Number.isFinite(n)))).sort((a, b) => a - b);
}

export function normalizeNotes(notes: string | null | undefined): string {
  return (notes ?? '').trim();
}

/** The signature that identifies a line: `productId#id,id#note`. */
export function lineSignature(item: {
  productId: number;
  modifierOptionIds?: number[] | null;
  notes?: string | null;
}): string {
  return `${item.productId}#${normalizeOptionIds(item.modifierOptionIds).join(',')}#${normalizeNotes(item.notes)}`;
}

/** Signature of the "plain" line for a product - no modifiers, no note. This is
 *  what the shop quick-add / stepper manages. */
export function plainSignature(productId: number): string {
  return lineSignature({ productId });
}

/**
 * Parse the persisted cart, tolerating older shapes: the pre-modifier
 * `{productId, quantity}` and the original `{product, quantity}` snapshot.
 */
export function parseCart(raw: string | null): CartItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((l: any) => {
        const notes = typeof l?.notes === 'string' ? l.notes.trim() : '';
        return {
          productId: Number(l?.productId ?? l?.product?.id),
          quantity: Number(l?.quantity) || 0,
          modifierOptionIds: normalizeOptionIds(
            Array.isArray(l?.modifierOptionIds) ? l.modifierOptionIds.map(Number) : [],
          ),
          notes: notes || undefined,
        } as CartItem;
      })
      .filter((it) => Number.isFinite(it.productId) && it.quantity > 0);
  } catch {
    return [];
  }
}

/** Add a line, merging into an existing line with the same signature. */
export function addLine(cart: CartItem[], item: CartItem): CartItem[] {
  const normalized: CartItem = {
    productId: item.productId,
    quantity: item.quantity,
    modifierOptionIds: normalizeOptionIds(item.modifierOptionIds),
    notes: normalizeNotes(item.notes) || undefined,
  };
  const sig = lineSignature(normalized);
  const idx = cart.findIndex((it) => lineSignature(it) === sig);
  if (idx >= 0) {
    return cart.map((it, i) => (i === idx ? { ...it, quantity: it.quantity + normalized.quantity } : it));
  }
  return [...cart, normalized];
}

/** Set a line's quantity by signature; a quantity <= 0 removes it. */
export function setLineQty(cart: CartItem[], signature: string, quantity: number): CartItem[] {
  if (quantity <= 0) return removeLine(cart, signature);
  return cart.map((it) => (lineSignature(it) === signature ? { ...it, quantity } : it));
}

/**
 * Replace the line identified by `oldSignature` with `item` (used when a customer
 * edits a cart line's choices). If the edited line's new signature collides with
 * another existing line, they merge and their quantities sum.
 */
export function updateLine(cart: CartItem[], oldSignature: string, item: CartItem): CartItem[] {
  return addLine(removeLine(cart, oldSignature), item);
}

export function removeLine(cart: CartItem[], signature: string): CartItem[] {
  return cart.filter((it) => lineSignature(it) !== signature);
}

/** Total quantity across every line. */
export function cartCount(cart: CartItem[]): number {
  return cart.reduce((n, it) => n + it.quantity, 0);
}

/**
 * Quantities of the PLAIN lines only (no modifiers, no note), keyed by product
 * id - what the shop grid's inline "+"/stepper reflects. Lines that carry
 * modifiers/notes are managed from the cart page, not the shop stepper.
 */
export function plainQuantities(cart: CartItem[]): Record<number, number> {
  const out: Record<number, number> = {};
  for (const it of cart) {
    if (it.modifierOptionIds.length === 0 && !normalizeNotes(it.notes)) {
      out[it.productId] = it.quantity;
    }
  }
  return out;
}

/**
 * Self-heal a persisted cart against the live products: drop any chosen option id
 * that no longer exists on its product (e.g. orphaned by a merchant editing that
 * product's modifiers), and merge lines that become identical as a result so two
 * "no options" lines collapse into one. Products the client can't currently see
 * are left untouched. Returns the same reference when nothing changed, so it's a
 * cheap no-op on a healthy cart.
 *
 * Note: with the backend now keeping option ids stable across a save, this only
 * matters for carts orphaned before the fix (or if an option is genuinely
 * removed) - a safety net, not the primary fix.
 */
export function healCart(cart: CartItem[], products: ProductResponse[]): CartItem[] {
  const productById = new Map(products.map((p) => [p.id, p]));
  const healed: CartItem[] = [];
  let changed = false;
  for (const it of cart) {
    const product = productById.get(it.productId);
    if (!product) { healed.push(it); continue; } // can't see it -> leave as-is
    const live = new Set<number>();
    for (const g of product.modifierGroups ?? []) for (const o of g.options) live.add(o.id);
    const surviving = normalizeOptionIds(it.modifierOptionIds.filter((id) => live.has(id)));
    if (surviving.length !== it.modifierOptionIds.length) changed = true;
    const item: CartItem = { ...it, modifierOptionIds: surviving };
    const sig = lineSignature(item);
    const existing = healed.find((h) => lineSignature(h) === sig);
    if (existing) { existing.quantity += item.quantity; changed = true; } // merge duplicates
    else healed.push(item);
  }
  return changed ? healed : cart;
}

/**
 * Resolve every line against the freshly-fetched products, computing the chosen
 * options + effective unit price + line subtotal. Lines whose product no longer
 * exists are dropped; a chosen option that no longer exists on the product is
 * simply omitted from the price (the backend is the authority at checkout).
 */
export function hydrateCart(cart: CartItem[], products: ProductResponse[]): CartLine[] {
  const lines: CartLine[] = [];
  for (const it of cart) {
    const product = products.find((p) => p.id === it.productId);
    if (!product) continue;

    const { selectedOptions, modifiersTotal } = resolveSelectedOptions(product, it.modifierOptionIds);
    const unitPrice = product.price + modifiersTotal;

    lines.push({
      signature: lineSignature(it),
      product,
      quantity: it.quantity,
      modifierOptionIds: it.modifierOptionIds,
      notes: it.notes,
      selectedOptions,
      unitPrice,
      lineSubtotal: unitPrice * it.quantity,
    });
  }
  return lines;
}

/** Map a cart line to the checkout payload item (ids + note only, no prices). */
export function cartLineToCheckoutItem(line: CartLine): GuestCheckoutItem {
  return {
    productId: line.product.id,
    quantity: line.quantity,
    ...(line.modifierOptionIds.length ? { modifierOptionIds: line.modifierOptionIds } : {}),
    ...(normalizeNotes(line.notes) ? { notes: normalizeNotes(line.notes) } : {}),
  };
}

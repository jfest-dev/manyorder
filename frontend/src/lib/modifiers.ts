import type { ModifierGroupInput, ModifierGroupView, ProductResponse } from './api';

/**
 * Merchant-side modifier model + mappings.
 *
 * The editor works in a shop-owner-friendly shape (a Required toggle + a
 * choose-one/choose-many switch) rather than raw min/max integers; this module
 * maps that model to and from the API's {@link ModifierGroupInput} /
 * {@link ModifierGroupView}. It also owns {@link resolveSelectedOptions}, the
 * single client-side "given these option ids, what did they pick and what's the
 * delta" helper shared by the storefront cart and the manual-order composer.
 * The server remains the price authority - this is display only.
 */

export interface EditorOption {
  name: string;
  /** Add-on price; null while the field is empty. Treated as 0 on save. */
  priceDelta: number | null;
}

export interface EditorGroup {
  name: string;
  /** minSelect >= 1. For choose-one this makes it a required single choice. */
  required: boolean;
  /** false = choose one (radio, maxSelect 1); true = choose many (checkbox). */
  multiple: boolean;
  /** Only for `multiple`: cap on how many can be picked; null = no limit. */
  maxSelect: number | null;
  options: EditorOption[];
}

export function blankEditorOption(): EditorOption {
  return { name: '', priceDelta: null };
}

export function blankEditorGroup(): EditorGroup {
  return { name: '', required: false, multiple: false, maxSelect: null, options: [blankEditorOption(), blankEditorOption()] };
}

/** Server view → editor model (for Edit Product). */
export function editorGroupsFromViews(views: ModifierGroupView[] | undefined | null): EditorGroup[] {
  if (!views) return [];
  return views.map((v) => ({
    name: v.name,
    required: v.minSelect >= 1,
    multiple: v.maxSelect !== 1,
    maxSelect: v.maxSelect === 1 ? null : v.maxSelect,
    options: v.options.map((o) => ({ name: o.name, priceDelta: o.priceDelta })),
  }));
}

/** Editor model → API input. Blank-named option rows are dropped; order is
 *  taken from array position. */
export function editorGroupsToInputs(groups: EditorGroup[]): ModifierGroupInput[] {
  return groups.map((g, gi) => ({
    name: g.name.trim(),
    minSelect: g.required ? 1 : 0,
    maxSelect: g.multiple ? g.maxSelect : 1,
    sortOrder: gi,
    options: g.options
      .filter((o) => o.name.trim())
      .map((o, oi) => ({ name: o.name.trim(), priceDelta: o.priceDelta ?? 0, sortOrder: oi })),
  }));
}

/**
 * Validate the editor model before save. Returns the first human-readable error,
 * or null when valid. Mirrors the backend's rules so the merchant sees a clean
 * message instead of a 400.
 */
export function validateEditorGroups(groups: EditorGroup[]): string | null {
  for (const g of groups) {
    const name = g.name.trim();
    if (!name) return 'Every modifier group needs a name.';
    const named = g.options.filter((o) => o.name.trim());
    if (named.length === 0) return `"${name}" needs at least one option.`;
    for (const o of named) {
      if (o.priceDelta != null && o.priceDelta < 0) return `"${name}": option prices can't be negative.`;
    }
    if (g.multiple && g.maxSelect != null) {
      if (g.maxSelect < 1) return `"${name}": max selectable must be at least 1.`;
      if (g.required && g.maxSelect < 1) return `"${name}": max can't be less than the required minimum.`;
      if (g.maxSelect > named.length) return `"${name}": max can't exceed its number of options.`;
    }
  }
  return null;
}

/** True when a group makes a choice mandatory (needs the PDP flow on the shop). */
export function hasRequiredGroup(product: Pick<ProductResponse, 'modifierGroups'>): boolean {
  return (product.modifierGroups ?? []).some((g) => g.required);
}

/** True when the chosen ids satisfy every group's min/max rule (order-ready). */
export function groupSelectionComplete(
  groups: ModifierGroupView[] | undefined | null,
  selectedIds: number[],
): boolean {
  if (!groups) return true;
  return groups.every((g) => {
    const count = g.options.reduce((n, o) => (selectedIds.includes(o.id) ? n + 1 : n), 0);
    return count >= g.minSelect && (g.maxSelect == null || count <= g.maxSelect);
  });
}

export interface ResolvedOption {
  groupName: string;
  optionName: string;
  priceDelta: number;
}

/**
 * Resolve chosen option ids against a product's live groups → the picked options
 * (in group/option order) and their summed delta. Options that no longer exist
 * on the product are ignored (the server is the authority at order time).
 */
export function resolveSelectedOptions(
  product: Pick<ProductResponse, 'modifierGroups'>,
  optionIds: number[],
): { selectedOptions: ResolvedOption[]; modifiersTotal: number } {
  const selectedOptions: ResolvedOption[] = [];
  for (const g of product.modifierGroups ?? []) {
    for (const o of g.options) {
      if (optionIds.includes(o.id)) {
        selectedOptions.push({ groupName: g.name, optionName: o.name, priceDelta: o.priceDelta });
      }
    }
  }
  const modifiersTotal = selectedOptions.reduce((s, o) => s + o.priceDelta, 0);
  return { selectedOptions, modifiersTotal };
}

/**
 * Single source of truth for the store fields that must read and behave the
 * same on Create Store and Store Settings: business type, currency and phone.
 * Both screens import these lists, labels and helpers so they can never drift.
 */

export interface Option { value: string; label: string; }

/** The six business types, stored by code. Shown on both screens. */
export const BUSINESS_TYPES: Option[] = [
  { value: 'fashion', label: 'Fashion & Apparel' },
  { value: 'food', label: 'Food & Beverage' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'beauty', label: 'Beauty & Cosmetics' },
  { value: 'home', label: 'Home & Living' },
  { value: 'other', label: 'Other' },
];

/**
 * Business-type options for a store whose saved value may predate the six
 * (e.g. an old "Retail" or "Services"). The legacy value is appended as-is so
 * it is shown, never silently dropped or changed, until the owner picks one of
 * the six. No data migration.
 */
export function businessTypeOptions(current?: string | null): Option[] {
  if (current && current.trim() !== '' && !BUSINESS_TYPES.some((o) => o.value === current)) {
    return [...BUSINESS_TYPES, { value: current, label: current }];
  }
  return BUSINESS_TYPES;
}

/** The two currencies, stored uppercase. */
export const CURRENCIES: Option[] = [
  { value: 'SGD', label: 'SGD - Singapore dollar' },
  { value: 'IDR', label: 'IDR - Indonesian rupiah' },
];

/** Country codes offered by the shared phone input. */
export const PHONE_COUNTRY_CODES = ['+65', '+62'];
export const PHONE_COUNTRY_OPTIONS: Option[] = [
  { value: '+65', label: '+65 (Singapore)' },
  { value: '+62', label: '+62 (Indonesia)' },
];

/**
 * Split a stored phone into a known country code + the rest. If it does not
 * start with +65 or +62 (or cannot be split) the whole value is returned as the
 * number with no code selected, so legacy/foreign numbers show unchanged.
 */
export function splitPhone(value: string | null | undefined): { code: string; number: string } {
  const v = (value ?? '').trim();
  for (const c of PHONE_COUNTRY_CODES) {
    if (v.startsWith(c)) return { code: c, number: v.slice(c.length).trim() };
  }
  return { code: '', number: v };
}

/** Re-join a code + number. Empty number means no phone (clears it). */
export function combinePhone(code: string, number: string): string {
  const n = number.trim();
  if (!n) return '';
  return code ? `${code}${n}` : n;
}

/** Labels and helpers shared verbatim by both screens, sentence case. */
export const STORE_FIELD_TEXT = {
  businessTypeLabel: 'Business type',
  businessTypeHelper: 'Help us understand your business better.',
  currencyLabel: 'Currency',
  currencyHelperEditable: 'You can change this until your first order.',
  currencyHelperLocked: "Currency can't change after the first order.",
  phoneLabel: 'Phone',
  phoneHelper: 'This will be your contact number.',
} as const;

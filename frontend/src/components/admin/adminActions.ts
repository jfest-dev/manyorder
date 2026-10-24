/**
 * Readable names for the audit action codes, shared by the Activity page and the
 * Overview "Recent admin actions" panel so both read identically. An unknown code
 * falls back to the raw code rather than showing nothing.
 */
export const ACTION_LABEL: Record<string, string> = {
  SUSPEND_MERCHANT: 'Suspended store',
  UNSUSPEND_MERCHANT: 'Reinstated store',
  DEACTIVATE_PRODUCT: 'Hid product',
  ACTIVATE_PRODUCT: 'Unhid product',
  DEACTIVATE_DISCOUNT: 'Switched off discount',
  ACTIVATE_DISCOUNT: 'Switched on discount',
  CREATE_PRODUCT: 'Added product',
  UPDATE_PRODUCT: 'Edited product',
  DELETE_PRODUCT: 'Deleted product',
  REORDER_PRODUCTS: 'Reordered products',
  CREATE_CUSTOMER: 'Added customer',
  UPDATE_CUSTOMER: 'Edited customer',
  DELETE_CUSTOMER: 'Deleted customer',
  CREATE_DISCOUNT: 'Created discount',
  UPDATE_DISCOUNT: 'Edited discount',
  DELETE_DISCOUNT: 'Deleted discount',
  REORDER_DISCOUNTS: 'Reordered discounts',
};

export const readableAction = (code: string): string => ACTION_LABEL[code] ?? code;

/**
 * Readable names for the audit action codes, shared by every screen that shows an admin
 * action: the Overview "Recent admin actions" panel, the Activity page, and a store's
 * history. An unknown code falls back to the raw code rather than showing nothing.
 *
 * AUDIT_ACTIONS below is the full set of action codes the backend can record (kept in
 * step with the backend by AdminAuditActionsTest on the Java side). A test fails if any
 * of them is missing a readable label here, so a new action can never ship as a raw code.
 */
export const ACTION_LABEL: Record<string, string> = {
  SUSPEND_MERCHANT: 'Suspended store',
  UNSUSPEND_MERCHANT: 'Reinstated store',
  PROTECT_STORE: 'Protected store',
  UNPROTECT_STORE: 'Removed store protection',
  RESTORE_STORE: 'Restored store',
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
  UPDATE_ORDER_STATUS: 'Changed order status',
  UPDATE_ORDER_PAYMENT_STATUS: 'Changed payment status',
};

/** Every audit action code the backend records. Mirrors AdminAuditActions on the Java
 *  side; a test asserts each has a label in {@link ACTION_LABEL}. */
export const AUDIT_ACTIONS: string[] = [
  'SUSPEND_MERCHANT', 'UNSUSPEND_MERCHANT', 'PROTECT_STORE', 'UNPROTECT_STORE', 'RESTORE_STORE',
  'CREATE_PRODUCT', 'UPDATE_PRODUCT', 'DELETE_PRODUCT', 'ACTIVATE_PRODUCT', 'DEACTIVATE_PRODUCT', 'REORDER_PRODUCTS',
  'CREATE_CUSTOMER', 'UPDATE_CUSTOMER', 'DELETE_CUSTOMER',
  'CREATE_DISCOUNT', 'UPDATE_DISCOUNT', 'DELETE_DISCOUNT', 'ACTIVATE_DISCOUNT', 'DEACTIVATE_DISCOUNT', 'REORDER_DISCOUNTS',
  'UPDATE_ORDER_STATUS', 'UPDATE_ORDER_PAYMENT_STATUS',
];

export const readableAction = (code: string): string => ACTION_LABEL[code] ?? code;

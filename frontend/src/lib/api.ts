// REST client for the ManyOrder Spring Boot API (replaces Supabase).

import { prepareImageForUpload, LOGO_MAX_DIM, LOGO_QUALITY, PRODUCT_MAX_DIM, PRODUCT_QUALITY } from './image';

export const API_BASE: string =
  (import.meta as any).env?.VITE_API_BASE || 'http://localhost:8080';

const TOKEN_KEY = 'manyorder_token';
// Kept in sync with AuthContext's USER_KEY - the token and the user are always
// written to, and read from, the SAME storage so they can never disagree.
const USER_KEY = 'manyorder_user';

/**
 * The storage that holds THIS tab's session, checked sessionStorage FIRST so a
 * tab's own session-only login always wins over a remembered (localStorage) login
 * that another tab may have left in the shared localStorage. Returns null when the
 * tab has no session.
 */
function tokenStorage(): Storage | null {
  try {
    if (sessionStorage.getItem(TOKEN_KEY)) return sessionStorage;
    if (localStorage.getItem(TOKEN_KEY)) return localStorage;
  } catch { /* storage unavailable */ }
  return null;
}

export function getToken(): string | null {
  const s = tokenStorage();
  return s ? s.getItem(TOKEN_KEY) : null;
}

/**
 * Replace just the token in whichever storage currently holds this tab's session,
 * keeping the stored user as-is. Used after an action that reissues the token for
 * the current device (password change, sign out everywhere).
 */
export function replaceToken(token: string) {
  try {
    const s = tokenStorage() ?? sessionStorage;
    s.setItem(TOKEN_KEY, token);
  } catch { /* storage unavailable */ }
}

/** The stored user JSON from the SAME storage as the token (paired read). */
export function getStoredUserJson(): string | null {
  const s = tokenStorage();
  return s ? s.getItem(USER_KEY) : null;
}

/**
 * Write the token and user together to one storage. Remembered logins go to the
 * shared localStorage; session-only logins (and ALL platform-admin logins) go to
 * this tab's sessionStorage. A session-only login never clears localStorage, so it
 * can't log another tab's remembered login out; a remembered login clears this
 * tab's sessionStorage so it becomes the one source of truth here.
 */
export function persistSession(token: string, userJson: string, toLocal: boolean) {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    if (toLocal) {
      localStorage.setItem(TOKEN_KEY, token);
      localStorage.setItem(USER_KEY, userJson);
    } else {
      sessionStorage.setItem(TOKEN_KEY, token);
      sessionStorage.setItem(USER_KEY, userJson);
    }
  } catch { /* storage unavailable */ }
}

/** Update just the stored user, in whichever storage currently holds this tab's token. */
export function updateStoredUser(userJson: string) {
  const s = tokenStorage();
  if (s) try { s.setItem(USER_KEY, userJson); } catch { /* storage unavailable */ }
}

/**
 * Clear only the storage this tab is actually using (session first), so logging out
 * of, or losing, a session-only tab never disturbs another tab's remembered login.
 */
export function clearSession() {
  const s = tokenStorage();
  try {
    if (s) { s.removeItem(TOKEN_KEY); s.removeItem(USER_KEY); }
    // Defensive: never leave a session copy behind in this tab.
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
  } catch { /* storage unavailable */ }
}

// A one-time message to show on the sign-in screen after an involuntary sign-out
// (expired token, or a token/stored-user role disagreement). Read-and-clear so it
// appears once. Stored in sessionStorage so it survives the redirect but not longer.
const AUTH_NOTICE_KEY = 'manyorder_auth_notice';

export function setAuthNotice(message: string) {
  try { sessionStorage.setItem(AUTH_NOTICE_KEY, message); } catch { /* storage unavailable */ }
}

export function takeAuthNotice(): string | null {
  try {
    const m = sessionStorage.getItem(AUTH_NOTICE_KEY);
    if (m) sessionStorage.removeItem(AUTH_NOTICE_KEY);
    return m;
  } catch {
    return null;
  }
}

/**
 * An authenticated request came back 401 → the stored session is invalid
 * (expired/revoked token, or a rotated signing secret). Clear it and bounce to
 * sign-in, rather than leaving the app rendering an authed shell it can't load.
 * Guarded against a redirect loop when already on /signin.
 */
function handleInvalidSession() {
  clearSession();
  setAuthNotice('Your session has expired. Please sign in again.');
  if (typeof window !== 'undefined' && window.location.pathname !== '/signin') {
    window.location.href = '/signin';
  }
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const { method = 'GET', body, auth = true } = options;

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const data = await response.json();
      if (data?.message) message = data.message;
    } catch {
      /* non-JSON error body */
    }
    // An authed call rejected as unauthenticated → the session is dead; sign out
    // and redirect (public calls, auth:false, never trigger this).
    if (response.status === 401 && auth) {
      handleInvalidSession();
    }
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/**
 * Public, side-effect-free store-slug availability. Returns false for taken,
 * reserved and invalid names alike (the server answers neutrally), so callers
 * must not infer a reason from a false result. No auth, so it never trips the
 * session handler.
 */
export async function checkStoreSlugAvailable(slug: string): Promise<boolean> {
  const res = await request<{ available: boolean }>(
    `/public/store-slug-available?slug=${encodeURIComponent(slug)}`,
    { auth: false },
  );
  return res.available;
}

// ---------- Types mirrored from the backend ----------

export interface LoginResponse {
  userId: number;
  fullName: string;
  email: string;
  role: 'MERCHANT' | 'STAFF' | 'PLATFORM_ADMIN';
  staffStoreId: number | null;
  /** Whether the account's email has been confirmed (drives the verify nag). */
  verified: boolean;
  token: string;
}

export type OrderStatus =
  | 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY'
  | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED';

export type OrderType = 'PICKUP' | 'DELIVERY';

/** How an order was placed: STOREFRONT = customer checkout, MANUAL = merchant-entered. */
export type OrderSource = 'STOREFRONT' | 'MANUAL';

export type PaymentStatus = 'UNPAID' | 'PAID' | 'REFUNDED';

/** A line item in a manual create/update order payload. Prices re-derived server-side. */
export interface MerchantOrderItemInput {
  productId: number;
  quantity: number;
  modifierOptionIds?: number[];
  notes?: string;
}

/** One chosen modifier on an ordered/checked-out line (snapshots). */
export interface ModifierLineView {
  groupName: string;
  optionName: string;
  priceDelta: number;
  /** Merchant OrderItemResponse only: source option id for edit round-trip
   *  (null if since-deleted; absent on the customer-facing checkout summary). */
  sourceOptionId?: number | null;
}

export interface OrderItemResponse {
  productId: number;
  productName: string;
  quantity: number;
  /** Base per-unit price (excludes modifiers). */
  price: number;
  /** Effective per-unit price = base + chosen modifier deltas. */
  unitPrice: number;
  /** Effective unit price * quantity. */
  lineSubtotal: number;
  modifiers: ModifierLineView[];
  notes: string | null;
}

export interface OrderResponse {
  id: number;
  customerId: number | null;
  customerName: string | null;
  merchantId: number;
  merchantName: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentMethod: string | null;
  paymentReference: string | null;
  orderType: OrderType;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  deliveryAddress: string | null;
  notes: string | null;
  createdAt: string;
  subtotal: number;
  deliveryFee: number;
  deliveryFeePending: boolean;
  discountAmount: number;
  discountCode: string | null;
  orderGroupId: string | null;
  totalAmount: number;
  source: OrderSource;
  /** The linked customer's current tags (empty when no customer). */
  customerTags: CustomerTag[];
  items: OrderItemResponse[];
}

/** A choosable modifier option in a product response. */
export interface ModifierOptionView {
  id: number;
  name: string;
  priceDelta: number;
  sortOrder: number;
}

/** A modifier group in a product response. `required` mirrors minSelect >= 1. */
export interface ModifierGroupView {
  id: number;
  name: string;
  minSelect: number;
  maxSelect: number | null; // null = unlimited
  required: boolean;
  sortOrder: number;
  options: ModifierOptionView[];
}

export interface ProductResponse {
  id: number;
  merchantId: number;
  name: string;
  description: string | null;
  price: number;
  /** Configured sale. On the public view these are null unless the sale is active
   *  now; on the merchant view they are always the configured values. */
  salePrice: number | null;
  saleStartsAt: string | null; // ISO datetime
  saleEndsAt: string | null;
  /** Whether the sale is active now, and the price in force (sale or base). */
  onSale: boolean;
  effectivePrice: number;
  isActive: boolean;
  categoryId: number | null;
  categoryName: string | null;
  /** The category's displayOrder, for ordering storefront category chips. */
  categoryDisplayOrder: number | null;
  stock: number;
  sku: string | null;
  photoUrl: string | null;
  preOrder: boolean;
  preOrderReadyDate: string | null; // ISO yyyy-MM-dd
  preOrderReadyTimeStart: string | null; // ISO HH:mm[:ss]
  preOrderReadyTimeEnd: string | null;
  preOrderNote: string | null;
  modifierGroups: ModifierGroupView[];
  unitsSold: number;
  createdAt: string;
}

/** A modifier option in a create/update product payload. Send back an existing
 *  option's `id` so the save reconciles (keeps its id stable); omit for a new one. */
export interface ModifierOptionInput {
  id?: number;
  name: string;
  priceDelta: number;
  sortOrder?: number;
}

/** A modifier group in a create/update product payload. Send back an existing
 *  group's `id` so the save reconciles instead of recreating; omit for a new one. */
export interface ModifierGroupInput {
  id?: number;
  name: string;
  minSelect: number;
  maxSelect?: number | null; // null/omitted = unlimited
  sortOrder?: number;
  options: ModifierOptionInput[];
}

export interface CreateProductPayload {
  name: string;
  description?: string;
  price: number;
  /** Optional temporary sale price + window; omit salePrice for no sale. */
  salePrice?: number;
  saleStartsAt?: string; // ISO datetime
  saleEndsAt?: string;
  categoryId?: number; // reference to a per-store category; omit/0 = none
  stock?: number;
  sku?: string;
  photoUrl?: string;
  preOrder?: boolean;
  preOrderReadyDate?: string;
  preOrderReadyTimeStart?: string; // 'HH:mm'
  preOrderReadyTimeEnd?: string;
  preOrderNote?: string;
  modifierGroups?: ModifierGroupInput[];
}

export interface UpdateProductPayload {
  name?: string;
  description?: string;
  price?: number;
  /** Sale: null/omitted = unchanged, 0 = clear the sale, >0 = set (with window). */
  salePrice?: number;
  saleStartsAt?: string | null; // ISO datetime
  saleEndsAt?: string | null;
  categoryId?: number; // null = unchanged, 0 = clear to none, >0 = set
  stock?: number;
  sku?: string;
  photoUrl?: string; // '' clears the photo
  preOrder?: boolean;
  preOrderReadyDate?: string;
  preOrderReadyTimeStart?: string;
  preOrderReadyTimeEnd?: string;
  preOrderNote?: string;
  /** Null/omitted = leave modifiers unchanged; an array (incl. empty) replaces them. */
  modifierGroups?: ModifierGroupInput[];
}

export interface StoreResponse {
  id: number;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  businessType: string | null;
  currency: 'SGD' | 'IDR';
  themeColor: string | null;
  logoUrl: string | null;
  storeDescription: string | null;
  operatingHours: string | null;
  paymentInstruction: string | null;
  deliveryFee: number | null;
  freeDeliveryThreshold: number | null;
  deliveryToBeConfirmedMessage: string | null;
  fulfilmentMode: FulfilmentMode;
  whatsappVerified: boolean;
  emailVerified: boolean;
  streetAddress: string | null;
  city: string | null;
  postalCode: string | null;
  notifyNewOrderEmail: boolean;
  notifyLowStockEmail: boolean;
  notifyNewOrderWhatsapp: boolean;
  notifyUrgentWhatsapp: boolean;
  itemNotesEnabled: boolean;
  showAddressInPreview: boolean;
  suspended: boolean;
  createdAt: string;
}

export interface StoreListResponse {
  stores: StoreResponse[];
  count: number;
  limit: number;
  supportEmail: string;
}

export interface CreateStorePayload {
  storeName: string;
  slug?: string;
  storeEmail?: string;
  storePhone?: string;
  businessType?: string;
  currency?: string;
  themeColor?: string;
  logoUrl?: string;
  storeDescription?: string;
  operatingHours?: string;
  streetAddress?: string;
  city?: string;
  postalCode?: string;
  paymentInstruction?: string;
}

export interface UpdateStorePayload {
  storeName?: string;
  slug?: string;
  storeEmail?: string;
  storePhone?: string;
  businessType?: string;
  currency?: string;
  themeColor?: string;
  /** Absolute logo URL from uploadsApi.logo; empty string clears the logo, undefined leaves it unchanged. */
  logoUrl?: string;
  storeDescription?: string;
  operatingHours?: string;
  paymentInstruction?: string;
  streetAddress?: string;
  city?: string;
  postalCode?: string;
  notifyNewOrderEmail?: boolean;
  notifyLowStockEmail?: boolean;
  notifyNewOrderWhatsapp?: boolean;
  notifyUrgentWhatsapp?: boolean;
  itemNotesEnabled?: boolean;
  showAddressInPreview?: boolean;
}

// ---------- Endpoints ----------

export const authApi = {
  login: (email: string, password: string, remember = false) =>
    request<LoginResponse>('/auth/login', { method: 'POST', body: { email, password, remember }, auth: false }),

  register: (payload: {
    fullName: string;
    email: string;
    password: string;
    role: 'MERCHANT' | 'STAFF';
    storeSlug?: string;
  }) => request<LoginResponse>('/auth/register', { method: 'POST', body: payload, auth: false }),

  google: (idToken: string) =>
    request<LoginResponse>('/auth/google', { method: 'POST', body: { idToken }, auth: false }),

  config: () => request<{ googleClientId: string }>('/auth/config', { auth: false }),

  /**
   * Request a password-reset link. Always resolves with the same generic
   * message regardless of whether the email exists - the server never reveals
   * account existence.
   */
  forgotPassword: (email: string) =>
    request<{ message: string }>('/auth/forgot-password', {
      method: 'POST',
      body: { email },
      auth: false,
    }),

  /**
   * Complete a reset with the emailed token. Returns 204 on success; a 400
   * means the token is invalid, expired, or already used.
   */
  resetPassword: (token: string, newPassword: string) =>
    request<void>('/auth/reset-password', {
      method: 'POST',
      body: { token, newPassword },
      auth: false,
    }),

  /**
   * Confirm an email with the token from the verification link. Returns 204 on
   * success; a 400 means the token is invalid, expired, or already used.
   */
  verifyEmail: (token: string) =>
    request<{ email: string }>('/auth/verify-email', {
      method: 'POST',
      body: { token },
      auth: false,
    }),

  /** Resend the verification email to the signed-in account. Always 204. */
  resendVerification: () =>
    request<void>('/auth/resend-verification', { method: 'POST' }),

  /** Current account snapshot for the signed-in user (refreshes the verified flag). */
  me: () => request<LoginResponse>('/auth/me'),
};

export interface AccountDetails {
  userId: number;
  fullName: string;
  email: string;
  role: 'MERCHANT' | 'STAFF' | 'PLATFORM_ADMIN';
  verified: boolean;
  phone: string | null;
  staffStoreId: number | null;
}

export const accountApi = {
  /** The signed-in user's own account details (name, email, phone, verified). */
  me: () => request<AccountDetails>('/account'),

  /** Update the signed-in user's own name (required) and optional phone. An empty
   *  phone clears it. Never changes email, role or verified. */
  updateProfile: (payload: { fullName: string; phone?: string }) =>
    request<AccountDetails>('/account', { method: 'PUT', body: payload }),

  /**
   * Change the signed-in user's password. The server re-verifies the current
   * password (403 "Incorrect password" on mismatch) and enforces the same minimum
   * length as registration. Every other device is signed out; the response carries
   * a fresh token for THIS device, which the caller must store.
   */
  changePassword: (currentPassword: string, newPassword: string) =>
    request<LoginResponse>('/account/change-password', {
      method: 'POST',
      body: { currentPassword, newPassword },
    }),

  /** Sign out of all other devices. Returns a fresh token for the current device. */
  signOutEverywhere: () =>
    request<LoginResponse>('/account/sign-out-everywhere', { method: 'POST' }),
};

export const storesApi = {
  list: () => request<StoreListResponse>('/merchant/stores'),
  get: (storeId: number) => request<StoreResponse>(`/merchant/stores/${storeId}`),
  /** Owner asks ManyOrder to email a confirmation link to the store's contact address. */
  sendEmailConfirmation: (storeId: number) =>
    request<void>(`/merchant/stores/${storeId}/email/confirmation`, { method: 'POST' }),
  /** Public: confirm the store email from the link. Returns the store name and confirmed address. */
  confirmEmail: (token: string) =>
    request<{ storeName: string; email: string }>('/public/store-email/confirm', { method: 'POST', body: { token }, auth: false }),
  create: (payload: CreateStorePayload) =>
    request<StoreResponse>('/merchant/stores', { method: 'POST', body: payload }),
  update: (storeId: number, payload: UpdateStorePayload) =>
    request<StoreResponse>(`/merchant/stores/${storeId}`, { method: 'PATCH', body: payload }),
  /**
   * Delivery config (dedicated Delivery screen), absolute semantics: deliveryFee
   * null = "to be confirmed by seller", 0 = free; freeDeliveryThreshold null = none.
   */
  updateDelivery: (storeId: number, payload: { deliveryFee: number | null; freeDeliveryThreshold: number | null; deliveryToBeConfirmedMessage?: string | null; fulfilmentMode?: FulfilmentMode }) =>
    request<StoreResponse>(`/merchant/stores/${storeId}/delivery`, { method: 'PATCH', body: payload }),
  /**
   * Soft-delete: archives the store (owner-only). The owner re-enters their
   * password, which is verified server-side in the same request. Data is
   * preserved; a wrong password (403) archives nothing.
   */
  archive: (storeId: number, password: string) =>
    request<void>(`/merchant/stores/${storeId}/archive`, { method: 'POST', body: { password } }),
};

export const uploadsApi = {
  /**
   * Upload a store logo and get back its hosted URL. Multipart, so it bypasses
   * the JSON `request()` helper: the browser sets the multipart boundary itself,
   * so we must NOT set Content-Type by hand. The server validates type/size/bytes
   * and returns 400 (bad image), 401/403 (auth), or 503 (uploads unavailable).
   */
  logo: async (file: File): Promise<{ url: string }> => {
    // Shrink before upload: a logo never needs a multi-MB original.
    const upload = await prepareImageForUpload(file, LOGO_MAX_DIM, LOGO_QUALITY);
    const formData = new FormData();
    formData.append('file', upload);

    const headers: Record<string, string> = {};
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${API_BASE}/merchant/uploads/logo`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      let message = `Request failed (${response.status})`;
      try {
        const data = await response.json();
        if (data?.message) message = data.message;
      } catch {
        /* non-JSON error body */
      }
      throw new ApiError(response.status, message);
    }

    return (await response.json()) as { url: string };
  },
};

export const ordersApi = {
  list: (storeId: number, status?: OrderStatus) =>
    request<OrderResponse[]>(`/merchant/stores/${storeId}/orders${status ? `?status=${status}` : ''}`),

  get: (storeId: number, orderId: number) =>
    request<OrderResponse>(`/merchant/stores/${storeId}/orders/${orderId}`),

  create: (storeId: number, payload: {
    customerName: string;
    email?: string;
    phoneNumber?: string;
    orderType?: OrderType;
    deliveryAddress?: string;
    items?: MerchantOrderItemInput[];
    paymentStatus?: PaymentStatus;
    paymentMethod?: string;
    paymentReference?: string;
    notes?: string;
  }) => request<OrderResponse>(`/merchant/stores/${storeId}/orders`, { method: 'POST', body: payload }),

  update: (storeId: number, orderId: number, payload: {
    customerName: string;
    email?: string;
    phoneNumber?: string;
    orderType?: OrderType;
    deliveryAddress?: string;
    notes?: string;
    /** Set/confirm the delivery fee (clears the "to be confirmed" pending flag server-side). */
    deliveryFee?: number;
    items?: MerchantOrderItemInput[];
  }) => request<OrderResponse>(`/merchant/stores/${storeId}/orders/${orderId}`, { method: 'PATCH', body: payload }),

  updateStatus: (storeId: number, orderId: number, status: OrderStatus) =>
    request<OrderResponse>(`/merchant/stores/${storeId}/orders/${orderId}/status`, {
      method: 'PATCH',
      body: { status },
    }),

  updatePaymentStatus: (storeId: number, orderId: number, paymentStatus: PaymentStatus) =>
    request<OrderResponse>(`/merchant/stores/${storeId}/orders/${orderId}/payment-status`, {
      method: 'PATCH',
      body: { paymentStatus },
    }),

  /** Unseen new-order count per accessible store — powers the sidebar badge. */
  unseenCounts: () => request<StoreUnseenCount[]>('/merchant/orders/unseen-counts'),

  /** Mark a store's orders as seen (clears its badge). */
  markSeen: (storeId: number) =>
    request<StoreUnseenCount>(`/merchant/stores/${storeId}/orders/mark-seen`, { method: 'PATCH' }),
};

/** One store's unseen new-order count (sidebar badge). */
export interface StoreUnseenCount {
  storeId: number;
  count: number;
}

export const productsApi = {
  list: (storeId: number, activeOnly = false) =>
    request<ProductResponse[]>(`/merchant/stores/${storeId}/products${activeOnly ? '?activeOnly=true' : ''}`),

  get: (storeId: number, productId: number) =>
    request<ProductResponse>(`/merchant/stores/${storeId}/products/${productId}`),

  create: (storeId: number, payload: CreateProductPayload) =>
    request<ProductResponse>(`/merchant/stores/${storeId}/products`, { method: 'POST', body: payload }),

  update: (storeId: number, productId: number, payload: UpdateProductPayload) =>
    request<ProductResponse>(`/merchant/stores/${storeId}/products/${productId}`, { method: 'PATCH', body: payload }),

  deactivate: (storeId: number, productId: number) =>
    request<ProductResponse>(`/merchant/stores/${storeId}/products/${productId}/deactivate`, { method: 'PATCH' }),

  /** Reactivate a draft product (shown on the storefront again). */
  activate: (storeId: number, productId: number) =>
    request<ProductResponse>(`/merchant/stores/${storeId}/products/${productId}/activate`, { method: 'PATCH' }),

  /** Permanently delete a product. Order history is preserved server-side via a
   *  name/price snapshot on each order line. Returns 204. */
  delete: (storeId: number, productId: number) =>
    request<void>(`/merchant/stores/${storeId}/products/${productId}`, { method: 'DELETE' }),

  /** Persist a new product order (full list of ids, top to bottom). */
  reorder: (storeId: number, productIds: number[]) =>
    request<ProductResponse[]>(`/merchant/stores/${storeId}/products/reorder`, {
      method: 'PATCH',
      body: { productIds },
    }),

  /**
   * Upload a photo for an existing product and get back its hosted URL. Multipart
   * (browser sets the boundary - no manual Content-Type). Server validates and
   * stores it under the product's folder; the caller then PATCHes photoUrl.
   */
  uploadPhoto: async (storeId: number, productId: number, file: File): Promise<{ url: string }> => {
    const upload = await prepareImageForUpload(file, PRODUCT_MAX_DIM, PRODUCT_QUALITY);
    const formData = new FormData();
    formData.append('file', upload);
    const headers: Record<string, string> = {};
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${API_BASE}/merchant/stores/${storeId}/products/${productId}/photo`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!response.ok) {
      let message = `Request failed (${response.status})`;
      try {
        const data = await response.json();
        if (data?.message) message = data.message;
      } catch {
        /* non-JSON error body */
      }
      throw new ApiError(response.status, message);
    }
    return (await response.json()) as { url: string };
  },
};

export interface CustomerResponse {
  id: number;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  createdAt: string;
  ordersCount: number;
  totalSpent: number;
  firstOrderAt: string | null;
  lastOrderAt: string | null;
  /** Free-form informational labels (e.g. "VIP"). No behaviour keys off them. */
  tags: CustomerTag[];
}

/** A customer label with a palette color key. Colors are keyed (gray/blue/…);
 *  see TAG_COLORS in components/TagChip for the actual styling. */
export interface CustomerTag {
  name: string;
  color: string;
}

export const customersApi = {
  list: (storeId: number) =>
    request<CustomerResponse[]>(`/merchant/stores/${storeId}/customers`),

  /** Add a customer manually. 409 if the phone/email already exists. Optional tags. */
  create: (storeId: number, payload: { fullName: string; phoneNumber: string; email?: string; tags?: CustomerTag[] }) =>
    request<CustomerResponse>(`/merchant/stores/${storeId}/customers`, { method: 'POST', body: payload }),

  /** Edit a customer (full-record replace). 409 if the phone/email now matches another customer. */
  update: (storeId: number, customerId: number, payload: { fullName: string; phoneNumber: string; email?: string; tags?: CustomerTag[] }) =>
    request<CustomerResponse>(`/merchant/stores/${storeId}/customers/${customerId}`, { method: 'PUT', body: payload }),

  /** Permanently delete a customer (data erasure). Past orders survive detached. */
  delete: (storeId: number, customerId: number) =>
    request<void>(`/merchant/stores/${storeId}/customers/${customerId}`, { method: 'DELETE' }),
};

export type DiscountType = 'PERCENTAGE' | 'FIXED' | 'FREE_DELIVERY';

export interface DiscountResponse {
  id: number;
  code: string;
  name: string | null;
  type: DiscountType;
  value: number;
  usageLimit: number | null;
  /** Minimum cart subtotal required to use the code; null = no minimum. */
  minSpend: number | null;
  usedCount: number;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
  /** When true, valid only for a customer with no prior order. */
  firstOrderOnly: boolean;
  /** When true, may combine with an active product sale price. */
  canStackWithSale: boolean;
  /** When true, shown on the storefront for one-tap apply; false = code-only. */
  isPublic: boolean;
  /** When true (PERCENTAGE/FIXED), the value is off the delivery fee, not products. */
  appliesToDelivery: boolean;
  /** Products the discount is limited to; empty = store-wide. */
  productIds: number[];
  /** Merchant-controlled sort position (drag-to-reorder). */
  displayOrder: number;
  createdAt: string;
}

export interface DiscountPayload {
  code: string;
  name?: string;
  type: DiscountType;
  value: number;
  usageLimit?: number | null;
  /** Minimum cart subtotal to use the code. On update: null/omitted leaves it
   *  unchanged, 0 clears it, a positive value sets it. */
  minSpend?: number | null;
  startsAt?: string | null;
  endsAt?: string | null;
  active?: boolean;
  /** When true, valid only for a customer with no prior order. */
  firstOrderOnly?: boolean;
  /** When true, may combine with an active product sale price. */
  canStackWithSale?: boolean;
  /** When true, shown on the storefront for one-tap apply. Default false. */
  isPublic?: boolean;
  /** When true (PERCENTAGE/FIXED), the value is off the delivery fee. Default false. */
  appliesToDelivery?: boolean;
  /** Empty/omitted = store-wide; non-empty = limited to these products. On
   *  update: null leaves the scope unchanged, an empty array clears to store-wide. */
  productIds?: number[] | null;
}

export const discountsApi = {
  list: (storeId: number) =>
    request<DiscountResponse[]>(`/merchant/stores/${storeId}/discounts`),

  /** Create a discount. 409 if the code exists; 400 for percent > 100 or start after end. */
  create: (storeId: number, payload: DiscountPayload) =>
    request<DiscountResponse>(`/merchant/stores/${storeId}/discounts`, { method: 'POST', body: payload }),

  /** PATCH: only the provided fields change. */
  update: (storeId: number, discountId: number, payload: Partial<DiscountPayload>) =>
    request<DiscountResponse>(`/merchant/stores/${storeId}/discounts/${discountId}`, { method: 'PATCH', body: payload }),

  delete: (storeId: number, discountId: number) =>
    request<void>(`/merchant/stores/${storeId}/discounts/${discountId}`, { method: 'DELETE' }),

  /** Persist a merchant-chosen order (full list of ids, top-to-bottom). */
  reorder: (storeId: number, discountIds: number[]) =>
    request<DiscountResponse[]>(`/merchant/stores/${storeId}/discounts/reorder`, { method: 'PATCH', body: { discountIds } }),
};

export interface CategoryResponse {
  id: number;
  name: string;
  color: string | null;
  displayOrder: number;
  productCount: number;
  createdAt: string;
}

export interface CreateCategoryPayload {
  name: string;
  color?: string;
  displayOrder?: number;
}

export interface UpdateCategoryPayload {
  name?: string;
  color?: string;
  displayOrder?: number;
}

export const categoriesApi = {
  list: (storeId: number) =>
    request<CategoryResponse[]>(`/merchant/stores/${storeId}/categories`),

  create: (storeId: number, payload: CreateCategoryPayload) =>
    request<CategoryResponse>(`/merchant/stores/${storeId}/categories`, { method: 'POST', body: payload }),

  update: (storeId: number, categoryId: number, payload: UpdateCategoryPayload) =>
    request<CategoryResponse>(`/merchant/stores/${storeId}/categories/${categoryId}`, { method: 'PATCH', body: payload }),

  remove: (storeId: number, categoryId: number) =>
    request<void>(`/merchant/stores/${storeId}/categories/${categoryId}`, { method: 'DELETE' }),

  /** Persist a new category order (full list of ids, top to bottom). */
  reorder: (storeId: number, categoryIds: number[]) =>
    request<CategoryResponse[]>(`/merchant/stores/${storeId}/categories/reorder`, {
      method: 'PATCH',
      body: { categoryIds },
    }),
};

// ---------- Public storefront (no auth) ----------

export interface PublicStoreResponse {
  id: number;
  name: string;
  slug: string;
  storeDescription: string | null;
  /** Composed public address (street, city, postal), or null when unset. */
  address: string | null;
  /** Free-text opening hours, e.g. "Mon–Sat, 9am–6pm", or null. */
  operatingHours: string | null;
  currency: string;
  themeColor: string | null;
  logoUrl: string | null;
  phoneNumber: string | null;
  paymentInstruction: string | null;
  deliveryFee: number | null;
  /** False when no fee is set → checkout shows an estimated total + "to be confirmed". */
  deliveryFeeConfigured: boolean;
  freeDeliveryThreshold: number | null;
  /** Merchant's custom wording for the to-be-confirmed delivery case, or null → use default. */
  deliveryToBeConfirmedMessage: string | null;
  /** Which fulfilment choices checkout offers. */
  fulfilmentMode: FulfilmentMode;
  /** When false, the storefront hides the per-item note field on the product page. */
  itemNotesEnabled: boolean;
  totalItemsSold: number;
}

export type FulfilmentMethod = 'PICKUP' | 'DELIVERY';
/** Which fulfilment options a store offers at checkout. */
export type FulfilmentMode = 'BOTH' | 'PICKUP_ONLY' | 'DELIVERY_ONLY';

export interface GuestCheckoutItem {
  productId: number;
  quantity: number;
  /** Ids of chosen modifier options; prices are re-derived server-side. */
  modifierOptionIds?: number[];
  /** Per-line note, e.g. "less sugar". */
  notes?: string;
}

export interface GuestCheckoutPayload {
  merchantId: number;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  fulfilmentMethod: FulfilmentMethod;
  deliveryAddress?: string;
  notes?: string;
  paymentMethod?: string;
  discountCode?: string;
  items: GuestCheckoutItem[];
}

export interface GuestCheckoutItemSummary {
  productName: string;
  quantity: number;
  /** Effective per-unit price = base + chosen modifier deltas. */
  unitPrice: number;
  subtotal: number;
  modifiers: ModifierLineView[];
  notes: string | null;
}

/** One order's own breakdown. A checkout that mixes ready + pre-order items
 *  yields two (kind READY + PREORDER); otherwise one (STANDARD). */
export interface GuestCheckoutOrderSummary {
  orderId: number;
  kind: 'READY' | 'PREORDER' | 'STANDARD';
  orderStatus: string;
  paymentStatus: string;
  subtotal: number;
  deliveryFee: number;
  discountAmount: number;
  /** Delivery fee discounted by a delivery voucher; 0 otherwise. */
  deliveryDiscount: number;
  /** True when the delivery discount was a FREE_DELIVERY voucher (label "Free
   *  delivery" vs "Delivery discount"), by configured type not net outcome. */
  freeDelivery: boolean;
  totalAmount: number;
  items: GuestCheckoutItemSummary[];
}

export interface GuestCheckoutResult {
  /** True when the delivery fee is unresolved → the shown total is an estimate. */
  deliveryFeePending: boolean;
  /** Shared id when the checkout was split into two orders; null for a single order. */
  orderGroupId: string | null;
  /** Primary order id - the single order, or the "ready now" order of a split. */
  orderId: number;
  storeName: string;
  storePhone: string | null;
  paymentInstruction: string | null;
  paymentMethod: string | null;
  customerName: string;
  fulfilmentMethod: string;
  deliveryAddress: string | null;
  notes: string | null;
  orderStatus: string;
  paymentStatus: string;
  // Combined across all orders (equals the single order when not split).
  subtotal: number;
  deliveryFee: number;
  discountAmount: number;
  /** Delivery fee discounted by a delivery voucher; 0 otherwise. */
  deliveryDiscount: number;
  /** True when the delivery discount was a FREE_DELIVERY voucher. */
  freeDelivery: boolean;
  discountCode: string | null;
  totalAmount: number;
  createdAt: string;
  items: GuestCheckoutItemSummary[];
  /** Per-order breakdown: one entry normally, two when split. */
  orders: GuestCheckoutOrderSummary[];
  /** Private tracking token for this checkout; null for older/manual orders. */
  trackingToken: string | null;
}

/** Privacy-safe public tracking view (no customer phone, email, name or address). */
export interface TrackingResult {
  storeName: string;
  currency: string;
  /** Store's public contact number for a WhatsApp handoff; null if none set. */
  storePhone: string | null;
  orderType: string;
  notes: string | null;
  orderNumbers: number[];
  subtotal: number;
  deliveryFee: number;
  /** True when a delivery fee is still unresolved, so the total is an estimate. */
  deliveryFeePending: boolean;
  discount: number;
  total: number;
  orders: {
    orderNumber: number;
    kind: string;
    status: string;
    items: {
      name: string;
      quantity: number;
      unitPrice: number;
      lineSubtotal: number;
      modifiers: { groupName: string; optionName: string; priceDelta: number }[];
      notes: string | null;
    }[];
  }[];
}

export interface DiscountValidationResult {
  code: string;
  discountAmount: number;
  /** True when the code waives delivery instead of discounting products. */
  freeDelivery: boolean;
  /** The delivery fee that would be waived (0 when not quantifiable). */
  deliveryDiscount: number;
}

/** A public offer as shown on the storefront (only what's needed to label + apply). */
export interface PublicOffer {
  code: string;
  name: string | null;
  type: DiscountType;
  value: number;
  minSpend: number | null;
  firstOrderOnly: boolean;
  /** When true, the value is off the delivery fee (a partial delivery discount). */
  appliesToDelivery: boolean;
  storeWide: boolean;
  productIds: number[];
  /** Human "applies to" label: "All products", a category, a product name, "N products". */
  scopeLabel: string;
  /** When the offer stops being valid; null = no end date. */
  endsAt: string | null;
}

export const storefrontApi = {
  getStore: (slug: string) =>
    request<PublicStoreResponse>(`/public/stores/${encodeURIComponent(slug)}`, { auth: false }),

  getProducts: (merchantId: number) =>
    request<ProductResponse[]>(`/public/storefront/${merchantId}/products`, { auth: false }),

  /** Public, one-tap-applicable offers for a store (private codes never appear). */
  getOffers: (merchantId: number) =>
    request<PublicOffer[]>(`/public/storefront/${merchantId}/offers`, { auth: false }),

  checkout: (payload: GuestCheckoutPayload) =>
    request<GuestCheckoutResult>(`/public/checkout`, { method: 'POST', body: payload, auth: false }),

  /** Preview a code against the current cart. Items are sent (not a subtotal) so
   *  the server prices them and measures a product-specific code against exactly
   *  the lines it applies to. */
  validateDiscount: (payload: {
    merchantId: number;
    code: string;
    fulfilmentMethod: FulfilmentMethod;
    /** Optional contact so a first-order-only code previews against real history. */
    customerPhone?: string;
    customerEmail?: string;
    items: { productId: number; quantity: number; modifierOptionIds?: number[] }[];
  }) =>
    request<DiscountValidationResult>(`/public/discounts/validate`, { method: 'POST', body: payload, auth: false }),

  /** Re-open a saved order (and its split siblings) by number + phone. */
  lookupOrder: (slug: string, payload: { orderId: number; phone: string }) =>
    request<GuestCheckoutResult>(`/public/stores/${encodeURIComponent(slug)}/orders/lookup`, { method: 'POST', body: payload, auth: false }),

  /** Read an order's public status by its private tracking token (token travels in the body). */
  trackOrder: (token: string) =>
    request<TrackingResult>(`/public/orders/track`, { method: 'POST', body: { token }, auth: false }),
};

// --- Platform Admin ---------------------------------------------------------

export interface AdminMetrics {
  totalMerchants: number;
  activeMerchants: number;
  suspendedMerchants: number;
  archivedMerchants: number;
  totalOrders: number;
  totalCustomers: number;
  newMerchantsLast30Days: number;
}

export interface AdminMerchantSummary {
  id: number;
  name: string;
  slug: string;
  ownerName: string;
  ownerEmail: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  currency: string;
  createdAt: string;
  productCount: number;
  orderCount: number;
  customerCount: number;
}

export interface AdminMerchantPage {
  content: AdminMerchantSummary[];
  totalElements: number;
  totalPages: number;
  page: number;
}

export interface AdminMerchantSearchParams {
  q?: string;
  status?: string;
  currency?: string;
  businessType?: string;
  sort?: string;
  page?: number;
  size?: number;
}

export interface AdminAuditLogEntry {
  id: number;
  actorEmail: string;
  /** Admin display name snapshot, shown in the UI instead of the email. */
  actorName?: string | null;
  action: string;
  targetType: string | null;
  targetId: number | null;
  merchantId: number | null;
  detail: string | null;
  createdAt: string;
  emailSent?: boolean | null;
  storeName?: string | null;
  targetLabel?: string | null;
}

export interface AdminStoreDetail {
  id: number;
  name: string;
  slug: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED';
  currency: string;
  owner: { name: string; email: string; phone: string | null; verified: boolean; createdAt: string };
  profile: {
    email: string | null;
    phoneNumber: string | null;
    businessType: string | null;
    streetAddress: string | null;
    city: string | null;
    postalCode: string | null;
    storeDescription: string | null;
    operatingHours: string | null;
    paymentInstruction: string | null;
    fulfilmentMode: string | null;
    deliveryFee: number | null;
    freeDeliveryThreshold: number | null;
    themeColor: string | null;
    logoUrl: string | null;
    whatsappVerified: boolean;
    emailVerified: boolean;
    notifyNewOrderEmail: boolean;
    notifyLowStockEmail: boolean;
    notifyNewOrderWhatsapp: boolean;
    notifyUrgentWhatsapp: boolean;
    itemNotesEnabled: boolean;
    protectedFromDeletion: boolean;
    createdAt: string;
    suspendedAt: string | null;
    archivedAt: string | null;
    lastOrdersViewedAt: string | null;
  };
  activity: {
    productCount: number;
    orderCount: number;
    customerCount: number;
    revenue: number;
    revenueCurrency: string;
    lastOrderAt: string | null;
    lowStockCount: number;
  };
  recentActions: AdminAuditLogEntry[];
}

export interface AdminOverviewCurrencyValue { currency: string; total: number; orders: number; }
export interface AdminOverviewDayCount { date: string; count: number; }
export interface AdminOverviewTopStore { id: number; name: string; slug: string; currency: string; orders: number; value: number; }
export interface AdminOverviewStoreRef { id: number; name: string; slug: string; }
export interface AdminOverviewAttentionGroup { count: number; items: AdminOverviewStoreRef[]; }
export interface AdminOverviewNeedsAttention {
  unverifiedOwners: AdminOverviewAttentionGroup;
  noProducts: AdminOverviewAttentionGroup;
  noOrders30Days: AdminOverviewAttentionGroup;
  suspended: AdminOverviewAttentionGroup;
}
export interface AdminOverviewNewStore { id: number; name: string; slug: string; ownerName: string; createdAt: string; }
export interface AdminOverview {
  valueLast30Days: AdminOverviewCurrencyValue[];
  valueAllTime: AdminOverviewCurrencyValue[];
  ordersPerDay: AdminOverviewDayCount[];
  topStores: AdminOverviewTopStore[];
  needsAttention: AdminOverviewNeedsAttention;
  newestStores: AdminOverviewNewStore[];
  recentActions: AdminAuditLogEntry[];
}

export const adminApi = {
  metrics: () => request<AdminMetrics>('/admin/metrics'),
  overview: () => request<AdminOverview>('/admin/metrics/overview'),
  listMerchants: () => request<AdminMerchantSummary[]>('/admin/merchants'),
  businessTypes: () => request<string[]>('/admin/merchants/business-types'),
  searchMerchants: (params: AdminMerchantSearchParams = {}) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.status) qs.set('status', params.status);
    if (params.currency) qs.set('currency', params.currency);
    if (params.businessType) qs.set('businessType', params.businessType);
    if (params.sort) qs.set('sort', params.sort);
    if (params.page != null) qs.set('page', String(params.page));
    if (params.size != null) qs.set('size', String(params.size));
    const q = qs.toString();
    return request<AdminMerchantPage>(`/admin/merchants/search${q ? `?${q}` : ''}`);
  },
  getMerchant: (merchantId: number) => request<AdminMerchantSummary>(`/admin/merchants/${merchantId}`),
  storeDetail: (merchantId: number) => request<AdminStoreDetail>(`/admin/merchants/${merchantId}/detail`),
  auditLog: (storeId?: number) =>
    request<AdminAuditLogEntry[]>(`/admin/audit-log${storeId != null ? `?storeId=${storeId}` : ''}`),
  suspend: (merchantId: number, reason: string) =>
    request<void>(`/admin/merchants/${merchantId}/suspend`, { method: 'POST', body: { reason } }),
  unsuspend: (merchantId: number, reason: string, emailOwner: boolean) =>
    request<void>(`/admin/merchants/${merchantId}/unsuspend`, { method: 'POST', body: { reason, emailOwner } }),
  protect: (merchantId: number) =>
    request<void>(`/admin/merchants/${merchantId}/protect`, { method: 'POST' }),
  unprotect: (merchantId: number) =>
    request<void>(`/admin/merchants/${merchantId}/unprotect`, { method: 'POST' }),
  restore: (merchantId: number, reason: string, emailOwner: boolean) =>
    request<void>(`/admin/merchants/${merchantId}/restore`, { method: 'POST', body: { reason, emailOwner } }),

  /** Customer management scoped to one merchant — same shape as customersApi (minus storeId),
   *  so an admin can drive the shared Customers screen against /admin endpoints. */
  customersFor: (merchantId: number) => ({
    list: () => request<CustomerResponse[]>(`/admin/merchants/${merchantId}/customers`),
    create: (payload: { fullName: string; phoneNumber: string; email?: string; tags?: CustomerTag[] }) =>
      request<CustomerResponse>(`/admin/merchants/${merchantId}/customers`, { method: 'POST', body: payload }),
    update: (customerId: number, payload: { fullName: string; phoneNumber: string; email?: string; tags?: CustomerTag[] }) =>
      request<CustomerResponse>(`/admin/merchants/${merchantId}/customers/${customerId}`, { method: 'PUT', body: payload }),
    delete: (customerId: number) =>
      request<void>(`/admin/merchants/${merchantId}/customers/${customerId}`, { method: 'DELETE' }),
  }),

  /** Product management scoped to one merchant (admin scope: list, activate/deactivate,
   *  delete, reorder — full field-editing/photo stays in the merchant flow). */
  productsFor: (merchantId: number) => ({
    list: () => request<ProductResponse[]>(`/admin/merchants/${merchantId}/products`),
    activate: (productId: number, reason?: string, emailOwner?: boolean) =>
      request<ProductResponse>(`/admin/merchants/${merchantId}/products/${productId}/activate`, { method: 'PATCH', body: { reason, emailOwner } }),
    deactivate: (productId: number, reason?: string) =>
      request<ProductResponse>(`/admin/merchants/${merchantId}/products/${productId}/deactivate`, { method: 'PATCH', body: { reason } }),
    delete: (productId: number) =>
      request<void>(`/admin/merchants/${merchantId}/products/${productId}`, { method: 'DELETE' }),
    reorder: (productIds: number[]) =>
      request<ProductResponse[]>(`/admin/merchants/${merchantId}/products/reorder`, { method: 'PATCH', body: { productIds } }),
  }),

  /** Discount/Marketing management scoped to one merchant — same shape as discountsApi minus storeId. */
  discountsFor: (merchantId: number) => ({
    list: () => request<DiscountResponse[]>(`/admin/merchants/${merchantId}/discounts`),
    create: (payload: DiscountPayload) =>
      request<DiscountResponse>(`/admin/merchants/${merchantId}/discounts`, { method: 'POST', body: payload }),
    update: (discountId: number, payload: Partial<DiscountPayload>) =>
      request<DiscountResponse>(`/admin/merchants/${merchantId}/discounts/${discountId}`, { method: 'PATCH', body: payload }),
    delete: (discountId: number) =>
      request<void>(`/admin/merchants/${merchantId}/discounts/${discountId}`, { method: 'DELETE' }),
    reorder: (discountIds: number[]) =>
      request<DiscountResponse[]>(`/admin/merchants/${merchantId}/discounts/reorder`, { method: 'PATCH', body: { discountIds } }),
    activate: (discountId: number, reason?: string, emailOwner?: boolean) =>
      request<DiscountResponse>(`/admin/merchants/${merchantId}/discounts/${discountId}/activate`, { method: 'PATCH', body: { reason, emailOwner } }),
    deactivate: (discountId: number, reason?: string) =>
      request<DiscountResponse>(`/admin/merchants/${merchantId}/discounts/${discountId}/deactivate`, { method: 'PATCH', body: { reason } }),
  }),

  /** Order management scoped to one merchant (admin scope: list + status/payment only,
   *  matching the backend — no admin order create/edit/delete). */
  ordersFor: (merchantId: number) => ({
    list: (status?: OrderStatus) =>
      request<OrderResponse[]>(`/admin/merchants/${merchantId}/orders${status ? `?status=${status}` : ''}`),
    updateStatus: (orderId: number, status: OrderStatus) =>
      request<OrderResponse>(`/admin/merchants/${merchantId}/orders/${orderId}/status`, { method: 'PATCH', body: { status } }),
    updatePaymentStatus: (orderId: number, paymentStatus: PaymentStatus) =>
      request<OrderResponse>(`/admin/merchants/${merchantId}/orders/${orderId}/payment-status`, { method: 'PATCH', body: { paymentStatus } }),
  }),
};

// REST client for the ManyOrder Spring Boot API (replaces Supabase).

import { downscaleImage } from './image';

export const API_BASE: string =
  (import.meta as any).env?.VITE_API_BASE || 'http://localhost:8080';

const TOKEN_KEY = 'manyorder_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string, remember: boolean) {
  clearToken();
  (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
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
    throw new ApiError(response.status, message);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

// ---------- Types mirrored from the backend ----------

export interface LoginResponse {
  userId: number;
  fullName: string;
  email: string;
  role: 'MERCHANT' | 'STAFF' | 'PLATFORM_ADMIN';
  staffStoreId: number | null;
  token: string;
}

export type OrderStatus =
  | 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'READY'
  | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED';

export type OrderType = 'PICKUP' | 'DELIVERY';

export type PaymentStatus = 'UNPAID' | 'PAID' | 'REFUNDED';

export interface OrderItemResponse {
  productId: number;
  productName: string;
  quantity: number;
  price: number;
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
  totalAmount: number;
  items: OrderItemResponse[];
}

export interface ProductResponse {
  id: number;
  merchantId: number;
  name: string;
  description: string | null;
  price: number;
  isActive: boolean;
  categoryId: number | null;
  categoryName: string | null;
  stock: number;
  sku: string | null;
  photoUrl: string | null;
  preOrder: boolean;
  preOrderReadyDate: string | null; // ISO yyyy-MM-dd
  preOrderReadyTimeStart: string | null; // ISO HH:mm[:ss]
  preOrderReadyTimeEnd: string | null;
  preOrderNote: string | null;
  unitsSold: number;
  createdAt: string;
}

export interface CreateProductPayload {
  name: string;
  description?: string;
  price: number;
  categoryId?: number; // reference to a per-store category; omit/0 = none
  stock?: number;
  sku?: string;
  photoUrl?: string;
  preOrder?: boolean;
  preOrderReadyDate?: string;
  preOrderReadyTimeStart?: string; // 'HH:mm'
  preOrderReadyTimeEnd?: string;
  preOrderNote?: string;
}

export interface UpdateProductPayload {
  name?: string;
  description?: string;
  price?: number;
  categoryId?: number; // null = unchanged, 0 = clear to none, >0 = set
  stock?: number;
  sku?: string;
  photoUrl?: string; // '' clears the photo
  preOrder?: boolean;
  preOrderReadyDate?: string;
  preOrderReadyTimeStart?: string;
  preOrderReadyTimeEnd?: string;
  preOrderNote?: string;
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
  paymentInstruction: string | null;
  deliveryFee: number | null;
  whatsappVerified: boolean;
  streetAddress: string | null;
  city: string | null;
  postalCode: string | null;
  notifyNewOrderEmail: boolean;
  notifyLowStockEmail: boolean;
  notifyNewOrderWhatsapp: boolean;
  notifyUrgentWhatsapp: boolean;
  createdAt: string;
}

export interface StoreListResponse {
  stores: StoreResponse[];
  count: number;
  limit: number;
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
  paymentInstruction?: string;
  streetAddress?: string;
  city?: string;
  postalCode?: string;
  notifyNewOrderEmail?: boolean;
  notifyLowStockEmail?: boolean;
  notifyNewOrderWhatsapp?: boolean;
  notifyUrgentWhatsapp?: boolean;
}

// ---------- Endpoints ----------

export const authApi = {
  login: (email: string, password: string) =>
    request<LoginResponse>('/auth/login', { method: 'POST', body: { email, password }, auth: false }),

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
   * message regardless of whether the email exists — the server never reveals
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
};

export const accountApi = {
  /**
   * Change the signed-in user's password. The server re-verifies the current
   * password (403 "Incorrect password" on mismatch) and enforces the same
   * minimum length as registration. Returns 204; the current session stays
   * valid (stateless JWT — no server-side revocation).
   */
  changePassword: (currentPassword: string, newPassword: string) =>
    request<void>('/account/change-password', {
      method: 'POST',
      body: { currentPassword, newPassword },
    }),
};

export const storesApi = {
  list: () => request<StoreListResponse>('/merchant/stores'),
  get: (storeId: number) => request<StoreResponse>(`/merchant/stores/${storeId}`),
  create: (payload: CreateStorePayload) =>
    request<StoreResponse>('/merchant/stores', { method: 'POST', body: payload }),
  update: (storeId: number, payload: UpdateStorePayload) =>
    request<StoreResponse>(`/merchant/stores/${storeId}`, { method: 'PATCH', body: payload }),
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
    const upload = await downscaleImage(file, 512);
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
    items?: { productId: number; quantity: number }[];
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
    items?: { productId: number; quantity: number }[];
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
};

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

  /**
   * Upload a photo for an existing product and get back its hosted URL. Multipart
   * (browser sets the boundary — no manual Content-Type). Server validates and
   * stores it under the product's folder; the caller then PATCHes photoUrl.
   */
  uploadPhoto: async (storeId: number, productId: number, file: File): Promise<{ url: string }> => {
    const upload = await downscaleImage(file, 1024); // product photos: larger cap than logos
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
};

// ---------- Public storefront (no auth) ----------

export interface PublicStoreResponse {
  id: number;
  name: string;
  slug: string;
  storeDescription: string | null;
  currency: string;
  themeColor: string | null;
  logoUrl: string | null;
  phoneNumber: string | null;
  paymentInstruction: string | null;
  deliveryFee: number | null;
  totalItemsSold: number;
}

export type FulfilmentMethod = 'PICKUP' | 'DELIVERY';

export interface GuestCheckoutItem {
  productId: number;
  quantity: number;
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
  unitPrice: number;
  subtotal: number;
}

export interface GuestCheckoutResult {
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
  subtotal: number;
  deliveryFee: number;
  discountAmount: number;
  discountCode: string | null;
  totalAmount: number;
  createdAt: string;
  items: GuestCheckoutItemSummary[];
}

export interface DiscountValidationResult {
  code: string;
  discountAmount: number;
}

export const storefrontApi = {
  getStore: (slug: string) =>
    request<PublicStoreResponse>(`/public/stores/${encodeURIComponent(slug)}`, { auth: false }),

  getProducts: (merchantId: number) =>
    request<ProductResponse[]>(`/public/storefront/${merchantId}/products`, { auth: false }),

  checkout: (payload: GuestCheckoutPayload) =>
    request<GuestCheckoutResult>(`/public/checkout`, { method: 'POST', body: payload, auth: false }),

  validateDiscount: (payload: { merchantId: number; code: string; subtotal: number }) =>
    request<DiscountValidationResult>(`/public/discounts/validate`, { method: 'POST', body: payload, auth: false }),
};

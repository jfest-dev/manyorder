// REST client for the ManyOrder Spring Boot API (replaces Supabase).

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
  createdAt: string;
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
  storeDescription: string | null;
  paymentInstruction: string | null;
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
};

export const storesApi = {
  list: () => request<StoreListResponse>('/merchant/stores'),
  get: (storeId: number) => request<StoreResponse>(`/merchant/stores/${storeId}`),
  create: (payload: CreateStorePayload) =>
    request<StoreResponse>('/merchant/stores', { method: 'POST', body: payload }),
  update: (storeId: number, payload: UpdateStorePayload) =>
    request<StoreResponse>(`/merchant/stores/${storeId}`, { method: 'PATCH', body: payload }),
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

  create: (storeId: number, payload: { name: string; description?: string; price: number }) =>
    request<ProductResponse>(`/merchant/stores/${storeId}/products`, { method: 'POST', body: payload }),

  update: (storeId: number, productId: number, payload: { name?: string; description?: string; price?: number }) =>
    request<ProductResponse>(`/merchant/stores/${storeId}/products/${productId}`, { method: 'PATCH', body: payload }),

  deactivate: (storeId: number, productId: number) =>
    request<ProductResponse>(`/merchant/stores/${storeId}/products/${productId}/deactivate`, { method: 'PATCH' }),
};

export const publicApi = {
  storeBySlug: (slug: string) =>
    request<{ id: number; name: string; slug: string; storeDescription: string | null; currency: string; themeColor: string | null }>(
      `/public/stores/${encodeURIComponent(slug)}`,
      { auth: false },
    ),
};

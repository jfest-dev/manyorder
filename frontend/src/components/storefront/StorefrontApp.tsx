import { useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import {
  storefrontApi, ApiError,
  type PublicStoreResponse, type ProductResponse, type GuestCheckoutResult,
} from '../../lib/api';
import { StorefrontView } from './StorefrontView';
import { ProductDetailView } from './ProductDetailView';
import { CartView } from './CartView';
import { CheckoutView } from './CheckoutView';
import { OrderConfirmationView } from './OrderConfirmationView';
import { OrderLookupView } from './OrderLookupView';
import { StorefrontErrorBoundary } from './StorefrontErrorBoundary';
import { getRecentOrder, clearRecentOrder, anyOrderStatusActive, type RecentOrder } from '../../lib/orderRecall';
import type { CartItem, CartLine } from './storefrontTypes';

/** Parse persisted cart, tolerating the old {product, quantity} snapshot shape. */
function parseCart(raw: string | null): CartItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as any[];
    return parsed
      .map((l) => ({ productId: Number(l?.productId ?? l?.product?.id), quantity: Number(l?.quantity) || 0 }))
      .filter((it) => Number.isFinite(it.productId) && it.quantity > 0);
  } catch {
    return [];
  }
}

/**
 * Public storefront container mounted at /:slug/*. Fetches the store + products,
 * owns the guest cart (persisted per store), and routes between shop / PDP /
 * cart / checkout / confirmation as full pages. No auth, no dashboard chrome.
 */
export function StorefrontApp() {
  const { slug = '' } = useParams();
  const navigate = useNavigate();

  const [store, setStore] = useState<PublicStoreResponse | null>(null);
  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderResult, setOrderResult] = useState<GuestCheckoutResult | null>(null);
  const [recentOrder, setRecentOrder] = useState<RecentOrder | null>(null);

  const cartKey = store ? `manyorder_cart_${store.id}` : null;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    storefrontApi.getStore(slug)
      .then(async (s) => {
        if (cancelled) return;
        setStore(s);
        const list = await storefrontApi.getProducts(s.id);
        if (!cancelled) setProducts(list);
      })
      .catch(() => { if (!cancelled) setNotFound(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [slug]);

  useEffect(() => {
    if (!cartKey) return;
    setCart(parseCart(localStorage.getItem(cartKey)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartKey]);

  useEffect(() => {
    if (cartKey) localStorage.setItem(cartKey, JSON.stringify(cart));
  }, [cart, cartKey]);

  // Surface the "recent order" recall banner once the store is known and
  // whenever a new order is placed. The banner shows only while the order is
  // still active — a terminal order (delivered/completed/cancelled) is cleared
  // so it stops showing. A newer order overwrites the slot at checkout, so this
  // always reflects the latest order.
  useEffect(() => {
    if (!store) return;
    const rec = getRecentOrder(store.id);
    if (!rec) { setRecentOrder(null); return; }
    let cancelled = false;
    storefrontApi.lookupOrder(store.slug, { orderId: rec.orderId, phone: rec.phone })
      .then((result) => {
        if (cancelled) return;
        const statuses = result.orders?.length
          ? result.orders.map((o) => o.orderStatus)
          : [result.orderStatus];
        if (anyOrderStatusActive(statuses)) {
          setRecentOrder(rec);
        } else {
          clearRecentOrder(store.id); // terminal → forget it
          setRecentOrder(null);
        }
      })
      .catch(() => {
        if (cancelled) return;
        clearRecentOrder(store.id); // order no longer retrievable → drop the banner
        setRecentOrder(null);
      });
    return () => { cancelled = true; };
  }, [store, orderResult]);

  // Resolve cart ids against the freshly-fetched products every render, so cart
  // and checkout always show current price / name / pre-order details. Lines
  // whose product no longer exists are dropped.
  const hydratedCart = useMemo<CartLine[]>(
    () => cart
      .map((it) => {
        const product = products.find((p) => p.id === it.productId);
        return product ? { product, quantity: it.quantity } : null;
      })
      .filter((l): l is CartLine => l !== null),
    [cart, products],
  );

  const cartCount = useMemo(() => cart.reduce((n, it) => n + it.quantity, 0), [cart]);
  const quantities = useMemo(
    () => Object.fromEntries(cart.map((it) => [it.productId, it.quantity])) as Record<number, number>,
    [cart],
  );

  const addToCart = (productId: number, quantity = 1) => {
    setCart((prev) => {
      const existing = prev.find((it) => it.productId === productId);
      if (existing) return prev.map((it) => it.productId === productId ? { ...it, quantity: it.quantity + quantity } : it);
      return [...prev, { productId, quantity }];
    });
  };

  const setQty = (productId: number, quantity: number) => {
    if (quantity <= 0) { removeFromCart(productId); return; }
    setCart((prev) => prev.map((it) => it.productId === productId ? { ...it, quantity } : it));
  };

  const removeFromCart = (productId: number) => setCart((prev) => prev.filter((it) => it.productId !== productId));

  const goShop = () => navigate(`/${slug}`);
  const goCart = () => navigate(`/${slug}/cart`);
  const goCheckout = () => navigate(`/${slug}/checkout`);
  const goTrack = () => navigate(`/${slug}/track`);

  if (loading) {
    return <Frame><Centered>Loading store…</Centered></Frame>;
  }
  if (notFound || !store) {
    return <Frame><Centered><strong>Store not found</strong><div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>This store link doesn’t exist or is no longer available.</div></Centered></Frame>;
  }

  return (
    <Frame>
      <StorefrontErrorBoundary onBackToShop={goShop}>
        <Routes>
          <Route index element={
            <StorefrontView
              store={store}
              products={products}
              onProductClick={(id) => navigate(`/${slug}/p/${id}`)}
              onAddToCart={(id) => addToCart(id, 1)}
              quantities={quantities}
              onSetQuantity={setQty}
              cartCount={cartCount}
              onViewCart={goCart}
              onTrackOrder={goTrack}
              recentOrder={recentOrder}
              onViewRecentOrder={() => navigate(`/${slug}/confirmation`)}
            />
          } />
          <Route path="p/:productId" element={
            <PdpRoute products={products} store={store}
              onAddToCart={(id, qty) => { addToCart(id, qty); goCart(); }}
              onBack={goShop} />
          } />
          <Route path="cart" element={
            <CartView
              items={hydratedCart}
              currency={store.currency}
              onQtyChange={setQty}
              onRemove={removeFromCart}
              onCheckout={goCheckout}
              onBack={goShop}
            />
          } />
          <Route path="checkout" element={
            hydratedCart.length === 0
              ? <Navigate to={`/${slug}`} replace />
              : <CheckoutView store={store} items={hydratedCart} onBack={goCart}
                  onPlaced={(result) => { setOrderResult(result); setCart([]); navigate(`/${slug}/confirmation`); }} />
          } />
          <Route path="confirmation" element={
            <ConfirmationRoute store={store} result={orderResult} onBackToShop={goShop} />
          } />
          <Route path="track" element={
            <OrderLookupView store={store} onBack={goShop} onBackToShop={goShop} initial={recentOrder} />
          } />
          <Route path="*" element={<Navigate to={`/${slug}`} replace />} />
        </Routes>
      </StorefrontErrorBoundary>
    </Frame>
  );
}

/**
 * The confirmation page. Uses the just-placed order held in memory; failing that
 * (a reload or a reopened tab dropped it), it recalls the device-local last order
 * and re-fetches it fresh via the normal lookup endpoint — so status is current
 * and no order data is cached client-side. With neither, it falls back to shop.
 */
function ConfirmationRoute({ store, result, onBackToShop }: {
  store: PublicStoreResponse;
  result: GuestCheckoutResult | null;
  onBackToShop: () => void;
}) {
  const [recalled, setRecalled] = useState<GuestCheckoutResult | null>(null);
  // Start in 'loading' (not 'idle') so the first render — before the recall
  // fetch has run — shows a loader instead of instantly redirecting to the shop.
  // Only a genuine "no recent order / lookup failed" sets 'notfound'.
  const [status, setStatus] = useState<'loading' | 'notfound'>('loading');

  useEffect(() => {
    if (result) return; // in-memory result wins — no recall needed
    const recent = getRecentOrder(store.id);
    if (!recent) { setStatus('notfound'); return; }
    let cancelled = false;
    setStatus('loading');
    storefrontApi.lookupOrder(store.slug, { orderId: recent.orderId, phone: recent.phone })
      .then((r) => { if (!cancelled) setRecalled(r); })
      .catch(() => { if (!cancelled) { clearRecentOrder(store.id); setStatus('notfound'); } });
    return () => { cancelled = true; };
  }, [result, store.id, store.slug]);

  if (result) return <OrderConfirmationView result={result} store={store} onBackToShop={onBackToShop} />;
  if (recalled) return <OrderConfirmationView result={recalled} store={store} onBackToShop={onBackToShop} heading="Your order" />;
  if (status === 'notfound') return <Navigate to={`/${store.slug}`} replace />;
  return <Centered>Loading your order…</Centered>;
}

/** Reads :productId from the route and renders the PDP (or falls back to shop). */
function PdpRoute({ products, store, onAddToCart, onBack }: {
  products: ProductResponse[];
  store: PublicStoreResponse;
  onAddToCart: (productId: number, quantity: number) => void;
  onBack: () => void;
}) {
  const { productId } = useParams();
  const product = products.find((p) => String(p.id) === productId);
  if (!product) return <Navigate to={`/${store.slug}`} replace />;
  return (
    <ProductDetailView
      product={product}
      currency={store.currency}
      onAddToCart={onAddToCart}
      onBack={onBack}
    />
  );
}

/** Centered, mobile-width frame the whole storefront lives in. */
function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#E5E7EB', display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: '480px', minHeight: '100vh', background: 'white', boxShadow: '0 0 40px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '32px', color: 'var(--text-primary)' }}>
      {children}
    </div>
  );
}

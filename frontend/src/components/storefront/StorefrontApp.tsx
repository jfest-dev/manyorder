import { useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  storefrontApi, ApiError,
  type PublicStoreResponse, type ProductResponse, type GuestCheckoutResult,
} from '../../lib/api';
import { StorefrontView } from './StorefrontView';
import { ProductDetailView } from './ProductDetailView';
import { CartDecisionSheet } from './CartDecisionSheet';
import { CartView } from './CartView';
import { CheckoutView } from './CheckoutView';
import { OrderConfirmationView } from './OrderConfirmationView';
import { OrderLookupView } from './OrderLookupView';
import { StorefrontErrorBoundary } from './StorefrontErrorBoundary';
import { getRecentOrder, clearRecentOrder, anyOrderStatusActive, type RecentOrder } from '../../lib/orderRecall';
import {
  parseCart, addLine, setLineQty, removeLine, updateLine, hydrateCart, healCart,
  cartLineCount, plainQuantities, productTotals, plainSignature, lineSignature,
  type CartItem, type CartLine,
} from '../../lib/cart';

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
  // Product whose "already in cart?" decision sheet is open (shop grid). null = closed.
  const [decisionProductId, setDecisionProductId] = useState<number | null>(null);

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

  // Once products are loaded, self-heal any cart lines orphaned by a product edit
  // (drop dead option ids + merge lines that become identical). healCart returns
  // the same reference when nothing changed, so this is a no-op on a healthy cart.
  useEffect(() => {
    if (products.length === 0) return;
    setCart((prev) => healCart(prev, products));
  }, [products]);

  // Surface the "recent order" recall banner once the store is known and
  // whenever a new order is placed. The banner shows only while the order is
  // still active - a terminal order (delivered/completed/cancelled) is cleared
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

  // Resolve cart lines against the freshly-fetched products every render, so
  // cart and checkout always show current price / name / modifiers / pre-order
  // details. Lines whose product no longer exists are dropped.
  const hydratedCart = useMemo<CartLine[]>(() => hydrateCart(cart, products), [cart, products]);

  // Count the resolved lines, not the raw cart, so an orphaned line (e.g. a
  // hard-deleted product) can't show a count with nothing in the cart.
  const cartCount = useMemo(() => cartLineCount(hydratedCart), [hydratedCart]);
  const cartSubtotal = useMemo(() => hydratedCart.reduce((s, l) => s + l.lineSubtotal, 0), [hydratedCart]);
  // Shop grid stepper reflects the PLAIN line (no modifiers/notes) per product.
  const quantities = useMemo(() => plainQuantities(cart), [cart]);
  // Total qty per product across all its lines - the count badge on modifier products.
  const totalsByProduct = useMemo(() => productTotals(cart), [cart]);

  // Add a line - same product with different modifiers/notes is a separate line.
  const addToCart = (
    productId: number, quantity = 1, modifierOptionIds: number[] = [], notes?: string,
  ) => {
    setCart((prev) => addLine(prev, { productId, quantity, modifierOptionIds, notes }));
  };

  // The shop grid stepper edits the plain line for a product by its signature.
  const setPlainQty = (productId: number, quantity: number) =>
    setCart((prev) => setLineQty(prev, plainSignature(productId), quantity));

  // Cart-page handlers operate on a specific line by its signature.
  const setLineQtyBySig = (signature: string, quantity: number) =>
    setCart((prev) => setLineQty(prev, signature, quantity));
  const removeLineBySig = (signature: string) =>
    setCart((prev) => removeLine(prev, signature));
  // Bump an existing line by one (from the shop-grid "already in cart?" sheet).
  // Stays on the shop; the cart bar reflects the new total.
  const incrementLineBySig = (signature: string) => {
    setCart((prev) => {
      const line = prev.find((it) => lineSignature(it) === signature);
      return line ? setLineQty(prev, signature, line.quantity + 1) : prev;
    });
  };
  // Replace an edited cart line's choices, then return to the cart. The edit PDP
  // is a transient step opened from the cart, so pop it off history (rather than
  // pushing a fresh cart) - Back from the cart then returns to the cart's origin,
  // not the PDP. Falls back to a plain cart nav if somehow there's no history.
  const updateLineBySig = (
    oldSignature: string, productId: number, quantity: number, modifierOptionIds: number[], notes?: string,
  ) => {
    setCart((prev) => updateLine(prev, oldSignature, { productId, quantity, modifierOptionIds, notes }));
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else goCart();
  };

  const goShop = () => navigate(`/${slug}`);
  const goCart = () => navigate(`/${slug}/cart`);
  const goCheckout = () => navigate(`/${slug}/checkout`);
  const goTrack = () => navigate(`/${slug}/track`);
  const goProduct = (id: number) => navigate(`/${slug}/p/${id}`);

  // A header "Back" returns to the actual previous screen (pops history), so an
  // edit opened from the cart goes back to the cart, not a fixed default. Falls
  // back to the shop when there's no in-app history (a direct deep link) so Back
  // never leaves the store. React Router stamps an incrementing idx on history.
  const goBack = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else goShop();
  };

  // Tapping a product on the shop grid. If it has options AND is already in the
  // cart, ask up front (bump an existing choice, or go to the PDP for a new one);
  // otherwise go straight to the PDP.
  const openProduct = (productId: number) => {
    const product = products.find((p) => p.id === productId);
    const hasModifiers = (product?.modifierGroups?.length ?? 0) > 0;
    const already = hydratedCart.some((l) => l.product.id === productId);
    if (hasModifiers && already) setDecisionProductId(productId);
    else goProduct(productId);
  };

  const decisionProduct = decisionProductId != null ? products.find((p) => p.id === decisionProductId) ?? null : null;
  const decisionLines = decisionProductId != null ? hydratedCart.filter((l) => l.product.id === decisionProductId) : [];

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
              onProductClick={openProduct}
              onAddToCart={(id) => addToCart(id, 1)}
              quantities={quantities}
              productTotals={totalsByProduct}
              onSetQuantity={setPlainQty}
              cartCount={cartCount}
              cartTotal={cartSubtotal}
              onViewCart={goCart}
              onTrackOrder={goTrack}
              recentOrder={recentOrder}
              onViewRecentOrder={() => navigate(`/${slug}/confirmation`)}
            />
          } />
          <Route path="p/:productId" element={
            <PdpRoute products={products} store={store} cart={hydratedCart}
              onAddToCart={(id, qty, optionIds, notes) => {
                addToCart(id, qty, optionIds, notes);
                // GrabFood-style: after adding, stay on the shop so the customer
                // keeps browsing (the cart bar/badge update live); the cart only
                // opens when they tap it. The add PDP is a transient step launched
                // from the shop (first add, or "add a new one" from the sheet), so
                // pop it back to the shop; fall back to the shop on a deep link.
                const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
                if (idx > 0) navigate(-1);
                else goShop();
              }}
              onUpdateLine={updateLineBySig}
              onBack={goBack} />
          } />
          <Route path="cart" element={
            <CartView
              items={hydratedCart}
              currency={store.currency}
              onQtyChange={setLineQtyBySig}
              onRemove={removeLineBySig}
              onEditLine={(line) => navigate(`/${slug}/p/${line.product.id}`, { state: { editSignature: line.signature } })}
              onCheckout={goCheckout}
              onBack={goBack}
              onBrowseShop={goShop}
            />
          } />
          <Route path="checkout" element={
            hydratedCart.length === 0
              ? <Navigate to={`/${slug}`} replace />
              : <CheckoutView store={store} items={hydratedCart} onBack={goBack}
                  onPlaced={(result) => { setOrderResult(result); setCart([]); navigate(`/${slug}/confirmation`); }} />
          } />
          <Route path="confirmation" element={
            <ConfirmationRoute store={store} result={orderResult} onBackToShop={goShop} />
          } />
          <Route path="track" element={
            <OrderLookupView store={store} onBack={goBack} onBackToShop={goShop} initial={recentOrder} />
          } />
          <Route path="*" element={<Navigate to={`/${slug}`} replace />} />
        </Routes>
      </StorefrontErrorBoundary>

      {decisionProduct && (
        <CartDecisionSheet
          productName={decisionProduct.name}
          currency={store.currency}
          lines={decisionLines}
          onAddOne={(sig) => { incrementLineBySig(sig); setDecisionProductId(null); }}
          onAddNew={() => { const id = decisionProduct.id; setDecisionProductId(null); goProduct(id); }}
          onClose={() => setDecisionProductId(null)}
        />
      )}
    </Frame>
  );
}

/**
 * The confirmation page. Uses the just-placed order held in memory; failing that
 * (a reload or a reopened tab dropped it), it recalls the device-local last order
 * and re-fetches it fresh via the normal lookup endpoint - so status is current
 * and no order data is cached client-side. With neither, it falls back to shop.
 */
function ConfirmationRoute({ store, result, onBackToShop }: {
  store: PublicStoreResponse;
  result: GuestCheckoutResult | null;
  onBackToShop: () => void;
}) {
  const [recalled, setRecalled] = useState<GuestCheckoutResult | null>(null);
  // Start in 'loading' (not 'idle') so the first render - before the recall
  // fetch has run - shows a loader instead of instantly redirecting to the shop.
  // Only a genuine "no recent order / lookup failed" sets 'notfound'.
  const [status, setStatus] = useState<'loading' | 'notfound'>('loading');

  useEffect(() => {
    if (result) return; // in-memory result wins - no recall needed
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

/**
 * Reads :productId from the route and renders the PDP (or falls back to shop).
 * Router state `{ editSignature }` reopens an existing cart line for editing;
 * otherwise the PDP is in plain add mode (the "already in cart?" decision is made
 * on the shop grid before reaching here).
 */
function PdpRoute({ products, store, cart, onAddToCart, onUpdateLine, onBack }: {
  products: ProductResponse[];
  store: PublicStoreResponse;
  cart: CartLine[];
  onAddToCart: (productId: number, quantity: number, modifierOptionIds: number[], notes?: string) => void;
  onUpdateLine: (oldSignature: string, productId: number, quantity: number, modifierOptionIds: number[], notes?: string) => void;
  onBack: () => void;
}) {
  const { productId } = useParams();
  const location = useLocation();
  const editSignature = (location.state as { editSignature?: string } | null)?.editSignature;
  const product = products.find((p) => String(p.id) === productId);
  if (!product) return <Navigate to={`/${store.slug}`} replace />;

  // With an explicit edit target, reopen that exact line. Otherwise: a no-modifier
  // product has only one possible cart line (its plain line), so opening it from the
  // grid reflects/edits that line instead of stacking a new one. Modifier products
  // stay additive on a fresh open (each open configures a possibly-new combination).
  const editingLine = editSignature
    ? cart.find((l) => l.product.id === product.id && l.signature === editSignature)
    : product.modifierGroups.length === 0
      ? cart.find((l) => l.signature === plainSignature(product.id))
      : undefined;

  return (
    <ProductDetailView
      product={product}
      currency={store.currency}
      onAddToCart={onAddToCart}
      onUpdateLine={onUpdateLine}
      onBack={onBack}
      allowItemNotes={store.itemNotesEnabled}
      mode={editingLine ? 'edit' : 'add'}
      editingSignature={editingLine?.signature}
      initialOptionIds={editingLine?.modifierOptionIds}
      initialNotes={editingLine?.notes}
      initialQuantity={editingLine?.quantity}
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

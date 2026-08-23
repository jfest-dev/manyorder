import { useMemo, useState } from 'react';
import { Package, ShoppingBag, Plus, MessageCircle, MapPin, Clock } from 'lucide-react';
import { formatMoney } from '../../lib/currency';
import { formatPreorderReady } from '../../lib/datetime';
import type { ProductResponse } from '../../lib/api';
import { StorefrontStore, isOrderable, initialsOf } from './storefrontTypes';
import { QuantityStepper } from './QuantityStepper';

interface StorefrontViewProps {
  store: StorefrontStore;
  products: ProductResponse[];
  onProductClick?: (productId: number) => void;
  onAddToCart?: (productId: number) => void;
  /** Per-product quantities of the PLAIN line already in the cart (drives the inline stepper). */
  quantities?: Record<number, number>;
  /** Total qty per product across all its cart lines - the count badge on modifier products. */
  productTotals?: Record<number, number>;
  onSetQuantity?: (productId: number, quantity: number) => void;
  cartCount?: number;
  /** Running cart subtotal incl. modifiers (from the hydrated cart). Falls back
   *  to a plain products×qty estimate when omitted (e.g. preview). */
  cartTotal?: number;
  onViewCart?: () => void;
  /** "Find my order" - re-open a past order's confirmation. Omitted in preview. */
  onTrackOrder?: () => void;
  /** A device-local last order, if any - drives the "view your recent order" banner. */
  recentOrder?: { orderId: number } | null;
  onViewRecentOrder?: () => void;
  /** Preview mode (onboarding/edit): render read-only, no cart bar. */
  preview?: boolean;
}

const ALL = '__all__';
// Buttons/selection controls use a fixed brand colour, never the store theme.
const BRAND = 'var(--primary-solid)';

/** The round brand "+" on a product row (add, or open the PDP to choose options). */
const plusButtonStyle = (enabled: boolean): React.CSSProperties => ({
  width: '36px', height: '36px', borderRadius: '10px', border: 'none',
  background: enabled ? BRAND : '#E5E7EB', color: 'white',
  cursor: enabled ? 'pointer' : 'not-allowed',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
});

/** The floating brand add/options control on a grid card's photo: a circle for
 *  "+"/add, a pill when it shows a modifier count. Carries a shadow so it reads
 *  against any photo. */
const floatBtnStyle = (enabled: boolean, pill: boolean): React.CSSProperties => ({
  height: '34px', minWidth: '34px', width: pill ? undefined : '34px',
  padding: pill ? '0 10px' : '0', borderRadius: pill ? '999px' : '50%', border: 'none',
  background: enabled ? BRAND : '#9CA3AF', color: 'white',
  cursor: enabled ? 'pointer' : 'not-allowed',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  boxShadow: '0 1px 4px rgba(0,0,0,0.25)', fontSize: '14px', fontWeight: 700, lineHeight: 1,
});

/**
 * The public shop view - store header, category filter, product list. Purely
 * presentational and width-fluid, so it renders identically full-page and inside
 * a phone-frame preview. Interactions are no-ops unless handlers are provided.
 * Only the header uses the store's theme colour; all buttons are brand-black.
 */
export function StorefrontView({
  store,
  products,
  onProductClick,
  onAddToCart,
  quantities = {},
  productTotals = {},
  onSetQuantity,
  cartCount = 0,
  cartTotal,
  onViewCart,
  onTrackOrder,
  recentOrder,
  onViewRecentOrder,
  preview = false,
}: StorefrontViewProps) {
  const headerColor = store.themeColor || '#000000';
  const currency = store.currency;

  // Prefer the true subtotal (incl. modifiers) from the hydrated cart; fall back
  // to a plain estimate for preview surfaces that don't pass one.
  const barTotal = cartTotal ?? products.reduce((sum, p) => sum + p.price * (quantities[p.id] ?? 0), 0);

  // Category chips, ordered by the merchant's displayOrder (then name), not by
  // the order products happen to load in.
  const categories = useMemo(() => {
    const byName = new Map<string, number>();
    products.forEach((p) => {
      if (!p.categoryName) return;
      const order = p.categoryDisplayOrder ?? Number.MAX_SAFE_INTEGER;
      // keep the smallest order seen for a name (all products in a category share it)
      if (!byName.has(p.categoryName) || order < (byName.get(p.categoryName) as number)) {
        byName.set(p.categoryName, order);
      }
    });
    return Array.from(byName.keys()).sort((a, b) => {
      const d = (byName.get(a) as number) - (byName.get(b) as number);
      return d !== 0 ? d : a.localeCompare(b);
    });
  }, [products]);

  const [activeCategory, setActiveCategory] = useState<string>(ALL);

  const visible = activeCategory === ALL
    ? products
    : products.filter((p) => p.categoryName === activeCategory);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', background: '#F3F4F6' }}>
      <style>{`@media (max-width: 360px) { .shop-card-desc { display: none; } }`}</style>
      {/* Header (theme colour) */}
      <div style={{ background: headerColor, color: 'white', padding: '24px 16px', textAlign: 'center' }}>
        <div
          style={{
            width: '64px', height: '64px', borderRadius: '50%', margin: '0 auto 12px',
            background: store.logoUrl ? 'transparent' : 'rgba(255,255,255,0.2)',
            border: '2px solid rgba(255,255,255,0.35)', overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '20px', fontWeight: 600,
          }}
        >
          {store.logoUrl
            ? <img src={store.logoUrl} alt={store.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : initialsOf(store.name)}
        </div>
        <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>{store.name || 'My Store'}</h1>
        {store.storeDescription && (
          <p style={{
            fontSize: '13px', opacity: 0.9, marginTop: '6px', maxWidth: '520px', marginInline: 'auto',
            // Never let a long description overwhelm the header.
            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {store.storeDescription}
          </p>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: '14px', marginTop: '10px', fontSize: '12px', opacity: 0.95 }}>
          {(store.totalItemsSold ?? 0) > 0 && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <ShoppingBag size={13} /> {store.totalItemsSold!.toLocaleString()} sold
            </span>
          )}
          {store.phoneNumber && (
            <a href={`https://wa.me/${store.phoneNumber.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'inherit', textDecoration: 'none' }}>
              <MessageCircle size={13} /> {store.phoneNumber}
            </a>
          )}
          {store.operatingHours && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Clock size={13} /> {store.operatingHours}
            </span>
          )}
          {store.address && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <MapPin size={13} /> {store.address}
            </span>
          )}
        </div>
      </div>

      {/* Recent-order recall - one tap back to the order placed on this device. */}
      {!preview && recentOrder && onViewRecentOrder && (
        <button onClick={onViewRecentOrder}
          style={{ width: '100%', padding: '10px 12px', background: 'white', borderBottom: '1px solid var(--border-subtle)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600 }}>
          <ShoppingBag size={14} /> View your recent order #{recentOrder.orderId} →
        </button>
      )}

      {/* Category chips (selected = brand-black) - pinned so they stay reachable
          while scrolling a long product list. */}
      {categories.length > 0 && (
        <div style={{ position: 'sticky', top: 0, zIndex: 15, display: 'flex', gap: '8px', padding: '12px', overflowX: 'auto', background: 'white', borderBottom: '1px solid var(--border-subtle)' }}>
          {[{ key: ALL, label: 'All' }, ...categories.map((c) => ({ key: c, label: c }))].map((chip) => {
            const on = activeCategory === chip.key;
            return (
              <button
                key={chip.key}
                onClick={() => setActiveCategory(chip.key)}
                style={{
                  flexShrink: 0, padding: '6px 14px', borderRadius: '999px', cursor: 'pointer',
                  fontSize: '12.5px', fontWeight: on ? 600 : 500,
                  border: on ? `1px solid ${BRAND}` : '1px solid var(--border-subtle)',
                  background: on ? BRAND : 'white', color: on ? 'white' : 'var(--text-secondary)',
                }}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Product list */}
      <div style={{ flex: 1, padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {visible.length === 0 ? (
          <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            <Package size={22} style={{ marginBottom: '8px' }} />
            <div>No products yet.</div>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '10px' }}>
            {visible.map((p) => {
            const orderable = isOrderable(p);
            const inCart = quantities[p.id] ?? 0;
            // A product with ANY modifier group can't be blind quick-added - its "+"
            // opens the PDP so the customer sees and chooses its options first. Only
            // truly plain products get the inline quick-add / stepper.
            const hasModifiers = (p.modifierGroups ?? []).length > 0;
            // Modifier products show their total cart quantity (across all option
            // sets) so the customer can see how many they already have; 0 keeps "+".
            const modifierTotal = productTotals[p.id] ?? 0;
            const readyLine = p.preOrder ? formatPreorderReady(p.preOrderReadyDate, p.preOrderReadyTimeStart, p.preOrderReadyTimeEnd) : null;
            return (
              <div
                key={p.id}
                onClick={() => onProductClick?.(p.id)}
                style={{
                  background: 'white', borderRadius: '12px', border: '1px solid var(--border-subtle)',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.06)', overflow: 'hidden', minWidth: 0,
                  cursor: onProductClick ? 'pointer' : 'default',
                  display: 'flex', flexDirection: 'column',
                }}
              >
                {/* Square photo with the floating add / options control at its corner. */}
                <div style={{ position: 'relative', width: '100%', aspectRatio: '1', background: '#E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {p.photoUrl
                    ? <img src={p.photoUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <Package size={28} style={{ color: '#9CA3AF' }} />}

                  {/* Products with options: opens the PDP/decision sheet, showing the total
                      already in the cart (or "+"). Plain products: "+" quick-add until in
                      cart, then a stepper. */}
                  <div onClick={(e) => e.stopPropagation()} style={{ position: 'absolute', right: '8px', bottom: '8px' }}>
                    {hasModifiers ? (
                      <button
                        aria-label={modifierTotal > 0 ? `${p.name}, ${modifierTotal} in cart, choose options` : `Choose options for ${p.name}`}
                        disabled={!orderable || !onProductClick}
                        onClick={() => onProductClick?.(p.id)}
                        style={floatBtnStyle(orderable && !!onProductClick, modifierTotal > 0)}
                      >
                        {modifierTotal > 0 ? modifierTotal : <Plus size={18} />}
                      </button>
                    ) : inCart > 0 && onSetQuantity ? (
                      <div style={{ background: 'white', borderRadius: '999px', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}>
                        <QuantityStepper quantity={inCart} onChange={(q) => onSetQuantity(p.id, q)} min={0} size="sm" />
                      </div>
                    ) : (
                      <button
                        aria-label={`Add ${p.name}`}
                        disabled={!orderable || !onAddToCart}
                        onClick={() => onAddToCart?.(p.id)}
                        style={floatBtnStyle(orderable && !!onAddToCart, false)}
                      >
                        <Plus size={18} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Name, description, price + badges - stacked below the photo. */}
                <div style={{ padding: '8px 10px 10px', minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3 }}>{p.name}</div>
                  {p.description && (
                    <div className="shop-card-desc" style={{ fontSize: '12px', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>{p.description}</div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>{formatMoney(p.price, currency)}</span>
                    {p.preOrder && <span style={{ fontSize: '9px', fontWeight: 600, color: '#92400E', background: '#FEF3C7', padding: '2px 6px', borderRadius: '4px' }}>Pre-order</span>}
                    {!orderable && <span style={{ fontSize: '9px', fontWeight: 600, color: '#6B7280', background: '#F3F4F6', padding: '2px 6px', borderRadius: '4px' }}>Sold Out</span>}
                  </div>
                  {readyLine && (
                    <div style={{ fontSize: '10px', color: '#92400E', marginTop: '3px' }}>Ready {readyLine}</div>
                  )}
                </div>
              </div>
            );
            })}
          </div>
        )}

        {!preview && onTrackOrder && (
          <button
            onClick={onTrackOrder}
            style={{
              alignSelf: 'center', marginTop: '8px', padding: '8px 4px', background: 'none', border: 'none',
              cursor: 'pointer', fontSize: '12.5px', fontWeight: 500, color: 'var(--text-secondary)', textDecoration: 'underline',
            }}
          >
            Already ordered? Find my order
          </button>
        )}
      </div>

      {/* Cart bar (brand-black) - shows the running total + item count */}
      {!preview && cartCount > 0 && onViewCart && (
        <div style={{ position: 'sticky', bottom: 0, padding: '12px', background: 'white', borderTop: '1px solid var(--border-subtle)' }}>
          <button
            onClick={onViewCart}
            style={{
              width: '100%', height: '46px', borderRadius: '12px', border: 'none', cursor: 'pointer',
              background: BRAND, color: 'white', fontSize: '14px', fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
            }}
          >
            <ShoppingBag size={17} /> View cart · {formatMoney(barTotal, currency)} ({cartCount})
          </button>
        </div>
      )}
    </div>
  );
}

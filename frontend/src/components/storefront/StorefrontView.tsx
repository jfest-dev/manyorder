import { useEffect, useMemo, useRef, useState } from 'react';
import { Package, ShoppingBag, Plus, MapPin, Clock, Search, X, Share2, Check } from 'lucide-react';
import { WhatsAppIcon } from '../icons/WhatsAppIcon';
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
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  // Focus the field the moment the search input expands.
  useEffect(() => { if (searchOpen) searchInputRef.current?.focus(); }, [searchOpen]);

  // Category chip AND text search combine (both must match). Search is
  // case-insensitive over name, description, and category name - never price.
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (activeCategory !== ALL && p.categoryName !== activeCategory) return false;
      if (!q) return true;
      return [p.name, p.description, p.categoryName]
        .filter(Boolean)
        .some((field) => (field as string).toLowerCase().includes(q));
    });
  }, [products, activeCategory, search]);

  const filtering = search.trim() !== '' || activeCategory !== ALL;

  // Share the storefront link. Native share sheet on mobile; clipboard fallback
  // with a brief "Copied" state (mirrors the dashboard's Copy Store Link).
  const [shareCopied, setShareCopied] = useState(false);
  const shareShop = async () => {
    const url = window.location.origin + window.location.pathname;
    if (navigator.share) {
      try { await navigator.share({ title: store.name || 'Shop', url }); } catch { /* dismissed */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      window.setTimeout(() => setShareCopied(false), 1600);
    } catch { /* clipboard blocked - nothing to do */ }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', background: '#F3F4F6' }}>
      <style>{`@media (max-width: 360px) { .shop-card-desc { display: none; } }`}</style>
      {/* Theme-colour band - the store's brand colour across the top; the card
          overlaps its bottom so the two touch (only a vertical negative margin,
          so no horizontal pan). Share Shop sits in the top-right. */}
      <div style={{
        background: headerColor, height: '110px', position: 'relative',
        // Respect the notch/status bar if this is ever shown full-bleed (PWA/webview);
        // in a normal browser the inset is 0, so this is a no-op there.
        paddingTop: 'env(safe-area-inset-top, 0px)', boxSizing: 'content-box',
      }}>
        {!preview && (
          <button
            type="button"
            onClick={shareShop}
            aria-label="Share shop"
            style={{
              position: 'absolute',
              top: 'calc(env(safe-area-inset-top, 0px) + 24px)',
              right: 'calc(env(safe-area-inset-right, 0px) + 12px)',
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              padding: '8px 12px', borderRadius: '999px', border: 'none', cursor: 'pointer',
              background: 'rgba(255, 255, 255, 0.92)', color: '#111827', fontSize: '12px', fontWeight: 600,
              boxShadow: '0 1px 4px rgba(0, 0, 0, 0.15)',
            }}
          >
            {shareCopied ? <Check size={14} /> : <Share2 size={14} />}
            {shareCopied ? 'Copied' : 'Share'}
          </button>
        )}
      </div>

      {/* Store card - white, left-aligned, overlapping the band. */}
      <div
        style={{
          background: 'white', borderRadius: '16px', margin: '-40px 12px 12px', padding: '16px',
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.08)', position: 'relative',
          display: 'flex', flexDirection: 'column', gap: '12px',
        }}
      >
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <div
            style={{
              width: '76px', height: '76px', borderRadius: '16px', flexShrink: 0, overflow: 'hidden',
              background: store.logoUrl ? '#F3F4F6' : headerColor, color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', fontWeight: 600,
            }}
          >
            {store.logoUrl
              ? <img src={store.logoUrl} alt={store.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initialsOf(store.name)}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: '#111827', overflowWrap: 'anywhere' }}>
              {store.name || 'My Store'}
            </h1>
            {store.storeDescription && (
              <p style={{
                fontSize: '13px', color: '#6B7280', margin: '4px 0 0', lineHeight: 1.45,
                whiteSpace: 'pre-line', overflowWrap: 'anywhere',
                // Cap at 4 lines so a very long description can't blow up the card height.
                display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                {store.storeDescription}
              </p>
            )}
            {/* "X sold" count is intentionally hidden on the storefront (tracking kept
                on store.totalItemsSold). See docs/backlog.md - to be replaced by a
                seller gamification/badge system rather than a raw sold count. */}
          </div>
        </div>

        {/* Store info - hours, phone, address as one plain, left-aligned list
            (same colour, size and spacing, no separate band). */}
        {(store.operatingHours || store.phoneNumber || store.address) && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: '#6B7280' }}>
            {store.operatingHours && (
              <span style={{ display: 'inline-flex', alignItems: 'flex-start', gap: '8px' }}>
                <Clock size={14} style={{ flexShrink: 0, marginTop: '1px', color: '#6B7280' }} />
                {/* Wraps naturally (typically <= 2 lines); never truncated. */}
                <span style={{ minWidth: 0, overflowWrap: 'anywhere', lineHeight: 1.45 }}>{store.operatingHours}</span>
              </span>
            )}
            {store.phoneNumber && (
              <a href={`https://wa.me/${store.phoneNumber.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'inherit', textDecoration: 'none' }}>
                <WhatsAppIcon size={14} color="#6B7280" style={{ flexShrink: 0 }} /> {store.phoneNumber}
              </a>
            )}
            {store.address && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.address)}`}
                target="_blank" rel="noopener noreferrer"
                style={{ display: 'inline-flex', alignItems: 'flex-start', gap: '8px', color: 'inherit', textDecoration: 'none' }}
              >
                <MapPin size={14} style={{ flexShrink: 0, marginTop: '1px', color: '#6B7280' }} />
                <span style={{ minWidth: 0 }}>{store.address}</span>
              </a>
            )}
          </div>
        )}
      </div>

      {/* Recent-order recall - one tap back to the order placed on this device. */}
      {!preview && recentOrder && onViewRecentOrder && (
        <button onClick={onViewRecentOrder}
          style={{ width: '100%', padding: '10px 12px', background: 'white', borderBottom: '1px solid var(--border-subtle)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--text-primary)', fontSize: '13px', fontWeight: 600 }}>
          <ShoppingBag size={14} /> View your recent order #{recentOrder.orderId} →
        </button>
      )}

      {/* Sticky filter row: category chips + a search icon that expands, in place,
          into a full-width search field (chips hidden while it's open). One compact
          row either way, pinned so the customer can filter while scrolling. */}
      {products.length > 0 && (
        <div style={{ position: 'sticky', top: 0, zIndex: 15, background: 'white', borderBottom: '1px solid var(--border-subtle)', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {searchOpen ? (
            <>
              <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
                <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input
                  ref={searchInputRef}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search products"
                  aria-label="Search products"
                  style={{
                    width: '100%', padding: '9px 12px 9px 36px', borderRadius: '999px',
                    border: '1px solid var(--border-subtle)', background: '#F3F4F6',
                    fontSize: '14px', outline: 'none', color: 'var(--text-primary)',
                  }}
                />
              </div>
              <button
                aria-label="Close search"
                onClick={() => { setSearchOpen(false); setSearch(''); }}
                style={{ flexShrink: 0, width: '34px', height: '34px', borderRadius: '50%', border: 'none', background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <X size={18} />
              </button>
            </>
          ) : (
            <>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', gap: '8px', overflowX: 'auto' }}>
                {categories.length > 0 && [{ key: ALL, label: 'All' }, ...categories.map((c) => ({ key: c, label: c }))].map((chip) => {
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
              <button
                aria-label="Search products"
                onClick={() => setSearchOpen(true)}
                style={{ flexShrink: 0, width: '34px', height: '34px', borderRadius: '50%', border: '1px solid var(--border-subtle)', background: 'white', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <Search size={18} />
              </button>
            </>
          )}
        </div>
      )}

      {/* Product list */}
      <div style={{ flex: 1, padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {visible.length === 0 ? (
          <div style={{ padding: '48px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
            <Package size={22} style={{ marginBottom: '8px' }} />
            <div>{filtering ? 'No products match.' : 'No products yet.'}</div>
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
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' }}>{p.name}</div>
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

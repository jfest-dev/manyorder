import { useState } from 'react';
import { Package, ArrowLeft } from 'lucide-react';
import { formatMoney } from '../../lib/currency';
import { formatPreorderReady } from '../../lib/datetime';
import type { ProductResponse } from '../../lib/api';
import { isOrderable } from './storefrontTypes';
import { QuantityStepper } from './QuantityStepper';

interface ProductDetailViewProps {
  product: ProductResponse;
  currency: string;
  onAddToCart?: (productId: number, quantity: number) => void;
  onBack?: () => void;
  /** Preview mode (Edit Product): render read-only, no quantity/add controls. */
  preview?: boolean;
}

const BRAND = 'var(--primary-solid)';

/**
 * The product detail page (PDP) — presentational and width-fluid. Shared by the
 * public storefront and the Edit Product live preview. Buttons are brand-black.
 */
export function ProductDetailView({ product, currency, onAddToCart, onBack, preview = false }: ProductDetailViewProps) {
  const orderable = isOrderable(product);
  const [qty, setQty] = useState(1);
  const readyLine = product.preOrder
    ? formatPreorderReady(product.preOrderReadyDate, product.preOrderReadyTimeStart, product.preOrderReadyTimeEnd)
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', background: 'white' }}>
      {onBack && (
        <div style={{ padding: '12px' }}>
          <button
            onClick={onBack}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '13px', padding: 0 }}
          >
            <ArrowLeft size={16} /> Back
          </button>
        </div>
      )}

      {/* Photo */}
      <div style={{ width: '100%', aspectRatio: '1 / 1', maxHeight: '360px', background: '#E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {product.photoUrl
          ? <img src={product.photoUrl} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <Package size={40} style={{ color: '#9CA3AF' }} />}
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>{product.name}</h1>
            {product.categoryName && (
              <span style={{ fontSize: '10px', color: 'var(--text-secondary)', background: 'var(--bg-card-subtle)', padding: '2px 8px', borderRadius: '999px' }}>{product.categoryName}</span>
            )}
          </div>
          <div style={{ fontSize: '18px', fontWeight: 700, marginTop: '6px', color: 'var(--text-primary)' }}>
            {formatMoney(product.price, currency)}
          </div>
        </div>

        {/* Pre-order / stock status */}
        {product.preOrder ? (
          <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', padding: '10px 12px', borderRadius: '8px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#92400E' }}>
              Pre-order{readyLine ? ` · Ready ${readyLine}` : ''}
            </div>
            {product.preOrderNote && (
              <div style={{ fontSize: '12px', color: '#92400E', opacity: 0.9, marginTop: '4px', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{product.preOrderNote}</div>
            )}
          </div>
        ) : !orderable ? (
          <div style={{ fontSize: '12px', color: '#B91C1C', background: '#FEE2E2', padding: '8px 10px', borderRadius: '8px' }}>
            Currently sold out
          </div>
        ) : null}

        {product.description && (
          <p style={{ fontSize: '14px', lineHeight: 1.5, color: 'var(--text-secondary)', margin: 0 }}>{product.description}</p>
        )}

        {/* Quantity + add */}
        {!preview && (
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '4px' }}>
            <QuantityStepper quantity={qty} onChange={setQty} min={1} size="md" disabled={!orderable} />
            <button
              disabled={!orderable || !onAddToCart}
              onClick={() => onAddToCart?.(product.id, qty)}
              style={{
                flex: 1, height: '46px', borderRadius: '12px', border: 'none',
                background: orderable ? BRAND : '#E5E7EB', color: 'white',
                fontSize: '14px', fontWeight: 600, cursor: orderable && onAddToCart ? 'pointer' : 'not-allowed',
              }}
            >
              {orderable ? `Add ${qty} to cart` : 'Unavailable'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

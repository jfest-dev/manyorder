import { useMemo, useState } from 'react';
import { Package, ArrowLeft } from 'lucide-react';
import { formatMoney } from '../../lib/currency';
import { formatPreorderReady } from '../../lib/datetime';
import type { ProductResponse, ModifierGroupView } from '../../lib/api';
import { isOrderable } from './storefrontTypes';
import { QuantityStepper } from './QuantityStepper';

interface ProductDetailViewProps {
  product: ProductResponse;
  currency: string;
  onAddToCart?: (productId: number, quantity: number, modifierOptionIds: number[], notes?: string) => void;
  onBack?: () => void;
  /** Preview mode (Edit Product): render read-only, no quantity/add controls. */
  preview?: boolean;
  /** Whether the store allows a per-item note (merchant setting). Defaults to true. */
  allowItemNotes?: boolean;
  /** 'edit' reopens an existing cart line for changes; 'add' (default) adds a line. */
  mode?: 'add' | 'edit';
  initialOptionIds?: number[];
  initialNotes?: string;
  initialQuantity?: number;
  /** Signature of the cart line being edited (edit mode). */
  editingSignature?: string;
  onUpdateLine?: (oldSignature: string, productId: number, quantity: number, modifierOptionIds: number[], notes?: string) => void;
}

const BRAND = 'var(--primary-solid)';
const NOTES_MAX = 200;

/** How many of a group's options are currently chosen. */
function countInGroup(group: ModifierGroupView, selected: number[]): number {
  return group.options.reduce((n, o) => (selected.includes(o.id) ? n + 1 : n), 0);
}

/** A group's rule is met when its selected count is within [minSelect, maxSelect]. */
function groupSatisfied(group: ModifierGroupView, selected: number[]): boolean {
  const count = countInGroup(group, selected);
  return count >= group.minSelect && (group.maxSelect == null || count <= group.maxSelect);
}

/** Human hint for a group's selection rule (choose-one, up-to-N, at-least-N…). */
function groupRuleLabel(group: ModifierGroupView): string {
  const { minSelect, maxSelect } = group;
  if (maxSelect === 1) return group.required ? 'Choose 1' : 'Choose up to 1';
  if (minSelect > 0 && maxSelect != null) return minSelect === maxSelect ? `Choose ${minSelect}` : `Choose ${minSelect}–${maxSelect}`;
  if (minSelect > 0) return `Choose at least ${minSelect}`;
  if (maxSelect != null) return `Choose up to ${maxSelect}`;
  return 'Optional';
}

/**
 * The product detail page (PDP) - presentational and width-fluid. Shared by the
 * public storefront and the Edit Product live preview. Renders the product's
 * modifier groups (radio for choose-one, checkbox otherwise) + a per-item note,
 * validates the min/max/required rules client-side, and adds the line with the
 * chosen option ids (never prices - the server re-derives those). Buttons are
 * brand-black.
 */
export function ProductDetailView({
  product, currency, onAddToCart, onBack, preview = false, allowItemNotes = true,
  mode = 'add', initialOptionIds, initialNotes, initialQuantity,
  editingSignature, onUpdateLine,
}: ProductDetailViewProps) {
  const orderable = isOrderable(product);
  const groups = product.modifierGroups ?? [];
  const [qty, setQty] = useState(initialQuantity ?? 1);
  const [selected, setSelected] = useState<number[]>(initialOptionIds ?? []);
  const [notes, setNotes] = useState(initialNotes ?? '');
  const readyLine = product.preOrder
    ? formatPreorderReady(product.preOrderReadyDate, product.preOrderReadyTimeStart, product.preOrderReadyTimeEnd)
    : null;

  const toggleOption = (group: ModifierGroupView, optionId: number) => {
    setSelected((prev) => {
      const groupIds = group.options.map((o) => o.id);
      const isOn = prev.includes(optionId);
      if (group.maxSelect === 1) {
        // Radio: this option replaces any other in the group. A required group
        // keeps a choice (can't toggle the only one off); an optional one clears.
        const withoutGroup = prev.filter((id) => !groupIds.includes(id));
        if (isOn) return group.required ? prev : withoutGroup;
        return [...withoutGroup, optionId];
      }
      // Checkbox: toggle, but never exceed maxSelect.
      if (isOn) return prev.filter((id) => id !== optionId);
      const inGroup = prev.filter((id) => groupIds.includes(id)).length;
      if (group.maxSelect != null && inGroup >= group.maxSelect) return prev;
      return [...prev, optionId];
    });
  };

  const selectedOptions = useMemo(
    () => groups.flatMap((g) => g.options.filter((o) => selected.includes(o.id))),
    [groups, selected],
  );
  const unitPrice = product.price + selectedOptions.reduce((s, o) => s + o.priceDelta, 0);
  const allSatisfied = useMemo(() => groups.every((g) => groupSatisfied(g, selected)), [groups, selected]);
  // The first unmet required group, to nudge the customer toward what's missing.
  const firstUnmet = useMemo(
    () => groups.find((g) => !groupSatisfied(g, selected)),
    [groups, selected],
  );

  const hasHandler = mode === 'edit' ? !!onUpdateLine : !!onAddToCart;
  const canSubmit = orderable && allSatisfied && hasHandler;
  const notesTrim = notes.trim() || undefined;
  const money = formatMoney(unitPrice * qty, currency);

  // The "already in cart?" decision is made upstream on the shop grid, so the PDD
  // just adds (or updates) here. Identical choices merge via addLine.
  const submit = () => {
    if (!canSubmit) return;
    if (mode === 'edit' && editingSignature) {
      onUpdateLine?.(editingSignature, product.id, qty, selected, notesTrim);
      return;
    }
    onAddToCart?.(product.id, qty, selected, notesTrim);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%', background: 'white' }}>
      {onBack && (
        <div style={{ position: 'sticky', top: 0, zIndex: 20, padding: '12px', background: 'white', borderBottom: '1px solid var(--border-subtle)' }}>
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
          <p style={{ fontSize: '14px', lineHeight: 1.5, color: 'var(--text-secondary)', margin: 0, whiteSpace: 'pre-line' }}>{product.description}</p>
        )}

        {/* Modifier groups */}
        {groups.map((group) => {
          const chosen = countInGroup(group, selected);
          const atMax = group.maxSelect != null && group.maxSelect > 1 && chosen >= group.maxSelect;
          return (
            <div key={group.id} style={{ marginTop: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {group.name}
                  {group.required && <span style={{ color: '#B91C1C', marginLeft: '4px' }}>*</span>}
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{groupRuleLabel(group)}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {group.options.map((opt) => {
                  const on = selected.includes(opt.id);
                  const radio = group.maxSelect === 1;
                  const disabled = preview || (!on && atMax);
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleOption(group, opt.id)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px', width: '100%', textAlign: 'left',
                        padding: '10px 12px', borderRadius: '10px', cursor: disabled ? 'default' : 'pointer',
                        border: on ? `1.5px solid ${BRAND}` : '1px solid var(--border-subtle)',
                        background: on ? 'var(--bg-card-subtle)' : 'white',
                        opacity: disabled && !on ? 0.55 : 1,
                      }}
                    >
                      {/* Selection indicator: circle for radio, square for checkbox. */}
                      <span style={{
                        width: '18px', height: '18px', flexShrink: 0,
                        borderRadius: radio ? '50%' : '5px',
                        border: on ? `5px solid ${BRAND}` : '2px solid #CBD5E1',
                        background: on && !radio ? BRAND : 'white',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {on && !radio && <span style={{ color: 'white', fontSize: '11px', fontWeight: 900, lineHeight: 1 }}>✓</span>}
                      </span>
                      <span style={{ flex: 1, fontSize: '14px', color: 'var(--text-primary)' }}>{opt.name}</span>
                      {opt.priceDelta > 0 && (
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>+{formatMoney(opt.priceDelta, currency)}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* Per-item note (hidden when the merchant has turned notes off for the store) */}
        {!preview && allowItemNotes && (
          <div style={{ marginTop: '4px' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Note <span style={{ fontSize: '11px', fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span>
            </div>
            <textarea
              value={notes}
              maxLength={NOTES_MAX}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special requests for this item?"
              rows={2}
              style={{
                width: '100%', resize: 'vertical', padding: '10px 12px', borderRadius: '10px',
                border: '1px solid var(--border-subtle)', fontSize: '14px', fontFamily: 'inherit',
                color: 'var(--text-primary)', boxSizing: 'border-box',
              }}
            />
          </div>
        )}

        {/* Quantity + add */}
        {!preview && (
          <div style={{ marginTop: '4px' }}>
            {orderable && firstUnmet && (
              <div style={{ fontSize: '12px', color: '#B91C1C', marginBottom: '8px' }}>
                Please choose {firstUnmet.name.toLowerCase()} to continue.
              </div>
            )}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <QuantityStepper quantity={qty} onChange={setQty} min={1} size="md" disabled={!orderable} />
              <button
                disabled={!canSubmit}
                onClick={submit}
                style={{
                  flex: 1, height: '46px', borderRadius: '12px', border: 'none',
                  background: canSubmit ? BRAND : '#E5E7EB', color: canSubmit ? 'white' : '#9CA3AF',
                  fontSize: '14px', fontWeight: 600, cursor: canSubmit ? 'pointer' : 'not-allowed',
                }}
              >
                {!orderable ? 'Unavailable' : mode === 'edit' ? `Update basket · ${money}` : `Add to basket · ${money}`}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

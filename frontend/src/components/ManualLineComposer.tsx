import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from './Button';
import { FieldInput, FieldSelect } from './Field';
import { formatMoney } from '../lib/currency';
import { groupSelectionComplete, resolveSelectedOptions } from '../lib/modifiers';
import type { ModifierGroupView, ProductResponse } from '../lib/api';

export interface ComposedLine {
  product: ProductResponse;
  quantity: number;
  modifierOptionIds: number[];
  notes?: string;
}

interface ManualLineComposerProps {
  products: ProductResponse[];
  currency: string;
  onAdd: (line: ComposedLine) => void;
}

const BRAND = 'var(--primary-solid)';

/**
 * Adds one line to a manual order, with modifier + per-line-note support. When
 * the picked product has modifier groups, radio/checkbox pickers appear and the
 * Add button stays disabled until every required group is satisfied. Emits the
 * chosen option ids + note; the parent owns line identity (same product with
 * different choices = a separate line) and totals. Prices are re-derived by the
 * server at save - shown here only as a running preview.
 */
export function ManualLineComposer({ products, currency, onAdd }: ManualLineComposerProps) {
  const [productId, setProductId] = useState('');
  const [qty, setQty] = useState('1');
  const [selected, setSelected] = useState<number[]>([]);
  const [notes, setNotes] = useState('');

  const product = products.find((p) => String(p.id) === productId) ?? null;
  const groups = product?.modifierGroups ?? [];

  const reset = () => { setProductId(''); setQty('1'); setSelected([]); setNotes(''); };

  const pickProduct = (id: string) => { setProductId(id); setSelected([]); setNotes(''); };

  const toggleOption = (group: ModifierGroupView, optionId: number) => {
    setSelected((prev) => {
      const groupIds = group.options.map((o) => o.id);
      const isOn = prev.includes(optionId);
      if (group.maxSelect === 1) {
        const withoutGroup = prev.filter((id) => !groupIds.includes(id));
        if (isOn) return group.required ? prev : withoutGroup;
        return [...withoutGroup, optionId];
      }
      if (isOn) return prev.filter((id) => id !== optionId);
      const inGroup = prev.filter((id) => groupIds.includes(id)).length;
      if (group.maxSelect != null && inGroup >= group.maxSelect) return prev;
      return [...prev, optionId];
    });
  };

  const complete = useMemo(() => groupSelectionComplete(groups, selected), [groups, selected]);
  const unitPrice = product ? product.price + resolveSelectedOptions(product, selected).modifiersTotal : 0;
  const quantity = Math.max(1, parseInt(qty || '1', 10) || 1);

  const add = () => {
    if (!product || !complete) return;
    onAdd({ product, quantity, modifierOptionIds: selected, notes: notes.trim() || undefined });
    reset();
  };

  return (
    <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-medium)', padding: '14px', marginBottom: '16px', background: 'var(--bg-card-subtle)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px', gap: '10px', alignItems: 'end' }}>
        <FieldSelect
          label="Product"
          placeholder={products.length ? 'Select a product' : 'No active products yet'}
          options={products.map((p) => ({ value: String(p.id), label: `${p.name} · ${formatMoney(p.price, currency)}` }))}
          value={productId}
          onChange={pickProduct}
        />
        <FieldInput label="Qty" type="number" min={1} value={qty} onChange={setQty} />
      </div>

      {/* Modifier pickers for the selected product */}
      {product && groups.length > 0 && (
        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {groups.map((group) => {
            const chosen = group.options.reduce((n, o) => (selected.includes(o.id) ? n + 1 : n), 0);
            const atMax = group.maxSelect != null && group.maxSelect > 1 && chosen >= group.maxSelect;
            return (
              <div key={group.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>
                    {group.name}{group.required && <span style={{ color: 'var(--error-color)', marginLeft: '3px' }}>*</span>}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {group.maxSelect === 1 ? (group.required ? 'Choose 1' : 'Choose up to 1') : group.maxSelect != null ? `Up to ${group.maxSelect}` : 'Optional'}
                  </span>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {group.options.map((opt) => {
                    const on = selected.includes(opt.id);
                    const disabled = !on && atMax;
                    return (
                      <button key={opt.id} type="button" disabled={disabled} onClick={() => toggleOption(group, opt.id)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 10px', fontSize: '13px',
                          borderRadius: 'var(--radius-field)', cursor: disabled ? 'default' : 'pointer',
                          border: on ? `1.5px solid ${BRAND}` : '1px solid var(--border-strong)',
                          background: on ? 'var(--bg-card)' : 'var(--bg-card)', color: 'var(--text-primary)',
                          opacity: disabled ? 0.5 : 1, fontWeight: on ? 600 : 500,
                        }}>
                        <span style={{
                          width: '14px', height: '14px', flexShrink: 0,
                          borderRadius: group.maxSelect === 1 ? '50%' : '4px',
                          border: on ? `4px solid ${BRAND}` : '2px solid var(--border-strong)',
                          background: on && group.maxSelect !== 1 ? BRAND : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '9px', fontWeight: 900,
                        }}>{on && group.maxSelect !== 1 ? '✓' : ''}</span>
                        {opt.name}{opt.priceDelta > 0 && <span style={{ color: 'var(--text-secondary)' }}>+{formatMoney(opt.priceDelta, currency)}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
          <FieldInput label="Note (optional)" placeholder="Any special requests for this item?" value={notes} onChange={setNotes} maxLength={200} />
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginTop: '12px' }}>
        <span className="text-small" style={{ color: 'var(--text-secondary)' }}>
          {product ? `${formatMoney(unitPrice, currency)} each` : ''}
        </span>
        <Button variant="secondary" onClick={add} disabled={!product || !complete}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
            <Plus size={15} /> Add item
          </div>
        </Button>
      </div>
    </div>
  );
}

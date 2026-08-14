import { useEffect, useState } from 'react';
import { Truck, MessageCircle, Check } from 'lucide-react';
import { Button } from '../Button';
import { FieldInput } from '../Field';
import { MoneyField } from '../MoneyField';
import { storesApi, StoreResponse, ApiError } from '../../lib/api';
import { formatMoney } from '../../lib/currency';
import { DEFAULT_DELIVERY_TBC_MESSAGE } from '../../lib/delivery';

interface DeliveryProps {
  storeId: number;
  currency: string;
  /** Bubble the saved change up so the app can silently re-sync the store list. */
  onSaved?: () => void;
}

const SUCCESS_GREEN = '#16a34a';

const sectionCard: React.CSSProperties = {
  background: 'var(--bg-card)',
  borderRadius: 'var(--radius-card)',
  border: '1px solid var(--border-subtle)',
  padding: '24px',
};

const sectionLabel: React.CSSProperties = {
  fontSize: '12px', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
  color: 'var(--text-muted)', marginBottom: '14px',
};

/** A framed choice row with a leading radio dot — used for the two delivery modes. */
function ChoiceRow({ selected, onSelect, title, desc, children }: {
  selected: boolean; onSelect: () => void; title: string; desc: string; children?: React.ReactNode;
}) {
  return (
    <div
      onClick={onSelect}
      style={{
        border: `1px solid ${selected ? 'var(--primary-solid)' : 'var(--border-strong)'}`,
        borderRadius: '12px', padding: '16px', cursor: 'pointer',
        background: selected ? 'color-mix(in srgb, var(--primary-solid) 4%, transparent)' : 'transparent',
        transition: 'border-color .15s ease, background .15s ease',
      }}
    >
      <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
        <span style={{
          width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0, marginTop: '1px',
          border: `2px solid ${selected ? 'var(--primary-solid)' : 'var(--border-strong)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {selected && <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary-solid)' }} />}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="text-small" style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{title}</div>
          <div className="text-xs" style={{ color: 'var(--text-secondary)', marginTop: '2px', lineHeight: 1.45 }}>{desc}</div>
          {selected && children && (
            <div onClick={(e) => e.stopPropagation()} style={{ marginTop: '16px' }}>{children}</div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * The dedicated Delivery screen (owner-only). Delivery fee has three modes,
 * mirroring the checkout/backend semantics:
 *   - "to be confirmed" (fee null) → resolved off-platform over WhatsApp, with an
 *     optional custom customer-facing message;
 *   - flat fee 0 → explicitly free delivery;
 *   - flat fee >0 → optionally waived once the cart subtotal reaches a threshold.
 * Saves through the absolute-semantics PATCH /delivery endpoint so switching back
 * to "to be confirmed" actually clears the fee to null.
 */
export function Delivery({ storeId, currency, onSaved }: DeliveryProps) {
  const [loading, setLoading] = useState(true);
  const [chargeFee, setChargeFee] = useState(false);
  const [feeAmount, setFeeAmount] = useState<number | null>(null);
  const [freeOverEnabled, setFreeOverEnabled] = useState(false);
  const [threshold, setThreshold] = useState<number | null>(null);
  const [tbcMessage, setTbcMessage] = useState('');

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const s: StoreResponse = await storesApi.get(storeId);
      const feeConfigured = s.deliveryFee != null;
      setChargeFee(feeConfigured);
      setFeeAmount(feeConfigured ? s.deliveryFee : null);
      setFreeOverEnabled(s.freeDeliveryThreshold != null);
      setThreshold(s.freeDeliveryThreshold ?? null);
      setTbcMessage(s.deliveryToBeConfirmedMessage ?? '');
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : 'Could not load delivery settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId]);

  const save = async () => {
    setError('');
    setSaved(false);

    let deliveryFee: number | null = null;
    if (chargeFee) {
      if (feeAmount === null || feeAmount < 0) {
        setError('Enter a valid delivery fee (0 or more).');
        return;
      }
      deliveryFee = feeAmount;
    }

    let freeDeliveryThreshold: number | null = null;
    if (chargeFee && (deliveryFee ?? 0) > 0 && freeOverEnabled) {
      if (threshold === null || threshold <= 0) {
        setError('Enter a valid free-delivery amount.');
        return;
      }
      freeDeliveryThreshold = threshold;
    }

    setSaving(true);
    try {
      await storesApi.updateDelivery(storeId, {
        deliveryFee,
        freeDeliveryThreshold,
        // Persist the custom wording regardless of mode so it's kept if they toggle back.
        deliveryToBeConfirmedMessage: tbcMessage.trim() || null,
      });
      onSaved?.();
      setSaved(true);
      window.setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e instanceof ApiError ? e.message : 'Could not save delivery settings.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-small" style={{ color: 'var(--text-secondary)' }}>Loading delivery settings…</p>;
  }

  const showThresholdRow = chargeFee && (feeAmount ?? 0) > 0;

  // A one-line preview of what the customer will see at checkout.
  let customerPreview: string;
  if (!chargeFee) {
    customerPreview = tbcMessage.trim() || DEFAULT_DELIVERY_TBC_MESSAGE;
  } else if ((feeAmount ?? 0) === 0) {
    customerPreview = 'Free delivery';
  } else if (freeOverEnabled && threshold) {
    customerPreview = `${formatMoney(feeAmount ?? 0, currency)} delivery · free over ${formatMoney(threshold, currency)}`;
  } else {
    customerPreview = `${formatMoney(feeAmount ?? 0, currency)} delivery`;
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ marginBottom: '8px' }}>Delivery</h1>
        <p className="text-small" style={{ color: 'var(--text-secondary)' }}>
          Choose how delivery is charged when customers check out on your storefront.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '640px' }}>
        <div style={sectionCard}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <Truck size={18} style={{ color: 'var(--text-secondary)' }} />
            <h3 style={{ margin: 0 }}>How delivery is charged</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Mode 1: flat fee */}
            <ChoiceRow
              selected={chargeFee}
              onSelect={() => setChargeFee(true)}
              title="Charge a delivery fee"
              desc="A flat fee added at checkout. Set it to 0 for free delivery."
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <MoneyField
                  label="Delivery fee"
                  currency={currency}
                  value={feeAmount}
                  onChange={setFeeAmount}
                  min={0}
                  helperText="Enter 0 to offer free delivery to everyone."
                />

                {showThresholdRow && (
                  <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
                    <label style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', cursor: 'pointer' }}>
                      <input type="checkbox" checked={freeOverEnabled} onChange={(e) => setFreeOverEnabled(e.target.checked)} style={{ marginTop: '3px' }} />
                      <span>
                        <span className="text-small" style={{ fontWeight: 600, display: 'block', color: 'var(--text-primary)' }}>Free delivery over a spend</span>
                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          Waive the fee once the order subtotal reaches the amount below.
                        </span>
                      </span>
                    </label>
                    {freeOverEnabled && (
                      <div style={{ marginTop: '12px', paddingLeft: '28px' }}>
                        <MoneyField
                          label="Free delivery when subtotal reaches"
                          currency={currency}
                          value={threshold}
                          onChange={setThreshold}
                          min={0}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </ChoiceRow>

            {/* Mode 2: to be confirmed */}
            <ChoiceRow
              selected={!chargeFee}
              onSelect={() => setChargeFee(false)}
              title="Confirm the fee later (to be confirmed)"
              desc="Checkout shows an estimated total; you confirm the delivery fee with the customer over WhatsApp, then edit the order to add it."
            >
              <FieldInput
                label="Message shown to customers"
                multiline
                rows={3}
                value={tbcMessage}
                onChange={setTbcMessage}
                placeholder={DEFAULT_DELIVERY_TBC_MESSAGE}
                helperText="Optional — leave blank to use the default wording. e.g. “Delivery fee depends on your location; we’ll confirm on WhatsApp.”"
              />
            </ChoiceRow>
          </div>
        </div>

        {/* What the customer sees */}
        <div style={{ ...sectionCard, padding: '18px 24px' }}>
          <div style={sectionLabel}>At checkout, customers see</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <MessageCircle size={16} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
            <span className="text-small" style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{customerPreview}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Button variant="primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save delivery settings'}
          </Button>
          {saved && (
            <span className="text-small" style={{ color: SUCCESS_GREEN, fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Check size={15} /> Saved
            </span>
          )}
          {error && <span className="text-small" style={{ color: 'var(--error-color)' }}>{error}</span>}
        </div>
      </div>
    </div>
  );
}

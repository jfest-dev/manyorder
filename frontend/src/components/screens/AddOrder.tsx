import { useEffect, useMemo, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '../Button';
import { FieldInput, FieldSelect } from '../Field';
import { OrderTypeToggle } from '../OrderTypeToggle';
import { ManualLineComposer, type ComposedLine } from '../ManualLineComposer';
import { ordersApi, productsApi, ProductResponse, PaymentStatus, OrderType } from '../../lib/api';
import { formatMoney } from '../../lib/currency';
import { lineSignature } from '../../lib/cart';
import { resolveSelectedOptions, type ResolvedOption } from '../../lib/modifiers';
import type { Store } from '../../App';

interface AddOrderProps {
  store: Store;
  onNavigate: (screen: string) => void;
}

interface Line {
  key: string; // signature: product + chosen options + note
  product: ProductResponse;
  quantity: number;
  modifierOptionIds: number[];
  notes?: string;
  selectedOptions: ResolvedOption[];
  unitPrice: number;
}

const sectionCard: React.CSSProperties = {
  background: 'var(--bg-card)',
  borderRadius: 'var(--radius-card)',
  border: '1px solid var(--border-subtle)',
  padding: '24px',
};

const textareaStyle: React.CSSProperties = {
  width: '100%', minHeight: '88px', padding: '10px 14px', resize: 'vertical',
  borderRadius: 'var(--radius-field)', border: '1px solid var(--border-strong)',
  background: 'var(--bg-card)', fontSize: '14px', lineHeight: 1.5, fontFamily: 'inherit', outline: 'none',
};

export function AddOrder({ store, onNavigate }: AddOrderProps) {
  const storeId = Number(store.id);

  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [orderType, setOrderType] = useState<OrderType>('PICKUP');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>('UNPAID');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    productsApi
      .list(storeId, true)
      .then(setProducts)
      .catch((e) => alert(e?.message || 'Could not load products'));
  }, [storeId]);

  const total = useMemo(
    () => lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0),
    [lines],
  );

  // Same product with different modifiers / note is a separate line (by signature).
  const addComposedLine = (c: ComposedLine) => {
    const key = lineSignature({ productId: c.product.id, modifierOptionIds: c.modifierOptionIds, notes: c.notes });
    const { selectedOptions, modifiersTotal } = resolveSelectedOptions(c.product, c.modifierOptionIds);
    const unitPrice = c.product.price + modifiersTotal;
    setLines((prev) => {
      const existing = prev.find((l) => l.key === key);
      if (existing) return prev.map((l) => (l.key === key ? { ...l, quantity: l.quantity + c.quantity } : l));
      return [...prev, { key, product: c.product, quantity: c.quantity, modifierOptionIds: c.modifierOptionIds, notes: c.notes, selectedOptions, unitPrice }];
    });
  };

  const submit = async () => {
    if (!customerName.trim()) {
      alert('Customer name is required');
      return;
    }
    setBusy(true);
    try {
      const order = await ordersApi.create(storeId, {
        customerName: customerName.trim(),
        email: email.trim() || undefined,
        phoneNumber: phone.trim() || undefined,
        orderType,
        deliveryAddress:
          orderType === 'DELIVERY' && deliveryAddress.trim() ? deliveryAddress.trim() : undefined,
        items: lines.map((l) => ({
          productId: l.product.id,
          quantity: l.quantity,
          modifierOptionIds: l.modifierOptionIds.length ? l.modifierOptionIds : undefined,
          notes: l.notes,
        })),
        paymentStatus,
        paymentMethod: paymentMethod || undefined,
        paymentReference: paymentReference.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      alert(`Order #${order.id} created`);
      onNavigate('orders-all');
    } catch (e: any) {
      alert(e?.message || 'Could not create order');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ marginBottom: '8px' }}>Add New Order</h1>
        <p className="text-small" style={{ color: 'var(--text-secondary)' }}>
          Create a new order manually
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '24px', alignItems: 'start' }}>
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={sectionCard}>
            <h3 style={{ marginBottom: '20px' }}>Customer Information</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <FieldInput label="Customer Name" placeholder="Enter customer name" value={customerName} onChange={setCustomerName} required />
              <FieldInput label="Email Address" type="email" placeholder="customer@example.com" value={email} onChange={setEmail} />
              <FieldInput label="Phone Number" placeholder="+65 8123 4567" value={phone} onChange={setPhone} />
              <OrderTypeToggle value={orderType} onChange={setOrderType} />
              {orderType === 'DELIVERY' && (
                <div>
                  <p className="text-small" style={{ fontWeight: 500, marginBottom: '6px' }}>Delivery Address</p>
                  <textarea
                    style={textareaStyle}
                    placeholder="Address can be added later if you don't have it yet"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                  />
                  <p className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
                    Optional. You can fill this in later via Edit Order.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div style={sectionCard}>
            <h3 style={{ marginBottom: '20px' }}>Order Items</h3>
            <ManualLineComposer products={products} currency={store.currency} onAdd={addComposedLine} />

            {lines.length === 0 ? (
              <div
                className="text-small"
                style={{
                  border: '1px dashed var(--border-strong)', borderRadius: 'var(--radius-medium)',
                  padding: '28px', textAlign: 'center', color: 'var(--text-muted)',
                }}
              >
                No products added yet
              </div>
            ) : (
              <div>
                {lines.map((l) => (
                  <div
                    key={l.key}
                    className="text-small"
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}
                  >
                    <span style={{ flex: 1, minWidth: 0 }}>
                      {l.product.name}
                      {l.selectedOptions.length > 0 && (
                        <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '12px' }}>
                          {l.selectedOptions.map((o) => o.optionName).join(', ')}
                        </span>
                      )}
                      {l.notes && <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '12px', fontStyle: 'italic' }}>“{l.notes}”</span>}
                    </span>
                    <span style={{ width: '60px', textAlign: 'right' }}>× {l.quantity}</span>
                    <span style={{ width: '100px', textAlign: 'right', fontWeight: 600 }}>
                      {formatMoney(l.unitPrice * l.quantity, store.currency)}
                    </span>
                    <button
                      onClick={() => setLines((prev) => prev.filter((x) => x.key !== l.key))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error-color)', padding: '4px' }}
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={sectionCard}>
            <h3 style={{ marginBottom: '20px' }}>Order Details</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <FieldSelect
                label="Payment Method"
                options={[
                  { value: 'Cash', label: 'Cash' },
                  { value: 'PayNow', label: 'PayNow' },
                  { value: 'Bank Transfer', label: 'Bank Transfer' },
                  { value: 'Other', label: 'Other' },
                ]}
                value={paymentMethod}
                onChange={setPaymentMethod}
              />
              <FieldInput
                label="Payment Reference (Optional)"
                placeholder="e.g., TXN123456 or Account Number"
                value={paymentReference}
                onChange={setPaymentReference}
                helperText="Transaction ID, account number, or reference number"
              />
              <FieldSelect
                label="Payment Status"
                options={[
                  { value: 'UNPAID', label: 'Unpaid' },
                  { value: 'PAID', label: 'Paid' },
                ]}
                value={paymentStatus}
                onChange={(v) => setPaymentStatus(v as PaymentStatus)}
              />
              <div>
                <p className="text-small" style={{ fontWeight: 500, marginBottom: '6px' }}>Order Status</p>
                <p className="text-small" style={{ color: 'var(--text-secondary)' }}>
                  New orders start as <strong>Pending</strong>. Move them forward from the Orders page.
                </p>
              </div>
              <div>
                <p className="text-small" style={{ fontWeight: 500, marginBottom: '6px' }}>Notes</p>
                <textarea
                  style={textareaStyle}
                  placeholder="Anything to remember about this order"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div style={sectionCard}>
            <h3 style={{ marginBottom: '20px' }}>Order Summary</h3>
            <div className="text-small" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Items</span>
              <span>{lines.reduce((n, l) => n + l.quantity, 0)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px', marginBottom: '20px' }}>
              <h3>Total</h3>
              <h3>{formatMoney(total, store.currency)}</h3>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Button variant="primary" fullWidth disabled={busy || !customerName.trim()} onClick={submit}>
                {busy ? 'Creating…' : 'Create Order'}
              </Button>
              <Button variant="secondary" fullWidth onClick={() => onNavigate('orders-all')}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 1024px) {
          div[style*="grid-template-columns: 1.6fr 1fr"] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

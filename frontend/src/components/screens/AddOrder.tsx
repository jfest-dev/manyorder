import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../Button';
import { FieldInput, FieldSelect } from '../Field';
import { ordersApi, productsApi, ProductResponse, PaymentStatus } from '../../lib/api';
import { formatMoney } from '../../lib/currency';
import type { Store } from '../../App';

interface AddOrderProps {
  store: Store;
  onNavigate: (screen: string) => void;
}

interface Line {
  product: ProductResponse;
  quantity: number;
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
  background: 'var(--bg-card)', fontSize: '14px', fontFamily: 'inherit', outline: 'none',
};

export function AddOrder({ store, onNavigate }: AddOrderProps) {
  const storeId = Number(store.id);

  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [qty, setQty] = useState('1');
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
    () => lines.reduce((sum, l) => sum + l.product.price * l.quantity, 0),
    [lines],
  );

  const addLine = () => {
    const product = products.find((p) => String(p.id) === selectedProductId);
    const quantity = Math.max(1, parseInt(qty || '1', 10) || 1);
    if (!product) return;
    setLines((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        return prev.map((l) =>
          l.product.id === product.id ? { ...l, quantity: l.quantity + quantity } : l,
        );
      }
      return [...prev, { product, quantity }];
    });
    setSelectedProductId('');
    setQty('1');
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
        deliveryAddress: deliveryAddress.trim() || undefined,
        items: lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
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
              <div>
                <p className="text-small" style={{ fontWeight: 500, marginBottom: '6px' }}>Shipping Address</p>
                <textarea
                  style={textareaStyle}
                  placeholder="Leave empty for pickup orders"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                />
                <p className="text-xs" style={{ color: 'var(--text-muted)', marginTop: '4px' }}>
                  Filling this marks the order as Delivery.
                </p>
              </div>
            </div>
          </div>

          <div style={sectionCard}>
            <h3 style={{ marginBottom: '20px' }}>Order Items</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 110px', gap: '10px', alignItems: 'end', marginBottom: '16px' }}>
              <FieldSelect
                label="Product"
                placeholder={products.length ? 'Select a product' : 'No active products yet'}
                options={products.map((p) => ({
                  value: String(p.id),
                  label: `${p.name} — ${formatMoney(p.price, store.currency)}`,
                }))}
                value={selectedProductId}
                onChange={setSelectedProductId}
              />
              <FieldInput label="Qty" type="number" value={qty} onChange={setQty} />
              <Button variant="secondary" onClick={addLine} disabled={!selectedProductId}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                  <Plus size={15} /> Add
                </div>
              </Button>
            </div>

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
                    key={l.product.id}
                    className="text-small"
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}
                  >
                    <span style={{ flex: 1 }}>{l.product.name}</span>
                    <span style={{ width: '70px' }}>× {l.quantity}</span>
                    <span style={{ width: '110px', fontWeight: 600 }}>
                      {formatMoney(l.product.price * l.quantity, store.currency)}
                    </span>
                    <button
                      onClick={() => setLines((prev) => prev.filter((x) => x.product.id !== l.product.id))}
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
                  New orders start as <strong>Pending</strong> — move them forward from the Orders page.
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
    </div>
  );
}

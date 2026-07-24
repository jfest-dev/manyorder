import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '../Button';
import { FieldInput, FieldSelect } from '../Field';
import { OrderTypeToggle } from '../OrderTypeToggle';
import { ordersApi, productsApi, ProductResponse, OrderType, OrderStatus } from '../../lib/api';
import { formatMoney } from '../../lib/currency';
import type { Store } from '../../App';

interface EditOrderProps {
  store: Store;
  orderId: number;
  onNavigate: (screen: string) => void;
}

interface Line {
  productId: number;
  name: string;
  price: number;
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

/** Line items may only be changed while the order is still Pending or Confirmed. */
const ITEMS_EDITABLE: OrderStatus[] = ['PENDING', 'CONFIRMED'];

export function EditOrder({ store, orderId, onNavigate }: EditOrderProps) {
  const storeId = Number(store.id);

  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<OrderStatus>('PENDING');

  const [customerName, setCustomerName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [orderType, setOrderType] = useState<OrderType>('PICKUP');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [qty, setQty] = useState('1');
  const [busy, setBusy] = useState(false);

  const itemsEditable = ITEMS_EDITABLE.includes(status);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([ordersApi.get(storeId, orderId), productsApi.list(storeId, true)])
      .then(([order, prods]) => {
        if (!active) return;
        setProducts(prods);
        setStatus(order.status);
        setCustomerName(order.contactName || order.customerName || '');
        setEmail(order.contactEmail || '');
        setPhone(order.contactPhone || '');
        setOrderType(order.orderType);
        setDeliveryAddress(order.deliveryAddress || '');
        setNotes(order.notes || '');
        setLines(
          order.items.map((i) => ({
            productId: i.productId,
            name: i.productName,
            price: i.price,
            quantity: i.quantity,
          })),
        );
      })
      .catch((e) => alert(e?.message || 'Could not load order'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [storeId, orderId]);

  const total = useMemo(
    () => lines.reduce((sum, l) => sum + l.price * l.quantity, 0),
    [lines],
  );

  const addLine = () => {
    const product = products.find((p) => String(p.id) === selectedProductId);
    const quantity = Math.max(1, parseInt(qty || '1', 10) || 1);
    if (!product) return;
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) {
        return prev.map((l) =>
          l.productId === product.id ? { ...l, quantity: l.quantity + quantity } : l,
        );
      }
      return [...prev, { productId: product.id, name: product.name, price: product.price, quantity }];
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
      const updated = await ordersApi.update(storeId, orderId, {
        customerName: customerName.trim(),
        email: email.trim() || undefined,
        phoneNumber: phone.trim() || undefined,
        orderType,
        deliveryAddress:
          orderType === 'DELIVERY' && deliveryAddress.trim() ? deliveryAddress.trim() : undefined,
        notes: notes.trim() || undefined,
        // Omit items entirely when locked so the server leaves them untouched.
        ...(itemsEditable
          ? { items: lines.map((l) => ({ productId: l.productId, quantity: l.quantity })) }
          : {}),
      });
      alert(`Order #${updated.id} updated`);
      onNavigate('orders-all');
    } catch (e: any) {
      alert(e?.message || 'Could not update order');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div style={{ minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p className="text-small" style={{ color: 'var(--text-secondary)' }}>Loading order…</p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ marginBottom: '8px' }}>Edit Order #{orderId}</h1>
        <p className="text-small" style={{ color: 'var(--text-secondary)' }}>
          Update customer, delivery and order details
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
                    Switching to Pickup clears the address.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div style={sectionCard}>
            <h3 style={{ marginBottom: '20px' }}>Order Items</h3>

            {!itemsEditable && (
              <div
                className="text-small"
                style={{
                  border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-medium)',
                  padding: '12px 14px', marginBottom: '16px', background: 'var(--bg-card-subtle)',
                  color: 'var(--text-secondary)',
                }}
              >
                Items are locked once an order reaches Preparing. Contact and delivery details can still be edited.
              </div>
            )}

            {itemsEditable && (
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
            )}

            {lines.length === 0 ? (
              <div
                className="text-small"
                style={{
                  border: '1px dashed var(--border-strong)', borderRadius: 'var(--radius-medium)',
                  padding: '28px', textAlign: 'center', color: 'var(--text-muted)',
                }}
              >
                No line items on this order
              </div>
            ) : (
              <div>
                {lines.map((l) => (
                  <div
                    key={l.productId}
                    className="text-small"
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid var(--border-subtle)' }}
                  >
                    <span style={{ flex: 1 }}>{l.name}</span>
                    <span style={{ width: '70px' }}>× {l.quantity}</span>
                    <span style={{ width: '110px', fontWeight: 600 }}>
                      {formatMoney(l.price * l.quantity, store.currency)}
                    </span>
                    {itemsEditable ? (
                      <button
                        onClick={() => setLines((prev) => prev.filter((x) => x.productId !== l.productId))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error-color)', padding: '4px' }}
                      >
                        <Trash2 size={15} />
                      </button>
                    ) : (
                      <span style={{ width: '23px' }} />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={sectionCard}>
            <h3 style={{ marginBottom: '20px' }}>Notes</h3>
            <textarea
              style={textareaStyle}
              placeholder="Anything to remember about this order"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
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
                {busy ? 'Saving…' : 'Save Changes'}
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

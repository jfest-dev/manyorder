import { OrderStatus, PaymentStatus } from '../lib/api';

const ORDER_STATUS_STYLES: Record<OrderStatus, { bg: string; fg: string; label: string }> = {
  PENDING:          { bg: '#FEF3C7', fg: '#B45309', label: 'Pending' },
  CONFIRMED:        { bg: '#DBEAFE', fg: '#1D4ED8', label: 'Confirmed' },
  PREPARING:        { bg: '#E0E7FF', fg: '#4338CA', label: 'Preparing' },
  READY:            { bg: '#CFFAFE', fg: '#0E7490', label: 'Ready' },
  OUT_FOR_DELIVERY: { bg: '#FDE68A', fg: '#92400E', label: 'Out for delivery' },
  DELIVERED:        { bg: '#D1FAE5', fg: '#047857', label: 'Delivered' },
  COMPLETED:        { bg: '#D1FAE5', fg: '#047857', label: 'Completed' },
  CANCELLED:        { bg: '#FEE2E2', fg: '#B91C1C', label: 'Cancelled' },
};

const PAYMENT_STATUS_STYLES: Record<PaymentStatus, { bg: string; fg: string; label: string }> = {
  UNPAID:   { bg: '#FEF3C7', fg: '#B45309', label: 'Unpaid' },
  PAID:     { bg: '#D1FAE5', fg: '#047857', label: 'Paid' },
  REFUNDED: { bg: '#F3F4F6', fg: '#4B5563', label: 'Refunded' },
};

function Pill({ bg, fg, label }: { bg: string; fg: string; label: string }) {
  return (
    <span
      className="text-xs"
      style={{
        background: bg,
        color: fg,
        padding: '4px 10px',
        borderRadius: 'var(--radius-pill)',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return <Pill {...ORDER_STATUS_STYLES[status]} />;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Pill {...PAYMENT_STATUS_STYLES[status]} />;
}

export function orderStatusLabel(status: OrderStatus) {
  return ORDER_STATUS_STYLES[status].label;
}

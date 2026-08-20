import { formatMoney } from './currency';

/** One item line in a WhatsApp order message, with its chosen modifiers + note. */
export interface WaItem {
  quantity: number;
  productName: string;
  subtotal: number;
  modifiers?: { optionName: string }[];
  notes?: string | null;
}

/** One order's lines for a WhatsApp order message (checkout, lookup, or merchant→customer). */
export interface WaOrderSection {
  orderId: number;
  /** "Ready now" / "Pre-order" / null (single order). */
  label?: string | null;
  items: WaItem[];
  subtotal: number;
  deliveryFee: number;
  discountAmount: number;
  totalAmount: number;
}

export interface WaCombined {
  subtotal: number;
  deliveryFee: number;
  /** When true the fee is unresolved → the total is shown as an estimate. */
  deliveryFeePending?: boolean;
  discountAmount: number;
  discountCode?: string | null;
  totalAmount: number;
}

/**
 * The shared order body: per-order sections + combined money totals. Used by the
 * checkout confirmation, the order-lookup page, and the merchant "message
 * customer" flow, so a split order always reads the same everywhere.
 */
export function orderSummaryLines(sections: WaOrderSection[], currency: string, combined: WaCombined): string[] {
  const split = sections.length > 1;
  const lines: string[] = [];

  sections.forEach((o) => {
    lines.push(o.label ? `Order #${o.orderId}: ${o.label}` : `Order #${o.orderId}`);
    o.items.forEach((it) => {
      lines.push(`• ${it.quantity} × ${it.productName}: ${formatMoney(it.subtotal, currency)}`);
      // Sub-lines: the chosen modifiers, then the per-item note.
      if (it.modifiers && it.modifiers.length > 0) {
        lines.push(`    ↳ ${it.modifiers.map((m) => m.optionName).join(', ')}`);
      }
      if (it.notes && it.notes.trim()) lines.push(`    ↳ Note: ${it.notes.trim()}`);
    });
    if (split) lines.push(`Order total: ${formatMoney(o.totalAmount, currency)}`);
    lines.push('');
  });

  lines.push(`Subtotal: ${formatMoney(combined.subtotal, currency)}`);
  if (combined.deliveryFeePending) lines.push('Delivery fee: To be confirmed');
  else if (combined.deliveryFee > 0) lines.push(`Delivery fee: ${formatMoney(combined.deliveryFee, currency)}`);
  if (combined.discountAmount > 0) {
    lines.push(`Discount (${combined.discountCode}): ${formatMoney(combined.discountAmount, currency)} off`);
  }
  const totalLabel = combined.deliveryFeePending ? 'Estimated total' : split ? 'Combined total' : 'Total';
  lines.push(`${totalLabel}: ${formatMoney(combined.totalAmount, currency)}`);

  return lines;
}

/** Build a wa.me deep link to a phone with a pre-filled message, or null if no phone. */
export function waLink(phone: string | null | undefined, text: string): string | null {
  const digits = (phone ?? '').replace(/\D/g, '');
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

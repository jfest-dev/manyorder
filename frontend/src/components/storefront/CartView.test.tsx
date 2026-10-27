// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CartView } from './CartView';
import type { CartLine } from './storefrontTypes';
import type { StockAdjustment } from '../../lib/cart';

const line = {
  signature: 'p1',
  product: { id: 1, name: 'Latte', stock: 10, preOrder: false },
  quantity: 2,
  unitPrice: 5,
  lineSubtotal: 10,
  selectedOptions: [],
} as unknown as CartLine;

function renderCart(props: Partial<Parameters<typeof CartView>[0]> = {}) {
  const onCheckout = vi.fn();
  const onOpen = vi.fn();
  render(
    <CartView
      items={[line]}
      currency="SGD"
      onQtyChange={vi.fn()}
      onRemove={vi.fn()}
      onCheckout={onCheckout}
      onOpen={onOpen}
      onBack={vi.fn()}
      {...props}
    />,
  );
  return { onCheckout, onOpen };
}

beforeEach(() => cleanup());

describe('CartView checkout + background stock check', () => {
  it('shows an enabled Checkout button with no status text, and checks out immediately', async () => {
    const user = userEvent.setup();
    const { onCheckout } = renderCart();

    const btn = screen.getByRole('button', { name: 'Checkout' });
    expect((btn as HTMLButtonElement).disabled).toBe(false);
    expect(screen.queryByText(/Checking stock/i)).toBeNull();

    await user.click(btn);
    expect(onCheckout).toHaveBeenCalledTimes(1);
  });

  it('runs the background stock check once when the cart opens', () => {
    const { onOpen } = renderCart();
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('shows the cart-updated banner when a line was clamped to live stock', () => {
    const adj: StockAdjustment[] = [
      { productId: 1, name: 'Latte', previousQty: 5, newQty: 2, removed: false },
    ];
    renderCart({ stockAdjustments: adj });
    expect(screen.getByText('Your cart was updated')).toBeTruthy();
    expect(screen.getByText('Latte: 2 left')).toBeTruthy();
  });
});

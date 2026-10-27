// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

const storeDetail = vi.fn();
vi.mock('../../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/api')>();
  return { ...actual, adminApi: { ...actual.adminApi, storeDetail: () => storeDetail() } };
});

import { StoreHeader } from './StoreHeader';
import type { AdminMerchantSummary } from '../../lib/api';

const active: AdminMerchantSummary = {
  id: 7, name: 'Kiri Brew', slug: 'kiri', ownerName: 'Demo Merchant', ownerEmail: 'owner@kiri.test',
  status: 'ACTIVE', currency: 'SGD', createdAt: '2026-01-01T00:00:00', productCount: 0, orderCount: 0, customerCount: 0,
};

beforeEach(() => {
  cleanup();
  storeDetail.mockReset().mockResolvedValue({ profile: { phoneNumber: '+65 8123 4567' } });
});

describe('StoreHeader', () => {
  it('labels the store page link, owner (with copy) and WhatsApp contact', async () => {
    render(<StoreHeader summary={active} />);

    expect(screen.getByText('Platform admin view')).toBeTruthy();

    // Store page link to the public storefront, new tab, built from the site origin.
    const storeLink = screen.getByRole('link', { name: /\/kiri/ });
    expect(storeLink.getAttribute('href')).toContain('/kiri');
    expect(storeLink.getAttribute('target')).toBe('_blank');

    // Owner email with a copy button.
    expect(screen.getByText('owner@kiri.test')).toBeTruthy();
    expect(screen.getByLabelText('Copy owner email')).toBeTruthy();

    // Contact number (from the detail fetch) + WhatsApp link with digits only.
    expect(await screen.findByText('+65 8123 4567')).toBeTruthy();
    expect(screen.getByLabelText('Copy contact number')).toBeTruthy();
    const wa = screen.getByRole('link', { name: /Open in WhatsApp/ });
    expect(wa.getAttribute('href')).toBe('https://wa.me/6581234567');
    expect(wa.getAttribute('target')).toBe('_blank');
  });

  it('hides the store link for a suspended or archived store', async () => {
    render(<StoreHeader summary={{ ...active, status: 'SUSPENDED' }} />);
    expect(screen.getByText('Hidden from customers')).toBeTruthy();
    expect(screen.queryByRole('link', { name: /\/kiri/ })).toBeNull();
  });
});

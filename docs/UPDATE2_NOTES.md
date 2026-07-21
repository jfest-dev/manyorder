# Update 2 — Live Orders, Add Order, and Settings

## Why those screens "didn't work" before
Orders and Settings were still the design-system mockups. The order-status and
payment-status APIs already existed (the test suite exercised them); Settings
additionally needed a backend endpoint that didn't exist yet. Both are now wired.

## Backend
- `PATCH /merchant/stores/{storeId}` — store settings (owner-only): name, link
  slug (uniqueness re-checked → 409), email, phone, business type, currency,
  theme color, description, payment instruction, address (street/city/postal),
  and four notification preferences (senders arrive with the Resend update).
- Manual orders (`POST .../orders`) now accept line `items[]` (totals computed
  server-side from live prices), `paymentStatus`, `paymentMethod`,
  `paymentReference`, `notes`, and `deliveryAddress` (sets order type DELIVERY).
- `Order` gains `paymentMethod` / `paymentReference`; `Merchant` gains address
  + notification columns (with SQL defaults so `ddl-auto: update` upgrades an
  existing database in place — no recreate needed).
- Tests: 4 new (settings persist, staff 403 on settings, slug-conflict 409,
  order-with-items total math) → 17 total.

## Frontend
- **Orders**: live list with search, the full 8-status filter tabs with counts,
  expandable rows (items, contact, payment info, notes), one-click status
  advancement following the state machine (invalid moves never shown; the API
  still enforces), payment UNPAID/PAID/REFUNDED toggle, CSV export, currency
  formatting per store (S$5.50 / Rp 25.000).
- **Add Order**: customer info, product picker from the live catalog with
  quantities, shipping address (auto-marks Delivery), payment method/reference,
  payment status, notes, computed total, creates through the API.
- **Settings**: loads and saves real store data including store link (slug),
  currency, theme color, address, and notification toggles. The
  marketing-tips and daily-summary toggles from the reference shots are
  intentionally dropped (out of scope). Logo upload arrives with Cloudinary.
- Supabase shim now only serves the Sidebar sign-out delegation.

## Still mock (coming next)
Dashboard analytics, Products suite (with category/stock/SKU/photos),
public storefront + checkout pages, Customers, Marketing, admin panel.

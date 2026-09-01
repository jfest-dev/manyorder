# Backlog

Planned work, not yet built.

## Owner-initiated staff invites

Staff is a real role today, with working permissions, server- and client-side
RBAC enforcement, and login. But there is no way for a merchant to create a
staff account from the app. The public sign-up form only creates merchants, and
Settings has no staff/team management. The backend can create a staff user via
`POST /auth/register` with `role=STAFF` and the store's slug as a code, but
nothing in the UI triggers it, so the only staff account is the seeded
`staff@manyorder.com`.

Add an owner-initiated invite flow in the dashboard (e.g. under Settings) so a
merchant can add staff to their own store, replacing the self-service
store-code sign-up path.

## Expired pre-order ready dates

Pre-order ready dates are now validated as today-or-later on save, but nothing
handles a date that passes afterward. When a pre-order's ready date goes by
without the merchant updating it, nothing happens automatically: no expiry, no
merchant alert, and no storefront change. The product just keeps showing its
stale past date and the "Pre-order" badge until someone edits it.

Handle expiry later, for example auto-hide the pre-order badge once the ready
date is past (falling back to normal in-stock / out-of-stock display), and/or
alert the merchant so they can update or clear the pre-order.

## Seller gamification to replace the raw sold count

The storefront header used to show a plain "X sold" count. It is now hidden
(the underlying tally on the store, totalItemsSold, is still tracked). Replace
it later with a gamification or status system based on real sales thresholds,
for example earned badges or tiers such as "Bestseller", rather than surfacing
a raw number. Decide the thresholds and tiers, then show the earned badge on
the storefront in place of the old count.

## Inventory needs a genuinely distinct purpose

The Inventory screen is now wired to real data (read-only stock levels, value,
status and sold counts), which is honest, but it duplicates the Products screen
almost one to one. It needs a genuinely distinct purpose, not decided yet.
Ideas to consider later:

- Restock action-list: show only items needing attention (low or out) with a
  quick restock action, instead of the full catalogue.
- Cross-store inventory view: Products is per-store, so Inventory could
  aggregate stock across all of a merchant's stores.
- Stock movement log: what changed and when, not just current levels.
- Fast bulk stock-take mode: update many quantities quickly in one pass.

This needs proper product thinking, not a rushed decision.

## Deeper inventory / cost tracking

The standalone Inventory screen has been removed (its finished-goods stock
summary now lives on the All Products screen). A genuinely deeper inventory
feature is still worth building later. The shared foundation across F&B and
retail would be cost price and margin tracking: record each product's cost
alongside its selling price so the app can show margin per item and overall.
As a possible F&B-specific extension on top of that, ingredient and recipe
tracking (cost by ingredient, stock drawn down per sale). Not scoped in
detail, just captured for later thinking.

## Storefront promo display

Discounts today are code-only: a customer must know and type a code at
checkout. A larger, customer-facing feature would surface active promotions
on the storefront itself, similar to GrabFood and other e-commerce patterns,
so shoppers discover them without a code. This could include category-linked
badges, promo banners at the top of the shop, minimum-spend thresholds, and
tying a discount to specific products or categories. It is a genuinely large
feature and needs its own proper scoping session later. Not scoped now.

## Product-specific discounts

Let a discount code apply only to certain products instead of the whole
order. Investigated; it is a real, separate build session touching checkout
math. Findings and the changes needed:

- Data model: add an optional Discount-to-Product link (a discount_products
  join table / ManyToMany). Empty set = store-wide (today's behavior);
  non-empty = applies only to those products. Existing discounts get no rows,
  so they stay store-wide. This is an optional, non-breaking scope, not a
  breaking change.
- Checkout math: today the discount is computed against the whole combined
  subtotal (DiscountService.computeAmount). Change it to compute a
  "discountable subtotal" = the sum of line totals whose product is in the
  discount's set (or all lines when store-wide), then apply the percentage or
  the fixed amount capped at that matching subtotal. Reorder the redeem flow
  so the discount's scope is known before the amount is computed, and reject a
  code that matches nothing in the cart.
- Split-order (ready + pre-order): today the combined discount is allocated to
  the two linked orders by full-subtotal share. Change it to allocate by each
  bucket's matching-subtotal share (remainder to the second bucket so they sum
  exactly), so a code matching only pre-order items puts the whole discount on
  that order. Store-wide codes are unchanged.
- Public "Apply code" validate endpoint would need the cart items (not just a
  trusted subtotal) to preview the matching subtotal server-side.
- Frontend: a real product multi-select "Applies to" in the Marketing form
  (the genuine version of the targeting UI removed from the mock).

Needs its own build session; not scoped further here.

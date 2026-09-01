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

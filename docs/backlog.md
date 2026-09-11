# Backlog

Planned work, not yet built.

## Deployment note: adding a value to a database-backed enum under ddl-auto

This is a recurring migration gotcha, not a one-off. It applies to **any** future
enum value added to a `@Enumerated(EnumType.STRING)` column, not just the one
instance below.

When Hibernate first creates a table, it generates a CHECK constraint that
enumerates the enum's current values (e.g. on `discounts.type`:
`CHECK (type IN ('PERCENTAGE','FIXED'))`). Our schema management is
`ddl-auto: update`, which adds new columns but does **not** alter or drop that
existing check constraint. So after adding a new enum constant in Java, every
environment whose table predates the change still has the old constraint and
will reject rows using the new value with:
`new row for relation "<table>" violates check constraint "<table>_<col>_check"`.

Tests don't catch it: the H2 test database is rebuilt from scratch each run, so
its constraint always includes the new value.

**Whenever a new value is added to a DB-backed enum, do this per environment
(dev, staging, prod) as part of the deploy:** drop (or update) the stale check
constraint on that column, e.g.
`ALTER TABLE <table> DROP CONSTRAINT <table>_<col>_check;`
Hibernate does not re-add it on `update`, so dropping it is sufficient; the app
still validates the enum. (First seen when adding `FREE_DELIVERY` to
`DiscountType`; the dev `discounts_type_check` had to be dropped by hand.)

Longer term, consider adopting real migrations (Flyway/Liquibase) or disabling
Hibernate's enum check-constraint generation, so enum additions stop needing a
manual per-environment step.

## Tiered automatic delivery discount by cart spend

A spend-scaled delivery discount that needs no code and no merchant action at
checkout: as the cart subtotal grows it unlocks progressively bigger delivery
savings across multiple tiers, e.g. spend $50 → 20% off delivery, spend $100 →
delivery fully free, with as many tiers in between as the merchant configures.

This is genuinely distinct from what already exists:

- The **free-delivery threshold** (`Merchant.freeDeliveryThreshold`) is a single
  on/off binary: below the amount you pay the full fee, at/above it delivery is
  free. No intermediate steps, one threshold only.
- The **FREE_DELIVERY voucher** (code-based, built this session) is always 100%
  off, requires the customer to enter a code, and has no spend condition (only
  the optional generic min-spend gate).

The tiered version is automatic (no code), applies a percentage that scales, and
supports multiple thresholds. Needs its own investigation and a dedicated
session:

- Data model for an ordered list of tiers per store (spend threshold →
  delivery discount percent, 0-100), replacing or subsuming the single
  freeDeliveryThreshold.
- Checkout logic to pick the highest tier the cart subtotal qualifies for and
  apply that percent to the delivery fee (interacting with the existing
  fee / TBC / already-free states and the split-order allocation).
- A Settings UI for the merchant to add, edit, order, and remove tiers.

Not scoped in detail here.

## Multi-language support (i18n): English + Bahasa Indonesia

Deliberately deferred until after the Sept 30 deadline, likely tied to actual
Indonesia market entry. Scope is English and Bahasa Indonesia specifically,
matching the real markets (Singapore now, Indonesia planned), not a general
any-language framework. The storefront (customer-facing) matters more long-term
than the merchant dashboard, but neither is needed for the current deadline.

Real scope if pursued:

- UI strings: every hardcoded string across the app has to be extracted into a
  translation dictionary / i18n system, on both the storefront and the merchant
  dashboard. This is broad, touch-everything work.
- A language switcher in the UI.
- A decision on where the language preference lives: per-user vs per-store.
- Separate, harder problem: merchant-entered content (e.g. product
  descriptions) is not covered by a UI translation system at all. It would need
  either manual dual-language entry by the merchant or an AI-translation step,
  which is its own distinct design decision.

A genuine multi-day undertaking. Not built now.

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

## Expired pre-order ready dates (priority bumped)

Pre-order ready dates are now validated as today-or-later on save, but nothing
handles a date that passes afterward. When a pre-order's ready date goes by
without the merchant updating it, nothing happens automatically: no expiry, no
merchant alert, and no storefront change. The product just keeps showing its
stale past date and the "Pre-order" badge until someone edits it.

Handle expiry later, for example auto-hide the pre-order badge once the ready
date is past (falling back to normal in-stock / out-of-stock display), and/or
alert the merchant so they can update or clear the pre-order.

Priority raised (2026-09-10): this is already biting in the test suite. Three
ProductIntegrationTest cases hardcode a pre-order ready date of 2026-09-01 and
now fail every run because that date is in the past, so the today-or-later
validation rejects it (400). It will keep recurring and worsen as time passes.
As part of this work, make the affected tests use a relative future date
(e.g. today plus a margin) instead of a hardcoded one, so the suite stays green
over time.

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

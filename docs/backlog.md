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

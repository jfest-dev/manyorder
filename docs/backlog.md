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

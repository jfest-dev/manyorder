# Batch 0 + 1 — Engineering Notes

## What shipped

**Batch 0 (skeleton & hygiene)**
- Monorepo: `backend/` (from orderlite-api, superset codebase) + `frontend/` (ManyOrder UI design system).
- Removed vestigial code: `payment/`, `shipping/`, `refund/` packages, `CustomerOrderController` + the customer self-service order flow, `MerchantProfileController` trio (superseded by `/merchant/stores`), dead `CustomUserDetailsService`, `TestPassword`.
- `paymentStatus` is now a real enum: `UNPAID | PAID | REFUNDED`.
- No `.env`, no `target/`, no jars anywhere in the tree — verified. `.env.example` ships placeholders only.
- Idempotent `DataSeeder`: KiriKiri Brew (slug `kirikiri-brew`, SGD, #0F172A) + 4 products, 2 customers, 3 orders, and the three demo accounts.

**Batch 1 (auth, RBAC, multi-store)**
- Roles: `MERCHANT`, `STAFF`, `PLATFORM_ADMIN` (admin flagged via SQL only; self-registration returns 400).
- Staff signup binds to one store via **store code = store slug** (decision 1); `staffStoreId` returned at login.
- JWT now carries `uid` + `role`; 24h expiry unchanged.
- IDOR systematically closed: every store-scoped endpoint resolves `Merchant` through `StoreAccessService` (owner or member), including the previously-unscoped **payment-status update**. Foreign/missing stores return 404 to prevent ID probing.
- Multi-store: cap 3 per owner (409 past the cap), unique slugs (explicit slug conflict → 409; derived slugs auto-suffix `-2`, `-3`).
- Google Sign-In (env-gated by `GOOGLE_CLIENT_ID`): SPA gets the client id from `GET /auth/config` and hides the button when blank; backend verifies the ID token via Google tokeninfo + audience check, creates/logs in a MERCHANT.
- Frontend: React Router shell (`/signin`, `/register`, `/store-signin`, protected `/app`), JWT auth context with remember-me (local vs session storage), REST API client, currency util (`S$5.50` / `Rp 25.000`), new Sign In + Create Account screens, REST-wired Sign In to Store with slug branding, AllStores with `N / 3` counter + capped Create button, onboarding wizard now **account-first** (spec Module 1/2) and creates the store through the API.

## Route table (Batch 1 surface)

| Method | Path | Access |
|---|---|---|
| POST | `/auth/register` | public (MERCHANT or STAFF + storeSlug) |
| POST | `/auth/login` | public |
| POST | `/auth/google` | public (503 when unconfigured) |
| GET | `/auth/config` | public |
| GET | `/public/stores/{slug}` | public |
| GET | `/public/storefront/{merchantId}/products` | public |
| POST | `/public/checkout` | public (per-store customer dedup) |
| GET/POST | `/merchant/stores` | MERCHANT (owner) |
| GET | `/merchant/stores/{id}` | owner or bound staff |
| GET | `/merchant/stores/{id}/orders[?status=]` | owner or staff |
| GET | `/merchant/stores/{id}/orders/{orderId}` | owner or staff |
| POST | `/merchant/stores/{id}/orders` | owner only |
| PATCH | `/merchant/stores/{id}/orders/{orderId}/status` | owner or staff |
| PATCH | `/merchant/stores/{id}/orders/{orderId}/payment-status` | owner or staff |
| GET | `/merchant/stores/{id}/products[?activeOnly]` | owner or staff |
| POST/PATCH | `/merchant/stores/{id}/products...` | owner only |
| GET | `/admin/orders...` | PLATFORM_ADMIN |

Cancellation is a status PATCH to `CANCELLED` — allowed from every state except `COMPLETED` (decision 7) and `CANCELLED` itself; `DELIVERED → CANCELLED` stays open for refund flows. No-op transitions are rejected.

## Tests (`./mvnw test`, H2 in PostgreSQL mode)

- `AuthAndRbacIntegrationTest` — register/login, duplicate email 409, PLATFORM_ADMIN self-registration 400, staff store-code binding, cross-merchant 404s (incl. the old payment-status hole), staff permission matrix, admin gate, 3-store cap + slug uniqueness.
- `OrderLifecycleIntegrationTest` — state-machine chain, COMPLETED→CANCELLED rejected, DELIVERED→CANCELLED allowed, guest checkout dedups customers per store.

Java can't compile in the build container (no Maven Central egress), so run `./mvnw test` locally as the final gate.

## Screenshot-driven deltas already applied

- Header tagline → "Create your online order page in minutes" (no WhatsApp-ordering path).
- Seed data mirrors the reference shots (KiriKiri Brew, Iced White S$5.50, Cold Brew S$6.00).
- AllStores gains the `N / 3` counter and disabled Create at cap.
- `FEATURES.PRO_ENABLED` stays `false` (sidebar upgrade button hidden).

## Known state / deferred to later batches

- **Supabase shim** (`src/lib/supabase.ts`): `Settings` (store update) and the Sidebar sign-out still import it. Sign-out is delegated to the real JWT logout; Settings writes fail gracefully until its Batch 4 rewire. Migrate then delete the shim.
- Dashboard / Orders / Products / Customers / Marketing screens still render design-system mock data — wired in Batches 3–4. Hardcoded "PRO" badges inside Marketing.tsx are removed with its Batch 4 rewrite.
- Onboarding step 2 collects draft products locally; they persist to the Products API in Batch 2 (needs category/stock schema first).
- AppShell "Preview store page" / "Copy store link" still derive the slug from the store *name*; switch to the real `slug` field with the Batch 2 storefront.
- Staff UX: the sidebar isn't role-aware yet (blocked screens alert + API returns 403); proper role-aware nav lands in Batch 3.
- Fresh database recommended: `merchants.slug` is `NOT NULL UNIQUE`, so `ddl-auto: update` against a DB with pre-existing rows would fail. The old dev DB is being retired with the credential rotation anyway.

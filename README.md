# ManyOrder

Multi-store ordering platform for small F&B businesses — create a store, share
one link, and manage orders, products, and customers from a single dashboard.

**Stack:** Java 21 · Spring Boot 4 · PostgreSQL · JWT · React 18 · Vite · TypeScript

## Monorepo layout

| Path        | What it is                                   |
|-------------|----------------------------------------------|
| `backend/`  | Spring Boot REST API (`com.manyorder.api`)   |
| `frontend/` | React dashboard + storefront SPA             |
| `docs/`     | Build notes per batch                        |

## Quick start

### 1. Backend

```bash
cd backend
cp .env.example .env       # fill in real values — see Security below
export $(grep -v '^#' .env | xargs)
./mvnw spring-boot:run     # http://localhost:8080  (Swagger: /swagger-ui.html)
```

On first run the seeder creates a demo store (**KiriKiri Brew**) with products,
customers, and orders:

| Account | Email | Password |
|---|---|---|
| Merchant (owner) | hello@manyorder.com | password123 |
| Staff (bound to store) | staff@manyorder.com | password123 |
| Platform admin | admin@manyorder.com | password123 |

### 2. Tests

```bash
cd backend
./mvnw test                # integration tests run on in-memory H2
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev                # http://localhost:3000
```

## Security notes

- **Never commit `.env`.** Only `.env.example` with placeholders belongs in git.
- Credentials exposed in any previous archive/repo must be **rotated**
  (database password + `JWT_SECRET`) before this codebase goes anywhere public.
- Every store-scoped endpoint resolves the caller from the JWT and verifies
  store ownership/membership server-side (`StoreAccessService`) — client-supplied
  merchant IDs are never trusted.
- `PLATFORM_ADMIN` cannot be self-registered. Promote manually:
  `UPDATE users SET role = 'PLATFORM_ADMIN' WHERE email = '...';`

## Roadmap (build batches)

- [x] **Batch 0–1** — monorepo skeleton, RBAC (MERCHANT / STAFF / PLATFORM_ADMIN),
  multi-store (max 3), staff store-code signup, Google sign-in (env-gated),
  JWT hardening + IDOR fixes, seeder, integration tests
- [ ] **Batch 2** — Create-store wizard alignment, public storefront + checkout,
  product schema (category / stock / SKU / image via Cloudinary)
- [ ] **Batch 3** — Dashboard analytics, Orders suite (8-status flow), Products suite
- [ ] **Batch 4** — Customers, Marketing (discount codes), Stores & Settings,
  platform admin panel, Resend email notifications (env-gated)

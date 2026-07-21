# ManyOrder

Multi-store ordering platform for small F&B businesses — create a store, share
one link, and manage orders, products, and customers from a single dashboard.

**Stack:** Java 21 · Spring Boot 4 · PostgreSQL · JWT · React 18 · Vite · TypeScript

## Monorepo layout

| Path        | What it is                                   |
|-------------|-----------------------------------------------|
| `backend/`  | Spring Boot REST API (`com.manyorder.api`)   |
| `frontend/` | React dashboard + storefront SPA             |
| `docs/`     | Build notes per development phase            |

## Quick start

### 1. Database (PostgreSQL)

The backend needs a running Postgres instance before it will start. The
easiest way locally is Docker:

```bash
docker run --name manyorder-postgres \
  -e POSTGRES_USER=manyorder \
  -e POSTGRES_PASSWORD=your-password \
  -e POSTGRES_DB=manyorder \
  -p 5433:5432 \
  -d postgres:16
```

(Already have a Postgres container from a previous run? Just make sure it's
running: `docker ps`, and if not, `docker start <container-name>`.)

### 2. Backend

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

### 3. Tests

```bash
cd backend
./mvnw clean test          # integration tests run on in-memory H2, not your Postgres
```

### 4. Frontend

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

## Progress

- [x] **Foundation** — accounts, roles (MERCHANT / STAFF / PLATFORM_ADMIN),
  multi-store (max 3), JWT + IDOR hardening, Google sign-in (env-gated),
  seed data, integration test suite
- [x] **Orders** — live list with search & 8-status filters, expandable detail
  view, one-click status advancement following the order state machine,
  payment status toggle, manual order entry with line items, CSV export
- [x] **Store settings** — store details, address, currency, theme, and
  notification preferences, all persisted
- [ ] Owner-initiated staff invites (replacing self-service store-code signup)
- [ ] Public storefront + guest checkout page
- [ ] Full product catalog — categories, stock tracking, SKU, photo uploads (Cloudinary)
- [ ] Customers management + broadcast
- [ ] Marketing — discount codes
- [ ] Platform admin panel
- [ ] Email notifications (Resend)

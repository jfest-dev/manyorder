# ManyOrder

Multi-store ordering platform for small F&B and retail businesses. A merchant
creates a store, shares one link, and manages products, orders, and customers
from a dashboard; customers order from a public storefront.

**Stack:** Java 21, Spring Boot 4, PostgreSQL, React 18, Vite, TypeScript. Auth is JWT.

`backend/` is the REST API; `frontend/` is the dashboard + storefront SPA.

## Running it

You need JDK 21, Node 18+, and Docker (or any PostgreSQL).

### 1. PostgreSQL

```bash
docker run --name manyorder-db \
  -e POSTGRES_USER=manyorder \
  -e POSTGRES_PASSWORD=manyorder \
  -e POSTGRES_DB=manyorder \
  -p 5432:5432 -d postgres:16
```

The username, password, and database name must match `SPRING_DATASOURCE_*` in the
backend `.env`.

### 2. Backend

```bash
cd backend
cp .env.example .env          # set the DB url/username/password and a JWT_SECRET
set -a; source ./.env; set +a
./mvnw spring-boot:run        # http://localhost:8080
```

Cloudinary (product/store photos) and Google sign-in are optional; leave their
`.env` values blank to disable.

### 3. Frontend

```bash
cd frontend
cp .env.example .env          # defaults to http://localhost:8080
npm install
npm run dev                   # http://localhost:3000
```

## Demo data

On an empty database the seeder creates three stores, all owned by the merchant
account:

| Store | Type | Storefront |
|---|---|---|
| Kiri Brew | Coffee | http://localhost:3000/kirikiri-brew |
| Seoul & Sakura | Japanese/Korean | http://localhost:3000/seoul-sakura |
| PixelForge | Gaming/tech | http://localhost:3000/pixelforge |

Each store has categories, products (photos, descriptions, add-on modifiers, and
a mix of in-stock, sold-out, and pre-order items), and a few sample orders.

Sign in to the dashboard at http://localhost:3000:

| Role | Email | Password |
|---|---|---|
| Merchant (owns all three stores) | hello@manyorder.com | password123 |
| Staff (Kiri Brew) | staff@manyorder.com | password123 |
| Platform admin | admin@manyorder.com | password123 |

## Tests

```bash
cd backend && ./mvnw test     # runs on in-memory H2, not your Postgres
cd frontend && npm test
```

## Notes

- Never commit `.env` — only `.env.example` belongs in git.
- `PLATFORM_ADMIN` can't be self-registered. Promote a user directly:
  `UPDATE users SET role = 'PLATFORM_ADMIN' WHERE email = '...';`
- Deploying beyond dev? See [`docs/deployment-notes.md`](docs/deployment-notes.md)
  for a required manual migration.

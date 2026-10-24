# ManyOrder

Multi-store online ordering for small F&B and retail: a merchant creates a store, shares one link, and runs products, orders, and customers from a dashboard, while customers order from a public storefront.

**Live shop (no login needed):** https://manyorder.app/kirikiri-brew

A guided demo is available on request.

## Tech stack

- Backend: Java 21, Spring Boot 4, PostgreSQL, JPA/Hibernate, JWT auth
- Frontend: React 18, TypeScript, Vite
- Infrastructure: Railway (API + managed Postgres), Cloudflare (domain, DNS, cookieless analytics), Cloudinary (images), Resend (email)

**Tests:** 410 backend and 291 frontend automated tests.

## Highlights

- **Concurrency-safe stock decrement** - atomic inventory updates that prevent overselling when customers check out at the same time.
- **N+1 query fix** - storefront product list cut from 23 to 6 database queries, and about 70% faster in production measurements.
- **Discount engine** - percentage and fixed codes with order, product, and delivery scopes, plus validation and stacking rules.
- **Role-based access** - Merchant, Staff, and Platform Admin, with an admin who is read-only apart from suspending stores, hiding products and switching off discounts, and every action written to an audit log.
- **Private order tracking** - unguessable per-order tracking tokens, with rate limiting on public endpoints.
- **Production deployment** - live on Railway with managed Postgres, Cloudinary image delivery, and transactional email.

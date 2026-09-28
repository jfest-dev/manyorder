# Deployment notes

There is no migration tool (Flyway/Liquibase) in this project. A fresh database
builds its schema from the JPA entity mappings on startup, but an existing
database is never altered automatically, so any schema change must be applied by
hand before deploying the code that depends on it.

## Pending manual migrations

### `order_items`: product-name snapshot + nullable product

Products can be permanently deleted; order history survives via a name snapshot
on each order line. Before deploying that code to a database that already holds
data, run:

```sql
ALTER TABLE order_items ADD COLUMN product_name varchar(255);
UPDATE order_items oi SET product_name = p.name FROM products p WHERE oi.product_id = p.id;
ALTER TABLE order_items ALTER COLUMN product_name SET NOT NULL;
ALTER TABLE order_items ALTER COLUMN product_id DROP NOT NULL;
```

Fresh databases and the dev database already have this; only existing
staging/prod databases need it.

### `discounts`: optional name column

The Marketing screen lets a merchant give a discount a friendly label beyond
its code. The column is nullable, so existing discounts are unaffected. Before
deploying to a database that already holds data, run:

```sql
ALTER TABLE discounts ADD COLUMN name varchar(255);
```

Fresh databases and the dev database (Hibernate ddl-auto: update) already have
this; only existing staging/prod databases need it.

### Demo merchant contact email (rebrand to manyorder.app)

The seeded demo merchant's contact email (used as the "to" for new-order alerts)
moved from `hello@manyorder.com` to `manyorder.app@gmail.com`. Fresh seeds already
use the new address; a database seeded before that change still holds the old one.
Run once, keyed on the old value so it is safe to re-run and a no-op if already done:

```sql
UPDATE merchants SET email = 'manyorder.app@gmail.com' WHERE email = 'hello@manyorder.com';
```

(The matching demo login account in `users` was likewise moved off
`hello@manyorder.com`; update it separately if a given environment still has it.)

## Granting the platform-admin role

The `PLATFORM_ADMIN` role cannot be assigned through sign-up. Grant it directly
in the database:

```sql
UPDATE users SET role = 'PLATFORM_ADMIN' WHERE email = '...';
```

## Deploy checklist

Environment variables to set in each environment (see `backend/.env.example`
for the full list). Not exhaustive; call out the ones easy to miss:

- `MAIL_FROM` — the "From" address for all transactional email (verification,
  new-order, low-stock, password reset). Production value:
  `ManyOrder <no-reply@manyorder.app>` (domain verified in Resend). When unset it
  falls back to `onboarding@resend.dev`, so email will send from the wrong sender
  if this is missed.
- `RESEND_API_KEY` — leave unset to disable outbound email (sends become no-ops).

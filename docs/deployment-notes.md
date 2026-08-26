# Deployment notes

There is no migration tool (Flyway/Liquibase) in this project. A fresh database
builds its schema from the JPA entity mappings on startup, but an existing
database is never altered automatically — any schema change must be applied by
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

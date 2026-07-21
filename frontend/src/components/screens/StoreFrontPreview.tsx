import { Button } from "../Button";
import { Card } from "../Card";

type Store = {
  id: string;
  name: string;
  slug: string;
  color: string;
  logo?: string;
  currency?: string;
};

type Product = {
  id: string;
  name: string;
  description?: string | null;
  price_cents?: number;
};

export function StorefrontPreview({
  store,
  products,
  onBack,
}: {
  store: Store;
  products: Product[];
  onBack: () => void;
}) {
  const currencySymbol = store.currency === "idr" ? "Rp" : "S$";
  const formatPrice = (cents: number) => {
    if (store.currency === "idr") return `${currencySymbol}${Math.round(cents * 10000).toLocaleString("id-ID")}`;
    return `${currencySymbol}${(cents / 100).toFixed(2)}`;
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h1 style={{ marginBottom: 4 }}>Storefront Preview</h1>
          <div className="text-small" style={{ color: "var(--text-secondary)" }}>
            manyorder.app/{store.slug}
          </div>
        </div>
        <Button variant="secondary" onClick={onBack}>Back</Button>
      </div>

      <Card>
        <div
          style={{
            padding: 16,
            borderRadius: 12,
            background: store.color || "#000",
            color: "white",
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 700 }}>{store.name}</div>
          <div style={{ opacity: 0.9, fontSize: 13 }}>Order from this store</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {products.length === 0 ? (
            <div className="text-small" style={{ color: "var(--text-secondary)" }}>
              No products yet. Add products to see them here.
            </div>
          ) : (
            products.map((p) => (
              <div
                key={p.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: 12,
                  border: "1px solid var(--border-subtle)",
                  borderRadius: 10,
                  background: "var(--bg-card)",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>{p.name}</div>
                  {p.description ? (
                    <div className="text-xs" style={{ color: "var(--text-muted)", marginTop: 2 }}>
                      {p.description}
                    </div>
                  ) : null}
                </div>
                <div style={{ fontWeight: 700 }}>
                  {formatPrice(p.price_cents ?? 0)}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}

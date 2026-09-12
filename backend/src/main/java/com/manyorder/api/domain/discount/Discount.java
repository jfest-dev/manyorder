package com.manyorder.api.domain.discount;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

import com.manyorder.api.domain.merchant.Merchant;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

/**
 * A per-store, order-level discount code. Codes are stored normalised to upper
 * case so uniqueness within a store is effectively case-insensitive. usageLimit
 * null = unlimited (reusable); 1 = single-use; N = capped at N redemptions.
 */
@Entity
@Table(name = "discounts", uniqueConstraints = @UniqueConstraint(columnNames = {"merchant_id", "code"}))
public class Discount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(optional = false, fetch = FetchType.LAZY)
    @JoinColumn(name = "merchant_id", nullable = false)
    private Merchant merchant;

    @Column(nullable = false)
    private String code;

    /** Optional friendly label shown in the dashboard; the code is the identity. */
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DiscountType type;

    /** Percent (1–100) for PERCENTAGE, or a currency amount for FIXED.
     *  Column named to avoid the reserved word "value" (H2/SQL). */
    @Column(name = "discount_value", nullable = false)
    private BigDecimal value;

    /** Total redemptions allowed. Null = unlimited. */
    private Integer usageLimit;

    /**
     * Minimum cart subtotal required to use the code. Null = no minimum. Checked
     * against the whole cart's product subtotal (pre-discount, pre-delivery),
     * independent of any product scope.
     */
    @Column(name = "min_spend")
    private BigDecimal minSpend;

    @Column(nullable = false, columnDefinition = "integer default 0 not null")
    private int usedCount = 0;

    /** Optional validity window; null bound = open-ended on that side. */
    private LocalDateTime startsAt;
    private LocalDateTime endsAt;

    @Column(nullable = false, columnDefinition = "boolean default true not null")
    private boolean active = true;

    /**
     * When true, the code is valid only for a customer with no prior (non-cancelled)
     * order at this store. SQL default backfills existing rows as false.
     */
    @Column(nullable = false, columnDefinition = "boolean default false not null")
    private boolean firstOrderOnly = false;

    /**
     * Whether this code may combine with an active product sale price. Default
     * false (safe): the discount skips on-sale lines unless the merchant opts in.
     * Ignored for FREE_DELIVERY (it discounts delivery, not products).
     */
    @Column(nullable = false, columnDefinition = "boolean default false not null")
    private boolean canStackWithSale = false;

    /**
     * Product ids this discount is limited to. Empty = store-wide (applies to
     * the whole order, the original behaviour). Stored as plain ids rather than
     * a Product association so deleting a product never breaks a discount or its
     * join rows: a stale id simply stops matching anything in the cart.
     */
    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "discount_products", joinColumns = @JoinColumn(name = "discount_id"))
    @Column(name = "product_id", nullable = false)
    private Set<Long> productIds = new HashSet<>();

    private LocalDateTime createdAt;

    protected Discount() {
        // JPA only
    }

    public Discount(Merchant merchant, String code, DiscountType type, BigDecimal value,
                    Integer usageLimit, LocalDateTime startsAt, LocalDateTime endsAt, boolean active) {
        this.merchant = merchant;
        this.code = code;
        this.type = type;
        this.value = value;
        this.usageLimit = usageLimit;
        this.startsAt = startsAt;
        this.endsAt = endsAt;
        this.active = active;
        this.createdAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public Merchant getMerchant() { return merchant; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public DiscountType getType() { return type; }
    public void setType(DiscountType type) { this.type = type; }
    public BigDecimal getValue() { return value; }
    public void setValue(BigDecimal value) { this.value = value; }
    public Integer getUsageLimit() { return usageLimit; }
    public void setUsageLimit(Integer usageLimit) { this.usageLimit = usageLimit; }
    public BigDecimal getMinSpend() { return minSpend; }
    public void setMinSpend(BigDecimal minSpend) { this.minSpend = minSpend; }
    public int getUsedCount() { return usedCount; }
    public void setUsedCount(int usedCount) { this.usedCount = usedCount; }
    public LocalDateTime getStartsAt() { return startsAt; }
    public void setStartsAt(LocalDateTime startsAt) { this.startsAt = startsAt; }
    public LocalDateTime getEndsAt() { return endsAt; }
    public void setEndsAt(LocalDateTime endsAt) { this.endsAt = endsAt; }
    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }
    public boolean isFirstOrderOnly() { return firstOrderOnly; }
    public void setFirstOrderOnly(boolean firstOrderOnly) { this.firstOrderOnly = firstOrderOnly; }
    public boolean isCanStackWithSale() { return canStackWithSale; }
    public void setCanStackWithSale(boolean canStackWithSale) { this.canStackWithSale = canStackWithSale; }
    public Set<Long> getProductIds() { return productIds; }
    public void setProductIds(Set<Long> productIds) {
        this.productIds = productIds == null ? new HashSet<>() : new HashSet<>(productIds);
    }
    /** True when the discount applies to the whole order (no product limit set). */
    public boolean isStoreWide() { return productIds == null || productIds.isEmpty(); }
    public LocalDateTime getCreatedAt() { return createdAt; }
}

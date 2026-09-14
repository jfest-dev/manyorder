package com.manyorder.api.domain.discount;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * A public, one-tap-applicable offer as seen on the storefront. Deliberately
 * slim: only what the storefront needs to render a rich label and apply the
 * code. Private (code-only) discounts are never mapped into this, so their
 * existence and codes are never exposed.
 */
public class PublicOfferResponse {

    private final String code;
    private final String name;
    private final DiscountType type;
    private final BigDecimal value;
    private final BigDecimal minSpend;
    private final boolean firstOrderOnly;
    /** When true, the value is off the delivery fee (label "X off delivery"). */
    private final boolean appliesToDelivery;
    private final boolean storeWide;
    private final List<Long> productIds;
    /** Human "applies to" label (e.g. "All products", a category, a product name, "3 products"). */
    private final String scopeLabel;
    /** When the offer stops being valid; null = no end date. Drives "Valid until …". */
    private final LocalDateTime endsAt;

    public PublicOfferResponse(Discount d, String scopeLabel) {
        this.code = d.getCode();
        this.name = d.getName();
        this.type = d.getType();
        this.value = d.getValue();
        this.minSpend = d.getMinSpend();
        this.firstOrderOnly = d.isFirstOrderOnly();
        this.appliesToDelivery = d.isAppliesToDelivery();
        this.storeWide = d.isStoreWide();
        this.productIds = d.getProductIds().stream().sorted().toList();
        this.scopeLabel = scopeLabel;
        this.endsAt = d.getEndsAt();
    }

    public String getCode() { return code; }
    public String getName() { return name; }
    public DiscountType getType() { return type; }
    public BigDecimal getValue() { return value; }
    public BigDecimal getMinSpend() { return minSpend; }
    public boolean isFirstOrderOnly() { return firstOrderOnly; }
    public boolean isAppliesToDelivery() { return appliesToDelivery; }
    public boolean isStoreWide() { return storeWide; }
    public List<Long> getProductIds() { return productIds; }
    public String getScopeLabel() { return scopeLabel; }
    public LocalDateTime getEndsAt() { return endsAt; }
}

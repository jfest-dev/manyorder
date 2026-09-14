package com.manyorder.api.domain.discount;

import java.math.BigDecimal;
import java.util.List;

/**
 * A public, one-tap-applicable offer as seen on the storefront. Deliberately
 * slim: only what the storefront needs to render a label and apply the code.
 * Private (code-only) discounts are never mapped into this, so their existence
 * and codes are never exposed.
 */
public class PublicOfferResponse {

    private final String code;
    private final String name;
    private final DiscountType type;
    private final BigDecimal value;
    private final BigDecimal minSpend;
    private final boolean firstOrderOnly;
    private final boolean storeWide;
    private final List<Long> productIds;

    public PublicOfferResponse(Discount d) {
        this.code = d.getCode();
        this.name = d.getName();
        this.type = d.getType();
        this.value = d.getValue();
        this.minSpend = d.getMinSpend();
        this.firstOrderOnly = d.isFirstOrderOnly();
        this.storeWide = d.isStoreWide();
        this.productIds = d.getProductIds().stream().sorted().toList();
    }

    public String getCode() { return code; }
    public String getName() { return name; }
    public DiscountType getType() { return type; }
    public BigDecimal getValue() { return value; }
    public BigDecimal getMinSpend() { return minSpend; }
    public boolean isFirstOrderOnly() { return firstOrderOnly; }
    public boolean isStoreWide() { return storeWide; }
    public List<Long> getProductIds() { return productIds; }
}

package com.manyorder.api.domain.discount;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import com.fasterxml.jackson.annotation.JsonProperty;

public class DiscountResponse {

    private final Long id;
    private final String code;
    private final String name;
    private final DiscountType type;
    private final BigDecimal value;
    private final Integer usageLimit;
    private final BigDecimal minSpend;
    private final int usedCount;
    private final LocalDateTime startsAt;
    private final LocalDateTime endsAt;
    private final boolean active;
    private final boolean firstOrderOnly;
    private final boolean canStackWithSale;
    private final boolean isPublic;
    /** Products the discount is limited to; empty = store-wide. Sorted for stable output. */
    private final List<Long> productIds;
    /** Merchant-controlled sort position (drag-to-reorder). */
    private final int displayOrder;
    private final LocalDateTime createdAt;

    public DiscountResponse(Discount d) {
        this.id = d.getId();
        this.code = d.getCode();
        this.name = d.getName();
        this.type = d.getType();
        this.value = d.getValue();
        this.usageLimit = d.getUsageLimit();
        this.minSpend = d.getMinSpend();
        this.usedCount = d.getUsedCount();
        this.startsAt = d.getStartsAt();
        this.endsAt = d.getEndsAt();
        this.active = d.isActive();
        this.firstOrderOnly = d.isFirstOrderOnly();
        this.canStackWithSale = d.isCanStackWithSale();
        this.isPublic = d.isPublic();
        this.productIds = d.getProductIds().stream().sorted().toList();
        this.displayOrder = d.getDisplayOrder();
        this.createdAt = d.getCreatedAt();
    }

    public Long getId() { return id; }
    public String getCode() { return code; }
    public String getName() { return name; }
    public DiscountType getType() { return type; }
    public BigDecimal getValue() { return value; }
    public Integer getUsageLimit() { return usageLimit; }
    public BigDecimal getMinSpend() { return minSpend; }
    public int getUsedCount() { return usedCount; }
    public LocalDateTime getStartsAt() { return startsAt; }
    public LocalDateTime getEndsAt() { return endsAt; }
    public boolean isActive() { return active; }
    public boolean isFirstOrderOnly() { return firstOrderOnly; }
    public boolean isCanStackWithSale() { return canStackWithSale; }
    // Pin the JSON name: a boolean getter isPublic() would otherwise serialize as
    // "public", but the request side and clients use "isPublic".
    @JsonProperty("isPublic")
    public boolean isPublic() { return isPublic; }
    public List<Long> getProductIds() { return productIds; }
    public int getDisplayOrder() { return displayOrder; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}

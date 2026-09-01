package com.manyorder.api.domain.discount;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public class DiscountResponse {

    private final Long id;
    private final String code;
    private final String name;
    private final DiscountType type;
    private final BigDecimal value;
    private final Integer usageLimit;
    private final int usedCount;
    private final LocalDateTime startsAt;
    private final LocalDateTime endsAt;
    private final boolean active;
    private final LocalDateTime createdAt;

    public DiscountResponse(Discount d) {
        this.id = d.getId();
        this.code = d.getCode();
        this.name = d.getName();
        this.type = d.getType();
        this.value = d.getValue();
        this.usageLimit = d.getUsageLimit();
        this.usedCount = d.getUsedCount();
        this.startsAt = d.getStartsAt();
        this.endsAt = d.getEndsAt();
        this.active = d.isActive();
        this.createdAt = d.getCreatedAt();
    }

    public Long getId() { return id; }
    public String getCode() { return code; }
    public String getName() { return name; }
    public DiscountType getType() { return type; }
    public BigDecimal getValue() { return value; }
    public Integer getUsageLimit() { return usageLimit; }
    public int getUsedCount() { return usedCount; }
    public LocalDateTime getStartsAt() { return startsAt; }
    public LocalDateTime getEndsAt() { return endsAt; }
    public boolean isActive() { return active; }
    public LocalDateTime getCreatedAt() { return createdAt; }
}

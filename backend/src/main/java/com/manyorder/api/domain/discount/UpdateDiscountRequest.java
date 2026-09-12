package com.manyorder.api.domain.discount;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;

/** PATCH semantics: null fields are left unchanged. */
public class UpdateDiscountRequest {

    private String code;
    private String name;
    private DiscountType type;

    @Positive
    private BigDecimal value;

    @PositiveOrZero
    private Integer usageLimit;

    /** Minimum cart subtotal to use the code. Null leaves it unchanged; 0 clears it. */
    @PositiveOrZero
    private BigDecimal minSpend;

    private LocalDateTime startsAt;
    private LocalDateTime endsAt;
    private Boolean active;
    private Boolean firstOrderOnly;

    /** Null = leave the product scope unchanged; empty list = clear to store-wide;
     *  non-empty = replace with these products. */
    private List<Long> productIds;

    public UpdateDiscountRequest() {}

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
    public LocalDateTime getStartsAt() { return startsAt; }
    public void setStartsAt(LocalDateTime startsAt) { this.startsAt = startsAt; }
    public LocalDateTime getEndsAt() { return endsAt; }
    public void setEndsAt(LocalDateTime endsAt) { this.endsAt = endsAt; }
    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }
    public Boolean getFirstOrderOnly() { return firstOrderOnly; }
    public void setFirstOrderOnly(Boolean firstOrderOnly) { this.firstOrderOnly = firstOrderOnly; }
    public List<Long> getProductIds() { return productIds; }
    public void setProductIds(List<Long> productIds) { this.productIds = productIds; }
}

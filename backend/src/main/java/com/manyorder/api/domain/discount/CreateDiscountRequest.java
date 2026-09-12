package com.manyorder.api.domain.discount;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public class CreateDiscountRequest {

    @NotBlank
    private String code;

    /** Optional friendly label. */
    @Size(max = 255)
    private String name;

    @NotNull
    private DiscountType type;

    /** Percent or fixed amount. Required (and > 0) for PERCENTAGE/FIXED; unused
     *  for FREE_DELIVERY. Enforced in the service so it can depend on the type. */
    private BigDecimal value;

    /** Null = unlimited redemptions. */
    @PositiveOrZero
    private Integer usageLimit;

    /** Minimum cart subtotal to use the code. Null = no minimum. */
    @Positive
    private BigDecimal minSpend;

    private LocalDateTime startsAt;
    private LocalDateTime endsAt;

    /** Defaults to true when omitted. */
    private Boolean active;

    /** When true, only valid for a customer with no prior order. Defaults to false. */
    private Boolean firstOrderOnly;

    /** When true, may combine with an active product sale price. Defaults to false. */
    private Boolean canStackWithSale;

    /** Products this discount is limited to. Null/empty = store-wide. */
    private List<Long> productIds;

    public CreateDiscountRequest() {}

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
    public Boolean getCanStackWithSale() { return canStackWithSale; }
    public void setCanStackWithSale(Boolean canStackWithSale) { this.canStackWithSale = canStackWithSale; }
    public List<Long> getProductIds() { return productIds; }
    public void setProductIds(List<Long> productIds) { this.productIds = productIds; }
}

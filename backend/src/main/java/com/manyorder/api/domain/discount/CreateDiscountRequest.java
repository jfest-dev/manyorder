package com.manyorder.api.domain.discount;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;

public class CreateDiscountRequest {

    @NotBlank
    private String code;

    @NotNull
    private DiscountType type;

    @NotNull
    @Positive
    private BigDecimal value;

    /** Null = unlimited redemptions. */
    @PositiveOrZero
    private Integer usageLimit;

    private LocalDateTime startsAt;
    private LocalDateTime endsAt;

    /** Defaults to true when omitted. */
    private Boolean active;

    public CreateDiscountRequest() {}

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public DiscountType getType() { return type; }
    public void setType(DiscountType type) { this.type = type; }
    public BigDecimal getValue() { return value; }
    public void setValue(BigDecimal value) { this.value = value; }
    public Integer getUsageLimit() { return usageLimit; }
    public void setUsageLimit(Integer usageLimit) { this.usageLimit = usageLimit; }
    public LocalDateTime getStartsAt() { return startsAt; }
    public void setStartsAt(LocalDateTime startsAt) { this.startsAt = startsAt; }
    public LocalDateTime getEndsAt() { return endsAt; }
    public void setEndsAt(LocalDateTime endsAt) { this.endsAt = endsAt; }
    public Boolean getActive() { return active; }
    public void setActive(Boolean active) { this.active = active; }
}

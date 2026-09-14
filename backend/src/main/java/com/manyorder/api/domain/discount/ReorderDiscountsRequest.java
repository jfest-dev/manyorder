package com.manyorder.api.domain.discount;

import java.util.List;

import jakarta.validation.constraints.NotEmpty;

/** The desired discount order, as the full list of discount ids top-to-bottom. */
public class ReorderDiscountsRequest {

    @NotEmpty
    private List<Long> discountIds;

    public ReorderDiscountsRequest() {}

    public List<Long> getDiscountIds() { return discountIds; }
    public void setDiscountIds(List<Long> discountIds) { this.discountIds = discountIds; }
}

package com.manyorder.api.domain.product;

import java.util.List;

import jakarta.validation.constraints.NotEmpty;

/** The desired product order, as the full list of product ids top-to-bottom. */
public class ReorderProductsRequest {

    @NotEmpty
    private List<Long> productIds;

    public ReorderProductsRequest() {}

    public List<Long> getProductIds() { return productIds; }
    public void setProductIds(List<Long> productIds) { this.productIds = productIds; }
}

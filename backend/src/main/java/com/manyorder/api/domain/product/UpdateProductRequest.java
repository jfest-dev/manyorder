package com.manyorder.api.domain.product;

import java.math.BigDecimal;

import jakarta.validation.constraints.Positive;

/** PATCH semantics: null fields are left unchanged. */
public class UpdateProductRequest {

    private String name;
    private String description;

    @Positive
    private BigDecimal price;

    public UpdateProductRequest() {}

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public BigDecimal getPrice() { return price; }
    public void setPrice(BigDecimal price) { this.price = price; }
}
